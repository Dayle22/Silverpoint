# T-035 - Add contextual selection actions

Task ID: T-035
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none — independent of T-032, T-033 and T-036
Prepared from: the user's 2026-08-12 Canva reference and the scope split agreed the same day
Expanded at: 2026-08-12
Expansion note: written to be executable by a less capable model. The Visual Contract and Banned List are binding, not advisory.

## Intended Outcome

A small floating action bar appears just above the current canvas selection with the most common per-object actions, plus an overflow button that opens the **existing** canvas context menu. It is available in every workspace view on desktop.

## Verified Starting State

Read before editing — these are live and confirmed:

| Path | What it is |
| --- | --- |
| `App/src/components/canvas/CanvasMenu.vue` | The existing right-click canvas context menu. Already calls `getCommand('selection.duplicate')` and `getCommand('selection.delete')`. |
| `App/src/app/editor/canvas/menu/{context,actions,registry,model}.ts` | Backing model for that menu, incl. the Copy/Paste-as submenu. |
| `App/src/components/Toolbar/actions.ts` | `useToolbarActions()` builds selection action lists from commands — **but it is mobile-only** (it calls `store.mobileCopy/mobilePaste/mobileCut`). Copy its shape, do not import it. |
| `App/src/components/Toolbar/DesktopToolbar.vue` | Bottom-centred desktop tool strip. Tools only, no selection actions today. |
| `App/src/components/ui/IconButton.vue` | The icon button primitive to use. |
| `App/src/components/ui/menu.ts`, `popover.ts`, `surface.ts` | `tailwind-variants` recipes for menu/popover/surface styling. |

## The one rule that matters most

**Never invent an action list.** Every action must come from `useEditorCommands()` in `@open-pencil/vue`:

```ts
const { getCommand, runCommand } = useEditorCommands()
const cmd = getCommand('selection.duplicate')
// cmd.label   -> already localised string
// cmd.enabled -> Ref<boolean>
// cmd.run()   -> execute
```

Confirmed command IDs available today:

`selection.duplicate`, `selection.delete`, `selection.group`, `selection.ungroup`, `selection.toggleLock`, `selection.toggleMask`, `selection.bringToFront`, `selection.sendToBack`, `selection.goToMainComponent`, `selection.detachInstance`, `edit.undo`, `edit.redo`, `view.zoomFit`

Do **not** add new command IDs in this packet. Do **not** write a second label or enabled-state source. If an action you want has no command, leave it out and note it.

## Fixed Interaction Direction

- The bar shows only when there is a non-empty selection and the active tool is the move/select tool.
- Bar contents, left to right, all from commands above: **Duplicate, Delete, Lock/Unlock, Group, Ungroup**, then a separator, then an **overflow `⋯` button**.
- Every item is icon-only with a `Tip` tooltip carrying `cmd.label`. No text labels in the bar.
- An action whose `cmd.enabled` is false renders **disabled and still visible** — never hidden. Hiding causes the bar to reflow under the pointer.
- The `⋯` overflow opens the **same content as `CanvasMenu.vue`**. Do not author a second menu body. If `CanvasMenu.vue` cannot be reused as-is, extract its entry-building into a shared function and have both call it.
- Right-click continues to open `CanvasMenu.vue` exactly as it does now. This packet **adds** a surface; it removes nothing.

## Positioning Contract

- Anchor to the selection bounding box in **screen space**, horizontally centred, `8px` above the box top.
- If there is not `48px` of room above, flip to `8px` below the box bottom.
- Clamp horizontally so the bar never leaves the canvas viewport with less than `8px` margin.
- Recompute on: selection change, zoom, pan, canvas resize, and object transform. Use the same screen-space conversion the existing canvas overlays use — find it in `EditorCanvas.vue` rather than writing new maths.
- Hide the bar entirely while a drag/transform gesture is in progress, and restore it on release.
- The bar must never intercept pointer events destined for the canvas outside its own bounds.

## Visual Contract — binding

The closest existing analogue is the toolbar container in `DesktopToolbar.vue`. **Match it exactly:**

```
rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md
```

| Element | Required classes |
| --- | --- |
| Bar container | `flex items-center gap-0.5` + the container string above |
| Icon button | Use `IconButton.vue`. Do not restyle it. |
| Icon inside button | `size-3.5` (matches `SelectionActionsControl.vue`) |
| Separator | `mx-1 h-4 w-px bg-border` |
| Overflow menu popup | Reuse `menuContent()` / `menuItem()` from `components/ui/menu.ts` |
| Stacking | `z-10`, matching the toolbar. Must sit below dialogs and toasts. |

Icons: `~icons/lucide/*` only, matching the set already imported in `Toolbar/actions.ts` (`IconCopyPlus`, `IconTrash2`, `IconLock`, `IconGroup`, `IconUngroup`).

### Banned List — do not do any of these

