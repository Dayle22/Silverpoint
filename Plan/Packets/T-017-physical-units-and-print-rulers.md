# T-017 — Deliver physical units and print rulers

Task ID: T-017
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-007 (Done)
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `packages/core/src/canvas/rulers.ts`, `constants.ts`, `renderer.ts`, `renderer/pipeline.ts`, `editor/types.ts`, `guides/frame.ts`, `src/components/properties/{GuidesSection,PositionSection,PageSection}.vue`, `src/components/inputs/NumberField.vue`, `src/app/shell/canvas-grid.ts`, `tests/engine/io/fig/roundtrip/frame-guides.test.ts`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Intended Outcome

A document carries a display unit (`px`, `mm`, `cm`, `in`) and a document DPI. Canvas rulers, ruler selection badges, position/size fields, and margin/bleed fields all display in that unit. Typing a value in the active unit converts to pixels at the document DPI. Node geometry stays in pixels, exactly, always.

This is the foundation packet for T-018, T-019, T-020 and T-021. Get the conversion module and the persistence key right; four other packets build on them.

## Verified Starting State

Read these before editing. Every line below was confirmed on 2026-08-14.

| Path | What is actually there |
| --- | --- |
| `packages/core/src/canvas/rulers.ts:250-260` | `rulerStep(r)` derives step from `r.zoom` and `RULER_TARGET_PIXEL_SPACING` only, on a 1/2/5/10 ladder. No unit awareness. |
| `packages/core/src/canvas/rulers.ts:262-264` | `rulerLabel(value)` is `Math.round(value).toString()`. |
| `packages/core/src/canvas/rulers.ts:161-196` | `drawRulers` builds the four selection badge labels **inline**, each as `Math.round((selBounds.sx1 - r.panX) / r.zoom).toString()`. There are four such call sites. They do not go through `rulerLabel`. |
| `packages/core/src/canvas/renderer.ts:184` | `rulerTheme: RulerTheme \| null = null` — a per-render field on `SkiaRenderer`. **This is the pattern to copy.** |
| `packages/core/src/canvas/renderer/pipeline.ts:51` | `r.rulerTheme = state.rulerTheme ?? null` inside `renderFromEditorState`. **This is the wiring point.** |
| `packages/core/src/editor/types.ts:102` | `rulerTheme?: RulerTheme` on `EditorState`, alongside `canvasGrid` and `guideAppearance`. |
| `packages/core/src/constants.ts:46-57,120-121` | `RULER_SIZE=20`, `RULER_TARGET_PIXEL_SPACING=100`, `RULER_MAJOR_TICK`, `RULER_MINOR_TICK`, `RULER_MAJOR_TOLERANCE=0.01`. |
| `packages/core/src/guides/frame.ts:3-4,80-130` | `FRAME_GUIDES_PLUGIN_ID = 'open-pencil'`, `FRAME_GUIDES_PLUGIN_KEY = 'frameGuides'`, with `parseFrameGuides` / `upsertFrameGuides` / `setFrameGuideEdge`. **This is the persistence pattern to copy.** |
| `tests/engine/io/fig/roundtrip/frame-guides.test.ts` | Proves `pluginData` survives a `.fig` round-trip. Units persistence rides on the same proven mechanism. |
| `src/components/properties/GuidesSection.vue:138-157` | Two `<NumberField suffix="px">` plus a literal `<span class="text-[10px] text-muted">px</span>` at line 149. Three hardcoded `px` strings. |
| `src/components/properties/PositionSection.vue:79-120` | X/Y/W/H are `NumberField` bound with `:model-value` and `@update:model-value="actions.updateProp('x', $event)"`. |
| `src/components/inputs/NumberField.vue:21,130,137` | Already has a `suffix?: string` prop and a `suffix` slot. No parsing hook — it emits a number. |
| `src/app/shell/canvas-grid.ts:11-22` | `useLocalStorage` + `normalize…` / `load…` / `save…` trio. **Copy this shape** for any app-level default, not for the document value. |
| `packages/vue/src/i18n/messages/panels.ts:75` | English defaults live here (`margins: 'Margins'`). Eight locale dirs under `packages/vue/src/i18n/locales/`. `bun run check:i18n` gates them. |

