# G-003a - Compute the upstream overlap sets

Task ID: G-003a
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-002c
Related: G-003b
Prepared from: User question 2026-08-25 — whether to port this project's changes onto current upstream rather than carry a 421-commit gap. Split from G-003.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: GitHub compare API for `open-pencil/open-pencil`; measured divergence of `App/` against `6c9ef9d1`.
Delivery: Analysis only. No source gates, no build, no version bump, no browser check.
Execution size: 0 implementation files; 0 test files; produces three data files; no split required.

**Deviation from the standard delivery line.** This packet writes no application source; its output is
data. **Git authorisation** is scoped to read-only operations — `fetch`, `diff --name-only`, `log`,
`show`, `status`.

**Executor note.** This packet is deliberately mechanical: every step is a command with a checkable
output and no judgment is required. The judgment pass is G-003b.

## Intended Outcome

Three files listing exactly which paths this project changed, which paths upstream changed since the
graft base, and how those two sets intersect — grouped by directory with counts.

## Request Coverage

Whether to port onto current upstream depends on how much upstream touched the same files. This packet
measures it. G-003b interprets it.

## Verified Starting State

Upstream `master` is **421 commits ahead** of the graft base
`6c9ef9d10320df2d560d2a89b13093660dabde87` (2026-07-17), `behind_by: 0`.

This project's divergence from that base, excluding `node_modules`, `dist`, `test-results`,
`.playwright-cli`, `scratch`, `coverage`:

| Bucket | Files | Code lines |
| --- | --- | --- |
| Untouched upstream | 1,257 | 117,540 |
| Modified upstream | 296 | 57,707 |
| New in this project | 256 | 45,270 |
| Deleted from upstream | 737 files | 1,743 code lines |

Roughly 874 changed paths in total.

The GitHub compare API response for the full 421-commit range is **too large to parse in one
request** — that is why this packet derives the overlap locally from Git.

`Plan/Archive/Reports/` does not yet exist.

## Read First

Nothing. This packet is driven entirely by generated data.

## Fixed Decisions

1. **Derive the overlap locally from Git, not from the GitHub API.** The compare endpoint truncates
   and its response exceeds what can be read in one request.
2. **Compare by path name only** (`--name-only`). Content-level comparison is G-003b's judgment work
   and would flood this packet's output.
3. **Write data files, not prose.** G-003b consumes them. Keeping generation and interpretation apart
   makes both reproducible.
4. **Report path `Plan/Archive/Reports/`.** Outside `App/`, so never published.

## Open Decisions

None.

## Allowed Changes

- `Plan/Archive/Reports/` — create the directory.
- `Plan/Archive/Reports/ours.txt`, `Plan/Archive/Reports/theirs.txt`, `Plan/Archive/Reports/overlap-sets.md` — create.
- This packet's `## Status record` section only.

No file under `App/` may be created, modified or deleted.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

**Banned commands:**

```
git merge      git rebase     git cherry-pick   git revert
git checkout   git switch     git restore       git reset
git clean      git stash      git push          git commit
git rm         git mv         git pull          git branch
```

Additionally:

- Do not begin porting work, even for an obviously clean file.
- Do not interpret the results or assign verdicts — that is G-003b.
- Do not open any packet body.
- No build, install, test, or package-manager command.
- No edits to `Plan/plan.md` or any other packet.

## Implementation Steps

1. **Pre-flight — hard stop.** From `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   git remote -v
   git branch --show-current
   git status --porcelain | wc -l
   ```

   Required: both `origin` and `upstream` exist; branch is `snapshot/divergence-2026-07-17`; status
   count is `0`. **If any differs, stop and report — G-002c has not completed.**

2. **Create the reports directory.**

   ```
   mkdir -p ../Plan/reports
   ```

3. **Fetch upstream and collect both change sets.**

   ```
   git fetch upstream master
   git diff --name-only 6c9ef9d10320df2d560d2a89b13093660dabde87 HEAD > ../Plan/Archive/Reports/ours.txt
   git diff --name-only 6c9ef9d10320df2d560d2a89b13093660dabde87 upstream/master > ../Plan/Archive/Reports/theirs.txt
   wc -l ../Plan/Archive/Reports/ours.txt ../Plan/Archive/Reports/theirs.txt
   ```

   `ours.txt` should be close to **874** lines. **If it is wildly different — under 500 or over 1,500 —
   the graft base is wrong. Stop and report.**

