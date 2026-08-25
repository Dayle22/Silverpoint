# T-047b - Double-click a text box corner handle

Task ID: T-047b
Packet state: Done
Depends on: T-047 (Done - drag-to-create text box)
Related: T-014 (text layout - `textAutoResize` semantics this must not fight with)

## Intended Outcome
Double-clicking a resize handle (corner or edge) on a selected TEXT node fits the box to its text content - one-shot resize to the measured content size, matching InDesign's fit-to-content handle behaviour. This does not switch or persist `textAutoResize` mode; it is a single explicit resize, undoable like any other resize.

## Decision (resolved with the user 2026-08-24)
Confirmed: fit-to-content, not truncate. A box with `textAutoResize: 'NONE'` (fixed size) keeps that mode after the fit; only `width`/`height` change.

## Current state (read from live source)
- Double-click dispatch lives in `packages/vue/src/canvas/useCanvasInput.ts`, `onDblClick()` (around line 441) - currently tries auto-layout padding/spacing edit, then falls through to `onTextDblClick` (word-select inside an already-editing text node). It has no handle-hit branch today.
- Resize-handle hit-testing already exists and is reusable without starting a drag: `tryStartResize(cx, cy, editor)` in `packages/vue/src/shared/input/resize/start.ts` calls `getHitHandleByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)` for each selected node and returns a `DragResize` (with `nodeId`, `handle`) if a handle was hit, or `null`.
- Content-fit measurement already exists: `packages/core/src/editor/text/auto-resize.ts` uses `getTextMeasurer()(node, maxWidth) ?? estimateTextSize(node, maxWidth)` from `packages/core/src/layout/text-measurement.ts` to compute a `{ width, height }` for a text node's content. `textAutoResizeChanges()` only runs this as a side effect of a `textAutoResize` mode change - there is no standalone "measure and apply once" entry point yet.
- Committing a resize with undo is `editor.updateNodeWithUndo(id, changes, label)` in `packages/core/src/editor/nodes.ts` (already threads `textAutoResizeChanges` for any `textAutoResize`-relevant keys, but a plain `{ width, height }` change bypasses that path since `textAutoResize` itself isn't changing - that's fine, we supply the final numbers directly).

## Contract
1. In `useCanvasInput.ts`, at the top of `onDblClick(e)` (before the existing auto-layout-edit and text-dblclick checks), call `tryStartResize(cx, cy, editor)` (compute `cx`/`cy` the same way the rest of the function already does via `getCoords`). If it returns a `DragResize` whose `editor.graph.getNode(result.nodeId)` is `type === 'TEXT'`, handle the fit here and `return` (skip the rest of `onDblClick` and the normal mousedown-driven resize drag this dblclick's mousedowns may have started - see Edge cases).
2. Add a small helper, e.g. `fitTextBoxToContent(nodeId: string, editor: Editor)` in `packages/core/src/editor/text/auto-resize.ts` (or a sibling file if that one is meant to stay pure/measurement-only - match existing file conventions): read the node, call the same `getTextMeasurer() ?? estimateTextSize` measurement used by `textAutoResizeChanges` with no `maxWidth` constraint (full fit, both axes), and call `editor.updateNodeWithUndo(nodeId, { width: measured.width, height: measured.height }, 'Fit text box to content')`. Skip (no-op) if `measured.width <= 0 || measured.height <= 0` or the node has no text content worth fitting to - confirm on live source whether empty text should no-op or fit to the empty-line size (match whatever `textAutoResizeChanges` already does for empty text, for consistency).
3. Do not touch `node.textAutoResize` - leave whatever mode the box already had.

## Edge cases to check against live source during implementation
- Since a dblclick is preceded by two real mousedown/mouseup pairs, confirm whether the first mousedown of the sequence already starts a normal resize drag via the existing `onMouseDown` path before `onDblClick` fires, and whether that leaves the node in a slightly-dragged state before the fit overwrites it. If so, either (a) it's harmless because the fit overwrites width/height anyway (only `x`/`y` from a corner drag could visually shift the box first), or (b) suppress/ignore that transient drag when it resolves to near-zero movement (there should already be a drag-start-distance threshold elsewhere in this file/`resize` module to reuse).
- Multi-selection: `tryStartResize` iterates `editor.state.selectedIds` and returns the first hit; keep that same one-node-at-a-time behaviour for the fit (matches how resize itself only really supports fitting one text box at a time).
- Locked node: `tryStartResize` already skips locked nodes, so this is handled for free.

## Verification
- `bun run dev`, draw a text box, type multi-line text, resize it larger or smaller than the content, then double-click a corner handle: box should snap to the content's measured size, no truncation, undo (Ctrl+Z) restores the prior size.
- Double-click a handle on an empty text box: confirm it either no-ops or fits to the empty-line size, consistent with `textAutoResizeChanges`'s own empty-text handling - not to be guessed, read live behaviour there.
- Double-click a handle on a non-TEXT node: must fall through to the existing padding/spacing/word-select handling with no change in behaviour.
- Double-click empty canvas or a node's body (not a handle): must fall through unchanged (this is the existing `hitTestInScope`/text-dblclick path).

## Status record
2026-08-21 - First brief, captured from user request as stated, including the user's own uncertainty.
2026-08-24 - Open Decision resolved with user: fit-to-content (not truncate). Packet expanded against live source; state set to Ready.
2026-08-24 - Executed and verified: added fitTextBoxToContent, double-click handle detection in useCanvasInput, zero-drag guard in resize.ts, and engine/vue unit tests. State set to Done.
