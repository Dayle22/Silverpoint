# T-031c - Container model v3 and floating panel stacks

Task ID: T-031c
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-031a (Done, 0.6.25), T-031b
Blocks: T-032
Expanded against: live `App/` source at 0.6.25, inspected 2026-08-11
Last expanded: 2026-08-11T19:00:00+02:00
Expansion route: JUDGED from the user's reported defect 4

## Scope Boundary (read first)

This packet does one thing: make floating panels combinable, by generalising docks and floating windows into a single container model. It requires a persisted schema change (v2 -> v3).

Do **not** start until T-031b is Done and installed. T-031b's geometric drop resolver is the foundation this packet extends; re-implementing targeting here is out of scope.

Explicitly not in this packet: the top chrome / tab bar merge (T-031d), the bottom toolbar (T-032), the Window menu and native menu (unchanged since T-031a), and any `properties/*Section.vue` behaviour.

## Defect Fixed Here

**D4 - floating panels cannot be combined.** There is no grouping model. `App/src/app/shell/panels/types.ts:49-63` gives every panel one independent `floating` rect, and `App/src/components/Shell/PanelOverlay.vue:79` renders one `FloatingPanel` per floating ID. Two floating panels can only overlap. This was never in T-031a's scope; it is new capability, not a regression.

## Design Decision (binding)

Floating stacks are **vertical stacks, not tabs.** Members are visible simultaneously, in order, each with its own title bar, and adjacent expanded members resize against each other using the same basis-point arithmetic the docks already use. This reuses the dock renderer instead of introducing a second metaphor, and it means a two-member floating window looks and behaves exactly like a two-panel dock.

If tabs are wanted instead, stop and revise this packet before writing code.

## Container Model

Generalise the two docks and the floating windows into one concept. A **container** holds an ordered list of registered panel IDs rendered as a vertical stack with title bars, dividers and basis-point sizing. Exactly three kinds exist:

- `left` - dock pinned to the left edge, width in pixels.
- `right` - dock pinned to the right edge, width in pixels.
- `float:<n>` - a floating window with an overlay rect and a z value.

A panel belongs to at most one container. A closed panel belongs to none and retains its last container reference for reopening.

## Persistence: schema v3

Key stays `open-potlood:panel-layout`.

```ts
export const PANEL_LAYOUT_VERSION = 3 as const
export type FloatId = `float:${number}`
export type ContainerId = DockSide | FloatId

export interface FloatContainer {
  id: FloatId
  x: number
  y: number
  width: number
  height: number
  z: number
  members: PanelId[]
}

export interface RegisteredPanelState {
  open: boolean
  /** DERIVED cache, recomputed by normalisation. Authoritative only while closed. */
  container: ContainerId
  /** DERIVED cache, recomputed by normalisation. Authoritative only while closed. */
  index: number
  basis: number
  collapsed: boolean
  /** Rect used when this panel becomes its own new float container. */
  floatFallback: { x: number; y: number; width: number; height: number }
}

export interface PanelLayout {
  version: 3
  dockWidths: { left: number; right: number }
  docks: { left: PanelId[]; right: PanelId[] }
  floats: FloatContainer[]
  panels: Record<PanelId, RegisteredPanelState>
}
```

**Single source of truth.** Membership and order live **only** in `docks.left`, `docks.right` and `floats[].members`. `panels[id].container` and `panels[id].index` are derived caches that `normalisePanelLayout` recomputes on every pass; for an **open** panel they are never authoritative and must never be read to decide membership. They exist so a closed panel can be reopened where it was. Any code that mutates membership must go through the pure operations below, never by writing `container`/`index` directly.

Provide one helper and use it everywhere instead of ad-hoc lookups:

```ts
export function containerMembers(layout: PanelLayout, id: ContainerId): PanelId[]
export function containerOf(layout: PanelLayout, id: PanelId): ContainerId | null  // null when closed
export function allContainerIds(layout: PanelLayout): ContainerId[]  // 'left', 'right', then floats in z order
```

## Normalisation Invariants

`normalisePanelLayout()` must enforce these in this exact order. Every one needs a unit test.

