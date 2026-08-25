# T-084c - Canvas modifier feedback

Task ID: T-084c
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: **T-084b — hard execution dependency; feedback must describe landed behaviour, not promises**
Related: T-084a, T-084d
Prepared from: the 2026-08-24 tablet interaction discussion and Affinity-style requirement that hidden modifiers remain understandable
Expanded at: 2026-08-24 09:38 Africa/Johannesburg
Expanded against: `App/src/components/EditorCanvas.vue:50-96,170-206,249-300`, `App/src/components/canvas/SelectionActionBar.vue:59-88`, `App/packages/vue/src/i18n/messages/panels.ts:1-35`, `App/tests/e2e/canvas/selection-action-bar.spec.ts:1-148`, and the T-084a/T-084b contracts
Delivery: named source gates + browser check
Execution size: 2 core UI/message files; 1 new focused E2E file; one transient-feedback responsibility

## Intended Outcome

When a pen is active and eligible fingers are held, a small non-interactive badge at the top-centre of the canvas immediately states `Constrain`, `Duplicate`, or `Constrain + Duplicate`. It vanishes when modifiers or the pen are released and never blocks canvas input.

## Request Coverage

- Make one-/two-/three-finger modifiers discoverable and confirm that the app recognised the user's spare hand.
- Do not add a full command-controller puck, tutorial or tablet shell in this slice.

## Verified Starting State

| Path | Symbol / span | Binding use |
| --- | --- | --- |
| `src/components/EditorCanvas.vue` | `useCanvasInput` destructure (`78-96`), canvas area (`249-300`) | Exact mount and reactive source. |
| `src/components/canvas/SelectionActionBar.vue` | container classes (`60-63`) | Authoritative compact floating surface styling. |
| `packages/vue/src/i18n/messages/panels.ts` | `panelMessageDefaults` | Single-locale message source; no literal UI strings in the component. |
| `tests/e2e/canvas/selection-action-bar.spec.ts` | focused canvas overlay conventions | Use `getByTestId`, visibility and theme-loop conventions. |

## Read First

1. `src/components/EditorCanvas.vue:78-96,249-300`.
2. `src/components/canvas/SelectionActionBar.vue:59-88`.
3. `packages/vue/src/i18n/messages/panels.ts:1-35`.

## Fixed Decisions

1. Keep feedback inline in `EditorCanvas.vue`; a one-use component would add indirection without reuse.
2. Destructure T-084a's exact returned `penActive` and `inputModifiers` refs from `useCanvasInput`. Show only when `penActive.value && inputModifiers.value.touchCount > 0`; never infer pen state from drag type.
3. Exact labels: `modifierConstrain: 'Constrain'`, `modifierDuplicate: 'Duplicate'`, `modifierConstrainDuplicate: 'Constrain + Duplicate'` in `panelMessageDefaults`.
4. Position: `absolute top-3 left-1/2 z-20 -translate-x-1/2`; it stays screen-fixed, above the canvas and below dialogs/toasts.
5. It is `pointer-events-none`, `aria-live="polite"`, `aria-atomic="true"`, and has `data-test-id="canvas-modifier-feedback"` plus `data-modifier="constrain|duplicate|constrain-duplicate"`.
6. No persistent command-controller puck yet. That becomes a separate product decision only if real-device testing shows held fingers are uncomfortable.

## Visual Contract — binding

Exact badge classes, adapting the existing selection-action-bar surface:

```text
pointer-events-none absolute top-3 left-1/2 z-20 flex h-8 -translate-x-1/2 items-center rounded-lg border border-border/80 bg-panel/95 px-3 text-xs whitespace-nowrap text-surface shadow-lg backdrop-blur-md
```

Wrap it in the existing `Transition` pattern from `EditorCanvas.vue:271-281`: enter/leave `transition-opacity duration-150`, `opacity-0`. No hover, focus, selected, disabled, loading or overflow states apply because the surface is display-only. In all four themes it uses semantic tokens only.

### Banned List

- No literal colour, Tailwind palette colour, inline position style, new `tv()` recipe, new dependency, global CSS or `app.css` edit.
- No font size except `text-xs`; no radius except `rounded-lg`.
- No buttons, tooltips, tap target, gesture locking, tutorial copy or permanent HUD.
- Do not import from the T-057 mobile components; they are scheduled for removal.

## Allowed Changes

- `App/src/components/EditorCanvas.vue` — computed label plus the badge.
- `App/packages/vue/src/i18n/messages/panels.ts` — three labels only.
- New `App/tests/e2e/canvas/tablet-modifier-feedback.spec.ts`.

## Restrictions and Exclusions

- No input semantics, move logic, tablet shell, viewport breakpoint or PWA work.
- No changes to selection action bar positioning/content.
- No build/install/version/Git/plan-index changes.

## Implementation Steps

1. Reconcile T-084a/T-084b's landed returned refs and modifier names.
2. Add the three panel messages and a computed label in `EditorCanvas.vue` with an exhaustive mapping over `touchCount`/flags.
3. Mount the exact display-only badge inside `.canvas-area` immediately after the overlay canvas and before selection popovers.
4. Add the E2E file with the current E2E suppression header only if the adjacent live file at execution time has it; otherwise mirror `selection-action-bar.spec.ts`. Dispatch synthetic pen/touch contacts, assert all three labels/data attributes, release cleanup, pointer pass-through and four-theme visibility.

## Acceptance Criteria

- [ ] Feedback appears only for recognised modifiers during pen input.
- [ ] One/two/three contacts map to the three exact labels.
- [ ] Badge never receives pointer input or shifts canvas layout.
- [ ] Release clears it immediately.
- [ ] It remains legible in light, grey, dark and midnight themes.

## Verification

### Development loop — repeat as needed

From `App/`: `bunx playwright test tests/e2e/canvas/tablet-modifier-feedback.spec.ts --project=openpencil`

### Final pre-completion gates — run once

1. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
2. `bunx tsgo --noEmit --pretty false`
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/components/EditorCanvas.vue packages/vue/src/i18n/messages/panels.ts tests/e2e/canvas/tablet-modifier-feedback.spec.ts`
4. `bunx playwright test tests/e2e/canvas/selection-action-bar.spec.ts --project=openpencil`

## Integration or Installed-Result Check

Run `bun run dev`; exercise one/two/three modifier contacts during a pen drag, confirm immediate label changes, canvas movement beneath the badge and release cleanup. Repeat at tablet landscape and portrait viewport sizes. Real-device proof remains required for tablet acceptance.

## Stop Conditions

Stop if T-084b's behaviours differ from the label mapping, modifier state is not reactive/observable, the badge intercepts input, or implementation requires restoring T-057 mobile UI.

## Execution Report Contract

Report changed files, labels/data attributes observed, all theme evidence, pointer pass-through, exact gate exits and real-device gap.

## Status record

2026-08-24 — Added as a separate dependency-locked UI slice so the input packets remain bounded. `App/` and `Plan/plan.md` were not changed.
