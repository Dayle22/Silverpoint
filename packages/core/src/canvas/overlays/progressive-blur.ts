import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph } from '@open-pencil/scene-graph'
import {
  isProgressiveBlur,
  progressiveBlurAxis,
  progressiveBlurPointAt,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'

const HANDLE_RADIUS = 4

/**
 * Draws the ramp line and its two endpoint handles for the progressive blur
 * currently being edited, so the blur direction can be set on canvas.
 *
 * Handle geometry is kept in step with `hitTestProgressiveBlurHandle` in the
 * input layer: both read the ramp axis from the same normalised offsets.
 */
export function drawProgressiveBlurHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  edit: RenderOverlays['progressiveBlurEdit']
): void {
  if (!edit) return
  const node = graph.getNode(edit.nodeId)
  if (!node || !node.visible) return
  const effect = node.effects.at(edit.effectIndex)
  if (!effect || !effect.visible || !isProgressiveBlur(effect)) return

  const ramp = resolveProgressiveBlur(effect)
  const axis = progressiveBlurAxis(ramp, node.width, node.height)
  const start = progressiveBlurPointAt(axis, 0)
  const end = progressiveBlurPointAt(axis, 1)

  const zoom = Math.max(r.zoom, Number.EPSILON)
  const handleRadius = HANDLE_RADIUS / zoom

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(getWorldMatrix(node, graph))

  r.auxStroke.setStrokeWidth(1 / zoom)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.drawLine(start.x, start.y, end.x, end.y, r.auxStroke)

  for (const point of [start, end]) {
    r.auxFill.setColor(r.ck.WHITE)
    canvas.drawCircle(point.x, point.y, handleRadius, r.auxFill)
    canvas.drawCircle(point.x, point.y, handleRadius, r.auxStroke)
  }

  canvas.restore()
}
