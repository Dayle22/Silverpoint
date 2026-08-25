# T-059 - Cross-document asset library

Task ID: T-059
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-053 (swatches panel — precedent for a machine-wide, app-scoped local store), T-058 (local version history — precedent for the `App/src/app/cache` persistence pattern, not yet executed but its packet's findings are reused below)
Prepared from: 2026-08-14 user request batch 3 (original stub); re-expanded 2026-08-20 against live source
Expanded at: 2026-08-20 16:10 Africa/Johannesburg
Expanded against: `App/src/components/AssetsPanel.vue` (full file, 409 lines); `App/packages/scene-graph/src/types.ts:478-484`; `App/packages/scene-graph/src/node-defaults.ts:211-215`; `App/packages/kiwi/src/fig/schema/fig.kiwi:2162-2168`; `App/packages/core/src/kiwi/fig/node-change/convert.ts:697,732,868`; `App/packages/core/src/kiwi/fig/node-change/export-node.ts:346,509`; `App/tests/engine/kiwi/serialize-fixes/component-metadata.test.ts`; `App/tests/engine/io/fig/heavy/component-metadata.test.ts`; `App/packages/vue/src/editor/commands/selection.ts:70-125`; `App/src/app/cache/index.ts` (full file); `App/src/app/document/recent/index.ts` and `recovery/index.ts` (full files); `App/packages/core/src/editor/clipboard.ts` (full file); `App/packages/core/src/clipboard/openpencil.ts` (full file); `App/packages/core/src/clipboard.ts:386-394`; `App/packages/core/src/editor/clipboard/copy.ts`, `placement.ts`, `paste-target.ts`; `App/packages/scene-graph/src/copy.ts`; `App/packages/core/src/editor/bridges/clipboard.ts`; `App/packages/core/package.json` exports map; `App/src/app/editor/active-store/index.ts`; `App/src/app/editor/session/create.ts:68`; `App/packages/core/src/editor/viewport.ts:27-31`; `App/src/app/editor/profiler/index.ts:13-30`; `App/src/components/ui/SegmentedControl.vue`, `App/src/theme/segmented-control.ts`, `App/src/components/Toolbar/CapabilitySwitcher.vue`; `App/src/components/SwatchesPanel.vue` (Done, T-053 precedent); `App/src/app/editor/icons.ts`; `App/packages/vue/src/i18n/messages/panels.ts` (full file); `App/tests/engine/app/cache.test.ts`; `App/tests/e2e/components/assets-panel.spec.ts` (full file, 309 lines); `App/tests/e2e/fixtures.ts`; `App/package.json` scripts; `Plan/Packets/T-053-swatches-panel.md` and `Plan/Packets/T-058-local-version-history.md` (both read in full as precedent).
Delivery: named source gates + browser check
Execution size: 3 core implementation files (new `src/app/library/index.ts`; edited `src/components/AssetsPanel.vue`; edited `packages/vue/src/i18n/messages/panels.ts`), 2 test files across 2 suites (`tests/engine/app/library.test.ts` new; `tests/e2e/components/assets-panel.spec.ts` extended). No split required — this is one user-visible panel change, one storage module, and it reuses existing primitives end to end rather than inventing new serialization, node-graph fields, or a second panel.

## Intended Outcome

The Assets panel gains a second source. A `This document | Local library` switch at the top of the panel selects which list is shown. "This document" is the existing current-document COMPONENT/COMPONENT_SET list, now with a Publish action per row. "Local library" lists components published from any document on this machine, persisted outside any single document, with Insert and Delete actions per row. Inserting a library asset creates an independent copy in the current document (no live link back to the library and no dependency recorded on the node) using the exact paste pipeline already used for copy/paste. Publishing does not touch `.fig` round-trip fidelity, the component/variant model, or any scene-graph type.

## Request Coverage

Verbatim from the stub:

- Make components and other reusable assets available across every document, not just the one they were authored in.
- Give the machine a persistent personal library rather than per-file duplication.

## Verified Starting State

| Path | Symbol / line span | Verified role |
| --- | --- | --- |
| `App/src/components/AssetsPanel.vue` | `LocalAsset` type (24-35), `assets` computed (62-90), `filteredAssets` (92-96), `insertAsset`/`insertionPoint` (142-163), row template (188-261), details dialog (272-406) | Full current file, read in full. Filters `editor.graph.nodes` to top-level `COMPONENT`/`COMPONENT_SET` (excludes a `COMPONENT` whose parent is a `COMPONENT_SET`, i.e. a variant child). Already renders variants, descriptions, doc links, a live PNG preview via `editor.renderExportImage`, and an `asset-library-badge` driven by `node.sourceLibraryKey`. This is the single file the two-source UI change lands in. |
| `App/packages/scene-graph/src/types.ts:478-484` | `sourceLibraryKey: string | null` on `SceneNode` | Confirmed present, alongside `componentKey`, `publishId`, `overrideKey`, `sharedSymbolVersion`. |
| `App/packages/scene-graph/src/node-defaults.ts:211-215` | default `sourceLibraryKey: null` | Confirmed default. |
| `App/packages/kiwi/src/fig/schema/fig.kiwi:2164` | `string sourceLibraryKey = 395;` on Figma's real `NodeChange` message | **`sourceLibraryKey` is a genuine Figma wire field (number 395), not an unused hook.** This settles the stub's stop-condition question definitively — see Corrections to the Brief. |
| `App/packages/core/src/kiwi/fig/node-change/convert.ts:732` and `App/packages/core/src/kiwi/fig/node-change/export-node.ts:509` | import: `sourceLibraryKey: stringOrNull(nc.sourceLibraryKey)`; export: `if (node.sourceLibraryKey) nc.sourceLibraryKey = node.sourceLibraryKey` | Both directions of the `.fig` round trip are live and exercised. |
| `App/tests/engine/io/fig/heavy/component-metadata.test.ts:29` | `expect(component.sourceLibraryKey).toStartWith('lk-')` against the real `gold-preview.fig` fixture | A genuine Figma export carries a real `lk-…` value on this field today. Repurposing it for a local library would corrupt that document's round trip. |
| `App/packages/core/src/clipboard.ts:388-393` | `export { buildOpenPencilClipboardHTML, parseOpenPencilClipboard, type OpenPencilClipboardData, type TextPictureBuilder } from './clipboard/openpencil'` | Public subpath export `@open-pencil/core/clipboard` (confirmed in `App/packages/core/package.json:133-137`). Already imported directly from `src/app/*` elsewhere in this codebase (e.g. `@open-pencil/core/color`, `/io`, `/canvas`), so importing `@open-pencil/core/clipboard` from a new `src/app/library` module follows an established, live pattern. |
| `App/packages/core/src/clipboard/openpencil.ts` | `buildOpenPencilClipboardHTML(nodes: SceneNode[], graph: SceneGraph, textPictureBuilder?)`, `parseOpenPencilClipboard(html: string)` | Full file read. Produces `<!--(openpencil)<base64(deflate(JSON))>(/openpencil)-->` — a **string**, not raw bytes. This is the exact serialization already used by system copy/paste (`App/packages/core/src/editor/clipboard/copy.ts:11`, no `textPictureBuilder` passed there either — matches what this packet needs). |
| `App/packages/core/src/editor/clipboard.ts:87-128,232-243` | `pasteFromHTML(html, cursorPos?, options?)`, returned from `createClipboardActions` | Parses `openpencil/v1` first; on match, calls internal `pasteOpenPencilNodes(nodes, images, cursorPos, options)`, which recursively `ctx.graph.createNode(source.type, parentId, {...structuredClone(rest), x, y, childIds: []})`, computes layout, sets selection and pushes one `Paste`-labelled undo entry. **If `cursorPos` is omitted, `centerNodesAt` is never called** (clipboard.ts:168) — the pasted nodes land at their stored `x+20`/`y+20`, not centred in the viewport. A caller must pass an explicit `cursorPos`. |
| `App/packages/core/src/editor/clipboard/placement.ts:8-18` | `centerNodesAt(nodeIds, cx, cy)` | Operates on `ctx.graph.getNode(id).x/.y` directly against the supplied `cx`/`cy` — i.e. `cursorPos` must be in the same coordinate space as the paste target's node coordinates (page-absolute in the common case, matching `screenToCanvas`'s output). |
| `App/packages/core/src/editor/bridges/clipboard.ts:7-21` | `pasteFromHTML: clipboard.pasteFromHTML` | Exposed on the composed store. Confirmed live call sites at App level: `src/app/editor/clipboard/system.ts:38`, `src/app/editor/mobile-clipboard/index.ts:19`, `src/app/shell/keyboard/clipboard.ts:59` — all call `store.pasteFromHTML(html, cursorPos, options?)`. |
| `App/src/app/editor/active-store/index.ts:1-19` | `useEditorStore(): EditorStore` | `AssetsPanel.vue` already calls `editor.renderExportImage`, `editor.viewportCanvasCenter`, `editor.screenToCanvas`, `editor.graph.getNode`, `editor.requestRender()` through this same accessor. |
| `App/src/app/editor/session/create.ts:68` | `export type EditorStore = ReturnType<typeof createEditorStore>` | The concrete store type to import for the new module's function signatures. |
| `App/src/app/document/export/files.ts:116-142` | `renderExportImage(nodeIds, scale, format)` | App-level, **not** part of the narrower `@open-pencil/core/editor` `Editor` type (confirmed no match under `packages/core/src`). Same for `viewportCanvasCenter` (`App/src/app/editor/profiler/index.ts:13-30`, also App-level). This is why the new module types its editor parameter as `EditorStore` (App-level), not the narrower `Editor` T-053's `swatches.ts` used. |
| `App/src/app/cache/index.ts` | `readCacheText`/`writeCacheText`/`readCacheJson`/`writeCacheJson`/`removeCacheEntry`/`readCacheBytes`/`writeCacheBytes` | Full file read. **`readCacheText`/`writeCacheText` fall back to `window.localStorage` outside Tauri (lines 25-53). `readCacheBytes`/`writeCacheBytes` do not — they return `null`/no-op outside Tauri (lines 70-88).** Because the library payload is the `buildOpenPencilClipboardHTML` string (not raw bytes), this packet can use the text functions only, which work in both the plain `bun run dev` browser and the installed Tauri app — unlike T-058's history feature, which needs `writeCacheBytes` for a raw `.fig` copy and is therefore Tauri-only. |
| `App/src/app/document/recent/index.ts`, `App/src/app/document/recovery/index.ts` | manifest-as-JSON-array + per-entry keyed payload pattern | Full files read; this is the established shape to copy: a JSON array manifest under one cache key, per-entry bytes/text under `<feature>/<id>.<ext>` keys, delete-then-rewrite-manifest on removal. |
| `App/src/app/editor/icons.ts:48-77` | `nodeIcon(node: { type: string; layoutMode: string })`, `NODE_ICONS.COMPONENT`/`COMPONENT_SET` | Only needs `{ type, layoutMode }`, not a live `SceneNode` — callable with a synthetic `{ type: entry.nodeType, layoutMode: 'NONE' }` for library rows that have no live node. |
| `App/packages/vue/src/editor/commands/selection.ts:83-125` | `selection.createComponent`, `createComponentSet`, `createInstance`, `detachInstance`, `goToMainComponent` | All five are live, each with an `enabled` capability and a `run()` calling the corresponding `editor.*` method (`createComponentFromSelection`, `createComponentSetFromComponents`, `createInstanceFromComponent`, `detachInstance`, `goToMainComponent`). None of them need to change for this packet — publish/insert are new App-level actions, not new command IDs, matching how `AssetsPanel.vue` already calls `editor.createInstanceFromComponent` directly rather than through a command. |
| `App/src/components/ui/SegmentedControl.vue`, `App/src/theme/segmented-control.ts`, `App/src/components/Toolbar/CapabilitySwitcher.vue` | `SegmentedControlOption`, `#option` slot, `panelFieldBase`-based theme | A reusable two-option switch primitive already exists and is already used for exactly this kind of "which source" toggle (`Simple \| Full`). This is the binding source for the new document/library switch — no new component needed. |
| `App/tests/e2e/components/assets-panel.spec.ts` | `ensureAssetsOpen(page, canvas)` (8-46), full existing spec (309 lines) | **Assets is closed by default** (`DEFAULT_OPEN` in `App/src/app/shell/panels/containers.ts:123` does not include `'assets'`). This live spec already has the `@ts-nocheck` header and a working panel-open helper; new coverage must extend this file, not create a new one — see Corrections to the Brief. |
| `App/tests/engine/app/cache.test.ts` | `installLocalStorage()` helper | The exact mocking pattern for a Bun unit test of the new library module — no Tauri needed since only the text cache functions are used. |

