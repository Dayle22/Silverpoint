# G-006 - Compact the plan index

Task ID: G-006
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-002c
Related: G-003a, G-003b
Prepared from: User request 2026-08-25 — "plan md is getting hectic and there are alot of packets".
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: `Plan/plan.md` (195 lines, structure mapped line by line); `Plan/Packets/` (161 files, 3.6 MB); cross-reference scan of all packets; `Toolbox/Project-History/archives/`.
Delivery: Documentation only. No source gates, no build, no version bump, no browser check.
Execution size: 3 files touched (1 archived, 1 created, 1 rewritten); 0 implementation files; 0 test files; no split required.

**Deviation from the standard delivery line.** This packet touches no application source and runs no
Git command. Its proof is structural: exact row counts before and after, and a check that no
cross-reference broke.

## Intended Outcome

`Plan/plan.md` becomes a live working index of about 42 rows instead of 145, with completed history
preserved in full and every packet file left exactly where it is.

## Request Coverage

> "plan md is getting hectic and there are alot of packets"

Both halves were investigated. The **packet count is not the problem** — see Fixed Decision 1. The
index is.

## Verified Starting State

`Plan/plan.md` is **195 lines**. Its structure, mapped exactly:

| Lines | Content | Disposition |
| --- | --- | --- |
| 1–13 | Title, intro, status-vocabulary table, per-step detail note | keep |
| 15 | Delivery policy (2026-08-14, extended 2026-08-18) | keep — binding |
| 17 | Delivery 0.6.31 record | **move** to `plan-done.md` |
| 19 | Delivery 0.6.32 record | **move** to `plan-done.md` |
| 21 | GitHub migration note (2026-08-25) | keep — binding |
| 23 | `G-` packet run order | keep — binding |
| 25–26 | Step-table header and separator | keep |
| 27–171 | 145 step rows | **split** — see below |
| 173–187 | `## Notes`, 15 entries | keep, untouched |
| 189–195 | `## Dropped`, 3 entries | keep, untouched |

The 145 step rows break down as:

| Status | Rows | Disposition |
| --- | --- | --- |
| Done | **103** | move to `plan-done.md` |
| Ready | **22** | keep |
| To Do | **18** | keep |
| **Blocked** | **2** — T-032a, T-073 | keep |

### Defect — the status vocabulary is wrong

Line 5 states: *"Status vocabulary — these three values are the only ones allowed in the Status
column."* Two rows use a fourth value, `Blocked`, and the Notes at lines 176–177 document both as
deliberately Blocked with reasons. The rows are correct; the vocabulary statement is stale.

### Why packet files must not move

A cross-reference scan found **101 `Plan/Packets/<file>.md` path references across 41 packet files**.
`Plan/PACKET-EXPANSION-BRIEF.md` additionally names two exemplars by path at lines 18–19
(`T-061-canvaskit-memory-and-stability.md`, `T-035-contextual-selection-actions.md`), both of which
are Done and would move under any archive-by-status scheme.

### Archive precedent

`Toolbox/Project-History/archives/` already holds `PLAN_2026-07-28_VERSION-77_PRE_COMPRESSION.md`,
`PROJECT_LOG_2026-07-28_THROUGH_RECEIPT-116.md` and `APP_AGENTS_2026-07-28_PRE_COMPRESSION.md`. This
packet follows the same naming pattern.

## Read First

1. `Plan/plan.md` — lines 1–26 and 173–195, the parts that are kept or edited. The 145 table rows are
   moved mechanically and do not need reading.

Nothing else.

## Fixed Decisions

1. **Do not move, archive, or delete any packet file.** 161 files at 3.6 MB cost nothing: nothing
   enumerates the directory, and agents open one packet by path. Moving them would break 101
   references across 41 packets plus the brief's two exemplars, for no benefit.
2. **Move Done rows to `Plan/plan-done.md`, not into the Toolbox archive.** They stay live,
   searchable and one click away; the archive copy is a point-in-time snapshot, not the working record.
3. **Move the two Delivery version records with them.** `Delivery 0.6.31` and `0.6.32` are completed
   receipts sitting at the top of the file read most often. The *Delivery policy* at line 15 is
   binding and stays.
