# T-090b - Replace the old Page panel body with the Pages surface

Task ID: T-090b
Packet state: Ready
Packet revision: 1
Project goal link: `Plan/endgoal.md`
Depends on: T-090a
Related: T-031a, T-090, T-090c
Prepared from: user's 2026-08-24 request to move Page-panel controls into the Pages-panel footer
Expanded at: 2026-08-24 10:25 Africa/Johannesburg
Expanded against: `Plan/plan.md`, `Plan/PACKET-EXPANSION-BRIEF.md`, and live `App/` source read 2026-08-24
Delivery: named source gates + browser check
Execution size: 2 core file changes (one deletion); 1 focused Playwright file; within the packet ceiling

## Intended Outcome

Remove the obsolete PageSection compatibility wrapper without creating an interim blank registered panel: until T-090c removes the `page` registry ID, opening Page shows the same Pages surface and footer as the Pages panel. There is one controls implementation and no stale Page-only body.

## Request Coverage

This is the compatibility bridge between moving colour/unit/DPI to the Pages footer (T-090a) and removing the standalone Page panel registration (T-090c).

## Verified Starting State

| Path | Symbol / selector | Binding use |
| --- | --- | --- |
| `src/components/workspace-panels/WorkspacePanelContent.vue:11,23,52,103` | `PagesPanel`, `PageSection`, `panelId === 'pages'`, `panelId === 'page'` | `PagesPanel` is already imported. Route both IDs to it, then remove PageSection import/branch. |
| `src/components/properties/PageSection.vue` | thin wrapper produced by T-090a | Delete after its final consumer is removed. |
| `src/components/PagesPanel.vue` | `pages-panel` and `pages-settings-footer` from T-090a | Sole compatibility body; do not modify it here. |

## Read First

1. `src/components/workspace-panels/WorkspacePanelContent.vue:1-55,98-108`.
2. `src/components/properties/PageSection.vue` in full.
3. `tests/e2e/panels/basic.spec.ts` at Window-panel open/close coverage.

## Fixed Decisions

1. Change the first branch to `<PagesPanel v-if="panelId === 'pages' || panelId === 'page'" />`.
2. Remove the later PageSection branch and import, then delete `PageSection.vue`.
3. This is a temporary compatibility alias only. Do not alias layout IDs, menu commands or stored records; T-090c removes `page` structurally.

## Visual Contract — binding

The compatibility Page tab renders exactly `PagesPanel.vue`; no wrapper, notice, alternative header or extra padding. All states and `data-test-id` values are therefore identical to Pages.

### Banned List

- No new CSS, colour, recipe, dependency, component, locale, store or persistence.
- No duplicate control logic and no blank/placeholder Page panel.
- No edits to registry/layout files or PagesPanel.

## Allowed Changes

- `App/src/components/workspace-panels/WorkspacePanelContent.vue`
- `App/src/components/properties/PageSection.vue` (delete)
- `App/tests/e2e/panels/basic.spec.ts`

## Restrictions and Exclusions

- Do not edit theme/canvas/grid behaviour, PageSettingsControls, PagesPanel, DesignPanel, menus, panel schema or layout normalisers.
- No builds, installs, version bumps, Git work or umbrella checks/tests.

## Implementation Steps

1. Confirm T-090a landed and PageSection is a thin wrapper with no unique logic.
2. Route both `pages` and temporary `page` IDs to the existing PagesPanel branch; remove the PageSection import/branch.
3. Delete `PageSection.vue`. Verify `rg -n "PageSection" src` has no result.
4. Extend `basic.spec.ts` using its existing header: open Page from Window, assert `pages-panel` and `pages-settings-footer` are visible, then close/reopen without errors. Preserve all existing exact panel assertions.

## Acceptance Criteria

- [ ] PageSection has no source reference and its file is deleted.
- [ ] Pages and temporary Page tabs render the same Pages surface/footer without duplicate logic.
- [ ] No blank panel, console error or panel-layout mutation is introduced.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil
```

### Final pre-completion gates — run once

```powershell
bunx oxfmt --check src/components/workspace-panels/WorkspacePanelContent.vue tests/e2e/panels/basic.spec.ts
bunx oxlint -c oxlint.json --type-aware --type-check src/components/workspace-panels/WorkspacePanelContent.vue
bunx vue-tsc --noEmit -p tsconfig.json
```

Do not run umbrella checks/tests, builds or installs.

## Integration or Installed-Result Check

Run `bun run dev`. Open Pages and Page from Window in turn; both must show the same working list/footer, with no blank body or error. Browser proof is sufficient.

## Stop Conditions

- Stop if PageSection still owns unique logic after T-090a.
- Stop if the alias requires a layout/schema/menu edit.
- Stop on required-gate failure or any need to edit outside Allowed Changes.

## Execution Report Contract

Report changed/deleted files, focused gate outcomes, both panel-body observations and any remaining gap. State that `page` registry removal remains T-090c.

## Status record

- 2026-08-24 — Revision 1 expanded as the compile-safe bridge between footer relocation and structural registry retirement. No `App/` or `Plan/plan.md` files were changed.
