# T-011 — Deliver Boolean vector operations

Task ID: T-011
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-004
Prepared against: Live `App/` source and tests on 2026-07-20; T-004 is DONE/VERIFIED. T-010 is still READY and is not a capability dependency for this packet; this explicit packet selection authorises expansion now.
Last expanded: 2026-07-20

## Request Coverage

- Provide user-facing Union and Subtract actions for at least two compatible selected nodes.
- Preserve a Figma-style editable layer structure: create one live `BOOLEAN_OPERATION` parent containing the original child layers in stable back-to-front order; do not replace the result with one flattened `VECTOR` node.
- Render the boolean result from the child geometry using the existing CanvasKit path-op route.
- Preserve the operation, child order, node properties, undo/redo, `.fig` save/reopen, export, and installed-app relaunch behaviour.
- Reject unsupported or unsafe source geometry without changing the selection/document and without silently dropping image data, unsupported text, or malformed geometry.
- Keep existing Intersect, Exclude, Flatten, grouping, selection, and `.fig` compatibility behaviour unchanged unless a focused T-011 regression proves a required shared fix.
- Keep this private, local-only Windows work inside `App/`; no Git, worktree, branch, release, updater, publishing, deployment, signing, or `Toolbox/` execution.

## User-Visible Outcome

With two or more compatible same-parent layers selected, the Boolean operations control exposes Union and Subtract. Choosing either action creates one selected boolean group in the original parent at the first selected layer's position in the child order. The Layers panel shows the boolean group and its original editable children. Moving or editing a child through the Layers panel changes the rendered result; undo restores the original sibling structure and selection, and redo restores the boolean group. Unsupported selections leave the document unchanged and give the existing safe no-op/disabled behaviour.

## Verified Starting State

### Verified facts

- `App/packages/scene-graph/src/types.ts:88` includes `BOOLEAN_OPERATION`; `:408` defines `booleanOperation` as `UNION | SUBTRACT | INTERSECT | EXCLUDE`; `VectorNetwork` and `WindingRule` are defined at `:46-75`.
- `App/packages/core/src/editor/structure/boolean.ts` already creates a `BOOLEAN_OPERATION`, copies the first selected node's fills/strokes, reparents the selected children in their existing order, selects the new parent, and pushes an undo record that restores parent order and selection.
- `App/packages/core/src/canvas/boolean.ts` already maps `UNION` to CanvasKit `Union` and `SUBTRACT` to `Difference`; it transforms child paths, supports nested boolean children, visible strokes, lines, ellipse arcs, and imported fill geometry fallback; failed CanvasKit `op()` calls return the imported fill-geometry fallback when available.
- `App/packages/core/src/editor/structure.ts:68-69` exposes `booleanOperationSelected()` through the editor; `App/packages/core/src/editor/bridges/structure.ts:12-13` bridges selection into it.
- `App/packages/vue/src/editor/commands/selection.ts:199-214` exposes `selection.booleanUnion` and `selection.booleanSubtract`; `App/packages/vue/src/editor/selection-capabilities/use.ts:20-47` enables the shared Boolean command when at least two selected nodes pass `canMakeBooleanSourceNode()`.
- `App/src/components/properties/BooleanOperationsControl.vue` exposes Union and Subtract alongside the existing Intersect, Exclude, and Flatten actions. `App/src/components/DesignPanel.vue:44-55` shows the control for multi-selection.
- `App/src/app/shell/menu/schema.ts:151-165` and `App/src/app/shell/menu/use.ts:14-35` register the native Object menu actions; the command registry routes them to the same editor commands.
- `App/packages/core/src/kiwi/fig/node-change/convert.ts:134-146` imports Boolean operation values, and `App/packages/core/src/kiwi/fig/node-change/export-node.ts:712-713` exports them. `EXCLUDE` is translated to Kiwi `XOR`; Union and Subtract remain their named operations.
- `App/tests/engine/editor/structure/boolean.test.ts` covers wrapping, unsupported text, complex-script text, visible image fills, and undo/redo parent order/selection.
- `App/tests/engine/render/canvas/boolean.test.ts` covers Union bounds, Subtract bounds, transformed children, ellipse arcs, stroke outlines, imported fill fallback, and nested boolean children.
- `App/tests/engine/io/fig/export/boolean-operation.test.ts` covers operation export, `EXCLUDE`/`XOR`, and child order. There is no focused `.fig` import/reopen test for a Union or Subtract group.
- `App/tests/engine/figma/api/grouping-compat.test.ts` covers Boolean wrapper creation through the Figma-compatible API.
- `App/tests/e2e/canvas/renderer-visuals.spec.ts` renders all four operations, but creates them directly through the store and does not prove the user action or editable Layers-panel workflow.
- `App/tests/e2e/design/panel.spec.ts:434-461` only checks that the Boolean menu items are visible. The live run on 2026-07-20 failed before those assertions because the expected multi-selection header was not found; this is an existing baseline failure, not T-011 evidence.
- The application workspace has no Git metadata. `git status --short --branch` from both project root and `App/` is expected to report `fatal: not a git repository`; use hashes and pipeline receipts.
- Current private desktop version sources are all `0.6.0`: `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`.

