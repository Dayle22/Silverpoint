# T-024 - Pro-grade pen tool, path editing, and canvas handle affordances

Task ID: T-024
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: T-004 (Done)
Related: T-011/T-012/T-013 (vector consumers of the same network), T-040/T-041 (cursor packets that must not collide with the cursor work here), T-038 selection-outline-fidelity (shares the overlay paints)
Supersedes: revision 1 (expanded 2026-07-24). Revision 1 is void - it targeted version `0.6.7`, required a per-packet NSIS build, and listed capabilities as "to implement" that already exist. Do not carry any instruction from it.

## Intended Outcome

The pen tool and the vector node editor behave the way a professional vector application behaves, so that drawing a path stops feeling like a prototype. Concretely:

- Every anchor, handle and hit target has the same size on screen at every zoom level, and is large enough to hit without aiming.
- Shift constrains, Alt breaks, Ctrl/Cmd continues, Space repositions - and each one is discoverable because the cursor and the preview say what will happen before the click.
- Closing a path, continuing an open path, and inserting a vertex on a segment each have their own cursor and their own hover affordance, instead of one undifferentiated crosshair.
- Node editing supports marquee selection over vertices and an explicit Sharp / Smooth / Disjoint control, rather than only per-vertex clicking and an invisible Alt gesture.

This is a feel-and-precision packet. It does not change the vector network format, the `.fig` encoding, or what a finished path renders as.

## Verified Starting State

Read from the working tree on 2026-08-14. Line numbers are from that read - re-check them before editing; the named functions and constants are the stable anchors.

App version is `0.6.29` (`App/package.json`). Revision 1's `0.6.7` version bump is obsolete and must not be performed - see Restrictions.

### A. What already exists and works - do not rebuild it

| Capability | Where |
| --- | --- |
| Pen state machine (`penAddVertex`, `penSetDragTangent`, `penSetClosingToFirst`, `penSetPendingClose`, `penSetKnotPosition`, `penCommit`, `penCancel`) | `packages/core/src/editor/shapes/pen.ts:62-236` |
| Mirroring assignment during drag (`ANGLE`, `NONE`, `ANGLE_AND_LENGTH`) | `packages/core/src/editor/shapes/pen.ts:117-125` |
| Rubberband + live cubic preview, tangent handle rendering, close-radius boost | `packages/core/src/canvas/pen-overlay.ts:50-193` |
| Space-drag knot repositioning, Ctrl/Cmd `continuous` and Alt `independent` tangent modes | `packages/vue/src/canvas/pen-input/drag.ts:31-146` |
| Resume drawing from an open endpoint (`penResumeFromEndpoint`, `penResumeOnPath`, chain walking) | `src/app/editor/pen/create.ts:21-57`, `src/app/editor/pen/resume.ts` |
| Node-edit vertex/handle hit testing, selection, handle drag, bend handles | `packages/vue/src/shared/input/node-edit/index.ts`, `.../hit-test.ts`, `packages/vue/src/canvas/node-edit-input/{use,bend}.ts` |
| `nodeEditAddVertex`, `nodeEditRemoveVertex`, `nodeEditConnectEndpoints` | `src/app/editor/vector-edit/network.ts:42-95` |
| Delete/Backspace, Alt+Delete break, Enter commit, Escape routing | `src/app/shell/keyboard/actions.ts:22-62` |
| Vector network geometry helpers (`splitSegmentAt`, `breakAtVertex`, `deleteVertex`, `removeVertex`, `mirrorHandle`, `findOppositeHandle`) | `packages/core/src/vector/bezier.ts` |
| A generic marquee drag type, its state and its overlay | `packages/vue/src/shared/input/types.ts:68`, `packages/core/src/editor/selection/overlays.ts:8`, `packages/core/src/canvas/overlays/feedback.ts:63-69` |

The pen tool is registered with shortcut `P` and a flyout of `PEN`/`PENCIL`/`BRUSH` at `packages/core/src/editor/tool-registry.ts:10-22`.

### B. Confirmed gaps - this is the work

