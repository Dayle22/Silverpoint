# T-054 - Reduce the app and the docs site to a single English locale

Task ID: T-054
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: nothing
Related: T-055 (shortcut reference - reads the same `menu`/`commands` message defaults), T-057 (removes other inherited upstream surfaces)
Raised: 2026-08-14 (user request batch 2)
Expanded at: 2026-08-14
Scope decision taken during expansion: the user chose **app + docs in one packet**, so the six translated documentation trees in `packages/docs` are in scope alongside the eight app locales.

## Intended Outcome

OpenPotlood ships and documents itself in English only.

- The eight inherited UI translations are gone from the source tree, and so is the View > Language chooser that offered them.
- A machine that still has `open-pencil-locale = 'ja'` in `localStorage` from an earlier build launches in English with no blank labels and no error.
- The six translated documentation trees are gone from `packages/docs`, and the docs site builds as a single-locale English site.
- No future feature has to author, translate, or pass a gate on eight extra sets of strings: `check:i18n` and the locale-directory clause in the architecture rules are removed with the content they policed.
- Every English string reads exactly as it does today.

## Verified Starting State

Verified against the working tree on 2026-08-14. Line numbers are from that read; re-check before editing, but the named files and symbols are stable anchors.

### A. English does not live in `locales/` - confirmed

English comes from the message definitions, not from a locale directory. `packages/vue/src/i18n/messages/` holds seven files (`commands.ts` 41 lines, `dialogs.ts` 220, `menu.ts` 70, `pages.ts` 12, `panels.ts` 254, `tools.ts` 21, `variable-types.ts` 14). Each declares a `*MessageDefaults` literal of plain English strings and passes it to `i18n(...)` from `#vue/i18n/create`. `packages/vue/src/i18n/messages.ts` re-exports them and aggregates `messageDefaults`.

`packages/vue/src/i18n/locales/` contains **64 files**: eight directories (`de es fr it ja pl ru zh-cn`), each with `commands.json`, `dialogs.json`, `menu.json`, `pages.json`, `panels.json`, `tools.json`, `variable-types.json` and an `index.ts` that imports the seven JSON files and default-exports them as a `ComponentsJSON`. There is no `en` directory.

**The first stop condition in the brief is therefore satisfied and does not need re-checking: deleting `locales/` cannot remove an English string.**

### B. The locale module - `packages/vue/src/i18n/locale.ts` (63 lines, read in full)

Exports, in order: `AVAILABLE_LOCALES` (9 entries), `type Locale`, `type TranslatedLocale = Exclude<Locale, 'en'>`, `TRANSLATED_LOCALES` (8), `LOCALE_DIR_NAMES` (8, the `zh-CN` → `zh-cn` casing map), `LOCALE_LABELS` (9), `localeSetting`, `locale`, `setLocale`.

The runtime shape is:

```
export const localeSetting = atom<Locale | undefined>(undefined)
export const locale = localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))
...
const saved = getLocalStorage()?.getItem(LOCALE_STORAGE_KEY) as Locale | null | undefined
if (saved && AVAILABLE_LOCALES.includes(saved)) localeSetting.set(saved)
```

`LOCALE_STORAGE_KEY = 'open-pencil-locale'`.

**This already answers the brief's stored-`ja` question.** Once `AVAILABLE_LOCALES` is `['en']`, `AVAILABLE_LOCALES.includes('ja')` is false, `localeSetting` stays `undefined`, `localeFrom` falls through to `browser({ available: ['en'] })`, and `browser` resolves `'en'` because it is the only candidate. The UI cannot blank. **The `includes` guard is what makes this safe and must not be removed or loosened.**

### C. Consumers of the locale exports - the full list

`grep` for `AVAILABLE_LOCALES|TRANSLATED_LOCALES|LOCALE_DIR_NAMES|LOCALE_LABELS|setLocale|localeSetting|availableLocales|localeLabels|open-pencil-locale` across the tree, excluding `node_modules`, `dist`, `desktop/target`, `test-results` and `output`:

