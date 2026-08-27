import { resolveGradientEdit } from '@open-pencil/core/canvas/overlays'
import type { Editor } from '@open-pencil/core/editor'
import { getAbsoluteRotation } from '@open-pencil/scene-graph/coordinate'

import {
  buildResizeCursor,
  cornerRotationCursor,
  getHitHandleByMatrix,
  hitTestCornerRotationByMatrix
} from '#vue/shared/input/geometry'
import { hitTestGradientHandle } from '#vue/shared/input/gradient'
import { hitTestProgressiveBlurHandle } from '#vue/shared/input/progressive-blur'
import type { HitTestFns } from '#vue/shared/input/select'
import { getNodeEditState } from '#vue/shared/input/vector'

function getProgressiveBlurCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size === 0 && !editor.state.progressiveBlurEdit) return null
  const hit = hitTestProgressiveBlurHandle(cx, cy, editor)
  if (hit) return 'grab'
  return null
}

function getGradientCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size === 0 && !editor.state.gradientEdit) return null

  const target = resolveGradientEdit(
    editor.graph,
    editor.state.selectedIds,
    editor.state.gradientEdit
  )
  if (!target) return null

  const zoom = editor.renderer?.zoom ?? 1
  const hit = hitTestGradientHandle(cx, cy, target.node, target.paint, editor.graph, zoom)
  if (!hit) return null

  if (hit === 'start' || hit === 'end' || 'stopIndex' in hit || 'line' in hit) {
    return 'grab'
  }
  return null
}

function getResizeCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  for (const id of editor.state.selectedIds) {
    const node = editor.graph.getNode(id)
    if (!node) continue

    const handleHit = getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom ?? 1)
    if (handleHit?.handle) return buildResizeCursor(handleHit.rotation)
  }
  return null
}

function getRotationCursorForSelection(cx: number, cy: number, editor: Editor): string | null {
  if (editor.state.selectedIds.size !== 1) return null

  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node) return null

  const corner = hitTestCornerRotationByMatrix(
    cx,
    cy,
    node,
    editor.graph,
    editor.renderer?.zoom ?? 1
  )
  if (!corner) return null

  const absoluteRotation = getAbsoluteRotation(node, editor.graph)
  return cornerRotationCursor(corner, absoluteRotation)
}

function updateHoveredNode(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>,
  deep: boolean
) {
  const hit = deep
    ? fns.hitTestInScope(cx, cy, true)
    : (fns.hitTestSectionTitle(cx, cy) ??
      fns.hitTestComponentLabel(cx, cy) ??
      fns.hitTestInScope(cx, cy, false))
  const editNodeId = getNodeEditState(editor)?.nodeId
  editor.setHoveredNode(
    hit && !editor.state.selectedIds.has(hit.id) && hit.id !== editNodeId ? hit.id : null
  )
}

export function updateHoverCursor(
  cx: number,
  cy: number,
  editor: Editor,
  fns: Pick<HitTestFns, 'hitTestInScope' | 'hitTestSectionTitle' | 'hitTestComponentLabel'>,
  deep = false
): string | null {
  if (getNodeEditState(editor)) {
    editor.setHoveredNode(null)
    return null
  }

  const cursor =
    getProgressiveBlurCursorForSelection(cx, cy, editor) ??
    getGradientCursorForSelection(cx, cy, editor) ??
    getResizeCursorForSelection(cx, cy, editor) ??
    getRotationCursorForSelection(cx, cy, editor)
  updateHoveredNode(cx, cy, editor, fns, deep)
  return cursor
}
