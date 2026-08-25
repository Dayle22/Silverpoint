# T-020 — Deliver a DPI resolution inspector

Task ID: T-020
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-017 (document units and DPI)
Expanded at: 2026-08-14
Expanded against: live `App/` source read 2026-08-14 — `packages/core/src/canvas/fills.ts:318-400`, `packages/scene-graph/src/{images.ts,coordinate.ts,index.ts}`, `src/components/properties/`, `tests/engine/`
Expansion note: written to be executable by a less capable model. Fixed Decisions and the Banned List are binding, not advisory.
Delivery: **source gates only.** Do not build, install, or touch version files unless the user explicitly asks in the executing session.

## Intended Outcome

Selecting a node with an image fill shows the effective output resolution of that image — X DPI, Y DPI, and the minimum of the two — with an advisory warning when it falls below a threshold (default 300). The value updates immediately when the node is resized, the fill's scale mode changes, the image is replaced, the node is nested or transformed, or the document DPI changes.

## The technical crux — read this first

**Image pixel dimensions are currently only knowable from the renderer.** `fills.ts:384-385` gets them as `img.width()` / `img.height()` from a CanvasKit-decoded image held in `r.imageCache`. `packages/scene-graph/src/images.ts` contains exactly one function, `computeImageHash`, and nothing else. `graph.images` is a `Map<string, Uint8Array>` of **encoded** bytes (`scene-graph/src/index.ts:73`).

So a DPI inspector that depends on the renderer would be untestable headless and wrong whenever the image is not currently cached. Fixed Decision #1 resolves this with a pure header parser. Do not route the inspector through `SkiaRenderer`.

## Verified Starting State

| Path | What is actually there |
| --- | --- |
| `packages/scene-graph/src/index.ts:73` | `images = new Map<string, Uint8Array>()` — encoded bytes keyed by hash. |
| `packages/scene-graph/src/images.ts` | `computeImageHash(data: Uint8Array): string`. **That is the whole file.** |
| `packages/core/src/canvas/fills.ts:365-388` | `applyImageFill` — `fill.imageHash` → `graph.images.get(hash)` → `r.ck.MakeImageFromEncoded` → `r.imageCache`. `imgW = img.width()`, `imgH = img.height()`. |
| `packages/core/src/canvas/fills.ts:321-361` | `makeImageFillLocalMatrix` — the authoritative placement maths. `fill.imageScaleMode ?? 'FILL'`, values `FILL`, `FIT`, `CROP`, `TILE`; `CROP`/`TILE` additionally use `fill.imageTransform` (`m00,m01,m02,m10,m11,m12`). **Mirror this logic exactly; do not approximate it.** |
| `packages/scene-graph/src/coordinate.ts:5` | `getWorldMatrix(node, graph): Mat3` — resolves nested parent transforms. This is how absolute scale is obtained. |
| `packages/scene-graph/src/coordinate.ts:134` | `getNodeWorldBounds(node)`. |
| `packages/core/src/units/index.ts` | **Created by T-017.** `pxToUnit`, `DocumentUnits`, document DPI. |

## Fixed Decisions — binding

**1. Pure header parser, no decode.** Add to `packages/scene-graph/src/images.ts`:

```ts
export interface ImagePixelSize { width: number; height: number }
export function readImagePixelSize(data: Uint8Array): ImagePixelSize | null
```

It reads only the container header and returns `null` for anything it does not recognise:

| Format | Detection | Dimensions at |
| --- | --- | --- |
| PNG | `\x89PNG\r\n\x1a\n` | IHDR: big-endian u32 at byte 16 (width) and 20 (height) |
| JPEG | `\xFF\xD8` | scan segments for SOF0/1/2/9/10 (`\xFFC0`,`C1`,`C2`,`C9`,`CA`), height = u16 at +5, width = u16 at +7 |
| GIF | `GIF87a` / `GIF89a` | little-endian u16 at byte 6 (width) and 8 (height) |
| WebP | `RIFF`…`WEBP` | `VP8X` → 24-bit LE +1 at offsets 24/27; `VP8 ` → u16 at 26/28 masked `0x3FFF`; `VP8L` → 14-bit packed at 21 |

