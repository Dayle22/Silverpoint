# G-001b - Make AGENTS.md publishable

Task ID: G-001b
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: none
Related: G-001a, G-001c, G-002a
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-001.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: `App/AGENTS.md` (15 lines); `Toolbox/upstream-open-pencil-master/AGENTS.md` (35,499 bytes); user confirmation that only `App/` is published.
Delivery: named source gates + browser check
Execution size: 2 core implementation files; 0 test files; no split required.

## Intended Outcome

`App/AGENTS.md` becomes upstream's contributor guide again — correct and useful for anyone who clones
the public repository — while this project's local routing moves to a file that is never published.

## Request Coverage

The user confirmed only `App/` is published and that multiple AI agents should eventually collaborate
on the repository. `AGENTS.md` is loaded automatically by agent tooling, so it is the single most
consequential file for that goal.

## Verified Starting State

`App/AGENTS.md` is **15 lines**. Upstream's file at the same path is **35,499 bytes** — a full
contributor guide, preserved at `Toolbox/upstream-open-pencil-master/AGENTS.md`. This project replaced
it wholesale.

The current content, verified verbatim:

```markdown
# Silverpoint working route

This file stays small because it is loaded automatically for work under `App/`.

- `C:\Users\User\Documents\Silverpoint\App` is the only live application workspace.
- Read project state progressively: `../Plan/endgoal.md`, `../Plan/plan.md`, then only the selected file in `../Plan/Packets/`.
- `Plan/plan.md` is the only live status source. Lifecycle or status wording retained inside migrated packets is context, not current state.
- Treat `../Toolbox/` as supporting information or non-authoritative history. Never execute its old source copies or inherit completion claims from them.
- This is a private, local-only Windows project with no Git workflow. Do not create branches, commits, tags, releases, deployments, or publishing work unless the user explicitly authorises it.
- Inspect live target files and nearby conventions before editing. Preserve unrelated work and public package boundaries.
- Use the smallest evidence proportionate to the change and its risk. Run `bun run check`, `bun run test:unit`, or `bun run test` only when the user explicitly requests that exact umbrella command.
- After executing a packet, close it with the source gates named by that packet and then a browser check on the dev server: `cd App && bun run dev` (Vite, port 1420, hot reload; launch config `silverpoint-dev`). Do not build or install.
- A source or browser check alone does not prove desktop delivery. Build, install, and verify installed identity/version/hash and launch only when the user asks in that session, or when the change cannot be proven otherwise — Tauri config, Rust, icons, generated `desktop/generated/menu.json`, or an `IS_TAURI`-only surface.
- Synchronise desktop versions only as part of an authorised delivery in `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`.
- Stop on wrong-workspace evidence, conflicting plan state, out-of-scope changes, failed required checks, or build/install/identity mismatch. Report the blocker honestly.
```

Three defects if published as-is:

1. It references `../Plan/endgoal.md`, `../Plan/plan.md`, `../Plan/Packets/` and `../Toolbox/` — none
   of which exist in the repository, because only `App/` is published.
2. Line 5 names `C:\Users\User\Documents\Silverpoint\App`. **That folder does not exist.** The live
   path is `C:\Users\User\Documents\OpenPotlood\App`; a rename replacement rewrote the substring
   inside the absolute path.
3. It states "This is a private, local-only Windows project with no Git workflow. Do not create
   branches, commits, tags, releases…" — false once published, and it would instruct any agent
   cloning the repository to avoid Git entirely.

`AGENTS.md` exists in the graft base commit, so `.gitignore` cannot untrack it and `git rm --cached`
is banned in the G-002 packets. It must be corrected in source, here.

## Read First

1. `App/AGENTS.md` — all 15 lines, reproduced above; confirm they still match.

Nothing else. Do not read upstream's 35,499-byte file; step 2 copies it without inspection.

## Fixed Decisions

1. **Restore `AGENTS.md` byte-for-byte from upstream.** This produces *zero diff* against the graft
   base, so the published repository simply keeps upstream's contributor guide — accurate for the
   codebase, valuable to contributors and agents, and adding nothing to the project's diff.
2. **Move the local route to `AGENTS.local.md`, gitignored.** Those 15 lines are workspace routing
   that only makes sense beside `Plan/` and `Toolbox/`; they belong in a file that is never published.
   G-001c adds the ignore entry.
3. **Correct the broken path while moving it.** `C:\Users\User\Documents\Silverpoint\App` becomes
   `C:\Users\User\Documents\OpenPotlood\App`. Only the *project* was renamed to Silverpoint; the
   directory was not.
4. **Keep the launch-config name `silverpoint-dev` unchanged.** It refers to a config key, not a path.
5. **Correct the "no Git workflow" line in the local copy.** Git is now authorised for `G-` packets.

## Open Decisions

None.

## Allowed Changes

- `AGENTS.md` — replace with upstream's content byte-for-byte.
- `AGENTS.local.md` — create.
- This packet's `## Status record` section only.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Git commands of any kind.**
- Do not edit `.gitignore` — G-001c owns it.
- Do not edit `desktop/tauri.conf.json` or `tests/engine/app/identity.test.ts` — G-001a owns them.
- Do not edit `docs/superpowers/**`, `tests/fixtures/idml/startup_log.txt`, or delete `Mockups/` —
  G-001c owns those.
- Do not modify upstream's restored `AGENTS.md` content in any way after copying it. Not one
  character, including trailing whitespace or line endings.
- No build, install, version bump, umbrella suite, dependency change, or `bun install`.
- No edits to `Plan/plan.md`.

