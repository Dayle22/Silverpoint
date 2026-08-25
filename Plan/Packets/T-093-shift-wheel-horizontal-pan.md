# T-093 - Shift+wheel horizontal canvas pan

Task ID: T-093
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-029, T-017, T-033
Prepared from: comparison against `Toolbox/open-pencil-master (1)` on 2026-08-24. Upstream added "Pan horizontally with Shift+wheel while preserving native horizontal trackpad movement."
Expanded at: 2026-08-24, Africa/Johannesburg
Expanded against: `App/packages/vue/src/shared/input/wheel.ts` (101 lines, read in full), `App/packages/vue/src/shared/input/pan-zoom.ts:1–20,140–150`, `App/packages/core/src/editor/viewport.ts:53`, `App/tests/e2e/viewport/zoom-pan.spec.ts` (read in full through line 300), `App/tests/helpers/canvas.ts:1–40`, `App/tests/engine/vue/input/` (file list), `App/tests/engine/vue/input/guide-snap.test.ts:1–25`, `App/package.json` scripts. Cross-read for comparison only: `Toolbox/open-pencil-master (1)/open-pencil-master/packages/vue/src/shared/input/wheel.ts`.
Delivery: named source gates + browser check
Execution size: 1 implementation file; 2 test files (1 new Bun test, 1 extended Playwright spec); no split — one responsibility (one branch in one delta calculation).

## Intended Outcome

Holding `Shift` while turning a mouse wheel pans the canvas horizontally instead of vertically. A trackpad's
own horizontal gesture keeps working unchanged, including when the user happens to be holding `Shift`.

This is the standard behaviour in Figma, Illustrator and InDesign, and it matters more here than in a general
editor: OpenPotlood's print work regularly puts a spread wider than the viewport on screen, where the only
current horizontal option is the space-drag pan.

## Request Coverage

- "Pan horizontally with Shift+wheel while preserving native horizontal trackpad movement."
- Canvas viewport only. Panel scrolling, the Layers tree and every dialog keep native browser wheel behaviour.

## Verified Starting State

