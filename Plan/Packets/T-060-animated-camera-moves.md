# T-060 - Animated camera moves

Task ID: T-060
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: T-028 (render-path pressure - see Stop Conditions; not a hard block, see D)
Related: T-034 (page overview - inherits this for free), T-061 (renderer stability, touches the same frame path)
Raised: 2026-08-14 (user request batch 4)
Expanded at: 2026-08-14

## Intended Outcome

Discrete, user-initiated camera jumps glide instead of teleporting. Choosing *Zoom to fit*, *Zoom to selection*, *Zoom to 100%*, or typing a zoom percentage moves the viewport to its new framing over roughly a quarter of a second on an ease-out curve, so the user keeps their bearings. Continuous input - wheel zoom, trackpad pan, drag-pan - is untouched and stays instant, and any such input during a glide takes over immediately from wherever the camera has reached. The final viewport values are byte-identical to what the same command produces today; only the path there changes. Headless and reduced-motion environments keep the current instant behaviour.

## Verified Starting State

Verified against the working tree on 2026-08-14. Line numbers are from that read; re-check before editing, but the named functions are stable anchors.

### A. Every camera jump funnels through two functions

`App/packages/core/src/editor/viewport.ts` (114 lines, whole file read):

| Line | Function | Role |
| --- | --- | --- |
| 52 | `zoomToBounds(minX, minY, maxX, maxY)` | Assigns `zoom`, `panX`, `panY`, then `ctx.requestRepaint()`, then `emitViewportChanged(previous)` |
| 68 | `zoomToFit()` | Computes page bounds → delegates to `zoomToBounds` |
| 76 | `zoomToLevel(level)` | Same assign-repaint-emit shape |
| 89 | `zoomTo100()` | Delegates to `zoomToLevel(1)` |
| 93 | `zoomToSelection()` | Computes selection bounds → delegates to `zoomToBounds` |

Continuous-input paths, **out of scope**: `pan` (44), `applyZoom` (35), `setZoomAroundPoint` (25). `screenToCanvas` (19) is a pure read.

`App/packages/core/src/editor/page-viewports.ts` `restorePageViewport` assigns `panX`/`panY`/`zoom`/`pageColor` directly and never calls into `viewport.ts`. Out of scope by decision.

### B. Callers - the full live set

| Caller | Call | Animate? |
| --- | --- | --- |
| `packages/vue/src/editor/commands/view.ts:21/29/37` | `zoomTo100`, `zoomToFit`, `zoomToSelection` | Yes - these are the commands the request is about |
| `src/components/editor/ZoomDropdown.vue:43` | `zoomToLevel(parsed / 100)` from the typed percentage box | Yes |
| `src/components/editor/ZoomDropdown.vue:146` | `zoomToLevel(preset.level)` from the preset list | Yes |
| `src/app/document/io/browser.ts:21` | `editor.zoomToFit()` inside `fitCurrentPageToViewport`, after a `yieldToUI()` | **No** - initial framing on document open; there is no "where I was" to preserve |
| `packages/vue/example/src/App.vue:21` | `editor.zoomToFit()` at example bootstrap | No (same reason; the example is not shipped) |

`ZoomDropdown.vue:59/64` `zoomIn`/`zoomOut` go through `applyZoom`, not `zoomToLevel`, and stay instant.

### C. Corrections to the brief

Two claims in the BRIEF revision are wrong and must not be carried forward:

1. **`emitViewportChanged` does have a consumer.** `src/app/collab/session.ts:138` (`watchAwarenessZoom`) subscribes to `viewport:changed` and writes the new zoom into the collaboration awareness state on every emission. `packages/vue/src/canvas/surface/render-loop.ts:88` also subscribes, purely to schedule a frame. Per-frame emission would therefore push ~16 awareness broadcasts per glide. This is why decision 4 emits once.
2. **`retained-backing.ts` does not read the event**, which the brief guessed correctly, but the reason matters: `updateSceneBackingPreviewState` (line 45-64) compares `r.panX`/`r.panY`/`r.zoom` against `r.lastSceneViewport` itself and, on any change, extends `sceneBackingPreviewUntil` and sets `sceneBackingNeedsCrispRender`. An animated camera therefore drops into the existing preview-quality path for the duration of the glide and issues one crisp render after it settles - exactly the behaviour a drag-pan already gets. No change is needed there, and none is permitted (see Restrictions).

### D. No external synchronous contract - re-verified

The brief's central assumption holds:

- **No MCP tool moves the camera.** `src/app/automation/mcp/` contains only `spawn.ts`. The Figma bridge (`src/app/automation/bridge/figma-factory.ts:16-22`) sets `api.viewport` as a **snapshot read** of `panX`/`panY`/`zoom` at construction time; it has no setter and calls nothing in `viewport.ts`.
- **No test calls any of the five jump functions.** `grep` across `tests/` returns nothing. `tests/e2e/viewport/zoom-pan.spec.ts` exercises `applyZoom`, `pan`, and raw `store.state.*` assignment only.
- **No layer-jump command exists.** `LayerTreeRoot.vue:160` scrolls the *panel list* into view, not the canvas. The request's "jumping to a layer" has nothing to animate today; when such a command is added it must route through `zoomToBounds` and will inherit this for free.

### E. Frame plumbing - what exists

- `ctx.requestRepaint()` (`packages/core/src/editor/create.ts:100`) bumps `state.renderVersion` and emits `repaint:requested`.
- `packages/vue/src/canvas/surface/render-loop.ts` subscribes to `repaint:requested`, `render:requested`, `viewport:changed` and coalesces them into one `requestAnimationFrame` per editor (`getRenderScheduler`, line 16-46). One repaint call per animation frame is therefore already the correct and cheapest signal; a second rAF loop of our own driving repaints is the intended design and does not double-schedule renders.
- **`packages/core` contains no `requestAnimationFrame` call today** (`grep` returns nothing) and no easing, `lerp`, or tween helper anywhere in `packages/core/src`, `packages/vue/src`, or `src/`. Everything in decision 2 is new code, and it is small.
- `IS_BROWSER` is already exported from `#core/constants` and used in `create.ts:60`.
- Under `bun test`, `typeof requestAnimationFrame === 'undefined'` and `typeof matchMedia === 'undefined'` (verified by running it). The instant fallback in decision 3 therefore makes every existing engine test see today's synchronous behaviour with no test changes.

### F. A pre-existing defect in `zoomToLevel`, deliberately not fixed here

`zoomToLevel` (line 76-87) computes the world-space viewport centre, then assigns `panX = viewW / 2 - centerX`, omitting the `* zoom` factor that would actually keep that centre fixed. The result is that zooming to a level does not hold the centre point except at `zoom === 1`. This is live behaviour today, it is **out of scope**, and the animation must land on exactly these (wrong) values - see decision 5. Raise it as its own packet.

## Fixed Decisions

1. **The animation drives `ctx.state`, not a separate display transform.**
   Hit-testing, overlays, rulers, snapping, the zoom percentage readout and the renderer all derive from `ctx.state.panX/panY/zoom`. A parallel "displayed" viewport would desynchronise the pointer from the pixels for the whole glide. The interpolation therefore writes `ctx.state` each frame, and the answer to the brief's "does the synchronous API have to change?" is: **the signature does not change, but the post-call state does.** That is acceptable *only* because D verifies no caller, test or tool reads viewport state synchronously after a jump. If that ever stops being true, `settleViewportAnimation()` (decision 6) is the escape hatch.

2. **One shared interpolation, in a new module.**
   New file `packages/core/src/editor/viewport-animation.ts`, exporting `createViewportAnimator(ctx)` with `animateTo(target)`, `cancel()`, `settle()` and `isAnimating()`. `createViewportActions` owns one animator instance. No other module gets to start a camera animation.
   - Duration **260ms**, constant regardless of distance.
   - Easing **ease-out cubic**: `1 - (1 - t) ** 3`.
   - Zoom interpolates **geometrically**: `zoom(t) = z0 * (z1 / z0) ** e`, so a 10× move feels the same as a 1.1× move.
   - Pan interpolates via the **world-space viewport centre**, not raw pan values: centre is lerped linearly and pan is derived per frame as `panX = viewW / 2 - centreX * zoom(t)`. Interpolating `panX` linearly against a geometric zoom makes the scene swim; this does not.
   - Frames come from `requestAnimationFrame`; each frame assigns state and calls `ctx.requestRepaint()` once.

3. **Animation is opt-in per call and silently degrades to a jump.**
   - Each of the five functions takes a new optional trailing parameter `options?: { animate?: boolean }`. Additive only - no existing call site changes, no existing type breaks.
   - `animate` defaults to `true`, but the animator refuses and jumps instantly when **any** of these hold: `!IS_BROWSER`; `typeof requestAnimationFrame === 'undefined'`; `matchMedia('(prefers-reduced-motion: reduce)').matches`; the move is negligible (zoom ratio within 0.5% **and** both pan deltas under 1 CSS pixel).
   - `src/app/document/io/browser.ts:21` passes `{ animate: false }` explicitly. It is the one caller that must never glide.

