# G-001a - Remove the upstream auto-updater — DEAD, SUPERSEDED BY G-001d

> **This packet is dead. Do not execute it.** Superseded in full by
> `Plan/Packets/G-001d-remove-updater-and-realign-identity-test.md` on 2026-08-25.
>
> An execution attempt halted at this packet's own Stop Condition 2. Step 2 breaks a third test in
> `identity.test.ts` — `disables startup updater access while retaining inert compatibility files`,
> lines 104–119 — which asserts `tauri.plugins.updater.endpoints` has length 1 and `pubkey` is
> truthy, the opposite of this packet's goal. That test is outside the Allowed Changes below, so
> this packet cannot reach 5 pass / 0 fail. Two further defects: the stale-version count is four,
> not two (`toMatchObject` at line 63 aborts before lines 82 and 85), and Implementation Step 4 is
> wrong — `toMatchObject` ignores unlisted keys, so the expected object needs no `plugins` or
> `bundle.targets` edit.
>
> Retained only because the project has no version control. It is deliberately absent from the
> table in `Plan/plan.md`.

Task ID: G-001a
Packet state: Dead — superseded by G-001d
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: G-001b, G-001c, G-002a
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-001.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: `desktop/tauri.conf.json`; `src/app/shell/updater.ts`; `src/app/shell/menu/use.ts`; `desktop/src/lib.rs`; `desktop/Cargo.toml`; `tests/engine/app/identity.test.ts` (executed during expansion).
Delivery: named source gates + browser check
Execution size: 2 core implementation files; 1 test file across 1 suite; no split required.

## Intended Outcome

The published application no longer polls OpenPencil's release feed for its own updates, and
`identity.test.ts` passes.

## Request Coverage

The project publishes to the public fork `https://github.com/Dayle22/Silverpoint`. This defect must
not be frozen into public history.

## Verified Starting State

`desktop/tauri.conf.json` lines 61–69, verified verbatim:

```json
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDU4QzBCRjBFNzhFNEVEMDEKUldRQjdlUjREci9BV0hLaEJPeG5tRXdsWkhQWFdEa0VxcEtNR1o1S2VJeGlKU1VDTldQTi9wYncK",
      "endpoints": [
        "https://github.com/open-pencil/open-pencil/releases/latest/download/latest.json"
      ],
      "windows": {
        "installMode": "passive"
      }
    }
```

Both the endpoint and the `pubkey` belong to upstream. A published Silverpoint would accept
OpenPencil's signed builds as its own updates. `ls desktop/*.key` returns no file, so this project
holds no private signing key and cannot sign updates of its own.

Call sites — **all four are left untouched by this packet**:

| Path | Symbol | Line |
| --- | --- | --- |
| `src/app/shell/updater.ts` | `scheduleStartupUpdateCheck()`; dynamic `import('@tauri-apps/plugin-updater')` | 40; 51 |
| `src/app/shell/menu/use.ts` | `checkForAppUpdate` import | 13 |
| `desktop/src/lib.rs` | `tauri_plugin_updater::Builder::new().build()` | 147 |
| `desktop/Cargo.toml` | `tauri-plugin-updater = "2"` | 34 |

`bun test tests/engine/app/identity.test.ts` was executed during expansion: **3 pass, 2 fail**, 5
tests, 20 expect() calls. Both failures are pre-existing:

- line 21 — expects `version: '0.1.0'`; actual is `0.6.33` in `package.json:3`,
  `desktop/tauri.conf.json:4` and `desktop/Cargo.toml:3`.
- line 63 — the expected Tauri object omits the live `plugins.updater` block and `bundle.targets: "all"`.

The renamed identity strings matched in the failure diff (`"identifier": "com.dayle22.silverpoint"`,
`"productName": "Silverpoint"`), so the rename is correct and the test is stale.

## Read First

1. `desktop/tauri.conf.json` lines 55–75 — the `plugins` and `bundle` blocks.
2. `tests/engine/app/identity.test.ts` lines 13–100 — the two failing assertions.

Nothing else.

## Fixed Decisions

1. **Remove the `updater` block rather than repoint it.** Repointing to `Dayle22/Silverpoint` would
   still carry upstream's `pubkey`, and no private key exists, so every check would fail signature
   validation. Removal disables the feature cleanly.
2. **Leave the updater code, Rust plugin and Cargo dependency in place.**
   `src/app/shell/updater.ts:51` imports the plugin dynamically; with no config the check is a no-op.
   Removing the dependency touches Rust, `Cargo.lock` and the menu — a separate responsibility.
3. **Update the test to match live source, not the reverse.** `0.6.33` is correct and
   `bundle.targets: "all"` is intended. After step 2 the `plugins.updater` block is absent, so the
   expected object must omit it too.