| File | Use |
| --- | --- |
| `packages/vue/src/i18n/locale.ts` | declaration |
| `packages/vue/src/i18n/create.ts` | `localeLoaders` - eight dynamic `import('#vue/i18n/locales/<dir>')` entries typed `satisfies Record<TranslatedLocale, ...>` |
| `packages/vue/src/i18n/useI18n.ts:5,77-79` | `useI18n()` returns `availableLocales`, `localeLabels`, `setLocale` |
| `packages/vue/src/i18n/index.ts:15-21` | barrel re-export of all eight symbols plus both types |
| `packages/vue/src/index.ts:330-335` | package public surface re-export |
| `src/app/shell/menu/app-menu.ts:34,71-79` | destructures `availableLocales, localeLabels, setLocale`; builds `languageMenu`; `buildEntry` special-cases `entry.id === 'language'` |
| `tools/i18n/src/check-locales.ts:7-8,49,55-65` | the `check:i18n` gate |
| `tools/architecture/src/steiger-rules/index.ts:452` | `no-shortcut-text-in-labels` also scans `packages/vue/src/i18n/locales/` |
| `packages/vue/README.md:213-216` | documents `locale`, `localeSetting`, `setLocale()`, `AVAILABLE_LOCALES`, `LOCALE_LABELS` |
| `packages/docs/programmable/sdk/api/composables/use-i18n.md` | documents `availableLocales` / `localeLabels` / `setLocale` with a `<select>` picker example |
| `packages/docs/programmable/sdk/api/advanced/locale-apis.md` | documents the locale APIs |
| `tests/engine/app/shell/menu/window-panels.test.ts:41-42` | mocks `useI18n()` with `availableLocales: []`, `localeLabels: {}` |

Nothing outside `App/` consumes them; `Toolbox/` is historical material, not live source. **`TRANSLATED_LOCALES`, `TranslatedLocale` and `LOCALE_DIR_NAMES` have exactly two real consumers - `create.ts` and `tools/i18n` - and both are removed by this packet.**

### D. The language chooser - browser-only, already absent from the native menu

`src/app/shell/menu/schema.ts:153`: `{ id: 'language', label: 'Language', target: 'browser' }`, inside the View group between the Canvas Grid submenu and the separator before `reset-panel-layout`.

`tools/tauri-menu/src/generate.ts` filters with `isNativeVisible(entry) { return entry.target !== 'browser' }`, so `language` is already excluded from `desktop/generated/menu.json`. `grep -n "anguage" desktop/generated/menu.json` returns nothing.

**This corrects the brief's last expansion question: `generate:tauri-menu` does not emit localised labels and the native menu artefact is not affected by this packet.** T-031's "eight-locale panel/reset labels" referred to the `panels.json` / `menu.json` entries inside each locale directory, which this packet deletes wholesale.

`src/app/shell/menu/app-menu.ts:206-208` renders it:

```
if (entry.id === 'language') {
  return { label: menuLabel(entry), sub: languageMenu.value }
}
```

with `translatedMenuItemLabels` mapping `language: 'language'` (line 50) onto `menuMessageDefaults.language = 'Language'` (`packages/vue/src/i18n/messages/menu.ts:30`).

**There is no language control in Preferences.** `grep` over `src/app/shell/preferences.ts` and `src/app/shell/keyboard/` finds no locale reference. The menu entry is the only chooser.

### E. The gates

- `check:i18n` = `bun tools/i18n/src/check-locales.ts`, and `check` = `build:packages && lint && tsgo --noEmit && check:vue && check:i18n`. So it gates every delivery.
- `tools/i18n/` is two files: `package.json` (`@open-pencil/i18n-tools`, private, no `scripts`) and `src/check-locales.ts` (129 lines). It imports `LOCALE_DIR_NAMES`, `TRANSLATED_LOCALES`, `messageDefaults` and `type TranslatedLocale` from `@open-pencil/vue`, then cross-checks the directory listing and every JSON key against `messageDefaults`. With `locales/` gone it has nothing to validate.
- `tools/test.ts` (`test:tools`) enumerates `tools/*/package.json` and runs `bun test` only where a `test` script exists. `tools/i18n/package.json` has none, so deleting the directory is invisible to it.
- The `open-pencil/strict-tools-layout` steiger rule (`tools/architecture/src/steiger-rules/index.ts:65-74`) constrains what may live under `tools/`; removing a whole tool folder does not trip it.
- `check:deps` is `knip --include unlisted,unresolved,binaries` - it reports unlisted/unresolved/binaries only, **not** unused exports, so narrowing the locale exports cannot fail it.
- `packages/docs` is covered by **no** gate in `check`: `lint`, `lint:structure`, `format` and the root `tsconfig.json` `include` (`src/**/*.ts`, `src/**/*.vue`) all omit it. Its only build is `bun run docs:build` → `vitepress build` in `packages/docs`.

