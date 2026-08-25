import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { Effect, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  isProgressiveBlur,
  progressiveBlurAxis,
  progressiveBlurPointAt,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { worldToNodeLocalPoint } from '#vue/shared/input/radius'
import type { DragProgressiveBlur } from '#vue/shared/input/types'

/** Angle step the ramp snaps to while shift is held, in degrees. */
const SNAP_STEP_DEGREES = 45

type RampEnd = 'start' | 'end'

/**
 * The progressive blur being edited on canvas, or `null` when the expanded
 * effect is not a progressive blur on an editable node.
 */
export function getProgressiveBlurEdit(
  editor: Editor
): { node: SceneNode; effect: Effect; effectIndex: number } | null {
  const edit = editor.state.progressiveBlurEdit
  if (!edit) return null
  const node = editor.graph.getNode(edit.nodeId)
  if (!node || node.locked || !node.visible) return null
  const effect = node.effects.at(edit.effectIndex)
  if (!effect || !effect.visible || !isProgressiveBlur(effect)) return null
  return { node, effect, effectIndex: edit.effectIndex }
}

/** World position of one ramp handle. */
export function getProgressiveBlurHandlePosition(
  node: SceneNode,
  effect: Effect,
  graph: SceneGraph,
  end: RampEnd
): Vector {
  const axis = progressiveBlurAxis(resolveProgressiveBlur(effect), node.width, node.height)
  const local = progressiveBlurPointAt(axis, end === 'start' ? 0 : 1)
  return Matrix.mapPoint(getWorldMatrix(node, graph), local)
}

export function hitTestProgressiveBlurHandle(
  cx: number,
  cy: number,
  node: SceneNode,
  effect: Effect,
  graph: SceneGraph,
  zoom = 1
): RampEnd | null {
  const hitRadius = HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)
  for (const end of ['start', 'end'] as const) {
    const point = getProgressiveBlurHandlePosition(node, effect, graph, end)
    const dx = cx - point.x
    const dy = cy - point.y
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return end
  }
  return null
}

export function tryStartProgressiveBlur(
  cx: number,
  cy: number,
  editor: Editor
): DragProgressiveBlur | null {
  const edit = getProgressiveBlurEdit(editor)
  if (!edit) return null

  const end = hitTestProgressiveBlurHandle(
    cx,
    cy,
    edit.node,
    edit.effect,
    editor.graph,
    editor.renderer?.zoom
  )
  if (!end) return null

  const ramp = resolveProgressiveBlur(edit.effect)
  return {
    type: 'progressive-blur',
    nodeId: edit.node.id,
    effectIndex: edit.effectIndex,
    end,
    original: { startOffset: { ...ramp.startOffset }, endOffset: { ...ramp.endOffset } }
  }
}

/** Snaps `point` onto the nearest 45° ray from `anchor`, preserving distance. */
function snapToAngle(point: Vector, anchor: Vector): Vector {
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return point
  const step = (SNAP_STEP_DEGREES * Math.PI) / 180
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance }
}

function withOffsets(effects: Effect[], index: number, changes: Partial<Effect>): Effect[] {
  const next = [...effects]
  next[index] = { ...next[index], ...changes }
  return next
}

export function applyProgressiveBlurDrag(
  d: DragProgressiveBlur,
  cx: number,
  cy: number,
  editor: Editor,
  snapAngle = false
): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node || node.width <= 0 || node.height <= 0) return
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (!local) return

  const anchorOffset = d.end === 'start' ? d.original.endOffset : d.original.startOffset
  const anchor = { x: anchorOffset.x * node.width, y: anchorOffset.y * node.height }
  const point = snapAngle ? snapToAngle(local, anchor) : local
  // Offsets are normalised object space, and are deliberately left unclamped so
  // the ramp can start or end outside the node the way the canvas renders it.
  const offset: Vector = { x: point.x / node.width, y: point.y / node.height }

  editor.updateNode(d.nodeId, {
    effects: withOffsets(
      node.effects,
      d.effectIndex,
      d.end === 'start' ? { startOffset: offset } : { endOffset: offset }
    )
  })
  editor.requestRender()
}

export function commitProgressiveBlurDrag(d: DragProgressiveBlur, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const previousEffects = withOffsets(node.effects, d.effectIndex, {
    startOffset: d.original.startOffset,
    endOffset: d.original.endOffset
  })
  editor.commitNodeUpdate(d.nodeId, { effects: previousEffects }, 'Adjust progressive blur')
  editor.requestRender()
}

export function cancelProgressiveBlurDrag(d: DragProgressiveBlur, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  editor.updateNode(d.nodeId, {
    effects: withOffsets(node.effects, d.effectIndex, {
      startOffset: d.original.startOffset,
      endOffset: d.original.endOffset
    })
  })
  editor.requestRender()
}
