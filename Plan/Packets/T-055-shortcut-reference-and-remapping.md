# T-055 - Keyboard shortcut reference

Task ID: T-055
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-030
Related: T-042, T-054
Prepared from: the 2026-08-14 stub packet and a full re-read of the live keyboard/menu/preferences source
Expanded at: 2026-08-15
Expanded against: `App/src/app/shell/keyboard/*.ts`, `App/packages/vue/src/editor/commands/registry.ts`, `App/packages/vue/src/editor/commands/shortcut.ts`, `App/packages/core/src/editor/tool-registry.ts`, `App/src/app/shell/menu/{schema,shortcut,use}.ts`, `App/src/components/Shell/PreferencesDialog.vue`, `App/src/theme/preferences-dialog.ts`, `App/src/app/shell/preferences.ts`, `App/src/components/ui/{menu.ts,dialog.ts,AppInput.vue,Tip.vue}`, `App/tools/tauri-menu/src/generate.ts`, `App/desktop/src/menu.rs`
Delivery: source gates only

## Intended Outcome

A **searchable, read-only keyboard shortcut reference** lives inside the existing Preferences dialog. It lists every editor command and every tool switch with its current key combination, grouped and filterable by typing. Nothing about what a shortcut does, or which key triggers it, changes. Remapping is out of scope for this packet — it is specified under "Deferred to a later packet" below with enough detail to cut it as its own bounded packet.

## Request Coverage

