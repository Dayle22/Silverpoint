# T-013 — Deliver vector clipping and layer masks

Task ID: T-013
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-006
Prepared against: Live `App/` source, tests, and current official Figma/Skia documentation on 2026-07-24; T-006 is DONE/VERIFIED. T-010 is READY, T-011 and T-012 are PREPARED; this explicit user request authorises expansion of T-013 now.
Last expanded: 2026-07-24

## Request Coverage

- Let editable vector paths, basic shapes, frames, or text content act as vector clipping masks or layer masks non-destructively.
- Preserve hidden source content and allow masks to be edited, reordered, enabled/disabled (`isMask: boolean`), or removed.
- Support switching mask types (`maskType`: `'ALPHA' | 'VECTOR' | 'LUMINANCE'`) via property panel dropdown.
- Keep rendering (Skia CanvasKit `saveLayer`, `DstIn` blend mode, `Luma` filter) and supported export/save (`.fig` Kiwi import/export, SVG, PDF) visually consistent.
- Ensure the Layers panel clearly displays mask icons/badges and masked child relationships.
- Keep this private, local-only Windows work inside `App/`; no Git, worktree, branch, release, updater, publishing, deployment, signing, or `Toolbox/` execution.

## User-Visible Outcome

Selecting a layer (or layers) and toggling mask (`selection.toggleMask`, `Ctrl+Alt+M`, context menu, or property control) marks the selected node as `isMask = true`. In the canvas, the mask node masks all subsequent sibling layers above it in the same parent container (up to the next mask node or end of siblings). The Layers panel shows a distinct mask icon next to mask nodes and visual indicators for masked siblings. Selecting and moving, scaling, or editing a mask node or a masked child immediately updates the rendered canvas result. Switching `maskType` between Alpha, Vector, and Luminance updates rendering live. Reordering or removing the mask restores normal layer rendering. Toggling mask status, mask type edits, and canvas rendering survive `.fig` save/reopen, export (PNG, SVG, PDF), undo/redo, and installed app relaunch.

## Verified Starting State

### Verified facts

- `App/packages/scene-graph/src/types.ts:165` defines `MaskType = 'ALPHA' | 'VECTOR' | 'LUMINANCE'`; `:432-433` defines `isMask: boolean` and `maskType: MaskType` on `SceneNode`.
- `App/packages/scene-graph/src/node-defaults.ts:128-129` sets default `isMask: false`, `maskType: 'ALPHA'`.
- `App/packages/scene-graph/src/source-metadata.ts:78-79` tracks `isMask` and `maskType` fields.
- `App/packages/core/src/canvas/masks.ts` defines `renderMaskedChildIds(...)` which uses `canvas.saveLayer(r.effectLayerPaint, layerBounds)` with `r.ck.BlendMode.DstIn` and optional `r.ck.ColorFilter.MakeLuma()`.
- `App/packages/core/src/canvas/scene.ts:145-164` calls `renderMaskedChildIds` during container child rendering to evaluate `child.isMask` and `child.maskType`.
- `App/packages/core/src/figma-api/proxy.ts:345-358` exposes `isMask` and `maskType` getters/setters on Figma API node proxies.
- `App/packages/core/src/kiwi/fig/node-change/convert.ts:601-602` converts Kiwi `mask` and `maskType` into `isMask` and `maskType`.
- `App/packages/core/src/kiwi/fig/node-change/serialize.ts:407-409` serializes `node.isMask` and `node.maskType` into Kiwi `nc.mask` and `nc.maskType`.
- `App/packages/vue/src/editor/selection-capabilities/use.ts:40` exposes `canToggleMask`.
- `App/packages/vue/src/editor/commands/selection.ts:134-150` implements `selection.toggleMask` command toggling `{ isMask: !target.isMask }` with undo label `Use as mask` / `Remove mask`.
- `App/packages/vue/src/controls/mask/use.ts:1-23` provides `useMask()` composable with `active`, `maskType`, and `setMaskType()`.
- `src/components/properties/MaskSection.vue` renders property panel control for `maskType` dropdown (`Alpha`, `Vector`, `Luminance`).
- `tests/engine/io/fig/import/masks.test.ts`, `tests/engine/io/fig/export/masks.test.ts`, `tests/engine/io/fig/import/mask-oracle.test.ts` test schema import/export for masks.
- `tests/engine/figma/api/mask.test.ts` tests Figma API proxy mask getters/setters.
- `tests/e2e/properties/effects.spec.ts:214-286` tests canvas visual rendering of alpha mask stack (`alpha-mask-stack`).
- `tests/e2e/design/panel.spec.ts:269-281` tests property panel `Mask type` selection and mask toggle.

### Official research