## Read First

1. `App/src/components/AssetsPanel.vue` — the whole file (409 lines); this packet edits most of its regions.
2. `App/src/app/cache/index.ts` — the whole file; confirms the text/bytes split above.
3. `App/packages/core/src/clipboard/openpencil.ts` and `App/packages/core/src/editor/clipboard.ts:87-128` — the exact payload shape and `pasteFromHTML` behaviour, including the "no `cursorPos` = no centring" trap.
4. `App/src/components/ui/SegmentedControl.vue` and `App/src/components/Toolbar/CapabilitySwitcher.vue` — the switch primitive and its live usage.
5. `App/tests/e2e/components/assets-panel.spec.ts` — the existing spec and `ensureAssetsOpen` helper this packet extends.

## Corrections to the Brief

- **`sourceLibraryKey` is Figma-meaningful and must not be reused or repurposed.** It is field 395 of Figma's real `NodeChange` Kiwi message (`fig.kiwi:2164`), read on import (`convert.ts:732`) and written on export (`export-node.ts:509`), and a real `.fig` fixture (`gold-preview.fig`) carries a genuine `lk-…` value on it today (`heavy/component-metadata.test.ts:29`). This closes the stub's stop condition: **do not touch this field.** This packet stores no provenance on the node at all — see Fixed Decision 1.
- **The stub's "directory of `.fig` files, or one library document?" storage question is answered by neither option.** The library reuses the existing `App/src/app/cache` module (already the precedent T-058 pointed at) and the existing `openpencil/v1` clipboard serialization (already the precedent for copy/paste). No new file format, no `.fig`/Kiwi encode/decode path, and — because that serialization is a string, not bytes — **no Tauri-only restriction**, unlike T-058's history feature.
- **The stub's copy-vs-link question is resolved as copy-on-insert**, per the stub's own recommendation, by reusing `editor.pasteFromHTML()` verbatim rather than writing new node-cloning code.
- **The stub's "what else belongs in the library" question is out of scope here** by design: `COMPONENT`/`COMPONENT_SET` only, matching the stub's own "scoping to components first is probably right" and matching `AssetsPanel.vue`'s own existing filter exactly.
- **The stub's "document opened without the library" stop condition is closed by construction, not by a runtime check.** Because insertion produces a full independent copy with zero back-reference (no node field, no stored library id on the node, nothing written to the document at all), a document containing an inserted library asset is self-contained. It opens identically with or without the library present, on any machine — there is nothing to resolve.
- **The stub's proposed test/UI path (a new `tests/e2e/panels/*.spec.ts` file, matching T-053's newest convention) is corrected.** `App/tests/e2e/components/assets-panel.spec.ts` already exists, already covers `AssetsPanel.vue`, already carries the `@ts-nocheck` header, and already has a working `ensureAssetsOpen()` panel-open helper (Assets is closed by default). New coverage extends that file instead of creating a parallel one.

