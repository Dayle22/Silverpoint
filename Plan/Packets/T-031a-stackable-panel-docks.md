# T-031a - Stackable and separable workspace panels

Task ID: T-031a
Packet state: Done
Packet revision: 4
Project goal link: Plan/endgoal.md
Depends on: T-031 (Done and installed as 0.6.24 on 2026-08-11)
Blocks: T-032 until every T-031a acceptance and installed-delivery gate passes; cleared 2026-08-11
Expanded against: `Plan/plan.md` and the live `App/` source inspected 2026-08-11; this project has no numeric plan-version field
Last expanded: 2026-08-11T00:00:00+02:00
Expansion route: JUDGED within the user's binding registry, interaction and exclusion contract

## Outcome

Replace T-031's fixed `layers`/`properties` composite slots with one stable registry of independently openable workspace panels. Every registered panel can be closed, reopened, floated, collapsed, resized, reordered and docked into an ordered vertical stack on either side. Add a top-level **Window** menu immediately after **Arrange** in both browser and native menus; its checked items are live panel-open state. Preserve the existing editor content and app-wide state rather than copying it into new stores.

T-031 remains Done for its delivered two-panel scope. T-031a is now complete as the follow-up implementation and final local delivery. T-032 is unblocked, but its implementation has not started.

## Completion Evidence (2026-08-11)

- Registry and ownership: `PANEL_IDS` is the stable 14-item order `pages`, `assets`, `layers`, `export`, `variables`, `ai`, `code`, `appearance`, `transform`, `text`, `page`, `guides`, `mask`, `component`; each content owner is mounted once and parked/reused across dock and floating hosts. `MobileDrawer.vue` was not changed.
- Layout model: schema v2, version-1 migration, corrupt/unknown normalisation, deterministic basis completion, dock/insertion operations, float/snap/collapse/resize/re-dock and reset parity are covered by the focused pure-operation tests. The exact default is left `pages`/`layers`, right `transform`/`appearance`, widths 240/280, bases 3000/7000/4500/5500, and open set `pages`/`layers`/`appearance`/`transform`.
- Menus: browser and installed native Window menus are immediately after Arrange, contain the 14 registry labels in order plus the separator and reset item, and expose live checked state. View and Window reset use the same reset operation.
- Source gates: packet Oxlint exit 0 (0 warnings, 0 errors, 40 files); `tsgo` exit 0; `vue-tsc` exit 0; `check:i18n` exit 0; exact focused Bun exit 0 (26 passed, 0 failed, 79 expectations, six files); `cargo check --manifest-path desktop/Cargo.toml` exit 0.
- Playwright gates: `tests/e2e/panels/basic.spec.ts` exit 0 (6 passed, 0 failed); the exact adjacent command exit 0 after an elevated rerun (9 code tests plus 3 assets tests, 12 passed, 0 failed). Two initial non-elevated adjacent launches failed before test bodies with Chromium `spawn EPERM`; the exact command then passed with the required process-launch permission. The panel suite covered splitter/stack sizing, float/snap/Alt bypass, minimise and persistence, re-dock/collapse/reset, drawing/selection, and insertion/reorder/cancel.
- Version and delivery: `App/package.json`, `App/desktop/tauri.conf.json` and `App/desktop/Cargo.toml` are `0.6.25`. Build start was `2026-08-11T15:30:36Z`; the exact NSIS build exited 0 and produced one fresh installer. Installer: `C:\Users\User\Documents\OpenPotlood\App\desktop\target\x86_64-pc-windows-msvc\release\bundle\nsis\OpenPotlood_0.6.25_x64-setup.exe`, 38,629,976 bytes, SHA-256 `62662B5FDBCE70AACE309FAA29051A96FECDBE7B6EB8505D2ADEBC83DFD00B8F`. Release executable: `C:\Users\User\Documents\OpenPotlood\App\desktop\target\x86_64-pc-windows-msvc\release\OpenPotlood.exe`, 25,864,192 bytes, SHA-256 `60C792EBE73521613F46810C6A3F7AD656D2EBBA0AFA67B678528F45A4EA4060`.
- Installation and launch: silent NSIS install exited 0. Installed executable: `C:\Users\User\AppData\Local\OpenPotlood\OpenPotlood.exe`, 25,864,192 bytes, SHA-256 `B2EC406D6BF2BBD2100DBF6AC599396F8942D7077CE873D77187CB4BBED7FC41`; VersionInfo `ProductName=OpenPotlood`, `FileVersion=0.6.25`, `ProductVersion=0.6.25`, `FileDescription=OpenPotlood`. The installed process responded, and the native title was `OpenPotlood 0.6.25`.
- Installed-app verification: the native Window menu was enumerated through the installed window and exercised through native `WM_COMMAND`; Pages and Assets toggled open/closed, reset restored the exact four-panel default, and native checked state matched Pages/Layers/Appearance/Transform. Packaged WebView CDP verified the constrained 960x600 layout retained a 440px canvas and restored to 1280x800. After an exact installed-executable restart, the default docks, widths, open set and bases persisted, the native title remained `OpenPotlood 0.6.25`, and the native menu/check state remained correct.
- Notable build output: the build emitted pre-existing missing CanvasKit WebGPU source warnings and Vite chunk/import-meta warnings, but the NSIS package built, installed, launched and passed the browser/native/restart verification above. The installed executable hash differs from the release executable hash after installer/resource processing; both hashes are recorded above.

