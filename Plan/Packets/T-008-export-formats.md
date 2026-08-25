# T-008 — Deliver JPEG, PNG, SVG, and PDF export

Task ID: T-008
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-007
Prepared against: T-001 through T-004 VERIFIED evidence, live OpenPotlood 0.1.2 source, T-005 IN PROGRESS/LOCKED, and T-006/T-007 PREPARED contracts; predecessor execution evidence remains pending
Last expanded: 2026-07-19

## Audit result — 2026-07-19

T-007 is DONE/VERIFIED and the project pipeline validator passes. CanvasKit WASM is present, the focused raster/SVG baseline passes `52` tests with `108` assertions, and the export-settings undo E2E passes `1` test after correcting the Windows shortcut from `Meta+z` to `Control+z`. The implementation, 0.5.0 build/install, installed identity/responsiveness, and automated export evidence are recorded in the execution report. The user confirmed the installed export workflow is complete and verified. T-008 is therefore VERIFIED; no T-009 work was started. The dev server's missing optional WebGPU vendor copies remain a non-blocking environment notice.

## Request Coverage

- Provide reliable user-visible JPEG, PNG, SVG, and PDF export from the existing Export panel and shared browser/native File menu route.
- Preserve the existing target model: a non-empty selection exports each selected node as its own target; multiple targets/settings are bundled into one ZIP; no selection exports the current page as one content-sized target.
- Make the format policies observable: PNG preserves transparency; JPEG writes `.jpg` with MIME `image/jpeg`, quality 90 by default, and an opaque white matte; SVG/PDF retain vector structure where the current exporter supports it; PDF contains exactly one content-sized page per exported target.
- Resolve T-006's deferred vector background-blur policy: if the target or a descendant has a visible `BACKGROUND_BLUR`, SVG and PDF flatten the complete target through the proven CanvasKit PNG render route and embed that single raster result. Never translate backdrop blur to an ordinary foreground Gaussian blur.
- Preserve T-007's editor-only boundary: rulers, page guides, imported layout grids, margins, bleed, selection chrome, node controls, snap feedback, and other editor overlays must not change export bounds or appear in any requested format.
- Validate real bytes, dimensions, structure, target scope, external readability, save-dialog filenames, cancellation, multi-export ZIP contents, and the installed Windows result; adapter registration or UI option presence alone is not completion.
- Preserve the private local Windows route: no Git, worktrees, branches, pull requests, tags, release/updater/publishing/deployment/signing work, and no execution of `Toolbox/`.
- Deliver a completed local update only after all checks pass: calculate the next minor version from the verified T-007 installed version, synchronise the three shipped version files, build one fresh x64 NSIS installer, install it, launch the exact installed executable, and verify exports from installed OpenPotlood.
- The additional clause “add node controls to rectangle shapes to adjust the corner radius with a click and drag motion” belongs to T-004, which is already DONE/VERIFIED. T-008 must not duplicate or redesign radius controls; run the focused T-004 regression only.

## User-Visible Outcome

In installed OpenPotlood, a user can select one or more drawable nodes, or clear the selection to target the current page, choose PNG, JPG (the UI label for JPEG), SVG, or PDF in the Export panel, and save the result through a native Windows dialog. PNG opens with real alpha, JPEG opens on a white opaque background, ordinary SVG/PDF artwork remains vector-based, and background-blurred SVG/PDF artwork looks like the CanvasKit result through an explicit whole-target raster fallback. A PDF has one page sized to its target. Several targets or export rows produce one ZIP containing distinct, correctly named and valid files. Editor-only guides and controls never appear. The real exported files open in Windows Photos and Microsoft Edge, and cancellation creates no file or error.

## Verified Starting State

### Verified facts

