# T-005 — Deliver light, grey, dark, and midnight themes

Task ID: T-005
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-004
Prepared against: Live `App/` source on 2026-07-19; T-001 through T-004 execution evidence and the live theme seams were rechecked during audit
Last expanded: 2026-07-17; promoted to READY on 2026-07-19

Closure: User confirmed on 2026-07-19 that the installed theme workflow works, including the native top window bar. T-005 is complete and must not be reopened unless new evidence identifies a regression.

## Request Coverage

- Provide full Light, Grey, Dark, and Midnight UI themes: map the four explicit choices through the theme type, persistent setting, browser and native View menus, semantic CSS tokens, canvas/ruler colours, automated checks, and installed Windows application.
- Persist and render the choice consistently: retain one stored setting across reload and installed-app restart; apply the matching root attributes, browser colour scheme, semantic token set, and CanvasKit ruler theme.
- Preserve existing behaviour: retain `Auto` as an additional backwards-compatible setting that resolves only to Light or Dark from the operating-system preference; do not remove or rename Light, Dark, or Auto.
- Preserve design-file behaviour: this task changes application chrome only. It must not mutate scene nodes, document colours, `.fig`/`.pen` data, exports, or round-trip behaviour.
- Preserve the private local Windows route: no Git, branches, worktrees, releases, updater work, publishing, deployment, signing, or copied-resource execution.
- Deliver a completed local update: after focused checks pass, synchronise the next approved app version and complete the build, NSIS install, launch, identity/version/hash, theme-restart, and responsive-process checks established by T-002.

## User-Visible Outcome

In installed OpenPotlood, View > Theme offers Light, Grey, Dark, Midnight, and the preserved Auto option. Each explicit theme immediately recolours the whole editor chrome—including panels, menus, dialogs, inputs, tabs, toolbar, canvas-adjacent UI, checkerboards, code colours, warnings, and CanvasKit rulers—without recolouring document artwork. The explicit choice remains selected after an application restart and when creating or switching tabs.

## Verified Starting State

### Verified facts

