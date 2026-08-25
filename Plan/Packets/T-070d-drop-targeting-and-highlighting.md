# T-070d - Tab/seam/edge drop targeting with visual drop-zone highlighting

Task ID: T-070d
Packet state: Superseded — scope map only; execute T-070d1 through T-070d3
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-070a (sizing kinds), T-070b (float window title bar), T-070c (v5 tabbed groups) — all three must be Done
Related: T-031b (Done — the geometric drop resolver this extends), T-031c (Done), T-032 (Ready — consumes this barrel)
Prepared from: the user's 2026-08-20 InDesign-referenced panel request, requirement group 2; final slice of the T-070 split
Expanded at: 2026-08-20 08:24 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/app/shell/panels/{drop-target,drag,operations,layout,types,index,snap}.ts`, `src/components/Shell/{PanelStack,PanelOverlay,DockInsertionTarget,FloatingPanel}.vue`, `src/app.css`, `tests/engine/app/shell/panels/drop-target.test.ts`, `tests/e2e/panels/*`
Delivery: named source gates + browser check

## Intended Outcome

Dragging a panel or a whole group shows exactly one indicator telling the user precisely where it will land, and releasing commits exactly that. Three landing kinds exist, matching InDesign: **tab into a group** (an accent ring round the group plus a caret in its tab strip at the exact tab position), **new group at a seam** (the existing 3 px accent line), and **dock at an edge** (the existing dashed band). Dragging a group's tab strip moves the whole group; dragging a tab moves one panel.

## Request Coverage

Requirement group 2 of the 2026-08-20 request, verbatim:

- Refactor panel drag-and-drop interactions to allow intuitive snapping, reordering, and docking against adjacent panels and edges.
- Implement clear visual drop-zone highlighting (drop targets/indicators) while dragging to show exactly where a panel will dock or tab.

Groups 1, 3, 4 and 5 landed in T-070a/b/c. Snapping itself is already correct and stays untouched — see Fixed Decision 8.

## Verified Starting State

State below is the live tree **as T-070c leaves it**. Rows marked *(pre-existing)* were verified directly on 2026-08-20; rows marked *(from T-070a/b/c)* name what those packets introduce and must be re-confirmed at pre-flight.

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/drop-target.ts` | `DropTarget = { container: ContainerId; index: number }`, `ContainerGeometry = { id, rect, midpoints }`, `resolveDropIndex(pointerY, midpoints)`, `resolveDropTarget(pointer, containers, overlay)`, `PANEL_EDGE_DOCK_WIDTH = 96` *(pre-existing, 93 lines)* | **The file this packet extends.** Pure and DOM-free by design so it is unit-testable without a browser. Its module comment fixes the contract: the returned target "is the same object that must be committed on release — there is no separate 'decorative' highlight anywhere in the app." Its `resolveDropTarget` doc comment fixes the precedence: containment first (floats before docks, floats sorted by **descending** z so the topmost thing under the cursor wins), then the edge band, then `null`. **Preserve both comments and both properties.** |
| `src/app/shell/panels/drop-target.ts` | `resolveDropIndex()` | Counts midpoints strictly above `pointerY`: 0 above the first, `midpoints.length` below the last, the seam index in between. **Axis-agnostic** — it is reused verbatim for horizontal tab positions. |
| `src/app/shell/panels/drag.ts` | `startPanelDrag(id, event)`, `containerGeometries(excludeId, excludeContainerId)`, `readContainerGeometry(el, id, excludeId)`, `panelInsertionTarget`, `setPanelInsertionTarget`, `clearPanelInsertionTarget`, `draggingContainer`, `panelDraggingId`, `panelSnapGuides`, `DRAG_START_THRESHOLD = 4`, `isInteractiveTarget()` | The DOM-reading half plus the gesture driver. `readContainerGeometry` reads `[data-group-index]` after T-070c. `containerGeometries`'s doc comment explains why floats come first in descending z and why `excludeContainerId` must be skipped **entirely** rather than merely excluded from midpoints — carry both forward verbatim. |
| `src/app/shell/panels/drag.ts` | `startPanelDrag`'s `finish()` — `structuredClone` snapshot, `writePanelLayout(beforeLayout)` on cancel, `requestAnimationFrame` coalescing via `schedule()`, `snapPanelRect(..., { enabled: !moveEvent.altKey && target === null })`, Escape/`pointercancel` handling, `setPointerCapture` | **The machinery `startGroupDrag` must reuse verbatim.** Note the snap gate: a resolved target always wins over floating-to-floating snap, Alt or not; Alt disables only the snap. |
| `src/app/shell/panels/drag.ts` | `startContainerDrag(id, event)` *(call site moved to `FloatTitleBar.vue` by T-070b)* | The whole-window drag. **Unchanged by this packet**; only named here so the three gestures can be shown not to overlap. |
| `src/components/Shell/PanelTabStrip.vue` *(from T-070c)* | root `<header>` `flex h-[33px] shrink-0 items-center gap-0 border-b border-border bg-panel px-1 select-none`, `:data-test-id="panel-tab-strip-<containerId>-<groupIndex>"`, the tab buttons carrying `data-tab-id`, the `<div class="min-w-0 flex-1" />` spacer, the three group buttons | T-070c deliberately left this root with **no** `cursor-grab` and **no** `@pointerdown`. This packet adds both, and the drop caret. |
| `src/components/Shell/PanelGroup.vue` *(from T-070c)* | root `<section>` `relative flex min-h-0 flex-col overflow-hidden bg-panel`, `:data-test-id="panel-group-<containerId>-<groupIndex>"`, `:data-group-index="groupIndex"`, the five-case sizing style | The element that carries the tab-drop ring. |
| `src/components/Shell/DockInsertionTarget.vue` | `data-test-id="dock-insertion-target"`, `data-dock-insertion-target`, `:data-container-id`, `:data-index`, `:data-active`, `class="relative z-10 shrink-0 overflow-hidden transition-[height] motion-reduce:transition-none"`, `active ? 'h-[3px]' : 'h-0'`, inner `pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded bg-accent transition-opacity` *(pre-existing)* | The seam indicator. Its comment states it has no pointer handlers and only reflects whatever seam `panelInsertionTarget` names. **Unchanged visually**; only the prop that decides `active` changes shape. |
| `src/components/Shell/PanelStack.vue` | `isActiveSeam(index)`, the `DockInsertionTarget` placement at index 0 and after every group, the group `v-for`, `data-container-id`, the seam divider | Where the seam indicators are rendered and where the ring/caret must not be duplicated. |
| `src/components/Shell/PanelOverlay.vue` | `emptyDockTargetSide`, `data-test-id="panel-empty-dock-target"`, class `absolute inset-y-0 border-2 border-dashed border-accent bg-accent/10`, `:aria-label="panels.dropPanelHere"` *(pre-existing)* | The empty-dock edge band. Its comment records that targeting itself already resolved this from the edge-band rule, and that this element is purely visual. **Unchanged**; only the target-kind test changes. |
| `src/app/shell/panels/operations.ts` *(from T-070c)* | `movePanel(layout, id, target: ContainerId, index: number)` and its "one atomic path for every kind of drop" doc comment; `setActiveTab`; `closeGroup`; `floatGroup`/`dockGroup`; `detachPanel` | `movePanel` gains the target union here. **Preserve the one-atomic-path property and its comment.** |
| `src/app/shell/panels/snap.ts` | `snapPanelRect()`, `PANEL_SNAP_THRESHOLD = 8`, `SnapGuide` | Float-to-float and overlay-edge snapping, already covered by `tests/engine/app/shell/panels/snap.test.ts` and `tests/e2e/panels/basic.spec.ts`. **Untouched.** |
| `tests/engine/app/shell/panels/drop-target.test.ts` | its `container(id, rect, midpoints)` factory and `overlay = { left: 0, right: 1200 }` | The existing pure-resolver suite. It is extended, not replaced; keep the factory shape. |
| `tests/e2e/panels/basic.spec.ts` | "dock targets resolve geometrically and symmetrically, commit exactly what they preview, and cancel atomically" (≈ line 278) | **The existing preview-equals-commit proof.** Its tab equivalent is this packet's headline acceptance test. |
| `tests/e2e/panels/helpers.ts` *(from T-070c)* | `dragTabTo()`, `dragFloatTo()`, `dragFloatTitleTo()`, `floatingWindowFor()`, `ensurePanelOpen()`, `readPanelLayout()` | The harness. It gains one helper here. |
| `src/app.css` | `--color-accent`, `--color-border`, `--color-panel` | The semantic tokens. Do not edit this file. |

## Read First

1. `src/app/shell/panels/drop-target.ts` — all 93 lines, both doc comments in full.
2. `src/app/shell/panels/drag.ts` — `containerGeometries`, `readContainerGeometry`, then `startPanelDrag` end to end.
3. `src/components/Shell/PanelTabStrip.vue` and `PanelGroup.vue` as T-070c leaves them.
4. `src/components/Shell/DockInsertionTarget.vue` and `PanelOverlay.vue`.
5. `tests/engine/app/shell/panels/drop-target.test.ts` and `tests/e2e/panels/basic.spec.ts`'s dock-target test.

## Corrections to the Brief

- **"Snapping" is already delivered and is not in scope.** `snap.ts` provides float-to-float and overlay-edge snapping with an 8 px threshold and an Alt bypass, proven by `snap.test.ts` and `basic.spec.ts`. The request's phrase "intuitive snapping, reordering, and docking" is satisfied for snapping by existing code; this packet delivers the reordering and docking halves. Do not refactor `snap.ts`.
- **There is no "decorative highlight" to add.** `drop-target.ts`'s module comment and `DockInsertionTarget.vue`'s comment both record that the resolved target *is* the indicator and *is* what commits. The new ring and caret must be driven from `panelInsertionTarget` exactly the same way — do **not** introduce a second hover-driven highlight path.

## Fixed Decisions

1. **`DropTarget` becomes a two-case discriminated union.**

   ```ts
   export type DropTarget =
     | { kind: 'tab'; container: ContainerId; groupIndex: number; tabIndex: number }
     | { kind: 'group'; container: ContainerId; groupIndex: number }
   ```

   `kind: 'group'` means "create a new group at this seam", where `groupIndex` is a post-removal insertion index in `0..groups.length` — the same contract the current `index` already carries. `kind: 'tab'` means "join the group already at `groupIndex`, as a tab at `tabIndex`". Reason: two landing kinds need two shapes, and a discriminant makes the render side total (`v-if` per kind, no `undefined` checks).

2. **Geometry gains a per-group layer.**

   ```ts
   export interface GroupGeometry {
     rect: { left: number; top: number; right: number; bottom: number }
     /** Horizontal midpoints of this group's tab buttons, in order, with the dragged panel's own tab excluded. */
     tabMidpointsX: number[]
   }
   export interface ContainerGeometry {
     id: ContainerId
     rect: { left: number; top: number; right: number; bottom: number }
     groups: GroupGeometry[]
   }
   ```

   The flat `midpoints: number[]` is removed; group seams are derived from `groups[].rect` instead. Reason: seam and tab resolution both need the group rects, and deriving seams from rects removes the possibility of the two lists disagreeing.

3. **`resolveDropIndex()` is reused verbatim for tab positions.** It counts midpoints strictly below a coordinate and is axis-agnostic; passing `pointer.x` and `tabMidpointsX` gives the tab index with the same 0/`length`/seam semantics. Reason: one tested primitive, no second implementation to drift.

4. **Resolution order in `resolveDropTarget(pointer, containers, overlay, options)`**, extending the documented precedence rather than replacing it:
   1. For each container in the given order (floats first, descending z, then `left`, then `right` — **unchanged**), if the pointer is inside the container rect:
      a. if the pointer is inside `groups[i].rect` **and** within `PANEL_SEAM_ZONE` px of that rect's top → `{ kind: 'group', groupIndex: i }`; within `PANEL_SEAM_ZONE` px of its bottom → `{ kind: 'group', groupIndex: i + 1 }`;
      b. otherwise, if the pointer is inside `groups[i].rect` → `{ kind: 'tab', groupIndex: i, tabIndex: resolveDropIndex(pointer.x, groups[i].tabMidpointsX) }`;
      c. otherwise (inside the container but in no group's rect) → `{ kind: 'group', groupIndex: <count of group rects whose vertical midpoint is above pointer.y> }`.
   2. Otherwise, within `PANEL_EDGE_DOCK_WIDTH = 96` of the overlay's left/right edge → `{ kind: 'group', container: <that side>, groupIndex: groups.length }`.
   3. Otherwise `null`.

   Reason: this reproduces InDesign's blue-line-versus-blue-frame distinction with one pure function and no DOM in the decision path. Rule 1c preserves today's behaviour for the gap below the last group and for an empty container.

5. **`PANEL_SEAM_ZONE = 28`**, added to `types.ts` and exported from the barrel. Reason: comfortably larger than the 3 px indicator and the 8 px divider hit area so the band is easy to hit, and comfortably smaller than the 96 px minimum group height so the middle of even the shortest group is still a tab target. A group shorter than `2 * PANEL_SEAM_ZONE` — only possible for a collapsed 33 px rail — resolves entirely to seams, split at its vertical midpoint; state this explicitly in the resolver so it is not an accident.

6. **A group drag passes `{ allowTab: false }`**, which skips rule 4.1b and folds a body hit into 4.1a's nearer edge. A group can only ever land as a whole group at a seam, never as tabs. Reason: merging every tab of one group into another is a different operation with different loss characteristics; InDesign does not do it on a group drag either.

7. **Three gestures, three handles, no overlap.**

   | Gesture | Handle | Entry point | Target kinds it can resolve |
   | --- | --- | --- | --- |
   | Move one panel | a tab button, `panel-tab-<panelId>` | `startPanelDrag(id, event)` *(exists)* | `tab` and `group` |
   | Move one group | the tab strip outside any button, `panel-tab-strip-<containerId>-<groupIndex>` | `startGroupDrag(container, groupIndex, event)` *(new)* | `group` only |
   | Move a float window | the window title bar, `float-title-<containerId>` | `startContainerDrag(floatId, event)` *(T-070b)* | none — no drop targeting |

   Each inner handler calls `event.stopPropagation()` so the inner handle always wins, exactly as `startPanelDrag` does today. `isInteractiveTarget()` already excludes the group buttons from both drag starts.

8. **`startGroupDrag` reuses `startPanelDrag`'s machinery verbatim** — same `DRAG_START_THRESHOLD`, same `requestAnimationFrame` coalescing, same `structuredClone` before-layout snapshot, same `writePanelLayout(beforeLayout)` rollback on Escape and `pointercancel`, same `setPointerCapture`, same snap gate `{ enabled: !altKey && target === null }`. On first move past the threshold it calls `floatGroup(container, groupIndex, <measured rect>)` *(from T-070c)* to lift the whole group into a new float, then tracks the pointer and commits `moveGroup(...)` on release. Reason: three near-identical gesture drivers already exist; a fourth divergent one is how rollback bugs get in. Extract the shared body only if it can be done without changing `startPanelDrag`'s observable behaviour — otherwise duplicate the structure and say so in the Execution Report.

9. **`moveGroup(layout, from, to)`** is added to `operations.ts`: lift the whole group object out of `from.container` at `from.groupIndex` and splice it into `to.container` at a clamped `to.groupIndex`, preserving `members`, `active`, `height` and `collapsed`, then return `normaliseV5(...)`. Reason: the group is moved intact; re-deriving it member by member would lose the active tab and the pinned height.

10. **`movePanel(layout, id, target: DropTarget)`** replaces the `(target, index)` signature and keeps **one atomic path**: remove `id` from every group (pruning emptied groups and float containers), set `open = true`, then — for `kind: 'tab'` — splice into `groups[groupIndex].members` at a clamped `tabIndex` and set that group's `active = id`; for `kind: 'group'` — splice a fresh single-tab group at a clamped `groupIndex`. Reason: `movePanel`'s existing doc comment records that one path handling every drop kind is what makes merging "just work"; preserve that property and the comment.

11. **The tab-drop indicator is two elements, both driven from `panelInsertionTarget`**: a ring on the target `PanelGroup` root and a caret in that group's tab strip at `tabIndex`. No hover state, no pointer handler, no second source of truth. Reason: the "preview equals commit" invariant recorded in `drop-target.ts`'s module comment.

12. **`snap.ts` is untouched**, and so is `startContainerDrag`. Reason: both are correct and tested; see Corrections.

13. **No new i18n key.** The ring and caret are non-textual; the empty-dock band already uses `panels.dropPanelHere`. Reason: `App/package.json` has no `check:i18n` script.

## Open Decisions

1. **Should `PANEL_SEAM_ZONE` be a fixed 28 px or a fraction of the group's height?**
   *Recommended default — implement this:* **fixed 28 px**, with the explicit degenerate-case rule in Fixed Decision 5 for a group shorter than 56 px. It keeps the resolver a pure function of rects with no scaling arithmetic, and 28 px is a comfortable pointer target at every window size.
   *Alternative:* `min(28, height * 0.25)`. Consequence: the band would shrink on short groups exactly when it is hardest to hit, and the unit tests would need per-height expectations rather than fixed ±1 px boundaries. Rejected.

## Visual Contract — binding

### Tab-drop ring — on `src/components/Shell/PanelGroup.vue`'s root

Applied when `panelInsertionTarget` is `{ kind: 'tab' }` naming this `containerId` and `groupIndex`:

```
ring-2 ring-accent ring-inset
```

While active, the root's `data-test-id` **switches** to `panel-group-drop-ring` (it is otherwise `panel-group-<containerId>-<groupIndex>`). Do **not** add a second overlay element, and do not change the root's own class string, sizing style, or `data-group-index`.

### Tab-drop caret — in `src/components/Shell/PanelTabStrip.vue`

A sibling `div` rendered between tab buttons at the resolved `tabIndex` (and after the last tab when `tabIndex === members.length`), only while `panelInsertionTarget` is `{ kind: 'tab' }` for this group:

```
pointer-events-none h-[21px] w-[2px] shrink-0 rounded bg-accent
```

`data-test-id="panel-tab-caret"`. The `h-[21px]` is the 33 px strip less its 6 px of vertical padding either side; `rounded` and `bg-accent` match `DockInsertionTarget.vue`'s inner bar.

### Tab strip becomes a group drag handle — `src/components/Shell/PanelTabStrip.vue`

The root `<header>` gains, appended to its existing class string:

```
cursor-grab active:cursor-grabbing
```

(the same idiom `PanelTitleBar.vue` used, now living here) and `@pointerdown="startGroupDrag(containerId, groupIndex, $event)"`. Its existing `@dblclick` and `@keydown` handlers, `data-test-id`, `role`, `tabindex` and `aria-*` attributes are **unchanged**. Each tab button's own `@pointerdown` already calls `event.stopPropagation()` before `startPanelDrag`; verify that at pre-flight.

While this group is the one being dragged (`draggingContainer` names its lifted float), the root additionally gets `opacity-40` — the same convention `TabBar.vue` uses for a dragged tab and T-070c reused for a dragged panel tab.

### Unchanged, do not restyle

`DockInsertionTarget.vue` — every class string, both `h-[3px]`/`h-0` states, the `transition-[height] motion-reduce:transition-none` and `transition-opacity`, and all five data attributes. `PanelOverlay.vue`'s empty-dock band (`absolute inset-y-0 border-2 border-dashed border-accent bg-accent/10`) and its snap guides (`absolute bg-accent`). `PanelStack.vue`'s scroll wrapper, seam divider, `dock-width-divider` and root. `PanelGroup.vue`'s class string and sizing style. `FloatTitleBar.vue` and `FloatingPanel.vue`.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only the semantic tokens already in `src/app.css`: `bg-accent`, `ring-accent`, `border-accent`, `border-border`, `bg-panel`, `text-surface`, `text-muted`, `bg-hover`.
- **No font-size class other than `text-xs` or `text-[11px]`.** Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded`, `rounded-md`, `rounded-lg` or `rounded-t-lg`.** Never `rounded-xl`, `rounded-2xl`, `rounded-full`.
- **No second highlight path.** Every indicator must read `panelInsertionTarget`. No `:hover`-driven drop styling, no `dragenter`/`dragleave`, no HTML5 drag-and-drop API.
- **No DOM access inside `drop-target.ts`.** It stays pure and unit-testable without a browser.
- **No change to `snap.ts`, `startContainerDrag()` or `startPanelResize()`.**
- **No new `tv()` recipe, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.** `panelInsertionTarget` in `drag.ts` and `panelLayout` in `layout.ts` remain the only state.
- **No inline `style=`** in any element this packet adds.
- **No animation library.** The existing `transition-*` utilities are sufficient.

