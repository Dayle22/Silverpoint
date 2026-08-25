# T-068a - Property-transfer model and clipboard

Task ID: T-068a
Packet state: Ready
Depends on: none
Related: T-068b, T-068c
Delivery: named source gates + browser check
Execution size: 2 new core/app modules; 1 unit test; no menu or component work

## Intended Outcome
Provide one pure transferable-property contract and one app-owned clipboard that copies/pastes applicable properties as a single undo transaction.

## Verified Starting State
- `packages/scene-graph/src/index.ts:47-56,411-412` removes stale fill/stroke bindings during `updateNode`.
- Exact pure APIs: `extractTransferableProperties(node: SceneNode): CopiedProperties` and `applicablePropertiesFor(sourceType: NodeType, targetType: NodeType, payload: CopiedProperties): Partial<SceneNode>`.
- Exact clipboard state: `const copiedRef = shallowRef<CopiedProperties | null>(null)` plus readonly/computed exports and `copySelectionProperties(store)`, `pastePropertiesToSelection(store)`.

## Allowed Changes
New `packages/core/src/editor/properties/transfer.ts`, its barrel export, new `src/app/editor/property-clipboard.ts`, and `tests/engine/editor/properties/transfer.test.ts`.

## Restrictions and Exclusions
No menu schema, shortcuts, context menu, i18n, UI, position/size/name/rotation transfer, or cross-document node copying.

## Implementation Steps
1. Implement the pinned property groups from the former T-068 contract with fresh clones and container/typography gating.
2. Implement module-singleton copy/paste; skip locked targets, carry image bytes, paste raw colours without stale variable bindings, and batch all targets into one undo.
3. Add exact banned-key, deep-copy, group-gating and single-undo unit cases with the Bun test header.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/editor/properties/transfer.test.ts`

### Final pre-completion gates — run once
Focused Oxlint, `bunx tsgo --noEmit`, root Vue type check, and a browser console smoke call of the exported clipboard functions.

## Stop Conditions
Stop on copied geometry/identity fields, stale bindings, cross-document image loss, or multiple undo entries.

## Execution Report Contract
Report exact key groups, exclusions, undo evidence, tests and exits.

## Status record
2026-08-20 — First executable slice of former T-068.
