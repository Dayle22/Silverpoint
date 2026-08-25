# T-068 - Copy/paste properties (format painter)

Task ID: T-068
Packet state: Superseded — scope map only; execute T-068a through T-068c
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none
Related: T-035 (selection action bar — owns its own surface, see Exclusions), T-036 (contextual property surface), T-055 (shortcut remapping)
Prepared from: the user's 2026-08-19 request — "copy and paste properties like Figma does where it copies the layout and formatting of frames and objects and pastes it on other frames and objects"
Expanded at: 2026-08-19
Expanded against: live source under `App/` (paths and line numbers below read on 2026-08-19), `Plan/plan.md`, `Plan/PACKET-EXPANSION-BRIEF.md`
Delivery: source gates only

## Intended Outcome

Select a node, run **Copy properties**. Select one or more other nodes, run **Paste properties**. Every property in the transfer set that the target can accept is applied; the targets keep their own position, size, rotation, name, children and text content. The whole paste is one undo entry. Available from the Edit menu, the canvas right-click menu, and `MOD+ALT+C` / `MOD+ALT+V`, on both the browser and native menu routes.

## Request Coverage

> "Add a copy and paste properties like figma does where it copies the layout and formatting of frames and objects and pastes it on other frames and objects"

"Layout and formatting" is read as: paints (fills, strokes, effects, opacity, blend mode), stroke geometry, corner radii, auto-layout/grid container settings, and typography. It is not read as position, size, rotation, geometry, name or text content.

## Verified Starting State (read 2026-08-19)

