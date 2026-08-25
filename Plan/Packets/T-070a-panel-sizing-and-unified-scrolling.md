# T-070a - Panel sizing kinds and one unified scrollbar per container

Task ID: T-070a
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-031c (Done)
Related: T-070b, T-070c, T-070d (the rest of the InDesign panel overhaul), T-032 (Ready — consumes this barrel)
Prepared from: the user's 2026-08-20 InDesign-referenced panel request, requirement group 5; first slice of the T-070 split
Expanded at: 2026-08-20 08:24 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `src/app/shell/panels/{types,registry,containers,operations,layout,index,resize}.ts`, `src/components/Shell/{PanelStack,FloatingPanel}.vue`, `src/components/workspace-panels/WorkspacePanelContent.vue`, `src/components/{LayerTree/LayerTree,PagesPanel,ChatPanel,AssetsPanel,CodePanel}.vue`, `src/app.css`, `tests/engine/app/shell/panels/*`, `tests/e2e/panels/*`, `App/package.json`
Delivery: named source gates + browser check

## Intended Outcome

A docked or floating panel stack shows **exactly one scrollbar** for the whole column instead of one per panel, and no panel can grow unboundedly tall. Each panel declares whether it is `fill` (needs a definite height and scrolls internally — Pages, Assets, Layers, AI, Code) or `content` (as tall as its own form rows — every property panel). Stack members are sized in pixels plus one grow weight, never in percentages, so a collapsed member or an active drop indicator can no longer make the column overflow.

## Request Coverage

Requirement group 5 of the 2026-08-20 request, verbatim:

- Resolve panel height issues where panels become excessively tall.
- Replace individual per-panel scrollbars in stacked groups with a single, unified scrollbar for the entire stack.

Groups 1–4 belong to T-070b/c/d. This packet delivers no tabs, no new drop targets and no new drag handle.

## Verified Starting State