## Allowed Changes

Modify:

- `src/app/shell/panels/{drop-target,drag,operations,layout,types,index}.ts`
- `src/components/Shell/{PanelTabStrip,PanelGroup,PanelStack,PanelOverlay}.vue`
- `tests/engine/app/shell/panels/{drop-target,operations,groups}.test.ts`
- `tests/e2e/panels/{helpers.ts,basic.spec.ts,stacks.spec.ts,tabbed-groups.spec.ts}`

Create: nothing. Delete: nothing.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **Do not touch `src/app/shell/panels/snap.ts`, `resize.ts`, `hosts.ts`, `registry.ts` or `containers.ts`**, or `snap.test.ts`. `containers.ts` changes only if invariant 10's clamp genuinely needs it — if it does, stop and report rather than editing quietly.
- **Do not change `startContainerDrag()`'s body or `FloatTitleBar.vue`.** T-070b landed those.
- **Do not change group sizing, the scroll wrappers, or `scrollClass`.** T-070a landed those.
- **Do not change the schema version, `PanelGroup`'s shape, the default layout, or the migration chain.** T-070c landed those. `PANEL_SEAM_ZONE` is a layout constant, not a persisted field, so no migration is involved.
- **Do not touch `src/app/shell/menu/use.ts`, `app-menu.ts`, or `src/views/EditorView.vue`.** `tests/engine/app/shell/menu/window-panels.test.ts` must pass **unedited**.
- **Do not change any panel's content**, `WorkspacePanel.vue`, or `WorkspacePanelContent.vue`.
- **Do not add tab reordering *within* a group by any route other than the ordinary tab drag** resolving to a `kind: 'tab'` target in its own group. No separate reorder mode, no `useFlatReorderDrag` import.
- **Do not change the `localStorage` key** or add a second one.
- **No workspace preset or switcher UI** (T-032), **no collapsed icon rail** (T-033), **no drag out of the app window**.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070a, T-070b and T-070c are all Done. Reread `drop-target.ts` in full, `drag.ts`'s `containerGeometries`/`readContainerGeometry`/`startPanelDrag`, and `PanelTabStrip.vue`/`PanelGroup.vue` as T-070c left them. Confirm `DropTarget` is still `{ container, index }`, that `PanelTabStrip.vue`'s root has no `@pointerdown`, that each tab button's `@pointerdown` calls `stopPropagation()`, and that `PanelGroup.vue`'s root carries `data-group-index`. If any has drifted, stop and report.

