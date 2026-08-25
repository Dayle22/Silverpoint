# T-032 (SUPERSEDED) - Affinity-style desktop-toolbar layout switcher

> **DEAD PACKET — DO NOT EXECUTE.**
> This is T-032 revisions 1–2, superseded in full by the 2026-08-17 beginner-audience
> review. Its `Workspace | Focus | Overview` design would have shipped two of three
> segments visibly disabled, and it borrowed Affinity's persona look with mere
> window-layout semantics.
>
> The live T-032 is **`Plan/Packets/T-032-capability-switch.md`** (`Simple | Full`),
> with its panel half in **`Plan/Packets/T-032a-capability-panel-sets.md`**.
> Neither of those is derived from this file — do not reconcile against it.
>
> Retained on disk only because this project has no version control, so a delete
> would be irreversible. It is deliberately absent from `Plan/plan.md`.
> Marked dead 2026-08-20.

Task ID: T-032
Packet state: Superseded — not executable
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: UX-001, T-030, T-031, T-031a
Prepared from: the user's 2026-08-07 Canva-like layout-view request, 2026-08-11 Affinity-style reference, and live toolbar/menu/layout seams
Expanded at: 2026-08-11T08:52:32+02:00
Expanded against plan snapshot: `Plan/plan.md` read 2026-08-11; this project has no numeric plan-version field
Expansion route: JUDGED from the user's “go for it”

## Request Coverage

- Add layout-view options to the desktop toolbar as the single discoverable entry point for a more Canva-like workspace.
- Present them as a prominent, persistent icon-and-label segmented switcher, inspired by the supplied Affinity reference — not a small icon, compact flyout, or ordinary menu.
- Keep the interface local, reversible and useful for existing design work rather than copying Canva branding or behaviour wholesale.

## Intended Outcome

A prominent horizontal workspace switcher sits with the desktop toolbar and exposes the available views as large, labelled segments. It has a clearly filled active segment, supports resetting the current arrangement, and does not disturb document artwork or the mobile/bare-canvas branches. The control is visually an editing-mode switch, not a generic settings menu.

## Verified Starting State

- `App/src/components/Toolbar/DesktopToolbar.vue` is the desktop-only bottom-centred toolbar and is the correct host for the control.
- `App/src/app/shell/menu/schema.ts` already owns View-menu controls, while `App/src/app/shell/layout-storage.ts` persists the three-column splitter layout.
- T-031 closed on 2026-08-11 with focused source/browser gates and installed Windows evidence. T-031a now owns the user-confirmed general stackable-dock extension; T-032 must consume its final normalised panel-layout API.

## Fixed Interaction Direction

- Use an always-visible horizontal segmented control with an icon and text label in each segment; the active segment uses the existing theme accent and a high-contrast label.
- The initial segments are **Workspace** (the saved/default panel layout), **Focus** (T-033), and **Overview** (T-034). Disabled or unavailable modes must explain why rather than disappear.
- Place the control as a distinct, roomy group next to or immediately above the existing bottom-centred tool strip. Do not squeeze it into the tool-button row or displace drawing tools.
- Its visual language may take inspiration from the reference's large persona selector, but must use OpenPotlood names, icons, theme tokens, and keyboard/accessibility patterns.

## Original Scope Questions (resolved below)

- Decide whether the active layout is global, per document tab, or reset-on-launch. Default recommendation: global local preference, separate from `.fig` data.
- Confirm exact segment dimensions after a narrow-window layout check; each remains large enough to read and click without hiding the existing tool palette.
- Decide whether the native View menu mirrors the toolbar control for keyboard discoverability.

Resolved by judged expansion:

- Store the active view globally and locally, separate from `.fig`, tab state, `open-pencil:editor-layout` and `open-potlood:panel-layout`.
- Mirror all view choices and reset in the View menu. Use checked items for the active view; do not introduce a second command framework.
- Place the switcher in its own row immediately above the tool strip. Keep icon and visible label for every segment; cap the row to `calc(100vw - 32px)` and allow horizontal overflow on narrow desktop widths rather than hiding labels or tools.
- T-032 delivers the state, prominent control and menu integration. `Focus` and `Overview` remain visibly disabled with explanatory tooltips until T-033 and T-034 enable their respective modes.

## Constraints

- Do not start implementation until T-031a closes with its panel-layout API and installed evidence reconciled.
- Reuse validated local persistence and existing toolbar/menu/i18n conventions; do not add a dependency.
- No CanvasKit/scene-graph changes, document mutation, export changes, MCP changes, mobile redesign, or Canva branding.

## First Expansion Reads

