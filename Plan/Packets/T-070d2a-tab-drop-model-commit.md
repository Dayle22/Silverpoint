# T-070d2a - Tab-drop model and commit path

Task ID: T-070d2a
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070d1 (Done)
Related: T-070d2b, T-070d3
Expanded at: 2026-08-21 Africa/Johannesburg
Expanded against: live post-T-070d1 `operations.ts`, `layout.ts`, `drag.ts`, `drop-target.ts`, `containers.ts`; focused panel operation/group/container/resolver tests; prepared T-070d2b/T-070d3 boundaries; superseded combined T-070d decisions 9-10
Delivery: named source gates and one seam-drag regression browser check; no build/install

## Intended Outcome

Make `DropTarget` the single pure and reactive panel-move contract. `movePanel` must create a new group for `kind: 'group'`, or insert/reorder one panel as a tab for `kind: 'tab'`, atomically and without panel loss. Live dragging remains explicitly group-only until T-070d2b lands the matching tab preview and activation.

## Request Coverage

User request: `expand T-070d2a — Tab-drop model/commit`.

This packet expansion resolves the exact API, mutation semantics, callers, tests, source gates, visible-regression check, exclusions and stop conditions needed to execute that request. It does not implement the application change, activate visible tab-drop targeting, edit the parent-owned plan index, or perform desktop delivery.

## User-Visible Outcome

There is deliberately no new visible behaviour in this packet. A user dragging an individual panel must still see and commit only the T-070d1 group-seam/empty-dock targets. T-070d2a adds the tested model capability that T-070d2b will activate only when the matching ring-and-caret preview can land with it.

## Verified Starting State

- T-070d1 is Done. Its execution receipt records the DOM-free resolver, group/tab target union, geometry reader, explicit `{ allowTab: false }`, group-only commit guard, 30/30 resolver tests, full panel-suite proof and focused E2E proof.
- `App/src/app/shell/panels/drop-target.ts:18-20` owns `DropTarget`: either `{ kind: 'tab'; container; groupIndex; tabIndex }` or `{ kind: 'group'; container; groupIndex }`. It is runtime-only geometry, not persisted schema.
- `App/src/app/shell/panels/operations.ts:64-82` clones a normalised layout and removes a panel globally while pruning empty groups/floats. Lines 88-123 create a fresh single-member group in a dock or existing/fallback float.
- `App/src/app/shell/panels/operations.ts:126-141` still exposes the legacy pure signature `movePanel(layout, id, target: ContainerId, index)` and always creates a new group. Lines 229-245 route `dockPanel()` through that legacy signature.
- `App/src/app/shell/panels/layout.ts:83-99` contains the reactive wrappers; line 91 mirrors the legacy four-argument move contract.
- `App/src/app/shell/panels/drag.ts:144-173` resolves live targets with `{ allowTab: false }`. Lines 251-281 commit only a guarded group target through the legacy wrapper.
- `rg -n "movePanel\\(" App/src App/tests/engine/app/shell/panels` reports every live source and focused-unit caller: the declarations/commit in `operations.ts`, `layout.ts`, `drag.ts`, plus legacy calls in `operations.test.ts`, `containers.test.ts` and `groups.test.ts`. No compatibility overload is required or allowed.
- Expansion baseline from `App/`: `bun test tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/engine/app/shell/panels/containers.test.ts tests/engine/app/shell/panels/drop-target.test.ts` passed 82 tests, 0 failed, 216 `expect()` calls on Bun 1.3.14.
- No schema, storage migration, barrel export, Vue component or E2E helper change is needed for this model-only step.

## Read First

Read these bounded seams in order before editing:

1. `Plan/Packets/T-070d1-drop-target-resolver.md:181-191` - Done receipt and the transitional group-only caller that must remain visibly unchanged.
2. `App/src/app/shell/panels/drop-target.ts:18-32` and `:78-143` - exact `DropTarget` union and post-removal resolver contract.
3. `App/src/app/shell/panels/operations.ts:64-141` and `:229-246` - clone/removal/insertion helpers, pure `movePanel`, and `dockPanel` routing.
4. `App/src/app/shell/panels/layout.ts:4-41` and `:83-99` - pure-operation imports and reactive wrappers.
5. `App/src/app/shell/panels/drag.ts:144-173` and `:251-281` - explicit group-only resolution and preview-equals-commit release path.
6. `App/tests/engine/app/shell/panels/operations.test.ts:1-88` - atomic pure-operation and `dockPanel` expectations.
7. `App/tests/engine/app/shell/panels/containers.test.ts:65-129`, `:142-154` and `:184-240` - reorder, clamping, float fallback, merge/removal and height invariants.
8. `App/tests/engine/app/shell/panels/groups.test.ts:285-301` - compatibility mirrors after a move into a float group.
9. `Plan/Packets/T-070d2b-tab-drop-preview-ui.md:1-88` - downstream activation boundary; use it only to prevent scope leakage.

