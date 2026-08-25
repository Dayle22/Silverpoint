# T-021 — Deliver production PDF export with crop marks

Task ID: T-021
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-008 (Done), T-017 (units and DPI), T-007 (Done, frame guides/bleed). T-019 and T-020 are **optional** inputs — if they are Done, surface their diagnostics; if not, omit them and say so.
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `packages/core/src/io/formats/pdf/export.ts` (all 74 lines), `packages/core/src/io/formats.ts:256-284`, `src/app/document/export/{create.ts,files.ts,types.ts}`, `packages/core/src/guides/frame.ts`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Intended Outcome

A second PDF export option — "PDF (print)" — produces a page sized to the frame's trim box plus its bleed, with correct `/MediaBox`, `/TrimBox`, `/BleedBox` and `/ArtBox`, and crop marks drawn in the bleed margin. The ordinary PDF export from T-008 keeps producing byte-identical output.

## Verified Starting State

| Path | What is actually there |
| --- | --- |
| `packages/core/src/io/formats/pdf/export.ts:14-16` | `interface PDFExportOptions { title?: string }` — **that is the entire options surface today.** |
| `packages/core/src/io/formats/pdf/export.ts:33-38` | Page size comes from `computeContentBounds(graph, nodeIds)` — the **content** bounding box, not a page or frame. Production output must not use this. |
| `packages/core/src/io/formats/pdf/export.ts:42-47` | `new jsPDF({ orientation, unit: 'pt', format: [width, height], compress: true })`. `format` sets `/MediaBox` only. There is no trim/bleed/art box anywhere. |
| `packages/core/src/io/formats/pdf/export.ts:25-31` | `needsBackdrop` — background blur, mask, adjustment or progressive-blur fallback forces the **whole page** to a single flattened PNG at `scale: 1` (lines 53-62). This is the single biggest production-quality risk in the current exporter. |
| `packages/core/src/io/formats/pdf/export.ts:69` | Vector path is `svg2pdf(svgElement, doc, { x: 0, y: 0, width, height })`. |
| `packages/core/src/io/formats.ts:272-274` | `pdfFormat.exportContent` calls `renderNodesToPDF(..., {}, context)` and **ignores its `_options` argument entirely**. |
| `src/app/document/export/files.ts:76-86` | `getExportOptions(formatId, options)` returns `undefined` for any format other than png/jpg/webp/jsx. |
| `src/app/document/export/types.ts` | `ExportOptions = { scale?, quality?, jsxFormat? }`. |
| `packages/core/src/guides/frame.ts:80-130` | `parseFrameGuides(pluginData)` → margins and bleed per edge, in pixels. **This is where production bleed comes from.** |
| `package.json` | `jspdf ^4.2.1`, `svg2pdf.js ^2.7.0`. No `pdf-lib`. |

## Fixed Decisions — binding

**1. A separate adapter, not a flag on the existing one.** Register a new `pdfPrintFormat` in `packages/core/src/io/formats.ts` with `id: 'pdf-print'`, `label: 'PDF (print)'`, `category: 'print'`, `extensions: ['pdf']`, supporting `exportPage`, `exportSelection` and `exportNode` — **not** `exportDocument`. The existing `pdfFormat` object must not be edited at all. This is what guarantees T-008 output is unchanged; there is a required byte-equality test.

**2. Trim box comes from the frame, not the content.** Production export requires a single target frame:
- `scope: 'node'` or a `scope: 'selection'` of exactly one `FRAME` → that frame is the trim box.
- `scope: 'page'` → if the page has exactly one top-level `FRAME`, use it; otherwise fail with `Production PDF requires a single frame target`.
- Anything else → the same failure. **Do not fall back to `computeContentBounds`.** Content that overhangs the frame is bleed content and is expected.

**3. Bleed comes from the frame's guides.** Read `parseFrameGuides(frame.pluginData)`. Use per-edge bleed values in pixels, converted to points at `72 / documentDpi` (T-017's document DPI). If a frame has no bleed guides, bleed is 0 on all edges and marks sit directly against the trim edge — do not invent a default bleed.

**4. Page boxes, exactly.** With trim `W × H` pt and per-edge bleed `bT, bR, bB, bL` pt, and mark allowance `M = 12 pt`:

| Box | Value |
| --- | --- |
| `/TrimBox` | `[bL + M, bB + M, bL + M + W, bB + M + H]` |
| `/ArtBox` | identical to `/TrimBox` |
| `/BleedBox` | `[M, M, M + bL + W + bR, M + bB + H + bT]` |
| `/MediaBox` | `[0, 0, bL + W + bR + 2M, bB + H + bT + 2M]` |

Artwork is drawn with the frame origin at `(bL + M, bB + M)` in PDF coordinates. Remember PDF's Y axis points up and the scene's points down — convert once, in one function, and test it.

**5. Writing the boxes.** jsPDF sets `/MediaBox` from `format` but exposes no public trim/bleed/art API. In preflight, test **in this order** and record which one worked:
   1. `doc.internal.events.subscribe('putPage', …)` to append the box entries to the page dictionary.
   2. A documented byte post-process over `doc.output('arraybuffer')`, inserting the three entries into the `/Type /Page` dictionary. Page dictionaries are not compressed by `compress: true` (only content streams are), so this is viable — but it must be implemented as a strict, single-match, bounds-checked edit, never a loose regex over the whole file.
   3. If neither works, **stop and report**. Do not add `pdf-lib` or any other dependency to route around it.

**6. Crop mark geometry — fixed, no invention.** Drawn as vector lines via jsPDF's line API, in `0.25 pt` stroke, 100% black (`0,0,0`), four L-shaped pairs, one per corner:
- Each mark is `8 pt` long.
- Marks start `3 pt` outside the trim edge and run outward, so they never touch artwork or the bleed area's inner edge.
- Horizontal and vertical marks per corner are drawn as separate line segments; no diagonal marks, no registration targets, no colour bars, no page information block. Those are printer-specific and out of scope.
- Marks are drawn **after** the artwork so they are never overprinted by a raster fallback.

**7. Marks are opt-in, boxes are not.** `PrintPDFExportOptions`:

```ts
export interface PrintPDFExportOptions {
  title?: string
  cropMarks?: boolean          // default true
  documentDpi: number          // required; from T-017
  includeBleedContent?: boolean // default true
}
```

Page boxes are always written for `pdf-print`. `includeBleedContent: false` clips rendering at the trim box.

**8. Raster fallback must be reported, not silent.** The `needsBackdrop` path flattens everything to a `scale: 1` PNG — at 300 DPI production that is roughly a quarter of the needed resolution. For `pdf-print`:
- Render the fallback PNG at `scale: documentDpi / 72` instead of `1`.
- Return the fallback reason with the result so the UI can show it: which nodes forced it (background blur / mask / adjustment / progressive blur).
- Never silently ship a flattened production PDF. The export UI must display "Rasterised because: …" whenever the fallback ran.

