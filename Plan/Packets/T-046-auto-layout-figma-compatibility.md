# T-046 - Improve auto-layout compatibility with Figma

Task ID: T-046
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-039 (consumes this model, does not change it), T-044 (independent)
Prepared from: the 2026-08-14 user request batch; this is a general request, not a report of a specific
observed failure, so the user's binding ruling is: produce a real gap list from the live engine and
existing tests, then cut a bounded first slice and defer the rest.
Expanded at: 2026-08-15
Expanded against: `App/packages/core/src/layout.ts`, `App/packages/core/src/layout/apply.ts`,
`App/packages/core/src/layout/yoga-helpers.ts`, `App/packages/core/src/layout/text-measurement.ts`,
`App/packages/core/src/text/opentype.ts`, `App/packages/core/src/canvas/text/index.ts`,
`App/packages/core/src/figma-api/accessors/layout.ts`, `App/packages/core/src/canvas/scene.ts`,
`App/packages/scene-graph/src/types.ts`, `App/src/components/properties/LayoutSection/AutoLayoutControls.vue`,
every file under `App/tests/engine/layout/auto-layout/`, `App/tests/engine/figma/api/auto-layout/`,
`App/tests/engine/io/fig/import/legacy/auto-layout/`, `App/tests/engine/kiwi/serialize-fixes/auto-layout/`,
`App/tests/e2e/editor/auto-layout/`, and `App/node_modules/canvaskit-wasm/types/index.d.ts` for the
`Paragraph.getAlphabeticBaseline()` signature.
Delivery: source gates only

## Intended Outcome

Close the one confirmed, real behavioural gap between OpenPotlood's auto-layout engine and Figma's: text
counter-axis **baseline alignment** (`counterAxisAlign: 'BASELINE'` / `layoutAlignSelf: 'BASELINE'`) is
accepted as a value everywhere it round-trips (kiwi import/export, the `figma-api` proxy, the scene-graph
type) but has never actually aligned anything by baseline — it silently behaves as top/`MIN` alignment.
After this packet, a horizontal, non-wrapping auto-layout frame with `counterAxisAlign: 'BASELINE'` (or a
child with `layoutAlignSelf: 'BASELINE'`) positions its direct `TEXT` children so their alphabetic
baselines line up, using real font metrics from both the live CanvasKit measurer and the headless/opentype
fallback measurer used in tests and non-GPU contexts.

Everything else enumerated in the brief's feature checklist (sizing modes, min/max, wrap, spacing modes,
alignment, per-side padding, absolute position, nested frames, canvas stacking order, GRID) is verified
below to be implemented and covered by existing tests, and is explicitly **not** touched by this packet.

## Request Coverage