| Path (relative to `App/`) | Symbol / selector | What it is and why it matters here |
| --- | --- | --- |
| `src/app/shell/panels/types.ts` | `PANEL_LAYOUT_VERSION = 3`, `PANEL_BASIS_TOTAL = 10_000`, `PANEL_BASIS_MIN = 500`, `PANEL_MIN_HEIGHT = 96`, `PANEL_COLLAPSED_HEIGHT = 33`, `RegisteredPanelState.basis` | The persisted schema. `basis` is the per-panel proportion of its container. This packet replaces it with a pinned pixel height. |
| `src/app/shell/panels/containers.ts` | `normaliseBasisAndHeight()` (≈ lines 289–320), `normaliseV3()`, `normaliseStateV3()`, `defaultPanelLayout()` (`DEFAULT_BASIS`), `migrateV1ToV2()`, `migrateV2ToV3()`, `normaliseBasisV2()` | Invariant 10 is the basis arithmetic being removed. The v1→v2→v3 chain is the established pattern the new v3→v4 step joins. `normaliseBasisV2()` is **v2-legacy only** and stays. |
| `src/app/shell/panels/operations.ts` | `normalisePanelLayout()` (the version dispatcher), `resizePair()` (≈ lines 186–199), `cloneLayout()` | Every pure operation returns `normaliseV3(...)`. `resizePair` transfers basis points between two adjacent expanded members; it is replaced by `setMemberHeight`. |
| `src/components/Shell/PanelStack.vue` | the scroll wrapper `flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden`; the `section` with `flexBasis: panels[id].collapsed ? '33px' : panels[id].basis / 100 + '%'`, `flexGrow`, `flexShrink`, `minHeight`; `resizeBetween()`; `resizeWidth()` | **The bug site.** Expanded members' percentage bases sum to 100% *while* each collapsed member adds a further fixed 33 px and an active `DockInsertionTarget` adds 3 px — so the column overflows the moment anything is collapsed or a drop is previewed. |
| `src/components/workspace-panels/WorkspacePanelContent.vue` | `const scrollClass = 'scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4'` | **The per-panel scrollbar.** Applied to the `export`, `variables`, `appearance`, `transform`, `text`, `page`, `guides`, `mask` and `component` branches. |
| `src/components/workspace-panels/WorkspacePanelContent.vue` | the `PagesPanel` / `AssetsPanel` / `LayerTree` / `ChatPanel` / `CodePanel` branches | These five render their own internal scroller against a **definite** parent height and collapse to zero in an auto-height parent. Verified: `LayerTree.vue:99` `relative min-h-0 flex-1 overflow-hidden` + `:101` `scrollbar-thin h-full overflow-y-auto px-1`; `PagesPanel.vue:88` `min-h-0 flex-1 overflow-hidden` + `:91` `scrollbar-thin h-full overflow-x-hidden overflow-y-auto`; `AssetsPanel.vue:173` `flex min-h-0 flex-1 flex-col overflow-hidden` + `:187` `scrollbar-thin flex-1 overflow-y-auto`; `ChatPanel.vue:117` `flex min-w-0 flex-1 flex-col overflow-hidden` + `:121` `ScrollAreaRoot class="min-h-0 flex-1"`; `CodePanel.vue:95` `flex min-h-0 flex-1 flex-col` + `:212` `ScrollAreaRoot class="min-h-0 flex-1"`. **This is the evidence behind the two-kind model.** |
| `src/app/shell/panels/registry.ts` | `PanelRegistryEntry`, `PANEL_REGISTRY`, `PANEL_REGISTRY_BY_ID` | Per-panel static metadata. Gains `sizing` and `defaultHeight` here. |
| `src/components/Shell/FloatingPanel.vue` | `allCollapsed`, `style` (`height: allCollapsed ? 'auto' : entry.height + 'px'`) | A float window whose members are all collapsed already shrinks to `auto`. That rule generalises here. |
| `src/app/shell/panels/resize.ts` | `startPanelResize()`, `PANEL_MIN_HEIGHT` import | The eight float-window handles. Only the constant it clamps against changes. |
| `src/app/shell/panels/layout.ts` | `panelLayout`, `write()`, `writePanelLayout()`, `panelCollapsed()`, `togglePanelCollapsed()` | The reactive/persisted wrapper. Key `open-potlood:panel-layout`; every read and write re-normalises. |
| `src/app/shell/panels/index.ts` | the barrel | Public surface. T-032 (Ready) consumes it. |
| `src/app.css` | `@utility scrollbar-thin` (line 12) | A real Tailwind v4 utility. Do not edit this file. |
| `tests/engine/app/shell/panels/{containers,operations,layout}.test.ts` | `PANEL_BASIS_TOTAL` and `resizePair` assertions at `containers.test.ts:22,232,236-257`, `operations.test.ts:14,66`, `layout.test.ts:9,46-49,215-219` | These must be rewritten. `drop-target.test.ts`, `registry.test.ts` and `snap.test.ts` are unaffected except for the registry additions. |
| `tests/e2e/panels/{basic,stacks}.spec.ts` | the "adjacent expanded float members resize against each other; basis sums stay at 10,000" test at `stacks.spec.ts:153` | The one E2E assertion that reads basis. It becomes a pixel-height assertion. |
| `App/package.json` | `scripts` | `dev`, `lint`, `check:vue`, `test`, `test:unit`. There is **no** `check:i18n`. `App/AGENTS.md` forbids umbrella scripts unless the user asks for that exact command. |

## Read First

1. `src/app/shell/panels/types.ts` — the whole schema, especially `RegisteredPanelState`'s doc comments.
2. `src/app/shell/panels/containers.ts` — `normaliseV3` and its six helpers, then `normaliseBasisAndHeight`, then `migrateV2ToV3`.
3. `src/app/shell/panels/operations.ts` — the dispatcher and `resizePair`.
4. `src/components/Shell/PanelStack.vue` — all 132 lines.
5. `src/components/workspace-panels/WorkspacePanelContent.vue` — `scrollClass` and the five fill-kind branches.

## Corrections to the Brief

- **The per-panel scrollbar has two sources, not one.** `scrollClass` in `WorkspacePanelContent.vue` **and** `overflow-y-auto` on `PanelStack.vue`'s scroll wrapper are both scroll containers today. Removing only one leaves the symptom.
- **"Panels become excessively tall" is not vague.** It has a precise cause, quoted in Verified Starting State: percentage bases summing to 100% while fixed-height collapsed rails and the 3 px insertion indicator are added on top. Fix the arithmetic, do not add a `max-height` band-aid.

## Fixed Decisions

