# T-033 - Add a canvas-focus layout

Task ID: T-033
Packet state: Retired — superseded workspace-mode route; do not execute
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-032 (switcher, `workspace-view.ts`, availability API), T-031c (container model, schema v3), T-031d (top chrome in `TabBar.vue`)
Prepared from: the user's 2026-08-07 Canva-like layout-view request, the 2026-08-12 scope split, and the live T-031c panel model
Expanded at: 2026-08-14
Expanded against plan snapshot: `Plan/plan.md` read 2026-08-14; this project has no numeric plan-version field
Expansion route: JUDGED from the user's "re expand packet 33"

## Why this revision exists

Revision 2 was written against a two-panel world (`LayersPanel.vue` + `PropertiesPanel.vue`, a `PanelState.mode` flag, a three-column splitter) that no longer exists. T-031a/b/c replaced it with a registry of fourteen panels, two docks and n floating containers under schema v3, and T-031d moved the shell chrome into `TabBar.vue`. The 2026-08-12 scope split also moved the contextual work to T-035/T-036, leaving T-033 as one thing: **present the docked panels as a collapsed icon rail with flyouts and give the canvas the freed space.**

Revision 2's Fixed Behaviour Contract, its `FocusChrome.vue` HUD and its build/install step are all superseded and are not carried forward.

## Request Coverage

- Give the editor a canvas-priority layout selectable from T-032's toolbar switcher.
- In that layout, panels are reachable from a slim icon rail with flyouts instead of occupying permanent dock width.
- Nothing about the user's saved panel arrangement is lost or rewritten by entering or leaving the layout.

## Intended Outcome

Selecting `Focus` collapses both docks to a slim icon rail on each used edge. The canvas takes the reclaimed width. Clicking a rail icon slides that panel out over the canvas as a flyout at the dock's own width; clicking again, clicking away, or pressing `Escape` dismisses it. Leaving Focus restores the exact previous arrangement — same containers, widths, basis, collapse flags, scroll positions, open AI streams — because nothing was ever mutated.

## Verified Starting State (2026-08-14)

