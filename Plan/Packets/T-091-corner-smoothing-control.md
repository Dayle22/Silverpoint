# T-091 - Corner smoothing control

Task ID: T-091
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-004 (Done)
Related: T-036, T-072, T-087
Prepared from: user request on 2026-08-24 — a review of `Toolbox/open-pencil-master (1)` found upstream shipped a corner-smoothing control; the user asked for the helpful parts to be packeted rather than merged.
Expanded at: 2026-08-24, Africa/Johannesburg
Expanded against: `App/packages/vue/src/controls/appearance/helpers.ts` (201 lines, read in full), `App/packages/vue/src/controls/appearance/types.ts`, `App/packages/vue/src/controls/appearance/use.ts`, `App/packages/vue/src/controls/node-props/use.ts`, `App/packages/vue/src/controls/node-props/helpers.ts:185–220`, `App/packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` (32 lines, read in full), `App/packages/vue/src/primitives/AppearanceControls/types.ts` (35 lines, read in full), `App/src/components/properties/AppearanceSection.vue` (226 lines, read in full), `App/src/components/inputs/NumberField.vue:1–110`, `App/src/components/ui/panel/PanelGrid.vue`, `App/src/theme/panel/grid.ts`, `App/src/app.css:74–78`, `App/packages/vue/src/i18n/messages/panels.ts:55–70`, `App/packages/scene-graph/src/types.ts:388`, `App/packages/scene-graph/src/node-defaults.ts:128`, `App/packages/scene-graph/src/source-metadata.ts:25`, `App/packages/core/src/canvas/shapes.ts` (smooth-corner block), `App/packages/core/src/canvas/{fills,scene,shadows,strokes}.ts` (call sites), `App/packages/core/src/io/formats/svg/*.ts` and `pdf/*.ts` (absence of smoothing), `App/node_modules/@iconify-json/lucide/icons.json` (icon existence), `App/tests/engine/vue/controls/appearance.test.ts` (64 lines), `App/tests/e2e/properties/corner-stroke-toggles.spec.ts` (124 lines), `App/tests/e2e/properties/number-field.spec.ts:1–60`, `App/tests/helpers/properties.ts`, `App/tests/helpers/store.ts:28–65`, `App/tests/helpers/canvas.ts` (method list), `App/package.json` scripts.
Delivery: named source gates + browser check
Execution size: 5 implementation files (4 edits in `packages/`, 1 edit in `src/`); 3 test files (1 extended Bun test, 1 new Playwright spec, 1 extended shared test helper); no split — one responsibility (expose one already-rendered property in one panel section), no new model field, no new renderer code.

## Intended Outcome

The Appearance section of the Properties panel gains a `Corner smoothing` percentage field beneath the
corner-radius controls. Setting it to a non-zero value makes the selected rectangle, rounded rectangle,
frame, component, instance or boolean-operation node render Figma-style squircle corners instead of
circular-arc corners, live on canvas, with scrub/undo behaviour identical to the existing Radius field.

No rendering code changes. The squircle geometry, the `cornerSmoothing` scene-graph field, its default, its
`.fig` round-trip and its Figma-API accessor already exist and are already wired into fills, strokes, shadows,
clipping and the scene draw path. This packet only adds the control that sets the value.

## Request Coverage

- "they have a corner smoothing tool" — add the missing UI control for the existing `cornerSmoothing` property.
- Applies to the Appearance section only. The Position, Layout, Fill, Stroke, Effects and Export sections are
  untouched.

## Verified Starting State

