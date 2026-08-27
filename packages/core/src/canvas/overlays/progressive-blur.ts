import type { Canvas } from 'canvaskit-wasm'

import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  isProgressiveBlur,
  progressiveBlurAxis,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { HANDLE_HALF_SIZE } from '#core/constants'

export interface ResolvedProgressiveBlurEdit {
  node: SceneNode
  effect: Effect
  effectIndex: number
}

/**
 * Resolves the progressive blur effect that owns the active on-canvas manipulator line.
 * Enforces sole selection lifecycle: handles are shown only when exactly one node is selected.
 */
export function resolveProgressiveBlurEdit(
  graph: SceneGraph,
  selectedIds: Set<string>,
  edit?: { nodeId: string; effectIndex: number } | null
): ResolvedProgressiveBlurEdit | null {
  if (selectedIds.size !== 1) return null

  const selectedId = selectedIds.values().next().value
  if (!selectedId) return null

  const node = graph.getNode(selectedId)
  if (!node || !node.visible || node.locked) return null

  // 1. Check explicit edit if it matches the sole selected node
  if (edit && edit.nodeId === selectedId && typeof edit.effectIndex === 'number') {
    const effect = node.effects.at(edit.effectIndex)
    if (effect?.visible && isProgressiveBlur(effect)) {
      return { node, effect, effectIndex: edit.effectIndex }
    }
  }

  // 2. Fall back to first visible progressive blur on the selected node
  const fallbackIndex = node.effects.findIndex((e) => e.visible && isProgressiveBlur(e))
  if (fallbackIndex !== -1) {
    return { node, effect: node.effects[fallbackIndex], effectIndex: fallbackIndex }
  }

  return null
}

export function drawProgressiveBlurHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  edit?: { nodeId: string; effectIndex: number } | null
): void {
  const resolved = resolveProgressiveBlurEdit(graph, selectedIds, edit)
  if (!resolved) return

  const { node, effect } = resolved
  const ramp = resolveProgressiveBlur(effect)
  const axis = progressiveBlurAxis(ramp, node.width, node.height)
  const worldMatrix = getWorldMatrix(node, graph)

  canvas.save()
  canvas.translate(r.panX, r.panY)
  canvas.scale(r.zoom, r.zoom)
  canvas.concat(worldMatrix)

  // Connecting gradient ramp line
  r.auxStroke.setStrokeWidth(1.5 / r.zoom)
  r.auxStroke.setColor(r.selColor(0.85))
  r.auxStroke.setPathEffect(null)
  canvas.drawLine(axis.x0, axis.y0, axis.x1, axis.y1, r.auxStroke)

  // Start handle (sharp end)
  drawCircleHandle(r, canvas, axis.x0, axis.y0)

  // End handle (blur end)
  drawCircleHandle(r, canvas, axis.x1, axis.y1)

  canvas.restore()
}

function drawCircleHandle(r: SkiaRenderer, canvas: Canvas, x: number, y: number): void {
  const radius = (HANDLE_HALF_SIZE + 0.5) / r.zoom
  r.auxFill.setColor(r.ck.WHITE)
  canvas.drawCircle(x, y, radius, r.auxFill)

  r.auxStroke.setStrokeWidth(1.5 / r.zoom)
  r.auxStroke.setColor(r.selColor())
  r.auxStroke.setPathEffect(null)
  canvas.drawCircle(x, y, radius, r.auxStroke)
}
