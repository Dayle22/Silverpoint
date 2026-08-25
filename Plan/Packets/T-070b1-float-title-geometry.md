# T-070b1 - Float title geometry

Task ID: T-070b1
Packet state: Done
Depends on: T-070a
Related: T-070b2
Delivery: named source gates + browser check
Execution size: 4 panel-model files; 1 unit file; no component work

## Intended Outcome
Reserve 24 px for the future floating-window title bar and keep that handle height on-screen, without changing rendered UI.

## Exact Contract
Add `export const PANEL_FLOAT_TITLE_HEIGHT = 24`; include it in the float minimum-height invariant; replace `clampRectToOverlay()`'s literal `33` with the constant; export it from the barrel.

## Allowed Changes
`src/app/shell/panels/{types,containers,layout,index}.ts`; `tests/engine/app/shell/panels/containers.test.ts`.

## Restrictions and Exclusions
No Vue component, drag caller, schema version, drop target or E2E edit.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/app/shell/panels/containers.test.ts`

### Final pre-completion gates — run once
Focused Oxlint, `bunx tsgo --noEmit`, root Vue type check.

## Stop Conditions
Stop if T-070a is not Done or the named invariant/clamp seams drifted.

## Status record
2026-08-20 — Executed T-070b1: Added `PANEL_FLOAT_TITLE_HEIGHT = 24`, included it in float minimum-height invariant and `clampRectToOverlay`, exported from barrel, and updated tests in `containers.test.ts`. Verified with `bun test tests/engine/app/shell/panels/containers.test.ts` (30/30 pass), focused oxlint (0 errors, 0 warnings), `bunx tsgo --noEmit` (exit 0), and `bun run check:vue` (exit 0).