1. **Persisted schema goes to v4; the key does not change.** `PANEL_LAYOUT_KEY` stays `open-potlood:panel-layout`. Reason: `RegisteredPanelState.basis` is replaced by `height`, which is a real persisted-shape change, and `normalisePanelLayout()` already dispatches on `source.version` with an established v1→v2→v3 chain to extend. Silently reinterpreting a stored field would be worse than a versioned step. T-070c later bumps to v5 for tabbed groups; that is a separate packet and not this one's concern.

2. **Every panel is `sizing: 'fill'` or `sizing: 'content'`, declared in `PANEL_REGISTRY`.** `fill` = `pages`, `assets`, `layers`, `ai`, `code`; `content` = `export`, `variables`, `appearance`, `transform`, `text`, `page`, `guides`, `mask`, `component`. Reason: the five `fill` panels each render an internal scroller against a definite parent height (five exact anchors in Verified Starting State) and would collapse to zero in an auto-height parent; the nine `content` panels are exactly the ones carrying `scrollClass`.

3. **Members are sized in pixels plus one grow weight, never `flex-basis: N%`.** Exactly five cases, in this precedence order:
   - collapsed → `{ flex: '0 0 33px', height: '33px' }`
   - `sizing === 'content'` → `{ flex: '0 0 auto' }`
   - `sizing === 'fill'`, `height !== null` → `{ flex: '0 0 <height>px' }`
   - `sizing === 'fill'`, `height === null`, **last** such member in the container → `{ flex: '1 1 0', minHeight: '96px' }`
   - `sizing === 'fill'`, `height === null`, not last → `{ flex: '0 0 <registry defaultHeight>px' }`

   Reason: pixels plus one grow weight cannot overflow by construction, which is exactly what the percentage model could not guarantee.

4. **Leftover container space goes to the last `fill` member with `height === null`.** If a container has no such member, the leftover stays empty at the bottom. Reason: deterministic, one rule, no ambiguity about which panel grows; and it matches what a dock column looks like in the InDesign reference.

5. **`RegisteredPanelState.basis: number` becomes `height: number | null`**, clamped to `[PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]` when non-null. `null` means "use the registry default, or absorb the leftover if this is the last such member". `PANEL_BASIS_TOTAL` and `PANEL_BASIS_MIN` are deleted from `types.ts` and the barrel. Reason: a pinned pixel height is the only value the divider drag and the sizing table need.

6. **`resizePair()` is replaced by `setMemberHeight(layout, container, id, height: number | null)`.** The seam divider between two adjacent expanded members pins the **upper** member's height and leaves the lower one alone (the lower one either absorbs, if it is the last `null` fill member, or keeps its own pinned height). Reason: transferring between a pair only makes sense when the pair jointly owns 100%; with pixel sizing the upper member's height is the whole edit.

7. **The seam divider renders only where a height is actually draggable** — when the member above is `fill`-sized and expanded, and the member below is expanded. A `content` member has no draggable height. Reason: a divider that does nothing is worse than no divider.

8. **`PANEL_MEMBER_MIN_HEIGHT = 96` and `PANEL_MEMBER_MAX_HEIGHT = 640`.** `PANEL_MIN_HEIGHT` is renamed to `PANEL_MEMBER_MIN_HEIGHT` (same value, so `resize.ts` and the float-height invariant are unaffected in behaviour). Reason: 96 preserves today's per-member floor exactly; 640 is the cap that answers "excessively tall" and is comfortably taller than any property panel's natural content at a 900 px viewport.

9. **Exactly one scrollbar per container.** `PanelStack.vue`'s wrapper keeps `overflow-y-auto` and gains `scrollbar-thin`; `scrollClass` in `WorkspacePanelContent.vue` becomes `'flex-1 overflow-x-hidden pb-4'`. The five `fill` panels keep their own internal scroller — that is correct and is not a second column scrollbar, because a `fill` member has a definite height and never contributes to the column's overflow.

10. **A float container's height floor grows with its members.** Invariant 10's `required = expandedCount * PANEL_MEMBER_MIN_HEIGHT + collapsedCount * PANEL_COLLAPSED_HEIGHT` is kept as-is; only the basis half of `normaliseBasisAndHeight()` is deleted, and the function is renamed `normaliseMemberHeights()`.

11. **No new i18n key.** Nothing user-visible gains a label. `App/package.json` has no `check:i18n` script, so a new key would have to be hand-verified for no gain.

## Open Decisions