| Path | Symbol / selector | Current fact (verified) |
| --- | --- | --- |
| `packages/vue/src/shared/input/wheel.ts` | whole file, 101 lines | Contains `WheelAccum` (8–15), `isMacOs` (17–19), `normalizeWheelDelta` (21–31), `WHEEL_ZOOM_SPEED` (33), `wheelDeltaModeScale` (35–38), `wheelZoomDelta` (40–43), `setupWheelPanZoom` (45–101). **No `shiftKey` reference anywhere in the file.** |
| `packages/vue/src/shared/input/wheel.ts:21–31` | `normalizeWheelDelta(e: WheelEvent)` | Module-private. Scales by 40 for `DOM_DELTA_LINE` and 800 for `DOM_DELTA_PAGE`, then returns `{ dx: deltaX, dy: deltaY }`. |
| `packages/vue/src/shared/input/wheel.ts:23,26` | `WheelEvent.DOM_DELTA_LINE`, `WheelEvent.DOM_DELTA_PAGE` | Read from the **`WheelEvent` global**. In a Bun test process there is no DOM, so `WheelEvent` is `undefined` and any headless import of this function throws. This is why the delta calculation currently has no unit test. |
| `packages/vue/src/shared/input/wheel.ts:74–90` | `onWheel(e: WheelEvent)` | Calls `normalizeWheelDelta(e)` **before** the zoom/pan branch (line 77), so the result is computed and discarded on every zoom event. The zoom branch (79–84) uses `wheelZoomDelta` instead. |
| `packages/vue/src/shared/input/wheel.ts:86–87` | `wheelAccum.deltaX -= dx; wheelAccum.deltaY -= dy` | The pan branch. Deltas are negated into the accumulator and flushed once per frame. |
| `packages/vue/src/shared/input/wheel.ts:55–70` | `flushWheel()` | Calls `editor.pan(wheelAccum.deltaX, wheelAccum.deltaY)` for pan, or `setZoomAroundPoint` for zoom, then resets. Coalescing is via `createRafScheduler` (72). |
| `packages/vue/src/shared/input/wheel.ts:92–100` | `useEventListener(canvasRef, 'wheel', …, { passive: false })` | Bound to the canvas element only, with `event.preventDefault()` on every event. Panels and dialogs are unaffected by anything in this file. |
| `packages/vue/src/shared/input/pan-zoom.ts:8,146` | `import { setupWheelPanZoom } from '#vue/shared/input/wheel'` / `setupWheelPanZoom(canvasRef, editor)` | The single call site. |
| `packages/core/src/editor/viewport.ts:53` | `function pan(dx: number, dy: number)` | Two-axis pan already exists; no editor or viewport change is needed. |
| `tests/engine/vue/input/` | 10 test files | `auto-layout-hover`, `gradient-cursor`, `guide-snap`, `move-threshold`, `page-guides`, `progressive-blur-cursor`, `radius-cursor`, `resize-snap`, `text-draw`, `text-resize-mode`. No wheel test exists. |
| `tests/engine/vue/input/guide-snap.test.ts:1–7` | header | `import { describe, expect, test } from 'bun:test'` then blank line, then `#core/*` / `#vue/*` imports. No `@ts-nocheck`. This is the header to match. |
| `tests/e2e/viewport/zoom-pan.spec.ts:67–91` | `test('wheel pan updates viewport correctly')` | Reads `store.state.panX` / `panY` before and after `helper.page.mouse.wheel(100, 50)` and asserts both decreased. Confirms positive delta → decreasing pan value. |
| `tests/e2e/viewport/zoom-pan.spec.ts:255–269` | synthetic dispatch | `document.querySelector<HTMLCanvasElement>('[data-ready="1"]')` then `canvas.dispatchEvent(new WheelEvent('wheel', { deltaX, deltaY, ctrlKey, clientX, clientY, bubbles: true, cancelable: true }))`. **This proven in-repo pattern is how the new test supplies `shiftKey`** — Playwright's `mouse.wheel()` cannot carry a modifier. |
| `tests/e2e/viewport/zoom-pan.spec.ts:11–33` | `beforeAll` | Navigates to `http://localhost:1420/?test&no-chrome&no-rulers`, waits for init, seeds 200 rectangles. The new test joins this existing `describe` and reuses that fixture. |

Exact new public contract to implement (copy verbatim):

```ts
// packages/vue/src/shared/input/wheel.ts
export type WheelPanDelta = { dx: number; dy: number }

/**
 * Pan delta for a wheel event, in device pixels.
 *
 * Shift converts a predominantly vertical wheel into horizontal movement. A
 * gesture that already carries at least as much horizontal as vertical travel
 * — a trackpad swipe — is returned unchanged so Shift never fights it.
 */
export function wheelPanDelta(event: WheelPanInput): WheelPanDelta
```

## Read First

1. `packages/vue/src/shared/input/wheel.ts` — the whole file (101 lines). Every source edit is in it.
2. `tests/e2e/viewport/zoom-pan.spec.ts` lines 1–40, 67–91 and 250–270 — the fixture, the existing pan
   assertion shape, and the synthetic dispatch pattern.
3. `tests/engine/vue/input/guide-snap.test.ts` lines 1–10 — the Bun test header convention.

Do **not** open `packages/vue/src/shared/input/pan-zoom.ts`, `packages/core/src/editor/viewport.ts`, or any
panel or dialog scroll code. None of them changes.

## Corrections to the Brief

None.

## Fixed Decisions

1. **Shift only swaps a predominantly vertical gesture.** The rule is
   `if (!shiftKey || Math.abs(dx) >= Math.abs(dy)) return delta` — that is, when the event already carries at
   least as much horizontal travel as vertical, it is passed through untouched. Justification: macOS and
   several Windows precision trackpads already emit `deltaX` for a two-finger horizontal swipe, and some
   browsers additionally pre-swap the axes themselves when Shift is held. Without this guard, a Shift-held
   trackpad swipe would be swapped a second time and move the canvas vertically. This is the whole content of
   "while preserving native horizontal trackpad movement".
