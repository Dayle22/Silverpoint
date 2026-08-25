# T-077 — Effect-type icons

Task ID: T-077
Packet state: Done
Depends on: T-006 (Done)
Related: T-045 (effect list), T-052 (effect picker), T-076 (multi-selection effects)

## Intended Outcome

Every available effect has a consistent recognisable icon in the add-effect picker and the collapsed effect row, while colour swatches remain available where they convey the effect colour.

## Verified Starting State

- `App/packages/vue/src/controls/effects/helpers.ts:26-27` — `EffectControlType = Effect['type'] | 'INNER_GLOW'`. `Effect['type']` (`App/packages/scene-graph/src/types.ts:184-193`) is a 9-member string-literal union: `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`, `FOREGROUND_BLUR`, `NOISE`, `BRIGHTNESS_CONTRAST`, `SATURATION`, `CURVES`. `INNER_GLOW` is not a distinct scene-graph type — `isInnerGlowEffect()` (`App/packages/scene-graph/src/node-defaults.ts:16-18`) reports it for an `INNER_SHADOW` effect whose `offset` is exactly `{x:0,y:0}`. `helpers.ts:74-76` `effectControlType(effect)` already resolves this: `isInnerGlowEffect(effect) ? 'INNER_GLOW' : effect.type` — the icon lookup must go through this function, not raw `effect.type`, or a zero-offset inner shadow will show the shadow icon while its type selector reads "Inner glow".
- `helpers.ts:31-42` `EFFECT_LABELS: Record<string, string>` already has exactly these 10 keys; `helpers.ts:44-48` derives `EFFECT_TYPES`/`EFFECT_OPTIONS` from it. The new icon map belongs beside `EFFECT_LABELS` and should use the same 10 keys.
- `App/src/components/properties/EffectsSection.vue:80-91` — the add-effect popover renders one `<button class="menuItem()">{{ option.label }}</button>` per `effectsCtx.effectOptions` entry, text-only, `data-test-id="effect-type-${option.value.toLowerCase()}"`.
- `EffectsSection.vue:126-137` — the collapsed row's preview button: `<FillSwatch v-if="effectsCtx.isShadow(effect.type)" .../>` else `<icon-lucide-blend class="size-3 text-muted" />` — one generic glyph for every non-shadow type today. `effectsCtx.isShadow()` (`helpers.ts:78-80`) is `DROP_SHADOW`/`INNER_SHADOW` only, so shadows (including the zero-offset inner-glow case) keep the colour-swatch branch untouched — only the `else` branch needs the new mapping.
- `EffectsSection.vue:140-147` — the expanded row's type dropdown is a shared `AppSelect` (`App/src/components/ui/AppSelect.vue`), a generic `<SelectItem>` list with label text only and no per-option icon slot; it's reused well beyond effects (blur-type toggle uses the same options list shape). Out of scope here — acceptance criteria only calls for the picker and the collapsed row, and adding an icon slot to `AppSelect` would touch every other consumer.
- Icon components are not auto-available as *values* — the `icon-lucide-*` template tags are auto-imported by `unplugin-icons`' `Components`/`IconsResolver` (`App/vite.config.ts:34-35`, prefix `icon`), which only registers global template components, not importable identifiers. To use an icon as a `Record` value it must be imported directly via the resolver's virtual module, e.g. `import IconBoxes from '~icons/lucide/boxes'` — already the established pattern for icon-value maps in this codebase: `App/src/app/editor/icons.ts:1-46` (`toolIcons: Record<Tool, Component>`, consumed via `<component :is="toolIcons[tool.key]">` in `ToolFlyout.vue:119`). `packages/vue/src` is aliased into the same single Vite build as `App/src` (`App/vite/aliases.ts:40-41`), so `~icons/...` imports resolve identically from `helpers.ts`.
- `App/vite/aliases.ts` confirms no separate bundling step for `packages/vue` — no build/install is needed to pick up new imports there, consistent with project convention.
- Confirmed against `App/node_modules/@iconify-json/lucide/icons.json` that these 10 icon names exist and are not already used by `App/src/app/editor/icons.ts`'s tool/node maps: `boxes`, `square-dashed-bottom`, `eclipse`, `droplet`, `layers-2`, `focus`, `dice-5`, `contrast`, `palette`, `spline`.
- `App/src/components/ui/menu.ts:3-38` (`menu` tv instance, used by `menuContent`/`menuItem` which the picker already imports) has a dedicated `icon` slot (`'size-3 text-muted'`) alongside `item` (`'flex items-center gap-2 ...'`) — sized and coloured identically to the row's current `icon-lucide-blend`, and the `gap-2` on `item` already spaces a leading icon from the label with no extra wrapper needed.
- `App/tests/e2e/design/panel.spec.ts` is the correct E2E file (not `App/tests/e2e/properties/effects.spec.ts`, which only covers canvas-render pixel output, no panel UI). It defines `effectsSection()` (line 23-25) and already has `effect-type-picker` / `effect-type-drop_shadow` / `effect-type-layer_blur` coverage (lines 138-162) and an effect-row test (`'effect settings expand semantically and row remove reveals on hover'`, lines 180-195) plus a currently-assertion-only visual test (`'paint effect and export rows share compact visual anatomy'`, lines 197-200) with no `toHaveScreenshot` call — an orphaned snapshot `design-panel-paint-effects-export-openpencil-darwin.png` exists on disk from an earlier version of this test and is not referenced anywhere in the spec today.
- Unit tests for `packages/vue/src/controls/*` live in `App/tests/engine/vue/controls/` (e.g. `appearance.test.ts`), run with `bun:test`, importing the source via the `#vue/...` alias — no scene/editor scaffolding needed for a pure mapping test.

