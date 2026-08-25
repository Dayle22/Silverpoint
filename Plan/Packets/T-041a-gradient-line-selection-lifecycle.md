# T-041a - Gradient line selection lifecycle

Task ID: T-041a
Protocol version: 1.2
Packet revision: 1
Project goal link: `Plan/endgoal.md`
Depends on: T-041 (Done); the live on-canvas gradient-fill handle baseline verified below
Related: T-037 (progressive layer blur, explicitly excluded), T-062 (selection outline fidelity, separate scope)
Expanded against plan snapshot: `Plan/plan.md` last written 2026-08-20 10:31:02 +02:00
Expanded at: 2026-08-20 10:41:49 +02:00
Expansion route: Judged from the user's explicit lifecycle requirement and the live single-resolver architecture
Delivery: named source gates + browser check
Execution size: 1 core source file; 1 existing focused unit-test file; no component, schema or renderer-drawing changes

## How To Use This Packet

This packet is self-contained. Before execution, confirm the T-041a row in `Plan/plan.md` is still Ready and the live seams below have not materially moved. Implement only this repair, run the focused development loop before the final gates, close with the browser check, and update the plan row only after the evidence passes.

## Intended Outcome

The on-canvas gradient line belongs only to the sole currently selected object. Deselecting the gradient object, selecting a solid object, or creating a multi-selection removes the line immediately. Selecting another object with a visible gradient fill moves the line to that object instead of leaving the previous object's line behind.

The selected gradient object's line continues to remain visible after the picker closes, and an explicit picker edit continues to preserve its active colour-stop highlight while that same object remains selected.

## Why This Step Matters

The current resolver allows stale picker state to outrank the actual selection, so the canvas can show and hit-test controls for an object the user is no longer editing. The repair restores the editor's selection contract without introducing another watcher or duplicated overlay state.

## Request Coverage

User-reported defect:

> the gradient line doesnt disappear after selecting another object or deselecting the current object

This packet covers the on-canvas **gradient-fill** line and handles. It does not cover the visually similar progressive layer-blur ramp, whose state and input paths are separate.

## Expansion Research

### Verified live seams

| Path | Exact symbol or area | Verified role | Required treatment |
| --- | --- | --- | --- |
| `App/packages/core/src/canvas/overlays/gradient.ts:75-103` | `resolveGradientEdit()` | One shared resolver decides which gradient owns both the drawn overlay and the input target. Its explicit `edit` branch currently validates the stored node/fill but does **not** require `edit.nodeId` to remain selected, so it returns stale state before the selection fallback runs. | Make sole selection a prerequisite. Honour explicit edit state only when it belongs to that sole selected node; otherwise fall back to the selected node's first visible gradient fill. |
| `App/packages/core/src/canvas/renderer/pipeline.ts:89-100` | `gradientEdit: resolveGradientEdit(...)` | Every overlay render supplies the current graph, current `selectedIds` and stored `gradientEdit` to the resolver before `drawGradientHandles()`. | Keep the fix in the resolver; do not add filtering or drawing conditions in the pipeline. |
| `App/packages/vue/src/shared/input/gradient.ts:27-43` | `getGradientEdit()` | Canvas hit-testing and dragging call the same resolver, then reject stroke edits. | Do not add a second input-only guard; the shared resolver must keep drawing and interaction converged. |
| `App/src/components/fill-picker/GradientEditor.vue:25-50` | `watchEffect()`, `onScopeDispose()` | The picker writes explicit edit state, including `activeStopIndex`, and attempts to clear it as selection/component scope changes. UI disposal timing is not a safe canvas invariant. | Leave the component unchanged. Preserve its explicit edit metadata only while its node remains the sole selection. |
| `App/packages/core/src/editor/create.ts:112-121` | `setSelectedIds()` | Emits `selection:changed` when the selection changes. It deliberately owns general selection state rather than gradient policy. | Do not mutate or clear `gradientEdit` here; keep gradient validity local to the gradient resolver. |
| `App/packages/vue/src/canvas/surface/render-loop.ts:86-95` | selection subscription | Overlay-capable canvas layers schedule a render on `selection:changed`. | No repaint workaround, timeout or new event subscription is required. |
| `App/tests/engine/vue/input/gradient-cursor.test.ts:295-345` | `describe('resolveGradientEdit')` | Existing focused tests cover fallback selection plus solid, locked and multi-selection behaviour only when explicit edit state is `null`. They do not cover stale explicit state. | Extend this file with explicit-edit lifecycle regressions; do not create a second test file. |

