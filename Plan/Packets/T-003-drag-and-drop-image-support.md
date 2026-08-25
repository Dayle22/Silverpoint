# T-003 — Deliver drag-and-drop image support

Task ID: T-003
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-002
Prepared against: Live `App/` source on 2026-07-18; T-001 and T-002 execution evidence reconciled during READY audit
Last expanded: 2026-07-18
Last audited: 2026-07-18

## Completion Authority and Verification Exception

On 2026-07-18 the user explicitly instructed that T-003 be marked complete so the project can continue. This accepts the automated, build, install, identity, launch, and responsiveness evidence as sufficient for closure and waives the outstanding real Windows Explorer five-format drop, installed `.fig` save/reopen, and restart/reopen checks. Those checks were not performed and must not be cited as verified evidence.

## Request Coverage

- Drag image files from Windows Explorer onto the canvas: preserve the existing HTML5 canvas-drop route and the required Tauri Windows configuration; do not create a parallel native importer.
- Correct placement: place the single image or multi-image group around the actual drop point after canvas pan/zoom conversion, including the existing selected/entered-container target behaviour.
- Editable canvas content: create ordinary named `RECTANGLE` nodes with `IMAGE` fills and embedded bytes in `SceneGraph.images`; do not flatten the result into an opaque document screenshot or external file link.
- Correct undo behaviour: treat one drop gesture as one history entry, restore the previous selection on undo, restore all nodes/selection/bytes on redo, and never invalidate bytes still shared by another image node.
- Supported image files: retain the verified PNG, JPEG, WebP, GIF, and AVIF contract; accept an approved extension only when Windows supplies an empty or `application/octet-stream` MIME type; reject known non-image, unsupported, or undecodable files without mutating the document.
- Preserve OpenPencil compatibility and `.fig` round trips: use the existing image hash, fill, editor, graph, and `.fig` paths; do not change stored node/paint schemas or silently discard unsupported content.
- Preserve the private local Windows route: no Git, worktrees, branches, pull requests, releases, publishing, deployment, signing, updater work, or execution of copied resources.
- Deliver an installed update: after focused checks pass, increment the verified T-002 baseline by one patch and complete the x64 NSIS build, install, exact-path launch, version/identity/hash, Explorer-drop, save/reopen, restart, and responsive-process checks.
- Correct stale public guidance: update the existing Figma-comparison rows that currently say drag-and-drop image import is absent; retain the honest limitation that video is unsupported.

## User-Visible Outcome

In installed OpenPotlood, a user can drag one or several supported image files from Windows Explorer onto the canvas. The app shows the existing drop highlight, creates selected editable image-filled rectangles centred at the intended canvas location (with current pan, zoom, and container targeting respected), and keeps the images after `.fig` save/reopen and app restart. One Undo removes the whole drop and restores the earlier selection; one Redo restores the whole drop. Dropping the same image more than once does not corrupt either surviving node, and unsupported or corrupt files leave the document unchanged.

## Verified Starting State

### Verified facts

