# T-048c - Stroke-gradient .fig round-trip

Task ID: T-048c
Packet state: Done
Depends on: T-048b (Done)
Related: T-048a, T-048b, T-048d
Delivery: named source gates + browser check
Execution size: 2 core files (small, surgical changes), 2 new focused tests; no renderer/SVG/UI changes

## Intended Outcome
Gradient stroke paints import and export through the existing Figma `Paint` fields, reusing the fill conversion maths (`applyGradientPaintFields` on import, `fillToKiwiPaint` on export) instead of duplicating it.

## Verified Starting State
- `packages/scene-graph/src/types.ts:167-179` — `Stroke.type?: FillType`, `Stroke.gradientStops?: GradientStop[]`, `Stroke.gradientTransform?: GradientTransform` already exist (landed by T-048a).
- `packages/core/src/kiwi/fig/node-change/paint.ts:107-130` — `convertStrokes()` builds each `Stroke` **without ever setting `type`**, and never reads `p.stops`/`p.transform`. A gradient stroke paint imports as a plain solid-colored stroke today — this is the bug this packet fixes.
- `packages/core/src/kiwi/fig/node-change/paint.ts:58-65` — `applyGradientPaintFields(fill: Fill, p: Paint): void` already contains the exact conversion needed (`p.stops` → `gradientStops`, `p.transform` → `gradientTransform`); it only reads/writes `gradientStops`/`gradientTransform` on its first argument, nothing Fill-exclusive.
- `packages/core/src/kiwi/fig/node-change/export-node.ts:109-124` — `createStrokePaints()` hardcodes `type: 'SOLID'` and manually rebuilds a `Paint` (`color`, `opacity`, `visible`, `blendMode`) instead of delegating to `context.fillToKiwiPaint`.
- `packages/core/src/kiwi/fig/node-change/serialize.ts:204-231` — `fillToKiwiPaint(f: SceneNode['fills'][number]): Paint` already handles gradient stops/transform (lines 212-215) plus every other paint field; it is not fill-exclusive in practice (mirrors the `resolveFill`/`createGradientDef` reuse T-048b already established for SVG).
- `export-node.ts:619` — the fill call site proves the reuse pattern: `context.fillToKiwiPaint(fill)` directly, no manual field-by-field rebuild.
- `canvas/strokes.ts:99,105` and `io/formats/svg/export.ts:316-317` both treat `stroke.type === undefined` and `stroke.type === 'SOLID'` identically — confirms it is safe for `convertStrokes()` to always set `type` (not just on gradient strokes).
- `tests/engine/io/fig/import/legacy/strokes.test.ts` — existing solid-stroke tests (`strokeCap`/`strokeJoin`, `dashPattern`), pattern to extend, not replace.
- `tests/engine/io/fig/import/legacy/fills.test.ts:12-38` — the gradient-fill import test to mirror (`type: 'GRADIENT_LINEAR'`, `stops`, `transform`, asserting `gradientStops`/`gradientTransform` on the result).
- `tests/engine/io/fig/export/paint-schema-fields.test.ts` — the export test pattern to mirror: `sceneNodeToKiwi(node, guid, 0, { value: N }, graph, [])` then assert on `changes[0].strokePaints`/`fillPaints` via `toMatchObject`.

## Allowed Changes
`packages/core/src/kiwi/fig/node-change/paint.ts`, `packages/core/src/kiwi/fig/node-change/export-node.ts`, `tests/engine/io/fig/import/legacy/strokes.test.ts` (add cases), one new export test file `tests/engine/io/fig/export/stroke-gradient-export.test.ts` (new — needs the two-line Bun `@ts-nocheck`/Oxlint header used by other new test files in this suite).

## Restrictions and Exclusions
No changes to `fillToKiwiPaint()`, `convertFills()`, `resolveFill()`, `createGradientDef()`, or any SVG/PDF/canvas renderer file — reuse them as-is. No changes to `serialize.ts` beyond none (it is read-only reuse via `context.fillToKiwiPaint`). No UI, picker, or i18n edits. No new gradient-conversion math anywhere — every stop/transform mapping must go through the existing `applyGradientPaintFields`/`fillToKiwiPaint` functions.

