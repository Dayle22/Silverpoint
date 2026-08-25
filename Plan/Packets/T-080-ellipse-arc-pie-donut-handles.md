# T-080 - Ellipse arc, pie and donut drag handles

Task ID: T-080
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-062 (selection outline); T-079 (point-count handle); T-050b2 (vertex-radius handle)
Prepared from: the user's Figma ellipse-handle reference screenshots, captured in revision 1 on 2026-08-22
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: `App/AGENTS.md`; `Plan/endgoal.md`; `Plan/plan.md`; `Plan/PACKET-EXPANSION-BRIEF.md`; T-061, T-035, T-079 and the bounded live seams below
Delivery: named source gates + browser check
Execution size: 3 core implementation files; 1 new input test plus 1 existing CanvasKit render test across 2 suites. One responsibility; below the five-file ceiling. No Properties-panel slice.

## Intended Outcome

A sole selected, unlocked `ELLIPSE` has three CanvasKit drag targets: outer end to create/change a pie sweep, outer start once the sweep is not full-circle, and a centre inner-radius target to create/change a full or partial donut. Controls reuse the existing `type: 'radius'` lifecycle, so hover, preview, one undo and Escape cancellation match existing radius controls. No model, renderer, `.fig`, SVG, DOM or Properties work is required.

## Request Coverage

> "Add on-canvas drag handles exposing the already-modelled/rendered `arcData` (sweep angle, inner radius)."

- Covered: pie, full/partial donut, live drag, history and cancellation for selected ellipses.
- Deferred: editable Properties fields, convert/reset action, value badges, precision modifiers and literal screenshot replication. Those are separate DOM/product work.

## Verified Starting State

| Path | Symbol / span | Binding fact |
| --- | --- | --- |
| `packages/scene-graph/src/types.ts` | `ArcData`, 269-273; `SceneNode.arcData`, 448 | Stored contract is `{ startingAngle: number; endingAngle: number; innerRadius: number } | null`; angles are radians. |
| `packages/scene-graph/src/node-defaults.ts` | base defaults, 163 | New ellipses have `arcData: null`. |
| `packages/core/src/canvas/fills.ts` | `makeArcPath`, 521-557; `drawArc`, 560-565 | Renderer maps `0` to east and positive angles clockwise, regards `abs(end-start) >= 359.99°` as full circle, and deletes temporary paths. Do not edit it. |
| `packages/core/src/canvas/strokes.ts` | `ELLIPSE` branch, 238-247 | Stroke rendering already calls `drawArc` when `arcData` exists. |
| `packages/core/src/canvas/boolean.ts` | `baseShapePath`, 76-83 | Boolean outlines already call `makeArcPath` for an arc ellipse. |
| `packages/core/src/io/formats/svg/paths.ts` | `arcPath`, 169-202 | SVG export already uses the same radian angles and inner-radius model. |
| `packages/vue/src/shared/input/types.ts` | `DragRadius`, 94-109; `DragState`, 199-217 | External dispatch uses only `type: 'radius'`; add an internal ellipse-arc union member, not a top-level drag kind. |
| `packages/vue/src/shared/input/radius.ts` | hit/start/apply/commit/cancel, 152-191 and 279-365 | Established sole-selection/locked gate, scaled hit testing, preview, restore-then-undo and Escape seam; it already supports internal radius-handle types. |
| `packages/vue/src/shared/input/select.ts` | `handleSelectDown`, 45-73 | A truthy `tryStartRadius()` result is opaque; no caller edit is needed. |
| `packages/vue/src/shared/input/select/hover.ts` | cursor, 60-79 and 128-146 | Any truthy radius hit returns `grab`; no hover caller edit is needed. |
| `packages/vue/src/canvas/useCanvasInput.ts` | radius dispatch, 511-524, 630-664, 688-718 | Move/up/Escape dispatch only by `type === 'radius'`; retain it. |
| `packages/core/src/canvas/overlays/selection.ts` | `drawNodeSelection`, 303-328; dot paint, 287-300 | Selected overlays draw under the node transform. Reuse `r.auxFill`, `r.selectionPaint`, `r.ck.WHITE` and `4 / Math.max(r.zoom, Number.EPSILON)`; allocate no WASM wrapper. |
| `packages/core/src/constants.ts` | `HANDLE_HIT_RADIUS = 8`, 406 | Reuse the existing screen-pixel hit target. |
| `tests/engine/editor/corner-radius-controls.test.ts` | `createEditor()` lifecycle, 1-19 and 62-155 | Nearest input harness. Its `ELLIPSE ... unsupported` assertions concern corner radius and must remain. |
| `tests/engine/render/canvas/selection-outline.test.ts` | CanvasKit setup, 1-35 | Nearest overlay suite; it explicitly disposes images/surfaces. |
| `package.json` | `dev`, `check:vue`, `test:unit`, 20, 38, 43-45 | Confirms source-gate commands. There is no `check:i18n` script. |

