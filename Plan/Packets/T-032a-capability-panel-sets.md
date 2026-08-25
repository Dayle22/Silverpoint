# T-032a - Per-persona panel sets, without mutating any arrangement

Task ID: T-032a
Packet state: Blocked (dependency lock - see Dependency Lock)
Packet revision: 5
Project goal link: Plan/endgoal.md
Depends on: T-032 (Done); T-070d1, T-070d2a, T-070d2b, T-070d3 (all Done); **T-084 (persona model, Brief)**; **T-085 (prototype panel, Brief)**
Related: T-035, T-036 (contextual property surfaces, both Ready not Done); T-073 (persona switcher placement and Essential workflow)
Prepared from: the 2026-08-17 beginner-audience review's panel half, split out of T-032 by the user's 2026-08-20 decision, and re-cast by the user's 2026-08-24 three-persona decision
Expanded at: 2026-08-24 (third expansion) Africa/Johannesburg
Expanded against: live post-T-070d3 `App/` source named below. `Plan/plan.md` reread 2026-08-24.
Delivery: named source gates + browser check
Execution size: 4 core implementation files (`types.ts`, `containers.ts`, `layout.ts`, `index.ts`); 2 existing test files across 2 suites (Bun unit + Playwright E2E); one storage-routing responsibility, so no split

## Dependency Lock

**This packet was Ready at Revision 4 and is deliberately returned to Blocked.** Two dependencies must land first:

1. **T-084 - persona model.** Revision 4 branched on `isSimple`, a boolean. A three-persona model cannot be selected by a boolean. Until `capability.ts` exports three values, the record-selection map specified below cannot be written.
2. **T-085 - prototype panel.** Dev's factory names `prototype`, which is **not** in `PANEL_IDS` today. The Dev literal will not typecheck before T-085 registers it.

Do not begin Implementation Step 1 until both show Done in `Plan/plan.md`. Do not work around either by inlining a string literal, casting, or shipping Dev without its prototype panel.

## Intended Outcome

Essential, Advanced and Dev each remember their own panel arrangement. Switching persona selects a different persisted record without running a panel operation and without writing any record. Advanced keeps the existing `open-potlood:panel-layout` value; Essential and Dev use new suffixed keys. Reset affects only the active persona.

## Request Coverage

The panel half of the beginner-audience review, re-cast for three personas:

- Essential has a minimal permanent panel set aimed at a non-designer; Advanced is unchanged; Dev differs from Advanced only in defaults.
- Each persona remembers its panel arrangement independently.
- Switching is repeatable and lossless: no arrangement is mutated merely by selecting it.

T-084 owns the persona model. T-073 owns switcher placement and broader Essential usefulness. T-085 owns the prototype panel. This packet adds no control, styling or string.

## Persona intent (inherited from T-084, binding here)

**Essential targets the everyday person who is not a designer.** Its default panel set must be justified against "can a non-designer succeed with this", not against "is this fewer panels". See Open Decision 1 - this packet ships the specified minimal default, but the honest limitation is recorded rather than hidden.

## Verified Starting State

Verified against live source on 2026-08-24. Rows unchanged from Revision 4 except where the persona re-cast changes the contract.

