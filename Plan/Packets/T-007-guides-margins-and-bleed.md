# T-007 — Deliver guides, margins, and bleed

Task ID: T-007
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-006
Prepared against: Live `App/` source on 2026-07-19; T-001 through T-004 VERIFIED; T-005 IN PROGRESS and T-006 PREPARED, so both predecessor results must be re-audited before READY promotion
Last expanded: 2026-07-19

## Request Coverage

- Provide editable guides: turn the existing imported-page-guide renderer into a current-page authoring flow. With rulers visible, users drag from the top ruler to create a horizontal guide (`axis: 'Y'`) and from the left ruler to create a vertical guide (`axis: 'X'`), drag an existing guide to move it, and drag it back onto either ruler to remove it. Each complete create, move, or remove gesture is one undo/redo entry.
- Provide margins for print-oriented composition: exactly one unrotated `FRAME` selection exposes a Guides section with a four-sided inset Margins overlay. Values use existing document units (pixels), are linked by default, can be unlinked, remain non-negative, and may not cross or invert the frame interior.
- Provide bleed guidance: the same section exposes a four-sided outset Bleed overlay, linked by default and independently editable after unlinking. This is explicitly an editor-only bleed guide. It does not resize a frame, alter clipping, expand export bounds, add printer marks, or claim print-ready output.
- Provide visibility and snapping: ruler/page guides and enabled frame margins/bleed are visible only in editor rendering, never in artwork exports or thumbnails. Object movement snaps to visible page guides and to visible margin/bleed edges using the existing five-document-unit snap threshold; hiding rulers disables page-guide authoring and all guide snapping.
- Preserve `.fig` compatibility and unknown data: page guides remain in the current page node's `source.fig.rawNodeFields.guides`; margins/bleed use one versioned private plugin-data record on a frame. Mutations preserve malformed/unknown neighbouring raw guide entries, unknown layout-grid fields, unrelated source metadata, and unrelated plugin-data entries.
- Preserve the private local Windows route: no Git, worktree, branch, tag, pull request, release, updater, publishing, deployment, signing, or resource execution.
- Deliver a completed local update: after all checks pass, calculate the next minor version from the verified T-006 installed version, synchronise the three shipped version files, build one fresh x64 NSIS installer, install it, launch the exact installed executable, and verify the real guide/margin/bleed/save/reopen/relaunch flow.
- The additional request clause "add node controls to rectangle shapes to adjust the corner radius with a click and drag motion" is already owned by T-004. T-004 is DONE/VERIFIED and its report records the rectangle-only click-drag controls. T-007 must not duplicate, redesign, or extend corner-radius behaviour; run its focused regression only.

## User-Visible Outcome

In installed OpenPotlood, rulers are a real visibility control rather than decorative state. With rulers on, a user can pull horizontal or vertical page guides onto the canvas, move them, remove them by returning them to a ruler, undo/redo each gesture, and save/reopen them in `.fig`. Selecting one unrotated frame shows a Guides section where linked or independent margin and bleed values can be enabled and edited in pixels. Cyan margin lines appear inside the frame and red bleed lines outside it; visible guide edges attract moved objects. The overlays survive `.fig` save/reopen and app relaunch but never appear in PNG, JPEG, SVG, PDF, thumbnails, copied artwork, or the layer tree. Bleed remains guidance only; T-008 owns any future export-bound or print-mark semantics.

## Verified Starting State

### Verified facts

