# T-084 — Persona capability model (Essential / Advanced / Dev)

Task ID: T-084
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-032 (Done)
Blocks: T-032a (per-persona panel sets), T-073 (persona switcher UI)
Related: T-085 (prototype panel), T-035/T-036 (contextual surfaces)
Prepared from: the user's 2026-08-24 decision to replace the landed two-segment `Simple | Full` switch with a three-persona model
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: `App/src/app/shell/capability.ts`, its four source consumers, the capability unit/E2E suites, `App/package.json`, and the current plan register
Delivery: named source gates + browser check
Execution size: 4 core implementation files; 2 test files across 2 suites; no split — one migration plus its legacy-entry adapters

## Intended Outcome

The single global `open-potlood:capability` preference becomes version 2: `essential`, `advanced`, `dev`. Valid v1 `simple` migrates to Essential and `full` to Advanced; neither resets. Advanced is the fresh default. Essential alone keeps the reduced tool strip; Advanced and Dev keep the full current set. Until T-073, the visible two-segment Simple/Full controls retain their labels, IDs, styling and placement, but write Essential/Advanced values.

## Request Coverage

Replace the landed two-segment `Simple | Full` model with Essential, Advanced and Dev personas, preserving stored selections through migration while deferring the three-persona UI, panel layouts and Prototype panel to T-073, T-032a and T-085.

## Verified Starting State

| Path | Symbol / selector | Binding use |
| --- | --- | --- |
| `src/app/shell/capability.ts:4-52` | `CAPABILITY_VERSION`, `Capability`, `normalise`, `stored`, `capability`, `isSimple`, `setCapability` | Only capability store. It is v1, uses `open-potlood:capability`, `writeDefaults: false`, and currently resets every non-v1 record. |
| `src/components/Toolbar/Toolbar.vue:9,84` | `isSimple`, `ToolbarRoot` | Sole live `isSimple` consumer; retain it as a deprecated Essential alias so T-084 does not widen into toolbar work. |
| `src/components/Toolbar/CapabilitySwitcher.vue:10-49` | `model`, `options`, `switcherUi`, test IDs | Legacy visible adapter. Its current `simple`/`full` values must become Essential/Advanced or clicks normalise back to the default. |
| `src/app/shell/menu/use.ts:114-117` | native menu `actions` | Calls `setCapability('simple' | 'full')`; must be retargeted to typecheck. |
| `src/app/shell/menu/app-menu.ts:51-54,109-112,130-133,171-177` | browser menu labels, actions, checks | Same obsolete writes/checks; keep existing IDs/labels but route to v2 values. |
| `src/app/shell/menu/schema.ts:157-158` | legacy menu entries | Do not edit: T-073 owns their three-persona replacement. |
| `tests/engine/app/shell/capability.test.ts:1-74` | Bun suite | Existing required two-line Bun header; replace v1 assertions with v2/migration/helper coverage. |
| `tests/e2e/toolbar/capability.spec.ts:1-255` | Playwright toolbar suite | Existing required two-line Playwright header plus storage lint disable; correct reload/migration seam. |
| `package.json:14-68` | scripts/tooling | Confirms the named Bun, tsgo, vue-tsc, oxlint and Playwright commands. |

Target API:

```ts
export const CAPABILITY_VERSION = 2
export type Capability = 'essential' | 'advanced' | 'dev'
export interface AppCapability { version: typeof CAPABILITY_VERSION; capability: Capability }
export const DEFAULT_CAPABILITY: AppCapability // { version: 2, capability: 'advanced' }
export function normalise(value: unknown): AppCapability
export const capability: ComputedRef<Capability>
export const isEssential: ComputedRef<boolean>
export const isAdvanced: ComputedRef<boolean>
export const isDev: ComputedRef<boolean>
/** @deprecated Use isEssential. T-073 removes this after consumers move. */
export const isSimple: ComputedRef<boolean>
export function setCapability(value: Capability): void
```

## Read First

1. `App/src/app/shell/capability.ts:4-52` — key, serializer and public store API.
2. `App/src/components/Toolbar/CapabilitySwitcher.vue:10-49` — keep the two presentation segments, alter only their values/conditional mappings.
3. `App/src/app/shell/menu/app-menu.ts:109-112,125-178` and `App/src/app/shell/menu/use.ts:114-117` — retarget every legacy menu write/check.
4. `App/src/components/Toolbar/Toolbar.vue:9,84` — confirm the alias remains its sole model use.
5. `App/tests/engine/app/shell/capability.test.ts:1-74` and `App/tests/e2e/toolbar/capability.spec.ts:1-255` — retain headers and extend existing seams.

