# T-097 — Spreads and page snapping

Task ID: T-097
Packet state: Brief
Depends on: T-010 (Done — smart snapping), T-065 (page strip, coordinates only)
Related: T-007 (guides/margins/bleed), T-018 (print presets), T-027 (frame presets), T-095 (resize/vector snap — unrelated extension)

## Intended Outcome

Documents can be set to Facing Pages mode (via Document Setup), which pairs left (verso) and right (recto) page frames into spreads — two or more pages positioned side by side across a central spine, as seen in Affinity Publisher and InDesign. The feature supports three document modes:

1. **Single Pages** — current behaviour; each page frame stands alone. Best for flyers, posters, and single-page output.
2. **Facing Pages / Spreads** — left and right pages are linked into spread pairs that share a spine. Best for books, magazines, booklets, and any print product designed for two-page viewing or folding.
3. **Custom Spreads** — the user may manually add more than two pages to a spread (e.g. a gatefold or fold-out) by dragging a page frame to dock beside an existing spread.

When the user places two frames next to each other on the canvas, they snap together at their touching edges (page-to-page object snapping). The spine is implied by that shared edge. The spread is treated as a single navigable unit in the page strip and layer tree.

### Key interactions

- **Object snapping between page frames:** When dragging a page frame near another page frame's edge, the edges snap together with zero gap, forming a spread. The snap engine (T-010) must recognise page-frame edges as snap targets for other page frames.
- **Document Setup toggle:** A "Facing Pages" checkbox in File > Document Setup enables or disables spread mode. When enabled, new pages are automatically paired. When disabled, pages revert to single-page layout.
- **Spine display:** A visual spine line or gutter indicator renders between spread partners so the user can see the binding edge.
- **Spread-aware navigation:** The page strip, page panel, and zoom-to-fit treat a spread as one unit — navigating to a spread shows both pages.

## Verified Starting State

- `App/packages/core/src/editor/pages.ts` manages the page list and page switching; pages are independent top-level frames with no pairing or grouping concept.
- `App/packages/core/src/editor/page-viewports.ts` stores per-page viewport state.
- `App/packages/core/src/canvas/page-guides.ts` draws per-page guides, margins and bleed (T-007).
- `App/packages/core/src/canvas/overlays/feedback.ts` renders move-snap guidelines (T-010).
- `App/packages/scene-graph/src/types.ts` defines the scene-graph node types; no spread or facing-pages metadata exists.
- No "spread", "facing", "verso" or "recto" concept exists anywhere in the source.

## Scope and Acceptance Criteria

- Add a document-level `facingPages` boolean and a per-page `spreadId` or equivalent grouping field to the scene-graph or document model.
- When Facing Pages is on: new pages auto-pair into left/right spreads; the canvas positions spread partners side by side; the page strip shows spread thumbnails as a joined unit.
- Page-to-page frame snapping: dragging one page frame near another's edge snaps them flush. This reuses and extends the T-010 snap engine — page frames become snap sources/targets for each other.
- Spine indicator: draw a subtle vertical line or gutter between spread partners on the canvas.
- Document Setup: a "Facing Pages" checkbox in File > Document Setup (or equivalent dialog) toggles spread mode on/off, re-laying out pages accordingly.
- Spread-aware zoom-to-fit and page navigation.
- Preserve single-page behaviour as the default for new documents.
- Do not change the existing snap behaviour for non-page objects.
- Do not add collaborative or cloud features.

## Verification

Targeted unit tests for spread model operations (pair, unpair, reorder, add page to spread). E2E or browser check: toggle Facing Pages, verify page layout, snap two frames together, navigate between spreads. Run `bun run dev` and inspect visually. No build/install.

## Status record

2026-08-24 — First brief from user request for spreads, facing pages, and page-to-page frame snapping. Expansion must inspect the page model, snap engine, and Document Setup surface to determine the concrete data model and snap-target extension.