4. **Add `Blocked` to the status vocabulary rather than re-labelling the two rows.** The rows and the
   Notes agree; only the vocabulary statement is stale.
5. **Leave `## Notes` and `## Dropped` untouched.** Several notes carry live constraints (T-073's
   three binding findings, T-095-after-T-087, T-032a's Revision 4 warning). Pruning them needs
   judgment per note and is a separate responsibility.
6. **Archive before editing.** Matches the 2026-07-28 precedent and makes the change reversible.

## Open Decisions

None.

## Allowed Changes

- `Toolbox/Project-History/archives/PLAN_2026-08-25_PRE_G-CLEANUP.md` — create, as a byte copy.
- `Plan/plan-done.md` — create.
- `Plan/plan.md` — rewrite per the steps below.
- `Plan/Packets/G-003b-triage-verdicts-and-port-order.md` — `Read First` item 2 only.
- This packet's `## Status record` section only.

No file under `App/` may be created, modified or deleted. No packet file may be moved, renamed or
deleted.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **No Git commands of any kind.** This packet is unrelated to the migration chain.
- Do not move, rename, archive or delete any file in `Plan/Packets/`.
- Do not edit `Plan/PACKET-EXPANSION-BRIEF.md` or `Plan/endgoal.md`.
- Do not edit any packet other than G-003b's single `Read First` line and this packet's Status record.
- Do not alter the text of any row while moving it — copy rows verbatim, including trailing status.
- Do not edit, prune or reorder `## Notes` or `## Dropped`.
- Do not change the Delivery policy paragraph at line 15, the GitHub migration note at line 21, or the
  run-order paragraph at line 23.
- Do not re-sort the step table; preserve existing row order within each destination.
- No build, install, test, or package-manager command.

### Deferred to a later packet

- Pruning `## Notes` of entries that describe completed or superseded work.
- Re-examining the 22 Ready packets; G-003b may show some are moot because upstream shipped the
  feature.

## Implementation Steps

1. **Pre-flight.** Confirm `Plan/plan.md` is 195 lines and that the step table at lines 27–171 holds
   145 rows: 103 Done, 22 Ready, 18 To Do, 2 Blocked. **If any count differs, stop and report** — the
   file has drifted and the line map above no longer applies.

   ```
   wc -l Plan/plan.md
   sed -n '27,171p' Plan/plan.md | grep -c "^| "
   sed -n '27,171p' Plan/plan.md | grep -c '| Done |$'
   ```

2. **Archive.** Copy `Plan/plan.md` byte-for-byte to
   `Toolbox/Project-History/archives/PLAN_2026-08-25_PRE_G-CLEANUP.md`. Verify with `cmp` that the two
   are identical before editing anything.

3. **Create `Plan/plan-done.md`** containing, in order:

   - a title `# Plan — completed work`;
   - one line: `Completed steps, moved out of `Plan/plan.md` on 2026-08-25 to keep the live index
     readable. Status here is historical. The live index is `Plan/plan.md`; packet files were not
     moved and remain in `Plan/Packets/`.`;
   - a `## Delivery records` section holding the `Delivery 0.6.31` and `Delivery 0.6.32` paragraphs,
     copied verbatim from lines 17 and 19;
   - a `## Completed steps` section holding the step-table header, its separator, and all **103 Done
     rows** copied verbatim in their existing order.

4. **Rewrite `Plan/plan.md`:**

   a. Delete the `Delivery 0.6.31` and `Delivery 0.6.32` paragraphs (lines 17 and 19) and their blank
      lines.
   b. Delete all 103 Done rows from the step table, leaving the 22 Ready, 18 To Do and 2 Blocked rows
      in their existing relative order.
   c. Add `Blocked` to the status-vocabulary table as a fourth row:
      `| Blocked | Expanded but not executable; a named blocker must clear first. | A packet whose
      Notes entry records the blocker. Do not execute. |`
      and change the sentence at line 5 from "these three values" to "these four values".
   d. Immediately after the step table, add:
      `Completed steps and past delivery records live in `Plan/plan-done.md`. Packet files for
      completed work were not moved and remain in `Plan/Packets/`.`

5. **Update G-003b's `Read First`.** In
   `Plan/Packets/G-003b-triage-verdicts-and-port-order.md`, change `Read First` item 2 from
   `Plan/plan.md — the status table only, to map directories to Done packet IDs` to
   `Plan/plan-done.md — the completed-steps table, to map directories to Done packet IDs`.
   Change nothing else in that packet.

6. **Verify no row was lost.** The Done row count in `plan-done.md` plus the step-row count in
   `plan.md` must equal **145**.

## Acceptance Criteria

- [ ] `Toolbox/Project-History/archives/PLAN_2026-08-25_PRE_G-CLEANUP.md` exists and `cmp` reported it
      identical to the pre-edit `plan.md`.
- [ ] `Plan/plan-done.md` contains exactly **103** rows ending `| Done |`.
- [ ] `Plan/plan-done.md` contains both the 0.6.31 and 0.6.32 delivery paragraphs.
- [ ] `Plan/plan.md` step table contains exactly **42** rows: 22 Ready, 18 To Do, 2 Blocked, 0 Done.
- [ ] 103 + 42 = 145, matching the pre-flight count.
- [ ] `Plan/plan.md` status vocabulary lists four values and its sentence says "four".
- [ ] `Plan/plan.md` still contains the Delivery policy, the GitHub migration note, the `G-` run order,
      `## Notes` with 15 entries, and `## Dropped` with 3 entries, all byte-identical to before.
- [ ] `Plan/plan.md` carries the pointer line to `plan-done.md`.
- [ ] G-003b's `Read First` item 2 names `plan-done.md`.
- [ ] `Plan/Packets/` still holds **161** files; none moved, renamed or deleted.
- [ ] Every `Plan/Packets/<file>.md` path referenced anywhere still resolves.

## Verification

### Development loop — repeat as needed

Not applicable — a mechanical file split. Each step is verified by its own count.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood`:

```
grep -c '| Done |$' Plan/plan-done.md
```

Expected: `103`.

```
grep -c '| Done |$' Plan/plan.md
```

Expected: `0`.

```
ls Plan/Packets/*.md | wc -l
```

Expected: `161`.

```
grep -rhoE "Plan.[Pp]ackets.[A-Za-z0-9-]+\.md" Plan/Packets/*.md Plan/PACKET-EXPANSION-BRIEF.md | sort -u | sed 's#\\#/#g' | while read p; do [ -f "$p" ] || echo "BROKEN $p"; done
```

Expected: **no output.** Any `BROKEN` line means a reference no longer resolves — stop and report.

```
wc -l Plan/plan.md
```

Expected: roughly 92 lines, down from 195.

## Integration or Installed-Result Check

None. No application source changed and no runnable artefact was produced.

## Stop Conditions

Stop and report rather than proceeding if:

- pre-flight counts do not match 195 lines / 145 rows / 103 Done;
- `cmp` shows the archive copy differs from the original;
- the moved and retained row counts do not sum to 145;
- the reference check prints any `BROKEN` line;
- `Plan/Packets/` no longer holds 161 files;
- any change would be required outside the paths in Allowed Changes.

## Execution Report Contract

Report: the pre-flight counts; the archive path and `cmp` result; the row counts in both files and
their sum; the final `plan.md` line count; the output of the broken-reference check, stated as empty;
confirmation that `## Notes` and `## Dropped` are byte-identical to before; confirmation that
`Plan/Packets/` still holds 161 files; any assumption used; any gap left open.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Verified during expansion: `plan.md` is 195 lines with
145 step rows — 103 Done, 22 Ready, 18 To Do and 2 Blocked; the status-vocabulary sentence claims only
three values are allowed while `Blocked` is in documented use; 101 `Plan/Packets/` path references
exist across 41 packet files, plus two exemplar paths in `PACKET-EXPANSION-BRIEF.md` lines 18–19, which
is why no packet file may move; `Toolbox/Project-History/archives/` already holds a 2026-07-28
pre-compression `plan.md`, establishing both the precedent and the naming pattern.
