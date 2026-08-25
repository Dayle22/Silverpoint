# T-015 — Deliver non-destructive colour adjustments

Task ID: T-015
Project ID: openpotlood
Protocol version: 1.2
Packet revision: 3
Packet state: Done
Expanded against plan version: 81
Expanded at: 2026-07-29T14:49:26+02:00
Expanded by: Codex
Expansion route: JUDGED
Depends on: T-006 — DONE / VERIFIED

## How To Use This Packet

This packet is self-contained. Before claiming T-015, confirm that `Plan/plan.md` still shows it as `READY`, no other task is `IN PROGRESS`, and the plan version still matches 81. Claim T-015 in the plan, reread the claim, then implement only this packet.

The baseline source, registry entry, and installed executable all reported `0.6.18` during expansion. The missing `0.6.18` project receipt is a provenance gap, not permission to reconstruct history. Treat `0.6.18` as the starting baseline and only increment the version after all source checks pass and a fresh installed delivery is authorised by this packet.

Do not run `bun run check`, `bun run test:unit`, or `bun run test`; the project explicitly reserves those umbrella commands for a separate user request.

## Request Coverage

- Add editable, ordered Brightness/Contrast, Saturation, and Curves-gamma adjustments to existing renderable layers.
- Preserve native effect behaviour, original geometry and source image bytes.
- Persist the mixed effect stack through `.fig` save/reopen without extending or corrupting the Kiwi schema.
- Keep canvas, PNG, JPEG, SVG and PDF appearance aligned.
- Deliver the verified capability as a private local Windows update.

## User-Visible Outcome

Users can add ordered Brightness/Contrast, Saturation, and Curves (gamma) adjustments to any renderable layer from the Effects panel. Adjustments update the canvas live, remain editable and non-destructive, survive `.fig` save/reopen, and render consistently in PNG, JPEG, SVG, and PDF exports.

“Adjustment layer” in T-015 means an adjustment attached to an existing layer. This task does not introduce a new scene-node type or a Photoshop-style standalone adjustment layer.

## Verified Starting State

### Live seams

| Path | Exact area | Verified role | Required treatment |
| --- | --- | --- | --- |
| `App/packages/scene-graph/src/types.ts` | `Effect` | Native shadow/blur effect model | Add adjustment types and optional numeric fields without changing node geometry or image bytes. |
| `App/packages/scene-graph/src/node-defaults.ts` | effect constructors and guards | Shared defaults and type guards | Add constructors, clamping helpers, and `isAdjustmentEffect()`. |
| `App/packages/core/src/canvas/scene.ts` | `renderNode()` | Composites opacity, layer blur, node content and descendants | Wrap the completed native node composite in one adjustment save-layer. |
| `App/packages/core/src/canvas/renderer.ts` | `SkiaRenderer` resources | Owns persistent CanvasKit resources | Add a dedicated adjustment paint and a bounded RuntimeEffect cache. |
| `App/packages/core/src/canvas/renderer/{paints,lifecycle,methods}.ts` | paint lifecycle and method delegation | Initialises, deletes and exposes renderer domains | Initialise/clean adjustment resources and delegate adjustment helpers. |
| `App/packages/core/src/kiwi/fig/node-change/plugin-data.ts` | OpenPencil plugin-data helpers | Existing private `.fig` extension channel | Store a versioned ordered effect-stack descriptor and validate it on import. |
| `App/packages/core/src/kiwi/fig/node-change/{convert,export-node}.ts` | effect import/export | Maps SceneGraph effects to native Kiwi effects | Keep native effects in Kiwi; store custom adjustments and ordering in plugin data. |
| `App/packages/vue/src/controls/effects/helpers.ts` | `EFFECT_OPTIONS`, defaults and edit actions | Shared Effects-panel behaviour | Add labels/defaults and preserve scrub/commit undo behaviour. |
| `App/src/components/properties/EffectsSection.vue` | expanded effect settings | Existing add, visibility, reorder and remove UI | Render bounded numeric controls for each adjustment type. |
| `App/packages/core/src/io/formats/svg/defs.ts` | `createFilterDef()` | SVG effect pipeline | Emit standards-based adjustment primitives after native effects. |
| `App/packages/core/src/io/formats/raster/render.ts` | CanvasKit raster export | PNG/JPEG rendering | Reuse the adjusted CanvasKit renderer; add PDF fallback detection. |
| `App/packages/core/src/io/formats/pdf/export.ts` | SVG-first PDF export | Falls back to raster for unsupported appearance features | Rasterise subtrees containing visible adjustments. |
| `App/tests/engine/render/canvas/effects/` | focused renderer tests | Current effect test location | Add adjustment renderer/resource tests here. |
| `App/tests/e2e/properties/effects.spec.ts` | Effects-panel browser coverage | Current effect UI test location | Extend with one bounded adjustment workflow and visual evidence. |

