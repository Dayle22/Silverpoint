# T-024c - Pen close-path icon

Task ID: T-024c
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-024b (currently Ready in `Plan/plan.md`; execute T-024c only after T-024b is Done)
Related: T-024; superseded scope map `Plan/Archive/Superseded/T-024b-pen-tool-path-linking-and-close-icon.md`
Prepared from: the user's 2026-08-20 request that small icons appear to close a path when the Pen tool nears its start, split from the oversized T-024b contract
Expanded at: 2026-08-20 10:42 Africa/Johannesburg
Expanded against: `App/AGENTS.md`; `Plan/endgoal.md`; `Plan/plan.md`; `Plan/PACKET-EXPANSION-BRIEF.md`; T-024b and the superseded combined scope map; live `App/packages/core/src/constants.ts`, `App/packages/core/src/canvas/pen-overlay.ts`, `App/packages/core/src/canvas/renderer/types.ts`, `App/tests/engine/vector/pen-actions.test.ts`, `App/tests/e2e/tools/pen.spec.ts`, and the nearest canvas-render test harness
Delivery: named source gates + browser check
Execution size: 2 core implementation files; 1 new focused Bun render-test file in 1 suite; one visual-overlay responsibility; no split required

## Intended Outcome

When an in-progress Pen path with at least three vertices is close enough to its first vertex for closing to be armed, the canvas shows a small unfilled close ring immediately up-right of that first anchor. The ring is an additional visual cue independent of the custom CSS cursor; it stays the same screen-space size and offset at every zoom, disappears as soon as closing disarms, and changes no hit-testing, pen state, committed path data, or undo behaviour.

## Request Coverage

Verbatim origin carried from the superseded combined packet: "add updates to the pen tool so that the pen tool links to open paths and small icons appear to close the path when the pen tool is near the start of the path."

T-024b owns the open-path linking clause. This packet owns only the small on-canvas close icon.

## Verified Starting State

All paths below are relative to `App/`.

| Path | Symbol / current span | Binding use |
| --- | --- | --- |
| `packages/core/src/constants.ts` | `PEN_HANDLE_RADIUS`, `PEN_VERTEX_RADIUS`, `PEN_CLOSE_RADIUS_BOOST` at lines 71-73 | Add the one new screen-space offset beside the existing pen-overlay dimensions. Current values are `3.5`, `4`, and `2.5`. |
| `packages/core/src/constants.ts` | `PEN_CLOSE_THRESHOLD` at line 402 | Existing 10 px close hit threshold; reference only. Do not change it. |
| `packages/core/src/canvas/renderer/types.ts` | `RenderOverlays.penState` at lines 46-60 | Exact render input. `closingToFirst: boolean` already reaches the renderer; no new state or type is required. |
| `packages/core/src/canvas/pen-overlay.ts` | constants import at line 8 | Extend this named import with `PEN_CLOSE_ICON_OFFSET`; keep imports from `#core/constants`. |
| `packages/core/src/canvas/pen-overlay.ts` | `drawPenOverlay()` at lines 192-220, especially the vertex loop at 211-219 | Existing screen-space overlay seam. Vertex 0 is already enlarged when `penState.closingToFirst`; add the separate ring immediately after that vertex's existing fill/stroke calls. |
| `packages/core/src/canvas/pen-overlay.ts` | local `toScreen()` at lines 203-206 | Converts document coordinates before the vertex loop. Add the icon offset after this conversion so the icon remains 12 CSS pixels from the anchor at every zoom. |
| `packages/core/src/canvas/pen-overlay.ts` | `drawPenHandlePoint()` at lines 139-148 | Establishes `PEN_HANDLE_RADIUS` as the existing small-point radius and uses the existing paints. The close ring reuses the radius, not the helper, because it is stroke-only. |
| `packages/core/src/canvas/pen-overlay.ts` | `drawPenPaths()` at lines 117-137 | CanvasKit `Path` allocations are deleted here. The close icon uses `Canvas.drawCircle` directly, creating no `Path`, `Paint`, shader, filter, or other WASM wrapper. |
| `tests/engine/render/canvas/effects/helpers.ts` | `createMockRenderer()`, `createMockCanvas()`, `mockCalls()` | Existing renderer-test harness. `createMockCanvas()` already exposes mocked `drawCircle` and `drawPath`; renderer overrides can provide the five pen paints plus zoom/pan. |
| `tests/engine/render/canvas/frame-guides.test.ts` | renderer/canvas mock usage at lines 40-70 | Nearest focused precedent for calling a core canvas function with `createMockRenderer()` and `createMockCanvas()` and asserting exact mock calls. |
| `tests/e2e/tools/pen.spec.ts` | `drawOpenTriangle()`, `readPenHover()`, close-arm test at lines 19-40 and 122-148 | Existing real-input regression proves `closingToFirst` arms/disarms at different zoom levels. Run it unchanged; do not duplicate its input coverage. |

