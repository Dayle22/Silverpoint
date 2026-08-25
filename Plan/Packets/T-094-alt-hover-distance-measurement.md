# T-094 - Alt-hover distance measurement

Task ID: T-094
Packet state: Scope map — execute T-094a, then T-094b
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-010 (Done)
Related: T-017 (document units), T-093 (canvas input), T-095 (snap work; no dependency)
Prepared from: the 2026-08-24 upstream comparison request, re-expanded against the live App source
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: `App/packages/core/src/{editor,canvas,units}/`, `App/packages/vue/src/{canvas,shared/input}/`, `App/tests/{engine,e2e}/`, `App/package.json`, and `App/playwright.config.ts`
Delivery: named source gates + browser check
Execution size: 10 core implementation files; 2 test files across 2 suites. This violates the expansion ceiling, so this parent is a scope map, not an executable Ready packet.

## Intended Outcome

With a non-empty selection, holding Alt while hovering a different selectable layer draws temporary Figma-style horizontal and/or vertical distance readouts between their axis-aligned bounds. Releasing Alt, leaving the layer, starting a drag, switching away from Select, or clearing selection removes the overlay. It never mutates the document or undo history.

## Request Coverage

> Draw temporary Figma-style distance readouts between the selection and an Alt-hovered layer.

The first delivery covers separate, unrotated selected and target bounds; labels honour the active document unit. It deliberately excludes overlap, containment, transformed bounds, a persistent measure tool, preferences, and snapping changes.

## Verified Starting State

| Path | Symbol / span | Binding finding |
| --- | --- | --- |
| `App/packages/vue/src/canvas/useCanvasInput.ts` | `handleSelectHover` 90-103; `onMouseMove` 527-541 | Select-mode pointer hover already owns the cursor, auto-layout hover, and ordinary layer hover. It receives `MouseEvent.altKey`, but has no key-release route for an Alt-only transition. |
| `App/packages/vue/src/shared/input/select/hover.ts` | `updateHoveredNode` 112-126; `updateHoverCursor` 128-146 | `editor.state.hoveredNodeId` is the current non-selected target after the normal scoped hit test. Reuse this target; do not create another hit-test system. |
| `App/packages/core/src/editor/selection/overlays.ts` | `setHoveredNode` 22-26; `setAutoLayoutHover` 40-52 | Transient overlay state has a setter that performs equality suppression and calls `ctx.requestRepaint()`. The new measurement state needs the same ownership and repaint contract. |
| `App/packages/core/src/editor/types.ts` | `EditorState` 40-130 | `EditorState` contains `hoveredNodeId`, `autoLayoutHover`, and `documentUnits`; it has no modifier-held measurement state. |
| `App/packages/core/src/editor/state.ts` | `createDefaultEditorState` 7-39 | All transient editor state is initialised here; it must initialise the new field to `null`. |
| `App/packages/core/src/canvas/renderer/types.ts` | `RenderOverlays` 15-85 | Renderer overlays already carry nullable hover/edit state. Add the exact measurement payload here. |
| `App/packages/core/src/canvas/renderer/pipeline.ts` | `renderFromEditorState` 34-102; overlay draw order 239-283 | State is copied into `RenderOverlays` at 60-98 and screen-space overlays are painted after selection and snap guides. The measurement draw belongs immediately after `drawSnapGuides`, before marquee/handles. |
| `App/packages/core/src/canvas/renderer.ts` | declared overlay methods 218-301 | Every renderer overlay needs a declared method. |
| `App/packages/core/src/canvas/renderer/methods.ts` | overlay delegates 82-120 | Renderer methods delegate to the `Overlays` barrel; add the matching forwarding method only. |
| `App/packages/core/src/canvas/overlays/index.ts` | barrel 1-19 | One named re-export registers a new overlay draw module. |
| `App/packages/core/src/canvas/overlays/feedback.ts` | `drawSnapGuides` 18-58 | Existing screen-space guide conversion is `world * r.zoom + r.panX/Y`, using `r.snapPaint`. Measurements must use the same conversion but not modify snap guides or their paint. |
| `App/packages/core/src/canvas/rulers.ts` | `drawRulerBadge` 211-259; `rulerLabel` 295-300 | The established small label primitive measures glyph widths and uses `r.selColor()` / `r.rulerLabelPaint`. Reuse this helper for measurement labels rather than guessing fixed text width. |
| `App/packages/core/src/units/index.ts` | `formatUnitValue` 28-36 | The active unit formatter supports `px`, `mm`, `cm`, and `in` only. It rounds px to integers and other values to two decimals, and returns no suffix. |
| `App/packages/scene-graph/src/geometry.ts` | `computeAbsoluteBounds` 183-193 | This is the correct absolute, nested-node-safe rectangle union for the first slice. |
| `App/packages/scene-graph/src/snap.ts` | `computeSelectionBounds` 209-223 | This uses each node's local `x`/`y`; it is correct only after callers normalise positions (as `move-snap.ts` 93-130 does). It must not be used for ordinary nested selection measurement. |
| `App/tests/engine/vue/input/auto-layout-hover.test.ts` | 1-113 | Nearby engine input tests use `bun:test` with no `@ts-nocheck` header. |
| `App/tests/e2e/canvas/frame-overlays.spec.ts` | fixture 1-9; state setup 11-75 | The closest visual overlay test uses `useEditorSetupWithClear`, `?test&no-chrome&no-rulers`, direct test-only store setup, canvas snapshots, and `assertNoErrors()`. |
| `App/package.json` | scripts 19-46 | `dev`, `bunx tsgo --noEmit`, `bunx vue-tsc --noEmit -p tsconfig.json`, `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json`, direct `bunx oxlint`, direct `bun test`, and direct Playwright are available. Umbrella `check` / `test` / `test:unit` are prohibited for this packet. |

