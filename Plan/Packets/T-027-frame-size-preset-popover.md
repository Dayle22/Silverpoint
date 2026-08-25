# T-027 — Deliver a frame-size preset popover

Task ID: T-027
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-004
Prepared against: Live `App/` source and tests on 2026-07-20; T-004 is DONE/VERIFIED. T-009 is active, but it is not a T-027 capability prerequisite; do not execute both implementation tasks concurrently.
Last expanded: 2026-07-20

## Request Coverage

- Activating the Frame tool opens a compact popover anchored above the Frame tool in the existing desktop toolbar.
- The visible options are in this exact order: `1080 x 1080`, `1080 x 1920`, `1080 x 1440`, a separator, then `+ Custom`.
- Selecting a preset creates one real editable `FRAME` scene node at the exact pixel dimensions, selects it, exposes it in the Layers panel, and keeps its normal frame/layer editing behaviour. It must never be a flattened bitmap, canvas-only overlay, or transient suggestion.
- `+ Custom` exposes explicit width and height inputs in the same popover and creates a real editable frame only after valid submission.
- Ordinary free-draw frame creation remains available through the existing canvas drag path.
- Dismissal and cancellation are predictable: Escape, outside click, and an explicit Custom cancel close the popover without creating a node; a completed preset/custom action closes the popover after creation.
- Preset creation is undoable as one creation action and redoable with the same dimensions and layer identity semantics supported by the existing editor history.
- The implementation remains local-only, preserves `.fig` round-trip compatibility, and does not add release, Git, resource, dependency, or schema work.

## User-Visible Outcome

In the installed OpenPotlood app, pressing `F` or clicking the Frame tool opens the preset popover above the toolbar button. Clicking a preset immediately creates and selects a live `FRAME` node centred in the currently visible canvas viewport, with exact dimensions `1080×1080`, `1080×1920`, or `1080×1440`; the Frame tool remains active so another preset or free-draw frame can be created. The new frame is visible as a normal row in Layers, can be renamed, resized, moved, and can contain child layers. The popover closes after creation. Choosing `+ Custom` replaces the preset list with width/height fields plus Apply and Cancel; Apply accepts only positive finite integer pixel values, creates the frame at the same viewport-centre placement, and selects it. Invalid values keep the Custom view open with an observable validation message and do not mutate the document.

## Verified Starting State

### Verified facts

- `App/src/components/Toolbar/Toolbar.vue` owns desktop/mobile toolbar composition and passes `toolbarUi` to `DesktopToolbar`/`MobileToolbar`.
- `App/src/components/Toolbar/DesktopToolbar.vue` renders the desktop toolbar at `bottom-4`, centred horizontally, and uses `ToolFlyout` for tool groups.
- `App/src/components/Toolbar/ToolFlyout.vue` uses Reka UI `DropdownMenuRoot`, `DropdownMenuTrigger`, `DropdownMenuContent`, and `DropdownMenuItem`, with `side="top"`, `side-offset="8"`, and the existing `ui?.flyoutContent` class. The Frame tool is the `FRAME`/`SECTION` flyout.
- `App/packages/core/src/editor/tool-registry.ts#EDITOR_TOOLS` defines the Frame flyout as `['FRAME', 'SECTION']`; `TOOL_SHORTCUTS` maps `KeyF` to `FRAME`.
- `App/packages/vue/src/shared/input/draw.ts#startShapeDraw`, `#handleDrawMove`, and `#handleDrawUp` implement the current free-draw path. `startShapeDraw()` calls `editor.undo.beginBatch('Create shape')`, `editor.createShape(...)`, and selects the node; mouse-up supplies the final dimensions, applies the existing 100×100 click fallback, commits the resize batch, and returns to SELECT.
- `App/packages/vue/src/canvas/tool-input/use.ts#handleToolMouseDown` routes every non-select/non-pen/non-text tool to `startShapeDraw`; changing Frame-tool mouse-down behaviour must preserve the existing drag path and its Section-specific adoption logic.
- `App/packages/vue/src/canvas/useCanvasInput.ts#useCanvasInput` owns pointer coordinates and drag state. It calls `handleToolMouseDown()` on canvas mouse-down and `handleDrawMove()`/`handleDrawUp()` for `DragDraw`.
- `App/src/components/LayerTree/LayerTreeNodeRow.vue` renders every layer as `data-test-id="layers-item"`, shows the node icon/name, and supports normal selection, rename, visibility, lock, disclosure, and drag actions. `App/src/components/LayersPanel.vue` supplies the Reka layer-tree selection model.
- `App/tests/helpers/store.ts#getPageChildren`, `getSelectedNode`, and `getNodeById` expose graph type, dimensions, selection, parent/child IDs, and editable properties through `window.openPencil?.getStore?.()`.
- `App/tests/helpers/canvas.ts#CanvasHelper` provides `selectTool('frame')`, canvas drag/click/keyboard helpers, render waits, undo/redo, and browser-error collection.
- `App/tests/e2e/toolbar/basic.spec.ts` already proves the Frame flyout exposes Frame and Section, and `App/tests/e2e/text/editing.spec.ts` already proves a free-drawn Frame creates a `FRAME` node with positive dimensions.
- The project is intentionally non-Git; `git status --short --branch` returns the expected non-repository error. `Toolbox/` is non-authoritative and must not be executed.
- Current private desktop source version is `0.6.0` in `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`. A production change requires the next patch version in all three files, but version edits are forbidden until source/E2E checks are green.

