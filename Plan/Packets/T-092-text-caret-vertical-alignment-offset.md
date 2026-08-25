# T-092 - Text caret and selection offset for vertically aligned text

Task ID: T-092
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-047a (Done)
Related: T-014, T-047, T-047c
Prepared from: comparison against `Toolbox/open-pencil-master (1)` on 2026-08-24. Upstream fixed this as "Keep text-editing carets, hit testing, and selection highlights aligned with vertically centered or bottom-aligned text. (#539)". OpenPotlood shipped vertical alignment in T-047a and does not have the fix.
Expanded at: 2026-08-24, Africa/Johannesburg
Expanded against: `App/packages/core/src/text/editor.ts` (392 lines, read in full), `App/packages/core/src/text/index.ts`, `App/packages/core/src/canvas/scene.ts:100–130,760–868`, `App/packages/core/src/canvas/overlays/text-edit.ts` (48 lines, read in full), `App/packages/vue/src/canvas/text-edit/input.ts:40–80`, `App/packages/vue/src/canvas/text-edit/editing.ts:150–176`, `App/packages/vue/src/canvas/transform-input/text-selection.ts:10`, `App/packages/scene-graph/src/types.ts:226,404`, `App/packages/scene-graph/src/index.ts:361–385`, `App/tests/engine/text/editor.test.ts` (213 lines), `App/tests/engine/render/canvas/text.test.ts:1–101,218–250`, `App/tests/e2e/text/` (file list), `App/package.json` scripts. Cross-read for comparison only: `Toolbox/open-pencil-master (1)/open-pencil-master/packages/core/src/text/editor.ts`.
Delivery: named source gates + browser check
Execution size: 3 implementation files (1 new pure module, 2 edits); 2 test files (1 extended Bun test, 1 new Bun test); no split — one responsibility (one coordinate offset applied consistently), no UI change, no model change.

## Intended Outcome

While editing a text box whose `textAlignVertical` is `CENTER` or `BOTTOM`, the caret, the selection
highlight, and click/double-click hit testing all land on the glyphs the user can actually see.

Today they do not. The renderer draws the paragraph at a vertical offset
(`canvas.drawParagraph(paragraph, 0, paragraphY)`, `scene.ts:859`) but `TextEditor` maps and reports
coordinates in unshifted paragraph space. On a centred or bottom-aligned text box the caret is drawn near the
top of the box instead of on the text, clicking on a glyph selects a different character (or none), and the
selection highlight is offset from the highlighted words.

## Request Coverage

- Restores correctness to T-047a's vertical alignment, which introduced the divergence between where text is
  drawn and where the editor thinks it is.
- Covers all four coordinate entry points and both geometry outputs — see Verified Starting State.
- Horizontal alignment is already correct and is not touched.

## Verified Starting State

