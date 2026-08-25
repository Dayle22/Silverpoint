# T-047 - Click-drag to create a sized text box

Task ID: T-047
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-014 (Done - text nodes, `textAutoResize`, the text editing session)
Related: T-010 (snapping - deliberately not extended to draw gestures here), T-024 (pen input, the sibling tool-input branch), T-044 (shares `packages/vue/src/shared/input/` but no code)
Prepared from: the 2026-08-14 user request batch ("with the text tool active, allow click-and-drag to define the text box bounds")
Expanded at: 2026-08-20 06:34 Africa/Johannesburg
Expanded against: `App/packages/vue/src/shared/input/draw.ts` (full, 180 lines), `App/packages/vue/src/shared/input/types.ts` (full), `App/packages/vue/src/canvas/tool-input/use.ts` (full), `App/packages/vue/src/canvas/useCanvasInput.ts:460-711` (mousedown, move dispatch, mouseup dispatch, Escape handler), `App/packages/vue/src/shared/input/move.ts:15-70` (`MOVE_DRAG_START_THRESHOLD_PX`, `isPastDragStartThreshold`), `App/packages/core/src/editor/shapes.ts:39-89` (`createShape`), `App/packages/core/src/editor/undo.ts:94-112` (`commitResize`), `App/packages/scene-graph/src/undo.ts:18-105` (`push`/`record`/`beginBatch`/`commitBatch`/`rollbackBatch`), `App/packages/core/src/editor/text.ts` (full), `App/packages/core/src/editor/text/auto-resize.ts` (full), `App/packages/scene-graph/src/node-defaults.ts:165`, `App/packages/core/src/constants.ts:401-408`, `App/packages/vue/src/editor/tool-cursor/index.ts` (full), `App/tests/engine/vue/input/move-threshold.test.ts`, `App/tests/engine/text/rtl-auto-layout-input.test.ts`, `App/tests/e2e/text/editing.spec.ts`, `App/tests/helpers/canvas.ts:27-95`, `App/package.json` scripts, `App/tsconfig.json`, `App/packages/vue/tsconfig.json`.
Delivery: named source gates + browser check

## Intended Outcome

With the text tool active, pressing and dragging on the canvas creates a TEXT node whose position and size match the dragged rectangle, then drops straight into text editing. A plain click (no movement past the existing 3px screen-space drag threshold) keeps today's behaviour exactly: a `DEFAULT_TEXT_WIDTH` x `DEFAULT_TEXT_HEIGHT` box at the click point, in editing mode. Pressing `Escape` before releasing the mouse cancels the gesture and leaves no node behind. Each completed gesture is one undo step.

## Request Coverage

- With the text tool active, allow click-and-drag to define the text box bounds. Today a click always produces a uniform default-sized box.
- Dragging with the text tool creates a fixed-size text frame matching the dragged rectangle; a plain click still creates the same box it does now.

## Verified Starting State

