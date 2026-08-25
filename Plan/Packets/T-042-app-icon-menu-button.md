# T-042 - Collapse the browser menu row into an app-icon menu button

Task ID: T-042
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-031d (Done, 0.6.28)
Related: T-043
Prepared from: the user's 2026-08-14 request batch, screenshots of the pre-T-031d/browser chrome
Expanded at: 2026-08-15
Expanded against: live `App/` source, re-verified against `AppMenu.vue`, `TabBar.vue` and `EditorView.vue` as they stand after T-031d (0.6.28)
Delivery: source gates only

## Intended Outcome

The browser build's always-visible `File Edit View Object Text Arrange Window` menubar row is replaced by a single app-icon button that sits immediately left of the existing home button in `TabBar.vue`. Clicking it opens the full menu tree as one nested popover: group (File, Edit, ...) → item → item's own submenu where one exists (Theme, Export Selection, Canvas Grid, Language). The installed Windows app is untouched: it already has no such row today (T-031d removed it) and keeps its native OS menu bar exactly as-is.

## Request Coverage

- Remove the always-visible `File Edit View Object Text Arrange Window` menu row from the top window chrome.
- Reach those menus by clicking a single button styled as the app icon.
- Place that button next to the existing home button in the tab bar.

## Corrections to the Brief

The stub's premise was written against the pre-T-031d screenshots and asked two questions T-031d has already answered by changing the live code:

1. **There is no longer an "always-visible menu row" in the installed app.** T-031d's own Defect Fixed Here section documents that prior to it, `AppMenu.vue` rendered unconditionally and duplicated the native OS menu bar in the installed Windows app. T-031d fixed that: `EditorView.vue:271` is now `<AppMenu v-if="!IS_TAURI" />`, and `AppMenu.vue`'s completion evidence confirms it was "stripped to just a compact `app-logo` image + the unchanged Menubar content." **The Menubar row this packet removes exists only in the browser (non-Tauri) build today.** In the installed app there is nothing left to replace; the native OS menu bar (File/Edit/View/Object/Text/Arrange/Window) is a Windows-native construct outside the webview and outside this packet's file set.
2. This settles the stub's own "Does the Tauri native menu stay as-is" question definitively: **yes, unchanged, because it was never built from `AppMenu.vue` in the first place** — it is generated at build/dev-launch from `APP_MENU_SCHEMA` by `App/tools/tauri-menu/src/generate.ts` into `desktop/generated/menu.json`, a pipeline this packet does not touch.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/components/Shell/AppMenu.vue` (44 lines) | Today: `<div class="flex ... border-b ...">` holding a `data-test-id="app-logo"` `<img src="/favicon-32.png">` plus a `MenubarRoot` with one `MenubarMenu` per `topMenus` entry (7 groups: File, Edit, View, Object, Text, Arrange, Window). Each `MenubarTrigger` carries `v-test-id="menubar-${label}"`. Items with `hasMenuSubItems(item)` render as a `MenubarSub`/`MenubarSubTrigger`/`MenubarSubContent` — this is the **only** nested-submenu usage in the file (one level: group→item→subitem). No script-side state beyond `useAppMenu()` and two `useMenuUI()` recipes. |
| `App/src/views/EditorView.vue:46,271` | `import AppMenu from '@/components/Shell/AppMenu.vue'` and `<AppMenu v-if="!IS_TAURI" />`, mounted directly above the `editor-panels` row, inside the desktop-only branch (`!isMobile && showChrome && store.state.showUI`). |
| `App/src/components/TabBar.vue:78-88` | The home button: `<Tip label="Dashboard"><button data-test-id="tabbar-home" class="flex size-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted transition-colors hover:text-surface" :class="{ 'bg-panel text-surface': activeTabId === 'dashboard' }" @click="activeTabId = 'dashboard'"><icon-lucide-home class="size-3.5" /></button></Tip>`. This is the exact visual and structural precedent for the new button. |
| `App/src/components/editor/ZoomDropdown.vue:88-96` | The proven single-trigger `DropdownMenuRoot > DropdownMenuTrigger as-child > <button>` pattern already mounted as a sibling inside `TabBar.vue`'s `desktop-shell-chrome` group. **This, not `IconButton.vue`, is the trigger recipe to copy** — see Fixed Decision 2. |
| `App/src/app/shell/menu/app-menu.ts` | `useAppMenu()` returns `{ topMenus: ComputedRef<AppMenuGroup[]> }`, `AppMenuGroup = { label: string; items: MenuEntry[] }`. Already filters `target !== 'native'`, so `topMenus` is exactly the browser-visible tree — unchanged by this packet. |
| `App/src/app/shell/menu/entry.ts` | `isMenuSeparator`, `hasMenuSubItems`, `isMenuCheckbox`, `menuChecked`, `menuDisabled`, `menuLabel`, `menuShortcut`, `menuSubItems`, `runMenuAction`, `updateMenuChecked` — pure functions over `MenuEntry`, containing no Menubar-specific coupling. Reusable as-is under any Reka menu family. |
| `App/src/app/shell/menu/schema.ts` | `APP_MENU_SCHEMA`, 7 groups, unread and unchanged by this packet. `'export-selection'`, `'theme'`, `'canvas-grid'` are the only entries with `sub` — none of those `sub` arrays contain their own `sub` (max existing nesting depth is 2). |
| `App/tools/tauri-menu/src/generate.ts` | Reads `APP_MENU_SCHEMA` directly (not `AppMenu.vue` or `app-menu.ts`), filters `target !== 'browser'`, writes `desktop/generated/menu.json` at `beforeDevCommand`/`beforeBuildCommand`. Confirms Fixed Decision 1. |
| `App/desktop/src/menu.rs:87` (`sync_panel_menu`) | Only syncs panel checkbox state on the native menu at runtime. No other runtime sync path exists. Unaffected — this packet does not touch `desktop/`. |
| `App/src/components/ui/IconButton.vue` | Root template is `<Tip :label="label" ...><button v-bind="buttonAttrs" ...><slot /></button></Tip>`. `Tip.vue`'s own root is `<span ref="triggerRef" class="contents" ...><slot /></span>` (a real DOM span, not a Vue fragment) — see Fixed Decision 2 for why this rules out `IconButton` as a `DropdownMenuTrigger as-child` target. |
| `App/src/components/canvas/SelectionActionBar.vue:54,78-87` (T-035, delivered) | Confirms the codebase's own established workaround for this exact problem: `useIconButtonUI({ size: 'sm' }).base` applied to a bare `<button data-slot="icon-button">`, used precisely because the button needed `IconButton`'s look without going through the `IconButton` component. |
| `App/src/components/ui/menu.ts` | `menu` `tv()` recipe: `content: 'z-50 rounded-lg border border-border bg-panel p-1 shadow-lg'`, `item`, `separator`, `shortcut`, `icon`, `subTrigger` slots. `useMenuUI(ui?)` and `menuContent()`/`menuItem()`/`menuSeparator()` helpers. `AppMenu.vue` already calls `useMenuUI({ content: 'min-w-52' })` and `useMenuUI({ content: 'min-w-44' })` for its two existing levels. |
| `App/packages/vue/src/i18n/messages/menu.ts` | `menuMessageDefaults` has no key for "open the menu" / "main menu" today. A new key is required (see Allowed Changes). |
| `node_modules/reka-ui` (`dist/index.cjs`) | Confirmed present and exported: `DropdownMenuRoot`, `DropdownMenuTrigger`, `DropdownMenuPortal`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuItemIndicator`, `DropdownMenuSeparator`, `DropdownMenuSub`, `DropdownMenuSubTrigger`, `DropdownMenuSubContent` — full 1:1 parity with the `Menubar*` family already used in `AppMenu.vue`. Nested `DropdownMenuSub` inside a `DropdownMenuSubContent` (the two-deep nesting this packet needs) is standard Radix-family behaviour, not a novel composition. |
| `App/tests/e2e/app/menu.spec.ts` | **Every one of its 9 tests locates menus via `[role="menubar"] [role="menuitem"]`** to click a top-level group, then reads `[role="menu"] [role="menuitem"]`. `DropdownMenuRoot` does not render `role="menubar"` — its root content is `role="menu"`, and each group becomes a `DropdownMenuSubTrigger` one level deeper. **This entire file breaks under the new structure and must be rewritten**, not left alone. |
| `App/tests/e2e/context-menu/basic.spec.ts:230-243` | The codebase's own proven pattern for opening a Reka `Sub` in a Playwright test: locate the sub-trigger by `data-test-id`, call `.hover()`, then `waitForTimeout(300)` before asserting the sub-content's items are visible — used because a plain `.click()` is not reliable for opening a hover-style `Sub`. Copy this pattern for the rewritten `menu.spec.ts`. |

## Fixed Decisions

1. **The native Tauri menu is untouched — no file under `App/desktop/` or `App/tools/tauri-menu/` changes.** Settled by the Verified Starting State above: the native menu is generated from `APP_MENU_SCHEMA` independently of `AppMenu.vue`, and `AppMenu.vue` has been browser-only since T-031d.

2. **The trigger button is a bare native `<button>`, not `<IconButton>`, and is not wrapped in `<Tip>`.** `IconButton.vue`'s template root is the `<Tip>` component, and `Tip.vue`'s own root is `<span class="contents">` — a real DOM element, not the button. `DropdownMenuTrigger as-child` clones its props/ref/`aria-*`/`data-state` onto the *single root element it is given*, which would be that `<span class="contents">`, not the inner `<button>`. Because the span carries no box (`display:contents`), `getBoundingClientRect()` on it is unreliable across browsers and would misposition the popover. Instead, copy `ZoomDropdown.vue:88-96`'s proven shape — `DropdownMenuTrigger as-child` wrapping a plain `<button>` directly — and style that button by copying `TabBar.vue`'s own `tabbar-home` class string (not the smaller `useIconButtonUI` recipe), because this button sits directly beside `tabbar-home` and must match its `size-9`/border/hover treatment exactly, not the compact toolbar icon-button size. No tooltip on the trigger itself (matching `ZoomDropdown.vue`, which also has none); use a native `aria-label` for accessibility instead.

3. **`AppMenu.vue` is edited in place, not replaced by a new file.** Its `<script setup>` (imports, `useAppMenu()`, the two `useMenuUI()` calls) is reused near-verbatim; only the template changes shape (one outer `DropdownMenuRoot` instead of seven `MenubarMenu` siblings) and one more nesting level is added. The file keeps its name and role: "the app's menu," now rendered as a button instead of a row. Its mount point moves from `EditorView.vue` into `TabBar.vue`.

4. **Nesting is three levels deep, using `DropdownMenuSub` recursively — no flattening.** Level 1 (`DropdownMenuContent`, opened by the icon button) lists the 7 groups, each a `DropdownMenuSub`/`DropdownMenuSubTrigger`. Level 2 (`DropdownMenuSubContent`) renders that group's `items`, exactly as `AppMenu.vue`'s current `MenubarContent` loop does today (`DropdownMenuSeparator` for separators, `DropdownMenuCheckboxItem` for checkboxes, `DropdownMenuItem` for plain actions, and — where `hasMenuSubItems(item)` — a **second** `DropdownMenuSub`/`DropdownMenuSubTrigger`/`DropdownMenuSubContent` for Level 3 (Theme, Canvas Grid, Export Selection, Language subitems). This is a direct, mechanical translation of `AppMenu.vue`'s existing per-item branching (lines 56-115) one level deeper — do not rewrite the branching logic, only the component family and the added outer level.

5. **Placement: the new button sits immediately to the left of `tabbar-home`, at the very start of the tab bar row.** The app icon represents the application itself and reads first; the home/dashboard button follows it. Both keep their own `border-r border-border` so the existing three-band divider rhythm (icon | home | tabs) is preserved.

6. **Gated `v-if="!IS_TAURI"`, identical to `AppMenu.vue`'s current gate.** The installed desktop app keeps only its native OS menu; this button is not added there. Adding it in Tauri too would create a second, redundant menu-access surface next to the native one, which the user did not ask for. See Open Decision 1 for the alternative if the user wants it in the installed app as well.

7. **No keyboard-access regression.** `Menubar`'s Alt-key/arrow-between-top-triggers navigation is a Radix Menubar-specific feature; the codebase has no evidence it implements Windows-style `Alt+F` mnemonics (`schema.ts`'s `accelerator` field only feeds the **native** Tauri menu via `generate.ts`; the browser menu's `shortcut` field routes through `useKeyboard()`/`appMenuShortcut()`, a global handler independent of which Reka family renders the menu UI). Swapping to `DropdownMenu` keeps full keyboard access (Enter/Space to open, Arrow keys to navigate, typeahead, Escape to close) under a materially equivalent but not identical navigation model (arrow-right opens a `Sub` instead of moving to a sibling top-level trigger) — this is an accepted, not a regressive, change.

## Open Decisions

1. **Should the icon button also appear in the installed Tauri app, as a faster way to reach menu items beside the native OS menu bar?** Recommendation: no (Fixed Decision 6) — the request is framed as replacing the row that exists in the browser build, and the installed app has no such row to replace today. If the user later wants a second, faster menu-access surface in the installed app as well, that is new scope, not a defect fix, and should be its own packet.

## Visual Contract — binding

**Trigger button** (in `TabBar.vue`, immediately before the `tabbar-home` `<Tip>` block):

```html
<DropdownMenuRoot v-model:open="menuOpen">
  <DropdownMenuTrigger as-child>
    <button
      data-test-id="app-icon-menu-trigger"
      class="flex size-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted transition-colors hover:text-surface data-[state=open]:bg-panel data-[state=open]:text-surface"
      :aria-label="t.mainMenu"
    >
      <img src="/favicon-32.png" class="size-4" alt="OpenPencil" />
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuPortal>
    <DropdownMenuContent :side-offset="4" align="start" :class="rootMenuCls.content">
      <!-- one DropdownMenuSub per topMenus group -->
    </DropdownMenuContent>
  </DropdownMenuPortal>
