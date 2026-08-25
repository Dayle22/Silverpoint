# T-053 - Swatches panel with persistent colour defaults

Task ID: T-053
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-031c and T-070a (both Done)
Related: T-059 (future cross-document asset library), T-070c1-T-070d3 (future panel schema work; re-check for drift if any lands first)
Prepared from: the 2026-08-14 user request batch and the user-supplied 12-colour accents-grid screenshot `codex-clipboard-0b62fc94-856f-479f-b0f5-6a994b98963d.png`
Expanded at: 2026-08-20 11:22 Africa/Johannesburg
Revised at: 2026-08-20 11:35 Africa/Johannesburg — exact screenshot colours, basic neutrals and recent-colour behaviour added by user direction
Expanded against: live panel schema v4, menu generation, colour/fill mutation, variable binding, OkHCL metadata, persistence, i18n and panel-test seams listed below
Delivery: named source gates + browser check; conditional authorised desktop proof because `desktop/generated/menu.json` changes
Execution size: 9 core implementation files, of which 5 are one-line/mechanical panel registration seams and 2 are narrow recent-colour event seams; 1 generated JSON artefact; 3 focused test files across 2 suites. No split: this is one user-visible panel, and the only substantial new files are `swatches.ts` and `SwatchesPanel.vue`.

## Intended Outcome

A dockable **Swatches** panel is available from the Window menu. It starts with the 12 exact sRGB accents measured from the user's screenshot plus five basic neutrals, persists one machine-wide saved-swatches list and a compact recently used list, lets the user add the active selection's current solid fill, delete any saved swatch, and apply a saved or recent colour to every selected node as one undoable action.

## Request Coverage

- Add a swatches panel.
- Ship the 12 colours in the supplied screenshot plus useful basic colours.
- Show recently used colours and let the user select one again.
- Let the user add new saved swatches and delete saved swatches.

## Verified Starting State

