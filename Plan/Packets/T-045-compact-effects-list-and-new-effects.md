# T-045 - Compact effects list and a procedural noise effect

Task ID: T-045
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-006
Related: T-051 (reorder interaction — excluded here), T-052 (add-effect picker flow — excluded here), T-037 (progressive layer blur — model this packet must not contradict)
Prepared from: the 2026-08-14 user request batch and user-supplied screenshots of the target effect menu (`Inner shadow, Drop shadow, Layer blur, Background blur, Noise, Texture, Glass`, one variant also showing `Shader (Beta)`) and of the current panel's truncated `Dr...` type label
Expanded at: 2026-08-15
Expanded against: `App/src/components/properties/EffectsSection.vue`, `App/src/components/properties/item-list/PropertyItemRow.vue`, `App/src/components/ui/panel/{PanelItemRow,PanelSection}.vue` and their `App/src/theme/panel/{item-row,section,field}.ts` recipes, `App/packages/vue/src/controls/effects/{use,helpers}.ts`, `App/packages/scene-graph/src/{types,node-defaults,progressive-blur}.ts`, `App/packages/core/src/canvas/{effects,adjustments,scene,shadows,fills}.ts`, `App/packages/core/src/io/formats/svg/defs.ts`, `App/packages/core/src/io/formats/raster/render.ts`, `App/packages/core/src/io/formats/pdf/export.ts`, `App/packages/core/src/kiwi/fig/node-change/export-node.ts`, `App/packages/kiwi/src/fig/codec.ts`, `App/packages/vue/src/i18n/messages/panels.ts` and the 8 locale files under `App/packages/vue/src/i18n/locales/*/panels.json`, `App/tests/e2e/design/panel.spec.ts`, `App/tests/e2e/properties/effects.spec.ts`
Delivery: source gates only

## Intended Outcome

Two independent, additive changes to the Effects section of the properties panel:

1. Each applied effect's own markup is visually tighter — the expanded settings block below a row uses less vertical space, and the row's own icon controls are visually consistent — without touching the shared list-row component, the rail buttons, or the add-effect flow (those belong to T-051 and T-052).
2. A new, genuinely deliverable effect type, **Noise**, is added to the effect type list and renders a procedural grain overlay in the CanvasKit renderer and in SVG/PDF export, with a defined and correct `.fig` round-trip answer (excluded from native Figma effect serialisation, same treatment as the existing adjustment effect types).

**Glass** and **Texture** are explicitly cut from this packet and deferred — see Restrictions and Exclusions. **Shader (Beta)** is explicitly out of scope.

## Request Coverage

- Make the effects list in the properties panel more compact.
- Add noise, texture and a proper glass effect to the available effect types.

