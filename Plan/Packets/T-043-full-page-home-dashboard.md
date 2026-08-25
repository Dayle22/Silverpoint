# T-043 - Full-page home dashboard

Task ID: T-043
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-025 (Done)
Related: T-042 (independent — see Fixed Decision 4 for the interaction)
Prepared from: the user's 2026-08-14 request batch
Expanded at: 2026-08-15
Expanded against: live `App/` source — `EditorView.vue`, `DashboardView.vue`, `App/src/app/tabs/index.ts`, `App/src/router.ts`, `App/src/app/shell/panels/hosts.ts`, `App/src/app/editor/active-store/index.ts`, `App/packages/vue/src/editor/viewport-kind/use.ts`
Delivery: source gates only

## Intended Outcome

Pressing the home button shows the dashboard filling the entire window below the tab bar, with no editor chrome, panel docks or canvas competing for the space. Today it does not, because of a genuine layout defect found during expansion (see Corrections to the Brief): the editor chrome mounts *concurrently* with the dashboard and the two split the available height roughly in half.

## Request Coverage

- The home dashboard should occupy the full page rather than its current constrained presentation.

## Corrections to the Brief

The stub asked three open questions ("is home a route, a tab, or an overlay", "which chrome remains visible", "does the dashboard's own layout need rework"). All three are answered definitively by reading the live code, and in the process a real, previously undiagnosed defect was found that is the actual cause of the "constrained presentation" the user reported — the fix is smaller and more precise than the stub's framing suggested.

**The defect:** `App/src/views/EditorView.vue:264` renders `<DashboardView v-if="activeTabId === 'dashboard'" />` as an element **independent of** the desktop/mobile/collapsed/bare chrome block that follows it (`EditorView.vue:267-344`, four mutually-exclusive `v-if`/`v-else-if`/`v-else` branches keyed only on `isMobile`, `showChrome` and `store.state.showUI` — none of which depend on `activeTabId`). Because `TabBar`'s home button (`TabBar.vue:84`) sets `activeTabId = 'dashboard'` directly without clearing the active editor store (`setActiveEditorStore` is not called), `store.state.showUI` keeps reflecting whichever tab's store was last active — normally `true`. So with at least one tab open, clicking home renders **both** `<DashboardView>` and the desktop editor branch (`PanelStack` docks, `EditorCanvas`, `Toolbar`) as siblings inside `editor-root`'s `flex flex-col` container. Both `DashboardView` (`flex flex-1 flex-col`, `DashboardView.vue:115`) and the desktop branch (`flex min-h-0 flex-1 flex-col`, `EditorView.vue:269`) are `flex-1` — a flex column container with two `flex-1` siblings splits the remaining height between them. **This is the actual bug: the dashboard is squeezed to roughly half height by the still-mounted editor chrome, not by anything inside `DashboardView.vue` itself.** The same holds for the mobile, collapsed-UI and bare branches, since all four are equally independent of `activeTabId`.

This is reproducible in the existing test suite's own setup: `App/tests/e2e/editor/recovery.spec.ts`'s `'should render home button and navigate to dashboard view'` test clicks home while a tab is already open (the default `useEditorSetup()` fixture state) — the exact scenario above — but only asserts `dashboard-root` is *visible*, not that it fills the viewport, so the defect has never been caught by that test.

