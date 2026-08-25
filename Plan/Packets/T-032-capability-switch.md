# T-032 - Simple | Full capability switch (tool strip)

Task ID: T-032
Packet state: Ready
Packet revision: 4
Project goal link: Plan/endgoal.md
Depends on: T-030 (Done — the versioned-preference pattern), T-027 (Done — `FramePresetPopover`, which Fixed Decision 5 protects)
Related: T-032a (the panel half, deferred behind T-070d), T-033, T-034, T-035, T-036, T-065
Prepared from: the user's 2026-08-07 Canva-like layout request, the 2026-08-11 Affinity persona reference, the 2026-08-17 beginner-audience review, and the 2026-08-20 split decision
Expanded at: 2026-08-20 Africa/Johannesburg
Expanded against: live `App/` source read 2026-08-20 — `packages/core/src/editor/tool-registry.ts`, `packages/vue/src/primitives/Toolbar/ToolbarRoot.vue`, `packages/vue/src/primitives/SegmentedControl/*`, `src/components/Toolbar/{Toolbar,DesktopToolbar,ToolFlyout,ToolButton}.vue`, `src/components/ui/SegmentedControl.vue`, `src/theme/segmented-control.ts`, `src/app/shell/preferences.ts`, `src/app/shell/menu/{schema,use,app-menu}.ts`, `src/app/editor/icons.ts`, `packages/vue/src/i18n/messages/menu.ts`, `App/package.json`, `tests/engine/`, `tests/e2e/toolbar/`
Delivery: named source gates + browser check

## Intended Outcome

A prominent two-segment `Simple | Full` control sits in its own row directly above the desktop tool strip. In **Simple** the strip shows six entries instead of eight, with the advanced tools collected behind a single trailing flyout. In **Full** the toolbar is exactly what it is today. Nothing is removed in Simple: every tool stays selectable from the flyout and by its existing keyboard shortcut. The choice persists globally and is mirrored in the View menu.

## Request Coverage

From the 2026-08-17 review that set this packet's direction:

- One prominent, persistent, always-visible switcher that reduces the visible capability surface for a non-technical user.
- Nothing is removed. Every tool and panel stays reachable in Simple; only its prominence changes.
- Switching either way is lossless and repeatable — no arrangement is ever destroyed.

**Scope cut, stated deliberately (2026-08-20).** This packet delivers the capability *state*, the *switcher*, and the *tool strip* reduction. It changes **no panel behaviour** — in Simple the workspace panels are exactly what they are in Full. The "minimal panel set per capability" half is **T-032a**, which must land after the T-070a–d panel series because it depends on the v5 `PanelGroup` model those packets introduce. Do not anticipate any of it here.

## Verified Starting State

Every row was read in live source on 2026-08-20. Re-read before editing and stop on drift.