- `App/packages/core/src/canvas/page-guides.ts` reads only the current `CANVAS` node's `source.fig.rawNodeFields.guides`. It recognises object records with `axis` and `offset`; `axis: 'X'` draws a vertical line at an X coordinate and `axis: 'Y'` draws a horizontal line at a Y coordinate. It currently renders but has no authoring API.
- `App/packages/core/src/canvas/renderer/pipeline.ts` calls `drawPageGuides()` in the editor overlay layer. `renderSceneToCanvas()` used by raster export renders only page children, so page guides are already outside that export path.
- `App/packages/core/src/canvas/rulers.ts` renders 20-pixel screen-space rulers using `RULER_SIZE`, current pan/zoom, and theme colours. `App/src/components/editor/ZoomDropdown.vue` toggles `store.state.showRulers`, but `App/packages/vue/src/canvas/surface/overlays.ts#createRulerVisibility()` never reads that state. This is a verified current visibility bug and must be covered by T-007.
- `App/packages/core/src/editor/pages.ts` owns current-page actions but has no guide read/write/mutation actions. `App/packages/core/src/editor/create.ts` assembles page actions into the public Editor, and `App/packages/core/src/editor/index.ts` exports Editor contracts.
- `App/packages/vue/src/canvas/useCanvasInput.ts` is the live pointer coordinator. Drag variants live in `App/packages/vue/src/shared/input/types.ts`; page-guide drag handling is absent. The existing radius drag path from T-004 must remain intact.
- `App/packages/scene-graph/src/types.ts` defines `source.fig.rawNodeFields` as `Record<string, unknown>`. `App/packages/scene-graph/src/source-metadata.ts` clears raw metadata only for known edited scene properties, so source-only guide writes must use `graph.preserveSourceMetadataDuring()` and structured clones rather than ordinary visual-property mutation.
- `App/packages/core/src/kiwi/fig/node-change/convert.ts` includes both `guides` and `layoutGrids` in `FIGMA_RAW_NODE_FIELD_KEYS`; `App/packages/core/src/kiwi/fig/node-change/export-node.ts#applyRawFigmaNodeFields()` re-emits preserved fields. `App/tests/engine/io/fig/roundtrip/source-metadata.test.ts` already proves page-guide and layout-grid raw metadata round-trips.
- The installed `@figma/plugin-typings` `1.126.0` contract defines `Guide` as `{ axis: 'X' | 'Y'; offset: number }`. Figma's native `LayoutGrid` covers `GRID`, `COLUMNS`, and `ROWS`; it does not define print margin or bleed records.
- `App/packages/core/src/canvas/layout-grids.ts` renders imported frame layout grids from raw metadata. `App/packages/core/src/canvas/scene.ts` currently calls it inside normal scene rendering, and `App/packages/core/src/io/formats/raster/render.ts` calls `renderer.renderSceneToCanvas()` for PNG/JPEG/WebP. Therefore imported layout-grid overlays can currently enter raster output. T-007 must add a live-editor-only render guard and regression proof rather than extending this leak.
- `App/packages/core/src/kiwi/fig/node-change/plugin-data.ts` verifies the stable internal plugin ID `open-pencil`, imports arbitrary plugin-data records, and exports them through `mergePluginData()`. `App/tests/engine/scene-graph/plugin-data.test.ts` proves private plugin data survives `.fig` export/reimport. Use this compatibility seam; do not rename the internal plugin ID to OpenPotlood.
- `App/packages/vue/src/shared/input/move-snap.ts` computes existing object edge/centre snapping and writes `state.snapGuides`; `App/packages/scene-graph/src/snap.ts` uses a five-document-unit threshold. There is no verified snap-preference or modifier-bypass interface to extend in this packet.
- `App/src/components/DesignPanel.vue` composes single-selection property sections. New panel UI must follow `PanelSection`, `PanelGrid`, `PanelFieldGroup`, `PanelRail`, `NumberField`, and `IconButton` conventions visible in nearby property sections and use semantic `data-property` locators.
- `App/src/app/document/io/save.ts`, `App/src/app/document/io/read.ts`, and `App/packages/core/src/io/formats/fig/**` are the supported `.fig` save/reopen route. `.pen` is not the normal save format.
- Existing relevant tests are `App/tests/engine/render/canvas/page-guides.test.ts`, `App/tests/engine/render/canvas/layout-grids.test.ts`, `App/tests/engine/io/fig/roundtrip/source-metadata.test.ts`, `App/tests/engine/scene-graph/plugin-data.test.ts`, `App/tests/engine/render/canvas/raster-export.test.ts`, `App/tests/e2e/snap/guides.spec.ts`, `App/tests/e2e/export/basic.spec.ts`, and `App/tests/e2e/canvas/corner-radius-controls.spec.ts`.
- Baseline research run on 2026-07-19: page-guide and layout-grid suites passed `7` tests / `12` assertions. The unrelated imported plugin-relaunch test cannot run because `material3.fig` is an unhydrated Git-LFS pointer; it is excluded from the T-007 gate because frame-guide compatibility is proved with focused synthetic plugin-data round-trips. `raster-export.test.ts` now runs after predecessor maintenance corrected the Windows CanvasKit path.
- Git inspection returns `fatal: not a git repository`; this is expected. Starting SHA-256 receipts include `bun.lock` `1B68CE5A...A17C91`, `package.json` `E99B5DFC...3A126`, `page-guides.ts` `ACD90792...1404`, `layout-grids.ts` `6D07CEBD...6BC5`, `renderer/pipeline.ts` `7301007F...1C1FF`, `editor/pages.ts` `9630593D...ED175`, `useCanvasInput.ts` `11640248...387E0`, `move-snap.ts` `2171B80D...FB02`, and `DesignPanel.vue` `52C0EFB4...08A42`. Recompute full hashes at execution start.
- Current shipped source version is OpenPotlood `0.1.2` in `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`. T-004's report records the installed executable at `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`; this evidence must be refreshed after T-005 and T-006.

### Fixed implementation decisions