| Path | Symbol / selector | Current fact (verified) |
| --- | --- | --- |
| `packages/scene-graph/src/types.ts:226` | `export type TextAlignVertical = 'TOP' \| 'CENTER' \| 'BOTTOM'` | Three values. `types.ts:404` declares `textAlignVertical: TextAlignVertical` on `SceneNode`. |
| `packages/core/src/canvas/scene.ts:776–785` | `function computeTextParagraphY(node, contentHeight): number` | **Module-local, not exported.** `CENTER` → `Math.max(0, (node.height - contentHeight) / 2)`; `BOTTOM` → `Math.max(0, node.height - contentHeight)`; default → `0`. This is the authoritative offset formula. |
| `packages/core/src/canvas/scene.ts:795,858,863` | `computeTextParagraphY(...)` | Three call sites: gradient text (795), the normal paragraph path (858), and the no-font fallback path (863, which passes `fontSize` as the content height). |
| `packages/core/src/canvas/scene.ts:859` | `canvas.drawParagraph(paragraph, 0, paragraphY)` | The paragraph is drawn **translated down by `paragraphY`** in node-local space. Everything the editor reports must be shifted by the same amount. |
| `packages/core/src/text/editor.ts:30,113,121` | `private paragraphNode: SceneNode \| null` | Assigned in `rebuildParagraph` (121), cleared in `stop` (113). Holds the live node object. |
| `packages/scene-graph/src/index.ts:368–385` | `updateNode(id, changes)` | Resolves `this.nodes.get(id)` and mutates that object in place. Therefore `paragraphNode.height` and `paragraphNode.textAlignVertical` are always current — no staleness risk from resize or an alignment change mid-edit. |
| `packages/vue/src/canvas/text-edit/editing.ts:163–164` | `editor.insert(text, node)` then `syncText(node.id, editor.state?.text ?? '', runs)` | The edited text is pushed back onto the node on every mutation, so the editor's paragraph and the rendered paragraph are built from the same text and therefore have the same height at paint time. |
| `packages/core/src/text/editor.ts:168` | `setCursorAt` → `s.paragraph.getGlyphPositionAtCoordinate(x, y)` | **Unshifted.** Single-click caret placement. |
| `packages/core/src/text/editor.ts:191` | `selectWordAt` → same call | **Unshifted.** Double-click word selection; also used by `startTextEditingAt` (`input.ts:73`). |
| `packages/core/src/text/editor.ts:198` | `selectLineAt` → same call | **Unshifted.** No current caller, but public API. |
| `packages/core/src/text/editor.ts:246–255` | `moveVertical` → `getGlyphPositionAtCoordinate(caret.x, y)` where `y` derives from `getCaretRect()` | Feeds a caret-space `y` back into paragraph space. Once `getCaretRect` is shifted, this call must be **un**shifted, or Up/Down arrow keys break. |
| `packages/core/src/text/editor.ts:325–337` | `getCaretRect()` empty-text branch | Returns `{ x: line.left, y0: 0, y1: line.height }` — hard-coded `0`, so an empty centred text box shows its caret at the top of the box. |
| `packages/core/src/text/editor.ts:356–368` | `getCaretRect()` rect branch | Returns `y0: top, y1: bottom` straight from `getRectsForRange`. Unshifted. |
| `packages/core/src/text/editor.ts:371–387` | `getSelectionRects()` | Returns `{ x: left, y: top, … }` straight from `getRectsForRange`. Unshifted. |
| `packages/core/src/canvas/overlays/text-edit.ts:20–47` | `drawTextEditOverlay` | Draws the box outline, the selection rects and the caret directly in node-local coordinates with no offset of its own. It is therefore a faithful consumer — the fix belongs in `TextEditor`, not here. |
| `packages/vue/src/canvas/text-edit/input.ts:43–45,58,60` | `const abs = editor.graph.getAbsolutePosition(editNode.id)`; `localX = cx - abs.x`; `localY = cy - abs.y` | Pointer coordinates reaching `setCursorAt`/`selectWordAt` are node-local with the origin at the box's top-left. Confirms the offset is the only missing term. |
| `packages/vue/src/canvas/transform-input/text-selection.ts:10` | `textEditor.setCursorAt(cx - abs.x, cy - abs.y, true)` | Drag-to-extend selection uses the same node-local convention. |
| `packages/core/src/text/index.ts` | barrel | Ten `export *` lines. Deep imports such as `#core/text/outlines` (`canvas/boolean.ts:5`) and `#core/text/editor` (`canvas/renderer.ts:19`) are the established convention, so a new module does **not** need a barrel entry. |
| `packages/core/src/text/editor.ts:6` | `import type { SkiaRenderer } from '#core/canvas'` | Type-only, erased at build. `packages/core/src/text/` has no runtime import of `packages/core/src/canvas/`, so a new pure module under `text/` imported by `canvas/scene.ts` creates no cycle. |
| `tests/engine/text/editor.test.ts:1–20` | `const mockCk = {} as CanvasKit`; `createEditor()` calls `editor.start(node)` with no renderer | `rebuildParagraph` returns early when `this.renderer` is null, so `state.paragraph` is `null` throughout this file. Existing tests cannot exercise paragraph geometry; the new test needs its own fixture. |
| `tests/engine/render/canvas/text.test.ts:21–80` | `createMockCanvas`, `createMockParagraph(height = 20)`, `createMockRenderer(overrides)` | The established mock shape to copy: `getHeight: mock(() => height)`, `buildParagraph: mock(() => paragraph)`. |
| `tests/engine/render/canvas/text.test.ts:221–248` | three `textAlignVertical` render tests | Already assert `drawParagraph` receives `0`, `40` and the bottom offset. These must keep passing after `computeTextParagraphY` moves — they are the regression guard for the extraction. |