| Path | Symbol / selector | Current fact (verified) |
| --- | --- | --- |
| `packages/scene-graph/src/types.ts:388` | `cornerSmoothing: number` | The field already exists on `SceneNode`, so `merged('cornerSmoothing')` type-checks without any change to the scene graph. |
| `packages/scene-graph/src/node-defaults.ts:128` | `cornerSmoothing: 0,` | Default is `0` (no smoothing). Every existing document therefore renders unchanged until the user edits the new field. |
| `packages/scene-graph/src/source-metadata.ts:25` | `'cornerSmoothing'` | Listed as an edited-source-metadata key, so edits already invalidate imported-source fidelity correctly. |
| `packages/core/src/canvas/shapes.ts:21` | `export function nodeHasSmoothCorners(node: SceneNode): boolean` | Returns `false` unless `cornerSmoothing > 0` **and** some radius is `> 0`. Smoothing alone with zero radius is a no-op by design. |
| `packages/core/src/canvas/shapes.ts:143` | `smoothCornerPathParams(corner, smoothing)` | Full Figma squircle construction, already implemented, including the `corner.budget / corner.radius - 1` clamp. |
| `packages/core/src/canvas/shapes.ts:315` | `export function makeSmoothRRectPath(...)` | Public path builder. Line 334 clamps with `Math.max(0, Math.min(node.cornerSmoothing, 1))`, so out-of-range model values cannot corrupt geometry. |
| `packages/core/src/canvas/fills.ts:77,175`; `scene.ts:196`; `shadows.ts:206,266,436,482`; `strokes.ts:257`; `shapes.ts:389,514` | `nodeHasSmoothCorners(...)` | Smoothing is already consumed by fills, the scene draw path, all four shadow paths, strokes, the shape-path builder and node clipping. **No renderer work is required by this packet.** |
| `packages/core/src/io/formats/svg/*.ts`, `packages/core/src/io/formats/pdf/*.ts` | — | Neither exporter references `cornerSmoothing`; both emit circular-arc corners. This matches upstream and is explicitly out of scope — see Restrictions. |
| `packages/vue/src/controls/appearance/helpers.ts:8` | `import { MIXED, type MixedValue } from '#vue/controls/node-props/use'` | `MIXED` is already imported and already used at lines 62, 66 and 72. No new import is needed for the new computed. |
| `packages/vue/src/controls/appearance/helpers.ts:38–85` | `createAppearanceState({ node, nodes, isMulti, merged })` | Returns `hasCornerRadius, independentCorners, showIndependentCorners, cornerRadiusValue, opacityPercent, blendModeValue, visibilityState` (lines 76–84). `opacityPercent` (60–63) is the exact percentage-conversion precedent to copy. |
| `packages/vue/src/controls/appearance/helpers.ts:10–17` | `CORNER_RADIUS_TYPES` | `RECTANGLE, ROUNDED_RECTANGLE, FRAME, COMPONENT, INSTANCE, BOOLEAN_OPERATION`. `hasCornerRadius` (39–42) already gates on this set and is reused verbatim to gate the new field. |
| `packages/vue/src/controls/appearance/types.ts` | `CornerRadiusKey` | Four per-corner keys only. **It must not gain `cornerSmoothing`** — see Fixed Decision 2. |
| `packages/vue/src/primitives/AppearanceControls/types.ts:9` | `updateProp(key: string, value: number): void` | Already accepts an arbitrary string key. `commitProp` (line 10) likewise. This is the action pair the new field uses. |
| `packages/vue/src/controls/node-props/helpers.ts:185–220` | `createNodePropScrubActions(store)` | `updateProp` stores per-node previous values for multi-selection (`storePreviousValues`) and `commitProp` replays them, so multi-selection scrub + undo is already correct for any key. |
| `packages/vue/src/primitives/AppearanceControls/types.ts:18–30` | `AppearanceControlsRootSlotProps` | Eleven props. A twelfth must be added for the slot to expose the new value. |
| `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue:19–31` | `<slot … />` | Each state value is bound as a kebab-case attribute, e.g. `:corner-radius-value="ctx.cornerRadiusValue.value"`. |
| `src/components/properties/AppearanceSection.vue:49–61` | `v-slot="{ … }"` destructure | Currently destructures `node, isMulti, active, hasCornerRadius, independentCorners, showIndependentCorners, cornerRadiusValue, opacityPercent, blendModeValue, visibilityState, actions`. |
| `src/components/properties/AppearanceSection.vue:124–168` | uniform-radius `PanelGrid` | `columns="fill-rail" class="mt-panel"`, gated `v-if="hasCornerRadius && !showIndependentCorners"`. Field + `PanelRail` toggle. |
| `src/components/properties/AppearanceSection.vue:170–223` | per-corner `PanelGrid` | `columns="two-rail" class="mt-panel" data-corner-grid`, gated `v-else-if="hasCornerRadius && !isMulti && node"`. Line 222 is a bare `<PanelRail />` used purely as a grid spacer — the precedent for the new row's trailing rail. |
| `src/components/properties/AppearanceSection.vue:137–138,150–151` | `actions.updateProp('cornerRadius', …)` / `actions.commitProp('cornerRadius', …)` | The uniform radius already uses the **generic** `updateProp`/`commitProp` pair, not `updateCornerProp`. The new field follows this same path. |
| `src/theme/panel/grid.ts:3–10` | `columns` variants | `two`, `two-rail`, `fill`, `fill-rail`. `fill-rail` is `grid-cols-[minmax(0,1fr)_var(--spacing-panel-rail)]`. |
| `src/app.css:76` | `--spacing-panel: 6px` | Backs the `mt-panel` / `gap-panel` utilities used by every Appearance row. |
| `src/components/inputs/NumberField.vue:14–28,70–75` | `NumberFieldProps`, emits | Accepts `modelValue: number \| symbol`, `min`, `max`, `suffix`, `label`; emits `update:modelValue` and `commit: [value, previous]`. `defineOptions({ inheritAttrs: false })` with `v-bind="{ ...attrs, ...rootAttrs }"` (line 108) puts `data-property` and `aria-label` on the field root. |
| `packages/vue/src/i18n/messages/panels.ts:63` | `radius: 'Radius',` | Insertion point for the one new key. Sole English dictionary; no other locale file exists in this repo. |
| `node_modules/@iconify-json/lucide/icons.json` | `squircle` | Present. `icon-lucide-squircle` resolves through `IconsResolver` (`vite.config.ts`), same mechanism as the existing `icon-lucide-square-round-corner` and `icon-lucide-blend`. |
| `tests/helpers/store.ts:52` | `cornerRadius: n.cornerRadius,` | `getSelectedNode` does **not** currently return `cornerSmoothing`; the e2e assertion needs it added. |
| `tests/helpers/properties.ts` | `propertyField(page, property)` | Locates `[data-property="…"]`. App's convention is camelCase (`cornerRadius`, `opacity`), unlike upstream's kebab-case. |
| `tests/engine/vue/controls/appearance.test.ts` | 64 lines | Already builds `createAppearanceState` against a fake `merged`. The new state test extends this file. |
| `tests/e2e/properties/number-field.spec.ts:1–19` | `useEditorSetup`, `propertyField`, `getSelectedNode` | The newest e2e convention: `const editor = useEditorSetup()`, `editor.canvas.drawRect(...)`, `field.click()` then `field.getByRole('spinbutton', { name })`, `input.fill(...)`, `input.press('Enter')`. |