- Page guides are current-page `.fig` guide records. Preserve the complete raw array and modify only the indexed valid `{axis, offset}` record; never filter out malformed or future records during write-back.
- Frame settings belong only to a single selected, rotation-zero `FRAME`. Do not expose them for pages, groups, sections, shapes, components, component sets, instances, multi-selection, or rotated frames in this slice.
- Store frame settings as one private plugin-data entry with `pluginId: 'open-pencil'`, `key: 'frameGuides'`, and JSON shape `{ "version": 1, "margins": { "enabled": boolean, "linked": boolean, "top": number, "right": number, "bottom": number, "left": number }, "bleed": { same fields } }`. Preserve every unrelated plugin-data entry and reject malformed or unsupported versions to safe disabled defaults.
- Defaults are disabled, linked, and `16` pixels on every side. UI and parser accept finite values only and clamp to `0..100000`. Margin commits must also keep `left + right < frame.width` and `top + bottom < frame.height`; clamp the edited side against the opposite side. Bleed has no frame-size maximum because it is outside the frame.
- Linked edits set all four values to the committed number. Unlinking retains current values. Relinking copies the current top value to all four sides. Toggling visibility changes only `enabled` and retains values.
- Render margins as a one-screen-pixel cyan inset rectangle and bleed as a one-screen-pixel red outset rectangle in the frame's local transform. Use named constants and CanvasKit paints; do not create scene nodes or persist colours.
- The existing Rulers toggle is the global guide-visibility/snap switch for this bounded slice. When off, rulers, page guides, imported layout grids, margins, bleed, and guide snapping are absent. Per-frame `enabled` still controls each frame overlay when rulers are on.
- Snap moved selection edges and centres to visible page-guide positions; snap children of an eligible frame to its visible margin and bleed edges. Reuse the existing five-document-unit threshold and current `SnapGuide` feedback. Existing sibling snap wins ties; do not add preferences, keyboard bypass, rotation snapping, or auto-layout reflow.
- All guide, layout-grid, margin, and bleed drawing is editor-only. `RenderOverlays` must carry an explicit live-editor guide flag so `renderFromEditorState()` can include overlays and `renderSceneToCanvas()`/exports cannot. T-008 owns real bleed export bounds, crop marks, unit/DPI policy, CMYK, and print-ready PDF semantics.

### Current official research (accessed 2026-07-19)

- Figma, `https://help.figma.com/hc/en-us/articles/360040449713-Add-guides-to-the-canvas-or-frames`: guides are created from rulers and removed by returning them to rulers, Delete, or context action. This packet uses the ruler drag/return subset.
- Figma, `https://help.figma.com/hc/en-us/articles/360040450513-Create-layout-guides`: layout guides are frame visual aids; stretch column/row guides use margins and gutters; multiple guide overlays may coexist; they are distinct from auto-layout grid.
- Figma installed official typings, `App/node_modules/@figma/plugin-typings/plugin-api.d.ts:4532` and `:4539`: the technical `Guide` and `LayoutGrid` field contracts above match the live dependency.
- Adobe InDesign, `https://helpx.adobe.com/indesign/desktop/print/page-set-up-and-printer-marks/print-bleed-and-slug-areas.html`: real bleed extends beyond trim and affects print/PDF output. This is the basis for explicitly labelling T-007's bleed as guidance only and deferring output geometry to T-008.

### Assumptions requiring audit before READY

