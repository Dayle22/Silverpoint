# T-024b - Pen tool path linking and close-path icon affordance

Task ID: T-024b
Packet state: Superseded — scope map only; execute T-024b then T-024c
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-024 (Done) - this packet builds directly on the sizing, hover-intent and cursor
infrastructure T-024 shipped and verified live in source; nothing here is re-derived.
Related: T-011/T-012/T-013 (vector consumers of the same network, untouched), T-038 selection-outline-fidelity
(shares overlay paints, untouched)
Prepared from: user chat request 2026-08-20 - "add updates to the pen tool so that the pen tool links to
open paths and small icons appear to close the path when the pen tool is near the start of the path"
Expanded at: 2026-08-20 Africa/Johannesburg
Expanded against: live read of `App/packages/vue/src/canvas/pen-input/use.ts`,
`App/packages/core/src/editor/shapes/pen.ts`, `App/src/app/editor/pen/{create,resume,index}.ts`,
`App/packages/core/src/canvas/pen-overlay.ts`, `App/packages/vue/src/shared/input/node-edit/{index,hit-test}.ts`,
`App/packages/core/src/constants.ts`, `App/packages/core/src/editor/types.ts`,
`App/src/app/editor/session/modules.ts`, `App/packages/vue/src/canvas/tool-input/use.ts`,
`App/packages/vue/src/canvas/useCanvasInput.ts`, `App/tests/e2e/tools/pen.spec.ts`,
`App/tests/engine/vector/{pen-actions,node-edit}.test.ts`, `App/package.json`. App version `0.6.31`.
Delivery: named source gates + browser check

## Intended Outcome

Two concrete gaps, both confirmed live in source (see Verified Starting State):

1. **The pen tool cannot link two open paths together.** Today, clicking near an open endpoint of a
   *different* vector while actively drawing a new path silently starts an unrelated path at that point -
   it looks connected but is two separate nodes sharing a coincidental coordinate. And even the idle-pen
   "continue" affordance - the cursor and the boosted-endpoint highlight that already promise you can
   resume an open path - does nothing on click; the promised action was never wired to a handler. After
   this packet: clicking an open endpoint of another visible, unlocked vector while the pen is idle resumes
   drawing that path (fixing the dead affordance); clicking one while a path is actively being drawn joins
   the in-progress chain onto it, merging both into a single vector network and finishing the path there.
2. **The close-path affordance is cursor-only.** T-024 boosted the first anchor's radius and baked a small
   ring glyph into a custom CSS cursor (`CLOSE_CURSOR`), but drew nothing extra on the canvas itself. A
   custom `cursor: url(data:image/svg+xml,...)` is exactly the kind of thing T-024's own Stop Conditions
   flagged as at risk of silent WebView2 rejection. This packet adds a small on-canvas icon - independent
   of the CSS cursor, drawn through the existing CanvasKit overlay - next to the first anchor whenever
   closing is armed, so the affordance is visible even if the cursor glyph is not.

This is a feel-and-precision packet, exactly like T-024. It does not change the vector network format, the
`.fig` encoding, or what a finished path renders as - only how a path is drawn and what it looks like while
it is being drawn.

## Request Coverage

Verbatim from the user: "add updates to the pen tool so that the pen tool links to open paths and small
icons appear to close the path when the pen tool is near the start of the path." Both clauses are in
scope; see Implementation Steps 2-3 (linking) and Step 4 (close icon).

## Verified Starting State

Read from the working tree on 2026-08-20. App version is `0.6.31` (`App/package.json`). Line numbers are
from that read - re-check them before editing; the named functions and constants are the stable anchors.

### A. What already exists and works - do not rebuild it

