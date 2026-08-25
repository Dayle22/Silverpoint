# T-050b1 - Star/polygon point-radius model and rendering

Task ID: T-050b1
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-050b (blocked-finding packet; confirms no existing point-radius rendering for STAR/POLYGON — Done as a finding)
Related: T-004 (corner-radius node controls), T-050 (integer corner-radius values), T-050a (radius handle inward tracking — same clamp-formula reasoning style, different geometry), T-050b2 (companion handles packet, depends on this one; needs the exact field name below)
Prepared from: T-050b's Open Decision 1 recommended default — the user accepted proceeding with this default via "ok and expand them" (2026-08-21)
Expanded at: 2026-08-21
Expanded against: `App/packages/scene-graph/src/geometry.ts:112-138` (`polygonVertices`), `App/packages/scene-graph/src/types.ts:45-52,77-96,353-380,476-477` (`Vector`, `NodeType`, `SceneNode` corner/point fields), `App/packages/scene-graph/src/node-defaults.ts:1-40,122,206-207`, `App/packages/scene-graph/src/index.ts:24` (`Vector` re-export), `App/packages/core/src/canvas/shapes.ts` (whole file), `App/packages/core/src/canvas/fills.ts:45-115`, `App/packages/core/src/canvas/strokes.ts:230-267,398-434`, `App/packages/core/src/canvas/shadows.ts:100-175`, `App/packages/core/src/canvas/boolean.ts:75-85`, `App/packages/core/src/canvas/renderer.ts:365-369`, `App/packages/core/src/canvas/renderer/methods.ts:293-305`, `App/packages/core/src/canvas/overlays/selection.ts:253-278`, `App/packages/core/src/kiwi/fig/node-change/convert.ts:284-305`, `App/packages/core/src/kiwi/fig/node-change/serialize.ts:200-259,530-540`, `App/packages/core/src/io/formats/svg/export.ts:115-135`, `App/packages/core/src/io/formats/svg/paths.ts:1-10,105-133`, `App/packages/vue/src/controls/appearance/helpers.ts` (whole file), `App/packages/vue/src/controls/appearance/use.ts` (whole file), `App/packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` (whole file), `App/packages/vue/src/primitives/AppearanceControls/types.ts` (whole file), `App/src/components/properties/AppearanceSection.vue` (whole file), `App/src/components/properties/VariableNumberField.vue` (grepped, no type restriction), `App/src/theme/panel/grid.ts` (whole file), `App/node_modules/.bun/canvaskit-wasm@0.40.0/node_modules/canvaskit-wasm/types/index.d.ts:2547` (`arcToTangent` signature), `App/package.json:26-38,91` (lint/check scripts, canvaskit-wasm version), `App/packages/core/package.json:185` (canvaskit-wasm version), `App/tests/engine/render/canvas/corner-smoothing.test.ts` (whole file, mock-Path test precedent), `App/tests/engine/render/canvas/selection-outline.test.ts:1-60` (real-CanvasKit render-test precedent), `App/tests/engine/render/canvas/effects/path-shapes.test.ts` and `effects/helpers.ts:1-140` (confirms `r.makePolygonPath` is fully mocked there, unaffected by this packet), `App/tests/engine/vue/controls/appearance.test.ts` (whole file), `App/tests/helpers/scene.ts` (whole file), `Plan/Packets/T-050b-radius-handles-other-shapes.md`, `Plan/Packets/T-050a-radius-handle-inward-tracking.md`, `Plan/Packets/T-061-canvaskit-memory-and-stability.md`, `Plan/Packets/T-035-contextual-selection-actions.md`, `App/AGENTS.md`, `Plan/endgoal.md`, `Plan/plan.md`
Delivery: named source gates + browser check
Execution size: 5 core implementation files (`packages/core/src/canvas/shapes.ts`, `packages/vue/src/controls/appearance/helpers.ts`, `packages/vue/src/primitives/AppearanceControls/types.ts`, `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue`, `src/components/properties/AppearanceSection.vue`); 2 test files across 2 suites (`tests/engine/render/canvas/polygon-point-radius.test.ts` new, `tests/engine/vue/controls/appearance.test.ts` extended). One responsibility (rendering + model + Properties-panel exposure), at the five-file ceiling, not over it.

## Intended Outcome

`STAR` and `POLYGON` nodes gain a working, uniform point-radius: setting a positive `cornerRadius` value on one of these nodes now visibly rounds every vertex — outer and, for a star, inner — by that same amount, clamped per-vertex so the rounding can never self-intersect or invert the shape regardless of `pointCount` or `starInnerRadius`. The Properties panel's Appearance section shows a single radius field (no independent-corner toggle, which is meaningless for an N-gon) for these two types. Fill, stroke, shadow/effect silhouette, boolean-operation geometry, clip paths, and the selection outline all pick up the same rounded shape automatically, because they all resolve through one shared function. `.fig` import/export already round-trips the value with no code change, because it reuses the existing `cornerRadius` field. On-canvas drag handles and SVG/PDF export parity are explicitly out of this packet's scope — see Restrictions.

## Request Coverage

- T-050b's recommended default — "a uniform, single point-radius value applied identically to every vertex of a STAR/POLYGON node (not a per-vertex array)" — covered: the field is `cornerRadius` (reused, not a new field), read once per node and applied identically to every vertex including a star's inner vertices, clamped per-vertex against local edge geometry.

## Verified Starting State

### The scene-graph field: `cornerRadius` is generic, non-optional, and already defaults to 0 for every node type

`App/packages/scene-graph/src/types.ts:373` declares `cornerRadius: number` directly on the single flat `SceneNode` interface (no discriminated union by `node.type`) — every node, including `STAR`/`POLYGON`, already carries it. `App/packages/scene-graph/src/node-defaults.ts:122` sets the shared default `cornerRadius: 0` once, applied to every node type; `pointCount: 5` and `starInnerRadius: 0.38` are set separately at lines 206-207 for `STAR`/`POLYGON` specifically. No default changes are needed.

### `polygonVertices` returns sharp vertices only — confirmed, this is the function the new geometry replaces the consumer of