Exact new module contract to implement (copy verbatim):

```ts
// packages/core/src/text/vertical-align.ts
import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * Vertical offset, in node-local coordinates, at which a text node's paragraph
 * is drawn. Shared by the renderer and the text editor so the caret, selection
 * highlight and hit testing always match what is painted.
 */
export function computeTextParagraphY(node: SceneNode, contentHeight: number): number
```

Its body is the current `scene.ts:776–785` body, moved unchanged.

## Read First

1. `packages/core/src/text/editor.ts` — the whole file (392 lines). Every edit is in it.
2. `packages/core/src/canvas/scene.ts` lines 760–868 — `computeTextParagraphY` and its three call sites.
3. `packages/core/src/canvas/overlays/text-edit.ts` — the whole file (48 lines), to confirm it needs no change.
4. `tests/engine/render/canvas/text.test.ts` lines 21–80 and 218–250 — the mock shapes and the render
   assertions that guard the extraction.
5. `tests/engine/text/editor.test.ts` lines 1–22 — the existing fixture, which the new test must not disturb.

Do **not** open `packages/vue/src/canvas/text-edit/*`, `packages/core/src/canvas/renderer*`, or any font module.
Their behaviour is recorded above and none of them changes.

## Corrections to the Brief

None. The divergence is real and is reproducible by inspection: `scene.ts:859` draws at `paragraphY`, and every
coordinate method in `text/editor.ts` uses `0`.

One scope note the brief does not state: upstream's version of this fix also adds a `caretIndex` getter to
`TextEditor`. That getter is unrelated to the alignment defect and belongs to an upstream feature OpenPotlood
does not have. It is on the Banned List.

## Fixed Decisions

1. **Extract `computeTextParagraphY` into a new pure module `packages/core/src/text/vertical-align.ts` and
   import it from both `canvas/scene.ts` and `text/editor.ts`.** Do **not** copy upstream's approach, which
   duplicates the formula as a private `paragraphVerticalOffset()` method on `TextEditor`. Justification: a
   duplicated formula is exactly how this class of bug recurs — the renderer and the editor must not be able to
   drift apart. `packages/core/src/text/` has no runtime dependency on `packages/core/src/canvas/`, so the new
   module is cycle-free, and deep `#core/text/*` imports are already the house convention.
2. **Move the function body unchanged.** `Math.max(0, (node.height - contentHeight) / 2)` is kept exactly; do
   not "simplify" it to upstream's two-step `available` form. The existing render tests at
   `tests/engine/render/canvas/text.test.ts:221–248` are the contract.
3. **`scene.ts` keeps all three of its call sites unchanged** — only the `function` declaration is deleted and
   an import added. In particular, line 863's `computeTextParagraphY(node, fontSize)` (the no-font fallback)
   stays as it is.
4. **The offset is derived from `this.paragraphNode` and `s.paragraph.getHeight()`**, returning `0` when either
   is missing. This mirrors what the renderer computes for the same node at the same moment (Verified Starting
   State: nodes mutate in place and `syncText` keeps text in step).
5. **`moveVertical` un-shifts before querying.** `getCaretRect()` will return caret-space `y` values; the
   derived `y` must be converted back to paragraph space before `getGlyphPositionAtCoordinate`. Implement this
   as a single private `paragraphY(y)` helper used by all four query sites, so shift and un-shift can never
   disagree.