| Path (relative to `App/`) | Symbol / selector | Verified fact, and why it matters |
| --- | --- | --- |
| `packages/core/src/editor/tool-registry.ts` | `EditorToolDef { key: Tool; label: string; shortcut: string; flyout?: Tool[] }`; `EDITOR_TOOLS` | **8 top-level entries**: `SELECT` (V), `FRAME` (F, flyout `FRAME/SECTION/SLICE`), `RECTANGLE` (R, flyout `RECTANGLE/LINE/ELLIPSE/POLYGON/STAR`), `PEN` (P, flyout `PEN/PENCIL/BRUSH`), `TEXT` (T), `BARCODE` (no shortcut, flyout `BARCODE/BARCODE_EAN13`), `HAND` (H), `SHAPE_BUILDER` (Shift+M). The toolbar is already lean; the reduction here is modest and honest. |
| `packages/core/src/editor/tool-registry.ts` | `TOOL_SHORTCUTS` | `KeyV→SELECT`, `KeyF→FRAME`, `KeyS→SLICE`, `KeyR→RECTANGLE`, `KeyO→ELLIPSE`, `KeyL→LINE`, `KeyT→TEXT`, `KeyP→PEN`, `KeyN→PENCIL`, `KeyB→BRUSH`, `KeyH→HAND`, `Shift+KeyM→SHAPE_BUILDER`, `KeyM→SHAPE_BUILDER`. **Untouched by this packet** — it is what makes "nothing is removed" true. |
| `packages/vue/src/primitives/Toolbar/ToolbarRoot.vue` | `const { tools = EDITOR_TOOLS } = defineProps<{ tools?: EditorToolDef[] }>()` | **The entire tool-set mechanism is this one optional prop.** It feeds `provideToolbar({ tools, … })` and the `v-slot`. |
| `src/components/Toolbar/Toolbar.vue` | `<ToolbarRoot v-slot="{ tools, activeTool, actions }">` | Passes **no** `tools` prop today, and slots `tools` through to both `DesktopToolbar` and `MobileToolbar`. This is the single mount point for the filtered array. |
| `src/components/Toolbar/Toolbar.vue` | `toolLabels` (computed, from `useI18n().tools`) and `toolShortcuts: Record<Tool, string>` | **Both are already hand-authored here**, and `toolShortcuts` deliberately differs from `EDITOR_TOOLS[].shortcut` (e.g. `SECTION: 'Shift+S'`, `SLICE: 'S'`). Display labels and shortcuts therefore do **not** come from the registry — see Corrections. |
| `src/components/Toolbar/DesktopToolbar.vue` | the outer `div class="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center"` wrapping `div data-test-id="toolbar"` | The bottom-centred desktop strip and its positioned wrapper. **The switcher row mounts inside this wrapper**, above the strip. |
| `src/components/Toolbar/DesktopToolbar.vue` | `v-if="tool.flyout && tool.flyout.length > 1"` | **Load-bearing.** An entry renders as a `ToolFlyout` only when its flyout has more than one member; otherwise it falls to the plain `ToolbarItem`/`ToolButton` branch. |
| `src/components/Toolbar/DesktopToolbar.vue` | `<template v-if="tool.key === 'FRAME'">` → `FramePresetPopover`; `v-else-if="tool.key === 'BARCODE'"` → `BarcodeGeneratorPopover` | **Two popovers are bound to top-level flyout entries by key.** They are reachable only when that tool is a top-level entry *with a flyout of length > 1*. This constrains the whole Simple set — see Fixed Decisions 4 and 5 and Open Decision 1. |
| `src/components/Toolbar/DesktopToolbar.vue` | `isActive(tool)`, `activeKeyForTool(tool)` | Both already treat a flyout member as making its parent entry active, and render the parent button as the active member. A collecting flyout therefore shows the active tool's own icon for free. |
| `src/components/Toolbar/ToolFlyout.vue` | `ToolbarItem v-for="sub in tool.flyout"`, `toolIcons[sub]`, `toolLabels[sub]`, `toolShortcuts[sub]` | Every flyout member is indexed into three `Record<Tool, …>` maps and passed to `ToolbarItem :tool="sub"`. **A synthetic non-`Tool` key would break all four.** |
| `src/app/editor/icons.ts` | `toolIcons` | A `ToolIconMap` covering every `Tool`, including `PENCIL`, `SHAPE_BUILDER`, `BARCODE`, `BARCODE_EAN13`. |
| `src/components/ui/SegmentedControl.vue` | `SegmentedControlProps { options, label?, size?, ui? }`, `defineModel<string>({ required: true })`, `emit('change')`, the `option` slot with `{ option, selected }` | **The app-level wrapper to reuse** — not the raw primitive. It already wires `SegmentedControlRoot`/`SegmentedControlItem` and exposes a `ui` override per theme slot. |
| `src/theme/segmented-control.ts` | `slots.root`, `slots.item` (`h-[22px] … data-[state=on]:bg-panel-selected-muted data-[state=on]:text-surface`), `variants.size.sm/md` | The existing recipe. Its default `h-[22px]` is a property-row size; the `ui` prop is how this packet gets a larger treatment **without a new `tv()` recipe**. |
| `packages/vue/src/primitives/SegmentedControl/SegmentedControlRoot.vue` | `ToggleGroupRoot type="single"`, `rovingFocus` and `loop` default `true` | Roving focus, arrow-key navigation and `data-state="on"` come from the primitive. Do not reimplement them. |
| `src/app/shell/preferences.ts` | `PREFERENCES_VERSION`, `AppPreferences`, `normalise()`, `useLocalStorage('open-potlood:preferences', …, { writeDefaults: false, serializer: { read, write } })`, `appPreferences` computed | **The exact versioned-store shape to copy** for `capability.ts`, including the try/catch read falling back to the default. |
| `src/app/shell/menu/schema.ts` | the View group: `{ id: 'reset-panel-layout', label: 'Reset Panel Layout' }`, then `{ id: 'toggle-ui', label: 'Toggle UI', shortcut: 'MOD+\\' }`, then `profiler` (`target: 'browser'`) and `dev-tools` (`target: 'native'`) | Where the two new checkbox items go. |
| `src/app/shell/menu/use.ts` | the `actions` map, e.g. `'reset-panel-layout': resetPanelLayout` | The native/Tauri action route. |
| `src/app/shell/menu/app-menu.ts` | `translatedMenuItemLabels`, `checkedState()`, `onCheckedChange()` | The browser route: a label mapping, a checked getter and a checkbox setter, all keyed by menu id. |
| `packages/vue/src/i18n/messages/menu.ts` | `view: 'View'` (line 7), `toggleUI` (42), `resetPanelLayout` (43) | English defaults. **T-054 (Done) reduced the app to a single locale** — there are no locale JSON files to update, only `packages/vue/src/i18n/messages/*.ts`. |
| `App/package.json` | `scripts` | `dev`, `lint`, `check:vue`, `test`, `test:unit`. **There is no `check:i18n`.** `App/AGENTS.md` forbids umbrella scripts unless the user asks for that exact command. |
| `tests/engine/app/shell/` | `keyboard/`, `menu/`, `panels/`, `theme.test.ts` | Where both new unit suites go. |
| `tests/engine/tools/` | `ai-adapter.test.ts`, `registry.test.ts`, … | **The AI/MCP tool-registry suite — not the canvas toolbar.** Do not put capability tests here. See Corrections. |
| `tests/e2e/toolbar/` | `basic.spec.ts`, `frame-presets.spec.ts` | The existing toolbar E2E suite, and where the new spec goes. `frame-presets.spec.ts` is the non-regression guard for Fixed Decision 5. |

### The trap that must not be walked into