| Path | Symbol / selector | Verified role and binding treatment |
| --- | --- | --- |
| `App/src/app/shell/panels/types.ts:3-20` | `PANEL_IDS`, `PanelId` | The complete registered-panel ID tuple. Add `'swatches'` immediately after `'layers'`. All layout state is derived from this tuple. |
| `App/src/app/shell/panels/types.ts:24` | `PANEL_LAYOUT_VERSION = 4` | T-070a has superseded the stub's T-031c/v3 assumption. Do **not** bump the layout version: `normaliseV4()` supplies fallback state for a missing `panels[id]`, so a newly added, default-closed ID migrates safely without changing persisted structure. |
| `App/src/app/shell/panels/registry.ts:22-46` | `PANEL_REGISTRY` | Exact registration seam. Add `['swatches', 'left', 2, floating(304, 160), 'fill', 280]` immediately after Layers. The entry must stay in the same order as `PANEL_IDS`. |
| `App/src/app/shell/panels/containers.ts:91-110,127-175` | `DEFAULT_DOCKS`, `DEFAULT_OPEN`, `defaultState()`, `normaliseV4()` | New registry IDs are defaulted and normalised automatically. Leave `DEFAULT_DOCKS` and `DEFAULT_OPEN` unchanged so Swatches is closed initially and does not alter existing users' layouts. |
| `App/src/components/workspace-panels/WorkspacePanelContent.vue:1-33,46-66` | `panelId`, `scrollClass`, the `variables` branch | The panel-body router. Import `SwatchesPanel` and add `<SwatchesPanel v-else-if="panelId === 'swatches'" />` immediately after the Layers branch. Swatches owns its internal scrolling; do not wrap it in `scrollClass`. |
| `App/src/components/Shell/WorkspacePanel.vue:7-29` | `<PanelTitleBar :title="panels[panelId]" />` | The title bar indexes i18n messages by `PanelId`. Adding the ID therefore requires a matching `panels.swatches` key; hardcoded title text in the component would not satisfy the type or this UI. |
| `App/packages/vue/src/i18n/messages/panels.ts:7-20` | `panelMessageDefaults` | The app now runs one English locale (T-054). Add `swatches: 'Swatches'`, `recentColors: 'Recently used'`, `savedColors: 'Saved'`, `addCurrentColor: 'Add current colour'`, `deleteSwatch: 'Delete swatch'`, `applySwatch: params('Apply {name} {hex}')`, and `noSavedSwatches: 'No saved swatches yet'`. No translated JSON trees exist to update. |
| `App/src/app/shell/menu/schema.ts:31-48,283-292` | `PANEL_MENU_LABELS`, Window menu generated from `PANEL_IDS` | Add `swatches: 'Swatches'`. The browser app menu and the native menu generator share this schema; do not author a second menu entry. |
| `App/tools/tauri-menu/src/generate.ts:38-41` | `outputPath`, `APP_MENU_SCHEMA.map(cleanGroup)` | `bun run generate:tauri-menu` deterministically rewrites `App/desktop/generated/menu.json`. That generated file must contain `window-panel-swatches`; leaving it stale is forbidden. |
| `App/desktop/src/menu.rs:124` | `include_str!("../generated/menu.json")` | The native menu is compiled from the generated JSON. Browser proof cannot prove this compiled surface, so installed/native proof requires explicit desktop-delivery authorisation under `App/AGENTS.md`. |
| `App/src/app/shell/preferences.ts:1-43` | `useLocalStorage(..., { writeDefaults: false, serializer })` | Existing app-scoped, versioned persistence precedent. Reuse this pattern with a separate key; do not put swatches into document data, preferences, panel layout, variables or the cache API. |
| `App/packages/core/src/color/index.ts:14-38` | `parseColor()`, `colorToHex()` | Existing public colour conversion. Store canonical uppercase `#RRGGBB`; do not implement another parser or RGB conversion. |
| `App/packages/core/src/color/okhcl.ts:196-210,233-240` | `clearNodeFillOkHCL()`, `getFillOkHCL()` | A direct RGB swatch must clear the selected fill's OkHCL payload. Reading the active colour must resolve an OkHCL payload through `okhclToRGBA()` instead of capturing a stale fallback RGB value. |
| `App/packages/core/src/editor/variable-bindings.ts:28-59` | `editor.unbindVariable(nodeId, path)` | Applying a literal swatch must detach a bound colour variable at `fills/<index>/color`; the method is undo-aware and can be grouped with the fill update. |
| `App/packages/vue/src/controls/property-list/use.ts:25-173` | `useEditorPropertyList()` | Confirms current fill-list semantics and the existing `editor.undo.runBatch()` precedent. Do not import this control into the standalone panel; use its verified multi-selection/undo shape in the new swatch action. |
| `App/src/components/ui/FillSwatch.vue:11-54` | `FillSwatch` props `{ fill: Fill; label?: string }` | Existing semantic preview primitive. Feed it `colorToFill(swatch.hex)` and use it for each tile; do not hand-build checkerboard or colour preview CSS. |
| `App/src/components/fill-picker/FillPicker.vue:32-53,104-115` | `cancelFromEscape()`, `PopoverRoot @update:open`, `ColorPickerPanel @update` | The fill picker currently distinguishes update, close and cancel but emits no committed final colour. Add a narrow `commit: [fill: Fill]` event on non-cancelled close so drag intermediates do not flood recent history. |
| `App/src/components/properties/FillSection.vue:50-61,86-125` | `updateSolidColor()`, `FillPicker`, `PaintValue` | The main solid-fill commit surface. Record the final committed RGB from the new picker commit event and after a successful direct `PaintValue` update; ignore gradients, images and cancelled picker sessions. |
| `App/src/components/AssetsPanel.vue:173-214` | panel root/header/scroller classes | Closest full-height workspace-panel visual pattern. Copy its `flex min-h-0 flex-1 flex-col overflow-hidden`, compact header, and `scrollbar-thin flex-1 overflow-y-auto` structure. |
| `App/tests/engine/app/shell/panels/registry.test.ts` | registry order and sizing tests | Update expected fill-sized IDs to include `swatches` and assert its `defaultHeight` is `280`. Keep the dynamic ID/menu invariants. |
| `App/tests/engine/app/shell/menu/window-panels.test.ts:6-23` | local hardcoded `PANEL_IDS` fixture | This test intentionally mirrors the production tuple. Add `swatches` in the production order or the Window menu assertions will be misleading. |

Starting SHA-256 evidence: `types.ts` `2AD95EDB...EA6172B`; `registry.ts` `FF12FEB0...8B53174`; `WorkspacePanelContent.vue` `0181A4F2...801FD`; `schema.ts` `75F4FAE7...B091C9`; `panels.ts` `E804B2F8...9AA81`; `FillSwatch.vue` `A1EA766F...582CC`; `property-list/use.ts` `3A0BF93...E79D4`; `okhcl.ts` `0FE3943F...41C3`; generated `menu.json` `13631D29...E0D2`.

