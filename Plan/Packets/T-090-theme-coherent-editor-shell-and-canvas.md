# T-090 - Theme-coherent editor shell, canvas and grid

Task ID: T-090
Packet state: Done
Packet revision: 1
Project goal link: `Plan/endgoal.md`
Depends on: none
Related: T-005, T-029, T-031d, T-090a
Prepared from: user's 2026-08-24 request that the top bar, toolbar, project tabs and side panels share one theme colour, and that the canvas and grid follow the active theme while remaining editable
Expanded at: 2026-08-24 10:25 Africa/Johannesburg
Expanded against: `Plan/plan.md`, `Plan/PACKET-EXPANSION-BRIEF.md`, and live `App/` source read 2026-08-24
Delivery: named source gates + browser check
Execution size: 4 core implementation files; 2 existing test files across Bun and Playwright; within the packet ceiling

## Intended Outcome

Every explicit theme (`light`, `grey`, `dark`, `midnight`) presents one continuous editor-chrome colour across the tab/top bar, toolbar, docked panels and floating-panel title bar. The CanvasKit canvas background follows the active theme while it is theme-linked. A manually chosen canvas colour becomes an override and is not destroyed by later theme changes. The existing grid behaves the same way: its default colour follows the theme and a custom grid colour remains custom.

## Request Coverage

> “the top bar, toolbar, project tabs, and side panels should be the same colour (remember the themes) and the canvas along with the grid should also change according to grid, but should still remain editable”

Interpret the second “grid” as “theme”. T-090a owns moving colour/unit/DPI into the Pages-panel footer.

## Verified Starting State

| Path | Symbol / selector | Verified live fact and binding use |
| --- | --- | --- |
| `src/app.css:71-223` | `--color-panel`, `--color-canvas`, `--color-ruler-*` in four theme blocks | All four themes already own semantic panel/canvas/ruler tokens. Reuse them; do not add a palette. |
| `src/components/TabBar.vue:88-190` | root `TabsRoot` and `[data-test-id="tabbar-tab"]` | The root is `bg-canvas`; active tabs are `bg-panel`. Change the root to `bg-panel` so the top bar and all tab states share the panel surface. |
| `src/components/Toolbar/DesktopToolbar.vue:36-78` | `[data-test-id="toolbar"]` | Uses `bg-panel/95 backdrop-blur-md`; replace those two surface modifiers with opaque `bg-panel`. Preserve geometry and tool behaviour. |
| `src/components/Shell/FloatTitleBar.vue:60-76` | floating title-bar root | Uses `bg-panel-secondary`; change only that background token to `bg-panel`. |
| `src/components/Shell/PanelStack.vue:55-85`, `WorkspacePanel.vue:16-29`, `PanelTabStrip.vue:103-141` | dock, panel body and panel tab strip | Already use `bg-panel`; these are reference surfaces, not edit targets. |
| `src/app/shell/theme.ts:60-105` | `readRulerTheme()`, `updateCanvasTheme()`, `applyTheme()` | Theme changes currently update only `state.rulerTheme`, then repaint. Extend this seam to read `--color-canvas` and update only theme-linked canvas backgrounds. |
| `packages/core/src/canvas/grid.ts:10-26,75-80` | `CanvasGridSettings`, `DEFAULT_CANVAS_GRID_SETTINGS`, `gridColor()` | `#808080` is the existing sentinel: the default resolves through `r.rulerTheme.tick`; any custom colour remains explicit. Preserve this exact rule. |
| `packages/core/src/canvas/renderer/pipeline.ts:52-55,177,211` | renderer-state transfer, `canvas.clear`, `drawCanvasGrid` | CanvasKit clears from `state.pageColor`, then draws the grid. No CanvasKit wrapper is allocated by the planned change. |
| `packages/core/src/editor/page-viewports.ts:14-51` | `createPageViewportStore()` | Canvas colour is stored per page in memory and new page viewports start at `CANVAS_BG_COLOR`; T-090 must resynchronise on `currentPageId`, not only on tab/store changes. |

Required new contracts in `src/app/shell/theme.ts`:

```ts
export function colorsEqual(left: Color, right: Color, epsilon?: number): boolean
export function resolveThemeCanvasColor(
  current: Color,
  previouslyApplied: Color | undefined,
  nextThemeColor: Color
): { color: Color; linked: boolean }
export function markCanvasThemeCustom(store: object, pageId: string): void
```

