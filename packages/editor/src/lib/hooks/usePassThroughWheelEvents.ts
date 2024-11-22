import { useEffect } from 'react'
import { preventDefault } from '../utils/dom'
import { useContainer } from './useContainer'

/** @public */
export function usePassThroughWheelEvents(elm: HTMLElement | null) {
	const container = useContainer()

	useEffect(() => {
		function onWheel(e: WheelEvent) {
			if ((e as any).isSpecialRedispatchedEvent) return
			preventDefault(e)
			const cvs = container.querySelector('.tl-canvas')
			if (!cvs) return
			const newEvent = new WheelEvent('wheel', e as any)
			;(newEvent as any).isSpecialRedispatchedEvent = true
			cvs.dispatchEvent(newEvent)
		}

		if (!elm) return

		elm.addEventListener('wheel', onWheel, { passive: false })
		return () => {
			elm.removeEventListener('wheel', onWheel)
		}
	}, [container, elm])
}
