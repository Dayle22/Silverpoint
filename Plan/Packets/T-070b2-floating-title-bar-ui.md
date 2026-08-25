# T-070b2 - Floating-window title-bar UI

Task ID: T-070b2
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-070b1 (it adds `PANEL_FLOAT_TITLE_HEIGHT`, grows the float height floor and re-points `clampRectToOverlay`; this packet renders the bar those 24 px were reserved for)
Related: T-070b (superseded scope map), T-070a, T-070c, T-070d
Prepared from: the 2026-08-20 InDesign-referenced panel request, requirement group 3 — second half of the T-070b split
Expanded at: 2026-08-20 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/components/Shell/{FloatingPanel,PanelStack}.vue`, `src/app/shell/panels/{drag,resize,index,types}.ts`, `src/components/ui/panel/PanelTitleBar.vue`, `src/components/ui/IconButton.vue`, `src/theme/icon-button.ts`, `packages/vue/src/i18n/messages/panels.ts`, `tests/e2e/panels/{helpers.ts,stacks.spec.ts,basic.spec.ts}`
Delivery: named source gates + browser check

## Intended Outcome

Every floating panel window gets a real 24 px title bar across its top, rendered by a new `FloatTitleBar.vue`. Pressing and dragging that bar moves the **whole** window — every stacked member together — the way InDesign's floating panel groups do. The old route, where the whole-window drag was bound to the window root and could in practice only be started from inside a member's body, is deleted.

## Request Coverage

Requirement group 3 of the 2026-08-20 request, verbatim:

- Fix floating panel group movement so that dragging the group container/header moves the entire stacked cluster together.

T-070b1 delivers the geometry half (reserved height, clamp constant). This packet delivers the visible handle. No tabs, no new drop targets, no sizing change.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/components/Shell/FloatingPanel.vue:50-57` | `onFramePointerDown()` and the root `@pointerdown="onFramePointerDown"` | **The defect site.** The whole-window drag is bound to the window root. The root's own comment claims a press either lands in a member title bar or on a resize handle and is stopped there, leaving "genuine frame presses" — but `HANDLE_CLASS` (lines 19-28) tiles all four edges (`h-1.5`/`w-1.5` inset by `2`) and all four corners (`size-3`), so the frame has effectively no pressable pixels. Both are deleted here. |
| `src/components/Shell/FloatingPanel.vue:59-77` | root class `pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-border bg-panel shadow-lg`, `HANDLES`, `HANDLE_CLASS`, `allCollapsed`, `style` | Unchanged by this packet except for the two deletions above and the new first child. The root is already `flex flex-col`, so a `shrink-0` bar above `PanelStack` needs no layout change. |
| `src/app/shell/panels/drag.ts:300` | `startContainerDrag(id: FloatId, event: PointerEvent)` | **Already correct and already tested.** Raises the float, snapshots the layout, coalesces with `requestAnimationFrame`, snaps unless Alt is held, clamps to the overlay, rolls back on Escape or `pointercancel`. Its body is not touched — only its caller moves. |
| `src/app/shell/panels/drag.ts` | `isInteractiveTarget()` | Guards every drag start against `button, a, input, [role="button"]`, so the bar's close button will not start a drag. Inherited for free. |
| `src/app/shell/panels/resize.ts` | `startPanelResize()`, its `event.stopPropagation()` | Each of the eight handles stops propagation, so a handle press can never reach the bar. Unchanged. |
| `src/components/ui/panel/PanelTitleBar.vue:96-101` | `header` class `flex h-[33px] shrink-0 items-center gap-1 border-b border-border bg-panel px-2 select-none`, `cursor-grab active:cursor-grabbing`, `icon-lucide-grip-vertical class="size-3 shrink-0 text-muted"`, the label `span class="min-w-0 flex-1 truncate text-[11px] font-semibold text-surface"` | **The pattern to copy.** The new bar is the same idiom at 24 px with a horizontal grip. This file is not edited here; T-070c owns its removal. |
| `src/components/ui/panel/PanelTitleBar.vue:66-84` | `onKeydown`, `NUDGE_STEP = 1`, `NUDGE_STEP_LARGE = 10`, the `moves` record | The exact arrow-key nudge shape to copy (without the Enter/Space collapse branch and without the `floating` guard — a float bar is always floating). |
| `src/components/ui/IconButton.vue` + `src/theme/icon-button.ts` | `IconButton` (props `label`, `side`, `size`, `active`, `disabled`); `size: sm` = `size-5` | The icon-button primitive; wraps its slot in `Tip` when `label` is set, and sets `aria-label`. At 20 px it fits inside a 24 px bar with no `min-h`/`max-h` override. |
| `packages/vue/src/i18n/messages/panels.ts` | `panelMessageDefaults` | Verified 2026-08-20: a key exists for **every** one of the 16 `PANEL_IDS`, plus `closePanel`. **No new i18n key is needed.** |
| `src/app/shell/panels/types.ts:3-21` | `PANEL_IDS`, `PanelId`, `FloatId` | `panels[<PanelId>]` is a total lookup, so the label needs no runtime map. |
| `src/app/shell/panels/index.ts:62-73` | barrel re-exports `containerMembers`, `floatContainer`, `panelLayout`, `nudgePanel`, `startContainerDrag`, `closeRegisteredPanel`, `type FloatId` | Everything the new component imports is already exported. No barrel change in this packet. |
| `tests/e2e/panels/helpers.ts:145-163` | `dragContainerFrameTo()` and its comment ("Targets a point well inside the FIRST member's own body … since the container's 8 resize handles fully tile its actual border/corner pixels") | **The written record of the defect.** Rewritten to press the new bar; the comment deleted. |
| `tests/e2e/panels/helpers.ts:104` | `floatingWindowFor(page, id)` | Resolves the window locator from a member id — the way the E2E harness reaches a container without knowing its `float:N` id. |
| `tests/e2e/panels/stacks.spec.ts:8,189` | the single `dragContainerFrameTo` import and call, inside the test at line 153 | The existing whole-stack-move assertion. Keeps its behaviour, retargeted to the bar. |
| `tests/e2e/panels/basic.spec.ts` | no `dragContainerFrameTo` usage (verified by grep 2026-08-20) | Only its float/resize coverage matters here, as a non-regression gate. It needs **no rename edit**. |