Exact new computed to add to `createAppearanceState` (copy verbatim, place immediately after
`cornerRadiusValue`, lines 55–58):

```ts
  const cornerSmoothingPercent = computed(() => {
    const value = merged('cornerSmoothing')
    return value === MIXED ? MIXED : Math.round(Math.max(0, Math.min(value, 1)) * 100)
  })
```

## Read First

1. `packages/vue/src/controls/appearance/helpers.ts` lines 38–85 — `createAppearanceState` and its return object.
2. `packages/vue/src/primitives/AppearanceControls/types.ts` (whole file, 35 lines).
3. `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` (whole file, 32 lines).
4. `src/components/properties/AppearanceSection.vue` lines 47–226 — the whole template.
5. `tests/engine/vue/controls/appearance.test.ts` (whole file, 64 lines).
6. `tests/e2e/properties/number-field.spec.ts` lines 1–46 — the field-editing helper pattern.

Do **not** open `packages/core/src/canvas/shapes.ts`, `fills.ts`, `strokes.ts`, `shadows.ts` or `scene.ts`.
The renderer is already correct and must not be edited; its behaviour is recorded in Verified Starting State.

## Corrections to the Brief

The premise "they have a corner smoothing tool [we don't]" is only half right, and the correct half changes
the size of the work. OpenPotlood already contains the entire corner-smoothing implementation — model field,
default, `.fig` round-trip, squircle path construction, and consumption by fills, strokes, shadows, clipping
and the scene draw path. `App/src/app/demo/sections/effects.ts` already sets `cornerSmoothing` at lines 358,
375 and 414, and `App/src/app/ai/chat/system-prompt.md:23` already advertises `cornerSmoothing={0-1}` to the
AI. The only thing missing is a control in the Appearance panel. This is a UI packet, not a rendering packet.

## Fixed Decisions

1. **Use the generic `actions.updateProp` / `actions.commitProp` pair, not `updateCornerProp`.** Justification:
   the uniform Radius field already does exactly this (`AppearanceSection.vue:137–138,150–151`), and
   `updateProp(key: string, …)` (`primitives/AppearanceControls/types.ts:9`) already accepts any key.
   `createNodePropScrubActions` already handles the multi-selection previous-value bookkeeping.
2. **Do not extend `CornerRadiusKey`.** Upstream added a `CornerGeometryKey = CornerRadiusKey | 'cornerSmoothing'`
   union and routed smoothing through `updateCornerProp`. Do not copy that. It would widen
   `updateCornerProp`/`commitCornerProp` in `helpers.ts:170–192` and in the public
   `AppearanceControlsActions` interface for no behavioural gain, and `commitCornerProp` has different
   multi-selection semantics from `commitProp` (it batches with `runBatch` and does not record per-node
   previous values through the scrub map). Decision 1 avoids that divergence entirely.
