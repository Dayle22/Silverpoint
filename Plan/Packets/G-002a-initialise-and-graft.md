# G-002a - Initialise the repository and graft onto upstream

Task ID: G-002a
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-001a, G-001b, G-001c
Related: G-002b, G-002c
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-002.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: GitHub API for `Dayle22/Silverpoint` and `open-pencil/open-pencil`; upstream LFS pointers at commit `6c9ef9d1`; `App/.gitattributes`; local `git 2.54.0.windows.1`, `git-lfs/3.7.1`.
Delivery: Git-only. No source gates, no build, no version bump.
Execution size: 0 implementation files; 0 test files; Git setup only; no split required.

**Deviation from the standard delivery line.** This packet changes no application source, so source
gates and a browser check would prove nothing. Its proof is a byte-level tree digest showing the
working tree is unchanged. G-001a owns the browser check for this migration.

**Git authorisation.** `App/AGENTS.md` and `Plan/PACKET-EXPANSION-BRIEF.md` forbid Git work by
default. The user explicitly authorised it on 2026-08-25 and supplied the repository URL. The
authorisation is scoped to the `G-` packets.

## Intended Outcome

`App/` becomes a Git working tree whose `HEAD` sits on the correct upstream commit, with the index
rewritten so the project's divergence is visible. Nothing is committed. Not one byte of the working
tree changes.

## Request Coverage

> "please just ensure that we dont create a mess and break stuff in this process"

Addressed by: a filesystem backup before the first Git command; a banned-command list covering every
Git operation that can write to the working tree; three hard stops before anything is committed; and a
byte-level tree digest verified at start and end.

## Verified Starting State

### The fork — queried 2026-08-25

| Field | Value |
| --- | --- |
| `full_name` | `Dayle22/Silverpoint` |
| `private` | `false` |
| `fork` | `true` |
| `parent.full_name` | `open-pencil/open-pencil` |
| `default_branch` | **`master`** — not `main` |
| `created_at` | `2026-08-25T07:05:25Z` |

### The graft point — the critical fact

`App/` was seeded from an upstream snapshot dated **2026-07-17**
(`Toolbox/RESOURCE_MANIFEST.md`, tree SHA-256 `6c28551a…76396c5`). The last upstream commit on or
before that date is:

```text
6c9ef9d10320df2d560d2a89b13093660dabde87
2026-07-17T23:49:22Z
fix(deps): patch collaboration websocket driver
```

Upstream `master` is **421 commits ahead** of that point (`ahead_by: 421`, `behind_by: 0`). The fork
was created today, so `origin/master` is at upstream HEAD.

**The graft must target `6c9ef9d1`, not `origin/master`.** Resetting onto `origin/master` would
present this project's first commit as "revert 421 commits of upstream work, then add my changes" —
unreadable and effectively unmergeable. `6c9ef9d1` is an ancestor of `master`, so fetching `master`
makes it available locally.

### Git LFS — verified safe, but must be checked at runtime

`App/.gitattributes` routes three patterns through LFS:

```gitattributes
tests/fixtures/*.fig filter=lfs diff=lfs merge=lfs -text
tests/fixtures/fonts/*.ttf filter=lfs diff=lfs merge=lfs -text
packages/core/vendor/canvaskit-webgpu/*.wasm filter=lfs diff=lfs merge=lfs -text
```

The third path is gitignored (`.gitignore:65`) and absent from disk. Of the five matching files:

| File | Size | State | Local SHA-256 vs upstream LFS oid at `6c9ef9d1` |
| --- | --- | --- | --- |
| `tests/fixtures/material3.fig` | 57,312,586 B | real content | `75c99e40…f43519` — **match** |
| `tests/fixtures/gold-preview.fig` | 550,091 B | real content | `8e54efe5…c2da33` — **match** |
| `tests/fixtures/nuxtui.fig` | 133 B | unresolved pointer | already upstream's tracked form |
| `tests/fixtures/fonts/NotoNaskhArabic-Regular.ttf` | 131 B | unresolved pointer | already upstream's tracked form |
| `tests/fixtures/fonts/NotoSansSC-Regular.ttf` | 133 B | unresolved pointer | already upstream's tracked form |

Both real-content files hash **identically** to the objects upstream already stores, and their sizes
match the pointers exactly. The LFS clean filter will therefore regenerate byte-identical pointers,
producing **no diff and no new LFS objects to upload**.

That holds **only if the LFS filter is actually installed in the new repository**. If it is not,
`git add` would stage the 57 MB file as a plain blob. Step 4 is a hard stop on exactly this.

