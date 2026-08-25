# T-012 — Deliver an interactive shape-builder tool

Task ID: T-012
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-011
Prepared against: Live `App/` source and tests on 2026-07-20; T-011 is PREPARED.
Last expanded: 2026-07-20

## Request Coverage

- Add a brush-like drag interaction (brushing) that merges or deletes overlapping vector regions.
- Preview affected regions (hovering/dragging highlights) before committing one undoable edit.
- Build on verified CanvasKit Boolean geometry (`Path.op()`) rather than introducing a competing bezier path engine.

## User-Visible Outcome

In the OpenPotlood editor, selecting the new Shape Builder tool (via the toolbar button with overlapping shapes icon or key shortcut `Shift+M`) activates the interactive shape-builder tool.
With a selection of at least one compatible node (rectangle, ellipse, polygon, star, or vector path), the tool decomposes their overlapping geometry into a set of mutually disjoint regions.
- Moving the cursor over the canvas highlights the region under the cursor with a thin blue outline and a semi-transparent blue fill (by default).
- Pressing and holding `Alt` (or `Option` on macOS) switches the tool to **Delete** mode, changing the hover highlight to red.
- Clicking and dragging (brushing) across regions aggregates them into a dragged set, updating their preview highlight (union highlight for merge, red highlight for delete).
- Releasing the mouse commits the operation:
  - In **Merge** mode, the brushed regions are unioned into a single new `VECTOR` node, while all other non-empty regions are created as separate `VECTOR` nodes. The original selected nodes are deleted. Fills and strokes of the new nodes are copied from the original overlapping nodes.
  - In **Delete** mode, the brushed regions are discarded, and new `VECTOR` nodes are created only for the remaining regions. The original nodes are deleted.
- The entire interaction is captured as a single undo/redo step. Pressing `Escape` or switching tools cancels the current drag without mutating the document.
- Switching to a non-shape-builder tool or clearing selection deletes all temporary CanvasKit paths from memory.

## Verified Starting State

### Verified facts

- `App/packages/core/src/editor/types.ts` defines `Tool` which handles active tool values.
- `App/packages/core/src/editor/tool-registry.ts` registers shortcuts and tool definition constants.
- `App/packages/core/src/canvas/renderer/types.ts` defines `RenderOverlays` interface passed to the drawing pipeline.
- `App/packages/core/src/canvas/boolean.ts` provides `canMakeBooleanSourceNode` and `makeBooleanSourcePath` for extracting vector paths from nodes.
- `App/packages/core/src/canvas/flatten.ts` provides `flattenNodesToVectorProps` and shows how a CanvasKit `Path` is converted back to a `VectorNetwork` using `parseSVGPath(path.toSVGString())`.
- `App/packages/vue/src/canvas/useCanvasInput.ts` handles all canvas pointer events (`mousedown`, `mousemove`, `mouseup`) and forwards them to active tool handlers.
- `App/src/app/editor/icons.ts` registers icons for all toolbar tools.
- `App/src/components/Toolbar/Toolbar.vue` maps tool labels and keyboard shortcuts.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-011-boolean-vector-operations.md`
- `App/packages/core/src/canvas/boolean.ts`
- `App/packages/core/src/canvas/flatten.ts`
- `App/packages/vue/src/canvas/useCanvasInput.ts`
- `App/packages/core/src/editor/structure/boolean.ts`
- `App/packages/core/src/editor/structure/flatten.ts`

## Allowed Changes

- `App/packages/core/src/editor/types.ts` — add `'SHAPE_BUILDER'` to `Tool` and add `shapeBuilderState` to `EditorState`.
- `App/packages/core/src/editor/tool-registry.ts` — add `'SHAPE_BUILDER'` tool definition and `'Shift+KeyM'` shortcut.
- `App/packages/core/src/canvas/renderer/types.ts` — add `shapeBuilderState` to `RenderOverlays`.
- `App/packages/core/src/canvas/renderer/methods.ts` and `pipeline.ts` — export and invoke `drawShapeBuilderOverlay` during the overlay phase.
- `App/packages/vue/src/canvas/useCanvasInput.ts` — intercept pointer events for `SHAPE_BUILDER` and update reactive hover/drag states.
- `App/src/components/Toolbar/Toolbar.vue` — map tool labels and shortcut keys.
- `App/src/app/editor/icons.ts` — add `'SHAPE_BUILDER'` and bind it to `IconCombine` or `IconPaintbrush`.
- New file `App/packages/core/src/canvas/overlays/shape-builder.ts` — implement `drawShapeBuilderOverlay` using CanvasKit's path drawing.
- New file `App/packages/core/src/editor/structure/shape-builder.ts` — implement regions decomposition, selection watching, and `commitShapeBuilder` transaction logic.
- New file `App/tests/engine/editor/structure/shape-builder.test.ts` — unit tests for pairwise decomposition, merge path generation, and delete path generation.
- New file `App/tests/e2e/design/shape-builder.spec.ts` — E2E test verifying Shape Builder tool activation, region highlight, brushing, merge/delete commit, and undo/redo tree states.
- `App/CHANGELOG.md` to document the feature.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` for SemVer version bump on production check.

