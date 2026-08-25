# G-001c - Ignore rules and working-tree cruft

Task ID: G-001c
Packet state: Ready
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: none
Related: G-001a, G-001b, G-002a
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-001. User note: "im sure the folders are messy in app".
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: `App/.gitignore`; audit of every top-level and dot-directory under `App/`; `tests/fixtures/idml/startup_log.txt`.
Delivery: named source gates + browser check
Execution size: 2 core implementation files; 0 test files; no split required.

## Intended Outcome

Nothing private, local, or stale is published. Every directory that would reach the public repository
is one that belongs there.

## Request Coverage

> "i also dont want the plan md to be added, just the app"
> "im sure the folders are messy in app"

`Plan/`, `Toolbox/` and `Mockups/` are siblings *outside* the repository root at `App/`, so Git cannot
reach them and no rule is needed. This packet handles the private material that sits *inside* `App/`.

## Corrections to revision 1

Revision 1 quoted the build-output block's comment as `# OpenPotlood: local build outputs and
shareable bundles`. The live line reads **`# Silverpoint: ...`**. An execution attempt correctly
halted at Stop Condition 1 on this mismatch.

The working tree was never wrong — the packet was. The parent session appended that comment to
`.gitignore` and *then* ran the OpenPotlood → Silverpoint rename, which rewrote the comment; the
packet was written from the pre-rename text. The four path lines were always correct and unchanged.

Revision 2 quotes the live tail verbatim and adds the pre-existing `# OpenCode` block above it so the
pre-flight comparison is unambiguous. No behaviour, step, or acceptance criterion changed.

## Verified Starting State

`App/.gitignore` already ends with this block, added by the parent session on 2026-08-25 and
re-verified against the live file at revision 2 — the final 7 lines, at lines 78–85:

```
# OpenCode
.opencode/

# Silverpoint: local build outputs and shareable bundles
/desktop/binaries/
/desktop/share-me/
/desktop/gen/
/desktop/*.zip
```

The `# OpenCode` block is pre-existing upstream-era content and is shown only so the tail is
unambiguous. The block this packet cares about is the `# Silverpoint:` one, at lines 81–85.

`/desktop/gen/` duplicates `/gen/` in the nested `App/desktop/.gitignore`. Harmless; leave both.

Audit of everything under `App/` that would currently be published:

| Path | Files | Status | Verdict |
| --- | --- | --- | --- |
| `.playwright-cli/` | 6, incl. `console-2026-07-30T08-05-55-914Z.log` | **not ignored** | ignore — local Playwright CLI state |
| `docs/superpowers/` | 2 plan/spec docs carrying local absolute paths | **not ignored** | ignore — private working notes |
| `.claude/launch.json` | 1 | **not ignored** | ignore — local dev-server config |
| `Mockups/` | **0 — empty** | untrackable | delete — stale; real mockups are at `../Mockups/` |
| `.github/` | 17 | published | keep — upstream's, in the graft base |
| `.storybook/`, `.vscode/` | 2, 1 | published | keep — upstream's |
| `packages/*/node_modules` | 10 directories | ignored | keep — already covered by the unanchored `node_modules/` at `.gitignore:2` |

All three paths to ignore are **absent from the graft base commit**, so `.gitignore` untracks them
cleanly with no `git rm`.

Separately, a rename replacement rewrote `Documents\OpenPotlood\App` →
`Documents\Silverpoint\App` inside absolute paths. That folder does not exist. Verified occurrences:

| Path | Line | Disposition |
| --- | --- | --- |
| `AGENTS.md` | 5 | G-001b owns it — **do not touch** |
| `docs/superpowers/plans/2026-08-07-figma-style-panel-controls-plan.md` | 13 | becomes gitignored; leave as-is |
| `docs/superpowers/specs/2026-08-07-figma-style-panel-controls-design.md` | 11, 285 | becomes gitignored; leave as-is |
| `tests/fixtures/idml/startup_log.txt` | 2 | **fix here** |

`startup_log.txt` is a captured InDesign export log — a historical record of what the tool actually
printed. It should never have been rewritten.

## Read First

1. `App/.gitignore` — the final block, reproduced above; confirm it is present.
2. `tests/fixtures/idml/startup_log.txt` line 2.

Nothing else.

## Fixed Decisions

1. **Ignore rather than delete `docs/superpowers/`, `.claude/` and `.playwright-cli/`.** They are
   useful locally and absent from the graft base, so ignoring is sufficient and reversible.
2. **Delete `Mockups/` only because it is empty.** Git cannot publish an empty directory, so this is
   housekeeping, not a publication fix.
3. **Revert `startup_log.txt` to `OpenPotlood`, do not rename the folder.** The live directory is
   `C:\Users\User\Documents\OpenPotlood`; renaming it mid-migration risks breaking open handles, the
   dev server, and this packet's own paths.
4. **Leave the two `docs/superpowers/` files unrepaired.** Once gitignored they are never published,
   and editing them would add churn for no benefit.

## Open Decisions

None.

## Allowed Changes

- `.gitignore` — append the block in step 2.
- `tests/fixtures/idml/startup_log.txt` — line 2 only.
- Deletion of the empty directory `App/Mockups/`.
- This packet's `## Status record` section only.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Git commands of any kind.**
- Do not edit `AGENTS.md` or create `AGENTS.local.md` — G-001b owns those.
- Do not edit `desktop/tauri.conf.json` or `tests/engine/app/identity.test.ts` — G-001a owns those.
- Do not edit the two files under `docs/superpowers/` — Fixed Decision 4.
- Do not delete `.playwright-cli/`, `.claude/` or `docs/superpowers/` from disk; only ignore them.
- Do not delete `Mockups/` if it contains any file.
- Do not remove or reorder any existing `.gitignore` line; append only.
- No build, install, version bump, umbrella suite, dependency change, or `bun install`.
- No edits to `Plan/plan.md`.