| App-relative path | Exact symbol / current span | Binding fact |
| --- | --- | --- |
| `src/app/shell/panels/layout.ts` | `stored`, `panelLayout`, `write()` (lines 45-57) | One module-scope `useLocalStorage<PanelLayout>` ref currently owns the Advanced key. Every reactive panel writer routes through `write()`. This is the storage-selection seam. |
| `src/app/shell/panels/layout.ts` | `resetPanelLayout()` (line 104) | Calls pure `resetPure()` (aliased from `operations.ts::resetPanelLayout`), which always returns the Advanced default. This wrapper must choose the active persona's factory. |
| `src/app/shell/panels/layout.ts` | final re-export (line 176) | `export { defaultPanelLayout, normalisePanelLayout } from './operations'`. New factories join this line. |
| `src/app/shell/panels/containers.ts` | `DEFAULT_DOCK_WIDTHS`, `DEFAULT_GROUPS`, `DEFAULT_OPEN`, `defaultState()`, `defaultPanelLayout()` (lines 125-158) | Post-T-070c3 Advanced default. `DEFAULT_GROUPS` is left `[{pages,200},{layers,null}]`, right `[{transform},{appearance,text},{page,guides}]`. `defaultState(id)` hardcodes `DEFAULT_OPEN`; `defaultPanelLayout()` runs private `updateV5Cache()` (line 342) and `clampV5FloatsAndHeights()` (line 371) before returning. Both new factories must reuse all three behaviours. |
| `src/app/shell/panels/types.ts` | `PANEL_LAYOUT_VERSION = 5`, `PANEL_LAYOUT_KEY` (lines 25-26) | Keep both unchanged. Add two new keys beside them; do not bump schema. |
| `src/app/shell/panels/types.ts` | `PANEL_IDS` (line 3) | 16 ids today. `prototype` is absent; T-085 adds it. |
| `src/app/shell/panels/types.ts` | `PanelGroup` (lines 48-56); `RegisteredPanelState` (lines 100-145); `PanelLayout` (lines 147-154) | Exact v5 shapes both new factories must return. |
| `src/app/shell/panels/registry.ts` | `PANEL_REGISTRY_BY_ID`, `PanelRegistryEntry` | `defaultState()` reads `defaultDock`, `defaultGroupIndex`, `defaultTabIndex`, `defaultFloating` from here. `code` is registered as right dock, group 3, sizing `fill`, height 380. |
| `src/app/shell/panels/operations.ts` | `normalisePanelLayout(value)` (lines 54-63) | Migrates v1-v4 and normalises v5. Unknown or invalid versions return `defaultPanelLayout()`, the Advanced fallback, so each persona's storage reader must intercept invalid JSON and unsupported versions before delegating. |
| `src/app/shell/panels/operations.ts` | pure `resetPanelLayout()` (lines 267-269) | Advanced-only factory wrapper. Leave unchanged; active-persona reset belongs in reactive `layout.ts`. |
| `src/app/shell/panels/index.ts` | barrel exports (lines 1-139) | Final post-T-070d3 surface. Add only the new persona keys and factories; remove, rename or reorder nothing. |
| `src/app/shell/capability.ts` | post-T-084 persona exports | Consume the persona value and its narrow helpers. Do not modify this module. Do not branch on the deprecated `isSimple` alias. |
| `src/app/shell/menu/use.ts` | `'reset-panel-layout': resetPanelLayout` (line 115) | Existing menu wiring already calls the reactive wrapper. No menu edit needed. |
| `tests/engine/app/shell/panels/layout.test.ts` | existing v5 suite; required Bun header (lines 1-2) | Extend this file; preserve its two-line header. Bun proves in-memory routing and factory shape, not raw browser `localStorage` bytes. |
| `tests/e2e/panels/helpers.ts` | `storageValue(page, key)` (lines 50-55); `seedGroupedPanels()` (lines 120-222); `openViewMenu()` (lines 379-392) | Reuse without editing. |
| `tests/e2e/toolbar/capability.spec.ts` | current header, switcher and menu helpers | Extend with panel routing. Preserve all header lines including the file-level direct-storage suppression. T-073 may rewrite this spec's placement assertions; coordinate rather than duplicate. |
| `package.json` | `dev`, `check:vue`, `test`, `test:unit` | `dev` exists. There is no `check:i18n`. Umbrella scripts remain prohibited. |

## Read First

At execution pre-flight, read only these bounded seams:

1. `src/app/shell/panels/layout.ts`: imports plus `stored`, `panelLayout`, `write()`, `resetPanelLayout()` and the final re-export line.
2. `src/app/shell/panels/containers.ts`: `DEFAULT_DOCK_WIDTHS` through `defaultPanelLayout()`, plus the private `updateV5Cache()` and `clampV5FloatsAndHeights()` signatures.
3. `src/app/shell/panels/types.ts`: `PANEL_IDS`, constants, and `PanelGroup` / `RegisteredPanelState` / `PanelLayout`.
4. `src/app/shell/capability.ts`: the landed T-084 persona exports.
5. `src/app/shell/panels/index.ts`: export lists only.
6. `src/app/shell/panels/registry.ts`: the `code` and `prototype` rows only.
7. `tests/e2e/panels/helpers.ts`: `storageValue`, `seedGroupedPanels`, `openViewMenu` only.

