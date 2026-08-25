# T-048a - Stroke-gradient model and CanvasKit rendering

Task ID: T-048a
Packet state: Completed
Depends on: none
Related: T-048b, T-048c, T-048d
Delivery: named source gates + browser check
Execution size: 5 core files plus bounded draw-site edits; 2 engine tests; no UI or interchange

## Intended Outcome
The scene graph can own gradient strokes and the CanvasKit renderer draws regular gradient strokes with explicit shader cleanup. No picker or interchange work lands here.

## Verified Starting State
- `packages/scene-graph/src/types.ts:137-149` defines `GradientTransform` and fill gradient fields; `Stroke` lacks them.
- Exact additions to `Stroke`: `type?: FillType`, `gradientStops?: GradientStop[]`, `gradientTransform?: GradientTransform`.
- `packages/core/src/canvas/fills.ts` exports `linearGradientEndpoints()` and owns the fill-shader lifecycle pattern.
- Exact new renderer API: `applyStrokePaint(r: SkiaRenderer, stroke: Stroke, node: SceneNode, graph: SceneGraph): void`.

## Allowed Changes
`packages/scene-graph/src/{types,copy}.ts`; `packages/core/src/canvas/{strokes,renderer,renderer/lifecycle,scene,boolean}.ts`; focused scene-graph and canvas-gradient tests.

## Restrictions and Exclusions
No SVG/PDF, `.fig`, picker, i18n, new dependency or broad suite. T-048b/c/d own those surfaces.

## Implementation Steps
1. Add the three optional fields and deep-copy gradient arrays/matrix in `copyStroke`.
2. Add `activeStrokeShader`, `setStrokeShader`, `releaseStrokeShader`, and cleanup in `destroyRenderer`.
3. Implement `applyStrokePaint()` by reusing fill gradient endpoint/matrix maths; release the previous shader before solid/gradient selection.
4. Replace only regular-stroke colour-only draw sites in `scene.ts` and `boolean.ts`; keep width, alpha, cap, join and path effects unchanged.
5. Add deep-copy and renderer cases. New `tests/engine/**` files must use the repository's two-line Bun `@ts-nocheck`/Oxlint header.

## Acceptance Criteria
- [x] Gradient stroke fields deep-copy without shared references.
- [x] Linear/radial/angular/diamond regular strokes render; solid strokes are unchanged.
- [x] Replacement and renderer destruction delete the active shader exactly once.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/render/canvas/gradient.test.ts`

### Final pre-completion gates — run once
Run the focused copy test, focused Oxlint, `bunx tsgo --noEmit`, `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json`, then `bun run dev` and inspect solid plus gradient strokes.

## Stop Conditions
Stop on shader leaks/double deletion, a required draw-site signature redesign, or any solid-stroke regression.

## Execution Report Contract
Report exact fields, shader ownership path, draw sites, test exits and visual evidence.

## Status record
- 2026-08-20 — First executable slice of former T-048.
- 2026-08-21 — Executed and verified: Stroke gradient model, SkiaRenderer stroke shader lifecycle, regular stroke rendering, copy tests and render tests passing.