## Corrections to the Brief

1. A model-only allowed scope is false: `app-menu.ts` and `menu/use.ts` pass removed literals to `setCapability`; the switcher also needs its invisible value mapping changed. These are compatibility adapters, not T-073 UI work.
2. `isSimple` has exactly one consumer beyond its module, `Toolbar.vue:9,84`; keep it deprecated and mapped to Essential rather than changing that toolbar in this packet.

## Fixed Decisions

1. Set version 2, exactly the three v2 values, and `{ version: 2, capability: 'advanced' }` default.
2. `normalise(value: unknown)` returns valid v2 values unchanged; maps exactly v1 Simple to Essential and v1 Full to Advanced; returns a fresh default copy for missing fields, malformed objects, unknown versions and unknown strings. Use a private v1 guard/narrowing; never widen exported `Capability`.
3. Retain the current key, `useLocalStorage<AppCapability>`, `writeDefaults: false` and serializer. Read returns migrated v2 state and write serialises normalised v2 state; do not create a second key or eager default write.
4. Export computed `isEssential`, `isAdvanced`, `isDev`; export `isSimple` as the same computed reference as `isEssential` with the exact deprecation comment in Target API. Add no `isFull` alias.
5. Existing Simple presentation/command IDs write and check `essential`; existing Full IDs write and check `advanced`. Dev gets no control or menu route until T-073. Do not alter IDs, labels, locale keys, schema or icons.
6. The existing `isSimple` branch means Essential alone uses `simpleToolSet`; Advanced and Dev use `EDITOR_TOOLS`. Do not edit `capability-tools.ts` or make a Dev tool set.

## Visual Contract — binding

This is value wiring only. Retain `SegmentedControl`, root `gap-1 rounded-lg border border-border/80 bg-panel/95 p-1 shadow-lg backdrop-blur-md`, item `h-8 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:font-semibold data-[state=on]:ring-1 data-[state=on]:ring-accent`, and outer `max-w-[calc(100vw-32px)]` from `CapabilitySwitcher.vue:20-34`.

- Full-labelled/Advanced is selected by default; Simple-labelled/Essential only when active.
- Existing hover, disabled, focus-visible, roving-key, overflow, desktop-only and collapsed-UI behaviour remains exactly delegated to `SegmentedControl`/`DesktopToolbar`.
- Retain `capability-switcher`, Sparkles `capability-simple` and Sliders `capability-full`; change only their associated option values to Essential/Advanced.
- There is no loading/empty state. Dev is intentionally unreachable in this legacy control.

### Banned List

- No class, colour, font size, radius, label, locale, icon, layout, mount point, test-ID, recipe, CSS or global-style change.
- No new `tv()` recipe, store, storage key, dependency, `app.css` edit, Dev menu entry, `capability-essential`/`capability-advanced` ID or generated Tauri menu change.

## Allowed Changes

Modify only:

- `App/src/app/shell/capability.ts`
- `App/src/components/Toolbar/CapabilitySwitcher.vue`
- `App/src/app/shell/menu/app-menu.ts`
- `App/src/app/shell/menu/use.ts`
- `App/tests/engine/app/shell/capability.test.ts`
- `App/tests/e2e/toolbar/capability.spec.ts`

Create or delete nothing.

## Restrictions and Exclusions

Binding: stop and report before crossing a boundary.

- Do not modify `Toolbar.vue`, `capability-tools.ts`, `DesktopToolbar.vue`, `menu/schema.ts`, i18n, `desktop/generated/menu.json`, panels, documents, `.fig`/`.op`, Rust or Tauri config.
- T-073 owns the three-segment UI, wording, placement, menu schema and its full E2E rewrite; T-032a owns persona panel records; T-085 owns Prototype content.
- No Dev tool policy or UI track, document/tab setting, watcher, schema framework, eager storage write, dependency, Git, build, install or version work.

## Implementation Steps