### Official research

- Figma’s Boolean operations documentation states that Boolean groups are non-destructive, keep their child layers editable, accept supported shape/vector/text layers, and define Union as merging outer edges and Subtract as removing overlap from the bottom layer. Source: https://help.figma.com/hc/en-us/articles/360039957534-Boolean-operations
- Figma’s current Plugin API exposes `figma.union()` and `figma.subtract()` as operations that create a `BooleanOperationNode`; `children` is a supported ordered layer property. Sources: https://developers.figma.com/docs/plugins/api/figma/ and https://developers.figma.com/docs/plugins/api/properties/nodes-children/
- Skia’s official `SkPathOps` reference defines Union and Difference and states that `Op()` returns success/failure and leaves the result unmodified when it cannot produce an operation. Source: https://api.skia.org/SkPathOps_8h.html

### Fixed implementation decisions

- T-011’s first bounded matrix is the existing `canMakeBooleanSourceNode()` matrix, not a new type list: basic shapes, vectors, lines, supported text, existing Boolean operations, and supported visible descendants of groups/frames/components/instances are eligible; visible image fills, sections, component sets, unsupported text shaping/fonts, and any source rejected by the current predicate are not.
- The delivered user actions are Union and Subtract only. Existing Intersect and Exclude remain regression-covered shared behaviour, not new T-011 scope.
- The result stays a live `BOOLEAN_OPERATION` container with original child IDs and order. Flattening into `VECTOR`, destructive path replacement, Shape Builder semantics, and new persistent path-schema fields are excluded.
- Subtract follows the existing ordered-child semantics: the first child is the minuend and later children are subtracted in order. Do not infer a different visual “top/bottom” convention from Figma copy; assert the repository’s existing child order and renderer tests.
- Boolean source conversion includes visible stroke outlines because `canMakeBooleanSourcePath()` and `makeBooleanSourcePath()` already do so. Do not silently change fill/stroke/effect ownership in this packet.
- If CanvasKit path operations fail and no imported fill geometry is available, the action must refuse safely before creating the Boolean node. No partial wrapper, deleted child, or corrupted document is acceptable.
- A verification-only result does not increment the app version. If production code is changed and the feature is delivered, increment all three private desktop version sources exactly one patch above the verified installed predecessor, only after all source checks pass.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-004-corner-radius-node-controls.md`
- `Toolbox/Project-History/reports/T-004-corner-radius-node-controls.md`
- `App/AGENTS.md`
- `App/packages/core/src/editor/structure/boolean.ts`
- `App/packages/core/src/editor/structure/selection.ts`
- `App/packages/core/src/canvas/boolean.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/core/src/figma-api/index.ts`
- `App/packages/core/src/kiwi/fig/node-change/convert.ts`
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts`
- `App/packages/vue/src/editor/selection-capabilities/use.ts`
- `App/packages/vue/src/editor/commands/selection.ts`
- `App/src/components/properties/BooleanOperationsControl.vue`
- `App/src/components/LayersPanel.vue`
- `App/tests/engine/editor/structure/boolean.test.ts`
- `App/tests/engine/render/canvas/boolean.test.ts`
- `App/tests/engine/io/fig/export/boolean-operation.test.ts`
- `App/tests/engine/figma/api/grouping-compat.test.ts`
- `App/tests/e2e/canvas/renderer-visuals.spec.ts`
- `App/tests/e2e/design/panel.spec.ts`
- `App/tests/e2e/layers/panel.spec.ts`
- `App/tests/e2e/export/basic.spec.ts`

## Allowed Changes

