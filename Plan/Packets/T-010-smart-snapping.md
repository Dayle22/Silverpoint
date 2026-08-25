# T-010 — Deliver smart snapping and visual alignment guides

Task ID: T-010
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-007
Prepared against: Live `App/` source and tests on 2026-07-20; T-007/T-008 are DONE/VERIFIED. A same-day route review confirmed that blocked T-009 is unrelated to snapping and that the packet may proceed with a bounded live preflight.
Last expanded: 2026-07-20

## Request Coverage

- Live edge, centre, spacing, and alignment feedback: extend the existing transient `SnapGuide`/CanvasKit overlay model while dragging and resizing; do not persist any guide, preference, or annotation in `.fig`.
- Predictable snapping: use the existing strictly-less-than-five-document-unit threshold, one deterministic winner per axis, and stable target ordering.
- Visual clarity: draw the chosen alignment lines and equal-gap spacing markers only for the active interaction; clear them on mouse-up, cancelled drag, or bypass.
- Temporary bypass: holding `Ctrl` during a Windows move or resize disables every T-010 object/spacing snap and clears its feedback immediately. `Alt` remains duplicate-drag; `Shift` remains aspect-ratio resize; page/margin/bleed snapping and ruler visibility retain T-007 behaviour.
- Compatibility: retain T-007 page/margin/bleed snap semantics and all `.fig` raw/plugin-data round trips. Smart guides are editor-only and never appear in exported artwork, thumbnails, layer trees, copy/paste, or saved document data.
- Local delivery boundary: no Git, worktree, branch, tag, pull request, release/updater/publishing/deployment/signing work or `Toolbox/` execution. Build/install evidence is required only when the later execution packet is eligible.

## User-Visible Outcome

In the installed Windows app, moving a selection within one parent snaps its visible bounding-box edges or centres to sibling bounds and shows cyan alignment feedback. When the moving item sits between two unselected siblings, it also snaps to their equal horizontal or vertical gap and shows two equal-gap markers. Resizing one unrotated selected node snaps only its moving edge(s) to sibling edges/centres and shows the corresponding alignment line. Holding Ctrl lets the user place the object or size freely for as long as it is held. The feedback disappears when the gesture ends and has no document/export effect.

## Verified Starting State

### Verified facts

- `App/packages/scene-graph/src/snap.ts` owns `SNAP_THRESHOLD = 5`, `SnapGuide`, `SnapResult`, `computeSnap()` and `computeSelectionBounds()`. It uses rotated bounding boxes, excludes `movingIds`, and currently implements object edge/centre snapping only. It has no spacing candidate or explicit tie-break contract.
- `App/packages/vue/src/shared/input/move-snap.ts#applyMoveSnap()` adapts the selection to absolute sibling coordinates, calls `computeSnap()`, writes transient guides through `editor.setSnapGuides()`, and preserves T-007 precedence: sibling snap wins over page/margin/bleed guide snap per axis. `App/packages/vue/src/shared/input/move.ts#handleMoveMove()` applies the result to preview positions and `handleMoveUp()` clears feedback.
- T-007 already makes page/margin/bleed snapping conditional on `state.showRulers`; its focused `guide-snap.test.ts` proves page-guide edges/centres and enabled-frame-margin snapping. Do not merge or replace this path.
- `App/packages/vue/src/shared/input/resize.ts#applyResize()` previews a single node’s calculated rectangle and `commitResizePreview()` makes one undo entry. `useCanvasInput.ts` passes Shift to resize but currently passes no transient modifier to move snapping and performs no resize snapping.
- `App/packages/core/src/editor/selection/overlays.ts#setSnapGuides()` is the typed transient state/repaint action. `RenderOverlays.snapGuides` flows through `App/packages/core/src/canvas/renderer/pipeline.ts` to `drawSnapGuides()` in `App/packages/core/src/canvas/overlays/feedback.ts`; the editor-only `renderSceneToCanvas()` export route does not supply overlays.
- Existing focused evidence on 2026-07-20: `bun test ./tests/engine/snap/basic.test.ts ./tests/engine/vue/input/guide-snap.test.ts` passed `11` tests / `17` expectations; `bunx playwright test tests/e2e/snap/guides.spec.ts --project=openpencil` passed `2` tests. Playwright emitted pre-existing optional CanvasKit WebGPU vendor-copy warnings but no test failed.
- This intentionally local project has no Git metadata; `git status --short` returns `fatal: not a git repository`. The pipeline validator passed on 2026-07-20.

