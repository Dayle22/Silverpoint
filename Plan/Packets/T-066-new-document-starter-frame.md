# T-066 - Give a new document a starter frame and a remembered size

Task ID: T-066
Packet state: EXPANDED (ready; no blocking dependency)
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-027 (frame presets, Done). Coordinates with T-067, which focuses the frame this packet creates.
Prepared from: the user's 2026-08-17 beginner-audience review — "Smart defaults and presets", rated very high
Expanded at: 2026-08-17
Expansion route: JUDGED from the user's 2026-08-17 "fix the packets, and expand them"
Expansion note: written to be executable by a less capable model. The Fixed Contract and Banned List are binding, not advisory.

## The gap this packet closes

Verified in live source on 2026-08-17:

- `App/src/app/editor/session/create.ts:24` — `createEditorStore()` called without an `initialGraph` does `new SceneGraph()`, which yields **one page containing no frames**.
- `App/packages/core/src/editor/viewport.ts:83-84` — `zoomToFit()` reads `ctx.graph.getChildren(ctx.state.currentPageId)` and **returns early when `nodes.length === 0`**.

So a brand-new document opens as an empty infinite grid at whatever the default viewport happens to be, with no page rectangle, no frame, and nothing for the viewport to anchor on. There is nothing on screen that a non-technical user can recognise as "the thing I am designing".

This is the prerequisite for the whole "focused artboard" mechanism: **you cannot focus an artboard that does not exist.** T-067 fits and emphasises the frame; this packet makes sure there is one.

Opened documents are already handled — `fitCurrentPageToViewport()` in `App/src/app/document/io/browser.ts:19` already calls `zoomToFit({ animate: false })` on the open path (`dom.ts:53`). **Do not rebuild fit-on-open.** The gap is new documents only.

## Intended Outcome

Creating a new document produces a page containing exactly one empty frame at a sensible, remembered size, centred and fitted in the viewport. The frame is the obvious subject of the screen. Nothing about opening existing `.fig` files changes.

## Verified Starting State (2026-08-17)

| Path | Verified fact |
| --- | --- |
| `App/src/app/editor/session/create.ts:23-27` | `createEditorStore(initialGraph?)`. Without a graph: `new SceneGraph()`, then `createInitialAppEditorState(graph.getPages()[0].id)`. `editor.subscribeToGraph()` is called **only** when `initialGraph` is provided — note this before adding nodes at creation time. |
| `App/packages/core/src/editor/viewport.ts:82-88` | `zoomToFit()` early-returns on an empty page; otherwise `computeBounds(nodes)` → `zoomToBounds(...)`. `zoomToBounds` clamps zoom with `Math.min(viewW/w, viewH/h, 1)`, so it never zooms past 100%. |
| `App/src/app/document/io/browser.ts:19-22` | `fitCurrentPageToViewport()` = `await yieldToUI()` then `editor.zoomToFit({ animate: false })`. The `yieldToUI()` rAF wait exists because the viewport size is not known until after paint. **Any new fit call needs the same wait.** |
| `App/src/app/document/io/create.ts:42-76` | Wires `setViewportSize` / `fitCurrentPageToViewport` into the document IO actions. |
| `App/src/app/tabs` (via `src/app/shell/menu/use.ts:59`, `keyboard/registry.ts:114`) | `createTab()` is the new-document entry point, bound to `MOD+N` and `MOD+T` and to File ▸ New. |
| `App/packages/core/src/editor` exports | `FRAME_PRESETS`, `FramePresetDefinition`, `PresetGroup` exist from T-027. `DEFAULT_FRAME_FILL`, `DEFAULT_SHAPE_FILL`, `DEFAULT_FONT_FAMILY`, `DEFAULT_FONT_SIZE`, `DEFAULT_TEXT_WIDTH`, `DEFAULT_TEXT_HEIGHT` also already exist. **Shape, text and fill defaults are already implemented — this packet does not touch them.** |
| `App/src/components/Toolbar/FramePresetPopover.vue` | The existing preset chooser on the `FRAME` tool. Read it to reuse its preset source and naming; do not fork its list. |
| `App/src/app/shell/preferences.ts` | The versioned `useLocalStorage` + `normalise()` pattern to copy. |

