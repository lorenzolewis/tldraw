import { Box2d, Matrix2d, Matrix2dModel, Vec2d } from '@tldraw/primitives'
import { TLPage, TLShape, TLShapePartial } from '@tldraw/tlschema'
import { compact } from '@tldraw/utils'
import type { App } from '../../../App'
import { DragAndDropManager } from '../../../managers/DragAndDropManager'
import { SnapPoint } from '../../../managers/SnapManager'
import { TLEventHandlers, TLPointerEventInfo } from '../../../types/event-types'
import { StateNode } from '../../StateNode'

export class Translating extends StateNode {
	static override id = 'translating'

	info = {} as TLPointerEventInfo & {
		target: 'shape'
		isCreating?: boolean
		editAfterComplete?: boolean
		onInteractionEnd?: string
	}

	selectionSnapshot: TranslatingSnapshot = {} as any

	snapshot: TranslatingSnapshot = {} as any

	markId = ''

	isCloning = false
	isCreating = false
	editAfterComplete = false

	dragAndDropManager = new DragAndDropManager(this.app)

	onEnter = (
		info: TLPointerEventInfo & {
			target: 'shape'
			isCreating?: boolean
			editAfterComplete?: boolean
			onInteractionEnd?: string
		}
	) => {
		const { isCreating = false, editAfterComplete = false } = info

		this.info = info
		this.isCreating = isCreating
		this.editAfterComplete = editAfterComplete

		this.markId = isCreating ? 'creating' : this.app.mark('translating')
		this.handleEnter(info)
		this.app.on('tick', this.updateParent)
	}

	updateParent = () => {
		const { snapshot } = this
		this.dragAndDropManager.updateDroppingNode(snapshot.movingShapes, this.updateParentTransforms)
	}

	onExit = () => {
		this.app.off('tick', this.updateParent)
		this.selectionSnapshot = {} as any
		this.snapshot = {} as any
		this.app.snaps.clear()
		this.app.setCursor({ type: 'default' })
		this.dragAndDropManager.clear()
	}

	onPointerMove = () => {
		this.updateShapes()
	}

	onKeyDown = () => {
		if (this.app.inputs.altKey && !this.isCloning) {
			this.startCloning()
			return
		}

		// need to update in case user pressed a different modifier key
		this.updateShapes()
	}

	onKeyUp: TLEventHandlers['onKeyUp'] = () => {
		if (!this.app.inputs.altKey && this.isCloning) {
			this.stopCloning()
			return
		}

		// need to update in case user pressed a different modifier key
		this.updateShapes()
	}

	onPointerUp: TLEventHandlers['onPointerUp'] = () => {
		this.complete()
	}

	onComplete: TLEventHandlers['onComplete'] = () => {
		this.complete()
	}

	onCancel: TLEventHandlers['onCancel'] = () => {
		this.cancel()
	}

	reset() {
		this.app.bailToMark(this.markId)
	}

	protected startCloning() {
		if (this.isCreating) return

		this.isCloning = true
		this.reset()
		this.markId = this.app.mark('translating')

		this.app.duplicateShapes()

		this.snapshot = getTranslatingSnapshot(this.app)
		this.handleStart()
		this.updateShapes()
	}

	protected stopCloning() {
		this.isCloning = false
		this.snapshot = this.selectionSnapshot
		this.reset()
		this.markId = this.app.mark('translating')
		this.updateShapes()
	}

	protected complete() {
		this.updateShapes()
		this.dragAndDropManager.dropShapes(this.snapshot.movingShapes)
		this.handleEnd()

		if (this.app.instanceState.isToolLocked && this.info.onInteractionEnd) {
			this.app.setSelectedTool(this.info.onInteractionEnd)
		} else {
			if (this.editAfterComplete) {
				const onlySelected = this.app.onlySelectedShape
				if (onlySelected) {
					this.app.setEditingId(onlySelected.id)
					this.app.setSelectedTool('select')
					this.app.root.current.value!.transition('editing_shape', {})
				}
			} else {
				this.parent.transition('idle', {})
			}
		}
	}

	private cancel() {
		this.reset()
		if (this.info.onInteractionEnd) {
			this.app.setSelectedTool(this.info.onInteractionEnd)
		} else {
			this.parent.transition('idle', this.info)
		}
	}

	protected handleEnter(info: TLPointerEventInfo & { target: 'shape' }) {
		this.isCloning = false
		this.info = info

		this.app.setCursor({ type: 'move' })
		this.selectionSnapshot = getTranslatingSnapshot(this.app)

		// Don't clone on create; otherwise clone on altKey
		if (!this.isCreating) {
			if (this.app.inputs.altKey) {
				this.startCloning()
				return
			}
		}

		this.snapshot = this.selectionSnapshot
		this.handleStart()
		this.updateShapes()
	}

	protected handleStart() {
		const { movingShapes } = this.snapshot

		const changes: TLShapePartial[] = []

		movingShapes.forEach((shape) => {
			const util = this.app.getShapeUtil(shape.type)
			const change = util.onTranslateStart?.(shape)
			if (change) {
				changes.push(change)
			}
		})

		if (changes.length > 0) {
			this.app.updateShapes(changes)
		}
	}

	protected handleEnd() {
		const { movingShapes } = this.snapshot

		const changes: TLShapePartial[] = []

		movingShapes.forEach((shape) => {
			const current = this.app.getShapeById(shape.id)!
			const util = this.app.getShapeUtil(shape.type)
			const change = util.onTranslateEnd?.(shape, current)
			if (change) {
				changes.push(change)
			}
		})

		if (changes.length > 0) {
			this.app.updateShapes(changes)
		}
	}

