# T-050 - Corner-radius values default to whole numbers

Task ID: T-050
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-004 (corner-radius node controls; already DONE and confirmed live)
Related: T-040 (corner-radius cursor - touches the same drag seam but a different concern), T-062 (selection outline fidelity - touches the same overlay file but a different function)
Prepared from: `Plan/Packets/T-050-integer-corner-radius-values.md` (brief) and the user's screenshot of a radius field reading `70.710678118655`
Expanded at: 2026-08-15
Expanded against: `App/packages/vue/src/shared/input/radius.ts`, `App/packages/vue/src/shared/input/move.ts`, `App/packages/vue/src/shared/input/resize.ts`, `App/packages/vue/src/shared/input/resize/rect.ts`, `App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue`, `App/packages/vue/src/primitives/NumberField/NumberFieldValue.vue`, `App/packages/vue/src/controls/number-expression/evaluate.ts`, `App/src/components/inputs/NumberField.vue`, `App/src/components/properties/AppearanceSection.vue`, `App/packages/core/src/canvas/overlays/selection.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`, `App/tests/engine/editor/corner-radius-controls.test.ts`
Delivery: source gates only

## Intended Outcome

Dragging a corner-radius handle produces a whole-number radius, matching the whole-pixel convention every other geometry drag (move, resize) in this codebase already follows. Typing a fractional radius directly into the field remains fully supported and untouched.

## Request Coverage

- Corner-radius values should not be long decimals by default.

## Verified Starting State

### Root cause - confirmed, one line

`App/packages/vue/src/shared/input/radius.ts`, `calculateRadiusFromLocalPointer` (lines 99-117):

```ts
const direction = CORNER_DIRECTIONS[corner]
const length = Math.SQRT2
const deltaX = currentX - startX
const deltaY = currentY - startY
const projectedDelta = (deltaX * direction.x + deltaY * direction.y) / length
return Math.max(0, originalRadius + projectedDelta)
```

This projects the pointer's movement onto the corner's inward 45° diagonal by dividing by `Math.SQRT2` **unconditionally**, regardless of whether the drag itself moved along that diagonal. A pure horizontal or vertical drag - the overwhelmingly common case, since users drag toward or away from the shape rather than along an exact 45° line - produces `deltaX/√2` or `deltaY/√2`, which is irrational for any non-zero integer pixel delta. The screenshot's `70.710678118655` is exactly `100/√2` (`100 / 1.4142135623730951 = 70.71067811865474…`): a 100px horizontal or vertical pointer movement with `originalRadius = 0`.

The value is then read straight off the node by `commitRadiusDrag` (lines 219-235) with no rounding anywhere in between, and written to the document via `editor.updateNodeWithUndo`.

### Where the digit count comes from - the shared display-formatting layer

The exact string `70.710678118655` (14 significant digits) is not the raw JS float (`70.71067811865474…`, 16-17 significant digits as `console.log` would show it) - it is what the **shared** numeric-field display formatter produces:

- `App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue:57-59`:
  ```ts
  const displayValue = computed(() =>
    isMixed.value ? '' : String(normalizeNumberValue(numericValue.value))
  )
  ```
- `App/packages/vue/src/controls/number-expression/evaluate.ts:129-131`:
  ```ts
  export function normalizeNumberValue(value: number): number {
    return Number.isFinite(value) ? Number.parseFloat(value.toPrecision(14)) : value
  }
  ```

`(100 / Math.SQRT2).toPrecision(14)` is `"70.710678118655"` - matching the screenshot digit-for-digit. `normalizeNumberValue` is consumed by every `NumberFieldRoot` instance, i.e. **every numeric property field in the app** (position, size, rotation, opacity, radius, stroke width, and so on) - confirmed via `App/src/components/inputs/NumberField.vue:82-92`, which passes its `modelValue` straight into `NumberFieldRoot`, and `App/src/components/properties/AppearanceSection.vue:129-156`, where the corner-radius field is one `VariableNumberField`/`NumberField` among many built the same way. This is purely a floating-point noise cleanup (limiting to 14 significant digits so binary rounding error like `0.1 + 0.2` does not print `0.30000000000000004`) - it does not round to whole numbers, and it is working exactly as designed.

**Conclusion: one shared component (`normalizeNumberValue`) governs numeric-field display precision for every numeric property, and it is not the bug.** The bug is that `calculateRadiusFromLocalPointer` is the only one of the three drag-computed geometry functions in `shared/input/` that performs no whole-pixel rounding at all before the value reaches the graph.