6. **The empty-text branch of `getCaretRect` is offset too** (`y0: offsetY`, `y1: offsetY + line.height`). An
   empty centred text box is the most visible instance of the defect: the caret sits at the top of the box while
   the user expects it in the middle.
7. **`getSelectionRects()` is offset.** The selection highlight and the caret must move together, or fixing one
   makes the other look worse.
8. **No change to `drawTextEditOverlay`.** It is a faithful consumer of node-local coordinates; offsetting there
   would fix the drawing but leave hit testing wrong, which is the harder half of the bug.

## Open Decisions

1. **Horizontal (`textAlignHorizontal`) parity.** Recommended default (implemented): no change. CanvasKit
   applies horizontal alignment inside the paragraph itself, so `getRectsForRange` and
   `getGlyphPositionAtCoordinate` are already horizontally correct. Consequence of the alternative: none —
   adding a horizontal term would actively introduce a defect. Do not add one.
2. **`textAutoResize` interaction.** Recommended default (implemented): none needed. When a text node
   auto-resizes its height to its content, `node.height - contentHeight` is `0` and the offset is `0`, so the
   fix is inert for auto-height text and active only for fixed-height boxes — which is exactly the T-047a case.

## Visual Contract — binding

This packet changes no markup, no class, no colour, no spacing and no user-visible label. There is nothing to
style. The binding contract is the code shape below.

**New file** — `packages/core/src/text/vertical-align.ts`, complete contents:

```ts
import type { SceneNode } from '@open-pencil/scene-graph'

/**
 * Vertical offset, in node-local coordinates, at which a text node's paragraph
 * is drawn. Shared by the renderer and the text editor so the caret, selection
 * highlight and hit testing always match what is painted.
 */
export function computeTextParagraphY(node: SceneNode, contentHeight: number): number {
  switch (node.textAlignVertical) {
    case 'CENTER':
      return Math.max(0, (node.height - contentHeight) / 2)
    case 'BOTTOM':
      return Math.max(0, node.height - contentHeight)
    default:
      return 0
  }
}
```

**Two new private methods** on `TextEditor`, placed immediately after the constructor (currently ends line 35):

```ts
  private paragraphVerticalOffset(): number {
    const s = this._state
    const node = this.paragraphNode
    if (!s?.paragraph || !node) return 0
    return computeTextParagraphY(node, s.paragraph.getHeight())
  }

  /** Converts a caret-space y coordinate into paragraph-space. */
  private paragraphY(y: number): number {
    return y - this.paragraphVerticalOffset()
  }
```

**The six edits inside `TextEditor`** — each is the minimal change shown:

| Line (current) | Method | Change |
| --- | --- | --- |
| 168 | `setCursorAt` | `getGlyphPositionAtCoordinate(x, y)` → `getGlyphPositionAtCoordinate(x, this.paragraphY(y))` |
| 191 | `selectWordAt` | same substitution |
| 198 | `selectLineAt` | same substitution |
| 254 | `moveVertical` | `getGlyphPositionAtCoordinate(caret.x, y)` → `getGlyphPositionAtCoordinate(caret.x, this.paragraphY(y))` |
| 336 | `getCaretRect` empty branch | `return { x: line.left, y0: 0, y1: line.height }` → compute `const offsetY = this.paragraphVerticalOffset()` and return `{ x: line.left, y0: offsetY, y1: offsetY + line.height }` |
| 364–368 | `getCaretRect` rect branch | compute `const offsetY = this.paragraphVerticalOffset()` after the destructure and return `y0: top + offsetY, y1: bottom + offsetY` |
| 383–386 | `getSelectionRects` | compute `const offsetY = this.paragraphVerticalOffset()` before `rects.map` and return `y: top + offsetY` |

**Import to add** to `packages/core/src/text/editor.ts`, in the existing relative-import group alongside
`import { resolveNodeTextDirection } from './direction'` (line 8):