`App/packages/scene-graph/src/geometry.ts:112-138` (`polygonVertices`) takes `{ width, height, pointCount, type, starInnerRadius }` and returns `Vector[]` — plain `{x, y}` points around the shape, alternating outer/inner radius for a star (`isInner = isStar && index % 2 === 1`, line 131), starting at `angleOffset = -Math.PI / 2` (12 o'clock). It does **not** accept or use `cornerRadius` — this function itself is unchanged by this packet; only its one caller in `packages/core` changes.

### One caller, reached from every render/geometry site — confirmed, this is the single point of change

`App/packages/core/src/canvas/shapes.ts:402-410` (`makePolygonPath(r, node)`) is the **only** place `polygonVertices` is consumed for rendering. Every other site that needs a `STAR`/`POLYGON` shape calls `r.makePolygonPath(node)` (the renderer-bound method, `renderer.ts:368` declares it, `renderer/methods.ts:299-301` binds it to `Shapes.makePolygonPath`) or calls `makeNodeShapePath`, whose own `'POLYGON'`/`'STAR'` case (`shapes.ts:381-387`) calls `r.makePolygonPath(node)` internally:

| Path | Symbol / line | Confirms |
| --- | --- | --- |
| `App/packages/core/src/canvas/fills.ts:61-67` | `drawNodeFill`, `case 'POLYGON': case 'STAR':` | `r.makePolygonPath(node)` — fill geometry. |
| `App/packages/core/src/canvas/strokes.ts:249-255` | `drawNodeStroke`, `case 'POLYGON': case 'STAR':` | `r.makePolygonPath(node)` — center-aligned stroke geometry. |
| `App/packages/core/src/canvas/strokes.ts:420-426` | `strokeNodeShape`, `case 'POLYGON': case 'STAR':` | `r.makePolygonPath(node)` — also the function the selection outline itself uses (see below). |
| `App/packages/core/src/canvas/shadows.ts:123-125,154-168` | `isPathShape`, `drawPathShape` | `isPathShape` groups `POLYGON`/`STAR`/`VECTOR`; `drawPathShape` calls `makeNodeShapePath(r, node, ...)`, which for these types calls `r.makePolygonPath(node)` (via `shapes.ts:383`). Effect/shadow silhouette geometry. |
| `App/packages/core/src/canvas/boolean.ts:82` | boolean source-path builder | `r.makeNodeShapePath(node, rect, nodeHasRadius(node))` — same delegation; the `hasRadius` argument is ignored by the `'POLYGON'`/`'STAR'` case (`shapes.ts:381-387` never reads it). |
| `App/packages/core/src/canvas/shapes.ts:502-513` | `clipNodeShape` | `node.type === 'POLYGON' \|\| 'STAR'` branch calls `makeNodeShapePath` → `r.makePolygonPath(node)`. Used for `clipsContent`/mask clipping. |
| `App/packages/core/src/canvas/overlays/selection.ts:261-265` | `drawSelectionRect` | `r.strokeNodeShape(canvas, node, r.selectionPaint)` — the selection outline itself reuses `strokes.ts:420-426`'s `strokeNodeShape`, which calls `r.makePolygonPath(node)`. The selection outline will automatically match the new rounded silhouette with no separate edit. |

**Conclusion, corrects the stub's rough-steps assumption:** the stub's step 3 ("Wire the new geometry into `shapes.ts` (fill/selection path), `fills.ts`, `strokes.ts`, and confirm `shadows.ts`'s effect-geometry grouping still produces a correct silhouette") implied separate edits in up to four files. Verification shows all four (plus `boolean.ts`, `overlays/selection.ts`, and `clipNodeShape`) already delegate to the single function `makePolygonPath` in `shapes.ts`. **This packet edits exactly one rendering function.** The other files are confirmed unedited by grep/read above and are not part of the diff.

### `arcToTangent` is the right CanvasKit primitive, confirmed present in the pinned version

`App/node_modules/.bun/canvaskit-wasm@0.40.0/node_modules/canvaskit-wasm/types/index.d.ts:2547`:
```ts
arcToTangent(x1: number, y1: number, x2: number, y2: number, radius: number): Path;
```
This is Skia's two-point tangent-arc form (the same primitive as HTML Canvas 2D's `arcTo(x1, y1, x2, y2, radius)`): called with the current point already set (via `moveTo`/a prior `lineTo`/`arcToTangent`), it draws a line toward `(x1, y1)` that stops at the tangent point, arcs around a circle of the given `radius` tangent to both the incoming line and the line toward `(x2, y2)`, and leaves the current point at the outgoing tangent point. It is already declared in `packages/core`'s pinned `canvaskit-wasm@^0.40.0` (`App/packages/core/package.json:185`, matching root `App/package.json:91`) — no dependency change needed. Nothing in the live tree calls it today (`grep -n "arcToTangent" App/packages App/src` returns only this type declaration and its own test fixture in `node_modules`), so this is new usage, not a pattern to match against an existing call site.

### The rectangle-corner precedent (`smoothCornerRadii`) does not directly generalise to an N-gon

`App/packages/core/src/canvas/shapes.ts:51-137` (`smoothCornerRadii`) computes a per-corner clamped radius plus a "smoothing" continuous-curvature (squircle-like) path via `cubicTo`/`arcToRotated` (`shapes.ts:143-313`), specific to a rectangle's four fixed 90° corners and Figma's corner-smoothing feature (`cornerSmoothing`, a separate field this packet does not touch — see Restrictions). Its clamp (`budget = Math.min(width, height) / 2` for the equal-radius case, `shapes.ts:77-78`) is exact for a 90° corner (see Fixed Decision 3 for why) but does not apply to a polygon/star vertex, whose interior angle is neither fixed nor 90°. This packet does not reuse `smoothCornerRadii`'s code, only its general shape (compute a per-corner clamp, then build the path); the exact clamp formula for an arbitrary vertex angle is new, derived in Fixed Decision 3.

### Properties panel: `hasCornerRadius` already gates STAR/POLYGON out, and the independent-corner toggle would be meaningless for them

`App/packages/vue/src/controls/appearance/helpers.ts:10-17` (`CORNER_RADIUS_TYPES`) lists `RECTANGLE`, `ROUNDED_RECTANGLE`, `FRAME`, `COMPONENT`, `INSTANCE`, `BOOLEAN_OPERATION` — `STAR`/`POLYGON` are absent, and `hasCornerRadius` (`helpers.ts:39-42`) gates the whole radius UI on it. `AppearanceSection.vue:124-168` renders two mutually exclusive `PanelGrid` blocks under `hasCornerRadius`: a plain radius field with an "independent corners" toggle rail button (`v-if="hasCornerRadius && !showIndependentCorners"`, lines 124-168), or a four-corner `TL/TR/BL/BR` grid (`v-else-if`, lines 170-223) when `independentCorners`/unequal corners are active. **Simply adding `STAR`/`POLYGON` to `CORNER_RADIUS_TYPES` would be wrong**: it would surface the independent-corner toggle button (`actions.toggleIndependentCorners`, `helpers.ts:124-168`), which writes `topLeftRadius`/`topRightRadius`/`bottomRightRadius`/`bottomLeftRadius` — fields this packet's renderer change never reads for `STAR`/`POLYGON` (only `node.cornerRadius` is read, see Fixed Decision 1) — producing a functioning-looking control that silently does nothing. This packet adds a **separate, parallel gate** instead (Fixed Decision 4).

