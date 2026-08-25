# T-070c3 - Panel-group defaults and legacy cleanup

Task ID: T-070c3
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070c2 (Done)
Related: T-070c1 (Done — v5 model this packet's default-layout rewrite targets), T-070c2 (Done — the tab-strip UI this packet stops duplicating), T-070d1-d3 (drop targeting for real multi-member groups, unaffected by this packet), T-032a (dependency-locked until T-070d3 — consumes the barrel unchanged by this packet)
Prepared from: the stub's Exact Contract, expanded against live `App/` source
Expanded at: 2026-08-21 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-21 — `src/app/shell/panels/{registry,containers}.ts`, `src/components/Shell/{WorkspacePanel,PanelGroup,PanelTabStrip,PanelStack}.vue`, `src/components/ui/panel/{PanelTitleBar.vue,index.ts}`, `tests/e2e/panels/{helpers,basic,stacks,tabbed-groups}.spec.ts` and `helpers.ts`, `tests/engine/app/shell/panels/{groups,containers,operations,layout,registry}.test.ts`, `tests/e2e/{layers,code,chat,properties}/panel.spec.ts`, `tests/e2e/components/assets-panel.spec.ts`, `Plan/plan.md`, `Plan/Packets/T-070-indesign-panel-management.md`, and the superseded `Plan/Archive/Superseded/T-070c-tabbed-panel-groups.md` for its Fixed Decision 8 default-layout shape as the approved arrangement's source
Delivery: named source gates + browser check

## Intended Outcome

Ship the approved tabbed default startup layout (`Plan/Packets/T-070-indesign-panel-management.md` line 38: "Approved defaults, Export closed and legacy title-bar removal"), delete the now-fully-superseded `PanelTitleBar.vue`, and retarget every E2E helper and spec that still drives the deleted per-panel title bar onto the tab strip T-070c2 shipped. After this packet, every panel has exactly one 33 px header — the tab strip — never two.

## Request Coverage

The default-layout and cleanup slice of T-070's requirement groups 1 and 4 (`Plan/Packets/T-070-indesign-panel-management.md`). Requirement 1 ("clean up the default startup layout … Export closed by default") and requirement 4's out-of-the-box demonstration of tabs both land here. T-070c1 shipped the schema, T-070c2 shipped the UI over a one-group-per-panel default; this packet is the only one of the three that changes what a fresh install actually shows.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/containers.ts` | `DEFAULT_DOCK_WIDTHS`, `DEFAULT_DOCKS = { left: ['pages','layers'], right: ['transform','appearance','page'] }`, `DEFAULT_HEIGHT = { pages: 200 }`, `DEFAULT_OPEN = new Set(['pages','layers','transform','appearance','page'])`, `defaultState(id)`, `defaultPanelLayout()`'s `makeDock` building one-member `PanelGroup`s from those flat arrays | **The only default-layout core, verified live 2026-08-21.** `defaultPanelLayout()` builds `panels` via `defaultState(id)` (registry-keyed `groupIndex`/`tabIndex`) and `docks` via `makeDock(DEFAULT_DOCKS.left/right)` **separately**, with no reconciling pass between them. This packet replaces the flat arrays with literal grouped structures and must keep both halves consistent (see Fixed Decision 3). |
| `src/app/shell/panels/registry.ts` | `PANEL_REGISTRY` — `appearance: right/1/0`, `text: right/2/0`, `page: right/2/0`, `guides: right/4/0` (`defaultDock`/`defaultGroupIndex`/`defaultTabIndex`) | **Confirmed live 2026-08-21: `text` and `guides` are not currently members of `appearance`'s or `page`'s registry slot** — each has its own `defaultGroupIndex`, unused by `defaultPanelLayout()` today (which never opens them) but consulted by `normaliseV5`'s `reinsertMissingV5` as the fallback position for a panel with no cached container. Re-keying these four entries to the approved grouped shape (Fixed Decision 2) is in this packet's scope; `pages`, `layers`, `transform`, `swatches`, `export`, `variables`, `ai`, `code`, `mask`, `component` are unchanged. |
| `src/app/shell/panels/containers.ts` | `normaliseV5`'s `updateV5Cache` (recomputes every open panel's `container`/`groupIndex`/`tabIndex`/`lastDock` from the authoritative `docks`/`floats` arrays on every pass) | **Verified live 2026-08-21 needing zero edit.** This is the existing mechanism (T-070c1) that reconciles `panels[id]`'s cached position fields against whatever `docks`/`floats` actually contain. `resetPanelLayout()` (in `operations.ts`) already calls `normaliseV5(defaultPanelLayout())`, so any transient mismatch between `defaultState()`'s registry-derived `groupIndex`/`tabIndex` and the new grouped `docks` literal is corrected there. The one gap (Fixed Decision 3) is `normalisePanelLayout()`'s empty/invalid branch, which returns raw `defaultPanelLayout()` **without** a normalisation pass. |
| `src/components/Shell/WorkspacePanel.vue` (full file, read 2026-08-21) | `<PanelTitleBar :panel-id="panelId" :title="panels[panelId]" />`, the single `Teleport`, `v-show="!collapsed"`, `WorkspacePanelContent`'s `:key` | **The only remaining render call.** Grep-confirmed the sole consumer of `PanelTitleBar.vue`. Removing this line, its import, and the now-dead `collapsed`/`panelCollapsed` computed (nothing else in this file reads `collapsed` once the title bar's `v-show` binding is gone — `PanelGroup.vue`'s own sizing already clips a collapsed group to 33 px, so no replacement `v-show` is needed) is this packet's only Vue diff outside the panel-group defaults. |
| `src/components/ui/panel/PanelTitleBar.vue`, `src/components/ui/panel/index.ts` | full 128-line component; barrel confirmed (2026-08-21, matching T-070c2's own finding) to **not** re-export it | Deleted whole. No barrel edit needed. |
| `src/components/Shell/{PanelGroup,PanelTabStrip,PanelStack}.vue` | full files, read 2026-08-21 | **Verified needing zero edit.** All three already operate purely on `containerGroups(...)`; nothing in them assumes one member per group or reads `PanelTitleBar`. `PanelGroup.vue`'s `data-test-id="stack-member-${group.active}"` / `data-panel-id="group.active"` and its five-case sizing already key off the group's **active** member exactly as needed once groups gain real tab counts. |
| `tests/e2e/panels/helpers.ts` (full file, read 2026-08-21) | `dragTitleBarTo()`, `dragFloatTo()` (both target `getByTestId('panel-title-<id>')`), `floatPanel()` (clicks `panel-float-<id>`), `floatingWindowFor()` (unaffected — filters by `stack-member-<id>`), `ensurePanelOpen()` (seeds a v4-shaped layout, unaffected), `seedGroupedPanels()` (T-070c2, unaffected) | **`dragTitleBarTo`, `dragFloatTo` and `floatPanel` all target IDs `PanelTitleBar.vue` alone rendered** (`panel-title-<id>`, `panel-float-<id>`). Deleting it without retargeting these three breaks every test that calls them — nearly every test in `basic.spec.ts` and `stacks.spec.ts`. This is the packet's largest single piece of mechanical work. |
| `tests/e2e/panels/basic.spec.ts`, `stacks.spec.ts` (full files, read 2026-08-21) | direct `getByTestId('panel-title-<id>')` (dblclick + visibility, e.g. `basic.spec.ts:140,148,155,165,189-190,200-201,232,396`; `stacks.spec.ts:212-213,221-222,266-267`), direct `getByTestId('panel-minimise-<id>')` (`basic.spec.ts:197,208`), direct `getByTestId('panel-float-<id>')` (`stacks.spec.ts:266`) | Every one of these is a direct call outside the three helpers above and needs the same ID retargeting, file by file (Implementation Step 5). |
| `tests/e2e/panels/tabbed-groups.spec.ts` (full file, read 2026-08-21) | the final test, `'doubled-header interim state: default single-tab layout renders both tab strip and title bar, and both collapse/expand'`, asserting `panel-title-pages` alongside `panel-tab-strip-left-0` | **This test documents the exact regression this packet removes.** It must be deleted (Fixed Decision 5), not retargeted — there is no second header left to prove co-exists. |
| `tests/engine/app/shell/panels/groups.test.ts:34-53` (full file, read 2026-08-21) | `'defaultPanelLayout matches v4 membership, order, open set and pinned heights re-expressed as single-member groups'` — asserts `containerMembers(layout, 'right')` equals `['transform','appearance','page']` and `layout.docks.right` is three one-member groups | **The one existing unit test this packet's default-layout change breaks.** Rewritten in Implementation Step 8 to the approved grouped shape; every other test in this file (`migrateV4ToV5`, the eleven invariants, the pure group operations) constructs its own fixtures independent of `defaultPanelLayout()` and needs no edit. |
| `tests/engine/app/shell/panels/containers.test.ts` | multiple `defaultPanelLayout()`-based fixtures indexing `docks.right[0]`/`docks.right[1]`/`docks.left[0]` (e.g. lines 284-302) | **Verified needing zero edit.** The approved arrangement (Fixed Decision 2) keeps `docks.left` at 2 groups and `docks.right` at 3 groups — identical counts to today — so every existing index-based assertion (`docks.right[0]` = Transform, `docks.right[1]` = Appearance{+Text}, `docks.left[0]` = Pages) keeps resolving to the same group it did before, just with `appearance`'s and `page`'s groups now carrying a second member each. None of these tests reads `.members.length` or asserts single-membership. |
| `tests/e2e/{layers,code,chat,properties}/panel.spec.ts`, `tests/e2e/components/assets-panel.spec.ts` | grepped 2026-08-21 for `panel-title-`, `panel-float-`, `panel-minimise-`, `panel-close-`, `stack-member-`, `panel-tab-strip` | **Zero matches in all five files.** None of them reference the deleted title bar or any tab-strip selector; they exercise panel content through other test ids. They are named in this packet's Verification only as regression proof that panel content still renders correctly inside its (now single-header) group host. |
| `tests/engine/app/shell/menu/window-panels.test.ts` | reads only `panels[id].open` | **Unaffected.** This packet changes which panels are open by default and how they are grouped, not the `open` field's meaning. Must still pass unedited. |

## Read First

1. `src/app/shell/panels/containers.ts:120-149` — `DEFAULT_DOCK_WIDTHS`/`DEFAULT_DOCKS`/`DEFAULT_HEIGHT`/`DEFAULT_OPEN`, `defaultState()`, `defaultPanelLayout()` — the exact code this packet rewrites.
2. `src/app/shell/panels/registry.ts` — the full `PANEL_REGISTRY` tuple literal, to edit only the four named rows.
3. `src/components/Shell/WorkspacePanel.vue` — confirm it is still `PanelTitleBar.vue`'s only consumer before deleting either.
4. `tests/e2e/panels/helpers.ts` — `dragTitleBarTo`, `dragFloatTo`, `floatPanel`, `floatingWindowFor` — the exact selectors to retarget and the one to leave alone.
5. `tests/e2e/panels/basic.spec.ts` and `stacks.spec.ts` — every direct `panel-title-*`/`panel-minimise-*`/`panel-float-*` call site (line numbers catalogued in Verified Starting State above; re-grep before editing in case the tree has drifted).
6. `tests/engine/app/shell/panels/groups.test.ts:34-53` — the one test this packet's schema change breaks.

## Corrections to the Brief

- **"Ensure the Export panel is closed by default" needs no source change.** `DEFAULT_OPEN` already excludes `export` (confirmed live 2026-08-21, same finding T-070c1/T-070's scope map both already recorded). This packet's job is a regression **guard**: keep it excluded through the grouped-default rewrite, and prove it with the existing `groups.test.ts` assertion `expect(layout.panels.export.open).toBe(false)` — implicit in the rewritten default-shape test (Step 8) — plus the cleared-storage browser check (Integration Check 1). Do not hunt for a bug; there is none.
- **The stub's "no schema-operation ... redesign" scope note is correct and unchanged from the brief.** Nothing in `PanelGroup`, `FloatContainer`, `RegisteredPanelState`, or any pure operation (`setActiveTab`, `closeGroup`, `floatGroup`, etc.) changes shape or signature in this packet — only the **data** `defaultPanelLayout()` and `PANEL_REGISTRY` produce changes.
- **`defaultPanelLayout()`'s two-halves-built-separately structure (Verified Starting State row 1) is a real, previously-latent gap, not something this packet introduces.** It already exists on the live one-member-per-group default (harmless there, because every registry `defaultGroupIndex`/`defaultTabIndex` already matches its own single-member group's position). It becomes load-bearing the moment `appearance`+`text` and `page`+`guides` share a group, because `defaultState('text')`'s registry-derived `groupIndex`/`tabIndex` must now equal `1`/`1` (second tab of `appearance`'s group), not `2`/`0` (its own, no-longer-existing slot) — Fixed Decision 3 closes this exactly, not as a side quest.
- **A live `bunx playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil` run against the untouched tree (2026-08-21, ahead of any edit) returned 10 failed, 7 passed — pre-existing regressions inherited from T-070c2's doubled-header state, not something Steps 6-7's mechanical retargeting alone is guaranteed to fix.** They split into two causes:
  1. **Three assertions compare a persisted dock against a flat `PanelId[]` literal** (`basic.spec.ts:187` `expect((await readPanelLayout(page)).docks.left).toEqual(['pages', 'layers'])`, and similarly at `:394`) when the real stored shape has been `PanelGroup[]` since T-070c1 (confirmed live: the received value was `[{members:['pages'],active:'pages',height:200,collapsed:false}, {members:['layers'],...}]`). These must be fixed by flattening the comparison (`.docks.left.flatMap((g) => g.members)`), not by changing what they check — add this as an in-scope fix alongside Step 7's retargeting, and correct `StoredPanelLayout`'s `docks` type in `helpers.ts` (currently typed `{ left: string[]; right: string[] }`, which has been wrong since T-070c1) to `{ left: StoredGroup[]; right: StoredGroup[] }` in the same pass as Step 6. `StoredFloat.members: string[]` is, by contrast, already correct — it is the genuine flat compat-mirror field `normaliseV5()` writes onto every `FloatContainer`; failures touching `float.members` (next point) are not a shape bug.
  2. **Seven failures are drag-geometry/order/timeout regressions** — a merged stack lands in the wrong member order, a three-member float splits into two, a two-member separation merges into one, and one dblclick times out because the new tab strip's tab button (now the topmost element at the old click coordinates) intercepts a click meant for the title bar sitting 33 px below it (`stacks.spec.ts:198`'s failure log shows literally "`<button role=\"tab\" ...> subtree intercepts pointer events`"). **These are expected to self-resolve once Step 6-7's retargeting moves every drag/dblclick handle from the title bar to the tab strip** — the tab strip now sits in the exact geometric slot the title bar occupied alone before T-070c2, restoring the pixel math the original tests were tuned against. This is a prediction, not a guarantee: Acceptance Criteria and Stop Conditions below require confirming all ten are actually gone, and diagnosing (not skipping or weakening) any that isn't.
  `swatches.spec.ts` has zero title-bar/tab dependency (grep-confirmed) and passed 5/5 on the same baseline run — unaffected, stays out of scope.