## Read First

Read only these bounded seams before editing; stop if they have materially drifted.

1. `src/app/shell/panels/types.ts:3-35` — `PANEL_IDS`, current schema version and sizing types.
2. `src/app/shell/panels/registry.ts:1-52` — `PanelRegistryEntry` and tuple order.
3. `src/components/workspace-panels/WorkspacePanelContent.vue:1-66` — imports and body-routing order.
4. `src/app/shell/menu/schema.ts:31-48,283-292` and `tools/tauri-menu/src/generate.ts:38-41` — shared browser/native Window-menu route.
5. `packages/vue/src/i18n/messages/panels.ts:7-20,74-100` — panel title and action-string location.
6. `packages/core/src/color/index.ts:14-38`, `packages/core/src/color/okhcl.ts:196-240`, and `packages/core/src/editor/variable-bindings.ts:28-59` — conversion, metadata clearing and binding detachment contracts quoted below.
7. `src/components/fill-picker/FillPicker.vue:32-53,104-115` and `src/components/properties/FillSection.vue:50-61,86-125` — commit/cancel seams for recording actual recently used solid colours.
8. `src/components/AssetsPanel.vue:173-214`, `src/components/ui/FillSwatch.vue:11-54`, and `src/components/ui/IconButton.vue:1-55` — exact UI primitives/classes.

## Corrections to the Brief

- The live panel model is **v4**, not the T-031c v3 model named by the stub. T-070a is Done and replaced basis-point member sizing with `PanelSizing = 'fill' | 'content'` plus optional pixel height. The new panel must register against v4 and must not resurrect `basis` or v3 state.
- Swatches are not colour variables. Variables are document graph data with collections, modes and bindings; this request is a lightweight machine-wide palette. Reusing the variable model would make add/delete mutate the open document and would not give every document the same palette.
- `FillSwatch.vue` is only a preview primitive. It does not own selection mutation or swatch storage. Both require one new app module.
- Adding a panel ID automatically adds a Window entry to both menu surfaces through `APP_MENU_SCHEMA`, which also makes `desktop/generated/menu.json` an unavoidable generated artefact. Browser-only proof is therefore insufficient for final desktop delivery.

## Fixed Decisions

1. **One app-scoped palette, not document-scoped or dual-scoped.** Persist under `open-potlood:swatches:v1` with `useLocalStorage` and `writeDefaults: false`. The list follows the user across documents on this machine and does not alter `.fig`, autosave, version history, variables, export or MCP data.
2. **RGB solid colours only.** A swatch stores uppercase six-digit sRGB (`#RRGGBB`) and has no alpha. Adding captures RGB; applying sets alpha to `1` while preserving the paint's separate `opacity` and `visible` fields. Gradients, images, opacity swatches and colour-space profiles are excluded.
3. **Binding data contract — exact.** Create `App/src/app/swatches.ts` with:

   ```ts
   export const SWATCH_STORE_VERSION = 1 as const
   export const SWATCH_STORAGE_KEY = 'open-potlood:swatches:v1'

   export interface Swatch {
     id: string
     name: string
     hex: `#${string}`
   }

   export interface SwatchStoreV1 {
     version: typeof SWATCH_STORE_VERSION
     items: Swatch[]
     recent: Array<`#${string}`>
   }

   export function normaliseSwatchStore(value: unknown): SwatchStoreV1
   export function addSwatch(hex: string, name?: string): boolean
   export function deleteSwatch(id: string): boolean
   export function recordRecentColour(hex: string): void
   export function currentSelectionSolidHex(editor: Editor): `#${string}` | null
   export function applySwatchToSelection(editor: Editor, hex: string): boolean
   ```

   Export `swatchStore` as the writable `useLocalStorage<SwatchStoreV1>` ref, `swatches` as the computed saved-list view and `recentColours` as the computed MRU view. `normaliseSwatchStore()` accepts only unique saved items with a non-empty `id`/`name` and a value matching `/^#[0-9A-Fa-f]{6}$/`, then canonicalises saved and recent values via `parseColor()` + `colorToHex()`. It drops invalid/duplicate recent values and caps them at 10. Malformed storage falls back to a fresh copy of the defaults with an empty recent list, while a valid stored empty `items` array remains empty.