- `App/packages/vue/src/canvas/drop/use.ts` defines `ACCEPTED_TYPES` as `image/png`, `image/jpeg`, `image/webp`, `image/gif`, and `image/avif`; listens to `dragover`, `dragenter`, `dragleave`, and `drop` with VueUse; sets `dropEffect = 'copy'`; converts client coordinates through `editor.screenToCanvas()`; and calls the shared `editor.placeImageFiles()` action.
- The same module filters only exact MIME types. Official browser guidance states that an OS may expose an unknown file MIME as `application/octet-stream`, so a valid supported Windows image can currently be rejected before the decoder verifies it.
- `App/src/components/EditorCanvas.vue` invokes `useCanvasDrop(canvasRef, store)` on the interactive overlay canvas and renders an existing dashed accent overlay while `isDraggingOver` is true. No new component or visual design is required.
- `App/desktop/tauri.conf.json` already sets the main window's `dragDropEnabled` to `false`. Official Tauri v2 configuration documentation states that disabling native webview drag/drop is required to use frontend HTML5 drag-and-drop on Windows. T-003 must preserve and test this value.
- `App/packages/core/src/editor/clipboard/images.ts` is the shared image placement path used by drag/drop and clipboard paste. It decodes through CanvasKit `MakeImageFromEncoded`, caps either dimension at `4096` while preserving aspect ratio, uses a `20` canvas-unit gap, centres the multi-file row around the supplied point, removes the filename extension for the node name, and creates a `RECTANGLE` with an `IMAGE` fill in `FILL` mode.
- `placeImageFiles()` prepares files asynchronously, skips undecodable images, places valid files in input order with common top alignment, selects all created IDs, and requests a render. Mixed valid/corrupt input currently imports the valid subset.
- `resolvePasteTarget()` in `App/packages/core/src/editor/clipboard/paste-target.ts` chooses the entered container, a selected container, the selected node's parent, or the current page. Current image placement writes world/canvas coordinates directly as child-local coordinates, so placement inside a translated or transformed container is not proven correct.
- Existing scene-graph utilities provide the required conversion without a new dependency: `getWorldMatrix()` from `@open-pencil/scene-graph` and `TransformMatrix.invert()` / `TransformMatrix.mapPoint()` can map a canvas/world drop point into the chosen parent's local coordinates.
- `placeImageNode()` currently pushes one `Place image` undo entry per image. Therefore one multi-file drop requires multiple undos and does not restore the pre-drop selection, unlike the existing atomic paste history in `App/packages/core/src/editor/clipboard.ts`.
- Each current inverse deletes its image hash unconditionally. Image hashes are content-derived and shared; two identical drops can reference the same `SceneGraph.images` entry, so undoing one can remove bytes still needed by another node. Normal node deletion and clipboard-paste undo do not garbage-collect `graph.images`; retaining unused bytes on placement undo is the established safe policy.
- `UndoManager` in `App/packages/scene-graph/src/undo.ts` supports one explicit entry or a batch. Existing editor history patterns capture `prevSelection`, recreate snapshots with stable IDs on redo, delete created IDs in reverse order, restore the prior selection on undo, and request rendering through the editor undo bridge.
- Existing `.fig` image export coverage at `App/tests/engine/io/fig/export/images.test.ts` proves image bytes can be emitted through the established codec, but there is no focused image-placement engine test and no canvas drag/drop E2E spec.
- Existing E2E tests use `DataTransfer`, `DragEvent`, `useEditorSetup`, `CanvasHelper`, `window.openPencil.getStore()`, and user-facing or existing canvas integration locators. New coverage can follow those patterns without test-only application hooks.
- The normal editable document save route is `.fig`, through `App/src/app/document/io/save.ts` and `App/packages/core/src/io/formats/fig/**`; `.pen` is an import adapter and is not the save/reopen acceptance format for this packet.
- `App/CHANGELOG.md` already contains an Unreleased claim for desktop image drag-and-drop. Seven `App/packages/docs/**/guide/figma-comparison.md` files contradict it by saying drag-and-drop image import is absent.
- `App/AGENTS.md` requires named types, structured copies for nested state, VueUse for DOM events, no duplicated logic, semantic tests, focused CanvasKit coverage where pixels change, and `bun run check`. It also requires user-facing changes to update `CHANGELOG.md` and relevant public guidance.
- The live app has no Git repository by project decision. On 2026-07-17/18 it still contained 2,619 files and 14,815,452 bytes with tree SHA-256 `6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5`.
- Relevant starting hashes are: `drop/use.ts` `82EA462839F63978CEE02551A9D71F9A4F68D0089BC945717A6D0DC543E9C053`; `clipboard/images.ts` `C7811B29CCDA8C0D5E7AD08F6B4699C61A2A58BA53D1D1AD3DAFA5CBA79482E7`; `EditorCanvas.vue` `8FA34DC632B8855CAF00B1E12F6E02643E5A67A03D97E69A965142568E07E409`; and `tauri.conf.json` `F2D1D31115DE75C0ADF7ECE7D102233A927A16D36A043D10BEA31FF30C167F5F`.
- Bun `1.3.14`, Cargo `1.97.0`, rustc `1.97.0`, FFmpeg `8.1.1`, and ripgrep `15.1.0` are available. FFmpeg exposes PNG, MJPEG, GIF, WebP, AV1, and AVIF output needed for task-local real-app fixtures.
- `App/node_modules` is currently absent. A focused baseline command, `bun test ./tests/engine/editor/clipboard/paste-target.test.ts`, returned `0 pass`, `1 fail`, `1 error` because `@open-pencil/scene-graph/node-defaults` could not resolve. No baseline or completion test result may be claimed until the predecessor-authorised dependency setup restores workspace resolution.
- Current source identity remains upstream OpenPencil `0.13.2`. T-002 owns the OpenPotlood `0.1.0` installed baseline, approved identifier, dependency/toolchain setup, and authoritative installed executable path.
- Official sources used: MDN `DataTransfer.files` documents that file lists are available during `drop`/`paste` and represent OS-dragged files: https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
- Official sources used: MDN's file drag/drop guide documents cancelling `dragover` for `drop`, using `dragenter`/`dragleave` for OS files, and processing file items: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
- Official sources used: Tauri v2 `WindowConfig.dragDropEnabled` documents the Windows requirement to disable native webview drag/drop for frontend HTML5 drag/drop: https://v2.tauri.App/reference/config/#windowconfig