1. **The close target is zoom-dependent.** `packages/vue/src/canvas/pen-input/use.ts:33` and `:57` compare a canvas-space distance against `PEN_CLOSE_THRESHOLD` (`8`) with no division by zoom. Node editing does divide (`hit-test.ts:34-38`, `iz = 1 / editor.state.zoom`). Result: at 25% zoom the close target is 2 screen pixels; at 400% it is 32 and swallows nearby clicks. This is the single largest "feels broken" defect in the tool.
2. **The drag dead zone is zoom-dependent too.** `drag.ts:141` returns early while `Math.hypot(tx, ty) <= 2` in canvas units. At high zoom this means handles refuse to start; at low zoom a click becomes an accidental curve.
3. **No Shift constraint exists in the pen.** `getModifierMode` (`drag.ts:69-73`) maps meta/ctrl → `continuous`, alt → `independent`, everything else → `default`. `grep -n shiftKey packages/vue/src/canvas/pen-input/` returns nothing. There is no 45-degree anchor placement constraint and no 45-degree handle constraint.
4. **There is one pen cursor.** `cursorOverride.value = 'crosshair'` at `use.ts:37` and `:45` are the only pen cursor writes in the whole package (`grep -n "cursorOverride.value" packages/vue/src`). No close, continue, or insert affordance is signalled.
5. **In node-edit mode the pen inserts a vertex on any empty click.** `handlePenNodeEditDown` (`packages/vue/src/shared/input/node-edit/index.ts:119-139`) hit-tests vertices, then falls through to `nodeEditAddVertex(cx, cy)` unconditionally. There is no segment hit test and no hover indication, so a click meant to deselect silently mutates the path.
6. **No marquee vertex selection.** `handleNodeEditDown` (`index.ts:116`) calls `exitNodeEditMode(true)` when the click misses a vertex or handle. Empty-space drag in node edit does nothing.
7. **No handle-mirroring control.** `handle-actions.ts:61` sets `handleMirroring = 'NONE'` when a drag breaks mirroring. Nothing in `src/components/properties/**` exposes Sharp/Smooth/Disjoint, and there is no keyboard route to it.
8. **No test coverage.** `tests/e2e/tools/` contains only `section.spec.ts`. `tests/engine/vector/` contains `bounds`, `centerline`, `normalize`, `validate` and `blob/` - no pen-action and no node-edit tests.

### C. Handle and hit-target sizes - the reported "too small"

Everything below is already resolved to screen pixels at draw time except where marked. `pen-overlay.ts` and `node-edit-overlay.ts` convert to screen space via `toScreen` before drawing, so their radii are screen pixels and are already zoom-independent; the selection overlay divides by `r.zoom` for the same effect.

| Constant | Current | Declared at | Effective size | Used by |
| --- | --- | --- | --- | --- |
| `PEN_VERTEX_RADIUS` | `3` | `packages/core/src/constants.ts:60` | 6 px circle | pen anchors (`pen-overlay.ts:187-192`), node-edit vertices (`node-edit-overlay.ts:456-466`) |
| `PEN_HANDLE_RADIUS` | `2.5` | `constants.ts:59` | 5 px circle / 5 px diamond | pen tangent points (`pen-overlay.ts:120-121`), node-edit handle diamonds (`node-edit-overlay.ts:426-436`) |
| `PEN_CLOSE_RADIUS_BOOST` | `2` | `constants.ts:61` | +4 px on the closing anchor | `pen-overlay.ts:189` |
| `HANDLE_HALF_SIZE` | `3` | `constants.ts:71` | 6x6 px selection handles | `overlays/selection.ts:350-365` |
| `HANDLE_HIT_RADIUS` | `6` | `constants.ts:392` | 6 px (divided by zoom at use) | transform handles `shared/input/geometry.ts:178,216,231`, radius handle `shared/input/radius.ts:80`, progressive-blur handle `shared/input/progressive-blur.ts:58` |
| `NODE_HIT_THRESHOLD` | `8` | `shared/input/node-edit/hit-test.ts:20` | 8 px | node-edit vertex hit test |
| `HANDLE_HIT_THRESHOLD_NE` | `6` | `hit-test.ts:21` | 6 px | node-edit handle hit test |
| `PEN_CLOSE_THRESHOLD` | `8` | `constants.ts:389` | **canvas units - defect, see B1** | pen close detection |