- `App/packages/core/src/io/formats.ts` registers `pngFormat`, `jpgFormat`, `svgFormat`, and `pdfFormat` with document/page/selection/node export support. JPEG uses adapter ID/extension `jpg` and MIME `image/jpeg`; this satisfies the requested JPEG family and must not be renamed to `.jpeg` or a new stored format ID.
- `App/packages/scene-graph/src/types.ts` defines `ExportFormatId = 'png' | 'jpg' | 'webp' | 'svg' | 'pdf'`. `App/packages/vue/src/document/export/helpers.ts` exposes those five panel formats, selects `selection` when IDs exist and `page` otherwise, stores rows in `exportSettings`, mirrors them into `open-pencil/exportSettings` plugin data, and batches edits through the existing undo route.
- `App/src/components/properties/ExportSection.vue` exposes PNG/JPG/WEBP/SVG/PDF, renders scale only for raster formats, exports every displayed row for every target, saves one file directly, and sends multiple files to the ZIP route. Its preview is PNG-only and is not format-fidelity evidence.
- `App/src/app/document/export/create.ts` routes all formats through the `IORegistry`, derives names with `getExportBaseName()`, and uses `exportTargets()` for direct-versus-ZIP behaviour. `App/src/app/document/export/files.ts` sanitises ZIP entry names, disambiguates duplicates, uses `@tauri-apps/plugin-dialog` plus `@tauri-apps/plugin-fs` in Tauri, and falls back to browser save/download APIs outside Tauri.
- `getExportFileName()` currently yields `<name>@<scale>x.png|jpg` for raster and `<name>.svg|pdf` for vector. Multi-selection is intentionally separate files, not one combined canvas; multiple results are ZIP entries. Keep this contract.
- Raster export in `App/packages/core/src/io/formats/raster/render.ts` uses descendant visual bounds, CanvasKit at 2× internal render scale, output scale from the setting, and the shared renderer. Page/document requests may trim transparent outer padding. A target containing visible `BACKGROUND_BLUR` deliberately uses the full scene as its backdrop rather than an isolated subgraph.
- Raster surfaces are cleared transparent for every format. `SkiaRenderer.encodeRasterFallback()` places RGBA pixels on a transparent HTML canvas before JPEG encoding. The public guide claims JPG has a white background, but no focused byte/pixel test proves it; T-008 must make the white matte explicit and tested rather than trusting browser treatment of transparent pixels.
- `App/packages/core/src/io/formats/svg/export.ts` emits XML, `width`, `height`, `viewBox`, vector geometry, text, gradients, image data, clipping, transforms, and supported filter primitives. `defs.ts` correctly has drop-shadow and inner-shadow paths but currently maps every other visible effect, including `BACKGROUND_BLUR`, to `feGaussianBlur`. That is a foreground blur, not the required scene-backdrop result.
- `App/packages/core/src/io/formats/pdf/export.ts` converts the generated SVG through installed `jspdf` `4.2.1` and `svg2pdf.js` `2.7.0`, makes one PDF page in points sized to the target bounds, and has no multi-page policy. Keep one page per target; multi-target PDF output remains separate files in the existing ZIP.
- `App/src/app/shell/menu/schema.ts`, `app-menu.ts`, and `use.ts` expose only PNG, SVG, and `.fig` under Export Selection. The Export panel already reaches JPG/PDF. T-008 closes this product inconsistency by adding JPG and PDF to both browser and generated native menu actions without changing the shortcut's existing default PNG action.
- `App/tests/e2e/export/basic.spec.ts` covers panel rows, options, scale visibility, ZIP/direct download names, preview, multi-selection settings, mixed state, and undo. It does not parse or inspect exported PNG/JPEG/SVG/PDF bytes. The 2026-07-19 baseline run produced `12 passed, 1 failed`; the existing `undo reverts export setting edits` test left both PNG settings in place after one undo.
- The 2026-07-19 focused SVG batch passed `49` tests and `100` expectations. The same command failed its raster file before tests because CanvasKit resolved `\C:\Users\User\Documents\OpenPotlood\App\node_modules\...\canvaskit.wasm`; the actual WASM is present without the leading backslash. This repeats T-007's recorded environment blocker and must be cleared by predecessor/audit evidence before T-008 edits.
- T-006 owns CanvasKit/raster fidelity for background blur/inner glow/inner shadow and leaves complete SVG/PDF background-blur semantics to this packet. T-007 owns explicit editor-overlay exclusion and declares no real bleed, crop marks, print-ready output, DPI/mm conversion, or export-bound expansion.
- `App/AGENTS.md` requires public package boundaries, `bun run check`, a user-facing `CHANGELOG.md` entry, and committed/inspected CanvasKit visual evidence for pixel-affecting changes.
- The project and `App/` roots have no `.git` metadata by design. Use starting/final hashes, packet evidence, reports, and the pipeline validator; do not run Git-dependent `format:check`.
- Current machine validation surfaces verified on 2026-07-19: Python has Pillow and `pypdf`; `pdfinfo` is available through the bundled Codex runtime; Windows Photos `2026.11060.2004.0` is installed; Microsoft Edge exists at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. ImageMagick, MuPDF, and `pdftotext` are absent and must not appear in required commands.

### Official research rechecked 2026-07-19

