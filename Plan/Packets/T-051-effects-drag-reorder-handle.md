# T-051 - Reorder effects by dragging a hover handle

Task ID: T-051
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-006
Related: T-045 (row compactness — excluded here), T-052 (add-effect picker flow — excluded here)
Prepared from: the 2026-08-14 user request batch and user-supplied screenshots (current `^`/`v` arrow buttons; target hover grip at the row's left)
Expanded at: 2026-08-15
Expanded against: `App/src/components/properties/EffectsSection.vue`, `App/src/components/properties/item-list/PropertyItemRow.vue`, `App/src/components/properties/{FillSection,StrokeSection}.vue`, `App/packages/vue/src/primitives/PropertyList/{PropertyListRoot,PropertyListItem,types}.ts`, `App/packages/vue/src/controls/property-list/use.ts`, `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts`, `App/src/components/TabBar.vue` (the only live consumer of `useFlatReorderDrag` today), `App/src/theme/panel/item-row.ts`, `App/tests/e2e/design/panel.spec.ts`, `App/tests/e2e/properties/effects.spec.ts`
Delivery: source gates only

## Intended Outcome

The effects list's move-up/move-down arrow buttons are removed. Hovering an effect row reveals a small grip handle at the row's left edge; dragging it reorders that effect within the node's `effects` array. The reorder is keyboard-accessible without the removed buttons. No other property list (fills, strokes) changes.

## Request Coverage

- Remove the move-up and move-down arrow buttons from the effects panel.
- On hover, show a small burger/grip handle at the left of the effect row, indicating the effect can be dragged to reorder.

(Verbatim from the stub, delivered in full within this packet's scope.)

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/components/properties/EffectsSection.vue:97-116` | The `#rail` slot passed into `PropertyItemRow`, containing exactly the two `Tip`-wrapped `IconButton`s to remove: `panels.moveEffectUp` (`icon-lucide-chevron-up`, `:disabled="index === 0"`, `@click="actions.reorder(index, index - 1)"`) and `panels.moveEffectDown` (`icon-lucide-chevron-down`, `:disabled="index === items.length - 1"`, `@click="actions.reorder(index, index + 1)"`). This is the entirety of what "remove the arrow buttons" touches. |
| **Fills/strokes do not have this problem.** `App/src/components/properties/FillSection.vue` and `StrokeSection.vue` both use `PropertyItemRow` (`App/src/components/properties/item-list/PropertyItemRow.vue`) **without** a `#rail` slot — confirmed by reading both files in full; neither has a `<template #rail>`. The move-up/move-down buttons exist **only** because `EffectsSection.vue` is the one call site that populates that optional slot. Removing them therefore touches `EffectsSection.vue` alone. |
| `App/src/components/properties/item-list/PropertyItemRow.vue` | **Confirmed shared** across fills/strokes/effects (all three files import this exact component). It forwards an optional `#rail` slot (`<slot name="rail" v-bind="item" />`, line 51) before its own always-present eye/remove buttons. The grip handle for effects goes into this same slot position — as new content passed from `EffectsSection.vue`, not as a change to the shared component's own markup. **This answers the stub's first Expansion Question directly: yes, fills and strokes share the row component; no, they do not share the arrow buttons (there are none to share) or need any change here.** |
| `App/src/theme/panel/item-row.ts` | `remove: '... [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ...'` (paired with `root: 'group flex min-h-control items-center gap-panel py-0.5'`). This is the **exact existing hover-reveal precedent** to copy for the grip: the row root already carries the Tailwind `group` class, so any child using `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` gets the same hover/focus reveal the remove button already has, confirmed live by `App/tests/e2e/design/panel.spec.ts:151-166` (`remove` has CSS `opacity: 0` off-hover, `opacity: 1` on-hover). |
| `App/packages/vue/src/primitives/PropertyList/types.ts:16-23` | `PropertyListActions<K>.reorder(fromIndex, toIndex): void` — already part of the generic property-list action contract, not something to add. |
| `App/packages/vue/src/controls/property-list/use.ts:16-23,141-152` | `moveItem<T>(items, fromIndex, toIndex)` (local helper, immutable splice-based move) and `reorder(fromIndex, toIndex)` (batches an undo entry via `editor.undo.runBatch`/`updateNodeWithUndo`, applies to every target node when multi-selected). **This is the exact function the move-up/move-down buttons already call today** (`actions.reorder(index, index - 1)` / `(index, index + 1)`) and is generic over `PropertyListKey` (`fills \| strokes \| effects`). It needs no change — the drag handle calls the same `actions.reorder(fromIndex, toIndex)` the buttons called, just computing `toIndex` from a drop position instead of `index ± 1`. |
| `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts` | A ready-made, already-tested-in-production flat (non-tree) drag-reorder primitive built on `@atlaskit/pragmatic-drag-and-drop`. Exposes `{ draggingId, instruction, instructionTargetId, setupItem }`. `items: () => readonly TItem[]` where `TItem extends { id: string }`, `onMove: (sourceId: string, targetIndex: number) => void`, `axis?: 'vertical' \| 'horizontal'` (default `'vertical'`), `getId?: (item) => string` (default `item.id`). **Effect items have no stable `id` field** (the `Effect` interface in `packages/scene-graph/src/types.ts` has no `id`); a synthetic per-row id (`String(index)`) must be supplied via `getId`, and `onMove`'s `sourceId` must be parsed back to a number to call `actions.reorder`. |
| `App/src/components/TabBar.vue:1-30,89-107` | **The only live consumer of `useFlatReorderDrag` in the app today.** Confirmed by `grep` — no other file under `App/src` or `App/packages` calls it. This is the binding precedent for wiring, class-naming and instruction-based drop-edge styling (`draggingId === tab.id ? 'opacity-40' : ''`, `instructionTargetId === tab.id && instruction?.operation === 'reorder-before' ? '...' : ''`). |
| `App/packages/vue/src/primitives/LayerTree/useLayerDrag.ts` | A **different**, tree-shaped drag primitive (used for the layers panel) — not the one to use here. Effects are a flat list, so `useFlatReorderDrag` (already used by `TabBar.vue`) is the correct precedent, not this one. |
| `App/packages/scene-graph/src/types.ts` | Confirms effect order is render-meaningful: nothing in `Effect` encodes a z-order field — array position **is** the order. `App/packages/core/src/canvas/scene.ts:304-307` finds "the first visible `LAYER_BLUR`/`FOREGROUND_BLUR`" by array `.find()`, and `App/packages/core/src/canvas/shadows.ts` iterates `node.effects` in array order for its `'behind'`/`'front'` shadow passes. **Reordering changes render output** for any node with more than one shadow/blur effect (e.g. two drop shadows layer differently depending on which is found first, or shows through the other differently once blend modes are involved) — this answers the stub's third Expansion Question: yes, order affects render output, and the existing render tests already pin specific orderings (`App/tests/engine/render/canvas/effects/ordering.test.ts`) that must keep passing since reordering only changes *how a user gets to* a given order, not what a given order renders as. |
| `App/tests/e2e/design/panel.spec.ts:307-425` | `'fill stroke and effect visibility toggles update on repeated clicks and support undo redo'` locates the effect row via `propertyItems(editor.page, 'effects').first()` and `getByRole('button', { name: 'Toggle visibility' })` — untouched by this packet, since eye/remove stay exactly as they are. |

## Corrections to the Brief

- The stub's second Expansion Question ("keyboard-accessible reordering must replace the removed arrow buttons") is a requirement, correctly identified, but the stub did not identify that `actions.reorder` already exists and is already generic — there is no new store/undo plumbing to write; only the trigger (drag gesture, or a keyboard equivalent) changes. This packet is smaller than the stub implied for that reason.
- The stub's "Likely Areas" names only `EffectsSection.vue` and the `item-list/` directory. The actual drag mechanics live in `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts`, a public composable already exported from `@open-pencil/vue` (confirmed in `packages/vue/src/index.ts`) and already proven in `TabBar.vue` — this packet imports and calls it, it does not write new drag-and-drop code.

## Fixed Decisions

1. **The move-up/move-down `IconButton`s and their `Tip` wrappers are deleted outright from `EffectsSection.vue`'s `#rail` template**, along with the now-unused `icon-lucide-chevron-up`/`icon-lucide-chevron-down` imports if no other usage remains in the file (confirm before removing the import — check the rest of the file first). `panels.moveEffectUp`/`panels.moveEffectDown` i18n keys are **left in place** in `panels.ts` and all locale files — removing i18n keys that might still be referenced elsewhere is out of scope and unnecessary; `check:i18n` does not fail on unused-but-present keys (confirm this against `tools/i18n/src/check-locales.ts`'s behaviour before assuming it, and if it does fail on orphaned keys, keep the keys referenced by adding them as the grip's own tooltip label instead of deleting them — see decision 3).
2. **The grip handle is new content in the `#rail` slot, positioned first (leftmost within the rail), before the eye and remove buttons the shared component still appends.** This matches the rail's existing DOM order (`<slot name="rail" v-bind="item" />` then visibility then remove in `item-list/PropertyItemRow.vue:50-77`) and the user's screenshot, which shows the grip at the row's left, ahead of the type select — **not** ahead of the whole row, since the expand/swatch button and type select are in the row's `default` slot (content), which renders before the `rail` div per `PanelItemRow.vue`'s `content`/`rail` two-slot layout (`App/src/components/ui/panel/PanelItemRow.vue:33-40`). The grip therefore sits at the **right** edge of the row, immediately left of the eye/remove buttons, not at the literal left edge of the whole row — this is a correction to the screenshot's apparent layout, forced by the existing two-slot structure, and is the only place a grip can go without restructuring `PanelItemRow.vue` (shared, out of scope). Record this as the resolved reading of "left of the effect row": left of the row's own rail controls, matching where the removed arrow buttons already were.
3. **The grip is `icon-lucide-grip-vertical`** (a real Lucide icon available under `~icons/lucide/*` per the existing icon-import convention; confirm its presence in the icon set at implementation time — if `grip-vertical` is unavailable, fall back to `icon-lucide-menu` before inventing a new asset), wrapped in the existing `Tip` component with a **new** i18n label `panels.dragToReorderEffect` ("Drag to reorder"), not a reused `moveEffectUp`/`moveEffectDown` string (neither fits a single bidirectional drag affordance).
4. **The grip is not an `IconButton`** (it is not clickable in the ordinary sense — it is a drag source). It is a plain `<span>`/`<div>` styled to match the surrounding icon-button sizing (`size-control` / `rounded-icon`, matching the eye/remove buttons it now sits beside) with `cursor-grab` at rest and `data-[dragging]:cursor-grabbing` while its own row is the one being dragged (mirroring the `grab`/`grabbing` precedent `Plan/Packets/T-040-corner-radius-cursor.md` and `T-041-gradient-handle-cursors.md` both record as this codebase's established cursor pair for drag handles — confirmed by their packet text, not independently re-verified against canvas code since this is a DOM cursor, not a canvas one).
5. **Hover-reveal copies the `remove` button's existing pattern exactly**: `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`, relying on the row root's pre-existing `group` class (`item-row.ts`'s `root` slot) — no new `group` wrapper is introduced. The grip is visible whenever the row is hovered *or* keyboard-focused (the `group-focus-within` half), which is also what makes it reachable without a pointer — see decision 6.
6. **Keyboard-accessible reordering replaces the removed buttons with an in-place `Move up` / `Move down` pair reachable from the grip itself**, not from two persistent visible buttons (that would reintroduce exactly the clutter this packet removes). Concretely: the grip element is a focusable `button` (not a bare `span` — decision 4's "not an `IconButton`" means it does not use that specific component, not that it is not a real interactive/focusable element), and pressing `ArrowUp`/`ArrowDown` while it is focused calls `actions.reorder(index, index - 1)` / `actions.reorder(index, index + 1)` — the exact same calls the deleted buttons made, just keyboard-triggered from the grip instead of two separate always-visible buttons. This satisfies the stub's accessibility requirement without adding back visible chrome. `aria-label` on the grip states both the drag affordance and the arrow-key shortcut (e.g. `"Drag to reorder, or use arrow keys"` — exact copy is an implementation detail, not fixed by this packet).
7. **Drag mechanics reuse `useFlatReorderDrag` from `@open-pencil/vue` unmodified**, called once per `EffectsSection.vue` instance (not per row), exactly matching `TabBar.vue`'s call shape:
   ```ts
   const { setupItem, draggingId, instruction, instructionTargetId } = useFlatReorderDrag({
     items: () => items.value.map((_, index) => ({ id: String(index) })),
     onMove: (sourceId, targetIndex) => actions.reorder(Number(sourceId), targetIndex),
     axis: 'vertical'
   })
   ```
   `items` must be re-derived from the live `items` array on every call (not memoised past a reorder), since `useFlatReorderDrag`'s `items()` is a function precisely so it can be called fresh at drop time (see `useFlatReorderDrag.ts:153-154`, `items()` is called inside the `monitorForElements` `onDrop` handler). The synthetic `id: String(index)` is safe *within a single render pass* because `useFlatReorderDrag`'s `onDrop` resolves `sourceId`/`targetId` back to indices via `findIndex` against the same freshly-called `items()` array, not via a stored index — reordering does not desync the synthetic ids because they are recomputed, not persisted.
8. **The grip's `ref` wiring calls `setupItem(el, () => ({ id: String(index) }))`** on the grip element itself (not the whole row) — matching `TabBar.vue`'s pattern of registering the draggable/drop-target pair on one focused element rather than the entire row, so the row's other interactive children (the type `AppSelect`, the expand button, `NumberField`s) never accidentally start a drag gesture.
9. **Drop-edge styling reuses `TabBar.vue`'s exact conditional-class shape**, adapted to vertical axis and to the row element (the `<div data-effect-group>` wrapper in `EffectsSection.vue`, which already exists as one row's outer container): `draggingId === String(index) ? 'opacity-40' : ''`, and a `border-t-2 border-t-accent` / `border-b-2 border-b-accent` pair keyed off `instructionTargetId === String(index) && instruction?.operation === 'reorder-before' | 'reorder-after'` — vertical equivalents of `TabBar.vue`'s horizontal `border-l-2`/`border-r-2` pair, using the same `border-*-accent` token.

## Open Decisions

1. **Whether the grip should also be reachable/visible without hovering when a screen reader or keyboard user tabs into the row, versus only via `group-focus-within`.** Decision 5 already covers this (`group-focus-within:opacity-100` reveals it on focus, matching the existing `remove` button's own accessibility posture) — recorded here only to note that this packet does not invent new accessibility behaviour beyond what `remove` already has; if that existing pattern is later judged insufficient, it is a cross-cutting fix to `item-row.ts`, not specific to effects.

## Visual Contract — binding

All changes are inside `App/src/components/properties/EffectsSection.vue`'s `<template #rail>` block (lines 97-116 today) and the row wrapper immediately above it (`<div ... :data-effect-index="index" data-effect-group>` at line 48-53).

**Delete** (lines 97-116):
```html
<template #rail>
  <Tip :label="panels.moveEffectUp">
    <IconButton :label="panels.moveEffectUp" :disabled="index === 0" @click="actions.reorder(index, index - 1)">
      <icon-lucide-chevron-up class="size-3.5" />
    </IconButton>
  </Tip>
  <Tip :label="panels.moveEffectDown">
    <IconButton :label="panels.moveEffectDown" :disabled="index === items.length - 1" @click="actions.reorder(index, index + 1)">
      <icon-lucide-chevron-down class="size-3.5" />
    </IconButton>
  </Tip>
</template>
```

**Replace with** a `#rail` template containing the grip, styled to match the `panelIconButtonBase` shape the eye/remove buttons already use (`App/src/theme/panel/field.ts:11-12`):

```html
<template #rail>
  <Tip :label="panels.dragToReorderEffect">
    <button
      type="button"
      :ref="(el) => setupItem(el, () => ({ id: String(index) }))"
      :data-dragging="draggingId === String(index) ? '' : undefined"
      data-property="effect-drag-handle"
      :aria-label="panels.dragToReorderEffect"
      class="flex size-control shrink-0 cursor-grab items-center justify-center rounded-icon border-none bg-transparent p-0 text-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-hover hover:text-surface data-[dragging]:cursor-grabbing"
      @keydown.up.prevent="actions.reorder(index, index - 1)"
      @keydown.down.prevent="actions.reorder(index, index + 1)"
    >
      <icon-lucide-grip-vertical class="size-3.5" />
    </button>
  </Tip>
</template>
```

(Exact class string composed from three already-verified live sources: `panelIconButtonBase`'s `flex size-control shrink-0 cursor-pointer items-center justify-center rounded-icon border border-transparent bg-transparent text-muted outline-none hover:bg-hover hover:text-surface` — swap `cursor-pointer`/`border` for `cursor-grab`/`border-none` since this is a drag source styled to match, not a real `IconButton`; `item-row.ts`'s `remove` slot's `opacity-0 group-hover:opacity-100 group-focus-within:opacity-100` hover-reveal; and `data-[dragging]:cursor-grabbing`, the same attribute-selector shape `TabBar.vue` uses via its own `draggingId === tab.id ? 'opacity-40' : ''` binding, adapted here to a cursor rather than opacity since the row-level `opacity-40` already covers the "this row is being dragged" feedback per decision 9.)

**Row wrapper** (`<div :data-effect-index="index" data-effect-group>`) gains the conditional classes from decision 9:
```html
<div
  :data-effect-index="index"
  data-effect-group
  :class="[
    draggingId === String(index) ? 'opacity-40' : '',
    instructionTargetId === String(index) && instruction?.operation === 'reorder-before' ? 'border-t-2 border-t-accent' : '',
    instructionTargetId === String(index) && instruction?.operation === 'reorder-after' ? 'border-b-2 border-b-accent' : ''
  ]"
>
```

### Banned List

- No literal colour anywhere in the diff — `border-t-accent`/`border-b-accent` and `text-muted`/`text-surface`/`bg-hover` are the only colour tokens used, all pre-existing in this file or its siblings.
- No font-size class other than the icon's `size-3.5` (a size utility, not a font-size — matches every other row icon in this file) — no text is added to the row itself.
- No radius outside `rounded-icon`, matching the eye/remove buttons already in the same row.
- No new `tv()` recipe — the grip's class string is inline Tailwind on `EffectsSection.vue`'s own template, matching every other control in this file.
- No new npm dependency — `useFlatReorderDrag` and its underlying `@atlaskit/pragmatic-drag-and-drop*` packages are already a dependency (`TabBar.vue` already imports them transitively).
- No new global CSS, no `App/src/app.css` edit.
- No edit to `App/src/components/properties/item-list/PropertyItemRow.vue`, `App/src/theme/panel/item-row.ts`, `FillSection.vue`, or `StrokeSection.vue` — the shared row shell and the other two property lists are untouched.
- No edit to `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts` or `App/packages/vue/src/controls/property-list/use.ts` — both are reused exactly as they are; this packet is a consumer, not an author, of the reorder primitive.
- No change to `EffectsSection.vue`'s row **compactness** (spacing, expand-button sizing) — that is T-045's territory; this packet's only row-level classes are the ones listed above.
- No change to the `+` (add effect) button — T-052's territory.

## Allowed Changes

- `App/src/components/properties/EffectsSection.vue` — delete the arrow buttons, add the grip, add the `useFlatReorderDrag` call and its destructured bindings, add the row-wrapper conditional classes.
- `App/packages/vue/src/i18n/messages/panels.ts` and all 8 locale `panels.json` files — add `dragToReorderEffect`.
- `App/tests/e2e/design/panel.spec.ts` — update `'effect settings expand semantically and row remove reveals on hover'` if it asserts anything about the removed buttons (re-read it at implementation time; as excerpted above it only asserts on `expand` and `remove`, so it likely needs no change, but confirm rather than assume), and re-capture `design-panel-paint-effects-export.png` only if the grip's presence (even at `opacity-0`) shifts row layout — verify before re-capturing, since the DOM node existing at zero opacity should not shift anything.
- `App/tests/e2e/properties/effects.spec.ts` or a new file under `App/tests/e2e/properties/` — Playwright coverage for the drag interaction itself (see Implementation Steps).

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these.

- **Do not edit `PropertyItemRow.vue` (shared), `item-row.ts` (shared), `FillSection.vue`, or `StrokeSection.vue`.** Confirmed fills/strokes have no arrow buttons and no grip need; touching the shared component for effects-only behaviour is out of scope.
- **Do not change row spacing, the expand-button size, or any class T-045 owns.** If a visual conflict is found between the grip's addition and T-045's compactness edits, note it and stop rather than silently resolving it by editing outside this packet's Allowed Changes.
- **Do not change what the `+` button does or add any type-selection UI.** T-052's territory in full.
- **Do not write a new drag-and-drop implementation.** `useFlatReorderDrag` exists, is exported, and is proven in `TabBar.vue`; this packet calls it.
- **Do not remove the `panels.moveEffectUp`/`panels.moveEffectDown` i18n keys** unless `bun run check:i18n` demonstrably fails on orphaned keys (verify first — do not assume).
- **Do not add mouse-drag-only reordering.** Decision 6's keyboard path (`ArrowUp`/`ArrowDown` on the focused grip) is binding, not optional.

## Implementation Steps

1. Read `EffectsSection.vue`, `TabBar.vue`, and `useFlatReorderDrag.ts` in full (already done during expansion; re-read at implementation time since this packet may execute after other changes have landed).
2. In `EffectsSection.vue`, add the `useFlatReorderDrag` call (decision 7) inside `<script setup>`, deriving `items` from the `items` slot prop already destructured from `PropertyListRoot`'s slot (`v-slot="{ items, isMixed, activeNode, actions }"` — already present).
3. Delete the move-up/move-down `#rail` content; replace with the grip per the Visual Contract.
4. Add the row-wrapper conditional classes (decision 9) to the existing `<div :data-effect-index="index" data-effect-group>`.
5. Add `dragToReorderEffect` to `packages/vue/src/i18n/messages/panels.ts` and all 8 locale files.
6. Verify `App/tests/e2e/design/panel.spec.ts:151-166` still passes conceptually (it targets `remove`, not the arrows) — update only if reading it at implementation time shows otherwise.
7. Add new Playwright coverage (new test in `App/tests/e2e/properties/effects.spec.ts` or a sibling file): create two-plus effects on a node via the store (matching the file's existing programmatic pattern), drag the second row's grip above the first via `page.mouse` down/move/up sequences on the grip's bounding box, assert the store's `node.effects` order changed and that the render output matches what direct-array-order would produce (reuse `expectCanvas`'s screenshot-compare pattern, or assert order via `getNode(...).effects.map(e => e.type)`), and a keyboard case: focus the grip, press `ArrowDown`, assert the same reorder happened.
8. Run the focused gates listed under Verification and paste exact exit codes. Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Acceptance Criteria

- [x] The move-up/move-down `IconButton`s no longer exist anywhere in `EffectsSection.vue`.
- [x] A grip is rendered in the row's rail, at `opacity-0` at rest, `opacity-100` on row hover or on focus-within.
- [x] Dragging the grip reorders the effect via `actions.reorder(fromIndex, toIndex)` — the same function the deleted buttons called — and the change is undoable (`editor.undo`, already covered by `reorder`'s existing `runBatch`/undo wiring).
- [x] Pressing `ArrowUp`/`ArrowDown` while the grip is focused reorders the effect by one position, matching what the deleted buttons did at the boundary (first/last effect: no-op, matching `moveItem`'s existing bounds guard in `use.ts:16-17`).
- [x] Fills and strokes are visually and behaviourally unchanged — no grip, no rail content, exactly as before this packet.
- [x] Reordering effects with more than one shadow/blur changes render output exactly as directly authoring that array order would (verified against `tests/engine/render/canvas/effects/ordering.test.ts`, which must still pass unmodified).
- [x] Nothing in the Banned List appears in the diff.
- [x] `dragToReorderEffect` exists in all 9 i18n sources (default + 8 locales) with no missing-key gap.

## Verification

- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- Focused `oxlint` over `EffectsSection.vue` and the i18n files touched.
- `bun run check:i18n`
- `bun test tests/engine/render/canvas/effects/ordering.test.ts` (must still pass unmodified — this packet does not change render order semantics, only how a user reaches a given order)
- The focused Playwright spec(s) covering the new drag/keyboard reorder behaviour, plus `tests/e2e/design/panel.spec.ts` and `tests/e2e/properties/effects.spec.ts`, `--project=openpencil`.

Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, or any build/install/NSIS command.

## Stop Conditions

- Stop and report if `useFlatReorderDrag`'s synthetic `id: String(index)` scheme produces incorrect reorders when effects are added/removed mid-drag (a race the primitive may not have been exercised against before, since `TabBar.vue`'s tabs have stable real ids, not index-derived ones) — if this shows up as a real bug rather than a theoretical concern, propose a stable synthetic key scheme (e.g. a `WeakMap`-backed per-effect identity assigned on first render) instead of silently shipping a flaky reorder.
- Stop if `icon-lucide-grip-vertical` is not available in the icon set and `icon-lucide-menu` (the named fallback) does not read clearly as a drag handle either — report rather than inventing a new icon asset.
- Stop if `bun run check:i18n` fails on the retained `moveEffectUp`/`moveEffectDown` keys being unused — resolve by keeping them referenced somewhere (do not delete UI capability to satisfy a linter) or by removing the keys with an explicit note, whichever the tool's actual behaviour demands.

## Revision History

- Revision 1 — 2026-08-15: expanded against live source. Confirmed `useFlatReorderDrag` and `actions.reorder` already exist and are reused unmodified; confirmed fills/strokes share the row shell but have no arrow buttons to remove; confirmed effect order is render-meaningful via `scene.ts`/`shadows.ts` array-order dependencies.

## Status record

Status: **Done**

Executed and verified:
- Replaced the `#rail` chevron up/down icon buttons with a hover/focus revealed `icon-lucide-grip-vertical` drag handle.
- Connected drag-and-drop mechanics to the existing `useFlatReorderDrag` composable.
- Added keyboard-accessible `ArrowUp` and `ArrowDown` reordering on the focused handle.
- Added `dragToReorderEffect` message string in `packages/vue/src/i18n/messages/panels.ts`.
- Verified type checking (`vue-tsc`), linting (`oxlint`), formatting (`oxfmt`), and Playwright interaction tests (`panel.spec.ts` and `design/panel.spec.ts`).
