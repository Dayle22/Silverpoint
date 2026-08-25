# G-001d - Remove the upstream auto-updater and realign the identity test

Task ID: G-001d
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: G-001b, G-001c, G-002a
Supersedes: **G-001a in full.** Do not execute G-001a. See Fixed Decision 6.
Prepared from: the G-001a execution attempt of 2026-08-25, halted at G-001a's own Stop Condition 2.
Removing the updater block breaks a third assertion that G-001a's expansion did not model, and that
assertion sits outside G-001a's Allowed Changes, so G-001a cannot complete as written.
Expanded at: 2026-08-25 10:05 Africa/Johannesburg
Expanded against: `desktop/tauri.conf.json`; `tests/engine/app/identity.test.ts`; `desktop/Cargo.toml`;
`desktop/Cargo.lock`; `package.json`; `packages/*/package.json`. The complete end state below was
applied to live source, driven to green, gated, and then reverted to baseline byte-for-byte
(md5 re-verified). Every command output quoted in this packet is real, not predicted.
Delivery: named source gates + browser check
Execution size: 1 config file; 1 test file across 1 suite; no split required.

## Intended Outcome

The published application no longer polls OpenPencil's release feed for its own updates, and
`identity.test.ts` passes at **5 pass / 0 fail / 38 expect() calls** — with the updater assertions
inverted so that the removed block cannot silently return.

## Request Coverage

The project publishes to the public fork `https://github.com/Dayle22/Silverpoint`. A build that
accepts upstream's signed releases as its own updates must not be frozen into public history.

G-001a addressed the same defect but modelled only two stale assertions. This packet covers the
**four** stale assertions that actually exist plus the one contradictory assertion, so the suite
reaches green in a single atomic change.

## Verified Starting State

Baseline checksums, from `C:\Users\User\Documents\OpenPotlood\App`:

```
f8c053bbdebc7ebe70a52649dbfdff5d *desktop/tauri.conf.json
5009f01080a25a968e112ac4315ec064 *tests/engine/app/identity.test.ts
```

`bun test tests/engine/app/identity.test.ts` at baseline: **3 pass, 2 fail, 20 expect() calls.**

### The updater block

`desktop/tauri.conf.json` lines 60–70, verified verbatim:

```json
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDU4QzBCRjBFNzhFNEVEMDEKUldRQjdlUjREci9BV0hLaEJPeG5tRXdsWkhQWFdEa0VxcEtNR1o1S2VJeGlKU1VDTldQTi9wYncK",
      "endpoints": [
        "https://github.com/open-pencil/open-pencil/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
  }
```

Both the endpoint and the `pubkey` belong to upstream. `ls desktop/*.key` returns no file, so this
project holds no private signing key and cannot sign updates of its own.

### Live version values

| File | Field | Live value |
| --- | --- | --- |
| `package.json:3` | `version` | `0.6.33` |
| `desktop/tauri.conf.json:4` | `version` | `0.6.33` |
| `desktop/Cargo.toml:3` | `version` | `0.6.33` |
| `desktop/Cargo.lock`, `open_pencil` block | `version` | **`0.6.32`** |

`desktop/Cargo.toml` contains no occurrence of `0.1.0` at all (`grep -n '0\.1\.0'` → no match).

`packages/{cli,core,dom-css,fig,kiwi,mcp,pen,scene-graph,vue}/package.json` all read `0.13.2`,
matching the test's expectation. That assertion is correct and is not touched.

### The four stale assertions, and why G-001a saw only two

`toMatchObject` at line 63 throws on the first mismatch, so lines 81–85 **never execute** at
baseline. G-001a's expansion read the visible failure and concluded there were two stale
expectations. There are four:

| Line | Assertion | Live value | Visible at baseline? |
| --- | --- | --- | --- |
| 21 | `version: '0.1.0'` (packageJson) | `0.6.33` | yes |
| 65 | `version: '0.1.0'` (tauri) | `0.6.33` | yes |
| 82 | `toContain('version = "0.1.0"')` (Cargo.toml) | `0.6.33` | **no — masked by line 63** |
| 85 | `toContain('version = "0.1.0"')` (Cargo.lock) | `0.6.32` | **no — masked by line 63** |

G-001a Implementation Step 4 also directed the executor to rewrite the line-63 expected object to
drop `plugins.updater` and add `bundle.targets: "all"`. That is unnecessary and wrong:
`toMatchObject` ignores unlisted received keys. The observed diff had exactly one `-` line,
`"version": "0.1.0"`. Correcting the version alone satisfies line 63.

### The contradictory assertion

`tests/engine/app/identity.test.ts` lines 104–119, test
`disables startup updater access while retaining inert compatibility files`, asserts the opposite of
this packet's goal:

```ts
    expect(tauri.plugins.updater.endpoints).toHaveLength(1)
    expect(tauri.plugins.updater.pubkey).toBeTruthy()
```

With the block removed this throws `TypeError: undefined is not an object (evaluating
'tauri.plugins.updater.endpoints')`. It passed at G-001a's expansion time only because the block
still existed. Its first four assertions concern *code* retention and are unaffected.

## Read First

1. `desktop/tauri.conf.json` lines 55–71 — the `plugins` block.
2. `tests/engine/app/identity.test.ts` lines 13–120 — all five stale or contradictory assertions.

Nothing else.

## Fixed Decisions

1. **Remove the `updater` block rather than repoint it.** Repointing to `Dayle22/Silverpoint` would
   still carry upstream's `pubkey`, and no private key exists, so every check would fail signature
   validation. Removal disables the feature cleanly.
2. **Leave the updater code, Rust plugin and Cargo dependency in place.**
   `src/app/shell/updater.ts:51` imports the plugin dynamically; with no config the check is a no-op.
   Removing the dependency touches Rust, `Cargo.lock` and the menu — a separate responsibility.
3. **Keep the `plugins` key, emit `"plugins": {}`.** `desktop/src/lib.rs:147` still registers the
   plugin and Tauri expects the key to parse. Do not delete the `plugins` key itself.
4. **Update the test to match live source, not the reverse.** `0.6.33` is correct.
5. **Invert the updater assertions rather than delete them.** Deleting lines 117–118 would let the
   suite pass whether or not the block exists, so a future merge could reintroduce upstream's
   endpoint unnoticed. Asserting absence turns this test into the regression guard that the whole
   G-001 series exists to provide. Two raw-text assertions are added alongside, because they fail
   loudly even if the JSON shape changes.
6. **Config and test land together, in one packet.** This is why G-001a is superseded rather than
   amended. The config change and the assertion that guards it are a single unit: applying either
   alone leaves the suite red, so neither can be a standalone packet with a green exit gate.
7. **`Cargo.lock` is asserted at its true `0.6.32`, not at `Cargo.toml`'s `0.6.33`.** The two are
   genuinely out of sync in the live tree. Resyncing requires a `cargo` invocation, which is barred
   from per-packet work. Asserting the real value keeps the suite honest; the desync is recorded
   below as an Open Decision.

## Open Decisions

**Auto-update later.** Recommended default: stays disabled. To enable, generate a minisign keypair
(`bun run tauri signer generate`), keep the private key out of the repository, publish `latest.json`
on `Dayle22/Silverpoint` releases, and restore the block with your own pubkey and endpoint. Note that
Acceptance Criterion 8 and the inverted assertions would then need revising in the same change.
Consequence of the default: the menu item becomes inert and users get no automatic updates — correct
for a fork with no releases.

**`Cargo.toml` 0.6.33 vs `Cargo.lock` 0.6.32.** Recommended default: leave it, assert `0.6.32`.
Consequence: the identity test encodes a known-inconsistent pair, and the next `cargo build` will
rewrite the lock to `0.6.33` and break the line-85 assertion. Whoever runs that build owns updating
it. Deferred as its own item below.

