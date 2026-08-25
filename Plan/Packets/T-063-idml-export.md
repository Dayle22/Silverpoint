# T-063 - IDML export for InDesign and Affinity Publisher

Task ID: T-063
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-017 (physical units — landed), T-018 (print presets — landed)
Related: T-064 (IDML import — the other half of the request), T-008 (export formats), T-021 (production PDF — the closest precedent), T-007 (frame guides), T-019 (CMYK gamut)
Prepared from: the user's 2026-08-17 request, "export idml … the goal is to create a workflow between OpenPotlood and InDesign or Affinity", plus the IDML package sketch the user supplied the same day
Expanded at: 2026-08-17
Expanded against: the live tree under `App/` — `packages/core/src/io/{types,registry,formats}.ts`, `formats/pdf/print.ts` (370 lines, read in full), `formats/svg/{export,node,paths}.ts`, `formats/raster/index.ts`, `packages/core/src/units/document.ts`, `packages/core/src/guides/frame.ts`, `packages/core/src/kiwi/fig/node-change/plugin-data.ts`, `packages/scene-graph/src/types.ts`, `packages/vue/src/document/export/helpers.ts`, `src/components/properties/ExportSection.vue`, `src/app/document/export/{create,files}.ts`, `tests/engine/io/formats/pdf-print.test.ts`, `tests/e2e/export/pdf-print.spec.ts`
Delivery: source gates only

## Intended Outcome

A user picks `IDML` in the Export panel and saves one `.idml` file. InDesign and Affinity Publisher both open it without a repair prompt. Each exported frame is a page at its correct physical size; rectangles, ellipses, polygons and paths arrive as native page items with solid fills and strokes; text arrives in editable text frames; images arrive placed and embedded; margins and bleed arrive as page setup rather than as drawn artwork. Anything the mapping cannot express is rasterised into an embedded image and **named to the user in a preflight warning before export**, never silently dropped.

## Request Coverage

- Export `.idml` so work opens in **both** Adobe InDesign and Affinity Publisher.
- Establish the OpenPotlood → layout-application half of the round trip. (Import is T-064.)
- Answer whether several frame sizes can become InDesign **Alternate Layouts**. Settled below as Open Decision 1 — the packet ships differing-size pages and does not ship Alternate Layouts.

## Verified Starting State

Verified on 2026-08-17. Line numbers are from that read; the named symbols are the stable anchors.

### A. The adapter seam already exists and needs no redesign

`packages/core/src/io/types.ts` defines `IOFormatAdapter` — `id`, `label`, `role`, `category`, `extensions`, `mimeTypes`, `support`, `exportOptions`, `matchesFile?`, `readDocument?`, `writeDocument?`, `exportContent?`. `ExportResult.data` is `IOData = Uint8Array | string`, so a binary ZIP payload is already expressible with no type change. `IOFormatCategory` is the closed union `'document' | 'raster' | 'vector' | 'code' | 'print'`.

`IORegistry` (`packages/core/src/io/registry.ts`) filters by `support.export*` per scope (`listExportFormats`, lines 24-38). Registering an adapter in `BUILTIN_IO_FORMATS` (`formats.ts`, final export) is the whole of the plumbing.

**`pdfPrintFormat` (`formats.ts`) is the template**: `role: 'interchange-document'`, `category: 'print'`, a `support` block that deliberately omits `exportDocument`, and a lazily-`import()`ed renderer so the heavy module never enters the main chunk. Copy that shape exactly.

### B. `pdf/print.ts` is a working precedent for almost every hard part

Read in full. It already solves, in this codebase's own idiom, four problems T-063 faces:

| Concern | Existing solution to copy | Anchor |
| --- | --- | --- |
| "Which node is the page?" | `resolveTargetFrame(graph, target)` — accepts `node` / `selection`-of-one / `page`-with-exactly-one-frame, throws `'Production PDF requires a single frame target'` otherwise | `print.ts:41-82` |
| px → points | `const ptPerPx = 72 / dpi`, `dpi` from options or `parseDocumentUnits(graph.getPages()[0]?.pluginData ?? []).dpi \|\| 300` | `print.ts:144-147`, `print.ts:207-213` |
| Bleed and margins | `parseFrameGuides(frame.pluginData)`, then `guides.bleed.enabled ? guides.bleed.top : 0` per edge, scaled by `ptPerPx` | `print.ts:149-154` |
| "What can't we represent?" | `collectFallbackReasons(graph, nodeId)` walks the subtree and returns human strings — `Background blur on 'X'`, `Layer mask on 'X'`, `Adjustment filter on 'X'`, `Progressive blur on 'X'`; deduped via `[...new Set(reasons)]` | `print.ts:84-115` |
| Surfacing that to the user | `preflightPrintPDF()` returns `{ valid, errors, warnings, rasterFallback, rasterFallbackReason }`; the panel renders it and disables the export button when invalid | `print.ts:117-193`, `ExportSection.vue:71-79,198-215` |
| Raster fallback | `renderNodesToImage(ck, renderer, graph, pageId, [id], { format: 'PNG', scale })` → base64 → embed | `print.ts:288-305` |