### Assumptions to recheck before READY

- T-001 is `DONE`/`VERIFIED`, T-002 is `DONE`/`VERIFIED`, no task is `IN PROGRESS`, and T-002 execution evidence supplies the approved OpenPotlood identifier, exact installed executable path, working dependencies, and successful x64 NSIS route.
- T-002 leaves the verified drop/image interfaces and `dragDropEnabled: false` intact, and its three shipped version files plus local Cargo lock record agree at `0.1.0`.
- No predecessor introduces focused image-drop tests or changes the supported MIME list, image decoder, selected-parent policy, `.fig` save route, or history conventions. If it does, audit must reconcile this packet before READY.
- FFmpeg remains available only as a task-local fixture generator; it is not an application dependency and must not be bundled or added to package manifests.

### Decisions fixed by this packet

- T-003 is an improvement-and-verification task over existing support, not a second importer.
- The supported contract remains PNG (`.png`), JPEG (`.jpg`, `.jpeg`), WebP (`.webp`), GIF (`.gif`), and AVIF (`.avif`). Do not add SVG, PDF, TIFF, BMP, HEIC, video, URLs, folders, or asset-library behaviour.
- Accept a file when its lower-cased MIME is in the existing allowlist. If MIME is empty or `application/octet-stream`, accept only when its lower-cased extension is in the fixed extension allowlist. A known non-image MIME must not be overridden merely by an image-looking extension.
- `dragenter`/`dragover` may treat empty or octet-stream file items with a supported extension unavailable until `drop` as potential files, but known unsupported types must use `dropEffect = 'none'` and must not show a false success state.
- Keep corrupt/unsupported handling quiet in this packet: no toast, modal, notification system, or translation work. The observable contract is no node, no selection/history mutation, and no browser navigation.
- A single valid image is centred on the drop point. Multiple valid images retain input order, a `20` canvas-unit horizontal gap, common top alignment, and a row bounding box centred on the drop point.
- Convert the supplied canvas/world centre into the resolved parent's local coordinate system before calculating child positions. Use existing world-matrix inversion; do not assume that subtracting parent X/Y is sufficient for rotated/flipped containers.
- One drop gesture creates exactly one `Place image` history entry. Undo deletes all nodes created by that gesture in reverse order and restores the pre-drop selection. Redo restores the same node IDs, parent IDs, dimensions, names, fills, bytes, order, and dropped selection.
- Do not delete image bytes during placement undo. `SceneGraph.images` has no reference counter, existing node deletion/paste history retains unused entries, and preserving bytes is required for shared-hash safety and redo. Image garbage collection is out of scope.
- Animated GIF/WebP input may be decoded to the renderer's supported static representation. T-003 must not claim timeline or animated playback.
- If T-002 finishes at exactly `0.1.0`, T-003's completed installed update is `0.1.1`. Synchronise the root app, Tauri, Cargo package, and the local `open_pencil` Cargo lock entry only after focused checks pass; never alter publishable workspace-package versions.
- Replace the stale comparison row with these exact complete rows; preserve every other row:
  - English: `| Add images & videos | 🟡 | Image fills and drag-and-drop image import supported; no video support |`
  - German: `| Bilder & Videos hinzufügen | 🟡 | Bildfüllungen und Bildimport per Drag-and-Drop werden unterstützt; keine Videounterstützung |`
  - Spanish: `| Añadir imágenes y vídeos | 🟡 | Se admiten rellenos de imagen e importación de imágenes mediante arrastrar y soltar; no se admiten vídeos |`
  - French: `| Ajouter des images et vidéos | 🟡 | Les remplissages d’image et l’import d’images par glisser-déposer sont pris en charge ; pas de prise en charge vidéo |`
  - Italian: `| Aggiungere immagini e video | 🟡 | Sono supportati i riempimenti immagine e l’importazione di immagini tramite trascinamento; nessun supporto video |`
  - Polish: `| Dodawanie obrazów i wideo | 🟡 | Obsługiwane są wypełnienia obrazem i import obrazów metodą przeciągnij i upuść; brak obsługi wideo |`
  - Russian: `| Добавление изображений и видео | 🟡 | Поддерживаются заливки изображениями и импорт изображений перетаскиванием; видео не поддерживается |`

### Decisions still required