## Allowed Changes

- `desktop/tauri.conf.json` — remove the `updater` object from `plugins`.
- `tests/engine/app/identity.test.ts` — the five edits in Implementation Steps, and nothing else.
- This packet's `## Status record` section only.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Git commands of any kind.** Not `git init`, not `git status`. G-002a onward owns Git.
- **No `cargo` command of any kind**, including `cargo build`, `cargo check` and `cargo update`. Any
  of these rewrites `desktop/Cargo.lock` to `0.6.33` and breaks the line-85 assertion this packet
  sets. This restriction is new in G-001d and is not optional.
- No version bump in `package.json`, `desktop/tauri.conf.json` or `desktop/Cargo.toml`.
- No desktop build, no `bun run tauri build`, no NSIS install, no installed-identity check.
- No `bun run check`, `bun run test`, `bun run test:unit`, or any umbrella suite.
- No new or removed npm/Cargo dependency.
- No edits to `src/app/shell/updater.ts`, `src/app/shell/menu/use.ts`, `desktop/src/lib.rs` or
  `desktop/Cargo.toml` — Fixed Decision 2.
- No edits to `desktop/Cargo.lock` — Fixed Decision 7.
- No `bun install`, no `bun.lock` edit.
- No edits to `AGENTS.md`, `.gitignore`, or any file owned by G-001b or G-001c.
- No edits to `Plan/plan.md`.
- Do not rewrite the line-63 `toMatchObject` beyond its `version` field. `toMatchObject` ignores
  unlisted keys; adding `bundle.targets` or removing `plugins` there is unnecessary churn.

### Deferred to a later packet

- Resyncing `desktop/Cargo.lock` to `Cargo.toml`'s `0.6.33`, and updating the line-85 assertion.
- Removing `tauri-plugin-updater` entirely, if auto-update stays permanently disabled.
- Generating a Silverpoint signing key and release pipeline.

## Implementation Steps

Every block below is verbatim and was applied to live source during expansion. Match the `old`
text exactly, including indentation.

1. **Pre-flight.** Confirm `desktop/tauri.conf.json` still contains
   `open-pencil/open-pencil` and that `bun test tests/engine/app/identity.test.ts` reports
   **3 pass, 2 fail, 20 expect() calls**. If either differs, stop and report — the tree has drifted.

2. **Remove the updater config** in `desktop/tauri.conf.json`.

   Replace:

   ```json
     "plugins": {
       "updater": {
         "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDU4QzBCRjBFNzhFNEVEMDEKUldRQjdlUjREci9BV0hLaEJPeG5tRXdsWkhQWFdEa0VxcEtNR1o1S2VJeGlKU1VDTldQTi9wYncK",
         "endpoints": [
           "https://github.com/open-pencil/open-pencil/releases/latest/download/latest.json"
         ],
         "windows": {
           "installMode": "passive"
         }
       }
     }
   ```

   with:

   ```json
     "plugins": {}
   ```

   The closing `}` of the document follows on its own line and is unchanged.

3. **Correct the packageJson version** — `tests/engine/app/identity.test.ts` line 21.

   Old: `    expect(packageJson).toMatchObject({ name: 'silverpoint-app', version: '0.1.0' })`

   New: `    expect(packageJson).toMatchObject({ name: 'silverpoint-app', version: '0.6.33' })`

4. **Correct the tauri version** — line 65. Change only the `version` line inside the object:

   Old:

   ```ts
         productName: 'Silverpoint',
         version: '0.1.0',
         identifier: 'com.dayle22.silverpoint',
   ```

   New:

   ```ts
         productName: 'Silverpoint',
         version: '0.6.33',
         identifier: 'com.dayle22.silverpoint',
   ```

