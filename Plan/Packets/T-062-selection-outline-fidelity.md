# T-062 - Selection outline fidelity, including during radius edits

Task ID: T-062
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-004 (corner-radius node controls; already DONE and confirmed live)
Related: T-040 (corner-radius cursor), T-039 (frame gutter/padding overlay)
Prepared from: `Plan/Packets/T-038-selection-outline-fidelity.md`, renumbered to T-062 on 2026-08-15 because T-038 was already taken by the shipped colour-picker packet (`Plan/Packets/T-038-fill-picker-edit-survives-deselect.md`). The task ID is T-062 throughout; no other content changed because of the rename.
Expanded at: 2026-08-15
Expanded against: `App/packages/core/src/canvas/overlays/selection.ts`, `App/packages/core/src/canvas/strokes.ts`, `App/packages/core/src/canvas/renderer/paints.ts`, `App/packages/core/src/canvas/renderer/pipeline.ts`, `App/packages/core/src/canvas/renderer.ts`, `App/packages/core/src/constants.ts`, `App/packages/vue/src/shared/input/radius.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`
Delivery: source gates only

## Intended Outcome

The selection outline traces the selected node's actual rendered shape - straight sides for a plain rectangle, an arc for a rounded corner, an oval for an ellipse, the real path for a vector/polygon/star - at any zoom, for single and multi-selection, and it keeps doing so continuously while a corner-radius handle is dragged, because it is now reading the same live geometry the radius drag already writes to.

## Request Coverage