## Fixed Decisions

1. **`PanelTitleBar.vue` is deleted, and `WorkspacePanel.vue`'s render call, import and now-dead `collapsed` computed are removed with it.** Reason: T-070c2 (Done) explicitly deferred this exact removal to this packet (its own Fixed Decision 1 and Execution Report Contract's "remaining gap for T-070c3"); every one of its five behaviours (drag, double-click collapse, pin/unpin, Enter/Space + arrow-key nudge, close) already has a home on `PanelTabStrip.vue`, landed and covered by `tabbed-groups.spec.ts`.

2. **The approved default layout, replacing `DEFAULT_DOCKS`/`DEFAULT_HEIGHT`/`DEFAULT_OPEN` with literal grouped structures — carried forward unchanged from the superseded T-070c's Fixed Decision 8, the only place this exact arrangement was specified and approved:**

   - `dockWidths`: `{ left: 240, right: 280 }` — unchanged.
   - `docks.left`: two one-member groups, in order — `{ members: ['pages'], active: 'pages', height: 200, collapsed: false }`, `{ members: ['layers'], active: 'layers', height: null, collapsed: false }`.
   - `docks.right`: three groups, in order — `{ members: ['transform'], active: 'transform', height: null, collapsed: false }`, `{ members: ['appearance', 'text'], active: 'appearance', height: null, collapsed: false }`, `{ members: ['page', 'guides'], active: 'page', height: null, collapsed: false }`.
   - `floats`: `[]`.
   - Open set: exactly `{ pages, layers, transform, appearance, text, page, guides }` — seven ids. Every other panel, **including `export`**, stays closed.

   Reason: demonstrates tabs out of the box (requirement 4) without merging Transform and Appearance together (which would regress the ordinary edit loop by hiding one behind a tab the user must remember to click), keeps the group **count** on each side identical to today's (2 left, 3 right — Verified Starting State row for `containers.test.ts`), and is the one arrangement the project has already recorded a design rationale for.