## Corrections to the Brief

1. Revision 2's claims about `DEFAULT_DOCKS` and `makeDock(ids)` were superseded by T-070c3's `DEFAULT_GROUPS: PanelGroupSeed[]` and `makeDock(seeds)`.
2. `writeDefaults: false` does not create a persona's key merely because the user switches to it. The key stays absent until that persona's first panel write or reset.
3. Bun unit tests provide no raw browser-storage seam. Byte-level `localStorage` proofs live in Playwright.
4. Both new factories must call `updateV5Cache()` and `clampV5FloatsAndHeights()`. Returning a literal directly would leave `groupIndex` and `tabIndex` based on registry defaults rather than the persona dock's actual groups.
5. Revision 4's entire two-record design is superseded. `isSimple ? storedSimple : storedFull` cannot express three personas. Revision 4 was marked Ready; executing it now would ship a two-persona model that T-084 and T-073 immediately contradict.
6. Revision 4's key names are superseded. `open-potlood:panel-layout:simple` is not created. Essential and Dev take the names in Fixed Decision 1.

## Fixed Decisions

1. **Three static storage refs, selected reactively by persona.** Advanced stays on `PANEL_LAYOUT_KEY = 'open-potlood:panel-layout'`, unchanged, so existing layouts survive. Add `ESSENTIAL_PANEL_LAYOUT_KEY = 'open-potlood:panel-layout:essential'` and `DEV_PANEL_LAYOUT_KEY = 'open-potlood:panel-layout:dev'`. Create all three refs once at module scope and select with a persona-keyed record:

```ts
const records = { essential: storedEssential, advanced: storedAdvanced, dev: storedDev } as const
const active = computed(() => records[capability.value])
```

   Do not pass a changing key to `useLocalStorage`, do not create a storage ref inside a computed, and do not chain ternaries.

2. **Switching runs no panel operation and writes no key.** Persona selection changes only which ref `panelLayout` reads and `write()` targets. Do not call `movePanel`, `moveGroup`, `dockPanel`, `floatPanel`, `dockGroup`, `floatGroup`, `setActiveTab`, `setGroupCollapsed`, `setGroupHeight`, `setDockWidth`, `setFloatRect`, `openRegisteredPanel`, `closeRegisteredPanel` or `writePanelLayout` from a persona watcher.

3. **No schema change.** All three records hold ordinary v5 `PanelLayout` values sharing the existing migration chain. Do not bump `PANEL_LAYOUT_VERSION` and do not add a migration.

4. **Essential factory is one Appearance group.** Exact normalised output:

```ts
{
  version: PANEL_LAYOUT_VERSION,
  dockWidths: { left: 240, right: 280 },
  docks: {
    left: [],
    right: [{ members: ['appearance'], active: 'appearance', height: null, collapsed: false }]
  },
  floats: [],
  panels
}
```

   `appearance.open === true`; every other panel closed.

5. **Dev factory is Advanced's left dock with a Code/Prototype right dock.** Exact normalised output:

```ts
{
  version: PANEL_LAYOUT_VERSION,
  dockWidths: { left: 240, right: 280 },
  docks: {
    left: [
      { members: ['pages'], active: 'pages', height: 200, collapsed: false },
      { members: ['layers'], active: 'layers', height: null, collapsed: false }
    ],
    right: [
      { members: ['transform'], active: 'transform', height: null, collapsed: false },
      { members: ['code', 'prototype'], active: 'code', height: null, collapsed: false }
    ]
  },
  floats: [],
  panels
}
```

   Exactly `pages`, `layers`, `transform`, `code` and `prototype` are open.

