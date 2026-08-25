# T-023 - Editable QR and EAN-13 barcode generators

Task ID: T-023
Packet state: Done
Project goal link: Plan/endgoal.md
Depends on: T-004 (Done), T-008 (Done), T-011 (Done)
Supersedes: revision 1 (expanded 2026-07-28). Revision 1 is void for its delivery instructions - it mandated a per-packet NSIS build, install, and installed-identity loop, which the delivery policy set 2026-08-14 forbids. Its dependency research is retained below and must still be re-confirmed live.

## Intended Outcome

The user can insert a QR code or an EAN-13 barcode that is real, scannable geometry and ordinary editable artwork at the same time: a normal `FRAME` in Layers containing a `VECTOR` child for the dark modules or bars, a background child, and - for EAN-13 with human-readable digits enabled - a normal `TEXT` child. It moves, resizes, duplicates, undoes, exports and round-trips through `.fig` like anything else on the canvas, and it can be regenerated in place after changing its payload or options without becoming a second frame.

No bitmap, no data URI, no opaque node type, no network call.

## Verified Starting State

Read from the working tree on 2026-08-14. Line numbers are from that read; the named files and exports are the stable anchors.

App version is `0.6.29` (`App/package.json`).

### A. Nothing exists yet

- `packages/core/src/barcode/` does not exist.
- `App/package.json` declares no `qrcode`, `@types/qrcode`, `bwip-js`, or any barcode or decoder dependency (full dependency block read).
- There is no barcode tool, no barcode property section, and no barcode test.

### B. Toolbar seam - confirmed, with a working precedent to copy

- `packages/core/src/editor/tool-registry.ts:10-22` holds `EDITOR_TOOLS: EditorToolDef[]`, where `EditorToolDef` is `{ key, label, shortcut, flyout? }`. Labels are **plain English string literals in this file** - there is no i18n indirection for tool labels, so no locale file is involved (relevant because T-054 is removing the locale trees).
- `TOOL_SHORTCUTS` at `tool-registry.ts:25-40` maps `KeyV`/`KeyF`/`KeyR`/`KeyP`/... Free single letters at the time of reading: `KeyQ`, `KeyE`, `KeyG`, `KeyI`, `KeyJ`, `KeyK`, `KeyU`, `KeyW`, `KeyX`, `KeyY`, `KeyZ` are not in this map (some are bound as editing shortcuts elsewhere - check `src/app/shell/keyboard/` before claiming one).
- `src/app/editor/icons.ts:26-42` declares `toolIcons: Record<Tool, Component>` - an **exhaustive** record. Adding a `Tool` member without adding an icon is a type error. Icons come from `unplugin-icons` Lucide imports (`import IconX from '~icons/lucide/x'`); no icon files are added.
- `src/components/Toolbar/DesktopToolbar.vue:42-57` renders a `ToolFlyout` for any tool with `flyout.length > 1`, and passes a **named slot** for `FRAME` that mounts `FramePresetPopover`. `src/components/Toolbar/FramePresetPopover.vue` is the exact pattern to copy: a Reka `PopoverRoot`/`PopoverTrigger`/`PopoverPortal`/`PopoverContent` wrapping a `ToolButton`, with local `ref` state, an inline validation message, and `toolbarToolTestId` for its test hook.
- `ToolButton.vue` takes `{ icon, active, mobile }` and renders the icon at `size-4`.

### C. Node creation, plugin data and undo - confirmed

- `packages/core/src/figma-api/plugin-data.ts:41-53` exports `setPluginData(graph, node, key, value)` and `getPluginData`, namespaced under `OPEN_PENCIL_PLUGIN_DATA_NAMESPACE`, writing through `graph.updateNode(node.id, { pluginData })`. `pluginData` is a first-class field on `SceneNode` (`packages/scene-graph/src/types.ts:494`), is copied by `packages/scene-graph/src/copy.ts:167`, and is preserved across the `.fig` round trip (proved by `tests/engine/scene-graph/plugin-data.test.ts`). **This is the only sanctioned place for generator metadata.**
- `packages/core/src/figma-api/index.ts:141-177` provides `createFrame`, `createText`, `createVector`; `packages/core/src/editor/shapes.ts` provides undo-backed shape creation.
- `packages/core/src/tools/create/vector.ts` validates and normalises vector networks - generated geometry must pass through it, not around it.
- `packages/core/src/io/formats/svg/export.ts` and `.../svg/paths.ts` export vector networks as SVG paths, which is what makes the "no embedded raster" acceptance criterion checkable.

