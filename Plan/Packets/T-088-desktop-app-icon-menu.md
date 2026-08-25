# T-088 - Move the desktop menu bar into the app-icon dropdown

Task ID: T-088
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-042 (introduced the app-icon menu and the `TabBar` chrome gate); T-089 (repairs the trigger icon asset — run it first, or the button here renders a broken image)
Prepared from: the user's 2026-08-24 request — "i want the tools file, edit, view, object, text, arrange, window to move to an openpotlood icon click that will be positioned next to the home icon. it will open a submenu", with a screenshot of the installed 0.6.32 window showing the native `File Edit View Object Text Arrange Window` row above the tab strip.
Expanded at: 2026-08-24 (Africa/Johannesburg)
Expanded against: live `App/` source — `src/components/Shell/AppMenu.vue`, `src/components/TabBar.vue`, `src/constants.ts`, `src/app/shell/menu/{app-menu,schema,use,shortcut}.ts`, `src/app/shell/keyboard/registry.ts`, `desktop/src/{menu,menu_events,lib}.rs`, `desktop/tauri.conf.json`, `tools/tauri-menu/src/generate.ts`, `tests/e2e/app/menu.spec.ts`, and `tauri 2.10.2` / `muda` sources in the local cargo registry.
Delivery: named source gates + browser check, plus a conditional desktop check (this packet changes Rust and an `IS_TAURI`-only surface, so the browser cannot prove it — see **Integration or Installed-Result Check**).
Execution size: 3 core implementation files (`src/constants.ts`, `src/components/TabBar.vue`, `desktop/src/menu.rs`); 0 new test files, 1 existing Playwright spec re-run as a non-regression gate; no split needed.

## Intended Outcome

In the installed Windows desktop app, the horizontal `File Edit View Object Text Arrange Window` row disappears from the window frame. Those seven menus are reached exactly as they already are in the browser build: by clicking the OpenPotlood icon button that sits in the tab strip immediately left of the Dashboard (home) button, which opens a dropdown whose seven top-level rows each expand into their own submenu.

Nothing about the menu's contents, labels, shortcuts, ordering, or behaviour changes. The native menu stays *installed but hidden*, so every accelerator it registers (including `CmdOrCtrl+Alt+I` for Developer Tools) and the `menu-event` route continue to work unchanged.

## Request Coverage

- "the tools file, edit, view, object, text, arrange, window" — the seven groups in `APP_MENU_SCHEMA` (`src/app/shell/menu/schema.ts`), which are the same seven the native menu renders.
- "move to an openpotlood icon click" — the existing `AppMenu.vue` trigger, a `size-9` button rendering `/favicon-32.png`.
- "positioned next to the home icon" — `AppMenu` already renders immediately before the `tabbar-home` Dashboard button inside `TabsRoot` in `TabBar.vue`; this packet only removes the gate that hides it under Tauri. See Fixed Decision 5.
- "it will open a submenu" — `AppMenu.vue` already wraps each group in `DropdownMenuSub` + `DropdownMenuSubContent`.

## Verified Starting State

