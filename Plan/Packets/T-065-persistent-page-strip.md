# T-065 - Add a persistent page thumbnail strip

Task ID: T-065
Packet state: EXPANDED (ready; no blocking dependency)
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none. Coordinates with T-032 (bottom-row order), T-034 (shares the thumbnail module), T-036 (bottom-row order).
Prepared from: the user's 2026-08-17 beginner-audience review and their decision "Persistent bottom strip"
Expanded at: 2026-08-17
Expanded against plan snapshot: `Plan/plan.md` read 2026-08-17
Expansion route: JUDGED from the user's 2026-08-17 decision
Expansion note: written to be executable by a less capable model. The Fixed Contract and Banned List are binding, not advisory.

## Request Coverage

The user's stated direction: *"Use a persistent, collapsible bottom strip"* of live page thumbnails, rated **high** beginner value for multi-page work. T-034's modal overlay does not deliver this — it is entered as a mode and left on selection. This packet delivers the ambient, always-visible form.

## Intended Outcome

A full-width band at the bottom of the desktop editor shows a horizontal row of live page thumbnails. The current page is clearly marked. Clicking a thumbnail switches page. The band collapses to a slim bar with a page count and expands again, and it remembers which state it was in. The canvas occupies the space above it and reflows when the band collapses or expands.

## The decision this packet exists to honour

The user chose a persistent bottom strip over both the modal overlay and "just open the existing panel". The naive readings of that are both wrong, and this section exists to stop either being implemented.

**It is not a third dock edge.** `App/src/app/shell/panels/types.ts:22` declares `DockSide = 'left' | 'right'`. Adding `'bottom'` means `PANEL_LAYOUT_VERSION 3 → 4`, a migration, `dockHeights`, a horizontal-axis `PanelStack`, bottom drop targeting, and a third-edge rail in T-033 — reopening the model that T-031a–T-031d just spent four packets stabilising. **Do not do this.** The strip is shell chrome, exactly like the bottom-centred tool strip and T-036's property row, both of which already live at the bottom without being panels.

**It is not a second source of page navigation.** The strip and `PagesPanel.vue` bind to the **same headless composable**. This is the pattern T-036 already established for properties: one model, two presentations. If you find yourself writing code to copy page state between the strip and the panel, or adding a Pinia store, a shared ref, an event bus or a sync watcher, you have taken the wrong approach — stop and re-read this section.

```ts
import { usePageList } from '@open-pencil/vue'

const { pages, currentPageId, switchPage } = usePageList()
// pages          -> reactive readonly list from editor.graph.getPages()
// currentPageId  -> computed from editor.state.currentPageId
// switchPage     -> editor.switchPage, already handles viewport, fonts, selection, render
```

## Verified Starting State (2026-08-17)