| Path | Verified fact |
| --- | --- |
| `App/packages/scene-graph/src/types.ts:350` | `SceneNode` is ONE wide interface (~150 fields), no discriminated union. Fields are present-but-default on types that do not use them, so the transfer set must be selected by explicit key list and gated on `node.type` — never by copying "everything that differs". |
| `App/packages/scene-graph/src/index.ts:367-413` | `SceneGraph.updateNode(id, changes)` filters `undefined` values out of `changes` before `Object.assign`, clears `absPosCache` only for `LAYOUT_AFFECTING_KEYS`, nulls `textPicture` / `figmaDerivedTextGlyphs` when a `TEXT_PICTURE_KEYS` field changes, and calls `removeStaleBindings(node, 'fills'\|'strokes', changes)` whenever `fills` or `strokes` are replaced. **Stale variable bindings are therefore dropped for free — do not write bespoke binding-cleanup code.** |
| `App/packages/core/src/editor/nodes.ts:23-45` | `updateNodeWithUndo(id, changes, label)` snapshots the previous values with `pick()`, applies, runs layout for the node, pushes a forward/inverse undo entry, and calls `requestRender()`. This is the single write path for this packet. |
| `App/packages/scene-graph/src/undo.ts:80` | `UndoManager.runBatch(label, fn)` wraps every entry pushed inside `fn` into one undo entry. |
| `App/packages/core/src/editor/create.ts:243` | The editor object exposes `undo` (the `UndoManager`) publicly, so `store.undo.runBatch(...)` is reachable from app code. |
| `App/packages/scene-graph/src/copy.ts` | `copyFill`, `copyStroke`, `copyEffect`, `copyStyleRun` are the project's typed shallow-copy helpers, written explicitly to replace `structuredClone` (~24× cheaper) and to guarantee no shared references for `color`, `offset`, `gradientStops`, `dashPattern`, `style`. **Use these; do not use `structuredClone` for these array types.** |
| `App/packages/scene-graph/src/index.ts:72` | `SceneGraph.images = new Map<string, Uint8Array>()`. An `IMAGE` fill references bytes by `imageHash` in the *source document's* map, so a cross-document paste needs the bytes carried with the payload. |
| `App/src/app/shell/menu/schema.ts:76-110` | The Edit group. `copy` / `cut` / `paste` / `paste-to-replace` are **plain menu ids with a `shortcut` string**, not `EditorCommandId`s. Labels here are plain English literals. |
| `App/src/app/shell/menu/schema.ts:5-16` | `AppMenuActionItem` = `{ id, label, shortcut?, accelerator?, command?, checkbox?, target?, sub? }`. |
| `App/src/app/shell/menu/shortcut.ts:57-63` | `appMenuShortcutLabel(id)` and `appMenuTinykeysShortcut(id)` derive the display label and the tinykeys binding from the `shortcut` string in the schema. `MOD`→`$mod`, `SHIFT`→`Shift`, `ALT`→`Alt`. **Declaring the shortcut in `schema.ts` is enough to drive menu label, keyboard binding and native accelerator.** |
| `App/src/app/shell/menu/app-menu.ts:74-108` | Browser menu route: `actions` map keyed by menu id, plus `translatedMenuItemLabels` mapping menu id → i18n key. |
| `App/src/app/shell/menu/use.ts:59-131` | Native (Tauri) menu route: a second `actions` map keyed by menu id. `COMMAND_MENU_IDS` (line 21) is only for `EditorCommandId` items; plain ids fall through to `actions[event.payload]?.()` at line 184. |
| `App/src/app/shell/keyboard/registry.ts:79-141` | `ShortcutDefinition[]`; the established idiom for a non-command shortcut is `keys: appMenuTinykeysShortcut('<menu-id>') ?? '<fallback>'`. `shouldIgnoreShortcut` (line 41) already suppresses shortcuts during text edit, picker interaction and focused number fields. |
| `App/src/app/shell/keyboard/reserved.ts:28-32` | With `altKey` held, only `KeyB` and `KeyK` are reserved. **`MOD+ALT+C` and `MOD+ALT+V` are free.** |
| `App/packages/vue/src/editor/commands/registry.ts` | Full `EDITOR_COMMAND_METADATA` list read: `MOD+ALT+G`, `MOD+ALT+K`, `MOD+ALT+B`, `MOD+ALT+M` are taken; `MOD+ALT+C` and `MOD+ALT+V` are not. No conflict. |
| `App/src/components/canvas/CanvasMenu.vue:83-125` | The canvas right-click menu writes `copy` / `cut` / `paste` / `paste-to-replace` as literal `<ContextMenuItem>`s with `data-test-id="context-…"`, `:class="cls.item"`, `:disabled`, and `<AppShortcutText>{{ appMenuShortcutLabel('…') }}</AppShortcutText>`. This is the exact block the two new items sit beside. |
| `App/src/app/shell/menu/editor-actions.ts:20-24` | `updateSelectedText()` shows the app-level idiom: iterate `store.selectedNodes.value`, gate on `node.type`, call `store.updateNodeWithUndo(...)`. |
| `App/src/app/editor/active-store/index.ts:1-7` | `const storeRef = shallowRef<EditorStore>()` — the project's precedent for an app-level reactive module singleton. |
| `App/src/app/shell/ui.ts:75-83` | `toast.info` / `toast.warning` / `toast.error`, single plain-text message only. |
| `App/package.json:30` | `bun run check` = `build:packages && lint && tsgo --noEmit && check:vue`. |

## Corrections to the Brief

1. **`check:i18n` no longer exists.** T-054 (single-locale reduction) landed; `App/package.json` has no `check:i18n` script and `packages/vue/src/i18n/` has no `locales/` directory — only `messages/*.ts` English defaults. The expansion brief's "run `check:i18n` if strings changed" does not apply. Adding a string means editing `packages/vue/src/i18n/messages/menu.ts` only.
2. **The stub said "Related: T-035" as a likely home for the trigger. T-035 has already partially landed** — `App/src/components/canvas/SelectionActionBar.vue` exists in source, with a header comment stating that every action in it comes from the editor command registry and that the component "never defines its own action list". Because this packet deliberately does *not* add `EditorCommandId`s (Fixed Decision 1), it cannot add a button there. The action bar is excluded from scope.
3. **The stub said undo "should come for free".** Correct for a single target via `updateNodeWithUndo`, but a multi-target paste would produce one undo entry *per node* without `undo.runBatch`. Batching is mandatory, not optional (Fixed Decision 6).