| Path | Symbol / selector (current span) | What is true today |
| --- | --- | --- |
| `src/components/Shell/AppMenu.vue` | whole file (1–137) | The complete icon-triggered menu already exists: `DropdownMenuTrigger` button `data-test-id="app-icon-menu-trigger"` with `<img src="/favicon-32.png" class="size-4">`, then one `DropdownMenuSub` per `topMenus` entry (`data-test-id="app-menu-group-${label.toLowerCase()}"`), nested subs, checkbox items, separators and `AppShortcutText`. **No new component is needed.** |
| `src/components/TabBar.vue` | `showAppMenu` (38–40) | `computed(() => !IS_TAURI && !isMobile.value && showChrome && store.state.showUI)` — the `!IS_TAURI` term is the only reason the icon menu is absent in the desktop build. |
| `src/components/TabBar.vue` | template (97–108) | `<AppMenu v-if="showAppMenu" />` is the first child of `TabsRoot`, immediately followed by the `Tip label="Dashboard"` wrapper around the `data-test-id="tabbar-home"` button. Ordering already satisfies "next to the home icon". |
| `src/components/TabBar.vue` | import (10) | `import { IS_TAURI } from '@/constants'` |
| `src/constants.ts` | line 1 and the re-export block (4–61) | `import { IS_BROWSER, IS_TAURI } from '@open-pencil/core/constants'`, re-exported from this module. Local app constants (`TRYSTERO_APP_ID`, `WEB_APP_ORIGIN`, `getShareUrl`, `PEER_COLORS`) are declared after the re-export block, starting at `export const TRYSTERO_APP_ID = 'openpencil'`. |
| `packages/vue/src/shared/input/wheel.ts` | `isMacOs()` (17–19) | The authoritative in-repo macOS test: `typeof navigator !== 'undefined' && /Mac\|iPhone\|iPad\|iPod/.test(navigator.platform)`. Copy this predicate; do not invent another. |
| `desktop/src/menu.rs` | `install_app_menu` (129–163) | Builds `MenuBuilder`, prepends the macOS-only `OpenPotlood` app submenu under `#[cfg(target_os = "macos")]`, appends `build_schema_menus(&handle)?`, then calls `app.set_menu(builder.build()?)?`. It is called from `lib.rs` `setup` (line 161). The file does **not** currently `use tauri::Manager`. |
| `desktop/src/menu.rs` | `build_schema_menus` (120–127) | Deserialises `include_str!("../generated/menu.json")` into `Vec<MenuGroup>`. Unchanged by this packet. |
| `desktop/src/menu.rs` | `sync_panel_menu` / `find_window_submenu` (77–118) | Locate the Window submenu through `app.menu()`. They keep working because the menu stays installed (Fixed Decision 2). |
| `desktop/src/lib.rs` | `set_main_window_title` (108–114), `queue_open_paths` (97) | Both already resolve the main window with `app.get_webview_window("main")`, proving the label is `"main"` — `desktop/tauri.conf.json` `app.windows[0]` (13–21) declares no explicit `label`, so Tauri's default applies. |
| `desktop/src/menu_events.rs` | `handle_menu_event` (6–18) | Debug-only `dev-tools` branch toggling devtools; everything else is emitted to the webview as `menu-event`. Unchanged by this packet. |
| `src/app/shell/menu/use.ts` | `useMenu()` (52), `syncNativePanelMenu` (159–170) | Returns early unless `isTauri()`; the panel sync is invoked as `void syncNativePanelMenu().catch(() => undefined)` and inside a watcher with the same `.catch`. Not touched here, and unaffected because the menu remains installed. |
| `src/app/shell/keyboard/registry.ts` | `shortcuts` (80–133) | Web shortcuts (`save`, `save-as`, `open-file`, `close-tab`, `toggle-ui`, `export-selection-png`, command shortcuts) are registered through `tinykeys` with **no** `isTauri()` gate, so they already coexist with the native accelerators today. This packet does not change that coexistence. |
| `tools/tauri-menu/src/generate.ts` | `isNativeVisible` (15–17) | The generator drops `target: 'browser'` entries from `desktop/generated/menu.json`; `src/app/shell/menu/app-menu.ts` `isVisible` (24–26) drops `target: 'native'` entries from the in-app menu. `src/app/shell/menu/schema.ts` (160–166) contains the only two targeted entries: `profiler` (`browser`) and `dev-tools` (`native`). |
| `tests/e2e/app/menu.spec.ts` | `app-icon-menu-trigger` usage (17, 47, 189–202) | Existing browser coverage of the icon menu, including the `no-chrome` and `showUI` gates. It runs against Vite, not Tauri, so it is a non-regression gate here, not proof of the desktop behaviour. |

Rust API facts verified in `~/.cargo/registry/.../tauri-2.10.2`:

- `App::set_menu` (`src/app.rs` 887) assigns the app-wide menu to every existing window on non-macOS and populates each window's `menu_lock` with `WindowMenu { is_app_wide: true, .. }`.
- `WebviewWindow::hide_menu` (`src/webview/webview_window.rs` 1595) delegates to `Window::hide_menu` (`src/window/mod.rs` 1278), which on Windows calls muda's `hide_for_hwnd`.
- muda `hide_for_hwnd` (`src/platform_impl/windows/mod.rs` 393–403) calls `SetMenu(hwnd, null)` + `DrawMenuBar` only. It does **not** unregister the accelerator table, and it does not remove the menu from the app — which is exactly why accelerators and `on_menu_event` survive.

