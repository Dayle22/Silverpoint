# T-031 - Free-floating panels with snapping and double-click minimise

Task ID: T-031
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Capability dependencies: T-030 (preferences/persistence pattern), T-025 (per-tab shell)
Governed by: UX-001 (T-031 is completion work inside the active editor-experience scope, not a dependency on UX-001 closing first)
Prepared against: live `App/` panel implementation, shell, menus, locales and tests inspected on 2026-08-11
Last expanded: 2026-08-11T08:52:32+02:00
Expanded against plan snapshot: `Plan/plan.md` read 2026-08-11; this project has no numeric plan-version field
Expansion route: JUDGED from the user's “go for it”; preserve the implemented two-panel hybrid architecture and app-wide layout state

## Request Coverage

- Let the user move editor panels around freely instead of only resizing fixed docked columns.
- Snap panels while dragging (screen edges, dock zones, and other panels' edges/centres).
- Double-click a panel's name/title bar to minimise it to a title-only bar, and again to restore.

## User-Visible Outcome

The Layers panel and the Properties panel can be dragged out of their docked columns into free-floating windows over the canvas. While dragging, a panel snaps to nearby screen edges, dock zones and other panels' edges with a visible guide. Double-clicking a panel's title bar collapses it to its header; double-clicking again restores its previous size. Positions, sizes, minimise state and dock/float state survive an app restart, and a menu action resets the layout.

## Reconciled Live State (binding)

- `App/src/app/shell/panels/{types,layout,hosts,drag,resize,snap,index}.ts` implements the two-panel schema, versioned `open-potlood:panel-layout` persistence, Teleport hosts, pointer drag, eight resize handles, 8 px DOM-space snapping, left/right dock zones, z-order, keyboard nudging, clamping and reset logic.
- `App/src/components/Shell/{FloatingPanel,PanelOverlay}.vue` renders floating windows, resize handles, snap guides and dock-zone feedback above the desktop canvas.
- `App/src/components/ui/panel/PanelTitleBar.vue` implements float/dock, double-click and button minimise/restore, Enter/Space toggling and arrow-key nudging. `LayersPanel.vue` and `PropertiesPanel.vue` mount it while keeping content alive behind `v-show`.
- `App/src/views/EditorView.vue` implements the hybrid layout: docked panels stay in the reka-ui splitter; floating panels use the overlay; collapsed docked panels become rails; panel instances teleport between hosts.
- Expansion adopts the coherent implemented scope as binding: only top-level Layers and Properties panels, hybrid docked/floating behaviour, app-wide local layout state, and no CanvasKit or scene-graph involvement.
- Baseline verified 2026-08-11: `bunx tsgo --noEmit --pretty false` passed and `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` passed. The four type errors recorded in `Plan/plan.md` are stale.
- `bun run check:i18n` fails because `dockPanel`, `expandPanel`, `floatPanel` and `minimisePanel` are missing from all eight translated locale JSON files.
- No unit tests cover `snapPanelRect()`, `normalisePanelLayout()` or `clampRectToOverlay()`. No Playwright coverage proves float, snap, resize, minimise, persistence or re-docking; `tests/e2e/panels/basic.spec.ts` covers only the older splitter and toggle-UI behaviour.
- `resetPanelLayout()` exists but is not wired into `src/app/shell/menu/{schema,use,app-menu}.ts` or any visible reset action.

## Historical Pre-implementation State (superseded)

- `App/src/views/EditorView.vue:265-310` — desktop layout is a reka-ui `SplitterGroup` with three `SplitterPanel`s (`layers`, `canvas`, `properties`). Sizes persist through `@layout="saveEditorLayout"`.
- `App/src/app/shell/layout-storage.ts` — persists only a 3-number splitter array under `open-pencil:editor-layout`. No position, float or collapse state exists.
- `App/src/components/LayersPanel.vue` — `<aside>` containing `AppMenu`, a File/Assets tab strip, and a nested vertical `SplitterGroup` (`PagesPanel` + `LayerTree`). Uses `contain: paint layout style`.
- `App/src/components/PropertiesPanel.vue` — `<aside>` with reka-ui `TabsRoot` (Design/Code/AI, all `force-mount`) plus `ZoomDropdown`.
- Neither `<aside>` has a title bar today; the tab strips sit where a title bar would go. There is no existing draggable-window primitive.
- `App/src/components/ui/panel/PanelHeader.vue` + `src/theme/panel/header.ts` — an icon/title/actions header primitive already exists and is the natural title-bar base.
- `App/src/components/Toolbar/Toolbar.vue` is already absolutely positioned over `EditorCanvas`, so a floating overlay above the canvas is a proven pattern.
- `App/src/app/shell/preferences.ts` — versioned + validated `useLocalStorage` record with a `normalise()` guard. This is the persistence pattern to copy.
- Mobile uses a separate branch (`MobileDrawer` / `MobileHud`); `showUI=false` and `?no-chrome` are further branches that must stay untouched.
- Dependencies available: `@vueuse/core` 14 (`useLocalStorage`, `useEventListener`, `useElementSize`), `@atlaskit/pragmatic-drag-and-drop` (used for layer/asset drag), `reka-ui` 2.9, `motion-v`.
- T-010 smart snapping exists but operates in **scene/document coordinates** inside the canvas engine. It is not reusable for DOM-space panel snapping and must not be modified.
- Playwright specs target `data-test-id="layers-panel"`, `properties-panel`, `left-splitter-handle`; those IDs must survive.

## Fixed Decisions

The user authorised best-judgement expansion on 2026-08-11. Top-level-only scope, hybrid docking and app-wide persistence are now binding because they are already coherently implemented and match the recommended brief. The older unanswered-choice wording below is historical, not an execution stop.

Two scope choices were put to the user and left unanswered; the packet proceeds on the recommended option and both are reversible before implementation starts.

- **Scope (assumption):** only the two top-level panels — Layers (left) and Properties (right) — become floatable. Inner sections (Pages, Layer tree, Assets, Design, Code, AI) stay where they are.
- **Docking (assumption):** hybrid. The splitter layout stays the default; a panel floats only when the user drags it out or picks "Float panel". Dropping a floating panel on a left/right dock zone re-docks it into its splitter slot.
- Panel drag is a **DOM-space** concern. No canvas engine, scene graph or T-010 snapping code is touched.
- Floating panels live in one overlay layer above the canvas and below dialogs/menus/toasts, so canvas pointer handling stays unchanged.
- Drag uses native pointer events with `setPointerCapture` (not `useDraggable`), because snapping needs to modify the applied position per move.
- Position is applied with `transform: translate3d()` during a drag and committed to `left`/`top` on release, so dragging never triggers layout on the canvas.
- Minimise is a **view state** only: the panel keeps its position and last expanded height; content is `v-show`-hidden (never unmounted), so Design/Code/AI tab state and chat streams survive minimising.
- Layout state is app-level, not per-document and not per-tab: one record shared by every tab, matching how `editor-layout` behaves today.
- Mobile, `showUI=false` and `?no-chrome` branches are excluded; floating is desktop-chrome only.

## Read First

`App/AGENTS.md`; this packet; `src/app/shell/panels/`; `src/components/Shell/{FloatingPanel,PanelOverlay}.vue`; `src/components/ui/panel/PanelTitleBar.vue`; `src/views/EditorView.vue`; `src/components/{LayersPanel,PropertiesPanel}.vue`; `src/app/shell/menu/{schema,use,app-menu}.ts`; `packages/vue/src/i18n/messages/{menu,panels}.ts`; every translated `panels.json`; `tests/e2e/panels/basic.spec.ts`; and nearby app-shell unit-test conventions under `tests/engine/app/shell/`.

## Allowed Changes

Repair the existing T-031 files only where focused evidence requires it; add View-menu reset wiring, translated locale entries, focused unit tests under `tests/engine/app/shell/panels/`, focused Playwright coverage in `tests/e2e/panels/basic.spec.ts` or one adjacent T-031 spec, and the delivery receipt. No greenfield panel rewrite is authorised.

## Restrictions and Exclusions

No changes to the canvas renderer, scene graph, T-010 snapping, `.fig` contents, exports or MCP surface. No new runtime dependency. No change to mobile, `showUI=false` or `?no-chrome` layouts. No removal or renaming of existing `data-test-id` values. No multi-window/OS-level panel detachment (Tauri child windows) in this packet.

## Completion Steps (binding)

1. Preserve opening hashes of every existing T-031 source file that changes; do not overwrite unrelated unfinished work.
2. Add unit tests under `tests/engine/app/shell/panels/` for `snapPanelRect()` covering overlay edges, other-panel edges and centres, exact threshold, nearest-wins per axis, no-snap outside threshold and `enabled: false`; cover `normalisePanelLayout()` and `clampRectToOverlay()` for corrupt values, version mismatch, dimensions, off-screen recovery and independent panel records.
3. Add focused Playwright coverage using the existing test IDs: float each panel, drag and see a snap guide, hold Alt and bypass snapping, resize, double-click minimise/restore, preserve the active Properties tab/content state, reload and confirm persistence, re-dock, collapse to each rail, and verify canvas drawing/selection still works with a floating panel.
4. Wire `resetPanelLayout()` to a new `reset-panel-layout` View-menu item in both native `useMenu()` and browser `useAppMenu()`. Reset restores both panels to default docked/open state while leaving `open-pencil:editor-layout`, document data, tabs and preferences unchanged.
5. Add `resetPanelLayout` to English message defaults and translate all five T-031 strings in every locale JSON. Do not use English placeholders in translated files.
6. Run the focused tests first. Repair only defects demonstrated by those tests or direct interaction evidence; preserve the current architecture, storage keys and public test IDs.
7. Run `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint on touched app/test paths, `bun run check:i18n`, focused Bun tests, and `bunx playwright test tests/e2e/panels/basic.spec.ts --project=openpencil`. Do not run `bun run check`, `bun run test:unit` or `bun run test` without explicit instruction.
8. After source gates pass, perform the required local Windows build/install/launch check and record installed identity, version, SHA-256, responsiveness and the interaction matrix.

## Historical Greenfield Steps (superseded by Completion Steps)

1. **State module** — `src/app/shell/panels/`. Define `PanelId = 'layers' | 'properties'` and a versioned record: `{ version, panels: Record<PanelId, { mode: 'docked' | 'floating', x, y, width, height, collapsed, expandedHeight, z }> }`. Copy the `normalise()` + `useLocalStorage` pattern from `preferences.ts`; store under `open-potlood:panel-layout`. Keep `open-pencil:editor-layout` for splitter sizes so a docked-only user sees no change. Clamp every restored rect into the current viewport on load and on window resize.
2. **Title bars** — add a `PanelTitleBar.vue` built on `PanelHeader.vue`: panel icon, name, actions (float/dock toggle, minimise chevron, close). Mount it at the top of both `<aside>`s in docked and floating mode, above the existing tab strips. Give it `data-test-id="panel-title-<id>"`.
3. **Minimise** — `@dblclick` on the title bar toggles `collapsed`, storing `expandedHeight` first. Collapsed floating panels render title-bar-only with `height: auto`; collapsed docked panels collapse their splitter slot to its minimum. Content stays mounted behind `v-show`. Bind the same toggle to the chevron button and to `Enter`/`Space` on the focused title bar, and suppress the toggle when the double-click lands on an action button.
4. **Drag** — `FloatingPanel.vue` wraps the panel in an absolutely positioned box inside a new overlay layer in `EditorView.vue`'s desktop branch. `pointerdown` on the title bar (ignoring buttons) captures the pointer, records the grab offset, and updates a `translate3d` on `pointermove` through a `requestAnimationFrame` coalescer. `pointerup` commits, `Escape` cancels back to the start rect. Clicking anywhere in a floating panel raises its `z`.
5. **Snapping** — a pure module, `snap.ts`, taking the dragged rect, the viewport rect and the other panels' rects, and returning `{ x, y, guides[] }`. Snap targets, threshold 8 px, nearest wins per axis: viewport edges (with the existing outer padding), other panels' left/right/top/bottom edges and centres, and equal-edge alignment. Render matched guides as 1 px accent lines in the overlay. Hold `Alt` to suspend snapping. Keep it a pure function so it is unit-testable without a DOM.
6. **Dock zones** — while dragging, show a left and a right drop zone (the outer ~15% of the canvas area). Releasing inside one sets `mode: 'docked'` for that panel and restores its splitter slot; dragging a docked panel's title bar more than a few pixels lifts it into `mode: 'floating'` at its current on-screen rect. The `SplitterGroup` renders only the currently docked panels, so the canvas takes the freed width.
7. **Resize** — floating panels get right/bottom/corner resize handles honouring the same min/max constraints the splitter uses today (≈240 px min width). Resizing is disabled while collapsed.
8. **Menu, i18n, reset** — add "Reset panel layout" to the View menu (and mirror it in the panel title-bar action menu). Add every new string to all locales; `bun run check:i18n` must stay green.
9. **Accessibility** — title bar is focusable, exposes `aria-expanded` for the minimise state, supports arrow-key nudging (Shift for 10 px) when focused, and floating panels keep a sane tab order. Respect `prefers-reduced-motion` for the dock-zone and guide transitions.
10. **Tests** — unit tests for `snap.ts` (each target type, threshold boundary, nearest-wins, Alt bypass) and for `normalise()` (missing keys, wrong types, out-of-viewport rects, version bump). Playwright: drag a panel out and confirm it floats, drag near an edge and confirm the snapped coordinate, double-click the title to minimise and restore, reload and confirm persistence, re-dock and confirm the splitter layout returns.
11. **Checks** — run only the narrow change-scoped checks (`vue-tsc`, `oxlint` on the touched paths, the focused unit and Playwright specs). Do not run `bun run check`, `bun run test:unit` or `bun run test` without an explicit request.

## Acceptance Criteria

- [ ] Layers and Properties can each be floated, dragged anywhere over the canvas, resized, re-docked, and used normally in both modes.
- [ ] Dragging snaps to viewport edges, dock zones and other panel edges/centres within the threshold, with a visible guide; `Alt` suspends snapping.
- [ ] Double-clicking a panel title minimises it to its title bar and restores the previous size; panel content state (Design/Code/AI tab, chat, scroll) survives the round trip.
- [ ] Position, size, minimise and dock/float state persist across reload and app restart; corrupt or off-screen stored state falls back safely.
- [ ] Mobile, `showUI=false`, `?no-chrome`, canvas interaction, existing splitter behaviour and all existing `data-test-id` hooks are unchanged.
- [ ] View-menu reset restores the default panel layout without changing document, tab, preference or splitter-layout data.
- [ ] Focused unit + Playwright specs and narrow type/lint/i18n checks pass; installed desktop interaction is verified before delivery is claimed.

## Verification

Run the exact focused commands in Completion Step 7. Expected evidence is zero failed focused tests, zero type/lint/i18n errors, preserved legacy panel tests and direct installed confirmation of float, snap, resize, minimise, restart persistence, re-dock, reset and unaffected canvas input. Two repeated failures with the same cause are a stop; record exact output rather than widening scope.

## Integration or Installed-Result Check

Installed OpenPotlood must prove: float a panel, snap it against an edge and another panel, minimise and restore by double-click, restart with the layout intact, reset the layout from the View menu, and confirm canvas drawing and selection still work with a panel floating over the canvas.

## Stop Conditions

Stop on: live evidence requiring detachable inner sections, an always-floating redesign or per-document layout; pointer capture conflicting with canvas/reka-ui handling; snapping needing scene-space knowledge; pressure to modify T-010; persistence colliding with `open-pencil:editor-layout`; reset affecting document data; or focused repair requiring a broader shell rewrite.

## Execution Report Contract

Record the state schema and defaults, the snap target table and threshold, changed files, unit/Playwright counts and exits, canvas-interaction regression evidence, persistence and reset results, installed identity/verification, deviations and limitations.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| Only top-level Layers and Properties panels float | This is the coherent live implementation and the recommended original scope | User explicitly requests detachable inner sections | Create a new packet for host/state/schema expansion |
| Hybrid docked/floating behaviour remains | Preserves the existing splitter and offers reversible floating | User explicitly chooses always-floating panels | Re-plan shell layout rather than patching this completion slice |
| Layout is app-wide | Matches current `open-potlood:panel-layout` implementation and shell preference semantics | User requires different layouts per document/tab | Revise persistence ownership and migration in a new packet |

Outstanding questions: none.

## Historical Open Questions (resolved by the 2026-08-11 judged route)

1. Scope — top-level panels only, or should inner sections (Pages, Assets, Design, Code, AI) detach individually too?
2. Docking — keep the hybrid docked/floating model, or drop the splitter entirely for an always-floating layout?
3. Should the layout be per-document tab rather than app-wide?

Resolution: top-level panels only; hybrid docked/floating; app-wide persistence. A later user request to change these is new scope and requires a packet revision.

## Revision History

- Revision 2 — 2026-08-11: reconciled against the live partial implementation, replaced the stale type-error blocker with current evidence, resolved scope assumptions, and narrowed execution to repair, tests, localisation, reset wiring and delivery.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (verified 2026-08-11: two-panel hybrid/app-wide architecture preserved; browser/native reset wiring, native menu artefact, eight-locale panel/reset labels, snap/layout/clamp unit coverage and the full focused panel Playwright matrix complete. Gates passed: `tsgo`, Vue type-check, focused Oxlint, i18n, 11/11 Bun tests and 5/5 Playwright tests including canvas drawing/selection. Built and installed 0.6.24 via NSIS; installed path/version/hash and responsive launch verified; user confirmed the installed feature works)
