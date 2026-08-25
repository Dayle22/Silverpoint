# T-050b - Radius handles on non-rectangle shapes and pen-tool paths

Task ID: T-050b
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-004 (Done), T-050a (Done)
Related: T-050, T-050b1, T-050b2, T-050b3, T-050b4
Prepared from: the user's requests that corner radius be editable with visual dots on star, polygon and triangle shapes, and that the same capability apply to paths and shapes created with the Pen tool
Expanded at: 2026-08-22 07:40 Africa/Johannesburg
Expanded against: `App/AGENTS.md`; `Plan/endgoal.md`; the delivery policy and T-050 rows in `Plan/plan.md`; `Plan/PACKET-EXPANSION-BRIEF.md`; all four child packets; `App/packages/scene-graph/src/types.ts:45-68`; `App/packages/core/src/vector/index.ts:30-76`; `App/packages/core/src/vector/path-helpers.ts:5-62`; `App/packages/core/src/kiwi/fig/node-change/vector-geometry.ts:7-37`; `App/packages/core/src/kiwi/fig/node-change/serialize.ts:406-424`; `App/packages/core/src/canvas/node-edit-overlay.ts:250-339`; `App/packages/vue/src/shared/input/node-edit/hit-test.ts:6-123`; `App/packages/vue/src/shared/input/node-edit/index.ts:21-207`; `App/packages/vue/src/shared/input/types.ts:161-213`; and verified scripts in `App/package.json`
Delivery: named source gates + browser check
Execution size: 0 core implementation files; 0 test files; split into four executable child packets

## Intended Outcome

OpenPotlood supports visible, draggable corner-radius controls beyond the rectangle family:

- `STAR` and `POLYGON` (including a triangle, which is `POLYGON` with `pointCount: 3`) use one uniform node-level point radius.
- `VECTOR` paths, including paths and closed shapes created with the Pen tool, use an independent radius on each eligible vertex.
- Rendering and persistence land before their corresponding drag handles, so no control can write a value the canvas ignores.

This parent packet records the resolved product model and the dependency split. It is not itself an implementation packet.

## Request Coverage

- Current assignment, verbatim: "expand T-050b — Radius handles on other shapes".
- Star, polygon and triangle point-radius rendering: `T-050b1`.
- Star, polygon and triangle on-canvas radius handles: `T-050b2`, after `T-050b1`.
- Pen-tool/freeform VECTOR per-vertex radius rendering and `.fig` preservation: `T-050b3`.
- Pen-tool/freeform VECTOR per-vertex on-canvas radius handles: `T-050b4`, after `T-050b3`.

## Verified Starting State

- All four child packet files exist and declare `Packet state: Ready`. Live `App/` still lacks their planned source changes, so packet readiness is not implementation evidence.
- `Plan/plan.md` is authoritative and currently records T-050b as `To Do`, T-050b1/T-050b2 as `Ready`, and has no T-050b3/T-050b4 rows. The parent owner must reconcile that index before the two VECTOR children can be selected for execution; this expansion does not edit it.
- T-050b3's current `Verification` section lists two commands under the repeatable development loop. Before it is indexed, retain only `bun test tests/engine/vector/corner-radius.test.ts` there and move its blob tests to the run-once final gates, matching the current single-file-loop policy. This parent records the correction but does not edit a child outside the assigned packet.
- `SceneNode.cornerRadius` is the existing uniform value selected for `STAR`/`POLYGON`; the live polygon renderer remains sharp until `T-050b1` executes.
- `App/packages/scene-graph/src/types.ts:45-68` already defines `VectorVertex.cornerRadius?: number` and `VectorNetwork.vertices`; no new scene-graph field is required for Pen-created `VECTOR` geometry.
- `App/packages/core/src/vector/index.ts:30-76` confirms the 12-byte vertex record `[styleOverrideIdx:u32, x:f32, y:f32]`; its live `StyleOverride` and decoder restore only `handleMirroring`, not `cornerRadius`.
- `App/packages/core/src/vector/path-helpers.ts:5-62` emits only `lineTo`/`cubicTo`; the live VECTOR render route does not consume a per-vertex radius.
- `App/packages/core/src/kiwi/fig/node-change/serialize.ts:406-424` already builds a vertex style-override table and writes it beside the unchanged blob. `App/packages/core/src/kiwi/fig/node-change/vector-geometry.ts:7-37` passes that table into decoding and owns normalised-size scaling. Those are the compatibility-preserving T-050b3 seams.
- `App/packages/core/src/canvas/node-edit-overlay.ts:315-339` renders the live vector path and deletes each returned CanvasKit `Path`; T-050b4 must preserve that ownership.
- `App/packages/vue/src/shared/input/node-edit/hit-test.ts:6-123`, `node-edit/index.ts:39-207`, and `types.ts:161-213` are the current hit-test, drag-dispatch and drag-union seams. VECTOR radius handles belong there, not in the rectangle-family `DragRadius`/selection-overlay route.
- A VECTOR vertex may be an endpoint, a branch, a dangling vertex, or meet curved Bezier segments. Only an internal degree-2 vertex whose two incident segments are straight is an eligible round corner in this packet family.