- T-005 and T-006 do not replace the active editor state, ruler visibility, CanvasKit pipeline, property-panel composition, `.fig` raw-field/plugin-data seams, move-snap path, export routes, version policy, or installed executable path.
- The user accepts pixel/document units and display-only bleed for T-007; no DPI, millimetre conversion, print marks, or expanded export bounds are implied.
- No competing `open-pencil/frameGuides` plugin-data key appears before implementation.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- `Plan/Packets/T-006-effects.md`
- `App/AGENTS.md`
- `App/packages/core/src/canvas/page-guides.ts`
- `App/packages/core/src/canvas/layout-grids.ts`
- `App/packages/core/src/canvas/renderer/pipeline.ts`
- `App/packages/core/src/canvas/renderer/types.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/core/src/editor/pages.ts`
- `App/packages/core/src/editor/create.ts`
- `App/packages/core/src/editor/state.ts`
- `App/packages/core/src/editor/types.ts`
- `App/packages/core/src/kiwi/fig/node-change/plugin-data.ts`
- `App/packages/core/src/kiwi/fig/node-change/convert.ts`
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts`
- `App/packages/scene-graph/src/source-metadata.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/shared/input/move-snap.ts`
- `App/packages/vue/src/canvas/surface/overlays.ts`
- `App/src/components/DesignPanel.vue`
- `App/src/components/properties/AppearanceSection.vue`
- `App/tests/engine/io/fig/roundtrip/source-metadata.test.ts`
- `App/tests/engine/scene-graph/plugin-data.test.ts`
- `App/tests/e2e/export/basic.spec.ts`

## Allowed Changes

- `App/packages/core/src/guides/frame.ts` (new shared types, defaults, parser, plugin-data read/write helpers)
- `App/packages/core/src/editor/pages.ts`
- `App/packages/core/src/editor/create.ts`
- `App/packages/core/src/editor/index.ts`
- `App/packages/core/src/editor/state.ts`
- `App/packages/core/src/editor/types.ts`
- `App/packages/core/src/canvas/page-guides.ts`
- `App/packages/core/src/canvas/frame-guides.ts` (new renderer helper)
- `App/packages/core/src/canvas/layout-grids.ts`
- `App/packages/core/src/canvas/renderer/pipeline.ts`
- `App/packages/core/src/canvas/renderer/types.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/vue/src/shared/input/page-guides.ts` (new coordinate/hit-test helpers)
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/shared/input/move-snap.ts`
- `App/packages/vue/src/shared/input/move.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/vue/src/canvas/surface/overlays.ts`
- `App/src/components/properties/GuidesSection.vue` (new property section)
- `App/src/components/DesignPanel.vue`
- `App/packages/vue/src/i18n/messages/panels.ts`
- Existing `App/packages/vue/src/i18n/locales/*/panels.json` files only for new guide labels
- `App/tests/engine/editor/page-guides.test.ts` (new)
- `App/tests/engine/editor/frame-guides.test.ts` (new)
- `App/tests/engine/vue/input/page-guides.test.ts` (new)
- `App/tests/engine/vue/input/guide-snap.test.ts` (new or focused additions beside `move-snap` tests if a verified closer owner exists)
- `App/tests/engine/render/canvas/page-guides.test.ts`
- `App/tests/engine/render/canvas/layout-grids.test.ts`
- `App/tests/engine/render/canvas/frame-guides.test.ts` (new)
- `App/tests/engine/render/canvas/raster-export.test.ts`
- `App/tests/engine/io/fig/roundtrip/source-metadata.test.ts`
- `App/tests/engine/io/fig/roundtrip/frame-guides.test.ts` (new)
- `App/tests/e2e/editor/guides.spec.ts` (new)
- `App/tests/e2e/export/basic.spec.ts`
- `App/tests/e2e/canvas/corner-radius-controls.spec.ts` only if a T-007 regression requires a locator/setup correction; do not alter radius expectations
- `App/CHANGELOG.md`
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only after all pre-build checks pass

## Restrictions and Exclusions

- Do not edit any file under `Toolbox/`, copy the previous-project implementation, or treat it as completion evidence. It was inspected only as non-authoritative historical input; all packet facts above were rechecked against live `App/`.
- Do not change project goal, task order, T-007 dependency on T-006, T-005/T-006 state, or any other packet.
- Do not start T-007 until T-006 is DONE/VERIFIED, T-007 is READY, and no other task is IN PROGRESS. Preparation does not waive this gate.
- Do not initialise Git or use branches, worktrees, commits, tags, pull requests, releases, updater work, publishing, deployment, signing, or copied-resource execution.
- Do not add a runtime dependency, unit library, DPI preference, print document model, new file format, universal canvas grid, auto-layout grid, guide style library, or new snap-preference system.
- Do not store page guides, margins, or bleed as visible scene nodes. They must not appear in layers, copy/paste content, thumbnails, or artwork exports.
- Do not repurpose Figma `layoutGrids` with invented `MARGIN` or `BLEED` enum values. Preserve imported layout grids and use the exact private plugin-data contract for frame margins/bleed.
- Do not discard malformed guide entries, layout-grid fields, style/variable references, unknown plugin data, source IDs, or raw metadata while editing one supported field.
- Do not make bleed print-ready, expand PNG/JPEG/SVG/PDF bounds, add crop/registration marks, or claim millimetres. Those choices remain T-008 scope.
- Do not add Delete-key/context-menu guide deletion, frame-level ruler guides, rotated-frame snapping, colour controls, guide locks, presets, or per-page global guide lists. Return-to-ruler deletion is the bounded interaction.
- Do not alter T-004 corner-radius geometry, hit testing, drag semantics, controls, or model. Run the regression and report any failure.
- Do not increment the app version before focused tests, `.fig` round-trip, export exclusion, E2E, and `bun run check` all pass. Do not retain a completed version if build/install/launch verification fails.
- Do not use `bun run format:check`; it invokes Git and is invalid in this intentionally non-Git project. Format only touched files.

## Implementation Steps

