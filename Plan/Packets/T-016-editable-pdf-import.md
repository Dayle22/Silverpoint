# T-016 — Deliver editable PDF import

Task ID: T-016
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-008 (Done)
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `packages/core/src/io/{registry.ts,types.ts,formats.ts}`, `packages/core/src/io/formats/pdf/export.ts`, `packages/dom-css/src/to-scene-graph.ts`, `src/app/tabs/index.ts:205-290`, `src/app/shell/menu/files.ts`, `src/app/document/io/dom.ts`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Scope warning — read this before starting

This is the largest packet in the plan. A faithful PDF-to-editable-vector importer is a multi-month project in its own right; PDF is a page-description language, not a document model, and nothing in this codebase currently imports vector content from any foreign format.

Revision 2 therefore splits the work into **two stages with a hard checkpoint between them**. Stage A is complete, useful and shippable on its own. **Do not start Stage B in the same session as Stage A, and do not start Stage B without the user's explicit go-ahead.**

## Verified Starting State

| Path | What is actually there |
| --- | --- |
| `packages/core/src/io/registry.ts:41-57` | `IORegistry.findReader(fileName, mimeType)` then `readDocument(input, context)`. **The import seam already exists** — an adapter with `readDocument` is all that is needed to open a new format. |
| `packages/core/src/io/types.ts` | `IOFormatAdapter.readDocument?(input: ReadDocumentInput, context?): Promise<ReadDocumentResult>`, `ReadDocumentInput = { name?, mimeType?, data: Uint8Array }`, `ReadDocumentResult = { graph, sourceFormat }`. |
| `packages/core/src/io/formats.ts:199-217` | `penFormat` — the **exact shape to copy**: `support: { readDocument: true }`, a `matchesFile` guard, and a short `readDocument` that returns `{ graph, sourceFormat }`. |
| `packages/core/src/io/formats.ts:256-284` | `pdfFormat` exists already, **export-only**: `support` has no `readDocument`. This packet adds one to it or registers a sibling. |
| `src/app/tabs/index.ts:256-262` | `openFileInNewTab` already routes every non-`.fig` file through `io.readDocument({ name, mimeType, data })`. **A PDF reader needs no change to the tab-open flow.** |
| `src/app/tabs/index.ts:208-210` | `isDOMImportFile(file)` — the precedent for a format that needs its own pre-route. |
| `src/app/shell/menu/files.ts:9,42,65-77` | **Three** independent extension lists: `useFileDialog({ accept })`, `chooseTauriOpenPath` Tauri filters, and the `showOpenFilePicker` accept map. All three must be updated or the format is unopenable on one of the routes. |
| `packages/dom-css/src/to-scene-graph.ts` | The only existing "foreign document model → `SceneGraph`" converter in the repo. Read it before designing the PDF mapper; follow its structure. |
| `src/app/document/io/dom.ts:73` | `openDOMFile(file, options)` — the precedent for an import route that needs its own options object. |
| `packages/core/src/io/formats/pdf/export.ts` | Export-only, `jspdf` + `svg2pdf.js`. **There is no PDF reader, no PDF parser, and no vector import path of any kind in this repo.** |
| `package.json` | No `pdfjs-dist`, no `pdf-lib`, no `mupdf`. |

## Fixed Decisions — binding

**1. Parser: `pdfjs-dist`, or stop.** The only permitted candidate is `pdfjs-dist` (Apache-2.0, Mozilla). Before adding it, record in the execution report: resolved version, licence text location, installed size, and whether the worker can be bundled locally by Vite without a CDN reference. If any of those is unacceptable, **stop and report** — do not substitute another parser on your own initiative.

**2. Hard security configuration.** The parser is constructed with, at minimum:
- `isEvalSupported: false`
- `disableAutoFetch: true`, `disableStream: true` — operate on the `Uint8Array` already in memory
- No `standardFontDataUrl` or `cMapUrl` pointing anywhere remote; if standard fonts or CMaps are needed they are bundled locally or the affected text falls back per Fixed Decision #6
- The worker resolved from the local bundle, never from a CDN

Never execute embedded JavaScript, never follow an embedded URL, never attempt a password. An encrypted PDF is an immediate, explicit failure with a clear message — no bypass attempt of any kind.

**3. Resource limits, enforced before parsing.** Reject with a specific diagnostic, do not attempt:
- File larger than 100 MB
- More than 500 pages
- A single page whose media box exceeds 14 400 pt on either axis
- Total decompressed content stream over 250 MB
- Parse wall-clock over 30 s per page

**4. One page per import, explicitly chosen.** The user picks exactly one page. Multi-page import, page ranges, and one-page-per-frame layout are all out of scope for this packet. Import creates content in the **current document** through the ordinary node-creation and history path, as a single undoable action.