### D. Property panel seam - confirmed

`src/components/DesignPanel.vue` is the single-selection host; sibling sections live in `src/components/properties/` (`PositionSection.vue`, `AppearanceSection.vue`, `FillSection.vue`, `EffectsSection.vue`, `ExportSection.vue`, `StrokeSection.vue`, ...). A conditionally rendered `BarcodeSection.vue` follows that convention exactly.

### E. Delivery policy has changed since revision 1

`Plan/plan.md` (policy set 2026-08-14): packets stop at source gates. No desktop build, no NSIS installer, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml` unless the user asks for a build in that session. Every installed-app instruction in revision 1 is void.

## Fixed Decisions

Binding. These are the answers; do not re-derive them.

1. **Scope is exactly two symbologies: QR and EAN-13.** "Other barcodes" is not authorisation for more. The internal model is a discriminated union keyed on `'QR_CODE' | 'EAN_13'` so a third type is possible later, but no third type ships here.
2. **The entry point is a toolbar flyout, mounted the way `FramePresetPopover` is mounted.** Add one `Tool` member `BARCODE` with `flyout: ['BARCODE', 'BARCODE_EAN13']`, an icon in `toolIcons` (`~icons/lucide/qr-code` and `~icons/lucide/barcode`), and a `BarcodeGeneratorPopover.vue` passed into `ToolFlyout`'s slot for that tool. Selecting the tool opens the popover; **it does not put the canvas into a drag-to-draw mode.** Insert places the frame at the viewport centre and returns the active tool to `SELECT`. Do not claim a keyboard shortcut unless a free key is verified in both `TOOL_SHORTCUTS` and `src/app/shell/keyboard/`; if none is free, ship without one.
3. **Generation is pure and lives in `packages/core/src/barcode/`.** It takes options and returns a plan - frame size, child vector networks, text content, colours, and a scan-check result. It never touches the graph, the renderer, or the DOM. The graph-mutating half lives in one adjacent editor action module and does nothing but apply a plan.
4. **Metadata contract.** One plugin-data key, `barcode`, holding a JSON string: `{ v: 1, type, payload, options }`. Generator-owned children are marked with their own key, `barcodeRole`, valued `'modules' | 'background' | 'text'`. Regeneration replaces only children carrying `barcodeRole`. A frame with no `barcode` key is ordinary artwork - never adopt it, never rewrite it. A frame whose `barcode` key is present but unparseable, or which contains an unexpected non-role child where a role child is expected, is a **conflict**: show it, change nothing, push no undo entry.
5. **QR invariants.** A real encoder, its own selected version (1-40) and ECC (`L`/`M`/`Q`/`H`, default `M`), exactly four quiet-zone modules on all four sides, square modules of one integer pixel size, and geometrically intact square finder patterns. Styles are exactly `square`, `rounded`, `dots`, and style only non-finder dark modules. Payload is never truncated, re-encoded, or silently altered; over-capacity input is a rejection, not a version bump behind the user's back.
6. **EAN-13 invariants.** ASCII digits only. Twelve digits compute and append the check digit; thirteen digits are accepted only if the supplied check digit is correct; every other input is rejected. Guard bars and the 95-module pattern are exact. Human-readable digits are a normal `TEXT` child - never outlined, never baked into geometry.
7. **The scan check is a geometry gate, not a promise.** It verifies quiet zone, module-grid consistency, finder-pattern integrity, finite positive dimensions, and dark-vs-light contrast. It reports `PASS` or a specific warning. No wording anywhere - UI, changelog, docs, report - may claim compatibility with any particular scanner, camera, or print process.
8. **Validation failure is inert.** Invalid input mutates neither the graph nor the undo stack, and leaves the popover open with a visible message. One successful Insert or Regenerate is exactly one undo entry.
9. **Regeneration preserves identity.** Same frame ID, same position, same parent, same layer order, same selection. Only `barcodeRole` children are replaced.
10. **Dependency route (to be re-confirmed live, not assumed).** The 2026-07-28 research recommended `qrcode@1.5.4` + `@types/qrcode@1.5.6` for the QR matrix (`create()` returns modules/version/ECC) and `bwip-js@4.11.2` for EAN-13 (zero runtime dependencies, built-in types, SVG/custom-drawing route). Both MIT. `qrcode` pulls `pngjs`, `yargs` and `dijkstrajs` and has no bundled declarations. Before installing: re-resolve the current versions and licences from the registry, and confirm nothing Node-only or PNG/CLI-only reaches the renderer bundle. If that cannot be shown, **stop for an explicit dependency decision** - do not substitute a library from memory and do not hand-roll a QR encoder.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines stops and reports instead.

- **Do NOT build, install, or bump versions.** See E. Revision 1's build/install/identity loop is void.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or `bun run check:upstream`.** Use the focused gates in Acceptance.
- **Do NOT produce the artwork as a bitmap, data URI, HTML canvas snapshot, imported image, or retained SVG string.** Every module and every bar is vector geometry in the scene graph.
- **Do NOT add a new `NodeType`, a new scene-graph field, a new codec, or an editor-only rendering surface.** Frames, vectors, text and plugin data are sufficient.
- **Do NOT touch `packages/core/src/kiwi/` or the `.fig` encoding.**
- **Do NOT add any network access** - no barcode service, no remote decoder, no remote font, no telemetry. URLs in a QR payload are encoded as text and are never fetched.
- **Do NOT add logos, gradients, masks, per-module colours, transparency tricks, or a user-facing QR version override.**
- **Do NOT reduce the quiet zone below four modules,** or expose a control that would.
- **Do NOT delete or overwrite a child the generator does not own** (decision 4).
- **Do NOT modify unrelated lockfile entries.** If a dependency is installed, `App/bun.lock` changes only for it and its transitive closure, and the diff is recorded.
- **Do NOT touch T-009 (Codex bridge), T-010, the export pipeline's existing behaviour, the updater, or `Toolbox/`.**
- **Do NOT run Git commands.** The project is not a repository.

## Implementation Steps

1. **Dependency gate.** Re-resolve `qrcode`, `@types/qrcode` and `bwip-js` in the live registry: exact versions, licences, dependency trees. Install with the project's Bun workflow. Confirm the renderer bundle builds and that no Node-only path is pulled in. Record versions, licence text, tree, and the lockfile diff. If any of this fails, stop here and report - the rest of the packet is blocked, not workaroundable.
2. **Model** (`packages/core/src/barcode/types.ts`). The discriminated union, option ranges and defaults, the metadata key/version constants, and the validation-result and scan-check result types.
3. **QR generation** (`packages/core/src/barcode/qr.ts`). Call the encoder's matrix API; keep its version and ECC. Convert the matrix to a vector network: four quiet-zone modules, integer module size, one background rect, one modules vector, three styles, finder patterns left square. Return a plan plus a scan-check result.
4. **EAN-13 generation** (`packages/core/src/barcode/ean13.ts`). Strict digit/checksum validation, exact guard bars and 95-module pattern, bar height and module width as integers, bars as vector geometry, optional digits as a text-child plan.
5. **Graph actions** (adjacent to `packages/core/src/editor/shapes.ts`, or a new `shapes/barcode.ts` following its conventions). Apply a plan: create the frame at viewport centre, create role-tagged children, write `barcode` metadata, select the frame, push exactly one undo entry. Add the in-place regeneration action with the conflict handling from decision 4.
6. **Toolbar** (`packages/core/src/editor/types.ts`, `tool-registry.ts`, `src/app/editor/icons.ts`, `src/components/Toolbar/DesktopToolbar.vue`). Add the `BARCODE` tool member, its icons, and the flyout slot per decision 2.
7. **Popover** (`src/components/Toolbar/BarcodeGeneratorPopover.vue`). Copy `FramePresetPopover.vue`'s structure. Frozen control set - QR: payload, ECC (L/M/Q/H), integer module size, style (square/rounded/dots), dark and light colour. EAN-13: digits, integer module size, bar height, human-readable toggle, dark and light colour. Actions: Insert, Regenerate, Cancel. Read-only readout: selected QR version, module count, scan-check status. Nothing else.
8. **Property section** (`src/components/properties/BarcodeSection.vue`, mounted in `src/components/DesignPanel.vue`). Rendered only for a single selected frame carrying valid `barcode` metadata. Same action path as the popover. Ordinary frames and imported artwork show nothing.
9. **Focused tests.**
   - `tests/engine/barcode/generator.test.ts` (new): QR matrix/version/ECC preservation, quiet-zone count, module-size consistency, finder-pattern integrity under all three styles, capacity rejection, payload immutability; EAN-13 12→13 checksum, bad checksum rejection, non-digit rejection, guard-bar pattern; child role tagging; metadata round trip; regeneration identity, conflict, and undo-entry count; scan-check pass and warn cases.
   - Extend the existing `.fig` round-trip coverage (`tests/engine/io/fig/roundtrip/`) to assert metadata, child structure and independent editability survive save/reopen.
   - `tests/e2e/barcode/generator.spec.ts` (new), using `CanvasHelper` from `tests/helpers/canvas.ts` and the store helpers: insert a QR and an EAN-13, assert the Layers child structure, change options and regenerate in place (same frame ID), reject invalid input with no mutation, cycle the three styles, toggle the EAN text child, undo/redo, save and reopen, export SVG and assert vector paths with no `data:` URI, and assert no console errors. Include a non-default pan/zoom case.
10. **Gates.** Run the focused gates in Acceptance. Update `App/CHANGELOG.md` only after they pass, and only for what actually shipped.

## Acceptance Criteria

- [ ] The toolbar exposes QR Code and EAN-13 through the existing flyout/popover convention; selecting one opens the popover and does not leave the canvas in a drawing mode.
- [ ] A valid QR payload creates a selected `FRAME` containing a background child and a dark-module `VECTOR` child, both visible in Layers and editable through the normal vector route.
- [ ] QR output preserves the encoder's version (1-40) and ECC (L/M/Q/H), has exactly four quiet-zone modules on all four sides, uses one consistent integer module size, and keeps finder patterns square under all three styles.
- [ ] `square`, `rounded` and `dots` are visibly different from each other.
- [ ] Over-capacity, empty, or otherwise invalid QR input is rejected with a visible message, and the graph and undo stack are unchanged.
- [ ] A valid 12-digit EAN-13 input appends the correct check digit; a valid 13-digit input is preserved; wrong length, wrong checksum and non-digits are rejected without mutation.
- [ ] EAN-13 bars are vector geometry with correct guard bars; the human-readable toggle creates and removes a normal editable `TEXT` child.
- [ ] Regeneration keeps the frame ID, position, parent, layer order and selection, replaces only `barcodeRole` children, and is one undo entry; a metadata or child conflict changes nothing and is reported.
- [ ] Generator frames survive move, resize, duplicate, undo/redo, and `.fig` save/reopen with metadata, children and editability intact.
- [ ] SVG export contains vector paths for the barcode geometry and no `data:` URI or embedded raster; PNG and PDF export produce valid non-empty files.
- [ ] The scan check reports `PASS` only for geometry satisfying decision 7, and no text anywhere claims scanner, camera or print-production compatibility.
- [ ] Exact dependency versions, licences, dependency trees and the `bun.lock` diff are recorded; no unrelated lockfile entry changed.
- [ ] Focused gates green: `bun test tests/engine/barcode/`; `bunx playwright test tests/e2e/barcode/generator.spec.ts --project=openpencil`; `tsgo --noEmit`; both `vue-tsc` projects; `oxlint` over the touched paths.
- [ ] No version file, installer, build output or Git state changed.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`:

1. `bun test tests/engine/barcode/generator.test.ts` - expect exit `0`.
2. `bun test tests/engine/io/fig/roundtrip/ tests/engine/scene-graph/plugin-data.test.ts` - expect exit `0`.
3. `bunx playwright test tests/e2e/barcode/generator.spec.ts --project=openpencil` - expect exit `0`.
4. `bunx tsgo --noEmit` - expect exit `0`.
5. `bunx vue-tsc --noEmit -p tsconfig.json && bunx vue-tsc --noEmit -p packages/vue/tsconfig.json` - expect exit `0`.
6. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/ packages/vue/src/ src/` - expect exit `0`.
7. Browser check in the dev server: insert both types, regenerate each in place, export SVG, and open the SVG in an external viewer. Record what was observed.

## Stop Conditions

- The dependency gate (step 1) cannot be satisfied: a version or licence cannot be resolved, the package will not bundle for the renderer, it drags in a Node-only or network path, or it touches unrelated lockfile entries.
- The encoder does not expose a real module matrix, or its output cannot preserve the four-module quiet zone and intact finder patterns.
- EAN-13 guard-bar or checksum correctness cannot be proven, or human-readable digits would require outlining or rasterisation.
- Rounded or dots styling breaks finder-pattern validity, module-size consistency, or contrast.
- Regeneration cannot preserve frame identity, mutates on validation failure, destroys a user-owned child, or produces more than one undo entry.
- The `.fig` round trip loses metadata, children, payload or editability; or SVG export emits raster or `data:` content for barcode geometry.
- Completion would require a third symbology, a new node type, a schema change, network access, or a file outside the boundaries above.

## Verified Research Sources (2026-07-28, re-confirm before installing)

- DENSO WAVE, code area: https://www.qrcode.com/en/howto/code.html - four-module quiet zone on all sides.
- DENSO WAVE, versions: https://www.qrcode.com/en/about/version.html - versions 1-40, 21x21 to 177x177, capacity depends on ECC and content.
- npm `qrcode`: https://registry.npmjs.org/qrcode - MIT, browser mapping, runtime deps `pngjs`/`yargs`/`dijkstrajs`, no bundled declarations.
- npm `@types/qrcode`: https://registry.npmjs.org/@types%2Fqrcode - MIT, declares `@types/node`.
- npm `bwip-js`: https://registry.npmjs.org/bwip-js - MIT, built-in declarations, zero runtime dependencies, browser export route.
- node-qrcode README: https://github.com/soldair/node-qrcode/blob/master/README.md - `create()` returns modules/version/ECC.
- bwip-js README: https://github.com/metafloor/bwip-js/ - EAN-13 support, scale/height/text options, SVG and custom-drawing routes.

## Execution Report Contract

Report: result; exact dependency versions, licences, trees and lockfile diff; changed files with opening and final SHA-256; commands with exit codes and test counts; QR payload/version/ECC/matrix/quiet-zone/style/scan evidence; EAN-13 input/checksum/guard-bar/text evidence; frame and child IDs with their metadata; regeneration identity, conflict and undo evidence; SVG/PNG/PDF inspection results; `.fig` round-trip evidence; deviations; and concerns. Do not advance task or packet status from execution.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Executed; repair pass 2026-08-18 cleared every Oxlint violation in the barcode tests, so the combined `bun run lint` gate is green (0 errors) alongside `tsgo`, both `vue-tsc` projects, the focused Bun barcode/roundtrip tests and 3/3 Playwright barcode tests. The `bun.lock` regeneration owed for the `bwip-js` removal was completed in the authorised 0.6.31 delivery.