5. **Correct the Cargo.toml version** — line 82.

   Old: `    expect(cargoToml).toContain('version = "0.1.0"')`

   New: `    expect(cargoToml).toContain('version = "0.6.33"')`

6. **Correct the Cargo.lock version** — line 85. Note this is `0.6.32`, deliberately different from
   step 5; see Fixed Decision 7.

   Old: `    expect(localCargoPackage).toContain('version = "0.1.0"')`

   New: `    expect(localCargoPackage).toContain('version = "0.6.32"')`

7. **Invert the updater assertions** — lines 109–119.

   Old:

   ```ts
       const tauri = JSON.parse(await readRepoFile('desktop', 'tauri.conf.json')) as {
         plugins: { updater: { endpoints: string[]; pubkey: string } }
       }

       expect(appVue).not.toContain('scheduleStartupUpdateCheck')
       expect(menu).toContain('#[cfg(target_os = "macos")]')
       expect(lib).toContain('tauri_plugin_updater::Builder::new().build()')
       expect(updater).toContain('checkForAppUpdate')
       expect(tauri.plugins.updater.endpoints).toHaveLength(1)
       expect(tauri.plugins.updater.pubkey).toBeTruthy()
     })
   ```

   New:

   ```ts
       const tauriRaw = await readRepoFile('desktop', 'tauri.conf.json')
       const tauri = JSON.parse(tauriRaw) as {
         plugins: Record<string, unknown>
       }

       expect(appVue).not.toContain('scheduleStartupUpdateCheck')
       expect(menu).toContain('#[cfg(target_os = "macos")]')
       expect(lib).toContain('tauri_plugin_updater::Builder::new().build()')
       expect(updater).toContain('checkForAppUpdate')
       expect(tauri.plugins).toBeDefined()
       expect(tauri.plugins.updater).toBeUndefined()
       expect(tauriRaw).not.toContain('open-pencil/open-pencil')
       expect(tauriRaw).not.toContain('pubkey')
     })
   ```

   The test's name still describes it accurately: the updater is disabled by config, while the code
   files remain present and inert.

## Acceptance Criteria

- [ ] `desktop/tauri.conf.json` contains no occurrence of `open-pencil/open-pencil`.
- [ ] `desktop/tauri.conf.json` contains no `pubkey` key.
- [ ] `desktop/tauri.conf.json` contains `"plugins": {}` — the key is present and empty.
- [ ] `desktop/tauri.conf.json` parses as valid JSON.
- [ ] `bun test tests/engine/app/identity.test.ts` reports **5 pass, 0 fail, 38 expect() calls**.
      The expect count rising from 20 to 38 is expected and is itself a check: it proves the
      assertions formerly masked by the line-63 abort now execute.
- [ ] `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` all still read `0.6.33`.
- [ ] `desktop/Cargo.lock` still reads `0.6.32` for `open_pencil` — i.e. no `cargo` command ran.
- [ ] The test now fails if the updater block is restored. Optional spot check: re-add the block,
      confirm the suite goes red, remove it again.
- [ ] Exactly two files changed: `desktop/tauri.conf.json` and `tests/engine/app/identity.test.ts`.
- [ ] The dev server starts and the editor shell loads with no console error.

## Verification

### Development loop — repeat as needed

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```
bun test tests/engine/app/identity.test.ts
```

Expected on completion: `5 pass`, `0 fail`, `38 expect() calls`.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`, in order. All three were executed against the end
state during expansion and all three passed.

```
bunx tsgo --noEmit
```

Expected: exit 0, no diagnostics. An `ExperimentalWarning: process.execve` line on stderr is normal
and is not a failure.

```
bunx oxlint -c oxlint.json tests/engine/app/identity.test.ts
```

Expected: `Found 0 warnings and 0 errors.`

```
python -c "import json;json.load(open('desktop/tauri.conf.json'));print('valid json')"
```

Expected: `valid json`.

## Integration or Installed-Result Check

Browser check only. Desktop proof is **not** authorised for this packet.

```
bun run dev
```

Open `http://localhost:1420`. Confirm the editor shell loads and the canvas renders; the tab title
reads `Silverpoint`; and the console shows no new error, in particular nothing referencing `updater`
or `plugin-updater`.