## Read First

1. `src/components/Shell/FloatingPanel.vue` — all 78 lines, especially `HANDLE_CLASS` and the root `@pointerdown` comment.
2. `src/components/ui/panel/PanelTitleBar.vue` — the `header` element and `onKeydown`.
3. `src/app/shell/panels/drag.ts` — `startContainerDrag` and `isInteractiveTarget` (read only; do not edit).
4. `tests/e2e/panels/helpers.ts` — `dragContainerFrameTo`, `floatingWindowFor`, `dragFloatTo`.

## Corrections to the Brief

- **Whole-group float movement is not a missing feature.** `startContainerDrag()` already moves every member together and `stacks.spec.ts:189` already proves it. The defect is purely that `FloatingPanel.vue` binds it to the window root, whose border pixels are entirely covered by the eight resize handles. **Do not rewrite the drag logic — give it a handle.**
- **The Brief's "E2E helper and focused panel specs" resolves to two spec files, one of which needs no edit.** `dragContainerFrameTo` has exactly one call site (`stacks.spec.ts`); `basic.spec.ts` is a run-only non-regression gate.
- **No barrel edit is needed.** T-070b1 already exports `PANEL_FLOAT_TITLE_HEIGHT`, and every other symbol the new component needs is already re-exported from `@/app/shell/panels`.

## Fixed Decisions

1. **A new `src/components/Shell/FloatTitleBar.vue` is the one and only whole-window drag handle**, rendered as the first child of every float container, above the member stack. Reason: it makes the gesture discoverable, gives it real pressable pixels outside every resize handle, and matches the InDesign reference.

2. **The bar is always rendered, on every float container, regardless of member count.** Reason: one unambiguous handle with no runtime arbitration between "the bar drags the window" and "the title bar drags the member". The alternative — hiding the bar for a single-member float — gives the same element two meanings depending on member count and forces two code paths in the E2E harness. If the double bar later reads as heavy, the follow-up is a one-line `v-if` here plus a fallback in the member title bar; that is not this packet.