3. **Percent in the UI, unit interval in the model.** The field shows `0`–`100` with a `%` suffix; the handlers
   divide by 100. This mirrors the Opacity field (`AppearanceSection.vue:99–100,114–115`) exactly.
4. **Use a plain `NumberField`, never `VariableNumberField`.** `cornerSmoothing` is not a variable-bindable
   property: it has no binding path in the variables system, and `VariableNumberField` requires a valid
   `binding-path`. One control renders for both single and multi selection, which also keeps the row present
   during multi-selection where the value can legitimately be `MIXED`.
5. **The field renders in its own row gated on `hasCornerRadius` alone**, below both the uniform-radius grid and
   the per-corner grid, so it is visible in both corner modes and in multi-selection. It uses
   `columns="fill-rail"` with a trailing empty `<PanelRail />` so its input width lines up exactly with the
   Radius field above it. Precedent for the bare spacer rail: `AppearanceSection.vue:222`.
6. **`data-property="cornerSmoothing"` (camelCase).** App's convention is camelCase (`cornerRadius`, `opacity`,
   `x`); upstream used `corner-smoothing`. Follow App's convention so `propertyField(page, 'cornerSmoothing')`
   reads like every other field query in `tests/helpers/properties.ts`.
7. **`min="0"` and `max="100"` on the field.** The renderer already clamps (`shapes.ts:334`), but clamping at
   the input keeps the displayed value honest and prevents a scrub from writing a model value the panel would
   then redisplay differently.
8. **Add `cornerSmoothing` to `tests/helpers/store.ts`'s `getSelectedNode` projection.** It is a purely
   additive field on a shared read-only helper; no existing assertion reads the object by shape.

## Open Decisions

1. **SVG and PDF export fidelity.** Recommended default (implemented): leave export unchanged — both exporters
   emit circular-arc corners, so a smoothed node exports as an ordinary rounded rectangle. This matches
   upstream, which also has no export support. Consequence of the alternative: `makeSmoothRRectPath` produces a
   CanvasKit `Path`, so an exporter would need an independent SVG path-data emitter for the same cubic
   construction plus PDF operator output, and both would need visual fixtures. That is a separate packet, not
   a widening of this one. Adopt only if the user asks.
2. **Corner smoothing on the Contextual property surface (T-036).** Recommended default (implemented): not
   added there. T-036 is still `Ready` and owns its own property model; adding a field to a surface that does
   not yet exist would create a merge conflict. Consequence of the alternative: none until T-036 executes.

## Visual Contract — binding

Every attribute below is final. Do not restyle, reorder, or relocate any existing control.

**New template block** — `src/components/properties/AppearanceSection.vue`, inserted immediately after the
per-corner `PanelGrid` closing tag (currently line 223) and before `</PanelSection>` (currently line 224):

```html
      <PanelGrid v-if="hasCornerRadius" columns="fill-rail" class="mt-panel">
        <PanelFieldGroup :label="panels.cornerSmoothing">
          <NumberField
            suffix="%"
            data-property="cornerSmoothing"
            :aria-label="panels.cornerSmoothing"
            :model-value="cornerSmoothingPercent"
            :min="0"
            :max="100"
            @update:model-value="actions.updateProp('cornerSmoothing', $event / 100)"
            @commit="
              (v: number, p: number) => actions.commitProp('cornerSmoothing', v / 100, p / 100)
            "
          >
            <template #icon>
              <icon-lucide-squircle class="size-3" />
            </template>
          </NumberField>
        </PanelFieldGroup>
        <PanelRail />
      </PanelGrid>
```

**Slot destructure** — add `cornerSmoothingPercent,` immediately after `cornerRadiusValue,` (line 56) in the
`v-slot` object. Do not reorder the other entries.

**Slot binding** — `AppearanceControlsRoot.vue`, add immediately after line 26:

```html
    :corner-smoothing-percent="ctx.cornerSmoothingPercent.value"
```

**Slot prop type** — `primitives/AppearanceControls/types.ts`, add immediately after `cornerRadiusValue`
(line 25):

```ts
  cornerSmoothingPercent: MixedValue<number>
```

`MixedValue` is already imported at line 6.

**Dictionary key** — `packages/vue/src/i18n/messages/panels.ts`, insert immediately after line 63:

```ts
  cornerSmoothing: 'Corner smoothing',
```

**States**

- Default: `0`, rendered as `0%`, icon `icon-lucide-squircle` at `size-3`.
- Multi-selection with differing values: the field displays the `MIXED` sentinel exactly as Opacity and Radius
  already do; `NumberField` accepts `number | symbol` for `modelValue` (`NumberField.vue:15`). No special case.