- Show the selection outline while the corner radius is being changed; today the outline is present but does not reflect the corner radius at all (see Corrections below).
- Improve the overall selection outline quality across the editor, not only in the radius case.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/packages/core/src/canvas/overlays/selection.ts` | Draws hover highlight, entered-container outline, single-selection outline + handles, multi-selection outlines + group bounds, and parent-frame outlines. All selection drawing for the canvas lives here. |
| `App/packages/core/src/canvas/strokes.ts:293-355` (`strokeNodeShape`) | Already draws a node's **true** outline: `drawOval` for `ELLIPSE`, the real path for `VECTOR`, a line for `LINE`, `makePolygonPath` for `POLYGON`/`STAR`, and for everything else a rect **or** an `RRect` chosen by `hasRadius` (`node.cornerRadius > 0` or, in independent mode, any of the four corner fields). Independent-corner mode builds the `RRect` from a `Float32Array` of the four `[rx, ry]` pairs (`strokes.ts:334-347`); uniform mode uses `r.ck.RRectXY(rect, node.cornerRadius, node.cornerRadius)` (`strokes.ts:350`). |
| `App/packages/core/src/canvas/overlays/selection.ts:36-65` (`drawHoverHighlight`) | Already calls `r.strokeNodeShape(canvas, node, r.auxStroke)` for the hover outline - it gets full shape fidelity today. **This is the exact call the selection outline is missing.** |
| `App/packages/core/src/canvas/overlays/selection.ts:215-227` (`drawSelectionRect`), used by both `drawNodeSelection` (single selection, line 229-240) and `drawNodeOutline` (multi-selection, line 288-296) | Draws `canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)` unconditionally - a plain axis-aligned-in-local-space rectangle, regardless of node type, corner radius, or shape. This is the actual defect: it never tracked shape at all, radius drag or not. |
| `App/packages/core/src/canvas/overlays/selection.ts:98-154` (`drawSelection`) | Single selection: `r.selectionPaint.setStrokeWidth(1 / r.zoom)` (line 119) - correctly zoom-compensated, 1 device px at any zoom. Multi-selection: `r.selectionPaint.setStrokeWidth(1)` (line 137) - **not** divided by zoom. At zoom 2 a multi-selected outline paints twice as thick as a single-selected one; at zoom 0.5 it paints half as thick. This is a second, independent bug. |
| `App/packages/core/src/canvas/renderer/pipeline.ts:246-259` | `r.drawSelection(...)` runs unconditionally every frame, then later `r.drawProgressiveBlurHandles(...)`. Nothing in the pipeline or in `useCanvasInput.ts`'s drag handling gates `drawSelection` on drag state - **the outline is never suppressed** during a radius drag, corner-radius or otherwise. |
| `App/packages/core/src/canvas/overlays/selection.ts:198-213` (`drawRadiusHandles`) | Called from inside `drawSelectionRect`'s `afterDraw` callback (`drawNodeSelection`, line 236-239), i.e. **after** the outline is drawn, in the same `withNodeBounds` transform. Handles paint on top of the outline in the same pass - correct z-order, already established, nothing to change. |
| `App/packages/core/src/canvas/renderer/paints.ts:24-35` | `r.selectionPaint` (stroke, width 1, colour `r.selColor()`, antialiased) and `r.parentOutlinePaint` (stroke, width 1, colour `r.selColor(PARENT_OUTLINE_ALPHA)`, dashed) are set up once at renderer init and reused every frame - the packet must keep using these Paint objects, not construct new ones. |
| `App/packages/core/src/canvas/renderer.ts:404-410` | `selColor(alpha = 1)` and `compColor(alpha = 1)` build a `Color4f` from `SELECTION_COLOR` / `COMPONENT_COLOR` (`App/packages/core/src/constants.ts:10-11`). These are the only colour tokens the outline may use; `drawSelection` already picks between them via `r.isComponentType(node.type)` (line 117, 135). |
| `App/packages/core/src/canvas/overlays/selection.ts:242-286` (`drawParentFrameOutlines`) | Draws dashed parent-frame outlines from pre-projected screen-space points, stroke width 1 with **no** zoom division - correct as written, because the points are already in screen space (no `canvas.scale(zoom)` is active at that call site). Not part of this defect; left alone. |
| `App/packages/core/src/canvas/overlays/selection.ts:298-338` (`drawGroupBounds`) | Draws one dashed axis-aligned bounding box around a multi-selection (screen-space, correctly accounts for rotated members via `getRotatedCorners`). This is a deliberate group AABB, not a per-node shape outline - out of scope; not a defect. |
| `App/packages/vue/src/shared/input/radius.ts:202-217` (`applyRadiusDrag`) | Calls `editor.graph.updateNodePreview(d.nodeId, getRadiusChanges(...))` on every pointer move, mutating the **live** node's radius fields directly. Because `drawSelectionRect` reads the live node on every frame, once it calls `strokeNodeShape` (this packet's fix) the outline updates continuously during the drag with no extra wiring. |

### Corrections to the Brief

The stub's two Expansion Questions are answered directly by source, not left open:

1. **"What exactly is wrong with the current outline outside the radius case?"** - It is a plain rectangle for every node type. `ELLIPSE`, `VECTOR`, `LINE`, `POLYGON`, `STAR`, and any rounded rectangle/frame/component/instance/boolean-operation all get the same square-cornered box, while the hover highlight two functions above it (`drawHoverHighlight`) already calls the shape-aware `strokeNodeShape`. This is a straightforward drop-in fix, not a redesign.
2. **"Does the radius interaction suppress the overlay, or is it drawn under the handles?"** - Neither. The outline is never suppressed (confirmed in `pipeline.ts` and `useCanvasInput.ts` - no code path gates `drawSelection` on `drag.value`), and it is drawn *before* the radius handles in the same pass, which is correct z-order. The user-visible "absent or incomplete" symptom is the shape mismatch in point 1: as the corner radius grows, the sharp-cornered outline increasingly diverges from the now-rounded rendered shape, reading as broken rather than merely stale.

The stub's premise that the outline might be hidden during the drag is wrong; corrected here rather than carried forward.

## Fixed Decisions

1. **Both `drawNodeSelection` (single selection) and `drawNodeOutline` (multi-selection) route through `r.strokeNodeShape` instead of a bare `canvas.drawRect`.** `drawSelectionRect` (`selection.ts:215-227`) is the one place both call through; add an `outline` drawing step there that calls `r.strokeNodeShape(canvas, node, r.selectionPaint)` in place of the current `canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)`. `x1/y1/x2/y2` stay as the `(0, 0, width, height)` values already passed to `afterDraw` for the handle-position math - only the line that paints the outline changes.
2. **Multi-selection stroke width is zoom-compensated, matching single-selection.** Change `r.selectionPaint.setStrokeWidth(1)` at `selection.ts:137` to `r.selectionPaint.setStrokeWidth(1 / r.zoom)`, matching line 119 exactly. Binding value: **stroke width is always `1 / r.zoom`**, i.e. a constant 1 device-independent pixel regardless of zoom, for every selection outline (single or multi). Never a flat `1`.
3. **Colour stays exactly as today: `r.selColor()` for ordinary nodes, `r.compColor()` for component-family types (`r.isComponentType(node.type)`), both from the existing `SELECTION_COLOR` / `COMPONENT_COLOR` constants.** No new colour, no new alpha value, no new Paint object.
4. **z-order is unchanged and correct as verified: outline first, then radius handles, in the same `withNodeBounds` transform pass.** Nothing in the pipeline or handle-drawing order needs to move.
5. **`drawGroupBounds`'s dashed AABB and `drawParentFrameOutlines`'s dashed parent frame are out of scope.** Both are deliberate, already zoom-correct, and are not per-node shape outlines - changing them is a different feature (a shape-aware multi-selection marquee), not this fidelity fix.
6. **`strokeNodeShape` is reused exactly as it exists; it is not modified.** It already covers every `SceneNode` type the selection overlay can be asked to outline (falls through to the `hasRadius` rect/RRect branch for any type not explicitly matched, which is correct for `FRAME`/`COMPONENT`/`INSTANCE`/`BOOLEAN_OPERATION`/plain `RECTANGLE`).

## Visual Contract — binding

This is a canvas (CanvasKit/Skia) drawing change, not a DOM/Tailwind change - there are no Tailwind classes or `tv()` recipes involved. The binding contract is the Paint configuration:

| Property | Value | Source |
| --- | --- | --- |
| Stroke width | `1 / r.zoom` (single **and** multi-selection) | Matches existing `selection.ts:119`; extends it to line 137 |
| Colour (plain node) | `r.selColor()` | `renderer.ts:404-406`, unchanged |
| Colour (component-family node) | `r.compColor()` | `renderer.ts:408-410`, unchanged, via existing `r.isComponentType()` check |
| Paint object | `r.selectionPaint` (existing, initialised once in `renderer/paints.ts:24-28`) | No new `Paint` is constructed |
| Shape function | `r.strokeNodeShape(canvas, node, r.selectionPaint)` | `strokes.ts:293-355`, already used by `drawHoverHighlight` |
| Zoom-compensation rule | Always divide by `r.zoom`; guard division-by-zero the same way the codebase already does elsewhere (`Math.max(r.zoom, Number.EPSILON)`, see `radius.ts:58` and `radius.ts:80`) if a bare `1 / r.zoom` is judged unsafe at the call site - `zoom` is already asserted positive elsewhere in the renderer, so a bare division is consistent with line 119's existing precedent and is the default; only add the `Math.max` guard if a focused test proves `r.zoom` can reach `0` at that call site | `radius.ts` precedent |
| z-order | Outline drawn before radius handles, both inside `withNodeBounds`; handles overlay the outline | `selection.ts:229-240`, unchanged |

### Banned List

- No literal colour of any kind (no hex, `rgb()`, `Color4f` with hand-written floats). Only `r.selColor()` / `r.compColor()`.
- No new `Paint` object. Only `r.selectionPaint` (and, where already used, `r.auxStroke`/`r.auxFill` for handles - unchanged).
- No new stroke-width constant. Only `1 / r.zoom`.
- No change to `strokeNodeShape` itself - it is correct and shared with the hover highlight; changing it risks the hover outline too.
- No change to `drawGroupBounds`, `drawParentFrameOutlines`, or `drawHoverHighlight` - none of them are defective.
- No new dependency, no new file under `packages/core/src/canvas/` beyond what `Allowed Changes` lists.
- No change to `.fig` codec, undo/history, or the radius-drag input logic in `packages/vue/src/shared/input/radius.ts` - this packet only changes what is painted, not what is stored.

## Allowed Changes

- `App/packages/core/src/canvas/overlays/selection.ts` - `drawSelectionRect`, `drawNodeSelection`, `drawNodeOutline`, `drawSelection` (the stroke-width line only).
- `App/tests/engine/render/canvas/` - a new focused pixel/geometry test file for the selection outline (see Implementation Steps).
- `App/tests/e2e/canvas/` - a focused Playwright addition or extension of an existing spec if outline shape is observably assertable (see Implementation Steps); do not add a new spec file if an existing one in `App/tests/e2e/canvas/` already exercises corner-radius selection and can be extended in place.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT touch `strokes.ts`.** `strokeNodeShape` is already correct and shared with the hover highlight; the fix is calling it from one more place, not changing it.
- **Do NOT change `drawHoverHighlight`, `drawGroupBounds`, or `drawParentFrameOutlines`.** They are not defective (see Fixed Decisions 5 and the Verified Starting State table).
- **Do NOT change `drawRadiusHandles`, `drawBoundsHandles`, or any handle geometry/hit-testing.** This packet changes what is painted for the outline line only, never handle position, size, or hit radius.
- **Do NOT change anything in `packages/vue/src/shared/input/radius.ts` or `packages/vue/src/canvas/useCanvasInput.ts`.** The live-node-read behaviour that makes the outline track the drag already exists; this packet only makes the outline *shape-aware*, it does not change when or how radius values are written.
- **Do NOT add a suppression/visibility gate on `drawSelection` during a drag.** The Corrections section establishes there is no suppression defect to fix; adding one would be a regression.
- **Do NOT introduce a new Paint object, a new cache, or a new renderer field.** Reuse `r.selectionPaint` exactly as it exists today.
- **Deferred to a later packet: shape-aware multi-selection group bounds.** `drawGroupBounds`'s dashed AABB stays a bounding box, not a per-shape outline union - that is a materially different (and unbounded) feature and is explicitly out of this packet's scope.

## Implementation Steps

1. Read `App/packages/core/src/canvas/overlays/selection.ts` and `App/packages/core/src/canvas/strokes.ts` in full before editing - confirm the current line numbers still match (they may have drifted since 2026-08-15).
2. In `drawSelectionRect` (`selection.ts:215-227`), replace the line `canvas.drawRect(r.ck.LTRBRect(x1, y1, x2, y2), r.selectionPaint)` with `r.strokeNodeShape(canvas, node, r.selectionPaint)`. Keep the `afterDraw?.(x1, y1, x2, y2)` call immediately after, unchanged, so handle positioning is untouched.
3. `drawSelectionRect` needs the `node` in scope to call `strokeNodeShape` - it already receives `node` as a parameter (line 218), so no signature change is needed.
4. In `drawSelection` (`selection.ts:98-154`), change the multi-selection stroke-width line (`r.selectionPaint.setStrokeWidth(1)`, currently line 137) to `r.selectionPaint.setStrokeWidth(1 / r.zoom)`.
5. Visually confirm (via the focused tests in step 6, not a build) that: a plain rectangle still outlines as a rectangle; a rounded rectangle/frame outlines as an `RRect` matching its live corner radius, including mid-drag; an ellipse outlines as an oval; a multi-selection of mixed shapes shows each member's true outline at correct, zoom-invariant width.
6. Add `App/tests/engine/render/canvas/selection-outline.test.ts` following the harness in `App/tests/engine/render/canvas/cache.test.ts` (`initCanvasKit()` from `#cli/headless`, `bun:test`, a `SkiaRenderer` instance, `renderer.render(graph, selectedIds, overlays, sceneVersion)`, then `surface.makeImageSnapshot()` / `readPixels`). Cover:
   - A selected rounded rectangle (`cornerRadius > 0`) with a pixel probe at a corner showing the outline follows the arc, not a square corner (sample a pixel just outside the arc but inside the old square bounding box, and assert it is *not* stroked).
   - The same rectangle mid-radius-change (simulate by setting `cornerRadius` directly on the node, since `applyRadiusDrag` only wraps `updateNodePreview`, which is exactly a live node mutation) - outline still follows the new arc.
   - An independent-corner node with four different radii - outline follows all four arcs independently, matching `strokeNodeShape`'s `Float32Array` branch.
   - A multi-selection of two nodes at `zoom = 2` and `zoom = 0.5` - outline stroke width stays visually 1 device px at both (assert via a pixel-thickness probe or by asserting the drawn stroke's coverage does not scale with zoom).
7. Do not add a Playwright spec unless the Bun pixel test cannot express the fix adequately; if one is added, extend `App/tests/e2e/canvas/corner-radius-controls.spec.ts` (it already selects a rectangle and drags a radius handle) rather than creating a new file, and assert only structural/visual facts already within that spec's existing pattern (e.g. a screenshot diff of the outline during a mid-drag frame), not new interaction flows.
8. Run, in order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` (only if the Vue project's type surface is touched - it should not be, since this packet stays inside `packages/core`)
   - focused Oxlint on the changed files
   - `bun test tests/engine/render/canvas/selection-outline.test.ts tests/engine/render/canvas/corner-smoothing.test.ts`
   - the focused Playwright spec only if step 7 added or changed one, with `--project=openpencil`

## Acceptance Criteria

- [ ] A selected rounded rectangle, frame, component, instance, or boolean-operation node with `cornerRadius > 0` (uniform or independent) shows a selection outline that follows the rounded corners, not a square bounding box.
- [ ] A selected ellipse, vector, line, polygon, or star node shows a selection outline that follows its true shape, not a square bounding box.
- [ ] Dragging a corner-radius handle keeps the outline following the corner continuously, with no visible lag, flash, or square-cornered frame at any point in the drag.
- [ ] Single-selection and multi-selection outlines are both `1 / r.zoom` wide - visually 1 device px at any zoom level, not thicker or thinner at zoom other than 1.
- [ ] `r.selColor()` / `r.compColor()` are the only colours used; no new Paint object is constructed.
- [ ] Radius handles still draw on top of the outline, unchanged in position, size, or hit-testing.
- [ ] `drawHoverHighlight`, `drawGroupBounds`, and `drawParentFrameOutlines` are byte-for-byte unchanged in the diff.
- [ ] Nothing in the Banned List appears in the diff.

## Verification

- `bunx tsgo --noEmit --pretty false` from `App/`.
- `bun test tests/engine/render/canvas/selection-outline.test.ts tests/engine/render/canvas/corner-smoothing.test.ts` from `App/`; expect exit code `0`.
- Focused Oxlint over `packages/core/src/canvas/overlays/selection.ts` and the new test file.
- If a Playwright spec was touched: `bunx playwright test tests/e2e/canvas/corner-radius-controls.spec.ts --project=openpencil`; expect exit code `0` and no new snapshot mismatches outside the intended outline-shape change (any changed baseline PNGs must be regenerated deliberately, not silently accepted).
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command per the delivery policy.

## Stop Conditions

- Stop if `strokeNodeShape` throws or produces a visibly wrong shape for any `CORNER_RADIUS_TYPES` member when called from the selection path but not from the hover path - that would mean the two call sites are not actually equivalent, and the packet's central assumption is wrong.
- Stop if the `1 / r.zoom` stroke width produces a division-by-zero or a degenerate (invisible or enormous) stroke at any zoom level exercised by existing tests - add the `Math.max(r.zoom, Number.EPSILON)` guard from Fixed Decisions and re-verify rather than shipping a crash.
- Stop and report if `drawSelectionRect`'s `node` parameter turns out to already be a shape-detached copy (e.g. a plain `{x1,y1,x2,y2}` projection with no `type`/`cornerRadius` fields) rather than the real `SceneNode` - the source read for this packet confirms it receives the full node, but re-verify before editing.
- Stop if fixing the multi-selection stroke width visibly changes any existing Playwright snapshot baseline in `App/tests/e2e/canvas/renderer-visuals.spec.ts-snapshots/` or `frame-overlays.spec.ts-snapshots/` in a way that looks wrong rather than merely thinner/thicker - report the specific snapshot rather than regenerating it blind.

## Revision History

- Revision 1 - 2026-08-15: expanded from the T-038 brief (renumbered to T-062) against live selection/stroke/paint source; central finding is that `strokeNodeShape` already exists and is already used by the hover highlight, making this a small, high-confidence drop-in fix rather than a new drawing routine.

## Status record

Status: **Done** (executed 2026-08-20)

Verification evidence:
- `drawSelectionRect` updated to call `r.strokeNodeShape(canvas, node, r.selectionPaint)` in `App/packages/core/src/canvas/overlays/selection.ts`.
- Multi-selection stroke width updated to `1 / r.zoom` in `drawSelection`.
- Added test suite `App/tests/engine/render/canvas/selection-outline.test.ts` verifying rounded corners, live mutations, independent corners, and zoom-compensated stroke width.
- `bunx tsgo --noEmit --pretty false` exited with code 0.
- `bunx oxlint -c oxlint.json packages/core/src/canvas/overlays/selection.ts tests/engine/render/canvas/selection-outline.test.ts` exited with code 0 (0 errors, 0 warnings).
- `bun test tests/engine/render/canvas/selection-outline.test.ts tests/engine/render/canvas/corner-smoothing.test.ts` passed (7/7 tests passed, exit code 0).