**2 — `src/app/shell/panels/types.ts`.** Add `export const PANEL_SEAM_ZONE = 28` beside `PANEL_EDGE_DOCK_WIDTH`'s neighbours, with a one-line doc comment: the band at a group's top and bottom edge that resolves to a new-group seam rather than a tab. Nothing else in the file changes.

**3 — `src/app/shell/panels/drop-target.ts`.** Replace `DropTarget` and `ContainerGeometry` with the shapes in Fixed Decisions 1 and 2, adding `GroupGeometry`. Keep `resolveDropIndex()` **byte-identical** and add one sentence to its doc comment noting it is axis-agnostic and used for both seams and tabs. Keep `containsPoint()` and `PANEL_EDGE_DOCK_WIDTH`. Rewrite `resolveDropTarget()` to Fixed Decision 4, taking `options: { allowTab: boolean } = { allowTab: true }`, and rewrite its doc comment to describe the three landing kinds in the same numbered style the current comment uses — **preserving the sentences about float-before-dock ordering, descending z, and the target being what commits**. Handle the degenerate short-group case from Fixed Decision 5 explicitly and comment it. **The module must remain DOM-free.**

**4 — `src/app/shell/panels/drag.ts`, geometry.** Rewrite `readContainerGeometry(containerEl, id, excludeId)` to return the new `ContainerGeometry`: the container's own rect, then for each `[data-group-index]` child in document order, that group's rect plus the horizontal midpoints of its `[data-tab-id]` elements inside `[data-test-id^="panel-tab-strip-"]`, skipping the tab whose `data-tab-id === excludeId`. A group whose only tab is the dragged panel still contributes its rect with an empty `tabMidpointsX`. Leave `containerGeometries()`'s ordering, its `excludeContainerId` skip, and both doc comments **verbatim**.