### F. The docs site - `packages/docs`

- Translated content: `de/ es/ fr/ it/ pl/ ru/`, **109 files each, 654 files total**. There are no `ja` or `zh-cn` docs, so the docs locale set and the app locale set are different sets - do not assume one mirrors the other.
- **Each locale tree is a strict subset of the English tree.** Comparing every locale's relative paths against the English content (`guide/ user-guide/ programmable/ reference/ development/ index.md`, 135 files) gives zero paths present in a locale but missing in English, for all six locales. No unique content is lost by deleting them; the English tree is 26 files ahead.
- `.vitepress/locales.ts` (136 lines) exports `docsLocales`: a `root` entry (`label: 'English'`, `lang: 'en'`, no `themeConfig`) plus six locale entries, each calling `localeThemeConfig(prefix, navLabels, SIDEBAR, PROG)`.
- `.vitepress/locale-theme.ts` (38 lines) exports `localeThemeConfig`, used **only** by `locales.ts`.
- `.vitepress/labels.ts` (301 lines) exports interfaces `SidebarLabels`, `ProgrammableLabels`, `NavLabels`, and fourteen constants: `EN/DE/IT/FR/ES/PL/RU` and `EN_PROG/DE_PROG/IT_PROG/FR_PROG/ES_PROG/PL_PROG/RU_PROG`. `NavLabels` is referenced **only** by `locale-theme.ts`.
- `.vitepress/root-theme.ts` (52 lines) is the English theme and imports only `EN` and `EN_PROG`.
- `.vitepress/seo.ts` (121 lines) exports `BASE`, `LOCALE_PREFIXES = ['de','fr','es','it','pl','ru']`, `LOCALES` (7 entries incl. `en`), `siteHead`, `withAlternateSitemapLinks`, `applyPageSeo`, and private helpers `stripLocalePrefix`, `localeKeyForPath`, `slugForPath`, `localizedUrl`.
- `.vitepress/config.ts` uses `docsLocales` (line 76), `LOCALE_PREFIXES` (inside the `llmstxt` plugin's `ignoreFiles`), `withAlternateSitemapLinks` (`sitemap.transformItems`) and `applyPageSeo` (`transformPageData`).
- `.vitepress/sidebars.ts` and `.vitepress/sdk-sidebar.ts` take a `prefix` argument and contain no hard-coded locale paths.

**Note on `seo.ts` if the prefixes are merely emptied instead of removed:** `stripLocalePrefix` builds `new RegExp("^(" + LOCALE_PREFIXES.join('|') + ")/")`. With an empty array that becomes `/^()\//`, a live regex that matches a leading slash. It would not currently misfire (VitePress `relativePath` has no leading slash), but it is a trap. Decision 6 removes the machinery rather than emptying it.

## Fixed Decisions

Binding. Do not substitute judgement for these.

1. **Keep the i18n plumbing; delete only the translations.**
   `@nanostores/i18n` stays a dependency of `@open-pencil/vue` and every `i18n(...)` message definition in `packages/vue/src/i18n/messages/` stays exactly as it is. No component changes, no `useI18n()` signature change, no string inlining. The brief asked expansion to justify anything more aggressive; nothing here justifies it, and inlining would touch hundreds of call sites for zero user-visible gain.

2. **`AVAILABLE_LOCALES` narrows to `['en']`; `TRANSLATED_LOCALES`, `TranslatedLocale` and `LOCALE_DIR_NAMES` are deleted.**
   `Locale` becomes `'en'`. `LOCALE_LABELS` keeps only `en: 'English'`. `locale`, `localeSetting`, `setLocale`, `AVAILABLE_LOCALES` and `LOCALE_LABELS` **stay exported** from `packages/vue/src/i18n/index.ts` and `packages/vue/src/index.ts` - narrowing a type is a smaller boundary change than removing symbols, `useI18n()` keeps its shape, and `tests/engine/app/shell/menu/window-panels.test.ts` keeps working unedited. Removing the three translation-only symbols is safe because C proves their only consumers are deleted by this packet.

3. **The storage guard and the fallback chain are unchanged.**
   `LOCALE_STORAGE_KEY`, the `getLocalStorage()` null-safety, the `AVAILABLE_LOCALES.includes(saved)` guard and `localeFrom(localeSetting, browser({ available: AVAILABLE_LOCALES }))` all stay. Do **not** add migration code to clear or rewrite a stale `open-pencil-locale` value - B proves the existing guard already degrades to English cleanly, and a migration would be new code to maintain for a value nothing reads.

4. **`create.ts` keeps `createI18n` and loses the loaders.**
   Delete the `localeLoaders` map and the `TranslatedLocale` import. The `get` callback becomes an unconditional empty-components return, so `baseLocale: 'en'` always wins:

   ```
   export const i18n = createI18n<Locale, 'en'>(locale, {
     baseLocale: 'en',
     async get() {
       return {}
     }
   })
   ```
   Keep the `createI18n<Locale, 'en'>` generic form and the `ComponentsJSON` typing so the message definitions type-check unchanged.

5. **The Language menu entry is removed, not left as a one-item submenu.**
   Delete the schema entry, the `language` case in `buildEntry`, the `languageMenu` computed, the `language:` row in `translatedMenuItemLabels`, and the now-unused `availableLocales`/`localeLabels`/`setLocale`/`locale` destructuring in `app-menu.ts`. `menuMessageDefaults.language` is deleted too - it is a label for a control that no longer exists. **This is the one permitted English-string deletion; it is a removal, not a rewording.**

6. **The docs site becomes single-locale by removing the multi-locale machinery, not by emptying it.**
   - Delete `packages/docs/{de,es,fr,it,pl,ru}` (654 files).
   - Delete `.vitepress/locales.ts` and `.vitepress/locale-theme.ts`; drop `import { docsLocales }` and the `locales: docsLocales` key from `config.ts`. VitePress treats a config with no `locales` as a single-locale site, which is exactly the current `root` entry.
   - In `.vitepress/labels.ts`, delete `DE/IT/FR/ES/PL/RU`, `DE_PROG/IT_PROG/FR_PROG/ES_PROG/PL_PROG/RU_PROG` and the `NavLabels` interface. Keep `SidebarLabels`, `ProgrammableLabels`, `EN` and `EN_PROG`.
   - In `.vitepress/seo.ts`, delete `LOCALE_PREFIXES`, `LOCALES`, `stripLocalePrefix`, `localeKeyForPath` and `localizedUrl`. `applyPageSeo` emits `canonical`, `og:url`, `og:locale: 'en_US'`, the title/description tags and nothing else - no `hreflang`, no `og:locale:alternate`, no `x-default`. Delete `withAlternateSitemapLinks` and the `sitemap.transformItems` line in `config.ts`; keep `sitemap.hostname`. Replace the `llmstxt` `ignoreFiles: LOCALE_PREFIXES.map(...)` with `ignoreFiles: []` or drop the key.
   - `sidebars.ts` and `sdk-sidebar.ts` are **not** edited: they keep their `prefix` parameter, called with `''` from `root-theme.ts` as today.

7. **`check:i18n` and `tools/i18n/` are deleted outright, not reduced to an absence assertion.**
   Remove the `check:i18n` script from `package.json` and its `&& bun run check:i18n` from the `check` chain; delete `tools/i18n/`. A gate whose entire job would be "assert that a deleted directory is still deleted" is the maintenance cost this packet exists to remove.

8. **The `no-shortcut-text-in-labels` steiger rule survives, minus its locales clause.**
   In `tools/architecture/src/steiger-rules/index.ts:449-454`, delete only `&& !sourceRel.startsWith('packages/vue/src/i18n/locales/')`, leaving the `messages.ts` and `messages/` checks intact. Those files are now the sole home of every user-visible string, so the rule matters more after this packet, not less.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT change any English wording.** No copy edits, no capitalisation fixes, no "while I'm here" improvements to `messages/*.ts` or to any English `.md` under `packages/docs`. The single permitted deletion is `menuMessageDefaults.language` (decision 5).
- **Do NOT remove `@nanostores/i18n` or `@nanostores/vue`** from `packages/vue/package.json`, and do not inline message defaults into components.
- **Do NOT delete `locale`, `localeSetting`, `setLocale`, `AVAILABLE_LOCALES` or `LOCALE_LABELS`** from either barrel. Narrowing only (decision 2).
- **Do NOT touch `packages/vue/src/i18n/messages/` or `messages.ts`** beyond the one `language` key.
- **Do NOT add locale-migration or `localStorage`-cleanup code** (decision 3).
- **Do NOT edit `desktop/generated/menu.json` or run `generate:tauri-menu`.** D proves the native menu artefact is unaffected; if a diff appears there, something else changed and that is a stop condition.
- **Do NOT edit `App/CHANGELOG.md` historical entries.** Lines 376-406 and 562 record the locale features as shipped history and stay accurate as history.
- **Do NOT edit `Toolbox/upstream-open-pencil-master/`** or anything else under `Toolbox/`.
- **Do NOT bump versions or build/install the desktop app.** Delivery policy: packets stop at source gates.
- **Do NOT run `bun run check:upstream`, `bun run test`, or the full Playwright suite.** Use the gates under Acceptance.
- **Do NOT rename `open-pencil-locale`** to an OpenPotlood-branded key. It is a live storage key; renaming it is a separate, unrequested change.
- **Do NOT restructure `packages/docs` beyond locale removal.** No sidebar reorganisation, no rewriting `sidebars.ts`/`sdk-sidebar.ts` to drop their `prefix` parameter, no content edits.

## Implementation Steps

Land in order. Steps 1-5 are the app; steps 6-7 are the docs site; they are independent halves and either can be verified alone.

1. **Narrow the locale module** - `packages/vue/src/i18n/locale.ts`
   - `AVAILABLE_LOCALES = ['en'] as const`.
   - Delete `TranslatedLocale`, `TRANSLATED_LOCALES`, `LOCALE_DIR_NAMES`.
   - `LOCALE_LABELS: Record<Locale, string> = { en: 'English' }`.
   - Everything else in the file is untouched.

2. **Simplify the i18n factory** - `packages/vue/src/i18n/create.ts` per decision 4.

3. **Delete the translations** - remove `packages/vue/src/i18n/locales/` entirely (all 64 files, all eight directories).

4. **Update the barrels** - `packages/vue/src/i18n/index.ts` and `packages/vue/src/index.ts`: drop `TRANSLATED_LOCALES`, `LOCALE_DIR_NAMES` and the `TranslatedLocale` type from the re-export lists. Leave the remaining locale exports and every other export untouched.

5. **Remove the language chooser**
   - `src/app/shell/menu/schema.ts:153` - delete the `language` entry. Leave the surrounding separator structure of the View group as it is.
   - `src/app/shell/menu/app-menu.ts` - delete the `languageMenu` computed (71-79), the `entry.id === 'language'` branch in `buildEntry`, the `language: 'language'` row in `translatedMenuItemLabels`, and narrow line 34 to `const { menu, panels } = useI18n()`. Verify `locale` is not used elsewhere in the file before dropping it from the destructuring.
   - `packages/vue/src/i18n/messages/menu.ts` - delete the `language: 'Language'` key.
   - `packages/vue/src/i18n/useI18n.ts` - leave as is; `availableLocales`/`localeLabels`/`setLocale` remain part of the public composable (decision 2).

6. **Retire the i18n gate and the locales rule clause**
   - `package.json` - delete the `check:i18n` script and remove `&& bun run check:i18n` from `check`.
   - Delete `tools/i18n/`.
   - `tools/architecture/src/steiger-rules/index.ts:452` - delete the locales clause only (decision 8).

7. **Reduce the docs site to English** - per decision 6, in this order so the tree never references a deleted file: edit `config.ts` first, then `seo.ts` and `labels.ts`, then delete `locales.ts` and `locale-theme.ts`, then delete the six content trees.

8. **Update the SDK documentation to match the narrowed surface**
   - `packages/vue/README.md:213-216` - keep the entries for `locale`, `localeSetting`, `setLocale()`, `AVAILABLE_LOCALES`, `LOCALE_LABELS` (all still exported) and add nothing; they are already accurate. Only edit if a listed symbol was removed.
   - `packages/docs/programmable/sdk/api/advanced/locale-apis.md` and `packages/docs/programmable/sdk/api/composables/use-i18n.md` - the APIs still exist but now offer one locale. Replace the `<select>` locale-picker example with a note that the app ships a single English locale and that these exports exist for custom shells. Keep the edit minimal and factual; do not delete the pages.

## Acceptance Criteria

- [ ] `App/packages/vue/src/i18n/locales/` does not exist, and `grep -rn "i18n/locales" App/src App/packages/vue/src App/tools App/vite` returns nothing.
- [ ] `grep -rn "TRANSLATED_LOCALES\|LOCALE_DIR_NAMES\|TranslatedLocale"` over `App/src`, `App/packages/*/src`, `App/tools` and `App/tests` returns nothing (`packages/*/dist` is stale build output and is expected to still match until the next `build:packages`).
- [ ] `AVAILABLE_LOCALES` is `['en']`, `LOCALE_LABELS` has one key, and `locale`, `localeSetting`, `setLocale`, `AVAILABLE_LOCALES`, `LOCALE_LABELS`, `Locale` are all still exported from `@open-pencil/vue`.
- [ ] The View menu has no Language item in the browser build, and `desktop/generated/menu.json` is byte-identical to its pre-change state.
- [ ] With `localStorage['open-pencil-locale'] = 'ja'` set before load, the app renders English throughout and logs no error; the same holds with the key absent and with `navigator.language` set to a non-English value.
- [ ] Every other English label in the menus, panels and dialogs is unchanged from before the packet.
- [ ] `package.json` has no `check:i18n` script, `check` no longer invokes it, and `App/tools/i18n/` does not exist.
- [ ] `packages/docs/{de,es,fr,it,pl,ru}` do not exist; `.vitepress/locales.ts` and `.vitepress/locale-theme.ts` do not exist; `grep -rn "docsLocales\|localeThemeConfig\|LOCALE_PREFIXES\|NavLabels" packages/docs` returns nothing.
- [ ] `bun run docs:build` completes and the built site has an English-only nav with no language switcher and no `hreflang` alternates.
- [ ] Focused gates green: `bun run build:packages`, `tsgo --noEmit`, `vue-tsc --noEmit -p tsconfig.json`, `vue-tsc --noEmit -p packages/vue/tsconfig.json`, and `oxlint -c oxlint.json` over `src/`, `packages/vue/src/` and `tools/`.
- [ ] `bun test tests/engine/app/shell/menu/window-panels.test.ts` passes **without editing the test file**.
- [ ] No version bump, no desktop build, no NSIS install.

## Stop Conditions

- Stop if any English string turns out to be sourced from a locale directory after all. A is strong evidence it is not, but a single missing key would mean the removal changes what the user sees.
- Stop if narrowing `Locale` to `'en'` produces type errors **inside `packages/*/src`** rather than only in app code - that would mean a package boundary depends on the wider union, which `AGENTS.md` requires preserving.
- Stop if `@nanostores/i18n`'s `browser({ available: ['en'] })` does not resolve `'en'` for a non-English `navigator.language`; the fallback in decision 3 would be wrong and the whole storage story needs rethinking before proceeding.
- Stop and report if `desktop/generated/menu.json` differs after the change.
- Stop if `bun run docs:build` already fails on the untouched tree. Record the pre-existing failure in the completion note, verify the docs half structurally instead (deleted trees, no dangling references, no unresolved imports), and do not attempt to repair an unrelated docs build inside this packet.
- Stop if a locale tree under `packages/docs` turns out to hold a page with no English counterpart. F records this as already checked and clean for all six, so a hit means the tree changed since expansion.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-15: 64 app locale files and 654 docs translation files removed; View > Language chooser and check:i18n gate retired; steiger rule updated; AVAILABLE_LOCALES narrowed to ['en'] while preserving exported public surface and fallback guard; build:packages, tsgo, check:vue, focused oxlint, and 3/3 Bun window-panels tests green)
