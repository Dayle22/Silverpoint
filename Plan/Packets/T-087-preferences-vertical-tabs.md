# T-087 - Preferences vertical tab navigation

Task ID: T-087
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-030 (Done)
Related: T-005, T-029, T-055
Prepared from: user request on 2026-08-24 — "add a packet to edit preferences, instead of everything being on one menu, rather have vertical tabs"
Expanded at: 2026-08-24 08:12 Africa/Johannesburg
Expanded against: `App/src/components/Shell/PreferencesDialog.vue` (385 lines, read in full), `App/src/theme/preferences-dialog.ts`, `App/src/app/shell/preferences.ts`, `App/src/components/ui/dialog.ts`, `App/src/theme/segmented-control.ts`, `App/src/components/variables/VariablesDialog.vue` (live reka-ui `Tabs*` usage), `App/packages/vue/src/i18n/messages/dialogs.ts`, `App/vite/aliases.ts`, `App/vite.config.ts`, `App/package.json` scripts, `App/node_modules/reka-ui/dist/index3.d.ts` (`TabsRootProps`), `App/tests/e2e/keyboard/shortcut-reference.spec.ts`, `App/tests/e2e/canvas/grid.spec.ts`, `App/tests/engine/app/shell/theme.test.ts`
Delivery: named source gates + browser check
Execution size: 5 core implementation files; 4 test files across 2 suites (1 new Bun test, 1 new Playwright spec, 2 updated Playwright specs); no split — one responsibility (navigation shell of one dialog), no new persisted state.

## Intended Outcome

The Preferences dialog stops being one long scrolling column of six stacked `<section>` blocks. A vertical
tab rail on the left lists the six preference groups; the right pane shows only the selected group's
controls. Every existing control, label, `aria-label`, `data-test-id`, persistence path and reset behaviour
is unchanged — this packet moves sections into tab panels and adds the rail, nothing else.

## Request Coverage

- "instead of everything being on one menu, rather have vertical tabs" — replace the single stacked body of
  `PreferencesDialog.vue` with a left vertical tab rail plus a single visible content pane.
- Applies to Preferences (`Edit ▸ Preferences`, `openPreferences()`), not to any other dialog.

## Verified Starting State

