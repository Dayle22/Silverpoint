# T-050b4 - VECTOR per-vertex radius drag handles

Task ID: T-050b4
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-050b3 (must be Done in live source before execution)
Related: T-050b, T-024, T-050a
Prepared from: the user's request for visual radius dots on paths and shapes created with the Pen tool
Expanded at: 2026-08-22 07:33 Africa/Johannesburg
Expanded against: live node-edit overlay, hit-test, drag-state and pointer lifecycle seams; T-050b3's fixed helper contract
Delivery: source gates plus browser dev-server check only; no build/install/version bump
Execution size: 7 tightly-coupled interaction source files; 1 focused test file; not split further because one pointer gesture must land atomically across draw, hit, drag dispatch and commit seams

## Intended Outcome

When a user enters node edit mode on a VECTOR and selects an eligible straight corner, a small radius dot appears inside that corner. Dragging the dot changes only that vertex's landed `cornerRadius`, previews the rounded geometry live, clamps safely, and creates one undo entry on release. Endpoints, branch points, dangling points, collinear points and points adjacent to curved segments show no radius dot.

## Request Coverage

- Visual dots on Pen-created paths/shapes: covered in VECTOR node edit mode.
- Per-vertex independence: each handle owns one `VectorVertex.cornerRadius`.
- Open paths: eligible internal straight corners get handles; endpoints do not.
- Curved Pen nodes: existing Bezier tangent diamonds remain; radius handles do not appear at curve-adjacent vertices.

## Verified Starting State

- `drawNodeEditOverlay` receives live absolute-space vertices/segments/regions, draws the live shape, technical stroke, tangent handles and vertex circles, and maps live coordinates with `x * zoom + panX` / `y * zoom + panY`.
- Node-edit paints are cached per `SkiaRenderer`. Existing `r.penVertexFill` plus cached `vertexStroke1px` can draw a white/blue circle without a new `Paint`.
- `hitTestEditHandle` and `hitTestEditVertex` use live coordinates and inverse-zoom thresholds. `HANDLE_HIT_THRESHOLD_NE = 9` is the tangent-handle precedent.
- `handleNodeEditDown` currently tests tangent handles before vertex dots. Radius hit-testing must precede both because its dot is a distinct control.
- `handleNodeEditMove` handles `DragEditNode | DragEditHandle`; `useCanvasInput.ts` only dispatches those two discriminants to it.
- `handleNodeEditMouseUp` owns node-edit drag completion and can push one `editor.undo` entry guarded by node ID.
- `DragState` already contains rectangle `DragRadius`; the VECTOR interaction needs a distinct name/discriminant and must not widen rectangle `CornerPosition`.
- T-050b3 will export `getVectorCornerGeometry(network, vertexIndex)` returning clamped logical radius, maximum, half-angle sine and unit bisector for eligible corners.

## Read First

- Confirm T-050b3 is present in live `App/`: `VectorVertex.cornerRadius` is decoded/rendered; `getVectorCornerGeometry` is exported; focused T-050b3 tests pass.
- `App/packages/core/src/canvas/node-edit-overlay.ts`
- `App/packages/vue/src/shared/input/node-edit/hit-test.ts`
- `App/packages/vue/src/shared/input/node-edit/index.ts`
- `App/packages/vue/src/shared/input/types.ts`
- `App/packages/vue/src/canvas/node-edit-input/use.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts:560-612`
- `App/tests/engine/vector/node-edit.test.ts`

## Fixed Decisions