A 5-6 px affordance is roughly half what Figma, Illustrator and Affinity present. That is the whole of the user's complaint, and it applies to every on-canvas handle, not only the pen's.

**Dead duplicates.** `src/constants.ts:109-115` re-declares `PEN_CLOSE_THRESHOLD = 8`, `ROTATION_SNAP_DEGREES`, `CORNER_ROTATE_ZONE` and `HANDLE_HIT_RADIUS = 6`, plus `HANDLE_SIZE = 6` at line 98 - separate declarations, not re-exports (the re-export block at `src/constants.ts:4-62` does not include these names). `grep -rn "from '@/constants'" src/ packages/` shows no consumer imports any of them. They are dead, and they will mislead the next reader if the core values move without them.

## Fixed Decisions

Binding. These are the answers; do not re-derive them.

1. **One sizing pass, applied at the constants, in screen pixels.** New values:
   - `PEN_VERTEX_RADIUS`: `3` → `4` (8 px anchors)
   - `PEN_HANDLE_RADIUS`: `2.5` → `3.5` (7 px handle points and diamonds)
   - `PEN_CLOSE_RADIUS_BOOST`: `2` → `2.5`
   - `HANDLE_HALF_SIZE`: `3` → `4` (8x8 selection handles)
   - `HANDLE_HIT_RADIUS`: `6` → `8`
   - `NODE_HIT_THRESHOLD`: `8` → `10`
   - `HANDLE_HIT_THRESHOLD_NE`: `6` → `9`
   Hit radii stay strictly larger than the drawn radius they correspond to, so a target is always easier to hit than it looks. Do not introduce a scale factor, a preference, or a per-tool override; do not touch `CORNER_ROTATE_ZONE` (`16`), which is a zone, not a handle.
2. **`PEN_CLOSE_THRESHOLD` becomes a screen-pixel threshold, value `10`, divided by zoom at both use sites.** `use.ts:33` and `use.ts:57` become `dist < PEN_CLOSE_THRESHOLD / editor.state.zoom`. Match `hit-test.ts` exactly: compute `const iz = 1 / editor.state.zoom` once per call.
3. **The drag dead zone becomes screen-space, value `3`.** `drag.ts:141` becomes a comparison against `PEN_DRAG_DEAD_ZONE / editor.state.zoom`, with `PEN_DRAG_DEAD_ZONE = 3` added to `packages/core/src/constants.ts` beside the other pen constants.
4. **Shift is a constraint modifier and never a selection modifier in the pen.**
   - Shift while placing an anchor snaps the new anchor to the nearest 45-degree ray from the previous anchor.
   - Shift while dragging a tangent snaps the tangent direction to the nearest 45 degrees, preserving its length.
   - Both use a shared helper `constrainToAngleStep(dx, dy, stepDegrees)` added to `packages/core/src/vector/curve-math.ts` and used by both call sites. `stepDegrees` is `45`; do not make it configurable.
   - Modifier precedence when several are held, highest first: **Space** (reposition, `drag.ts:31-52`, already correct) > **Ctrl/Cmd** (`continuous`) > **Alt** (`independent`) > **Shift** (angle constraint, composes with any of the above). Shift never changes the mirroring mode.
5. **Four pen cursors, chosen in one place.** Add `penCursor(editor, cx, cy)` in `packages/vue/src/canvas/pen-input/use.ts` returning exactly one of:
   - `'crosshair'` - default drawing
   - close - hovering the first vertex of a path with more than 2 vertices, within the zoom-corrected close threshold
   - continue - hovering an open endpoint of an existing vector while the pen is active
   - insert - hovering within `NODE_HIT_THRESHOLD` of a segment in node-edit mode
   Use CSS `cursor` values already valid in this codebase plus, where no standard cursor fits, an inline `url(data:image/svg+xml;...)` cursor with a fallback keyword (`cursor: url(...) 8 8, crosshair`). Do not add cursor image files, and do not add a new asset pipeline. The hover state that drives the cursor is the same state that drives the overlay affordance - compute it once, store it on `editor.state`, and read it from both.
