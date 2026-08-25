# T-040 - Cursor feedback while adjusting corner radius

Task ID: T-040
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-004 (corner-radius node controls; already DONE and confirmed live)
Related: T-062 (selection outline fidelity), T-041 (gradient/progressive-blur handle cursors - shares this packet's exact seam)
Prepared from: `Plan/Packets/T-040-corner-radius-cursor.md` (brief)
Expanded at: 2026-08-15
Expanded against: `App/packages/vue/src/shared/input/radius.ts`, `App/packages/vue/src/shared/input/select/hover.ts`, `App/packages/vue/src/shared/input/select.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`, `App/packages/vue/src/shared/input/geometry.ts`, `App/packages/vue/src/editor/tool-cursor/index.ts`, `App/src/components/EditorCanvas.vue`, `App/packages/vue/src/primitives/GradientEditor/GradientEditorStop.vue`, `App/src/components/fill-picker/GradientEditor.vue`
Delivery: source gates only

## Intended Outcome

Hovering a corner-radius handle changes the canvas cursor to something other than the default arrow, and that cursor stays applied for the whole drag - even if the pointer strays outside the handle's small hit circle while dragging - because it reuses the freeze-during-drag behaviour the resize and rotation cursors already rely on.

## Request Coverage

- The mouse cursor must change when the user is on, and while dragging, a corner-radius handle.

## Verified Starting State

### How cursors are assigned on this canvas today (binding for this packet and for T-041)

Cursors are **not** CSS classes and **not** a central cursor-state module. They are plain CSS `cursor` string values, computed reactively and applied via an inline style binding:

- `App/src/components/EditorCanvas.vue:121` - `const cursor = computed(() => toolCursor(store.state.activeTool, cursorOverride.value))`, applied at line 219 as `:style="{ cursor }"` on the interactive `<canvas>` element.
- `App/packages/vue/src/editor/tool-cursor/index.ts:1-24` (`toolCursor`) - returns `override` if set, else a per-`Tool` lookup table of **built-in CSS cursor keywords only** (`'default'`, `'crosshair'`, `'text'`, `'grab'`). No custom cursor is used for tool selection itself.
- `App/packages/vue/src/canvas/useCanvasInput.ts:114` - `const cursorOverride = ref<string | null>(null)`, returned from `useCanvasInput` and consumed by `EditorCanvas.vue`.
- `App/packages/vue/src/shared/input/select/hover.ts:60-75` (`updateHoverCursor`) - the **only** place `cursorOverride` is computed from hover position today. It currently checks, in order: resize handles (`getResizeCursorForSelection`, custom rotated SVG cursor) then rotation corners (`getRotationCursorForSelection`, custom rotated SVG cursor). **It has no branch for radius handles.** Hovering a radius handle today falls through to `null`, so `toolCursor` returns the plain `SELECT` tool cursor, `'default'`.
- `App/packages/vue/src/canvas/useCanvasInput.ts:364-378` (`onMouseMove`) - `handleSelectHover` (which calls `updateHoverCursor`) runs **only inside the `if (!drag.value)` branch**. Once a drag starts (`drag.value` is set), hover/cursor recomputation is skipped entirely for the rest of the gesture - `cursorOverride` simply keeps whatever value it held the instant before `pointerdown`. This is exactly what makes the existing resize/rotation cursors "stick" correctly through their drags: the cursor is already correct from the hover pass immediately preceding `pointerdown`, and nothing resets it until `onMouseUp`/`Escape`/`window pointerup` explicitly sets `cursorOverride.value = null` (`useCanvasInput.ts:458, 494, 530, 541`).
- **Consequence, confirmed by reading the code path end to end:** because `updateHoverCursor` never checks radius handles, `cursorOverride` is `null` both while hovering a radius handle *and* for the entire subsequent drag. The cursor shown is the plain `'default'` `SELECT` cursor throughout - this is the exact defect the packet exists to fix, and the fix is additive to a function that already exists rather than new plumbing.
- `App/packages/vue/src/shared/input/select.ts:22-86` (`handleSelectDown`) - confirms hit-test precedence at `pointerdown`: progressive-blur ramp handles are claimed first (line 46, "Ramp handles sit inside the node, so they are claimed before the corner radius controls they can overlap"), then radius handles (line 53), then rotation, then resize, then a plain hit/marquee. The cursor precedence added by this packet must match: **progressive-blur handle cursor wins over radius handle cursor** wherever they could coincide (T-041 owns the progressive-blur branch; this packet's radius branch must be checked after it, exactly mirroring `select.ts`'s own order).

### The radius handle itself - already fully built by T-004, live and confirmed

| Path | What it is |
| --- | --- |
| `App/packages/vue/src/shared/input/radius.ts:72-88` (`hitTestRadiusControlByMatrix`) | The exact hit-test to reuse for the cursor. Takes `(cx, cy, node, graph, zoom)`, returns a `CornerPosition` (`'nw' \| 'ne' \| 'se' \| 'sw'`) or `null`. Hit radius is `HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)` where `HANDLE_HIT_RADIUS = 6` (`App/packages/core/src/constants.ts:403`) - **6 device-independent pixels**, zoom-compensated. This is the binding hit radius; do not invent a new one. |
| `App/packages/vue/src/shared/input/radius.ts:174-200` (`tryStartRadius`) | Confirms the same hit-test is used to start the drag: single selection only, node type in `CORNER_RADIUS_TYPES` (`RECTANGLE`, `ROUNDED_RECTANGLE`, `FRAME`, `COMPONENT`, `INSTANCE`, `BOOLEAN_OPERATION`), not locked. |
| `App/packages/vue/src/shared/input/types.ts:82-96` (`DragRadius`) | The active drag-state shape once a radius drag has started: `{ type: 'radius', nodeId, corner, ... }`. |
| `App/packages/vue/src/canvas/useCanvasInput.ts:353-356, 468, 535` | `drag.value.type === 'radius'` is the existing discriminant already used to route move/commit/cancel; the cursor logic added by this packet does not need a new one - it only needs to run the **hover** hit-test before the drag starts, per the freeze-on-drag mechanism above. |

## Corrections to the Brief

None to the stub's Request Coverage - it is accurate. Both of the stub's Expansion Questions are answered below as Fixed Decisions rather than left open, because the codebase already contains a directly analogous, working precedent for each.

## Fixed Decisions

1. **Cursor value: built-in CSS `'grab'` while hovering (not dragging), `'grabbing'` while the radius drag is active.** No new SVG asset. This directly reuses the same semantic pair already used one seam over for exactly the same kind of interaction - dragging a small draggable point to change a value - in `App/src/components/fill-picker/GradientEditor.vue:51` (`cursor-grab ... data-[dragging]:cursor-grabbing`) on the gradient-stop handles. `'grab'`/`'grabbing'` is visually distinct from `'default'` (the plain `SELECT` cursor), from the custom rotated resize-cursor SVG, and from the custom rotated rotate-cursor SVG - satisfying the stub's "distinct from resize/move" requirement without hand-authoring new cursor artwork or adding a Windows/browser SVG-cursor parity risk. This is the recommendation for the Open Decision the stub raised ("built-in CSS cursor or custom bitmap/SVG cursor") - built-in, with the precedent above as the justification.
2. **The cursor persists through the whole drag even if the pointer leaves the handle's hit circle, by construction, not by new code.** Per the Verified Starting State, `onMouseMove` skips hover recomputation entirely once `drag.value` is set. As long as the new radius-hover branch sets `cursorOverride.value = 'grab'` at hover time and the existing `d.type === 'radius'` handling additionally sets it to `'grabbing'` at drag start, no per-move cursor logic is needed during the drag - it simply does not get overwritten until release. This directly answers the stub's second Expansion Question.
3. **Hover precedence: check the progressive-blur handle first, then the radius handle, then resize, then rotation - mirroring `handleSelectDown`'s own hit-test order exactly.** `updateHoverCursor` currently checks resize then rotation; add the radius branch **before** those two (radius handles sit at the node's corners, inside the outer resize/rotation zones at typical sizes, and must win when the hit circles could overlap, matching `select.ts`'s claim order). The progressive-blur branch (T-041's responsibility) must be checked before the radius branch, per the `select.ts:44-58` comment. If T-041 has not landed yet when this packet is implemented, implement the radius branch first in `updateHoverCursor`'s existing check order (radius before resize/rotation) and leave a comment noting T-041 must insert its own check above this one - do not block this packet on T-041's landing order, since `Depends on: T-004` only, and `Related: T-041` is not a hard dependency.
4. **No new drag state, no new field on `DragRadius`.** The existing `type: 'radius'` discriminant in `drag.value` is sufficient to distinguish "about to hover" from "actively dragging" for cursor purposes, exactly as it already is for the resize (`type: 'resize'`) and rotate (`type: 'rotate'`) cases, neither of which needed a cursor-specific field.