The four subtree predicates it composes are exported from `packages/core/src/io/formats/raster/index.ts`: `nodeNeedsBackgroundBlur`, `nodeNeedsAdjustmentFallback`, `nodeNeedsMaskFallback`, `nodeNeedsProgressiveBlurFallback`, `nodeNeedsSceneBackdrop`, alongside `computeContentBounds` and `renderNodesToImage`.

### C. The XML emitter already exists and is format-agnostic

`packages/core/src/io/formats/svg/node.ts` (62 lines, read in full) is **not SVG-specific**. `svg(tag, attrs, ...children)` builds a `{ tag, attrs, children }` record with `null`/`undefined` attributes stripped, and `renderSVGNode(node, indent)` serialises it with `&`/`"`/`<` attribute escaping and `&`/`<`/`>` text escaping. Tag and attribute names are free-form strings. IDML XML is emitted through this, renamed at the import site — **no XML library, no new dependency**.

Geometry helpers in `svg/paths.ts`: `round(n, decimals = 2)`, `geometryBlobToSVGPath(blob)`, `vectorNetworkToSVGPaths(network)`, `makePolygonPoints(node)`, `hasRadius`, `roundedRectPath(node)`, `arcPath(node)`. These consume `node.fillGeometry` (`GeometryPath[]`) and `node.vectorNetwork`, which is the same source data IDML `<PathPointArray>` needs — a different notation over identical input.

### D. ZIP writing is solved, including the `mimetype` rule

`packages/core/src/io/formats/fig/compress.ts:1-22` already writes a ZIP with **stored (uncompressed) entries** using `zipSync` from `fflate`:

```ts
const zipEntries: Zippable = { 'canvas.fig': [canvasData, { level: 0 }], … }
return zipSync(zipEntries)
```

`fflate` is a real dependency (`package.json:94`, `^0.8.2`). `zipSync` writes entries in object insertion order, so IDML's "`mimetype` first, stored, no compression" rule is reachable with the exact pattern already in the tree. `unzipSync` is likewise already used (`packages/kiwi/src/fig/parse.ts:94`) — relevant to T-064 and to this packet's own round-trip test.

### E. The node model the exporter reads from

`packages/scene-graph/src/types.ts`:

- `NodeType` (line 77-96): `CANVAS`, `FRAME`, `RECTANGLE`, `ROUNDED_RECTANGLE`, `ELLIPSE`, `TEXT`, `LINE`, `STAR`, `POLYGON`, `VECTOR`, `BOOLEAN_OPERATION`, `GROUP`, `SECTION`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE`, `CONNECTOR`, `SHAPE_WITH_TEXT`, `SLICE`.
- `SceneNode` (line 350+) is flat: `x`, `y`, `width`, `height`, `rotation`, `fills: Fill[]`, `strokes: Stroke[]`, `effects: Effect[]`, `opacity`, `blendMode`, corner radii, `fillGeometry`/`strokeGeometry`/`vectorNetwork`/`arcData`, and the full text block (`text`, `fontSize`, `fontFamily`, `fontWeight`, `italic`, `textAlignHorizontal`, `textAlignVertical`, `lineHeight`, `letterSpacing`, `styleRuns: StyleRun[]`, …).
- `Fill` (line 139-161) carries `type: FillType`, `color`, `opacity`, `visible`, optional `gradientStops`/`gradientTransform`/`imageHash`/`imageScaleMode`/`imageTransform`.
- `Stroke` (line 167-176) is **solid-colour only** — `color`, `weight`, `opacity`, `visible`, `align: 'INSIDE'|'CENTER'|'OUTSIDE'`, optional `cap`/`join`/`dashPattern`. (No gradient fields; that is T-048's scope, not this packet's problem.)
- Image bytes live in `graph.images: Map<string, Uint8Array>` (`packages/scene-graph/src/index.ts:72`), keyed by `Fill.imageHash`.

Absolute placement comes from `graph.getAbsolutePosition(id)`, used by both `svg/export.ts:567` and `print.ts:283`.

### F. `ExportFormatId` is persisted — and its `.fig` guard is already out of date

`packages/scene-graph/src/types.ts:290`:

```ts
export type ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'pdf-print'
```

Export rows are persisted into `.fig` plugin data. On the way back in, `packages/core/src/kiwi/fig/node-change/plugin-data.ts:165-169`:

```ts
function isExportFormatId(value: unknown): value is ExportFormatId {
  return value === 'png' || value === 'jpg' || value === 'webp' || value === 'svg' || value === 'pdf'
}
```

**`'pdf-print'` is missing from this guard.** `parseExportSettingsPluginValue` (line 171-191) returns `null` unless `settings.length === parsed.length`, so a single unrecognised row makes `extractExportSettings` (line 211) discard the *entire* plugin-data list and fall back to native `nc.exportSettings`. A document saved with a `pdf-print` row therefore loses **all** of its export rows on reopen. This is a pre-existing T-021 defect, not something T-063 introduces — but T-063 adds `'idml'` to the same union and **must** update this guard, and should fix `'pdf-print'` in the same line while it is there.

### G. UI seam

`src/components/properties/ExportSection.vue`:
- `isSingleFrameTarget` (line 33-48) and the conditional `options.push({ value: 'pdf-print', … })` (line 57-60) are the live precedent for offering a format only when the target suits it.
- `pdfPrintPreflight` (line 71-79) recomputes on `editorStore.state.sceneVersion`.
- Errors render at line 198-205 (`data-test-id="export-preflight-errors"`), warnings at 207-215 (`data-test-id="export-preflight-warnings"`), and the export button (line 217-225, `data-test-id="export-button"`) is `:disabled` when preflight is invalid.

`packages/vue/src/document/export/helpers.ts:12` holds `EXPORT_FORMATS`; `formatSupportsScale()` (line 29-31) reads the adapter's `exportOptions.scale`, so declaring `scale: false` hides the scale control with no UI code.

`src/app/document/export/files.ts`: `getExportOptions()` (line 74-90) shapes per-format options; `getExportFileName()` (line 92-101) already gives non-raster formats a plain `<name>.<ext>`; `saveExportedFile()` drives the Tauri save dialog.

Strings live in `packages/vue/src/i18n/messages/panels.ts` (`exportPdfPrint: 'PDF (print)'`, line 179). **T-054 removed the multi-locale system and retired `check:i18n`** — there is no such script in `package.json` today, so it is not an acceptance gate for this packet.

### H. Test harnesses to match

- Engine: `tests/engine/io/formats/pdf-print.test.ts` — `bun:test`, `SceneGraph` built in-process, `setupFakeDomEnvironment()` from `#tests/helpers/svg-dom-shim`, byte-level assertions on the produced file. `tests/engine/io/formats/pdf-import.test.ts` loads binary fixtures from `tests/fixtures/pdf/`.
- E2E: `tests/e2e/export/pdf-print.spec.ts` — serial mode, `CanvasHelper`, `propertyItems(page, 'exportSettings')`, `page.getByTestId('export-button')`, and a `forceBlobDownload()` helper that nulls `window.showSaveFilePicker`.

### I. Nothing IDML-related exists

Repo-wide case-insensitive grep for `idml|indesign|affinity` across `src`, `packages` and `tests` returns nothing. This is entirely new surface.

## Corrections to the Brief

1. **"Export only / no import" is withdrawn.** The user asked for import on 2026-08-17. It is now T-064, expanded separately, and lands after this packet because this packet produces its fixtures.
2. **The user-supplied `designmap.xml` sketch is not usable as written.** `xmlns:idPkg="http://adobe.com"` is a placeholder, and `<idPkg:Graphic src="Resources/Preferences.xml"/>` mislabels Preferences as Graphic. The sketch is a directory map, not a contract — Implementation Step 1 replaces it with a calibrated reference.
3. **The brief's `bun run check:i18n` gate does not exist.** T-054 retired it (see G). Do not attempt to run it.
4. **The brief listed "no XML dependency" as a risk for export.** It is not: `svg/node.ts` already emits arbitrary escaped XML (see C). The risk is real only for *reading*, which is T-064's problem.

