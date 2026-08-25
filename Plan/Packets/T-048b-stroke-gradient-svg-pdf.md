# T-048b - Stroke-gradient SVG and PDF export

Task ID: T-048b
Packet state: Done
Depends on: T-048a (must be Done — `Stroke.type`/`gradientStops`/`gradientTransform` must exist on `packages/scene-graph/src/types.ts` before this executes)
Related: T-048a, T-048c, T-048d
Delivery: named source gates + browser check
Execution size: 1 core file, 1 helper signature change; 2 new focused tests (SVG + PDF); no UI or interchange

## Intended Outcome
Gradient strokes export through SVG `stroke="url(#...)"` defs, reusing the fill gradient-def seam. PDF export inherits this for free since it renders through the same SVG string via `svg2pdf`.

## Verified Starting State
- `packages/core/src/io/formats/svg/export.ts:307-328` — `buildSVGStrokeAttrs(visibleStrokes, colorSpace)` builds `stroke`/`stroke-width`/etc. from `stroke.color` only; it has no gradient branch and does not receive `node`/`ctx`.
- `packages/core/src/io/formats/svg/export.ts:384` — the only call site: `buildSVGStrokeAttrs(visibleStrokes, ctx.colorSpace)`.
- `packages/core/src/io/formats/svg/defs.ts:365-389` — `resolveFill(fill: Fill, node: SceneNode, ctx: SVGExportContext): string | null` already handles `fill.type.startsWith('GRADIENT')` by calling `createGradientDef()`, pushing the def into `ctx.defs`, and returning `url(#id)`. It only reads `fill.type`, `fill.gradientStops`, `fill.gradientTransform` (plus `.visible`/`.color`/`.opacity` on the SOLID branch) — no fields exclusive to fills.
- `packages/core/src/io/formats/svg/defs.ts:41-107` — `createGradientDef(fill, node, ctx)` reads only `fill.gradientStops`/`fill.gradientTransform`/`fill.type`; it is not fill-specific in practice.
- `packages/core/src/io/formats/pdf/export.ts:11,28-31` — `renderNodesToPDF()` renders the same node set to an SVG string via `renderNodesToSVG()` and hands it to `svg2pdf`. No stroke-specific PDF code exists; there is nothing to change here.
- No PDF export test file exists yet (`tests/engine/io/**pdf**export**` has no match) — the "focused PDF inheritance regression" is a new file.
- `tests/engine/io/svg/export/render.test.ts:332-379` already has `'linear gradient'`/`'radial gradient'` **fill** tests using `exportSVGOrThrow()` from `./helpers`; no `@ts-nocheck` header (existing file, not new).

## Allowed Changes
`packages/core/src/io/formats/svg/export.ts` (only file with logic changes); `tests/engine/io/svg/export/render.test.ts` (add cases); one new PDF regression test file under `tests/engine/io/formats/` (e.g. `pdf-export.test.ts`, following the two-line Bun `@ts-nocheck`/Oxlint header since it is new).

## Restrictions and Exclusions
No changes to `defs.ts`, `resolveFill()`, or `createGradientDef()` — reuse them as-is by constructing a `Fill`-shaped argument from the stroke's gradient fields. No CanvasKit, `.fig`, picker, or i18n edits. No PDF-specific export code — PDF must inherit through the existing SVG string, not gain a parallel path.

## Implementation Steps
1. Change `buildSVGStrokeAttrs()` to accept `node: SceneNode` and `ctx: SVGExportContext` in addition to `visibleStrokes`/`colorSpace`, and update its one call site (`export.ts:384`).
2. Inside `buildSVGStrokeAttrs()`, for the first visible stroke: if `stroke.type` is a gradient type (starts with `GRADIENT`) and `stroke.gradientStops`/`stroke.gradientTransform` are set, build a minimal `Fill`-shaped object (`{ type: stroke.type, color: stroke.color, opacity: 1, visible: true, gradientStops: stroke.gradientStops, gradientTransform: stroke.gradientTransform }`) and pass it to `resolveFill(fillLike, node, ctx)`; use the returned `url(#id)` (or fall back to the solid `formatColor` path if `resolveFill` returns `null`) as `attrs.stroke` instead of `formatColor(stroke.color, 1, colorSpace)`.
3. Leave `stroke-width`, `stroke-opacity`, `stroke-linecap`, `stroke-linejoin`, `stroke-dasharray` handling unchanged — only the `stroke` color/url value branches.
4. Add one SVG export test in `render.test.ts` mirroring the existing `'linear gradient'` fill test but on `strokes: [...]` with `type: 'GRADIENT_LINEAR'`, asserting the result contains `<linearGradient`, `<stop`, and `stroke="url(#grad`.
5. Add a new `tests/engine/io/formats/pdf-export.test.ts` (with the repo's two-line Bun header) that builds a node with a `GRADIENT_LINEAR` stroke, calls `renderNodesToPDF()`, and asserts it resolves to a non-empty `Uint8Array` (regression: `svg2pdf` does not throw or drop output on a `stroke="url(#...)"` attribute).

## Acceptance Criteria
- [x] A rectangle with a `GRADIENT_LINEAR`/`GRADIENT_RADIAL`/`GRADIENT_ANGULAR`/`GRADIENT_DIAMOND` stroke exports SVG with `stroke="url(#gradN)"` and a matching `<linearGradient>`/`<radialGradient>` def.
- [x] Solid strokes are byte-for-byte unchanged (existing stroke tests in `render.test.ts` still pass unmodified).
- [x] `renderNodesToPDF()` on the same gradient-stroke node resolves to a non-null, non-empty `Uint8Array` without throwing.
- [x] `defs.ts` is untouched — the gradient-def seam is reused, not duplicated.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/io/svg/export/render.test.ts`

### Final pre-completion gates — run once
Run the new focused PDF inheritance test, focused Oxlint on the two touched/added files, `bunx tsgo --noEmit`, then `bun run dev` and inspect a gradient-stroked shape's SVG export (and PDF export if reachable from the UI) in the browser.

## Stop Conditions
Stop if `resolveFill`/`createGradientDef` need fill-specific fields that don't exist on `Stroke` (signature mismatch beyond the documented fields), or if `svg2pdf` silently drops/mishandles a `stroke="url(#...)"` reference (would require a PDF-specific fallback, out of this packet's scope).

## Execution Report Contract
Report the exact `buildSVGStrokeAttrs()` signature change, the constructed fill-shaped object shape, the two new test file paths/results, and SVG + PDF browser evidence.

## Status record
2026-08-20 — Export-only split; expand after T-048a is Done.
2026-08-20 — Expanded to Ready: reuse-seam and PDF-inheritance verified against current `export.ts`/`defs.ts`/`pdf/export.ts`; execution still blocked on T-048a landing the `Stroke` gradient fields.
2026-08-21 — Executed and verified. Gradient strokes export with SVG def URLs, PDF inheritance verified with unit regression test, 0 oxlint errors and 0 typecheck errors.
