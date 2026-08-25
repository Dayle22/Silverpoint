# T-070b - A real floating-window title bar as the whole-window drag handle

Task ID: T-070b
Packet state: Superseded — scope map only; execute T-070b1 then T-070b2
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-070a (land it first — it edits `PanelStack.vue` and `types.ts`, and this packet's float-height floor builds on its renamed constant)
Related: T-070c, T-070d, T-031c (Done)
Prepared from: the user's 2026-08-20 InDesign-referenced panel request, requirement group 3; second slice of the T-070 split
Expanded at: 2026-08-20 08:24 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/components/Shell/{FloatingPanel,PanelStack,PanelOverlay}.vue`, `src/app/shell/panels/{drag,resize,containers,types,layout,index}.ts`, `src/components/ui/panel/PanelTitleBar.vue`, `src/components/TabBar.vue`, `src/components/ui/IconButton.vue`, `packages/vue/src/i18n/messages/panels.ts`, `src/app.css`, `tests/e2e/panels/{helpers,stacks,basic}.spec.ts`
Delivery: named source gates + browser check

## Intended Outcome

Every floating panel window gets a real 24 px title bar across its top. Pressing and dragging that bar moves the **whole** window — every stacked member together — the way InDesign's floating panel groups do. The current situation, where the only place the whole-window drag can start is inside a member's body because the window's actual border pixels are entirely covered by resize handles, is gone.

## Request Coverage

Requirement group 3 of the 2026-08-20 request, verbatim:

- Fix floating panel group movement so that dragging the group container/header moves the entire stacked cluster together.

Groups 1, 2, 4 and 5 belong to T-070a/c/d. This packet delivers no tabs, no new drop targets and no sizing change.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/components/Shell/FloatingPanel.vue` | `onFramePointerDown()`, the root `@pointerdown="onFramePointerDown"`, root class `pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-lg`, `HANDLES`, `HANDLE_CLASS`, `allCollapsed`, `style` | **The defect site.** The whole-window drag is bound to the window root, and the root's own comment claims a press "lands inside a title bar" or on a resize handle and is stopped there — leaving only the frame. But `HANDLE_CLASS` tiles all four edges (`h-1.5`/`w-1.5` strips inset by `2`) and all four corners (`size-3`), so the frame has effectively no pressable pixels. |
| `src/app/shell/panels/drag.ts` | `startContainerDrag(id: FloatId, event: PointerEvent)` (≈ lines 259–350), its doc comment "Drags a float container's own frame … moves the whole stack as a unit via `setFloatRect`" | **Already correct and already tested.** It raises the float, snapshots the layout, coalesces moves with `requestAnimationFrame`, snaps unless Alt is held, clamps to the overlay, and rolls back on Escape or `pointercancel`. This packet does not change its body — only what element calls it. |
| `src/app/shell/panels/drag.ts` | `isInteractiveTarget()` | Guards every drag start against `button, a, input, [role="button"]`. The new title bar inherits this for free. |
| `src/app/shell/panels/resize.ts` | `startPanelResize()`, `RESIZE_CURSORS`, its `event.stopPropagation()` | Each of the eight handles stops propagation, so a handle press can never reach the title bar. Unchanged. |
| `src/components/ui/panel/PanelTitleBar.vue` | the `header` class `flex h-[33px] shrink-0 items-center gap-1 border-b border-border bg-panel px-2 select-none`, `cursor-grab active:cursor-grabbing`, `icon-lucide-grip-vertical class="size-3 shrink-0 text-muted"`, the label `span class="min-w-0 flex-1 truncate text-[11px] font-semibold text-surface"`, `onKeydown`'s `NUDGE_STEP`/`NUDGE_STEP_LARGE` arrow handling | **The pattern to copy.** The new bar is the same idiom at 24 px with a horizontal grip. This file is otherwise untouched here; T-070c deletes it. |
| `src/components/TabBar.vue` | the `data-test-id="desktop-shell-chrome"` row, `Tip` usage, `min-w-0 flex-1` spacer | Local convention for a chrome bar with a truncating label and a trailing control. |
| `src/components/ui/IconButton.vue` | `IconButton` (props `label`, `side`, `size`, `active`, `disabled`) | The icon-button primitive. Wraps its slot in `Tip` automatically when `label` is set. |
| `src/app/shell/panels/containers.ts` | invariant 10's float floor — `required = expandedCount * PANEL_MEMBER_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT` inside `normaliseMemberHeights()` (named `normaliseBasisAndHeight()` before T-070a) | The float container's minimum height. It must grow by the title bar's 24 px. |
| `src/app/shell/panels/types.ts` | `PANEL_COLLAPSED_HEIGHT = 33`, `PANEL_MEMBER_MIN_HEIGHT` (renamed from `PANEL_MIN_HEIGHT` by T-070a), `PANEL_MIN_WIDTH = 240` | The constants the new `PANEL_FLOAT_TITLE_HEIGHT` joins. |
| `src/app/shell/panels/layout.ts` | `clampRectToOverlay()` — `maxY = Math.max(0, overlay.height - 33)` | Keeps at least one title-bar's worth of a float on screen. The magic `33` becomes the new title height so the bar itself is what stays reachable. |
| `packages/vue/src/i18n/messages/panels.ts` | `panelMessageDefaults` — a label for every `PanelId`, plus `closePanel`, `floatPanel`, `dockPanel` | The bar's accessible name comes from `panels[<first member id>]`. **No new key is needed.** |
| `tests/e2e/panels/helpers.ts` | `dragContainerFrameTo()` and its comment: "Targets a point well inside the FIRST member's own body (below its title bar, away from every edge), since the container's 8 resize handles fully tile its actual border/corner pixels" | **The written record of the defect.** This helper is rewritten to press the new title bar, and the comment deleted. |
| `tests/e2e/panels/stacks.spec.ts` | the test at ≈ line 153, "adjacent expanded float members resize against each other … dragging the frame moves every member together" | The existing whole-stack-move assertion. It keeps its behaviour, retargeted to the title bar. |
| `src/app.css` | `--color-panel`, `--color-panel-secondary`, `--color-border`, `--color-surface`, `--color-muted` | The semantic tokens. Do not edit this file. |

## Read First

1. `src/components/Shell/FloatingPanel.vue` — all 83 lines, especially `HANDLE_CLASS` and the root's `@pointerdown` comment.
2. `src/app/shell/panels/drag.ts` — `startContainerDrag` in full, plus `isInteractiveTarget`.
3. `src/components/ui/panel/PanelTitleBar.vue` — the `header` element and `onKeydown`.
4. `tests/e2e/panels/helpers.ts` — `dragContainerFrameTo`, `dragFloatTo`, `floatingWindowFor`.

## Corrections to the Brief

- **Whole-group float movement is not a missing feature.** `startContainerDrag()` already moves every member together, and `tests/e2e/panels/stacks.spec.ts` already proves it. The defect is purely that `FloatingPanel.vue` binds it to the window **root**, whose border pixels are entirely covered by the eight `startPanelResize` handles, so the gesture can only be started from inside a member's body. `tests/e2e/panels/helpers.ts` documents that workaround in a comment. **Do not rewrite the drag logic.** Give it a handle.

## Fixed Decisions

1. **A new `src/components/Shell/FloatTitleBar.vue` is the one and only whole-window drag handle**, rendered as the first child of every float container, above the member stack. Reason: it makes the gesture discoverable, gives it real pressable pixels outside every resize handle, and matches the InDesign reference.

2. **The bar is always rendered, on every float container, regardless of member count.** Reason: one unambiguous handle with no runtime arbitration between "the bar drags the window" and "the title bar drags the member". The alternative — collapsing the bar for a single-member float and letting that member's title bar drag the window — would give the same element two meanings depending on member count and force two code paths in the E2E harness. If the double bar later reads as heavy, the follow-up is a one-line `v-if` here plus a fallback in the member title bar; that is not this packet.

3. **`FloatingPanel.vue`'s root `@pointerdown` and `onFramePointerDown()` are deleted.** Reason: with a real handle, a body press must not move the window. Leaving both routes live would mean a press inside Layers' tree could still drag the whole window.

4. **`PANEL_FLOAT_TITLE_HEIGHT = 24`**, added to `types.ts` and exported from the barrel. The float container's minimum height in invariant 10 becomes `PANEL_FLOAT_TITLE_HEIGHT + expandedCount * PANEL_MEMBER_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT`. Reason: the bar occupies real space, so the floor must account for it or a minimum-height window would clip its last member.

5. **`clampRectToOverlay()`'s `maxY` uses `PANEL_FLOAT_TITLE_HEIGHT`, not the literal `33`.** Reason: the rule is "keep the drag handle on screen", and the drag handle is now this bar. Behaviourally this makes a dragged-to-the-bottom window keep 24 px visible instead of 33 — a deliberate, stated change, not a drift.

6. **The bar carries a close-window button and nothing else.** It closes every member of the container via the existing `closeRegisteredPanel(id)` per member. Reason: InDesign's floating panel title bar carries exactly one control; adding collapse or pin here would duplicate what each member's own title bar already offers.

7. **The bar's label is `panels[<first member of the first group>]`**, truncated. Reason: no new i18n key, and it names what the user sees at the top of the window. `App/package.json` has no `check:i18n` script, so a new key would have to be hand-verified for no gain.

8. **The bar is keyboard-reachable and nudges the window.** `tabindex="0"`, and arrow keys call the existing `nudgePanel(firstMemberId, dx, dy)` with `shiftKey ? 10 : 1` — the exact step constants and handler shape copied from `PanelTitleBar.vue`'s `onKeydown`. Reason: the member title bar already offers this for a floating panel; moving the handle must not remove the keyboard equivalent.

9. **`startContainerDrag()`'s body is not modified.** Only its call site moves. Reason: it is correct, tested, and its rollback/coalescing/snap behaviour is exactly what the bar needs.

## Open Decisions

None. Fixed Decision 2 records the one taste call (always-render) with its alternative and the exact one-line change that would reverse it.

## Visual Contract — binding

### New file — `src/components/Shell/FloatTitleBar.vue`

Props: `containerId: FloatId`.

Root element `<header>`:

```
flex h-6 shrink-0 cursor-grab items-center gap-1 rounded-t-lg border-b border-border bg-panel-secondary px-2 select-none active:cursor-grabbing
```

(the `h-[33px] shrink-0 items-center gap-1 border-b border-border … px-2 select-none` shape and the `cursor-grab active:cursor-grabbing` idiom are copied from `PanelTitleBar.vue`'s `header`; `rounded-t-lg` matches `FloatingPanel.vue`'s root `rounded-lg`; `bg-panel-secondary` distinguishes the chrome bar from the panel bodies below it and is a real token at `src/app.css:42`).

Attributes: `:data-test-id="`float-title-${containerId}`"`, `role="group"`, `:aria-label="label"`, `tabindex="0"`, `@pointerdown="startContainerDrag(containerId, $event)"`, `@keydown="onKeydown"`.

Children, in order:

1. `<icon-lucide-grip-horizontal class="size-3 shrink-0 text-muted" aria-hidden="true" />` — the horizontal counterpart of `PanelTitleBar.vue`'s `icon-lucide-grip-vertical class="size-3 shrink-0 text-muted"`.
2. `<span class="min-w-0 flex-1 truncate text-[11px] font-semibold text-surface">{{ label }}</span>` — copied verbatim from `PanelTitleBar.vue`'s label span.
3. An `IconButton` from `src/components/ui/IconButton.vue`, unrestyled, `:label="panels.closePanel"`, `:data-test-id="`float-close-${containerId}`"`, containing `<icon-lucide-x class="size-3" />`.

### `src/components/Shell/FloatingPanel.vue`

Root element: class string **unchanged**. Remove `@pointerdown="onFramePointerDown"` and the `onFramePointerDown` function; replace its explanatory comment with one stating that the whole-window drag now lives in `FloatTitleBar.vue` and that a body press must not move the window.

Template order becomes: `<FloatTitleBar :container-id="containerId" />`, then `<PanelStack :container-id="containerId" />`, then the resize-handle `v-for`. `HANDLES`, `HANDLE_CLASS`, `allCollapsed` and the `style` computed are otherwise unchanged — including the `allCollapsed ? 'auto'` height rule, which now measures the bar plus the collapsed rails.

### Unchanged, do not restyle

`PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `PanelTitleBar.vue`, every resize handle, the snap guides, the empty-dock band.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only the semantic tokens already in `src/app.css`: `bg-panel`, `bg-panel-secondary`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `bg-accent`.
- **No font-size class other than `text-xs` or `text-[11px]`.** Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded`, `rounded-md`, `rounded-lg` or `rounded-t-lg`.** Never `rounded-xl`, `rounded-2xl`, `rounded-full`.
- **No height other than `h-6` on the bar**, and no `min-h`/`max-h` on it.
- **No new `tv()` recipe, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.**
- **No inline `style=`** anywhere in the new component.
- **No second whole-window drag route.** After this packet, `startContainerDrag` must have exactly one caller in `src/`.
- **No change to `startContainerDrag`'s body**, to `startPanelDrag`, or to `startPanelResize`.

## Allowed Changes

Create:

- `src/components/Shell/FloatTitleBar.vue`

Modify:

- `src/components/Shell/FloatingPanel.vue`
- `src/app/shell/panels/types.ts` (add `PANEL_FLOAT_TITLE_HEIGHT`)
- `src/app/shell/panels/containers.ts` (invariant 10's float floor only)
- `src/app/shell/panels/layout.ts` (`clampRectToOverlay`'s `maxY` only)
- `src/app/shell/panels/index.ts` (export the new constant)
- `tests/engine/app/shell/panels/containers.test.ts` (the float-floor assertions)
- `tests/e2e/panels/{helpers.ts,stacks.spec.ts,basic.spec.ts}`

Delete: nothing.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **Do not modify `startContainerDrag()`, `startPanelDrag()` or `startPanelResize()`.** Only the element that calls `startContainerDrag` changes.
- **Do not delete or restyle `src/components/ui/panel/PanelTitleBar.vue`.** T-070c owns its removal. Its per-member drag, collapse, pin and close behaviour all stay live in this packet.
- **No tabs, no `PanelGroup` type, no schema version bump.** T-070c owns those. `PANEL_FLOAT_TITLE_HEIGHT` is a layout constant, not a persisted field, so no migration is involved.
- **No change to the drop-target model.** T-070d owns the `DropTarget` union.
- **No change to member sizing, `scrollClass`, or the scroll wrappers.** T-070a owns those; if T-070a has not landed, stop and land it first.
- **Do not touch `src/app/shell/panels/snap.ts` or `drop-target.ts`**, or their tests.
- **Do not touch `src/app/shell/menu/use.ts`, `app-menu.ts`, or `src/views/EditorView.vue`.**
- **Do not change the `localStorage` key** or add a second one.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070a is Done. Reread `FloatingPanel.vue`, `drag.ts`'s `startContainerDrag`, and `PanelTitleBar.vue`'s `header` and `onKeydown`. Confirm `FloatingPanel.vue`'s root still carries `@pointerdown="onFramePointerDown"` and that `HANDLE_CLASS` still tiles all four edges and corners. If either has drifted, stop and report.

**2 — `src/app/shell/panels/types.ts`.** Add `export const PANEL_FLOAT_TITLE_HEIGHT = 24` beside `PANEL_COLLAPSED_HEIGHT`, with a one-line doc comment naming it as the float window's drag-handle bar height.

**3 — `src/app/shell/panels/containers.ts`.** In `normaliseMemberHeights()`, change the float floor to `PANEL_FLOAT_TITLE_HEIGHT + expandedCount * PANEL_MEMBER_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT`. Update the invariant's doc comment to say so. Nothing else in the file changes.

**4 — `src/app/shell/panels/layout.ts`.** In `clampRectToOverlay()`, replace the literal `33` in `maxY = Math.max(0, overlay.height - 33)` with `PANEL_FLOAT_TITLE_HEIGHT`, and add a one-line comment: the rule is "keep the drag handle on screen".

**5 — `src/app/shell/panels/index.ts`.** Export `PANEL_FLOAT_TITLE_HEIGHT`. No other export changes.

**6 — Create `src/components/Shell/FloatTitleBar.vue`** to the Visual Contract. Its script imports `containerMembers`, `floatContainer`, `panelLayout`, `startContainerDrag`, `nudgePanel`, `closeRegisteredPanel`, `type FloatId` from `@/app/shell/panels`, `useI18n` from `@open-pencil/vue`, and `IconButton` from `@/components/ui/IconButton.vue`. It computes `label` as `panels[firstMemberId]` (falling back to an empty string if the container has no members — defensive only; normalisation deletes empty containers). `onKeydown` handles `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` with `shiftKey ? 10 : 1`, calling `nudgePanel(firstMemberId, dx, dy)` and `preventDefault()`, copied from `PanelTitleBar.vue`'s `onKeydown` arrow block. The close button iterates `containerMembers(panelLayout, containerId)` and calls `closeRegisteredPanel(id)` for each, on a copy of the array so mutation during iteration cannot skip a member.

**7 — `src/components/Shell/FloatingPanel.vue`.** Import and render `FloatTitleBar` as the first child. Delete `onFramePointerDown` and the root `@pointerdown` binding, replacing the surrounding comment per the Visual Contract. Leave everything else, including `HANDLES`, `HANDLE_CLASS`, `allCollapsed` and `style`, untouched.

**8 — Unit tests.** In `tests/engine/app/shell/panels/containers.test.ts`, update the two float-floor tests ("collapsing every member of a float container shrinks its required height to N × `PANEL_COLLAPSED_HEIGHT`" at ≈ line 192 and "one collapsed and one expanded member requires …" at ≈ line 214) to include `PANEL_FLOAT_TITLE_HEIGHT`. Add one test asserting that a float container's normalised height is never less than `PANEL_FLOAT_TITLE_HEIGHT` even with a single collapsed member. Do **not** edit `snap.test.ts`, `drop-target.test.ts`, `operations.test.ts`, `layout.test.ts`, `registry.test.ts`, or `tests/engine/app/shell/menu/window-panels.test.ts`.

**9 — E2E harness.** In `tests/e2e/panels/helpers.ts`: rename `dragContainerFrameTo()` to `dragFloatTitleTo()`, retarget it to press the centre of `float-title-<containerId>` (resolve the container id from `floatingWindowFor(page, id)`'s `data-container-id`), and **delete** the stale comment about aiming inside the first member's body. Keep its `(page, id, dx, dy)` signature so call sites change only in name.

**10 — E2E specs.** Update every `dragContainerFrameTo` call in `stacks.spec.ts` and `basic.spec.ts` to the new name. Add to `stacks.spec.ts`:
- a three-member float: pressing `float-title-*` and dragging moves all three members' bounding boxes by the same delta, and the persisted `floats[0]` rect moves while `members` is unchanged;
- pressing inside a member's **body** and dragging does **not** move the window (the deleted root handler);
- pressing a member's own title bar and dragging still detaches only that member (unchanged `startPanelDrag`);
- a title-bar drag with Escape held mid-gesture restores the window's original rect;
- `float-close-*` closes every member and removes the container.

**11 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] Every floating window renders exactly one `float-title-<containerId>` bar, 24 px tall, above its member stack.
- [ ] Dragging that bar moves every member of the window together; the persisted float rect changes and `members` does not (`stacks.spec.ts`).
- [ ] Pressing inside a member's body no longer moves the window (`stacks.spec.ts`).
- [ ] `FloatingPanel.vue`'s root carries no `@pointerdown` handler, and `onFramePointerDown` does not exist, in the diff.
- [ ] `startContainerDrag` has exactly one caller in `src/` (`FloatTitleBar.vue`), and its body is byte-identical to before.
- [ ] A member title-bar drag still detaches only that member; the eight resize handles still resize the window (`stacks.spec.ts`, `basic.spec.ts`).
- [ ] Escape mid-drag restores the window's original rect (`stacks.spec.ts`).
- [ ] `float-close-<containerId>` closes every member and removes the container (`stacks.spec.ts`).
- [ ] A float container's normalised minimum height accounts for `PANEL_FLOAT_TITLE_HEIGHT` (`containers.test.ts`).
- [ ] `clampRectToOverlay` keeps at least `PANEL_FLOAT_TITLE_HEIGHT` of a dragged window on screen (Integration Check 4).
- [ ] The bar is keyboard-focusable and arrow keys nudge the window by 1 px, or 10 px with Shift (Integration Check 5).
- [ ] `snap.test.ts`, `drop-target.test.ts` and `tests/engine/app/shell/menu/window-panels.test.ts` pass **with no edit**.
- [ ] No new dependency, `tv()` recipe, i18n key, `src/app.css` edit, schema version bump, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0. `packages/vue/tsconfig.json` is **not** required: no package source changes, and the only package import used (`useI18n`) is unchanged.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ src/components/Shell/FloatTitleBar.vue src/components/Shell/FloatingPanel.vue tests/engine/app/shell/panels/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.
6. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0.
7. `bunx playwright test tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts --project=openpencil` — expect exit 0; floating the Code and AI panels still works with the new bar.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **The bar exists.** Float the Layers panel with its pin button. Confirm a 24 px bar sits above its title bar, showing a horizontal grip, the truncated label "Layers", and a close button; confirm the bar's top corners follow the window's `rounded-lg`.
2. **Whole-window drag.** Drag Code into the same window to make a two-member stack. Press the bar and drag — confirm **both** members move together, that the window snaps to other floats and to the overlay edges, and that holding Alt bypasses the snap.
3. **The old route is gone.** Press inside the Layers tree body and drag — confirm the window does **not** move and the tree behaves normally. Press a member's own title bar and drag — confirm only that member detaches.
4. **Clamping.** Drag the window to each overlay edge and past the bottom. Confirm at least the 24 px bar stays on screen and stays pressable; reload and confirm the clamped position persisted.
5. **Keyboard.** Tab to the bar (focus ring visible) and press each arrow key: the window moves 1 px, and 10 px with Shift held.
6. **Resize and close.** Resize from all eight handles, including the top edge and both top corners immediately beside the bar — confirm each resizes rather than dragging. Press the bar's close button and confirm every member closes and the window disappears; reopen both from the Window menu.
7. **Non-regression.** Confirm docked panels, the drop seam indicator, collapse, dock/undock, the Window menu checkboxes and View ▸ Reset panel layout all still behave; the canvas still receives input under a floating window; the layout survives a reload.
8. **Themes.** Cycle light, grey, dark and midnight. Confirm the bar reads as chrome distinct from the panel bodies in all four, with no literal colour anywhere in the diff.

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070a is not Done, or pre-flight finds `FloatingPanel.vue`'s root no longer carrying `@pointerdown`, or `HANDLE_CLASS` no longer tiling the frame. The tree has drifted.
- A resize handle beside the bar becomes unreachable, or a bar press starts a resize.
- `startContainerDrag` cannot be driven from the new element without changing its body.
- Adding 24 px to the float floor makes an existing persisted window clip its last member rather than growing.
- `snap.test.ts`, `drop-target.test.ts` or `window-panels.test.ts` requires an edit to pass — that means this packet changed a contract it promised not to touch.
- The change needs a new dependency, `tv()` recipe, `src/app.css` edit, i18n key, schema version bump, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file created and modified, with a one-line reason each;
- the final `FloatTitleBar.vue` root class string and its `data-test-id` values;
- confirmation, by grep output, that `startContainerDrag` has exactly one caller in `src/` and that its body is unchanged;
- confirmation that `FloatingPanel.vue`'s root carries no `@pointerdown`;
- the new float-floor expression as landed, and the `clampRectToOverlay` `maxY` change;
- every command from Verification with its exact exit code, test counts and any failure output;
- confirmation that `snap.test.ts`, `drop-target.test.ts` and `window-panels.test.ts` passed unedited;
- the browser observations for all eight Integration Check items, at both viewport widths;
- confirmation that no dependency, `src/app.css` edit, i18n key, schema bump, version-file change, build, install or Git work occurred;
- confirmation that no tab, group, drop-target or sizing work was anticipated (T-070a/c/d own those);
- any assumption or remaining gap.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: created as the second slice of the T-070 split, expanded against live `App/` source.

## Status record

Status: **Ready**

Expansion receipt (2026-08-20). Verified against live source:

1. **`startContainerDrag()` already moves the whole stack correctly** and is covered by `tests/e2e/panels/stacks.spec.ts`. This packet changes only its call site.
2. **The defect is the handle, not the logic**: `HANDLE_CLASS` in `FloatingPanel.vue` tiles all four edges and corners of the window frame, so the root `@pointerdown` can effectively only fire from inside a member's body.
3. **`tests/e2e/panels/helpers.ts` documents the workaround in a code comment** — that comment is the clearest evidence of the bug and is deleted by this packet.
4. **The float container's minimum height must grow by 24 px** (`normaliseMemberHeights()`'s `required`), or a minimum-height window would clip its last member.
5. **`clampRectToOverlay`'s magic `33` was the old title-bar height**; it becomes `PANEL_FLOAT_TITLE_HEIGHT` so the rule stays "keep the drag handle on screen".
6. **No new i18n key is needed** — `panelMessageDefaults` already carries a label for every `PanelId` plus `closePanel`, and `App/package.json` has no `check:i18n` script.