## Fixed Decisions

1. **No node-graph field, no `sourceLibraryKey` reuse, no scene-graph/Kiwi changes anywhere.** Provenance is not tracked. Publishing reads a node; inserting writes new nodes with fresh ids via the existing paste pipeline. This is the only design that cannot corrupt `.fig` fidelity by construction.
2. **Storage is one manifest JSON array plus one payload text entry per asset, under `App/src/app/cache`, mirroring `recent/index.ts`/`recovery/index.ts`.** Manifest key `library/manifest.json` (via `readCacheJson`/`writeCacheJson`). Each entry's serialized node tree is stored as **text** (via `readCacheText`/`writeCacheText`) under `library/payload_<id>.txt`, and an optional thumbnail as a base64 PNG data-URL **text** under `library/thumb_<id>.txt`. No `writeCacheBytes` anywhere in this packet, so the feature works in both the plain browser dev server and the installed Tauri app.
3. **Serialization reuses `buildOpenPencilClipboardHTML`/`pasteFromHTML` exactly as they exist.** Publish calls `buildOpenPencilClipboardHTML([node], editor.graph)` (no `textPictureBuilder`, matching the existing system-copy call site) and stores the returned string verbatim. Insert reads that string back and passes it unmodified to `editor.pasteFromHTML(payload, cursorPos)`. No new node-tree-walking or cloning code is written.
4. **Insert always passes an explicit `cursorPos`** computed the same way `AssetsPanel.vue`'s existing `insertionPoint()` computes it for local assets: `editor.screenToCanvas(...Object.values(editor.viewportCanvasCenter()))`. This avoids the "lands off-screen" trap in `pasteOpenPencilNodes` documented above.
5. **A thumbnail is captured at publish time, not at insert time**, using the exact scale calculation `AssetsPanel.vue` already uses for its local preview (`Math.min(176 / Math.max(width, height, 1), 2)`) via `editor.renderExportImage([nodeId], scale, 'PNG')`, because the source node is only guaranteed to be live in the graph at publish time. Failure to render a thumbnail (returns `null`/empty, or throws) is non-fatal: the entry publishes with `thumbnailKey: null` and the details dialog falls back to the type icon, exactly like local assets do while `previewLoading` is true.
6. **Scope is top-level `COMPONENT`/`COMPONENT_SET` only, matching `AssetsPanel.vue`'s own existing filter.** `publishAssetToLibrary` re-applies that exact guard (node type check, plus "a `COMPONENT` whose parent is a `COMPONENT_SET` is not publishable") defensively, independent of the fact that the UI only ever calls it from rows already filtered that way.
7. **No de-duplication, versioning, or "already published" tracking.** Every publish creates a new library entry, even for the same source node. This matches the simplicity precedent set by T-053 (every `Add Current` creates a new saved swatch entry unless the exact RGB already exists — here there is no cheap equality check for a whole subtree, so no dedupe is attempted at all).
8. **UI is a two-option switch inside the existing `AssetsPanel.vue`, not a new panel.** Reuses `App/src/components/ui/SegmentedControl.vue` exactly as `CapabilitySwitcher.vue` uses it. No new `PANEL_IDS` entry, no `registry.ts` change, no Window-menu change, no `desktop/generated/menu.json` regeneration — unlike T-053, this packet never touches the native menu surface, so there is no conditional desktop-approval gate.
9. **Delete is direct, no confirmation dialog**, matching both `PagesPanel.vue`'s page delete and `SwatchesPanel.vue`'s swatch delete — the only two existing delete affordances in this app, both direct.
10. **All cache writes in the new module are wrapped in `try`/`catch` with `console.warn` on failure**, matching `recovery/index.ts`'s and `recent/index.ts`'s existing error-swallowing convention. A failed publish returns `null`; a failed insert (missing entry, unreadable payload) returns `false`. Neither throws into the UI.
11. **The library tab is labelled "Local library"**, not "Library", to avoid colliding in wording with the existing `panels.assetLibraryBadge` ("Library") badge shown on a document asset whose `sourceLibraryKey` is set by Figma — a different, untouched concept.

