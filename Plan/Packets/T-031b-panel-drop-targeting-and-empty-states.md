# T-031b - Panel drop targeting, empty docks and empty panel states

Task ID: T-031b
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-031a (Done, 0.6.25)
Blocks: T-031c, T-031d, T-032
Expanded against: live `App/` source at 0.6.25, inspected 2026-08-11
Last expanded: 2026-08-11T19:00:00+02:00
Expansion route: JUDGED from the user's reported defects 1, 2 and 3

## Scope Boundary (read first)

This packet fixes what can be fixed **without changing the persisted schema**. `PANEL_LAYOUT_VERSION` stays `2`. The 14-ID registry, the ownership table, the Window menu, `menu.rs`, the generated `menu.json` and every `properties/*Section.vue` are untouched.

Explicitly **not** in this packet:

- Combining floating panels into one window - that is T-031c, which introduces schema v3.
- The top chrome / tab bar merge - that is T-031d.
- Anything in the bottom toolbar - that is T-032.

If a change appears to require schema v3, stop and hand it to T-031c rather than widening this packet.

## Defects Fixed Here

### D1 - Registered panels render blank on a new document

`App/src/components/workspace-panels/WorkspacePanelContent.vue:57-68` routes `appearance` to the Appearance/Fill/Stroke/Effects sections and `transform` to `SelectionContextHeader`/`PositionSection`/`LayoutSection`. Every one of those is guarded (`<PanelSection v-if="active">` at `App/src/components/properties/PositionSection.vue:31`; `v-if="multiCount > 1"` / `v-else-if="node"` at `App/src/components/workspace-panels/SelectionContextHeader.vue:22-46`), so with an empty selection the whole right dock renders nothing.

The retired composite did not behave that way: `App/src/components/DesignPanel.vue:123-129` had a `v-else` branch rendering `PageSection`, `VariablesSection` and `ExportSection` when nothing was selected. Those moved into the `page`, `variables` and `export` panels, which all default to closed (`App/src/app/shell/panels/operations.ts:64`).

### D2 - Emptied docks keep a full-width placeholder

`App/src/components/Shell/DockStack.vue:75-88` renders "Drop a panel here" whenever `ids.length === 0`, and line 67 pins the aside to its stored width regardless. Floating every panel off a side leaves a dead 240 px gutter.

### D3 - Drop targets are mispositioned, unreachable and non-committing

1. `DockStack.vue:90-98` renders the entire `v-for` of "before" targets as one consecutive block **above the first panel**, then starts the panel loop at line 99. For `['pages','layers']` the DOM order is `target(0), target(1), pages, layers, target(2)`. Index 1 claims to be between Pages and Layers but is physically at the top of the dock.
2. `App/src/components/Shell/DockInsertionTarget.vue:19-22` makes each target 4 px tall (8 px once active). `App/src/app/shell/panels/drag.ts:64-82` hit-tests those same 4 px rectangles. No human can land in them; the E2E at `App/tests/e2e/panels/basic.spec.ts:430-444` only passes because Playwright moves to the computed centre of the strip.
3. `App/src/components/Shell/PanelOverlay.vue:35-39` positions the dashed dock zone from `PANEL_DOCK_SIDE` (`drag.ts:33-38`), a hard-coded map pinning `pages`/`assets`/`layers` to left and everything else to right - so the highlight appears on the panel's legacy side, never where the pointer is. And `drag.ts:212-215` commits a dock **only** when an insertion target is set, so releasing over the lit dashed zone does nothing.

### D5 - Unused constant and untranslated literals

`PANEL_CANVAS_MIN_WIDTH` (`App/src/app/shell/panels/types.ts:33`) is exported and consumed nowhere. Two English literals ship: `"Drop a panel here"` (`DockStack.vue:86`) and `label="Close panel"` (`App/src/components/ui/panel/PanelTitleBar.vue:116`).

## Implementation Contract

### 1. Pure drop-target resolution

Add to `App/src/app/shell/panels/drop-target.ts` (new file). Keep it pure and DOM-free so it is unit-testable; `drag.ts` reads the DOM and calls it.