- `App/src/app/shell/theme.ts` currently defines `AppTheme = 'dark' | 'light' | 'auto'`, persists it with VueUse `useLocalStorage` under `open-pencil:theme`, defaults to Dark, resolves Auto with `usePreferredDark()`, writes `data-theme` and `data-theme-setting`, sets the root `colorScheme`, and copies four ruler CSS variables into the active editor store.
- `App/src/app.css` owns the semantic UI palette. Dark values are registered as the `@theme` defaults and `html[data-theme='light']` overrides the complete token set. Components predominantly consume semantic Tailwind utilities such as `bg-panel`, `bg-canvas`, `bg-input`, `text-surface`, `text-muted`, `border-border`, and `hover:bg-hover`.
- The complete current semantic colour contract is: `panel`, `panel-secondary`, `panel-field`, `panel-field-hover`, `panel-focus`, `panel-selected`, `panel-selected-muted`, `canvas`, `border`, `hover`, `accent`, `surface`, `muted`, `input`, `component`, four warning tokens, three success tokens, five code tokens, two checkerboard tokens, and four ruler tokens.
- `App/src/app/shell/menu/schema.ts` is the shared source for the browser and native menu. It currently exposes Light, Dark, and Auto IDs. `App/src/app/shell/menu/editor-actions.ts`, `App/src/app/shell/menu/app-menu.ts`, and `App/src/app/shell/menu/use.ts` route those IDs to `setTheme()`.
- `App/tools/tauri-menu/src/generate.ts` generates `App/desktop/generated/menu.json` from the shared schema. `App/desktop/src/menu.rs` installs that generated native menu. Native menu IDs are forwarded as `menu-event` payloads and handled by `App/src/app/shell/menu/use.ts`.
- Browser menu labels and checked state are mapped in `App/src/app/shell/menu/app-menu.ts`; English defaults are in `App/packages/vue/src/i18n/messages/menu.ts`; eight locale JSON files under `App/packages/vue/src/i18n/locales/*/menu.json` mirror the current three theme-label keys.
- `App/src/components/Shell/AppMenu.vue` renders browser menu checkboxes from the shared menu entries and hides the browser menu in Tauri, so installed-app reachability depends on the generated native menu.
- `App/src/app/tabs/index.ts` centralises tab activation through `activateTab()` and `setActiveEditorStore()`. The current theme module refreshes ruler colours only when the theme watcher runs; it does not observe later active-store changes. A newly created or reactivated tab can therefore carry a missing or stale `state.rulerTheme` until another theme change.
- `App/packages/core/src/canvas/renderer/pipeline.ts` copies `state.rulerTheme` into the renderer and `App/packages/core/src/canvas/rulers.ts` uses its `background`, `tick`, `text`, and `label` colours for CanvasKit painting.
- `App/tests/engine/app/shell/menu/schema.test.ts` is the focused shared-menu unit-test seam. There is no focused `theme.ts` or four-theme E2E test in the live tree.
- `App/playwright.config.ts` runs E2E against `http://localhost:1420`, uses `data-test-id`, fixes the viewport at 1280x800, and defaults the browser context to a dark OS colour scheme. `App/tests/e2e/fixtures.ts` and `App/tests/helpers/canvas.ts` provide the established editor initialisation and error-check patterns.
- `App/AGENTS.md` requires `CHANGELOG.md` for user-visible changes, public package boundaries, focused tests, and `bun run check` before completion.
- Current app identity is still upstream OpenPencil `0.13.2`. T-002 owns the OpenPotlood `0.1.0` baseline and installed-loop evidence; T-003 and T-004 may advance that version before this packet executes.
- This envelope intentionally has no Git repository. `git status` returns “not a git repository”; pipeline receipts and hashes replace Git evidence.
- Official VueUse documentation confirms `useLocalStorage` is reactive LocalStorage and uses the serializer inferred from the default value. The existing string default therefore preserves plain string values: https://vueuse.org/core/uselocalstorage/ and https://vueuse.org/core/usestorage/
- MDN confirms `HTMLElement.dataset.themeSetting` maps to `data-theme-setting`, and `color-scheme` controls browser-provided controls and scrollbars. Only Light may advertise `light`; Grey, Dark, and Midnight must advertise `dark`: https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset and https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme
- WCAG 2.2 requires at least 4.5:1 contrast for normal text and 3:1 for large text. Use 4.5:1 for the editor's small text and 3:1 for essential control boundaries/icons: https://www.w3.org/TR/WCAG22/#contrast-minimum and https://www.w3.org/WAI/WCAG22/Techniques/general/G209
- Tauri's official Windows documentation confirms that `tauri build` creates Windows installers, NSIS produces `-setup.exe`, and the generated NSIS installer accepts uppercase `/S` for silent installation: https://v2.tauri.App/reference/cli/ and https://v2.tauri.App/distribute/windows-installer/

### Assumptions to recheck before READY

- T-001 through T-004 do not replace the theme owner, semantic token names, shared menu schema, active-store seam, test runner, or Tauri/NSIS build route described above.
- T-002's prepared contract establishes an x64 MSVC NSIS build, expected installed executable `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, exact-path launch, Windows `VersionInfo`, SHA-256, title, handle, and repeated responsiveness checks. Recheck its executed evidence before use.
- T-004 is `VERIFIED` and its installed version is the version immediately preceding T-005.

### Decisions fixed by this packet

