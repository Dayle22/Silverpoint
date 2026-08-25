# T-006 — Deliver background blur, inner glow, and inner shadow

Task ID: T-006
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-005
Prepared against: Live `App/` source and tests on 2026-07-19; T-005 is `DONE` / `VERIFIED`, and its final report must be rechecked during READY audit
Last expanded: 2026-07-19

## Request Coverage

- Provide background blur, inner glow, and inner shadow as editable effects: retain the existing Figma-compatible background-blur and inner-shadow records, add a named inner-glow preset backed by an ordinary zero-offset inner shadow, and expose all relevant controls in the existing Effects section.
- Clip background blur to the effect owner's actual closed-shape silhouette: backdrop pixels may blur inside rectangles, independent/smoothed/rounded corners, ellipses, polygons, stars, and closed vector geometry, but must remain unchanged outside that silhouette. A node's rectangular bounds are not acceptable clipping for a non-rectangular shape.
- Let users add, edit, reorder, toggle, remove, undo, redo, save, reopen, and raster-export the requested effects: use the existing property-list actions, add observable reorder controls, preserve the ordered effect array through `.fig` export/reimport, and prove the existing CanvasKit/raster route.
- Preserve Figma compatibility: do not add `INNER_GLOW` to the scene-graph or Kiwi effect union. A glow is represented as `INNER_SHADOW` with offset `{ x: 0, y: 0 }` and remains editable through colour, opacity, radius, and spread.
- Preserve supported and unsupported source data: do not change the existing raw-effect preservation policy, silently flatten an unknown imported effect, or claim mixed editing of unsupported modern Figma effect payloads.
- Preserve the private local Windows route: no Git, branches, worktrees, releases, updater work, publishing, deployment, signing, or copied-resource execution.
- Deliver a completed local update: after focused checks pass, synchronise the next minor app version and complete the Windows NSIS build, install, launch, identity/version/hash, effect-restart, and responsive-process checks established by T-002 and reused by T-005.
- Keep later export work in route order: T-006 proves `.fig`, CanvasKit, PNG/JPEG raster, and the existing zero-spread inner-shadow SVG/PDF path. T-008 remains responsible for the complete JPEG/PNG/SVG/PDF product export matrix and any deliberate background-blur vector-export policy.

## User-Visible Outcome

In installed OpenPotlood, selecting a drawable node exposes the existing Effects section. Users can add an effect, choose Background blur, Inner shadow, or Inner glow, edit the controls applicable to that choice, move effects up or down, toggle visibility, remove effects, and undo or redo those operations. Background blur affects the backdrop only within the owning closed shape's rendered silhouette, including rounded corners and non-rectangular geometry; no blur leaks into transparent corners, concave cut-ins, or the rest of the node's bounding box. Inner glow is a friendly, editable preset rather than a new file-format type: it is shown when an inner shadow has zero X and Y offset, and changing either offset makes the row identify as Inner shadow. The ordered records survive `.fig` save/reopen; the CanvasKit canvas and PNG/JPEG raster exports show the same requested effects; unsupported vector-export claims remain deferred to T-008.

## Verified Starting State

### Verified facts

