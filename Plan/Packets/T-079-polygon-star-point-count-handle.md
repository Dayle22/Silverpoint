# T-079 - Star/polygon point-count drag handle

Task ID: T-079
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-050b1, T-050b2, T-060
Prepared from: the user's 2026-08-22 request for a slider-like on-canvas node that increases polygon edges and star points, starting at 3; supplied Figma screenshots are interaction references, not a pixel-copy requirement
Expanded at: 2026-08-22 07:26 Africa/Johannesburg
Expanded against: `App/AGENTS.md`; `Plan/endgoal.md`; `Plan/plan.md`; `Plan/PACKET-EXPANSION-BRIEF.md`; revision 1 of this packet; T-050b1, T-050b2 and T-060; and the bounded live seams below
Delivery: named source gates + browser check
Execution size: 3 core implementation files; 1 new interaction test and 1 existing render test extended across 2 suites. One responsibility, below the five-core-file ceiling; no split required.

## Intended Outcome

A sole selected, unlocked `POLYGON` or `STAR` shows one white circular point-count handle on the upper quarter of the node's right transform-bounds edge. Horizontal dragging behaves like an invisible stepped slider: every 12 screen pixels changes `node.pointCount` by one whole point, never below 3. The shape redraws live at each threshold, mouse-up records one `Adjust point count` undo operation, and Escape restores the opening count. Existing radius, resize and rotation behaviour remains unchanged.

## Request Coverage

> "triangle(polygon) - a node dot that sits along the edge of the transform bounding box that when clicked and dragged, it needs to almost feel like a slider without the appearance of it, the desired effect of the slider will be to increase the amount of edges the polygon has, starting from 3 going onwards"
>
> "The star should also have that node dot with how many points it has"

- Covered: one on-canvas point-count handle for `POLYGON` (including a triangle at `pointCount: 3`) and `STAR`; integer count changes; lower bound 3; live preview; commit, undo/redo and cancel.
- Excluded: ellipse arc/donut controls (T-080), point-radius handles (T-050b2), a floating count badge, a Properties-panel field, and animated vertex morphing.

## Verified Starting State

| Path | Symbol / span | Binding fact |
| --- | --- | --- |
| `packages/scene-graph/src/types.ts` | `SceneNode.pointCount`, lines 353-477 | The `number` field already exists; no schema or codec change is required. `locked` is line 382. |
| `packages/scene-graph/src/node-defaults.ts` | base defaults, lines 195-207 | Shared default is `pointCount: 5`; leave it unchanged. |
| `packages/core/src/editor/shapes.ts` | shape overrides, lines 60-71 | New `POLYGON` starts at 3; new `STAR` starts at 5 with `starInnerRadius: 0.38`. |
| `packages/scene-graph/src/geometry.ts` | `polygonVertices`, lines 112-138 | Rendering clamps with `Math.max(3, node.pointCount)`. A star renders `pointCount * 2` vertices while `pointCount` remains its outer-point count. |
| `packages/vue/src/shared/input/types.ts` | `CornerPosition`, line 7; `DragRadius`, lines 92-106 | Keep outer discriminator `type: 'radius'` so callers remain unchanged; replace the internal contract exactly as specified below. |
| `packages/vue/src/shared/input/radius.ts` | hit/start/apply/commit/cancel, lines 77-93 and 179-248 | Existing lifecycle already provides screen-constant hit testing, preview, one undo commit and cancel restore. Extend it; do not create a parallel input subsystem. |
| `packages/vue/src/shared/input/select.ts` | `tryStartRadius`, lines 61-66 | Mouse-down accepts any truthy drag from `tryStartRadius`; no caller edit required. |
| `packages/vue/src/shared/input/select/hover.ts` | `getRadiusCursorForSelection`, lines 60-79 | Hover returns `grab` for any truthy hit; no caller edit required. |
| `packages/vue/src/canvas/useCanvasInput.ts` | radius dispatch, lines 503, 626, 695 | Move, mouse-up and Escape dispatch only on `type === 'radius'`; the internal handle kind is opaque. |
| `packages/core/src/canvas/overlays/selection.ts` | `drawRadiusHandles`, lines 237-251; `drawNodeSelection`, 267-278 | Reuse `r.auxFill`, `r.selectionPaint`, `r.ck.WHITE` and radius `4 / Math.max(r.zoom, Number.EPSILON)`; allocate nothing. |
| `packages/core/src/constants.ts` | `HANDLE_HIT_RADIUS = 8`, line 406 | Reuse; add no new hit-radius token. |
| `packages/core/src/editor/viewport-animation.ts` | `createViewportAnimator`, lines 51-181 | The only tween helper is coupled to viewport state/events, not node-path morphing. |
| `tests/engine/editor/corner-radius-controls.test.ts` | lines 1-19, 146-265 | Nearest `createEditor()` preview/undo/cancel test harness. |
| `tests/engine/render/canvas/selection-outline.test.ts` | lines 1-35, 272-347 | Existing CanvasKit selection-handle mock and render assertions. |
| `package.json` | `dev`, `lint`, `check:vue`, lines 20, 26-27, 38 | Confirms the source gates below. No i18n script or string change applies. |