- The four explicit values and labels are `light`/Light, `grey`/Grey, `dark`/Dark, and `midnight`/Midnight. Use South African/British spelling `grey` in types, IDs, attributes, tests, and English UI.
- Keep `auto`/Auto as a fifth setting for compatibility. Auto continues to resolve only to Light or Dark; it does not select Grey or Midnight.
- Keep Dark as the default for a missing or invalid stored setting. Do not change the persistence key during this task; if T-002 has already renamed it, preserve T-002's verified key and add no second key.
- Keep the current Light and Dark palette values except for three verified small-text contrast corrections: Light `muted` becomes `#676e79`; Dark `muted` becomes `#929292`; Dark `panel-selected` becomes `#0d5fcc`. Do not add per-component overrides.
- Grey is a neutral medium-grey workspace with light text. Midnight is a blue-black workspace with cool slate text. Both use browser `color-scheme: dark`.
- Do not create an in-canvas theme selector or recolour user artwork. View > Theme remains the single selection surface.
- User correction on 2026-07-19 requires the native Windows title bar to follow the selected theme. Map Light to Tauri native Light and Grey/Dark/Midnight to native Dark; grant only Tauri's dedicated app-theme capability.

### Decisions still required

- NONE. If a predecessor deliberately changes any fixed decision or interface above, stop for packet audit instead of improvising.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-004-corner-radius-node-controls.md`
- `Plan/Packets/T-002-openpotlood-windows-identity-and-baseline.md`
- `Plan/Packets/T-003-drag-and-drop-image-support.md`
- The verified T-001 through T-004 packet execution reports and `Toolbox/Project-History/PROJECT_LOG.md`
- `App/AGENTS.md`
- `App/src/app/shell/theme.ts`
- `App/desktop/capabilities/default.json` only for `core:app:allow-set-app-theme`, required by the user-requested native title-bar correction
- `App/src/app.css`
- `App/src/app/editor/active-store/index.ts`
- `App/src/app/tabs/index.ts`
- `App/src/app/shell/menu/schema.ts`
- `App/src/app/shell/menu/editor-actions.ts`
- `App/src/app/shell/menu/app-menu.ts`
- `App/src/app/shell/menu/use.ts`
- `App/src/components/Shell/AppMenu.vue`
- `App/tools/tauri-menu/src/generate.ts`
- `App/desktop/src/menu.rs`
- `App/desktop/generated/menu.json`
- `App/packages/vue/src/i18n/messages/menu.ts`
- `App/packages/vue/src/i18n/locales/*/menu.json`
- `App/packages/core/src/canvas/renderer/pipeline.ts`
- `App/packages/core/src/canvas/rulers.ts`
- `App/tests/engine/app/shell/menu/schema.test.ts`
- `App/playwright.config.ts`
- `App/tests/e2e/fixtures.ts`
- `App/tests/helpers/canvas.ts`
- `App/package.json`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`
- `App/CHANGELOG.md`

## Allowed Changes

- `App/src/app/shell/theme.ts`
- `App/src/app/editor/active-store/index.ts` only if needed to expose a read-only active-store ref for theme/ruler synchronisation
- `App/src/app/tabs/index.ts` only if the existing active-store interface cannot provide reliable new-tab and switched-tab ruler synchronisation
- `App/src/app.css`
- `App/src/app/shell/menu/schema.ts`
- `App/src/app/shell/menu/editor-actions.ts`
- `App/src/app/shell/menu/app-menu.ts`
- `App/src/app/shell/menu/use.ts` only for the new shared theme IDs/types
- `App/desktop/generated/menu.json`, regenerated only through `bun run generate:tauri-menu`
- `App/packages/vue/src/i18n/messages/menu.ts`
- Existing `App/packages/vue/src/i18n/locales/*/menu.json` files for the two new mirrored keys; translate Grey and Midnight consistently with each locale's current simple menu vocabulary and stop if the i18n checker rejects a locale.
- `App/tests/engine/app/shell/theme.test.ts` (new)
- `App/tests/engine/app/shell/menu/schema.test.ts`
- `App/tests/e2e/ui/themes.spec.ts` (new)
- New Playwright screenshot baselines created only by `App/tests/e2e/ui/themes.spec.ts` under its normal `*-snapshots/` folder.
- `App/CHANGELOG.md` under `Unreleased`.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` only for the synchronised final local app version after focused implementation checks pass.
- The T-005 execution report and normal pipeline evidence fields.