**5 — `src/app/shell/panels/drag.ts`, gestures.** In `startPanelDrag`, change the commit to `movePanel(id, target)` with the union, and leave every other line — threshold, snapshot, coalescing, snap gate, rollback, pointer capture — untouched. Add `startGroupDrag(container: ContainerId, groupIndex: number, event: PointerEvent)` per Fixed Decision 8: guard with `event.button !== 0 || isInteractiveTarget(event.target)`, snapshot the layout, on first move past the threshold call `floatGroup(container, groupIndex, <measured group rect in overlay coordinates>)` and record the lifted float id, resolve with `{ allowTab: false }` on every frame, set `insertionTarget`, and commit `moveGroup(...)` on release. Export it from the barrel.

**6 — `src/app/shell/panels/operations.ts`.** Change `movePanel` to Fixed Decision 10's signature and behaviour, preserving its doc comment's "one atomic path" claim. Add `moveGroup` per Fixed Decision 9. Both stay pure, total, non-throwing, and return `normaliseV5(...)`. No other operation changes.

**7 — `src/app/shell/panels/layout.ts` and `index.ts`.** Update `movePanel`'s reactive wrapper to the union signature and add `moveGroup`. In `index.ts`, export `startGroupDrag`, `moveGroup`, `PANEL_SEAM_ZONE`, `GroupGeometry`, and the new `DropTarget` union; remove nothing else.