- **Is home a route, a tab, or an overlay?** None of the three. `App/src/router.ts` defines exactly three routes (`/`, `/demo`, `/share/:roomId`), all mounting the single `EditorView`. There is no `/dashboard` route. `activeTabId` (`App/src/app/tabs/index.ts:32`) is a plain `shallowRef<string>`; `'dashboard'` is a sentinel value it can hold that never appears in the `tabs`/`allTabs` array (`activeTab = computed(() => tabsRef.value.find(t => t.id === activeTabId.value))` resolves to `undefined` for it). It is set in exactly three places: `TabBar.vue:84` (home button click), and `tabs/index.ts:168,193` (`closeTab`/`discardTab`, when the last tab closes). It is a display-mode flag riding the same ref tabs use, not a tab, route or overlay.
- **Which chrome remains visible?** Today: `TabBar` only (`EditorView.vue:261`, unconditional, rendered above both the `DashboardView` and chrome branches). If T-042 lands first or later, `TabBar` will also carry the new app-icon menu button (T-042 mounts it directly inside `TabBar`, which is itself unconditional) — that is expected and requires no special-casing here, since this packet never touches `TabBar.vue`.
- **Does the dashboard's own content layout need rework?** No. `DashboardView.vue:115-116` is already `flex flex-1 flex-col overflow-y-auto bg-canvas p-8` with an inner `mx-auto flex w-full max-w-6xl flex-col gap-8` — a correct full-height, full-width, centered-content layout. It only *looks* constrained today because its sibling steals half the height. No change to `DashboardView.vue` is required or allowed by this packet.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/src/views/EditorView.vue:264` | `<DashboardView v-if="activeTabId === 'dashboard'" />` — independent of the four chrome branches that follow. |
| `App/src/views/EditorView.vue:267-290` | Desktop branch: `v-if="!isMobile && showChrome && store.state.showUI"`. Contains `AppMenu` (browser-only), `PanelStack left/right`, `EditorCanvas`, `Toolbar`, `PanelOverlay`, the `PANEL_IDS` parking hosts and `WorkspacePanel` loop. |
| `App/src/views/EditorView.vue:293-304` | Mobile branch: `v-else-if="isMobile && showChrome && store.state.showUI"`. Contains `EditorCanvas`, `MobileHud`, `Toolbar`, `MobileDrawer`. |
| `App/src/views/EditorView.vue:307-337` | Collapsed-UI branch (`showUI=false`): `v-else-if="showChrome"`. Contains `EditorCanvas` and a small floating name/toggle chip. |
| `App/src/views/EditorView.vue:340-344` | Bare branch (`?no-chrome`): `v-else`. Contains only `EditorCanvas`. |
| `App/src/views/EditorView.vue:212` | `editor-root`: `flex h-screen w-screen flex-col` — the container whose children compete for height. |
| `App/src/components/DashboardView.vue:115` | `data-test-id="dashboard-root"`, class `flex flex-1 flex-col overflow-y-auto bg-canvas p-8`. Confirmed correct as-is; no change needed. |
| `App/src/components/TabBar.vue:78-88` | Home button: `@click="activeTabId = 'dashboard'"`. Does not call `setActiveEditorStore`. |
| `App/src/app/tabs/index.ts:32,41,168,193` | `activeTabId` definition; `activeTab` computed (resolves to `undefined` for the `'dashboard'` sentinel); the two places `closeTab`/`discardTab` also set it to `'dashboard'`. |
| `App/src/app/editor/active-store/index.ts:25-70` | `useEditorStore()` returns a `Proxy` (`storeProxy`) that falls back to a `dummyState` (`showUI: true`, ...) only when no store has ever been set; otherwise it reflects whatever `setActiveEditorStore` last received — which is the last real tab's store, unchanged by navigating to dashboard. This is why `store.state.showUI` stays truthy and the desktop branch's `v-if` stays true while on the dashboard with an open tab. |
| `App/src/router.ts` | Confirms there is no dashboard route (see Corrections above). |
| `App/src/app/shell/panels/hosts.ts:23,48,60` | `HostKind = 'parking' \| 'docked' \| 'floating'`. No `'rail'` kind exists (that is T-033/T-032 scope, not yet implemented). |
| `Plan/Packets/T-033-canvas-focus-layout.md` | The precedent this packet's brief pointed to for "not mutating the persisted layout while hiding panels" — its `'rail'` teleport-host mechanism exists specifically so panel bodies (including live AI streams) survive a **display-mode toggle within active editing**. See Fixed Decision 2 for why that precedent does not transfer here. |
| `App/packages/vue/src/editor/viewport-kind/use.ts` | `isMobile = useBreakpoints({ mobile: 768 }).smaller('mobile')` — a pure CSS width breakpoint, unrelated to `activeTabId`. Confirms the fix composes cleanly with the mobile branch with no special-casing. |
| `App/tests/e2e/editor/recovery.spec.ts:5-42` | Existing `'T-026'`-tagged dashboard tests: home button navigates to dashboard (with a tab already open — the exact scenario the defect lives in); new file from dashboard; dashboard shown when all tabs close. None assert full-height/exclusivity today. |

