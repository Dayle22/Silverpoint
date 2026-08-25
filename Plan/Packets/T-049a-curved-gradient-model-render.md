# T-049a - Curved-gradient model and renderer

Task ID: T-049a
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-049b, T-049c, T-049d, T-048
Prepared from: Plan/Archive/Superseded/T-049-curved-gradient-type.md (parent map)
Expanded at: 2026-08-22 07:33 Africa/Johannesburg
Expanded against: `App/packages/scene-graph/src/types.ts:98-109,139-161`, `App/packages/scene-graph/src/copy.ts:27-35`, `App/packages/scene-graph/src/index.ts`, `App/packages/core/src/canvas/fills.ts:241-320`, `App/packages/core/src/canvas/scene.ts:32-48`, `App/tests/engine/render/canvas/gradient.test.ts:1-236`
Delivery: named source gates + browser check
Execution size: 5 core implementation files; 2 test files across 1 suite

## Intended Outcome
A fill-only `GRADIENT_CURVED` model and shared Catmull-Rom-to-cubic-Bézier band maths, rendered in CanvasKit. The new model introduces an ordered, editable spine array (`GradientSpinePoint[]`) that arcs the gradient's base line. An empty spine is mathematically and visually equivalent to a linear gradient. This implements the model and rendering layers of the curved gradient feature defined in T-049 Revision 2.

## Request Coverage
- Add a gradient option called "curved".
- It behaves like linear, but the user can bend the gradient line into an arc.

## Verified Starting State
- `App/packages/scene-graph/src/types.ts:98-109`: `FillType` union, ready for `'GRADIENT_CURVED'`.
- `App/packages/scene-graph/src/types.ts:139-161`: `Fill` interface, ready for `gradientSpine`.
- `App/packages/scene-graph/src/copy.ts:27-35`: `copyFill` is a shallow spread and needs explicit deep-copy for arrays like `gradientSpine` to avoid aliasing.
- `App/packages/core/src/canvas/scene.ts:32-48`: `drawVisibleFills` is a module-private helper with a draw closure. It currently lacks the `canvas` parameter required to inject custom clip/saves for per-band rendering.
- `App/packages/core/src/canvas/fills.ts:274-325`: `applyGradientFill` manages gradient shaders; a similar isolated approach (`applyCurvedGradientFill`) is required for the new subtype but with its own per-band loop since effects/masks are applied at the whole-node level (verified via `renderNode` in `scene.ts:298-384`).
- `App/packages/scene-graph/src/progressive-blur.ts`: Proves a discrete band-stack approximation successfully unifies CanvasKit and vector (SVG/PDF) representations, setting the precedent for this rendering pattern.

## Read First
- `App/packages/core/src/canvas/scene.ts:32-48` (`drawVisibleFills` — the exact loop to augment)
- `App/packages/core/src/canvas/fills.ts:9-21` (`setFillShader` / `releaseFillShader` — lifecycle wrappers to use)

## Corrections to the Brief
- The single-scalar `curveBend?: number` design is entirely superseded by `gradientSpine?: GradientSpinePoint[]` per T-049 Revision 2.
- Curve construction uses Catmull-Rom-to-cubic-Bézier chains for points, not quadratic Béziers.

## Fixed Decisions
1. **Model:** `GradientSpinePoint` replaces `curveBend`. `gradientSpine` is added to `Fill`. An absent or empty array denotes a straight line.
2. **Deep Copy:** Explicitly deep-copy `gradientSpine` in `copyFill` to avoid aliasing (`if (f.gradientSpine) copy.gradientSpine = f.gradientSpine.map((p) => ({ ...p }))`).
3. **Curve Construction:** Shared Catmull-Rom-to-cubic-Bézier spline sampled into exactly 24 bands (`CURVED_GRADIENT_BANDS = 24`) in a new module `packages/scene-graph/src/curved-gradient.ts`.
4. **Perpendicular axis computation:** Computed fresh from start (`S`) and end (`E`) for each frame: `perp = { x: -(E.y - S.y), y: E.x - S.x }`. Displaced position: `A_i = lerp(S, E, t_i) + offset_i * perp`.
5. **Band rendering & Masking:** Shared boundary colors/points ensure seamless seams. Effects and layer masks wrap the entire `drawVisibleFills` closure; no special effect-handling is required for N-band draws, provided bands intersect their clip paths cleanly with `ClipOp.Intersect` and wrap their draws in `canvas.save()` / `canvas.restore()`.
6. **No SVG/Fig/UI/Stroke Scope:** This packet is strictly model + renderer. `Fill.gradientSpine` is declared on `Fill` only, not stroke.