## Open Decisions

None. Every question the stub raised is closed above by a Fixed Decision backed by source evidence; none required a product-taste call that source could not settle.

## Visual Contract — binding

All classes below are copied from live components in this exact file or from `SwatchesPanel.vue`/`CapabilitySwitcher.vue`, the closest matching real components.

| Element | Exact contract |
| --- | --- |
| Source switch | Insert directly below the existing header (`AssetsPanel.vue:174-176`), above the search input. `<SegmentedControl v-model="sourceModel" :options="sourceOptions" :label="panels.assets" data-test-id="assets-source-switch" class="w-full">` with default (unstyled) `ui`/`size="sm"` — do not pass a custom `ui` override; this is an in-panel control, not a floating toolbar like `CapabilitySwitcher.vue`. Bind to the `sourceModel` writable computed (Implementation Step 3), not `activeSource` directly — see the type-safety note there. |
| Switch option content | `#option="{ option }"` slot: `<span :data-test-id="`assets-tab-${option.value}`" class="truncate">{{ option.label }}</span>` |
| Document-tab Publish button | Existing row (`AssetsPanel.vue:188-261`). Insert a new `<Tip :label="panels.publishToLibrary">` block immediately **before** the existing `<Tip :label="commands.createInstance">` (Insert) block, i.e. row order becomes Docs → Publish → Insert. Same `insertButton.base` class, same `@pointerdown.stop`/`@click.stop` pattern, `data-test-id="asset-publish"`, icon `<icon-lucide-folder-plus class="size-3" />`. |
| Library row | New `<button>` block, same container classes as the existing local row: `class="group/asset flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-surface hover:bg-hover"`, `data-test-id="library-asset-item"`, `:data-asset-id="asset.id"`. |
| Library row icon | `<component :is="nodeIcon({ type: asset.nodeType, layoutMode: 'NONE' })" class="size-3.5 shrink-0 text-component" aria-hidden="true" />` |
| Library row name | `<span data-test-id="library-asset-name" class="truncate">{{ asset.name }}</span>` inside the same `min-w-0 flex-1` wrapper shape as the local row. |
| Library row variant count | `v-if="asset.variantCount > 0"`, `data-test-id="library-asset-variant-summary"`, `class="mt-0.5 block truncate text-[10px] text-muted"`, text `{{ panels.libraryVariantCount({ count: asset.variantCount }) }}` (new key — do not reuse `assetVariantSummary`, which requires a `names` string this data does not have). |
| Library row description | Same as local: `v-if="asset.description"`, `data-test-id="library-asset-description"`, `class="mt-0.5 block truncate text-[10px] text-muted"`. |
| Library row Delete button | `insertButton.base`, `data-test-id="library-asset-delete"`, `@pointerdown.stop`, `@click.stop="handleDeleteLibraryAsset(asset.id, $event)"`, icon `<icon-lucide-trash-2 class="size-3" />`. Placed before Insert. |
| Library row Insert button | `insertButton.base`, `data-test-id="library-asset-insert"`, `@pointerdown.stop`, `@click.stop="handleInsertLibraryAsset(asset)"`, icon `<icon-lucide-plus class="size-3" />` (same icon as local insert). |
| Library loading state | `v-if="libraryLoading"`, `data-test-id="library-loading"`, `class="px-3 py-6 text-center text-xs text-muted"`, containing `<icon-lucide-loader-2 class="mx-auto size-4 animate-spin" />` (same spinner as the existing preview loading state). |
| Library empty state | `v-if="!libraryLoading && filteredLibraryAssets.length === 0"`, `data-test-id="library-assets-empty"`, `class="px-3 py-6 text-center text-xs text-muted"`, text `{{ panels.noLibraryAssets }}` — same shape as the existing `assets-empty` block. |
| Search placeholder | Existing `AppInput` (line 178-184) unchanged except `:placeholder="activeSource === 'document' ? panels.searchLocalComponents : panels.searchLibraryAssets"`. |
| Library details dialog | A second, separate `<DialogRoot v-model:open="libraryDetailsOpen">` using the same `dialog.overlay`/`dialog.content` from the existing `useDialogUI(...)` instance — do not create a second `useDialogUI` call. Structure mirrors the existing details dialog (header with icon/title/close, `grid-cols-[260px_1fr]` body) with `data-test-id="library-asset-details-dialog"`, `"library-asset-details-close"`, `"library-asset-details-preview"`, `"library-asset-details-preview-image"`, `"library-asset-details-insert"` (primary button, `primaryButton.base`, text `panels.addToDocument`, `@click="insertSelectedLibraryAsset"`), `"library-asset-details-delete"` (plain text button below it, `class="mt-2 w-full rounded px-2 py-1.5 text-center text-xs text-muted hover:bg-hover hover:text-surface"`, text `panels.deleteLibraryAsset`, `@click="deleteSelectedLibraryAsset"`), `"library-asset-details-description"`, `"library-asset-details-docs"`. |
| Library preview image | `<img v-if="libraryThumbnails[selectedLibraryAsset.id]" :src="libraryThumbnails[selectedLibraryAsset.id] ?? undefined" ...>` inside the same `h-36 ... bg-canvas/60` preview box as the local dialog; `v-else` falls back to the type icon + name, exactly like the local dialog's non-loading empty state (no spinner needed — thumbnails are fetched once on open, not streamed). |

### Banned List

