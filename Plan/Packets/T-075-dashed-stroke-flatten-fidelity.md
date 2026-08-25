# T-075 - Dashed-stroke flatten fidelity discovery

Task ID: T-075
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-011 (Done)
Related: `selection.flatten`, `selection.outlineStroke`; do not conflate ordinary Flatten with Outline Stroke
Prepared from: 2026-08-21 dashed-stroke flatten defect report
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: `App/packages/core/src/canvas/{flatten,boolean,scene,strokes}.ts`; `App/packages/core/src/editor/structure/flatten.ts`; `App/packages/scene-graph/src/{types,node-defaults}.ts`; `App/packages/vue/src/controls/stroke/helpers.ts`; `App/tests/engine/editor/structure/flatten.test.ts`; `App/node_modules/canvaskit-wasm/types/index.d.ts`; `App/package.json`
Delivery: named source gates + browser check
Execution size: 0 core implementation files; 1 test file in 1 suite; bounded API-fidelity discovery and stop slice

## Intended Outcome

Establish whether installed CanvasKit 0.40 can generate vector outlines that exactly match every dash pattern the application renders, before production flatten code changes. Only if the proof covers the real renderer's dash array, phase, cap, join and alignment semantics may a follow-up implementation packet use that seam. This slice intentionally does not claim to repair visible flattening.

## Request Coverage

Flattening a shape with a visible dashed stroke must convert only painted dash segments into vector geometry. The vector must visually match the original dash pattern, phase, cap, joins and stroke alignment rather than becoming one continuous outline. Rectangle, ellipse and vector sources must be considered; solid-stroke and fill-only flatten behaviour, undo/redo, multi-object flatten and nested-container flatten must not regress. Do not rasterise, retain live dash style on the result, change ordinary renderer dash drawing, or alter Outline Stroke.

## Verified Starting State

| Path | Symbol / span | Binding use |
| --- | --- | --- |
| `packages/core/src/editor/structure/flatten.ts` | `flattenSelected()` lines 18-74 | Ordinary Flatten defaults to `flattenNodesToVectorProps`, creates a `VECTOR` with `strokes: []`, and owns snapshot undo/redo. Do not edit it. |
| `packages/core/src/editor/structure/flatten.ts` | `outlineStrokeSelected()` lines 76-82 | Outline Stroke is a separate command route using `outlineStrokeNodesToVectorProps`; excluded. |
| `packages/core/src/canvas/flatten.ts` | `nodesToVectorProps()` lines 20-57; `flattenNodesToVectorProps()` lines 59-67 | Source paths are transformed, serialised with `path.toSVGString()`, parsed, and receive only `nodes[0].fills`. Any eventual dash outline must be valid `Path` geometry before conversion. |
| `packages/core/src/canvas/boolean.ts` | `addVisibleStrokeOutlines()` lines 93-100; `makeBooleanSourcePath()` lines 171-185 | Current flatten geometry calls `source.stroke({ width })` per visible stroke. It ignores dash, cap, join, miter limit and alignment; non-lines receive a continuous outline. |
| `packages/core/src/canvas/boolean.ts` | `containerSourcePath()` lines 136-169; `makeStrokeOutlinePath()` lines 196-237 | Container flatten recursively calls the same source maker. Outline Stroke also calls `addVisibleStrokeOutlines`; changing it widens this defect beyond Flatten. |
| `packages/core/src/canvas/scene.ts` | `drawVectorPathStrokes()` lines 579-622 | Vector dashes use `PathEffect.MakeDash(dash, 0)` and per-stroke cap/join. The effect is renderer-only and deleted after drawing. |
| `packages/core/src/canvas/scene.ts` | `drawRegularStroke()` lines 624-659; `renderShapeUncached()` lines 713-756 | Ordinary shapes use `PathEffect.MakeDash(stroke.dashPattern, 0)`; dashed vectors take their centreline route at lines 731-740. |
| `packages/core/src/canvas/scene.ts` | rounded-rectangle special path lines 447-465 | A dashed rounded rectangle uses `drawDashedRRectWithSolidCorners()` with phase `dashPattern?.[1] ?? 0`; its corner arcs remain solid and straight sides dash independently. It is not one dashed closed path. |
| `packages/core/src/canvas/strokes.ts` | `drawDashedRRectWithSolidCorners()` lines 142-201; `drawStrokeWithAlign()` lines 269-303 | Special rectangles use per-side effects. `INSIDE`/`OUTSIDE` are rendered by clipping a doubled-width stroke, not a `Path.stroke` option. |
| `packages/scene-graph/src/types.ts` | `Stroke` lines 176-188; `SceneNode` lines 450-452 | `dashPattern?: number[]` is unrestricted; `Stroke` holds alignment/cap/join but no dash phase. |
| `packages/vue/src/controls/stroke/helpers.ts` | `dashState`, `toggleDash`, `setDash`, `setGap` lines 58-77 | UI creates canonical `[dash, gap]` pairs, but imports/plugin data are not constrained by it. |
| `node_modules/canvaskit-wasm/types/index.d.ts` | `Path.dash(on, off, phase)` lines 2615-2622 | Installed CanvasKit proves only an in-place single-pair conversion returning `boolean`; it accepts no interval array. |
| `node_modules/canvaskit-wasm/types/index.d.ts` | `Path.stroke(opts?)` lines 2818-2822; `StrokeOpts` lines 3194-3207 | Candidate dashed centreline can be outlined with `{ width, miter_limit, cap, join }`; no alignment or path-effect parameter exists. |
| `node_modules/canvaskit-wasm/types/index.d.ts` | `PathEffect.MakeDash(intervals, phase?)` lines 3939-3948 | Renderer drawing accepts arbitrary even arrays, but no `PathEffect.filterPath`/array dash-to-path conversion is declared. |
| `tests/engine/editor/structure/flatten.test.ts` | Bun suite lines 1-410 | Uses `initCanvasKit()`, `new SkiaRenderer(ck, surface)`, and existing flatten/outline/undo coverage. It has no out-of-tsconfig header. |
| `package.json` | scripts lines 19-57 | `dev`, direct `bun test`, `bunx tsgo`, `bunx vue-tsc`, and direct `bunx oxlint` exist. No `check:i18n` script exists. |

