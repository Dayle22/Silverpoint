# T-078 — Pen-to-select deselection

Task ID: T-078
Packet state: Done
Depends on: T-024 (Done)
Related: T-024b/T-024c (pen endpoint linking; untouched by this fix)

## Intended Outcome

After using Pen and returning to Select with `V`, clicking blank canvas deselects objects normally — exactly as a fresh Select tool does. Switching tools through any route (keyboard shortcut, toolbar click) leaves no stale node-edit state that intercepts Select input.

## Verified Starting State

Read from the live tree on 2026-08-21.

- `App/src/app/shell/keyboard/registry.ts:59-69` (`bindToolShortcuts`) binds every `TOOL_SHORTCUTS` entry (`App/packages/core/src/editor/tool-registry.ts:26-35`; `KeyV: 'SELECT'`, `KeyP: 'PEN'`) to `options.store.setTool(tool)`.
- `App/packages/vue/src/primitives/Toolbar/ToolbarRoot.vue:18-21` — every toolbar tool click calls `editor.setTool(tool)` through the same injected editor.
- `App/src/App.vue:14-15` calls `provideEditor(store)` where `store = useEditorStore()`. Every `useEditor()`/`store` reference in the app (toolbar, keyboard registry, `GradientEditor.vue:46`, `FramePresetPopover.vue:59,156`) is this **one** object, so `editor.setTool` and `store.setTool` resolve to the same function.
- `App/src/app/editor/session/create.ts:52-61` builds that object as `{ ...editor, state, ..., ...modules }`. `modules` is `createEditorStoreModules()` (`App/src/app/editor/session/modules.ts:52-96`), which spreads `...pen` (from `createPenActions`, `App/src/app/editor/pen/create.ts`) into the returned object. `pen.setTool` is therefore the **only** `setTool` on the final store — there is no other definition further down the spread chain to override it.
- `App/src/app/editor/pen/create.ts:13-19` — the app-level `setTool`:
  ```ts
  function setTool(tool: Tool) {
    if (state.penState && tool !== 'PEN' && tool !== 'HAND') {
      editor.penCommit(false)
    }
    editor.setTool(tool)
  }
  ```
  It only ever inspects `state.penState`. It has no reference to `state.nodeEditState` at all — the `state: PenState` parameter is typed as `EditorState` (`App/src/app/editor/pen/resume.ts:4`, `export type PenState = EditorState`), which does not declare `nodeEditState`; that field only exists on the wider `AppEditorState` (`App/src/app/editor/session/types.ts:28-42`) that `createEditorStoreModules` actually holds.
- `App/packages/vue/src/shared/input/select.ts:35-39` (`handleSelectDown`) — the very first check on every Select-tool pointer-down:
  ```ts
  if (getNodeEditState(editor)) {
    handleNodeEditDown(e, cx, cy, editor, setDrag)
    return
  }
  ```
  This is the interception point. If `editor.state.nodeEditState` is still set when Select resumes, every click — including a blank-canvas click — is routed to `handleNodeEditDown` (`App/packages/vue/src/shared/input/node-edit/index.ts:39-129`) instead of the normal Select path.