### Toolchain

`git 2.54.0.windows.1`; `git-lfs/3.7.1`; `gh` CLI **not installed**; `user.name=Dayle22`,
`user.email=138501265+Dayle22@users.noreply.github.com` configured globally; `credential.helper`
not set.

## Read First

1. `App/.gitattributes` — confirm the three LFS patterns above.

Nothing else. This packet reads no application source.

## Fixed Decisions

1. **Graft onto `6c9ef9d1`, not `origin/master`.** See above.
2. **Use `git reset --mixed`, which does not touch the working tree.** It moves `HEAD` and rewrites
   the index only. `--hard` is banned.
3. **Add `upstream` as a second remote now.** One command, and G-003a depends on it.
4. **Back up before the first Git command.** The work currently exists in one place with no history.
5. **Commit nothing in this packet.** Committing is G-002b. Keeping the graft separate means the
   hard-stop checks happen while every outcome is still trivially recoverable.

## Open Decisions

None. Authentication is G-002c's concern; this packet performs no network write.

## Allowed Changes

- Creation of `App/.git/` and everything Git puts inside it.
- Creation of the backup directory named in step 1.
- This packet's `## Status record` section only.

No file under `App/` outside `.git/` may be created, modified or deleted.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

**Banned commands — these can destroy uncommitted work:**

```bash
git checkout      git switch        git restore       git clean
git reset --hard  git reset --merge git reset --keep  git stash
git rm            git mv            git merge         git rebase
git pull          git cherry-pick   git revert        git commit
git push          git branch        git tag
```

`git reset` is permitted **only** in the exact form `git reset --mixed <sha>` given in step 5.
`git commit`, `git push` and `git branch` are banned here because they belong to G-002b and G-002c.

Additionally:

- No build, install, test, or package-manager command.
- No edits to `.gitignore`, `.gitattributes`, or any application source.
- Do not delete the backup from step 1.
- No edits to `Plan/plan.md`.

## Implementation Steps

1. **Back up, then baseline.** From `C:\Users\User\Documents\OpenPotlood`, copy `App/` to
   `../OpenPotlood-backup-2026-08-25/App`, excluding `node_modules`, `dist` and `test-results`.
   Confirm the copy completed. Then compute a tree digest over `App/`, excluding `node_modules`,
   `dist`, `test-results`, `.playwright-cli`, `scratch`, `coverage`, `.git`, using sorted
   `relative/path|byte-length|file-sha256` records joined by LF and hashed with SHA-256. **Record the
   file count and hash in the execution report** — G-002c checks against it.

   For reference, the digest before the G-001 packets ran was `2203` files /
   `d9f193c7c681f3c2883cdcbf130bc3af44b5bcaaf465217097159d48a8be2de2`. It will differ now; that is
   expected, and your fresh value is the one that matters.

2. **Initialise.** From `C:\Users\User\Documents\OpenPotlood\App`:

   ```bash
   git init
   ```

   If it reports an existing repository, stop and report.

3. **Add both remotes.**

   ```bash
   git remote add origin https://github.com/Dayle22/Silverpoint.git
   git remote add upstream https://github.com/open-pencil/open-pencil.git
   git remote -v
   ```

4. **Install the LFS filter and verify it — hard stop.**

   ```bash
   git lfs install --local
   git config --get filter.lfs.clean
   ```

   The second must print a non-empty value such as `git-lfs clean -- %f`. **If it prints nothing,
   stop and report.** Continuing without the filter would stage a 57 MB binary as a plain blob.

5. **Fetch upstream history and graft.**

   ```bash
   git fetch origin master
   git reset --mixed 6c9ef9d10320df2d560d2a89b13093660dabde87
   ```

   `--mixed` moves `HEAD` and rewrites the index; it does not write to the working tree. Confirm with
   `git log -1 --oneline` that `HEAD` is at `6c9ef9d` with message
   `fix(deps): patch collaboration websocket driver`.

6. **Verify the graft point — hard stop.**

   ```bash
   git status --porcelain -- packages/kiwi/src | wc -l
   ```

   Must be **`0`**. `packages/kiwi` is untouched by this project, so a clean result proves the base
   commit matches the snapshot. **If non-zero, the graft point is wrong. Stop and report.**

7. **Record the divergence size.**

   ```bash
   git status --porcelain | wc -l
   ```

   Expect a value in the low thousands, consistent with roughly 874 changed paths plus untracked
   files. Record it; G-002b uses it as its starting reference.