1. Re-read `Toolbox/Project-History/PROJECT.md`, `Plan/plan.md`, T-006's final VERIFIED packet/report, this packet, and `App/AGENTS.md`. Require T-006 DONE/VERIFIED, T-007 READY, `Active task: T-007`, and no competing guide implementation/key. Confirm the three shipped version files equal the verified installed T-006 version. Stop before editing on any mismatch.
2. Confirm every allowed existing path/interface still exists. Run the baseline page-guide/layout-grid/source-metadata tests and focused synthetic plugin-data round-trips. The unrelated `material3.fig` relaunch test may remain excluded while it is an unhydrated Git-LFS pointer; do not weaken or skip any focused `frameGuides` compatibility assertion.
3. Record SHA-256 for `bun.lock`, all allowed existing files actually touched, the T-006 installer report, and the installed executable. Because there is no Git, these hashes are the starting-state receipt.
4. Add `App/packages/core/src/guides/frame.ts` with named `FrameEdgeGuide`, `FrameGuides`, `FRAME_GUIDES_PLUGIN_ID = 'open-pencil'`, `FRAME_GUIDES_PLUGIN_KEY = 'frameGuides'`, version `1`, exact disabled/linked/16 defaults, finite/clamp validators, defensive JSON parsing, and immutable helpers that replace only the matching plugin-data entry. Return safe defaults for missing, malformed, array, wrong-version, non-finite, or out-of-range payloads.
5. Add focused frame-guide model tests first. Assert exact defaults/schema, linked/unlinked patches, per-side clamps, margin non-crossing constraints, bleed range, malformed/wrong-version fallback, stable JSON, replacement without duplicate matching entries, and preservation of unrelated private/shared plugin data.
6. In `editor/pages.ts`, export `PageGuideAxis` and `PageGuide`, validate only finite `X|Y` records, and add `getPageGuides`, begin/preview/commit/cancel mutation helpers, plus add/move/remove convenience actions. Resolve visible indices against valid entries but write back a structured clone of the complete raw array so unknown entries retain order and identity.
7. Use `graph.preserveSourceMetadataDuring()` for page-guide source writes. A preview requests repaint/render but creates no undo entry. A successful create, move, or remove commit pushes exactly one labelled undo entry containing structured-cloned before/after source; a cancelled/no-op gesture restores the before source and leaves undo unchanged.
8. Assemble the page-guide actions in `editor/create.ts` and export the public types from `editor/index.ts`. Add tests proving add/move/remove, one-step undo/redo, cancellation, no-op and invalid-input handling, current-page ownership, page isolation, and preservation of unknown guide and sibling raw metadata.
9. Add `packages/vue/src/shared/input/page-guides.ts` with pure screen-space ruler-region, coordinate conversion, and nearest-guide hit-test helpers. Use `RULER_SIZE`; top ruler maps to horizontal `Y`, left ruler maps to vertical `X`; the top-left ruler square starts nothing; hit radius is a named six-screen-pixel constant independent of zoom.
10. Add `DragPageGuide` to the existing union without disturbing `DragRadius`. In `useCanvasInput.ts`, allow guide gestures only with Select active, rulers visible, no text/node/padding edit, and primary-button input. Start new guides only inside a ruler; start existing-guide moves by nearest screen hit.
11. During drag, preview the world offset using current pan/zoom. On mouseup in the canvas, commit once; on mouseup over either ruler, cancel a newly created guide or remove an existing guide; on Escape, mouse cancellation, page switch, or unmount, restore the pre-drag source and create no undo entry. Reset cursor/drag state in every exit path.
12. Extend page-guide rendering tests for pan/zoom, both axes, malformed records, preview updates, and constant one-screen-pixel lines. Guard `drawPageGuides()` and ruler hit handling with the live ruler visibility state.
13. Fix `createRulerVisibility()` so the app's existing `state.showRulers` participates along with explicit `showRulers: false`, mobile, and `no-rulers`. Add a focused visibility test: toggling the existing ZoomDropdown action requests repaint and hides/shows rulers and all guide overlays without deleting stored data.
14. Add editor actions for frame settings using the shared model helper. Expose `getFrameGuides(frameId)`, `updateFrameGuides(frameId, patch, label)`, and reset/remove behaviour only for rotation-zero `FRAME`. Use one structured clone, one plugin-data replacement, `graph.updateNode()` inside the preservation boundary, one undo entry per committed field/toggle/link action, and no entry on focus/no-op/invalid input.
15. Add `canvas/frame-guides.ts`. Draw enabled margins as an inset rectangle and bleed as an outset rectangle after the frame transform is applied. Keep stroke width `1 / zoom` in document space so the visible line is one screen pixel; use named cyan/red constants and restore shared paint state after drawing.
16. Add `showEditorGuides: boolean` to `RenderOverlays`. Set it true only in live `renderFromEditorState()` when rulers are visible; leave it false/absent in `renderSceneToCanvas()` and all export/thumbnail callers. In `scene.ts`, call imported `drawLayoutGrids()` and new `drawFrameGuides()` only under this flag. Expected result: live overlays remain visible, while raster exports no longer contain imported layout grids or new frame guides.
17. Add renderer tests for linked/unlinked inset/outset geometry, zero/maximum values, hidden/default settings, malformed plugin data, rotation-zero ownership, one-screen-pixel stroke at multiple zooms, and paint-state cleanup. Extend layout-grid tests to prove the explicit editor flag controls drawing.
18. Extend `move-snap.ts` with pure candidate collection. Preserve current sibling edge/centre results first; when guide visibility is on, compare page guide coordinates to moved selection left/centre/right and top/centre/bottom, then eligible parent-frame margin/bleed edges. Use the existing five-unit threshold and existing `SnapGuide` structures; do not mutate stored guides.
19. Change `handleMoveMove()` only as needed to pass live ruler/guide visibility into snap calculation. Add focused tests for both axes, pan-independent document coordinates, sibling tie priority, hidden rulers, disabled margins/bleed, child-in-frame ownership, non-frame/rotated frame exclusion, and cleared feedback on mouseup/cancel.
20. Create `GuidesSection.vue` following current property-panel primitives. Render it in `DesignPanel.vue` only for exactly one selected rotation-zero `FRAME`, between Layout/Appearance and paint sections. Do not render an empty placeholder elsewhere.
21. The section contains Margins and Bleed rows. Each has an eye toggle, linked/unlinked toggle, and either one labelled pixel field when linked or four fields labelled T/R/B/L when unlinked. Use `NumberField`, `PanelGrid`, `PanelFieldGroup`, `PanelRail`, `IconButton`, accessible labels, `data-property="frame-guides-margins"` / `frame-guides-bleed`, finite non-negative commits, and no mutation on focus.
22. Add English labels to `i18n/messages/panels.ts` and mirror the same keys into every existing locale `panels.json`. Use `Margins`, `Bleed`, `Link sides`, `Unlink sides`, `Top`, `Right`, `Bottom`, `Left`, `Show`, and `Hide`; do not embed shortcuts or create locale files.
23. Add `.fig` round-trip tests: native page guides including unknown neighbouring fields preserve exact order; a frame's exact `open-pencil/frameGuides` payload and unrelated plugin data survive export/reimport; repeated edits create one matching entry; malformed payload is retained on untouched nodes but safely ignored by the UI/parser.
24. Add export-exclusion tests. For identical artwork with guide/layout-grid/plugin metadata enabled vs disabled, assert equal PNG pixels/dimensions and equal SVG artwork output. Extend `e2e/export/basic.spec.ts` to export PNG, JPEG, SVG, and PDF from a frame with obvious margins/bleed/imported layout grid and assert no cyan/red/grid overlay is visible in opened results. Do not change output bounds.
25. Add `e2e/editor/guides.spec.ts`: create horizontal and vertical guides from rulers; inspect exact valid page records; move one at non-default pan/zoom; remove by returning it to a ruler; assert each gesture is one undo/redo step; toggle rulers off/on; switch pages; and assert stored guides remain page-scoped.
26. In the same E2E file, select one unrotated frame, enable linked margins and bleed, edit values, unlink and edit one side, resize the frame, move a child to each visible boundary and prove snapping/feedback, save/export `.fig`, reopen, and assert values/visibility persist. Assert the Guides section is absent for rectangle, group, rotated frame, and multi-selection.
27. Add deterministic CanvasKit screenshots at default and non-default zoom showing page guides plus selected-frame margins/bleed. Clear selection when proving persistent overlay visibility. Update only the new Windows baselines, inspect them, and rerun without update mode.
28. Run the unchanged T-004 corner-radius E2E as a regression. It must still show rectangle node controls, uniform/independent click-drag updates, and its existing assertions; T-007 makes no radius change.
29. Add one concise `Unreleased > Changed` entry: editable page guides plus frame margin and display-only bleed guidance, with overlays excluded from exports. Do not claim print-ready bleed.
30. Format only touched files, run the exact focused checks below, then `bun run check`. Fix only T-007 failures. Stop and record unrelated failures instead of widening scope.
31. After every pre-build check passes, compute the next minor version from the verified T-006 installed version and synchronise exactly `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`. Do not change workspace-package versions.
32. Re-run focused tests after version edit, record `$buildStart`, create exactly one fresh x64 MSVC NSIS installer, hash it twice, install silently with uppercase `/S`, and verify the installed executable path, OpenPotlood product/version identity, SHA-256, exact-path launch, title, non-zero handle, and `Responding=True` twice using T-002's established commands.
33. In installed OpenPotlood, repeat page-guide create/move/remove and margin/bleed linked/unlinked edits. Save to a task-specific temporary `.fig`, close/reopen it, verify overlay values and snapping, export all four requested formats and visually confirm overlays are absent, then close/relaunch and reopen the `.fig` again.
34. Record absolute `.fig`, export, installer, and executable paths/hashes plus observed values. Run the pipeline validator, append the execution report, and leave packet/task advancement to audit. Do not mark VERIFIED or DONE during execution.