## Read First

1. `packages/scene-graph/src/types.ts:269-273,448` and `packages/core/src/canvas/fills.ts:521-557` — exact model and angle convention.
2. `packages/vue/src/shared/input/types.ts:94-109,199-217` and `packages/vue/src/shared/input/radius.ts:152-191,279-365` — opaque drag contract and lifecycle.
3. `packages/core/src/canvas/overlays/selection.ts:287-328` — transformed selection-dot mount/paint pattern.
4. `tests/engine/editor/corner-radius-controls.test.ts:1-19,62-155` and `tests/engine/render/canvas/selection-outline.test.ts:1-35` — test/lifecycle ownership.

## Corrections to the Brief

1. The earlier finding of no `arcData` UI is still correct, but `radius.ts` now supports STAR/POLYGON vertex-radius handles. Extend its opaque internal-branch pattern, not the historical four-corners-only shape.
2. The renderer does not clamp `innerRadius` or normalise angles. UI must clamp inner radius to `[0, 0.99]`; only pointer-angle calculation is normalised.
3. Start/end points coincide for full circles. Show the end dot only in that state; it creates the first non-full sweep. Show the start dot only after the sweep is non-full.

## Fixed Decisions

1. **Keep `type: 'radius'`; add `DragEllipseArc` to `DragRadius`.** Verified callers inspect only that discriminator, keeping the scope to three core files.
2. **Handle IDs are `'arc-end'`, `'arc-start'`, `'arc-inner'`.** End and inner are visible for an unlocked selected ellipse; start is hidden for `null`/full sweep. Canvas pixels require no DOM test ID.
3. **Lazy defaults are binding.** First end drag creates `{ startingAngle: 0, endingAngle: normalise(pointerAngle), innerRadius: 0 }`. First inner drag creates `{ startingAngle: 0, endingAngle: Math.PI * 2, innerRadius: clampedRatio }`.
4. **Outer geometry follows the actual parametric ellipse.** At angle `a`, use `{ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }`. Pointer angle is `atan2((y-cy)/ry, (x-cx)/rx)` only for finite positive radii. Existing non-full drags unwrap nearest original angle; full-circle end creation uses `[0, 2π)` so it leaves full-circle state immediately.
5. **Inner geometry is centre at zero, else top-axis `{ x: cx, y: cy - ry * innerRadius }`.** Drag ratio is `Math.hypot((x-cx)/rx, (y-cy)/ry)` clamped to `[0, 0.99]`. It is transform-safe and does not collide with the outer dots.
6. **History is exact.** Store `originalArcData: ArcData | null`; preview `updateNodePreview(id, { arcData: next })`; commit restores original then calls `updateNodeWithUndo(id, { arcData: final }, 'Adjust ellipse arc')` only on structural numeric difference; cancel restores original and repaints. Always mutate complete `arcData` objects.
7. **No Properties panel.** `AppearanceSection.vue` exposes only corner/point radius and there is no arc state/control. Labels, localised strings, numeric fields and reset semantics are another responsibility.
8. **Serialise with T-079/T-050b2.** All touch `types.ts`, `radius.ts`, `selection.ts`; do not execute concurrently. Preserve landed vertex/point-count branches and stop if a clean union merge needs external-caller edits.

