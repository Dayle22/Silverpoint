# T-052 - Choose the effect type before it is added

Task ID: T-052
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-006
Related: T-045 (owns the contents of the type list — consumed here, not redefined), T-051 (reorder interaction — excluded here)
Prepared from: the 2026-08-14 user request batch and a user-supplied screenshot of the target menu opening from `+` with effect types listed and some entries greyed out
Expanded at: 2026-08-15
Expanded against: `App/src/components/properties/EffectsSection.vue`, `App/packages/vue/src/controls/effects/{use,helpers}.ts`, `App/packages/vue/src/controls/property-list/use.ts`, `App/packages/vue/src/primitives/PropertyList/types.ts`, `App/src/components/Toolbar/FramePresetPopover.vue`, `App/src/components/ui/menu.ts`, `App/src/components/properties/FillSection.vue`, `App/src/components/properties/StrokeSection.vue`, `App/packages/scene-graph/src/progressive-blur.ts`, `App/packages/core/src/canvas/scene.ts`, `App/tests/e2e/design/panel.spec.ts`
Delivery: source gates only

## Intended Outcome

Clicking `+` in the Effects section opens a popover listing every available effect type (whatever `EFFECT_OPTIONS` contains at the time — this packet does not define that list, T-045 does). Picking a type adds exactly that effect, with that type's own default shape. Dismissing the popover without picking adds nothing. Fills and strokes are unaffected — their `+` buttons keep inserting a single default item immediately, exactly as today.

## Request Coverage

- Clicking `+` in the Effects section should show the list of effect types first, and add the chosen one, instead of immediately inserting a default effect.

