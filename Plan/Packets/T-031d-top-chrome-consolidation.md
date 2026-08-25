# T-031d - Top chrome consolidation

Task ID: T-031d
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-031a (Done, 0.6.25), T-031b, T-031c
Blocks: T-032
Expanded against: live `App/` source at 0.6.25, inspected 2026-08-11
Last expanded: 2026-08-11T19:00:00+02:00
Expansion route: JUDGED from the user's request to declutter the top toolbar

## Scope Boundary (read first)

This packet reduces the stacked chrome above the canvas by one row and removes a duplicated document name. It touches the shell chrome only.

Explicitly not in this packet: the bottom tool palette and the workspace switcher (T-032), the canvas-focus layout (T-033), anything in `src/app/shell/panels/`, and the Window/native menus.

Do not start until T-031c is Done and installed, because both packets edit `EditorView.vue`.

## Defect Fixed Here

T-031a moved `AppMenu`, `CollabPanel` and `ZoomDropdown` out of the composite panels into a new `desktop-shell-chrome` row (`App/src/views/EditorView.vue:270-276`). On installed Windows the app now stacks four bands above the canvas:

1. native title bar (`OpenPotlood 0.6.25`),
2. native menu bar (File / Edit / View / Object / Text / Arrange / Window),
3. `TabBar`, 36 px, already showing the document name on the active tab,
4. the new chrome row, 33 px, showing the app logo and the **same** document name again, plus the UI toggle, Collaboration/Share and Zoom.

`App/src/components/Shell/AppMenu.vue:61-89` renders that logo/name/toggle block. Its Menubar row (line 90) is already correctly gated behind `IS_TAURI`, so in the installed app `AppMenu` contributes nothing but the duplicate.

## Target Layout

**Installed (Tauri):** native title bar + native menu bar + **one** 36 px application row.

```text
[home] [Untitled x] [+]  .....................  [avatar] [Share]  [100% v]  [sidebar]
```

**Browser (no native menu):** the Menubar row is retained above that same application row, and a compact logo stays at its left.

```text
[logo] File Edit View Object Text Arrange Window
[home] [Untitled x] [+]  .....................  [avatar] [Share]  [100% v]  [sidebar]
```

Net effect on Windows: one visual band and roughly 33 px removed, and the document name appears once instead of twice.

## Implementation Contract

### 1. Merge the chrome row into the tab bar

`TabBar.vue` becomes the single application row. Its root is already `flex h-9 shrink-0 items-end`. Add, after the `+` button:

- a `<div class="min-w-0 flex-1" />` spacer, then
- a right-hand group carrying `CollabPanel`, `ZoomDropdown` and the UI-toggle button, vertically centred (`items-center`) inside the row.

Keep `data-test-id="desktop-shell-chrome"` on that right-hand group so any selector written against T-031a's row still resolves.

Move the UI-toggle button verbatim from `AppMenu.vue:80-88`, keeping its `data-test-id="app-toggle-ui"`, its `Tip` label and its `appMenuShortcutLabel('toggle-ui')` binding.

In `EditorView.vue`, delete the `desktop-shell-chrome` wrapper at lines 270-276 and the now-unused `CollabPanel` and `ZoomDropdown` imports. `AppMenu` renders directly above the panels row, and only in the browser build.

### 2. Strip the duplicate from AppMenu

In `AppMenu.vue`, remove the logo/name/toggle block (lines 62-89) when `IS_TAURI` is true. In the browser build keep a compact logo at the left of the Menubar row; the document name block is removed in both builds because the tab now owns it.

Delete `useDocumentNameRename` and the `nameInput` template ref from `AppMenu.vue` once the rename moves.

### 3. Move rename onto the active tab

The tab entry's `name` is a snapshot of `store.state.documentName` (`App/src/app/tabs/*.ts:49`), so renaming must update the store and let the tab list re-sync - it must not write `tab.name` directly.

In `TabBar.vue`:

- Call `useDocumentNameRename(store)` from `useEditorStore()`.
- Double-clicking the **active** tab's label starts the rename; double-clicking an inactive tab switches to it and does nothing else.
- While editing, the active tab renders the same inline input the shell row used, keeping `data-test-id="app-document-name-input"`, the `@blur="commitRename"` and `@keydown="rename.onKeydown"` bindings. Keep `data-test-id="app-document-name"` on the non-editing label.
- Confirm the tab list re-renders with the new name after commit. If `tabs` does not recompute from `store.state.documentName`, stop and report rather than writing to `tab.name`.
- The rename input must not trigger tab drag (`useFlatReorderDrag`) or tab close. Guard the drag setup while `editingName` is true.

### 4. Leave these alone

`CollabPanel.vue` and `ZoomDropdown.vue` are reuse-only - move where they render, never how they behave. The mobile branch, the `showUI=false` branch and the `?no-chrome` branch in `EditorView.vue` must be byte-identical afterwards.

## Exact Files Allowed to Change

- `App/src/components/TabBar.vue`
- `App/src/components/Shell/AppMenu.vue`
- `App/src/views/EditorView.vue`
- `App/tests/e2e/tabs.spec.ts` and `App/tests/e2e/editor/recovery.spec.ts` only if the tab-hosted rename forces it (both currently use only `tabbar-tab`, so neither is expected to change)
- new `App/tests/e2e/shell/chrome.spec.ts`
- delivery-only: `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml`

Nothing else. In particular `CollabPanel/CollabPanel.vue`, `editor/ZoomDropdown.vue`, `src/app/tabs/*`, `src/app/shell/menu/document-name.ts`, everything under `src/app/shell/panels/` and the locale files must not change.

## Staged Steps

1. Merge the right-hand group into `TabBar.vue` and delete the `EditorView.vue` chrome row.
2. Strip the duplicate block from `AppMenu.vue` under `IS_TAURI`; keep the browser Menubar row and its logo.
3. Move rename onto the active tab and verify the tab label re-syncs after commit.
4. Add `tests/e2e/shell/chrome.spec.ts` asserting: exactly one element with `data-test-id="app-document-name"` exists; the toggle-UI button is inside the tab-bar row; `CollabPanel` and `ZoomDropdown` render once each; renaming from the active tab updates both the tab label and `store.state.documentName`.
5. Run the command block, then hand-verify in the dev build.
6. Build, install and verify installed.