## Restrictions and Exclusions

- Do not edit any file under `Toolbox/`, copy previous-project code, or treat previous completion claims as evidence.
- Do not change project goal, route, task order, T-005 dependency, or unrelated packet state.
- Do not initialise Git or use branches, worktrees, commits, tags, pull requests, publishing, deployment, updater signing, or release workflows.
- Do not change updater endpoints/settings, `createUpdaterArtifacts`, package-publishing versions, publishable workspace packages, or public deployment files.
- Do not add a theme framework, state library, colour library, or runtime dependency. Use the existing VueUse, semantic CSS variables, Tailwind tokens, shared menu schema, and CanvasKit ruler bridge.
- Do not remove Auto or change its existing Light/Dark operating-system resolution.
- Do not rename existing semantic token utilities or scatter literal theme colours through Vue components. Theme differences belong in `app.css` semantic tokens.
- Do not recolour document/page content, scene-graph values, selection data, exports, images, colour-picker gradients, or deliberately literal white slider thumbs.
- Do not edit `App/desktop/src/menu.rs` merely to add native checkmarks. The current native menu does not consume the generated `checkbox` field; selectable native entries are sufficient for this packet. Report that existing limitation rather than widening scope.
- Do not claim contrast from appearance. Measure required semantic foreground/background pairs with the focused test and inspect the rendered UI.
- Do not increment the app version before focused code, i18n, menu-generation, theme, and E2E checks pass. Do not claim or retain a completed version if build/install/launch verification fails.
- Do not mass-format the repository. Format only changed application/test files with the repository formatter or run the smallest supported format command that does not depend on Git.

## Implementation Steps