## Acceptance Criteria

- [ ] Rulers honour the existing visibility state; hiding them removes rulers, page guides, imported layout grids, margins, bleed, and guide snapping without deleting stored values.
- [ ] Dragging from top/left rulers creates one horizontal `Y` / vertical `X` current-page guide; moving and return-to-ruler removal work at multiple pan/zoom values.
- [ ] Each complete page-guide create, move, or remove gesture is exactly one undo/redo entry; Escape/cancel/no-op creates none.
- [ ] Page-guide writes retain malformed/future entries and unrelated raw metadata in exact order; guides remain page-scoped and `.fig` round-trip safe.
- [ ] Exactly one selected rotation-zero `FRAME` shows the Guides section; ineligible selection states do not.
- [ ] Margins and bleed default disabled/linked/16 px, support linked and independent finite values, retain values when hidden, and undo/redo one committed edit at a time.
- [ ] Margins render cyan inside the frame without crossing its interior; bleed renders red outside it; both remain one screen pixel at tested zooms and follow frame move/resize.
- [ ] Stored frame settings use exactly one version-1 `open-pencil/frameGuides` plugin-data entry and preserve unrelated plugin data. Malformed/unknown versions fail safe without data loss.
- [ ] Visible page guides and eligible frame edges participate in movement snapping with sibling-snap tie priority and existing feedback; hidden/ineligible guides do not.
- [ ] Page guides, imported layout grids, margins, and bleed remain editor-only and are absent from PNG, JPEG, SVG, PDF, thumbnails, copied artwork, and the layer tree; output dimensions/bounds do not change.
- [ ] Real print bleed, crop marks, DPI/mm conversion, and export-bound expansion are neither implemented nor claimed; T-008 remains responsible.
- [ ] T-004's corner-radius E2E passes unchanged and no radius application file changes.
- [ ] Focused model/input/render/snap/round-trip/export suites, i18n, E2E, screenshots, `bun run check`, Cargo check, and Tauri NSIS build all exit `0`.
- [ ] The completed update uses the next minor version after verified T-006; the three version files, installer, installed executable, and VersionInfo agree.
- [ ] One fresh installer is hashed, installed, and launched from the exact installed path; installed guide/margin/bleed/save/reopen/export/relaunch behaviour passes and the process remains responsive.
- [ ] No application/resource file outside Allowed Changes changes; no Git/release/updater/publishing/deployment action occurs; audit owns READY-to-VERIFIED/DONE advancement.

