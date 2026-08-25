# T-050b2 - Star/polygon radius drag handles

Task ID: T-050b2
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: **T-050b1 (star/polygon point-radius model and rendering) — hard execution-order dependency, not yet executed.** T-050b1 is `Ready` but its code changes do not exist in `App/` yet. This packet's contracts (the `cornerRadius` field name, the `vertexMaxRadius` clamp formula, `makePolygonPath`'s rounding behaviour) are taken from T-050b1's own finished packet as an authoritative plan, not from live source. **Before executing this packet, first execute T-050b1, then re-verify `packages/core/src/canvas/shapes.ts`'s landed `makePolygonPath`/`vertexMaxRadius` and `packages/vue/src/controls/appearance/helpers.ts`'s landed `POINT_RADIUS_TYPES` against this packet's Fixed Decisions below; if they differ from T-050b1's packet plan, reconcile before writing any code — see Stop Conditions.**
Related: T-050a (radius handles track inward with radius — the inward-tracking seam this packet's handle-position math builds on, Done), T-050b (blocked finding that motivated the T-050b1/T-050b2 split, To Do/closed-as-finding), T-004 (corner-radius node controls, Done)
Prepared from: T-050b's Open Decision 1 recommended default — the user accepted proceeding via "ok and expand them" (2026-08-21)
Expanded at: 2026-08-21
Expanded against: `App/packages/vue/src/shared/input/radius.ts` (whole file), `App/packages/vue/src/shared/input/types.ts` (whole file), `App/packages/core/src/canvas/overlays/selection.ts` (whole file), `App/packages/vue/src/canvas/useCanvasInput.ts:120-125,495-510,620-630,690-700` (grep-confirmed call sites, not otherwise edited), `App/packages/vue/src/shared/input/select.ts` (whole file), `App/packages/vue/src/shared/input/select/hover.ts` (whole file), `App/packages/scene-graph/src/geometry.ts:112-138` (`polygonVertices`), `App/packages/scene-graph/src/node-defaults.ts:195-210` (`pointCount: 5`, `starInnerRadius: 0.38` defaults), `App/packages/core/src/canvas/shapes.ts:1-10` (current import shape, pre-T-050b1), `App/packages/core/src/constants.ts:406` (`HANDLE_HIT_RADIUS = 8`), `App/tests/engine/editor/corner-radius-controls.test.ts` (whole file), `App/tests/engine/render/canvas/selection-outline.test.ts:1-40` (module-scope helpers, T-050a's added block), `App/tests/engine/vue/input/radius-cursor.test.ts` (confirmed present, run as regression only, not edited), `Plan/Packets/T-050b1-star-polygon-point-radius-render.md` (whole file — authoritative for not-yet-landed interfaces), `Plan/Packets/T-050b-radius-handles-other-shapes.md` (whole file), `Plan/Packets/T-050a-radius-handle-inward-tracking.md` (whole file), `Plan/Packets/T-061-canvaskit-memory-and-stability.md`, `Plan/Packets/T-035-contextual-selection-actions.md`, `App/AGENTS.md`, `Plan/endgoal.md`, `Plan/plan.md`
Delivery: named source gates + browser check
Execution size: 3 core implementation files (`packages/vue/src/shared/input/types.ts`, `packages/vue/src/shared/input/radius.ts`, `packages/core/src/canvas/overlays/selection.ts`); 2 test files extended across 2 existing suites (`tests/engine/editor/corner-radius-controls.test.ts`, `tests/engine/render/canvas/selection-outline.test.ts`), no new suite. One responsibility (on-canvas drag handles for the point-radius value), under the five-file ceiling, zero changes to `select.ts`, `select/hover.ts`, or `useCanvasInput.ts`.

## Intended Outcome

A selected `STAR` or `POLYGON` node shows one white drag-handle dot at each **outer** vertex (`pointCount` dots — a star's inner/concave vertices get no dot of their own). Every dot reads and writes the same single, uniform `cornerRadius` field T-050b1 adds rendering for, so dragging any one dot rounds the whole shape identically and every other dot visibly moves in sympathy on the next repaint. Each dot's resting inset from its vertex tracks the live `cornerRadius` value inward, exactly as T-050a's rectangle handles already do, but clamped by T-050b1's own per-vertex geometry (`vertexMaxRadius`) instead of the rectangle's `min(width,height)/2`, so a dot's rest position never overshoots what that vertex can actually round to. Hit-testing, hover cursor, live-drag preview, commit, and cancel all work through the same functions the rectangle family already uses, generalised internally — no existing rectangle/frame/component/instance/boolean-operation radius-handle behaviour changes.

## Request Coverage

- T-050b's user request ("the corner radius should be able to be changed with the visual dots on other shapes (star, polygon, triangle etc)") — covered for `STAR`/`POLYGON` (a triangle is `POLYGON` with `pointCount: 3`, confirmed no separate `TRIANGLE` node type exists — `App/packages/scene-graph/src/types.ts`'s `NodeType` union, re-confirmed by T-050b1's own verification). Extending to any node type outside `STAR`/`POLYGON` is out of scope — no other type has point-radius rendering.

## Verified Starting State

Two different kinds of evidence are cited below. Read the label on each block before trusting it.

### (A) Live today, read directly, real and unedited by T-050b1

`App/packages/vue/src/shared/input/types.ts:7` — `export type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'` — a fixed four-member union, used nowhere else as anything but a rectangle corner.

`App/packages/vue/src/shared/input/types.ts:92-106` — the live `DragRadius` interface:
```ts
export interface DragRadius {
  type: 'radius'
  nodeId: string
  corner: CornerPosition
  startLocalX: number
  startLocalY: number
  original: {
    cornerRadius: number
    topLeftRadius: number
    topRightRadius: number
    bottomRightRadius: number
    bottomLeftRadius: number
    independentCorners: boolean
  }
}
```

`App/packages/vue/src/shared/input/radius.ts` (whole file, 249 lines) — the complete live implementation:
- `RADIUS_CONTROL_SCREEN_INSET = 12` (line 10) and `CORNER_RADIUS_TYPES` (lines 12-19, `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION`).
- `getRadiusControlLocalPoint(corner, width, height, radius, zoom)` (lines 52-64) — already takes a `radius` parameter (T-050a landed this); computes `inset = clamp(radius, minInset, maxInset)` with `maxInset = Math.min(width, height) / 2`, then `cornerPoint(corner, width, height, inset)`.
- `getRadiusControlPosition(node, graph, corner, zoom)` (lines 66-75) — calls `radiusForCorner` then `getRadiusControlLocalPoint`, maps through `getWorldMatrix`.
- `hitTestRadiusControlByMatrix(cx, cy, node, graph, zoom)` (lines 77-93) — gated `if (!CORNER_RADIUS_TYPES.has(node.type)) return null` (line 84), loops the four fixed corners, returns `CornerPosition | null`.
- `tryStartRadius(cx, cy, editor)` (lines 179-205) — gated `!node || !CORNER_RADIUS_TYPES.has(node.type) || node.locked` (line 183), builds a `DragRadius` with the full six-field `original` snapshot.
- `applyRadiusDrag`/`commitRadiusDrag`/`cancelRadiusDrag` (lines 207-248) — preview/commit/cancel, all reached only through `d: DragRadius`.
- `radiusForCorner(corner, node)` (lines 168-173) — `node.independentCorners ? node[RADIUS_FIELD_BY_CORNER[corner]] : node.cornerRadius`.
- `getRadiusChanges(corner, node, radius)` (lines 124-166) — returns a strict `Pick<SceneNode, 'cornerRadius' | 'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius' | 'independentCorners'>`, writing all four per-corner fields plus `cornerRadius` in uniform mode, or exactly one per-corner field plus `independentCorners: true` in independent mode.
- `calculateRadiusFromLocalPointer(corner, startX, startY, currentX, currentY, originalRadius)` (lines 104-122) — projects pointer delta onto `CORNER_DIRECTIONS[corner]` (lines 21-26, fixed 45°-diagonal unit-ish vectors of length `Math.SQRT2`), divided by `Math.SQRT2`.

`App/packages/core/src/canvas/overlays/selection.ts` (whole file, 428 lines) — the complete live overlay draw code:
- `CORNER_RADIUS_TYPES` (lines 12-19), `RADIUS_CONTROL_SCREEN_INSET = 12` (line 21), `RadiusCorner` (line 23), `RADIUS_FIELD_BY_CORNER` (lines 25-33) — a package-boundary duplicate of the vue-side names (confirmed by T-050a: `packages/core` has no dependency on `@open-pencil/vue`, so this small mapping must be duplicated, not imported).
- `effectiveCornerRadius(node, corner)` (lines 35-38), `radiusHandleLocalPoint(corner, width, height, inset)` (lines 40-58) — pure local helpers.
- `drawRadiusHandles(r, canvas, node)` (lines 237-251) — loops the four fixed corners, computes `inset = clamp(effectiveCornerRadius(node, corner), minInset, maxInset)` with `maxInset = Math.min(width, height) / 2`, draws a white-filled, `r.selectionPaint`-stroked circle of `dotRadius = 4 / Math.max(r.zoom, Number.EPSILON)` per corner, reusing `r.auxFill`/`r.selectionPaint` — no new CanvasKit object.
- `drawNodeSelection(r, canvas, node, rotation, graph)` (lines 267-278) — calls `drawBoundsHandles`, then `if (CORNER_RADIUS_TYPES.has(node.type)) drawRadiusHandles(r, canvas, node)`. This is the one call site this packet extends.

`App/packages/vue/src/shared/input/select.ts:61-66`, `App/packages/vue/src/shared/input/select/hover.ts:60-79,139-144`, and `App/packages/vue/src/canvas/useCanvasInput.ts:503,626,695` (confirmed by grep) are the only three call sites of `tryStartRadius`/`hitTestRadiusControlByMatrix`/`applyRadiusDrag`+`commitRadiusDrag`+`cancelRadiusDrag` respectively, outside `radius.ts` itself and its two test files. Every one of them calls these functions by name with the same argument/return shape they use today (`if (radiusDrag) {...}`, `if (hit) return 'grab'`, `if (d.type === 'radius') ...`) — **none of them inspects the string value inside a returned `CornerPosition`**, so widening what that string can be (Fixed Decision 2) requires editing none of these three files. This is the load-bearing fact that keeps this packet's `Execution size` at three core files instead of six.

`App/packages/scene-graph/src/geometry.ts:112-138` — `polygonVertices(node: { width, height, pointCount, type, starInnerRadius })`, exported, returns `Vector[]` in node-local coordinates (`0..width`, `0..height`), the same coordinate space `getRadiusControlLocalPoint`/`drawRadiusHandles` already operate in. `totalPoints = isStar ? pointCount * 2 : pointCount`; a star's vertex `index % 2 === 1` is the inner point; `angleOffset = -Math.PI / 2` (12 o'clock start). This function is imported today by `packages/core/src/canvas/shapes.ts:4` via `import { polygonVertices } from '@open-pencil/scene-graph/geometry'` and by `packages/core/src/canvas/overlays/selection.ts:5` via the same module for `rotatedCorners` — confirming the module path is already resolvable from both packages this packet touches.

`App/packages/core/src/constants.ts:406` — `HANDLE_HIT_RADIUS = 8`, unchanged, unedited by this packet.

`App/tests/engine/editor/corner-radius-controls.test.ts` (whole file, 298 lines) — the exact test precedent this packet extends: `getRadiusControlLocalPoint`/`getRadiusControlPosition` pure-function cases, `tryStartRadius`/`applyRadiusDrag`/`commitRadiusDrag`/`cancelRadiusDrag` integration cases using `createEditor()`, and one negative case (`'ignores unsupported shapes and multiple selections'`, lines 269-286) that uses `ELLIPSE` as its unsupported-type example — `ELLIPSE` stays unsupported after this packet and this test needs no change.

### (B) T-050b1's plan — not yet in `App/`, cited from its packet only

The following are **not** live source. They are T-050b1's own binding Fixed Decisions and Implementation Steps, treated here as a fixed contract because T-050b1 is `Ready` (fully expanded, reviewed, not yet executed):

- **The field is `cornerRadius`, reused, no new scene-graph field** (T-050b1 Fixed Decision 1). This packet's handles read/write `node.cornerRadius` for `STAR`/`POLYGON`, exactly as they already do for the rectangle family.
- **`packages/core/src/canvas/shapes.ts`'s `makePolygonPath(r, node)`** will be rewritten to round every vertex (including a star's inner vertices) by `Math.min(baseRadius, vertexMaxRadius(prev, curr, next))`, where `baseRadius = Math.max(0, node.cornerRadius)` and:
  ```ts
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
  ```
  (T-050b1 Implementation Step 2, verbatim.) This packet's handle-position clamp reuses this exact formula so a handle's rest position always matches how far the renderer actually lets that vertex round — see Fixed Decision 3.
- **`packages/vue/src/controls/appearance/helpers.ts` will gain `POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])` and a `hasPointRadius` computed** (T-050b1 Fixed Decision 6, Implementation Step 3) for the Properties-panel radius field. That constant is **not exported** (T-050b1's Allowed Changes list it as an internal addition to `createAppearanceState`'s module, with no export), so this packet cannot import it and must declare its own equally-named local copy in `radius.ts` and `selection.ts` — a third, independent copy of the same two-member set, matching this codebase's existing precedent of duplicating `CORNER_RADIUS_TYPES` three times over (Verified Starting State (A) above).
- **T-050b1 explicitly reserves this packet's scope for itself**, stating in its own Fixed Decision 8 and Restrictions: "On-canvas drag handles remain T-050b2's scope... T-050b2 depends on this packet landing first and should read the exact clamp formula in Fixed Decision 4 as the geometry its handles must respect" and "Do NOT extend `CORNER_RADIUS_TYPES`... and do NOT add drag-handle geometry, hit-testing, or overlay dots for `STAR`/`POLYGON`. That is T-050b2's scope." T-050b1 makes **zero** change to `radius.ts`, `types.ts`, or `overlays/selection.ts` — confirmed by its own Allowed Changes list (five files, none of which are these three) and Restrictions ("Do NOT extend `CORNER_RADIUS_TYPES` in any of its three locations").

## Read First

- `App/packages/vue/src/shared/input/radius.ts` (whole file, 249 lines) — every function this packet rewrites or extends.
- `App/packages/vue/src/shared/input/types.ts:5-7,92-106` — `CornerPosition`, `DragRadius`, the interface this packet widens.
- `App/packages/core/src/canvas/overlays/selection.ts:1-58,237-278` — `CORNER_RADIUS_TYPES`, `effectiveCornerRadius`, `drawRadiusHandles`, `drawNodeSelection`.
- `App/packages/scene-graph/src/geometry.ts:112-138` — `polygonVertices`, the vertex source, unchanged by this packet.
- `Plan/Packets/T-050b1-star-polygon-point-radius-render.md`, section "Fixed Decisions" #1, #4, #6, #8 — the not-yet-landed contract this packet builds on. Re-read this section again immediately before writing code, per the Depends-on note above, and reconcile against T-050b1's actual landed diff if it has changed.

## Corrections to the Brief

The stub's premise and file citations are accurate. Two of its "Expansion Questions" needed a genuine design decision rather than a re-derivation from source (T-050b1 has no rendering-side notion of "a handle" at all, so no amount of re-reading settles the model on its own) — both are closed under Fixed Decisions 1 and 2 below, with the alternative recorded rather than silently discarded, per the packet-expansion brief's rule for product-taste questions.

## Fixed Decisions

1. **One drag handle per outer vertex (`pointCount` handles total); a star's inner/concave vertices get no handle of their own.** All handles read and write the same shared `node.cornerRadius` field, so dragging any one handle updates the whole shape identically and every other handle's drawn position updates on the next repaint. Reasoning: the value is genuinely uniform (T-050b1 Fixed Decision 2/3 — no per-vertex array, no `independentCorners` equivalent for these types), so multiple handles add no independent control, only **grab affordance** — and a handle at every outer vertex means the user can always grab one near wherever they are looking or have panned to, unlike a single fixed representative dot (e.g. always at outer vertex 0) which can be off-screen or awkward to reach after panning/zooming. Doubling the handle count to also mark inner vertices was rejected: at a typical `pointCount: 5` star that would be 10 dots, visually cluttering a shape whose inner points are already close together and small, for zero added control (an inner-vertex handle would still only write the same shared field). **Alternative considered and rejected:** a single representative handle at outer vertex 0 only — simpler to implement, but risks being hard to find on a rotated/panned/zoomed shape and gives no visual confirmation that dragging one point rounds the whole shape.
2. **`CornerPosition` is left exactly as it is today (rectangle family only). A new, parallel `VertexRadiusHandle` template-literal type is added instead of generalising `CornerPosition` in place**, closing T-050b's own Expansion Question on this point. `VertexRadiusHandle = \`vertex:${number}\`` and `RadiusHandle = CornerPosition | VertexRadiusHandle` are added to `types.ts`; `DragRadius.corner`'s type widens from `CornerPosition` to `RadiusHandle`, and `DragRadius` gains one new optional field, `direction?: Vector` (used only by vertex drags — see Fixed Decision 3). A template-literal string was chosen over a plain numeric vertex index specifically because the existing code has several `if (corner)` / `if (hit)` truthy checks (`select/hover.ts:76`, `tryStartRadius`'s `if (!corner) return null`) — a numeric encoding would make vertex index `0` indistinguishable from "not hit" (`0` is falsy in JavaScript), a real bug a plain `number | null` return would introduce silently. A non-empty string is always truthy regardless of which vertex it names, so every existing truthy check in `select.ts`, `select/hover.ts`, and `useCanvasInput.ts` keeps working unedited (Verified Starting State (A) above).
3. **Handle inward-tracking reuses T-050a's exact clamp shape (`inset = clamp(radius, 12/zoom, maxInset)`) but swaps in T-050b1's per-vertex `vertexMaxRadius` formula for `maxInset`, instead of T-050a's rectangle-specific `min(width, height) / 2`.** This makes each handle's rest position match exactly how far the renderer actually lets that specific vertex round (T-050b1's clamp is per-vertex and can differ between a star's outer and inner edge lengths). The direction a handle moves inward along is the unit vector from that vertex toward the shape's local centre (`width/2, height/2`) — for these always-**regular** polygon/star shapes (`polygonVertices` only ever generates a regular N-gon or regular star, confirmed by T-050b1's own verification of that function), the vertex-to-centre direction is exactly the angle bisector of the vertex's interior angle, so this is an exact, not approximate, direction. The **distance** mapping (`inset = radius`, not the tangent-arc's true sagitta offset from the vertex) is a deliberate simplification, directly matching T-050a's own precedent of accepting a simpler, symmetric handle-position approximation over the renderer's exact geometry (T-050a Fixed Decision 2: "deliberately simpler than the true... system... a handle-position clamp" does not need to be pixel-exact to the render). Only the **drag interaction** (pointer delta → radius delta, Fixed Decision 4) must be numerically exact; the idle resting position is cosmetic, exactly as it is for the existing four rectangle corners.
4. **The drag interaction is a direct generalisation of `calculateRadiusFromLocalPointer`'s existing diagonal-projection idea**, not a new interaction model: a new sibling function `calculateVertexRadiusFromLocalPointer(direction, startX, startY, currentX, currentY, originalRadius)` projects the pointer's local-space delta onto the vertex's own inward direction vector (computed once at drag-start and stored on `DragRadius.direction`, since it is a unit vector — no `Math.SQRT2` divisor is needed, unlike `CORNER_DIRECTIONS`'s length-`√2` vectors). This keeps the 1:1 pointer-distance-to-radius-delta relationship T-050a's Fixed Decision 1 established for the rectangle family.
5. **Small pure-math helpers are duplicated between `packages/vue/src/shared/input/radius.ts` and `packages/core/src/canvas/overlays/selection.ts`, not shared through an import**, per the confirmed package-boundary constraint (T-050a: `packages/core` has no dependency on `@open-pencil/vue`) and T-050b1's own choice to make its `vertexMaxRadius` a local, unexported helper inside `shapes.ts` (not importable from either file this packet touches). This is the same duplication shape `CORNER_RADIUS_TYPES` and `effectiveCornerRadius`/`RADIUS_FIELD_BY_CORNER` already use across these same two files.
6. **`POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])` is declared locally in both `radius.ts` and `selection.ts`, as a third independent copy of the same two-member set T-050b1 plans for `helpers.ts`.** Handles activate by membership in this new set, never by extending `CORNER_RADIUS_TYPES` — T-050b1's own Restrictions explicitly forbid adding `STAR`/`POLYGON` to `CORNER_RADIUS_TYPES` in any of its three locations, because that set also gates the rectangle-only independent-corners toggle and four-corner Properties-panel grid, neither of which apply to these types.
7. **`getRadiusChanges`'s return type widens from a strict `Pick<SceneNode, ...>` to `Partial<SceneNode>`; its new vertex branch returns `{ cornerRadius: nextRadius }` and nothing else** — never `independentCorners`, never any `topLeft/topRight/bottomLeft/bottomRightRadius` field — directly honouring T-050b1's Restriction that `STAR`/`POLYGON` must not read or write those fields. `editor.graph.updateNodePreview`/`editor.updateNode`/`editor.updateNodeWithUndo` (`packages/scene-graph/src/index.ts:363,367`, `packages/core/src/editor/nodes.ts:16,23`) all already accept `Partial<SceneNode>`, confirmed by grep across `App/packages` — no signature elsewhere needs to change to support this widening.
8. **`DragRadius.original` keeps its existing full six-field shape for both the rectangle and vertex drag cases**, rather than adding a second, narrower type. For a vertex drag this snapshot simply captures whatever `topLeftRadius`/`independentCorners`/etc. the `STAR`/`POLYGON` node already happened to hold (always their untouched defaults, since nothing else ever writes them for these types) and `cancelRadiusDrag` restores exactly those same pre-existing values on cancel — an identity restore of state that was already there, not a new read or write introduced by this packet's own logic. This is bookkeeping to keep one shared `DragRadius` type, not a violation of T-050b1's rendering-facing restriction (which is about the renderer/UI not *acting on* those fields for these types, not about a drag's own opening-value snapshot).

## Open Decisions

None. Both product-taste questions the stub raised are settled above with reasoning and a recorded alternative: the handle-per-vertex-vs-single-representative model (Fixed Decision 1) and the `CornerPosition`-generalise-in-place-vs-parallel-type choice (Fixed Decision 2). Whether star inner vertices get their own handles is settled by Fixed Decision 1 (no) as a direct consequence of the uniform-value product decision T-050b1 already fixed.

## Visual Contract — binding

This is a CanvasKit (canvas) draw, exactly like T-050a's — no DOM, no Tailwind, no recipe imports, no `data-test-id`.

| Element | Binding value |
| --- | --- |
| Handle fill colour | `r.ck.WHITE`, via `r.auxFill` — the exact same renderer-owned `Paint` `drawRadiusHandles` already uses. Do not construct a new `Paint`. |
| Handle stroke colour | `r.selectionPaint` — already configured by the caller (`drawSelection`/`drawSelectionRect`) before `drawNodeSelection` runs. Do not construct a new `Paint`. |
| Handle dot radius | `4 / Math.max(r.zoom, Number.EPSILON)` — byte-identical to `drawRadiusHandles`'s existing `dotRadius`. |
| Handle inward inset | `Math.min(Math.max(minInset, effectivePointRadius), maxInset)` where `minInset = 12 / Math.max(zoom, Number.EPSILON)` (identical floor and zoom-compensation to the rectangle family) and `maxInset = vertexMaxRadius(prev, curr, next)` (T-050b1's exact formula, Verified Starting State (B)). |
| Handle count and position | Exactly `Math.max(3, node.pointCount)` handles, one per outer vertex (array index `i` for `POLYGON`, `i * 2` for `STAR`, `i` in `0..pointCount-1`), positioned along the unit vector from that vertex toward `(width/2, height/2)`. |
| Coordinate space | Node-local, document units — reuse `withNodeBounds`'s existing `canvas.scale(r.zoom, r.zoom)` + `canvas.concat(worldMatrix)` pipeline on the core side, and `getWorldMatrix`/`Matrix.mapPoint` on the vue side, exactly as the rectangle handles already do. Do not hand-roll new pan/zoom/rotation math. |

### Banned List

- No new CanvasKit `Paint`, `Shader`, `Path`, or any other WASM-backed object. Reuse `r.auxFill` and `r.selectionPaint` exactly as `drawRadiusHandles` does today.
- No change to `HANDLE_HIT_RADIUS`, `RADIUS_CONTROL_SCREEN_INSET`'s value (`12`), or `constants.ts`.
- No change to `calculateRadiusFromLocalPointer`, `getRadiusControlLocalPoint`, `getRadiusControlPosition`, `hitTestRadiusControlByMatrix`'s rectangle branch, `drawRadiusHandles`, `effectiveCornerRadius`, or `radiusHandleLocalPoint` — the existing rectangle-family code paths inside the touched files must be left byte-identical aside from the added vertex branch.
- No change to `select.ts`, `select/hover.ts`, or `useCanvasInput.ts` — Fixed Decision 2 exists specifically so these files need no edit.
- No extension of `CORNER_RADIUS_TYPES` in either of its two locations in the touched files — Fixed Decision 6.
- No read or write of `independentCorners`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, or `bottomLeftRadius` for `STAR`/`POLYGON` outside the identity-restore snapshot described in Fixed Decision 8.
- No new npm dependency.
- No change to any Properties-panel file (`AppearanceSection.vue`, `helpers.ts`, `AppearanceControlsRoot.vue`, `types.ts` under `AppearanceControls/`) — that is T-050b1's scope, not this packet's.
- No change to `packages/core/src/canvas/shapes.ts` — that is T-050b1's scope; this packet only draws and hit-tests handles for a rounding behaviour T-050b1 implements.

## CanvasKit/WASM lifecycle note

Neither new function allocates a CanvasKit object. `drawVertexRadiusHandles` (the new core-side function) draws `canvas.drawCircle(...)` twice per handle using the two `Paint` objects (`r.auxFill`, `r.selectionPaint`) the renderer already owns and disposes through its own lifecycle (`destroyRenderer`, unrelated to this packet) — the exact same two objects `drawRadiusHandles` already uses, called with different coordinates and a different loop bound. No `.delete()`, cache, or invalidation path is added or changed by this packet.

## Allowed Changes

- `App/packages/vue/src/shared/input/types.ts` — add `VertexRadiusHandle`, `RadiusHandle`; widen `DragRadius.corner` to `RadiusHandle`; add `DragRadius.direction?: Vector`.
- `App/packages/vue/src/shared/input/radius.ts` — add `POINT_RADIUS_TYPES`; add `vertexMaxRadius`, `outerVertexArrayIndex`, `pointHandleCount`, `vertexGeometry`, `getVertexRadiusControlLocalPoint`, `getVertexRadiusControlPosition`, `calculateVertexRadiusFromLocalPointer`; extend `hitTestRadiusControlByMatrix`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, `radiusForCorner`, `getRadiusChanges` with a vertex branch; import `polygonVertices` from `@open-pencil/scene-graph/geometry`.
- `App/packages/core/src/canvas/overlays/selection.ts` — add `POINT_RADIUS_TYPES`; add `vertexMaxRadius`, `outerVertexArrayIndex`, `drawVertexRadiusHandles`; extend `drawNodeSelection`'s one call site; import `polygonVertices` alongside the existing `rotatedCorners` import.
- `App/tests/engine/editor/corner-radius-controls.test.ts` — add pure-function and integration coverage for the vertex path.
- `App/tests/engine/render/canvas/selection-outline.test.ts` — add a new `describe` block with render-based regression coverage.
- No other files.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT edit `packages/core/src/canvas/shapes.ts`.** That is T-050b1's file; its `makePolygonPath`/`vertexMaxRadius` are read here only as the authoritative not-yet-landed contract (Verified Starting State (B)).
- **Do NOT edit `select.ts`, `select/hover.ts`, or `useCanvasInput.ts`.** Fixed Decision 2 makes this unnecessary — every call site keeps working through the widened `RadiusHandle` return/param types with no code change.
- **Do NOT change `calculateRadiusFromLocalPointer`, `getRadiusControlLocalPoint`, `getRadiusControlPosition`, `CORNER_DIRECTIONS`, or the rectangle branch of `hitTestRadiusControlByMatrix`.** Only add a vertex branch alongside them.
- **Do NOT extend `CORNER_RADIUS_TYPES` in either of its locations in the touched files.** Fixed Decision 6.
- **Do NOT read or write `independentCorners`/`topLeftRadius`/`topRightRadius`/`bottomRightRadius`/`bottomLeftRadius` for `STAR`/`POLYGON`**, outside the identity-restore `original` snapshot (Fixed Decision 8), which must never be widened into a real per-corner write for these types.
- **Do NOT add a handle for a star's inner/concave vertices.** Fixed Decision 1.
- **Do NOT touch the Properties panel** (`AppearanceSection.vue`, `appearance/helpers.ts`, `AppearanceControls/*`) — T-050b1's scope, already closed.
- **Do NOT touch SVG/PDF export** (`io/formats/svg/paths.ts`, `io/formats/svg/export.ts`). T-050b1 explicitly defers export parity for the rounded shape itself; drag handles have no export representation at all and must not gain one here.
- **Do NOT introduce a `TRIANGLE` node type.** A triangle is `POLYGON` with `pointCount: 3`.
- **Do NOT introduce a new npm dependency.**
- **Do NOT allocate a new CanvasKit `Paint`/`Shader`/other WASM object.** Reuse `r.auxFill` and `r.selectionPaint`.

### Deferred to a later packet

- SVG/PDF export of the rounded `STAR`/`POLYGON` shape itself — already deferred by T-050b1, unaffected by this packet.
- Multi-selection mixed-value handle behaviour — `tryStartRadius` already requires exactly one selected node (`editor.state.selectedIds.size !== 1`); this packet does not change that gate for either the rectangle or the vertex path.
- Editing `pointCount`/`starInnerRadius` via a handle — out of scope; those remain creation-time-only values with no UI control, confirmed absent by T-050b (unchanged here).

## Implementation Steps

1. **Pre-flight.** Re-read `App/packages/vue/src/shared/input/radius.ts`, `App/packages/vue/src/shared/input/types.ts`, and `App/packages/core/src/canvas/overlays/selection.ts` in full and confirm the line spans in Verified Starting State (A) still match. Then re-read `Plan/Packets/T-050b1-star-polygon-point-radius-render.md`'s "Fixed Decisions" #1, #4, #6, #8 and confirm T-050b1 has actually landed with `cornerRadius` (not a new field) and the exact `vertexMaxRadius` formula quoted in Verified Starting State (B) — if T-050b1's real diff differs, stop per Stop Conditions before writing any code below.

2. **`packages/vue/src/shared/input/types.ts`.** Add directly after `CornerPosition` (currently line 7):
   ```ts
   export type VertexRadiusHandle = `vertex:${number}`
   export type RadiusHandle = CornerPosition | VertexRadiusHandle
   ```
   Change `DragRadius` (currently lines 92-106) — widen `corner` and add `direction`:
   ```ts
   export interface DragRadius {
     type: 'radius'
     nodeId: string
     corner: RadiusHandle
     startLocalX: number
     startLocalY: number
     direction?: Vector
     original: {
       cornerRadius: number
       topLeftRadius: number
       topRightRadius: number
       bottomRightRadius: number
       bottomLeftRadius: number
       independentCorners: boolean
     }
   }
   ```
   `Vector` is already imported at the top of this file (`import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'`).

3. **`packages/vue/src/shared/input/radius.ts`.** Add the import and constant directly after the existing imports (after line 8):
   ```ts
   import { polygonVertices } from '@open-pencil/scene-graph/geometry'
   import type { RadiusHandle, VertexRadiusHandle } from '#vue/shared/input/types'
   ```
   (Add to the existing `import type { CornerPosition, DragRadius } from '#vue/shared/input/types'` line rather than a new line: `import type { CornerPosition, DragRadius, RadiusHandle, VertexRadiusHandle } from '#vue/shared/input/types'`.)

   Add directly after `CORNER_RADIUS_TYPES` (currently lines 12-19):
   ```ts
   const POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])
   ```

   Add these new local helpers directly after `cornerPoint` (currently lines 37-50):
   ```ts
   function outerVertexArrayIndex(node: Pick<SceneNode, 'type'>, handleIndex: number): number {
     return node.type === 'STAR' ? handleIndex * 2 : handleIndex
   }

   function pointHandleCount(node: Pick<SceneNode, 'pointCount'>): number {
     return Math.max(3, node.pointCount)
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

   function vertexGeometry(
     node: Pick<SceneNode, 'width' | 'height' | 'pointCount' | 'type' | 'starInnerRadius'>,
     handleIndex: number
   ): { vertex: Vector; direction: Vector; maxInset: number } | null {
     const vertices = polygonVertices(node)
     const total = vertices.length
     if (total < 3) return null
     const arrIndex = outerVertexArrayIndex(node, handleIndex)
     const prev = vertices[(arrIndex - 1 + total) % total]
     const curr = vertices[arrIndex]
     const next = vertices[(arrIndex + 1) % total]
     const cx = node.width / 2
     const cy = node.height / 2
     const dx = cx - curr.x
     const dy = cy - curr.y
     const dist = Math.hypot(dx, dy)
     const direction = dist === 0 ? { x: 0, y: 0 } : { x: dx / dist, y: dy / dist }
     return { vertex: curr, direction, maxInset: vertexMaxRadius(prev, curr, next) }
   }

   export function getVertexRadiusControlLocalPoint(
     node: Pick<
       SceneNode,
       'width' | 'height' | 'pointCount' | 'type' | 'starInnerRadius' | 'cornerRadius'
     >,
     handleIndex: number,
     zoom = 1
   ): Vector {
     const geometry = vertexGeometry(node, handleIndex)
     if (!geometry) return { x: 0, y: 0 }
     const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)
     const safeRadius = Number.isFinite(node.cornerRadius) ? Math.max(0, node.cornerRadius) : 0
     const inset = Math.min(Math.max(minInset, safeRadius), geometry.maxInset)
     return {
       x: geometry.vertex.x + geometry.direction.x * inset,
       y: geometry.vertex.y + geometry.direction.y * inset
     }
   }

   export function getVertexRadiusControlPosition(
     node: SceneNode,
     graph: SceneGraph,
     handleIndex: number,
     zoom = 1
   ): Vector {
     const local = getVertexRadiusControlLocalPoint(node, handleIndex, zoom)
     return Matrix.mapPoint(getWorldMatrix(node, graph), local)
   }
   ```

   Change `hitTestRadiusControlByMatrix` (currently lines 77-93) to:
   ```ts
   export function hitTestRadiusControlByMatrix(
     cx: number,
     cy: number,
     node: SceneNode,
     graph: SceneGraph,
     zoom = 1
   ): RadiusHandle | null {
     const hitRadius = HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)

     if (CORNER_RADIUS_TYPES.has(node.type)) {
       for (const corner of ['nw', 'ne', 'se', 'sw'] as const) {
         const point = getRadiusControlPosition(node, graph, corner, zoom)
         const dx = cx - point.x
         const dy = cy - point.y
         if (dx * dx + dy * dy <= hitRadius * hitRadius) return corner
       }
       return null
     }

     if (POINT_RADIUS_TYPES.has(node.type)) {
       const count = pointHandleCount(node)
       for (let i = 0; i < count; i++) {
         const point = getVertexRadiusControlPosition(node, graph, i, zoom)
         const dx = cx - point.x
         const dy = cy - point.y
         if (dx * dx + dy * dy <= hitRadius * hitRadius)
           return `vertex:${i}` as VertexRadiusHandle
       }
     }

     return null
   }
   ```

   Change `radiusForCorner` (currently lines 168-173) to:
   ```ts
   function radiusForCorner(
     corner: RadiusHandle,
     node: Pick<DragRadius['original'], 'cornerRadius' | RadiusField | 'independentCorners'>
   ): number {
     if (corner.startsWith('vertex:')) return node.cornerRadius
     return node.independentCorners
       ? node[RADIUS_FIELD_BY_CORNER[corner as CornerPosition]]
       : node.cornerRadius
   }
   ```

   Change `getRadiusChanges` (currently lines 124-166) — widen the signature and return type, add the vertex branch:
   ```ts
   export function getRadiusChanges(
     corner: RadiusHandle,
     node: Pick<
       SceneNode,
       | 'cornerRadius'
       | 'topLeftRadius'
       | 'topRightRadius'
       | 'bottomRightRadius'
       | 'bottomLeftRadius'
       | 'independentCorners'
     >,
     radius: number
   ): Partial<SceneNode> {
     const nextRadius = Number.isFinite(radius) ? Math.max(0, radius) : node.cornerRadius

     if (corner.startsWith('vertex:')) return { cornerRadius: nextRadius }

     if (!node.independentCorners) {
       return {
         cornerRadius: nextRadius,
         topLeftRadius: nextRadius,
         topRightRadius: nextRadius,
         bottomRightRadius: nextRadius,
         bottomLeftRadius: nextRadius,
         independentCorners: false
       }
     }

     return {
       [RADIUS_FIELD_BY_CORNER[corner as CornerPosition]]: nextRadius,
       independentCorners: true
     }
   }
   ```

   Add a new function directly after `calculateRadiusFromLocalPointer` (currently ending at line 122):
   ```ts
   function calculateVertexRadiusFromLocalPointer(
     direction: Vector,
     startX: number,
     startY: number,
     currentX: number,
     currentY: number,
     originalRadius: number
   ): number {
     if (![startX, startY, currentX, currentY, originalRadius].every(Number.isFinite)) {
       return Math.max(0, Number.isFinite(originalRadius) ? originalRadius : 0)
     }
     const deltaX = currentX - startX
     const deltaY = currentY - startY
     const projectedDelta = deltaX * direction.x + deltaY * direction.y
     return Math.max(0, originalRadius + projectedDelta)
   }
   ```

   Change `tryStartRadius` (currently lines 179-205) to:
   ```ts
   export function tryStartRadius(cx: number, cy: number, editor: Editor): DragRadius | null {
     if (editor.state.selectedIds.size !== 1) return null
     const id = [...editor.state.selectedIds][0]
     const node = editor.graph.getNode(id)
     if (!node || node.locked) return null
     if (!CORNER_RADIUS_TYPES.has(node.type) && !POINT_RADIUS_TYPES.has(node.type)) return null

     const corner = hitTestRadiusControlByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)
     if (!corner) return null
     const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
     if (!local) return null

     const direction = corner.startsWith('vertex:')
       ? vertexGeometry(node, Number(corner.slice('vertex:'.length)))?.direction
       : undefined

     return {
       type: 'radius',
       nodeId: id,
       corner,
       startLocalX: local.x,
       startLocalY: local.y,
       direction,
       original: {
         cornerRadius: node.cornerRadius,
         topLeftRadius: node.topLeftRadius,
         topRightRadius: node.topRightRadius,
         bottomRightRadius: node.bottomRightRadius,
         bottomLeftRadius: node.bottomLeftRadius,
         independentCorners: node.independentCorners
       }
     }
   }
   ```

   Change `applyRadiusDrag` (currently lines 207-224) to:
   ```ts
   export function applyRadiusDrag(d: DragRadius, cx: number, cy: number, editor: Editor): void {
     const node = editor.graph.getNode(d.nodeId)
     if (!node) return
     const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
     if (!local) return
     const originalRadius = radiusForCorner(d.corner, d.original)
     const next = Math.round(
       d.corner.startsWith('vertex:') && d.direction
         ? calculateVertexRadiusFromLocalPointer(
             d.direction,
             d.startLocalX,
             d.startLocalY,
             local.x,
             local.y,
             originalRadius
           )
         : calculateRadiusFromLocalPointer(
             d.corner as CornerPosition,
             d.startLocalX,
             d.startLocalY,
             local.x,
             local.y,
             originalRadius
           )
     )
     editor.graph.updateNodePreview(d.nodeId, getRadiusChanges(d.corner, d.original, next))
     editor.requestRepaint()
   }
   ```

   Change `commitRadiusDrag` (currently lines 226-242) to:
   ```ts
   export function commitRadiusDrag(d: DragRadius, editor: Editor): void {
     const node = editor.graph.getNode(d.nodeId)
     if (!node) return
     const finalRadius: number = d.corner.startsWith('vertex:')
       ? node.cornerRadius
       : node.independentCorners
         ? node[RADIUS_FIELD_BY_CORNER[d.corner as CornerPosition]]
         : node.cornerRadius
     const originalRadius = radiusForCorner(d.corner, d.original)
     if (!Number.isFinite(finalRadius) || finalRadius === originalRadius) {
       editor.updateNode(d.nodeId, originalRadiusChanges(d))
       return
     }

     const finalChanges = getRadiusChanges(d.corner, d.original, finalRadius)
     editor.updateNode(d.nodeId, originalRadiusChanges(d))
     editor.updateNodeWithUndo(d.nodeId, finalChanges, 'Adjust corner radius')
     editor.requestRepaint()
   }
   ```

   `cancelRadiusDrag` (currently lines 244-248) is unchanged — it already only reads `d.original`, which is populated identically for both drag kinds.

4. **`packages/core/src/canvas/overlays/selection.ts`.** Change the existing geometry import (currently line 5) from:
   ```ts
   import { rotatedCorners } from '@open-pencil/scene-graph/geometry'
   ```
   to:
   ```ts
   import { polygonVertices, rotatedCorners } from '@open-pencil/scene-graph/geometry'
   ```
   Add directly after the existing `CORNER_RADIUS_TYPES` block (currently lines 12-19):
   ```ts
   const POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])
   ```
   Add these local helpers directly after `radiusHandleLocalPoint` (currently ending at line 58):
   ```ts
   function outerVertexArrayIndex(node: Pick<SceneNode, 'type'>, handleIndex: number): number {
     return node.type === 'STAR' ? handleIndex * 2 : handleIndex
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

   function drawVertexRadiusHandles(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
     const vertices = polygonVertices(node)
     const total = vertices.length
     if (total < 3) return
     const count = Math.max(3, node.pointCount)
     const cx = node.width / 2
     const cy = node.height / 2
     const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(r.zoom, Number.EPSILON)
     const dotRadius = 4 / Math.max(r.zoom, Number.EPSILON)
     const radius = Number.isFinite(node.cornerRadius) ? Math.max(0, node.cornerRadius) : 0

     for (let i = 0; i < count; i++) {
       const arrIndex = outerVertexArrayIndex(node, i)
       const prev = vertices[(arrIndex - 1 + total) % total]
       const curr = vertices[arrIndex]
       const next = vertices[(arrIndex + 1) % total]
       const dx = cx - curr.x
       const dy = cy - curr.y
       const dist = Math.hypot(dx, dy)
       const maxInset = vertexMaxRadius(prev, curr, next)
       const inset = Math.min(Math.max(minInset, radius), maxInset)
       const x = dist === 0 ? curr.x : curr.x + (dx / dist) * inset
       const y = dist === 0 ? curr.y : curr.y + (dy / dist) * inset
       r.auxFill.setColor(r.ck.WHITE)
       canvas.drawCircle(x, y, dotRadius, r.auxFill)
       canvas.drawCircle(x, y, dotRadius, r.selectionPaint)
     }
   }
   ```
   Change `drawNodeSelection` (currently lines 267-278) — its one relevant line, from:
   ```ts
     drawSelectionRect(r, canvas, node, rotation, graph, (x1, y1, x2, y2) => {
       drawBoundsHandles(r, canvas, x1, y1, x2, y2)
       if (CORNER_RADIUS_TYPES.has(node.type)) drawRadiusHandles(r, canvas, node)
     })
   ```
   to:
   ```ts
     drawSelectionRect(r, canvas, node, rotation, graph, (x1, y1, x2, y2) => {
       drawBoundsHandles(r, canvas, x1, y1, x2, y2)
       if (CORNER_RADIUS_TYPES.has(node.type)) drawRadiusHandles(r, canvas, node)
       else if (POINT_RADIUS_TYPES.has(node.type)) drawVertexRadiusHandles(r, canvas, node)
     })
   ```

5. **Extend `App/tests/engine/editor/corner-radius-controls.test.ts`.** Add `getVertexRadiusControlLocalPoint`, `getVertexRadiusControlPosition` to the existing import from `#vue/shared/input/radius` (line 8-17). Add, after the existing rectangle `test.each` blocks (after line 58):
   ```ts
   describe('star/polygon vertex radius handles', () => {
     const diamond = {
       width: 200,
       height: 200,
       pointCount: 4,
       type: 'POLYGON',
       starInnerRadius: 0.38
     } as const

     test('handle sits at the fixed 12px floor when cornerRadius is 0', () => {
       expect(getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 0 }, 0, 1)).toEqual({
         x: 100,
         y: 12
       })
     })

     test('handle moves inward as cornerRadius grows toward the vertex clamp', () => {
       expect(getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 40 }, 0, 1)).toEqual({
         x: 100,
         y: 40
       })
     })

     test('handle clamps at the vertex max radius instead of overshooting', () => {
       const point = getVertexRadiusControlLocalPoint({ ...diamond, cornerRadius: 999 }, 0, 1)
       expect(point.x).toBeCloseTo(100, 5)
       expect(point.y).toBeCloseTo(50 * Math.SQRT2, 5)
     })

     test('a star handle set has pointCount handles, none at the inner vertices', () => {
       const editor = createEditor()
       const node = editor.graph.createNode('STAR', editor.state.currentPageId, {
         width: 200,
         height: 200,
         pointCount: 5,
         starInnerRadius: 0.38,
         cornerRadius: 0
       })
       editor.select([node.id])
       for (let i = 0; i < 5; i++) {
         const point = getVertexRadiusControlPosition(node, editor.graph, i)
         const drag = tryStartRadius(point.x, point.y, editor)
         expect(drag).not.toBeNull()
         expect(drag?.corner).toBe(`vertex:${i}`)
       }
     })

     test('dragging one vertex handle rounds the shared cornerRadius and every handle moves', () => {
       const editor = createEditor()
       const node = editor.graph.createNode('POLYGON', editor.state.currentPageId, {
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: 0
       })
       editor.select([node.id])
       const start = getVertexRadiusControlPosition(node, editor.graph, 0)
       const drag = tryStartRadius(start.x, start.y, editor)
       expect(drag).not.toBeNull()
       if (!drag) return

       applyRadiusDrag(drag, start.x, start.y + 28, editor)
       commitRadiusDrag(drag, editor)

       const changed = editor.graph.getNode(node.id)
       expect(changed?.cornerRadius).toBe(28)
       expect(changed?.topLeftRadius).toBe(0)
       expect(changed?.independentCorners).toBe(false)
       expect(editor.undo.undoLabel).toBe('Adjust corner radius')

       const otherHandle = getVertexRadiusControlPosition(node, editor.graph, 2)
       expect(otherHandle).toEqual({ x: 100, y: 200 - 28 })
     })

     test('cancel restores the opening cornerRadius without an undo entry', () => {
       const editor = createEditor()
       const node = editor.graph.createNode('POLYGON', editor.state.currentPageId, {
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: 10
       })
       editor.select([node.id])
       const point = getVertexRadiusControlPosition(node, editor.graph, 0)
       const drag = tryStartRadius(point.x, point.y, editor)
       expect(drag).not.toBeNull()
       if (!drag) return
       applyRadiusDrag(drag, point.x, point.y + 30, editor)
       cancelRadiusDrag(drag, editor)

       expect(editor.graph.getNode(node.id)?.cornerRadius).toBe(10)
       expect(editor.undo.canUndo).toBe(false)
     })

     test('ELLIPSE and VECTOR stay unsupported', () => {
       const editor = createEditor()
       const ellipse = editor.graph.createNode('ELLIPSE', editor.state.currentPageId, {
         width: 200,
         height: 100
       })
       editor.select([ellipse.id])
       expect(tryStartRadius(100, 50, editor)).toBeNull()
     })
   })
   ```
   The `50 * Math.SQRT2 ≈ 70.71` clamp value reuses the exact diamond derivation T-050b1's own packet already worked through for the identical 200×200, `pointCount: 4` shape (see Verified Starting State (B)) — a 90° vertex angle with adjacent edge length `100 * Math.SQRT2`, giving `vertexMaxRadius = (100 * Math.SQRT2) / 2 = 50 * Math.SQRT2`.

6. **Extend `App/tests/engine/render/canvas/selection-outline.test.ts`.** Add a new `describe` block after T-050a's block, reusing the file's module-scope `ck`, `getPixel`, `isSelectionColored`, and `expectDefined` (already imported/defined at the top of the file):
   ```ts
   describe('T-050b2: Star/polygon vertex radius handles', () => {
     function renderPolygon(radius: number) {
       const graph = new SceneGraph()
       const page = graph.getPages()[0]
       const node = graph.createNode('POLYGON', page.id, {
         x: 50,
         y: 50,
         width: 200,
         height: 200,
         pointCount: 4,
         cornerRadius: radius,
         fills: [],
         strokes: []
       })

       const width = 300
       const height = 300
       const surface = expectDefined(ck.MakeSurface(width, height), 'surface')
       const renderer = new SkiaRenderer(ck, surface)
       renderer.viewportWidth = width
       renderer.viewportHeight = height
       renderer.pageId = page.id
       renderer.panX = 0
       renderer.panY = 0
       renderer.zoom = 1
       renderer.dpr = 1
       renderer.render(graph, new Set([node.id]), {}, 1)

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
       const bg = getPixel(pixels, width, 10, 10)
       image.delete()
       surface.delete()
       return { pixels, width, bg }
     }

     function sampleRingHit(
       pixels: Uint8Array,
       width: number,
       cx: number,
       cy: number,
       dotRadius: number,
       bg: [number, number, number, number]
     ): boolean {
       const offsets: [number, number][] = [
         [dotRadius, 0],
         [-dotRadius, 0],
         [0, dotRadius],
         [0, -dotRadius]
       ]
       return offsets.some(([dx, dy]) =>
         isSelectionColored(getPixel(pixels, width, cx + dx, cy + dy), bg)
       )
     }

     test('a top-vertex handle sits at the fixed floor when cornerRadius is 0', () => {
       const { pixels, width, bg } = renderPolygon(0)
       expect(sampleRingHit(pixels, width, 150, 62, 4, bg)).toBe(true)
       expect(sampleRingHit(pixels, width, 150, 90, 4, bg)).toBe(false)
     })

     test('the handle moves inward as cornerRadius grows', () => {
       const { pixels, width, bg } = renderPolygon(40)
       expect(sampleRingHit(pixels, width, 150, 90, 4, bg)).toBe(true)
       expect(sampleRingHit(pixels, width, 150, 62, 4, bg)).toBe(false)
     })

     test('the handle clamps at the vertex max radius instead of flying past it', () => {
       const { pixels, width, bg } = renderPolygon(999)
       expect(sampleRingHit(pixels, width, 150, 120.71, 4, bg)).toBe(true)
     })

     test('a 4-point polygon draws exactly 4 handles, none at the shape centre', () => {
       const { pixels, width, bg } = renderPolygon(40)
       expect(sampleRingHit(pixels, width, 150, 150, 4, bg)).toBe(false)
     })
   })
   ```
   These reuse the exact `SkiaRenderer`/`readPixels`/`isSelectionColored` pattern T-050a already established in this file (lines 36-88) and reuse the same 200×200 diamond dimensions and derived numbers as Implementation Step 5's pure-function tests, offset by the node's `x: 50, y: 50` position.

7. Run the commands under Verification in order.

## Acceptance Criteria

- [ ] A selected `STAR`/`POLYGON` node draws exactly `Math.max(3, node.pointCount)` handle dots, one per outer vertex, none at a star's inner vertices.
- [ ] Every handle's hit-test position matches its drawn position, verified through the same `getVertexRadiusControlPosition` function both `hitTestRadiusControlByMatrix` and the render test read.
- [ ] Dragging any one handle updates the shared `node.cornerRadius` only — never `independentCorners`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, or `bottomLeftRadius` — and every other handle's position updates to match on the next repaint.
- [ ] A handle's resting inset equals `clamp(cornerRadius, 12/zoom, vertexMaxRadius(prev, curr, next))`, using T-050b1's exact clamp formula, not the rectangle family's `min(width,height)/2`.
- [ ] `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION` handle behaviour (four fixed corners, `independentCorners`) is byte-identical to before this packet.
- [ ] `ELLIPSE`, `VECTOR`, and every other node type outside `CORNER_RADIUS_TYPES`/`POINT_RADIUS_TYPES` remain unsupported — `tryStartRadius` returns `null`.
- [ ] `select.ts`, `select/hover.ts`, and `useCanvasInput.ts` are unedited (Fixed Decision 2), confirmed by `git diff`-equivalent inspection or an explicit "no changes" note in the Execution Report.
- [ ] No new CanvasKit object is allocated; `drawVertexRadiusHandles` uses only `r.auxFill` and `r.selectionPaint`.
- [ ] Nothing in the Banned List appears in the diff.

## Verification

### Development loop — repeat as needed

- `bun test tests/engine/editor/corner-radius-controls.test.ts` from `App/` — the pure-function and integration coverage for both the rectangle and vertex paths, fast, no CanvasKit init. Expect exit code `0`.

### Final pre-completion gates — run once

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` from `App/` (named explicitly because `radius.ts` and `types.ts` live under `packages/vue/src`).
- Focused Oxlint: `oxlint -c oxlint.json --type-aware --type-check packages/core/src/canvas/overlays/selection.ts packages/vue/src/shared/input/radius.ts packages/vue/src/shared/input/types.ts tests/engine/editor/corner-radius-controls.test.ts tests/engine/render/canvas/selection-outline.test.ts` from `App/`.
- `bun test tests/engine/render/canvas/selection-outline.test.ts` from `App/` — the new render-based regression coverage plus every existing T-062/T-050a case in the same file, unchanged; expect exit code `0`.
- `bun test tests/engine/vue/input/radius-cursor.test.ts` from `App/` — proves T-040's cursor behaviour and the rectangle hit-test path are unaffected; expect exit code `0`, unchanged from before this packet.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command, per the delivery policy.

## Integration or Installed-Result Check

Mandatory browser check on the dev server: `cd App && bun run dev`. **This check requires T-050b1 to already be executed and landed** — without it, `cornerRadius` has no visible effect on a `STAR`/`POLYGON` shape and step 2 below cannot be observed.

1. Draw a `POLYGON` (default `pointCount: 5`). Select it. Confirm five white dots appear, one at each outer point, sitting a small fixed distance in from each point (radius is 0 on a fresh shape).
2. Drag one dot inward. Confirm the shape's vertices visibly round (via T-050b1's rendering) as the dot moves, and confirm the other four dots also move inward on the same drag, in sync with the one being dragged.
3. Release, then draw a `STAR`. Select it. Confirm five dots appear, only at the five outer points — none at the five inner notches.
4. Drag a star's outer-point dot inward. Confirm both the outer points and the inner notches round (T-050b1's rendering rounds every vertex), even though only the outer points have draggable dots.
5. Drag a dot on a small polygon far past what the shape can support. Confirm the dot's own movement stops (clamps) before it reaches the shape's centre or crosses to another vertex's side, and confirm the rendered shape does not self-intersect or invert.
6. Hover (without dragging) over a dot. Confirm the cursor shows `grab`; confirm it shows `grabbing` while dragging.
7. Select a `RECTANGLE` and confirm its four corner dots behave exactly as before this packet — unaffected.
8. Confirm no browser console errors appear during any of the above.

## Stop Conditions

- **Stop before writing any code if T-050b1 has not actually landed in `App/`** (i.e. `packages/core/src/canvas/shapes.ts`'s `makePolygonPath` still builds a plain sharp-vertex loop with no `cornerRadius` read) — this packet's handles would then control a value the renderer ignores, exactly the broken-control outcome T-050b was created to avoid. Report and wait for T-050b1 to execute first.
- **Stop and report if T-050b1's landed `vertexMaxRadius` formula, `cornerRadius` field name, or `POINT_RADIUS_TYPES` membership differ from what is quoted in Verified Starting State (B)** — re-derive this packet's clamp/hit-test math from the actual landed code before proceeding, rather than silently keeping the quoted formula.
- Stop and report if `hitTestRadiusControlByMatrix`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, or `cancelRadiusDrag` have any call site beyond `radius.ts` itself, `select.ts`, `select/hover.ts`, `useCanvasInput.ts`, and the two named test files — that would mean Fixed Decision 2's "zero call-site changes" claim has a wider blast radius than verified here.
- Stop if the `50 * Math.SQRT2` clamp value or any other hand-derived pixel/geometry number in Implementation Steps 5-6 does not match the actual observed output after the code change — recompute from the actual observed number and correct the packet's own citation before reporting, matching the discipline T-050a and T-050b1 both required for their own hand-derived values.
- Stop and report if `packages/core`'s dependency list has changed since this packet was expanded (i.e. a dependency on `@open-pencil/vue` now exists) — that would remove the reason for duplicating `POINT_RADIUS_TYPES`/`vertexMaxRadius` and Fixed Decision 5 would need revisiting.

## Execution Report Contract

Report: exact files changed with line spans; the `bun test` pass counts for `corner-radius-controls.test.ts` and `selection-outline.test.ts`; exit codes for `tsgo`, both `vue-tsc` invocations, and Oxlint; explicit confirmation `radius-cursor.test.ts` still passes unmodified; explicit confirmation `select.ts`, `select/hover.ts`, and `useCanvasInput.ts` remain unedited; the actual observed values substituted for any hand-derived estimate that differed; the eight browser-check observations from the Integration section; confirmation of which T-050b1 landed interfaces (field name, clamp formula) this packet's code actually matched against, if they required reconciliation per the Depends-on note; any deviation from this packet and why.

## Status record

Status: **Done**

2026-08-21 — Expanded from the `Brief` stub after full verification against live source (rectangle-family radius machinery, `polygonVertices`, package-boundary constraint) and against T-050b1's finished-but-not-yet-executed packet plan (field name, clamp formula, `POINT_RADIUS_TYPES` naming), cited separately per the CRITICAL dependency note. Key design decisions closed: one handle per outer vertex only (uniform value, no inner-vertex handles); `CornerPosition` left untouched, a new template-literal `VertexRadiusHandle` type added in parallel to avoid a falsy-zero bug a numeric encoding would have introduced; handle inset reuses T-050a's clamp shape with T-050b1's per-vertex `vertexMaxRadius` swapped in for the rectangle-specific `min(width,height)/2`. Because every existing call site (`select.ts`, `select/hover.ts`, `useCanvasInput.ts`) consumes the touched functions only by name/truthiness, this packet needs zero changes to those three files — execution size stays at three core implementation files, under the five-file ceiling. Hard execution-order dependency on T-050b1 is stated plainly in the header, Depends-on line, Verified Starting State's (A)/(B) split, and the Stop Conditions.

2026-08-24 — Executed and verified. Added `VertexRadiusHandle`/`RadiusHandle` types and widened `DragRadius` in `types.ts`; added point radius geometry/hit-testing/drag-calc helpers in `radius.ts`; added `drawVertexRadiusHandles` in `overlays/selection.ts`. Added test suites in `corner-radius-controls.test.ts` (33/33 passed) and `selection-outline.test.ts` (11/11 passed). Verified `radius-cursor.test.ts` (5/5 passed), `tsgo`, and both `vue-tsc` checks passed with exit code 0; oxlint clean.