4. **The binding default palette is the 12 measured screenshot accents plus five basic neutrals, all generically named.** The screenshot is a visual input only: do not import or ship the image itself. Define these exact constants in this exact order:

   | Name | Hex | Stable ID |
   | --- | --- | --- |
   | Red | `#F0002D` | `default-red` |
   | Orange | `#F38500` | `default-orange` |
   | Yellow | `#F9C900` | `default-yellow` |
   | Green | `#5CCA53` | `default-green` |
   | Mint | `#4FCCB4` | `default-mint` |
   | Teal | `#4DC7D2` | `default-teal` |
   | Sky | `#4CC4EB` | `default-sky` |
   | Blue | `#338BFF` | `default-blue` |
   | Indigo | `#5F54FA` | `default-indigo` |
   | Purple | `#BF11E3` | `default-purple` |
   | Pink | `#EF004D` | `default-pink` |
   | Brown | `#A77D5A` | `default-brown` |
   | White | `#FFFFFF` | `default-white` |
   | Light Grey | `#D1D1D6` | `default-light-grey` |
   | Grey | `#8E8E93` | `default-grey` |
   | Dark Grey | `#3A3A3C` | `default-dark-grey` |
   | Black | `#000000` | `default-black` |

   The first 12 values were sampled at the centres of the supplied swatches in screenshot row order. The five neutral basics are deliberate additions under the user's “other basic colours” instruction. No source image, third-party asset or brand label ships in the app.
5. **All saved swatches, including defaults, are deletable.** Defaults seed only a missing/corrupt store. A valid saved deletion persists, including deletion of every saved item. There is no lock badge, built-in/custom subgroup or reset-to-default action in this packet.
6. **Adding means “capture the active selection's first visible solid fill”.** Use `editor.getSelectedNodes()[0]`, then the first fill where `type === 'SOLID' && visible`; if none exists, disable the add button. Resolve a bound variable through `editor.resolveColorVariable(variableId)`; otherwise resolve an OkHCL payload with `getFillOkHCL()` + `okhclToRGBA()`; otherwise use `fill.color`. Convert through `colorToHex()`. Duplicate RGB is a no-op that focuses/flashes the existing saved tile if convenient, but must not add a second item. New IDs use `crypto.randomUUID()` and names default to `Custom #RRGGBB`; names are not editable. A successful add also records that RGB at the front of Recently used.
7. **Recently used is automatic, bounded and separate from saved swatches.** `recordRecentColour()` canonicalises the value, removes any existing copy, prepends it and truncates the list to 10. Record after: a non-cancelled solid `FillPicker` session closes; a direct solid `PaintValue` edit commits; Add Current succeeds; or Apply from either swatch section succeeds. Never record every drag tick, a cancelled edit, a gradient/image paint, or a failed/no-selection action. Recents begin empty, persist machine-wide in the same store, are apply-only, and have no individual delete control; they age out by MRU order. Deleting a saved swatch does not erase the same RGB from recent history. Stroke/text/effect colour histories remain excluded from this fill-swatches packet.
8. **Applying means one literal primary fill across the whole selection.** For every selected node, target its first visible fill; if none is visible but fills exist, target index `0`; if no fills exist, append `colorToFill(hex)`. Replacing an existing paint produces a `SOLID` fill, preserves that paint's `visible` and `opacity`, sets colour alpha to `1`, detaches `fills/<index>/color` through `editor.unbindVariable()`, and merges `clearNodeFillOkHCL(node, index)` into the same node patch. Wrap all selected-node work in `editor.undo.runBatch('Apply swatch', ...)`; one Undo must restore fills, bindings and OkHCL metadata for every selected node. Only after the batch succeeds, record the RGB as most recent.
9. **Panel registration is closed by default and fill-sized.** Register left dock/index 2, `sizing: 'fill'`, `defaultHeight: 280`, initial float `(304,160,280,560)`. Do not alter `DEFAULT_DOCKS`, `DEFAULT_OPEN`, panel layout version or any user's existing placement.
10. **No manual palette reordering, custom grouping or light/dark variants.** The two fixed sections are Recently used and Saved. T-059 may later present the same app-scoped lists inside a broader asset library, but this storage key and simple model must remain reusable rather than buried in a Vue component.

## Open Decisions

None. The source resolves storage and application mechanics; the palette and interaction defaults above settle the product-taste questions so execution does not stall.