2. **When the swap applies, `dy` becomes `0`.** `{ dx: delta.dy, dy: 0 }`, not `{ dx: delta.dy, dy: delta.dy }`
   and not a diagonal. Shift+wheel is a horizontal-only gesture.
3. **Replace the `WheelEvent.DOM_DELTA_LINE` / `DOM_DELTA_PAGE` statics with the module constants
   `WHEEL_DELTA_LINE = 1` and `WHEEL_DELTA_PAGE = 2`.** These are the values fixed by the UI Events spec. This
   is not cosmetic: it is what makes the function importable and testable in a Bun process with no DOM, which
   is the only way this packet gets a unit test at all (Verified Starting State, row 3).
4. **Type the pure function's parameter as a structural `Pick`, not `WheelEvent`:**
   `type WheelPanInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>`. `WheelEvent` as a
   *type* is available from TypeScript's DOM lib at compile time even where the *global* is absent at runtime,
   so this costs nothing and lets the test pass plain object literals.
5. **Move the `normalizeWheelDelta` call into the pan branch.** It is currently computed on every zoom event and
   thrown away (line 77). Folding it into `wheelPanDelta` and calling that inside the `else` branch removes a
   per-event allocation on the zoom path.
6. **Do not extract an `isWheelZoom` helper.** Upstream did; it is a one-line wrapper around
   `event.ctrlKey || event.metaKey` with no test need, and extracting it would put unrelated churn in this diff.
   Leave line 79 exactly as it is.
7. **Do not rename `onWheel`'s parameter.** Upstream renamed `e` to `event` throughout `setupWheelPanZoom`.
   Keep `e`. The diff should be readable as three changed lines plus one new function.
8. **No preference, no setting, no toggle.** Shift+wheel is a universal editor convention; adding it to
   Preferences would need a `PREFERENCES_VERSION` bump for a behaviour nobody turns off.

## Open Decisions

1. **`Shift` + trackpad pinch-zoom.** Recommended default (implemented): unchanged. The zoom branch is checked
   first (`e.ctrlKey || e.metaKey`), and browsers report pinch as `ctrlKey`, so a Shift-held pinch still zooms.
   Consequence of the alternative: none worth having — suppressing zoom while Shift is down would break a
   common one-hand gesture.
2. **`Alt`/`Option` + wheel.** Recommended default (implemented): not bound. Some tools map it to zoom.
   Consequence of the alternative: it would collide with the Alt-modifier semantics established by T-084b and
   T-084c on the canvas. Out of scope; raise separately if the user wants it.

## Visual Contract — binding

This packet changes no markup, no class, no colour, no spacing and no user-visible label. There is nothing to
style. The binding contract is the code shape below.

**Constants** — add immediately after the imports (currently line 6), before `type WheelAccum`:

```ts
const WHEEL_DELTA_LINE = 1
const WHEEL_DELTA_PAGE = 2
```

**Types** — add immediately after the `WheelAccum` type (currently ends line 15):

```ts
type WheelPanInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>

export type WheelPanDelta = { dx: number; dy: number }
```

**Replace `normalizeWheelDelta` (lines 21–31) with these two functions**, keeping them in the same position in
the file:

```ts
function normalizeWheelDelta(event: WheelPanInput): WheelPanDelta {
  let { deltaX, deltaY } = event
  if (event.deltaMode === WHEEL_DELTA_LINE) {
    deltaX *= 40
    deltaY *= 40
  } else if (event.deltaMode === WHEEL_DELTA_PAGE) {
    deltaX *= 800
    deltaY *= 800
  }
  return { dx: deltaX, dy: deltaY }
}

/**
 * Pan delta for a wheel event, in device pixels.
 *
 * Shift converts a predominantly vertical wheel into horizontal movement. A
 * gesture that already carries at least as much horizontal as vertical travel
 * — a trackpad swipe — is returned unchanged so Shift never fights it.
 */
export function wheelPanDelta(event: WheelPanInput): WheelPanDelta {
  const delta = normalizeWheelDelta(event)
  if (!event.shiftKey || Math.abs(delta.dx) >= Math.abs(delta.dy)) return delta
  return { dx: delta.dy, dy: 0 }
}
```

