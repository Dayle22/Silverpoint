# T-038 - Keep a colour-picker edit when the picker is dismissed by clicking away

Task ID: T-038
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: nothing (independent of T-032/T-033/T-035/T-036)
Prepared from: the user's 2026-08-14 report — "whenever i change the fill of an object by dragging on the hsl window and then i click out of the window, the fill reverts back"
Expanded at: 2026-08-14, against the live running app (`bun run dev`, port 1420) with the defect reproduced and the fix proven in the browser
Expansion note: the defect, its exact cause and the exact fix are all recorded below. This is a **one-line source change plus tests**. If the implementation grows beyond that, stop — see Stop Conditions.

## Intended Outcome

Drag a colour in the fill picker, then click on empty canvas to dismiss the picker. The object keeps the colour you just dragged to. Undo still reverts the whole picker session in one step, and Escape still cancels it.

## The Defect, Reproduced

Reproduced live on 2026-08-14 against `App` on `http://localhost:1420`:

1. Draw a rectangle (default fill `rgb 0.83, 0.83, 0.83`) and select it.
2. Open the Fill swatch in the Properties panel and drag inside the saturation/brightness area. The canvas and the node both update — node fill becomes `r 0.2857, g 0.0669, b 0.0669`.
3. Click on empty canvas to dismiss the picker.
4. **The fill snaps back to `0.83, 0.83, 0.83`.** The edit is gone from the document, not merely from the panel.

Instrumented event order for step 3 (timings in ms from the same run):

```
pointerdown dispatched on [data-test-id="canvas-element"]   475.7
pointerdown handler returned  (selection is already empty)  476.8
UndoManager.rollbackBatch()                                 483.4
picker popover removed from the DOM                         487.3
```

The canvas clears the selection **synchronously inside the pointerdown**. The popover's own close notification arrives ~11ms later, after Vue has already flushed the unmount — so the commit that was supposed to save the edit runs when there is nothing left to commit.

## Verified Starting State — why it reverts

| Path | What it does today |
| --- | --- |
| `App/src/components/properties/FillSection.vue:107` | `@open-change="!$event && commitPaintMutation(binding.actions)"` — the picker's edit is only committed when the popover reports that it closed. |
| `App/src/components/properties/FillSection.vue:108` | `@cancel="cancelPaintMutation(binding.actions)"` — Escape, and only Escape, cancels. |
| `App/src/components/properties/paint/binding.ts` | `applyPaintMutation` → `flush()` then `actions.beginMutation('edit')` then the update. Every drag frame lands inside one open undo batch. |
| `App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue:148` | `beginMutation` opens the provider batch: `beginProviderBatch(batchLabel)` → `editor.undo.beginBatch('Change fill color')`. |
| `App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue:191-196` | `cancelMutation` → `rollbackBatch()` → every entry in the open batch is inverted. **This is what erases the colour.** |
| `App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue:241` | `onBeforeUnmount(cancelMutation)` — **the defect.** An unmount is treated as a cancellation. |
| `App/src/components/properties/PropertyListRoot.vue:31` | `v-if="context.active.value"` — when the selection empties, this subtree unmounts, taking `BindableValueRoot` with it and firing the hook above. |
| `App/packages/vue/src/controls/undo-batch/use.ts:31` | `ensure()` early-returns while `undo.isBatching`, so the property list never opens a competing batch during a picker session. Nothing else is holding the edit. |

Same wiring, same defect, in `App/src/components/properties/StrokeSection.vue:130-131`. Fixing the shared primitive fixes both.

## Fixed Decision

**An unmount is not a cancellation.** Abandoning a control by clicking away is the normal way people finish an edit; the last value the user saw must survive. Only an explicit cancel — Escape — may roll back.

The fix is therefore in the shared primitive, not in `FillSection`:

`App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue`, last line of `<script setup>`:

```diff
-onBeforeUnmount(cancelMutation)
+onBeforeUnmount(commitMutation)
```

This is safe and sufficient because:

- `commitMutation` and `cancelMutation` both no-op when `interactionActive` is false, so Escape (which cancels first) still wins — the later unmount commit does nothing.
- `UndoManager.commitBatch()` discards an empty batch, so an unmount with no edits pushes no history entry.
- Both pop exactly one batch, so the undo manager is left balanced either way — the safety-net purpose of the original hook is preserved.
- A `detach-on-edit` unbind performed for the interaction now persists, which is exactly what a normal popover-close commit already does. No new behaviour.