### Official research

- Figma’s current alignment/position documentation says Snap to settings can be disabled temporarily with Ctrl during the interaction. Source: https://help.figma.com/hc/en-us/articles/360039956914-Adjust-alignment-rotation-and-position
- Figma documents Smart selection as a separate multi-layer arrangement/reorder/spacing-editing system. That product is excluded here; T-010 supplies only transient equal-gap snapping/feedback. Source: https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection

### Fixed implementation decisions

- Do not add a persistent snap preference, menu item, shortcut, document field, plugin-data key, or new dependency. Snapping is active by default and Ctrl is the only temporary bypass.
- Use the existing document-space threshold: a candidate is eligible only when `abs(delta) < 5`; exactly `5` does not snap. Apply threshold before rounding; keep final preview/commit rounding as the existing move/resize paths do.
- Scope object and equal-gap candidates to unselected direct siblings in the moving node’s current parent. Never snap across parents, pages, nested frames, hidden document metadata, locked target state, auto-layout reordering, or new grid/layout systems. Existing move handling remains authoritative for auto-layout/drop-target branches.
- For ordinary move, retain rotated selection bounds and support left/right/centre X plus top/bottom/centre Y alignment. For resize, support one selected node with absolute rotation `0` only; consider only the edge(s) controlled by the active handle (`w/e`, `n/s`, or both for corners). Do not invent centre-resize, multi-selection resize, rotation snapping, or transformed resize geometry.
- Equal-gap candidates apply to ordinary move only. On an axis, derive the gap between the moving bounds and one sibling on each side; snap only when both gaps are non-negative and their difference is eligible. Show two bounded spacing markers for the equal gaps. Do not implement Smart-selection handles, spacing mutation, reflow, reorder, distribute, or tidy-up.
- Resolve each axis independently: smallest absolute delta wins; on equal magnitude choose object alignment before equal-gap spacing, retain T-007 sibling-before-page/margin/bleed precedence, then use current parent child order and the fixed pair order `left,left`, `left,right`, `right,left`, `right,right`, `centre,centre` (analogous vertical order). Emit only the winning axis feedback; do not accumulate competing stale guides.
- Extend `SnapGuide` as a discriminated, transient rendering type rather than encoding spacing in fake nodes. Preserve existing line fields for alignment; add a spacing variant with axis, two bounded segments, and its numeric document-space gap. Draw the gap marker/label in the existing overlay paint/style family and scale label/line thickness with zoom. It must remain readable, not cover selection handles, and be absent from `renderSceneToCanvas()`.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/Project-History/reports/T-007-guides-margins-and-bleed.md`
- `Plan/Packets/T-007-guides-margins-and-bleed.md`
- `App/AGENTS.md`
- `App/packages/scene-graph/src/snap.ts`
- `App/packages/vue/src/shared/input/move-snap.ts`
- `App/packages/vue/src/shared/input/move.ts`
- `App/packages/vue/src/shared/input/resize.ts`
- `App/packages/vue/src/shared/input/resize/start.ts`
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/core/src/editor/selection/overlays.ts`
- `App/packages/core/src/canvas/overlays/feedback.ts`
- `App/packages/core/src/canvas/renderer/types.ts`
- `App/packages/core/src/canvas/renderer/pipeline.ts`
- `App/tests/engine/snap/basic.test.ts`
- `App/tests/engine/vue/input/guide-snap.test.ts`
- `App/tests/e2e/snap/guides.spec.ts`
- `App/tests/e2e/editor/resize-performance.spec.ts`

## Allowed Changes

