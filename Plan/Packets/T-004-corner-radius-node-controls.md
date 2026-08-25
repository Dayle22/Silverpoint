# T-004 — Deliver corner-radius node controls

Task ID: T-004
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-003
Prepared against: T-001 and T-003 DONE/VERIFIED, and live app source audited 2026-07-18; installed OpenPotlood `0.1.1` is the verified predecessor.
Last expanded: 2026-07-18
Last audited: 2026-07-18

## Request Coverage

- Add node controls to rectangle shapes so a user can adjust corner radius by click-and-drag: implemented through the existing selection overlay, canvas hit-test, drag-state, editor update, and undo seams listed below.
- Preserve uniform and independent-corner data: uniform mode updates `cornerRadius` and the four corner fields consistently; independent mode updates only the dragged corner and keeps `independentCorners: true`.
- Preserve existing `.fig` radius fields and round-trip compatibility: no codec redesign; extend existing round-trip assertions only if the interaction exposes a regression.
- Deliver a user-visible installed Windows update: focused tests, full quality gate, patch-version synchronisation, x64 NSIS build, silent install, exact-path launch, and real installed-app drag evidence are mandatory.
- Do not revive upstream release, updater, publishing, Git, worktree, branch, or deployment workflows: remain inside the private local Windows loop in `Toolbox/Project-History/PROJECT.md` and the T-003 installed-loop contract.

## User-Visible Outcome

When one `RECTANGLE` is selected in OpenPotlood, four visible corner-radius node controls are available at the rectangle's four corners. Dragging a control changes the radius continuously in the direction that increases or decreases that corner's inset, works at non-default zoom/pan and with node rotation, leaves resize and rotation handles functional, and commits one undoable radius change on pointer release. In uniform mode all four radius fields remain equal and `independentCorners` remains false; in independent mode only the selected corner changes and `independentCorners` remains true. The installed build preserves the result through `.fig` save/reopen and relaunch.

## Verified Starting State