**This fix was applied and verified in the running app during expansion, then reverted.** Verified with the fix in place, same repro:

- After click-away the fill stayed at `r 0.2857, g 0.0669, b 0.0669`.
- A single undo restored `0.83, 0.83, 0.83` — the picker session is still one undo step.
- Escape during a drag still restored `0.83, 0.83, 0.83`.
- `undo.isBatching` was `false` afterwards in every case — no dangling batch.

## Allowed Changes

- The one line in `App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue`.
- New focused tests only (see Implementation Steps).
- Nothing else.

## Restrictions and Exclusions — binding

- **Do not** change `FillSection.vue`, `StrokeSection.vue`, `PropertyListRoot.vue`, `paint/binding.ts`, `undo-batch/use.ts`, `UndoManager`, or any picker component.
- **Do not** change the picker's markup, layout, spacing, classes, icons, colours or copy. This packet has **no visual change whatsoever**; a diff containing any Tailwind class is wrong.
- **Do not** add state: no Pinia store, no module-level `ref`, no watcher, no event bus, no `provide/inject`.
- **Do not** add a `pointerdown` listener, a document-level guard, a `setTimeout`, a `nextTick`, or any ordering hack to make the popover close before the deselect. The ordering is not the bug; treating unmount as cancel is.
- **Do not** make the Properties panel stay mounted when nothing is selected.
- **Do not** add a dependency.
- **Do not** bump any version or touch `package.json`, `desktop/tauri.conf.json` or `desktop/Cargo.toml`. No build, installer or delivery work.
- **Do not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.

## Implementation Steps

1. Read `App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue` in full, especially `beginMutation`, `commitMutation`, `cancelMutation` and the `onBeforeUnmount` line.
2. Apply the one-line change from Fixed Decision. Nothing else in that file changes.
3. Add a Playwright regression test to the existing `App/tests/e2e/color-picker/basic.spec.ts` (it already has `getSelectedFill()` and the `CanvasHelper` setup — reuse them, do not create a new spec file or new helpers):
   - draw a rectangle, open the fill swatch, drag inside the saturation/brightness area, read the fill;
   - click empty canvas to dismiss;
   - assert the fill still equals the dragged value and that the selection is now empty;
   - assert one undo restores the pre-drag fill;
   - assert that a separate run cancelled with Escape still restores the pre-drag fill.
4. Add the same click-away assertion for the **stroke** picker, using `StrokeSection`'s swatch, to prove the shared-primitive fix covers both.
5. Run, in this order, and paste exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
   - focused Oxlint on the changed files only
   - the focused Playwright spec with `--project=openpencil`
6. Do not claim desktop delivery. This packet stops at source gates plus the focused Playwright run.

## Acceptance Criteria

- [x] Dragging a colour in the fill picker and then clicking empty canvas keeps the dragged colour on the node.
- [x] The same is true for the stroke picker.
- [x] Escape during a picker drag still reverts to the pre-drag colour.
- [x] One undo after a kept edit restores the pre-drag colour — the picker session remains a single undo step.
- [x] `editor.undo.isBatching` is `false` after every one of those paths (proven at expansion time in the live browser; the Playwright tests prove the observable outcome).
- [x] The source diff is exactly one changed line (plus its explanatory comment) and tests.
- [x] No visual change: the diff contains no CSS, no Tailwind class, no markup edit.
- [x] Nothing in Restrictions and Exclusions appears in the diff.
- [ ] Installed OpenPotlood proves the fix. NOT PERFORMED.

## Verification

Performed on 2026-08-14.

Source change: `onBeforeUnmount(cancelMutation)` → `onBeforeUnmount(commitMutation)` in
`App/packages/vue/src/primitives/BindableValue/BindableValueRoot.vue`, with a comment recording why.

Tests added to `App/tests/e2e/color-picker/basic.spec.ts` (no new spec file, no new helper module):

- `fill survives dismissing the picker by clicking empty canvas`
- `escape during a picker drag still cancels the edit`
- `stroke survives dismissing the picker by clicking empty canvas`