## Open Decisions
- The 24-band constant (`CURVED_GRADIENT_BANDS = 24`) is an unverified math estimate. Recommendation: start with 24 and visually evaluate during the browser check; it can be tuned later without logic changes.

## Allowed Changes
- `App/packages/scene-graph/src/types.ts`
- `App/packages/scene-graph/src/copy.ts`
- `App/packages/scene-graph/src/index.ts`
- `App/packages/scene-graph/src/curved-gradient.ts` (new)
- `App/packages/core/src/canvas/fills.ts`
- `App/packages/core/src/canvas/scene.ts`
- `App/tests/engine/render/canvas/curved-gradient.test.ts` (new)
- `App/tests/engine/render/canvas/gradient.test.ts`

## Restrictions and Exclusions
- Do NOT implement SVG export (T-049b).
- Do NOT implement `.fig` conversion (T-049c).
- Do NOT implement UI controls or on-canvas handles (T-049d).
- Do NOT implement stroke gradients (T-048).
- Do NOT modify public `applyFill` or `applyGradientFill` signatures.
- **Known, accepted gap:** `recordPatternSource` and `renderBooleanOperation` bypass `drawVisibleFills`. Curved gradient on pattern source or boolean node rendering blank is expected. It is deliberately out of scope for this packet.

## Implementation Steps

1. **Pre-flight:** Re-read `drawVisibleFills` (`App/packages/core/src/canvas/scene.ts:32-48`) and `setFillShader`/`releaseFillShader` (`App/packages/core/src/canvas/fills.ts:9-21`).
2. **Data Model (`App/packages/scene-graph/src/types.ts`):**
   - Add `'GRADIENT_CURVED'` to `FillType`.
   - Export exact interface:
     ```ts
     export interface GradientSpinePoint {
       /** Position 0..1 along the base start→end line. */
       t: number
       /** Signed fraction of the base line's length, displaced perpendicular to it. 0 = on the line. */
       offset: number
     }
     ```
   - Add `gradientSpine?: GradientSpinePoint[]` to `Fill`.
3. **Deep Copy (`App/packages/scene-graph/src/copy.ts`):**
   - In `copyFill`, add: `if (f.gradientSpine) copy.gradientSpine = f.gradientSpine.map((p) => ({ ...p }))` right below the `gradientStops` copy.
4. **Curve Module (`App/packages/scene-graph/src/curved-gradient.ts`):**
   - Export exact signatures:
     - `export const CURVED_GRADIENT_BANDS = 24`
     - `export function sampleGradientSpine(startX: number, startY: number, endX: number, endY: number, spine: GradientSpinePoint[]): { x: number, y: number }[]`
     - `export function colorAtT(stops: GradientStop[], t: number): Float32Array` (returns RGBA array for CanvasKit consumption)
     - `export interface BandDescriptor { P0: {x: number, y: number}, P1: {x: number, y: number}, color0: Float32Array, color1: Float32Array }`
     - `export function curvedGradientBandDescriptors(startX: number, startY: number, endX: number, endY: number, spine: GradientSpinePoint[], stops: GradientStop[]): BandDescriptor[]`
   - **Math details**:
     - `sampleGradientSpine`: Sort spine points by `t` ascending. Deduplicate points closer than `1e-4` in `t`.
     - Evaluate anchors $A_i = \text{lerp}(S, E, t_i) + \text{offset}_i \times \text{perp}$, where $\text{perp} = \{ x: -(E_y - S_y), y: E_x - S_x \}$.
     - Phantom points for Catmull-Rom: $P_{prev} = 2A_0 - A_1$, $P_{next} = 2A_m - A_{m-1}$.
     - Segment controls: $C1 = A_i + (A_{i+1} - P_{prev}) / 6$, $C2 = A_{i+1} - (P_{next} - A_i) / 6$.
     - Yield exactly `CURVED_GRADIENT_BANDS + 1` sample points at uniform global $t = k / \text{BANDS}$.
   - Add `export * from './curved-gradient'` to `App/packages/scene-graph/src/index.ts`.
