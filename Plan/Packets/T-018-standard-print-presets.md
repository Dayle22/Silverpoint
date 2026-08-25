# T-018 — Deliver standard print presets

Task ID: T-018
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-017 (units module and document DPI), T-007 (Done, frame guides), T-027 (Done, frame preset popover)
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `src/components/Toolbar/FramePresetPopover.vue`, `packages/core/src/guides/frame.ts`, `packages/vue/src/i18n/messages/panels.ts`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Intended Outcome

The existing frame-preset popover gains a **Print** group alongside the current screen sizes: A4, US Letter, business card, poster, and tri-fold. Choosing one creates an ordinary editable frame at the correct physical size for the document's DPI, with margin and bleed guides already set, in a single undo step.

## Verified Starting State

| Path | What is actually there |
| --- | --- |
| `src/components/Toolbar/FramePresetPopover.vue:22-26` | `const PRESETS: FramePreset[]` — a **flat, hardcoded, three-entry array** of `{ label, width, height }` in pixels: `1080x1080`, `1080x1920`, `1080x1440`. |
| `src/components/Toolbar/FramePresetPopover.vue:17-21` | `type FramePreset = { label: string; width: number; height: number }`. |
| `src/components/Toolbar/FramePresetPopover.vue:40-45` | `isValidDimension` requires `/^\d+$/` — **integer pixels only**. Physical presets convert to fractional pixels, so this validator must not be reused for preset dimensions. |
| `src/components/Toolbar/FramePresetPopover.vue:59-68` | `creationPoint()` centres the new frame in the viewport, resolving `enteredContainerId ?? currentPageId` and subtracting the parent's absolute position. Reuse verbatim. |
| `src/components/Toolbar/FramePresetPopover.vue:72-80` | `createFrame()` opens `editor.undo.beginBatch('Create frame')` then `editor.createShape('FRAME', x, y, w, h, …)`. **The guide writes must go inside this same batch.** |
| `packages/core/src/guides/frame.ts:49` | `DEFAULT_FRAME_GUIDES` — the shape a new frame's guides must take. |
| `packages/core/src/guides/frame.ts:100-130` | `upsertFrameGuides(pluginData, guides)` and `setFrameGuideEdge(...)`. This is the only sanctioned way to write guides. |
| `packages/core/src/guides/frame.ts:5` | `FRAME_GUIDE_MAX = 100000` — presets must stay inside it. |
| `packages/core/src/units/index.ts` | **Created by T-017.** `unitToPx`, `DocumentUnits`. This packet must not duplicate that maths. |

The popover is currently a flat list with no grouping and no orientation control. Both are added here.

## Fixed Decisions — binding

**1. Preset table moves to core.** Create `packages/core/src/units/presets.ts`. The `.vue` file must not hold dimension data.

```ts
export type PresetGroup = 'screen' | 'print'
export interface FramePresetDefinition {
  id: string                     // stable, kebab-case, never changes
  group: PresetGroup
  labelKey: string               // i18n key, not an English string
  width: number
  height: number
  unit: 'px' | 'mm' | 'in'       // the unit the dimensions are authored in
  margin?: { value: number; unit: 'mm' | 'in' }
  bleed?: { value: number; unit: 'mm' | 'in' }
  panels?: number                // fold panels along the long edge; tri-fold only
}
```

**2. The print table, exactly.** These values are fixed. Do not "round them nicer".

| id | Label | Size | Unit | Margin | Bleed | Panels |
| --- | --- | --- | --- | --- | --- | --- |
| `a4` | A4 | 210 × 297 | mm | 10 mm | 3 mm | — |
| `us-letter` | US Letter | 8.5 × 11 | in | 0.5 in | 0.125 in | — |
| `business-card` | Business card | 3.5 × 2 | in | 0.125 in | 0.125 in | — |
| `poster` | Poster | 18 × 24 | in | 0.5 in | 0.125 in | — |
| `tri-fold` | Tri-fold brochure | 11 × 8.5 | in | 0.25 in | 0.125 in | 3 |

The three existing screen presets keep their current pixel dimensions and gain ids `square-1080`, `story-1080x1920`, `portrait-1080x1440`, group `screen`, no margin, no bleed. Their behaviour must not change.

**3. Pixel conversion.** A print preset's pixel size is `unitToPx(value, { unit: preset.unit, dpi: documentDpi })` using T-017's document DPI. At the default 300 DPI, A4 is `2480.31 × 3507.87` px — **fractional pixels are correct and must not be rounded**. `createShape` already accepts floats; the integer-only `isValidDimension` guard applies to the custom-size text inputs only and must not be extended over presets.

**4. Orientation.** One portrait/landscape toggle in the popover, applying to the print group only. Landscape swaps width and height after conversion. Default orientation is whatever the table lists (so tri-fold defaults landscape, A4 defaults portrait). Orientation is a transient popover control — it is not persisted anywhere.

**5. Guides are written in the same undo batch.** After `createShape` returns a node id, build `FrameGuides` from `DEFAULT_FRAME_GUIDES` with all four margin edges set to the converted margin pixels and all four bleed edges to the converted bleed pixels, via `setFrameGuideEdge`, then `upsertFrameGuides` onto the new node's `pluginData` — all before `endBatch`. One Ctrl+Z must remove the frame **and** its guides together. There is a required test for this.