| Path | Symbol / selector | Current fact (verified) |
| --- | --- | --- |
| `src/components/Shell/PreferencesDialog.vue` | whole file, 385 lines | Script block lines 1–177, template 179–385. One `DialogContent`, one `div :class="styles.body"` holding six sibling `<section>` elements. |
| `src/components/Shell/PreferencesDialog.vue` | `const cls = useDialogUI({ content: 'flex max-h-[80vh] w-[560px] max-w-[92vw] flex-col overflow-hidden' })` (line 33) | Fixed 560px dialog, column flex. |
| `src/components/Shell/PreferencesDialog.vue` | `const slots = tv(theme)()` + `const styles = {…}` (lines 34–57) | Every class string is resolved once into a plain `styles` object. New slots must be added to that object the same way. |
| `src/components/Shell/PreferencesDialog.vue` | `<section aria-labelledby="preferences-appearance-title">` (195), `…-canvas-title` (209), `…-guides-title` (275), `…-capabilities-title` (302), `…-ai-title` (332), `…-shortcuts-title` (347) | The six groups, in this order, each with an `<h3>` bearing the matching id. These `aria-labelledby` sections give the `region` role that `tests/e2e/canvas/grid.spec.ts` asserts on (`getByRole('region', { name: 'AI' })`). |
| `src/components/Shell/PreferencesDialog.vue` | footer `div :class="styles.footer"` (368–375) | Global `Reset app preferences` button + `Done` `DialogClose`. Stays global, below both rail and pane. |
| `src/theme/preferences-dialog.ts` | `preferencesDialogTheme.slots` (29 lines) | Slots: `header, headerTitle, headerDescription, closeButton, body, section, sectionTitle, row, rowLabel, unit, hint, warning, capabilityValue, capabilityWarning, capabilityOk, footer, resetButton, doneButton, numberInput, colourInput`. `body: 'flex-1 space-y-4 overflow-y-auto p-4 text-xs'`. |
| `src/app/shell/preferences.ts` | `preferencesOpen = ref(false)` (48), `openPreferences()` (50), `appPreferences` (49), `resetAppPreferences()` (70–73), `PREFERENCES_VERSION = 1` (4) | Persisted record holds only `version`, `uiScale`, `hardwareAcceleration`. `normalise()` (26–34) drops unknown keys. |
| `src/app/shell/menu/app-menu.ts:116`, `src/app/shell/menu/use.ts:114` | `preferences: openPreferences` | `openPreferences` is registered as a bare zero-argument callback in two action maps. Its signature must not gain a required parameter. |
| `src/components/variables/VariablesDialog.vue` | `TabsRoot / TabsList / TabsTrigger / TabsContent` imported from `reka-ui` (lines 23–26), used at 143–168 | The authoritative in-repo reka-ui Tabs pattern. Its trigger class string (line 162) is horizontal; this packet's rail adapts it. |
| `node_modules/reka-ui/dist/index3.d.ts:9068–9096` | `interface TabsRootProps` | Supports `orientation?: DataOrientation` (`'vertical'`), `activationMode?: 'automatic' \| 'manual'`, `modelValue`, `unmountOnHide` (default `true`). `reka-ui` is `^2.9.0` (`package.json:102`). |
| `src/theme/segmented-control.ts:6` | `item` slot | Authoritative selected/focus token usage: `bg-panel-selected-muted`, `focus-visible:ring-1 focus-visible:ring-panel-focus`, `hover:bg-hover hover:text-surface`, `text-muted`. |
| `packages/vue/src/i18n/messages/dialogs.ts` | `dialogMessageDefaults` (5–…) then `dialogMessages = i18n('dialogs', dialogMessageDefaults)` (239) | Single English dictionary object; no other locale file exists. Existing keys already cover all six tab labels: `preferencesAppearance` (149), `preferencesCanvasDisplay` (158), `preferencesGuides` (168), `preferencesCapabilities` (175), `preferencesAI` (189), `preferencesShortcuts` (196). |
| `vite/aliases.ts:39–41` | `@open-pencil/vue` → `packages/vue/src` | The app consumes the i18n dictionary from source; no package rebuild is needed after adding a key. |
| `vite.config.ts:34–35` | `Icons({ compiler: 'vue3' })` + `IconsResolver({ prefix: 'icon' })` | `<icon-lucide-*>` components auto-resolve. Verified present in `@iconify-json/lucide`: `palette`, `grid-2x2`, `ruler`, `cpu`, `sparkles`, `keyboard`. |

Exact new module contract to implement (copy verbatim):

```ts
// src/app/shell/preferences-sections.ts
export const PREFERENCES_SECTION_IDS = [
  'appearance',
  'canvas',
  'guides',
  'capabilities',
  'ai',
  'shortcuts'
] as const

export type PreferencesSectionId = (typeof PREFERENCES_SECTION_IDS)[number]

export const DEFAULT_PREFERENCES_SECTION: PreferencesSectionId = 'appearance'

export function normalisePreferencesSection(value: unknown): PreferencesSectionId
```

Exact new export to add to `src/app/shell/preferences.ts`:

```ts
export const preferencesSection = ref<PreferencesSectionId>(DEFAULT_PREFERENCES_SECTION)
export function setPreferencesSection(value: unknown): void // assigns normalisePreferencesSection(value)
```

## Read First

1. `src/components/Shell/PreferencesDialog.vue` — the full template, lines 179–385 (the six `<section>` blocks are moved unmodified).
2. `src/theme/preferences-dialog.ts` — the whole 29-line slots object.
3. `src/components/variables/VariablesDialog.vue` lines 23–26 and 143–168 — the reka-ui Tabs import and usage shape.
4. `src/app/shell/preferences.ts` lines 46–56 — `preferencesOpen`, `appPreferences`, `openPreferences`.
5. `tests/e2e/canvas/grid.spec.ts` lines 48–78 and `tests/e2e/keyboard/shortcut-reference.spec.ts` (57 lines) — the two specs this change breaks.