6. **Reuse the Advanced state builder.** Change the private signature to `defaultState(id: PanelId, openSet: ReadonlySet<PanelId> = DEFAULT_OPEN): RegisteredPanelState` and replace only `DEFAULT_OPEN.has(id)` with `openSet.has(id)`. `defaultPanelLayout()` keeps calling `defaultState(id)`. Both new factories pass their own open set and then run `updateV5Cache(docks, [], panels)` and `clampV5FloatsAndHeights(docks, [], panels)` before returning. Advanced's constants, grouping and output stay byte-identical.

7. **Per-record read fallback.** Add `readStoredLayout(value: string, fallback: () => PanelLayout): PanelLayout`. It must parse inside try/catch, accept only versions 1, 2, 3, 4 or `PANEL_LAYOUT_VERSION` before delegating to `normalisePanelLayout()`, and return `fallback()` for invalid JSON, a non-object, a missing version or an unsupported version. Each ref passes its own factory. This makes corruption recovery persona-correct without changing the shared v1-v5 normaliser. Malformed fields inside a recognised v5 record continue through existing normalisation; do not redesign normalisation here.

8. **No write-on-read and no write-on-switch.** All three refs keep `writeDefaults: false`. A persona's key appears only when that persona's panel operation or reset calls `write()`. Switching to an untouched Essential or Dev must leave its key absent.

9. **Reset writes only the active ref.** Reactive `resetPanelLayout()` selects the active persona's factory: `essentialPanelLayout()`, `resetPure()` or `devPanelLayout()`. Leave pure `operations.ts::resetPanelLayout()` and menu wiring unchanged.

10. **Barrel additions only.** Export both new keys from the types block and both new factories through the same public panel barrel used for `defaultPanelLayout`. Preserve every T-070d export present at execution time.

11. **No UI, menu, i18n, capability-store or registry edit.** This is storage routing and two factory defaults only.

## Open Decisions

1. **Is Appearance alone right for Essential, given the non-designer target?** Recommended and binding default for this packet: yes, ship the specified minimal default. But record honestly in the Execution Report that T-035 and T-036 are not Done, so Essential currently offers a reduced surface without the contextual guidance that was supposed to replace what it removed. That is a real usability gap, not a cosmetic one, and it belongs to T-073 and T-036 rather than being papered over here. Adding a panel later is a one-literal product revision, not authority to alter this packet during execution.

2. **Should Dev keep Transform and the full left dock?** Recommended and binding default: yes, as specified in Fixed Decision 5. Dev is Advanced with Code and Prototype, not a stripped shell; a developer inspecting a document still needs the layer tree and measurements. If the user wants Dev narrower, that is a literal change to one factory.

## Allowed Changes

Modify only:

- `src/app/shell/panels/types.ts`
- `src/app/shell/panels/containers.ts`
- `src/app/shell/panels/layout.ts`
- `src/app/shell/panels/index.ts`
- `tests/engine/app/shell/panels/layout.test.ts`
- `tests/e2e/toolbar/capability.spec.ts`

Create or delete nothing.

## Restrictions and Exclusions

Binding. Stop and report before crossing one of these lines.

- Reconfirm at Implementation Step 1 that T-070d1, d2a, d2b, d3, T-084 and T-085 all show Done in `Plan/plan.md`.
- Do not modify `src/app/shell/capability.ts`, `src/app/shell/panels/registry.ts`, `src/app/shell/menu/`, `tests/e2e/panels/helpers.ts`, `src/views/EditorView.vue` or any component.
- Do not branch on the deprecated `isSimple` alias.
- Do not add a persona watcher that performs a panel operation.
- Do not change `PANEL_LAYOUT_KEY`, `PANEL_LAYOUT_VERSION`, a migration, or `normalisePanelLayout()`'s public signature or behaviour.
- Do not change any existing pure or reactive panel-operation signature.
- Do not add UI, menu items, i18n, CSS, visual styling, accessibility behaviour or test IDs.
- Do not make persona per document or per tab, and do not write it into `.fig` or `.op`.
- No CanvasKit, scene graph, export, MCP, Rust, Tauri or generated-menu change.
- No dependency, Git work, version bump, build, install, NSIS run or `bun install`.
- No umbrella command: not `bun run check`, `check:vue`, `lint`, `test`, `test:unit` or `build`.
- T-073 owns switcher placement; T-085 owns the prototype panel's content. Do not fold either in.