## Read First

Read only these, in this order:

1. `src/components/TabBar.vue` lines 1–45 (imports through `showAppMenu`) and 92–110 (`TabsRoot` open tag through the Dashboard button).
2. `src/constants.ts` lines 1–5 and 62–66 (the import, the end of the re-export block, and the first local constant).
3. `desktop/src/menu.rs` lines 1–6 (imports) and 129–163 (`install_app_menu`).

Do **not** open `src/components/Shell/AppMenu.vue`, `src/app/shell/menu/schema.ts`, or `desktop/generated/menu.json`. This packet changes none of them and their contracts are already stated above.

## Corrections to the Brief

The request describes work that is *partly already built*. State this in the execution report rather than rebuilding it:

- The icon-triggered menu with submenus **already exists and already ships** — in the browser build. `AppMenu.vue` is complete, styled, localised and covered by `tests/e2e/app/menu.spec.ts`. The desktop build simply suppresses it via `!IS_TAURI` and renders Tauri's native menu instead.
- Therefore this is **not** a "build a new menu" packet. It is a two-line front-end gate change plus a three-line Rust change that hides the native in-window menu bar.
- The screenshot's `File Edit View Object Text Arrange Window` row is **not** rendered by any Vue component. Grepping `src/` for a horizontal menu bar will find nothing. It is drawn by Windows from the menu installed in `desktop/src/menu.rs`.

## Fixed Decisions

1. **Reuse `AppMenu.vue` unchanged.** It already renders the trigger, the seven groups, nested submenus, checkbox items, separators and shortcut text, and it is already the desktop-browser menu. Creating a second menu surface would duplicate `useAppMenu()`'s action wiring.
2. **Hide the native menu; do not skip installing it.** `install_app_menu` still calls `app.set_menu(...)`; the non-macOS branch then calls `hide_menu()` on the main window. Verified consequences: accelerators stay registered (muda `hide_for_hwnd` only calls `SetMenu(hwnd, null)`), `on_menu_event` in `lib.rs` (149–151) still routes, and `sync_panel_menu` still finds the Window submenu through `app.menu()`. Skipping installation instead would silently drop `CmdOrCtrl+Alt+I` (Developer Tools — the only accelerator with no `tinykeys` equivalent in `src/app/shell/keyboard/registry.ts`) and would make every `sync_panel_menu` call fail.
3. **macOS keeps its native menu bar.** On macOS the menu belongs to the system menu bar at the top of the screen, not to the window frame, so there is nothing in-window to remove and the in-app duplicate would be wrong. The gate is `IS_TAURI && IS_MACOS`, not `IS_TAURI`.
4. **`IS_MACOS` is declared in `src/constants.ts`, not in `packages/core/src/constants.ts`.** The packages are consumed as built output; adding the constant to `@open-pencil/core` would require `bun run build:packages`, which the delivery policy forbids per packet. `src/constants.ts` is app source compiled by Vite directly.
5. **The trigger stays immediately left of the Dashboard button.** That is the existing DOM order in `TabBar.vue` and matches the request's "next to the home icon"; the browser build already ships this arrangement, so keeping it means the two builds look identical. Do not reorder `TabsRoot`'s children.
6. **`isVisible` in `src/app/shell/menu/app-menu.ts` is left exactly as it is.** Its only effect is to drop `dev-tools` (`target: 'native'`, the sole such entry). Because Decision 2 keeps the accelerator alive, Developer Tools stays reachable in debug desktop builds via `Ctrl+Alt+I` without adding a Tauri command, a new `invoke` route, or a fourth changed file. Making it runtime-aware is explicitly out of scope.
7. **No version bump and no delivery in this packet.** Version files stay at 0.6.32 unless the user authorises a batched delivery in the execution session.

## Visual Contract — binding

No new markup, classes, icons, recipes or test IDs are introduced. The desktop build must render the trigger byte-identically to the browser build, i.e. exactly what `src/components/Shell/AppMenu.vue` already emits:

- Trigger button classes, unchanged: `flex size-9 shrink-0 cursor-pointer items-center justify-center border-r border-border text-muted transition-colors hover:text-surface data-[state=open]:bg-panel data-[state=open]:text-surface`
- Trigger content, unchanged: `<img src="/favicon-32.png" class="size-4" alt="OpenPencil" />`; `:aria-label="t.mainMenu"`; `data-test-id="app-icon-menu-trigger"`
- Group rows, unchanged: `useMenuUI()` `item` recipe + `IconChevronRight` from `~icons/lucide/chevron-right` at `class="size-3 text-muted"`; `data-test-id="app-menu-group-${menu.label.toLowerCase()}"`
- Content surfaces, unchanged: `useMenuUI({ content: 'min-w-40' })` for the root, `min-w-52` for group content, `min-w-44` for nested content
- Placement, unchanged: first child of `TabsRoot` in `src/components/TabBar.vue`, directly before the `Tip label="Dashboard"` wrapper of `data-test-id="tabbar-home"`. The `border-r border-border` on both the trigger and the home button produces the divider seen between them.
- States: default/hover/open are already governed by the classes above; the trigger is never disabled; the whole button unmounts (rather than dimming) when `showAppMenu` is false, which is the existing `v-if` behaviour.

### Banned List

- No new component, no new file under `src/components/`.
- No edit to `src/components/Shell/AppMenu.vue`.
- No edit to `src/app/shell/menu/schema.ts`, and therefore no regeneration of `desktop/generated/menu.json`.
- No edit to `src/app/shell/menu/app-menu.ts` (see Fixed Decision 6) or `src/app/shell/menu/use.ts`.
- No new Tauri command, no new entry in the `invoke_handler!` list in `desktop/src/lib.rs`, no change to `desktop/capabilities/default.json`.
- No literal colour (no hex, `rgb()`, or `bg-zinc-*`) — semantic tokens only; no font size outside `text-xs` / `text-[11px]`; no radius outside `rounded-md` / `rounded-lg`; no new `tv()` recipe.
- No new npm or cargo dependency; no `bun install`; no edit to `app.css` or any global CSS.
- No new store or reactive state — `showAppMenu` already exists.
- No `window.remove_menu()`, no `menu.remove_for_hwnd`, no conditional skipping of `app.set_menu` (Fixed Decision 2).
- No version bump in `package.json`, `desktop/tauri.conf.json`, or `desktop/Cargo.toml`; no Git work.

## Allowed Changes

Exactly these three files:

- `src/constants.ts` — add one exported constant.
- `src/components/TabBar.vue` — one import line, one `computed` expression, and the comment above them.
- `desktop/src/menu.rs` — one cfg-gated `use`, and one cfg-gated block at the end of `install_app_menu`.

## Restrictions and Exclusions

An implementer who wants to cross one of these should stop and report.