## Fixed Decisions

1. **The fix is a single structural change in `EditorView.vue`: wrap the four existing chrome branches in one `<template v-else>` following `DashboardView`'s `v-if`.** This makes `DashboardView` and the entire chrome group mutually exclusive on `activeTabId === 'dashboard'`, without changing any of the four branches' own internal conditions, order, or content. Vue 3 permits a `v-if`/`v-else-if`/`v-else` chain to live inside a `<template>` wrapper as long as the chained elements remain adjacent siblings within it — the existing `v-if`/`v-else-if`/`v-else-if`/`v-else` chain among the four branches is preserved verbatim, just nested one level deeper under the new `v-else`.
2. **Panel bodies (docked and floating) unmount while the dashboard is shown, and that is correct here, not a defect to work around with T-033's rail mechanism.** T-033's `'rail'` host kind exists to survive a **within-editing** display-mode toggle (Focus), where the user stays on the same document and expects live panel state (AI streams, scroll position) to persist through the toggle. Navigating to the dashboard is not that: it is leaving the document context entirely, while the tab itself and its `EditorStore` stay alive and untouched in `tabsRef` — only the chrome is hidden. This exact trade-off — panel bodies fully unmounting, to be freshly remounted with whatever `panelLayout` state is current when chrome next renders — is **already** how this file treats the mobile branch, the collapsed-UI branch and the bare branch relative to the desktop branch (all four are already mutually exclusive `v-if`/`v-else-if`/`v-else` siblings, and only the desktop branch mounts `PANEL_IDS`/`WorkspacePanel` at all). This packet does not introduce a new class of risk; it extends an existing, accepted one to one more entry point. No `hosts.ts` change, no schema change, no new host kind.
3. **No change to `DashboardView.vue`.** Its layout is already correct (Corrections to the Brief); it only needs its sibling removed.
4. **No interaction requiring sequencing with T-042.** Whichever order T-042 and T-043 land in, `TabBar.vue` — the only file both could plausibly touch — is not edited by this packet at all. T-042 mounts its new button inside `TabBar`, which is unconditional chrome rendered above both `DashboardView` and the (now mutually exclusive) editor branches; nothing in this packet's `EditorView.vue` edit interacts with `TabBar`'s contents.
5. **`SafariBanner` and `PreferencesDialog`/`PdfImportDialog` are untouched.** They sit above both `DashboardView` and the chrome group already (`EditorView.vue:258-261`) and are not part of the height-competing flex children this packet addresses (`SafariBanner` renders `null`/a fixed banner, not a `flex-1` sibling — confirm this in Implementation Step 1; if it turns out to be a flex-1 sibling too, it must be included in the same `v-else` wrap and this is a correction to record in the execution report, not a silent scope change).

## Visual Contract — binding

This is a structural fix, not a new visual surface — no new element, class, colour, or component is introduced. The binding contract is the exact template restructuring:

**Before** (`EditorView.vue:263-344`, abbreviated):
```html
<!-- Dashboard layout -->
<DashboardView v-if="activeTabId === 'dashboard'" />

<!-- Desktop layout -->
<div v-if="!isMobile && showChrome && store.state.showUI" ...> ... </div>

<!-- Mobile layout -->
<div v-else-if="isMobile && showChrome && store.state.showUI" ...> ... </div>

<!-- Collapsed UI (showUI=false) -->
<div v-else-if="showChrome" ...> ... </div>

<!-- Bare canvas (no chrome, e.g. ?no-chrome) -->
<div v-else ...> ... </div>
```

**After** (binding shape — do not change condition order, only the wrapping):
```html
<!-- Dashboard layout -->
<DashboardView v-if="activeTabId === 'dashboard'" />

<template v-else>
  <!-- Desktop layout -->
  <div v-if="!isMobile && showChrome && store.state.showUI" ...> ... </div>

  <!-- Mobile layout -->
  <div v-else-if="isMobile && showChrome && store.state.showUI" ...> ... </div>

  <!-- Collapsed UI (showUI=false) -->
  <div v-else-if="showChrome" ...> ... </div>

  <!-- Bare canvas (no chrome, e.g. ?no-chrome) -->
  <div v-else ...> ... </div>
</template>
```

Every attribute, class, child and condition inside the four `<div>` blocks is untouched — copy them verbatim from the live file, do not retype them by hand from this packet.

### Banned List

- No new literal colour, font-size outside `text-xs`/`text-[11px]`, or radius outside `rounded-md`/`rounded-lg` — moot unless `DashboardView.vue` is touched, which it must not be (Fixed Decision 3).
- No new `tv()` recipe, no new npm dependency, no inline `style=`, no `@apply`, no edit to `App/src/app.css`.
- No new store, ref, or state field. `activeTabId` already exists and is sufficient.
- Do not reorder or renumber the four existing `v-if`/`v-else-if`/`v-else` branches, and do not change any of their own conditions.
- Do not touch `App/src/app/shell/panels/` (Fixed Decision 2 — this is a display change, not a layout-model change).

## Allowed Changes

- `App/src/views/EditorView.vue` — the single template restructuring above.
- `App/tests/e2e/editor/recovery.spec.ts` — extend the existing dashboard tests (do not create a parallel spec file; this file already owns this exact surface) to assert full-height/exclusivity, per Implementation Step 3.

Nothing else. `App/src/components/DashboardView.vue`, `App/src/components/TabBar.vue`, `App/src/app/tabs/*`, `App/src/app/shell/panels/*`, `App/src/app/editor/active-store/*`, and the locale files must not change.

## Restrictions and Exclusions

- No new dashboard features or content changes — layout exclusivity only, per the stub's own "Out of Scope."
- No change to how or when `activeTabId` becomes `'dashboard'` (`TabBar.vue`, `tabs/index.ts`) — only to what renders once it is.
- No panel-layout schema change, no new host kind, no mutation of `open-potlood:panel-layout` (Fixed Decision 2).
- No change to `SafariBanner`, `PreferencesDialog`, `PdfImportDialog`, or their mount order relative to `TabBar`, unless Implementation Step 1 finds one of them is itself a flex-1 sibling competing for height — in which case stop and report per Fixed Decision 5's note, do not silently fold it in.
- An implementer who wants to cross any of these should stop and report.

## Implementation Steps