Do not open `src/components/ui/AppSelect.vue`, `AppCheckbox.vue`, `AppInput.vue`, or `src/app/shell/keyboard/reference.ts`: their usage is already correct in the template and is moved verbatim.

## Corrections to the Brief

None. The user's premise is accurate: `PreferencesDialog.vue` currently renders all six groups stacked in one
scrolling body with no navigation.

## Fixed Decisions

1. **Use reka-ui `TabsRoot` with `orientation="vertical"`**, not a hand-rolled button list. Justification:
   `VariablesDialog.vue:143–168` already establishes `Tabs*` as the in-repo pattern, and
   `TabsRootProps` (`reka-ui/dist/index3.d.ts:9068`) provides orientation-correct Up/Down arrow roving focus
   and `role="tab"`/`role="tabpanel"` wiring for free. No new dependency.
2. **`activationMode="automatic"`** (the reka-ui default; do not set it explicitly). Arrow keys move and
   activate in one step, matching the low-cost, side-effect-free nature of switching a settings pane.
3. **`:unmount-on-hide="false"`** on every `TabsContent`. Hidden panels stay mounted so that
   `store.state.canvasGrid` / `guideAppearance` inputs and the shortcut-search `ref` keep their DOM state, and
   so `reset()` (which mutates store state directly) needs no re-mount handling. Cost is one extra hidden
   subtree; the dialog is already fully mounted today.
4. **The active tab lives in a module-level `ref` in `src/app/shell/preferences.ts`, not in the persisted
   `AppPreferences` record.** Justification: persisting it would force `PREFERENCES_VERSION` 1 → 2 plus a
   migration in `normalise()` (`preferences.ts:26–34`) for a purely cosmetic value. The tab therefore survives
   close/reopen within a session and resets to Appearance on reload. Alternative recorded in Open Decisions.
5. **`openPreferences()` keeps its zero-argument signature.** It is registered as a bare callback at
   `src/app/shell/menu/app-menu.ts:116` and `src/app/shell/menu/use.ts:114`; adding a parameter there would let
   a menu event object leak in as the section id. Deep-linking to a tab, if ever needed, is a separate export.
6. **The six `<section>` elements keep their `aria-labelledby`, `<h3>` ids, `styles.section` /
   `styles.sectionTitle` classes and all inner markup**, moved inside their `TabsContent`. This preserves the
   `region` role and accessible names that `tests/e2e/canvas/grid.spec.ts:56` depends on, and keeps the group
   heading visible in the pane.
7. **Dialog width grows from `w-[560px]` to `w-[720px]`**, keeping `max-w-[92vw]` and `max-h-[80vh]`. The rail
   occupies a fixed `w-44`; 560px minus the rail would narrow the control column below its current width and
   would reflow the `row` layout (`flex items-center justify-between`) used by every setting.