(Verbatim from the stub. This packet delivers the first bullet in full and the second bullet for Noise only, with Texture and Glass cut to a later packet — see Corrections to the Brief.)

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/components/properties/EffectsSection.vue` | The effects row template. Uses `PropertyItemRow` (rail slot carries the move-up/move-down `IconButton`s — **T-051's territory, not touched here**), an expand/swatch `<button class="flex size-5 shrink-0 ... rounded border border-border bg-input p-0">` (line 77), an `AppSelect` for the type (`class="min-w-0 flex-1"`, line 90), and an expanded settings block `<div v-if="expanded" class="ml-[26px] flex flex-col gap-1.5 py-1.5" data-slot="effect-settings">` (line 119-123). |
| `App/src/components/properties/item-list/PropertyItemRow.vue` | The **shared** row shell used identically by `FillSection.vue`, `StrokeSection.vue` and `EffectsSection.vue` (confirmed by reading all three — each imports the same `@/components/properties/item-list/PropertyItemRow.vue`). It renders eye (`PropertyListVisibility`) and remove (`PropertyListRemove`) buttons styled `flex size-control shrink-0 ... rounded-icon ...`. **Out of scope: any edit here ripples to fills and strokes.** |
| `App/src/theme/panel/item-row.ts` | `root: 'group flex min-h-control items-center gap-panel py-0.5'`, `remove: '... opacity-0 group-hover:opacity-100 ...'`. The remove button already only reveals on row hover; the eye button does not. Confirmed by `App/tests/e2e/design/panel.spec.ts:151-166` (`'effect settings expand semantically and row remove reveals on hover'`), which asserts `remove` has `opacity: 0` off-hover and `opacity: 1` on hover. |
| `App/src/theme/panel/field.ts` | `panelFieldBase` includes `h-control` (24px, via `--spacing-control: 24px` in `App/src/app.css:32`). `AppSelect`'s trigger uses this base (`App/src/theme/select.ts` → `App/src/theme/app/select.ts`), so **the row's height is already fixed at 24px by the type select itself** — shrinking the swatch/expand button below its current `size-5` (20px) cannot reduce row height further; only removing controls (T-051) recovers width. |
| `App/packages/vue/src/controls/effects/helpers.ts` | `EFFECT_LABELS`, `EFFECT_TYPES`, `EFFECT_OPTIONS` (the flat type list — currently `DROP_SHADOW, INNER_SHADOW, INNER_GLOW, LAYER_BLUR, BACKGROUND_BLUR, FOREGROUND_BLUR, BRIGHTNESS_CONTRAST, SATURATION, CURVES`), `createDefaultEffect()`, `updateType()`. This is where a new `NOISE` control type and its label/factory dispatch belong. |
| `App/packages/scene-graph/src/types.ts:180-209` | `Effect.type` union: `'DROP_SHADOW' \| 'INNER_SHADOW' \| 'LAYER_BLUR' \| 'BACKGROUND_BLUR' \| 'FOREGROUND_BLUR' \| 'BRIGHTNESS_CONTRAST' \| 'SATURATION' \| 'CURVES'`. `BlurType`, `startRadius`, `startOffset`, `endOffset` were added here by T-037 (Done) — this packet adds `'NOISE'` to the union and does not touch the blur-ramp fields. |
| `App/packages/scene-graph/src/node-defaults.ts:4-26` | `createInnerGlowEffect`, `isInnerGlowEffect`, `isAdjustmentEffect` (`BRIGHTNESS_CONTRAST \| SATURATION \| CURVES`), `createBrightnessContrastEffect`, `createSaturationEffect`, `createCurvesEffect`. The precedent shape for a new `createNoiseEffect()` factory. |
| `App/packages/scene-graph/src/progressive-blur.ts:70-77` | `supportsProgressiveBlur` — comment confirms `BACKGROUND_BLUR` deliberately has no ramp ("it blurs the backdrop through a clip rather than the node's own layer"). Re-verified unchanged; this packet does not touch it. |
| `App/packages/core/src/canvas/adjustments.ts` | The live precedent for a `RuntimeEffect`/SkSL shader effect: `prepareAdjustmentLayer` compiles SkSL once per parameter-key, caches in a `Map` on `SkiaRenderer` capped at `MAX_PROGRAMS = 32` with oldest-inserted eviction and `.delete()`, and applies via `canvas.saveLayer(paint, bounds)` with a `Blender`. This is the shape Noise's renderer implementation must copy. |
| `App/packages/core/src/canvas/effects.ts` | `getCachedDropShadow/Blur/DecalBlur/ProgressiveBlur/MaskBlur` — all keyed `ImageFilter`/`MaskFilter` caches on `SkiaRenderer.imageFilterCache`/`maskFilterCache`. No noise/texture/glass renderer exists today. |
| `App/packages/core/src/canvas/scene.ts:263-284` | `renderNode` already opens an adjustment layer (`prepareAdjustmentLayer`) whenever `hasVisibleAdjustments(node.effects)` is true, wrapping the whole node's content. A Noise overlay effect is the same shape of problem (a full-node layer effect) and should be driven from the same call site, not from `renderShape`. |
| `App/packages/core/src/canvas/fills.ts:94-98` | **Correction to assumption:** the scene-graph already has a `Fill.type === 'NOISE'` (a noise *fill*, with `noiseType`, `density`, `noiseSize` fields on `Fill`). It is **not implemented** — `applyFill` falls through to a flat solid-colour paint for `'PATTERN' \| 'NOISE' \| 'CUSTOM'` fills (line 94-98), so today a "noise fill" renders as a solid colour. This packet adds a **Noise effect** (a new `Effect.type` member), which is a different model object from the existing unimplemented `Fill.type === 'NOISE'`; the two must not be confused or merged. Fixing the noise *fill* is out of scope. |
| `App/packages/core/src/io/formats/svg/defs.ts:256-335` | `createFilterDef` builds one `<filter>` per node from its visible effects. Confirmed **landmine**: the final `else` branch (line 323-326) is a silent catch-all — any `effect.type` not explicitly matched (`DROP_SHADOW`, `INNER_SHADOW`, `BRIGHTNESS_CONTRAST`, `SATURATION`, `CURVES`) falls through to `feGaussianBlur` using `effect.radius`. Without an explicit branch, a Noise effect would silently render as a wrong blur in SVG export instead of noise. |
| `App/packages/core/src/io/formats/pdf/export.ts:18-31` | PDF export renders through the SVG path (`renderNodesToSVG` + `svg2pdf.js`) unless `nodeNeedsBackgroundBlur`/`nodeNeedsMaskFallback`/`nodeNeedsAdjustmentFallback`/`nodeNeedsProgressiveBlurFallback` (`App/packages/core/src/io/formats/raster/render.ts`) trigger a raster fallback. A Noise effect inherits the SVG landmine above unless it is either (a) given a correct SVG filter primitive, or (b) added to the raster-fallback predicate list so PDF/SVG rasterise the node instead of emitting wrong markup. |
| `App/packages/core/src/kiwi/fig/node-change/export-node.ts:569-642` | **Decisive `.fig` evidence.** `SUPPORTED_NORMALIZED_EFFECT_TYPES` is a fixed set of the 5 real Figma effect types. `applyNodeVisualProps` (line 627-642) only serialises `nc.effects` when `!hasRawUnsupportedEffects(node)`, and even then filters `node.effects` through `!isAdjustmentEffect(effect)` before mapping each survivor's `type` through a cast to `Exclude<Effect['type'], 'BRIGHTNESS_CONTRAST' \| 'SATURATION' \| 'CURVES'>`. |
| `App/packages/kiwi/src/fig/codec.ts:235-244` | **The decisive constraint.** The generated kiwi `.fig` codec's `Effect.type` is a closed union: `'DROP_SHADOW' \| 'INNER_SHADOW' \| 'LAYER_BLUR' \| 'BACKGROUND_BLUR' \| 'FOREGROUND_BLUR'`. This is Figma's own binary schema, not something this codebase controls or can extend. **Any effect type this app invents beyond those five cannot be written into a native `.fig` `Effect` record — ever.** This settles T-045's round-trip question for every new effect type this packet or a future one adds: the answer is always "excluded from native serialisation," never "extend the enum." |
| `App/packages/vue/src/i18n/messages/panels.ts:104-117` | The English message defaults for `dropShadow`, `innerShadow`, `innerGlow`, `layerBlur`, `backgroundBlur`, `foregroundBlur`, `blurType`, etc. `App/packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/panels.json` are the 8 translated locale files (`Plan/Packets/T-054-single-locale-reduction.md` would drop these to English-only but is still only Prepared, not Done — see Open Decisions). |
| `App/tests/e2e/design/panel.spec.ts:168-187` | `'paint effect and export rows share compact visual anatomy'` — a full-panel screenshot (`design-panel-paint-effects-export.png`) asserting fill/effect/export row visual anatomy match. Any row-density change in this packet **will** change this snapshot; it must be re-captured, not left stale. |
| `App/tests/e2e/properties/effects.spec.ts` | Programmatic (store-driven) render regression tests for `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, blend modes and masks. None of these go through the panel UI, so they are unaffected by the compactness change; a new `'noise effect renders grain'` test belongs alongside them. |