- No literal colour of any kind — only the semantic tokens already used in this file (`text-muted`, `text-surface`, `text-component`, `border-border`, `bg-hover`, `bg-panel`, `bg-canvas/60`, `bg-component/15`).
- No font-size class other than `text-xs` or `text-[11px]` or `text-[10px]` (all three already appear in this exact file).
- No radius other than `rounded`, `rounded-md`, or `rounded-lg` (matching this file's existing usage).
- No new `tv()` recipe, no new `useDialogUI`/`useButtonUI` instance — reuse the two already declared in `AssetsPanel.vue:46-48`.
- No new npm dependency.
- No `@apply`, no new global CSS, no edit to `App/src/app.css`.
- No new panel (`PANEL_IDS`, `registry.ts`, `WorkspacePanelContent.vue`, `desktop/generated/menu.json` are all out of scope).
- No new command ID in `packages/vue/src/editor/commands/*`.
- No scene-graph type change (`packages/scene-graph/src/types.ts`, `node-defaults.ts` are read-only reference material, never edited).
- No `.fig`/Kiwi encode/decode code — this packet only ever calls the existing `buildOpenPencilClipboardHTML`/`parseOpenPencilClipboard`/`pasteFromHTML`, never Kiwi functions directly.
- No confirmation dialog for delete (matches existing app-wide convention).
- No new translated locale files — English only, per T-054.

## Allowed Changes

- New `App/src/app/library/index.ts` — manifest/payload/thumbnail storage, publish, delete, insert.
- `App/src/components/AssetsPanel.vue` — source switch, Publish button on document rows, library row list, library details dialog, new script state/functions per Implementation Steps.
- `App/packages/vue/src/i18n/messages/panels.ts` — new English keys only (no other locale files exist to update, per T-054).
- New `App/tests/engine/app/library.test.ts`.
- `App/tests/e2e/components/assets-panel.spec.ts` — new test(s) appended, reusing `ensureAssetsOpen`.

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these lines.

- No change to `sourceLibraryKey`, any other Kiwi/`.fig` field, or any scene-graph type or default.
- No live link between a library entry and an inserted node. Insertion is always an independent copy.
- No swatches, text styles, or effect styles in the library — components only (`COMPONENT`/`COMPONENT_SET`).
- No cloud, account, sync, network request, or team-library behaviour of any kind.
- No new `PANEL_IDS` entry, no `desktop/generated/menu.json` change, no native-menu regeneration.
- No new command ID and no change to any existing `selection.*` command.
- No `writeCacheBytes`/`readCacheBytes` use in this packet — text-only storage, so the feature stays usable in the plain browser dev server.
- No desktop build, installer run, version bump, or installed-result claim without explicit user authorisation in the execution session (none is structurally required here, since nothing native changed).
- No Git operation.
- **Deferred to a later packet:** de-duplication/versioning of republished assets; live-linked ("Instance from library") insertion with master de-dup per document; library entries for swatches/text styles/effect styles; renaming or editing a published entry's metadata after publish.

## Implementation Steps

1. **Pre-flight.** Re-read `AssetsPanel.vue` in full and `App/src/app/cache/index.ts` in full; confirm line numbers/exports have not drifted from Verified Starting State before editing.

2. **Create `App/src/app/library/index.ts`:**

   ```ts
   import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
   import {
     readCacheJson,
     writeCacheJson,
     readCacheText,
     writeCacheText,
     removeCacheEntry
   } from '@/app/cache'
   import type { EditorStore } from '@/app/editor/session'

   export const LIBRARY_MANIFEST_KEY = 'library/manifest.json'

   export interface LibraryAssetEntry {
     id: string
     name: string
     nodeType: 'COMPONENT' | 'COMPONENT_SET'
     variantCount: number
     description: string
     docsUrl: string | null
     publishedAt: number
     payloadKey: string
     thumbnailKey: string | null
   }

   export async function getLibraryAssets(): Promise<LibraryAssetEntry[]> {
     const items = await readCacheJson<LibraryAssetEntry[]>(LIBRARY_MANIFEST_KEY)
     if (!Array.isArray(items)) return []
     return [...items].sort((a, b) => a.name.localeCompare(b.name))
   }

   export async function publishAssetToLibrary(
     editor: EditorStore,
     nodeId: string
   ): Promise<LibraryAssetEntry | null> {
     const node = editor.graph.getNode(nodeId)
     if (!node) return null
     if (node.type !== 'COMPONENT' && node.type !== 'COMPONENT_SET') return null
     if (node.type === 'COMPONENT' && node.parentId) {
       const parent = editor.graph.getNode(node.parentId)
       if (parent?.type === 'COMPONENT_SET') return null
     }

     try {
       const id = crypto.randomUUID()
       const payloadKey = `library/payload_${id}.txt`
       await writeCacheText(payloadKey, buildOpenPencilClipboardHTML([node], editor.graph))

       let thumbnailKey: string | null = null
       try {
         const maxSize = Math.max(node.width, node.height, 1)
         const scale = Math.min(176 / maxSize, 2)
         const bytes = await editor.renderExportImage([nodeId], scale, 'PNG')
         if (bytes && bytes.length > 0) {
           thumbnailKey = `library/thumb_${id}.txt`
           await writeCacheText(thumbnailKey, `data:image/png;base64,${bytes.toBase64()}`)
         }
       } catch (err) {
         console.warn('[Library] Failed to render thumbnail:', err)
       }

       const entry: LibraryAssetEntry = {
         id,
         name: node.name,
         nodeType: node.type,
         variantCount: node.type === 'COMPONENT_SET' ? node.childIds.length : 0,
         description: node.symbolDescription,
         docsUrl: node.symbolLinks[0]?.uri ?? null,
         publishedAt: Date.now(),
         payloadKey,
         thumbnailKey
       }

       const list = await getLibraryAssets()
       list.unshift(entry)
       await writeCacheJson(LIBRARY_MANIFEST_KEY, list)
       return entry
     } catch (err) {
       console.warn('[Library] Failed to publish asset:', err)
       return null
     }
   }

   export async function deleteLibraryAsset(id: string): Promise<void> {
     const list = await getLibraryAssets()
     const idx = list.findIndex((entry) => entry.id === id)
     if (idx === -1) return
     const [removed] = list.splice(idx, 1)
     await removeCacheEntry(removed.payloadKey)
     if (removed.thumbnailKey) await removeCacheEntry(removed.thumbnailKey)
     await writeCacheJson(LIBRARY_MANIFEST_KEY, list)
   }

   export async function insertLibraryAsset(editor: EditorStore, entryId: string): Promise<boolean> {
     const list = await getLibraryAssets()
     const entry = list.find((item) => item.id === entryId)
     if (!entry) return false

     const payload = await readCacheText(entry.payloadKey)
     if (!payload) return false

     const canvasCenter = editor.viewportCanvasCenter()
     const center = editor.screenToCanvas(canvasCenter.x, canvasCenter.y)
     await editor.pasteFromHTML(payload, center)
     editor.requestRender()
     return true
   }

   export async function readLibraryThumbnail(entry: LibraryAssetEntry): Promise<string | null> {
     if (!entry.thumbnailKey) return null
     return readCacheText(entry.thumbnailKey)
   }
   ```

3. **Wire `AssetsPanel.vue` script.** Add `onMounted` to the existing `import { computed, ref, shallowRef, watch } from 'vue'` (line 3). Add `import SegmentedControl from '@/components/ui/SegmentedControl.vue'` and the library module import (all six named exports above) near the existing imports. Add after the existing `insertButton`/`primaryButton`/`dialog` declarations (around line 48):

   ```ts
   const activeSource = ref<'document' | 'library'>('document')
   // SegmentedControl's `v-model` is typed `Ref<string>` (defineModel<string>()); binding the
   // narrower `activeSource` ref to it directly would fail vue-tsc, exactly like
   // `CapabilitySwitcher.vue`'s `model` computed avoids for its own `Capability` union. Mirror
   // that pattern rather than widening `activeSource` itself.
   const sourceModel = computed({
     get: () => activeSource.value,
     set: (v: string) => {
       activeSource.value = v === 'library' ? 'library' : 'document'
     }
   })
   const sourceOptions = computed(() => [
     { value: 'document', label: panels.value.assetsTabDocument },
     { value: 'library', label: panels.value.assetsTabLibrary }
   ])

   const libraryAssets = ref<LibraryAssetEntry[]>([])
   const libraryLoading = ref(false)
   const libraryDetailsOpen = ref(false)
   const selectedLibraryAssetId = ref<string | null>(null)
   const libraryThumbnails = ref<Record<string, string | null>>({})

   async function loadLibraryAssets() {
     libraryLoading.value = true
     try {
       libraryAssets.value = await getLibraryAssets()
     } finally {
       libraryLoading.value = false
     }
   }

   onMounted(() => {
     void loadLibraryAssets()
   })

   const filteredLibraryAssets = computed(() => {
     const normalized = query.value.trim().toLowerCase()
     if (!normalized) return libraryAssets.value
     return libraryAssets.value.filter((asset) => asset.name.toLowerCase().includes(normalized))
   })

   const selectedLibraryAsset = computed(
     () => libraryAssets.value.find((asset) => asset.id === selectedLibraryAssetId.value) ?? null
   )

   async function openLibraryDetails(asset: LibraryAssetEntry) {
     selectedLibraryAssetId.value = asset.id
     libraryDetailsOpen.value = true
     if (!(asset.id in libraryThumbnails.value)) {
       libraryThumbnails.value[asset.id] = await readLibraryThumbnail(asset)
     }
   }

   async function handlePublish(asset: LocalAsset, event: MouseEvent) {
     event.stopPropagation()
     const published = await publishAssetToLibrary(editor, asset.id)
     if (published) await loadLibraryAssets()
   }

   async function handleInsertLibraryAsset(asset: LibraryAssetEntry) {
     await insertLibraryAsset(editor, asset.id)
   }

   function insertSelectedLibraryAsset() {
     if (!selectedLibraryAsset.value) return
     void handleInsertLibraryAsset(selectedLibraryAsset.value)
     libraryDetailsOpen.value = false
   }

   async function handleDeleteLibraryAsset(id: string, event: MouseEvent) {
     event.stopPropagation()
     await deleteLibraryAsset(id)
     await loadLibraryAssets()
   }

   async function deleteSelectedLibraryAsset() {
     if (!selectedLibraryAsset.value) return
     await deleteLibraryAsset(selectedLibraryAsset.value.id)
     await loadLibraryAssets()
     libraryDetailsOpen.value = false
   }
   ```

4. **Wire `AssetsPanel.vue` template** exactly per the Visual Contract table: the source switch between the header and the search input; the placeholder ternary on the search `AppInput`; the Publish `Tip` inserted into the existing local row before the Insert `Tip`; wrap the existing local row `<button v-for>` and its empty state in `<template v-if="activeSource === 'document'">…</template>`; add `<template v-else>` containing the loading state, the library row `<button v-for="asset in filteredLibraryAssets">` (Visual Contract), and the library empty state; add the second `DialogRoot` for library details (Visual Contract).

5. **Add i18n keys.** In `App/packages/vue/src/i18n/messages/panels.ts`, insert immediately after `insertInstance: 'Insert instance',` (line 29):

   ```ts
   assetsTabDocument: 'This document',
   assetsTabLibrary: 'Local library',
   searchLibraryAssets: 'Search library',
   publishToLibrary: 'Publish to library',
   addToDocument: 'Add to document',
   deleteLibraryAsset: 'Delete from library',
   noLibraryAssets: 'No library assets yet',
   libraryVariantCount: params('{count} variants'),
   ```

   `params` is already imported at the top of this file (line 1); no new import needed.

6. **Create `App/tests/engine/app/library.test.ts`:**

   ```ts
   import { afterEach, describe, expect, test } from 'bun:test'

   import { SceneGraph } from '@open-pencil/core'

   import type { EditorStore } from '@/app/editor/session'

   function installLocalStorage() {
     const data = new Map<string, string>()
     const storage = {
       get length() {
         return data.size
       },
       getItem: (key: string) => data.get(key) ?? null,
       setItem: (key: string, value: string) => data.set(key, value),
       removeItem: (key: string) => data.delete(key),
       key: (index: number) => [...data.keys()][index] ?? null
     } satisfies Pick<Storage, 'length' | 'getItem' | 'setItem' | 'removeItem' | 'key'>

     const storageProp = ['local', 'Storage'].join('')
     Object.assign(globalThis, { window: Object.fromEntries([[storageProp, storage]]) })
     return data
   }

   afterEach(() => {
     Reflect.deleteProperty(globalThis, 'window')
   })

   function pageId(graph: SceneGraph) {
     return graph.getPages()[0].id
   }

   function createMockEditor(graph: SceneGraph, renderResult: Uint8Array | null = null) {
     const pasteCalls: Array<{ html: string; pos: { x: number; y: number } | undefined }> = []
     const editor = {
       graph,
       renderExportImage: async () => renderResult,
       pasteFromHTML: async (html: string, pos?: { x: number; y: number }) => {
         pasteCalls.push({ html, pos })
       },
       viewportCanvasCenter: () => ({ x: 400, y: 300 }),
       screenToCanvas: (x: number, y: number) => ({ x, y }),
       requestRender: () => undefined
     } as unknown as EditorStore
     return { editor, pasteCalls }
   }

   describe('asset library', () => {
     test('returns an empty list with no manifest', async () => {
       installLocalStorage()
       const { getLibraryAssets } = await import('@/app/library')
       await expect(getLibraryAssets()).resolves.toEqual([])
     })

     test('publish rejects a non-component node', async () => {
       installLocalStorage()
       const { publishAssetToLibrary } = await import('@/app/library')
       const graph = new SceneGraph()
       const rect = graph.createNode('RECTANGLE', pageId(graph), { name: 'Rect' })
       const { editor } = createMockEditor(graph)
       await expect(publishAssetToLibrary(editor, rect.id)).resolves.toBeNull()
     })

     test('publish stores a manifest entry and a readable payload', async () => {
       installLocalStorage()
       const { publishAssetToLibrary, getLibraryAssets } = await import('@/app/library')
       const graph = new SceneGraph()
       const node = graph.createNode('COMPONENT', pageId(graph), {
         name: 'Button',
         symbolDescription: 'A button',
         symbolLinks: [{ uri: 'https://example.com', displayName: 'Docs' }]
       })
       const { editor } = createMockEditor(graph)

       const entry = await publishAssetToLibrary(editor, node.id)
       expect(entry?.name).toBe('Button')
       expect(entry?.nodeType).toBe('COMPONENT')
       expect(entry?.description).toBe('A button')
       expect(entry?.docsUrl).toBe('https://example.com')
       expect(entry?.thumbnailKey).toBeNull()

       const list = await getLibraryAssets()
       expect(list).toHaveLength(1)
       expect(list[0].id).toBe(entry?.id)
     })

     test('publish captures a thumbnail when renderExportImage returns bytes', async () => {
       installLocalStorage()
       const { publishAssetToLibrary, readLibraryThumbnail } = await import('@/app/library')
       const graph = new SceneGraph()
       const node = graph.createNode('COMPONENT', pageId(graph), { name: 'Icon' })
       const { editor } = createMockEditor(graph, new Uint8Array([1, 2, 3]))

       const entry = await publishAssetToLibrary(editor, node.id)
       expect(entry?.thumbnailKey).not.toBeNull()
       await expect(readLibraryThumbnail(entry!)).resolves.toStartWith('data:image/png;base64,')
     })

     test('delete removes the manifest entry and its payload', async () => {
       installLocalStorage()
       const { publishAssetToLibrary, deleteLibraryAsset, getLibraryAssets } = await import(
         '@/app/library'
       )
       const graph = new SceneGraph()
       const node = graph.createNode('COMPONENT', pageId(graph), { name: 'Card' })
       const { editor } = createMockEditor(graph)
       const entry = await publishAssetToLibrary(editor, node.id)

       await deleteLibraryAsset(entry!.id)
       await expect(getLibraryAssets()).resolves.toEqual([])
     })

     test('insert pastes the stored payload at the viewport centre', async () => {
       installLocalStorage()
       const { publishAssetToLibrary, insertLibraryAsset } = await import('@/app/library')
       const graph = new SceneGraph()
       const node = graph.createNode('COMPONENT', pageId(graph), { name: 'Chip' })
       const { editor, pasteCalls } = createMockEditor(graph)
       const entry = await publishAssetToLibrary(editor, node.id)

       const ok = await insertLibraryAsset(editor, entry!.id)
       expect(ok).toBe(true)
       expect(pasteCalls).toHaveLength(1)
       expect(pasteCalls[0].html).toContain('openpencil')
       expect(pasteCalls[0].pos).toEqual({ x: 400, y: 300 })
     })

     test('insert returns false for a missing entry', async () => {
       installLocalStorage()
       const { insertLibraryAsset } = await import('@/app/library')
       const graph = new SceneGraph()
       const { editor } = createMockEditor(graph)
       await expect(insertLibraryAsset(editor, 'missing')).resolves.toBe(false)
     })
   })
   ```

7. **Extend `App/tests/e2e/components/assets-panel.spec.ts`.** The file already has the required header (lines 1-2) — do not add a second one. Append a new `test(...)` after the existing three, reusing `ensureAssetsOpen`:

   ```ts
   test('publish to library and insert an independent copy', async ({ page }) => {
     const canvas = new CanvasHelper(page)
     await page.goto('/?test')
     await canvas.waitForInit()
     await ensureAssetsOpen(page, canvas)

     const setup = await page.evaluate(() => {
       const store = window.openPencil?.getStore?.()
       if (!store) throw new Error('OpenPencil store not initialized')
       const pageNode = store.graph.getNode(store.state.currentPageId)
       if (!pageNode) throw new Error('Current page not found')
       const card = store.graph.createNode('COMPONENT', pageNode.id, {
         name: 'Library Card',
         x: 40,
         y: 40,
         width: 120,
         height: 60,
         symbolDescription: 'A publishable card'
       })
       store.requestRender()
       return { cardId: card.id }
     })
     await canvas.waitForRender()

     await page.locator(`[data-asset-id="${setup.cardId}"]`).getByTestId('asset-publish').click()

     await page.getByTestId('assets-tab-library').click()
     const libraryItems = page.getByTestId('library-asset-item')
     await expect(libraryItems).toHaveCount(1)
     await expect(page.getByTestId('assets-panel')).toContainText('Library Card')

     const countBefore = await page.evaluate(() => {
       const store = window.openPencil?.getStore?.()
       if (!store) throw new Error('OpenPencil store not initialized')
       return store.graph.getChildren(store.state.currentPageId).length
     })

     await libraryItems.first().getByTestId('library-asset-insert').click()
     await canvas.waitForRender()

     const afterInsert = await page.evaluate((cardId) => {
       const store = window.openPencil?.getStore?.()
       if (!store) throw new Error('OpenPencil store not initialized')
       const children = store.graph.getChildren(store.state.currentPageId)
       const inserted = children.find((n) => n.type === 'COMPONENT' && n.id !== cardId)
       return {
         count: children.length,
         insertedType: inserted?.type ?? null,
         insertedComponentId: inserted?.componentId ?? null
       }
     }, setup.cardId)

     expect(afterInsert.count).toBe(countBefore + 1)
     expect(afterInsert.insertedType).toBe('COMPONENT')
     expect(afterInsert.insertedComponentId).toBeNull()

     await libraryItems.first().getByTestId('library-asset-delete').click()
     await expect(libraryItems).toHaveCount(0)
     await expect(page.getByTestId('library-assets-empty')).toBeVisible()

     canvas.assertNoErrors()
   })
   ```

8. **Run the development-loop test until green**, then the final gates once in order (below). Do not run `bun run check`, `bun run test`, `bun run test:unit`, a build, or an install.

## Acceptance Criteria

- [ ] The Assets panel shows a `This document | Local library` switch; each tab lists the correct source and the search box filters whichever is active.
- [ ] Every local `COMPONENT`/`COMPONENT_SET` row has a working Publish action; publishing a variant-child `COMPONENT` is not possible (no such row exists) and `publishAssetToLibrary` defensively rejects one if called directly.
- [ ] A published entry appears in the Local library tab with name, variant count (for a set), description, and doc link matching the source node at publish time.
- [ ] Inserting a library asset creates a brand-new `COMPONENT`/`COMPONENT_SET` node (fresh id) in the current document with `componentId` unset — never an `INSTANCE`, never a reference back to the library.
- [ ] Deleting a library entry removes its manifest row, payload, and thumbnail (if any); a second delete of the same id is a no-op.
- [ ] Nothing under `App/packages/scene-graph`, `App/packages/kiwi`, or `App/packages/core/src/kiwi` is modified; `sourceLibraryKey` is untouched everywhere.
- [ ] No `writeCacheBytes`/`readCacheBytes` call appears anywhere in the new module; the feature is exercised end-to-end through `bun run dev` in a plain browser (no Tauri required).
- [ ] No new `PANEL_IDS` entry, no `registry.ts` change, no `desktop/generated/menu.json` regeneration.
- [ ] Named source gates and the focused Playwright spec pass; nothing in the Banned List appears in the diff.

## Verification

Run commands from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bun test tests/engine/app/library.test.ts
```

Expected: all 7 tests pass; no Tauri/CanvasKit dependency, runs in under a second.

### Final pre-completion gates — run once

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/app/library/index.ts src/components/AssetsPanel.vue packages/vue/src/i18n/messages/panels.ts tests/engine/app/library.test.ts tests/e2e/components/assets-panel.spec.ts
bun test tests/engine/app/library.test.ts
bunx playwright test tests/e2e/components/assets-panel.spec.ts --project=openpencil
```

Expected: both TypeScript projects and the root project exit 0; focused Oxlint exits 0 with no warnings; the Bun suite passes 7/7; the Playwright file passes all four tests (three existing + the new one). Record exact exit codes and test counts. Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, a build, an install, or a version bump.

## Integration or Installed-Result Check

1. Run `bun run dev` and open the browser editor at the Vite URL.
2. Open (or dock) the Assets panel via the app-icon menu's Window entry if not already visible. Confirm the `This document | Local library` switch renders, defaulting to "This document."
3. Draw a rectangle, create a component from it (`⌘/Ctrl+Alt+K` or the equivalent menu action), and confirm it appears under "This document" with a Publish button alongside Docs/Insert.
4. Click Publish. Switch to "Local library." Confirm the entry appears with the correct name and a rendered thumbnail (or the component icon if rendering failed).
5. Click Insert on the library row. Confirm a new component appears in the canvas/layers at the viewport centre, selected, and that it is a plain `COMPONENT` (not an instance) — check via the Layer tree or by opening its Design panel (no "Go to Main Component"/"Detach Instance" buttons should appear for it).
6. Reload the page (`F5`). Confirm the library entry survives (this proves the `localStorage` fallback works without Tauri) while the newly created document-side component does not persist (documents are not autosaved by this packet — expected, unrelated to this change).
7. Delete the library entry. Confirm it disappears and the empty state appears.
8. State explicitly in the report: this is full browser proof, not installed-desktop-only proof — and, unlike T-053/T-058, no native-menu or Tauri-only surface exists in this packet, so browser proof is sufficient; no conditional desktop-approval gate applies.

## Stop Conditions

- Stop if `buildOpenPencilClipboardHTML`, `parseOpenPencilClipboard`, or `pasteFromHTML`'s signature or behaviour (in particular the "no `cursorPos` = no centring" behaviour) has changed since this verification — re-verify against live source before implementing insert.
- Stop if `readCacheText`/`writeCacheText` no longer fall back to `localStorage` outside Tauri — that would make this packet's non-Tauri acceptance criteria false; report rather than force a Tauri-only feature under this packet's stated scope.
- Stop if `sourceLibraryKey` is found to be written or read anywhere new since this verification (would indicate the field's semantics changed) — do not proceed on stale evidence.
- Stop if `AssetsPanel.vue`'s local-asset filter (top-level `COMPONENT`/`COMPONENT_SET` only) has changed shape — this packet's Publish guard must match it exactly, not diverge.
- Stop and report if adding the `SegmentedControl` produces a layout regression in the existing local-asset row list (e.g. horizontal overflow at the panel's minimum width) rather than silently shipping a broken layout.

## Execution Report Contract

Return:

- exact files changed;
- confirmation that no file under `App/packages/scene-graph`, `App/packages/kiwi`, or `App/packages/core/src/kiwi` was touched;
- the exact storage keys used (`library/manifest.json`, `library/payload_<id>.txt`, `library/thumb_<id>.txt`) and confirmation that only `readCacheText`/`writeCacheText`/`readCacheJson`/`writeCacheJson`/`removeCacheEntry` were used (no `*Bytes` calls);
- each focused command, exit code, and test count;
- the browser flow observed per Integration or Installed-Result Check, including the reload-persistence check;
- any failed check, assumption used, or remaining gap.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Brief (added 2026-08-14; not expanded — confirm `sourceLibraryKey` `.fig` semantics first)

Expanded 2026-08-20. `sourceLibraryKey` is confirmed Figma-meaningful (Kiwi field 395, round-tripped both directions, real value on a live `.fig` fixture) and is not touched anywhere in this packet — no scene-graph field, no Kiwi change, no `.fig` semantics change. Storage and serialization reuse existing primitives end to end: the app cache module's **text** functions (not bytes, so no Tauri-only restriction, unlike T-058) and the exact `openpencil/v1` clipboard payload/`pasteFromHTML` pipeline already used by system copy/paste, so insertion needed no new node-cloning code. No new panel, command ID, or native-menu surface — the whole feature lands inside the existing `AssetsPanel.vue` using the existing `SegmentedControl` primitive. New coverage extends the existing live `tests/e2e/components/assets-panel.spec.ts` rather than creating a parallel spec file.