### Reuse and API findings

- Relevant installed skill during expansion: `manage-projects`; its original closure gates were later retired by the user's 2026-07-30 override below.
- CanvasKit is locked to installed `canvaskit-wasm@0.40.0`.
- Its exact local API exposes `RuntimeEffect.MakeForBlender`, `RuntimeEffect.makeBlender`, `Paint.setBlender`, and `Paint.setBlendMode`; it does **not** expose `ColorFilter.MakeTable`.
- Expansion probe: a runtime gamma blender compiled successfully and a 50% grey save-layer rendered as `[64,64,64,255]` at gamma `2`, matching the expected result. No dependency upgrade or CPU pixel loop is needed.
- Compile one RuntimeEffect per adjustment-type sequence, pass current values as uniforms, and apply the sequence to unpremultiplied RGB inside one custom SrcOver blender. Cache programs by type sequence, not by slider values; cap the cache at 32 entries and delete evicted/all cached effects.
- Canvas operation order is fixed: native shadows/blurs and descendants render first; visible adjustments then apply in their relative Effects-list order to the final node composite. Moving adjustments relative to one another changes output. Native-effect placement among adjustments is preserved for editing and persistence but native effects remain the inner render stage.
- Brightness/Contrast: clamp both to `[-100,100]`; `b = brightness / 100`, `s = max(0, 1 + contrast / 100)`, then `rgb = clamp((rgb - 0.5) * s + 0.5 + b, 0, 1)`.
- Saturation: clamp to `[0,200]`; use Rec.709 luminance `dot(rgb, [0.2126,0.7152,0.0722])`, then `mix(luma, rgb, saturation / 100)`.
- Curves is a single gamma control, clamped to `[0.1,3]`, default `1`; apply `pow(rgb, 1 / gamma)`.
- SVG uses `feComponentTransfer` linear functions for Brightness/Contrast, `feColorMatrix type="saturate"` for Saturation, and `feComponentTransfer` gamma functions for Curves. W3C Filter Effects Level 1 defines these primitives: `https://www.w3.org/TR/filter-effects-1/`.
- Skia documents runtime effects and blender compilation at `https://docs.skia.org/docs/user/sksl/` and `https://api.skia.org/classSkRuntimeEffect.html`.
- No new package, capability, Tauri permission, network access or updater change is required.

### Edge cases resolved

- Hidden adjustments are ignored and allocate no RuntimeEffect/blender.
- Empty or identity-only adjustment sets skip the save-layer.
- Alpha is preserved: unpremultiply RGB before adjustment, then premultiply and SrcOver-composite.
- Invalid plugin data falls back to native Kiwi effects without throwing or silently creating an adjustment.
- Removing the last adjustment removes the private plugin-data key so deleted effects cannot resurrect.
- One node may contain repeated adjustment types. Their relative order is significant.
- Adjustment bounds use the same descendant visual-bounds calculation as opacity isolation so shadows and children are not clipped.
- PDF always takes the existing raster fallback when a selected subtree contains a visible adjustment; this favours appearance fidelity over editable PDF filter primitives.

Native installed UI interaction could not be automated during expansion. The user later completed the manual check and accepted the result.

## Dependencies and Inputs

| Requirement | Required state | Verified evidence |
| --- | --- | --- |
| T-006 effects foundation | DONE / VERIFIED | `Plan/plan.md` and verified T-006 packet |
| CanvasKit runtime blender | Available | Installed 0.40.0 types plus successful compile/pixel probe |
| Private `.fig` extension channel | Available | Existing `open-pencil` node plugin-data helpers and export-settings round-trip tests |
| Export foundation | Available | Raster, SVG and PDF routes under `packages/core/src/io/formats/` |

Required before starting: none.

## Read First

- `App/AGENTS.md`
- The `Plan/plan.md` current-state capsule and T-015 record
- This packet
- The live files named in the Live seams table; do not preload unrelated packets, reports, logs or `Toolbox/`

## Binding Constraints

- Work only in the live `App/`; never execute or copy implementation from `Toolbox/`.
- Preserve native OpenPencil behaviour and `.fig` compatibility. Unsupported or malformed data must not be silently flattened or corrupted.
- Keep this private and local-only: no Git, worktree, branch, tag, publishing, deployment, signing or updater work.
- Use focused checks. Do not run the three retired broad Bun umbrella commands.
- Increment versions only for a completed installed update and synchronise `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`.
- Desktop build and installation may be performed when requested, but they are not closure gates for T-015.

## Allowed Changes