- NONE. Any request for unsupported-format feedback, animation, asset-library persistence, image editing/cropping, external links, or different placement/parent semantics is a scope change and must return to packet audit.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-001-fresh-source-capability-and-toolchain-audit.md`
- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- `Plan/Packets/T-002-openpotlood-windows-identity-and-baseline.md`
- The verified T-001/T-002 execution reports and `Toolbox/Project-History/PROJECT_LOG.md`
- `App/AGENTS.md`
- `App/packages/vue/src/canvas/drop/use.ts`
- `App/packages/vue/src/index.ts`
- `App/src/components/EditorCanvas.vue`
- `App/packages/core/src/editor/clipboard/images.ts`
- `App/packages/core/src/editor/clipboard.ts`
- `App/packages/core/src/editor/clipboard/paste-target.ts`
- `App/packages/core/src/editor/bridges/clipboard.ts`
- `App/packages/core/src/editor/viewport.ts`
- `App/packages/core/src/editor/undo.ts`
- `App/packages/scene-graph/src/coordinate.ts`
- `App/packages/scene-graph/src/matrix.ts`
- `App/packages/scene-graph/src/undo.ts`
- `App/src/app/shell/keyboard/clipboard.ts`
- `App/src/app/document/io/save.ts`
- `App/packages/core/src/io/formats/fig/export.ts`
- `App/tests/e2e/fixtures.ts`
- `App/tests/helpers/canvas.ts`
- `App/tests/e2e/clipboard/paste-into-container.spec.ts`
- `App/tests/engine/editor/clipboard/paste-target.test.ts`
- `App/tests/engine/io/fig/export/images.test.ts`
- `App/desktop/tauri.conf.json`
- `App/package.json`
- `App/desktop/Cargo.toml`
- the local `open_pencil` record in `App/desktop/Cargo.lock`
- `App/CHANGELOG.md`
- the seven existing `App/packages/docs/**/guide/figma-comparison.md` files
- https://developer.mozilla.org/en-US/docs/Web/API/DataTransfer/files
- https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
- https://v2.tauri.App/reference/config/#windowconfig

## Allowed Changes

- `App/packages/vue/src/canvas/drop/use.ts`
- `App/packages/core/src/editor/clipboard/images.ts`
- `App/tests/engine/vue/canvas/drop.test.ts` (new)
- `App/tests/engine/editor/clipboard/images.test.ts` (new)
- `App/tests/engine/app/image-drop-config.test.ts` (new)
- `App/tests/e2e/canvas/image-drop.spec.ts` (new)
- `App/CHANGELOG.md`, only one concise Unreleased fix/verification entry; do not duplicate its existing feature claim.
- `App/packages/docs/guide/figma-comparison.md`
- `App/packages/docs/de/guide/figma-comparison.md`
- `App/packages/docs/es/guide/figma-comparison.md`
- `App/packages/docs/fr/guide/figma-comparison.md`
- `App/packages/docs/it/guide/figma-comparison.md`
- `App/packages/docs/pl/guide/figma-comparison.md`
- `App/packages/docs/ru/guide/figma-comparison.md`
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only for the synchronised final patch version after focused checks pass.
- The local `open_pencil` package record only in `App/desktop/Cargo.lock`, solely to mirror the final Cargo package version.
- Normal ignored/generated Vite, package-build, Rust, and NSIS output.
- This packet's execution report and normal pipeline evidence fields.

Any additional application/source/test/docs path requires a `STALE PACKET` stop and audit amendment before editing.

## Restrictions and Exclusions

- Do not edit or execute anything under `Toolbox/`, copy previous-project code, or treat previous completion claims as current evidence.
- Do not initialise Git or use a branch, worktree, commit, tag, pull request, push, release, publishing, deployment, updater, signing, credential, or remote service.
- Do not add a dependency, native Tauri drag event listener, file-system permission, upload service, asset library, custom image codec, worker, toast system, or second image-placement path.
- Do not change `App/src/components/EditorCanvas.vue` unless a focused E2E test proves the verified wiring/overlay fact false. If it does, stop for audit because that file is intentionally outside Allowed Changes.
- Preserve `dragDropEnabled: false`. Do not switch to Tauri native file-drop events; official Windows guidance and the existing Vue route require frontend HTML5 events.
- Do not change `SceneNode`, `Fill`, Kiwi, `.fig`, clipboard format, package/API/protocol names, `window.openPencil`, file extensions, or MIME markers.
- Do not broaden format support. Do not describe GIF/WebP as animated playback, import video, rasterise SVG/PDF, follow URLs, or accept directories.
- Do not delete shared or unused `graph.images` bytes during undo and do not invent reference counting/garbage collection.
- Do not change normal image dimensions except the existing proportional `4096` maximum; preserve input order, `20` gap, names, `FILL` image scale mode, opacity, and visibility.
- Do not silently fall back to page placement when a valid chosen parent has a non-invertible transform. Stop that placement without document/history mutation and cover the case.
- Do not update generated SDK API Markdown; `useCanvasDrop` remains the same public interface. Correct only the seven stale Figma-comparison rows.
- Do not mass-format the repository. Format only touched files. Do not run `format:check`, which requires Git in this intentionally non-Git project.
- Do not increment the version until focused unit, E2E, docs, and full quality checks pass. Do not leave a completed version/installed claim if build, install, launch, drop, save/reopen, or restart verification fails.
- Do not disturb or use installed OpenPencil/OpenPencil Studio as proof. Use the executed T-002 OpenPotlood path and retained installer rules.

## Implementation Steps

1. Recheck every assumption against the verified T-001/T-002 reports and live files. Require T-002 `DONE`/`VERIFIED`, T-003 `READY`, no task `IN PROGRESS`, working `App/node_modules`, matching app-version sources, `dragDropEnabled: false`, and an authoritative installed OpenPotlood executable path. Stop before edits on any mismatch.
2. Record the predecessor installed version and SHA-256 hashes of every allowed existing file that will change. Because there is no Git, use these as the opening diff/rollback receipt.
3. Add `App/tests/engine/vue/canvas/drop.test.ts` following existing `#vue/*` Bun-test imports. Cover the five exact MIME types, case-insensitive supported extensions for empty/octet-stream MIME, `.jpeg`, known non-image MIME with image-looking extension, unsupported extension, mixed lists, and null/empty transfer data.
4. In `App/packages/vue/src/canvas/drop/use.ts`, keep one named MIME set and add one named extension set plus small pure predicates. MIME matching must be lower-case. Extension fallback is allowed only for empty or `application/octet-stream` MIME. Reuse the same predicate for drop and clipboard file filtering; do not duplicate lists.
5. Make the drag-item predicate accept known supported image MIME items and potential empty/octet-stream file items, reject known non-image items, and keep `preventDefault()` plus `dropEffect = 'copy'` only for accepted/potential file drags. Known unsupported file drags use `dropEffect = 'none'` and do not set the highlight.
6. Preserve `DataTransfer.files` reading inside the `drop` handler, the existing canvas bounding rectangle calculation, `screenToCanvas()`, and shared `editor.placeImageFiles()` call. Always clear `isDraggingOver` on drop/leave. Do not add native Tauri imports.
7. Add `App/tests/engine/editor/clipboard/images.test.ts` around `createClipboardImageActions()` using an `EditorContext` test double, real `SceneGraph`, real `UndoManager`, and a minimal fake CanvasKit image decoder with deterministic widths/heights. Do not initialise the full renderer.
8. First prove current placement invariants in that test: one decoded file produces a rectangle named from the filename, one image fill with the stored hash/bytes, original dimensions below the cap, proportional dimensions at the `4096` cap, selected result, and one render request.
9. Prove multiple-file placement: preserve file order; common top; exact `20` gap; row bounds centred on the supplied drop point; one selected set containing all created IDs; and corrupt files skipped without changing valid-file order.
10. Prove rejection: all-corrupt input, unsupported-filter output, and a parent with non-invertible world transform create no nodes, history entry, selection change, image-map change, layout run, or render request.
11. Prove parent coordinate behaviour: page placement at non-default pan/zoom is supplied in world coordinates; a translated container and a rotated/flipped container receive child-local coordinates whose world-space row centre equals the requested drop point within a small numeric tolerance. Preserve `resolvePasteTarget()` rather than creating a new parent rule.
12. Prove atomic history: select a pre-existing node, place two files, require `undoLabel === 'Place image'`, undo once, and assert both dropped nodes are absent and the previous selection is restored. Redo once and assert both stable IDs, parent/order, names, dimensions, fills, bytes, and dropped selection return.
13. Prove shared-hash safety twice: place identical bytes in two different drop gestures, undo the later gesture, and require the earlier node still renders from the same stored bytes; then place duplicate bytes in one multi-file gesture, undo/redo once, and require one content hash with both restored fills valid.
14. Refactor `App/packages/core/src/editor/clipboard/images.ts` only after the failing tests exist. Keep asynchronous decoding before mutation. Resolve the parent once, convert the drop centre through the inverse parent world matrix, and return without mutation if inversion fails.
15. Replace per-node history pushes with one placement transaction: capture `prevSelection`; create all nodes; retain structured snapshots and unique hash/byte pairs; select all IDs; run layout for the resolved parent where existing editor conventions require it; request one render; then push one `Place image` undo entry.
16. In that entry, `inverse` deletes created IDs in reverse order, reruns parent layout, and restores a fresh copy of `prevSelection`; it does not delete image-map entries. `forward` restores unique bytes first, recreates each rectangle with its stable ID and `childIds: []`, preserves sibling order, reruns layout, and selects a fresh set of dropped IDs.
17. Add `App/tests/engine/app/image-drop-config.test.ts` using the existing repo-path/file-parsing test pattern. Parse `desktop/tauri.conf.json` and require exactly one configured main window with `dragDropEnabled === false`; do not assert unrelated T-002 identity values here.
18. Add `App/tests/e2e/canvas/image-drop.spec.ts` using `useEditorSetupWithClear`, `CanvasHelper`, the existing canvas integration locator, browser-created `File` objects, `DataTransfer`, and dispatched `dragenter`/`dragover`/`drop` events. Do not add test hooks to application components.
19. E2E-test the highlight and single PNG placement at non-default pan/zoom. Compute expected canvas coordinates through the live store, dispatch at a known client point, wait for render, and require one selected editable rectangle whose world-space centre matches the expected drop point, whose name excludes the extension, and whose image hash resolves to bytes.
20. E2E-test two same-byte files in one gesture: exact row order/gap, both selected, one stored content hash, one Undo removing both/restoring the prior selection, and one Redo restoring both with valid fills. Call `editor.canvas.assertNoErrors()`.
21. E2E-test known unsupported and corrupt files: no node-count, selection, scene-version/history-label, or image-map change; no browser navigation; no uncaught error. Also test a supported-extension file with octet-stream MIME reaches decoder/placement.
22. Re-run existing `.fig` image export coverage and extend the new engine placement test or focused existing test with placement-originated export/reimport proof: the reopened node retains name, dimensions, image fill/hash, and exact image bytes. Do not change codec implementation unless this regression fails; if it fails, stop for audit.
23. Correct only the image/video comparison row in the seven allowed docs files using the exact complete rows under **Decisions fixed by this packet**. Do not change table structure, punctuation, status, or unrelated comparisons.
24. Add one concise Unreleased Fixes entry to `App/CHANGELOG.md`: multi-file image drops now undo/redo atomically, preserve shared image bytes, and place correctly in canvas/container coordinates. Do not add a second generic feature claim.
25. Format only touched source/test/docs files. Run the focused Bun tests, E2E spec, existing `.fig` image export test, and docs build listed below. Fix only packet-caused failures; stop on baseline or unrelated failures.
26. Run `bun run check`. After it passes, compute the next patch from the verified T-002 installed version. If the predecessor is `0.1.0`, set exactly `0.1.1` in `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`, and mirror only the local `open_pencil` record in `App/desktop/Cargo.lock`.
27. Re-run focused tests after the version edit, run the targeted Windows Cargo check, record `$buildStart`, and build one x64 MSVC NSIS installer. Select exactly one fresh OpenPotlood installer written after `$buildStart`, record path/size/time/SHA-256, hash it again immediately before install, and require equality.
28. Silently install that exact installer with uppercase `/S`. Resolve the installed executable from T-002's executed evidence, read SHA-256 and `VersionInfo`, launch that exact path, and require OpenPotlood identity, the T-003 version, matching executable path, non-zero window handle/title, and `Responding=True` twice.
29. Generate task-local 120×80 solid-colour PNG, JPEG, WebP, GIF, and AVIF files under a newly created `%TEMP%\openpotlood-t003-<timestamp>` folder using the verified FFmpeg executable. Record the exact FFmpeg commands and hashes; do not add fixtures to `App/` or depend on a network download.
30. In the installed app, use Windows Explorer to drag each of the five fixture formats onto distinct known canvas points. Confirm the drop highlight, editable selected rectangle, correct name/dimensions/position, visible pixels, and no browser navigation/error. GIF/WebP acceptance proves only the static representation shown by the renderer.
31. Select an existing rectangle, drag the same PNG twice in one multi-file gesture, confirm exact order/gap and shared visible bytes, then perform one Undo and one Redo. Require the earlier selection to return on undo and both images to return on redo.
32. Create/select a translated and rotated frame, drop an image at a visible point inside it, and confirm the image becomes a child while its world-space centre matches the drop point. If the app cannot expose/verify this without ambiguity, stop rather than accepting approximate placement.
33. Save the installed document as `.fig` inside the task-local folder, record its SHA-256, close and reopen it in OpenPotlood, and confirm all dropped nodes, names, positions, dimensions, fills, and visible bytes persist. Close the app, relaunch the same installed executable, reopen again, and repeat the visible check.
34. Record final installer/executable/document/fixture paths and hashes, installed metadata/version, process ID/path/title/handle/responsiveness, test counts, and real-app observations. Keep the task-local fixtures and installer until audit; do not delete evidence during execution.
35. Run the pipeline validator, append the execution receipt, and leave packet/task advancement to the audit role. Do not mark T-003 `VERIFIED` or task `DONE` during execution.

