# T-073 — Persona switcher placement and Essential workflow

Task ID: T-073
Packet state: **Blocked — partially expanded (see Expansion Status)**
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-084 (persona model — must land first, Brief); T-032a (per-persona panel sets, Blocked); T-085 (prototype panel, for Dev's defaults, Brief)
Related: T-069 (top-bar Export, Done), T-035/T-036 (contextual surfaces, both Ready not Done), T-031d (top chrome consolidation, Done)
Prepared from: the 2026-08-21 placement request, superseded in its placement and naming by the user's 2026-08-24 decision
Expanded at: 2026-08-24 Africa/Johannesburg — **partial, interrupted**
Expanded against: live `App/` source named in Verified Starting State, read directly on 2026-08-24. `Plan/plan.md` reread the same day.
Delivery: named source gates + browser check

## Expansion Status — read before anything else

This packet was **partially expanded on 2026-08-24 and the session ended early**. Everything under *Verified Starting State*, *Corrections to the Brief*, *Fixed Decisions 1–8*, *Allowed Changes* and *Restrictions* is expanded against live source and is binding. The sections marked **NOT YET EXPANDED** are not.

Still owed before this packet can move to Ready:

1. A binding **Visual Contract** for the persona bar (exact classes, sizes, spacing, icons, focus and active styling) plus its **Banned List**, in the style of T-036. UI packets executed by weaker models need a binding visual contract, not prose.
2. **Implementation Steps** as numbered, file-scoped edits.
3. **Acceptance Criteria** checklist and the **Execution Report Contract**.
4. The exact **E2E test list** for `tests/e2e/toolbar/capability.spec.ts` (rewrite plan per existing test, lines 49–257).
5. Named **gate commands** with exact paths (the shapes are recorded in Verification below; the file list must be finalised against the final Allowed Changes).
6. A decision on the **T-036 escalation** in the Dependency Note — reaffirm bottom placement with reasons, or escalate as a product revision. Source reading is done; the decision is not made.

Do not execute this packet in its current state.

## Intended Outcome

A three-segment persona switcher — `Essential | Advanced | Dev` — sits in the **top chrome** as a centred pill row with an icon and a label per segment. The bottom-toolbar switcher is removed. Essential offers a genuinely calmer editing surface aimed at a non-designer; Advanced preserves every current control and layout; Dev matches Advanced except for its default panels.

## Supersession notice

Revision 1 specified a **two-segment `Simple | Full` control in the upper-right chrome beside Export**. Both halves are superseded:

- naming and arity → `Essential | Advanced | Dev` (three segments), per T-084;
- placement → a **top-centre persona bar**, not an upper-right control beside Export.

The upper-right-beside-Export decision is withdrawn, not merely re-argued. Do not reinstate it without a new decision.

## Essential's target (binding product framing)

Essential targets **the everyday person who is not a designer**. The success test is not "fewer buttons"; it is that someone with no design vocabulary can produce something good. Every reduction in Essential must be justified against that test, and anything removed must remain reachable by switching persona. Reducing the surface without adding guidance makes Essential worse, not simpler — see the Dependency Note.

## Verified Starting State

Verified against live `App/` source on 2026-08-24. Paths are `App/`-relative.

| Path | Exact symbol / current span | Binding fact |
| --- | --- | --- |
| `src/app/shell/capability.ts` | whole file, 55 lines | Still **pre-T-084**: `CAPABILITY_VERSION = 1`, `type Capability = 'simple' \| 'full'`, `DEFAULT_CAPABILITY.capability = 'full'`, `normalise()` (line 17), one `useLocalStorage` on `open-potlood:capability` with `writeDefaults: false`, `appCapability`/`capability`/`isSimple` (lines 44-46), `setCapability()` (line 48). T-084 rewrites this; this packet does not. |
| `src/components/Toolbar/CapabilitySwitcher.vue` | whole file, 50 lines | The landed control. `SegmentedControl` with `data-test-id="capability-switcher"`, two options built from `menu.capabilitySimple`/`capabilityFull`, per-option icons `icon-lucide-sparkles` (`data-test-id="capability-simple"`) and `icon-lucide-sliders-horizontal` (`data-test-id="capability-full"`), `switcherUi.root = 'gap-1 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md'`, `item = 'h-8 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-accent'`, `size="md"`, `class="max-w-[calc(100vw-32px)]"`. This file is **re-targeted, not deleted** (Fixed Decision 3). |
| `src/components/Toolbar/DesktopToolbar.vue` | root element line 37; `<CapabilitySwitcher />` line 38 | Root is `absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2`, a **column** holding the switcher above the tool strip (`data-test-id="toolbar"`, lines 39-42). Removing line 38 leaves a single child; the strip's own position is unaffected because the column is bottom-anchored. |
| `src/views/EditorView.vue` | lines 268-290 | Desktop branch: `v-if="!isMobile && showChrome && store.state.showUI"`. Canvas wrapper at line 274 is `<div class="relative flex min-w-0 flex-1">` holding `<EditorCanvas>` (282) and `<Toolbar />` (283). This wrapper is the **only positioning context** that gives a top-centred overlay the same horizontal centring as the bottom tool strip. |
| `src/components/Toolbar/Toolbar.vue` | lines 9-10, line 84 | `import { isSimple }`; `<ToolbarRoot :tools="isSimple ? simpleToolSet(EDITOR_TOOLS) : EDITOR_TOOLS">`. **This is the last consumer of `isSimple`** outside `capability.ts` (grep-verified). `DesktopToolbar` renders only when `!isMobile`; `MobileToolbar` otherwise. |
| `src/components/Toolbar/capability-tools.ts` | `simpleToolSet(tools)` (line 26) | Curated six-entry reduction: SELECT, FRAME (flyout intact — protects T-027 `FramePresetPopover`), RECTANGLE (flyout intact), TEXT, HAND, PEN (collecting flyout of PEN/PENCIL/BRUSH/SHAPE_BUILDER/BARCODE/BARCODE_EAN13). Header comment still says "Simple capability mode" and must be re-worded to Essential. The function name is a rename candidate — see Open Decision 2. |
| `src/components/TabBar.vue` | lines 89-92 (`TabsRoot`), 176 (`<div class="min-w-0 flex-1" />`), 177-189 (`desktop-shell-chrome`) | The tab-bar row is `flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-canvas`. Order: `AppMenu` → home → `TabsList` → new-tab → flex spacer → chrome (CollabPanel incl. Export, ZoomDropdown, `app-toggle-ui`). The row **scrolls horizontally** and its content is left-packed; there is no free centred slot. See Fixed Decision 1. |
| `src/components/CollabPanel/CollabPanel.vue` | line 13 | T-069's Export popover lives inside `CollabPanel`, inside `desktop-shell-chrome`. The superseded "beside Export" placement would have landed here. Do not. |
| `src/components/ui/SegmentedControl.vue` | whole file, 69 lines | `SegmentedControlProps { options, label?, size?, ui? }`, `defineModel<string>({ required: true })`, `#option` slot receiving `{ option, selected }`, roving-focus behaviour from `SegmentedControlRoot`/`Item` in `@open-pencil/vue`. Each item gets `:aria-label="option.label"` — the E2E spec's `getByRole('button', { name: ... })` and `document.activeElement.getAttribute('aria-label')` assertions depend on this. |
| `src/theme/segmented-control.ts` | `SegmentedControlTheme`, `variants.size` | Source of `size="md"`. Read before authoring the Visual Contract. |
| `packages/vue/src/i18n/messages/menu.ts` | lines 44-46 | `capability: 'Capability'`, `capabilitySimple: 'Simple'`, `capabilityFull: 'Full'`. **English is the only locale** — `packages/vue/src/i18n/messages/` holds `commands, dialogs, menu, pages, panels, tools, variable-types` and no per-language files. There is no `check:i18n` script. |
| `src/app/shell/menu/schema.ts` | lines 157-158 | `{ id: 'capability-simple', label: 'Simple', checkbox: true }`, `{ id: 'capability-full', label: 'Full', checkbox: true }`, in the View group after `reset-panel-layout`. |
| `src/app/shell/menu/app-menu.ts` | line 16 import; 53-54 label map; 111-112 actions; 130-133 `checked()`; 171-175 `onCheckedChange()` | Browser AppMenu wiring. All four sites are keyed by the two ids and must become three. |
| `src/app/shell/menu/use.ts` | line 18 import; 116-117 actions | Second, separate action table with the same two ids. Both files must change together. |
| `desktop/generated/menu.json` | lines 215-224 | **Generated, checked in.** Holds `capability-simple`/`capability-full`. Regenerated by `bun run generate:tauri-menu` (`tools/tauri-menu/src/generate.ts`, a pure read of `APP_MENU_SCHEMA` → `writeFileSync`). See Fixed Decision 7 and the delivery caveat in Verification. |
| `tests/e2e/toolbar/capability.spec.ts` | 257 lines; header lines 1-3 | Nine tests plus a two-block `describe`. Header carries `@ts-nocheck` and `oxlint-disable open-pencil/no-direct-storage-access` — **preserve all three lines**. Local helpers `closeMenu`, `openAppMenu`, `openGroup` (13-39). `beforeEach` clears `open-potlood:capability` (41-47). Placement test at 49 asserts "above tool strip". Arity tests at 62, 76. Roving focus at 151. Persistence at 177. Corrupt-storage → Full at 191. View-menu at 207. Absence in `?no-chrome` and under `showUI=false` at 237-257. |
| `tests/e2e/shell/chrome.spec.ts` | lines 8-28 | T-031d's guard: `desktop-shell-chrome` count 1, `app-toggle-ui` in the tab-bar row, `export-popover-button` and `zoom-dropdown-trigger` exactly once. **This spec must pass unedited** — it is the mechanical proof that no band was re-added. |
| `package.json` | scripts block | `dev` (vite, port 1420), `check:vue`, `lint`, `test`, `test:unit`, `generate:tauri-menu` exist. `bun run check`, `lint`, `test`, `test:unit`, `build` are umbrella commands and remain prohibited. |
| `AGENTS.md` | lines 11-15 | Smallest proportionate evidence; packet closes at named source gates plus a `bun run dev` browser check; **generated `desktop/generated/menu.json` is explicitly named as a surface a browser check cannot prove**. |

## Corrections to the Brief

1. **The brief's "top chrome" is not a free slot.** `TabBar.vue`'s row is left-packed, horizontally scrollable and 36 px tall, with the T-069 Export/Zoom/UI-toggle group hard against the right edge. A centred pill inside that row would either overlap tabs once several are open or force the row taller — the second is exactly the band T-031d removed. Fixed Decision 1 resolves this without reinstating a band.
2. **The brief says the bottom switcher is "removed"; the component is not.** Only the mount at `DesktopToolbar.vue:38` is removed. `CapabilitySwitcher.vue` is re-targeted in place (Fixed Decision 3) so the landed roving-focus, aria-label and `#option` slot behaviour that the E2E spec asserts survives.
3. **The brief did not account for the menu route's cost.** Three personas means `schema.ts`, `app-menu.ts` (four sites), `use.ts` and the checked-in `desktop/generated/menu.json` all change. The last one is named in `AGENTS.md` as unprovable by browser check. Fixed Decision 7 and the Verification caveat handle it; do not discover this mid-execution.
4. **T-084 cannot land without touching the menu files.** `app-menu.ts:111-112,130-133,171-175` and `use.ts:116-117` call `setCapability('simple'|'full')`; after T-084 narrows `Capability`, those calls fail typecheck. T-084's Allowed Changes must cover a minimal retarget (`'simple'`→`'essential'`, `'full'`→`'advanced'`) that **keeps the existing ids and labels**. This packet then owns the id rename, the third item and the labels. If T-084's execution report shows it already renamed the ids, reconcile rather than duplicate — and record the drift.
5. **`isSimple` has exactly one external consumer.** `Toolbar.vue:9,84`. The brief's "delete the deprecated alias once every consumer is on the persona-keyed helpers" is therefore a two-line change, not a sweep. Grep-verified 2026-08-24.
6. **The switcher's visibility gating is inherited, not authored.** It is absent in `?no-chrome` and under `showUI=false` purely because `DesktopToolbar` is only rendered by `EditorView.vue`'s desktop branch. Any new mount point must inherit the same gate, or `tests/e2e/toolbar/capability.spec.ts:237-257` fails. This is a real trap: mounting the bar in `TabBar.vue` would **break** it, because `TabBar` renders above all four layout branches and is not gated on `showUI`.

## Fixed Decisions

1. **Placement: a top-centred overlay inside the canvas wrapper, not inside the tab-bar row.** The persona bar renders as an absolutely positioned pill at the top centre of `EditorView.vue`'s canvas wrapper (`src/views/EditorView.vue:274`), on the same vertical axis as the bottom tool strip and using the same `z-10` layer. This satisfies "top chrome, centred" as a visual result, adds **no row and no band**, cannot collide with tabs, and inherits the desktop/`showChrome`/`showUI` gate for free. Reserved vertical offset and exact classes belong to the Visual Contract (not yet expanded).

2. **Mount it from `DesktopToolbar.vue`, as a sibling root node.** `DesktopToolbar.vue`'s template becomes a two-root fragment: the new persona bar (top-anchored) and the existing bottom-anchored column (unchanged, minus line 38). This keeps `EditorView.vue` **unedited**, keeps one mount site for both toolbar surfaces, and preserves the inherited visibility gate. Do not add a mount in `EditorView.vue`, `TabBar.vue`, `Toolbar.vue` or `MobileToolbar.vue`.

3. **Re-target `CapabilitySwitcher.vue`; do not create a second control and do not delete the file.** Keep `SegmentedControl`, the `#option` slot, `size="md"` and the roving-focus behaviour. Change: three options, three icons, three test ids, the aria-label source, and the container classes per the Visual Contract. Renaming the file/component to `PersonaSwitcher.vue` is Open Decision 1.

4. **Test ids are renamed with the personas, and the old ids do not survive.** `capability-simple` → `persona-essential`, `capability-full` → `persona-advanced`, new `persona-dev`; the root `capability-switcher` → `persona-switcher`. Every rename must be applied to `tests/e2e/toolbar/capability.spec.ts` in the same change. Do not keep a compatibility alias id.

5. **Exactly one switcher exists.** After this packet, `getByTestId('persona-switcher')` has count 1 and `getByTestId('capability-switcher')` has count 0, app-wide. Assert both.

6. **Essential's tool policy is the existing curated set, unchanged in content.** `Toolbar.vue:84` becomes persona-keyed: Essential receives `simpleToolSet(EDITOR_TOOLS)`; Advanced and Dev both receive `EDITOR_TOOLS`. Do not add a third tool set, do not alter which six entries the curated set yields, and do not touch the FRAME or RECTANGLE flyouts (T-027). Shortcuts must continue to select hidden tools in Essential — the landed behaviour proven at `capability.spec.ts:111-137` survives unchanged.

7. **The menu route becomes three items, and the generated native menu is regenerated but not proven here.** Rename the ids to `capability-essential` / `capability-advanced` and add `capability-dev` (labels `Essential`, `Advanced`, `Dev`) in `schema.ts:157-158`, and update all four `app-menu.ts` sites plus `use.ts:116-117`. Then run `bun run generate:tauri-menu` and commit the regenerated `desktop/generated/menu.json`. **Record explicitly in the Execution Report that the native Tauri menu is not verified by this packet** (`AGENTS.md:13`); browser-check the `AppMenu` View group instead, and escalate desktop verification to the user rather than building or installing.

8. **Delete `isSimple` in this packet.** Move `Toolbar.vue:9,84` onto T-084's persona helpers, then remove the deprecated alias from `capability.ts`. This is the one edit to `capability.ts` this packet is authorised to make (T-084's Open Decision 1 assigns it here). Confirm at pre-flight that grep finds no other consumer.