## Visual Contract — binding

This is CanvasKit overlay UI, not DOM UI; Tailwind, recipes, icon imports, focus classes, responsiveness and DOM test IDs do not apply.

| State | Binding appearance / behaviour |
| --- | --- |
| Plain ellipse | White, selection-stroked end dot at east `(width, height / 2)`; inner dot at local centre. |
| Pie/donut | End dot at `endingAngle`; start dot at `startingAngle` only for non-full sweep; inner dot on top radius at ratio. |
| Hover / active | Existing cursor returns `grab`; existing input path supplies `grabbing`; no animation/badge. |
| Transform / zoom | Dots draw in `withNodeBounds`; hit geometry maps through `getWorldMatrix`; circle radius is `4 / Math.max(r.zoom, Number.EPSILON)`, hit radius `HANDLE_HIT_RADIUS / zoom`. |
| Disabled | No draw/hit for locked, unselected, multi-selected, missing, non-ellipse, zero-width or zero-height nodes. |

### Banned List

- No CanvasKit `Paint`, `Path`, `Shader`, image, surface, cache or WASM allocation; reuse renderer paints.
- No literal colour, Tailwind, `tv()` recipe, global CSS, DOM control, tooltip, badge, icon or Properties field.
- No dependency, store, command, shortcut, scene field/default, codec, SVG/export, fill/stroke/boolean renderer or i18n change.
- No top-level drag type or edit to `select.ts`, `select/hover.ts`, `useCanvasInput.ts`.
- No build, install, package/version/generated-file or Git work.

## Allowed Changes

- `App/packages/vue/src/shared/input/types.ts` — add ellipse-arc union member.
- `App/packages/vue/src/shared/input/radius.ts` — pure geometry plus hit/start/apply/commit/cancel branch.
- `App/packages/core/src/canvas/overlays/selection.ts` — selected ellipse dots.
- `App/tests/engine/editor/ellipse-arc-controls.test.ts` — new focused input suite.
- `App/tests/engine/render/canvas/selection-outline.test.ts` — selected-overlay evidence only.

## Restrictions and Exclusions

- Do not touch `fills.ts`, `strokes.ts`, `boolean.ts`, SVG export, Kiwi/Figma codecs, source metadata, scene defaults or generated/dist files.
- Do not alter the existing ellipse corner-radius unsupported assertions.
- Do not add reset/removal gesture: returning to full circle/zero hole preserves equivalent visual output without discarding stored data.
- Do not allow inner radius `>= 1`, zero/non-finite dimensions, pointer values or stored values into geometry.
- If any file outside Allowed Changes, changed external caller, different UI default or renderer/model/codec work is needed, stop and report.

## Implementation Steps

1. **Pre-flight.** Reread Read First; re-grep `DragRadius`, `tryStartRadius`, `applyRadiusDrag`, `commitRadiusDrag`, `cancelRadiusDrag`, `drawNodeSelection`. Reconcile the actual T-079/T-050b2 type union. Stop if a caller now inspects an internal handle field/name.

2. **Types — `packages/vue/src/shared/input/types.ts`.** Replace the current single `DragRadius` interface with the exact two-member union below; import `ArcData` as a type from `@open-pencil/scene-graph` if absent. Preserve `CornerPosition`, `RadiusHandle` and all current fields rather than changing rectangle/star semantics:

   ```ts
   export type EllipseArcHandle = 'arc-start' | 'arc-end' | 'arc-inner'

   export interface DragCornerRadius {
     type: 'radius'
     nodeId: string
     corner: RadiusHandle
     startLocalX: number
     startLocalY: number
     direction?: Vector
     original: {
       cornerRadius: number
       topLeftRadius: number
       topRightRadius: number
       bottomRightRadius: number
       bottomLeftRadius: number
       independentCorners: boolean
     }
   }

   export interface DragEllipseArc {
     type: 'radius'
     handle: EllipseArcHandle
     nodeId: string
     originalArcData: ArcData | null
     originalAngle?: number
   }

   export type DragRadius = DragCornerRadius | DragEllipseArc
   ```

   If T-079 has landed before execution, add its member to this union unchanged. Inside `radius.ts`, narrow with `'handle' in d` and `d.handle.startsWith('arc-')`; current corner/vertex branches narrow on `'corner' in d`.