**`onWheel`** — delete line 77 (`const { dx, dy } = normalizeWheelDelta(e)`) and insert the call at the top of
the `else` branch, so lines 85–88 become:

```ts
    } else {
      const { dx, dy } = wheelPanDelta(e)
      wheelAccum.deltaX -= dx
      wheelAccum.deltaY -= dy
    }
```

Everything else in `setupWheelPanZoom` — the accumulator, `flushWheel`, `wheelZoomDelta`, the zoom branch, the
rAF scheduler and the `useEventListener` registration — stays byte-identical.

### Banned List

- No `isWheelZoom` extraction (Fixed Decision 6).
- No rename of `onWheel`'s `e` parameter, and no rename of any other existing local (Fixed Decision 7).
- No change to `flushWheel`, `WheelAccum`, `WHEEL_ZOOM_SPEED`, `wheelDeltaModeScale`, `wheelZoomDelta`,
  `isMacOs`, or the `useEventListener` registration.
- No change to the zoom branch or its `ctrlKey || metaKey` test.
- No change to any file outside `packages/vue/src/shared/input/wheel.ts` and the two test files.
- No new preference, setting, keyboard-shortcut registration, or entry in the shortcut reference.
- No `Alt`/`Option` wheel binding (Open Decision 2).
- No change to panel, dialog, Layers-tree or Properties-panel scrolling.
- No new npm dependency.
- No `WheelEvent.DOM_DELTA_*` static left in the file — the whole point of Fixed Decision 3 is that the module
  becomes importable without a DOM.

## Allowed Changes

- `packages/vue/src/shared/input/wheel.ts` — exactly the edits in the Visual Contract.
- Create `tests/engine/vue/input/wheel-pan.test.ts`.
- Extend `tests/e2e/viewport/zoom-pan.spec.ts` with one new test inside the existing `describe`.

## Restrictions and Exclusions

An implementer who wants to cross one of these must stop and report instead.

- Do not change zoom behaviour in any way, including its speed, its centre point, or its modifier.
- Do not alter the rAF coalescing. The existing test `rapid wheel events are coalesced without errors`
  (`zoom-pan.spec.ts:93`) must keep passing untouched.
- Do not modify the existing `wheel pan updates viewport correctly` test — a Shift-less wheel must behave
  exactly as it does today, and that test is the proof.
- Do not add a preference or a documented shortcut entry.
- Do not build the desktop app, run the installer, or bump `package.json` /
  `desktop/tauri.conf.json` / `desktop/Cargo.toml`.
- Do not run `bun run check`, `bun run lint`, `bun run test`, or `bun run test:unit`.

## Implementation Steps

1. **Pre-flight.** Reread `packages/vue/src/shared/input/wheel.ts` in full. Confirm the line anchors in Verified
   Starting State still match, and confirm `shiftKey` still appears nowhere in the file. Record any drift in the
   execution report before editing.

2. **Edit `packages/vue/src/shared/input/wheel.ts`** exactly per the Visual Contract: add the two constants, add
   the two types, replace `normalizeWheelDelta` with the pair of functions, and move the delta call into the
   `else` branch of `onWheel`. Nothing else.