- Improve auto-layout so it behaves and round-trips like the original Figma implementation.
- (User-visible outcome, carried from the stub) Auto-layout frames imported from Figma lay out the same
  way in OpenPotlood, and frames authored here survive a `.fig` round-trip without reflowing.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/packages/core/src/layout.ts` | The flex/auto-layout engine. `computeLayout` (line 37) builds a Yoga tree via `buildYogaTree` and applies results via `applyYogaLayout`. `configureFlexContainer` (line 130) maps `SceneNode` layout fields onto a `YogaNode`. |
| `App/packages/core/src/layout/apply.ts` | `applyYogaLayout` (line 80) writes Yoga's computed geometry back onto scene nodes, honouring `figmaDerivedLayout` (imported Figma bounds) in preference to recomputed values — this is the round-trip-fidelity mechanism. |
| `App/packages/core/src/layout/yoga-helpers.ts` | `mapAlign` (line 65) and `mapAlignSelf` (line 80) both map the string `'BASELINE'` to Yoga's `Align.Baseline` enum value. `applyMinMaxConstraints` (line 27) wires `minWidth`/`maxWidth`/`minHeight`/`maxHeight` straight onto the Yoga node. |
| `App/packages/core/src/layout/text-measurement.ts` | Defines `TextMeasurer = (node, maxWidth?) => { width; height } | null` (line 6) and `estimateTextSize` (line 15), the character-count fallback used when no real measurer is registered. |
| `App/packages/core/src/text/opentype.ts` | `measureTextWithOpenType` (line 76) parses the actual font via `opentype.js` and already reads `font.ascender` and `font.unitsPerEm` (used at line 90 to compute line height) but discards them after computing `width`/`height`. |
| `App/packages/core/src/canvas/text/index.ts` | `measureTextNode` (line 177) is the live, CanvasKit-backed measurer wired in at runtime (see next row). It builds a `paragraph` (line 185), reads `paragraph.getLongestLine()` and `paragraph.getHeight()`, then calls `paragraph.delete()` (line 189) — discarding the paragraph before reading baseline. |
| `App/packages/core/src/canvas/renderer/fonts.ts:114` | `setTextMeasurer((node, maxWidth) => r.measureTextNode(node, maxWidth))` — this is what makes `measureTextNode` the active `TextMeasurer` during real editor layout passes. |
| `App/node_modules/canvaskit-wasm/types/index.d.ts:1083` | `getAlphabeticBaseline(): number` exists on CanvasKit's `Paragraph` type — the exact primitive needed, sitting right next to the `getLongestLine()`/`getHeight()` calls already in `measureTextNode`. |
| `App/node_modules/.bun/@open-pencil+yoga-layout@3.3.0-grid.3/node_modules/@open-pencil/yoga-layout/dist/src/wrapAssembly.d.ts` | The forked Yoga binding this project uses. Confirmed by full-text search: it exposes `isReferenceBaseline()` / `setIsReferenceBaseline()` but **no `setBaselineFunction`/`setMeasureFunc`-adjacent baseline callback**. Passing `Align.Baseline` into this binding has no way to receive a real per-node baseline offset — it can only fall back to the node's border-box edge, i.e. behave like `MIN`. This is *why* the feature is inert today, not merely untested. |
| `App/packages/core/src/figma-api/accessors/layout.ts:57-58` | `primaryAxisAlignItems: mappedAccessor(internals, 'primaryAxisAlign')`, `counterAxisAlignItems: mappedAccessor(internals, 'counterAxisAlign')` — `'BASELINE'` is reachable and round-trips through the MCP/`figma-api` surface and `.fig` import/export today; it is not reachable from `AutoLayoutControls.vue` (grep for `BASELINE`/`Baseline` in that file returns nothing) — the only route a user or an imported file has to this value is via `.fig` import or a scripted `figma-api` call. |
| `App/packages/core/src/canvas/scene.ts:179-182` | `renderChildren` reverses paint order when `node.layoutMode !== 'NONE' && node.itemReverseZIndex` — canvas stacking order for auto-layout is implemented. |
| `App/packages/scene-graph/src/types.ts:279-281,412-465` | The full set of auto-layout fields: `LayoutCounterAlign = 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'BASELINE'`, `LayoutAlignSelf` (same set plus `AUTO`), `layoutMode`, sizing/spacing/padding/min-max/grid fields. |

### Gap table — the real feature checklist, verified against source and existing tests

| Figma auto-layout behaviour | Status | Evidence |
| --- | --- | --- |
| Sizing modes: hug / fill / fixed (primary + counter axis) | **Implemented, tested** | `setMainAxisSizing`/`setCrossAxisSizing` (`layout.ts:424-470`); `tests/engine/layout/auto-layout/sizing/modes.test.ts`, `mixed/sizing.test.ts`, `fill/flex-basis.test.ts` |
| Min/max width/height | **Implemented, tested** | `applyMinMaxConstraints` (`yoga-helpers.ts:27`); `tests/engine/layout/auto-layout/min-max/constraints.test.ts` (5 cases incl. nested) |
| Wrap | **Implemented, tested** | `setFlexWrap` (`layout.ts:139`); `tests/engine/layout/auto-layout/wrap/layout.test.ts`, `counter-axis/align-content.test.ts` |
| Spacing modes: packed vs space-between | **Implemented, tested** | `mapJustify` handles `SPACE_BETWEEN` (`yoga-helpers.ts:52-63`); `tests/engine/layout/auto-layout/alignment/primary-axis.test.ts`; kiwi's legacy `SPACE_EVENLY` import maps onto it (`tests/engine/io/fig/import/legacy/auto-layout/basic.test.ts`) |
| Alignment: primary + counter axis (MIN/CENTER/MAX/STRETCH), align-self overrides | **Implemented, tested** | `mapAlign`/`mapAlignSelf` (`yoga-helpers.ts`); `tests/engine/layout/auto-layout/alignment/*.test.ts`, `layout-align-self/extended-values.test.ts`, `self/alignment.test.ts` |
| Per-side padding (+ stroke-included padding) | **Implemented, tested** | `configureFlexContainer` padding block (`layout.ts:148-153`); `edge-cases.test.ts`, kiwi transform tests |
| Absolute-position children | **Implemented, tested** | `configureAbsoluteChild` (`yoga-helpers.ts:19`); `tests/engine/layout/auto-layout/absolute/*.test.ts` (2 files) |
| Canvas stacking order (`itemReverseZIndex`) | **Implemented, NOT covered by any layout/render test** | `scene.ts:179-182`; only property round-trip is tested (`tests/engine/figma/api/auto-layout/extras.test.ts`), never that paint order actually reverses |
| Nested auto-layout frames (incl. mixed grid/flex) | **Implemented, tested** | `configureChildAsAutoLayout`/`configureChildAsGrid` (`layout.ts:166-278`); `tests/engine/layout/auto-layout/nested/*.test.ts` |
| `.fig` round-trip fidelity (`figmaDerivedLayout`) | **Implemented, tested** | `applyFrameSize`/`updateChildFromYoga` prefer `figmaDerivedLayout` over recomputation (`apply.ts:21,37`); `tests/engine/layout/auto-layout/imported-derived-layout.test.ts` |
| Text auto-resize (width/height/width-and-height) | **Implemented, heavily tested** | `configureTextLeaf` (`layout.ts:334-396`); `tests/engine/layout/auto-layout/text/measurement.test.ts` (531 lines) |
| GRID layout mode | **Implemented, tested (separate feature, not in scope)** | `packages/core/src/layout/grid.ts`, `configureChildAsGrid` |
| **Text baseline alignment** (`counterAxisAlign`/`layoutAlignSelf` = `'BASELINE'`) | **Absent behind an accepted enum value** | `mapAlign`/`mapAlignSelf` pass `Align.Baseline` into a Yoga binding with no baseline-function hook (see wrapAssembly.d.ts row above); zero test anywhere asserts a baseline-shifted position; `AutoLayoutControls.vue` has no UI for it, so the only way to hit this path today is `.fig` import or a scripted `figma-api` call — exactly the round-trip-fidelity scenario this packet's outcome statement is about |

## Corrections to the Brief

None of the stub's "Likely Areas" were wrong — `App/packages/core` and
`App/src/components/properties/LayoutSection/` are the right places, and all five test directories the
stub named exist and contain real, substantive coverage (2,267 lines across the `tests/engine/layout/
auto-layout/` directory alone). The stub's premise that this area is under-tested does not hold up: the
engine is unusually well covered. The one genuine gap is narrow and specific, not the broad "reflow
differently" risk the stub worried about.

## Fixed Decisions

1. **The bounded first slice is text baseline alignment, scoped to: `layoutMode: 'HORIZONTAL'` frames,
   `layoutWrap !== 'WRAP'` (single row), direct `TEXT` children only.** Reason: it is the one checklist
   item that is verifiably absent rather than merely under-tested, its two required font-metric primitives
   (`Paragraph.getAlphabeticBaseline()` for the live path, `font.ascender`/`unitsPerEm` already read in
   `opentype.ts` for the headless path) already exist right next to code that already runs, and it is the
   scenario most directly tied to `.fig` round-trip fidelity — the packet's stated outcome. Multi-row
   (`WRAP`) baseline alignment and vertical-frame baseline alignment are ambiguous (Figma does not offer a
   documented rule for either that this codebase can verify against) and are deferred — see Restrictions.

2. **`TextMeasurer` gains an optional `baseline` field instead of a new parallel function.**
   `App/packages/core/src/layout/text-measurement.ts:6-9` changes to
   `TextMeasurer = (node, maxWidth?) => { width: number; height: number; baseline?: number } | null`.
   `baseline` is the distance in local px from the text node's top edge to its alphabetic baseline.
   Reason: one call site per measurer to update (`measureTextNode` and `measureTextWithOpenType`), no new
   plumbing, and `getTextMeasurer()`/`setTextMeasurer()` stay as they are. `estimateTextSize`'s crude
   character-count fallback (no font data available) leaves `baseline` `undefined` — nodes with no
   resolvable baseline simply do not participate in the alignment shift and keep today's `MIN`-equivalent
   position. This is a safe, explicit degrade, not a silent one.

3. **The shift is a manual post-Yoga pass, not a Yoga `alignItems` value.** Because the Yoga binding has no
   baseline-function hook (verified above), `mapAlign`/`mapAlignSelf` stop passing `Align.Baseline` through
   to Yoga — `'BASELINE'` maps to `Align.FlexStart` there (`yoga-helpers.ts:65-95`), matching Yoga's actual
   fallback behaviour today so nothing about the Yoga-computed geometry changes. A new function,
   `applyBaselineAlignment(graph, frame)` in `layout.ts`, runs after `applyYogaLayout(...)` and before
   `freeYogaTree(yogaRoot)` inside `computeLayout` (`layout.ts:51-52`), gated on
   `frame.layoutMode === 'HORIZONTAL' && frame.layoutWrap !== 'WRAP'`. It:
   - Collects direct children whose **effective** counter-axis align is `BASELINE`
     (`child.layoutAlignSelf !== 'AUTO' ? child.layoutAlignSelf === 'BASELINE' : frame.counterAxisAlign === 'BASELINE'`).
   - For each such child with `type === 'TEXT'`, calls
     `getTextMeasurer()?.(child, child.width) ?? estimateTextSize(child, child.width)` to get `.baseline`.
     Children with no resolvable `baseline`, or non-`TEXT` children, are left untouched at their
     Yoga-computed `y`.
   - Computes `childTopBaseline = child.y + baseline` for every participating child, takes
     `maxBaseline = Math.max(...)`, and sets each participating child's `y += maxBaseline - childTopBaseline`
     via `graph.updateNode(child.id, { y: ... })`.
   - No-ops (returns immediately) if fewer than one participating child is found — nothing to align.

4. **Both measurers are updated, not just the test-facing one.** `measureTextNode`
   (`App/packages/core/src/canvas/text/index.ts:177-191`) adds
   `baseline: Math.ceil(paragraph.getAlphabeticBaseline())` to its returned object, read **before**
   `paragraph.delete()` at line 189. `measureTextWithOpenType`
   (`App/packages/core/src/text/opentype.ts:76-101`) adds `baseline: Math.round(font.ascender * scale)`
   using the `scale` already computed at line 88. This means the feature works identically in the live
   CanvasKit-backed editor and in headless/test/`.fig`-import contexts, which is required for the
   round-trip-fidelity claim in the Intended Outcome to actually hold.

## Open Decisions

- **Whether Figma allows `BASELINE` on `WRAP`-ping frames or vertical frames at all.** This cannot be
  settled by reading this repository — it needs an external Figma reference file this session does not
  have. Recommendation: keep the restriction in Fixed Decision 1 (horizontal, non-wrap only) and treat any
  imported frame with `counterAxisAlign: 'BASELINE'` outside that shape as falling back to today's
  `MIN`-equivalent behaviour (already true, since `applyBaselineAlignment` simply does not run). If the
  user later supplies a `.fig` fixture exercising the wrapped or vertical case, cut a follow-up packet from
  the "Deferred to a later packet" list below rather than guessing now.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT touch `packages/core/src/layout/grid.ts` or any `configureChildAsGrid` path.** GRID is a
  separate, already-implemented and already-tested layout mode; it is out of scope.
- **Do NOT change the Yoga `Align` mapping for anything other than `'BASELINE'`.** `MIN`/`CENTER`/`MAX`/
  `STRETCH` keep their existing `mapAlign`/`mapAlignSelf` results exactly.
- **Do NOT implement baseline alignment for `layoutWrap: 'WRAP'` frames or `VERTICAL` frames.** See Open
  Decisions. `applyBaselineAlignment` must gate on `layoutMode === 'HORIZONTAL' && layoutWrap !== 'WRAP'`
  and do nothing otherwise.
- **Do NOT add a "Baseline" option to `AutoLayoutControls.vue` or any other properties-panel UI in this
  packet.** This slice makes the existing accepted value behave correctly for `.fig` import and
  `figma-api`/MCP-authored documents; exposing it as an authoring control in the UI is a product decision
  for a separate packet.
- **Do NOT change `applyMinMaxConstraints`, wrap, spacing, sizing-mode, padding or absolute-positioning
  code.** All are verified implemented and tested; this packet touches only the baseline path.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.** Use
  the focused gates listed under Verification.

### Deferred to a later packet

Recorded with enough detail that a follow-up packet can be cut without redoing this analysis:

- **Baseline alignment for `WRAP` frames.** Needs a decision on the per-row vs. whole-frame baseline rule,
  and ideally a real Figma `.fig` fixture exercising it, before it can be specified.
- **Baseline alignment for `VERTICAL` frames.** Figma's own UI does not obviously offer this; needs
  external confirmation before scoping.
- **A properties-panel UI control for `counterAxisAlign: 'BASELINE'`** in `AutoLayoutControls.vue`, once
  the engine behaviour above is confirmed correct.
- **Regression test coverage for `itemReverseZIndex` canvas stacking order.** Implemented and correct by
  inspection (`scene.ts:179-182`) but has zero test coverage beyond the property round-tripping through
  `figma-api`. Low risk, cheap to add (a render-order or z-order assertion in
  `tests/engine/render/canvas/`), but out of scope here to keep this packet to one slice.
- **Baseline participation for non-`TEXT` children** (e.g. an instance whose Figma source had a text layer
  contributing the baseline) — Figma computes a component instance's baseline from its content; this
  codebase's `SceneNode` has no derived-baseline field for non-`TEXT` types today. Left at `MIN` behaviour.

## Allowed Changes

- `App/packages/core/src/layout.ts` — new `applyBaselineAlignment`, call site inside `computeLayout`.
- `App/packages/core/src/layout/yoga-helpers.ts` — `mapAlign`/`mapAlignSelf` `'BASELINE'` cases.
- `App/packages/core/src/layout/text-measurement.ts` — `TextMeasurer` type, `estimateTextSize` baseline
  propagation.
- `App/packages/core/src/text/opentype.ts` — `measureTextWithOpenType` baseline field.
- `App/packages/core/src/canvas/text/index.ts` — `measureTextNode` baseline field.
- New focused tests under `App/tests/engine/layout/auto-layout/` (a new `baseline/` subdirectory matching
  the existing per-feature directory convention) and, if the CanvasKit-path change needs its own coverage,
  `App/tests/engine/render/canvas/`.

## Implementation Steps

1. **Extend the measurer contract** (`packages/core/src/layout/text-measurement.ts`): widen `TextMeasurer`
   to return an optional `baseline`. In `estimateTextSize`, when `measureTextWithOpenType` returns a
   result, pass its `baseline` through; the character-count fallback path (lines 28-36) leaves `baseline`
   unset.
2. **Real font metrics for the headless/test path** (`packages/core/src/text/opentype.ts:76-101`): add
   `baseline: Math.round(font.ascender * scale)` to both return statements in
   `measureTextWithOpenType` (the `maxWidth` early-return at ~line 96 and the final return at ~line 100).
3. **Real font metrics for the live CanvasKit path** (`packages/core/src/canvas/text/index.ts:177-191`):
   read `paragraph.getAlphabeticBaseline()` before `paragraph.delete()` and include it as `baseline` in the
   returned object.
4. **Stop feeding Yoga a baseline it cannot honour** (`packages/core/src/layout/yoga-helpers.ts:65-95`):
   confirm (do not silently change) that `mapAlign`/`mapAlignSelf` continue to return `Align.FlexStart` for
   `'BASELINE'` — if a prior pass of this packet changed them to `Align.Baseline`, revert that; the manual
   pass in step 5 is the only mechanism that must apply the shift.
5. **The manual pass** (`packages/core/src/layout.ts`): implement `applyBaselineAlignment(graph, frame)`
   exactly per Fixed Decision 3, and call it from `computeLayout` (line 51-52) immediately after
   `applyYogaLayout(...)`, before `freeYogaTree(yogaRoot)`, gated on
   `frame.layoutMode === 'HORIZONTAL' && frame.layoutWrap !== 'WRAP'`.
6. **Focused tests** (`tests/engine/layout/auto-layout/baseline/basic.test.ts`, following the existing
   `autoFrame`/`rect`/`pageId` helper pattern from `#tests/helpers/layout` and the `setTextMeasurer`
   pattern from `tests/engine/layout/auto-layout/text/measurement.test.ts`):
   - Two `TEXT` children with different `height` (simulating different font sizes) and
     `layoutAlignSelf: 'AUTO'` under a frame with `counterAxisAlign: 'BASELINE'`; install a
     `setTextMeasurer` stub returning distinct `{ width, height, baseline }` per child; assert their `y`
     values differ by exactly the baseline delta and the taller-baseline child ends up with the larger `y`.
   - One `TEXT` child with no `baseline` in its measurer result (simulate `estimateTextSize`'s crude
     fallback) alongside one with a real baseline; assert the baseline-less child is left at its
     Yoga-computed `y` (today's `MIN` behaviour) and does not throw.
   - A `layoutWrap: 'WRAP'` frame with `counterAxisAlign: 'BASELINE'`; assert positions are **unchanged**
     from the pre-patch (`MIN`-equivalent) behaviour — proves the gate in Fixed Decision 1/3 holds.
   - A `layoutMode: 'VERTICAL'` frame with `counterAxisAlign: 'BASELINE'`; same unchanged-behaviour
     assertion.
   - Non-`TEXT` child (a `RECTANGLE`) with `layoutAlignSelf: 'BASELINE'` in an otherwise baseline-aligned
     row; assert it is left at `y: 0` (does not participate) and does not throw.
   - Round-trip: build a graph with `counterAxisAlign: 'BASELINE'`, call `computeLayout`, then re-run with
     the same measurer and assert idempotence (positions do not drift on a second call), matching the
     "survive a `.fig` round-trip without reflowing" outcome.
   - If practical without violating "no runs," add one `measureTextNode`-level test in
     `tests/engine/render/canvas/` asserting the returned object includes `baseline` for a real paragraph —
     otherwise leave this as a manual reviewer check, since it needs CanvasKit initialised
     (`initCanvasKit()` from `#cli/headless`, matching existing renderer test setup).

## Acceptance Criteria

- [ ] `TextMeasurer`'s type includes optional `baseline`; both `measureTextNode` and
      `measureTextWithOpenType` populate it; `estimateTextSize`'s no-font-data fallback leaves it
      unset and this is exercised by a test.
- [ ] A horizontal, non-wrapping auto-layout frame with `counterAxisAlign: 'BASELINE'` positions its
      `TEXT` children so `child.y + measuredBaseline` is equal across all participating children.
- [ ] `layoutAlignSelf: 'BASELINE'` on an individual child overrides the frame's `counterAxisAlign` for
      that child only, matching the existing override pattern used by `MIN`/`CENTER`/`MAX`/`STRETCH`.
- [ ] `layoutWrap: 'WRAP'` frames and `VERTICAL` frames are provably unaffected — a regression test
      confirms identical output to the pre-patch behaviour for both shapes.
- [ ] Non-`TEXT` children and children with no resolvable baseline never throw and are left at their
      Yoga-computed position.
- [ ] No existing test in `tests/engine/layout/auto-layout/`, `tests/engine/figma/api/auto-layout/`,
      `tests/engine/io/fig/import/legacy/auto-layout/`, `tests/engine/kiwi/serialize-fixes/auto-layout/`
      or `tests/e2e/editor/auto-layout/` changes behaviour or fails.
- [ ] Focused gates green: `bunx tsgo --noEmit`, focused `oxlint` over the touched paths, and
      `bun test` over `tests/engine/layout/auto-layout/` (including the new `baseline/` subdirectory).

## Verification

- `bunx tsgo --noEmit --pretty false` (from `App/`)
- Focused `oxlint` over `packages/core/src/layout.ts`, `packages/core/src/layout/text-measurement.ts`,
  `packages/core/src/layout/yoga-helpers.ts`, `packages/core/src/text/opentype.ts`,
  `packages/core/src/canvas/text/index.ts`
- `bun test tests/engine/layout/auto-layout/` (all existing subdirectories plus the new `baseline/` one)
- `bun test tests/engine/figma/api/auto-layout/ tests/engine/io/fig/import/legacy/auto-layout/ tests/engine/kiwi/serialize-fixes/auto-layout/` — regression check that nothing round-trip-related moved
- Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Stop Conditions

- Stop if `Paragraph.getAlphabeticBaseline()` throws or returns `NaN` for any node already covered by
  `tests/engine/layout/auto-layout/text/measurement.test.ts`'s fixtures — the CanvasKit-path assumption in
  Fixed Decision 4 would be wrong and needs re-verification against a live paragraph, not a type declaration.
- Stop and report if `applyBaselineAlignment` needs to run before `figmaDerivedLayout` overrides are
  applied (i.e. if baseline-aligned imported frames need their imported bounds preserved exactly and the
  two mechanisms conflict) — this packet assumes they compose cleanly because `figmaDerivedLayout` only
  overrides `x`/`y`/`width`/`height` of the node itself, not a sibling-relative shift, but this has not
  been proven against a real imported baseline-aligned `.fig` fixture (none was available to this
  expansion — see the Open Decision on external fixtures).
- Stop if fewer than 2,267 lines of existing `tests/engine/layout/auto-layout/` coverage still pass
  unchanged — that suite is the evidence base this packet's "everything else is implemented" claim rests
  on, and a regression there invalidates the scope cut.

## Status record

Status: **Done**

Executed 2026-08-20:
- Extended `TextMeasurer` and `estimateTextSize` in `packages/core/src/layout/text-measurement.ts` with optional `baseline`.
- Populated `baseline` from font ascent in `packages/core/src/text/opentype.ts` and from CanvasKit's `paragraph.getAlphabeticBaseline()` in `packages/core/src/canvas/text/index.ts`.
- Mapped `BASELINE` to `Align.FlexStart` in `packages/core/src/layout/yoga-helpers.ts`.
- Added manual post-Yoga `applyBaselineAlignment` pass in `packages/core/src/layout.ts` for horizontal non-wrapping frames with baseline alignment.
- Added comprehensive unit tests in `tests/engine/layout/auto-layout/baseline/basic.test.ts`.
- Verified gates: `bunx tsgo --noEmit --pretty false` (0 errors), focused `oxlint` (0 errors), `bun test tests/engine/layout/auto-layout/` (94/94 pass), and `bun test tests/engine/figma/api/auto-layout/ tests/engine/io/fig/import/legacy/auto-layout/ tests/engine/kiwi/serialize-fixes/auto-layout/` (19/19 pass).
