# T-084d - Stylus freehand pressure, tilt and coalesced input

Task ID: T-084d
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: **T-084a — hard execution dependency; pen events must reach the existing tool pipeline without touch synthesis**
Related: T-084b, T-084c
Prepared from: the user's 2026-08-24 request for practical Apple Pencil/S Pen support in a reduced tablet edition
Expanded at: 2026-08-24 09:38 Africa/Johannesburg
Expanded against: `App/packages/vue/src/shared/input/draw.ts:10-118`, `types.ts:144-154`, `App/packages/vue/src/canvas/useCanvasInput.ts:545-605`, `App/packages/vue/src/canvas/tool-input/use.ts:64-71`, and the absence of any `getCoalescedEvents`, `tiltX`, `tiltY`, `altitudeAngle`, `azimuthAngle`, `twist` or `tangentialPressure` use under live `App/packages`/`App/tests`
Delivery: named source gates + browser check
Execution size: 3 core implementation files; 1 new focused engine test file; one freehand-sampling responsibility

## Intended Outcome

Pencil and Brush strokes consume the full stream of real pen samples available to the browser. Pressure continues to control width, coalesced pointer samples improve curves, and Brush tilt broadens the nib predictably. Mouse and touch drawing retain their current neutral-pressure appearance. Output remains one editable closed `VECTOR` outline with no CanvasKit allocation.

## Request Coverage

- Apple Pencil/S Pen pressure-sensitive drawing.
- Use supported stylus tilt meaningfully without making it mandatory.
- Improve stroke smoothness/latency using coalesced historical samples.
- Deliberately omit predicted samples, barrel buttons, double-tap, squeeze, twist and native haptics from this reduced slice.

## Verified Starting State

| Path | Symbol / span | Binding fact |
| --- | --- | --- |
| `packages/vue/src/shared/input/draw.ts` | `pressureForEvent`, `freehandWidth`, `buildFreehandNetwork`, start/move/up (`10-118`) | Pressure-aware editable outline already exists; only the main move event is sampled and tilt is ignored. |
| `packages/vue/src/shared/input/types.ts` | `FreehandSample`, `DragFreehand` (`144-154`) | Samples currently contain only `x`, `y`, `pressure`. |
| `packages/vue/src/canvas/useCanvasInput.ts` | freehand dispatch (`579-581`) | Receives the real T-084a pen `PointerEvent`; this is where coalesced events must be expanded because screen-to-canvas conversion lives here. |
| `packages/vue/src/shared/input/geometry.ts` | `getPointerCoords` (`12-18`) | Authoritative per-event coordinate conversion; apply it to every coalesced event. |

Exact sample contract:

```ts
export interface FreehandSample {
  x: number
  y: number
  pressure: number
  tilt: number // normalised 0..1 magnitude
}

export function freehandSampleFromEvent(
  x: number,
  y: number,
  event: Pick<PointerEvent, 'pointerType' | 'pressure' | 'tiltX' | 'tiltY'>
): FreehandSample
```

## Read First

1. `packages/vue/src/shared/input/draw.ts:10-118`.
2. `packages/vue/src/shared/input/types.ts:144-154`.
3. `packages/vue/src/canvas/useCanvasInput.ts:545-605`.

## Fixed Decisions

1. Normalise pen pressure to `0..1`; when pen reports zero during a down/move sample, use `0.5` as the compatibility fallback. Mouse/touch also remain `0.5`.
2. Normalise tilt magnitude as `min(1, hypot(tiltX, tiltY) / 90)`. Missing/invalid tilt is zero.
3. Pencil width remains pressure-only: `3.2 * (0.25 + pressure * 0.75)`.
4. Brush keeps its square-root pressure response and multiplies by `1 + 0.5 * tilt`, yielding at most 1.5x width. V1 does not rotate an elliptical nib by azimuth.
5. On each freehand `pointermove`, consume `event.getCoalescedEvents()` when present/non-empty, otherwise `[event]`. Preserve returned chronological order, convert every event through `getCoords`, and let the existing `FREEHAND_MIN_DISTANCE` reject overly dense points.
6. Do not append predicted events to document geometry; extrapolated points can overshoot and are not authoritative history.
7. Do not add stroke smoothing libraries or schema fields. Pressure/tilt are construction-time inputs; the resulting vector outline remains the persisted editable result.
8. Single-point dots inherit pressure and tilt through the existing eight-point fallback.

