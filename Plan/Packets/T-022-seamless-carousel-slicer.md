# T-022 — Deliver a seamless carousel slicer

Task ID: T-022
Packet state: Dropped
Project goal link: PROJECT.md#end-goal
Depends on: T-008
Prepared against: Live `App/` source and tests inspected on 2026-07-24; T-008 is DONE/VERIFIED. No carousel implementation or carousel test directory exists in the live source.
Last expanded: 2026-07-24

## Request Coverage

- Deliver an interactive, non-destructive carousel slicer allowing one continuous horizontal composition with visible slide panel boundaries.
- Support Instagram Square (1080 x 1080), Instagram Portrait (1080 x 1350), Story / Reels (1080 x 1920), LinkedIn Landscape (1920 x 1080), and Custom panel dimensions with `100 <= W,H <= 4096`.
- Support panel counts `2..10`, default `5`, with integer boundaries `x_k = k * W` across total width `N * W`.
- Render non-exporting dashed divider guides and `Slide 1` through `Slide N` labels.
- Add carousel controls to the existing frame preset and design/property-panel routes.
- Export ordered PNG slides as a ZIP and provide a multi-page PDF option only if the existing export pipeline can support it without a new dependency or an unapproved product decision.
- Preserve editable source content and carousel metadata through `.fig` save, load, and relaunch.
- Keep this private, local-only Windows work inside `App/`; no Git, release, publishing, deployment, signing, updater, or `Toolbox/` work.

## User-Visible Outcome

Selecting a carousel preset or enabling carousel mode on a parent frame creates an editable continuous frame of width `N * W` and height `H`. Divider guides and slide labels appear only as canvas helpers. The design panel exposes preset, panel count, guide visibility, and carousel export controls. Exported PNGs are sequentially named and assemble without gaps, overlaps, or seam pixels at the integer joins.

## Verified Starting State

### Live source evidence

- `App/packages/scene-graph/src/types.ts` defines `NodeType` values including `FRAME` and `SLICE`, `ExportSetting`, `exportSettings`, and `pluginData` on `SceneNode`; no carousel metadata type is present.
- `App/packages/core/src/io/formats/raster/render.ts` owns raster surface creation, CanvasKit rendering, downsampling, alpha trimming, and raster encoding. It currently has no carousel batch API.
- `App/src/components/properties/ExportSection.vue` uses `useExport()`, `editorStore.exportTargets()`, existing PNG/JPG/WEBP/SVG/PDF formats, and existing multi-file ZIP behaviour.
- `App/src/components/PropertiesPanel.vue` is the live design-panel host; it mounts `DesignPanel.vue`. There is no live `App/src/components/properties/PropertiesPanel.vue`.
- `App/src/components/Toolbar/FramePresetPopover.vue` creates `FRAME` nodes through `editor.createShape()` and currently offers three presets plus Custom dimensions.
- `App/packages/core/src/canvas/renderer/pipeline.ts` renders scene content and existing page/frame guides through `drawPageGuides()` and `drawFrameGuides()`; there is no `App/packages/core/src/canvas/guides.ts`.
- `App/packages/core/src/canvas/frame-guides.ts` and `App/packages/core/src/canvas/page-guides.ts` are the live guide seams.
- `App/tests/engine/` is the existing Bun unit-test root, `App/tests/e2e/` is the existing Playwright root, `App/tests/e2e/export/` contains export tests, and `App/tests/e2e/toolbar/` contains frame-preset tests.
- `App/package.json` provides the verified commands `bun test ./tests/engine`, `bun run test`, `bun run check`, `bun run build`, and `bun run tauri`; the packet must not introduce a new command or dependency.
- `App/packages/core/src/io/formats/fig/compress.ts` already uses the installed `fflate` dependency for ZIP work; adding another ZIP/PDF dependency is outside this packet.

### Preserved request decisions