- `App/packages/scene-graph/src/types.ts`
- `App/packages/scene-graph/src/node-defaults.ts`
- `App/packages/core/src/canvas/adjustments.ts` (new)
- `App/packages/core/src/canvas/scene.ts`
- `App/packages/core/src/canvas/renderer.ts`
- `App/packages/core/src/canvas/renderer/paints.ts`
- `App/packages/core/src/canvas/renderer/lifecycle.ts`
- `App/packages/core/src/canvas/renderer/methods.ts`
- `App/packages/core/src/kiwi/fig/node-change/plugin-data.ts`
- `App/packages/core/src/kiwi/fig/node-change/convert.ts`
- `App/packages/core/src/kiwi/fig/node-change/export-node.ts`
- `App/packages/core/src/io/formats/svg/defs.ts`
- `App/packages/core/src/io/formats/raster/render.ts`
- `App/packages/core/src/io/formats/raster/index.ts`
- `App/packages/core/src/io/formats/pdf/export.ts`
- `App/packages/vue/src/controls/effects/helpers.ts`
- `App/packages/vue/src/i18n/messages/panels.ts`
- `App/src/components/properties/EffectsSection.vue`
- Focused tests under the existing effects, `.fig` round-trip, SVG export, raster fallback and properties E2E locations
- `App/package.json`, `App/desktop/tauri.conf.json`, `App/desktop/Cargo.toml` only at the delivery stage
- `Plan/plan.md` for task status

## Restrictions and Exclusions

- New scene-node or standalone adjustment-layer type
- Histogram, levels graph, freeform curve points, per-channel RGB curves, LUT import, HSL controls or destructive pixel editing
- Kiwi schema/protocol changes
- CanvasKit upgrades or new dependencies
- Changes to unrelated masks, snapping, text, pen, AI, collaboration, updater or release machinery
- Broad-suite debt unrelated to changed files

## Implementation Steps

1. Reconfirm plan version 81, T-015 `READY`, no active executor, source/installed baseline `0.6.18`, and the exact allowed files. Claim T-015 and reread the claim.
2. Extend `Effect` with `BRIGHTNESS_CONTRAST`, `SATURATION`, and `CURVES`; add optional `brightness`, `contrast`, `saturation`, and `gamma` fields plus shared constructors, guards and clamps. Keep current native fields compatible.
3. Add `canvas/adjustments.ts` with pure parameter normalisation, type-sequence key generation, SkSL generation, bounded RuntimeEffect caching, uniform construction and save-layer setup/cleanup. The SkSL must apply visible adjustments in relative list order and implement explicit premultiplied-alpha handling plus SrcOver.
4. Add a dedicated `adjustmentLayerPaint` and RuntimeEffect cache to `SkiaRenderer`; initialise and destroy them through the existing paint/lifecycle modules and expose the adjustment helper through renderer methods.
5. In `renderNode()`, calculate descendant visual bounds, save the adjustment layer outside native layer blur/content/children, render existing content unchanged, then restore adjustment, opacity/blend and canvas state in strict reverse order. Reset the adjustment paint even when rendering throws.
6. Add versioned plugin data under key `adjustmentEffectStackV1`. Store `{version:1, stack:[...]}` where native entries reference their index in the filtered native Kiwi array and adjustment entries contain only their type-specific values plus visibility. Validate finite numbers, clamp at the import boundary, require native references to cover each native effect exactly once, and fall back to native effects on any malformed payload.
7. During `.fig` export, write only existing native effect types to `nc.effects`. Upsert the private ordered-stack payload only when at least one adjustment exists; remove the key after the last adjustment is deleted. During import, reconstruct the mixed ordered stack from validated plugin data and converted native effects.
8. Add Effects-panel options and controls: Brightness and Contrast percentage fields (`-100..100`), Saturation percentage (`0..200`), and Curves Gamma (`0.1..3`, step `0.1`). Reuse current scrub/commit actions so live dragging is one undoable edit. Add default English i18n keys and focused locale validation.
9. Extend SVG filter generation. Preserve existing native primitives, then append visible adjustments in their relative order using the formulas above. Include explicit `color-interpolation-filters="sRGB"`.
10. Add `nodeNeedsAdjustmentFallback()` recursively beside the mask/background helpers, export it through the raster index, and make PDF use the existing CanvasKit PNG fallback whenever visible adjustments occur. PNG/JPEG need no separate implementation beyond the shared renderer.
11. Add focused tests:
    - `tests/engine/render/canvas/effects/adjustments.test.ts`: formulas, order, identity/hidden handling, runtime cache bound/cleanup, alpha, save/restore and failure cleanup.
    - `tests/engine/io/fig/roundtrip/adjustment-effects.test.ts`: mixed order, repeated types, native Kiwi filtering, plugin removal and malformed-data fallback.
    - `tests/engine/io/svg/export/adjustments.test.ts`: primitive values, order and identity behaviour.
    - `tests/engine/io/formats/raster/adjustment-fallback.test.ts`: recursive PDF-fallback detection.
    - Extend `tests/e2e/properties/effects.spec.ts`: add/edit/reorder/hide/remove, one-step undo and a deterministic before/after canvas screenshot or pixel assertion.