## Implementation Steps

1. **Pre-flight.** Run `tail -9 .gitignore` and confirm it matches the block reproduced above —
   `# Silverpoint: local build outputs and shareable bundles` followed by the four `/desktop/...`
   lines. **Compare the four path lines, not the comment text**; a differing project name in the
   comment is cosmetic and is not a stop. Then confirm `App/Mockups/` contains 0 files. If `Mockups/`
   is non-empty, skip step 3 and report.

2. **Append the ignore block** to the end of `App/.gitignore`, exactly:

   ```
   # Local-only agent routing and private working notes (never published)
   AGENTS.local.md
   docs/superpowers/
   .claude/
   .playwright-cli/
   ```

   `AGENTS.local.md` is listed here even though G-001b creates it; an ignore entry for a file that
   does not yet exist is valid and harmless, so these two packets have no ordering dependency.

3. **Delete the empty directory** `App/Mockups/`. From `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   rmdir Mockups
   ```

   `rmdir` refuses to delete a non-empty directory, which is the intended safety behaviour. If it
   fails, leave the directory and report.

4. **Revert the captured log path.** In `tests/fixtures/idml/startup_log.txt` line 2, change
   `Documents\Silverpoint\App` back to `Documents\OpenPotlood\App`. Change nothing else in the file.

## Acceptance Criteria

- [ ] `.gitignore` lists `AGENTS.local.md`, `docs/superpowers/`, `.claude/` and `.playwright-cli/`.
- [ ] Every `.gitignore` line present before this packet is still present, in the same order.
- [ ] `App/Mockups/` no longer exists, **or** the report states it was non-empty and was kept.
- [ ] `tests/fixtures/idml/startup_log.txt` contains `Documents\OpenPotlood\App` and no
      `Documents\Silverpoint`.
- [ ] `docs/superpowers/`, `.claude/` and `.playwright-cli/` still exist on disk.
- [ ] Exactly one file modified, one file edited on a single line, and one empty directory removed.

## Verification

### Development loop — repeat as needed

Not applicable — no edit-test cycle. Each step is verified by its own check.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
tail -6 .gitignore
```

Expected: the four new entries under their comment.

```
grep -rIn "Documents.Silverpoint" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=test-results --exclude-dir=scratch --exclude-dir=.playwright-cli
```

Expected: matches only in `AGENTS.md` (G-001b's responsibility, if it has not yet run) and the two
`docs/superpowers/` files. **No match in `tests/fixtures/`.**

```
ls -d .playwright-cli .claude docs/superpowers && ls -d Mockups 2>&1
```

Expected: the first three exist; `Mockups` reports "No such file or directory".

## Integration or Installed-Result Check

None required. `.gitignore` has no runtime effect; `startup_log.txt` is a static fixture read by no
test at import time; the deleted directory was empty. G-001a performs the browser check for this
migration.

## Stop Conditions

Stop and report rather than proceeding if:

- the four `/desktop/...` path lines at the end of `.gitignore` do not match the block above — a
  differing comment line is **not** a stop;
- `App/Mockups/` contains any file — keep it and report;
- `rmdir` fails for any reason other than the directory already being absent;
- `tests/fixtures/idml/startup_log.txt` line 2 does not contain `Documents\Silverpoint\App`;
- any change would be required outside the paths in Allowed Changes.

## Execution Report Contract

Report: the appended `.gitignore` lines; whether `Mockups/` was deleted or kept and why; the
before/after line 2 of `startup_log.txt`; the output of all three final gates; any assumption used;
any gap left open. State explicitly that no Git command was run.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-001 so the executor handles one
responsibility. Verified during expansion: `.playwright-cli/` holds 6 files including a console log
and was not ignored; `docs/superpowers/` holds 2 private docs; `.claude/launch.json` is local config;
`App/Mockups/` is empty while the real mockups are at `../Mockups/`; the 10 nested
`packages/*/node_modules` directories are already covered by the unanchored `node_modules/` pattern;
five absolute paths were broken by the rename, of which only `startup_log.txt` is this packet's.

Executed 2026-08-25. Pre-flight confirmed the `.gitignore` tail's four `/desktop/...` lines matched
(comment already read `# Silverpoint:`, consistent with revision 2) and `App/Mockups/` was empty.
Appended the four-line ignore block (`AGENTS.local.md`, `docs/superpowers/`, `.claude/`,
`.playwright-cli/`) after the existing `# Silverpoint: local build outputs...` block; no existing line
removed or reordered. Deleted the empty `App/Mockups/` directory. Reverted
`tests/fixtures/idml/startup_log.txt` line 2 from `Documents\Silverpoint\App` to
`Documents\OpenPotlood\App`; no other line touched. Final gates: `tail -6 .gitignore` shows the four
new entries; `grep -rIn "Documents.Silverpoint"` matches only the two `docs/superpowers/` files (no
match in `tests/fixtures/` or `AGENTS.md`, since G-001b already ran); `.playwright-cli/`, `.claude/`,
`docs/superpowers/` still exist on disk and `Mockups` reports "No such file or directory". Exactly one
file modified (`.gitignore`), one file edited on a single line (`startup_log.txt`), one empty directory
removed (`Mockups/`). No Git command was run. All acceptance criteria met. Status: Done.