1. Recheck the three assumptions above against the verified T-001 through T-004 evidence and the current live paths. Confirm T-004 is `VERIFIED`, T-005 is `READY`, no other task is `IN PROGRESS`, and the three shipped app-version files agree. Stop on any mismatch before editing.
2. Record starting SHA-256 hashes for every allowed existing file that will be changed and record the predecessor app version. Because there is no Git, these hashes are the rollback/diff receipt.
3. In `App/src/app/shell/theme.ts`, replace repeated literal unions with exported theme contracts: an explicit-settings list `['light', 'grey', 'dark', 'midnight']`, `AppTheme` as those four plus `auto`, and a resolved type containing only the four explicit values. Keep the currently verified storage key and Dark default.
4. Add a pure normalisation/resolution boundary in `theme.ts`: accept only the five known stored settings; map a missing/unknown value to Dark; resolve Auto to Light when the OS preference is light and Dark when it is dark; return Grey and Midnight unchanged. Make the pure functions exportable for the focused unit test.
5. Update `applyTheme()` so `document.documentElement.dataset.theme` receives the resolved explicit value; `dataset.themeSetting` receives the stored setting including Auto; and `style.colorScheme` is `light` only for resolved Light and `dark` for Grey, Dark, and Midnight. Keep SSR/browser guards.
6. Make ruler synchronisation respond to both theme changes and active-editor changes. Follow the existing active-store boundary: expose only a read-only ref from `App/src/app/editor/active-store/index.ts` and watch it in the theme module, or call one exported theme-to-store synchroniser from the central `activateTab()` path. Do not expose mutable store state or introduce a second tab activation route.
7. On every explicit theme change, initial editor creation, new tab, and tab switch, read `--color-ruler-bg`, `--color-ruler-tick`, `--color-ruler-text`, and `--color-ruler-label` from the root, parse them with the existing `parseColor()`, write the active store's `state.rulerTheme`, and call `requestRepaint()`. Expected result: the active store values match computed CSS without requiring a second theme selection.
8. Preserve `toggleTheme()` as a Light/Dark convenience toggle: any currently resolved Light setting toggles to Dark; Grey, Dark, Midnight, and dark-resolved Auto toggle to Light. This avoids inventing a five-state keyboard cycle.
9. In `App/src/app.css`, keep the semantic token names and existing Light/Dark blocks, applying only the three exact contrast corrections fixed above. Add complete `html[data-theme='grey']` and `html[data-theme='midnight']` blocks—no partial inheritance whose meaning depends on current base ordering.
10. Use this exact Grey palette: panel `#4b4b4f`; panel-secondary `#434347`; panel-field `#5a5a60`; panel-field-hover `#64646b`; panel-focus `#7aa2ff`; panel-selected `#315f9f`; panel-selected-muted `#5a6270`; canvas `#38383c`; border `#68686f`; hover `#5a5a60`; accent `#60a5fa`; surface `#f4f4f5`; muted `#d4d4d8`; input `#3f3f44`; component `#c084fc`; warning-bg `rgb(245 158 11 / 0.12)`; warning-border `rgb(245 158 11 / 0.35)`; warning-text `#fde68a`; warning-action `#fcd34d`; success `#4ade80`; success-bg `#16a34a`; success-bg-hover `#15803d`; code-tag `#7dd3fc`; code-attribute `#ddd6fe`; code-string `#86efac`; code-number `#fca5a5`; code-punctuation `#d4d4d8`; checkerboard `#505056`; checkerboard-muted `#606066`; ruler-bg `rgb(67, 67, 71)`; ruler-tick `rgb(161, 161, 170)`; ruler-text `rgb(212, 212, 216)`; ruler-label `rgb(255, 255, 255)`.
11. Use this exact Midnight palette: panel `#111827`; panel-secondary `#0f172a`; panel-field `#1e293b`; panel-field-hover `#273449`; panel-focus `#60a5fa`; panel-selected `#1d4ed8`; panel-selected-muted `#24324a`; canvas `#020617`; border `#334155`; hover `#1e293b`; accent `#60a5fa`; surface `#e5e7eb`; muted `#94a3b8`; input `#0b1220`; component `#a78bfa`; warning-bg `rgb(245 158 11 / 0.1)`; warning-border `rgb(245 158 11 / 0.3)`; warning-text `#fde68a`; warning-action `#fcd34d`; success `#4ade80`; success-bg `#16a34a`; success-bg-hover `#15803d`; code-tag `#7dd3fc`; code-attribute `#c4b5fd`; code-string `#86efac`; code-number `#fca5a5`; code-punctuation `#94a3b8`; checkerboard `#1e293b`; checkerboard-muted `#334155`; ruler-bg `rgb(15, 23, 42)`; ruler-tick `rgb(71, 85, 105)`; ruler-text `rgb(148, 163, 184)`; ruler-label `rgb(255, 255, 255)`.
12. In `App/src/app/shell/menu/schema.ts`, add checkbox entries `theme-grey`/Grey and `theme-midnight`/Midnight. Keep deterministic order Light, Grey, Dark, Midnight, Auto. Do not change the View-menu nesting.
13. In `App/src/app/shell/menu/editor-actions.ts`, consume the shared `AppTheme` type instead of a second literal union; add `theme-grey` and `theme-midnight` actions. Update `App/src/app/shell/menu/app-menu.ts` mappings, checked-state cases, and checked-change cases for both IDs. `App/src/app/shell/menu/use.ts` should continue to receive the expanded shared actions without a separate handler.
14. Add English keys `themeGrey: 'Grey'` and `themeMidnight: 'Midnight'` to `App/packages/vue/src/i18n/messages/menu.ts`, mirror both keys in each existing locale menu JSON, and map both menu IDs in `app-menu.ts`. Do not create new locale files or touch unrelated translations.
15. Run `bun run generate:tauri-menu` from `App/`. Confirm `App/desktop/generated/menu.json` contains all five entries in the required order and no hand-edited differences. Expected native IDs are `theme-light`, `theme-grey`, `theme-dark`, `theme-midnight`, and `theme-auto`.
16. Create `App/tests/engine/app/shell/theme.test.ts` using `bun:test`. Test the exported setting list, acceptance/rejection of stored strings, Dark fallback, Auto resolution for both OS preferences, explicit Grey/Midnight resolution, and browser colour-scheme mapping.
17. Extend `App/tests/engine/app/shell/menu/schema.test.ts` to locate View > Theme and assert the exact five IDs, labels, checkbox flags, and order. Retain the existing duplicate-shortcut test.
18. In the theme unit test or a focused adjacent test, read the semantic palette contract and calculate WCAG contrast with the W3C relative-luminance formula. At minimum assert `surface` and `muted` against `panel`, `surface` against `input`, warning text against the visible warning background/composited panel, and selected text against `panel-selected` for all four themes. Require 4.5:1 for normal text. Assert essential border/focus/icon pairs used to communicate state meet 3:1 or also have a non-colour cue. The three fixed Light/Dark corrections above are the authorised changes; if another existing pair fails, stop for packet audit rather than selecting another colour.
19. Create `App/tests/e2e/ui/themes.spec.ts` with an isolated browser page/context. Clear the verified theme key before the first load. For each explicit theme, select it through View > Theme, then assert root `data-theme`, `data-theme-setting`, root `style.colorScheme`, persisted LocalStorage value, representative computed values for panel/canvas/surface/ruler variables, visible editor root, and no page/console errors.
20. In that E2E file, reload after selecting Grey and Midnight and assert the same setting and computed tokens remain. Create a second tab and switch back; inspect `window.openPencil.getStore().state.rulerTheme` after each activation and assert its four parsed colours match the root ruler CSS variables. Do not compare floating-point colours as raw CSS strings; compare normalised numeric RGBA values with a small tolerance.
21. Add one 1280x800 screenshot assertion for each explicit theme after CanvasKit initialisation. Keep document content identical across the four captures. The snapshots must visibly include left panel, canvas/rulers, toolbar, right panel, top tabs/menu, and at least one open menu or dialog across the set; use existing screenshot naming conventions.
22. Confirm theme changes do not alter document state: capture a compact scene-graph/document snapshot before cycling themes and compare it after all four choices. A theme switch must not create undo entries or change node/page colour data.
23. Add one concise `Unreleased > Changed` entry to `App/CHANGELOG.md`: OpenPotlood now offers persistent Light, Grey, Dark, and Midnight editor themes. Do not rewrite historical release notes or public deployment copy.
24. Run the focused verification commands below. Fix only T-005 failures. If a broad check exposes an unrelated failure, record it and stop rather than refactoring adjacent systems.
25. After all focused checks and `bun run check` pass, calculate the next minor version from the verified predecessor installed version (increment minor and set patch to zero), then synchronise exactly `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml`. Do not change workspace package versions. Re-read all three and require equality before building.
26. Run the Tauri x64 MSVC NSIS build and local installed-app loop below. Record build executable and installer SHA-256, silently install the single generated installer, require `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe` unless T-002 execution proved a different generated path, record its SHA-256 and Windows `VersionInfo`, and reuse every exact-path/title/handle/responsiveness invariant from T-002.
27. Launch installed OpenPotlood. Through its native View > Theme menu, select Light, Grey, Dark, and Midnight in turn and inspect editor chrome, panels, tabs, toolbar, menus/dialogs, canvas-adjacent UI, checkerboard-bearing colour UI, and rulers. Select Midnight last, close the app cleanly, relaunch, and require Midnight to remain active before repeating the restart check with Grey.
28. Confirm the installed process name/path/product identity/version match T-002, the window title is OpenPotlood, the process remains responsive for at least the T-002 observation interval, and the application creates/opens a design without document colour changes. Stop on any mismatch.
29. Append the execution report with changed-file hashes, commands and exit codes, palette/contrast results, screenshot names, version triplet, build/installer/installed hashes, install path, launch/restart evidence, process responsiveness, deviations, and any mess or concerns. Do not mark DONE; the audit role independently verifies and advances the packet.

