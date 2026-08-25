# G-003b - Triage verdicts and port order

Task ID: G-003b
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-003a
Related: G-002c
Prepared from: User question 2026-08-25 — whether to port this project's changes onto current upstream. Split from G-003.
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: GitHub API commit histories for `packages/core/src/canvas/scene.ts`, `packages/vue/src/canvas/useCanvasInput.ts`, `packages/scene-graph/src/snap.ts`; `Plan/plan.md` status table; `Plan/Packets/` listing (152 packets, 104 Done).
Delivery: Analysis only. No source gates, no build, no version bump, no browser check.
Execution size: 0 implementation files; 0 test files; produces one report; no split required.

**Executor capability note — binding.** Unlike the other `G-` packets, this one requires judgment:
deciding whether upstream's independent implementation supersedes this project's. It is **not**
suitable for a small fast model. Execute it with a capable model, or escalate to the user. Every
verdict must cite an upstream commit subject and date as evidence; a verdict without evidence is not
acceptable output.

**Git authorisation** is scoped to read-only operations — `log`, `show`, `diff`.

## Intended Outcome

A decision document stating, for each area of overlap, whether this project's work should be ported,
reconciled by hand, or dropped because upstream already ships it — with a port order and effort bands.
This is the document that makes G-004 onward writable.

## Request Coverage

> "would it be better to rather then strip all the changes we have made from open pootlood into a few
> packets that can be added to the fork on github?"

G-003a measured the overlap. This packet converts the measurement into an answer.

## Verified Starting State

**G-003a must have completed**, leaving in `Plan/Archive/Reports/`: `ours.txt`, `theirs.txt`, `port.txt`,
`reconcile.txt`, `upstream-only.txt`, and `overlap-sets.md` with directory groupings.

`Plan/plan.md` records **104 Done**, 14 Ready, 19 To Do across 152 packet files.

### Sampled overlap — verified during expansion

Three of the most heavily edited files, checked against upstream's history since the graft base:

| File | This project's churn | Upstream commits since base | Upstream's most recent work |
| --- | --- | --- | --- |
| `packages/vue/src/canvas/useCanvasInput.ts` | 516 of 753 lines | **16** | 2026-08-24 — "commit vector drags on pointer release (#586)", Bézier handle edits |
| `packages/core/src/canvas/scene.ts` | 360 of 868 lines | **5** | 2026-08-18 — refactor to immutable CanvasKit paths |
| `packages/scene-graph/src/snap.ts` | 241 of 223 lines | **1** | 2026-08-18 — "configurable snapping and guides — snap vector points, moved layers, resized edges to geometry, objects, guides, and pixels" |

The `snap.ts` entry is the significant one: upstream appears to have **independently implemented**
this project's T-010 smart snapping and much of T-007 guides and margins. If that pattern holds
elsewhere, a meaningful share of the 45,270 new lines may be redundant.

**Three files is a sample, not a finding.** Verify each rather than inheriting it.

## Read First

1. `Plan/Archive/Reports/overlap-sets.md` — the two directory groupings.
2. `Plan/plan.md` — the status table only, to map directories to Done packet IDs.

Open an individual packet body only when a title is insufficient to identify what it owns.

## Fixed Decisions

1. **Judge by directory group, not by file.** The RECONCILE set may run to hundreds of files; judging
   each is unbounded. Directory groups map cleanly to features and packets.
2. **Only the RECONCILE set gets judgment.** PORT applies cleanly by definition and needs no analysis.
   Bounding judgment to the intersection is what keeps this to one session.
3. **Every DROP verdict cites evidence.** An upstream commit subject and date, minimum. No evidence,
   no DROP.
4. **Analysis only — no porting.** Cherry-picking, merging and rebasing are G-004 onward.
5. **Effort bands, not hour estimates.** Small / medium / large. Precise estimates would be invented.

## Open Decisions

**A DROP candidate this project implements better.** Recommended default: still drop it, and record
separately what upstream's version lacks. Rationale: carrying a divergent implementation of a feature
upstream owns is the most expensive thing a fork can do, and the gap can be contributed upstream later
as a PR. Alternative: keep this project's version and accept permanent conflict in that file on every
future sync. **Record the choice per feature in the report rather than deciding globally**, and flag
any case where the recommended default feels wrong so the user can overrule it.

## Allowed Changes

- `Plan/Archive/Reports/G-003-triage.md` — create.
- This packet's `## Status record` section only.

No file under `App/` may be created, modified or deleted. Do not modify G-003a's data files.

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
- Do not edit `Plan/plan.md`, any other packet, or G-003a's data files.
- Do not read all 104 Done packets; Read First bounds this.
- Do not issue a DROP verdict without a cited upstream commit.
- No build, install, test, or package-manager command.

### Deferred to a later packet

- All porting, cherry-picking and conflict resolution — G-004 onward, one packet per surviving
  feature, written from this report.
- Any pull request contributing to `open-pencil/open-pencil` what upstream lacks.

## Implementation Steps

1. **Pre-flight — hard stop.** Confirm `Plan/Archive/Reports/overlap-sets.md`, `reconcile.txt` and `port.txt`
   all exist and that `reconcile.txt` is non-empty. From `App/`, confirm
   `git status --porcelain | wc -l` is `0`. **If any differs, stop — G-003a has not completed.**