## Corrections to the Brief

1. `computeSelectionBounds` is not a reusable absolute-selection helper. It works over local node coordinates, and only `move-snap.ts` makes that safe by normalising its temporary nodes. T-094 must use `computeAbsoluteBounds(nodes, graph.getAbsolutePosition)` for unrotated nodes.
2. The current document-unit model does not support points. The first slice can truthfully label `px`, `mm`, `cm`, and `in`; it cannot promise points without expanding T-017's public unit model.
3. The source has no `measurement.ts`, no measurement state, and no Alt-hover keyboard-release handling. This is not an overlay-only change.

## Fixed Decisions

1. The exact transient state is `distanceMeasurement: { targetId: string } | null`; it contains no duplicated selection IDs because render receives the authoritative `selectedIds` set. Its setter is `setDistanceMeasurement(measurement: EditorState['distanceMeasurement']): void`, equality-checks `targetId`, assigns state, then calls `requestRepaint()`.
2. The Vue input route only sets that state when `activeTool === 'SELECT'`, `event.altKey`, `selectedIds.size > 0`, and the existing `hoveredNodeId` is non-null and not selected. It clears it in all other hover states, at `mouseleave`, before `mousedown`, and on `window` `keyup` for `Alt`. It must not change `updateHoverCursor`, Alt-drag duplication in `shared/input/select.ts:93`, Pen modifiers, or Shape Builder delete mode.
3. The renderer payload is exactly `distanceMeasurement?: { targetId: string } | null`. `renderFromEditorState` passes it through unchanged; no serialisation, document mutation, undo transaction, store persistence, or new command is permitted.
4. Geometry is axis-aligned and only supports nodes whose `rotation === 0`. Resolve selected nodes from `selectedIds`, target from `targetId`, and return no readout if any is missing, invisible, selected, or rotated. Use `computeAbsoluteBounds` for the selection union and target rectangle.
5. For two disjoint rectangles, emit horizontal measurement iff `selection.right < target.left` or `target.right < selection.left`, and vertical measurement iff `selection.bottom < target.top` or `target.bottom < selection.top`. Each measurement contains the positive edge-to-edge gap and a line spanning the overlap midpoint on the other axis. If either axis overlaps or contains, emit only the non-overlapping axis; if both overlap/contain, emit none. Never use centre-to-centre distances.
6. The draw module formats its label as `${formatUnitValue(distance, r.documentUnits)} ${r.documentUnits.unit}`. Thus `25` px reads `25 px` and non-pixel measurements retain the formatter's two-decimal limit. Draw labels with `drawRulerBadge` so glyph measurement, selection colour, and label paint match rulers.
7. Draw the measurement's extension lines, dimension line, end ticks, and label in screen space using `r.auxStroke` with `setStrokeWidth(1)` and `setColor(r.selColor())`; reset `setPathEffect(null)` before return. Do not allocate `Path`, `Paint`, `Font`, `Image`, shader, surface, or cache objects. There is consequently no CanvasKit ownership or `.delete()` obligation.