## Acceptance Criteria

- [ ] The shared setting contract contains exactly Light, Grey, Dark, Midnight, and preserved Auto; invalid stored values safely fall back to Dark.
- [ ] View > Theme exposes the exact order Light, Grey, Dark, Midnight, Auto in both browser schema and generated native menu, and each ID reaches the shared setter.
- [ ] All existing locale menu dictionaries contain the two new keys and `bun run check:i18n` passes.
- [ ] Each explicit choice writes matching `data-theme` and LocalStorage values; `data-theme-setting` records Auto when Auto is selected; Auto continues to resolve only to Light/Dark.
- [ ] Root `colorScheme` is Light for Light and Dark for Grey, Dark, and Midnight.
- [ ] Grey and Midnight define the complete existing semantic colour contract in `app.css`; components need no theme-specific literal override.
- [ ] Normal text pairs covered by the focused matrix meet at least 4.5:1, and essential state boundaries/icons meet 3:1 or have a verified non-colour cue.
- [ ] Panels, tabs, toolbar, menus, dialogs, fields, warnings, code colours, checkerboards, canvas-adjacent chrome, and rulers are visually coherent in all four screenshot baselines with no unreadable or unthemed island.
- [ ] Theme switching, reload, new-tab creation, and tab switching update the active store's ruler theme and repaint without requiring a second theme change.
- [ ] The selected explicit theme survives browser reload and installed-app restart; Midnight and Grey are each restart-proven.
- [ ] Cycling themes does not change scene nodes, page/document colours, undo state, saved design data, or export semantics.
- [ ] Focused unit/E2E checks, menu generation, i18n check, `bun run check`, and production Tauri NSIS build all exit 0.
- [ ] The completed update uses the next minor version after T-004 and the same version appears in the root package, Tauri config, Cargo manifest, built/installed app evidence, and window/application identity checks.
- [ ] The single generated NSIS installer is installed locally; the exact installed executable is launched, identified, hash/version checked through T-002's established method, responsive, and visibly branded OpenPotlood.
- [ ] No Git/release/updater/publishing/deployment/resource state changes and no application files outside Allowed Changes.

