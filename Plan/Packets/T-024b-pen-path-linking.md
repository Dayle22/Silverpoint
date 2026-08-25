# T-024b - Pen endpoint linking

Task ID: T-024b
Packet state: Done
Depends on: T-024
Related: T-024c
Delivery: named source gates + browser check
Execution size: 2 core files; 2 existing test files; one pen-input responsibility

## Intended Outcome
Clicking another open vector endpoint while the Pen tool is idle resumes that path; doing so mid-draw joins the active path to it. One completed link is one undo step.

## Verified Starting State
- `packages/vue/src/canvas/pen-input/use.ts:53-73` — `hitTestContinueEndpoint()` currently excludes foreign endpoints while a pen state exists.
- `src/app/editor/pen/create.ts:37-57` — `penResumeFromEndpoint(nodeId: string, endpointVertexIndex: number): void` is the existing idle continuation seam.
- Exact app-level bridge used by the Vue input layer:
  ```ts
  type PenLinkEditor = Partial<{
    penResumeFromEndpoint: (nodeId: string, endpointVertexIndex: number) => void
    penLinkToEndpoint: (nodeId: string, endpointVertexIndex: number) => void
  }>
  ```

## Allowed Changes
- `packages/vue/src/canvas/pen-input/use.ts`
- `src/app/editor/pen/create.ts`
- `tests/engine/vector/pen-actions.test.ts`
- `tests/e2e/tools/pen.spec.ts`

## Restrictions and Exclusions
No overlay drawing, close icon, new stored schema, new dependency, build, install or version bump. T-024c owns the close icon.

## Implementation Steps
1. Widen `hitTestContinueEndpoint()` to allow foreign endpoints whenever the active tool is `PEN`; keep closed vectors and interior vertices rejected.
2. Add `penLinkToEndpoint(nodeId: string, endpointVertexIndex: number): void` beside `penResumeFromEndpoint`, reusing `absoluteVertices`, `cloneSegments` and `walkChainOrdered`; merge ordered vertices/segments into the active `penState` and preserve valid segment indices.
3. Dispatch resume when no pen state exists and link when it does; make `penCursor()` return `CONTINUE_CURSOR` for the same hit.
4. Extend the named unit and Playwright files. Use their existing `@ts-nocheck`/Oxlint headers unchanged.

## Acceptance Criteria
- [x] Idle endpoint continuation still works.
- [x] Mid-draw foreign endpoint linking produces one valid vector network and one undo step.
- [x] Closed paths, interior vertices and self-invalid links remain rejected.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/vector/pen-actions.test.ts`

### Final pre-completion gates — run once
Run focused Oxlint on the two source files; `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json`; `bunx tsgo --noEmit`; `bunx playwright test tests/e2e/tools/pen.spec.ts --project=openpencil`; then `bun run dev` and browser-check resume, link, undo and cursor behaviour.

## Stop Conditions
Stop on invalid segment indices, more than one undo entry, path data loss, or drift in the named seams.

## Execution Report Contract
List changed files, exact test counts/exits, linked network counts before/after, undo evidence and remaining gaps.

## Status record
2026-08-20 — Executed packet T-024b.
- Widened `hitTestContinueEndpoint` in `packages/vue/src/canvas/pen-input/use.ts` to allow foreign open endpoints when `activeTool === 'PEN'`.
- Added `penLinkToEndpoint` in `src/app/editor/pen/create.ts` merging ordered vertices and shifted segments into active `penState` and committing.
- Dispatched resume on idle click and link on mid-draw click in `startPenInput`, with `penCursor` returning `CONTINUE_CURSOR`.
- Extended unit tests in `tests/engine/vector/pen-actions.test.ts` (22/22 tests passing).
- Extended Playwright tests in `tests/e2e/tools/pen.spec.ts` (9/9 tests passing).
- Verification gates passed: `bun test` exit 0, `bunx vue-tsc` exit 0, `bunx tsgo` exit 0, `bunx oxlint` 0 errors/warnings, `playwright test` exit 0.