- `App/packages/scene-graph/src/types.ts` defines `Effect.type` as `DROP_SHADOW | INNER_SHADOW | LAYER_BLUR | BACKGROUND_BLUR | FOREGROUND_BLUR` with colour, offset, radius, spread, visibility, optional blend mode, and optional `showShadowBehindNode`. There is no `INNER_GLOW` model type.
- `App/packages/kiwi/src/fig/schema/fig.kiwi` effect values include `INNER_SHADOW`, `DROP_SHADOW`, `FOREGROUND_BLUR`, `BACKGROUND_BLUR`, and newer unsupported values, but no inner-glow value. `App/packages/core/src/kiwi/fig/node-change/paint.ts` imports the supported effect fields and `export-node.ts` exports `INNER_SHADOW` and `BACKGROUND_BLUR` directly while mapping local `LAYER_BLUR` to Figma `FOREGROUND_BLUR`.
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts` detects unsupported raw effect types and preserves their raw array instead of serialising the normalised supported array. T-006 must not redesign that policy or claim that supported additions can safely merge into the same imported unsupported array.
- `App/packages/vue/src/controls/effects/helpers.ts` already lists Drop shadow, Inner shadow, Layer blur, Background blur, and Foreground blur; creates a default drop shadow; and normalises offset/spread when switching between shadow and blur types.
- `App/src/components/properties/EffectsSection.vue` already uses `PropertyListRoot`, `PropertyItemRow`, `AppSelect`, `NumberField`, `ColorInput`, and semantic locators. Shadow rows expose X, Y, blur radius, spread, colour, and opacity; blur rows expose radius. Visibility/removal come from `PropertyItemRow`.
- `App/packages/vue/src/controls/property-list/use.ts` already implements ordered `effects` add, patch, toggle, remove, and `reorder(fromIndex, toIndex)` operations with undo support and multi-selection batching. `EffectsSection.vue` does not currently expose any user-facing reorder control.
- T-001 classified the requested effects as `PARTIAL` / `IMPROVE EXISTING`: background blur and inner shadow already have model, UI, renderer, tool, and test seams; the missing product work is explicit inner-glow UI/preset coverage and complete background-blur acceptance rather than duplicate effect foundations.
- `App/packages/core/src/canvas/shadows.ts` renders `BACKGROUND_BLUR` in the behind pass with `applyClippedBlur(..., effect.radius / 2)` and renders `INNER_SHADOW` in the front pass for shapes and text. A zero-offset light-coloured inner shadow uses this existing path and yields the required inner-glow pixels without a raster bake.
- `App/packages/core/src/canvas/effects.ts` already calls `clipNodeShape()` before applying the backdrop blur. `App/packages/core/src/canvas/shapes.ts` currently clips ellipses, smooth corners, rounded rectangles, and ordinary rectangles correctly, but `clipNodeShape()` falls back to `clipRect()` for polygons, stars, and vectors even though `makeNodeShapePath()` already constructs their actual paths. Existing clipping is therefore substantial but not complete enough for the user's explicit shape-clipping requirement.
- `App/packages/core/src/io/formats/raster/render.ts` deliberately keeps the full scene as the export backdrop when a selected node or descendant has visible `BACKGROUND_BLUR`; PNG/JPEG/WebP raster output therefore uses the same CanvasKit renderer as the editor.
- `App/packages/core/src/io/formats/svg/defs.ts` has an inner-shadow filter path, but treats every other visible non-drop-shadow effect as an ordinary Gaussian blur. That is not a proven background-blur/backdrop implementation. Do not claim SVG/PDF background blur in T-006; T-008 owns that policy and correction.
- `App/packages/core/src/tools/modify/effects.ts` exposes `set_effects` for drop shadow, inner shadow, foreground blur, and background blur. It does not accept an inner-glow preset and currently constructs effect defaults locally.
- `App/tests/e2e/properties/effects.spec.ts` has committed CanvasKit visual coverage for drop shadow, inner shadow, layer blur, ordering combinations, text, spread, masks, and visibility, but no explicit background-blur or inner-glow snapshot.
- Existing focused seams include `App/tests/engine/editor/effects-and-resize.test.ts`, `App/tests/engine/render/canvas/effects/**`, `App/tests/engine/render/canvas/raster-export.test.ts`, `App/tests/engine/io/fig/import/legacy/effects.test.ts`, `App/tests/engine/io/fig/roundtrip/basic.test.ts`, `App/tests/engine/io/svg/export/render.test.ts`, and `App/tests/engine/tools/modify.test.ts`.
- The main editable document route saves and reopens `.fig` through `App/src/app/document/io/save.ts`, `App/src/app/document/io/read.ts`, and `App/packages/core/src/io/formats/fig/**`; `.pen` is an import adapter, not the normal save format.
- `App/AGENTS.md` requires public package boundaries, semantic property-panel patterns, user-facing `CHANGELOG.md` entries, `bun run check`, and committed CanvasKit visual coverage for pixel-affecting changes.
- The project envelope and `App/` remain intentionally non-Git: `git -C app status --short` returns `fatal: not a git repository`. Current source hashes include `EffectsSection.vue` `F489E8C91589C33E34901FDEEF89B1AD5ED5D4CD8E8CE7182423A475D1281EB9`, effect helpers `EA4ED75CE663D646077C1159D0812DD0F2074334F10FC03133B0E834804CB9C9`, `shadows.ts` `0FEEA8BED4F8B44E4819C0E14529B8A4412F691A18C0A1322BF44ABEA7D0778D`, `effects.ts` `99D7211EA1BABCEB8E97B85CD6D68446B0A2A34D995DB7704DDC157252DB1130`, `shapes.ts` `44D07EFD953212FA731A9A2465750284155662A15918FDDE65A0C2BD3F5397D2`, and `modify/effects.ts` `1A7485C24D9FDC2D6ED0A09667968B20F2279F0A32FB59B8E0F59122667901AF`.
- Bun `1.3.14`, Cargo `1.97.0`, and rustc `1.97.0` are available, and `App/node_modules` exists. `bun test tests/engine/render/canvas/effects` passes the current baseline with `32 pass`, `0 fail`, and `94 expect()` calls across seven files. That suite proves the existing backdrop-filter call and some path-shadow behaviour, but it does not yet prove background blur stays unchanged outside polygon, star, or closed-vector silhouettes.
- All three live shipped-version files currently agree on OpenPotlood `0.2.1`: `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`. T-005 is `DONE` / `VERIFIED`; its installed version and final report are the predecessor authority at T-006 READY audit.
- Current official Figma Plugin API documentation lists DropShadowEffect, InnerShadowEffect, and BlurEffect (`LAYER_BLUR | BACKGROUND_BLUR`) but no inner-glow effect. It documents radius as non-negative and inner-shadow positive spread as contracting the shadow: https://developers.figma.com/docs/plugins/api/Effect/
- Current official Skia documentation exposes blur image-filter semantics used by CanvasKit's image-filter surface: https://api.skia.org/classSkImageFilters.html
- Official Tauri v2 documentation confirms `tauri build` creates Windows bundles and the NSIS installer route used by T-002/T-005: https://v2.tauri.App/reference/cli/ and https://v2.tauri.App/distribute/windows-installer/

### Assumptions to recheck before READY

- T-001 through T-005 do not replace the verified effect model, Effects section, property-list actions, CanvasKit renderer, `.fig` codec, tool, test runner, or Tauri/NSIS route.
- T-005 is `VERIFIED`, its installed OpenPotlood version is recorded, all three version files agree, `App/node_modules` is usable, and no other task is `IN PROGRESS` when T-006 is promoted.
- T-002's execution report confirms the installed executable path, Windows identity checks, NSIS selection rule, exact-path launch, and responsiveness checks. Reuse the executed evidence rather than the prepared assumptions if they differ.
- No T-001 report or predecessor evidence has yet proved a distinct inner-glow payload or an approved SVG/PDF background-blur representation. Any such new evidence requires packet audit before execution.

### Decisions fixed by this packet

- Inner glow is a preset/view over a normal `INNER_SHADOW`, not a sixth `Effect.type`. `isInnerGlowEffect(effect)` is true only when `effect.type === 'INNER_SHADOW'` and both offsets are exactly zero.
- Background blur is a backdrop filter clipped to the effect owner's closed rendered silhouette. Preserve the existing ellipse and rectangular/rounded/smoothed-corner routes; route `POLYGON`, `STAR`, and closed `VECTOR` owners through the existing `makeNodeShapePath()` geometry. Blur outside the resulting path must be zero. Do not reinterpret the requirement as clipping only to `width × height` bounds.
- Background blur on `LINE`, open vector paths without a closed fill silhouette, and text glyph outlines is not invented by this packet. If execution proves the requested effect must support one of those ambiguous geometries, stop for audit with a concrete fixture rather than selecting bounds or stroke-outline semantics.
- The canonical inner-glow factory returns exactly: type `INNER_SHADOW`; colour `{ r: 1, g: 1, b: 1, a: 0.6 }`; offset `{ x: 0, y: 0 }`; radius `8`; spread `0`; visible `true`; blend mode `NORMAL`.
- Add the factory and predicate to the existing `@open-pencil/scene-graph/node-defaults` boundary so Vue controls, core tools, descriptions, and tests use one definition. Do not duplicate the preset literal.
- Add a UI-only effect choice value `INNER_GLOW`; it must never enter `SceneNode.effects` or Kiwi output. Selecting it replaces the selected record with the canonical factory result. A reopened zero-offset inner shadow is labelled Inner glow by the predicate; editing either offset away from zero immediately labels it Inner shadow.
- Keep the existing plus action as Add effect and its default as Drop shadow. Inner glow is selected from the existing effect type selector; no new popup, dependency, or effect-style system is introduced.
- Expose reorder through two accessible row-rail buttons: Move effect up and Move effect down. Disable Up on the first row and Down on the last row; call the existing `actions.reorder()` exactly once per activation. Do not introduce drag identities to index-only effect records.
- Use these exact English keys and translations in the existing panel locale dictionaries: `innerGlow`, `moveEffectUp`, `moveEffectDown`. English: `Inner glow`, `Move effect up`, `Move effect down`; German: `Inneres Leuchten`, `Effekt nach oben verschieben`, `Effekt nach unten verschieben`; Spanish: `Resplandor interior`, `Mover efecto hacia arriba`, `Mover efecto hacia abajo`; French: `Lueur intérieure`, `Déplacer l’effet vers le haut`, `Déplacer l’effet vers le bas`; Italian: `Bagliore interno`, `Sposta effetto su`, `Sposta effetto giù`; Japanese: `内側の光彩`, `効果を上へ移動`, `効果を下へ移動`; Polish: `Blask wewnętrzny`, `Przenieś efekt w górę`, `Przenieś efekt w dół`; Russian: `Внутреннее свечение`, `Переместить эффект вверх`, `Переместить эффект вниз`; Simplified Chinese: `内发光`, `上移效果`, `下移效果`.
- Add `INNER_GLOW` only to the `set_effects` tool's input enum. The tool converts it through the canonical factory and stores `INNER_SHADOW`; descriptions identify zero-offset inner shadows as inner glow. Do not expose `INNER_GLOW` through the public scene-graph type.
- T-006 does not redesign SVG/PDF backdrop filters. It verifies the canonical zero-spread inner-glow representation through the existing inner-shadow SVG/PDF route and leaves background-blur vector semantics explicitly to T-008.
- This is a substantial user-visible capability set. After all focused implementation checks pass, increment the predecessor's installed pre-1.0 version to the next minor with patch zero and synchronise only `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`.

### Decisions still required

- NONE. If predecessor evidence contradicts a fixed decision or proves a distinct required inner-glow/file-format representation, stop for packet audit instead of improvising.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-005-four-ui-themes.md`
- `Plan/Packets/T-002-openpotlood-windows-identity-and-baseline.md`
- The verified T-001 through T-005 reports and `Toolbox/Project-History/PROJECT_LOG.md`
- `App/AGENTS.md`
- `App/packages/scene-graph/src/types.ts`
- `App/packages/scene-graph/src/node-defaults.ts`
- `App/packages/scene-graph/src/copy.ts`
- `App/packages/vue/src/controls/effects/helpers.ts`
- `App/packages/vue/src/controls/effects/use.ts`
- `App/packages/vue/src/controls/property-list/use.ts`
- `App/src/components/properties/EffectsSection.vue`
- `App/src/components/properties/item-list/PropertyItemRow.vue`
- `App/packages/vue/src/i18n/messages/panels.ts`
- `App/packages/vue/src/i18n/locales/*/panels.json`
- `App/packages/core/src/canvas/shadows.ts`
- `App/packages/core/src/canvas/effects.ts`
- `App/packages/core/src/canvas/shapes.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/core/src/io/formats/raster/render.ts`
- `App/packages/core/src/io/formats/svg/defs.ts`
- `App/packages/core/src/kiwi/fig/node-change/paint.ts`
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts`
- `App/packages/kiwi/src/fig/schema/fig.kiwi`
- `App/packages/core/src/tools/modify/effects.ts`
- `App/packages/core/src/tools/describe/summaries.ts`
- `App/src/app/document/io/save.ts`
- `App/src/app/document/io/read.ts`
- `App/tests/e2e/properties/effects.spec.ts`
- `App/tests/e2e/properties/visibility.spec.ts`
- `App/tests/helpers/properties.ts`
- `App/tests/engine/render/canvas/raster-export.test.ts`
- `App/tests/engine/render/canvas/effects/types.test.ts`
- `App/tests/engine/io/fig/roundtrip/basic.test.ts`
- `App/tests/engine/io/svg/export/render.test.ts`
- `App/tests/engine/tools/modify.test.ts`
- `App/package.json`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`
- `App/CHANGELOG.md`

## Allowed Changes

- `App/packages/scene-graph/src/node-defaults.ts`
- `App/packages/vue/src/controls/effects/helpers.ts`
- `App/packages/vue/src/controls/effects/use.ts` only to expose the new canonical factory/predicate/control-type helpers already defined in the effects helper module.
- `App/src/components/properties/EffectsSection.vue`
- `App/packages/vue/src/i18n/messages/panels.ts`
- The eight existing `App/packages/vue/src/i18n/locales/*/panels.json` files, only for the three fixed keys above.
- `App/packages/core/src/tools/modify/effects.ts`
- `App/packages/core/src/tools/describe/summaries.ts`
- `App/packages/core/src/canvas/effects.ts` only to preserve the clip-before-backdrop-filter ordering and balanced canvas state required by the new regression.
- `App/packages/core/src/canvas/shapes.ts` only to make `clipNodeShape()` use existing polygon/star/closed-vector shape paths instead of rectangular bounds.
- `App/tests/engine/scene-graph/effects.test.ts` (new)
- `App/tests/engine/vue/controls/effects.test.ts` (new)
- `App/tests/engine/tools/modify.test.ts`
- `App/tests/engine/io/fig/roundtrip/effects.test.ts` (new)
- `App/tests/engine/render/canvas/raster-export.test.ts`
- `App/tests/engine/render/canvas/effects/types.test.ts`
- `App/tests/engine/render/canvas/effects/background-blur-clipping.test.ts` (new)
- `App/tests/engine/io/svg/export/render.test.ts` only for the canonical zero-spread inner-glow/inner-shadow regression; do not implement background-blur vector export here.
- `App/tests/e2e/properties/effects-controls.spec.ts` (new)
- `App/tests/e2e/properties/effects.spec.ts` and only the new Windows snapshot baselines created by the requested background-blur silhouette and inner-glow visual cases.
- `App/packages/docs/user-guide/drawing-shapes.md`
- `App/CHANGELOG.md` under `Unreleased`.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only for the synchronised final local app version after focused implementation checks pass.
- The T-006 execution report and normal pipeline evidence fields.

## Restrictions and Exclusions

- Do not edit any file under `Toolbox/`, copy previous-project code, execute copied resources, or treat previous completion claims as evidence.
- Do not change the project goal, route, task order, T-006 dependency, task status, or unrelated packet state.
- Do not initialise Git or use branches, worktrees, commits, tags, pull requests, publishing, deployment, updater signing, or release workflows.
- Do not change updater endpoints/settings, `createUpdaterArtifacts`, package-publishing versions, public deployment files, or publishable workspace-package versions.
- Do not add `INNER_GLOW` to `Effect`, Kiwi schema/codec, `.fig` serialisation, `SceneNode`, or any stored document payload. Do not add node plugin data merely to remember the preset label.
- Do not create a custom shader, destructive raster effect, bitmap bake, duplicate renderer path, glow style manager, outer glow, neon preset set, or effect library.
- Do not change `App/packages/core/src/canvas/shadows.ts`, `scene.ts`, or the `.fig` import/export implementation. The user-authorised renderer change is limited to the existing clip helper seams in `canvas/effects.ts` and `canvas/shapes.ts`; do not redesign effect passes, backdrop capture, scene traversal, or file format behavior.
- Do not satisfy shape clipping with a bounding rectangle, an inset rectangle, a matching-colour overlay, destructive raster mask, or test fixture whose outside-silhouette pixels are never inspected.
- Do not redesign raw unsupported Figma effect merging. Leave unsupported raw arrays preserved and stop if the requested edit cannot be represented without discarding or overwriting them.
- Do not claim background blur in SVG/PDF. T-008 owns the vector-export compatibility decision. Do not broaden T-006 into export UI, PDF print fidelity, bleed, or format-selection work.
- Do not change the default Add effect action from Drop shadow, add a new popup, or add a runtime dependency.
- Do not use literal UI strings in Vue components, raw SVG, Unicode icons, native `title` attributes, test-only props, or new global compound test IDs. Use panel i18n keys, Lucide icons, `Tip`, role/name locators, and existing semantic `data-property` attributes.
- Do not make effect controls mutate on focus. Preserve scrub-preview/commit behavior and one undo transaction per committed field change.
- Do not increment the app version before focused unit, i18n, UI, renderer, round-trip, raster, and visual checks pass. Do not retain a completed version if build/install/launch verification fails.
- Do not mass-format the repository. Format only touched source/test files with the repository formatter or use the smallest supported formatting command that does not rely on Git. Do not run `format:check`, which assumes a Git repository.

## Implementation Steps

1. Recheck all four assumptions against the verified T-001 through T-005 reports and live paths. Confirm T-005 is `VERIFIED`, T-006 is `READY`, no task is `IN PROGRESS`, `App/node_modules` resolves workspace packages, and the three shipped app-version files agree. Stop before editing on any mismatch.
2. Record the predecessor version and SHA-256 hashes of every allowed existing file that will change. Because there is no Git, these hashes are the rollback/diff receipt.
3. In `App/packages/scene-graph/src/node-defaults.ts`, import the named `Effect` type and add `createInnerGlowEffect(): Effect` returning a fresh object with the exact fixed values. Do not export a shared mutable object.
4. In the same file, add `isInnerGlowEffect(effect: Effect): boolean`, true only for `INNER_SHADOW` with exact zero X and Y offset. Add `App/tests/engine/scene-graph/effects.test.ts` proving factory values, fresh nested colour/offset objects on repeated calls, predicate true for the factory, and predicate false for non-zero offset or non-inner-shadow records.
5. In `App/packages/vue/src/controls/effects/helpers.ts`, define a UI-only `EffectControlType = Effect['type'] | 'INNER_GLOW'`. Add Inner glow to `EFFECT_OPTIONS` immediately after Inner shadow without changing the stored `Effect` union.
6. Add a pure `effectControlType(effect)` helper that returns `INNER_GLOW` when the canonical predicate is true and otherwise returns `effect.type`. Use it as `AppSelect`'s displayed model value so a saved/reopened zero-offset inner shadow is visibly identified as Inner glow.
7. Update the type-change helper to accept `EffectControlType`. Selecting `INNER_GLOW` must replace that record with a fresh canonical preset. Selecting a real blur continues to zero offset/spread. Selecting a real shadow from a blur must restore a non-transparent default shadow colour rather than retaining the blur's transparent colour; preserve existing shadow colour when changing between real shadow types.
8. Add `App/tests/engine/vue/controls/effects.test.ts` around the exported pure helpers. Prove option order, inner-glow classification, canonical selection output, real type output, blur-to-shadow non-transparent colour, shadow-to-blur zero offset/spread, and no mutation of the input effect.
9. In `App/src/components/properties/EffectsSection.vue`, bind the selector to `effectsCtx.effectControlType(effect)` and pass the UI-only control type to the updated action. Keep radius/spread/colour/opacity controls driven by the stored `INNER_SHADOW`, so inner glow exposes the existing full shadow editor.
10. In each effect row's `PropertyItemRow` rail, add Lucide chevron-up and chevron-down `IconButton` controls wrapped by the existing accessible pattern. Use `panels.moveEffectUp` and `panels.moveEffectDown`; disable the first Up and last Down; call `actions.reorder(index, index - 1)` or `actions.reorder(index, index + 1)` once. Keep visibility and remove actions intact.
11. Add the three fixed English keys to `App/packages/vue/src/i18n/messages/panels.ts` and the exact translations to all eight existing locale `panels.json` dictionaries. Do not rename existing effect keys.
12. In `App/packages/core/src/tools/modify/effects.ts`, add input-only `INNER_GLOW` to the tool enum and description. When chosen, call the canonical factory and append that ordinary `INNER_SHADOW`; for all existing types preserve current behavior. Do not cast `INNER_GLOW` to `Effect['type']`.
13. In `App/packages/core/src/tools/describe/summaries.ts`, use the canonical predicate before the generic inner-shadow branch so zero-offset inner shadows are summarised as `inner glow`. Extend `App/tests/engine/tools/modify.test.ts` to prove the tool stores the exact canonical record, reports one added effect, and description output calls it inner glow.
14. Add `App/tests/e2e/properties/effects-controls.spec.ts` using `useEditorSetup`, `propertySection`, `propertyItems`, and `getSelectedNode`. Draw one rectangle, add an effect, select Inner glow, and assert the stored record is `INNER_SHADOW` with canonical values while the selector shows Inner glow.
15. In that E2E file, expand the row and edit radius, spread, colour, and opacity through role/name or existing `data-property` locators; assert the stored values change and one undo restores the last committed change. Change X from zero to one and assert the displayed choice becomes Inner shadow; undo and assert it returns to Inner glow.
16. Add Background blur and Inner shadow records through the same selector and assert each type/radius is stored. Toggle each effect off/on and prove `visible` changes; remove one and undo it. Do not inspect private component state.
17. Use the new Up/Down buttons on a three-effect list. Assert the exact array type/order changes, the boundary buttons are disabled, and one undo restores the previous order. This is the observable pass/fail proof for reorder rather than a source-only assertion.
18. Add `App/tests/engine/io/fig/roundtrip/effects.test.ts` following the existing round-trip helper. Create one node with ordered canonical inner glow, background blur, and non-zero-offset inner shadow; export `.fig`, reimport, find the node by name, and assert type, order, colour/alpha, offset, radius, spread, visibility, and blend mode. Assert no serialised effect type equals `INNER_GLOW`.
19. Add `App/tests/engine/render/canvas/effects/background-blur-clipping.test.ts` before changing renderer code. Prove `applyClippedBlur()` clips before creating the backdrop-filter layer, uses the effect owner's node/rect/radius inputs, and balances every canvas save/restore even when clipping or layer creation throws.
20. In the same focused file, test the current `clipNodeShape()` dispatch. Require `clipRect` for an ordinary zero-radius rectangle, `clipRRect` for rounded/independent-corner rectangles, and `clipPath` for smooth corners, ellipses, polygons, stars, and closed vectors. For the non-rectangular cases, explicitly require `clipRect` not to be called.
21. If the new tests reproduce the verified polygon/star/vector rectangular fallback, change only `App/packages/core/src/canvas/shapes.ts`: route `POLYGON`, `STAR`, and `VECTOR` through the existing `makeNodeShapePath()`, intersect the canvas with that path, and delete the temporary path in a `finally` block. Preserve the current ellipse, smooth-corner, rounded-corner, and ordinary-rectangle branches. Do not create duplicate geometry builders.
22. Extend `App/tests/engine/render/canvas/raster-export.test.ts` with deterministic shape-clipping proofs. Render a high-contrast backdrop behind translucent owners with `BACKGROUND_BLUR`; compare each export with its no-blur control. Require changed pixels well inside the rectangle/ellipse/star/closed-vector silhouette and byte-identical or tolerance-equal pixels immediately outside rounded corners, ellipse corners, star concavities, and closed-vector edges. Also require non-null PNG bytes and unchanged export dimensions.
23. Add a canonical inner-glow raster case using a filled rounded rectangle and the factory. Assert the decoded edge/interior pixels differ from the same rectangle without the effect, proving the ordinary inner-shadow renderer creates visible inner glow in exported PNG.
24. Extend `App/tests/engine/io/svg/export/render.test.ts` only with the canonical zero-spread inner-glow record. Require the existing inner-shadow filter primitives and fixed white flood colour/opacity; do not add or assert SVG background-blur support. PDF uses this SVG route and is covered only for this zero-spread preset representation.
25. Add visual cases to `App/tests/e2e/properties/effects.spec.ts`: background blur on a rounded translucent frame, ellipse, star, and closed vector over a high-contrast backdrop, plus a dark rounded rectangle with the canonical inner glow. Clear selection, wait for two stable renders where the existing suite does so, and commit only those Windows snapshot baselines. Each background-blur scene must leave enough contrasting backdrop visible outside the silhouette for leakage to be inspectable.
26. Update `App/packages/docs/user-guide/drawing-shapes.md`: state that Background blur is clipped to the owning closed shape and never its non-rectangular bounding box; list Inner glow as a preset represented by a zero-offset inner shadow; state that changing its offset makes it Inner shadow; retain the existing background/layer blur distinction. Do not claim a new file-format type or SVG/PDF background-blur support.
27. Add one concise `Unreleased` entry to `App/CHANGELOG.md` covering shape-clipped background blur, the inner-glow preset, requested-effect reorder controls, and focused background-blur/inner-shadow verification.
28. Format only the touched application/test files. Run the focused unit, i18n, control E2E, targeted snapshot update, snapshot rerun, and full requested-effects visual suite listed below. Fix only failures caused by this packet; stop on unrelated or structural failures.
29. Run `bun run check`. If it passes, compute the next minor version from the verified predecessor installed version (`0.m.p` becomes `0.(m+1).0`) and synchronise exactly the three app-version files. Do not change workspace-package versions.
30. Re-run the focused unit/E2E checks after the version edit, then record `$buildStart` and build one x64 MSVC NSIS installer. Resolve exactly one fresh installer after `$buildStart`, hash it twice, and require equality before installing.
31. Silently install with uppercase `/S`. Resolve the installed executable path from T-002 evidence (expected `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe` only if still verified), read `VersionInfo` and SHA-256, launch that exact path, and require the new version, OpenPotlood identity/title, non-zero window handle, and `Responding=True` twice.
32. In the installed app, place a high-contrast backdrop behind a translucent rounded rectangle, ellipse, star, and closed vector. Apply Background blur and adjust radius on each; confirm the backdrop changes only inside each actual silhouette and remains sharp in rounded/ellipse corners, star concavities, vector cut-outs, and all other areas inside the bounding box but outside the shape. Add Inner glow to a dark shape, edit colour/opacity/radius/spread, then change X to confirm it becomes Inner shadow. Reorder, toggle, remove, undo, and redo effects; confirm the canvas updates after each action.
33. Save the installed test document as `.fig` to a newly created task-specific temporary folder, close/reopen it through OpenPotlood, and confirm the three ordered effect records, shape-clipped background blur, and Inner glow label persist. Export PNG and JPEG and inspect both for identical silhouette clipping and glow pixels. Do not use SVG/PDF as background-blur acceptance in this task.
34. Close the installed app, relaunch the exact installed executable, reopen the saved file, repeat the visible effect/order/clipping check, and record final executable path, process ID, version, hashes, title, handle, responsiveness, `.fig` path/hash, raster export paths/hashes, and observations.
35. Run the pipeline validator, append the T-006 execution receipt, and leave packet/task advancement to the audit role. Do not mark this packet `VERIFIED` or the task `DONE` during execution.

## Acceptance Criteria

- [ ] The Effects selector offers Drop shadow, Inner shadow, Inner glow, Layer blur, Background blur, and Foreground blur in that order; `INNER_GLOW` never appears in stored scene or `.fig` data.
- [ ] Selecting Inner glow stores the exact canonical zero-offset `INNER_SHADOW`; colour, opacity, radius, spread, visibility, remove, undo, and redo remain editable through the existing controls.
- [ ] A zero-offset inner shadow displays as Inner glow after `.fig` reopen; changing either offset away from zero displays Inner shadow; undo restores the Inner glow label and values.
- [ ] Background blur remains a backdrop filter rather than layer-content blur and is clipped to the exact closed silhouette of ordinary/rounded/smoothed rectangles, ellipses, polygons, stars, and closed vectors.
- [ ] Pixels inside each tested silhouette visibly differ from the no-blur control, while pixels inside the node bounds but outside rounded corners, ellipse corners, star concavities, and closed-vector edges remain sharp and match the no-blur control within the fixed test tolerance.
- [ ] Inner shadow retains its existing shape/text rendering; all focused renderer tests pass; any background-blur renderer change is confined to the authorised `canvas/effects.ts` / `canvas/shapes.ts` clipping seam.
- [ ] Every effect row has observable Move up/Move down controls; boundary controls are disabled; one activation changes exact effect-array order; one undo restores it.
- [ ] Toggle, remove, multi-effect order, field commits, and undo/redo produce exact stored-array changes with no mutation on focus.
- [ ] The `set_effects` tool accepts input-only `INNER_GLOW`, writes the canonical ordinary inner shadow, and effect summaries identify the canonical record as inner glow.
- [ ] `.fig` export/reimport preserves the ordered canonical glow, background blur, and inner shadow fields without inventing a type or dropping supported data.
- [ ] PNG and JPEG exports from installed OpenPotlood visibly retain background blur, inner glow, and inner shadow. SVG/PDF background blur is neither claimed nor implemented by T-006.
- [ ] Every requested Windows CanvasKit background-blur silhouette and inner-glow snapshot matches after targeted generation and rerun; the existing effect visual suite has no regression, and no blur leakage is visible outside any owner shape.
- [ ] All three shipped app-version files contain one next-minor version based on the verified T-005 installed version; no publishable workspace-package version changes.
- [ ] One fresh x64 NSIS installer builds after the recorded start time, its pre-install hashes match, silent installation exits `0`, and the installed executable reports the expected OpenPotlood identity and new version.
- [ ] The exact installed executable launches, has the expected OpenPotlood title and non-zero handle, remains responsive across two checks, and the real-app create/edit/reorder/toggle/save/reopen/export flow passes.
- [ ] No application/resource file outside Allowed Changes changes; no Git/release/updater/publishing machinery is invoked; execution leaves advancement to audit.

## Verification

Run from `App/` unless stated otherwise:

1. `bun test ./tests/engine/scene-graph/effects.test.ts ./tests/engine/vue/controls/effects.test.ts ./tests/engine/tools/modify.test.ts ./tests/engine/editor/effects-and-resize.test.ts ./tests/engine/render/canvas/effects ./tests/engine/render/canvas/raster-export.test.ts ./tests/engine/io/fig/import/legacy/effects.test.ts ./tests/engine/io/fig/roundtrip/effects.test.ts ./tests/engine/io/svg/export/render.test.ts` — expect exit code `0`, no module-resolution errors, and all selected effect/model/tool/render/round-trip/export tests passing, including exact non-rectangular background-blur clipping and outside-silhouette pixel assertions.
2. `bun run check:i18n` — expect exit code `0` with no missing or extra panel keys across all eight locale dictionaries.
3. `bunx playwright test tests/e2e/properties/effects-controls.spec.ts --project=openpencil` — expect exit code `0` with add/edit/classify/reorder/toggle/remove/undo/redo assertions passing and no browser errors.
4. `bunx playwright test tests/e2e/properties/effects.spec.ts --project=openpencil -g "background blur|inner glow" --update-snapshots` — use only when intentionally creating the requested-effect Windows baselines; expect exactly those cases to pass and create/update only their snapshot files.
5. Re-run the same command without `--update-snapshots`; expect exit code `0` and every requested-effect image matching within configured thresholds, with no visible background-blur leakage outside any tested silhouette.
6. `bunx playwright test tests/e2e/properties/effects.spec.ts --project=openpencil` — expect exit code `0` and the complete existing plus new requested-effect visual suite passing.
7. `bun run check` — expect exit code `0`. Do not run `format:check`, because it requires Git in this intentionally non-Git project.
8. From the project root, run `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique`; expect one value equal to the next minor after the verified T-005 installed version.
9. From `App/`, record `$buildStart=(Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`; expect exit code `0`, a release executable, and one fresh OpenPotlood `*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
10. From the project root, run `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File | Where-Object {$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; $hash1=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; $hash2=(Get-FileHash $installer[0].FullName -Algorithm SHA256).Hash; if($hash1 -ne $hash2){throw 'Installer hash changed before install'}; "$($installer[0].FullName)|$hash1"`; expect one absolute installer path and one stable SHA-256.
11. Install with `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}`; expect no exception. Reuse T-002's executed exact installed-path, `VersionInfo`, executable SHA-256, exact-path launch, title/handle, and repeated `Responding=True` commands and require the T-006 version.
12. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` Record the result but do not advance T-006.

## Integration or Installed-Result Check

- Mandatory and indivisible: focused model/control/tool/render/round-trip/raster checks → i18n → control E2E → targeted and full CanvasKit visual checks → quality gate → synchronised next-minor version → one fresh x64 NSIS build → stable installer hash → silent install → installed identity/version/hash → exact-path launch → real effect editing → `.fig` save/reopen → PNG/JPEG inspection → restart/reopen → repeated responsiveness.
- Use installed OpenPotlood, not the Vite preview, old OpenPencil/OpenPencil Studio, source-only tests, or a stale installer. Record absolute artefact paths and hashes.
- The real-app scene must visibly prove: high-contrast backdrop blurred only inside the actual silhouettes of a rounded rectangle, ellipse, star, and closed vector; sharp backdrop in transparent corners/concavities/outside-vector regions within their bounds; light/coloured inner glow inside a dark shape; non-zero-offset inner shadow; effect order controls; visibility; removal; undo/redo; `.fig` reopen; PNG/JPEG output.
- SVG/PDF background blur is explicitly not an installed-result acceptance item for T-006. If the user requires it before T-008, stop for a route/scope decision.

## Stop Conditions

- T-005 is not `VERIFIED`, T-006 is not `READY`, another task is `IN PROGRESS`, predecessor reports are missing, or the three starting version files disagree.
- `App/node_modules` remains absent/unusable after the predecessor-authorised setup route, workspace imports do not resolve, or the focused baseline suite still fails before T-006 changes.
- Any verified path/interface above moved, or a predecessor replaced the effect model, property list, renderer, `.fig` codec, tool, installed path, or build route.
- New evidence proves inner glow needs semantics distinct from a zero-offset inner shadow, or the user requires a persistent distinction after offsets change. That requires a product/file-format decision and packet audit.
- Implementing the requested UI would require adding `INNER_GLOW` to stored data, a custom shader, destructive rasterisation, plugin metadata, or a new dependency.
- An imported node contains unsupported raw Figma effects and the requested edit would overwrite, flatten, reorder incorrectly, or discard them. Do not invent a merge algorithm.
- Background blur or inner shadow fails existing renderer tests and the fix exceeds the authorised `effects.ts` / `shapes.ts` clipping seam or requires changing `shadows.ts`, `scene.ts`, `.fig` import/export, effect overflow, or unsupported-effect policy. Return for packet audit with the exact failing case.
- A tested polygon, star, or vector has no closed fill path that can define the blur silhouette, or fixing it would require inventing open-line, text-glyph, stroke-outline, mask, or Boolean-operation semantics. Record the exact node fixture and stop for audit.
- Correct SVG/PDF background blur, non-zero inner-shadow spread fidelity in vector export, or a new export warning/diagnostic surface becomes required. Those are T-008 scope decisions.
- Snapshot generation changes existing unrelated baselines, the full visual suite regresses, or the new Windows results cannot be inspected.
- Any focused test, i18n check, `bun run check`, Tauri build, installer selection/hash, install, identity/version check, launch, `.fig` reopen, raster export, title/handle, or responsiveness check fails.
- The fresh installer count is not exactly one, the installed executable path differs from executed T-002 evidence without explanation, or a stale running process/installer could contaminate proof.
- Completion would require editing outside Allowed Changes, changing the route/dependency, invoking Git/release/updater machinery, or making an unapproved scope decision.

## Execution Report Contract

- Report result, predecessor version and T-006 version, files changed, starting/final hashes, commands and actual outputs, test counts, snapshot files inspected, `.fig`/PNG/JPEG paths and hashes, installer/executable paths and hashes, installed `VersionInfo`, process ID/title/handle/responsiveness, real-app observations, deviations, and mess or concerns.
- State explicitly that inner glow is stored/exported as zero-offset `INNER_SHADOW`, SVG/PDF background blur remains deferred to T-008, application code changed during execution, and packet/task advancement was left to audit.

## Status record

Status: **Done**