| Path (App-relative) | Symbol / line span | What it is |
| --- | --- | --- |
| `packages/vue/src/shared/input/draw.ts` | `startTextTool` (119-127) | The whole current text-tool path. Creates `TEXT` at `DEFAULT_TEXT_WIDTH` x `DEFAULT_TEXT_HEIGHT`, sets `text: ''`, selects, `startTextEditing`, `setTool('SELECT')`, `requestRender`. Runs on mousedown; there is no drag state at all. |
| `packages/vue/src/shared/input/draw.ts` | `startShapeDraw` (128-142) | The shape-draw template: `undo.beginBatch('Create shape')`, `createShape(type, cx, cy, 0, 0)`, `select`, `setDrag({type:'draw', ...})`. |
| `packages/vue/src/shared/input/draw.ts` | `handleDrawMove` (143-165) | Live resize from the drag origin, with a `shiftKey` square constraint. Reads only `startX`, `startY`, `nodeId`. No snapping. |
| `packages/vue/src/shared/input/draw.ts` | `handleDrawUp` (167-180) | Sub-2 fallback to 100x100, FRAME/SECTION adoption, `commitResize(nodeId, {x:startX, y:startY, width:0, height:0})`, `commitBatch()`, `setTool('SELECT')`. |
| `packages/vue/src/shared/input/types.ts` | `DragDraw` (9-14), `DragState` (185-202), `TOOL_TO_NODE` (204-214) | The drag union. `TOOL_TO_NODE` already maps `TEXT: 'TEXT'`; nothing reaches it because `handleToolMouseDown` returns first. |
| `packages/vue/src/canvas/tool-input/use.ts` | `handleToolMouseDown` (27-80) | Tool dispatch. `if (tool === 'TEXT') { startTextTool(cx, cy, editor); return }` at 74-77. `sx`/`sy` (screen px) are already parameters (12-24). |
| `packages/vue/src/canvas/useCanvasInput.ts` | `onMouseMove` (514-597) | Drag-move dispatch; `if (d.type === 'draw') { handleDrawMove(...) }` at 591-594, immediately before `handleRemainingDragMove`. `const { sx, sy, cx, cy } = getCoords(e)` at 542. |
| `packages/vue/src/canvas/useCanvasInput.ts` | `onMouseUp` (599-645) | `else if (d.type === 'draw') handleDrawUp(d, editor)` at 641; the shared `drag.value = null; cursorOverride.value = null` tail follows. |
| `packages/vue/src/canvas/useCanvasInput.ts` | window `keydown` handler (672-698) | Escape cancels `shape-builder-drag`, `radius`, `progressive-blur`, `gradient-handle`, `page-guide`. **`draw` is not cancellable today.** |
| `packages/vue/src/shared/input/move.ts` | `MOVE_DRAG_START_THRESHOLD_PX = 3` (15), `isPastDragStartThreshold` (48-52) | The one existing click-vs-drag threshold, in screen px, squared-distance comparison. `move.ts` does not import `draw.ts`, so importing this constant into `draw.ts` creates no cycle. |
| `packages/core/src/editor/shapes.ts` | `createShape` (40-88) | Parents to `state.currentPageId` (48) and pushes a `Create ${type}` undo entry snapshotting the node **at creation size** (73-83) - which is why the draw path must also `commitResize` from the 0-size origin rect. |
| `packages/core/src/editor/undo.ts` | `commitResize` (94-112) | Pushes a `Resize` entry from a supplied original rect to the node's current rect. |
| `packages/scene-graph/src/undo.ts` | `push`/`record` (36-47), `beginBatch` (66), `commitBatch` (70-79), `rollbackBatch` (94-98) | `push` routes into the open batch. `commitBatch` with zero entries is a no-op. `rollbackBatch` pops the batch and runs every entry's `inverse()` in reverse - the exact primitive needed for Escape. |
| `packages/core/src/editor/text.ts` | `startTextEditing` (13-25) | Safe headless: with no text editor registered it sets `state.editingTextId` and re-renders. Pushes no undo entry itself. |
| `packages/scene-graph/src/node-defaults.ts` | `textAutoResize: 'NONE'` (165) | New TEXT nodes are **fixed-size** by default. |
| `packages/core/src/editor/text/auto-resize.ts` | `textAutoResizeChanges` (41-70) | Returns `{}` unless the mode is `HEIGHT` or `WIDTH_AND_HEIGHT`, so `NONE` text is never auto-resized by `editor.updateNode`. |
| `packages/core/src/constants.ts` | `DEFAULT_TEXT_WIDTH = 200`, `DEFAULT_TEXT_HEIGHT = 24` (406-407) | Already imported at the top of `draw.ts`. |
| `packages/vue/src/editor/tool-cursor/index.ts` | `TOOL_CURSORS.TEXT = 'text'` (13) | Text-tool cursor. Unchanged by this packet. |
| `packages/core/src/canvas/overlays/selection.ts` | `drawSelection` (starts 98; single-selection branch 110-127) | The selected node's outline is what makes the growing (empty, therefore invisible) text box visible during the drag. It early-returns when `overlays.editingTextId === id` (111), which is why the outline shows during the drag and hands over to the text caret only after mouse-up. No new overlay is needed. |
| `tests/engine/vue/input/move-threshold.test.ts` | whole file | The authoritative unit-test pattern for `#vue/shared/input/*` against a headless `createEditor()`. Copy its shape. |
| `tests/e2e/text/editing.spec.ts` | `'clicking with text tool creates a text node'` (30-40), `'undo removes text node'` (84-92) | Existing click-path coverage that must stay green. |
| `tests/helpers/canvas.ts` | `click` (71-74), `drag` (76-82), `waitForRender` (35-37), `assertNoErrors` (27-33) | Playwright canvas helpers. `drag` does move/down/move(steps:10)/up, so it clears the 3px threshold naturally. |