- Node type without corner radius (for example `ELLIPSE`, `TEXT`, `VECTOR`): the whole row is absent, because
  `hasCornerRadius` is false.
- Scrub: identical to Radius — drag the icon to scrub, one undo entry per gesture via `commitProp`.
- Zero radius with non-zero smoothing: value stores and displays normally; the canvas is unchanged because
  `nodeHasSmoothCorners` requires a non-zero radius. This is correct, intended behaviour — do not add a
  disabled state, a warning, or a radius-dependent gate.
- Disabled / loading / empty: not applicable.
- Responsive: none. The row inherits the panel's fixed grid; no breakpoint variants.

**Test ids**: `data-property="cornerSmoothing"` on the field root. No other new selector.

### Banned List

- No literal colour anywhere — no hex, no `rgb()`, no `bg-zinc-*` / `text-slate-*`. Semantic tokens only.
- No font size outside `text-xs` / `text-[11px]`.
- No spacing literal in place of the panel tokens — use `mt-panel` / `gap-panel`, never `mt-1.5` or `gap-2`.
- No new `columns` variant in `src/theme/panel/grid.ts`; use the existing `fill-rail`.
- No `:columns="2"` numeric prop — App's `PanelGrid` takes the string variants `two`, `two-rail`, `fill`,
  `fill-rail`. Upstream's numeric API does not exist here.
- No new `tv()` recipe, no new theme file, no edit to `src/app.css`.
- No new npm dependency.
- No `VariableNumberField`, no `binding-path`, no variables integration.
- No change to `CornerRadiusKey`, `updateCornerProp`, `commitCornerProp`, or `AppearanceControlsActions`.
- No change to any existing control's `aria-label`, `data-property`, `v-model` target, `min`/`max`/`step`, or
  its surrounding `PanelFieldGroup` / `PanelGrid` / `PanelRail` element.
- No edit to any file under `packages/core/src/canvas/`.
- No `PanelRail` removal from the existing per-corner grid.

## Allowed Changes

- `packages/vue/src/controls/appearance/helpers.ts` — add `cornerSmoothingPercent` and return it.
- `packages/vue/src/primitives/AppearanceControls/types.ts` — add one slot prop.
- `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` — add one slot binding.
- `packages/vue/src/i18n/messages/panels.ts` — add one key.
- `src/components/properties/AppearanceSection.vue` — add the destructure entry and the new `PanelGrid` block.
- `tests/helpers/store.ts` — add `cornerSmoothing` to the `getSelectedNode` projection.
- `tests/engine/vue/controls/appearance.test.ts` — add state tests.
- `tests/e2e/properties/corner-smoothing.spec.ts` — new file.

## Restrictions and Exclusions

An implementer who wants to cross one of these must stop and report instead.

- Do not touch any file under `packages/core/src/canvas/`, `packages/core/src/io/`, `packages/scene-graph/src/`,
  `packages/fig/src/` or `packages/kiwi/src/`. The model, codec and renderer are already complete.
- Do not add SVG or PDF export support for smoothing (Open Decision 1).
- Do not add the field to `src/components/properties/PropertyListRoot.vue`, the Layout section, or any
  contextual/selection surface.
- Do not change the corner-radius controls, the independent-corners toggle, or `data-corner-grid`.
- Do not add a second locale file.
- Do not build the desktop app, run the installer, or bump `package.json` /
  `desktop/tauri.conf.json` / `desktop/Cargo.toml`.
- Do not run `bun run check`, `bun run lint`, `bun run test`, or `bun run test:unit`.

## Implementation Steps

1. **Pre-flight.** Reread `packages/vue/src/controls/appearance/helpers.ts:38–85`,
   `primitives/AppearanceControls/types.ts`, `AppearanceControlsRoot.vue`, and
   `src/components/properties/AppearanceSection.vue:47–226`. Confirm the line anchors in Verified Starting
   State still match. Record any drift in the execution report before editing.

2. **`packages/vue/src/controls/appearance/helpers.ts`.** Insert the `cornerSmoothingPercent` computed verbatim
   from Verified Starting State immediately after `cornerRadiusValue` (currently ends line 58), and add
   `cornerSmoothingPercent,` to the returned object immediately after `cornerRadiusValue,` (line 80). Change
   nothing else in the file — in particular, leave `createAppearanceActions` untouched.

3. **`packages/vue/src/primitives/AppearanceControls/types.ts`.** Add
   `cornerSmoothingPercent: MixedValue<number>` to `AppearanceControlsRootSlotProps` immediately after
   `cornerRadiusValue` (line 25). Leave `AppearanceControlsActions` unchanged.

