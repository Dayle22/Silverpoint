# T-070d1 - Drop-target resolver and compatible geometry caller

Task ID: T-070d1
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-070c3 (Done)
Related: T-070d2a, T-070d2b, T-070d3
Expanded at: 2026-08-21 Africa/Johannesburg
Expanded against: live post-T-070c3 `types.ts`, `drop-target.ts`, `drag.ts`, `index.ts`, `PanelGroup.vue`, `PanelStack.vue`, `PanelTabStrip.vue`, `drop-target.test.ts`, the current T-070 scope map, and the superseded combined T-070d packet
Delivery: named source gates, focused seam E2E, then dev-server browser check; no build/install

## Intended Outcome

Introduce the DOM-free tab/group drop-target contract and its complete pure resolver while keeping the live application compiling and preserving today's seam-only drag behaviour. The caller migration in this packet is deliberately transitional: `drag.ts` collects the richer group/tab geometry but calls the resolver with `{ allowTab: false }`; T-070d2a adds tab mutation semantics and T-070d2b activates tab targets and visuals together.

## Why the Brief Boundary Changed

The original three-file brief could not pass its own TypeScript gate: live `drag.ts` constructs `{ container, index }`, returns flat `midpoints`, and reads `target.index`; `PanelStack.vue` also reads `.index`. The new union removes those fields. The smallest independently executable correction is five source files plus the dedicated unit test:

- resolver contracts: `types.ts`, `drop-target.ts`;
- compatible caller: `drag.ts`;
- stable group DOM selector: `PanelGroup.vue`;
- seam consumer: `PanelStack.vue`.

This is a packet correction, not user-visible tab-drop scope. `index.ts`, operations, layout, ring/caret UI and tab commit remain downstream.

## Verified Starting State

| File | Live seam |
| --- | --- |
| `src/app/shell/panels/drop-target.ts` | Pure, DOM-free `{ container, index }` resolver; containment follows caller order, then 96 px left/right edge fallback, then `null`. Module comment binds preview to commit. |
| `src/app/shell/panels/types.ts` | v5 model; no seam constant. |
| `src/app/shell/panels/drag.ts` | `containerGeometries()` orders floats by descending z before docks and skips the dragged panel's lifted float; `readContainerGeometry()` emits flat member midpoints; `startPanelDrag()` owns threshold, RAF, snap gate, rollback and commit. |
| `src/components/Shell/PanelGroup.vue` | Root section has `stack-member-*` and `data-panel-id`, but no stable group index attribute. |
| `src/components/Shell/PanelStack.vue` | `isActiveSeam()` reads the old target's `.index`. |
| `tests/engine/app/shell/panels/drop-target.test.ts` | DOM-free Bun suite with required suppression header. Baseline 2026-08-21: 16 passed, 0 failed, 18 expectations. |

Baseline cross-check: the four relevant unit files (`drop-target`, `operations`, `groups`, `containers`) pass 68/68 with 197 expectations before implementation.

## Exact Contracts

Add to `types.ts`:

```ts
/** Band at a group's top and bottom edge that resolves to a new-group seam rather than a tab. */
export const PANEL_SEAM_ZONE = 28
```

Replace the resolver types with:

```ts
export type DropTarget =
  | { kind: 'tab'; container: ContainerId; groupIndex: number; tabIndex: number }
  | { kind: 'group'; container: ContainerId; groupIndex: number }

export interface GroupGeometry {
  rect: { left: number; top: number; right: number; bottom: number }
  /** Horizontal tab-button midpoints in order, excluding the dragged panel's tab. */
  tabMidpointsX: number[]
}

export interface ContainerGeometry {
  id: ContainerId
  rect: { left: number; top: number; right: number; bottom: number }
  groups: GroupGeometry[]
}
```

Use this resolver signature:

```ts
resolveDropTarget(
  pointer: Vector,
  containers: ContainerGeometry[],
  overlay: { left: number; right: number },
  options: { allowTab: boolean } = { allowTab: true }
): DropTarget | null
```

