# T-034 - Add a page-overview layout

Task ID: T-034
Packet state: Retired — superseded workspace-mode route; do not execute
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-032, T-033
Prepared from: the user's 2026-08-07 Canva-like layout-view request
Expanded at: 2026-08-11T08:52:32+02:00
Expanded against plan snapshot: `Plan/plan.md` read 2026-08-11; this project has no numeric plan-version field
Expansion route: JUDGED from the user's “go for it”

## Request Coverage

- Provide a toolbar-selected visual overview that makes it quicker to move between the current document's frames/pages.

## Intended Outcome

The `Overview` segment in T-032's prominent workspace switcher presents the current document's existing page/frame structure as a browseable visual layout. Selecting an item returns to the normal editor at that target without changing document content.

## Original Scope Questions (resolved below)

- Confirm whether the overview is based on pages, top-level frames, or both; do not assume Canva's page model maps directly to OpenPotlood.
- Confirm whether it is a temporary overlay, a replacement canvas view, or a panel; recommended starting point is a temporary overlay entered from T-032's layout switcher.
- Confirm thumbnail generation/performance limits and the minimum content needed in each card before implementation.

Resolved by judged expansion:

- Show both real document pages and their direct-child top-level frames. Do not treat nested frames, groups or sections as pages.
- Use a temporary overlay that replaces only the canvas presentation inside the desktop workspace; keep tabs, panels and the T-032 toolbar/switcher available.
- Render lazy, bounded thumbnails with existing CanvasKit raster helpers: page thumbnails through `renderThumbnail()`, frame thumbnails through `renderNodesToImage()` at a clamped preview scale. Render only cards near the viewport, maximum two jobs concurrently, and cache by tab/document, scene version and target ID.
- Each card shows thumbnail/fallback, target name, kind and page name. Initial scope is navigation only.

## Constraints

- Read the live scene/document APIs first; overview navigation must not introduce a parallel page model.
- Initial scope is browse/navigate only: no reordering, duplicate, delete, rename, or bulk editing actions.
- No document-data, export, MCP, mobile, or desktop-shell changes without a separate packet.

## First Expansion Reads

T-032, `src/views/EditorView.vue`, `src/components/LayersPanel.vue`, page/frame scene selectors, existing thumbnail/render-preview code, navigation commands, and focused document/canvas tests.

## Acceptance Direction

- [ ] The overview opens from T-032's labelled `Overview` segment and clearly identifies the active target.
- [ ] Selecting a target returns to normal editing at that page/frame without changing artwork or selection unexpectedly.
- [ ] Large documents remain responsive through a verified rendering/virtualisation strategy.
- [ ] Keyboard navigation, focus return, and an explicit close route work reliably.

## Stop Conditions

Stop and re-brief if the live document model cannot distinguish the agreed targets, thumbnail generation impacts editor responsiveness, or the request expands into page management.

## Expansion Research

| Live path | Verified seam | Binding treatment |
| --- | --- | --- |
| `App/packages/scene-graph/src/` graph APIs | `graph.getPages()`, `graph.getNode()` and page `childIds` expose the real hierarchy | Derive targets from live CANVAS pages and direct child nodes whose type is `FRAME`; create no parallel page model |
| `App/packages/core/src/editor/pages.ts` | `switchPage(pageId)` preserves per-page viewport, resolves fonts, clears selection and renders | Use for every cross-page navigation before selecting a frame |
| `App/packages/core/src/editor/viewport.ts` | `zoomToSelection()` and `zoomToBounds()` are established navigation actions | Frame card: select the frame then call `zoomToSelection()`; page card: rely on restored page viewport |
| `App/packages/core/src/io/formats/raster/render.ts` | `renderThumbnail(ck, renderer, graph, pageId, width, height)` renders a fixed-size page preview; `renderNodesToImage()` renders selected nodes | Reuse synchronously behind a bounded async queue; never alter export settings or download files |
| `App/src/app/editor/active-store` | Exposes current store, graph, renderer and reactive editor state | Read graph/current page/scene version; use existing editor actions for navigation |
| `App/src/views/EditorView.vue` | Desktop canvas wrapper contains EditorCanvas and Toolbar | Mount Overview over the canvas in this wrapper; keep desktop shell and toolbar alive |
| `App/src/components/PagesPanel.vue` and `@open-pencil/vue` `PageListRoot` | Existing page naming/current-page/switch semantics | Match names and active-page treatment; do not reuse its edit/reorder actions |
| `App/src/components/Toolbar/DesktopToolbar.vue` | T-032 switcher remains visible above tools | Enable Overview only once this packet's overlay is present |
| `App/tests/helpers/store.ts`, `tests/e2e/viewport/zoom-pan.spec.ts`, `tests/e2e/layers/panel.spec.ts` | Established graph seeding, selection and viewport assertions | Reuse for focused Overview tests |

