# T-095 — Snapping for resize edges, vector points, and the pixel grid

Task ID: T-095
Packet state: Brief
Project goal link: Plan/endgoal.md
Depends on: T-010 (Done), T-024 (Done) for the node editor, T-030 (Done) for Preferences
Related: T-007 (guides), T-029 (canvas grid), T-017 (physical units), T-087 (Preferences vertical tabs)
Prepared from: comparison against `Toolbox/open-pencil-master (1)` on 2026-08-24 — upstream extended snapping to "vector points, moved layers, and resized edges … sibling layer bounds, canvas and frame layout guides, and whole-pixel coordinates … with fractional-coordinate preservation when pixel snapping is off, and persistent geometry, object, and pixel-grid controls in General settings".
Delivery: named source gates + browser check

## Intended Outcome

Snapping stops being move-only. Resizing a layer snaps its dragged edges, editing a vector point snaps that
point, and an optional whole-pixel mode keeps coordinates on integers — with fractional coordinates preserved
untouched while that mode is off. The three behaviours are independently switchable from Preferences.

## Verified Starting State

- `packages/scene-graph/src/snap.ts` exports `SNAP_THRESHOLD = 5` (line 5), `AlignmentSnapGuide` (7),
  `SpacingSnapGuide` (15), `SnapGuide` (25), `SnapResult` (27), `computeSnap` (185) and
  `computeSelectionBounds` (209). This is the shared engine and it is already the right place.
- `packages/vue/src/shared/input/move-snap.ts` exports exactly one function, `applyMoveSnap` (line 82). **It is
  the only consumer of the snap engine.**
- `packages/vue/src/shared/input/resize/` contains **no** snap module — `grep snap` over it returns nothing.
- `packages/vue/src/shared/input/node-edit/` contains **no** snap module.
- Upstream's equivalents, for scope comparison only: `packages/vue/src/shared/input/resize/snap.ts`,
  `node-edit/snap.ts`, `explicit-snap-targets.ts`, and a rewritten `snap.ts` in `shared/input/`.
- `src/app/shell/preferences.ts` holds `PREFERENCES_VERSION = 1` and an `AppPreferences` record of only
  `version`, `uiScale`, `hardwareAcceleration`; `normalise()` drops unknown keys. **Three new persisted
  toggles therefore require a version bump and a migration** (facts carried from T-087's expansion — re-verify
  at expansion time).
- T-087 (Preferences vertical tabs, `Ready`) restructures the same dialog. **Sequencing matters:** execute
  T-087 first, or this packet's new controls will be written into a layout that T-087 then moves.

## Fixed Decisions

1. **Extend the existing engine; do not fork it.** New call sites feed `computeSnap` in
   `packages/scene-graph/src/snap.ts`. A second snapping implementation for resize or vector editing is the
   failure mode to avoid.
2. **Pixel snapping is opt-in and non-destructive when off.** With the toggle off, existing fractional
   coordinates must survive every move, resize and vector edit byte-identically. This is the requirement most
   likely to be broken by a naive `Math.round`, and it matters for imported PDF and `.fig` content.
3. **Three independent toggles, not one.** Geometry snapping, object snapping and pixel-grid snapping are
   separate concerns; a single switch would force users to lose edge snapping to escape pixel rounding.
4. **Split before executing.** This is at least three packets — resize-edge snapping, vector-point snapping,
   and the pixel-grid mode plus its Preferences controls. Do not attempt it as one.

## Open Decisions

1. **Does pixel snapping mean device pixels or document units?** In a print document at 300 dpi these are not
   the same thing, and T-017 introduced physical units. Recommended: snap in document units and name the
   control accordingly; expansion must state which and why.
2. **Snap targets for vector points.** Recommended first cut: other points in the same vector network plus the
   node's own bounds. Sibling-layer bounds and layout guides can follow.
3. **Threshold at high zoom.** `SNAP_THRESHOLD = 5` is currently unqualified. Expansion must confirm whether it
   is screen pixels or document units and whether resize/vector snapping need a different value.

## Restrictions and Exclusions

- Do not change move snapping's existing behaviour or `applyMoveSnap`'s signature.
- Do not change `SNAP_THRESHOLD` without recording the reason and re-running the T-010 specs.
- Do not touch the pen tool's own constraint behaviour (T-024, T-024b, T-024c).
- Do not restructure the Preferences dialog — that is T-087's job. Execute T-087 first.
- No dependency, build, install or Git work.

## Verification

Unit-test each new snap path against the existing engine headlessly, including an explicit
fractional-coordinate-preservation case with pixel snapping off. Extend the T-010 e2e snapping spec rather than
replacing it, and confirm it passes unchanged for move. Then `bun run dev` and browser-check resize, vector
edit and pixel mode on both an integer-coordinate document and a PDF-imported fractional one. No umbrella
command, no build, no install.

## Status record

2026-08-24 — Captured from the upstream comparison. Brief only, and deliberately oversized: it must be split
at expansion per Fixed Decision 4. The upstream resource is non-authoritative and its input modules have
diverged substantially from App's; read it for the target behaviour, not for code.