9. **NOT YET EXPANDED — Visual Contract and Banned List.** Must be authored before execution. Until then the bar's exact geometry, iconography and states are undefined and the packet is not executable.

## Open Decisions

1. **Rename `CapabilitySwitcher.vue` → `PersonaSwitcher.vue`?** Recommended: yes, together with `capability-tools.ts`'s header wording, because "capability" no longer names the user-visible concept. Cost is one import in `DesktopToolbar.vue:5`. Decide at expansion completion, not during execution.
2. **Rename `simpleToolSet()` → `essentialToolSet()`?** Recommended: yes for the same reason; the function body and output do not change. One import site (`Toolbar.vue:10`).
3. **Do the storage key and menu ids keep the word "capability"?** `open-potlood:capability` is T-084's to decide and is **not** renamed here (renaming it would reset every stored choice). Menu ids are renamed per Fixed Decision 7 because they are not persisted.
4. **NOT YET EXPANDED — what, if anything, this packet adds to Essential beyond the tool reduction.** With T-032a Blocked and T-035/T-036 both Ready-not-Done, the honest current answer is "nothing, and the gap is recorded". See the Dependency Note; that answer must be confirmed or replaced before Ready.

## Allowed Changes — provisional, pending full expansion

Expected to be modifiable:

- `src/components/Toolbar/CapabilitySwitcher.vue` (re-targeted; possibly renamed per Open Decision 1)
- `src/components/Toolbar/DesktopToolbar.vue`
- `src/components/Toolbar/Toolbar.vue`
- `src/components/Toolbar/capability-tools.ts` (comment wording; possible rename per Open Decision 2)
- `src/app/shell/capability.ts` (**deletion of `isSimple` only**)
- `src/app/shell/menu/schema.ts`, `src/app/shell/menu/app-menu.ts`, `src/app/shell/menu/use.ts`
- `desktop/generated/menu.json` (**generated output only — never hand-edited**)
- `packages/vue/src/i18n/messages/menu.ts`
- `tests/e2e/toolbar/capability.spec.ts`