## Fixed Decisions

1. **One adapter, `idmlFormat`, id `'idml'`, `role: 'interchange-document'`, `category: 'document'`, `extensions: ['idml']`, `mimeTypes: ['application/vnd.adobe.indesign-idml-package']`.** `support`: `exportPage: true`, `exportSelection: true`, `exportNode: true`; **`exportDocument` is omitted**, matching `pdfPrintFormat`. `exportOptions: { scale: false, quality: false }`.

2. **The export target resolves to an ordered list of frames, and each frame becomes one page.**
   - `scope: 'node'` / `scope: 'selection'` → every selected node of type `FRAME`, in selection order.
   - `scope: 'page'` → every top-level `FRAME` child of that page, in `childIds` order.
   - Zero frames → throw `'IDML export requires at least one frame'`, surfaced through preflight as an error.
   This generalises `resolveTargetFrame`'s single-frame rule rather than reusing it; a layout handoff wants the whole document, not one artboard. Non-frame top-level nodes are ignored, and preflight warns naming them.

3. **Differing frame sizes become pages with differing `GeometricBounds`. Alternate Layouts are not implemented.** See Open Decision 1.

4. **Every spread holds exactly one page.** No facing pages, no binding-spine geometry, no master-spread content beyond the one empty master the format requires. This removes the entire spread-origin coordinate ambiguity from the packet.

5. **Points come from the document, never from a constant.** `ptPerPx = 72 / dpi`, `dpi` resolved exactly as `print.ts:207-213` does: `options.documentDpi` if positive, else `parseDocumentUnits(graph.getPages()[0]?.pluginData ?? []).dpi || 300`. Hardcoding 72 or 96 is a defect.

6. **Node → IDML mapping for slice 1** (everything else falls back per decision 7):

   | Source | IDML output |
   | --- | --- |
   | `FRAME` (target) | `<Page>` + `<MarginPreferences>` from `parseFrameGuides(...).margins`; document bleed from `.bleed` |
   | `FRAME` (nested), `GROUP`, `SECTION`, `COMPONENT`, `INSTANCE` | `<Group>` containing its children's items |
   | `RECTANGLE`, `ROUNDED_RECTANGLE` | `<Rectangle>` with explicit `PathGeometry` (radii baked into the path) |
   | `ELLIPSE` (no `arcData`) | `<Oval>` |
   | `POLYGON`, `STAR`, `LINE`, `VECTOR`, `BOOLEAN_OPERATION` | `<Polygon>` with `PathGeometry` from `fillGeometry` / `vectorNetwork` |
   | `TEXT` | `<TextFrame ParentStory="…">` + one `Stories/Story_*.xml` |
   | any node whose first visible fill is an image | the shape above, with an `<Image>` child carrying embedded `<Contents>` from `graph.images` |
   | `CANVAS`, `SLICE`, `COMPONENT_SET`, invisible nodes | skipped, no warning |

7. **One fallback, and it is loud.** A node is rasterised to an embedded PNG placed at its bounds when *any* of these hold: a visible gradient or pattern or noise fill; a visible `Effect` of any type; `blendMode !== 'NORMAL'`; `isMask`; `opacity < 1` on a container; or any of `nodeNeedsBackgroundBlur` / `nodeNeedsMaskFallback` / `nodeNeedsAdjustmentFallback` / `nodeNeedsProgressiveBlurFallback` returning true for it. The raster call is `renderNodesToImage(ck, renderer, graph, pageId, [node.id], { format: 'PNG', scale: dpi / 72 })`, copied from `print.ts:288-305`. **Every fallback appears in preflight warnings by node name**, via a `collectIdmlFallbackReasons(graph, frameIds)` modelled line-for-line on `collectFallbackReasons` (`print.ts:84-115`). Silent rasterisation fails this packet.

8. **Colour is RGB.** Each distinct visible solid `Fill`/`Stroke` colour becomes one RGB `<Color>` swatch in `Resources/Graphic.xml`, named deterministically from its channel values (`C=R=32 G=64 B=128`-style, not a counter), so repeated exports of the same document produce identical swatch sets. No CMYK conversion — that stays T-019's territory. `Fill.opacity` and `Stroke.opacity` map to the item's transparency setting, not into the swatch.

9. **Images are embedded, never linked.** A `.idml` that breaks when the user moves a folder is not a workflow. Bytes come from `graph.images.get(fill.imageHash)`; the format is preserved as-is (no re-encode). Rasterised fallbacks are embedded the same way.