`Plan/endgoal.md`, `Plan/plan.md`, `App/AGENTS.md`, T-030, T-031, `src/components/Toolbar/DesktopToolbar.vue`, `src/components/Toolbar/Toolbar.vue`, `src/app/shell/layout-storage.ts`, `src/app/shell/preferences.ts`, `src/app/shell/menu/schema.ts`, and `src/views/EditorView.vue`.

## Acceptance Direction

- [ ] The layout switcher is prominent, legible, and immediately communicates the active workspace without cluttering tool selection.
- [ ] Every segment has both an icon and visible label; the active state remains recognisable in every supported theme without relying on colour alone.
- [ ] View selection is keyboard-accessible, labelled, and persisted only at the agreed scope.
- [ ] Reset restores a safe default without losing artwork, panel content, or document state.
- [ ] Existing toolbar flyouts, View-menu controls, `?no-chrome`, and mobile behaviour remain intact.

## Stop Conditions

Stop and return to planning if T-031 needs a broader panel-system redesign, a candidate view requires changing document data, or the selected layouts are not agreed.

## Expansion Research

| Live path | Verified seam | Binding treatment |
| --- | --- | --- |
| `App/src/components/Toolbar/DesktopToolbar.vue` | Bottom-centred absolute desktop tool strip at `bottom-5`; mobile has a separate component | Add `WorkspaceViewSwitcher.vue` as a distinct row above the existing strip; do not mix view segments into the tool loop |
| `App/src/components/Toolbar/Toolbar.vue` | Owns desktop/mobile branch and toolbar state | Desktop only; pass no document mutation capability into the switcher |
| `App/src/app/shell/panels/layout.ts` | Global versioned panel layout and `resetPanelLayout()` | Reset calls this API; never duplicate panel state in the workspace-view record |
| `App/src/app/shell/layout-storage.ts` | Three-column splitter percentages under `open-pencil:editor-layout` | Preserve unchanged; workspace reset does not erase saved splitter widths |
| `App/src/app/shell/preferences.ts` | Versioned `useLocalStorage` + `normalise()` pattern | Reuse in new `src/app/shell/workspace-view.ts` with key `open-potlood:workspace-view` |
| `App/src/app/shell/menu/schema.ts` | Shared View menu schema | Add Workspace, Focus, Overview and Reset workspace layout entries after Toggle UI and before developer-only items |
| `App/src/app/shell/menu/use.ts` | Native/Tauri action map | Wire the same state transitions and reset as the browser menu |
| `App/src/app/shell/menu/app-menu.ts` | Browser in-app menu action/checked maps and translated labels | Add action, checked and translation mappings; keep parity with native menu |
| `App/packages/vue/src/primitives/SegmentedControl/` and `App/src/theme/segmented-control.ts` | Existing accessible roving-focus segmented-control primitive | Reuse the primitive; extend styling locally for the intentionally larger icon-and-label treatment |
| `App/packages/vue/src/i18n/messages/{menu,panels}.ts` plus locale JSON | Typed defaults and eight translated locales | Add every visible label and tooltip to defaults and every locale; `check:i18n` is binding |

Relevant skill: `manage-projects` supplied the executable-packet and judged-assumption rules. No new runtime dependency or web research is needed; the implementation route is entirely local.

## Fixed Data and Interaction Contract

- Create `WorkspaceView = 'workspace' | 'focus' | 'overview'` and a versioned record `{ version: 1, activeView }` in `src/app/shell/workspace-view.ts`.
- Storage key: `open-potlood:workspace-view`. Invalid JSON, versions or modes normalise to `workspace`. State is global across tabs and persists across reload/relaunch; it never enters document or `.fig` data.
- Export `workspaceView`, `setWorkspaceView(view)`, `resetWorkspaceView()` and `isWorkspaceViewAvailable(view)`. Availability is explicit: Workspace is always enabled; T-033 and T-034 enable their modes when implemented.
- The switcher uses the existing accessible `SegmentedControlRoot`/`SegmentedControlItem`. Each 40–48 px-high segment contains a Lucide icon plus the visible labels `Workspace`, `Focus`, and `Overview`; active state uses filled surface, border/weight/icon treatment and `aria-pressed`/primitive state so colour is not the only cue.
- Disabled future modes remain focusable through an adjacent explanatory tooltip or accessible description; they do not silently accept selection.
- `Reset workspace layout` sets the active view to Workspace and calls T-031 `resetPanelLayout()`. It does not touch artwork, selection, zoom, tabs, preferences, splitter widths, `.fig` state or exports.
- View-menu items mirror the toolbar. Keep browser and native actions behaviourally identical.

## Allowed Changes

`src/app/shell/workspace-view.ts`; a new `src/components/Toolbar/WorkspaceViewSwitcher.vue`; desktop-only integration in `DesktopToolbar.vue`; View-menu schema and both action adapters; typed i18n defaults and all locale JSON; focused app-shell unit tests; focused toolbar/menu Playwright tests; the execution receipt and delivery version files only after source gates pass.