| Capability | Where |
| --- | --- |
| Pen state machine (`penAddVertex`, `penCommit`, `penCancel`, ...) | `packages/core/src/editor/shapes/pen.ts:62-236` |
| `PEN_CLOSE_THRESHOLD` (10, screen px, divided by zoom), `PEN_VERTEX_RADIUS` (4), `PEN_HANDLE_RADIUS` (3.5), `PEN_CLOSE_RADIUS_BOOST` (2.5) | `packages/core/src/constants.ts:71-73,401-402` - confirmed at these exact values, matching T-024's Fixed Decisions |
| Four pen cursors (`crosshair`/close/continue/insert) chosen by `penCursor`, hover-intent state (`penHoverIntent`, `penHoverEndpoint`, `penHoverInsertPoint`) | `packages/vue/src/canvas/pen-input/use.ts:20-124`; state fields at `packages/core/src/editor/types.ts:127-129` |
| `hitTestContinueEndpoint(editor, cx, cy)` - hit-tests either the node-edit path's own open endpoint, or (today, only `if (editor.state.activeTool === 'PEN' && !editor.state.penState)`) an open endpoint on any other visible, unlocked `VECTOR` sibling within `NODE_HIT_THRESHOLD / zoom` | `packages/vue/src/canvas/pen-input/use.ts:53-90` |
| `drawPenHoverEndpoint` - draws a boosted circle (`PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST`) at `editor.state.penHoverEndpoint`, driven generically off that state field regardless of why it was set | `packages/core/src/canvas/pen-overlay.ts:18-36` |
| `drawPenOverlay` - draws committed segments, tangent handles, and each vertex; vertex 0 gets the boosted radius when `penState.closingToFirst` | `packages/core/src/canvas/pen-overlay.ts:192-220` |
| `penResumeOnPath(nodeId)` / `penResumeFromEndpoint(nodeId, endpointVertexIndex)` - app-level actions that delete the target node from the graph and replace `state.penState` with its (ordered) vertices/segments, so the pen resumes drawing it | `src/app/editor/pen/create.ts:21-55` |
| `walkChainToEnd`, `walkChainOrdered`, `absoluteVertices`, `cloneSegments`, `createResumedPenState` - the geometry helpers `penResumeFromEndpoint` is built from | `src/app/editor/pen/resume.ts:7-106` |
| `createPenActions(editor, graph, state)` (app-level) is spread onto the editor store, so any new export becomes available on `editor`/the store with no further wiring | `src/app/editor/session/modules.ts:60,69` |
| `handlePenNodeEditDown` already calls `penResumeFromEndpoint` when the pen, in node-edit mode, clicks that same node's own open endpoint | `packages/vue/src/shared/input/node-edit/index.ts:131-148` |
| E2E harness (`useEditorSetupWithClear`, `editor.canvas.{click,hover,pressKey,dblclick,marquee,shiftDrag}`, `getPageChildren`, `assertNoErrors`) and the `readPenHover`/`readUndoDepth`/`vertexScreenPoint` helpers already defined in the pen spec | `tests/e2e/tools/pen.spec.ts:1-90` |
| Unit-test pattern for app-level pen/vector-edit actions: `createEditor()` from core, `editor.graph.createNode('VECTOR', pageId, {...})`, then `createPenActions(editor, editor.graph, editor.state)` / `createVectorEditActions(...)` | `tests/engine/vector/node-edit.test.ts:135-153`, `tests/engine/vector/pen-actions.test.ts:1-20` |

### B. Confirmed gaps - this is the work

1. **The idle-pen "continue" affordance is dead on click.** `hitTestContinueEndpoint` finds a foreign open
   endpoint and `penCursor`/`updatePenHover` correctly show `CONTINUE_CURSOR` and highlight it
   (`use.ts:92-124`, `:171-231`). But `startPenInput` (`use.ts:126-169`), the actual mouse-down handler
   wired from `handleToolMouseDown` (`packages/vue/src/canvas/tool-input/use.ts:64-67`), never calls
   `hitTestContinueEndpoint` or `penResumeFromEndpoint` - clicking there falls straight through to
   `editor.penAddVertex(cx, cy)` at `use.ts:165`, starting an unrelated new path at that point.
   `grep -rn "penResumeFromEndpoint\|penResumeOnPath" packages/vue/src packages/core/src src/` shows the
   only call site is `node-edit/index.ts:145`, inside node-edit mode - never from idle-pen `startPenInput`.
