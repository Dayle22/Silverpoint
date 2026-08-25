# T-084b - Stylus object movement with held-finger modifiers

Task ID: T-084b
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: **T-084a — hard execution dependency; execute and re-verify its `CanvasInputModifiers`, `mergeCanvasModifiers` and returned `inputModifiers` before editing**
Related: T-084c, T-084d
Prepared from: the user's 2026-08-24 Affinity Publisher iPad reference: the stylus drags objects while one or more held fingers alter the gesture
Expanded at: 2026-08-24 09:38 Africa/Johannesburg
Expanded against: `App/packages/vue/src/shared/input/select.ts:76-94`, `select/move.ts:31-82`, `move.ts:48-108,121-190`, `duplicate-drag.ts:7-50`, `types.ts:26-40`, `App/packages/vue/src/canvas/useCanvasInput.ts:517-605`, `App/tests/engine/vue/input/move-threshold.test.ts`, and the T-084a contract
Delivery: named source gates + browser check
Execution size: 4 core implementation files; 1 new focused engine test file; one selection-move responsibility, under the size ceiling

## Intended Outcome

With Select active, a stylus selects and drags one or many objects exactly as a mouse does. During that same drag, one eligible held finger constrains travel to 45-degree increments, two held fingers switch the gesture live to duplicate-and-drag, and three held fingers combine constrained duplicate movement. Releasing modifier fingers before the stylus lifts reverses only the modifier effect, without corrupting selection, history or originals.

## Request Coverage

- Stylus tap selects; stylus drag moves the selected object(s).
- One held finger = constrain.
- Two held fingers = duplicate.
- Three held fingers = constrain + duplicate.
- Finger modifiers may be pressed or released after the stylus drag has begun.

## Verified Starting State

| Path | Symbol / span | Binding use |
| --- | --- | --- |
| `packages/vue/src/shared/input/select.ts` | `handleSelectDown` (`23-94`) | Pointer-compatible selection already starts `createSelectionMoveDrag`; no special stylus branch is required. |
| `packages/vue/src/shared/input/move.ts` | `handleMoveMove`, `handleMoveUp` | Move preview, snap, drop target, reparent and undo ownership remain authoritative. |
| `packages/vue/src/shared/input/duplicate-drag.ts` | `duplicateAndDrag` | Existing clone/selection/undo contract must be generalised, not duplicated. |
| `packages/vue/src/shared/input/types.ts` | `DragMove` | Already records duplication and previous selection, but cannot restore a live duplicate toggle. |
| `packages/vue/src/canvas/useCanvasInput.ts` | move dispatch at `551-553` | Currently passes only Ctrl bypass; this becomes the T-084a merged modifier snapshot. |

Exact revised call:

```ts
export interface MoveInputModifiers {
  constrain: boolean
  alternate: boolean
  bypass: boolean
}

export function handleMoveMove(
  d: DragMove,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  modifiers?: Partial<MoveInputModifiers>
): void
```

Extend `DragMove` with `duplicateSourceOriginals?: Map<string, DragOriginal>`. Reuse its existing `duplicatedPreviousSelection` field.

## Read First

1. `packages/vue/src/shared/input/move.ts` — `handleMoveMove` and `handleMoveUp` (`48-190`).
2. `packages/vue/src/shared/input/duplicate-drag.ts` — whole file.
3. `packages/vue/src/shared/input/select/move.ts` — `createSelectionMoveDrag` (`58-82`).
4. `packages/vue/src/canvas/useCanvasInput.ts` — move dispatch (`545-553`).

## Fixed Decisions

1. No separate stylus move implementation. Pen uses existing hit testing, lock handling, auto-layout, snapping, drop targeting, reparenting and undo.
2. Constrain by quantising `atan2(dy, dx)` to `Math.PI / 4`, retaining the raw vector length. Zero distance stays zero.
3. A two-finger alternate modifier is live/reversible. On activation after the drag threshold: restore sources to their originals, clone each selected tree once using the existing naming route, store the source originals, select clones, then apply the current gesture delta to clones. On deactivation: delete only those uncommitted clones, restore the source selection/original map, and continue moving sources at the current delta.
4. Never clone below `MOVE_DRAG_START_THRESHOLD_PX`; a modifier hold plus stylus tap creates nothing.
5. On stylus up while alternate remains active, preserve existing `commitDuplicateMove`; if alternate was released, preserve ordinary `commitMoveWithReparent`.
6. After constrain and snap resolve the applied delta, write `d.currentX = d.startX + dx` and `d.currentY = d.startY + dy`. `handleMoveUp` must commit the applied preview rather than the raw pen position.
7. Ctrl/Meta and the T-084a `bypass` continue to disable snapping only; do not overload finger counts with bypass.
8. Additive selection, resize, rotate, shape creation and node-handle modifiers are deferred. This packet is object movement only.

