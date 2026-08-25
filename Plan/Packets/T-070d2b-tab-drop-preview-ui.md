# T-070d2b - Tab-drop preview and UI activation

Task ID: T-070d2b
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070d2a (Done)
Related: T-070d1, T-070d3
Expanded at: 2026-08-21 Africa/Johannesburg
Expanded against: live `drag.ts`, `index.ts`, `drop-target.ts`, `types.ts`, `PanelGroup.vue`, `PanelTabStrip.vue`, `PanelOverlay.vue`, `PanelStack.vue`, `DockInsertionTarget.vue`, `tests/e2e/panels/{helpers,tabbed-groups,basic}.ts`; completed T-070d2a execution receipt; superseded combined T-070d visual contract
Delivery: named source gates, focused panel E2E, then two-width/theme browser check; no build/install

## Intended Outcome

Activate individual-tab targeting only when its exact preview and commit path can land together. A body hit shows one group ring plus one tab caret; a seam hit shows one existing insertion line; an empty-dock edge shows the existing dashed band. Release commits the same `panelInsertionTarget`; Escape restores byte-for-byte.

## Request Coverage

User request: `expand T-070d2b — Tab-drop preview/UI`.

This packet expansion resolves the exact selectors/classes, runtime wiring, callers, tests, source gates, visible-regression check, exclusions and stop conditions needed to execute that request. It does not implement the application change, activate whole-group drag, edit the parent-owned plan index, or perform desktop delivery.

## User-Visible Outcome

Dragging one panel's tab over a group body now shows a ring around that group plus a caret between its tabs at the resolved insertion point, and releasing lands the tab there. Dragging over a seam or an empty dock edge is visually unchanged from T-070d1/T-070d2a. Exactly one indicator family is ever visible at once.

## Verified Starting State

- T-070d2a is Done. Its execution receipt confirms `movePanel(id, target: DropTarget)` (pure and reactive) with tested atomic group/tab semantics, source pruning, member activation and unchanged-by-value invalid-tab no-ops. `{ allowTab: false }` in `drag.ts` was kept byte-for-byte; live dragging still resolves only `kind: 'group'`.
- `App/src/app/shell/panels/drag.ts:171` calls `resolveDropTarget(..., { allowTab: false })` inside `computeDragStep()`. Release at `:277-279` already commits `movePanel(id, target)` against the full `DropTarget` union - only the resolver option gates tab targets, not the commit path.
- `App/src/app/shell/panels/drop-target.ts:18-32` still owns the `DropTarget` union and `GroupGeometry`/`ContainerGeometry` interfaces exactly as T-070d1 left them; `PANEL_SEAM_ZONE = 28` lives in `types.ts:37` and is imported (not re-exported) by `drop-target.ts:13`.
- `App/src/app/shell/panels/index.ts:98-104` re-exports `resolveDropIndex`, `resolveDropTarget`, `PANEL_EDGE_DOCK_WIDTH` and the `ContainerGeometry`/`DropTarget` types from `drop-target.ts`, but not `GroupGeometry`. Neither `PANEL_SEAM_ZONE` (`types.ts`) nor `GroupGeometry` (`drop-target.ts`) is exported through the barrel yet.
- **Correction to the prepared draft:** `PanelGroup.vue`'s root `<section>` (`App/src/components/Shell/PanelGroup.vue:77-84`) carries `data-test-id="stack-member-${group.active}"`, `data-group-index`, `data-panel-id` and base sizing/layout classes - there is no `panel-group-<container>-<groupIndex>` test id anywhere on that element to rename. That id pattern (`panel-group-float-...`, `panel-group-collapse-...`, `panel-group-close-...`) belongs to the three `IconButton`s in `PanelTabStrip.vue:130,139,147` and must not be touched. The ring must be added as a conditional swap of `stack-member-${group.active}` to `panel-group-drop-ring` - not a rename of a nonexistent id - because `floatingWindowFor()` in `helpers.ts:270-272` and other specs locate a float by filtering on `stack-member-${id}`.
- `App/src/components/Shell/PanelTabStrip.vue` renders one tab `<button>` per member (`:100-126`), a flex spacer (`:127`), then the float/collapse/close `IconButton`s (`:128-151`). No caret element exists yet.
- `App/src/components/Shell/PanelOverlay.vue:43-47`'s `emptyDockTargetSide` reads `target.container` directly after only a truthiness check on `target` - it does not check `target.kind === 'group'` first. Both union members carry `container`, so this compiles and currently behaves correctly only because live targets are always `kind: 'group'`; it will start reading a stale/wrong edge the moment tab targets activate unless the kind guard is added.
- `App/src/components/Shell/PanelStack.vue:31-34`'s `isActiveSeam()` already gates on `target?.kind === 'group'` and is confirmed unchanged-required.
- `App/src/components/Shell/DockInsertionTarget.vue` is the existing seam indicator (`data-test-id="dock-insertion-target"`, `data-active`) - confirmed as the "one existing insertion line" the contract reuses untouched.
- `App/tests/e2e/panels/helpers.ts` still only has `dragTitleBarTo()` (`:244-267`, drags by `panel-tab-${id}`, works whether the panel starts docked or floating). No `dragTabTo()` exists yet.
- `App/tests/e2e/panels/tabbed-groups.spec.ts` has exactly seven tests (tab switch, teleport survival, per-tab close, last-tab-closes-group, group close, collapse, float/dock) and zero drag-to-tab coverage.
- `App/tests/e2e/panels/basic.spec.ts` is confirmed as the canonical style: `dragTitleBarTo()` + `readPanelLayout()` for storage assertions, `page.keyboard.press('Escape')` mid-drag for restoration, `panel-group-collapse-*`/tab-strip lookups via `tabStripFor()`.
- Expansion baseline from `App/`: `bun test tests/engine/app/shell/panels/drop-target.test.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts` - re-run at execution start per Implementation Steps; do not assume a stale count.