## Fixed Contract

### The starter frame

- On `createTab()` — and **only** when no `initialGraph` is supplied, i.e. never on file open, import or duplicate — the new document's first page receives exactly **one** empty `FRAME` node.
- Its size comes from the remembered starter preset (below). It is positioned at origin `(0, 0)`.
- It uses the existing `DEFAULT_FRAME_FILL`. Do not invent a fill.
- Its name is the preset's own name from `FRAME_PRESETS`, matching what `FramePresetPopover.vue` shows. Do not hand-author names.
- The document must be created **clean**: no dirty flag, no undo entry. A user who makes a new document and closes it must not be prompted to save. Add the frame as part of document construction, before undo tracking and dirty tracking begin — not as a post-creation edit. Prove this with an explicit test on dirty state and undo depth.
- After creation, fit the viewport using the **same** `yieldToUI()`-then-`zoomToFit` sequence as the open path. Reuse `fitCurrentPageToViewport()` rather than writing a second fit.
- Selection after creation is **empty**. Do not leave the starter frame selected — a selected frame would trigger T-035's action bar and T-036's property row on an untouched document.

### The remembered preset

- New `src/app/shell/starter-frame.ts` holding a versioned record `{ version: 1, presetId: string }` under key `open-potlood:starter-frame`.
- Default `presetId` is the **A4 portrait** preset from `FRAME_PRESETS`. Rationale: `Plan/endgoal.md` states the intended direction is closing the gap between screen design and print production. If no A4 preset id exists in `FRAME_PRESETS`, stop — do not substitute a guess.
- Invalid JSON, wrong version, or a `presetId` not present in `FRAME_PRESETS` normalises to that default.
- Choosing a preset in the existing `FramePresetPopover.vue` writes it to this record, so the next new document starts at the size the user last actually used. This is the only write path; do not add a preferences UI in this packet.

## Banned List

- Do not add a frame when `initialGraph` is supplied. File open, `.fig` import, PDF import and tab duplication must be byte-identical to today.
- Do not create a dirty document or an undo entry.
- Do not leave the starter frame selected.
- Do not write a second zoom-fit path; reuse `fitCurrentPageToViewport()`.
- Do not modify `zoomToFit`, `zoomToBounds`, or anything in `packages/core/src/editor/viewport.ts`.
- Do not fork or re-author `FRAME_PRESETS`, preset names, or the popover's list.
- Do not change `DEFAULT_FRAME_FILL`, `DEFAULT_SHAPE_FILL`, `DEFAULT_FONT_FAMILY`, `DEFAULT_FONT_SIZE` or any other existing default — they already exist and are out of scope.
- Do not add a template picker, a new-document dialog, an onboarding tour, or a first-run experience.
- Do not add a runtime dependency. Do not edit `App/src/app.css`.
- Do not build, install or bump versions. This packet stops at source gates.

## Allowed Changes

New `src/app/shell/starter-frame.ts`; the starter-frame construction in the new-document path (`src/app/editor/session/create.ts` and/or `src/app/document/io/create.ts` and `src/app/tabs`, whichever proves to be the correct single seam); the preset-write call in `FramePresetPopover.vue`; typed i18n defaults and all locale JSON if any string is added; focused unit and Playwright tests.

## Excluded Scope

No templates or template picker. No new-document dialog. No canvas fit or out-of-frame emphasis (T-067). No shape, text, colour or effect defaults — they already exist. No swatch defaults (T-053). No capability switch (T-032), page strip (T-065), Focus (T-033) or Overview (T-034). No `.fig` schema, export, MCP, scene-graph or CanvasKit change. No mobile, dashboard, `showUI=false` or `?no-chrome` behaviour. No build, install or release work.

## Implementation Steps

