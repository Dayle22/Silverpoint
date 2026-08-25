# T-039 - Frame gutter and padding overlay with adjust cursors

Task ID: T-039
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-046 (auto-layout model — confirmed the overlay applies to auto-layout frames only)
Related: T-062 (selection outline fidelity — no interaction, drawn by a different overlay function),
T-040 (corner-radius cursor — shares the `updateHoverCursor` seam and precedence ordering), T-041
(gradient/progressive-blur handle cursors — same seam)
Prepared from: the 2026-08-14 user request batch and two user-supplied reference screenshots showing a
hovered auto-layout frame with tinted padding, a labelled gutter (`367`), and a size badge under the frame
Expanded at: 2026-08-15
Expanded against: `App/packages/core/src/canvas/overlays/auto-layout-hover.ts`,
`App/packages/vue/src/shared/input/auto-layout-hover.ts`, `App/packages/vue/src/canvas/useCanvasInput.ts`
(read in full), `App/src/components/EditorCanvas.vue` (padding-editor mount block and surrounding script),
`App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue`, `App/src/components/inputs/
NumberField.vue`, `App/packages/vue/src/controls/layout/helpers.ts` (`createPaddingActions`),
`App/src/components/properties/LayoutSection/{PaddingControls,FlexControls}.vue`,
`App/packages/vue/src/shared/input/select/hover.ts`, `App/packages/core/src/editor/types.ts`,
`App/packages/core/src/constants.ts`, and `App/tests/e2e/editor/auto-layout/padding-editor.spec.ts`.
Delivery: source gates only

## Intended Outcome

Hovering a selected auto-layout frame's gutter (the gap between items) shows the same kind of live,
labelled, draggable editor that padding already has — today gutter has a hover *visualisation* but no way
to change its value from the canvas at all. Holding a modifier while starting a padding edit adjusts the
opposite paired side symmetrically, matching the pairing the Properties panel already uses. Hovering (not
yet dragging) a padding or gutter region shows a directional resize cursor so the affordance is visible
before the user commits to a double-click.

## Request Coverage

- Display gutter (item spacing) and padding when the pointer hovers over a frame, in the Figma manner.
- Let the user drag those overlays to adjust the values.
- Change the mouse cursor while a gutter or padding value is being adjusted.

## Verified Starting State