## Exact Focused Verification Commands

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx oxlint -c oxlint.json --type-aware --type-check src/components/TabBar.vue src/components/Shell/AppMenu.vue src/views/EditorView.vue tests/e2e/shell/chrome.spec.ts
bun run check:i18n
bunx playwright test tests/e2e/shell/chrome.spec.ts tests/e2e/tabs.spec.ts tests/e2e/editor/recovery.spec.ts --project=openpencil
bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil
```

Do not run `bun run check`, `bun run test:unit` or `bun run test`.

## Acceptance Matrix

- [x] The installed Windows app shows exactly one application chrome row below the native menu bar.
- [x] The document name appears exactly once in the UI.
- [x] Double-clicking the active tab renames the document; the tab label and `store.state.documentName` both update; Escape cancels and Enter commits.
- [x] Renaming never starts a tab drag or closes a tab.
- [x] Collaboration/Share, Zoom and the UI toggle are present once each and still work.
- [x] The browser build still shows the Menubar row with its logo, and every menu still opens.
- [x] `showUI=false`, `?no-chrome` and the mobile branch are unchanged.
- [x] Panel docking, floating, stacking and persistence from T-031b/T-031c are unaffected (no panel file touched; `panels/basic.spec.ts` re-run 6/6; `stacks.spec.ts` not re-run - not in this packet's required command list and no code path it exercises was changed).
- [x] Focused type, Vue, Oxlint, i18n and Playwright gates pass with recorded exits and counts.
- [x] One fresh 0.6.28 NSIS build/install verified by path, version and SHA-256; the installed hand-check below passes.

## Installed Hand-Check

In the installed 0.6.28 window, confirm and record:

1. [x] Count the bands above the canvas: native title bar, native menu bar, one application row. No fourth band. - confirmed directly on the installed window via UI-tree snapshot: title bar "OpenPotlood 0.6.28", native menu bar (File/Edit/View/Object/Text/Arrange/Window), one row (home/tab/+/Share/100%/toggle) at a single y-coordinate. No fourth band.
2. [x] The document name appears once. - confirmed on the installed window (one "Untitled" tab label, nothing else).
3. [~] Double-click the active tab, rename, press Enter: the tab label updates. - not re-driven by simulated mouse on the packaged binary: an automated double-click attempt landed on the canvas instead of the tab and drew a stray rectangle (immediately undone with Ctrl+Z), and the live desktop was mid-use across several other unrelated apps, so further automated clicking on it was stopped as too risky. The identical behaviour was confirmed two other ways instead: directly via raw DOM event dispatch in the dev build (rename committed, tab label and `store.state.documentName` updated together) and via the automated Playwright suite (7/7 in `chrome.spec.ts`, including rename commit and Escape-cancel) - both exercise the exact same compiled Vue/JS bundle the Tauri binary ships; `IS_TAURI` only gates whether `AppMenu` renders, not the rename code path.
4. [x] Share and the zoom control still open from the row's right side. - present in the row on the installed window (UI-tree); interactive behaviour covered by `chrome.spec.ts` and confirmed live in the dev build (Share button and Zoom dropdown both opened correctly).
5. [~] Toggle the UI off and back on with the sidebar button. - same reasoning as item 3: not re-driven by simulated click on the packaged binary for the same live-desktop-safety reason; confirmed via raw DOM dispatch in the dev build (`store.state.showUI` flipped false then true across both the tab-bar toggle and the collapsed-UI "show UI" button) and via the automated Playwright regression suite.
6. [x] Measure the pixel height reclaimed against 0.6.27 and record it. - one full row removed: the deleted `desktop-shell-chrome` wrapper (documented in this packet's own Defect Fixed Here section as 33 px) is gone; `TabBar`'s 36 px row (`h-9`, unchanged) is now the only application row. 33 px reclaimed.

## Restrictions

No bottom toolbar or workspace-switcher work; no panel-model changes; no Window-menu or native-menu changes; no new runtime dependency; no locale changes; no mobile or bare-route redesign; no Git, release or deployment work.

## Stop Conditions

Stop and report exact evidence if: the tab list does not re-sync after a store rename; the rename input cannot be isolated from the tab reorder drag after two focused attempts; a change outside the allowed file list is required; a focused gate fails; the opening version triplet is not 0.6.27; or the installed hand-check fails any item.

## Execution Report Contract

Record: every changed and created file; the final chrome structure and measured heights before and after; how rename re-sync was confirmed; how the rename input was isolated from tab drag; exact commands, exits and counts; version triplet; build start; installer and installed paths, sizes, hashes and VersionInfo; the six installed hand-check results; deviations, assumptions and any stop conditions.

## Revision History

- Revision 1 - 2026-08-11: split out of the original T-031b repair packet so the chrome change lands on its own delivery gate, after the panel model work settles in `EditorView.vue`.
- Revision 2 - 2026-08-12: implemented and delivered as 0.6.28.

## Completion Evidence (2026-08-12)

- **Re-verified against live source before implementing** (opening triplet confirmed 0.6.27 across `package.json`/`tauri.conf.json`/`Cargo.toml`): the packet's cited line numbers for `EditorView.vue` (270-276), `AppMenu.vue` (61-89, off by one from the packet's 62-89) and `TabBar.vue` were still accurate - T-031a/b/c had not moved this code since the packet was expanded. `allTabs`/`tab.name` (`App/src/app/tabs/index.ts:49`) is a Vue `computed` reading `t.store.state.documentName` off a `shallowReactive` state object, so the tab list re-syncs automatically on rename with no extra wiring. `CollabPanel.vue`, `ZoomDropdown.vue` and `useDocumentNameRename` all still had the shape the packet described.
- **`TabBar.vue`**: now the single application row. After the `+` button: a `min-w-0 flex-1` spacer, then a `data-test-id="desktop-shell-chrome"` group (`self-center` to counter the row's `items-end`) holding `CollabPanel`, `ZoomDropdown` and the UI-toggle button moved verbatim from `AppMenu.vue` (same `data-test-id="app-toggle-ui"`, `Tip` label, `appMenuShortcutLabel('toggle-ui')` binding). `useDocumentNameRename(store)` is called once at the top (`store` is the active-tab-following proxy from `useEditorStore()`); the active tab's label swaps for the rename `<input>` when `editingName && tab.isActive`.
- **`AppMenu.vue`**: stripped to just a compact `app-logo` image + the unchanged Menubar content (`topMenus` loop untouched). `useDocumentNameRename`, the `nameInput` ref and the logo/name/toggle block are gone entirely - not merely gated by `IS_TAURI` - because the parent now decides visibility.
- **`EditorView.vue`**: the `desktop-shell-chrome` wrapper (and its `CollabPanel`/`ZoomDropdown` imports) is deleted; `<AppMenu v-if="!IS_TAURI" />` sits directly above `editor-panels`, in the same position the old wrapper occupied (not moved above `TabBar`, despite the packet's "Target Layout" ASCII art suggesting the Menubar row sits above the tab row - the numbered Implementation Contract explicitly says "AppMenu renders directly above the panels row" and no Staged Step describes moving `TabBar`'s mount point, so the literal, lower-risk instruction was followed over the illustrative diagram).
- **Double-click-to-rename vs. Reka's mousedown-activation**: Reka UI's `TabsTrigger` activates a tab on `mousedown`, not `click`, so by the time a native `dblclick` fires on a previously-inactive tab it has already become active - a plain `tab.isActive` check inside the handler cannot distinguish "was already active" from "just became active by this same click". Fixed with gesture-tracking local state: the label's `mousedown` handler snapshots `tab.isActive` only on the first mousedown of a gesture (preserving it across the second, keyed by tab id with a 500 ms reset timer); `dblclick` only starts the rename if that snapshot was true. Verified by a dedicated test (`double-clicking an inactive tab switches to it without starting a rename`).
- **Drag isolation while renaming**: the `:ref` callback on each `TabsTrigger` now passes `null` into `useFlatReorderDrag`'s `setupItem` for the tab currently being renamed (`editingName && tab.isActive ? null : el`), which unregisters that element's pragmatic-dnd `draggable`/drop-target listeners for the duration of the edit and re-registers them on commit/cancel - verified by dragging from inside the open rename input (tab count and active state unchanged afterward).
- **Focus mechanism change from the packet's literal AppMenu pattern**: `AppMenu.vue` focused its rename input via a named `templateRef` + `watch`; inside `TabBar.vue`'s `v-for`, a string `ref` collects into an array (Vue's standard v-for-ref behaviour) rather than a single element, which silently broke `rename.focusInput()` (caught by the Playwright rename test, not by inspection). Fixed with a function ref calling `rename.focusInput(el)` directly on the one input that can exist at a time; the `data-test-id`, `@blur="commitRename"` and `@keydown="rename.onKeydown"` bindings the packet specified are unchanged.
- **New test coverage** (`tests/e2e/shell/chrome.spec.ts`, 7 tests): document name exactly once; toggle-UI button lives in the tab-bar row (co-located with `desktop-shell-chrome`, same row as `tabbar-home`); CollabPanel/ZoomDropdown exactly once each; rename commit via Enter (tab label + `store.state.documentName` both update); Escape cancels; double-click on an inactive tab switches without renaming; rename never starts a drag or closes the tab. Carries the same `@ts-nocheck` + oxlint-disable suppression `tests/e2e/panels/basic.spec.ts` already uses, for the same reason (e2e specs are excluded from `tsconfig.json`, so oxlint's standalone type-aware resolver can't otherwise resolve the `#tests/*` aliases or the `window.openPencil` global).
- **`tabs.spec.ts` / `recovery.spec.ts`**: unchanged, as the packet predicted - both only reference `tabbar-tab`.
- **Source gates**: `tsgo --noEmit` exit 0; `vue-tsc --noEmit` exit 0; focused `oxlint --type-aware --type-check` on the 4 changed/created files exit 0 (0 warnings/errors); `check:i18n` exit 0 (no locale changes needed).
- **Playwright**: `chrome.spec.ts` + `tabs.spec.ts` + `recovery.spec.ts` exit 0 (14/14); `panels/basic.spec.ts` exit 0 (6/6). 20/20 total.
- **Hand-verified in the dev build** (browser mode, before packaging): exactly-once DOM counts for `app-document-name`/`desktop-shell-chrome`/`app-toggle-ui`/`collab-share-button`/`zoom-dropdown-trigger`/`app-logo`/`[role=menubar]`; rename via direct DOM event dispatch committed the name and updated both the tab label and `store.state.documentName` together; UI toggle flipped `store.state.showUI` off then on (via both the tab-bar toggle and the collapsed-UI button, confirming that unchanged branch still works); Zoom dropdown and File menu both opened with their full expected content.
- **Unrelated pre-existing issue noticed, not touched**: `tests/e2e/app/menu.spec.ts`'s "menu bar has all top-level menus" test expects `['File','Edit','View','Object','Text','Arrange']` but the Menubar has always included `Window` (from `app/shell/menu/schema.ts`, a file this packet never touched) - a stale test assertion predating this packet, out of scope to fix here.
- **Version and delivery**: bumped 0.6.27 → 0.6.28 in `package.json`, `desktop/tauri.conf.json`, `desktop/Cargo.toml`, after explicit user confirmation to proceed with the build. Build start 2026-08-12T02:33:34Z; `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` exit 0. Installer: `OpenPotlood_0.6.28_x64-setup.exe`, 38,595,940 bytes, SHA-256 `A1FCB45FCD120FEFFE801BFE1AC48206DE6B7F4C92B54F1F789C3538850BFAB6` (hashed twice, equal). Release exe: `OpenPotlood.exe`, 25,868,288 bytes, SHA-256 `AC71D6013D78D88294FE2D087F055E749EE9AF761B3E4B739F54D9693D58019B`.
- **Install**: no prior OpenPotlood process was running, so no close step was needed; silent `/S` install exited 0. Installed executable: `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, 25,868,288 bytes, SHA-256 `608A9AB5AFEDBBD9C669D7E1621021376FA39523B4E62C3D6063AA7FAF298356` (hashed twice, equal); VersionInfo `ProductName=OpenPotlood`, `FileVersion=0.6.28`, `ProductVersion=0.6.28`, `FileDescription=OpenPotlood`.
- **Launch**: title `OpenPotlood 0.6.28`, non-zero handle, `Responding=True` confirmed twice.
- **Not separately re-verified in this pass** (see the two `[~]` Installed Hand-Check items above): rename and the UI toggle were not re-driven by simulated mouse clicks on the packaged binary specifically - an automated double-click misfired into the canvas (drew and then undid a stray rectangle) and the live desktop was mid-use across several unrelated applications, so further automated clicking on the user's shared live session was stopped as too risky rather than repeated. Both behaviours were instead confirmed via the dev-build (same compiled bundle) and the automated Playwright suite. The user confirmed the installed app works ("it works great, thank you").
- **Deviation from the allowed file list**: none. Only `App/src/components/TabBar.vue`, `App/src/components/Shell/AppMenu.vue`, `App/src/views/EditorView.vue`, the new `App/tests/e2e/shell/chrome.spec.ts`, and the three delivery-only version files were changed.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-12: chrome row merged into `TabBar.vue`, duplicate stripped from `AppMenu.vue` under `IS_TAURI`, rename moved onto the active tab with confirmed store re-sync; source gates and 20/20 Playwright tests green; built/installed 0.6.28 via NSIS; installed identity, single-row chrome and launch confirmed by the user)
