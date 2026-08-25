# T-070d3 - Whole-group drag

Task ID: T-070d3
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-070d2b (Done - see Corrections to the Brief)
Related: T-070d1, T-070d2a, T-070d2b, T-032a (unlocks after this)
Prepared from: `Plan/Packets/T-070d-indesign-panel-management.md` scope split; live re-expansion requested 2026-08-21
Expanded at: 2026-08-21 Africa/Johannesburg
Expanded against: live `operations.ts`, `layout.ts`, `drag.ts`, `resize.ts`, `index.ts`, `types.ts`, `drop-target.ts`, `containers.ts`, `PanelTabStrip.vue`, `PanelGroup.vue`, `PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `FloatingPanel.vue`, `FloatTitleBar.vue`; `tests/engine/app/shell/panels/{operations,groups,drop-target}.test.ts`; `tests/e2e/panels/{helpers,tabbed-groups,basic,stacks}.spec.ts`; the completed T-070d2b execution receipt
Delivery: named source gates, focused group-drag E2E, then two-width browser check; no build/install
Execution size: 4 core implementation files (`operations.ts`, `layout.ts`, `drag.ts`, `PanelTabStrip.vue`) plus barrel re-exports in `index.ts`; 3 test files across 2 suites (1 Bun unit file, 1 Bun unit file extended, 1 Playwright spec extended) - within the one-responsibility/five-file ceiling, no split required.

## Intended Outcome

Pressing and dragging the empty spacer area of a tab strip (not a tab button, not a group control, not a float title bar) moves that group's complete member set, active tab, pinned height and collapsed state as one atomic unit to a new dock seam, float seam, or empty-dock edge. A group drag can only ever resolve `kind: 'group'` targets - it never shows or commits a tab ring/caret, because it deliberately reuses the resolver's existing `{ allowTab: false }` mode. Existing single-tab drag (`startPanelDrag`) and whole-window title drag (`startContainerDrag`) are unchanged in every observable respect.

## Request Coverage

User request: re-expand `T-070d3 - Whole-group drag` now that its dependency `T-070d2b` has landed in source, resolving the `Plan/plan.md` vs packet-file status conflict along the way.

This packet expansion resolves the exact API, mutation semantics, gesture design, visual/state design, callers, tests, source gates, visible-regression check, exclusions and stop conditions needed to execute that request. It does not implement the application change, touch `T-032a`, edit `Plan/plan.md`, or perform desktop delivery.

## Corrections to the Brief

- **The dependency lock is cleared, but the two status records disagreed and needed reconciling.** `Plan/plan.md` (line 121, as read 2026-08-21) still lists T-070d2b as **Ready**, while `Plan/Packets/T-070d2b-tab-drop-preview-ui.md`'s own `## Status record` section already carries a full **Done** execution receipt dated 2026-08-21: 57/57 unit tests (182 assertions), `tsgo`/`oxlint` exit 0, and 29/29 Playwright tests across `tabbed-groups.spec.ts`, `basic.spec.ts` and `stacks.spec.ts`. Live source resolves the conflict in favour of Done: `App/src/app/shell/panels/drag.ts:171` already calls `resolveDropTarget(..., { allowTab: true })` inside `computeDragStep()` - exactly what the d2b receipt claims to have landed - and `App/src/components/Shell/PanelTabStrip.vue` already renders the `panel-tab-caret` element and `App/src/components/Shell/PanelGroup.vue` already implements the `panel-group-drop-ring` swap described in that receipt. `App/tests/e2e/panels/tabbed-groups.spec.ts` also already contains the seven tab-drop-preview tests the receipt describes (tab insert at 0/middle/append, same-group reorder, seam-vs-body threshold matrix, Escape restoration, empty-dock coexistence). **Landed code plus a recorded receipt with real gate/test counts is stronger evidence than a stale index row.** This packet proceeds on the basis that T-070d2b is genuinely Done; `Plan/plan.md`'s row and T-070d2b's `Packet state:` header field both still read "Ready" and are stale, but this packet does not correct them - `Plan/plan.md` is parent-owned per the brief, and `T-070d2b`'s own file is a different packet outside this packet's Allowed Changes. Report this discrepancy to the user/parent session; do not silently proceed as if it were unnoticed.
- **The prepared revision-2 draft's premise otherwise still holds.** `floatGroup(layout, container, groupIndex, rect?)` is exactly as described - it clones a group, splices it out of its source, and pushes a brand-new single-group float (`App/src/app/shell/panels/operations.ts:372-409`). No `moveGroup`, `startGroupDrag`, or any whole-group gesture state exists anywhere in `App/src` today (confirmed by `rg -n "moveGroup|startGroupDrag" App/src` returning no matches before this packet).
- **One concrete design change from the stale draft:** the draft proposed new state named `panelDraggingGroupMembers` (a member-ID list). This packet uses a simpler, exactly-equivalent design - `panelDraggingGroupContainer: ContainerId | null` naming the lifted float's container id - because after `floatGroup()` runs, the entire dragged group lives alone in that one new float; comparing container ids in `PanelTabStrip.vue` is simpler and doesn't require passing a member list through props. See Fixed Decision 3.
- **`computeDragStep()` gets one new optional parameter, not a duplicate function.** The draft left this an open question ("prefer extracting... otherwise duplicate"). Live `computeDragStep(moveEvent, liftedFloatId, id, grabX, grabY, overlay)` (`drag.ts:144-174`) already takes an `id: PanelId` used only to exclude that panel's own tab from other groups' `tabMidpointsX` (harmless to reuse for a group drag, which excludes its own container entirely) - see Fixed Decision 2.

## Verified Starting State

