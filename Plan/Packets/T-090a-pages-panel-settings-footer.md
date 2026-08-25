# T-090a - Move page colour, unit and DPI into the Pages-panel footer

Task ID: T-090a
Packet state: Ready
Packet revision: 1
Project goal link: `Plan/endgoal.md`
Depends on: T-090
Related: T-017, T-020, T-031a, T-090b, T-090c
Prepared from: user's 2026-08-24 request to move colour, unit and DPI from the Page panel to a footer in the Pages panel
Expanded at: 2026-08-24 10:25 Africa/Johannesburg
Expanded against: `Plan/plan.md`, `Plan/PACKET-EXPANSION-BRIEF.md`, and live `App/` source read 2026-08-24
Delivery: named source gates + browser check
Execution size: 4 core implementation files; 2 existing Playwright files; within the packet ceiling

## Intended Outcome

The Pages panel keeps its header and independently scrolling page list, then shows an always-visible footer containing editable page canvas colour, document unit and document DPI. The empty-selection Design panel no longer duplicates those controls. T-090b converts the old Page panel into a temporary compatibility view of this same Pages surface; T-090c then removes its registry/schema entry.

## Request Coverage

> “the items in the ‘page panel’: colour, unit and dpi can move to the pages panel but as a footer of the panel”

## Verified Starting State

| Path | Symbol / selector | Binding use |
| --- | --- | --- |
| `src/components/properties/PageSection.vue:1-195` | page colour, `documentUnits`, `writeUnitsWithUndo`, DPI preview/commit | Extract this logic unchanged into a reusable controls component; do not invent state. |
| `src/components/PagesPanel.vue:71-176` | `[data-test-id="pages-panel"]`, `pages-scroll` | The panel is already `flex-col`; place the footer after the `min-h-0 flex-1` list wrapper so only the list scrolls. |
| `src/components/DesignPanel.vue:131-140` | empty-selection branch | Remove only `<PageSection />`; keep Variables, Gamut and Export order unchanged. |
| `src/components/workspace-panels/WorkspacePanelContent.vue:103` | `panelId === 'page'` | Continue rendering the compatibility `PageSection` wrapper until T-090b. |
| `packages/core/src/units/document.ts:3-73` | `DocumentUnit`, `DocumentUnits`, normalise/parse/upsert | Existing plugin-data/undo persistence remains authoritative. |
| `src/app/shell/theme.ts` | `markCanvasThemeCustom(store, pageId)` from T-090 | Call this before both canvas-colour and alpha updates so edits become explicit overrides. |

Required new component API:

```ts
// src/components/properties/PageSettingsControls.vue
const { variant = 'section' } = defineProps<{ variant?: 'section' | 'footer' }>()
```

`variant="section"` supplies only the control body for the legacy wrapper; `variant="footer"` supplies the compact footer body. Both variants use the same computed values and mutation functions.

## Read First

1. `src/components/properties/PageSection.vue:1-195` — source logic and exact control bindings.
2. `src/components/PagesPanel.vue:71-176` — list/flex structure and test IDs.
3. `src/theme/panel/field.ts:1-2`, `grid.ts`, `field-group.ts` — existing themed field primitives.
4. `tests/e2e/properties/page-section.spec.ts:1-37` and `tests/e2e/pages/multi-page.spec.ts:29-64` — tests to relocate/extend.

## Fixed Decisions

1. **Extract, do not duplicate:** create `PageSettingsControls.vue` from PageSection's live script and control body. `PageSection.vue` becomes a thin `PanelSection` compatibility wrapper.
2. **True footer geometry:** the footer is `shrink-0 border-t border-border bg-panel px-3 py-2`; the page-list wrapper remains `min-h-0 flex-1`. A short panel may scroll the page list but must never scroll the footer away.
3. **Compact layout:** colour occupies one full-width row; Unit and DPI share the existing two-column `PanelGrid` below it. Preserve `PaintField`, `PaintValue`, `AppSelect`, `NumberField`, DPI presets and exact mutation semantics.
4. **Theme/custom hand-off:** call T-090's `markCanvasThemeCustom(editor, editor.state.currentPageId)` before `setPageColor()` for RGB or alpha edits.
5. **No model move:** unit/DPI remains document plugin data with undo. Canvas colour remains per-page viewport/editor state. No Pinia/store/event-bus layer.
6. **Compatibility boundary:** T-090a removes the empty Design-panel duplicate but does not alter `PANEL_IDS` or the Window menu. T-090b removes the obsolete wrapper; T-090c owns registry removal.

## Visual Contract — binding

- Footer root: `shrink-0 border-t border-border bg-panel px-3 py-2` and `data-test-id="pages-settings-footer"`.
- Footer control body: `flex flex-col gap-panel`; use existing `PaintField`, `PanelGrid columns="two"`, `PanelFieldGroup`, `AppSelect`, and `NumberField` classes without overrides.
- Keep the live swatch trigger class `size-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0`.
- Keep the DPI preset button class `flex h-full items-center px-1 text-muted hover:text-surface` and existing menu recipes.
- Default, hover, selected, disabled, focus-visible, menu-open and overflow states inherit the existing primitives. At widths down to `240px`, Unit and DPI remain two columns without horizontal overflow.