6. **Vertex insertion requires a segment hit.** `handlePenNodeEditDown` (`shared/input/node-edit/index.ts:119-139`) must hit-test segments before it inserts. Add `hitTestEditSegment(editor, cx, cy)` to `shared/input/node-edit/hit-test.ts` returning `{ segmentIndex, t }` or `null`, using flattened cubic sampling (16 samples per segment is sufficient; `curve-math.ts` already owns the evaluation). A click that hits no vertex and no segment **clears the vertex selection** - it does not insert, and it does not exit node-edit mode.
7. **Marquee vertex selection replaces the exit-on-empty-click behaviour.** In `handleNodeEditDown` (`index.ts:116`), an empty-space press starts a `marquee` drag instead of calling `exitNodeEditMode(true)`. On release, every vertex inside the rect becomes selected (Shift adds to the existing selection). Reuse the existing marquee drag type, `editor.setMarquee`, and the existing marquee overlay - do not draw a second rectangle. Exiting node-edit mode keeps its existing routes: Escape, Enter, and double-clicking empty canvas (`keyboard/actions.ts:38,57`).
8. **Handle mirroring gets one explicit control, in the Design panel.** Add `src/components/properties/VectorPointSection.vue`, rendered only when `editor.state.nodeEditState` is non-null and at least one vertex is selected. It is a three-way segmented control - Sharp (`NONE`), Smooth (`ANGLE_AND_LENGTH`), Disjoint (`ANGLE`) - following the existing segmented-control convention in `src/components/properties/`. It writes through a new `nodeEditSetMirroring(mode)` action in `src/app/editor/vector-edit/handle-actions.ts`, applied to every selected vertex in one undo entry. Mixed selections show no active segment until the user picks one. No keyboard shortcut is added in this packet.
9. **One user gesture is one undo entry.** A completed pen path, a marquee selection change (which mutates no geometry and pushes nothing), a mirroring change across N selected vertices, a vertex insertion, and a vertex deletion are each exactly one entry. Selection changes never push undo entries.
10. **Nothing about the rendered result changes.** Anchors and handles are overlay chrome. A committed path's geometry, fills, strokes, winding rules and `.fig` bytes must be byte-identical to before this packet for the same user input.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines stops and reports instead.

- **Do NOT build, install, or bump versions.** The delivery policy set 2026-08-14 (`Plan/plan.md`) stops packets at source gates. `App/package.json`, `App/desktop/tauri.conf.json` and `App/desktop/Cargo.toml` are not touched. Revision 1's `0.6.7` bump and its NSIS steps are void.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or `bun run check:upstream`.** Use the focused gates in Acceptance.
- **Do NOT change `encodeVectorNetworkBlob` / `decodeVectorNetworkBlob` or anything under `packages/core/src/kiwi/`.** The `.fig` encoding is out of scope entirely.
- **Do NOT change the `VectorNetwork`, `VectorVertex`, `VectorSegment` or `VectorRegion` types** in `packages/scene-graph/src/types.ts`.
- **Do NOT touch the PENCIL, BRUSH, SHAPE_BUILDER, RECTANGLE, ELLIPSE, LINE, POLYGON, STAR, FRAME, SECTION, SLICE, TEXT or HAND tools**, or the boolean/mask/shape-builder code paths that consume vector networks.
- **Do NOT delete the dead duplicates in `src/constants.ts`.** Update `PEN_CLOSE_THRESHOLD` and `HANDLE_HIT_RADIUS` there to match the new core values so they cannot drift, and leave removal to T-056.
- **Do NOT add a preference, setting, or UI control for handle size.** The sizes in decision 1 are the sizes.
- **Do NOT add a runtime dependency.** No bezier library, no cursor package.
- **Do NOT introduce a second overlay canvas, a DOM-based handle layer, or a new renderer surface.** All affordances draw through the existing CanvasKit overlay path.
- **Do NOT add cursor image asset files** or change the Vite asset config. Inline data-URI cursors only (decision 5).
- **Do NOT implement the T-040 corner-radius cursor or the T-041 gradient-handle cursors here.** Those are separate packets; this packet touches only pen and node-edit cursors.
- **Do NOT rename or change the signature of any exported symbol in `packages/core` or `packages/vue`.** New exports are fine; changed ones are not - both packages publish `.d.ts` surfaces.
- **Do NOT run Git commands.** The project is not a repository.

