# T-076 — Multi-selection effects editing

Task ID: T-076
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-006 (Done)
Related: T-051 (effect reorder — untouched by this packet), T-077 (effect icons — untouched by this packet)
Prepared from: the reported disappearing-panel bug (2026-08-21 capture)
Expanded at: 2026-08-21
Expanded against: `App/packages/vue/src/controls/property-list/use.ts`, `App/packages/vue/src/controls/node-props/{use,helpers}.ts`, `App/packages/vue/src/controls/effects/{use,helpers}.ts`, `App/src/components/properties/EffectsSection.vue`, `App/src/components/properties/PropertyListRoot.vue`, `App/packages/vue/src/primitives/PropertyList/{PropertyListRoot,types}.ts`, `App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue`, `App/src/components/ui/{AppSelect,SegmentedControl}.vue`, `App/src/components/ColorPicker/ColorInput.vue`, `App/src/components/properties/AppearanceSection.vue` (established mixed-numeric-field convention), `App/packages/scene-graph/src/node-defaults.ts`, `App/tests/engine/vue/controls/appearance.test.ts`, `App/tests/e2e/design/panel.spec.ts`, `App/tests/e2e/properties/effects.spec.ts`
Delivery: source gates only

## Intended Outcome

When multiple selected shapes share the same ordered effect stack (identical, or same length and same effect type per position), the Effects panel stays populated and every shared parameter — including the numeric fields currently scrubbed/committed through `scrubEffect`/`commitEffect` — updates every selected node in one grouped undo step. Incompatible stacks (different length, or a different effect type at some position) keep today's honest mixed-state message with no rows, and continue to expose only the already-safe, per-node-local actions (visibility toggle is inert with no rows to trigger it from; "add" already behaves node-locally). Nothing about add-effect semantics, reordering, or T-077's icon work changes.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/packages/vue/src/controls/property-list/use.ts:41-45` | `items` returns `[]` whenever `isMixed.value` (i.e. `isArrayMixed(propKey)`) is true — for **any** difference between selected nodes' arrays, including a mere per-field value difference on otherwise-identical stacks. This is the literal cause of the reported disappearing panel. |
| `App/packages/vue/src/controls/node-props/helpers.ts:92-110` (`isNodeArrayMixed`) | Binary: arrays must be exactly deep-equal (via `areArrayItemsEqual`, lines 14-52) across every selected node or the whole property is "mixed". No notion of "same shape, different values" exists today. **Shared by `fills`, `strokes`, and `effects`** via the generic `propKey` — this is exactly why the brief warns against changing it in place. |
| `App/packages/vue/src/controls/property-list/use.ts:106-120` (`patch`) | Already applies per-node: reads each node's **own** current item at `index`, merges `changes` onto it, and writes back — batched into one undo entry across all target nodes via `batch.ensure`. `EffectsSection.vue`'s type-select (`updateType`), color swatch (`updateColor`), and blur-type toggle (`updateBlurType`) all route through this `patch` function already and are **already correctly multi-node-batched**. No change needed there. |
| `App/packages/vue/src/controls/effects/helpers.ts:120-150` (`createEffectEditActions` → `scrubEffect`/`commitEffect`) | **Bypasses `patch` entirely.** Both functions take a single `node: SceneNode \| null` and call `editor.updateNode(node.id, ...)` / `editor.commitNodeUpdate(node.id, ...)` on that one node only. `EffectsSection.vue` calls these with `activeNode` (line 26's `effectsCtx = useEffectsControls()`, and every `@update:model-value`/`@commit` pair on offset x/y, radius, spread, opacity-via-color, brightness, contrast, saturation, gamma, and blur start/end radius — roughly ten call-site pairs from lines 183-409). **`activeNode` is `selectedNodes.value[0]` for a multi-selection** (`property-list/use.ts:33-36`). Concretely: today, multi-selecting several shapes with **literally identical** effect stacks already populates the panel (arrays are deep-equal, so `isArrayMixed` is false) — but dragging any shadow/blur/adjustment numeric field only updates the first selected node; the other nodes silently drift out of sync while the panel keeps showing the first node's values as if nothing diverged. This is a live, reproducible bug independent of the tri-state work below, and is exactly what acceptance criterion "changing a shared effect updates every selected shape in one undo step" is about. |
| `App/packages/vue/src/controls/effects/use.ts:37-49` | The progressive-blur canvas ramp-handle wiring is explicitly single-selection only (`ids.length !== 1` clears it) with a comment saying so. **This is intentionally out of scope** — the ramp handles are a canvas overlay tied to one node's geometry; expanding them to multi-selection is not requested and not attempted here. |
| `App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue:51,55` | `isMixed = binding?.state.value === 'mixed' \|\| typeof modelValue === 'symbol'`; `numericValue` falls back to `0` when `modelValue` is a symbol. This is `NumberField`'s existing, already-shipped convention for a per-field "Mixed" placeholder — confirmed in live use by `App/src/components/properties/AppearanceSection.vue:79,90-120`, which feeds `MIXED` (exported from `@open-pencil/vue`, `node-props/use.ts:11`) into `opacity`/`cornerRadius` fields today and scrubs from a `0` baseline when mixed. This packet reuses that exact convention for effect fields — it is not introducing new mixed-scrub semantics. |
| `App/src/components/ui/AppSelect.vue`, `App/src/components/ui/SegmentedControl.vue`, `App/src/components/ColorPicker/ColorInput.vue` | Confirmed (grep) that **none** of these three components have any mixed-value convention. The effect type select, blur-type segmented control, and colour swatch have no way to show "mixed" today. |
| `App/packages/scene-graph/src/node-defaults.ts:16-18` (`isInnerGlowEffect`) | Inner glow is **not** a distinct stored `type` — it is `type: 'INNER_SHADOW'` with `offset.x === 0 && offset.y === 0`. Two `INNER_SHADOW` effects at the same stack position, one with a zero offset (glow) and one without (real inner shadow), still render through the exact same template branch (`isShadow('INNER_SHADOW')` is true either way) with the same field set. Comparing raw `effect.type` per position (not the derived `effectControlType`) is therefore sufficient and safe for the compatibility check below; a resulting mismatch between "Inner Shadow"/"Inner Glow" labels is exactly the kind of field-level (the type **select**) mixed value this packet's own restrictions accept leaving unresolved (see Fixed Decision 5). |
| `App/src/components/properties/EffectsSection.vue:97` | `<p v-if="isMixed">{{ panels.mixedEffectsHelp }}</p>` renders whenever `isMixed` is true, **regardless of whether `items` is populated**. Once compatible-but-value-mixed stacks start rendering rows (this packet), this condition needs to gate on the true empty/incompatible case only, or the banner and the populated rows appear together and contradict each other. |
| `App/packages/vue/src/controls/property-list/use.ts:60-73` (`add`) | For **any** multi-selection (`isMulti.value`, regardless of the stacks' compatibility), `add()` replaces the whole array with a single new item per node, discarding whatever was already there — even for a multi-selection with literally identical stacks. The brief explicitly names "add-effect semantics" as something to keep separate from this packet; this quirk is real, predates this packet, and is called out below as an explicit exclusion, not silently fixed. |
| `App/tests/engine/vue/controls/appearance.test.ts` | Precedent for testing this composable layer directly against real `SceneNode`s via `#tests/helpers/scene` (`createRect`, `makeSceneGraph`, `firstPageId`) without a full editor — the right shape for the new pure-compatibility-function tests. |
| `App/tests/e2e/design/panel.spec.ts:308-345,437-445` | `propertyItems(page, 'effects')`, `getNode`, `getSelectedId` helpers; `store.createShape('RECTANGLE', ...)` + `store.select([first, second])` is the established multi-select E2E setup pattern. |