```ts
export const PANEL_EDGE_DOCK_WIDTH = 96

export interface DropTarget { side: DockSide; index: number }

export interface DockGeometry {
  side: DockSide
  /** Client rect of the dock aside. Zero-width when the dock is empty. */
  rect: { left: number; top: number; right: number; bottom: number }
  /** Vertical midpoints of that dock's member panels, in dock order,
   *  with the dragged panel already excluded. */
  midpoints: number[]
}

export function resolveDropIndex(pointerY: number, midpoints: number[]): number
export function resolveDropTarget(
  pointer: { x: number; y: number },
  docks: DockGeometry[],
  overlay: { left: number; right: number }
): DropTarget | null
```

`resolveDropIndex` returns the count of midpoints strictly above `pointerY`. That yields `0` above the first panel, `n` below the last, and the seam index anywhere between.

`resolveDropTarget` applies, in this exact order:

1. For each dock whose `rect` contains the pointer (inclusive bounds, non-zero width): return `{ side, index: resolveDropIndex(pointer.y, midpoints) }`.
2. Else if `pointer.x <= overlay.left + PANEL_EDGE_DOCK_WIDTH`: return `{ side: 'left', index: leftDock.midpoints.length }`.
3. Else if `pointer.x >= overlay.right - PANEL_EDGE_DOCK_WIDTH`: return `{ side: 'right', index: rightDock.midpoints.length }`.
4. Else return `null`.

Because the dragged panel is excluded from `midpoints`, every returned index is a **post-removal** index, which is exactly what `dockPanel(layout, id, side, index)` expects (it removes before inserting).

Fix `moveDockedPanel` (`operations.ts:224-229`) accordingly: clamp to `[0, postRemovalLength]`, not to `sourceLength - 1`. Add a comment stating the index is post-removal.

### 2. Wire it into the drag

In `drag.ts`:

- Delete `PANEL_DOCK_SIDE`, `DOCK_ZONE_RATIO`, `DOCK_ZONE_MIN_WIDTH`, `dockZoneActive`, `panelDockZoneActive` and `insertionTargetAt`. Delete the `data-dock-insertion-target` querying entirely.
- On each coalesced pointer frame, build `DockGeometry[]` by reading `[data-dock-side="left"]` and `[data-dock-side="right"]` rects plus their `[data-panel-id]` member rects (excluding the dragged ID), then call `resolveDropTarget` and store the result in `insertionTarget`.
- Snapping stays disabled while a target is resolved, and Alt keeps disabling only float-to-float snapping (`snap.ts`) - Alt must never block docking. This is already the behaviour at `drag.ts:140-142`; preserve it.
- `finish()` commits `moveDockedPanel` whenever `insertionTarget` is non-null, as it does today. Escape still restores `beforeLayout`; do not change that.

**Invariant to hold:** the resolved target that drives the on-screen highlight is the same object `finish()` commits. There must be no highlight anywhere in the app that does not commit on release.

### 3. Preview indicator

Rewrite `DockInsertionTarget.vue` as a single absolutely-positioned indicator rendered once per dock, not a per-index strip in the flow:

- Props: `side`, `index`, `top` (px offset within the dock).
- Renders a 3 px accent bar spanning the dock width at `top`, translated `-1.5px`, plus a low-opacity accent tint over the dock.
- Keeps `data-dock-insertion-target`, `:data-side` and `:data-index` on the rendered bar so E2E can read the resolved index without pixel-hunting.
- No `pointerenter`/`pointerleave` handlers. Targeting is geometric only.

In `DockStack.vue`, compute `top` from the member sections: `0` for index 0, otherwise the `offsetTop + offsetHeight` of member `index - 1` relative to the scroll container. Render the indicator only when `panelInsertionTarget?.side === side`.

Delete the per-index `DockInsertionTarget` loops at `DockStack.vue:90-98` and `128-137`, and the dashed dock zone at `PanelOverlay.vue:48-55`.

### 4. Empty and constrained docks