## Implementation Steps

Land in order. Steps 1-3 are the highest value and the lowest risk, and each is independently verifiable.

1. **Sizing and zoom correctness** (`packages/core/src/constants.ts`, `packages/vue/src/canvas/pen-input/{use,drag}.ts`, `packages/vue/src/shared/input/node-edit/hit-test.ts`, `src/constants.ts`)
   - Apply the seven new constant values from decision 1.
   - Add `PEN_DRAG_DEAD_ZONE = 3`.
   - Divide `PEN_CLOSE_THRESHOLD` by zoom at `use.ts:33` and `use.ts:57`; divide `PEN_DRAG_DEAD_ZONE` by zoom at `drag.ts:141`.
   - Align the duplicate values in `src/constants.ts:109-115`.
   - Verify visually at 25%, 100% and 400% zoom that anchors, handles and selection handles are the same size on screen and that closing a path takes the same aim at all three.
2. **Shift constraint** (`packages/core/src/vector/curve-math.ts`, `pen-input/{use,drag}.ts`)
   - Add and export `constrainToAngleStep(dx, dy, stepDegrees)`.
   - Apply it to anchor placement in `startPenInput` and to the tangent in `applyPenDragTangent`, respecting the precedence in decision 4.
3. **Cursors and hover affordances** (`pen-input/use.ts`, `packages/core/src/canvas/pen-overlay.ts`, `packages/core/src/canvas/node-edit-overlay.ts`, `packages/core/src/editor/types.ts`)
   - Add the hover-intent field to `EditorState` (one nullable discriminated value: `'close' | 'continue' | 'insert' | null`), set it in `updatePenHover`, and read it in `penCursor` and in the two overlays.
   - Close already boosts the first anchor's radius (`pen-overlay.ts:189`); extend the same treatment to continue (highlight the endpoint) and insert (draw a small marker at the hit point on the segment).
4. **Segment-gated vertex insertion** (`shared/input/node-edit/hit-test.ts`, `shared/input/node-edit/index.ts`)
   - Add `hitTestEditSegment`; gate `nodeEditAddVertex` behind it per decision 6; make a total miss clear the vertex selection.
5. **Marquee vertex selection** (`shared/input/node-edit/index.ts`, `packages/vue/src/canvas/useCanvasInput.ts`)
   - Start a `marquee` drag on empty-space press in node-edit mode; resolve it to a vertex selection on release. `useCanvasInput.ts:361` and `:491` already route marquee move and clear - extend, do not duplicate, that routing.
6. **Mirroring control** (`src/app/editor/vector-edit/handle-actions.ts`, `src/components/properties/VectorPointSection.vue`, `src/components/DesignPanel.vue`)
   - Add `nodeEditSetMirroring(mode)`; mount the section per decision 8.
7. **Focused tests**
   - `tests/engine/vector/pen-actions.test.ts` (new): anchor placement with and without the 45-degree constraint; `constrainToAngleStep` at boundary angles; commit of an open path and of a closed path; `penCancel` leaves no node; a single-click path creates no zero-dimension vector; one commit is one undo entry.
   - `tests/engine/vector/node-edit.test.ts` (new): `hitTestEditSegment` returns the right segment and a `t` in `[0,1]`; insertion at `t` leaves the curve shape unchanged within tolerance; deletion re-bridges and re-indexes segments and regions; mirroring conversion across a multi-vertex selection is one undo entry.
   - `tests/e2e/tools/pen.spec.ts` (new): draw a three-point path and close it; confirm the close cursor and the boosted anchor appear at 50% and at 200% zoom; draw a curve with Shift held and assert the tangent angle; enter node edit by double-click, marquee-select two vertices, convert them to Smooth, delete one, undo twice; assert no console errors throughout.
   - Follow the existing harnesses - `tests/helpers/canvas.ts` (`CanvasHelper`), `tests/helpers/store.ts`, and the `--project=openpencil` Playwright project.