### The established codebase precedent: move and resize already round to whole pixels

Every other pointer-driven geometry drag in `packages/vue/src/shared/input/` already rounds its computed value to the nearest whole pixel, at both the live-preview and the commit step, unconditionally (no modifier bypasses rounding - only snapping has a bypass flag):

| File | Rounds | Applies during |
| --- | --- | --- |
| `move.ts:90, 103` | `Math.round(orig.x + dx)` / `Math.round(orig.y + dy)` | live preview (`updateNodePositionPreview`) |
| `move.ts:131` | `Math.round(orig.x + dx)` / `Math.round(orig.y + dy)` | commit (`applyFinalPositions`) |
| `resize/rect.ts:74-77` | `Math.round(x)`, `Math.round(y)`, `Math.round(width)`, `Math.round(height)` | every call to `resizeChanges`, i.e. both preview and commit |
| `resize.ts:153-157` | `Math.round(...)` on scaled child `x`/`y`/`width`/`height` | preview and commit of proportional child resize |

`radius.ts` is the outlier. No file in `shared/input/` stores an intentionally fractional drag-computed value.

### Modifier-key interaction today - none

`App/packages/vue/src/canvas/useCanvasInput.ts:352-356`:

```ts
if (d.type === 'radius') {
  applyRadiusDrag(d, cx, cy, editor)
  return
}
if (d.type === 'progressive-blur') {
  applyProgressiveBlurDrag(d, cx, cy, editor, e.shiftKey)
  return
}
```

`applyRadiusDrag` is called with no modifier flags at all - unlike the adjacent `progressive-blur` drag, which does receive `e.shiftKey`. There is no Shift/Alt/Ctrl interaction with corner-radius dragging today, and no existing snapping/quantisation step of any kind runs on the radius value - `calculateRadiusFromLocalPointer` is the entire computation.

### Typing a fractional radius today - already works, untouched by this fix

`NumberFieldRoot`'s edit path (`startEdit` → `setDraft`/`onInput` → `commitEdit` → `evaluateNumberExpression`) never calls `calculateRadiusFromLocalPointer`; it parses the typed expression directly and applies `normalizeNumberValue` (14 significant digits, not integer rounding) to the result. `App/src/components/properties/AppearanceSection.vue:129-156` sets `:min="0"` on the radius field but no `step`, so the field's default `step = 1` (`NumberFieldRoot.vue:32`) only affects arrow-key nudging, not typed or pasted values. Typing `12.5` into the radius field today produces `12.5`, unchanged by this fix.

### The one call site to change

`App/packages/vue/src/shared/input/radius.ts:202-217` (`applyRadiusDrag`):

```ts
export function applyRadiusDrag(d: DragRadius, cx: number, cy: number, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (!local) return
  const next = calculateRadiusFromLocalPointer(
    d.corner, d.startLocalX, d.startLocalY, local.x, local.y,
    radiusForCorner(d.corner, d.original)
  )
  editor.graph.updateNodePreview(d.nodeId, getRadiusChanges(d.corner, d.original, next))
  editor.requestRepaint()
}
```

`commitRadiusDrag` (lines 219-235) reads the radius back off the **live node** (`node.cornerRadius` / `node[RADIUS_FIELD_BY_CORNER[d.corner]]`), which `applyRadiusDrag` already wrote via `updateNodePreview` on every pointer move. Rounding `next` once in `applyRadiusDrag`, mirroring exactly where `move.ts` rounds (`Math.round(orig.x + dx)` at the same call site that feeds `updateNodePositionPreview`), therefore fixes both the live preview shown during the drag and the final committed value with a single change - `commitRadiusDrag` needs no edit of its own.

### Overlay drawing - not a change site

`App/packages/core/src/canvas/overlays/selection.ts:198-213` (`drawRadiusHandles`) only draws the four handle circles from `node.width`/`node.height` and a fixed screen inset; it does not read or display the radius value and needs no change. Noted per the brief's anchor, ruled out as in-scope.

## Fixed Decisions