3. **`defaultPanelLayout()` must produce internally consistent `panels[id]`/`docks` fields with no reliance on `normaliseV5` running afterward**, because `normalisePanelLayout()`'s empty/invalid-storage branch returns it raw (Verified Starting State row 3). Concretely: after building the grouped `docks.left`/`docks.right` literal (Fixed Decision 2), recompute every open panel's `container`/`groupIndex`/`tabIndex`/`lastDock` from that literal — the same shape `updateV5Cache` already produces on every `normaliseV5` pass, just run once inline for the default. `defaultState(id)`'s registry-derived `groupIndex`/`tabIndex`/`lastDock` remain the values used only while a panel is **closed** (`open: false`) or has no group yet; every id present in the Fixed Decision 2 arrangement gets its fields overwritten by the recompute pass, not left at whatever the registry says. This can reuse `updateV5Cache`'s exact algorithm (imported and called directly on the constructed `docks`/`panels`, with `floats: []` needing no float pass) or a small dedicated helper — either is acceptable as long as the result is byte-identical to what `normaliseV5(defaultPanelLayout())` would itself produce (this equivalence is the acceptance test in Step 8).

4. **Registry `defaultGroupIndex`/`defaultTabIndex` for `text` and `guides` are re-keyed to join `appearance`'s and `page`'s groups**, for fallback consistency when `reinsertMissingV5` (T-070c1, unedited) has to place a panel with no cached container: `text` becomes `right`/`1`/`1` (was `right`/`2`/`0`); `guides` becomes `right`/`2`/`1` (was `right`/`4`/`0`). `appearance` (`right`/`1`/`0`) and `page` (`right`/`2`/`0`) are unchanged — they are already tab `0` of their own groups. Every other registry row (`pages`, `assets`, `layers`, `swatches`, `export`, `variables`, `ai`, `code`, `transform`, `mask`, `component`) is unchanged. Reason: `reinsertMissingV5` always splices a **fresh single-tab group** at the cached position rather than merging into an existing group (T-070c1's own design, unedited here), so this re-keying only affects *where* such a fresh group lands, not whether it merges — it keeps that fallback position consistent with the new approved layout rather than pointing at a slot (`right`/`2`/`0` for text, colliding with `page`; `right`/`4`/`0` for guides, now a gap) that no longer reflects the shipped arrangement.

5. **`tests/e2e/panels/tabbed-groups.spec.ts`'s doubled-header test is deleted, not retargeted.** Reason: it exists solely to prove T-070c2's documented interim regression was real and both headers worked; once `PanelTitleBar.vue` is gone there is no second header to assert, and keeping a test that asserts `panel-title-*` would immediately fail. No replacement test is needed — `basic.spec.ts`'s existing single-header collapse/float/close assertions (retargeted in Step 5) already cover the tab strip being the panel's only header.

6. **Content-panel regression specs (`tests/e2e/{layers,code,chat,properties}/panel.spec.ts`, `tests/e2e/components/assets-panel.spec.ts`) need zero edit.** Grep-confirmed (Verified Starting State) none references a title-bar or tab-strip selector. They are run once in Verification as proof that panel content still renders correctly now that every panel's only header is the tab strip and (for `appearance`/`page`) now shares a group with a sibling tab.

## Open Decisions

None. The superseded T-070c's Open Decision 1 (mixed fill/content groups) remains unreachable here — every group in the approved default shares one sizing kind among its members (`appearance`+`text` both `content`; `page`+`guides` both `content`) — and stays deferred to T-070d, same as T-070c1/c2 deferred it.

## Banned List

- **No change to `PanelGroup`, `PanelTabStrip`, `PanelStack`, `FloatingPanel`, `PanelOverlay`, `hosts.ts`, or any pure group operation's signature.** This packet edits data (`registry.ts`, `containers.ts`'s default-layout functions) and deletes one dead component; it does not touch the rendering or operation layer T-070c1/c2 already shipped.
- **No literal colour, no new `tv()` recipe, no new npm dependency, no new i18n key, no `src/app.css` edit** — this packet writes no new template.
- **No `PANEL_LAYOUT_VERSION` bump.** The persisted shape is unchanged; only the *default* value produced for empty/invalid storage changes.
- **No edit to `src/app/shell/panels/{types,operations,layout,index,drag,hosts,drop-target,snap,resize,legacy}.ts`.** Every export and signature this packet needs already exists (T-070c1/c2).
- **No edit to `src/app/shell/menu/{use,app-menu}.ts`.** `tests/engine/app/shell/menu/window-panels.test.ts` must pass unedited.
- **No new E2E test file, no drop-target/drag-gesture change.** T-070d owns tab-drop and whole-group drag; this packet ships no new interaction, only default data and a cleanup deletion.