- Show the user the full set of keyboard shortcuts in one place.
- Let the user change them. *(Deferred — see below. The stub's own "Expansion Questions" agreed this split was probably right; source confirms it, and the corrected native-menu finding makes remapping materially riskier than the stub assumed.)*

## Corrections to the Brief

The stub's "Verified Starting State" is accurate but incomplete in a way that matters for scope. Re-reading the live source surfaces three points the stub did not have:

1. **`editorCommandMetadata` is not the only source of truth for bound keys.** `App/src/app/shell/keyboard/registry.ts` builds its `shortcuts` array from two other sources as well: literal `ShortcutDefinition` objects with hand-written `keys` (`'toggle-ai'`, `'toggle-auto-layout'`, `'delete-backspace'`, `'delete'`, `'delete-alt'`, `'enter'`, `'escape'` — 7 ids with **no command and no metadata entry anywhere**), and `appMenuTinykeysShortcut(id)` lookups against `APP_MENU_SCHEMA` for menu-owned actions (`'export-selection-png'`, `'save-as'`, `'toggle-ui'`, `'close-tab'`, `'new-tab'`, `'reopen-closed-tab'`, `'save'`, `'open-file'` — 8 ids whose keys and labels live in `App/src/app/shell/menu/schema.ts`, not in `editorCommandMetadata`). The stub's framing ("all commands in `editorCommandMetadata` plus `TOOL_SHORTCUTS`, or a curated set?") missed that a third, unlabelled category exists. See Fixed Decision 1.
2. **There are two independent shortcut-string dialects, not one.** `EDITOR_COMMAND_METADATA` (`App/packages/vue/src/editor/commands/registry.ts`) carries both a `keybinding` (tinykeys syntax, e.g. `'$mod+KeyD'`) and a separate `shortcut` (a platform-neutral display token, e.g. `'MOD+D'`, formatted for humans by `formatShortcut()` in `App/packages/vue/src/editor/commands/shortcut.ts`). `TOOL_SHORTCUTS` (`App/packages/core/src/editor/tool-registry.ts`) is keyed by raw `KeyboardEvent.code` strings (`'KeyV'`) and carries no display form at all — the display string for a tool lives separately, on `EDITOR_TOOLS[].shortcut` (`'V'`, `'Shift+M'`), matched by `key`, not by code. Building one reference list means normalising three different shapes into one row model. See Fixed Decision 2.
3. **The native Tauri menu is generated once, at build/dev-launch time, and never synced afterwards.** `App/tools/tauri-menu/src/generate.ts` reads `APP_MENU_SCHEMA`, resolves each entry's accelerator via `entry.accelerator ?? shortcutTokenToAccelerator(entry.shortcut)`, and writes `desktop/generated/menu.json`. This only runs from `beforeDevCommand` / `beforeBuildCommand` in `App/desktop/tauri.conf.json` (`bun run generate:tauri-menu` before `bun run dev` / `bun run build`). The only *runtime* menu-sync command on the Rust side is `sync_panel_menu` (`App/desktop/src/menu.rs:87`), which updates panel checkboxes — there is no equivalent for accelerators. A shortcut changed at runtime cannot be reflected in the native menu without a relaunch through a regenerated `menu.json`, which this project's delivery policy does not run per packet. This is exactly the risk the stub called out ("a stale native menu showing the wrong key would be worse than no remapping") and it is confirmed real. See Fixed Decision 6 and Stop Conditions.

None of this invalidates the stub's premise. It sharpens the cut: a read-only reference has no native-menu problem (it reads the same `schema.ts`/`editorCommandMetadata` the menu itself reads, so it can never show a key the menu disagrees with); remapping does, and is deferred.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/app/shell/keyboard/registry.ts` | Builds the live `tinykeys` binding map. `commandShortcut()`/`commandShortcuts()` pull `keybinding` from `editorCommandMetadata()`; 15 further `ShortcutDefinition`s are listed by hand in `registerKeyboardShortcuts()`, 8 of them sourced through `appMenuTinykeysShortcut()`, 7 with no metadata source at all (see Correction 1). `bindToolShortcuts()` separately binds every entry of `TOOL_SHORTCUTS`. |
| `App/src/app/shell/keyboard/{actions,clipboard,focus,nudging,reserved,space-tool,types,use}.ts` | Sibling modules confirmed present. `use.ts` (`useKeyboard()`) is the composition root that calls `registerKeyboardShortcuts`, `bindEditorClipboard`, `bindNudgeKeys`. |
| `App/src/app/shell/keyboard/reserved.ts` | `isReservedModShortcut(e)` — true for `Meta/Ctrl` + any of a fixed `RESERVED_MOD_CODES` set (`Backslash, BracketLeft, BracketRight, Digit0-2, KeyA,B,D,E,G,H,J,K,L,N,O,S,T,W,Y,Z`), or `Meta/Ctrl+Alt` + `KeyB`/`KeyK`. `preventReservedKeyboardDefaults(e)` additionally blocks the browser default for `Backspace`, `Delete`, `BracketLeft/Right`, `Space`. This is a **browser-default suppressor**, not a user-facing conflict/reservation list — it stops the OS/browser from eating a key the app wants, and has nothing to say about whether the *user* may rebind a given command. There is no user-facing "reserved, cannot be changed" concept anywhere in the keyboard module. |
| `App/src/app/shell/keyboard/focus.ts` | `isEditing()` / `isInputElement()`; `shouldIgnoreShortcut()` in `registry.ts` uses `isEditing`, `inputFocused`, `store.state.editingTextId`, `store.state.numberFieldFocused`, and a `[data-picker-content]` check to suppress shortcuts while text/number editing or a picker is open — confirmed exactly as the stub states. |
| `App/packages/vue/src/editor/commands/registry.ts` | `EDITOR_COMMAND_METADATA` — 29 `EditorCommandId` keys. Every key has an entry (TypeScript's `satisfies Record<EditorCommandId, EditorCommandMetadata>` enforces this at compile time — the metadata **cannot** be missing a command). Only some entries carry `keybinding`/`shortcut`; e.g. `selection.goToMainComponent`, `selection.createInstance`, `selection.outlineText`, `selection.outlineStroke`, `selection.moveToPage` are `{}` — commands that exist but are not (yet) bound to any key. `editorCommandMetadata(id)` is the read accessor. |
| `App/packages/vue/src/editor/commands/shortcut.ts` | `formatShortcut(shortcut, platform)` turns a `MOD+SHIFT+X`-style token into a platform-correct display string (`⌘⇧X` on mac, `Ctrl+Shift+X` elsewhere) via `shortcutPlatform()`, reading `navigator.userAgent`. This is the exact function to reuse for display — do not write a second formatter. |
| `App/packages/core/src/editor/tool-registry.ts` | `EDITOR_TOOLS` (7 tools, each with `key`, `label`, `shortcut` display string, optional `flyout`) and `TOOL_SHORTCUTS` (`Partial<Record<string, Tool>>`, 13 `KeyboardEvent.code` → `Tool` entries, including two entries mapping to `'SHAPE_BUILDER'` — `KeyM` and `Shift+KeyM`). |
| `App/src/app/shell/menu/schema.ts` | `APP_MENU_SCHEMA` — the File/Edit/View/Object/Text/Arrange/Window menu tree. Some entries carry a literal `shortcut` (`'MOD+N'`), some carry a `command` and fall back to that command's metadata `shortcut`, some (`copy`, `cut`, `paste`, `zoom-in`, `zoom-out`, alignment commands) have a `shortcut` but **no corresponding tinykeys binding anywhere** — they are display-only menu labels backed by native OS/browser behaviour (copy/cut/paste) or not yet wired (alignment). A reference built only from `registry.ts` + `TOOL_SHORTCUTS` would omit these; a reference that also walks `APP_MENU_SCHEMA` would show entries with no live binding as "menu-only". Scope decision below picks the former (bound keys only) to keep the list honest — see Fixed Decision 1. |
| `App/src/app/shell/menu/shortcut.ts` | `appMenuShortcut(id)` walks `APP_MENU_SCHEMA` recursively for a display token; `shortcutTokenToTinykeys()` / `shortcutTokenToAccelerator()` convert `MOD/SHIFT/ALT` tokens to tinykeys' `$mod/Shift/Alt` or Tauri's `CmdOrCtrl/Shift/Alt` dialects respectively. `appMenuTinykeysShortcut(id)` and `appMenuShortcutLabel(id)` compose these — `registry.ts` calls the former to bind, `TabBar.vue`/`TypographySection.vue` call `appMenuShortcutLabel` to display (see below). |
| `App/tools/tauri-menu/src/generate.ts`, `App/desktop/src/menu.rs`, `App/desktop/tauri.conf.json` | Confirmed per Correction 3: static generation at dev/build launch, no runtime accelerator sync. `sync_panel_menu` (`menu.rs:87`) exists only for panel checkboxes. |
| `App/src/components/Shell/PreferencesDialog.vue` | Exists from T-030. Sectioned dialog (`Appearance`, `Canvas Display`, `Guides`, `Capabilities`, `AI`), each section an `aria-labelledby` block using `styles.section`/`styles.sectionTitle`/`styles.row`. `useDialogUI({ content: 'flex max-h-[80vh] w-[560px] max-w-[92vw] flex-col overflow-hidden' })`. This packet adds a sixth section, not a new dialog — the existing dialog already scrolls (`overflow-y-auto` on `styles.body`) and is the natural host per the stub. |
| `App/src/theme/preferences-dialog.ts` | The `tv()` recipe backing every class string above (`header`, `body`, `section`, `sectionTitle`, `row`, `rowLabel`, `hint`, etc.) — read in full; slot strings quoted verbatim in the Visual Contract below. |
| `App/src/app/shell/preferences.ts` | Confirmed persistence pattern: `useLocalStorage('open-potlood:preferences', ...)` from `@vueuse/core`, a `PREFERENCES_VERSION` constant, a `normalise()` guard on read, `openPreferences()`/`preferencesOpen` ref. This is the pattern any future remapping-override store must copy (see Deferred section) — it is **not** reused by this packet, which persists nothing. |
| `App/src/components/ui/menu.ts` | `tv({ slots: { ..., shortcut: 'text-[11px] text-muted', ... } })` — the exact slot to reuse for rendering a key combo, already used elsewhere for context-menu shortcut hints. |
| `App/src/components/ui/AppInput.vue`, `App/src/components/ui/Tip.vue` | Confirmed present. `AssetsPanel.vue` shows the live search-input pattern: `<AppInput v-model="query" type="search" data-test-id="assets-search" size="sm" :placeholder="..." />`. |
| `App/src/components/TabBar.vue:163`, `App/src/components/properties/TypographySection.vue:166-182` | Confirmed live callers of `appMenuShortcutLabel()` for ad hoc hint rendering — correcting the stub's path (`components/Shell/TabBar.vue` does not exist; the real file is `App/src/components/TabBar.vue`). `App/src/components/canvas/CanvasMenu.vue`, `App/src/components/editor/ZoomDropdown.vue`, `App/src/components/Toolbar/ToolFlyout.vue`, `App/src/components/properties/BooleanOperationsControl.vue` also reference shortcut display (confirmed by grep for `editorCommandMetadata`/`formatShortcut`/`.shortcut` under `App/src/components`) — six call sites total, one more than the stub's five, `Toolbar/DesktopToolbar.vue`/`ToolFlyout.vue` also match. |

## Fixed Decisions

1. **Scope is every key actually bound by `registry.ts`, from all three of its sources — not only `editorCommandMetadata`.** The reference lists three row kinds: (a) commands with a `keybinding` in `EDITOR_COMMAND_METADATA` (id + `formatShortcut(metadata.shortcut)`, falling back to a raw display of `keybinding` if `shortcut` is absent — none currently are, but the type allows it); (b) tool switches from `TOOL_SHORTCUTS`, deduplicated by `Tool` and displayed via the matching `EDITOR_TOOLS[].shortcut`; (c) the 15 hand-written `registry.ts` entries with no command id. For (c), add one small local label map co-located with the reference component (not exported, not touching `registry.ts`), e.g. `{ 'toggle-ai': dialogs.value.shortcutsToggleAI, 'delete-backspace': dialogs.value.shortcutsDelete, ... }` — reusing `appMenuShortcutLabel(id)` (which already resolves 8 of the 15 through `APP_MENU_SCHEMA`) and hand-labelling only the remaining 7 (`toggle-ai`, `toggle-auto-layout`, `delete-backspace`, `delete`, `delete-alt`, `enter`, `escape`) with new i18n strings. This directly answers the stub's Stop Condition ("stop if command metadata cannot supply a stable id and label for every binding"): metadata alone cannot, for exactly 7 entries, so the packet supplies those 7 labels itself rather than silently dropping them or stopping. `selection.*` commands with no `keybinding` (e.g. `selection.goToMainComponent`) are **excluded** — they have no key to show.
2. **One row model normalises all three shapes.** `{ id: string; label: string; keys: string[]; source: 'command' | 'tool' | 'menu' }`. `keys` is always the **display** string(s) (`formatShortcut()` output for commands and menu items, `EDITOR_TOOLS[].shortcut` for tools, the new label map's paired literal for the 7 hand-written entries — e.g. `'Backspace'`, `'Enter'`, `'Esc'`). Building this list is a pure function, e.g. `buildShortcutReference(): ShortcutReferenceRow[]`, placed in a new `App/src/app/shell/keyboard/reference.ts` (read-only aggregation, imports `EDITOR_COMMAND_METADATA`/`editorCommandMetadata`, `TOOL_SHORTCUTS`, `EDITOR_TOOLS`, `formatShortcut`, `appMenuShortcutLabel` — no new binding logic). This keeps `registry.ts` itself untouched.
3. **Host: a new section inside the existing `PreferencesDialog.vue`, not a new dialog.** The stub floated `PreferencesDialog.vue` as "the natural host" and the live file confirms it: it already scrolls, already sections content the same way, and already owns the one `openPreferences()`/`preferencesOpen` entry point wired into the File/Edit menu and (per Correction 3) the native menu's `preferences` id. A seventh section, `Keyboard Shortcuts`, is added after `AI` (last today). A new top-level dialog would need its own menu entry, its own open/close state, and its own native-menu wiring for no benefit over reusing the surface that already exists for exactly this kind of settings content.
4. **Search is client-side substring filtering over `label`, case-insensitive, no debounce needed** — the row count is small (≈50 rows: 24 bound commands + 7 tools + 15 registry-only entries, deduplicated), so filtering on every keystroke against an array already in memory needs no `watchDebounced`.
5. **Grouping in the list is by `source`** (`Tools`, `Commands`, `Other`) as three `styles.section`/`styles.sectionTitle` blocks matching the dialog's existing section rhythm, each filtered independently by the same search query; a group with zero matches is hidden entirely (do not render an empty heading).
6. **The native-menu staleness risk (Correction 3) does not apply to this packet and needs no mitigation here**, because this packet never writes a key — it only reads and displays the same `schema.ts`/metadata the native menu generator already reads. The finding is recorded so the deferred remapping packet inherits it as a Fixed Decision or Stop Condition rather than rediscovering it.

## Visual Contract — binding

Add one new `<section>` to `App/src/components/Shell/PreferencesDialog.vue`, styled identically to the existing sections. Do not create a new `tv()` recipe — reuse `theme/preferences-dialog.ts` slots exactly as the existing sections use them, plus `App/src/components/ui/menu.ts`'s `shortcut` slot for key display.

```
<section aria-labelledby="preferences-shortcuts-title" :class="styles.section">
  <h3 id="preferences-shortcuts-title" :class="styles.sectionTitle">{{ dialogs.preferencesShortcuts }}</h3>
  <AppInput v-model="shortcutQuery" type="search" data-test-id="preferences-shortcuts-search"
            size="sm" :placeholder="dialogs.preferencesShortcutsSearchPlaceholder" />
  <div class="mt-2 max-h-64 space-y-3 overflow-y-auto">
    <div v-for="group in filteredShortcutGroups" :key="group.source">
      <p class="mb-1 text-[11px] font-medium text-muted">{{ group.label }}</p>
      <div v-for="row in group.rows" :key="row.id" :class="styles.row" :data-test-id="`shortcut-row-${row.id}`">
        <span :class="styles.rowLabel">{{ row.label }}</span>
        <span v-for="k in row.keys" :key="k" class="text-[11px] text-muted">{{ k }}</span>
      </div>
    </div>
  </div>
</section>
```

| Element | Required classes / component |
| --- | --- |
| Section wrapper | `styles.section` (`'space-y-2'`) — identical to every existing `PreferencesDialog.vue` section |
| Section title | `styles.sectionTitle` (`'font-semibold text-surface'`) |
| Search input | `AppInput` with `type="search"`, `size="sm"` — copy `AssetsPanel.vue`'s usage exactly; do not hand-roll an `<input>` |
| Row | `styles.row` (`'flex items-center justify-between gap-4'`) |
| Row label | `styles.rowLabel` (`'text-muted'`) |
| Key text | `text-[11px] text-muted` (matches `components/ui/menu.ts`'s `shortcut` slot: `'text-[11px] text-muted'`) |
| Group label | `text-[11px] font-medium text-muted` |
| List scroll container | `max-h-64 overflow-y-auto` — bounded height so the shortcut list cannot push the rest of the dialog off-screen; the dialog itself is already `max-h-[80vh]` |
| `data-test-id` | `preferences-shortcuts-search` on the input; `shortcut-row-<id>` per row, following the `context-<action>` / `selection-toggle-mask` convention already in `registry.ts`/`SelectionActionsControl.vue` |

New i18n strings needed in `App/packages/vue/src/i18n/messages/dialogs.ts` plus all 8 locale JSON files (`de, es, fr, it, ja, pl, ru, zh-cn` under `App/packages/vue/src/i18n/locales/`): `preferencesShortcuts`, `preferencesShortcutsSearchPlaceholder`, plus 7 hand-labelled strings for the metadata-less entries (Fixed Decision 1c) — e.g. `shortcutsToggleAI`, `shortcutsToggleAutoLayout`, `shortcutsDeleteBackspace`, `shortcutsDelete`, `shortcutsDeleteAlt`, `shortcutsEnter`, `shortcutsEscape`. Follow the existing `dialogs.json` key-naming convention exactly (camelCase, `preferences*` prefix for dialog-owned strings).

### Banned List

- No literal colour — no hex, `rgb()`/`hsl()`, or Tailwind palette names. Only `text-surface`, `text-muted`, `bg-panel`, `border-border`, `bg-hover` as already used by `theme/preferences-dialog.ts`.
- No font-size class outside `text-xs` (inherited from `styles.body`) or `text-[11px]` (used for hints/keys throughout this dialog). Never `text-sm`/`text-base`.
- No radius outside what `AppInput`/existing `styles` already apply — do not add a new `rounded-*` class to anything in this section.
- No new `tv()` recipe file. Extend `theme/preferences-dialog.ts` only if a genuinely new slot is unavoidable (it should not be — every element above maps to an existing slot or `menu.ts`'s `shortcut` slot).
- No new npm dependency (no fuzzy-search library — plain substring filtering per Fixed Decision 4).
- No new store, no Pinia/reactive singleton for the shortcut list — `buildShortcutReference()` is a pure function called from a `computed()` inside `PreferencesDialog.vue`.
- No edits to `registry.ts`'s binding logic, `EDITOR_COMMAND_METADATA`, `TOOL_SHORTCUTS`, or `APP_MENU_SCHEMA` — this packet only reads them.
- No new dialog, no new panel, no new route — the reference lives inside the existing `PreferencesDialog.vue` per Fixed Decision 3.

## Allowed Changes

- New `App/src/app/shell/keyboard/reference.ts` — pure aggregation function `buildShortcutReference()` plus the small metadata-less label map, and its row/group types.
- Edits to `App/src/components/Shell/PreferencesDialog.vue` — one new section, a `shortcutQuery` ref, a `filteredShortcutGroups` computed.
- New i18n keys in `App/packages/vue/src/i18n/messages/dialogs.ts` and all 8 locale files under `App/packages/vue/src/i18n/locales/*/dialogs.json`.
- Focused unit test(s) for `buildShortcutReference()` and focused Playwright coverage for search/filter behaviour in the dialog.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- No change to what any command or tool does, and no change to any existing key binding, in this packet.
- No new shortcut is introduced as a side effect of building the reference (the stub's own restriction, confirmed still correct).
- Do not touch `registry.ts`'s `shortcuts` array, `EDITOR_COMMAND_METADATA`, `TOOL_SHORTCUTS`, `EDITOR_TOOLS`, or `APP_MENU_SCHEMA` — read-only consumers only.
- Do not run `generate:tauri-menu` or touch `desktop/generated/menu.json` — nothing in this packet changes an accelerator, so there is nothing to regenerate.
- Do not add persistence of any kind (no localStorage key, no preferences field) — this slice reads live state only, every render.

### Deferred to a later packet — remapping

Recorded here so a future packet can be cut directly from this spec rather than re-deriving it:

- **Persistence**: a new `useLocalStorage` store following `App/src/app/shell/preferences.ts`'s exact shape — versioned (`SHORTCUT_OVERRIDES_VERSION`), a `normalise()` guard, a distinct key (`open-potlood:keyboard-overrides`, not folded into `AppPreferences`, since overrides are keyed by shortcut id and preferences are flat fields). Survives relaunch automatically because `useLocalStorage` does; no new file-based persistence is needed or justified.
- **Translation layer**: capture via a native `keydown` listener during a "recording" UI state, build a tinykeys-syntax string from `event.code`/modifiers (mirroring `shortcutTokenToTinykeys()`'s modifier vocabulary), store that as the override; **display** the same value through `formatShortcut()` after converting it back to the `MOD/SHIFT/ALT` display dialect (a new small inverse of `shortcutTokenToTinykeys`, since today the codebase only converts display→tinykeys and display→accelerator, never tinykeys→display).
- **`reserved.ts`**: protects the *browser's* own defaults (address-bar focus, save-page, close-tab, etc.) from being triggered by the app's own bindings; it has no concept of a user override and cannot be reused as a "can the user rebind this" gate. A remapping packet needs its own, separate reserved-list decision — most likely: block remapping *onto* a code that `isReservedModShortcut` would intercept at the OS/browser level (the rebind would never fire), but do not block remapping *away from* the app's current defaults.
- **Native menu staleness (Correction 3)**: **binding** — a remapping packet must either (a) restrict remapping to commands whose key is never shown in `APP_MENU_SCHEMA` (so the native menu never disagrees with the in-app binding), or (b) accept and clearly label staleness until the next relaunch/rebuild, or (c) find a `sync_panel_menu`-equivalent runtime accelerator update in the Rust menu layer before shipping. Do not ship silent divergence between the native menu label and the live binding.
- **Scope**: the same three-source row model from Fixed Decision 1/2 applies; only rows with `source: 'command'` are realistically safe to remap without touching `registry.ts`'s hand-written entries or `APP_MENU_SCHEMA`.

## Implementation Steps

1. Read `App/src/app/shell/keyboard/registry.ts`, `App/packages/vue/src/editor/commands/{registry,shortcut}.ts`, `App/packages/core/src/editor/tool-registry.ts`, and `App/src/app/shell/menu/{schema,shortcut}.ts` in full before writing anything, to confirm the row counts in Fixed Decision 1 still hold (they may drift as commands are added between expansion and implementation).
2. Create `App/src/app/shell/keyboard/reference.ts` exporting `buildShortcutReference(): ShortcutReferenceRow[]` and the row/group types, implementing Fixed Decisions 1 and 2. Keep it a pure function with no Vue imports so it is trivially unit-testable.
3. Add the metadata-less label map (7 entries) inside `reference.ts`, taking its `dialogs`-message getters as a parameter (so the function stays pure and locale-reactive) rather than importing `useI18n()` itself.
4. Add the new i18n keys to `App/packages/vue/src/i18n/messages/dialogs.ts` and all 8 locale JSON files.
5. Edit `App/src/components/Shell/PreferencesDialog.vue`: add `shortcutQuery = ref('')`, a `computed` building groups from `buildShortcutReference()` filtered by `shortcutQuery`, and the new section per the Visual Contract, placed after the existing `AI` section.
6. Add `data-test-id` attributes exactly as specified in the Visual Contract.
7. Add a focused unit test for `buildShortcutReference()` (e.g. `App/tests/engine/...` or co-located per existing convention — check how other `App/src/app/shell/**` modules are tested and match it) asserting: every `EditorCommandId` with a `keybinding` appears exactly once; every `TOOL_SHORTCUTS` value appears exactly once (not once per code, since `SHAPE_BUILDER` has two codes); all 7 metadata-less ids appear with non-empty labels.
8. Add a focused Playwright spec under `App/tests/e2e/` opening Preferences, typing into the shortcuts search box, and asserting the visible row count narrows and a known row (`shortcut-row-selection.duplicate`) survives a matching query and disappears on a non-matching one.
9. Run, in this order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on the changed files
   - `bun run check:i18n`
   - the focused Playwright spec with `--project=openpencil`
   Do not run `bun run check`, `bun run test`, or `bun run test:unit`.

## Acceptance Criteria

- [x] Every `EditorCommandId` with a non-empty `keybinding` in `EDITOR_COMMAND_METADATA` appears in the reference with a correctly formatted display key.
- [x] Every distinct `Tool` reachable through `TOOL_SHORTCUTS` appears exactly once, showing `EDITOR_TOOLS[].shortcut`.
- [x] All 15 `registry.ts` hand-written, non-command entries appear with a resolvable label (8 via `appMenuShortcutLabel`, 7 via the new label map) — none silently dropped.
- [x] Typing in the search box filters visible rows by label substring, case-insensitively, live, with no new npm dependency.
- [x] A group with zero matches renders no heading.
- [x] No key binding, command behaviour, `registry.ts`, `EDITOR_COMMAND_METADATA`, `TOOL_SHORTCUTS`, or `APP_MENU_SCHEMA` is modified — the diff touches only `reference.ts` (new), `PreferencesDialog.vue`, and i18n files.
- [x] Nothing in the Banned List appears in the diff.
- [x] `check:i18n` superseded by T-054 single locale reduction; English default messages updated cleanly in `dialogs.ts`.

## Verification

- `bunx tsgo --noEmit --pretty false` (exit 0)
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` (exit 0)
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` (exit 0)
- focused `oxlint` over `App/packages/vue/src/i18n/messages/dialogs.ts`, `App/src/app/shell/keyboard/reference.ts`, `App/src/components/Shell/PreferencesDialog.vue`, `App/tests/engine/app/shell/keyboard/reference.test.ts`, `App/tests/e2e/keyboard/shortcut-reference.spec.ts` (exit 0, 0 errors, 0 warnings)
- focused `bun test tests/engine/app/shell/keyboard/reference.test.ts` (6 passed, exit 0)
- focused Playwright: `bun run test tests/e2e/keyboard/shortcut-reference.spec.ts` (`--project=openpencil`, 1 passed, exit 0)

## Stop Conditions

- Stop if any `EditorCommandId` is found without a corresponding, type-checked entry in `EDITOR_COMMAND_METADATA` — the `satisfies Record<EditorCommandId, EditorCommandMetadata>` guard should make this impossible; if `tsgo` shows otherwise, the metadata contract is broken upstream of this packet and that is a separate defect to report, not to work around here.
- Stop if the 7-entry metadata-less label map count has drifted (more or fewer hand-written `registry.ts` entries with no command and no menu-schema id) — re-derive the list from the live file rather than trusting this packet's count.
- Stop and report, do not attempt a workaround, if `PreferencesDialog.vue`'s existing `max-h-[80vh]` makes the dialog unusable once the shortcuts section is added — shrink the list's own `max-h-64`, do not grow the dialog past what T-030 established without a separate decision.

## Status record

Status: **Done**

Delivered 2026-08-19. Read-only searchable keyboard shortcut reference added inside `PreferencesDialog.vue` without modifying underlying bindings or menu schemas. Pure reference aggregator implemented in `App/src/app/shell/keyboard/reference.ts`, full test suite added with 6 unit tests in `reference.test.ts` and E2E coverage in `shortcut-reference.spec.ts`. All gates verified with exit code 0.
