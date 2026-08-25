# T-061 - CanvasKit memory management, effect cache bounds, and surface stability

Task ID: T-061
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: nothing
Related: T-028 (render-path pressure), T-037 (progressive blur, the effect whose handle drag drives cache growth), T-048 (stroke gradients - will add the first stroke-side shader)
Prepared from: the 2026-08-14 diagnostic audit of engine crash vectors and WebAssembly heap exhaustion under extended usage
Expanded at: 2026-08-14
Re-verified at: 2026-08-14 (all findings still hold; three line-number drifts corrected below)

## Re-verification note (2026-08-14)

This packet was already fully expanded at revision 2. A re-read of the live tree confirms every finding still stands - six shader allocation sites in `fills.ts` and no others outside `effects.ts`, both filter caches still uncapped, `SCENE_BACKING_SCALE = 3`, zero occurrences of `webglcontextlost`/`webglcontextrestored` anywhere under `packages/vue/src` or `src`, and `dispose` still resolving to `disposeDocumentIO`. Corrections to anchors only:

- The cache declarations are `renderer.ts:82-83`, not `81-82`. `activeFillShader` and `maxTextureSize` are to be added beside them.
- `dispose: documentIO.disposeDocumentIO` is `src/app/editor/session/modules.ts:86`, not `85`.
- Section B's reference to "`effects.ts:87/94`" is imprecise: line 87 is the only `Shader` allocation there (deleted at line 102). Line 94 is `ImageFilter.MakeShader`, an image filter, also correctly deleted. Nothing changes in the work; the count of shader sites to fix is six.

No other content in this packet needs revision - it is ready to implement as written.

## Intended Outcome

The application stays stable and bounded in memory during long design sessions: heavy zooming and panning, dragging effect sliders and the progressive-blur handle, resizing nodes with effects, gradient and image fills on screen, and many tabs opened and closed. Specifically - render loops release every C++ `SkShader` they allocate, the effect filter caches are bounded and evict with disposal, retained backing surfaces stay inside GPU texture limits on high-DPI displays, WebGL context loss is survivable, and discarding a tab frees its image bytes and undo history.

## Verified Starting State

Verified against the working tree on 2026-08-14. Line numbers are from that read; re-check them before editing, but the named functions are stable anchors.

### A. Shader leaks - confirmed, six sites, all in one file

`App/packages/core/src/canvas/fills.ts` allocates a `Shader` and hands it to `r.fillPaint.setShader(...)` without ever calling `.delete()` on the JS wrapper:

| Line | Call | Path |
| --- | --- | --- |
| 204-211 | `picture.makeShader(...)` | `applyPatternFill` |
| 285-292 | `r.ck.Shader.MakeLinearGradient` | `applyGradientFill`, `GRADIENT_LINEAR` |
| 298-306 | `r.ck.Shader.MakeRadialGradient` | `applyGradientFill`, `GRADIENT_RADIAL` / `GRADIENT_DIAMOND` |
| 309-317 | `r.ck.Shader.MakeSweepGradient` | `applyGradientFill`, `GRADIENT_ANGULAR` |
| 391-398 | `img.makeShaderCubic(...)` | `applyImageFill`, `TILE` scale mode |
| 402-409 | `img.makeShaderOptions(...)` | `applyImageFill`, every other scale mode |

`grep` for `Shader.Make|makeShader` across `packages/core/src` and `packages/vue/src` returns these six plus `effects.ts:87/94`, which **already** deletes correctly (`effects.ts:101-103`). There are no other shader allocation sites.

The three places that consume a fill and then clear the paint:

- `packages/core/src/canvas/scene.ts:29-45` - `drawVisibleFills`: `r.applyFill(...)` → draw → `r.fillPaint.setShader(null)` (line 42). The wrapper is dropped, never deleted. This is the 60 FPS path.
- `packages/core/src/canvas/boolean.ts:301-306` - same shape, for boolean-operation fills.
- `packages/core/src/canvas/fills.ts:155-165` - `recordPatternSource` calls `applyFill` per source fill inside the pattern recorder and never clears or deletes.

### B. Corrections to revision 1 of this packet

Three claims in the previous revision are wrong and must not be carried into the implementation:

1. **`packages/core/src/canvas/strokes.ts` has no shader code at all.** `grep -n "Shader" strokes.ts` returns nothing; every stroke path calls `setShader(null)` and paints a solid colour (`scene.ts:461`, `scene.ts:518`, `scene.ts:534`). Stroke gradients do not exist yet - that is T-048. **Do not edit `strokes.ts` for this packet.**
2. **Panning and zooming do not grow the effect caches.** `getCachedProgressiveBlur`'s key is built from `ramp.startRadius`, `ramp.endRadius` and `progressiveBlurAxis(ramp, width, height)`, and `progressiveBlurAxis` (`packages/scene-graph/src/progressive-blur.ts:126-136`) multiplies the ramp offsets by the **node's** width and height. Viewport pan and zoom leave the key unchanged. The genuine unbounded-growth vectors are continuous *parameter* change: dragging the on-canvas progressive-blur handle (moves `startOffset`/`endOffset`), resizing a node that carries a progressive blur (moves `width`/`height`), and dragging a radius/offset/colour slider - which also feeds `getCachedDropShadow` (`effects.ts:20`), `getCachedBlur` (`effects.ts:30`), `getCachedDecalBlur` (`effects.ts:40`) and `getCachedMaskBlur` (`effects.ts:123`) unbounded float keys. The cap is still required; the justification changes, and so does the reproduction used to test it.
3. **`store.dispose()` does not "only unbind file watchers" - it is narrower than that.** `dispose` is `documentIO.disposeDocumentIO` (`src/app/editor/session/modules.ts:85`), which is `stopWatchingFile(); disposeAutosave()` (`src/app/document/io/source.ts:110-113`). It touches neither the graph, nor undo, nor the renderer.

### C. Effect caches - unbounded, confirmed

`packages/core/src/canvas/renderer.ts:81-82`:

```
imageFilterCache = new Map<string, ImageFilter | null>()
maskFilterCache = new Map<number, MaskFilter | null>()
```

Neither has a size cap. Every `getCached*` in `effects.ts` inserts and never evicts. They are only ever emptied in `destroyRenderer` (`packages/core/src/canvas/renderer/lifecycle.ts:69-72`), i.e. when the surface goes away.

There is already a bounded-cache precedent in this codebase to copy rather than invent: `prepareAdjustmentLayer` in `packages/core/src/canvas/adjustments.ts:75-81` caps `adjustmentRuntimeEffects` at `MAX_PROGRAMS`, evicting the oldest inserted key and calling `.delete()` on it. Match that shape.

### D. Retained backing surface - unbounded against hardware, confirmed

`packages/core/src/canvas/renderer/retained-backing.ts`:

- `SCENE_BACKING_SCALE = 3` (line 12).
- `sceneBackingGeometry` (line 156-175) computes `width = viewportWidth * 3`, `height = viewportHeight * 3` in CSS pixels.
- `createSceneBackingSurface` (line 177-185) then requests `Math.ceil(width * r.dpr) × Math.ceil(height * r.dpr)` from `r.surface.makeSurface({...})`.

At a 2560×1440 CSS viewport with `dpr = 2` that is 15360×8640 device pixels - past the 8192 limit common on integrated GPUs and past 16384 in one axis on many others. `makeSurface` returns `Surface | null` and the null case is handled (the caller falls back), so the failure mode is a silently missing backing and a permanent slow path, not necessarily a crash - but the allocation attempt itself is the VRAM spike. Nothing in the file reads `MAX_TEXTURE_SIZE`.

Note that `EditorCanvas.vue:52-66` mounts **two** surfaces per editor (`layer: 'scene'` and `layer: 'overlays'`), so surface cost is paid twice. Only the `scene` layer builds a retained backing (`updateSceneBackingPreviewState` returns early for any other layer, line 46).

### E. WebGL context loss - no handling, confirmed

`packages/vue/src/canvas/surface/lifecycle.ts` (whole file read) binds no `webglcontextlost` or `webglcontextrestored` listener; `grep` across `packages/vue/src` finds neither string anywhere. The surface manager already owns exactly the recovery primitives needed:

- `createSurface(canvas, { reloadFonts: true })` - full rebuild including font reload (line 53-93).
- `state.glContext?.delete()` - releases the `GrContext` (line 63).
- `renderLoop.pause()` / `renderLoop.markDirty()` - stop and restart painting.
- `resizeCanvas` already demonstrates the "surface came back null, rebuild everything" path (line 137-141).

Context creation lives in `packages/vue/src/canvas/surface/gl-surface.ts:82-127` (`makeGLSurface`).

### F. Tab disposal - shallow, confirmed

`store.dispose()` resolves to `stopWatchingFile(); disposeAutosave()` (see B3). It is called from four places in `src/app/tabs/index.ts` - line 110 (tab-limit rejection), 158 (evicting a closed tab past the dirty prompt), 178 (closed-tab stack overflow) and 199 (`discardTab`). None of them free:

- `graph.images` - `Map<string, Uint8Array>` (`packages/scene-graph/src/index.ts:73`), the raw encoded bytes of every imported image, which is the single largest per-document allocation.
- The undo and redo stacks - `UndoManager.clear()` already exists (`packages/scene-graph/src/undo.ts:98-102`) and is the correct call. The stack is length-trimmed (`trimUndoStack`), so this is bounded, but each entry closes over scene state.

`r.imageCache` (decoded `CKImage`s) belongs to the **renderer**, not the store, and is keyed by image hash and shared across tabs on the same surface. It is freed in `destroyRenderer`. **Tab disposal must not touch it** - a hash still referenced by another open tab would go blank.

## Fixed Decisions

1. **Shader ownership is tracked on the renderer, not returned from `applyFill`.**
   `applyFill` returns `boolean` and three call sites depend on that meaning "a paint was configured" - which is also true for solid fills, which allocate no shader. Changing the return type to `Shader | null` conflates "no shader" with "did not apply". Instead:
   - Add `activeFillShader: Shader | null = null` to `SkiaRenderer` (`packages/core/src/canvas/renderer.ts`, beside `imageFilterCache` at line 81).
   - Add two helpers in `fills.ts`, exported: `setFillShader(r, shader)` - assigns `r.fillPaint.setShader(shader)` and stores it on `r.activeFillShader` after releasing any previous one; and `releaseFillShader(r)` - calls `r.fillPaint.setShader(null)`, then `r.activeFillShader?.delete()`, then nulls the field.
   - All six allocation sites call `setFillShader`. All three consumption sites replace their bare `r.fillPaint.setShader(null)` with `releaseFillShader(r)`.
   - Order is binding: **draw first, then `setShader(null)`, then `delete()`.** The `Paint` holds its own `sk_sp` reference, so this order is safe and any other order is not worth the risk.

2. **Bounded caches use the `adjustments.ts` shape, capacity 128.**
   - `MAX_CACHED_IMAGE_FILTERS = 128` and `MAX_CACHED_MASK_FILTERS = 128`, declared in `effects.ts`.
   - Eviction is oldest-inserted-first (`map.keys().next().value`), matching `adjustments.ts:76-80`. Not true LRU - insertion order is sufficient here and re-uses a pattern already in the codebase. Every evicted entry gets `.delete()` called.
   - Eviction runs **after** the new entry is inserted, so the entry being returned to the caller is always the newest and can never be its own victim.

3. **Cache keys are quantised at the source of the churn.**
   - Radii and sigmas quantise to 0.5 (`Math.round(v * 2) / 2`). A half-unit blur-radius difference is not visible.
   - Progressive-blur axis coordinates quantise to whole node-local pixels (`Math.round(v)`).
   - Quantisation applies **to the key only**. The filter is still built from the exact values, so nothing on screen changes. This is what makes the change safe to make invisible.

4. **Backing surface dimensions are clamped to the smaller of the hardware limit and 4096.**
   - `MAX_SCENE_BACKING_DIMENSION = 4096` device pixels.
   - Read the real limit once per renderer via `gl.getParameter(gl.MAX_TEXTURE_SIZE)` where a GL context is available (`SkiaRenderer` already receives one - `new SkiaRenderer(ck, surface, glCtx)`, `lifecycle.ts:80`), and use `Math.min(hardwareLimit ?? 4096, 4096)`. No GL context (software backend, headless tests) means fall back to 4096.
   - When the requested size exceeds the cap, **shrink the margin, not the viewport**: reduce the effective `SCENE_BACKING_SCALE` so that `viewport * scale * dpr` fits, with a floor of 1.0 (viewport-sized, no margin). The backing must always cover at least the live viewport or `backingCoverageContainsLiveViewport` will reject it every frame and the retained path becomes dead weight.
   - The computed geometry and the surface allocation must agree - `sceneBackingGeometry` and `createSceneBackingSurface` both need the clamped scale, or the recorded `width`/`height` metadata will not match the pixels.

5. **Context loss recovery reuses the existing rebuild path.**
   - `webglcontextlost`: `event.preventDefault()` (without it the browser will not restore), `renderLoop.pause()`, mark the manager as context-lost, and null out `state.glContext` **without** calling `.delete()` on it - the underlying GL objects are already gone and deleting through a dead context is the crash this packet exists to avoid.
   - `webglcontextrestored`: clear the flag, then `createSurface(canvas, { reloadFonts: true })` followed by `renderNow()`. That path already destroys the stale renderer, rebuilds the `GrContext`, reloads fonts and repaints.
   - Listeners are attached where the canvas element is known and removed in `destroy()`. Both layers (`scene` and `overlays`) get them, since both own a surface.
   - While the context is lost, `renderNow()` must return early. Painting into a dead surface is undefined behaviour.