- Tauri v2 dialog API: `save(options)` returns a Windows path or `null`; `defaultPath` and extension filters are supported. Source: https://v2.tauri.App/reference/javascript/dialog/
- jsPDF's official repository documents custom orientation, unit, and `[width, height]` page format; this matches the existing one-content-sized-page implementation. Source: https://github.com/parallax/jsPDF
- svg2pdf.js's official repository documents browser SVG-to-PDF conversion on a caller-sized jsPDF page, requires explicit font registration for more than basic fonts/characters, and states that the converter is not perfect. T-008 therefore requires real complex-text/vector PDF inspection instead of trusting conversion success. Source: https://github.com/yWorks/svg2pdf.js
- Official Tauri CLI/Windows installer documentation remains the build/install authority inherited from T-002/T-007. Sources: https://v2.tauri.App/reference/cli/ and https://v2.tauri.App/distribute/windows-installer/

### Decisions fixed by this packet

- Keep stored ID `jpg`, UI label `JPG`, extension `.jpg`, and MIME `image/jpeg`; report it as JPEG support. Do not add `.jpeg` output or migrate saved export settings.
- PNG is transparent outside artwork. JPEG is always opaque with a white matte. JPEG quality remains the existing default `90`; no new quality UI or stored field is added.
- A selection exports each selected node separately, preserving current names and ZIP batching. With no selection, export the current page's visible children as one content-sized target. Do not add artboard lists, slice management, or whole-document/multi-page UI.
- SVG/PDF remain vector for targets that do not need a scene backdrop. A visible `BACKGROUND_BLUR` anywhere in the target subtree triggers whole-target PNG flattening at 2× for SVG/PDF embedding. Do not mix partially flattened subtrees or invent an SVG backdrop filter.
- A PDF is exactly one target-sized page. Multiple selected nodes or targets are separate PDFs inside the existing ZIP, never a multi-page PDF.
- SVG and PDF scale controls remain hidden. Raster fallback for vector formats uses fixed 2× internal scale for fidelity and keeps the logical SVG/PDF dimensions equal to target bounds.
- Embedded text remains text where svg2pdf proves fidelity; if complex/non-Latin text does not survive PDF inspection through the existing route, stop for audit rather than silently outlining, substituting, or rasterising all PDFs outside the background-blur rule.
- Add JPG and PDF to the existing File > Export Selection submenu in the order PNG, JPG, SVG, PDF, `.fig`; preserve Shift+Ctrl+E as the current default PNG action.
- T-007 overlays, real print bleed, crop marks, colour profiles, CMYK, spot colours, DPI metadata, SVG optimisation, PDF standards/conformance, password protection, and compression controls are excluded.
- The completed T-008 update is a substantial user-visible capability set: increment the verified T-007 installed version to the next minor with patch zero, synchronising only the three shipped app version files after all pre-build checks pass.

### Assumptions to recheck before READY

- T-005, T-006, and T-007 are DONE/VERIFIED; T-008 is the only active task; their final reports exist; and the three shipped version files plus installed OpenPotlood agree on the T-007 version.
- T-006 retains the verified `nodeNeedsSceneBackdrop()`/full-scene raster path and canonical effect model. T-007 retains the explicit editor-overlay exclusion path. Any moved or replaced export/render seam requires packet audit, not executor improvisation.
- The CanvasKit leading-backslash initialisation failure and export-settings undo regression are resolved or explicitly assigned to a verified predecessor. If either reproduces at audit/execution start, T-008 remains blocked before application edits.
- `jspdf` and `svg2pdf.js` remain at compatible installed versions and no dependency addition is required. Dependency drift requires focused audit and official-doc recheck.
- Windows Photos, Edge, Python Pillow/`pypdf`, `pdfinfo`, the Tauri build toolchain, and T-002's installed path remain available. Recheck them because machine state is volatile.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- Final verified reports for T-005, T-006, and T-007
- `Plan/Packets/T-006-effects.md`
- `Plan/Packets/T-007-guides-margins-and-bleed.md`
- `App/AGENTS.md`
- `App/packages/core/src/io/formats.ts`
- `App/packages/core/src/io/formats/raster/render.ts`
- `App/packages/core/src/io/formats/svg/export.ts`
- `App/packages/core/src/io/formats/svg/defs.ts`
- `App/packages/core/src/io/formats/pdf/export.ts`
- `App/src/app/document/export/create.ts`
- `App/src/app/document/export/files.ts`
- `App/packages/vue/src/document/export/helpers.ts`
- `App/src/components/properties/ExportSection.vue`
- `App/tests/e2e/export/basic.spec.ts`
- `App/tests/engine/render/canvas/raster-export.test.ts`
- `App/tests/engine/io/svg/export/render.test.ts`

## Allowed Changes

Existing files, only where focused tests prove the stated gap:

- `App/packages/core/src/io/formats.ts`
- `App/packages/core/src/io/formats/raster/render.ts`
- `App/packages/core/src/io/formats/svg/export.ts`
- `App/packages/core/src/io/formats/svg/defs.ts`
- `App/packages/core/src/io/formats/pdf/export.ts`
- `App/packages/core/src/io/formats/pdf/index.ts`
- `App/src/app/document/export/create.ts`
- `App/src/app/document/export/files.ts`
- `App/src/app/shell/menu/schema.ts`
- `App/src/app/shell/menu/app-menu.ts`
- `App/src/app/shell/menu/use.ts`
- `App/desktop/generated/menu.json` through `bun run generate:tauri-menu` only
- `App/tests/e2e/export/basic.spec.ts`
- `App/tests/engine/render/canvas/raster-export.test.ts`
- `App/tests/engine/io/svg/export/render.test.ts`
- `App/packages/docs/user-guide/exporting.md`
- `App/CHANGELOG.md`
- `App/package.json`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`

New focused test/helpers only if the existing files would become unclear:

- `App/tests/engine/io/export/formats.test.ts`
- `App/tests/engine/io/pdf/export.test.ts`
- `App/tests/e2e/export/fixtures.ts`

Do not create any other path without stopping for packet audit.

## Restrictions and Exclusions

- Verify existing behaviour before changing it. Do not rewrite the IO registry, export target model, renderer, save-dialog abstraction, ZIP bundler, export settings persistence, or property panel merely because all four formats share a packet.
- Do not change `.fig`/Kiwi import-export, public stored format IDs, native document save, clipboard export, CLI/MCP export, WEBP/JSX behaviour, or package/public API names unless an allowed focused regression proves T-008 broke them.
- Do not implement multi-page PDF, whole-document export UI, print-ready bleed, crop/printer marks, millimetres/DPI, CMYK/spot colours, PDF/A/X, passwords, colour profiles, SVG minification, font embedding UI, quality UI, or export presets beyond the existing rows.
- Do not represent `BACKGROUND_BLUR` as `feGaussianBlur` in delivered SVG/PDF. Use the fixed whole-target raster fallback; do not invent a partial-flattening merge policy.
- Do not rasterise ordinary SVG/PDF targets. Their core shapes/text/gradients must remain structurally vector where supported and pass external inspection.
- Do not include editor-only rulers/guides/layout grids/margins/bleed/selection/radius handles/snap UI in any output and do not expand bounds for display-only bleed.
- Do not rename `JPG` to `JPEG`, add `.jpeg`, change historical export settings, or claim JPEG alpha support.
- Do not add a dependency. Pillow, `pypdf`, `pdfinfo`, Photos, and Edge are machine verification tools, not app dependencies.
- Do not update generated native menu JSON by hand; use the existing generator and verify its diff/hash scope.
- Do not increment the app version until focused tests, E2E byte checks, external parser checks, docs, and `bun run check` pass. Do not retain a completed version if build/install/real export verification fails.
- Do not touch T-004 radius implementation or expectations. Only run its focused regression.
- Do not use Git or `format:check`; this project intentionally has no Git metadata.

## Implementation Steps

1. Re-read `Toolbox/Project-History/PROJECT.md`, live `Plan/plan.md`, this packet, T-006/T-007 final reports, and the T-002 installed-loop evidence. Confirm T-005 through T-007 are DONE/VERIFIED, T-008 is READY/active, no other task is IN PROGRESS, and all three shipped/installed predecessor versions agree. Stop before editing on any mismatch.
2. Re-run the exact baseline commands in Verification items 1–3. The CanvasKit WASM path and export-settings undo test must pass before T-008 production edits. Record counts and hashes; do not absorb those pre-existing failures into T-008.
3. Record SHA-256 for every allowed existing file that will change, `bun.lock`, and the three version files. Record that both project/app roots have no `.git` directory. These are the no-Git starting receipts.
4. Add failing focused tests before production changes. Build one deterministic export fixture containing: a transparent canvas corner; opaque red rectangle; rotated rounded rectangle; gradient; embedded PNG fill; Latin and non-Latin text; drop shadow; canonical inner glow; inner shadow; background blur over a contrasting backdrop; hidden layer; and T-007 guide/layout-grid/margin/bleed metadata.
5. Extend `raster-export.test.ts` to assert PNG signature, decoded pixel dimensions at 1× and 2×, transparent outer pixel alpha `0`, JPEG SOI/EOI signatures, decoded dimensions, JPEG outer pixel alpha `255` and near-white RGB values, default quality path, and visible background-blur/inner-effect pixels. Compare metadata-on/off artwork exports for identical dimensions/pixels and no guide colours.
6. In `raster/render.ts`, make the render surface background format-aware. Clear white before artwork only for `JPG`; keep transparent clearing for PNG/WEBP. Apply the same matte before CanvasKit encode and browser fallback so the result is deterministic. Do not change bounds, scale, renderer order, or the full-scene background-blur path.
7. Add a pure subtree predicate at the nearest existing export helper seam, or reuse an audited T-006 helper if it exists, that returns true only when a target/descendant contains visible `BACKGROUND_BLUR`. Cover nested, hidden, disabled, unrelated-page, and ordinary-blur cases. Do not use text search or inspect raw `.fig` records.
8. In the SVG adapter path, keep `renderNodesToSVG()` unchanged for ordinary targets except for rejecting/missing the false background-blur `feGaussianBlur` branch. For backdrop-dependent targets, render the complete target through the existing CanvasKit PNG route at fixed 2×, then emit one standards-valid SVG root at logical target width/height/viewBox containing one embedded PNG `<image>` that fills those bounds.
9. Add SVG tests proving ordinary fixtures contain XML plus vector `<rect>`, `<text>`, gradients/filters and no full-target `<image>`; backdrop fixtures contain exactly one embedded `data:image/png;base64,...` image, no `feGaussianBlur` masquerading as backdrop blur, correct logical dimensions, and no T-007 overlay colours/elements.
10. Refactor the PDF exporter only enough to support two explicit inputs: the existing ordinary SVG-to-vector route, and a backdrop-dependent PNG route added as one full-page image to the same one-page jsPDF document. Keep unit `pt`, `[width,height]`, orientation, compression, and one page. Do not add page accumulation.
11. Add PDF-focused browser/E2E assertions: `%PDF-` header, `%%EOF`, non-empty bytes, exactly one page, page box matching target logical dimensions within parser tolerance, vector fixture containing extractable Latin/non-Latin text where supported, and backdrop fixture rendering as the CanvasKit appearance without editor overlays. If the installed svg2pdf route cannot preserve required text, stop for audit; do not silently change the fixed policy.
12. Extend the File > Export Selection schema in order PNG, JPG, SVG, PDF, `.fig`. Add `export-jpg`/`export-pdf` handlers to both `app-menu.ts` and native `use.ts`, widen only their local format union, retain `export-selection`/Shift+Ctrl+E as 1× PNG, then run `bun run generate:tauri-menu`.
13. Add focused menu-schema coverage in the nearest existing shared/native menu test if one exists after predecessors. Verify exact IDs/order/labels and action routing for JPG/PDF. If no suitable test seam exists, extend `basic.spec.ts` through the browser File menu; do not create a second menu architecture.
14. Extend `basic.spec.ts` to capture actual downloads. For a single setting, assert the expected filename, MIME-derived extension, non-empty bytes, magic bytes, dimensions/structure, and valid open/decode for PNG/JPG/SVG/PDF. Do not count a blob URL or filename alone as format proof.
15. Extend the same E2E for no-selection current-page export, one selected node, two selected nodes with duplicate names, two format rows, ZIP entry sanitisation/disambiguation, and save cancellation. Assert exact target count/names, no missing/duplicate entries, cancellation creates no file/error, and the source document remains unchanged.
16. Prove visual policies in E2E: PNG transparent corner; JPEG white corner; SVG ordinary vector structure; PDF one page; all four include expected artwork; background-blur SVG/PDF use full-target image fallback; hidden layers and all T-007 overlays are absent; logical/output dimensions remain unchanged by guide metadata.
17. Prove selection/page bounds and scale: 1×/2× raster dimensions equal `ceil(visualBounds × scale)`; vector logical dimensions equal visual bounds; no-selection page output contains visible current-page children only; selection output does not include unrelated siblings except pixels legitimately sampled behind `BACKGROUND_BLUR` inside target bounds.
18. Preserve existing export-setting mutation behavior and fix only regressions attributable to T-008. Re-run the full `basic.spec.ts`, including its existing multi-selection undo test, and the `.fig` export-settings round-trip test. Exporting must not add an undo entry or mutate graph/plugin data.
19. Update `packages/docs/user-guide/exporting.md`: list PNG, JPG/JPEG, WEBP, SVG, and PDF accurately; state alpha/white-matte rules, selection/page and ZIP behavior, one-page PDF policy, background-blur raster fallback, and editor-overlay exclusion. Remove any unsupported claim, including unqualified vector/filter fidelity.
20. Add one concise `CHANGELOG.md` entry under Unreleased > Changed: reliable JPEG/PNG/SVG/PDF byte validation, deterministic JPEG white matte, menu parity, and honest background-blur fallback. Do not claim print-ready PDF or real bleed.
21. Format only touched files. Run Verification items 1–10, inspect all generated artefacts/screenshots, and fix only T-008 failures. Stop and record unrelated failures rather than widening scope.
22. Create `%TEMP%\OpenPotlood-T008-<timestamp>` and generate one deterministic evidence set from the verified app route: transparent PNG, white-matte JPG, ordinary vector SVG, background-blur fallback SVG, ordinary PDF, background-blur PDF, and a mixed multi-target ZIP. Record absolute paths, sizes, SHA-256, decoded dimensions/page boxes, text/vector/fallback classification, and overlay absence.
23. Validate the evidence set with the exact Python/`pdfinfo` commands below. Open PNG/JPG in Windows Photos and SVG/PDF in the exact Microsoft Edge executable. Visually check artwork, transparency/matte, text, gradient/image/effects, target bounds, one PDF page, fallback appearance, and absence of guides/controls.
24. After every pre-build check passes, calculate the next minor version from the verified T-007 installed version and synchronise exactly `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`. Do not change workspace package versions or `bun.lock`.
25. Re-run focused tests after the version edit. Record `$buildStart`, create exactly one fresh x64 MSVC NSIS installer, hash it twice, silently install with uppercase `/S`, and verify installed executable path, OpenPotlood product/version metadata, exact-path launch, title, non-zero window handle, and `Responding=True` twice using the T-002 executed pattern.
26. In installed OpenPotlood, recreate the deterministic fixture rather than relying on Vite data. Export all requested formats through the panel, then JPG/PDF through File > Export Selection. Cancel one dialog. Create the multi-target ZIP. Repeat the external parser/viewer checks against these installed-app files.
27. Save the fixture as task-specific `.fig`, close/reopen it, export again, compare the format policies/dimensions/hashes where deterministic, then close/relaunch installed OpenPotlood, reopen the `.fig`, and export one PNG plus one PDF again. Confirm process responsiveness after each real-app phase.
28. Run the unchanged T-004 corner-radius E2E and T-007 guide/export-exclusion regressions. T-008 must not change their application files or acceptance values.
29. Run the pipeline validator, write the execution report with all required evidence, and leave READY-to-VERIFIED/DONE advancement to audit. Do not start T-009.

## Acceptance Criteria

- [ ] PNG, JPG/JPEG, SVG, and PDF are reachable from the Export panel; PNG/JPG/SVG/PDF are present in the shared browser/native File > Export Selection menu in the fixed order, with Shift+Ctrl+E still defaulting to PNG.
- [ ] PNG/JPG use correct signatures/MIME/extensions, decode externally, match expected scaled dimensions, preserve PNG alpha, and give JPEG a deterministic opaque white matte at default quality 90.
- [ ] Ordinary SVG is valid XML with correct logical dimensions/viewBox and meaningful vector/text/gradient/image structure; it is not a full-target raster image.
- [ ] Ordinary PDF starts with `%PDF-`, ends with `%%EOF`, parses through `pypdf` and `pdfinfo`, contains exactly one page sized to the target, opens in Edge, and preserves required visible text/vector appearance.
- [ ] A target with visible nested `BACKGROUND_BLUR` renders correctly in PNG/JPEG and uses one deliberate full-target embedded PNG for SVG/PDF; it never emits or claims a false foreground Gaussian backdrop blur.
- [ ] One node exports one file; multiple selected nodes/settings produce one ZIP with exact sanitised/disambiguated entries; no selection exports the current page as one content-sized target; unrelated pages/hidden nodes are absent.
- [ ] PNG/JPG scale and vector logical bounds follow the fixed selection/page policy. Editor overlays and display-only bleed neither appear nor alter output bounds.
- [ ] Export cancellation writes no file, raises no user-visible error, mutates no graph/export settings, and creates no undo entry.
- [ ] Existing export-setting add/edit/remove/mixed/undo and `.fig` round-trip tests pass; the pre-existing undo regression is not waived or misattributed.
- [ ] External validation succeeds: Pillow opens PNG/JPG and reports expected mode/dimensions/pixels; XML parser opens SVG; `pypdf`/`pdfinfo` report one valid PDF page; Photos/Edge visibly open the real installed-app artefacts.
- [ ] Documentation accurately states JPEG/JPG, alpha/matte, target/ZIP, PDF page, vector/fallback, and overlay boundaries without print-ready claims.
- [ ] Focused engine/E2E/menu/round-trip/regression suites, `bun run check`, Cargo check, and Tauri NSIS build all exit `0`; generated menu is current and `bun.lock` is unchanged.
- [ ] The completed update uses the next minor after verified T-007; the three version files, installer, installed executable, and VersionInfo agree.
- [ ] Exactly one fresh installer is stably hashed, silently installed, and launched from `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`; installed export/save/reopen/relaunch checks pass and the process is responsive twice.
- [ ] T-004 corner-radius controls remain unchanged and their focused regression passes.
- [ ] No file outside Allowed Changes changes; no app dependency, Git/release/updater/publishing/deployment/signing action, or `Toolbox/` execution occurs; audit owns completion advancement.

## Verification

Run from `App/` unless stated otherwise:

1. `bun test ./tests/engine/render/canvas/raster-export.test.ts ./tests/engine/io/svg/export/render.test.ts ./tests/engine/io/svg/export/builder.test.ts ./tests/engine/io/svg/export/paths.test.ts` — expect exit `0`; no leading-backslash WASM error; every raster signature/pixel/dimension/effect/overlay assertion and all existing 49 SVG tests pass.
2. `bunx playwright test tests/e2e/export/basic.spec.ts --project=openpencil` — expect exit `0` with all existing 13 tests plus new byte, target, ZIP, cancel, bounds, fallback, and format-policy tests passing; the existing undo case must pass.
3. `bun test ./tests/engine/io/fig/roundtrip/export-settings.test.ts` — expect exit `0`; export settings/plugin data survive and export actions do not mutate them.
4. `bun run generate:tauri-menu` — expect exit `0`; `desktop/generated/menu.json` contains PNG, JPG, SVG, PDF, `.fig` in order and no unrelated generated-menu change.
5. `bun run check:i18n` — expect exit `0`; no locale drift from shared menu/panel changes.
6. `bunx playwright test tests/e2e/export/basic.spec.ts --project=openpencil -g "PNG|JPG|SVG|PDF|background blur|ZIP|cancel|page|selection"` — expect exit `0`; every requested-format slice passes independently.
7. `bunx playwright test tests/e2e/canvas/corner-radius-controls.spec.ts --project=openpencil` — expect exit `0` with the unchanged T-004 rectangle node-control behavior.
8. Run the final T-007 guide/export-exclusion focused command recorded in its VERIFIED report — expect exit `0` and identical artwork bounds/pixels with guide metadata on/off.
9. `bun run check` — expect exit `0`. Do not run `format:check` because it requires Git.
10. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.
11. From the project root, validate exported raster/SVG/PDF files with:

   `@'
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
import sys, xml.etree.ElementTree as ET
root=Path(sys.argv[1])
for name in ('installed.png','installed.jpg'):
    p=root/name
    with Image.open(p) as im:
        im.verify()
    with Image.open(p) as im:
        print(f'{name}|{im.format}|{im.mode}|{im.size[0]}x{im.size[1]}')
