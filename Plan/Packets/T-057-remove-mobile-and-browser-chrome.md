# T-057 - Remove mobile and browser-only chrome

Task ID: T-057
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-054, T-042
Prepared from: the user's 2026-08-14 request batch 2
Expanded at: 2026-08-15
Expanded against: live `App/` source — `EditorView.vue`, `Toolbar/Toolbar.vue`, `Toolbar/DesktopToolbar.vue`, `Toolbar/actions.ts`, `MobileDrawer.vue`, `MobileHud/*`, `SafariBanner.vue`, `app/editor/mobile-clipboard/index.ts`, `app/editor/session/types.ts`, `app/shell/keyboard/actions.ts`, `packages/vue/src/editor/viewport-kind/use.ts`, `packages/vue/src/primitives/Toolbar/useToolbarState.ts`, `desktop/tauri.conf.json`, `playwright.config.ts`
Delivery: source gates only

## Intended Outcome

The codebase stops carrying a second, unused touch/narrow-viewport interface and its browser-compatibility banner. Every user-facing behaviour those surfaces provided (undo/redo, file actions, tool selection, Layers/Design/Code/AI panels, presence, share) already has a desktop equivalent — confirmed by direct comparison below — so nothing is genuinely lost. The installed desktop app is unaffected in its normal window size; a window narrowed below the old mobile breakpoint now shows the same desktop chrome instead of a mobile layout, and the desktop window gets a minimum size so that state can no longer be reached by resizing.

## Request Coverage

- Remove the mobile UI and the browser-specific chrome the fork inherited from upstream, since OpenPotlood ships as a Windows desktop application.

## Verified Starting State