## Acceptance Criteria

- [ ] At 25%, 100% and 400% zoom, pen anchors, tangent handles, node-edit vertices/handles and selection handles are drawn at the same screen size, and that size matches decision 1.
- [ ] Closing a path requires the same aim at every zoom level; `grep -n "PEN_CLOSE_THRESHOLD" packages/vue/src` shows no use that is not divided by zoom.
- [ ] Starting a handle drag requires the same movement at every zoom level.
- [ ] Shift constrains anchor placement and tangent direction to 45-degree steps, composes with Ctrl/Cmd and Alt per decision 4, and never alters mirroring mode.
- [ ] Hovering the first anchor of a 3+ vertex path shows the close cursor and the boosted anchor; hovering an open endpoint shows the continue cursor and highlights that endpoint; hovering a segment in node edit shows the insert cursor and a marker on the segment.
- [ ] Clicking empty space in node-edit mode with the pen no longer inserts a vertex; it clears the vertex selection and leaves the path unchanged.
- [ ] Dragging from empty space in node-edit mode draws the existing marquee and selects every enclosed vertex; Shift adds to the selection.
- [ ] The Design panel shows Sharp / Smooth / Disjoint while vertices are selected, applies the change to all of them in one undo entry, and shows no active segment for a mixed selection.
- [ ] One pen path commit, one insertion, one deletion and one mirroring change are each exactly one undo entry; selection changes push none.
- [ ] A path drawn with the same input before and after this packet produces an identical `VectorNetwork` and identical `.fig` bytes.
- [ ] `tests/engine/vector/` passes, including the two new files, and `tests/e2e/tools/pen.spec.ts` passes.
- [ ] Focused gates green: `tsgo --noEmit`; `vue-tsc --noEmit -p tsconfig.json` and `vue-tsc --noEmit -p packages/vue/tsconfig.json`; `oxlint -c oxlint.json` over the touched paths.
- [ ] No version file, installer, build output or Git state changed.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`:

1. `bun test tests/engine/vector/` - expect exit `0`.
2. `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil` - expect exit `0`.
3. `bunx tsgo --noEmit` - expect exit `0`.
4. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` - expect exit `0`.
5. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/ packages/vue/src/ src/` - expect exit `0`.
6. Browser check in the dev server: draw and close a path at 25%, 100% and 400% zoom; exercise each cursor state; marquee-select and convert vertices. Record what was observed, not what was expected.

## Stop Conditions

- Stop if enlarging the hit radii makes vertex and handle hit tests ambiguous - a handle sitting on top of its own anchor that can no longer be selected means the radii in decision 1 are wrong, and the rest of the packet does not depend on them.
- Stop if the marquee drag type cannot be reused in node-edit mode without changing `DragState` for other tools.
- Stop if segment hit testing needs curve subdivision beyond what `curve-math.ts` already provides, or would need a new dependency.
- Stop if any change to the pen or node-edit path alters committed `VectorNetwork` output or `.fig` bytes for identical input.
- Stop and report if a step requires changing an exported signature in `packages/core` or `packages/vue`.
- Stop if a data-URI cursor is rejected by the WebView2 runtime; fall back to the nearest standard keyword cursor and record that in the execution report rather than adding an asset pipeline.

## Execution Report Contract

Report: result; changed files with opening and final SHA-256; the before/after value of every constant touched; commands run with exit codes and test counts; evidence for each of the four cursor states and each modifier; the `.fig`/`VectorNetwork` identical-output check; undo-entry counts per gesture; deviations; and concerns. Do not advance task or packet status from execution - that is the audit's job.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Executed; repair pass 2026-08-18 completed the required pen E2E coverage — 7/7 in `tests/e2e/tools/pen.spec.ts`, now covering the close cursor and boosted anchor at 50%/200% zoom, a Shift-constrained tangent, and double-click node edit with marquee selection, Smooth conversion, deletion and two undos with per-gesture undo-depth assertions. Two real defects fixed on the way: the Sharp/Smooth/Disjoint control was unreachable on desktop (mounted only in the mobile-only `DesignPanel.vue`) and never re-rendered on nested `nodeEditState` changes under `shallowReactive`.