## Corrections to the Prepared Draft

- The dependency lock is cleared: T-070d1 is Done and its live declarations match the prepared contract.
- The baseline is now 82/82 tests and 216 assertions across the four named files, replacing the pre-dependency 68/68 snapshot.
- Canonical packet headings, bounded `Read First`, integration check, restrictions and the no-visible-change contract are now explicit.
- Invalid tab targets are defined as unchanged-by-value normalised no-ops. They must be validated after the source panel is removed in a working clone, but failure returns the untouched normalised input value so the panel cannot disappear.

## Fixed Decisions

### Exact APIs

In `operations.ts`:

```ts
export function movePanel(
  layout: PanelLayout,
  id: PanelId,
  target: DropTarget
): PanelLayout
```

In `layout.ts`:

```ts
export function movePanel(id: PanelId, target: DropTarget): void
```

Import `DropTarget` with `import type` from `./drop-target`. Do not move, duplicate or re-export it through persisted model types. Remove the old `ContainerId, index` parameters completely; no overload, adapter or deprecated alias.

### Pure mutation contract

1. Start from `normaliseV5(layout)` and work on a structured clone. Never mutate the caller's input.
2. Remove `id` from every group in the working clone; prune empty groups and empty floats; set `panels[id].open = true` only on the valid-result path.
3. A `kind: 'group'` target creates exactly `{ members: [id], active: id, height: null, collapsed: false }` at its clamped post-removal `groupIndex`.
4. For a group target naming a missing float, preserve the existing defensive behaviour: synthesise a fresh float at `panels[id].floatFallback`. Dock targets remain only `left` or `right` by type.
5. A `kind: 'tab'` target resolves the named container and group in the post-removal working clone, splices `id` at clamped `tabIndex`, sets `active = id`, and preserves the target group's existing `height` and `collapsed` values.
6. A tab target naming a missing float or a nonexistent post-removal group is stale/invalid. Return the untouched normalised input by value. Do not remove, float, close or reinterpret the panel, and do not fall back to a group insertion.
7. Same-group reorder consumes the resolver's post-removal `groupIndex`/`tabIndex` directly. Do not decrement either index and do not duplicate the panel.
8. Return `normaliseV5(...)` on every path. The function remains pure, total, immutable and non-throwing.
9. Update the `movePanel` doc comment so its single-atomic-path claim covers both target kinds and explicitly names post-removal indices.
10. `dockPanel()` keeps its public signature, constructs `{ kind: 'group', container: dockSide, groupIndex: insertionIndex }`, and routes through `movePanel` exactly once. Last-dock pinning behaviour remains unchanged.

### Transitional live-gesture contract

- In `startPanelDrag()`, replace the guarded legacy release mapping with `movePanel(id, target)`.
- Keep `computeDragStep()`'s explicit `{ allowTab: false }` byte-for-byte. Therefore the current live target can only be `kind: 'group'` even though the commit API accepts the union.
- Keep `panelInsertionTarget` as the sole preview/commit object. Do not add tab ring/caret state, remove the resolver option, or alter lift, threshold, RAF, snap, Alt, Escape, pointer-cancel, pointer-capture or cleanup behaviour.

### Test migration contract

- Mechanically migrate every direct focused-unit `movePanel` call found by the stated `rg` command to an explicit target object. Preserve every old assertion; do not delete, merge, weaken or rename an old case merely to make it pass.
- Old dock/float moves become explicit `kind: 'group'` targets. Add new tab-target cases in `operations.test.ts`; keep broader container and compatibility invariants in their existing files.
- Assertions for invalid tab targets must compare full normalised layout values and confirm the panel remains present exactly once and open state is unchanged.

## Visual Contract - binding

This packet adds no visual surface.

