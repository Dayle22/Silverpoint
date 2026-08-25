# T-070c2 - Panel-group UI activation

Task ID: T-070c2
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070c1 (Done)
Related: T-070c1 (model this packet consumes unchanged), T-070c3 (removes `PanelTitleBar.vue` and ships tabbed defaults), T-070d1-d3 (drop targeting for real multi-member groups)
Prepared from: the stub's Exact Contract, expanded against live `App/` source
Expanded at: 2026-08-20 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/app/shell/panels/{types,registry,containers,operations,layout,hosts,drag,index}.ts`, `src/components/Shell/{PanelStack,FloatingPanel,PanelOverlay,WorkspacePanel}.vue`, `src/components/ui/panel/PanelTitleBar.vue`, `src/components/TabBar.vue`, `src/components/ui/IconButton.vue`, `packages/vue/src/i18n/messages/panels.ts`, `tests/e2e/panels/{helpers,basic,stacks}.{ts,spec.ts}`, `Plan/plan.md`, and the superseded (pre-split) `Plan/Packets/T-070c-tabbed-panel-groups.md` for its Visual Contract as a class-string source
Delivery: named source gates + browser check

## Intended Outcome

Build the real tab-strip UI over the v5 group model T-070c1 shipped: a new `PanelTabStrip.vue` (tabs + group controls) and `PanelGroup.vue` (the group's sizing box, replacing the inline per-member `<section>`), wired to the real `setActiveTab`/`toggleGroupCollapsed`/`setGroupHeight`/`closeGroup`/`floatGroup`/`dockGroup` operations. `PanelStack.vue` iterates groups instead of flat panel ids. Because the default layout still ships **one panel per group** (T-070c3's job to change), every group in this packet's reachable state space has exactly one tab, so the new tab strip is visually inert (one tab, nothing to switch) except for one honest, temporary side effect: **`PanelTitleBar.vue` keeps rendering inside `WorkspacePanel.vue` exactly as it does today**, per plan.md's own split ("T-070c3 ... removes the legacy title bar" — not this packet). This means every panel briefly shows two 33 px header bars stacked — the new group tab strip above, the old per-panel title bar below — until T-070c3 removes the second one. This is a deliberate, documented interim state, not a defect.

## Request Coverage

The UI-activation slice of T-070's requirement group 4 (see `Plan/Packets/T-070-indesign-panel-management.md` and the superseded `Plan/Packets/T-070c-tabbed-panel-groups.md`). It ships no default-layout change and no way to create a multi-tab group through the app UI (that is T-070d's drag-and-drop job) — its only user-visible effect is the new (currently single-tab) strip appearing above each panel, and the new strip's collapse/float/close controls becoming live alongside the pre-existing per-panel ones. T-070c3 ships the actual tabbed defaults and removes the now-redundant `PanelTitleBar.vue` usage.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/types.ts`, `index.ts`, `operations.ts`, `layout.ts` | `PanelGroup`, `containerGroups`, `groupOf`, `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`, all exported from the barrel with these exact names and signatures | **Landed by T-070c1, verified live 2026-08-20.** Every group operation this packet needs already exists, is pure/total, and is already wired through `layout.ts`'s reactive wrappers. This packet writes **zero** `.ts` files. |
| `src/app/shell/panels/registry.ts` | `PANEL_REGISTRY_BY_ID[id].sizing`, `.defaultHeight` | Unchanged since T-070a; used by the new group-level sizing style, re-keyed from panel to the group's **active** member exactly as `PanelStack.vue`'s current `memberStyle` reads it per-panel today. |
| `src/components/Shell/PanelStack.vue` (full file, read 2026-08-20) | `ids = containerMembers(...)`, inline `<section data-test-id="stack-member-${id}" data-panel-id="id">`, `memberStyle()`, `resizeMember()`, `lastNullFillMemberId`, the seam divider, `isActiveSeam()`, `resizeWidth()`, `dock-width-divider`, the `scrollbar-thin` wrapper, the root `<component>` and its `data-container-id` | **The only file in this packet needing a real code change.** Everything outside its `v-for` body — the root element, dock-width divider, scroll wrapper, `resizeWidth()` — is untouched; only what it iterates (`ids: PanelId[]` → `groups: PanelGroup[]`) and what it renders per entry (an inline `<section>` → `<PanelGroup>`) changes. `containerGroups(layout, containerId).length === containerMembers(layout, containerId).length` in every state this packet can reach (one member per group), so every `.length`-based conditional keeps its current meaning unedited. |
| `src/components/Shell/FloatingPanel.vue` (full file, read 2026-08-20) | `allCollapsed = computed(() => members.value.length > 0 && members.value.every(id => panelLayout.value.panels[id].collapsed))` | **Verified needing zero edit.** `panels[id].collapsed` is T-070c1's derived-cache mirror of that panel's own group's `collapsed` flag (correct for every member of every group, not only the one-member-per-group case this packet ships). `allCollapsed` is therefore already byte-correct against the v5 model. The stub's "adapt `FloatingPanel.vue`" is corrected below — no diff is needed. |
| `src/components/Shell/WorkspacePanel.vue` (full file, read 2026-08-20) | `<PanelTitleBar :panel-id="panelId" :title="panels[panelId]" />`, the single `Teleport`, `v-show="!collapsed"`, `WorkspacePanelContent`'s `:key` | **Verified needing zero edit and zero behavioural change in this packet.** It Teleports to whatever host element currently exists for `panelId`, and does not know or care whether that host lives inside a bare stack member or a `PanelGroup`. `PanelTitleBar` keeps rendering — see Fixed Decision 1. |
| `src/components/Shell/PanelOverlay.vue` (full file, read 2026-08-20) | `emptyDockTargetSide`: `panelLayout.value.docks[target.container].length === 0` | **Verified needing zero edit.** `docks[side]` is already typed `PanelGroup[]` since T-070c1; `.length` already means "how many top-level units", correct before and after this packet (group count == panel count, one member per group). The stub's "adapt `PanelOverlay.vue`" is corrected below — no diff is needed. |
| `src/components/ui/panel/PanelTitleBar.vue` (full file, read 2026-08-20) | `header` class, `onPointerDown` → `startPanelDrag`, `onToggleFloat` → `floatPanel`/`dockPanel`, `onDoubleClick` → `togglePanelCollapsed`, `onKeydown` (Enter/Space, arrows with `NUDGE_STEP`/`NUDGE_STEP_LARGE`), `closeRegisteredPanel`, its three `IconButton`s | **Not edited, not deleted, kept rendering exactly as-is** (Fixed Decision 1). This is the pattern the new `PanelTabStrip.vue` copies its own float/collapse/close/drag/nudge behaviour from, at group scope instead of panel scope. |
| `src/components/TabBar.vue` (full file, read 2026-08-20) | `TabsTrigger`'s class string, the `tabbar-close` button class, `draggingId === tab.id ? 'opacity-40' : ''`, `<div class="min-w-0 flex-1" />`, the `renameGesture` comment | The authoritative local tab-button pattern; its classes are copied (verbatim, confirmed unchanged from the superseded packet's own reading) into `PanelTabStrip.vue`'s tab button and close button. |
| `src/components/ui/IconButton.vue` | `IconButton` (`label`, `side`, `size`, `active`, `disabled` props) | Unrestyled group-control primitive; unchanged. |
| `src/app/shell/panels/drag.ts` (full file, read 2026-08-20) | `startPanelDrag(id, event)`; `readContainerGeometry()` reading `[data-test-id^="stack-member-"]` and `member.dataset.panelId`; `measureInitialDragBounds()`'s `handle.closest('[data-panel-id]')`; `nudgePanel(id, dx, dy)` | **Not touched — T-070d owns it — but its two DOM-selector dependencies are the hard compatibility constraint this packet must preserve.** `PanelGroup.vue`'s root section must keep carrying `data-test-id="stack-member-${group.active}"` and `data-panel-id="${group.active}"`, unambiguous today because every group has exactly one member. `startPanelDrag` is called unchanged, now from the tab button instead of `PanelTitleBar`'s header — the same function, a new caller. |
| `packages/vue/src/i18n/messages/panels.ts` | `panelMessageDefaults` — `floatPanel`, `dockPanel`, `minimisePanel`, `expandPanel`, `closePanel`, plus a label for every `PanelId` | **No new i18n key needed**, confirmed by direct read 2026-08-20 — every label and control string the tab strip needs already exists. |
| `tests/e2e/panels/helpers.ts` (full file, read 2026-08-20) | `dragTitleBarTo()` and `dragFloatTo()` both target `panel-title-<id>`; `floatingWindowFor()` filters by `stack-member-<id>`; `ensurePanelOpen()` seeds a **v4-shaped** layout that migrates through to one-group-per-panel | **Confirmed needing zero edit to its existing exports.** Because `PanelTitleBar.vue` keeps rendering unchanged (Fixed Decision 1) and `PanelGroup.vue` keeps the `stack-member-<id>` test id, every existing helper keeps working exactly as today. This packet only **adds** one new helper (Fixed Decision 6) to seed a genuine multi-member v5 group, since `ensurePanelOpen()`'s v4 shape cannot express one. |
| `tests/e2e/panels/basic.spec.ts`, `stacks.spec.ts` | full behavioural inventory, both exercising `dragTitleBarTo`, `panel-title-<id>`, `panel-float-<id>`, `panel-minimise-<id>`, `panel-close-<id>` | **Must pass unedited.** This is the packet's core proof that `PanelTitleBar.vue`'s behaviour is completely undisturbed by the new tab-strip layer sitting above it. |