- Do not restructure `TabsRoot`'s children or move the Dashboard, new-tab, `CollabPanel`, `ZoomDropdown`, or toggle-UI controls.
- Do not change what the menu contains. Labels, ordering, shortcuts, checkbox state, and command IDs are out of scope.
- Do not touch the mobile layout, `MobileToolbar.vue`, `MobileHud`, or the `no-chrome` / `showUI` semantics of the gate — only the `IS_TAURI` term changes.
- Do not "fix" the fact that web `tinykeys` shortcuts and native accelerators both exist in the desktop build. That is the pre-existing condition (`src/app/shell/keyboard/registry.ts` has no `isTauri()` gate) and it is unchanged by hiding the menu.
- Do not add a devtools `invoke` route (Fixed Decision 6).
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun run build`, `bun run build:packages`, `bun install`, or any package-manager mutation.
- Do not run `bun run tauri build` or the NSIS installer, and do not bump versions, unless the user explicitly authorises desktop delivery in the execution session.

### Deferred to a later packet

- Making `isVisible` in `app-menu.ts` runtime-aware so `dev-tools` appears inside the in-app dropdown (and `profiler` is hidden under Tauri). Requires a `toggle_devtools` Tauri command plus its `invoke_handler` registration.
- Any custom/frameless title bar work. The native title bar (`OpenPotlood 0.6.32`) stays exactly as it is; only the menu row below it disappears.

## Implementation Steps

**Step 1 — Pre-flight.** Reread the three spans named in **Read First** and confirm each anchor still matches: `showAppMenu`'s expression in `TabBar.vue`, the `import { IS_TAURI } from '@/constants'` line, the first local `export const` in `src/constants.ts`, and the final `app.set_menu(builder.build()?)?; Ok(())` of `install_app_menu`. If any differs, stop and report the drift.

**Step 2 — `src/constants.ts`: add `IS_MACOS`.** Insert immediately above `export const TRYSTERO_APP_ID = 'openpencil'` (that is, after the `import type { Color } ...` line):

```ts
// macOS puts an application's menu bar in the system menu bar rather than in the
// window, so the desktop build keeps its native Tauri menu there. Every other
// platform draws that menu inside the window frame; those builds hide it and use
// the in-app AppMenu button instead (see TabBar.vue and desktop/src/menu.rs).
// Same predicate as isMacOs() in packages/vue/src/shared/input/wheel.ts.
export const IS_MACOS = IS_BROWSER && /Mac|iPhone|iPad|iPod/.test(navigator.platform)
```

`IS_BROWSER` is already imported at line 1 of this file; do not add an import. Do not add `IS_MACOS` to the re-export block — it is a local declaration.

**Step 3 — `src/components/TabBar.vue`: widen the gate.** Change the import on line 10 to:

```ts
import { IS_MACOS, IS_TAURI } from '@/constants'
```

and replace the `showAppMenu` computed with:

```ts
// The Tauri build keeps a native menu bar only on macOS, where it lives in the
// system menu bar. On Windows and Linux the in-window menu row is hidden (see
// install_app_menu in desktop/src/menu.rs), so this app-icon menu is the only
// route to File/Edit/View/... there, exactly as in the browser build.
const showAppMenu = computed(
  () => !(IS_TAURI && IS_MACOS) && !isMobile.value && showChrome && store.state.showUI
)
```

Also update the stale wording in the comment block above `const params = useUrlSearchParams('history')` (lines 21–25): replace the two occurrences of "desktop-browser" with "desktop" so the comment no longer claims the button is browser-only. Change nothing else in that comment, and keep the `(see T-042 Restrictions)` reference.

**Step 4 — `desktop/src/menu.rs`: hide the in-window menu on Windows and Linux.** Add this import directly below the existing `#[cfg(target_os = "macos")] use tauri::menu::PredefinedMenuItem;` block (i.e. after line 5):

```rust
#[cfg(not(target_os = "macos"))]
use tauri::Manager;
```

Then, inside `install_app_menu`, replace the final two lines

```rust
    app.set_menu(builder.build()?)?;
    Ok(())
```

with

```rust
    app.set_menu(builder.build()?)?;

    // Windows and Linux draw the menu as a row inside the window frame. That row
    // moved into the app-icon dropdown in the tab strip (src/components/Shell/AppMenu.vue),
    // so hide it here. The menu stays installed on purpose: hiding is SetMenu(hwnd, NULL)
    // in muda, which leaves the accelerator table and the on_menu_event route intact, and
    // keeps sync_panel_menu's app.menu() lookup working. macOS is untouched because its
    // menu lives in the system menu bar, not in the window.
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = app.get_webview_window("main") {
        window.hide_menu()?;
    }

    Ok(())
```

The window label `"main"` is the Tauri default and is already used by `set_main_window_title` and `queue_open_paths` in `desktop/src/lib.rs`. `app` here is `&mut tauri::App<R>`, which implements `Manager<R>`, so `get_webview_window` resolves once the `use tauri::Manager;` above is present.

**Step 5 — No test files are created.** The relocation is `IS_TAURI`-only and Playwright runs against Vite, so no browser assertion can distinguish before from after. The existing `tests/e2e/app/menu.spec.ts` is run unchanged as a non-regression gate (Step 6). Do not add a Tauri-specific spec; the harness has no desktop runner.

**Step 6 — Verification.** Run the development-loop command while editing, then the final gates once, in the order given under **Verification**.

## Acceptance Criteria