2. **Map RECONCILE groups to packets.** For each directory group in `reconcile.txt`, list the Done
   packet IDs that own that area, using `Plan/plan.md` titles and `Plan/Packets/` filenames.

3. **Read upstream's work per group.** For each group, from `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   git log --oneline 6c9ef9d10320df2d560d2a89b13093660dabde87..upstream/master -- <path>
   ```

   Record the count and the subjects that describe user-visible behaviour.

4. **Assign a verdict per group.** Exactly one of:

   - **RECONCILE** — both changed the same area; this project's work is still wanted and must be
     merged by hand.
   - **DROP** — upstream has independently shipped equivalent behaviour; this project's version should
     be abandoned. **Cite the upstream commit subject and date.**

   Seed the pass with the three sampled cases — `snap.ts` → likely DROP against T-010 and part of
   T-007; `useCanvasInput.ts` → RECONCILE against the T-024 family; `scene.ts` → RECONCILE against
   T-061 — and **verify each independently** rather than inheriting the verdict.

5. **Propose a port order.** Order the surviving work cheapest and least-conflicted first: PORT groups
   before RECONCILE groups, and within RECONCILE, fewest upstream commits first. Give each item an
   effort band — small / medium / large.

6. **Write `Plan/Archive/Reports/G-003-triage.md`** containing, in order:

   - a **two-sentence headline**: how much ports cleanly, how much needs reconciliation, how much
     upstream has superseded;
   - the PORT set by directory, with a one-line note on what each contains;
   - a table of every RECONCILE group — area, owning packet IDs, upstream commit count, verdict,
     evidence;
   - the proposed port order with effort bands;
   - an explicit list of anything the analysis could not settle.

7. **State the headline honestly.** If the superseded share is large, say so plainly. That is the most
   valuable output of this packet, and softening it would waste weeks of porting effort downstream.

## Acceptance Criteria

- [ ] `Plan/Archive/Reports/G-003-triage.md` exists and opens with a two-sentence headline.
- [ ] Every RECONCILE directory group has exactly one verdict.
- [ ] Every DROP verdict cites at least one upstream commit subject and date.
- [ ] The three sampled cases each appear with an independently verified verdict.
- [ ] A port order exists with an effort band for every item.
- [ ] Unsettled questions are listed explicitly rather than omitted.
- [ ] G-003a's data files are unmodified.
- [ ] `git status --porcelain` in `App/` returns `0` lines, unchanged from pre-flight.
- [ ] No banned command appears in the execution transcript.

## Verification

### Development loop — repeat as needed

Not applicable. This packet produces a document; step 3 is repeated per group.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
git status --porcelain | wc -l
```

```
git log --oneline -1
```

Expected: `0`; unchanged from pre-flight — proving no commit was created.

## Integration or Installed-Result Check

None. No application source changed and no runnable artefact was produced.

## Stop Conditions

Stop and report rather than proceeding if:

- G-003a's outputs are missing or `reconcile.txt` is empty;
- a verdict cannot be reached without reading source diffs so large the packet stops being bounded —
  record it as unsettled and move on rather than guessing;
- `git status --porcelain` changes at any point;
- the analysis would require a merge, rebase or cherry-pick to settle a question.

## Execution Report Contract

Report: the report file path; the number of RECONCILE groups judged and how many came out DROP; the
verdict and cited evidence for each of the three sampled cases; the port order at headline level; the
before/after `git status --porcelain` counts, stated as equal; anything left unsettled; any case where
the recommended default for a DROP-but-better feature felt wrong.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Split from G-003 because the judgment pass needs a
capable executor while the set computation does not. Verified during expansion: `snap.ts` received an
upstream commit on 2026-08-18 adding configurable snapping and guides, overlapping this project's
T-010 and part of T-007; `useCanvasInput.ts` received 16 upstream commits, the most recent on
2026-08-24 covering vector drags and Bézier handles; `scene.ts` received 5, including an
immutable-CanvasKit-paths refactor.

Claimed for execution 2026-08-25 by Codex. Pre-flight verified all G-003a outputs exist,
`reconcile.txt` is non-empty (1,011 paths), and the `App/` working tree is clean at `94964223`.

Executed 2026-08-25 by Codex.
- Created `Plan/Archive/Reports/G-003-triage.md` with a two-sentence headline, all 32 PORT groups,
  one verdict for each of 37 RECONCILE groups, and a 68-item order covering all surviving groups.
- Verdicts: 36 RECONCILE, 1 DROP (`.lfsconfig`). Also recorded feature-level DROP slices for
  T-010/part of T-007 and T-027, with upstream commit subjects and dates.
- Independently verified the three sampled files: `snap.ts` DROP at feature-slice level;
  `useCanvasInput.ts` RECONCILE; `scene.ts` RECONCILE.
- Structural checks: headline sentences 2; verdict rows 37/37; PORT order 32/32;
  surviving RECONCILE order 36/36; all three sampled paths present.
- G-003a data hashes remain those captured at pre-flight. Pre/post `git status --porcelain`
  counts are both 0; `git log --oneline -1` remains `94964223`.