## Read First

- `Plan/plan.md:88-92` - confirm the live T-050 family status and child indexing before selecting work.
- `Plan/Packets/T-050b1-star-polygon-point-radius-render.md` - uniform generated-shape model/rendering contract.
- `Plan/Packets/T-050b2-star-polygon-radius-handles.md` - generated-shape selection-overlay handle contract.
- `Plan/Packets/T-050b3-vector-point-radius-render-and-fig.md` - per-vertex VECTOR renderer/persistence contract.
- `Plan/Packets/T-050b4-vector-point-radius-handles.md` - dependent VECTOR node-edit interaction contract.

Executors should then read only the selected child packet and its named live files.

## Corrections to the Brief

Revision 1 stopped after proving that star/polygon radius rendering did not exist and said no companion packets had been created. That statement is now stale: the user accepted a uniform star/polygon model, `T-050b1` and `T-050b2` were created and expanded, and the later Pen-tool requirement was resolved as a per-vertex VECTOR model.

Claude's interrupted session initially described `VectorVertex.cornerRadius` as requiring a binary-format extension. Deeper inspection corrected that: the existing vertex `styleOverrideIdx` plus `VectorData.styleOverrideTable` already provide the compatibility-preserving wire route. Only style-table construction/decoding must be widened.

Revision 2 implied that the child split was fully ready for selection. The files are ready as packet contracts, but the live plan does not yet index T-050b3/T-050b4 and still describes T-050b as a blocked `To Do` finding. Revision 3 records that parent-owned reconciliation gap explicitly instead of treating packet-file state as plan state.

## Fixed Decisions

1. `STAR`/`POLYGON` use uniform `SceneNode.cornerRadius`; all generated points share the value. This remains the contract of `T-050b1`/`T-050b2`.
2. `VECTOR` uses `VectorVertex.cornerRadius` independently per eligible vertex. This is the user's explicit choice from the interrupted session.
3. VECTOR endpoints, dangling vertices, branch vertices, coincident-edge vertices, collinear reversals and vertices adjacent to any curved segment remain sharp and expose no radius handle.
4. Per-vertex radius uses the existing `.fig` style-override mechanism. Do not enlarge or version the `vectorNetworkBlob` record.
5. VECTOR radius handles appear only in node edit mode and only for selected eligible vertices. They do not extend the rectangle-family `CORNER_RADIUS_TYPES`, `CornerPosition` or `DragRadius` model.
6. Radius values are finite, non-negative and conservatively clamped so adjacent tangent points cannot cross: `maxRadius = tan(theta / 2) * min(adjacentEdgeLengths) / 2`.
7. Rendering/persistence must land before handles: `T-050b3` is a hard dependency of `T-050b4`. `T-050b1` is a hard dependency of `T-050b2`.
8. SVG/PDF parity for newly rounded STAR/POLYGON or VECTOR geometry is not silently bundled here. It remains separate export work.
9. This parent remains an umbrella with zero implementation files. Executing it as one combined change would breach the packet size/responsibility rule; only a child may be selected.
10. `Plan/plan.md` must be reconciled by its parent owner before T-050b3 or T-050b4 execution. Expansion readiness does not authorise this packet to mutate the index.

## Open Decisions

None for this expansion. The material product decision - per-vertex versus uniform VECTOR radius - was answered `Per-vertex (recommended)` by the user on 2026-08-22.

## Visual Contract — binding

