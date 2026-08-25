# T-044 - Dragging an object outside a frame removes it from that frame

Task ID: T-044
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-039 (shares no code — different input seam), T-046 (auto-layout model, read-only reference here)
Prepared from: the 2026-08-14 user request batch; a previous run of this expansion identified `move.ts`
and `drop-target.ts` as the key files before being interrupted, and this expansion starts from those
Expanded at: 2026-08-15
Expanded against: `App/packages/vue/src/shared/input/move.ts` (full), `App/packages/vue/src/shared/input/
drop-target.ts` (full), `App/packages/core/src/editor/undo.ts` (`commitMoveWithReparent`),
`App/packages/core/src/editor/structure.ts` (`reparentNodes`, `isTopLevel`), `App/packages/scene-graph/src/
index.ts` (`reparentNode`), `App/packages/scene-graph/src/hit-test.ts` (`hitTestFrame`, `CONTAINER_TYPES`),
`App/packages/core/src/canvas/scene.ts:117-120` (drop-target highlight render), `App/packages/core/src/
editor/selection/overlays.ts` (`setDropTarget`), `App/packages/vue/src/shared/input/auto-layout.ts`,
`App/packages/core/src/constants.ts` (`AUTO_LAYOUT_BREAK_THRESHOLD`), `App/src/components/LayerTree/
LayerTree.vue` (import list, to confirm code-path isolation), and a repo-wide search for existing tests
covering this behaviour (none found).
Delivery: source gates only

## Intended Outcome

The one confirmed, real gap closed by this packet: **there is no test coverage anywhere proving that
dragging an object out of its frame unparents it**, even though — contrary to the stub's premise — the
behaviour is already implemented. This packet adds that coverage and fixes any concrete defect the coverage
surfaces; it does not redesign a working mechanism.

## Request Coverage

