# T-084a - Tablet pen/touch arbitration

Task ID: T-084a
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-057, T-084b, T-084c, T-084d
Prepared from: the user's 2026-08-24 request for an iPad/Android PWA whose stylus is the precision pointer and whose held fingers act as modifiers
Expanded at: 2026-08-24 09:38 Africa/Johannesburg
Expanded against: `App/packages/vue/src/canvas/useCanvasInput.ts:128-173,447-495,517-654,670-710`, `App/packages/vue/src/shared/input/pan-zoom.ts:10-153`, `App/packages/vue/src/shared/input/geometry.ts:12-18`, `App/packages/vue/src/canvas/tool-input/use.ts:12-80`, `App/src/components/EditorCanvas.vue:56-96,249-270`, `App/package.json:19-57`, `Plan/Packets/T-057-remove-mobile-and-browser-chrome.md:14-56,74-101`, and the official Pointer Events/Apple Pencil support already established in the 2026-08-24 feasibility discussion
Delivery: named source gates + browser check
Execution size: 3 core implementation files; 1 new focused engine test file; one input-arbitration responsibility, no split needed

## Intended Outcome

The shared canvas reliably distinguishes mouse, pen and touch. A pen drives the existing tool pipeline with its real `PointerEvent`; while that pen is down, deliberate finger contacts are reserved as modifier input and never start a second canvas edit, pan or pinch. Without an active pen, existing one-finger editing/hand panning and two-finger pan/zoom remain unchanged.

## Request Coverage

- Make Apple Pencil, S Pen and standards-compatible active styluses usable as the canvas precision pointer.
- Establish the held-finger channel needed by later packets without adding the tablet shell or implementing any object modifier behaviour yet.
- Prevent palm/finger contacts during a pen gesture from becoming ordinary canvas edits.

## Verified Starting State

| Path | Symbol / span | Binding fact |
| --- | --- | --- |
| `packages/vue/src/canvas/useCanvasInput.ts` | `onMouseDown`, `onMouseMove`, `onMouseUp`; listeners at `670-679` | Canvas listeners already receive `pointer*` events, but callbacks are typed `MouseEvent` and do not distinguish `pointerType`; touch is also handled separately. |
| `packages/vue/src/shared/input/pan-zoom.ts` | `setupPanZoom()` | Owns `touchstart/move/end/cancel`; synthesises `MouseEvent` for one finger and implements two-finger pan/zoom. It has no concept of an active pen or modifier touches. |
| `packages/vue/src/shared/input/draw.ts` | `pressureForEvent()` | Reads guarded `event.pressure`, so a real `PointerEvent` already carries pressure through the MouseEvent-compatible call chain. |
| `src/components/EditorCanvas.vue` | overlay canvas at `263-270` | Canvas already uses `touch-none`, preventing browser panning/zooming from taking ownership inside the editor. |
| `Plan/Packets/T-057-remove-mobile-and-browser-chrome.md` | deletion contract | Removes inherited phone chrome but preserves public shared input. This packet must not restore or depend on `MobileHud`, `MobileDrawer`, `MobileToolbar` or `useViewportKind`. |

Exact new contracts:

```ts
export type TouchModifierCount = 0 | 1 | 2 | 3

export interface PenContact {
  active: boolean
  screenX: number
  screenY: number
}

export interface CanvasInputModifiers {
  touchCount: TouchModifierCount
  constrain: boolean
  alternate: boolean
  bypass: boolean
}

export function modifiersForTouchCount(count: number): CanvasInputModifiers
export function mergeCanvasModifiers(
  event: Pick<MouseEvent, 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>,
  touch: CanvasInputModifiers
): CanvasInputModifiers
```

`modifiersForTouchCount`: `0 -> none`, `1 -> constrain`, `2 -> alternate`, `3+ -> constrain + alternate`; always clamp `touchCount` to `0..3`. `mergeCanvasModifiers` ORs Shift with `constrain`, Alt with `alternate`, and Ctrl/Meta with `bypass` without mutating the event.

## Read First

1. `packages/vue/src/canvas/useCanvasInput.ts` — `onMouseDown` through `setupPanZoom` (`447-710`).
2. `packages/vue/src/shared/input/pan-zoom.ts` — `setupPanZoom` (`10-153`).
3. `packages/vue/src/shared/input/draw.ts` — `pressureForEvent`, `startFreehandDraw`, `handleFreehandMove` (`10-20,86-104`).

## Fixed Decisions