(Verbatim from the stub, delivered in full within this packet's scope.)

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/components/properties/EffectsSection.vue:36-44` | The current `+` button: `<IconButton :label="panels.addEffect" @click="actions.add(effectsCtx.createDefaultEffect())"><icon-lucide-plus class="size-3.5" /></IconButton>`, inside `<template #actions>` of `PanelSection`. `effectsCtx.createDefaultEffect()` always returns a `DROP_SHADOW` (`packages/vue/src/controls/effects/helpers.ts:75-84`). This is the exact call site to replace with a popover trigger. |
| `App/packages/vue/src/controls/effects/helpers.ts:26-49` | `EFFECT_LABELS`, `EFFECT_TYPES`, `EFFECT_OPTIONS` (`{ value, label }[]`, built from `EFFECT_LABELS`) — the live source of truth for what the picker lists. **This packet consumes `effectsCtx.effectOptions` (`use.ts:56`, already re-exported) as-is; it does not add, remove, or reorder entries.** Whatever T-045 lands here (today: `DROP_SHADOW, INNER_SHADOW, INNER_GLOW, LAYER_BLUR, BACKGROUND_BLUR, FOREGROUND_BLUR, BRIGHTNESS_CONTRAST, SATURATION, CURVES`; after T-045: plus `NOISE`) is what the picker shows, unmodified by this packet. |
| `App/packages/vue/src/controls/effects/helpers.ts:118-152` | `createEffectControlActions(expandedIndex).updateType(patch, node, index, type)` — the existing dispatcher used today by each row's own type `AppSelect` (`EffectsSection.vue:95`, `@update:model-value="effectsCtx.updateType(actions.patch, activeNode, index, $event)"`). It already handles every `EffectControlType` (`INNER_GLOW`, `BRIGHTNESS_CONTRAST`, `SATURATION`, `CURVES`, and the plain-`Effect['type']` fallback with shadow-specific default fields). **This packet reuses the same defaulting logic for a newly-added effect, not a new one** — see Fixed Decisions. |
| `App/packages/vue/src/controls/effects/helpers.ts:75-84` | `createDefaultEffect()` — the current always-`DROP_SHADOW` factory the `+` button calls. Stays exported and usable (nothing currently depends on removing it), but the `+` button in `EffectsSection.vue` stops calling it directly — see Fixed Decisions. |
| `App/packages/vue/src/primitives/PropertyList/types.ts:16-23` | `PropertyListActions<K>.add(item: PropertyListItemFor<K>): void` — takes a full item, not a type. The picker must construct a complete `Effect` object for the chosen type before calling `actions.add(...)`, exactly as `createDefaultEffect()` already does for the single default case today. |
| `App/src/components/Toolbar/FramePresetPopover.vue` | The live, closest precedent for "click a trigger, pick one of several options from a popover, then perform the create action" — `PopoverRoot`/`PopoverTrigger` (`as-child`)/`PopoverPortal`/`PopoverContent` from `reka-ui`, a `v-model:open="open"` ref, a list of plain `<button>`s inside, each closing the popover via a shared `close()` after acting. This packet's picker copies this structural shape (`PopoverRoot`/`PopoverTrigger as-child`/`PopoverPortal`/`PopoverContent`), not `FramePresetPopover.vue`'s specific content. |
| `App/src/components/ui/menu.ts` | `menu` `tv()` recipe: `content: 'z-50 rounded-lg border border-border bg-panel p-1 shadow-lg'`, `item: 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-muted/50 data-[highlighted]:bg-hover'`, plus `menuContent()`/`menuItem()`/`menuSeparator()` helper functions. **`item`'s `data-[disabled]:cursor-default data-[disabled]:text-muted/50` is the exact, already-existing greyed-out-entry styling this packet needs** — set `data-disabled` on an item's element to grey it, no new class needed. Already used this way by `T-035-contextual-selection-actions.md`'s overflow menu (a Prepared, not yet built, sibling precedent — read as evidence of intended reuse, not as proof of a live second consumer). |
| `App/src/components/properties/FillSection.vue`, `StrokeSection.vue` | Both confirmed to keep their existing single-default `+` behaviour: `actions.add({ ...fillCtx.defaultFill })` and `actions.add(strokeCtx.defaultStroke)` respectively, each a direct, immediate insert with no popover. **This packet's Expansion Question 2 ("Does the same pattern apply to fills and strokes, or effects only?") is answered by the stub's own scope, not by this packet inventing a new one: the request is effects-only, and fills/strokes have exactly one paint type each (a single "Fill"/"Stroke" concept with a `type` sub-property chosen from within the row's own paint picker, not from a pre-insert type list) — there is no equivalent "which type before insert" decision to make for them. This packet does not touch either file.** |
| `App/tests/e2e/design/panel.spec.ts:138-149` | `'adding an effect creates effect item'` — clicks `effectsSection().getByRole('button', { name: 'Add effect' })` and immediately asserts one effect exists. **This test's premise is invalidated by this packet's own request** (`+` no longer inserts immediately) and must be rewritten, not left to fail. |
| `App/tests/e2e/design/panel.spec.ts:386-424` | Inside `'fill stroke and effect visibility toggles update on repeated clicks and support undo redo'`, the effect portion (`effectAddButton.click()` immediately followed by asserting `effects[0]` exists) has the same premise problem. **Must be updated in the same packet**, not left broken — this is the single most concrete, verified consequence of this packet's own change and is treated as part of its Implementation Steps, not an afterthought. |
| `App/packages/scene-graph/src/progressive-blur.ts:70-77` | `supportsProgressiveBlur` — `BACKGROUND_BLUR` deliberately has no ramp. **This is a per-effect-*instance* field rule** (it governs the `Blur type` segmented control inside an already-added, expanded row), **not** a per-type rule about whether `BACKGROUND_BLUR` itself should be greyed out in the add-picker — a `BACKGROUND_BLUR` effect is fully valid to add; it simply cannot later be switched to `Progressive`. Cited here only to close the stub's own reference to this fact and confirm it does not translate into an add-picker restriction. |
| `App/packages/core/src/canvas/scene.ts:89-111,304-307` (`renderNodeContent`) | Confirms the **only** verified per-node-type effect rendering gap in this codebase: `BOOLEAN_OPERATION` nodes render via `renderBooleanOperation` instead of `renderShape`, and `renderShape` is where `DROP_SHADOW`/`INNER_SHADOW` render (via `shadows.ts`'s pass system) — so `DROP_SHADOW`/`INNER_SHADOW` (and `INNER_GLOW`, an `INNER_SHADOW` variant) added to a `BOOLEAN_OPERATION` node currently render as a no-op. `LAYER_BLUR`/`FOREGROUND_BLUR` and the adjustment effects render fine on `BOOLEAN_OPERATION` (both are applied at the generic `renderNode` level, above the `renderNodeContent` dispatch, uniformly for every node type). This is a **known, tracked, still-open defect** (`Plan/plan.md`'s T-028 entry: "effects on `BOOLEAN_OPERATION` nodes never render at all"), not an intentional application rule — see Fixed Decisions for why this packet does not grey anything based on it. |

## Corrections to the Brief

- The stub's first Expansion Question ("Which types can be greyed out and why — already applied, unsupported on the current node type, or unsupported for the current fill?") presumes at least one of those three rules exists today. **None does.** Verified by reading every effect-application call site: `EFFECT_OPTIONS` is a flat, static list with no node-type or fill-type filtering anywhere (`helpers.ts`, `EffectsSection.vue`, `use.ts` all confirmed); duplicate effect types are allowed (nothing dedupes `node.effects` by `type`); and the one real per-node-type rendering gap found (`BOOLEAN_OPERATION` + shadow effects, above) is an open, unrelated defect tracked by T-028, not an intentional rule this packet should encode as UI. This packet's Fixed Decisions settle the question explicitly rather than leaving it open, per the expansion brief's instruction.
- The stub's second Expansion Question is answered above under Verified Starting State: the "same pattern" does not apply to fills/strokes because they have no equivalent pre-insert type decision to make.

## Fixed Decisions

1. **No entries are greyed out in this packet's picker.** Per the Corrections above, no existing rule in this codebase determines "unavailable" for any effect type on any node/selection. Building one would mean either (a) inventing a new, unrequested application rule, or (b) encoding the known `BOOLEAN_OPERATION` shadow-rendering gap into UI — which would suppress the symptom (let the user avoid adding a no-op shadow) without fixing the actual bug T-028 owns, and would need its own justification, testing, and Related-packet coordination this packet does not have scope for. Recommendation, and the shipped default: **every entry in `effectOptions` is always enabled.**
2. **The picker markup still carries `data-disabled` plumbing (bound to a function that always currently returns `false`) rather than omitting disabled-state support outright.** This keeps the component honestly reusable if a future packet defines a real rule (e.g. a follow-on to T-028 that also wants the add-picker to grey `DROP_SHADOW`/`INNER_SHADOW`/`INNER_GLOW` on `BOOLEAN_OPERATION` nodes) without a second redesign, while shipping zero actual restrictions today — matching the user's screenshot's *capability* (it shows some entries greyed) without fabricating a reason none of them are greyed in this app today.
3. **The trigger is the existing `+` `IconButton`**, unchanged in its own styling, now wrapped as a `PopoverTrigger as-child` instead of carrying a direct `@click` that adds an effect. Copy `FramePresetPopover.vue`'s `PopoverTrigger as-child` + `PopoverPortal` + `PopoverContent` structure exactly; do not build a custom show/hide mechanism.
4. **The popover content reuses `menuContent()`/`menuItem()` from `App/src/components/ui/menu.ts`**, not a bespoke class list — matching this packet's Banned List (no new `tv()` recipe) and giving the always-currently-`false` disabled state its styling for free via `data-[disabled]:*`.
5. **Picking an entry constructs the full `Effect` via the same per-type defaulting `updateType()` already contains**, not a new parallel default-construction path. Concretely: `updateType(patch, node, index, type)` today calls `patch(index, changes)` against an **existing** row at `index`; adding a **new** row needs the equivalent "what does a freshly-chosen type look like" logic without an existing row to patch. The cleanest reuse, verified against `helpers.ts:118-152`'s exact branches, is a new small function in the same file, `createEffectOfType(type: EffectControlType): Effect`, built by extracting `updateType`'s per-type branches (`INNER_GLOW` → `createInnerGlowEffect()`, `BRIGHTNESS_CONTRAST` → `createBrightnessContrastEffect()`, `SATURATION` → `createSaturationEffect()`, `CURVES` → `createCurvesEffect()`, default → `{ ...createDefaultEffect(), type }` for a plain blur/shadow/native type) into a shared helper that **both** `updateType` (for the existing per-row `AppSelect`) and the new picker call — so there is exactly one place that knows what each effect type's default shape is, not two. This directly satisfies the expansion brief's "never write a parallel default source" spirit (the same principle `T-035`'s "never invent an action list" rule states for commands).
6. **The popover closes on pick and on outside-click/`Escape`**, and adds nothing if dismissed without a pick — `PopoverContent`'s own `@escape-key-down`/outside-click behaviour (already used by `FramePresetPopover.vue`) covers this for free; no manual dismiss-without-add guard is needed since nothing is added until a `<button>` inside the popover is actually clicked.
7. **Multi-selection / mixed-effects behaviour is unchanged from today.** `actions.add(item)` already fans out to every selected node when `isMulti` is true (`use.ts:60-73`, `add()`), and `EffectsSection.vue`'s existing `v-if="isMixed"` help text (`panels.mixedEffectsHelp`, "Click + to replace mixed effects") already describes clicking `+` as the entry point for that case — this packet's popover is that same entry point, just interposing a type choice before the existing `actions.add()` call fires. No change to `use.ts`'s `add()`.

## Open Decisions

None. Both of the stub's Expansion Questions are settled under Fixed Decisions above with verified evidence, not left open — this is a case the expansion brief's "answer from the source" instruction fully resolves rather than one requiring a product-taste call.

## Visual Contract — binding

All changes are inside `App/src/components/properties/EffectsSection.vue`'s `<template #actions>` block (lines 37-43 today).

**Delete:**
```html
<IconButton :label="panels.addEffect" @click="actions.add(effectsCtx.createDefaultEffect())">
  <icon-lucide-plus class="size-3.5" />
</IconButton>
```

**Replace with**, copying `FramePresetPopover.vue`'s structural shape (`PopoverRoot`/`PopoverTrigger as-child`/`PopoverPortal`/`PopoverContent`) and `menu.ts`'s content/item classes:

```html
<PopoverRoot v-model:open="addOpen">
  <PopoverTrigger as-child>
    <IconButton :label="panels.addEffect" data-test-id="effect-add-trigger">
      <icon-lucide-plus class="size-3.5" />
    </IconButton>
  </PopoverTrigger>
  <PopoverPortal>
    <PopoverContent
      side="bottom"
      align="end"
      :side-offset="4"
      :class="menuContent()"
      data-test-id="effect-type-picker"
      @escape-key-down="addOpen = false"
    >
      <button
        v-for="option in effectsCtx.effectOptions"
        :key="option.value"
        type="button"
        :class="menuItem()"
        :data-disabled="isEffectTypeDisabled(option.value) ? '' : undefined"
        :disabled="isEffectTypeDisabled(option.value)"
        :data-test-id="`effect-type-${option.value.toLowerCase()}`"
        @click="onPickEffectType(option.value)"
      >
        {{ option.label }}
      </button>
    </PopoverContent>
  </PopoverPortal>
</PopoverRoot>
```

Script additions (inside the existing `<script setup>`): `import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'`, `import { menuContent, menuItem } from '@/components/ui/menu'`, a local `const addOpen = ref(false)`, and:

```ts
function isEffectTypeDisabled(_type: EffectControlType): boolean {
  return false // Fixed Decision 1 — no rule exists today; kept as a named seam, not deleted.
}

function onPickEffectType(type: EffectControlType) {
  actions.add(effectsCtx.createEffectOfType(type))
  addOpen = false
}
```

(`actions` is already the slot prop from `PropertyListRoot`, already destructured in this file's `v-slot`; `effectsCtx` is already the module-level `useEffectsControls()` result. `EffectControlType` is already exported from `helpers.ts`/re-exported through `@open-pencil/vue` per `use.ts`'s existing import shape — confirm the exact export path at implementation time.)

### Banned List

- No literal colour anywhere in the diff — `menuContent()`/`menuItem()` already resolve to token-only classes (`bg-panel`, `border-border`, `text-muted/50`, `bg-hover`), reused verbatim.
- No font-size class other than what `menuItem()` already sets (`text-xs`) — do not override it per-entry.
- No radius outside what `menuContent()`/`menuItem()` already set (`rounded-lg`/`rounded-md`) — do not add a competing radius class.
- No new `tv()` recipe. `menu.ts` already exists and is designed for exactly this (menu content + greyed items) — a bespoke popover stylesheet for this one picker would duplicate it.
- No new npm dependency. `reka-ui`'s `Popover*` components are already a dependency (`FramePresetPopover.vue` already imports them).
- No new global CSS, no `App/src/app.css` edit.
- No edit to `FillSection.vue` or `StrokeSection.vue` — their `+` buttons are unmodified.
- No edit to the row-level `AppSelect` (`EffectsSection.vue:89-96`) or its `updateType()` call — that is the existing per-row type-change path and stays exactly as it is; this packet only changes what happens on **insert**, not on changing an already-added effect's type.
- No change to `EFFECT_OPTIONS`/`EFFECT_LABELS`/`EFFECT_TYPES` contents, ordering, or count — T-045's territory. This packet's picker must work correctly regardless of what that list currently contains.
- No change to the rail slot, the move-up/move-down buttons, or any drag/reorder code — T-051's territory.
- No change to row compactness, spacing, or the expand-button sizing — T-045's territory.

## Allowed Changes

- `App/src/components/properties/EffectsSection.vue` — the `+` button becomes a popover trigger, per the Visual Contract.
- `App/packages/vue/src/controls/effects/helpers.ts` — extract `createEffectOfType(type: EffectControlType): Effect` from `updateType`'s per-type branches (decision 5); `updateType` calls it internally so the logic exists in exactly one place.
- `App/packages/vue/src/controls/effects/use.ts` — re-export `createEffectOfType` alongside the other helpers already spread into the composable's return value, if `EffectsSection.vue` needs it from `effectsCtx` rather than a direct import (match the existing pattern: `createDefaultEffect` is already exposed this way).
- `App/packages/vue/src/i18n/messages/panels.ts` and all 8 locale `panels.json` files — no new key is strictly required (`panels.addEffect` already exists and still labels the trigger; each option's label already exists per `EFFECT_LABELS`), **unless** implementation reveals the popover needs its own accessible name distinct from the trigger's (e.g. an `aria-label` on `PopoverContent`) — add exactly one key (`effectTypePicker` or similar) only if genuinely needed, not speculatively.
- `App/tests/e2e/design/panel.spec.ts` — rewrite `'adding an effect creates effect item'` (lines 138-149) and the effect portion of `'fill stroke and effect visibility toggles update on repeated clicks and support undo redo'` (lines 386-424) to open the picker and click a specific type before asserting an effect exists, per Implementation Steps.
- A new focused Playwright test verifying: the popover opens on `+`, lists every current `effectOptions` entry, adds nothing on `Escape`/outside-click, and adds exactly the picked type's default shape on click.

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these.

- **Do not grey out any entry in the picker.** Decision 1 is binding: no application rule exists today to justify it, and inventing one is out of scope.
- **Do not touch `FillSection.vue` or `StrokeSection.vue`.** Their `+` buttons keep their current immediate-insert behaviour.
- **Do not change `EFFECT_OPTIONS`, its ordering, or its contents.** Whatever T-045 leaves there is what this packet's picker shows.
- **Do not touch the rail slot, the reorder buttons/grip, or any drag code.** T-051's territory.
- **Do not touch row spacing, the expand-button sizing, or the expanded-settings block.** T-045's territory.
- **Do not change `updateType()`'s existing behaviour or call signature** beyond internally delegating its per-type default construction to the new shared `createEffectOfType` helper — the row's own type `AppSelect` must behave identically to today after this refactor.
- **Do not leave the two identified pre-existing Playwright tests broken.** Their update is part of this packet's own Implementation Steps, not a follow-on.

## Implementation Steps

1. Read `EffectsSection.vue`, `helpers.ts`, `FramePresetPopover.vue`, and `menu.ts` in full (already done during expansion; re-read at implementation time in case T-045 or T-051 landed first and changed nearby lines).
2. In `helpers.ts`, extract `createEffectOfType(type: EffectControlType): Effect` from `updateType`'s branches (decision 5); update `updateType` to call it for the "construct the new shape" half of its logic while keeping its own `patch(...)` call and its shadow-specific offset/spread/colour reset behaviour (the part of `updateType` that reads the **previous** effect's type, e.g. `!isShadow(node.effects[index].type)`, has no equivalent for a brand-new row and must not be pulled into the shared helper — only the "what does type X look like fresh" half is shared).
3. Export `createEffectOfType` from `use.ts`'s composable return value alongside `createDefaultEffect`.
4. In `EffectsSection.vue`, replace the `+` button per the Visual Contract; add the `addOpen` ref, `isEffectTypeDisabled`, and `onPickEffectType`.
5. Rewrite the two affected Playwright cases in `panel.spec.ts` (lines 138-149 and 386-424): click `+`, assert the picker (`getByTestId('effect-type-picker')` or equivalent) is visible, click a specific type entry (e.g. `getByTestId('effect-type-drop_shadow')`), then proceed with the existing assertions unchanged.
6. Add the new focused test covering open/list/dismiss-adds-nothing/pick-adds-exact-type, per Allowed Changes.
7. Run the focused gates listed under Verification and paste exact exit codes. Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Acceptance Criteria

- [ ] Clicking `+` opens a popover listing every current `effectOptions` entry; it adds nothing by itself.
- [ ] Picking an entry adds exactly one effect of that type, with that type's own default shape (matching what `updateType` already produces for that type on an existing row — verified by comparing the two paths' output for at least one adjustment type and one native type).
- [ ] Dismissing the popover via `Escape` or an outside click adds nothing.
- [ ] No entry in the picker is greyed out or disabled (matching Fixed Decision 1), but `isEffectTypeDisabled`/`data-disabled` plumbing exists and is wired (matching Fixed Decision 2), so a future packet can add a real rule without a redesign.
- [ ] The row's own per-effect type `AppSelect` (`updateType`) behaves identically to before this packet — same defaults, same shadow-field-reset behaviour.
- [ ] Multi-selection / mixed-effects `+` behaviour is unchanged (still fans out via `actions.add`, still shows `panels.mixedEffectsHelp`).
- [ ] `FillSection.vue` and `StrokeSection.vue` are unmodified in the diff.
- [ ] Both previously-broken-by-this-change Playwright cases in `panel.spec.ts` are rewritten and pass.
- [ ] Nothing in the Banned List appears in the diff.

## Verification

- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- Focused `oxlint` over `EffectsSection.vue`, `helpers.ts`, `use.ts`, and any i18n files touched.
- `bun run check:i18n` (only meaningful if a new key was added per Allowed Changes' conditional bullet).
- The focused Playwright spec: `tests/e2e/design/panel.spec.ts`, `--project=openpencil`, plus the new picker-specific test.

Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, or any build/install/NSIS command.

## Stop Conditions

- Stop and report if `updateType`'s per-type branches cannot be cleanly split into "construct fresh shape for type X" versus "patch an existing effect, taking its previous type into account" — i.e., if the two concerns turn out to be more entangled than decision 5 assumes, extracting a shared helper could introduce a behaviour change in the existing row-level type-change path, which is expressly forbidden.
- Stop if `reka-ui`'s `PopoverContent` cannot be triggered from an `IconButton` via `as-child` without breaking the button's existing `Tip`-wrapped tooltip behaviour (`IconButton.vue` wraps itself in its own `Tip` using its `label` prop) — if the two component's internal structures conflict, report rather than forking `IconButton` for this one call site.
- Stop if any other Playwright test beyond the two identified in Verified Starting State is found, at implementation time, to also assume immediate-insert `+` behaviour for effects — update it as part of this packet rather than leaving a third broken test for someone else to find.

## Revision History

- Revision 1 — 2026-08-15: expanded against live source. Both Expansion Questions settled with verified evidence rather than left open: no existing per-node-type/per-fill effect availability rule exists anywhere in the codebase, and fills/strokes have no equivalent pre-insert type decision. Identified and scoped the update to two pre-existing Playwright tests whose premise this packet's own change invalidates.

## Status record

Status: **Done**

- `bunx tsgo --noEmit --pretty false` — exit 0
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — exit 0
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` — exit 0
- `bunx oxlint -c oxlint.json src/components/properties/EffectsSection.vue packages/vue/src/controls/effects/helpers.ts packages/vue/src/controls/effects/use.ts packages/vue/src/index.ts` — exit 0 (0 errors, 0 warnings)
- `bunx playwright test tests/e2e/design/panel.spec.ts --project=openpencil` — exit 0 (18 passed)
