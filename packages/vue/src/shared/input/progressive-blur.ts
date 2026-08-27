import { resolveProgressiveBlurEdit } from '@open-pencil/core/canvas/overlays'
import type { Editor } from '@open-pencil/core/editor'
import type { Effect, SceneNode } from '@open-pencil/scene-graph'
import {
  DEFAULT_PROGRESSIVE_END_OFFSET,
  DEFAULT_PROGRESSIVE_START_OFFSET,
  progressiveBlurAxis,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { HANDLE_HIT_RADIUS } from '#vue/shared/input/geometry'
import type { DragProgressiveBlur } from '#vue/shared/input/types'

export interface ProgressiveBlurHandleHit {
  node: SceneNode
  effect: Effect
  effectIndex: number
  handle: 'start' | 'end'
}

export function hitTestProgressiveBlurHandle(
  cx: number,
  cy: number,
  editor: Editor
): ProgressiveBlurHandleHit | null {
  const resolved = resolveProgressiveBlurEdit(
    editor.graph,
    editor.state.selectedIds,
    editor.state.progressiveBlurEdit
  )
  if (!resolved) return null

  const { node, effect, effectIndex } = resolved
  const ramp = resolveProgressiveBlur(effect)
  const axis = progressiveBlurAxis(ramp, node.width, node.height)
  const worldMatrix = getWorldMatrix(node, editor.graph)

  const w0 = Matrix.mapPoint(worldMatrix, { x: axis.x0, y: axis.y0 })
  const w1 = Matrix.mapPoint(worldMatrix, { x: axis.x1, y: axis.y1 })

  const zoom = editor.renderer?.zoom ?? 1
  const hitRadius = HANDLE_HIT_RADIUS / zoom

  if (Math.hypot(cx - w0.x, cy - w0.y) <= hitRadius) {
    return { node, effect, effectIndex, handle: 'start' }
  }
  if (Math.hypot(cx - w1.x, cy - w1.y) <= hitRadius) {
    return { node, effect, effectIndex, handle: 'end' }
  }

  return null
}

export function tryStartProgressiveBlurDrag(
  cx: number,
  cy: number,
  editor: Editor
): DragProgressiveBlur | null {
  const hit = hitTestProgressiveBlurHandle(cx, cy, editor)
  if (!hit) return null

  const origStartOffset = hit.effect.startOffset ?? DEFAULT_PROGRESSIVE_START_OFFSET
  const origEndOffset = hit.effect.endOffset ?? DEFAULT_PROGRESSIVE_END_OFFSET
  const origEffects = hit.node.effects.map((e) => ({
    ...e,
    offset: { ...e.offset },
    color: { ...e.color },
    startOffset: e.startOffset ? { ...e.startOffset } : undefined,
    endOffset: e.endOffset ? { ...e.endOffset } : undefined
  }))

  return {
    type: 'progressive-blur',
    nodeId: hit.node.id,
    effectIndex: hit.effectIndex,
    handle: hit.handle,
    startX: cx,
    startY: cy,
    origStartOffset: { ...origStartOffset },
    origEndOffset: { ...origEndOffset },
    origEffects
  }
}

export function handleProgressiveBlurMove(
  drag: DragProgressiveBlur,
  cx: number,
  cy: number,
  editor: Editor
): void {
  const node = editor.graph.getNode(drag.nodeId)
  if (!node || node.width <= 0 || node.height <= 0) return

  const worldMatrix = getWorldMatrix(node, editor.graph)
  const invMatrix = Matrix.invert(worldMatrix)
  if (!invMatrix) return

  const localPt = Matrix.mapPoint(invMatrix, { x: cx, y: cy })
  const u = localPt.x / node.width
  const v = localPt.y / node.height

  const effects = [...node.effects]
  const currentEffect = effects[drag.effectIndex]

  if (drag.handle === 'start') {
    effects[drag.effectIndex] = { ...currentEffect, startOffset: { x: u, y: v } }
  } else {
    effects[drag.effectIndex] = { ...currentEffect, endOffset: { x: u, y: v } }
  }

  editor.updateNode(drag.nodeId, { effects })
  editor.requestRender()
}

export function handleProgressiveBlurUp(drag: DragProgressiveBlur, editor: Editor): void {
  editor.commitNodeUpdate(drag.nodeId, { effects: drag.origEffects }, 'Change progressive blur')
}

export function cancelProgressiveBlurDrag(drag: DragProgressiveBlur, editor: Editor): void {
  editor.updateNode(drag.nodeId, { effects: drag.origEffects })
  editor.requestRender()
}