### Reuse and research decisions

- Relevant installed skill: `manage-projects` protocol 1.2, used to hold the EXPANDER boundary and make the packet self-sufficient.
- Existing local pattern: `resolveGradientEdit()` is already the single policy seam for renderer and input. Extend it rather than clearing state from `setSelectedIds()`, watching selection in Vue, or patching `drawGradientHandles()`.
- Historical warning: T-041, T-048 and T-049 were expanded before the current on-canvas gradient-fill implementation existed and still say no such handle exists. That starting-state claim is stale; use the live T-041a seams above for this repair. Do not revise those neighbouring packets during execution.
- Dependencies or APIs: none. This is a pure TypeScript selection predicate over existing editor state.
- Discovery still impossible before execution: none.

### Fixed implementation contract

Within `resolveGradientEdit(graph, selectedIds, edit)`:

1. Return `null` unless `selectedIds.size === 1`.
2. Read that sole selected ID once and guard the iterator's possibly undefined value without a non-null assertion.
3. Consider explicit `edit` state only when `edit.nodeId === selectedId`. Retain the existing visible, unlocked, indexed-paint and `isGradientFill()` validation. Returning the original `edit` object must preserve `property` and `activeStopIndex`.
4. When explicit state is absent, stale, or invalid, inspect the sole selected node and retain the existing fallback to its first visible gradient **fill**.
5. Return `null` for a missing, hidden, locked, solid-only or multiply-selected target.

This ordering produces the required transition table:

| Current selection | Stored explicit edit | Result |
| --- | --- | --- |
| Same gradient object only | Valid edit for that object | Preserve the explicit edit and active stop. |
| Different gradient object only | Stale edit for old object | Ignore stale edit; use the new object's first visible gradient fill. |
| Solid object only | Stale edit for old object | `null`; no line and no gradient hit target. |
| Empty selection | Any old edit | `null`. |
| Multi-selection | Any edit | `null`. |

## Dependencies and Inputs

| Prerequisite | Required state | Verified evidence |
| --- | --- | --- |
| Live gradient overlay implementation | Present | `drawGradientHandles()` and `resolveGradientEdit()` exist in `App/packages/core/src/canvas/overlays/gradient.ts`; pipeline and input both consume the resolver. |
| Selection-triggered overlay repaint | Present | `render-loop.ts` subscribes applicable layers to `selection:changed`. |
| Focused gradient interaction tests | Present | `App/tests/engine/vue/input/gradient-cursor.test.ts` already exercises resolution, cursor, hit-test and drag behaviour. |

Required external inputs: none.

## Binding Constraints

- `App/` is the only live application workspace; `Toolbox/` is historical/supporting only.
- This is a private, local-only app. No publishing, Git workflow or external state change belongs here.
- Run only the named source gates and browser check. Do not build, install or version-bump for this packet.
- Preserve the single shared resolver so drawing and hit-testing cannot drift.

## Allowed Changes

- `App/packages/core/src/canvas/overlays/gradient.ts` — selection-gate `resolveGradientEdit()` and update its comment to state that explicit edit wins only for the sole selected node.
- `App/tests/engine/vue/input/gradient-cursor.test.ts` — extend the existing `resolveGradientEdit` coverage and, if useful, the existing cursor coverage using current helpers.
- `App/CHANGELOG.md` — one concise `Unreleased > Fixed` entry only if the current changelog convention requires user-visible repairs to be recorded.

## Restrictions and Exclusions

- Do not change `GradientEditor.vue`, `FillPicker.vue`, `setSelectedIds()`, selection events, the render loop, renderer pipeline or `drawGradientHandles()`.
- Do not clear `editor.state.gradientEdit` as a side effect of selection. The stored edit may remain dormant; resolution is the source of truth.
- Do not add a watcher, event listener, timeout, repaint call, store field or dependency.
- Do not change gradient geometry, transforms, stop colours/positions, active-stop drawing, cursor values, hit radii, drag commit/cancel or undo behaviour.
- Do not change stroke-gradient scope in T-048, curved-gradient scope in T-049, progressive-blur state/drawing, or T-062 selection outlines.
- Do not add a new E2E or snapshot file unless the existing focused unit seam proves unable to cover the lifecycle predicate; the browser check remains required.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, a build, install, version bump, package mutation or Git command.