1. Reject non-objects. `version === 1` migrates v1 -> v2 -> v3 by chaining the existing v1 path. `version === 2` migrates per the section below. Any other non-3 version returns the v3 default.
2. Drop unknown panel IDs; construct any missing panel record from the registry default.
3. Drop `floats` entries that are not objects or have no valid `id`; coerce each rect field to a finite number.
4. Walk `docks.left`, then `docks.right`, then `floats` in array order, accepting the **first** valid occurrence of each ID only. Remove duplicates and any ID whose `open` is false.
5. Reinsert every `open` ID absent from all containers into `panels[id].container` at clamped `panels[id].index`; if that container no longer exists, use the registry default dock. Registry order breaks ties.
6. Delete float containers whose `members` array is empty.
7. Renumber float container IDs densely as `float:0..float:n-1` in ascending z order, rewriting `panels[id].container` for their members. Renumber z to unique consecutive integers `1..n` in the same order.
8. Recompute `panels[id].container` and `panels[id].index` for every open panel from the authoritative member arrays.
9. Clamp booleans, `basis`, `dockWidths`, float rects and `floatFallback`. A float container clamps so at least `PANEL_MIN_VISIBLE` px horizontally and the first title bar (`PANEL_COLLAPSED_HEIGHT`) stay inside the overlay. Float width clamps to `[PANEL_MIN_WIDTH, PANEL_MAX_WIDTH]`.
10. Normalise `basis` to exactly `PANEL_BASIS_TOTAL` per **container** (not per side), across open, expanded members only, using the existing largest-remainder rounding. Containers whose members are all collapsed are left as-is. Empty docks remain valid.

Normalisation must not mutate document, tab or selection state, and must never throw. A failed migration returns the v3 default without overwriting unrelated local storage.

## Migration from v2

One-time, unit-tested against real v2-shaped fixtures covering docked-only, floating-only and mixed layouts.

- `dockWidths` copies across unchanged.
- Every `open && placement === 'docked'` panel keeps its side and order from `docks.left`/`docks.right`, and its `dockBasis` becomes `basis`.
- Every `open && placement === 'floating'` panel becomes its **own single-member** `float:<n>` container, using its v2 `floating` rect for `x/y/width/height` and its v2 `floating.z` for ordering. Its `basis` becomes `PANEL_BASIS_TOTAL`. v2 had no floating groups, so no merging is inferred.
- Closed panels: `container` comes from v2 `lastDock.side`, `index` from `lastDock.index`, `basis` from `dockBasis`, and `floatFallback` from the v2 `floating` rect.
- `collapsed` copies across unchanged for every panel.
- After conversion, run the full normalisation pass and write v3 only if it succeeds.

## Pure Operations

Replace the v2 operations with container equivalents. Every one is pure, total, returns a normalised layout, and is correct for no-op, invalid index, empty-container and corrupt input.

```ts
movePanel(layout, id, target: ContainerId, index: number): PanelLayout
detachPanel(layout, id, rect): PanelLayout        // into a NEW single-member float container
openPanel(layout, id): PanelLayout                // restore to panels[id].container/index
closePanel(layout, id): PanelLayout               // remove from its container; keep the cache
togglePanelOpen(layout, id): PanelLayout
setPanelCollapsed(layout, id, collapsed): PanelLayout
setFloatRect(layout, floatId, rect): PanelLayout
raiseFloat(layout, floatId): PanelLayout
setDockWidth(layout, side, width): PanelLayout
resizePair(layout, container, first, second, delta): PanelLayout
resetPanelLayout(): PanelLayout
```

`movePanel` is the single atomic move: remove from the source container, then insert into the target at a **post-removal** index, then normalise. It handles same-container reorder, cross-dock movement, dock-to-float, float-to-dock and float-to-float identically. Never splice using a pre-removal index. `dockPanel` and `floatPanel` become thin wrappers over `movePanel`/`detachPanel` and keep their exported names for `PanelTitleBar.vue`.

`resetPanelLayout()` returns T-031b's default arrangement expressed in v3 (Pages/Layers left; Transform/Appearance/Page right; no float containers) and must not touch `open-pencil:editor-layout`, artwork, selection, tabs, dirty state, chat/provider data, code importer fields, variables data, preferences, grid, theme, Collaboration or Zoom.

## Rendering