4. **`viewport:changed` fires once, at the end, with the pre-animation `previous`.**
   Per-frame emission would spam collaboration awareness (C1). The render loop does not need it - `requestRepaint()` already schedules the frame. Semantically the camera moved from A to B, once.
   - On a cancelled animation, the event still fires once, carrying the position actually reached as `next`, so no consumer is left believing the camera is somewhere it is not.
   - A jump (non-animated path) keeps today's behaviour exactly: assign, repaint, emit.

5. **The final frame assigns the target values verbatim.**
   The last frame does not evaluate the interpolation at `t = 1`; it writes the exact `panX`, `panY`, `zoom` the synchronous code would have written. This makes the animation provably neutral - including over the `zoomToLevel` defect in F - and removes any float-drift argument.

6. **Any competing viewport change cancels the animation immediately.**
   `pan`, `setZoomAroundPoint` (and therefore `applyZoom`), `restorePageViewport`, and a new `animateTo` all call `cancel()` first. Cancellation leaves state exactly where the current frame put it and fires the single `viewport:changed` per decision 4. There is no queue and no easing-back.
   - `settleViewportAnimation()` is exported on the editor: it finishes the move instantly at the target and is the supported way for a future test or tool to make a jump synchronous again.
   - The animator must be cancelled when the editor is torn down, and a pending rAF handle must be cancelled with it - a frame callback firing against a disposed editor is the one crash this packet could introduce.

7. **Page switching stays instant.** `restorePageViewport` restores a *saved* viewport for a different page; there is no spatial continuity to preserve and the scene content changes underneath. It only gains the `cancel()` call from decision 6.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT change the behaviour of `pan`, `applyZoom`, `setZoomAroundPoint`, or any wheel/trackpad/drag path** beyond adding the single `cancel()` call.
- **Do NOT change the final viewport values any command produces.** Including the `zoomToLevel` centring defect in F - it stays exactly as wrong as it is today.
- **Do NOT remove or reorder the existing positional parameters of `zoomToBounds` or `zoomToLevel`.** They appear in published `.d.ts` surfaces (`packages/core/dist/editor/viewport.d.ts:12-16`, `packages/vue/dist/index.d.ts`). The options object is appended, optional.
- **Do NOT emit `viewport:changed` per frame** (see C1).
- **Do NOT touch `retained-backing.ts`, its scheduling heuristics, or any renderer file.** The preview path already handles this correctly (C2).
- **Do NOT animate `restorePageViewport`.**
- **Do NOT add a new dependency.** `motion-v` is DOM-oriented and cannot drive a CanvasKit surface.
- **Do NOT add a preference, setting, or UI control** for duration, curve, or on/off. `prefers-reduced-motion` is the only switch.
- **Do NOT introduce a second `requestAnimationFrame` render loop.** One rAF drives state; the existing render loop coalesces the resulting repaints.
- **Do NOT run `bun run check`, `bun run test`, or `bun run check:upstream`** unless explicitly directed. Use the focused gates under Acceptance.
- No build, no install, no version bump.

## Implementation Steps

Each step is independently verifiable. Land them in order.

1. **The animator** (`packages/core/src/editor/viewport-animation.ts`, new)
   - `createViewportAnimator(ctx: EditorContext)` returning `{ animateTo, cancel, settle, isAnimating }`.
   - `animateTo(target: { panX: number; panY: number; zoom: number }, previous)` implements decisions 2, 4, 5: capture start state, convert both ends to world centres using `ctx.getViewportSize()`, run the rAF loop, assign + `requestRepaint()` per frame, write target verbatim on the final frame, emit `viewport:changed` exactly once at the end.
   - `shouldAnimate(...)` implements decision 3's four refusal conditions. Keep it a pure function taking the deltas so it is directly testable.
   - Guard every global behind a `typeof` check - this module is imported by headless code paths.