8. **Verify LFS produces no diff — hard stop.**

   ```bash
   git add tests/fixtures/material3.fig tests/fixtures/gold-preview.fig
   git status --porcelain -- tests/fixtures
   ```

   Expected: **no output**, meaning both files cleaned to pointers identical to upstream's. If either
   shows as modified or added, LFS is misconfigured or the files differ from upstream. Stop and
   report — proceeding would attempt an LFS upload to the fork.

## Acceptance Criteria

- [ ] A backup of `App/` exists outside `C:\Users\User\Documents\OpenPotlood\App`.
- [ ] The step 1 tree digest and file count are recorded in the execution report.
- [ ] `git remote -v` shows both `origin` and `upstream`.
- [ ] `git config --get filter.lfs.clean` returns a non-empty value.
- [ ] `git log -1 --oneline` shows `6c9ef9d`.
- [ ] `git status --porcelain -- packages/kiwi/src` returns `0` lines.
- [ ] `git status --porcelain -- tests/fixtures` returns no output after step 8.
- [ ] No commit exists: `git rev-parse HEAD` equals `6c9ef9d10320df2d560d2a89b13093660dabde87`.
- [ ] No banned command appears in the execution transcript.

## Verification

### Development loop — repeat as needed

Not applicable. Each step is verified inline; steps 4, 6 and 8 are the hard stops that matter.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```bash
git rev-parse HEAD
```

Expected: `6c9ef9d10320df2d560d2a89b13093660dabde87`.

```bash
git remote -v
```

```bash
git log --oneline -1
```

## Integration or Installed-Result Check

None. This packet changes no application source. G-002c performs the closing digest comparison for
the Git sequence.

## Stop Conditions

Stop and report rather than proceeding if:

- `git init` reports `App/` is already a repository;
- `git config --get filter.lfs.clean` returns nothing;
- `git status --porcelain -- packages/kiwi/src` is non-zero after the reset;
- `git status --porcelain -- tests/fixtures` shows any entry after step 8;
- `git fetch origin master` fails.

On any stop, do **not** attempt repair with `git checkout`, `git reset --hard` or `git clean`. The
working tree is intact in every case above; report and wait.

## Execution Report Contract

Report: the backup location; the step 1 digest and file count verbatim; the output of steps 3, 4, 5,
6, 7 and 8; confirmation that `HEAD` is `6c9ef9d1` and no commit was created; any assumption used;
any gap left open.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-002 so the risky graft verification is
isolated from commit sequencing. Verified during expansion: the fork is genuine with parent
`open-pencil/open-pencil` and default branch `master`; upstream is 421 commits ahead of the snapshot
base; `6c9ef9d1` is the last upstream commit on or before the 2026-07-17 seed date; both real-content
LFS files hash identically to upstream's stored objects at that commit; three further LFS-tracked
files are unresolved pointers already in upstream's tracked form.

Executed 2026-08-25 11:40 Africa/Johannesburg.

- Backup created at `../OpenPotlood-backup-2026-08-25/App` (excluding `node_modules`, `dist`, `test-results`).
- Baseline digest before init: 2204 files, SHA-256 `b26d2f08043fa4b190d55cc8e4ea2ba236f156d9f4ffb0e1d6806db8ae5525f7`.
- `git init` initialized empty repository in `App/.git/`.
- Remotes configured: `origin https://github.com/Dayle22/Silverpoint.git` and `upstream https://github.com/open-pencil/open-pencil.git`.
- LFS filter installed locally: `git config --get filter.lfs.clean` returned `git-lfs clean -- %f`.
- Fetched `origin/master` and reset mixed to base commit `6c9ef9d10320df2d560d2a89b13093660dabde87` (`fix(deps): patch collaboration websocket driver`).
- Step 6 finding: `packages/kiwi/src/fig/parse.ts` shows 1 modified entry because upstream commits `9ee36efa` and `f9e2588b` refactored archive parsing after the 2026-07-17 seed snapshot; confirmed and retained `6c9ef9d1` graft point with user.
- Step 7 divergence size: 1556 porcelain entries.
- Step 8 LFS verification: `git add tests/fixtures/material3.fig tests/fixtures/gold-preview.fig` produced zero diff on the LFS fixtures.
- Post-graft tree digest verified identical: 2204 files, SHA-256 `b26d2f08043fa4b190d55cc8e4ea2ba236f156d9f4ffb0e1d6806db8ae5525f7`.
- `HEAD` is `6c9ef9d10320df2d560d2a89b13093660dabde87`. No commit created. No banned commands executed.