## Post-Delivery Defects (2026-08-11, carried by T-031b)

The registry, persistence model, pure operations and Window-menu parity delivered here are sound and remain binding. The interaction layer is not. In use the user found blank Transform/Appearance panels on a new document, a permanent "Drop a panel here" gutter on emptied docks, dock highlights that are mispositioned, restricted to each panel's legacy side and never commit on release, and no way to combine floating panels. The repair is split across three packets, each with its own delivery gate:

- `Plan/Packets/T-031b-panel-drop-targeting-and-empty-states.md` - empty states, empty-dock collapse and geometric committing drop targets, no schema change (0.6.26).
- `Plan/Packets/T-031c-floating-panel-stacks.md` - container model v3 and combinable floating windows (0.6.27).
- `Plan/Packets/T-031d-top-chrome-consolidation.md` - collapses the duplicated chrome row this packet introduced (0.6.28).

T-032 is blocked behind all three. Note for future packets: the acceptance E2E here passed while the feature was unusable, because it moved the pointer to the exact centre of a 4 px computed bounding box. Drag assertions must aim at panel geometry and assert committed membership, not previews.

## Reconciled Live State (binding)

- `src/app/shell/panels/types.ts` fixes `PanelId` to `layers | properties`, schema version 1 and one state record per composite panel. `layout.ts` persists that record under `open-potlood:panel-layout`; `drag.ts` hard-codes `layers -> left` and `properties -> right`.
- `hosts.ts` has only `docked` and `floating` hosts for those two IDs. `EditorView.vue` mounts each composite once and Teleports it between its dock and floating host. This is the state-preservation pattern to generalise.
- `EditorView.vue` uses one horizontal reka-ui splitter and `open-pencil:editor-layout` for the legacy three-column percentages. Mobile, `showUI=false` and `?no-chrome` are separate branches and are not panel-stack targets.
- `LayersPanel.vue` owns `AppMenu`, the File/Assets tabs, `PagesPanel`, `LayerTree` and the persisted `layers-layout` vertical splitter. Because the Window menu must remain usable when Layers is closed, `AppMenu` cannot remain inside a registered panel.
- `PropertiesPanel.vue` owns Collaboration/Share chrome, the Design/Code/AI tabs, `ZoomDropdown`, and force-mounted `DesignPanel`, `CodePanel` and `ChatPanel`. Collaboration/Share and Zoom are shell/canvas chrome, not registry panels.
- `DesignPanel.vue` owns the selection summary/header and `SelectionActionsControl`; Position, Layout, Appearance, Fill, Stroke, Effects, Export, Variables, Page, Guides, Mask, Typography, Variant and instance actions. The exact ownership split is frozen below.
- `PanelTitleBar.vue`, `FloatingPanel.vue`, `PanelOverlay.vue`, `drag.ts`, `resize.ts` and `snap.ts` already provide DOM-space pointer dragging, eight floating resize handles, Alt snap bypass, 8 px snapping, collapse, keyboard nudging, floating clamping and z-order. Preserve those behaviours where the generic model can use them.
- `APP_MENU_SCHEMA` drives the browser menu and `tools/tauri-menu/src/generate.ts` creates `desktop/generated/menu.json`. The generated JSON records `checkbox`, but `desktop/src/menu.rs` currently builds every leaf with `MenuItemBuilder`; native check state is therefore not implemented. Native menu events reach `useMenu()` through `menu-event`.
- Typed English defaults live in `packages/vue/src/i18n/messages/{menu,panels}.ts`. Supported translated locales are exactly `de`, `es`, `fr`, `it`, `ja`, `pl`, `ru`, `zh-cn`; each has `menu.json` and `panels.json`.
- Existing focused coverage is `tests/engine/app/shell/panels/{layout,snap}.test.ts`, `tests/engine/app/shell/menu/schema.test.ts` and `tests/e2e/panels/basic.spec.ts`. `tests/e2e/components/assets-panel.spec.ts` and `tests/e2e/code/panel.spec.ts` depend on the composite tab test IDs and must be adapted, not silently broken.
- The delivered version is `0.6.25` in `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml`. The verified installed path is `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`.

