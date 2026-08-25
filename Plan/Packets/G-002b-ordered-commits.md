# G-002b - Land the divergence as six ordered commits

Task ID: G-002b
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-002a
Related: G-002c
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-002.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: measured divergence of `App/` against upstream commit `6c9ef9d1`; `App/packages/` workspace list in `package.json`.
Delivery: Git-only. No source gates, no build, no version bump.
Execution size: 0 implementation files; 0 test files; Git commits only; no split required.

**Deviation from the standard delivery line.** No application source changes, so source gates and a
browser check would prove nothing. G-001a owns the browser check for this migration.

**Git authorisation.** Explicitly granted by the user on 2026-08-25, scoped to the `G-` packets.

## Intended Outcome

The project's divergence from upstream is recorded as six readable, thematically grouped commits on a
named branch. Nothing is pushed. Not one byte of the working tree changes.

## Request Coverage

A single commit of 874 changed files is permanently unreadable and makes `git blame` useless. The
656-file locale deletion in particular must not drown the substantive diff. Six commits cost roughly
twenty minutes more and keep the fork legible for as long as it exists.

## Verified Starting State

**G-002a must have completed.** At the start of this packet:

- `git rev-parse HEAD` is `6c9ef9d10320df2d560d2a89b13093660dabde87`;
- `origin` and `upstream` remotes both exist;
- `git config --get filter.lfs.clean` returns a non-empty value;
- `git status --porcelain -- tests/fixtures` is empty;
- `git status --porcelain -- packages/kiwi/src` is empty.

Measured divergence from `6c9ef9d1`, excluding `node_modules`, `dist`, `test-results`,
`.playwright-cli`, `scratch`, `coverage`:

| Bucket | Files | Code lines |
| --- | --- | --- |
| Untouched upstream | 1,257 | 117,540 |
| Modified upstream | 296 | 57,707 (+11,964 / −2,017 inside) |
| New in this project | 256 | 45,270 |
| Deleted from upstream | 737 files, mostly `packages/docs` locales | 1,743 code lines |

The workspace packages, from `package.json`, are: `scene-graph`, `pen`, `kiwi`, `fig`, `core`,
`dom-css`, `vue`, `cli`, `mcp`, `docs`.

## Read First

Nothing. This packet reads no application source and no packet body. Its inputs are G-002a's recorded
outputs and the staging table below.

## Fixed Decisions

1. **Six commits, grouped by path.** The changes separate cleanly along directory lines. This is the
   only grouping that keeps the locale deletion, the new core modules, and the test suites legible as
   distinct pieces of work.
2. **Commit 1 carries the `.lfsconfig` deletion.** `git add .lfsconfig` stages a deletion correctly
   because the file exists in the base commit. It must land in the hygiene commit, not be swept into
   commit 6.
3. **Commit 6 uses `git add -A` as a sweep.** It catches `desktop/`, `tests/`, `tools/`, `docs/` and
   root config files without enumerating them, which keeps the packet robust against small drift.
4. **Name the branch, do not push.** Pushing is G-002c, so the public one-way door stays a separate
   authorised step.
5. **Use `git branch -M`, not `git checkout -b`.** `-M` renames the current branch in place and does
   not write to the working tree. `checkout` is banned.

## Open Decisions

None.

## Allowed Changes

- Git objects, index, refs and branch name inside `App/.git/`.
- This packet's `## Status record` section only.

No file under `App/` outside `.git/` may be created, modified or deleted.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

**Banned commands:**

```
git checkout      git switch        git restore       git clean
git reset         git stash         git rm            git mv
git merge         git rebase        git pull          git cherry-pick
git revert        git push          git tag           git commit --amend
```

`git reset` is banned outright in this packet — G-002a has already positioned `HEAD`.

Additionally:

- Do not push. Do not create a pull request.
- Do not use `--force` or `--force-with-lease` anywhere.
- Do not amend, squash, or reorder commits after creating them.
- No build, install, test, or package-manager command.
- No edits to `.gitignore`, `.gitattributes`, or any application source.
- No edits to `Plan/plan.md`.

## Implementation Steps

1. **Pre-flight — hard stop.** From `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   git rev-parse HEAD
   git config --get filter.lfs.clean
   git status --porcelain -- tests/fixtures
   ```

   Required: `HEAD` is `6c9ef9d10320df2d560d2a89b13093660dabde87`; the filter value is non-empty; the
   fixtures output is empty. **If any differs, stop and report — G-002a has not completed correctly.**