## Verification

- From `App/`, run `bun test ./tests/engine/app/shell/theme.test.ts ./tests/engine/app/shell/menu/schema.test.ts`; expect exit code 0 and all theme, contrast, and menu-schema tests passing.
- From `App/`, run `bun run generate:tauri-menu`; expect exit code 0 and `desktop/generated/menu.json` regenerated from the schema.
- From the project root, run `rg -n 'theme-light|theme-grey|theme-dark|theme-midnight|theme-auto' App/desktop/generated/menu.json`; expect all five IDs once in Light, Grey, Dark, Midnight, Auto order.
- From `App/`, run `bun run check:i18n`; expect exit code 0 with no missing or extra locale keys.
- From `App/`, run `bunx playwright test tests/e2e/ui/themes.spec.ts --project=openpencil`; expect exit code 0, four matching screenshot baselines, persistence/new-tab/ruler assertions passing, and no browser errors.
- From `App/`, run `bun run check`; expect exit code 0. Do not use `format:check`, because its script requires Git in this intentionally non-Git project.
- From the project root, run `$v1=(Get-Content -Raw 'App/package.json'|ConvertFrom-Json).version; $v2=(Get-Content -Raw 'App/desktop/tauri.conf.json'|ConvertFrom-Json).version; $v3=(Select-String -Path 'App/desktop/Cargo.toml' -Pattern '^version = "([^"]+)"$').Matches[0].Groups[1].Value; @($v1,$v2,$v3)|Select-Object -Unique`; expect one value, equal to the approved next minor after T-004.
- From `App/`, record `$buildStart=(Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis`; expect exit code 0, a release executable under `desktop/target/x86_64-pc-windows-msvc/release/`, and one fresh OpenPotlood `*_x64-setup.exe` under `desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/`. The configured `beforeBuildCommand` also regenerates the menu and runs the app build.
- From the project root, run `$installer=@(Get-ChildItem 'App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis' -Filter '*_x64-setup.exe' -File | Where-Object {$_.LastWriteTimeUtc -ge $buildStart}); if($installer.Count -ne 1){throw "Expected one fresh NSIS installer, found $($installer.Count)"}; Get-FileHash $installer[0].FullName -Algorithm SHA256`; expect one SHA-256 receipt for the single fresh installer.
- Install with `$installProcess=Start-Process -FilePath $installer[0].FullName -ArgumentList '/S' -Wait -PassThru; if($installProcess.ExitCode -ne 0){throw "Installer exit code $($installProcess.ExitCode)"}`; expect no exception. Then require `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe` unless T-002 proved a different path, and reuse T-002's exact `VersionInfo`, SHA-256, exact-path launch, window-title/handle, and repeated `Responding=True` checks.
- After installed-app inspection, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` The executor records this but does not promote T-005 or mark it DONE.

## Integration or Installed-Result Check

- Mandatory. A web preview or screenshot suite alone is insufficient because installed OpenPotlood hides the browser menubar and relies on the generated/native View menu.
- Build only after focused checks pass. Require one NSIS installer, record its SHA-256, install it silently with uppercase `/S`, and reuse T-002's verified installed-path, version, identity, executable-hash, launch, and responsive-process checks.
- In the installed app, use native View > Theme for all four explicit choices. Verify whole-shell recolouring and rulers; create/switch tabs; open a menu and dialog; confirm document artwork is unchanged.
- Restart-prove Midnight and Grey separately. The persisted setting must be active on first rendered usable window without selecting it again.
- Record the installed executable path, process name/ID, version, SHA-256, window title, theme persistence observations, and responsive-process result in the execution report.

## Stop Conditions

- Stop before editing if T-004 is not `VERIFIED`, T-005 is not `READY`, predecessor evidence is missing, the three version files disagree, or any prepared assumption/interface is stale.
- Stop if the user or predecessor work changed the required names, spelling, theme count, Auto behaviour, palette direction, persistence key policy, semantic token owner, native menu route, or installed-loop contract. Return for packet audit; do not infer a replacement.
- Stop if an intended edit falls outside Allowed Changes, requires a new dependency, requires native-menu checkmark synchronisation, or begins recolouring document content.
- Stop if the generated menu is not reproducible from `schema.ts`, a locale cannot be translated/validated without a product decision, a semantic token's use is ambiguous, or the contrast matrix cannot identify its actual foreground/background pair.
- Stop on any focused test, screenshot, i18n, menu-generation, check, build, install, launch, restart-persistence, version, identity, executable-hash, or responsive-process failure. Preserve evidence; do not mark completion.
- Stop if more than one current NSIS installer is present and cannot be distinguished by verified version/time, if the installed executable path cannot be obtained from T-002 evidence, or if installing would overwrite an unidentified application.
- Stop if the final version was advanced but the installed update fails. Restore the three version files to the recorded predecessor version before handoff, leave the packet unfinished, and report the exact failure.
- Stop if theme switching changes scene/document/undo data, Grey or Midnight has an unthemed/unreadable surface, a new/switched tab has stale rulers, or persisted restart state differs from the selected explicit setting.
- Stop rather than invoking updater, release, deployment, signing, publishing, Git, or copied resources as a workaround.

## Execution Report Contract

- Report result, predecessor evidence/version, files changed with before/after SHA-256, commands and exit codes, unit/contrast/menu/i18n/E2E results, screenshot names, palette deviations, version triplet, build executable/installer/installed executable hashes, installer and installed paths, native-menu checks, restart-persistence checks for Midnight and Grey, tab/ruler checks, document-integrity result, process responsiveness, deviations, and mess or concerns.

## Status record

Status: **Done**