Exact existing renderer contract used by this packet:

```ts
penState?: {
  vertices: Vector[]
  segments: Array<{
    start: number
    end: number
    tangentStart: Vector
    tangentEnd: Vector
  }>
  dragTangent: Vector | null
  oppositeDragTangent?: Vector | null
  closingToFirst: boolean
  pendingClose?: boolean
  cursorX?: number
  cursorY?: number
} | null
```

Exact new constant and draw contract:

```ts
export const PEN_CLOSE_ICON_OFFSET = 12

if (i === 0 && penState.closingToFirst) {
  canvas.drawCircle(
    v.x + PEN_CLOSE_ICON_OFFSET,
    v.y - PEN_CLOSE_ICON_OFFSET,
    PEN_HANDLE_RADIUS,
    vertexStroke
  )
}
```

## Read First

Read these bounded seams in order immediately before editing:

1. `packages/core/src/constants.ts:71-74` (`PEN_HANDLE_RADIUS` through `PEN_PATH_STROKE_WIDTH`).
2. `packages/core/src/canvas/pen-overlay.ts:139-148` (`drawPenHandlePoint`) and `:192-220` (`drawPenOverlay`).
3. `packages/core/src/canvas/renderer/types.ts:46-60` (`RenderOverlays.penState`).
4. `tests/engine/render/canvas/effects/helpers.ts` exports `mockCalls`, `createMockRenderer`, and `createMockCanvas`; read only those exports.
5. `tests/engine/render/canvas/frame-guides.test.ts:40-70` for the local mock-call assertion pattern.
6. `tests/e2e/tools/pen.spec.ts:122-148` for the existing close-arm regression that must remain unchanged.

## Corrections to the Brief

1. The brief says to select an "existing focused pen overlay/render test". No such render test exists: live search finds `drawPenOverlay` only in the renderer implementation and no call under `tests/`. Create `tests/engine/render/canvas/pen-overlay.test.ts` so the new draw call has deterministic evidence.
2. The generic expansion brief describes a two-line `@ts-nocheck` header as the usual `tests/engine/**/*.ts` convention. The live neighbouring files `tests/engine/render/canvas/frame-guides.test.ts`, `grid.test.ts`, and `effects/*.test.ts` carry no suppression header and resolve the same `#core/*` aliases. The new test must follow this nearer convention and must not add `@ts-nocheck`.
3. T-024c can be fully expanded now, but `Plan/plan.md` correctly remains `To Do` while T-024b is only `Ready`. The parent session owns the index; execution waits until T-024b is Done and the pre-flight confirms no seam drift.

## Fixed Decisions

1. **Draw a ring, not a filled dot or text glyph.** Use one `canvas.drawCircle` call with `vertexStroke` (`r.penVertexStroke`) and no fill. This preserves the established pen-overlay stroke colour and remains distinct from the filled anchor.
2. **Place it 12 screen pixels up-right of the first anchor.** Add `PEN_CLOSE_ICON_OFFSET = 12` and draw at `(v.x + 12, v.y - 12)` after `v` has passed through `toScreen()`. The fixed diagonal placement does not require cursor coordinates or new render state.
3. **Reuse `PEN_HANDLE_RADIUS` (`3.5`) for the ring radius.** At the 12 px offset, its near edge remains 2 px clear of the boosted first-anchor edge: `12 - (4 + 2.5) - 3.5 = 2`.
4. **Gate solely on the existing render signal.** Draw only inside the vertex loop when `i === 0 && penState.closingToFirst`. Do not duplicate the `vertices.length > 2` rule in the renderer; the input layer already owns arming semantics and the renderer must reflect its state.
5. **Keep this paint- and allocation-free.** Reuse `vertexStroke`; do not allocate a `Paint`, `Path`, image, SVG, shader, filter, or cached object. `Canvas.drawCircle` receives primitive coordinates and an already renderer-owned paint, so no new `.delete()` path is introduced.
6. **Use one deterministic render unit test plus the existing real-input E2E.** The new test proves exact position, radius, paint, zoom independence, and absence while disarmed. The unchanged `pen.spec.ts` proves the live input layer still sets and clears `closingToFirst` at 200% and 50% zoom. The browser check remains the final visual-legibility proof.