1. **Node edit mode only.** VECTOR radius handles are not selection-overlay handles and do not touch `CORNER_RADIUS_TYPES`, `CornerPosition`, rectangle `DragRadius` or `packages/vue/src/shared/input/radius.ts`.
2. **Selected eligible vertices only.** A dot appears for every selected vertex for which T-050b3's helper returns non-null. Multi-selected eligible vertices each show their own dot, but dragging one changes only the grabbed vertex.
3. **Handle centre is the arc centre.** For logical radius `r`, place it from the vertex along the helper's unit bisector by `r / sin(theta/2)`. For discoverability at small/zero radius, use display radius `clamp(max(r, 12 / zoom), 0, maxRadius)` before converting to centre distance. This reduces to inset `(r,r)` at a 90-degree corner, matching T-050a.
4. **The display floor never changes the stored value.** A zero-radius dot may be displayed at the 12px-equivalent floor; pointer-down alone remains radius `0`.
5. **Drag by delta, not absolute position.** Store pointer start, original radius, bisector, `sinHalfAngle` and `maxRadius`. On move: `next = clamp(originalRadius + dot(deltaPointer, bisector) * sinHalfAngle, 0, maxRadius)`. This prevents a zero-radius value jumping to the display floor on pointer-down.
6. **One undo entry on release.** Preview mutates the live node-edit vertex only and repaints. Mouse-up compares original/final values; if changed, push exactly one `editor.undo` entry whose forward/inverse closures reacquire node edit state, verify `nodeId`, assign a copied vertex with final/original radius, and repaint. No entry for a click without value change.
7. **Hit-test precedence is radius -> tangent handle -> vertex.** The nearest eligible selected radius dot within `HANDLE_HIT_THRESHOLD_NE / zoom` wins. Unselected/ineligible vertices cannot be hit through an invisible control.
8. **Visual style reuses node-edit resources.** Draw a `PEN_HANDLE_RADIUS` circle with `r.penVertexFill` and cached `vertexStroke1px`; no new paint cache field or CanvasKit object.
9. **No numeric Properties-panel field in this packet.** The user asked for visual dots; `VectorPointSection.vue` remains unchanged to keep this interaction packet bounded.

## Open Decisions

None.

## Visual Contract — binding

| Element | Contract |
| --- | --- |
| Radius dot | White-filled, blue 1px outline circle; radius `PEN_HANDLE_RADIUS`; same visual family as node-edit points but smaller than the vertex circle. |
| Position | Arc centre along the corner bisector; tracks logical radius after the 12px-at-current-zoom discoverability floor. |
| Visibility | Only selected, eligible vertices in VECTOR node edit mode. |
| Layering | Draw after tangent handle lines/diamonds and before vertex circles, so actual vertices remain visually dominant. |
| Interaction | Dot is hit-testable at the drawn position; dragging inward increases radius, dragging back towards the vertex decreases it. |
| Live preview | Rounded corner and dot move together on every pointer move. |

### Banned List

- No literal colour; reuse the existing node-edit fill/stroke paints.
- No new CanvasKit `Paint`, `Shader`, `Path` or cache field.
- No new DOM, Tailwind class, component, panel field or i18n string.
- No extension of rectangle-family radius types or controls.
- No duplicate corner or handle-position formula between core and Vue.

## CanvasKit/WASM Lifecycle

No new CanvasKit object may be allocated. Reuse `r.penVertexFill` and cached `vertexStroke1px`; call `canvas.drawCircle` only. T-050b3's live renderer owns path allocation/disposal unchanged.

## Allowed Changes

- `App/packages/core/src/vector/corner-radius.ts` - add/export the one shared pure display-position helper so core overlay and Vue hit-test cannot drift.
- `App/packages/core/src/canvas/node-edit-overlay.ts` - radius-dot drawing.
- `App/packages/vue/src/shared/input/node-edit/hit-test.ts` - compatible node-edit state shape and `hitTestEditRadius`.
- `App/packages/vue/src/shared/input/node-edit/index.ts` - radius-first pointer-down and radius move branch.
- `App/packages/vue/src/shared/input/types.ts` - `DragEditRadius` and `DragState` member.
- `App/packages/vue/src/canvas/node-edit-input/use.ts` - mouse-up commit/undo for `edit-radius`.
- `App/packages/vue/src/canvas/useCanvasInput.ts` - include `edit-radius` in existing node-edit move dispatch.
- `App/tests/engine/vector/node-edit.test.ts` - position, hit-test, drag, clamp and undo coverage.
- No other files.

## Restrictions and Exclusions