2. **There is no way to link an in-progress path to a different open path.** `hitTestContinueEndpoint`'s
   foreign-endpoint branch is gated `!editor.state.penState` (`use.ts:69`), so while a path is actively
   being drawn (`penState` truthy, at least one vertex placed) it never scans other nodes at all. `penCursor`
   mirrors this: its `if (penState)` branch (`use.ts:107-117`) only ever checks the self-close distance and
   falls back to `'crosshair'` - it never calls `hitTestContinueEndpoint`. There is no core or app-level
   action that merges an in-progress `penState` chain with another node's vector network.
3. **The close affordance has no on-canvas icon, only a boosted radius and a CSS cursor glyph.**
   `drawPenOverlay`'s vertex loop (`pen-overlay.ts:211-219`) draws exactly one circle per vertex, boosted at
   index 0 when `closingToFirst`; nothing else is drawn. The only distinct "closing" glyph anywhere is
   baked into `CLOSE_CURSOR_SVG` (`use.ts:20-24`), a `url(data:image/svg+xml,...)` cursor - unverified
   against the installed WebView2 runtime (T-024's own Stop Conditions named this exact risk and did not
   report resolving it; the T-024 Status record confirms cursor *state* was tested, not cursor *rendering*).

## Read First

In order:

1. `packages/vue/src/canvas/pen-input/use.ts` - every change to hit-testing, cursor selection and the
   click handler lands here.
2. `src/app/editor/pen/create.ts` and `src/app/editor/pen/resume.ts` - the new link action and its geometry
   helpers.
3. `packages/core/src/canvas/pen-overlay.ts` and `packages/core/src/constants.ts` - the new close icon.
4. `packages/vue/src/shared/input/node-edit/index.ts:131-148` - do not change this file; it is the reference
   pattern for how `penResumeFromEndpoint` is already invoked and cast.
5. `tests/e2e/tools/pen.spec.ts` and `tests/engine/vector/pen-actions.test.ts` - existing helpers and the
   exact style to extend.

## Fixed Decisions

Binding. These are the answers; do not re-derive them.

1. **Reuse the existing `'continue'` cursor and hover-endpoint highlight for both resume and link.**
   Conceptually both are "this click continues drawing through that endpoint" - resume when the pen is
   idle, link when a path is already in progress. Do not add a fifth cursor or a new `penHoverIntent` value.
   `hitTestContinueEndpoint`'s foreign-node branch condition (`use.ts:69`) changes from
   `editor.state.activeTool === 'PEN' && !editor.state.penState` to `editor.state.activeTool === 'PEN'` -
   the single-line change that makes the hit test and its already-generic cursor/hover plumbing cover both
   cases with no further edits to `updatePenHover`.
2. **`penCursor`'s `if (penState)` branch gains a foreign-endpoint check after the self-close check, in that
   order.** Self-closing the current path always takes priority over linking to a foreign one when a click
   could plausibly mean either (this cannot happen in practice - a path's own first vertex and a different
   node's endpoint cannot occupy the same hit-test region unless the user drew them coincident - but the
   order must be deterministic). If neither hits, fall back to `'crosshair'` exactly as today.
3. **`startPenInput` hit-tests the foreign endpoint using the raw, pre-shift-snap click position.** The
   existing Shift-constraint block (`use.ts:144-149`) mutates `cx`/`cy` to the nearest 45-degree ray before
   the close-to-first check runs. A foreign endpoint is a precise existing target, not a direction to snap
   toward, so the new hit test captures `cx`/`cy` at function entry (before the Shift block) and uses that
   captured pair. The existing close-to-first check and the final `penAddVertex` fallback are untouched and
   keep using the (possibly Shift-snapped) values exactly as today - this is additive only, not a fix to
   existing close-to-first behaviour.