10. **Fonts are referenced by name, never embedded** — IDML has no embedding mechanism. `node.fontFamily`/`fontWeight`/`italic` produce a `<FontFamily>` entry and a character style. A missing font on the opening machine is InDesign's or Affinity's own missing-font prompt and is **expected behaviour**, to be stated in the user docs.

11. **Identities are deterministic.** Every `Self` attribute is derived from the node id (or from a stable counter seeded in traversal order), never from a random or time value, so two exports of an unchanged document are byte-identical. This is what makes the round-trip test in T-064 meaningful.

12. **`ExportFormatId` gains `'idml'`, and `isExportFormatId` is corrected in the same edit** to `'png' | 'jpg' | 'webp' | 'svg' | 'pdf' | 'pdf-print' | 'idml'` (see F). The `pdf-print` half of that fix is a bug fix and must be called out in the report, not folded in silently.

13. **A `bun test` fixture proves structure; the layout applications prove fidelity.** Structural assertions (entry order, stored `mimetype`, well-formed XML, page count, page dimensions in pt, swatch presence, story text) run headless with no Adobe software. Opening the file in InDesign and in Affinity Publisher is a separate manual/MCP confirmation recorded in the report — it is required for the packet to be called done, but it is not a `bun test` gate.

## Open Decisions

1. **Alternate Layouts — recommendation: do not implement, ship differing-size pages.**
   Evidence: an InDesign Alternate Layout is not merely extra spreads — it is a `<Section>` carrying an alternate-layout name plus liquid-layout rules on each page, and it is an InDesign-authoring convenience rather than an interchange primitive. Affinity Publisher has no Alternate Layout feature at all, so anything written for it is at best ignored and at worst a parse risk in the application the user named second. Differing-size pages are expressible (`Page.GeometricBounds` is per page) and are understood by both applications. **Recommended default, and what this packet ships.** If the user wants true Alternate Layouts later, it is a follow-up packet that must state InDesign-only support up front.

2. **Whether `category: 'document'` or a new `'layout'` member is right.**
   `IOFormatCategory` is a closed union and IDML is not `'vector'`, `'raster'`, `'code'` or `'print'`. Recommendation: use `'document'` and add nothing, because the field is descriptive and no consumer switches on it exhaustively. If a consumer is found that does, add `'layout'` and report it.

## Visual Contract — binding

The UI change is one entry in an existing dropdown plus reuse of the existing preflight blocks. **Do not build a new panel.**

| Element | Required |
| --- | --- |
| Format option | Push `{ value: 'idml', label: panels.exportIdml }` into `formatOptions` in `ExportSection.vue`, immediately after the `pdf-print` push (line 57-60). Same `computed`, same array. |
| New string | `exportIdml: 'IDML (InDesign)'` in `packages/vue/src/i18n/messages/panels.ts`, beside `exportPdfPrint` (line 179). |
| Gating | Offer `idml` whenever the resolved target yields ≥ 1 frame. Reuse the `isSingleFrameTarget` pattern; add `hasAnyFrameTarget`, do not repurpose the existing computed. |
| Preflight | Reuse the **existing** `export-preflight-errors` and `export-preflight-warnings` blocks verbatim — including `class="mt-1 flex flex-col gap-1 rounded-md border border-border bg-panel px-2.5 py-1.5 text-[11px] text-destructive"` (errors) and the identical string with `text-muted` (warnings). Widen the existing `pdfPrintPreflight` computed into one `exportPreflight` computed that dispatches on which format rows are present. **No new markup block, no new `data-test-id`.** |
| Export button | Untouched. Its existing `:disabled` binding must simply consume the widened preflight. |
| Scale control | Nothing to do — `exportOptions.scale: false` makes `formatSupportsScale('idml')` false and the control hides itself. |

### Banned List