</DropdownMenuRoot>
```

- `rootMenuCls = useMenuUI({ content: 'min-w-40' })` — group-list level, narrower than the item level.
- Group level (`DropdownMenuSubContent` for a group's `items`): reuse `AppMenu.vue`'s existing `mainMenuCls = useMenuUI({ content: 'min-w-52' })` unchanged.
- Subitem level (Theme / Canvas Grid / Export Selection / Language): reuse `AppMenu.vue`'s existing `subMenuCls = useMenuUI({ content: 'min-w-44' })` unchanged.
- `DropdownMenuSubTrigger` for a group: `:class="menuCls.item"` (from `useMenuUI()`, no options — matches `AppMenu.vue`'s current `menuCls.item` for its nested `MenubarSubTrigger`) plus a trailing `<IconChevronRight class="size-3 text-muted" />`, exactly copying `AppMenu.vue:59-62`.
- Every `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuSeparator`, `DropdownMenuItemIndicator` and `AppShortcutText` usage is a mechanical rename of the corresponding `Menubar*` usage already in `AppMenu.vue:66-114` — same classes, same slots, same `menuLabel`/`menuShortcut`/`menuChecked`/`menuDisabled`/`runMenuAction`/`updateMenuChecked` calls from `entry.ts`.
- Test ids: the group `DropdownMenuSubTrigger` carries `v-test-id="`app-menu-group-${menu.label.toLowerCase()}`"` (replacing the old `menubar-${label}` — the role changed from menubar-trigger to sub-trigger, so the id should not claim to be a menubar).

### Banned List

- No literal colour of any kind — no hex, `rgb()`, `hsl()`, or Tailwind palette names. Only semantic tokens already present in the copied classes (`text-muted`, `text-surface`, `bg-panel`, `border-border`).
- No font-size class other than `text-xs` or `text-[11px]` (matches `menu.ts`'s `item`/`shortcut` slots — do not introduce a new one).
- No radius other than `rounded-md` or `rounded-lg` (matches `menu.ts`'s `content`/`item` slots).
- No new `tv()` recipe file. Reuse `components/ui/menu.ts` exactly as `AppMenu.vue` already does.
- No new npm dependency. `reka-ui`'s `DropdownMenu*` family is already installed and used elsewhere (`ZoomDropdown.vue`, `MobileFileMenu.vue`, etc.).
- No inline `style=`.
- No `@apply`, no new global CSS, no edit to `App/src/app.css`.
- Do not wrap the trigger in `<IconButton>` or `<Tip>` (Fixed Decision 2).
- Do not invent a new icon asset. Reuse `/favicon-32.png`, the same file `AppMenu.vue`'s current `app-logo` and the collapsed-UI branch (`EditorView.vue:318`) already use.

## Allowed Changes

- `App/src/components/Shell/AppMenu.vue` — template rewritten to the `DropdownMenu` structure in the Visual Contract; script gains `menuOpen` ref, `rootMenuCls`, and a `useI18n()` call for the new `mainMenu` label; retains `useAppMenu()` and its existing two `useMenuUI()` calls.
- `App/src/components/TabBar.vue` — mount `<AppMenu v-if="!IS_TAURI" />` immediately before the existing `tabbar-home` `<Tip>` block; add the `IS_TAURI` import from `@/constants`.
- `App/src/views/EditorView.vue` — delete the `AppMenu` import and the `<AppMenu v-if="!IS_TAURI" />` line only. No other line in this file changes.
- `App/packages/vue/src/i18n/messages/menu.ts` — add one key, `mainMenu: 'Menu'`, to `menuMessageDefaults`.
- `App/packages/vue/src/i18n/locales/{de,es,fr,it,ja,pl,ru,zh-cn}/menu.json` — add the matching translated `mainMenu` key to each of the 8 files.
- `App/tests/e2e/app/menu.spec.ts` — full rewrite of every locator that currently assumes `[role="menubar"]`, per Implementation Step 4. While rewriting, also fix the pre-existing stale assertion T-031d's completion evidence already flagged: `'menu bar has all top-level menus'` expects `['File', 'Edit', 'View', 'Object', 'Text', 'Arrange']`, missing `'Window'` — add it, since every locator in that test is being touched anyway.
- New focused Playwright coverage for the trigger itself (button visible, opens the group list, a group opens its items, a subitem submenu opens, right after Implementation Step 4 — may live in the same rewritten `menu.spec.ts` file or a new one; prefer extending `menu.spec.ts` since it already owns this surface).

Nothing else. `App/src/app/shell/menu/schema.ts`, `App/src/app/shell/menu/app-menu.ts`, `App/src/app/shell/menu/entry.ts`, `App/src/app/shell/menu/shortcut.ts`, `App/tools/tauri-menu/`, everything under `App/desktop/`, `CollabPanel.vue`, `ZoomDropdown.vue`, and the panel/dock files must not change.

## Restrictions and Exclusions

- No change to `APP_MENU_SCHEMA` or any menu entry's id, label key, shortcut or command. This packet only changes how the browser build presents the existing tree.
- No change to the native Tauri menu, `desktop/generated/menu.json`, `desktop/src/menu.rs`, or `App/tools/tauri-menu/`.
- No change to `showUI=false`, `?no-chrome`, or the mobile branch. The new button is desktop-browser-only, exactly matching `AppMenu.vue`'s current scope (mounted only inside the `!isMobile && showChrome && store.state.showUI` branch's chrome — here relocated to `TabBar.vue`, which is itself unconditional, so the button must keep its own `v-if="!IS_TAURI"`; it must not become visible on mobile or in the collapsed/bare branches, none of which mount `TabBar`'s sibling `AppMenu` differently today since `TabBar` itself already renders across all branches — verify this stays true and stop if it does not).
- No new command IDs, no new panel, no scene-graph or document change.
- Deferred to a later packet: adding the icon button to the installed Tauri app alongside the native menu (Open Decision 1).
- An implementer who wants to cross any of these should stop and report rather than proceeding.

## Implementation Steps

1. Read `AppMenu.vue`, `TabBar.vue` and `EditorView.vue` in full before writing anything; confirm the line numbers and classes cited above still match (they were re-verified 2026-08-15 against 0.6.28-era source but should be re-checked for drift).
2. Rewrite `AppMenu.vue`'s template per the Visual Contract: one `DropdownMenuRoot`, the trigger button, and the three-level `DropdownMenuContent → DropdownMenuSub(group) → DropdownMenuSub(subitem)` structure, translating `AppMenu.vue`'s existing per-item branching (separator / checkbox / has-sub / plain item) mechanically into the `DropdownMenu*` family at the new depth. Add `menuOpen` (a local `ref(false)` bound via `v-model:open`), `rootMenuCls`, and `const { menu: t } = useI18n()` for `t.mainMenu`.
3. Add the `mainMenu` key to `menuMessageDefaults` and to all 8 locale JSON files.
4. Move the mount point: add `<AppMenu v-if="!IS_TAURI" />` to `TabBar.vue` immediately before the `tabbar-home` block, import `IS_TAURI` from `@/constants`; remove the `AppMenu` import and usage from `EditorView.vue`.
5. Rewrite `App/tests/e2e/app/menu.spec.ts`. For every test: replace `[role="menubar"] [role="menuitem"]` with `editor.page.getByTestId('app-icon-menu-trigger').click()` followed by locating the group's `DropdownMenuSubTrigger` (by `data-test-id="app-menu-group-<label>"` or by text within the now-open `[role="menu"]`), then `.hover()` it (per `context-menu/basic.spec.ts:236`'s proven pattern) and `waitForTimeout(300)` before asserting the group's items are visible in the resulting (nested) `[role="menu"]` — use `.last()` when more than one `role="menu"` is open simultaneously, since the root content and the open sub-content are both `role="menu"` at once. Fix the stale `'Window'`-missing assertion in the same pass. Add the new trigger/root-open/group-open/subitem-open coverage described in Allowed Changes.
6. Hand-verify in the dev build: the button opens; each of the 7 groups opens its items; Theme, Canvas Grid, Export Selection and Language each open their own subitems; a command item (e.g. Undo) still runs; a checkbox item (e.g. Autosave) still toggles; Escape and outside-click both close the whole tree; the button sits directly left of the home button with matching height and border rhythm; all four themes render the popover correctly (tokens only, so this should follow automatically — verify, don't special-case).
7. Run, in this order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on `src/components/Shell/AppMenu.vue src/components/TabBar.vue src/views/EditorView.vue tests/e2e/app/menu.spec.ts`
   - `bun run check:i18n`
   - `bunx playwright test tests/e2e/app/menu.spec.ts --project=openpencil`
   - `bunx playwright test tests/e2e/shell/chrome.spec.ts tests/e2e/tabs.spec.ts tests/e2e/editor/recovery.spec.ts --project=openpencil` (regression: T-031d's chrome tests and the dashboard/home-button tests must stay green since `TabBar.vue` changed)

   Do not run `bun run check`, `bun run test` or `bun run test:unit`.
8. Do not claim delivery. This packet stops at source gates; installed desktop verification is only required if the user asks for a build (and even then, the installed app is unaffected per Fixed Decision 1 and 6 — there is nothing new to verify there beyond "still builds").

## Acceptance Criteria

- [ ] The browser build shows exactly one trigger button (the app icon) immediately left of `tabbar-home`; no separate `File Edit View...` row remains anywhere in the browser chrome.
- [ ] Clicking the trigger opens a menu listing all 7 groups (File, Edit, View, Object, Text, Arrange, Window) from the unmodified `topMenus`/`APP_MENU_SCHEMA`.
- [ ] Every group opens its own items; every item that had a submenu before (Theme, Canvas Grid, Export Selection, Language) still opens it, one level deeper than before.
- [ ] Every command, checkbox and shortcut label still comes from the unmodified `useAppMenu()` — no new parallel label or action source.
- [ ] The installed Tauri app is unaffected: no new element appears there, and the native OS menu is unchanged.
- [ ] `App/tests/e2e/app/menu.spec.ts` is fully rewritten and green, including the fixed `'Window'` assertion, plus new trigger/nesting coverage.
- [ ] `tests/e2e/shell/chrome.spec.ts`, `tests/e2e/tabs.spec.ts` and `tests/e2e/editor/recovery.spec.ts` stay green.
- [ ] All four themes render the popover correctly with no literal colour anywhere in the diff.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] Mobile, `showUI=false`, `?no-chrome` and the dashboard branch are unaffected.

## Stop Conditions

Stop and report if: nesting a `DropdownMenuSub` inside a `DropdownMenuSubContent` does not render or position correctly in hand verification (Fixed Decision 4's core assumption); the trigger button's position or size cannot be reconciled with `tabbar-home` without touching files outside the Allowed Changes list; rewriting `menu.spec.ts` reveals a Playwright timing issue that two focused attempts cannot resolve; or a change outside the Allowed Changes list is required to make the tree functionally equivalent to today's.

## Revision History

- Revision 1 — 2026-08-14: BRIEF, raised from the user's request batch.
- Revision 2 — 2026-08-15: expanded against live source post-T-031d. Corrected the stub's premise (no row exists in the installed app to replace; the native menu was never coupled to `AppMenu.vue`). Settled trigger composition against `IconButton.vue`'s actual root element, nesting depth against the live schema, and identified that `tests/e2e/app/menu.spec.ts`'s entire locator strategy breaks and must be rewritten — not previously called out anywhere in the stub.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Executed; repair verifies AppMenu is gated to desktop browser chrome, keeping ?no-chrome and showUI=false unaffected; 12/12 menu Playwright tests green and, as of 2026-08-18, the combined `bun run lint`, `tsgo` and `vue-tsc` gates are green.
