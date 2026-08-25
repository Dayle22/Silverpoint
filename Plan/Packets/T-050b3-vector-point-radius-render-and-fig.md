# T-050b3 - VECTOR per-vertex radius rendering and .fig preservation

Task ID: T-050b3
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-024 (Done - Pen tool and node editing); independent of T-050b1/T-050b2
Related: T-050b, T-050b1, T-050b2, T-050b4
Blocks: T-050b4
Prepared from: the user's explicit choice of per-vertex radii for Pen-tool/freeform paths
Expanded at: 2026-08-22 07:33 Africa/Johannesburg
Expanded against: live source in `App/packages/core/src/vector/`, `.fig` vector geometry import/export, and existing vector/blob tests
Delivery: source gates plus browser dev-server check only; no build/install/version bump
Execution size: 5 core implementation files; 3 test files in the focused vector suite; kept separate from the handle interaction packet

## Intended Outcome

A VECTOR node can carry a finite, non-negative radius on each eligible `VectorVertex`. Closed Pen shapes and internal corners of open Pen paths render those eligible straight corners as tangent arcs. The value survives OpenPotlood's `.fig` vector-network encode/decode through the existing per-vertex style-override index without changing the blob layout. Radius `0` preserves today's path exactly.

This packet adds no on-canvas handle or Properties-panel control. `T-050b4` exposes the landed model after this packet passes.

## Request Coverage

- Applies corner radius to paths and shapes created with the Pen tool: covered at model, render and `.fig` persistence layers.
- Visual drag dots: deferred to dependent packet `T-050b4`, so a handle cannot precede its renderer.
- Independent radius per vertex: covered by the existing `VectorVertex.cornerRadius?: number` field.

## Verified Starting State

### Model and Pen output

- `App/packages/scene-graph/src/types.ts` defines `VectorVertex { x; y; strokeCap?; strokeJoin?; cornerRadius?; handleMirroring? }` and `VectorNetwork { vertices; segments; regions }`.
- `SceneNode.vectorNetwork` stores Pen geometry. `App/packages/core/src/editor/shapes/pen.ts` constructs vertices and segments but never sets `cornerRadius`, so new vertices naturally remain sharp (`undefined`/`0`).
- Node edit lifecycle copies vertex objects with object spread when entering, normalising and committing; an existing `cornerRadius` property survives without lifecycle changes.

### Current renderer

- `App/packages/core/src/vector/index.ts::vectorNetworkToPath` renders region loops through private `addLoopToPath` and open networks through `addOpenSegmentsToPath`.
- `App/packages/core/src/vector/path-helpers.ts::addSegmentDirected` emits `lineTo` only when both tangent vectors are exactly `{x:0,y:0}`; otherwise it emits `cubicTo`.
- No live VECTOR path function reads `VectorVertex.cornerRadius` or calls `arcToTangent`.
- `findAllHandles(network, vertexIndex)` returns every incident segment and its neighbour. The model permits 0, 1, 2 or more incident segments.

### Existing `.fig` route

- Each encoded vertex is already `[styleOverrideIdx:u32, x:f32, y:f32]` (12 bytes). Do not change it.
- `buildStyleOverrideTable` currently deduplicates only `handleMirroring`; `encodeVectorNetworkBlob` looks up the resulting style ID; `decodeVectorNetworkBlob` restores only `handleMirroring`.
- `serializeGeometry` in `App/packages/core/src/kiwi/fig/node-change/serialize.ts` is the sole production caller of both functions.
- `resolveVectorNetwork` in `vector-geometry.ts` narrows `styleOverrideTable` to `{styleID, handleMirroring?}` even though Kiwi decodes each table entry as the full schema `NodeChange`. `NodeChange.cornerRadius` reaches runtime already and only needs to be admitted by the local type and decoder.

## Read First

- `App/packages/scene-graph/src/types.ts:42-70`
- `App/packages/core/src/vector/index.ts:30-280`
- `App/packages/core/src/vector/path-helpers.ts`
- `App/packages/core/src/vector/bezier.ts::findAllHandles`
- `App/packages/core/src/vector/curve-math.ts::isLineSegment`
- `App/packages/core/src/kiwi/fig/node-change/vector-geometry.ts`
- `App/packages/core/src/kiwi/fig/node-change/serialize.ts:406-424`
- `App/tests/engine/vector/blob/roundtrip.test.ts`
- `App/tests/engine/vector/blob/mutation.test.ts`