Exact replacement contract for `packages/vue/src/shared/input/types.ts`:

```ts
export type PointCountHandle = 'point-count'
export type RadiusHandle = CornerPosition | PointCountHandle

export interface DragCornerRadius {
  type: 'radius'
  handle: CornerPosition
  nodeId: string
  startLocalX: number
  startLocalY: number
  original: {
    cornerRadius: number
    topLeftRadius: number
    topRightRadius: number
    bottomRightRadius: number
    bottomLeftRadius: number
    independentCorners: boolean
  }
}

export interface DragPointCount {
  type: 'radius'
  handle: PointCountHandle
  nodeId: string
  startCanvasX: number
  originalPointCount: number
  zoom: number
}

export type DragRadius = DragCornerRadius | DragPointCount
```

The property is `handle`, not `corner`, because the union contains two controls. Rename only internal `radius.ts` references after narrowing; the external discriminator stays `type: 'radius'`.

Required new exports in `packages/vue/src/shared/input/radius.ts`:

```ts
export const POINT_COUNT_STEP_SCREEN_PX = 12

export function getPointCountControlLocalPoint(
  node: Pick<SceneNode, 'width' | 'height'>
): Vector

export function getPointCountControlPosition(
  node: SceneNode,
  graph: SceneGraph
): Vector

export function calculatePointCountFromCanvasDelta(
  startCanvasX: number,
  currentCanvasX: number,
  zoom: number,
  originalPointCount: number
): number
```

The calculation is binding:

```ts
const safeStart = Number.isFinite(startCanvasX) ? startCanvasX : 0
const safeCurrent = Number.isFinite(currentCanvasX) ? currentCanvasX : safeStart
const safeZoom = Math.max(Number.isFinite(zoom) ? zoom : 1, Number.EPSILON)
const safeOriginal = Number.isFinite(originalPointCount) ? Math.trunc(originalPointCount) : 3
const deltaSteps = Math.round(
  ((safeCurrent - safeStart) * safeZoom) / POINT_COUNT_STEP_SCREEN_PX
)
return Math.max(3, Math.min(Number.MAX_SAFE_INTEGER, safeOriginal + deltaSteps))
```

## Read First

1. `packages/vue/src/shared/input/types.ts:7,92-106` — `CornerPosition` and current `DragRadius`.
2. `packages/vue/src/shared/input/radius.ts:10-35,77-93,168-248` — constants, hit testing and complete lifecycle.
3. `packages/core/src/canvas/overlays/selection.ts:12-58,237-278` — paint pattern and mount point.
4. `tests/engine/editor/corner-radius-controls.test.ts:1-19,146-265` — drag/undo/cancel harness.
5. `tests/engine/render/canvas/selection-outline.test.ts:1-35,272-347` — renderer mock and handle assertions.

## Corrections to the Brief

1. Revision 1 left numeric safety undefined. This contract retains open-ended interaction but clamps to the safe-integer range and handles non-finite input.
2. Revision 1 suggested Properties-panel feedback as a fallback. No `pointCount` field exists there; adding one is separate DOM/UI work. The shape redraw is the feedback in this slice.
3. Revision 1 left handle placement and drag mapping open. Both are fixed below.

## Fixed Decisions

1. **Extend the radius-handle lifecycle with an internal point-count handle kind.** The three external callers treat the result as opaque and dispatch only on `type: 'radius'`, keeping the implementation to three core files.
2. **Place one handle at local `{ x: node.width, y: node.height * 0.25 }`.** It lies on the requested right transform edge, avoids the east midpoint and corner resize handles, and follows world transforms.
3. **Use horizontal canvas movement at 12 screen pixels per point.** Multiply canvas `deltaX` by zoom captured at drag start. Screen-horizontal movement preserves invisible-slider behaviour even on a rotated node.
4. **Minimum 3; no invented product maximum.** Clamp only to `Number.MAX_SAFE_INTEGER` for numeric integrity. The renderer already enforces the same minimum.
5. **Snap at thresholds; do not morph vertices in T-079.** The live tween helper is viewport-specific. Different-length vertex-array morphing needs transient render state, correspondence and reduced-motion handling across more files, so it is a separate follow-up.
6. **Use one preview stream and one undo entry.** Preview `{ pointCount }` only when the integer changes. On commit, restore the original then call `updateNodeWithUndo(..., 'Adjust point count')`; Escape restores without undo.
7. **Land before or explicitly reconcile with T-050b2.** Both touch the same three files. T-050b2 was expanded against `DragRadius.corner`; its executor must preserve this union and `'point-count'` branches. Never execute them concurrently.