4. **One new app-level action, `penLinkToEndpoint(nodeId, endpointVertexIndex)`, added to
   `src/app/editor/pen/create.ts` beside `penResumeOnPath`/`penResumeFromEndpoint`.** It:
   - reads the in-progress `state.penState` (`ps`); no-ops if there is none or it has zero vertices;
   - reads the target node via `graph.getNode(nodeId)`; no-ops if it is not a `VECTOR` with a
     `vectorNetwork` (matches the existing guard in `penResumeFromEndpoint`, `create.ts:38-39`);
   - orders the target's chain from the clicked endpoint outward with the existing
     `absoluteVertices`/`cloneSegments`/`walkChainOrdered` helpers - the same helpers
     `penResumeFromEndpoint` already uses, unchanged;
   - appends the ordered target vertices after `ps.vertices`, and inserts one new joining segment from
     `ps.vertices.length - 1` to the first appended index, before appending the target's own (index-shifted)
     segments. The joining segment's `tangentStart` is `ps.dragTangent` if set, else `{x:0,y:0}` -
     identical to how `penAddVertex` derives a new segment's `tangentStart` today
     (`packages/core/src/editor/shapes/pen.ts:85`); `tangentEnd` is always `{x:0,y:0}`;
   - clears `ps.dragTangent`, `ps.oppositeDragTangent`, `ps.pendingClose`, `ps.closingToFirst`;
   - deletes the target node (`graph.deleteNode(nodeId)`) and calls `editor.penCommit(false)` - always an
     **open** result. Linking mid-draw is a terminal action, exactly like closing to the first vertex is;
     it ends the path rather than continuing it further.
   No new undo mechanism: `graph.deleteNode` and `editor.penCommit`'s node creation are each their own undo
   entry, exactly as they already are for `penResumeFromEndpoint` (which also deletes a node up front, then
   commits a new one later) - this packet does not change that established two-entry shape, only reuses it.
5. **The merged path keeps the in-progress path's fills/strokes, discarding the target's.**
   `penCommit` (`pen.ts:199-202`) already derives fills/strokes only from `ps.resumedFills`/`ps.resumedStrokes`
   (falling back to the default stroke). `penLinkToEndpoint` does not touch those fields, so if the
   in-progress path was itself resumed from an existing node its style survives; a fresh path keeps the
   default stroke. The target node's fills/strokes are discarded along with its deleted node. Rejected
   alternative: adopting the target's style instead - deferred, no source signal indicates which the user
   would expect, and defaulting to "the path you are actively drawing keeps its own identity" is the
   smaller, more predictable surface.
