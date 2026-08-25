# T-041 - Cursor feedback for the progressive-blur ramp handles

Task ID: T-041
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-037 (progressive layer blur; DONE/VERIFIED, the on-canvas ramp handle it shipped is confirmed live)
Related: T-040 (corner-radius cursor - shares this packet's exact seam; land the two together or in either order, see Fixed Decisions)
Prepared from: `Plan/Packets/T-041-gradient-handle-cursors.md` (brief)
Expanded at: 2026-08-15
Expanded against: `App/packages/vue/src/shared/input/progressive-blur.ts`, `App/packages/core/src/canvas/overlays/progressive-blur.ts`, `App/packages/vue/src/shared/input/select/hover.ts`, `App/packages/vue/src/shared/input/select.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`, `App/packages/vue/src/primitives/GradientEditor/GradientEditorStop.vue`, `App/packages/vue/src/primitives/GradientEditor/GradientEditorBar.vue`, `App/src/components/fill-picker/GradientEditor.vue`, `App/packages/core/src/canvas/renderer/pipeline.ts`
Delivery: source gates only

## Intended Outcome

Hovering either endpoint of the on-canvas progressive-blur ramp changes the cursor to something other than the default arrow, and it stays applied for the whole drag regardless of where the pointer strays, matching the existing precedent already used for the gradient-fill picker's stop handles.

## Request Coverage

- Provide a better mouse cursor for dragging the gradient-line nodes on the progressive layer blur handle.
- Apply the same improvement to the gradient fill handle nodes.

## Verified Starting State

### There is no on-canvas gradient-fill handle - only the progressive-blur ramp has one

This is the single most important finding of this expansion and changes the packet's scope. A full search of `packages/core/src/canvas`, `packages/vue/src`, and `src/components` for gradient-handle drawing/hit-testing (`grep -rn "GRADIENT_LINEAR\|GRADIENT_RADIAL\|gradientHandle\|GradientHandle"`) turns up **fill application code only** (`fills.ts`, `design-jsx/paints.ts`, `io/formats/svg/defs.ts`, `tools/modify/paint.ts`) - no on-canvas gradient-line drawing or hit-testing exists anywhere. `App/packages/core/src/canvas/renderer/pipeline.ts:246-262` lists every overlay the render pipeline draws each frame; `r.drawProgressiveBlurHandles(...)` (line 258) is present, but there is no `drawGradientHandles` or equivalent. Gradient fills (on rectangles, text, strokes-not-yet per T-048, etc.) are edited exclusively through the **popup** gradient bar:

| Path | What it is |
| --- | --- |
| `App/src/components/fill-picker/GradientEditor.vue` | The popup panel content: an `AppSelect` for gradient subtype, a `GradientEditorBar` (the 1D horizontal stop bar), and a per-stop editable list below it. This is a DOM/Tailwind UI inside a picker popover, not a canvas overlay. |
| `App/packages/vue/src/primitives/GradientEditor/GradientEditorBar.vue:21-65` | The draggable bar. `draggingIndex` (a `ref<number \| null>`) is set on `pointerdown` (`stopPointerDown`, line 24-28, with `setPointerCapture`) and cleared on `pointerup` (line 38-40). Exposed to its slot as `dragging-index`. |
| `App/packages/vue/src/primitives/GradientEditor/GradientEditorStop.vue:78` | Renders `:data-dragging="dragging ? '' : undefined"` from a `dragging` prop. |
| `App/src/components/fill-picker/GradientEditor.vue:43-58` | Passes `:dragging="idx === bar.draggingIndex"` into each `GradientEditorStop`, and the stop's class list already reads `cursor-grab rounded-sm ... data-[dragging]:cursor-grabbing` (line 51). **This is already fully wired and functioning** - `draggingIndex` correctly drives the `data-dragging` attribute, which correctly drives the Tailwind `data-[dragging]:cursor-grabbing` variant. |

**Conclusion: the "gradient fill handle nodes" half of the Request Coverage is already delivered.** The popup bar's stop handles already show `grab` while idle and `grabbing` while dragging, verified end-to-end through the prop chain above. There is nothing to build for that half of the ask; see Corrections to the Brief.

### The progressive-blur ramp handle - real, on-canvas, and has no cursor today

| Path | What it is |
| --- | --- |
| `App/packages/core/src/canvas/overlays/progressive-blur.ts:23-60` (`drawProgressiveBlurHandles`) | Draws the ramp line and two circular endpoint handles (`HANDLE_RADIUS = 4` canvas px, zoom-compensated) for the effect currently being edited (`editor.state.progressiveBlurEdit`). This is the on-canvas overlay the request is actually about. |
| `App/packages/vue/src/shared/input/progressive-blur.ts:50-66` (`hitTestProgressiveBlurHandle`) | The hit-test to reuse for the cursor: `(cx, cy, node, effect, graph, zoom)` → `'start' \| 'end' \| null`. Hit radius is `HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)` - the same `HANDLE_HIT_RADIUS = 6` device-independent-pixel constant T-040 reuses, not a separate one. |
| `App/packages/vue/src/shared/input/progressive-blur.ts:68-94` (`tryStartProgressiveBlur`) | Confirms only two draggable points exist: `'start'` and `'end'`. **There is no third, mid-stop or line-body draggable target** - dragging the line itself is not implemented, only the two endpoints. This directly answers the stub's second Expansion Question. |
| `App/packages/vue/src/shared/input/select.ts:44-51` | `tryStartProgressiveBlur` is checked **first**, before `tryStartRadius` (line 53) - "Ramp handles sit inside the node, so they are claimed before the corner radius controls they can overlap." The cursor precedence added by this packet must be checked first for the same reason, ahead of T-040's radius-cursor branch. |
| `App/packages/vue/src/shared/input/select/hover.ts:60-75` (`updateHoverCursor`) | Confirmed to have **no branch at all** for the progressive-blur handles today, exactly as for radius handles (see T-040's Verified Starting State, which documents the shared cursor-assignment mechanism in full - read it alongside this packet, both packets touch the same function). Hovering a ramp handle today falls through to `null` → the plain `'default'` `SELECT` cursor. |
| `App/packages/vue/src/canvas/useCanvasInput.ts:353-360, 469, 536-537` | `drag.value.type === 'progressive-blur'` is the existing discriminant for move/commit/cancel (`applyProgressiveBlurDrag`, `commitProgressiveBlurDrag`, `cancelProgressiveBlurDrag`). The same freeze-on-drag mechanism T-040 documents applies here identically: once the drag starts, `onMouseMove`'s hover branch is skipped, so a cursor set at hover time (or at drag start) persists untouched until release/cancel, both of which already null `cursorOverride` (`useCanvasInput.ts:493-494`, `540-541`) for every drag type generically, `progressive-blur` included. |

## Corrections to the Brief

The stub's premise that a "gradient fill handle" exists on canvas, parallel to the progressive-blur ramp, is **wrong** - there is no such on-canvas control; gradient fills are edited entirely through the popup `GradientEditorBar`. That popup bar's stops already carry a correct, working `cursor-grab`/`cursor-grabbing` pair (`GradientEditor.vue:51`), so that half of the Request Coverage is **already delivered** and needs no work. This packet's actual scope narrows to the progressive-blur ramp handles only. Both of the stub's Expansion Questions are answered directly:

- **"Do the blur ramp and the gradient line share one handle component, or are there two implementations to change?"** - Neither, precisely: there is one real on-canvas implementation (`progressive-blur.ts`, both the draw and the hit-test sides), and one separate, already-cursor-correct DOM implementation (`GradientEditorBar.vue`/`GradientEditorStop.vue`) that this packet does not need to touch.
- **"Distinct cursors for endpoint versus mid-stop versus the line body?"** - No mid-stop or line-body drag exists (`tryStartProgressiveBlur` only recognises `'start'`/`'end'`), so there is nothing to distinguish; both endpoints get the same cursor pair.

## Fixed Decisions

1. **Cursor value: built-in CSS `'grab'` while hovering a ramp endpoint (not dragging), `'grabbing'` while the drag is active.** Identical values to T-040, and directly matching the already-shipped, already-correct precedent one seam over in `GradientEditor.vue:51`. This keeps exactly one cursor vocabulary for "drag this point" across the whole app: `grab`/`grabbing`, whether the point is a DOM stop in a popup or a canvas-drawn handle.
2. **Scope is progressive-blur ramp handles only; the gradient-fill popup bar is untouched.** Per Corrections to the Brief, it already works. Re-verifying it is in scope (Implementation Steps); changing it is not.
3. **Hover precedence: the progressive-blur cursor check runs before the radius cursor check (T-040) and before resize/rotation, mirroring `handleSelectDown`'s hit-test order exactly** (`select.ts:44-58`: progressive-blur claimed before radius, both before rotation/resize). If this packet lands before T-040, add the progressive-blur branch as the first check in `updateHoverCursor`'s `??` chain; if T-040 has already landed, insert this packet's check immediately above T-040's radius branch, not below it - getting this order wrong would make a radius handle win a cursor race it should lose whenever a ramp handle sits inside a radius handle's hit circle.
4. **No new drag-state field, no mid-drag cursor recomputation.** Same freeze-on-drag reasoning as T-040 Fixed Decision 2: setting `cursorOverride` once at hover time and once more at drag start is sufficient; the existing `onMouseMove` skip-while-dragging behaviour keeps it stable for the rest of the gesture.

## Visual Contract — binding

No Tailwind classes, `tv()` recipes, or DOM elements for the canvas-side fix - same mechanism as T-040: the existing `cursorOverride: Ref<string | null>` consumed via `EditorCanvas.vue:219`'s `:style="{ cursor }"`.

| State | Cursor value | Source of the value |
| --- | --- | --- |
| Hovering a progressive-blur ramp endpoint (`'start'` or `'end'`), not dragging | `'grab'` | Matches `GradientEditor.vue:51`'s `cursor-grab` |
| Actively dragging a ramp endpoint | `'grabbing'` | Matches `GradientEditor.vue:51`'s `data-[dragging]:cursor-grabbing` |
| Hit radius used for the cursor check | `HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)` = **6 device-independent pixels at zoom 1**, zoom-compensated | `App/packages/core/src/constants.ts:403`, reused via `hitTestProgressiveBlurHandle` - the same constant T-040 reuses, not a second one |
| Gradient-fill popup bar stops | Unchanged - already `cursor-grab` / `data-[dragging]:cursor-grabbing` | `GradientEditor.vue:51` |

### Banned List

- No new SVG cursor asset.
- No literal cursor string other than `'grab'` and `'grabbing'`.
- No new hit-test function or hit-radius constant. Only `hitTestProgressiveBlurHandle` from `progressive-blur.ts`, called with the existing `HANDLE_HIT_RADIUS`.
- No new `Ref`, store field, or drag-state field. Only the existing `cursorOverride: Ref<string | null>`.
- No change to `GradientEditor.vue`, `GradientEditorBar.vue`, or `GradientEditorStop.vue` - they are already correct (Corrections to the Brief).
- No change to `progressive-blur.ts`'s hit-test, drag-start, apply, commit, or cancel logic, and no change to `packages/core/src/canvas/overlays/progressive-blur.ts`'s drawing code.
- No new npm dependency.

## Allowed Changes

- `App/packages/vue/src/shared/input/select/hover.ts` - add a progressive-blur-hover cursor branch to `updateHoverCursor`, following the same shape as T-040's radius branch (and T-040's own `getResizeCursorForSelection`/`getRotationCursorForSelection` precedent).
- `App/packages/vue/src/canvas/useCanvasInput.ts` (and/or `App/packages/vue/src/shared/input/select.ts`, whichever already has `cursorOverride` in scope at the progressive-blur drag-start site with the least plumbing - pick one, matching T-040's own Implementation Step 4 choice for consistency) - set `cursorOverride.value = 'grabbing'` when a progressive-blur drag starts.
- `App/tests/engine/vue/input/` - a new focused pure-function test, or an addition to T-040's `radius-cursor.test.ts` if that file already exists when this packet lands (co-locate rather than duplicate the test harness setup - see Implementation Steps).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT build an on-canvas gradient-fill handle.** None exists; inventing one is a materially different, unbounded feature and is explicitly not this packet's job. If the user wants an on-canvas gradient-line handle (as opposed to the popup bar), that is new scope for a future packet, not this one.
- **Do NOT touch `GradientEditor.vue`, `GradientEditorBar.vue`, or `GradientEditorStop.vue`.** Verified already correct; changing them risks the one thing in this area that already works.
- **Do NOT change `progressive-blur.ts`'s (either the `packages/vue/src/shared/input/` or `packages/core/src/canvas/overlays/` file) hit-test, drawing, drag-start, apply, commit, or cancel logic.** This packet only reads the existing hit-test result to choose a cursor string.
- **Do NOT add a mid-stop or line-body drag target.** Corrections to the Brief and Fixed Decision establish none exists and none is in scope.
- **Do NOT change T-062's scope (selection outline drawing).**
- **Do NOT add cursor recomputation inside the drag-move path.** Same reasoning as T-040.
- **Deferred to a later packet: an on-canvas gradient-fill line handle, if the user wants one.** Not this packet - flag it back to the user rather than building it speculatively.

## Implementation Steps

1. Read `App/packages/vue/src/shared/input/progressive-blur.ts`, `App/packages/vue/src/shared/input/select/hover.ts`, and `App/packages/vue/src/canvas/useCanvasInput.ts` in full before editing. Also open `App/src/components/fill-picker/GradientEditor.vue:43-58` and confirm the `dragging`/`data-dragging`/`cursor-grab` chain still reads exactly as documented above - if it has changed, stop and re-verify Corrections to the Brief before proceeding, since this packet's scope depends on it.
2. In `hover.ts`, add a function `getProgressiveBlurCursorForSelection(cx, cy, editor)`: call `getProgressiveBlurEdit(editor)` (already exported from `progressive-blur.ts`) to get the node/effect being edited, return `null` if none; otherwise call `hitTestProgressiveBlurHandle(cx, cy, node, effect, editor.graph, editor.renderer?.zoom ?? 1)` and return `'grab'` on a non-null hit, else `null`.
3. In `updateHoverCursor`, insert the new check first in the `??` chain, ahead of the radius check (whether or not T-040 has landed yet - see Fixed Decision 3):
   ```ts
   const cursor =
     getProgressiveBlurCursorForSelection(cx, cy, editor) ??
     getRadiusCursorForSelection(cx, cy, editor) ??  // only if T-040 has landed
     getResizeCursorForSelection(cx, cy, editor) ??
     getRotationCursorForSelection(cx, cy, editor)
   ```
   If T-040 has not landed yet, omit the radius line entirely and leave a one-line comment marking where it belongs, per T-040's own Fixed Decision 3.
4. In the progressive-blur drag-start path (`select.ts:46-51`'s `handleSelectDown`, or immediately after `setDrag(blurDrag)` in `useCanvasInput.ts`'s `onMouseDown` - match whichever site T-040 used for its own drag-start cursor set, for consistency across the two packets), set `cursorOverride.value = 'grabbing'` right after `setDrag(blurDrag)`.
5. Confirm (read, do not guess) that `onMouseUp` and the `Escape` handler in `useCanvasInput.ts` already null `cursorOverride` for `drag.value.type === 'progressive-blur'` - they do, via the same generic `cursorOverride.value = null` at the end of each branch used for every drag type. No change needed.
6. Add or extend a focused test. If `App/tests/engine/vue/input/radius-cursor.test.ts` (from T-040) already exists, add a `describe` block to it for the progressive-blur cursor rather than duplicating the harness setup; otherwise create `App/tests/engine/vue/input/progressive-blur-cursor.test.ts` following `App/tests/engine/vue/input/auto-layout-hover.test.ts`'s pattern. Cover:
   - `getProgressiveBlurCursorForSelection` returns `'grab'` when `(cx, cy)` lands inside either endpoint's hit circle (compute the expected point via `getProgressiveBlurHandlePosition`, already exported from `progressive-blur.ts`).
   - Returns `null` when no `progressiveBlurEdit` is active, even if `(cx, cy)` would otherwise land on a handle-shaped point.
   - Returns `null` when `(cx, cy)` is outside both endpoints' hit circles.
   - Returns `'grab'` correctly at a non-1 zoom.
7. Run, in order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on the changed files
   - `bun test tests/engine/vue/input/radius-cursor.test.ts tests/engine/vue/input/progressive-blur-cursor.test.ts` (adjust the file list to whichever files actually exist per step 6)

## Acceptance Criteria

- [ ] Hovering either endpoint of an active progressive-blur ramp shows `cursor: grab`.
- [ ] Starting a drag on either endpoint switches the cursor to `cursor: grabbing`, and it stays `grabbing` even if the pointer moves outside the handle's hit circle during the drag (the ramp is deliberately unclamped per T-037, so the pointer routinely ends up far from the node).
- [ ] Releasing or cancelling (Escape) the drag returns the cursor to whatever the pointer's current position warrants.
- [ ] When a progressive-blur ramp handle and a corner-radius handle could occupy the same screen position, the progressive-blur cursor wins, matching `handleSelectDown`'s own claim order.
- [ ] The gradient-fill popup bar's existing `grab`/`grabbing` cursors are verified unchanged and still correct - confirmed by inspection, not modified.
- [ ] No on-canvas gradient-fill handle is introduced.
- [ ] Nothing in the Banned List appears in the diff.

## Verification

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- Focused Oxlint over `packages/vue/src/shared/input/select/hover.ts`, `packages/vue/src/canvas/useCanvasInput.ts` (and `select.ts` if touched), plus the test file(s) from step 6.
- `bun test tests/engine/vue/input/radius-cursor.test.ts tests/engine/vue/input/progressive-blur-cursor.test.ts` (or whichever combined test file was used) from `App/`; expect exit code `0`.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command per the delivery policy.

## Stop Conditions

- Stop if `App/src/components/fill-picker/GradientEditor.vue`'s `cursor-grab`/`data-[dragging]:cursor-grabbing` wiring has changed since this expansion and no longer works - re-verify Corrections to the Brief before treating the gradient-fill half as already delivered.
- Stop if `getProgressiveBlurEdit(editor)` requires state (e.g. an actively expanded Effects-panel row) that the hover path cannot reach without a UI action outside this packet's scope - report the exact gap rather than inventing a workaround.
- Stop if T-040 and this packet's edits to `updateHoverCursor`'s `??` chain conflict (e.g. both packets landed independently and duplicated a branch) - reconcile by reading the actual current file rather than assuming either packet's Implementation Steps still match it exactly.
- Stop and report if setting `cursorOverride` at drag start turns out to need touching both `select.ts` and `useCanvasInput.ts` - pick exactly one site, matching whichever T-040 used.

## Revision History

- Revision 1 - 2026-08-15: expanded against live progressive-blur and gradient-picker source; the central finding is that no on-canvas gradient-fill handle exists, narrowing scope to the progressive-blur ramp only, and that the popup gradient bar's cursor behaviour is already fully correct.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-15: popup gradient bar confirmed already grab/grabbing; progressive-blur ramp endpoints wired with grab hover and grabbing drag with precedence over radius handles; tsgo, vue-tsc, focused Oxlint, and 6/6 Bun tests green)