**5. Never silently lose content.** Every unsupported operator, missing font, unsupported filter, or unmapped construct produces a `PdfImportDiagnostic` entry that reaches the user. A page that imports with 40 unsupported operators must say so. Silence is a bug, not a success.

**6. Text fidelity policy.** Text becomes an editable `TEXT` node **only** when the font resolves to a family available to the app and the character mapping is unambiguous. Otherwise it becomes outlined vector paths with a diagnostic naming the font. Never substitute a different font silently. Never rasterise text that could be outlined.

**7. The document is read-only.** The source `.pdf` is never written, never moved, never used as a save target. After import, the document's save target is `.fig`, exactly as an imported `.pen` or `.html` behaves today.

**8. Purity boundary.** The mapping layer — `packages/core/src/io/formats/pdf/import.ts` — takes bytes and returns `{ graph, diagnostics }`. It imports no Vue, no editor store, no `SkiaRenderer`. All UI lives in `src/app/`. This is what makes the mapper testable against fixtures.

## Stage A — parse, diagnose, place (this is the deliverable)

Stage A adds `readDocument` support for PDF that:
- opens the format on all three file-dialog routes,
- parses the selected page with the limits and security configuration above,
- reports a full diagnostic summary,
- and creates a `FRAME` at the page's exact media-box dimensions containing a **high-resolution rendered image** of the page, plus the extracted text as **selectable, editable `TEXT` nodes positioned over it** where Fixed Decision #6 allows.

That is genuinely useful — correct page size, real editable text, everything visible — and it is honest about what it is. The frame is labelled with the source file and page number, and the diagnostic summary states plainly that graphics are imported as an image.

**Do not describe Stage A output as "editable vectors".** It is not.

## Stage B — vector mapping (do not start without explicit approval)

Stage B replaces the page image with mapped scene nodes: fill/stroke paths, clipping paths as masks, embedded images as image fills, groups from the graphics state stack, transforms, and opacity. It requires a documented feature matrix agreed with the user before any code is written, covering: path construction and painting operators, fill rules, line joins/caps/dashes, colour spaces, shadings and patterns, soft masks, transparency groups, blend modes, inline images, annotations, and form fields.

Stage B's checkpoint deliverable is that matrix, not code. Present it, get agreement, then a Stage B packet or revision defines the implementation.

## Restrictions and Exclusions

- No PDF **export** changes. T-008 owns ordinary export; T-021 owns production export. This packet must not touch `pdf/export.ts` or the `pdfFormat` export path.
- No new document format, no PDF-backed document layer, no "linked PDF" node type.
- No password handling, no JavaScript execution, no network access, no annotation or form-field import.
- No multi-page import, no page ranges, no batch import.
- No changes to `.fig` semantics, tab semantics, or the undo model.
- No `MobileHud/`, dashboard, `showUI=false` or `?no-chrome` changes.

### Banned List — none of these may appear in the diff

- No dependency other than `pdfjs-dist`, and only after Fixed Decision #1's review is recorded.
- No CDN URL, no `fetch`, no `XMLHttpRequest`, no remote font or CMap reference anywhere in the import path.
- No `eval`, no `new Function`, no dynamic code execution.
- No `catch {}` that swallows a parse failure without producing a diagnostic.
- No import of Vue, the editor store, or `SkiaRenderer` inside `packages/core/src/io/formats/pdf/import.ts`.
- No literal colour in UI code — semantic tokens only (`bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`).
- No font-size class other than `text-xs` or `text-[11px]`; no radius other than `rounded-md` / `rounded-lg`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English — all eight locales, gated by `bun run check:i18n`.
- No string anywhere claiming Illustrator, Affinity, or Acrobat equivalence.

## Implementation Steps — Stage A

1. Read `formats.ts:199-217` (`penFormat`), `registry.ts:41-57`, `tabs/index.ts:205-290`, `shell/menu/files.ts`, and `packages/dom-css/src/to-scene-graph.ts` in full before writing anything.
2. Complete the Fixed Decision #1 dependency review and record it. Stop if it fails.
3. Create `packages/core/src/io/formats/pdf/import.ts`:
   ```ts
   export interface PdfImportDiagnostic {
     severity: 'info' | 'warning' | 'error'
     code: string          // stable, machine-readable
     message: string
     pageNumber?: number
     detail?: string
   }
   export interface PdfPageSummary { pageNumber: number; widthPt: number; heightPt: number; rotation: number }
   export async function readPdfSummary(data: Uint8Array): Promise<{ pages: PdfPageSummary[]; diagnostics: PdfImportDiagnostic[] }>
   export async function importPdfPage(
     data: Uint8Array, pageNumber: number, options: { renderScale: number }
   ): Promise<{ graph: SceneGraph; diagnostics: PdfImportDiagnostic[] }>
   ```
   Apply every limit from Fixed Decision #3 in `readPdfSummary`, before any page is touched.