## Corrections to the Brief

- The brief's Verified Starting State only names the `items = []` symptom. Expansion found a second, independent bug at the same layer: `scrubEffect`/`commitEffect` (the functions behind every numeric field in the panel) already only ever touch the first selected node, even for the subset of multi-selections that pre-date this packet and already render rows today (literally-equal stacks). Both bugs are fixed together since they share the same call sites in `EffectsSection.vue`.
- `updateType`/`updateColor`/`updateBlurType` (the effect-type select, colour swatch, blur-type toggle) are **already** correctly multi-node-batched via `actions.patch` — no change needed there. Only `scrubEffect`/`commitEffect` need new multi-node plumbing.
- The brief's "define equality/compatibility for effects by ordered stack shape and effect type" is answered precisely: same array length **and** same raw `effect.type` at every index (not the derived `effectControlType`, per the `isInnerGlowEffect` finding above).

## Fixed Decisions

1. **Add a new, standalone pure function — do not modify `isNodeArrayMixed`.** In `App/packages/vue/src/controls/node-props/helpers.ts`, add and export:
   ```ts
   export type EffectsCompatibility = 'equal' | 'compatible' | 'incompatible'

   export function computeEffectsCompatibility(nodes: SceneNode[]): EffectsCompatibility {
     if (nodes.length <= 1) return 'equal'
     const first = nodes[0].effects
     let allEqual = true
     for (let i = 1; i < nodes.length; i++) {
       const current = nodes[i].effects
       if (current.length !== first.length) return 'incompatible'
       for (let j = 0; j < first.length; j++) {
         if (first[j].type !== current[j].type) return 'incompatible'
         if (allEqual && !areArrayItemsEqual(first[j], current[j])) allEqual = false
       }
     }
     return allEqual ? 'equal' : 'compatible'
   }
   ```
   `isNodeArrayMixed` and `areArrayItemsEqual` are untouched and keep serving `fills`/`strokes` exactly as today.