## Scope and Acceptance Criteria

1. In `helpers.ts`, import the 10 icons via `~icons/lucide/<name>` (module-scope, alongside the existing imports) and add:
   ```ts
   export const EFFECT_ICONS: Record<EffectControlType, Component> = {
     DROP_SHADOW: IconBoxes,
     INNER_SHADOW: IconSquareDashedBottom,
     INNER_GLOW: IconEclipse,
     LAYER_BLUR: IconDroplet,
     BACKGROUND_BLUR: IconLayers2,
     FOREGROUND_BLUR: IconFocus,
     NOISE: IconDice5,
     BRIGHTNESS_CONTRAST: IconContrast,
     SATURATION: IconPalette,
     CURVES: IconSpline
   }
   ```
   Use the plain `Record<EffectControlType, Component>` annotation (not `satisfies`) — same as `toolIcons` in `icons.ts:28` — so a future `EffectControlType` member that's missing a key fails `tsgo` directly (TS2741/2739), matching the acceptance criterion's exhaustiveness requirement without any extra lint rule.
   Add `export function effectIcon(type: EffectControlType): Component { return EFFECT_ICONS[type] }` next to `effectControlType()` (`helpers.ts:74-76`) so callers go through one function, matching the existing `isShadow`/`effectControlType` accessor style rather than importing the raw map everywhere.
2. In `use.ts`, import `effectIcon` from `helpers` and add it to the composable's returned object (alongside `effectControlType` at line 59) so `EffectsSection.vue` reaches it as `effectsCtx.effectIcon`.
3. In `EffectsSection.vue`'s add-effect popover (lines 80-91), give each button an icon ahead of the label:
   ```html
   <component :is="effectsCtx.effectIcon(option.value)" :class="menu().icon()" aria-hidden="true" />
   {{ option.label }}
   ```
   (`menu` importable from `@/components/ui/menu`, already the module `menuContent`/`menuItem` come from — add it to the existing import line rather than a new import statement.) `aria-hidden="true"` because the label text beside it already names the effect; nothing else changes for this button (test id, click handler, disabled state stay as-is).
4. In `EffectsSection.vue`'s collapsed-row button (lines 126-137), replace the generic glyph:
   ```html
   <FillSwatch v-if="effectsCtx.isShadow(effect.type)" :fill="effectPreview(effect)" class="size-full border-0" />
   <component v-else :is="effectsCtx.effectIcon(effectsCtx.effectControlType(effect))" class="size-3 text-muted" />
   ```
   Pass the result of `effectControlType(effect)`, not `effect.type`, so a zero-offset inner shadow (inner glow) shows `IconEclipse` — consistent with what the type dropdown beside it already reads. Keep the shadow branch, its `FillSwatch`, and the button's own `Tip`/`aria-label`/`aria-expanded` exactly as they are today (no accessible icon label added — the button's existing expand/collapse `aria-label` already covers it, so the "optionally" in the intended outcome is satisfied by not duplicating that label onto the icon).
