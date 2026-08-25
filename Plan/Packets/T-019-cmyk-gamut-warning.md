# T-019 — Deliver CMYK gamut warnings

Task ID: T-019
Packet state: Done
Completed at: 2026-08-17
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-017 (document units — used only to label the print context; no geometry dependency)
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `packages/core/src/color/{management.ts,normalize.ts,okhcl.ts}`, `packages/core/src/editor/color-space.ts`, `package.json` dependency set, `tests/engine/color/`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Intended Outcome

The user can turn on an advisory print-gamut check. Colours in the document that are unlikely to reproduce in CMYK printing are listed and highlighted. Nothing in the artwork changes, and no export byte changes. The feature is labelled as an approximation, because that is what it is.

## The honest scope decision — read this first

This packet ships an **approximate, analytic** gamut check. It does **not** ship ICC colour management.

Revision 1 said: bundle a licence-clean ICC/CMYK profile or remain `BLOCKED`. That would leave the packet permanently blocked, because no ICC engine is in the dependency set and adding one is a much larger decision than this feature justifies. Since the output is advisory either way, revision 2 chooses the approximation and requires it to be labelled as such everywhere it appears.

If the user later wants true soft-proofing with a bundled profile, that is a new packet, not an amendment to this one.

## Verified Starting State

| Path | What is actually there |
| --- | --- |
| `packages/core/src/color/management.ts:1` | `import { converter, formatCss, formatRgb, inGamut, toGamut } from 'culori'`. |
| `packages/core/src/color/management.ts:27-31` | Module-level singletons: `toRgb`, `toP3`, `toDisplayableRgb`, `toDisplayableP3`, `isDisplayableRgb = inGamut('rgb')`, `isDisplayableP3 = inGamut('p3')`. **Copy this singleton pattern** — do not construct converters per call. |
| `packages/core/src/color/management.ts:16-23` | `ResolvedRenderColor` already carries a `clipped: boolean`. That is display-gamut clipping, **not** print gamut. Do not overload it. |
| `packages/core/src/color/management.ts:142-163` | `resolveNodeFillColor(...)` and `resolveNodeStrokeColor(...)` — the existing per-node colour resolution entry points. |
| `packages/core/src/editor/color-space.ts:9` | `DocumentColorProfileMode = 'assign' \| 'convert'` — existing assign/convert semantics. Proofing is a **third**, non-mutating mode and must not be folded into this type. |
| `packages/core/src/editor/color-space.ts:71` | `createColorSpaceActions(ctx)` — the action factory to extend. |
| `package.json` | `culori ^4.0.2` and `@types/culori ^4.0.1` present. **No ICC library, no `color.js`, no `lcms`.** |
| `tests/engine/color/` | `basic.test.ts`, `color-model.test.ts`, `okhcl/`, `solid-commit.test.ts` — existing colour test home. |

`culori` has no ICC profile support. Its `--device-cmyk` mode is a naive conversion with no profile behind it and must not be presented as a print gamut.

## Fixed Decisions — binding