## Restrictions and Exclusions

Binding. Stop and report before crossing one of these lines.

- Reconfirm at pre-flight that **T-084 shows Done** in `Plan/plan.md`. T-032a and T-085 govern Dev's *panels*, not this packet's control; if they are still open, ship the switcher and record Dev's default-panel limitation rather than implementing panel defaults here.
- **Do not re-add a chrome band.** `tests/e2e/shell/chrome.spec.ts` must pass unedited. If the persona bar cannot be placed without a band, stop and report.
- Do not mount the persona bar in `TabBar.vue`, `EditorView.vue`, `Toolbar.vue` or `MobileToolbar.vue` (Correction 6).
- Do not place the control beside Export or anywhere in `desktop-shell-chrome`; that decision is withdrawn.
- Do not shift, restyle or reposition the bottom tool strip (`DesktopToolbar.vue:39-42` and its column geometry).
- Do not change the persona data model, storage key, version or migration — that is T-084's. The only `capability.ts` edit permitted is deleting `isSimple`.
- Do not add per-persona panel behaviour (T-032a) or register the prototype panel (T-085).
- Do not reintroduce `Workspace | Focus | Overview`, alter export behaviour, or mutate any persona's panel record when switching.
- Do not change which tools the curated set yields, or the FRAME/RECTANGLE flyouts.
- Do not hand-edit `desktop/generated/menu.json`.
- **No reference to Affinity or Canva** in code, labels, comments or test names.
- No CanvasKit, scene graph, export, MCP, Rust or Tauri source change. No dependency, version bump, build, install or Git work.
- No umbrella command: not `bun run check`, `check:vue`, `lint`, `test`, `test:unit` or `build`.