12. Accept the user's manual confirmation of the finished behaviour and update T-015 to `Done`.
13. When explicitly requested, synchronise the patch version, build the NSIS installer, and install the fresh desktop build.

## Acceptance Criteria

- [ ] The Effects menu offers Brightness/Contrast, Saturation, and Curves.
- [ ] Controls enforce the specified ranges and update canvas output live.
- [ ] Adjustment values commit through the existing undo path as one undoable scrub.
- [ ] Visibility, removal and relative adjustment order affect output predictably.
- [ ] Rectangles, vectors, text, image fills and frames with children render adjustments without changing geometry or source image bytes.
- [ ] Multiple/repeated adjustments preserve alpha and apply in list order after native effects.
- [ ] `.fig` round-trip preserves the complete mixed stack and values; standard Kiwi effects remain native and no invalid Kiwi effect enum is written.
- [ ] Removing all adjustments removes the private payload; malformed payload safely falls back to native effects.
- [ ] PNG/JPEG use adjusted CanvasKit output; SVG emits valid adjustment primitives; PDF uses the raster fallback and matches the canvas appearance.
- [ ] RuntimeEffect and paint resources are bounded, reset and deleted without leaks or stale shared-paint state.

## Closure Override

On 2026-07-30 the user accepted the finished behaviour and explicitly retired further verification, installed-app evidence, formal reporting, receipt, and pipeline-validator requirements for closing T-015. That instruction controls this packet. A requested desktop build and installation is a delivery action, not a condition for keeping T-015 marked `Done`.

## Assumptions

| Assumption | Why reasonable | Wrong if | Rework if wrong |
| --- | --- | --- | --- |
| “Adjustment layers” means adjustments attached to existing layers. | The live scene graph has no standalone adjustment node, while the approved outcome and existing Effects UI support node-bound editing. | The user requires a Photoshop-style layer affecting siblings below it. | Add a separately planned node type and compositing model; do not stretch T-015 silently. |
| Native effects render first; adjustments then process the final node composite. | It preserves current shadow/blur behaviour and gives frames predictable descendant adjustment. | Exact interleaving with native effects is a product requirement. | Redesign renderer/export ordering as a separate blueprint. |
| Curves is one gamma control. | It matches the original packet’s gamma range and is feasible through the verified runtime blender. | Freeform/per-channel curves are required. | Add curve-point data, editor UI, interpolation and expanded export/persistence work. |
| PDF raster fallback is acceptable for adjusted content. | It guarantees fidelity using the existing mask/background fallback pattern. | Adjusted PDF content must remain vector-editable. | Research and validate `svg2pdf.js` support or implement PDF-native filters separately. |

Outstanding questions: none.

## If An Input Is Missing

No external asset is required. Do not substitute a fake implementation for a missing CanvasKit runtime feature; the installed API probe already passed, and a later runtime failure is a stop condition.

## Stop Conditions

- Plan version, active-task state or live workspace changes underneath T-015 before claim.
- Runtime blender compilation or the 50%-grey gamma pixel invariant fails in the actual test environment.
- Adjustment save-layers clip descendants/shadows, corrupt alpha, crash CanvasKit or leak resources.
- `.fig` export writes a custom adjustment into the native Kiwi effect enum or loses/reorders the mixed stack.
- Native effects regress when no adjustment exists.
- SVG and canvas formulas diverge materially, or PDF bypasses the required fallback.
- Work requires a dependency, Kiwi schema, new node type, external action or file outside Allowed Scope.

## On Completion

Update only T-015 to `Done` in `Plan/plan.md`. No formal report, receipt, installed-app evidence pack, or pipeline validation is required.

## Revision History

| Revision | Date | Change | Plan version |
| --- | --- | --- | --- |
| 1 | 2026-07-24 | Initial prepared packet; later found to contain stale paths and an unavailable CanvasKit API. | pre-78 |
| 2 | 2026-07-29T14:49:26+02:00 | Re-expanded against live 0.6.18 source; resolved SkSL rendering, plugin-data persistence, exports and focused verification. | 81 |
| 3 | 2026-07-30 | Recorded the user's closure override and removed further verification, installed-evidence, report, receipt, and validator gates. | 81 |

## Status record

Status: **Done**