2. **Create the six commits, in order.** For each row, run `git add -- <paths>` then
   `git commit -m "<message>"`. Run them one at a time and check `git status --porcelain | wc -l`
   after each, so a mistake is caught at the row that caused it.

   | # | `git add --` paths | Commit message |
   | --- | --- | --- |
   | 1 | `README.md .gitignore .lfsconfig AGENTS.md AGENTS.local.md` | `chore: fork hygiene — drop upstream LFS credentials, ignore private material, restore AGENTS.md` |
   | 2 | `packages/docs` | `chore(docs): remove upstream translated documentation trees` |
   | 3 | `packages/vue/src/i18n` | `refactor(i18n): restructure Vue locales into messages/` |
   | 4 | `packages/core` | `feat(core): add barcode and canvas modules` |
   | 5 | `src packages/vue packages/scene-graph packages/mcp packages/pen packages/fig packages/kiwi packages/dom-css packages/cli` | `feat(editor): Silverpoint editor, components and engine changes` |
   | 6 | `-A` | `test: engine and e2e suites, Windows sidecar tooling, remaining changes` |

   `AGENTS.local.md` is gitignored by G-001c, so `git add` will refuse it silently — that is correct
   and expected. Do not use `-f` to force it in.

   If a `git add` matches nothing and the subsequent `git commit` reports nothing to commit, **skip
   that commit and record the skip in the report**. Do not improvise different paths.

3. **Name the branch.**

   ```
   git branch -M snapshot/divergence-2026-07-17
   ```

4. **Verify the sequence.**

   ```
   git log --oneline -7
   ```

   Expected: the six commit messages above in order, with `6c9ef9d` as the seventh entry.

5. **Verify the tree is fully captured.**

   ```
   git status --porcelain | wc -l
   ```

   Expected: `0`. A non-zero value means something was neither committed nor ignored — report the
   remaining paths rather than forcing them in.

## Acceptance Criteria

- [ ] `git log --oneline` shows exactly six commits above `6c9ef9d`, in the order given.
- [ ] Each commit message matches the table verbatim.
- [ ] The branch is named `snapshot/divergence-2026-07-17`.
- [ ] `git status --porcelain` returns `0` lines after step 5.
- [ ] `git status --porcelain -- tests/fixtures` was empty at pre-flight and no LFS object was created.
- [ ] No commit was amended, squashed or reordered.
- [ ] Nothing was pushed: `git ls-remote --heads origin` does not list
      `snapshot/divergence-2026-07-17`.
- [ ] No banned command appears in the execution transcript.

## Verification

### Development loop — repeat as needed

Not applicable. Step 2 is checked per row; steps 4 and 5 are the closing gates.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
git log --oneline -7
```

```
git status --porcelain | wc -l
```

```
git branch --show-current
```

Expected: seven entries ending at `6c9ef9d`; `0`; `snapshot/divergence-2026-07-17`.

## Integration or Installed-Result Check

None. No application source changed. G-002c performs the closing digest comparison.

## Stop Conditions

Stop and report rather than proceeding if:

- pre-flight shows `HEAD` is not `6c9ef9d1`, or the LFS filter is unset, or fixtures are dirty;
- any `git commit` reports an LFS upload or an unexpectedly large object;
- `git status --porcelain` is non-zero after step 5;
- a commit lands with the wrong message or in the wrong order — report rather than amending;
- any recovery would require a banned command.

## Execution Report Contract

Report: the pre-flight values; the six commit SHAs with their messages, in order; any commit skipped
because its `git add` matched nothing; the `git status --porcelain` count after step 5; the branch
name; explicit confirmation that nothing was pushed; any assumption used; any gap left open.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-002 so commit sequencing is separate from
the graft and from the irreversible push. Verified during expansion: the divergence separates cleanly
along the six path groups; `packages/docs` accounts for 656 of the 737 deletions; the workspace
package list was read from `App/package.json`.

Executed 2026-08-25 11:46 Africa/Johannesburg.
- Pre-flight verified: HEAD at `6c9ef9d10320df2d560d2a89b13093660dabde87`, LFS clean filter active (`git-lfs clean -- %f`), LFS fixtures clean.
- Commit 1: `69de5015` — `chore: fork hygiene — drop upstream LFS credentials, ignore private material, restore AGENTS.md`
- Commit 2: `bf93843b` — `chore(docs): remove upstream translated documentation trees`
- Commit 3: `2b68e55b` — `refactor(i18n): restructure Vue locales into messages/`
- Commit 4: `cdd8bba5` — `feat(core): add barcode and canvas modules`
- Commit 5: `c94a1e1e` — `feat(editor): Silverpoint editor, components and engine changes`
- Commit 6: `94964223` — `test: engine and e2e suites, Windows sidecar tooling, remaining changes`
- Branch renamed to `snapshot/divergence-2026-07-17` via `git branch -M`.
- Working tree fully committed: `git status --porcelain` count is `0`.
- Verified nothing pushed to remote: `git ls-remote --heads origin snapshot/divergence-2026-07-17` returned empty.
- 0 banned commands used. Working tree files outside `.git/` untouched.