- Presets: `INSTAGRAM_SQUARE` 1080 x 1080; `INSTAGRAM_PORTRAIT` 1080 x 1350; `STORY_REELS` 1080 x 1920; `LINKEDIN_LANDSCAPE` 1920 x 1080; `CUSTOM` within the stated bounds.
- Panel count is an integer from 2 through 10, default 5.
- Carousel metadata belongs to the editable parent `FRAME`; the implementation must use the repository's existing node persistence conventions rather than silently flattening or discarding it.
- Divider guides are overlays and must not be included in exported pixels.
- Slice rectangles are exact integer rectangles `[k*W, 0, (k+1)*W, H]`; no overlap, fractional coordinate, or duplicated edge pixel is allowed.
- Output names are `${frameName}_slide_01.png` through `${frameName}_slide_0N.png`, in panel order.
- This is a private local remix. Do not add distribution, release, updater, publishing, deployment, or network goals.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `App/AGENTS.md`
- `App/packages/scene-graph/src/types.ts`
- `App/packages/core/src/io/formats/raster/render.ts`
- `App/packages/core/src/io/formats/fig/compress.ts`
- `App/packages/core/src/io/formats/fig/export.ts`
- `App/src/components/properties/ExportSection.vue`
- `App/src/components/PropertiesPanel.vue`
- `App/src/components/Toolbar/FramePresetPopover.vue`
- `App/packages/core/src/canvas/renderer/pipeline.ts`
- `App/packages/core/src/canvas/frame-guides.ts`
- `App/packages/core/src/canvas/page-guides.ts`
- `App/tests/engine/`
- `App/tests/e2e/export/`
- `App/tests/e2e/toolbar/`

## Allowed Changes

- Add the smallest carousel metadata/type definitions to `App/packages/scene-graph/src/types.ts` only where required by the existing SceneNode and `.fig` persistence model.
- Extend `App/packages/core/src/io/formats/raster/render.ts` or an adjacent existing raster-export seam for integer carousel slice rendering and ordered batch output.
- Extend the live renderer guide seams (`App/packages/core/src/canvas/renderer/pipeline.ts`, `frame-guides.ts`, `page-guides.ts`, or an adjacent existing overlay seam) for non-exporting carousel dividers and labels.
- Add `App/src/components/properties/CarouselSection.vue` and mount it through the live design-panel route, using existing UI primitives and stores.
- Extend `App/src/components/Toolbar/FramePresetPopover.vue` for carousel creation while preserving standard frame presets.
- Extend the existing editor store/action seam under `App/src/app/editor/` for carousel creation, metadata updates, and export requests.
- Add focused Bun tests under the existing `App/tests/engine/` tree and focused Playwright tests under the existing `App/tests/e2e/` tree.
- On a later implementation run only, synchronise the completed installed app version in `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` according to PROJECT.md. No version change is permitted during packet expansion.

## Restrictions and Exclusions

- Do not implement this packet during expansion. This document-only repair must not change anything under `App/` or `Toolbox/`.
- Do not implement a carousel now, and do not start T-010 or alter T-010's `BLOCKED` state.
- Do not alter ordinary frame rendering, ordinary T-008 export behaviour, existing `.fig` content, or standard frame presets.
- Do not invent or assume a new renderer, store, persistence codec, test runner, command, interface, or dependency. Reuse verified live seams; stop if a new one is required and not already supported by the source.
- Do not add a ZIP/PDF library. Reuse the existing export/ZIP capability; stop if multi-page PDF requires a new dependency or an unapproved product decision.
- Do not make external network requests, publish packages, use Git/worktrees/branches, build, install, launch, change versions, or edit files outside the explicitly allowed implementation paths.

## Implementation Steps

1. Re-read the listed live seams and record any drift before editing. If the node, export, persistence, or UI route assumptions no longer hold, stop and report the exact mismatch.
2. Define the carousel metadata contract using existing SceneNode/plugin-data/fig persistence conventions. Validate preset dimensions, Custom bounds, integer panel count, default count, and total frame dimensions in focused unit tests before wiring UI.
3. Implement carousel frame creation and metadata updates through the existing editor action/undo path. Preserve standard frame creation and make panel-count changes update the parent frame dimensions without flattening children.
4. Implement non-exporting carousel dividers and labels through the existing overlay pipeline. Confirm guides are visible only when enabled and are excluded from raster/export rendering.
5. Implement exact integer slice rendering from the continuous parent frame. For each `k`, render/crop `[k*W, 0, (k+1)*W, H]` at the requested scale, with no fractional bounds, overlap, or duplicated edge pixels. Use existing ordered export and ZIP machinery.
6. Add the Carousel section to the live design-panel route and extend the frame preset popover. Reuse existing controls, labels, undo behaviour, selection, and export actions; do not create a second properties-panel host.
7. Add focused engine coverage for validation, dimensions, naming/order, persistence, and slice geometry; add focused Playwright coverage for creation, guides, control changes, export, and ordinary frame regression. Add a visual assertion only where the existing canvas test conventions can observe the seam result.
8. Run the focused tests, then the existing full checks, build, installer, install, launch, and installed-result checks defined below. Update the report and project receipt only after evidence is captured.