## Restrictions and Exclusions

- Do not write custom Bezier curve clipping algorithms in JavaScript. You must use CanvasKit's `Path.op(other, op)` with `PathOp.Difference`, `PathOp.Intersect`, and `PathOp.Union` for geometry logic.
- Do not leak WASM memory. You must call `.delete()` on every temporary `Path` object created during decomposition, rendering, and commits.
- Do not flatten or delete unselected layers.
- The tool must refuse to execute if the selected nodes are not compatible (do not pass `canMakeBooleanSourceNode`).
- Do not use screenshot-only or visual-only assertion tests. You must assert the resulting node structure and path properties through the editor store.

## Implementation Steps

1. **Extend Editor Types:**
   - In `App/packages/core/src/editor/types.ts`:
     - Add `'SHAPE_BUILDER'` to the `Tool` type union.
     - Add `shapeBuilderState` to `EditorState`:
       ```typescript
       shapeBuilderState?: {
         regions: Array<{
           id: string
           path: Path
           sourceNodeIds: string[]
           hovered: boolean
           dragged: boolean
         }>
         isDeleteMode: boolean
       } | null
       ```
   - In `App/packages/core/src/editor/tool-registry.ts`:
     - Add `'SHAPE_BUILDER'` to `EDITOR_TOOLS`:
       ```typescript
       { key: 'SHAPE_BUILDER', label: 'Shape Builder', shortcut: 'Shift+M' }
       ```
     - Add `Shift+KeyM` mapping to `'SHAPE_BUILDER'` in `TOOL_SHORTCUTS`.

2. **Implement Shape Builder Core logic:**
   Create `App/packages/core/src/editor/structure/shape-builder.ts`:
   - Implement `decomposePathsIntoRegions(renderer, sourcePaths)`:
     Iterate through selected paths and recursively compute pairwise intersections and differences using `Path.op()`. Keep track of the union of original `sourceNodeIds` for each sub-region.
   - Implement `initializeShapeBuilder(ctx)`:
     Verify selection contains valid nodes. Extract their paths using `makeBooleanSourcePath` (translated to world coordinates). Call `decomposePathsIntoRegions`, and assign the result to `ctx.state.shapeBuilderState`.
   - Implement `clearShapeBuilder(ctx)`:
     Call `.delete()` on all paths in `ctx.state.shapeBuilderState.regions` to free WASM memory. Set `ctx.state.shapeBuilderState = null`.
   - Implement `commitShapeBuilder(ctx, draggedRegionIds, isDeleteMode)`:
     - Separate regions into dragged and non-dragged.
     - If `isDeleteMode` is true: discard dragged regions; convert each non-dragged region path into a new `VECTOR` node using `parseSVGPath(path.toSVGString())`.
     - If `isDeleteMode` is false: union dragged regions into one merged path; convert the merged path and each non-dragged region path into new `VECTOR` nodes.
     - Copy fill/stroke properties to new nodes from their respective original source nodes.
     - Delete the original nodes from the graph, insert new nodes, and select them.
     - Push an undo transaction that deletes the new nodes and restores the original nodes with selection.