6. **`startPenInput`'s new branch dispatches by whether `penState` is set at click time**, not by anything
   returned from the hit test itself: `penState` truthy -> `penLinkToEndpoint`; `penState` null ->
   `penResumeFromEndpoint` (the existing action, now finally invoked - this is gap B1's fix). Both are
   reached through one `hitTestContinueEndpoint` call and one `if (link)` block; no code duplication.
7. **The close icon is a second, undecorated ring drawn with the existing `penVertexStroke` paint only (no
   fill), offset from the first vertex, drawn only when `penState.closingToFirst` is true.** Add
   `PEN_CLOSE_ICON_OFFSET = 12` to `packages/core/src/constants.ts` beside `PEN_CLOSE_RADIUS_BOOST` (screen
   pixels, already-converted space - `pen-overlay.ts` draws entirely in screen space via `toScreen`, same as
   every other pen constant there). Reuse `PEN_HANDLE_RADIUS` (3.5) as the icon's radius - it already reads
   as "a small point" elsewhere in the same overlay. At offset 12 the badge's near edge sits ~2px clear of
   the boosted anchor's edge (`12 - (PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST) - PEN_HANDLE_RADIUS =
   12 - 6.5 - 3.5 = 2`), so the two never visually merge into one blob. No new `Paint` is created - reuse
   `r.penVertexStroke` (the same stroke already used for every vertex ring in this file), so there is
   nothing new to `.delete()` and no new CanvasKit allocation. Placement is a fixed screen-space diagonal
   (`+offset` on x, `-offset` on y - up and to the right of the anchor), not cursor-relative, so it needs no
   extra state and cannot lag the frame the way a cursor-tracking icon could.

## Open Decisions

None. Both stub questions ("pen tool links to open paths", "small icon near the start of the path") are
closed by Fixed Decisions 1-7 above, each anchored to a confirmed source gap.

## Allowed Changes

- `packages/core/src/constants.ts` - add `PEN_CLOSE_ICON_OFFSET`.
- `packages/core/src/canvas/pen-overlay.ts` - draw the close icon; import the new constant.
- `packages/vue/src/canvas/pen-input/use.ts` - widen `hitTestContinueEndpoint`'s foreign-node condition; add
  the foreign-endpoint branch to `penCursor`; add the link/resume dispatch to `startPenInput`.
- `src/app/editor/pen/create.ts` - add `penLinkToEndpoint`; add it to the function's return object; add the
  `VectorSegment` type import.
- `tests/engine/vector/pen-actions.test.ts` - add unit coverage for `penLinkToEndpoint`.
- `tests/e2e/tools/pen.spec.ts` - add e2e coverage for linking and for the dead-idle-continue fix.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines stops and reports instead.

- **Do NOT build, install, or bump versions.** The delivery policy set 2026-08-14 (`Plan/plan.md`) stops
  packets at source gates. `App/package.json`, `App/desktop/tauri.conf.json` and `App/desktop/Cargo.toml`
  are not touched.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or `bun run check:upstream`.** Use the
  focused gates in Acceptance.
- **Do NOT change `encodeVectorNetworkBlob` / `decodeVectorNetworkBlob` or anything under
  `packages/core/src/kiwi/`.** The `.fig` encoding is out of scope entirely.
- **Do NOT change the `VectorNetwork`, `VectorVertex`, `VectorSegment` or `VectorRegion` types** in
  `packages/scene-graph/src/types.ts`.
- **Do NOT touch the PENCIL, BRUSH, SHAPE_BUILDER, RECTANGLE, ELLIPSE, LINE, POLYGON, STAR, FRAME, SECTION,
  SLICE, TEXT or HAND tools**, or `handleNodeEditDown` / `handlePenNodeEditDown`
  (`packages/vue/src/shared/input/node-edit/index.ts`) - node-edit mode's own resume-from-endpoint route is
  already correct and out of scope.
- **Do NOT add a new `penHoverIntent` value, a new cursor SVG, or a new CanvasKit `Paint`.** Decision 1 and
  Decision 7 exist specifically to avoid needing either.
- **Do NOT add a drag-to-curve gesture on the link click.** Deferred to a later packet: linking is a plain
  click that always produces a straight joining segment (`tangentStart`/`tangentEnd` per Decision 4); do not
  attempt to let the user drag a tangent handle out of the target endpoint before committing - that would
  require deferring the target node's deletion past mouse-up and is a separate, larger change.
- **Do NOT change the existing close-to-first behaviour, its coordinates, or its priority.** Decision 3
  is additive only.
- **Do NOT add a runtime dependency.**
- **Do NOT introduce a second overlay canvas, a DOM-based handle layer, or a new renderer surface.** All
  affordances draw through the existing CanvasKit overlay path.
- **Do NOT rename or change the signature of any exported symbol in `packages/core` or `packages/vue`.** New
  exports are fine; changed ones are not - both packages publish `.d.ts` surfaces.
- **Do NOT run Git commands.** The project is not a repository.

## Implementation Steps

Land in order. Each step is independently verifiable.

1. **Close icon constant and draw call** (`packages/core/src/constants.ts`, `packages/core/src/canvas/pen-overlay.ts`)
   - Add `export const PEN_CLOSE_ICON_OFFSET = 12` to `constants.ts` immediately after
     `PEN_CLOSE_RADIUS_BOOST` (currently line 73).
   - In `pen-overlay.ts`, add `PEN_CLOSE_ICON_OFFSET` to the existing named import from `#core/constants`
     (line 8).
   - In `drawPenOverlay`'s vertex loop (`pen-overlay.ts:211-219`), after the existing
     `canvas.drawCircle(v.x, v.y, radius, vertexStroke)` call, add: when `i === 0 && penState.closingToFirst`,
     `canvas.drawCircle(v.x + PEN_CLOSE_ICON_OFFSET, v.y - PEN_CLOSE_ICON_OFFSET, PEN_HANDLE_RADIUS, vertexStroke)`.
   - Verify: `bunx tsgo --noEmit` passes; then the browser check in step 5 below covers the visual result.

2. **Widen the foreign-endpoint hit test and dispatch the fix for idle-pen continue**
   (`packages/vue/src/canvas/pen-input/use.ts`)
   - Change `hitTestContinueEndpoint`'s foreign-node condition (line 69) from
     `editor.state.activeTool === 'PEN' && !editor.state.penState` to `editor.state.activeTool === 'PEN'`.
   - Add a local type above `penCursor` (or beside the existing `SetDrag` type alias, line 18):
     ```ts
     type PenLinkEditor = Partial<{
       penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
       penLinkToEndpoint: (nodeId: string, endpointVertexIndex: number) => void
     }>
     ```
     This mirrors the existing `NodeEditEditor` intersection-cast pattern in
     `packages/vue/src/shared/input/node-edit/index.ts:21-37` - both `penResumeFromEndpoint` and the new
     `penLinkToEndpoint` are app-level actions, not part of the core `Editor` type, so callers cast.
   - In `startPenInput` (lines 126-169): immediately after `const nodeEditState = ...` / its early-return
     block, capture `const rawCx = cx` and `const rawCy = cy` before the Shift-snap block runs. After the
     existing close-to-first `if` block and before the final `editor.penSetPendingClose(false)` fallback,
     insert:
     ```ts
     const link = hitTestContinueEndpoint(editor, rawCx, rawCy)
     if (link) {
       const linkEditor = editor as Editor & PenLinkEditor
       if (penState) {
         linkEditor.penLinkToEndpoint?.(link.nodeId, link.vertexIndex)
       } else {
         linkEditor.penResumeFromEndpoint?.(link.nodeId, link.vertexIndex)
       }
       cursorOverride.value = 'crosshair'
       return true
     }
     ```
   - In `penCursor`'s `if (penState)` branch (lines 107-117), after the existing self-close `if` block and
     before `return 'crosshair'`, insert:
     ```ts
     if (hitTestContinueEndpoint(editor, cx, cy)) {
       return CONTINUE_CURSOR
     }
     ```
   - Verify: `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` passes.

3. **`penLinkToEndpoint` action** (`src/app/editor/pen/create.ts`)
   - Add `VectorSegment` to the existing type import from `@open-pencil/scene-graph` (currently only
     `SceneGraph` at line 2).
   - Add the function (placed after `penResumeFromEndpoint`, before the `return` statement):
     ```ts
     function penLinkToEndpoint(nodeId: string, endpointVertexIndex: number) {
       const ps = state.penState
       if (!ps || ps.vertices.length === 0) return

       const node = graph.getNode(nodeId)
       if (node?.type !== 'VECTOR' || !node.vectorNetwork) return

       const absVertices = absoluteVertices(node, node.vectorNetwork.vertices)
       const absSegments = cloneSegments(node.vectorNetwork.segments)
       const { orderedVertices, orderedSegments } = walkChainOrdered(
         absVertices,
         absSegments,
         endpointVertexIndex
       )

       const offset = ps.vertices.length
       const joinSegment: VectorSegment = {
         start: offset - 1,
         end: offset,
         tangentStart: ps.dragTangent ? { ...ps.dragTangent } : { x: 0, y: 0 },
         tangentEnd: { x: 0, y: 0 }
       }
       const shiftedSegments: VectorSegment[] = orderedSegments.map((s) => ({
         ...s,
         start: s.start + offset,
         end: s.end + offset
       }))

       ps.vertices = [...ps.vertices, ...orderedVertices]
       ps.segments = [...ps.segments, joinSegment, ...shiftedSegments]
       ps.dragTangent = null
       ps.oppositeDragTangent = null
       ps.pendingClose = false
       ps.closingToFirst = false

       graph.deleteNode(nodeId)
       editor.penCommit(false)
     }
     ```
   - Change the `return` statement to `return { setTool, penResumeOnPath, penResumeFromEndpoint, penLinkToEndpoint }`.
   - Verify: `bunx tsgo --noEmit` and `bunx vue-tsc --noEmit -p tsconfig.json` both pass (this file lives
     under the root project, not `packages/vue`).

4. **Unit tests** (`tests/engine/vector/pen-actions.test.ts`)
   - Add `import { createPenActions } from '@/app/editor/pen'` and, if not already present, the
     `VectorNetwork` type from `@open-pencil/scene-graph`.
   - Add a `describe('penLinkToEndpoint', ...)` block following the construction pattern in
     `tests/engine/vector/node-edit.test.ts:135-153` (`createEditor()`, then
     `editor.graph.createNode('VECTOR', pageId, {...})`, then
     `createPenActions(editor, editor.graph, editor.state)`):
     - Create a target `VECTOR` node at `x:800,y:500,width:100,height:0` with a two-vertex, one-segment
       open `vectorNetwork` (`{x:0,y:0}` to `{x:100,y:0}`, straight tangents).
     - `editor.penAddVertex(900, 650)` to start an in-progress path (one vertex, matching the target's
       endpoint at `(900, 500)` once resumed - use whatever coordinates place the in-progress path's
       eventual join point exactly on the target's second vertex, absolute `(900, 500)`).
     - Call the returned `penLinkToEndpoint(node.id, 1)`.
     - Assert: `editor.graph.getChildren(pageId)` contains exactly one `VECTOR` node (the target was
       deleted, one merged node was created); its `vectorNetwork.vertices.length` is `3`; its
       `vectorNetwork.segments.length` is `2`; `editor.state.penState` is `null` (commit cleared it).
   - Verify: `bun test tests/engine/vector/pen-actions.test.ts` passes, including this new block and every
     existing test in the file.

5. **E2E coverage** (`tests/e2e/tools/pen.spec.ts`)
   - Add a test that draws and commits a two-vertex open path (`800,500` -> `900,500`, `Enter`), then starts
     a second pen path elsewhere and clicks on the first path's open endpoint (`900,500`) while still
     mid-draw. Assert via `getPageChildren` that exactly one `VECTOR` node exists afterward, with
     `vertices.length === 3` and `segments.length === 2`; call `editor.canvas.assertNoErrors()`.
   - Add a test for the idle-pen fix: draw and commit an open path, press `Escape` or switch tools back to
     `P`, hover the open endpoint (expect `readPenHover().intent === 'continue'`), click it, and assert
     `editor.page.evaluate(() => window.openPencil?.getStore?.().state.penState !== null)` - i.e. the click
     actually started resuming that path instead of silently placing an unrelated first vertex at the same
     point (assert the resumed `penState.vertices.length` matches the original path's vertex count).
   - Verify: `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil` passes, including these
     two new tests and every existing test in the file.

## Acceptance Criteria

- [ ] Clicking an open endpoint of another visible, unlocked vector with the idle pen tool (no in-progress
      path) resumes drawing that path - `editor.state.penState` is populated from it, not a fresh single
      vertex placed at that point.
- [ ] Clicking an open endpoint of a different vector while a path is actively being drawn (`penState`
      truthy) merges both into one vector network: the target node is deleted, a new node is created whose
      `vectorNetwork.vertices.length` equals the in-progress vertex count plus the target's, and whose
      `vectorNetwork.segments.length` equals the in-progress segment count plus the target's plus one
      (the join), and the result is `open` (no `regions`).
- [ ] The merged path's fills/strokes match the in-progress path's pre-link style (its `resumedFills`/
      `resumedStrokes` if any, else the default stroke), never the deleted target's.
- [ ] `grep -n "!editor.state.penState" packages/vue/src/canvas/pen-input/use.ts` no longer matches the
      `hitTestContinueEndpoint` foreign-node condition.
- [ ] `penCursor` returns `CONTINUE_CURSOR` when a foreign open endpoint is hit, both when `penState` is
      null and when it is set (and not itself within the self-close threshold).
- [ ] At 100% zoom, hovering close enough to arm `closingToFirst` shows both the existing boosted anchor
      circle at the first vertex and the new small ring at `(vertex.x + 12, vertex.y - 12)` screen pixels,
      drawn with the same stroke colour as every other pen-overlay vertex ring.
- [ ] Existing T-024 behaviour is unchanged: self-closing a 3+ vertex path by clicking its first vertex,
      Shift-constrained anchor placement, and all six existing `tests/e2e/tools/pen.spec.ts` tests still
      pass unmodified.
- [ ] One link action is exactly one graph delete plus one graph create (two undo entries, matching
      `penResumeFromEndpoint`'s existing shape) - no new undo batching is introduced.
- [ ] `tests/engine/vector/pen-actions.test.ts` passes, including the new `penLinkToEndpoint` coverage.
- [ ] `tests/e2e/tools/pen.spec.ts` passes, including the two new tests, with no console errors.
- [ ] Focused gates green: `tsgo --noEmit`; `vue-tsc --noEmit -p tsconfig.json` and
      `vue-tsc --noEmit -p packages/vue/tsconfig.json`; `oxlint` over the touched paths.
- [ ] No version file, installer, build output or Git state changed.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`:

1. `bun test tests/engine/vector/pen-actions.test.ts` - expect exit `0`.
2. `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil` - expect exit `0`.
3. `bunx tsgo --noEmit` - expect exit `0`.
4. `bunx vue-tsc --noEmit -p tsconfig.json` - expect exit `0`.
5. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` - expect exit `0`.
6. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/canvas/pen-overlay.ts packages/core/src/constants.ts packages/vue/src/canvas/pen-input/use.ts src/app/editor/pen/create.ts` - expect exit `0`.

## Integration or Installed-Result Check

Browser check by default - no desktop build is authorised or required by this packet.

1. `cd App && bun run dev` (Vite, port 1420).
2. Select the Pen tool. Draw and commit an open two-point path (click, click, Enter). Select Pen again,
   start a new path elsewhere, and click the first path's open endpoint mid-draw - confirm the two paths
   become one selected object with a straight joining segment, and that the pen exits to the Select tool
   (matching normal `penCommit` behaviour).
3. With the pen idle (no in-progress path), hover the open endpoint of an existing path - confirm the
   continue cursor and the boosted-endpoint highlight appear - then click it and confirm drawing resumes
   from that path (add a vertex, press Enter, confirm the committed path includes the original geometry).
4. Draw a 3+ vertex open path and hover back near the first vertex - confirm the boosted anchor circle AND
   the new small ring both appear, offset up-and-right of the anchor, at 100%, 25% and 400% zoom (same
   screen size at every zoom, per the existing T-024 zoom-independence guarantee).
5. Record what was observed, not what was expected, including whether the small ring is visually legible
   against the canvas background at each zoom level tested.

## Stop Conditions

- Stop if `walkChainOrdered` cannot correctly order a target chain longer than 2 vertices during manual
  testing (e.g. a 5-vertex open polyline) - the merge logic depends on it producing a correctly-ordered,
  correctly-shifted segment list, and a defect there is upstream of this packet.
- Stop if enlarging the foreign-endpoint hit test's applicability to an in-progress `penState` produces
  false-positive hits against the path's own just-placed vertices - if that happens, the hit test needs an
  explicit self-exclusion this packet did not anticipate, and the fix must be scoped before continuing.
- Stop if any change here alters committed `VectorNetwork` output or `.fig` bytes for a path drawn and
  closed entirely by itself (no linking involved) - self-contained paths must be byte-identical to their
  pre-packet output.
- Stop and report if a step requires changing an exported signature in `packages/core` or `packages/vue`.

## Execution Report Contract

Report: result; changed files with opening and final SHA-256; commands run with exit codes and test counts;
evidence for the idle-continue fix and the mid-draw link (undo-depth counts, vertex/segment counts before
and after); evidence for the close icon at 25%/100%/400% zoom; confirmation that all pre-existing
`tests/e2e/tools/pen.spec.ts` tests still pass unmodified; deviations; and concerns. Do not advance task or
packet status from execution - that is the audit's job.

## Status record

Status: **Ready** - expanded 2026-08-20 against live source. Not yet executed.