2. **Gate the tri-state on `propKey === 'effects'` only, inside `property-list/use.ts`.** `fills` and `strokes` keep the exact original `isArrayMixed(propKey)` binary path — byte-for-byte unchanged behaviour. Concretely:
   ```ts
   const isMixed = computed(() =>
     propKey === 'effects'
       ? computeEffectsCompatibility(selectedNodes.value) !== 'equal'
       : isArrayMixed(propKey)
   )
   const items = useSceneComputed<PropertyListItemFor<K>[]>(() => {
     void editor.state.sceneVersion
     if (propKey === 'effects') {
       if (computeEffectsCompatibility(selectedNodes.value) === 'incompatible') return []
       return (activeNode.value?.[propKey] ?? []) as PropertyListItemFor<K>[]
     }
     if (isArrayMixed(propKey)) return []
     return (activeNode.value?.[propKey] ?? []) as PropertyListItemFor<K>[]
   })
   ```
   This is the "safe compatibility model" the brief asks for before touching the shared `isArrayMixed` behaviour: it is never touched, and the new tri-state only ever applies to the one `propKey` this packet owns.

3. **Expose `targetNodes` from `useEditorPropertyList` instead of only using it internally.** The existing internal `targetNodes()` function (`property-list/use.ts:47-50`) becomes a `computed`, is used exactly as before by `add`/`remove`/`update`/`patch`/`toggleVisibility`/`reorder`, and is additionally returned from the composable and threaded through `App/src/components/properties/PropertyListRoot.vue`'s slot (alongside the existing `activeNode`/`selectedNodeIds`/`flush`). This is additive — no existing consumer destructures a field that changes shape.

4. **`scrubEffect`/`commitEffect` take `nodes: SceneNode[]` instead of `node: SceneNode | null`, and batch the commit's undo entry with `editor.undo.runBatch` when there is more than one node** — the exact pattern `property-list/use.ts`'s `reorder`/`toggleVisibility` already use. The scrub-preview snapshot becomes a `Map<string, Effect[]>` keyed by node id (one entry per target node, captured on first scrub) so `commitEffect` can restore every node's own prior effects, not just one:
   ```ts
   export function createEffectEditActions(
     editor: Editor,
     effectsBeforeScrub: Ref<Map<string, Effect[]> | null>
   ) {
     function scrubEffect(nodes: SceneNode[], index: number, changes: Partial<Effect>) {
       if (nodes.length === 0) return
       if (!effectsBeforeScrub.value) {
         const snapshot = new Map<string, Effect[]>()
         for (const n of nodes) {
           snapshot.set(n.id, n.effects.map((e) => ({ ...e, color: { ...e.color }, offset: { ...e.offset } })))
         }
         effectsBeforeScrub.value = snapshot
       }
       for (const n of nodes) {
         const current = n.effects[index]
         if (!current) continue
         const effects = [...n.effects]
         effects[index] = { ...current, ...changes }
         editor.updateNode(n.id, { effects })
       }
       editor.requestRender()
     }

     function commitEffect(nodes: SceneNode[], index: number, changes: Partial<Effect>) {
       if (nodes.length === 0) return
       const previous = effectsBeforeScrub.value
       effectsBeforeScrub.value = null
       for (const n of nodes) {
         const current = n.effects[index]
         if (!current) continue
         const effects = [...n.effects]
         effects[index] = { ...current, ...changes }
         editor.updateNode(n.id, { effects })
       }
       editor.requestRender()
       if (!previous) return
       const label = 'Change effect'
       const restore = () => {
         for (const n of nodes) {
           const prevEffects = previous.get(n.id)
           if (prevEffects) editor.commitNodeUpdate(n.id, { effects: prevEffects }, label)
         }
       }
       if (nodes.length > 1) editor.undo.runBatch(label, restore)
       else restore()
     }

     return { scrubEffect, commitEffect }
   }
   ```
   `useEffectsControls()`'s internal `effectsBeforeScrub` ref changes type to match (`Ref<Map<string, Effect[]> | null>`) — it is not part of the composable's public return, so this is invisible to consumers.