## Allowed Changes

- `App/packages/vue/src/shared/input/types.ts` — only the one live-duplicate restoration field.
- `App/packages/vue/src/shared/input/duplicate-drag.ts` — factor reusable activate/deactivate helpers around existing cloning logic.
- `App/packages/vue/src/shared/input/move.ts` — modifier contract, constrained delta and live alternate transitions.
- `App/packages/vue/src/canvas/useCanvasInput.ts` — merge keyboard/T-084a state at the move dispatch only.
- New `App/tests/engine/vue/input/move-modifiers.test.ts`.

## Restrictions and Exclusions

- Do not change selection hit testing, auto-layout rules, snapping tolerances, reparent rules, graph cloning, command IDs or history APIs.
- No UI; T-084c owns feedback.
- No resize/rotation/drawing modifiers or PWA/tablet shell work.
- No new dependency, build, install, version, Git or plan-index change.

## Implementation Steps

1. Re-verify T-084a's exact exports and returned ref; stop on drift.
2. Extend `DragMove`, then refactor `duplicate-drag.ts` so initial mouse Alt duplication and live finger duplication share clone/name/selection logic.
3. Add pure `constrainMoveDelta(dx, dy)` and live alternate transitions to `handleMoveMove`; preserve the current early auto-layout branch and all drop/snap cleanup.
4. In `useCanvasInput`, call `mergeCanvasModifiers(e, inputModifiers.value)` for `d.type === 'move'` and pass only `{ constrain, alternate, bypass }`.
5. Add `move-modifiers.test.ts`, mirroring adjacent input-test imports. Cover 8-direction constraint, live duplicate on/off, modifier-before-threshold, constrained duplicate, single undo after commit, source selection restoration and mouse Alt compatibility.

## Acceptance Criteria

- [ ] Stylus selection/movement uses the existing move path.
- [ ] One finger constrains to 45-degree increments.
- [ ] Two fingers toggle a duplicate live without leaving orphan clones.
- [ ] Three fingers combine both behaviours.
- [ ] No movement creates no duplicate or undo record.
- [ ] Finger release before pen-up returns to ordinary movement safely.
- [ ] Snapping, auto-layout, reparenting and mouse Alt-drag remain intact.

## Verification

### Development loop — repeat as needed

From `App/`: `bun test tests/engine/vue/input/move-modifiers.test.ts`

### Final pre-completion gates — run once

1. `bun test tests/engine/vue/input/move-threshold.test.ts tests/engine/editor/drag-reparent.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check packages/vue/src/shared/input/types.ts packages/vue/src/shared/input/duplicate-drag.ts packages/vue/src/shared/input/move.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/vue/input/move-modifiers.test.ts`

## Integration or Installed-Result Check

Run `bun run dev`. In the browser, select a rectangle with a synthetic pen pointer, drag normally, then repeat with one/two/three eligible modifier touches. Observe constrained direction, clone count, selection and undo/redo. Repeat ordinary mouse drag and Alt-drag. Final tablet acceptance requires the same flow on one iPad/Apple Pencil and one Android active-stylus device.

## Stop Conditions

Stop if T-084a is not landed, duplication cannot be reversed without adding a second history transaction, auto-layout originals cannot be restored safely, or existing mouse Alt-drag changes outside the stated live-toggle semantics.

## Execution Report Contract

Report exact changed files, test/gate exits, each modifier combination, clone/selection/history evidence, mouse regression evidence and unverified device gaps.

## Status record

2026-08-24 — Expanded as the first user-visible interaction slice. The packet is implementation-ready but hard dependency-locked behind T-084a; `App/` and `Plan/plan.md` remain untouched.