```ts
import { computeTextParagraphY } from './vertical-align'
```

**Import to add** to `packages/core/src/canvas/scene.ts`, in the `#core/*` group with lines 9–11:

```ts
import { computeTextParagraphY } from '#core/text/vertical-align'
```

### Banned List

- No `caretIndex` getter, and no other upstream API not required by this defect.
- No change to `packages/core/src/canvas/overlays/text-edit.ts`.
- No change to any file under `packages/vue/src/canvas/text-edit/` or
  `packages/vue/src/canvas/transform-input/`.
- No change to `packages/scene-graph/`.
- No horizontal-alignment term anywhere (Open Decision 1).
- No entry added to `packages/core/src/text/index.ts` — import the new module by deep path.
- No renaming inside `text/editor.ts`. Upstream's diff also renames locals `isRtlStart`/`isLtrEnd` to
  `isRTLStart`/`isLTREnd` (lines 290–292) as part of a repo-wide acronym convention OpenPotlood has not
  adopted. Do not copy that; it would put unrelated churn in this diff.
- No reformatting, no comment rewriting, and no reordering of any method in `text/editor.ts`.
- No behaviour change when `textAlignVertical` is `TOP` — the offset must be exactly `0` and every existing
  test must pass untouched.
- No new npm dependency.

## Allowed Changes

- Create `packages/core/src/text/vertical-align.ts`.
- `packages/core/src/canvas/scene.ts` — delete the local `computeTextParagraphY` declaration, add the import.
  The three call sites stay byte-identical.
- `packages/core/src/text/editor.ts` — add one import, two private methods, and the seven substitutions above.
- Extend `tests/engine/text/editor.test.ts`.
- Create `tests/engine/text/vertical-align.test.ts`.

## Restrictions and Exclusions

An implementer who wants to cross one of these must stop and report instead.

- Do not change what is drawn, only where the editor reports its geometry. `scene.ts`'s three
  `computeTextParagraphY` call sites and `drawParagraph` call must be identical before and after.
- Do not touch the Design panel, the vertical-alignment control from T-047a, or any i18n dictionary.
- Do not add a Playwright visual snapshot. Text rendering snapshots in this repo are platform-specific
  (`*-openpencil-win32.png` / `*-darwin.png`) and a new pair would need generating on both platforms.
- Do not modify `tests/engine/render/canvas/text.test.ts`. If the extraction breaks it, the extraction is wrong.
- Do not build the desktop app, run the installer, or bump `package.json` /
  `desktop/tauri.conf.json` / `desktop/Cargo.toml`.
- Do not run `bun run check`, `bun run lint`, `bun run test`, or `bun run test:unit`.

## Implementation Steps

1. **Pre-flight.** Reread `packages/core/src/text/editor.ts` in full and `packages/core/src/canvas/scene.ts`
   lines 760–868. Confirm the seven edit anchors in the Visual Contract table still match. Record any drift in
   the execution report before editing.

2. **Create `packages/core/src/text/vertical-align.ts`** with exactly the contents in the Visual Contract.

3. **Edit `packages/core/src/canvas/scene.ts`.** Delete the `function computeTextParagraphY` declaration
   (currently 776–785) and add `import { computeTextParagraphY } from '#core/text/vertical-align'` to the
   `#core/*` import group. Do not touch lines 795, 858, 859 or 863.

4. **Edit `packages/core/src/text/editor.ts`.** Add the import; add `paragraphVerticalOffset()` and
   `paragraphY()` immediately after the constructor; apply the seven substitutions in the Visual Contract table
   exactly. Change nothing else.

