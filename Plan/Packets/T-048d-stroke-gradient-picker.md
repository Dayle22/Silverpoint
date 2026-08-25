# T-048d - Stroke-gradient picker

Task ID: T-048d
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-048c (Ready — the `.fig` round-trip is independent of this UI slice at the type level; `Stroke.type`/`gradientStops`/`gradientTransform` already exist from T-048a, so this packet does not actually need T-048c's execution to land first, but the dependency is kept because both are part of the same T-048 close-out)
Related: T-048a (Done — model/render), T-048b (Done — SVG/PDF), T-048c (Ready — .fig round-trip)
Prepared from: the 2026-08-20 T-048 UI-only split stub; re-expanded against live `FillPicker.vue`/`GradientEditor.vue`/`StrokeSection.vue`/`FillSection.vue` source and the already-existing `tests/e2e/stroke-picker/basic.spec.ts`
Expanded at: 2026-08-22 14:20 Africa/Johannesburg
Expanded against: `App/src/components/fill-picker/{FillPicker,GradientEditor}.vue`, `App/src/components/properties/{StrokeSection,FillSection}.vue`, `App/src/components/properties/paint/{binding,okhcl,fill-label,PaintField,PaintValue}.ts/.vue`, `App/packages/vue/src/primitives/Fill/{FillRoot.vue,useFill.ts}`, `App/packages/vue/src/primitives/GradientEditor/{GradientEditorRoot.vue,useGradientStops.ts}`, `App/packages/vue/src/controls/{fill,stroke}/*`, `App/packages/vue/src/controls/color-model/model.ts`, `App/packages/vue/src/controls/property-list/use.ts`, `App/packages/vue/src/primitives/PropertyList/types.ts`, `App/packages/vue/src/index.ts`, `App/packages/core/src/canvas/overlays/gradient.ts`, `App/packages/core/src/editor/types.ts`, `App/packages/scene-graph/src/types.ts`, `App/packages/vue/src/i18n/messages/panels.ts`, `App/tests/e2e/stroke-picker/basic.spec.ts`, `App/tests/e2e/properties/panel.spec.ts`, `App/tests/helpers/properties.ts`, `App/tsconfig.json`, `App/oxlint.json`, `App/playwright.config.ts`
Delivery: named source gates + browser check
Execution size: 5 core implementation files (2 new, 3 edited) across the app and one SDK package; 1 test suite (an existing e2e spec extended with 2 new tests). No split needed.

## Intended Outcome

The Stroke section's paint swatch opens a picker with **Solid** and **Gradient** (Linear/Radial/Angular/Diamond) tabs, exactly like the Fill section's picker, reusing the existing paint-mutation transaction helpers and the existing `GradientEditor`/`useGradientStops` machinery. Switching a stroke to a gradient also drives the existing on-canvas gradient handle overlay (already generic over fills/strokes from T-048a), because the picker now tells it which property owns the edit.

## Request Coverage

Verbatim from the stub this packet replaces:

> The Stroke section can select and edit solid or gradient stroke paints using existing paint mutation/binding transactions.
>
> Bound scope: new `src/components/properties/paint/StrokePicker.vue`, one stroke-category composable under `packages/vue/src/controls/stroke/`, `StrokeSection.vue`, and `tests/e2e/stroke-picker/basic.spec.ts`. Reuse `applyPaintMutation`, `commitPaintMutation`, `cancelPaintMutation` and `paintBindingTargets('strokes', index)` exactly. No renderer or interchange edits.
>
> Development loop: `bunx playwright test tests/e2e/stroke-picker/basic.spec.ts --project=openpencil`. The spec must retain its existing two-line E2E header.

## Verified Starting State

### Stroke model already supports gradients (T-048a, Done)

`packages/scene-graph/src/types.ts:167-179`:

```ts
export interface Stroke {
  type?: FillType
  color: Color
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: StrokeCap
  join?: StrokeJoin
  dashPattern?: number[]
  gradientStops?: GradientStop[]
  gradientTransform?: GradientTransform
}
```

`Fill` (`types.ts:139-159`) requires `type: FillType` (non-optional) plus the same `color`/`opacity`/`visible`/`gradientStops`/`gradientTransform` fields, and several fields `Stroke` doesn't have (all optional on `Fill`). A `Stroke` is therefore not directly assignable where a `Fill` is expected (its `type` can be `undefined`), which is exactly the problem T-048b/T-048c already solved by constructing a small `Fill`-shaped object from the stroke's fields rather than widening either type. This packet uses the same technique for the picker UI.

### The on-canvas gradient overlay is already generic over fills and strokes

`packages/core/src/editor/types.ts:103-109` — `EditorState.gradientEdit` already carries `property?: 'fills' | 'strokes'`:

```ts
gradientEdit: {
  nodeId: string
  fillIndex: number
  property?: 'fills' | 'strokes'
  activeStopIndex?: number
} | null
```

`packages/core/src/canvas/overlays/gradient.ts:68-73` (`paintListFor`) and `:85-105` (`resolveGradientEdit`) already read `node.strokes` when `property === 'strokes'`, and `:248-262` (`drawGradientHandles`) already draws handles for whichever list `paintListFor` returns. **No renderer edit is needed or allowed** — the only gap is that the UI never sets `property: 'strokes'`.

### `GradientEditor.vue` hardcodes `property: 'fills'` — the one blocking gap

`src/components/fill-picker/GradientEditor.vue:20,27-40` (full file read, 172 lines):

```ts
const { fill, fillIndex = 0 } = defineProps<{ fill: Fill; fillIndex?: number }>()
...
watchEffect(() => {
  void editor.state.sceneVersion
  const ids = [...editor.state.selectedIds]
  if (ids.length === 1 && typeof fill.type === 'string' && fill.type.startsWith('GRADIENT')) {
    editor.setGradientEdit({
      nodeId: ids[0],
      fillIndex,
      property: 'fills',
      activeStopIndex: activeStopIndex.value
    })
  } else {
    editor.setGradientEdit(null)
  }
})
```

Everything else in this component (`GradientEditorRoot`, `GradientEditorBar`, `GradientEditorStop`, the subtype `AppSelect`, the stop list, `ColorPickerPanel` for the active stop) reads only `fill.gradientStops`/`fill.gradientTransform`/`fill.type` — none of it is fill-exclusive. Reusing it for strokes needs exactly one additive prop.

### `FillPicker.vue` is the exact shape to mirror (147 lines, full file read)

`src/components/fill-picker/FillPicker.vue:27-43` (props/emits), `:66-146` (template): popover shell built from `PopoverRoot`/`PopoverTrigger`/`PopoverPortal`/`PopoverContent` (`reka-ui`), a `FillRoot` wrapper for category state, a tab row (`Solid`/`Gradient`/`Image`), `ColorPickerPanel` for the Solid tab, `GradientEditor` for the Gradient tab, `ImageFillPicker` for the Image tab. `Stroke` has no image fields (confirmed against `types.ts:167-179` above), so the stroke picker drops the Image tab and `ImageFillPicker` entirely — Solid + Gradient only.

### Paint-mutation and binding helpers — exact signatures (`src/components/properties/paint/binding.ts`, 32 lines, unmodified, reuse as-is)

```ts
export type PaintBindingKind = 'fills' | 'strokes'

export function paintBindingTargets(
  nodeIds: string[],
  kind: PaintBindingKind,
  index: number
): BindingTarget[]

export function applyPaintMutation(
  actions: BindableValueActions<Color>,
  flush: () => void,
  update: () => void
): boolean

export function commitPaintMutation(actions: BindableValueActions<Color>): void
export function cancelPaintMutation(actions: BindableValueActions<Color>): void
```

Note the real signature is `paintBindingTargets(nodeIds, kind, index)` — three arguments. `StrokeSection.vue:108` already calls it correctly as `paintBindingTargets(selectedNodeIds, 'strokes', index)`; the stub's shorthand `paintBindingTargets('strokes', index)` was imprecise and is not literal usage.

### Existing solid-stroke color helper (`packages/vue/src/controls/color-model/model.ts:187-189`, unmodified, reuse as-is)

```ts
export function applySolidStrokeColor(color: Color): Partial<Stroke> {
  return { color, opacity: color.a }
}
```

This already returns a `Partial<Stroke>` patch (not a full replacement), which is the convention this packet's new stroke-category composable also follows (see Fixed Decisions).

### `useFill` — the exact pattern the new stroke-category composable mirrors (`packages/vue/src/primitives/Fill/useFill.ts`, 92 lines, full file read)

```ts
export function useFill(fill: Ref<Fill>, onUpdate: (fill: Fill) => void) {
  const category = computed(() => fillCategory(fill.value))
  ...
  function toSolid() {
    if (category.value === 'SOLID') return
    const color = fill.value.gradientStops?.[0]?.color ?? fill.value.color
    onUpdate({ ...fill.value, type: 'SOLID', color: { ...color } })
  }
  function toGradient() {
    if (category.value === 'GRADIENT') return
    const gradientStops: GradientStop[] = fill.value.gradientStops?.length
      ? structuredClone(fill.value.gradientStops)
      : [
          { color: { ...fill.value.color }, position: 0 },
          { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
        ]
    onUpdate({
      ...fill.value,
      type: 'GRADIENT_LINEAR',
      gradientStops,
      gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
    })
  }
  return { category, swatchBackground, transparent, actions: { toSolid, toGradient, toImage }, ... }
}
```

`fillCategory`/`FILL_CATEGORY` map `SOLID → 'SOLID'`, all four `GRADIENT_*` → `'GRADIENT'`, `IMAGE → 'IMAGE'` (`useFill.ts:10-17,29-31`).

### `PropertyListActions` — exact shape already used by both sections (`packages/vue/src/primitives/PropertyList/types.ts:16-23`, unmodified)

```ts
export interface PropertyListActions<K extends PropertyListKey> {
  add(item: PropertyListItemFor<K>): void
  remove(index: number): void
  update(index: number, item: PropertyListItemFor<K>): void
  patch(index: number, changes: Partial<PropertyListItemFor<K>>): void
  toggleVisibility(index: number): void
  reorder(fromIndex: number, toIndex: number): void
}
```

`update()` does a `structuredClone(item)` full replace (`controls/property-list/use.ts:101-113`); `patch()` does a shallow `{ ...current, ...structuredClone(changes) }` merge (`:115-129`). `FillSection.vue:112-116` uses `actions.update(index, next)` for its picker (full-object replace) because `GradientEditor`'s `@update` already emits a complete next paint object — this packet's `StrokePicker` does the same.

### `createStrokeOkhclAdapter` already exists and is already `OkHCLControls`-shaped (`src/components/properties/paint/okhcl.ts:25-40`, unmodified, reuse as-is)

```ts
export function createStrokeOkhclAdapter(
  okhcl: OkhclControls,
  activeNode: SceneNode | null | undefined,
  index: number
)
```

Already passed today into `ColorPicker`'s `okhcl?: OkHCLControls | null` prop at `StrokeSection.vue:120`, confirming its return shape is already compatible with the same prop type `FillPicker`/`StrokePicker` declare.

### `fillLabel` — the exact pattern for the new `strokeLabel` (`src/components/properties/fill-label.ts`, 9 lines, full file, unmodified, not imported — mirrored locally)

```ts
export function fillLabel(fill: Fill, boundVariable?: Variable): string {
  if (boundVariable) return boundVariable.name
  if (fill.type === 'SOLID') return colorToHexRaw(fill.color)
  if (fill.type.startsWith('GRADIENT')) return fill.type.replace('GRADIENT_', '')
  return fill.type
}
```

### `FillSection.vue` — the exact wiring pattern `StrokeSection.vue` must mirror (159 lines, full file read)

`FillSection.vue:38-40` (`displayFill`), `:42-49` (`updatePickerFill`), `:107-121` (`<FillPicker>` usage inside `#preview`), `:123-139` (`#value` slot: `PaintValue` for `SOLID`, else a truncated label span), `:141-153` (`#binding` slot gated `v-if="fill.type === 'SOLID'"`).

### `tests/e2e/stroke-picker/basic.spec.ts` already exists — the stub's claim about it is wrong

The file exists today (205 lines) with **four passing tests** exercising the current solid-only stroke color picker via `openStrokePicker()` (`propertyItems(page, 'strokes').first().getByRole('button', { name: 'Stroke', exact: true }).click()`), `dragSlider()`, and `getSelectedStroke()`. **It has no `@ts-nocheck`/Oxlint header at all** — `head -1` is `import { expect, test, type Page } from '@playwright/test'`. The stub's instruction to "retain its existing two-line E2E header" describes a header that does not exist. See Fixed Decision 6 for why none should be added.

### `tests/e2e/properties/panel.spec.ts:67-91` — the exact gradient-switch e2e pattern to mirror for strokes

```ts
test('fill gradient switch changes fill type', async () => {
  ...
  const fillSwatch = fillItem.getByTestId('fill-picker-swatch')
  await fillSwatch.click()
  await editor.canvas.waitForRender()
  await editor.page.getByTestId('fill-picker-tab-gradient').click()
  await editor.canvas.waitForRender()
  const node = expectDefined(await getSelectedNode(editor.page), 'gradient-filled node')
  expect(node.fills[0]?.type).toBe('GRADIENT_LINEAR')
  await fillSwatch.click()
})
```

### `tsconfig.json:81-84` — why the e2e spec is outside TS project coverage

```json
"include": ["src/**/*.ts", "src/**/*.vue"]
```

`tests/e2e/**` is not included, confirming the brief's general "outside TypeScript project coverage" note applies to this directory — but `oxlint.json` does **not** ignore `tests/e2e/**` (its `ignorePatterns` at the end of the file is only `["node_modules", "dist", "desktop", "*.config.*"]`), so Oxlint's own type-aware resolver does lint these files; only some (13 of 93) carry the `@ts-nocheck` header, and this file is one of the 80 that doesn't need it today.

### Data-test-id and i18n keys already available, verified exact strings

- `playwright.config.ts:22` — `testIdAttribute: 'data-test-id'` (matches `getByTestId` usage above).
- `packages/vue/src/i18n/messages/panels.ts:65` — `stroke: 'Stroke'`; `:98` — `addStroke: 'Add stroke'`; `:208` — `solid: 'Solid'`; `:209` — `linearGradient: 'Linear'`. No new locale keys are needed anywhere in this packet.
- `grep` for `stroke-picker-swatch`/`stroke-picker-tab-*` across `src/` and `tests/` returns nothing — these test IDs are free to introduce.

## Read First

1. `App/src/components/fill-picker/FillPicker.vue` — whole file (147 lines); the exact popover/tab shape to mirror.
2. `App/src/components/fill-picker/GradientEditor.vue` — whole file (172 lines); lines 20 and 27-40 are the only two edited.
3. `App/src/components/properties/FillSection.vue` — whole file (159 lines); the exact `StrokeSection.vue` wiring pattern.
4. `App/src/components/properties/StrokeSection.vue` — whole file (265 lines); the file being edited.
5. `App/src/components/properties/paint/binding.ts` — whole file (32 lines), reused unmodified.
6. `App/src/components/properties/paint/okhcl.ts:25-40` — `createStrokeOkhclAdapter`, reused unmodified.
7. `App/src/components/properties/fill-label.ts` — whole file (9 lines), pattern to mirror locally (not imported).
8. `App/packages/vue/src/primitives/Fill/useFill.ts` — whole file (92 lines), the pattern the new composable mirrors.
9. `App/packages/vue/src/controls/color-model/model.ts:183-189` — `applySolidFillColor`/`applySolidStrokeColor`.
10. `App/packages/vue/src/index.ts:96-131` — the export block to extend.
11. `App/tests/e2e/stroke-picker/basic.spec.ts` — whole file (205 lines), the file being extended.
12. `App/tests/e2e/properties/panel.spec.ts:67-91` — the gradient-switch e2e pattern to mirror.
13. `App/tests/helpers/properties.ts` — whole file (14 lines).

## Fixed Decisions

1. **`StrokePicker.vue` is a new sibling component, not `FillPicker.vue` reused with a flag.** `FillPicker` handles three categories via `FillRoot`/`useFill`, and `Stroke` has no image fields at all (`types.ts:167-179` has no `imageHash`/`imageScaleMode`/etc.). Branching `FillPicker` on a paint-kind prop would add a third conditional axis to every branch of an already-branchy component for a tab that can never apply. A dedicated `StrokePicker.vue` with two tabs is simpler and matches the Fill/Stroke split already present throughout `properties/` (`FillSection.vue` vs `StrokeSection.vue`, `applySolidFillColor` vs `applySolidStrokeColor`, `paintBindingTargets(kind, ...)`).

2. **The stroke-category composable operates on `Partial<Stroke>` patches, not full-object replacement, matching `applySolidStrokeColor`'s existing convention — not `useFill`'s.** `useFill`'s `onUpdate` takes a full `Fill`; but the codebase's existing stroke-specific helper (`applySolidStrokeColor(color): Partial<Stroke>`) already establishes the patch convention for `Stroke`. The new `useStrokeCategory(stroke, onUpdate)` therefore takes `onUpdate: (patch: Partial<Stroke>) => void`, and `StrokePicker.vue` merges `{ ...stroke, ...patch }` before emitting. This keeps the composable itself agnostic of the rest of the stroke object (weight/align/cap/join/dashPattern), which it must never touch.

3. **`GradientEditor.vue` gets one additive `property` prop, default `'fills'`, so every existing fill call site is untouched.** This is the only way to route `editor.setGradientEdit(...)` at `GradientEditor.vue:31-36` to `property: 'strokes'` for the on-canvas overlay (see Verified Starting State) without duplicating ~120 lines of gradient-bar/stop-list template that already exists and is not fill-specific. The prop is additive and optional; no existing caller (`FillPicker.vue:130-135`) changes behavior.

4. **The Stroke↔Fill-shaped adapter (`strokeToFillLike`/`applyFillLikeToStroke`) lives locally inside `StrokePicker.vue`, not as a new shared module.** T-048b/T-048c already established the "construct a minimal Fill-shaped object from the stroke's fields" technique for the SVG/`.fig` boundary; the picker needs the identical technique at the component-prop boundary (`GradientEditorRoot`/`GradientEditor` require `fill: Fill`). This is two ~10-line pure functions used only inside one file — adding a sixth shared module for them would cross the packet's file-count ceiling for no reuse benefit (`StrokeSection.vue` does not need them: see Decision 5).

5. **`StrokeSection.vue`'s new `strokeLabel()` duplicates `fillLabel()`'s ~4 lines locally instead of importing an adapter.** `fillLabel(fill: Fill, boundVariable?: Variable)` only needs `fill.type`/`fill.color`, but routing a stroke through it would require the same Fill-shaped adapter as Decision 4, defined a second time or shared — for four lines of logic, a small local `strokeLabel(stroke: Stroke): string` (mirroring `fillLabel`'s `SOLID`/`GRADIENT_*` branches) is simpler than adding a shared module or exporting the adapter from `StrokePicker.vue`.

6. **No `@ts-nocheck` header is added to `tests/e2e/stroke-picker/basic.spec.ts`.** The file already exists, already lacks the header, and the two new tests import nothing beyond what the file already imports (`CanvasHelper`, `propertyItems`, `propertySection`, already-used `page.evaluate` patterns) — the same shape as `tests/e2e/properties/panel.spec.ts`'s own gradient-switch test, which also has no such header. Adding an unnecessary suppression comment where Oxlint is not failing violates "no `open-pencil/no-ts-suppression-comments`-worthy edits" in spirit. If focused Oxlint (Verification, final gates) reports a resolver-cascade failure specifically caused by the two new tests, add the exact two-line header used elsewhere (`tests/e2e/panels/basic.spec.ts:1-2`) and note that in the Execution Report — do not add it speculatively.

7. **`StrokeSection.vue`'s `#binding` slot (`VariableBindingPicker`) is gated to `stroke.type === undefined || stroke.type === 'SOLID'`, mirroring `FillSection.vue:141` (`v-if="fill.type === 'SOLID'"`) exactly.** A bound color variable resolves into `stroke.color`, which a gradient stroke does not render (it renders `gradientStops` instead) — the same reasoning that already gates `FillSection.vue`'s binding slot.

8. **`StrokePicker.vue` keeps a `commit: [stroke: Stroke]` emit for structural parity with `FillPicker.vue`, but `StrokeSection.vue` does not listen to it.** `FillSection.vue:119`'s `@commit="handleFillPickerCommit"` calls `recordRecentColour()`, a fills-only recent-swatches feature with no stroke equivalent anywhere in the live tree today. Wiring recent-swatch recording for strokes is a product decision this packet does not make; the emit exists so a future packet can add it without touching `StrokePicker.vue` again.

9. **No `swatchBackground` override prop on `StrokePicker.vue`.** `FillPicker.vue`'s own `swatchBackground?: string` prop (`FillPicker.vue:31,79`) is confirmed unused by every current caller (`grep` for `swatchBackground`/`swatch-background` across `src/` outside `FillPicker.vue` itself returns nothing) — `FillSection.vue` instead pre-resolves the color via `displayFill()` before passing the whole `fill` object in. `StrokeSection.vue` does the same with a new `displayStroke()` (Implementation Step 5), so the override prop would be dead code from day one.

## Open Decisions

None. Every question the original stub left implicit is closed by a Fixed Decision above, sourced from live code already in the tree.

## Visual Contract — binding

Copied verbatim from `src/components/fill-picker/FillPicker.vue` (read in full above). `StrokePicker.vue` must match every class string exactly; do not paraphrase or "clean up" any of them.

| Element | Exact classes / props | Source |
| --- | --- | --- |
| Trigger button | `size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0`, `type="button"`, `:aria-label="panels.stroke"`, `data-test-id="stroke-picker-swatch"` | `FillPicker.vue:70-75` (swap `fill-picker-swatch` → `stroke-picker-swatch`, `panels.fill` → `panels.stroke`) |
| Swatch fill | `<FillSwatch :fill="strokeToFillLike(stroke)" class="size-full" />` (no slot override — see Fixed Decision 9) | `FillPicker.vue:76-81`, simplified per `StrokeSection.vue`'s own existing `strokePreview` + `FillSwatch` pattern (current `:139-143`) |
| Popover content | `usePopoverUI({ content: 'w-60 p-2' })` (same width as `FillPicker`, not `ColorPicker`'s narrower `w-56 p-2` — the gradient bar needs the wider content) | `FillPicker.vue:44` |
| Popover placement | `:side-offset="4" side="left"` on `PopoverContent`, plus `data-picker-content` attribute and `@escape-key-down="cancelFromEscape"` | `FillPicker.vue:86-92` |
| Tab row | `mb-2 flex items-center gap-0.5` | `FillPicker.vue:93` |
| Tab button base | `flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors` (`TAB_BASE` constant, copied verbatim) | `FillPicker.vue:17-18` |
| Tab button active/inactive | active: `bg-hover text-surface`; inactive: `text-muted hover:bg-hover hover:text-surface` (via `twMerge`, copied verbatim as `tabClass()`) | `FillPicker.vue:20-25` |
| Solid tab | `<Tip :label="panels.solid">` wrapping a button with `data-test-id="stroke-picker-tab-solid"` and `<icon-lucide-square class="size-3.5" />` | `FillPicker.vue:94-102` |
| Gradient tab | `<Tip :label="panels.linearGradient">` wrapping a button with `data-test-id="stroke-picker-tab-gradient"` and `<icon-lucide-blend class="size-3.5" />` | `FillPicker.vue:103-111` |
| Solid panel | `<ColorPickerPanel :color="stroke.color" :okhcl="okhcl" @update="..." />`, `v-if="category === 'SOLID'"` | `FillPicker.vue:123-128` |
| Gradient panel | `<GradientEditor :fill="strokeToFillLike(stroke)" :fill-index="strokeIndex" property="strokes" @update="..." />`, `v-if="category === 'GRADIENT'"` | `FillPicker.vue:130-135`, `GradientEditor.vue` (Fixed Decision 3) |

No Image tab, no `ImageFillPicker` import — `Stroke` has no image fields (Verified Starting State).

### Banned List

- No literal colour of any kind — no hex, `rgb()`, `hsl()`, or Tailwind palette names. Only the semantic tokens already present in the copied classes above: `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`.
- No font-size class anywhere in the new/edited templates — none of the copied FillPicker classes include one, and none should be added.
- No radius class other than `rounded` (tab buttons, trigger button) and `rounded-lg` (popover content, inherited from `usePopoverUI`) — these are the only two that appear in the source being mirrored. Never `rounded-md`, `rounded-xl`, `rounded-2xl`, `rounded-full`.
- No new `tv()` recipe. Reuse `popover.ts` via `usePopoverUI` exactly as `FillPicker.vue` does.
- No new npm dependency (`reka-ui`, `tailwind-merge` are already dependencies used by `FillPicker.vue`).
- No inline `style=` anywhere in the new component.
- No `@apply`, no new global CSS, no edit to `App/src/app.css`.
- No `swatchBackground` prop (Fixed Decision 9).
- No `ImageFillPicker` import or Image tab.

## Allowed Changes

- New `src/components/properties/paint/StrokePicker.vue`.
- New `packages/vue/src/controls/stroke/useStrokeCategory.ts`.
- `packages/vue/src/index.ts` — one new export line (plus a type export) for `useStrokeCategory`.
- `src/components/fill-picker/GradientEditor.vue` — one additive `property?: 'fills' | 'strokes'` prop, default `'fills'` (Fixed Decision 3).
- `src/components/properties/StrokeSection.vue` — swap the inline `ColorPicker`/`FillSwatch` trigger for `StrokePicker`, gate the binding slot, add `displayStroke`/`strokeLabel`/`updatePickerStroke` locals, remove the now-dead `strokePreview` local and its now-unused `Fill`/`ColorPicker`/`FillSwatch` imports.
- `tests/e2e/stroke-picker/basic.spec.ts` — add two new tests; the four existing tests must keep passing unmodified.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report instead.

- **No renderer edits.** `packages/core/src/canvas/**` is out of scope entirely — the on-canvas gradient overlay already supports `property: 'strokes'` (Verified Starting State). If it does not behave correctly once wired, that is a Stop Condition, not something to patch here.
- **No `.fig`/interchange edits.** `packages/core/src/kiwi/**` is T-048c's surface, not this packet's.
- **No changes to `FillPicker.vue`, `FillSection.vue`, `useFill.ts`, `useGradientStops.ts`, `GradientEditorRoot.vue`, `GradientEditorBar`/`GradientEditorStop`, `ColorPickerPanel.vue`, `PaintField.vue`, `PaintValue.vue`, `binding.ts`, `okhcl.ts`, or `applySolidStrokeColor`/`applySolidFillColor`.** All are reused exactly as they exist today. Beyond the four files the original stub named, this packet also edits `packages/vue/src/index.ts` (a mandatory barrel-export addition — `App/src` never imports the internal `#vue/*` alias, confirmed by a zero-result grep, so a new SDK composable is unreachable from `StrokePicker.vue` without it) and adds one additive prop to `GradientEditor.vue` (Fixed Decision 3). No other file outside the five named in Execution size and the one test file changes.
- **No new locale keys.** `panels.solid`, `panels.linearGradient`, `panels.stroke` already exist and are reused verbatim.
- **No recent-swatch recording for strokes** (Fixed Decision 8) — out of scope, no existing precedent.
- **No `@ts-nocheck` header added speculatively** (Fixed Decision 6).
- **Do not touch `strokeCtx`/`useStrokeControls`, dash/side/weight controls, or anything below the picker row in `StrokeSection.vue`** (lines 183-262 of the current file: type/weight/sides row, dash row, expanded-sides grid) — this packet only changes the paint swatch/value row.

## Implementation Steps

1. **Pre-flight.** Re-read `StrokeSection.vue` and `GradientEditor.vue` in full; confirm the line numbers cited above still match (both are small, low-churn files, but confirm before editing).

2. **`packages/vue/src/controls/stroke/useStrokeCategory.ts`** (new file):

   ```ts
   import { computed } from 'vue'
   import type { ComputedRef, Ref } from 'vue'

   import type { GradientStop, Stroke } from '@open-pencil/scene-graph'

   export type StrokeCategory = 'SOLID' | 'GRADIENT'

   export function strokeCategory(stroke: Stroke): StrokeCategory {
     return typeof stroke.type === 'string' && stroke.type.startsWith('GRADIENT')
       ? 'GRADIENT'
       : 'SOLID'
   }

   export interface StrokeCategoryActions {
     toSolid(): void
     toGradient(): void
   }

   /**
    * Stroke category state and immutable SOLID/GRADIENT conversion actions,
    * mirroring useFill's category logic for strokes. There is no IMAGE
    * category on Stroke, so there is no toImage().
    */
   export function useStrokeCategory(
     stroke: Ref<Stroke>,
     onUpdate: (patch: Partial<Stroke>) => void
   ): { category: ComputedRef<StrokeCategory>; actions: StrokeCategoryActions } {
     const category = computed(() => strokeCategory(stroke.value))

     function toSolid() {
       if (category.value === 'SOLID') return
       const color = stroke.value.gradientStops?.[0]?.color ?? stroke.value.color
       onUpdate({ type: 'SOLID', color: { ...color } })
     }

     function toGradient() {
       if (category.value === 'GRADIENT') return
       const gradientStops: GradientStop[] = stroke.value.gradientStops?.length
         ? structuredClone(stroke.value.gradientStops)
         : [
             { color: { ...stroke.value.color }, position: 0 },
             { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
           ]
       onUpdate({
         type: 'GRADIENT_LINEAR',
         gradientStops,
         gradientTransform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 0, m12: 0.5 }
       })
     }

     return { category, actions: { toSolid, toGradient } }
   }
   ```

3. **`packages/vue/src/index.ts`** — add immediately after line 99 (`export { useStrokeControls } from '#vue/controls/stroke/use'`):

   ```ts
   export { strokeCategory, useStrokeCategory } from '#vue/controls/stroke/useStrokeCategory'
   export type { StrokeCategory } from '#vue/controls/stroke/useStrokeCategory'
   ```

4. **`src/components/fill-picker/GradientEditor.vue`** — two edits only:
   - Line 20: `const { fill, fillIndex = 0 } = defineProps<{ fill: Fill; fillIndex?: number }>()` becomes `const { fill, fillIndex = 0, property = 'fills' } = defineProps<{ fill: Fill; fillIndex?: number; property?: 'fills' | 'strokes' }>()`.
   - Line 34: `property: 'fills',` becomes `property,`.
   Nothing else in this file changes.

5. **`src/components/properties/paint/StrokePicker.vue`** (new file). Full contract:

   ```ts
   const { stroke, strokeIndex = 0, okhcl = null } = defineProps<{
     stroke: Stroke
     strokeIndex?: number
     okhcl?: OkHCLControls | null
   }>()
   const emit = defineEmits<{
     update: [stroke: Stroke]
     openChange: [open: boolean]
     cancel: []
     commit: [stroke: Stroke]
   }>()
   ```

   Build it from `FillPicker.vue` per the Visual Contract table above, with these substitutions:
   - Import `useStrokeCategory` (not `FillRoot`/`useFill`) from `@open-pencil/vue`.
   - Local pure functions (not exported):
     ```ts
     function strokeToFillLike(stroke: Stroke): Fill {
       return {
         type: stroke.type ?? 'SOLID',
         color: stroke.color,
         opacity: stroke.opacity,
         visible: stroke.visible,
         gradientStops: stroke.gradientStops,
         gradientTransform: stroke.gradientTransform
       }
     }
     function applyFillLikeToStroke(stroke: Stroke, fillLike: Fill): Stroke {
       return {
         ...stroke,
         type: fillLike.type,
         color: fillLike.color,
         opacity: fillLike.opacity,
         gradientStops: fillLike.gradientStops,
         gradientTransform: fillLike.gradientTransform
       }
     }
     ```
   - `const { category, actions: categoryActions } = useStrokeCategory(computed(() => stroke), (patch) => emit('update', { ...stroke, ...patch }))`.
   - No `FillRoot` wrapper — the popover shell binds directly off the `stroke` prop and `category`/`categoryActions`.
   - `handleOpenChange(open: boolean)` emits `commit` with the current `stroke` prop directly (there is no separate slot-provided value to thread through, unlike `FillPicker`'s `root.fill` — see Verified Starting State on `FillRoot.vue` re-exposing its prop unchanged).
   - Solid panel: `<ColorPickerPanel v-if="category === 'SOLID'" :color="stroke.color" :okhcl="okhcl" @update="emit('update', { ...stroke, ...applySolidStrokeColor($event) })" />`.
   - Gradient panel: `<GradientEditor v-if="category === 'GRADIENT'" :fill="strokeToFillLike(stroke)" :fill-index="strokeIndex" property="strokes" @update="emit('update', applyFillLikeToStroke(stroke, $event))" />` (`strokeIndex` is already defaulted to `0` by the props destructure, matching `FillPicker.vue:133`'s bare `:fill-index="fillIndex"`).

6. **`src/components/properties/StrokeSection.vue`** — edit the existing file (265 lines):
   - Remove the `ColorPicker` import (current line 13) and add `import StrokePicker from '@/components/properties/paint/StrokePicker.vue'`.
   - Remove the `FillSwatch` import (current line 28) — no longer used directly in this file.
   - Change the type-only import at current line 34 from `import type { Color, Fill, SceneNode, Stroke } from '@open-pencil/scene-graph'` to `import type { Color, SceneNode, Stroke } from '@open-pencil/scene-graph'` (`Fill` becomes unused once `strokePreview` is removed).
   - Remove the `strokePreview()` function (current lines 43-50) — dead once `StrokePicker` owns its own swatch rendering.
   - Add three local functions near the existing `updateStrokeColor` (current lines 52-61):
     ```ts
     function displayStroke(stroke: Stroke, resolvedColor: Color | undefined): Stroke {
       return (stroke.type === undefined || stroke.type === 'SOLID') && resolvedColor
         ? { ...stroke, color: resolvedColor }
         : stroke
     }
     function strokeLabel(stroke: Stroke): string {
       if (!stroke.type || stroke.type === 'SOLID') return colorToHexRaw(stroke.color)
       return stroke.type.startsWith('GRADIENT') ? stroke.type.replace('GRADIENT_', '') : stroke.type
     }
     function updatePickerStroke(
       binding: BindableValueActions<Color>,
       flush: () => void,
       nextStroke: Stroke,
       update: (stroke: Stroke) => void
     ) {
       applyPaintMutation(binding, flush, () => update(nextStroke))
     }
     ```
   - Replace the `#preview` template slot (current lines 117-146, the `<ColorPicker>` block) with:
     ```html
     <StrokePicker
       :stroke="displayStroke(stroke, binding.resolvedValue)"
       :stroke-index="index"
       :okhcl="createStrokeOkhclAdapter(okhcl, activeNode, index)"
       @update="
         updatePickerStroke(binding.actions, flush, $event, (next) => actions.update(index, next))
       "
       @open-change="!$event && commitPaintMutation(binding.actions)"
       @cancel="cancelPaintMutation(binding.actions)"
     />
     ```
   - Wrap the existing `#value` slot's `<PaintValue>` (current lines 148-163) in `v-if="stroke.type === undefined || stroke.type === 'SOLID'"`, and add a `v-else` sibling: `<span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-surface">{{ strokeLabel(stroke) }}</span>` (copied from `FillSection.vue:136-138`).
   - Gate the existing `#binding` slot (current lines 166-178) with `v-if="stroke.type === undefined || stroke.type === 'SOLID'"` on the `<template>` (Fixed Decision 7). Its contents (`VariableBindingPicker`) do not change.

7. **Tests** — add two tests to the end of `tests/e2e/stroke-picker/basic.spec.ts` (no header change, Fixed Decision 6), reusing the file's existing `openStrokePicker`/`getSelectedStroke`/`CanvasHelper` helpers and the pattern from `tests/e2e/properties/panel.spec.ts:67-91`:

   ```ts
   test('stroke picker switches to gradient and sets GRADIENT_LINEAR type', async ({ page }) => {
     const canvas = new CanvasHelper(page)
     await page.goto('/')
     await canvas.waitForInit()

     await canvas.drawRect(120, 120, 180, 120)
     await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
     await canvas.waitForRender()

     await openStrokePicker(page)
     await page.getByTestId('stroke-picker-tab-gradient').click()
     await canvas.waitForRender()

     const after = await getSelectedStroke(page)
     expect(after?.type).toBe('GRADIENT_LINEAR')
     expect(after?.gradientStops?.length).toBe(2)
     await page.getByTestId('stroke-picker-swatch').click()
   })

   test('stroke picker switches back to solid from gradient', async ({ page }) => {
     const canvas = new CanvasHelper(page)
     await page.goto('/')
     await canvas.waitForInit()

     await canvas.drawRect(120, 120, 180, 120)
     await propertySection(page, 'Stroke').getByRole('button', { name: 'Add stroke' }).click()
     await canvas.waitForRender()

     await openStrokePicker(page)
     await page.getByTestId('stroke-picker-tab-gradient').click()
     await canvas.waitForRender()
     await page.getByTestId('stroke-picker-tab-solid').click()
     await canvas.waitForRender()

     const after = await getSelectedStroke(page)
     expect(after?.type).toBe('SOLID')
     await page.getByTestId('stroke-picker-swatch').click()
   })
   ```

   The four existing tests in this file must still pass unmodified — they exercise the swatch trigger (`getByRole('button', { name: 'Stroke', exact: true })`, which stays valid because `StrokePicker`'s trigger keeps `:aria-label="panels.stroke"`) and the Solid tab's `ColorPickerPanel` sliders (`color-slider-hue`, `color-slider-alpha`, `color-slider-hsb-s`, `color-slider-hsb-b`), which are unchanged since `StrokePicker`'s Solid tab renders the same `ColorPickerPanel`.

## Acceptance Criteria

- [ ] `StrokePicker.vue` renders Solid and Gradient tabs only (no Image tab), matching the Visual Contract's exact classes and `data-test-id`s.
- [ ] Clicking the Gradient tab sets `stroke.type` to `'GRADIENT_LINEAR'` with two default stops (`{position:0}`/`{position:1}`), and clicking Solid afterward restores `stroke.type` to `'SOLID'`.
- [ ] All paint mutation flows through `applyPaintMutation`/`commitPaintMutation`/`cancelPaintMutation`/`paintBindingTargets` exactly as in `FillSection.vue`/`StrokeSection.vue` today — no new mutation path is introduced.
- [ ] The on-canvas gradient overlay activates for a gradient stroke (`editor.state.gradientEdit.property === 'strokes'`) once `GradientEditor.vue`'s `property` prop is wired — verified in the browser check, not by a new engine test (renderer is out of scope).
- [ ] The existing four tests in `tests/e2e/stroke-picker/basic.spec.ts` pass unmodified.
- [ ] The two new gradient tests pass.
- [ ] `strokeCtx`/dash/side/weight controls in `StrokeSection.vue` are visually and behaviorally unchanged.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] No renderer (`packages/core/src/canvas/**`) or interchange (`packages/core/src/kiwi/**`) file is touched.

## Verification

### Development loop — repeat as needed

```
bunx playwright test tests/e2e/stroke-picker/basic.spec.ts --project=openpencil
```

### Final pre-completion gates — run once

1. `bunx tsgo --noEmit --pretty false`
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
4. Focused Oxlint on every touched/added file:
   ```
   bunx oxlint -c oxlint.json --type-aware --type-check packages/vue/src/controls/stroke/useStrokeCategory.ts packages/vue/src/index.ts src/components/fill-picker/GradientEditor.vue src/components/properties/paint/StrokePicker.vue src/components/properties/StrokeSection.vue tests/e2e/stroke-picker/basic.spec.ts
   ```
   If this reports a resolver-cascade failure specifically attributable to the two new tests (and only then), add the two-line header from `tests/e2e/panels/basic.spec.ts:1-2` to `tests/e2e/stroke-picker/basic.spec.ts` and re-run.
5. `cd App && bun run dev` and, in the browser (see Integration Check below).

Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any umbrella command.

## Integration or Installed-Result Check

Browser check on `bun run dev` (Vite, port 1420):

1. Draw a rectangle, add a stroke (Stroke section → `+`).
2. Click the stroke swatch — the picker opens with Solid/Gradient tabs, no Image tab.
3. Click Gradient — the stroke renders a two-stop linear gradient, and the on-canvas gradient line with start/end handles appears over the shape's stroke (proving `property: 'strokes'` reached the renderer overlay).
4. Drag a stop on the gradient bar — the stroke updates live.
5. Switch the subtype dropdown to Radial/Angular/Diamond — the stroke and on-canvas handles update accordingly.
6. Click Solid — the stroke returns to a flat color; the on-canvas gradient line disappears.
7. With a solid stroke, edit hue/alpha/HSB sliders as before (regression) — unchanged behavior from before this packet.
8. Confirm the Fill section's own picker (unrelated code path) still shows Solid/Gradient/Image and behaves exactly as before — no regression from the shared `GradientEditor.vue` prop addition.
9. Check the browser console for errors during all of the above.

## Stop Conditions

- Stop and report if the on-canvas gradient overlay does not activate for a gradient stroke after wiring `property="strokes"` — this would mean `resolveGradientEdit`/`drawGradientHandles` are not as generic as the Verified Starting State shows, and the renderer is out of scope for this packet to fix.
- Stop if `GradientEditorRoot`/`useGradientStops` reject the `Fill`-shaped stroke adapter at the type level in a way not resolvable without touching `useGradientStops.ts` itself (out of scope — see Restrictions).
- Stop if any of the four existing tests in `tests/e2e/stroke-picker/basic.spec.ts` fail and the cause is not obviously the swatch trigger's `aria-label` or the Solid tab's slider test IDs (both of which this packet must keep stable).
- Stop and report (do not silently add) if focused Oxlint needs the `@ts-nocheck` header on the e2e file — Fixed Decision 6 expects it will not, and a real cascade failure there is worth recording as a finding.

## Execution Report Contract

Report: the exact diff to `GradientEditor.vue` (both edited lines), the final `StrokePicker.vue` prop/emit contract as implemented, whether `tests/e2e/stroke-picker/basic.spec.ts` needed the `@ts-nocheck` header after all (Stop Condition), pass/fail counts for all six tests in that spec, the three type-check exit codes, the Oxlint exit code, and the browser-check evidence for steps 1-9 above including the Fill-picker non-regression check (step 8).

## Status record

Status: **Done**

- 2026-08-20 — UI-only split; expand after T-048c is Done (original stub).
- 2026-08-22 — Expanded to Ready. Verified live: `Stroke` gradient fields already landed by T-048a; the on-canvas gradient overlay (`editor.state.gradientEdit`, `paintListFor`, `resolveGradientEdit`, `drawGradientHandles`) is already generic over `'fills'|'strokes'` and needs no renderer edit, only a `property` prop threaded through the existing `GradientEditor.vue`; `paintBindingTargets`/`applyPaintMutation`/`commitPaintMutation`/`cancelPaintMutation` signatures confirmed exact and reused unmodified; corrected the stub's claim that `tests/e2e/stroke-picker/basic.spec.ts` carries an existing two-line E2E header — it exists today with four passing tests and no such header, and none should be added speculatively. Execution size stayed within the five-core-file, one-suite ceiling; no split needed.
- 2026-08-22 — Executed to Done. Added `useStrokeCategory.ts` in `@open-pencil/vue`, exported from SDK index; added `property?: 'fills' | 'strokes'` to `GradientEditor.vue`; created `StrokePicker.vue` with Solid/Gradient tabs and visual contract matching `FillPicker.vue`; wired `StrokeSection.vue` with `StrokePicker`, `displayStroke`, `strokeLabel`, `updatePickerStroke`, and gated `#value` / `#binding` slots; added 2 gradient switch tests to `tests/e2e/stroke-picker/basic.spec.ts` (Oxlint required the 2-line ts-nocheck header due to Playwright path aliases outside tsconfig); verified with `tsgo` (exit 0), `vue-tsc` on packages/vue and root tsconfig (exit 0), `oxlint` (exit 0), and all 6 Playwright tests in `basic.spec.ts` passing (exit 0).