## Implementation Steps

1. **Pre-flight, no edits.** Confirm T-032, T-070d1, d2a, d2b, d3, T-084 and T-085 are Done. Reread the seven Read First seams. Confirm schema is still v5, Advanced still uses one module-scope ref, `write()` remains the sole reactive writer, `defaultPanelLayout()` still calls both helpers, `prototype` is now in `PANEL_IDS`, and the persona exports match T-084's Execution Report. Stop on any failed dependency or incompatible drift; do not partially implement.

2. **Add keys and factories in `types.ts` and `containers.ts`.** Add `ESSENTIAL_PANEL_LAYOUT_KEY` and `DEV_PANEL_LAYOUT_KEY` beside `PANEL_LAYOUT_KEY`. Parameterise `defaultState()` per Fixed Decision 6. Add `ESSENTIAL_OPEN` and `DEV_OPEN` beside the other default constants. Implement `essentialPanelLayout()` and `devPanelLayout()` with the exact literals in Fixed Decisions 4 and 5, each calling `updateV5Cache()` and `clampV5FloatsAndHeights()` before returning. Leave Advanced's constants, grouping and output unchanged.

3. **Route storage in `layout.ts`.** Import the persona value, both new factories and both new keys. Add `readStoredLayout()` per Fixed Decision 7. Replace `stored` with `storedEssential`, `storedAdvanced` and `storedDev`, each keeping `writeDefaults: false` and the existing JSON writer. Build the `records` map and `active` computed per Fixed Decision 1. Define `panelLayout` from `active.value.value` and make `write(next)` assign only `active.value.value = normalisePanelLayout(next)`. Do not watch persona and do not write during selection.

4. **Scope reset and exports in `layout.ts` and `index.ts`.** Change only the reactive reset wrapper per Fixed Decision 9. Re-export both factories from `layout.ts` beside the existing factory and normaliser re-export. Add both factories and both keys to `index.ts` without removing, renaming or reordering unrelated T-070d exports.

5. **Unit coverage in `tests/engine/app/shell/panels/layout.test.ts`.** Preserve the two-line Bun header. Add a `per-persona panel routing` describe that resets all three in-memory records before each case. Cover:
   - Essential factory exact docks, floats and open set, and repaired cache: `appearance.container === 'right'`, `groupIndex === 0`, `tabIndex === 0`;
   - Dev factory exact docks, floats and open set, and repaired cache: `code.container === 'right'`, `groupIndex === 1`, `tabIndex === 0`, and `prototype.tabIndex === 1`;
   - each pair of personas: custom A to custom B and back returns deep-equal A, for all six ordered pairs or a table-driven equivalent;
   - selecting a persona alone leaves all three in-memory records deep-equal;
   - reset in each persona changes only that persona's record;
   - all three factory records report the current `PANEL_LAYOUT_VERSION`.

   Do not pretend Bun proves browser storage strings.

6. **Browser persistence coverage in `tests/e2e/toolbar/capability.spec.ts`.** Preserve its header. Import only `seedGroupedPanels`, `storageValue` and `openViewMenu`. Add focused tests that:
   - seed a distinctive Advanced grouped record, capture the raw string, switch to Essential, assert only `panel-tab-appearance` and `workspace-panel-appearance` are present and both new keys remain null, then switch back and assert the Advanced string is byte-identical;
   - switch to Dev, assert Code and Prototype are the visible right-dock group with Code active, and neither new key was created by switching alone;
   - force a first write in Essential and again in Dev, then cycle all three personas and assert every raw string is byte-identical and visibly restored;
   - use `openViewMenu()` and role `menuitem` name `Reset panel layout` exactly as `tests/e2e/panels/basic.spec.ts:236-238` does, and prove reset in each persona changes only that record;
   - reload once in each persona and assert the corresponding visible record;
   - set the Essential key to a broken JSON string, reload while Essential is active, assert the bare Essential default while Advanced and Dev keys stay byte-identical, then repeat for the Dev key.

   Prefer raw-string equality over reconstructing object order. Do not edit panel regression specs or helpers.

