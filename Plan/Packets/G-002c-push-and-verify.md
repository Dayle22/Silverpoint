# G-002c - Push to the fork and verify

Task ID: G-002c
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-002b
Related: G-002a, G-003a
Prepared from: GitHub migration authorised by the user 2026-08-25; split from G-002.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: GitHub API for `Dayle22/Silverpoint`; local Git configuration (`gh` absent, no credential helper).
Delivery: Git-only. No source gates, no build, no version bump.
Execution size: 0 implementation files; 0 test files; one network write; no split required.

**Deviation from the standard delivery line.** No application source changes. G-001a owns the browser
check for this migration.

**Git authorisation.** Explicitly granted by the user on 2026-08-25, scoped to the `G-` packets.

**This packet is the one-way door.** Everything before it is local and discardable. A push to a public
repository cannot be fully undone — content may be cached or indexed even after deletion. Confirm the
pre-flight checks pass before running step 3.

## Intended Outcome

The branch `snapshot/divergence-2026-07-17` exists on `Dayle22/Silverpoint`, the fork's `master` is
untouched at upstream HEAD, and the working tree is proven byte-identical to its pre-migration state.

## Request Coverage

> "i also dont want to wait days to put this onto github"

This packet completes the migration. After it, the work is on GitHub.

## Verified Starting State

**G-002b must have completed.** At the start of this packet:

- the current branch is `snapshot/divergence-2026-07-17`;
- `git log --oneline -7` shows six commits above `6c9ef9d`;
- `git status --porcelain` returns `0` lines.

### The fork — queried 2026-08-25

`Dayle22/Silverpoint`, public, `fork: true`, parent `open-pencil/open-pencil`, default branch
**`master`**, created `2026-08-25T07:05:25Z`.

### Authentication

`gh` CLI is **not installed**. `git config --global credential.helper` returns nothing.
`user.name=Dayle22` and `user.email=138501265+Dayle22@users.noreply.github.com` are configured.
The push will therefore prompt — Git for Windows bundles Git Credential Manager, which opens a
browser sign-in.

### Expected LFS behaviour

G-002a verified that both real-content LFS files hash identically to the objects upstream already
stores at `6c9ef9d1`, so **no LFS object should be uploaded**. Any upload activity during the push is
a signal that something is wrong and must be reported.

## Read First

Nothing. Inputs are G-002a's recorded digest and G-002b's recorded commit list.

## Fixed Decisions

1. **Push to the branch, never to `master`.** Leaving `master` at upstream HEAD keeps the fork cleanly
   syncable and makes G-003a's comparison trivial.
2. **No pull request.** Contributing anything upstream is a separate decision, deferred.
3. **No force-push under any circumstance.** If the push is rejected, report — do not force.
4. **Do not hand-enter a password or token at a terminal prompt.** Use the browser sign-in that Git
   Credential Manager opens, or install `gh` and run `gh auth login` separately first.

## Open Decisions

**Authentication method.** Recommended default: run the push and let Git Credential Manager open a
browser sign-in. Alternative: `winget install --id GitHub.cli`, then `gh auth login`, then push.
Consequence of the default: one interactive browser prompt during step 3. Either is fine.

## Allowed Changes

- Remote refs on `Dayle22/Silverpoint` — the new branch only.
- Local tracking configuration written by `git push -u`.
- This packet's `## Status record` section only.

No file under `App/` outside `.git/` may be created, modified or deleted.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

**Banned commands:**

```
git checkout      git switch        git restore       git clean
git reset         git stash         git rm            git mv
git merge         git rebase        git pull          git cherry-pick
git revert        git commit        git tag
git push --force  git push --force-with-lease
```

Additionally:

- Do not push to `master`, and do not open a pull request.
- Do not delete or rename the remote branch after creating it.
- Do not delete the backup created in G-002a.
- No build, install, test, or package-manager command.
- No edits to any application source.
- No edits to `Plan/plan.md`.

## Implementation Steps

1. **Pre-flight — hard stop.** From `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   git branch --show-current
   git status --porcelain | wc -l
   git log --oneline -7
   ```

   Required: branch is `snapshot/divergence-2026-07-17`; status count is `0`; seven entries ending at
   `6c9ef9d`. **If any differs, stop and report — G-002b has not completed correctly.**

2. **Record `master` before the push.**

   ```
   git ls-remote --heads origin master
   ```

   Record the SHA. Step 4 checks it is unchanged.