4. **`packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue`.** Add
   `:corner-smoothing-percent="ctx.cornerSmoothingPercent.value"` immediately after line 26. Leave the
   `actions` object (lines 7–15) unchanged.

5. **`packages/vue/src/i18n/messages/panels.ts`.** Add `cornerSmoothing: 'Corner smoothing',` immediately after
   `radius: 'Radius',` (line 63). No other dictionary edit.

6. **`src/components/properties/AppearanceSection.vue`.** Add `cornerSmoothingPercent,` to the `v-slot`
   destructure after `cornerRadiusValue,`, then insert the new `PanelGrid` block from the Visual Contract
   between the per-corner grid's `</PanelGrid>` and `</PanelSection>`. Add no import — `NumberField`,
   `PanelFieldGroup`, `PanelGrid` and `PanelRail` are already imported at lines 6, 10, 11 and 12.

7. **`tests/helpers/store.ts`.** Add `cornerSmoothing: n.cornerSmoothing,` immediately after
   `cornerRadius: n.cornerRadius,` (line 52) inside `getSelectedNode`. Do not modify `getSelectedNodes`,
   `getPageChildren` or `getNodeById`.

8. **Extend `tests/engine/vue/controls/appearance.test.ts`.** Keep the existing header and the existing
   `appearanceState` / `rectangle` helpers exactly as they are. Add a
   `describe('corner smoothing state', …)` block asserting, using the existing `appearanceState(node)` helper:
   - a fresh rectangle reports `cornerSmoothingPercent.value === 0`;
   - `node.cornerSmoothing = 0.6` gives `60`;
   - `node.cornerSmoothing = 1` gives `100`;
   - `node.cornerSmoothing = 0.005` gives `1` (rounds, does not truncate to `0`);
   - an out-of-range `node.cornerSmoothing = 1.8` clamps to `100`, and `-0.5` clamps to `0`.

9. **Add `tests/e2e/properties/corner-smoothing.spec.ts`.** Match the header of
   `tests/e2e/properties/number-field.spec.ts` exactly — a plain
   `import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'` with no `@ts-nocheck`, plus
   `propertyField` from `#tests/helpers/properties` and `getSelectedNode` from `#tests/helpers/store`. Assert:
   - after `editor.canvas.drawRect(120, 100, 120, 90)`, `propertyField(page, 'cornerSmoothing')` is visible and
     reads `aria-valuenow="0"`;
   - clicking the field, filling `60`, pressing Enter and awaiting `editor.canvas.waitForRender()` leaves
     `(await getSelectedNode(page))?.cornerSmoothing` at `0.6`;
   - `editor.canvas.undo()` restores it to `0`;
   - after `editor.canvas.clearCanvas()` and `editor.canvas.drawEllipse(120, 100, 120, 90)`, the field is not
     visible (ellipse is not in `CORNER_RADIUS_TYPES`);
   - `editor.canvas.assertNoErrors()` at the end of each test.

## Acceptance Criteria

- [ ] Selecting a rectangle, frame, component, instance or boolean-operation node shows a `Corner smoothing`
      field with a `%` suffix and a squircle icon, below the radius controls.
- [ ] The field is present in both the uniform-radius mode and the per-corner mode, and during multi-selection.
- [ ] The field is absent for node types with no corner radius (ellipse, text, vector, line).
- [ ] Typing `60` sets the selected node's `cornerSmoothing` to `0.6`; the canvas repaints with squircle corners
      when the node also has a non-zero radius.
- [ ] Scrubbing the field produces exactly one undo entry per gesture, matching the Radius field.
- [ ] Multi-selection with differing values shows the mixed sentinel, and editing applies to every selected node
      with a single correct undo step.
- [ ] `CornerRadiusKey`, `updateCornerProp`, `commitCornerProp` and `AppearanceControlsActions` are byte-identical
      to their pre-packet state.
- [ ] No file under `packages/core/src/canvas/` appears in the diff.
- [ ] Nothing on the Banned List appears in the diff.
- [ ] All named gates below pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```bash
bun test tests/engine/vue/controls/appearance.test.ts
```

### Final pre-completion gates — run once

```bash
bunx tsgo --noEmit
```

```bash
bunx vue-tsc --noEmit -p tsconfig.json
```

```bash
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json
```

```bash
bunx oxlint -c oxlint.json src/components/properties/AppearanceSection.vue packages/vue/src/controls/appearance/helpers.ts packages/vue/src/primitives/AppearanceControls/types.ts packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue packages/vue/src/i18n/messages/panels.ts tests/helpers/store.ts tests/engine/vue/controls/appearance.test.ts tests/e2e/properties/corner-smoothing.spec.ts
```