## Read First

1. `packages/vue/src/shared/input/draw.ts` - all of it.
2. `packages/vue/src/shared/input/types.ts:9-14` and `185-202`.
3. `packages/vue/src/canvas/tool-input/use.ts` - all of it.
4. `packages/vue/src/canvas/useCanvasInput.ts:514-698`.
5. `packages/vue/src/shared/input/move.ts:15-52` (threshold pattern only).
6. `tests/engine/vue/input/move-threshold.test.ts` (test template).

## Corrections to the Brief

1. **"a plain click still creates an auto-sizing text box as it does now" is wrong.** Today's click path produces a **fixed-size** box: `createShape('TEXT', ..., DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)` in `startTextTool` (`draw.ts:119-127`) with the scene-graph default `textAutoResize: 'NONE'` (`node-defaults.ts:165`). Nothing in the creation path sets `HEIGHT` or `WIDTH_AND_HEIGHT`. This packet therefore does not preserve auto-sizing on click - there is none to preserve, and the user has confirmed the click path stays fixed-size (Fixed Decision 12).
2. **The stub's "Likely Areas" point at the wrong tree.** `App/src/components/Toolbox/` does not exist, and `App/src/components/Toolbar/` only selects the active tool (`Toolbar.vue:41` maps `TEXT` to its label, `:61` to the `T` shortcut). All creation behaviour lives in `packages/vue/src/shared/input/draw.ts` and `packages/vue/src/canvas/`. Do not edit anything under `src/components/`.
3. `TOOL_TO_NODE` (`types.ts:204-214`) already contains `TEXT: 'TEXT'`, so `startShapeDraw` would half-work for text today; it is unreachable only because `handleToolMouseDown` returns at the `TEXT` branch first. Do not "fix" this by deleting the `TEXT` branch - text needs its own finish (empty string, editing session, click fallback) that `handleDrawUp` does not provide.

## Fixed Decisions