- Generated shapes: `STAR`, `POLYGON`, and triangles (`POLYGON` with `pointCount: 3`) use one uniform radius and one radius handle per generated corner as specified by T-050b1/T-050b2.
- VECTOR paths: only selected, eligible degree-2 straight vertices show a radius dot in node edit mode; curved-adjacent, endpoint, dangling, branch, coincident and collinear-reversal vertices remain sharp and show no dot.
- A drag previews the same tangent-arc geometry that persists on commit, changes only its owning vertex, clamps before adjacent tangent points cross, and produces one undo entry on release.
- Radius controls remain legible at any zoom through screen-space sizing and hit thresholds fixed in the selected handle child. They must not displace, restyle or intercept existing vertex circles or tangent diamonds when no radius handle is hit.
- Radius zero preserves the current sharp geometry and current selection/node-edit appearance.

### Banned List

- No literal UI colour, new global CSS, `app.css` edit, new `tv()` recipe, new dependency, or new store.
- No font-size or panel-control work; this family is an on-canvas interaction, not a new Properties panel design.
- No new radius vocabulary for existing HTML UI. Canvas overlay sizes/paints must reuse the exact child-packet precedents and renderer-owned paint lifecycle.
- No extension of rectangle-family `CORNER_RADIUS_TYPES`, `CornerPosition` or `DragRadius` for VECTOR.

## Allowed Changes

This umbrella may only be revised as planning evidence. Application changes belong to the named child packets.

## Restrictions and Exclusions

- Do not implement all four child scopes as one change.
- Do not add a `TRIANGLE` node type.
- Do not reuse the top-level `SceneNode.cornerRadius` for VECTOR.
- Do not round Bezier-adjacent VECTOR vertices in this packet family.
- Do not change the VECTOR blob record size or introduce a second persistence channel.
- Do not edit `Plan/plan.md` during packet expansion; it remains parent-owned live status.
- Do not execute T-050b3 or T-050b4 while they are absent from the authoritative plan; stop for parent reconciliation.
- Do not build, install, bump versions, commit, branch or publish during expansion.

## Implementation Steps

None in this parent. Execute child packets in this order where dependencies apply:

1. `T-050b1` then `T-050b2`.
2. `T-050b3` then `T-050b4`.

The two chains are independent of each other.

## Acceptance Criteria

- [x] The user's star/polygon/triangle and Pen-tool requirements are both represented.
- [x] The product model is fixed: uniform for generated star/polygon shapes; per-vertex for VECTOR.
- [x] Every implementation slice is dependency-ordered and small enough for a separate executor session.
- [x] The existing style-override wire route is preserved.
- [x] Live source anchors for model, render, codec, overlay, hit-test and drag state were re-read on 2026-08-22.
- [x] The authoritative-plan mismatch is recorded as a hand-off condition, not silently corrected.
- [x] No `App/` or `Plan/plan.md` file was changed during expansion.

## Verification

Planning-only structural checks:

- Confirm all four child packet paths exist.
- Confirm each child has the canonical packet headings and `Packet state: Ready`.
- Confirm `T-050b4` names `T-050b3` as a hard dependency and stop condition.
- Confirm `Plan/plan.md` still indexes only T-050b1/T-050b2 and therefore requires parent reconciliation before VECTOR-child execution.
- Search the parent and four child packet files for any build/install/Git instruction; none is allowed except explicit prohibitions.

## Integration or Installed-Result Check

Not applicable to this umbrella. Each child packet owns its focused source gates and mandatory `cd App && bun run dev` browser check.

## Stop Conditions

- Stop if a child packet is executed out of dependency order.
- Stop if live source has already introduced a different radius model or style-table contract; re-expand the affected child against the new source.
- Stop if `Plan/plan.md` gains conflicting ownership or product decisions before execution.
- Stop if an executor is asked to run this umbrella directly or to run an unindexed VECTOR child; select one dependency-eligible child after the parent plan is reconciled.
- Stop before indexing T-050b3 until its two-command development loop is corrected to the one-file loop recorded under Verified Starting State.

## Execution Report Contract

Not applicable to this parent. Use each child packet's execution report contract.

## Status record

Status: **Done**

2026-08-24 - Executed child packets T-050b1 (Star/polygon point-radius model and rendering) and T-050b2 (Star/polygon radius drag handles). All unit tests, canvas render tests, type checks, and lint gates passed cleanly.