No dependency is added. `Blob`, `URL.createObjectURL`, `IntersectionObserver`, Vue and current CanvasKit helpers are sufficient. Relevant skill: `manage-projects` for executable-packet boundaries.

## Fixed Target, Thumbnail and Navigation Contract

- `OverviewTarget` is `{ id, pageId, kind: 'page' | 'frame', name, pageName }`. Page targets come first in graph order; each page is followed by its direct-child FRAME targets in child order.
- Add pure `src/app/shell/overview/targets.ts` for target collection and tests. It ignores nested frames, hidden divider/page pseudo-items, groups, sections, slices and deleted IDs.
- Add `src/app/shell/overview/thumbnails.ts` with a two-job queue and cache key `${tabId}:${sceneVersion}:${kind}:${id}`. Page previews are 240 × 160 via `renderThumbnail()`. Frame scale is `min(240 / width, 160 / height, 1)` after validating finite positive bounds, then `renderNodesToImage(..., { format: 'PNG', scale, trimTransparent: false })`.
- Generate only when a card enters a 400 px IntersectionObserver root margin. Keep at most two render jobs active. Cancel/ignore stale results when tab, scene version or target changes; revoke Blob URLs on invalidation and unmount.
- Empty pages, zero-size frames, missing renderer/CanvasKit and render failures show a themed labelled fallback card; they do not mutate state or crash the overlay.
- `PageOverview.vue` is a full canvas-area overlay with heading, target count, close action and responsive card grid. The active page and any selected frame are marked without relying on colour alone.
- Activating a page card awaits `store.switchPage(pageId)`, then sets view to Workspace. Activating a frame card awaits the page switch when needed, selects exactly that frame, calls `zoomToSelection()`, then returns to Workspace. No history entry or dirty flag is created.
- Keyboard: Tab/Shift+Tab traverse controls, arrow keys move among cards using the grid column count, Enter/Space activates, Escape returns to Workspace, and focus returns to the canvas after navigation or to the Overview segment after cancellation.
- Overview is global view state from T-032 but content always derives from the active tab. Dashboard, mobile, `showUI=false` and `?no-chrome` never show it.

## Allowed Changes

New `src/app/shell/overview/{targets,thumbnails}.ts`; new `src/components/Shell/PageOverview.vue`; desktop-canvas integration in `EditorView.vue`; T-032 availability/state and toolbar/menu enablement; typed i18n defaults and all locale JSON; focused unit/Playwright tests; delivery receipt and version files only after gates pass.

## Excluded Scope

No page/frame reorder, rename, duplicate, delete, create, drag/drop, bulk selection or editing; no nested-frame overview; no persistent thumbnails; no document schema/plugin data; no export/download change; no CanvasKit renderer redesign; no mobile/dashboard/bare-canvas view; no new dependency.

## Implementation Steps