- No literal colour: no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-amber-400`). Only `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`, `text-destructive`.
- No font size outside `text-xs` / `text-[11px]`.
- No radius outside `rounded-md` / `rounded-lg`.
- No new `tv()` recipe. No new component file under `src/components/`.
- **No new npm dependency** — not an XML builder, not a ZIP library, not an IDML library. `fflate` + `svg/node.ts` cover it.
- No new global CSS, no `@apply`, no edit to `src/app.css`.
- No new store or Pinia-style state; the preflight is a `computed` in the existing component.
- No new dialog, no new toast, no new menu entry. IDML is reached through the Export panel only in this packet.

## Allowed Changes

New:

- `App/packages/core/src/io/formats/idml/index.ts`
- `App/packages/core/src/io/formats/idml/export.ts` — orchestration, preflight, fallback collection
- `App/packages/core/src/io/formats/idml/package.ts` — ZIP assembly and the `mimetype` rule
- `App/packages/core/src/io/formats/idml/xml.ts` — thin re-export/rename over `svg/node.ts`'s `svg()`/`renderSVGNode()`
- `App/packages/core/src/io/formats/idml/geometry.ts` — node → `PathGeometry`
- `App/packages/core/src/io/formats/idml/styles.ts` — swatches, fonts, paragraph/character styles
- `App/packages/core/src/io/formats/idml/stories.ts` — text frames and stories
- `App/tests/engine/io/formats/idml-export.test.ts`
- `App/tests/e2e/export/idml.spec.ts`
- `App/tests/fixtures/idml/` — the calibration reference from Step 1

Existing:

- `App/packages/core/src/io/formats.ts` — register `idmlFormat`
- `App/packages/core/src/io/index.ts` — re-export the public symbols
- `App/packages/scene-graph/src/types.ts` — `ExportFormatId` gains `'idml'`
- `App/packages/core/src/kiwi/fig/node-change/plugin-data.ts` — `isExportFormatId` gains `'idml'` **and** `'pdf-print'`
- `App/packages/vue/src/document/export/helpers.ts` — `EXPORT_FORMATS`
- `App/packages/vue/src/i18n/messages/panels.ts` — `exportIdml`
- `App/src/components/properties/ExportSection.vue` — one format option, widened preflight
- `App/src/app/document/export/files.ts` — `getExportOptions` case if options are added
- `App/CHANGELOG.md`
- `App/packages/docs/user-guide/exporting.md`

Anything outside this list: stop and report.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report instead.

- **Do NOT change any existing exporter's output bytes.** PNG/JPG/WEBP/SVG/PDF/PDF-print must be byte-identical after this packet. `tests/engine/io/formats/pdf-print.test.ts` already contains a "T-008 Byte Equality Regression" block — that pattern is the model for proving it.
- **Do NOT implement IDML import.** That is T-064.
- **Do NOT implement Alternate Layouts, liquid layout, sections, facing pages, or master-page content.** One empty master spread, one page per spread.
- **Do NOT add a dependency.**
- **Do NOT rasterise silently.** Every fallback is named in preflight warnings.
- **Do NOT link images by path.** Embedded only.
- **Do NOT convert colour to CMYK**, add spot colours, or apply an ICC profile. T-019 owns gamut.
- **Do NOT touch `.fig`/Kiwi write behaviour.** The only `.fig`-adjacent edit permitted is the `isExportFormatId` guard.
- **Do NOT emit any random or time-derived value** into the package — it breaks deterministic output and T-064's round-trip test.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or `bun run check:upstream`.** Use the focused gates below. `bun run check:i18n` does not exist.
- **Do NOT build the desktop app, run NSIS, or bump any version file.**

### Deferred to a later packet

Gradient swatches, tables, anchored objects, text wrap, threaded/overflowing stories, paragraph/character style *libraries* beyond what each run needs, transparency effects expressed natively rather than rasterised, Alternate Layouts, CMYK.

## Implementation Steps

1. **Calibrate against a real IDML file before writing any emitter.** Obtain a reference `.idml` containing one page, one rectangle, one text frame and one placed image — via the connected `indesign` MCP server, or from a file the user supplies. Unzip it and record, in a new `App/tests/fixtures/idml/REFERENCE.md`: the exact `idPkg` namespace URI, the exact `designmap.xml` element names and order, the `Page`/`Spread` attribute shapes including `GeometricBounds` and `ItemTransform`, the `Rectangle`/`TextFrame`/`PathGeometry` attribute shapes, and the `Story` structure. **This file becomes the binding contract for steps 3-6.** Do not proceed on the user's sketch or on recalled knowledge; both are unverified. If no reference can be obtained, stop and report — this is a Stop Condition, not a step to improvise past.
2. **Package writer** (`idml/package.ts`). `writeIdmlPackage(entries)` → `Uint8Array` via `zipSync`, with `mimetype` inserted **first** as `[bytes, { level: 0 }]`, exactly as `fig/compress.ts:15-21`. Test first: unzip the result and assert the first entry is `mimetype`, that it is stored, and that its content is `application/vnd.adobe.indesign-idml-package`.
3. **XML layer** (`idml/xml.ts`). Re-export `svg()` as `el()` and `renderSVGNode()` as `renderXml()` from `svg/node.ts`. Add nothing else. If a case appears that the existing escaper cannot handle (CDATA for story text, most likely), extend `svg/node.ts` minimally and note it — do not fork the file.
4. **Target resolution and preflight** (`idml/export.ts`). Implement `resolveIdmlFrames(graph, target)` per Fixed Decision 2, `collectIdmlFallbackReasons(graph, frameIds)` per Decision 7 modelled on `print.ts:84-115`, and `preflightIdmlExport(graph, target, documentDpi?)` returning the same `{ valid, errors, warnings, rasterFallback, rasterFallbackReason }` shape `preflightPrintPDF` returns, so the panel can consume both through one code path.
5. **Geometry and styles** (`idml/geometry.ts`, `idml/styles.ts`). Node → `PathGeometry` in page-local points using `graph.getAbsolutePosition()` and `ptPerPx`, reading `fillGeometry`/`vectorNetwork` the way `svg/paths.ts` does. Swatch collection per Decision 8, font collection per Decision 10, both keyed deterministically per Decision 11.
6. **Stories** (`idml/stories.ts`). One story per `TEXT` node; `styleRuns` become `<CharacterStyleRange>` runs; `textAlignHorizontal`/`lineHeight`/`letterSpacing`/`fontSize` become the paragraph style's attributes.
7. **Assemble and register.** `renderNodesToIdml(graph, target, options, context)` produces every part and calls the package writer. Register `idmlFormat` in `formats.ts` per Decision 1 with a lazy `await import('./formats/idml')`, and re-export the public symbols from `packages/core/src/io/index.ts`.
8. **Widen the format id.** `ExportFormatId` in `packages/scene-graph/src/types.ts:290`; `isExportFormatId` in `plugin-data.ts:165-169` (add both `'idml'` **and** the missing `'pdf-print'`); `EXPORT_FORMATS` in `packages/vue/src/document/export/helpers.ts:12`.
9. **UI.** `ExportSection.vue` per the Visual Contract: `hasAnyFrameTarget`, the pushed option, and `pdfPrintPreflight` widened into `exportPreflight`. `panels.ts` gains `exportIdml`.
10. **Engine tests** (`tests/engine/io/formats/idml-export.test.ts`, following `pdf-print.test.ts`'s harness): package structure and entry order; page count equals frame count; page dimensions in pt equal `frame.width * 72 / dpi` for a 300 dpi document and for a non-default dpi; margins and bleed reach page setup; a solid-filled rectangle produces a swatch and a `PathGeometry`; a text node produces a story containing its exact text; an image fill embeds bytes from `graph.images`; a node with a visible `DROP_SHADOW` produces an embedded raster **and** a warning naming that node; a document with no frames produces a preflight error; and **two exports of the same graph are byte-identical**.
11. **Byte-equality regression.** Extend the existing "T-008 Byte Equality Regression" pattern in `tests/engine/io/formats/pdf-print.test.ts`, or add the equivalent to the new file, proving `renderNodesToPDF` and `renderNodesToPrintPDF` output is unchanged by this packet.
12. **E2E** (`tests/e2e/export/idml.spec.ts`, modelled on `export/pdf-print.spec.ts`): with two frames on the page, `IDML` is selectable; the export button is enabled; `forceBlobDownload()` then export yields a download whose name ends `.idml` and whose bytes start with `PK`; with a background-blurred node present, a warning row appears in `export-preflight-warnings`; with no frame present, `IDML` is not offered.
13. **Docs and changelog.** `packages/docs/user-guide/exporting.md` gains an IDML section stating plainly: one page per frame, embedded images, fonts referenced not embedded, RGB only, what rasterises and why, and that IDML is interchange rather than a save format. One `CHANGELOG.md` entry.
14. **Confirm in the real applications.** Open one exported `.idml` in InDesign and one in Affinity Publisher. Record for each: opens without a repair prompt; page count and page size; that a text frame is editable text; that an image is present; and any missing-font prompt. Report both results, including failures.

## Acceptance Criteria

- [ ] `App/tests/fixtures/idml/REFERENCE.md` exists and records the calibrated namespace, element names and attribute shapes actually observed in a real `.idml`.
- [ ] `idmlFormat` is registered in `BUILTIN_IO_FORMATS` with `id: 'idml'`, no `exportDocument`, and `exportOptions.scale === false`; the Export panel shows no scale control for it.
- [ ] The produced file's first ZIP entry is `mimetype`, stored uncompressed, containing exactly `application/vnd.adobe.indesign-idml-package`.
- [ ] Every part named in the reference is present and is well-formed XML; `designmap.xml` references every part it declares.
- [ ] N target frames produce N pages, each with `GeometricBounds` matching `frame.width/height × 72 / dpi`, verified at 300 dpi and at one non-default dpi.
- [ ] Margins and bleed from `parseFrameGuides` reach page setup and are not drawn as artwork.
- [ ] Rectangles, ellipses, polygons and paths arrive as native items with RGB swatch fills and solid strokes; text arrives as editable text with its exact string; images arrive embedded.
- [ ] Every rasterised node is named in `preflight.warnings`; no node is rasterised without a warning.
- [ ] Exporting a page with no frames produces a preflight **error** and a disabled export button.
- [ ] Two exports of an unchanged graph produce byte-identical output.
- [ ] `renderNodesToPDF` and `renderNodesToPrintPDF` outputs are byte-identical to before this packet.
- [ ] A `.fig` saved with an `idml` export row reopens with that row intact; the same is now true for `pdf-print`.
- [ ] No new npm dependency; `package.json` and `bun.lock` are unchanged.
- [ ] One exported file has been opened in **both** InDesign and Affinity Publisher, with the observations recorded.

## Verification

Run from `App/`:

1. `bun test ./tests/engine/io/formats/idml-export.test.ts` — exit `0`.
2. `bun test ./tests/engine/io/formats/pdf-print.test.ts ./tests/engine/io/formats/pdf-import.test.ts` — exit `0`, unchanged counts.
3. `bun test ./tests/engine/io/fig/roundtrip/export-settings.test.ts` — exit `0`.
4. `bunx tsgo --noEmit` — exit `0`.
5. `bunx vue-tsc --noEmit -p tsconfig.json` and `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` — exit `0`.
6. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/io/ packages/scene-graph/src/types.ts packages/vue/src/document/export/ src/components/properties/ExportSection.vue src/app/document/export/` — exit `0`.
7. `bunx playwright test tests/e2e/export/idml.spec.ts tests/e2e/export/pdf-print.spec.ts tests/e2e/export/basic.spec.ts --project=openpencil` — exit `0`.