- Do not execute unless T-050b3 has landed and its focused tests pass.
- Do not duplicate corner eligibility, clamp, angle or display-position maths; import T-050b3's helper.
- Do not touch `App/packages/vue/src/shared/input/radius.ts`, rectangle `DragRadius`, `CornerPosition`, `CORNER_RADIUS_TYPES` or selection-overlay radius handles.
- Do not edit renderer path construction, `.fig` codec, scene-graph types, Pen creation, vector lifecycle, Properties panels, SVG/PDF export or cursor modules.
- Do not show handles for ineligible or unselected vertices.
- Do not change tangent handle/vertex selection semantics or modifier meanings.
- Do not push undo entries during pointer move or more than once per completed drag.
- Do not allocate a Paint, Shader, Path or other WASM object.
- Do not add dependencies or run umbrella/build/install commands.

### Deferred

- Numeric per-vertex radius field and mixed-value editing in `VectorPointSection.vue`.
- Special hover/grab cursor for VECTOR radius dots; the handle remains functional with current node-edit cursor.
- Radius support at vertices adjacent to cubic segments.
- SVG/PDF parity.

## Implementation Steps

1. **Dependency gate.** Verify T-050b3 in live source, not merely its packet: exported helper exists, `vectorNetworkToPath` emits arcs, style overrides preserve radius, and focused T-050b3 tests pass. Stop if not.

2. **Add the shared display-position helper.** In landed `packages/core/src/vector/corner-radius.ts`, export:
   ```ts
   export function vectorRadiusHandlePoint(
     geometry: VectorCornerGeometry,
     vertex: VectorVertex,
     zoom: number
   ): Vector | null
   ```
   `displayRadius = Math.min(geometry.maxRadius, Math.max(geometry.radius, 12 / Math.max(zoom, Number.EPSILON)))`; `distance = displayRadius / geometry.sinHalfAngle`; return `vertex + geometry.bisector * distance`. Return `null` when max/sine/distance is non-finite or non-positive. Overlay and hit-test must call this exact function.

3. **Draw radius dots.** In `drawNodeEditOverlay`, form the live network once from `vertices/segments/regions`. After `drawEditHandles` and before `drawEditVertices`, call a new `drawEditRadiusHandles`. Iterate `selectedVertexIndices`, get geometry and display point, map through existing `toScreen`, then draw two circles at `PEN_HANDLE_RADIUS` using `r.penVertexFill` and cached `vertexStroke1px`.

4. **Add hit-testing.** Extend the narrow `NodeEditState` type in `hit-test.ts` with optional `regions`; treat absence as `[]` for older tests. Export:
   ```ts
   export function hitTestEditRadius(
     editor: Editor,
     cx: number,
     cy: number
   ): { vertexIndex: number; geometry: VectorCornerGeometry } | null
   ```
   Iterate selected indices only, compute identical display point at current zoom, compare local-coordinate distance to `HANDLE_HIT_THRESHOLD_NE / zoom`, and return the closest hit rather than first set order.

5. **Add drag state.** In `types.ts` add:
   ```ts
   export interface DragEditRadius {
     type: 'edit-radius'
     nodeId: string
     vertexIndex: number
     startX: number
     startY: number
     originalRadius: number
     bisector: Vector
     sinHalfAngle: number
     maxRadius: number
   }
   ```
   Add it to `DragState`. Do not rename rectangle `DragRadius`.

6. **Start and move.** In `handleNodeEditDown`, call `hitTestEditRadius` before `hitTestEditHandle`. On hit, construct `DragEditRadius` from current vertex/helper and return without changing selection. Widen `handleNodeEditMove` to accept `DragEditRadius`; for its branch, reacquire state and same node/vertex, project pointer delta per Fixed Decision 5, replace the vertex object with a copy containing `cornerRadius: next`, repaint, and return. Existing edit-node/edit-handle logic remains otherwise unchanged.

7. **Dispatch move.** In `useCanvasInput.ts`, extend only the current edit-node/edit-handle condition to include `d.type === 'edit-radius'`; call the same `handleNodeEditMove`.

8. **Commit one undo entry.** In `handleNodeEditMouseUp`, handle `edit-radius` before generic fallthrough. Read final radius from matching live node edit state. If finite and materially different from original (epsilon `1e-6`), push one `Adjust vector corner radius` undo record. Forward/inverse reacquire state, require captured `nodeId`, bounds-check `vertexIndex`, replace that vertex object, and repaint. Clear `drag.value` and return `true` whether changed or not.

