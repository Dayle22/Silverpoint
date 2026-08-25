# T-029 - Deliver an infinite-canvas background grid guide

Task ID: T-029
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-007
Prepared against: live CanvasKit background/viewport, page/frame guides, layout grids, settings/theme, export seams, and tests on 2026-07-24
Last expanded: 2026-07-24

## Closure Decision

T-029 was marked `DONE / VERIFIED` on 2026-07-24 by the user's explicit approval after installed OpenPotlood `0.6.14` visibly kept the canvas dots present after scene settling without frame movement. The focused retained-backing/grid suite passed `8/8`; the fresh NSIS build/install, installed identity/hash, two responsiveness checks, and pipeline validation passed.

The user accepted closure without fresh export/`.fig` exclusion proof, full installed pan/zoom and line-mode observation, reset/relaunch, contrast, or performance checks. These checks remain unperformed and are not represented as passing evidence.

## Request Coverage

- Add a display-only dot or line grid behind infinite-canvas artwork.
- Keep it anchored through pan/zoom, adjustable in spacing and colour, non-selectable, and excluded from raster/SVG/PDF/.fig export.

## User-Visible Outcome

The user can toggle a subtle dot or line grid behind the infinite canvas, tune its spacing and colour, and pan/zoom without the grid becoming artwork.

## Verified Starting State

- Renderer owns `pageColor`, pan/zoom, world viewport, and editor overlays; page/frame guides and layout grids are separate draw paths.
- T-007 owns document guides/margins/bleed and export exclusion; layout grids are document data and must not be reused as this app-level background.
- Theme settings use `useLocalStorage` and update native/canvas theme; no infinite background-grid preference exists.
- Export routes are centralised under `src/app/document/export` and core IO adapters.

## Fixed Decisions

- Grid is app-level display state, not a SceneGraph node, page guide, layout-grid field, plugin-data value, or `.fig` content.
- Default is off; dot mode is default when enabled, spacing `16 px` in scene units, line mode shares the same spacing, and colour defaults to a low-contrast theme-derived neutral. This bounded implementation clamps spacing to `4–256 px`; physical-unit conversion remains owned by T-017.
- Draw behind artwork and above the infinite background fill; geometry is generated in world space with zoom-aware stroke/dot sizing and bounded tiling to the visible viewport.
- Grid is never hit-testable, selectable, serialised, printed, rasterised, or exported. Accessibility requires a visibility toggle and contrast-safe controls, not forced grid pixels.

## Read First

`Toolbox/Project-History/PROJECT.md`, `Plan/plan.md`, `T-007`, `T-017`, `App/AGENTS.md`, renderer lifecycle/scene/viewport, page/frame/layout-grid guides, canvas input hit testing, theme/settings, export adapters, and visual/E2E tests.

## Allowed Changes

Renderer background draw seam, app-level grid settings/store/UI, focused renderer/visual/E2E tests, and report/docs. No document schema or export adapter changes except explicit exclusion assertions.

## Restrictions and Exclusions

No selectable grid layers, document layout-grid mutation, print/export inclusion, guide redesign, or preferences-menu integration beyond a narrow settings API consumed later by T-030.

## Implementation Steps

1. Confirm draw ordering, viewport transform, hit-test boundary, and T-017 unit/range policy.
2. Define typed settings, defaults, validation, dot/line geometry, zoom behaviour, reset, and local persistence.
3. Add renderer drawing behind all scene content and verify pan/zoom anchoring and performance.
4. Add UI toggles/controls and tests proving no graph/plugin-data/export changes.
5. Run focused visual/E2E checks, quality/pipeline checks, then installed proof.

## Acceptance Criteria

- [ ] Dot and line modes render behind artwork, remain anchored during pan/zoom, and use validated spacing/colour.
- [ ] Grid is never selectable or persisted in document content.
- [ ] PNG/JPG/SVG/PDF/.fig exports contain no grid pixels/settings.
- [ ] Toggle, reset, relaunch, contrast, and performance behaviour are documented and tested.
- [ ] Focused visual/E2E tests, quality/pipeline checks, and installed evidence pass.

## Verification

Run renderer visual tests, pan/zoom E2E, hit-test/export/.fig assertions, `bun run check`, pipeline validation, and installed proof.

## Integration or Installed-Result Check

Installed OpenPotlood must prove dot/line modes, pan/zoom anchoring, non-selection, export/.fig exclusion, persistence scope, identity, and responsiveness.

## Stop Conditions

Stop if draw ordering cannot exclude export, settings require document schema, grid causes unacceptable large-viewport cost, or T-007 ownership is disturbed.

## Execution Report Contract

Record defaults/range/units, geometry and draw-order evidence, persistence scope, export/.fig hashes, changed files, test counts/exits, installed identity/responsiveness, deviations, and limits.

## Status record

Status: **Done**