## Implementation Steps

1. Re-read the T-041a plan row, this packet, `resolveGradientEdit()`, its pipeline and input consumers, and the existing `describe('resolveGradientEdit')` block. Stop on material drift or conflicting edits.
2. In `gradient.ts`, gate the resolver on exactly one selected ID before evaluating explicit edit state. Restrict the explicit branch to the selected node and preserve the existing validation and returned metadata.
3. Reuse that selected ID for the fallback branch. Keep fallback semantics unchanged: the first visible gradient fill of the sole selected node owns the handles.
4. In `gradient-cursor.test.ts`, add focused cases proving:
   - a valid explicit edit is preserved while its node remains solely selected, including `activeStopIndex`;
   - selecting another gradient node ignores the stale edit and resolves the new node's fill;
   - selecting a solid node with stale explicit state returns `null`;
   - clearing selection with stale explicit state returns `null`;
   - multi-selection with explicit state returns `null`;
   - the old node's handle is no longer hit/cursor-active after selection moves, if this can be asserted with the file's existing helpers without duplicating setup.
5. Add the bounded changelog line only if `Unreleased > Fixed` is present and user-visible repairs are consistently recorded there.
6. Run the development-loop test until green, then the final gates once. Fix only T-041a-caused failures.
7. Run `bun run dev` and perform the browser integration check below. Do not build or install.

## Acceptance Criteria

- [ ] A valid explicit gradient edit is returned only when its node is the sole selected node.
- [ ] Deselecting the edited gradient object removes its line and handle hit targets on the next selection-driven overlay render.
- [ ] Selecting a solid object removes the previous gradient line.
- [ ] Selecting another gradient object shows only that object's gradient line; the old explicit edit cannot override it.
- [ ] Multi-selection shows no gradient line even when explicit edit state remains stored.
- [ ] Closing the picker while retaining one selected gradient object still leaves that object's line visible through the existing fallback.
- [ ] Active-stop metadata is preserved for a valid explicit edit on the selected object.
- [ ] Gradient transform dragging, undo, Escape cancellation, cursor and radial/diamond second-axis behaviour remain unchanged.
- [ ] Progressive-blur handles and selection outlines are unchanged.
- [ ] No new state, watcher, dependency, broad gate, build, install or version change is introduced.

## Verification

Depth: **Test it properly** — this is a central canvas policy function whose stale result affects both visible controls and pointer input.

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop - repeat as needed

`bun test tests/engine/vue/input/gradient-cursor.test.ts`

Expected: exit 0; all existing gradient cursor/drag/geometry/highlight cases plus the new lifecycle cases pass.

### Final pre-completion gates - run once

1. `bun test tests/engine/vue/input/gradient-cursor.test.ts` — exit 0.
2. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/canvas/overlays/gradient.ts tests/engine/vue/input/gradient-cursor.test.ts` — exit 0.
3. `bunx tsgo --noEmit --pretty false` — exit 0.
4. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` — exit 0; the Vue input consumer of the core resolver still type-checks.

On failure: record the exact command, exit code and first relevant error. Correct T-041a changes only. Do not widen scope or weaken an assertion to make a failure green.

Needs human judgement: no. The browser observation is behavioural verification, not aesthetic approval.

## Browser Integration Check

After the named source gates, run `bun run dev` and use a normal desktop editor viewport:

1. Create two separated rectangles: one with a linear gradient and one solid. Select the gradient object and confirm its on-canvas line is visible.
2. Select the solid object. Confirm the old gradient line and its cursor/hit affordance disappear immediately.
3. Click empty canvas. Confirm no gradient line remains.
4. Give the second rectangle a different gradient. Alternate selection between both gradient objects and confirm the line moves to the sole selected object only.
5. Shift-select both objects. Confirm no gradient line is shown; return to one gradient selection and confirm its line returns.
6. Open the selected gradient's picker, choose a non-default stop, then select the other object without relying on the picker to close first. Confirm the previous line still disappears and no page error is logged.
7. Close the picker while leaving one gradient object selected. Confirm that object's line remains through the intended selection fallback.