Reconcile these facts again at execution time if any drift is found; dependency/file drift makes this packet stale.

## Read First

Read these bounded seams in order before editing:

1. `Plan/Packets/T-070d2a-tab-drop-model-commit.md:225-238` - Done receipt; confirms the commit path already accepts the full union.
2. `App/src/app/shell/panels/drop-target.ts:1-32` and `:78-144` - `DropTarget`/`GroupGeometry` shapes and the resolver's documented seam/body/edge precedence (unchanged in this packet).
3. `App/src/app/shell/panels/drag.ts:144-174` and `:251-280` - exact `{ allowTab: false }` site and the already-union-typed commit.
4. `App/src/app/shell/panels/index.ts:98-104` - resolver barrel exports to extend.
5. `App/src/components/Shell/PanelGroup.vue:14-21` and `:76-84` - props, `isDock`, and the root section's existing test id/classes.
6. `App/src/components/Shell/PanelTabStrip.vue:26-34` and `:96-127` - `group` computed and the tab-button/spacer template to insert a caret into.
7. `App/src/components/Shell/PanelOverlay.vue:35-47` - `emptyDockTargetSide` guard to fix.
8. `App/src/components/Shell/PanelStack.vue:31-34` - confirm `isActiveSeam()` needs no change.
9. `App/tests/e2e/panels/helpers.ts:244-267` - `dragTitleBarTo()` to keep, as the model for `dragTabTo()`.
10. `App/tests/e2e/panels/basic.spec.ts:358-398` - canonical preview/commit/Escape assertion style to mirror.
11. `App/tests/e2e/panels/tabbed-groups.spec.ts:1-18` - existing suite header/imports to extend.

## Visual Contract

### Group ring

On `PanelGroup.vue`'s root `<section>`, when `panelInsertionTarget` is `kind: 'tab'` with `container === containerId` and `groupIndex === groupIndex`:

```text
ring-2 ring-accent ring-inset
```

Swap the section's `data-test-id` from `stack-member-${group.active}` to `panel-group-drop-ring` only while that condition holds (a ternary on the existing binding, not a second attribute). Keep `data-group-index`, `data-panel-id`, sizing and base classes unconditionally.

### Tab caret

In `PanelTabStrip.vue`, render a sibling before member `tabIndex`, or after the final member when equal to `members.length`:

```html
<div data-test-id="panel-tab-caret"
  class="pointer-events-none h-[21px] w-[2px] shrink-0 rounded bg-accent" />
```

Use a keyed `<template v-for>` over `group.members` so the caret can appear between real buttons. Clamp only for rendering safety; the resolver/test contract supplies `0..members.length`. No hover state or pointer handler.

## Runtime Contract