## Corrections to the Brief

1. No persisted `Stroke` dash-phase field exists. Renderer behaviour differs by shape: ordinary/vector dashes use `0`; special rounded rectangles use the gap as phase and keep corner arcs solid. A production packet cannot promise one universal stored phase without a model/product decision.
2. `Path.dash()` is real but accepts `(on, off, phase)`, not arbitrary arrays. `PathEffect.MakeDash()` accepts arrays only at paint time. The source accepts arbitrary imported arrays, so a two-value workaround would lose supported data.
3. The continuous route also loses cap, join and alignment. `StrokeOpts` can express cap/join/miter limit, never `INSIDE`/`OUTSIDE` clipping.

## Fixed Decisions

1. **Ready means discovery-and-stop, not a partial repair.** Use installed CanvasKit 0.40 and the exact renderer paths above. Do not merge a `Path.dash()` two-value workaround.
2. **Place permanent proof in `tests/engine/editor/structure/flatten.test.ts`.** It is the existing focused harness; add no suite and no `@ts-nocheck` header.
3. **Prove canonical and imported shapes separately.** `[6,4]` may use `Path.dash(6,4,0)`; `[6,4,2,4]` must demonstrate the gap between `PathEffect.MakeDash()` and path conversion. This evidence is not permission to discard extra intervals.
4. **Require real renderer parity before a production seam.** Compare normal rendering with candidate geometry for round/square centre VECTOR, `INSIDE`/`OUTSIDE` rectangle, and rounded rectangle. A candidate that dashes arcs or loses solid corners disproves parity.
5. **Delete every CanvasKit wrapper in test cleanup.** Paths, effects, paints, images and surfaces are released on success and failure. JavaScript GC does not release WASM wrappers.
6. **Stop after reporting.** A subsequent packet must choose either a proven general geometry algorithm or explicit narrowed product authority.

## Allowed Changes

- Modify only `App/tests/engine/editor/structure/flatten.test.ts` to add the permanent capability/parity proof.
- Do not change production source in this slice.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one must stop and report.

- Do not edit `packages/core/src/canvas/{flatten,boolean,scene,strokes}.ts`.
- Do not alter `flattenSelected()`, `outlineStrokeSelected()`, command IDs, undo, output `strokes: []`, or eligibility.
- Do not rasterise; retain live dash style; use `Paint.setPathEffect()` as vector conversion; ignore/normalise imported intervals; or change rendering, UI, schema, imports/exports, or Outline Stroke.
- Do not add a dependency, script, global state, broad refactor, or test header.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, build, install, package-manager command, or snapshot update.

## Implementation Steps