svg=root/'installed.svg'
r=ET.parse(svg).getroot()
print(f'installed.svg|{r.tag}|{r.attrib.get("width")}x{r.attrib.get("height")}')
for name in ('installed.pdf','installed-background-blur.pdf'):
    reader=PdfReader(root/name)
    if len(reader.pages)!=1: raise SystemExit(f'{name}: expected 1 page, got {len(reader.pages)}')
    box=reader.pages[0].mediabox
    print(f'{name}|pages=1|{float(box.width)}x{float(box.height)}')
'@ | python - $evidenceRoot` — expect two decodable images, an SVG root/dimensions, and exactly one page with positive dimensions for both PDFs.
12. `pdfinfo "$evidenceRoot\installed.pdf"; pdfinfo "$evidenceRoot\installed-background-blur.pdf"` — expect exit `0`, `Pages: 1`, positive page size, and no syntax error for each.
13. From the project root, verify version agreement: `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique` — expect one value equal to the next minor after verified T-007.
14. Record `$buildStart=(Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` — expect exit `0`, a release executable, and exactly one fresh `OpenPotlood_*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
15. From the project root: `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File | Where-Object {$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; $hash1=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; $hash2=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; if($hash1 -ne $hash2){throw 'Installer hash changed before install'}; "$($installer[0].FullName)|$hash1"` — expect one path and stable hash.
16. Install with `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}` — expect no exception; then reuse T-002's refreshed installed path, `VersionInfo`, SHA-256, exact-path launch, title/handle, and repeated responsiveness commands.
17. From the project root: `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.` Record but do not advance T-008.

## Integration or Installed-Result Check

- Mandatory and indivisible: clean baselines -> focused format/byte tests -> menu generation -> E2E target/ZIP/cancel checks -> parser/viewer inspection -> quality gate -> next-minor version -> Cargo check -> one fresh NSIS build/hash/install -> exact installed identity/launch -> real panel/menu exports -> Photos/Edge/Pillow/XML/pypdf/pdfinfo validation -> `.fig` save/reopen -> export repeat -> relaunch/reopen -> regression checks -> responsiveness.
- Use installed OpenPotlood at `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, not Vite, an old installer, OpenPencil, OpenPencil Studio, or `Toolbox/`. Record every exported artefact's absolute path, size, SHA-256, parser result, and visual observation.
- Real-app proof must include one-node, multi-node ZIP, and no-selection page exports; PNG alpha; JPG white matte; ordinary vector SVG/PDF; background-blur SVG/PDF fallback; non-Latin text; gradient/image/effects; editor-overlay absence; dialog cancellation; File-menu JPG/PDF; save/reopen; relaunch/reopen; and two responsive process checks.
- Open PNG/JPG with Windows Photos. Open SVG/PDF using `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`. Do not claim external readability merely from successful process launch; visually confirm the expected content and record the observation.
- State explicitly that PDF is one target-sized page, bleed remains display-only, and no print-ready/CMYK/DPI/crop-mark capability was delivered.