## Fixed Decisions

1. **Plain menu ids, not `EditorCommandId`s.** New ids `copy-properties` and `paste-properties`, exactly like `copy` / `cut` / `paste` / `paste-to-replace`. Reason: `EditorCommandId` (`packages/vue/src/editor/commands/types.ts`) is a union in the headless SDK whose commands receive only `{ editor, selection, capabilities, messages, otherPages, moveSelectionToPage }` (`commands/context.ts`) — no place for an app-scoped clipboard singleton, and `packages/vue` has no module-level `ref`/`shallowRef` precedent anywhere in its source. The existing clipboard operations are already plain menu ids; follow them.
2. **The copied payload is an app-level module singleton, not the system clipboard.** `MOD+C` must keep copying nodes. A separate in-app buffer also survives the user copying unrelated text in between, which is how Figma behaves.
3. **The transfer set is a fixed, explicit key list — never a diff.** Because `SceneNode` is one wide interface, a "copy everything that differs" implementation would silently transplant geometry, component wiring and plugin data. The list is pinned in the Transfer Contract below.
4. **Position, size, rotation, flips, name, children and text content never transfer.** `x`, `y`, `width`, `height`, `rotation`, `flipX`, `flipY`, `name`, `childIds`, `parentId`, `id`, `type` and `text` are never written. Auto-layout *sizing modes* are in the set and may cause the layout engine to change a node's size as a consequence — that is layout recomputation, not a copied dimension, and it is acceptable.
5. **Groups are type-gated.** Paints apply to any node. Corner/stroke geometry applies to any node. Auto-layout and grid apply only to container types. Typography applies only `TEXT` → `TEXT`. A group that does not apply is skipped silently — pasting a text style onto a rectangle is not an error, it just transfers the paints.
6. **One undo entry for the whole paste**, via `store.undo.runBatch('Paste properties', …)` around per-node `updateNodeWithUndo` calls.
7. **Menu + shortcut + context menu only. No `Alt`-drag paint gesture.** The gesture would need a new tool mode, cursor state and hit-test path in `packages/vue/src/canvas/useCanvasInput.ts`; that is a separate packet. Deferred, listed below.
8. **`MOD+ALT+C` / `MOD+ALT+V`**, matching Figma. Verified free against both `EDITOR_COMMAND_METADATA` and `reserved.ts`.
9. **Image bytes travel with the payload**, so pasting a node's image fill into a different open document works. Cross-document paste is therefore supported rather than blocked.

## Transfer Contract — binding

Define these in `App/packages/core/src/editor/properties/transfer.ts` as `readonly (keyof SceneNode)[]` arrays. No other key may be added without amending this packet.

**`PAINT_KEYS`** (all node types): `fills`, `strokes`, `effects`, `opacity`, `blendMode`

**`STROKE_GEOMETRY_KEYS`** (all node types): `strokeCap`, `strokeJoin`, `dashPattern`, `strokeMiterLimit`, `borderTopWeight`, `borderRightWeight`, `borderBottomWeight`, `borderLeftWeight`, `independentStrokeWeights`, `strokesIncludedInLayout`

**`CORNER_KEYS`** (all node types): `cornerRadius`, `topLeftRadius`, `topRightRadius`, `bottomRightRadius`, `bottomLeftRadius`, `independentCorners`, `cornerSmoothing`