## Corrections to the Brief

- The stub's "Likely Areas" name `App/packages/core/src/canvas/effects.ts` for render implementations and "Scene-graph effect types and `.fig` serialisation" generically — both confirmed correct, but the stub did not anticipate that the `.fig` constraint is a **closed enum in a separately-generated codec package** (`App/packages/kiwi/src/fig/codec.ts`), not something adjustable in this app's own scene-graph or kiwi-export code. This is the strongest possible form of "not representable" and is why every new effect type this packet (or a follow-on) adds must route through the existing adjustment-style exclusion, never attempt enum extension.
- The stub's "User-Visible Outcome" describes all three new types (noise, texture, glass) shipping together. Per Scope discipline in the expansion brief, this packet cuts to a single deliverable slice — Noise — and defers Texture and Glass explicitly below, because both require capabilities this codebase does not have today (see Restrictions and Exclusions).
- The stub does not mention that `EffectsSection.vue`'s row already mixes two different icon-button sizing conventions (`size-5`/`rounded` for the expand-swatch button vs. `size-control`/`rounded-icon` for eye/remove from the shared row). That inconsistency, not row *height* (which the `AppSelect` already fixes at 24px via `h-control`), is the concrete, fixable "compactness" defect available to this packet alone; the horizontal truncation the stub's screenshot shows is only fully resolved once T-051 removes the move-up/move-down buttons.

## Fixed Decisions