5. **Canvas Renderer (`App/packages/core/src/canvas/scene.ts`):**
   - Add `canvas: Canvas` parameter to `drawVisibleFills`.
   - Update call sites at `renderSection`, `renderComponentSet`, `renderShapeUncached` to pass `canvas`.
   - In `drawVisibleFills`'s loop body, add the intercept:
     ```ts
     if (fill.type === 'GRADIENT_CURVED') {
       applyCurvedGradientFill(r, canvas, fill, node, graph, draw)
       continue
     }
     ```
6. **Canvas Renderer (`App/packages/core/src/canvas/fills.ts`):**
   - Import the curved gradient helpers.
   - Implement `export function applyCurvedGradientFill(r: SkiaRenderer, canvas: Canvas, fill: Fill, node: SceneNode, graph: SceneGraph, draw: (fill: Fill) => void): void`
   - Loop `CURVED_GRADIENT_BANDS` times using `curvedGradientBandDescriptors`.
   - For each band, create a linear gradient shader between its two sampled points, calling `setFillShader(r, bandShader)`.
   - Build a 4-point clip polygon (a slab extending `Math.max(node.width, node.height) * 4` outward along perpendicular bisectors of the band's endpoints). Create a `Path`, use `canvas.clipPath(slabPath, r.ck.ClipOp.Intersect, true)`.
   - Execute: `canvas.save()`, apply the clip, `draw(fill)`, `canvas.restore()`, then `slabPath.delete()`.
   - After the loop finishes, call `releaseFillShader(r)`.
7. **Tests:**
   - Create `App/tests/engine/render/canvas/curved-gradient.test.ts`. Use exact header:
     ```ts
     // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
     // @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
     ```
   - Assert the empty-spine identity proof: an empty spine returns points mathematically identical to linear interpolation.
   - Update `App/tests/engine/render/canvas/gradient.test.ts` to assert `GRADIENT_CURVED` rendering does not leak shaders (verifying `r.activeFillShader` management via `releaseFillShader`).

## Acceptance Criteria
- [x] `FillType` includes `GRADIENT_CURVED`.
- [x] `GradientSpinePoint` is defined and `gradientSpine` is on `Fill`.
- [x] `copyFill` deep-copies `gradientSpine`.
- [x] `curved-gradient.ts` contains Catmull-Rom spline sampling and exact exported functions.
- [x] `drawVisibleFills` intercepts `GRADIENT_CURVED` and delegates to `applyCurvedGradientFill`.
- [x] `applyCurvedGradientFill` executes a band draw loop employing `ClipOp.Intersect` inside `save`/`restore` without leaking shaders.
- [x] Zero-point identity is explicitly proven in maths tests.

## Verification

### Development loop — repeat as needed
```bash
bun test tests/engine/render/canvas/curved-gradient.test.ts
```

### Final pre-completion gates — run once
```bash
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json
bunx oxlint -c oxlint.json --deny-warnings packages/scene-graph/src/curved-gradient.ts packages/core/src/canvas/fills.ts packages/core/src/canvas/scene.ts
bun test tests/engine/render/canvas/gradient.test.ts
```

## Integration or Installed-Result Check
`cd App && bun run dev`. Open a document with fills and verify existing tools operate normally without crash (curved UI is absent, so fallback to existing fills is visually confirmed).

## Stop Conditions
- If CanvasKit shaders leak during the band loop or `releaseFillShader` is insufficient, stop and report.

## Execution Report Contract
List any discrepancies found during band shading, confirm clipping did not disrupt standard node layout masks, and confirm test pass rates.

## Status record
2026-08-22 — Expanded against Revision 2. T-049a is now executable for the model+renderer, fully superseding the scalar bend control with Catmull-Rom array mechanics.
2026-08-22 — Implemented and verified: GRADIENT_CURVED model, Catmull-Rom sampling in curved-gradient.ts, applyCurvedGradientFill renderer in fills.ts, scene.ts dispatch, and 100% passing tests with 0 typecheck/lint warnings. State: Done.