**1. Approximate gamut model.** Create `packages/core/src/color/gamut.ts`. The check is: convert the colour to OKLCh (the codebase's existing intent space — see `okhcl.ts`), then test it against a **chroma ceiling curve** that approximates a coated offset CMYK gamut:

```ts
export type PrintGamutProfile = 'coated' | 'uncoated'
export interface GamutVerdict {
  inGamut: boolean
  excessChroma: number   // 0 when in gamut; how far past the ceiling otherwise
}
export function maxPrintChroma(l: number, h: number, profile: PrintGamutProfile): number
export function checkPrintGamut(color: Color, profile: PrintGamutProfile, tolerance: number): GamutVerdict
```

`maxPrintChroma` is a pure lookup-and-interpolate over a table committed in the same file: lightness in 11 steps (`L = 0.0, 0.1 … 1.0`) × hue in 12 steps (every 30°), values chosen once and documented in a comment as an approximation of coated stock. `uncoated` is the coated table scaled by a single documented factor. **The table is data, not a formula to be re-derived at runtime.**

This is deterministic, dependency-free, headless-safe and testable — the four properties that matter.

**2. Non-mutating, always.** Enabling the check must not write to the scene graph, the undo stack, `pluginData`, any paint, or any exported byte. There is a required test that hashes the graph and the SVG/PNG export before and after enabling the check and asserts both are unchanged.

**3. Advisory labelling is mandatory.** Every surface that shows a warning carries the word **Approximate**. The i18n default string is `Approximate print gamut — advisory only, not a colour-managed proof.` Do not soften it, do not shorten it to fit, do not show a warning anywhere that string cannot also be reached.

**4. Analysis is pure and separate from presentation.** Create `packages/core/src/color/gamut-analysis.ts`:

```ts
export interface GamutFinding {
  nodeId: string
  source: 'fill' | 'stroke' | 'effect' | 'text-fill'
  index: number             // paint index within that source
  color: Color
  excessChroma: number
}
export function analyzeGraphGamut(
  graph: SceneGraph, pageId: string, profile: PrintGamutProfile, tolerance: number
): GamutFinding[]
```

It walks the page subtree, reads fills, strokes, text-run fills and effect colours, and returns findings. It takes no editor, no renderer, no CanvasKit. It never mutates.

**5. Unsupported paints are reported, not guessed.** Gradients are checked **per stop**, and each out-of-gamut stop is a separate finding. Image paints are **not** checked at all — emit one `source: 'fill'` finding per image node with `excessChroma: -1`, meaning "not analysable", and present those in a separate "Not checked" list. Never present an unchecked image as in-gamut.

**6. Alpha is out of scope for the verdict.** Check the colour at full opacity. Report the node's alpha in the finding for context if convenient, but alpha must never change `inGamut`.

**7. Tolerance.** Default `0.01` in OKLCh chroma units, exposed as a fixed constant `DEFAULT_GAMUT_TOLERANCE`, not as a user control in this packet. Its purpose is to stop boundary colours flickering between states on tiny edits.

**8. Presentation.** One panel section listing findings grouped by node, with a count, and click-to-select on each row. Overlays on canvas are **out of scope** for this packet — a list is enough to prove the feature and carries no renderer risk. Enable/disable is app-level state (follow the `src/app/shell/canvas-grid.ts` `useLocalStorage` + normalize/load/save trio), not document state — a proofing preference is not part of the artwork.

## Restrictions and Exclusions

- No ICC profiles, no profile bytes, no profile download, no network access of any kind.
- No RGB→CMYK conversion, no "convert to print colours" action, no automatic correction, no "fix" button.
- No change to `assign` / `convert` semantics in `editor/color-space.ts`.
- No change to any exporter. T-021 owns production PDF.
- No claim of print accuracy, press match, or standards compliance in any string, comment or report.
- No canvas overlay, no renderer change, no CanvasKit work.

### Banned List — none of these may appear in the diff

- No new npm dependency.
- No use of culori's `--device-cmyk` mode anywhere.
- No per-call `converter()` / `inGamut()` construction — module-level singletons only, matching `management.ts:27-31`.
- No literal colour in the UI — semantic tokens only (`bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`). A swatch showing a *document* colour is the sole exception and must come from the finding's own `color`.
- No font-size class other than `text-xs` or `text-[11px]`.
- No radius other than `rounded-md` or `rounded-lg`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English — all eight locales, gated by `bun run check:i18n`.
- No mutation of `SceneNode`, `pluginData` or the undo stack from anything in this packet.

## Implementation Steps

1. Read `management.ts` in full, plus `okhcl.ts` to learn how the codebase converts a `Color` to OKLCh. Reuse that path; do not write a second conversion.
2. Create `packages/core/src/color/gamut.ts` with the chroma-ceiling table and the pure API from Fixed Decision #1.
3. Create `packages/core/src/color/gamut-analysis.ts` per Fixed Decision #4.
4. Export both from `packages/core/src/index.ts` in the existing style.
5. Add app-level enable/disable + profile selection state following `src/app/shell/canvas-grid.ts`.
6. Add the findings panel section. Reuse `PanelSection` and the existing list primitives under `src/components/properties/item-list/`; do not author a new list component if one fits.
7. Add i18n defaults and all eight locales, including the mandatory Approximate string.
8. Add `tests/engine/color/gamut.test.ts`: known-safe colours (mid-grey, muted navy, warm brown) pass; known-impossible colours (saturated cyan `oklch(0.7 0.28 200)`, pure `#00FF00`, saturated orange) fail; the ceiling table interpolates monotonically; hue wraps correctly at 0°/360°; tolerance suppresses a boundary flip; `uncoated` is never more permissive than `coated`.
9. Add `tests/engine/color/gamut-analysis.test.ts`: fixture graph with fills, strokes, a gradient with one bad stop, a text run and an image; assert the exact finding set, that the gradient yields one finding per bad stop, and that the image yields `excessChroma: -1`.
10. Add the non-mutation test required by Fixed Decision #2 — graph snapshot and SVG/PNG export bytes identical with the check on and off.
11. Add Playwright coverage in `tests/e2e/properties/`: enabling shows a count; a known bad fill is listed; editing that fill to a safe colour removes it from the list; disabling clears the panel; the Approximate string is visible.
12. Run, in this order, and paste exact exit codes:
    - `bunx tsgo --noEmit --pretty false`
    - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
    - focused `oxlint -c oxlint.json` on the changed files only
    - `bun run check:i18n`
    - `bun test ./tests/engine/color/`
    - the focused Playwright spec with `--project=openpencil`

    Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
13. Stop at source gates. No build, no install, no version bump.

## Acceptance Criteria

- [ ] Profile (`coated` / `uncoated`) and enable state are selectable and persist across reload as app preferences.
- [ ] Known out-of-gamut fixtures are listed with their node and paint source; known in-gamut fixtures are not.
- [ ] Gradient stops are checked individually; image paints are reported as not analysable, never as in-gamut.
- [ ] Graph hash and SVG/PNG export bytes are identical with the check on and off.
- [ ] The Approximate advisory string is present on every warning surface.
- [ ] The list updates after a colour edit and empties when disabled.
- [ ] Analysis functions are pure — no editor, renderer or CanvasKit import in `gamut.ts` or `gamut-analysis.ts`.
- [ ] Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: the OKLCh conversion path in `okhcl.ts` cannot be reused for arbitrary paints; effect colours are not reachable without a renderer; or a chroma-ceiling table cannot be made stable enough that ordinary editing does not flicker findings on and off.

Stop and ask the user, rather than deciding alone, if execution reveals that an approximate check would be actively misleading for their work — the alternative (bundled ICC profile) is a scope change they must authorise.

## Revision History

- Revision 1 — 2026-07-24: original expansion; required an ICC library or `BLOCKED`.
- Revision 2 — 2026-08-14: re-expanded against live `culori`-based colour management. Replaced the unreachable ICC requirement with a documented approximation plus mandatory advisory labelling, fixed the pure-analysis boundary, defined gradient/image handling, and removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (2026-08-17: OKLCh chroma ceiling table with coated/uncoated profiles and bilinear hue interpolation, non-mutating SceneGraph gamut analysis for solid fills, strokes, effects, gradients, and text runs; GamutSection with mandatory advisory label, finding badges, and node selection; tsgo, vue-tsc, focused oxlint, 66/66 color Bun unit tests, and Playwright gamut e2e green)