5. **Create `tests/engine/text/vertical-align.test.ts`.** Match the header style of
   `tests/engine/text/editor.test.ts:1–7` — plain `import { describe, test, expect } from 'bun:test'`, no
   `@ts-nocheck`. Import `computeTextParagraphY` from `#core/text/vertical-align` and assert, building nodes as
   `{ height, textAlignVertical } as SceneNode`:
   - `TOP` with height `100`, content `20` → `0`;
   - `CENTER` with height `100`, content `20` → `40`;
   - `BOTTOM` with height `100`, content `20` → `80`;
   - `CENTER` with content taller than the box (height `20`, content `100`) → `0`, not a negative number;
   - `BOTTOM` with content taller than the box → `0`;
   - `CENTER` with content exactly equal to the height → `0`;
   - an odd remainder (height `101`, content `20`, `CENTER`) → `40.5`, proving the result is not rounded.

6. **Extend `tests/engine/text/editor.test.ts`.** Keep the existing header, `mockCk`, `createEditor` and
   `editorState` helpers byte-identical. Append a new
   `describe('vertical alignment offsets', …)` block with its own local fixture — do not modify the shared one.
   The fixture needs a mock renderer and a mock paragraph, following the shapes at
   `tests/engine/render/canvas/text.test.ts:34–39,45–80`:
   - a paragraph mock exposing `getHeight: () => 20`,
     `getGlyphPositionAtCoordinate: mock((x: number, y: number) => ({ pos: … }))` that records its arguments,
     `getRectsForRange: () => [{ rect: [10, 0, 12, 20] }]`, `getLineMetrics: () => [{ left: 0, height: 20 }]`,
     and `delete: () => undefined`;
   - a renderer mock exposing `fontGeneration: 1` and `buildParagraph: mock(() => paragraph)`, cast as needed;
   - a node built as `{ id: 'vtext', text: 'Hi', height: 100, textAlignVertical: 'CENTER' } as SceneNode`;
   - construct with `new TextEditor(ck)` where `ck` supplies
     `RectHeightStyle: { Max: 0 }` and `RectWidthStyle: { Tight: 0 }`, then `editor.setRenderer(renderer)` and
     `editor.start(node)`.

   Assert:
   - with `textAlignVertical: 'CENTER'`, height `100`, paragraph height `20` (offset `40`),
     `editor.setCursorAt(5, 45)` passes `y === 5` to `getGlyphPositionAtCoordinate`;
   - `editor.getCaretRect()` returns `y0 === 40` and `y1 === 60` for the rect branch;
   - with `textAlignVertical: 'TOP'`, `setCursorAt(5, 45)` passes `y === 45` unchanged and `getCaretRect()`
     returns `y0 === 0` — proving the `TOP` path is untouched;
   - with `textAlignVertical: 'BOTTOM'` (offset `80`), `getCaretRect()` returns `y0 === 80`;
   - an empty-text editor (`text: ''`) with `CENTER` returns `y0 === 40`, `y1 === 60` from the empty branch;
   - `getSelectionRects()` after selecting a range returns a rect whose `y` includes the offset;
   - `selectWordAt(5, 45)` passes `y === 5` through.

## Acceptance Criteria

- [ ] `computeTextParagraphY` exists in exactly one place, `packages/core/src/text/vertical-align.ts`, and is
      imported by both `canvas/scene.ts` and `text/editor.ts`.
- [ ] `tests/engine/render/canvas/text.test.ts` passes unmodified, proving the renderer's behaviour is
      byte-identical after the extraction.
- [ ] In a fixed-height text box set to Middle vertical alignment, clicking a glyph places the caret at that
      glyph, and the caret is drawn on the text rather than at the top of the box.
- [ ] The same holds for Bottom alignment.
- [ ] Double-click word selection and drag-to-extend selection hit the correct characters in Middle and Bottom
      boxes, and the selection highlight covers the visible glyphs.
- [ ] Up and Down arrow keys move the caret between lines correctly in a Middle-aligned multi-line box.
- [ ] An empty Middle-aligned text box shows its caret vertically centred.
- [ ] Top-aligned and auto-height text behave exactly as before, with a computed offset of `0`.
- [ ] No file under `packages/vue/`, `packages/scene-graph/` or `packages/core/src/canvas/overlays/` is in the
      diff.
