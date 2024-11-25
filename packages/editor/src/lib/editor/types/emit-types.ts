import { HistoryEntry } from '@tldraw/store'
import { TLPageId, TLRecord, TLShapeId } from '@tldraw/tlschema'
import { TLEventInfo } from './event-types'

/** @public */
export interface TLEventMap {
	// Lifecycle / Internal
	mount: []
	'max-shapes': [{ name: string; pageId: TLPageId; count: number }]
	change: [HistoryEntry<TLRecord>]
	update: []
	crash: [{ error: unknown }]
	'stop-camera-animation': []
	'stop-following': []
	event: [TLEventInfo]
	tick: [number]
	frame: [number]
	'select-all-text': [{ shapeId: TLShapeId }]
	'place-caret': [{ shapeId: TLShapeId; point: { x: number; y: number } }]
}

/** @public */
export type TLEventMapHandler<T extends keyof TLEventMap> = (...args: TLEventMap[T]) => void
