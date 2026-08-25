/**
 * Screen-space snapping for the movable editor panels (T-031).
 *
 * This is deliberately separate from the canvas smart guides (T-010): those
 * work in document coordinates inside the render engine, while these work in
 * CSS pixels inside the panel overlay. The module is pure so it can be tested
 * without a DOM.
 */

import type { PanelRect } from '@/app/shell/panels/types'

export const PANEL_SNAP_THRESHOLD = 8

export type SnapAxis = 'x' | 'y'

export interface SnapGuide {
  axis: SnapAxis
  /** Overlay coordinate of the guide line. */
  position: number
  /** Extent of the guide along the other axis. */
  start: number
  end: number
}

export interface SnapResult {
  x: number
  y: number
  guides: SnapGuide[]
}

export interface SnapOptions {
  /** Set false while the user holds Alt to move without snapping. */
  enabled?: boolean
  threshold?: number
}

interface Bounds {
  left: number
  right: number
  top: number
  bottom: number
}

function boundsOf(rect: PanelRect): Bounds {
  return {
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height
  }
}

function axisEdges(bounds: Bounds, axis: SnapAxis): number[] {
  return axis === 'x'
    ? [bounds.left, (bounds.left + bounds.right) / 2, bounds.right]
    : [bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom]
}

function span(bounds: Bounds, axis: SnapAxis): [number, number] {
  return axis === 'x' ? [bounds.top, bounds.bottom] : [bounds.left, bounds.right]
}

interface AxisMatch {
  delta: number
  position: number
  start: number
  end: number
}

function bestMatchOnAxis(
  moving: Bounds,
  targets: Bounds[],
  axis: SnapAxis,
  threshold: number
): AxisMatch | null {
  const movingEdges = axisEdges(moving, axis)
  const [movingStart, movingEnd] = span(moving, axis)
  let best: AxisMatch | null = null

  for (const target of targets) {
    const [targetStart, targetEnd] = span(target, axis)
    for (const targetEdge of axisEdges(target, axis)) {
      for (const movingEdge of movingEdges) {
        const delta = targetEdge - movingEdge
        if (Math.abs(delta) > threshold) continue
        if (best && Math.abs(delta) >= Math.abs(best.delta)) continue
        best = {
          delta,
          position: targetEdge,
          start: Math.min(movingStart, targetStart),
          end: Math.max(movingEnd, targetEnd)
        }
      }
    }
  }

  return best
}

/**
 * Snaps a dragged panel against the other panels. The canvas/overlay boundary
 * is deliberately not a snap target: it remains a clamp boundary only, so a
 * floating panel does not magnetise to the canvas while being positioned.
 *
 * Each axis is resolved independently and the nearest candidate wins, so a
 * panel can snap its left edge to a neighbour while its top edge snaps to the
 * overlay. Returns the adjusted position plus the guides to draw.
 */
export function snapPanelRect(
  rect: PanelRect,
  others: PanelRect[],
  _overlay: { width: number; height: number },
  options: SnapOptions = {}
): SnapResult {
  const { enabled = true, threshold = PANEL_SNAP_THRESHOLD } = options
  if (!enabled || threshold <= 0) return { x: rect.x, y: rect.y, guides: [] }

  const moving = boundsOf(rect)
  const targets: Bounds[] = others.map(boundsOf)

  const guides: SnapGuide[] = []
  let x = rect.x
  let y = rect.y

  const matchX = bestMatchOnAxis(moving, targets, 'x', threshold)
  if (matchX) {
    x = rect.x + matchX.delta
    guides.push({ axis: 'x', position: matchX.position, start: matchX.start, end: matchX.end })
  }

  const matchY = bestMatchOnAxis(moving, targets, 'y', threshold)
  if (matchY) {
    y = rect.y + matchY.delta
    guides.push({ axis: 'y', position: matchY.position, start: matchY.start, end: matchY.end })
  }

  return { x, y, guides }
}