### Official research

- Figma’s current Help Centre says the Frame tool can create a frame by clicking the canvas, by dragging custom dimensions, or by selecting a frame preset; selecting a preset adds a frame to the canvas. It also says frames are identifiable in the Layers panel and can be resized after creation. Source: https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design
- Figma’s current frame-preset lesson describes presets as ready-made frame sizes and the workflow as enabling Frame, choosing a preset, then renaming the resulting frame. Source: https://help.figma.com/hc/en-us/articles/30974070391191-FD4B-Create-a-frame-using-frame-presets
- Figma’s current Layers-panel guidance says new frames/objects are visible in Layers and new layers are added to the relevant page/frame/section. Source: https://help.figma.com/hc/en-us/articles/360039831974-View-layers-and-assets-in-the-Layers-Panel
- The official sources support the editable live-frame and Layers-panel requirement, but do not define OpenPotlood’s toolbar-anchored popover, exact three social-media presets, viewport-centre placement, or Custom validation; those are fixed below for this packet.

### Fixed implementation decisions

- Use a new app-local `FramePresetPopover` component under `App/src/components/Toolbar/` rather than changing the shared Reka UI primitive layer. Reuse the existing `ToolFlyout` trigger placement/styling conventions and Reka UI dismissal/focus behaviour.
- The popover is opened by the Frame group’s primary tool button and by `F`; selecting `SECTION` from the existing flyout still selects Section and does not open the preset popover.
- Preset order and labels are literal and stable: `1080 x 1080`, `1080 x 1920`, `1080 x 1440`, separator, `+ Custom`. Do not localise the dimensions or reorder them; surrounding toolbar labels remain on the existing i18n path.
- A preset or valid Custom submission creates a normal `FRAME` through the existing editor creation/history path, with no image child, no flattened content, no new node type, no schema field, and no overlay-only representation. The frame is selected and appears in Layers as an editable node.
- Place preset/custom frames at the centre of the current visible document viewport using the existing canvas-to-document coordinate conversion. Do not use fixed screen coordinates, page origin, or a hidden arbitrary offset. The packet executor must reuse an existing coordinate helper or add the smallest focused helper at the established canvas/input seam after confirming the exact API during preflight.
- Keep the active tool as `FRAME` after preset/custom creation. Free-draw continues to create by drag; a click without a preset still follows the existing 100×100 click fallback unless the live preflight proves that the new trigger intercepts it.
- Custom starts blank for each opening; do not add remembered dimensions, preferences, local storage, or document metadata. Accept only positive finite integer pixel dimensions; reject blank, non-numeric, fractional, zero, negative, NaN, and Infinity. Do not invent a maximum or add a new range policy.
- Apply is disabled while either field is invalid; invalid submission must still be covered by a test and must not add history or a node. Cancel/Escape/outside dismissal must not add history or change selection.
- A successful creation is exactly one undoable history action. Undo removes the created frame; redo restores one editable `FRAME` with the exact width/height and normal layer row. Do not alter general undo semantics.
- Desktop is mandatory. If mobile toolbar behaviour cannot safely share the component without changing the requested desktop route, preserve mobile behaviour and stop for a bounded follow-up decision rather than widening this packet.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-004-corner-radius-node-controls.md`
- `Toolbox/Project-History/reports/T-004-corner-radius-node-controls.md`
- `App/AGENTS.md`
- `App/src/components/Toolbar/Toolbar.vue`
- `App/src/components/Toolbar/DesktopToolbar.vue`
- `App/src/components/Toolbar/ToolFlyout.vue`
- `App/src/components/Toolbar/ToolButton.vue`
- `App/src/components/Toolbar/types.ts`
- `App/src/components/ui/menu.ts`
- `App/packages/core/src/editor/tool-registry.ts`
- `App/packages/vue/src/shared/input/draw.ts`
- `App/packages/vue/src/canvas/tool-input/use.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/vue/src/shared/input/pointer.ts` or the actual live coordinate helper resolved from `createCanvasPointer()` during preflight
- `App/src/components/LayersPanel.vue`
- `App/src/components/LayerTree/LayerTreeNodeRow.vue`
- `App/tests/helpers/canvas.ts`
- `App/tests/helpers/store.ts`
- `App/tests/helpers/test-ids.ts`
- `App/tests/e2e/toolbar/basic.spec.ts`
- `App/tests/e2e/text/editing.spec.ts`
- `App/tests/e2e/layers/panel.spec.ts`

## Allowed Changes

- `App/src/components/Toolbar/Toolbar.vue` and/or `App/src/components/Toolbar/DesktopToolbar.vue` only to wire the Frame trigger/popover while preserving existing tool-group behaviour.
- `App/src/components/Toolbar/ToolFlyout.vue` only if the live trigger composition requires a focused Frame-specific trigger; do not change unrelated flyouts.
- New `App/src/components/Toolbar/FramePresetPopover.vue` if the existing toolbar components cannot host the controlled popover without duplication.
- The established Vue/core input seam that currently owns Frame creation (`App/packages/vue/src/shared/input/draw.ts`, `App/packages/vue/src/canvas/tool-input/use.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`) only if a preset action must share a typed creation helper with free-draw.
- Existing i18n/menu/test-id files only if required by the established conventions; do not add a second toolbar/menu system.
- `App/tests/e2e/toolbar/basic.spec.ts` or new `App/tests/e2e/toolbar/frame-presets.spec.ts` for UI, graph, layer, keyboard, dismissal, custom validation, and undo/redo coverage.
- `App/tests/helpers/canvas.ts` and `App/tests/helpers/store.ts` only for small reusable assertions proven necessary by the focused E2E test.
- `App/CHANGELOG.md` after all focused behaviour is green.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only after source/E2E checks pass and immediately before a successful delivery build.
- `Toolbox/Project-History/reports/T-027-frame-size-preset-popover.md` during execution for evidence; this packet expansion does not create that report.

## Restrictions and Exclusions

- Do not implement during packet expansion. Do not alter this packet’s task status, route order, dependency, or outcome.
- Do not flatten frames, rasterise presets, create a bitmap/overlay surrogate, hide the result from Layers, or make preset dimensions non-editable.
- Do not remove or weaken free-draw Frame creation, Section creation, Frame flyout behaviour, keyboard shortcuts, selection, rename, resize, layer reorder, or existing undo semantics.
- Do not add device-preset catalogues, responsive constraints, auto-layout defaults, remembered Custom values, persistent preferences, new schema/Kiwi fields, `.fig` format changes, export changes, or a new dependency.
- Do not change mobile UI, global toolbar primitives, unrelated shape flyouts, or general menu/dismissal semantics unless a focused shared fix is proven necessary and remains inside this packet.
- Do not use Git, worktrees, branches, pull requests, tags, release/updater/publishing/deployment/signing machinery, or copied resources.
- Do not bump versions for exploratory, failed, or verification-only work. A bump is required only for a completed production-installed update.

## Implementation Steps

1. Re-read the route and perform a bounded preflight. Confirm T-027 is the selected expansion packet, T-004 is DONE/VERIFIED, no packet state or dependency has drifted, and the live source paths in this packet exist. Do not claim or execute T-027 if another implementation task is active; record that T-009 is currently active and keep this packet expansion-only.
2. Record SHA-256 hashes for the packet, `Plan/plan.md`, the named toolbar/input/layer/test files, the three version files, and `App/bun.lock`; record the expected non-Git status. Do not hash or edit application files during expansion.
3. Build a red-test plan before implementation: add/extend a focused desktop E2E spec that opens Frame with `F` and the toolbar, asserts exact option order and separator, chooses each preset, reads the selected node through `getSelectedNode()`, asserts `type === 'FRAME'` and exact dimensions, asserts a visible matching Layers row, renames/resizes or otherwise edits the frame, and checks no browser errors. The executor must keep the test red for the missing popover behaviour before production edits.
4. Wire one controlled popover state to the existing Frame tool trigger. Keep Section in the current Frame flyout, preserve `F`, use the existing Reka UI/menu focus and dismissal conventions, anchor the content above the Frame tool, and expose stable test IDs/roles for the three presets, separator, Custom, fields, Apply, Cancel, and validation message.
5. Add the fixed preset model in the exact required order and call a shared typed creation action. Place the new frame at the visible viewport centre, select it, leave the active tool as Frame, close the popover, and ensure the created node enters the normal layer tree/history/selection path.
6. Implement Custom as an in-popover form. Validate positive finite integer pixel values; keep invalid input observable and document-unchanged; Apply creates one exact live frame and closes; Cancel, Escape, outside click, and invalid Apply create no node and no undo entry.
7. Preserve the existing canvas free-draw path and Section branch. Add a regression assertion that dragging with Frame still produces a positive-dimension `FRAME`, and that choosing Section from the existing flyout still produces a `SECTION` rather than a preset frame.
8. Add undo/redo, repeated-creation, layer editability, and persistence checks. Verify two successive preset selections create two separate layer rows/nodes; rename and resize one; undo/redo one creation without flattening; save/reopen/relaunch the task-local `.fig` and confirm the frame type, dimensions, name, and editability remain.
9. Run focused source/E2E checks. Update `CHANGELOG.md` only after green checks. If production files changed, synchronise all three versions to the next patch after the verified installed predecessor and run the single fresh NSIS build/install loop below; if no production files changed, do not bump or rebuild merely to claim the feature.
10. Write the execution report with prerequisite state, hashes, changed files, test counts/exits, exact dimensions, placement, popover/dismissal/validation evidence, layer editability, undo/redo, `.fig` persistence, installed identity/responsiveness, deviations, and concerns. Leave task/packet closure to the audit role.

## Acceptance Criteria

- [ ] Frame activation by `F` and the desktop Frame tool exposes one popover anchored above the Frame tool; the exact visible order is `1080 x 1080`, `1080 x 1920`, `1080 x 1440`, separator, `+ Custom`.
- [ ] Each preset creates exactly one live `FRAME` node with exact integer dimensions, selected at creation, placed at the current visible viewport centre, and left with the Frame tool active.
- [ ] The preset frame appears in the Layers panel as a normal editable layer; it can be renamed, resized/moved, and can retain child layers. It is never flattened, rasterised, or overlay-only.
- [ ] Custom exposes width and height inputs plus Apply/Cancel; valid positive finite integer values create exact dimensions; every invalid class leaves the document and history unchanged with an observable validation state.
- [ ] Free-draw Frame drag, Section flyout creation, keyboard shortcuts, normal selection, and existing tool flyouts remain green.
- [ ] Escape, outside click, Custom Cancel, and invalid submission are deterministic no-creation paths; successful creation closes the popover.
- [ ] Preset/custom creation is one undoable action and redo restores the exact live frame dimensions and layer row; repeated creation yields separate nodes.
- [ ] Frame type, dimensions, name, child/layer relationship, and editability survive `.fig` save/reopen/relaunch; exports contain artwork only and no popover/editor state.
- [ ] Focused E2E/source checks, `bun run check`, and (for production changes) Cargo/build/install/identity/responsiveness checks pass with observable evidence.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App` unless stated otherwise:

1. `bunx playwright test tests/e2e/toolbar/frame-presets.spec.ts --project=openpencil` (or the exact existing spec path if the focused tests are added to `toolbar/basic.spec.ts`) — expect exit `0`; option order, separator, preset dimensions, centre placement, selection, Layers row, Custom validation, dismissal, repeated creation, undo/redo, and no-console-error checks pass.
2. `bunx playwright test tests/e2e/toolbar/basic.spec.ts --project=openpencil` — expect exit `0`; existing shape/frame flyout, polygon/star, pen, and Section/Frame checks remain green.
3. `bunx playwright test tests/e2e/text/editing.spec.ts --project=openpencil --grep "frame tool creates FRAME node"` — expect exit `0`; ordinary free-draw creation remains intact.
4. Run the smallest applicable engine/input test command discovered during preflight for the shared creation helper; expect exit `0`, and record the exact path/count. Do not invent a unit-test path if no pure helper exists.
5. `bun run check` — expect exit `0`; do not use a timeout or `format:check` as a substitute for success.
6. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0` when production desktop/source files changed.
7. Verify versions with `$v1=(Get-Content -Raw 'package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique` — for a production change, expect one value equal to the next patch after the verified installed predecessor; for verification-only work, expect unchanged `0.6.0`.
8. For a production change only: record UTC build start, run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`, hash the fresh x64 NSIS installer twice, silently install the exact fresh installer with uppercase `/S`, launch the verified `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, and record exact path, VersionInfo, product name, executable SHA-256, title/handle, and two `Responding=True` observations.
9. In the installed app, perform the complete preset/custom/free-draw workflow, inspect the Layers row and edit it, undo/redo, save/reopen/relaunch the same task-local `.fig`, and confirm dimensions/name/type/editability. Export PNG/SVG/PDF and confirm no editor popover or metadata is exported. Record screenshots plus store/tree/geometry evidence; browser-only proof is not sufficient for a delivered production change.
10. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.` Do not mark T-027 DONE or the packet VERIFIED from this execution packet.

## Integration or Installed-Result Check

- Mandatory for any production source change: the installed OpenPotlood executable—not Vite, OpenPencil, a resource copy, or a stale installer—must prove the exact preset list/order, live editable Layers frame, dimensions, placement, Custom valid/invalid paths, free-draw preservation, dismissal, undo/redo, `.fig` persistence, export isolation, exact identity/version/path, and repeated responsiveness.
- If the executor proves the behaviour without a production source change, record the exact installed version/path used and explain why no version bump/build was required; do not claim a fresh delivered update from browser/store tests alone.

## Stop Conditions

- T-004 is not DONE/VERIFIED, the live source seams have moved, or another implementation task is active; preserve the packet state and return to audit/route review.
- The existing toolbar cannot provide a Frame-specific trigger without breaking Section or other flyouts, or the exact anchor/focus/dismissal semantics require a new global menu system; stop for a bounded design decision.
- The current editor API cannot create a normal selected FRAME at explicit dimensions and viewport-centred document coordinates through the existing history path; stop rather than inventing a parallel node/store path.
- The Layers panel cannot show/select/edit the new frame, or preset creation would require flattening, rasterisation, a new node type, schema/Kiwi field, or persistence exception; return BLOCKED with the exact seam/error.
- The live numeric-input semantics cannot represent positive finite integer values without a new dependency or broad primitive change; stop and report the exact missing interface instead of guessing.
- Mobile behaviour would change materially, a new dependency is required, or the scope expands to device catalogues, constraints, auto-layout, remembered presets, or general toolbar redesign.
- Any focused test fails twice for the same unresolved cause; preserve exact command/output and return BLOCKED. Do not widen the packet.
- Any source check, E2E, quality gate, Cargo check, build, installer/install, launch, `.fig` persistence, export-isolation, identity, or responsiveness check fails or is ambiguous.
- Any request requires Git, worktrees, branches, release/updater/publishing/deployment/signing, resource execution, task-order/dependency changes, or concurrent T-009/T-010 implementation.

## Execution Report Contract

- Report prerequisite/non-Git state; before/after SHA-256; changed files; test commands/counts/exits; exact option order and anchor; preset/custom dimensions and viewport-centre evidence; selection and Layers-panel editability; invalid/dismissal/undo/redo/repeated-creation results; free-draw/Section regressions; `.fig` persistence and export isolation; installed installer/executable/version/path/hash/title/handle/responsiveness when applicable; deviations; and concerns. State explicitly that preset frames remain live editable Layers nodes and no flattening, remembered settings, schema change, or general toolbar redesign was added.

## Status record

Status: **Done**