## Acceptance Criteria

- [ ] The existing Vue/HTML5 drop route and `EditorCanvas` highlight remain the only canvas image-drop path; Tauri main-window `dragDropEnabled` remains exactly `false` and has focused config coverage.
- [ ] Exact MIME types PNG, JPEG, WebP, GIF, and AVIF remain accepted; empty/octet-stream MIME uses only the fixed extension fallback; known non-image MIME cannot spoof acceptance through its filename.
- [ ] Unsupported, all-corrupt, and non-invertible-parent drops leave nodes, image map, selection, history, scene version, and navigation unchanged and produce no uncaught error.
- [ ] A single image is an editable named rectangle with one visible `IMAGE` fill and embedded bytes; dimensions preserve aspect ratio and neither exceeds `4096`.
- [ ] One or multiple valid images are centred at the intended world/canvas drop point under non-default pan/zoom. Multiple files preserve input order, common top alignment, and an exact `20` canvas-unit gap.
- [ ] Placement through the existing selected/entered-container target works for translated and rotated/flipped parents; the row's world-space centre matches the drop point.
- [ ] One drop gesture creates exactly one `Place image` history entry. One Undo removes every node from that gesture and restores the previous selection; one Redo restores stable IDs, parent/order, values, bytes, and dropped selection.
- [ ] Identical image content is stored under one hash; undoing one duplicate placement never invalidates another surviving image node; redo restores bytes before nodes.
- [ ] Placement-originated `.fig` export/reimport preserves the node name, size, image fill/hash, and exact embedded bytes without schema changes or flattening.
- [ ] Focused filter, core placement/history, Tauri config, E2E drop, and existing `.fig` image tests pass with no browser errors; `bun run check` and the docs build exit `0`.
- [ ] The seven Figma-comparison rows honestly report image fills plus drag-and-drop image import and retain no-video status; the changelog has one non-duplicative fix entry.
- [ ] The installed app accepts real Explorer drops for PNG, JPEG, WebP, GIF, and AVIF; each creates visible editable content at the intended point. No animation support is claimed.
- [ ] Installed multi-file atomic undo/redo, shared-hash safety, transformed-container placement, `.fig` save/reopen, app restart/reopen, and repeated process responsiveness all pass.
- [ ] If T-002 installed `0.1.0`, all three shipped version files and the local Cargo lock record report `0.1.1`; no publishable workspace-package version changes.
- [ ] Exactly one fresh x64 NSIS installer is selected; its hashes match before install; silent install exits `0`; installed metadata, exact executable path, running title, handle, and two responsiveness checks prove the new OpenPotlood build.
- [ ] No file outside Allowed Changes changes; no Toolbox/Git/release/updater/publishing/credential machinery is invoked; execution leaves status advancement to audit.