- [ ] Nothing on the Banned List appears in the diff.
- [ ] All named gates below pass.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```bash
bun test tests/engine/text/vertical-align.test.ts tests/engine/text/editor.test.ts
```

### Final pre-completion gates — run once

```bash
bunx tsgo --noEmit
```

```bash
bun test tests/engine/text tests/engine/render/canvas
```

```bash
bunx oxlint -c oxlint.json packages/core/src/text/vertical-align.ts packages/core/src/text/editor.ts packages/core/src/canvas/scene.ts tests/engine/text/vertical-align.test.ts tests/engine/text/editor.test.ts
```

```bash
bunx playwright test tests/e2e/text --project=openpencil
```

`vue-tsc` is not required: no `.vue` file and no Vue package type surface changes. Run
`bunx vue-tsc --noEmit -p tsconfig.json` only if `tsgo` reports anything outside `packages/core`.

## Integration or Installed-Result Check

Browser only — no desktop build is authorised or needed. No Tauri config, Rust, icon, generated menu, or
`IS_TAURI`-only surface is touched.

```bash
bun run dev
```

At `http://localhost:1420`:

1. Drag a fixed-size text box roughly 400×200 and type three short lines. Set vertical alignment to Middle.
2. Click directly on a character in the middle line. The caret appears **on that character**, not above the
   text. Before this packet it appears near the top edge of the box.
3. Double-click a word in the bottom line — that word is selected, and the highlight sits over the visible
   glyphs.
4. Drag across two lines; the highlight tracks the pointer over the real text.
5. Press Up and Down repeatedly; the caret walks the lines and does not jump to the first or last line.
6. Switch the box to Bottom alignment and repeat observations 2–5.
7. Delete all the text with the box still Middle-aligned; the blinking caret sits vertically centred in the box.
8. Switch to Top alignment and confirm every one of the above behaves exactly as it did before the change.
9. Resize the box taller while editing a Middle-aligned box; the caret stays on the text as the paragraph
   recentres.
10. Non-regression: a Top-aligned auto-height text box created with a single click still edits normally.

## Stop Conditions

Stop and report instead of improvising if:

- moving `computeTextParagraphY` out of `scene.ts` breaks any assertion in
  `tests/engine/render/canvas/text.test.ts` — that means the extraction is not behaviour-preserving;
- importing `#core/text/vertical-align` from `canvas/scene.ts` produces a circular-import warning at build or
  test time, contradicting the cycle analysis in Verified Starting State;
- `this.paragraphNode` proves to be stale (a resize or alignment change mid-edit does not move the caret),
  contradicting the in-place mutation fact recorded from `packages/scene-graph/src/index.ts:368`;
- the caret is correct but hit testing is not, or vice versa, indicating a second offset applied somewhere
  outside `TextEditor`;
- the work appears to require editing `drawTextEditOverlay`, any `packages/vue/` file, or any file outside
  Allowed Changes.

## Execution Report Contract

Record: every changed/created file with its role; the seven substitution sites with their final line numbers;
confirmation that `scene.ts`'s three call sites and `drawParagraph` line are byte-identical; the exact commands
run with exit codes and test counts; confirmation that `tests/engine/render/canvas/text.test.ts` passed
unmodified; the ten browser-check observations above with pass/fail each, explicitly including the Top-alignment
non-regression; any Banned List item crossed and its justification; and any remaining gap.

## Status record

Expansion receipt — 2026-08-24, revision 1. Expanded against the live tree under `App/`; every path, symbol,
line number, test helper and script command in this packet was read from source during expansion. No file under
`App/` was modified. The upstream resource `Toolbox/open-pencil-master (1)` was read for comparison only and is
non-authoritative; its private-method duplication of the offset formula and its unrelated `caretIndex` and
acronym-renaming changes were deliberately **not** copied (Fixed Decision 1 and the Banned List). Execution
evidence goes here after the packet runs; step status stays in `Plan/plan.md`.