1. **Is 640 px the right cap for `PANEL_MEMBER_MAX_HEIGHT`?**
   *Recommended default — implement this:* **640.** It is roughly 70 % of a 900 px viewport, leaves room for at least one more member in the column, and no `content` panel's natural height approaches it.
   *Alternative:* make it viewport-relative (e.g. 60 % of the overlay height). Consequence: the clamp would move as the window resizes, so a persisted height could silently change on a monitor swap, and the pure operations would need overlay size injected — breaking their DOM-free contract. Rejected; revisit only if 640 proves cramped on a tall monitor.

## Visual Contract — binding

This packet changes **sizing and overflow only**. No new component, no new colour, no new control. Every class string below is either unchanged from live source or the named minimal edit to it.

### `src/components/Shell/PanelStack.vue`

Scroll wrapper — the existing string plus `scrollbar-thin` (a real `@utility` at `src/app.css:12`):

```
scrollbar-thin flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto
```

Member `section` — class string **unchanged**:

```
relative flex min-h-0 flex-col overflow-hidden
```

Its inline `style` is replaced by exactly one of the five objects in Fixed Decision 3, and nothing else. `minHeight` appears only in the collapsed case (`'33px'`) and the last-fill-grow case (`'96px'`).

Seam divider — class strings **unchanged** from the current between-member divider:

```
absolute inset-x-0 bottom-0 z-10 h-2 cursor-row-resize
```

with the inner hairline

```
pointer-events-none absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border
```

Add `:data-test-id="panel-member-divider-<containerId>-<panelId>"` (there is no test id on it today). Its render condition changes per Fixed Decision 7.

`dock-width-divider`, the `aside`/`div` root, the dock width style object, and `data-container-id` are all **unchanged**.

### `src/components/workspace-panels/WorkspacePanelContent.vue`

```ts
const scrollClass = 'flex-1 overflow-x-hidden pb-4'
```

Nothing else in that file may change — not one template branch.

### Unchanged, do not restyle

`FloatingPanel.vue`'s root frame string and `HANDLE_CLASS`; `DockInsertionTarget.vue`; `PanelOverlay.vue`; `PanelTitleBar.vue`; every `src/components/properties/*Section.vue`; `LayerTree`, `PagesPanel`, `AssetsPanel`, `ChatPanel`, `CodePanel`.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only the semantic tokens already in `src/app.css`.
- **No font-size class other than `text-xs` or `text-[11px]`.** Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded`, `rounded-md` or `rounded-lg`.**
- **No `flex-basis` percentage anywhere in the new sizing code.** This is the defect being fixed.
- **No `max-height` / `max-h-*` band-aid** on a panel body or a member section. The cap belongs in the clamped `height` value, not in CSS.
- **No second scroll container inside a `content` panel body.**
- **No new component file, no new `tv()` recipe, no new npm dependency, no new i18n key.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No new store, composable or reactive singleton.** `panelLayout` in `layout.ts` stays the only panel state.
- **No inline `style=` except** the five member sizing objects, the float container `left`/`top`/`width`/`height`/`zIndex` already in `FloatingPanel.vue`, and the dock `width`/`minWidth`/`maxWidth` already in `PanelStack.vue`.

## Allowed Changes

Modify:

- `src/app/shell/panels/{types,registry,containers,operations,layout,index,resize}.ts`
- `src/components/Shell/PanelStack.vue`
- `src/components/Shell/FloatingPanel.vue` (only if `allCollapsed` or the height style needs the renamed constant)
- `src/components/workspace-panels/WorkspacePanelContent.vue` (the `scrollClass` constant only)
- `tests/engine/app/shell/panels/{containers,operations,layout,registry}.test.ts`
- `tests/e2e/panels/{basic,stacks}.spec.ts`

Create: nothing. Delete: nothing.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No tabs, no tabbed groups, no `PanelGroup` type.** T-070c owns that, including the v4→v5 bump. Do not anticipate it in the type names.
- **No change to the drop-target model.** `DropTarget` stays `{ container, index }`. T-070d owns the union.
- **No new drag handle and no change to `drag.ts`** beyond whatever a renamed constant forces. T-070b owns the float window title bar.
- **No change to the default layout's membership or open set.** `DEFAULT_DOCKS` and `DEFAULT_OPEN` keep their current values; only `DEFAULT_BASIS` is replaced by the equivalent `height` defaults. T-070c owns the new default arrangement.
- **Do not touch `src/app/shell/panels/snap.ts` or `drop-target.ts`**, or their tests.
- **Do not touch `src/app/shell/menu/use.ts` or `app-menu.ts`.** Both read only `panels[id].open`. `tests/engine/app/shell/menu/window-panels.test.ts` must pass **unedited** — that is the proof.
- **Do not touch `src/views/EditorView.vue`.**
- **Do not change any panel's content.** No edit inside `PagesPanel.vue`, `AssetsPanel.vue`, `LayerTree/`, `ChatPanel.vue`, `CodePanel.vue`, or any `src/components/properties/*Section.vue`.
- **Do not change the `localStorage` key** or add a second one.
- **No CanvasKit, scene-graph, `.fig`, export, MCP, Rust or Tauri change.**
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Reread `types.ts`, `containers.ts`, `operations.ts`, `PanelStack.vue`, `WorkspacePanelContent.vue`. Confirm `PANEL_LAYOUT_VERSION === 3`, that `PanelStack.vue` still computes `flexBasis` from `basis / 100`, and that `scrollClass` still contains `overflow-y-auto`. If any has drifted, stop and report before editing.

**2 — `src/app/shell/panels/types.ts`.** Set `PANEL_LAYOUT_VERSION = 4`. Add `export type PanelSizing = 'fill' | 'content'`, `export const PANEL_MEMBER_MIN_HEIGHT = 96`, `export const PANEL_MEMBER_MAX_HEIGHT = 640`. Delete `PANEL_BASIS_TOTAL`, `PANEL_BASIS_MIN` and `PANEL_MIN_HEIGHT` (the last is renamed, not dropped — update its two importers, `containers.ts` and `resize.ts`). On `RegisteredPanelState`, replace `basis: number` with:

```ts
  /**
   * Pinned pixel height for a `fill`-sized panel, clamped to
   * [PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]. `null` means "use the
   * registry default, or absorb the container's leftover space if this is the
   * last such member". Forced to null while collapsed and for a
   * `content`-sized panel, whose height is its own content.
   */
  height: number | null