- `handleNodeEditDown`'s no-hit branch (`index.ts:119-128`) only clears `es.selectedVertexIndices`/`es.selectedHandles` and starts a `marquee` drag. It never calls `editor.clearSelection()`, so the originally-selected object stays selected.
- The marquee itself is also neutralised while stale state persists: `App/packages/vue/src/canvas/transform-input/marquee.ts:22-24` (`handleMarqueeMove`) returns immediately — skipping the normal object hit-test loop — whenever `editor.state.nodeEditState` is set, and `handleMarqueeUp` (`marquee.ts:51-67`) resolves the drag purely against `es.vertices`, never against `editor.state.selectedIds`. So a blank-canvas drag under stale node-edit state neither deselects nor marquee-selects any scene object.
- Node-edit mode is entered by `App/packages/vue/src/canvas/text-edit/input.ts:128-130` on a plain (tool-independent) canvas `dblclick` on any `VECTOR` node: `nodeEditEditor.enterNodeEditMode?.(hit.id)`. It is reachable while Pen is the active tool (Pen's own `startPenInput`, `App/packages/vue/src/canvas/pen-input/use.ts:145-149`, checks `editor.state.nodeEditState` first and reroutes into node-edit handling instead of drawing) — this is how the T-024 "segment-gated vertex insertion" feature works, and it is the exact route by which `nodeEditState` gets set during a Pen session.
- `App/src/app/editor/vector-edit/lifecycle.ts:78-103` (`exitNodeEditMode(commit)`) is the existing, already-correct cleanup routine: commits live vertex/handle edits into the node (`applyNodeEditToNode`, a direct `graph.updateNode`, no undo push of its own) and sets `state.nodeEditState = null`. It is already called by the two other exit routes — `App/src/app/shell/keyboard/actions.ts:39-41` (`confirmOrEnterText`, Enter) and `actions.ts:57-60` (`escapeOrDeselect`, Escape) — but **not** by the direct tool-shortcut/toolbar route.
- `App/src/app/editor/vector-edit/create.ts:10-48` (`createVectorEditActions`) exports `exitNodeEditMode: (commit: boolean) => void` alongside the rest of the node-edit API. `App/src/app/editor/session/modules.ts:61` already builds `const vectorEdit = createVectorEditActions(editor, graph, state)` from the same `state` object passed to `pen`.

## Root Cause

`store.setTool()` (`App/src/app/editor/pen/create.ts:14-19`) is the single seam every tool-switch route in the app calls, but it only commits an in-progress Pen path (`state.penState`). It never exits node-edit mode. If node-edit mode was entered during a Pen session (double-click a vector while Pen is active — a supported, intentional T-024 interaction) and the user then presses `V`, `state.nodeEditState` survives the switch to Select. `handleSelectDown`'s node-edit intercept (`select.ts:36`) then swallows every subsequent Select pointer-down, including blank clicks, so neither the object selection nor a real marquee ever run.

## Fixed Decision

1. **Compose the final `setTool` in `App/src/app/editor/session/modules.ts`, not in `pen/create.ts`.** `pen/create.ts`'s `state` parameter is typed as `PenState` (`EditorState`), which does not declare `nodeEditState`, and the pen module has no reference to `vectorEdit.exitNodeEditMode`. `modules.ts` already holds both `pen` and `vectorEdit`, built from the same `AppEditorState`-typed `state`, so it is the correct composition point. Do not widen `PenState`'s type or import `vectorEdit` into `pen/create.ts` — that would create a mutual-dependency smell between two independent modules for no benefit.
2. **New `setTool` exits node-edit mode first, with `commit = true`, before delegating to the existing Pen-aware `setTool`.** This mirrors the exact commit-then-continue pattern already used by `escapeOrDeselect`/`confirmOrEnterText` (`keyboard/actions.ts:39-41,57-60`), so behaviour stays consistent across every exit route instead of adding a second, divergent cleanup path.
3. **Unconditional on the target tool.** Do not special-case "stay in node-edit if switching to PEN" — there is no existing product behaviour that relies on node-edit mode surviving an explicit tool switch (Escape and Enter already exit it unconditionally), and leaving it conditional would reintroduce the same class of stale-state bug for a different tool pair.
4. **Do not touch `pen/create.ts`'s existing `state.penState` commit branch.** It is already correct for the Pen-commit case (confirmed above); this packet only adds the missing node-edit branch.

## Allowed Changes

- `App/src/app/editor/session/modules.ts` — add the composed `setTool` and make it win in the returned store object.
- `App/tests/e2e/tools/pen.spec.ts` — new focused tests only.

## Restrictions and Exclusions

- Do **not** change `App/src/app/editor/pen/create.ts`, `App/packages/vue/src/canvas/pen-input/use.ts`, or any T-024b/T-024c endpoint-linking/resume code (`penResumeOnPath`, `penResumeFromEndpoint`, `penLinkToEndpoint`). Their existing `editor.setTool('PEN')` calls are direct core calls, not through the composed wrapper, and are out of scope.
- Do **not** change `handleSelectDown`, `handleNodeEditDown`, or the marquee resolution in `marquee.ts`. The fix is to stop leaving `nodeEditState` stale, not to change how Select or node-edit consume it.
- Do **not** add a new keyboard binding, change `TOOL_SHORTCUTS`, or alter the `V`/`P` shortcuts.
- Do **not** make a blank click destructive beyond the existing `clearSelection()` behaviour a fresh Select tool already has.
- Do **not** run `bun run check`, `bun run test`, `bun run test:unit`, builds, installs, or version bumps.
- Do **not** run Git commands.

## Implementation Steps

1. **Pre-flight.** Re-open `App/src/app/editor/session/modules.ts` and re-confirm `pen`/`vectorEdit` are still built at their current lines and that `vectorEdit.exitNodeEditMode` and `pen.setTool` still exist with these signatures before editing.
2. **Add the composed `setTool`.** In `App/src/app/editor/session/modules.ts`:
   - Add `Tool` to the existing type-only import: `import type { Editor, Tool } from '@open-pencil/core/editor'`.
   - After `const profiler = createProfilerActions(editor)` and before the `return {` block, add:
     ```ts
     function setTool(tool: Tool) {
       if (state.nodeEditState) vectorEdit.exitNodeEditMode(true)
       pen.setTool(tool)
     }
     ```
   - In the returned object, add `setTool,` immediately after the `...vectorEdit,` line (after both `pen` and `vectorEdit` have been spread), so the explicit key overrides `pen.setTool` regardless of spread order.
3. **Extend `App/tests/e2e/tools/pen.spec.ts`.**
   - Add `getSelectedIds` to the existing `#tests/helpers/store` import (alongside `getPageChildren`).
   - Add the two tests below, placed after the existing `'Node edit by double-click...'` test.

   ```ts
   test('Switching from Pen to Select with V exits stale node-edit state and deselects on blank click', async () => {
     await editor.canvas.pressKey('v')
     await drawOpenTriangle(300, 300, 120)
     await editor.canvas.click(300, 300)
     await editor.canvas.waitForRender()

     // Enter node edit mode while Pen is still the active tool - this is the
     // exact route (T-024 segment-gated insertion) that leaves nodeEditState
     // set going into a tool switch.
     await editor.canvas.dblclick(360, 360)
     await editor.canvas.waitForRender()
     expect(await readNodeEditState()).not.toBeNull()
     expect(await getSelectedIds(editor.page)).toBe(1)
     const depthBeforeLeave = await readUndoDepth()

     // Leave via the V shortcut, not Escape/Enter - this is the route that
     // used to leave nodeEditState stale.
     await editor.canvas.pressKey('v')
     await editor.canvas.waitForRender()
     expect(await readNodeEditState()).toBeNull()
     // Exiting node-edit mode with no vertex edits pushes no undo entry,
     // matching Escape's existing behaviour.
     expect(await readUndoDepth()).toBe(depthBeforeLeave)

     // Blank-canvas click must deselect exactly as a fresh Select tool does.
     await editor.canvas.click(700, 700)
     await editor.canvas.waitForRender()
     expect(await getSelectedIds(editor.page)).toBe(0)
     editor.canvas.assertNoErrors()
   })

   test('Idle Pen tool to Select with V still deselects on blank click', async () => {
     await editor.canvas.pressKey('v')
     await drawOpenTriangle(600, 600, 80)
     await editor.canvas.pressKey('Enter')
     await editor.canvas.waitForRender()
     expect(await getSelectedIds(editor.page)).toBe(1)

     // Pen commit already returns to Select with nothing in progress; go back
     // to Pen (idle - no penState, no nodeEditState) and then to Select again,
     // matching the packet's "idle Pen state" acceptance case.
     await editor.canvas.pressKey('p')
     await editor.canvas.pressKey('v')
     await editor.canvas.waitForRender()

     await editor.canvas.click(950, 950)
     await editor.canvas.waitForRender()
     expect(await getSelectedIds(editor.page)).toBe(0)
     editor.canvas.assertNoErrors()
   })
   ```

## Acceptance Criteria

- [x] `App/src/app/editor/session/modules.ts` exports a `setTool` that exits node-edit mode (commit) before delegating to the existing Pen-aware `setTool`, and this is the function every store consumer resolves (`store.setTool`, `editor.setTool` via `provideEditor(store)`).
- [x] After entering node-edit mode during a Pen session and pressing `V`, `editor.state.nodeEditState` is `null`.
- [x] After that, clicking blank canvas clears `selectedIds` (size `0`) and behaves exactly as a fresh Select tool.
- [x] Exiting node-edit mode via the new path pushes no undo entry when no vertex edits were made, matching Escape's existing behaviour.
- [x] Idle-Pen → Select → blank click still deselects (no regression to the already-working case).
- [x] Escape and Enter's existing node-edit exit behaviour (`keyboard/actions.ts`) and the T-024b/T-024c endpoint-linking/resume flows are unchanged.
- [x] `tests/e2e/tools/pen.spec.ts` passes in full, including the two new tests.
- [x] No file outside `Allowed Changes` is modified.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```
bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil
```

### Final pre-completion gates — run once

1. `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil` — expect exit `0`, all tests including the two new ones green.
2. `bunx tsgo --noEmit --pretty false` — expect exit `0`.
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit `0`.
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/editor/session/modules.ts` — expect exit `0`.
5. Browser check: `cd App && bun run dev`. Draw and close a path with Pen, double-click it to enter node edit (confirm the Sharp/Smooth/Disjoint control appears), press `V`, then click blank canvas — confirm the object deselects and no console errors appear. Separately, press `P`, click twice, press `Enter` to commit, then `V` and click blank canvas — confirm it still deselects. Record what was observed.

## Stop Conditions

- Stop if `pen.setTool` or `vectorEdit.exitNodeEditMode` no longer exist at the cited signatures when re-read — the composition point has moved and must be re-verified before editing.
- Stop if entering node-edit mode via double-click no longer reaches `state.nodeEditState` while Pen is active — the reproduction path in this packet depends on that behaviour existing exactly as read.
- Stop and report if exiting node-edit mode on every `setTool` call is found to break an intentional workflow (e.g. a documented "keep editing the same path's nodes after switching tools" feature) not evidenced anywhere in the current source — none was found during expansion.

## Status record

2026-08-21 — Captured from the reported Pen-to-Select failure. Brief only: exact stale state and owner must be proven from the failing test before implementation.
2026-08-21 — Expanded to Ready. Traced the full seam: every tool switch in the app (`registry.ts` keyboard shortcuts, `ToolbarRoot.vue` toolbar clicks) resolves to one function, `App/src/app/editor/pen/create.ts`'s `setTool`, via `provideEditor(store)`. Confirmed it commits `state.penState` but never touches `state.nodeEditState`, and that `handleSelectDown`'s node-edit intercept (`select.ts:36`) plus the node-edit-aware marquee (`marquee.ts:22-24,51-67`) together explain the exact reported symptom: after Pen → node-edit (double-click, a supported T-024 interaction) → `V`, a blank click neither deselects nor marquees because both routes are captured by the stale `nodeEditState`. Fix composes the missing `exitNodeEditMode(true)` call in `App/src/app/editor/session/modules.ts`, the one place that already holds both the Pen and node-edit modules built from the same state object.
2026-08-24 — Executed. Composed `setTool` in `App/src/app/editor/session/modules.ts` checking `state.nodeEditState` and calling `vectorEdit.exitNodeEditMode(true)` before delegating to `pen.setTool(tool)`. Added e2e test coverage in `App/tests/e2e/tools/pen.spec.ts`. Verified all gates: `playwright` 11/11 passed (exit 0), `tsgo` clean (exit 0), `vue-tsc` clean (exit 0), `oxlint` 0 errors / 0 warnings (exit 0). Marked Done.