`kind: 'group'` is a post-removal group insertion seam. `kind: 'tab'` names an existing group and post-removal tab insertion index.

## Resolver Rules

1. Preserve container iteration order, zero-size containment rejection, float-over-dock behaviour and descending-z caller contract.
2. In a contained group of height at least 56 px, distances `<= 28` from the top/bottom resolve to seam `i`/`i + 1`; 29 px enters the body.
3. A contained body with `allowTab: true` resolves `tabIndex` via `resolveDropIndex(pointer.x, tabMidpointsX)`.
4. With `allowTab: false`, a body resolves to the nearer seam; an exact midpoint tie goes upward.
5. A group shorter than 56 px (including a 33 px collapsed rail) is entirely seam-only, split at its midpoint; equality goes upward.
6. Container whitespace uses `resolveDropIndex(pointer.y, group vertical midpoints)`; empty container -> index 0.
7. If no container contains the pointer, a present left/right dock within the existing 96 px edge band resolves to a group append at `groups.length`; floats never participate.
8. Otherwise return `null`.

Keep `resolveDropIndex()`'s body byte-identical; amend only its comment to explain X/Y reuse. Keep `containsPoint()`, `PANEL_EDGE_DOCK_WIDTH`, the module's preview-equals-commit comment and `DockSide` re-export.

## Transitional Caller Contract

- Add `data-group-index="groupIndex"` to `PanelGroup.vue`'s root section; retain its existing IDs, panel ID, classes and styles.
- `readContainerGeometry()` reads each direct rendered `[data-group-index]` group in DOM order, its rect, and tab midpoints from `[data-tab-id]`, excluding `excludeId`. A sole dragged tab leaves an empty midpoint list; the group rect remains.
- Do not alter `containerGeometries()` ordering, lifted-float exclusion or comments.
- `computeDragStep()` calls the new resolver with `{ allowTab: false }`. Therefore this packet cannot produce a tab target in live dragging.
- Keep `setPanelInsertionTarget(container, index)` as a compatibility test/helper API, but store `{ kind: 'group', container, groupIndex: index }`.
- `startPanelDrag()` maps its guaranteed group target back to the existing `movePanel(id, target.container, target.groupIndex)` call. If a tab target somehow reaches this transitional branch, do not commit it; treat that as a stop-worthy invariant failure.
- `PanelStack.isActiveSeam()` requires `kind === 'group'` and compares `groupIndex`. No visual classes or placement change.

## Allowed Changes

- `App/src/app/shell/panels/types.ts`
- `App/src/app/shell/panels/drop-target.ts`
- `App/src/app/shell/panels/drag.ts`
- `App/src/components/Shell/PanelGroup.vue`
- `App/src/components/Shell/PanelStack.vue`
- `App/tests/engine/app/shell/panels/drop-target.test.ts`

## Exclusions

No operation/layout/barrel change; no tab commit; no ring/caret; no group gesture; no other Vue/test file; no schema/storage/dependency/CSS/i18n change; no Git/version/build/install/bun-install work; no umbrella commands.

## Implementation Steps

1. Confirm T-070c3 Done, this row Ready, allowed files unchanged, and the one-file baseline green.
2. Add `PANEL_SEAM_ZONE`; replace target/geometry contracts and resolver per the exact rules.
3. Retarget DOM geometry and transitional group-only use in `drag.ts` without changing threshold, RAF, pointer capture, snap gate, Escape/pointercancel rollback or float ordering.
4. Add the group selector and update the seam consumer only.
5. Adapt the existing test factory to `groups`; retain old precedence/edge cases and add the matrix below.
6. Run the focused loop, final gates, focused seam E2E and browser check.

## Required Unit Cases