## Fixed Decisions

1. **Reuse `VectorVertex.cornerRadius`; add no scene-graph field and no node-level VECTOR radius.** Missing, non-finite and negative values render as `0`.
2. **A roundable vertex has exactly two incident segments and both are straight.** Endpoints (degree 1), dangling vertices (0), branches (3+), coincident neighbours, collinear continuations/U-turns and any vertex adjacent to a cubic segment remain sharp.
3. **Clamp conservatively.** For neighbour rays meeting at angle `theta`, `maxRadius = tan(theta / 2) * min(lenPrev, lenNext) / 2`; effective radius is `min(normalisedRequestedRadius, maxRadius)`. Reject non-finite/degenerate results as `0`.
4. **Use CanvasKit `Path.arcToTangent(vertex.x, vertex.y, next.x, next.y, effectiveRadius)`.** It receives the path's current incoming edge, corner and next directed neighbour.
5. **Preserve curved geometry command-for-command.** Curved adjacent corners are not rounded; their existing `cubicTo` route remains `addSegmentDirected`.
6. **Closed loops choose a safe start.** If any vertex is ineligible or has effective radius `0`, rotate traversal to that exact vertex and `moveTo` it. If every vertex is rounded, every segment is necessarily straight; start at the midpoint of the incoming edge to the first vertex, emit one tangent arc per vertex, then close. Never start a curved loop at an edge midpoint.
7. **Open chains never round endpoints.** During ordered chain traversal, apply an arc only when the destination vertex has a following segment in that same chain and the helper confirms eligibility. Unvisited fallback segments remain on today's sharp `moveTo` plus `addSegmentDirected` route.
8. **Use the existing style-override index.** Deduplicate by the compound normalised pair `(handleMirroring, cornerRadius)`. The same pair shares an ID; different radius values or mirroring modes do not. Style ID `0` means defaults (`NONE`, `0`).
9. **Do not change the blob byte layout.** Rename the misleading `mirroringToId` map to `vertexStyleToId` across its two function signatures and sole serializer call.
10. **Scale imported per-vertex radius with `min(abs(sx), abs(sy))` when `normalizedSize` differs from node size.** This keeps arcs circular and bounded by the shorter scale under non-uniform resizing.

## Open Decisions

None. Per-vertex ownership was chosen by the user; eligibility, clamp, persistence and non-uniform scaling are fixed above.

## Visual Contract — binding

- Radius `0`: identical sharp path and command types to current output.
- Positive eligible radius: a circular tangent arc replaces only the corner tip; adjacent straight edges remain tangent to it.
- Independent values: changing vertex A must not change B.
- Ineligible vertices remain sharp even if malformed/imported data gives them a positive radius.
- Filled closed paths, stroked closed paths and stroked open paths all consume `vectorNetworkToPath`, so the same geometry drives each without edits in fill/stroke/shadow files.

## CanvasKit/WASM Lifecycle

`vectorNetworkToPath` continues to allocate the same `Path` objects it allocates today. This packet adds path commands only. It must not allocate a `Paint`, `Shader` or auxiliary `Path`, and must not change caller ownership or `.delete()` order.

## Allowed Changes

- `App/packages/core/src/vector/corner-radius.ts` - new pure geometry helper and exported types.
- `App/packages/core/src/vector/index.ts` - export the helper; widen style overrides; compound style IDs; decode radius; route loop rendering through radius-aware traversal.
- `App/packages/core/src/vector/path-helpers.ts` - radius-aware open-chain traversal while preserving its public signature.
- `App/packages/core/src/kiwi/fig/node-change/serialize.ts` - rename/destructure/pass `vertexStyleToId`.
- `App/packages/core/src/kiwi/fig/node-change/vector-geometry.ts` - admit `cornerRadius` in the local style-table type and scale it with normalised geometry.
- `App/tests/engine/vector/corner-radius.test.ts` - new pure/render-command tests.
- `App/tests/engine/vector/blob/roundtrip.test.ts` - compound radius/mirroring style-table round-trip coverage.
- `App/tests/engine/vector/blob/mutation.test.ts` - correct the stale comment to distinguish raw-blob default loss from style-table-backed `.fig` preservation; retain the raw-blob expectation.
- No other files.