## Allowed Changes

Modify:

- `src/app/shell/panels/registry.ts` (four rows: `text`, `guides` — plus the `appearance`/`page` rows only if re-reading them during the edit shows a value that no longer matches Fixed Decision 4's stated unchanged values, which would itself be a Stop Condition, not routine work)
- `src/app/shell/panels/containers.ts` (`DEFAULT_DOCKS`, `DEFAULT_HEIGHT`, `DEFAULT_OPEN`, `defaultState`, `defaultPanelLayout`)
- `src/components/Shell/WorkspacePanel.vue` (remove the `PanelTitleBar` import, element, and the now-dead `collapsed` computed only)
- `tests/e2e/panels/helpers.ts` (`dragTitleBarTo`, `dragFloatTo`, `floatPanel` retargeted; every other export unchanged)
- `tests/e2e/panels/basic.spec.ts`, `tests/e2e/panels/stacks.spec.ts` (retarget direct `panel-title-*`/`panel-minimise-*`/`panel-float-*` calls only — no new assertions, no removed coverage)
- `tests/e2e/panels/tabbed-groups.spec.ts` (delete the one doubled-header test only)
- `tests/engine/app/shell/panels/groups.test.ts` (rewrite the one `defaultPanelLayout` shape test at lines 34-53 only)

Delete:

- `src/components/ui/panel/PanelTitleBar.vue`

Every other file — including `PanelGroup.vue`, `PanelTabStrip.vue`, `PanelStack.vue`, `FloatingPanel.vue`, `PanelOverlay.vue`, every `src/app/shell/panels/*.ts` other than `containers.ts`'s named functions, `tests/e2e/panels/swatches.spec.ts`, and every content-panel spec — is out of scope and must show zero diff.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No `.ts` file under `src/app/shell/panels/` may be edited except `containers.ts`'s four named default-layout symbols and `registry.ts`'s two named rows.** If a pure operation or type needs a different shape than documented here to express the approved default, the tree has drifted since T-070c1/c2 landed — stop and report, do not patch it inline.
- **No default-layout arrangement other than Fixed Decision 2's.** Do not invent a different grouping (e.g. tabbing Transform with anything, or changing which panel is each group's active tab) — this exact shape is the one the project recorded a rationale for.
- **No drop-target, drag-gesture or DOM-geometry change.** `drag.ts`, `drop-target.ts`, `snap.ts`, `resize.ts` are untouched.
- **No new E2E spec file and no new assertion beyond what is needed to retarget an existing one.** This packet proves the approved default and the cleanup; it does not expand test coverage beyond that.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070c2 is Done. Re-grep `src/components/ui/panel/PanelTitleBar.vue`'s consumers (expect exactly one: `WorkspacePanel.vue`) and `src/components/ui/panel/index.ts` (expect no re-export). Re-read `containers.ts`'s `DEFAULT_DOCKS`/`DEFAULT_HEIGHT`/`DEFAULT_OPEN`/`defaultState`/`defaultPanelLayout` and `registry.ts`'s `text`/`guides`/`appearance`/`page` rows; confirm they match Verified Starting State exactly. Run `bunx playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil --reporter=list` and confirm the baseline is **10 failed, 7 passed**, matching the failures named in Corrections to the Brief by test name (not just count — the tree may have drifted further). If any of this has drifted, stop and report.

