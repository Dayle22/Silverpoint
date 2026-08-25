# T-074 - Layer-panel drag feedback

Task ID: T-074
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-070d1 through T-070d3 (workspace-panel dragging; explicitly excluded)
Prepared from: reported layer-drag feedback defect, 2026-08-21 brief
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: Plan/plan.md; App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts; App/src/components/LayerTree/LayerTreeNodeRow.vue; App/src/components/LayerTree/LayerTreeDropIndicator.vue; App/tests/e2e/layers/reorder.spec.ts; App/playwright.config.ts; App/package.json
Delivery: focused Playwright source gate plus browser check
Execution size: 2 core implementation files; 1 E2E file across 1 suite; one responsibility

## Intended Outcome

While a layer is dragged, the preview must exactly describe the legal operation: a top or bottom insertion line for sibling ordering, a bounded child-target outline for nesting, and a subdued source row. A drop onto the source or one of its descendants must show no preview and make no hierarchy change. Feedback clears after leave, drop and cancellation.

## Request Coverage

- Above/below provide an unambiguous insertion indicator; make-child has a distinct bounded target highlight; the dragged source is subdued.
- Render feedback from the existing drag instruction and target ID; do not invent a second drop target in the component.
- Preserve ordering, nesting, auto-expand-on-child-drop and undo; test legal operation previews and matching commits, plus a blocked descendant drop.

## Verified Starting State

| Path | Symbol / selector | Verified use |
| --- | --- | --- |
| `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts:27-142` | `useLayerDrag(editor, indentPerLevel, onMakeChildDrop?)` | Owns reactive `draggingId`, `instruction` and `instructionTargetId`; `onDrag` maps Atlaskit instructions into these refs; its monitor commits `reorder-above`, `reorder-below`, or `make-child`. |
| `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts:68-90` | `dropTargetForElements` | Current `canDrop` rejects only `source.data.id === data.id`; it does **not** reject a source dragged onto its own descendant. `onDrag` suppresses only Atlaskit's `instruction-blocked`, so that illegal descendant target can presently receive a visible preview. |
| `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts:98-132` | `monitorForElements({ onDrop })` | Retains a defence-in-depth `editor.graph.isDescendant(targetId, sourceId)` early return before graph mutation. Do not remove it when moving the rule into `canDrop`. |
| `App/packages/vue/src/primitives/LayerTree/LayerTreeRoot.vue:30-34, 210-235` | `useLayerDrag` / `provideLayerTree` | Supplies exactly the three refs and `setupDrag` to items; no new store or command is needed. |
| `App/src/components/LayerTree/LayerTreeNodeRow.vue:31-83` | `LayerTreeNodeRow` | Existing row uses `opacity-30` for `chrome.draggingId === node.id`; it renders `LayerTreeDropIndicator` with active target, instruction, level and indent. |
| `App/src/components/LayerTree/LayerTreeDropIndicator.vue:4-33` | `LayerTreeDropIndicator` | Existing UI already renders `make-child` as `inset-y-1 rounded border border-accent bg-accent/10`; reorder instructions are `h-0.5 bg-accent`, top for above and bottom for below. |
| `App/tests/e2e/layers/reorder.spec.ts:13-82` | existing layer DnD E2E seam | Proves above reorder and make-child commit with `Locator.dragTo`, but has no mid-drag visual-state or blocked-descendant regression coverage. This, not `layers/panel.spec.ts`, is the correct test seam. |
| `App/playwright.config.ts:20-58` | `openpencil` project | Uses `data-test-id`, 1280x800 dark Chromium and starts/reuses `bun run dev` at port 1420. |

The installed Atlaskit type contract confirms `onDrop` fires whenever a drag ends, including cancellation (`App/node_modules/@atlaskit/pragmatic-drag-and-drop/dist/types-ts4.5/internal-types.d.ts:223-231`). The tree hitbox maps a row's upper quarter to `reorder-above`, lower quarter to `reorder-below`, and the middle to `make-child` (`App/node_modules/@atlaskit/pragmatic-drag-and-drop-hitbox/dist/cjs/tree-item.js:23-39`).

## Read First

1. `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts:36-142` - target eligibility, state cleanup and the authoritative mutation path.
2. `App/src/components/LayerTree/LayerTreeNodeRow.vue:31-83` and `App/src/components/LayerTree/LayerTreeDropIndicator.vue:12-33` - existing feedback styling that the fix must preserve.
3. `App/tests/e2e/layers/reorder.spec.ts:5-82` - existing fixture, graph readback helper and native `dragTo` commit proof.

## Corrections to the Brief

- The requested feedback visuals already exist in the live application; this packet must not reimplement them.
- `App/tests/e2e/layers/panel.spec.ts` is a general layer-panel test and contains no drag coverage. Extend `App/tests/e2e/layers/reorder.spec.ts` instead.
- The brief's blocked-drop claim is not true today: descendants can receive a preview. The monitor prevents the final mutation, but eligibility must also block the target before `onDrag` can set preview state.

## Fixed Decisions