## Implementation Steps

1. **Pre-flight.** Confirm `App/AGENTS.md` is 15 lines and matches the block reproduced above. If it
   differs, stop and report.

2. **Restore upstream's file.** Copy `Toolbox/upstream-open-pencil-master/AGENTS.md` over
   `App/AGENTS.md`, preserving bytes exactly. From `C:\Users\User\Documents\OpenPotlood`:

   ```
   cp Toolbox/upstream-open-pencil-master/AGENTS.md App/AGENTS.md
   ```

   Then verify the result is exactly **35,499 bytes**.

3. **Create `App/AGENTS.local.md`** with the content below. This is the original 15 lines with two
   corrections applied — the workspace path, and the Git line:

   ```markdown
   # Silverpoint local working route

   Local-only. Never published; `.gitignore` excludes this file.

   - `C:\Users\User\Documents\OpenPotlood\App` is the only live application workspace. The project is named Silverpoint; the directory was not renamed.
   - Read project state progressively: `../Plan/endgoal.md`, `../Plan/plan.md`, then only the selected file in `../Plan/Packets/`.
   - `Plan/plan.md` is the only live status source. Lifecycle or status wording retained inside migrated packets is context, not current state.
   - Treat `../Toolbox/` as supporting information or non-authoritative history. Never execute its old source copies or inherit completion claims from them.
   - Git is authorised for `G-` packets only, per the GitHub migration note in `Plan/plan.md`. For every other packet, do not create branches, commits, tags, releases, deployments, or publishing work unless the user explicitly authorises it in that session.
   - Inspect live target files and nearby conventions before editing. Preserve unrelated work and public package boundaries.
   - Use the smallest evidence proportionate to the change and its risk. Run `bun run check`, `bun run test:unit`, or `bun run test` only when the user explicitly requests that exact umbrella command.
   - After executing a packet, close it with the source gates named by that packet and then a browser check on the dev server: `cd App && bun run dev` (Vite, port 1420, hot reload; launch config `silverpoint-dev`). Do not build or install.
   - A source or browser check alone does not prove desktop delivery. Build, install, and verify installed identity/version/hash and launch only when the user asks in that session, or when the change cannot be proven otherwise — Tauri config, Rust, icons, generated `desktop/generated/menu.json`, or an `IS_TAURI`-only surface.
   - Synchronise desktop versions only as part of an authorised delivery in `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`.
   - Stop on wrong-workspace evidence, conflicting plan state, out-of-scope changes, failed required checks, or build/install/identity mismatch. Report the blocker honestly.
   ```

## Acceptance Criteria

- [ ] `App/AGENTS.md` is exactly 35,499 bytes.
- [ ] `App/AGENTS.md` contains no occurrence of `Silverpoint`, `Plan/`, or `Documents\`.
- [ ] `App/AGENTS.md` is byte-identical to `Toolbox/upstream-open-pencil-master/AGENTS.md`.
- [ ] `App/AGENTS.local.md` exists and names `C:\Users\User\Documents\OpenPotlood\App`.
- [ ] `App/AGENTS.local.md` contains no occurrence of `Documents\Silverpoint`.
- [ ] Exactly one file changed and one created; nothing else under `App/` differs.

## Verification

### Development loop — repeat as needed

Not applicable — this packet has no edit-test cycle. Each step is verified by its own byte check.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood`:

```
cmp Toolbox/upstream-open-pencil-master/AGENTS.md App/AGENTS.md && echo IDENTICAL
```

Expected: `IDENTICAL`.

```
wc -c App/AGENTS.md
```

Expected: `35499`.

```
grep -c "Documents.Silverpoint" App/AGENTS.md App/AGENTS.local.md
```

Expected: `0` for both files.

## Integration or Installed-Result Check

None required — neither file is application source, imported by any module, or referenced at runtime.
`bun run dev` is unaffected by this packet, and G-001a already performs the browser check for this
migration.

## Stop Conditions

Stop and report rather than proceeding if:

- `App/AGENTS.md` is not 15 lines or does not match the reproduced block at pre-flight;
- `Toolbox/upstream-open-pencil-master/AGENTS.md` is missing or is not 35,499 bytes;
- `cmp` reports any difference after the copy;
- any change would be required outside the two files in Allowed Changes.

## Execution Report Contract

Report: the byte size of `AGENTS.md` after the copy; the `cmp` result; confirmation that
`AGENTS.local.md` exists with the corrected path; the grep counts; any assumption used; any gap left
open. State explicitly that no Git command was run.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-001 so the executor handles one
responsibility. Verified during expansion: `App/AGENTS.md` is 15 lines against upstream's 35,499
bytes; the file names a non-existent folder `C:\Users\User\Documents\Silverpoint\App` because a rename
replacement rewrote the substring inside an absolute path; the file asserts "no Git workflow", which
becomes false on publication.

Executed 2026-08-25. Pre-flight confirmed `App/AGENTS.md` matched the reproduced 15-line block.
Copied `Toolbox/upstream-open-pencil-master/AGENTS.md` over `App/AGENTS.md`; `cmp` reports
`IDENTICAL` and `wc -c` reports `35499`. Created `App/AGENTS.local.md` with the corrected workspace
path (`C:\Users\User\Documents\OpenPotlood\App`) and the Git-authorised-for-`G-`-packets line.
`grep -c "Documents.Silverpoint"` returns `0` for both files. Exactly one file changed
(`App/AGENTS.md`) and one created (`App/AGENTS.local.md`); no Git command was run. All acceptance
criteria met. Status: Done.