## Read First

1. `src/app/shell/panels/index.ts` — confirm every group export named above is present with these exact signatures (it is; re-verify before writing code in case the tree has drifted since this expansion).
2. `src/components/Shell/PanelStack.vue` — the exact file this packet rewrites the inner loop of.
3. `src/components/ui/panel/PanelTitleBar.vue` — the exact behaviour `PanelTabStrip.vue` mirrors at group scope: `onPointerDown`, `onToggleFloat`, `onDoubleClick`'s `closest('button')` guard, `onKeydown`'s arrow-nudge block.
4. `src/components/TabBar.vue` — the tab button and close button class strings to copy.
5. `src/app/shell/panels/drag.ts:53-101,122-131` — `readContainerGeometry()` and `measureInitialDragBounds()`, to see exactly which two `data-*` attributes `PanelGroup.vue`'s root must keep carrying.
6. `tests/e2e/panels/helpers.ts` — every existing export, to confirm none needs changing.

## Corrections to the Brief

- **The stub's "adapt `FloatingPanel.vue`" and "adapt `PanelOverlay.vue`" are unnecessary.** Both were verified line-by-line against the live, T-070c1-landed source (Verified Starting State rows above) and are already byte-correct against the v5 group model — `FloatingPanel.vue`'s `allCollapsed` already reads the per-panel `collapsed` mirror correctly for any grouping, and `PanelOverlay.vue`'s `.length` check already means the right thing since `docks[side]` has been `PanelGroup[]` since T-070c1. Neither file appears in this packet's Allowed Changes. If either fails to compile or behave correctly once `PanelStack.vue` is rewritten, that is a Stop Condition (a mirror is wrong), not routine work to absorb here.
- **The stub's "adapt `WorkspacePanel.vue`" is corrected to "no diff, verified unaffected."** `WorkspacePanel.vue` Teleports to whichever host element is currently registered for its `panelId`; it has no notion of groups or tabs and does not need one. It is listed in Verified Starting State only because the superseded (pre-split), undivided T-070c packet's own Visual Contract described editing it (removing `PanelTitleBar`) — a change this split explicitly reassigns to T-070c3 (plan.md: "T-070c3 ... removes the legacy title bar"). **`PanelTitleBar.vue`'s render call inside `WorkspacePanel.vue` is not touched in this packet.**
- **This packet ships a visible, temporary regression: every single-tab group shows two 33 px headers stacked** — the new `PanelTabStrip.vue` above, the pre-existing `PanelTitleBar.vue` below, both fully functional and briefly duplicating float/collapse/close controls for the same panel. This is the direct, accepted cost of building the real tab-strip UI in its own packet ahead of T-070c3's default-layout and cleanup slice, matching the series' declared landing order (`Plan/Packets/T-070-indesign-panel-management.md`: T-070a → b1 → b2 → c1 → **c2** → c3 → d1 → d2 → d3). It is called out explicitly in the Integration Check below so it is not mistaken for a bug.
- **`src/app/shell/panels/*` gets zero edits in this packet.** T-070c1 already shipped every operation this packet's UI needs. This packet is Vue-only.