- `App/packages/scene-graph/src/snap.ts`
- `App/packages/scene-graph/src/index.ts` and `App/packages/core/src/index.ts` only if the focused public type export requires synchronisation
- `App/packages/vue/src/shared/input/move-snap.ts`
- `App/packages/vue/src/shared/input/move.ts`
- `App/packages/vue/src/shared/input/resize.ts`
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/core/src/canvas/overlays/feedback.ts`
- `App/packages/core/src/canvas/renderer.ts`, `App/packages/core/src/canvas/renderer/types.ts`, and `App/packages/core/src/canvas/renderer/methods.ts` only if TypeScript requires the expanded transient `SnapGuide` contract
- `App/tests/engine/snap/basic.test.ts`
- `App/tests/engine/vue/input/guide-snap.test.ts`
- `App/tests/engine/vue/input/resize-snap.test.ts` (new focused test)
- `App/tests/engine/render/canvas/snap-guides.test.ts` (new focused overlay test)
- `App/tests/e2e/snap/guides.spec.ts`
- `App/tests/e2e/editor/resize-performance.spec.ts` only for a proven interaction-regression expectation
- `App/CHANGELOG.md`
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only after all source/E2E checks pass and immediately before the required delivery build

## Restrictions and Exclusions

- Do not start execution while another task is IN PROGRESS. T-009 may remain BLOCKED because it is not a snapping prerequisite.
- Do not alter T-007 page guides, margins, bleed, rulers, raw metadata, plugin data, or their existing sibling-over-guide precedence.
- Do not add Smart selection, tidy-up/distribute, auto-layout reflow, layer reorder, layout grids, persistent preferences, panel/menu UI, document format/schema changes, accessibility annotations, or keyboard remapping.
- Do not alter ordinary move undo, duplicate-drag, aspect-ratio resize, radius controls, rotation, node edit, pen, drop target, selection, export, thumbnail, clipboard, `.fig`, Kiwi, MCP, ACP, or CLI behaviour.
- Do not add dependencies or change `bun.lock`. Do not use Git/release/updater/publishing/deployment/signing machinery or execute `Toolbox/`.

## Implementation Steps

1. Re-read the route and perform a bounded live preflight. Confirm T-010 is READY, no task is IN PROGRESS, T-007 remains VERIFIED, and all source paths above still exist. If those assumptions hold, lock T-010 and continue implementation in this session; stop before edits only on material drift or conflict.
2. Record SHA-256 for every existing Allowed Changes file, the three version files, and `bun.lock`; record non-Git state. Run Verification 1–3 unchanged and stop if any baseline fails.
3. Add failing pure tests in `basic.test.ts` for strict threshold, edge/centre alignment, two-axis independence, rotating move bounds, stable equal-delta order, equal-gap calculation, exclusion of selected/non-sibling/overlapping candidates, and exact feedback variants. Do not modify production code until these tests fail for the stated missing spacing/tie behaviour.
4. Make `snap.ts` a deterministic pure candidate resolver. Keep existing `computeSnap()` consumers working, add a focused move-spacing resolver/type as needed, and return at most one winning alignment or spacing result per axis under the fixed precedence. Preserve existing `SnapGuide` line compatibility and never access Editor/Vue/CanvasKit from scene-graph code.
5. Extend `move-snap.ts` to combine object alignment/equal-gap candidates with the existing T-007 route. Pass a `bypass` boolean from `useCanvasInput.ts` through `handleMoveMove()`; when Ctrl is held, clear snap feedback and return raw deltas. When released, recompute from the original drag coordinates; do not retain a snapped offset. Keep Alt duplication and all auto-layout/drop-target early returns unchanged.
6. Add the resize-specific pure/input test first. From the already-calculated preview rectangle, snap only the active handle’s moving edge(s) to eligible sibling edges/centres, adjust only that rectangle edge/size, set transient line feedback, and retain `applyResize()` preview plus `commitResizePreview()`’s one undo entry. Skip snapping and clear feedback for rotated or multi-node resize, Ctrl bypass, or no candidate.
7. Update `feedback.ts` and only necessary renderer declarations/types to draw alignment and equal-gap feedback from the expanded union type. Test exact drawing input/absence, zoom scaling, and that the export-only renderer path receives no smart-feedback overlay. Do not introduce scene nodes or persisted state.
8. Extend the existing E2E spec with deterministic move edge, centre, equal-gap, Ctrl bypass, and feedback-clears-on-release checks. Add one single-node resize edge alignment and Ctrl bypass check. Preserve the existing two screenshot-difference tests and skip convention; no test may rely solely on a screenshot when final geometry can be asserted through the test bridge.
9. Run all focused tests. Update `CHANGELOG.md` only after green behaviour is proven. Then run the full quality/build/install loop and version bump specified below; do not retain the version change if any delivery gate fails.

## Acceptance Criteria

- [ ] Moving supports edge and centre alignment to direct unselected siblings, at `abs(delta) < 5` only, and produces at most one deterministic result per axis.
- [ ] Moving between two direct siblings snaps to equal non-negative horizontal/vertical gaps within threshold and draws two bounded equal-gap markers; it never reorders/reflows objects.
- [ ] Ctrl held mid-drag or mid-resize returns unsnapped geometry and clears feedback immediately; releasing Ctrl recomputes normally. Alt duplicate drag and Shift constrained resize remain unchanged.
- [ ] Single unrotated-node resize snaps its moving handle edge(s) to sibling edges/centres, draws an alignment line, preserves aspect constraint/undo, and never changes the anchored edge. Rotated/multi-node resize remains unsnapped without error.
- [ ] T-007 page/margin/bleed snapping still passes and object alignment retains per-axis precedence over those guide candidates.
- [ ] Smart feedback is transient editor-only: clear on commit/cancel, absent from exports/thumbnails/.fig data/layer tree, and no persistent setting/data changes occur.
- [ ] Focused source/E2E tests, `bun run check`, Cargo check, one fresh NSIS build/install, exact installed identity and responsive process checks all pass. The shipped version is the next patch after verified `0.6.0` and agrees in all three version files.

## Verification

Run from `App/` unless stated otherwise:

1. `bun test ./tests/engine/snap/basic.test.ts ./tests/engine/vue/input/guide-snap.test.ts ./tests/engine/vue/input/resize-snap.test.ts ./tests/engine/render/canvas/snap-guides.test.ts` — expect exit `0`; strict threshold, deterministic precedence, spacing, bypass, resize, T-007 regression, and editor-only overlay assertions pass.
2. `bunx playwright test tests/e2e/snap/guides.spec.ts --project=openpencil` — expect exit `0`; existing edge/centre visual tests plus geometry-backed spacing, Ctrl bypass, release-clear, and resize cases pass. Optional CanvasKit WebGPU vendor-copy warnings are non-fatal only if this command exits `0`.
3. `bunx playwright test tests/e2e/editor/resize-performance.spec.ts --project=openpencil` — expect exit `0`; existing resize interaction/performance behaviour is unchanged.
4. `bun test ./tests/engine/vue/input/guide-snap.test.ts` — expect exit `0`; existing page/margin guide visibility and snapping behaviour remains exact.
5. `bun run check` — expect exit `0`; do not run Git-dependent `format:check`.
6. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.
7. Verify the three version values with `$v1=(Get-Content -Raw 'package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique` — expect one value equal to the next patch after `0.6.0`.
8. Record `$buildStart=(Get-Date).ToUniversalTime(); bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` — expect exit `0` and one fresh x64 NSIS installer. Hash it twice, silently install with `/S`, launch `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, and record exact path, VersionInfo, SHA-256, title/handle, and two `Responding=True` observations.
9. In the installed app, create three same-parent rectangles; observe edge, centre, and equal-gap feedback while moving; resize one; hold/release Ctrl in each interaction; save/reopen/relaunch; then export PNG/SVG/PDF and confirm no feedback appears. Record screenshots/geometry and the installed executable identity.
10. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.` Mark T-010 DONE/VERIFIED only after all fresh evidence passes; same-session closure is allowed.

## Integration or Installed-Result Check

- Mandatory when execution becomes eligible: the installed OpenPotlood executable—not Vite, OpenPencil, a resource copy, or a stale installer—must prove object alignment, centre alignment, equal spacing, Ctrl bypass, resize alignment, feedback clearing, T-007 guide coexistence, save/reopen/relaunch, export exclusion, exact version/identity, and repeated responsiveness.

## Stop Conditions

- T-010 is not READY before claim; T-007 evidence is missing; or another task is active.
- Any listed live seam moved/replaced, existing baselines fail, or the fixed T-007 precedence cannot be retained without widening T-007.
- Ctrl conflicts with a verified existing drag action; spacing needs cross-parent/reflow semantics; resize needs transformed/multi-selection geometry; or feedback needs persisted/document data. Return to packet audit rather than improvising.
- A change requires a path outside Allowed Changes, dependency, `bun.lock` change, schema/.fig/Kiwi change, new preferences/menu system, Git/release/updater/publishing/deployment/signing action, or resource execution.
- Any focused test, E2E, quality gate, Cargo check, build, installer/install, installed identity/launch/save/reopen/export observation, or responsiveness check fails.

## Execution Report Contract

- Report prerequisite state; changed files and before/after hashes; commands/exits/test counts; candidate/tie/bypass/spacing/resize evidence; T-007 regressions; installed installer/executable/version/path/hash/title/handle/responsiveness; save/reopen/relaunch/export-exclusion observations; deviations; and mess or concerns. State that smart guides are transient, Ctrl bypasses them, no Smart-selection/reflow/persistent setting was added, and closure occurred only after fresh evidence.

## Status record

Status: **Done**
