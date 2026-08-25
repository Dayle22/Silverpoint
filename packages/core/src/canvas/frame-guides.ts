import type { Canvas } from 'canvaskit-wasm'

import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { getAbsoluteRotation, getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { parseFrameGuides } from '#core/guides/frame'
import { parseColor } from '#core/color'

import { drawLayoutGrids } from './layout-grids'

function belongsToPage(node: SceneNode, pageId: string, graph: SceneGraph): boolean {
  let current: SceneNode | undefined = node
  while (current?.parentId) {
    if (current.parentId === pageId) return true
    current = graph.getNode(current.parentId)
  }
  return false
}

function drawGuideRect(
  r: SkiaRenderer,
  canvas: Canvas,
  bounds: [number, number, number, number],
  color: Color
) {
  r.auxStroke.setColor(r.ck.Color4f(color.r, color.g, color.b, color.a))
  canvas.drawRect(r.ck.LTRBRect(...bounds), r.auxStroke)
}

export function drawFrameGuides(r: SkiaRenderer, canvas: Canvas, graph: SceneGraph): void {
  if (!r.pageId) return
  for (const node of graph.getAllNodes()) {
    if (node.type !== 'FRAME' || !belongsToPage(node, r.pageId, graph)) continue
    if (getAbsoluteRotation(node, graph) !== 0) continue
    const guides = parseFrameGuides(node.pluginData)

    canvas.save()
    canvas.translate(r.panX, r.panY)
    canvas.scale(r.zoom, r.zoom)
    canvas.concat(getWorldMatrix(node, graph))
    r.auxStroke.setStrokeWidth(1 / r.zoom)

    drawLayoutGrids(r, canvas, node)
    if (guides.margins.enabled) {
      drawGuideRect(
        r,
        canvas,
        [
          guides.margins.left,
          guides.margins.top,
          node.width - guides.margins.right,
          node.height - guides.margins.bottom
        ],
        { ...parseColor(r.guideAppearance.margins.color), a: r.guideAppearance.margins.opacity }
      )
    }
    if (guides.bleed.enabled) {
      drawGuideRect(
        r,
        canvas,
        [
          -guides.bleed.left,
          -guides.bleed.top,
          node.width + guides.bleed.right,
          node.height + guides.bleed.bottom
        ],
        { ...parseColor(r.guideAppearance.bleed.color), a: r.guideAppearance.bleed.opacity }
      )
    }
    canvas.restore()
  }
}