**`LAYOUT_KEYS`** (only when *both* source and target are `FRAME`, `COMPONENT`, `COMPONENT_SET`, `INSTANCE` or `SECTION`): `layoutMode`, `layoutDirection`, `layoutWrap`, `primaryAxisAlign`, `counterAxisAlign`, `primaryAxisSizing`, `counterAxisSizing`, `itemSpacing`, `counterAxisSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `counterAxisAlignContent`, `itemReverseZIndex`, `clipsContent`, `gridTemplateColumns`, `gridTemplateRows`, `gridColumnGap`, `gridRowGap`

**`TEXT_KEYS`** (only when *both* source and target are `TEXT`): `fontSize`, `fontFamily`, `fontWeight`, `italic`, `textAlignHorizontal`, `textAlignVertical`, `textCase`, `textDecoration`, `textDecorationStyle`, `textDecorationThickness`, `textDecorationFills`, `textDecorationSkipInk`, `textUnderlineOffset`, `leadingTrim`, `lineHeight`, `letterSpacing`, `maxLines`, `textTruncation`, `textDirection`, `textLanguage`, `fontVariations`, `fontFeatures`

**Never transferred, for the avoidance of doubt:** `x`, `y`, `width`, `height`, `rotation`, `flipX`, `flipY`, `minWidth`, `maxWidth`, `minHeight`, `maxHeight`, `name`, `visible`, `locked`, `expanded`, `autoRename`, `text`, `styleRuns`, `textAutoResize`, `textPicture`, `figmaDerivedTextGlyphs`, `vectorNetwork`, `fillGeometry`, `strokeGeometry`, `arcData`, `pointCount`, `starInnerRadius`, `booleanOperation`, `isMask`, `maskType`, `maskIsOutline`, `horizontalConstraint`, `verticalConstraint`, `layoutPositioning`, `layoutGrow`, `layoutAlignSelf`, `gridPosition`, `componentId`, `componentKey`, `componentPropertyDefinitions`, `componentPropertyValues`, `overrides`, `overrideKey`, `sourceLibraryKey`, `publishId`, `publishedVersion`, `sharedSymbolVersion`, `isPublishable`, `isSymbolPublishable`, `symbolDescription`, `symbolLinks`, `variantPropSpecs`, `boundVariables`, `exportSettings`, `pluginData`, `pluginRelaunchData`, `source`, `figmaDerivedLayout`, `internalOnly`, `id`, `type`, `parentId`, `childIds`.

Cloning rule: `fills`, `strokes`, `effects` and `textDecorationFills` must be cloned through `copyFill` / `copyStroke` / `copyEffect` from `@open-pencil/scene-graph` at **both** copy time and paste time, so neither the payload nor two pasted targets share a reference. `dashPattern`, `fontVariations`, `fontFeatures`, `gridTemplateColumns`, `gridTemplateRows` are cloned with a spread.

## Visual Contract — binding

Two new items in `App/src/components/canvas/CanvasMenu.vue`, inserted immediately after the existing `context-paste-to-replace` item and before `context-duplicate`, copying that item's markup exactly:

```vue
<ContextMenuItem
  data-test-id="context-copy-properties"
  :class="cls.item"
  :disabled="!hasSelection"
  @select="copySelectionProperties(store)"
>
  <span>{{ t.copyProperties }}</span
  ><AppShortcutText>{{ appMenuShortcutLabel('copy-properties') }}</AppShortcutText>
</ContextMenuItem>
<ContextMenuItem
  data-test-id="context-paste-properties"
  :class="cls.item"
  :disabled="!hasSelection || !hasCopiedProperties"
  @select="pastePropertiesToSelection(store)"
>
  <span>{{ t.pasteProperties }}</span
  ><AppShortcutText>{{ appMenuShortcutLabel('paste-properties') }}</AppShortcutText>