**8 — `src/components/Shell/PanelGroup.vue`.** Add the ring classes and the `data-test-id` switch per the Visual Contract, computed from `panelInsertionTarget`. No other change.

**9 — `src/components/Shell/PanelTabStrip.vue`.** Add `cursor-grab active:cursor-grabbing` and `@pointerdown="startGroupDrag(...)"` to the root, the `opacity-40` dragged state, and the caret element at the resolved `tabIndex`. No other change.

**10 — `src/components/Shell/PanelStack.vue`.** Change `isActiveSeam(index)` to test `panelInsertionTarget?.kind === 'group'` with a matching container and `groupIndex`. No class or placement change.

**11 — `src/components/Shell/PanelOverlay.vue`.** Change `emptyDockTargetSide` to test `target.kind === 'group'` before reading `target.container`. No class change.

**12 — Unit tests.** Extend `tests/engine/app/shell/panels/drop-target.test.ts`, keeping its existing `container()` factory shape (adapted to `groups`): tab-versus-seam resolution at exactly `PANEL_SEAM_ZONE - 1`, `PANEL_SEAM_ZONE`, and `PANEL_SEAM_ZONE + 1` from both a group's top and its bottom; `tabIndex` resolving to 0, a middle index and `members.length`; a group with an empty `tabMidpointsX` resolving to `tabIndex: 0`; a 33 px collapsed group resolving entirely to seams split at its midpoint; `allowTab: false` folding a body hit to the nearer seam; the float-over-dock descending-z precedence still holding; the pointer below the last group still returning `{ kind: 'group', groupIndex: groups.length }`; the edge band still returning `{ kind: 'group', groupIndex: groups.length }` for the matching side; and `null` outside everything. In `operations.test.ts` / `groups.test.ts`: `movePanel` with a `tab` target inserting at the clamped index and setting `active`; `movePanel` with an out-of-range `tabIndex` clamping rather than throwing; `movePanel` with a `group` target creating a single-tab group; a same-group tab move reordering without duplication; `moveGroup` across containers preserving `members`, `active`, `height` and `collapsed`; `moveGroup` with an out-of-range index clamping. Do **not** edit `snap.test.ts`, `containers.test.ts`, `registry.test.ts`, `layout.test.ts` or `window-panels.test.ts`.