## Restrictions and Exclusions

- Do not edit `App/packages/scene-graph/src/types.ts`; the field exists.
- Do not change the vertex/segment/region binary record layout or add a format version.
- Do not round a vertex next to any non-zero tangent.
- Do not add curve-offset/intersection maths, Bezier fillets or automatic tangent conversion.
- Do not change Pen creation, vector edit lifecycle, fill, stroke, shadow, selection overlay, SVG/PDF export, clipboard or Figma plugin API code.
- Do not add UI, hit-testing, drag state, cursor behaviour or undo actions; those belong to `T-050b4`.
- Do not treat `fillGeometry`/`strokeGeometry` command blobs as editable vector networks.
- Do not add dependencies or allocate new CanvasKit object types.
- Do not run umbrella test/build/install commands.

### Deferred

- On-canvas node-edit radius handles: `T-050b4`.
- Numeric radius field in `VectorPointSection.vue`: not required by the visual-dot request; may be planned separately.
- SVG/PDF parity for rounded VECTOR geometry.
- Rounding corners adjacent to cubic segments.

## Implementation Steps

1. **Pre-flight.** Re-read every Allowed Changes source file. Confirm `serializeGeometry` remains the only production caller of `buildStyleOverrideTable`/`encodeVectorNetworkBlob`, and the blob vertex record remains 12 bytes. Stop on drift.

2. **Create `corner-radius.ts`.** Export:
   ```ts
   export interface VectorCornerGeometry {
     vertexIndex: number
     neighborIndices: [number, number]
     radius: number
     maxRadius: number
     halfAngle: number
     sinHalfAngle: number
     bisector: Vector
   }

   export function getVectorCornerGeometry(
     network: VectorNetwork,
     vertexIndex: number
   ): VectorCornerGeometry | null
   ```
   Use `findAllHandles` and `isLineSegment`. Require exactly two distinct incident segments/neighbours; reject self-loops, zero-length rays and `abs(cross) <= 1e-9` collinearity. Normalise both rays from the vertex, clamp their dot product to `[-1,1]`, compute `halfAngle`, `sinHalfAngle`, `tanHalfAngle`, conservative `maxRadius`, and unit bisector from the ray sum. `radius` is the requested vertex value normalised and clamped to `maxRadius`. The helper is order-independent; traversal decides which neighbour is next.

3. **Widen style overrides in `vector/index.ts`.** Add `cornerRadius?: number` to `StyleOverride`. Add one internal `vertexStyleKey(vertex)` used by table building and encoding. Normalise mirroring to `NONE` and radius to finite `>= 0`; return key `NONE\u00000` for defaults. Rename the result/map and encoder argument to `vertexStyleToId`. Build one entry per unique non-default compound key with sequential style IDs, including both normalised fields. Decode `cornerRadius: Math.max(0, override?.cornerRadius ?? 0)` and retain existing mirroring behaviour.

4. **Make closed-loop traversal radius-aware.** Refactor private `addLoopToPath` to receive a `VectorNetwork`. Resolve the loop's directed segment order exactly as today. Use `getVectorCornerGeometry` for the destination vertex and verify the next segment in traversal is the helper's other incident straight segment. Follow Fixed Decision 6 for the start point. Emit `addSegmentDirected` for unchanged/full segments and `arcToTangent` only for eligible destinations. Preserve fill type, close behaviour and radius-0 command sequence.

5. **Make open chains radius-aware.** In `path-helpers.ts`, import `getVectorCornerGeometry` directly from `./corner-radius` (never the `vector/index.ts` barrel). `corner-radius.ts` imports `findAllHandles` from `./bezier` and `isLineSegment` from `./curve-math`; neither imports `path-helpers.ts`, so this verified leaf route is acyclic. For each `buildChains` result, keep the exact ordered walk. An internal destination may use `arcToTangent` only when current and following directed segments match the eligible helper. Endpoints and leftover fallback stay sharp.

6. **Wire `.fig` output.** In `serialize.ts`, destructure `{ table, vertexStyleToId }` and pass that map to `encodeVectorNetworkBlob`. Keep blob allocation and `vectorData.styleOverrideTable` attachment unchanged.