## Dependency Note — the part that actually decides whether Essential works

Essential's usefulness is governed less by this packet than by **T-036**, which places the contextual property surface **at the bottom, directly above the tool strip** — explicitly because a top bar "would re-add the band T-031d removed" (`T-036 § Placement decision`). T-035's floating action bar *does* anchor to the selection, 8 px above the bounding box.

Both were re-read on 2026-08-24. **The decision between reaffirming and escalating T-036's placement was not made before this session ended.** Note for whoever finishes this expansion: Fixed Decision 1 places the persona bar in a top-centre overlay, which weakens T-036's original argument — the overlay proves a top surface can exist without a band. That is new information T-036's placement decision did not have, and it must be weighed rather than ignored.

If Essential ships with a docked properties panel and a bottom bar, it will be a smaller Advanced rather than an easier tool. Whatever is decided, record it: with T-032a Blocked and T-035/T-036 not Done, this packet currently delivers a **reduced surface with none of the guidance that was supposed to replace what it removes**. That is a real usability gap and must be stated plainly in the Execution Report, not papered over.

## Verification — shapes only, NOT YET FINALISED

Run from `App` at `C:/Users/User/Documents/OpenPotlood/App`.

Development loop: `bunx playwright test tests/e2e/toolbar/capability.spec.ts --project=openpencil`.