1. **Round at the source (the drag computation), not only at display - by rounding `next` to the nearest whole pixel in `applyRadiusDrag`, immediately after `calculateRadiusFromLocalPointer` returns.**
   Reason: this matches the codebase's own established convention for every other pointer-driven geometry value (`move.ts`, `resize.ts`, `resize/rect.ts` - see table above), all of which round at the point the computed value is written to the graph, for both preview and commit, unconditionally. Display-only rounding would leave `move`/`resize` and `radius` behaving inconsistently - two shapes dragged to visually identical whole-pixel positions would have one exact and one carrying 14-sig-fig noise underneath - and would fight `normalizeNumberValue`, which is a precision cleanup, not a rounding policy, and is shared by every numeric field (changing its behavior would be out of this packet's scope; not changing it while leaving the true value fractional would keep the long-decimal defect intact for anything that reads the raw value instead of the display string, e.g. `.fig` export). Rounding at the source is also the smaller, single-call-site change: one line in `applyRadiusDrag`, versus adding a rounding step to `NumberFieldRoot`'s shared display path that would need scoping to avoid affecting every other numeric field.
2. **Round with `Math.round`, matching `move.ts`/`resize.ts` exactly - no fractional-pixel quantisation step (e.g. rounding to `0.5`) and no new constant.** The existing codebase precedent is whole-pixel rounding, not half-pixel; introducing a different granularity for radius alone would be an unjustified inconsistency.
3. **`.fig` round-trip consequence: corner-radius values will now serialise and re-import as whole numbers when produced by a drag, exactly as `x`/`y`/`width`/`height` already do for move and resize.** A `.fig` file containing a genuinely fractional radius (imported from Figma, or typed by the user in this app) is untouched - rounding only happens inside the drag path, never on load, save, or typed/pasted entry. This is consistent with how `move`/`resize` already round drag-computed geometry while leaving typed or imported fractional `x`/`y`/`width`/`height` alone.
4. **A fractional radius remains fully typeable.** No change touches `NumberFieldRoot`, `normalizeNumberValue`, or any field's `min`/`step`/`editPolicy` props. This is an acceptance criterion, not just an observation - see below.
5. **No modifier-key behavior is added.** The brief asked whether Shift or another modifier already interacts with radius snapping/quantisation - it does not, and this packet does not add one. `progressive-blur` dragging already takes `e.shiftKey` for its own purpose (angle snapping - `App/packages/vue/src/shared/input/progressive-blur.ts:103`); radius dragging has no analogous need and this packet does not invent one.

## Open Decisions

None. The brief's four Expansion Questions are all settled above: the source of the long decimal (Fixed Decision context / Verified Starting State), commit-vs-display rounding (Fixed Decision 1), whether other fields are affected (no - see the shared-component analysis above), and deliberate fractional entry (Fixed Decision 4, already true today and unaffected).

## Allowed Changes

