import type { Editor } from '@open-pencil/core/editor'

import { resolveAutoLayoutHover } from '#vue/shared/input/auto-layout-hover'
import type { DragSpacingDrag } from '#vue/shared/input/types'

/**
 * Direct-drag lifecycle for an auto-layout frame's `itemSpacing`, mirroring
 * the start/apply-preview/commit/cancel shape used by `radius.ts` for corner
 * radius handles.
 *
 * Zoom-math convention: `cx`/`cy` here (and everywhere else in this file)
 * come from `getCoords(e)` in `useCanvasInput.ts`, which derives them via
 * `editor.screenToCanvas(sx, sy)` (see `getPointerCoords` in
 * `#vue/shared/input/geometry.ts`). That conversion already divides out
 * `editor.state.zoom`, so `cx`/`cy` are scene-space units — the same
 * convention `resolveAutoLayoutHover`/`resolveSpacingHover` rely on when they
 * diff `cx`/`cy` against `node.width`/`node.height` without any further zoom
 * division. A pointer-drag delta is therefore just `cursor - startCursor` in
 * scene units, with no extra zoom normalization needed (unlike
 * `radius.ts`'s corner-drag math, which projects a *node-local* pointer via
 * `worldToNodeLocalPoint` because it must also account for node rotation).
 */
export function tryStartSpacingDrag(cx: number, cy: number, editor: Editor): DragSpacingDrag | null {
  const hover = resolveAutoLayoutHover(cx, cy, editor)
  // 'spacing-value' is the numeric-tick sub-region at the exact center of the
  // gap (same coordinates the double-click scrub editor targets); it is still
  // the gap marker for drag purposes, matching how the cursor override (line
  // ~82) and the double-click gate (line ~325) in useCanvasInput.ts already
  // treat both kinds as "on the spacing marker".
  if (hover?.kind !== 'spacing' && hover?.kind !== 'spacing-value') return null
  const node = editor.graph.getNode(hover.nodeId)
  if (!node || (node.layoutMode !== 'HORIZONTAL' && node.layoutMode !== 'VERTICAL')) return null
  if (node.locked) return null

  return {
    type: 'spacing-drag',
    nodeId: node.id,
    axis: node.layoutMode,
    startCursor: node.layoutMode === 'HORIZONTAL' ? cx : cy,
    original: node.itemSpacing
  }
}

export function applySpacingDrag(d: DragSpacingDrag, cx: number, cy: number, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const cursor = d.axis === 'HORIZONTAL' ? cx : cy
  const delta = cursor - d.startCursor
  const next = Math.max(0, Math.round(d.original + delta))
  editor.graph.updateNodePreview(d.nodeId, { itemSpacing: next })
  editor.requestRepaint()
}

export function commitSpacingDrag(d: DragSpacingDrag, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalValue = node.itemSpacing
  editor.updateNode(d.nodeId, { itemSpacing: d.original })
  if (finalValue === d.original) return
  editor.updateNodeWithUndo(d.nodeId, { itemSpacing: finalValue }, 'Update item spacing')
  editor.requestRepaint()
}

export function cancelSpacingDrag(d: DragSpacingDrag, editor: Editor): void {
  if (!editor.graph.getNode(d.nodeId)) return
  editor.updateNode(d.nodeId, { itemSpacing: d.original })
  editor.requestRepaint()
}