1. Verify T-032 and T-033 are complete and focused checks pass. Reconfirm `renderThumbnail`, `renderNodesToImage`, graph hierarchy, `switchPage` and viewport actions.
2. Implement and unit-test pure target collection for multiple pages, direct frames, nested frames, empty pages, missing IDs and stable graph order.
3. Implement the bounded thumbnail queue/cache, finite-size guards, stale-result cancellation, Blob URL cleanup and fallback results. Unit-test queue concurrency, cache keys, invalidation and cleanup without requiring real CanvasKit pixels.
4. Build `PageOverview.vue` with responsive semantic grid, active markers, fallbacks, lazy observation, loading states, accessible counts/labels and explicit close.
5. Mount it over the desktop canvas when `activeView === 'overview'`, keep toolbar/panels alive, enable Overview in T-032, and implement page/frame navigation plus focus return.
6. Add Playwright tests seeded with multiple pages, direct frames, nested frames, empty/zero-size targets and 200 targets. Prove target filtering/order, only near-viewport thumbnails start, concurrency stays ≤2, page and frame navigation, selection/zoom/dirty-state semantics, keyboard paths, focus return, tab switching, themes and excluded branches.
7. Run `bun test ./tests/engine/app/shell/overview/`, `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint, `bun run check:i18n`, and `bunx playwright test tests/e2e/workspace/overview.spec.ts tests/e2e/viewport/zoom-pan.spec.ts --project=openpencil`. No umbrella checks without explicit instruction.
8. After source gates pass, run `cd App && bun run dev` and verify in the browser: real multi-page/frame thumbnails, page and frame navigation, focus return, responsiveness, and persistence across a reload. Do not build, install, or bump version files. Installed identity/version/SHA-256 is deferred to a batched delivery the user authorises separately.

## Acceptance Criteria

- [ ] Overview is enabled in T-032 and shows every real page plus only its direct-child top-level frames in stable document order.
- [ ] Page/frame cards have bounded live thumbnails or explicit safe fallbacks, names, kinds, page context and active markers.
- [ ] Page activation switches pages and returns to Workspace; frame activation switches page if needed, selects the frame, zooms to it and returns to Workspace without dirtying artwork.
- [ ] Thumbnail work is lazy, cacheable, stale-safe and limited to two concurrent renders; Blob URLs are revoked.
- [ ] A 200-target document remains responsive and does not eagerly render all thumbnails; empty, invalid and renderer-unavailable cases remain usable.
- [ ] Keyboard navigation, Enter/Space, Escape, close and focus return work; panels, tabs and toolbar stay alive.
- [ ] No page-management, document, export, MCP, mobile, dashboard or bare-canvas behaviour is introduced.
- [ ] Focused tests/checks and installed Windows verification pass before delivery is claimed.

## Verification and Evidence

Record target fixtures/count/order, thumbnail jobs started and maximum concurrency, cache/invalidation/URL cleanup evidence, page/frame navigation state before/after, dirty flag and history depth, large-document timing/responsiveness, exact check exits, and installed path/version/hash/interactions. Rendering all thumbnails eagerly, leaking Blob URLs, mutating the document or inventing a second page model is a stop condition.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| Overview contains pages and direct-child frames | Maps OpenPotlood's real hierarchy to the user's “frames/pages” wording without conflation | User wants pages only or nested frames too | Change pure target collector and card grouping; navigation contract remains |
| Overlay replaces only canvas presentation | Keeps panels available for context and avoids shell remounts | User wants a full-application gallery | New layout packet; do not stretch this overlay |
| Navigation returns to Workspace | The requested outcome says return to normal editing at the target | User expects return to Focus or remain in Overview | Change post-activation view transition only |

Outstanding questions: none. Page management or alternative grouping is new scope.

## Revision History

- Revision 2 — 2026-08-11: expanded against live graph, page-switch, viewport and raster-thumbnail APIs; fixed targets, overlay form, lazy rendering limits, navigation and evidence.

## Status record

Status: **Ready**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Prepared (expanded 2026-08-11; depends on T-032 and T-033)