8. **Tab labels reuse the six existing dictionary keys** listed in Verified Starting State. Exactly one new key
   is added: `preferencesSections` (the tab list's accessible name). No other string changes.
9. **Reset and Done stay in the global footer** (`styles.footer`, lines 368–375), unchanged and outside the
   tabs. `resetAppPreferences()` is documented as app-wide; scoping it per tab would change behaviour, which
   this packet does not do.
10. **The scroll container moves from `styles.body` to the content pane.** Today `body` is
    `flex-1 … overflow-y-auto p-4`. The new `body` becomes a non-scrolling row; `panel` carries
    `flex-1 overflow-y-auto p-4 text-xs`, so only the right pane scrolls and the rail stays fixed.

## Open Decisions

1. **Persisting the last-used tab across app restarts.** Recommended default (implemented): do not persist —
   see Fixed Decision 4. Consequence of the alternative: `PREFERENCES_VERSION` must go to 2 with a migration
   that tolerates a missing/invalid `section` key, plus a persistence assertion in the e2e spec. Adopt only if
   the user asks for it; the current shape makes that a two-line follow-up.
2. **Icons in the rail.** Recommended default (implemented): show a 14px lucide icon left of each label, as
   fixed in the Visual Contract. Consequence of the alternative (text-only rail): drop the `tabIcon` slot and
   the six `<icon-lucide-*>` elements; nothing else changes.

## Visual Contract — binding

Every class string below is final. Copy it exactly; do not restyle the six moved sections.

**Dialog shell** — `src/components/Shell/PreferencesDialog.vue` line 33 becomes:

```ts
const cls = useDialogUI({ content: 'flex max-h-[80vh] w-[720px] max-w-[92vw] flex-col overflow-hidden' })
```

**New slots** in `src/theme/preferences-dialog.ts` (add to the existing `slots` object; change `body`, keep
every other slot byte-identical):

```ts
body: 'flex min-h-0 flex-1 overflow-hidden',
sidebar: 'flex w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border p-2',
tabTrigger:
  'flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-2 py-1.5 text-left text-xs text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-[state=active]:bg-panel-selected-muted data-[state=active]:text-surface data-[state=active]:hover:bg-panel-selected-muted',
tabIcon: 'size-3.5 shrink-0',
panel: 'min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-xs'
```

Token provenance: `bg-panel-selected-muted`, `focus-visible:ring-1 focus-visible:ring-panel-focus`,
`hover:bg-hover hover:text-surface`, `text-muted` are copied from `src/theme/segmented-control.ts:6`;
`border-r border-border` and `rounded-md` from `src/components/ui/dialog.ts` / `VariablesDialog.vue:120,162`.

**Slots wiring** — extend the `styles` object (`PreferencesDialog.vue:34–57`) with, in this order after
`body`:

```ts
sidebar: slots.sidebar(),
tabTrigger: slots.tabTrigger(),
tabIcon: slots.tabIcon(),
panel: slots.panel(),
```

**Structure** — inside `DialogContent`, between the existing header `div` and footer `div`:

```html
<TabsRoot v-model="section" orientation="vertical" :class="styles.body">
  <TabsList :aria-label="dialogs.preferencesSections" :class="styles.sidebar">
    <TabsTrigger
      v-for="tab in tabs"
      :key="tab.id"
      :value="tab.id"
      :class="styles.tabTrigger"
      :data-test-id="`preferences-tab-${tab.id}`"
    >
      <component :is="tab.icon" :class="styles.tabIcon" />
      <span class="truncate">{{ tab.label }}</span>
    </TabsTrigger>
  </TabsList>
  <TabsContent value="appearance" :unmount-on-hide="false" :class="styles.panel">
    <!-- existing <section aria-labelledby="preferences-appearance-title"> … </section>, unmodified -->
  </TabsContent>
  <!-- …one TabsContent per id, in the order below… -->
</TabsRoot>
```

**Tab order, ids, icons, labels** (this exact order — it matches the current section order):

| `id` | Icon component | Label expression |
| --- | --- | --- |
| `appearance` | `<icon-lucide-palette>` | `dialogs.preferencesAppearance` |
| `canvas` | `<icon-lucide-grid-2x2>` | `dialogs.preferencesCanvasDisplay` |
| `guides` | `<icon-lucide-ruler>` | `dialogs.preferencesGuides` |
| `capabilities` | `<icon-lucide-cpu>` | `dialogs.preferencesCapabilities` |
| `ai` | `<icon-lucide-sparkles>` | `dialogs.preferencesAI` |
| `shortcuts` | `<icon-lucide-keyboard>` | `dialogs.preferencesShortcuts` |

Because `IconsResolver` registers these as global components, build the `tabs` computed with explicit
component references resolved in the template rather than dynamic strings: declare
`import IconPalette from '~icons/lucide/palette'` and the five siblings at the top of `<script setup>`, then
`{ id: 'appearance', icon: IconPalette, label: dialogs.value.preferencesAppearance }`. (`~icons/*` is the
`unplugin-icons` virtual module already enabled by `vite.config.ts:34`.)

**States**

- Default trigger: `text-muted`, transparent background.
- Hover (unselected): `bg-hover`, `text-surface`.
- Selected: `bg-panel-selected-muted`, `text-surface`; hover does not change a selected trigger.
- Keyboard focus: `ring-1 ring-panel-focus` via `focus-visible` only; no persistent outline
  (`outline-none` is in the string).
- Disabled: not applicable — no tab is ever disabled.
- Empty/loading: not applicable — all six panes render synchronously.
- Overflow: rail labels use `truncate`; the rail itself scrolls (`overflow-y-auto`) if the viewport is short.
  The content pane scrolls independently (`overflow-y-auto` on `panel`).
- Responsive: dialog is `max-w-[92vw]`; the rail stays `w-44` at every width. No breakpoint variants.
- The Shortcuts pane keeps its own inner `max-h-64 … overflow-y-auto` list wrapper exactly as it is today
  (`PreferencesDialog.vue:361`).

**Test ids**: `preferences-tab-<id>` on each trigger, matching the existing kebab-case convention
(`preferences-shortcuts-search`, `shortcut-row-<id>`). Do not add ids to the panels — they are reachable by
their existing `region` accessible names.

### Banned List

- No literal colour anywhere — no hex, no `rgb()`, no `bg-zinc-*`/`text-slate-*`. Semantic tokens only
  (`text-muted`, `text-surface`, `bg-hover`, `bg-panel-selected-muted`, `border-border`, `ring-panel-focus`).
- No font size outside `text-xs` / `text-[11px]`.
- No radius outside `rounded-md` / `rounded-lg`.
- No new `tv()` recipe — extend the existing `preferencesDialogTheme.slots` object only.
- No new npm dependency; `reka-ui` `Tabs*` is already installed.
- No new global CSS and no edit to `src/app.css`.
- No new store, no new persisted key, no `PREFERENCES_VERSION` bump.
- No change to any control's `aria-label`, `v-model` target, `@change` handler, `data-test-id`, min/max/step,
  or surrounding `label`/`div` element inside the six moved sections.
- No `TabsIndicator`, no animation/transition classes, no `<Transition>`.
- No change to the header, footer, `Reset app preferences`, or `Done`.

## Allowed Changes

- Create `src/app/shell/preferences-sections.ts`.
- Add `preferencesSection` + `setPreferencesSection` to `src/app/shell/preferences.ts`.
- Add the four new slots and change `body` in `src/theme/preferences-dialog.ts`.
- Restructure the template and script of `src/components/Shell/PreferencesDialog.vue` per the Visual Contract.
- Add one key, `preferencesSections`, to `packages/vue/src/i18n/messages/dialogs.ts`.
- Create `tests/engine/app/shell/preferences-sections.test.ts` and
  `tests/e2e/shell/preferences-tabs.spec.ts`; update `tests/e2e/keyboard/shortcut-reference.spec.ts` and
  `tests/e2e/canvas/grid.spec.ts`.

## Restrictions and Exclusions

An implementer who wants to cross one of these must stop and report instead.

- Do not change any preference's behaviour, default, validation, persistence path or owner. This packet is
  navigation only.
- Do not touch `src/app/shell/canvas-grid.ts`, `canvas-guides.ts`, `hardware-acceleration.ts`,
  `keyboard/reference.ts`, `theme.ts`, the AI storage module, or any `src/components/ui/*` primitive.
- Do not modify the menu schema, `app-menu.ts`, or `use.ts`.
- Do not bump `PREFERENCES_VERSION` or add fields to `AppPreferences`.
- Do not rename or remove any existing `data-test-id`, `aria-label`, or `aria-labelledby` id.
- Do not add a second dictionary/locale file.
- Do not build the desktop app, run the installer, or bump `package.json` / `desktop/tauri.conf.json` /
  `desktop/Cargo.toml`.
- Do not run `bun run check`, `bun run lint`, `bun run test`, or `bun run test:unit`.

## Implementation Steps

1. **Pre-flight.** Reread `src/components/Shell/PreferencesDialog.vue` (full file),
   `src/theme/preferences-dialog.ts`, and `src/app/shell/preferences.ts:46–56`. Confirm the six
   `aria-labelledby` section ids and the `styles` object shape still match Verified Starting State. If any
   drift is found, record it in the execution report before editing.

2. **Create `src/app/shell/preferences-sections.ts`.** Implement exactly the contract in Verified Starting
   State: the `PREFERENCES_SECTION_IDS` tuple in the fixed order, the derived `PreferencesSectionId` type,
   `DEFAULT_PREFERENCES_SECTION = 'appearance'`, and
   `normalisePreferencesSection(value: unknown): PreferencesSectionId` returning the value when it is one of
   the ids and `DEFAULT_PREFERENCES_SECTION` otherwise. No Vue import in this file — it must stay pure so the
   Bun test can import it without a DOM.

3. **Extend `src/app/shell/preferences.ts`.** Import
   `DEFAULT_PREFERENCES_SECTION, normalisePreferencesSection, type PreferencesSectionId` from
   `@/app/shell/preferences-sections`; add
   `export const preferencesSection = ref<PreferencesSectionId>(DEFAULT_PREFERENCES_SECTION)` next to
   `preferencesOpen` (line 48) and
   `export function setPreferencesSection(value: unknown): void { preferencesSection.value = normalisePreferencesSection(value) }`.
   Leave `openPreferences`, `normalise`, `PREFERENCES_VERSION`, `resetAppPreferences` and the stored record
   untouched.

4. **Extend `src/theme/preferences-dialog.ts`.** Replace the `body` slot value and add `sidebar`,
   `tabTrigger`, `tabIcon`, `panel` with the exact strings from the Visual Contract. Keep the file's
   `as const` + `PreferencesDialogTheme` export shape.

5. **Add the dictionary key.** In `packages/vue/src/i18n/messages/dialogs.ts`, add
   `preferencesSections: 'Preference sections',` immediately after `preferencesDescription` (line 148). No
   other dictionary edit; `dialogMessages` at line 239 picks it up automatically.

6. **Restructure `src/components/Shell/PreferencesDialog.vue`.**
   - Script: add `TabsContent, TabsList, TabsRoot, TabsTrigger` to the existing `reka-ui` import (line 4);
     add the six `~icons/lucide/*` default imports; import `preferencesSection, setPreferencesSection` from
     `@/app/shell/preferences`; change the `useDialogUI` width to `w-[720px]`; add the four new entries to
     `styles`; add
     `const section = computed({ get: () => preferencesSection.value, set: (value: string) => setPreferencesSection(value) })`
     and a `tabs` computed returning the six `{ id, icon, label }` records in the table's order.
   - Template: replace `<div :class="styles.body">…</div>` with the `TabsRoot` structure from the Visual
     Contract. Move each existing `<section>` verbatim into its `TabsContent`; do not edit anything inside a
     section, including the Shortcuts pane's search input and `max-h-64` list wrapper.
   - Leave the header block (183–192) and footer block (368–375) exactly as they are.

7. **Add `tests/engine/app/shell/preferences-sections.test.ts`.** Use this exact header (verified against
   `tests/engine/app/shell/theme.test.ts:1–3`):

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
   import { describe, expect, test } from 'bun:test'

   import {
     DEFAULT_PREFERENCES_SECTION,
     PREFERENCES_SECTION_IDS,
     normalisePreferencesSection
   } from '@/app/shell/preferences-sections'
   ```

   Assert: the tuple equals
   `['appearance', 'canvas', 'guides', 'capabilities', 'ai', 'shortcuts']` in order; the default is
   `'appearance'`; `normalisePreferencesSection` returns each valid id unchanged; and it returns the default
   for `'nope'`, `''`, `null`, `undefined`, `42`, and `{}`.

8. **Add `tests/e2e/shell/preferences-tabs.spec.ts`.** Use this exact header (verified against
   `tests/e2e/keyboard/shortcut-reference.spec.ts:1–3`):

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
   ```

   Bootstrap with `page.goto('/?test')` and `page.getByTestId('editor-root').waitFor()`, then
   `page.getByRole('menuitem', { name: 'Edit' }).click()` and
   `page.getByRole('menuitem', { name: 'Preferences' }).click()` — the same route
   `tests/e2e/canvas/grid.spec.ts:52–53` uses. Assert:
   - all six `preferences-tab-*` triggers are visible;
   - `preferences-tab-appearance` has `aria-selected="true"` on open, and the Appearance controls
     (`combobox` named `Theme`) are visible while `preferences-shortcuts-search` is hidden;
   - clicking `preferences-tab-shortcuts` makes `preferences-shortcuts-search` visible and hides the `Theme`
     combobox;
   - with a tab focused, pressing `ArrowDown` moves selection to the next tab in order (verifies vertical
     orientation);
   - closing with `Done` and reopening via the menu keeps the last-selected tab active (Fixed Decision 4).

9. **Update the two specs this change breaks.**
   - `tests/e2e/keyboard/shortcut-reference.spec.ts`: after the `Preferences` menu item click (line 20), add
     `await editor.page.getByTestId('preferences-tab-shortcuts').click()` before the
     `preferences-shortcuts-search` assertion. Nothing else changes.
   - `tests/e2e/canvas/grid.spec.ts`, test `preferences composes theme and grid settings without exposing
     credentials` (48–78): the AI-region assertion (line 56) needs
     `await dialog.getByTestId('preferences-tab-ai').click()` first; the `UI scale` interaction needs
     `preferences-tab-appearance` selected; the four grid interactions need
     `await dialog.getByTestId('preferences-tab-canvas').click()` first. On reopen after reload (line 74),
     click `preferences-tab-appearance` before asserting the `UI scale` combobox text. Keep every existing
     assertion and value.

## Acceptance Criteria

- [ ] Opening `Edit ▸ Preferences` shows a left vertical rail with exactly six tabs in the order
      Appearance, Canvas display, Guides, Capabilities, AI, Keyboard shortcuts, and one content pane.
- [ ] Exactly one group's controls is visible at a time; the previously stacked single-column body is gone.
- [ ] Every control keeps its current label, `aria-label`, `data-test-id`, value binding and persistence:
      theme, UI scale, grid visible/mode/spacing/dot size/opacity/colour, the three guide colour+opacity rows,
      hardware acceleration and its status/restart notice, AI provider/authentication rows, and the shortcut
      search with its `shortcut-row-*` rows.
- [ ] Each pane still exposes a `region` with its accessible name (`AI`, `Guides`, …) via the preserved
      `aria-labelledby` sections.
- [ ] The rail is keyboard-navigable with Up/Down (vertical orientation), each trigger has
      `role="tab"`/`aria-selected`, and the tab list has the accessible name `Preference sections`.
- [ ] Selected, hover, and focus-visible states render with the exact Visual Contract classes; nothing on the
      Banned List appears in the diff.
- [ ] The active tab persists across close/reopen within a session and returns to Appearance after reload.
- [ ] `Reset app preferences` and `Done` remain in the global footer and behave as before.
- [ ] `PREFERENCES_VERSION` is still `1` and `AppPreferences` has no new field.
- [ ] All named gates below pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```bash
bun test tests/engine/app/shell/preferences-sections.test.ts
```

### Final pre-completion gates — run once

```bash
bunx tsgo --noEmit
```

```bash
bunx vue-tsc --noEmit -p tsconfig.json
```

```bash
bunx oxlint -c oxlint.json src/components/Shell/PreferencesDialog.vue src/theme/preferences-dialog.ts src/app/shell/preferences.ts src/app/shell/preferences-sections.ts packages/vue/src/i18n/messages/dialogs.ts tests/engine/app/shell/preferences-sections.test.ts tests/e2e/shell/preferences-tabs.spec.ts tests/e2e/keyboard/shortcut-reference.spec.ts tests/e2e/canvas/grid.spec.ts
```

```bash
bunx playwright test tests/e2e/shell/preferences-tabs.spec.ts tests/e2e/keyboard/shortcut-reference.spec.ts tests/e2e/canvas/grid.spec.ts --project=openpencil
```

Locale check: no locale-check script exists in `App/package.json` (there is no `check:i18n`). Instead read back
`packages/vue/src/i18n/messages/dialogs.ts` and confirm `preferencesSections` is present exactly once and that
the six reused label keys are unchanged.

`vue-tsc -p packages/vue/tsconfig.json` is not required: the only package edit is a string literal added to an
existing `as const` object with no type surface change. Run it if `tsgo` reports anything in `packages/vue`.

## Integration or Installed-Result Check

Browser only — no desktop build is authorised or needed (no Tauri config, Rust, icon, generated menu, or
`IS_TAURI`-only surface is touched).

```bash
bun run dev
```

At `http://localhost:1420`, open `Edit ▸ Preferences` and confirm:

1. Six tabs in the rail, Appearance selected, only Appearance controls visible.
2. Click each tab in turn; each pane shows its own controls and its heading, and the rail selection follows.
3. On Canvas display, change grid spacing to `24` and confirm the canvas grid repaints immediately — proving
   the moved `@change` handlers still reach `saveCanvasGridSettings` + `requestRepaint`.
4. Focus a tab and press Down/Up; selection moves vertically and the pane follows.
5. Shrink the window to ~700px wide: the dialog clamps at `92vw`, the rail keeps its width, the pane scrolls,
   and no horizontal page scrollbar appears.
6. Press `Reset app preferences`, then `Done`; reopen — theme is Dark, UI scale 100%, grid back to defaults.
7. Non-regression: the Shortcuts tab's search still filters `shortcut-row-*` rows, and switching away and back
   preserves the typed query (proves `:unmount-on-hide="false"`).

## Stop Conditions

Stop and report instead of improvising if:

- `reka-ui`'s `TabsRoot` in the installed version does not accept `orientation="vertical"` or
  `unmount-on-hide` as typed at `node_modules/reka-ui/dist/index3.d.ts:9068–9096`;
- moving a section into `TabsContent` changes any control's accessible name or breaks an existing
  `getByRole`/`getByTestId` query in a way that cannot be fixed by the tab click added in Step 9;
- a Visual Contract token (`bg-panel-selected-muted`, `ring-panel-focus`, `bg-hover`, `border-border`) does not
  resolve in the built stylesheet;
- any of the six sections turns out to depend on being simultaneously mounted with another section;
- the work appears to require a `PREFERENCES_VERSION` bump, a new store, or an edit to any file outside
  Allowed Changes.

## Execution Report Contract

Record: every changed/created file with its role; the final class strings used for the rail if they deviated
(and why); the exact commands run with exit codes and test counts; the diff applied to
`tests/e2e/canvas/grid.spec.ts` and `tests/e2e/keyboard/shortcut-reference.spec.ts`; browser-check results for
all seven observations above; confirmation that `PREFERENCES_VERSION` is still `1`; any Banned List item that
had to be crossed and its justification; and any remaining gap (e.g. Open Decision 1 left unimplemented).

## Status record

Expansion receipt — 2026-08-24, revision 1. Expanded against the live tree under `App/`; every path, symbol,
line number, class token, dictionary key, icon name, and script command in this packet was read from source or
`node_modules` during expansion. No file under `App/` was modified. Execution evidence goes here after the
packet runs; step status stays in `Plan/plan.md`.

Execution receipt — 2026-08-24. Executed and verified:
- `src/app/shell/preferences-sections.ts` created with `PREFERENCES_SECTION_IDS`, `PreferencesSectionId`, `DEFAULT_PREFERENCES_SECTION`, and `normalisePreferencesSection`.
- `src/app/shell/preferences.ts` updated to export `preferencesSection` and `setPreferencesSection`. `PREFERENCES_VERSION` remains 1.
- `src/theme/preferences-dialog.ts` updated with `body`, `sidebar`, `tabTrigger`, `tabIcon`, and `panel` slots matching visual contract.
- `packages/vue/src/i18n/messages/dialogs.ts` updated with `preferencesSections` key.
- `src/components/Shell/PreferencesDialog.vue` updated with vertical `TabsRoot`, `TabsList`, `TabsTrigger`, and `TabsContent` panels, dialog width `w-[720px]`.
- `tests/engine/app/shell/preferences-sections.test.ts` added and passed (3 tests, 14 expects).
- `tests/e2e/shell/preferences-tabs.spec.ts` added and passed.
- `tests/e2e/keyboard/shortcut-reference.spec.ts` and `tests/e2e/canvas/grid.spec.ts` updated and passed.
- Gates verified: `bun test` (3 pass), `bunx tsgo --noEmit` (0 errors), `bunx vue-tsc --noEmit -p tsconfig.json` (0 errors), `bunx oxlint` (0 warnings, 0 errors on 9 files), `bunx playwright test` (4 passed across 3 spec files in 11.4s).