## Verification

Run from `App/` unless stated otherwise:

1. `bun test ./tests/engine/vue/canvas/drop.test.ts ./tests/engine/editor/clipboard/images.test.ts ./tests/engine/app/image-drop-config.test.ts ./tests/engine/editor/clipboard/paste-target.test.ts ./tests/engine/io/fig/export/images.test.ts` — expect exit code `0`, no module-resolution errors, and all selected filter/placement/history/config/parent/round-trip tests passing.
2. `bunx playwright test tests/e2e/canvas/image-drop.spec.ts --project=openpencil` — expect exit code `0`; all highlight, placement, rejection, duplicate, undo, redo, and browser-error assertions pass.
3. `bun --filter @open-pencil/docs build` — expect exit code `0` and no broken comparison-table/docs build error.
4. `bun run check` — expect exit code `0`. Do not run `format:check`, because it assumes a Git repository.
5. From the project root, run `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique`; expect one value, exactly one patch above the verified T-002 installed version (`0.1.1` when T-002 is `0.1.0`).
6. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit code `0` and the local Cargo lock record matching the app version.
7. Record `$buildStart=(Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`; expect exit code `0`, one release executable, and one fresh OpenPotlood `*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
8. From the project root, run `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File|Where-Object{$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; $hash1=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; $hash2=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; if($hash1 -ne $hash2){throw 'Installer hash changed before install'}; "$($installer[0].FullName)|$hash1"`; expect one absolute installer path and stable SHA-256.
9. Install with `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}`; expect no exception. Reuse T-002's executed installed-path, `VersionInfo`, executable-hash, exact-path launch, title/handle, and repeated `Responding=True` commands, requiring the T-003 version.
10. Generate real-app fixtures in a new task-specific temp folder using five recorded FFmpeg invocations based on `ffmpeg -f lavfi -i color=c=<colour>:s=120x80:d=1 -frames:v 1 <output>`; use ordinary extension-selected encoders for PNG/JPEG/GIF/WebP and `-c:v libaom-av1 -still-picture 1 -f avif` for AVIF. Require five non-empty files and record each SHA-256 before Explorer-drop checks.
11. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` Record the result but do not advance T-003.