## Stop Conditions

Stop and report rather than proceeding if:

- the `updater` block is already absent at pre-flight, or the baseline is not 3 pass / 2 fail / 20
  expect() calls;
- `identity.test.ts` fails after step 7 for any reason other than the five documented edits;
- the expect() count on a green run is not 38;
- `bunx tsgo --noEmit` reports an error in a file this packet did not touch;
- any change would be required outside the two files in Allowed Changes;
- `desktop/Cargo.lock` shows as modified at any point;
- the dev server fails to start or the editor shell does not render.

## Execution Report Contract

Report: the two files changed with a one-line description each; the before/after result of the
development-loop command including both the pass/fail counts and the expect() counts; the output of
every final gate; the browser-check observations; whether the optional restore-the-block spot check
was run and its result; any assumption used; any gap left open. State explicitly that no Git command
and no `cargo` command was run.

## Status record

Expanded 2026-08-25 10:05 Africa/Johannesburg, revision 1. Created because G-001a is not executable
as written: its Allowed Changes cover two assertions, but removing the updater block requires five
edits across the same file, one of them to a test whose current assertions contradict the packet's
goal outright.

Verified during expansion by applying the complete end state to live source: the suite reached
5 pass / 0 fail / 38 expect() calls, `bunx tsgo --noEmit` exited 0, `oxlint` reported 0 warnings and
0 errors, and the config parsed as valid JSON. Both files were then restored from backup and their
md5 sums re-checked against the baseline recorded above — the tree is untouched and the suite is
back at 3 pass / 2 fail. Every command output quoted in this packet was observed, not predicted.

Two facts discovered here that G-001a's expansion missed and that are binding for the executor:
`toMatchObject` at line 63 masks the failures at lines 82 and 85, so the stale-version count is four
rather than two; and `desktop/Cargo.lock` carries `0.6.32` while `desktop/Cargo.toml` carries
`0.6.33`, which is why steps 5 and 6 set deliberately different values and why every `cargo` command
is barred.

---

Executed 2026-08-25. All five Implementation Steps applied to live source:
`desktop/tauri.conf.json`'s `plugins.updater` block replaced with `"plugins": {}`; the four stale
`0.1.0` version assertions in `tests/engine/app/identity.test.ts` corrected to `0.6.33` (packageJson,
tauri, Cargo.toml) and `0.6.32` (Cargo.lock); the updater test inverted to assert the block's absence.

`bun test tests/engine/app/identity.test.ts`: 3 pass/2 fail/20 expect() at pre-flight →
**5 pass/0 fail/38 expect()** at completion. `bunx tsgo --noEmit` exited 0 with no diagnostics.
`bunx oxlint -c oxlint.json tests/engine/app/identity.test.ts` reported 0 warnings/0 errors.
`desktop/tauri.conf.json` parsed as valid JSON. Browser check via `bun run dev` on
`localhost:1420`: editor shell loaded, tab title read `Silverpoint`, all panels rendered, zero
console errors (none referencing `updater` or `plugin-updater`).

Optional spot check run: restored the updater block, suite went red (4 pass/1 fail/36 expect(),
failing at the inverted `tauri.plugins.updater` assertion as designed), then removed the block again
and reconfirmed green (5 pass/0 fail/38 expect()).

Exactly two files changed: `desktop/tauri.conf.json` and `tests/engine/app/identity.test.ts`.
`desktop/Cargo.lock` was read (md5-checked) but never modified. No Git command of any kind was run.
No `cargo` command of any kind was run. No assumptions beyond the packet's documented baseline; no
gaps opened beyond those already listed under Deferred to a later packet.

Status: **Done**