**9. Preflight is advisory.** Collect warnings and show them **before** the file is written: raster fallback (per #8), effective DPI below threshold if T-020 is Done, out-of-gamut colours if T-019 is Done, and any frame whose bleed is 0 while content overhangs the trim edge. Only these hard errors block: no single frame target, non-finite or non-positive trim dimensions, `MediaBox` exceeding the PDF limit of 14 400 pt on either axis, and page-box write failure.

**10. Options plumbing.** Extend `ExportOptions` in `src/app/document/export/types.ts` and the `getExportOptions` switch in `files.ts:76-86` to pass `pdf-print` options through. The `pdf` branch of that switch must keep returning `undefined`.

## Restrictions and Exclusions

- Do not modify `pdfFormat`, `renderNodesToPDF`'s existing signature behaviour for its current callers, or any raster/SVG exporter.
- No imposition, trapping, creep, printer-driver integration, ICC embedding, CMYK conversion, overprint control, or spot colours.
- No compliance claim — never write PDF/X, ISO, or a press standard into a string, comment or filename.
- No changes to `.fig`, the scene graph, or the undo stack.
- No `MobileHud/`, dashboard, `showUI=false` or `?no-chrome` changes.

### Banned List — none of these may appear in the diff

- No new npm dependency — not `pdf-lib`, not `pdfkit`, not an ICC library.
- No edit to the `pdfFormat` object literal in `formats.ts`.
- No loose regex over the whole PDF byte output.
- No hardcoded bleed default substituted when a frame has no bleed guides.
- No silent raster fallback — the reason must reach the UI.
- No literal colour in UI code — semantic tokens only. The mark colour in PDF space is the sole exception and is fixed at black by Fixed Decision #6.
- No font-size class other than `text-xs` or `text-[11px]`; no radius other than `rounded-md` / `rounded-lg`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English — all eight locales, gated by `bun run check:i18n`.

## Implementation Steps

1. Read `pdf/export.ts` end to end — it is 74 lines, read all of them — plus `formats.ts:256-284` and `export/files.ts:76-101`.
2. **Preflight the page-box mechanism first** (Fixed Decision #5) with a throwaway script before writing any feature code. If neither route works, stop here and report; everything else in this packet depends on it.
3. Create `packages/core/src/io/formats/pdf/print.ts` with `renderNodesToPrintPDF`, the box maths from Fixed Decision #4, and the mark geometry from #6. Reuse the existing SVG and raster paths; do not fork them.
4. Register `pdfPrintFormat` in `formats.ts` as a **new object**, added to the adapter array beside `pdfFormat`.
5. Plumb options through `ExportOptions` and `getExportOptions`.
6. Add the preflight warning surface to the export UI, including the mandatory raster-fallback reason.
7. Add i18n defaults and all eight locales.
8. Add `tests/engine/io/formats/pdf-print.test.ts`:
   - **T-008 byte equality** — export a fixture through `pdf` before and after this packet's changes; assert identical bytes. This is the most important test in the packet.
   - Page-box arithmetic for symmetric bleed, asymmetric per-edge bleed, and zero bleed, asserted against hand-computed point values.
   - Y-axis flip correctness: a node at the frame's top-left appears at the top-left of the PDF page.
   - The four box entries are present in the output bytes and numerically correct.
   - Crop marks present when `cropMarks: true`, absent when `false`, and never inside `TrimBox`.
   - Multi-frame page target and empty target both fail with the specified error.
   - `MediaBox` over 14 400 pt is rejected.
   - Raster fallback reports its reason and renders at `documentDpi / 72`.
9. Add Playwright coverage in `tests/e2e/export/`: "PDF (print)" appears for a single-frame selection and not for a multi-frame one; preflight warnings render; a file is produced.
10. Open at least one generated file in an external PDF reader and record what it showed. An automated structure test is not proof that a real reader accepts the file.
11. Run, in this order, and paste exact exit codes:
    - `bunx tsgo --noEmit --pretty false`
    - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
    - focused `oxlint -c oxlint.json` on the changed files only
    - `bun run check:i18n`
    - `bun test ./tests/engine/io/`
    - the focused Playwright spec with `--project=openpencil`

    Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
12. Stop at source gates. No build, no install, no version bump.

## Acceptance Criteria

- [ ] `pdf-print` produces correct `/MediaBox`, `/TrimBox`, `/BleedBox` and `/ArtBox` for symmetric, asymmetric and zero bleed.
- [ ] Artwork lands in the right place with the Y axis correctly flipped.
- [ ] Crop marks are correctly placed, opt-out-able, and never overlap the trim area.
- [ ] Ordinary `pdf` export bytes are identical to before this packet.
- [ ] Raster fallback renders at production scale and its reason is visible in the UI.
- [ ] Preflight warnings appear before writing; only the four listed hard errors block.
- [ ] The generated file opens in an external PDF reader, and what it showed is recorded.
- [ ] No compliance or press-standard claim appears anywhere. Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: neither page-box write route in Fixed Decision #5 works; `svg2pdf` cannot place content at a non-zero origin offset for the bleed inset; or the trim frame cannot be resolved without changing `ExportRequest`.

## Revision History

- Revision 1 — 2026-07-24: original expansion.
- Revision 2 — 2026-08-14: re-expanded against the live 74-line exporter. Added the separate-adapter decision that protects T-008, exact page-box and crop-mark geometry, the jsPDF page-box mechanism preflight with its fallback ladder, the production-scale raster fallback with mandatory reporting, and the byte-equality regression test. Removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Executed; repair pass 2026-08-18 cleared the type-aware Oxlint findings in `packages/core/src/io/formats/pdf/print.ts` and `io/formats.ts`, and 4/4 `tests/e2e/export/pdf-print.spec.ts` are green. No new full packet gate was run.