7. **Verify.** Use the development loop while editing, then run final gates once in the listed order and perform the browser check. Stop on any failure.

## Acceptance Criteria

- [ ] Advanced reads the unchanged `open-potlood:panel-layout`; Essential and Dev read their own suffixed keys.
- [ ] Switching persona without a panel operation writes no record and does not create an untouched key.
- [ ] After each record has been modified, every ordered persona round trip leaves the inactive raw strings byte-identical.
- [ ] Reset changes only the active record, proven in all three personas.
- [ ] Essential factory has one right Appearance group, no left group, no float, exactly one open panel.
- [ ] Dev factory has Advanced's left dock and a right dock of Transform plus a tabbed Code/Prototype group, with Code active.
- [ ] Cached container, group and tab fields match both new literals.
- [ ] Invalid JSON and unsupported-version records recover to their own persona's factory, never Advanced's.
- [ ] Advanced's factory, existing key, v5 schema, migration chain and current panel operations are unchanged.
- [ ] Final T-070d barrel exports remain present; only the new keys and factories are added.
- [ ] `capability.ts`, `registry.ts`, menu code, components, `EditorView.vue`, panel E2E helpers and existing panel specs are unedited.
- [ ] Existing `basic.spec.ts`, `stacks.spec.ts` and `tabbed-groups.spec.ts` pass unchanged.
- [ ] No UI, i18n, CSS, dependency, version, build, install or Git work occurs.

## Verification

Run from the `App` directory at `C:/Users/User/Documents/OpenPotlood/App` (use the Windows path form your shell requires).

### Development loop, repeat as needed

`bun test tests/engine/app/shell/panels/layout.test.ts`

Expected: exit 0. This is the only repeatable edit-loop command.

### Final pre-completion gates, run once

1. `bun test tests/engine/app/shell/panels/layout.test.ts` - exit 0 after the final edit.
2. `bunx tsgo --noEmit --pretty false` - exit 0.
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` - exit 0.
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/panels/types.ts src/app/shell/panels/containers.ts src/app/shell/panels/layout.ts src/app/shell/panels/index.ts tests/engine/app/shell/panels/layout.test.ts tests/e2e/toolbar/capability.spec.ts` - exit 0.
5. `bunx playwright test tests/e2e/toolbar/capability.spec.ts --project=openpencil` - exit 0.
6. `bunx playwright test tests/e2e/panels/basic.spec.ts tests/e2e/panels/stacks.spec.ts tests/e2e/panels/tabbed-groups.spec.ts --project=openpencil` - exit 0 with all three files unedited.

Do not substitute an umbrella command and do not run build, install or package-manager work.

## Integration or Installed-Result Check

After the source gates, run `bun run dev` (Vite, port 1420) and browser-check at least 1440 px wide:

1. Clear all three panel keys and start in Advanced. Build a distinctive Advanced layout: grouped tabs with a non-first active tab, one float with a moved and resized rect, one pinned group height, and a non-default dock width. Capture all three raw storage strings.
2. Switch to Essential. Confirm only Appearance is open on the right, the left dock and floats are absent, and switching alone created no key.
3. Switch to Dev. Confirm Transform plus a tabbed Code/Prototype group on the right with Code active, Pages and Layers on the left, and still no new key.
4. Modify Essential and Dev each by opening and moving one panel. Confirm both keys now exist. Cycle Advanced to Essential to Dev to Advanced three times and confirm no raw-string drift.
5. In each persona, choose View then Reset panel layout, and confirm only that persona's record changed.
6. Reload once in each persona and confirm the correct record is live.
7. Set the Essential key to a broken JSON string, reload in Essential, and confirm the bare Essential default while Advanced and Dev remain byte-identical. Repeat for Dev.
8. In Advanced, smoke-check the landed T-070 behaviours: grouped tabs, active tab, group and tab drag with indicators, whole-group drag, single dock scrollbar, float title bar and reset.