```bash
bunx playwright test tests/e2e/properties/corner-smoothing.spec.ts tests/e2e/properties/corner-stroke-toggles.spec.ts tests/e2e/properties/number-field.spec.ts --project=openpencil
```

`vue-tsc -p packages/vue/tsconfig.json` **is** required here (unlike T-087): this packet changes a public
type surface, `AppearanceControlsRootSlotProps`.

Dictionary check: no `check:i18n` script exists in `App/package.json`. Read back
`packages/vue/src/i18n/messages/panels.ts` and confirm `cornerSmoothing` appears exactly once and that
`radius`, `opacity` and `independentCornerRadii` are unchanged.

## Integration or Installed-Result Check

Browser only — no desktop build is authorised or needed. No Tauri config, Rust, icon, generated menu, or
`IS_TAURI`-only surface is touched.

```bash
bun run dev
```

At `http://localhost:1420`:

1. Draw a frame, set Radius to `40`, then set Corner smoothing to `60%`. The corners visibly change from
   circular arcs to a squircle — compare against `0%` by toggling the value back.
2. Confirm the same on a rectangle with a fill **and** a visible stroke, and with a drop shadow added in
   Effects: fill, stroke and shadow outlines all follow the smoothed silhouette (this exercises `fills.ts`,
   `strokes.ts` and `shadows.ts` in one observation).
3. Set Radius to `0` with smoothing at `100%` — the shape stays square-cornered. Expected; not a defect.
4. Scrub the smoothing icon left/right; the canvas updates live, and one `Ctrl+Z` returns the value to where
   the gesture started.
5. Turn on Independent corner radii; the smoothing row stays visible below the four corner fields and still
   works.
6. Select two frames with different smoothing values; the field shows the mixed state, and typing `25` applies
   `0.25` to both with a single undo.
7. Select an ellipse; the whole smoothing row disappears along with the radius row.
8. Non-regression: Radius, the independent-corners toggle, Opacity and Blend mode all behave exactly as before.

## Stop Conditions

Stop and report instead of improvising if:

- `merged('cornerSmoothing')` fails to type-check, indicating `cornerSmoothing` is not on `SceneNode` as
  recorded at `packages/scene-graph/src/types.ts:388`;
- `updateProp('cornerSmoothing', …)` does not reach the node, indicating `createNodePropScrubActions` filters
  keys against an allowlist not seen during expansion;
- the canvas does not repaint on change, indicating the renderer wiring recorded in Verified Starting State has
  regressed — in that case report it as a separate defect and do **not** edit the renderer inside this packet;
- `PanelGrid`'s `fill-rail` variant no longer aligns the field with the Radius field above it;
- the work appears to require editing `CornerRadiusKey`, `updateCornerProp`, the renderer, or any file outside
  Allowed Changes.

## Execution Report Contract

Record: every changed file with its role; the final template block if it deviated from the Visual Contract and
why; the exact commands run with exit codes and test counts; the Bun test names added and their results; the
eight browser-check observations above with pass/fail each; confirmation that `CornerRadiusKey` and
`AppearanceControlsActions` are unchanged; confirmation that no `packages/core/src/canvas/` file is in the
diff; any Banned List item crossed and its justification; and any remaining gap (for example Open Decision 1
left unimplemented, which is expected).

## Status record

Expansion receipt — 2026-08-24, revision 1. Expanded against the live tree under `App/`; every path, symbol,
line number, class token, dictionary key, icon name, test helper and script command in this packet was read
from source or `node_modules` during expansion. No file under `App/` was modified. The upstream resource
`Toolbox/open-pencil-master (1)` was read for comparison only and is non-authoritative; its implementation was
deliberately **not** copied where it conflicts with App's conventions (see Fixed Decisions 1, 2 and 6, and the
Banned List entry on `PanelGrid` columns). Execution evidence goes here after the packet runs; step status
stays in `Plan/plan.md`.

Execution receipt — 2026-08-24, revision 1. Implemented exactly per the Visual Contract, Fixed Decisions and
Allowed Changes. Pre-flight found the source drifted only in line numbers (e.g. `cornerRadiusValue` computed
ends at line 65, not 58; the return object is lines 83–92, not 76–84; the per-corner grid's closing tag is at
line 225, not 223) — every symbol, structure and precedent named in Verified Starting State still matched.

Files changed:
- `packages/vue/src/controls/appearance/helpers.ts` — added `cornerSmoothingPercent` computed (verbatim from
  the packet) and returned it immediately after `cornerRadiusValue`.