```

Keep the v2 legacy block at the bottom **byte-identical** and add a v3 legacy block beside it (`PANEL_LAYOUT_VERSION_V3 = 3`, `RegisteredPanelStateV3` carrying `basis`, `FloatContainerV3`, `PanelLayoutV3`), documented the same way the v2 block is and used only by the migration chain.

**3 — `src/app/shell/panels/registry.ts`.** Add `sizing: PanelSizing` and `defaultHeight: number` to `PanelRegistryEntry` and extend the tuple table:

| id | sizing | defaultHeight |
| --- | --- | --- |
| `pages` | `fill` | 200 |
| `assets` | `fill` | 320 |
| `layers` | `fill` | 320 |
| `ai` | `fill` | 420 |
| `code` | `fill` | 380 |
| `export`, `variables`, `appearance`, `transform`, `text`, `page`, `guides`, `mask`, `component` | `content` | 0 |

`defaultDock`, `defaultDockIndex` and `defaultFloating` are unchanged.

**4 — `src/app/shell/panels/containers.ts`.** Rename the existing `normaliseV3` core to `normaliseV3Legacy` and keep it **behaviourally identical**, retyped against the v3 legacy types; it now serves the migration chain only. Add `normaliseV4()` as the live core, copied from it with these changes:
- `normaliseStateV4()` reads `height` instead of `basis`: `null`, or an integer clamped to `[PANEL_MEMBER_MIN_HEIGHT, PANEL_MEMBER_MAX_HEIGHT]`.
- `normaliseBasisAndHeight()` is renamed `normaliseMemberHeights()`; delete its `normaliseMemberBasis` half entirely; keep the float-container `required` floor unchanged.
- add one invariant: `panels[id].height` is forced to `null` when the panel is collapsed or `PANEL_REGISTRY_BY_ID[id].sizing === 'content'`.
Replace `DEFAULT_BASIS` with `DEFAULT_HEIGHT: Partial<Record<PanelId, number>> = { pages: 200 }` and give every other panel `height: null` in `defaultState()`. `DEFAULT_DOCKS` and `DEFAULT_OPEN` keep their current values. Add `migrateV3ToV4(v3: PanelLayoutV3): PanelLayout`: copy `dockWidths`, `docks`, `floats` and every panel state verbatim, dropping `basis` and setting `height: null` for every panel, then return `normaliseV4(...)`. Leave `migrateV1ToV2`, `normalisePanelLayoutV2`, `normaliseBasisV2` and `migrateV2ToV3` byte-identical.

**5 — `src/app/shell/panels/operations.ts`.** Update `normalisePanelLayout()`'s dispatcher to `1` → `migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(value)))`; `2` → `migrateV3ToV4(migrateV2ToV3(normalisePanelLayoutV2(value)))`; `3` → `migrateV3ToV4(normaliseV3Legacy(value))`; `4` → `normaliseV4(value)`; anything else → `defaultPanelLayout()`. Point `cloneLayout()` and every operation's return at `normaliseV4`. Delete `resizePair()` and add:

```ts
/** Pins one member's height in pixels, or clears it to `null` so the member takes its registry default (or absorbs the leftover, if it is the last such member). A no-op for a member that is not in `container`. */
export function setMemberHeight(
  layout: PanelLayout,
  container: ContainerId,
  id: PanelId,
  height: number | null
): PanelLayout
```

clamped by the invariant in Step 4. Every other exported operation keeps its signature and its pure/total/non-throwing contract.

**6 — `src/app/shell/panels/resize.ts`.** Change its `PANEL_MIN_HEIGHT` import to `PANEL_MEMBER_MIN_HEIGHT`. No behavioural change (same value).

**7 — `src/app/shell/panels/layout.ts` and `index.ts`.** Add `setMemberHeight(container, id, height)` as a thin reactive wrapper and `panelSizing(id): PanelSizing`. Remove `resizePair` from both files. In `index.ts`, remove `PANEL_BASIS_MIN`, `PANEL_BASIS_TOTAL`, `PANEL_MIN_HEIGHT`; add `PANEL_MEMBER_MIN_HEIGHT`, `PANEL_MEMBER_MAX_HEIGHT`, `PanelSizing`, `setMemberHeight`, `panelSizing`. Every other export keeps its name.

**8 — `src/components/Shell/PanelStack.vue`.** Add `scrollbar-thin` to the scroll wrapper. Replace the `section`'s `:style` binding with a computed function implementing Fixed Decision 3's five cases; compute "is the last `fill` member with `height === null`" once per container render, not per member. Replace `resizeBetween()` with a handler that pins the **upper** member's height: capture the member's `getBoundingClientRect().height` on `pointerdown`, then on each move write `setMemberHeight(containerId, upperId, startHeight + (move.clientY - startY))`, reusing the existing `useEventListener` stop-list shape verbatim. Change the divider's render condition to Fixed Decision 7 and add its `data-test-id`. `resizeWidth()`, `dock-width-divider`, the root element and `data-container-id` are unchanged.

**9 — `src/components/workspace-panels/WorkspacePanelContent.vue`.** `const scrollClass = 'flex-1 overflow-x-hidden pb-4'`. Nothing else.

**10 — `src/components/Shell/FloatingPanel.vue`.** Only if Step 2's constant rename touches it. Otherwise leave the file alone.

**11 — Unit tests.** Rewrite the `PANEL_BASIS_TOTAL` and `resizePair` assertions in `tests/engine/app/shell/panels/{containers,operations,layout}.test.ts` against `height`. Add, in `containers.test.ts`: `migrateV3ToV4` preserving docks, floats, open set and collapsed flags while nulling every `height`; a stored `version: 3` value loading through the dispatcher without loss; `height` clamping at exactly 95→96 and 641→640; `height` forced to `null` for a collapsed member and for a `content`-sized panel. Add, in `operations.test.ts`: `setMemberHeight` pinning, clearing to `null`, clamping, and no-opping for a member not in the named container. Extend `registry.test.ts`: every `PanelId` has a `sizing`; the `fill` set is exactly `pages`, `assets`, `layers`, `ai`, `code`; every `content` entry has `defaultHeight === 0`. Do **not** edit `snap.test.ts`, `drop-target.test.ts` or `tests/engine/app/shell/menu/window-panels.test.ts`.

**12 — E2E.** Update `tests/e2e/panels/stacks.spec.ts:153` ("adjacent expanded float members resize against each other; basis sums stay at 10,000") to assert pinned pixel heights and the `[96, 640]` clamp instead of a basis sum, keeping the rest of that test's behaviour (frame drag moving every member together) intact. Update `tests/e2e/panels/helpers.ts`'s `ensurePanelOpen()` seed to `version: 4` with `height: null` instead of `basis`. Add to `basic.spec.ts`: with three members docked and one collapsed, the dock's scroll wrapper has `scrollHeight <= clientHeight + 1` (the pre-fix overflow regression), and a `content` panel's body element has `overflow-y` computed as `visible`.

**13 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] `PANEL_LAYOUT_VERSION === 4`; `PANEL_LAYOUT_KEY` unchanged; a stored v1, v2 or v3 value loads without console error and keeps its docks, floats, open set and collapsed flags (`containers.test.ts`).
- [ ] `RegisteredPanelState` has `height: number | null` and no `basis`; `PANEL_BASIS_TOTAL` and `PANEL_BASIS_MIN` appear nowhere in `src/` or `tests/`.
- [ ] `resizePair` appears nowhere; `setMemberHeight` is exported from `layout.ts` and the barrel.
- [ ] Every `PanelId` has a `sizing`; the `fill` set is exactly `pages`, `assets`, `layers`, `ai`, `code` (`registry.test.ts`).
- [ ] No `flex-basis` percentage appears anywhere in the diff.
- [ ] `scrollClass` in `WorkspacePanelContent.vue` is `'flex-1 overflow-x-hidden pb-4'` and contains neither `overflow-y-auto` nor `scrollbar-thin`.
- [ ] A dock with three members, one collapsed, does not overflow its scroll wrapper (`basic.spec.ts` `scrollHeight <= clientHeight + 1`).
- [ ] Each dock and each float body shows exactly **one** scrollbar; the five `fill` panels still scroll internally (Integration Check 2 and 3).
- [ ] A pinned member height clamps to `[96, 640]` in both the pure operation and the divider drag (`operations.test.ts`, Integration Check 4).
- [ ] The seam divider renders only above an expanded `fill` member with an expanded member below it (Integration Check 4).
- [ ] `tests/engine/app/shell/menu/window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` pass **with no edit**.
- [ ] No new file, component, dependency, `tv()` recipe, i18n key, `src/app.css` edit, or Git work; `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` unchanged.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0. `packages/vue/tsconfig.json` is **not** required: no package source changes, and the only package import in the touched files (`useI18n`) is unchanged.
3. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/ src/components/Shell/PanelStack.vue src/components/Shell/FloatingPanel.vue src/components/workspace-panels/WorkspacePanelContent.vue tests/engine/app/shell/panels/ tests/e2e/panels/` — expect exit 0.
4. `bun test tests/engine/app/shell/panels/` — expect exit 0, with no `PANEL_BASIS_TOTAL` or `resizePair` reference remaining.
5. `bun test tests/engine/app/shell/menu/window-panels.test.ts` — expect exit 0 **with that file unedited**.
6. `bunx playwright test tests/e2e/panels/ --project=openpencil` — expect exit 0.
7. `bunx playwright test tests/e2e/layers/panel.spec.ts tests/e2e/pages/ tests/e2e/code/panel.spec.ts tests/e2e/chat/panel.spec.ts tests/e2e/properties/panel.spec.ts tests/e2e/components/assets-panel.spec.ts --project=openpencil` — expect exit 0; the five `fill` panels and the property panels still render and scroll under the new sizing.
8. `bunx playwright test tests/e2e/export/ --project=openpencil` — expect exit 0; the Export panel body and T-069's popover are unaffected by the `scrollClass` change.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or any invented i18n script. `bun run check:i18n` does not exist in `App/package.json`.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **Migration.** With an existing `open-potlood:panel-layout` in `localStorage`, reload. Confirm the same panels are open, in the same docks, in the same order, with the same collapsed states, and the stored value is now `"version":4` with `height` fields and no `basis`.
2. **One scrollbar.** With the right dock's three default panels open and a shape selected, shrink the window vertically until content overflows. Confirm exactly **one** scrollbar down the right dock, not one per panel. Repeat for the left dock.
3. **Fill panels still work.** Confirm Layers and Pages still scroll internally with a definite height and show their rows; open Assets, AI and Code and confirm each renders at a real height rather than collapsing to zero.
4. **Height.** Drag the divider between Pages and Layers. Confirm it pins Pages, stops at 96 px and at 640 px, and persists across a reload. Confirm no divider is offered above a property panel such as Transform.
5. **The overflow regression.** Collapse one panel in a three-panel dock. Confirm the column does **not** gain a scrollbar purely from the collapse — this is the pre-fix bug. Repeat with a floating three-member stack.
6. **Non-regression.** Confirm panel drag, dock, float, collapse, close and reopen all still work; the drop seam indicator still appears and commits; the Window menu checkboxes still open and close panels; View ▸ Reset panel layout still restores the default; the canvas still receives input under a floating window.

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- Pre-flight (Step 1) finds `PANEL_LAYOUT_VERSION !== 3`, or `PanelStack.vue` no longer computing `flexBasis` from `basis`. The tree has drifted.
- A `content`-sized panel renders at zero height in a `flex: 0 0 auto` member. Report which panel and its measured height; do **not** silently move it to `fill`.
- A `fill` panel's internal scroller breaks (Layers or Assets showing no rows) under the new sizing.
- The divider drag cannot pin a height without a second scroll container appearing.
- `window-panels.test.ts`, `snap.test.ts` or `drop-target.test.ts` requires an edit to pass — that means this packet changed a contract it promised not to touch.
- The change needs a new component, dependency, `tv()` recipe, `src/app.css` edit, i18n key, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file modified, with a one-line reason each;
- the final `RegisteredPanelState` declaration and the five sizing cases exactly as implemented;
- **which `src/app/shell/panels/index.ts` exports were added, renamed or removed** — T-032 (Ready) consumes this barrel and its expansion must be reconciled against the delta;
- the `sizing`/`defaultHeight` table as landed;
- the final `scrollClass` string;
- every command from Verification with its exact exit code, test counts and any failure output;
- confirmation that `window-panels.test.ts`, `snap.test.ts` and `drop-target.test.ts` passed unedited;
- the browser observations for all six Integration Check items, at both viewport widths, including the stored JSON's `"version":4`;
- confirmation that no new file, dependency, `src/app.css` edit, i18n key, version-file change, build, install or Git work occurred;
- the Open Decision as resolved, plus any assumption or remaining gap;
- confirmation that no tab, group, drop-target or drag-handle work was anticipated (T-070b/c/d own those).

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1 — 2026-08-20: created as the first slice of the T-070 split, expanded against live `App/` source.