**6. Tri-fold panels are advisory guides only.** For `panels: 3`, add two vertical guide lines at 1/3 and 2/3 of the frame's long edge using whatever guide mechanism T-007 already exposes for that frame. If T-007 has no line-guide primitive separate from margins/bleed, **do not invent one** — instead set the tri-fold's left/right margins to the panel positions is *not* acceptable either; skip the panel guides, ship the preset without them, and record that in the execution report. No creep compensation, no stock allowance, no imposition, no printer claim, ever.

**7. Popover grouping.** The popover renders two labelled groups, **Screen** then **Print**, separated by `<div class="mx-1 h-px bg-border" />`. Each print entry shows its label and its physical size in the document's active unit (e.g. `A4 — 210 × 297 mm`), formatted with T-017's `formatUnitValue`. If the document unit is `px`, still show the print size in the preset's authored unit — a print preset labelled in pixels is useless.

**8. No new node type.** A preset produces a normal `FRAME`. No schema change, no marker property, no "is a print page" flag.

## Restrictions and Exclusions

- Do not add crop marks, printer profiles, CMYK, DPI warnings or production PDF. Those are T-019, T-020 and T-021.
- Do not change the custom-size flow, `isValidDimension`, or the three existing screen presets.
- Do not change `createShape`, the undo system, or `guides/frame.ts` itself — consume them.
- Do not add a document-level "page size" concept. This packet creates frames, nothing more.
- Do not touch `MobileHud/`, the dashboard, `showUI=false` or `?no-chrome`.

### Banned List — none of these may appear in the diff

- No new npm dependency.
- No dimension literal in a `.vue` file. Every number comes from `presets.ts`.
- No literal colour — semantic tokens only (`bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`).
- No font-size class other than `text-xs` or `text-[11px]`.
- No radius other than `rounded-md` or `rounded-lg`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English. Every label goes through `useI18n()` with defaults in `packages/vue/src/i18n/messages/panels.ts` and all eight locale dirs.
- No rounding of converted preset pixel dimensions.

## Implementation Steps

1. Confirm T-017 is Done in `Plan/plan.md` and that `packages/core/src/units/index.ts` exports `unitToPx` and `formatUnitValue`. If not, stop — this packet cannot proceed.
2. Read `FramePresetPopover.vue` in full and `guides/frame.ts:49-160`.
3. Create `packages/core/src/units/presets.ts` with the type and the eight entries (3 screen + 5 print). Export from `packages/core/src/index.ts`.
4. Add the i18n keys for the five print labels, the two group headings, and the orientation toggle — English defaults plus all eight locales.
5. Refactor `FramePresetPopover.vue` to render from the imported table, grouped, with the orientation toggle. Keep the custom-size flow byte-for-byte unchanged.
6. Extend `createFrame` to accept optional margin/bleed/panel metadata and write guides inside the existing `beginBatch('Create frame')` … `endBatch` window.
7. Add `tests/engine/units/presets.test.ts`: every preset converts to the expected pixel size at 300 DPI and at 96 DPI (assert against hand-computed values, not against the implementation); landscape swap; every preset stays under `FRAME_GUIDE_MAX`; ids are unique and stable.
8. Add `tests/e2e/toolbar/` Playwright coverage: the Print group appears; choosing A4 creates a frame of the expected size; its margin and bleed guides are present; **a single undo removes frame and guides together**; orientation toggle swaps dimensions; the three screen presets and the custom flow are unchanged.
9. Run, in this order, and paste exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused `oxlint -c oxlint.json` on the changed files only
   - `bun run check:i18n`
   - `bun test ./tests/engine/units/`
   - the focused Playwright spec with `--project=openpencil`

   Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
10. Stop at source gates. No build, no install, no version bump.

## Acceptance Criteria

- [ ] All five print presets create frames at the correct physical size for the document DPI, with fractional pixels preserved.
- [ ] Margin and bleed guides are created with the tabled values and remain editable in `GuidesSection.vue`.
- [ ] One undo removes the frame and its guides as a single action.
- [ ] Orientation toggle swaps print dimensions and does not affect screen presets.
- [ ] Presets display their physical size in a meaningful unit, never bare pixels.
- [ ] The result is a normal `FRAME` and survives a `.fig` round-trip with guides intact.
- [ ] Screen presets and the custom-size flow are untouched.
- [ ] No printer-production claim appears in any string. Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: T-017 is not Done; T-007 exposes no way to add tri-fold panel guides without inventing a new guide kind (ship the other four and report); or writing guides inside the creation undo batch is not possible with the current `beginBatch` API.

## Revision History

- Revision 1 — 2026-07-24: original expansion, written before T-027 shipped the preset popover.
- Revision 2 — 2026-08-14: re-expanded against the live `FramePresetPopover.vue` and `guides/frame.ts`. Fixed the preset table location, the fractional-pixel rule, the single-undo-batch requirement, and the tri-fold fallback. Removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-15: core presets table with Screen/Print definitions, fractional physical px conversions at document DPI, portrait/landscape orientation toggle, preset margin/bleed guides applied atomically in creation undo batch, 8-locale i18n sync; 17/17 Bun unit tests and 5/5 Playwright e2e green)