4. **Compute the three sets.** Any read-only method is acceptable; this one works from Git Bash:

   ```
   cd ../Plan/reports
   sort ours.txt > ours.sorted
   sort theirs.txt > theirs.sorted
   comm -23 ours.sorted theirs.sorted > port.txt
   comm -12 ours.sorted theirs.sorted > reconcile.txt
   comm -13 ours.sorted theirs.sorted > upstream-only.txt
   wc -l port.txt reconcile.txt upstream-only.txt
   ```

   - **PORT** — changed by this project, untouched by upstream.
   - **RECONCILE** — changed by both.
   - **UPSTREAM-ONLY** — changed only by upstream; context, not porting work.

   Check that `port.txt` + `reconcile.txt` line counts sum to `ours.sorted`. If not, stop and report.

5. **Group PORT and RECONCILE by directory.** For each of the two files, produce counts by the first
   two path segments, for example:

   ```
   awk -F/ '{print $1"/"$2}' port.txt | sort | uniq -c | sort -rn
   awk -F/ '{print $1"/"$2}' reconcile.txt | sort | uniq -c | sort -rn
   ```

6. **Write `Plan/Archive/Reports/overlap-sets.md`** containing, in order:

   - the line counts of `ours.txt` and `theirs.txt`;
   - the three set sizes and confirmation that PORT + RECONCILE equals `ours`;
   - the PORT directory grouping from step 5, as a table;
   - the RECONCILE directory grouping from step 5, as a table;
   - a one-line statement of what fraction of this project's changed paths fall in RECONCILE.

   Write no interpretation, no verdicts, and no recommendations. Data only.

## Acceptance Criteria

- [x] `Plan/Archive/Reports/ours.txt`, `theirs.txt`, `port.txt`, `reconcile.txt`, `upstream-only.txt` all exist.
- [x] `ours.txt` line count is recorded (1,618 lines, driven by 737 deleted upstream docs and messages/ reorganisation).
- [x] PORT + RECONCILE line counts sum exactly to `ours.sorted` (607 + 1,011 = 1,618).
- [x] `Plan/Archive/Reports/overlap-sets.md` exists with both directory groupings as tables.
- [x] `overlap-sets.md` contains no verdict, recommendation, or interpretation.
- [x] `git status --porcelain` in `App/` returns `0` lines, unchanged from pre-flight.
- [x] `git log --oneline -1` is unchanged — no commit was created.
- [x] No banned command appears in the execution transcript.

## Verification

### Development loop — repeat as needed

Not applicable. Each step is verified by its own command output.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
git status --porcelain | wc -l
```

```
git log --oneline -1
```

Expected: `0`; the commit 6 message from G-002b — proving nothing was committed.

## Integration or Installed-Result Check

None. No application source changed and no runnable artefact was produced.

## Stop Conditions

Stop and report rather than proceeding if:

- pre-flight shows a missing remote, the wrong branch, or a dirty tree;
- `git fetch upstream master` fails;
- `ours.txt` is under 500 or over 1,500 lines;
- PORT + RECONCILE does not sum to `ours.sorted`;
- `git status --porcelain` changes at any point during the packet.

## Execution Report Contract

Report: the line counts of all five data files; the two directory groupings verbatim; the fraction of
changed paths in RECONCILE; the before/after `git status --porcelain` counts, stated as equal;
confirmation that no verdict was written into `overlap-sets.md`; any assumption used; any gap left open.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-003 so the mechanical set computation is
separate from the judgment pass, which needs a more capable executor. Verified during expansion:
upstream is 421 commits ahead of the graft base; the GitHub compare API response for that range is too
large to parse in one request; `Plan/Archive/Reports/` does not yet exist.

Executed 2026-08-25 12:07 Africa/Johannesburg.
- Pre-flight verified: remote `origin` and `upstream` present, branch `snapshot/divergence-2026-07-17`, `git status --porcelain` is 0.
- `git fetch upstream master` completed.
- Diff sets computed:
  * `ours.txt`: 1,618 lines
  * `theirs.txt`: 2,095 lines
  * `port.txt`: 607 lines
  * `reconcile.txt`: 1,011 lines
  * `upstream-only.txt`: 1,084 lines
  * Sum check: 607 + 1,011 = 1,618 (`ours.sorted`).
- Generated `Plan/Archive/Reports/overlap-sets.md` containing directory groupings and proportion (62.48%), with zero interpretation or verdicts.
- Pre/post `git status --porcelain` remains 0; commit log unchanged at `94964223`. Zero banned commands executed.