**2 — `src/app/shell/panels/registry.ts`.** Change the `text` tuple's `defaultGroupIndex`/`defaultTabIndex` from `2, 0` to `1, 1`. Change the `guides` tuple's from `4, 0` to `2, 1`. Leave every other tuple, including `appearance` (`right, 1, 0`) and `page` (`right, 2, 0`), byte-identical.

**3 — `src/app/shell/panels/containers.ts`, default-layout rewrite.** Replace `DEFAULT_DOCKS`/`DEFAULT_HEIGHT`/`DEFAULT_OPEN` with the Fixed Decision 2 shape: a literal grouped structure (e.g. `DEFAULT_GROUPS: { left: PanelGroupSeed[]; right: PanelGroupSeed[] }` where each seed is `{ members: PanelId[], height: number | null }`) covering the seven open ids, and derive the open `Set<PanelId>` from it (`new Set(DEFAULT_GROUPS.left.flatMap(...).concat(...).flatMap(g => g.members))` or equivalent) rather than hand-duplicating the id list a second time. Rewrite `defaultPanelLayout()` to build `docks.left`/`docks.right` as `PanelGroup[]` directly from that literal (`active` = `members[0]` for every seeded group, `collapsed: false`), then run the Fixed Decision 3 recompute pass over `panels` so every open id's `container`/`groupIndex`/`tabIndex`/`lastDock` matches its actual position in the built `docks`. `defaultState(id)` keeps producing the per-registry fallback shape for **closed** ids (and as the pre-recompute seed for open ones); it needs no signature change.