## Status record

Status: **Done**

Execution receipt (2026-08-20):
1. **Types (`types.ts`)**: Bumped `PANEL_LAYOUT_VERSION = 4`. Added `PanelSizing = 'fill' | 'content'`, `PANEL_MEMBER_MIN_HEIGHT = 96`, `PANEL_MEMBER_MAX_HEIGHT = 640`. Replaced `RegisteredPanelState.basis` with `height: number | null`.
2. **Registry (`registry.ts`)**: Added `sizing` and `defaultHeight` across `PANEL_REGISTRY`. Fill panels: `pages` (200), `assets` (320), `layers` (320), `ai` (420), `code` (380). Property panels: `content` (0).
3. **Containers & Migration (`containers.ts`, `legacy.ts`)**: Implemented `normaliseV4`, `defaultPanelLayout`, container helpers, and v1→v2→v3→v4 migration chain.
4. **Operations (`operations.ts`)**: Replaced `resizePair` with `setMemberHeight(layout, container, id, height)` clamped to `[96, 640]`. Version dispatcher upgraded to v4.
5. **Panel Stack (`PanelStack.vue`)**: Replaced flex-basis percentages with 5-case pixel/content/fill sizing. Added `scrollbar-thin` to outer scroll wrapper. Added draggable seam divider above expanded fill members.
6. **Panel Content (`WorkspacePanelContent.vue`)**: Changed `scrollClass` to `'flex-1 overflow-x-hidden pb-4'`.
7. **Verification**:
   - `tsgo --noEmit`: Exit code 0.
   - `vue-tsc --noEmit -p tsconfig.json`: Exit code 0.
   - `oxlint -c oxlint.json --type-aware --type-check`: Exit code 0 (0 errors, 0 warnings).
   - `bun test tests/engine/app/shell/panels/`: Exit code 0 (77 pass, 0 fail).
   - `bun test tests/engine/app/shell/menu/window-panels.test.ts`: Exit code 0 (3 pass, 0 fail).
   - `playwright test tests/e2e/panels/`: Exit code 0 (12 pass, 0 fail).
   - `playwright test tests/e2e/export/`: Exit code 0 (24 pass, 0 fail).
   - `playwright test tests/e2e/pages/`, `code/panel.spec.ts`, `components/assets-panel.spec.ts`: Exit code 0.