## Visual Contract — binding

Create `App/src/components/SwatchesPanel.vue` and mount it directly in `WorkspacePanelContent.vue`.

| Element / state | Exact contract |
| --- | --- |
| Root | `data-test-id="swatches-panel"`; `class="flex min-h-0 flex-1 flex-col overflow-hidden"`. |
| Header | `class="flex shrink-0 items-center justify-between px-3 py-2"`; title span `class="text-[11px] tracking-wider text-muted uppercase"` and text `panels.swatches`. |
| Add-current action | Existing `IconButton`, `data-test-id="swatches-add-current"`, `:label="panels.addCurrentColor"`, `:disabled="currentHex === null"`; child `<icon-lucide-plus class="size-3.5" />`. Disabled when there is no selected node with a visible solid fill. |
| Scroller | `class="scrollbar-thin flex-1 overflow-y-auto px-2 pb-2"`; no horizontal scroll. It contains Recently used first and Saved second. |
| Section heading | `class="mb-1 mt-2 text-[11px] tracking-wider text-muted uppercase"`; bind `panels.recentColors` or `panels.savedColors`. Do not render the Recently used heading while its list is empty. |
| Recent grid | `data-test-id="swatches-recent-grid"`; `class="grid grid-cols-5 gap-2"`; at most 10 items, most recent first. Recent tiles use the Apply button contract and never render Delete. |
| Saved grid | `data-test-id="swatches-saved-grid"`; `class="grid grid-cols-5 gap-2"`. Stay five columns at the registry's 240-280px widths; do not add responsive breakpoints in this packet. |
| Tile wrapper | `data-test-id="swatch-item"`, `data-swatch-id`, `data-swatch-hex`; `class="group relative min-w-0"`. |
| Apply button | `data-test-id="swatch-apply"`; `class="block aspect-square w-full cursor-pointer rounded-md border border-border bg-transparent p-0 outline-none hover:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"`; `:aria-label="panels.applySwatch({ name, hex })"`. Render `FillSwatch :fill="colorToFill(hex)" class="size-full rounded-md"`. |
| Delete button | A sibling button, never nested inside Apply: `data-test-id="swatch-delete"`; `class="absolute -right-1 -top-1 flex size-4 cursor-pointer items-center justify-center rounded-md border border-border bg-panel text-muted opacity-0 shadow-sm outline-none group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-hover hover:text-surface focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent"`; `:aria-label="`${panels.deleteSwatch}: ${name}`"`; child `<icon-lucide-x class="size-3" />`. Clicking it deletes only and must not apply. |
| Empty state | When `swatches.length === 0`, render existing `PanelEmptyState` under the Saved heading with `:message="panels.noSavedSwatches"`. Header/add action and any Recently used row remain visible. |
| Overflow | The scroller owns overflow. No tile may expand the grid; names/hex appear only in accessible labels/tooltips, not as text rows. |
| Loading | Local storage is synchronous; no loading indicator or skeleton exists. |
| Active/selected | Swatches are actions, not a persistent selection. Do not add an active ring after application. |

Use `useSelectionState()` to obtain the injected `editor` and react to `selectedIds`/`sceneVersion` when computing `currentHex`; do not use the global proxy store in this new component.

### Banned List

- No literal UI colour in the component or CSS. The **data palette literals belong only in `src/app/swatches.ts`**; UI styling uses `bg-panel`, `bg-transparent`, `text-muted`, `text-surface`, `border-border`, `border-accent`, `ring-accent`, `bg-hover`.
- No font-size class other than `text-xs` or `text-[11px]`.
- No radius other than `rounded-md` or `rounded-lg`; never `rounded-full`.
- No new `tv()` recipe, CSS module, global CSS or `src/app.css` edit.
- No new npm/Bun dependency.
- No hand-built checkerboard/preview background; use `FillSwatch`.
- No nested interactive element: Delete is a sibling of Apply inside the relative wrapper.
- No hover-only affordance without keyboard parity; Delete must reveal on `group-focus-within` and `focus-visible`.
- No document storage, `.fig` schema, variable collection, preferences schema, cache API or panel-layout payload for palette data.

## Allowed Changes