## Open Decisions

None. The superseded combined packet preserved the requested ring geometry and the live source supports it without new state or architecture.

## Visual Contract — binding

- Shape: one unfilled circular ring; no fill, slash, plus, text, tooltip, label, DOM element, or animation.
- Anchor: the first pen vertex only (`i === 0`).
- Visibility: present exactly while `penState.closingToFirst === true`; absent otherwise.
- Position: `+12 px` on screen x and `-12 px` on screen y from the already transformed first-anchor centre.
- Radius: `3.5 px` via `PEN_HANDLE_RADIUS`.
- Stroke: the existing `vertexStroke` / `r.penVertexStroke` paint without mutation.
- Layer order: draw immediately after the existing first-anchor fill and stroke calls inside `drawPenOverlay()` so it shares the pen-overlay layer and appears after the anchor.
- Zoom/pan: size and offset remain screen-space constants at 25%, 100%, and 400% zoom; the anchor position itself continues to use `toScreen()`.
- State transitions: hovering into the close threshold shows the boosted anchor and ring in the same frame; leaving the threshold removes both the boost state and ring. The ring is not shown for idle, one-vertex, two-vertex, continue, insert, endpoint-link, or node-edit hover states unless the existing `closingToFirst` signal is true.
- Pointer behaviour: the icon is CanvasKit drawing only and creates no hit target; all pointer/cursor behaviour stays owned by the existing input layer.

### Banned List

- No literal colour, colour mutation, new `Paint`, new CanvasKit allocation, or new cleanup lifecycle.
- No DOM/Vue component, Tailwind class, icon dependency, SVG asset, cursor change, global CSS, or `app.css` edit.
- No new renderer state, editor state, command, event, test ID, schema field, or serialised data.
- No change to `PEN_CLOSE_THRESHOLD`, `PEN_CLOSE_RADIUS_BOOST`, `PEN_HANDLE_RADIUS`, `PEN_VERTEX_RADIUS`, `toScreen()`, or the existing anchor draw order.
- No new npm dependency or package mutation.

## Allowed Changes

- `packages/core/src/constants.ts` — add `PEN_CLOSE_ICON_OFFSET` beside the existing pen dimensions.
- `packages/core/src/canvas/pen-overlay.ts` — import the constant and draw the conditional close ring.
- `tests/engine/render/canvas/pen-overlay.test.ts` — create the focused render contract test.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines must stop and report.

- Do not edit `Plan/`, `packages/vue/src/canvas/pen-input/use.ts`, `src/app/editor/pen/`, `packages/core/src/editor/`, `packages/core/src/canvas/renderer/types.ts`, or the existing E2E test.
- Do not implement or repair endpoint resume/linking; T-024b owns it.
- Do not change close hit-testing, cursor selection, `closingToFirst` production, `pendingClose`, tangent behaviour, path commit, vector-network data, undo/redo, `.fig` interchange, export, MCP, menus, or stored schema.
- Do not broaden the icon to node-edit endpoints or foreign-path continue endpoints.
- Do not modify renderer-owned paints or their lifecycle. The icon must add no object requiring `.delete()`.
- Do not edit generated `dist/` declarations or build output.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, a build, an installer, or a version bump.
- Do not run Git commands; this project is intentionally local-only.

## Implementation Steps

