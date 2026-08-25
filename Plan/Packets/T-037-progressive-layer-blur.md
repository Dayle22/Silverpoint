# T-037 - Add a progressive option to the layer blur effect

Task ID: T-037
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-006
Prepared against: live effect model, CanvasKit layer-blur path, SVG/PDF export adapters, Effects panel, and canvas input seams on 2026-08-14
Last expanded: 2026-08-14

## Closure Decision

This packet is retrospective. On 2026-08-14 the user supplied a reference screenshot of a `Uniform | Progressive` blur control with `Start`/`End` fields and asked for the same on the layer blur effect, then chose to implement directly rather than plan first, at full scope including export parity. The packet records what shipped so `Plan/plan.md` has a real target.

T-037 was marked `DONE / VERIFIED` on 2026-08-14 by the user's explicit direction. Closure rests on: source gates (`tsgo`, both `vue-tsc` projects, the full `lint` gate, `check:i18n`), 120/120 focused Bun tests including pixel proof of the ramp direction and of the removed silhouette artifact, the user observing the ramp working in the dev build ("seems to be working fine"), and a fresh `0.6.29` NSIS build/install with registry version delta, executable identity, and a responsive launch.

The user accepted closure without exercising the ramp, handle dragging, or export inside the installed app, and without `bun run check` or a Playwright run. Those checks remain unperformed and are not represented as passing evidence. The `0.6.29` bundle also carries a concurrent session's in-flight changes, so it is not solely this packet's work.

## Request Coverage

- Add a progressive (ramped) mode to the layer blur effect alongside the existing uniform radius.
- Expose `Uniform`/`Progressive` selection with separate start and end radii.
- Let the ramp direction be set on canvas with a two-handle gradient line.
- Keep SVG and PDF export faithful to what the canvas renders.

## User-Visible Outcome

A layer blur can ramp across a layer instead of blurring it evenly: sharp at the start handle, growing to the full radius at the end handle, with the direction dragged on canvas and both radii typed in the Effects panel. Exports match.

## Verified Starting State

- `Effect` was a flat optional-field interface; blurs carried a single `radius`.
- `renderNode` applied the first visible `LAYER_BLUR`/`FOREGROUND_BLUR` as one `MakeBlur` image filter on a padded `saveLayer`; `BACKGROUND_BLUR` used the separate `applyClippedBlur` backdrop path.
- The SVG exporter folded every visible effect into one `<filter>`; PDF went through that SVG unless a subtree needed a raster fallback (background blur, masks, adjustments).
- The Effects panel expanded rows inline; no effect had an on-canvas control. Corner radius was the existing precedent for a node-local drag handle.

## Fixed Decisions

- Field names mirror Figma's `BlurEffectProgressive`: `blurType`, `startRadius`, `startOffset`, `endOffset`, with `radius` as the end radius and offsets in normalised object space. This keeps `.fig` interchange legible and avoids inventing a parallel vocabulary.
- Progressive applies to `LAYER_BLUR` and `FOREGROUND_BLUR` only. `BACKGROUND_BLUR` blurs the backdrop through a clip and has no ramp implementation, so it must not offer the control.
- Band maths lives once in `packages/scene-graph/src/progressive-blur.ts`; the CanvasKit renderer and the SVG exporter both consume it so they cannot drift.
- Each band owns a slice of the ramp, fades in over the slice before it, and retires over the slice after it. Bands must not stack over a full-opacity sharp copy: that leaves the node's hard silhouette visible through the softer halo above it.
- A ramp with no direction (collapsed axis) or no radius difference degrades to a uniform end-radius blur rather than erroring or disappearing.
- Ramp offsets are deliberately unclamped, so a ramp may start or end outside the node.
- Toggling back to uniform keeps the ramp fields, so the previous ramp returns on re-enable.

## Read First

`App/AGENTS.md`, `Plan/plan.md`, `T-006`, `packages/scene-graph/src/progressive-blur.ts`, `packages/core/src/canvas/effects.ts`, `packages/core/src/canvas/scene.ts`, `packages/core/src/io/formats/svg/defs.ts`, `packages/vue/src/shared/input/radius.ts` (handle precedent).

## Allowed Changes

Effect model and shared band maths, the layer-blur render path and its cached filters, the SVG band stack and PDF fallback predicate, the Effects panel controls with all eight locales, editor overlay state plus the canvas handle overlay and its drag input, and focused tests.

## Restrictions and Exclusions

No background-blur ramp, no change to the uniform blur's existing appearance, no popover redesign of the Effects panel, no document schema version bump, and no desktop delivery.

## Implementation Steps

1. Extend `Effect` with `blurType`/`startRadius`/`startOffset`/`endOffset`; widen `effectOverflow` to the larger of the two radii.
2. Add `progressive-blur.ts`: band resolution, mask stops, ramp axis, gradient mapping, degeneracy guard, and the uniform/progressive patches.
3. Compose the banded image filter in `getCachedProgressiveBlur`, cached by radii and axis, and use it from the layer-blur seam.
4. Add the `Uniform`/`Progressive` segmented control and `Start`/`End` fields, with `blurType`/`blurUniform`/`blurProgressive`/`blurStart`/`blurEnd` in every locale.
5. Add `progressiveBlurEdit` editor state driven by the expanded effect row, draw the gradient line and its two handles, and wire the drag ahead of the corner-radius handles.
6. Emit the band stack as masked `<use>` copies in SVG; route progressive subtrees to the PDF raster fallback.