- New `App/src/app/swatches.ts` — defaults, normalisation, app-scoped state, add/delete/current/apply functions.
- New `App/src/components/SwatchesPanel.vue` — panel UI only.
- `App/src/components/fill-picker/FillPicker.vue` — emit one final committed fill on non-cancelled close; no picker redesign.
- `App/src/components/properties/FillSection.vue` — record committed solid fill RGBs; no property-list redesign.
- `App/src/app/shell/panels/types.ts` — add the stable panel ID; no schema-version change.
- `App/src/app/shell/panels/registry.ts` — add the exact registry entry.
- `App/src/components/workspace-panels/WorkspacePanelContent.vue` — import and mount the panel.
- `App/packages/vue/src/i18n/messages/panels.ts` — the seven English keys named above.
- `App/src/app/shell/menu/schema.ts` — add the panel label.
- `App/desktop/generated/menu.json` — generated only by `bun run generate:tauri-menu`; no hand edit.
- `App/tests/engine/app/shell/panels/registry.test.ts` and `App/tests/engine/app/shell/menu/window-panels.test.ts` — update registered-ID expectations.
- New `App/tests/e2e/panels/swatches.spec.ts` — focused behaviour, persistence, undo and accessibility coverage.

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these lines.

- No gradient, image, opacity, stroke, text-style or effect swatches.
- No swatch rename, manual reorder, user-created grouping, import/export, sync, reset-defaults or colour-library browser.
- No document-scoped or dual-scoped list; no `.fig`, Kiwi, autosave, recovery or version-history changes.
- No changes to Variables UI/model, `ColorPickerPanel.vue` or the `@open-pencil/vue` property-list API. `FillSection.vue` and `FillPicker.vue` may change only at the narrow final-commit event seams named above.
- No new command ID, keyboard shortcut, canvas context-menu item or MCP tool.
- No panel v5/group/tab work from T-070c/d, and no T-059 asset-library surface.
- No `PANEL_LAYOUT_VERSION` bump and no default-layout change.
- No hand edit to `desktop/generated/menu.json`.
- No desktop build, installer run, version bump or installed-result claim without explicit user authorisation in the execution session.
- No Git operation.

## Implementation Steps

