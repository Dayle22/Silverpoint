import type { Canvas } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { RenderOverlays } from '#core/canvas/renderer/types'
import { unwrapPath } from '#core/editor/structure/shape-builder'

export function drawShapeBuilderOverlay(
  renderer: SkiaRenderer,
  canvas: Canvas,
  overlays: RenderOverlays
): void {
  const sbState = overlays.shapeBuilderState
  if (!sbState || sbState.regions.length === 0) return

  const ck = renderer.ck
  const isDelete = sbState.isDeleteMode

  const fillPaint = new ck.Paint()
  fillPaint.setStyle(ck.PaintStyle.Fill)
  if (isDelete) {
    fillPaint.setColor(ck.Color4f(1.0, 0.3, 0.31, 0.25))
  } else {
    fillPaint.setColor(ck.Color4f(0.09, 0.56, 1.0, 0.25))
  }

  const activeStrokePaint = new ck.Paint()
  activeStrokePaint.setStyle(ck.PaintStyle.Stroke)
  activeStrokePaint.setStrokeWidth(1.5)
  activeStrokePaint.setAntiAlias(true)
  if (isDelete) {
    activeStrokePaint.setColor(ck.Color4f(1.0, 0.3, 0.31, 1.0))
  } else {
    activeStrokePaint.setColor(ck.Color4f(0.09, 0.56, 1.0, 1.0))
  }

  const faintStrokePaint = new ck.Paint()
  faintStrokePaint.setStyle(ck.PaintStyle.Stroke)
  faintStrokePaint.setStrokeWidth(1.0)
  faintStrokePaint.setAntiAlias(true)
  faintStrokePaint.setColor(ck.Color4f(0.55, 0.55, 0.55, 0.25))

  try {
    for (const region of sbState.regions) {
      const rawPath = unwrapPath(region.path)
      if (region.hovered || region.dragged) {
        canvas.drawPath(rawPath, fillPaint)
        canvas.drawPath(rawPath, activeStrokePaint)
      } else {
        canvas.drawPath(rawPath, faintStrokePaint)
      }
    }
  } finally {
    fillPaint.delete()
    activeStrokePaint.delete()
    faintStrokePaint.delete()
  }
}