- `App/packages/core/src/editor/structure/boolean.ts` — only if a focused test proves the current wrapper/undo/safe-rejection contract is incomplete.
- `App/packages/core/src/canvas/boolean.ts` — only for a proven Union/Subtract geometry or failure-handling defect; preserve the current CanvasKit and imported-fill fallback seams.
- `App/packages/vue/src/editor/selection-capabilities/use.ts`, `App/packages/vue/src/editor/commands/selection.ts`, `App/src/components/properties/BooleanOperationsControl.vue`, or the shared menu files — only for a proven user-action enablement/dispatch defect.
- `App/packages/core/src/kiwi/fig/node-change/convert.ts` and `App/packages/core/src/kiwi/fig/node-change/export-node.ts` — only for a focused Boolean import/export regression; no schema redesign.
- `App/tests/engine/editor/structure/boolean.test.ts` — extend for Union/Subtract selection order, no-op safety, and one undo/redo contract.
- `App/tests/engine/render/canvas/boolean.test.ts` — extend only for a missing Union/Subtract geometry/failure case already inside the fixed matrix.
- `App/tests/engine/io/fig/export/boolean-operation.test.ts` and a new focused import/round-trip test under `App/tests/engine/io/fig/roundtrip/` — prove operation and child order without changing codec schema.
- A new `App/tests/e2e/design/boolean-operations.spec.ts` — preferred location for user-action, Layers-panel editability, save/reopen, and no-console-error coverage; use existing `#tests/e2e/fixtures`, `CanvasHelper`, `window.openPencil.getStore()`, and layer-row `[data-node-id]` patterns.
- `App/CHANGELOG.md` and `App/README.md` only if a production change is required and the existing documentation boundary calls for a user-facing entry.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only for a completed production change immediately before delivery build; do not mass-version workspace packages.
- Generated installer/build/evidence files only as required by the local installed loop; record paths and hashes in the execution report.

## Restrictions and Exclusions

- Do not implement a destructive flatten-to-vector result, Shape Builder, pen/path editing, clipping/masks, or interactive Boolean-node inspector in T-011.
- Do not add new Boolean operation types, new dependencies, a geometry library, a new scene-graph schema, a new vector blob format, or a new `.fig` field.
- Do not change existing Intersect/Exclude/Flatten semantics merely for symmetry.
- Do not silently coerce unsupported text, image fills, sections, component sets, missing geometry, failed CanvasKit operations, or non-finite geometry into a Boolean result.
- Do not alter original child IDs, child order, parent order, selection restoration, or existing property values except the new Boolean parent’s copied visual properties established by the current implementation.
- Do not use screenshot-only proof for geometry or editability. Assert node type, operation, parent/child IDs/order, geometry bounds, and round-trip fields through the existing store/engine bridges.
- Do not treat the existing failing `panel.spec.ts` baseline as passed. If it remains unrelated, isolate the T-011 E2E from that stale assertion and record the failure in the report; if the T-011 workflow itself fails, stop.
- Do not claim browser/Vite or synthetic store tests as installed Windows evidence. A delivered production change requires the installed executable loop from `Toolbox/Project-History/PROJECT.md` and T-004/T-008 evidence patterns.
- Do not change task status, route order, dependency, T-009, T-010, Git state, release machinery, or `Toolbox/`.

## Implementation Steps