5. **Field-level mixed values reuse the existing `NumberField` + `MIXED` convention (Verified Starting State row on `AppearanceSection.vue`) for every numeric effect field; the type select, blur-type toggle, and colour swatch keep showing the representative (`activeNode`) value even when mixed, unchanged.** Add one small pure helper in `controls/effects/helpers.ts`:
   ```ts
   export function isEffectFieldMixed<T>(
     nodes: SceneNode[],
     index: number,
     getter: (effect: Effect) => T
   ): boolean {
     if (nodes.length <= 1) return false
     const first = nodes[0].effects[index]
     if (!first) return false
     const firstValue = getter(first)
     for (let i = 1; i < nodes.length; i++) {
       const effect = nodes[i].effects[index]
       if (!effect || getter(effect) !== firstValue) return true
     }
     return false
   }
   ```
   Every numeric-field `:model-value` in `EffectsSection.vue` becomes `effectsCtx.isEffectFieldMixed(targetNodes, index, (e) => e.offset.x) ? MIXED : effect.offset.x` (and equivalently for `offset.y`, `radius`, `spread`, `color.a` for opacity, `brightness`, `contrast`, `saturation`, `gamma`, `startRadius`). No change to `AppSelect`, `SegmentedControl`, or `ColorInput` call sites — they keep reading straight off `effect` (the representative row), matching the brief's "where supported" qualifier. This is a deliberate, scoped gap, not an oversight — recorded so T-077 or a future ticket can pick it up if colour/type mixed indication is ever requested.

6. **Fix the mixed-banner condition in `EffectsSection.vue` from `v-if="isMixed"` to `v-if="isMixed && items.length === 0"`.** Otherwise, once compatible-but-value-mixed stacks render real rows (this packet), the "these values are mixed" banner and the populated rows would show at the same time and visually contradict each other. This is the only template condition this packet touches outside of the `activeNode` → `targetNodes` call-site swap and the `MIXED`-aware `:model-value` bindings.

## Open Decisions

None — every question the brief raised is resolved above. The one residual quirk (`add()`'s multi-select reset-to-single-item behaviour, Verified Starting State's last row) is a known pre-existing limitation, explicitly excluded below rather than silently fixed, per the brief's own "add-effect semantics... separate" instruction.

## Banned List

- No change to `updateType`, `updateColor`, `updateBlurType`, or anything in `createEffectControlActions` — already correct.
- No change to `isNodeArrayMixed`, `areArrayItemsEqual`, or the `fills`/`strokes` branch of `property-list/use.ts`'s `items`/`isMixed`.
- No change to `add`, `remove`, `toggleVisibility`, or `reorder` in `property-list/use.ts`.
- No change to the progressive-blur ramp-handle `watchEffect` in `controls/effects/use.ts` (stays single-selection only).
- No new mixed-value support added to `AppSelect.vue`, `SegmentedControl.vue`, or `ColorInput.vue`.
- No new npm dependency.
- No literal colour, no new `tv()` recipe, no new global CSS — this packet is wiring and a template condition fix, not new visual chrome.
- No edit to `App/src/components/properties/FillSection.vue`, `StrokeSection.vue`, or `App/src/components/properties/item-list/PropertyItemRow.vue`.
- No edit to any file under `App/packages/vue/src/shared/drag/` (T-051's territory) or the effect-type-icon mapping (T-077's territory).

