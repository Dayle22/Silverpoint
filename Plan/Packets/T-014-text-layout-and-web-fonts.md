# T-014 — Deliver text layout boxes and web fonts

Task ID: T-014
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-002
Prepared against: Live `App/` source, tests, and current official Figma/CanvasKit font documentation on 2026-07-24; T-002 is DONE/VERIFIED.
Last expanded: 2026-07-24

## Request Coverage

- Provide resizable text layout boxes supporting Auto Width (`WIDTH_AND_HEIGHT`), Auto Height (`HEIGHT`), Fixed Size (`NONE`), and Truncate (`TRUNCATE`) modes with correct paragraph wrapping and bounding-box interaction.
- Provide system font discovery and font loading using desktop native Tauri Rust `font-kit` commands (`list_system_fonts`, `load_system_font`).
- Provide an explicit Google Fonts (and Web Font providers) browse, search, preview, and local-download workflow via `FontPicker.vue`, `FontSettingsPopover.vue`, and app data storage cache (`createTauriDownloadedFontCache`).
- Preserve document typography layout with explicit missing-font warning indicators, fallback script rendering (CJK/Arabic/Latin), and offline disk cache retention without silent font substitution or data corruption.
- Keep this private, local-only Windows work inside `App/`; no Git, worktree, branch, release, updater, publishing, deployment, signing, or `Toolbox/` execution.

## User-Visible Outcome

Selecting a Text tool or existing `TextNode` allows setting text layout resizing mode (`Auto Width`, `Auto Height`, `Fixed Size`, `Truncate`) in the property panel or by resizing the text bounding box handles directly on canvas. In `Auto Width` mode, box dimensions expand automatically with text entry. In `Auto Height` mode, text wraps to the fixed width while height adjusts dynamically. In `Fixed Size` mode, text wraps within fixed width/height boundaries. Clicking the Font Picker dropdown displays categorised system fonts (`local`) and online Google Fonts (`google`). Users can filter, search, preview, and download font families for local offline use via the Font Settings popover. When opening a document with unavailable fonts, a warning icon displays missing font family names in the property panel, and text renders using clean fallback fonts without corrupting original font metadata. All text properties and downloaded font cache survive `.fig` save/reopen, export (PNG, SVG, PDF), and installed app relaunch.

## Verified Starting State

### Verified facts

- `App/packages/scene-graph/src/types.ts:190` defines `TextAutoResize = 'NONE' | 'HEIGHT' | 'WIDTH_AND_HEIGHT' | 'TRUNCATE'`; `:361-382` defines `TextNode` layout fields (`text`, `fontSize`, `fontFamily`, `fontWeight`, `italic`, `textAlignHorizontal`, `textAlignVertical`, `textAutoResize`, `lineHeight`, `letterSpacing`, `styleRuns`).
- `App/packages/core/src/canvas/text/index.ts:209-213` resolves paragraph layout width based on `node.textAutoResize` (`WIDTH_AND_HEIGHT` uses unbounded 1e6; `HEIGHT` / `NONE` uses `node.width`).
- `App/packages/core/src/canvas/text/index.ts:215-229` handles `textTruncation` and `maxLines` calculation for truncated text boxes.
- `App/packages/core/src/text/web-fonts.ts:12-27` defines `WEB_FONT_PROVIDER_IDS` (`['google', 'fontsource', 'bunny', 'fontshare']`) and `DEFAULT_WEB_FONT_PROVIDER_SETTINGS`.
- `App/desktop/src/fonts.rs:60-119` implements `list_system_fonts` and `load_system_font` Tauri commands using Rust `font_kit::source::SystemSource`.
- `App/src/app/editor/fonts/index.ts:83-162` integrates Tauri system font enumeration (`getTauriFonts()`) with `fontManager` web font options into `listFamilies()`.
- `App/src/app/editor/fonts/cache.ts:1-75` implements `createTauriDownloadedFontCache()` for persisting downloaded web font binaries to local app data store.
- `App/src/components/properties/TypographySection.vue:30-59` renders font picker, font settings popover trigger, and missing font warning alert badge (`ctx.missingFonts`).
- `App/src/components/font-picker/FontPicker.vue:56-95` renders font family dropdown with source tags (`local`, `google`, etc.) and preview font loading.
- `App/src/components/FontSettings/FontSettingsPopover.vue:1-120` controls online font provider toggles and cache clearing.
- `tests/engine/text/fonts/loading.test.ts` tests font manager loading lifecycle and fallback font resolution.
- `tests/engine/text/editor.test.ts` tests text node editing, style runs, and layout updates.
- `tests/e2e/fonts/picker.spec.ts` tests font picker interaction and font selection.
- `tests/e2e/text/editing.spec.ts` tests canvas text node creation, typing, and formatting.

