import type { Canvas } from 'canvaskit-wasm'

import { sampleGradientSpine, type SceneGraph, type SceneNode, type Fill, type Stroke } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import type { Vector, Color } from '@open-pencil/scene-graph/primitives'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'

const HANDLE_CIRCLE_RADIUS = 6
/** Radius of a colour stop handle, and of the highlighted (active) one. */
const STOP_RADIUS = 7
const ACTIVE_STOP_RADIUS = 9
/** White ring drawn around every stop so it reads against any fill. */
const STOP_RING_WIDTH = 2

/**
 * Pointer hit radius for the gradient handles, in device-independent pixels.
 * Kept next to the drawn sizes above so grabbing a handle stays in step with
 * how large it looks; the generic `HANDLE_HIT_RADIUS` is tuned for the smaller
 * resize and radius controls.
 */
export const GRADIENT_HANDLE_HIT_RADIUS = 9
/** Segment count for the ellipse outline drawn for radial and angular gradients. */
const ELLIPSE_SEGMENTS = 64

export const DEFAULT_LINEAR_TRANSFORM = { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
export const DEFAULT_RADIAL_TRANSFORM = { m00: 0.5, m01: 0, m02: 0.5, m10: 0, m11: 0.5, m12: 0.5 }

/** The outline shape drawn around a gradient's extent, by gradient subtype. */
export type GradientOutline = 'none' | 'ellipse' | 'diamond'

export interface GradientGeometry {
  start: Vector
  end: Vector
  startColor: Color
  endColor: Color
  stops: Array<{ position: number; color: Color; localPoint: Vector; index: number }>
  /**
   * Outline drawn around the gradient extent. Linear gradients have no
   * outline; every other subtype spreads out from `start` across both axes.
   */
  outline: GradientOutline
  /**
   * Second (perpendicular) gradient axis, as an offset from `start`. Only
   * meaningful when `outline` is not `'none'`.
   */
  widthPoint: Vector
  spinePoints?: Vector[]
  bendPoint?: Vector
}

export function defaultGradientTransform(type: string): NonNullable<Fill['gradientTransform']> {
  return type === 'GRADIENT_LINEAR' || type === 'GRADIENT_CURVED' ? { ...DEFAULT_LINEAR_TRANSFORM } : { ...DEFAULT_RADIAL_TRANSFORM }
}

export function isGradientFill(fill: unknown): fill is Fill & { type: `GRADIENT_${string}` } {
  return (
    typeof fill === 'object' &&
    fill !== null &&
    'visible' in fill &&
    Boolean((fill as { visible?: boolean }).visible) &&
    'type' in fill &&
    typeof (fill as { type?: unknown }).type === 'string' &&
    ((fill as { type: string }).type.startsWith('GRADIENT_'))
  )
}

export type GradientEditTarget = NonNullable<RenderOverlays['gradientEdit']>

function paintListFor(
  node: SceneNode,
  property: GradientEditTarget['property']
): ReadonlyArray<Fill | Stroke> | undefined {
  return property === 'strokes' ? node.strokes : node.fills
}

/**
 * Resolves which gradient paint currently owns the on-canvas handles.
 *
 * An explicit edit (set while a gradient picker is open) wins only while its
 * node is the sole selected node. Otherwise the handles fall back to the first
 * visible gradient fill of that single selected node, so applying a gradient
 * leaves its line on canvas after the picker closes. Deselecting, selecting a
 * solid object or multi-selecting clears the handles. Drawing and hit-testing
 * both call this, so they cannot drift.
 */
export function resolveGradientEdit(
  graph: SceneGraph,
  selectedIds: ReadonlySet<string>,
  edit: GradientEditTarget | null | undefined
): GradientEditTarget | null {
  if (selectedIds.size !== 1) return null
  const selectedId = selectedIds.values().next().value
  if (!selectedId) return null

  const node = graph.getNode(selectedId)
  if (!node || !node.visible || node.locked) return null

  if (edit && edit.nodeId === selectedId) {
    const fill = paintListFor(node, edit.property)?.at(edit.fillIndex)
    if (fill && isGradientFill(fill)) return edit
  }

  const fillIndex = node.fills.findIndex(isGradientFill)
  if (fillIndex === -1) return null
  return { nodeId: selectedId, fillIndex, property: 'fills' }
}

function gradientOutlineFor(type: string): GradientOutline {
  if (type === 'GRADIENT_LINEAR' || type === 'GRADIENT_CURVED') return 'none'
  if (type === 'GRADIENT_DIAMOND') return 'diamond'
  return 'ellipse'
}

export function getGradientGeometry(node: SceneNode, fill: Fill): GradientGeometry {
  const w = node.width
  const h = node.height
  const t = fill.gradientTransform ?? defaultGradientTransform(fill.type)

  const linear = fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_CURVED'

  let start: Vector
  let end: Vector

  if (linear) {
    start = {
      x: (t.m00 + t.m02) * w,
      y: (t.m10 + t.m12) * h
    }
    end = {
      x: t.m02 * w,
      y: t.m12 * h
    }
  } else {
    // Radial, Angular, Diamond: `start` is the centre, `end` the first axis tip.
    start = {
      x: t.m02 * w,
      y: t.m12 * h
    }
    end = {
      x: (t.m00 + t.m02) * w,
      y: (t.m10 + t.m12) * h
    }
  }

  let spinePoints: Vector[] | undefined
  let bendPoint: Vector | undefined
  if (fill.type === 'GRADIENT_CURVED') {
    spinePoints = sampleGradientSpine(start.x, start.y, end.x, end.y, fill.gradientSpine ?? [])
    const dx = end.x - start.x
    const dy = end.y - start.y
    const perp = { x: -dy, y: dx }
    const offset = fill.gradientSpine?.[0]?.offset ?? 0
    bendPoint = {
      x: start.x + 0.5 * dx + offset * perp.x,
      y: start.y + 0.5 * dy + offset * perp.y
    }
  }

  const rawStops = fill.gradientStops ?? [
    { color: fill.color, position: 0 },
    { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
  ]

  const stops = rawStops.map((s, index) => {
    const p = s.position
    return {
      index,
      position: p,
      color: s.color,
      localPoint: {
        x: start.x + p * (end.x - start.x),
        y: start.y + p * (end.y - start.y)
      }
    }
  })

  const startColor = stops[0]?.color ?? fill.color
  const endColor = stops[stops.length - 1]?.color ?? { r: 1, g: 1, b: 1, a: 1 }

  const outline: GradientOutline = gradientOutlineFor(fill.type)

  const widthPoint: Vector = linear
    ? { x: end.x, y: end.y }
    : { x: start.x + t.m01 * w, y: start.y + t.m11 * h }

  return { start, end, startColor, endColor, stops, outline, widthPoint, spinePoints, bendPoint }
}

/**
 * Draws one colour stop: the stop's colour inside a white ring, which is the
 * container that keeps it legible over any fill. The active stop is drawn
 * larger and gains a selection-coloured ring outside the white one.
 */
function drawStop(
  r: SkiaRenderer,
  canvas: Canvas,
  point: Vector,
  color: Color,
  zoom: number,
  active: boolean
): void {
  const radius = (active ? ACTIVE_STOP_RADIUS : STOP_RADIUS) / zoom
  const ringWidth = STOP_RING_WIDTH / zoom

  if (active) {
    r.auxStroke.setStrokeWidth(ringWidth)
    r.auxStroke.setColor(r.selColor())
    canvas.drawCircle(point.x, point.y, radius + ringWidth, r.auxStroke)
  }

  // White ring, drawn as a stroke sitting just inside the handle's edge
  r.auxStroke.setStrokeWidth(ringWidth)
  r.auxStroke.setColor(r.ck.WHITE)
  canvas.drawCircle(point.x, point.y, radius - ringWidth / 2, r.auxStroke)

  // Colour core
  r.auxFill.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  canvas.drawCircle(point.x, point.y, radius - ringWidth, r.auxFill)
}

function drawGradientOutline(
  r: SkiaRenderer,
  canvas: Canvas,
  geo: GradientGeometry
): void {
  if (geo.outline === 'none') return

  const cx = geo.start.x
  const cy = geo.start.y
  const ax = geo.end.x - cx
  const ay = geo.end.y - cy
  const bx = geo.widthPoint.x - cx
  const by = geo.widthPoint.y - cy

  const path = new r.ck.Path()
  if (geo.outline === 'diamond') {
    path.moveTo(cx + ax, cy + ay)
    path.lineTo(cx + bx, cy + by)
    path.lineTo(cx - ax, cy - ay)
    path.lineTo(cx - bx, cy - by)
  } else {
    for (let i = 0; i <= ELLIPSE_SEGMENTS; i++) {
      const angle = (i / ELLIPSE_SEGMENTS) * Math.PI * 2
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      const px = cx + ax * c + bx * s
      const py = cy + ay * c + by * s
      if (i === 0) path.moveTo(px, py)
      else path.lineTo(px, py)
    }
  }
  path.close()
  canvas.drawPath(path, r.auxStroke)
  path.delete()
}

/**
 * Draws the gradient line and its start/end/stop handle swatches for the
 * gradient fill currently being edited or selected on canvas. Radial, angular
 * and diamond gradients additionally get an outline of their extent plus a
 * handle on the second axis, so their shape can be adjusted directly.
 */
export function drawGradientHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  edit: RenderOverlays['gradientEdit']
): void {
  if (!edit) return
  const node = graph.getNode(edit.nodeId)
  if (!node || !node.visible) return

  const list = paintListFor(node, edit.property)
  const fill = list?.at(edit.fillIndex)
  if (!fill || !isGradientFill(fill)) return

  const geo = getGradientGeometry(node, fill)
  const zoom = Math.max(r.zoom, Number.EPSILON)
  const circleRadius = HANDLE_CIRCLE_RADIUS / zoom
  const strokeWidth = 1 / zoom
  const lastStopIndex = geo.stops.length - 1
  const activeStopIndex = edit.activeStopIndex ?? null

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(getWorldMatrix(node, graph))

  r.auxStroke.setStrokeWidth(strokeWidth)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)

  // Draw the extent outline first so the line and handles sit on top of it
  drawGradientOutline(r, canvas, geo)

  // Draw connecting gradient line or curved polyline
  if (fill.type === 'GRADIENT_CURVED' && geo.spinePoints && geo.spinePoints.length > 0) {
    const path = new r.ck.Path()
    path.moveTo(geo.spinePoints[0].x, geo.spinePoints[0].y)
    for (let i = 1; i < geo.spinePoints.length; i++) {
      path.lineTo(geo.spinePoints[i].x, geo.spinePoints[i].y)
    }
    canvas.drawPath(path, r.auxStroke)
    path.delete()

    if (geo.bendPoint) {
      r.auxStroke.setStrokeWidth(strokeWidth)
      r.auxStroke.setColor(r.selColor())
      r.auxFill.setColor(r.ck.WHITE)
      canvas.drawCircle(geo.bendPoint.x, geo.bendPoint.y, circleRadius, r.auxFill)
      canvas.drawCircle(geo.bendPoint.x, geo.bendPoint.y, circleRadius, r.auxStroke)
    }
  } else {
    r.auxStroke.setStrokeWidth(strokeWidth)
    r.auxStroke.setColor(r.selColor())
    canvas.drawLine(geo.start.x, geo.start.y, geo.end.x, geo.end.y, r.auxStroke)
  }

  // Draw the second-axis handle for radial / angular / diamond gradients
  if (geo.outline !== 'none') {
    r.auxStroke.setStrokeWidth(strokeWidth)
    r.auxStroke.setColor(r.selColor())
    r.auxFill.setColor(r.ck.WHITE)
    canvas.drawCircle(geo.widthPoint.x, geo.widthPoint.y, circleRadius, r.auxFill)
    canvas.drawCircle(geo.widthPoint.x, geo.widthPoint.y, circleRadius, r.auxStroke)
  }

  // Draw the intermediate colour stops, then the two ends on top of them
  for (let i = 1; i < lastStopIndex; i++) {
    const stop = geo.stops[i]
    drawStop(r, canvas, stop.localPoint, stop.color, zoom, i === activeStopIndex)
  }
  drawStop(r, canvas, geo.start, geo.startColor, zoom, activeStopIndex === 0)
  drawStop(r, canvas, geo.end, geo.endColor, zoom, activeStopIndex === lastStopIndex)

  canvas.restore()
}