## Verification

Run from `App/` unless stated otherwise:

1. `bun test ./tests/engine/editor/page-guides.test.ts ./tests/engine/editor/frame-guides.test.ts ./tests/engine/vue/input/page-guides.test.ts ./tests/engine/vue/input/guide-snap.test.ts ./tests/engine/render/canvas/page-guides.test.ts ./tests/engine/render/canvas/layout-grids.test.ts ./tests/engine/render/canvas/frame-guides.test.ts` — expect exit `0` with all model, undo, coordinate, visibility, geometry, and snapping assertions passing.
2. `bun test ./tests/engine/io/fig/roundtrip/source-metadata.test.ts ./tests/engine/io/fig/roundtrip/frame-guides.test.ts ./tests/engine/render/canvas/raster-export.test.ts` — expect exit `0`; exact page/plugin records survive and overlay/no-overlay artwork pixels are equal. Stop if CanvasKit again resolves `\C:\...` or any fixture is invalid.
3. `bun run check:i18n` — expect exit `0` with no missing/extra guide labels across existing locales.
4. `bunx playwright test tests/e2e/editor/guides.spec.ts --project=openpencil` — expect exit `0` with ruler toggle, both guide axes, move/delete, one-step undo/redo, frame UI, snapping, page scope, and `.fig` reopen assertions passing.
5. `bunx playwright test tests/e2e/export/basic.spec.ts --project=openpencil -g "guides|margins|bleed"` — expect exit `0`; PNG/JPEG/SVG/PDF contain artwork but no editor overlays and retain unchanged bounds.
6. `bunx playwright test tests/e2e/editor/guides.spec.ts --project=openpencil -g "visual" --update-snapshots` — only when creating the new Windows baselines; expect only new T-007 snapshot files. Inspect them, then rerun the same command without `--update-snapshots` and expect exact configured matches.
7. `bunx playwright test tests/e2e/snap/guides.spec.ts tests/e2e/canvas/corner-radius-controls.spec.ts --project=openpencil` — expect exit `0` and no snap/radius regression.
8. `bun run check` — expect exit `0`. Do not run `format:check` because it requires Git.
9. From the project root, run `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique`; expect one value equal to the next minor after the verified T-006 installed version.
10. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.
11. Record `$buildStart=(Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`; expect exit `0`, a release executable, and exactly one fresh `OpenPotlood_*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
12. From the project root, run `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File | Where-Object {$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; $hash1=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; $hash2=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; if($hash1 -ne $hash2){throw 'Installer hash changed before install'}; "$($installer[0].FullName)|$hash1"` — expect one path and stable hash.
13. Install with `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}`; expect no exception. Reuse T-002's refreshed installed-path, `VersionInfo`, SHA-256, exact-path launch, title/handle, and repeated responsiveness checks.
14. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` Record but do not advance T-007.