4. **No version bump.** `Plan/plan.md`'s delivery policy forbids touching version fields without
   explicit build authorisation.

## Open Decisions

**Auto-update later.** Recommended default: stays disabled. To enable, generate a minisign keypair
(`bun run tauri signer generate`), keep the private key out of the repository, publish `latest.json`
on `Dayle22/Silverpoint` releases, and restore the block with your own pubkey and endpoint.
Consequence of the default: the menu item becomes inert and users get no automatic updates — correct
for a fork with no releases.

## Allowed Changes

- `desktop/tauri.conf.json` — remove the `updater` object from `plugins`.
- `tests/engine/app/identity.test.ts` — correct the two stale expectations.
- This packet's `## Status record` section only.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Git commands of any kind.** Not `git init`, not `git status`. G-002a onward owns Git.
- No version bump in `package.json`, `desktop/tauri.conf.json` or `desktop/Cargo.toml`.
- No desktop build, no `bun run tauri build`, no NSIS install, no installed-identity check.
- No `bun run check`, `bun run test`, `bun run test:unit`, or any umbrella suite.
- No new or removed npm/Cargo dependency.
- No edits to `src/app/shell/updater.ts`, `src/app/shell/menu/use.ts`, `desktop/src/lib.rs` or
  `desktop/Cargo.toml` — Fixed Decision 2.
- No `bun install`, no `bun.lock` edit.
- No edits to `AGENTS.md`, `.gitignore`, or any file owned by G-001b or G-001c.
- No edits to `Plan/plan.md`.

### Deferred to a later packet

- Removing `tauri-plugin-updater` entirely, if auto-update stays permanently disabled.
- Generating a Silverpoint signing key and release pipeline.

## Implementation Steps

1. **Pre-flight.** Reread `desktop/tauri.conf.json` lines 55–75 and confirm the `updater` object is
   present with upstream's endpoint. If already absent, stop and report — the tree has drifted.

2. **Remove the updater config.** Delete the entire `"updater": { … }` member from the `plugins`
   object, including `pubkey`, `endpoints` and `windows`. If `updater` is the only member of
   `plugins`, leave `"plugins": {}` — do not remove the `plugins` key itself, because
   `desktop/src/lib.rs:147` still registers the plugin and Tauri expects the key to parse. Confirm
   the file is still valid JSON.

3. **Correct the version expectation.** In `tests/engine/app/identity.test.ts` line 21, change
   `version: '0.1.0'` to `version: '0.6.33'`.

4. **Correct the Tauri config expectation.** In the assertion ending at line 63, update the expected
   object to match live config after step 2: no `plugins.updater` member, `bundle.targets: "all"`
   present. Read the actual diff from the development-loop command rather than guessing the shape.

## Acceptance Criteria

- [ ] `desktop/tauri.conf.json` contains no occurrence of `open-pencil/open-pencil`.
- [ ] `desktop/tauri.conf.json` contains no `pubkey` key.
- [ ] `desktop/tauri.conf.json` parses as valid JSON.
- [ ] `bun test tests/engine/app/identity.test.ts` reports 5 pass, 0 fail.
- [ ] `package.json`, `desktop/tauri.conf.json` and `desktop/Cargo.toml` all still read `0.6.33`.
- [ ] Exactly two files changed: `desktop/tauri.conf.json` and `tests/engine/app/identity.test.ts`.
- [ ] The dev server starts and the editor shell loads with no console error.

## Verification

### Development loop — repeat as needed

Run from `C:\Users\User\Documents\OpenPotlood\App`:

```
bun test tests/engine/app/identity.test.ts
```

Expected on completion: `5 pass`, `0 fail`. Use its diff output to drive step 4.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`, in order:

```
bunx tsgo --noEmit
```

```
bunx oxlint -c oxlint.json tests/engine/app/identity.test.ts
```

```
python -c "import json;json.load(open('desktop/tauri.conf.json'));print('valid json')"
```

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

- the `updater` block is already absent at pre-flight;
- `identity.test.ts` fails for any reason other than the two documented assertions;
- `bunx tsgo --noEmit` reports an error in a file this packet did not touch;
- any change would be required outside the two files in Allowed Changes;
- the dev server fails to start or the editor shell does not render.

## Execution Report Contract

Report: the two files changed with a one-line description each; the before/after result of the
development-loop command; the output of every final gate; the browser-check observations; any
assumption used; any gap left open. State explicitly that no Git command was run.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-001 so the executor handles one
responsibility. Verified during expansion: `identity.test.ts` executed at 3 pass / 2 fail with both
failures traced to version and config drift, not the rename; upstream's release endpoint and pubkey
confirmed at `desktop/tauri.conf.json` lines 61–69; no private signing key exists under `desktop/`.