1. Make descendant eligibility the authoritative early prevention in `canDrop`, using the existing graph relation: `sourceId !== data.id && !editor.graph.isDescendant(data.id, sourceId)`. Here `data.id` is the candidate target and `sourceId` is the dragged node; this correctly rejects source-to-descendant drops without rejecting a legal source-to-ancestor operation.
2. Retain the monitor's descendant check at `useLayerDrag.ts:110` as defence in depth for stale or externally-dispatched drop data.
3. Keep instruction-to-visual mapping in `LayerTreeDropIndicator`; expose only a stable test hook on its existing indicator element. Do not add another reactive state, a command, a store field, a stylesheet or a second hit-testing route.
4. Use manual native drag events with one shared `DataTransfer` in the E2E helper for mid-drag assertions: `dragstart` on the `[data-node-id]` wrapper, `dragenter`/`dragover` on the target wrapper with the exact pointer co-ordinates, then `drop`/`dragend`. Retain the existing `Locator.dragTo` commit cases as behavioural coverage. The manual lifecycle is necessary because `Locator.dragTo` completes before an assertion can observe the indicator.
5. For node rows at level 1, drive above at `targetBox.y + 2`, below at `targetBox.y + targetBox.height - 2`, and make-child at `targetBox.x + 20, targetBox.y + targetBox.height / 2`; these are inside Atlaskit's verified top-quarter, bottom-quarter and middle hit zones. Use a `FRAME` target for make-child.

## Visual Contract - binding

- Keep the source state exactly `opacity-30` in `LayerTreeNodeRow.vue:39`.
- Keep child feedback exactly `pointer-events-none absolute inset-y-1 rounded border border-accent bg-accent/10` and preserve its current `left: level * indent`, `right: 4px` bounds.
- Keep reorder feedback exactly `pointer-events-none absolute h-0.5 bg-accent`, with `top-0` for `reorder-above`, `bottom-0` for `reorder-below`, and the existing left/width indent calculation.
- Add `data-test-id="layers-drop-indicator"` and `:data-drop-operation="instruction.type"` to each conditionally rendered indicator root in `LayerTreeDropIndicator.vue`; values are exactly `reorder-above`, `reorder-below` and `make-child`. Do not set either attribute when there is no active legal instruction.
- No icon, text, tooltip, focus target, keyboard operation or responsive layout is introduced. Indicators remain `pointer-events-none`; rows keep their existing selected, hover, invisible and masked states.

### Banned List

- No literal colours, font-size/radius changes, new `tv()` recipe, global CSS/app.css edit, npm dependency, store, command or new drag library.
- No changes to workspace-panel dragging, panel layout persistence, scene-graph schema, layer ordering semantics, undo implementation or auto-expand callback.
- No rewrite of `LayerTreeNodeRow.vue`'s existing class composition; only the indicator test-hook change is allowed in the visual layer.

## Allowed Changes

- `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts` - tighten `canDrop` only, retaining existing state/mutation flow.
- `App/src/components/LayerTree/LayerTreeDropIndicator.vue` - add the two explicit test attributes to existing rendered indicator roots.
- `App/tests/e2e/layers/reorder.spec.ts` - add the E2E helper and focused previews/blocked-drop tests; add the pre-verified E2E suppression header as the file is outside both TypeScript project `include` lists.

## Restrictions and Exclusions

An implementer who wants to cross one of these boundaries must stop and report:

- Do not touch `App/src/components/LayerTree/LayerTree.vue`, `LayerTreeNodeRow.vue`, `LayerTreeRoot.vue`, `context.ts`, or any panel/workspace drag system unless the named minimal change proves insufficient.
- Do not change `attachInstruction` configuration, `indentPerLevel`, `mode`, the auto-expand callback or the three `reorderChildWithUndo` branches.
- Do not add snapshot baselines, run a build/install, update packages, alter test configuration, make Git changes or edit `Plan/` during execution.

## Implementation Steps

1. **Pre-flight.** Re-read the three `useLayerDrag` areas in Verified Starting State and `reorder.spec.ts:5-82`. Confirm the T-074 plan row still points to this packet and has the same scope. Claim it only after the plan owner marks it Ready; if scope, dependency or packet link changed, stop and return the drift evidence.
2. **Block illegal target before preview.** In `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts`, replace the current one-expression `canDrop` with a boolean that reads `source.data.id as string` into `sourceId` and returns:

   ```ts
   sourceId !== data.id && !editor.graph.isDescendant(data.id, sourceId)
   ```

   Do not alter `getData`, `onDrag`, cleanup callbacks or monitor `onDrop`; the existing `instruction-blocked` nulling and the monitor descendant guard must remain intact.