## Integration or Installed-Result Check

- Mandatory and indivisible: focused tests -> i18n -> interaction/export E2E -> inspected snapshots -> quality gate -> synchronised next-minor version -> Cargo check -> one fresh NSIS build -> stable installer hash -> silent install -> installed identity/version/hash -> exact-path launch -> real guide/margin/bleed interaction -> `.fig` save/reopen -> all-format overlay exclusion -> relaunch/reopen -> repeated responsiveness.
- Use installed OpenPotlood, not Vite, an old installer, OpenPencil, OpenPencil Studio, or `Toolbox/`. Record exact paths and hashes.
- Real-app proof must include both page-guide axes, a move, return-to-ruler deletion, undo/redo, ruler hide/show, linked/unlinked margin and bleed edits, child snapping, `.fig` reopen, app relaunch/reopen, and visual inspection of PNG/JPEG/SVG/PDF without overlays or changed bounds.
- The installed check must state explicitly that the bleed is a non-printing guide and no real print/export bleed was delivered.

## Stop Conditions

- T-006 is not DONE/VERIFIED, T-007 is not READY/active for execution, another task is IN PROGRESS, predecessor reports are missing, or shipped/installed predecessor versions disagree.
- T-005 or T-006 moved/replaced any prepared ruler, input, render, metadata, panel, snap, export, build, or installed-path seam. Return to audit; do not adapt silently.
- `open-pencil/frameGuides` already exists with a different schema, the internal plugin ID changed, or plugin-data round-trip does not preserve an exact version-1 record and unrelated entries.
- Page-guide editing would require filtering/rebuilding the raw array, dropping unknown fields, changing Kiwi schema, or clearing unrelated source metadata.
- Product scope changes to frame-level ruler guides, rotated-frame editing/snapping, guide locks/styles/presets, millimetres/DPI, real bleed, crop marks, output-bound changes, or print-ready PDF. Route that decision to T-008/plan amendment.
- CanvasKit/raster tests again fail before T-007 changes with the malformed `\C:\...\canvaskit.wasm` path, dependencies are absent/unusable, focused synthetic plugin-data round-trips fail, or baseline guide/layout-grid tests fail. Restore environment evidence; do not code around it in the feature. The unrelated unhydrated `material3.fig` relaunch fixture is recorded but is not a T-007 gate.
- Imported layout grids cannot be excluded from export without changing artwork rendering semantics or existing visual tests regress outside overlay removal.
- Margin values would invert/cross the frame, non-finite data reaches CanvasKit, snapping changes existing sibling results, or guide interaction steals radius/text/node/auto-layout pointer ownership.
- Any new/changed test, i18n, E2E, snapshot, `bun run check`, Cargo, build, installer count/hash, install, identity/version, launch, save/reopen, export inspection, relaunch, title/handle, or responsiveness check fails.
- T-004 corner-radius regression fails or implementation would require editing radius files/expectations.
- Completion requires a file outside Allowed Changes, a new dependency, Git/release/updater/publishing machinery, destructive action, or an unapproved design decision.

## Execution Report Contract

- Report result, predecessor/T-007 versions, files changed, starting/final hashes, commands and actual outputs, test counts, snapshot names inspected, exact guide/frame values, plugin-data and `.fig` evidence, export paths/hashes and overlay observations, installer/executable paths/hashes, installed `VersionInfo`, process ID/title/handle/responsiveness, deviations, and mess or concerns.
- State explicitly that frame margins/bleed use version-1 `open-pencil/frameGuides`, all guide overlays are editor-only, real print bleed remains T-008 scope, corner-radius code was unchanged, application code changed during execution, and packet/task advancement was left to audit.

## Status record

Status: **Done**