## Visual Contract — binding

This is CanvasKit overlay UI, not DOM UI; Tailwind, recipes, icons, focus rings, loading, responsive breakpoints and `data-test-id` do not apply.

| State | Binding appearance / behaviour |
| --- | --- |
| Default | One circle at `(width, height * 0.25)`; white `r.auxFill`, then `r.selectionPaint`; radius `4 / Math.max(r.zoom, Number.EPSILON)`. |
| Hover | Existing path returns `grab` inside `HANDLE_HIT_RADIUS / zoom`; no visual animation. |
| Active | Existing `type: 'radius'` path supplies `grabbing`; handle stays anchored while the shape steps. |
| Disabled | No dot or target for locked, empty/multiple selection, or non-`STAR`/`POLYGON`. |
| Transform | Dot and hit target map through `getWorldMatrix(node, graph)` and remain screen-size constant. |
| Very small node | Keep the 25%-height position; add no alternate layout in this slice. |

### Banned List

- No new CanvasKit `Paint`, `Path`, `Shader`, image, surface, cache or WASM wrapper. Reuse renderer-owned paints; no `.delete()` is added because nothing is allocated.
- No literal colour, Tailwind class, `tv()` recipe, global CSS, icon, DOM overlay, tooltip, badge or component.
- No dependency, store, scene field, serialisation route, renderer path, command, shortcut or Properties field.
- No tween library, viewport-animator reuse, rAF loop or vertex-correspondence algorithm.
- No edit to `select.ts`, `select/hover.ts`, `useCanvasInput.ts`, scene geometry/defaults/types, codecs or render paths.

## Allowed Changes

- `App/packages/vue/src/shared/input/types.ts` — add the exact drag union and handle types.
- `App/packages/vue/src/shared/input/radius.ts` — add point-count helpers and branch hit/start/apply/commit/cancel.
- `App/packages/core/src/canvas/overlays/selection.ts` — draw the point-count handle.
- `App/tests/engine/editor/point-count-control.test.ts` — new focused interaction test.
- `App/tests/engine/render/canvas/selection-outline.test.ts` — extend existing handle-render evidence.

## Restrictions and Exclusions

- Do not add `TRIANGLE`; it is `POLYGON` with count 3.
- Do not change creation defaults, `polygonVertices`, `starInnerRadius`, radius values, schema or codecs.
- Do not add Properties-panel or floating-badge UI, or animate vertex creation/removal.
- Do not execute concurrently with T-050b2. If it landed first, preserve its `VertexRadiusHandle` branch while merging.
- Do not build, install, version-bump, package, modify generated files or perform Git work.
- If any file outside Allowed Changes is required, stop and report before editing it.

## Implementation Steps

