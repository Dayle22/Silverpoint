import { measurePanelOverlay } from '@/app/shell/panels/hosts'
import { clampRectToOverlay, floatContainer, raiseFloat, setFloatRect } from '@/app/shell/panels/layout'
import { PANEL_MEMBER_MIN_HEIGHT, PANEL_MIN_WIDTH, type FloatId, type PanelRect } from '@/app/shell/panels/types'

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const HORIZONTAL: Record<ResizeHandle, -1 | 0 | 1> = {
  n: 0,
  s: 0,
  e: 1,
  w: -1,
  ne: 1,
  nw: -1,
  se: 1,
  sw: -1
}

const VERTICAL: Record<ResizeHandle, -1 | 0 | 1> = {
  n: -1,
  s: 1,
  e: 0,
  w: 0,
  ne: -1,
  nw: -1,
  se: 1,
  sw: 1
}

export const RESIZE_CURSORS: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize'
}

/**
 * Resizes a floating container from one of its eight handles - the whole
 * window, not a single member. Dragging a west or north handle moves the
 * origin as well as the size, so the opposite edge stays put.
 */
export function startPanelResize(id: FloatId, handle: ResizeHandle, event: PointerEvent): void {
  if (event.button !== 0) return
  if (!(event.currentTarget instanceof HTMLElement)) return
  // Annotated rather than inferred: the instanceof narrowing does not reach the
  // nested finish() closure, which also needs the element.
  const target: HTMLElement = event.currentTarget

  const initial = floatContainer(id)
  if (!initial) return
  const start: PanelRect = { x: initial.x, y: initial.y, width: initial.width, height: initial.height }

  event.preventDefault()
  event.stopPropagation()
  raiseFloat(id)

  const overlay = measurePanelOverlay()
  const dx = HORIZONTAL[handle]
  const dy = VERTICAL[handle]
  const startX = event.clientX
  const startY = event.clientY

  let frame = 0
  let latest: PointerEvent | null = null

  function apply(moveEvent: PointerEvent): void {
    const deltaX = moveEvent.clientX - startX
    const deltaY = moveEvent.clientY - startY

    const next: PanelRect = { x: start.x, y: start.y, width: start.width, height: start.height }

    if (dx === 1) next.width = Math.max(PANEL_MIN_WIDTH, start.width + deltaX)
    if (dx === -1) {
      next.width = Math.max(PANEL_MIN_WIDTH, start.width - deltaX)
      next.x = start.x + (start.width - next.width)
    }
    if (dy === 1) next.height = Math.max(PANEL_MEMBER_MIN_HEIGHT, start.height + deltaY)
    if (dy === -1) {
      next.height = Math.max(PANEL_MEMBER_MIN_HEIGHT, start.height - deltaY)
      next.y = start.y + (start.height - next.height)
    }

    setFloatRect(id, clampRectToOverlay(next, overlay))
  }

  function schedule(): void {
    if (frame !== 0 || !latest) return
    frame = requestAnimationFrame(() => {
      frame = 0
      const pending = latest
      latest = null
      if (pending) apply(pending)
    })
  }

  function onMove(moveEvent: PointerEvent): void {
    latest = moveEvent
    schedule()
  }

  function finish(cancelled: boolean): void {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = 0
    latest = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKeydown, true)
    target.releasePointerCapture(event.pointerId)
    if (cancelled) setFloatRect(id, start)
  }

  function onUp(): void {
    finish(false)
  }

  function onCancel(): void {
    finish(true)
  }

  function onKeydown(keyEvent: KeyboardEvent): void {
    if (keyEvent.key !== 'Escape') return
    keyEvent.preventDefault()
    keyEvent.stopPropagation()
    finish(true)
  }

  target.setPointerCapture(event.pointerId)
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKeydown, true)
}
