# T-050a - Corner-radius handles track inward with the live radius value

Task ID: T-050a
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-004 (corner-radius node controls; Done, live), T-050 (integer corner-radius values; Ready — rounds the value this packet reads, composes automatically, see Fixed Decision 6)
Related: T-040 (corner-radius cursor; Done — its hit-test call inherits this packet's new geometry with no code change of its own, see Fixed Decision 5), T-050b (extends radius handles to star/polygon/triangle; explicitly out of scope, see Restrictions), T-062 (selection outline fidelity; touches the same overlay file, a different function)
Prepared from: the user's direct request — "when the user clicks and drags the little dots on the corners to increase the corner radius, the dots should move inwards to the center of the shape"
Expanded at: 2026-08-21 14:20 Africa/Johannesburg
Expanded against: `App/packages/vue/src/shared/input/radius.ts` (whole file), `App/packages/core/src/canvas/overlays/selection.ts` (whole file), `App/packages/vue/src/shared/input/select/hover.ts` (whole file), `App/packages/core/src/canvas/shapes.ts:1-135`, `App/packages/core/src/editor/nodes.ts` (whole file), `App/packages/core/src/canvas/renderer/pipeline.ts:140-200`, `App/packages/core/src/constants.ts:395-409`, `App/packages/scene-graph/src/node-defaults.ts:90-100`, `App/packages/core/package.json:177-204`, `App/tests/engine/editor/corner-radius-controls.test.ts` (whole file), `App/tests/engine/vue/input/radius-cursor.test.ts` (whole file), `App/tests/engine/render/canvas/selection-outline.test.ts` (whole file), `Plan/Packets/T-004-corner-radius-node-controls.md`, `Plan/Packets/T-040-corner-radius-cursor.md`, `Plan/Packets/T-050-integer-corner-radius-values.md`
Delivery: named source gates + browser check
Execution size: 2 core implementation files (`packages/core/src/canvas/overlays/selection.ts`, `packages/vue/src/shared/input/radius.ts`); 2 test files extended (`tests/engine/editor/corner-radius-controls.test.ts`, `tests/engine/render/canvas/selection-outline.test.ts`), no new suite added. One responsibility, well under the five-file ceiling.

## Intended Outcome

The four corner-radius handles on a selected `RECTANGLE`/`ROUNDED_RECTANGLE`/`FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION` node visibly move further toward the shape's centre as that corner's live radius value grows, and back out toward the corner as the radius shrinks toward 0 — both while a handle is actively being dragged and while the node is simply selected (idle) after a radius was typed or committed. Below a small fixed floor the handle still sits at today's constant 12px inset so it stays visually distinct from the square resize handle at the exact corner. The handle's hit-test position (what the mouse must be over to grab it, and what T-040's cursor check reports) always matches its drawn position, because both read the same shared function. On a small or near-square shape, opposite handles approach but never cross past the shape's centre.

## Request Coverage

- "when the user clicks and drags the little dots on the corners to increase the corner radius, the dots should move inwards to the center of the shape" — covered: handle inset now tracks the corner's live radius value, clamped so it never overshoots the centre.

## Verified Starting State

### The fixed 12px inset today — confirmed, two separately-defined constants that currently agree by value only

The inset is **not** shared between the draw path and the hit-test path through a common constant — it is duplicated, matching this codebase's existing precedent of duplicating `CORNER_RADIUS_TYPES` verbatim across the same two files (`App/packages/vue/src/shared/input/radius.ts:12-19` and `App/packages/core/src/canvas/overlays/selection.ts:12-19` are byte-identical today).

| Path | Symbol | Current behaviour |
| --- | --- | --- |
| `App/packages/vue/src/shared/input/radius.ts:10` | `RADIUS_CONTROL_SCREEN_INSET = 12` | Named constant, used only by `getRadiusControlLocalPoint`. |
| `App/packages/vue/src/shared/input/radius.ts:52-60` | `getRadiusControlLocalPoint(corner, width, height, zoom = 1)` | `inset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)`, then `cornerPoint(corner, width, height, inset)`. Radius value is not a parameter today. |
| `App/packages/vue/src/shared/input/radius.ts:37-50` | `cornerPoint(corner, width, height, inset)` | `nw → {inset, inset}`, `ne → {width-inset, inset}`, `se → {width-inset, height-inset}`, `sw → {inset, height-inset}`, `default → {0,0}`. |
| `App/packages/vue/src/shared/input/radius.ts:62-70` | `getRadiusControlPosition(node, graph, corner, zoom = 1)` | Calls `getRadiusControlLocalPoint(corner, node.width, node.height, zoom)`, maps through `getWorldMatrix(node, graph)`. This is the **single shared position function** — both the overlay's hit-test consumer (`hitTestRadiusControlByMatrix`, below) and this packet's draw-position fix must keep agreeing through it. |
| `App/packages/vue/src/shared/input/radius.ts:72-88` | `hitTestRadiusControlByMatrix(cx, cy, node, graph, zoom)` | Loops the four corners, calls `getRadiusControlPosition` for each, compares squared distance to `hitRadius = HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)`. **This function needs no edit** — it inherits the new position automatically because it calls `getRadiusControlPosition`, which this packet changes (Fixed Decision 5). |
| `App/packages/core/src/constants.ts:406` | `HANDLE_HIT_RADIUS = 8` | Correction to a citation drift in `Plan/Packets/T-040-corner-radius-cursor.md`, which quoted this as `6` at line `403` — the live value today is `8` at line `406`. Unrelated to this packet's scope; cited here only for accuracy, not changed. |
| `App/packages/core/src/canvas/overlays/selection.ts:198-213` | `drawRadiusHandles(r, canvas, width, height)` | `const inset = 12 / Math.max(r.zoom, Number.EPSILON)` (inline magic number, not the named vue-side constant — separate file, separate literal), builds a fixed `points` array of the four `[inset-or-width-inset, inset-or-height-inset]` pairs, draws a white-filled, selection-stroked circle of `radius = 4 / Math.max(r.zoom, Number.EPSILON)` at each. Reads only `width`/`height` — never the node's `cornerRadius`/per-corner fields or `independentCorners`. |
| `App/packages/core/src/canvas/overlays/selection.ts:229-240` | `drawNodeSelection(r, canvas, node, rotation, graph)` | Calls `drawRadiusHandles(r, canvas, node.width, node.height)` at line 238, inside the same `withNodeBounds` local-coordinate callback that also calls `drawBoundsHandles`. `node` (the full `SceneNode`) is already in scope at this call site. |
| `App/packages/core/src/canvas/overlays/selection.ts:156-173` | `withNodeBounds(r, canvas, node, rotation, graph, draw)` | `canvas.save(); canvas.translate(r.panX, r.panY); canvas.scale(r.zoom, r.zoom); canvas.concat(worldMatrix); draw(0, 0, node.width, node.height); canvas.restore()`. **This confirms the units `drawRadiusHandles` operates in**: the canvas is already pre-scaled by `r.zoom` before `drawRadiusHandles` runs, so a coordinate offset of `12/r.zoom` document-local units always renders as exactly 12 *screen* pixels regardless of zoom — the same reasoning the vue-side `getRadiusControlLocalPoint` already applies for its own inset-in-local-units-compensated-by-zoom. Node-local radius fields (`cornerRadius`, `topLeftRadius`, etc.) are stored in this same document-local unit system as `width`/`height`, so they can be compared and combined with the inset directly, with no extra unit conversion. |

### Live tracking already happens automatically at render time — no new reactivity needed

`drawRadiusHandles` is a plain per-frame draw function with no internal caching; it is invoked fresh every time `render()` (`App/packages/core/src/canvas/renderer/pipeline.ts:156-200`) runs and paints the overlay layer. Two existing paths already trigger a repaint after a radius value changes, and both already mutate the *live* node before the repaint happens, so reading `node.cornerRadius`/per-corner fields directly inside `drawRadiusHandles` is sufficient for both cases without any new `Ref`, computed, or cache:

1. **During a drag (live preview).** `applyRadiusDrag` (`App/packages/vue/src/shared/input/radius.ts:202-217`) calls `editor.graph.updateNodePreview(...)` (mutates the live node) then `editor.requestRepaint()`, on every pointer move.
2. **Idle, after a typed/committed value.** `updateNodeWithUndo` (`App/packages/core/src/editor/nodes.ts:23-45`) calls `ctx.graph.updateNode(...)` (mutates the live node) then `ctx.requestRender()`, at the end of any committed edit, including a typed radius value from the property panel.

### Renderer already clamps the *rendered shape's* corner radius by a per-edge budget — supporting evidence for this packet's clamp

`App/packages/core/src/canvas/shapes.ts:35-135` computes each corner's actual paint radius from a `budget` derived from adjacent edge lengths shared between the two corners on that edge (`shapes.ts:78, 118-128`), so the rendered shape itself is already prevented from having a corner radius larger than its available edge budget. This packet's handle-position clamp (Fixed Decision 2) is a deliberately simpler, symmetric approximation of that same idea — see Fixed Decision 2 for why the simpler form is chosen instead of importing the edge-budget system into the input layer.

### Package boundary — confirmed, duplication is required, not optional

`App/packages/core/package.json:177-204` lists `@open-pencil/core`'s dependencies: `@open-pencil/kiwi`, `@open-pencil/pen`, `@open-pencil/scene-graph`, and others — **no dependency on `@open-pencil/vue`**. `packages/core/src/canvas/overlays/selection.ts` cannot import anything from `packages/vue/src/shared/input/radius.ts`. The small per-corner field mapping this packet needs in `selection.ts` must be a local duplicate, exactly like `CORNER_RADIUS_TYPES` already is.

## Read First

- `App/packages/vue/src/shared/input/radius.ts:1-120` — `getRadiusControlLocalPoint`, `cornerPoint`, `getRadiusControlPosition`, `radiusForCorner` (the corner→field mapping helper, already defined at lines 163-168, used unchanged by this packet).
- `App/packages/core/src/canvas/overlays/selection.ts:1-20, 156-240` — `CORNER_RADIUS_TYPES`, `withNodeBounds`, `drawRadiusHandles`, `drawNodeSelection`.
- `App/packages/core/src/constants.ts:395-409` — confirms `HANDLE_HIT_RADIUS = 8` at line 406 (unrelated, not edited).
- `App/tests/engine/editor/corner-radius-controls.test.ts:1-27, 151-180` — the pure-function test to extend and the one integration test whose numeric expectation changes.

## Corrections to the Brief

The stub's premise and file citations are accurate — the 12px fixed inset exists exactly as described, at both a vue-side named constant and a core-side inline literal. One drift found while verifying a related, previously-expanded sibling packet: `Plan/Packets/T-040-corner-radius-cursor.md` cites `HANDLE_HIT_RADIUS = 6` at `constants.ts:403`; the live value today is `HANDLE_HIT_RADIUS = 8` at `constants.ts:406`. This is unrelated to T-050a's scope (this packet does not touch the hit-test radius, only the hit-test *position*) and is noted here only so it is not mistaken for something this packet must reconcile.

## Fixed Decisions

1. **The inward offset is the corner's own effective radius value, clamped between the existing 12px screen floor and half the shape's shorter side.** Formula, identical in both files: `inset = clamp(effectiveRadius, minInset, maxInset)` where `minInset = 12 / max(zoom, EPSILON)` (unchanged from today, in document-local units, zoom-compensated the same way the code already does) and `maxInset = Math.min(width, height) / 2` (document-local units, not zoom-compensated — a document-space bound, not a screen-space one). `effectiveRadius` is `node.independentCorners ? node[<field for that corner>] : node.cornerRadius`, i.e. exactly `radiusForCorner`'s existing logic (`radius.ts:163-168`), reused unchanged on the vue side and duplicated on the core side per the package-boundary constraint above.
   Reason this is the right mapping and not some other curve: `calculateRadiusFromLocalPointer` (`radius.ts:99-117`, untouched by this packet — see Restrictions) already projects a pointer's diagonal movement onto the radius 1:1 — dragging the pointer a Euclidean distance `d` along the corner's inward 45° diagonal increases the radius by exactly `d` (verified: for the `nw` direction vector `{x:1,y:1}`, a diagonal move of `d` has `deltaX=deltaY=d/√2`, so `projectedDelta = (d/√2 + d/√2)/√2 = d`). Setting `inset = radius` (before the two clamps) means the drawn/hit-tested handle position moves by exactly the same distance the pointer needs to move to produce that radius change — the handle's screen movement and the radius's value change stay in a consistent 1:1 relationship throughout the drag, with no lag or overshoot relative to the pointer once above the floor.
2. **`maxInset = Math.min(width, height) / 2` — a flat, symmetric clamp, not the renderer's per-edge budget system.** This guarantees `inset` never exceeds half the shape's shorter side, so a corner's inset can never place its handle past the shape's centre, and `width - inset` for one corner can never fall below `inset` for the adjacent corner on the same edge, so opposite handles never cross past one another (they can coincide exactly at the centre on a square shape at extreme radius, which is "never cross," not "cross"). This is deliberately simpler than the true per-edge-length `budget` system in `shapes.ts:78-135` (which additionally accounts for two corners sharing one edge unevenly) because replicating that system would require importing renderer-only geometry into `packages/vue/src/shared/input/` and `packages/core/src/canvas/overlays/`, a boundary this packet does not need to cross for a handle-position clamp — `Math.min(width, height) / 2` is always a valid, conservative bound regardless of the other three corners' radii.
3. **Below the 12px floor, behaviour is pixel-identical to today.** Because `minInset` is unchanged and `Math.max(minInset, radius)` keeps the floor when `radius < minInset`, every existing test and every existing visible position for a node whose corner radius is 0 (the common case for a freshly drawn rectangle) is unaffected. This is why none of the existing `getRadiusControlPosition`-based integration tests in `corner-radius-controls.test.ts` need updated expected coordinates except the one identified in Implementation Step 4, whose corner already has a radius (`16`) above the floor before the drag starts.
4. **`getRadiusControlLocalPoint` gains a `radius: number` parameter inserted before `zoom`, not appended after it.** `getRadiusControlPosition` is the only other caller and already has the effective radius available via `radiusForCorner`, so it passes it straight through; no other call site outside the two functions themselves and the test file exists (confirmed by project-wide search — `getRadiusControlLocalPoint` and `getRadiusControlPosition` appear only in `radius.ts` and the two test files listed in Read First).
5. **`hitTestRadiusControlByMatrix`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, `cancelRadiusDrag`, and T-040's `getRadiusCursorForSelection`/`updateHoverCursor` (`select/hover.ts:60-79, 139-144`) all need zero code changes.** Every one of them reaches the handle position only through `getRadiusControlPosition` (directly, or indirectly through `hitTestRadiusControlByMatrix`), so once that function's inset tracks the radius, every consumer's behaviour updates automatically and consistently — including T-040's cursor, which this packet must not edit (see Restrictions) but whose grab/grabbing hit zone will now correctly sit at the moved-inward position.
6. **This composes with T-050 (integer corner-radius values) without any interaction.** T-050 rounds the *committed* radius value written to the node inside `applyRadiusDrag`, before this packet's code runs. Whether T-050 has landed or not, `drawRadiusHandles`/`getRadiusControlPosition` simply read whatever `node.cornerRadius`/per-corner field currently holds — a rounded integer once T-050 lands, an unrounded float before it does. Neither packet needs to know about the other's implementation.
7. **No new `Ref`, computed, cache, or CanvasKit object.** See the CanvasKit/WASM note below — `drawRadiusHandles` continues to reuse the renderer-owned `r.auxFill` and `r.selectionPaint` `Paint` objects exactly as it does today; nothing new is allocated.

## Open Decisions

None. Every question the stub raised is settled above by a Fixed Decision with source evidence: the exact current fixed-inset value and its two locations (Verified Starting State), the inward-offset formula and its clamp (Fixed Decisions 1-2), that zoom is applied identically to today (only the floor is zoom-compensated; the radius-driven part is a document-space quantity, matching how `calculateRadiusFromLocalPointer` already treats radius), that both live-drag and idle states are covered with no new reactive plumbing (Verified Starting State, "Live tracking already happens automatically"), and that T-040's hit-test needs no edit (Fixed Decision 5).

## Visual Contract — binding

This is a canvas (CanvasKit) draw, not a DOM/Tailwind surface — there are no classes, recipes, or `data-test-id`s involved. The binding contract is the exact geometry and paint reuse:

| Element | Binding value |
| --- | --- |
| Handle fill colour | `r.ck.WHITE` — unchanged, via `r.auxFill` (existing renderer-owned `Paint`, do not construct a new one). |
| Handle stroke colour | `r.selectionPaint` (already configured with the correct selection/component colour and `1/r.zoom` stroke width by the caller before `drawRadiusHandles` runs) — unchanged, do not construct a new `Paint`. |
| Handle dot radius | `4 / Math.max(r.zoom, Number.EPSILON)` — unchanged from today. |
| Handle inward offset (`inset`) | `Math.min(Math.max(minInset, effectiveRadius), maxInset)` where `minInset = 12 / Math.max(zoom, Number.EPSILON)` and `maxInset = Math.min(width, height) / 2` — the only thing this packet changes. |
| Coordinate space | Node-local, document units, exactly as `drawRadiusHandles` and `getRadiusControlLocalPoint` already operate — reuse `withNodeBounds`'s existing `canvas.scale(r.zoom, r.zoom)` + `canvas.concat(worldMatrix)` pipeline and `getWorldMatrix`/`Matrix.mapPoint` on the vue side. Do not hand-roll new pan/zoom/rotation math (matches T-004's own binding precedent). |

### Banned List

- No new CanvasKit `Paint`, `Shader`, `Path`, or any other WASM-backed object. Reuse `r.auxFill` and `r.selectionPaint` exactly as today.
- No new constant duplicating `RADIUS_CONTROL_SCREEN_INSET`'s value under a different name — reuse the vue-side named constant, and keep the core-side literal `12` (matching today's existing style in that file; do not silently rename or extract it into a shared cross-package constant, which would require crossing the package boundary documented above).
- No change to `HANDLE_HIT_RADIUS`, `HANDLE_HALF_SIZE`, or any other file in `constants.ts`.
- No change to `calculateRadiusFromLocalPointer`, `getRadiusChanges`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, or `cancelRadiusDrag`.
- No change to `hitTestRadiusControlByMatrix`'s hit-radius math (`HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)`) — only its *input* position moves, via `getRadiusControlPosition`, which it already calls.
- No change to `select/hover.ts` (T-040's file) or `useCanvasInput.ts`.
- No new npm dependency.
- No extension of `CORNER_RADIUS_TYPES` in either file — scope stays the existing six types.

## CanvasKit/WASM lifecycle note

This packet allocates no CanvasKit object. `drawRadiusHandles` draws two `canvas.drawCircle(...)` calls per corner using two `Paint` objects (`r.auxFill`, `r.selectionPaint`) that already exist on `SkiaRenderer` and are owned and disposed by the renderer's own lifecycle (`destroyRenderer`, unrelated to this packet) — the same two objects the function already uses today, called with different coordinates. No `.delete()`, cache, or invalidation path is added or changed by this packet.

## Allowed Changes

- `App/packages/vue/src/shared/input/radius.ts` — add a `radius` parameter to `getRadiusControlLocalPoint`; update `getRadiusControlPosition` to compute and pass the corner's effective radius.
- `App/packages/core/src/canvas/overlays/selection.ts` — add a local `RADIUS_FIELD_BY_CORNER` mapping and an `effectiveCornerRadius` helper (duplicated from the vue-side logic per the package-boundary constraint); change `drawRadiusHandles` to accept the full `node` and compute a per-corner inset; update its one call site in `drawNodeSelection`.
- `App/tests/engine/editor/corner-radius-controls.test.ts` — update the one call site whose signature changed, add new pure-function cases, update the one integration test whose expected numeric value changes.
- `App/tests/engine/render/canvas/selection-outline.test.ts` — add a new `describe` block with render-based regression coverage proving the drawn position tracks radius and clamps correctly.
- No other files.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT change `calculateRadiusFromLocalPointer`, `getRadiusChanges`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, or `cancelRadiusDrag`.** This packet only changes where the handle is *drawn and hit-tested*, never how the radius itself is computed or committed.
- **Do NOT change `hitTestRadiusControlByMatrix`'s hit-radius formula or `HANDLE_HIT_RADIUS`.** Only the position it tests against changes, automatically, via `getRadiusControlPosition`.
- **Do NOT change `App/packages/vue/src/shared/input/select/hover.ts` or `App/packages/vue/src/canvas/useCanvasInput.ts` (T-040's files).** T-040's cursor behaviour must keep working unedited (Fixed Decision 5).
- **Do NOT extend `CORNER_RADIUS_TYPES` in either file, and do not add star/polygon/triangle radius-handle support.** That is T-050b's scope, deferred — see "Deferred to a later packet" below.
- **Do NOT import `packages/vue` code from `packages/core`, or vice versa in the other direction beyond what already exists.** Duplicate the small per-corner mapping per the confirmed package boundary.
- **Do NOT replicate the renderer's per-edge `budget` clamp system from `shapes.ts` into the input or overlay layer.** Fixed Decision 2 settles this; the simpler `Math.min(width, height) / 2` clamp is deliberate and sufficient for a handle position.
- **Do NOT allocate a new CanvasKit `Paint`/`Shader`/other WASM object.** Reuse `r.auxFill` and `r.selectionPaint`.
- **Do NOT touch `App/packages/core/src/canvas/shapes.ts`, `App/packages/core/src/editor/nodes.ts`, or `App/packages/core/src/canvas/renderer/pipeline.ts`.** They are cited as evidence only; none of them need edits.

### Deferred to a later packet

- Extending on-canvas corner-radius handles to `STAR`, `POLYGON`, and `TRIANGLE` node types is T-050b's scope, which depends on this packet landing first (per `Plan/plan.md`). Not touched here.

## Implementation Steps

1. **Pre-flight.** Re-read `App/packages/vue/src/shared/input/radius.ts` and `App/packages/core/src/canvas/overlays/selection.ts` in full and confirm the line spans above still match; reconcile any drift before editing.

2. **`packages/vue/src/shared/input/radius.ts`.** Change `getRadiusControlLocalPoint` (currently lines 52-60) to:
   ```ts
   export function getRadiusControlLocalPoint(
     corner: CornerPosition,
     width: number,
     height: number,
     radius: number,
     zoom = 1
   ): Vector {
     const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)
     const maxInset = Math.min(width, height) / 2
     const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0
     const inset = Math.min(Math.max(minInset, safeRadius), maxInset)
     return cornerPoint(corner, width, height, inset)
   }
   ```
   Change `getRadiusControlPosition` (currently lines 62-70) to compute the effective radius via the existing `radiusForCorner` helper (defined lower in the same file at lines 163-168; function declarations are hoisted, so calling it here before its own declaration is valid) and pass it through:
   ```ts
   export function getRadiusControlPosition(
     node: SceneNode,
     graph: SceneGraph,
     corner: CornerPosition,
     zoom = 1
   ): Vector {
     const radius = radiusForCorner(corner, node)
     const local = getRadiusControlLocalPoint(corner, node.width, node.height, radius, zoom)
     return Matrix.mapPoint(getWorldMatrix(node, graph), local)
   }
   ```
   No other function in this file changes.

3. **`packages/core/src/canvas/overlays/selection.ts`.** After the existing `CORNER_RADIUS_TYPES` block (lines 12-19), add:
   ```ts
   const RADIUS_CONTROL_SCREEN_INSET = 12

   type RadiusCorner = 'nw' | 'ne' | 'se' | 'sw'

   const RADIUS_FIELD_BY_CORNER: Record<
     RadiusCorner,
     'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius'
   > = {
     nw: 'topLeftRadius',
     ne: 'topRightRadius',
     se: 'bottomRightRadius',
     sw: 'bottomLeftRadius'
   }

   function effectiveCornerRadius(node: SceneNode, corner: RadiusCorner): number {
     const raw = node.independentCorners ? node[RADIUS_FIELD_BY_CORNER[corner]] : node.cornerRadius
     return Number.isFinite(raw) ? Math.max(0, raw) : 0
   }

   function radiusHandleLocalPoint(
     corner: RadiusCorner,
     width: number,
     height: number,
     inset: number
   ): Vector {
     switch (corner) {
       case 'nw':
         return { x: inset, y: inset }
       case 'ne':
         return { x: width - inset, y: inset }
       case 'se':
         return { x: width - inset, y: height - inset }
       case 'sw':
         return { x: inset, y: height - inset }
       default:
         return { x: 0, y: 0 }
     }
   }
   ```
   Replace `drawRadiusHandles` (currently lines 198-213) with:
   ```ts
   function drawRadiusHandles(r: SkiaRenderer, canvas: Canvas, node: SceneNode): void {
     const { width, height } = node
     const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(r.zoom, Number.EPSILON)
     const maxInset = Math.min(width, height) / 2
     const dotRadius = 4 / Math.max(r.zoom, Number.EPSILON)
     const corners: RadiusCorner[] = ['nw', 'ne', 'se', 'sw']

     for (const corner of corners) {
       const inset = Math.min(Math.max(minInset, effectiveCornerRadius(node, corner)), maxInset)
       const { x, y } = radiusHandleLocalPoint(corner, width, height, inset)
       r.auxFill.setColor(r.ck.WHITE)
       canvas.drawCircle(x, y, dotRadius, r.auxFill)
       canvas.drawCircle(x, y, dotRadius, r.selectionPaint)
     }
   }
   ```
   Update the one call site in `drawNodeSelection` (currently line 238) from `drawRadiusHandles(r, canvas, node.width, node.height)` to `drawRadiusHandles(r, canvas, node)` — `node` is already in scope in `drawNodeSelection`'s callback.

4. **Update the existing pure-function test.** In `App/tests/engine/editor/corner-radius-controls.test.ts`, the `test.each` at lines 20-27 (`'places the %s control inward from its corner'`) calls `getRadiusControlLocalPoint(corner, 200, 100, 1)` with no radius argument. Update the call to pass `0` as the new radius argument before the zoom argument: `getRadiusControlLocalPoint(corner, 200, 100, 0, 1)`. The expected `{x, y}` values are unchanged (radius `0` is below the 12px floor, so behaviour is identical to today per Fixed Decision 3).

   Immediately after that test, add:
   ```ts
   test.each([
     ['nw', { x: 40, y: 40 }],
     ['ne', { x: 160, y: 40 }],
     ['se', { x: 160, y: 60 }],
     ['sw', { x: 40, y: 60 }]
   ] as const)('moves the %s control inward as radius grows past the fixed floor', (corner, expected) => {
     expect(getRadiusControlLocalPoint(corner, 200, 100, 40, 1)).toEqual(expected)
   })

   test('keeps the 12px floor when radius is below it', () => {
     expect(getRadiusControlLocalPoint('nw', 200, 100, 5, 1)).toEqual({ x: 12, y: 12 })
   })

   test.each([
     ['nw', { x: 50, y: 50 }],
     ['se', { x: 150, y: 50 }]
   ] as const)('clamps the %s control inset to half the shorter side so opposite handles never cross', (corner, expected) => {
     expect(getRadiusControlLocalPoint(corner, 200, 100, 999, 1)).toEqual(expected)
   })

   test('the 12px floor scales with zoom but the radius-driven inset does not', () => {
     expect(getRadiusControlLocalPoint('nw', 200, 100, 0, 2)).toEqual({ x: 6, y: 6 })
     expect(getRadiusControlLocalPoint('nw', 200, 100, 40, 2)).toEqual({ x: 40, y: 40 })
   })
   ```

5. **Update the one integration test whose expected value changes.** In the same file, `'independent mode commits only the selected corner'` (around lines 151-180) drags from the `'se'` corner of a node with `bottomRightRadius: 16` — a value above the 12px floor, so the drag's *starting* hit-test position moves from the old fixed `(184, 84)`-independent inset-12 point to the new inset-16 point `(184, 84)` → recompute: with `inset = max(12, 16) = 16`, the start point is `{x: 200-16, y: 100-16} = {184, 84}` in local/world coordinates (node is at default `x:0, y:0`, so world = local). The drag's end point is unchanged (`Matrix.mapPoint(getWorldMatrix(node, editor.graph), { x: 170, y: 70 })`, not derived from `getRadiusControlPosition`). Recomputing `calculateRadiusFromLocalPointer('se', 184, 84, 170, 70, 16)`: `deltaX = -14`, `deltaY = -14`, direction for `se` is `{x:-1, y:-1}`, `projectedDelta = (14 + 14) / Math.SQRT2 ≈ 19.799`, so the final radius is `16 + 19.799 ≈ 35.80`. Replace `expect(editor.graph.getNode(node.id)?.bottomRightRadius).toBeCloseTo(41.46, 1)` with `expect(editor.graph.getNode(node.id)?.bottomRightRadius).toBeCloseTo(35.8, 1)`. No other assertion in this test file changes — every other test either uses a corner whose effective radius is at or below the 12px floor (unaffected, per Fixed Decision 3) or does not call `getRadiusControlPosition`/`getRadiusControlLocalPoint` at all.

6. **Add render-based regression coverage.** In `App/tests/engine/render/canvas/selection-outline.test.ts`, add a new `describe` block after the existing one, reusing the file's existing module-scope `ck`, `getPixel`, and `isSelectionColored` (all already defined at the top of the file, lines 1-33):
   ```ts
   describe('T-050a: Radius handle inward tracking', () => {
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

     function renderRect(radius: number) {
       const graph = new SceneGraph()
       const page = graph.getPages()[0]
       const rect = graph.createNode('RECTANGLE', page.id, {
         x: 50,
         y: 50,
         width: 100,
         height: 100,
         cornerRadius: radius,
         fills: [],
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
       renderer.render(graph, new Set([rect.id]), {}, 1)

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

     test('handle sits at the fixed 12px floor when cornerRadius is 0', () => {
       const { pixels, width, bg } = renderRect(0)
       expect(sampleRingHit(pixels, width, 62, 62, 4, bg)).toBe(true)
       expect(sampleRingHit(pixels, width, 90, 90, 4, bg)).toBe(false)
     })

     test('handle moves inward to track cornerRadius as it grows', () => {
       const { pixels, width, bg } = renderRect(40)
       expect(sampleRingHit(pixels, width, 90, 90, 4, bg)).toBe(true)
       expect(sampleRingHit(pixels, width, 62, 62, 4, bg)).toBe(false)
     })

     test('handle clamps at the shape centre instead of overshooting past it', () => {
       const { pixels, width, bg } = renderRect(200)
       expect(sampleRingHit(pixels, width, 100, 100, 4, bg)).toBe(true)
     })
   })
   ```
   These follow the same `SkiaRenderer`/`readPixels`/`isSelectionColored` pattern already established in this file (lines 36-88), sampling four cardinal points at the dot's own drawn radius (`4` at `zoom = 1`) around each expected centre to tolerate anti-aliasing at the exact boundary pixel, rather than asserting a single exact pixel.

7. Run the commands under Verification in order.

## Acceptance Criteria

- [ ] `getRadiusControlLocalPoint` and `getRadiusControlPosition` compute the handle inset as `clamp(effectiveCornerRadius, 12/zoom, min(width,height)/2)`, matching `drawRadiusHandles`'s identical formula.
- [ ] A corner radius at or below the 12px-at-zoom-1 floor renders and hit-tests the handle at exactly today's position (no regression for the common freshly-drawn-rectangle case).
- [ ] A corner radius above the floor moves the drawn dot and the hit-test position inward together, by the same amount, tracking the radius 1:1 while it stays under the clamp.
- [ ] On a shape where the radius would exceed half the shorter side, the handle's inset clamps at `min(width,height)/2` and never overshoots past the centre or past the opposite corner's handle.
- [ ] Both the live-drag preview and the idle (post-commit/typed) state show the tracked position, with no new `Ref`, computed, or cache introduced.
- [ ] `hitTestRadiusControlByMatrix` and T-040's `getRadiusCursorForSelection`/`updateHoverCursor` are unedited and their existing tests (`App/tests/engine/vue/input/radius-cursor.test.ts`) still pass unmodified.
- [ ] `calculateRadiusFromLocalPointer`, `getRadiusChanges`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, `cancelRadiusDrag` are unedited.
- [ ] No new CanvasKit object is allocated; `drawRadiusHandles` still uses only `r.auxFill` and `r.selectionPaint`.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] Scope stays exactly the existing six `CORNER_RADIUS_TYPES`; no star/polygon/triangle handling is added.

## Verification

### Development loop — repeat as needed

- `bun test tests/engine/editor/corner-radius-controls.test.ts` from `App/` — pure-function and integration coverage, fast, no CanvasKit init. Expect exit code `0`.

### Final pre-completion gates — run once

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` from `App/`.
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` from `App/` (named explicitly because `radius.ts` lives under `packages/vue/src`, per the brief's rule that the root project must not be assumed to cover package code).
- Focused Oxlint: `oxlint -c oxlint.json --type-aware --type-check packages/core/src/canvas/overlays/selection.ts packages/vue/src/shared/input/radius.ts tests/engine/editor/corner-radius-controls.test.ts tests/engine/render/canvas/selection-outline.test.ts` from `App/`.
- `bun test tests/engine/render/canvas/selection-outline.test.ts` from `App/` — the new render-based regression coverage; expect exit code `0`, all existing T-062 tests in the same file still passing unchanged.
- `bun test tests/engine/vue/input/radius-cursor.test.ts` from `App/` — proves T-040's cursor behaviour is unaffected; expect exit code `0`, unchanged from before this packet.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command, per the delivery policy.

## Integration or Installed-Result Check

Mandatory browser check on the dev server: `cd App && bun run dev`.

1. Draw a rectangle roughly 300×200. Select it. Confirm the four white dots sit a small, fixed distance in from each corner (today's look, cornerRadius is 0 on a fresh shape).
2. Drag the top-left dot inward slowly. Confirm the dot visibly continues moving toward the shape's centre as the radius grows — it must not stay fixed at the original 12px-ish spot while only the rounded corner changes.
3. Release, then drag the same dot back out toward the corner. Confirm the dot moves back out as the radius shrinks, and settles at the same small fixed inset once the radius reaches 0.
4. With that same rectangle, type a large radius value directly into the Appearance panel's corner-radius field (not by dragging). Confirm the dot moves inward to match, without needing to click the canvas or start a drag first (proves the idle/committed-value path, not just the live-drag path).
5. Draw a small, roughly square rectangle (e.g. 60×60) and drag one corner's radius toward its maximum. Confirm the dot approaches the centre and stops there — it must not fly past the centre or swap sides with the opposite corner's dot.
6. Hover (without dragging) over a moved-inward dot. Confirm the cursor still shows `grab`, and confirm dragging it still shows `grabbing` (T-040 regression check — this proves the hit-test moved together with the drawn position).
7. Confirm the resize and rotation handles at the actual corners/edges still work normally and are not obscured or made unreachable by a radius handle that has moved inward.
8. Confirm no browser console errors appear during any of the above.

## Stop Conditions

- Stop and report if `getRadiusControlLocalPoint`/`getRadiusControlPosition` have any other call site beyond `radius.ts` itself and the two named test files — that would mean this packet's signature change has a wider blast radius than verified here.
- Stop and report if the recomputed `35.8` value in Implementation Step 5 does not match the actual test output after the code change — recompute from the actual observed number rather than trusting the hand-derivation, and correct the packet's own citation before reporting.
- Stop if the render-based pixel tests in Implementation Step 6 cannot reliably distinguish the two candidate positions (e.g. anti-aliasing makes `sampleRingHit` return `true` at both the old and new position at the chosen radius values) — report the exact pixel values observed rather than loosening the assertion silently.
- Stop and report if `packages/core`'s dependency list has changed since this packet was expanded (i.e. a dependency on `@open-pencil/vue` now exists) — that would remove the reason for duplicating the corner-field mapping and the packet's Fixed Decision 4/Allowed Changes would need revisiting.

## Execution Report Contract

Report: exact files changed with line spans; the `bun test` pass counts for both `corner-radius-controls.test.ts` and `selection-outline.test.ts`; exit codes for `tsgo`, both `vue-tsc` invocations, and Oxlint; confirmation `radius-cursor.test.ts` still passes unmodified; the actual observed value substituted for the `35.8` estimate in Step 5 if it differs from the hand-derivation; the eight browser-check observations from the Integration section; any deviation from this packet and why.

## Status record

Status: **Done**
Executed 2026-08-21. Applied live inward tracking with clamping `clamp(effectiveRadius, 12/zoom, min(width, height)/2)` to both `App/packages/vue/src/shared/input/radius.ts` and `App/packages/core/src/canvas/overlays/selection.ts`. All test suites passed (`corner-radius-controls.test.ts` 26 passed, `selection-outline.test.ts` 7 passed, `radius-cursor.test.ts` 5 passed). Gates `tsgo`, `vue-tsc` (root and packages/vue), and `oxlint` all passed with exit code 0.