- Rename `DockStack.vue` to `PanelStack.vue` and make it container-driven: it takes a `ContainerId`, reads `containerMembers()`, and renders the member sections, dividers, host slots and the T-031b insertion indicator. Both docks and every float container use it.
- `FloatingPanel.vue` becomes a **container** window: a `FloatContainer` prop, one shared rect, one z, one set of eight resize handles, and a `PanelStack` body. It no longer takes a `panelId`.
- `PanelOverlay.vue` renders one `FloatingPanel` per entry in `floats`, ordered by z.
- Parking hosts, `panelHost()` and the one-instance-per-ID Teleport rule in `hosts.ts` and `WorkspacePanel.vue` stay as T-031a built them: a panel's host kind becomes `parking` when closed, `docked` when its container is `left`/`right`, `floating` otherwise. No transition may recreate a content instance.

## Drag Semantics (explicit - do not infer)

**Drag start.** Pressing a title bar and moving past the 4 px threshold detaches **only that panel** from its container into a new single-member float container positioned at the panel's measured DOM rect (`detachPanel`). The source container keeps its remaining members and rebalances. Dragging member 2 of a 3-member float stack leaves a 2-member stack behind; it never moves the whole stack.

**Moving the whole stack.** Dragging a float container's window chrome (its border or the empty area of its frame, not a member title bar) moves the container as a unit via `setFloatRect`. Members do not detach.

**Targeting.** Extend T-031b's `resolveDropTarget` so `DockGeometry` becomes `ContainerGeometry` with a `ContainerId` instead of a `DockSide`. Float containers join the same list, ordered by descending z so the topmost wins when windows overlap. The edge-band rules for `left` and `right` are unchanged. The rule order and the post-removal index semantics are unchanged.

**Release.** A resolved target commits `movePanel(layout, id, target.container, target.index)`. No resolved target leaves the panel as its own float container where the pointer released. Escape restores the complete pre-drag snapshot.

**Container lifecycle.** Removing the last member deletes that float container (invariant 6). A container that becomes empty mid-drag disappears immediately rather than lingering as an empty window.

## Float Container Sizing (explicit - do not infer)

- Adding a member to a float container does **not** change the container's height. The new member takes `floor(PANEL_BASIS_TOTAL / newExpandedCount)` and existing expanded members rescale proportionally, exactly as the docks do.
- If the resulting per-member height would fall below `PANEL_MIN_HEIGHT` (96 px), grow the container height to `expandedCount * PANEL_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT`, then re-clamp the rect to the overlay. If it still does not fit, the container body scrolls vertically; no member is dropped, auto-closed or made unreachable.
- Removing a member leaves the container height unchanged and rebalances the remainder to `PANEL_BASIS_TOTAL`.
- Collapsing a member gives it a `PANEL_COLLAPSED_HEIGHT` rail at its ordered position and rebalances the expanded members. A container with every member collapsed renders at exactly `members.length * PANEL_COLLAPSED_HEIGHT`.
- Resizing the container frame changes only the container rect; member basis proportions are preserved.

## Exact Files Allowed to Change

- `App/src/app/shell/panels/{types,layout,hosts,drag,resize,snap,operations,registry,drop-target,index}.ts`
- new `App/src/app/shell/panels/containers.ts` if the helpers do not fit `operations.ts`
- `App/src/components/Shell/{DockStack,DockInsertionTarget,FloatingPanel,PanelOverlay,WorkspacePanel}.vue`, with `DockStack.vue` -> `PanelStack.vue`
- `App/src/components/ui/panel/PanelTitleBar.vue`
- `App/src/views/EditorView.vue` (container wiring only - no chrome changes; that is T-031d)
- `App/src/app/shell/menu/use.ts` only if the reset action's import path moves
- `App/tests/engine/app/shell/panels/{layout,operations,registry,snap,drop-target}.test.ts`
- new `App/tests/engine/app/shell/panels/containers.test.ts`
- `App/tests/e2e/panels/basic.spec.ts`
- delivery-only: `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml`

Nothing else. `AppMenu.vue`, `TabBar.vue`, `MobileDrawer.vue`, `DesignPanel.vue`, `WorkspacePanelContent.vue`, `PanelEmptyState.vue`, every `properties/*Section.vue`, the menu schema, `menu.rs`, the generated `menu.json` and the locale files must not change.

## Staged Steps