1. **Pre-flight.** Reread the five bounded items. Re-grep all `DragRadius`, hit/start/apply/commit/cancel call sites. Stop if a caller now inspects `d.corner` or a specific returned handle string, or if T-050b2 landed without its branch being visible.
2. **Types — `packages/vue/src/shared/input/types.ts`.** Replace current `DragRadius` with the exact union above. Keep outer `type: 'radius'`; do not add a new top-level drag kind.
3. **Pure helpers — `packages/vue/src/shared/input/radius.ts`.** Add `POINT_COUNT_TYPES = new Set(['STAR', 'POLYGON'])`, the step constant and exact exports. Local point is `{ x: node.width, y: node.height * 0.25 }`; world position uses `Matrix.mapPoint(getWorldMatrix(node, graph), local)`. Preserve rectangle helpers except the narrowed `d.corner` to `d.handle` rename.
4. **Lifecycle — `packages/vue/src/shared/input/radius.ts`.** Widen hit-test return to `RadiusHandle | null`. For point-count types, test only the new position and return `'point-count'`; otherwise retain the corner loop. `tryStartRadius` keeps sole-selection/locked gates and returns `{ type: 'radius', handle: 'point-count', nodeId, startCanvasX: cx, originalPointCount: Math.max(3, Math.trunc(node.pointCount)), zoom: editor.renderer?.zoom ?? 1 }`. Narrow on `d.handle`; implement Fixed Decision 6 for point count and leave corner behaviour unchanged.
5. **Overlay — `packages/core/src/canvas/overlays/selection.ts`.** Add local `POINT_COUNT_TYPES` and `drawPointCountHandle`. In `drawNodeSelection`, keep bounds first and corner handles unchanged, then draw this dot only when `POINT_COUNT_TYPES.has(node.type) && !node.locked`. Multi-selection already bypasses `drawNodeSelection` at `drawSelection:167-190`, so no selected-count parameter or caller edit is needed. Allocate nothing.
6. **Interaction tests — `tests/engine/editor/point-count-control.test.ts`.** Use this nearby-verified header:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
   ```

   Use `bun:test` and `createEditor()`. Cover local/world position; zoom-compensated 8-pixel hit; polygon/star opening counts; threshold mapping; clamp 3; finite fallback; preview changes only `pointCount`; one undo/redo; cancel without undo; locked, multi-selection, ellipse and missing-node rejection. Assert `getRadiusCursorForSelection(...) === 'grab'` over the dot without editing hover code.
7. **Render tests — `tests/engine/render/canvas/selection-outline.test.ts`.** Extend the existing suite. Assert polygon and star each add one pair of `drawCircle` calls at `(width, height * 0.25)` with screen-constant radius; ellipse, locked/multi-selected and unselected cases do not. Reuse the file's mock/header.
8. **Verify.** Repeat only the single development test while editing; run final gates once; then browser-check.

## Acceptance Criteria

- [ ] Sole selected unlocked polygon/star shows exactly one point-count dot at the specified edge location; invalid states show none.
- [ ] Hover is `grab`, active drag uses existing `grabbing`, and the 8-screen-pixel target does not steal neighbouring controls.
- [ ] Horizontal dragging changes count by one per 12 screen pixels at zoom 0.5, 1 and 2; count never drops below 3.
- [ ] Polygon count controls edges and star count controls outer points; live redraw needs no schema/renderer/codec edit.
- [ ] Mouse-up creates one `Adjust point count` transaction; undo/redo and Escape behave exactly as specified.
- [ ] Existing radius and selection-overlay tests remain green.
- [ ] No CanvasKit/WASM allocation is added; only renderer-owned paints are reused.
- [ ] Only Allowed Changes files differ and all gates pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bun test tests/engine/editor/point-count-control.test.ts
```

### Final pre-completion gates — run once

```powershell
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json
bunx oxlint -c oxlint.json packages/vue/src/shared/input/types.ts packages/vue/src/shared/input/radius.ts packages/core/src/canvas/overlays/selection.ts tests/engine/editor/point-count-control.test.ts tests/engine/render/canvas/selection-outline.test.ts
bun test tests/engine/editor/point-count-control.test.ts tests/engine/editor/corner-radius-controls.test.ts tests/engine/vue/input/radius-cursor.test.ts tests/engine/render/canvas/selection-outline.test.ts
```

Expected: zero failures. Do not run umbrella checks, builds or installs.

## Integration or Installed-Result Check

After source gates, run `bun run dev` and browser-check:

1. Draw triangle/polygon and star; confirm one constant-screen-size white dot at the specified edge.
2. Hover (`grab`) and drag right/left at zoom 0.5, 1 and 2; confirm even screen-space count steps and correct visible edges/outer points.
3. Clamp at 3; rotate the node and confirm horizontal screen dragging still works while the dot remains attached.
4. Release once, undo/redo once, then start another drag and Escape; verify one history item and cancel restoration.
5. Lock, multi-select and select an ellipse; confirm the dot disappears and existing resize/rotation/radius controls remain normal.

Browser proof is sufficient. Do not build or install desktop.

## Stop Conditions

- Stop if any external caller inspects old `DragRadius.corner` or a specific `CornerPosition` result.
- Stop if T-050b2 is implemented and its branch cannot be preserved by a straightforward union merge.
- Stop if the dot overlaps another target at the fixed location in browser; report node size, zoom and competitor instead of silently moving it.
- Stop if live preview needs a renderer, schema, codec or scene-graph change.
- Stop if one drag creates multiple undo entries, Escape fails to restore, or non-finite input reaches geometry.
- Stop if a new CanvasKit allocation, animation subsystem, dependency, global CSS, store, command or out-of-scope file is needed.

## Execution Report Contract

Return changed files; exact pass/fail counts for every gate; browser observations covering node types, zoom, rotation, clamp, history, Escape, lock and multi-selection; confirmation that scene graph/codecs/render paths/package versions/generated files were untouched; and any drift or remaining gap, especially the deferred badge and vertex morph.

Do not claim implementation completion when any gate or browser check is missing.

## Status record

2026-08-22 07:26 Africa/Johannesburg — Revision 2 completed from the exported session after both prior expansion agents hit their session limit before writing. Verified the live model, geometry, shared input lifecycle, overlay paints, tests and scripts; fixed placement, mapping, numeric bounds, history semantics, animation deferral and the T-050b2 shared-seam rule. Packet state: Ready. `App/` and `Plan/plan.md` remained untouched.