6. **Tab disposal frees document-owned memory only.**
   - Extend the store's `dispose` to additionally call `graph.images.clear()` and `editor.undo.clear()` after the existing `stopWatchingFile()` / `disposeAutosave()`.
   - `r.imageCache` and every other renderer-owned cache are **out of scope** - they are shared across tabs and freed by `destroyRenderer`. See F.
   - `dispose` must stay safe to call on a store whose tab was never activated (line 110 calls it on a store that never reached a canvas).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT touch WebView2 browser args in `App/desktop/tauri.conf.json`.** `--ignore-gpu-blocklist`, `--enable-gpu-rasterization` and `--enable-zero-copy` stay exactly as they are.
- **Do NOT edit `packages/core/src/canvas/strokes.ts`.** It contains no shader code (see B1).
- **Do NOT change the signature or return type of `applyFill`, `applyGradientFill` or `applyImageFill`.** They are re-exported through `renderer.ts:315-317` and `renderer/methods.ts:219-228` and appear in published `.d.ts` surfaces.
- **Do NOT clear `r.imageCache`, `r.vectorPathCache`, `r.nodePictureCache` or any other renderer-owned cache from tab disposal.**
- **Do NOT change what any of this renders.** No visual output may differ. Quantisation is key-only; clamping changes surface size, not what is drawn into it.
- **Do NOT introduce a new runtime dependency.**
- **Do NOT add UI, settings, or user-visible controls.** There is no preference for cache size or backing scale.
- **Do NOT run `bun run check`, `bun run test`, or `bun run check:upstream`** unless explicitly directed. Use the focused gates listed under Acceptance.
- **Do NOT rewrite the retained-backing scheduling heuristics** (`sceneBackingPreviewIdleMs`, the idle-frame constants, `updateSceneBackingPreviewState`). Only the dimension computation is in scope.

## Implementation Steps

Each step is independently verifiable. Land them in order; the shader work is the highest value and the lowest risk.

1. **Shader lifecycle** (`packages/core/src/canvas/renderer.ts`, `canvas/fills.ts`, `canvas/scene.ts`, `canvas/boolean.ts`)
   - Add `activeFillShader: Shader | null = null` to `SkiaRenderer`.
   - Add exported `setFillShader(r, shader)` and `releaseFillShader(r)` to `fills.ts` per decision 1.
   - Replace all six `r.fillPaint.setShader(shader)` calls in `fills.ts` with `setFillShader(r, shader)`.
   - Replace `r.fillPaint.setShader(null)` with `releaseFillShader(r)` at `scene.ts:42`, `boolean.ts:306`, and add a `releaseFillShader(r)` after the per-fill draw in `recordPatternSource` (`fills.ts:162`).
   - `applyFill`'s own entry-guard `r.fillPaint.setShader(null)` (line 75) becomes `releaseFillShader(r)` so a shader left over from a previous fill is disposed rather than orphaned.
   - Add `releaseFillShader(r)` to `destroyRenderer` (`renderer/lifecycle.ts`) before `r.fillPaint.delete()`.

2. **Bounded, quantised effect caches** (`packages/core/src/canvas/effects.ts`)
   - Add a small local helper `setBounded(map, key, value, max)` implementing decision 2, used by every `getCached*`.
   - Quantise per decision 3: sigma/radius keys in `getCachedDropShadow`, `getCachedBlur`, `getCachedDecalBlur`, `getCachedMaskBlur`; axis coordinates and radii in `getCachedProgressiveBlur`.
   - Keep the existing early-return fallback in `getCachedProgressiveBlur` (degenerate axis → `getCachedBlur`) untouched.

3. **Clamped backing surface** (`packages/core/src/canvas/renderer/retained-backing.ts`, `packages/core/src/canvas/renderer.ts`)
   - Add a `maxTextureSize` field to `SkiaRenderer`, populated once from the GL context if present, else `4096`.
   - Introduce `effectiveSceneBackingScale(r)` returning a scale in `[1, SCENE_BACKING_SCALE]` such that `ceil(viewport * scale * dpr) <= min(maxTextureSize, 4096)` on both axes.
   - Use it in `sceneBackingGeometry` and let `createSceneBackingSurface` allocate from the geometry it produced, so metadata and pixels cannot drift apart.