- Figma Official Documentation on Masking: A mask layer masks all siblings above it in the layer stack up to the top of the parent container or until another mask layer is encountered. Consecutive mask layers combine their mask areas. Mask types include Vector (path outline), Alpha (transparency channel), and Luminance (brightness/grayscale conversion). Source: https://help.figma.com/hc/en-us/articles/360040450753-Masks
- Skia / CanvasKit Masking & Compositing: CanvasKit uses `saveLayer` with `BlendMode.DstIn` to apply an alpha mask layer onto previously drawn content, and `ColorFilter.MakeLuma()` to turn RGB luminance into alpha mask values. Source: https://api.skia.org/classSkCanvas.html

### Fixed implementation decisions

- Masking scope: A node with `isMask: true` masks all subsequent siblings in the same parent container until another node with `isMask: true` or the end of the sibling array. Hidden mask nodes (`visible: false`) do NOT mask content.
- Consecutive mask layers: Multiple adjacent mask nodes combine by accumulating their masks on subsequent non-mask siblings.
- Mask types: `'ALPHA'` (uses mask node's alpha channel), `'VECTOR'` (uses mask node's path bounds/fill geometry alpha), `'LUMINANCE'` (converts mask node's RGB color brightness to alpha using `ColorFilter.MakeLuma()`).
- UI representation:
  - Command: `selection.toggleMask` (toggle `isMask`).
  - Shortcut: `Ctrl+Alt+M` (registered in application keyboard shortcuts schema).
  - Context menu & Object menu: Object -> Use as mask / Remove mask.
  - Layers Panel: Display mask badge/icon next to mask nodes in `LayersPanel.vue` and indicate masked child relationship.
  - Property Panel: Render `MaskSection.vue` when mask node is selected, allowing `maskType` switching between Alpha, Vector, and Luminance.
- Exclusions: Destructive clipping/trimming of underlying vector paths, permanent boolean rasterization of mask geometry, and automatic group wrapping on mask creation unless requested by specific shortcut behavior.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-006-effects.md`
- `Toolbox/Project-History/reports/T-006-effects.md`
- `App/packages/scene-graph/src/types.ts`
- `App/packages/core/src/canvas/masks.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/core/src/kiwi/fig/node-change/convert.ts`
- `App/packages/core/src/kiwi/fig/node-change/serialize.ts`
- `App/packages/vue/src/editor/commands/selection.ts`
- `App/packages/vue/src/editor/selection-capabilities/use.ts`
- `App/packages/vue/src/controls/mask/use.ts`
- `src/components/properties/MaskSection.vue`
- `App/src/components/LayersPanel.vue`
- `tests/engine/io/fig/import/masks.test.ts`
- `tests/engine/io/fig/export/masks.test.ts`
- `tests/engine/io/fig/import/mask-oracle.test.ts`
- `tests/engine/figma/api/mask.test.ts`
- `tests/e2e/properties/effects.spec.ts`
- `tests/e2e/design/panel.spec.ts`

## Allowed Changes

- `App/packages/core/src/canvas/masks.ts` — only if mask stack grouping, vector mask geometry, or luminance filter handling has a proven rendering defect.
- `App/packages/core/src/canvas/scene.ts` — only if container child traversal or mask layer bounds calculation has a proven defect.
- `App/src/components/LayersPanel.vue` — to add visual mask icons/badges and masked child indicator styling.
- `App/src/app/shell/menu/schema.ts` / `use.ts` — to register Object menu and shortcut `Ctrl+Alt+M` for mask toggle if missing.
- `App/packages/export/` (SVG & PDF exporters) — to ensure mask elements (`<mask id="...">` in SVG and clip/mask paths in PDF) export accurately.
- `tests/engine/canvas/masks.test.ts` or new unit tests — to cover mask stack rendering, vector/alpha/luminance mask types, and hidden mask behavior.
- `tests/e2e/design/masks.spec.ts` — new E2E test file covering mask creation via shortcut/command, properties panel maskType toggle, layer panel indicators, undo/redo, `.fig` save/reopen, and export.
- `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml` — only for version increment upon completed production build.

## Restrictions and Exclusions

- Do not perform destructive vector path clipping or flatten masked content into raster/single vector nodes.
- Do not change existing `.fig` Kiwi schema definitions for `mask` and `maskType`.
- Do not alter non-mask rendering paths, auto-layout calculations, or unrelated effect layer pipelines.
- Do not use screenshot-only evidence. Assert node state (`isMask`, `maskType`), layer panel DOM elements, store properties, and exported files.
- Do not make application code edits during packet expansion.

## Implementation Steps

1. Re-read `Toolbox/Project-History/PROJECT.md`, `Plan/plan.md`, and this packet. Confirm T-006 is `DONE`/`VERIFIED`, T-013 is the only expanding packet, and no app edits are made during preflight.
2. Record baseline SHA-256 hashes for all target files (`masks.ts`, `scene.ts`, `selection.ts`, `MaskSection.vue`, `LayersPanel.vue`, etc.) and the version files.
3. Run current baseline test suites from `App/`:
   `bun test ./tests/engine/figma/api/mask.test.ts ./tests/engine/io/fig/import/masks.test.ts ./tests/engine/io/fig/export/masks.test.ts ./tests/engine/io/fig/import/mask-oracle.test.ts`
   Expect exit `0` and all tests passing.
4. Add focused unit tests under `tests/engine/canvas/masks.test.ts` for:
   - Single mask masking subsequent siblings in a frame/group container.
   - Mask stack termination when encountering a second mask layer or end of container.
   - Multiple consecutive mask layers combining mask areas.
   - `maskType` switching: `'ALPHA'`, `'VECTOR'`, `'LUMINANCE'`.
   - Hidden mask (`visible: false`) ignoring mask behavior.
   - Mask layer reordering in layer tree updating active masked siblings.
5. Verify and refine `LayersPanel.vue` to display mask icons/badges next to mask nodes (`isMask: true`) and visual indicators for masked sibling layers.
6. Verify shortcut key `Ctrl+Alt+M` and Object menu / context menu entry for `selection.toggleMask`.
7. Verify property panel `MaskSection.vue` controls for toggling mask and selecting `maskType` (`ALPHA`, `VECTOR`, `LUMINANCE`).
8. Verify SVG export and PDF export for masked scenes to ensure masks are preserved in vector export output.
9. Verify undo/redo after toggling mask, changing maskType, and reordering mask layers. Confirm undo restores exact original state.
10. Run Playwright E2E test `bunx playwright test tests/e2e/design/masks.spec.ts --project=openpencil` checking UI toggle, property dropdown, layer panel icons, canvas rendering, undo/redo, and `.fig` roundtrip.
11. Run `bun run check` from `App/`; expect exit `0`. Run `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc`; expect exit `0` if production code changed.
12. If production code changed, increment version in `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` by one patch level. Build NSIS installer: `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`.
13. Silently install fresh installer (`/S`), check installed identity, version (`0.x.x`), executable SHA-256, and process responsiveness (`Responding=True`).
14. In installed app, perform manual verification of mask creation, maskType switching, layer panel indicators, `.fig` save/reopen, export (PNG, SVG, PDF), and relaunch.
15. Write report `Toolbox/Project-History/reports/T-013-vector-clipping-and-layer-masks.md` documenting evidence, test results, build hashes, installed verification, and deviations.

## Acceptance Criteria

- [ ] Toggle mask action (`selection.toggleMask`, `Ctrl+Alt+M`, context menu, toolbar) toggles `isMask` on selected layers with undo/redo support.
- [ ] Mask layer correctly masks subsequent sibling layers in the same parent container up to the next mask or end of siblings.
- [ ] Multiple consecutive mask layers combine mask areas on subsequent non-mask siblings.
- [ ] `maskType` options (`ALPHA`, `VECTOR`, `LUMINANCE`) render correctly in CanvasKit using alpha channel, vector path, or luminance color filter.
- [ ] Hidden mask layers (`visible: false`) do not mask content.
- [ ] Layers panel displays mask icons/badges for mask nodes and indicates masked sibling relationships.
- [ ] Property panel (`MaskSection.vue`) allows switching `maskType` when a mask layer is selected.
- [ ] Mask state and `maskType` survive `.fig` Kiwi import/export, save/reopen, and installed app relaunch.
- [ ] SVG and PDF exports accurately represent masked vector content without corruption.
- [ ] Focused tests, `bun run check`, and (for production changes) installer build/install/launch/responsiveness checks pass.

## Verification

1. `bun test ./tests/engine/figma/api/mask.test.ts ./tests/engine/io/fig/import/masks.test.ts ./tests/engine/io/fig/export/masks.test.ts ./tests/engine/io/fig/import/mask-oracle.test.ts ./tests/engine/canvas/masks.test.ts` — expect exit `0`.
2. `bunx playwright test tests/e2e/design/masks.spec.ts --project=openpencil` — expect exit `0`.
3. `bun run check` — expect exit `0`.
4. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.
5. For production delivery: verify installed app identity, silently install fresh NSIS build, verify executable SHA-256, version, and responsive checks.
6. From project root: `python C:\Users\User\.gemini\config\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.`

## Integration or Installed-Result Check

- Mandatory for any production change: installed OpenPotlood executable must prove mask toggle, `maskType` selection, Layers panel indicators, `.fig` save/reopen/relaunch, vector SVG/PDF export, exact executable identity/version/path, and repeated responsiveness.

## Stop Conditions

- T-006 is not `DONE`/`VERIFIED`, live source paths move, or another packet is being modified.
- Mask rendering causes unhandled CanvasKit `saveLayer` memory leaks or context crashes.
- `.fig` Kiwi import/export fails to preserve `isMask` or `maskType`.
- SVG/PDF export fails or corrupts masked content.
- Build/install/launch/responsiveness checks fail or exhibit instability.

## Execution Report Contract

- Report prerequisite state; baseline and final SHA-256 hashes; changed files; focused test counts/exits; mask node/sibling IDs; Layers-panel mask icons and indicators; `maskType` switching evidence; undo/redo; `.fig` round-trip; SVG/PDF export isolation; installed installer/executable/version/path/hash/title/handle/responsiveness when applicable; deviations; and concerns.

## Status record

Status: **Done**