</ContextMenuItem>
```

- `cls.item` is the existing `menuCls.item` from `useMenuUI` already declared at `CanvasMenu.vue:47-60`. Do not author a class string.
- `AppShortcutText` is already imported at `CanvasMenu.vue:34`.
- `hasSelection` already comes from `useSelectionState()` at `CanvasMenu.vue:40`.
- `hasCopiedProperties` is a `computed` over the new clipboard singleton.
- Menu labels: two new keys `copyProperties: 'Copy properties'` and `pasteProperties: 'Paste properties'` in `App/packages/vue/src/i18n/messages/menu.ts`, added next to the existing `pasteToReplace` at line 51, plus entries in `translatedMenuItemLabels` in `app-menu.ts`.
- Schema entries sit directly after `paste-to-replace` in the Edit group:
  `{ id: 'copy-properties', label: 'Copy properties', shortcut: 'MOD+ALT+C' }`,
  `{ id: 'paste-properties', label: 'Paste properties', shortcut: 'MOD+ALT+V' }`.

### Banned List

- No literal colour anywhere — no hex, no `rgb()`, no `bg-zinc-*`. Semantic tokens only.
- No font size outside `text-xs` / `text-[11px]`. No radius outside `rounded-md` / `rounded-lg`.
- No new `tv()` recipe. Reuse `useMenuUI` / `menu` from `@/components/ui/menu`.
- No new npm dependency. No edit to `App/src/app.css` or any global CSS.
- No new Pinia store, event bus or provide/inject. One module singleton, as specified.
- Do not add `copy-properties` / `paste-properties` to `EditorCommandId`, `EDITOR_COMMAND_METADATA`, `COMMAND_MENU_IDS`, `EDIT_MENU_COMMAND_GROUPS` or `SelectionActionBar.vue`.
- Do not touch the system clipboard, `writeCopyData`, `executeClipboardCommand`, `pasteClipboardToReplace`, or anything under `packages/core/src/editor/clipboard/`.
- Do not use `structuredClone` for `Fill` / `Stroke` / `Effect` / `StyleRun`.
- Do not write `width`, `height`, `x`, `y` or `rotation` on any target under any circumstances.
- Do not build, install, or bump versions in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`.

## Allowed Changes

New `App/packages/core/src/editor/properties/transfer.ts` (+ its export from `packages/core/src/editor/index.ts`); new `App/src/app/editor/property-clipboard.ts`; edits to `App/src/app/shell/menu/schema.ts`, `app-menu.ts`, `use.ts`, `App/src/app/shell/keyboard/registry.ts`, `App/src/components/canvas/CanvasMenu.vue`, `App/packages/vue/src/i18n/messages/menu.ts`; new engine and Playwright specs.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report rather than improvise.

- No `Alt`-drag paint gesture, no new tool, no cursor change, no canvas hit-test change.
- No change to the existing node copy/cut/paste, paste-to-replace, or duplicate behaviour.
- No `.fig` schema, Kiwi, export, import, renderer, CanvasKit or MCP change.
- No change to `SelectionActionBar.vue` (T-035) or the Properties panel (T-036).
- No "paste properties" into the layer tree, page list, or any non-canvas surface.
- No preference, settings UI, or persisted-across-restart property clipboard. The buffer is session-scoped.
- No mobile, dashboard, `showUI=false` or `?no-chrome` behaviour change.

**Deferred to a later packet:** the `Alt`-drag format-painter gesture; a "Paste properties…" chooser letting the user pick which groups to apply; transferring `horizontalConstraint` / `verticalConstraint`; transferring `styleRuns` (mixed per-character text styling); transferring `exportSettings`.

## Implementation Steps