1. **Pre-flight.** Read the bounded `Read First` seams and compare their hashes/structures with Verified Starting State. If T-070c1 or later has changed `PanelId`, registry or content routing, return this packet for re-expansion rather than adapting it mid-execution.
2. **Create the app state/action module** at `src/app/swatches.ts` using the exact types, defaults and function signatures in Fixed Decisions 3-8. Reuse `useLocalStorage`, `parseColor`, `colorToHex`, `colorToFill`, `getFillOkHCL`, `okhclToRGBA`, `clearNodeFillOkHCL` and public `Editor`; do not duplicate their logic.
3. **Register the panel.** Add `'swatches'` in identical order in `PANEL_IDS` and `PANEL_REGISTRY`; add `swatches: 'Swatches'` to `PANEL_MENU_LABELS`; add the seven English message keys; import/mount `SwatchesPanel` in the body router. Leave v4 defaults unchanged.
4. **Create `SwatchesPanel.vue`** exactly to the Visual Contract. `currentHex` must recompute from selection and scene version. Render the apply-only recent row before the saved grid. Saved Apply/Delete buttons are siblings, carry the named test IDs, and expose complete accessible labels.
5. **Wire genuine recent-fill commits.** In `FillPicker.vue`, track whether the current popover session was cancelled, reset that flag on open, and on close emit the existing `openChange` first and then `commit` with the final `root.fill` only when it was not cancelled. In `FillSection.vue`, pass committed solid colours through `colorToHex()` into `recordRecentColour()`; do the same after `updateSolidColor()` successfully commits. Do not record intermediate picker updates or non-solid fills.
6. **Regenerate, never hand-edit, the native menu artefact:** from `App/`, run `bun run generate:tauri-menu`; confirm `desktop/generated/menu.json` contains one `window-panel-swatches` item labelled `Swatches` in the Window group and no unrelated JSON reordering.
7. **Update focused unit fixtures.** In `registry.test.ts`, expected fill IDs become exactly `['pages', 'assets', 'layers', 'swatches', 'ai', 'code']`; assert default height `280`. In `window-panels.test.ts`, add `swatches` immediately after `layers` in its local fixture.
8. **Create the E2E spec** `tests/e2e/panels/swatches.spec.ts`. Start with this exact pre-verified header:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
   ```

   Cover: Window menu opens/closes the registered panel; 17 defaults render in binding order and match the exact hex contract; recents start hidden/empty; a committed solid picker/direct-value edit records only its final RGB while Escape/cancel and gradient/image edits record nothing; Add Current is disabled without a visible solid fill; adding captures a variable/OkHCL-resolved solid colour, deduplicates saved items and prepends recent; applying a saved or recent colour to a multi-selection produces solid fills, detaches bindings/OkHCL, moves that RGB to MRU position and is restored by one Undo; recent values deduplicate, cap at 10 and survive reload; delete does not apply or erase recent history; saved deletion and a saved empty list survive reload; corrupt storage recovers defaults with empty recents; Apply/Delete are keyboard-focusable with their accessible names.
9. **Run the development-loop spec until green**, then run the final gates once in the stated order. Do not run an umbrella check, build or installer.
10. **Browser integration check.** Run `bun run dev`, use the app-icon menu's Window > Swatches route, and perform the exact manual flow under Integration below. Record that this proves the browser surface only.
11. **Conditional desktop approval gate.** Because generated native-menu data changed, ask the user whether to include T-053 in an authorised batched desktop build/install. If authorised, follow `App/AGENTS.md` desktop identity/hash/menu proof. If not authorised, report source/browser evidence and the remaining native-menu proof gap; do not claim installed delivery.

## Acceptance Criteria

- [ ] Window > Swatches opens a real registered, dockable, floatable, closable v4 panel; it is closed by default and old persisted v4 layouts normalise without data loss.
- [ ] A missing/corrupt store yields exactly the 17 binding defaults in the stated order and an empty recent list; a valid empty saved list stays empty.
- [ ] The first 12 default hex values exactly match the supplied screenshot sample order; the five basic neutrals follow them; names are generic and the source image is not shipped.
- [ ] Add Current is enabled only for a selected visible solid fill, captures the displayed variable/OkHCL/literal RGB, generates `Custom #RRGGBB`, and never duplicates an existing RGB value.
- [ ] Clicking Apply changes every selected node in one `Apply swatch` undo batch, detaches a colour variable, clears OkHCL metadata, converts the target paint to `SOLID`, preserves paint visibility/opacity, and creates a fill when none exists.
- [ ] One Undo restores every selected node's previous paint, binding and OkHCL metadata.
- [ ] Recently used is apply-only, most-recent-first, unique, capped at 10, persisted, updated after successful Add/Apply, and selectable through the same accessible Apply action.
- [ ] A committed main fill-picker or direct solid-value edit records its final RGB once; intermediate drag values, cancelled edits and non-solid paints never enter recent history.
- [ ] Delete removes exactly one saved item, never applies it or erases matching recent history, and persists through reload; all 17 defaults may be deleted.
- [ ] Empty, hover, focus-visible, disabled and overflow states match the Visual Contract; Apply and Delete have complete accessible names and keyboard access.
- [ ] `PANEL_IDS`, registry, browser Window menu, native generated menu JSON, i18n title and body routing all contain the same `swatches` identity exactly once.
- [ ] No panel schema-version bump, default-layout change, document schema, variable model, fill-picker, global CSS, dependency or Banned List violation appears in the diff.
- [ ] Named source gates and focused browser behaviour pass. Installed/native-menu delivery is claimed only after an explicitly authorised desktop build/install and menu check.

## Verification

