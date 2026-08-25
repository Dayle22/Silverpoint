# T-047c - Blinking caret in a newly created text box

Task ID: T-047c
Packet state: Done
Depends on: T-047 (Done - drag-to-create text box)
Related: T-014 (text layout and web fonts - owns the text-editing session `startTextEditing` enters)

## Intended Outcome
When a new text box is created (click or drag with the text tool) and drops straight into editing, the text-input caret ("blinking | line") is visible and blinking immediately, the way it does in InDesign/Figma when you start typing.

## Current state (read from live source)
Architecture: **canvas-drawn caret**, not a DOM caret. `drawTextEditOverlay()` in `packages/core/src/canvas/overlays/text-edit.ts` draws it each frame from `editor.caretVisible` and `editor.getCaretRect()` (a `TextEditor` instance in `packages/core/src/text/editor.ts`).

The blink mechanism itself is already wired up correctly for every entry path:
- `createCaretBlink(store)` in `packages/vue/src/canvas/text-edit/editing.ts` toggles `store.textEditor.caretVisible` on a 530ms `useIntervalFn` and calls `store.requestRepaint()`.
- `useTextEditingSession()` in `packages/vue/src/canvas/text-edit/textarea.ts` `watch()`es `store.state.editingTextId` and calls `resetBlink()` (sets `caretVisible = true`, restarts the interval) whenever it becomes non-null - this fires for every path that sets `editingTextId`, including both text-box creation flows (`startTextTool` and `handleTextDrawUp` in `packages/vue/src/shared/input/draw.ts`, both of which call `editor.startTextEditing(nodeId)`). So blink timing itself is not the bug.

**Likely actual bug, found by reading `TextEditor.getCaretRect()`** (`packages/core/src/text/editor.ts` line 325): for empty text (`text.length === 0`), it reads `s.paragraph.getLineMetrics()` and **returns `null` if that array is empty** - which suppresses the caret entirely (no rect to draw), rather than falling back to a synthesized single-line rect. A freshly created text box always starts with `text: ''` (see `startTextTool`/`startTextDraw` in `draw.ts`, both do `editor.graph.updateNode(nodeId, { text: '' })`), so if the Skia/CanvasKit paragraph built for an empty string reports zero line metrics, the caret never renders until the user types the first character - which matches "new text box, no blinking cursor" exactly, while an existing box with text already in it would work fine (matches why this wasn't caught as a universal regression).

This is a hypothesis to confirm live, not yet proven - `getLineMetrics()`'s behavior for an empty paragraph depends on how `rebuildParagraph()` (same file, line 117) builds the CanvasKit paragraph; it may already include a placeholder line for empty text in which case the bug is elsewhere (e.g. `paragraph` itself still `null` at first paint because `rebuildParagraph` bailed early on `!this.renderer`).

## Contract
1. Reproduce first: `bun run dev`, create a text box (click or drag with text tool), and observe whether the caret blinks. If it already works, this packet closes as "already-working" per the brief's instruction - do not apply a speculative fix.
2. If confirmed missing: in `packages/core/src/text/editor.ts`, `rebuildParagraph()` (~line 117), check what CanvasKit returns for `getLineMetrics()` on an empty-text paragraph. If it's genuinely empty, either:
   - Fix `rebuildParagraph()` to ensure the built paragraph always has at least one line metric (may need to pass a single space or use the paragraph builder's own empty-line handling), or
   - Fix `getCaretRect()` to synthesize a caret rect for empty text from known values (font size / line height already available via `node`/`s`) instead of returning `null` when `metrics.length === 0`.
   Prefer whichever keeps `getCaretRect()`'s existing non-empty-text codepath untouched - this is a narrow gap-fill, not a rewrite.
3. If the real cause turns out to be `rebuildParagraph()` bailing on `!this.renderer` at `start()` time (paragraph stays `null` until the next `state` getter access) - confirm whether that access happens before the first paint, and only fix if it's actually visible as a missing-first-frame caret.

## Verification
- Create a new empty text box (click with text tool, and separately drag-to-create with text tool): caret blinks immediately without typing.
- Type a character, delete it back to empty while still editing: caret keeps blinking (this path already worked before any fix per the analysis above - must not regress).
- Existing non-empty text box, double-click to edit: caret still blinks (already-working path - must not regress).

## Status record
2026-08-21 - First brief, captured from user request.
2026-08-24 - Read live source: blink-interval/reset wiring is correct for all entry paths; found a concrete, plausible root cause in `TextEditor.getCaretRect()`'s empty-text branch returning `null` when line metrics are empty. Packet expanded with a reproduce-first contract since the hypothesis is unconfirmed against a running app; state set to Ready.
2026-08-24 - Executed and verified: updated getCaretRect() to synthesize empty-text caret, updated scene overlay check to overlays.textEditor?.isActive, added text editor unit tests. State set to Done.