5. Do not touch `AppSelect.vue`, the expanded row's type dropdown, `PropertyItemRow.vue`, the rail's up/down reorder `IconButton`s (T-051 scope, lines 148-167), `effectPreview()`, or any `panels.*` i18n string — no new translated label is needed since every icon sits next to (picker) or is fully substitutable by (row, same meaning as the already-visible type text) existing text.

## Verification

Development loop: `cd App && bunx tsgo --noEmit --pretty false` after adding the map — confirms the exhaustiveness guard fires if you temporarily remove one key, then restore it.

Final:
- New unit test `App/tests/engine/vue/controls/effects-icons.test.ts` (`bun:test`, `#vue/controls/effects/helpers` alias, following `appearance.test.ts`'s import style): assert `Object.keys(EFFECT_ICONS)` (or `EFFECT_TYPES`) covers all 10 `EffectControlType` members with no duplicates against each other's icon identity where types are meant to differ; assert `effectIcon('DROP_SHADOW')` and `effectIcon('INNER_SHADOW')` resolve to distinct components (they still need entries even though the row hides them behind swatches, because the picker always shows them); assert `effectIcon(effectControlType({ ...createInnerGlowEffect() }))` resolves to the `INNER_GLOW` icon, distinct from `effectIcon('INNER_SHADOW')`, proving the offset-based dispatch is honoured.
- Extend `App/tests/e2e/design/panel.spec.ts`'s existing test `'effect type picker opens, lists options, dismisses on escape without adding'` (lines 138-162): assert `editor.page.getByTestId('effect-type-drop_shadow').locator('svg')` and `effect-type-layer_blur`'s icon are both visible, confirming the picker renders an icon per row rather than only checking label text.
- Extend `'paint effect and export rows share compact visual anatomy'` (lines 197-200) with `await expect(effectsSection()).toHaveScreenshot('effects-section-type-icons.png')` after adding one shadow and one non-shadow (e.g. layer blur) effect via the picker, so the collapsed-row icon and the swatch are both captured in one snapshot — use a fresh name, not the orphaned `design-panel-paint-effects-export-*` snapshot already on disk.
- Run targeted tests only: `cd App && bun test tests/engine/vue/controls/effects-icons.test.ts` and the Playwright design-panel spec (effects tests) — do not run the full suite.
- Browser-check with `cd App && bun run dev` at normal panel width: open the add-effect picker and confirm every option shows a distinct icon beside its label; add one of each effect type in turn and confirm the collapsed row shows the matching icon (shadows still show the colour swatch); toggle an inner shadow's offset to `0,0` and back and confirm the row icon switches between the inner-shadow and inner-glow glyphs; confirm keyboard navigation (arrow keys/Enter) through the picker and the reorder up/down buttons still work unchanged. No build/install.

## Status record

2026-08-21 — First brief from the icon request. Expansion must use the exact current `EffectControlType` union so no effect silently falls back to a generic glyph.
2026-08-21 — Expanded to Ready. Confirmed `EffectControlType`'s 10 members and that `INNER_GLOW` is a derived, offset-based classification of `INNER_SHADOW` rather than its own scene-graph type, so the icon lookup must dispatch through `effectControlType()`. Chose a `Record<EffectControlType, Component>` map (same shape as `App/src/app/editor/icons.ts`'s `toolIcons`) imported via `~icons/lucide/*` for compile-time exhaustiveness, scoped to exactly the add-effect popover and the collapsed-row preview button — left the shared `AppSelect` type dropdown untouched since it has no per-option icon slot and is reused outside effects. Picked and existence-checked 10 Lucide icon names against the installed `@iconify-json/lucide` package rather than guessing.
2026-08-21 — Executed and verified. Added `EFFECT_ICONS` and `effectIcon` in `helpers.ts`, forwarded `effectIcon` in `use.ts`, updated `EffectsSection.vue` picker and collapsed row buttons with icons, added unit tests in `effects-icons.test.ts` (4 passing), updated `panel.spec.ts` (18 passing with new snapshot `effects-section-type-icons.png`), and passed oxlint, vue-tsc, and tsgo.