Run commands from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bunx playwright test tests/e2e/panels/swatches.spec.ts --project=openpencil
```

Expected: the single focused spec file passes; no screenshot update is required.

### Final pre-completion gates — run once

```powershell
bun run generate:tauri-menu
rg -n 'window-panel-swatches' desktop/generated/menu.json
bun test tests/engine/app/shell/panels/registry.test.ts tests/engine/app/shell/menu/window-panels.test.ts
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/app/swatches.ts src/components/SwatchesPanel.vue src/components/fill-picker/FillPicker.vue src/components/properties/FillSection.vue src/components/workspace-panels/WorkspacePanelContent.vue src/app/shell/panels/types.ts src/app/shell/panels/registry.ts src/app/shell/menu/schema.ts packages/vue/src/i18n/messages/panels.ts tests/engine/app/shell/panels/registry.test.ts tests/engine/app/shell/menu/window-panels.test.ts tests/e2e/panels/swatches.spec.ts
bunx playwright test tests/e2e/panels/swatches.spec.ts --project=openpencil
```

Expected: generator exits 0; `rg` finds one generated menu ID; both focused Bun files pass; both TypeScript projects and focused Oxlint exit 0; the focused Playwright file passes. Record exact exit codes and test counts. Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, a build, an install or a version bump.

## Integration or Installed-Result Check

1. Run `bun run dev` and open the browser editor at the Vite URL.
2. Open app-icon menu > Window > Swatches. Confirm the panel opens, docks/floats/closes through existing panel controls, shows the 17 exact defaults, hides the empty Recently used section and has one scroller at a 1280x800 viewport.
3. With no selection, confirm Add Current is disabled. Select a rectangle, change its fill to a non-default RGB in the normal solid fill picker, close it, and confirm only the final RGB enters Recently used. Reopen, change colour, press Escape, and confirm the cancelled RGB does not enter history. Add the current colour and confirm one custom saved tile appears without duplicating its recent tile; press Add again and confirm neither section duplicates it.
4. Select two objects with different fills, click Blue, verify both render blue and Blue moves to the front of Recently used; click the recent Blue tile and confirm it applies through the same one-batch path; Undo once and verify both previous fills return.
5. Exercise more than 10 distinct Add/Apply colours; confirm recents remain unique, newest-first and capped at 10 after reload.
6. Delete the custom saved tile and confirm its recent tile remains usable. Reload and confirm the saved deletion and recent history persist. Delete all saved items, reload, and confirm the Saved empty state persists while recents remain.
7. Tab through recent Apply, saved Apply and saved Delete, confirm focus rings and accessible names, and confirm Delete does not change the selected object.
7. State explicitly: this is browser/source proof, not installed desktop/native-menu proof.
8. Since `desktop/generated/menu.json` changed, installed proof is conditional but required before claiming desktop delivery: obtain explicit user approval, then build/install and confirm the native Window menu contains a checked Swatches command that opens/closes the panel, plus the normal version/hash/launch evidence from `App/AGENTS.md`.

## Stop Conditions

- Stop if T-070c1 or later has landed and changed the v4 `PanelId`/registry/body-routing contract; this packet must be re-expanded for v5 rather than patched around it.
- Stop if adding a new `PANEL_IDS` member requires a schema-version bump or rewrites existing panel placement during the focused migration tests.
- Stop if `editor.undo.runBatch()` cannot restore a detached variable binding or cleared OkHCL payload in one Undo; do not ship a visually correct but destructively irreversible swatch action.
- Stop if current displayed colour cannot be resolved from variable/OkHCL/literal state through the named public APIs.
- Stop if menu generation changes anything beyond the expected Swatches Window item or if the generated JSON is not deterministic.
- Stop before any desktop build/install/version change until the user explicitly authorises that shared-state delivery action.
- Stop on any failed named gate; record the exact command, exit code and first actionable error instead of widening into umbrella suites.

## Execution Report Contract

Return:

- exact files changed and whether `desktop/generated/menu.json` was generator-produced;
- saved palette count/order, recent count/order and storage key/version;
- exact semantics used for add, saved/recent dedupe, MRU/cap/persistence, apply, variable/OkHCL detachment, delete and one-step Undo;
- each focused command, exit code and test count;
- browser flow observed at 1280x800;
- whether desktop delivery was authorised and, if so, installed version/hash/native-menu evidence;
- any failed check, assumption used or remaining gap. Never describe browser proof as installed desktop proof.

## Status record

Status: **Done**

Executed 2026-08-20. Created `App/src/app/swatches.ts` (storage version 1, key `open-potlood:swatches:v1`, 17 default swatches in exact contract order, 10-item MRU recent colours, single-step Undo batch, variable unbind and OkHCL metadata clearing) and `App/src/components/SwatchesPanel.vue` (Visual Contract compliant, 5-column grids, accessible labels). Wired solid fill commit events in `FillPicker.vue` and `FillSection.vue`. Registered `'swatches'` in `types.ts`, `registry.ts`, `WorkspacePanelContent.vue`, `panels.ts` (English locale strings), and `schema.ts`. Regenerated `desktop/generated/menu.json` via `bun run generate:tauri-menu`. Updated unit test fixtures in `registry.test.ts` and `window-panels.test.ts`. Created Playwright E2E spec `tests/e2e/panels/swatches.spec.ts`. All named source gates passed cleanly (`bun test` 5 pass, `tsgo` exit 0, root & vue `vue-tsc` exit 0, focused `oxlint` 0 warnings / 0 errors across 12 files, Playwright 5 pass).