9. **Tests.** Extend `node-edit.test.ts` with closed right-angle and open three-point fixtures. Prove:
   - selected eligible handle hits at the drawn point at zoom 1 and 2;
   - zero logical radius uses display floor but does not change on pointer-down/up;
   - dragging along bisector changes only grabbed vertex and clamps to `[0,maxRadius]`;
   - moving opposite reduces to `0`;
   - endpoint, branch, curved-adjacent and unselected vertices return no hit;
   - radius hit wins before a nearby vertex/tangent hit;
   - mouse-up pushes exactly one undo entry only after a changed drag; undo/redo restore exact values;
   - existing vertex/tangent tests remain unchanged and pass.
   Keep render-position proof in the shared pure helper tests in this file; the mandatory browser check supplies the visual proof without a brittle pixel test.

10. Run Verification in order.

## Acceptance Criteria

- [ ] Every selected eligible VECTOR corner shows one dot at the same computed point hit-testing uses.
- [ ] Stored radius and displayed handle track together above discoverability floor.
- [ ] Pointer-down at radius `0` does not jump value to `12`.
- [ ] Dragging changes only grabbed vertex and stays within renderer clamp.
- [ ] Open endpoints, branches, dangling/collinear points and cubic-adjacent points expose no handle.
- [ ] Tangent diamonds and vertex dragging/selection retain current behaviour.
- [ ] One changed drag creates exactly one undo entry; a click creates none; undo/redo are exact.
- [ ] No new CanvasKit object is allocated.
- [ ] No rectangle-family, codec, renderer-path or panel file outside Allowed Changes is modified.

## Verification

### Development loop — repeat as needed

From `App/`:

- `bun test tests/engine/vector/node-edit.test.ts`

### Final pre-completion gates — run once

From `App/`:

- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/vector/corner-radius.ts packages/core/src/canvas/node-edit-overlay.ts packages/vue/src/shared/input/node-edit/hit-test.ts packages/vue/src/shared/input/node-edit/index.ts packages/vue/src/shared/input/types.ts packages/vue/src/canvas/node-edit-input/use.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/vector/node-edit.test.ts`
- Re-run focused test file(s) once after the gates.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, build, install or version commands.

## Integration or Installed-Result Check

Mandatory browser check: `cd App && bun run dev`.

1. Draw a closed triangle with the Pen tool, enter node edit mode and select one vertex. Confirm one smaller white/blue radius dot appears inside that corner.
2. Drag the dot inward. Confirm only that corner rounds and the dot follows the arc centre live.
3. Release, undo and redo. Confirm exact sharp/rounded restoration with one history step each.
4. Select two eligible corners. Confirm two dots appear; drag one and confirm the other value does not change.
5. Create an open three-segment path. Confirm internal straight corners may show dots while endpoints never do.
6. Create a curved segment by dragging a Pen tangent. Confirm either vertex touching that curve has no radius dot, while tangent diamonds still work.
7. Zoom in and out. Confirm zero/small-radius handle remains discoverable and hit-testing follows drawn position.
8. Confirm ordinary vertex move, tangent-handle drag, segment insertion and endpoint linking still work.
9. Confirm no browser console error appears.

## Stop Conditions

- Stop before editing if T-050b3 is not live and passing.
- Stop if overlay and hit-test cannot share one position function without a forbidden package dependency; relocate pure helper to `packages/core/src/vector` rather than duplicating it.
- Stop if a zero-radius click changes value.
- Stop if one drag produces multiple undo entries or undo acts on a different node edit session.
- Stop if radius hit-testing steals clicks from invisible/unselected controls.
- Stop if reliable visual proof requires changing renderer geometry; hand packet back rather than crossing into T-050b3.

## Execution Report Contract

Report exact files/symbols changed; focused test pass counts; tsgo, both vue-tsc and Oxlint exit codes; undo entries observed per changed/no-op drag; all nine browser observations; confirmation no new CanvasKit object was allocated; and any deviation from this packet.

## Status record

Status: **Ready**

2026-08-22 - Expanded against live node-edit overlay/input seams and T-050b3's fixed geometry helper. Locked selected-only visibility, arc-centre placement, zero-radius display floor without value jump, delta drag maths, radius-first hit precedence and one-entry undo. No `App/` source changed.