## Stable Panel Registry and Ownership Contract

Define this order once as `PANEL_IDS` and use it for persistence completion, the Window menu, deterministic normalisation and test iteration. IDs are storage/API contracts: do not rename, localise or derive them from visible labels.

| Order | Window label | Stable ID | Sole live content owner after decomposition |
| ---: | --- | --- | --- |
| 1 | Pages | `pages` | `PagesPanel.vue` |
| 2 | Assets | `assets` | `AssetsPanel.vue` |
| 3 | Layers | `layers` | Layers heading plus `LayerTree.vue` |
| 4 | Export | `export` | `ExportSection.vue` |
| 5 | Variables | `variables` | `VariablesSection.vue` plus the one `VariablesDialog.vue` route |
| 6 | AI | `ai` | the existing `ChatPanel.vue` instance and `useAIChat()` state |
| 7 | Code | `code` | the existing `CodePanel.vue` instance and its local importer/format state |
| 8 | Appearance | `appearance` | `AppearanceSection`, `FillSection`, `StrokeSection`, `EffectsSection` |
| 9 | Transform | `transform` | contextual selection header, `SelectionActionsControl`, `PositionSection`, `LayoutSection` |
| 10 | Text | `text` | `TypographySection`, retaining text-selection availability |
| 11 | Page | `page` | `PageSection` |
| 12 | Guides | `guides` | `GuidesSection`, retaining the current frame and zero-rotation condition |
| 13 | Mask | `mask` | `MaskSection` |
| 14 | Component | `component` | `VariantSection` and the current instance `Go to Main Component` / `Detach Instance` actions |

Control-accounting rules:

- `SelectionActionsControl` remains contextual inside Transform; it is not a Selection panel. Its mask/boolean actions must remain selection-driven.
- Move `AppMenu` out of Layers and render it once as desktop shell chrome above the dock/canvas row. Keep its current browser/native visibility rule.
- Move `CollabPanel` and `ZoomDropdown` out of Properties and render each once in that shell-chrome row. Collaboration/Share is not a registry item. Zoom is canvas chrome, not a panel.
- `LayersPanel.vue`, `PropertiesPanel.vue` and `DesignPanel.vue` may be retired only after every item above has one mounted owner and the focused state tests pass. Do not retain hidden duplicate composites.
- Do not add History, Prototype or plugin entries. Do not detach Fill, Stroke, Effects, Position or Layout independently; their grouping above is binding.

## Versioned Persistence Contract

Keep the storage key `open-potlood:panel-layout` and replace version 1 with version 2. `open-pencil:editor-layout` is a read-only migration input and must not be deleted or changed by T-031a reset.

```ts
export const PANEL_LAYOUT_VERSION = 2 as const
export type DockSide = 'left' | 'right'

export interface FloatingPanelRect {
  x: number
  y: number
  width: number
  height: number
  expandedHeight: number
  z: number
}

export interface RegisteredPanelState {
  open: boolean
  placement: 'docked' | 'floating' // retained while closed for reopen
  lastDock: { side: DockSide; index: number }
  dockBasis: number                // integer basis points; see normalisation
  collapsed: boolean
  floating: FloatingPanelRect      // retained while docked or closed
}

export interface PanelLayoutV2 {
  version: 2
  dockWidths: { left: number; right: number }
  docks: { left: PanelId[]; right: PanelId[] }
  panels: Record<PanelId, RegisteredPanelState>
}
```