3. **Input — `packages/vue/src/shared/input/radius.ts`.** Add local constants exactly: `ELLIPSE_ARC_TYPES = new Set(['ELLIPSE'])`, `MAX_ELLIPSE_INNER_RADIUS = 0.99`, `FULL_ELLIPSE_SWEEP_EPSILON = 0.001`, `TWO_PI = Math.PI * 2`. Export:

   ```ts
   export function getEllipseArcControlLocalPoint(
     node: Pick<SceneNode, 'width' | 'height' | 'arcData'>,
     handle: EllipseArcHandle
   ): Vector | null
   export function getEllipseArcControlPosition(
     node: SceneNode, graph: SceneGraph, handle: EllipseArcHandle
   ): Vector | null
   export function calculateEllipseArcPointerAngle(
     node: Pick<SceneNode, 'width' | 'height'>, local: Vector
   ): number | null
   export function calculateEllipseInnerRadius(
     node: Pick<SceneNode, 'width' | 'height'>, local: Vector
   ): number | null
   ```

   Return `null` for invalid dimensions/fields. End uses `arcData?.endingAngle ?? 0`; start is `null` unless data exists and `abs(end-start) < TWO_PI - FULL_ELLIPSE_SWEEP_EPSILON`; inner uses Fixed Decision 5. In `hitTestRadiusControlByMatrix`, retain corner/vertex branches byte-for-byte, then test ellipse handles in priority end, start, inner with the existing scaled hit radius. In `tryStartRadius`, retain sole-selection/locked gate and add the ellipse family; snapshot exactly `DragEllipseArc`.

   In `applyRadiusDrag`, branch first for `DragEllipseArc`; map with existing `worldToNodeLocalPoint()`, then implement Fixed Decisions 3-5. A null original only permits end to create pie; inner creates the default full donut. Preview only a complete finite `ArcData`. In commit/cancel, branch first and apply Fixed Decision 6, comparing all three values with `Object.is`. Leave all non-arc maths unchanged.

4. **Overlay — `packages/core/src/canvas/overlays/selection.ts`.** Add local renderer-equivalent finite guards/full-sweep predicate and `drawEllipseArcHandles(r, canvas, node)`. Draw end, optional start, inner in Visual Contract order with:

   ```ts
   const dotRadius = 4 / Math.max(r.zoom, Number.EPSILON)
   r.auxFill.setColor(r.ck.WHITE)
   canvas.drawCircle(x, y, dotRadius, r.auxFill)
   canvas.drawCircle(x, y, dotRadius, r.selectionPaint)
   ```

   In `drawNodeSelection`, retain bounds/corner/vertex branches and add the valid **unlocked** ellipse branch. `drawSelection()` already calls this only for a sole selection; explicitly gate `!node.locked` here to meet the disabled visual contract. Do not cross-import `@open-pencil/vue` or allocate a path.