1. **Compactness scope is the expand-swatch button's sizing and the expanded-settings block's spacing — nothing in the shared row component, and nothing in the rail.** `PropertyItemRow.vue` (shared with fills/strokes) and the move-up/move-down `IconButton`s in the `#rail` slot are untouched by this packet. Reason: touching the shared component changes fills/strokes too (unwanted, unscoped); touching the rail arrows is T-051's explicit job.
2. **The expand/swatch button (`EffectsSection.vue` line 77) moves from `size-5 ... rounded border border-border bg-input` to `flex size-control shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-icon border border-border bg-input p-0`**, matching the `size-control`/`rounded-icon` tokens the eye/remove buttons in the same row already use. This does not change row height (already 24px, fixed by `AppSelect`) — it removes the one remaining visual-rhythm mismatch inside the row that this packet is permitted to touch.
3. **The expanded settings block (`EffectsSection.vue` line 119-123) tightens from `gap-1.5 py-1.5` to `gap-1 py-1`, and its left indent moves from the literal `ml-[26px]` to `ml-6`** (Tailwind's `ml-6` = 24px = `--spacing-control`, matching the swatch width exactly instead of an unexplained magic number). This is a real, bounded vertical-density win: with several effects expanded at once (a stack of shadows plus a blur, say), the saved `0.5` unit (2px) per gap and per `py` edge compounds visibly. No change to the inner field rows (`NumberField`, `ColorInput`, `SegmentedControl`) — their own spacing is untouched.
4. **Noise is added as a new `Effect.type` member: `'NOISE'`.** It is a full-node overlay effect (procedural grain, tinted by the effect's existing `color` field, strength driven by `color.a` and a new `radius`-repurposed-as-`density` reading — see decision 6), not a fill. It does not reuse or modify the existing (unimplemented) `Fill.type === 'NOISE'`.
5. **`.fig` round-trip: Noise is excluded from native effect serialisation, using the same mechanism as the adjustment effects.** In `export-node.ts`, the `!isAdjustmentEffect(effect)` filter that builds `nativeEffects` becomes `!isAdjustmentEffect(effect) && effect.type !== 'NOISE'` (or, better, a new shared predicate `isFigmaNativeEffect(effect)` in `packages/scene-graph/src/node-defaults.ts` returning `!isAdjustmentEffect(effect) && effect.type !== 'NOISE'`, used both here and by any future Glass/Texture exclusion so the list has one place to grow). A node with only a Noise effect (or a Noise effect mixed with native ones) still exports its native effects; the Noise effect itself is silently dropped from the `.fig` record, exactly as `BRIGHTNESS_CONTRAST` is today. This is a real, permanent lossy-export behaviour, not a bug — document it as such in the packet's Acceptance Criteria, not as a TODO.
6. **Noise parameters reuse existing `Effect` fields rather than adding new ones.** `color` (existing) supplies the grain tint and, via `color.a`, its strength; `radius` (existing, already present on every `Effect`) is repurposed as a grain-scale/density control (larger radius = coarser grain), following the same reuse pattern `BRIGHTNESS_CONTRAST` already uses `color` as an unused placeholder field. No new fields are added to `Effect` for this packet. `offset` and `spread` are ignored for `NOISE` (same treatment `BRIGHTNESS_CONTRAST`/`SATURATION`/`CURVES` already get from the panel template's `isAdjustmentEffect` branch — Noise gets its own template branch, not that one, since it is not an adjustment).
7. **Renderer implementation copies `adjustments.ts`'s cache shape exactly, in a new sibling file `App/packages/core/src/canvas/noise.ts`.** A `noiseRuntimeEffects: Map<string, RuntimeEffect>` field on `SkiaRenderer` (declared beside `adjustmentRuntimeEffects`), one SkSL program (a standard hash-based procedural noise, no external texture), capacity-bounded the same way (`MAX_PROGRAMS = 32`, oldest-inserted eviction, `.delete()` on eviction and on `destroyRenderer`). `prepareNoiseLayer(renderer, canvas, bounds, effects)` returns the same `(() => void) | null` cleanup shape as `prepareAdjustmentLayer`, called from `renderNode` in `scene.ts` alongside the existing `hasVisibleAdjustments` branch (a sibling `hasVisibleNoise(node.effects)` check, not folded into the adjustment branch — Noise is not an adjustment and must stay excluded from `isAdjustmentEffect`).
8. **SVG export gets an explicit `NOISE` branch in `createFilterDef` using `feTurbulence` + `feColorMatrix` (tinted by `formatColor(effect.color, ...)`), not the catch-all blur fallback.** `feTurbulence` is a standard SVG filter primitive with no known unsupported-by-`svg2pdf.js` history in this codebase, but that library's exact primitive coverage cannot be confirmed by reading source alone — see Open Decisions for the fallback plan if verification during implementation shows otherwise.
9. **`Shader (Beta)` is out of scope**, per the brief's expansion question. It appears in only one of the two user-supplied screenshot variants, has no corresponding scene-graph field or Figma kiwi representation, and no renderer precedent exists for an arbitrary user-authored shader effect (as opposed to the fixed, built-in SkSL programs `adjustments.ts` already compiles). Recommendation: leave it out entirely; do not add a disabled/placeholder menu entry either, since Restrictions below forbid adding UI for capabilities that don't exist yet.

## Open Decisions

1. **Whether `svg2pdf.js` renders `feTurbulence` correctly.** This cannot be settled by reading source under `App/` — it depends on that library's internal SVG-filter coverage, not on anything this repository defines, and the brief forbids running the app or a build to check empirically. Recommendation: implement the `feTurbulence` branch per decision 8, and add `NOISE` visibility to `nodeNeedsAdjustmentFallback`-style detection (a new `nodeNeedsNoiseFallback` predicate in `App/packages/core/src/io/formats/raster/render.ts`, mirroring the existing four) **only if** implementation-time testing (a focused Playwright PDF-export spec, run per this packet's own Verification section) shows the PDF output is wrong. Default to trusting the native SVG filter path first since it is the simpler, more consistent-with-the-rest-of-the-file choice; fall back to rasterisation only on demonstrated failure.
2. **Whether to widen `PropertyItemRow.vue`'s eye-button hover-reveal treatment (already applied to `remove`) to effects specifically.** Doing so uniformly would also change fills/strokes (out of scope, shared component). A per-`propKey` variant is possible but adds a prop to a shared primitive for one section's benefit. Recommendation: do not do this in T-045 — leave the eye button always-visible everywhere, matching current behaviour, and treat any future request to change it as its own packet.

## Visual Contract — binding

Row-level changes are confined to `App/src/components/properties/EffectsSection.vue`. Copy these class strings verbatim; do not invent new ones.

| Element | Current classes (line) | New classes |
| --- | --- | --- |
| Expand/swatch button | `flex size-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border bg-input p-0` (line 77) | `flex size-control shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-icon border border-border bg-input p-0` |
| Expanded settings wrapper | `ml-[26px] flex flex-col gap-1.5 py-1.5` (line 121) | `ml-6 flex flex-col gap-1 py-1` |

No other class in `EffectsSection.vue` changes for the compactness half of this packet. The `AppSelect`, `Tip`, `IconButton` (rail), `NumberField`, `ColorInput`, `SegmentedControl` usages are untouched.

For the Noise row's own settings (when `effect.type === 'NOISE'`), add a new template branch alongside the existing `v-if="effectsCtx.isShadow(effect.type)"` / `v-else-if="effectsCtx.isAdjustmentEffect(effect)"` / `v-else` (blur) chain — a `v-else-if="effect.type === 'NOISE'"` branch, using the **same** `NumberField`/`ColorInput` components and props already used elsewhere in this file (e.g. copy the shadow branch's `<ColorInput class="min-w-0 flex-1" :color="effect.color" editable @update="effectsCtx.updateColor(...)" />` verbatim for the tint, and the blur branch's plain `<NumberField class="w-24 flex-none" icon="B" :model-value="effect.radius" :min="0" data-property="effect-radius" ...>` verbatim for the grain-scale control — do not invent a new field component).

`data-property` attributes for the new controls: `effect-noise-color` (or reuse `effect-opacity`'s pattern if the tint alpha gets its own slider) and reuse `effect-radius` for the grain-scale field, matching the existing naming convention (`effect-offset-x`, `effect-radius`, `effect-brightness`, etc. — all `effect-<field>`).

### Banned List

- No literal colour of any kind (`bg-zinc-800`, hex, `rgb()`) anywhere in the diff — only semantic tokens (`bg-input`, `border-border`, `text-muted`, `bg-panel`), matching every existing class in this file.
- No radius outside `rounded-icon` (24px control) or the pre-existing `rounded` (4px, `AppSelect`/menu items elsewhere) — do not introduce `rounded-xl`, `rounded-full`, or a bare pixel radius.
- No font-size class other than `text-xs` or `text-[11px]`, matching `panels.mixedEffectsHelp`'s existing `text-[11px] text-muted` at line 46.
- No new `tv()` recipe. The two class-string edits above are inline Tailwind on `EffectsSection.vue`'s own template, exactly as the file already does everywhere else in it — this file has no dedicated theme recipe of its own.
- No edit to `App/src/theme/panel/item-row.ts`, `App/src/theme/panel/section.ts`, or any file under `App/src/components/properties/item-list/` — those are shared with fills and strokes.
- No new npm dependency. `RuntimeEffect`/SkSL is already used (`adjustments.ts`); `feTurbulence` is a native SVG element, not a library.
- No new global CSS, no `App/src/app.css` edit.
- No change to the rail slot's move-up/move-down buttons, their labels, or their disabled logic — T-051's territory.
- No change to how the `+` (add effect) button behaves on click — T-052's territory. `createDefaultEffect()` continues to return a `DROP_SHADOW` default; this packet only adds the `createNoiseEffect()` factory alongside it for `updateType()` to dispatch to when a row's own type `AppSelect` is changed to Noise (that per-row type-change path already exists and is unrelated to T-052's add-flow).

## Allowed Changes

- `App/src/components/properties/EffectsSection.vue` — the two class-string edits (decisions 2-3), the new Noise settings template branch, and the two new `data-property` attributes.
- `App/packages/scene-graph/src/types.ts` — add `'NOISE'` to `Effect['type']`.
- `App/packages/scene-graph/src/node-defaults.ts` — add `createNoiseEffect()`, `isNoiseEffect(effect)` (mirroring `isInnerGlowEffect`'s shape), and the shared `isFigmaNativeEffect(effect)` predicate from decision 5.
- `App/packages/vue/src/controls/effects/helpers.ts` — add `NOISE` to `EFFECT_LABELS`/`EFFECT_TYPES`/`EFFECT_OPTIONS`, re-export `createNoiseEffect`, and add the `updateType()` dispatch branch.
- `App/packages/core/src/canvas/noise.ts` (new file) — the RuntimeEffect cache and `prepareNoiseLayer`, per decision 7.
- `App/packages/core/src/canvas/renderer.ts` — add the `noiseRuntimeEffects` cache field beside `adjustmentRuntimeEffects`.
- `App/packages/core/src/canvas/scene.ts` — the `hasVisibleNoise` branch in `renderNode`, alongside the existing adjustment-layer branch.
- `App/packages/core/src/canvas/renderer/lifecycle.ts` (`destroyRenderer`) — dispose `noiseRuntimeEffects` entries, matching how `adjustmentRuntimeEffects` is already disposed (confirm the exact disposal call there before copying it).
- `App/packages/core/src/io/formats/svg/defs.ts` — the `NOISE` branch in `createFilterDef`.
- `App/packages/core/src/io/formats/raster/render.ts` — `nodeNeedsNoiseFallback`, only if Open Decision 1 resolves toward rasterisation.
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts` — swap the `!isAdjustmentEffect(effect)` filter for `isFigmaNativeEffect(effect)` and update the `Exclude<...>` cast to also exclude `'NOISE'`.
- `App/packages/vue/src/i18n/messages/panels.ts` and all 8 `App/packages/vue/src/i18n/locales/*/panels.json` — one new key, `noise` (label), following the exact pattern of `layerBlur`/`backgroundBlur`.
- `App/tests/engine/render/canvas/effects/` — a new focused test (e.g. `noise.test.ts`) asserting the grain overlay changes pixels versus a no-effect baseline and that a second render with identical parameters reuses the cached `RuntimeEffect` (assert cache size, matching `T-061`'s cache-bound test shape if that packet has landed, or a simple size assertion otherwise).
- `App/tests/e2e/properties/effects.spec.ts` — one new store-driven case, `'noise effect renders grain'`, following the file's existing pattern exactly (create a node with `effects: [{ type: 'NOISE', ... }]`, screenshot-compare).
- `App/tests/e2e/design/panel.spec.ts` — re-capture `design-panel-paint-effects-export.png` (the `'paint effect and export rows share compact visual anatomy'` test) against the new spacing; do not silently accept a diff without visually confirming it matches decisions 2-3.

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these.

- **Do not touch `App/src/components/properties/item-list/PropertyItemRow.vue`, `App/src/theme/panel/item-row.ts`, or any fill/stroke file.** They are shared; changes there are out of scope for this packet regardless of how tempting a shared fix looks.
- **Do not touch the `#rail` slot's move-up/move-down `IconButton`s, their `panels.moveEffectUp`/`moveEffectDown` labels, or `actions.reorder(...)` calls in `EffectsSection.vue`.** That is T-051's job in full, including deciding what replaces them.
- **Do not change what clicking `+` (Add effect) does.** `createDefaultEffect()` stays wired to `actions.add(...)` exactly as today. That is T-052's job in full.
- **Do not attempt to extend the kiwi `.fig` `Effect.type` enum in `App/packages/kiwi/src/fig/codec.ts`.** It is generated from Figma's own binary schema; every new effect type this app defines is permanently excluded from native `.fig` effect serialisation, never added to it.
- **Deferred to a later packet: Glass.** A defensible "frosted glass" approximation needs, at minimum: a backdrop-sampling shader (distinct from the flat-colour `Blender` `adjustments.ts` uses — Glass needs to read the pixels *behind* the node, which requires a genuine `ImageFilter`/shader chain sampling a captured backdrop, not just a paint blender), new `Effect` fields for at least a distortion/refraction strength and a border-highlight toggle (the existing fields do not cover this), a new SVG approximation (likely `feDisplacementMap` plus the existing background-blur SVG path, unverified against `svg2pdf.js`), and a `.fig` round-trip answer identical in shape to Noise's but requiring its own review. This is materially larger than one bounded packet on its own; it deserves a dedicated expansion once Noise's pattern has landed as a working precedent to copy.
- **Deferred to a later packet: Texture.** Ambiguous even after reading every effect-adjacent file in this codebase — no user-supplied definition beyond the label. The nearest existing concept, an image-carrying fill (`Fill.type === 'IMAGE'`, with `imageHash` into `graph.images`), has no analogue on `Effect` at all today. Building one means asset storage, an upload/pick UI, SVG data-URI export (the pattern `createImagePattern` in `svg/defs.ts` already proves works for fills) and a `.fig` exclusion — a materially larger, cross-cutting change than Noise. Do not attempt a placeholder or stub `TEXTURE` type in this packet; an unimplemented type in the list (like today's `Fill.type === 'NOISE'`) is a worse outcome than not listing it.
- **`Shader (Beta)` stays out of scope entirely** (decision 9). Do not add a disabled placeholder entry for it.
- **Do not add UI for choosing Noise before this packet's own type is real** — i.e., do not coordinate with or block on T-052; T-052's picker consumes whatever `EFFECT_OPTIONS` this packet leaves behind, and works correctly whether it has 6 or 9 entries.

## Implementation Steps

1. **Scene-graph model** (`packages/scene-graph/src/types.ts`, `node-defaults.ts`): add `'NOISE'` to `Effect['type']`; add `createNoiseEffect()`, `isNoiseEffect()`, `isFigmaNativeEffect()` per decisions 4-6.
2. **Panel controls** (`packages/vue/src/controls/effects/helpers.ts`): add the `NOISE` label/option/factory wiring; `updateType()` gets a `type === 'NOISE'` branch calling `patch(index, createNoiseEffect())`, matching the existing `INNER_GLOW`/`BRIGHTNESS_CONTRAST`/`SATURATION`/`CURVES` branches exactly in shape.
3. **Row template** (`EffectsSection.vue`): the two compactness class edits (decisions 2-3) and the new `v-else-if="effect.type === 'NOISE'"` settings branch, landed together since both touch the same file — verify no other `v-else-if` branch's condition ordering breaks (the existing chain is `isShadow` → `isAdjustmentEffect` → default/blur; `NOISE` needs its own branch inserted before the default blur `v-else` or it will fall into the blur controls).
4. **Renderer** (`packages/core/src/canvas/noise.ts` new, `renderer.ts`, `scene.ts`, `renderer/lifecycle.ts`): the RuntimeEffect cache and `prepareNoiseLayer`, wired into `renderNode` and disposed in `destroyRenderer`, per decision 7.
5. **SVG/PDF export** (`packages/core/src/io/formats/svg/defs.ts`): the `feTurbulence` branch in `createFilterDef`, per decision 8. Confirm during implementation whether `svg2pdf.js` needs the raster-fallback predicate (Open Decision 1) and land it only if demonstrated necessary by the Playwright PDF spec added in the same step.
6. **`.fig` export** (`packages/core/src/kiwi/fig/node-change/export-node.ts`): swap the adjustment-only filter for `isFigmaNativeEffect`, extend the `Exclude<...>` cast.
7. **i18n**: add `noise` to `packages/vue/src/i18n/messages/panels.ts` and all 8 locale `panels.json` files (see Open Decisions in the brief-level note on T-054 — this packet adds to all 9 sources as they exist today; do not skip locales on the assumption T-054 will land first, since it has not).
8. **Tests**: the engine render test, the `effects.spec.ts` case, and the `panel.spec.ts` snapshot re-capture, per Allowed Changes.
9. Run the focused gates listed under Verification and paste exact exit codes. Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Acceptance Criteria

- [ ] The expand/swatch button and the expanded-settings block use exactly the class strings in the Visual Contract; no other row-level class changed.
- [ ] `PropertyItemRow.vue`, `theme/panel/item-row.ts`, and every fill/stroke file are unmodified in the diff.
- [ ] The rail slot's move-up/move-down buttons and their behaviour are unmodified in the diff.
- [ ] `createDefaultEffect()` and the `+` button's click handler are unmodified in the diff.
- [ ] `Effect.type` includes `'NOISE'`; `createNoiseEffect()`, `isNoiseEffect()`, `isFigmaNativeEffect()` exist and are exported from `@open-pencil/scene-graph`.
- [ ] Selecting Noise from a row's own type `AppSelect` replaces that effect with `createNoiseEffect()`'s shape (verified by the new `effects.spec.ts` case).
- [ ] A node with a visible Noise effect renders a visually distinct grain overlay in the CanvasKit renderer, tinted by `effect.color`, that changes with `effect.radius` (grain scale) — verified by the new engine test.
- [ ] `RuntimeEffect` programs for Noise are cached and bounded (capacity 32, oldest-evicted, `.delete()`d) exactly like `adjustments.ts`'s `adjustmentRuntimeEffects` — verified by the new engine test.
- [ ] SVG export of a node with a Noise effect emits an explicit `feTurbulence`-based filter, never falls through to the `feGaussianBlur` catch-all.
- [ ] A node whose only effect is Noise exports its `.fig` `nc.effects` as empty (or omits `nc.effects` entirely if that was already the empty-array convention) rather than crashing or emitting an invalid enum value; a node with both a Noise effect and a native one (e.g. `DROP_SHADOW`) still exports the native one correctly.
- [ ] `noise` exists in `packages/vue/src/i18n/messages/panels.ts` and all 8 locale `panels.json` files with no missing-key gap.
- [ ] `design-panel-paint-effects-export.png` is re-captured and visually matches the tightened spacing (manually confirmed, not just diffed).
- [ ] Nothing in the Banned List appears in the diff.
- [ ] No `Glass`, `Texture`, or `Shader (Beta)` entry appears anywhere in `EFFECT_OPTIONS`, the panel template, or the scene-graph types.

## Verification

- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- Focused `oxlint` over every file listed in Allowed Changes.
- `bun run check:i18n`
- `bun test tests/engine/render/canvas/effects/` (including the new `noise.test.ts`)
- The focused Playwright specs: `tests/e2e/properties/effects.spec.ts` and `tests/e2e/design/panel.spec.ts`, `--project=openpencil`.

Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, or any build/install/NSIS command — `App/AGENTS.md` and the delivery policy in `Plan/plan.md` both forbid umbrella commands and desktop delivery unless the user asks for that exact command in-session.

## Stop Conditions

- Stop and report if `RuntimeEffect.MakeForBlender` (or an equivalent `MakeForShader`/`MakeForColorFilter` path, whichever the noise implementation needs) cannot express a full-node grain overlay without sampling a rectangular tile texture — i.e., if procedural noise turns out to require an actual bitmap asset after all, the "no new asset storage" premise this packet's scope depends on is wrong and it should be re-cut, not force-fit.
- Stop if `isAdjustmentEffect` cannot be safely left unmodified — i.e., if any existing call site assumes `isAdjustmentEffect(effect) === false` implies "is a native, `.fig`-representable effect" (which would make `isFigmaNativeEffect` redundant with an existing check the packet failed to find). Search for all call sites of `isAdjustmentEffect` before adding the new predicate.
- Stop if the `EffectsSection.vue` template's existing `v-else-if="effectsCtx.isAdjustmentEffect(effect)"` branch would need restructuring beyond adding one sibling `v-else-if` — the file's branch order is load-bearing (Vue evaluates `v-if`/`v-else-if` top to bottom) and a wrong insertion point would silently route Noise into the adjustment or blur controls instead of its own.

## Revision History

- Revision 1 — 2026-08-15: expanded against live source. Cut from three new effect types to one (Noise); Glass and Texture deferred with named reasons. Decisive `.fig` finding: `App/packages/kiwi/src/fig/codec.ts`'s `Effect.type` is a closed 5-value enum generated from Figma's own binary schema, so every new effect type is permanently excluded from native serialisation. `Shader (Beta)` excluded from scope.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-15: compact swatch/expand button classes size-control rounded-icon, settings wrapper ml-6 gap-1 py-1; NOISE effect type end-to-end with scene-graph types, factory/predicates, Vue controls, all 8 i18n locales, SkSL procedural RuntimeEffect shader renderer with MAX_PROGRAMS=32 bounded cache and lifecycle disposal, SVG feTurbulence/feColorMatrix filter def, lossy exclusion in .fig export; tsgo, both vue-tsc projects, check:i18n, focused oxlint, 41/41 engine tests including noise.test.ts, and focused Playwright effects and panel specs green)