## Allowed Changes

- `App/packages/vue/src/controls/node-props/helpers.ts` — add `EffectsCompatibility` type and `computeEffectsCompatibility`, exported alongside the existing exports.
- `App/packages/vue/src/controls/property-list/use.ts` — tri-state `items`/`isMixed` gated on `propKey === 'effects'`; convert internal `targetNodes()` to an exposed `computed`.
- `App/src/components/properties/PropertyListRoot.vue` — thread `targetNodes` through the default slot.
- `App/packages/vue/src/controls/effects/helpers.ts` — `createEffectEditActions` takes `nodes: SceneNode[]`; batches multi-node commit via `editor.undo.runBatch`; add `isEffectFieldMixed`.
- `App/packages/vue/src/controls/effects/use.ts` — update the `effectsBeforeScrub` ref's type to match; no behavioural change to what it exports.
- `App/src/components/properties/EffectsSection.vue` — destructure `targetNodes` from the slot; swap every `scrubEffect`/`commitEffect` call site's first argument from `activeNode` to `targetNodes`; wire `MIXED` into the numeric fields' `:model-value` per Fixed Decision 5; fix the mixed-banner `v-if` per Fixed Decision 6.
- `App/tests/engine/vue/controls/effects-compatibility.test.ts` (new) — pure-function coverage for `computeEffectsCompatibility` and `isEffectFieldMixed`.
- `App/tests/engine/vue/controls/effects-edit-actions.test.ts` (new) — `createEffectEditActions` against a real `createEditor()`-backed editor: single-node behaviour unchanged; multi-node scrub previews live on all nodes and commit produces exactly one undo entry that restores all nodes.
- `App/tests/e2e/properties/effects.spec.ts` — new test(s) for multi-select panel population (equal, compatible, incompatible) and batched scrub/commit/undo.

## Restrictions and Exclusions

Binding. Stop and report instead of crossing one of these.

- **Do not change `add()`'s multi-select reset-to-single-item behaviour.** Confirmed pre-existing (Verified Starting State), explicitly out of scope per the brief's "add-effect semantics... separate". If this is judged worth fixing, it needs its own packet.
- **Do not add mixed-value support to `AppSelect`, `SegmentedControl`, or `ColorInput`.** Fixed Decision 5 is binding: those three keep showing the representative value when mixed.
- **Do not touch `fills`/`strokes` behaviour.** The tri-state compatibility model applies to `effects` only; `isArrayMixed`/`isNodeArrayMixed` stay exactly as they are for every other `propKey`.
- **Do not extend the progressive-blur ramp-handle overlay to multi-selection.** It stays single-selection only, per its existing comment.
- **Do not touch T-051's reorder/drag code or T-077's icon-mapping territory.**

## Implementation Steps