**13 — E2E harness.** In `tests/e2e/panels/helpers.ts`, add `dragTabStripTo(page, containerId, groupIndex, target)`, pressing a point inside `panel-tab-strip-<containerId>-<groupIndex>` that is inside the spacer — to the right of the last tab and to the left of the first group button — and dragging to `target`. Keep `dragTabTo`, `dragFloatTo` and `dragFloatTitleTo` unchanged.

**14 — E2E specs.** Extend `tests/e2e/panels/tabbed-groups.spec.ts`:
- dragging a tab onto another group's tab strip adds it as a tab at the caret position, makes it active, and the persisted `members` array matches;
- **preview equals commit** — mirroring `basic.spec.ts`'s existing dock-target test: at three pointer positions (a group's middle, 10 px below its top, 10 px above its bottom) assert which of `panel-group-drop-ring` / `panel-tab-caret` / `dock-insertion-target[data-active]` is visible, release, and assert the persisted layout matches exactly what was shown;
- dropping within `PANEL_SEAM_ZONE` of a group's top creates a new group **above** it, not a tab;
- dragging a tab within its own group's strip reorders it without duplication;
- dragging a tab strip moves the whole group, tabs and active tab intact, into another container;
- a tab-strip drag never produces a `panel-tab-caret` or a ring (`allowTab: false`);
- Escape mid-drag restores the layout byte-for-byte, for both a tab drag and a strip drag;
- the edge band still appears and commits when a dock is emptied;
- pressing a group button in the strip does not start a drag.