Final gates, run once, in order — the file lists must be finalised against the final Allowed Changes before this packet is Ready:

1. `bunx tsgo --noEmit --pretty false` — exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — exit 0.
3. `bunx oxlint -c oxlint.json --type-aware --type-check <final file list>` — exit 0.
4. `bunx playwright test tests/e2e/toolbar/capability.spec.ts --project=openpencil` — exit 0.
5. `bunx playwright test tests/e2e/shell/chrome.spec.ts --project=openpencil` — exit 0, **file unedited** (the no-band proof).
6. `bun run generate:tauri-menu`, then confirm the `desktop/generated/menu.json` diff contains only the three persona entries.

Then `bun run dev` (Vite, port 1420) and browser-check all three personas at ≥1440 px: placement and centring, exactly one switcher, per-persona tool visibility, keyboard roving focus, the View-menu route and its ticks, persistence across reload, and `?no-chrome` / `showUI=false` absence.

**Delivery caveat:** browser proof does not cover `desktop/generated/menu.json` (`AGENTS.md:13`). Do not build or install to close that gap; report it and let the user decide.

## Stop Conditions

- T-084 is not Done, or its landed persona exports differ from its packet.
- The persona bar cannot be placed without re-adding a band, or `tests/e2e/shell/chrome.spec.ts` needs editing to pass.
- The bar's mount does not inherit the desktop/`showChrome`/`showUI` gate, so the `?no-chrome` or `showUI=false` absence tests fail.
- `SegmentedControl`'s roving focus or `aria-label` behaviour changes, breaking the landed keyboard assertions.
- `isSimple` turns out to have consumers beyond `Toolbar.vue`.
- The menu id rename cannot be regenerated cleanly, or the generated diff contains anything beyond the persona entries.
- A named gate or browser check fails. Record exact command, exit code and output; do not weaken the criterion.