3. **Wire Renderer Overlays:**
   - In `App/packages/core/src/canvas/renderer/types.ts`, add `shapeBuilderState` to `RenderOverlays`.
   - Create `App/packages/core/src/canvas/overlays/shape-builder.ts`:
     - Implement `drawShapeBuilderOverlay(renderer, canvas, graph, state)`:
       - For each region:
         - If `hovered` or `dragged`: draw filled path with `0.2` opacity (blue for merge, red for delete) and a solid outline of `1.5` width.
         - Else: draw a very faint dotted outline (grey, `0.15` opacity) to assist alignment.
   - Register the draw method in `App/packages/core/src/canvas/renderer/methods.ts` and call it in `pipeline.ts` right after `drawNodeEditOverlay`.

4. **Wire Pointer Input:**
   - In `App/packages/vue/src/canvas/useCanvasInput.ts`:
     - Watch `activeTool` and `selectedIds`. If `activeTool === 'SHAPE_BUILDER'`, trigger `initializeShapeBuilder()`; otherwise, trigger `clearShapeBuilder()`.
     - In `onMouseMove`: If tool is `'SHAPE_BUILDER'` and not dragging, hit test regions with `region.path.contains(cx, cy)` and set `hovered`. If dragging with type `'shape-builder-drag'`, hit test and add regions to the drag set.
     - In `onMouseDown`: If tool is `'SHAPE_BUILDER'` and hovering over a region, set `drag.value` to:
       ```typescript
       { type: 'shape-builder-drag', draggedRegionIds: new Set([hovered.id]), isDeleteMode: event.altKey }
       ```
     - In `onMouseUp`: If dragging as `'shape-builder-drag'`, invoke `editor.commitShapeBuilder(draggedRegionIds, isDeleteMode)`. Reset drag state.

5. **Toolbar & Icon Registration:**
   - Map `'SHAPE_BUILDER'` in `App/src/components/Toolbar/Toolbar.vue` labels and shortcuts.
   - Import `IconCombine` or `IconPaintbrush` in `App/src/app/editor/icons.ts` and assign to `toolIcons.SHAPE_BUILDER`.

6. **Testing and Verification:**
   - Add unit tests in `App/tests/engine/editor/structure/shape-builder.test.ts` to assert that decomposition of overlapping shapes produces the correct number of disjoint regions, and that commits preserve styling.
   - Add E2E tests in `App/tests/e2e/design/shape-builder.spec.ts` asserting selection, tool activation, region highlight on hover, dragging to merge, alt-dragging to delete, and undo/redo state restoration.

## Acceptance Criteria

- [ ] Selecting `'SHAPE_BUILDER'` tool and hovering over selected overlapping shapes highlights individual regions.
- [ ] Brushing (dragging) across regions highlights them together (blue for merge, red for delete when Alt is held).
- [ ] Releasing mouse in Merge mode combines brushed regions into a single path and preserves other regions as separate `VECTOR` nodes.
- [ ] Releasing mouse in Delete mode discards brushed regions and preserves remaining ones.
- [ ] Stylings (fills and strokes) are copied to new nodes from their respective original source nodes.
- [ ] Undo restores the exact original shapes, layer tree, and selection; Redo reapplies the shape builder result.
- [ ] Temporary CanvasKit paths are deleted on clearing/switching tools (monitored via garbage collection or memory profile if needed).
- [ ] All unit and E2E tests pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`:

1. `bun test ./tests/engine/editor/structure/shape-builder.test.ts` — expect exit `0`.
2. `bunx playwright test tests/e2e/design/shape-builder.spec.ts --project=openpencil` — expect exit `0`.
3. `bun run check` — expect exit `0`.
4. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.

## Integration or Installed-Result Check

- Perform a Tauri build: `bun run build && bun run tauri build --bundles nsis`
- Perform silent installation: `Start-Process -FilePath "src-tauri/target/release/bundle/nsis/OpenPotlood_[version]_x64-setup.exe" -ArgumentList "/S" -Wait`
- Verify installed application launches, lets you select overlapping shapes, choose Shape Builder (Shift+M), brush-merge and brush-delete with Alt, undo/redo the operation, and check memory stability.

## Stop Conditions

- Stop if CanvasKit `Path.op()` throws native WASM errors on complex curves or self-intersecting polygon bounds.
- Stop if Vue's reactivity proxy on `shapeBuilderState` causes high CPU lag during fast cursor brushing.

## Execution Report Contract

- Report unit/E2E test exits and assertion counts.
- Report exact files modified and new files created.
- Confirm WASM path delete operations are verified.
- Report installed app execution verification, path, version, and responsiveness checks.

## Status record

Status: **Done**