1. **Drag sets both width and height; `textAutoResize` stays `NONE`.** Matches Figma and matches the node default, so no auto-resize logic is engaged (`auto-resize.ts:47-49` returns `{}` for `NONE`). No `textAutoResize` write appears anywhere in this diff.
2. **The click/drag threshold is `MOVE_DRAG_START_THRESHOLD_PX` (3 screen px), imported from `#vue/shared/input/move`.** Reuse, do not redefine: it is already the app's click-vs-drag boundary (`move.ts:15`, `48-52`). Compare squared distances exactly as `isPastDragStartThreshold` does. Screen pixels, not canvas units, so the boundary is zoom-independent.
3. **The node is created on mousedown at 0x0 inside an undo batch**, exactly like `startShapeDraw`, and resized live. This reuses `handleDrawMove` verbatim and keeps one growth code path. The empty TEXT node draws nothing while growing; the selection outline (`overlays/selection.ts`, `drawSelection`) is the drag feedback. Do **not** add a preview overlay.
4. **Below-threshold release restores today's click result**: `x`/`y` back to the press point, `DEFAULT_TEXT_WIDTH` x `DEFAULT_TEXT_HEIGHT`. This keeps `tests/e2e/text/editing.spec.ts` green.
5. **A degenerate drag (final width or height < 2 canvas units) also falls back to the default box.** Mirrors `handleDrawUp:168-171`, which does the same with 100x100 for shapes. A 1-unit-tall text frame is never a useful result.
6. **The undo shape mirrors `handleDrawUp` exactly**: `commitResize(nodeId, { x: startX, y: startY, width: 0, height: 0 })` then `commitBatch()`, so one `Ctrl+Z` removes the node whether it was clicked or dragged. This is required, not cosmetic - `createShape`'s undo entry snapshots the node at 0x0 (`shapes.ts:73-83`), so without the resize entry a redo would restore a zero-size node.
7. **Add a new `DragTextDraw` union member (`type: 'text-draw'`) rather than reusing `'draw'`.** Mouse-up must branch on text vs shape, and no consumer switches exhaustively over `DragState` (verified: the only `'draw'` reads are `useCanvasInput.ts:591` and `:641`), so adding a member is safe.
8. **`handleDrawMove`'s first parameter type widens to `Pick<DragDraw, 'startX' | 'startY' | 'nodeId'>`** so both drag types can call it without a cast. It reads nothing else (`draw.ts:143-165`), and `DragDraw` stays assignable to it.
9. **`Escape` mid-drag cancels via `editor.undo.rollbackBatch()`**, which inverses the `Create TEXT` entry, deleting the node and clearing it from the selection (`shapes.ts:78-83`). The TEXT tool stays active so the user can immediately retry. Only `text-draw` is added to the Escape handler; `draw` stays uncancellable in this packet.
10. **Shift constrains to a square** because `handleDrawMove` is reused unchanged. No Alt/draw-from-centre and no snapping: neither exists for any other draw gesture today.
11. **Parenting is unchanged.** `createShape` parents to `state.currentPageId` (`shapes.ts:48`). Text drawn over a frame stays a page child, exactly as a clicked text box does today. `handleDrawUp`'s FRAME/SECTION adoption does not apply and must not be copied.
12. **A plain click keeps producing a fixed-size (`NONE`) box; it does not become Figma-style auto-width.** Confirmed by the user on 2026-08-20 after the discrepancy in Correction 1 was raised, so this is settled, not deferred by assumption. Evidence for the choice: switching the click to `WIDTH_AND_HEIGHT` would alter T-014's creation contract, change what `textResizeModeForHandle` (`packages/vue/src/shared/input/resize.ts`) means for newly created text - it is covered by `tests/engine/vue/input/text-resize-mode.test.ts` - and break existing e2e expectations, none of which this request touches. Accepted consequence: click and drag both produce `NONE` boxes differing only in size, so typing past the box edge clips (`packages/core/src/canvas/scene.ts:769`) rather than growing the box. Any Figma parity work on the click path is a separate packet and must not be smuggled into this one.

There are no open decisions. Every choice this packet needs is closed above; do not stop mid-implementation to ask.

## Visual Contract - binding

This packet renders no DOM. Nothing in it may add a component, template, Tailwind class, icon, i18n key, or CSS. The canvas-visible contract is:

| State | Required behaviour | Anchor |
| --- | --- | --- |
| Text tool armed, no gesture | Cursor is `text` | `tool-cursor/index.ts:13` - unchanged |
| Mousedown, before threshold | Node exists at 0x0 and is selected; no visible box, no overlay | `overlays/selection.ts` `drawSelection` |
| Drag past threshold | Selection outline grows with the pointer; `shift` locks a square | `handleDrawMove` (`draw.ts:143-165`) |
| Release after a real drag | Node has the dragged rect, is selected, is in text editing, tool is `SELECT` | `startTextTool` finish sequence (`draw.ts:122-126`) |
| Release below threshold, or degenerate rect | Node is `DEFAULT_TEXT_WIDTH` x `DEFAULT_TEXT_HEIGHT` at the press point, in text editing | Fixed Decisions 4-5 |
| `Escape` before release | No node remains, selection is empty, TEXT tool still active | Fixed Decision 9 |