### Official research

- Figma Official Documentation on Text Resizing: Figma supports three main text box resizing options: Auto Width (box grows horizontally with text), Auto Height (box has fixed width and grows vertically as text wraps), and Fixed Size (box has fixed width and height, text wraps and clips/truncates). Source: https://help.figma.com/hc/en-us/articles/360040449773-Text-resizing
- Web Font Loading API (CSS Font Loading API): The `FontFace` interface and `document.fonts` API allow registering loaded font binaries dynamically into document context. Source: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API
- Skia CanvasKit Paragraph API: CanvasKit `ParagraphBuilder` and `TypefaceFontProvider` manage font family fallback chains, text wrapping, and line breaking. Source: https://api.skia.org/classSkFontMgr.html

### Fixed implementation decisions

- Text Box Resizing Modes:
  - `WIDTH_AND_HEIGHT` (Auto Width): Canvas width expands dynamically to match text width. Height matches single or multi-line paragraph height.
  - `HEIGHT` (Auto Height): Canvas width is fixed (`node.width`). Lines wrap automatically at box width; box height expands to fit paragraph lines.
  - `NONE` (Fixed Size): Canvas width and height are fixed (`node.width`, `node.height`). Text wraps at `node.width` and clips vertically at `node.height`.
  - `TRUNCATE` (Truncate): Fixed size with trailing ellipsis (`…`) when content overflows `maxLines` or box height.
- Direct Canvas Handle Resizing:
  - Dragging horizontal side handles when `textAutoResize` is `WIDTH_AND_HEIGHT` updates `textAutoResize` to `HEIGHT` with the new width.
  - Dragging vertical side handles in `WIDTH_AND_HEIGHT` or `HEIGHT` mode updates `textAutoResize` to `NONE` with the new height.
  - Double-clicking a text node boundary handle resets `textAutoResize` to `WIDTH_AND_HEIGHT`.
- System & Google Font Workflow:
  - In desktop app, system fonts enumerated via native Rust `list_system_fonts` appear marked as `local` in `FontPicker.vue`.
  - Web fonts from Google Fonts (`google`) can be searched and selected. When selected, font binaries are fetched and saved to disk via `createTauriDownloadedFontCache()`.
- Offline & Missing-Font Safeguards:
  - If a font family cannot be loaded (offline or missing font file), `missingFonts` badge triggers in `TypographySection.vue`.
  - Text renders using installed system fallback fonts without changing the stored `node.fontFamily` property in the scene graph or file output.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `App/packages/scene-graph/src/types.ts`
- `App/packages/core/src/canvas/text/index.ts`
- `App/packages/core/src/text/fonts.ts`
- `App/packages/core/src/text/web-fonts.ts`
- `App/desktop/src/fonts.rs`
- `App/src/app/editor/fonts/index.ts`
- `App/src/app/editor/fonts/cache.ts`
- `App/src/components/properties/TypographySection.vue`
- `App/src/components/font-picker/FontPicker.vue`
- `App/src/components/FontSettings/FontSettingsPopover.vue`
- `tests/engine/text/fonts/loading.test.ts`
- `tests/engine/text/editor.test.ts`
- `tests/e2e/fonts/picker.spec.ts`
- `tests/e2e/text/editing.spec.ts`

## Allowed Changes

- `App/packages/core/src/canvas/text/index.ts` — to refine text auto-resize paragraph width resolution or truncation calculations if defects exist.
- `App/src/components/properties/TypographySection.vue` — to add explicit `textAutoResize` segmented control buttons (Auto Width, Auto Height, Fixed Size, Truncate) if missing or incomplete.
- `App/src/components/font-picker/FontPicker.vue` — to refine search filtering, provider badges, or download status indicators.
- `App/src/components/FontSettings/FontSettingsPopover.vue` — to expose downloaded font storage usage and clear cache actions cleanly.
- `App/packages/vue/src/editor/selection-capabilities/` or canvas interaction handlers — to bind text box handle drag actions to `textAutoResize` mode transitions.
- `tests/engine/text/` — new or updated unit tests for text auto-resize mode calculations and font fallback resolution.
- `tests/e2e/text/` — new or updated E2E test files covering text box auto-resizing, font picker selection, missing font indicators, and offline font cache.
- `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml` — only for version increment upon completed production build.

