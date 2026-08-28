import { getNodeEditState, handleNodeEditDown } from '#vue/shared/input/vector'
export { resolveHit } from '#vue/shared/input/select/hit'
import { resolveHit } from '#vue/shared/input/select/hit'
export { updateHoverCursor } from '#vue/shared/input/select/hover'
export { tryStartGradientHandle } from '#vue/shared/input/gradient'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneNode } from '@open-pencil/scene-graph'

import { tryStartGradientHandle } from '#vue/shared/input/gradient'
import { tryStartProgressiveBlurDrag } from '#vue/shared/input/progressive-blur'
import { tryStartResize } from '#vue/shared/input/resize'
import { createSelectionMoveDrag, selectionIsLocked } from '#vue/shared/input/select/move'
import type { DragState } from '#vue/shared/input/types'

export interface HitTestFns {
  hitTestInScope: (cx: number, cy: number, deep: boolean) => SceneNode | null
  isInsideContainerBounds: (cx: number, cy: number, containerId: string) => boolean
  hitTestSectionTitle: (cx: number, cy: number) => SceneNode | null
  hitTestComponentLabel: (cx: number, cy: number) => SceneNode | null
  hitTestFrameTitle: (cx: number, cy: number) => SceneNode | null
}

export function handleSelectDown(
  e: MouseEvent,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  fns: HitTestFns,
  tryStartRotation: (cx: number, cy: number) => boolean,
  handleTextEditClick: (cx: number, cy: number, shiftKey: boolean) => boolean,
  setDrag: (d: DragState) => void
) {
  // Node edit mode intercept
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }

  if (editor.state.editingTextId && handleTextEditClick(cx, cy, e.shiftKey)) return

  if (editor.state.editingTextId) editor.commitTextEdit()

  if (tryStartRotation(cx, cy)) return

  const gradientDrag = tryStartGradientHandle(cx, cy, editor, e.detail)
  if (gradientDrag) {
    setDrag(gradientDrag)
    return
  }

  const resizeDrag = tryStartResize(cx, cy, editor)
  if (resizeDrag) {
    setDrag(resizeDrag)
    return
  }

  const blurDrag = tryStartProgressiveBlurDrag(cx, cy, editor)
  if (blurDrag) {
    setDrag(blurDrag)
    return
  }

  const hit = resolveHit(cx, cy, editor, fns)
  if (!hit) {
    if (!editor.state.enteredContainerId) {
      editor.clearSelection()
      setDrag({ type: 'marquee', startX: cx, startY: cy })
    }
    return
  }

  if (!editor.state.selectedIds.has(hit.id) && !e.shiftKey) {
    editor.select([hit.id])
  } else if (e.shiftKey) {
    editor.select([hit.id], true)
  }

  if (selectionIsLocked(editor)) return

  setDrag(createSelectionMoveDrag(cx, cy, sx, sy, editor, e.altKey))
}
