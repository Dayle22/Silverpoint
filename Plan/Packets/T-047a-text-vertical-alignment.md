# T-047a - Text box vertical alignment

Task ID: T-047a
Packet state: Done
Packet revision: 2
Depends on: T-047 (Done - drag-to-create text box)
Related: T-014 (text layout and web fonts - owns `TypographySection.vue`, confirmed below)
Expanded at: 2026-08-21
Expansion note: the schema field and most plumbing already exist upstream. The real gap is narrow but hides in the CanvasKit paint path — read the Verified Starting State before touching anything.

## Intended Outcome

A text node can be set to align its text content Top, Middle, or Bottom within its own box, the way InDesign's vertical-justification control works. The setting is per-node, persists with the document, is exposed as a control beside the existing horizontal alignment control in the Typography panel, and actually changes what renders on canvas, in SVG/PDF export, and in `.fig` round-trips.

## Verified Starting State

`textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM'` (type alias `TextAlignVertical`, `packages/scene-graph/src/types.ts:217,395`) **already exists and is already wired** through everything except the two places that actually matter. Do not re-add or rename it.

Already correct, confirmed live, no changes needed:

| Path | What it does |
| --- | --- |
| `packages/scene-graph/src/node-defaults.ts:164` | Default `'TOP'`. |
| `packages/core/src/text/outlines.ts:221-229,273-296` | `verticalOffset()` already computes the correct offset and `textNodeToOutlineLayout()` already applies it — used by text-to-path/boolean ops and by `drawOutlinedText` (gradient/non-solid-fill text) via `canvas/text/outlines.ts` → `canvas/scene.ts:763-769`. This path is already correct. |
| `packages/core/src/kiwi/fig/node-change/{convert,serialize}.ts` | `.fig` import/export already round-trips the field (`convert.ts:375` defaults missing `.fig` data to `'TOP'`). |
| `packages/core/src/figma-api/{proxy,serialization}.ts` | Figma plugin-API shim already exposes `textAlignVertical` as a get/set property. |
| `packages/core/src/editor/properties/transfer.ts:73` | Already in the copy/paste-properties transfer list (T-068). |
| `packages/core/src/tools/modify/text.ts:148-149` | The MCP text-modify tool already accepts `align_vertical` and writes `textAlignVertical`. |
| `packages/core/src/design-jsx/{tree,render,props-overrides}.ts` | The AI design-JSX renderer/importer already reads and maps `textAlignVertical` (`props-overrides.ts:41,491-493` maps `top`/`center`/`bottom` synonyms too). |

**The actual gap — two places, confirmed by reading the code, not assumed:**

1. **Live paint path ignores the field entirely.** `packages/core/src/canvas/scene.ts:812` hardcodes `const paragraphY = 0` for the normal (solid-fill, font-loaded) text draw at line 843 (`canvas.drawParagraph(paragraph, 0, paragraphY)`), and the same `paragraphY` (still 0) is threaded into `drawGradientText()` (line 837, used at `scene.ts:775-800`) for gradient-filled text. Both ignore `node.textAlignVertical` completely — today, changing the field has **zero visible effect** on canvas, PNG export, or the vector-PDF raster fallback. The only path that already respects it (`drawOutlinedText`, non-solid-fill outline rendering) is a minority case.
2. **No property-panel control.** `App/src/components/properties/TypographySection.vue:148-161` has the horizontal `SegmentedControl` bound to `ctx.actions.align` / `node.textAlignHorizontal`. There is no vertical equivalent. The action layer backing it:
   - `packages/vue/src/controls/typography/actions.ts:86-93` — `setAlign(align)` writes `textAlignHorizontal` only. No `setAlignVertical`.
   - `packages/vue/src/primitives/TypographyControls/TypographyControlsRoot.vue:13-33` — exposes `actions.align` (mapped from `setAlign`) to the slot. No vertical equivalent exposed.

**SVG/PDF export — pre-existing constraint, not something to fix here.** `packages/core/src/io/formats/svg/export.ts:renderTextNode` (~line 200-239) is single-line only: one `<text>` element, one hardcoded baseline `y = node.fontSize || 14`, no per-line `<tspan>` splitting, no multi-line support at all today. Vector-PDF export (`io/formats/pdf/export.ts`) calls `renderNodesToSVG` for its vector path, so it inherits this. Full multi-line SVG text layout is a separate, larger pre-existing gap — **out of scope for this packet**. This packet's SVG/PDF "parity" scope is: apply the same three-way vertical offset to that single baseline `y`, computed against `node.height` using the box height (not full paragraph layout, since SVG export has no paragraph object). This will be correct for single-line text (the common case) and no worse than today for multi-line text.

## Contract