1. Keep the existing Touch Events navigation route for fingers; do not rewrite all navigation to Pointer Events in this slice. Filter `pointerType === 'touch'` out of the pointer callbacks so a finger has exactly one owner.
2. Pen and mouse continue through the existing tool pipeline. Change callback types to `PointerEvent`; do not synthesize a mouse event for pen.
3. Create `packages/vue/src/shared/input/modifiers.ts` as the DOM-light source of modifier mapping and contact eligibility. No app-store state or scene state owns transient contacts.
4. `useCanvasInput` owns `penContact: Ref<PenContact>`, `penActive: ComputedRef<boolean>` and `inputModifiers: Ref<CanvasInputModifiers>` and returns both `penActive` and `inputModifiers` to the shell. `pointerdown` with `pointerType === 'pen'` activates/positions the pen; pen move updates position; pen up/cancel clears both pen and modifier state.
5. While `penContact.active`, `setupPanZoom` treats touches only as candidate modifiers. It must not call `onMouseDown`, `onMouseMove`, `onMouseUp`, start `DragPan`, or alter zoom/pan.
6. Palm filter: reject a candidate touch when its centre is within `96px` of the latest pen screen point or either `radiusX`/`radiusY` exceeds `30px`. Count eligible remaining touches, capped at three. No timing delay in v1; contact presence itself is the hold.
7. If the pen lifts while fingers remain down, suppress those contacts until all fingers lift; they must not suddenly become a one-finger edit or pinch.
8. Do not claim real-device acceptance from synthetic tests. Browser checks prove routing; iPad/Android hardware proof remains an explicit later acceptance step.

## Allowed Changes

- New `App/packages/vue/src/shared/input/modifiers.ts`.
- Edit `App/packages/vue/src/canvas/useCanvasInput.ts` only for pointer typing/filtering, transient pen/modifier refs, pointer-cancel handling and the revised `setupPanZoom` contract.
- Edit `App/packages/vue/src/shared/input/pan-zoom.ts` only for pen-active modifier arbitration and held-touch suppression.
- New `App/tests/engine/vue/input/tablet-modifiers.test.ts`.

## Restrictions and Exclusions

- No app UI, mobile/tablet layout, PWA manifest, storage, file handling, scene graph or CanvasKit changes.
- No changes to what mouse input does.
- No held-finger transform behaviour yet; T-084b consumes this state.
- No new dependency, global state, local storage key, global CSS, build, install, version bump or Git work.
- Do not edit or reverse T-057.

## Implementation Steps

1. Pre-flight the four Read First spans and stop if T-057 has already changed their ownership materially.
2. Add `modifiers.ts` with the exact contracts and constants `MODIFIER_PEN_EXCLUSION_PX = 96` and `MODIFIER_MAX_TOUCH_RADIUS_PX = 30`; export a pure eligibility/count helper that accepts only the touch fields it needs.
3. In `useCanvasInput.ts`, type primary callbacks as `PointerEvent`, return early for touch pointers, track pen contact, clear modifier state on pen completion/cancel, and pass both refs into `setupPanZoom`. Preserve mouse/pen propagation into `handleToolMouseDown` because `PointerEvent extends MouseEvent`.
4. In `pan-zoom.ts`, preserve the no-pen branches byte-for-behaviour. Add only the active-pen modifier branch and suppress-until-release state described above.
5. Add `tablet-modifiers.test.ts`, mirroring the unsuppressed import header in adjacent `move-threshold.test.ts`. Cover count mapping, keyboard merging, distance rejection, radius rejection, cap-at-three and no mutation of inputs.

## Acceptance Criteria

- [ ] Pen PointerEvents reach the existing select/move/draw pipeline with pressure intact, and `useCanvasInput` exposes reactive `penActive` plus `inputModifiers` refs.
- [ ] Touch pointers do not enter both pointer and Touch Events routes.
- [ ] Without pen input, one- and two-finger behaviour is unchanged.
- [ ] With pen input, eligible held fingers produce 1/2/3 modifier counts and do not navigate/edit.
- [ ] Palm-like contacts are rejected by the fixed distance/size rules.
- [ ] Pen-up with fingers still held cannot start a surprise finger gesture.

## Verification

### Development loop — repeat as needed

From `App/`: `bun test tests/engine/vue/input/tablet-modifiers.test.ts`

### Final pre-completion gates — run once

1. `bun test tests/engine/vue/input/move-threshold.test.ts tests/engine/vue/input/text-draw.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check packages/vue/src/shared/input/modifiers.ts packages/vue/src/shared/input/pan-zoom.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/vue/input/tablet-modifiers.test.ts`

## Integration or Installed-Result Check

Run `bun run dev`; in Chromium DevTools device emulation verify ordinary mouse selection, one-finger editing and two-finger pan/zoom still work. Dispatch a pen PointerEvent plus candidate Touch contacts and read the returned `inputModifiers` through a temporary debugger only; remove debugging before completion. This is browser source proof, not iPad/Android acceptance.

## Stop Conditions

Stop if the browser fires a pen solely as `TouchEvent` on the target real device, if T-057 has removed shared input, if filtering touch pointer events breaks mouse/pen delivery, or if the no-pen gesture branch must be redesigned rather than preserved.

## Execution Report Contract

Report changed files, exact command exits, modifier/palm cases exercised, browser routing evidence, any device/browser discrepancy and remaining real-device gap. Do not claim tablet delivery.

## Status record

2026-08-24 — Added and expanded from the user's tablet stylus/held-finger discussion. `App/` and `Plan/plan.md` were not changed. This is the first executable packet; companion packets remain hard dependency-ordered.