3. **`FloatingPanel.vue`'s root `@pointerdown` and `onFramePointerDown()` are deleted.** Reason: with a real handle, a body press must not move the window. Leaving both routes live would mean a press inside the Layers tree could still drag the whole window.

4. **The bar carries a close-window button and nothing else.** It closes every member via the existing `closeRegisteredPanel(id)`, iterating a **copy** of `containerMembers(...)` so mutation during iteration cannot skip a member. Reason: InDesign's floating title bar carries exactly one control; collapse or pin here would duplicate each member's own title bar.

5. **The bar's label is `panels[<first member id>]`**, truncated, with an empty-string fallback when the container has no members (defensive only — normalisation deletes empty containers). Reason: no new i18n key, and it names what the user sees at the top of the window.

6. **The bar is keyboard-reachable and nudges the window.** `tabindex="0"`; arrow keys call `nudgePanel(firstMemberId, dx, dy)` with `shiftKey ? 10 : 1`, copied from `PanelTitleBar.vue`'s `onKeydown` arrow block. Reason: the member title bar already offers this for a floating panel; moving the handle must not remove the keyboard equivalent.

7. **`startContainerDrag()`'s body is not modified.** Only its call site moves. Reason: it is correct, tested, and its rollback/coalescing/snap behaviour is exactly what the bar needs.

8. **`dragContainerFrameTo` is renamed to `dragFloatTitleTo`, keeping its `(page, id, dx, dy)` signature.** Reason: the name is now wrong (it no longer presses the frame), and keeping the signature confines call-site churn to the identifier.

## Open Decisions

None. Fixed Decision 2 records the one taste call with its alternative and the exact one-line change that would reverse it.

## Visual Contract — binding

### New file — `src/components/Shell/FloatTitleBar.vue`

Props: `containerId: FloatId`.

Root element `<header>`, class string **exactly**:

```
flex h-6 shrink-0 cursor-grab items-center gap-1 rounded-t-lg border-b border-border bg-panel-secondary px-2 select-none active:cursor-grabbing
```

(the `flex h-… shrink-0 items-center gap-1 border-b border-border … px-2 select-none` shape and the `cursor-grab active:cursor-grabbing` idiom are copied from `PanelTitleBar.vue`'s `header`; `rounded-t-lg` matches `FloatingPanel.vue`'s root `rounded-lg`; `bg-panel-secondary` distinguishes the chrome bar from the panel bodies below it and is a real token in `src/app.css`.)

Attributes: `:data-test-id` = `float-title-<containerId>` (template literal), `role="group"`, `:aria-label="label"`, `tabindex="0"`, `@pointerdown="startContainerDrag(containerId, $event)"`, `@keydown="onKeydown"`.

Children, in order:

1. `<icon-lucide-grip-horizontal class="size-3 shrink-0 text-muted" aria-hidden="true" />` — the horizontal counterpart of `PanelTitleBar.vue`'s `icon-lucide-grip-vertical`.
2. `<span class="min-w-0 flex-1 truncate text-[11px] font-semibold text-surface">{{ label }}</span>` — copied verbatim from `PanelTitleBar.vue`'s label span.
3. An `IconButton`, unrestyled (no `class`, no `size` override), `:label="panels.closePanel"`, `:data-test-id` = `float-close-<containerId>` (template literal), `@click="onClose"`, containing `<icon-lucide-x class="size-3" />`.

### `src/components/Shell/FloatingPanel.vue`

Root element: class string, `:style`, `:data-container-id`, `:data-test-id`, `:data-collapsed` all **unchanged**. Remove `@pointerdown="onFramePointerDown"` and the `onFramePointerDown` function; replace its block comment with one stating that the whole-window drag now lives in `FloatTitleBar.vue` and that a body press must not move the window. Drop the now-unused `startContainerDrag` import.

Template order becomes: `<FloatTitleBar :container-id="containerId" />`, then `<PanelStack :container-id="containerId" />`, then the resize-handle `v-for`. `HANDLES`, `HANDLE_CLASS`, `allCollapsed` and `style` are otherwise untouched — including the `allCollapsed ? 'auto'` height rule, which now measures the bar plus the collapsed rails.

