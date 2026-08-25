# T-070 - InDesign-style panel management (scope map — token-lean child series)

Task ID: T-070
Packet state: Split — not executable. Do not implement this file.
Packet revision: 3
Project goal link: Plan/endgoal.md
Prepared from: the user's 2026-08-20 request with two Adobe InDesign panel screenshots as the reference model
Split at: 2026-08-20 Africa/Johannesburg, at the user's instruction
Related: T-031c (Done — this series is its deferred revision), T-032a (dependency-locked until T-070d3)

This file is the shared map only. Execute the naturally ordered child rows in `Plan/plan.md`, not the superseded T-070b/c/d scope packets.

## Why it was split

The original T-070 (revision 1) covered all five requirement groups in one packet: a persisted schema change plus roughly eleven component steps plus a full test rewrite. Coherent, but too large for one bounded session, and its own Stop Conditions had to tell the executor where to cut it. Splitting puts that cut in the plan instead of in an escape hatch, and lets the two most visible fixes land first.

## The request, and which child owns each part

| Requirement group (2026-08-20, verbatim) | Owner |
| --- | --- |
| 5. Resolve panel height issues where panels become excessively tall. Replace individual per-panel scrollbars in stacked groups with a single, unified scrollbar for the entire stack. | **T-070a** |
| 3. Fix floating panel group movement so that dragging the group container/header moves the entire stacked cluster together. | **T-070b1–b2** |
| 1. Clean up the default startup layout so panels are neatly docked rather than cluttered. Ensure the Export panel is closed by default on initial load. | **T-070c1–c3** |
| 4. Introduce tabbed panel support, allowing multiple panels to be grouped and switched within the same tabbed container. | **T-070c1–c3** |
| 2. Refactor panel drag-and-drop interactions to allow intuitive snapping, reordering, and docking against adjacent panels and edges. Implement clear visual drop-zone highlighting while dragging. | **T-070d1, d2a, d2b, d3** |

## Landing order (strict)

Each child is landable on its own — source gates plus a browser check pass, and the app works — but the chain must land in this order.

| # | Packet | Delivers | Schema |
| --- | --- | --- | --- |
| 1 | `Plan/Packets/T-070a-panel-sizing-and-unified-scrolling.md` | `sizing: 'fill' \| 'content'` in the registry; pixel-plus-grow member sizing replacing `flex-basis: N%`; `basis` → `height: number \| null`; `resizePair` → `setMemberHeight`; one scrollbar per container. | v3 → **v4** |
| 2 | `Plan/Packets/T-070b1-float-title-geometry.md` | `PANEL_FLOAT_TITLE_HEIGHT = 24`, float floor and viewport clamp. | none |
| 3 | `Plan/Packets/T-070b2-floating-title-bar-ui.md` | `FloatTitleBar.vue` as the sole whole-window drag handle. | none |
| 4 | `Plan/Packets/T-070c1-panel-group-v5-model.md` | `PanelGroup`, v4→v5 migration, invariants and pure operations. | v4 → **v5** |
| 5 | `Plan/Packets/T-070c2-panel-group-ui.md` | Tab-strip/group components and v5 rendering activation. | none |
| 6 | `Plan/Packets/T-070c3-panel-group-defaults-cleanup.md` | Approved defaults, Export closed and legacy title-bar removal. | none |
| 7 | `Plan/Packets/T-070d1-drop-target-resolver.md` | DOM-free tab/group/edge resolver plus a compiling seam-only geometry caller. | none |
| 8 | `Plan/Packets/T-070d2a-tab-drop-model-commit.md` | Pure/reactive tab and group mutation contract; gesture remains seam-only. | none |
| 9 | `Plan/Packets/T-070d2b-tab-drop-preview-ui.md` | Individual-tab activation: ring/caret preview equals commit. | none |
| 10 | `Plan/Packets/T-070d3-whole-group-drag.md` | Whole-group gesture and operation. | none |

Why this order: geometry lands before its UI; schema/migration lands before group rendering; rendering lands before default cleanup; the pure resolver lands before gesture wiring; individual-tab behaviour lands before whole-group drag. Every intermediate state remains type-checkable and browser-usable.

## Two corrections that apply across the series

Both are recorded in full in the children that own them; repeated here so no executor rediscovers them.

- **The Export panel is already closed by default.** `DEFAULT_OPEN` in `src/app/shell/panels/containers.ts` excludes `export`, and a repo-wide grep for `openRegisteredPanel` / `openPanel(` finds only the Window-menu toggles at `src/app/shell/menu/use.ts:140` and `src/app/shell/menu/app-menu.ts:151`. Only a persisted `open-potlood:panel-layout` can have it open. T-070c delivers a unit-test guard plus a cleared-storage browser check, not a bug hunt.
- **Whole-group float movement already works.** `startContainerDrag()` in `src/app/shell/panels/drag.ts` moves the whole stack correctly and is proven by `tests/e2e/panels/stacks.spec.ts`. The defect is that `FloatingPanel.vue` binds it to the window root, whose border pixels are entirely covered by the eight resize handles — `tests/e2e/panels/helpers.ts` documents the workaround in `dragContainerFrameTo()`'s comment. T-070b gives it a handle; it does not rewrite the logic.

## Series-wide restrictions

Every child repeats these in its own binding form. Nothing in the series may:

- change the `localStorage` key `open-potlood:panel-layout` or add a second one;
- touch `src/app/shell/menu/use.ts` or `app-menu.ts` — `tests/engine/app/shell/menu/window-panels.test.ts` must pass unedited in all four packets, which is the standing proof the Window menu contract survived;
- touch `src/app/shell/panels/snap.ts` or `src/views/EditorView.vue`;
- add an npm dependency, a `tv()` recipe, an i18n key, or an `src/app.css` edit;
- add a workspace preset, Focus rail or Overview mode; T-033/T-034 were retired on 2026-08-20;
- perform Git work, a version bump, a build, an NSIS install, or `bun install`;
- run an umbrella command — `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

Each child must also report **which `src/app/shell/panels/index.ts` exports it added, renamed or removed**, because dependency-locked T-032a consumes that barrel and must reconcile the cumulative delta after T-070d3.

## Deferred beyond the series

- Saved/named workspace presets beyond the existing Simple/Full capability model.
- Dragging a tab out of the app window into a separate OS window.
- Keyboard-only tab reordering beyond the arrow-key window nudge.
- Auto-tabbing an existing user layout on migration — every migration in this series is one-group-per-panel, order preserved.

## Revision History

- Revision 1 — 2026-08-20: created and expanded as a single packet covering all five requirement groups.
- Revision 2 — 2026-08-20: split into T-070a/b/c/d at the user's instruction; this file reduced to the shared scope map. The revision-1 content survives, redistributed and re-verified, across the four children.
- Revision 3 — 2026-08-20: split oversized b/c/d packets again into b1–b2, c1–c3 and d1–d3; retired stale T-033/T-034 references.
- Revision 4 — 2026-08-21: live expansion repaired d1's uncompilable pure-only boundary and split d2 into d2a model/commit plus d2b preview/UI so every intermediate state remains type-checkable and visible commits never precede their preview.