`CORE_TOOLS` and `EXTENDED_TOOLS` are exported from `packages/core/src/tools/registry.ts` and **look** like a ready-made persona split. They are not. They are `ToolDef` entries for the **AI/MCP agent tool registry**, consumed by `src/app/ai/tools/index.ts`. They have nothing to do with canvas tools. Using them here is a defect, not a shortcut.

## Read First

1. `packages/core/src/editor/tool-registry.ts` — `EditorToolDef`, `EDITOR_TOOLS`, `TOOL_SHORTCUTS`.
2. `packages/vue/src/primitives/Toolbar/ToolbarRoot.vue` — the `tools` prop and `provideToolbar`.
3. `src/components/Toolbar/Toolbar.vue` — the `ToolbarRoot` slot and both hand-authored maps.
4. `src/components/Toolbar/DesktopToolbar.vue` — all 78 lines, especially the `flyout.length > 1` test and the two popover special cases.
5. `src/components/Toolbar/ToolFlyout.vue` — how a flyout member is indexed and rendered.
6. `src/components/ui/SegmentedControl.vue` and `src/theme/segmented-control.ts`.
7. `src/app/shell/preferences.ts` — the store shape to copy.

## Corrections to the Brief

Revision 3 was written on 2026-08-17 and is right about the tool-set seam, but four of its instructions do not survive contact with live source. Each is corrected by a Fixed Decision below.

- **"In Simple, `FRAME`'s flyout is reduced to `['FRAME']`."** This would silently break T-027. `DesktopToolbar.vue` renders a `ToolFlyout` only when `flyout.length > 1`; a one-member flyout falls to the plain `ToolButton` branch, and `FramePresetPopover` — which is bound to `tool.key === 'FRAME'` *inside* the flyout branch — would disappear. **Corrected by Fixed Decision 5: `FRAME` keeps its flyout unchanged.**
- **"Do not hand-author tool labels, icons or shortcut strings; derive them."** Display labels and shortcuts are **already** hand-authored in `Toolbar.vue`'s `toolLabels` and `toolShortcuts` maps, and `toolShortcuts` deliberately disagrees with `EDITOR_TOOLS[].shortcut` (`SECTION: 'Shift+S'` there vs `TOOL_SHORTCUTS` mapping `KeyS → SLICE`). Deriving them from the registry would change what the tooltips say. **Corrected by Fixed Decision 6: `simpleToolSet()` derives only `key`, `label`, `shortcut` and `flyout` structure from `EDITOR_TOOLS`; the two display maps are untouched.**
- **Step 9's test paths do not exist.** There is no `tests/engine/components/toolbar/`; `tests/engine/tools/` is the AI/MCP registry suite. There is no `tests/e2e/workspace/`. **Corrected in Verification.**
- **`bun run check:i18n` does not exist**, and T-054 (Done) removed every locale file, so "all locale JSON" is stale. **Corrected by Fixed Decision 10.**

One further correction, to revision 3's shortcut test list: it names `Shift+S` for a hidden tool, but `TOOL_SHORTCUTS` maps `KeyS → SLICE` and both `KeyM` and `Shift+KeyM` → `SHAPE_BUILDER`. The correct hidden-tool shortcut set to test is `P`, `N`, `B`, `M` and `Shift+M`.

## Fixed Decisions

1. **Capability state lives in a new `src/app/shell/capability.ts`**, copying `preferences.ts`'s shape exactly: `useLocalStorage` with `writeDefaults: false` and a `serializer` whose `read` is a `try`/`catch` around `normalise(JSON.parse(value))`. Type `Capability = 'simple' | 'full'`; record `{ version: 1, capability: Capability }`; key `open-potlood:capability`. Exports: `appCapability` (computed record), `capability` (computed `Capability`), `isSimple` (computed boolean), `setCapability(value)`. Reason: one proven local pattern, already used by T-030, with no new dependency.

2. **Invalid JSON, wrong version or unknown value normalises to `'full'`, never `'simple'`.** Reason: this is the user's own production tool. Corrupt storage must never silently take their toolbar away.

3. **State is global and app-wide** — not per tab, not per document, never written into `.fig` or document plugin data. Reason: it is a shell presentation preference, exactly like `open-potlood:preferences`.

4. **Simple's tool set is built by a pure `simpleToolSet(tools: EditorToolDef[]): EditorToolDef[]`** in a new `src/components/Toolbar/capability-tools.ts`, and yields these **six** entries in this order:

   | # | `key` | `flyout` | Renders as |
   | --- | --- | --- | --- |
   | 1 | `SELECT` | — | plain button |
   | 2 | `FRAME` | `FRAME, SECTION, SLICE` (unchanged) | flyout + `FramePresetPopover` |
   | 3 | `RECTANGLE` | `RECTANGLE, LINE, ELLIPSE, POLYGON, STAR` (unchanged) | flyout |
   | 4 | `TEXT` | — | plain button |
   | 5 | `HAND` | — | plain button |
   | 6 | `PEN` | `PEN, PENCIL, BRUSH, SHAPE_BUILDER, BARCODE, BARCODE_EAN13` | flyout — the collecting "More" entry |

   Entry 6's `key` is the **real tool `PEN`**, not a synthetic `'MORE'` sentinel. Reason: `toolIcons`, `toolLabels` and `toolShortcuts` are all `Record<Tool, …>` and `ToolbarItem` takes a `:tool="Tool"`, so a synthetic key would break four call sites and force a `tool-registry.ts` edit that the Banned List forbids. With `key: 'PEN'`, `DesktopToolbar`'s existing `activeKeyForTool()` already makes the button show whichever hidden tool is active, and neither popover special case fires. Every entry is derived from the `tools` argument — never hand-written — so a future edit to `EDITOR_TOOLS` cannot silently desync.