- Existing seam and empty-dock indicators remain the only possible indicator families.
- Dragging over a group body retains T-070d1's nearest-seam behaviour because `{ allowTab: false }` remains in force.
- Release commits the exact `panelInsertionTarget`; Escape restores the complete pre-drag layout; the browser console remains clean.

### Banned List

- No tab ring, caret, body highlight, hover state, cursor change or new test ID.
- No enabling `allowTab: true` and no removal of the explicit resolver option.
- No visible or invisible second preview state.
- No reinterpretation of stale tab targets as group targets.

## Allowed Changes

- `App/src/app/shell/panels/operations.ts`
- `App/src/app/shell/panels/layout.ts`
- `App/src/app/shell/panels/drag.ts`
- `App/tests/engine/app/shell/panels/operations.test.ts`
- `App/tests/engine/app/shell/panels/containers.test.ts`
- `App/tests/engine/app/shell/panels/groups.test.ts`

## Restrictions and Exclusions

- Do not edit `drop-target.ts`, `types.ts`, `containers.ts`, `index.ts`, any Vue component, E2E helper/spec, CSS, i18n, schema, storage key, migration, generated file or dependency.
- Do not activate tab targeting or implement any T-070d2b preview/UI work.
- Do not add whole-group movement or any T-070d3 gesture/model work.
- Do not change `startContainerDrag()`, `startPanelResize()`, `snap.ts`, float ordering, threshold, rollback or pointer lifecycle.
- Do not add compatibility overloads, new public helpers, speculative abstractions or fallback semantics for invalid tab targets.
- Do not edit `Plan/plan.md`; it remains parent-owned. Do not add Git/branch/commit/release instructions: this is a private non-Git workspace.
- Do not run umbrella `bun run check`, `bun run test:unit` or `bun run test`. Do not install dependencies, build Tauri, run an installer or bump versions.
- An implementer who needs to cross any restriction must stop and report the exact reason before changing scope.

## Implementation Steps

1. Re-read the bounded seams and run the single-file development test. Confirm T-070d1 remains Done, `DropTarget` is unchanged, `{ allowTab: false }` is present, and the `rg` caller set has not expanded.
2. In `operations.ts`, import `DropTarget` as a type; add the smallest private target-group lookup/insertion seam needed; change pure `movePanel` to the exact union signature and implement all valid/invalid rules before touching callers.
3. In `operations.test.ts`, migrate its legacy calls and add tab insert-at-0/middle/append, clamping, same-group reorder, cross-group prune/active, preserved group state and invalid-target no-loss cases. Run the development test until green.
4. In `operations.ts`, change `dockPanel()` to construct an explicit group target. In `layout.ts`, change the reactive wrapper to the exact union signature.
5. Mechanically migrate all remaining direct calls in `containers.test.ts` and `groups.test.ts`, preserving existing assertions and case names. Run the focused model set.
6. In `drag.ts`, change only release commit to `movePanel(id, target)`. Prove the explicit `{ allowTab: false }` and all lifecycle/snap code remain unchanged.
7. Re-run `rg -n "movePanel\\(" src tests/engine/app/shell/panels` and inspect every hit: only the new signatures and explicit target-object calls may remain; there must be no legacy four-argument call.
8. Run final source gates once, then the dev-server browser check. Stop on any failure or scope drift; do not continue into T-070d2b.

## Required Unit Cases

- Group target: first, middle, end, same-container, cross-container, dock-to-float, float-to-dock, float-to-float and clamped out-of-range moves preserve all existing results.
- Group target: missing float still synthesises one at the panel's `floatFallback`.
- Tab target: insert at 0, middle and append; negative/oversized indices clamp.
- Tab target: same-group reorder uses post-removal indices and leaves exactly one copy.
- Tab target: cross-group move prunes an emptied source group, deletes an emptied source float, inserts once and makes the moved panel active.
- Tab target: target `height` and `collapsed` survive unchanged; compatibility mirrors remain normalised.
- Tab target: missing group and missing float are immutable unchanged-by-value no-ops with no panel loss, relocation or open-state change.
- `dockPanel()` still routes through a group target; explicit docking and lastDock pinning remain green.

## Acceptance Criteria