- `App/src/app/shell/panels/types.ts` — `PANEL_LAYOUT_VERSION = 3`, `PANEL_IDS` has 14 entries, containers are `left | right | float:<n>`. `RegisteredPanelState` carries `open`, `container`, `index`, `lastDock`, `basis`, `collapsed`, `floatFallback`.
- `App/src/app/shell/panels/hosts.ts` — `HostKind = 'parking' | 'docked' | 'floating'`. Each panel is mounted **once** and teleported into the host for its current kind. `parking` is the already-existing "mounted but not displayed" host, rendered by `EditorView.vue:280` as `<div class="hidden">` per panel.
- `App/src/components/Shell/WorkspacePanel.vue` — `<Teleport v-if="host">`. **If `panelHost()` returns `null`, the panel content unmounts.** This is the single most important fact for this packet (see the Fixed Behaviour Contract).
- `App/src/views/EditorView.vue:272-282` — the desktop `editor-panels` row: `PanelStack left`, canvas + `Toolbar`, `PanelStack right`, `PanelOverlay`, the parking hosts, then one `WorkspacePanel` per registered id.
- `App/src/components/TabBar.vue:160-172` — `desktop-shell-chrome` already carries `CollabPanel`, `ZoomDropdown` and the toggle-UI button, and `TabBar` renders above every branch. `AppMenu.vue` is the browser-only menu row (`v-if="!IS_TAURI"`); Tauri uses the native menu.
- `App/src/app/shell/menu/schema.ts:154-157` — View menu already owns `reset-panel-layout` and `toggle-ui` (`MOD+\`). `MOD+SHIFT+\` is unused across the schema and the keyboard layer.
- `App/src/app/shell/workspace-view.ts` **does not exist** — T-032 is Prepared, not implemented. T-033 cannot start before it does.

## Fixed Behaviour Contract

**Nothing in Focus writes to the persisted panel layout.** `activeView === 'focus'` is shell display state. It never calls `movePanel`, `dockPanel`, `floatPanel`, `setPanelCollapsed`, `setDockWidth`, `setFloatRect`, `openRegisteredPanel`, `closeRegisteredPanel`, `resetPanelLayout` or `writePanelLayout`, and never touches `showUI`, selection, entered container, zoom/pan, dirty state or `.fig` bytes. Storage under `open-potlood:panel-layout` must be byte-identical before entering and after leaving with no intervening user edit.

**Focus is a fourth host kind, not a layout mutation.**

- Add `'rail'` to `HostKind` in `hosts.ts` and a fourth ref slot per panel.
- `panelHost(id)` becomes Focus-aware. While `activeView === 'focus'`, an **open** panel resolves to `'rail'` when its rail flyout is the currently open one, and to `'parking'` otherwise — regardless of whether its container is a dock or a float. A **closed** panel resolves to `'parking'`, unchanged.
- This routing is why `PanelStack` may be unmounted in Focus at all: without it, the cleared `docked` host ref makes `panelHost()` return `null`, `WorkspacePanel`'s `v-if` fails, and every panel body — including live AI streams — is destroyed. Prove the routing before removing the stacks.

**The rail.**

- Render `FocusRail.vue` on each edge in place of `PanelStack`, inside the existing `editor-panels` row so the canvas keeps flexing into the freed width.
- The left rail lists `docks.left` in order; the right rail lists `docks.right` in order. Every panel in an **open float container** also gets an icon, appended to the rail of its `lastDock.side` in `lastDock.index` order. Closed panels get no icon.
- A rail with no icons renders zero width and is `aria-hidden`, matching the existing empty-dock rule in `PanelStack.vue:81-87`.
- Each icon carries the panel's translated `panels[id]` label as `aria-label` and tooltip, `aria-expanded`, and test id `focus-rail-item-<id>`; the rail itself is `focus-rail-<side>`.
- Floating windows are not rendered in Focus. `PanelOverlay` still mounts (it owns overlay measurement) but renders no `FloatingPanel`, no snap guides and no insertion band while Focus is active.

**The flyout.**

- At most one flyout is open app-wide. Opening another closes the first.
- It is anchored to its rail edge, overlays the canvas, and uses `panelLayout.dockWidths[side]` as its width — read only, never written, and clamped to leave `PANEL_CANVAS_MIN_WIDTH` of canvas.
- Dismissal: clicking the same icon, clicking outside the flyout, or `Escape`.
- Inside a flyout, `PanelTitleBar` renders a rail variant: title plus the close action only. Panel drag (`startPanelDrag`), the float/dock pin toggle, collapse-on-double-click and the dock nudge shortcuts are all suppressed, because none of them have a valid drop geometry while the docks are not rendered. Close still calls `closeRegisteredPanel` — that is a deliberate user action, not a side effect of the mode.
- Flyout state is transient in-memory only. It is never persisted and resets to "none open" on entering and on leaving Focus.

**Entry, exit and focus.**

- Entered and left by the T-032 `Focus` segment, the mirrored View-menu item, and `MOD+SHIFT+\`. Choosing any other segment leaves Focus.
- `Escape` closes an open flyout first. With no flyout open, `Escape` exits Focus **only** when no dialog, popover, menu or text edit owns Escape. Do not intercept Escape ahead of those surfaces.
- On entry, remember `document.activeElement` if it belongs to the editor and focus the canvas after layout settles. On exit, restore that element if it is still connected, otherwise focus the canvas.
- Because T-032 persists `activeView`, relaunching straight into Focus is expected. The rail, flyouts and every exit route must work on first paint after restore.

**No HUD.** Revision 2's `FocusChrome.vue` is dropped. T-031d already keeps `TabBar` — tabs, document name, `CollabPanel`, `ZoomDropdown`, toggle-UI — above every branch, and the browser `AppMenu` row stays rendered inside the desktop branch. Do not add a second zoom or menu instance.

## Constraints

- Display state only. No schema version bump, no migration, no new persisted key.
- Do not unmount any panel body to hide it. Parking is the mechanism.
- Desktop chrome branch only. Mobile, dashboard, `showUI=false` and `?no-chrome` are untouched.
- No new runtime dependency. Vue reactivity, the existing teleport/host model, T-032 state and the existing menu routes are sufficient.
- Per the 2026-08-14 delivery policy, this packet stops at source gates. No desktop build, no NSIS install, no version bumps unless the user asks in that session.

## Expansion Research

| Live path | Verified seam | Binding treatment |
| --- | --- | --- |
| `App/src/app/shell/panels/hosts.ts` | `HostKind`, per-panel host refs, `panelHost()` container→kind mapping, `setPanelHost()` disconnect guard | Add the `'rail'` kind and the Focus-aware branch here. This file is the whole mechanism |
| `App/src/app/shell/panels/layout.ts` | Every mutator writes through `write()` → `normalisePanelLayout` | Focus code may read `panelLayout`, `dockedPanelIds`, `floatContainerIds`, `panelContainerId`; it may call **no** mutator |
| `App/src/app/shell/panels/types.ts` | Schema v3, `PANEL_DOCK_MIN_WIDTH` 220, `PANEL_CANVAS_MIN_WIDTH` 360 | Read constants; do not extend the persisted shape |
| `App/src/views/EditorView.vue:272-282` | Desktop row; parking hosts; one `WorkspacePanel` per id | Swap `PanelStack` for `FocusRail` per side under Focus. Leave the parking hosts and the `WorkspacePanel` loop exactly as they are |
| `App/src/components/Shell/WorkspacePanel.vue:21` | `<Teleport v-if="host">` — a null host unmounts the body | Never let `panelHost()` return null for an open panel in Focus |
| `App/src/components/Shell/PanelStack.vue` | Dock chrome, basis sizing, resize handles, insertion seams | Not reused by the rail. Unmounted in Focus; must remount with identical state on exit |
| `App/src/components/Shell/PanelOverlay.vue` | Floating windows, snap guides, empty-dock band | Suppress all three in Focus; keep the element mounted for `measurePanelOverlay` |
| `App/src/components/ui/panel/PanelTitleBar.vue` | Drag, pin/unpin float, collapse, nudge, close | Add the rail variant that exposes close only |
| `App/src/components/TabBar.vue:160-172` | `desktop-shell-chrome`: collab, zoom, toggle-UI; renders above all branches | Unchanged — this is why no Focus HUD is needed |
| `App/src/app/shell/menu/schema.ts:154-157` | View menu; `MOD+\` taken, `MOD+SHIFT+\` free | Add the Focus checkbox item and `MOD+SHIFT+\` alongside T-032's entries |
| `App/src/app/shell/menu/{use,app-menu}.ts` | Native and browser action/checked maps | Identical behaviour on both routes |
| `App/src/app/shell/workspace-view.ts` (T-032, not yet present) | `workspaceView`, `setWorkspaceView`, `isWorkspaceViewAvailable` | Flip `focus` to available; add no second source of view state |
| `App/tests/engine/app/shell/panels/` | `layout.test.ts`, `operations.test.ts`, `containers.test.ts`, `drop-target.test.ts`, `snap.test.ts` — no `hosts.test.ts` yet | Add `hosts.test.ts` for the host-kind resolution table |
| `App/tests/e2e/panels/{basic,stacks}.spec.ts` | Existing dock/float/stack coverage | Must stay green untouched; add `tests/e2e/workspace/focus.spec.ts` |

## Allowed Changes

`src/app/shell/panels/hosts.ts` (new `'rail'` kind + Focus-aware resolution); a new `src/components/Shell/FocusRail.vue` and `src/components/Shell/FocusFlyout.vue`; a transient rail-state module (in-memory, e.g. `src/app/shell/panels/focus-rail.ts`); the minimal branch in `EditorView.vue`; the suppression flags in `PanelOverlay.vue`; the rail variant prop in `PanelTitleBar.vue`; T-032 availability plus View-menu item, shortcut and checked state on both menu routes; i18n defaults and locale files; focused unit and Playwright tests.

## Excluded Scope

No panel-layout schema change, migration or mutation. No `FocusChrome.vue` or duplicated menu/zoom control. No pinning a flyout open, no multi-flyout, no rail reordering or drag-to-rail. No toolbar retraction, zen/fullscreen OS mode, or auto-hide. No contextual selection actions (T-035) or property surface (T-036). No page overview (T-034). No mobile, dashboard, `showUI=false` or `?no-chrome` behaviour. No scene-graph, CanvasKit, document, export or MCP change. No new dependency, no build/install/version work.

## Implementation Steps

1. Confirm T-032 has landed with `workspace-view.ts` and its store/menu tests green. Re-read `hosts.ts`, `WorkspacePanel.vue` and `EditorView.vue:272-282`; stop on drift affecting the contract above.
2. Add the `'rail'` host kind and the Focus-aware `panelHost()` branch. Cover the full resolution table in `tests/engine/app/shell/panels/hosts.test.ts`: open/closed × dock/float × Focus on/off × flyout open/closed, asserting no case yields `null` for an open panel.
3. Add the transient rail state (which flyout, if any) with open/toggle/close/reset-on-mode-change, and unit-test that it never touches `panelLayout`.
4. Build `FocusRail.vue`: icons for `docks.left` / `docks.right` plus float members by `lastDock`, labels, `aria-expanded`, zero-width empty state, all four themes.
5. Build `FocusFlyout.vue`: dock-width anchored overlay hosting the `'rail'` teleport target, with icon-toggle / outside-click / `Escape` dismissal and the close-only `PanelTitleBar` variant.
6. Branch `EditorView.vue` to render the rails instead of the stacks in Focus, and suppress floats, snap guides and the insertion band in `PanelOverlay.vue`.
7. Enable `focus` in T-032 availability; add the View-menu checkbox item, `MOD+SHIFT+\`, and identical browser/native actions. Add every new visible string to the typed defaults and all locale files (if T-054 has already landed, English defaults only).
8. Add entry/exit focus capture and restoration and the guarded Escape ordering (flyout → mode, never ahead of dialogs/popovers/text edit).
9. Add `tests/e2e/workspace/focus.spec.ts`: enter/exit via segment, menu, shortcut and guarded Escape; canvas width grows and shrinks back; `open-potlood:panel-layout` byte-identical across a Focus round trip; a live AI panel stream survives entering, flyout-opening and leaving; rail lists dock members and float members; one flyout at a time; flyout close removes the panel; relaunch-in-Focus; focus restoration; all four themes; narrow desktop width; mobile / `showUI=false` / `?no-chrome` unchanged.
10. Run `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint on touched paths, `bun run check:i18n`, `bun test ./tests/engine/app/shell/panels/`, and `bunx playwright test tests/e2e/workspace/focus.spec.ts tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts --project=openpencil`. No umbrella checks and no build unless the user asks.

## Acceptance Criteria

- [ ] `Focus` is enabled in the T-032 switcher, mirrored in the View menu, and bound to `MOD+SHIFT+\`.
- [ ] In Focus each used edge shows a slim icon rail and the canvas takes the reclaimed width; an unused edge takes none.
- [ ] Every open panel — docked or floating — has exactly one rail icon with a translated label; closed panels have none.
- [ ] A rail icon opens one flyout at the dock's width; icon, outside click and `Escape` dismiss it; `Escape` never pre-empts a dialog, popover, menu or text edit.
- [ ] No panel body unmounts at any point: scroll positions, open tabs and live AI streams survive entry, flyout use and exit.
- [ ] `open-potlood:panel-layout` is byte-identical before and after a Focus round trip; selection, zoom/pan, dirty state, artwork and `.fig` bytes are untouched.
- [ ] Leaving Focus restores the docks, floats, widths, basis and collapse flags exactly, with no reload.
- [ ] Relaunching in Focus is recoverable through every exit route on first paint.
- [ ] All four themes and narrow desktop widths remain usable; mobile, dashboard, `showUI=false` and `?no-chrome` are unchanged; `panels/basic.spec.ts` and `panels/stacks.spec.ts` stay green untouched.
- [ ] Source gates in step 10 pass. No delivery is claimed without a separately authorised build.

## Verification and Evidence

Record `localStorage['open-potlood:panel-layout']` before / during / after Focus and diff it. Capture canvas bounding boxes in both modes, rail and flyout screenshots in each theme, the host-kind resolution table results, an AI-stream continuity check across the round trip, focused-element ids across entry and exit, and exact test counts and exit codes. A panel unmount, a lost stream, any layout-storage delta, a trapped Focus state or an Escape ordering conflict is a stop, not a cosmetic exception.

## Stop Conditions

Stop and return to planning if making `panelHost()` Focus-aware turns out to require mutating the persisted layout; if the rail cannot present fourteen panels legibly at a supported window height; if flyout dismissal cannot be reconciled with the existing popover/dialog Escape owners; or if T-032 ships a workspace-view API different from the one assumed here.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| Focus is a host-routing change, not a layout change | `hosts.ts` already routes a mounted panel between kinds; parking already means "mounted, not shown" | A flyout needs geometry the host model cannot express | Add a Focus-only view-model over the layout; still never persist it |
| Open floating panels are parked and railed by `lastDock.side` | Focus means maximum canvas; a float overlaying the canvas contradicts that, and `lastDock` gives a stable rail position | The user wants floating windows to keep hovering in Focus | Exempt floats from parking; rail icons then cover docked panels only |
| One flyout at a time, transient, never pinned | Matches the collapsed-rail idiom and keeps the canvas clear | The user wants a pinned flyout or two side-by-side | New packet — pinning is a persisted preference, not display state |
| No Focus HUD | T-031d put tabs, zoom, collab and toggle-UI in `TabBar`, which renders above every branch | Some essential control turns out to live only inside a dock | Surface that one control in the rail, not a second chrome layer |
| `MOD+SHIFT+\` is the Focus shortcut | Free across the schema and keyboard layer, and reads as a sibling of `MOD+\` toggle-UI | It collides with an OS or IME binding on the user's machine | Rebind through the same menu entry; no other code changes |

Outstanding questions: none. Pinned flyouts, rail reordering, drag-to-rail and per-tab Focus are all new scope.

## Revision History

- Revision 2 — 2026-08-11: expanded against the pre-T-031c two-panel shell. Superseded in full.
- 2026-08-12: scope split; contextual work moved to T-035/T-036; packet marked NEEDS RE-EXPANSION.
- Revision 3 — 2026-08-14: re-expanded against the live T-031c schema-v3 container model and the T-031d chrome. Identified the teleport-host route as the mechanism and the null-host unmount as the binding hazard; dropped the obsolete `FocusChrome.vue` HUD, the `PanelState.mode` language and the build/install step; fixed rail composition, flyout behaviour, Escape ordering and the zero-mutation contract.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (revision 3, re-expanded 2026-08-14 against the live schema-v3 container model and the T-031d chrome; routes Focus through a new `'rail'` teleport host kind so the persisted panel layout is never mutated, drops revision 2's `FocusChrome` HUD as redundant with `TabBar`; blocked on T-032, which is not yet implemented)