Stop the dev server after the check. Browser proof is sufficient for this source-only repair; it is not installed-desktop proof.

## Assumptions

| Assumption | Why it is the reasonable default | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| The reported line is the gradient-fill overlay governed by `gradientEdit`, not the progressive layer-blur ramp. | The immediately preceding investigation identified the stale `resolveGradientEdit()` path, and the user authorised T-041a from that diagnosis. | Reproduction shows the line belongs to a progressive layer-blur effect. | Stop T-041a execution and expand a separate progressive-blur lifecycle repair; do not mix both state systems here. |
| A line should remain visible for one selected gradient object after its picker closes. | The current resolver comment and user wording object only to the line surviving selection change/deselection. | The desired product behaviour is picker-open-only. | Re-plan the fallback semantics; this packet intentionally preserves them. |
| Selecting a different gradient object should transfer the line to it. | Controls should follow the sole current selection, and the fallback already implements this when no stale explicit edit masks it. | The user wants no line until the new object's picker is opened. | Revise acceptance and fallback behaviour before execution. |

Outstanding questions: none.

## If an Input Is Missing

There are no asset or external-input dependencies. A missing/moved source or test seam is packet staleness, not a placeholder case; stop and return to expansion with the observed path.

## Stop Conditions

- Reproduction proves the lingering line is the progressive-blur ramp rather than the gradient-fill overlay.
- `resolveGradientEdit()` no longer feeds both drawing and input, or another active change is editing the same resolver/test block.
- Correct behaviour requires editing Vue picker lifecycle, selection state, render scheduling or renderer drawing rather than the verified resolver seam.
- Selection changes do not schedule the overlay render in the live app, contradicting the verified render-loop subscription.
- A named test or type/lint gate exposes a pre-existing failure outside T-041a; record it rather than repairing unrelated code.
- Browser verification still shows the old line after all resolver lifecycle assertions pass; capture the exact sequence and return the packet for audit rather than adding timing workarounds.
- Any implementation would cross the Restrictions and Exclusions.

## Execution Report Contract

Report:

- every changed file and the exact resolver predicate delivered;
- the added lifecycle cases and focused test count;
- all named commands, exit codes and relevant failures;
- browser observations for gradient to solid, deselect, gradient to gradient, multi-selection, picker-open selection change and picker-closed fallback;
- confirmation that picker, selection, render-loop, drawing, progressive-blur, dependency and version files were unchanged;
- any deviation or remaining gap;
- explicitly state that source/browser proof is not an installed desktop build.

## On Completion

1. Verify every acceptance criterion and capture the actual evidence.
2. Set only the T-041a row in `Plan/plan.md` to Done after the named gates and browser check pass.
3. Append the concise execution evidence under this packet's existing `## Status record`, following the current OpenPotlood convention; do not duplicate status wording there.
4. Stop. Do not begin another plan step from inside this packet.

## Revision History

| Revision | Date | Change | Plan snapshot |
| --- | --- | --- | --- |
| 1 | 2026-08-20 10:41:49 +02:00 | Initial expansion against the live gradient resolver, picker lifecycle, selection event/render loop and focused gradient interaction tests. | `Plan/plan.md` 2026-08-20 10:31:02 +02:00 |

## Status record

- 2026-08-20 — Packet created and expanded in planning-only EXPANDER mode. Chosen route: selection-gate the shared resolver so drawing and hit-testing remain converged; no `App/` source, test, dependency, version, build or installation change was made during expansion.
- 2026-08-20 — Executed. Sole selection gate applied to `resolveGradientEdit()` in `App/packages/core/src/canvas/overlays/gradient.ts`. Added explicit-edit lifecycle and hover cursor tests in `App/tests/engine/vue/input/gradient-cursor.test.ts` (19 pass). Pre-completion gates passed (oxlint 0 errors/0 warnings, tsgo exit 0, vue-tsc exit 0). Browser integration check verified on dev server (7 steps: gradient to solid, empty canvas deselect, gradient-to-gradient switch, multi-selection suppression, picker-open selection transfer, and picker-closed fallback). Changelog updated under Unreleased > Fixed. Status set to Done.