Record actual exit codes, pass/fail counts, paths, hashes, versions, and observations rather than replacing them with “passed”.

## Integration or Installed-Result Check

- Mandatory and indivisible: focused filter/core/config/round-trip tests → drop E2E → docs build → full quality gate → synchronised patch version → Windows Cargo check → one fresh x64 NSIS build → stable installer hash → silent install → installed identity/version/hash → exact-path launch → real Windows Explorer drops for all five formats → atomic multi-file undo/redo and shared-hash proof → transformed-container placement → `.fig` save/reopen → app restart/reopen → repeated responsiveness.
- Use the installed OpenPotlood executable proven by T-002, not Vite preview, an old OpenPencil/OpenPencil Studio process, a stale installer, or source-only tests.
- Synthetic Playwright `DragEvent` coverage does not replace the real Explorer-to-installed-webview check. Conversely, manual observation does not replace exact node/history/round-trip assertions.
- Keep the task-local fixture folder, saved `.fig`, and fresh installer until audit. Record absolute paths and SHA-256 values so the audit role can reproduce the result.

## Stop Conditions

- T-001 or T-002 is not `DONE`/`VERIFIED`; T-003 is not `READY`; another task is `IN PROGRESS`; required reports are missing; the verified installed path/identifier is absent; or starting App/Cargo versions disagree.
- `App/node_modules` remains absent/unusable after the predecessor-authorised setup, workspace imports do not resolve, or the focused pre-change baseline cannot run.
- Any verified source/test path moved, `dragDropEnabled` changed, supported types changed, a predecessor added competing drop coverage, or source hashes differ without explained predecessor changes.
- Valid Windows Explorer drops do not reach frontend events despite `dragDropEnabled: false`; resolving this would require Tauri native events, permissions, or architecture changes.
- Correct placement requires changing parent-selection semantics, scene-graph transforms, renderer code, or a file outside Allowed Changes. Return for audit rather than approximating coordinates.
- A supported PNG/JPEG/WebP/GIF/AVIF fixture cannot decode in the installed build. Record the exact format/file/hash and stop for capability/scope audit; do not silently remove it from the fixed contract or add a codec.
- `.fig` export/reimport loses placement-originated image bytes or fields and the fix requires changing Kiwi/schema/import/export implementation.
- Undo/redo cannot be made atomic and shared-hash safe without reference counting, garbage collection, schema changes, or a second history system.
- A requested error message, animation, asset library, crop/edit flow, external URL, additional format, directory import, or video capability becomes required.
- Any focused test, E2E, docs build, `bun run check`, Cargo check, Tauri build, installer selection/hash, install, identity/version, exact-path launch, Explorer drop, save/reopen, restart, title/handle, or responsiveness check fails.
- More or fewer than one fresh installer qualifies, the installed path differs from verified T-002 evidence without explanation, or stale processes/artefacts could contaminate proof.
- Completion would require editing outside Allowed Changes, invoking Git/Toolbox/release/updater/publishing/credential machinery, or changing the project route/dependency/outcome.

## Execution Report Contract

- Report result (`DONE`, `BLOCKED`, or `STALE PACKET`); reconciled T-001/T-002 evidence; predecessor and T-003 versions; every file changed and why; opening/final hashes; actual commands, exit codes, and test counts; docs rows checked; installer/executable/fixture/`.fig` absolute paths and SHA-256 values; installed `VersionInfo`; process ID/path/title/handle and both responsiveness checks; exact Explorer-drop observations for all five formats; atomic undo/redo/shared-hash/container/save/reopen/restart evidence; deviations; and mess or concerns.
- State explicitly that the feature reused the existing Vue/core path, one drop is one history entry, unused image bytes remain intentionally retained for shared-hash safety, animation is not claimed, application code changed during execution, and packet/task advancement was left to audit.

## Status record

Status: **Done**