1. **Pre-flight and dependency gate.** Confirm `Plan/plan.md` says T-024b is Done before editing. Reread the six `Read First` seams. Stop if `drawPenOverlay()` no longer uses the documented vertex loop, if `closingToFirst` no longer reaches `RenderOverlays.penState`, or if T-024b changed the two target implementation files beyond the documented constants/import/loop anchors.
2. **Add the screen-space constant** in `packages/core/src/constants.ts`. Insert `export const PEN_CLOSE_ICON_OFFSET = 12` immediately after `PEN_CLOSE_RADIUS_BOOST`; do not reorder or change the existing constants.
3. **Add the ring draw call** in `packages/core/src/canvas/pen-overlay.ts`. Extend the `#core/constants` import with `PEN_CLOSE_ICON_OFFSET`. In `drawPenOverlay()`'s vertex loop, immediately after the existing anchor `drawCircle` fill and stroke calls, add the exact conditional draw contract shown under Verified Starting State. Do not extract a helper for this single call and do not mutate `vertexStroke`.
4. **Create deterministic render coverage** at `tests/engine/render/canvas/pen-overlay.test.ts` using `bun:test`, `drawPenOverlay` from `#core/canvas/pen-overlay`, and `createMockCanvas`, `createMockRenderer`, `mockCalls` from `./effects/helpers`. Do not add a suppression header. Provide three pen vertices and two straight segments with `dragTangent: null`; provide renderer overrides for `zoom`, `panX`, `panY`, `penLiveStrokePaint`, `penPathPaint`, `penHandlePaint`, `penVertexFill`, and `penVertexStroke` using stable object identities cast only at the mock boundary. Assert:
   - with `closingToFirst: true`, the `drawCircle` calls contain exactly one extra stroke-only call at transformed first-anchor x `+ 12`, y `- 12`, radius `PEN_HANDLE_RADIUS`, using the exact `penVertexStroke` object;
   - the anchor itself still receives its boosted fill and stroke calls at radius `PEN_VERTEX_RADIUS + PEN_CLOSE_RADIUS_BOOST`;
   - repeating with a different renderer zoom changes the transformed anchor position but not the `12` px offset or `PEN_HANDLE_RADIUS`;
   - with `closingToFirst: false`, no call uses the close-ring coordinates/radius and each vertex retains only its ordinary fill/stroke calls.

   Use this exact fixture shape so the test adds no unrelated renderer setup:

   ```ts
   import { describe, expect, test } from 'bun:test'
   import type { Canvas, Paint } from 'canvaskit-wasm'

   import {
     PEN_CLOSE_ICON_OFFSET,
     PEN_CLOSE_RADIUS_BOOST,
     PEN_HANDLE_RADIUS,
     PEN_VERTEX_RADIUS
   } from '#core/constants'
   import { drawPenOverlay } from '#core/canvas/pen-overlay'
   import type { RenderOverlays } from '#core/canvas/renderer'

   import { createMockCanvas, createMockRenderer, mockCalls } from './effects/helpers'

   const straight = { x: 0, y: 0 }
   const basePenState: NonNullable<RenderOverlays['penState']> = {
     vertices: [{ x: 10, y: 20 }, { x: 40, y: 20 }, { x: 40, y: 50 }],
     segments: [
       { start: 0, end: 1, tangentStart: straight, tangentEnd: straight },
       { start: 1, end: 2, tangentStart: straight, tangentEnd: straight }
     ],
     dragTangent: null,
     oppositeDragTangent: null,
     closingToFirst: true
   }
   ```

   In each test, create five distinct empty paint stubs and cast them to `Paint` only in the `createMockRenderer({...})` override. At `zoom: 2`, `panX: 5`, `panY: -3`, the first anchor is `(25, 37)` and the ring must be `(37, 25)`; this gives the executor exact expected coordinates rather than asking it to re-derive the transform. Call `drawPenOverlay(r, canvas as Canvas, structuredClone(basePenState))`. For the disarmed case, clone the fixture and set `closingToFirst = false` before the call. Use `mockCalls(canvas.drawCircle)` to inspect calls and assert the exact paint object by identity.
5. **Run the development-loop test** until green, then run the final gates once in the order below. Do not edit outside Allowed Changes to silence an unrelated failure.
6. **Run the browser check** after the source gates. Record observed visibility, offset, zoom independence, disappearance on disarm, and any rendering/console failure. Browser proof is sufficient; no desktop delivery is authorised or required.

## Acceptance Criteria

- [x] `PEN_CLOSE_ICON_OFFSET` exists once, is exported from `packages/core/src/constants.ts`, and equals `12`.
- [x] Armed close state draws the existing boosted first anchor plus exactly one separate unfilled ring at `(screenX + 12, screenY - 12)` with radius `PEN_HANDLE_RADIUS` and the existing `penVertexStroke` object.
- [x] Disarmed state draws no close ring.
- [x] The ring offset and radius stay constant in screen pixels as zoom changes; pan/zoom affect only the transformed anchor origin.
- [x] The implementation allocates no CanvasKit wrapper and adds no `.delete()` responsibility.
- [x] Existing close hit-testing and cursor behaviour remain green in `tests/e2e/tools/pen.spec.ts` without modifying that file.
- [x] No path data, editor state, undo behaviour, input code, schema, export, menu, dependency, version, build output, or generated declaration changes.
- [x] The focused render test, core type check, focused Oxlint, existing pen E2E, and named browser check all pass with recorded evidence.