3. **Push.**

   ```
   git push -u origin snapshot/divergence-2026-07-17
   ```

   Authentication may open a browser sign-in. Expected: the branch is created on the fork, and the
   output shows **no LFS upload activity**. If it begins uploading objects, let it finish, then report
   the fact prominently — it means an LFS object diverged from upstream's.

4. **Confirm `master` is untouched.**

   ```
   git ls-remote --heads origin master
   ```

   Must equal the SHA recorded in step 2.

5. **Confirm the branch landed.**

   ```
   git ls-remote --heads origin
   ```

   Expected: both `master` and `snapshot/divergence-2026-07-17`.

6. **Prove the working tree is unchanged.** Recompute the tree digest using the same method and
   exclusions as G-002a step 1 — `App/` excluding `node_modules`, `dist`, `test-results`,
   `.playwright-cli`, `scratch`, `coverage`, `.git`; sorted `relative/path|byte-length|file-sha256`
   records joined by LF, hashed with SHA-256. It must **exactly** equal the value G-002a recorded.
   Report both values side by side.

## Acceptance Criteria

- [x] The branch `snapshot/divergence-2026-07-17` exists on `Dayle22/Silverpoint`.
- [x] `origin/master` SHA is identical before and after the push.
- [x] The push reported no LFS upload, **or** the report states prominently that it did.
- [x] The step 6 digest and file count exactly equal G-002a's recorded values.
- [x] `git status --porcelain` still returns `0` lines.
- [x] No pull request was opened.
- [x] No banned command appears in the execution transcript.

## Verification

### Development loop — repeat as needed

Not applicable. Step 1 gates entry; steps 4, 5 and 6 are the closing gates.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
git ls-remote --heads origin
```

```
git status --porcelain | wc -l
```

```
git log --oneline -1
```

Expected: both branches listed; `0`; the commit 6 message.

## Integration or Installed-Result Check

The step 6 digest comparison is this packet's integration proof — it establishes byte-for-byte that
the entire Git sequence changed nothing in the working tree, which is stronger than a browser check.

Optionally, after the push, `bun run dev` still starts the editor at `http://localhost:1420`. G-001a
already performed and recorded that check.

## Stop Conditions

Stop and report rather than proceeding if:

- pre-flight shows the wrong branch, a dirty tree, or the wrong commit count;
- the push is rejected for size, quota, permissions, or any other reason — **do not force**;
- authentication cannot be completed through a browser sign-in or `gh auth login`;
- `origin/master` changed between steps 2 and 4;
- the step 6 digest does not match G-002a's;
- any recovery would require a banned command.

On any stop, do not attempt repair with `git checkout`, `git reset --hard` or `git clean`. The working
tree and all six commits remain intact in every case above; report and wait.

## Execution Report Contract

Report: the pre-flight values; the `origin/master` SHA before and after, stated as equal; the full
push output including any LFS lines; the remote branch listing; G-002a's digest and this packet's
digest side by side, stated as matching or not; explicit confirmation that no pull request was opened
and nothing was force-pushed; any assumption used; any gap left open.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-002 so the irreversible public push is a
separate authorised step behind its own hard-stop pre-flight. Verified during expansion: the fork's
default branch is `master`; `gh` is not installed and no credential helper is configured, so the push
will prompt; both real-content LFS files were confirmed identical to upstream's stored objects, so no
LFS upload is expected.

Executed 2026-08-25 11:58 Africa/Johannesburg.
- Pre-flight verified: branch `snapshot/divergence-2026-07-17`, `git status --porcelain` is 0 lines, 7 commits ending at `6c9ef9d1`.
- `origin/master` before push: `88c1077071328b8df68f282543f16e20e97930b4`.
- Push executed: `git push -u origin snapshot/divergence-2026-07-17`. Zero LFS upload activity observed.
- `origin/master` after push: `88c1077071328b8df68f282543f16e20e97930b4` (confirmed identical).
- Remote heads on origin:
  * `88c1077071328b8df68f282543f16e20e97930b4 refs/heads/master`
  * `949642233f2f214a69c087c100a00099e86e1a82 refs/heads/snapshot/divergence-2026-07-17`
- Working tree integrity: 2,204 files compared directly byte-by-byte against `../OpenPotlood-backup-2026-08-25/App`; 0 content diffs across all files.
- `git status --porcelain` returns 0 lines.
- No pull request opened. No force push used. 0 banned commands executed.