- `App/packages/vue/src/shared/input/radius.ts` - round `next` in `applyRadiusDrag` before it is passed to `getRadiusChanges`.
- `App/tests/engine/editor/corner-radius-controls.test.ts` - update the two integration tests whose assertions currently expect a fractional committed radius (`toBeCloseTo(33.46, 1)` and `toBeCloseTo(41.46, 1)`, see Implementation Steps) to expect the rounded whole-number result instead.
- No other files.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT change `calculateRadiusFromLocalPointer`.** It is a pure geometry function with its own direct unit test (`corner-radius-controls.test.ts:52-67`, `toBeCloseTo(8 + Math.sqrt(200), 5)`) that must keep passing unmodified - the rounding belongs at the call site in `applyRadiusDrag`, exactly mirroring how `move.ts` rounds at its call site rather than inside a shared delta-computation helper.
- **Do NOT change `commitRadiusDrag`, `cancelRadiusDrag`, `tryStartRadius`, `getRadiusChanges`, `hitTestRadiusControlByMatrix`, or any other exported function in `radius.ts`.** `commitRadiusDrag` reads the already-rounded live node value; it needs no edit.
- **Do NOT change `NumberFieldRoot.vue`, `normalizeNumberValue`, or any other numeric-field primitive.** The defect is local to the radius drag path; the shared display-formatting layer is working as designed and is out of scope (see Fixed Decision 1's reasoning).
- **Do NOT add a modifier-key (Shift/Alt/Ctrl) interaction to radius dragging.** None exists today and none is requested (Fixed Decision 5).
- **Do NOT touch `App/packages/core/src/canvas/overlays/selection.ts`.** `drawRadiusHandles` does not display the radius value; this is T-062's file for an unrelated concern.
- **Do NOT change `AppearanceSection.vue`, `VariableNumberField.vue`, or any field's `min`/`step`/`editPolicy` props.**
- **Do NOT round to anything other than the nearest whole pixel** (no `0.5` or other quantisation step - Fixed Decision 2).

## Implementation Steps

1. Read `App/packages/vue/src/shared/input/radius.ts` in full (already quoted above) and `App/packages/vue/src/shared/input/move.ts:83-108` for the precedent shape before editing.
2. In `applyRadiusDrag` (`radius.ts:202-217`), wrap the result of `calculateRadiusFromLocalPointer(...)` in `Math.round(...)` before it is assigned to `next`:
   ```ts
   const next = Math.round(
     calculateRadiusFromLocalPointer(
       d.corner,
       d.startLocalX,
       d.startLocalY,
       local.x,
       local.y,
       radiusForCorner(d.corner, d.original)
     )
   )
   ```
3. Run `App/tests/engine/editor/corner-radius-controls.test.ts` and update the two now-failing assertions:
   - `'commits one uniform radius undo step and redo restores the final value'` (around line 140/148): `expect(changed?.cornerRadius).toBeCloseTo(33.46, 1)` → replace with `expect(changed?.cornerRadius).toBe(Math.round(8 + <the same geometric delta the test's `finalPoint` produces>))`. Compute the expected integer by running the updated `applyRadiusDrag` in the test itself (or by rounding the previously-observed `33.46` to `33`) - confirm against the actual rounded output rather than hand-deriving it, since the drag goes through a rotated/matrix-mapped coordinate path. Do the same for the redo assertion two lines below.
   - `'independent mode commits only the selected corner'` (around line 179): `expect(editor.graph.getNode(node.id)?.bottomRightRadius).toBeCloseTo(41.46, 1)` → replace with `toBe(41)` (confirm the rounded value the same way).
   - Leave the `'projects %s movement onto its inward diagonal'` test (lines 52-67, calls `calculateRadiusFromLocalPointer` directly, not `applyRadiusDrag`) and the `'clamps invalid and outward movement'` test (lines 69-72) unchanged - they do not go through the new rounding.
4. Add one new focused assertion (in the same file, near the existing commit test) that a horizontal-only drag of exactly 100 local px with `originalRadius = 0` commits to a whole number (`cornerRadius` is an integer, e.g. `expect(Number.isInteger(changed.cornerRadius)).toBe(true)`), reproducing the screenshot's reported case directly.
5. Run, in order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false` from `App/`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`
   - focused Oxlint on `packages/vue/src/shared/input/radius.ts` and the touched test file
   - `bun test tests/engine/editor/corner-radius-controls.test.ts` from `App/`

## Acceptance Criteria

- [x] Dragging any of the four corner-radius handles on a `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION` node produces a whole-number radius in both the live preview and the committed value - reproducing the screenshot's horizontal-drag case now yields an integer, not `70.710678118655`.
- [x] Typing a fractional value (e.g. `12.5`) directly into the corner-radius field still commits exactly that fractional value - unaffected by this change.
- [x] `calculateRadiusFromLocalPointer`'s own unit test (lines 52-67) and the clamp test (lines 69-72) pass unmodified.
- [x] The two integration tests that previously asserted a fractional committed radius now assert the rounded whole-number result.
- [x] Cancel (`cancelRadiusDrag`) still restores the exact original (possibly fractional) radius - unaffected, since it restores from `d.original`, not from the rounded drag path.
- [x] No change to `NumberFieldRoot.vue`, `normalizeNumberValue`, any other `shared/input/` file, or `overlays/selection.ts`.

## Verification

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- Focused Oxlint over `packages/vue/src/shared/input/radius.ts` and `tests/engine/editor/corner-radius-controls.test.ts`.
- `bun test tests/engine/editor/corner-radius-controls.test.ts` from `App/`; expect exit code `0`.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command per the delivery policy.

## Stop Conditions

- Stop if rounding in `applyRadiusDrag` causes the live preview to visibly jitter or snap unpleasantly during a slow drag (i.e. whole-pixel rounding feels worse in practice than in the analogous `move`/`resize` cases) - report it rather than adding a different quantisation step unilaterally, since `move.ts`/`resize.ts` set the only precedent this packet is authorized to follow.
- Stop and report if any test beyond the two named in Implementation Step 3 starts failing after the change - that would mean the rounding point chosen (`applyRadiusDrag`) has a wider effect than this packet's analysis found.

## Status record

Status: **Done**

Executed: 2026-08-21. Rounded `next` in `applyRadiusDrag` via `Math.round(calculateRadiusFromLocalPointer(...))` in `App/packages/vue/src/shared/input/radius.ts`. Updated unit test assertions in `App/tests/engine/editor/corner-radius-controls.test.ts` and added direct assertion for horizontal-only 100px drag integer output. All gates (`tsgo`, `vue-tsc`, `oxlint`, `bun test`) passed with exit code 0.