`resolveThemeCanvasColor` is pure. With no previous applied colour, treat only `CANVAS_BG_COLOR` and `CANVAS_BG_COLOR_DARK` as linked. With a previous applied colour, retain linkage only when `current` equals it within `1 / 255`. Linked returns a fresh copy of `nextThemeColor`; custom returns a fresh copy of `current` and `linked: false`.

## Read First

1. `src/app/shell/theme.ts:60-105` — current theme-to-renderer seam.
2. `packages/core/src/constants.ts:14-43` — portable light/dark canvas defaults.
3. `packages/core/src/canvas/grid.ts:10-26,75-80` — default-sentinel/custom-override rule.
4. `src/components/TabBar.vue:88-190`, `src/components/Toolbar/DesktopToolbar.vue:36-78`, `src/components/Shell/FloatTitleBar.vue:60-76` — the only chrome edits.
5. `tests/engine/app/shell/theme.test.ts:1-52` and `tests/e2e/ui/themes.spec.ts:1-89` — existing focused evidence.

## Fixed Decisions

1. **One opaque surface token:** all named chrome uses `bg-panel`. Do not alter borders, selected states, hover states or geometry.
2. **Theme-link is non-destructive:** a custom canvas colour survives theme changes. T-090a calls `markCanvasThemeCustom()` from both colour and alpha edits.
3. **Per-page linkage:** keep a module-local `WeakMap<object, Map<string, Color>>` keyed by concrete editor store and `currentPageId`. It is display state only; do not write plugin data or scene nodes.
4. **New-page and page-switch sync:** add a computed current-page identity derived from `activeEditorStore` and watch it together with the active store. A new page's `CANVAS_BG_COLOR` therefore resolves to the active theme on first display.
5. **Grid remains editable:** do not change `CanvasGridSettings`, its storage key, or `gridColor()`. Existing default-sentinel behaviour is already correct.
6. **Document integrity:** theme switching must not touch graph nodes, undo history, document units, canvas-grid settings, or `.fig` serialisation.

## Visual Contract — binding

- `TabBar.vue` root: keep the complete class string and replace only `bg-canvas` with `bg-panel`.
- `DesktopToolbar.vue` toolbar: `flex items-center gap-0.5 rounded-lg border border-border/80 bg-panel p-1 shadow-lg select-none transition-all duration-200`.
- `FloatTitleBar.vue` root: retain its live classes and replace only `bg-panel-secondary` with `bg-panel`.
- Active/inactive tabs, dashboard, close/new buttons, tool selected/hover/disabled/focus-visible states remain byte-for-byte unchanged except for inherited root background.
- Existing `data-test-id` values remain unchanged.

### Banned List

- No literal colours, Tailwind palette colours, new theme IDs, new global CSS, or `app.css` edits.
- No new `tv()` recipe, dependency, store, local-storage key, panel-layout change or renderer allocation.
- No opacity/backdrop treatment on the toolbar surface.
- No recolouring document nodes, frames, exports or thumbnails.

## Allowed Changes

- `App/src/app/shell/theme.ts`
- `App/src/components/TabBar.vue`
- `App/src/components/Toolbar/DesktopToolbar.vue`
- `App/src/components/Shell/FloatTitleBar.vue`
- `App/tests/engine/app/shell/theme.test.ts`
- `App/tests/e2e/ui/themes.spec.ts`

## Restrictions and Exclusions

- Do not edit `app.css`, CanvasKit renderer/core grid code, preferences, page-settings UI, panel schema, menu schema, locale messages, native theme mapping or generated files.
- Do not change user-selected canvas/grid colours merely to improve contrast.
- Do not build, install, bump versions, run Git commands, or run umbrella checks/tests.

## Implementation Steps

1. **Pre-flight:** reread every Read First symbol. Stop if the four theme tokens, default grid sentinel, or named class strings have moved materially.
2. **Pure link resolver:** in `theme.ts`, import `Color`, `CANVAS_BG_COLOR`, and `CANVAS_BG_COLOR_DARK`; add the three exact exported functions above plus the module-local weak map. `markCanvasThemeCustom()` deletes only the named page's applied-colour entry.
3. **Theme canvas read/sync:** add a private `readCanvasThemeColor(): Color | null` using `getComputedStyle(document.documentElement).getPropertyValue('--color-canvas')` and existing `parseColor`. Extend `updateCanvasTheme()` to set `rulerTheme`, resolve the current page colour, assign only when linked, remember the applied theme colour, and call `requestRepaint()` once.
4. **Page watcher:** watch the active store and computed active `currentPageId`; invoke `updateCanvasTheme()` after page/tab switches. Preserve the existing immediate `useAppTheme()` watch.
5. **Chrome:** make the three exact token substitutions in TabBar, DesktopToolbar and FloatTitleBar. No other class edits.
6. **Unit evidence:** extend `theme.test.ts` using its existing Bun header. Cover first-link light/dark defaults, linked theme-to-theme change, custom RGB preservation, custom alpha preservation and the `1/255` tolerance.
7. **Browser evidence:** extend `themes.spec.ts`. For each theme assert computed backgrounds of TabBar, toolbar, a dock panel and float title bar equal `--color-panel`; assert current `state.pageColor` equals `--color-canvas` while linked; assert default grid state is unchanged and uses a non-empty ruler tick. Then edit canvas colour through the Pages footer only after T-090a lands, or directly through `store.setPageColor()` before T-090a, and prove another theme switch preserves it.