- [ ] `src/constants.ts` exports `IS_MACOS`, defined with the same predicate as `isMacOs()` in `packages/vue/src/shared/input/wheel.ts`, and imports nothing new.
- [ ] `src/components/TabBar.vue` `showAppMenu` reads `!(IS_TAURI && IS_MACOS) && !isMobile.value && showChrome && store.state.showUI`, and the comment above the chrome gate no longer says "desktop-browser".
- [ ] `desktop/src/menu.rs` still calls `app.set_menu(...)` on every platform, and additionally calls `window.hide_menu()?` on the main window under `#[cfg(not(target_os = "macos"))]`.
- [ ] No file other than those three is modified; `git`-less diff check: the executor lists exactly three changed paths in its report.
- [ ] `bunx playwright test tests/e2e/app/menu.spec.ts --project=openpencil` passes with no spec edits.
- [ ] `bunx tsgo --noEmit` and `bunx vue-tsc --noEmit -p tsconfig.json` exit 0.
- [ ] `bunx oxlint -c oxlint.json --type-aware --type-check src/` reports 0 errors for the touched files (the repo's pre-existing findings live under `packages/` and `tests/` and are out of scope).
- [ ] Browser check: at `http://localhost:1420` the OpenPotlood icon button still sits immediately left of the Dashboard button, opens the dropdown, and each of the seven groups expands a submenu — i.e. no browser regression.
- [ ] Desktop check (only if authorised — see below): the installed/dev window shows no `File Edit View Object Text Arrange Window` row, and the icon button next to Dashboard opens the same seven-group dropdown.

## Verification

### Development loop — repeat as needed

```bash
cd App && bunx playwright test tests/e2e/app/menu.spec.ts --project=openpencil
```

### Final pre-completion gates — run once

```bash
cd App && bunx tsgo --noEmit
```

```bash
cd App && bunx vue-tsc --noEmit -p tsconfig.json
```

```bash
cd App && bunx oxlint -c oxlint.json --type-aware --type-check src/
```

```bash
cd App && bunx playwright test tests/e2e/panels/helpers.ts tests/e2e/toolbar/capability.spec.ts --project=openpencil
```

(That last spec and helper both drive `app-icon-menu-trigger`; run them once as the second non-regression gate. Do not run the full Playwright suite.)

Then the browser check:

```bash
cd App && bun run dev
```

## Integration or Installed-Result Check

**Browser (always, and it is not desktop proof).** With `bun run dev` on port 1420: the icon button renders left of the Dashboard button; clicking it opens the root dropdown; hovering `File`, `Edit`, `View`, `Object`, `Text`, `Arrange` and `Window` each opens a submenu; `Escape` closes; toggling the sidebar button (`app-toggle-ui`) hides and restores the trigger; `?no-chrome` still removes it. This only proves the browser path did not regress — the changed behaviour is invisible here because `IS_TAURI` is false.

**Desktop (necessary, and gated on user approval).** The relocation is Rust plus an `IS_TAURI`-only surface, which the delivery policy names as a case the browser cannot prove. Ask the user before running either of these, and prefer the first:

1. Minimum proof — `cd App && bun run tauri dev`. Confirm: no menu row under the `OpenPotlood 0.6.32` title bar; the icon button left of Dashboard opens the seven-group dropdown; `Ctrl+Alt+I` still toggles Developer Tools (proving Fixed Decision 2); opening/closing a panel from `Window >` in the dropdown still works, which exercises `sync_panel_menu` against the still-installed menu.
2. Full delivery — `bun run tauri build`, the NSIS installer, and the installed identity/version/hash check. Only on an explicit batched-delivery authorisation, and only with the version files synchronised at that point.

If the user declines both, report the desktop behaviour as **unproven** rather than claiming it works.

## Stop Conditions

Stop and report instead of improvising if any of these occur:

- `install_app_menu`'s tail no longer matches the span quoted in Step 4, or `desktop/src/menu.rs` has been restructured.
- `hide_menu()` is not resolvable on the value returned by `get_webview_window` (would indicate a Tauri version other than the verified 2.10.2).
- `showAppMenu` or the `<AppMenu v-if="showAppMenu" />` placement in `TabBar.vue` differs from the Verified Starting State.
- The desktop check shows the menu row still present, or shows the accelerators dead — that would contradict Fixed Decision 2 and needs a decision, not a workaround.
- Any gate fails for a reason traceable to the three changed files.
- The work appears to require a fourth file, a new Tauri command, or a schema/`menu.json` regeneration.

## Execution Report Contract

Report: the exact list of changed files (expected: three); the final text of the `showAppMenu` expression and of the new `#[cfg(not(target_os = "macos"))]` block; each gate command with its exit status; the browser observations from the list above; whether the desktop check was authorised, which variant was run, and its observations — or an explicit "desktop behaviour unproven" if it was not run; any anchor that had drifted at pre-flight; and confirmation that the icon menu already existed for the browser build (the correction in **Corrections to the Brief**) so the plan record is accurate.

## Status record

- 2026-08-24 — Packet written directly as an executable packet (no brief stage) from the user's request and a full read of the live source. Verified during expansion: (1) `AppMenu.vue` already implements the requested icon-click submenu and is used by `TabBar.vue`, gated off under Tauri; (2) the screenshot's menu row comes from `desktop/src/menu.rs` + `desktop/generated/menu.json`, not from any Vue component; (3) `muda::hide_for_hwnd` is `SetMenu(hwnd, NULL)` only, so hiding preserves accelerators and menu events, making `hide_menu()` strictly safer than skipping `set_menu`; (4) `src/app/shell/keyboard/registry.ts` registers the web shortcuts with no `isTauri()` gate, so no shortcut depends on the native menu except `CmdOrCtrl+Alt+I`; (5) the window label is `"main"` by Tauri default, as `set_main_window_title` already relies on. No Open Decisions.
- 2026-08-24 — Executed. Pre-flight confirmed all three anchors (`showAppMenu`, the `IS_TAURI` import line, the first local `export const` in `constants.ts`, and `install_app_menu`'s tail) matched the Verified Starting State exactly; no drift. Made exactly the three Allowed Changes: `src/constants.ts` (added `IS_MACOS`), `src/components/TabBar.vue` (widened the `IS_TAURI` import to `IS_MACOS, IS_TAURI`, replaced `showAppMenu` with the `!(IS_TAURI && IS_MACOS) && ...` form plus its explanatory comment, and updated the two "desktop-browser" → "desktop" wording spots in the comment above `useUrlSearchParams`), `desktop/src/menu.rs` (added `#[cfg(not(target_os = "macos"))] use tauri::Manager;` and the `#[cfg(not(target_os = "macos"))] if let Some(window) = app.get_webview_window("main") { window.hide_menu()?; }` block before `Ok(())`, keeping `app.set_menu(...)` unconditional). Gates run in order, all passed: `bunx playwright test tests/e2e/app/menu.spec.ts --project=openpencil` (12 passed, exit 0); `bunx tsgo --noEmit` (exit 0); `bunx vue-tsc --noEmit -p tsconfig.json` (exit 0); `bunx oxlint -c oxlint.json --type-aware --type-check src/` (0 warnings, 0 errors, exit 0); `bunx playwright test tests/e2e/panels/helpers.ts tests/e2e/toolbar/capability.spec.ts --project=openpencil` (11 passed, exit 0). Browser check against the already-running `bun run dev` at `http://localhost:1420`: trigger (`app-icon-menu-trigger`) renders immediately left of `tabbar-home` with the byte-identical class list and content from the Visual Contract; clicking it opens the root dropdown containing exactly the seven `app-menu-group-{file,edit,view,object,text,arrange,window}` entries; hovering File opens its submenu (`data-state="open"`); `Escape` closes the dropdown and restores `body` pointer-events; `?no-chrome` removes the trigger from the DOM entirely — all pass, no regression. Desktop behaviour was not attempted in this session (no `bun run tauri dev`/`build`, no NSIS installer, no version bump) per this session's explicit rules; **desktop behaviour is unproven**. Rust cargo compilation of `desktop/src/menu.rs` was likewise not run (would require `cargo`/`tauri` build tooling out of scope here), so the Rust change is unverified beyond source-level review against the packet's quoted spans and the Tauri 2.10.2 API facts cited in Verified Starting State. Acceptance Criteria: all browser-provable items met; the two desktop-only criteria (native menu row absent, desktop dropdown parity) remain unproven, consistent with Stop Conditions/Delivery policy for this session. No Stop Condition was hit. Confirmed for the record: the icon-triggered menu already existed for the browser build before this packet (`AppMenu.vue`); this packet only widened the gate and added the Rust hide call.