## Excluded Scope

No T-031 redesign, no Focus behaviour (T-033), no Overview rendering/navigation (T-034), no scene graph/CanvasKit/document/export/MCP change, no mobile or `?no-chrome` control, no new dependency, no Canva/Affinity naming or copied assets, and no release/publishing work.

## Implementation Steps

1. Confirm T-031 is closed with its focused checks and installed evidence; reread the named state/menu/toolbar seams and stop on drift affecting this contract.
2. Add the pure versioned workspace-view store and focused tests for defaults, valid modes, corrupt values, version mismatch, persistence and reset isolation.
3. Build `WorkspaceViewSwitcher.vue` with the existing segmented-control primitive, fixed icons/labels/test IDs (`workspace-view-switcher`, `workspace-view-workspace`, `workspace-view-focus`, `workspace-view-overview`) and disabled explanations.
4. Mount it as a separate row above the existing desktop tool strip. At narrow widths keep every label and the tool strip usable through a bounded overflow treatment; do not change mobile rendering.
5. Add View-menu entries and identical browser/native actions, checked states and reset behaviour. Add all locale strings.
6. Add Playwright coverage for prominence, icon+label content, keyboard roving/activation, active state in each theme, disabled explanations, persistence, menu parity, reset isolation, narrow desktop width, and absence from mobile/bare-canvas branches.
7. Run `bun test ./tests/engine/app/shell/workspace-view.test.ts ./tests/engine/app/shell/menu/`, `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint on touched paths, `bun run check:i18n`, and the focused toolbar/menu Playwright spec with `bunx playwright test <exact-specs> --project=openpencil`. Do not run umbrella checks without explicit instruction.
8. After source gates pass, run `cd App && bun run dev` and verify in the browser: the switcher's prominence and active state, browser-menu parity, persistence across a reload, reset isolation, and narrow-desktop width. Do not build, install, or bump version files. Native-menu parity and installed identity/hash are deferred to a batched delivery the user authorises separately.

## Acceptance Criteria

- [ ] The desktop toolbar shows a separate prominent three-segment icon-and-label switcher without displacing drawing tools.
- [ ] Workspace is selectable; Focus and Overview remain visible but honestly disabled until their packets enable them.
- [ ] Keyboard roving, activation, accessible labels/descriptions and non-colour active cues work in light, grey, dark and midnight themes.
- [ ] Active view persists globally across tab switches and relaunch; corrupt storage falls back to Workspace.
- [ ] View-menu state matches the toolbar in browser and native routes; reset affects only workspace/panel layout state.
- [ ] Narrow desktop, mobile, `showUI=false`, `?no-chrome`, tool flyouts, canvas input, document data and exports remain unchanged.
- [ ] Focused tests/checks and installed Windows verification pass before delivery is claimed.

## Verification and Evidence

Use the exact focused commands in Step 7. Record test counts/exits, screenshots or bounding boxes proving the prominent and narrow layouts, keyboard/ARIA evidence, storage before/after, reset-isolation values, menu parity, all-theme results, installed executable path/version/SHA-256 and responsiveness. Stop after two repeated failures with the same cause rather than widening scope.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| Active view is global and persisted | T-031 layout is app-wide and view choice is shell preference, not document content | User expects each tab to remember a separate view or Overview to reset on launch | Change only workspace-view storage/state consumers; never migrate `.fig` |
| Switcher is a separate row above tools | Preserves the requested prominence and protects the existing tool loop | Live narrow-width QA shows unacceptable canvas obstruction | Adjust row placement/overflow without changing data contract |
| Focus and Overview ship disabled in T-032 | Prevents dead controls before dependent behaviours exist | T-032 and dependants are deliberately delivered atomically | Enable only when the corresponding implementation is present and verified |

Outstanding questions: none. Any request for per-document layouts, additional modes or editable workspace presets is new scope.

## Revision History

- Revision 2 — 2026-08-11: expanded the brief against live toolbar, segmented-control, panel persistence and menu seams; resolved persistence, placement, menu parity and dependency behaviour.

## Status record

Status: **Superseded — not executable.** Never implemented.

Superseded 2026-08-17 by the beginner-audience review; marked dead 2026-08-20. The live T-032 is `Plan/Packets/T-032-capability-switch.md`, with its panel half in `Plan/Packets/T-032a-capability-panel-sets.md`. This packet is absent from `Plan/plan.md` by design.

Historical only — the status this file carried while it was still the live T-032:

> Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:
>
> Prepared (all panel-model/chrome dependencies cleared; implementation not started)