1. **Pre-flight.** Re-read `boolean.ts:93-100`, `scene.ts:447-465,579-659,713-756`, `strokes.ts:142-201,269-303`, and CanvasKit declarations above. If an upgrade supplies documented array dash-to-path/filter-path, stop and re-expand T-075.
2. **Capability proof.** In `tests/engine/editor/structure/flatten.test.ts`, inside `describe('flattenSelected', ...)`, use `initCanvasKit()` to create a local source `Path`; call `path.dash(6,4,0)`, then `path.stroke({ width: 4, miter_limit: 4, cap: ck.StrokeCap.Round, join: ck.StrokeJoin.Round })`. Assert usable result, serialise by `toSVGString()`, and use a deliberate SVG command-count helper to assert multiple move/subpaths. Delete all objects in `finally`.
3. **Arbitrary-array boundary.** Beside it, create/delete `ck.PathEffect.MakeDash([6,4,2,4],0)` to prove renderer acceptance, then demonstrate through a declaration-constrained helper/API boundary that only `dash(number, number, number)` is legal. No `as any`, monkey-patch, or expected compilation failure.
4. **Parity evidence.** Reuse `createEditorWithRenderer()` and headless pixel reads. Compare explicit alpha sample regions, not snapshots, for canonical candidate versus live round/square centre VECTOR. Demonstrate that candidate geometry cannot match current `INSIDE`, `OUTSIDE`, or solid-corner rounded-rectangle rendering without clip/per-side rules. Delete every temporary wrapper.
5. **Report and stop.** Run gates. If green, report simple-pair success plus unproven/unsupported arbitrary-array, alignment and solid-corner semantics; make no production edit.

## Acceptance Criteria

- [ ] Test proves `Path.dash(on, off, phase)` can make outlineable discontinuous geometry for `[6,4]`.
- [ ] Test proves `Path.stroke({ width, miter_limit, cap, join })` carries cap/join into candidate geometry.
- [ ] Test documents that `PathEffect.MakeDash([6,4,2,4],0)` accepts a multi-value pattern but CanvasKit 0.40 has no declared path conversion for it.
- [ ] Parity evidence exposes live differences for `INSIDE`, `OUTSIDE`, and rounded rectangles with solid corners; it never treats mere rendering as parity.
- [ ] Existing ordinary flatten, Outline Stroke, descendant and undo/redo tests remain green.
- [ ] No production source/model/command/renderer/Outline Stroke changes; test wrappers are all deleted.

## Verification

### Development loop — repeat as needed

From `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bun test tests/engine/editor/structure/flatten.test.ts
```

Expected: all tests pass. An API or parity mismatch is a stop result, not a workaround prompt.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`, after finalising the test:

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p packages/core/tsconfig.json --pretty false
bunx oxlint -c oxlint.json tests/engine/editor/structure/flatten.test.ts
bun test tests/engine/editor/structure/flatten.test.ts
```

Expected: exit 0. Root `tsconfig.json` excludes tests, so Bun is the test-file authority. Do not substitute umbrella scripts.

## Integration or Installed-Result Check

After source gates, run `bun run dev` from `App`. In browser, confirm existing baseline: flatten a solid centre-stroked rectangle, undo/redo, and Outline Stroke a stroke-only rectangle. Then flatten a dashed rounded rectangle and dashed vector; document the continuous-outline mismatch as current defect evidence. Do not claim fidelity, build, install, or inspect a desktop binary.

## Stop Conditions

- Stop if `Path.dash(6,4,0)` does not produce discontinuous outlineable geometry or cap/join fails in headless proof.
- Stop if any proposal treats `PathEffect.MakeDash()` as path geometry.
- Stop if multi-entry patterns, imports, clipping, or rounded-rectangle solid-corner semantics lack an exact tested general algorithm.
- Stop/re-expand after a CanvasKit API upgrade with a documented array conversion.
- Stop if proof requires production renderer/model/import/export/Outline Stroke/command edits.

## Execution Report Contract

Report changed files (expected only the test); CanvasKit version and observed `Path.dash`, `Path.stroke`, `PathEffect.MakeDash` signatures; outcomes for `[6,4]`, `[6,4,2,4]`, cap/join, alignment and rounded corners; every command exit code and browser observation; and the required stop conclusion plus smallest recommended next packet. Do not call T-075 delivered.

## Status record

Expansion receipt — 2026-08-24: inspection proved two-number `Path.dash(on, off, phase)` and `Path.stroke` cap/join options, but not arbitrary interval-array conversion, alignment, stored phase, or solid-corner rounded rectangles. This Ready packet authorises only permanent capability/parity proof and mandatory stop, not a partial repair.
