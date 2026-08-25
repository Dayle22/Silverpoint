# T-070c1 - Panel-group v5 model and migration

Task ID: T-070c1
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070a (Done), T-070b1 (Done — this packet's float-height-floor invariant embeds `PANEL_FLOAT_TITLE_HEIGHT`)
Related: T-070b2 (Ready, not yet executed — see Corrections), T-070c2, T-070c3, T-070d1-d3
Prepared from: the stub's Exact Contract, expanded against live `App/` source
Expanded at: 2026-08-20 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/app/shell/panels/{types,registry,containers,operations,layout,index,legacy,hosts,drag,drop-target,snap,resize}.ts`, `src/components/Shell/{PanelStack,FloatingPanel,PanelOverlay,WorkspacePanel,DockInsertionTarget}.vue`, `src/components/ui/panel/PanelTitleBar.vue`, `src/app/shell/menu/{use,app-menu}.ts`, `tests/engine/app/shell/panels/{containers,operations,layout,registry}.test.ts`, a full-tree grep for every direct read of `RegisteredPanelState`/`FloatContainer` fields, and a `bun test tests/engine/app/shell/panels/` run against the live tree
Delivery: named source gates, no browser check needed for new behaviour (none is added) plus one regression-only dev-server look

## Intended Outcome

Introduce and normalise schema v5 panel groups (`PanelGroup = { members, active, height, collapsed }`; docks and floats own `groups: PanelGroup[]`), migrate v4 losslessly (one group per existing member, order preserved, no default-layout change), and expose the pure group operations (`setActiveTab`, `setGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`) that T-070c2 will wire into new components. Every file this packet does **not** touch — `PanelStack.vue`, `FloatingPanel.vue`, `WorkspacePanel.vue`, `PanelTitleBar.vue`, `PanelOverlay.vue`, `drag.ts` — keeps compiling and behaving exactly as it does today, because the v5 schema carries the exact compatibility fields those files read directly.

## Request Coverage

This is the model/migration slice of T-070's requirement groups 1 and 4 (see `Plan/Packets/T-070-indesign-panel-management.md`). It ships no user-visible change: the default layout, every panel's position, and every interaction remain byte-for-behaviour identical to v4. It exists to give T-070c2 (tab-strip UI) and T-070c3 (tabbed defaults, `PanelTitleBar.vue` removal) a schema to build on without a second migration.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/types.ts` | `PANEL_LAYOUT_VERSION = 4`, `PANEL_IDS` (**15** entries — `pages, assets, layers, swatches, export, variables, ai, code, appearance, transform, text, page, guides, mask, component**), `PANEL_FLOAT_TITLE_HEIGHT = 24` *(T-070b1, landed)*, `FloatContainer.members: PanelId[]`, `RegisteredPanelState` with `container`, `index`, `lastDock: {side, index}`, `height`, `collapsed`, `floatFallback`; the v3/v2 legacy blocks | The schema to extend. `PANEL_IDS` has 15 entries (T-053 added `swatches`); the superseded T-070c's own registry table only lists 14 and must not be trusted. |
| `src/app/shell/panels/registry.ts` | `PANEL_REGISTRY` — 15 entries including `swatches: left/2, floating(304,160), 'fill', 280` | The rename target. `defaultDockIndex` becomes `defaultGroupIndex`; `swatches` **is** in scope, unlike the superseded packet's step-3 table. |
| `src/app/shell/panels/containers.ts` | `containerMembers`, `containerOf`, `allContainerIds`, `floatContainerById`, `defaultPanelLayout()` (`DEFAULT_DOCKS = {left:['pages','layers'], right:['transform','appearance','page']}`, `DEFAULT_HEIGHT = {pages:200}`, `DEFAULT_OPEN = {pages,layers,transform,appearance,page}` — **unchanged by this packet**, no default-grouping change), `normaliseV4()` and its helpers `normaliseStateV4`, `normaliseMemberHeights` (already embeds `PANEL_FLOAT_TITLE_HEIGHT` in its float-height floor), `migrateV3ToV4()` | The v4 live core. `normaliseV4` becomes `normaliseV4Legacy` (migration-chain-only); `normaliseV5` is the new live core built from it. |
| `src/app/shell/panels/operations.ts` | `normalisePanelLayout()` (version dispatcher), `cloneLayout`, `removeFromAllContainers`, `nextZ`, `insertIntoDock`, `insertIntoFloat`, `movePanel`, `detachPanel`, `openPanel`, `closePanel`, `togglePanelOpen`, `setPanelCollapsed`, `setFloatRect`, `raiseFloat`, `setDockWidth`, `setMemberHeight`, `resetPanelLayout`, `dockPanel` | Every pure operation, all routed through `normaliseV4` today. `setPanelCollapsed` and `setMemberHeight` keep their exact names/signatures and become compatibility wrappers over the new group ops. |
| `src/app/shell/panels/layout.ts` | the `useLocalStorage` serializer, `panelCollapsed`, `setMemberHeight`, `setPanelCollapsed`, `togglePanelCollapsed`, `clampRectToOverlay` (already uses `PANEL_FLOAT_TITLE_HEIGHT`), every other reactive wrapper | **Needs no behavioural edit** — every function it imports from `operations.ts` keeps its name; this packet only *adds* new group-op wrappers here. |
| `src/app/shell/panels/index.ts` | the full barrel — every current export name | **No export is removed or renamed** in this packet; only additions (`PanelGroup` type, `containerGroups`, `locatePanel`, `groupOf`, `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`, `migrateV4ToV5`). T-032a (dependency-locked) and T-070c2/d1-d3 consume this barrel's delta. |
| `src/app/shell/panels/legacy.ts` | `buildContainers`, `reinsertMissingOpenPanels`, `finaliseFloats`, `recomputeContainerCache`, `clampFloatRectFields`, `migrateV1ToV2`, `migrateV2ToV3`, `normalisePanelLayoutV2`, `normaliseV3Legacy`, `migrateV3ToV4` (generic, takes a `normaliser` callback) | **Not a bound file. Zero edits.** These are generic-typed (`GenericPanelState`) and untouched by the v4→v5 boundary; `containers.ts` only changes which function it passes as the `normaliser` callback. |
| `src/components/Shell/PanelStack.vue:27,44-59,66-87,140-155` | `ids = containerMembers(panelLayout.value, containerId)`; `memberStyle()` reads `panelLayout.value.panels[id].collapsed`/`.height` **directly as object properties, not through a function**; `resizeMember()` reads/writes the same; the `v-for` iterates `ids` (flat `PanelId[]`) | **Out of scope, must keep compiling and behaving identically.** This is the load-bearing reason `RegisteredPanelState.height`/`.collapsed` cannot simply move to `PanelGroup` in this packet — that is T-070c2's job, once this file is rewritten to iterate groups. |
| `src/components/Shell/FloatingPanel.vue:31-34` | `containerMembers(...)`; `allCollapsed = members.value.every(id => panelLayout.value.panels[id].collapsed)` | Same direct-property read; same reason. |
| `src/components/Shell/WorkspacePanel.vue:16` | `panelCollapsed(panelId)` | Goes through the function wrapper already — no direct risk, but the wrapper's return value must stay correct. |
| `src/components/ui/panel/PanelTitleBar.vue:13-21,35,46,66,114` | `panelCollapsed`, `togglePanelCollapsed`, `dockPanel`, `floatPanel`, `nudgePanel` | All go through wrappers; all must keep their exact signatures. |
| `src/components/Shell/PanelOverlay.vue:43-47` | `panelLayout.value.docks[target.container].length === 0` | `.length` on the container's group array — correct regardless of element type, since T-070c1 ships no default multi-member group (count of groups == count of panels, same as today). |
| `src/app/shell/panels/drag.ts:232` | `panelLayout.value.floats.find((float) => float.members.includes(id))` | **The single hardest compatibility constraint.** `drag.ts` is not a bound file (T-070d owns it) yet reads `FloatContainer.members` as a plain property, not through `containerMembers()`. `FloatContainer` must therefore keep a real `members: PanelId[]` field. |
| `src/app/shell/panels/drag.ts:126-130,390` | `panelLayout.value.panels[id]?.floatFallback`, `panelLayout.value.panels[id]?.container` | Both fields are unchanged by this packet — no risk. |
| `src/app/shell/panels/hosts.ts:63,108-109` | `containerOf(panelLayout.value, registeredId)`; `layout.docks.left.length > 0` | `containerOf` is a bound-file function (rewritten below); `.length` is safe per the `PanelOverlay.vue` note above. |
| `src/app/shell/menu/{use,app-menu}.ts` | read only `panels[id].open` | **Unchanged by v5.** `tests/engine/app/shell/menu/window-panels.test.ts` must pass unedited — the series-wide proof. |
| `src/app/shell/panels/{drop-target,snap,resize}.ts` | grepped 2026-08-20 for `PanelLayout`/`RegisteredPanelState`/`FloatContainer`/`.members`/`.index`/`panels[` | **Zero matches in all three files.** None of them touch the panel-layout schema; confirmed safe to leave untouched. |
| `tests/engine/app/shell/panels/{containers,operations,layout,registry}.test.ts` | full `describe`/`test` inventory read 2026-08-20 | The four files this packet rewrites. See Corrections for two **pre-existing, already-failing** tests found in this read. |
| `tests/engine/app/shell/menu/window-panels.test.ts`, `snap.test.ts`, `drop-target.test.ts` | — | Must pass **unedited**. |

## Read First

1. `src/app/shell/panels/types.ts` — the whole v4 schema plus the v3/v2 legacy blocks, to copy their commenting idiom for the new v4-legacy block.
2. `src/app/shell/panels/containers.ts` — `defaultPanelLayout`, `normaliseV4` and its helpers, `migrateV3ToV4`.
3. `src/app/shell/panels/legacy.ts` — read only, to confirm its generic helpers need no edit.
4. `src/app/shell/panels/operations.ts` — every exported function.
5. `src/app/shell/panels/layout.ts` and `index.ts` — the exact current export lists (nothing here may be removed).
6. `src/components/Shell/PanelStack.vue` and `FloatingPanel.vue` — the exact direct-property reads catalogued above. Do not edit either file; read them to understand what must keep working.
7. `src/app/shell/panels/drag.ts:220-233` — the `float.members.includes(id)` line and its context in `startPanelDrag`.

## Corrections to the Brief

- **T-070b1 is already Done in source, even though `Plan/plan.md`'s table still shows it as "Ready."** `PANEL_FLOAT_TITLE_HEIGHT = 24` exists in `types.ts`, is wired into `containers.ts`'s float-height floor and `layout.ts`'s `clampRectToOverlay`, and is exported from the barrel — confirmed by direct read and by the packet's own Status record. This expansion corrects `plan.md`'s row for T-070b1 to Done alongside landing this packet; no source work is needed for it.
- **The stub's "Depends on: T-070b2" is the series' strict landing-order convention, not a functional coupling.** T-070b2's entire touched-file set (`FloatTitleBar.vue`, `FloatingPanel.vue`, `tests/e2e/panels/{helpers,stacks}`) has zero overlap with this packet's bound files, and this packet reads no symbol T-070b2 introduces. T-070b2 is **Ready but not yet executed** as of this expansion (`src/components/Shell/FloatTitleBar.vue` does not exist). This packet does not require it to land first to be correct; the landing order still calls for it to land first in the working tree to avoid two packets editing divergent versions of the same files at once, but if T-070b2 is still Ready when this packet executes, proceed anyway — there is no shared file. Do **not** treat "T-070b2 is not Done" as a Stop Condition.
- **The superseded T-070c's own registry table (step 3) omits `swatches`.** Live `PANEL_IDS` and `PANEL_REGISTRY` both have 15 entries; `swatches` (`left`, dock index 2, `fill`, default height 280) landed with T-053 after that table was written. This packet's registry rename covers all 15.
- **Two pre-existing test failures were found on the live tree, unrelated to this packet, caused by the same T-053 drift:**
  1. `tests/engine/app/shell/panels/layout.test.ts:19` — `expect(Object.keys(result.panels)).toHaveLength(14)` — the live default has 15 panels (including `swatches`). Currently fails.
  2. `tests/engine/app/shell/panels/containers.test.ts:268` (`v4 migration and height invariants > migrateV3ToV4 preserves docks, floats, open set and collapsed flags while setting height to null`) — its hand-built v3 fixture's `panels` record omits `swatches`, so `migrateV3ToV4` throws `TypeError: undefined is not an object (evaluating 'state.open')` at `legacy.ts:309`. Currently fails.

  Confirmed by running `bun test tests/engine/app/shell/panels/` on the untouched tree: **75 pass, 2 fail**, both listed above. Since this packet rewrites `layout.test.ts` and `containers.test.ts` against v5 anyway, both are fixed as part of that rewrite (14 → 15; the fixture gains `swatches`) — not a separate bug hunt, but do not "port" either assertion's wrong number forward.
- **`RegisteredPanelState.height`/`.collapsed` and `FloatContainer.members` are NOT removed in this packet**, unlike the superseded T-070c's Fixed Decisions 2-3. They stay as documented DERIVED CACHE fields, mirroring the panel's own group / the container's flattened groups, recomputed every `normaliseV5()` pass. This is a deliberate, load-bearing departure from the superseded packet, required because `PanelStack.vue`, `FloatingPanel.vue` and `drag.ts` read them as plain properties and are out of this packet's scope (T-070c2 removes the mirrors once it rewrites those files to read groups directly).

## Fixed Decisions

1. **Persisted schema goes to v5; the key does not change.** `PANEL_LAYOUT_KEY` stays `open-potlood:panel-layout`. `PANEL_LAYOUT_VERSION` becomes `5`; a new `PANEL_LAYOUT_VERSION_V4 = 4` constant is added for the legacy block, matching the existing `_V3`/`_V2` pattern.

2. **`PanelGroup` is the new authoritative unit**, exactly:

   ```ts
   export interface PanelGroup {
     /** Ordered tab members. Never empty - normalisation removes an empty group. */
     members: PanelId[]
     /** The visible tab. Always a member; normalisation repairs it to members[0]. */
     active: PanelId
     /** Pinned pixel height for a `fill`-sized active tab, clamped to [PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]. Forced to null while collapsed or while the active tab is `content`-sized. */
     height: number | null
     collapsed: boolean
   }
   ```

   `docks: { left: PanelGroup[]; right: PanelGroup[] }`; `FloatContainer.groups: PanelGroup[]` (authoritative, never empty — an empty float is deleted by normalisation).

3. **Two v4-era fields are kept as DERIVED CACHE compatibility mirrors, not removed:**
   - `FloatContainer.members: PanelId[]` — the flattened `groups.flatMap(g => g.members)`, in order. Recomputed every `normaliseV5()` pass. Documented as: "DERIVED CACHE, never authoritative. Kept only so v4-era code outside this packet's scope (`drag.ts`'s `float.members.includes(id)` lookup) keeps compiling and behaving correctly against the v5 model. T-070c2/d may delete this once every direct reader is updated."
   - `RegisteredPanelState.height: number | null` and `.collapsed: boolean` — mirror the value of the panel's **own** group's `height`/`collapsed`. Documented as: "DERIVED CACHE mirroring this panel's own `PanelGroup`. Kept only so v4-era code outside this packet's scope (`PanelStack.vue`'s `memberStyle`/`resizeMember`, `FloatingPanel.vue`'s `allCollapsed`) keeps reading a correct value without being rewritten here. Meaningless to compare *across* two panels that share a group - always read the group directly once T-070c2 lands." Because this packet ships no way to create a multi-member group (no default grouping change, no tab UI yet), every panel's own group has exactly one member in every state this packet can reach, so the mirror is never ambiguous.

4. **`RegisteredPanelState.index` is replaced by `groupIndex: number` and `tabIndex: number`; `lastDock` becomes `{ side: DockSide; groupIndex: number; tabIndex: number }`.** `open`, `container` and `floatFallback` keep their current meaning and doc comments. `.index` has no external reader (grep-confirmed 2026-08-20: only `operations.ts`'s own `closePanel`, rewritten here) so it needs no compatibility shim.

5. **A group's sizing kind is its active tab's kind** (`PANEL_REGISTRY_BY_ID[group.active].sizing`). Reason: switching tabs can legitimately change a group between fill-height and content-height; keying off the active tab is the only rule that stays correct once T-070c2 adds tab switching. In this packet every group has one member, so this is equivalent to today's per-panel rule.

6. **Migration v4→v5 is one-group-per-panel, order preserved, no auto-tabbing.** Each v4 dock/float member becomes a single-tab group in the same position; the panel's `height`/`collapsed` become the group's. `defaultPanelLayout()` is unchanged in shape (same `DEFAULT_DOCKS`, `DEFAULT_HEIGHT`, `DEFAULT_OPEN` inputs), only re-expressed as one-member groups — **no tabbed default ships in this packet**; that is T-070c3's job.

7. **"Group index" and "member index" are numerically identical in every state this packet can reach, so `movePanel`'s `index` parameter keeps its exact v4 meaning with zero change to any caller.** `movePanel(layout, id, target, index)` keeps its signature and its "one atomic path" doc comment; internally, `index` now names a **group seam** and a fresh single-tab group is spliced there instead of a bare id. Because no code path in this packet ever produces a multi-member group, a group seam and a member seam are the same sequence of positions. This is what lets `drag.ts`'s `readContainerGeometry()` (unedited, reads `[data-test-id^="stack-member-"]`, itself unedited since `PanelStack.vue` is unedited) and `resolveDropTarget()` (unedited) keep producing correct, unmodified indices for `movePanel` to consume.

8. **`setPanelCollapsed(layout, id, collapsed)` and `setMemberHeight(layout, container, id, height)` keep their exact v4 names and signatures and become compatibility wrappers.** `setPanelCollapsed` locates `id`'s own group via the new `locatePanel()` and calls `setGroupCollapsed` on it. `setMemberHeight` locates `id`'s group **within the given `container`** and calls `setGroupHeight`; it stays a no-op (contract preserved) when `id` is not a member of any group in `container`. Both are byte-for-behaviour identical to their v4 selves in every reachable state, because every group has exactly one member.

9. **New pure group operations are added now, for T-070c2 to wire into UI, exercised only by this packet's own tests:** `setActiveTab(layout, container, groupIndex, id)` (no-op when `id` is not a member of that group), `setGroupCollapsed(layout, container, groupIndex, collapsed)`, `setGroupHeight(layout, container, groupIndex, height)` (both clamped by the height/collapse invariant), `closeGroup(layout, container, groupIndex)` (closes every member, preserving each one's reopen position, removes the group), `floatGroup(layout, container, groupIndex, rect?)` and `dockGroup(layout, floatId, groupIndex)` (float/dock the whole group as a unit). None of these has a caller in this packet outside `groups.test.ts` — no Vue file invokes them yet.

10. **Registry: `defaultDockIndex` renames to `defaultGroupIndex`; a new `defaultTabIndex: 0` is added to every entry**, including `swatches`. Values and ordering are otherwise unchanged from the live registry (`pages` left/0, `assets` left/1, `layers` left/1, `swatches` left/2, `export` right/0, `variables` right/1, `ai` right/2, `code` right/3, `appearance` right/1, `transform` right/0, `text` right/2, `page` right/2, `guides` right/4, `mask` right/5, `component` right/6). `sizing`, `defaultHeight` and `defaultFloating` are unchanged.

11. **The float-height floor is re-keyed from panels to groups, formula unchanged:** `PANEL_FLOAT_TITLE_HEIGHT + expandedGroups * PANEL_MEMBER_MIN_HEIGHT + collapsedGroups * PANEL_COLLAPSED_HEIGHT`, where "expanded"/"collapsed" now counts groups (`group.collapsed`) rather than panels. Equivalent to today's formula in every reachable state.

## Open Decisions

1. **Should dropping a `fill` panel into a `content` group be blocked?** *Recommended default - implement this:* no, allow it (inherited from the superseded T-070c's Open Decision 1, still unresolved by anything landed). A group's sizing follows its active tab (Fixed Decision 5), so a mixed group is well-defined. No code path in this packet can create one, so the rule only needs to be correct in `normaliseV5`, not enforced anywhere. *Alternative:* forbid mixed groups — rejected, no rejection UI exists and none is owned by this packet.

## Compatibility Contract — binding

This replaces a Visual Contract: this packet ships no Vue/template change. Instead, every out-of-scope file listed in Verified Starting State must observe **identical runtime values and behaviour** before and after this packet, verified by running its existing (unedited) callers unchanged:

- `containerMembers(layout, id): PanelId[]` — same signature, same return shape and order, for docks and floats alike. Implemented as `containerGroups(layout, id).flatMap(g => g.members)`.
- `panelLayout.value.panels[id].collapsed` / `.height` — same values as v4 would have produced, for every panel, in every test scenario this packet's own suite constructs.
- `panelLayout.value.floats.find(f => f.members.includes(id))` — resolves to the same float as v4 would have, via the `FloatContainer.members` mirror.
- `panelLayout.value.docks.left.length` / `.right.length` — same numeric value as v4 (count of top-level units), since every default/derived state has one member per group.
- `panelCollapsed(id)`, `setMemberHeight(container, id, height)`, `setPanelCollapsed(id, collapsed)`, `togglePanelCollapsed(id)`, `dockPanel(id)`, `floatPanel(id, rect?)`, `nudgePanel(id, dx, dy)`, `containerOf`/`panelContainerId` — every one of these keeps its exact name, signature and observable behaviour.
- `tests/engine/app/shell/menu/window-panels.test.ts`, `tests/engine/app/shell/panels/snap.test.ts`, `tests/engine/app/shell/panels/drop-target.test.ts` — pass unedited.

### Banned List

- No edit to `src/components/Shell/{PanelStack,FloatingPanel,PanelOverlay,WorkspacePanel,DockInsertionTarget}.vue`, `src/components/ui/panel/PanelTitleBar.vue`, or any other `.vue` file.
- No edit to `src/app/shell/panels/{drag,drop-target,snap,resize,hosts,legacy}.ts` — `hosts.ts` only because `containerOf` is a `containers.ts` export it consumes unchanged; `hosts.ts` itself needs no edit since it only calls `containerOf` and reads `.length`.
- No edit to any `tests/e2e/**` file.
- No default-layout change: `defaultPanelLayout()`'s dock membership, order, open set and pinned heights must be byte-identical to today's, only re-expressed as one-member groups.
- No new i18n key, no new npm dependency, no `src/app.css` edit, no Tailwind class anywhere (this packet touches no template).
- No removal or rename of any existing `src/app/shell/panels/index.ts` export.
- No `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`, Git work, version bump, build, or install.

## Allowed Changes

Modify:

- `src/app/shell/panels/{types,registry,containers,operations,layout,index}.ts`
- `tests/engine/app/shell/panels/{containers,operations,layout,registry}.test.ts`

Create:

- `tests/engine/app/shell/panels/groups.test.ts`

Delete: nothing.

Every other file, including every `.vue` file and every `tests/e2e/**` file, is out of scope.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Vue, template or E2E work of any kind.** This is a TypeScript-only packet.
- **No default-layout or tabbed-defaults work.** T-070c3 owns the approved tabbed arrangement; this packet's default output is one-group-per-panel, identical in membership/order/height to today.
- **No drop-target, drag-gesture or DOM-geometry change.** `DropTarget` stays `{ container, index }` with its current meaning; `drag.ts`, `drop-target.ts`, `snap.ts`, `resize.ts` are untouched.
- **Do not touch `src/app/shell/panels/legacy.ts`.** Its generic helpers (`buildContainers`, `reinsertMissingOpenPanels`, `finaliseFloats`, `recomputeContainerCache`, `clampFloatRectFields`, and the v1→v2→v3 migration chain) need no v5 awareness; only which function `containers.ts` passes them as a callback changes.
- **Do not touch `src/app/shell/menu/{use,app-menu}.ts`.** Both read only `panels[id].open`. `window-panels.test.ts` must pass unedited.
- **Do not remove `RegisteredPanelState.height`/`.collapsed` or `FloatContainer.members`.** They are compatibility mirrors this packet depends on; removing them is T-070c2's job once it rewrites their readers.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070a and T-070b1 are Done: `PANEL_LAYOUT_VERSION === 4`, `PANEL_FLOAT_TITLE_HEIGHT === 24` present in `types.ts` and wired into `containers.ts`'s `normaliseMemberHeights` and `layout.ts`'s `clampRectToOverlay`. Confirm `PANEL_IDS` has exactly 15 entries including `swatches`, and `PANEL_REGISTRY` has a matching `swatches` entry. Run `bun test tests/engine/app/shell/panels/` and confirm **75 pass, 2 fail** with exactly the two failures named in Corrections to the Brief (`layout.test.ts` panel-count-14, `containers.test.ts` migrateV3ToV4 `swatches` crash). If any of this has drifted further, stop and report — do not attempt to reconcile a third drift in the same packet.

**2 — `src/app/shell/panels/types.ts`.** Set `PANEL_LAYOUT_VERSION = 5`. Add `PanelGroup` per Fixed Decision 2. Change `FloatContainer.groups: PanelGroup[]` (authoritative) while keeping `members: PanelId[]` as the documented derived cache (Fixed Decision 3). Change `PanelLayout.docks` to `{ left: PanelGroup[]; right: PanelGroup[] }`. On `RegisteredPanelState`: replace `index: number` with `groupIndex: number` and `tabIndex: number`; change `lastDock` to `{ side: DockSide; groupIndex: number; tabIndex: number }`; keep `height`/`collapsed` as the documented derived-cache mirror (Fixed Decision 3, new doc comments); keep `open`, `container`, `floatFallback` unchanged. Add `PANEL_LAYOUT_VERSION_V4 = 4 as const` and a new "Legacy v4 shape (T-070a/b1)" block below the v3 block, byte-identical in field shape to today's live `FloatContainer`/`RegisteredPanelState`/`PanelLayout` (i.e. `FloatContainerV4` has only `members`, no `groups`; `RegisteredPanelStateV4` has `index`, not `groupIndex`/`tabIndex`; `PanelLayoutV4.docks` is `{ left: PanelId[]; right: PanelId[] }`), commented the same way as the existing v3/v2 blocks. Keep the v3 and v2 blocks byte-identical.

**3 — `src/app/shell/panels/registry.ts`.** Rename `defaultDockIndex` to `defaultGroupIndex` on the `PanelRegistryEntry` interface; add `defaultTabIndex: number`. Update the tuple literal and the `.map()` to carry `defaultTabIndex: 0` for all 15 entries, preserving every existing value per Fixed Decision 10. `sizing`, `defaultHeight`, `defaultFloating` unchanged.

**4 — `containers.ts`, part 1: rename and helpers.** Rename `normaliseV4` to `normaliseV4Legacy`, retyped against the new `FloatContainerV4`/`RegisteredPanelStateV4`/`PanelLayoutV4` legacy types, otherwise byte-identical (including its `PANEL_FLOAT_TITLE_HEIGHT` term). Update the module's top comment (currently says "v4 default/normalise core") to describe v5. Add `containerGroups(layout, id): PanelGroup[]` (docks return the array directly; a float returns its `groups`, or `[]` if not found). Rewrite `containerMembers(layout, id): PanelId[]` as `containerGroups(layout, id).flatMap(g => g.members)` — same exported name and signature. Rewrite `containerOf(layout, id)`: unchanged early-return on closed; for docks, `layout.docks[side].some(g => g.members.includes(id))`; for floats, search `layout.floats` by `.members.includes(id)` (the derived-cache field, valid because it is recomputed every normalisation pass) or by scanning `.groups` — pick one and document it (`.members` is simplest and already-guaranteed correct). Add `locatePanel(layout, id): { container: ContainerId; groupIndex: number; tabIndex: number } | null`, scanning docks then floats for the group containing `id` and that group's member index. `allContainerIds`, `floatContainerById` unchanged.

**5 — `containers.ts`, part 2: default layout.** Rewrite `defaultState(id)` to build a `RegisteredPanelState` shape with `groupIndex`/`tabIndex` (both from the registry's new `defaultGroupIndex`/`defaultTabIndex`) instead of `index`, and `lastDock: { side, groupIndex, tabIndex }`. Rewrite `defaultPanelLayout()`: build `docks.left`/`docks.right` by mapping each id in the **unchanged** `DEFAULT_DOCKS.left`/`.right` arrays to `{ members: [id], active: id, height: DEFAULT_HEIGHT[id] ?? null, collapsed: false }`, in the same order. `DEFAULT_DOCK_WIDTHS`, `DEFAULT_DOCKS`, `DEFAULT_HEIGHT`, `DEFAULT_OPEN` are **not otherwise edited** — this is the "no default-grouping change" guarantee.

**6 — `containers.ts`, part 3: `normaliseV5()`.** New live core, enforcing in this order (mirrors `normaliseV4`'s existing shape, one named helper per step):
  1. `version` is `5`; `dockWidths` clamped to `[PANEL_DOCK_MIN_WIDTH, PANEL_MAX_WIDTH]` (unchanged from v4).
  2. Unknown panel ids dropped everywhere (from every group's `members`).
  3. Group `members` deduplicated **globally**, in order: `docks.left`, `docks.right`, then `floats` in array order — same precedence as v4's per-panel dedup, now applied to flattened group members.
  4. A closed panel (`open === false`) is removed from every group's `members`.
  5. Empty groups removed; a float container left with zero groups is removed.
  6. `group.active` repaired to `members[0]` when it is not (or no longer) a member.
  7. Every open panel missing from every container is reinserted at its cached `container`/`groupIndex`/`tabIndex` as a **fresh single-tab group** at that position, falling back to its registry `defaultDock`/`defaultGroupIndex`/`defaultTabIndex` when that container no longer exists (the v4 invariant 5 rule, re-keyed to groups).
  8. Float ids renumbered densely by ascending `z` to `float:0..float:n-1`, `z` to `1..n` in the same order — unchanged from v4, carry the doc comment forward.
  9. `panels[id].container`/`groupIndex`/`tabIndex` recomputed from the authoritative group arrays; `lastDock` refreshed only while genuinely docked; `floatFallback` only while genuinely floating.
  10. **Compatibility mirrors recomputed:** for every panel, `panels[id].height`/`.collapsed` set from its own group's `height`/`.collapsed` (Fixed Decision 3); for every float, `.members` set to `groups.flatMap(g => g.members)` (Fixed Decision 3).
  11. `group.height` is `null`, or an integer clamped to `[PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]`; forced to `null` when the group is collapsed or `PANEL_REGISTRY_BY_ID[group.active].sizing === 'content'`.
  12. A float container's height floor is `PANEL_FLOAT_TITLE_HEIGHT + expandedGroups * PANEL_MEMBER_MIN_HEIGHT + collapsedGroups * PANEL_COLLAPSED_HEIGHT` (Fixed Decision 11); width stays clamped to `[PANEL_MIN_WIDTH, PANEL_MAX_WIDTH]` (unchanged from v4 — confirm this clamp already exists via `clampFloatRectFields` at the input-parsing stage, and preserve it).

**7 — `containers.ts`, part 4: `migrateV4ToV5()`.** Takes an already-normalised `PanelLayoutV4`. For each dock side, map each `PanelId` in order to `{ members: [id], active: id, height: v4.panels[id].height, collapsed: v4.panels[id].collapsed }`. For each float, map its `.members` the same way into `.groups`, preserving `x`, `y`, `width`, `height`, `z`, and set the float's compat `.members` to the same flattened array. Build `panels[id]` from the v4 state: `groupIndex` from v4's `index`, `tabIndex: 0`, `lastDock: { side: v4Dock.side, groupIndex: v4Dock.index, tabIndex: 0 }`, dropping the v4-era standalone `height`/`collapsed` reads (they become the group's, then get mirrored straight back by `normaliseV5`). Return `normaliseV5(...)`. Update the internal call inside `migrateV3ToV4` (the wrapper around `legacy.ts`'s generic `migrateV3ToV4Impl`) to pass `normaliseV4Legacy` instead of `normaliseV4`, and retype its return as `PanelLayoutV4`.

**8 — `operations.ts`.** Update imports from `./containers` (`normaliseV4` → `normaliseV5`, `normaliseV4Legacy`; add `migrateV4ToV5`, `containerGroups`, `locatePanel`). Update the dispatcher: version `1` → `migrateV4ToV5(migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(value))))`; `PANEL_LAYOUT_VERSION_V2` → same chain from `normalisePanelLayoutV2(value)`; `PANEL_LAYOUT_VERSION_V3` → `migrateV4ToV5(migrateV3ToV4(normaliseV3Legacy(value)))`; `PANEL_LAYOUT_VERSION_V4` → `migrateV4ToV5(normaliseV4Legacy(value))`; `PANEL_LAYOUT_VERSION` (now 5) → `normaliseV5(value)`; anything else → `defaultPanelLayout()`. Point `cloneLayout()` at `normaliseV5`. Then:
  - `removeFromAllContainers(layout, id)`: rewrite to filter `id` out of every group's `members` in `docks.left`, `docks.right` and every float's `groups`, pruning emptied groups and float containers left with zero groups.
  - `insertIntoDock(layout, id, side, index)` / `insertIntoFloat(layout, id, floatId, index)`: splice a fresh `{ members: [id], active: id, height: null, collapsed: false }` group at the clamped `index` (Fixed Decision 7 — a group seam). `insertIntoFloat`'s "synthesise a fresh float" fallback path builds a float with one such group.
  - `movePanel`, `detachPanel`, `openPanel`, `closePanel`, `togglePanelOpen`, `setFloatRect`, `raiseFloat`, `setDockWidth`, `resetPanelLayout`, `dockPanel` keep their exact signatures and doc comments, adapted to call the group-seam helpers and read `groupIndex`/`tabIndex` where `index` was read before. `closePanel` sets `state.container`/`groupIndex`/`tabIndex` from `locatePanel()` before removal.
  - **Compatibility wrappers (Fixed Decision 8):** `setPanelCollapsed(layout, id, collapsed)` calls `locatePanel(result, id)`; if found, calls the new `setGroupCollapsed(result, container, groupIndex, collapsed)`; if not found (shouldn't happen for any registered id, but matches the old function's total/non-throwing contract), returns `normaliseV5(result)` unchanged. `setMemberHeight(layout, container, id, height)` finds `id`'s groupIndex within `containerGroups(result, container)`; no-ops (preserves the exact v4 contract) if `id` is not a member of any group in `container`; otherwise calls `setGroupHeight`.
  - **New pure group operations (Fixed Decision 9):** `setActiveTab(layout, container, groupIndex, id)`, `setGroupCollapsed(layout, container, groupIndex, collapsed)`, `setGroupHeight(layout, container, groupIndex, height)` (clamped per invariant 11), `closeGroup(layout, container, groupIndex)` (closes every member, preserving each one's `container`/`groupIndex`/`tabIndex` for reopen exactly as `closePanel` does, then removes the group), `floatGroup(layout, container, groupIndex, rect?)` (creates a new float holding a copy of that whole group, removing it from its source), `dockGroup(layout, floatId, groupIndex)` (docks that whole group back to its members' shared `lastDock`, or — if members disagree because this packet never produces that state — the first member's `lastDock`). Every function is pure, total, non-throwing, out-of-range-safe, and returns `normaliseV5(...)`.

**9 — `layout.ts`.** No signature or behaviour change to any existing export — every name it imports from `operations.ts` (`setMemberHeight as setMemberHeightPure`, `setPanelCollapsed as setPanelCollapsedPure`, etc.) still exists with the same signature. **Add** thin reactive wrappers for the new pure ops: `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`, plus read helpers `containerGroups(containerId)` and `groupOf(panelId)` (delegating to `locatePanel` and returning the `PanelGroup` itself, or `null`). Each `write(...)`s the pure op's result exactly like the existing wrappers.

**10 — `index.ts`.** Add exports: `type PanelGroup`, `containerGroups`, `locatePanel`, `groupOf`, `setActiveTab`, `setGroupCollapsed`, `toggleGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup`, `migrateV4ToV5`, `type PanelLayoutV4` (if any test needs to construct one), `PANEL_LAYOUT_VERSION_V4`. **Remove nothing; rename nothing.**

**11 — Unit tests.** Rewrite `tests/engine/app/shell/panels/{containers,operations,layout}.test.ts` against the v5 model, correcting the two pre-existing failures from Corrections to the Brief as part of the rewrite (15-panel count; the `migrateV3ToV4`/`migrateV4ToV5` fixture carries all 15 ids including `swatches`). Extend `registry.test.ts` for `defaultGroupIndex`/`defaultTabIndex`, covering all 15 entries. Create `tests/engine/app/shell/panels/groups.test.ts` covering: `migrateV4ToV5` producing one group per v4 member with order, `height` and `collapsed` preserved, for both docks and floats; a stored `version: 1`/`2`/`3`/`4` value surviving the full chain to v5 with the same panels in the same one-group-per-panel positions; every normalisation invariant from Step 6, including a group with a non-member `active`, an empty group, a globally duplicated member, and a `content`-active group having `height` forced to `null`; the float-height floor formula; `setActiveTab` no-opping for a non-member; `setGroupCollapsed`/`setGroupHeight` clamping; `closeGroup` preserving every member's reopen position; `floatGroup`/`dockGroup` round-tripping; `setPanelCollapsed`/`setMemberHeight` producing results identical to hand-constructed direct group mutation (the compatibility-wrapper proof); the `FloatContainer.members` mirror and `RegisteredPanelState.height`/`.collapsed` mirrors staying correct after every operation in this file; and `defaultPanelLayout()` matching today's v4 shape exactly (same dock membership/order/open-set/pinned-heights), re-expressed as one-member groups. Do **not** edit `snap.test.ts`, `drop-target.test.ts` or `tests/engine/app/shell/menu/window-panels.test.ts`.

**12 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] `PANEL_LAYOUT_VERSION === 5`; `PANEL_LAYOUT_KEY` unchanged; a stored v1, v2, v3 or v4 value loads without console error and keeps its panels one-group-per-panel in the same order, with `height`/`collapsed` preserved (`groups.test.ts`).
- [ ] `defaultPanelLayout()` is byte-identical in membership/order/open-set/pinned-heights to today's v4 default, re-expressed as one-member groups (`groups.test.ts`).
- [ ] `containerMembers`, `panelCollapsed`, `setMemberHeight`, `setPanelCollapsed`, `togglePanelCollapsed`, `dockPanel`, `floatPanel`, `containerOf`/`panelContainerId` all keep their v4 names, signatures and observable behaviour (`groups.test.ts` plus the rewritten `containers`/`operations`/`layout` suites).
- [ ] `FloatContainer.members` and `RegisteredPanelState.height`/`.collapsed` exist, are documented as derived caches, and are correctly recomputed by `normaliseV5()` after every operation (`groups.test.ts`).
- [ ] `setActiveTab`, `setGroupCollapsed`, `setGroupHeight`, `closeGroup`, `floatGroup`, `dockGroup` exist, are pure/total/non-throwing, and behave per Fixed Decision 9 (`groups.test.ts`).
- [ ] `src/app/shell/panels/legacy.ts` has zero diff.
- [ ] No `.vue` file and no `tests/e2e/**` file has any diff.
- [ ] `tests/engine/app/shell/menu/window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` pass **with no edit**.
- [ ] The two pre-existing failures named in Corrections to the Brief no longer occur, fixed as a side effect of the v5 rewrite, not a separate patch.
- [ ] No `src/app/shell/panels/index.ts` export is removed or renamed; only additions appear in the diff.
- [ ] No new dependency, `src/app.css` edit, i18n key, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0 (proves every unedited `.vue` file still type-checks against the new schema). `packages/vue/tsconfig.json` is not required: no package source changes.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ tests/engine/app/shell/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0, 15/15 test files... (count as reported) with zero failures; `groups.test.ts` present and green.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

This packet adds no user-visible behaviour, so the browser check is regression-only. Run `bun run dev` from `App/` (Vite, port 1420):

1. **Nothing looks different.** With the existing `open-potlood:panel-layout` (if any) intact, confirm the panel layout renders exactly as it did before this packet: same docked panels in the same order, same open floats, same collapsed states, same pinned heights.
2. **Drag still works.** Detach a docked panel into a float, drag it back and merge it into another float's stack, resize a member's height by its divider — confirm every gesture behaves exactly as before (this exercises `drag.ts`'s `float.members.includes(id)` compatibility path).
3. **Collapse/expand and float/dock still work** from a title bar's own controls.
4. **Reload persistence.** Reload and confirm the layout is unchanged and `localStorage`'s `open-potlood:panel-layout` shows `"version":5`.
5. **Console.** No warning or error in the browser console attributable to this packet.

This browser proof is sufficient for a source-only TypeScript change with zero template edits. It is not installed-desktop proof. Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070a or T-070b1 is not Done, or pre-flight finds `PANEL_LAYOUT_VERSION !== 4` or `PANEL_FLOAT_TITLE_HEIGHT` missing. The tree has drifted beyond what this packet accounts for.
- Pre-flight's `bun test tests/engine/app/shell/panels/` shows a failure count or pattern different from the documented 75-pass/2-fail baseline — the tree has drifted further; do not silently absorb a third, undocumented failure into this rewrite.
- Any out-of-scope `.vue` file or `drag.ts` fails to type-check or changes behaviour after the schema change — a compatibility mirror is wrong or missing.
- `window-panels.test.ts`, `snap.test.ts` or `drop-target.test.ts` requires an edit to pass — this packet changed a contract it promised not to touch.
- `movePanel` cannot stay a single atomic path once members are groups, or the group-seam/member-seam index equivalence (Fixed Decision 7) does not hold.
- The change needs a new dependency, `src/app.css` edit, i18n key, a second `localStorage` key, a `.vue` edit, an E2E edit, or a file outside Allowed Changes.
- Any named source gate or focused test fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file modified and created, with a one-line reason each;
- the final v5 declarations for `PanelGroup`, `FloatContainer`, `RegisteredPanelState` and `PanelLayout`, including the two derived-cache fields and their doc comments;
- the twelve `normaliseV5` steps as implemented, plus any merged, split or reworded and why;
- **which `src/app/shell/panels/index.ts` exports were added** (must be additions only — confirm by grep-diff against the list in this packet's Verified Starting State row for `index.ts`);
- confirmation, by grep output, that `src/app/shell/panels/legacy.ts` and every `.vue` file have zero diff;
- confirmation that the two pre-existing test failures from Corrections to the Brief are now fixed;
- every command from Verification with its exact exit code, test counts and any failure output;
- confirmation that `window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` passed unedited;
- the browser observations for all five Integration Check items;
- confirmation that no dependency, `src/app.css` edit, i18n key, version-file change, build, install or Git work occurred;
- the Open Decision as resolved, plus any assumption or remaining gap for T-070c2 to pick up.

Do not claim delivery. This packet stops at source gates plus the regression-only browser check.

## Revision History

- Revision 1 — 2026-08-20: Brief, created as the model/migration split of the superseded T-070c.
- Revision 2 — 2026-08-20: expanded against live `App/` source. Narrowed scope from the superseded T-070c's Fixed Decisions 2-3 (which removed `height`/`collapsed`/`members` outright) to a compatibility-mirror design, because `PanelStack.vue`, `FloatingPanel.vue` and `drag.ts` read those fields directly and are out of this packet's bound-file list. Corrected the superseded packet's registry table to include `swatches` (T-053). Corrected `Plan/plan.md`'s stale "Ready" status for the already-Done T-070b1. Found and will fix two pre-existing, unrelated test failures caused by the same `swatches` drift.

## Status record

Status: **Ready**

Expansion receipt (2026-08-20). Verified against live source:

1. **T-070a and T-070b1 are both Done in source**, though `Plan/plan.md`'s table still showed T-070b1 as "Ready" before this expansion corrected it — `PANEL_FLOAT_TITLE_HEIGHT` is live in `types.ts`, `containers.ts` and `layout.ts`.
2. **T-070b2 is not yet executed** (`FloatTitleBar.vue` does not exist) but has zero file or behavioural overlap with this packet — the stub's "Depends on: T-070b2" is the series' landing-order convention, not a functional coupling; this packet does not require it.
3. **`PANEL_IDS`/`PANEL_REGISTRY` have 15 entries, not 14** — `swatches` (T-053) landed after the superseded T-070c's registry table was written. Corrected here.
4. **Two pre-existing engine-test failures exist on the untouched tree** (`layout.test.ts`'s panel-count assertion, `containers.test.ts`'s `migrateV3ToV4` fixture), both caused by the same `swatches` omission, both fixed as a side effect of this packet's v5 test rewrite. Confirmed by running `bun test tests/engine/app/shell/panels/` before any edit: 75 pass, 2 fail.
5. **`drag.ts:232`'s `float.members.includes(id)`** is the single hardest compatibility constraint found: it reads `FloatContainer.members` as a plain property, not through `containerMembers()`, and `drag.ts` is out of this packet's scope. This is why `FloatContainer.members` and `RegisteredPanelState.height`/`.collapsed` are kept as derived-cache mirrors rather than removed, departing from the superseded T-070c's Fixed Decisions 2-3.
6. **`src/app/shell/panels/{drop-target,snap,resize}.ts` and `legacy.ts` need zero edits** — grep-confirmed no reference to the panel-layout schema in the first three; the fourth's helpers are generic and untouched by the v4→v5 boundary.

One Open Decision was carried forward from the superseded T-070c with an implemented default (allow mixed fill/content groups) — unreachable in this packet's own state space, so it is a forward-looking note for T-070c2/d, not a blocker here.