- No literal colour of any kind — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only the semantic tokens: `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`.
- No font-size class other than `text-xs` or `text-[11px]`. Never `text-sm`, `text-base`, `text-lg`.
- No radius other than `rounded-md` or `rounded-lg`. Never `rounded-xl`, `rounded-2xl`, `rounded-full`.
- No new `tv()` recipe file. Reuse `menu.ts` / `surface.ts`.
- No new npm dependency.
- No inline `style=` for anything except the computed `left`/`top` position values.
- No `@apply`, no new global CSS, no edits to `App/src/app.css`.
- No animation library. If a fade is wanted use `tw-animate-css` classes already available.

## Constraints

- Desktop only. `MobileHud/` has its own model — leave it untouched.
- No scene-graph, document, `.fig`, export or MCP changes. This surface only invokes existing commands.
- No changes to `showUI=false`, `?no-chrome`, or the dashboard branch.
- All four themes (`light`, `grey`, `midnight`, default dark) must be visually correct. Because only tokens are used, this should follow automatically — verify it, do not special-case it.

## Allowed Changes

- New `App/src/components/canvas/SelectionActionBar.vue`.
- Smallest possible mount point in `EditorCanvas.vue`.
- Extraction of shared menu-entry building out of `CanvasMenu.vue` **only if** reuse requires it.
- i18n default + all locale files if any new string is genuinely needed (prefer `cmd.label`, which is already localised).
- Focused tests.

## Implementation Steps

1. Read `CanvasMenu.vue`, `EditorCanvas.vue` and `Toolbar/actions.ts` fully before writing anything. Confirm how existing canvas overlays convert scene coordinates to screen coordinates.
2. Create `SelectionActionBar.vue`. Build its items from `useEditorCommands()` only. Bind `disabled` to `cmd.enabled.value`.
3. Implement positioning per the Positioning Contract, reusing the existing coordinate conversion.
4. Wire the `⋯` overflow to the existing canvas menu content. Extract a shared builder if needed; do not duplicate entries.
5. Mount in `EditorCanvas.vue`, visible only for a non-empty selection with the select tool active, hidden during drag/transform.
6. Add `data-test-id` attributes following the existing convention (see `selection-toggle-mask` in `SelectionActionsControl.vue` and `context-copy-as-svg` in `registry.ts`).
7. Add Playwright coverage in `App/tests/e2e/` : bar appears on selection and disappears on deselect; disabled state for an inapplicable action; overflow opens and matches right-click content; position flips near the canvas top; no bar during drag; right-click menu unchanged.
8. Run, in this order, and paste exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on the changed files
   - `bun run check:i18n`
   - the focused Playwright spec with `--project=openpencil`
   
   Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
9. Do not claim delivery. This packet stops at source gates; installed desktop verification is only required if the user asks for a build.

## Acceptance Criteria

- [ ] Every action's label, enabled state and behaviour comes from `useEditorCommands()`; no parallel list exists.
- [ ] The overflow menu and the right-click menu show the same entries from one source.
- [ ] Right-click behaviour is unchanged.
- [ ] The bar tracks the selection through zoom, pan and transform, flips near the top edge, and clamps at the viewport.
- [ ] Disabled actions stay visible and disabled.
- [ ] Correct in all four themes with no literal colour anywhere in the diff.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] Mobile, dashboard, `showUI=false` and `?no-chrome` are untouched.

## Stop Conditions

Stop and report if: an action you need has no existing command ID; `CanvasMenu.vue` cannot be reused without a redesign; or the canvas exposes no reliable screen-space conversion for overlays.

## Revision History

- Revision 1 — 2026-08-12: created from the T-033 scope split.
- Revision 2 — 2026-08-12: expanded against live command/menu/toolbar/theme seams; added binding Visual Contract and Banned List for weaker-model execution.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (expanded 2026-08-12 against live command/menu seams; independent of T-032)

Executed and verified on 2026-08-24:
- Floating selection action bar (`SelectionActionBar.vue`) implemented using `useEditorCommands()` (`selection.duplicate`, `selection.delete`, `selection.toggleLock`, `selection.group`, `selection.ungroup`) and `useIconButtonUI` + `Tip` with semantic tokens and `size-3.5` icons.
- Single shared ContextMenu architecture preserved via synthetic trigger dispatch from `EditorCanvas.vue` without nesting popover/context menus.
- Screen-space anchor and bounding box calculation with `PopoverContent` collision detection (`:collision-boundary="canvasRef"` and `:collision-padding="{ top: 48, bottom: 8, left: 8, right: 8 }"`) ensuring top edge flip to below selection bottom and horizontal clamping.
- Verification gates:
  - `bunx tsgo --noEmit --pretty false` -> exit code 0
  - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` -> exit code 0
  - `bunx oxlint -c oxlint.json src/components/canvas/SelectionActionBar.vue src/components/EditorCanvas.vue tests/e2e/canvas/selection-action-bar.spec.ts tests/e2e/context-menu/basic.spec.ts` -> exit code 0 (0 errors, 0 warnings)
  - `bun run check:i18n` -> script not found (removed by T-054 single locale reduction)
  - `bunx playwright test tests/e2e/canvas/selection-action-bar.spec.ts --project=openpencil` -> exit code 0 (9/9 tests passed)
  - `bunx playwright test tests/e2e/context-menu/basic.spec.ts --project=openpencil` -> exit code 0 (12/12 tests passed)