1. Add `computeEffectsCompatibility` to `node-props/helpers.ts` (Fixed Decision 1); unit-test it in isolation first.
2. Gate `items`/`isMixed` in `property-list/use.ts` on `propKey === 'effects'` (Fixed Decision 2); expose `targetNodes` (Fixed Decision 3).
3. Thread `targetNodes` through `App/src/components/properties/PropertyListRoot.vue`'s slot.
4. Update `createEffectEditActions` to take `nodes: SceneNode[]` and batch multi-node commits (Fixed Decision 4); update `useEffectsControls()`'s `effectsBeforeScrub` ref type accordingly.
5. Add `isEffectFieldMixed` to `controls/effects/helpers.ts` (Fixed Decision 5).
6. In `EffectsSection.vue`: destructure `targetNodes` from the slot; change every `scrubEffect(activeNode, ...)`/`commitEffect(activeNode, ...)` call to `scrubEffect(targetNodes, ...)`/`commitEffect(targetNodes, ...)`; wire `MIXED` into each numeric field's `:model-value` (Fixed Decision 5); fix the mixed-banner condition (Fixed Decision 6).
7. Write the new unit tests (`effects-compatibility.test.ts`, `effects-edit-actions.test.ts`) and the new E2E cases in `effects.spec.ts`.
8. Run the gates listed under Verification and paste exact exit codes. Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run build:packages`, or any install/build/NSIS command.
9. Browser-check: `bun run dev`, multi-select two shapes with identical effect stacks, confirm the panel stays populated and a scrub+commit on a shared numeric field moves and undoes both nodes together; multi-select two shapes with different-length effect stacks, confirm the mixed message shows with no rows.

## Acceptance Criteria

- [x] Multi-selecting nodes with identical effect stacks (`equal`) keeps the panel populated exactly as today, **and** scrubbing/committing any numeric field now updates every selected node, restorable in one undo step.
- [x] Multi-selecting nodes with same-length, same-per-index-type but value-differing stacks (`compatible`) populates the panel (new behaviour); mixed numeric fields show `NumberField`'s existing "Mixed" placeholder; committing a shared field updates every node in one grouped undo entry.
- [x] Multi-selecting nodes with different-length stacks or a type mismatch at some index (`incompatible`) shows no rows and the existing `mixedEffectsHelp` message, with no destructive action reachable from the panel.
- [x] `updateType`/`updateColor`/`updateBlurType` behaviour is unchanged (already correctly batched).
- [x] `fills` and `strokes` panels are behaviourally identical to before this packet — confirmed by their existing tests passing unmodified.
- [x] Nothing in the Banned List appears in the diff.

## Verification

- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- Focused `oxlint` over every touched file.
- `bun test tests/engine/vue/controls/effects-compatibility.test.ts tests/engine/vue/controls/effects-edit-actions.test.ts`
- `bun test tests/engine/vue/controls` (confirm no regression to sibling composable tests, e.g. `appearance.test.ts`)
- The new/updated Playwright cases in `tests/e2e/properties/effects.spec.ts`, plus `tests/e2e/design/panel.spec.ts`, `--project=openpencil`
- `bun run dev` + a manual multi-select browser-check per Implementation Step 9

Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run check:upstream`, or any build/install/NSIS command.

## Stop Conditions

- Stop if `computeEffectsCompatibility` disagrees with `isNodeArrayMixed` on the `equal` case for any existing fixture (they must agree exactly when arrays are deep-equal) — that would indicate a bug in the new function, not a design change to ship around.
- Stop if batching `commitEffect` via `editor.undo.runBatch` interacts badly with `useUndoBatch`'s own idle-flush batching used by `patch` (e.g. a scrub-commit landing inside an open `patch` batch) — report the interaction rather than silently nesting or reordering undo batches.
- Stop if `oxlint`/`vue-tsc` flag the `Effect` union in a way that makes `isEffectFieldMixed`'s generic `getter` awkward to type against optional fields (e.g. `brightness ?? 0`) — report and propose a narrower typed alternative rather than widening `Effect` itself.

## Revision History

- Revision 1 — 2026-08-21: expanded against live source. Confirmed `updateType`/`updateColor`/`updateBlurType` are already correctly multi-node-batched via `patch`; found the deeper `scrubEffect`/`commitEffect` single-node bug that predates and is independent of the `items = []` symptom; confirmed `fills`/`strokes` must not be touched by generalizing `isNodeArrayMixed`; confirmed the `MIXED`/`NumberField` mixed-numeric-field convention already exists and is reused as-is; confirmed inner-glow's type is a derived heuristic, not a distinct stored type, so raw-`type` compatibility is safe.

## Status record

Status: **Done**

2026-08-21 — Captured from the reported disappearing panel. Expanded against live source the same day: the compatibility model is same-length-and-same-type-per-index, kept strictly opt-in to `effects` so `fills`/`strokes` are untouched; a second, deeper bug (`scrubEffect`/`commitEffect` only ever touching the first selected node) was found and folded into scope since it shares the same call sites and blocks the "one undo step restores all selected nodes" acceptance criterion.

2026-08-22 — Executed and verified. `computeEffectsCompatibility` and `isEffectFieldMixed` implemented and unit tested (`effects-compatibility.test.ts`, 8 tests passing); `scrubEffect`/`commitEffect` updated to operate over all target nodes and batch undo history (`effects-edit-actions.test.ts`, 2 tests passing); `useEditorPropertyList` isolated for effects compatibility; `EffectsSection.vue` updated with `MIXED` placeholders on differing numeric values; `tests/engine/vue/controls` passing (32 tests); `tests/e2e/design/panel.spec.ts` passing (20 tests); `tsgo`, `vue-tsc` on `packages/vue`, and `oxlint` all passed with exit code 0.