## Acceptance Criteria

- [x] Four themes render the named chrome surfaces at the same computed `--color-panel` value.
- [x] Theme-linked canvas colour changes to each theme's `--color-canvas` on theme, tab and page switches.
- [x] Manual canvas RGB or alpha edits survive later theme changes.
- [x] Default grid colour follows the theme ruler tick; custom grid colour remains unchanged.
- [x] Graph serialisation and undo availability are unchanged across theme switches.
- [x] No panel geometry, toolbar geometry, tab interaction or CanvasKit ownership changes.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bun test tests/engine/app/shell/theme.test.ts
```

Expected: all theme-link resolver/native-theme tests pass.

### Final pre-completion gates — run once

```powershell
bunx oxfmt --check src/app/shell/theme.ts src/components/TabBar.vue src/components/Toolbar/DesktopToolbar.vue src/components/Shell/FloatTitleBar.vue tests/engine/app/shell/theme.test.ts tests/e2e/ui/themes.spec.ts
bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/theme.ts src/components/TabBar.vue src/components/Toolbar/DesktopToolbar.vue src/components/Shell/FloatTitleBar.vue
bunx vue-tsc --noEmit -p tsconfig.json
bunx playwright test tests/e2e/ui/themes.spec.ts --project=openpencil
```

Do not run `bun run check`, `bun run test`, `bun run test:unit`, builds or installs.

## Integration or Installed-Result Check

Run `bun run dev`, open the browser editor, and visually cycle Light, Grey, Dark and Midnight. Confirm the top/tab bar, toolbar, docked panels and a floating-panel title bar form one colour family; confirm canvas and default grid visibly update; set a custom canvas colour and custom grid colour and confirm both remain editable and survive another theme change. Browser proof is sufficient.

## Stop Conditions

- Stop if theme application cannot distinguish a custom canvas colour without adding document/plugin persistence.
- Stop if the change would alter exported document backgrounds or `.fig` serialisation.
- Stop on missing CanvasKit assets, required gate failure, unexpected panel-layout changes or any need to edit outside Allowed Changes.

## Execution Report

- **Result:** Success (all pre-completion gates passed)
- **Changed files:**
  - `App/src/app/shell/theme.ts`
  - `App/src/components/TabBar.vue`
  - `App/src/components/Toolbar/DesktopToolbar.vue`
  - `App/src/components/Shell/FloatTitleBar.vue`
  - `App/tests/engine/app/shell/theme.test.ts`
  - `App/tests/e2e/ui/themes.spec.ts`
- **Gate Outcomes:**
  - `bun test tests/engine/app/shell/theme.test.ts`: 9/9 passed (0 failed).
  - `bunx oxfmt --check ...`: passed (0 issues).
  - `bunx oxlint -c oxlint.json --type-aware --type-check ...`: passed (0 warnings, 0 errors).
  - `bunx vue-tsc --noEmit -p tsconfig.json`: passed (exit code 0).
  - `bunx playwright test tests/e2e/ui/themes.spec.ts --project=openpencil`: passed (1/1 passed).
- **Chrome & Canvas Behaviour:**
  - TabBar root, DesktopToolbar, docked panels, and FloatTitleBar all share the single `--color-panel` token.
  - Theme-linked canvas background updates dynamically across theme and page switches to match `--color-canvas`.
  - Manual canvas overrides (RGB or alpha) are preserved across theme switches.
  - Default grid resolves through the active ruler tick colour; custom grid settings remain intact.

## Status record

- 2026-08-24 — Revision 1 expanded from live source.
- 2026-08-24 — Executed and verified. All unit tests, linting, type-checking, and Playwright E2E browser tests passed. Status updated to Done.

Status: **Done**