### `.fig` round-trip already works — confirmed, no code change needed, corrects T-050b's "supporting evidence only" framing

`App/packages/core/src/kiwi/fig/node-change/convert.ts:284-305` (`convertCornerProps`) unconditionally returns `cornerRadius: nc.cornerRadius ?? 0` for every node type — no `node.type` gate anywhere in the function. `App/packages/core/src/kiwi/fig/node-change/serialize.ts:233-239` (`serializeCornerRadii`) is symmetric: `if (node.cornerRadius > 0) nc.cornerRadius = node.cornerRadius`, also with no type gate; it is exported (`serialize.ts:537`) for use by the main node-to-`NodeChange` serializer alongside the other per-node property serializers. Because this packet reuses the existing `cornerRadius` field rather than adding a new one, both import and export already carry the value through for `STAR`/`POLYGON` today, before this packet's rendering change even lands — the renderer simply started ignoring an already-round-tripped field, and this packet fixes that. **No `.fig` codec file is touched.**

### SVG export has its own, separate `POLYGON`/`STAR` path builder — confirmed, genuine parity gap, out of scope

`App/packages/core/src/io/formats/svg/export.ts:130-132` and `App/packages/core/src/io/formats/svg/paths.ts:127-131` (`makePolygonPoints`) build a plain SVG `<polygon points="...">` element directly from `polygonVertices(node)` — sharp vertices only, entirely independent of the canvas renderer this packet changes. After this packet, a rounded star/polygon will render correctly on-canvas and in a raster export, but an SVG (and, if it is SVG-derived, PDF) export of the same node will still show sharp points. This is a real, confirmed gap and is deliberately deferred — see Restrictions and Exclusions.

## Read First

- `App/packages/core/src/canvas/shapes.ts:402-410` — the current `makePolygonPath`, the only function this packet rewrites.
- `App/packages/scene-graph/src/geometry.ts:112-138` — `polygonVertices`, unchanged, the vertex source.
- `App/packages/vue/src/controls/appearance/helpers.ts:10-42` — `CORNER_RADIUS_TYPES`, `hasCornerRadius`, the pattern the new `hasPointRadius` mirrors.
- `App/src/components/properties/AppearanceSection.vue:124-168` — the existing radius `PanelGrid` block, the template this packet's new block mirrors (without the independent-corner rail).

## Corrections to the Brief

- The stub's rough step 3 implied edits across `shapes.ts`, `fills.ts`, `strokes.ts`, and `shadows.ts`. Verified: all of these (plus `boolean.ts`, `overlays/selection.ts`, and `clipNodeShape`) already delegate to the single function `makePolygonPath` in `shapes.ts` for `POLYGON`/`STAR` geometry. This packet edits that one function only — see Verified Starting State, "One caller, reached from every render/geometry site."
- The stub's rough step 5 asked whether `.fig` round-trip needs new handling. Verified: it already works unconditionally today, because `convertCornerProps`/`serializeCornerRadii` never gate on `node.type` and this packet reuses the existing `cornerRadius` field rather than adding a new one. No `.fig` codec file is touched — see Verified Starting State, "`.fig` round-trip already works."
- The stub's own text says the recommended default should get "its own arc/rounding geometry in `packages/core/src/canvas/shapes.ts` and `.fig`/Properties-panel exposure" — the `.fig` half needed no exposure work (see above); only the geometry and Properties-panel halves are real work, both covered below.

## Fixed Decisions