## Implementation Steps
1. In `paint.ts`, narrow `applyGradientPaintFields`'s first parameter from `fill: Fill` to `target: Pick<Fill, 'gradientStops' | 'gradientTransform'>` (structural, no behavior change — `Fill` still satisfies it, so `convertFills()`'s existing call site is untouched).
2. In `convertStrokes()`, build each `Stroke` object with `type: p.type as FillType` added to the existing field list, then call `applyGradientPaintFields(stroke, p)` on the constructed object before returning it (same pattern as `convertFills()` at line 100).
3. In `export-node.ts`, rewrite `createStrokePaints()` to call `context.fillToKiwiPaint(...)` with a fill-shaped object built from the stroke (`{ type: stroke.type ?? 'SOLID', color: stroke.color, opacity: stroke.opacity, visible: stroke.visible, blendMode: 'NORMAL', gradientStops: stroke.gradientStops, gradientTransform: stroke.gradientTransform }`), keeping the existing `applyColorVariableBinding(context, node, ..., \`strokes/${index}/color\`)` wrapper unchanged.
4. Add two import tests to `tests/engine/io/fig/import/legacy/strokes.test.ts` mirroring `fills.test.ts:12-38`'s linear/radial gradient cases but using `strokePaints` on a node, asserting `n.strokes[0].type`, `.gradientStops`, and `.gradientTransform`.
5. Add `tests/engine/io/fig/export/stroke-gradient-export.test.ts` (with the two-line Bun header) mirroring `paint-schema-fields.test.ts`: create a `SceneGraph` node with a `GRADIENT_LINEAR` stroke (stops + transform), call `sceneNodeToKiwi(...)`, and assert `changes[0].strokePaints?.[0]` matches `{ type: 'GRADIENT_LINEAR', stops: [...], transform: {...} }`.

## Acceptance Criteria
- [x] A `GRADIENT_LINEAR`/`GRADIENT_RADIAL` `strokePaints` entry imports into a `Stroke` with matching `type`, `gradientStops`, and `gradientTransform`.
- [x] Existing solid-stroke import tests (`strokeCap`/`strokeJoin`, `dashPattern`) still pass unmodified, and imported solid strokes now carry `type: 'SOLID'` instead of `undefined`.
- [x] A scene node with a `GRADIENT_LINEAR` stroke exports via `sceneNodeToKiwi()` to a `strokePaints` entry with matching `type`/`stops`/`transform`.
- [x] `fillToKiwiPaint()` and `applyGradientPaintFields()`'s existing call sites (`convertFills()`, the fill export path at `export-node.ts:619`) are unchanged in behavior.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/io/fig/import/legacy/strokes.test.ts`

### Final pre-completion gates — run once
Run the new focused export round-trip test (`tests/engine/io/fig/export/stroke-gradient-export.test.ts`), focused Oxlint on the two touched files plus the two test files, `bunx tsgo --noEmit`, then `bun run dev` and inspect a gradient-stroked shape saved/reopened as `.fig` (or round-tripped through the app's own import/export) in the browser.

## Stop Conditions
Stop if narrowing `applyGradientPaintFields`'s parameter type breaks `convertFills()`'s existing call site (would indicate `Fill` and the narrowed `Pick` type aren't actually structurally compatible — unexpected). Stop if `context.fillToKiwiPaint` rejects a stroke-shaped object at the type level in a way that can't be resolved without widening `SceneNode['fills'][number]` (would mean the fill/stroke shapes have diverged more than the Verified Starting State shows).

## Execution Report Contract
Report the exact `applyGradientPaintFields` signature change, the `convertStrokes()` diff, the `createStrokePaints()` diff, both new/extended test file paths with pass/fail counts, and the `.fig` round-trip browser evidence.

## Status record
2026-08-20 — Interchange-only split; expand after T-048b is Done.
2026-08-21 — Expanded to Ready: verified `convertStrokes()` never sets `type` today (the actual bug), confirmed `applyGradientPaintFields`/`fillToKiwiPaint` are safely reusable via a narrowed `Pick` type and a fill-shaped stroke object respectively, and confirmed all downstream consumers treat `stroke.type === undefined` and `'SOLID'` identically so always-setting `type` on import is safe.
2026-08-22 — Implemented and verified: narrowed applyGradientPaintFields target, updated convertStrokes() to set type and gradient fields, updated createStrokePaints() to delegate to fillToKiwiPaint, added import and export tests. All tests passing.