## Verification

Run all commands from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

`bun test tests/engine/render/canvas/pen-overlay.test.ts`

Expected: exit `0`; the focused tests prove the armed/disarmed draw calls and screen-space geometry.

### Final pre-completion gates — run once

1. `bunx tsgo --noEmit -p packages/core/tsconfig.json --pretty false` — expect exit `0`.
2. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/constants.ts packages/core/src/canvas/pen-overlay.ts tests/engine/render/canvas/pen-overlay.test.ts` — expect exit `0` with no errors.
3. `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil` — expect exit `0`; the existing close-arm/disarm regression at 200% and 50% zoom remains green, with no console errors.

Do not substitute umbrella tests or builds for these focused gates.

## Integration or Installed-Result Check

Browser check by default; no desktop build, install, version change, or installed-identity proof is authorised or necessary.

1. From `App/`, run `bun run dev` and use the browser app at Vite port 1420.
2. Select Pen, create a three-vertex open path, and move the pointer inside the existing close threshold of the first vertex. Confirm the first anchor enlarges and a separate small unfilled ring appears up-right of it in the same frame.
3. Move outside the close threshold without clicking. Confirm the ring disappears immediately and no path is committed or mutated.
4. Repeat at 25%, 100%, and 400% zoom. Confirm the icon remains the same apparent size and 12 px diagonal offset while tracking the transformed first anchor.
5. Re-arm and click the first vertex. Confirm the path closes exactly as before and the icon disappears when pen state commits.
6. Confirm no ring appears while placing only one or two vertices, and record browser console/render errors if any.

## Stop Conditions

- Stop if T-024b is not Done when execution begins, or if its execution changed the documented constants/import/vertex-loop seams; return this packet for reconciliation rather than implementing against stale anchors.
- Stop if rendering the ring requires new editor/render state, a new paint, any CanvasKit allocation, input-layer changes, or a type/schema change.
- Stop if the existing `closingToFirst` signal is true for one- or two-vertex paths during live input; that is upstream state drift and must not be masked in the renderer.
- Stop if the ring cannot remain exactly 12 screen pixels from the first anchor without changing `toScreen()` or close hit-testing.
- Stop on any failed required gate, existing pen E2E regression, path-data change, or unrelated out-of-scope change.

## Execution Report Contract

Report:

- result and whether the dependency/pre-flight gate passed;
- changed files with a concise change summary;
- exact commands, exit codes, test counts, and failures;
- mock-call evidence for armed, disarmed, and changed-zoom states, including coordinates, radius, and paint identity;
- browser observations at 25%, 100%, and 400% zoom, plus close/disarm behaviour and console state;
- confirmation that no input, schema, path-data, dependency, version, build/install, generated-output, or Git work occurred;
- deviations, assumptions used, remaining gaps, and any stop condition encountered.

## Status record

2026-08-20 10:42 Africa/Johannesburg — Revision 2 expanded against the live source and current plan. Confirmed the separate close icon is not yet implemented; fixed it as a stroke-only `PEN_HANDLE_RADIUS` ring at a 12 px up-right screen-space offset, reusing `penVertexStroke` with no CanvasKit allocation. Corrected the brief's nonexistent render-test assumption by specifying a new focused `pen-overlay.test.ts`. Planning only: no `App/` file, plan index, dependency, build, install, or version was changed. The packet is implementation-ready but remains dependency-locked in `Plan/plan.md` until T-024b is Done.

2026-08-20 11:00 Africa/Johannesburg — Executed and verified. `PEN_CLOSE_ICON_OFFSET = 12` added to `packages/core/src/constants.ts`; conditional close ring drawn in `packages/core/src/canvas/pen-overlay.ts` using `penVertexStroke`; focused unit tests added in `tests/engine/render/canvas/pen-overlay.test.ts`. All gates passed: tsgo typecheck (exit 0), oxlint (exit 0), bun unit tests (3 pass, 18 asserts, exit 0), Playwright pen suite (9 pass, exit 0), and browser integration check across 25%, 100%, and 400% zoom with 0 errors. Status marked Done in `Plan/plan.md`.