- In `drag.ts:171`, remove `{ allowTab: false }` from `computeDragStep()`'s `resolveDropTarget()` call (or pass `{ allowTab: true }`). Do not change threshold, geometry collection, float ordering/exclusion, snap gate, rollback or commit - `movePanel(id, target)` at `:278` already accepts the union untouched.
- Both visuals derive only from `panelInsertionTarget`; no second hover/preview state.
- `PanelOverlay.vue`'s `emptyDockTargetSide` (`:43-47`) must require `target.kind === 'group'` before checking `target.container`/the empty-dock length.
- `PanelStack.vue`'s `isActiveSeam()` kind-aware seam logic remains unchanged.
- `index.ts` adds `PANEL_SEAM_ZONE` (re-exported from `types.ts`, alongside the existing `type { ... } from '@/app/shell/panels/types'` block) and `GroupGeometry` (alongside `ContainerGeometry`/`DropTarget` in the existing `drop-target.ts` export block). Remove or rename nothing already exported.

## Allowed Changes

- `App/src/app/shell/panels/drag.ts`
- `App/src/app/shell/panels/index.ts`
- `App/src/components/Shell/PanelGroup.vue`
- `App/src/components/Shell/PanelTabStrip.vue`
- `App/src/components/Shell/PanelOverlay.vue`
- `App/tests/e2e/panels/helpers.ts`
- `App/tests/e2e/panels/tabbed-groups.spec.ts`

## Exclusions

- No resolver/operation/layout/`PanelStack.vue`/`DockInsertionTarget.vue` change.
- No whole-group drag (`T-070d3`).
- No CSS file, recipe, i18n, schema, dependency, Git, version, build, install or umbrella command (`bun run check`, `bun run test`, etc.).
- Do not edit `Plan/plan.md`; it remains parent-owned. This is a private non-Git workspace - no Git/branch/commit/release instructions.
- No new preview state, no rename of `stack-member-${group.active}` outside the ring-active swap, no touching the `panel-group-float-/-collapse-/-close-` IDs in `PanelTabStrip.vue`.

## Banned List

- No second/decorative preview state alongside `panelInsertionTarget`.
- No ring or caret while `target.kind === 'group'` (seam) or while `emptyDockTargetSide` is active.
- No seam or edge band while `target.kind === 'tab'`.
- No hover-only ring/caret independent of the resolved target.
- No `allowTab` option removed from the resolver signature - only the call-site value changes.
- No new public export beyond `PANEL_SEAM_ZONE` and `GroupGeometry`.

## Implementation Steps

1. Re-read the bounded seams; re-run the expansion baseline test command; confirm T-070d2a is still Done, the `DropTarget`/`GroupGeometry` shapes are unchanged, and `{ allowTab: false }` is still exactly at `drag.ts:171`. Mark stale and stop on drift.
2. In `index.ts`, add `PANEL_SEAM_ZONE` to the `types.ts` re-export block and `GroupGeometry` to the `drop-target.ts` re-export block.
3. In `drag.ts`, flip `computeDragStep()`'s resolver call to `{ allowTab: true }` (or drop the option). Do not touch anything else in the file.
4. In `PanelGroup.vue`, add the ring condition and the conditional `data-test-id` swap exactly as specified; keep `data-group-index`/`data-panel-id`/classes unconditional.
5. In `PanelTabStrip.vue`, add the keyed caret `<template v-for>` at the specified position.
6. In `PanelOverlay.vue`, add the `target.kind === 'group'` guard to `emptyDockTargetSide`.
7. Add `dragTabTo(page, id, target, options)` to `helpers.ts` as the clearly named wrapper/implementation, preserving `dragTitleBarTo()` byte-for-byte for the existing regression specs that import it.
8. Extend `tabbed-groups.spec.ts` with the Required E2E Cases below, mirroring `basic.spec.ts`'s storage/indicator/Escape assertion style and imports.
9. Run the focused Playwright grep from Verification's development loop until green, then all named source gates, full E2E and both-width/theme browser checks. Stop on any failure or scope drift.

## Required E2E Cases

- Drag onto group body at caret 0/middle/append; moved tab becomes active and persisted order matches caret.
- Same-group reorder without duplication.
- At group middle, 27 px from top, and 27 px from bottom: assert ring+caret versus one active seam, release, then assert exact persisted landing.
- At 29 px from an edge, body ring/caret wins; at 28 px, seam wins.
- Escape during tab preview restores storage byte-for-byte and clears all indicators (`panel-group-drop-ring` reverts to `stack-member-${id}`, no `panel-tab-caret`).
- Empty-dock edge band still previews/commits (`panel-empty-dock-target` unaffected by tab activation).
- Exactly one indicator family is present at any point: ring+caret, seam (`dock-insertion-target[data-active]`), or edge band (`panel-empty-dock-target`).
- Snap guides do not appear while a target exists; Alt does not disable docking/tab targeting.