	protected handleChange() {
		const { movingShapes } = this.snapshot

		const changes: TLShapePartial[] = []

		movingShapes.forEach((shape) => {
			const current = this.app.getShapeById(shape.id)!
			const util = this.app.getShapeUtil(shape.type)
			const change = util.onTranslate?.(shape, current)
			if (change) {
				changes.push(change)
			}
		})

		if (changes.length > 0) {
			this.app.updateShapes(changes)
		}
	}

	protected updateShapes() {
		const { snapshot } = this
		this.dragAndDropManager.updateDroppingNode(snapshot.movingShapes, this.updateParentTransforms)

		moveShapesToPoint({
			app: this.app,
			shapeSnapshots: snapshot.shapeSnapshots,
			averagePagePoint: snapshot.averagePagePoint,
			initialSelectionPageBounds: snapshot.initialPageBounds,
			initialSelectionSnapPoints: snapshot.initialSnapPoints,
		})

		this.handleChange()
	}

	protected updateParentTransforms = () => {
		const {
			app,
			snapshot: { shapeSnapshots },
		} = this
		const movingShapes: TLShape[] = []

		shapeSnapshots.forEach((shapeSnapshot) => {
			const shape = app.getShapeById(shapeSnapshot.shape.id)
			if (!shape) return null
			movingShapes.push(shape)

			const parentTransform = TLPage.isId(shape.parentId)
				? null
				: Matrix2d.Inverse(app.getPageTransformById(shape.parentId)!)

			shapeSnapshot.parentTransform = parentTransform
		})
	}
}

function getTranslatingSnapshot(app: App) {
	const movingShapes: TLShape[] = []
	const pagePoints: Vec2d[] = []

	const shapeSnapshots = compact(
		app.selectedIds.map((id): null | MovingShapeSnapshot => {
			const shape = app.getShapeById(id)
			if (!shape) return null
			movingShapes.push(shape)

			const pagePoint = app.getPagePointById(id)
			if (!pagePoint) return null
			pagePoints.push(pagePoint)

			const parentTransform = TLPage.isId(shape.parentId)
				? null
				: Matrix2d.Inverse(app.getPageTransformById(shape.parentId)!)

			return {
				shape,
				pagePoint,
				parentTransform,
			}
		})
	)

	return {
		averagePagePoint: Vec2d.Average(pagePoints),
		movingShapes,
		shapeSnapshots,
		initialPageBounds: app.selectedPageBounds!,
		initialSnapPoints:
			app.selectedIds.length === 1
				? app.snaps.snapPointsCache.get(app.selectedIds[0])!
				: app.selectedPageBounds
				? app.selectedPageBounds.snapPoints.map((p, i) => ({
						id: 'selection:' + i,
						x: p.x,
						y: p.y,
				  }))
				: [],
	}
}

export type TranslatingSnapshot = ReturnType<typeof getTranslatingSnapshot>

export interface MovingShapeSnapshot {
	shape: TLShape
	pagePoint: Vec2d
	parentTransform: Matrix2dModel | null
}

export function moveShapesToPoint({
	app,
	shapeSnapshots: snapshots,
	averagePagePoint,
	initialSelectionPageBounds,
	initialSelectionSnapPoints,
}: {
	app: App
	shapeSnapshots: MovingShapeSnapshot[]
	averagePagePoint: Vec2d
	initialSelectionPageBounds: Box2d
	initialSelectionSnapPoints: SnapPoint[]
}) {
	const { inputs, isGridMode, gridSize } = app

	const delta = Vec2d.Sub(inputs.currentPagePoint, inputs.originPagePoint)

	const flatten: 'x' | 'y' | null = app.inputs.shiftKey
		? Math.abs(delta.x) < Math.abs(delta.y)
			? 'x'
			: 'y'
		: null

	if (flatten === 'x') {
		delta.x = 0
	} else if (flatten === 'y') {
		delta.y = 0
	}

	// Provisional snapping
	app.snaps.clear()

	const shouldSnap =
		(app.userDocumentSettings.isSnapMode ? !inputs.ctrlKey : inputs.ctrlKey) &&
		app.inputs.pointerVelocity.len() < 0.5 // ...and if the user is not dragging fast

	if (shouldSnap) {
		const { nudge } = app.snaps.snapTranslate({
			dragDelta: delta,
			initialSelectionPageBounds,
			lockedAxis: flatten,
			initialSelectionSnapPoints,
		})

		delta.add(nudge)
	}

	const averageSnappedPoint = Vec2d.Add(averagePagePoint, delta)

	if (isGridMode && !inputs.ctrlKey) {
		averageSnappedPoint.snapToGrid(gridSize)
	}

	const averageSnap = Vec2d.Sub(averageSnappedPoint, averagePagePoint)

	app.updateShapes(
		compact(
			snapshots.map(({ shape, pagePoint, parentTransform }): TLShapePartial | null => {
				const newPagePoint = Vec2d.Add(pagePoint, averageSnap)
				const newLocalPoint = parentTransform
					? Matrix2d.applyToPoint(parentTransform, newPagePoint)
					: newPagePoint

				return {
					id: shape.id,
					type: shape.type,
					x: newLocalPoint.x,
					y: newLocalPoint.y,
				}
			})
		),
		true
	)
}