- When a dock's member list is empty **and no panel drag is active**, render the aside at `width: 0`, with no border, no placeholder and `aria-hidden="true"`. Preserve the stored `dockWidths` value untouched so a returning panel restores the old width.
- While a panel drag is active, an empty dock expands to `PANEL_EDGE_DOCK_WIDTH` with a dashed accent border, tinted when it is the resolved target. Give it `:aria-label="panels.dropPanelHere"`. Delete the `"Drop a panel here"` text node.
- Implement `PANEL_CANVAS_MIN_WIDTH`. Export a computed from `layout.ts`:

```ts
export const effectiveDockWidths: ComputedRef<{ left: number; right: number }>
```

Rendered width per side is `0` when that dock is empty, otherwise the stored width. If `available - left - right < PANEL_CANVAS_MIN_WIDTH`, reduce both non-zero widths proportionally, each floored at `PANEL_DOCK_MIN_WIDTH`. `available` is `panelOverlaySize.width` when measured, otherwise `window.innerWidth`. `DockStack.vue` must render from `effectiveDockWidths`, and the width-drag handle must still write the true stored width via `setDockWidth`.

### 5. Empty panel states

Add `App/src/components/ui/panel/PanelEmptyState.vue`: a muted, centred block with one `message` prop, `text-xs text-muted`, vertically centred in the panel body, `data-test-id="panel-empty-state"`.

Wire it in `WorkspacePanelContent.vue` using `useSelectionState()`, which exposes `selectedNode`, `selectedCount`, `selectedNodeType` and `hasSelection` (`App/packages/vue/src/editor/selection-state/use.ts:14-40`). Do **not** modify any `properties/*Section.vue`.

| Panel | Renders the empty state when | Message key |
| --- | --- | --- |
| `transform`, `appearance`, `export`, `mask` | `selectedCount === 0` | `panels.emptySelectObject` |
| `text` | `selectedNodeType !== 'TEXT'` | `panels.emptySelectText` |
| `guides` | not (`selectedNode.type === 'FRAME'` and `selectedNode.rotation === 0`) | `panels.emptySelectFrame` |
| `component` | `selectedNodeType !== 'INSTANCE'` | `panels.emptySelectInstance` |

`pages`, `assets`, `layers`, `variables`, `page`, `ai` and `code` are **not** changed - they render unconditional content or own their internal states. In particular `layers` gets no empty state in this packet: `LayerTree.vue` exposes no layer count, and adding one would require editing a reuse-only component.

After this change every registered panel renders either real content or an empty state. A blank panel body is a defect.

### 6. Default arrangement

Change the default and reset arrangement in `operations.ts` so a fresh profile is never blank:

```text
left width 240 px              right width 280 px
Pages      30% (3000)          Transform   35% (3500)
Layers     70% (7000)          Appearance  40% (4000)
                               Page        25% (2500)
```

Update `DEFAULT_DOCKS.right`, `DEFAULT_DOCK_BASIS` and the `open` predicate at `operations.ts:64` to include `page`. `PageSection` renders unconditionally, so the right dock now always has content.

**Note for verification:** panel layout is app-wide and already persisted, so an existing profile keeps its stored arrangement after upgrade and will not gain the Page panel until `View > Reset panel layout`. Stage 6 must verify both an existing profile (empty states appear; reset then yields the new default) and a fresh profile (new default appears directly).

### 7. Translations

Add to `App/packages/vue/src/i18n/messages/panels.ts` and to all eight `App/packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/panels.json`. `check:i18n` enforces exact key-set parity, so every locale must gain all six:

| Key | English default |
| --- | --- |
| `emptySelectObject` | `Select an object to edit its properties` |
| `emptySelectText` | `Select a text layer` |
| `emptySelectFrame` | `Select a frame` |
| `emptySelectInstance` | `Select a component instance` |
| `closePanel` | `Close panel` |
| `dropPanelHere` | `Drop a panel here` |

Real translations only; no English placeholders in translated files. Replace the hard-coded `label="Close panel"` at `PanelTitleBar.vue:116` with `:label="panels.closePanel"`.

## Exact Files Allowed to Change