7. **Wire `.fig` input.** In `vector-geometry.ts`, widen the local entry type with `cornerRadius?: number`. `decodeVectorNetworkBlob` now consumes it. In the existing `normalizedSize` scaling block, multiply positive vertex radii by `Math.min(Math.abs(sx), Math.abs(sy))`; do not scale twice.

8. **Tests.** Add/extend focused tests that prove:
   - 100x100 right-angle geometry gives `maxRadius = 50`; negative/non-finite input becomes `0`; oversize input clamps.
   - endpoint, branch, dangling, collinear, coincident and curved-adjacent vertices return `null`.
   - closed all-straight loop emits one `arcToTangent` per positive vertex and closes; mixed zero/positive radii round independently.
   - an open three-point chain rounds only its internal corner; endpoints stay sharp.
   - a cubic-adjacent corner emits existing `cubicTo` and no arc.
   - radius-0 networks keep previous move/line/cubic/close command sequence.
   - compound style entries distinguish same mirroring/different radius and same radius/different mirroring, while identical pairs deduplicate.
   - table build -> blob encode -> blob decode restores both fields; raw encode/decode without a table still defaults both, as documented.
   - normalised-size import scales radius once by the shorter absolute scale.

9. Run Verification in order.

## Acceptance Criteria

- [ ] Eligible closed and open VECTOR corners render circular tangent arcs using independent per-vertex values.
- [ ] Ineligible vertices remain sharp and never throw on malformed graph topology.
- [ ] Radius `0` retains current rendering and avoids arc calculations in the hot path where practical.
- [ ] Adjacent tangent points cannot cross under the conservative clamp.
- [ ] Existing cubic segments and control points are unchanged.
- [ ] `.fig` style overrides preserve `cornerRadius` with `handleMirroring` without a blob-layout change.
- [ ] Non-uniform normalised-size import uses the shorter scale exactly once.
- [ ] No new CanvasKit object ownership exists.
- [ ] No UI, handle, export or Pen-tool code changes appear.

## Verification

### Development loop — repeat as needed

From `App/`:

- `bun test tests/engine/vector/corner-radius.test.ts`
- `bun test tests/engine/vector/blob/roundtrip.test.ts tests/engine/vector/blob/mutation.test.ts`

### Final pre-completion gates — run once

From `App/`:

- `bunx tsgo --noEmit --pretty false`
- `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/vector/corner-radius.ts packages/core/src/vector/index.ts packages/core/src/vector/path-helpers.ts packages/core/src/kiwi/fig/node-change/serialize.ts packages/core/src/kiwi/fig/node-change/vector-geometry.ts tests/engine/vector/corner-radius.test.ts tests/engine/vector/blob/roundtrip.test.ts tests/engine/vector/blob/mutation.test.ts`
- Re-run both focused `bun test` commands once after the gates.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, build, install or version commands.

## Integration or Installed-Result Check

Mandatory dev-server smoke check: `cd App && bun run dev`.

This packet has no user control yet, so focused render-command tests are the behavioural proof. In the browser, open the editor, create ordinary sharp open and closed Pen paths, and confirm current Pen creation, selection and node editing render without console errors. Do not claim manual proof of positive radius until `T-050b4` exposes it.

## Stop Conditions

- Stop if the blob vertex record or Kiwi `VectorData.styleOverrideTable` schema differs from the verified route.
- Stop if style-table entries do not decode as full `NodeChange` objects with `cornerRadius`.
- Stop if rendering an eligible corner requires modifying Bezier tangent data rather than only emitted path commands.
- Stop if radius-0 tests show a command-sequence regression.
- Stop if a circular module dependency appears; use the callback seam in Step 5 rather than suppressing it.
- Stop if focused tests cannot prove positive-radius geometry without application UI; do not prematurely implement `T-050b4`.

## Execution Report Contract

Report exact files and symbols changed; focused test pass counts; tsgo and Oxlint exit codes; proof the blob length/layout is unchanged; proof of combined mirroring/radius round-trip; dev-server smoke observations; any ineligible topology encountered; and every deviation from this contract.

## Status record

Status: **Ready**

2026-08-22 - Expanded from live VECTOR renderer/blob/codec seams. Fixed the compatibility-preserving style-override route, straight-corner eligibility, conservative clamp, loop/open-chain traversal, scaling rule, focused tests and T-050b4 dependency. No `App/` source changed.