1. **Panel control** (`App/src/components/properties/TypographySection.vue`, `packages/vue/src/controls/typography/{actions.ts,use.ts}`, `TypographyControlsRoot.vue`): add a `setAlignVertical(align: 'TOP' | 'CENTER' | 'BOTTOM')` action mirroring `setAlign`'s shape exactly (same `editor.updateNodeWithUndo` call, `'Change vertical text alignment'` label), expose it through `TypographyControlsRoot`'s `actions` object as `alignVertical`, and add a second `SegmentedControl` beside the existing horizontal one in `TypographySection.vue` — same `PanelFieldGroup`/`PanelGrid` pattern as the row above it (`textResizing` next to `textAlignment` reads as the closest precedent: two related controls stacked, each its own `PanelFieldGroup`). Icons: reuse `icon-lucide-align-start-vertical` / `icon-lucide-align-center-vertical` / `icon-lucide-align-end-vertical` (already imported elsewhere in `App/src`, e.g. `PositionSection.vue`) for TOP/CENTER/BOTTOM — do not invent new icon imports.
2. **i18n** (`packages/vue/src/i18n/messages/panels.ts`): add `textAlignmentVertical` (label, alongside `textAlignment:75`) and `alignTop` / `alignMiddle` / `alignBottom` (alongside `alignLeft`/`alignCenterHorizontally`/`alignRight:167-169`). Single locale file (T-054) — no other file to touch.
3. **Live paint fix** (`packages/core/src/canvas/scene.ts`): build the paragraph once per `renderText` call (it already is, at line 842, just not reused), measure it (`paragraph.getHeight()`), compute `paragraphY` from `node.textAlignVertical` + `node.height` using the same formula as `verticalOffset()` in `text/outlines.ts` (do not reimplement the formula differently — extract or mirror it exactly: `CENTER` → `max(0, (node.height - contentHeight) / 2)`, `BOTTOM` → `max(0, node.height - contentHeight)`, `TOP` → `0`), then pass that `paragraphY` into `canvas.drawParagraph(paragraph, 0, paragraphY)` at line 843. For `drawGradientText` (lines 771-800), which builds its own separate paragraph, either pass the already-measured `paragraphY` in from the caller (preferred — avoids a second paragraph build/measure) or measure its own paragraph the same way; its `saveLayer` bounds rect (line 784) already uses `paragraphY` as a parameter so wiring is mostly plumbing, not new logic.
4. **SVG/PDF export parity** (`packages/core/src/io/formats/svg/export.ts`): change `renderTextNode`'s `y` (line 225, currently `node.fontSize || 14`) to the same three-way switch against `node.height` and the single baseline, scoped as described in Verified Starting State above. Do not attempt multi-line `<tspan>` layout in this packet.
5. Do not touch anything already listed as correct in Verified Starting State — no `.fig`, MCP, design-JSX, or property-transfer changes.

## Verification

Development loop: one focused engine test in `App/tests/engine/render/canvas/text.test.ts` exercising `paragraphY` (via `canvas.drawParagraph` mock call args, following the existing `createMockRenderer`/`createMockCanvas`/`createMockParagraph` pattern at the top of that file — extend `createMockParagraph()` with a `getHeight: mock(() => <value>)`) at each of the three `textAlignVertical` values against a fixed `node.height`.

Final once:
- The above engine test, plus one focused SVG export test (`App/tests/engine/io/...` — find the existing SVG text export test file as precedent) asserting the baseline `y` at each of the three values.
- Focused Oxlint on changed files.
- `bunx tsgo --noEmit --pretty false`.
- Browser check on `bun run dev`: create a text box shorter than its content in each `textAutoResize: NONE` state, set each of Top/Middle/Bottom from the new panel control, confirm glyphs visibly shift without the box resizing or horizontal alignment changing; export SVG and PDF and confirm the baseline moved too.

Do not run `bun run check`, `bun run test`, or `bun run test:unit` — focused commands only, per `App/AGENTS.md`.

## Stop Conditions

Stop and report if: `paragraph.getHeight()` is unavailable or unreliable before `paragraph.layout()` has been called with the final width (measure order matters — confirm against `measureTextNode`'s existing usage at `canvas/text/index.ts:177-192`); or if reusing one paragraph between the measure and the `drawParagraph` call conflicts with the `WIDTH_AND_HEIGHT` two-pass layout already done in `buildParagraph` (`canvas/text/index.ts:498-503`).

## Revision History

- Revision 1 — 2026-08-21: first brief, captured from user request.
- Revision 2 — 2026-08-21: expanded. Traced the field through the whole codebase — found it already fully wired everywhere except the live CanvasKit paint path (`canvas/scene.ts`, hardcoded `paragraphY = 0`), the SVG/PDF baseline, and the property panel. Narrowed contract to exactly those three plus i18n; explicitly excluded `.fig`/MCP/design-JSX/property-transfer (already correct) and multi-line SVG layout (separate pre-existing gap).

## Status record
 
2026-08-21 - Expanded. Verified starting state confirmed by direct code reading (not assumption): schema, `.fig`, MCP tool, design-JSX, and property-transfer already support `textAlignVertical`; the CanvasKit paint path and the property panel do not. Ready to execute.
2026-08-21 - Executed and verified. CanvasKit rendering now shifts paragraphY according to textAlignVertical, SVG export baseline y computes vertical offset, Typography section exposes top/middle/bottom SegmentedControl, and all focused tests, tsgo, and oxlint pass cleanly. Done.
