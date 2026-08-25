# T-070c - Container model v5: tabbed panel groups and a clean default layout

Task ID: T-070c
Packet state: Superseded — scope map only; execute T-070c1 through T-070c3
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-070a (sizing kinds and the v4 schema — land first), T-070b (the float window title bar — land first)
Related: T-070d (drop targeting for tabs — lands after this), T-031c (Done — this packet is its deferred revision), T-032 (Ready — consumes this barrel)
Prepared from: the user's 2026-08-20 InDesign-referenced panel request, requirement groups 1 and 4; third slice of the T-070 split
Expanded at: 2026-08-20 08:24 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/app/shell/panels/{types,registry,containers,operations,layout,drag,hosts,index}.ts`, `src/components/Shell/{PanelStack,FloatingPanel,PanelOverlay,WorkspacePanel,DockInsertionTarget}.vue`, `src/components/ui/panel/{PanelTitleBar.vue,index.ts}`, `src/components/TabBar.vue`, `src/components/ui/IconButton.vue`, `src/app/shell/menu/{use,app-menu}.ts`, `packages/vue/src/i18n/messages/panels.ts`, `src/app.css`, `tests/engine/app/shell/panels/*`, `tests/engine/app/shell/menu/window-panels.test.ts`, `tests/e2e/panels/*`
Delivery: named source gates + browser check

## Intended Outcome

Panels can be grouped into tabs. A **group** — a tab strip with one visible body — replaces the "one title bar per panel" stack as the unit that stacks, sizes, collapses and closes. Clicking a tab switches the body without remounting the panel. The default startup layout ships two tabbed groups and no Export panel, so the workspace reads as a tidy InDesign-style arrangement rather than five separate stacked strips.

## Request Coverage

Requirement groups 1 and 4 of the 2026-08-20 request, verbatim:

1. **Default Layout & Initial State**
   - Clean up the default startup layout so panels are neatly docked rather than cluttered.
   - Ensure the Export panel is closed by default on initial load.
4. **Tabbed Panels**
   - Introduce tabbed panel support, allowing multiple panels to be grouped and switched within the same tabbed container.

Group 5 landed in T-070a and group 3 in T-070b. Group 2 — drag-and-drop refactoring and drop-zone highlighting — belongs to T-070d. **After this packet, the only way to create a tab is the default layout; dragging a panel onto a tab strip is T-070d's job.** That is a deliberate, stated cut, not an oversight.

## Verified Starting State

State below is the live tree **as T-070b leaves it**. Rows marked *(pre-existing)* were verified directly on 2026-08-20; rows marked *(from T-070a/b)* name what those packets introduce and must be re-confirmed at pre-flight.

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/types.ts` | `PANEL_LAYOUT_VERSION` (4 after T-070a), `PanelLayout`, `FloatContainer.members: PanelId[]`, `RegisteredPanelState` with `open`, `container`, `index`, `lastDock`, `height`, `collapsed`, `floatFallback`; `PanelSizing` *(from T-070a)*; `PANEL_FLOAT_TITLE_HEIGHT = 24` *(from T-070b)*; `PANEL_COLLAPSED_HEIGHT = 33`, `PANEL_MEMBER_MIN_HEIGHT`, `PANEL_MEMBER_MAX_HEIGHT` | The schema. A container holds a **flat** `PanelId[]`; `height` and `collapsed` sit on the panel. This packet moves both onto the group. |
| `src/app/shell/panels/containers.ts` | `defaultPanelLayout()` (`DEFAULT_DOCKS = { left: ['pages','layers'], right: ['transform','appearance','page'] }`, `DEFAULT_OPEN = new Set(['pages','layers','transform','appearance','page'])`) *(pre-existing)*; `normaliseV4()` and its helpers `buildContainers`, `reinsertMissingOpenPanels`, `finaliseFloats`, `recomputeContainerCache`, `normaliseMemberHeights`; the `migrateV1ToV2` → `migrateV2ToV3` → `migrateV3ToV4` chain | The default layout and the invariant core. **`DEFAULT_OPEN` already excludes `export`** — see Corrections. |
| `src/app/shell/panels/operations.ts` | `normalisePanelLayout()` (version dispatcher), `movePanel(layout, id, target: ContainerId, index: number)`, `detachPanel()`, `openPanel()`, `closePanel()`, `togglePanelOpen()`, `setMemberHeight()` *(from T-070a)*, `setFloatRect()`, `raiseFloat()`, `setDockWidth()`, `dockPanel()`, `resetPanelLayout()`, `cloneLayout()`, `removeFromAllContainers()`, `insertIntoDock()`, `insertIntoFloat()`, `nextZ()` | Every pure operation. All are total, non-throwing, and return a normalised layout. `movePanel`'s doc comment records that one atomic path handles every kind of drop — preserve that. |
| `src/app/shell/panels/hosts.ts` | `HostKind = 'parking' \| 'docked' \| 'floating'`, `setPanelHost()`, `panelHost()`, the module comment: "Each panel is mounted once and teleported into whichever host is currently rendering it … Teleporting keeps the component instance alive across the move, so open tabs, scroll positions and chat streams survive docking and floating." | **The load-bearing constraint for tab switching.** A non-active tab must lose its host, not be `v-if`-ed away. |
| `src/components/Shell/PanelStack.vue` | `ids`, the member `section` with its five-case sizing style *(from T-070a)*, `isActiveSeam()`, the seam divider and `setMemberHeight` handler *(from T-070a)*, `resizeWidth()`, `dock-width-divider`, `data-container-id`, the `scrollbar-thin … overflow-y-auto` wrapper *(from T-070a)* | The shared stack renderer for docks **and** float bodies. It iterates panels today and iterates groups after this packet. |
| `src/components/Shell/WorkspacePanel.vue` | the single `Teleport` to `panelHost(panelId)`, `PanelTitleBar`, `v-show="!collapsed"`, `WorkspacePanelContent :key="`${panelId}-${activeTab?.id ?? 'none'}`"` | Mounts each panel body once. The `PanelTitleBar` element is removed here; the `Teleport` and the content `:key` are not. |
| `src/components/ui/panel/PanelTitleBar.vue` | `h-[33px]`, `onPointerDown` → `startPanelDrag`, `onToggleFloat` → `floatPanel`/`dockPanel`, `onDoubleClick` → `togglePanelCollapsed` with its `closest('button')` guard, `onKeydown` (Enter/Space collapse; arrows → `nudgePanel` with `NUDGE_STEP`/`NUDGE_STEP_LARGE`), `closeRegisteredPanel`, the three `IconButton`s with `icon-lucide-pin`/`pin-off`, `chevron-down`/`minus`, `x` | **The component being replaced by the tab strip**, and the exact source of every behaviour and icon the tab strip must carry. Repo-wide grep confirms `WorkspacePanel.vue` is its **only** consumer and that `src/components/ui/panel/index.ts` does **not** re-export it. |
| `src/components/TabBar.vue` | `TabsTrigger`'s class string `group/tab relative flex h-full max-w-48 min-w-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent data-[state=active]:bg-panel …`; the `tabbar-close` button; `draggingId === tab.id ? 'opacity-40' : ''`; `<div class="min-w-0 flex-1" />`; the `renameGesture` comment on Reka's activate-on-mousedown | **The authoritative local tab pattern.** Copy its class strings. Its rename-gesture comment is the evidence for using plain buttons rather than Reka `Tabs*` here. |
| `src/components/ui/IconButton.vue` | `IconButton` (props `label`, `side`, `size`, `active`, `disabled`) | The icon-button primitive; wraps its slot in `Tip` when `label` is set. Do not restyle it. |
| `src/app/shell/panels/drag.ts` | `startPanelDrag(id, event)` and its `event.stopPropagation()`; `readContainerGeometry()` reading `[data-test-id^="stack-member-"]`; `nudgePanel()`; `startContainerDrag()` *(call site moved by T-070b)* | The tab button becomes `startPanelDrag`'s handle. `readContainerGeometry` must keep resolving midpoints — it is retargeted minimally here and properly rebuilt by T-070d. |
| `src/app/shell/menu/use.ts` | `panelMenuId()`, `setPanelRequestedState()`, `syncNativePanelMenu()` (≈ lines 135–165) | Reads only `panels[id].open`. **Unchanged by v5.** |
| `src/app/shell/menu/app-menu.ts` | `onCheckedChange()` for `window-panel-*` (≈ lines 146–155) | Same — only `open`. |
| `packages/vue/src/i18n/messages/panels.ts` | `panelMessageDefaults` — `floatPanel`, `dockPanel`, `minimisePanel`, `expandPanel`, `closePanel`, `dropPanelHere`, plus a label for every `PanelId` | **No new key is needed.** `App/package.json` has no `check:i18n` script. |
| `tests/engine/app/shell/menu/window-panels.test.ts` | its inline `layout` stub `{ panels: { [id]: { open } } }` | Reads only `open`. **Must stay green with no edit** — the proof v5 did not disturb the Window menu. |
| `tests/e2e/panels/helpers.ts` | `dragTitleBarTo()` (targets `panel-title-<id>`), `ensurePanelOpen()` (seeds `docks` as string arrays), `floatingWindowFor()`, `readPanelLayout()`, `StoredPanelLayout`/`StoredFloat` | The harness. Every one of these changes shape here. |
| `tests/e2e/panels/stacks.spec.ts` | "Code panel content survives merging into a stack, reordering within it, and separating back out — the component instance is teleported, never remounted" (≈ line 235) | **The existing teleport-survival proof.** Its tab equivalent is the acceptance test for Fixed Decision 6. |
| `src/app.css` | `--color-panel`, `--color-panel-secondary`, `--color-border`, `--color-hover`, `--color-accent`, `--color-surface`, `--color-muted` | The semantic tokens. Do not edit this file. |

## Read First

1. `src/app/shell/panels/types.ts` — the whole schema as T-070a/b leave it.
2. `src/app/shell/panels/containers.ts` — `defaultPanelLayout`, `normaliseV4` and its helpers, then the migration chain.
3. `src/app/shell/panels/operations.ts` — every exported function, especially `movePanel` and its doc comment.
4. `src/app/shell/panels/hosts.ts` — the module comment and `panelHost()`.
5. `src/components/ui/panel/PanelTitleBar.vue` — all 138 lines. Every behaviour it has must land somewhere.
6. `src/components/Shell/{PanelStack,WorkspacePanel}.vue`.
7. `src/components/TabBar.vue` — the tab class strings you will copy.

## Corrections to the Brief

- **"Ensure the Export panel is closed by default" is already true in source.** `DEFAULT_OPEN` in `src/app/shell/panels/containers.ts` is `new Set(['pages', 'layers', 'transform', 'appearance', 'page'])` and `defaultState()` sets `open: DEFAULT_OPEN.has(id)`, so `defaultPanelLayout().panels.export.open === false`. A repo-wide grep for `openRegisteredPanel` / `openPanel(` finds only the Window-menu toggles at `src/app/shell/menu/use.ts:140` and `src/app/shell/menu/app-menu.ts:151` — nothing opens Export automatically. **The only way Export can be open on load is a persisted `open-potlood:panel-layout` that already had it open.** Do not hunt for a bug. Deliver a unit-test guard on the default (Step 11) plus the cleared-storage browser check (Integration Check 1), and preserve the user's own open/closed choices through the migration rather than silently closing panels.
- **T-031c deliberately deferred tabs and told the next packet to stop and revise it.** Its "Design Decision (binding)" reads: floating stacks are vertical stacks, not tabs — "If tabs are wanted instead, stop and revise this packet before writing code." The user has now asked for tabs. **T-070c is that revision.** T-031c stays `Done`; do not reopen or edit it.

## Fixed Decisions

1. **Persisted schema goes to v5; the key does not change.** `PANEL_LAYOUT_KEY` stays `open-potlood:panel-layout`. Reason: a container's members change from `PanelId[]` to `PanelGroup[]`, which is a real persisted-shape change, and `normalisePanelLayout()` already dispatches on `source.version` with an established v1→v2→v3→v4 chain to extend.

2. **A container's members become `PanelGroup[]`.** A group is the unit that stacks, sizes, collapses and is closed; a tab is the unit that switches. Reason: this is the model in the InDesign reference (Swatches|Links|Layers is one group of three tabs; Character|Paragraph another; Effects|Stroke|Gradient a third), and it keeps one geometric stack model rather than adding a second metaphor beside the existing one.

   ```ts
   export interface PanelGroup {
     /** Ordered tab members. Never empty — normalisation removes an empty group. */
     members: PanelId[]
     /** The visible tab. Always a member; normalisation repairs it to members[0]. */
     active: PanelId
     /** Pinned pixel height, per T-070a's rules, now owned by the group rather than the panel. */
     height: number | null
     collapsed: boolean
   }
   ```

3. **`height` and `collapsed` move off `RegisteredPanelState` onto `PanelGroup`; `index` becomes `groupIndex` + `tabIndex`; `lastDock` becomes `{ side, groupIndex, tabIndex }`.** `open`, `container` and `floatFallback` keep their current meaning and their existing doc comments about being derived caches. Reason: a per-panel height is meaningless once a group of tabs occupies one stack slot, and a collapsed *tab* is not a concept — InDesign collapses the group.

4. **A group's sizing kind is its active tab's kind** (`PANEL_REGISTRY_BY_ID[group.active].sizing`, from T-070a). Reason: switching tabs can legitimately change a group from fill-height to content-height, and keying off the active tab is the only rule that stays correct as the user switches.

5. **Migration v4→v5 is one-group-per-panel, order preserved, no auto-tabbing.** Each v4 member becomes a single-tab group in the same position; the panel's `height` and `collapsed` become the group's. Reason: silently merging a user's existing panels into tabs would destroy an arrangement they chose. The tabbed arrangement arrives through the **default** layout (Fixed Decision 8), which applies only to a fresh install or an explicit View ▸ Reset.

6. **Tab switching must not remount the panel.** `WorkspacePanel.vue` keeps its single `Teleport` and its `WorkspacePanelContent` `:key`; a group renders a host only for its **active** tab, so a non-active tab simply has no teleport target and its instance is preserved. **Never use `v-if` on the panel body.** Reason: `hosts.ts`'s module comment and the "Code panel content survives merging into a stack…" test at `tests/e2e/panels/stacks.spec.ts:235` both depend on the instance surviving; a remount would clear the Code panel's editor state and the AI panel's stream.

7. **`PanelTitleBar.vue` is deleted, and all five of its behaviours land on the tab strip.** Grep confirms `WorkspacePanel.vue` is its only consumer and `src/components/ui/panel/index.ts` does not re-export it, so no barrel edit is needed. Mapping: drag → the tab button; double-click collapse → the tab strip; pin/unpin float → a group button; close → a per-tab `×` plus a group `×`; Enter/Space collapse and arrow-key nudge → the tab strip's `keydown`. Reason: leaving a dead 138-line component invites a later executor to keep rendering it.

8. **Default layout (fresh install / View ▸ Reset), replacing `DEFAULT_DOCKS`, `DEFAULT_OPEN` and T-070a's `DEFAULT_HEIGHT`:**
   - `dockWidths`: `{ left: 240, right: 280 }` — unchanged.
   - `docks.left`: `[ { members: ['pages'], active: 'pages', height: 200, collapsed: false }, { members: ['layers'], active: 'layers', height: null, collapsed: false } ]`
   - `docks.right`: `[ { members: ['transform'], active: 'transform', height: null, collapsed: false }, { members: ['appearance', 'text'], active: 'appearance', height: null, collapsed: false }, { members: ['page', 'guides'], active: 'page', height: null, collapsed: false } ]`
   - `floats`: `[]`
   - The open set is exactly those seven ids. Every other panel — **including `export`** — is closed.

   Reason: requirement 1. It demonstrates tabs out of the box, keeps Transform and Appearance simultaneously visible (tabbing those two together would regress the ordinary edit loop), and replaces three separate stacked strips on the right with three content-height groups under one scrollbar.

9. **Per-tab close removes only that tab; the group `×` closes every member.** A group whose last tab closes is removed by normalisation. Reason: matches the two controls' obvious meanings and needs no new state.

10. **The pin/unpin group button floats or docks the whole group.** Floating creates a new single-group float container at the group's measured rect; docking returns it to the active tab's `lastDock`. Reason: the group is the unit the user sees; floating one tab out of a group is a drag gesture, and T-070d owns drags.

11. **The tab strip uses plain `<button role="tab">`, not Reka `Tabs*`.** Reason: the strip is also a drag surface in T-070d, and Reka activates on mousedown — `TabBar.vue`'s own `renameGesture` comment documents that exact conflict with a press-and-hold gesture. `reka-ui` is already installed and stays available elsewhere.

12. **No new i18n key.** `panelMessageDefaults` already provides `floatPanel`, `dockPanel`, `minimisePanel`, `expandPanel`, `closePanel` and a display label for every `PanelId`. Reason: `App/package.json` has no `check:i18n` script, so a new key would have to be hand-verified for no gain.

13. **`readContainerGeometry()` in `drag.ts` is retargeted minimally, not rebuilt.** It swaps `[data-test-id^="stack-member-"]` for `[data-group-index]` and keeps returning vertical midpoints, so today's seam-only drop targeting keeps working unchanged. Reason: T-070d owns the `DropTarget` union, `GroupGeometry` and tab targeting; anticipating it here would smear one change across two packets.

## Open Decisions

1. **Should dropping a `fill` panel into a `content` group be blocked?**
   *Recommended default — implement this:* **no, allow it.** A group's sizing follows its **active** tab (Fixed Decision 4), so a mixed group is well-defined: fill-height while a fill tab is active, content-height while a content tab is active. In this packet the only mixed groups are whatever the default layout ships (none) or the user builds in T-070d, so the rule simply needs to be correct, not enforced.
   *Alternative:* forbid mixed groups. Consequence: an arbitrary restriction the user would hit the first time they drag Layers onto Appearance, plus a "drop rejected" indicator to design in T-070d. Rejected.

## Visual Contract — binding

Every class string below is either copied from a component named in Verified Starting State or is the named minimal edit to one.

### New file — `src/components/Shell/PanelTabStrip.vue`

Props: `containerId: ContainerId`, `groupIndex: number`.

Root `<header>` — height, border, padding and cursor idiom copied from `PanelTitleBar.vue`'s `header`:

```
flex h-[33px] shrink-0 items-center gap-0 border-b border-border bg-panel px-1 select-none
```

Attributes: `:data-test-id="`panel-tab-strip-${containerId}-${groupIndex}`"`, `tabindex="0"`, `role="tablist"`, `:aria-label="panels[activeId]"`, `:aria-expanded="!collapsed"`, `@dblclick="onDoubleClick"`, `@keydown="onKeydown"`.

**No `cursor-grab` and no `@pointerdown` on this root in this packet** — the strip becomes a group drag handle in T-070d.

Tab button — copied from `TabBar.vue`'s `TabsTrigger` and reduced to panel scale:

```
group/paneltab relative flex h-full max-w-40 min-w-0 cursor-pointer items-center gap-1 px-2 text-[11px] font-semibold transition-colors outline-none select-none focus-visible:ring-1 focus-visible:ring-accent
```

State classes, exactly:

| State | Classes |
| --- | --- |
| active | `bg-panel text-surface border-b-2 border-b-accent` |
| inactive | `text-muted hover:text-surface` |
| this tab is the one being dragged (`panelDraggingId === panelId`) | `opacity-40` (copied from `TabBar.vue`'s `draggingId === tab.id ? 'opacity-40' : ''`) |

Attributes: `type="button"`, `:data-test-id="`panel-tab-${panelId}`"`, `:data-tab-id="panelId"`, `role="tab"`, `:aria-selected="panelId === activeId"`, `@pointerdown` (stop propagation, then `startPanelDrag(panelId, $event)`), `@click="setActiveTab(containerId, groupIndex, panelId)"`.

Per-tab close button — copied from `TabBar.vue`'s `tabbar-close`, with `opacity-100` forced on the active tab exactly as `TabBar.vue` does:

```
flex size-4 shrink-0 cursor-pointer items-center justify-center rounded opacity-0 transition-opacity group-hover/paneltab:opacity-100 hover:bg-hover
```

Icon `<icon-lucide-x class="size-3" />`. Attributes: `:data-test-id="`panel-tab-close-${panelId}`"`, `:aria-label="panels.closePanel"`, `tabindex="-1"`, `@click.stop="closeRegisteredPanel(panelId)"`.

Spacer: `<div class="min-w-0 flex-1" />` — copied verbatim from `TabBar.vue`.

Group buttons, right-aligned, all three rendered with `IconButton.vue` unrestyled, each icon `class="size-3"`. Icons and labels are identical to `PanelTitleBar.vue`'s, promoted from panel scope to group scope:

| Button | `data-test-id` | Icon | `label` |
| --- | --- | --- | --- |
| Float / dock the group | `panel-group-float-<containerId>-<groupIndex>` | `<icon-lucide-pin-off>` when floating, else `<icon-lucide-pin>` | `panels.dockPanel` / `panels.floatPanel` |
| Collapse / expand | `panel-group-collapse-<containerId>-<groupIndex>` | `<icon-lucide-chevron-down>` when collapsed, else `<icon-lucide-minus>` | `panels.expandPanel` / `panels.minimisePanel` |
| Close group | `panel-group-close-<containerId>-<groupIndex>` | `<icon-lucide-x>` | `panels.closePanel` |

### New file — `src/components/Shell/PanelGroup.vue`

Props: `containerId: ContainerId`, `groupIndex: number`.

Root `<section>` — class string copied verbatim from `PanelStack.vue`'s current member `section`:

```
relative flex min-h-0 flex-col overflow-hidden bg-panel
```

Attributes: `:data-test-id="`panel-group-${containerId}-${groupIndex}`"`, `:data-group-index="groupIndex"`.

Its inline `style` is exactly T-070a's five-case sizing table, re-keyed from the member to the group and its **active tab's** `sizing`:

| Condition | `style` |
| --- | --- |
| `group.collapsed` | `{ flex: '0 0 33px', height: '33px' }` |
| active tab `sizing === 'content'` | `{ flex: '0 0 auto' }` |
| active tab `sizing === 'fill'`, `group.height !== null` | `{ flex: '0 0 ' + group.height + 'px' }` |
| active tab `sizing === 'fill'`, `height === null`, **last** such group in the container | `{ flex: '1 1 0', minHeight: '96px' }` |
| active tab `sizing === 'fill'`, `height === null`, not last | `{ flex: '0 0 ' + registryDefaultHeight + 'px' }` |

Children: `<PanelTabStrip :container-id="containerId" :group-index="groupIndex" />`, then — **only when not collapsed** — the host div, copied verbatim from `PanelStack.vue`'s current host:

```
flex min-h-0 min-w-0 flex-1
```

bound as `:ref="setPanelHost(activeId, isDock ? 'docked' : 'floating')"`.

### `src/components/Shell/WorkspacePanel.vue`

Remove the `PanelTitleBar` import and element, and the `collapsed` computed. Keep the single `Teleport`, the `aside`'s class strings, `style="contain: paint layout style"`, and `WorkspacePanelContent`'s `:key`. The body wrapper's `v-show` is removed — a non-active tab has no host, so nothing renders:

```
flex min-h-0 flex-1 flex-col overflow-hidden
```

### `src/components/Shell/PanelStack.vue`

Iterate `PanelGroup`s rather than `PanelId`s and render `<PanelGroup>` instead of the inline `section`. The seam divider's classes, `DockInsertionTarget` placement, `resizeWidth()`, `dock-width-divider`, the scroll wrapper string, the root element and `data-container-id` are **unchanged**; only what they iterate over and which id they pass to `setMemberHeight` (now `setGroupHeight`) changes.

### Unchanged, do not restyle

`FloatTitleBar.vue` *(from T-070b)*, `FloatingPanel.vue`'s root frame and `HANDLE_CLASS`, `DockInsertionTarget.vue`, `PanelOverlay.vue`, `WorkspacePanelContent.vue`, every `src/components/properties/*Section.vue`.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only the semantic tokens already in `src/app.css`: `bg-panel`, `bg-panel-secondary`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `bg-accent`, `border-b-accent`.
- **No font-size class other than `text-xs` or `text-[11px]`.** Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded`, `rounded-md`, `rounded-lg` or `rounded-t-lg`.** Never `rounded-xl`, `rounded-2xl`, `rounded-full`.
- **No `flex-basis` percentage.** T-070a removed it; do not reintroduce it on the group.
- **No `v-if` on the panel body in `WorkspacePanel.vue`**, and no second `Teleport`. This is Fixed Decision 6 and it is load-bearing.
- **No Reka `TabsRoot`/`TabsList`/`TabsTrigger` in the panel tab strip** (Fixed Decision 11).
- **No new `tv()` recipe, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.** `panelLayout` in `layout.ts` stays the only panel state.
- **No inline `style=` except** the five group sizing objects, the float container rect already in `FloatingPanel.vue`, the dock width already in `PanelStack.vue`, and `contain: paint layout style` already in `WorkspacePanel.vue`.
- **No tab reordering by drag, no drop-onto-tab-strip, no `DropTarget` change.** T-070d owns all of it.

## Allowed Changes

Create:

- `src/components/Shell/PanelGroup.vue`
- `src/components/Shell/PanelTabStrip.vue`
- `tests/engine/app/shell/panels/groups.test.ts`
- `tests/e2e/panels/tabbed-groups.spec.ts`

Modify:

- `src/app/shell/panels/{types,registry,containers,operations,layout,drag,index}.ts`
- `src/components/Shell/{PanelStack,FloatingPanel,PanelOverlay,WorkspacePanel}.vue`
- `tests/engine/app/shell/panels/{containers,operations,layout,registry}.test.ts`
- `tests/e2e/panels/{helpers.ts,basic.spec.ts,stacks.spec.ts}`

Delete:

- `src/components/ui/panel/PanelTitleBar.vue`

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No drop targeting work.** `DropTarget` stays `{ container, index }` meaning a group seam. No `kind` discriminant, no `GroupGeometry`, no tab caret, no drop ring, no `startGroupDrag`. T-070d owns every one of those. `readContainerGeometry()` gets the minimal selector swap in Fixed Decision 13 and nothing more.
- **No change to member/group sizing rules.** T-070a fixed them; this packet only re-keys them from panel to group.
- **No change to `FloatTitleBar.vue` or `startContainerDrag`.** T-070b landed those.
- **Do not touch `src/app/shell/panels/snap.ts`, `drop-target.ts`, `resize.ts`, `hosts.ts`**, or their tests.
- **Do not touch `src/app/shell/menu/use.ts` or `app-menu.ts`.** Both read only `panels[id].open`. `tests/engine/app/shell/menu/window-panels.test.ts` must pass **unedited** — that is the proof.
- **Do not touch `src/views/EditorView.vue`** or `src/components/ui/panel/index.ts`.
- **Do not change any panel's content.** No edit inside `PagesPanel.vue`, `AssetsPanel.vue`, `LayerTree/`, `ChatPanel.vue`, `CodePanel.vue`, `WorkspacePanelContent.vue`, or any `src/components/properties/*Section.vue`.
- **Do not change the `localStorage` key** or add a second one.
- **No per-document or per-tab panel layouts.** The layout stays global.
- **No workspace preset or switcher UI** (T-032), **no collapsed icon rail** (T-033).
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070a and T-070b are both Done. Reread `types.ts`, `containers.ts`, `operations.ts`, `hosts.ts`, `PanelStack.vue`, `WorkspacePanel.vue`, `PanelTitleBar.vue`, `TabBar.vue`. Confirm `PANEL_LAYOUT_VERSION === 4`, that `DEFAULT_OPEN` excludes `export`, that `PanelTitleBar.vue` still has exactly one consumer, and that `RegisteredPanelState` carries `height` and `collapsed`. If any has drifted, stop and report.

**2 — `src/app/shell/panels/types.ts`.** Set `PANEL_LAYOUT_VERSION = 5`. Add the `PanelGroup` interface from Fixed Decision 2, with those doc comments. Change `FloatContainer.members: PanelId[]` to `groups: PanelGroup[]` and `PanelLayout.docks` to `{ left: PanelGroup[]; right: PanelGroup[] }`. On `RegisteredPanelState`, remove `height` and `collapsed`, replace `index: number` with `groupIndex: number` and `tabIndex: number`, and change `lastDock` to `{ side: DockSide; groupIndex: number; tabIndex: number }`. Keep `open`, `container` and `floatFallback` with their existing doc comments about derived caches. Keep the v2 and v3 legacy blocks byte-identical and add a v4 legacy block beside them (`PANEL_LAYOUT_VERSION_V4 = 4`, `FloatContainerV4`, `RegisteredPanelStateV4`, `PanelLayoutV4`), documented the same way and used only by the migration chain.

**3 — `src/app/shell/panels/registry.ts`.** Replace `defaultDockIndex: number` with `defaultGroupIndex: number` and `defaultTabIndex: number`, preserving the current dock side and ordering: `pages` left/0/0, `assets` left/1/0, `layers` left/1/0, `export` right/0/0, `variables` right/1/0, `ai` right/2/0, `code` right/3/0, `appearance` right/1/0, `transform` right/0/0, `text` right/2/0, `page` right/2/0, `guides` right/4/0, `mask` right/5/0, `component` right/6/0. `sizing`, `defaultHeight` *(from T-070a)* and `defaultFloating` are unchanged.

**4 — `containers.ts`, part 1: helpers and default.** Rename the existing `normaliseV4` core to `normaliseV4Legacy`, keeping it behaviourally identical and retyped against the v4 legacy types; it now serves the migration chain only. Replace `containerMembers(layout, id): PanelId[]` with `containerGroups(layout, id): PanelGroup[]`. Keep `containerOf(layout, id): ContainerId | null` with its current contract and add `locatePanel(layout, id): { container: ContainerId; groupIndex: number; tabIndex: number } | null`. Keep `allContainerIds()` and `floatContainerById()`. Rewrite `defaultPanelLayout()` to Fixed Decision 8 exactly, deleting `DEFAULT_DOCKS`, `DEFAULT_OPEN` and `DEFAULT_HEIGHT` in favour of one literal `DEFAULT_GROUPS` structure plus an open set derived from it.

**5 — `containers.ts`, part 2: `normaliseV5()`.** Add the live core, enforcing these invariants in this order, each as its own named helper mirroring the file's existing shape:

1. `version` is `5`; `dockWidths` clamped to `[PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH]`.
2. Unknown panel ids are dropped everywhere.
3. Group `members` are deduplicated **globally**, in this order: `docks.left`, `docks.right`, then `floats` in array order. A panel appears in at most one group.
4. A closed panel (`open === false`) is removed from every group.
5. Empty groups are removed; float containers left with no groups are removed.
6. `group.active` is repaired to `members[0]` when it is not a member.
7. Every open panel missing from every container is reinserted at its cached `container`/`groupIndex`/`tabIndex`, falling back to its registry `defaultDock`/`defaultGroupIndex`/`defaultTabIndex` when that container no longer exists. (This is the v3 invariant 5 rule, re-keyed.)
8. Float ids are renumbered densely by ascending `z` to `float:0..float:n-1`, and `z` to `1..n` in the same order — **carry the existing doc comment forward verbatim.**
9. `panels[id].container`/`groupIndex`/`tabIndex` are recomputed from the authoritative group arrays; `lastDock` is refreshed only while genuinely docked; `floatFallback` only while genuinely floating. **Carry the existing invariant-8 doc comment forward.**
10. `group.height` is `null`, or an integer clamped to `[PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]`; it is forced to `null` when the group is collapsed or when `PANEL_REGISTRY_BY_ID[group.active].sizing === 'content'`.
11. A float container's height floor is `PANEL_FLOAT_TITLE_HEIGHT + expandedGroups * PANEL_MEMBER_MIN_HEIGHT + collapsedGroups * PANEL_COLLAPSED_HEIGHT`, and its width stays clamped to `[PANEL_MIN_WIDTH, PANEL_MAX_WIDTH]`.

**6 — `containers.ts`, part 3: `migrateV4ToV5()`.** Take an already-normalised v4 layout. For each dock side, map each `PanelId` in order to `{ members: [id], active: id, height: v4.panels[id].height, collapsed: v4.panels[id].collapsed }`. For each float, map its `members` the same way into `groups`, preserving `x`, `y`, `width`, `height`, `z`. Build `panels[id]` from the v4 state, dropping `height` and `collapsed`, and converting `index` → `groupIndex` with `tabIndex: 0` (and `lastDock.index` → `lastDock.groupIndex` with `lastDock.tabIndex: 0`). Return `normaliseV5(...)`. Leave `migrateV1ToV2`, `normalisePanelLayoutV2`, `migrateV2ToV3` and `migrateV3ToV4` byte-identical.

**7 — `src/app/shell/panels/operations.ts`.** Update the dispatcher: `1` → `migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(value))))`; `2` → the same chain from `normalisePanelLayoutV2(value)`; `3` → `migrateV4ToV5(migrateV3ToV4(normaliseV3Legacy(value)))`; `4` → `migrateV4ToV5(normaliseV4Legacy(value))`; `5` → `normaliseV5(value)`; anything else → `defaultPanelLayout()`. Point `cloneLayout()` and every operation's return at `normaliseV5`. Then:

- `movePanel(layout, id, target: ContainerId, index: number)` keeps its signature, with `index` now meaning a **group seam**: remove `id` from every group (pruning emptied groups and float containers), set `open = true`, then splice a fresh `{ members: [id], active: id, height: null, collapsed: false }` into the container's `groups` at a clamped `index`. **Preserve its "one atomic path" doc comment.**
- Add `setActiveTab(layout, container, groupIndex, id)` — a no-op when `id` is not a member of that group.
- Rename `setPanelCollapsed` to `setGroupCollapsed(layout, container, groupIndex, collapsed)` and `setMemberHeight` to `setGroupHeight(layout, container, groupIndex, height: number | null)`, both clamped by invariant 10.
- Add `closeGroup(layout, container, groupIndex)` — closes every member (preserving each one's `container`/`groupIndex`/`tabIndex` for reopen, exactly as `closePanel` does) and removes the group.
- Add `floatGroup(layout, container, groupIndex, rect?)` and `dockGroup(layout, floatId, groupIndex)` for the pin button (Fixed Decision 10).
- Rewrite `detachPanel(layout, id, rect?)` to create a float holding a single single-tab group.
- Update `openPanel()`, `closePanel()`, `togglePanelOpen()` and `dockPanel()` to the group model, preserving each one's current contract and doc comment.
- `setFloatRect`, `raiseFloat`, `setDockWidth`, `resetPanelLayout` keep their signatures.

Every function stays pure, total, non-throwing, and returns `normaliseV5(...)`.

**8 — `src/app/shell/panels/drag.ts`.** In `readContainerGeometry()`, swap the member selector `[data-test-id^="stack-member-"]` for `[data-group-index]` and exclude the dragged panel by checking whether that group's members include it (the group root no longer carries a single `data-panel-id`). Keep the returned midpoints vertical and keep every other doc comment — including the floats-first/descending-z ordering and the `excludeContainerId` rationale. Update `nudgePanel()` to read `panels[id].container`. **Nothing else in this file changes.**

**9 — `src/app/shell/panels/layout.ts` and `index.ts`.** Add thin reactive wrappers: `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`, `containerGroups(containerId)`, `groupOf(panelId)`. Remove `panelCollapsed`, `togglePanelCollapsed`, `setPanelCollapsed` and `setMemberHeight` from both files. Keep `panelLayout`, `writePanelLayout`, `panelContainerId`, `isPanelFloating`, `panelSizing`, `floatContainer`, `floatContainerIds`, `dockedPanelIds`, `movePanel`, `floatPanel`, `dockPanel`, `resetPanelLayout`, `openRegisteredPanel`, `closeRegisteredPanel`, `clampRectToOverlay`, `clampPanelsToOverlay` under their current names. In `index.ts`, add `PanelGroup`, `containerGroups`, and the new operations; remove the four deleted exports.

**10 — Components**, in landing order:

  a. Create `src/components/Shell/PanelTabStrip.vue` to the Visual Contract. `onDoubleClick` copies `PanelTitleBar.vue`'s `closest('button')` guard, then calls `toggleGroupCollapsed`. `onKeydown` copies `PanelTitleBar.vue`'s handler: Enter/Space toggle collapse; arrows call `nudgePanel(activeId, dx, dy)` with `shiftKey ? 10 : 1` and only while the group is floating.

  b. Create `src/components/Shell/PanelGroup.vue` to the Visual Contract, including the five-case sizing style keyed off the active tab.

  c. Update `src/components/Shell/PanelStack.vue` to iterate groups and render `PanelGroup`, passing `setGroupHeight` to the seam divider. Change nothing else.

  d. Update `src/components/Shell/FloatingPanel.vue`: recompute `allCollapsed` from `groups` rather than members. Nothing else — `FloatTitleBar` and the handles are T-070b's and stay as they are.

  e. Update `src/components/Shell/WorkspacePanel.vue` per the Visual Contract: drop the `PanelTitleBar` import, element and `collapsed` computed; keep the single `Teleport` and the content `:key`; remove the `v-show`.

  f. Update `src/components/Shell/PanelOverlay.vue`: `emptyDockTargetSide` reads `panelLayout.value.docks[target.container].length === 0` — now a group-array length. No class change.

  g. Delete `src/components/ui/panel/PanelTitleBar.vue`.

**11 — Unit tests.** Rewrite `tests/engine/app/shell/panels/{containers,operations,layout}.test.ts` against the v5 model. Extend `registry.test.ts` for `defaultGroupIndex`/`defaultTabIndex`. Create `tests/engine/app/shell/panels/groups.test.ts` covering: `migrateV4ToV5` producing one group per v4 member with order, `height` and `collapsed` preserved; a stored `version: 3` value surviving the full chain to v5; all eleven invariants, including a group with a non-member `active`, an empty group, a globally duplicated member, and a `content`-active group having `height` forced to `null`; `setActiveTab` no-opping for a non-member; `setGroupCollapsed` and `setGroupHeight` clamping; `closeGroup` preserving every member's reopen position; `floatGroup`/`dockGroup` round-tripping; and **`defaultPanelLayout().panels.export.open === false`** plus the full Fixed Decision 8 shape (the requirement-1 guard). Do **not** edit `snap.test.ts`, `drop-target.test.ts` or `tests/engine/app/shell/menu/window-panels.test.ts`.

**12 — E2E harness.** In `tests/e2e/panels/helpers.ts`: retarget `dragTitleBarTo()` to `panel-tab-<id>` and rename it `dragTabTo()`; update `ensurePanelOpen()` to seed a v5 layout (`version: 5`, `docks` as `PanelGroup[]`); update `StoredPanelLayout` and `StoredFloat` to carry `groups`. Update `basic.spec.ts` and `stacks.spec.ts` to the new test ids and group model, keeping every existing behavioural assertion that still applies — snap, Alt bypass, height pinning, canvas input not blocked, geometric seam symmetry, atomic cancel, teleport survival, `float-title-*` whole-window drag.

**13 — E2E tabs spec.** Create `tests/e2e/panels/tabbed-groups.spec.ts` covering:
- the default layout ships Appearance|Text and Page|Guides as tabbed groups, with Appearance and Page active, and no Export panel present;
- clicking a tab switches the visible body and updates `aria-selected`;
- **the teleport proof**: type into the Code panel, tab away and back, and the typed content survives — mirroring `stacks.spec.ts:235`'s existing assertion;
- a per-tab `×` removes only that tab and the group keeps its other members;
- closing the last tab of a group removes the group;
- the group `×` closes every member and removes the group;
- the group collapse button and a double-click on the strip both collapse to a 33 px rail, and expanding restores the height;
- the pin button floats the whole group into a new window with all its tabs, and unpinning returns it;
- the layout persists across a reload, with `"version":5` in storage.

**14 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] `PANEL_LAYOUT_VERSION === 5`; `PANEL_LAYOUT_KEY` unchanged; a stored v1, v2, v3 or v4 value loads without console error and keeps its panels one-group-per-panel in the same order, with `height` and `collapsed` preserved (`groups.test.ts`).
- [ ] `defaultPanelLayout()` matches Fixed Decision 8 exactly, and `defaultPanelLayout().panels.export.open === false` (`groups.test.ts`).
- [ ] With `open-potlood:panel-layout` cleared, the app starts with two docks and five groups, two of them tabbed, and no Export panel anywhere (Integration Check 1).
- [ ] Clicking a tab switches the visible body; the previously active panel's component instance is not remounted (`tabbed-groups.spec.ts`, Code-panel assertion).
- [ ] `WorkspacePanel.vue` has exactly one `Teleport` and no `v-if` on the body, in the diff.
- [ ] A per-tab `×` removes only that tab; the group `×` closes every member; a group whose last tab closes is removed (`tabbed-groups.spec.ts`).
- [ ] Collapse via the button and via double-click both work and are equivalent; expanding restores the group's height (`tabbed-groups.spec.ts`).
- [ ] The pin button floats and docks the **whole** group with all its tabs (`tabbed-groups.spec.ts`).
- [ ] A group's sizing follows its **active** tab: switching from a `content` tab to a `fill` tab changes the group from auto-height to a definite height (Integration Check 3).
- [ ] `src/components/ui/panel/PanelTitleBar.vue` no longer exists and nothing imports it; all five of its behaviours are reachable from the tab strip.
- [ ] `DropTarget` is still `{ container, index }`; no `kind` discriminant, `GroupGeometry`, tab caret, drop ring or `startGroupDrag` appears in the diff.
- [ ] `tests/engine/app/shell/menu/window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` pass **with no edit**.
- [ ] Nothing in the Banned List appears in the diff; all four themes are correct because only semantic tokens are used (Integration Check 7).
- [ ] No new dependency, `tv()` recipe, i18n key, `src/app.css` edit, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0. `packages/vue/tsconfig.json` is **not** required: no package source changes, and the only package import used (`useI18n`) is unchanged.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ src/components/Shell/ src/components/ui/panel/ tests/engine/app/shell/panels/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0; `groups.test.ts` present and green.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.
6. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0 across `basic.spec.ts`, `stacks.spec.ts` and the new `tabbed-groups.spec.ts`.
7. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/pages/ tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts tests/e2e/components/assets-panel.spec.ts --project=openpencil` — expect exit 0; every panel still renders inside the new group host.
8. `bunx playwright test tests/e2e/export/ --project=openpencil` — expect exit 0; the Export panel and T-069's popover still work when Export is opened from the Window menu.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **Clean default.** Clear `open-potlood:panel-layout` and reload. Confirm: left dock 240 px with Pages (≈ 200 px) above Layers (filling); right dock 280 px with Transform, then Appearance|Text tabbed with Appearance active, then Page|Guides tabbed with Page active. Confirm **no Export panel anywhere**, and Window ▸ Export unchecked.
2. **Migration.** Restore a pre-existing layout value (or seed a `version: 3` one), reload, and confirm the same panels are open in the same places one-per-group, with collapsed states and pinned heights intact and `"version":5` in storage.
3. **Tabs.** Click Text, then Appearance — the body swaps with no flash and no scroll-position reset, and the active tab's underline moves. Open Code from the Window menu and confirm the group it lands in sizes to a definite height while Code is active and to content height when a property tab is active.
4. **Teleport survival.** Type into the Code panel, click another tab in the same group, click back — the typed content is still there.
5. **Closing.** Use a per-tab `×`: only that tab goes, the group keeps its others. Close the last tab of a group: the group disappears. Use the group `×` on a two-tab group: both close. Reopen each from the Window menu and confirm it returns to its remembered position.
6. **Collapse and float.** Collapse a group with its button, then with a double-click on the strip — both collapse to a 33 px rail; expand and confirm the height returns. Pin a two-tab group out: a floating window appears with T-070b's title bar above the tab strip, carrying both tabs; unpin and confirm it returns.
7. **Themes.** Cycle light, grey, dark and midnight. Confirm the tab strip, active-tab underline, inactive tab text, hover state and focus ring are all legible in all four, with no literal colour anywhere in the diff.
8. **Non-regression.** Confirm: dragging a tab still detaches that panel and the seam indicator still appears and commits (unchanged T-031b/c behaviour); the single column scrollbar from T-070a is still single; the `float-title-*` whole-window drag from T-070b still moves every group; the Window menu checkboxes still open and close panels; View ▸ Reset panel layout restores exactly the Fixed Decision 8 arrangement; the canvas still receives input under a floating window; the layout survives a reload.

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070a or T-070b is not Done, or pre-flight finds `PANEL_LAYOUT_VERSION !== 4`, `DEFAULT_OPEN` already containing `export`, or a second consumer of `PanelTitleBar.vue`. The tree has drifted.
- Switching tabs remounts the panel — the Code panel loses typed content, or the AI panel's stream restarts. Fixed Decision 6 has been violated; do not work around it with a cache.
- A group cannot render a host for only its active tab without a second `Teleport` or a `v-if`.
- `movePanel` cannot stay a single atomic path once members are groups.
- Any of `PanelTitleBar.vue`'s five behaviours has no home on the tab strip.
- `window-panels.test.ts`, `snap.test.ts` or `drop-target.test.ts` requires an edit to pass — that means this packet changed a contract it promised not to touch.
- The change needs a new dependency, `tv()` recipe, `src/app.css` edit, i18n key, a second `localStorage` key, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.
- The work overruns one bounded session. Land Steps 2–9 and 11 (model, operations, unit tests) as a coherent slice, report exactly which component and E2E steps remain, and stop — do **not** leave the schema half-migrated with the old components still rendering.

## Execution Report Contract

Report:

- every file created, modified and deleted, with a one-line reason each;
- the final v5 declarations for `PanelGroup`, `FloatContainer`, `RegisteredPanelState` and `PanelLayout`;
- the eleven normalisation invariants as implemented, plus any merged or dropped and why;
- **which `src/app/shell/panels/index.ts` exports were added, renamed or removed** — T-032 (Ready) consumes this barrel and its expansion must be reconciled against the delta;
- the exact `data-test-id` values delivered for the tab strip, tab, tab close and the three group buttons;
- the mapping table showing where each of `PanelTitleBar.vue`'s five behaviours landed;
- confirmation that `WorkspacePanel.vue` has one `Teleport` and no `v-if` on the body;
- confirmation, by grep output, that `DropTarget` is unchanged and no tab-targeting code was written;
- every command from Verification with its exact exit code, test counts and any failure output;
- confirmation that `window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` passed unedited;
- the browser observations for all eight Integration Check items, at both viewport widths, including the stored JSON's `"version":5`;
- confirmation that no dependency, `src/app.css` edit, i18n key, version-file change, build, install or Git work occurred;
- the Open Decision as resolved, plus any assumption or remaining gap.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: created as the third slice of the T-070 split, expanded against live `App/` source. Supersedes T-031c's deferral of tabs.

## Status record

Status: **Ready**

Expansion receipt (2026-08-20). Verified against live source:

1. **T-031c explicitly deferred tabs and instructed the next packet to revise it** before writing code — "Floating stacks are vertical stacks, not tabs… If tabs are wanted instead, stop and revise this packet." T-070c is that revision; T-031c stays Done and untouched.
2. **Export is already closed in the default layout** (`DEFAULT_OPEN` in `containers.ts` excludes it) and nothing opens it automatically — only a persisted `localStorage` layout can. Delivered as a unit-test guard plus a cleared-storage browser check.
3. **`hosts.ts`'s teleport-once model is the binding constraint on tab switching.** Its module comment states that teleporting keeps the instance alive so open tabs, scroll positions and chat streams survive; `tests/e2e/panels/stacks.spec.ts:235` already proves it for the Code panel. A non-active tab must lose its host, never be `v-if`-ed away.
4. **`PanelTitleBar.vue` has exactly one consumer** (`WorkspacePanel.vue`) and is **not** re-exported from `src/components/ui/panel/index.ts`, so deleting it needs no barrel edit.
5. **`TabBar.vue` is the authoritative tab pattern**, and its `renameGesture` comment documents Reka's activate-on-mousedown conflict with press-and-hold — the reason the panel tab strip uses plain buttons.
6. **The Window menu reads only `panels[id].open`**, so `tests/engine/app/shell/menu/window-panels.test.ts` staying green unedited is a real, cheap proof that v5 did not disturb it.
7. **No new i18n key is needed** — `panelMessageDefaults` already carries every label the tab strip uses, and `App/package.json` has no `check:i18n` script.

One Open Decision was left with an implemented default (allow mixed fill/content groups). It is a taste call with a stated alternative and does not block execution.