No new dependency. No CanvasKit. No `Image` element. Must be safe against truncated and hostile input: bounds-check every read, cap the JPEG segment scan at 1000 segments, and return `null` rather than throwing. **A malformed image must produce `Unknown`, never a crash and never a guess.**

**2. Effective DPI formula.** Add `packages/core/src/units/dpi.ts`:

```ts
export interface EffectiveDpi {
  x: number | null      // null === unknown
  y: number | null
  min: number | null
  sourceWidth: number | null
  sourceHeight: number | null
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE'
  belowThreshold: boolean
}
export function computeEffectiveDpi(
  graph: SceneGraph, nodeId: string, fillIndex: number, documentDpi: number, threshold: number
): EffectiveDpi
```

The calculation:

1. Resolve the node's **world scale** from `getWorldMatrix(node, graph)` — take `sx = hypot(m00, m10)`, `sy = hypot(m01, m11)`. Rotation must not affect DPI; taking the column lengths handles this correctly.
2. Compute the sampled source region for the scale mode, mirroring `makeImageFillLocalMatrix`:
   - `FILL` — `scale = max(node.width / imgW, node.height / imgH)`; sampled region is `node.width/scale × node.height/scale`.
   - `FIT` — `scale = min(node.width / imgW, node.height / imgH)`; full source is sampled.
   - `CROP` / `TILE` with `imageTransform` — the sampled region is the source rect implied by the inverse transform, exactly as `makeImageFillLocalMatrix` derives it.
   - `TILE` without `imageTransform` — one tile is drawn at source scale; DPI is `documentDpi / (sx)` against the source's own pixel density.
3. `dpiX = (sampledSourcePixelsX / (node.width * sx)) * documentDpi`, and the same for Y.
4. `min = Math.min(dpiX, dpiY)`; `belowThreshold = min < threshold`.

If `readImagePixelSize` returns `null`, every numeric field is `null` and `belowThreshold` is `false`. **Unknown is never a warning and never assumed to be 300.**

**3. Purity.** `computeEffectiveDpi` imports no renderer, no CanvasKit, no Vue. It is testable with a fixture graph and raw bytes alone.

**4. Threshold.** Default `300`. Stored as an **app-level** preference following `src/app/shell/canvas-grid.ts` (`useLocalStorage` + normalize/load/save), validated to an integer in `[1, 2400]`. Not document state — a review threshold is not artwork.

**5. Presentation.** A new `PanelSection` in the properties panel, visible only when the selected node has at least one image fill. Per image fill it shows `sourceWidth × sourceHeight px`, `X / Y / min DPI` (or `Unknown`), the scale mode, and the advisory warning row when below threshold. Multiple image fills on one node each get a row. Reuse `PanelSection` and existing list primitives under `src/components/properties/item-list/`.

**6. Advisory only, never corrective.** No resample, no upscale, no "fix resolution" action, no automatic replacement, no write to `graph.images`, no fill mutation. The inspector is read-only in every code path.

**7. Reactivity.** The value must recompute on: node resize, fill scale-mode change, `imageTransform` change, image replacement, reparenting, ancestor transform change, and document-DPI change. Derive it from the same reactive store state the other property sections read — do not add a watcher on the graph, and do not cache across selection changes.

## Restrictions and Exclusions

- No decoding of image pixel data for any reason.
- No change to `applyImageFill`, `makeImageFillLocalMatrix`, or any render path. Mirror the maths in a pure module; do not refactor the renderer to share it — that risks a live rendering regression for a read-only feature.
- No export policy change, no PDF work (T-021), no CMYK (T-019).
- No new image format support, no image import changes.
- No `MobileHud/`, dashboard, `showUI=false` or `?no-chrome` changes.

### Banned List — none of these may appear in the diff