2. **Wire the five jump functions** (`packages/core/src/editor/viewport.ts`)
   - Instantiate one animator in `createViewportActions`.
   - Each of `zoomToBounds`, `zoomToLevel`, `zoomToFit`, `zoomTo100`, `zoomToSelection` gains `options?: { animate?: boolean }`; the two computing functions calculate their target values into locals (rather than assigning `ctx.state` directly), then either assign-repaint-emit as today, or hand the target to `animateTo`.
   - `zoomToFit`/`zoomToSelection`/`zoomTo100` forward `options` unchanged to their delegate.
   - Add `cancel()` at the top of `pan` and `setZoomAroundPoint`.
   - Export `settleViewportAnimation` and `cancelViewportAnimation` from the returned object. They reach the editor automatically: `create.ts:279` is `...viewport` (verified), so no change is needed there and the addition is purely additive to the public type.

3. **Page switching** (`packages/core/src/editor/page-viewports.ts`)
   - `restorePageViewport` cancels any in-flight animation before assigning. The animator is not reachable from this module today; pass it in, or route the cancel through `ctx` - whichever avoids a circular import. Report which was chosen.

4. **The one non-animating caller** (`src/app/document/io/browser.ts`)
   - `fitCurrentPageToViewport` calls `editor.zoomToFit({ animate: false })`, and the local `ViewportEditor` type at line 9-11 widens to match.

5. **Focused tests** (`tests/engine/editor/viewport-animation.test.ts`, new)
   - Follow the existing harness in `tests/engine/editor/nudge.test.ts`: `createEditor()` from `@open-pencil/core/editor`, `bun:test`.
   - Because `requestAnimationFrame` is undefined under Bun (E), assert first that **all five jumps are still fully synchronous by default there** and produce values identical to a pre-change baseline. This is the regression guard that matters most.
   - Then stub `globalThis.requestAnimationFrame` with a manual frame pump and assert: state moves monotonically toward the target; the final frame equals the target exactly; `viewport:changed` fires exactly once with the pre-animation `previous`; a `pan()` mid-flight stops the animation, leaves state where it was, and fires the single event; a second `animateTo` mid-flight retargets from the current position without snapping back.
   - Assert `shouldAnimate` refuses a sub-pixel move and refuses under a stubbed `matchMedia` reporting reduced motion.
   - Restore every stubbed global in `afterEach`.

## Acceptance Criteria

- [ ] *Zoom to fit*, *Zoom to selection*, *Zoom to 100%* and both zoom-dropdown paths glide over ~260ms on an ease-out curve and finish on exactly the values the pre-change build produced.
- [ ] Wheel zoom, trackpad pan and drag-pan are unchanged and instant; any of them during a glide takes over from the current position with no snap-back and no fighting.
- [ ] Opening a document still frames the page instantly (`{ animate: false }`), with no visible glide at load.
- [ ] Switching pages restores the saved viewport instantly.
- [ ] `viewport:changed` fires exactly once per camera command - animated, cancelled, or instant - and collaboration awareness receives one zoom update per command, not one per frame.
- [ ] With `prefers-reduced-motion: reduce`, every jump is instant.
- [ ] Under `bun test` (no `requestAnimationFrame`), every jump is synchronous and every existing engine test passes unchanged, with no test edited to accommodate this packet.
- [ ] No renderer file is modified; `git diff --stat` touches only `packages/core/src/editor/`, `src/app/document/io/browser.ts` and the new test.
- [ ] Frame rate during a glide is not measurably worse than during an equivalent drag-pan over the same scene.
- [ ] Focused gates green: `tsgo --noEmit`, `vue-tsc --noEmit -p packages/vue/tsconfig.json`, focused `oxlint` over the touched paths, and `bun test tests/engine/editor/`.

## Stop Conditions

- Stop if animating `ctx.state` desynchronises hit-testing or overlays from what is on screen mid-glide. Decision 1 exists to prevent this; if it fails, the packet's design is wrong, not its details.
- Stop if the glide measurably degrades frame rate. T-028 records existing pressure on this render path; if a glide is visibly worse than a drag-pan across the same scene, report rather than tuning the duration down to hide it.
- Stop if cancelling from `restorePageViewport` cannot be wired without a circular import between `viewport.ts` and `page-viewports.ts`.
- Stop and report if any step requires changing an existing `packages/*` public signature rather than appending an optional parameter.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-14: core animator with geometric zoom and world-centre pan interpolation over 260ms ease-out cubic, fallback on headless/reduced-motion, single viewport:changed event semantics, in-flight cancel on pan/zoom/page-switch, settle/cancel exports; tsgo, vue-tsc, focused oxlint, and 214/214 engine tests green including 16/16 new viewport-animation tests)