**15 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] `DropTarget` is the two-case union; `ContainerGeometry` carries `groups: GroupGeometry[]` and no flat `midpoints`.
- [ ] `resolveDropIndex()` is byte-identical to before and is the only index arithmetic for both seams and tabs.
- [ ] `drop-target.ts` contains no DOM access and its unit suite runs without a browser.
- [ ] Tab-versus-seam resolution is exact at `PANEL_SEAM_ZONE ± 1` from both a group's top and bottom (`drop-target.test.ts`).
- [ ] A collapsed 33 px group resolves entirely to seams, split at its midpoint (`drop-target.test.ts`).
- [ ] `allowTab: false` never returns a `tab` target (`drop-target.test.ts`, `tabbed-groups.spec.ts`).
- [ ] The float-before-dock, descending-z precedence still holds (`drop-target.test.ts`).
- [ ] While dragging, **exactly one** indicator is visible — the ring plus its caret, or one active seam line, or the dashed edge band — and release commits precisely what was shown (`tabbed-groups.spec.ts`, preview-equals-commit test).
- [ ] Dragging a tab onto a group's tab strip adds it at the caret position and makes it active; dragging a tab within its own strip reorders without duplication (`tabbed-groups.spec.ts`).
- [ ] Dragging a tab strip moves the whole group with its tabs, active tab, pinned height and collapsed state intact (`tabbed-groups.spec.ts`).
- [ ] Escape mid-drag restores the layout byte-for-byte for both gesture kinds (`tabbed-groups.spec.ts`).
- [ ] `movePanel` is still one atomic path for every landing kind, and its doc comment still says so.
- [ ] `snap.ts`, `startContainerDrag()` and `startPanelResize()` are unchanged; `snap.test.ts`, `containers.test.ts`, `registry.test.ts`, `layout.test.ts` and `window-panels.test.ts` pass **with no edit**.
- [ ] No hover-driven drop styling, no HTML5 drag API, no second highlight source anywhere in the diff.
- [ ] Nothing in the Banned List appears in the diff; all four themes are correct because only semantic tokens are used (Integration Check 6).
- [ ] No new file, dependency, `tv()` recipe, i18n key, `src/app.css` edit, schema bump, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0. `packages/vue/tsconfig.json` is **not** required: no package source changes.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ src/components/Shell/ tests/engine/app/shell/panels/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0; the extended `drop-target.test.ts` green.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.
6. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0 across all four specs.
7. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts --project=openpencil` — expect exit 0; panel content is unaffected by the targeting change.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **Tab targeting.** Drag the Layers tab slowly across the right dock. Over the middle of a group, confirm an accent ring around that whole group **and** a 2 px caret in its tab strip that moves between tabs as you move horizontally. Release and confirm Layers lands as a tab at exactly the caret's position and becomes active.
2. **Seam targeting.** Move the same drag to within roughly 28 px of a group's top edge — confirm the ring and caret disappear and a single 3 px accent line appears at that seam. Release and confirm a new group is created above, not a tab. Repeat at a bottom edge.
3. **Preview equals commit.** At five different pointer positions, note which indicator is showing, release, and confirm the persisted layout matches in every case. Then repeat and press Escape instead — confirm the layout is unchanged and no indicator is left on screen.
4. **Group drag.** Press a tab strip's empty area (right of the last tab, left of the group buttons) and drag. Confirm the whole group lifts with all its tabs, that **no** ring or caret ever appears, that only seam lines and the edge band do, and that releasing lands the group intact with its active tab and pinned height. Confirm pressing a group button instead does not start a drag.
5. **Reordering and edges.** Drag a tab left and right within its own strip and confirm it reorders without duplicating. Empty one dock completely, then drag toward that screen edge and confirm the dashed band appears and commits.
6. **Themes and motion.** Cycle light, grey, dark and midnight; confirm the ring, caret and seam line are all clearly visible in each. With OS reduced-motion enabled, confirm the seam indicator still appears (`motion-reduce:transition-none`) and nothing animates.
7. **Non-regression.** Confirm float-to-float snapping and the Alt bypass still work (T-031 behaviour); the `float-title-*` whole-window drag from T-070b still moves every group with no drop targeting; the single column scrollbar from T-070a is still single; tab switching still preserves the Code panel's content (T-070c); the Window menu, View ▸ Reset panel layout and canvas input under a floating window all still behave; the layout survives a reload.

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070a, T-070b or T-070c is not Done, or pre-flight finds `DropTarget` already changed, `PanelTabStrip.vue`'s root already carrying a `@pointerdown`, or a tab button no longer stopping propagation. The tree has drifted.
- `startGroupDrag` cannot reuse `startPanelDrag`'s machinery without changing `startPanelDrag`'s observable behaviour. Duplicate the structure instead, and report that you did.
- A tab press also starts a group drag, or a strip press also starts a window drag, and `stopPropagation()` alone cannot separate them.
- The resolver needs DOM access to distinguish a tab target from a seam target — that would break `drop-target.ts`'s DOM-free contract and its unit suite.
- The ring or caret cannot be driven from `panelInsertionTarget` alone and would need a second hover-driven path.
- `movePanel` cannot stay one atomic path across both target kinds.
- `snap.test.ts`, `containers.test.ts`, `registry.test.ts`, `layout.test.ts` or `window-panels.test.ts` requires an edit to pass — that means this packet changed a contract it promised not to touch.
- The change needs a new file, dependency, `tv()` recipe, `src/app.css` edit, i18n key, schema bump, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file modified, with a one-line reason each;
- the final `DropTarget`, `GroupGeometry` and `ContainerGeometry` declarations, and the resolver's numbered precedence exactly as landed;
- whether `startGroupDrag` shares `startPanelDrag`'s machinery or duplicates its structure, and why;
- **which `src/app/shell/panels/index.ts` exports were added, renamed or removed** — T-032 (Ready) consumes this barrel and its expansion must be reconciled against the delta;
- confirmation, by grep output, that `drop-target.ts` contains no DOM access and that `snap.ts`, `startContainerDrag()` and `startPanelResize()` are unchanged;
- the exact `data-test-id` values delivered for the ring and the caret;
- every command from Verification with its exact exit code, test counts and any failure output, including the `PANEL_SEAM_ZONE ± 1` boundary cases;
- confirmation that `snap.test.ts`, `containers.test.ts`, `registry.test.ts`, `layout.test.ts` and `window-panels.test.ts` passed unedited;
- the browser observations for all seven Integration Check items, at both viewport widths, with the preview-equals-commit results listed per pointer position;
- confirmation that no new file, dependency, `src/app.css` edit, i18n key, schema bump, version-file change, build, install or Git work occurred;
- the Open Decision as resolved, plus any assumption or remaining gap;
- an explicit statement that requirement group 2 — and therefore the whole T-070 series — is now complete, or exactly what remains.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: created as the final slice of the T-070 split, expanded against live `App/` source.

## Status record

Status: **Ready**

Expansion receipt (2026-08-20). Verified against live source:

1. **`drop-target.ts` is deliberately DOM-free** so it is unit-testable without a browser, and its module comment fixes the invariant that the resolved target *is* the indicator and *is* what commits. Both properties must survive the union change.
2. **`resolveDropIndex()` is already axis-agnostic** — it counts midpoints strictly below a coordinate — so tab positions reuse it verbatim rather than getting a second implementation.
3. **`containerGeometries()`'s float-before-dock, descending-z ordering and its `excludeContainerId` skip are load-bearing**, and its doc comment explains exactly why: without the skip, a dragged panel would resolve *itself* as a drop target for the whole gesture.
4. **`startPanelDrag`'s snap gate is `!altKey && target === null`** — a resolved target always beats floating-to-floating snap, and Alt disables only the snap. `startGroupDrag` must reproduce that, not invent its own rule.
5. **Snapping is already delivered** by `snap.ts` and is covered by `snap.test.ts` and `basic.spec.ts`; the request's "snapping" is satisfied by existing code and is explicitly out of scope.
6. **`basic.spec.ts`'s "dock targets … commit exactly what they preview, and cancel atomically" test is the model** for this packet's headline acceptance test; the tab equivalent mirrors it rather than inventing a new assertion style.
7. **No new i18n key is needed** — the ring and caret are non-textual and the edge band already uses `panels.dropPanelHere`.

One Open Decision was left with an implemented default (fixed 28 px seam zone, with an explicit degenerate rule for a collapsed group). It is a taste call with a stated alternative and does not block execution.