3. **Create `tests/engine/vue/input/wheel-pan.test.ts`.** Match the header of
   `tests/engine/vue/input/guide-snap.test.ts:1–7`: `import { describe, expect, test } from 'bun:test'`, blank
   line, then `import { wheelPanDelta } from '#vue/shared/input/wheel'`. Assert, passing plain object literals
   `{ deltaX, deltaY, deltaMode, shiftKey }`:
   - **no Shift, vertical wheel** — `{ 0, 100, 0, false }` → `{ dx: 0, dy: 100 }`;
   - **no Shift, horizontal trackpad** — `{ 100, 0, 0, false }` → `{ dx: 100, dy: 0 }`;
   - **Shift, vertical wheel** — `{ 0, 100, 0, true }` → `{ dx: 100, dy: 0 }` (the new behaviour);
   - **Shift, negative vertical wheel** — `{ 0, -100, 0, true }` → `{ dx: -100, dy: 0 }` (direction preserved);
   - **Shift, horizontal trackpad swipe** — `{ 100, 0, 0, true }` → `{ dx: 100, dy: 0 }` unchanged, **not**
     swapped to `{ dx: 0, dy: 0 }`;
   - **Shift, diagonal with more horizontal than vertical** — `{ 80, 30, 0, true }` → unchanged `{ 80, 30 }`;
   - **Shift, diagonal with more vertical than horizontal** — `{ 30, 80, 0, true }` → `{ dx: 80, dy: 0 }`;
   - **Shift, exactly equal magnitudes** — `{ 50, 50, 0, true }` → unchanged `{ 50, 50 }` (the `>=` boundary);
   - **line mode** — `{ 0, 3, 1, false }` → `{ dx: 0, dy: 120 }`, and `{ 0, 3, 1, true }` → `{ dx: 120, dy: 0 }`
     (scaling happens before the swap);
   - **page mode** — `{ 0, 1, 2, false }` → `{ dx: 0, dy: 800 }`;
   - **zero deltas** — `{ 0, 0, 0, true }` → `{ dx: 0, dy: 0 }` and no `NaN`.

   The file must import cleanly with no DOM present; if it throws on import, Fixed Decision 3 was not applied.

4. **Extend `tests/e2e/viewport/zoom-pan.spec.ts`.** Add one test immediately after
   `test('wheel pan updates viewport correctly')` (currently ends line 91), inside the same `describe`, reusing
   the existing `helper`. Name it `shift+wheel pans horizontally only`. Implement it with the synthetic dispatch
   pattern from lines 255–269 of the same file — Playwright's `mouse.wheel()` cannot carry a modifier:
   - read `{ panX, panY }` from `store.state`;
   - in `page.evaluate`, locate `document.querySelector<HTMLCanvasElement>('[data-ready="1"]')` and dispatch a
     `new WheelEvent('wheel', { deltaX: 0, deltaY: 120, shiftKey: true, clientX: 400, clientY: 300, bubbles: true, cancelable: true })`;
   - `await helper.waitForRender()` and `await helper.page.waitForTimeout(50)`, matching the existing pan test;
   - read `{ panX, panY }` again and assert `after.panX < before.panX` **and** `after.panY === before.panY`;
   - end with `helper.assertNoErrors()`.

   Change nothing else in the file.

## Acceptance Criteria

- [ ] Holding Shift and turning the wheel over the canvas pans horizontally; the vertical position does not
      change at all.
- [ ] Reversing the wheel direction with Shift held reverses the horizontal direction.
- [ ] Wheel without Shift pans vertically exactly as before.
- [ ] `Ctrl`/`Cmd`+wheel zooms exactly as before, including with Shift also held.
- [ ] A horizontal trackpad swipe pans horizontally whether or not Shift is held, and is never swapped into
      vertical movement.
- [ ] `WheelEvent.DOM_DELTA_LINE` and `WheelEvent.DOM_DELTA_PAGE` no longer appear in
      `packages/vue/src/shared/input/wheel.ts`, and `tests/engine/vue/input/wheel-pan.test.ts` imports the
      module without a DOM.
- [ ] Wheel behaviour over panels, dialogs and the Layers tree is unchanged.
- [ ] The existing `wheel pan updates viewport correctly` and `rapid wheel events are coalesced without errors`
      tests pass unmodified.
- [ ] Nothing on the Banned List appears in the diff, and no file outside Allowed Changes is touched.
- [ ] All named gates below pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```bash
bun test tests/engine/vue/input/wheel-pan.test.ts
```