### Banned List

- No literal colours, Tailwind palette colours, new `tv()` recipe, global CSS, dependency, state store or persistence key.
- No fixed footer height, resizer, disclosure/collapse control or duplicated page header.
- No changes to Pages add/rename/delete/reorder behaviour, page-list composable, document-unit schema, DPI bounds or undo labels.

## Allowed Changes

- `App/src/components/properties/PageSettingsControls.vue` (new)
- `App/src/components/properties/PageSection.vue`
- `App/src/components/PagesPanel.vue`
- `App/src/components/DesignPanel.vue`
- `App/tests/e2e/properties/page-section.spec.ts`
- `App/tests/e2e/pages/multi-page.spec.ts`

## Restrictions and Exclusions

- Do not edit panel registry/layout files; T-090c owns that structural removal.
- Do not edit theme tokens, grid preferences, CanvasKit rendering, exports, page thumbnails, menus or locales.
- Do not change the canvas theme-link implementation except calling its public marker.
- No builds, installs, version bumps, Git work or umbrella checks/tests.

## Implementation Steps

1. **Pre-flight:** confirm T-090 is landed and `markCanvasThemeCustom()` exists with the packet signature. Reconcile the four target components against Read First.
2. **Extract controls:** create `PageSettingsControls.vue`; move PageSection's script/control body without changing `normalizeDocumentUnits`, plugin-data, undo, preview/commit, DPI preset or paint-field behaviour. Add the `variant` prop and root test ID `page-settings-controls`.
3. **Compatibility wrapper:** reduce `PageSection.vue` to `PanelSection :label="panels.page"` containing `<PageSettingsControls variant="section" />`. Do not retain a second copy of the logic.
4. **Pages footer:** import the controls in `PagesPanel.vue`; append `<footer data-test-id="pages-settings-footer" ...><PageSettingsControls variant="footer" /></footer>` after the list wrapper and inside `pages-panel`.
5. **Remove Design duplicate:** delete the PageSection import and its empty-branch element in `DesignPanel.vue`; do not reorder remaining sections.
6. **Relocate tests:** update `page-section.spec.ts` to locate `pages-settings-footer` instead of `propertySection('Page')`, preserving RGB/alpha assertions and adding Unit + DPI commit/undo/read-back checks. Extend `multi-page.spec.ts` to assert the footer remains visible while `pages-scroll` scrolls and after switching pages. Preserve nearby test headers; do not add suppression where the file does not use it.

## Acceptance Criteria

- [ ] Pages panel contains one footer with editable colour, Unit and DPI controls.
- [ ] Footer stays visible while a long page list scrolls independently and at the minimum dock width.
- [ ] Colour/alpha updates repaint and mark the current page as a custom canvas-theme override.
- [ ] Unit and DPI keep current plugin-data, normalisation, undo and preset behaviour.
- [ ] Empty Design panel no longer shows the Page section.
- [ ] Legacy standalone Page panel still works pending T-090b/T-090c; there is no duplicated implementation logic.
- [ ] Page add, switch, rename, delete and drag reorder remain unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bunx playwright test tests/e2e/properties/page-section.spec.ts --project=openpencil
```

### Final pre-completion gates — run once

```powershell
bunx oxfmt --check src/components/properties/PageSettingsControls.vue src/components/properties/PageSection.vue src/components/PagesPanel.vue src/components/DesignPanel.vue tests/e2e/properties/page-section.spec.ts tests/e2e/pages/multi-page.spec.ts
bunx oxlint -c oxlint.json --type-aware --type-check src/components/properties/PageSettingsControls.vue src/components/properties/PageSection.vue src/components/PagesPanel.vue src/components/DesignPanel.vue
bunx vue-tsc --noEmit -p tsconfig.json
bunx playwright test tests/e2e/pages/multi-page.spec.ts --project=openpencil
```

Do not run umbrella checks/tests, builds or installs.

## Integration or Installed-Result Check

Run `bun run dev`. In the browser, dock Pages at minimum width, create enough pages to overflow, and prove the list scrolls while the footer remains fixed. Edit colour, alpha, unit and DPI; switch pages and themes; confirm edits remain usable and page operations still work. Browser proof is sufficient.

## Stop Conditions

- Stop if T-090 has not landed or its marker signature drifted.
- Stop if extracting the controls changes unit/DPI plugin data, undo, or page-colour ownership.
- Stop if footer placement requires a panel-layout/schema change; that belongs to T-090c.
- Stop on required-gate failure or any need to edit outside Allowed Changes.

## Execution Report Contract

Report changed files, focused gate results, footer fixed/scroll evidence, RGB/alpha/unit/DPI read-backs, undo evidence, page-operation non-regression and any remaining gap. State clearly that compatibility clean-up and registry retirement remain T-090b/T-090c.

## Status record

- 2026-08-24 — Revision 1 expanded from live source. Split from the registry migration so the footer can land as a bounded UI change. No `App/` or `Plan/plan.md` files were changed.