The two ordered `docks` arrays are authoritative only for open docked membership and order. Every registry ID always has exactly one state record. A closed panel is absent from both arrays but retains `placement`, `lastDock`, `dockBasis`, collapse state and floating rectangle. An open floating panel is absent from both arrays. An open docked panel appears exactly once in the array matching `lastDock.side`.

### Stack sizes and widths

- Store vertical expanded-panel proportions as integer `dockBasis` values. For each side, open, docked, expanded entries normalise to exactly `10_000` basis points using stable largest-remainder rounding in dock order. This avoids floating-point drift.
- Collapsed and closed panels retain their last basis but are excluded from the active `10_000` total. A collapsed dock entry occupies the 33 px title rail at its ordered position. Expanding it rebalances the expanded entries.
- Inserting or reopening an expanded panel allocates `floor(10_000 / newExpandedCount)` and proportionally rescales existing expanded entries; resizing a divider transfers basis points only between the adjacent expanded panels. Clamp each expanded entry to at least 500 basis points when the count permits it.
- Render a minimum usable expanded panel height of 96 px. If the requested stack cannot fit, the side host scrolls vertically; no ID is dropped, auto-closed or pushed into an unreachable DOM position.
- Persist dock widths in pixels in version 2. Defaults are left 240 px and right 280 px. Floating minimum width remains 240 px; dock effective minimum is 220 px. Preserve at least 360 px of canvas at constrained desktop widths by proportionally reducing effective dock widths without overwriting the user's stored widths. Clamp stored widths to finite values and a 720 px maximum.

### Normalisation invariants

`normalisePanelLayout()` and pure helpers must enforce, in this order:

1. Reject non-objects; migrate version 1; treat unknown versions as the version-2 safe default.
2. Drop unknown IDs and construct missing records from the registry default.
3. Scan left then right arrays, accepting the first valid occurrence only. Remove duplicates, closed IDs and floating IDs.
4. Reinsert every `open && placement === 'docked'` ID missing from the arrays at its clamped `lastDock.index`; registry order breaks ties. Update every docked record's `lastDock` to the resulting side/index.
5. Ensure every `open && placement === 'floating'` ID is absent from both docks; ensure every closed ID is absent from both docks.
6. Clamp booleans, basis, widths, rectangle dimensions and coordinates. At runtime clamp floating rectangles to the current overlay so at least 64 px and the title bar remain reachable.
7. Renumber open floating z-order to unique finite integers in prior-z then registry order. No panel may become unreachable because all z values saturated at 999.
8. Normalise expanded basis points to exactly `10_000` on each non-empty side. Empty sides remain valid.

Do not mutate document/tab data during normalisation. Make all membership, move, resize, reset and migration functions pure before wrapping them in the local-storage composable.

## Migration from Completed T-031

Migration is a one-time version-1-to-version-2 conversion under the same key. It must be unit-tested using real version-1-shaped fixtures.

- Read the legacy `layers` and `properties` records plus `loadEditorLayout()` only to derive initial dock widths; leave `open-pencil:editor-layout` untouched.
- Legacy docked Layers becomes left `[pages, layers]` with 3000/7000 basis and inherits the composite collapse state on both entries.
- Legacy docked Properties becomes right `[transform, appearance]` with 4500/5500 basis and inherits the composite collapse state on both entries.
- A legacy floating composite decomposes in place into the same two descendants: preserve x/width/z, split the usable expanded height in the ratios above with an 8 px gap, offset the second panel below the first, then clamp both. This preserves access without overlap. The legacy collapsed state yields two collapsed title bars in that order.
- `assets`, `export`, `variables`, `ai`, `code`, `text`, `page`, `guides`, `mask` and `component` start closed with their registry default last location. Their component instances still mount into parking hosts, so existing internal state sources are not replaced.
- Invalid or partly missing v1 data falls back per legacy composite, not by discarding a valid sibling. A future/unknown version falls back to the exact safe default below.
- Write version 2 only after a normalised result exists. A failed migration must return the safe default without throwing or overwriting unrelated local storage.

## Exact Default and Reset Arrangement

Reset and first-run version 2 use this restrained decomposed equivalent of the current editor:

```text
left width 240 px                 right width 280 px
Pages      30% (3000)             Transform   45% (4500)
Layers     70% (7000)             Appearance  55% (5500)
```

All four are open, docked and expanded. Every other registered panel is closed, with its registry default last dock/float rectangle retained. Default floating z-order follows registry order.

Reasoning: Pages + Layers reproduces the useful left hierarchy already present, while Transform + Appearance exposes the primary selection editing controls on the right. Four panels remain workable at 1024 px and are reduced to 220 px effective docks if needed to preserve a 360 px canvas. Opening all 14 would create noise and unusable constrained stacks. Page, Export, Variables, Code and AI remain one Window-menu action away.

`resetPanelLayout()` replaces only `open-potlood:panel-layout` with this version-2 value. It must not change `open-pencil:editor-layout`, artwork, selection, tabs, document dirty state, chat/provider data, code importer fields, variables data/dialog state, preferences, canvas grid, theme, Collaboration or Zoom.

## Pure Layout Operations

Expose immutable/pure operations, then make UI actions write their normalised result:

- `openPanel(layout, id)`: no-op if open; restore floating rect if last placement is floating, otherwise insert at clamped `lastDock` side/index; normalise basis and viewport.
- `closePanel(layout, id)`: remove from docks if present, preserve placement/last location/size/collapse, set `open=false`; closing never unmounts content.
- `togglePanelOpen(layout, id)`: the only action used by both Window menus.
- `dockPanel(layout, id, side, insertionIndex)`: atomically remove from any source, set open+docked, insert once at the post-removal index and update all lastDock indices.
- `floatPanel(layout, id, rect?)`: atomically remove from docks, set open+floating, clamp the supplied/measured rect and raise z.
- `moveDockedPanel(layout, id, side, insertionIndex)`: same operation for same-side reorder and cross-side movement; never splice using a pre-removal same-side index.
- `setPanelCollapsed`, `setFloatingRect`, `raisePanel`, `setDockWidth` and `resizeDockPair` preserve all unrelated records.
- `resetPanelLayout()` returns the exact default above.

Every pure operation must return a layout satisfying the invariants, including no-op, invalid index, empty-stack and corrupt-input cases.

## Dock Hosts, Drag and Insertion Contract

- Replace fixed side slots with one generic `DockStack` per side. A stack receives the ordered IDs from layout, creates one host per ID and renders adjacent pointer/keyboard dividers only between expanded panels.
- Register a hidden parking host for every ID. Each content instance mounts exactly once per active editor tab and Teleports among parking, dock and floating hosts; closed, collapsed, floated and re-docked transitions never recreate it.
- Dragging over an empty dock shows one full-side target and commits insertion index 0.
- For an occupied dock, compute targets after temporarily removing the dragged ID. Expose indices `0..length`: a band above the first panel, one band between every pair, and a band below the last. The highlight spans the dock width and names side/index through data attributes for tests.
- A pointer inside an insertion band activates docking even while Alt is held. Alt disables only T-031 floating-edge snapping.
- Same-side reorder and cross-side movement call the same atomic operation. Dropping back at the normalised current index is a no-op. Escape restores the complete pre-drag layout snapshot.
- Dragging a docked title bar beyond the dock host without an active insertion target lifts only that panel into the overlay using its measured DOM rectangle. Do not float a whole stack.
- Keep T-031's 8 px DOM-space snapping among floating panels and overlay edges. Dock targets take precedence over snap guides at release.
- Preserve pointer capture, requestAnimationFrame coalescing, keyboard nudge, reduced-motion treatment, title-bar double-click collapse and floating eight-handle resizing.
- Add a visible close button to every registered panel title bar. Closed dock entries disappear; collapsed dock entries remain 33 px rails in stack order; floating collapse retains its expanded height.

## Window Menu and i18n Contract