## Acceptance Criteria

- Preset selection creates an editable `FRAME` with the exact approved per-panel dimensions and total width `N*W`; Custom rejects values outside `100..4096` and non-integer values.
- Panel counts are constrained to integers `2..10`, default to 5, and changing the count updates total width while preserving child content and undo/redo.
- Carousel metadata survives `.fig` save, load, and relaunch without flattening, dropping, or corrupting unrelated node data.
- Divider lines and slide labels show the correct `N-1` boundaries and `N` labels, toggle off cleanly, and never appear in exported pixels.
- Every slice uses exact integer bounds `[k*W, 0, (k+1)*W, H]`; tests demonstrate no overlap, gap, fractional boundary, duplicated edge pixel, or seam artefact at joins.
- PNG batch output is ordered and named exactly `${frameName}_slide_01.png` ... `${frameName}_slide_0N.png` and is packaged using the existing ZIP path. Multi-page PDF is included only if supported by the existing pipeline without a new dependency or product decision.
- Existing ordinary frame presets and T-008 export formats retain their prior focused coverage and behaviour.
- Focused tests, full checks, build, installer, installed version, executable identity, launch, and responsiveness all pass, with evidence recorded in the execution report.

## Verification

### Automated checks

- Run the new focused carousel Bun tests through the existing command from `app`: `bun test ./tests/engine`.
- Run the new focused carousel Playwright tests through the existing command from `app`: `bun run test`.
- Run the existing quality checks: `bun run check` and `bun run build`.
- Run the existing desktop Rust/build path through `bun run tauri` as required by the repository's current installer workflow; record the exact subcommand used and its exit result. Do not invent a replacement command.
- Re-run the pipeline validator from the workspace root after the execution report and project files are updated.

### Required evidence

- Test file paths and pass counts for focused engine and E2E coverage.
- Exact commands, exit codes, and relevant output for checks/build/installer.
- Hash and path for the produced installer and installed executable.
- Installed app version equality across the three version files and the installed executable.
- Evidence that the installed app launches, exposes the carousel flow, writes ordered ZIP entries, and remains responsive.

## Integration or Installed-Result Check

After automated checks pass, the implementation executor must complete the existing local desktop loop: create a 5-panel Instagram Portrait carousel, place content across a panel join, verify guides and labels, change to 4 panels, export PNG slides, inspect ZIP entry order and join pixels, save/reopen/relaunch the `.fig`, and verify metadata and editability. Then build a fresh NSIS installer, install it silently, launch the installed executable, verify the approved synchronised version and executable identity, repeat the carousel export smoke check, and perform repeated responsive-process checks. Record any unperformed step as open; do not claim completion without it.

## Stop Conditions

- Stop before application edits if any listed source path, route, export API, persistence seam, or command has drifted.
- Stop if the implementation needs a product decision about metadata ownership, panel behaviour, PDF semantics, naming, or guide appearance.
- Stop if a new dependency, external network request, release/distribution action, route family, or persistence format is required.
- Stop if integer cropping cannot be proven, if any seam/gap/overlap appears, or if guides enter exported pixels.
- Stop if ordinary T-008 exports, standard frame presets, `.fig` round-trip, focused tests, full checks, build, installer, install, launch, version, executable identity, or responsiveness fails.
- Stop if the installed result cannot prove the requested carousel flow; a browser-only or source-only result is insufficient.
- Stop after the bounded slice and receipt. Do not implement adjacent tasks or promote T-010.

## Execution Report Contract

The implementation report must be saved under `Toolbox/Project-History/reports/` with the T-022 identifier and must state: scope and exclusions; exact files changed; metadata and export contract; focused test paths/pass counts; full-check/build/installer commands and exit codes; installer and installed executable paths/hashes; synchronised version; installed carousel creation, guide, export, ZIP-order, join-pixel, `.fig` round-trip, relaunch, and responsiveness evidence; unperformed checks; blockers; decisions; and the exact next action. The executor must append one concise T-022 receipt to `Toolbox/Project-History/PROJECT_LOG.md` and leave T-022's status/packet state honest (`NOT STARTED`/`PREPARED` until implementation is actually selected and verified).

## Status record

Status: **Dropped**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Dropped (2026-08-14, user's decision — no longer wanted; packet retained for reference, do not execute)