## Visual Contract — binding

There are no Tailwind classes, `tv()` recipes, or DOM elements involved - this is a canvas cursor, assigned via the existing `cursorOverride: Ref<string | null>` mechanism and consumed through the existing inline `:style="{ cursor }"` binding in `EditorCanvas.vue:219`. The binding contract is the exact string values and the hit geometry:

| State | Cursor value | Source of the value |
| --- | --- | --- |
| Hovering a radius handle (not dragging) | `'grab'` | Matches `GradientEditor.vue:51`'s `cursor-grab` |
| Actively dragging a radius handle | `'grabbing'` | Matches `GradientEditor.vue:51`'s `data-[dragging]:cursor-grabbing` |
| Everywhere else on a corner-radius-capable node | Unchanged - falls through to resize/rotation/default per existing precedence | `hover.ts` existing branches |
| Hit radius used for the cursor check | `HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)` = **6 device-independent pixels at zoom 1**, zoom-compensated | `App/packages/core/src/constants.ts:403`, reused via `hitTestRadiusControlByMatrix` - do not add a second constant |

### Banned List

- No new SVG cursor asset. No `packages/vue/src/shared/assets/*.svg` addition for this packet.
- No literal cursor string other than `'grab'` and `'grabbing'`. Never a hex-encoded `url(...)` data URI for this handle.
- No new hit-test function or hit-radius constant. Only `hitTestRadiusControlByMatrix` from `radius.ts`, called with the existing `HANDLE_HIT_RADIUS`.
- No new `Ref`, store field, or drag-state field. Only the existing `cursorOverride: Ref<string | null>`.
- No change to `TOOL_CURSORS` in `tool-cursor/index.ts` - that table is for tool-level default cursors, not per-handle overrides.
- No new npm dependency.
- No change to `radius.ts`'s hit-test, drag-start, apply, commit, or cancel logic - this packet only reads the existing hit-test result to choose a cursor string; it does not touch radius values, undo, or geometry.