## Restrictions and Exclusions

- Do not modify existing `.fig` Kiwi schema definitions for `TextNode` or font properties.
- Do not perform silent font substitution that overwrites `node.fontFamily` in the scene graph.
- Do not perform background font downloads without user selection or explicit font resolution demand.
- Do not break offline document loading or corrupt saved text contents.

## Implementation Steps

1. Verify text auto-resize mode handling in `App/packages/core/src/canvas/text/index.ts` and `TypographySection.vue`. Ensure controls exist for `WIDTH_AND_HEIGHT` (Auto Width), `HEIGHT` (Auto Height), `NONE` (Fixed Size), and `TRUNCATE` (Truncate).
2. Verify bounding-box resize handle interactions for text nodes on canvas. Confirm horizontal handle drag converts `WIDTH_AND_HEIGHT` -> `HEIGHT`, and vertical handle drag converts to `NONE`.
3. Verify system font discovery via native `list_system_fonts` IPC command in `App/desktop/src/fonts.rs` and `App/src/app/editor/fonts/index.ts`.
4. Verify Google Fonts browsing and downloading via `FontPicker.vue` and `createTauriDownloadedFontCache()`. Ensure downloaded font binaries persist in local app data.
5. Verify missing-font handling and warning badge in `TypographySection.vue`. Confirm missing fonts render using fallbacks without overwriting original font properties in document files.
6. Run focused unit tests (`bun test tests/engine/text/`), Playwright E2E tests (`bun run test:e2e tests/e2e/fonts/`), and desktop build check (`cargo check` in `App/desktop`).

## Acceptance Criteria

- Text nodes support `Auto Width`, `Auto Height`, `Fixed Size`, and `Truncate` resizing modes with accurate canvas paragraph rendering.
- Dragging text bounding-box side handles automatically updates `textAutoResize` mode as specified.
- Font picker lists installed Windows system fonts and online Google Fonts with distinct provider tags.
- Selected Google Fonts download automatically and persist in local offline cache.
- Missing fonts display a warning badge in the property panel and fall back gracefully without altering document data.
- Text layout, web fonts, and missing font handling survive `.fig` save/reopen, export (PNG, SVG, PDF), and installed app relaunch.

## Verification

1. `bun test ./tests/engine/text/fonts/loading.test.ts ./tests/engine/text/editor.test.ts` — expect exit `0`.
2. `bun run test:e2e tests/e2e/fonts/picker.spec.ts tests/e2e/text/editing.spec.ts` — expect exit `0`.
3. `bun run check` — expect exit `0`.
4. `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc` — expect exit `0`.
5. For production delivery: verify installed app identity, silently install fresh NSIS build, verify executable SHA-256, version, and responsive checks.
6. From project root: `python C:\Users\User\.gemini\config\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` — expect `[PASS] Project pipeline is structurally consistent.`

## Integration or Installed-Result Check

- Mandatory for any production change: installed OpenPotlood executable must prove text box auto-resizing, system font discovery, Google Fonts selection and local disk caching, missing-font warning alerts, fallback rendering, `.fig` save/reopen/relaunch, exact executable identity/version/path, and repeated responsiveness.

## Stop Conditions

- Stop if system font enumeration fails or causes application crash on Windows.
- Stop if font binary caching fails or corrupts local disk storage.
- Stop if automated test suites or desktop Cargo compilation fail.

## Execution Report Contract

- Report prerequisite state; baseline and final SHA-256 hashes; changed files; focused test counts/exits; text auto-resizing verification; system font discovery evidence; Google Fonts download & cache evidence; missing-font warning badge checks; fallback rendering results; `.fig` round-trip; SVG/PDF export isolation; installed installer/executable/version/path/hash/title/handle/responsiveness when applicable; deviations; and concerns.

## Status record

Status: **Done**