Browser proof is sufficient for this Vue and TypeScript storage route. It is not installed-desktop proof. Do not build, install or bump versions.

## Stop Conditions

- T-084, T-085 or any dependency through T-070d3 is not Done.
- Final `PanelLayout`, group drag and drop contracts, barrel exports or the layout writer seam differ materially from this revision.
- `prototype` is still absent from `PANEL_IDS`.
- Three static `useLocalStorage` refs cause cross-key writes, duplicate-listener behaviour or hydration mismatch.
- A persona switch changes any raw storage string.
- Either new factory cannot return fully repaired v5 cache fields through the same helpers as Advanced.
- Recognised-version normalisation must be redesigned to support per-record fallback.
- Any existing panel spec needs editing to pass, or Advanced's visible or default behaviour changes.
- The change needs a schema bump, migration, dependency, UI, menu, i18n, CSS, component, helper or registry edit, or a file outside Allowed Changes.
- A named gate or browser check fails. Record exact command, exit code and output; do not weaken the criterion.

## Execution Report Contract

Report:

- every modified file and one-line reason;
- both new keys, both new factory literals, and their post-helper cache fields;
- `storedEssential`, `storedAdvanced`, `storedDev`, `records`, `active`, `panelLayout`, `write()` and `readStoredLayout()` signatures as landed;
- raw strings for all three records before and after every round trip, expected diff empty, plus proof that switching alone left new keys absent;
- all three reset-scoping results and both invalid-JSON recoveries;
- grep or diff proof that schema, version, migrations, capability, registry, menu, components, helpers, existing panel specs and all final T-070d exports are unchanged;
- every gate with exact exit code, test counts and failure output;
- all eight browser observations, including three repeated cycles;
- the unresolved Essential limitation from Open Decision 1, specifically whether T-035 and T-036 were Done at execution time, since Essential's non-designer target depends on them;
- confirmation of no dependency, UI, i18n, CSS, version, build, install or Git work, and every remaining gap.

Do not claim desktop delivery. This packet closes at named source gates plus browser proof.

## Revision History

- Revision 1 - 2026-08-20: split the panel half out of T-032 and targeted the forthcoming v5 group model.
- Revision 2 - 2026-08-20: reconciled early T-070c1 source, parameterised `defaultState()`, retained the dependency lock.
- Revision 3 - 2026-08-21: re-expanded against live post-T-070c3 source; corrected stale history, file count, the Bun versus browser evidence split, key-creation timing, per-record corrupt-read fallback and missing v5 cache repair.
- Revision 4 - 2026-08-21: re-expanded with all T-070d work Done; barrel fully reconciled; packet state moved to Ready as a two-record Simple and Full design.
- Revision 5 - 2026-08-24: re-cast for the user's three-persona decision, Essential, Advanced and Dev. The two-record design and the `:simple` key name are superseded. Advanced retains the existing key so no current layout is lost. Dev's factory adds a tabbed Code and Prototype group, which introduces a hard dependency on T-085, and persona-keyed selection introduces a hard dependency on T-084. Essential's non-designer target is recorded as binding product framing. Packet state returns to Blocked; it was Ready and must not be executed as Revision 4.

## Status record

Expansion receipt (2026-08-21, Revision 4): reread every named seam against live `App/` source; packet moved to Ready.

Re-expansion receipt (2026-08-24, Revision 5): reread `Plan/plan.md`, `src/app/shell/capability.ts`, `src/app/shell/panels/types.ts`, `containers.ts`, `layout.ts`, `registry.ts` and `operations.ts` directly. Confirmed `PANEL_IDS` has 16 ids with no `prototype`, `code` is registered on the right dock, `defaultState(id)` is still unparameterised, and `defaultPanelLayout()` still calls both cache and invariant helpers. `App/` source and `Plan/plan.md` remained read-only during expansion; this packet file was rewritten. Two new dependencies were created by the persona decision, so readiness is withdrawn rather than assumed.