## NOT YET EXPANDED

- Visual Contract and Banned List (Fixed Decision 9)
- Implementation Steps
- Acceptance Criteria
- Execution Report Contract
- Per-test rewrite plan for `tests/e2e/toolbar/capability.spec.ts`
- Final gate file lists

## Revision History

- Revision 1 — 2026-08-21: captured as a two-segment `Simple | Full` control beside Export.
- Revision 2 — 2026-08-24: rewritten for the three-persona model; placement moved to a top-centre persona bar; the beside-Export decision withdrawn. Brief only.
- Revision 3 — 2026-08-24: **partial expansion against live source, interrupted by session end.** Added the verified starting state for eighteen live seams, six corrections and eight binding fixed decisions — notably that the tab-bar row has no free centred slot, that the bar must mount from `DesktopToolbar.vue` into the canvas wrapper to inherit its visibility gate, that `isSimple` has exactly one external consumer, and that the three-item menu route drags in the checked-in `desktop/generated/menu.json`. Visual Contract, Implementation Steps, Acceptance Criteria, the test rewrite plan and the T-036 escalation decision remain unwritten. State stays Blocked.

## Status record

2026-08-21 — Captured from the placement and usefulness request as `Simple | Full` beside Export.

2026-08-24 — Rewritten for the three-persona model. Placement moved to a top-centre persona bar; the beside-Export decision withdrawn. Dependency-blocked behind T-084 and, for Dev's defaults, T-032a and T-085.

2026-08-24 (partial expansion receipt) — Read directly: `src/app/shell/capability.ts`, `src/components/Toolbar/{CapabilitySwitcher,DesktopToolbar,Toolbar}.vue`, `capability-tools.ts`, `src/components/TabBar.vue`, `src/components/ui/SegmentedControl.vue`, `src/views/EditorView.vue`, `src/app/shell/menu/{schema,app-menu,use}.ts`, `desktop/generated/menu.json`, `tools/tauri-menu/src/generate.ts`, `packages/vue/src/i18n/messages/menu.ts`, `package.json`, `AGENTS.md`, `tests/e2e/toolbar/capability.spec.ts`, `tests/e2e/shell/chrome.spec.ts`, and the T-084, T-085, T-032a, T-035, T-036, T-069 and T-031d packets. `App/` source and `Plan/plan.md` were read-only; only this packet file was rewritten. Expansion stopped early at the user's instruction; see Expansion Status for what is still owed.