1. **Reuse `cornerRadius`; do not add a new scene-graph field.** `SceneNode.cornerRadius` (`types.ts:373`) already exists on every node, already defaults to `0` (`node-defaults.ts:122`), already round-trips through `.fig` unconditionally (see Verified Starting State), and already has a fully built Properties-panel input primitive (`VariableNumberField`/`NumberField` bound to `binding-path="cornerRadius"`, `AppearanceSection.vue:130-156`) that this packet reuses unchanged. A new field name (e.g. `pointRadius`) would require: a new `SceneNode` property, a new default, new `.fig` import/export wiring, and a new Properties-panel binding path — all to duplicate work `cornerRadius` already does. This is also literally T-050b's own recommended default ("the simplest model consistent with rectangle's own default (`cornerRadius`) before `independentCorners` was layered on"), which the user accepted. **The field name any follow-up packet (T-050b2) must use is `cornerRadius` on the `SceneNode` interface — no new field, no new type.**
2. **`independentCorners`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius` are not read for `STAR`/`POLYGON`.** Only `node.cornerRadius` drives the new geometry (Implementation Step 1). This matches the accepted "uniform, single point-radius value applied identically to every vertex" decision and avoids resurrecting a 4-corner-specific UI concept (independent corners) that has no meaning for a shape with `pointCount` (or `pointCount * 2` for a star) vertices.
3. **Every vertex is rounded identically, including a star's inner (concave) vertices.** This directly implements "applied identically to every vertex" from the accepted decision — it is not a separate open question. The tangent-arc construction (Implementation Step 1) is a pure two-line-and-a-circle geometric construction that works identically for a locally convex or locally reflex vertex; no special-casing by `isInner`/`isStar` is needed or added.
4. **The per-vertex radius clamp is `radius = min(baseRadius, vertexMaxRadius)`, where `vertexMaxRadius = tan(halfAngle) * min(edgeLenPrev, edgeLenNext) / 2` and `halfAngle` is half the angle between the two rays from the vertex to its neighbours.** Derivation: for two lines meeting at a vertex with angle `theta` between the rays to the two neighbouring points, `arcToTangent`'s tangent length (the distance from the vertex to where the arc begins, along each edge) is `t = radius / tan(theta / 2)`. To guarantee two adjacent vertices' tangent points never cross on the edge they share (so the rounding can never self-intersect), each vertex may claim at most half of each adjacent edge for its own tangent length: `t <= edgeLen / 2`, i.e. `radius <= tan(theta/2) * edgeLen / 2`. Taking the smaller bound from the two adjacent edges gives the formula above. This generalises T-050a's own rectangle clamp exactly: for a 90° corner, `tan(45°) = 1`, so `vertexMaxRadius = min(edgeLenPrev, edgeLenNext) / 2` — identical in form to T-050a's `maxInset = Math.min(width, height) / 2` and to `smoothCornerRadii`'s equal-radius `budget = Math.min(width, height) / 2` (`shapes.ts:77`), confirming the formula is a correct generalisation, not an unrelated invention. Like both of those precedents, this is a conservative, symmetric half-edge split rather than the fully shared, unevenly-split `budget` system `smoothCornerRadii` uses for unequal per-corner radii (`shapes.ts:87-129`) — not needed here because the radius is uniform (Fixed Decision 2), so every vertex claims the same fraction of a shared edge and the simpler split is exact, not approximate.
5. **Radius `0` (the default) takes a fast, allocation-free path identical to today's output.** If `node.cornerRadius <= 0` (or is non-finite), `makePolygonPath` builds the exact same `moveTo`/`lineTo`/`close()` loop it does today — no `arcToTangent` call, no per-vertex angle/length computation. This guarantees zero visual or performance regression for the overwhelmingly common case (every `STAR`/`POLYGON` node created today has `cornerRadius: 0`).
6. **The Properties panel gets a new, separate `hasPointRadius` gate — `POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])` — not an extension of `CORNER_RADIUS_TYPES`.** Per Verified Starting State, adding `STAR`/`POLYGON` to the existing `CORNER_RADIUS_TYPES` would surface the independent-corner toggle and four-corner grid, which write to fields the renderer never reads for these types. The new gate gets its own single-field UI block with `columns="fill"` (`App/src/theme/panel/grid.ts:7`, a single-column layout with no rail slot — the closest existing recipe, since there is no independent-corner toggle to occupy a rail column for these types).
7. **SVG/PDF export parity for the new rounding is deferred to a later packet.** `io/formats/svg/paths.ts`'s `makePolygonPoints` and `io/formats/svg/export.ts`'s `'STAR'`/`'POLYGON'` case are a separate, independent code path from the canvas renderer this packet changes (Verified Starting State). Extending them is a same-shaped-but-separate piece of work (translate the same clamp/arc-tangent geometry into an SVG arc-command path string) that would push this packet past its one-responsibility, five-core-file scope. See Restrictions and Exclusions.
8. **On-canvas drag handles remain T-050b2's scope, unchanged from `Plan/plan.md`'s existing plan.** This packet adds no handle geometry, no `CORNER_RADIUS_TYPES` extension in `packages/vue/src/shared/input/radius.ts` or `packages/core/src/canvas/overlays/selection.ts`, and no change to `CornerPosition`/`RadiusCorner`. T-050b2 depends on this packet landing first and should read the exact clamp formula in Fixed Decision 4 as the geometry its handles must respect.

## Open Decisions

None. Every question the stub raised is closed above: the field-reuse decision (Fixed Decision 1), the exact clamp/self-intersection formula (Fixed Decision 4), whether star inner vertices round too (Fixed Decision 3 — yes, per the already-accepted "identically to every vertex" product decision), and the `.fig` handling (already works, no code change — Verified Starting State).

## Visual Contract — binding

This packet has both a CanvasKit geometry change (no DOM/Tailwind surface) and one small Properties-panel UI addition.

### Canvas geometry (no classes/recipes — exact CanvasKit calls)

| Element | Binding value |
| --- | --- |
| Path builder | `r.ck.Path` — the existing `new r.ck.Path()` already used by `makePolygonPath` today. No new CanvasKit object type. |
| Sharp fallback (`cornerRadius <= 0`) | `moveTo`/`lineTo`/`close()` exactly as today — unchanged output. |
| Rounded path | `moveTo` to the midpoint of the edge between the last and first vertex, then one `arcToTangent(curr.x, curr.y, next.x, next.y, radius)` per vertex (or `lineTo(curr.x, curr.y)` if that vertex's clamped radius resolves to `0`), then `close()`. Exact code in Implementation Step 1. |

### Properties panel (`App/src/components/properties/AppearanceSection.vue`)

| Element | Required classes / structure |
| --- | --- |
| New radius block | `<PanelGrid v-else-if="hasPointRadius && !isMulti && node" columns="fill" class="mt-panel">` — reuses `PanelGrid`, `columns="fill"` (`App/src/theme/panel/grid.ts:7`, `grid-cols-[minmax(0,1fr)]`, no rail). |
| Field wrapper | `<PanelFieldGroup :label="panels.radius">` — reuses the existing i18n key, no new string. |
| Input | `<VariableNumberField>` bound to `binding-path="cornerRadius"`, `:min="0"`, icon `<icon-lucide-square-round-corner class="size-3" />` — byte-identical to the existing corner-radius field's icon/props at `AppearanceSection.vue:130-143`, reused for visual consistency between rectangle corner-radius and polygon/star point-radius. |
| Multi-select | Not supported in this packet's new block (`v-else-if="hasPointRadius && !isMulti && node"`) — matches the existing corner grid's own multi-select handling being the *other* branch's concern; keeping this block single-selection-only avoids duplicating the `NumberField`/mixed-value branch for a first slice. See Restrictions. |

### Banned List

- No literal colour, no new font-size class, no new radius class outside `rounded-md`/`rounded-lg` — none of this packet's UI touches colour, font size, or DOM border-radius (it is a numeric field reusing an existing component).
- No new `tv()` recipe — reuse `App/src/theme/panel/grid.ts`'s existing `fill` variant.
- No new npm dependency — `arcToTangent` is already part of the pinned `canvaskit-wasm@^0.40.0`.
- No new CanvasKit `Paint`, `Shader`, or any WASM object beyond the one `Path` `makePolygonPath` already allocates and the caller already `.delete()`s (see CanvasKit/WASM lifecycle note).
- No new i18n string — reuse `panels.radius`.
- No change to `CORNER_RADIUS_TYPES` in any of its three existing locations (`packages/vue/src/shared/input/radius.ts`, `packages/core/src/canvas/overlays/selection.ts`, `packages/vue/src/controls/appearance/helpers.ts`).
- No change to `independentCorners`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`, or `toggleIndependentCorners`.

## CanvasKit/WASM lifecycle note