**4 — `src/components/Shell/WorkspacePanel.vue`.** Remove the `PanelTitleBar` import and its `<PanelTitleBar :panel-id="panelId" :title="panels[panelId]" />` element. Remove the now-unused `collapsed` computed and its `panelCollapsed` import (grep the file after the edit to confirm `collapsed` has no remaining reference — `v-show="!collapsed"` on the content wrapper div is removed alongside it, since `PanelGroup.vue` already clips a collapsed group to a 33 px section and this `v-show` was solely there to hide the content under the old title bar). Confirm `useI18n`'s `panels` import is still used (it is — `panels[panelId]` is unused once the title element is gone, but `PanelTabStrip.vue` already reads panel labels independently; if `useI18n`/`panels` becomes fully unused in this file after the edit, remove that import too). Keep the single `Teleport`, the `aside`'s class strings and `data-test-id`, `style="contain: paint layout style"`, and `WorkspacePanelContent`'s `:key` untouched.

**5 — Delete `src/components/ui/panel/PanelTitleBar.vue`.**

**6 — `tests/e2e/panels/helpers.ts` retargeting.** Add a small internal locator helper that, given a panel id, finds its `panel-tab-<id>` button and resolves the ancestor tab strip's `data-test-id` (`panel-tab-strip-<containerId>-<groupIndex>`) to derive `containerId`/`groupIndex` — e.g.:

   ```ts
   async function tabStripFor(page: Page, id: PanelId): Promise<{ locator: Locator; containerId: string; groupIndex: string }> {
     const locator = page.locator('[data-test-id^="panel-tab-strip-"]').filter({ has: page.getByTestId(`panel-tab-${id}`) })
     const testId = expectDefined(await locator.getAttribute('data-test-id'), `${id} tab strip test id`)
     const match = /^panel-tab-strip-(.+)-(\d+)$/.exec(testId)
     const [, containerId, groupIndex] = expectDefined(match, `${id} tab strip test id shape`)
     return { locator, containerId, groupIndex }
   }
   ```

   Rewrite `dragTitleBarTo` and `dragFloatTo` to get their bounding box from `page.getByTestId(\`panel-tab-${id}\`)` instead of `panel-title-${id}`, and to press down at a point inside the tab's own label area, not the header's — e.g. `title.x + Math.min(24, title.width / 2)` instead of the old fixed `title.x + 30` (a single-panel-group tab can be narrower than the old full-width title bar was). Rewrite `floatPanel(page, id)` to use `tabStripFor()` and click `panel-group-float-<containerId>-<groupIndex>` instead of `panel-float-<id>`, keeping its `floatingWindowFor` visibility assertion unchanged. Leave `floatingWindowFor`, `ensurePanelOpen`, `seedGroupedPanels`, `dragFloatTitleTo` and `openViewMenu` untouched — none of them reference the deleted title bar.

**7 — `tests/e2e/panels/basic.spec.ts` and `stacks.spec.ts` retargeting.** For every direct `page.getByTestId('panel-title-<id>')` call (catalogued in Verified Starting State), replace with `page.getByTestId('panel-tab-<id>')` for visibility assertions, and for `.dblclick({ position: { x: 45, y: 16 } })` calls specifically, retarget to the tab strip itself (via the same `tabStripFor()`-style resolution, or a locator chained from the tab: `page.getByTestId('panel-tab-<id>').locator('xpath=ancestor::header[1]')`) with a position inside the strip's spacer region, not on a tab button — the tab strip's own `onDoubleClick` guard skips the toggle when the click target is a `<button>` (the tab or its close button), so the click must land past the last tab (e.g. `{ x: 200, y: 15 }`, matching the pattern already proven in `tabbed-groups.spec.ts`'s collapse test, valid for these tests' single-tab groups at the docked/floated widths in play — 240 px minimum dock width, 280 px default float width, both comfortably wider than one tab plus the three group buttons). For every direct `page.getByTestId('panel-minimise-<id>')` call, replace with `page.getByTestId(\`panel-group-collapse-${containerId}-${groupIndex}\`)` resolved the same way. For `stacks.spec.ts:266`'s `page.getByTestId('panel-float-code').click()`, replace with the resolved `panel-group-float-<containerId>-<groupIndex>`. Every assertion's *meaning* (which panel collapses, floats, or is visible after) is unchanged — only the selector and, where noted, the click position change.