1. Re-read the current plan and this packet. Confirm T-004, T-009, and T-010 are `DONE`/`VERIFIED`, T-011 is the sole active implementation task, and no application edit is made during preflight. Stop on route/status drift.
2. Record SHA-256 hashes for every existing file that may be changed and the three version files. Record that the workspace is non-Git and capture the installed predecessor path/version before any build decision.
3. Run the current focused baseline from `App/`: `bun test ./tests/engine/editor/structure/boolean.test.ts ./tests/engine/render/canvas/boolean.test.ts ./tests/engine/io/fig/export/boolean-operation.test.ts ./tests/engine/figma/api/grouping-compat.test.ts`. Expect exit `0`, `20` passing tests, and `58` assertions at this prepared baseline; stop if the baseline differs materially.
4. Add or extend red tests before production edits for: Union and Subtract through the actual editor command; same-parent child order and first-index placement; Layers-panel visibility of the Boolean parent and original child rows; child selection/editing changing the rendered result; one undo and redo restoring exact trees/selections; unsupported visible image fill/text/section no-op; and a failed path-op/no-fallback refusal with no partial mutation. If the existing source already passes a proposed test, record it as verification and do not duplicate production code.
5. Verify the fixed matrix against `canMakeBooleanSourceNode()` and the current `makeBooleanSourcePath()` path. For each accepted source, assert finite/non-empty geometry before creating the wrapper; for each rejected/failed source, assert no node deletion, reparenting, partial Boolean node, or selection change.
6. Verify Union and Subtract command dispatch from the shared selection command path and the Boolean operations control. Do not add a second UI action path. If the existing `panel.spec.ts` stale multi-header assertion blocks setup, use direct store selection plus the existing command/menu test IDs in the new focused spec and retain the baseline failure in the report.
7. Verify editability using the existing Layers-panel row and store patterns: create two named overlapping rectangles, perform Union and Subtract separately, assert a `BOOLEAN_OPERATION` row with two original named children, select a child by layer row or approved store selection, move/resize it, and assert the child remains under the Boolean parent and the rendered/path bounds change.
8. Verify Boolean geometry for overlapping, disjoint, transformed, rounded, stroked, and nested supported children using the existing CanvasKit renderer helper. For Subtract, assert the first child’s area is the minuend and later children remove overlap; for Union, assert the combined bounds and a single live operation parent. Include one no-overlap Subtract result and one path-op failure/fallback case.
9. Add focused `.fig` coverage only where the current tests are absent: export and import a Union and Subtract parent with named children; assert operation, parent/child IDs/order as applicable, and all child geometry needed for the result. Do not assert generated IDs across a round trip unless the existing helper defines a stable mapping.
10. Verify undo/redo after each operation and after child editing. Require exactly one history action for the operation, exact original sibling order after Undo, exact Boolean parent/children after Redo, and no history entry for a rejected operation.
11. Run the focused E2E using `bunx playwright test tests/e2e/design/boolean-operations.spec.ts --project=openpencil` and, if the existing panel test is touched, rerun `bunx playwright test tests/e2e/design/panel.spec.ts --project=openpencil --grep "multi-select shows mixed header and boolean operations"`. The new test must assert the node tree and geometry through the store, visible layer rows, no page errors, and the operation menu action; screenshot evidence is supplementary only.
12. Run `bun run check` from `App/`; expect exit `0`. Do not interpret a timeout or a PowerShell wrapper error as success. Run `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc`; expect exit `0` only if production files changed.
13. If no production code changed, keep all three version sources at `0.6.0` and perform verification against the current installed executable only if its identity/path/version are unambiguous. If production code changed, increment all three versions exactly one patch above the verified installed predecessor, rerun affected focused checks, and build only one fresh x64 MSVC NSIS installer.
14. For a production delivery, record build start time, installer size/time/SHA-256 twice, silently install the exact fresh installer with uppercase `/S`, resolve the verified OpenPotlood executable path, and record `VersionInfo`, product name, exact path, executable SHA-256, window title/handle, and two `Responding=True` checks.
15. In the installed app, perform Union and Subtract with overlapping rectangles; expand the Boolean group in Layers, select/edit each child, confirm the visible result changes, undo/redo, save to a task-local `.fig`, close/reopen, relaunch the same installed executable, reopen the same `.fig`, and repeat the tree/operation/geometry checks. Export PNG, SVG, and PDF and confirm no editor layer/overlay data is embedded. Preserve document, installer, executable, and fixture hashes.
16. Write `Toolbox/Project-History/reports/T-011-boolean-vector-operations.md` with prerequisite state, changed files, before/after hashes, test counts/exits, safe-rejection cases, layer-tree/editability evidence, `.fig` evidence, installed identity/responsiveness, deviations, and the known stale panel-test failure if still present. Leave packet/task closure to the audit role.

## Acceptance Criteria