## Allowed Changes

- `App/packages/vue/src/shared/input/types.ts` — add `tilt` to `FreehandSample`.
- `App/packages/vue/src/shared/input/draw.ts` — exported sample normalisation and the fixed width response.
- `App/packages/vue/src/canvas/useCanvasInput.ts` — expand coalesced events only in the `freehand` branch.
- New `App/tests/engine/vue/input/freehand-stylus.test.ts`.

## Restrictions and Exclusions

- No new brush engine, smoothing dependency, centreline schema, CanvasKit object, rendering change, eraser, hover preview, barrel button, double-tap, squeeze, twist or haptics.
- No change to Pen-tool Bézier behaviour; this packet owns Pencil/Brush freehand only.
- No PWA shell, UI, storage, export or `.fig` work.
- No build/install/version/Git/plan-index changes.

## Implementation Steps

1. Re-verify T-084a preserved real PointerEvents for pen.
2. Add the exact sample helper and `tilt` field; replace `pressureForEvent` with the helper while preserving all current pressure defaults.
3. Apply the fixed Pencil/Brush width formula inside `freehandWidth` and ensure every sample construction supplies tilt.
4. In the freehand move dispatch, expand coalesced events with feature detection, convert each via `getCoords`, and call `handleFreehandMove` in order. Never process both the returned list and the parent event when the list already contains samples.
5. Add `freehand-stylus.test.ts`, following adjacent unsuppressed input-test headers. Cover pressure clamp/fallback, tilt clamp, Pencil ignoring tilt, Brush widening at tilt, coalesced order/deduplication, single-point dot and mouse compatibility.

## Acceptance Criteria

- [ ] Pressure changes Pencil and Brush width predictably.
- [ ] Brush tilt broadens width within the fixed 1.5x cap; Pencil does not.
- [ ] Coalesced samples are consumed once, in order.
- [ ] Missing stylus properties safely fall back.
- [ ] Result remains one editable closed VECTOR and one undoable creation.
- [ ] Mouse/touch freehand appearance does not regress.

## Verification

### Development loop — repeat as needed

From `App/`: `bun test tests/engine/vue/input/freehand-stylus.test.ts`

### Final pre-completion gates — run once

1. `bun test tests/engine/vue/input/text-draw.test.ts tests/engine/vue/input/move-threshold.test.ts`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
4. `bunx oxlint -c oxlint.json --type-aware --type-check packages/vue/src/shared/input/types.ts packages/vue/src/shared/input/draw.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/vue/input/freehand-stylus.test.ts`

## Integration or Installed-Result Check

Run `bun run dev`; draw slow/light, slow/heavy and tilted Brush/Pencil strokes with synthetic pen events and inspect the resulting VECTOR bounds/network. Then perform physical-device checks on iPad/Apple Pencil and Android/S Pen for stroke continuity, pressure range, tilt response, palm interference and latency. Synthetic/browser proof alone does not close device acceptance.

## Stop Conditions

Stop if T-084a does not preserve real pen PointerEvents, coalesced events are not chronological on a target browser, tilt broadening makes self-intersecting/corrupt geometry beyond existing behaviour, or the change requires a new persisted brush schema.

## Execution Report Contract

Report changed files, exact gate exits, pressure/tilt/coalesced cases, resulting vector evidence, mouse compatibility and separate iPad/Android device results or honest gaps.

## Status record

2026-08-24 — Added as a dependency-locked freehand-quality slice. Predicted events and hardware-specific gestures are explicitly deferred. `App/` and `Plan/plan.md` were not changed.