4. **WebGL context loss recovery** (`packages/vue/src/canvas/surface/lifecycle.ts`)
   - Implement decision 5 inside `createCanvasSurfaceManager`: a `contextLost` flag, the two listeners attached when a canvas is first given a surface, removal in `destroy()`, and the early return in `renderNow()`.

5. **Tab disposal** (`App/src/app/editor/session/modules.ts`)
   - Replace the bare `dispose: documentIO.disposeDocumentIO` with a wrapper that calls it, then `graph.images.clear()` and `editor.undo.clear()`. `graph` and `editor` are already parameters of `createEditorStoreModules`.

6. **Focused tests** (`App/tests/engine/render/canvas/`)
   - Follow the existing harness: `initCanvasKit()` from `#cli/headless`, `bun:test`, fixtures via `repoPath` - see `tests/engine/render/canvas/cache.test.ts:1-38`.
   - Shader disposal: render a gradient-filled and an image-filled node repeatedly; assert `r.activeFillShader` is `null` after each render pass and that a pixel comparison against a single-pass render is unchanged.
   - Cache bounds: call `getCachedBlur` / `getCachedProgressiveBlur` with 300 distinct parameter values and assert `r.imageFilterCache.size <= 128`; assert that two calls whose parameters differ by less than the quantisation step return the identical object.
   - Backing clamp: drive `effectiveSceneBackingScale` (or the geometry function) with a large viewport and `dpr = 2` and assert both dimensions land at or under 4096 and that the geometry still covers the viewport.

## Acceptance Criteria

- [x] All six `fills.ts` shader allocations route through `setFillShader`, and `grep -n "setShader" packages/core/src/canvas/` shows no bare `fillPaint.setShader` outside the two helpers (stroke-paint calls are expected and stay).
- [x] Repeated rendering of gradient, image, pattern and boolean-filled nodes leaves `r.activeFillShader === null` and leaks no `SkShader`.
- [x] `imageFilterCache` and `maskFilterCache` stay at or under 128 entries while a progressive-blur handle, a shadow-offset slider and a node resize are driven continuously; evicted entries are deleted.
- [x] Two effect parameter sets within one quantisation step share a cache entry, and the rendered output is unchanged against the pre-change baseline.
- [x] The retained scene backing never requests a surface larger than `min(MAX_TEXTURE_SIZE, 4096)` on either axis at `dpr = 2`, and still covers the live viewport (the retained path does not go permanently cold).
- [x] `webglcontextlost` and `webglcontextrestored` are bound on both canvas layers, `preventDefault()` is called on loss, no `GrContext.delete()` runs against a lost context, and a simulated loss/restore cycle repaints without an unhandled exception.
- [x] Discarding or evicting a tab clears `graph.images` and the undo/redo stacks, and leaves another open tab's images rendering correctly.
- [x] No visual regression: existing `tests/engine/render/canvas/` expectations, including `effects/progressive-blur.test.ts` and `gradient.test.ts`, pass unchanged.
- [x] Focused gates green: `tsgo --noEmit`, `vue-tsc --noEmit -p packages/vue/tsconfig.json`, focused `oxlint` over the touched paths, and `bun test` over `tests/engine/render/canvas/`.

## Stop Conditions

- Stop if deleting a shader after `setShader(null)` produces a use-after-free or a blank fill in any renderer test - the ownership assumption in decision 1 would be wrong, and the rest of the packet does not depend on it.
- Stop if clamping the backing scale makes `backingCoverageContainsLiveViewport` fail every frame; a permanently cold retained path is a worse regression than the allocation it avoids.
- Stop if `MAX_TEXTURE_SIZE` cannot be read on the software/headless backend without pulling a GL context into `packages/core` - fall back to the flat 4096 and record that in the packet rather than adding a dependency.
- Stop and report if any step requires changing a `packages/*` public type surface.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-17: six fills.ts shader allocations routed through setFillShader with releaseFillShader across all render/boolean/pattern/lifecycle paths; imageFilterCache and maskFilterCache capped at 128 with deletion and 0.5/integer parameter quantisation; effectiveSceneBackingScale clamped to min(maxTextureSize, 4096) on high-DPI; webglcontextlost/restored recovery on canvas manager; tab disposal frees graph images and undo stacks; tsgo, vue-tsc, focused oxlint, and 66/66 canvas/effect tests green including 14/14 new stability tests)
