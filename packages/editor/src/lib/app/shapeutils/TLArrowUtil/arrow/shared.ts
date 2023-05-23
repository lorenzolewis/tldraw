import { Matrix2d, Vec2d } from '@tldraw/primitives'
import { TLArrowShape, TLArrowTerminal, TLShape } from '@tldraw/tlschema'
import { App } from '../../../App'
import { TLShapeUtil } from '../../TLShapeUtil'

export function getIsArrowStraight(shape: TLArrowShape) {
	return Math.abs(shape.props.bend) < 8 // snap to +-8px
}

export type BoundShapeInfo<T extends TLShape = TLShape> = {
	shape: T
	util: TLShapeUtil<T>
	didIntersect: boolean
	isExact: boolean
	transform: Matrix2d
	// toLocalPoint: (v: VecLike) => Vec2d
	// toPagePoint: (v: VecLike) => Vec2d
}

export function getBoundShapeInfoForTerminal(
	app: App,
	terminal: TLArrowTerminal
): BoundShapeInfo | undefined {
	if (terminal.type === 'point') {
		return
	}

	const shape = app.getShapeById(terminal.boundShapeId)!
	const util = app.getShapeUtil(shape.type)
	const transform = app.getPageTransform(shape)!

	return {
		shape,
		util,
		transform,
		isExact: terminal.isExact,
		didIntersect: false,
	}
}

export function getArrowTerminalInArrowSpace(
	app: App,
	arrowPageTransform: Matrix2d,
	terminal: TLArrowTerminal
) {
	if (terminal.type === 'point') {
		return Vec2d.From(terminal)
	}

	const boundShape = app.getShapeById(terminal.boundShapeId)

	if (!boundShape) {
		console.error('Expected a bound shape!')
		return new Vec2d(0, 0)
	} else {
		// Find the actual local point of the normalized terminal on
		// the bound shape and transform it to page space, then transform
		// it to arrow space
		const { point, size } = app.getBounds(boundShape)
		const shapePoint = Vec2d.Add(point, Vec2d.MulV(terminal.normalizedAnchor, size))
		const pagePoint = Matrix2d.applyToPoint(app.getPageTransform(boundShape)!, shapePoint)
		const arrowPoint = Matrix2d.applyToPoint(Matrix2d.Inverse(arrowPageTransform), pagePoint)
		return arrowPoint
	}
}

export function getArrowTerminalsInArrowSpace(app: App, shape: TLArrowShape) {
	const arrowPageTransform = app.getPageTransform(shape)!

	const start = getArrowTerminalInArrowSpace(app, arrowPageTransform, shape.props.start)
	const end = getArrowTerminalInArrowSpace(app, arrowPageTransform, shape.props.end)

	return { start, end }
}