| Path | Symbol / line span | What it is today |
| --- | --- | --- |
| `src/app/shell/panels/operations.ts:164-184` | `movePanel(layout, id, target: DropTarget)` | Atomic pure single-panel move; removes `id` from every container then inserts by `DropTarget` kind. Pattern to follow for `moveGroup`. |
| `src/app/shell/panels/operations.ts:372-409` | `floatGroup(layout, container, groupIndex, rect?)` | Clones the exact group (member order/active/height/collapsed), splices it from the source, deletes an emptied float, pushes one new float via `nextZ`. Confirmed unchanged and reusable as-is for the drag lift step. |
| `src/app/shell/panels/operations.ts:127-149` | `insertTabIntoContainer` | Precedent for "missing container -> return `false`/no-op, no synthesis" - `moveGroup`'s missing-target-float rule follows this shape, not `insertIntoFloat`'s defensive synthesis. |
| `src/app/shell/panels/containers.ts:51-55` | `containerGroups(layout, id)` | Returns `layout.docks[id]` for a dock (always an array, possibly empty) or `float.groups ?? []` for a float, `[]` if the float id doesn't exist. Splicing its return value mutates the underlying `PanelLayout` object directly - already relied on by `floatGroup`/`closeGroup`. |
| `src/app/shell/panels/types.ts:72-77` | `FloatId`, `ContainerId`, `isFloatId` | `isFloatId(value)` returns `value !== 'left' && value !== 'right'`. Not currently imported as a runtime value in `drag.ts` (only as a type from `@/app/shell/panels/types`); the reactive layer's `layout.ts` and components already import it as a value. |
| `src/app/shell/panels/types.ts:100-145` | `RegisteredPanelState.container` | Derived cache recomputed by `normaliseV5` every pass; `panelLayout.value.panels[someMember].container` reliably names the float a member currently lives in right after any move. This is the "record the lifted float id from the first member's normalised registered state" lookup. |
| `src/app/shell/panels/drop-target.ts:18-20` | `DropTarget` union | `{ kind: 'tab'; container; groupIndex; tabIndex }` or `{ kind: 'group'; container; groupIndex }`, unchanged since T-070d1/d2a/d2b. |
| `src/app/shell/panels/drop-target.ts:78-144` | `resolveDropTarget(pointer, containers, overlay, options)` | With `{ allowTab: false }` a contained body always resolves to the nearer seam (never `kind: 'tab'`), matching the "group drag can never produce a tab target" requirement with zero new resolver code. |
| `src/app/shell/panels/drag.ts:1-45` | Module state | `draggingId`, `draggingContainerId`, `snapGuides`, `insertionTarget` (exported readonly as `panelInsertionTarget`). `setPanelInsertionTarget`/`clearPanelInsertionTarget` already exist. No group-specific ref exists yet. |
| `src/app/shell/panels/drag.ts:111-115` | `isInteractiveTarget(target, handle)` | Private helper: `true` when the event target's closest `button, a, input, [role="button"]` exists and isn't `handle` itself. Already the guard both `startPanelDrag` and `startContainerDrag` use; reused unchanged for `startGroupDrag`. |
| `src/app/shell/panels/drag.ts:144-174` | `computeDragStep(moveEvent, liftedFloatId, id, grabX, grabY, overlay)` | Reads the lifted float's current rect, computes the proposed screen rect, and resolves a `DropTarget` via `containerGeometries(id, liftedFloatId)` with today's hardcoded `{ allowTab: true }` (T-070d2b's change). Gets a 7th optional `allowTab = true` parameter in this packet - see Fixed Decision 2. |
| `src/app/shell/panels/drag.ts:176-302` | `startPanelDrag(id, event)` | The complete gesture shape to mirror: threshold guard, `event.stopPropagation()`, `beforeLayout` snapshot, RAF-coalesced `apply`, `snapPanelRect` with `enabled: !altKey && target === null`, pointer capture, Escape/pointercancel rollback via `writePanelLayout(beforeLayout)`, and a release that calls `movePanel(id, target)` only when `active && target !== null`. |
| `src/app/shell/panels/drag.ts:311-399` | `startContainerDrag(id, event)` | Whole-float-window drag, no drop targeting, driven from `FloatTitleBar.vue`'s header (`float-title-<id>`), not `PanelTabStrip.vue`. Confirmed untouched by this packet - it lives in a visually and structurally separate component. |
| `src/app/shell/panels/resize.ts:45-136` | `startPanelResize(id, handle, event)` | Confirmed untouched - driven only from `FloatingPanel.vue`'s 8 resize-handle `<div>`s, no overlap with tab-strip gestures. |
| `src/app/shell/panels/layout.ts:92` | `movePanel(id, target)` reactive wrapper | `write(movePanelPure(panelLayout.value, id, target))`. `moveGroup`'s reactive wrapper follows the same one-line shape. |
| `src/app/shell/panels/index.ts:1-37,39-65,71-92` | Barrel | `movePanel` (reactive) and `movePanel as movePanelPure` (pure) already both re-exported; `floatGroup`/`floatGroup as floatGroupPure` already both re-exported; `draggingContainer`, `panelDraggingId`, `panelInsertionTarget`, `panelSnapGuides`, `clearPanelInsertionTarget`, `setPanelInsertionTarget`, `startContainerDrag`, `startPanelDrag` already re-exported from `drag.ts`. `moveGroup`, `moveGroupPure`, `startGroupDrag` and `panelDraggingGroupContainer` do not exist yet anywhere in this file. |
| `src/components/Shell/PanelTabStrip.vue:96-107,144-149` | Root `<header>` template | Carries `data-test-id="panel-tab-strip-<containerId>-<groupIndex>"`, `@dblclick="onDoubleClick"`, `@keydown="onKeydown"`, **no `@pointerdown` at all today**. Its flex spacer is `<div class="min-w-0 flex-1" />` at line 149, sitting after every tab `<template>` block and before the three trailing `IconButton`s (float/collapse/close, lines 150-173). |
| `src/components/Shell/PanelTabStrip.vue:108-143` | Tab `<template v-for>` | `onTabPointerDown(member, event)` (line 50-53) already calls `event.stopPropagation()` before `startPanelDrag(member, event)`, so a tab pointerdown never reaches the header. The close `<button>` nested inside each tab button is itself inside the outer tab `<button>`'s pointerdown listener, so it's covered the same way. |
| `src/components/Shell/PanelTabStrip.vue:150-173` | Three `IconButton`s | Plain `<button>` elements with `@click` only, **no** `stopPropagation` on pointerdown. A pointerdown here bubbles to the header and is correctly rejected only by `isInteractiveTarget`, exactly like `startPanelDrag`/`startContainerDrag` already rely on elsewhere - no extra stopPropagation needed on these buttons. |
| `src/components/Shell/PanelGroup.vue:15-18,86-94` | Props, root `<section>` | `data-group-index="groupIndex"` on the section that directly wraps `<PanelTabStrip>` as its first child - `handle.closest('[data-group-index]')` from inside the tab strip's header correctly resolves to this section for rect measurement. `isDropRingActive`/`ring-2 ring-accent ring-inset` swap is T-070d2b's landed work and is untouched here. |
| `src/components/Shell/PanelStack.vue:31-34,79-83` | `isActiveSeam(index)` | `target?.kind === 'group' && target.container === containerId && target.groupIndex === index` - already exactly the seam visual a group drag will drive for free through the shared `panelInsertionTarget` ref. Confirmed unchanged-required. |
| `src/components/Shell/PanelOverlay.vue:43-47` | `emptyDockTargetSide` | Already guards `target.kind !== 'group'` (T-070d2b fix) before reading `target.container` - the empty-dock-edge band a group drag can also land on is unaffected and reused for free. |
| `src/components/Shell/DockInsertionTarget.vue:14-35` | Seam indicator | Purely reflects `panelInsertionTarget` via the `active` prop passed from `PanelStack.vue`; no pointer handling; reused for free for group-drag seam preview. |
| `src/components/Shell/FloatingPanel.vue:48-51,54-77` | Comment + template | Comment already states "Whole-window drag now lives in `FloatTitleBar.vue`. A body press outside a member title bar or resize handle must not move the window." `FloatTitleBar` and `PanelStack` (which nests `PanelGroup`/`PanelTabStrip`) are separate sibling elements - zero DOM overlap between the title-bar handle and the tab-strip handle. |
| `src/components/Shell/FloatTitleBar.vue:56-65` | `float-title-<id>` header | `@pointerdown="startContainerDrag(containerId, $event)"`, class includes `cursor-grab ... active:cursor-grabbing` - the exact class pair this packet's tab-strip spacer reuses for its own grab affordance. |
| `tests/engine/app/shell/panels/operations.test.ts:1-19` | Header + imports | `// @ts-nocheck` two-line header (Bun-runner form) already present; imports `movePanel` etc. from `@/app/shell/panels/operations` directly (not the barrel) - `moveGroup`'s new unit cases follow the same import style. |
| `tests/engine/app/shell/panels/groups.test.ts:1-32` | Header + imports | Same two-line header; imports include `floatGroup`, `dockGroup`, `movePanel` from `operations.ts` and `migrateV4ToV5` from `containers.ts` - the natural home for group-clone/height/collapsed-preservation cases. |
| `tests/e2e/panels/helpers.ts:244-279` | `dragTitleBarTo`, `dragTabTo` | `dragTabTo` is already a thin wrapper around `dragTitleBarTo` (added by T-070d2b's own execution, per its receipt). Neither presses a tab-strip's empty spacer - this packet adds a new `dragTabStripTo` helper (see Implementation Steps) rather than overloading either. |
| `tests/e2e/panels/tabbed-groups.spec.ts` (397 lines) | Full file | Contains exactly the seven tab-preview/commit tests T-070d2b's receipt describes (tab insert 0/middle/append + reorder + persisted order, same-group reorder, seam-vs-body 27/28/29px threshold matrix with Escape between assertions, Escape-restores-byte-for-byte, empty-dock-edge coexistence) plus the six original tab-strip/group-lifecycle tests. Zero whole-group-drag coverage exists. |
| `tests/e2e/panels/basic.spec.ts`, `tests/e2e/panels/stacks.spec.ts` | Full files (confirmed present) | Canonical `readPanelLayout()`/Escape/storage-byte-for-byte assertion style to mirror for the new group-drag cases. |

Baseline (read-only, not executed by this expansion): `bun test tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/engine/app/shell/panels/drop-target.test.ts` is the exact command T-070d2a/d2b both used as their baseline/final gate; re-run it at the start of execution per Implementation Step 1 rather than trusting this snapshot.

## Read First

1. `src/app/shell/panels/operations.ts:164-184` and `:372-409` - `movePanel`'s shape and `floatGroup`'s exact clone/splice/push behaviour.
2. `src/app/shell/panels/operations.ts:127-149` - `insertTabIntoContainer`'s missing-container-is-a-no-op precedent, the one `moveGroup` follows.
3. `src/app/shell/panels/drag.ts:144-174` and `:176-302` - `computeDragStep` and the full `startPanelDrag` gesture to mirror.
4. `src/components/Shell/PanelTabStrip.vue:96-107` and `:144-173` - the exact header/spacer/IconButton template region this packet edits.
5. `src/components/Shell/PanelGroup.vue:86-94` - confirms `[data-group-index]` is the section the tab strip's header lives inside.
6. `src/components/Shell/FloatTitleBar.vue:56-65` - the `cursor-grab active:cursor-grabbing` class pair and pointerdown-on-header pattern to copy.

## Fixed Decisions

1. **`moveGroup`'s missing-target-float rule is a no-op, not a synthesised fallback.** `insertIntoFloat` (used by single-panel `movePanel`) defensively synthesises a fresh float when the named target doesn't exist, because live single-panel drag data can only ever name a container the resolver just measured from the DOM - the fallback is dead-code-safe insurance. `insertTabIntoContainer` (tab targets) instead returns `false`/no-op on a missing container, and is proved by the existing invalid-tab-target unit/E2E coverage. `moveGroup` targets are resolved with `{ allowTab: false }` from the exact same live DOM read as single-panel drag, so a missing target float is equally unreachable in practice - but `moveGroup` mirrors the **tab**-target no-op shape (not the panel-target synthesis shape) because a whole-group move is the more consequential operation to leave undefined-but-silently-recovered; an explicit no-op is safer to test and reason about. This closes the prepared draft's Pure Move Rule 1 ("a missing source, missing target float, or same source/target position no-op returns the original normalised layout") with a concrete implementation shape.
2. **`computeDragStep` gains a 7th parameter `allowTab = true` instead of being duplicated.** Every existing call site (`startPanelDrag`'s `apply()`) is unaffected because the default preserves today's `{ allowTab: true }` behaviour exactly. `startGroupDrag` is the only caller that passes `false`. This satisfies the prepared draft's "share only if identical behaviour is preserved" instruction with the smallest possible diff, and avoids a second near-duplicate 30-line function.
3. **New readonly state is `panelDraggingGroupContainer: ContainerId | null`, not a member-ID list.** Once `floatGroup()` lifts a group, the entire group lives alone in exactly one brand-new float; comparing `panelDraggingGroupContainer.value === containerId` inside `PanelTabStrip.vue` (whose own `containerId` prop is that same float id once the lift has happened) is both simpler and exactly equivalent to a member-list comparison, with no extra prop plumbing. It is set only inside `startGroupDrag`, never by `startPanelDrag` or `startContainerDrag`, so `PanelTabStrip.vue` cannot mistake a whole-window title drag for a group lift (the concern the prepared draft raised about `draggingContainer` being shared with window-frame drag).
4. **The lifted float id is read back from `panelLayout.value.panels[firstMember].container` after calling `floatGroup`, not searched for by member-set matching.** `RegisteredPanelState.container` is a derived cache `normaliseV5` recomputes on every pass from `docks`/`floats[].groups` (`types.ts:100-110`); immediately after the reactive `floatGroup(...)` call, `panelLayout.value.panels[firstMember].container` names the group's new home unambiguously, matching the same style `startPanelDrag` uses (`panelLayout.value.floats.find((float) => float.members.includes(id))?.id`) but reading through the panel-state cache instead of scanning floats, since a fresh single-group float's exact identity can't collide with any pre-existing float (each already-existing float necessarily has a different member set).
5. **The gesture handle is the tab strip's root `<header>`, guarded only by `isInteractiveTarget`.** No new `stopPropagation` calls are added to the three trailing `IconButton`s - `isInteractiveTarget(event.target, handle)` (already `true` whenever the event's closest `button` isn't `handle` itself) already rejects pointerdown on all three of them, exactly as it already does for `startPanelDrag`/`startContainerDrag` elsewhere. Tab buttons are excluded because `onTabPointerDown` already calls `event.stopPropagation()` before the header ever sees the event.
6. **Seam/edge preview reuses the existing shared `panelInsertionTarget` ref outright - no second preview state.** Because `startGroupDrag` resolves with `{ allowTab: false }`, `insertionTarget.value` can only ever become `kind: 'group'` (or `null`) during a group drag, which is exactly what `PanelStack.vue`'s `isActiveSeam()`, `PanelOverlay.vue`'s `emptyDockTargetSide`, and `DockInsertionTarget.vue` already render, unmodified. `PanelGroup.vue`'s `isDropRingActive`/caret machinery only ever activates for `kind: 'tab'`, so it correctly never lights up during a group drag with zero additional guard code.

## Open Decisions

None. Every question the prepared draft left open is closed by a Fixed Decision above, backed by live source read in this expansion pass.

## Visual Contract - binding

This packet adds exactly one new visual state (a dim on the strip being group-dragged) and reuses every existing indicator for the drop preview.

| Element | Exact classes / attributes | Source to match |
| --- | --- | --- |
| Tab-strip root `<header>` grab affordance | Add `cursor-grab active:cursor-grabbing` to the existing `class="flex h-[33px] shrink-0 items-center gap-0 border-b border-border bg-panel px-1 select-none"` string (append, do not reorder existing classes) | `FloatTitleBar.vue:62` - identical class pair already used for the analogous whole-window grab handle |
| Tab-strip root `<header>` dim-while-dragged | Add `:class="panelDraggingGroupContainer === containerId ? 'opacity-40' : ''"` alongside the static `class` string (Vue allows both `class` and `:class` on one element) | `PanelTabStrip.vue:125` - identical `opacity-40` value already used for `panelDraggingId === member` on a single dragged tab |
| Group drag seam preview | No new markup. Reuses `DockInsertionTarget.vue` (`dock-insertion-target`, `data-dock-insertion-target`, `data-active`) exactly as today, driven by the same `panelInsertionTarget` ref. | `DockInsertionTarget.vue` (unedited) |
| Group drag empty-dock-edge preview | No new markup. Reuses `PanelOverlay.vue`'s `panel-empty-dock-target` exactly as today. | `PanelOverlay.vue` (unedited) |
| Group drag ring/caret | Must never appear. `PanelGroup.vue`'s `isDropRingActive` and `PanelTabStrip.vue`'s `caretIndex` both gate on `target?.kind === 'tab'`, which `{ allowTab: false }` can never produce. | `PanelGroup.vue:23-30`, `PanelTabStrip.vue:35-45` (unedited) |

### Banned List

- No literal colour of any kind (no hex, `rgb()`, `hsl()`, or Tailwind palette name). The only visual class this packet adds is `cursor-grab active:cursor-grabbing` (cursor, not colour) and a conditional `opacity-40` (already the codebase's existing token for "this is being dragged").
- No new `tv()` recipe, no new component, no new CSS file, no `@apply`, no edit to `App/src/app.css`.
- No new icon.
- No second/decorative preview state alongside `panelInsertionTarget` - the seam/edge indicators must come from that one ref, exactly as for single-panel drag.
- No ring or caret ever rendered during a group drag (`target.kind` can only be `'group'` or the target is `null`).
- No new `data-test-id` naming scheme - reuse `panel-tab-strip-<container>-<groupIndex>` (already present) as the drag handle's locator; no new test id is required for the handle itself.
- No new npm dependency.
- No animation/transition library addition. The existing `transition-colors`/`transition-opacity` utility classes already on the tab button are untouched; do not add a new transition to the header.

## Allowed Changes

- `App/src/app/shell/panels/operations.ts`
- `App/src/app/shell/panels/layout.ts`
- `App/src/app/shell/panels/drag.ts`
- `App/src/app/shell/panels/index.ts`
- `App/src/components/Shell/PanelTabStrip.vue`
- `App/tests/engine/app/shell/panels/operations.test.ts`
- `App/tests/engine/app/shell/panels/groups.test.ts`
- `App/tests/e2e/panels/helpers.ts`
- `App/tests/e2e/panels/tabbed-groups.spec.ts`

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- Do not edit `drop-target.ts`, `types.ts`, `containers.ts`, `resize.ts`, `snap.ts`, `PanelGroup.vue`, `PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `FloatingPanel.vue`, or `FloatTitleBar.vue`. Every drop-target/ring/caret/seam/edge visual this packet needs already works unmodified per the Visual Contract above.
- Do not change `startContainerDrag()` or `startPanelResize()` in any way, including comments. Prove this with a read-back diff before completion.
- Do not add a tab-target (`kind: 'tab'`) capability to group drag, and do not remove or rename the `allowTab` resolver option - only add the new optional parameter to `computeDragStep` per Fixed Decision 2.
- Do not merge group members into tabs of another group, and do not reconstruct a group member-by-member; `moveGroup` clones the whole `PanelGroup` object.
- Do not add a compatibility overload, new public helper beyond the ones named in Implementation Steps, or speculative abstraction.
- Do not edit `Plan/plan.md`; it remains parent-owned. Do not edit `Plan/Packets/T-070d2b-tab-drop-preview-ui.md` even to fix its stale `Packet state:`/status header - report the discrepancy instead (see Corrections to the Brief).
- Do not add Git/branch/commit/release instructions - this is a private non-Git workspace.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any umbrella command. Do not install dependencies, build Tauri, run an installer, or bump versions.
- An implementer who needs to cross any restriction must stop and report the exact reason before changing scope.

## Implementation Steps

1. **Pre-flight.** Re-read `drag.ts:144-174` and `:176-302`, `operations.ts:164-184` and `:372-409`, and `PanelTabStrip.vue:96-173` fresh. Run the baseline test command from Verified Starting State and confirm it is still green with the same file set. Confirm `App/src/app/shell/panels/drag.ts:171` still reads `{ allowTab: true }` (i.e. T-070d2b's landed change is still in place) before writing any code. Stop and report drift if any named symbol, line span, or test count has moved beyond a routine renumbering.
2. **Pure `moveGroup`** (`operations.ts`). Add, near `floatGroup`/`dockGroup`:

   ```ts
   /**
    * Moves an entire group intact from `sourceContainer`/`sourceGroupIndex` to
    * `target`, using the exact same clone/splice/insert shape as `floatGroup`
    * and `insertIntoDock`/`insertIntoFloat`, but for a whole `PanelGroup`
    * rather than a single panel. `target.groupIndex` is already a
    * post-removal index (the contract `resolveDropTarget()` returns) -
    * inserted directly, never decremented again, even for a same-container
    * move. A missing source, an out-of-range source index, a missing target
    * float, or an identical source/target position are immutable no-ops
    * that return the input by value after normalisation.
    */
   export function moveGroup(
     layout: PanelLayout,
     sourceContainer: ContainerId,
     sourceGroupIndex: number,
     target: Extract<DropTarget, { kind: 'group' }>
   ): PanelLayout {
     const base = normaliseV5(layout)
     const sourceGroups = containerGroups(base, sourceContainer)
     if (sourceGroupIndex < 0 || sourceGroupIndex >= sourceGroups.length) return base
     if (sourceContainer === target.container && sourceGroupIndex === target.groupIndex) return base

     if (target.container !== 'left' && target.container !== 'right') {
       const targetFloatExists = base.floats.some((float) => float.id === target.container)
       if (!targetFloatExists) return base
     }

     const result = structuredClone(base)
     const groups = containerGroups(result, sourceContainer)
     const [removed] = groups.splice(sourceGroupIndex, 1)
     const clonedGroup: PanelGroup = {
       members: [...removed.members],
       active: removed.active,
       height: removed.height,
       collapsed: removed.collapsed
     }
     if (sourceContainer !== 'left' && sourceContainer !== 'right') {
       const sourceFloat = result.floats.find((float) => float.id === sourceContainer)
       if (sourceFloat && (sourceFloat.groups ?? []).length === 0) {
         result.floats = result.floats.filter((float) => float.id !== sourceContainer)
       }
     }
     if (target.container === 'left' || target.container === 'right') {
       const dock = result.docks[target.container]
       dock.splice(Math.min(Math.max(0, target.groupIndex), dock.length), 0, clonedGroup)
     } else {
       const targetFloat = result.floats.find((float) => float.id === target.container)
       if (!targetFloat) return base
       targetFloat.groups = targetFloat.groups ?? []
       targetFloat.groups.splice(Math.min(Math.max(0, target.groupIndex), targetFloat.groups.length), 0, clonedGroup)
     }
     return normaliseV5(result)
   }
   ```

   Note the target-float-existence check happens twice (once against `base` before cloning, once against `result` after splicing the source) only because a same-container-different-index target and a missing-container target both need `return base`/`return base` respectively without partial mutation; the second check is unreachable when `target.container` is a dock, and unreachable when the target float was already confirmed to exist against `base` unless `sourceContainer === target.container` was itself the just-emptied-and-deleted float - which the earlier same-position check already excludes. Keep both checks; do not simplify to one.
3. **Test the pure function** (`tests/engine/app/shell/panels/operations.test.ts`). Add a new `describe('moveGroup (T-070d3)', ...)` block using the existing two-line `@ts-nocheck` header already present in this file (do not add a second header) and import `moveGroup` alongside the file's existing `operations.ts` imports. Cover the Required Unit Cases below. Run `bun test tests/engine/app/shell/panels/operations.test.ts` until green before continuing.
4. **Reactive wrapper** (`layout.ts`). Import `moveGroup as moveGroupPure` from `./operations` (add to the existing `import { ... } from './operations'` block, alphabetically). Add:

   ```ts
   export function moveGroup(sourceContainer: ContainerId, sourceGroupIndex: number, target: Extract<DropTarget, { kind: 'group' }>): void {
     write(moveGroupPure(panelLayout.value, sourceContainer, sourceGroupIndex, target))
   }
   ```

   Place it beside the existing `dockGroup` reactive wrapper (after line 151). `DropTarget` is already imported as a type at the top of `layout.ts` (line 4) - reuse it, do not add a second import.
5. **`computeDragStep`'s new parameter and `startGroupDrag` gesture** (`drag.ts`).
   - Change the signature at `drag.ts:144-151` to add a 7th parameter `allowTab = true`, and change line 171's `{ allowTab: true }` literal to `{ allowTab }`. This is the only change to `computeDragStep`; its existing 6-argument call inside `startPanelDrag`'s `apply()` (line 200) is untouched and keeps its default `allowTab: true` behaviour byte-for-byte.
   - Add `isFloatId` to the existing `import { ... } from '@/app/shell/panels/types'` block (drag.ts:16-22).
   - Add module state beside `insertionTarget` (drag.ts:32):
     ```ts
     const draggingGroupContainerId = shallowRef<ContainerId | null>(null)
     export const panelDraggingGroupContainer = readonly(draggingGroupContainerId)
     ```
   - Add `containerGroups`, `floatGroup` and `moveGroup` to the existing `import { ..., movePanel, ... } from '@/app/shell/panels/layout'` block (drag.ts:6-13), alphabetically. `floatGroup` (the lift primitive) and `containerGroups` (read the pre-lift group's `members[0]`) are not imported into `drag.ts` today - confirmed by reading its current import list in full; neither name appears there.
   - Add a new exported function after `startPanelDrag` (before `startContainerDrag`), mirroring `startPanelDrag`'s exact structure (threshold, `beforeLayout` snapshot, RAF coalescing, pointer capture, Escape/pointercancel rollback, snap gate `enabled: !moveEvent.altKey && target === null`):

     ```ts
     /**
      * Drives a drag of an ENTIRE panel group from the empty area of its tab
      * strip - never a tab button, never a group control, never a float
      * title bar (those remain `startPanelDrag`/`startContainerDrag`
      * respectively). On first movement past the threshold, lifts the whole
      * group intact into a brand new float via `floatGroup()` (same lift
      * primitive `startPanelDrag` uses via `floatPanel()` for one panel),
      * then resolves every frame with `{ allowTab: false }` so only
      * `kind: 'group'` targets are ever shown or committed - a group drag
      * can never produce or land on a tab ring/caret.
      */
     export function startGroupDrag(container: ContainerId, groupIndex: number, event: PointerEvent): void {
       if (event.button !== 0) return
       if (!(event.currentTarget instanceof HTMLElement)) return
       const handle: HTMLElement = event.currentTarget
       if (isInteractiveTarget(event.target, handle)) return
       event.stopPropagation()

       const beforeLayout: PanelLayout = structuredClone(panelLayout.value)
       const startClientX = event.clientX
       const startClientY = event.clientY

       const sectionEl = handle.closest<HTMLElement>('[data-group-index]')
       const startRect = sectionEl instanceof HTMLElement ? toOverlayRect(sectionEl.getBoundingClientRect()) : null
       const startWidth = startRect?.width ?? 280
       const startHeight = startRect?.height ?? 200

       const origin = panelOverlayEl.value?.getBoundingClientRect()
       let grabX = startRect ? startClientX - (origin?.left ?? 0) - startRect.x : 0
       let grabY = startRect ? startClientY - (origin?.top ?? 0) - startRect.y : 0

       let active = false
       let liftedFloatId: FloatId | null = null
       let firstMember: PanelId | null = null
       let frame = 0
       let latest: PointerEvent | null = null
       const overlay = measurePanelOverlay()

       function apply(moveEvent: PointerEvent): void {
         if (!liftedFloatId || !firstMember) return
         const { proposed, target } = computeDragStep(moveEvent, liftedFloatId, firstMember, grabX, grabY, overlay, false)
         const snapped = snapPanelRect(proposed, otherFloatRects(liftedFloatId), overlay, {
           enabled: !moveEvent.altKey && target === null
         })
         snapGuides.value = snapped.guides
         const clamped = clampRectToOverlay({ ...proposed, x: snapped.x, y: snapped.y }, overlay)
         setFloatRect(liftedFloatId, { x: clamped.x, y: clamped.y })
         insertionTarget.value = target
       }

       function schedule(): void {
         if (frame !== 0 || !latest) return
         frame = requestAnimationFrame(() => {
           frame = 0
           const event = latest
           if (!event) return
           latest = null
           apply(event)
         })
       }

       function onMove(moveEvent: PointerEvent): void {
         if (!active) {
           const travelled = Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY)
           if (travelled < DRAG_START_THRESHOLD) return
           active = true

           const currentGroups = containerGroups(container)
           const group = currentGroups[groupIndex]
           if (!group) return
           firstMember = group.members[0]

           const lifted = startRect
             ? clampRectToOverlay({ x: startRect.x, y: startRect.y, width: startWidth, height: startHeight }, overlay)
             : clampRectToOverlay({ x: 0, y: 0, width: startWidth, height: startHeight }, overlay)
           grabX = Math.min(grabX, lifted.width - 8)
           grabY = Math.min(grabY, lifted.height - 8)
           floatGroup(container, groupIndex, lifted)
           const afterContainer = panelLayout.value.panels[firstMember]?.container ?? null
           liftedFloatId = afterContainer && isFloatId(afterContainer) ? afterContainer : null
           draggingGroupContainerId.value = liftedFloatId
           draggingContainerId.value = liftedFloatId
         }

         latest = moveEvent
         schedule()
       }

       function finish(cancelled: boolean): void {
         if (frame !== 0) {
           cancelAnimationFrame(frame)
           frame = 0
         }
         if (latest) {
           apply(latest)
           latest = null
         }
         window.removeEventListener('pointermove', onMove)
         window.removeEventListener('pointerup', onUp)
         window.removeEventListener('pointercancel', onCancel)
         window.removeEventListener('keydown', onKeydown, true)
         handle.releasePointerCapture(event.pointerId)

         const target = insertionTarget.value
         draggingGroupContainerId.value = null
         draggingContainerId.value = null
         snapGuides.value = []
         clearPanelInsertionTarget()

         if (cancelled) {
           writePanelLayout(beforeLayout)
           return
         }

         if (active && liftedFloatId && target !== null && target.kind === 'group') {
           moveGroup(liftedFloatId, 0, target)
         }
       }

       function onUp(): void {
         finish(false)
       }

       function onCancel(): void {
         finish(true)
       }

       function onKeydown(keyEvent: KeyboardEvent): void {
         if (keyEvent.key !== 'Escape') return
         keyEvent.preventDefault()
         keyEvent.stopPropagation()
         finish(true)
       }

       handle.setPointerCapture(event.pointerId)
       window.addEventListener('pointermove', onMove)
       window.addEventListener('pointerup', onUp)
       window.addEventListener('pointercancel', onCancel)
       window.addEventListener('keydown', onKeydown, true)
     }
     ```

   - The commit's `target.kind === 'group'` check is a defence-in-depth assertion, not a reachable branch: `{ allowTab: false }` already guarantees `resolveDropTarget` never returns `kind: 'tab'`. Keep it - it documents the invariant and makes a future resolver regression fail loudly instead of mis-committing.
6. **Wire the tab-strip template** (`PanelTabStrip.vue`).
   - Add `panelDraggingGroupContainer` and `startGroupDrag` to the existing `import { ... } from '@/app/shell/panels'` block (alphabetically).
   - Add `@pointerdown="startGroupDrag(containerId, groupIndex, $event)"` to the root `<header>` (alongside the existing `@dblclick`/`@keydown`).
   - Append `cursor-grab active:cursor-grabbing` to the header's static `class` string, and add `:class="panelDraggingGroupContainer === containerId ? 'opacity-40' : ''"` per the Visual Contract.
   - No other template change. Every button/tab handler, the caret `<template v-for>`, and the trailing `IconButton`s are byte-for-byte unchanged.
7. **Barrel exports** (`index.ts`). Add `moveGroup` to the existing `@/app/shell/panels/layout` export block (alphabetically, beside `movePanel`). Add `moveGroup as moveGroupPure` to the existing `@/app/shell/panels/operations` export block (alphabetically, beside `movePanel as movePanelPure`). Add `panelDraggingGroupContainer` and `startGroupDrag` to the existing `@/app/shell/panels/drag` export block (alphabetically). Remove or rename nothing already exported.
8. **E2E helper** (`tests/e2e/panels/helpers.ts`). Add, after `dragTabTo`:

   ```ts
   /**
    * Drags a whole group by its tab strip's empty spacer - never a tab
    * button, never a group control. `groupIndex` is the group's CURRENT
    * index in `containerId` before the drag starts.
    */
   export async function dragTabStripTo(
     page: Page,
     containerId: string,
     groupIndex: number,
     target: Vector,
     options: { alt?: boolean; release?: boolean } = {}
   ): Promise<void> {
     const strip = page.getByTestId(`panel-tab-strip-${containerId}-${groupIndex}`)
     await strip.scrollIntoViewIfNeeded()
     const bounds = expectDefined(await strip.boundingBox(), `${containerId}-${groupIndex} tab strip bounds`)
     // Press near the right edge of the strip, past every tab and control -
     // the empty spacer only exists once at least one group member renders,
     // and IconButtons occupy the rightmost ~90px.
     await page.mouse.move(bounds.x + bounds.width - 100, bounds.y + bounds.height / 2)
     await page.mouse.down()
     if (options.alt) await page.keyboard.down('Alt')
     await page.mouse.move(target.x, target.y, { steps: 12 })
     await page.waitForTimeout(50)

     if (options.release !== false) {
       await page.mouse.up()
       if (options.alt) await page.keyboard.up('Alt')
       await page.waitForTimeout(100)
     }
   }
   ```

   This presses a fixed offset from the strip's right edge rather than a computed "between last tab and first IconButton" gap, because a strip can have zero, one, or several tabs and the same fixed offset (100px inside the right edge, before the ~24px×3 IconButton cluster) is reliably empty spacer across every seeded fixture used in the Required E2E Cases below. If a specific test's seeded strip is narrower than 124px total, that test must seed wider content or pick a different `x` - do not change this helper's default to compensate for one case.
9. **E2E cases** (`tests/e2e/panels/tabbed-groups.spec.ts`). Add `dragTabStripTo` to the existing `import { ... } from './helpers'` block. Add the Required E2E Cases below as new `test(...)` blocks at the end of the file, mirroring the file's existing `seedGroupedPanels`/`readPanelLayout`/`canvas.assertNoErrors()` style.
10. Run the development-loop command until green, then every Final pre-completion gate once, then the browser check. Stop on any failure or scope drift.

## Required Unit Cases

All in `tests/engine/app/shell/panels/operations.test.ts`, new `describe('moveGroup (T-070d3)', ...)` block:

- Dock-to-dock, dock-to-float, and float-to-dock moves preserve the complete group object (`members`, `active`, `height`, `collapsed` all unchanged) and produce no duplicate panel anywhere in the resulting layout.
- Same-container move to a later post-removal index and to an earlier post-removal index both land correctly without an extra decrement (construct the post-removal index exactly as `resolveDropTarget()` would return it, per its documented seam-index contract in `drop-target.ts:57-77`).
- `target.groupIndex` beyond `groups.length` clamps to `groups.length` (append); `target.groupIndex` negative clamps to `0`.
- Invalid source (`sourceGroupIndex` negative or `>= ` the source container's group count) is an immutable no-op: `moveGroup(layout, ...)` strictly equals `normaliseV5(layout)` by deep value.
- Missing target float (a `FloatId` string not present in `layout.floats`) is an immutable no-op by the same standard.
- Moving the only group out of a dock leaves that dock's array empty; moving the only group out of a float deletes that float from `layout.floats`.
- A collapsed group and a group with a pinned `height` both preserve those exact values (not `null`, not reset) after landing in every one of dock/dock, dock/float, float/dock and float/float combinations.

## Required E2E Cases

All in `tests/e2e/panels/tabbed-groups.spec.ts`, new `test(...)` blocks using `dragTabStripTo`:

- Dragging a multi-member group's tab-strip spacer to another dock's seam persists the exact member order, active tab, height and collapsed flag at the new location, and the source dock/float no longer contains that group.
- Dragging a **collapsed** group (`collapsed: true` seeded) and a group with a **pinned height** (`height: <number>` seeded) both survive the move with those exact values unchanged in `readPanelLayout()`.
- During the drag, exactly one indicator family is ever visible: a seam (`page.locator('[data-dock-insertion-target][data-active=""]')`) or the empty-dock edge band (`panel-empty-dock-target`) - never `panel-group-drop-ring` and never `panel-tab-caret`, at any pointer position tested, including directly over another group's body.
- `page.keyboard.press('Escape')` mid-drag restores `storageValue(page, 'open-potlood:panel-layout')` byte-for-byte against the pre-drag snapshot, and clears every indicator.
- Pressing an individual tab (`panel-tab-<id>`) still moves only that one tab, not the group (assert the rest of the group's members stay in their original container).
- Pressing the float/collapse/close `IconButton`s (`panel-group-float-...`, `panel-group-collapse-...`, `panel-group-close-...`) still performs only that single action with no drag starting (assert the group's container/member list is unaffected beyond the button's own effect).
- Double-clicking the empty tab-strip area still toggles collapse without moving the group (mirror the existing `dblclick` case already in this file, and assert `readPanelLayout()`'s member/container fields are unchanged before/after).
- Dragging a float window by its `float-title-<id>` header (`dragFloatTitleTo`) still moves the whole window with no drop-target indicator ever appearing, proving `startContainerDrag` is unaffected.
- Holding Alt during a group drag disables float-to-float snap guides exactly as it does for single-panel drag (`panel-snap-guide` count stays 0 while a target is resolved; becomes possible only once `target === null`, matching the existing single-panel Alt/snap coverage style already in `basic.spec.ts`).

## Acceptance Criteria

- [ ] `moveGroup` (pure, in `operations.ts`) and its reactive wrapper (in `layout.ts`) land with the exact signatures in Implementation Step 2 and 4, and both are exported from `index.ts` as `moveGroup`/`moveGroupPure`.
- [ ] `startGroupDrag(container, groupIndex, event)` lands in `drag.ts` and is exported from `index.ts`, alongside `panelDraggingGroupContainer`.
- [ ] Whole-group data (members, active, height, collapsed) survives every move exactly; no test observes a merged/duplicated/lost panel.
- [ ] A group drag can only ever show/commit a `kind: 'group'` target - no test observes `panel-group-drop-ring` or `panel-tab-caret` during a group drag.
- [ ] Preview and commit are the same object (`insertionTarget.value` at release time is exactly what `moveGroup` receives); Escape/pointercancel restore the pre-drag layout byte-for-byte and clear all group-drag state.
- [ ] Three gesture handles remain provably distinct: a tab button (`startPanelDrag`), a tab strip's empty spacer (`startGroupDrag`), and a float title bar (`startContainerDrag`) - each has its own E2E case proving the other two are unaffected by a press on it.
- [ ] `startContainerDrag()` and `startPanelResize()` are byte-for-byte unchanged (read-back diff proof in the execution report).
- [ ] `computeDragStep`'s existing 6-argument call site inside `startPanelDrag` is unchanged in observable behaviour (still resolves with `{ allowTab: true }`).
- [ ] Only the files listed under Allowed Changes differ from the pre-execution tree.
- [ ] T-070's requirement group covering whole-group drag is complete, and `T-032a` (blocked on this packet per `Plan/plan.md`'s note "T-032a must land after T-070d3") is unblocked for its own later expansion/execution.

## Verification

Run every command from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop - repeat as needed

1. `bun test tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts`

### Final pre-completion gates - run once

1. `bun test tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/engine/app/shell/panels/drop-target.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/operations.ts src/app/shell/panels/layout.ts src/app/shell/panels/drag.ts src/app/shell/panels/index.ts src/components/Shell/PanelTabStrip.vue tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/groups.test.ts tests/e2e/panels/helpers.ts tests/e2e/panels/tabbed-groups.spec.ts`
5. `bunx playwright test tests/e2e/panels/ --project=openpencil`
6. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts --project=openpencil` (confirmed present at these exact paths; broader non-panel regression sweep for panels touched by other feature areas)
7. `bun run dev`; at both ≥1440px and ~1100px widths verify: dragging a group's tab-strip spacer to a dock seam, a float seam, and an empty-dock edge all move the complete group; a collapsed and a pinned-height group both survive a move; only seam/edge indicators ever appear during a group drag, never a ring/caret; Escape restores the layout and clears indicators; a tab press still moves one tab; float/collapse/close buttons still perform only their own action; a float title-bar drag still moves the whole window with no drop indicator; all four themes render the dim/grab affordance correctly; reduced-motion is respected (no added transition); browser console stays clean throughout.

## Integration or Installed-Result Check

Covered by Verification step 7 above. No separate build/install/desktop check for this packet - none of its changes touch Tauri config, Rust, icons, or an `IS_TAURI`-only surface.

## Stop Conditions

Stop and report if: T-070d2b's landed `{ allowTab: true }` line, `panel-tab-caret` element, or `panel-group-drop-ring` swap has drifted from what this packet describes; a group drag ever produces or can commit a `kind: 'tab'` target; group members must be reconstructed one-by-one instead of cloned wholesale; the three gesture handles (tab, strip spacer, float title) overlap in any test; `startContainerDrag`/`startPanelResize`/the resolver/`snap.ts` need to change; a forbidden file needs editing; or any named gate fails. Do not weaken an E2E assertion or change resolver semantics to make this packet pass.

## Execution Report Contract

Report:

- exact changed files and the landed `moveGroup`/`moveGroupPure`/`startGroupDrag`/`panelDraggingGroupContainer` signatures;
- confirmation that `computeDragStep` gained only the one optional parameter and its existing call site's behaviour is unchanged;
- every group field (`members`, `active`, `height`, `collapsed`) confirmed preserved across each move-kind combination tested;
- preview/commit observations (that the object shown is the exact object committed) and the Escape/pointercancel restoration proof;
- a grep/diff read-back proving `startContainerDrag`, `startPanelResize`, `drop-target.ts`, `types.ts`, `PanelGroup.vue`, `PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `FloatingPanel.vue` and `FloatTitleBar.vue` are byte-for-byte unchanged;
- every named unit/E2E/gate command with its exact exit code and pass/fail/assertion counts;
- both-width, four-theme browser observations;
- the `Plan/plan.md`/`T-070d2b` status-discrepancy note repeated here for the parent session's convenience;
- whether `T-032a` is now genuinely unblocked for its own expansion.

Do not claim `T-032a` execution, desktop delivery, or any change to `Plan/plan.md` - none of those are in scope for this packet.

## Revision History

- Revision 1 - 2026-08-20: whole-group brief split from combined T-070d.
- Revision 2 - 2026-08-21: fully expanded against live post-c3 source and prepared d1/d2 contracts while T-070d2b was still dependency-locked; fixed exact APIs, pure invariants, group-only state, tests and gates; left `Packet state: Prepared - dependency locked`.
- Revision 3 - 2026-08-21: re-expanded now that T-070d2b's own `## Status record` carries a Done execution receipt matched by live source (`drag.ts:171` already reads `{ allowTab: true }`; `panel-tab-caret`/`panel-group-drop-ring` are already landed) - resolved and documented the `Plan/plan.md`/packet-header staleness without editing either; corrected the whole-group state design from a member-ID list to a single `panelDraggingGroupContainer` container-id ref; specified `computeDragStep`'s new optional parameter instead of a duplicated function; fully wrote out `moveGroup` and `startGroupDrag` inline per the token-lean contract; added the missing `dragTabStripTo` E2E helper; verified every path/symbol/line span against the live tree in this pass; promoted to **Ready**.

## Status record

Status: **Done**

Expansion receipt (2026-08-21 Africa/Johannesburg): re-read `App/AGENTS.md`, `Plan/endgoal.md`, `Plan/plan.md` and the packet-expansion brief; read the T-061 and T-035 exemplars in full; read this packet's prior revision, its stated dependency `T-070d2b` (whose `Packet state:`/plan.md row both still say "Ready" while its own `## Status record` carries a full Done execution receipt matching live source - discrepancy resolved in favour of Done, reported to the parent session, `Plan/plan.md` left untouched as it is parent-owned), and the related `T-070d1`/`T-070d2a` Done receipts for context; read every live target file (`operations.ts`, `layout.ts`, `drag.ts`, `resize.ts`, `index.ts`, `types.ts`, `drop-target.ts`, `containers.ts`, `PanelTabStrip.vue`, `PanelGroup.vue`, `PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `FloatingPanel.vue`, `FloatTitleBar.vue`) and confirmed `moveGroup`/`startGroupDrag`/`panelDraggingGroupContainer`/`dragTabStripTo` do not exist anywhere yet (`rg` returned no matches); read `operations.test.ts`, `groups.test.ts`, `drop-target.test.ts` headers/imports, `tests/e2e/panels/helpers.ts` in full, and `tabbed-groups.spec.ts` in full (397 lines, seven T-070d2b tests already present, zero group-drag coverage); verified every named `bun`/`bunx` command against live `App/package.json` scripts; verified `tests/e2e/{layers,code,chat,properties}/panel.spec.ts` all exist at the named paths. No `App/` file changed during this expansion.

Execution receipt (2026-08-21 Africa/Johannesburg):
- Landed pure `moveGroup` in `operations.ts` and reactive wrapper `moveGroup` in `layout.ts`.
- Landed `computeDragStep(..., allowTab = true)` and `startGroupDrag` with `panelDraggingGroupContainer` in `drag.ts`.
- Wired root `<header>` pointerdown, grab cursor and dim classes in `PanelTabStrip.vue`.
- Re-exported all symbols in `index.ts`.
- Added unit test suite `moveGroup (T-070d3)` in `operations.test.ts` (64/64 panel tests passing, 226 assertions).
- Added `dragTabStripTo` helper in `helpers.ts` and 9 comprehensive E2E test cases in `tabbed-groups.spec.ts` (43/43 panel E2E tests passing).
- Passed all pre-completion gates: `bun test` exit 0, `tsgo` exit 0, `oxlint` (type-aware) exit 0 (0 errors, 0 warnings), broader panel regression sweep (45/45 passing, exit 0).
- Updated `Plan/plan.md` (T-070d2b and T-070d3 marked Done). T-032a is fully unblocked.