`makePolygonPath` allocates exactly one `Path` (`new r.ck.Path()`) both before and after this change — the rewrite adds `arcToTangent`/extra `lineTo` calls onto the same single `Path` object, it does not allocate a second one. Ownership and disposal are unchanged: every existing call site already calls `.delete()` on the returned path itself (`fills.ts:65`, `strokes.ts:253,424`) or on a wrapping path it was `addPath`'d into and then deleted (`shapes.ts:384-385`, `clipNodeShape`, `shadows.ts` via `drawPathShape`'s `finally { path.delete() }`, `shadows.ts:161-167`). No new cache, no new invalidation path, no `.delete()` ordering change anywhere in this diff.

## Allowed Changes

- `App/packages/core/src/canvas/shapes.ts` — rewrite `makePolygonPath`; add two local, unexported helper functions (`pointRadiusForNode`, `vertexMaxRadius`); add `Vector` to the existing `@open-pencil/scene-graph` type import.
- `App/packages/vue/src/controls/appearance/helpers.ts` — add `POINT_RADIUS_TYPES`; add `hasPointRadius` to `createAppearanceState`'s returned object.
- `App/packages/vue/src/primitives/AppearanceControls/types.ts` — add `hasPointRadius: boolean` to `AppearanceControlsRootSlotProps`.
- `App/packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` — add `:has-point-radius="ctx.hasPointRadius.value"` to the slot.
- `App/src/components/properties/AppearanceSection.vue` — destructure `hasPointRadius` from the slot; add the new `PanelGrid` block.
- `App/tests/engine/render/canvas/polygon-point-radius.test.ts` — new file.
- `App/tests/engine/vue/controls/appearance.test.ts` — extend with `hasPointRadius` cases.
- No other files.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT add a new scene-graph field.** Reuse `cornerRadius` per Fixed Decision 1.
- **Do NOT read or write `independentCorners`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, or `bottomLeftRadius` for `STAR`/`POLYGON`.** Per Fixed Decision 2.
- **Do NOT touch `cornerSmoothing` or `smoothCornerRadii`/`makeSmoothRRectPath`/the four `drawXSmoothCorner` functions (`shapes.ts:21-361`).** They are rectangle-corner-smoothing machinery, unrelated to this packet's vertex-rounding geometry, and are not read by `makePolygonPath`.
- **Do NOT edit `fills.ts`, `strokes.ts`, `shadows.ts`, `boolean.ts`, or `overlays/selection.ts`.** All of them already delegate to `makePolygonPath` (Verified Starting State) and need no change.
- **Do NOT edit any `.fig` codec file** (`kiwi/fig/node-change/convert.ts`, `serialize.ts`, or anywhere else). The round-trip already works (Verified Starting State).
- **Do NOT edit `io/formats/svg/export.ts` or `io/formats/svg/paths.ts`.** SVG export parity is a confirmed, separate gap, deliberately deferred — see "Deferred to a later packet."
- **Do NOT extend `CORNER_RADIUS_TYPES` in any of its three locations, and do NOT add drag-handle geometry, hit-testing, or overlay dots for `STAR`/`POLYGON`.** That is T-050b2's scope.
- **Do NOT add multi-selection support to the new Properties-panel block in this packet.** The new block is gated `!isMulti`; multi-select mixed-value handling for point radius is a small, separable follow-up, not required to make the single-selection case fully functional.
- **Do NOT introduce a `TRIANGLE` node type.** Confirmed there is none — a triangle is `POLYGON` with `pointCount: 3` (`App/packages/scene-graph/src/types.ts:77-96`'s `NodeType` union has no `'TRIANGLE'` member).
- **Do NOT introduce a new npm dependency.**

### Deferred to a later packet

- SVG (and any SVG-derived PDF) export of a rounded `STAR`/`POLYGON` — `io/formats/svg/paths.ts`'s `makePolygonPoints` needs an SVG arc-command equivalent of this packet's clamp/tangent-arc geometry. Not created here; needs its own packet ID.
- On-canvas point-radius drag handles — T-050b2, already planned in `Plan/plan.md`, depends on this packet.
- Multi-selection mixed-value editing for the new point-radius Properties-panel field.
- Star/polygon point-count and inner-radius-ratio editing controls — unrelated to corner/point radius, still entirely absent from the Properties panel (confirmed by T-050b, unchanged here).

## Implementation Steps

1. **Pre-flight.** Re-read `App/packages/core/src/canvas/shapes.ts:1-10,402-410` and confirm `makePolygonPath`'s current line span and the existing type import still match; reconcile any drift before editing.

2. **`packages/core/src/canvas/shapes.ts` — rewrite `makePolygonPath`.** Change the import at line 3 from:
   ```ts
   import type { SceneNode } from '@open-pencil/scene-graph'
   ```
   to:
   ```ts
   import type { SceneNode, Vector } from '@open-pencil/scene-graph'
   ```
   Add two new local helper functions directly above `makePolygonPath` (currently lines 402-410), and replace the function body:
   ```ts
   function pointRadiusForNode(node: SceneNode): number {
     const raw = node.cornerRadius
     return Number.isFinite(raw) ? Math.max(0, raw) : 0
   }

   function vertexMaxRadius(prev: Vector, vertex: Vector, next: Vector): number {
     const v1x = prev.x - vertex.x
     const v1y = prev.y - vertex.y
     const v2x = next.x - vertex.x
     const v2y = next.y - vertex.y
     const len1 = Math.hypot(v1x, v1y)
     const len2 = Math.hypot(v2x, v2y)
     if (len1 === 0 || len2 === 0) return 0
     const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (len1 * len2)))
     const halfAngle = Math.acos(cos) / 2
     const tanHalfAngle = Math.tan(halfAngle)
     if (!Number.isFinite(tanHalfAngle) || tanHalfAngle <= 0) return 0
     return (Math.min(len1, len2) / 2) * tanHalfAngle
   }

   export function makePolygonPath(r: SkiaRenderer, node: SceneNode): Path {
     const path = new r.ck.Path()
     const points = polygonVertices(node)
     const total = points.length
     const baseRadius = pointRadiusForNode(node)

     if (baseRadius <= 0 || total < 3) {
       points.forEach((point, index) => {
         if (index === 0) path.moveTo(point.x, point.y)
         else path.lineTo(point.x, point.y)
       })
       path.close()
       return path
     }

     const last = points[total - 1]
     const first = points[0]
     path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
     for (let i = 0; i < total; i++) {
       const prev = points[(i - 1 + total) % total]
       const curr = points[i]
       const next = points[(i + 1) % total]
       const radius = Math.min(baseRadius, vertexMaxRadius(prev, curr, next))
       if (radius <= 0) {
         path.lineTo(curr.x, curr.y)
       } else {
         path.arcToTangent(curr.x, curr.y, next.x, next.y, radius)
       }
     }
     path.close()
     return path
   }
   ```
   No other function in `shapes.ts` changes. `makeNodeShapePath`'s `'POLYGON'`/`'STAR'` case (lines 381-387) is unchanged — it already calls `r.makePolygonPath(node)`, which now returns the rounded path automatically.

3. **`packages/vue/src/controls/appearance/helpers.ts` — add the parallel gate.** After the existing `CORNER_RADIUS_TYPES` block (lines 10-17), add:
   ```ts
   const POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])
   ```
   Inside `createAppearanceState` (currently lines 38-85), after the `hasCornerRadius` computed (lines 39-42), add:
   ```ts
   const hasPointRadius = computed(() => {
     if (isMulti.value) return nodes.value.every((n) => POINT_RADIUS_TYPES.has(n.type))
     return node.value ? POINT_RADIUS_TYPES.has(node.value.type) : false
   })
   ```
   Add `hasPointRadius` to the function's returned object (currently lines 76-84), alongside `hasCornerRadius`.

4. **`packages/vue/src/primitives/AppearanceControls/types.ts` — thread the new prop through the slot type.** In `AppearanceControlsRootSlotProps` (lines 18-30), add a new field directly after `hasCornerRadius`:
   ```ts
   hasCornerRadius: boolean
   hasPointRadius: boolean
   ```

5. **`packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue` — pass it into the slot.** In the `<slot>` bindings (lines 19-31), add a new binding directly after `:has-corner-radius`:
   ```html
   :has-corner-radius="ctx.hasCornerRadius.value"
   :has-point-radius="ctx.hasPointRadius.value"
   ```

6. **`src/components/properties/AppearanceSection.vue` — expose the field.** Add `hasPointRadius` to the `v-slot` destructure (currently lines 49-61), directly after `hasCornerRadius`. Add a new `PanelGrid` block directly after the existing four-corner grid's closing `</PanelGrid>` (currently ending at line 223), before `</PanelSection>` (currently line 224):
   ```html
   <PanelGrid v-else-if="hasPointRadius && !isMulti && node" columns="fill" class="mt-panel">
     <PanelFieldGroup :label="panels.radius">
       <VariableNumberField
         :aria-label="panels.radius"
         :model-value="cornerRadiusValue"
         :min="0"
         :node-id="node.id"
         binding-path="cornerRadius"
         @update:model-value="actions.updateProp('cornerRadius', $event)"
         @commit="(v: number, p: number) => actions.commitProp('cornerRadius', v, p)"
       >
         <template #icon>
           <icon-lucide-square-round-corner class="size-3" />
         </template>
       </VariableNumberField>
     </PanelFieldGroup>
   </PanelGrid>
   ```
   This is a new `v-else-if` branch in the same chain as the two existing `PanelGrid`s (`v-if="hasCornerRadius && !showIndependentCorners"`, `v-else-if="hasCornerRadius && !isMulti && node"`); because `hasCornerRadius` and `hasPointRadius` are mutually exclusive by node-type membership, evaluation order does not conflict. `cornerRadiusValue` (already destructured from the slot, `AppearanceSection.vue:56`) is reused unchanged — it already reads `node.value?.cornerRadius ?? 0` generically (`helpers.ts:55-58`), which is correct for `STAR`/`POLYGON` too.

7. **New test file: `App/tests/engine/render/canvas/polygon-point-radius.test.ts`.** No `// @ts-nocheck` header needed — this file lives under `tests/engine/`, matching `corner-smoothing.test.ts` and `selection-outline.test.ts`, which have no such header (only `tests/e2e/**` and `tests/engine/**`'s Bun-runner-excluded files need it per the brief; this directory's existing sibling files show it is covered normally). Content:
   ```ts
   import { beforeAll, describe, expect, mock, test } from 'bun:test'

   import type { CanvasKit } from 'canvaskit-wasm'

   import { SceneGraph } from '@open-pencil/scene-graph'
   import { SkiaRenderer } from '@open-pencil/core'
   import type { SkiaRenderer as SkiaRendererType } from '#core/canvas/renderer'
   import { makePolygonPath } from '#core/canvas/shapes'
   import { initCanvasKit } from '#cli/headless'
   import { expectDefined } from '#tests/helpers/assert'

   function pageId(graph: SceneGraph) {
     return graph.getPages()[0].id
   }

   function createMockRenderer() {
     const paths: Array<{
       moveTo: ReturnType<typeof mock>
       lineTo: ReturnType<typeof mock>
       arcToTangent: ReturnType<typeof mock>
       close: ReturnType<typeof mock>
       delete: ReturnType<typeof mock>
     }> = []

     class MockPath {
       moveTo = mock(() => undefined)
       lineTo = mock(() => undefined)
       arcToTangent = mock(() => this)
       close = mock(() => undefined)
       delete = mock(() => undefined)

       constructor() {
         paths.push(this)
       }
     }

     const renderer = { ck: { Path: MockPath } } as unknown as SkiaRendererType
     return { renderer, paths }
   }

   describe('makePolygonPath: mock-based geometry contract', () => {
     test('radius 0 uses the plain sharp-vertex loop, no arcToTangent', () => {
       const graph = new SceneGraph()
       const node = graph.createNode('POLYGON', pageId(graph), {
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: 0
       })
       const { renderer, paths } = createMockRenderer()

       makePolygonPath(renderer, node).delete()

       expect(paths).toHaveLength(1)
       expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
       expect(paths[0].lineTo).toHaveBeenCalledTimes(3)
       expect(paths[0].arcToTangent).not.toHaveBeenCalled()
       expect(paths[0].close).toHaveBeenCalled()
     })

     test('a positive radius calls arcToTangent once per vertex, including a star inner vertex', () => {
       const graph = new SceneGraph()
       const node = graph.createNode('STAR', pageId(graph), {
         width: 200,
         height: 200,
         pointCount: 5,
         cornerRadius: 5
       })
       const { renderer, paths } = createMockRenderer()

       makePolygonPath(renderer, node).delete()

       expect(paths).toHaveLength(1)
       expect(paths[0].moveTo).toHaveBeenCalledTimes(1)
       expect(paths[0].lineTo).not.toHaveBeenCalled()
       expect(paths[0].arcToTangent).toHaveBeenCalledTimes(10)
       expect(paths[0].close).toHaveBeenCalled()
     })

     test('a radius past the vertex clamp is reduced, not applied verbatim', () => {
       const graph = new SceneGraph()
       const node = graph.createNode('POLYGON', pageId(graph), {
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: 500
       })
       const { renderer, paths } = createMockRenderer()

       makePolygonPath(renderer, node).delete()

       const call = paths[0].arcToTangent.mock.calls[0] as unknown[]
       const appliedRadius = call[4] as number
       expect(appliedRadius).toBeLessThan(500)
       expect(appliedRadius).toBeCloseTo(50 * Math.SQRT2, 5)
     })
   })

   describe('makePolygonPath: real-CanvasKit render regression', () => {
     let ck: CanvasKit

     beforeAll(async () => {
       ck = await initCanvasKit()
     })

     function getPixel(
       pixels: Uint8Array,
       width: number,
       x: number,
       y: number
     ): [number, number, number, number] {
       const idx = (Math.round(y) * width + Math.round(x)) * 4
       return [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]]
     }

     function isFilledColored(
       pixel: [number, number, number, number],
       bg: [number, number, number, number]
     ): boolean {
       const diff =
         Math.abs(pixel[0] - bg[0]) + Math.abs(pixel[1] - bg[1]) + Math.abs(pixel[2] - bg[2])
       return diff > 30 && pixel[0] > pixel[2]
     }

     function renderDiamond(radius: number) {
       const graph = new SceneGraph()
       const page = graph.getPages()[0]
       graph.createNode('POLYGON', page.id, {
         x: 0,
         y: 0,
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: radius,
         fills: [
           { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true, blendMode: 'NORMAL' }
         ],
         strokes: []
       })

       const width = 200
       const height = 200
       const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
       const renderer = new SkiaRenderer(ck, surface)
       renderer.viewportWidth = width
       renderer.viewportHeight = height
       renderer.pageId = page.id
       renderer.panX = 0
       renderer.panY = 0
       renderer.zoom = 1
       renderer.dpr = 1
       renderer.render(graph, new Set(), {}, 1)

       const image = surface.makeImageSnapshot()
       const pixels = expectDefined(
         image.readPixels(0, 0, {
           width,
           height,
           colorType: ck.ColorType.RGBA_8888,
           alphaType: ck.AlphaType.Unpremul,
           colorSpace: ck.ColorSpace.SRGB
         }),
         'pixels'
       )
       const bg = getPixel(pixels, width, 2, 2)
       image.delete()
       surface.delete()
       return { pixels, width, bg }
     }

     test('sharp diamond tip is filled when point radius is 0', () => {
       const { pixels, width, bg } = renderDiamond(0)
       expect(isFilledColored(getPixel(pixels, width, 100, 1), bg)).toBe(true)
     })

     test('a positive point radius rounds the tip away, interior stays filled', () => {
       const { pixels, width, bg } = renderDiamond(40)
       expect(isFilledColored(getPixel(pixels, width, 100, 1), bg)).toBe(false)
       expect(isFilledColored(getPixel(pixels, width, 100, 100), bg)).toBe(true)
     })

     test('a very large point radius clamps instead of self-intersecting or throwing', () => {
       expect(() => renderDiamond(500)).not.toThrow()
       const { pixels, width, bg } = renderDiamond(500)
       expect(isFilledColored(getPixel(pixels, width, 100, 100), bg)).toBe(true)
     })
   })
   ```
   The clamp math behind `50 * Math.SQRT2` in the third mock test: a 200×200 `pointCount: 4` `POLYGON` (a diamond) has vertices at `(100,0)`, `(200,100)`, `(100,200)`, `(0,100)`; the edge between any two adjacent vertices has length `100 * Math.SQRT2`; the angle at each vertex between its two neighbours is exactly 90°, so `tan(halfAngle) = tan(45°) = 1`, giving `vertexMaxRadius = (100 * Math.SQRT2) / 2 = 50 * Math.SQRT2 ≈ 70.71` — below the requested `500`, so the applied radius must clamp to that value. The real-render tests' pixel math: at radius 40 (below the ≈70.71 clamp), the rounded corner's apex sits `40 * (Math.SQRT2 - 1) ≈ 16.6` document units below the original sharp tip at `y=0`, so sampling at `y=1` falls inside the cut-away region (background); at radius 0 the same point is still inside the sharp tip (filled).

8. Run the commands under Verification in order.

## Acceptance Criteria

- [ ] `makePolygonPath(r, node)` with `node.cornerRadius <= 0` produces byte-identical `moveTo`/`lineTo`/`close()` calls to the pre-change function (no `arcToTangent`, no behaviour change for the default case).
- [ ] `makePolygonPath(r, node)` with `node.cornerRadius > 0` calls `arcToTangent` exactly once per vertex (`pointCount` for `POLYGON`, `pointCount * 2` for `STAR`), including a star's inner vertices, with no `isInner`/`isStar` special-casing that skips any vertex.
- [ ] The applied per-vertex radius is `Math.min(baseRadius, vertexMaxRadius)` and is provably reduced below the requested value when the requested value would otherwise cause adjacent tangent points to cross (verified by the diamond's exact `50 * Math.SQRT2` clamp case).
- [ ] Fill, stroke, shadow/effect silhouette, boolean-operation source geometry, `clipsContent` clipping, and the selection outline all visibly round for a `STAR`/`POLYGON` node with a positive `cornerRadius`, with no edit to `fills.ts`, `strokes.ts`, `shadows.ts`, `boolean.ts`, or `overlays/selection.ts`.
- [ ] The Properties panel's Appearance section shows a single radius field (no independent-corner toggle, no four-corner grid) for a selected `STAR`/`POLYGON` node, bound to the same `cornerRadius` field.
- [ ] `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION` Properties-panel behaviour (`hasCornerRadius`, `showIndependentCorners`, the four-corner grid) is unchanged — `hasPointRadius` is `false` for all of them.
- [ ] `.fig` round-trip of a `STAR`/`POLYGON` node's `cornerRadius` continues to work with no code change (confirmed pre-existing, not re-tested by this packet — see Stop Conditions if this assumption is found wrong).
- [ ] No new CanvasKit object beyond the one `Path` `makePolygonPath` already allocated; disposal is unchanged at every call site.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] `App/packages/vue/src/shared/input/radius.ts`, `App/packages/core/src/canvas/overlays/selection.ts`'s handle-drawing code, and all three `CORNER_RADIUS_TYPES` locations are unedited.

## Verification

### Development loop — repeat as needed

- `bun test tests/engine/render/canvas/polygon-point-radius.test.ts` from `App/` — covers both the fast mock-based geometry contract and the real-CanvasKit pixel regression in one file/command. Expect exit code `0`.

### Final pre-completion gates — run once

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` from `App/` (named explicitly because `helpers.ts`, `types.ts`, and `AppearanceControlsRoot.vue` live under `packages/vue/src`).
- Focused Oxlint: `oxlint -c oxlint.json --type-aware --type-check packages/core/src/canvas/shapes.ts packages/vue/src/controls/appearance/helpers.ts packages/vue/src/primitives/AppearanceControls/types.ts packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue src/components/properties/AppearanceSection.vue tests/engine/render/canvas/polygon-point-radius.test.ts tests/engine/vue/controls/appearance.test.ts` from `App/`.
- `bun test tests/engine/vue/controls/appearance.test.ts` from `App/` — the extended `hasPointRadius` coverage plus the existing unmodified `showIndependentCorners` cases; expect exit code `0`.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command, per the delivery policy.

## Integration or Installed-Result Check

Mandatory browser check on the dev server: `cd App && bun run dev`.

1. Draw a `POLYGON` (default `pointCount: 5`) or a `STAR`. Select it, open the Appearance section. Confirm a single "Radius" field is shown, with no independent-corner toggle button and no four-corner `TL/TR/BL/BR` grid.
2. Type a positive value (e.g. `20`) into that field. Confirm every vertex of the shape visibly rounds by the same amount — for a `STAR`, confirm both the outer points and the inner notches round, not just the outer points.
3. Increase the value well past what the shape's geometry can support (e.g. `500` on a small shape). Confirm the shape does not self-intersect, invert, or throw a console error — the rounding should visibly clamp (points fully softened, shape stays a valid closed silhouette).
4. Confirm the shape's fill, its stroke (add one via the Stroke section if not already present), and its selection outline (visible while selected) all show the same rounded silhouette consistently.
5. Add a drop shadow or inner shadow effect (Effects section) to the rounded shape. Confirm the effect's silhouette follows the rounded shape, not the old sharp one.
6. Select a `RECTANGLE` and confirm its Appearance section is unchanged — the plain radius field with the independent-corner toggle, and the four-corner grid when toggled, both still work exactly as before.
7. Set the `cornerRadius` back to `0` on the star/polygon. Confirm it returns to a perfectly sharp silhouette, matching its appearance before this packet.
8. Confirm no browser console errors appear during any of the above.

## Stop Conditions

- Stop and report if `arcToTangent` is not present on the runtime `Path` object returned by the actual CanvasKit WASM build in the browser (only the `.d.ts` type declaration was verified here, not a live call) — fall back to reporting the exact runtime error rather than silently swapping to a different arc primitive.
- Stop and report if any additional `POLYGON`/`STAR` render or geometry call site is found beyond the ones enumerated in Verified Starting State ("One caller, reached from every render/geometry site") — that would mean this packet's one-function-change premise is incomplete.
- Stop and report if a `.fig` round-trip test of a `STAR`/`POLYGON` node's `cornerRadius` is found to *not* survive import/export unchanged — that would mean Verified Starting State's "`.fig` round-trip already works" finding was wrong, and the Restrictions clause forbidding codec edits would need to be revisited before closing this packet.
- Stop if the `50 * Math.SQRT2` clamp value in Implementation Step 7's test does not match the actual observed `arcToTangent` call argument — recompute from the actual observed number and correct the packet's own citation before reporting, per the same discipline T-050a's Stop Conditions required for its own hand-derived value.

## Execution Report Contract

Report: exact files changed with line spans; the `bun test` pass counts for both `polygon-point-radius.test.ts` and `appearance.test.ts`; exit codes for `tsgo`, both `vue-tsc` invocations, and Oxlint; the actual observed `arcToTangent` radius argument substituted for the `50 * Math.SQRT2` estimate if it differs from the hand-derivation; the eight browser-check observations from the Integration section; confirmation that `fills.ts`, `strokes.ts`, `shadows.ts`, `boolean.ts`, `overlays/selection.ts`, and every `.fig` codec file remain unedited; any deviation from this packet and why.

## Status record
 
Status: **Done**

2026-08-24 — Implemented and verified:
1. `packages/core/src/canvas/shapes.ts`: Added `Vector` import, `pointRadiusForNode` and `vertexMaxRadius` helpers, and rewritten `makePolygonPath` to use `arcToTangent` with local vertex angle clamp.
2. `packages/vue/src/controls/appearance/helpers.ts`: Added `POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])` and `hasPointRadius` computed.
3. `packages/vue/src/primitives/AppearanceControls/types.ts`: Added `hasPointRadius: boolean` to `AppearanceControlsRootSlotProps`.
4. `packages/vue/src/primitives/AppearanceControls/AppearanceControlsRoot.vue`: Passed `:has-point-radius` prop to slot.
5. `src/components/properties/AppearanceSection.vue`: Destructured `hasPointRadius` and added the `PanelGrid` (with `columns="fill"`) single-radius input block.
6. `tests/engine/render/canvas/polygon-point-radius.test.ts`: Created new test suite covering mock geometry contracts and real CanvasKit rendering regression (6/6 tests passed).
7. `tests/engine/vue/controls/appearance.test.ts`: Extended with `hasPointRadius` single- and multi-selection tests (6/6 tests passed).
8. All type checks and lint checks (`tsgo`, `vue-tsc`, `oxlint`) passed cleanly.

2026-08-21 — Expanded from the `Brief` stub after full verification against live source. Key finding: every `POLYGON`/`STAR` render, boolean, clip, and selection-outline path already funnels through the single function `makePolygonPath` in `packages/core/src/canvas/shapes.ts`, so this packet is a one-function rendering change plus a small, separate Properties-panel gate — not the four-to-six-file change the stub's rough steps implied. Reuses the existing `cornerRadius` field (no new scene-graph field, no `.fig` codec change needed — both already round-trip it unconditionally). Every vertex, including a star's inner vertices, rounds identically per the already-accepted product decision. Clamp formula derived from first principles (`tan(halfAngle) * min(edgeLenPrev, edgeLenNext) / 2`) and shown to generalise T-050a's own rectangle-corner clamp exactly. SVG/PDF export parity and on-canvas drag handles (T-050b2) are explicitly deferred, not silently expanded into this packet's scope.