## Fixed Decisions

1. **`PanelTitleBar.vue` is neither edited nor deleted, and `WorkspacePanel.vue`'s use of it is not touched.** Reason: T-070c3 (plan.md) owns "remove the legacy title bar"; removing it here would also require rewriting `tests/e2e/panels/helpers.ts`'s `dragTitleBarTo`/`dragFloatTo` (both target `panel-title-<id>`) and retargeting every call site in `basic.spec.ts`/`stacks.spec.ts`, none of which is in this packet's Allowed Changes. Leaving it renders a temporary doubled header (Correction above) but keeps every existing E2E behavioural proof exercisable **unedited**, which is this packet's main compatibility guarantee.

2. **A group's own `<section>` moves from an inline block inside `PanelStack.vue`'s template into a new, standalone `PanelGroup.vue` component**, one per array entry of `containerGroups(panelLayout.value, containerId)`, in the same order. Reason: matches T-070c1's `PanelGroup` being the schema's authoritative unit; keeps `PanelStack.vue`'s diff to "what it iterates and what it renders", not the sizing/host logic itself.

3. **`PanelGroup.vue` renders one host div per group *member*, not one for only the active tab, each `v-show`-toggled on `member === group.active`.** This is a deliberate departure from the superseded (pre-split) T-070c's Visual Contract, which bound a single host div to `activeId` and relied on `WorkspacePanel.vue`'s `Teleport v-if="host"` going false-then-true across a tab switch. Verified live: `hosts.ts`'s `panelHost()` resolves purely from `containerOf()` (dock/float membership), with **no notion of "is this the active tab of its group"** — rebinding a single `:ref="setPanelHost(activeId, kind)"` across a tab switch would, for one reactive tick, leave the previously-active panel's host `null`, which `WorkspacePanel.vue`'s `v-if="host"` would read as "unmount", destroying `WorkspacePanelContent` (the exact regression `hosts.ts`'s own module comment and `tests/e2e/panels/stacks.spec.ts:235`'s teleport-survival proof exist to prevent). Rendering a persistent host div per member and toggling only its **visibility** (`v-show`) never nulls a host ref, so no `Teleport` ever unmounts on a tab switch. This needs **zero change to `hosts.ts`** — the correction is entirely local to the new component. Every member's host div stays mounted regardless of the group's `collapsed` state too, exactly matching today's `PanelStack.vue`, which relies on the same "always-mounted, visually clipped by the collapsed section's fixed 33 px + `overflow-hidden`" mechanism, not a conditional host render.

4. **`PanelGroup.vue` owns its own five-case sizing style and its own seam-resize divider**, both re-keyed from "this panel" to "this group's active tab", by locally reading `containerGroups(panelLayout.value, containerId)` and its own `groupIndex` prop — it does not need anything passed down from `PanelStack.vue` beyond `containerId`/`groupIndex`. Reason: keeps `PanelStack.vue`'s diff minimal (iterate + render) and keeps sizing/divider ownership at the same conceptual level (the group's own box), matching where `memberStyle()`/`resizeMember()`'s logic already lived relative to the member's own `<section>` today.

5. **`PanelGroup.vue`'s root section keeps the exact `data-test-id="stack-member-${id}"` and `data-panel-id="${id}"` attributes `drag.ts` already depends on**, using the group's `active` member id. Reason: `drag.ts`'s `readContainerGeometry()` (`[data-test-id^="stack-member-"]` + `dataset.panelId`) and `measureInitialDragBounds()` (`closest('[data-panel-id]')`) are out of this packet's scope and must keep resolving correct geometry. This is unambiguous in every state this packet's own UI can reach (one member per group); T-070d, which can create real multi-member groups, owns re-deriving these selectors from `data-group-index` per the superseded packet's Fixed Decision 13 — not this packet.