## Required split

The parent must create two child packet files and index them before implementation. Do not execute this parent.

| Child | Depends on | Core files / suite | Bounded responsibility |
| --- | --- | --- | --- |
| `T-094a` — distance measurement state and renderer | none | `packages/core/src/editor/{types.ts,state.ts,selection/overlays.ts}`, `packages/core/src/canvas/{renderer/types.ts,renderer/pipeline.ts,renderer.ts,renderer/methods.ts,overlays/index.ts,overlays/measurement.ts}`; `tests/engine/render/canvas/measurement.test.ts` | Define the state/payload, pure unrotated separation geometry, screen-space draw, units, and headless proof. It compiles and remains visually inert until b sets state. |
| `T-094b` — Alt-hover measurement input and browser proof | T-094a | `packages/vue/src/canvas/useCanvasInput.ts`; `tests/engine/vue/input/distance-measurement.test.ts`; `tests/e2e/canvas/distance-measurement.spec.ts` | Consume normal hover + Alt transitions, clear reliably, and prove the visible browser behaviour. |

## Child execution contracts

### T-094a — state and renderer

Allowed changes are only the nine files named above. `measurement.ts` exports:

```ts
export interface DistanceMeasurement {
  horizontal?: { from: number; to: number; position: number; distance: number }
  vertical?: { from: number; to: number; position: number; distance: number }
}
export function resolveDistanceMeasurement(
  graph: SceneGraph,
  selectedIds: Set<string>,
  targetId: string
): DistanceMeasurement | null
export function drawDistanceMeasurement(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  measurement?: RenderOverlays['distanceMeasurement']
): void
```

Use `computeAbsoluteBounds` and the fixed geometry rules above. `drawDistanceMeasurement` resolves fresh graph nodes on every paint; it must not cache bounds. Add the renderer declaration/delegate/barrel export and invoke it in `pipeline.ts` immediately after `drawSnapGuides(canvas, overlays.snapGuides)`. The engine test must verify: right-hand horizontal gap, below vertical gap, diagonal gap yields both labels, overlapping and containing pairs yield none, a selected target yields none, a rotated node yields none, nested selected nodes resolve from absolute positions, and `mm` output carries `mm`. Follow `tests/engine/vue/input/auto-layout-hover.test.ts`'s plain `bun:test` header convention (no suppression header).

### T-094b — input and browser proof

Allowed source change is only `packages/vue/src/canvas/useCanvasInput.ts`; do not modify selection hit testing or any modifier consumer. Add a small local `updateDistanceMeasurement(altKey: boolean): void` in the composable and call it after `handleSelectHover(...)` in the no-drag `onMouseMove` branch. It reads `editor.state.hoveredNodeId`, applies Fixed Decision 2, and calls the new `editor.setDistanceMeasurement(...)`. Add `useEventListener(window, 'keyup', ...)` that clears only on `event.key === 'Alt'`; clear on the existing canvas `mouseleave` callback and at the start of `onMouseDown`. Do not alter existing event listener disposal: VueUse owns it.

`tests/engine/vue/input/distance-measurement.test.ts` tests the extracted resolver, not DOM input; keep it in the existing `tests/engine/vue/input/` style with plain `bun:test` imports and no suppression header. To keep `useCanvasInput.ts` under the 260-composition-root lint limit, extract the resolver into `packages/vue/src/shared/input/distance-measurement.ts` only if the live file would otherwise cross that limit; if extracted, include that file in the child size and remove the test-only implementation route.

`tests/e2e/canvas/distance-measurement.spec.ts` must start with exactly:

```ts
// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
```

