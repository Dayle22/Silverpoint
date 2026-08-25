# T-094b - Alt-hover measurement input and browser proof

Task ID: T-094b
Packet state: Prepared — dependency-locked until T-094a is Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-094a (must be Done)
Related: T-094 (scope map), T-010 (snap-guide E2E precedent), T-093 (canvas input)
Prepared from: T-094 revision 2 live-source expansion
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: `App/packages/vue/src/canvas/useCanvasInput.ts`, `App/packages/vue/src/shared/input/select/hover.ts`, `App/tests/{engine/e2e}`, `App/package.json`, and `App/playwright.config.ts`
Delivery: named source gates + browser check
Execution size: 2 core implementation files; 2 test files across 2 suites. Input wiring and proof only; all state/render work is T-094a.

## Intended Outcome

Turn T-094a's dormant measurement payload on only while Alt is held over a non-selected layer in Select mode, then clear it reliably on all exit paths. Prove the rendered readout appears and disappears in the browser.

## Request Coverage

> Draw temporary Figma-style distance readouts between the selection and an Alt-hovered layer.

This child supplies Alt-hover activation, clear behaviour, focused resolver evidence, and browser proof. It does not change the renderer or geometry.

## Verified Starting State

| Path | Symbol / span | Binding use |
| --- | --- | --- |
| `packages/vue/src/canvas/useCanvasInput.ts` | `handleSelectHover` 90-103 | Select mode derives ordinary `hoveredNodeId` via `updateHoverCursor` and stores auto-layout hover. Measurement must consume that result after this function returns. |
| `packages/vue/src/canvas/useCanvasInput.ts` | `onMouseMove` 527-541 | The no-drag branch has `MouseEvent.altKey`; add one measurement update after `handleSelectHover`. |
| `packages/vue/src/canvas/useCanvasInput.ts` | `onMouseDown` 457-504; `mouseleave` listener 682-687 | Clear the transient measurement before interaction begins and when pointer leaves. |
| `packages/vue/src/shared/input/select/hover.ts` | `updateHoveredNode` 112-126 | It guarantees `hoveredNodeId` is null for selected nodes; do not duplicate its scoped hit test. |
| `packages/vue/src/shared/input/select.ts` | `handleSelectDown` 23-94 | Alt-drag duplication is `createSelectionMoveDrag(..., e.altKey)` at 93. Leave it unchanged. |
| `tests/engine/vue/input/auto-layout-hover.test.ts` | fixture/test style 1-113 | Nearby resolver tests use `bun:test` with no suppression header. |
| `tests/e2e/canvas/frame-overlays.spec.ts` | setup/snapshot pattern 1-75 | Use `useEditorSetupWithClear('/?test&no-chrome&no-rulers')`, `waitForRender`, canvas screenshot, and `assertNoErrors()`. |
| `tests/e2e/snap/guides.spec.ts` | Linux guard 34-40 | The existing visual Alt-adjacent test skips Linux because X11 Alt handling interferes; use the same guard. |
| `package.json` | scripts 19-46 | Direct Bun, tsgo, vue-tsc, oxlint, Playwright, and `dev` commands are available. |

## Read First

1. `packages/vue/src/canvas/useCanvasInput.ts`: `handleSelectHover` (90-103), `onMouseDown` (457-504), `onMouseMove` (527-541), listener registrations (670-700).
2. `packages/vue/src/shared/input/select/hover.ts`: `updateHoveredNode` and `updateHoverCursor` (112-146).
3. `tests/e2e/canvas/frame-overlays.spec.ts`: fixture and direct store setup (1-75).
4. `tests/e2e/snap/guides.spec.ts`: Linux skip reasoning (34-40).

## Fixed Decisions

1. Add a local `updateDistanceMeasurement(altKey: boolean): void` inside `useCanvasInput`. It calls `editor.setDistanceMeasurement({ targetId })` only if `editor.state.activeTool === 'SELECT'`, `altKey`, `editor.state.selectedIds.size > 0`, and `targetId = editor.state.hoveredNodeId` is non-null and not selected. Otherwise it calls `editor.setDistanceMeasurement(null)`.
2. In the existing no-drag `onMouseMove`, call the helper immediately after `handleSelectHover`; ordinary hover state is therefore fresh first.
3. Clear measurement at the start of `onMouseDown`, in the existing `mouseleave` callback, and through `useEventListener(window, 'keyup', event => ...)` when `event.key === 'Alt'`. This makes release-without-pointer-movement clear immediately.
4. Do not clear or change `hoveredNodeId` on Alt release. Normal hover highlighting must remain; only the measurement payload clears.
5. Do not add a global keydown listener: mousemove provides Alt activation, and keyup alone closes the otherwise stale state.
6. Create `packages/vue/src/shared/input/distance-measurement.ts` as the pure, named resolver `resolveDistanceMeasurementTarget(activeTool: Tool, selectedIds: ReadonlySet<string>, hoveredNodeId: string | null, altKey: boolean): { targetId: string } | null`. It returns a target only under Fixed Decision 1 and has no editor mutation, DOM access, or hit testing. `useCanvasInput` calls it, then calls T-094a's setter. This keeps the composition root below its 260-line limit and gives the engine test a stable seam.

## Visual Contract — binding

There is no DOM component or CSS surface. The only visual result is T-094a's CanvasKit overlay: selection-colour screen-space lines and `drawRulerBadge` labels. T-094b must not restyle, layer, animate, or otherwise alter it.