- Existing five `resolveDropIndex()` cases; X-axis positions 0/middle/append.
- Top and bottom distances 27/28/29 px.
- Empty `tabMidpointsX` -> tab index 0.
- 33 px group above/at/below midpoint; exact tie upward.
- `allowTab: false` upper/lower body and midpoint tie; never a tab.
- Whitespace before/between/after groups and empty contained container.
- Present zero-width left/right edge append, missing dock, float exclusion.
- Containment over edge, float over dock and first-listed overlapping float.
- Open canvas -> `null`.

## Acceptance Criteria

- [ ] Exact union, geometry and resolver signature landed; no flat `midpoints` remains.
- [ ] Inclusive 28 px boundaries and short-group rules are proved.
- [ ] `resolveDropIndex()` body is byte-identical and reused for both axes.
- [ ] Resolver remains DOM-free; DOM access stays in `drag.ts`.
- [ ] Live `startPanelDrag()` resolves group targets only and preserves current seam preview/commit behaviour.
- [ ] Float/dock ordering, edge bands, snap priority and rollback are unchanged.
- [ ] The app type-checks after this packet; only Allowed Changes differ.

## Verification

Run from `App/`:

Development loop:

1. `bun test tests/engine/app/shell/panels/drop-target.test.ts`

Final once:

1. `bun test tests/engine/app/shell/panels/drop-target.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/types.ts src/app/shell/panels/drop-target.ts src/app/shell/panels/drag.ts src/components/Shell/PanelGroup.vue src/components/Shell/PanelStack.vue tests/engine/app/shell/panels/drop-target.test.ts`
5. `bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil --grep "dock targets resolve geometrically"`
6. `bun run dev`; at 1440 px and 1100 px, drag a tab to top/middle/bottom group seams and both empty-dock edges, confirm only seam/edge indicators appear and release commits exactly that seam; Escape restores the layout; console stays clean.

## Stop Conditions

Stop on source drift, any tab target in the transitional live path, DOM access in `drop-target.ts`, an edit outside scope, a changed snap/rollback/ordering contract, or any failed named gate. Do not weaken tests or execute d2a/d2b to make d1 green.

## Execution Report Contract

Report modified files; landed declarations and numbered precedence; boundary counts; byte-identical primitive proof; DOM-free grep; confirmation that live dragging stayed group-only; all command exits/counts; browser observations; untouched exclusions; and any input drift for d2a.

## Revision History

- Revision 1 - 2026-08-20: brief split from combined T-070d.
- Revision 2 - 2026-08-21: pure-contract expansion exposed an uncompilable three-file boundary.
- Revision 3 - 2026-08-21: boundary repaired with the minimal transitional geometry caller and seam consumer; tab activation remains downstream.

## Status record

Status: **Done**

Execution receipt (2026-08-21 Africa/Johannesburg):
- Landed `PANEL_SEAM_ZONE` (28 px), `DropTarget`, `GroupGeometry`, `ContainerGeometry`, and pure DOM-free `resolveDropTarget` in `types.ts` and `drop-target.ts`.
- Updated `drag.ts` geometry reading (`[data-group-index]`, `[data-tab-id]`), transitional caller `{ allowTab: false }`, and commit guard.
- Added `:data-group-index="groupIndex"` to `PanelGroup.vue` and updated `isActiveSeam` in `PanelStack.vue`.
- Unit tests: `bun test tests/engine/app/shell/panels/drop-target.test.ts` passed (30 pass, 0 fail, 37 expect() calls); full panel suite passed (105 pass, 0 fail, 321 expect() calls).
- Static analysis: `tsgo --noEmit`, `vue-tsc --noEmit`, and `oxlint` (0 errors, 0 warnings) all passed with exit code 0.
- E2E: `playwright test tests/e2e/panels/basic.spec.ts --grep "dock targets resolve geometrically"` passed (exit code 0).
- Expansion receipt (2026-08-21): reconciled live consumers; expanded five-source-file executable route; baseline resolver 16/16 and related unit set 68/68; no `App/` file changed during expansion.