## Stop Conditions

- T-005, T-006, or T-007 is not DONE/VERIFIED; T-008 is not READY/active; another task is IN PROGRESS; predecessor reports are missing; or shipped/installed predecessor versions disagree.
- Any final T-006/T-007 report moved/replaced the background-blur, overlay, export, menu, test, build, or installed-path seams. Return to audit; do not adapt silently.
- The CanvasKit baseline again resolves `\C:\...\canvaskit.wasm`, dependencies/vendor files are missing, or the existing export-settings undo E2E fails. Treat these as predecessor/environment blockers; do not edit T-008 code until resolved.
- A requested format cannot produce non-empty valid bytes, decode/parse, match expected dimensions/page count, or open in the named external viewer.
- JPEG cannot be made deterministic white-matte through the existing raster route without a renderer rewrite or dependency; SVG/PDF background blur cannot use the fixed whole-target CanvasKit PNG fallback; or ordinary SVG/PDF would need blanket rasterisation.
- SVG/PDF complex/non-Latin text, image fills, gradients, inner effects, clipping, transforms, or blend modes are silently lost/corrupted in the required fixture. Stop for audit rather than weakening acceptance or silently outlining/rasterising outside the fixed fallback.
- Export target scope, naming, ZIP entries, cancellation, bounds, alpha/matte, PDF page policy, or vector/fallback classification differs from this packet after predecessor reconciliation.
- T-007 overlays appear or change any export bound; real bleed/crop marks/DPI/mm/CMYK/print-ready output is requested; or fixing exclusion requires redoing T-007 architecture.
- Completion requires a file outside Allowed Changes, new dependency, public/stored format migration, `.fig`/Kiwi change, CLI/MCP redesign, Git/release/updater/publishing/deployment/signing action, or execution of `Toolbox/`.
- Any new/changed test, E2E, generated menu, docs check, `bun run check`, Cargo check, build, installer count/hash, install, identity/version, launch, save/reopen, external parser/viewer inspection, relaunch, corner-radius/guide regression, title/handle, or responsiveness check fails.
- More than one fresh installer exists, installer hash changes, installed path/version/identity differs, an export file is ambiguous/stale, or installed output cannot be tied to the exact launched executable.

## Execution Report Contract

- Report result; predecessor/T-008 versions; every changed file and starting/final SHA-256; unchanged `bun.lock`; commands, exits, counts, and exact failures; format fixture values; output/ZIP paths, sizes, hashes, signatures, MIME/extensions, dimensions/page boxes, text/vector/fallback classification; parser and Photos/Edge observations; cancellation and no-mutation evidence; overlay exclusion; installer/executable paths/hashes/VersionInfo; process ID/path/title/handle/responsiveness; save/reopen/relaunch results; T-004/T-007 regressions; deviations; and mess or concerns.
- State explicitly that `jpg`/`.jpg`/`image/jpeg` fulfils JPEG, PNG preserves alpha, JPEG uses white matte/default quality 90, PDF is one page per target, background-blur SVG/PDF uses whole-target PNG fallback, ordinary SVG/PDF remains vector, T-007 overlays/real print bleed are excluded, T-004 radius code was unchanged, application code changed during execution, and packet/task advancement was left to audit.

## Status record

Status: **Done**