- No new npm dependency.
- No `MakeImageFromEncoded`, `createImageBitmap`, `new Image()`, `canvas.getContext`, or any decode call in the new code.
- No import of `SkiaRenderer`, `canvaskit-wasm`, or anything under `packages/core/src/canvas/` from `dpi.ts`.
- No default of `300` substituted for unknown source dimensions.
- No literal colour — semantic tokens only (`bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `text-accent`).
- No font-size class other than `text-xs` or `text-[11px]`.
- No radius other than `rounded-md` or `rounded-lg`.
- No `@apply`, no new global CSS, no edits to `src/app.css`.
- No hardcoded English — all eight locales, gated by `bun run check:i18n`.
- No mutation of `graph.images`, any `Fill`, or the undo stack.

## Implementation Steps

1. Read `fills.ts:318-400` in full. Write the scale-mode sampling maths down before coding — it is the part most likely to be got wrong.
2. Implement `readImagePixelSize` in `packages/scene-graph/src/images.ts`.
3. Implement `computeEffectiveDpi` in `packages/core/src/units/dpi.ts`; export from `packages/core/src/index.ts`.
4. Add the app-level threshold preference.
5. Add the properties panel section, i18n defaults and all eight locales.
6. Add `tests/engine/scene-graph/image-pixel-size.test.ts`: a valid PNG, JPEG, GIF and WebP fixture each report correct dimensions; a truncated PNG, a JPEG with no SOF, a 3-byte buffer, an empty buffer, and a 10 MB buffer of random bytes each return `null` without throwing.
7. Add `tests/engine/units/dpi.test.ts`, asserting against hand-computed values: a 1000×1000 source in a 500×500 `FILL` node at 300 document DPI → 600 DPI; the same node at 2× parent scale → 300 DPI; a rotated node → **identical** DPI to the unrotated case; `FIT` with a non-matching aspect ratio; `CROP` with an `imageTransform`; anisotropic parent scale producing different X and Y; unknown source → all `null`, `belowThreshold: false`; threshold boundary exactly at 300 → not below.
8. Add Playwright coverage in `tests/e2e/properties/`: the section appears for an image fill and not otherwise; resizing the node updates the value live; changing document DPI updates it; a low-resolution fixture shows the warning and a high-resolution one does not.
9. Run, in this order, and paste exact exit codes:
   - `bunx tsgo --noEmit --pretty false`
   - `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
   - focused `oxlint -c oxlint.json` on the changed files only
   - `bun run check:i18n`
   - `bun test ./tests/engine/units/ ./tests/engine/scene-graph/`
   - the focused Playwright spec with `--project=openpencil`

   Do **not** run `bun run check`, `bun run test` or `bun run test:unit` — `App/AGENTS.md` forbids umbrella commands unless the user asks for that exact command.
10. Stop at source gates. No build, no install, no version bump.

## Acceptance Criteria

- [ ] X, Y and min DPI are mathematically correct for `FILL`, `FIT`, `CROP` and `TILE`, including nested and anisotropically scaled parents.
- [ ] Rotation alone never changes the reported DPI.
- [ ] Unknown or malformed image data reports `Unknown` and raises no warning; the parser never throws.
- [ ] Values update immediately on resize, scale-mode change, replacement, reparenting and document-DPI change.
- [ ] No decode call and no renderer import exists in the new modules.
- [ ] Nothing is resampled, rewritten or mutated; export output is unaffected.
- [ ] Nothing in the Banned List appears in the diff.

## Stop Conditions

Stop and report if: `getWorldMatrix` does not expose the parent scale needed for step 1; `CROP` sampling cannot be derived from `imageTransform` without duplicating renderer state; or the scale-mode maths cannot be mirrored without importing from `packages/core/src/canvas/`.

## Revision History

- Revision 1 — 2026-07-24: original expansion; assumed image metadata was available on the scene graph.
- Revision 2 — 2026-08-14: re-expanded against live source. Recorded that `images.ts` holds only `computeImageHash` and that pixel size is renderer-only today; added the pure header-parser decision, the exact scale-mode formulas mirrored from `makeImageFillLocalMatrix`, the rotation-invariance rule, and hostile-input handling. Removed the build/install delivery loop.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Executed; repair pass 2026-08-18 cleared the type-aware Oxlint findings in `packages/core/src/units/dpi.ts` (dead `CROP`/`TILE` comparison, unchecked `fills` index). The full combined gate is green; no packet-specific verification was re-run.