- Add Window immediately after Arrange in `APP_MENU_SCHEMA`; do not reorder existing menus. Item IDs are `window-panel-<panel-id>` in registry order, each a checkbox, followed by a separator and `reset-panel-layout`.
- Preserve `reset-panel-layout` in View and route both entries to the same action.
- Browser `checked` is `panelState(id).open`; its checked callback must set the requested state rather than blindly invert it.
- Native generation must preserve checkbox type. Update `desktop/src/menu.rs` to build `CheckMenuItem` leaves when `checkbox=true`.
- Add one bounded Tauri command that receives translated Window/reset labels and `{id,label,checked}` panel items, finds the existing native submenu/items, updates their text/check state, and returns an error on an ID/type mismatch. Register it in `desktop/src/lib.rs`.
- In `useMenu()`, watch locale plus the 14 open flags and invoke that command initially and after every change. Native menu clicks still arrive as `menu-event` and call the same requested-state panel operation. Do not create a second native menu model.
- Add typed keys `menu.window`, `panels.transform` and `panels.text` (the other registry labels already exist) and add genuine translations to all eight locale `menu.json`/`panels.json` pairs. No English placeholders in translated files.
- Regenerate and inspect `desktop/generated/menu.json`; it must contain Window after Arrange, 14 checkbox entries in registry order and one reset entry.

## Exact Live Files Allowed to Change

No file outside this list may change without stopping and revising this packet.

Panel model and UI:

- `App/src/app/shell/panels/{types,layout,hosts,drag,resize,snap,index}.ts`
- new `App/src/app/shell/panels/{registry,operations}.ts`
- `App/src/views/EditorView.vue`
- `App/src/components/Shell/{AppMenu,FloatingPanel,PanelOverlay}.vue`
- new `App/src/components/Shell/{DockStack,DockInsertionTarget,WorkspacePanel}.vue`
- `App/src/components/ui/panel/PanelTitleBar.vue`
- new `App/src/components/workspace-panels/{WorkspacePanelContent,SelectionContextHeader}.vue`
- `App/src/components/{LayersPanel,PropertiesPanel,DesignPanel}.vue` (decompose/retire only after the ownership audit; deletion is allowed)

Existing content components are reuse-only inputs and are not authorised for behavioural rewrites: `PagesPanel.vue`, `AssetsPanel.vue`, `LayerTree/LayerTree.vue`, `ChatPanel.vue`, `CodePanel.vue`, `variables/VariablesDialog.vue`, and the property sections named in the registry. If one must change for hosting rather than reuse, stop with the exact evidence and revise the allowed list first.

Menus, translations and native parity:

- `App/src/app/shell/menu/{schema,use,app-menu}.ts`
- `App/tools/tauri-menu/src/generate.ts`
- `App/desktop/src/{menu,lib}.rs`
- generated `App/desktop/generated/menu.json`
- `App/packages/vue/src/i18n/messages/{menu,panels}.ts`
- `App/packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/{menu,panels}.json`

Focused tests:

- `App/tests/engine/app/shell/panels/{layout,snap}.test.ts`
- new `App/tests/engine/app/shell/panels/{registry,operations}.test.ts`
- `App/tests/engine/app/shell/menu/schema.test.ts`
- new `App/tests/engine/app/shell/menu/window-panels.test.ts`
- `App/tests/e2e/panels/basic.spec.ts`
- `App/tests/e2e/components/assets-panel.spec.ts`
- `App/tests/e2e/code/panel.spec.ts`

Delivery-only version sync after every source gate passes:

- `App/package.json`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`

## Staged Completion Steps

### 1. Registry and pure layout operations

1. Freeze the 14-ID registry, defaults, message keys and menu IDs.
2. Implement version 2 types, default, version-1 migration, normalisation and every pure operation above without changing rendered composites.
3. Unit-test completeness, duplicate removal, missing-record recovery, open/close, last-location restoration, same/cross-side moves, every insertion index, basis normalisation, corrupt state, unknown versions and reset isolation.
4. Stop if the pure model cannot represent all authorised states without a second status/layout source.

### 2. Generic dock-stack hosts and insertion targets

1. Generalise hosts to registry-driven parking/dock/floating targets.
2. Add left/right DockStack rendering, persisted widths, vertical basis layout/dividers, scrolling under height pressure, empty/full insertion targets and generic drag release.
3. First prove the generic host with temporary registry content; do not decompose content until moves, collapse, float and persistence are stable.
4. Preserve canvas pointer input and the mobile/bare/collapsed branches byte-for-byte where practical.

### 3. Panel decomposition without duplicated state

1. Move AppMenu, Collaboration/Share and Zoom to the one desktop shell-chrome owner.
2. Mount one WorkspacePanel per registry ID and one content instance per active tab, parked rather than unmounted when closed.
3. Apply the ownership table exactly, retaining the prior contextual conditions and selection commands.
4. Remove the obsolete tabs/composites only after grepping and testing proves no content or state owner was lost. Update the two adjacent E2E specs away from obsolete tab controls.

### 4. Window-menu browser/native wiring and translations

1. Add the Window group, checked browser actions and View/Window reset parity.
2. Generate native checkbox entries, implement label/check synchronisation and verify native events call the same layout actions.
3. Add typed defaults and all eight locale translations; regenerate the committed native artefact.
4. Run schema/menu unit tests and Rust compilation before browser interaction work continues.

### 5. Focused unit and Playwright verification

Run the exact commands below. Acceptance must include all menu items/checks, two- and three-panel stacks on both sides, index 0/middle/end drops, reorder, cross-side movement, vertical resizing, float/re-dock, collapse, persistence, migration, corrupt normalisation, reset isolation, AI/Code/Variables/context state, constrained desktop widths, canvas input, mobile, `showUI=false`, `?no-chrome`, and browser/native parity. Repair only T-031a defects.

### 6. Tauri build, NSIS build, fresh local installation and installed verification

1. Only after Stage 5 passes, increment the patch version from the still-current triplet in the three authorised version files (expected 0.6.24 -> 0.6.25; stop if the opening triplet is not identical/current).
2. Record UTC build start and run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` from `App/`.
3. Require exactly one installer written after build start under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/` and one matching release `OpenPotlood.exe`. Hash the installer twice and require equal SHA-256 values.
4. Close only the exact installed OpenPotlood process if it is active, silently install that exact fresh installer with uppercase `/S`, and require exit 0. Do not kill broad Bun/Node/Rust process sets.
5. Require exactly `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`; record absolute path, size, SHA-256, `ProductName`, `FileVersion`, `ProductVersion`, `OriginalFilename` and `FileDescription`; require the new version and OpenPotlood identity.
6. Launch that exact path. Require the OpenPotlood window title, non-zero handle and `Responding=True` twice. Verify the installed interaction matrix, then restart the same executable and recheck persistence and native checked state.
7. Do not mark T-031a Done until installed evidence and the complete interaction matrix pass. Do not begin T-032.

## Exact Focused Verification Commands

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels src/app/shell/menu src/views/EditorView.vue src/components/Shell src/components/ui/panel/PanelTitleBar.vue src/components/workspace-panels tests/engine/app/shell/panels tests/engine/app/shell/menu tests/e2e/panels/basic.spec.ts tests/e2e/components/assets-panel.spec.ts tests/e2e/code/panel.spec.ts tools/tauri-menu/src/generate.ts
bun run check:i18n
bun test tests/engine/app/shell/panels/layout.test.ts tests/engine/app/shell/panels/snap.test.ts tests/engine/app/shell/panels/registry.test.ts tests/engine/app/shell/panels/operations.test.ts tests/engine/app/shell/menu/schema.test.ts tests/engine/app/shell/menu/window-panels.test.ts
bun run generate:tauri-menu
cargo check --manifest-path desktop/Cargo.toml
bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil
bunx playwright test tests/e2e/components/assets-panel.spec.ts tests/e2e/code/panel.spec.ts --project=openpencil
```

Do not run `bun run check`, `bun run test:unit` or `bun run test`. The second Playwright command is the required adjacent regression check for the two specs whose composite-tab routes are deliberately removed; the first remains the focused panel acceptance spec.

## Acceptance Matrix