### Final pre-completion gates — run once

```bash
bunx tsgo --noEmit
```

```bash
bunx oxlint -c oxlint.json packages/vue/src/shared/input/wheel.ts tests/engine/vue/input/wheel-pan.test.ts tests/e2e/viewport/zoom-pan.spec.ts
```

```bash
bunx playwright test tests/e2e/viewport/zoom-pan.spec.ts --project=openpencil
```

`vue-tsc` is not required: no `.vue` file changes and `WheelPanDelta` is a new export, not a change to an
existing one. Run `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` only if `tsgo` reports anything in
`packages/vue`.

Grep check: confirm `DOM_DELTA` returns no hits in `packages/vue/src/shared/input/wheel.ts`.

## Integration or Installed-Result Check

Browser only — no desktop build is authorised or needed. No Tauri config, Rust, icon, generated menu, or
`IS_TAURI`-only surface is touched.

```bash
bun run dev
```

At `http://localhost:1420`, with a document wide enough that its content overflows the viewport horizontally
(create an A3 landscape frame, or zoom in to ~400%):

1. Wheel down with no modifier — the canvas moves vertically. Unchanged.
2. Hold Shift and wheel down — the canvas moves horizontally, and the vertical position visibly does not drift.
3. Hold Shift and wheel up — it moves the other way.
4. `Ctrl`+wheel — zooms around the pointer. Unchanged.
5. `Ctrl`+`Shift`+wheel — still zooms, does not pan (Open Decision 1).
6. If a precision trackpad is available: two-finger horizontal swipe pans horizontally; repeat with Shift held
   and confirm it still pans horizontally in the same direction rather than flipping to vertical. If no
   trackpad is available on this machine, say so explicitly in the execution report and rely on the two
   trackpad-shaped unit-test cases in Step 3.
7. Spin the wheel rapidly with Shift held; motion stays smooth with no console errors — the rAF coalescing is
   untouched.
8. Non-regression: hover the Layers panel and the Properties panel and wheel with and without Shift; both
   scroll natively and the canvas does not move.
9. Non-regression: open Preferences and wheel inside it; the dialog scrolls and the canvas does not move.

## Stop Conditions

Stop and report instead of improvising if:

- the new Bun test file throws on import, indicating a `WheelEvent` global is still being read at module scope;
- the synthetic `WheelEvent` dispatch in the e2e test does not reach the handler, contradicting the pattern
  already proven at `zoom-pan.spec.ts:255–269`;
- Shift+wheel pans horizontally **and** vertically, indicating `dy` was not zeroed (Fixed Decision 2);
- a Shift-held trackpad swipe inverts to vertical movement, indicating the `Math.abs(dx) >= Math.abs(dy)` guard
  was dropped or inverted;
- either existing test in `tests/e2e/viewport/zoom-pan.spec.ts` fails;
- the work appears to require editing `pan-zoom.ts`, `viewport.ts`, a preference, or any file outside Allowed
  Changes.

## Execution Report Contract

Record: the changed file and the final shape of `wheelPanDelta`; the exact commands run with exit codes and
test counts; the full list of Bun test cases with results, including the `>=` boundary case and both
trackpad-shaped cases; the nine browser-check observations above with pass/fail each, explicitly stating
whether a precision trackpad was available for observation 6; confirmation that `DOM_DELTA` has zero hits in
the file; confirmation that the two pre-existing wheel tests passed unmodified; any Banned List item crossed
and its justification; and any remaining gap.

## Status record

Expansion receipt — 2026-08-24, revision 1. Expanded against the live tree under `App/`; every path, symbol,
line number, test helper and script command in this packet was read from source during expansion. No file
under `App/` was modified. The upstream resource `Toolbox/open-pencil-master (1)` was read for comparison only
and is non-authoritative; its `isWheelZoom` extraction and its parameter renaming were deliberately **not**
copied (Fixed Decisions 6 and 7). Execution evidence goes here after the packet runs; step status stays in
`Plan/plan.md`.