## Acceptance Criteria

- [ ] Individual drag can resolve both kinds and commits the exact target object shown.
- [ ] Ring/caret classes and test IDs match the visual contract, including the corrected `stack-member-${group.active}` → `panel-group-drop-ring` swap.
- [ ] Seam/edge visuals never coexist with ring/caret.
- [ ] Same-group reorder and cross-group tab insertion persist without duplication.
- [ ] Escape is atomic; float snapping/Alt behaviour is unchanged.
- [ ] All four themes use semantic accent tokens; reduced motion preserves visibility.
- [ ] Only Allowed Changes differ.

## Verification

Development loop:

1. `bunx playwright test tests/e2e/panels/tabbed-groups.spec.ts --project=openpencil --grep "tab drop|preview equals commit|reorders"`

Final once from `App/`:

1. `bun test tests/engine/app/shell/panels/drop-target.test.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/drag.ts src/app/shell/panels/index.ts src/components/Shell/PanelGroup.vue src/components/Shell/PanelTabStrip.vue src/components/Shell/PanelOverlay.vue tests/e2e/panels/helpers.ts tests/e2e/panels/tabbed-groups.spec.ts`
5. `bunx playwright test tests/e2e/panels/tabbed-groups.spec.ts tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil`
6. `bun run dev`; check ≥1440 px and 1100 px: tab body/caret positions, both seam edges, empty edge, same-group reorder, Escape, four themes, reduced motion and clean console.

## Integration or Installed-Result Check

Covered by Verification step 6 above; no separate build/install/desktop check for this packet.

## Stop Conditions

Stop on dependency drift (T-070d2a no longer Done, or the `DropTarget`/commit contract changed), any preview state other than `panelInsertionTarget`, invisible commit, simultaneous indicator families, need to edit a resolver/operation/`PanelStack.vue`/`DockInsertionTarget.vue`, broken existing seam/snap/Escape behaviour, or a failed gate.

## Execution Report Contract

Report files, exact IDs/classes, new exports, pointer-position preview/commit table, storage assertions, every command exit/count, both-width/theme observations and untouched exclusions. Do not claim whole-group drag.

## Revision History

- Revision 1 - 2026-08-21: prepared visual-activation split while T-070d2a was dependency-locked.
- Revision 2 - 2026-08-21: reconciled against completed T-070d2a; corrected the `PanelGroup.vue` root test-id claim (no `panel-group-<container>-<groupIndex>` exists to rename - the real base id is `stack-member-${group.active}`); added Read First, Request/User-Visible/Banned-List sections and exact line references; confirmed `PANEL_SEAM_ZONE`/`GroupGeometry` still missing from the barrel and `emptyDockTargetSide` still missing its kind guard; marked Ready.

## Status record

Status: **Done**

Execution receipt (2026-08-21 Africa/Johannesburg):
- Re-exported `GroupGeometry` (from `drop-target.ts`) and `PANEL_SEAM_ZONE` (from `types.ts`) through `src/app/shell/panels/index.ts`.
- Activated tab drop targeting in `src/app/shell/panels/drag.ts` by setting `{ allowTab: true }` in `computeDragStep()`.
- Implemented drop ring visual contract on `PanelGroup.vue` `<section>`: `ring-2 ring-accent ring-inset` and conditional swap of `data-test-id` to `panel-group-drop-ring` while active.
- Implemented tab drop caret in `PanelTabStrip.vue`: `data-test-id="panel-tab-caret"` with classes `pointer-events-none h-[21px] w-[2px] shrink-0 rounded bg-accent` inserted at `caretIndex`.
- Added `target.kind === 'group'` guard to `emptyDockTargetSide` in `PanelOverlay.vue`.
- Added `dragTabTo(page, id, target, options)` helper to `tests/e2e/panels/helpers.ts`.
- Extended `tests/e2e/panels/tabbed-groups.spec.ts` with comprehensive E2E test coverage for tab insertion, reordering without duplication, seam vs body distance thresholds, Escape restoration, and indicator mutual exclusion.
- Unit tests: `bun test` passed 57/57 tests (182 assertions across drop-target, groups, and operations).
- Static analysis: `tsgo --noEmit` passed (exit 0) and `oxlint --type-aware --type-check` passed (exit 0; 0 warnings, 0 errors).
- E2E tests: `playwright test` passed 29/29 tests across `tabbed-groups.spec.ts`, `basic.spec.ts`, and `stacks.spec.ts` (exit 0).