- `App/packages/scene-graph/src/types.ts:346-352` defines `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`, `independentCorners`, and `cornerSmoothing` on `SceneNode`.
- `App/packages/scene-graph/src/node-defaults.ts:42-48` initialises all radius fields to `0`, `independentCorners` to `false`, and `cornerSmoothing` to `0`.
- `App/src/components/properties/AppearanceSection.vue` already edits uniform `cornerRadius`, toggles independent radii, and edits all four independent fields through `AppearanceControlsRoot` actions. Existing E2E coverage is in `App/tests/e2e/properties/panel.spec.ts` and `App/tests/e2e/properties/corner-stroke-toggles.spec.ts`.
- `App/packages/core/src/canvas/overlays/selection.ts:137-200` draws a single-selection outline and existing bounds handles; `drawBoundsHandles()` currently draws the four corners, four side handles, and rotation handle. The renderer uses the node's world transform via `getWorldMatrix()`.
- `App/packages/vue/src/shared/input/geometry.ts:100-198` computes world-space selection handles and hit-tests them with `getHitHandleByMatrix()`; `hitTestCornerRotationByMatrix()` already reserves the outside-corner rotation zone.
- `App/packages/vue/src/shared/input/resize/start.ts` starts `DragResize`; `App/packages/vue/src/shared/input/resize.ts` previews and commits resize; `App/packages/vue/src/canvas/useCanvasInput.ts` owns the mouse-down/move/up dispatch and currently uses `MouseEvent` listeners on the Canvas element.
- `App/packages/vue/src/shared/input/types.ts:1-140` is the established drag-state union. It currently has `HandlePosition`, `CornerPosition`, `DragResize`, and `DragRotate`, but no radius-drag type.
- `App/packages/core/src/editor/nodes.ts:16-40` provides preview-only `updateNode()` and undo-backed `updateNodeWithUndo()`; `App/packages/core/src/editor/undo.ts:157-178` provides `commitNodeUpdate()` for a final update with one undo entry. `App/packages/core/src/editor/selection/overlays.ts` and `App/packages/core/src/canvas/renderer/types.ts` provide the existing volatile rotation-preview pattern.
- `App/packages/core/src/canvas/shapes.ts` and `App/packages/core/src/canvas/strokes.ts` already render uniform and independent radii, with renderer-side geometric budgeting. Existing `.fig` coverage is in `App/tests/engine/io/fig/roundtrip/basic.test.ts:258-271` and `App/tests/engine/io/fig/roundtrip/variables.test.ts`.
- `App/tests/e2e/canvas/manipulation.spec.ts` proves the existing coordinate recipe for finding a selected node's world position, applying `zoom`/`panX`/`panY`, and dragging a Canvas handle. It also covers resize and rotation handle interaction.
- The application workspace intentionally has no Git metadata: `git -C app status --short --branch` and `git -C . status --short --branch` both report `fatal: not a git repository`. Use hashes and pipeline receipts, not Git diffs.
- T-003 is `DONE`/`VERIFIED` under the user's accepted closure exception. Its automated, build, install, identity, launch, and responsiveness evidence is authoritative; real Explorer drops, installed `.fig` save/reopen, and restart/reopen remain explicitly unverified and must not be cited as passed for T-003 or T-004.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- `Plan/Packets/T-003-drag-and-drop-image-support.md`
- `App/AGENTS.md`
- `App/packages/core/src/canvas/overlays/selection.ts`
- `App/packages/vue/src/shared/input/geometry.ts`
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/core/src/editor/nodes.ts`
- `App/packages/core/src/editor/undo.ts`
- `App/tests/e2e/canvas/manipulation.spec.ts`
- `App/tests/e2e/properties/panel.spec.ts`

## Allowed Changes

- `App/packages/core/src/canvas/overlays/selection.ts` — draw four radius controls for a single selected `RECTANGLE`, using the same world transform and selection colour/handle sizing already used by the selection overlay. Each control is a small circular control centred 12 canvas pixels inward along the corner's 45-degree inward diagonal; it is distinct from the square resize handle at the exact corner.
- `App/packages/vue/src/shared/input/types.ts` — add the smallest named radius-drag state and its corner key mapping; do not weaken the existing `DragState` types.
- `App/packages/vue/src/shared/input/geometry.ts` — add radius-control positions/hit-testing and the local-coordinate/radius calculation needed by the drag; reuse existing matrix/world-coordinate helpers.
- `App/packages/vue/src/shared/input/resize/start.ts` or a new established sibling under `App/packages/vue/src/shared/input/` — start radius dragging before resize/rotation hit handling where the verified hit zones require it.
- `App/packages/vue/src/shared/input/` radius-drag implementation — preview node radius updates during movement and commit one undoable update on release through the existing editor APIs.
- `App/packages/vue/src/canvas/useCanvasInput.ts` — wire the new drag state into the existing mouse down/move/up lifecycle and clear it on release/cancel/window mouseup.
- `App/packages/core/src/editor/selection/overlays.ts`, `App/packages/core/src/canvas/renderer/types.ts`, and `App/packages/core/src/canvas/renderer/pipeline.ts` only if a volatile radius preview is needed after inspecting the current renderer path; follow the existing `rotationPreview` pattern and do not add parallel mutable state without evidence.
- `App/tests/engine/editor/corner-radius-controls.test.ts` — pure radius mapping and editor-history coverage following the existing editor test placement.
- `App/tests/e2e/canvas/corner-radius-controls.spec.ts` — observable browser interaction coverage following `manipulation.spec.ts`, existing fixtures, `CanvasHelper`, `window.openPencil.getStore()`, and the canvas locator pattern.
- `App/tests/engine/io/fig/roundtrip/**` only if the new focused interaction test demonstrates a round-trip regression in an existing codec path.
- `App/CHANGELOG.md` and the relevant public guidance only after the feature passes its focused checks, following `App/AGENTS.md` and T-003's documentation boundary.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only after all focused tests, `bun run check`, Rust check, and build prerequisites pass; increment the private desktop patch from the verified installed predecessor (expected `0.1.1` after T-003, therefore expected `0.1.2` for this completed update) and mirror only the local `open_pencil` Cargo.lock record.
- Generated build/install outputs needed for the mandatory installed check; retain evidence paths and hashes.

## Restrictions and Exclusions

- Scope is `RECTANGLE` only. Do not silently extend controls to frames, sections, components, ellipses, polygons, vectors, groups, or multiple selection.
- A radius drag must not resize, rotate, move, alter fills/strokes/effects, toggle independent corners, or alter `cornerSmoothing`.
- In uniform mode, dragging any radius control must write the same non-negative value to `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, and `bottomLeftRadius`, with `independentCorners: false`. Preserve the existing property-panel convention rather than inventing a new mixed representation.
- In independent mode, dragging the named corner must update only its corresponding field (`nw`→`topLeftRadius`, `ne`→`topRightRadius`, `se`→`bottomRightRadius`, `sw`→`bottomLeftRadius`) and must preserve the other three fields and `independentCorners: true`.
- Use the existing model's non-negative radius semantics. Do not invent a new hard maximum or silently rewrite stored values to renderer-budgeted values; if a maximum is needed for a stable interaction, derive it from an existing property/renderer convention and add a focused test first.
- The dragged control must follow the selected rectangle's transform, current pan, zoom, and rotation. Do not use raw screen deltas as model-local radius values without transforming them.
- Commit one undo entry per completed drag, with a stable user-facing label; preview updates must not create one history entry per pointer move. Pointer cancel, mouseup outside the Canvas, Escape/cancel path, and invalid/non-finite input must restore the opening radius state and create no committed change.
- Preserve existing resize and rotation hit zones and cursors. The radius hit zone must not make a corner resize or corner-rotation gesture unreachable; resolve overlap from verified current geometry and test it.
- Do not add a DOM overlay or test-only application hook unless the existing CanvasKit overlay/hit-test route is proven unable to support the control and the packet is audited first.
- Do not change `.fig` codec/schema behaviour, upstream package versions, updater settings, release workflows, Git state, task order, dependency, or project goal.
- Do not claim T-003 or T-004 completion from synthetic browser tests alone. The delivered update requires the installed Windows loop and real-app evidence specified below.

## Implementation Steps

1. Reconcile `Toolbox/Project-History/PROJECT.md`, `Plan/plan.md`, T-003's execution evidence, and this packet. Stop before edits unless T-003 is `DONE`/`VERIFIED`, the approved installed OpenPotlood executable path is known, `App/node_modules` resolves workspace imports, the three current private version sources agree, and no competing radius implementation has appeared.
2. Record opening SHA-256 hashes for every existing file that will change and record the verified installed predecessor version. Because the workspace has no Git metadata, these hashes are the opening receipt.
3. Read the current selection renderer, world-matrix helpers, hit-test order, pointer lifecycle, radius property actions, undo bridge, and `.fig` round-trip tests. Confirm the exact overlap between corner resize handles, corner rotation zones, and the proposed radius-control hit zone before choosing the smallest code seam.
4. Define a named corner mapping and a pure radius-from-pointer calculation in the established `packages/vue/src/shared/input/` domain. Place each visible control 12 canvas pixels inward along its corner's 45-degree diagonal. During a drag, project the local-pointer delta from the drag start onto that same inward diagonal, add it to the opening radius, clamp only at zero, and produce finite values. Add explicit tests for all four corners, zoom/pan, rotation, and inward/outward drag direction.
5. Add the radius drag state with the opening radius fields, node ID, corner, start pointer position, and any values required to restore/commit. Keep it in the existing `DragState` union and do not use an untyped object or module-level mutable state.
6. Extend the single-rectangle selection overlay with four radius-control visuals at the rectangle's corners. Make the controls visually distinct from resize handles while following existing colour, zoom, and CanvasKit disposal conventions. Do not draw them for non-rectangles, multi-selection, text edit, or vector node-edit mode.
7. Add radius-control hit-testing in the same world-space coordinate system as `getHitHandleByMatrix()`. Verify hit-test precedence so a radius drag starts only inside the new radius zone, existing resize handles still resize, and the existing outside-corner zone still rotates.
8. On drag start, snapshot the applicable radius fields and prevent the normal selection/resize/rotation action. On movement, update the selected rectangle through the existing preview update path and request repaint/render. Uniform and independent mode must follow the exact restrictions above; preserve variable bindings and use the existing property-update conventions if a direct edit detaches a binding.
9. On normal pointer release, restore the opening state once, record the final field values through the existing undo-backed node-update/commit seam with one label, and clear the drag state. On `pointercancel`/mouse cancellation/window release/Escape, restore the opening state without an undo entry. Use pointer capture only if the existing Canvas mouse lifecycle cannot reliably receive an outside release; if used, follow the official Pointer Events capture/release contract.
10. Add focused pure/unit coverage for mapping and clamping/finite handling, and editor/history coverage proving one drag is one undo step, redo restores the final value, uniform mode updates all four fields, independent mode updates one field, cancellation is unchanged, and non-rectangle/multi-selection is ignored.
11. Add E2E coverage using the existing `CanvasHelper` and store inspection. Draw/select a rectangle, locate each radius control from live absolute position plus zoom/pan, drag it at multiple steps, assert the corresponding model fields and visible rounded-corner change, assert resize/rotation handles remain usable, and assert no canvas/browser errors. Include a rotated parent or node and non-default pan/zoom.
12. Extend existing `.fig` round-trip coverage only if needed to prove the interaction result: save a rectangle with uniform and independent radii, reopen, and assert all five radius fields plus `independentCorners` are unchanged. Do not claim codec work when the existing test already proves it.
13. Update the changelog/public guidance only after behaviour and focused tests pass. Keep wording limited to the shipped rectangle radius controls; do not advertise unsupported node types, touch, keyboard, or multi-selection behaviour.
14. Run formatting only on touched files, focused tests, `bun run check`, the targeted Windows Cargo check, and the Tauri x64 NSIS build. Stop on any failure and preserve the failing output; do not mass-fix unrelated warnings.
15. After all focused checks and `bun run check` pass, increment the private desktop patch exactly one above the verified installed predecessor, synchronise `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`, and mirror only the local `open_pencil` Cargo.lock record. Re-run the focused checks affected by the version edit.
16. Build one fresh x64 MSVC NSIS installer with the exact T-003 command, select exactly one installer written after the recorded build start, record size/time/SHA-256, hash it twice immediately before installation, and require equal hashes. Do not build MSI, updater, signing, release, macOS, Linux, or Store outputs.
17. Silently install that exact installer with uppercase `/S`; resolve the executable from the verified T-002/T-003 installed path, verify `VersionInfo`, product identity, exact path, SHA-256, window title/handle, and `Responding=True` twice. Stop if the path or version is ambiguous.
18. In the installed app, create/select rectangles and perform real mouse click-and-drag radius edits at known corners, including uniform and independent mode, a rotated rectangle/parent, and non-default zoom/pan. Confirm visible rounding and exact node fields through the approved observable route; confirm resize/rotation still work and the process stays responsive.
19. Save the installed document as `.fig` in the task-local evidence folder, record its hash, close/reopen it in OpenPotlood, verify all radius fields and visible rounding, close/relaunch the same installed executable, reopen the same file, and repeat the check. Retain installer, executable, document, and test-fixture hashes for audit.
20. Write the execution report with opening/final hashes, files changed, exact commands and exit codes/test counts, installed paths and metadata, real-app observations, `.fig` hash, deviations, and concerns. Leave packet/task status for the audit role; this packet must not be promoted to VERIFIED or the task marked DONE by the executor.

## Acceptance Criteria

- [ ] A single selected `RECTANGLE` shows four radius controls and no other supported node type shows them.
- [ ] Dragging each control changes the intended corner radius in the correct direction at default and non-default pan/zoom; rotation does not mis-target the control.
- [ ] Uniform mode writes equal values to `cornerRadius` and all four corner fields and leaves `independentCorners` false.
- [ ] Independent mode changes only the dragged corner field and leaves the other three fields and `independentCorners` true unchanged.
- [ ] One completed drag creates one undo entry; Undo restores all opening fields and Redo restores all final fields; cancellation creates no change.
- [ ] Existing resize and rotation corner gestures still pass their current E2E coverage.
- [ ] Existing `.fig` round-trip radius coverage passes, and the interaction result survives save/reopen/relaunch with all radius fields intact.
- [ ] Focused tests, `bun run check`, targeted Windows Cargo check, fresh x64 NSIS build, stable installer hash, silent install, exact installed identity/version/path, and two responsiveness checks pass.
- [ ] Real installed OpenPotlood interaction visibly changes rectangle corner rounding for uniform and independent modes without uncaught browser errors or process unresponsiveness.
- [ ] No publishable workspace package version, updater/release artefact, unrelated application area, route, dependency, or project-goal change is introduced.

## Verification

- Run `bun test ./tests/engine/editor/corner-radius-controls.test.ts ./tests/engine/figma/api/corner/radius.test.ts ./tests/engine/io/fig/roundtrip/basic.test.ts`; expect exit code `0`, no module-resolution errors, and all radius mapping/history/round-trip assertions passing.
- Run `bunx playwright test tests/e2e/canvas/corner-radius-controls.spec.ts tests/e2e/canvas/manipulation.spec.ts tests/e2e/properties/panel.spec.ts --project=openpencil`; expect exit code `0`, existing resize/rotation tests plus radius-control tests passing, and no page/canvas errors.
- Run `bun run check`; expect exit code `0`. Do not run `format:check`, because the workspace has no Git repository.
- From `C:\Users\User\Documents\OpenPotlood`, run `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique`; expect exactly one value, one patch above the verified installed predecessor (expected `0.1.2` if T-003 installed `0.1.1`).
- From `C:\Users\User\Documents\OpenPotlood\App`, run `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc`; expect exit code `0` and the local Cargo lock record matching the private desktop version.
- From `C:\Users\User\Documents\OpenPotlood\App`, run `$buildStart=(Get-Date).ToUniversalTime(); bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`; expect exit code `0` and one fresh OpenPotlood `*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
- Run the T-003 installer-selection command: `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File|Where-Object{$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; $hash1=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; $hash2=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; if($hash1 -ne $hash2){throw 'Installer hash changed before install'}; "$($installer[0].FullName)|$hash1"`; expect one absolute path and equal hashes.
- Run `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}`; expect exit code `0`, then reuse the verified T-002/T-003 exact installed-path, metadata, executable-hash, title, handle, and repeated responsiveness commands with the new version.
- Run the installed-app checks in Implementation Steps 18–19; expect visible uniform/independent radius edits, preserved `.fig` fields after reopen and relaunch, no uncaught errors, and two responsive process checks. Synthetic Playwright evidence is supplementary and cannot replace this real installed check.
- Run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` after packet/plan receipt updates.

## Integration or Installed-Result Check

- Mandatory. This is a user-visible desktop interaction. The executor must complete the T-003/T-002 Windows loop: focused tests → full quality gate → private patch synchronisation → targeted Cargo check → one fresh x64 NSIS installer → stable hash → silent install → exact installed OpenPotlood identity/version/path/hash → real mouse radius edits in the installed app → `.fig` save/reopen → app relaunch/reopen → two responsiveness checks. Keep absolute paths and SHA-256 values in the execution report.

## Stop Conditions

- Stop and return `STALE PACKET` if T-003 is not DONE/VERIFIED at READY audit or execution start, if its installed path/version evidence is missing, or if T-003 changed the canvas/input/round-trip seams listed here.
- Stop if any required source path, interface, current test, dependency, version source, or installed-result fact differs from this packet without a bounded audit amendment; do not guess a replacement.
- Stop if radius-control geometry cannot be made unambiguous with existing resize/rotation hit zones, or if rotated/transformed coordinates cannot be verified from existing matrix helpers.
- Stop if the existing uniform/independent model or `.fig` codec would require flattening, new schema fields, silent coercion, or loss of unsupported content.
- Stop if a non-finite/negative radius, variable binding, multi-selection, locked node, node type outside `RECTANGLE`, pointer cancellation, or history case cannot be specified and tested without product-design inference.
- Stop on any focused test, E2E test, `bun run check`, Cargo check, Tauri build, installer selection/hash, silent install, identity/version/path, real installed interaction, `.fig` reopen, relaunch, or responsiveness failure.
- Stop if more or fewer than one fresh installer qualifies, stale processes/artefacts contaminate proof, or the installed executable differs from the verified T-002/T-003 path without explicit evidence.
- Stop before version edits if the predecessor version is not verified or the three private version sources disagree; never leave a failed exploratory build represented as a completed version.
- Stop on any request to extend scope beyond rectangle corner-radius controls or to alter route, dependency, task order, release machinery, publishing, updater, Git, or deployment behaviour.

## Assumptions

- T-003 will be DONE/VERIFIED before T-004 READY promotion or execution, and its final evidence will identify the authoritative installed OpenPotlood executable and predecessor version.
- T-003 will not replace the listed selection-overlay, Vue input, editor-undo, radius-model, or `.fig` seams without the T-004 audit reconciling this packet.
- Existing radius property edits remain the source of truth for field semantics and variable-binding behaviour; the node control is an alternate input path, not a new radius model.
- A completed T-004 update is expected to increment the private desktop patch from T-003's verified version (expected `0.1.1` to `0.1.2`), subject to audit recheck.

## Decisions Still Required

- NONE for the prepared implementation contract. The executor must still stop if the assumptions above fail or if new evidence creates a scope or product decision not covered here.

## Execution Report Contract

- Report result (`DONE`, `BLOCKED`, or `STALE PACKET`); reconciled T-003 evidence; opening/final hashes; every source/test/docs/version file changed and why; exact commands, exit codes, and test counts; uniform/independent/cancel/undo/redo evidence; resize/rotation regression evidence; installer/document/executable absolute paths and SHA-256 values; installed metadata, process ID/path/title/handle and both responsiveness checks; real-app observations; `.fig` save/reopen/relaunch evidence; deviations; and mess or concerns.

## Status record

Status: **Done**