## Allowed Changes

- `App/packages/vue/src/shared/input/select/hover.ts` - add a radius-hover cursor branch to (or alongside) `updateHoverCursor`, following the existing `getResizeCursorForSelection`/`getRotationCursorForSelection` shape.
- `App/packages/vue/src/canvas/useCanvasInput.ts` - set `cursorOverride.value = 'grabbing'` when a radius drag starts (in `handleSelectDown`'s radius branch or immediately after `setDrag(radiusDrag)` in `select.ts`, whichever keeps the change smallest - see Implementation Steps) and confirm `cursorOverride.value = null` already fires on release/cancel for `type: 'radius'` (it does, at lines 458/494/530/541 - verify, do not duplicate).
- `App/packages/vue/src/shared/input/select.ts` - only if setting `cursorOverride` at drag start is cleaner here than in `useCanvasInput.ts` (both files are already in the radius-drag start path); pick one, do not set it in both.
- `App/tests/engine/vue/input/` - a new focused pure-function test for the radius-hover cursor branch, following `App/tests/engine/vue/input/auto-layout-hover.test.ts`'s pattern (mock `SceneNode`/`Editor`, call the exported function directly, assert the returned string).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT author a new SVG cursor asset.** Fixed Decision 1 settles this; a custom asset is explicitly not required and not wanted for this packet.
- **Do NOT change `radius.ts`'s `hitTestRadiusControlByMatrix`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, or `cancelRadiusDrag`.** This packet only reads their existing return values/state to choose a cursor string.
- **Do NOT change T-062's scope (selection outline drawing).** This packet is cursor-only; it must not touch `packages/core/src/canvas/overlays/selection.ts`.
- **Do NOT change `TOOL_CURSORS` or `toolCursor`.** The override mechanism already composes correctly with it.
- **Do NOT add cursor recomputation inside the drag-move path.** Fixed Decision 2 establishes the freeze-on-drag behaviour is sufficient and correct; adding per-move cursor logic would be redundant and risks fighting the existing mechanism.
- **Do NOT touch the progressive-blur cursor branch.** That is T-041's scope; this packet's radius branch must be ordered to run after it (Fixed Decision 3) but must not implement it.

## Implementation Steps

1. Read `App/packages/vue/src/shared/input/select/hover.ts`, `App/packages/vue/src/shared/input/radius.ts`, and `App/packages/vue/src/canvas/useCanvasInput.ts` in full before editing.
2. In `hover.ts`, add a function `getRadiusCursorForSelection(cx, cy, editor)` mirroring `getResizeCursorForSelection`'s shape: iterate `editor.state.selectedIds`, for each resolve the node, call `hitTestRadiusControlByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom ?? 1)`, and return `'grab'` on the first non-null hit, else `null`. Single-selection is sufficient (`tryStartRadius` already restricts drag-start to `selectedIds.size === 1`), but iterating the set costs nothing extra and matches the existing resize helper's shape exactly - do not special-case size.
3. In `updateHoverCursor`, insert the new check in the existing `??` chain, after wherever the progressive-blur check lives (add it first in this chain if T-041 has not landed yet - see Fixed Decision 3) and before `getResizeCursorForSelection`:
   ```ts
   const cursor =
     getRadiusCursorForSelection(cx, cy, editor) ??
     getResizeCursorForSelection(cx, cy, editor) ??
     getRotationCursorForSelection(cx, cy, editor)
   ```
4. In the radius drag-start path (`select.ts:53-58`, inside `handleSelectDown`, or immediately after `setDrag(radiusDrag)` back in `useCanvasInput.ts`'s `onMouseDown` - pick whichever file already has `cursorOverride` in scope with the least plumbing), set `cursorOverride.value = 'grabbing'` right after `setDrag(radiusDrag)`.
5. Confirm (read, do not guess) that `onMouseUp` and the `Escape` handler in `useCanvasInput.ts` already null `cursorOverride` for `drag.value.type === 'radius'` - they do, via the shared `cursorOverride.value = null` at the end of each branch (lines 493-494 for normal release, 540-541 for `Escape`). No change needed there.
6. Add `App/tests/engine/vue/input/radius-cursor.test.ts` following `App/tests/engine/vue/input/auto-layout-hover.test.ts`'s pattern: build a minimal `SceneNode` (`RECTANGLE`, known `x/y/width/height/rotation`) and a minimal `Editor`-shaped object exposing `state.selectedIds`, `graph.getNode`, `renderer?.zoom`, then assert:
   - `getRadiusCursorForSelection` returns `'grab'` when `(cx, cy)` lands inside a corner's hit circle (compute the expected point via `getRadiusControlPosition` from `radius.ts`, already exported).
   - Returns `null` when `(cx, cy)` is outside every corner's hit circle, including a point just past the `HANDLE_HIT_RADIUS` boundary.
   - Returns `'grab'` correctly at a non-1 zoom (confirm the zoom-compensated hit radius, e.g. `zoom = 2`).
7. Run, in order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on the changed files
   - `bun test tests/engine/vue/input/radius-cursor.test.ts`

## Acceptance Criteria

- [ ] Hovering a corner-radius handle on a selected `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION` node shows `cursor: grab`.
- [ ] Starting a radius drag switches the cursor to `cursor: grabbing`, and it stays `grabbing` even if the pointer moves outside the handle's hit circle during the drag.
- [ ] Releasing (or cancelling with Escape) the drag returns the cursor to whatever it would be for the pointer's current position (resize/rotation/default), matching the existing release behaviour for resize and rotation drags.
- [ ] The radius cursor check does not shadow or get shadowed by the resize/rotation cursor checks in a way that changes their existing behaviour when a radius handle is not hit.
- [ ] No new SVG asset, no new hit-test constant, no change to `radius.ts`'s drag logic.
- [ ] Nothing in the Banned List appears in the diff.

## Verification

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- Focused Oxlint over `packages/vue/src/shared/input/select/hover.ts`, `packages/vue/src/canvas/useCanvasInput.ts` (and `select.ts` if touched), plus the new test file.
- `bun test tests/engine/vue/input/radius-cursor.test.ts` from `App/`; expect exit code `0`.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command per the delivery policy.

## Stop Conditions

- Stop if `editor.renderer?.zoom` is undefined at the point `getRadiusCursorForSelection` needs it during a genuine hover (not just in the test harness) - the existing resize/rotation helpers already default to `?? 1`, so mirror that; if the real hover path can reach this function with no renderer at all, report it rather than guessing a fallback.
- Stop if T-041 has already landed and its progressive-blur cursor check is not where this packet expects it in `updateHoverCursor` - reconcile the two `??` chains by reading T-041's actual diff rather than guessing an order.
- Stop and report if setting `cursorOverride` at drag start in both `select.ts` and `useCanvasInput.ts` turns out to be unavoidable (e.g. because of a timing issue) - Fixed Decision 4/Implementation Step 4 require picking exactly one site.

## Revision History

- Revision 1 - 2026-08-15: expanded against live cursor-assignment, radius-handle, and gradient-stop-cursor source; settled both of the stub's Expansion Questions with a direct precedent already in the codebase (`GradientEditor.vue`'s `grab`/`grabbing` pair) rather than leaving them open.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-15: built-in grab on hover and grabbing during drag via setDrag/updateHoverCursor; tsgo, vue-tsc, focused Oxlint, and 5/5 Bun tests green)