Observed fill values (rgba, hue 0 default grey → dragged to saturation 0.85 / brightness 0.85):
before `0.83, 0.83, 0.83, 1` → after drag `0.85, 0.1275, 0.1275, 1` → after click-away `0.85, 0.1275, 0.1275, 1`
→ after one undo `0.83, 0.83, 0.83, 1`. Escape path: after drag `0.85, 0.1275, 0.1275, 1` → after Escape
`0.83, 0.83, 0.83, 1`. Stroke path matched the fill path.

Gates, with exit codes:

- `bunx tsgo --noEmit --pretty false` — 0
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` — 0
- `bunx oxlint -c oxlint.json` on both changed files — 0 warnings, 0 errors
- `bunx playwright test tests/e2e/color-picker/basic.spec.ts --project=openpencil` — **10/10 passed**

Both new click-away tests were confirmed to **fail with the fix reverted** (fill: expected `0.83…`, received
`0.85, 0.1275, 0.1275`; stroke: same), so they are real regression tests rather than tautologies.

Not performed: `bun run check`, `bun run test`, `bun run test:unit`, desktop build, installer, installed
identity or launch.

### Pre-existing failures, baselined — not caused by this change

Each of these was re-run with the fix reverted and failed **identically**, so they are unrelated:

| Spec | Test |
| --- | --- |
| `properties/corner-stroke-toggles.spec.ts:71` | multi-selection independent corners toggle is one undo step |
| `properties/effects.spec.ts:289` | smoothed corners with blended shadow (image snapshot) |
| `properties/number-field.spec.ts:85` | NumberField exposes mixed state through canonical data attributes |
| `properties/panel.spec.ts:113` | fill color can bind an existing variable |
| `properties/panel.spec.ts:306` | bound NumberField detach edit is one undo step |
| `properties/visibility.spec.ts:8` | fill visibility supports repeat click and undo redo |
| `color-picker/demo-card.spec.ts:85,101` | demo card fill changes (element not found) |

The binding-lifecycle tests most exposed to this change **pass** with the fix applied:
`panel.spec.ts:185` (bound fill picker opens non-destructively and Escape rolls back colour edits),
`panel.spec.ts:239`, `panel.spec.ts:265`.

### Adjacent defect found, not fixed here

Several of the pre-existing failures above share one cause: `CanvasHelper.undo()` sends `Meta+z`, but
`edit.undo` binds `$mod+KeyZ`, which tinykeys resolves to **Control** off Apple platforms — so on this
Windows workspace the helper's keypress reaches nothing and every assertion that depends on it fails. The
new test in this packet presses the platform's own modifier instead of using the helper. Fixing the helper
itself is out of this packet's scope.

## Integration or Installed-Result Check

Not required by this packet. If the user later asks for delivery, the installed build must show the fill surviving a click-away in the installed app.

## Stop Conditions

Stop and report if: the one-line change does not hold the fill in the running app; committing on unmount leaves `isBatching` true or produces a stray undo entry; the number-field binding path (`VariableNumberField.vue` → `NumberFieldRoot`) regresses because it relied on unmount-cancel; or the fix appears to need any change outside `BindableValueRoot.vue`.

## Execution Report Contract

Record: the exact diff, the Playwright test names added, the fill values observed before drag / after drag / after click-away / after undo / after Escape for both fill and stroke, `isBatching` after each path, every command run with its exit code, and every check left unperformed.

## Revision History

- Revision 1 — 2026-08-14: created and expanded in one pass. Defect reproduced live, root cause traced to `onBeforeUnmount(cancelMutation)`, fix applied and verified in the running app, then reverted so implementation can land it under this packet.
- Revision 2 — 2026-08-14: implemented at the user's instruction in the same session. One-line fix landed with three Playwright regression tests; source gates and 10/10 focused Playwright green; adjacent failures baselined as pre-existing; `CanvasHelper.undo()`'s wrong modifier recorded as an adjacent defect. No desktop delivery.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Implemented, not delivered (2026-08-14: `onBeforeUnmount(cancelMutation)` → `commitMutation` in `BindableValueRoot.vue`, covering the fill and stroke pickers; three new Playwright regression tests in `color-picker/basic.spec.ts`, each confirmed to fail with the fix reverted. Gates green: `tsgo`, `vue-tsc` on `packages/vue`, focused Oxlint, 10/10 focused Playwright. Seven adjacent failures re-run with the fix reverted and shown to be pre-existing. No `bun run check`, build, install or installed identity — no desktop delivery is claimed)