| Path | What it is |
| --- | --- |
| `App/packages/core/src/canvas/overlays/auto-layout-hover.ts` | The overlay painter. `drawAutoLayoutHover` (line 276) is the entry point; it gates on `node.layoutMode === 'HORIZONTAL' \|\| 'VERTICAL'` (line 284) — **GRID and non-auto-layout frames never get this overlay**. `drawPaddingHover`/`drawSpacingHover` (lines 210-253) draw the striped tinted region via `drawStripedRect` and, when `showValue` is true, a numeric pill via `drawValuePill` (line 106) — this pill **is** the "367" badge from the reference screenshots; there is no separate size-badge component to go find, `drawValuePill` already serves this role for both padding and spacing. |
| `App/packages/vue/src/shared/input/auto-layout-hover.ts` | `resolveAutoLayoutHover` (line 137) computes which region the pointer is over: `resolveSpacingHover` (line 81) and `resolvePaddingHover` (line 24) each distinguish a coarse hover kind (`'spacing'`/`'padding'`) from a precise "sitting on the tick/pill" kind (`'spacing-value'`/`'padding-value'`) using `AUTO_LAYOUT_HOVER_TICK_HIT_TOLERANCE = 8` (`constants.ts:107`). Both only ever look at `node.itemSpacing` and `node.paddingTop/Right/Bottom/Left` — `counterAxisSpacing` (the cross-axis gap used only when `layoutWrap: 'WRAP'`) is never resolved by either function. |
| `App/packages/vue/src/canvas/useCanvasInput.ts` | **Padding editing is already fully implemented.** `startAutoLayoutPaddingEdit` (line 170), `updateAutoLayoutPaddingEdit` (line 189), `commitAutoLayoutPaddingEdit` (line 197, uses `editor.updateNode` for the live scrub then `editor.updateNodeWithUndo` once on commit — one undo entry per edit), `cancelAutoLayoutPaddingEdit` (line 209). Wired from `onDblClick` (line 297: `if (startAutoLayoutPaddingEdit(e)) return`) and committed on the next `onMouseDown` (line 303-306) if still open. **There is no equivalent for `'spacing'`/`'spacing-value'`** — `startAutoLayoutPaddingEdit`'s guard at line 173 (`if (hover?.kind !== 'padding' && hover?.kind !== 'padding-value') return false`) means double-clicking a gutter region falls through to `onTextDblClick` and does nothing auto-layout-related. |
| `App/src/components/EditorCanvas.vue:95-119,252-287` | The padding editor's UI: a `paddingSideIcons` map, a `paddingEditorAnchor` computed (screen position from `graph.getAbsolutePosition` + the relevant padding side), a `useCanvasVirtualReference` binding it to a `PopoverContent`, and inside that popover a single `NumberField` (`src/components/inputs/NumberField.vue`) bound to `autoLayoutPaddingEdit.value` with `@update:model-value` / `@commit` / `@editing-change` wired to the composable's three functions. This exact shape is the reusable template for a spacing editor. |
| `App/packages/vue/src/primitives/NumberField/NumberFieldRoot.vue:194-222` | `startScrub` — pointer-driven live value scrubbing already sets `document.body.style.cursor = 'ew-resize'` (line 217) once the drag exceeds a 2px threshold, and clears it (`= ''`, line 191) on release. **Cursor feedback during the value-edit drag itself already exists and needs no new code** — it is generic to every `NumberField` in the app, including the padding editor already mounted in `EditorCanvas.vue`. |
| `App/packages/vue/src/controls/layout/helpers.ts:115-165` | `createPaddingActions`, backing the Properties panel's `PaddingControls.vue`. `hasSymmetricPadding` (line 128: `paddingLeft === paddingRight && paddingTop === paddingBottom`) gates a horizontal/vertical-pair editing mode; `setHorizontalPadding`/`commitHorizontalPadding` update `{ paddingLeft, paddingRight }` together, `setVerticalPadding`/`commitVerticalPadding` update `{ paddingTop, paddingBottom }` together. This is the exact pairing to mirror for a modifier-key canvas gesture — it already exists as sanctioned, shipped behaviour, just not reachable from the canvas. |
| `App/packages/vue/src/shared/input/select/hover.ts` | `updateHoverCursor` (line 60) is the single seam `cursorOverride` comes from (per the task's confirmed anchors). It tries `getResizeCursorForSelection` then `getRotationCursorForSelection` and returns `null` if neither hits — **there is no branch here for auto-layout padding/gutter regions at all**, so hovering one today shows the plain default cursor until the double-click lands. |
| `App/packages/vue/src/canvas/useCanvasInput.ts:68-78` | `handleSelectHover` calls `updateHoverCursor` for `cursorOverride.value` and, on the same call, separately, `editor.setAutoLayoutHover(resolveAutoLayoutHover(...))` for the overlay draw. The two are computed independently today even though they read overlapping hit-test information. |
| `App/packages/vue/src/canvas/useCanvasInput.ts:381-` (drag skip) | Per the task's confirmed anchor, hover recomputation is already skipped while `drag.value` is set (the `if (!drag.value) { ...hover work... }` guard at line 370), so a cursor set at the start of a value-edit persists automatically — no new code needed for that part either. |
| `App/tests/e2e/editor/auto-layout/padding-editor.spec.ts` | Confirms the padding editor's behaviour today: opens on double-click of a padding handle, drag-scrubs the `NumberField`, closes and commits on release, undoes in one step, and closes when clicking elsewhere on the canvas. This is the contract the new spacing editor must match. |

## Corrections to the Brief

The stub materially undersold what already exists. **The padding half of this feature — hover
visualisation with a striped tinted region and a numeric pill, plus drag-to-adjust via a double-click that
opens a scrubbable `NumberField`, plus cursor feedback during that drag, plus one undo step per edit — is
already implemented and covered by a passing Playwright spec** (`padding-editor.spec.ts`). The reference
screenshots' look (tinted stripes, `367`-style numeric badge) is already produced by
`drawPaddingHover`/`drawSpacingHover`/`drawValuePill` in `auto-layout-hover.ts`, gated correctly to
auto-layout frames only. The stub's "Likely Areas" pointed at `LayoutSection/` for "the padding/gutter
model" and "canvas overlay drawing and hover hit-testing" in generic terms — both exist, but the actual
gaps are narrower and different from what a first read suggests:

1. **Gutter (`itemSpacing`) has hover visuals but no edit path at all.** This is the one missing half of
   "let the user drag those overlays to adjust the values."
2. **No modifier-key symmetric-pair editing on canvas**, even though the exact pairing already exists and
   ships in the Properties panel (`createPaddingActions`).
3. **No pre-drag hover cursor** for padding/gutter regions — only the in-progress scrub cursor exists.

## Fixed Decisions

1. **Applies to auto-layout frames only, never every frame.** `drawAutoLayoutHover` and
   `resolveAutoLayoutHover` both already gate on `layoutMode === 'HORIZONTAL' || 'VERTICAL'`
   (`auto-layout-hover.ts` core line 284, vue line 145) — this was already true before this packet and is
   preserved unchanged. GRID-mode frames get no overlay at all today; extending to GRID is out of scope
   (see Restrictions).
2. **The bounded first slice is: (a) a gutter/`itemSpacing` editor mirroring the existing padding editor
   exactly, (b) an Alt-modifier symmetric-pair gesture for padding reusing `createPaddingActions`'
   left/right + top/bottom pairing, (c) a pre-drag hover cursor for both padding and gutter regions.**
   Reason: these are the three concrete deltas between what exists and what the request asks for; nothing
   else needs building.
3. **The gutter editor is a straight structural mirror of the padding editor — one `itemSpacing` value, no
   per-side branching.** New composable state `autoLayoutSpacingEdit: { nodeId, value, previous } | null`
   in `useCanvasInput.ts` (no `side` field — `itemSpacing` is a single frame-level number), new functions
   `startAutoLayoutSpacingEdit`/`updateAutoLayoutSpacingEdit`/`commitAutoLayoutSpacingEdit`/
   `cancelAutoLayoutSpacingEdit` following `startAutoLayoutPaddingEdit`'s exact shape (lines 170-213) but
   keyed on `hover?.kind === 'spacing' || hover?.kind === 'spacing-value'` and reading/writing
   `node.itemSpacing`. `onDblClick` becomes
   `if (startAutoLayoutPaddingEdit(e)) return; if (startAutoLayoutSpacingEdit(e)) return; onTextDblClick(e)`.
   `onMouseDown`'s existing commit-on-next-click block (lines 302-306) gets a matching branch for
   `autoLayoutSpacingEdit`.
4. **The gutter editor popover is a copy-paste of the padding popover's markup**, not a new component: a
   second `PopoverRoot`/`PopoverContent` block in `EditorCanvas.vue` bound to `!!autoLayoutSpacingEdit`,
   anchored at the midpoint of the first gap rect (mirroring `gapRects` in `auto-layout-hover.ts:127-157` —
   for a `HORIZONTAL` frame that's `{ x: firstGapCenterX, y: contentCrossCenterY }`, for `VERTICAL` the
   axes swap), reusing the same `NumberField` with `:min="0"`. Icon: `icon-lucide-align-horizontal-space-
   between` when `node.layoutMode === 'VERTICAL'`, `icon-lucide-align-vertical-space-between` otherwise —
   this is the exact inverted pairing already used in `FlexControls.vue:73-77` (the gap runs across the
   *other* axis from the layout direction), and both icons are already imported project-wide.
5. **Symmetric-pair padding editing is Alt-gated, per axis, reusing the Properties panel's exact update
   shape.** When `startAutoLayoutPaddingEdit` is invoked with `e.altKey === true`, both
   `updateAutoLayoutPaddingEdit` and `commitAutoLayoutPaddingEdit` write the paired sides together —
   `side === 'top' || side === 'bottom'` pairs with the opposite of that pair (`{ paddingTop, paddingBottom
   }`), `side === 'left' || side === 'right'` pairs `{ paddingLeft, paddingRight }` — matching
   `createPaddingActions`' `setHorizontalPadding`/`setVerticalPadding` (`helpers.ts:134-160`) field shape
   exactly, including the same commit-message convention (`'Change vertical padding'` /
   `'Change horizontal padding'` vs. the existing single-side commit's `'Update padding'`). The `autoLayout
   PaddingEdit` ref gains a `paired: boolean` field set at drag start from `e.altKey` and read by `update`/
   `commit`; it does not change once a drag is in progress (checking `e.altKey` again on every
   `pointermove` would let the user flip pairing mid-drag, which is surprising and not how Figma's own
   Properties-panel toggle behaves — it's a mode chosen once, not a live modifier).
6. **No all-sides (Shift+Alt) gesture in this slice.** See Restrictions/Deferred — there is no existing
   "uniform padding" update helper to mirror the way `createPaddingActions` already provides the pair one,
   and `hasUniformPadding` in that same file is read-only (a display gate, not an action) — building the
   write side would mean inventing a helper with no existing precedent, which the "reuse, don't invent"
   instruction weighs against for a first slice.
7. **Hover cursor: plain CSS `'ns-resize'` / `'ew-resize'` strings, not the SVG `buildResizeCursor` used
   for rotation-aware resize handles.** Reason: padding/gutter edits are always axis-aligned to the frame's
   own top/bottom or left/right, never rotation-dependent, and `NumberFieldRoot.startScrub` already
   hard-codes plain `'ew-resize'` for the in-progress drag (`NumberFieldRoot.vue:217`) — matching that
   convention keeps one cursor vocabulary for this whole feature rather than two. Mapping: `top`/`bottom`
   padding sides and a `VERTICAL` frame's gutter → `'ns-resize'`; `left`/`right` padding sides and a
   `HORIZONTAL` frame's gutter → `'ew-resize'`.
8. **The new hover cursor is computed inside `handleSelectHover`, after the existing two cursor sources,
   preserving precedence.** `updateHoverCursor`'s own return (resize handle, then rotation corner) still
   wins if either hits — matching T-040/T-041's documented precedent that resize/rotation affordances are
   claimed first. Only when `updateHoverCursor` returns `null` does a new `getAutoLayoutHoverCursor(hover,
   node)` — reading the already-computed `resolveAutoLayoutHover` result at the same call site rather than
   hit-testing a second time — contribute a cursor. This function does **not** live inside `hover.ts`
   itself (that module has no auto-layout import today and this packet does not want to introduce a
   `packages/core` scene-graph read into a module that currently only reads geometry/handles); it is added
   directly in `useCanvasInput.ts` next to `handleSelectHover`, which already imports
   `resolveAutoLayoutHover`.

## Open Decisions

None — every Expansion Question from the stub is closed above by a Fixed Decision with its source
evidence (auto-layout-only scope: Decision 1; symmetric vs. per-side plus modifier key: Decisions 5-6).

## Visual Contract — binding

No new visual style is introduced. Every pixel this packet adds must come from an existing pattern already
in the diff's neighbourhood:

| Element | Required source |
| --- | --- |
| Gutter popover container | Exact copy of the padding popover's `PopoverContent` classes: `z-50 w-20 rounded-md bg-panel p-1 shadow-lg` (`EditorCanvas.vue:262`), same `side="top" align="center" :side-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_Y" :align-offset="AUTO_LAYOUT_PADDING_EDITOR_OFFSET_X" :collision-padding="8"` props (reuse the same two constants from `packages/core/src/constants.ts:109-110` — do not add new offset constants). |
| Gutter numeric input | The same `NumberField` component (`src/components/inputs/NumberField.vue`) with `:min="0" :step="1"`, `data-test-id="auto-layout-spacing-input"`. |
| Gutter popover icon | `icon-lucide-align-horizontal-space-between` / `icon-lucide-align-vertical-space-between` per Fixed Decision 4 — both already imported globally via `unplugin-icons`, same convention as `FlexControls.vue:73-77`. |
| Stripe/pill overlay drawing | `drawStripedRect`/`drawValuePill`/`AUTO_LAYOUT_HOVER_*` color and size constants in `packages/core/src/canvas/overlays/auto-layout-hover.ts` and `packages/core/src/constants.ts` — unchanged, reused as-is for any new call sites this packet needs. |
| Hover cursor strings | Plain CSS `'ns-resize'` / `'ew-resize'` literals — no SVG data URI, no new cursor asset. |

### Banned List

- No literal colour of any kind anywhere touched by this packet — the overlay already only uses the
  `AUTO_LAYOUT_HOVER_*` `Color` constants from `packages/core/src/constants.ts`; do not introduce a second
  colour source.
- No new `tv()` recipe, no new Tailwind class outside what `EditorCanvas.vue`'s existing padding-popover
  block already uses verbatim.
- No new font-size class; the popover carries no text besides the `NumberField`'s own display, which is
  untouched.
- No new radius class; reuse `rounded-md` exactly as the padding popover does.
- No new npm dependency.
- No new SVG cursor asset (`buildResizeCursor`/`resizeCursorSvg` stay untouched — they belong to
  rotation-aware resize handles, not this feature).
- No `@apply`, no new global CSS, no edits to `App/src/app.css`.
- No new Vue component file for the gutter popover — it is markup inside `EditorCanvas.vue`, matching
  where the padding popover already lives, unless duplicating that markup a second time makes the
  `<template>` block unreasonably long, in which case extract **both** the padding and gutter popovers
  together into one new component in the same step (never leave one inline and one extracted).

## Allowed Changes

- `App/packages/vue/src/canvas/useCanvasInput.ts` — new spacing-edit state/functions, Alt-pairing on the
  existing padding-edit functions, new `getAutoLayoutHoverCursor` and its call from `handleSelectHover`.
- `App/src/components/EditorCanvas.vue` — new gutter-editor popover markup and its anchor/reference
  computeds, mirroring the existing padding ones.
- `App/packages/core/src/canvas/overlays/auto-layout-hover.ts` — only if the gutter popover's anchor
  point needs a small helper extracted from `gapRects` (e.g. exporting a `firstGapCenter` helper) to avoid
  duplicating that geometry in the Vue layer; do not change any drawing behaviour.
- Focused Playwright coverage in `App/tests/e2e/editor/auto-layout/` (a new `spacing-editor.spec.ts`
  alongside the existing `padding-editor.spec.ts`, plus additions to `padding-editor.spec.ts` for the
  Alt-pair case and cursor assertions).

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- **Do NOT extend this overlay to GRID-mode frames.** `drawAutoLayoutHover`/`resolveAutoLayoutHover`'s
  existing `HORIZONTAL`/`VERTICAL` gate must remain exactly as it is.
- **Do NOT add a counter-axis-spacing (`counterAxisSpacing`, the `WRAP`-mode cross-gap) editor.**
  `resolveSpacingHover`/`gapRects` only ever compute primary-axis (`itemSpacing`) gaps; wiring the
  cross-axis gap would need new hit-testing and drawing geometry this packet does not scope. Deferred, see
  below.
- **Do NOT build a Shift+Alt "all sides" gesture.** See Fixed Decision 6.
- **Do NOT touch `resizeCursorSvg`/`buildResizeCursor` or any T-040/T-041 radius/gradient cursor code.**
  This packet's cursor branch must return `null` and defer to whatever those packets add once they exist;
  do not special-case around them.
- **Do NOT change `commitAutoLayoutPaddingEdit`'s existing single-side commit message (`'Update padding'`)
  for the non-paired case.** Only the new paired branch gets the `'Change {horizontal,vertical} padding'`
  messages.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.**

### Deferred to a later packet

- **Cross-axis (`counterAxisSpacing`) gutter editing** for `WRAP`-mode frames — needs new hover hit-test
  geometry (`resolveSpacingHover` only handles the primary axis today) and a second row/column visual
  language not yet designed.
- **All-sides (Shift+Alt) uniform padding editing** — needs a new write-side helper with no existing
  precedent to mirror (unlike the pair case, which mirrors `createPaddingActions` exactly).
- **GRID-mode padding/gap overlay** — GRID frames have their own `gridColumnGap`/`gridRowGap`/per-cell
  padding model (`configureChildAsGrid` in `packages/core/src/layout.ts`) that this overlay has never
  addressed; would need its own hit-testing and drawing pass, not a small extension of this one.

## Implementation Steps

1. **Spacing-edit state and handlers** (`packages/vue/src/canvas/useCanvasInput.ts`): add
   `autoLayoutSpacingEdit` ref and the four functions per Fixed Decision 3, placed directly after the
   existing padding-edit block (after line 213) so the two stay visually paired for the next reader. Wire
   into `onDblClick` and the `onMouseDown` commit-on-click-elsewhere block.
2. **Alt-pairing on the padding-edit functions** (`packages/vue/src/canvas/useCanvasInput.ts`): extend
   `autoLayoutPaddingEdit`'s type with `paired: boolean`, set from `e.altKey` in `startAutoLayoutPaddingEdit`,
   and branch `updateAutoLayoutPaddingEdit`/`commitAutoLayoutPaddingEdit` per Fixed Decision 5.
3. **Hover cursor** (`packages/vue/src/canvas/useCanvasInput.ts`): add `getAutoLayoutHoverCursor(hover,
   node)` returning `'ns-resize' | 'ew-resize' | null` per Fixed Decision 7, and call it from
   `handleSelectHover` per Decision 8 — compute `resolveAutoLayoutHover` once, reuse the result for both
   `editor.setAutoLayoutHover(...)` and the cursor fallback rather than calling it twice.
4. **Gutter popover UI** (`src/components/EditorCanvas.vue`): add `autoLayoutSpacingEdit` /
   `updateAutoLayoutSpacingEdit` / `commitAutoLayoutSpacingEdit` / `cancelAutoLayoutSpacingEdit` to the
   `useCanvasInput` destructure, a `spacingEditorAnchor` computed (gap-rect midpoint, per Fixed Decision 4),
   a `spacingEditorReference` via `useCanvasVirtualReference`, and the popover block itself, placed directly
   after the existing padding-editor `PopoverRoot` block.
5. **Focused tests** (`tests/e2e/editor/auto-layout/`):
   - New `spacing-editor.spec.ts` mirroring every case in `padding-editor.spec.ts`: opens on double-click
     of a gutter handle, drag-scrubs, commits in one undo step, closes on outside click.
   - Add to `padding-editor.spec.ts`: an Alt+double-click case asserting both paired sides change together
     and undo restores both in one step; a plain (non-Alt) case re-asserting only the single side changes
     (regression guard that Decision 5 didn't break the existing behaviour).
   - A cursor assertion (reading the canvas element's computed `cursor` style, matching however T-040/T-041
     assert cursor in their own specs — reuse that pattern) for hovering a padding side and a gutter region
     without clicking, confirming `'ns-resize'`/`'ew-resize'` as appropriate, and confirming a hovered
     resize handle still wins (precedence per Decision 8).

## Acceptance Criteria

- [ ] Hovering a selected `HORIZONTAL` or `VERTICAL` auto-layout frame's gutter shows the same striped/
      pill visual padding already shows — unchanged, since this was already true before this packet.
- [ ] Double-clicking a gutter region opens a `NumberField` popover bound to `itemSpacing`, drag-scrubs
      live, commits as one undo step on release, and closes on outside click — matching
      `padding-editor.spec.ts`'s existing padding assertions exactly, for spacing.
- [ ] Alt+double-click on a padding side updates both sides of that axis pair together, live, and undoes
      both in one step; a plain double-click still updates only the single side.
- [ ] Hovering (not dragging) a padding or gutter region shows `'ns-resize'`/`'ew-resize'` as appropriate;
      hovering a resize handle or rotation corner on the same frame still wins over this cursor.
- [ ] GRID-mode frames and `counterAxisSpacing` are untouched — no new hit-testing or drawing for either.
- [ ] Nothing in the Banned List appears in the diff.
- [ ] Existing `padding-editor.spec.ts` and `drag.spec.ts` (auto-layout reorder) pass unchanged.

## Verification

- `bunx tsgo --noEmit --pretty false` (from `App/`)
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- Focused `oxlint` over `packages/vue/src/canvas/useCanvasInput.ts`, `src/components/EditorCanvas.vue`,
  `packages/core/src/canvas/overlays/auto-layout-hover.ts` (if touched)
- `bun run check:i18n` (only if any new string is added — the `NumberField` reused here carries no new
  label text, so this should be a no-op; run it anyway to confirm)
- Focused Playwright: `App/tests/e2e/editor/auto-layout/padding-editor.spec.ts`,
  `App/tests/e2e/editor/auto-layout/spacing-editor.spec.ts`, `App/tests/e2e/editor/auto-layout/drag.spec.ts`
  (regression), `--project=openpencil`
- Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, or any build/install command.

## Stop Conditions

- Stop and report if `resolveAutoLayoutHover`'s `'spacing'`/`'spacing-value'` kinds turn out to fire for
  `layoutWrap: 'WRAP'` frames in a way that makes a single `itemSpacing` editor ambiguous (multiple gap
  rows) — the current `gapRects` computes one rect per gap regardless of row, and Fixed Decision 3 assumes
  a single frame-level value with no wrap-awareness needed; if wrap changes that assumption, this needs a
  fresh look rather than forcing the mirror.
- Stop if the Alt-pairing commit message convention conflicts with an existing i18n string expectation
  found in `check:i18n` — reuse `createPaddingActions`' exact strings rather than inventing new ones.
- Stop and report if `handleSelectHover`'s single `resolveAutoLayoutHover` call cannot be shared between
  the overlay-state write and the new cursor read without changing render timing (e.g. if `editor.setAuto
  LayoutHover` has an observable side effect beyond storing the value) — in that case compute the cursor
  from a second, cheap call rather than restructuring the existing call site.

## Status record

Status: **Done**

Executed 2026-08-19:
- Spacing-edit state and handlers (`autoLayoutSpacingEdit`, `startAutoLayoutSpacingEdit`, `updateAutoLayoutSpacingEdit`, `commitAutoLayoutSpacingEdit`, `cancelAutoLayoutSpacingEdit`) implemented in `packages/vue/src/canvas/useCanvasInput.ts` and wired into `onDblClick` and `onMouseDown`.
- Alt-pairing on padding edits implemented with `paired: boolean` in `autoLayoutPaddingEdit` and symmetric opposite side updating/committing with undo.
- Pre-drag directional hover cursor (`ns-resize` / `ew-resize`) added for both padding and gutter regions with resize handles taking precedence.
- Spacing popover UI added to `src/components/EditorCanvas.vue` using `NumberField`, `IconLucideAlignHorizontalSpaceBetween`/`IconLucideAlignVerticalSpaceBetween`, and `spacingEditorAnchor`.
- E2E Playwright coverage delivered in `tests/e2e/editor/auto-layout/spacing-editor.spec.ts` and `tests/e2e/editor/auto-layout/padding-editor.spec.ts`.
- Verification passed: `bunx tsgo --noEmit`, `bunx vue-tsc --noEmit`, `bunx oxlint`, and 10/10 focused Playwright tests passed.
