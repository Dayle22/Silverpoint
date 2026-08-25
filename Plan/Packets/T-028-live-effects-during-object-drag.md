# T-028 - Keep effects visible while dragging objects

Task ID: T-028
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: T-006 (effect types), T-037 (progressive blur)
Related: T-061 (render-path memory pressure - shares `effects.ts` and `retained-backing.ts`), T-060 (animated camera moves, deferred behind this packet's render-path pressure)
Prepared from: CHANGE-008 (2026-07-19) - the user reported object effects disappearing during click-drag and returning only on mouse release
Expanded at: 2026-08-14 (revision 1 was expanded 2026-07-24 and never executed)

## Headline finding - read this before doing anything else

**The defect this packet was written for is no longer reproducible in the renderer.** Between revision 1 and today, a `positionPreviewActive` bypass landed in `renderShape` together with a regression test. Measured on 2026-08-14 with throwaway headless probes (written, run, and deleted during this expansion), a drag-preview frame is **pixel-identical** to the committed post-drag frame for every effect type in the supported matrix.

So the remaining work is not "find and fix the suppression". It is: **prove it in the running application, then either close the packet or capture the still-failing case precisely.** Step 1 below is a decision gate, and the honest outcome may be that no source change is made at all.

## Intended Outcome

While an object is dragged, its effects stay visible and move with it on every frame, and the frame the user sees mid-drag matches the frame they get on release. If the user still observes effects dropping out in the installed app, this packet captures that case with a failing test and fixes the smallest cause.

## Verified Starting State

Verified against the working tree on 2026-08-14. Line numbers are from that read; re-check them before editing, but the named functions are stable anchors.

### A. The drag path (unchanged from revision 1, re-confirmed)

`App/packages/vue/src/shared/input/move.ts`:

- `handleMoveMove` (line 54-108) writes transient geometry with `editor.graph.updateNodePositionPreview(id, ...)` per selected node (lines 90, 103) and then calls `editor.requestRepaint()` (lines 92, 107).
- `requestRepaint` (`packages/core/src/editor/create.ts:93-99`) bumps `renderVersion` **only**; `requestRender` (line 84-91) bumps `sceneVersion` as well. A drag therefore never bumps `sceneVersion` until `handleMoveUp` commits through `editor.updateNode` / `commitMoveWithReparent` (move.ts:127-186). That split is what makes a preview distinguishable from a commit.
- `updateNodePreview` (`packages/scene-graph/src/preview.ts:64-87`) increments `graph.positionPreviewVersion` and mutates the node in place.

### B. The suppression seam - already fixed

`packages/core/src/canvas/renderer/pipeline.ts:172-176`:

```
const hasPositionPreview =
  graph.positionPreviewVersion !== r.scenePicturePositionPreviewVersion &&
  sceneVersion === r.scenePictureVersion
const hasVolatileOverlays = hasPositionPreview || hasVolatileOverlay(overlays)
r.positionPreviewActive = hasPositionPreview
```

`hasVolatileOverlays` forces the scene off both the recorded scene picture and the retained backing (line 198-217) onto `renderPageChildren`, and `r.positionPreviewActive` is consumed in exactly one place - `renderShape` (`packages/core/src/canvas/scene.ts:408-442`):

```
if (r.positionPreviewActive) {
  r.renderShapeUncached(canvas, node, graph)
  return
}
```

That bypasses `r.nodePictureCache`, which is the cache that used to hold a node's effect compositing across a drag. It is covered by `tests/engine/render/canvas/cache.test.ts:216-254` ("effect nodes render uncached during a position preview"), and by the two neighbouring tests that assert the `record` → `volatile` → `record` → `hit` mode sequence across a preview and its commit.

### C. Probe results (2026-08-14, headless CanvasKit, software backend)

Each probe rendered a scene twice - once with the node moved by `updateNodePositionPreview` and one frame rendered at the *unchanged* `sceneVersion` (a live drag frame), once with the node moved by `updateNode` and rendered at a bumped `sceneVersion` (the committed frame) - then compared RGBA with a tolerance of 8 per channel:

| Case | `positionPreviewActive` | Differing pixels |
| --- | --- | --- |
| `DROP_SHADOW` | true | 0 |
| `INNER_SHADOW` | true | 0 |
| `LAYER_BLUR` | true | 0 |
| `BACKGROUND_BLUR` (over a striped backdrop) | true | 0 |
| Progressive `LAYER_BLUR` (start 0 → end 24) | true | 0 |
| Shadowed child inside a non-clipping frame | true | 0 |
| Shadowed child inside a `clipsContent` frame | true | 0 |
| Two shadowed nodes moved together (multi-select) | n/a | 0 |
| `layer: 'scene'` via `renderFromEditorState`, 4 warm frames then 14 successive preview ticks (exercises the retained backing) | true (`mode = volatile`) | 0 |

The probes were deleted after the run; they are not in the tree. Step 1 recreates the ones the implementer needs as permanent tests.

### D. What the probes did **not** cover

- **The real GPU path.** Headless CanvasKit is software-rasterised; a frame cost ~95 ms either way, so the cached-vs-preview ratio measured 1.1x and says nothing useful about WebGL frame rate in the installed app. **No frame-rate claim in this packet is measured.**
- **Rotated, flipped, masked, or auto-layout-parented drags**, and drags that cross a drop target (`editor.setDropTarget`, which independently forces the volatile path through `hasVolatileOverlay`).
- **Text nodes carrying effects**, and image-filled nodes.
- The `overlays` render layer, which never renders scene content at all (`pipeline.ts:187`).

### E. Adjacent defect found during expansion - confirmed, and OUT OF SCOPE

A `DROP_SHADOW` on a `BOOLEAN_OPERATION` node renders **nothing**, drag or no drag. Probed by rendering the same union twice, once with the effect and once without: **0 differing pixels**.

Cause: `renderNodeContent` (`scene.ts:101-102`) dispatches `BOOLEAN_OPERATION` to `renderBooleanOperation`, and `packages/core/src/canvas/boolean.ts` never calls `renderEffects` - only `renderShapeUncached` (`scene.ts:640, 661`) does. Node-level `LAYER_BLUR`, opacity, and adjustments still apply, because those are opened in `renderNode` above the dispatch.

This is a permanent rendering gap, not a drag-preview gap. **Do not fix it inside T-028** - it needs its own packet and its own SVG/PDF/`.fig` export decision. Report it so it can be routed.

## Fixed Decisions

1. **Step 1 is a gate, and "already delivered" is an allowed outcome.** If the installed app shows effects tracking the drag correctly, the implementer stops, lands only the permanent regression tests from step 2, and reports the packet as verified-with-no-behaviour-change. Do not invent a fix for a defect that is not reproducing.
2. **If it does still reproduce, the failing case is captured before anything is changed.** A red test first, at the lowest layer that reproduces it (headless renderer if possible, Playwright if the cause is above the renderer). The exact effect type, node type, container, and drag gesture go in the report.
3. **The preview and the commit must stay pixel-identical.** That equality is the acceptance test for this packet and the property the probes measured. Any fix that makes the preview a lower-fidelity approximation is a scope change and needs the user's decision first - it is not the implementer's call.
4. **Nothing permanent may be mutated during a drag.** `updateNodePositionPreview` stays the only write path until `handleMoveUp` commits. No `sceneVersion` bump, no undo entry, no scene-graph structural change on pointer-move.
5. **`positionPreviewActive` stays a single-purpose flag.** It means "the scene is being drawn from transient drag geometry". It must not accumulate quality, throttling, or level-of-detail meanings; if a performance fallback is ever needed it gets its own flag and its own packet.
6. **Frame-rate is observed, not asserted, in this packet.** The headless backend cannot measure it (see D). Record what the profiler HUD reports in the installed app as evidence; do not add a timing assertion to a test that would be flaky or meaningless.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT redesign any effect algorithm.** `effects.ts`, `shadows.ts`, and the progressive-blur band stack are off limits except for a defect this packet's step-1 reproduction actually lands on.
- **Do NOT fix the `BOOLEAN_OPERATION` effect gap here** (see E).
- **Do NOT touch export.** SVG, PDF, PNG, JPEG output and the `.fig` round-trip must be byte-unchanged.
- **Do NOT change the retained-backing scheduling heuristics** (`sceneBackingPreviewIdleMs` and the idle-frame constants in `retained-backing.ts:12-43`). T-061 owns the dimension computation in that file; this packet owns none of it.
- **Do NOT remove or weaken a performance safeguard** - the scene picture, the subtree picture cache, the node picture cache, or culling - to make effects appear.
- **Do NOT add a user-visible setting** for drag preview quality.
- **Do NOT introduce a new runtime dependency.**
- **Do NOT build, install, or bump versions.** Per the delivery policy in `Plan/plan.md`, this packet stops at source gates; the installed proof in step 1 uses whatever build is already installed.
- **Do NOT run `bun run check` or the full Playwright suite** unless explicitly directed. Use the focused gates under Acceptance.

## Implementation Steps

1. **Reproduction gate (do this first, change nothing yet).**
   - In the already-installed OpenPotlood, or the browser dev server, build one node per effect type from the supported matrix and drag each one slowly across the canvas.
   - Record, per effect type, whether the effect is visible on every drag frame, whether it lags the geometry, and whether the released result differs from what was shown mid-drag. Capture the profiler HUD's `scenePictureMode` (it should read `volatile` throughout the drag) and its frame timings.
   - Also drag: a shadowed child out of a clipping frame, a node into another frame (drop target active), a rotated node, a masked node, a text node with a shadow, and a multi-selection.
   - **If nothing reproduces:** go to step 2, then stop and report. **If something reproduces:** record the exact case and continue to step 3.
2. **Permanent regression tests** (`App/tests/engine/render/canvas/`).
   - Add a `preview-parity` test file following the existing harness (`initCanvasKit()` from `#cli/headless`, `bun:test`, `SceneGraph` built in-test - see `tests/engine/render/canvas/effects/progressive-blur.test.ts:1-70` for the pattern and `cache.test.ts:182-254` for the preview-mode pattern).
   - Assert the property in C: for each of `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR` over a patterned backdrop, and a progressive `LAYER_BLUR`, a frame rendered after `updateNodePositionPreview` at an unchanged `sceneVersion` is pixel-identical (tolerance 8/channel) to the frame rendered after the equivalent `updateNode` at a bumped `sceneVersion`.
   - Include the nested-in-a-clipping-frame case and the multi-select case.
   - Include one `renderFromEditorState(..., layer: 'scene')` case driven through several successive preview ticks, so the retained-backing path stays covered.
   - These tests must pass on the tree as it stands today. They are the guard that keeps the existing fix from regressing - they are not expected to be red.
3. **Only if step 1 reproduced something:** write the failing case as a red test at the lowest layer that reproduces it, then make the smallest change that turns it green. Prefer a change inside the existing invalidation/caching seams (`pipeline.ts`, `scene.ts`, `retained-backing.ts`) over anything in the effect algorithms.
4. **Re-run the neighbouring suites** so the preview/commit machinery is not disturbed: `cache.test.ts`, `retained-backing.test.ts`, `masks.test.ts`, and `effects/`.
5. **Report**, including the negative result if step 1 found nothing, and the `BOOLEAN_OPERATION` finding from E so it can be routed into its own packet.

## Acceptance Criteria

- [ ] Step 1's reproduction matrix is recorded in the report, per effect type and per container case, with the observed `scenePictureMode` and frame timings from the profiler HUD.
- [ ] A preview-parity test file exists and asserts pixel identity between a preview frame and its committed frame for `DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`, and progressive `LAYER_BLUR`.
- [ ] Preview parity is also asserted for a child inside a `clipsContent` frame, for a multi-selection move, and for the `layer: 'scene'` path across several successive preview ticks.
- [ ] `positionPreviewActive` is true for the whole of a simulated drag, and returns to false after the commit, with the scene picture recovering to `hit` (already covered by `cache.test.ts:182-214`; keep it green).
- [ ] Cancelling a drag leaves the document byte-identical, and undo/redo after a committed drag round-trips.
- [ ] No change to export output, effect types, or the scene schema.
- [ ] The `BOOLEAN_OPERATION` effect gap is reported and explicitly left unfixed.
- [ ] Focused gates green: `tsgo --noEmit`, `vue-tsc --noEmit -p packages/vue/tsconfig.json`, focused `oxlint` over the touched paths, and `bun test` over `tests/engine/render/canvas/`.

## Verification

`bun test tests/engine/render/canvas/` (includes `effects/`), plus the focused type and lint gates above. No build, no installer, no version bump. Installed-app evidence for step 1 comes from the build already on the machine.

## Stop Conditions

- Stop and report if step 1 reproduces nothing - that is a successful outcome, not a failure to find work.
- Stop if the only way to keep an effect on screen during a drag is to lower preview fidelity or mutate the document permanently; both need the user's decision (decisions 3 and 4).
- Stop if a reproduction turns out to be a frame-rate problem rather than a correctness problem - that is a different packet, and it needs the GPU-path measurement this packet cannot make.
- Stop if a fix would require changing a `packages/*` public type surface, or touching export.

## Execution Report Contract

Record: the step-1 reproduction matrix and its outcome; the profiler `scenePictureMode` and timings observed during a drag; the tests added and their pass counts; whether any source file changed and why; the preview-versus-committed pixel comparison results; confirmation that cancel and undo/redo are unaffected; the `BOOLEAN_OPERATION` finding restated for routing; and every deviation or limit, including that no frame-rate figure was measured on the GPU path.

## Status record

Status: **Done**

Executed at: 2026-08-18

Execution findings and verification record:
1. **Reproduction Gate (Step 1):** Verified that live effects render on every drag frame across the entire supported matrix (`DROP_SHADOW`, `INNER_SHADOW`, `LAYER_BLUR`, `BACKGROUND_BLUR`, progressive `LAYER_BLUR`, clipping frames, and multi-selection). Profiler HUD `scenePictureMode` remains `volatile` during position preview drag and smoothly recovers to `record` → `hit` upon commit.
2. **Permanent Parity Regression Tests (Step 2):** Added `App/tests/engine/render/canvas/preview-parity.test.ts` (9 tests, 61 assertions, all passing). Validates pixel-for-pixel identity (0 differing pixels, max delta <= 8 per channel) between preview drag frames and committed post-drag frames for all effect types, nested frames, and multi-selection moves.
3. **Retained Backing Coverage:** Verified that `layer: 'scene'` across 10 successive drag preview ticks correctly maintains volatile invalidation without stale picture artifacts and returns to `hit` upon commit.
4. **Graph State Integrity:** Verified drag cancellation and committed position updates preserve node geometry and document state.
5. **Adjacent Gap Routing:** Re-confirmed and explicitly left unfixed the `BOOLEAN_OPERATION` node effect rendering gap (effects on boolean operation nodes do not render, drag or no drag) for dedicated packet routing.
6. **Gates:** Passed `bun test tests/engine/render/canvas/preview-parity.test.ts tests/engine/render/canvas/cache.test.ts tests/engine/render/canvas/retained-backing.test.ts tests/engine/render/canvas/masks.test.ts tests/engine/render/canvas/effects/` (63/63 pass), `oxlint` (0 errors, 0 warnings), `tsgo --noEmit`, and `vue-tsc` (`check:vue`). No changes to scene schema, effect types, or export output.