3. **Make existing visuals test-addressable.** In `App/src/components/LayerTree/LayerTreeDropIndicator.vue`, add the static `data-test-id="layers-drop-indicator"` and the bound `data-drop-operation` to both of the existing conditional root `<div>` elements. The value comes directly from the already-narrowed `instruction.type`; do not add a resolver, prop or CSS class.
4. **Add focused native-DnD visual and commit coverage.** In `App/tests/e2e/layers/reorder.spec.ts`, first add exactly:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
   ```

   Add a small helper that creates three root nodes through `window.openPencil?.getStore?.()` after `canvas.clearCanvas()`: two `RECTANGLE`s and one `FRAME`, returns their IDs, calls `store.requestRender()`, and waits with `canvas.waitForRender()`. Add a second helper that holds one `DataTransfer` across `dragstart`, `dragenter` and `dragover`, passing the target co-ordinates, so the assertion runs before `drop`; its paired finish helper dispatches `drop` then `dragend` with that same transfer.

   Add tests that:

   - drag a rectangle over the top and then bottom zones of a sibling row; assert the source `layers-item` has `opacity-30`, exactly one `layers-drop-indicator` has `data-drop-operation` `reorder-above`/`reorder-below` respectively, and its classes include `top-0`/`bottom-0`; finish each drag and assert `layerOrder(page)` matches the advertised position;
   - drag a rectangle into the centre of the root-level `FRAME`; assert `data-drop-operation="make-child"`, classes include `inset-y-1` and `border`, then finish and assert `layerOrder(page, frameId)` equals `[sourceId]` and the child row becomes visible (the existing `onMakeChildDrop` expand behaviour);
   - create a `FRAME` containing a rectangle, expand it through the existing disclosure control, then drag the frame over its child. Assert no `layers-drop-indicator` is visible, release/cancel the transfer, assert the original parent/child IDs are unchanged, and assert the source no longer has `opacity-30`.

   In every test, call `canvas.assertNoErrors()` after the final graph assertions. Keep existing tests; do not replace their `dragTo` calls.
5. **Focused verification.** Repeat the one-file Playwright command below while editing. Once all cases are complete, run every final gate once, then perform the browser check before reporting.

## Acceptance Criteria

- [ ] A legal above hover displays one `layers-drop-indicator` marked `reorder-above` at the target top edge; its drop produces the corresponding sibling order.
- [ ] A legal below hover displays one indicator marked `reorder-below` at the target bottom edge; its drop produces the corresponding sibling order.
- [ ] A legal centre hover on a frame displays one bounded child indicator marked `make-child`; its drop reparents and expands the frame.
- [ ] During every legal preview the dragged row is subdued with the existing `opacity-30`, and after drop/cancel both source opacity and indicator clear.
- [ ] Dragging a node onto its own descendant produces no indicator, preserves the exact tree and clears source feedback on end.
- [ ] Existing ordering, hierarchy mutation, auto-expand and undo routes remain the authoritative `useLayerDrag` monitor paths; no new state or command exists.

## Verification

### Development loop - repeat as needed

From `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx playwright test tests/e2e/layers/reorder.spec.ts --project=openpencil
```

Expected: focused layer reorder suite passes, including all three visible preview states and the blocked-descendant case.

### Final pre-completion gates - run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx oxlint -c oxlint.json packages/vue/src/primitives/LayerTree/useLayerDrag.ts src/components/LayerTree/LayerTreeDropIndicator.vue tests/e2e/layers/reorder.spec.ts
bunx vue-tsc --noEmit -p tsconfig.json
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json
bunx playwright test tests/e2e/layers/reorder.spec.ts --project=openpencil
```

Expected: all commands exit 0. Do not run `bun run check`, `bun run test`, `bun run test:unit`, builds, installs or snapshot updates.

## Integration or Installed-Result Check

Run `cd App && bun run dev`, open the browser at the normal 1280x800 viewport, and use the Layers panel to drag a sibling above, below and into a frame. Confirm the line/child outline moves with the pointer and clears after each end. Attempt to drop a frame into one of its visible children: no feedback must appear and the tree must not change. Browser proof is sufficient; no desktop build/install is authorised.

## Stop Conditions

- `canDrop` does not receive a source ID or `editor.graph.isDescendant(targetId, sourceId)` has opposite argument semantics from the verified graph route: stop and report the observed signature; do not guess the relation direction.
- Manual native DnD cannot make `onDrag` react in the configured Chromium project after verifying it shares a `DataTransfer`: stop with the event trace and propose a focused test seam; do not add test-only application state.
- The target indicator's current classes or test-id lint convention differs from the verified source: stop and report the exact drift before altering visual design.
- Any required gate fails outside the edited scope, or the plan no longer permits this packet: stop and report evidence.

## Execution Report Contract

Report changed files; the exact `canDrop` predicate; which visual attributes were added; every focused command and exit result; browser actions observed; whether all four drag states passed; and any failure or assumption. Do not claim desktop delivery.

## Status record

2026-08-21 - First brief from requested drag highlight. Expansion needed to inspect the concrete LayerTree item component that consumes drag state.
2026-08-24 - Expanded to Ready against the live LayerTree primitive, consumer and DnD E2E seam. Corrected the test seam from `layers/panel.spec.ts` to `layers/reorder.spec.ts`. The three legal visuals already exist; the live defect is that descendant targets are not rejected in `canDrop`, allowing a misleading preview despite the monitor refusing the eventual mutation. The executor adds early descendant eligibility, stable indicator attributes and focused mid-drag/native-DnD regression coverage only.