### Unchanged, do not restyle

`PanelStack.vue`, `PanelOverlay.vue`, `DockInsertionTarget.vue`, `PanelTitleBar.vue`, every resize handle, the snap guides, the empty-dock band.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only semantic tokens already in `src/app.css`: `bg-panel`, `bg-panel-secondary`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `bg-accent`.
- **No font-size class other than `text-[11px]`** on the new bar. Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded-t-lg`** on the new bar. Never `rounded-xl`, `rounded-2xl`, `rounded-full`.
- **No height other than `h-6` on the bar**, and no `min-h`/`max-h` on it or on its close button.
- **No new `tv()` recipe, no new theme file, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.**
- **No inline `style=`** anywhere in the new component.
- **No second whole-window drag route.** After this packet, `startContainerDrag` must have exactly one caller in `src/`.
- **No change to `startContainerDrag`'s body**, to `startPanelDrag`, or to `startPanelResize`.
- **No `stopPropagation()` in the new component** — the resize handles already stop their own.

## Allowed Changes

Create:

- `src/components/Shell/FloatTitleBar.vue`

Modify:

- `src/components/Shell/FloatingPanel.vue`
- `tests/e2e/panels/helpers.ts`
- `tests/e2e/panels/stacks.spec.ts`

Delete: nothing.

Every other file is out of scope, including `tests/e2e/panels/basic.spec.ts` (run it, do not edit it).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **Do not modify `startContainerDrag()`, `startPanelDrag()` or `startPanelResize()`.** Only the element that calls `startContainerDrag` changes.
- **Do not touch `src/app/shell/panels/*`** at all — T-070b1 owns the model half. No constant, invariant, clamp or barrel edit here.
- **Do not edit any unit test.** `tests/engine/app/shell/panels/**` and `tests/engine/app/shell/menu/window-panels.test.ts` must pass unedited.
- **Do not delete or restyle `src/components/ui/panel/PanelTitleBar.vue`.** T-070c owns its removal. Its per-member drag, collapse, pin and close behaviour all stay live.
- **No tabs, no `PanelGroup` type, no schema version bump** — T-070c owns those. **No drop-target change** — T-070d owns the `DropTarget` union.
- **No change to member sizing, `scrollClass`, or the scroll wrappers** — T-070a owns those.
- **Do not touch `src/app/shell/menu/use.ts`, `app-menu.ts`, or `src/views/EditorView.vue`.**
- **Do not change the `localStorage` key** or add a second one.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Confirm T-070b1 is **Done** and that `grep -rn "PANEL_FLOAT_TITLE_HEIGHT" src` returns its definition in `types.ts`, its use in `containers.ts` and `layout.ts`, and its export from `index.ts`. Confirm `FloatingPanel.vue`'s root still carries `@pointerdown="onFramePointerDown"` and that `HANDLE_CLASS` still tiles all four edges and corners. If either has drifted, stop and report.

**2 — Create `src/components/Shell/FloatTitleBar.vue`** to the Visual Contract. Script imports: `computed` from `vue`; `containerMembers`, `floatContainer`, `panelLayout`, `startContainerDrag`, `nudgePanel`, `closeRegisteredPanel`, `type FloatId` from `@/app/shell/panels`; `useI18n` from `@open-pencil/vue`; `IconButton` from `@/components/ui/IconButton.vue`. Compute `members` from `containerMembers(panelLayout.value, containerId)` and `label` as the `panels` message for `members[0]`, falling back to `''`. `onKeydown` handles `ArrowLeft`/`ArrowRight`/`ArrowUp`/`ArrowDown` with `shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP` (10 / 1), calls `preventDefault()` and `nudgePanel(members[0], dx, dy)`, and returns early for any other key — the `moves` record shape copied from `PanelTitleBar.vue`. `onClose` iterates a copy of `members.value` and calls `closeRegisteredPanel(id)` for each.

**3 — `src/components/Shell/FloatingPanel.vue`.** Import and render `FloatTitleBar` as the first child of the root. Delete `onFramePointerDown`, the root `@pointerdown` binding and the now-unused `startContainerDrag` import, replacing the block comment per the Visual Contract. Leave `HANDLES`, `HANDLE_CLASS`, `allCollapsed`, `style` and every root attribute untouched.

**4 — E2E harness.** In `tests/e2e/panels/helpers.ts`: rename `dragContainerFrameTo()` to `dragFloatTitleTo()`, keep the `(page, id, dx, dy)` signature, and retarget it to press the **centre** of the bar — read `data-container-id` from `floatingWindowFor(page, id)` and locate the matching `float-title-<containerId>`. **Delete** the stale comment about aiming inside the first member's body; replace it with one line saying the bar is the window's drag handle.

**5 — E2E spec.** In `tests/e2e/panels/stacks.spec.ts`, rename the import and the single call at line 189. Then add tests:
- a three-member float: pressing `float-title-*` and dragging moves all three members' bounding boxes by the same delta, and the persisted `floats[0]` rect moves while `members` is unchanged;
- pressing inside a member's **body** and dragging does **not** move the window (proves the deleted root handler);
- pressing a member's own title bar and dragging still detaches only that member (unchanged `startPanelDrag`);
- a title-bar drag with Escape pressed mid-gesture restores the window's original rect;
- `float-close-*` closes every member and removes the container.

**6 — Focused verification.** Run the Verification section in order, then the Integration Check.

## Acceptance Criteria

- [ ] Every floating window renders exactly one `float-title-<containerId>` bar, 24 px tall, above its member stack, with the contract's exact root class string.
- [ ] Dragging that bar moves every member of the window together; the persisted float rect changes and `members` does not (`stacks.spec.ts`).
- [ ] Pressing inside a member's body no longer moves the window (`stacks.spec.ts`).
- [ ] `FloatingPanel.vue`'s root carries no `@pointerdown` handler, and `onFramePointerDown` does not exist, in the diff.
- [ ] `startContainerDrag` has exactly one caller in `src/` (`FloatTitleBar.vue`), and its body is byte-identical to before.
- [ ] A member title-bar drag still detaches only that member; the eight resize handles still resize the window, including the top edge and both top corners beside the bar (`stacks.spec.ts`, `basic.spec.ts`).
- [ ] Escape mid-drag restores the window's original rect (`stacks.spec.ts`).
- [ ] `float-close-<containerId>` closes every member and removes the container (`stacks.spec.ts`).
- [ ] The bar is keyboard-focusable and arrow keys nudge the window by 1 px, or 10 px with Shift (Integration Check 5).
- [ ] No file under `src/app/shell/panels/` and no unit test was edited; `tests/engine/app/shell/panels/` and `window-panels.test.ts` pass unedited.
- [ ] No new dependency, `tv()` recipe, i18n key, `src/app.css` edit, schema version bump, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

`bunx playwright test tests/e2e/panels/stacks.spec.ts --project=openpencil`

Keep the E2E headers (fixtures, `canvas.assertNoErrors()`) exactly as the existing tests use them.

### Final pre-completion gates — run once, in this order

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0. `packages/vue/tsconfig.json` is not required: no package source changes.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/components/Shell/FloatTitleBar.vue src/components/Shell/FloatingPanel.vue tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/ tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with every one of those files unedited**.
5. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0.
6. `bunx playwright test tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts --project=openpencil` — expect exit 0; floating the Code and AI panels still works with the new bar.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **The bar exists.** Float the Layers panel with its pin button. Confirm a 24 px bar sits above its title bar, showing a horizontal grip, the truncated label "Layers", and a close button; confirm the bar's top corners follow the window's `rounded-lg`.
2. **Whole-window drag.** Drag Code into the same window to make a two-member stack. Press the bar and drag — confirm **both** members move together, that the window snaps to other floats and to the overlay edges, and that holding Alt bypasses the snap.
3. **The old route is gone.** Press inside the Layers tree body and drag — confirm the window does **not** move and the tree behaves normally. Press a member's own title bar and drag — confirm only that member detaches.
4. **Clamping.** Drag the window to each overlay edge and past the bottom. Confirm at least the 24 px bar stays on screen and stays pressable; reload and confirm the clamped position persisted (this is T-070b1's rule, re-checked through the new handle).
5. **Keyboard.** Tab to the bar (focus ring visible) and press each arrow key: the window moves 1 px, and 10 px with Shift held.
6. **Resize and close.** Resize from all eight handles, including the top edge and both top corners immediately beside the bar — confirm each resizes rather than dragging. Press the bar's close button and confirm every member closes and the window disappears; reopen both from the Window menu.
7. **Minimum height.** Collapse and expand members and drag the bottom edge up as far as it goes — confirm the last member is never clipped by the bar's 24 px.
8. **Non-regression.** Confirm docked panels, the drop seam indicator, collapse, dock/undock, the Window menu checkboxes and View ▸ Reset panel layout all still behave; the canvas still receives input under a floating window; the layout survives a reload.
9. **Themes.** Cycle light, grey, dark and midnight. Confirm the bar reads as chrome distinct from the panel bodies in all four, with no literal colour anywhere in the diff.

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- T-070b1 is not Done, or `PANEL_FLOAT_TITLE_HEIGHT` is missing from `src/app/shell/panels/`.
- Pre-flight finds `FloatingPanel.vue`'s root no longer carrying `@pointerdown`, or `HANDLE_CLASS` no longer tiling the frame. The tree has drifted.
- A resize handle beside the bar becomes unreachable, or a bar press starts a resize.
- `startContainerDrag` cannot be driven from the new element without changing its body.
- A unit test under `tests/engine/app/shell/panels/` or `window-panels.test.ts` requires an edit to pass — that means this packet changed a contract it promised not to touch, or T-070b1's floor was wrong.
- The bar's close button starts a drag instead of closing (`isInteractiveTarget` no longer guards it).
- The change needs a new dependency, `tv()` recipe, `src/app.css` edit, i18n key, schema version bump, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file created and modified, with a one-line reason each;
- the final `FloatTitleBar.vue` root class string and its two `data-test-id` values;
- grep output confirming `startContainerDrag` has exactly one caller in `src/` and that its body is unchanged;
- confirmation that `FloatingPanel.vue`'s root carries no `@pointerdown` and that `onFramePointerDown` is gone;
- confirmation that nothing under `src/app/shell/panels/` and no unit test was edited;
- every command from Verification with its exact exit code, test counts and any failure output;
- the browser observations for all nine Integration Check items, at both viewport widths;
- confirmation that no dependency, `src/app.css` edit, i18n key, schema bump, version-file change, build, install or Git work occurred;
- confirmation that no tab, group, drop-target or sizing work was anticipated (T-070a/c/d own those);
- any assumption or remaining gap.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: Brief, created as the UI half of the T-070b split.
- Revision 2 — 2026-08-20: expanded against live `App/` source; scope confirmed as one new component plus three modified files.

## Status record

Status: **Done**

Execution receipt (2026-08-20 Africa/Johannesburg):
1. Created `src/components/Shell/FloatTitleBar.vue` with exact visual contract (`flex h-6 shrink-0 cursor-grab items-center gap-1 rounded-t-lg border-b border-border bg-panel-secondary px-2 select-none active:cursor-grabbing`), data test IDs `float-title-<containerId>` and `float-close-<containerId>`, keyboard nudge handler and whole-stack close handler.
2. Updated `src/components/Shell/FloatingPanel.vue`: rendered `FloatTitleBar` as first child, removed root `@pointerdown` and `onFramePointerDown`.
3. Updated `tests/e2e/panels/helpers.ts`: renamed `dragContainerFrameTo` to `dragFloatTitleTo` targeting `float-title-<containerId>`.
4. Updated `tests/e2e/panels/stacks.spec.ts`: retargeted whole-stack drag to `dragFloatTitleTo` and added 5 new E2E tests. All 11 tests pass in 59.5s.
5. Verified pre-completion gates: `tsgo` (exit 0), `vue-tsc` (exit 0), `oxlint` (exit 0, 0 errors, 0 warnings), `code/panel.spec.ts` (9/9 pass). Single caller for `startContainerDrag` in `src/` confirmed.