### Banned List

- No new component, `.vue` file, template change, or DOM node.
- No literal colour (no hex, `rgb()`, `hsl()`, `bg-zinc-*`), no font-size class, no radius class - this diff contains no Tailwind at all.
- No new `tv()` recipe, no `app.css` or global CSS edit.
- No new npm dependency.
- No new store, composable, or editor state field; `DragState` is the only state carrier.
- No new canvas overlay, preview rectangle, or renderer change of any kind.
- No new i18n key or locale-file edit.
- No new command ID and no `useEditorCommands()` involvement.
- No change to `textAutoResize` anywhere in the diff.
- No change to `startTextTool`'s click semantics beyond routing - size, editing start and tool reset must be identical in effect.
- No `git` operation, no build, no install, no version bump.

## Allowed Changes

- `packages/vue/src/shared/input/types.ts` - add `DragTextDraw`, add it to the `DragState` union.
- `packages/vue/src/shared/input/draw.ts` - add `startTextDraw`, `handleTextDrawMove`, `handleTextDrawUp`, `cancelTextDraw`; widen `handleDrawMove`'s parameter type. `startTextTool` stays exported (it may become unused by `tool-input/use.ts`; keep the export - the click fallback lives in `handleTextDrawUp`, so if `oxlint` flags `startTextTool` as unused, delete it and say so in the execution report rather than adding a suppression).
- `packages/vue/src/canvas/tool-input/use.ts` - route the `TEXT` branch to `startTextDraw`.
- `packages/vue/src/canvas/useCanvasInput.ts` - three dispatch additions (move, up, Escape) plus imports.
- New `tests/engine/vue/input/text-draw.test.ts`.
- New `tests/e2e/text/drag-create.spec.ts`.

## Restrictions and Exclusions

An implementer who wants to cross one of these should stop and report.