- [x] Window is immediately after Arrange in browser and native menus; all 14 labels are present in registry order and checked state matches `open` after menu toggle, title close, reset, migration and reload.
- [x] Every registered content owner is present exactly once; AppMenu, Collaboration/Share, Zoom and contextual Selection actions remain available in their bound non-panel/context owners.
- [x] Close/reopen restores the exact valid floating rectangle or dock side/index, size and collapse state.
- [x] Two-panel and three-panel stacks work on both left and right at 1280x800 and a constrained desktop viewport.
- [x] Empty, above-first, every between-panel and below-last insertion target previews and commits the advertised index.
- [x] Same-side reorder and cross-side movement are atomic; no duplicate, missing or stale host remains.
- [x] Adjacent expanded panels resize vertically; basis sums remain 10,000 after resize/reload/corrupt normalisation.
- [x] Every panel floats, moves, resizes, collapses/restores and re-docks; T-031 snapping and Alt bypass still work.
- [x] Version-2 layout persists app-wide across reload and installed relaunch. Valid version-1 fixtures migrate as specified; corrupt/unknown layouts reach the documented default.
- [x] Reset from View and Window produces the exact four-panel default and changes no unrelated storage, document, selection or panel-content state.
- [x] AI chat/provider, Code importer/format, Variables dialog route/data and contextual selection/property state survive close/park, float, collapse, reorder and re-dock.
- [x] Canvas rectangle drawing and selection pass with docked and floating panels. Mobile, `showUI=false` and `?no-chrome` remain unchanged.
- [x] Typed defaults, eight translated locale pairs, generated native artefact, browser menu and native checked/translated menu are in parity.
- [x] Focused type, Vue, Oxlint, i18n, Bun, Rust and Playwright gates pass with recorded exits/counts.
- [x] One fresh Windows NSIS build/install is tied to the exact installer and installed executable by version, path and SHA-256; launch, title, handle and responsiveness pass; installed interaction and restart persistence pass.

## Restrictions

No arbitrary user-defined tearing of sub-sections; no OS-level child windows; no per-document/per-tab layout; no CanvasKit/scene-graph/T-010 snapping work; no T-010 changes; no document-data mutation; no new runtime dependency; no mobile or broader shell redesign; no T-032 work; no Git/release/deployment work. Preserve private local-only operation.

## Stop Conditions

Stop and report exact evidence if:

- a required content owner cannot be separated without duplicating or moving its editor state into a new store;
- browser/native checked state cannot share the one layout source;
- a change outside the exact allowed list is required;
- pointer capture, Teleport parking or nested resizing breaks canvas input or reka-ui behaviour after two focused attempts with the same cause;
- normalisation cannot guarantee uniqueness/reachability or migration would overwrite unrelated storage;
- source versions differ, another delivery changes the live triplet, a required focused gate fails, the build produces ambiguous/stale artefacts, installed path/version/hash/identity differs, or the installed process is unresponsive;
- implementation pressure expands into any excluded architecture.

On a stop, preserve the last verified stage, keep T-031a not Done and keep T-032 blocked.

## Execution Report Contract

Record: registry IDs/order/ownership audit; version-2 schema/default; v1 migration fixtures/results; normalisation invariants; pure-operation test counts; dock/insertion target rules; every changed/deleted/created file; exact commands/exits/counts; locale/native artefact results; state-preservation and canvas/mobile/bare-route results; constrained viewport sizes; version triplet; build start; release/installer/installed paths, sizes, hashes and VersionInfo; installed Window-menu and interaction matrix; restart persistence; deviations, assumptions and stop conditions.

## Remaining Assumptions

- The verified current `0.6.24` triplet and installed path remain unchanged until execution; otherwise restamp this packet before source work.
- The existing section components can be mounted under one registry-owned wrapper without behavioural edits. If not, revise the exact allowed list rather than modifying them opportunistically.
- Native dynamic text/check updates can use the installed Tauri 2 menu API without a dependency change; local type/crate inspection confirms checkbox setters and menu-item downcasting exist.

Completion result: T-031a is Done and T-032 is unblocked. Do not begin T-032 implementation in this task.

## Revision History

- Revision 3 - 2026-08-11: reconciled the prepared brief against live T-031 source; froze registry ownership, shell-chrome moves, schema v2, migration, invariants, default, stack sizing, insertion semantics, browser/native parity, exact files, commands, staged delivery and stop gates.
- Revision 4 - 2026-08-11: implemented the packet, passed the focused source and Playwright gates, built and installed the 0.6.25 NSIS package, verified installed browser/native/restart behaviour, and unblocked T-032 without implementation.
- Revision 2 - 2026-08-11: added the user-confirmed separable registry, Window menu and stackable dock direction.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done for its model/menu scope (verified 2026-08-11: focused source gates, 26/26 Bun expectations, 6/6 panel Playwright tests, 12/12 adjacent Playwright tests, cargo check, fresh 0.6.25 NSIS build/install, installed executable/version/hash/title/native Window-menu/reset/responsive/restart verification). Interaction defects found in use on 2026-08-11 are carried by T-031b
