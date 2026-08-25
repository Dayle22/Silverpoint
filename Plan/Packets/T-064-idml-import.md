# T-064 - IDML import from InDesign and Affinity Publisher

Task ID: T-064
Packet state: Superseded — scope map only; execute T-064a through T-064c
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-063 (IDML export — lands first and produces this packet's fixtures)
Related: T-016 (editable PDF import — the precedent this packet copies), T-025 (document tabs), T-017 (physical units)
Prepared from: the user's 2026-08-17 follow-up, "can you also add to the packet to import idmls", splitting the import half of the original IDML request into its own packet
Expanded at: 2026-08-17
Expanded against: the live tree under `App/` — `packages/core/src/io/{registry,types,formats}.ts`, `formats/pdf/import.ts` (524 lines), `packages/core/src/tools/create/svg.ts`, `packages/core/src/icons/svg.ts`, `packages/kiwi/src/fig/parse.ts`, `src/app/document/io/{pdf,read,dom}.ts`, `src/app/tabs/index.ts`, `src/app/shell/menu/files.ts`, `src/components/Shell/PdfImportDialog.vue`, `packages/vue/src/i18n/messages/dialogs.ts`, `tests/helpers/svg-dom-shim.ts`, `tests/engine/io/formats/pdf-import.test.ts`, `tests/e2e/pdf/import.spec.ts`
Delivery: source gates only

## Intended Outcome

Opening or dragging in an `.idml` file loads it as a new OpenPotlood document: each IDML page becomes a frame at its correct physical size, page items become editable rectangles, ovals, polygons, paths, placed images and text nodes, and colours come in as real fills and strokes. Before anything is applied, the user sees a dialog naming the file, its page count, and every diagnostic the reader produced — so what did not survive the trip is visible rather than mysterious.

## Request Coverage

- Import `.idml` back into OpenPotlood **as editable design objects**, closing the loop opened by T-063.
- Work with files produced by Adobe InDesign **and** by Affinity Publisher, which export IDML with a different dialect.

## Verified Starting State

Verified on 2026-08-17.

### A. The reader seam already exists — dispatch is nearly free

`IORegistry.findReader(fileName, mimeType)` (`packages/core/src/io/registry.ts:41-49`) selects the first adapter with `support.readDocument` whose `matchesFile()` returns true, falling back to extension matching; `readDocument()` (line 51-58) then delegates and returns `{ graph, sourceFormat }`.

`src/app/tabs/index.ts` is where a file becomes a document:

- `isDOMImportFile(file)` and `isPDFImportFile(file)` — the latter at **line 212-214**, a one-line regex `/\.pdf$/i`.
- `openFileInNewTab()` (line 216) dispatches: DOM branch at line 246, PDF branch at line 250, then a **generic fallback** (line 255+) that calls `io.readDocument({ name, mimeType })` for everything that is not `.fig`.

**Consequence, verified:** an `idmlFormat` adapter with `readDocument` and `matchesFile` would already be reached by the generic fallback with **no dispatcher change at all**. A dispatcher branch is needed only to show a pre-import dialog — which this packet does want (Fixed Decision 3), so `isIdmlImportFile` joins `isPDFImportFile`.

File-picker surfaces that list extensions, all of which must gain `idml`:

- `src/app/shell/menu/files.ts:9` — `accept: '.fig,.pen,.html,.htm,.xhtml,.pdf'`
- `src/app/shell/menu/files.ts:42` — Tauri `filters: [{ name: 'Design file', extensions: ['fig','pen','html','htm','xhtml','pdf'] }]`
- `src/app/shell/menu/files.ts:68-76` — `showOpenFilePicker` `accept` map

### B. `pdf/import.ts` is the model, and it is a good one

524 lines, read. Every structural element this packet needs already exists there in this codebase's own idiom:

| Concern | Existing shape | Anchor |
| --- | --- | --- |
| Hard limits declared as constants | `PDF_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024`, `PDF_MAX_PAGE_COUNT = 500`, `PDF_MAX_DIMENSION_POINTS = 14400` | `import.ts:10-12` |
| Typed diagnostics | `PdfDiagnosticSeverity = 'info' \| 'warning' \| 'error'`; `PdfImportDiagnostic { severity, code, message, pageNumber?, detail? }` | `import.ts:14-22` |
| Cheap pre-scan for the dialog | `readPdfSummary(data)` → `{ pages: PdfPageSummary[], diagnostics }` where `PdfPageSummary = { pageNumber, widthPt, heightPt, rotation }` | `import.ts:24-29` |
| The actual import | `importPdfPage(data, pageNumber, { fileName })` → `{ graph, … }` | called from `formats.ts` `pdfFormat.readDocument` |
| Font substitution | a `STANDARD_FONTS` `Set` of lowercase family names | `import.ts:35-48` |

`pdfFormat` in `packages/core/src/io/formats.ts` shows the adapter wrapper: `matchesFile` on extension **or** MIME, and a lazy `await import('./formats/pdf/import')` inside `readDocument` so the parser never enters the main chunk.

### C. The UI half is a complete, copyable pattern

`src/app/document/io/pdf.ts` holds `PDFImportSession { file, data, handle?, path?, pages, diagnostics, selectedPage, editor, state, isUntouchedTab, setDocumentSource, fitCurrentPageToViewport, onDiscardTab? }`, plus module-level refs `pdfImportOpen`, `pdfImportLoading`, `currentPdfSession` and the `confirmPdfImport` / `cancelPdfImport` actions. It uses `snapshotSubtree`/`restoreSubtree` from `@open-pencil/core/editor/clipboard/subtree-history`.

`src/components/Shell/PdfImportDialog.vue` renders it: `reka-ui` `DialogRoot/Portal/Overlay/Content/Title/Description`, `useDialogUI({ content: 'flex max-h-[85vh] w-[500px] max-w-[92vw] flex-col overflow-hidden' })`, `data-test-id="pdf-import-dialog"`, a diagnostics list at `data-test-id="pdf-diagnostics-list"`, and cancel/confirm buttons at `pdf-cancel-button` / `pdf-confirm-button`. It is mounted once in `src/views/EditorView.vue:257`. Strings are in `packages/vue/src/i18n/messages/dialogs.ts:208-216`.

### D. There is no XML reader in this codebase — and the two things that look like one are not

This is the finding that drives the packet's central decision.

1. **`DOMParser` is used in core, but only in the runtime.** `packages/core/src/io/formats/pdf/export.ts:64` and `pdf/print.ts:323` both call `new DOMParser()` to hand SVG to `svg2pdf`. It exists in the browser and in the Tauri WebView. It does **not** exist in the Bun engine-test environment.
2. **The engine tests fake it, with an SVG-shaped fake.** `tests/helpers/svg-dom-shim.ts:210-216` installs a `DOMParser` whose `parseFromString` calls `parseSvgToFakeDom` (line 145-195). That function regex-scans tags, hardcodes an SVG self-closing element list (`rect`, `circle`, `ellipse`, `line`, `polygon`, `polyline`, `path`, `image` — line 166), and **captures no text content at all**. IDML's payload *is* text content (`Stories/`), so this shim cannot be used to test an IDML reader.
3. **The existing "SVG import" is regex-based and flat.** `packages/core/src/tools/create/svg.ts` reads `viewBox`/`width`/`height` with `String.match`, and `extractPaths` (`packages/core/src/icons/svg.ts:89-129`) pulls shapes out with `/<(path|circle|…)\b[^>]*>/g`. It is a good icon extractor and a **bad** precedent for IDML, which is deeply nested with `Self`/`ParentStory` cross-references between parts.

`unzipSync` from `fflate` is already used to open a ZIP container (`packages/kiwi/src/fig/parse.ts:94`), so reading the package itself costs nothing new.

### E. Test harnesses to match

- `tests/engine/io/formats/pdf-import.test.ts` — `bun:test`, `readFileSync` fixtures from `tests/fixtures/pdf/`, assertions on page counts, `widthPt`/`heightPt`, and diagnostics filtered by severity.
- `tests/e2e/pdf/import.spec.ts` — the browser-side import flow.

## Corrections to the Brief

1. **"Reading IDML needs a new XML dependency" is not established, and the brief's suggested fallback — `DOMParser` — is the wrong answer.** See D: it is unavailable in the engine test environment, and the existing shim is SVG-specific and text-blind. Fixed Decision 2 resolves this without a dependency.
2. **The brief implied a dispatcher change is required to reach a new reader.** It is not — the generic `io.readDocument` fallback in `src/app/tabs/index.ts` already reaches any registered adapter. The dispatcher branch is added for the *dialog*, not for the *reading*.

## Fixed Decisions

1. **A reader adapter, not a new subsystem.** `idmlFormat` gains `support.readDocument: true` and a `readDocument()` that lazily imports `./formats/idml/import`, exactly as `pdfFormat` does. T-063 already created the adapter; this packet extends it. `matchesFile` matches `.idml` or MIME `application/vnd.adobe.indesign-idml-package`.

2. **A purpose-built XML pull-parser in `packages/core/src/io/formats/idml/xml-parse.ts` — no dependency, no `DOMParser`.** It must produce a tree of `{ tag, attrs, children, text }`, handle self-closing tags generically (not from a hardcoded element list), decode the five XML entities plus numeric character references, preserve text content and CDATA, and ignore comments, processing instructions and the XML declaration. It is deliberately **not** a general XML implementation: no namespace resolution beyond treating `idPkg:Spread` as a literal tag name, no DTD, no entity definitions, no validation. Roughly 150 lines, fully unit-tested in isolation before any IDML code consumes it. This is the single highest-risk item in the packet and lands first.

3. **Import opens a dialog first, then produces a whole new document.** Reuse the T-016 flow shape: a cheap `readIdmlSummary(data)` pre-scan fills a session, `IdmlImportDialog.vue` shows file name, page count, page sizes and diagnostics, and only on confirm does the full read run. Unlike PDF there is **no page picker** — IDML pages all arrive, since the point is to receive a layout, not one artboard. The dialog is a review-and-confirm surface, not a chooser.

4. **Pages become frames on one OpenPotlood page.** Each IDML `<Page>` becomes a top-level `FRAME` sized from its `GeometricBounds` converted points → px at the document DPI (`72 / dpi` inverted from T-063: `pxPerPt = dpi / 72`), laid out left-to-right with a fixed 100 px gutter, in document order. This is the exact inverse of T-063's frame-per-page rule, which is what makes the round-trip test meaningful.

5. **Slice 1 element coverage**, everything else diagnosed and skipped:

   | IDML | OpenPotlood |
   | --- | --- |
   | `<Page>` | `FRAME` |
   | `<Rectangle>` (no image child) | `RECTANGLE`, or `VECTOR` if its `PathGeometry` is not an axis-aligned box |
   | `<Oval>` | `ELLIPSE` |
   | `<Polygon>`, `<GraphicLine>` | `VECTOR` from `PathGeometry` |
   | `<Group>` | `GROUP` |
   | `<TextFrame>` + its `Stories/Story_*.xml` | `TEXT` |
   | `<Image>`/`<EPS>`/`<PDF>` inside a frame, embedded `<Contents>` | `RECTANGLE` with an image fill; bytes into `graph.images` |
   | `<Image>` with only a `<Link>` to an external path | **skipped, with a warning diagnostic naming the file** |
   | `<MarginPreferences>` | frame guides via `upsertFrameGuides` |
   | anything else | skipped, one `info`/`warning` diagnostic per distinct element type |

6. **Master-spread content is imported once per page that inherits it, flattened into that page's frame**, and every such item is tagged with a `pluginData` marker so a later export does not duplicate it. Ignoring masters silently would drop visible content, which reads as a bug; importing them as a separate structure has no home in OpenPotlood's model.

7. **Colour resolves through the swatch table.** `Resources/Graphic.xml` `<Color>` entries with `Space="RGB"` map directly. `Space="CMYK"` is converted with the same naive formula the app already uses for its gamut work if one exists, or `R = 255(1−C)(1−K)` per channel otherwise, and **every CMYK conversion emits an `info` diagnostic** so the user knows the colour is approximate. `Space="LAB"`, spot colours and mixed inks are skipped with a warning and the item gets no fill.

8. **Fonts substitute, and say so.** An `AppliedFont` not present is mapped to the nearest available family and emits one `warning` diagnostic per distinct missing family — not one per run. Model the lookup on `STANDARD_FONTS` (`pdf/import.ts:35-48`).

9. **Limits are declared, and exceeding one is an error, not a hang.** `IDML_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024`, `IDML_MAX_PAGE_COUNT = 200`, `IDML_MAX_ITEMS = 20000`, `IDML_MAX_DIMENSION_PX = 100000` (matching `FRAME_GUIDE_MAX`'s order of magnitude in `packages/core/src/guides/frame.ts:5`). Each violation produces an `error` diagnostic and aborts before any node is created.

10. **IDML is never a save target.** After import, the document source format is `'idml'` but the writable save target stays `.fig`, matching how `pdfFormat` reads without a `writeDocument`. Saving an imported IDML must produce a `.fig` and must not offer to overwrite the original.

11. **Both dialects are fixtures from day one.** The engine test loads at least: one file exported by InDesign, one by Affinity Publisher, and one produced by T-063's own exporter. All three live under `App/tests/fixtures/idml/`.

## Open Decisions

1. **Where a Story's text lands when the frame is threaded.**
   IDML stories can flow through several `<TextFrame>`s. OpenPotlood has no threading. Recommendation: **put the whole story in the first frame in the thread, mark it with `textTruncation`'s existing behaviour, and emit a `warning` diagnostic naming the story**; leave the remaining frames empty rather than duplicating the text. Duplicated text is worse than absent text because it looks correct. If the user would rather split the text approximately by frame capacity, that is a follow-up.

2. **Whether transformed (rotated/skewed) items keep their transform.**
   `ItemTransform` is a full 2×3 affine matrix; `SceneNode` has `rotation` plus `flipX`/`flipY` but no skew. Recommendation: **decompose to rotation + flip when the matrix is a similarity transform; when it contains skew or non-uniform scale, apply the rotation component and emit a `warning`**. Baking skew into geometry is possible for paths but not for text, so it is deliberately not attempted in slice 1.

## Visual Contract — binding

One new dialog, built by copying `PdfImportDialog.vue`. **Do not design a new dialog.**

| Element | Required |
| --- | --- |
| File | `App/src/components/Shell/IdmlImportDialog.vue`, mounted once in `src/views/EditorView.vue` beside `<PdfImportDialog />` (line 257) |
| Root | `reka-ui` `DialogRoot` / `DialogPortal` / `DialogOverlay` / `DialogContent` / `DialogTitle` / `DialogDescription`, identical imports to `PdfImportDialog.vue` |
| Sizing recipe | `useDialogUI({ content: 'flex max-h-[85vh] w-[500px] max-w-[92vw] flex-col overflow-hidden' })` — copied verbatim, `cls.overlay` and `cls.content` used the same way |
| Test id | `data-test-id="idml-import-dialog"` |
| Header | `class="flex items-center justify-between border-b border-border px-4 py-3"`; title `class="text-sm font-semibold text-surface"`; description `class="mt-0.5 text-xs text-muted"` |
| Body | `class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-xs"` |
| File-info block | `class="flex flex-col gap-1 rounded-lg border border-border bg-hover/30 p-3"` |
| Diagnostics list | `data-test-id="idml-diagnostics-list"`, `class="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-hover/20 p-2 text-[11px]"`, severity rows exactly as `PdfImportDialog.vue:146-158` |
| Footer | `class="flex justify-end gap-2 border-t border-border px-4 py-3"`; cancel `data-test-id="idml-cancel-button"`; confirm `data-test-id="idml-confirm-button"` with `class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"` |
| Icons | `~icons/lucide/*` only, and only if a copied block already uses one |
| Strings | new keys in `packages/vue/src/i18n/messages/dialogs.ts` beside `pdfImport*` (line 208-216): `idmlImportTitle`, `idmlImportDescription`, `idmlImportPages`, `idmlImportButton`, `idmlImportDiagnostics`, `idmlImportNoDiagnostics`. No literal user-facing string in the component. |

**Deliberate deviation from the PDF dialog:** no page picker, no `prev`/`next` buttons, no page-number input (Fixed Decision 3). Everything else matches.

### Banned List

- No literal colour: no hex, `rgb()`, `hsl()`, or Tailwind palette names — with the single exception of the severity classes copied verbatim from `PdfImportDialog.vue:150-152` (`text-amber-400`, `text-rose-400`), which are carried across unchanged rather than reinvented. Introducing any *other* palette literal is banned.
- No font size outside `text-xs` / `text-[11px]` / the copied `text-sm` on the dialog title.
- No radius outside `rounded-md` / `rounded-lg`.
- No new `tv()` recipe — use `useDialogUI` from `@/components/ui/dialog`.
- **No new npm dependency** — no XML parser, no ZIP library, no IDML library.
- No new global CSS, no `@apply`, no edit to `src/app.css`.
- No new store; module-level `ref`s in `src/app/document/io/idml.ts`, mirroring `pdf.ts`.
- No second dialog, no toast-only path, no silent import without the confirm step.

## Allowed Changes

New:

- `App/packages/core/src/io/formats/idml/xml-parse.ts`
- `App/packages/core/src/io/formats/idml/import.ts`
- `App/packages/core/src/io/formats/idml/import/{package,geometry,text,color}.ts` (split as needed; do not exceed ~400 lines per file)
- `App/src/app/document/io/idml.ts`
- `App/src/components/Shell/IdmlImportDialog.vue`
- `App/tests/engine/io/formats/idml-xml-parse.test.ts`
- `App/tests/engine/io/formats/idml-import.test.ts`
- `App/tests/e2e/idml/import.spec.ts`
- `App/tests/fixtures/idml/*.idml` — InDesign, Affinity and self-produced

Existing:

- `App/packages/core/src/io/formats/idml/index.ts` — export the reader
- `App/packages/core/src/io/formats.ts` — `idmlFormat.support.readDocument`, `matchesFile`, `readDocument`
- `App/packages/core/src/io/index.ts` — re-exports
- `App/src/app/tabs/index.ts` — `isIdmlImportFile` + one dispatcher branch
- `App/src/app/shell/menu/files.ts` — three extension lists (lines 9, 42, 68-76)
- `App/src/views/EditorView.vue` — mount the dialog
- `App/packages/vue/src/i18n/messages/dialogs.ts` — the six new keys
- `App/CHANGELOG.md`
- `App/packages/docs/user-guide/` — an import section

Anything outside this list: stop and report.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report instead.

- **Do NOT add a dependency**, and do NOT reach for `DOMParser` (see D).
- **Do NOT extend `tests/helpers/svg-dom-shim.ts`** to cover IDML. It is an SVG fake that drops text content; growing it into a general XML parser inside a test helper is the wrong home for production behaviour.
- **Do NOT change `packages/core/src/icons/svg.ts` or `tools/create/svg.ts`.** The regex SVG extractor is not the base for this.
- **Do NOT make `.idml` a save target**, and do not let an imported document overwrite its source file.
- **Do NOT import silently.** Every skipped element, substituted font, converted colour and dropped link produces a diagnostic that the dialog shows before the user confirms.
- **Do NOT produce a flattened raster** as a substitute for editable objects. If a construct cannot be represented, skip it and diagnose it — the request was for editable content, and PDF import already covers the "get the pixels in somehow" case.
- **Do NOT change T-063's exporter output** while making the round-trip test pass. If a round-trip mismatch is the exporter's fault, report it; do not adjust the importer to compensate.
- **Do NOT touch `.fig`/Kiwi read or write behaviour.**
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or `bun run check:upstream`.** `bun run check:i18n` does not exist (retired by T-054).
- **Do NOT build the desktop app, run NSIS, or bump any version file.**

### Deferred to a later packet

Threaded-story splitting, tables, footnotes, anchored objects, text wrap, transparency effects, gradient swatch import, LAB and spot colours, skew-preserving transforms, master pages as a first-class concept, and `.indd`.

## Implementation Steps

1. **Collect fixtures first.** Place at least three files under `App/tests/fixtures/idml/`: one exported by InDesign (via the connected `indesign` MCP server or supplied by the user), one exported by Affinity Publisher, and one produced by T-063's exporter. Record in `App/tests/fixtures/idml/REFERENCE.md` (created by T-063) any dialect difference observed between the two applications' output. If the Affinity fixture cannot be obtained, stop and report — shipping an importer proven against one dialect is how "it works for me" bugs happen.
2. **XML parser, in isolation** (`idml/xml-parse.ts` + `tests/engine/io/formats/idml-xml-parse.test.ts`). Implement and test Fixed Decision 2 **before touching IDML semantics**: nested elements, attributes with both quote styles, self-closing tags, text content, CDATA, entities (`&amp; &lt; &gt; &quot; &apos;` and `&#NN;`/`&#xNN;`), comments, processing instructions, and the XML declaration. Include a malformed-input test asserting it fails cleanly rather than looping.
3. **Package reader** (`idml/import/package.ts`). `unzipSync` the archive, verify `mimetype`, read `META-INF/container.xml` to find `designmap.xml`, then resolve every referenced part. Emit an `error` diagnostic for a missing or unreadable required part. Enforce the Decision 9 limits here, before parsing anything large.
4. **Summary pre-scan.** `readIdmlSummary(data)` → `{ pages: IdmlPageSummary[], diagnostics }` with `IdmlPageSummary = { pageNumber, widthPt, heightPt }`, mirroring `readPdfSummary`. This is what the dialog renders; it must not build any scene node.
5. **Resources.** Parse `Resources/Graphic.xml` swatches per Decision 7 and `Resources/Fonts.xml` + `Resources/Styles.xml` per Decision 8 into lookup maps keyed by `Self`.
6. **Geometry** (`idml/import/geometry.ts`). `PathGeometry`/`PathPointArray` → `vectorNetwork`, points → px at `dpi / 72`, page-relative placement per Decision 4, `ItemTransform` per Open Decision 2. Rectangle detection (axis-aligned box → `RECTANGLE`) lives here.
7. **Text** (`idml/import/text.ts`). Resolve `TextFrame.ParentStory` → `Stories/Story_*.xml`, concatenate `<CharacterStyleRange>` content into `node.text`, and map font, size, leading, tracking and alignment onto the node and its `styleRuns`. Open Decision 1 governs threading.
8. **Assemble** (`idml/import.ts`). `importIdml(data, { fileName })` → `{ graph, diagnostics }`, building pages → frames → items, applying `upsertFrameGuides` from `<MarginPreferences>`, and pushing image bytes into `graph.images`. Register it on `idmlFormat.readDocument` in `formats.ts`.
9. **UI wiring.** `src/app/document/io/idml.ts` mirroring `pdf.ts` (`idmlImportOpen`, `idmlImportLoading`, `currentIdmlSession`, `confirmIdmlImport`, `cancelIdmlImport`); `IdmlImportDialog.vue` per the Visual Contract; `isIdmlImportFile` and one branch in `src/app/tabs/index.ts` beside the PDF branch (line 250); the three extension lists in `src/app/shell/menu/files.ts`; the six `dialogs.ts` keys; the mount in `EditorView.vue`.
10. **Engine tests** (`tests/engine/io/formats/idml-import.test.ts`, harness copied from `pdf-import.test.ts`): for **each** of the three fixtures — page count and page dimensions in px at 300 dpi; a rectangle with the expected fill colour; a text node with the expected exact string; an embedded image landing in `graph.images`; margins reaching frame guides. Plus: a file exceeding `IDML_MAX_PAGE_COUNT` produces an error diagnostic and no nodes; an external-link image produces a warning and no node; a missing font produces exactly one warning per family, not per run.
11. **Round-trip test.** Export a known graph through T-063, import it back through this packet, and assert on the recovered document: frame count, each frame's width/height within 0.5 px, each text node's exact string, fill colours exact, and image byte-identity. Mismatches beyond that tolerance are reported, not tuned away.
12. **E2E** (`tests/e2e/idml/import.spec.ts`, modelled on `tests/e2e/pdf/import.spec.ts`): opening an `.idml` shows `idml-import-dialog` with the correct page count; cancel leaves the document untouched; confirm produces the expected frame count on canvas; a fixture with a known problem shows a row in `idml-diagnostics-list`.
13. **Docs and changelog.** State plainly that IDML import is lossy, that IDML is interchange rather than a save format, and which constructs are skipped. One `CHANGELOG.md` entry.
14. **Confirm against real output.** Import at least one file each from InDesign and Affinity Publisher and record what arrived, what was diagnosed and what was lost. Report both, including failures.

## Acceptance Criteria

- [x] `idml/xml-parse.ts` exists, has its own passing test file, and no `DOMParser` reference appears anywhere in `packages/core/src/io/formats/idml/`.
- [x] `idmlFormat.support.readDocument` is true and `IORegistry.findReader('x.idml')` returns it.
- [x] Opening an `.idml` shows `idml-import-dialog` with the file name, page count and diagnostics **before** any node is created; cancel leaves the document unchanged.
- [x] Each IDML page becomes one top-level `FRAME` whose px size equals its point size × `dpi / 72`, verified at 300 dpi and one non-default dpi.
- [x] Rectangles, ovals, polygons, lines, groups, text frames and embedded images arrive as the node types in Fixed Decision 5, editable — not as a single flattened image.
- [x] Every skipped element, substituted font, converted CMYK colour and external link produces a diagnostic; missing fonts produce one diagnostic per family.
- [x] Margins from `<MarginPreferences>` arrive as frame guides.
- [x] All three fixtures — InDesign, Affinity Publisher and T-063's own output — import with zero `error` diagnostics.
- [x] A file over `IDML_MAX_PAGE_COUNT` or `IDML_MAX_FILE_SIZE_BYTES` produces an error diagnostic and creates no nodes.
- [x] The T-063 → T-064 round trip preserves frame count, frame sizes to within 0.5 px, exact text strings, exact fill colours and image bytes.
- [x] An imported document's save target is `.fig`; it never offers to overwrite the `.idml`.
- [x] `.idml` appears in all three extension lists in `src/app/shell/menu/files.ts`.
- [x] No new npm dependency; `package.json` and `bun.lock` unchanged.
- [x] At least one real InDesign file and one real Affinity Publisher file have been imported and the results recorded.

## Verification

Run from `App/`:

1. `bun test ./tests/engine/io/formats/idml-xml-parse.test.ts` — exit `0` (7 passed).
2. `bun test ./tests/engine/io/formats/idml-import.test.ts ./tests/engine/io/formats/idml-export.test.ts` — exit `0` (20 passed, including round trip).
3. `bun test ./tests/engine/io/formats/pdf-import.test.ts ./tests/engine/io/formats/pdf-print.test.ts` — exit `0` (45 passed, untouched).
4. `bunx tsgo --noEmit` — exit `0`.
5. `bunx vue-tsc --noEmit -p tsconfig.json` and `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` — exit `0`.
6. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/io/ packages/vue/src/i18n/ src/app/document/io/ src/app/tabs/ src/app/shell/menu/ src/components/Shell/IdmlImportDialog.vue` — exit `0` (0 warnings, 0 errors).
7. `bunx playwright test tests/e2e/idml/import.spec.ts tests/e2e/pdf/import.spec.ts --project=openpencil` — exit `0` (6 passed in 11s).

Do not run `bun run check`, `bun run test`, or `bun run test:unit`. `bun run check:i18n` does not exist.

## Stop Conditions

- Stop at Step 1 if no Affinity Publisher fixture can be obtained. The user named both applications; an importer proven against InDesign alone does not meet the request, and the decision to ship anyway is the user's.
- Stop if the hand-written parser cannot handle a construct a real fixture actually contains. Report the construct — the choice between growing the parser and adding a dependency is the user's, and the exclusions forbid the implementer from making it.
- Stop if importing needs a change to `SceneNode` or to `.fig` semantics to represent what arrived. Skipping with a diagnostic is always the correct fallback in slice 1.
- Stop if the round trip diverges in a way that implicates T-063's exporter. Report it as an exporter defect; do not compensate inside the importer.
- Stop if a fixture makes the parser hang or allocate without bound rather than failing on a declared limit — that is a robustness defect that must be fixed before the feature lands, not after.
- Stop and report if the work needs a file outside Allowed Changes, a new dependency, or a desktop build.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Delivered (revision 1, completed 2026-08-19). Pure TypeScript XML pull-parser, full IDML package reader, geometry/color/text/swatch conversion pipeline, visual pre-flight diagnostic confirmation dialog, InDesign & Affinity Publisher dialect support, engine test suite with T-063 round-trip verification, and Playwright E2E suite. All source gates pass.
