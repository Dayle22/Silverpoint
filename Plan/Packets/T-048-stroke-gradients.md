# T-048 - Gradients on strokes

Task ID: T-048
Packet state: Superseded — scope map only; execute T-048a through T-048d
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none (does not require T-061 to land first; see Fixed Decision 4 on the shader-lifecycle interaction)
Related: T-049 (curved gradient type builds on this packet's stroke-paint plumbing if ever extended to strokes, but T-049 itself is fill-only), T-061 (CanvasKit memory/shader-lifecycle remediation; T-048 is the first packet to put a `Shader` on `strokePaint` and must not repeat the leak T-061 fixes on `fillPaint`)
Prepared from: `Plan/Packets/T-048-stroke-gradients.md` (brief)
Expanded at: 2026-08-15
Expanded against: `App/packages/scene-graph/src/types.ts`, `App/packages/scene-graph/src/copy.ts`, `App/packages/scene-graph/src/geometry.ts`, `App/packages/core/src/canvas/fills.ts`, `App/packages/core/src/canvas/strokes.ts`, `App/packages/core/src/canvas/scene.ts`, `App/packages/core/src/canvas/boolean.ts`, `App/packages/core/src/canvas/renderer.ts`, `App/packages/core/src/canvas/renderer/lifecycle.ts`, `App/packages/core/src/canvas/renderer/colors.ts`, `App/packages/core/src/io/formats/svg/defs.ts`, `App/packages/core/src/io/formats/svg/export.ts`, `App/packages/core/src/io/formats/pdf/export.ts`, `App/packages/kiwi/src/fig/schema/fig.kiwi`, `App/packages/core/src/kiwi/fig/node-change/paint.ts`, `App/packages/core/src/kiwi/fig/node-change/serialize.ts`, `App/packages/core/src/kiwi/fig/node-change/export-node.ts`, `App/src/components/properties/StrokeSection.vue`, `App/src/components/properties/FillSection.vue`, `App/src/components/properties/paint/binding.ts`, `App/src/components/ColorPicker/ColorPicker.vue`, `App/src/components/fill-picker/FillPicker.vue`, `App/src/components/fill-picker/GradientEditor.vue`, `App/packages/vue/src/primitives/Fill/useFill.ts`, `App/packages/vue/src/primitives/Fill/FillSwatch.vue`, `App/packages/vue/src/primitives/GradientEditor/GradientEditorRoot.vue`, `App/packages/vue/src/primitives/GradientEditor/useGradientStops.ts`, `App/packages/vue/src/controls/stroke/helpers.ts`, `App/packages/vue/src/controls/color-model/model.ts`, `App/tests/e2e/stroke-picker/basic.spec.ts`, `App/tests/engine/io/fig/import/legacy/strokes.test.ts`, `App/tests/engine/render/canvas/gradient.test.ts`, `Plan/Packets/T-041-gradient-handle-cursors.md`, `Plan/Packets/T-061-canvaskit-memory-and-stability.md`
Delivery: source gates only

## Intended Outcome

A stroke can be given a gradient paint (linear, radial, angular, diamond — the same four subtypes fills already offer) through the Stroke property panel, and that gradient renders correctly on screen, in SVG export, in PDF export, and round-trips through `.fig` import/export, for every node type whose stroke is drawn through the regular (non-vector-outline) stroke path.

## Request Coverage

- Allow a stroke to use a gradient paint, not only a solid colour.

## Verified Starting State

### The decisive question: the paint model is not stroke-gradient-capable — only `Fill` carries gradient fields

`App/packages/scene-graph/src/types.ts:139-161` (`Fill`) and `:167-176` (`Stroke`) are two structurally unrelated interfaces:

```ts
export interface Fill {
  type: FillType
  color: Color
  opacity: number
  visible: boolean
  blendMode?: BlendMode
  gradientStops?: GradientStop[]
  gradientTransform?: GradientTransform
  imageHash?: string
  // ...pattern/noise/image fields
}

export interface Stroke {
  color: Color
  weight: number
  opacity: number
  visible: boolean
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE'
  cap?: StrokeCap
  join?: StrokeJoin
  dashPattern?: number[]
}
```

`Stroke` has no `type`, `gradientStops`, or `gradientTransform`. Every stroke is implicitly solid. This is the stub's decisive Expansion Question, answered: **the model is solid-only, not just the UI.** `App/packages/scene-graph/src/copy.ts:37-43` (`copyStroke`) confirms this independently — it deep-copies only `color` and `dashPattern`, unlike `copyFill` (`copy.ts:27-35`) which also deep-copies `gradientStops`/`gradientTransform`/`imageTransform`/etc. `App/packages/scene-graph/src/geometry.ts` never references gradient fields on `Stroke` either.

### The renderer: confirmed solid-only, exactly as T-061 documented

`App/packages/core/src/canvas/strokes.ts` (whole file read) contains no `Shader` code — `grep -n "Shader" strokes.ts` returns nothing. Every stroke-drawing function (`drawDashedRRectWithSolidCorners`, `drawStyledRRectStroke`, `drawNodeStroke`, `drawStrokeWithAlign`, `drawRRectStrokeWithAlign`, `drawIndividualSideStrokes`) only ever calls `r.strokePaint.setColor(...)`. `Plan/Packets/T-061-canvaskit-memory-and-stability.md`'s finding stands and is independently reconfirmed here: `scene.ts:518` (`drawVectorPathStrokes`, dash branch) and `boolean.ts:313` (fixed-index re-read; see note below) call `r.strokePaint.setShader(null)`, never `MakeLinearGradient`/`MakeRadialGradient`/`MakeSweepGradient`.

There are, on closer reading, **two different mechanisms** by which "a stroke" ends up on screen, and only one of them uses `r.strokePaint`:

| Path | Paint used | Call sites |
| --- | --- | --- |
| **Regular stroke** — rectangles, ellipses, polygons/stars, frames, and any node whose `strokeGeometry` is empty | `r.strokePaint` (`setColor`, `setStrokeWidth`, `setStrokeCap/Join`, `setPathEffect`) | `App/packages/core/src/canvas/scene.ts:548-578` (`drawRegularStroke`), `strokes.ts:98-243` (`drawStyledRRectStroke`, `drawRRectStrokeWithAlign`, `drawIndividualSideStrokes`, `drawStrokeWithAlign`), `scene.ts:360-367` (`renderSection`), `scene.ts:382-389` (`renderComponentSet`), `App/packages/core/src/canvas/boolean.ts:309-316` |
| **Vector/geometry outline stroke** — `VECTOR` nodes stroked via their centerline, and any node with precomputed `strokeGeometry` (imported/complex paths) | `r.fillPaint` — the stroke is expanded into an *outline path* and then filled | `scene.ts:453-464` (`drawVectorStrokeGeometry`), `scene.ts:503-546` (`drawVectorPathStrokes`, both the dashed branch at 511-524 which still uses `strokePaint`, and the non-dashed branch at 526-545 which strokes the path with `.stroke()` and fills the result via `r.fillPaint`) |

This second path reuses the exact same `r.fillPaint` that node fills are drawn with, sequentially, later in the same render pass (`renderShapeUncached`, `scene.ts:642` draws fills first, then `forVisibleStrokes` at `:647-660`). Putting a gradient shader on `r.fillPaint` here would have to interoperate with T-061's planned `activeFillShader` bookkeeping on that same paint object — a materially different, riskier change than adding a parallel `activeStrokeShader` on `r.strokePaint`, which no other code path touches. See Restrictions for the scope cut this produces.

`App/packages/core/src/canvas/renderer.ts:72` declares `strokePaint: Paint` (a `declare` field). `App/packages/core/src/canvas/renderer/lifecycle.ts:38` calls `r.strokePaint.delete()` in `destroyRenderer`, alongside `r.fillPaint.delete()` at line 37.

`App/packages/core/src/canvas/renderer/colors.ts:46-71` already has a full `resolveStrokeColorInfo`/`resolveStrokeColor` pair, parallel to the fill versions, used for `boundVariables['strokes/N/color']`. This is unaffected by gradient stops (gradient stop colours are not currently variable-bindable for fills either — `applyGradientFill` resolves each stop through `resolveFillColorInfo` with the stop's own colour, `fills.ts:258-273`).

### The gradient math is already type-agnostic

`App/packages/core/src/canvas/fills.ts:249-319` (`applyGradientFill`) and its helpers `linearGradientEndpoints` (`:235-247`) and `makeGradientLocalMatrix` (`:216-233`) take `fill: Fill`, `node`, `graph` and write directly to `r.fillPaint`. Every line of gradient math (endpoint calculation, radial/angular local-matrix construction, per-stop colour resolution) is unconditional on `Fill` specifically — it only reads `.type`, `.gradientStops`, `.gradientTransform`, `.color`/`.opacity` fallbacks for stop resolution, and `node.width`/`node.height`. All of these exist (or will exist, per Fixed Decision 1) on `Stroke` too. This is the reason a stroke-side `applyStrokeGradientFill` can be a thin adapter rather than a re-derivation of the maths.

### The UI: `FillSection.vue` already has the pattern to copy; `StrokeSection.vue` has none of it

`App/src/components/properties/FillSection.vue:99-109` uses `FillPicker.vue` (`App/src/components/fill-picker/FillPicker.vue`), which renders three tabs — Solid / Gradient / Image (`:79-104`, `data-test-id="fill-picker-tab-solid/gradient/image"`) driven by `FillRoot` (`App/packages/vue/src/primitives/Fill/FillRoot.vue`, not read in full but its slot contract is exercised by `FillPicker.vue`) and `useFill` (`App/packages/vue/src/primitives/Fill/useFill.ts:48-91`, exposing `category`/`actions.toSolid/toGradient/toImage`). The Gradient tab renders `GradientEditor.vue` (`App/src/components/fill-picker/GradientEditor.vue`), which wraps `GradientEditorRoot` (`App/packages/vue/src/primitives/GradientEditor/GradientEditorRoot.vue`) and `useGradientStops` (`App/packages/vue/src/primitives/GradientEditor/useGradientStops.ts:9-20`, the `SUBTYPES` list: `GRADIENT_LINEAR`/`GRADIENT_RADIAL`/`GRADIENT_ANGULAR`/`GRADIENT_DIAMOND`).

`App/src/components/properties/StrokeSection.vue:105-180` uses the plain `ColorPicker.vue` (`App/src/components/ColorPicker/ColorPicker.vue`) — no tabs, no category switch, `ColorPickerRoot` + `ColorPickerPanel` only. There is no stroke equivalent of `FillPicker`/`FillRoot`/`useFill` anywhere in the tree (`grep -rn "StrokePicker\|StrokeRoot\|useStroke.*[Cc]ategory"` under `src/` and `packages/vue/src/` returns nothing beyond the existing `useStrokeControls` in `App/packages/vue/src/controls/stroke/use.ts`, which only covers align/sides/dash/default-stroke, not paint category).

`GradientEditorRoot.vue` and `useGradientStops` are typed to `fill: Fill` / `Ref<Fill>` throughout — they read `.type`, `.gradientStops`, `.gradientTransform`, `.color` and call `onUpdate(updated: Fill)`. Once `Stroke` carries `type`/`gradientStops`/`gradientTransform` (Fixed Decision 1), a `Stroke` value is structurally assignable to `Fill` wherever `Fill`'s declared fields are a subset of `Stroke`'s runtime shape (TypeScript structural typing permits this for non-literal values; `Stroke`'s extra fields — `weight`, `align`, `cap`, `join`, `dashPattern` — are simply ignored by code that only reads `Fill`'s fields, and survive unchanged through any `{...fill, ...}` spread since the spread operates on the real runtime object). This is what makes reusing `GradientEditorRoot`/`GradientEditorBar`/`GradientEditorStop` for strokes viable without duplicating them — see Fixed Decision 2.

### No on-canvas gradient handle exists for fills either — do not invent one for strokes

Per `Plan/Packets/T-041-gradient-handle-cursors.md`'s verified finding (independently spot-checked here against `App/packages/core/src/canvas/renderer/pipeline.ts` and a repeat of its `grep -rn "GRADIENT_LINEAR\|gradientHandle\|GradientHandle"` sweep): **there is no on-canvas gradient-fill handle anywhere in this app.** Gradient fills are edited exclusively through the popup `GradientEditorBar`/`GradientEditorStop` (`App/src/components/fill-picker/GradientEditor.vue:33-59`), which already carry working `cursor-grab`/`data-[dragging]:cursor-grabbing` (`GradientEditor.vue:51`). The stub's "same on-canvas gradient handle" language in its User-Visible Outcome is therefore **corrected**: stroke gradients get the same *popup bar* editing experience fills already have, not an on-canvas handle, because fills do not have one either. See Corrections to the Brief.

### `.fig` round-trip: schema already supports gradient stroke paints; the app's mapper on both sides discards them

`App/packages/kiwi/src/fig/schema/fig.kiwi:2278` declares `Paint[] strokePaints = 39;` using the exact same `message Paint` (`:980`) that `fillPaints` (`:2276`) uses — `Paint` already has a `type` field (gradient types included) and a `Gradient gradientValue`/`stops`/`transform` shape (`:3516-3521`, `:3347`). **The kiwi schema is not the gap.** The app's own mapping layer is:

- **Read** (`App/packages/core/src/kiwi/fig/node-change/paint.ts:107-130`, `convertStrokes`): builds each `Stroke` from only `p.color`, `p.opacity`, `p.visible`, plus node-level `weight`/`align`/`cap`/`join`/`dashPattern`. It never calls the gradient-field logic (`applyGradientPaintFields`, `:58-65`) that `convertFills` (`:96-105`) does call. A `.fig` file with a gradient stroke paint imports today as a solid stroke using whatever `p.color` happens to carry (Figma leaves this near-black/undefined for a pure-gradient paint).
- **Write** (`App/packages/core/src/kiwi/fig/node-change/export-node.ts:109-124`, `createStrokePaints`): hardcodes `type: 'SOLID'` and emits only `color`/`opacity`/`visible`/`blendMode`, discarding any gradient fields a `Stroke` might carry.
- The fill-side equivalent already exists and does the right thing: `fillToKiwiPaint` (`App/packages/core/src/kiwi/fig/node-change/serialize.ts:204-227`) emits `paint.stops`/`paint.transform` when `f.gradientStops`/`f.gradientTransform` are present, and is threaded through `SceneNodeToKiwiContext.fillToKiwiPaint` (`export-node.ts:64`, `serialize.ts:534`).

**Conclusion: `.fig` round-trip for gradient strokes is fully in scope and requires real, bounded changes in exactly these two functions** — not the schema. This directly answers the stub's second Expansion Question.

### Export: SVG/PDF stroke colour is unconditionally solid; the gradient-def machinery is fill-agnostic and directly reusable

`App/packages/core/src/io/formats/svg/export.ts:307-326` (`buildSVGStrokeAttrs`) reads only `stroke.color`/`stroke.weight`/`stroke.opacity`/`stroke.cap`/`stroke.join`/`stroke.dashPattern` and always emits `stroke: formatColor(stroke.color, 1, colorSpace)` (`:314`). `App/packages/core/src/io/formats/svg/defs.ts:337-361` (`resolveFill`) — the function that already turns a `Fill` gradient into a `<linearGradient>`/`<radialGradient>` `<defs>` entry and returns `url(#id)` — is generic over anything shaped like `Fill` (it only reads `.visible`, `.type`, `.color`, `.opacity`, and delegates to `createGradientDef` which reads `.gradientStops`/`.gradientTransform`). It requires no change to accept a gradient-carrying `Stroke`.

PDF export does not have a separate stroke-rendering code path to fix: `App/packages/core/src/io/formats/pdf/export.ts:17-30` (`renderNodesToPDF`) builds the PDF by calling `renderNodesToSVG` (unless `needsBackdrop`, in which case it rasterises via the CanvasKit renderer instead) and converting the resulting SVG with `svg2pdf`. **Fixing `buildSVGStrokeAttrs`/SVG export for gradient strokes fixes PDF export for the same nodes in the same change**, for any node that doesn't hit the raster-backdrop fallback. The raster fallback path renders through the CanvasKit renderer itself, so it is fixed by the renderer changes in this packet, not by a separate PDF code path.

`App/packages/core/src/io/formats/pdf/vector.ts` is **PDF import** (parses PDF content-stream ops into `Stroke`/`Fill` objects), not export — it is unaffected by this packet and is out of scope.

## Corrections to the Brief

1. **"the same on-canvas gradient handle" (User-Visible Outcome) does not exist for fills either, so it cannot be extended to strokes.** Per `Plan/Packets/T-041-gradient-handle-cursors.md`'s verified finding, reconfirmed above, gradient fills are edited only through the popup `GradientEditorBar`. Stroke gradients get the same popup-bar experience — a `StrokePicker` mirroring `FillPicker`'s Solid/Gradient tabs — not an on-canvas handle.
2. **The stub's third Expansion Question ("Image and pattern paints on strokes — in scope or excluded?") is answered here: excluded.** Nothing in the Request Coverage or User-Visible Outcome mentions image/pattern strokes, `IMAGE`/`PATTERN`/`NOISE`/`CUSTOM` stroke types would need their own renderer, SVG, PDF and `.fig` work with no existing precedent to reuse the way gradients do, and scope discipline calls for cutting to the requested slice. See Restrictions.

## Fixed Decisions

1. **`Stroke` gains three optional fields, mirroring `Fill`'s gradient shape exactly:** `type?: FillType`, `gradientStops?: GradientStop[]`, `gradientTransform?: GradientTransform`, added to the `Stroke` interface in `App/packages/scene-graph/src/types.ts`. `type` is optional and absence means `'SOLID'` (preserves every existing `Stroke` value and every hand-built `Stroke` object literal across the codebase — `DEFAULT_STROKE`, test fixtures, `vector.ts`'s PDF-import stroke construction — without touching them). Reusing `FillType`/`GradientStop`/`GradientTransform` (rather than declaring parallel `StrokeType`/etc.) is what makes reusing `GradientEditorRoot`/`useGradientStops`/`resolveFill` possible without forking them.
2. **UI reuses the existing `GradientEditor.vue`/`GradientEditorRoot`/`GradientEditorBar`/`GradientEditorStop` components unmodified, fed a `Stroke` value cast through a small local adapter, not a fork.** Add `App/src/components/properties/paint/StrokePicker.vue`, structured like `FillPicker.vue` (`FillPicker.vue:50-129`) but with only two tabs, Solid and Gradient (no Image tab — Decision/Correction 2), each tab body identical to `FillPicker.vue`'s (`ColorPickerPanel` for Solid, `GradientEditor.vue` for Gradient, passed the `Stroke` value where `GradientEditor.vue` expects a `Fill` — this typechecks per the structural-assignability note in Verified Starting State because every field `GradientEditorRoot`/`useGradientStops` read is now present on `Stroke` too). Add a small `useStrokePaintCategory(stroke, onUpdate)` composable in `App/packages/vue/src/controls/stroke/` mirroring `useFill`'s `category`/`toSolid`/`toGradient` (no `toImage`), reusing `fillCategory`'s two entries (`SOLID`, `GRADIENT_*`) rather than inventing a new category map.
3. **Renderer: a parallel, independent shader-lifecycle pair on `strokePaint`, not a shared one with `fillPaint`.** Add `activeStrokeShader: Shader | null = null` to `SkiaRenderer` (`renderer.ts`, beside `strokePaint`'s declaration at line 72) and two exported helpers in `strokes.ts`: `setStrokeShader(r, shader)` (assigns `r.strokePaint.setShader(shader)`, releases any previous stroke shader first, stores the new one) and `releaseStrokeShader(r)` (`setShader(null)`, then `.delete()` on the stored shader, then null the field) — the exact shape T-061 defines for `fillPaint` (`setFillShader`/`releaseFillShader`), duplicated for the independent `strokePaint` object rather than reused, because the two paints are separate C++ objects with separate lifetimes and no shared ownership. Add `releaseStrokeShader(r)` to `destroyRenderer` (`renderer/lifecycle.ts`) immediately before `r.strokePaint.delete()` (line 38).
4. **This does not depend on T-061 landing first, and does not reopen T-061's restriction on editing `strokes.ts`.** T-061's "Do NOT edit `packages/core/src/canvas/strokes.ts`" restriction is scoped to *that* packet's job (it found no shader code there and had nothing to fix); it is not a standing prohibition on other packets. T-048 is free to add shader code to `strokes.ts` because it is the packet introducing stroke shaders in the first place. Building `activeStrokeShader`/`setStrokeShader`/`releaseStrokeShader` correctly from the start — draw first, `setShader(null)`, then `.delete()`, matching T-061 Fixed Decision 1's binding order — means T-048 never creates the leak T-061 exists to fix, in either landing order.
5. **Scope is the "regular stroke" path only (`r.strokePaint`); the vector/geometry outline-stroke path (`r.fillPaint`-based) is explicitly deferred.** Per Verified Starting State's two-path table: `VECTOR`-node centerline strokes (`drawVectorPathStrokes`'s non-dashed branch, `scene.ts:526-545`) and any node with precomputed `strokeGeometry` (`drawVectorStrokeGeometry`, `scene.ts:453-464`) render their stroke by expanding it into an outline path and filling it with `r.fillPaint` — the same paint object node fills use, later in the same render pass. Extending gradients there means the stroke's gradient shader and the node's own fill gradient shader would have to share and hand off ownership of `activeFillShader` mid-render, which is a materially riskier, differently-shaped change than the independent `activeStrokeShader` pair in Decision 3. This packet covers every node type whose stroke goes through `drawRegularStroke`/`drawStyledRRectStroke`/`drawRRectStrokeWithAlign`/`drawIndividualSideStrokes`/`renderSection`/`renderComponentSet`/`boolean.ts`'s stroke closure — rectangles, ellipses, polygons, stars, frames, sections, component sets, and boolean-operation results. `VECTOR` nodes and any node with non-empty `strokeGeometry` keep solid-only strokes; see Restrictions for exactly what "keep solid" means operationally (fall back to the first gradient stop's colour, matching `toSolid`'s own fallback logic in `useFill.ts:53-56`, so a user who sets a gradient and then hits a deferred node type still gets a sane colour rather than black).
6. **Dashed strokes on the regular path keep gradients.** `drawRegularStroke` (`scene.ts:548-578`) already separates `setPathEffect` (dash) from `setColor`/shader application — a `PathEffect` and a `Shader` are independent `Paint` properties in Skia and compose normally, so no special-casing is needed for dashed + gradient.

## Visual Contract — binding

`StrokePicker.vue` is a near-literal copy of `FillPicker.vue`'s structure (`App/src/components/fill-picker/FillPicker.vue:50-129`), with the Image tab removed. Copy these exactly:

| Element | Required classes / source |
| --- | --- |
| Popover content | `usePopoverUI({ content: 'w-60 p-2' })`, same as `FillPicker.vue:41` |
| Popover side | `side="left"`, `:side-offset="4"`, matching `FillPicker.vue:73-74` |
| Tab row | `class="mb-2 flex items-center gap-0.5"`, matching `FillPicker.vue:77` |
| Tab button (inactive) | `TAB_BASE` constant copied verbatim from `FillPicker.vue:17-18`: `'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 transition-colors'`, plus `text-muted hover:bg-hover hover:text-surface` |
| Tab button (active) | `bg-hover text-surface`, matching `tabClass(true)` in `FillPicker.vue:20-25` |
| Tab icons | `~icons/lucide/square` (Solid), `~icons/lucide/blend` (Gradient) — the same two `FillPicker.vue` already imports (`icon-lucide-square`, `icon-lucide-blend`); do **not** import `icon-lucide-image` |
| Tab `data-test-id` | `stroke-picker-tab-solid`, `stroke-picker-tab-gradient` (new convention, following `fill-picker-tab-solid`/`fill-picker-tab-gradient` at `FillPicker.vue:81`/`:90`) |
| Trigger button | `class="size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"`, matching `FillPicker.vue:58` (and the existing swatch button already in `StrokeSection.vue:134-138`) |
| Swatch | Reuse `FillSwatch.vue` exactly as `StrokeSection.vue:139-142` already does via `strokePreview()` — extend `strokePreview` (`StrokeSection.vue:43-50`) to pass through `gradientStops`/`gradientTransform`/`type` when present, so `fillSwatchBackground` (`useFill.ts:40-45`) renders the gradient CSS automatically; no new swatch component |
| `GradientEditor` reuse | Unmodified `App/src/components/fill-picker/GradientEditor.vue`, passed the `Stroke`-as-`Fill` value; its own binding classes (`GradientEditor.vue:51`, `cursor-grab`/`data-[dragging]:cursor-grabbing`) are untouched |

### Banned List

- No literal colour of any kind — no hex, `rgb()`, `hsl()`, or Tailwind palette names. Only the semantic tokens already present in `FillPicker.vue`/`StrokeSection.vue` (`bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`).
- No font-size class other than `text-xs` or `text-[11px]` (`GradientEditor.vue` already uses `text-[11px]` for its Stops label — match it, do not introduce a new size).
- No radius other than `rounded`, `rounded-sm`, `rounded-md`, or `rounded-lg` — the exact set already present in `FillPicker.vue`/`GradientEditor.vue`. Never `rounded-xl`/`rounded-2xl`/`rounded-full`.
- No new `tv()` recipe. Reuse `usePopoverUI` from `App/src/components/ui/popover.ts`.
- No new npm dependency.
- No new Vue component for the gradient bar/stops — `GradientEditorBar.vue`/`GradientEditorStop.vue` are reused unmodified, per Restrictions.
- No `@apply`, no new global CSS, no edits to `App/src/app.css`.
- No on-canvas handle, overlay, or hit-test addition of any kind — Correction 1 is binding: strokes get the popup bar, nothing on the canvas.

## Allowed Changes

- `App/packages/scene-graph/src/types.ts` — add `type?`, `gradientStops?`, `gradientTransform?` to `Stroke` (Decision 1).
- `App/packages/scene-graph/src/copy.ts` — extend `copyStroke` to deep-copy `gradientStops`/`gradientTransform`, mirroring `copyFill` (`:27-35`).
- `App/packages/core/src/canvas/strokes.ts` — add `activeStrokeShader` support, `setStrokeShader`/`releaseStrokeShader`, and an `applyStrokeGradientFill`/`applyStroke`-style entry point that mirrors `fills.ts`'s `applyGradientFill`/`applyFill` shape for the regular-stroke draw functions to call.
- `App/packages/core/src/canvas/renderer.ts` — add the `activeStrokeShader` field.
- `App/packages/core/src/canvas/renderer/lifecycle.ts` — add `releaseStrokeShader(r)` to `destroyRenderer`.
- `App/packages/core/src/canvas/scene.ts` — `drawRegularStroke`, `renderSection`'s stroke closure, `renderComponentSet`'s stroke closure: apply the stroke's paint (solid or gradient) before drawing, instead of only `setColor`.
- `App/packages/core/src/canvas/boolean.ts` — its stroke closure (`:309-316`), same treatment.
- `App/packages/core/src/io/formats/svg/export.ts` — `buildSVGStrokeAttrs` gains a gradient branch using `resolveFill`/`createGradientDef` from `defs.ts`, matching how `resolveFill` is already called for node fills.
- `App/packages/core/src/kiwi/fig/node-change/paint.ts` — `convertStrokes` gains gradient-field conversion, reusing `applyGradientPaintFields`'s logic (either by calling it against a `Stroke`-shaped target or extracting a shared helper — implementer's choice, but do not duplicate the stop-mapping logic verbatim).
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts` — `createStrokePaints` gains gradient-field emission, reusing `fillToKiwiPaint`'s logic (same reuse-vs-extract choice as above).
- `App/src/components/properties/paint/StrokePicker.vue` — new file (Decision 2).
- `App/packages/vue/src/controls/stroke/` — new `useStrokePaintCategory` (or added to the existing `use.ts`/`helpers.ts`, implementer's choice) (Decision 2).
- `App/src/components/properties/StrokeSection.vue` — swap `ColorPicker` for `StrokePicker`, extend `strokePreview`.
- `App/packages/vue/src/i18n/messages/panels.ts` — only if a genuinely new label is needed; prefer reusing `panels.solid`/`panels.linearGradient` (already used as the Gradient tab's tooltip text in `FillPicker.vue`) rather than adding new keys.
- Focused tests under `App/tests/engine/` and `App/tests/e2e/stroke-picker/`.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT add `IMAGE`, `PATTERN`, `NOISE`, or `CUSTOM` stroke paint types.** Correction 2 is binding — gradients only.
- **Do NOT build an on-canvas gradient handle for strokes or fills.** Correction 1 is binding. Gradient strokes are edited through the popup picker only, exactly like gradient fills.
- **Do NOT modify `GradientEditorBar.vue` or `GradientEditorStop.vue`.** They are reused as-is (Decision 2); their existing `cursor-grab`/`data-[dragging]:cursor-grabbing` behaviour, verified working for fills, must not be touched.
- **Do NOT add gradient support to `drawVectorPathStrokes`'s non-dashed (outline-fill) branch or to `drawVectorStrokeGeometry`.** Decision 5 is binding — `VECTOR` nodes and any node with non-empty `strokeGeometry` keep solid-only strokes in this packet. When a gradient `Stroke` reaches one of these paths, render it using the first gradient stop's colour (matching `useFill.ts:53-56`'s `toSolid` fallback), not black, not a crash. **Deferred to a later packet:** gradient support for the vector/geometry outline-stroke path, which requires coordinating `activeStrokeShader` and `activeFillShader` ownership on the same render pass and deserves its own design.
- **Do NOT share `activeStrokeShader` state with `activeFillShader`, and do NOT route strokes through `setFillShader`/`releaseFillShader`.** They are separate `Paint` objects with separate lifetimes (Decision 3).
- **Do NOT change `Fill`'s shape, `applyFill`'s signature, or any of the six shader-allocation sites T-061 documents in `fills.ts`.** This packet only adds new call sites in `strokes.ts`; it does not touch fill rendering.
- **Do NOT change `PDF import`'s `vector.ts`.** That file parses PDF content streams into `Stroke`/`Fill` objects; it is unrelated to this packet's export direction.
- **Do NOT introduce a new runtime dependency.**
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command** — source gates only, per delivery policy.

## Implementation Steps

Each step is independently verifiable. Land the model change first; nothing downstream compiles without it.

1. **Scene-graph model** (`App/packages/scene-graph/src/types.ts`, `copy.ts`): add the three optional fields to `Stroke`; extend `copyStroke`.
2. **Renderer shader lifecycle** (`App/packages/core/src/canvas/renderer.ts`, `canvas/strokes.ts`, `canvas/renderer/lifecycle.ts`): add `activeStrokeShader`, `setStrokeShader`, `releaseStrokeShader`, per Decision 3-4. Add an `applyStrokeGradientFill(r, stroke, node, graph)` function in `strokes.ts` that mirrors `fills.ts`'s `applyGradientFill` (reuse `linearGradientEndpoints`/`makeGradientLocalMatrix` directly by importing them from `fills.ts` rather than re-deriving the maths) but calls `setStrokeShader` and writes into `r.strokePaint`. Add an `applyStrokePaint(r, stroke, node, graph)` entry point mirroring `applyFill`'s solid/gradient branch (`fills.ts:67-101`), scoped to `SOLID` and `GRADIENT_*` only.
3. **Regular-stroke draw sites** (`canvas/scene.ts`, `canvas/boolean.ts`): replace the bare `r.strokePaint.setColor(...)` calls in `drawRegularStroke`, `renderSection`'s closure, `renderComponentSet`'s closure, and `boolean.ts`'s stroke closure with a call to `applyStrokePaint`, keeping every other `setStrokeWidth`/`setAlphaf`/`setStrokeCap`/`setStrokeJoin`/`setPathEffect` call unchanged. Ensure `releaseStrokeShader(r)` runs wherever a stroke render pass exits without drawing another gradient stroke (mirroring T-061 Decision 1's "draw first, then null, then delete" order) — the simplest correct placement is at the top of `applyStrokePaint` itself (clear any leftover shader before deciding solid vs. gradient), matching `applyFill`'s own entry guard at `fills.ts:75`.
4. **Deferred-path fallback** (`scene.ts:453-464`, `:526-545`): where a gradient `Stroke` reaches `drawVectorStrokeGeometry` or the non-dashed branch of `drawVectorPathStrokes`, resolve to the first gradient stop's colour before calling `r.fillPaint.setColor(...)`, per Decision 5's binding fallback.
5. **SVG/PDF export** (`App/packages/core/src/io/formats/svg/export.ts`): extend `buildSVGStrokeAttrs` to call `resolveFill`-equivalent logic when `stroke.type` starts with `GRADIENT`, producing a `<defs>` gradient the same way node fills already do, and setting `stroke: url(#id)` instead of a flat colour. Confirm PDF output inherits this for free by re-reading `pdf/export.ts:17-30` after the SVG change (no PDF-specific edit expected).
6. **`.fig` round-trip** (`App/packages/core/src/kiwi/fig/node-change/paint.ts`, `export-node.ts`): extend `convertStrokes` to populate `type`/`gradientStops`/`gradientTransform` from each stroke `Paint`, and extend `createStrokePaints` to emit them back, both reusing the existing fill-side conversion logic rather than reimplementing it.
7. **UI** (`App/src/components/properties/paint/StrokePicker.vue`, `App/packages/vue/src/controls/stroke/`, `App/src/components/properties/StrokeSection.vue`): build `StrokePicker.vue` per the Visual Contract; add the category composable; wire `StrokeSection.vue` to use `StrokePicker` instead of `ColorPicker`, keeping the existing `applyPaintMutation`/`commitPaintMutation`/`cancelPaintMutation`/`paintBindingTargets('strokes', index)` flow from `App/src/components/properties/paint/binding.ts` unchanged — only the picker component and its update payload shape change.
8. **Focused tests**:
   - `App/tests/engine/scene-graph/` — a `copyStroke` unit test asserting `gradientStops`/`gradientTransform` are deep-copied, not shared by reference (mirror whatever existing `copyFill` test exists, if any, or add alongside `individual-strokes.test.ts`).
   - `App/tests/engine/render/canvas/gradient.test.ts` — extend with a stroke-gradient case exercising `applyStrokeGradientFill`/`applyStrokePaint`, following the existing `linearGradientEndpoints` unit-test pattern (no CanvasKit init required for the pure-function parts; use `initCanvasKit()` from `#cli/headless` per `tests/engine/render/canvas/cache.test.ts`'s pattern if a real paint object is needed).
   - `App/tests/engine/io/svg/export/` — a stroke-gradient SVG export test asserting a `<linearGradient>` def and a `stroke="url(#...)"` attribute appear, mirroring the existing fill-gradient coverage referenced in `tests/engine/io/svg/export/render.test.ts`.
   - `App/tests/engine/io/fig/import/legacy/strokes.test.ts` — extend with a gradient `strokePaints` import case, following the existing `stroke cap and join`/`dash pattern` test shape (`doc()`/`canvas()`/`node()` helpers).
   - A `.fig` export round-trip test (import → export → re-import) asserting a gradient stroke survives, colocated with existing fig export tests.
   - `App/tests/e2e/stroke-picker/basic.spec.ts` — add a test that opens the stroke picker, switches to the Gradient tab (`data-test-id="stroke-picker-tab-gradient"`), drags a stop, and asserts the node's `strokes[0].type`/`gradientStops` update — following `openStrokePicker`'s existing pattern in the same file. **Do not remove or weaken the four existing tests in this file** — they cover the Solid tab, which must keep working identically.
9. Run, in this order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false` (from `App/`)
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` (from `App/`)
   - `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` (from `App/`)
   - focused Oxlint over every changed file
   - `bun run check:i18n` only if a new i18n key was added
   - `bun test tests/engine/scene-graph/ tests/engine/render/canvas/gradient.test.ts tests/engine/io/svg/export/ tests/engine/io/fig/import/legacy/strokes.test.ts` (adjust to the exact files touched in step 8)
   - the focused Playwright spec: `tests/e2e/stroke-picker/basic.spec.ts` with `--project=openpencil`
   - Do **not** run `bun run check`, `bun run test`, or `bun run test:unit`.

## Acceptance Criteria

- [ ] `Stroke` carries optional `type`/`gradientStops`/`gradientTransform`; every existing `Stroke` value (no `type` field) still means solid and renders unchanged.
- [ ] `copyStroke` deep-copies gradient fields; mutating a copy's stops never mutates the source.
- [ ] Rectangles, ellipses, polygons, stars, frames, sections, component sets, and boolean-operation results render a gradient stroke correctly (linear, radial, angular, diamond) via `r.strokePaint`, with no shader leak (`r.activeStrokeShader === null` after each render pass, matching T-061's own acceptance shape for `activeFillShader`).
- [ ] `VECTOR` nodes and any node with non-empty `strokeGeometry` fall back to the first gradient stop's solid colour rather than crashing or rendering black.
- [ ] SVG export of a gradient-stroked node produces a `<linearGradient>`/`<radialGradient>` def and `stroke="url(#...)"`; PDF export of the same node (non-backdrop path) shows the same gradient.
- [ ] A `.fig` file with a gradient `strokePaints` entry imports with `type`/`gradientStops`/`gradientTransform` populated on the resulting `Stroke`; exporting a gradient `Stroke` back to `.fig` emits a gradient `Paint` on `strokePaints`, not a flattened solid.
- [ ] The Stroke property panel offers Solid/Gradient tabs identical in structure to the Fill panel's Solid/Gradient tabs, reusing `GradientEditor.vue` unmodified.
- [ ] The four existing tests in `tests/e2e/stroke-picker/basic.spec.ts` still pass unmodified in behaviour (Solid tab flow unchanged).
- [ ] Nothing in the Banned List appears in the diff.
- [ ] No image/pattern/noise/custom stroke paint type is introduced.
- [ ] No on-canvas gradient handle is introduced for strokes or fills.

## Verification

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` from `App/`.
- Focused Oxlint over every changed file.
- `bun run check:i18n` only if i18n changed.
- `bun test` scoped to the exact files listed in Implementation Step 8.
- `tests/e2e/stroke-picker/basic.spec.ts` with `--project=openpencil`.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Stop Conditions

- Stop if `GradientEditorRoot`/`useGradientStops` turn out **not** to be structurally satisfiable by a `Stroke` value once the three fields are added (e.g. a stricter type guard somewhere reads `fill.blendMode` or another `Fill`-only field this expansion missed) — re-verify against the live file before forking the component, and report the exact field that broke assignability.
- Stop if adding `activeStrokeShader`/`setStrokeShader`/`releaseStrokeShader` produces a use-after-free or a blank stroke in any renderer test — the ownership assumption mirrors T-061 Decision 1 exactly; if it fails for strokes specifically, something about `strokePaint`'s lifecycle differs from `fillPaint`'s and needs to be understood before proceeding.
- Stop if `buildSVGStrokeAttrs`'s single-stroke assumption (`visibleStrokes[0]`, `svg/export.ts:312`) turns out to already be a known multi-stroke limitation that a gradient change would make worse — report rather than silently extending scope to multi-stroke SVG export, which this packet does not claim to fix.
- Stop and report if `convertStrokes`/`createStrokePaints` cannot cleanly reuse the fill-side conversion logic without duplicating substantial gradient-stop-mapping code — a shared extracted helper (e.g. `applyGradientPaintFieldsGeneric`) is preferred over duplication, but if the two call sites' surrounding context makes that awkward, duplicate the ~10-line mapping rather than forcing an unnatural abstraction, and note the duplication in the landed diff.

## Revision History

- Revision 1 — 2026-08-15: expanded against live scene-graph, renderer, export, `.fig` mapper, and UI source. Central finding: the paint model is solid-only for strokes end-to-end (type, renderer, export, `.fig`), not just the UI; scope is cut to the "regular stroke" (`r.strokePaint`) rendering path, deferring the vector/geometry outline-stroke (`r.fillPaint`-based) path to a follow-up. Corrected the stub's premise of an on-canvas gradient handle — none exists for fills either, per T-041's verified finding.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (expanded 2026-08-15 against live source; the stub's central question is answered — **strokes are solid-only end-to-end, not merely missing UI**. `Stroke` (`packages/scene-graph/src/types.ts:167-176`) has no `type`/`gradientStops`/`gradientTransform`; `copyStroke` deep-copies no gradient fields; `strokes.ts` has zero shader code; `buildSVGStrokeAttrs` is unconditionally solid; and both `.fig` read (`convertStrokes`) and write (`createStrokePaints`) discard gradient paint data even though the kiwi schema already carries `strokePaints: Paint[]` as the same `Paint` message used for fills. Specifies a parallel `activeStrokeShader`/`setStrokeShader`/`releaseStrokeShader` on `strokePaint` so it is correct independently of T-061's landing order. Scope cut, stated explicitly: only the regular `r.strokePaint` path; `VECTOR`/`strokeGeometry` nodes expand strokes into an outline path filled with `r.fillPaint` and are deferred)