| Path | What it is | Consumers (verified) |
| --- | --- | --- |
| `App/src/components/SafariBanner.vue` | Shows a "your browser doesn't support the local file API" banner when `!IS_TAURI && IS_BROWSER && !window.showSaveFilePicker` (i.e. Safari/WebKit browsers lacking the File System Access API). | Mounted once, unconditionally, at `EditorView.vue:260`. No other file references it. |
| `App/src/components/MobileHud/` (8 files: `MobileHud.vue`, `MobileActionToast.vue`, `MobileActiveToolBadge.vue`, `MobileFileMenu.vue`, `MobilePresencePopover.vue`, `MobileShareButton.vue`, `MobileUndoRedo.vue`, `context.ts`) | A touch HUD overlay. `context.ts`'s `provideMobileHud`/`useMobileHudContext` are injected only by `MobileHud.vue` and consumed only by the other 6 components in the same directory — confirmed by grepping the whole `App/src` tree for both symbol names: every hit is inside `MobileHud/`. The directory has exactly one external consumer: `EditorView.vue:45,300` (`import MobileHud ...`, `<MobileHud />`). | `EditorView.vue` only. |
| `App/src/components/MobileDrawer.vue` | A swipeable bottom sheet with Layers/Design/Code/AI tabs, built on `motion-v`'s `motion.div` pan gestures. Its four tab bodies are `PagesPanel`, `LayerTree`, `DesignPanel`, `CodePanel`, `ChatPanel` — the **same** components the desktop dock panels use (`PANEL_IDS` in `App/src/app/shell/panels` registers `layers`, `appearance`/`transform`, `code`, `ai` etc. against these same bodies). Nothing in `MobileDrawer.vue` is a unique capability; it is a different presentation of panels that already exist on the desktop dock. | `EditorView.vue:44,294` only. |
| `App/src/components/Toolbar/MobileToolbar.vue` (179 lines) | The mobile tool strip. | `App/src/components/Toolbar/Toolbar.vue:5,89` only. |
| `App/src/app/editor/session/types.ts:15,18,32,35` | `EditorState.activeRibbonTab: 'panels' \| 'code' \| 'ai'`, `EditorState.mobileDrawerSnap: 'closed' \| 'half' \| 'full'`, and `panelMode` (grep-confirmed, both the type and the default value). | `MobileDrawer.vue` (both fields) and `App/src/app/shell/keyboard/actions.ts:87-90`'s `toggleAI()` (both fields). **Not removed by this packet** — see Restrictions. |
| `App/src/constants.ts` | Exports `DRAWER_SPRING_DAMPING`, `DRAWER_SPRING_STIFFNESS`, `HALF_FRAC`, `HUD_TOP`, `SWIPE_THRESHOLD`, `SWIPE_VELOCITY_THRESHOLD` — grep-confirmed to have exactly one consumer each, `MobileDrawer.vue`. | `MobileDrawer.vue` only. Safe to delete alongside it (simple constant exports, no type/serialization surface — contrast with the `session/types.ts` fields above). |
| `App/packages/vue/src/editor/viewport-kind/use.ts` | `useViewportKind()` → `isMobile = useBreakpoints({ mobile: 768 }).smaller('mobile')`, a pure CSS-width breakpoint with no touch-capability check. | `EditorView.vue`, `Toolbar.vue`, `App/src/app/shell/keyboard/use.ts` (feeds `isMobile` into `keyboard/actions.ts`'s `toggleAI()`). This is a public SDK primitive under `packages/vue/src` — not removed by this packet. |
| `App/desktop/tauri.conf.json:12-21` | `app.windows[0]` has `width: 1280, height: 800` and **no `minWidth`/`minHeight`**. Confirms the installed desktop window can be resized arbitrarily small today, including below the 768px breakpoint. |
| `App/playwright.config.ts` | Default viewport `1280×800` for every project, including `openpencil-webkit` (WebKit/Safari), which does not override it. `webServer` runs `bun run dev` on port 1420 — the same "browser dev route" used for manual source-level verification. |
| `App/tests/` | Grepped for `MobileHud`, `MobileDrawer`, `mobile-drawer`, `mobile-ribbon`, `MobileToolbar`, `SafariBanner`, `safari-banner` — **zero matches anywhere**. No existing Playwright coverage exercises any mobile surface or the Safari banner. |

## Corrections to the Brief

The parent expansion brief carried one "confirmed fact" from context that direct verification shows is **wrong**, and the stub's own restriction built on it needs correcting, not just repeating:

**`App/src/app/editor/mobile-clipboard/` is not consumed by the desktop toolbar.** Grepping the whole `App/` tree for `mobileCopy|mobilePaste|mobileCut|mobile-clipboard` returns exactly three files: `App/src/app/editor/session/modules.ts` (wires `createMobileClipboardActions` onto the store), `App/src/app/editor/mobile-clipboard/index.ts` (the implementation), and `App/src/components/Toolbar/actions.ts` (`useToolbarActions()`, the only caller of `store.mobileCopy/mobileCut/mobilePaste`). `useToolbarActions()`'s output (`editActions`, `arrangeActions`) is read in exactly one place — `App/src/components/Toolbar/Toolbar.vue:96-108` — and passed **only** to `<MobileToolbar :edit-actions="editActions" :arrange-actions="arrangeActions" ... />`. `DesktopToolbar.vue` (read in full) takes no such props and has zero reference to `editActions`, `mobileCopy`, or `mobile-clipboard`. This also matches T-035's own already-recorded finding (`Plan/Packets/T-035-contextual-selection-actions.md`'s Verified Starting State): *"`useToolbarActions()` builds selection action lists from commands — but it is mobile-only... Copy its shape, do not import it."*

This does not change the packet's restriction — `mobile-clipboard` is still not removed here (see Fixed Decision 4) — but the *reason* is corrected: it is not because the desktop needs it today, but because removing it cleanly requires also removing its only caller (`Toolbar/actions.ts`), which this packet defers as a bounded, separate follow-up rather than folding an extra removal into an already-multi-surface packet.

## Fixed Decisions

1. **The browser dev route (`bun run dev`) is unaffected and needs no special handling.** `playwright.config.ts`'s default viewport is `1280×800` for every project (including the WebKit project), well above the 768px `isMobile` breakpoint (`packages/vue/src/editor/viewport-kind/use.ts`), so no existing or future test at the default viewport ever reaches the mobile branch today or after this packet. The only two things that visibly change in the browser dev route are: (a) resizing the browser window below 768px now shows the same desktop chrome instead of a mobile layout (Fixed Decision 3), and (b) WebKit/Safari browsers no longer show the `SafariBanner` warning — confirmed harmless, since grepping `App/tests/` for `safari-banner` returns zero matches, so no existing WebKit-project spec (`design/panel.spec.ts`, `export/basic.spec.ts`, `fonts/settings.spec.ts`) asserts on it.
2. **`MobilePresencePopover.vue` and `MobileShareButton.vue` are deleted along with the rest of `MobileHud/`, not left alone or deferred.** Both were read in full: they consume only `useMobileHudContext()` (itself `MobileHud/`-local plumbing over the already-desktop-covered `useCollab()`/`COLLAB_KEY` from `EditorView.vue`), hold no unique collaboration logic, and have exactly one possible mount point (inside `MobileHud.vue`) which is itself being removed. Deleting them removes zero collaboration business logic — `App/src/app/collab/`, `CollabPanel.vue`, presence/multiplayer session wiring, and the deferred collaboration-surface decision are all completely untouched. This resolves the stub's "leave them alone or sequence after" choice: leaving two permanently-unmountable dead files behind would contradict this packet's own purpose, so they are deleted as dead UI, with an explicit, verified guarantee that no live collaboration behaviour is touched.
3. **The mobile branch in `EditorView.vue` is deleted outright, not gated by a flag.** `EditorView.vue`'s desktop branch condition changes from `!isMobile && showChrome && store.state.showUI` to `showChrome && store.state.showUI` (dropping `!isMobile`), and the `v-else-if="isMobile && showChrome && store.state.showUI"` mobile branch is removed. A narrowed window (or, before any future build, a narrow browser window) now renders the same desktop chrome it does today at normal width — visually tighter, but no functional loss, since every mobile-only affordance already has a desktop equivalent (undo/redo via `AppMenu`/keyboard; New/Open/Save/Export via `AppMenu`/native menu; Layers/Design/Code/AI via the existing dock panels; presence/share via `CollabPanel.vue`; tool selection via `DesktopToolbar`).
4. **`App/src/app/editor/mobile-clipboard/`, `App/src/components/Toolbar/actions.ts` (`useToolbarActions`), and the `session/types.ts` fields `activeRibbonTab`/`mobileDrawerSnap`/`panelMode` are explicitly out of scope and untouched.** See Corrections to the Brief for why `mobile-clipboard` is not desktop-live (contrary to the brief's relayed premise) and is nonetheless deferred rather than removed here: removing it cleanly requires removing its only caller (`Toolbar/actions.ts`), and removing the `session/types.ts` fields touches the shared `EditorState` type/default used across serialization-adjacent code this packet has not audited. Both are recorded as a follow-up under Restrictions, not silently left as an unexplained gap.
5. **A `minWidth`/`minHeight` is added to `App/desktop/tauri.conf.json`'s single window entry.** Since removing the mobile branch means a narrow window now renders squeezed desktop chrome instead of a purpose-built mobile layout, and no minimum size exists today (Verified Starting State), add `"minWidth": 960, "minHeight": 640` beside the existing `width`/`height` keys — comfortably above the 768px breakpoint so `isMobile` can never become true in the shipped desktop app. This line has no observable effect until a future build (source-gates-only delivery policy; no build is run by this packet) — record that explicitly rather than claiming it verified.
6. **`Toolbar.vue` keeps calling the public SDK primitive `useToolbarState()` only if `DesktopToolbar` needs it — it does not (`DesktopToolbar.vue` was read in full and takes no such props), so the call is removed from `Toolbar.vue` entirely.** `packages/vue/src/primitives/Toolbar/useToolbarState.ts` itself is a documented public SDK export (`packages/docs/*/programmable/sdk/api/advanced/use-toolbar-state.md` exists in all locale doc trees) and is **not** touched — only this app-local call site changes, per `AGENTS.md`'s instruction to preserve public package boundaries.

## Open Decisions

1. **Should a follow-up packet remove `mobile-clipboard`, `Toolbar/actions.ts`, and the three orphaned `EditorState` fields once this packet lands?** Recommendation: yes, as its own small, focused packet, once this packet is confirmed Done — at that point `Toolbar/actions.ts` will have zero callers (verifiable by the same grep used in Corrections to the Brief), making the removal mechanical and low-risk, and the `EditorState` field removal can get the dedicated serialization/recovery audit this packet's scope does not include.

## Visual Contract — binding

This packet removes chrome; it introduces no new visual surface. The binding contract is what must remain pixel-identical afterward for the desktop chrome:

- `DesktopToolbar.vue`'s own markup, classes and `data-test-id="toolbar"` are untouched — it is not edited by this packet at all.
- `EditorView.vue`'s desktop branch (`EditorView.vue:267-290` today) keeps every line inside it byte-identical; only its `v-if` condition loses the `!isMobile &&` clause, and the mobile `v-else-if` branch that follows it is deleted.
- `AppMenu`, `TabBar`, `PanelStack`, `EditorCanvas`, `PanelOverlay`, panel parking hosts and `WorkspacePanel` are not touched.
- No new npm dependency, no new `tv()` recipe, no new class, no literal colour. Deletions only, plus the two one-line condition edits in `EditorView.vue` and `Toolbar.vue`, plus the `tauri.conf.json` size addition.

### Banned List

- No literal colour, no font-size outside `text-xs`/`text-[11px]`, no radius outside `rounded-md`/`rounded-lg` — moot, since no new markup is added, but binding if any touch-up is needed.
- No new `tv()` recipe, no new npm dependency, no inline `style=`, no `@apply`, no edit to `App/src/app.css`.
- Do not add a mobile-detection fallback UI, a "please resize your window" screen, or any new responsive branch. The desktop chrome is used as-is at every width — Fixed Decision 3 is deliberate.
- Do not touch `packages/vue/src/primitives/Toolbar/useToolbarState.ts` or any other public SDK export under `packages/vue/src` or `packages/core/src`.

## Allowed Changes

Delete:
- `App/src/components/SafariBanner.vue`
- `App/src/components/MobileHud/` (all 8 files)
- `App/src/components/MobileDrawer.vue`
- `App/src/components/Toolbar/MobileToolbar.vue`
- The six `MobileDrawer`-only constants from `App/src/constants.ts`: `DRAWER_SPRING_DAMPING`, `DRAWER_SPRING_STIFFNESS`, `HALF_FRAC`, `HUD_TOP`, `SWIPE_THRESHOLD`, `SWIPE_VELOCITY_THRESHOLD`

Edit:
- `App/src/views/EditorView.vue` — remove the `SafariBanner`, `MobileHud`, `MobileDrawer` imports and their three usages (`<SafariBanner />`, the mobile branch, and the imports at lines 44-45, 50); drop `!isMobile &&` from the desktop branch's `v-if`; delete the mobile `v-else-if` branch. Also confirm `useViewportKind`'s `isMobile` import is still needed for nothing else in this file before removing it (it is used only in the two conditions being edited — verify and remove if so).
- `App/src/components/Toolbar/Toolbar.vue` — remove the `MobileToolbar` import and its template branch (leaving `DesktopToolbar` unconditional, no `v-if`/`v-else`); remove `useViewportKind`/`isMobile`; remove the `useToolbarActions` call and the now-unused `editActions`/`arrangeActions`; remove `useToolbarState()`'s destructured `mobileCategory`/`slideDirection`/`hasPrev`/`hasNext`/`goPrev`/`goNext` and the `onActionTap` helper (all were `MobileToolbar`-only per the Verified Starting State).
- `App/desktop/tauri.conf.json` — add `"minWidth": 960, "minHeight": 640` to `app.windows[0]`.

New test:
- `App/tests/e2e/shell/no-mobile-chrome.spec.ts` (following the `tests/e2e/shell/` convention `chrome.spec.ts` already established under T-031d).

Nothing else. `DesktopToolbar.vue`, `App/src/app/shell/panels/*`, `App/src/app/shell/menu/*`, `CollabPanel.vue`, `ZoomDropdown.vue`, `App/src/app/editor/mobile-clipboard/`, `App/src/components/Toolbar/actions.ts`, `App/src/app/editor/session/types.ts`, `App/src/app/shell/keyboard/actions.ts`, and every locale file must not change.

## Restrictions and Exclusions

- No removal of `App/src/app/editor/mobile-clipboard/` or `App/src/components/Toolbar/actions.ts` in this packet (Fixed Decision 4, Open Decision 1).
- No removal or edit of `App/src/app/editor/session/types.ts`'s `activeRibbonTab`, `mobileDrawerSnap` or `panelMode` fields, or of `App/src/app/shell/keyboard/actions.ts`'s `toggleAI()` (its `isMobile.value` branch becomes unreachable in the shipped app after the `minWidth` change but is left as dead-but-harmless code, not deleted, since it reads/writes the still-present `EditorState` fields).
- No removal of `packages/vue/src/editor/viewport-kind/use.ts` (`useViewportKind`/`isMobile`) — it remains a valid public primitive; only its two app-local call sites (`EditorView.vue`, `Toolbar.vue`) are edited, and `App/src/app/shell/keyboard/use.ts`/`actions.ts` keep their existing call unchanged.
- No removal of collaboration business logic (`App/src/app/collab/`, `CollabPanel.vue`) — only the two dead mobile UI wrappers over it (Fixed Decision 2).
- No desktop behaviour, layout or command change beyond dropping the now-dead `!isMobile` branch and its condition clause.
- **Deferred to a later packet**: removing `mobile-clipboard`, `Toolbar/actions.ts`, and the three orphaned `EditorState` fields (Open Decision 1).
- An implementer who wants to cross any of these should stop and report.

## Implementation Steps

1. Re-read every file in the Verified Starting State table to confirm line numbers and consumer counts have not drifted since 2026-08-15.
2. Delete `SafariBanner.vue`, `MobileHud/` (all 8 files), `MobileDrawer.vue`, `Toolbar/MobileToolbar.vue`.
3. Edit `EditorView.vue`: remove the three imports and mounts, change the desktop branch's `v-if` to drop `!isMobile &&`, delete the mobile `v-else-if` branch. Re-run the file's remaining `isMobile` usages check (should be none).
4. Edit `Toolbar.vue`: remove `MobileToolbar`, `useViewportKind`, the `useToolbarActions` call and its now-unused destructured values, the six mobile-only `useToolbarState()` fields, and `onActionTap`. `DesktopToolbar` renders unconditionally.
5. Delete the six now-orphaned constants from `App/src/constants.ts`.
6. Add `minWidth`/`minHeight` to `App/desktop/tauri.conf.json`'s window entry.
7. Add `App/tests/e2e/shell/no-mobile-chrome.spec.ts`: assert `[data-test-id="toolbar"]` (the desktop toolbar) is visible at the default 1280×800 viewport; resize the page viewport to e.g. 600×800 and assert the desktop toolbar is *still* the element present (no mobile-only test id exists to assert absence of, since none were ever added — assert on the desktop toolbar's continued presence and on `document.querySelector` returning null for any element whose class list or test id previously belonged to `MobileHud`/`MobileDrawer`, if any residual selector is still meaningful — otherwise assert the desktop toolbar and `AppMenu`/`TabBar` chrome are unaffected by the resize); assert no element matches `[data-test-id="safari-banner"]` regardless of viewport.
8. Hand-verify in the dev build: normal window width shows unchanged desktop chrome; a manually narrowed browser window (below 768px) now shows the same desktop chrome, tightly packed, with no mobile HUD/drawer/toolbar anywhere; `bun run dev` continues to serve normally.
9. Run, in this order, and record exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused Oxlint on `src/views/EditorView.vue src/components/Toolbar/Toolbar.vue src/constants.ts tests/e2e/shell/no-mobile-chrome.spec.ts` (plus confirm the deleted files/directories are gone, not merely unlinked from imports)
   - `bun run check:i18n` (no strings changed; expect a no-op pass)
   - `bunx playwright test tests/e2e/shell/no-mobile-chrome.spec.ts tests/e2e/shell/chrome.spec.ts tests/e2e/panels/basic.spec.ts --project=openpencil`
   - `bunx playwright test tests/e2e/design/panel.spec.ts tests/e2e/export/basic.spec.ts tests/e2e/fonts/settings.spec.ts --project=openpencil-webkit` (regression: confirm the WebKit project, which used to show `SafariBanner`, still passes with it gone)

   Do not run `bun run check`, `bun run test` or `bun run test:unit`.
10. Do not claim delivery. This packet stops at source gates; the `minWidth`/`minHeight` change has no observable effect until a build, which is only run if the user asks.

## Acceptance Criteria

- [ ] `SafariBanner.vue`, `MobileHud/` (all 8 files), `MobileDrawer.vue` and `Toolbar/MobileToolbar.vue` no longer exist.
- [ ] `EditorView.vue` has no `SafariBanner`/`MobileHud`/`MobileDrawer` import or mount, and exactly one chrome branch (desktop) replaces the previous desktop/mobile pair; `showUI=false` and `?no-chrome` branches are unchanged.
- [ ] `Toolbar.vue` renders `DesktopToolbar` unconditionally with no remaining `MobileToolbar`, `isMobile`, or mobile-only `useToolbarState()` usage.
- [ ] `App/desktop/tauri.conf.json`'s window entry has `minWidth: 960, minHeight: 640`.
- [ ] `App/src/app/editor/mobile-clipboard/`, `Toolbar/actions.ts`, and the three `EditorState` fields are byte-identical to before this packet.
- [ ] `packages/vue/src/editor/viewport-kind/use.ts`, `CollabPanel.vue`, `App/src/app/collab/`, and every panel/menu file are byte-identical to before this packet.
- [ ] `App/tests/e2e/shell/no-mobile-chrome.spec.ts` passes; `chrome.spec.ts` and `panels/basic.spec.ts` stay green; the three named WebKit-project specs stay green with the Safari banner gone.
- [ ] The browser dev route (`bun run dev`) continues to serve and behave identically at the default 1280×800 viewport.
- [ ] Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: any file outside `MobileHud/`, `MobileDrawer.vue`, `Toolbar/MobileToolbar.vue`, `SafariBanner.vue` is found to import from them beyond what this packet's Verified Starting State lists; removing the six `constants.ts` exports breaks a build/type-check (meaning an undiscovered consumer exists); the `openpencil-webkit` project fails for a reason other than the expected `SafariBanner` absence; or a change outside the Allowed Changes list is required.

## Revision History

- Revision 1 — 2026-08-14: BRIEF, raised from the user's request batch 2.
- Revision 2 — 2026-08-15: expanded against live source. Corrected the relayed premise that `mobile-clipboard` is desktop-live (it is `MobileToolbar`-only, matching T-035's own recorded finding) while still keeping it out of scope, with the reason restated accurately. Resolved the `MobilePresencePopover`/`MobileShareButton` sequencing question by verifying they hold no unique collaboration logic. Settled the browser-dev-route question definitively from `playwright.config.ts`'s actual viewport and project configuration. Added the `tauri.conf.json` `minWidth`/`minHeight` fix so the removed mobile branch cannot be reached by resizing the shipped app.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (expanded 2026-08-15. **The brief's headline claim was wrong: `mobile-clipboard` is NOT live desktop code.** `DesktopToolbar.vue` has zero reference to it — `useToolbarActions`' `editActions`/`arrangeActions` are bound only on `MobileToolbar` (`Toolbar.vue:89,101-102`), matching what T-035's packet already recorded; independently re-verified 2026-08-15. It stays out of scope anyway, because removing it cleanly means removing its only caller too, filed as a follow-up. `MobilePresencePopover`/`MobileShareButton` hold no unique collaboration logic and are deleted with the rest of `MobileHud/`. Browser dev route settled from `playwright.config.ts`: every project uses a 1280×800 viewport, well above the 768px breakpoint, so it is unaffected. Adds `minWidth`/`minHeight` to `tauri.conf.json` — none exists today — closing the gap where a narrowed desktop window could still reach the removed mobile branch)