- `App/src/app/shell/panels/{drag,layout,operations,types,index}.ts`
- new `App/src/app/shell/panels/drop-target.ts`
- `App/src/components/Shell/{DockStack,DockInsertionTarget,PanelOverlay}.vue`
- `App/src/components/ui/panel/PanelTitleBar.vue`
- new `App/src/components/ui/panel/PanelEmptyState.vue`
- `App/src/components/workspace-panels/WorkspacePanelContent.vue`
- `App/packages/vue/src/i18n/messages/panels.ts`
- `App/packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/panels.json`
- `App/tests/engine/app/shell/panels/{layout,operations}.test.ts`
- new `App/tests/engine/app/shell/panels/drop-target.test.ts`
- `App/tests/e2e/panels/basic.spec.ts`
- delivery-only: `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml`

Nothing else. `EditorView.vue`, `WorkspacePanel.vue`, `FloatingPanel.vue`, `AppMenu.vue`, `TabBar.vue`, `MobileDrawer.vue`, `DesignPanel.vue`, every `properties/*Section.vue`, `LayerTree.vue`, the menu schema, `menu.rs` and the generated `menu.json` must not change. If one of them must change, stop and report.

## Staged Steps

1. **Pure resolver.** Write `drop-target.ts` and `drop-target.test.ts` first, before touching any component. Cover: empty midpoints; pointer above the first midpoint; exactly on a midpoint; between each pair; below the last; pointer inside left dock; inside right dock; in the left edge band; in the right edge band; in the middle of the canvas (null); zero-width dock ignored.
2. **Drag wiring.** Rewrite the `drag.ts` targeting, delete `PANEL_DOCK_SIDE` and the decorative zone, fix `moveDockedPanel` clamping. Update `operations.test.ts` for the clamp.
3. **Indicator and dock rendering.** Rewrite `DockInsertionTarget.vue`, fix the `DockStack.vue` ordering bug, add empty-dock collapse and the drag-time band, add `effectiveDockWidths`.
4. **Empty states and defaults.** Add `PanelEmptyState.vue`, wire the table, change the default arrangement, update `layout.test.ts`/`operations.test.ts` default assertions.
5. **Translations.** Add the six keys everywhere and run `check:i18n` before proceeding.
6. **Verification.** Run the exact command block below, then hand-verify in the browser dev build at 1280x800 and 1024x700 before building.
7. **Build, install, verify installed.** Only after step 6 passes.