1. Re-read `EditorView.vue:211-346` in full and confirm the cited line numbers and the flex-child structure still match; in particular confirm `SafariBanner` (line 260) is not itself a `flex-1` sibling inside `editor-root` (it should be a small fixed banner or render nothing when not on Safari — verify by reading `App/src/components/SafariBanner.vue`, which this packet may read but not change unless Fixed Decision 5's exception applies).
2. Apply the template restructuring in the Visual Contract exactly: wrap the four chrome branches in `<template v-else>` following `DashboardView`'s `v-if`. No other line in the file changes.
3. Extend `App/tests/e2e/editor/recovery.spec.ts`: in `'should render home button and navigate to dashboard view'` (or a new test in the same `describe` block), after asserting `dashboard-root` is visible, additionally assert `editor-panels` (the desktop chrome's own `data-test-id`, `EditorView.vue:272`) has zero matches (`await expect(setup.page.getByTestId('editor-panels')).toHaveCount(0)`), and assert the dashboard root's bounding-box height is within a few pixels of the viewport height minus the tab bar (`36px`, matching `TabBar`'s `h-9`) — proving the height is no longer halved. Also extend `'should switch to dashboard view when all tabs are closed'` with the same `editor-panels` absence assertion, since that path also exercises the fix.
4. Hand-verify in the dev build at a normal desktop width: with one or more tabs open, click home — the dashboard fills the window below the tab bar with no visible editor chrome; click a project or "New Design File" — the editor chrome returns and the dashboard disappears; close the last tab — the dashboard appears full-height with no residual chrome flash.
5. Run, in this order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on `src/views/EditorView.vue tests/e2e/editor/recovery.spec.ts`
   - `bun run check:i18n` (no strings changed; run for parity with sibling packets, expect a no-op pass)
   - `bunx playwright test tests/e2e/editor/recovery.spec.ts --project=openpencil`
   - `bunx playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil` (regression: confirm docked/floating panels still behave identically once chrome is mounted again after leaving the dashboard)

   Do not run `bun run check`, `bun run test` or `bun run test:unit`.
6. Do not claim delivery. This packet stops at source gates; installed desktop verification is only required if the user asks for a build.

## Acceptance Criteria

- [x] With one or more tabs open, clicking home shows only `DashboardView`, filling the window below `TabBar`; `editor-panels` and the mobile/collapsed/bare branches have zero DOM matches while on the dashboard.
- [x] `DashboardView`'s rendered height is the full remaining viewport height (viewport minus `TabBar`'s `h-9`), not roughly half of it.
- [x] Leaving the dashboard (new file, open a project, switch to any existing tab) restores the exact chrome branch appropriate to the current `isMobile`/`showChrome`/`store.state.showUI` state, unchanged from today.
- [x] `App/tests/e2e/editor/recovery.spec.ts` passes, including the new exclusivity and height assertions.
- [x] `App/tests/e2e/panels/basic.spec.ts` and `stacks.spec.ts` stay green — panels behave identically once the editor chrome remounts after leaving the dashboard.
- [x] `DashboardView.vue` is byte-identical to before this packet.
- [x] `open-potlood:panel-layout` is untouched by any dashboard navigation (no mutator in `App/src/app/shell/panels/` is called from this change — trivially true since no panel file is edited).
- [x] Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: `SafariBanner`, `PreferencesDialog` or `PdfImportDialog` turn out to be flex-1 height-competing siblings (Fixed Decision 5); the `<template v-else>` wrapping does not compile or does not produce the expected mutual exclusivity in hand verification; a panel fails to remount correctly (blank body, duplicate host, or a console Teleport warning) after leaving the dashboard; or a change outside the Allowed Changes list is required.

## Revision History

- Revision 1 — 2026-08-14: BRIEF, raised from the user's request batch.
- Revision 2 — 2026-08-15: expanded against live source. Found and diagnosed the actual defect (a missing mutual-exclusivity condition causes the editor chrome to co-render with the dashboard and split the available height), which the stub had not identified — its questions assumed the dashboard's own layout might need rework; it does not. Settled all three open questions from source and ruled out the T-033 rail precedent as inapplicable here with a specific reason.

## Status record

Status: **Done**

Executed 2026-08-20.

Verification:
- `bunx tsgo --noEmit --pretty false` exited 0.
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` exited 0.
- `bunx oxlint -c oxlint.json src/views/EditorView.vue tests/e2e/editor/recovery.spec.ts` exited 0.
- `bun run playwright test tests/e2e/editor/recovery.spec.ts --project=openpencil` exited 0 (3/3 passed).
- `bun run playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil` exited 0 (12/12 passed).