1. Re-read every Verified Starting State row. Stop and report drift before writing code — in particular confirm `removeStaleBindings` still runs inside `SceneGraph.updateNode` and that `editor.undo` is still exposed at `create.ts:243`.
2. Add `App/packages/core/src/editor/properties/transfer.ts`: the five key arrays exactly as pinned above, a `CONTAINER_TYPES` set, `extractTransferableProperties(node: SceneNode)` returning a typed payload, and `applicablePropertiesFor(sourceType, targetType, payload)` returning `Partial<SceneNode>` with the group gating applied and every array freshly cloned. Pure functions only — no `EditorContext`, no graph access. Export from `packages/core/src/editor/index.ts`.
3. Add `App/src/app/editor/property-clipboard.ts`: `const copiedRef = shallowRef<CopiedProperties | null>(null)` (module singleton, following `active-store/index.ts:7`), a `readonly` export, a `hasCopiedProperties` computed, plus `copySelectionProperties(store)` and `pastePropertiesToSelection(store)`.
   - Copy: take the **first** node in `store.selectedNodes.value`; if none, `toast.warning` and return. Store `{ sourceType, properties, images }` where `images` is a `Map<string, Uint8Array>` holding the bytes for every `imageHash` referenced by a copied `IMAGE` fill that exists in `store.graph.images`. Confirm with a `toast.info`.
   - Paste: if the buffer is empty or the selection is empty, `toast.warning` and return. Otherwise merge the payload's `images` into `store.graph.images` for hashes not already present, then `store.undo.runBatch('Paste properties', () => { for each selected node that is not locked: const changes = applicablePropertiesFor(...); if (Object.keys(changes).length) store.updateNodeWithUndo(node.id, changes, 'Paste properties') })`.
4. Add the two schema entries in the Edit group of `App/src/app/shell/menu/schema.ts` with the shortcut strings pinned above.
5. Add the two handlers to **both** menu routes — the `actions` map in `app-menu.ts:74` and the `actions` map in `use.ts:59` — and the two `translatedMenuItemLabels` entries in `app-menu.ts`. The native route needs no `COMMAND_MENU_IDS` change; plain ids already fall through at `use.ts:184`.
6. Add the two keys to `App/packages/vue/src/i18n/messages/menu.ts`.
7. Add two `ShortcutDefinition` entries to `App/src/app/shell/keyboard/registry.ts` using `keys: appMenuTinykeysShortcut('copy-properties') ?? '$mod+Alt+KeyC'` and `?? '$mod+Alt+KeyV'`. Do **not** add them to `GLOBAL_SHORTCUT_IDS` — both require an active editor.
8. Add the two context-menu items to `CanvasMenu.vue` exactly as in the Visual Contract.
9. Write `App/tests/engine/editor/properties/transfer.test.ts`: every pinned key list is exactly as specified; `applicablePropertiesFor` gates layout to container types and typography to `TEXT`→`TEXT`; no banned key ever appears in the returned object; mutating a returned `fills` entry does not mutate the payload or a second call's result.
10. Write `App/tests/e2e/properties/copy-paste-properties.spec.ts`: fill/stroke/effect/opacity/corner radius transfer between two rectangles while `x`/`y`/`width`/`height`/`rotation`/`name` are byte-identical before and after; a multi-target paste is a **single** undo that fully reverts every target; typography transfers `TEXT`→`TEXT` and is skipped `TEXT`→`RECTANGLE` while paints still transfer; auto-layout settings transfer `FRAME`→`FRAME`; locked targets are skipped; paste with an empty buffer warns and mutates nothing; a fill bound to a variable pastes as a raw colour with no stale binding on the target; an image fill pasted into a second open document renders (bytes carried); menu, context menu and both shortcuts all reach the same code path; `MOD+C`/`MOD+V` node copy/paste still behaves as before.
11. Run the verification commands below. No umbrella `bun run check`, no build.

## Acceptance Criteria