- [x] Exact pure and reactive union signatures land; no legacy overload or four-argument call remains.
- [x] Both target kinds are atomic, total, normalised, immutable and duplicate-free.
- [x] Invalid tab targets cannot lose, close, float or relocate a panel.
- [x] Group targets preserve every old insertion, fallback and pinning behaviour.
- [x] Tab insertion/reorder preserves target group state and makes the moved panel active.
- [x] Every old move test is migrated without deletion or weakened assertions.
- [x] Live drag still resolves only group targets and looks/commits exactly as T-070d1.
- [x] `rg` and diff/read-back show only Allowed Changes differ.

## Verification

Run from `App/`.

### Development loop - repeat as needed

1. `bun test tests/engine/app/shell/panels/operations.test.ts`

### Final pre-completion gates - run once

1. `bun test tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/engine/app/shell/panels/containers.test.ts tests/engine/app/shell/panels/drop-target.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/operations.ts src/app/shell/panels/layout.ts src/app/shell/panels/drag.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/engine/app/shell/panels/containers.test.ts`
4. `rg -n "movePanel\\(" src tests/engine/app/shell/panels` - manually account for every hit; no legacy signature/call may remain.
5. `rg -n "allowTab: false|allowTab: true" src/app/shell/panels/drag.ts` - exactly the transitional `allowTab: false` call must remain; no live `allowTab: true` activation.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` and use the browser at 1440 px:

1. Drag an individual tab to the top and bottom seams of a docked group and to an empty-dock edge.
2. Confirm only the existing seam/edge indicator appears; no tab ring or caret appears over a group body.
3. Confirm release lands at the exact shown seam, Escape restores the complete layout, Alt affects only snap, and the console is clean.

This browser proof is sufficient for T-070d2a. Do not build, install, bump versions or claim installed-desktop delivery.

## Stop Conditions

Stop and report if T-070d1 is no longer Done or its union/caller drifted; tab semantics require a schema/storage change; invalid tab targeting cannot remain a safe unchanged-by-value no-op; a legacy case would need deletion/weakening; visible tab targeting becomes enabled; a forbidden file must change; any named test/gate/browser check fails; or unrelated workspace changes overlap an Allowed Change.

## Execution Report Contract

Report:

- exact changed files and landed pure/reactive signatures;
- the valid group/tab and invalid-tab mutation paths as implemented;
- every migrated caller and confirmation that no legacy call remains;
- new unit cases with pass/fail/assertion counts;
- exact command lines and exits for all source gates;
- browser observations proving group-only preview/commit and Escape restoration;
- read-back/diff evidence for unchanged resolver option, snap/lifecycle paths and exclusions;
- assumptions, failures and remaining gaps.

Do not claim tab-drop UI delivery, whole-group drag, desktop delivery or application completion.

## Revision History

- Revision 1 - 2026-08-21: prepared model/commit split while T-070d1 was dependency-locked.
- Revision 2 - 2026-08-21: reconciled against completed T-070d1, refreshed live callers/baseline, fixed canonical execution contracts and marked Ready.

## Status record

Status: **Done**

Execution receipt (2026-08-21 Africa/Johannesburg):
- Landed pure `movePanel(layout, id, target: DropTarget)` in `operations.ts` and reactive wrapper `movePanel(id, target: DropTarget)` in `layout.ts`.
- Implemented atomic valid tab/group drop semantics with source pruning, member activation, and group height/collapsed preservation.
- Invalid tab targets verified as unchanged-by-value no-ops with zero panel loss.
- Migrated all callers across `drag.ts`, `containers.test.ts`, `groups.test.ts`, and `operations.test.ts`; 0 legacy 4-argument calls remain.
- Kept `{ allowTab: false }` in `drag.ts` byte-for-byte; live dragging remains group-only.
- Unit tests: `bun test` passed 87/87 tests across operations, groups, containers, and drop-target (260 assertions).
- Static analysis: `tsgo --noEmit` (exit 0) and `oxlint --type-aware --type-check` (exit 0; 0 warnings, 0 errors).
- E2E verification: `playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/tabbed-groups.spec.ts` passed (13 passed, exit 0).
- Expansion receipt (2026-08-21 Africa/Johannesburg): T-070d1 confirmed Done and live contract-compatible; all pure/reactive/drag/test callers enumerated; focused baseline passed 82/82 tests with 216 assertions; exact group/tab/no-loss semantics, source gates and visible no-change proof fixed; only this packet changed; `App/` and parent-owned `Plan/plan.md` remained untouched.