4. Add `readDocument` support for PDF in `formats.ts`, following `penFormat`'s shape exactly. Because a page must be chosen, the adapter's `readDocument` imports **page 1** as the non-interactive default; the interactive page picker lives in the app layer and calls `importPdfPage` directly.
5. Add the page-selection dialog and the diagnostic summary in `src/app/`, following `src/app/document/io/dom.ts` as the structural precedent. It shows page count, page sizes, a page picker, a cancel button, and the diagnostic list.
6. Update **all three** extension lists in `src/app/shell/menu/files.ts`.
7. Add i18n defaults and all eight locale files.
8. Build fixtures under `tests/fixtures/`: a simple vector PDF, a PDF with embedded text in a common font, a PDF with an unusual embedded font, a PDF containing a raster image, an encrypted PDF, a truncated/malformed PDF, a 600-page PDF, and an oversized-page PDF. Record each fixture's SHA-256 in the execution report.
9. Add `tests/engine/io/formats/pdf-import.test.ts`: correct page count and dimensions; the encrypted file fails with the specific error and no bypass attempt; the malformed file fails without throwing an unhandled exception; the 600-page and oversized files are rejected by the limits; text nodes are produced for the resolvable-font fixture; a diagnostic is emitted for the unusual-font fixture; **no test performs any network access.**
10. Add a `.fig` round-trip test: imported content saves and reopens unchanged.
11. Add an export-isolation test: `pdf`, `svg` and `png` export bytes for an unrelated fixture are unchanged by this packet.
12. Add Playwright coverage in `tests/e2e/`: opening a PDF shows the picker; cancelling leaves the document untouched; confirming creates one undoable frame; the diagnostic summary is visible; one Ctrl+Z removes the whole import.
13. Run, in this order, and paste exact exit codes:
    - `bunx tsgo --noEmit --pretty false`
    - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
    - focused `oxlint -c oxlint.json` on the changed files only
    - `bun run check:i18n`
    - `bun test ./tests/engine/io/`
    - the focused Playwright spec with `--project=openpencil`

    Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
14. Stop at source gates. No build, no install, no version bump.
15. **Stop at the Stage A/B checkpoint.** Report what Stage A delivers, then present the Stage B feature matrix for approval. Do not begin Stage B.

## Acceptance Criteria — Stage A

- [ ] `.pdf` opens from all three file-dialog routes (browser input, `showOpenFilePicker`, Tauri dialog).
- [ ] Page count, page dimensions and rotation are reported correctly; the user picks one page; cancel leaves the document untouched.
- [ ] The created frame matches the page media box exactly and is a normal editable `FRAME`.
- [ ] Text is editable where the font resolves, outlined where it does not, and never silently substituted.
- [ ] Every unsupported construct produces a visible diagnostic; nothing is silently dropped.
- [ ] Encrypted, malformed, oversized and over-long PDFs fail with specific messages and no crash.
- [ ] The whole import is one undo step, and the source file is never written.
- [ ] No network access occurs during import; no CDN reference exists in the diff.
- [ ] Imported content survives a `.fig` round-trip; PDF/SVG/PNG export bytes are unchanged.
- [ ] Nothing in the diff claims editable-vector import. Nothing in the Banned List appears in the diff.

## Stop Conditions

- Stop if the `pdfjs-dist` review in Fixed Decision #1 fails on licence, size, or local worker bundling.
- Stop if the worker cannot be bundled without a remote reference.
- Stop if the mapping layer cannot stay free of Vue/editor/renderer imports.
- Stop after two consecutive failures of the same focused test; record exact output and leave the packet `BLOCKED` rather than widening scope.
- Stop at the Stage A/B checkpoint, unconditionally.

## Revision History

- Revision 1 — 2026-07-24: original expansion; treated the work as one undivided delivery and predated knowledge of the `IORegistry` reader seam.
- Revision 2 — 2026-08-14: re-expanded against live source. Recorded that the adapter/reader seam already exists and that no vector import path exists anywhere; split the work into a shippable Stage A and an approval-gated Stage B; fixed the parser choice, security configuration and resource limits; added the three extension lists as an explicit trap; removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-14: Stage A core parser/diagnostics, page dialog, 8-locale i18n, text extraction; Stage B native vector path mapping with graphics state stack, DrawOPS/constructPath support, color space mapping, shape recognition, and embedded image XObject extraction; 16/16 Bun tests and 3/3 Playwright e2e green)
