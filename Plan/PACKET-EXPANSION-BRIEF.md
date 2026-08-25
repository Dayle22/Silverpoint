# Packet expansion brief — OpenPotlood

You are expanding one or more **BRIEF** work packets in
`C:\Users\User\Documents\OpenPotlood\Plan\Packets\` into **executable** packets.

The primary execution target is **Gemini 3.7 Flash**. Treat the finished packet as that executor's
single implementation contract: it must be able to make the change in one bounded session without
searching for basic paths, choosing architecture, interpreting visual taste, researching dependencies,
or inventing verification. This is a design target, not a guarantee of zero defects; the packet reduces
drift by making every consequential instruction concrete and checkable.

## Read first (in this order, all of them)

1. `C:\Users\User\Documents\OpenPotlood\App\AGENTS.md`
2. `C:\Users\User\Documents\OpenPotlood\Plan\endgoal.md`
3. `C:\Users\User\Documents\OpenPotlood\Plan\plan.md` (index + status; the delivery policy note at the top is binding)
4. The exemplars — these define the target quality bar, do not deviate from their shape:
   - `Plan\Packets\T-061-canvaskit-memory-and-stability.md` (engine/source-heavy exemplar)
   - `Plan\Packets\T-035-contextual-selection-actions.md` (UI exemplar — Visual Contract + Banned List)
5. The stub packet(s) assigned to you, in full.

## Your job

For each assigned packet: **verify everything against the live source tree under `App/`, then rewrite
the packet file in place as a complete, executable packet.**

The stub's "Expansion Questions" are not to be copied forward. **Answer them from the source.** Where a
question genuinely cannot be settled by reading code (a product taste call, or a `.fig` interchange
semantic you cannot confirm), do not leave it hanging — record it under **Open Decisions** with your
recommendation and the evidence for it, and make the packet executable either way (e.g. by fixing the
default and noting the alternative).

## Hard rules

- **Read-only on `App/`.** You may read anything under `App/`. You must NOT edit, create or delete any
  file under `App/`. Do not run builds, installs, `bun run check`, `bun run test`, `bun run test:unit`,
  or any package manager command. Running read-only greps and file reads is expected; running the app is not.
- **The only file you write is the packet `.md` itself.** Do not edit `Plan/plan.md` — the parent session
  owns the index.
- **Every factual claim must be anchored to a real path.** Quote real file paths, real symbol names, real
  class strings, command IDs, and the current line span where it helps. If you assert a function exists,
  you have read it. Prefer a stable symbol plus its current line span over a line number alone, because
  lines move after edits.
  Never write a claim you did not verify — a wrong anchor is worse than an admitted gap.
- **Correct the stub where it is wrong.** These stubs were written quickly. If the stub's "Likely Areas"
  point at files that do not exist, or its premise is already delivered, say so explicitly in the packet
  (see T-061's "Corrections to revision 1" section for the format) rather than quietly writing around it.
- **Delivery policy: named source gates, then browser check.** Every packet gets a
  `Delivery: named source gates + browser check` line. The executor runs the exact focused gates named
  by the packet, then `cd App && bun run dev` and checks the affected behaviour in the browser. Never
  require a desktop build, NSIS install, installed-identity check, or a version bump in `package.json` /
  `desktop/tauri.conf.json` / `desktop/Cargo.toml` unless the user explicitly authorises desktop delivery
  in that execution session, or the change cannot be proved in the browser because it is Tauri config,
  Rust, icons, generated `desktop/generated/menu.json`, or an `IS_TAURI`-only surface. Even then, state
  the desktop check as an approval/necessity condition rather than silently authorising it. Normal source
  gates are `bunx tsgo --noEmit`, `vue-tsc` on each affected project, focused `oxlint` over touched paths,
  an existing focused locale check when strings change, and focused `bun test` / Playwright specs named by
  path. Verify every command against the live `App/package.json` or actual script path before naming it.
- **No Git workflow.** Never propose branches, commits, tags, releases, or version-control work unless
  the user explicitly authorises it.

## Gemini 3.7 Flash execution contract

Write binding contracts, not prose descriptions. Gemini 3.7 Flash must not have to infer any of these:

- which file, export, component, composable, store, hook, command ID, or test seam to use;
- which existing local pattern is authoritative;
- where new code mounts or how it is wired into existing state;
- what the UI looks like, including classes, recipes, icons, states, and interaction behaviour;
- how CanvasKit/WASM objects are owned, released, cached, or invalidated;
- which exact checks prove the work and which failures require stopping.

For every target or reference, give an `App/`-relative path, the exact symbol or selector, its purpose,
and a current line span where useful. Use a compact table such as:

| Path | Symbol / selector | Binding use |
| --- | --- | --- |
| `src/components/canvas/CanvasMenu.vue` | `getCommand('selection.duplicate')` | Reuse this command route; do not duplicate the action logic. |
| `src/components/ui/IconButton.vue` | `IconButton` | Render the action with this existing primitive. |

If an action uses `useEditorCommands()`, name the exact command ID verified in live source. If a packet
requires a new command, specify its ID, type, registration file, call site, disabled-state rule, and test.

### Token-lean packet design — binding

Optimise the packet for the executor's context window, not for the expander's convenience. Apply all five
rules below to every expansion:

1. **Put exact interfaces and signatures in the contract.** Include the minimal exact TypeScript
   interfaces, prop types, store methods, function signatures, command payloads, and return types the
   executor must implement or call. Copy them from live source, or define the exact new signature in the
   packet. Never instruct the executor to "inspect component X to determine its props" or read a large
   parent/primitive merely to discover an API.
2. **Separate the development loop from final verification.** Put one single-file test command first —
   normally one focused Bun test file or one focused Playwright spec — and label it as the command to
   repeat while editing. Put type checks, focused Oxlint, additional focused suites, and the browser check
   under **Final pre-completion gates — run once**. Any explicitly authorised umbrella or multi-suite gate
   also belongs there and must run only once, after implementation is complete; do not make the executor
   flood its context by repeatedly running broad suites.
3. **Pre-verify headers for tests outside TypeScript project coverage.** Inspect the target directory and
   put the exact required header in the packet before instructing the executor to create the file. The
   current `tests/e2e/**/*.ts` convention is:

   ```ts
   // oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
   // @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
   ```

   The current `tests/engine/**/*.ts` convention uses the same first line and this runner-specific second
   line:

   ```ts
   // @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
   ```

   Verify a nearby live test before copying either form. Include any additional file-specific Oxlint
   annotation the planned code needs. Do not leave the executor to trigger and diagnose a false-positive
   type-resolution cascade.
4. **Keep one responsibility and enforce a size ceiling.** Forecast the exact core implementation files
   and test suites during expansion. A packet must not combine UI switcher/controls with workspace
   persistence or per-capability layouts; use companion IDs such as `T-032` and `T-032a`. If the work
   needs more than five core implementation files **and** multiple test suites, split it into `T-XXXa`,
   `T-XXXb`, and so on before expansion. Split earlier whenever there is more than one independently
   landable responsibility or a decision boundary.
5. **Make every reference bounded.** Give the exact export, interface, function, selector, or command ID
   plus its current line or line span. Generic mentions such as "see `Component.vue`" are not sufficient.
   Keep `Read First` to the smallest ordered set of bounded reads needed for pre-flight; put the necessary
   signature directly in the packet when that avoids opening a 500+ line file.

### Resolve decisions before execution

- Answer every stub `Expansion Question` from live source where possible; do not copy the question into
  the expanded packet.
- Put ordinary architecture, library, file-placement, state-ownership, interaction, and verification
  choices under **Fixed Decisions**, numbered and justified with their source evidence.
- A product-taste question that source cannot settle belongs under **Open Decisions**, with one explicit
  recommended default and the alternative's consequence. Make the implementation steps target the
  default so execution does not stall. If the choice changes scope, authority, cost, compliance, or an
  externally visible action, stop expansion and ask the user instead of inventing permission.
- Do not leave `TBD`, "choose one", optional architecture branches, or a mid-implementation decision point.
  If the step is too broad to close those choices, cut a bounded first slice and record the deferral.

**Any packet that touches UI must carry both:**

- A **Visual Contract — binding** section: exact Tailwind class strings copied from a real component you
  read, exact recipe imports (`components/ui/menu.ts`, `popover.ts`, `surface.ts`), exact icon imports
  (`~icons/lucide/*`), exact `data-test-id` naming following the existing convention.
- A **Banned List**: no literal colour (no hex/`rgb()`/`bg-zinc-800`) — semantic tokens only; no font size
  outside `text-xs` / `text-[11px]`; no radius outside `rounded-md` / `rounded-lg`; no new `tv()` recipe;
  no new npm dependency; no new global CSS or `app.css` edit; no new store/state where an existing one
  works. Tailor the list to the packet, but keep those.

Known trap to respect: this codebase tokenises **colour** well, but **not font sizes**, and only partly
tokenises **radius**. "Use the theme tokens" is therefore not a sufficient instruction — pin sizing and
radius with explicit class lists.

The Visual Contract must also fix default, hover, active, selected, disabled, focus-visible, empty,
loading, overflow, and responsive behaviour wherever those states apply. Copy exact Tailwind class
strings from a live matching component and name that component; phrases such as "clean", "compact",
"subtle", "Affinity-like", or "Figma-like" are context, not executable styling instructions.

### CanvasKit and WASM lifecycle contract

For packets touching rendering, shaders, filters, paths, images, surfaces, or CanvasKit-backed caches:

- inventory every relevant allocation site by exact path, symbol, and current line span;
- state who owns each wrapper and the precise cleanup hook, invalidation path, or `finally` block where
  `.delete()` is called;
- cover success, replacement, eviction, early return, thrown error, tab/document disposal, and component
  unmount paths where applicable;
- define cache keys, hard bounds, eviction algorithm, stale-result handling, and deletion on eviction —
  never write only "use a bounded cache";
- name focused regression evidence that can expose leaks, stale objects, double deletion, or rendering
  changes. Do not imply that JavaScript garbage collection releases CanvasKit wrappers.

## Required structure

Keep the headings in this order. Omit a section only when it genuinely does not apply.

```
# T-0XX - <title>

Task ID: T-0XX
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: <ids, or "none">
Related: <ids>
Prepared from: <the origin of the request>
Expanded at: <YYYY-MM-DD HH:mm Africa/Johannesburg>
Expanded against: <what you actually read>
Delivery: named source gates + browser check
Execution size: <N core implementation files; N test files across N suites; split decision>

## Intended Outcome
## Request Coverage            (verbatim carry-over of what the user asked for)
## Verified Starting State     (real paths + bounded symbols/line spans + exact required interfaces/signatures)
## Read First                  (smallest ordered set of exact symbols/line spans; no generic whole-file reads)
## Corrections to the Brief    (only if the stub was wrong; omit otherwise)
## Fixed Decisions             (numbered; each one closes an expansion question, with its reason)
## Open Decisions              (only what source cannot settle; each with a recommendation)
## Visual Contract — binding   (UI packets only)
### Banned List                (UI packets only)
## Allowed Changes
## Restrictions and Exclusions (binding; "an implementer who wants to cross one of these should stop and report")
## Implementation Steps        (numbered, independently verifiable, in landing order, each naming its files)
## Acceptance Criteria         (checkbox list, each one objectively checkable)
## Verification                (development-loop single-file command first; final gates grouped and run once)
### Development loop — repeat as needed
### Final pre-completion gates — run once
## Integration or Installed-Result Check (browser check by default; conditional desktop proof only where authorised/necessary)
## Stop Conditions
## Execution Report Contract   (changed files, exact evidence, failures, assumptions used, remaining gaps)
## Status record               (expansion receipt now; execution evidence later; never duplicate plan status)
```

## Implementation-step order

Write the numbered steps in landing order:

1. **Pre-flight:** reread the named target and reference symbols; reconcile any drift before editing.
2. **Atomic edits:** name each file to create or modify and the exact props, types, functions, state, or
   classes to add or change. Inline the minimal exact TypeScript contracts the executor would otherwise
   have to discover from another file.
3. **Mounting and wiring:** name the parent, store, command registry, lifecycle hook, or render path that
   connects the change.
4. **Tests and accessibility hooks:** give exact test-file paths, any pre-verified lint/type header,
   `data-test-id` values, keyboard/focus behaviour, and accessibility requirements that apply.
5. **Focused verification:** give the single-file development-loop command first, then the final gates
   in execution order with the expected observable result and an explicit run-once instruction.

Each step must be small enough to verify independently. Never use "update as needed", "wire it up",
"ensure it works", or similar instructions without naming the concrete edit and proof.

## Verification contract

- Write commands exactly as they must be run from `C:\Users\User\Documents\OpenPotlood\App`; therefore
  touched source and test paths in commands are normally `src/...` and `tests/...`, not `App/src/...`.
- Name every affected TypeScript project explicitly for `vue-tsc`; do not assume the root project covers
  package code.
- Give focused Oxlint paths, focused Bun test files/directories, and focused Playwright spec paths and
  project names. Do not write placeholders such as "run relevant tests".
- Start with exactly one smallest relevant test file as the repeatable development loop. Prefer
  `bun test path/to/specific.test.ts` or `bunx playwright test path/to/feature.spec.ts --project=openpencil`
  when those forms match live scripts and configuration.
- Group every remaining type, lint, additional focused-suite, browser, and explicitly authorised umbrella
  gate under **Final pre-completion gates — run once**. Do not prescribe repeated broad or multi-suite runs.
- For every new test outside the applicable `tsconfig.json`, include the exact pre-verified header and any
  required Oxlint annotation in the implementation step; the executor must not have to infer lint policy.
- When locale keys or strings change, inspect the live scripts and name an existing focused locale check.
  `bun run check:i18n` is not currently defined in `App/package.json`, so do not prescribe it unless a
  later source revision adds it. If no locale checker exists, specify exact dictionary/test read-backs
  rather than inventing a command.
- Do not prescribe `bun run check`, `bun run test`, `bun run test:unit`, builds, installs, package-manager
  mutations, snapshot updates, or unrelated regression suites unless the user or a binding project rule
  explicitly requires that exact action.
- After source gates, require `bun run dev` and a browser check that names the exact interaction, state,
  viewport/edge case, and non-regression to observe. Browser proof is not desktop proof.

## Ready-for-Flash checklist

Before changing the packet to `Ready`, confirm all of these:

- [ ] Every path, symbol, selector, command ID, dependency, and reference pattern exists in the live
      `App/` tree today.
- [ ] Gemini 3.7 Flash can start at Implementation Step 1 without path hunting, dependency research,
      architectural choice, or visual interpretation.
- [ ] Every interface, prop type, store method, function signature, command payload, and return type needed
      for execution appears exactly in the packet; no step delegates API discovery to the executor.
- [ ] Every `Read First` item names an exact symbol/export/selector and current line span, and the list is
      short enough that the executor does not need broad reads of large files.
- [ ] Every stub question is closed by a Fixed Decision, a safe recommended default, or a genuine stop.
- [ ] UI styling is completely defined with live Tailwind classes, recipes, imports, icons, states, and
      test IDs rather than vague prose.
- [ ] The tailored restrictions and Banned List are explicit enough to prevent adjacent refactors.
- [ ] Ownership, `.delete()`, invalidation, and cache bounds are explicit for every relevant CanvasKit/WASM
      interaction.
- [ ] Implementation steps are discrete, sequenced, file-specific, and independently checkable.
- [ ] `Execution size` inventories the core implementation files and test suites; the packet has one
      responsibility and is split into companion IDs if it exceeds five core files plus multiple suites.
- [ ] Every acceptance criterion maps to an exact focused command or observable browser check.
- [ ] Verification starts with one single-file development-loop command; all other final gates are grouped
      under an explicit run-once heading, with no repeated umbrella or multi-suite runs.
- [ ] Every new test outside TypeScript project coverage has its exact nearby-verified lint/type header in
      the packet, including runner-specific wording and any extra Oxlint annotation.
- [ ] The packet prohibits umbrella checks, unauthorised builds/installs/version bumps, new dependencies,
      Git work, and application edits during expansion.
- [ ] The expander has reread the completed packet and verified every anchor once more against live source.

A packet is `Ready` because construction and verification are fully specified, not because it is long.

## Sizing

Use the exemplars for completeness, not as a line-count target. Write the shortest packet that remains
self-contained: exact contracts and bounded references are useful; copied implementation prose and generic
file tours are not. A small packet may be far below 200 lines. If a packet approaches 400 lines, exceeds
five core implementation files plus multiple test suites, or contains more than one independently landable
responsibility, split it into companion packets instead of compressing or padding it.

## Scope discipline

A packet is one bounded, landable change. UI switcher/controls, workspace storage, and per-capability
layouts are separate responsibilities even when they support one feature; assign companion IDs such as
`T-032`, `T-032a`, and `T-032b`. If your assigned stub turns out to be unbounded, cut a concrete first
slice, state the cut explicitly, and list what is deferred under a "Deferred to a later packet" heading
inside Restrictions and Exclusions. Do not silently expand scope, and do not fold a neighbouring packet's
work into yours — the Related packets own their parts.

## Final report back

Return a short summary per packet: the file you wrote, the 3–6 most important things you verified
(especially anything that contradicted the stub), any open decision you left for the user, and any
stub whose premise turned out to be already delivered or infeasible.