Do not run `bun run check`, `bun run test`, or `bun run test:unit`. `bun run check:i18n` does not exist.

## Stop Conditions

- Stop at Step 1 if no reference `.idml` can be obtained. Emitting a package from an unverified sketch produces a file that fails silently in both applications, and no amount of later testing recovers the lost calibration.
- Stop if the generated package will not open in **both** InDesign and Affinity Publisher. A file only one of them accepts does not meet the request; report which one failed and how, and let the user decide.
- Stop if faithful geometry requires changing `svg/paths.ts` or the shared geometry seam rather than reading from it — that is a different packet.
- Stop if `svg/node.ts` cannot serialise a required IDML construct without being restructured. Note it and report; do not fork the emitter into a second XML implementation.
- Stop if widening `ExportFormatId` breaks any existing `.fig` round-trip test in a way the `isExportFormatId` fix does not resolve.
- Stop if any existing exporter's bytes change.
- Stop and report if the work needs a file outside Allowed Changes, a new dependency, or a desktop build.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (revision 2, expanded 2026-08-17 against live source; split from the combined stub, import moved to T-064. Reuses `pdf/print.ts` wholesale as precedent — `resolveTargetFrame`, `collectFallbackReasons`, `preflightPrintPDF`, `ptPerPx = 72/dpi`, `parseFrameGuides` bleed, `renderNodesToImage` fallback — and needs **no new dependency**: `fflate.zipSync` already writes stored entries (`fig/compress.ts:15-21`) and `svg/node.ts` is a format-agnostic escaped-XML emitter. Fixed at one page per frame, embedded images, RGB swatches, deterministic output. Alternate Layouts rejected with reasons (Affinity has no such feature). **Found a live defect it must fix:** `isExportFormatId` (`plugin-data.ts:165-169`) omits `'pdf-print'`, so any `.fig` saved with a pdf-print export row loses every export row on reopen. Step 1 is a hard gate — calibrate against a real `.idml` before emitting anything)