Follow `frame-overlays.spec.ts`: make two unrotated rectangles with a 40 px horizontal gap, select one, hold `Alt`, hover the other, wait for render, snapshot the canvas, release `Alt`, wait for render, snapshot again, and assert the buffers differ. Also prove: no overlay before Alt, no overlay after release, no overlay over the selected rectangle, and no browser errors. Do not run this visual Alt test on Linux: add the same `test.skip(process.platform === 'linux', ...)` guard used by `tests/e2e/snap/guides.spec.ts:38-40`, because CI's X11 Alt handling is already known to interfere.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one must stop and report.

- Do not modify `computeSnap`, `computeSelectionBounds`, `move-snap.ts`, snap thresholds, or `drawSnapGuides`.
- Do not modify Alt-drag duplication (`packages/vue/src/shared/input/select.ts:93`), Pen/node-edit/Shape Builder modifier semantics, cursor rules, document/plugin data, undo, preferences, panel/persona state, or storage versions.
- Do not add points support; use only existing `px`/`mm`/`cm`/`in` units.
- Do not support rotations, overlap, containment, transformed parent bounds, persistent measurements, toolbar controls, or accessibility DOM controls in these children.
- Do not introduce dependencies, global CSS, Vue components, CanvasKit allocations/caches, Git work, package changes, builds, installs, desktop checks, or version bumps.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, builds, installs, or snapshot updates.

## Verification

For T-094a, repeat during development:

```powershell
cd App
bun test tests/engine/render/canvas/measurement.test.ts
```

For T-094b, repeat during development:

```powershell
cd App
bun test tests/engine/vue/input/distance-measurement.test.ts
```

Final pre-completion gates, once after both children land:

```powershell
cd App
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false
bunx oxlint -c oxlint.json packages/core/src/editor/types.ts packages/core/src/editor/state.ts packages/core/src/editor/selection/overlays.ts packages/core/src/canvas/renderer/types.ts packages/core/src/canvas/renderer/pipeline.ts packages/core/src/canvas/renderer.ts packages/core/src/canvas/renderer/methods.ts packages/core/src/canvas/overlays/index.ts packages/core/src/canvas/overlays/measurement.ts packages/vue/src/canvas/useCanvasInput.ts tests/engine/render/canvas/measurement.test.ts tests/engine/vue/input/distance-measurement.test.ts tests/e2e/canvas/distance-measurement.spec.ts
bun test tests/engine/render/canvas/measurement.test.ts tests/engine/vue/input/distance-measurement.test.ts
bunx playwright test tests/e2e/canvas/distance-measurement.spec.ts --project=openpencil
```

## Integration or Installed-Result Check

After source gates, run `cd App && bun run dev`. In a browser at desktop viewport, create two unrotated rectangles separated by 40 px, select one, hold Alt and hover the other: a `40 px` horizontal annotation appears; release Alt without moving the pointer and it disappears. Change the document unit to mm, repeat, and observe a numeric `mm` label. Confirm Alt-drag still duplicates the selected rectangle and ordinary hover highlighting remains. Browser proof only; no desktop build/install is authorised.

## Stop Conditions

- Stop if `hoveredNodeId` is not stable through Alt keydown/keyup in the live browser; do not add another canvas hit-testing route.
- Stop if the state/render plumbing expands beyond the T-094a files or the input change exceeds T-094b's single responsibility; split again rather than folding adjacent canvas work in.
- Stop if the required line/tick placement cannot be drawn using existing paints/fonts without a CanvasKit allocation; report the missing shared primitive.
- Stop if an unrotated nested target produces non-absolute bounds; do not fall back to `computeSelectionBounds`.

## Execution Report Contract

Report child ID, changed files, the exact geometry cases tested, type/lint/test exit codes, browser observations (including Alt release without pointer movement), unsupported cases deliberately retained, and any drift from the anchors above. Do not mark T-094 complete; parent-plan status remains the only authority.

## Status record

2026-08-24 — Revision 2 expanded against live source. It is intentionally not Ready: the verified implementation touches ten core files plus engine and E2E suites, crossing the binding expansion ceiling. Parent planning must create and index T-094a then T-094b before any application work.