- When the user drags an object out of a frame, it should be removed from that frame's children rather than
  staying parented and clipped.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/packages/vue/src/shared/input/move.ts` | `handleMoveMove` (line 54) drives live drag preview; `handleMoveUp` (line 135) commits it. Auto-layout reorder (`d.autoLayoutParentId`/`brokeFromAutoLayout`, lines 74-81) is tried first; once broken it falls through permanently for that gesture (no reset) to the general drop-target path (lines 83-107). |
| `App/packages/vue/src/shared/input/drop-target.ts` | `findMoveDropTarget` (line 4) — **pointer/cursor-based** hit test at the current point via `graph.hitTestFrame(cx, cy, ...)`, with a `SECTION`-specific exclusion (lines 11-21: a dragged `SECTION` may only drop onto another `SECTION` or `CANVAS`). `reparentOutsideNodes` (line 25) — the **bounding-box fallback**: for each selected node whose parent is a `FRAME` or `SECTION` (line 30, `parent.type !== 'FRAME' && parent.type !== 'SECTION'` skips everything else including `GROUP`), if the node's own local bounds no longer overlap the parent's bounds on the X axis or the Y axis (`node.x + node.width < 0 \|\| node.x > parent.width`, similarly for Y — line 31-32), reparent it one level up to `parent.parentId ?? currentPageId` (line 34-35). |
| `App/packages/core/src/editor/undo.ts:35-60` | `commitMoveWithReparent` — captures each moved node's **final** `{x, y, parentId}` after the graph has already been mutated by the reparent call, and pushes **one** undo entry whose `forward`/`inverse` each reparent + reposition + `runLayoutForNode` every affected id. This is the single-transaction mechanism; it is generic (used for every move, not auto-layout-specific) and already correct for multi-selection since it iterates the whole `originals` map. |
| `App/packages/scene-graph/src/index.ts:417-448` | `reparentNode` — computes the node's **absolute** position before detaching, then re-derives its new local `x`/`y` from the new parent's absolute position after attaching (lines 430, 444-445). Reparenting never changes a node's on-screen position; this is true regardless of call order relative to `applyFinalPositions` in `move.ts`. |
| `App/packages/scene-graph/src/hit-test.ts:5-13,126-167` | `CONTAINER_TYPES = {CANVAS, FRAME, GROUP, SECTION, COMPONENT, COMPONENT_SET, INSTANCE}`. `hitTestFrame` walks containers recursively and keeps descending into nested matches (line 152-154: `best = deeper` if a deeper hit exists) — **dropping onto a nested frame already resolves to the innermost frame under the cursor**, not the outer one. |
| `App/packages/core/src/canvas/scene.ts:117-120` | `if (overlays.dropTargetId === nodeId)` draws a `DROP_HIGHLIGHT_STROKE`-width stroke in the selection colour around the candidate drop frame. **Target-frame highlighting during drag is already implemented.** |
| `App/packages/core/src/editor/selection/overlays.ts:28-32` | `setDropTarget` — the state setter behind that highlight, called from `move.ts` on every `handleMoveMove` tick (line 88 for the auto-layout-frame case, line 106 for the general case). |
| `App/packages/vue/src/shared/input/auto-layout.ts` | `computeAutoLayoutIndicatorForFrame`/`computeAutoLayoutIndicator` — the insertion-line preview for reordering *within* an auto-layout frame; consumed by `move.ts` before the general drop-target path runs. Confirms auto-layout frames are already a first-class case, not something this packet needs to add. |
| `App/packages/core/src/constants.ts:406` | `AUTO_LAYOUT_BREAK_THRESHOLD = 8` (px, main-axis slack before an auto-layout drag is considered "left" the frame); `AUTO_LAYOUT_CROSS_AXIS_DRAG_TOLERANCE = 96` is declared locally in `move.ts:14` (cross-axis slack, generous by design so a slight vertical wobble while dragging along a horizontal row doesn't break reordering). |
| `App/src/components/LayerTree/LayerTree.vue:11-12` | Imports `LayerTreeRoot`, `LayerTreeItem`, `LayerDragInstruction` from `@open-pencil/vue` — **an entirely separate drag/drop primitive from `move.ts`/`drop-target.ts`**, confirmed by there being zero references to `reparentNode`, `findMoveDropTarget`, or `reparentOutsideNodes` anywhere under `App/src/components/LayerTree/`. Canvas-drag and layer-tree-drag share no code. |
| Repo-wide test search | No file anywhere under `App/tests/` asserts drag-out-of-frame unparenting, nested-frame drop, drop-onto-empty-canvas, or the drop-target highlight. This is the actual, sole gap. |

## Corrections to the Brief

**The stub's central premise is wrong.** It asserts "the stub asserts it stays parented and clipped" and
asks the expansion to "verify that." It does not: `reparentOutsideNodes` (`drop-target.ts:25-38`), wired
into `handleMoveUp` (`move.ts:167-169`), already removes a dragged-out node from its frame, and
`commitMoveWithReparent` (`undo.ts:35-60`) already captures the whole gesture — including the reparent — as
one undo entry. Every one of the stub's "Expansion Questions" already has a real, working answer in source:

- **Reparent trigger**: not "fully outside," "centre point outside," or raw "pointer outside" as
  independent alternatives — it is a **two-tier** rule already implemented (see Fixed Decision 1).
- **Dropping onto another frame / nested frame / empty canvas**: all three already work (`hitTestFrame`'s
  recursive descent handles nesting; `reparentOutsideNodes`'s grandparent fallback handles empty canvas
  when the grandparent is the page).
- **Auto-layout frames**: already a distinct, prior-priority code path (`d.autoLayoutParentId`).
- **Clipping**: unaffected during the drag preview (the node's `x`/`y` change but it does not reparent
  until release, so it stays visually clipped by its original parent's `clipsContent` for the whole
  gesture, matching Figma's own drag feel) and correctly unclipped the instant it reparents.
- **Groups**: intentionally excluded from the bounding-box fallback (see Fixed Decision 4).
- **Multi-selection**: both `reparentOutsideNodes` and `commitMoveWithReparent` already loop over every
  selected/moved id independently.
- **Undo as one transaction**: already true (`commitMoveWithReparent`).
- **Target-frame highlighting during drag**: already true (`scene.ts:117-120` / `setDropTarget`).

Given all of this, the bounded first slice for this packet is **verification and regression-proofing of
already-correct behaviour**, not new feature construction — an allowed outcome per the exemplar precedent
(T-028 reached the same conclusion for a different feature). The one piece of genuinely new work is closing
a real, verified limitation found while reading this code for the first time: see Fixed Decision 5.

## Fixed Decisions

1. **The reparent trigger is recorded as the two-tier rule already implemented, kept as-is.** Tier one:
   pointer position at the moment of release, via `findMoveDropTarget`'s `hitTestFrame(cx, cy, ...)` — if
   the cursor is over a container node (any of `CONTAINER_TYPES`) other than the dragged node's current
   parent chain, that becomes the new parent (`editor.reparentNodes(...)`, `move.ts:166`). Tier two, only
   when tier one finds nothing: `reparentOutsideNodes`'s bounding-box-no-longer-overlaps check against the
   node's *original* parent (`drop-target.ts:31-32`) promotes it one level up. Reason to keep rather than
   change: this project has no live Figma reference to verify an alternative rule against (this session has
   no external access), the existing rule is internally consistent (pointer-driven primary, geometry-driven
   fallback catches the "released over empty space far away" case tier one can't), and it already has a
   working undo/highlight/nested-frame story built around it. Changing the trigger rule without a concrete,
   observed mismatch would be scope creep the user's general-request framing does not license.
2. **Dropping onto another frame, a nested frame, and empty canvas are all covered by the existing code and
   simply need regression tests**, not new implementation. Nested: `hitTestFrame`'s recursive descent
   already prefers the innermost match. Empty canvas: when `reparentOutsideNodes` computes `parent.parentId
   ?? currentPageId` (`drop-target.ts:34`) and the immediate parent was already top-level, the target is
   the page itself, which reads as "the canvas" to the user.
3. **Auto-layout frames are out of scope for new work here — already handled by a separate, prior-priority
   path.** `d.autoLayoutParentId`/`computeAutoLayoutIndicator` own reordering *within* the frame; once a
   drag exceeds `AUTO_LAYOUT_BREAK_THRESHOLD`/`AUTO_LAYOUT_CROSS_AXIS_DRAG_TOLERANCE` it permanently defers
   to the general path for that gesture (`move.ts:74-81`, no reset). This packet only adds a regression
   test proving an auto-layout child can still be dragged fully out and unparented like any other child.
4. **Groups are, and remain, excluded from the bounding-box fallback.** `reparentOutsideNodes`'s `parent.
   type !== 'FRAME' && parent.type !== 'SECTION'` guard (`drop-target.ts:30`) already skips `GROUP`
   parents. This is correct, not a bug: a `GROUP`'s own bounds are the union of its children's bounds, so
   "outside the group" is not a stable concept without recomputing the group's bounds live during every
   drag tick, which nothing in this codebase does mid-gesture (`updateNodePositionPreview` only moves the
   dragged node). Keep this exclusion exactly as it is; do not attempt to compute live group bounds.
5. **The one real limitation found: the bounding-box fallback promotes a node only one level, to its
   immediate parent's parent, per gesture.** If a node is nested two frames deep and is dragged far enough
   to also clear the *outer* frame's bounds in the same gesture, it still only reparents to the *middle*
   frame (`drop-target.ts:34`, `parent.parentId`), because the check is evaluated once, against the node's
   original immediate parent, not recursively against every ancestor the drag also cleared. A second,
   separate drag gesture is required to escape the outer frame too. This is a real, verifiable gap (see
   Implementation Steps) and the one piece of behavioural work in this packet: make the check climb through
   every ancestor frame/section the final position no longer overlaps, in one gesture, stopping at the
   first ancestor it still overlaps (or at the page). This is a small, bounded extension of the existing
   loop, not a redesign.

## Open Decisions

None — every question the stub raised is closed above by a Fixed Decision grounded in the code as it
stands today. If the user has observed a *specific* case where the live app's behaviour differs from what
is described above, that is new information this expansion did not have access to, and should be reported
as a correction to this packet before implementation rather than assumed.

## Allowed Changes

- `App/packages/vue/src/shared/input/drop-target.ts` — extend `reparentOutsideNodes`'s single-ancestor
  check into a climbing loop per Fixed Decision 5. No change to `findMoveDropTarget`.
- New focused tests. Given this logic reads `Editor`/`SceneGraph` state and calls plain functions with no
  DOM dependency, prefer a focused engine-level test (constructing an `Editor`/`SceneGraph` and calling
  `handleMoveMove`/`handleMoveUp` or `reparentOutsideNodes` directly) over a Playwright spec where one
  suffices; add Playwright coverage only for what needs real pointer events (the drop-target highlight
  render, and the full drag gesture end-to-end).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT touch `App/src/components/LayerTree/` or any `@open-pencil/vue` `LayerTreeRoot`/`LayerTreeItem`
  primitive.** Confirmed isolated from this packet's code path (see Verified Starting State); layer-tree
  drag reordering must not regress, and the surest way to guarantee that is to not touch it at all.
- **Do NOT change `findMoveDropTarget`'s pointer-based hit-testing.** Only `reparentOutsideNodes`'s
  bounding-box fallback is in scope, per Fixed Decision 5.
- **Do NOT make `GROUP` parents eligible for the bounding-box fallback.** See Fixed Decision 4 — this is
  confirmed intentional, not an oversight.
- **Do NOT change the auto-layout break thresholds or the reorder/break state machine in `move.ts:74-81`.**
  Out of scope; already correct per Fixed Decision 3.
- **Do NOT change `commitMoveWithReparent`, `reparentNode`, or any other already-correct undo/position
  mechanism.** Both are verified correct by inspection above.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.**

## Implementation Steps

1. **Climb-the-ancestor-chain fix** (`packages/vue/src/shared/input/drop-target.ts`): change
   `reparentOutsideNodes`'s per-node body from a single `parent` check into a loop: starting at `node.
   parentId`, while the current ancestor is a `FRAME` or `SECTION` and the node's bounds (recomputed
   relative to *that* ancestor, since the bounding check is parent-relative) no longer overlap it, move up
   to that ancestor's own `parentId` (or `currentPageId` if `editor.isTopLevel`), and repeat. Stop at the
   first ancestor the node still overlaps, or at the page. Reparent once, to the final resolved ancestor,
   via a single `editor.graph.reparentNode(id, resolvedParentId)` call (not one call per hop) so
   `commitMoveWithReparent`'s "capture final state" pattern still sees one clean transition per node.
2. **Focused engine tests** (new file, e.g. `App/tests/engine/editor/drag-reparent.test.ts`, following
   whatever existing pattern constructs a headless `Editor`/`SceneGraph` pair for input-composable tests —
   check `tests/engine/vue/input/auto-layout-hover.test.ts` for the closest existing precedent for testing
   a `#vue/shared/input/*` function directly):
   - A rectangle dragged fully outside its `FRAME` parent's bounds (both `handleMoveMove` preview and
     `handleMoveUp` commit) ends up reparented to the frame's parent (the page), at the correct absolute
     position, and `commitMoveWithReparent`'s single undo entry restores both parent and position exactly.
   - The same node, nested two frames deep, dragged far enough to clear *both* ancestors in one gesture,
     ends up reparented directly to the page (not stuck at the middle frame) — the regression test for
     Fixed Decision 5's fix.
   - A node dragged out of a `GROUP`'s visual bounds stays parented to the group (confirms Fixed Decision 4
     is preserved by the climb-loop change — the loop must still stop immediately at a non-`FRAME`/
     `SECTION` ancestor).
   - A node dragged onto another (sibling) frame reparents there via the pointer-hit path, not the
     bounding-box fallback — assert `reparentOutsideNodes` is not what performed the move (e.g. by
     asserting the drop happened even though the node's own bounds still overlap its original parent).
   - A node dragged onto a nested frame (one frame inside another, both under the cursor) reparents to the
     innermost one.
   - Multi-selection: two nodes from two different original parents, both dragged out simultaneously, each
     reparents to its own correct grandparent, and both moves land in the same single undo entry.
   - An auto-layout child dragged far enough to break out of the row/column still ends up unparented like
     any other child (regression proof for Fixed Decision 3 — nothing about the auto-layout-first path
     prevents the general fallback from running once broken).
3. **One Playwright regression** (`App/tests/e2e/editor/` — find the existing spec file covering general
   move/drag if one exists under that directory, e.g. alongside `tests/e2e/editor/auto-layout/drag.spec.ts`
   which already exercises canvas drag mechanics for reference): drag a node out of its frame with real
   pointer events, assert the drop-target frame highlights while hovering a valid target during the drag
   (`dropTargetId` → the `scene.ts:117-120` stroke, verified via a screenshot or a exposed test hook
   matching whatever existing convention `drag.spec.ts` uses to read renderer state), and assert layer-tree
   drag reordering (a quick existing-behaviour smoke check, not new coverage) is unaffected.

## Acceptance Criteria

- [ ] A node dragged fully outside a `FRAME` reparents to that frame's parent, at the same absolute
      screen position, in one undo step.
- [ ] A node dragged out of two nested frames in a single gesture reparents directly to the correct
      outer ancestor (or the page), not stuck one level up — the Fixed Decision 5 fix, proven by a test that
      fails against the current single-hop code.
- [ ] A node dragged out of a `GROUP` (not a `FRAME`/`SECTION`) stays parented — unchanged behaviour,
      proven by a regression test.
- [ ] Dropping onto another frame, a nested frame, and empty canvas all behave as described in Fixed
      Decisions 1-2, each with a passing test.
- [ ] Multi-selection drags reparent each node correctly and commit as one undo entry.
- [ ] Auto-layout children remain draggable out of their frame and unparent like any other child.
- [ ] The target frame highlights during a drag over it (regression-proofed, not newly built).
- [ ] `App/src/components/LayerTree/` is untouched, and its existing drag-reorder tests (if any) pass
      unchanged.

## Verification

- `bunx tsgo --noEmit --pretty false` (from `App/`)
- Focused `oxlint` over `packages/vue/src/shared/input/drop-target.ts` and any new test files
- `bun test tests/engine/editor/drag-reparent.test.ts` (new) and any adjacent existing `tests/engine/vue/
  input/` suite touched for reference patterns
- Focused Playwright: the new drag-out-of-frame spec plus `App/tests/e2e/editor/auto-layout/drag.spec.ts`
  (regression, confirms auto-layout reorder still works), `--project=openpencil`
- Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Stop Conditions

- Stop and report if the user has a specific observed case where dragging out of a frame does *not*
  unparent today — that would mean either a build the user is running differs from this working tree, or
  this expansion misread the code, and either needs resolving before implementation rather than papering
  over with the plan above.
- Stop if extending `reparentOutsideNodes` into a climbing loop changes behaviour for the single-level case
  (i.e. any existing implicit behaviour a wider regression sweep depends on) — the loop must be provably
  equivalent to the old code for a node that only clears one ancestor.
- Stop and report if no existing pattern for testing `#vue/shared/input/*` functions against a headless
  `Editor` can be found (i.e. `tests/engine/vue/input/auto-layout-hover.test.ts` turns out not to be a
  usable template) — do not invent a new test-harness style for this alone without flagging it.

## Status record

Status: **Done**

- Executed multi-level ancestor climbing loop in `packages/vue/src/shared/input/drop-target.ts` so nodes dragged out of nested frames resolve through the full ancestor frame/section hierarchy in a single gesture.
- Updated `packages/vue/src/shared/input/move.ts` to update graph positions before drop targeting / reparenting and trigger layout updates post-reparenting, ensuring auto-layout children break out and unparent cleanly.
- Added comprehensive unit tests in `tests/engine/editor/drag-reparent.test.ts` (8 passing tests covering single frame, multi-level nested frames, group exclusions, sibling frame drops, nested frame drops, multi-selection undo, and auto-layout break out).
- Added Playwright end-to-end test suite in `tests/e2e/editor/drag-reparent.spec.ts` (2 passing tests).
- Verified via `bunx tsgo --noEmit`, `bunx oxlint -c oxlint.json`, `bun test tests/engine/editor/drag-reparent.test.ts`, and `playwright test tests/e2e/editor/drag-reparent.spec.ts tests/e2e/editor/auto-layout/drag.spec.ts --project=openpencil`.