- Do not touch `src/components/Toolbar/`, any other `src/components/` file, or any panel; the toolbar only sets the tool.
- Do not change `handleDrawUp`, `startShapeDraw`, or shape-drawing behaviour. `handleDrawMove` may change only its parameter *type* (Fixed Decision 8) - its body is frozen.
- Do not add Escape cancellation for `'draw'`, `'freehand'`, or `'pen-drag'`.
- Do not add snapping, Alt-from-centre, an aspect-ratio HUD, or a size readout to the gesture.
- Do not auto-delete an empty text node when editing ends; that is existing behaviour (`packages/core/src/editor/text.ts:27-87`) and out of scope.
- Do not change the TEXT cursor, the `T` shortcut, or `TOOL_TO_NODE`.
- Do not run `bun run check`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun run build`, `bun run build:packages`, `bun install`, or any Tauri build/install command.
- Do not modify `Plan/plan.md`.

### Deferred to a later packet

- Figma-style auto-width text on click (Fixed Decision 12 - ruled out for this packet by the user).
- Creating text inside the frame under the pointer instead of on the page.
- Snapping the drawn text rectangle to guides or neighbouring objects (T-010's seam, move-only today).

## Implementation Steps

1. **Pre-flight.** Reread `draw.ts` (all), `types.ts:9-14` and `185-202`, `tool-input/use.ts`, `useCanvasInput.ts:514-698`, and `move.ts:15-52`. Confirm the line spans above still match; if they drifted, work from the named symbols and record the drift in the execution report. Confirm `grep -n "'draw'" packages/vue/src src` still returns only `draw.ts:140`, `useCanvasInput.ts:591` and `useCanvasInput.ts:641`.

2. **Add the drag type** in `packages/vue/src/shared/input/types.ts`, immediately after `DragDraw` (9-14):

   ```ts
   export interface DragTextDraw {
     type: 'text-draw'
     startX: number
     startY: number
     startScreenX: number
     startScreenY: number
     nodeId: string
     dragStarted: boolean
   }
   ```

   Add `| DragTextDraw` to the `DragState` union (185-202). Change nothing else in the file.

3. **Add the gesture functions** in `packages/vue/src/shared/input/draw.ts`. Import `MOVE_DRAG_START_THRESHOLD_PX` from `#vue/shared/input/move` and the `DragTextDraw` type from `#vue/shared/input/types`. Leave `startTextTool` as it is.
   - `startTextDraw(cx, cy, sx, sy, editor, setDrag)`: `editor.undo.beginBatch('Create text')`; `const nodeId = editor.createShape('TEXT', cx, cy, 0, 0)`; `editor.graph.updateNode(nodeId, { text: '' })`; `editor.select([nodeId])`; then `setDrag({ type: 'text-draw', startX: cx, startY: cy, startScreenX: sx, startScreenY: sy, nodeId, dragStarted: false })`.
   - `handleTextDrawMove(d, cx, cy, sx, sy, shiftKey, editor)`: if `!d.dragStarted`, return early unless `(sx - d.startScreenX) ** 2 + (sy - d.startScreenY) ** 2 >= MOVE_DRAG_START_THRESHOLD_PX ** 2`; on crossing, set `d.dragStarted = true`. Then call `handleDrawMove(d, cx, cy, shiftKey, editor)`.
   - `handleTextDrawUp(d, editor)`: read `const node = editor.graph.getNode(d.nodeId)`; if `!d.dragStarted || !node || node.width < 2 || node.height < 2`, call `editor.updateNode(d.nodeId, { x: d.startX, y: d.startY, width: DEFAULT_TEXT_WIDTH, height: DEFAULT_TEXT_HEIGHT })`. Then, in this order: `editor.commitResize(d.nodeId, { x: d.startX, y: d.startY, width: 0, height: 0 })`; `editor.undo.commitBatch()`; `editor.select([d.nodeId])`; `editor.startTextEditing(d.nodeId)`; `editor.setTool('SELECT')`; `editor.requestRender()`.
   - `cancelTextDraw(d, editor)`: `editor.undo.rollbackBatch()`; `editor.requestRender()`. Do not call `setTool`.
   - Widen `handleDrawMove`'s first parameter to `Pick<DragDraw, 'startX' | 'startY' | 'nodeId'>` (Fixed Decision 8). Its body does not change.

4. **Route the tool** in `packages/vue/src/canvas/tool-input/use.ts`. Replace the body of the `if (tool === 'TEXT')` branch (74-77) with `startTextDraw(cx, cy, sx, sy, editor, setDrag)` and swap the `startTextTool` import for `startTextDraw`. `sx`/`sy` are already parameters (12-24); add nothing to the options type.

5. **Wire the dispatch** in `packages/vue/src/canvas/useCanvasInput.ts`:
   - Add `handleTextDrawMove`, `handleTextDrawUp` and `cancelTextDraw` to the existing `#vue/shared/input/draw` import block (22-26).
   - In `onMouseMove`, directly above the `if (d.type === 'draw')` block (591), add `if (d.type === 'text-draw') { handleTextDrawMove(d, cx, cy, sx, sy, e.shiftKey, editor); return }`. `sx`/`sy` come from the `getCoords(e)` destructure at 542.
   - In `onMouseUp`, extend the chain at 641 with `else if (d.type === 'text-draw') handleTextDrawUp(d, editor)`, leaving the shared `drag.value = null; cursorOverride.value = null` tail to run.
   - In the window `keydown` Escape handler (672-698), add `else if (drag.value.type === 'text-draw') cancelTextDraw(drag.value, editor)` to the existing `if`/`else if` chain **before** its `else return`, so the shared `drag.value = null`, `cursorOverride.value = null`, `e.preventDefault()` tail runs.