**There is no `packages/core/src/units/` directory and no ruler test file anywhere in `tests/`.** Both are created by this packet.

### Correction to revision 1

Revision 1 specified persistence under an `openpotlood/units` key. That is wrong for this codebase — the live plugin ID is `'open-pencil'` (`guides/frame.ts:3`). Use the live convention, see Fixed Decisions #4.

## Fixed Decisions — binding

**1. Conversion module.** Create `packages/core/src/units/index.ts` exporting:

```ts
export type DocumentUnit = 'px' | 'mm' | 'cm' | 'in'
export interface DocumentUnits { unit: DocumentUnit; dpi: number }
export const DEFAULT_DOCUMENT_UNITS: DocumentUnits = { unit: 'px', dpi: 300 }
export const DPI_PRESETS = [72, 96, 150, 300, 600] as const

export function pxPerUnit(units: DocumentUnits): number
export function pxToUnit(px: number, units: DocumentUnits): number
export function unitToPx(value: number, units: DocumentUnits): number
export function formatUnitValue(px: number, units: DocumentUnits): string
export function unitStepLadder(unit: DocumentUnit): number[]
export function normalizeDocumentUnits(raw: unknown): DocumentUnits
```

Conversion, exactly:

- `px_per_in = dpi`, `px_per_mm = dpi / 25.4`, `px_per_cm = dpi / 2.54`, `px_per_px = 1`
- `pxToUnit(px) = px / pxPerUnit`, `unitToPx(v) = v * pxPerUnit`

`normalizeDocumentUnits` clamps DPI to the integer range `[1, 2400]` and falls back to `DEFAULT_DOCUMENT_UNITS` for anything unrecognised. It must never throw.

**2. Canonical pixel invariant.** `SceneNode` geometry (`x`, `y`, `width`, `height`, corner radii, `strokeWeight`, guide margins and bleed) stays in exact pixels. Conversion happens **only** at these four boundaries: ruler tick labels, ruler selection badges, property-panel field display, and property-panel field commit. Nothing else converts. No conversion enters the scene graph, the undo stack, Kiwi serialisation, or any exporter.

**3. Round-trip stability.** A displayed value must round-trip without drift: editing a field to the same displayed string must not change the stored pixel value. Implement by comparing the **formatted** value, not the parsed float — if `formatUnitValue(storedPx) === formatUnitValue(unitToPx(typedValue))`, keep `storedPx` unchanged. This is the single most likely source of silent artwork corruption; there is a required test for it.

**4. Persistence.** Document units live in `pluginData` on the **document root node** (`graph.rootId`), written through a new module `packages/core/src/units/document.ts` that mirrors `guides/frame.ts` exactly:

```ts
export const DOCUMENT_UNITS_PLUGIN_ID = 'open-pencil'   // same ID as frame guides
export const DOCUMENT_UNITS_PLUGIN_KEY = 'documentUnits'
export function parseDocumentUnits(pluginData: PluginDataEntry[]): DocumentUnits
export function upsertDocumentUnits(pluginData: PluginDataEntry[], units: DocumentUnits): PluginDataEntry[]
```

Do not invent a new plugin ID. Do not add a field to the Kiwi schema. Do not use `localStorage` for the document value — a document opened on this machine must carry its own unit.

**5. Render wiring.** Add `documentUnits?: DocumentUnits` to `EditorState` in `packages/core/src/editor/types.ts`, directly beside `rulerTheme`. Assign it in `renderFromEditorState` (`renderer/pipeline.ts`) as `r.documentUnits = state.documentUnits ?? DEFAULT_DOCUMENT_UNITS`, and declare `documentUnits: DocumentUnits` on `SkiaRenderer` in `renderer.ts` beside `rulerTheme`. Do not thread units through function arguments; do not add a new global.

**6. Ruler step ladders.** `rulerStep` takes the renderer's units and returns a step **in pixels**. Selection is: convert `RULER_TARGET_PIXEL_SPACING / r.zoom` into the active unit, pick the smallest ladder value whose on-screen spacing is at least `RULER_TARGET_PIXEL_SPACING`, convert back to pixels.