1. Re-read the Verified Starting State rows. Establish the exact seam where a new document's graph is constructed, and confirm where undo and dirty tracking begin relative to it. **Stop and report if the frame cannot be added before tracking starts** — a dirty new document is a failed packet, not an acceptable trade.
2. Add `starter-frame.ts` with the versioned record. Unit-test default resolution, valid preset ids, corrupt JSON, version mismatch, and an unknown `presetId` falling back to A4 portrait.
3. Add the starter frame to the new-document path only, using the remembered preset, `DEFAULT_FRAME_FILL`, origin `(0,0)` and the preset's own name.
4. Fit the viewport by reusing `fitCurrentPageToViewport()`; leave selection empty.
5. Write the chosen preset from `FramePresetPopover.vue` into the record.
6. Add `tests/e2e/document/starter-frame.spec.ts`: a new tab contains exactly one frame at the expected size; the document is not dirty and undo depth is zero; selection is empty; the frame is fitted and visible in the viewport; `MOD+N`, `MOD+T` and File ▸ New all behave identically; choosing a preset then making another new document uses the new size; opening a `.fig` file adds no frame and is unchanged; corrupt storage falls back to A4 portrait; all four themes; narrow desktop width.
7. Run `bun test ./tests/engine/app/shell/starter-frame.test.ts`, `bunx tsgo --noEmit --pretty false`, `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`, focused Oxlint on touched paths, `bun run check:i18n`, and `bunx playwright test tests/e2e/document/starter-frame.spec.ts --project=openpencil` plus the existing document open/import specs. No umbrella checks and no build unless the user asks.

## Acceptance Criteria

- [ ] A new document contains exactly one empty frame at the remembered preset size, named from `FRAME_PRESETS`, at origin `(0,0)`.
- [ ] The new document is **not dirty**, undo depth is zero, and closing it prompts nothing.
- [ ] Selection is empty after creation, so no contextual surface appears on an untouched document.
- [ ] The frame is fitted and centred in the viewport via the existing fit path, not a second implementation.
- [ ] Choosing a frame preset changes the size of the next new document; corrupt storage falls back to A4 portrait.
- [ ] Opening, importing and duplicating documents are unchanged and add no frame.
- [ ] `viewport.ts` and every existing `DEFAULT_*` constant are untouched.
- [ ] Source gates in step 7 pass. No delivery is claimed without a separately authorised build.

## Verification and Evidence

Record the new document's node tree, frame bounds and name; dirty flag and undo depth immediately after creation; selection contents; the viewport zoom and pan after fit, with a screenshot showing the frame centred; `localStorage['open-potlood:starter-frame']` before and after choosing a preset; and a before/after node-tree diff proving a `.fig` open is unaffected. A dirty new document, a non-zero undo depth, a selected starter frame, or any change to an opened document's tree is a stop, not a cosmetic exception.

## Stop Conditions

Stop and return to planning if the frame cannot be added before undo/dirty tracking begins; if `FRAME_PRESETS` contains no A4 portrait entry; if `editor.subscribeToGraph()` not being called for a graph-less store prevents adding a node at construction time; or if the user wants a new-document dialog or template picker instead of a silent default.

## Assumptions

| Assumption | Reason | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| A4 portrait is the default starter size | `Plan/endgoal.md` names print production as the intended direction | The user's usual new document is a social or screen size | Change one default id, plus its test |
| One frame, not several | A beginner needs one obvious subject; more frames is a template, which is explicitly out of scope for now | The user wants a multi-frame starting point | That is templates — new packet |
| Remembered from the existing preset popover, with no new settings UI | The write path already exists and needs no new surface | The user wants an explicit preference in T-030's dialog | Add a control in T-030's dialog reading the same record |
| Starter frame is unselected | Otherwise T-035/T-036 surfaces appear on an untouched document | The user wants it pre-selected for immediate editing | One-line change; note the interaction with T-035/T-036 |

Outstanding questions: none. Templates, a new-document dialog, and multi-frame starts are all new scope.

## Revision History

- Revision 1 — 2026-08-17: first expansion. Verified that `new SceneGraph()` yields no frames and `zoomToFit()` early-returns on an empty page, establishing the real gap; recorded that `fitCurrentPageToViewport()` already handles opened documents so fit-on-open must not be rebuilt; confirmed shape/text/fill defaults already exist and removed them from scope.