6. **Unit test** - new `tests/engine/vue/input/text-draw.test.ts`, modelled on `tests/engine/vue/input/move-threshold.test.ts` (`bun:test`, `createEditor()` from `@open-pencil/core/editor`, `#vue/shared/input/*` imports, a local `setup()` helper that captures the drag via a `setDrag` callback). Cover:
   - below-threshold release -> node is `DEFAULT_TEXT_WIDTH` x `DEFAULT_TEXT_HEIGHT` at the press point, and `editor.state.editingTextId` is the node id;
   - drag to `(x + 180, y + 90)` past the threshold -> node rect is exactly `{ x, y, width: 180, height: 90 }`;
   - drag up-and-left -> `x`/`y` move to the pointer and width/height stay positive;
   - `shiftKey: true` -> width equals height;
   - the created node has `textAutoResize === 'NONE'` and `text === ''`;
   - `editor.undo.undo()` after a completed drag removes the node in one step;
   - `cancelTextDraw` after a past-threshold move leaves no TEXT child on the page and an empty selection;
   - `editor.state.activeTool === 'SELECT'` after a completed gesture, and still `'TEXT'` after a cancel.

7. **E2E test** - new `tests/e2e/text/drag-create.spec.ts` using `useEditorSetup()` from `#tests/e2e/fixtures` and the `CanvasHelper`, following `tests/e2e/text/editing.spec.ts`'s `getPageChildren` / `getSelectedNode` style:
   - press `t`, `editor.canvas.drag(300, 200, 480, 290)`, `waitForRender()` -> the selected node is `TEXT` with `width` ~180 and `height` ~90 (allow +/-2 for device-pixel rounding) and `store.state.editingTextId` equals its id;
   - press `Escape`, press `t`, `editor.canvas.click(200, 400)`, `waitForRender()` -> the selected `TEXT` node has `width === 200` and `height === 24`;
   - `Control+z` after a dragged creation removes exactly one child;
   - `editor.canvas.assertNoErrors()` at the end of each test.

   No `data-test-id` is added anywhere - this gesture has no DOM surface.

8. **Focused verification** - run the commands in the Verification section, in order, from `App/`, and record exact exit codes.

## Acceptance Criteria

- [x] Dragging with the text tool produces a TEXT node whose `x`, `y`, `width`, `height` equal the dragged rectangle (proved by `tests/engine/vue/input/text-draw.test.ts` and the new e2e spec).
- [x] A plain click still produces a 200 x 24 TEXT node at the click point and enters editing; `tests/e2e/text/editing.spec.ts` passes unchanged.
- [x] Sub-3px pointer jitter during a click is treated as a click, not as a 2px text box.
- [x] A completed gesture is one undo step: `Ctrl+Z` removes the node, and redo restores it at its dragged size, not zero-size.
- [x] `Escape` before mouse-up leaves no TEXT node on the page, clears the selection, and leaves the TEXT tool active.
- [x] Shift-drag produces a square box.
- [x] The created node's `textAutoResize` is `'NONE'` and `text` is `''`; the string `textAutoResize` does not appear in the diff.
- [x] Shape, frame, section, pen, pencil and brush drawing behave exactly as before; `handleDrawUp` and `startShapeDraw` are unmodified and `handleDrawMove`'s body is unmodified.
- [x] Nothing in the Banned List appears in the diff; no `.vue`, `src/components/`, i18n, CSS, renderer or dependency file is touched.
- [x] Focused gates green (exit 0) as listed under Verification.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false`
2. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` - the root `tsconfig.json` includes only `src/**`, which this packet does not touch, and neither project includes `tests/`, so the new test files are proved by running them rather than by a type project.
3. `bunx oxlint -c oxlint.json packages/vue/src/shared/input/draw.ts packages/vue/src/shared/input/types.ts packages/vue/src/canvas/tool-input/use.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/vue/input/text-draw.test.ts tests/e2e/text/drag-create.spec.ts`
4. `bun test tests/engine/vue/input/text-draw.test.ts tests/engine/vue/input/move-threshold.test.ts tests/engine/vue/input/text-resize-mode.test.ts`
5. `bunx playwright test tests/e2e/text/drag-create.spec.ts tests/e2e/text/editing.spec.ts tests/e2e/text/double-click-edit.spec.ts --project=openpencil`