| Unit | Ladder (in that unit) |
| --- | --- |
| `px` | current 1/2/5 × decade behaviour — **unchanged** |
| `mm` | `1, 2, 5, 10, 20, 50, 100, 200, 500, 1000` |
| `cm` | `0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100` |
| `in` | `0.125, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100` |

If the required step is larger than the last ladder entry, keep multiplying the last entry by 10. `in` deliberately uses binary fractions at the low end; do not "simplify" it to 1/2/5.

**7. Label formatting.** `formatUnitValue` produces: `px` → integer, no decimals. `mm` / `cm` / `in` → up to 2 decimal places with trailing zeros stripped (`25.4`, `1`, `0.13`). Never append the unit symbol inside `formatUnitValue` — callers add the suffix. Ruler tick labels and badges use the bare number.

**8. Badge call sites.** Replace all four inline `Math.round(...).toString()` expressions in `drawRulers` (`rulers.ts:161-196`) with `formatUnitValue(worldValue, r.documentUnits)`. Do not leave one behind — a mixed-unit ruler is worse than no feature.

**9. UI placement.** Unit and DPI controls go in `src/components/properties/PageSection.vue`, as a new `PanelFieldGroup` row below the existing page fill. Unit is a select of the four units; DPI is a `NumberField` with the five presets available and free integer entry. Do not create a new panel, a new dock, or a ruler right-click menu in this packet.

**10. Field conversion.** `PositionSection.vue` (X, Y, W, H) and `GuidesSection.vue` (margins, bleed) display `formatUnitValue(storedPx, units)` and commit `unitToPx(input, units)` subject to decision #3. The `suffix` prop and the literal `px` span at `GuidesSection.vue:149` become the active unit symbol. Rotation is an angle — leave it in degrees, untouched.

## Restrictions and Exclusions

- Do not change `SceneNode` storage, the Kiwi schema, or `.fig` write/read code.
- Do not change any exporter. PNG/JPEG/SVG/PDF output bytes must be identical before and after this packet for an unchanged document — there is a required test for this.
- Do not touch `MobileHud/`, the dashboard, `showUI=false`, or `?no-chrome`.
- Do not implement print presets (T-018), gamut warnings (T-019), a DPI inspector (T-020), or production PDF (T-021). This packet supplies the units module they consume and nothing more.
- Do not add a ruler context menu, a unit shortcut, or a status-bar readout.

### Banned List — none of these may appear in the diff

- No new npm dependency. All conversion is arithmetic.
- No literal colour of any kind — no hex, `rgb()`, `hsl()`, or Tailwind palette names. Semantic tokens only: `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`.
- No font-size class other than `text-xs` or `text-[11px]`. Never `text-sm`, `text-base`, `text-lg`.
- No radius other than `rounded-md` or `rounded-lg`.
- No new `tv()` recipe file — reuse `components/ui/menu.ts` and `surface.ts`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English in a `.vue` file. Every new string goes through `useI18n()` with a default added to `packages/vue/src/i18n/messages/panels.ts` and all eight locale dirs.
- No `Math.round` on a stored pixel value anywhere in the commit path.

## Implementation Steps