### Banned List

- No literal colour, CSS, Vue template, component, font-size, radius, `tv()` recipe, icon, dependency, or global stylesheet.
- No canvas hit-test replacement, cursor styling change, or hover-highlight change.
- No new store/state: use T-094a's `editor.state.distanceMeasurement` and `editor.setDistanceMeasurement` only.

## Allowed Changes

- `packages/vue/src/canvas/useCanvasInput.ts`
- New `packages/vue/src/shared/input/distance-measurement.ts`
- New `tests/engine/vue/input/distance-measurement.test.ts`
- New `tests/e2e/canvas/distance-measurement.spec.ts`

## Restrictions and Exclusions

An implementer who wants to cross one must stop and report.

- T-094a must be present and type-correct first. Do not recreate its state, renderer types, overlay, unit formatter, or geometry.
- Do not alter Alt-drag duplication, Pen/node-edit/Shape Builder modifier semantics, selection hit testing, snap behaviour, document state, undo, preferences, or storage.
- Do not add persistent measure mode, a toolbar action, keyboard shortcut, panel, DOM accessibility element, CSS, dependency, package change, Git work, build/install, or desktop check.
- Do not run umbrella checks, builds, installs, package-manager commands, or snapshot updates.

## Implementation Steps

1. Pre-flight: reread T-094a's exact state setter contract and all Read First anchors. Stop if `editor.setDistanceMeasurement` is unavailable or its payload differs.
2. Modify `packages/vue/src/canvas/useCanvasInput.ts` only as Fixed Decisions 1-5 require. Preserve the existing event-listener mechanism (`useEventListener`) and all listener targets. Do not alter `handleSelectHover` or imports from `select/hover.ts`.
3. Create `packages/vue/src/shared/input/distance-measurement.ts` with the exact resolver signature in Fixed Decision 6. It accepts only the four inputs listed there, returns `{ targetId: string } | null`, and has no editor mutation, DOM access, or hit testing. Call it from the local input helper before `editor.setDistanceMeasurement(...)`.
4. Create `tests/engine/vue/input/distance-measurement.test.ts` using plain `bun:test` imports and no suppression header. Prove activation for Select+Alt+selection+unselected target and clearing for missing Alt, empty selection, non-Select tool, null target, and selected target.
5. Create `tests/e2e/canvas/distance-measurement.spec.ts` with exactly:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
   ```

   Use the `frame-overlays.spec.ts` fixture. Make two unrotated rectangles with a 40 px horizontal gap, select the first, hold Alt, move over the second, wait for render, screenshot; release Alt without pointer movement, wait, screenshot; assert buffers differ and `assertNoErrors()`. Assert no measurement before Alt, none after release, and none when hovering the selected rectangle. At the test start call `test.skip(process.platform === 'linux', 'Distance measurement Alt visual proof is skipped on Linux CI because X11 Alt handling interferes')`.
6. Run the development loop while editing. After both child source and tests are final, run all final gates once; then run the browser proof.

## Acceptance Criteria

- [ ] Only Alt-held Select-mode hover over a non-selected layer with a selection sets T-094a's payload.
- [ ] Releasing Alt without a pointer move clears the payload immediately while normal hover remains.
- [ ] Leaving canvas, starting a mouse interaction, switching tool, losing selection, or hovering selected/empty space leaves no measurement.
- [ ] Alt-drag still duplicates; all other modifier routes remain unchanged.
- [ ] The focused resolver test covers every activation/clear predicate.
- [ ] The browser test proves appearance and disappearance of the 40 px measurement without browser errors, with a Linux skip guard.

## Verification

### Development loop — repeat as needed

```powershell
cd App
bun test tests/engine/vue/input/distance-measurement.test.ts
```

### Final pre-completion gates — run once

```powershell
cd App
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false
bunx oxlint -c oxlint.json packages/vue/src/canvas/useCanvasInput.ts packages/vue/src/shared/input/distance-measurement.ts tests/engine/vue/input/distance-measurement.test.ts tests/e2e/canvas/distance-measurement.spec.ts
bun test tests/engine/vue/input/distance-measurement.test.ts tests/engine/render/canvas/measurement.test.ts
bunx playwright test tests/e2e/canvas/distance-measurement.spec.ts --project=openpencil
```

## Integration or Installed-Result Check

After final source gates, run `cd App && bun run dev`. At a desktop viewport, create two unrotated rectangles with a 40 px gap, select one, hold Alt and hover the other: observe a `40 px` annotation. Release Alt without moving and observe it vanish. Change document units to mm and observe an `mm` annotation. Confirm normal hover highlight and Alt-drag duplication still work. Browser proof only; no desktop delivery is authorised.

## Stop Conditions

- Stop if T-094a has not landed, lacks the setter, or its payload differs.
- Stop if `hoveredNodeId` becomes stale across key release in the browser; do not add a second hit-testing path.
- Stop if preserving the input file's composition-root line limit requires unrelated refactoring; report for a narrower follow-up.
- Stop if Alt automation is unreliable on a non-Linux project target; report the platform evidence rather than weakening the proof.

## Execution Report Contract

Report changed files, resolver predicate cases, source-gate exit codes, browser proof observations, Linux skip result, Alt-release evidence, and confirmation that duplication/normal hover stayed intact.

## Status record

2026-08-24 — Ready child created from T-094 revision 2. Execution evidence belongs here after implementation; `Plan/plan.md` remains authoritative for live status.