1. **Pre-flight.** Confirm T-032 is Done and T-073/T-032a remain separate in `Plan/plan.md`; reread Read First. Stop if another `isSimple` consumer, legacy `setCapability` call, or storage API has appeared.
2. **Model.** In `src/app/shell/capability.ts`, apply Fixed Decisions 1-4. Keep `setCapability(value: Capability): void`, the existing key/options and serializer shape.
3. **Legacy adapters.** In `CapabilitySwitcher.vue`, set existing `options` values to `essential` and `advanced` and remap existing icon conditionals; retain everything visual. In `menu/use.ts`, map `capability-simple`/`capability-full` to Essential/Advanced. In `app-menu.ts`, make the same substitutions in `actions`, `checked` and `onCheckedChange`.
4. **Tests.** Preserve both headers verbatim. Unit test default Advanced, all three v2 round trips/helpers, `isSimple === isEssential`, exact v1 migrations, invalid fallback and each v2 `setCapability` value. E2E retain old visible labels/IDs/chrome checks; seed/reload v1 Simple and Full, prove their reduced/full behaviour, operate legacy controls/menu, reload, and inspect v2 Essential/Advanced storage. Retain corrupt JSON and unknown-version Advanced fallback. No Dev UI assertion.
5. **Verify.** Run the development loop as needed, final gates once, then the browser check. Stop on failure.

## Acceptance Criteria

- [ ] Only `open-potlood:capability` remains, with `writeDefaults: false`.
- [ ] `Capability` is exactly Essential/Advanced/Dev; fresh default is v2 Advanced.
- [ ] All v2 values round-trip; v1 Simple becomes v2 Essential and v1 Full v2 Advanced without reset.
- [ ] Bad/missing/unknown records and malformed JSON recover to Advanced without startup failure.
- [ ] New helpers are correct; deprecated `isSimple` is Essential and the sole toolbar branch remains unchanged.
- [ ] Essential gets `simpleToolSet`; Advanced and Dev get unchanged `EDITOR_TOOLS`.
- [ ] Visible labels, icons, IDs, placement and schema remain old, but their values/checks map to Essential/Advanced.
- [ ] No Dev selector/menu, panel layout, Prototype panel, i18n, schema/generated menu, CSS, dependency or document persistence changes.

## Verification

Run from `C:/Users/User/Documents/OpenPotlood/App`.

### Development loop — repeat as needed

`bun test tests/engine/app/shell/capability.test.ts`

Expected exit 0; this is the only repeatable edit-loop command.

### Final pre-completion gates — run once

1. `bun test tests/engine/app/shell/capability.test.ts` — exit 0.
2. `bunx tsgo --noEmit --pretty false` — exit 0.
3. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — exit 0.
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/app/shell/capability.ts src/components/Toolbar/CapabilitySwitcher.vue src/app/shell/menu/app-menu.ts src/app/shell/menu/use.ts tests/engine/app/shell/capability.test.ts tests/e2e/toolbar/capability.spec.ts` — exit 0.
5. `bunx playwright test tests/e2e/toolbar/capability.spec.ts --project=openpencil` — exit 0.

Do not run umbrella checks, builds, installs or package-manager commands.

## Integration or Installed-Result Check

After source gates run `bun run dev`, then at desktop width:

1. Clear the key: confirm Full-labelled control/full toolbar.
2. Seed v1 Simple, reload: confirm Simple label/reduced tools; use Full, reload and inspect v2 Advanced storage.
3. Seed v1 Full, reload: confirm full tools; use Simple, reload and inspect v2 Essential storage.
4. Use unchanged View menu items and confirm ticks/toolbars map to Essential/Advanced.
5. Seed corrupt JSON and unknown version separately; each reload selects Full/Advanced without error.
6. Confirm two labels only; `?no-chrome` absence and collapsed-UI hide/restore remain.

This is browser proof only; do not build, install or bump versions.

## Stop Conditions

- A dependency/source seam changes materially, or new legacy consumers appear.
- Safe migration needs a second key, eager write, document/tab/panel work, UI/menu-schema/i18n redesign, generated-menu output or dependency.
- The legacy adapters cannot write v2 values without work T-073 owns.
- Any named gate or browser observation fails; record exact output and stop.

## Execution Report Contract

Report every changed file; final types/default/normalise branches; preservation of key/options and toolbar alias; legacy ID-to-v2 mapping/no Dev entry; exact test counts/exits and browser observations; a bounded diff proving exclusions; failures/assumptions/gaps, including that T-073/T-032a/T-085 remain separately required.

## Status record

Expansion receipt (2026-08-24): verified against live source. The model is v1; `Toolbar.vue` is the only `isSimple` consumer; both menu adapters write obsolete literals; and the switcher requires a value adapter to avoid default-resetting a click. `App/` and `Plan/plan.md` remained read-only. Ready means executor hand-off, not source completion or desktop delivery.