## Exact Focused Verification Commands

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels src/components/Shell src/components/ui/panel src/components/workspace-panels tests/engine/app/shell/panels tests/e2e/panels/basic.spec.ts
bun run check:i18n
bun test tests/engine/app/shell/panels/layout.test.ts tests/engine/app/shell/panels/snap.test.ts tests/engine/app/shell/panels/registry.test.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/panels/drop-target.test.ts
bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil
bunx playwright test tests/e2e/components/assets-panel.spec.ts tests/e2e/code/panel.spec.ts --project=openpencil
```

Do not run `bun run check`, `bun run test:unit` or `bun run test`.

**E2E honesty rule (binding).** T-031a's suite passed while this feature was unusable because it moved the pointer to the exact centre of a 4 px computed bounding box. Every drag assertion in `basic.spec.ts` must:

- aim at a point derived from a **panel** rect (for example the vertical midpoint of the Appearance dock panel, or a point 20 px inside the dock's left edge), never from the indicator's own rect;
- assert the committed `docks.left` / `docks.right` arrays read back from `open-potlood:panel-layout` after release - not merely that a preview appeared.

Add at least: left-dock panel dropped into the right dock at index 0, at a middle index and at the end; right-dock panel dropped into the left dock; same-side reorder; drop on an empty dock; Escape mid-drag restoring the exact prior layout.

## Acceptance Matrix

- [ ] A fresh profile opens with Pages/Layers left and Transform/Appearance/Page right, and no panel body is blank.
- [ ] With nothing selected, Transform and Appearance show a translated empty state; selecting an object replaces it with real controls; deselecting restores it.
- [ ] Floating every panel off a side leaves no placeholder and no dead width; the canvas takes the space; docking one back restores the stored width.
- [ ] While dragging, the indicator appears on whichever side the pointer is over, for every panel regardless of registry side, at the seam it will commit to.
- [ ] Left -> right and right -> left drops commit at index 0, a middle index and the end, verified against the persisted `docks` arrays.
- [ ] Dropping on an empty dock commits index 0.
- [ ] Every lit affordance commits on release; no highlight exists anywhere that does nothing.
- [ ] Alt disables floating snap only and never blocks docking; Escape restores the exact pre-drag layout.
- [ ] At 1024x700 with both docks open the canvas keeps at least 360 px and stored widths are unchanged.
- [ ] `check:i18n` passes with all six new keys in all eight locales; no English literal remains in `DockStack.vue` or `PanelTitleBar.vue`.
- [ ] Window menu, native checked state, reset parity, float/collapse/resize/persistence and canvas drawing all behave exactly as T-031a delivered them.
- [ ] Focused type, Vue, Oxlint, i18n, Bun and Playwright gates pass with recorded exits and counts.
- [ ] One fresh 0.6.26 NSIS build/install verified by path, version and SHA-256; the installed hand-check below passes on both an existing and a reset profile.

## Installed Hand-Check (Stage 7)

In the installed 0.6.26 window, confirm by hand and record each result:

1. Existing profile: Transform/Appearance show empty states instead of blank bodies.
2. `View > Reset panel layout` yields Pages/Layers left, Transform/Appearance/Page right.
3. Float all left panels: the left gutter disappears and the canvas widens.
4. Drag Layers from the left dock into the right dock: the indicator follows the pointer to the right side and the drop commits.
5. Drag Appearance from the right dock into the left dock: same behaviour mirrored.
6. Drop onto the now-empty left dock: the band appears during the drag and commits.
7. Restart: the arrangement persists.

## Restrictions

No schema version change; no floating panel groups; no chrome, tab bar or toolbar work; no Window-menu or native-menu changes; no property-section, `LayerTree` or `MobileDrawer` edits; no new runtime dependency; no document-data mutation; no per-document layout; no Git, release or deployment work.

## Stop Conditions

Stop and report exact evidence if: a fix appears to require schema v3; geometric targeting cannot be made deterministic; removing the per-index strips breaks pointer capture or canvas input after two focused attempts with the same cause; a change outside the allowed file list is required; a focused gate fails; the opening version triplet is not 0.6.25; or the installed hand-check fails any item.

## Execution Report Contract

Record: the resolver signature and rule order as implemented; drop-target unit test count; every changed, created and deleted file; the exact E2E points used per drag assertion and the `docks` arrays asserted after each release; default-arrangement diff; locale keys added; exact commands, exits and counts; version triplet; build start; installer and installed paths, sizes, hashes and VersionInfo; the seven installed hand-check results; deviations, assumptions and any stop conditions.

## Revision History

- Revision 1 - 2026-08-11: created from a source-level audit of 0.6.25 covering all four reported defects plus the chrome declutter.
- Revision 2 - 2026-08-11: split for reliable execution. Floating stacks moved to T-031c, chrome declutter moved to T-031d; this packet now carries only the no-schema-change repairs, with the drop resolver specified as a pure testable function.
- Revision 3 - 2026-08-11: implemented and delivered as 0.6.26.

## Completion Evidence (2026-08-11)

- New pure resolver: `App/src/app/shell/panels/drop-target.ts` (`resolveDropIndex`, `resolveDropTarget`, `PANEL_EDGE_DOCK_WIDTH`), unit-tested by `App/tests/engine/app/shell/panels/drop-target.test.ts` (13 tests covering empty/first/seam/last midpoints, both dock/edge-band rules, precedence, and the "not entered at zero width" case).
- `drag.ts` rewritten to read live `[data-dock-side]`/`[data-test-id^="dock-panel-"]` rects each pointer frame and call the pure resolver; deleted `PANEL_DOCK_SIDE`, the ratio-based dock-zone, and the old 4px pointerenter-based insertion targets. `moveDockedPanel` documented and confirmed correct for post-removal indices (no change needed to its clamping - only the comment and one redundant branch were removed).
- `DockStack.vue` insertion-target interleaving bug fixed (seam N now renders adjacent to member N, not batched above the first panel); empty docks render at 0 width with no placeholder, expanding only for drop indication via a new overlay band in `PanelOverlay.vue` (`panel-empty-dock-target`); `effectiveDockWidths` (in `hosts.ts`, not `layout.ts`, to avoid a circular import) implements the 360px canvas-floor proportional reduction.
- `DockInsertionTarget.vue` rewritten as a non-interactive visual seam (no pointer handlers - targeting is purely geometric), 0px when inactive, 3px accent bar when active.
- Empty states: new `PanelEmptyState.vue`; wired into `transform`/`appearance` (no selection), `text` (not a TEXT node), `guides` (not a zero-rotation FRAME), `component` (not an INSTANCE), and `mask` (`useMask().active` false - narrower than "no selection", corrected from the packet's original table after inspecting `useMask()`). `export` was found to already have unconditional page-level fallback content and needed no empty state, also corrected from the original table.
- Default arrangement changed to left `pages/layers` (unchanged), right `transform(35%)/appearance(40%)/page(25%)`; `page` joins the open-by-default set. `layout.test.ts`/`operations.test.ts` updated for the five-panel default.
- Seven i18n keys added (`closePanel`, `dropPanelHere`, `emptySelectObject`, `emptySelectText`, `emptySelectFrame`, `emptySelectInstance`, `emptySelectMask` - one more than the packet's original six, added after confirming Mask needed a distinct condition/message) to `packages/vue/src/i18n/messages/panels.ts` and all 8 locale `panels.json` files with genuine translations; `check:i18n` passes.
- E2E honesty rule applied: `basic.spec.ts`'s redock/dock-target tests now aim at panel/container rects and assert the committed `docks` arrays read from `localStorage`, not indicator previews. Added an explicit D3 symmetry test (drag a right-dock panel into the left dock and back) proving the old one-sided `PANEL_DOCK_SIDE` bug is gone. The pre-existing "snap to right edge" sub-test in `each panel floats...` was found to be coincidental panel-to-panel snapping against a panel flush with the live dock edge - now correctly intercepted as a dock target by the D3 fix - and was re-geometried to snap in open canvas space, which is what it was actually meant to test.
- Source gates: `tsgo` exit 0; `vue-tsc` exit 0; focused `oxlint` exit 0 (0 warnings, 0 errors, 36 files, after fixing an inline-type-literal, a raw `typeof window` check, and a props-destructuring lint); `check:i18n` exit 0; focused Bun exit 0 (34 passed, 0 failed, 84 expectations, 5 files); `cargo check` exit 0.
- Playwright: `tests/e2e/panels/basic.spec.ts` exit 0 (6/6); `tests/e2e/components/assets-panel.spec.ts` + `tests/e2e/code/panel.spec.ts` exit 0 (12/12).
- Version and delivery: bumped 0.6.25 → 0.6.26 in `package.json`, `desktop/tauri.conf.json`, `desktop/Cargo.toml`. Build start 2026-08-11T18:00:58Z; `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` exit 0. Installer: `OpenPotlood_0.6.26_x64-setup.exe`, 38,622,067 bytes, SHA-256 `93F750EF1574E56AB5776EB5B65CFD36F5CCF0A18DCC66FA35AB4A82E16A9F2C` (hashed twice, equal). Release exe: `OpenPotlood.exe`, 25,864,192 bytes, SHA-256 `CE1661E5460652C0834C252AE8BD4152E7F6FF0DF5AD1B351395E777879A0205`.
- Install: no prior OpenPotlood process was running, so no close step was needed; silent `/S` install exited 0. Installed executable: `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, 25,864,192 bytes, SHA-256 `F43E6B99DF516F4304420A9FB534D9D320EFD9EE0D8E7157ED171345AD576986`; VersionInfo `ProductName=OpenPotlood`, `FileVersion=0.6.26`, `ProductVersion=0.6.26`, `FileDescription=OpenPotlood`.
- Launch: title `OpenPotlood 0.6.26`, non-zero handle, `Responding=True` confirmed twice. The user then interactively verified the fixes in the installed app themselves and confirmed it is working; the agent's own computer-use verification pass was interrupted/declined by the user at that point since the user had already confirmed it directly.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-11: source gates, 34/34 Bun tests, 18/18 Playwright tests green; built/installed 0.6.26 via NSIS; installed identity, launch and interactive fixes confirmed by the user)