- [ ] Copy properties from one node and paste onto one or many; every pinned property in an applicable group is applied to every unlocked target.
- [ ] Targets' `x`, `y`, `width`, `height`, `rotation`, `flipX`, `flipY`, `name`, `text` and children are unchanged, except where the layout engine recomputes size from a transferred auto-layout sizing mode.
- [ ] The entire paste is exactly **one** undo entry labelled `Paste properties`, and undoing it restores every target.
- [ ] Group gating holds: layout only between container types, typography only `TEXT`→`TEXT`, paints and corners always. A non-applicable group is skipped without an error.
- [ ] No banned key from the Transfer Contract is ever written.
- [ ] Pasted `fills` / `strokes` / `effects` share no object reference with the payload or with another target.
- [ ] Pasting a node with an image fill into a second open document shows the image.
- [ ] A pasted fill that was variable-bound on the source leaves no stale binding on the target.
- [ ] Edit menu (browser and native), canvas right-click menu, and `MOD+ALT+C` / `MOD+ALT+V` all work; the paste entry is disabled when the buffer is empty.
- [ ] Existing `MOD+C` / `MOD+X` / `MOD+V` node clipboard behaviour and `Paste to replace` are unchanged.
- [ ] `EditorCommandId`, `EDITOR_COMMAND_METADATA`, `COMMAND_MENU_IDS` and `SelectionActionBar.vue` are untouched.
- [ ] The verification commands below pass. No delivery is claimed without a separately authorised build.

## Verification

Run from `App/`:

- `bun test ./tests/engine/editor/properties/transfer.test.ts`
- `bunx tsgo --noEmit --pretty false`
- `bunx vue-tsc --noEmit -p tsconfig.json --pretty false`
- `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false`
- `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/editor/properties/ src/app/editor/property-clipboard.ts src/app/shell/menu/ src/app/shell/keyboard/registry.ts src/components/canvas/CanvasMenu.vue packages/vue/src/i18n/messages/menu.ts`
- `bunx playwright test tests/e2e/properties/copy-paste-properties.spec.ts tests/e2e/context-menu/basic.spec.ts tests/e2e/clipboard --project=openpencil`
- Browser check on the dev server (`bun run dev`, port 1420): copy properties from a styled frame, paste onto two plain frames, confirm one `MOD+Z` reverts both.

Record: the exact key list diff against the Transfer Contract; before/after `x`/`y`/`width`/`height`/`rotation`/`name` for every target; undo depth before and after a multi-target paste; test counts and exit codes.

Known lint traps in this codebase that will bite here: `open-pencil/no-inline-named-types` (import `Rect` / `Vector` rather than inlining `{x: number; y: number}`) and `open-pencil/no-broad-unknown-type-assertions` (no `as Record<string, unknown>`, including in test files). Declare named types.

## Stop Conditions

Stop and return to planning if:

- `updateNodeWithUndo` cannot express any pinned key without a bespoke undo entry;
- `undo.runBatch` does not in fact collapse the per-node entries into one (check `packages/scene-graph/src/undo.ts:71-78` — an empty batch is discarded);
- transferring `primaryAxisSizing` / `counterAxisSizing` changes a target's size in a way the user considers a violation of "position and size stay put" — in that case drop those two keys from `LAYOUT_KEYS`, which is a two-line change plus its test;
- the user wants the `Alt`-drag paint gesture in this packet after all;
- `MOD+ALT+V` turns out to be swallowed by the Tauri WebView on Windows, in which case add `KeyC`/`KeyV` to the `altKey` branch of `reserved.ts:30` and re-verify.

## Revision History

- Revision 1 — 2026-08-19: stub raised from the user's request.
- Revision 2 — 2026-08-19: full expansion against live source. Established that `SceneNode` is one wide interface so the transfer set must be an explicit key list; verified `SceneGraph.updateNode` already drops stale fill/stroke variable bindings via `removeStaleBindings`; verified `editor.undo` is publicly exposed so `runBatch` gives a single undo entry; verified `MOD+ALT+C`/`MOD+ALT+V` are free against both the command metadata registry and `reserved.ts`; chose plain menu ids over `EditorCommandId` because the headless command context has nowhere to hold an app-scoped buffer; corrected the brief on `check:i18n` (removed by T-054) and on T-035's action bar (already in source, and closed to non-command actions).