## Acceptance Criteria

- [x] A layer blur can be switched between uniform and progressive without losing its radius.
- [x] The ramp renders sharp at the start handle and at full radius past the end handle.
- [x] No sharper copy shows its hard edge through the blurred end of the ramp.
- [x] A collapsed ramp axis or equal radii renders as a uniform end-radius blur.
- [x] Dragging either canvas handle changes the ramp direction, undoes as one step, and cancels on Escape.
- [x] SVG exports the same band stack; PDF rasterizes rather than dropping the ramp.
- [x] All eight locales carry the new keys.
- [x] A fresh `0.6.29` NSIS build installs, reports the new identity, and launches responsive.
- [ ] The ramp, handle dragging, and export are exercised inside the installed app. NOT PERFORMED; the user closed the packet without it.

## Verification

Performed on 2026-08-14: `tsgo --noEmit`, `vue-tsc` on both projects, focused Oxlint on every touched file, `bun run check:i18n`, and focused Bun suites (`render/canvas/effects`, `io/svg`, `geometry/visual-bounds`, `editor/effects-and-resize`) at 120/120. New coverage: a headless pixel test proving the ramp direction, the absence of a hard silhouette in the blurred region, and the collapsed-axis fallback; SVG tests proving band and mask counts, gradient axis, and the uniform fallback. Live browser observation confirmed the panel controls and a ramped blur on canvas.

Delivery on 2026-08-14: all three version files bumped `0.6.28` → `0.6.29` together. The first `bun run tauri build` failed its type-aware lint gate on this packet's own code — `no-unnecessary-condition` on `node.effects[index]`, which this project types as always defined; both sites now use `.at()`, matching existing usage in `editor/pages.ts` and `canvas/node-edit-input/bend.ts`. The rebuild produced:

- `desktop/target/release/bundle/nsis/OpenPotlood_0.6.29_x64-setup.exe`, 38,621,698 bytes, sha256 `2EA016A4…9C68DD40`
- installed silently with `/S`, exit code `0`
- registry `DisplayName OpenPotlood`, `DisplayVersion 0.6.29` (was `0.6.28`), `InstallLocation C:\Users\User\AppData\Local\OpenPotlood`
- installed `OpenPotlood.exe`: file and product version `0.6.29`, 25,869,312 bytes, sha256 `108F0223B55A469B3E755000E87578CD7BAD88B81E1038AFD565A2AAC1129E25`
- launched: `Responding = True`, window title `OpenPotlood 0.6.29`, ~60 MB working set

The installed executable's hash differs from the on-disk `target/release/OpenPotlood.exe` (`0A7205C7…E6E82FD0`) at identical size, because Tauri patches the binary with bundle-type information per bundle after packaging. Identity therefore rests on version, size, build-window timestamp, registry version delta, and window title. The installed hash above is the reference for future comparison.

Not performed: `bun run check`, `bun run test`, Playwright.

Delivery caveat: this workspace has no VCS and a second session was editing concurrently, so the `0.6.29` bundle also contains that session's in-flight changes to `packages/vue/src/primitives/BindableValue/BindableValueRoot.vue` and `tests/e2e/color-picker/basic.spec.ts`. The installer is not solely T-037.

Pre-existing and unrelated: a wider run over `render/canvas`, `io`, `geometry`, and `editor` shows 17 failures from stale test mocks (missing `canvas.getSaveCount`, `r.adjustmentLayerPaint`) and heavy `.fig` fixtures, on code this packet did not touch.

## Integration or Installed-Result Check

Partly performed. Installed `0.6.29` proves identity (registry version delta, executable version/size/hash, window title) and a responsive launch. The ramp, handle dragging, and export parity were proven in the dev build and by unit tests, not yet exercised by the user inside the installed app; that confirmation is what remains before this packet can read `VERIFIED`.

## Stop Conditions

Stop if a ramp cannot be expressed without duplicating band maths per renderer, if the canvas and SVG stacks visibly diverge, if the handle drag conflicts with corner-radius or resize handles, or if progressive blur is asked to cover `BACKGROUND_BLUR`.

## Execution Report Contract

Record the field names and their Figma mapping, band count and mask stop shape, the render and export seams changed, locale keys added, pixel evidence for the ramp and for the absence of the silhouette artifact, test counts and exits, and every check left unperformed.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-14: source gates `tsgo`, both `vue-tsc` projects, the full `lint` gate and `check:i18n` green, 120/120 focused Bun tests including new pixel proof of the ramp and of the removed silhouette artifact; user confirmed it working in the browser. Built and installed 0.6.29 via NSIS; registry version delta 0.6.28→0.6.29, installed executable version/size/hash recorded, responsive launch with window title `OpenPotlood 0.6.29`. Closed on the user's direction without exercising the feature inside the installed app and without `bun run check` or Playwright; the bundle also carries a concurrent session's in-flight `BindableValueRoot.vue` and color-picker e2e changes)