5. **Input test — create `tests/engine/editor/ellipse-arc-controls.test.ts`.** Use the verified engine-test header:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
   ```

   Use `bun:test`, `createEditor()` and the helpers. Cover plain end/inner points; existing partial arc outer points; rotated/world mapping; scaled 8px hit; lazy pie/donut creation; opposite-end preservation; 0/0.99 clamp; malformed/zero/missing/locked/multi/non-ellipse rejection; complete-data preview; one undo/redo; Escape restoration; and `getRadiusCursorForSelection() === 'grab'` at visible dots without hover edits.

6. **Overlay test — `tests/engine/render/canvas/selection-outline.test.ts`.** Extend the CanvasKit suite, retaining explicit image/surface deletion. Render selected plain ellipse, partial pie and partial donut. Assert selection-coloured dot evidence at required locations; absence of start dot for full circle and presence for partial arc; no dots for invalid-size/malformed ellipses; no fill/export/codec assertions.

7. **Verify.** Repeat only the input test while editing, then run final gates once and browser-check. No umbrella commands/builds/installs.

## Acceptance Criteria

- [ ] Selected unlocked plain ellipse exposes east end and centre inner dots; they create pie and full donut directly.
- [ ] Non-full arc exposes independently draggable start/end plus inner; full circle hides ambiguous start dot.
- [ ] Positions, hits and values remain correct after rotation, nesting and zoom; angles follow renderer radians/east/clockwise convention.
- [ ] Inner radius remains finite in `[0, 0.99]`; invalid geometry is neither drawn nor hit.
- [ ] Preview writes complete `arcData`; release yields one `Adjust ellipse arc` history action; undo/redo/Escape restore exact state.
- [ ] Existing corner/vertex radius, selection, renderer, SVG and `.fig` paths remain untouched.
- [ ] No CanvasKit allocation, DOM UI, dependency, codec, scene-model or out-of-scope file is introduced.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bun test tests/engine/editor/ellipse-arc-controls.test.ts
```

### Final pre-completion gates — run once

```powershell
bunx tsgo --noEmit
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json
bunx oxlint -c oxlint.json packages/vue/src/shared/input/types.ts packages/vue/src/shared/input/radius.ts packages/core/src/canvas/overlays/selection.ts tests/engine/editor/ellipse-arc-controls.test.ts tests/engine/render/canvas/selection-outline.test.ts
bun test tests/engine/editor/ellipse-arc-controls.test.ts tests/engine/editor/corner-radius-controls.test.ts tests/engine/vue/input/radius-cursor.test.ts tests/engine/render/canvas/selection-outline.test.ts
```

Expected: zero failures and zero lint errors. Do not run `bun run check`, `bun run test`, `bun run test:unit`, builds, installs or package-manager commands.

## Integration or Installed-Result Check

After source gates, run `bun run dev` and browser-check at default zoom and 0.5/2 zoom:

1. Draw/select ellipse; verify east/centre dots and `grab`; drag end clockwise for pie and inner outward for donut.
2. Drag both outer dots of a partial arc; rotate and nest ellipse; verify attachment and opposite-end preservation.
3. Return to full circle/zero hole; verify start-dot visibility, undo/redo once and Escape a second drag.
4. Lock it, multi-select it and select zero-size/malformed test ellipse if available; confirm no control steals resize/selection.

Browser proof is sufficient. Do not build or install desktop.

## Stop Conditions

- External caller examines an internal `DragRadius` member and needs edits outside Allowed Changes.
- T-079/T-050b2 cannot be union-merged cleanly in the shared files.
- Renderer/model/codec/export modification, DOM UI, dependency or global state is required.
- Full-circle end cannot leave full state, fixed handle visibility is ambiguous, or one drag creates multiple history entries.
- Invalid geometry reaches canvas drawing or a required gate fails.

## Execution Report Contract

Report changed files; exact exit result for every gate; browser observations for plain/pie/donut, partial/full, zoom, rotation/nesting, lock/multi, undo/redo/Escape; confirmation renderer/model/codecs/version/generated files are untouched; exact T-079/T-050b2 reconciliation; and remaining product gaps (Properties/reset/badge).

## Status record

2026-08-24 Africa/Johannesburg — Revision 2 expanded against current model, renderer, shared input lifecycle, selection overlay, test seams and scripts. The earlier no-`arcData`-UI finding remains correct. This packet makes only CanvasKit controls executable; Properties fields and floating feedback remain deferred. `App/` and `Plan/plan.md` were not modified.