- [ ] Union and Subtract are available through the existing Boolean operations UI/command path for at least two compatible selected nodes.
- [ ] Each operation creates one live `BOOLEAN_OPERATION` parent with the original child IDs, stable back-to-front order, and no destructive flattening.
- [ ] The Layers panel exposes the Boolean parent and its original children; selecting/editing a child remains possible and changes the rendered result.
- [ ] Union and Subtract geometry is correct for overlapping, disjoint, transformed, rounded, stroked, and nested supported sources within the fixed matrix.
- [ ] Subtract uses the first child as minuend and later children as subtractors; Union combines the operands without losing child layers.
- [ ] Unsupported or failed geometry refuses safely: no partial node, deletion, reparenting, selection mutation, or silent flattening occurs.
- [ ] Undo and redo each restore the exact expected tree, child order, geometry, and selection; rejected operations add no history entry.
- [ ] Union and Subtract operation values and child order survive `.fig` export/import and installed save/reopen/relaunch.
- [ ] Existing Intersect, Exclude, Flatten, renderer, and Figma-API Boolean tests remain green.
- [ ] Focused tests, `bun run check`, and (for production changes) Cargo/build/install/identity/responsiveness checks pass with observable evidence.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App` unless stated otherwise:

1. `bun test ./tests/engine/editor/structure/boolean.test.ts ./tests/engine/render/canvas/boolean.test.ts ./tests/engine/io/fig/export/boolean-operation.test.ts ./tests/engine/figma/api/grouping-compat.test.ts` — expect exit `0`; baseline is `20` pass / `0` fail / `58` assertions before T-011 edits.
2. `bun test ./tests/engine/io/fig/roundtrip/<focused-boolean-test>.test.ts` — expect exit `0` if a focused round-trip test is added; otherwise record that existing `.fig` round-trip coverage is absent and add it before claiming completion.
3. `bunx playwright test tests/e2e/design/boolean-operations.spec.ts --project=openpencil` — expect exit `0`; user action, layer-tree editability, undo/redo, safe refusal, and no-console-error assertions pass. Optional CanvasKit WebGPU vendor-copy warnings are non-fatal only when the command exits `0`.
4. `bun run check` — expect exit `0`; do not use a timeout as success.
5. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0` when production code changed.
6. For production delivery only: verify one synchronised next-patch version, run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`, silently install the exact fresh installer with `/S`, and record installed identity/path/hash/title/handle plus two responsive checks.
7. For production delivery only: run the installed Union/Subtract layer-edit, undo/redo, `.fig` save/reopen/relaunch, export-isolation, and process-responsiveness checks; all must pass.
8. From the project root: `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.` Do not mark T-011 DONE or the packet VERIFIED in this execution packet.

## Integration or Installed-Result Check

- Mandatory for any production change: the installed OpenPotlood executable must prove the Union/Subtract action, editable Layers-panel children, undo/redo, safe rejection, `.fig` save/reopen/relaunch, export isolation, exact identity/version/path, and repeated responsiveness. Browser/Vite/store-only checks are not a substitute.
- If the execution is verification-only and no production code changes, record the exact installed version/path used and explain why no version bump/build was required; do not claim a fresh delivered update.

## Stop Conditions

- T-004 is not `DONE`/`VERIFIED`, the live source paths have moved, T-009/T-010 state conflicts with the plan, or another packet is being changed.
- The current command path does not expose Union/Subtract, the selection capability predicate and actual operation matrix disagree, or a product decision is needed about unsupported source types or operand order.
- A Boolean operation requires flattening, a new geometry library/schema, a new `.fig` field, or behaviour outside the fixed matrix.
- CanvasKit returns failure without a safe imported-geometry fallback, or a failed/rejected operation mutates the document or selection.
- Any focused test fails twice for the same unresolved cause; preserve the exact output and return `BLOCKED` rather than widening scope.
- The current Layers panel cannot expose original Boolean children without a new unapproved layer-selection model; stop for a user/product decision.
- `.fig` import/export, save/reopen, export isolation, installed identity, build/install, launch, or responsiveness evidence cannot be performed or is ambiguous.
- The known existing `panel.spec.ts` multi-selection-header test remains unrelated and failing; isolate it in the report, but stop if the new T-011 workflow test depends on the same broken setup.
- Any request requires Git, worktrees, branches, release/updater/publishing/deployment/signing, `Toolbox/` execution, task-order/dependency changes, or T-010/T-009 implementation.

## Execution Report Contract

- Report prerequisite and non-Git state; baseline and final SHA-256 hashes; changed files; focused test counts/exits; accepted/rejected source matrix; CanvasKit success/fallback evidence; Boolean parent/child IDs/order; Layers-panel editability; undo/redo; `.fig` round-trip; export isolation; installed installer/executable/version/path/hash/title/handle/responsiveness when applicable; the known stale panel-test baseline failure; deviations; and concerns.

## Status record

Status: **Done**