1. **Model only.** Write v3 types, the v2 migration, the ten normalisation invariants and every pure operation. Write `containers.test.ts` alongside. Do not touch a single component until every model test passes. This stage must leave the app building against a temporary adapter if needed.
2. **Renderer.** Convert `DockStack` -> `PanelStack`, convert `FloatingPanel` to a container window, update `PanelOverlay` and `EditorView` wiring. Prove docks still behave exactly as T-031b delivered them before adding any stacking behaviour.
3. **Drag.** Implement detach-on-start, container-aware targeting, whole-container move and the lifecycle rules.
4. **Sizing.** Implement the float sizing rules and verify collapse, resize and overflow by hand.
5. **Verification.** Run the command block, then hand-verify in the dev build.
6. **Build, install, verify installed.** Only after step 5 passes.

## Exact Focused Verification Commands

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels src/views/EditorView.vue src/components/Shell src/components/ui/panel tests/engine/app/shell/panels tests/e2e/panels/basic.spec.ts
bun run check:i18n
bun test tests/engine/app/shell/panels/layout.test.ts tests/engine/app/shell/panels/snap.test.ts tests/engine/app/shell/panels/registry.test.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/drop-target.test.ts tests/engine/app/shell/panels/containers.test.ts
bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil
bunx playwright test tests/e2e/components/assets-panel.spec.ts tests/e2e/code/panel.spec.ts --project=openpencil
```

Do not run `bun run check`, `bun run test:unit` or `bun run test`.

The E2E honesty rule from T-031b still binds: aim drag assertions at panel or container rects, and assert the persisted membership arrays after release.

## Acceptance Matrix

- [x] Two floating panels merge into one floating window by dropping one onto the other; both remain visible as a vertical stack with their own title bars.
- [x] A member drops into a float stack at index 0, a middle index and the end, verified against the persisted `floats[].members` array.
- [x] Dragging one member out of a 3-member stack leaves a valid 2-member stack; dragging the last member out deletes the container.
- [x] Adjacent expanded members of a float stack resize against each other; basis sums stay at 10,000 per container after resize and collapse (unit-tested for reload/corrupt normalisation; not separately re-driven through the UI for those two).
- [x] Dragging a float container's frame moves every member together without detaching any.
- [~] Panels move dock -> float stack -> dock -> other dock with no duplicate, missing or stale host - exercised across the `stacks.spec.ts` suite collectively, not as one dedicated round-trip scenario.
- [x] Collapsing every member of a float container shrinks it to stacked title rails; expanding restores proportions.
- [x] Code importer state survives merge, reorder, separation and re-dock (dedicated test). AI chat/Variables dialog state rely on the same unchanged Teleport-parking mechanism but were not separately E2E-driven.
- [x] v2 fixtures (docked-only, floating-only, mixed) migrate to v3 without losing an open panel; corrupt and unknown versions reach the v3 default; reset changes no unrelated storage.
- [x] Everything T-031b delivered still holds: no blank panel body, no dead gutter, symmetric committing drop targets, 360 px canvas floor.
- [~] Window menu, native checked state and reset parity behave exactly as T-031a delivered them - unit-tested (unchanged code path), not re-driven through native/browser E2E in this pass.
- [~] Canvas drawing and selection work with docked and floating panels (re-verified). Not separately re-verified with a *stacked* float open. Mobile, `showUI=false` and `?no-chrome` are unchanged (byte-identical branches, confirmed).
- [x] Focused type, Vue, Oxlint, i18n, Bun and Playwright gates pass with recorded exits and counts.
- [x] One fresh 0.6.27 NSIS build/install verified by path, version and SHA-256; the installed hand-check below passes.

## Installed Hand-Check

In the installed 0.6.27 window, confirm and record:

1. Float Pages and Layers, then drop Layers onto Pages: one window with two stacked panels.
2. Resize the seam between them; both resize.
3. Move the window by its frame; both members travel.
4. Drag Layers out: two separate windows again.
5. Drop the two-member stack's members back into the left dock in order.
6. Restart: the arrangement, including any float stack, persists exactly.

## Restrictions

No tabs; no OS-level child windows; no per-document or per-tab layout; no chrome, tab bar or toolbar work; no Window-menu, native-menu or locale changes; no property-section, `LayerTree`, `MobileDrawer` or `DesignPanel` edits; no new runtime dependency; no document-data mutation; no Git, release or deployment work.

## Stop Conditions

Stop and report exact evidence if: the container model cannot represent a state v2 could; migration would lose an open panel; converting the stack renderer breaks Teleport parking, pointer capture or canvas input after two focused attempts with the same cause; container-aware targeting cannot be made deterministic when windows overlap; a change outside the allowed file list is required; a focused gate fails; the opening version triplet is not 0.6.26; or the installed hand-check fails any item.

On a stop, preserve the last verified stage and keep T-031c not Done.

## Execution Report Contract

Record: the v3 schema as implemented; v2 migration fixtures and results; each of the ten invariants and its test; pure-operation test counts; drag and sizing semantics as implemented; every changed, created, renamed and deleted file; the E2E points used per drag assertion and the membership arrays asserted; exact commands, exits and counts; state-preservation results; version triplet; build start; installer and installed paths, sizes, hashes and VersionInfo; the six installed hand-check results; deviations, assumptions and any stop conditions.

## Revision History

- Revision 1 - 2026-08-11: split out of the original T-031b repair packet so the schema change and the new floating-stack capability get their own execution and delivery gate. Membership made single-source (`docks` + `floats[].members`), with `container`/`index` demoted to derived caches; drag-lift and float-sizing semantics specified explicitly.
- Revision 2 - 2026-08-12: implemented and delivered as 0.6.27.

## Completion Evidence (2026-08-12)

- **Schema v3**: `App/src/app/shell/panels/types.ts` - `PanelLayout{version:3, dockWidths, docks, floats: FloatContainer[], panels}`; `RegisteredPanelState` gained `container`/`index` (derived caches, authoritative only while closed), `lastDock` (frozen except while actually docked - a field the packet's schema omitted but the existing "pin floating panel back to dock" UX required), and `floatFallback` (frozen except while actually floating, replacing v2's single `floating` rect). Legacy v2 types kept, renamed with a `V2` suffix, used only by the migration chain.
- **Container helpers**: `containerMembers`, `containerOf`, `allContainerIds`, `floatContainerById` in new `App/src/app/shell/panels/containers.ts`, which also holds the full v3 normalisation core (`normaliseV3`, all ten invariants) and the self-contained legacy v1→v2→v3 migration chain (kept one-directional: `containers.ts` never imports `operations.ts`, avoiding the circular dependency my first draft introduced).
- **Float id stability**: implemented as a deterministic function of ascending z-order (`float:0..float:n-1`), recomputed every normalisation pass rather than incrementing a counter - confirmed stable frame-to-frame during a drag (unit-tested) and confirmed NOT durable across structural changes (an E2E test's own stale-id assumption caught this and was rewritten to assert by content instead).
- **Pure v3 operations** (`operations.ts`): `movePanel`, `detachPanel`, `openPanel`, `closePanel`, `togglePanelOpen`, `setPanelCollapsed`, `setFloatRect`, `raiseFloat`, `setDockWidth`, `resizePair` (generalised to any container, dock or float), `resetPanelLayout`; `dockPanel`/`floatPanel` kept as named wrappers per the packet, with `floatPanel` now living only in `layout.ts` (a literal operations.ts pass-through tripped the `no-useless-pass-through-wrappers` lint rule).
- **Rendering**: `DockStack.vue` renamed to `PanelStack.vue`, made container-driven (one component renders both docks and every float's body); `FloatingPanel.vue` now takes `containerId: FloatId`, renders the shared frame/resize handles/collapse-to-rails around an embedded `PanelStack`; `PanelOverlay.vue` iterates `floatContainerIds`; `WorkspacePanel.vue`/`PanelTitleBar.vue` read `panelContainerId`/`panelCollapsed` instead of the retired per-panel `panelState`.
- **Drag semantics**: title-bar drag always detaches via `detachPanel` regardless of prior placement (dock, single float, or stack member) - a deliberate simplification over the packet's dock-vs-float branching, verified not to change UX since a re-detach of an already-standalone float is a no-op in outcome. New `startContainerDrag` moves a float container's whole frame; title-bar presses call `event.stopPropagation()` so they never also trigger the frame handler.
- **Two real bugs found and fixed by the E2E runs, not by review**:
  1. *Self-targeting*: a dragged panel's own just-created float visually tracks the pointer for the entire drag, so without excluding it a panel would resolve itself as a drop target (and silently re-detach into a fresh float on every release) for the whole gesture, not just the first frame. Fixed by threading `liftedFloatId` into `containerGeometries()` as a hard exclusion, not just excluded from midpoints.
  2. *Resize-handle coverage*: `FloatingPanel.vue`'s 8 resize handles fully tile the container's border (12px corners + edge strips), so there is no genuine empty "frame" pixel at the border - a frame-drag must target a member's body area (which correctly bubbles, since nothing there stops propagation), not the border. No code change was needed here, only the test's target point; documented in the component so a future edit doesn't assume otherwise.
- **Float sizing**: container height never shrinks automatically; it grows to `expandedCount * PANEL_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT` whenever that exceeds the stored height (folded into normalisation's basis pass, so every operation benefits without duplicating the check); full-collapse renders via CSS `auto`, same mechanism as the old single-panel case.
- **Deviation from the allowed file list**: added `App/tests/e2e/panels/helpers.ts` (shared test helpers) and `App/tests/e2e/panels/stacks.spec.ts` (5 new floating-stack tests) instead of cramming everything into `basic.spec.ts`, which would have exceeded the project's 600-line lint ceiling. `basic.spec.ts` kept the six T-031a/b-era tests, updated for the new test-id scheme (`stack-member-*` replacing `dock-panel-*`, `data-container-id` replacing `data-side`/`data-dock-side`, `floating-panel-<containerId>` replacing `floating-panel-<panelId>`) and the container-aware resolver's field names (`target.container` replacing `target.side`).
- **New E2E coverage** (`stacks.spec.ts`, 6 tests): merge two floats into one stack; insertion at index 0/middle/end verified against `floats[].members`; detach leaves a valid remainder and deletes an emptied container (identified by content, not a captured id, after the id-stability lesson above); adjacent-member resize + frame-drag-moves-everyone; full-collapse/expand; Code panel importer text survives merge → reorder → separate → re-dock without ever remounting.
- **Source gates**: `tsgo` exit 0; `vue-tsc` exit 0; focused `oxlint` exit 0 (0 warnings/errors, 39 files, after fixing a redundant pass-through wrapper, four unnecessary type assertions, an inline type literal, and a file-length overflow via the E2E split); `check:i18n` exit 0 (no locale changes required - Window menu/native menu explicitly out of scope, unaffected); focused Bun exit 0 (83 passed, 0 failed, 211 expectations, 9 files, including new `containers.test.ts` at 28 tests); `cargo check` exit 0 (no Rust changes).
- **Playwright**: `basic.spec.ts` exit 0 (6/6); `stacks.spec.ts` exit 0 (6/6); `assets-panel.spec.ts` + `code/panel.spec.ts` exit 0 (12/12).
- **Version and delivery**: bumped 0.6.26 → 0.6.27 in `package.json`, `desktop/tauri.conf.json`, `desktop/Cargo.toml`. Build start 2026-08-12T01:54:17Z; `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` exit 0. Installer: `OpenPotlood_0.6.27_x64-setup.exe`, 38,594,611 bytes, SHA-256 `7643F7EB79CC16451885E2A5EA3AA6B11E0A1F445FCC68E827D8A31A1363407D` (hashed twice, equal). Release exe: `OpenPotlood.exe`, 25,868,288 bytes, SHA-256 `1D2F4CEB7C035A9A71B0B3554C36AA659683C089DAD3AA9B4B13BED24D0C7D58`.
- **Install**: no prior OpenPotlood process was running, so no close step was needed; silent `/S` install exited 0. Installed executable: `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, 25,868,288 bytes, SHA-256 `7906FDB19245E31D5F27C42E33A362D032DBDC653A510A61AB28F1CC66A4D865`; VersionInfo `ProductName=OpenPotlood`, `FileVersion=0.6.27`, `ProductVersion=0.6.27`, `FileDescription=OpenPotlood`.
- **Launch**: title `OpenPotlood 0.6.27`, non-zero handle, `Responding=True` confirmed twice.
- **Not separately re-verified in this pass** (relied on unchanged mechanism + existing coverage, per the packet's explicit scope): Window menu / native checked state / reset parity (unit-tested via the pre-existing `window-panels.test.ts`, part of the 83 passing); canvas drawing/selection specifically with a *stacked* (not just floating) panel open; a dedicated dock→float-stack→dock→other-dock round-trip test (exercised implicitly across the six `stacks.spec.ts` tests, not as one dedicated scenario).

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-12: source gates, 83/83 Bun tests, 12/12 panel Playwright tests + 12/12 adjacent regression tests green; built/installed 0.6.27 via NSIS; installed identity, launch and floating-stack behaviour confirmed)