Do **not** run `bun run check`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun run build`, `bun run build:packages`, or any install/Tauri command.

## Integration or Installed-Result Check

`cd App && bun run dev` (Vite, port 1420), then in the browser:

1. Press `T`, drag a wide short rectangle on empty canvas. Confirm a growing selection outline follows the pointer, the released node matches the rectangle, the caret is in it, and the toolbar has returned to the select tool.
2. Type a line of text, click away, then confirm the properties panel shows the dragged width and height.
3. Press `T` and single-click. Confirm a 200 x 24 box, not a zero-size or 2px box.
4. Press `T`, start dragging, press `Escape` before releasing. Confirm the box vanishes, the layer list gained no entry, and the text tool is still active. Release the mouse afterwards and confirm nothing is created.
5. Press `T` and shift-drag. Confirm a square.
6. Zoom to ~25% and to ~400% and repeat steps 1 and 3. Confirm the click/drag boundary still behaves like a click at both zooms (the threshold is screen-space).
7. Draw a rectangle with `R` and a frame with `F`. Confirm both are unchanged.
8. `Ctrl+Z` once after a dragged text box: the node disappears entirely. `Ctrl+Shift+Z`: it returns at its dragged size.

Browser proof is not desktop proof. Do not build or install.

## Stop Conditions

Stop and report if:

- `editor.undo.rollbackBatch()` is not reachable from the `Editor` surface used in `draw.ts`, or does not remove the created node - the Escape contract (Fixed Decision 9) depends on it, and the rest of the packet does not.
- Widening `handleDrawMove`'s parameter type breaks any existing caller's types - report rather than casting at call sites.
- Creating the TEXT node at 0x0 throws or logs in the renderer while it is being dragged - if a zero-size empty text node is not safe to render, stop rather than adding an overlay or deferring node creation.
- `tests/e2e/text/editing.spec.ts` regresses in any way - the click path must be behaviourally identical.
- Any step appears to require touching `src/components/`, a renderer file, or a `packages/*` public type export beyond the `DragState` union.

## Execution Report Contract

Report, in this order:

1. Every file created or modified, with a one-line description of the change.
2. The exact command lines from Verification with their exit codes, and the test counts for steps 4 and 5.
3. The browser-check observations for all eight numbered items above, stated as pass/fail with what was seen.
4. Any line-span drift found during pre-flight, and any Fixed Decision that had to be reinterpreted.
5. Any acceptance criterion not met, and why.
6. Whether `startTextTool` was kept or removed, and why.

## Revision History

- Revision 1 - 2026-08-14: brief captured from the user request batch; not expanded.
- Revision 2 - 2026-08-20: expanded against the live input tree. Corrected the stub's premise (a click already creates a fixed-size box, not an auto-sizing one) and its "Likely Areas" (no `Toolbox/` directory; the toolbar only sets the tool). Fixed the threshold, undo shape, Escape cancellation and fallback rules against real source.
- Revision 3 - 2026-08-20: the user confirmed the recommended default for the one open question, so the click path staying fixed-size is now Fixed Decision 12 and the Open Decisions section is gone. No other content changed.

## Status record

Status: **Done**

> Prepared (expanded 2026-08-20 against `packages/vue/src/shared/input/draw.ts`, `packages/vue/src/canvas/tool-input/use.ts`, `packages/vue/src/canvas/useCanvasInput.ts` and the scene-graph undo/batch primitives. **The stub's premise is partly wrong: today's text click produces a fixed 200x24 box with `textAutoResize: 'NONE'`, not an auto-sizing one** - the user confirmed on 2026-08-20 that the click path stays fixed-size, so Figma-style auto-width on click is ruled out of this packet by Fixed Decision 12 and no open decisions remain. Scope is a new `text-draw` drag state reusing `handleDrawMove`, the existing 3px `MOVE_DRAG_START_THRESHOLD_PX` click boundary, `commitResize` + `commitBatch` for a single undo step, and `rollbackBatch` for Escape.)