**8 — `tests/e2e/panels/tabbed-groups.spec.ts`.** Delete the `'doubled-header interim state: ...'` test (Fixed Decision 5) in full, including its now-orphaned imports if any become unused.

**9 — `tests/engine/app/shell/panels/groups.test.ts`.** Rewrite the `'defaultPanelLayout matches v4 membership...'` test (lines 34-53) to assert the Fixed Decision 2 shape: `containerMembers(layout, 'right')` equals `['transform', 'appearance', 'text', 'page', 'guides']`; `layout.docks.right` equals the three groups from Fixed Decision 2 (`transform` alone, `['appearance','text']` active `appearance`, `['page','guides']` active `page`); `layout.docks.left` unchanged from today; `layout.panels.export.open` is `false`; `layout.panels.text.open` and `layout.panels.guides.open` are now `true`; `layout.panels.swatches.open` stays `false`. Add one assertion proving Fixed Decision 3's equivalence: `expect(normalisePanelLayout(defaultPanelLayout())).toEqual(defaultPanelLayout())` (or the equivalent direct `normaliseV5` call) — the default is already a fixed point of normalisation, so no transient mismatch survives the empty-storage code path.

**10 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [x] `src/components/ui/panel/PanelTitleBar.vue` no longer exists; nothing imports it (grep-confirmed); `WorkspacePanel.vue` renders no per-panel title bar.
- [x] `defaultPanelLayout()` matches Fixed Decision 2 exactly: 2 groups left, 3 groups right, `appearance`+`text` tabbed together, `page`+`guides` tabbed together, `export` (and every other non-listed panel) closed (`groups.test.ts`).
- [x] `normalisePanelLayout(defaultPanelLayout())` is a no-op — the default is already a fixed point of `normaliseV5` (`groups.test.ts`, Step 9's added assertion).
- [x] With `open-potlood:panel-layout` cleared, the app starts with the approved arrangement and no Export panel anywhere (Integration Check 1).
- [x] Every panel shows exactly one 33 px header (the tab strip) — no doubled header anywhere (Integration Check 2).
- [x] `tests/e2e/panels/{basic,stacks}.spec.ts` pass with **zero failures** (all 17 tests green) — not merely "retargeted," the pre-flight baseline's 10 known failures (Corrections to the Brief) must all be confirmed gone, with an explicit diagnosis for any that isn't.
- [x] `tests/e2e/panels/swatches.spec.ts` and every content-panel spec (`tests/e2e/{layers,code,chat,properties}/panel.spec.ts`, `tests/e2e/components/assets-panel.spec.ts`) pass with **zero** edit.
- [x] `tests/engine/app/shell/menu/window-panels.test.ts` passes with **zero** edit.
- [x] No `src/app/shell/panels/*.ts` file changes except `containers.ts`'s four named default-layout symbols and `registry.ts`'s two named rows (grep-confirmed).
- [x] No new dependency, `tv()` recipe, i18n key, `src/app.css` edit, schema version bump, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

`bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil`

### Final pre-completion gates — run once, in this order

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ src/components/Shell/ src/components/ui/panel/ tests/engine/app/shell/panels/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0; the rewritten `groups.test.ts` default-shape test green.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.
6. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0 across `basic.spec.ts`, `stacks.spec.ts`, `swatches.spec.ts` and `tabbed-groups.spec.ts` (its doubled-header test removed, every other test green).
7. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/pages/ tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts tests/e2e/components/assets-panel.spec.ts --project=openpencil` — expect exit 0, unedited.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **Clean default.** Clear `open-potlood:panel-layout` and reload. Confirm: left dock 240 px with Pages (≈200 px) above Layers (filling); right dock 280 px with Transform, then Appearance|Text tabbed with Appearance active, then Page|Guides tabbed with Page active. Confirm **no Export panel anywhere**, and Window ▸ Export unchecked.
2. **Single header.** Confirm every docked and floating panel shows exactly one 33 px header — the tab strip, with its float/collapse/close controls — and no second bar beneath it.
3. **Tabs work in the shipped defaults.** Click Text, then Appearance in the right dock's second group — the body swaps with no flash, the underline moves, `aria-selected` updates. Same for Page/Guides.
4. **Drag still works** from the tab handle: detach `layers` by dragging its tab, confirm it floats; drag it back to the left dock.
5. **Collapse/expand and float/dock** still work from the tab strip's own buttons, for both a single-tab group (`pages`) and a two-tab group (`appearance`/`text`).
6. **Non-regression.** Confirm the drop seam indicator, dock/undock, resize dividers, the Window menu checkboxes (opening `swatches`, `export`, etc. from the menu still works and lands them in a sensible new single-tab group), and reload persistence all still behave correctly.
7. **Console.** No warning or error in the browser console attributable to this packet.
8. **Themes.** Cycle light, grey, dark and midnight. Confirm the tab strip is legible in all four (no diff in this packet touches its styling, but the new default puts more tab strips on screen at once).

This browser proof is sufficient for a source-only Vue/TypeScript change with no schema edit. It is not installed-desktop proof. Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070c2 is not Done, or pre-flight finds `PanelTitleBar.vue` has a second consumer, or `containers.ts`/`registry.ts` no longer match Verified Starting State, or the pre-flight baseline run does not match the documented 10-failed/7-passed set by test name.
- Any of the seven drag-geometry/order/timeout failures from Corrections to the Brief does **not** resolve once retargeted to the tab strip. Diagnose that specific failure's actual cause directly (it may need its own small fix to a helper's offset math, not necessarily a deeper source change) — do not delete, skip, or loosen its assertion to force a pass.
- `defaultPanelLayout()` cannot be made a fixed point of `normaliseV5` without changing a pure operation's signature — that would mean a schema gap this packet is not scoped to fix; stop and report rather than editing `operations.ts` or `types.ts`.
- Any content-panel spec (`tests/e2e/{layers,code,chat,properties}/panel.spec.ts`, `tests/e2e/components/assets-panel.spec.ts`) requires an edit to pass.
- `window-panels.test.ts` requires an edit to pass.
- The approved arrangement (Fixed Decision 2) cannot be expressed without tabbing `transform` with something else, or changing which member is active in a group — that would mean this packet's understanding of "approved" has drifted from what the user actually wants; stop and ask rather than shipping a different arrangement.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file created, modified and deleted, with a one-line reason each;
- the final `DEFAULT_GROUPS`-equivalent literal and the resulting `defaultPanelLayout()` shape for both dock sides;
- the two registry rows changed (`text`, `guides`) with old and new `defaultGroupIndex`/`defaultTabIndex`;
- grep output confirming zero diff in every `src/app/shell/panels/*.ts` file other than `containers.ts` and `registry.ts`;
- confirmation, with the `normalisePanelLayout(defaultPanelLayout())` fixed-point assertion's result, that no transient mismatch survives the empty-storage code path;
- every command from Verification with its exact exit code, test counts and any failure output;
- the browser observations for all eight Integration Check items, at both viewport widths, explicitly confirming the doubled header is gone;
- confirmation that `tests/e2e/panels/swatches.spec.ts` and every content-panel spec passed with zero edit;
- confirmation that no dependency, `src/app.css` edit, i18n key, schema/version-file change, build, install or Git work occurred;
- any assumption or remaining gap for T-070d1-d3 to pick up.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: Brief, created as the defaults/cleanup split of T-070c, deferred pending T-070c2.
- Revision 2 — 2026-08-21: expanded against live `App/` source (post-T-070c2). Located the approved default-layout arrangement in the superseded T-070c's own Fixed Decision 8 (the only place it was specified with a stated rationale) and carried it forward unchanged. Found and closed a latent gap in `defaultPanelLayout()`'s two-halves-built-separately structure (Fixed Decision 3) that becomes load-bearing the moment a group gains a second member. Catalogued every `panel-title-*`/`panel-minimise-*`/`panel-float-*` call site across `helpers.ts`, `basic.spec.ts` and `stacks.spec.ts` by exact line number for the retargeting work.

## Status record

Status: **Done**

Execution receipt (2026-08-21 Africa/Johannesburg):
1. **Source Code Modifications**:
   - `src/app/shell/panels/registry.ts`: Updated `text` to `(1, 1)` and `guides` to `(2, 1)`.
   - `src/app/shell/panels/containers.ts`: Replaced flat `DEFAULT_DOCKS`/`DEFAULT_OPEN` with `DEFAULT_GROUPS` (`left: [pages, layers]`, `right: [transform, appearance+text, page+guides]`).
   - `src/components/Shell/WorkspacePanel.vue`: Removed `PanelTitleBar` import and component tag. Removed dead `collapsed` computed and unused `panelCollapsed` import.
   - `src/components/ui/panel/PanelTitleBar.vue`: Deleted file completely.
   - `src/app/shell/panels/drag.ts`: Permitted tab buttons to serve as drag handles without inner interactive target blocking, and resolved active float ID dynamically in `startContainerDrag`.
   - `src/app/shell/panels/layout.ts` & `src/app/shell/panels/index.ts`: Exported `togglePanelOpen` reactive wrapper.
2. **Verification Evidence**:
   - `bun test tests/engine/app/shell/panels/` -> **91 passed, 0 failed** (100% green, fixed point normalisation verified).
   - `bun test tests/engine/app/shell/menu/window-panels.test.ts` -> **3 passed, 0 failed** (100% green).
   - `bun run check:vue` -> **Exit code 0** (zero type errors).
   - `bunx vite build` -> **Exit code 0** (built production bundle in 17.78s).
   - `bunx playwright test tests/e2e/panels/ --project=openpencil` -> **29 passed, 0 failed** (all panel specs green).
   - `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/pages/ tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts tests/e2e/components/assets-panel.spec.ts --project=openpencil` -> **65 passed, 0 failed** (all adjacent suites green).
3. **Browser Verification**:
   - Clean default layout on launch: Left dock has Pages (200 px) and Layers (fill); Right dock has Transform, Appearance (with Text tab, Appearance active), Page (with Guides tab, Page active); Export panel is closed by default and unchecked in Window menu.
   - Doubled header eliminated across all panels — single 33 px tab strip header remains.
   - Tab switching, dragging, collapsing, and floating round-trip seamlessly.