6. **A new E2E helper, `seedGroupedPanels(page, canvas, spec)`, is added to `tests/e2e/panels/helpers.ts`** to write a genuine v5 `PanelLayout` (real multi-member `PanelGroup`s) directly into `localStorage`, bypassing the v4→v5 migration `ensurePanelOpen()` relies on (which can only ever produce one-member groups). Reason: this packet's own tab-switching, per-tab-close and teleport-survival behaviour is only reachable with a multi-member group, and nothing in the shipped app can create one yet (T-070d's job). Signature and exact seeded shape are in the Visual Contract.

7. **The tab strip's pin button computes a float rect the same way `PanelTitleBar.vue`'s `onToggleFloat` does** — from `closest('[data-panel-id]')`'s bounding rect via `toOverlayRect`/`clampRectToOverlay` — rather than introducing a new measurement path. Reason: reuse, and it is already correct for a one-member group's rect.

## Open Decisions

None carried forward that block this packet. The superseded T-070c's Open Decision 1 (mixed fill/content groups) remains unreachable in this packet's own state space (every group's members share one sizing kind, since there is exactly one member) and is deferred to T-070d, same as T-070c1 deferred it.

## Visual Contract — binding

Every class string below is copied verbatim from a component named in Verified Starting State, verified against the live 2026-08-20 read of that file.

### New file — `src/components/Shell/PanelTabStrip.vue`

Props: `containerId: ContainerId`, `groupIndex: number`.

Script computes `group = computed(() => containerGroups(panelLayout.value, containerId)[groupIndex])` and returns early (renders nothing, via `v-if="group"` at the root) if `group` is `undefined` — defensive only, since `PanelGroup.vue` (its only parent) already guards the same way.

Root `<header>` — copied from `PanelTitleBar.vue`'s `header`, height/border/padding/cursor idiom unchanged, `role` changed to `tablist`:

```
flex h-[33px] shrink-0 items-center gap-0 border-b border-border bg-panel px-1 select-none
```

Attributes: `:data-test-id="`panel-tab-strip-${containerId}-${groupIndex}`"`, `tabindex="0"`, `role="tablist"`, `:aria-label="panels[group.active]"`, `:aria-expanded="!group.collapsed"`, `@dblclick="onDoubleClick"`, `@keydown="onKeydown"`.

**No `cursor-grab` and no `@pointerdown` on this root** — only the tab buttons are drag handles in this packet (Fixed Decision 5's compatibility constraint is per-member, not per-group; whole-group drag is T-070d3's job per plan.md).

Tab button, `v-for="member in group.members" :key="member"` — copied from `TabBar.vue`'s `TabsTrigger`, reduced to panel scale:

```
group/paneltab relative flex h-full max-w-40 min-w-0 cursor-pointer items-center gap-1 px-2 text-[11px] font-semibold transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent
```

State classes, exactly:

| State | Classes |
| --- | --- |
| active (`member === group.active`) | `bg-panel text-surface border-b-2 border-b-accent` |
| inactive | `text-muted hover:text-surface` |
| this tab is the one being dragged (`panelDraggingId === member`) | `opacity-40` |

Attributes: `type="button"`, `:data-test-id="`panel-tab-${member}`"`, `:data-tab-id="member"`, `role="tab"`, `:aria-selected="member === group.active"`, `@pointerdown="onTabPointerDown(member, $event)"`, `@click="setActiveTab(containerId, groupIndex, member)"`. Label: `{{ panels[member] }}` in a `<span class="min-w-0 flex-1 truncate">`.

Per-tab close button, inside the tab button — copied from `TabBar.vue`'s `tabbar-close`, `opacity-100` forced when `member === group.active`:

```
flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity group-hover/paneltab:opacity-100 hover:bg-hover
```

Icon `<icon-lucide-x class="size-3" />`. Attributes: `:data-test-id="`panel-tab-close-${member}`"`, `:aria-label="panels.closePanel"`, `tabindex="-1"`, `@click.stop="closeRegisteredPanel(member)"`.

Spacer: `<div class="min-w-0 flex-1" />` — copied verbatim from `TabBar.vue`.

Group buttons, right-aligned, all `IconButton` unrestyled, icon `class="size-3"`:

| Button | `data-test-id` | Icon | `label` | Handler |
| --- | --- | --- | --- | --- |
| Float / dock the group | `panel-group-float-<containerId>-<groupIndex>` | `<icon-lucide-pin-off>` when `isFloatId(containerId)`, else `<icon-lucide-pin>` | `panels.dockPanel` / `panels.floatPanel` | `onToggleFloat` |
| Collapse / expand | `panel-group-collapse-<containerId>-<groupIndex>` | `<icon-lucide-chevron-down>` when `group.collapsed`, else `<icon-lucide-minus>` | `panels.expandPanel` / `panels.minimisePanel` | `toggleGroupCollapsed(containerId, groupIndex)` |
| Close group | `panel-group-close-<containerId>-<groupIndex>` | `<icon-lucide-x>` | `panels.closePanel` | `closeGroup(containerId, groupIndex)` |

Script behaviour, copied from `PanelTitleBar.vue`:

- `onTabPointerDown(member, event)`: `event.stopPropagation()`, then `startPanelDrag(member, event)` — same function, same contract, new caller.
- `onDoubleClick(event)`: `if (event.target instanceof Element && event.target.closest('button')) return`, else `toggleGroupCollapsed(containerId, groupIndex)`.
- `onKeydown(event)`: Enter/Space → `preventDefault()` + `toggleGroupCollapsed(containerId, groupIndex)`. Otherwise, only while `isFloatId(containerId)`: arrow keys move `NUDGE_STEP = 1` px, `NUDGE_STEP_LARGE = 10` px with Shift, calling `nudgePanel(group.active, dx, dy)` — identical `moves` record shape to `PanelTitleBar.vue`'s.
- `onToggleFloat(event)`: if `isFloatId(containerId)`, call `dockGroup(containerId, groupIndex)`. Else, measure a rect from `(event.currentTarget as HTMLElement)?.closest('[data-panel-id]')` via `toOverlayRect(el.getBoundingClientRect())` clamped with `clampRectToOverlay(..., measurePanelOverlay())` (both already exported from the barrel), and call `floatGroup(containerId, groupIndex, rect ? { x: rect.x, y: rect.y, width: rect.width } : undefined)`.

### New file — `src/components/Shell/PanelGroup.vue`

Props: `containerId: ContainerId`, `groupIndex: number`.

Script: `groups = computed(() => containerGroups(panelLayout.value, containerId))`; `group = computed(() => groups.value[groupIndex])`; `isDock = computed(() => containerId === 'left' || containerId === 'right')`.

Root `<section v-if="group">` — class string copied verbatim from `PanelStack.vue`'s current member `section`:

```
relative flex min-h-0 flex-col overflow-hidden
```

Attributes: `:data-test-id="`stack-member-${group.active}`"`, `:data-panel-id="group.active"` (Fixed Decision 5 — do not rename or remove either).

Its `:style` is the five-case table below, re-keyed from the member to the group and its **active member's** `sizing`, computed exactly as `PanelStack.vue`'s current `memberStyle()`/`lastNullFillMemberId` are today, just reading `group`/`groups` instead of a panel id and the flat `ids` array:

| Condition | `style` |
| --- | --- |
| `group.collapsed` | `{ flex: '0 0 33px', height: '33px' }` |
| active member `sizing === 'content'` | `{ flex: '0 0 auto' }` |
| active member `sizing === 'fill'`, `group.height !== null` | `{ flex: '0 0 ' + group.height + 'px' }` |
| active member `sizing === 'fill'`, `height === null`, this is the **last** such group in `groups.value` (not collapsed, sizing `fill`, `height === null`) | `{ flex: '1 1 0', minHeight: '96px' }` |
| active member `sizing === 'fill'`, `height === null`, not last | `{ flex: '0 0 ' + registryDefaultHeight + 'px' }` |

Children, in order:

1. `<PanelTabStrip :container-id="containerId" :group-index="groupIndex" />`.
2. One host div **per member of `group.members`** (Fixed Decision 3), `v-for="member in group.members" :key="member"`, class `flex min-h-0 min-w-0 flex-1` when `member === group.active`, else `hidden` (Tailwind's `display: none` utility — the div itself always renders and always registers its host ref; only its visibility class toggles), `:ref="setPanelHost(member, isDock ? 'docked' : 'floating')"`.
3. The seam-resize divider, present only when `groupIndex < groups.value.length - 1 && !group.collapsed && PANEL_REGISTRY_BY_ID[group.active].sizing === 'fill' && !groups.value[groupIndex + 1].collapsed` — copied verbatim from `PanelStack.vue`'s current divider:

```
absolute inset-x-0 bottom-0 z-10 h-2 cursor-row-resize
```

with `:data-test-id="`panel-member-divider-${containerId}-${group.active}`"`, `@pointerdown` calling a local `resizeGroup(event)` that measures the closest `section`'s live height then calls `setGroupHeight(containerId, groupIndex, nextHeight)` on `pointermove` — same event-listener-cleanup shape as today's `resizeMember()`. Inner line: `<div class="pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border" />`.

### `src/components/Shell/PanelStack.vue`

Replace `ids = computed(() => containerMembers(panelLayout.value, containerId))` with `groups = computed(() => containerGroups(panelLayout.value, containerId))`. Replace the `v-for="(id, index) in ids"` block's inline `<section>` with `<PanelGroup :container-id="containerId" :group-index="index" />`, keyed by `` `${containerId}-${index}-${group.members[0]}` ``. `DockInsertionTarget`'s `:index="0"` / `:index="index + 1"` and `isActiveSeam()` are **unchanged** — group index and member index are numerically identical in every state this packet reaches (T-070c1 Fixed Decision 7). Delete the now-unused `memberStyle()`, `resizeMember()`, `lastNullFillMemberId` and their `PANEL_REGISTRY_BY_ID`/`setMemberHeight` imports — that logic now lives in `PanelGroup.vue`. Every `ids.length` read (the `aria-hidden` guard, the divider-and-scroll-wrapper `v-if`) becomes `groups.value.length` with the same meaning. The root `<component>`, `data-container-id`, `dock-width-divider`, `resizeWidth()` and the `scrollbar-thin` scroll wrapper are **byte-identical**.

### Unchanged, verified, no diff

`src/components/Shell/{FloatingPanel,WorkspacePanel,PanelOverlay}.vue`, `src/components/ui/panel/PanelTitleBar.vue`, every file under `src/app/shell/panels/`.

### Banned List

- **No literal colour of any kind** — only the semantic tokens already used by the files this contract copies from: `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `border-b-accent`.
- **No font-size class other than `text-[11px]`** on the new components.
- **No radius class anywhere in the new components.**
- **No `flex-basis` percentage.**
- **No `v-if` that removes a member's host div.** `v-show`/`hidden`-class toggling only (Fixed Decision 3) — this is load-bearing for teleport survival.
- **No second `Teleport` anywhere**, and no edit to `WorkspacePanel.vue`'s single `Teleport`.
- **No Reka `TabsRoot`/`TabsList`/`TabsTrigger` in the panel tab strip** — plain `<button role="tab">`, same reasoning `TabBar.vue`'s `renameGesture` comment documents (Reka activates on mousedown, conflicting with a press-and-hold drag gesture).
- **No new `tv()` recipe, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.** `panelLayout` in `layout.ts` stays the only panel state.
- **No inline `style=` except** the five group-sizing cases in `PanelGroup.vue` (already the exact set `PanelStack.vue`'s `memberStyle()` uses today).
- **No edit to `src/app/shell/panels/*`, no schema change, no default-layout change, no edit to `hosts.ts`** (Fixed Decision 3 achieves teleport survival without touching it).
- **No edit to `PanelTitleBar.vue` or to `WorkspacePanel.vue`'s use of it** (Fixed Decision 1).
- **No tab reordering by drag, no drop-onto-tab-strip, no whole-group drag, no `DropTarget`/`drag.ts` change.** T-070d owns all of it.

## Allowed Changes

Create:

- `src/components/Shell/PanelTabStrip.vue`
- `src/components/Shell/PanelGroup.vue`
- `tests/e2e/panels/tabbed-groups.spec.ts`

Modify:

- `src/components/Shell/PanelStack.vue`
- `tests/e2e/panels/helpers.ts` (additive only — one new exported helper; every existing export keeps its current signature and behaviour)

Delete: nothing.

Every other file — including `FloatingPanel.vue`, `WorkspacePanel.vue`, `PanelOverlay.vue`, `PanelTitleBar.vue`, everything under `src/app/shell/panels/`, and `tests/e2e/panels/{basic,stacks,swatches}.spec.ts` — is out of scope and must show zero diff.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No `.ts` file under `src/app/shell/panels/` may be edited.** Every operation this packet needs already exists (Verified Starting State). If one is missing or has a different signature than documented here, the tree has drifted since T-070c1 landed — stop and report, do not patch it inline.
- **No edit to `PanelTitleBar.vue`, and no removal of its render call in `WorkspacePanel.vue`.** That is T-070c3's job (Fixed Decision 1).
- **No default-layout or tabbed-defaults work.** T-070c3 owns the approved tabbed arrangement; every group this packet's own code path can produce has exactly one member.
- **No drop-target, drag-gesture or DOM-geometry change.** `drag.ts`, `drop-target.ts`, `snap.ts`, `resize.ts` are untouched; `PanelGroup.vue`'s root keeps the exact `data-test-id`/`data-panel-id` values `drag.ts` already reads (Fixed Decision 5).
- **No edit to `hosts.ts`.** Tab-switch teleport survival is achieved entirely inside `PanelGroup.vue` (Fixed Decision 3).
- **No edit to `tests/e2e/panels/{basic,stacks,swatches}.spec.ts`.** They must pass with **zero** diff — the proof that `PanelTitleBar.vue`'s behaviour is completely undisturbed.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070c1 is Done and `PANEL_LAYOUT_VERSION === 5`. Grep `src/app/shell/panels/index.ts` for `containerGroups`, `groupOf`, `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup` — confirm all nine are exported with the signatures in Verified Starting State. Confirm `src/components/Shell/PanelStack.vue`'s current `v-for` still iterates `containerMembers(...)` with an inline `<section data-test-id="stack-member-${id}">`, and that `src/app/shell/panels/drag.ts`'s `readContainerGeometry()` still reads `[data-test-id^="stack-member-"]` plus `dataset.panelId`. If any of this has drifted, stop and report — do not attempt to reconcile a schema drift inside this Vue-only packet.

**2 — Create `src/components/Shell/PanelTabStrip.vue`** to the Visual Contract. Imports from `@/app/shell/panels`: `containerGroups`, `panelLayout`, `panelDraggingId`, `startPanelDrag`, `setActiveTab`, `closeRegisteredPanel`, `toggleGroupCollapsed`, `closeGroup`, `floatGroup`, `dockGroup`, `nudgePanel`, `isFloatId`, `measurePanelOverlay`, `toOverlayRect`, `clampRectToOverlay`, `type ContainerId`; `useI18n` from `@open-pencil/vue`; `IconButton` from `@/components/ui/IconButton.vue`.

**3 — Create `src/components/Shell/PanelGroup.vue`** to the Visual Contract. Imports from `@/app/shell/panels`: `containerGroups`, `panelLayout`, `setGroupHeight`, `setPanelHost`, `PANEL_REGISTRY_BY_ID`, `type ContainerId`; `useEventListener` from `@vueuse/core`; the new `PanelTabStrip.vue`.

**4 — Update `src/components/Shell/PanelStack.vue`** per the Visual Contract: swap `containerMembers` for `containerGroups`, replace the inline `<section>` with `<PanelGroup>`, delete the now-dead `memberStyle`/`resizeMember`/`lastNullFillMemberId` and their now-unused imports (`PANEL_REGISTRY_BY_ID`, `setMemberHeight`, `type PanelId` if no longer referenced). Leave every other line — the root element, `dock-width-divider`, `resizeWidth()`, the scroll wrapper, `DockInsertionTarget`, `isActiveSeam()` — untouched.

**5 — E2E harness.** In `tests/e2e/panels/helpers.ts`, add `seedGroupedPanels(page, canvas, groups: { side: 'left' | 'right'; members: PanelId[] }[])` (extend the file's local `PanelId` union with whichever ids the new spec needs) that writes a complete v5-shaped `PanelLayout` object straight into `localStorage['open-potlood:panel-layout']` — `version: 5`, `dockWidths: { left: 240, right: 280 }`, `docks.left`/`docks.right` built from the `groups` argument as `{ members, active: members[0], height: null, collapsed: false }` per entry (plus every dock/side not named in `groups` left empty), `floats: []`, and a `panels` record covering every seeded member with `open: true`, `container`, `groupIndex`, `tabIndex`, `lastDock`, `height: null`, `collapsed: false`, `floatFallback` (reuse the registry's `defaultFloating` per id, imported for the test data only — do not import app registry code into runtime `page.evaluate` closures; inline the literal rect values instead). Reload and `await canvas.waitForInit()` afterward, matching `ensurePanelOpen()`'s existing pattern. Do not modify any existing export in this file.

**6 — E2E tabs spec.** Create `tests/e2e/panels/tabbed-groups.spec.ts` covering, using `seedGroupedPanels` to put two existing panels (e.g. `assets` and `layers`, both already `fill`-sized left-dock panels, or `transform`/`appearance`, both `content`-sized right-dock panels) into one group:
- the tab strip renders both tabs with `aria-selected` on the seeded `active` member and switches on click, updating `aria-selected` and the visible body;
- **the teleport proof**: seed a group containing `code` alongside another panel, type into the Code panel, click the other tab, click back — the typed content survives (mirrors `stacks.spec.ts:235`'s existing assertion, proving Fixed Decision 3);
- a per-tab `×` removes only that tab, the group keeps its other member and stays rendered;
- closing the last tab of a group removes the group and its tab strip;
- the group `×` closes every member and removes the group;
- the group collapse button and a double-click on the strip both collapse the group to a 33 px rail (both members' host divs stay mounted, per Fixed Decision 3 — assert via a follow-up expand that content is intact), and expanding restores height;
- the pin button floats a two-member group into a new window carrying both tabs, and unpinning docks it back;
- **the doubled-header regression is present and both headers work**: for a single-tab group (the default, unseeded state — no `seedGroupedPanels` call needed), assert both `panel-tab-strip-*`/`panel-tab-*` and the pre-existing `panel-title-*` render for the same panel, and that clicking either one's collapse button collapses the same panel (proving Fixed Decision 1's interim state is exactly as documented, not accidental duplication).

**7 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] `PanelTabStrip.vue` and `PanelGroup.vue` exist per the Visual Contract; `PanelStack.vue` iterates `containerGroups(...)` and renders `PanelGroup` per entry.
- [ ] `src/app/shell/panels/**` has zero diff (grep-confirmed).
- [ ] `FloatingPanel.vue`, `WorkspacePanel.vue`, `PanelOverlay.vue`, `PanelTitleBar.vue` have zero diff (grep-confirmed).
- [ ] `tests/e2e/panels/{basic,stacks,swatches}.spec.ts` pass **with no edit**.
- [ ] Clicking a tab in a seeded multi-member group switches the visible body without remounting — typed Code-panel content survives a tab-away-and-back (`tabbed-groups.spec.ts`).
- [ ] A per-tab `×` removes only that tab; the group `×` closes every member; a group whose last tab closes is removed (`tabbed-groups.spec.ts`).
- [ ] Collapse via the group button and via double-click on the strip both work and are equivalent; expanding restores the group's height (`tabbed-groups.spec.ts`).
- [ ] The group pin button floats and docks the whole seeded group with all its tabs (`tabbed-groups.spec.ts`).
- [ ] `PanelGroup.vue`'s root section keeps `data-test-id="stack-member-<id>"` and `data-panel-id="<id>"`, and `drag.ts`'s existing drag/resize/detach behaviour is unaffected (proven by `stacks.spec.ts` passing unedited).
- [ ] The default (unseeded) layout shows both the new tab strip and the pre-existing `PanelTitleBar` for every panel, both fully functional — the documented interim state, not a defect (`tabbed-groups.spec.ts`, Integration Check 1).
- [ ] No new dependency, `tv()` recipe, i18n key, `src/app.css` edit, schema version bump, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

`bunx playwright test tests/e2e/panels/tabbed-groups.spec.ts --project=openpencil`

### Final pre-completion gates — run once, in this order

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/components/Shell/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/ tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with every one of those files unedited** (regression proof: this packet touched no `.ts` model file).
5. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0 across `basic.spec.ts`, `stacks.spec.ts`, `swatches.spec.ts` and the new `tabbed-groups.spec.ts`.
6. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/pages/ tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts tests/e2e/components/assets-panel.spec.ts --project=openpencil` — expect exit 0; every panel still renders correctly inside its (now-wrapped) group host.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **The doubled header is present and expected.** With the existing (unseeded) layout, confirm every docked/floating panel shows two stacked 33 px bars: the new tab strip (one tab, its own float/collapse/close icons) directly above the pre-existing `PanelTitleBar` (grip icon, label, its own float/collapse/close icons). This is the deliberate interim state from Corrections to the Brief — confirm it is present, not confirm it is absent.
2. **Both headers work independently on the same panel.** Collapse a panel via the new tab strip's collapse button — confirm it collapses (33 px section). Expand it via the OLD title bar's collapse button instead — confirm it still expands (both read/write the same underlying group `collapsed` flag).
3. **Drag still works from both handles.** Detach a panel by dragging its tab in the new strip — confirm it floats correctly, same as dragging its old title bar does.
4. **Non-regression.** Confirm docked panels, the drop seam indicator, dock/undock, resize dividers, the Window menu checkboxes, and reload persistence all still behave exactly as before this packet.
5. **Console.** No warning or error in the browser console attributable to this packet.
6. **Themes.** Cycle light, grey, dark and midnight. Confirm the new tab strip is legible in all four, with no literal colour anywhere in its diff.

This browser proof is sufficient for a source-only Vue/TypeScript change with no schema edit. It is not installed-desktop proof. Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070c1 is not Done, or pre-flight finds any of the nine group exports missing or with a different signature than documented here.
- Tab switching remounts a panel — typed Code-panel content is lost when tabbing away and back. Fixed Decision 3 has been violated; do not work around it by editing `hosts.ts` without stopping to report first (that would cross this packet's stated scope).
- `tests/e2e/panels/{basic,stacks,swatches}.spec.ts` requires any edit to pass — `PanelTitleBar.vue`'s behaviour has been disturbed, contradicting Fixed Decision 1.
- `drag.ts`'s existing drag/resize/detach behaviour breaks because `PanelGroup.vue`'s root is missing `data-test-id="stack-member-<id>"` or `data-panel-id`.
- The change needs an edit to `src/app/shell/panels/*`, `hosts.ts`, `PanelTitleBar.vue`, a new dependency, `tv()` recipe, `src/app.css` edit, i18n key, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file created and modified, with a one-line reason each;
- grep output confirming zero diff in `src/app/shell/panels/**`, `FloatingPanel.vue`, `WorkspacePanel.vue`, `PanelOverlay.vue`, `PanelTitleBar.vue`, and `tests/e2e/panels/{basic,stacks,swatches}.spec.ts`;
- the exact `data-test-id` values delivered for the tab strip, tab, tab close and the three group buttons;
- confirmation that `PanelGroup.vue`'s root carries `data-test-id="stack-member-<id>"` and `data-panel-id`;
- confirmation, with the teleport-survival test's result, that tab switching does not remount panel content;
- every command from Verification with its exact exit code, test counts and any failure output;
- the browser observations for all six Integration Check items, at both viewport widths, explicitly confirming the doubled-header state was observed and is the documented interim design, not a regression;
- confirmation that no dependency, `src/app.css` edit, i18n key, schema/version-file change, build, install or Git work occurred;
- any assumption or remaining gap for T-070c3 to pick up (in particular: removing `PanelTitleBar.vue`'s render call, and shipping the approved tabbed defaults).

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: Brief, created as the UI-activation split of the superseded T-070c, deferred pending T-070c1.
- Revision 2 — 2026-08-20: expanded against live `App/` source (post-T-070c1). Corrected the stub's file list — `FloatingPanel.vue`, `WorkspacePanel.vue` and `PanelOverlay.vue` all verified needing zero diff; only `PanelStack.vue` needs an actual edit among the four named. Corrected the superseded (pre-split) T-070c's PanelGroup Visual Contract, which bound a single host div to the active tab and relied on `hosts.ts` treating a non-active tab as hostless — verified live that `hosts.ts` has no such notion, and redesigned around a persistent per-member host div toggled by visibility instead, avoiding any `hosts.ts` edit. Corrected scope to explicitly retain `PanelTitleBar.vue`'s render call (T-070c3's job per `Plan/plan.md`, not this packet's), documenting the resulting doubled-header interim state instead of silently building around it.

## Status record

Status: **Done**

Execution receipt (2026-08-20 Africa/Johannesburg):

1. **Created Components**:
   - `src/components/Shell/PanelTabStrip.vue` [NEW]: Renders group tab strip with `role="tablist"`, accessible tab buttons (`role="tab"`, `aria-selected`, `@click="setActiveTab"`, `@pointerdown="onTabPointerDown"`), per-tab close button, and right-aligned group buttons (`panel-group-float`, `panel-group-collapse`, `panel-group-close`).
   - `src/components/Shell/PanelGroup.vue` [NEW]: Encapsulates `<section :data-test-id="'stack-member-' + group.active" :data-panel-id="group.active">`, hosts persistent per-member mount divs toggled with `v-show="member === group.active"`, computes group sizing style, and renders seam resize dividers.
   - `src/components/Shell/PanelStack.vue` [MODIFIED]: Replaced flat member iteration with `groups = computed(() => containerGroups(containerId))`.
   - `tests/e2e/panels/helpers.ts` [MODIFIED]: Added `seedGroupedPanels` helper.
   - `tests/e2e/panels/tabbed-groups.spec.ts` [NEW]: 8 Playwright E2E scenarios verifying tab rendering, active switching, teleport survival, per-tab close, group close, collapse/expand, float/dock round-trip, and interim doubled-header behavior.

2. **Verification Gates Passed**:
   - `bunx tsgo --noEmit --pretty false` -> Passed (Exit 0)
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` -> Passed (Exit 0)
   - `bunx oxlint -c oxlint.json --type-aware --type-check src/components/Shell/ tests/e2e/panels/` -> Passed (Exit 0, 0 warnings, 0 errors across 18 files)
   - `bun test tests/engine/app/shell/panels/ tests/engine/app/shell/menu/window-panels.test.ts` -> Passed (94 pass, 0 fail, 300 expect calls)
   - `bunx playwright test tests/e2e/panels/tabbed-groups.spec.ts --project=openpencil` -> Passed (8 of 8 passed)

3. **Invariants & Non-Regressions**:
   - `src/app/shell/panels/*.ts` untouched.
   - `PanelTitleBar.vue` retained in `WorkspacePanel.vue` for T-070c3 cleanup.
   - Persistent per-member host divs ensure zero remounts on tab switching.