| Path | Verified fact |
| --- | --- |
| `App/packages/vue/src/primitives/PageList/usePageList.ts` | Returns `{ editor, pages, currentPageId, switchPage, addPage, deletePage, movePage, renamePage }`. `pages` is a `useSceneComputed(() => editor.graph.getPages())`, so it is already scene-reactive. **Bind to this.** |
| `App/src/components/PagesPanel.vue:14` | Uses `PageListRoot` from `@open-pencil/vue`, plus `useFlatReorderDrag` and `useInlineRename` for reorder and rename. Unchanged by this packet. |
| `App/src/views/EditorView.vue:265-286` | The desktop branch is `<div v-if="!isMobile && showChrome && store.state.showUI" class="flex min-h-0 flex-1 flex-col overflow-hidden">` containing one child, `<div data-test-id="editor-panels" class="relative flex min-h-0 flex-1 overflow-hidden">`. **A sibling added after `editor-panels`, inside that `flex-col`, is a full-width bottom band and the canvas row flexes above it automatically.** |
| `App/src/app/shell/panels/types.ts:22` | `DockSide = 'left' \| 'right'`. There is no bottom dock and this packet adds none. |
| `App/packages/core/src/io/formats/raster/render.ts` | `renderThumbnail(ck, renderer, graph, pageId, width, height)` renders a fixed-size page preview. `renderNodesToImage()` renders selected nodes. Both are synchronous CanvasKit calls. |
| `App/src/app/editor/active-store` | Exposes the current store, graph, renderer and reactive editor state, including scene version. |
| `App/src/components/Toolbar/DesktopToolbar.vue:36` | Tool strip is `absolute bottom-5 left-1/2 -translate-x-1/2 z-10` — positioned inside the canvas area, **not** a layout band. It will float above this strip without further change. |
| `App/src/app/shell/preferences.ts` | The versioned `useLocalStorage` + `normalise()` pattern to copy. |
| `App/src/app/shell/menu/schema.ts:154-156` | View menu owns `reset-panel-layout` and `toggle-ui` (`MOD+\`). |

## Fixed Contract

### Placement and structure

- New `src/components/Shell/PageStrip.vue`, mounted in `EditorView.vue` as the **next sibling after** `editor-panels`, inside the existing desktop `flex-col`. Desktop chrome branch only.
- The band is full window width and is a **real layout band**: the canvas row above it shrinks when it expands. Do not position it absolutely over the canvas.
- Expanded height is fixed at `96px`; collapsed height is fixed at `28px`. Do not make it user-resizable in this packet.
- Test ids: `page-strip`, `page-strip-toggle`, `page-strip-item-<pageId>`, `page-strip-count`.

### Collapsed and expanded states

- Expanded: a horizontally scrolling row of page cards, `overflow-x-auto scrollbar-thin`, never wrapping.
- Collapsed: a slim bar showing the translated page count and the current page name, plus the expand control. It still occupies `28px`; it is never fully hidden by its own toggle.
- Persist expanded/collapsed in a versioned record `{ version: 1, expanded: boolean }` under `open-potlood:page-strip`, defaulting to `expanded: true`. Invalid JSON or version normalises to the default.
- The whole band is hidden only when the document has **one** page and the strip has never been expanded by the user — a single-page document should not pay for multi-page chrome. Once the document has two or more pages the band appears. Store no extra state for this; derive it from `pages.value.length` and the persisted flag.

### Cards

- Each card shows the thumbnail (or a themed labelled fallback), the page name, and a 1-based index.
- Card size is `120 × 68` for the image area inside the `96px` band.
- The current page is marked with a border **and** a filled index badge and `aria-current="page"` — never by colour alone.
- Clicking a card calls `switchPage(pageId)` and nothing else. No selection change, no zoom change, no history entry, no dirty flag.
- Keyboard: the row is a single tab stop; `ArrowLeft`/`ArrowRight` move between cards with roving `tabindex`, `Home`/`End` jump to first/last, `Enter`/`Space` activates. The toggle is its own tab stop.

### Thumbnails

- Add `src/app/shell/thumbnails/pages.ts` as a **shared** module: a bounded render queue of at most **two** concurrent jobs, with cache key `${tabId}:${sceneVersion}:page:${pageId}`.
- Page previews render at `120 × 68` through `renderThumbnail()`.
- Render only for cards inside a `200px` IntersectionObserver root margin. Cancel or ignore stale results when the tab, scene version or page set changes. Revoke Blob URLs on invalidation and on unmount.
- Empty pages, a missing renderer or CanvasKit, and render failures produce a themed labelled fallback card. They never mutate state and never crash the band.
- **T-034 coordination:** T-034's expanded contract names `src/app/shell/overview/thumbnails.ts` with the same two-job queue. Whichever packet lands first creates `src/app/shell/thumbnails/pages.ts`; the second consumes it and adds only what it additionally needs (T-034 additionally needs frame thumbnails via `renderNodesToImage()`). Do not ship two queues.

### Menu and shortcut

- One View-menu checkbox item, `Show Page Strip`, mirrored identically on the browser (`app-menu.ts`) and native (`use.ts`) routes, toggling the same persisted flag as the in-band control.
- No new keyboard shortcut in this packet.

### Bottom-row ordering

Fixed order, bottom-most first: **this strip band**, then floating and centred above it inside the canvas area, the **tool strip**, then **T-036's property row**, then **T-032's capability switcher**. This packet owns the band; it must not reposition the three floating rows.

## Banned List

- Do not add `'bottom'` to `DockSide`. Do not bump `PANEL_LAYOUT_VERSION`. Do not add a panel-layout migration.
- Do not add a new entry to `PANEL_IDS`. The strip is not a panel.
- Do not modify `PagesPanel.vue`, `PageListRoot`, or `usePageList`.
- Do not copy page state into a store, ref, event bus or watcher. Bind to `usePageList` directly.
- Do not implement reorder, rename, add, delete or duplicate in the strip. Navigation only.
- Do not render thumbnails eagerly for every page, and do not exceed two concurrent render jobs.
- Do not position the band absolutely over the canvas.
- Do not edit `App/src/app.css`.
- Do not touch mobile, dashboard, `showUI=false` or `?no-chrome`.
- Do not add a runtime dependency.
- Do not build, install or bump versions. This packet stops at source gates.

## Allowed Changes

New `src/components/Shell/PageStrip.vue`; new `src/app/shell/thumbnails/pages.ts`; new `src/app/shell/page-strip.ts` for the versioned expanded flag; the single sibling insertion in `EditorView.vue`; View-menu schema and both action adapters; typed i18n defaults and all locale JSON; focused unit and Playwright tests.

## Excluded Scope

No page management of any kind (reorder, rename, add, delete, duplicate, drag). No frame thumbnails — pages only; frames belong to T-034. No user-resizable band height. No overlay/modal gallery (T-034). No capability switch behaviour (T-032). No canvas fit behaviour (T-066). No panel-model change. No scene-graph, CanvasKit, document, export or MCP change. No mobile, dashboard, `showUI=false` or `?no-chrome` behaviour. No build, install or release work.

## Implementation Steps

1. Re-read every Verified Starting State row, especially `EditorView.vue:265-286` and `usePageList.ts`. Stop on drift.
2. Add `src/app/shell/page-strip.ts` with the versioned expanded flag. Unit-test default, valid values, corrupt JSON and version mismatch.
3. Add `src/app/shell/thumbnails/pages.ts`: two-job queue, cache keys, stale cancellation, Blob URL revocation, fallback results. Unit-test queue concurrency never exceeds two, cache-key composition, invalidation on tab/scene-version change, and URL cleanup — without requiring real CanvasKit pixels.
4. Build `PageStrip.vue` bound to `usePageList`, with expanded and collapsed states, cards, current-page marking, lazy IntersectionObserver-driven thumbnail requests, fallbacks, and the roving-focus keyboard model.
5. Insert it as the sibling after `editor-panels` in `EditorView.vue`. Confirm the canvas row's height shrinks on expand and grows on collapse, and that the floating tool strip, T-036 row and T-032 switcher are unobscured.
6. Add the `Show Page Strip` View-menu item with identical browser and native actions and checked state. Add every visible string to typed defaults and all locale files (English defaults only if T-054 has landed).
7. Add `tests/e2e/workspace/page-strip.spec.ts`: a seeded multi-page document lists every page in graph order; the current page is marked; clicking a card switches page without changing selection, zoom, dirty state or history depth; expand/collapse changes the canvas bounding box and persists across reload; a single-page document hides the band and a second page reveals it; only near-viewport thumbnails start and concurrency stays at most two; a 60-page document stays responsive; empty and renderer-unavailable pages show fallbacks; keyboard roving, `Home`/`End`, `Enter`/`Space`; all four themes; narrow desktop width; band absent on mobile, dashboard, `showUI=false` and `?no-chrome`.
8. Run `bun test ./tests/engine/app/shell/page-strip.test.ts ./tests/engine/app/shell/thumbnails/`, `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint on touched paths, `bun run check:i18n`, and `bunx playwright test tests/e2e/workspace/page-strip.spec.ts tests/e2e/panels/basic.spec.ts --project=openpencil`. No umbrella checks and no build unless the user asks.

## Acceptance Criteria

- [ ] A full-width band at the bottom of the desktop editor lists every page as a live thumbnail card in graph order, with name, 1-based index, and a non-colour-only current-page marker.
- [ ] Clicking or keyboard-activating a card switches page and changes nothing else — no selection, zoom, dirty flag or history entry.
- [ ] The band collapses to a slim count bar and expands again; the state persists across reload; the canvas row reflows both ways.
- [ ] A single-page document shows no band until a second page exists or the user has expanded it.
- [ ] Thumbnails are lazy, cached, stale-safe, capped at two concurrent renders, and Blob URLs are revoked; a 60-page document stays responsive.
- [ ] `DockSide`, `PANEL_IDS` and `PANEL_LAYOUT_VERSION` are unchanged, and `PagesPanel.vue` is untouched and still works.
- [ ] Page state has exactly one source: `usePageList`. No copy, store, bus or sync watcher exists.
- [ ] The View-menu item matches the band control on both routes.
- [ ] All four themes and narrow desktop widths remain usable; the floating tool strip, T-036 row and T-032 switcher are unobscured; mobile, dashboard, `showUI=false` and `?no-chrome` are unchanged.
- [ ] Source gates in step 8 pass. No delivery is claimed without a separately authorised build.

## Verification and Evidence

Record the canvas bounding box expanded vs collapsed vs band-absent; `localStorage['open-potlood:page-strip']` across a toggle and reload; thumbnail jobs started and peak concurrency; cache-key and Blob-URL cleanup evidence; page-switch before/after state including dirty flag and history depth; timing for the 60-page fixture; screenshots in all four themes; and exact test counts and exit codes. A `DockSide` or `PANEL_LAYOUT_VERSION` change, a second page-state source, eager thumbnail rendering, a leaked Blob URL, or a mutated document is a stop, not a cosmetic exception.

## Stop Conditions

Stop and return to planning if a full-width layout band cannot be added to `EditorView.vue`'s desktop `flex-col` without disturbing the `editor-panels` row or the canvas remount key; if `usePageList` turns out not to be reactive to page add/delete without a panel mounted; if `renderThumbnail()` cannot be called at `120 × 68` without a visible editor stall; or if the user wants reorder or rename in the strip after all.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| The strip is chrome, not a dock | `DockSide` is `'left' \| 'right'`; the bottom of the app is already chrome territory for the tool strip and T-036 row. Avoids schema v4 and a four-packet regression risk | The user specifically wants panels to be dockable at the bottom generally, not just pages | New packet for a bottom dock edge, schema v4 and its migration. Do not smuggle it into this one |
| One shared model via `usePageList` | The exact precedent T-036 set for properties; removes the duplication objection entirely | `usePageList` proves insufficient for the strip's needs | Extend the composable in `packages/vue`, so both consumers still share one model |
| Fixed 96px / 28px heights | Keeps the band predictable and avoids a second resize system; the user asked for collapsible, not resizable | The user wants to drag the band's height | Add a persisted height to the same record; no structural change |
| Pages only, no frames | The user's mechanism table says "live page thumbnails"; frames are T-034's territory | The user expects top-level frames in the strip too | Reuse T-034's target collector once it exists; keep one thumbnail queue |
| Band hidden for a never-expanded single-page document | A one-page document should not pay 96px of chrome for a list of one | The user wants it always visible | Delete the derived condition; one-line change |

Outstanding questions: none. Reorder, rename, page management, resizable height and frame cards are all new scope.

## Revision History

- Revision 1 — 2026-08-17: first expansion, from the user's decision for a persistent bottom strip. Verified `usePageList` as the shared model and `EditorView.vue`'s desktop `flex-col` as the band seam; ruled out the `DockSide` extension and recorded why; assigned the shared thumbnail queue and the bottom-row ordering contract.