5. **`FRAME` and `RECTANGLE` keep their flyouts unchanged in Simple.** Reason: reducing `FRAME`'s to one member drops it below `DesktopToolbar`'s `flyout.length > 1` test and would silently remove `FramePresetPopover` (T-027) — see Corrections. Shapes are beginner content, so `RECTANGLE` was never a candidate.

6. **`simpleToolSet()` derives `key`, `label`, `shortcut` and flyout membership from its input**, and this packet does not touch `Toolbar.vue`'s `toolLabels` or `toolShortcuts` maps, `TOOL_SHORTCUTS`, or `tool-registry.ts`. Reason: see Corrections. Display text keeps coming from where it already comes from.

7. **Every keyboard shortcut keeps working in Simple, including for tools behind the collecting flyout.** `TOOL_SHORTCUTS` is untouched, and `ToolbarRoot`'s `tools` prop affects rendering only. Capability changes prominence, never capability.

8. **Full passes `EDITOR_TOOLS` explicitly**, not `undefined`. `Toolbar.vue` binds `:tools="isSimple ? simpleToolSet(EDITOR_TOOLS) : EDITOR_TOOLS"`. Reason: behaviourally identical to today (the prop's default *is* `EDITOR_TOOLS`) but explicit at the call site, so a reader of `Toolbar.vue` can see both branches.

9. **The switcher reuses `src/components/ui/SegmentedControl.vue`**, the app-level wrapper — not the raw primitive — with the larger treatment supplied through its existing `ui` prop. Reason: the wrapper already handles `v-model`, the `option` slot, `aria-label` and per-slot class overrides; the `ui` seam gets a prominent size **without a new `tv()` recipe**, which the Banned List forbids.

10. **Three new i18n keys in `packages/vue/src/i18n/messages/menu.ts` only**: `capability: 'Capability'`, `capabilitySimple: 'Simple'`, `capabilityFull: 'Full'`. Reason: T-054 (Done) reduced the app to English-only `messages/*.ts`; there are no locale JSON files. There is no `check:i18n` script, so the check is a read-back assertion in the menu unit suite.

11. **The switcher renders on the desktop chrome branch only.** Mobile, dashboard, `showUI=false` and `?no-chrome` render no switcher and are otherwise untouched. Reason: `DesktopToolbar.vue` is already desktop-only via `Toolbar.vue`'s `v-if="!isMobile"`, so mounting inside it inherits the gate for free.

12. **Bottom-row ordering, fixed.** Bottom-most first: **T-065 page-strip band** (full width, a real layout band), then floating and centred above it, **tool strip**, then **T-036 property row**, then **this capability switcher** as the topmost floating row. Whichever of those packets lands second must not re-litigate this order.

13. **No panel behaviour changes.** `src/app/shell/panels/` is not touched, `PANEL_LAYOUT_KEY` and `PANEL_LAYOUT_VERSION` are not touched, and `resetPanelLayout()` keeps its current scope. Reason: the 2026-08-20 split — T-032a owns the panel half and must follow T-070d.

## Open Decisions

1. **In Simple, `BarcodeGeneratorPopover` becomes unreachable, because it is bound to a top-level `BARCODE` entry.** The `BARCODE` and `BARCODE_EAN13` *tools* stay fully selectable from the collecting flyout, but the *generator popover* is Full-only.
   *Recommended default — implement this:* **accept it.** Barcode generation is not beginner content, and Full is one click away. Record it in the Execution Report as a known Simple limitation rather than pretending nothing changed.
   *Alternative:* keep `BARCODE` as a seventh top-level entry in Simple. Consequence: the strip becomes seven of eight, the reduction is barely perceptible, and the switcher stops earning its row. Rejected — but this is the one-line change if the user disagrees after using it.

## Visual Contract — binding

### New file — `src/components/Toolbar/CapabilitySwitcher.vue`

No props. Reads `capability`/`setCapability` from `@/app/shell/capability` and `menu` from `useI18n()`.

Root: `src/components/ui/SegmentedControl.vue`, bound as

```
:options="[{ value: 'simple', label: menu.capabilitySimple }, { value: 'full', label: menu.capabilityFull }]"
:label="menu.capability"
size="md"
v-model="model"
data-test-id="capability-switcher"
```

with the prominent treatment supplied **only** through the existing `ui` prop — no new recipe, no wrapper div with its own background:

```ts
const switcherUi = {
  root: 'gap-1 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md',
  item: 'h-8 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-accent'
}
```

(`rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md` is copied verbatim from `DesktopToolbar.vue`'s strip container so the two rows read as one control family. The `data-[state=on]:` selectors match the recipe's own idiom in `src/theme/segmented-control.ts`; the inherited `data-[state=on]:bg-panel-selected-muted data-[state=on]:text-surface` stay, so the active segment carries **fill plus weight plus ring** — never colour alone.)

Each segment uses the `option` slot to render an icon before the label:

| Segment | `value` | `data-test-id` | Icon | Label |
| --- | --- | --- | --- | --- |
| Simple | `simple` | `capability-simple` | `<icon-lucide-sparkles class="size-3.5" />` | `menu.capabilitySimple` |
| Full | `full` | `capability-full` | `<icon-lucide-sliders-horizontal class="size-3.5" />` | `menu.capabilityFull` |

Label span inside the slot: `class="truncate"` (matching the wrapper's own default slot content).

### `src/components/Toolbar/DesktopToolbar.vue`

The outer positioned wrapper gains a column axis and a gap; **its position classes do not change**:

```
absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2
```

`CapabilitySwitcher` renders as the **first** child, above the existing `data-test-id="toolbar"` div. The strip div's own class string is unchanged. Cap the switcher row with `max-w-[calc(100vw-32px)]` and allow horizontal overflow rather than hiding a label or shrinking the tool strip.

### Unchanged, do not restyle

`ToolButton.vue`, `ToolFlyout.vue` (including its `rounded-xl` flyout content — pre-existing, out of scope), `MobileToolbar.vue`, `FramePresetPopover.vue`, `BarcodeGeneratorPopover.vue`, `src/theme/segmented-control.ts`, `src/components/ui/SegmentedControl.vue`.

### Banned List

- **No literal colour of any kind** — no hex, `rgb()`, `hsl()`, or Tailwind palette names (`bg-zinc-800`, `text-gray-400`). Only semantic tokens: `bg-panel`, `text-surface`, `text-muted`, `border-border`, `bg-hover`, `bg-accent`, `ring-accent`, `bg-panel-selected-muted`.
- **No font-size class other than `text-xs` or `text-[11px]`.** Never `text-sm`, `text-base`, `text-lg`.
- **No radius other than `rounded`, `rounded-md` or `rounded-lg`.** Never `rounded-xl`, `rounded-2xl`, `rounded-full` in new code.
- **Do not use `CORE_TOOLS` or `EXTENDED_TOOLS`** from `packages/core/src/tools/registry.ts`.
- **Do not edit `tool-registry.ts`, `EDITOR_TOOLS` or `TOOL_SHORTCUTS`.**
- **Do not hand-author tool keys, labels, shortcuts or flyout members** inside `simpleToolSet()` — derive every field from the function's `tools` argument.
- **Do not remove, disable or unregister any tool, panel or command in Simple.**
- **Do not touch `src/app/shell/panels/` at all**, or `PANEL_LAYOUT_KEY`, `PANEL_LAYOUT_VERSION`, or `resetPanelLayout()`'s scope. T-032a owns that.
- **No new `tv()` recipe** and no edit to `src/theme/segmented-control.ts` — use the `ui` prop.
- **No new npm dependency.**
- **No `@apply`, no new global CSS, no edit to `src/app.css`.**
- **No third segment**, no `Focus`, no `Overview`, and no reference to Canva or Affinity in code, labels or comments.
- **No inline `style=`** anywhere in the new component.
- **No build, install, or version bump** (2026-08-14 delivery policy).

## Allowed Changes

Create:

- `src/app/shell/capability.ts`
- `src/components/Toolbar/capability-tools.ts`
- `src/components/Toolbar/CapabilitySwitcher.vue`
- `tests/engine/app/shell/capability.test.ts`
- `tests/engine/app/shell/capability-tools.test.ts`
- `tests/e2e/toolbar/capability.spec.ts`

Modify:

- `src/components/Toolbar/Toolbar.vue` (the `:tools` binding and its `EDITOR_TOOLS` import)
- `src/components/Toolbar/DesktopToolbar.vue` (the wrapper's axis/gap and the switcher row)
- `src/app/shell/menu/schema.ts` (two View items)
- `src/app/shell/menu/use.ts` (two actions)
- `src/app/shell/menu/app-menu.ts` (label map, checked state, checked change)
- `packages/vue/src/i18n/messages/menu.ts` (three keys)
- `tests/engine/app/shell/menu/window-panels.test.ts` **only if** a menu-schema addition genuinely breaks it — if it does, stop and report first

Delete: nothing.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No panel work whatsoever** (Fixed Decision 13). No second layout key, no Simple panel default, no reset re-scoping. T-032a owns all of it and depends on T-070d.
- **No Focus behaviour** (T-033), **no Overview** (T-034), **no page strip** (T-065), **no canvas fit** (T-066), **no smart defaults** (T-067), **no contextual surfaces** (T-035/T-036).
- **No mobile, dashboard, `showUI=false` or `?no-chrome` behaviour change.** `MobileToolbar.vue` receives the same `tools` array through the existing slot; confirm it renders sensibly but do not redesign it. If Simple's array visibly harms mobile, gate the filter to the desktop branch and say so.
- **No scene-graph, CanvasKit, document, export or MCP change.** No templates, onboarding, tour or first-run experience.
- **No Git work**, no version bump in `package.json` / `desktop/tauri.conf.json` / `desktop/Cargo.toml`, no build, no NSIS install, no `bun install`.
- **No umbrella command** — not `bun run check`, `bun run test`, `bun run test:unit`, `bun run lint`, `bun run build`.

## Implementation Steps

**1 — Pre-flight.** Reread every Verified Starting State row. Confirm `EDITOR_TOOLS` is still 8 entries with those exact flyouts, that `ToolbarRoot`'s `tools` prop is still optional with an `EDITOR_TOOLS` default, that `Toolbar.vue` still passes no `tools` prop, that `DesktopToolbar.vue` still gates flyouts on `flyout.length > 1` and still binds both popovers by `tool.key`, and that `src/components/ui/SegmentedControl.vue` still exposes the `ui` prop and `option` slot. Stop on drift.

**2 — `src/app/shell/capability.ts`.** Add the versioned store per Fixed Decisions 1–3, copying `preferences.ts`'s structure line for line: `CAPABILITY_VERSION = 1`, an `AppCapability` interface, `DEFAULT_CAPABILITY`, a `normalise(value: unknown): AppCapability` that returns `'full'` for anything it does not recognise, the `useLocalStorage` call with `writeDefaults: false` and the try/catch serializer, then `appCapability`, `capability`, `isSimple` and `setCapability`.

**3 — `src/components/Toolbar/capability-tools.ts`.** Add pure `simpleToolSet(tools: EditorToolDef[]): EditorToolDef[]` producing Fixed Decision 4's six entries. Look every entry up in `tools` by `key` and spread it; for entry 6, spread the `PEN` entry and replace only its `flyout` with the collected hidden members, gathering them by walking `tools` rather than listing them literally. If a `key` is absent from `tools`, omit that entry rather than throwing — the function must be total. Add a file-level comment naming `CORE_TOOLS`/`EXTENDED_TOOLS` as the trap and why this file does not use them.

**4 — `src/components/Toolbar/CapabilitySwitcher.vue`.** Build to the Visual Contract. `const model = computed({ get: () => capability.value, set: (v) => setCapability(v as Capability) })`.

**5 — `src/components/Toolbar/DesktopToolbar.vue`.** Add `flex-col items-center gap-2` to the outer wrapper (keeping `absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2`) and render `<CapabilitySwitcher />` as its first child with the `max-w-[calc(100vw-32px)]` cap. Change nothing else in the file.

**6 — `src/components/Toolbar/Toolbar.vue`.** Import `EDITOR_TOOLS` from `@open-pencil/core/editor`, `isSimple` from `@/app/shell/capability` and `simpleToolSet` from `@/components/Toolbar/capability-tools`. Bind `:tools="isSimple ? simpleToolSet(EDITOR_TOOLS) : EDITOR_TOOLS"` on `ToolbarRoot`. Change nothing else — in particular, leave `toolLabels` and `toolShortcuts` exactly as they are.

**7 — View menu.** In `schema.ts`, add `{ id: 'capability-simple', label: 'Simple', checkbox: true }` and `{ id: 'capability-full', label: 'Full', checkbox: true }` immediately after `reset-panel-layout` and before `toggle-ui`. In `use.ts`, add both to the `actions` map calling `setCapability('simple' | 'full')`. In `app-menu.ts`, add both to `translatedMenuItemLabels` (→ `capabilitySimple` / `capabilityFull`), to `checkedState()` (returning `capability.value === 'simple' | 'full'`), and to `onCheckedChange()` so ticking either sets that capability. Browser and native routes must be behaviourally identical.

**8 — i18n.** Add the three keys from Fixed Decision 10 to `panelMessageDefaults`' menu counterpart in `packages/vue/src/i18n/messages/menu.ts`. No locale files exist to update.

**9 — Unit tests.** `tests/engine/app/shell/capability.test.ts`: default is `'full'`; a valid `'simple'` record round-trips; corrupt JSON, a wrong `version`, a missing field, and an unknown capability string each yield `'full'`; `setCapability` persists. `tests/engine/app/shell/capability-tools.test.ts`: `simpleToolSet(EDITOR_TOOLS)` returns exactly six entries in the fixed order; `FRAME`'s flyout is unchanged at three members and `RECTANGLE`'s at five (**the T-027 guard**); entry 6 has `key === 'PEN'` and a flyout of exactly `PEN, PENCIL, BRUSH, SHAPE_BUILDER, BARCODE, BARCODE_EAN13`; **every `key` and every flyout member across `EDITOR_TOOLS` is reachable somewhere in the Simple output**; every returned `label` and `shortcut` is identical to the corresponding `EDITOR_TOOLS` value rather than a literal; and the function is total for an empty array and for an input missing `PEN`. Add a read-back assertion in `tests/engine/app/shell/menu/` that the three new menu keys exist and are non-empty (this replaces the non-existent `check:i18n`).

**10 — E2E.** `tests/e2e/toolbar/capability.spec.ts`: the switcher is visible above the strip with both segments carrying an icon and a visible label; Full shows eight top-level entries and Simple shows six; the collecting flyout opens and every hidden tool is selectable from it; `P`, `N`, `B`, `M` and `Shift+M` each still select their tool while in Simple (**Fixed Decision 7**); the frame-preset popover still opens in Simple (**Fixed Decision 5**); arrow-key roving focus moves between segments and Enter/Space activates; the choice persists across a reload; corrupt `open-potlood:capability` yields Full; the View-menu items match the switcher both ways; the switcher is absent on mobile, dashboard, `showUI=false` and `?no-chrome`; the strip stays usable at 1100 px.

**11 — Focused verification.** Run the Verification section's commands in order, then the Integration Check.

## Acceptance Criteria

- [ ] A prominent two-segment `Simple | Full` switcher sits in its own row above the tool strip, icon plus visible label on both segments, without displacing any drawing tool.
- [ ] Simple shows exactly six top-level entries — `SELECT`, `FRAME`, `RECTANGLE`, `TEXT`, `HAND`, and the collecting `PEN` flyout — and Full shows today's eight, unchanged.
- [ ] Every tool hidden in Simple is reachable from the collecting flyout **and** by its existing keyboard shortcut (`P`, `N`, `B`, `M`, `Shift+M`).
- [ ] `FramePresetPopover` still opens in Simple (`tests/e2e/toolbar/frame-presets.spec.ts` green, plus the new spec's own case).
- [ ] `simpleToolSet()` derives every field from its argument; no tool key, label, shortcut or flyout member is written as a literal (`capability-tools.test.ts`).
- [ ] Corrupt, missing, wrong-version or unknown capability storage yields `Full` (`capability.test.ts`).
- [ ] Active segment is legible in light, grey, dark and midnight through fill **plus** weight **plus** ring — never colour alone; roving focus and Enter/Space activation work (Integration Check 4 and 5).
- [ ] View-menu state matches the switcher on both browser and native routes.
- [ ] `src/app/shell/panels/` is untouched in the diff; `PANEL_LAYOUT_KEY`, `PANEL_LAYOUT_VERSION` and `resetPanelLayout()` are unchanged.
- [ ] `tool-registry.ts`, `EDITOR_TOOLS`, `TOOL_SHORTCUTS`, `Toolbar.vue`'s `toolLabels`/`toolShortcuts`, and `src/theme/segmented-control.ts` are unchanged in the diff.
- [ ] `CORE_TOOLS` and `EXTENDED_TOOLS` appear nowhere in the diff.
- [ ] Mobile, dashboard, `showUI=false`, `?no-chrome`, tool flyouts, canvas input, document data and exports are unchanged; `tests/e2e/toolbar/basic.spec.ts` stays green.
- [ ] Nothing in the Banned List appears in the diff; no new dependency, `tv()` recipe, `src/app.css` edit, version bump, build, install or Git work.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`, in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0.
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` — expect exit 0, because `packages/vue/src/i18n/messages/menu.ts` changed.
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/capability.ts src/components/Toolbar/ src/app/shell/menu/ packages/vue/src/i18n/messages/menu.ts tests/engine/app/shell/ tests/e2e/toolbar/` — expect exit 0.
5. `bun test tests/engine/app/shell/capability.test.ts tests/engine/app/shell/capability-tools.test.ts tests/engine/app/shell/menu/` — expect exit 0.
6. `bunx playwright test tests/e2e/toolbar/ --project=openpencil` — expect exit 0 across `basic.spec.ts`, `frame-presets.spec.ts` and the new `capability.spec.ts`.
7. `bunx playwright test tests/e2e/tools/ tests/e2e/keyboard/ --project=openpencil` — expect exit 0; tool selection and shortcuts are unaffected. If either directory does not exist at execution time, say so in the Execution Report rather than substituting another suite.

Do not run `bun run check`, `bun run check:vue`, `bun run lint`, `bun run test`, `bun run test:unit`, `bun install`, a build, an install, or `bun run check:i18n` — that last script **does not exist**.

## Integration or Installed-Result Check

Run `bun run dev` from `App/` (Vite, port 1420). Check at ≥ 1440 px wide, then at 1100 px:

1. **Default.** With `open-potlood:capability` cleared, confirm the app starts in **Full** with today's eight-entry strip and the switcher showing Full active.
2. **Simple.** Click Simple. Confirm six entries; that the sixth shows the pen icon with a flyout chevron; that opening it lists Pen, Pencil, Brush, Shape Builder, Barcode and EAN-13 with their own icons and shortcut text; and that selecting any one makes the sixth button adopt that tool's icon.
3. **Nothing removed.** In Simple press `P`, `N`, `B`, `M` and `Shift+M` in turn and confirm each selects its tool. Open the Frame flyout and confirm the frame-size preset popover still works. Confirm the Rectangle flyout still offers all five shapes.
4. **Prominence and themes.** Cycle light, grey, dark and midnight. Confirm the active segment is identifiable by fill, weight and ring — squint-test it with colour discounted — and that the switcher row reads as the same control family as the strip below it.
5. **Keyboard.** Tab to the switcher, arrow between segments (focus ring visible, wrapping at the ends), and activate with Enter and with Space.
6. **Persistence and recovery.** Reload and confirm the capability survives. Then set `open-potlood:capability` to `"{ broken"` and to `{"version":9,"capability":"simple"}` in turn, reload after each, and confirm both yield **Full**.
7. **Menu parity.** Open View: confirm Simple and Full appear as checkboxes with exactly one ticked, that ticking either switches the toolbar, and that the tick follows a change made from the switcher.
8. **Non-regression.** Confirm the tool strip is not displaced or clipped at 1100 px; the canvas still receives input; the switcher is absent on mobile width, on the dashboard tab, with `showUI=false`, and with `?no-chrome`; and that panels behave exactly as before in both capabilities (this packet changes none).

This browser proof is sufficient for a source-only Vue/TypeScript change. **It is not installed-desktop proof.** Do not build, install, or bump a version file unless the user separately authorises desktop delivery in that session.

## Stop Conditions

- Pre-flight finds `EDITOR_TOOLS` no longer 8 entries, `ToolbarRoot`'s `tools` prop no longer optional, `DesktopToolbar.vue` no longer gating flyouts on `flyout.length > 1`, or either popover no longer bound by `tool.key`. The tree has drifted from this expansion.
- `ToolbarRoot`'s `tools` prop turns out not to resolve `activeTool` correctly for a tool that is only a flyout member of the collecting entry.
- Giving the collecting entry `key: 'PEN'` produces a wrong icon, a wrong tooltip, or an unexpected popover.
- The prominent treatment cannot be achieved through `SegmentedControl.vue`'s `ui` prop without editing `src/theme/segmented-control.ts` or adding a recipe.
- Passing a filtered array through the shared slot visibly breaks `MobileToolbar.vue`. Gate the filter to the desktop branch and report that you did.
- The menu-schema addition breaks `tests/engine/app/shell/menu/window-panels.test.ts`.
- The user wants Simple to actually *prevent* advanced operations rather than only reduce their prominence. That is command-level gating — a new packet, not a variation of this one.
- The change needs a new dependency, a new `tv()` recipe, an `src/app.css` edit, a `tool-registry.ts` edit, any `src/app/shell/panels/` edit, or a file outside Allowed Changes.
- Any named source gate, focused test or browser behaviour fails. Record the exact command, exit code and output; do not weaken an acceptance criterion to make it pass.

## Execution Report Contract

Report:

- every file created and modified, with a one-line reason each;
- `simpleToolSet()`'s output as landed — all six entries with their flyout members — and confirmation it was derived, not hand-written;
- confirmation, by grep output, that `tool-registry.ts`, `TOOL_SHORTCUTS`, `Toolbar.vue`'s two display maps, `src/theme/segmented-control.ts` and all of `src/app/shell/panels/` are unchanged, and that `CORE_TOOLS`/`EXTENDED_TOOLS` appear nowhere;
- the final `switcherUi` strings and the three `data-test-id` values;
- every command from Verification with its exact exit code, test counts and any failure output;
- the browser observations for all eight Integration Check items, at both viewport widths, including both corrupt-storage results;
- screenshots or bounding boxes of the Simple and Full strips, the collecting flyout's contents, and the switcher in all four themes;
- **Open Decision 1 as resolved**, stated plainly as a known Simple limitation if the default was implemented;
- confirmation that no dependency, `tv()` recipe, `src/app.css` edit, panel change, version-file change, build, install or Git work occurred;
- any assumption or remaining gap, and an explicit note that the panel half remains open as T-032a.

Do not claim delivery. This packet stops at source gates plus the browser check.

## Revision History

- Revision 1–2 — 2026-08-11: specified a `Workspace | Focus | Overview` layout switcher with two segments shipping visibly disabled. Superseded in full by the 2026-08-17 review; the file `T-032-toolbar-layout-switcher.md` is retained on disk as dead reference only.
- Revision 3 — 2026-08-17: re-cast as a `Simple | Full` capability switch. Established `ToolbarRoot`'s optional `tools` prop as the tool-set seam, recorded the `CORE_TOOLS`/`EXTENDED_TOOLS` trap, and proposed two capability-keyed panel records.
- Revision 4 — 2026-08-20: split at the user's instruction — the panel half moved to T-032a behind T-070d. Re-expanded to the current packet standard against live source; corrected four instructions from revision 3 that do not survive contact with the tree (see Corrections), closed the collecting-flyout key design, and re-pointed every test path at a directory that exists.

## Status record

Status: **Done**

Expansion receipt (2026-08-20). Verified against live source:

1. **Revision 3's tool-set seam is correct**: `EDITOR_TOOLS` is 8 entries with exactly the recorded flyouts, `ToolbarRoot`'s `tools` prop is optional and defaults to `EDITOR_TOOLS`, and `Toolbar.vue` passes no `tools` prop today, so a filtered array reaches both branches through the existing slot.
2. **Reducing `FRAME`'s flyout would have broken T-027.** `DesktopToolbar.vue` renders a flyout only when `flyout.length > 1`, and `FramePresetPopover` is bound inside that branch by `tool.key === 'FRAME'`. Revision 3's instruction is corrected here.
3. **Labels and shortcuts are already hand-authored** in `Toolbar.vue`, and `toolShortcuts` deliberately disagrees with `EDITOR_TOOLS[].shortcut`. Revision 3's "derive them from the registry" would have changed every tooltip.
4. **A synthetic `'MORE'` key was not viable** — `toolIcons`, `toolLabels`, `toolShortcuts` and `ToolbarItem` are all keyed by `Tool`. Using the real `PEN` key gives the collecting flyout for free through `activeKeyForTool()`, with no type or registry change.
5. **Three of revision 3's prescribed paths do not exist**: `tests/engine/components/toolbar/`, `tests/e2e/workspace/`, and the `check:i18n` script. `tests/engine/tools/` is the AI/MCP registry suite — the very trap revision 3 warned about.
6. **T-054 (Done) removed every locale file**, so "all locale JSON" is stale; the three new keys go in `packages/vue/src/i18n/messages/menu.ts` alone, verified by a unit read-back.
7. **`src/components/ui/SegmentedControl.vue` already exposes a `ui` prop**, so the prominent treatment needs no new `tv()` recipe and no theme edit.

One Open Decision was left with an implemented default: `BarcodeGeneratorPopover` becomes Full-only in Simple, because it is bound to a top-level entry. It is a taste call with a stated one-line reversal and does not block execution.