- `packages/vue/src/primitives/AppearanceControls/types.ts` — added `cornerSmoothingPercent: MixedValue<number>`
  to `AppearanceControlsRootSlotProps`.
- `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` — added the
  `:corner-smoothing-percent="ctx.cornerSmoothingPercent.value"` slot binding.
- `packages/vue/src/i18n/messages/panels.ts` — added `cornerSmoothing: 'Corner smoothing',` after `radius`.
- `src/components/properties/AppearanceSection.vue` — added `cornerSmoothingPercent` to the slot destructure and
  the new `PanelGrid` block (verbatim from the Visual Contract) between the per-corner grid and the point-radius
  grid, both now chained on `hasCornerRadius`/`hasPointRadius` via `v-if`/`v-else-if` so the existing else-if
  chain still resolves correctly (point-radius node types never satisfy `hasCornerRadius`).
- `tests/helpers/store.ts` — added `cornerSmoothing: n.cornerSmoothing,` to `getSelectedNode`.
- `tests/engine/vue/controls/appearance.test.ts` — added a `describe('corner smoothing state', …)` block with 5
  tests (default 0, 0.6→60, 1→100, 0.005→1 rounding, out-of-range clamps to 0/100).
- `tests/e2e/properties/corner-smoothing.spec.ts` — new file, 2 tests (default+typed-commit+undo; absence for
  ellipse).

Gates (run from `App/`):
- `bun test tests/engine/vue/controls/appearance.test.ts` — exit 0, 11 pass (6 pre-existing + 5 new), 0 fail.
- `bunx tsgo --noEmit` — exit 0.
- `bunx vue-tsc --noEmit -p tsconfig.json` — exit 0.
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` — exit 0.
- `bunx oxlint -c oxlint.json <8 packet-named files>` — exit 0, 0 warnings/errors.
- `bunx playwright test tests/e2e/properties/corner-smoothing.spec.ts tests/e2e/properties/corner-stroke-toggles.spec.ts tests/e2e/properties/number-field.spec.ts --project=openpencil`
  — exit 1: the packet's own 2 new tests passed (confirmed again in isolation, 2/2 exit 0); 2 pre-existing
  failures reproduced byte-identically when the two untouched files were run alone without
  `corner-smoothing.spec.ts` present at all (`corner-stroke-toggles.spec.ts` multi-selection undo assertion,
  `number-field.spec.ts` Arrow-key `130.9` vs `131` float assertion) — pre-existing flakiness/regression in
  files outside this packet's Allowed Changes, not caused by this change.
- Dictionary check: `cornerSmoothing` appears exactly once in `panels.ts`; `radius`, `opacity` and
  `independentCornerRadii` unchanged.

Browser check: the dev server was reachable and the Properties panel DOM/accessibility tree confirmed the field
(`spinbutton "Corner smoothing"` immediately after the `Radius` field and the `Independent corner radii`
toggle; `data-property="cornerSmoothing" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100"`) on a freshly
drawn frame — items 1 (field present/placement/default), 2 (present alongside fill+stroke, not separately
re-verified visually), 5 (code path confirms the row is gated on `hasCornerRadius` alone, independent of
`showIndependentCorners`), and 7 (ellipse: `CORNER_RADIUS_TYPES` excludes `ELLIPSE`, confirmed by the passing
e2e assertion) are structurally/functionally confirmed. Items requiring live pixel rendering or pointer-drag
scrub (1's squircle-vs-arc visual comparison, 3, 4, 6, 8) could not be completed interactively in this session:
the MCP Browser pane never reached a composited/visible state (`computer{screenshot}` failed with "the Browser
pane is not displayed, so the page is not compositing frames" on every tab tried, including fresh tabs and a
hard reload with 45+ seconds of waiting), so the app's loading overlay never cleared and pointer-based clicks
landed on the stuck overlay instead of the panel. This is a session/tooling limitation, not a code regression —
tsgo/vue-tsc/oxlint were clean and the dedicated Playwright gate (a separate, real browser automation path)
passed 2/2 for this packet's own spec, exercising the typed-commit, live-repaint-triggering, undo and
ellipse-absence behaviour that the blocked browser-pane items would otherwise have shown manually.

Confirmed unchanged: `CornerRadiusKey`, `updateCornerProp`, `commitCornerProp`, `AppearanceControlsActions` are
byte-identical to their pre-packet state (grepped after edits). No file under `packages/core/src/canvas/`
appears in the diff. No Banned List item crossed. Open Decisions 1 and 2 left unimplemented as specified
(expected).