1. Read `rulers.ts`, `renderer.ts:180-190`, `renderer/pipeline.ts:40-55`, `editor/types.ts:95-110` and `guides/frame.ts` in full before writing anything.
2. Create `packages/core/src/units/index.ts` per Fixed Decision #1. Export it from `packages/core/src/index.ts` following the existing export style.
3. Create `packages/core/src/units/document.ts` per Fixed Decision #4, mirroring `guides/frame.ts` structure line for line.
4. Add `documentUnits` to `EditorState`, `SkiaRenderer` and `renderFromEditorState` per Fixed Decision #5.
5. Rewrite `rulerStep` and `rulerLabel` for units, and replace the four inline badge expressions in `drawRulers`.
6. Add the unit + DPI controls to `PageSection.vue`, reading and writing document-root `pluginData` through an undoable store update (follow `GuidesSection.vue:45-49` `writeWithUndo` exactly).
7. Load units into `EditorState` when a document opens. The open path is `openFileInNewTab` in `src/app/tabs/index.ts:212` → `store.replaceGraph(imported)`; set units from the imported root's `pluginData` there or in the store's `replaceGraph`, whichever the surrounding code makes natural. A new document gets `DEFAULT_DOCUMENT_UNITS`.
8. Convert the display/commit path in `PositionSection.vue` and `GuidesSection.vue`.
9. Add `tests/engine/units/conversion.test.ts` and `tests/engine/units/ruler-step.test.ts` covering: every conversion pair at 72/96/150/300/600 DPI; `25.4 mm === 1 in` at every DPI; the ladder selection at several zoom levels per unit; `formatUnitValue` decimals; `normalizeDocumentUnits` on garbage input; **and the no-drift round trip — set a value, read the displayed string, commit it back unchanged, assert the stored pixel value is bit-identical, repeated 100 times.**
10. Add `tests/engine/io/fig/roundtrip/document-units.test.ts` alongside the existing `frame-guides.test.ts`, proving unit + DPI survive a `.fig` write/read.
11. Add an export-isolation test: render a fixture to SVG and PNG with `unit: 'px'` and again with `unit: 'mm'`, assert the output is byte-identical.
12. Add Playwright coverage in `tests/e2e/canvas/` : switching unit changes ruler labels and the property suffixes; entering `50` in `mm` stores the DPI-correct pixel width; switching unit does not move or resize the selection.
13. Run, in this order, and paste exact exit codes:
    - `bunx tsgo --noEmit --pretty false`
    - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
    - `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
    - focused `oxlint -c oxlint.json` on the changed files only
    - `bun run check:i18n`
    - `bun test ./tests/engine/units/ ./tests/engine/io/fig/roundtrip/`
    - the focused Playwright spec with `--project=openpencil`

    If the Playwright run cannot see the new core exports, run `bun --filter @open-pencil/core build` — **not** `bun run check`. `App/AGENTS.md` forbids umbrella commands (`bun run check`, `bun run test`, `bun run test:unit`) unless the user asks for that exact command.
14. Stop at source gates. Do not build the desktop app, do not run the NSIS installer, do not bump `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`.

## Acceptance Criteria

- [ ] `px`, `mm`, `cm`, `in` selectable with DPI presets 72/96/150/300/600 plus free integer entry.
- [ ] Ruler ticks, tick labels and all four selection badges render in the active unit — no inline `Math.round` badge expression remains in `rulers.ts`.
- [ ] X/Y/W/H and margin/bleed fields display and commit in the active unit; the three hardcoded `px` strings in `GuidesSection.vue` are gone.
- [ ] Switching unit or DPI never changes a stored pixel value; the 100-iteration no-drift test passes.
- [ ] Unit and DPI survive a `.fig` write/read via document-root `pluginData` under `pluginId: 'open-pencil'`, `key: 'documentUnits'`.
- [ ] SVG and PNG export bytes are identical across unit changes.
- [ ] Correct in all four themes; nothing in the Banned List appears in the diff.
- [ ] `check:i18n` passes with all eight locales updated.

## Stop Conditions

Stop and report if: `pluginData` on the document root does not survive `.fig` round-trip (frame guides use a frame node, not the root — verify this early, in step 3, before building anything on top of it); the renderer cannot carry per-render unit state the way it carries `rulerTheme`; or the no-drift test cannot be made to pass without rounding stored geometry.

## Revision History

- Revision 1 — 2026-07-24: original expansion.
- Revision 2 — 2026-08-14: re-expanded against live source. Corrected the plugin-ID decision, named the four inline badge call sites, fixed the `rulerTheme` seam as the wiring pattern, added the no-drift and export-isolation requirements, added binding ladders, and removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-14: core arithmetic, document-level pluginData parse/upsert on root, Skia ruler step ladder and label formatting, PageSection/GuidesSection/PositionSection unit wiring, 8-locale i18n sync, full engine units/roundtrip/isolation suite and Playwright e2e green)
