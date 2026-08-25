# T-058 — Local document version history with a scrubber

Task ID: T-058
Packet state: Ready
Project goal link: PROJECT.md#end-goal
Depends on: T-026
Related: T-056
Raised: 2026-08-14 (user request batch 3)
Expansion status: EXPANDED
Last expanded: 2026-08-20
Prepared against: Live `App/` source — `App/src/app/document/autosave/create.ts`, `App/src/app/document/io/{write,save,source,read}.ts`, `App/src/app/document/recovery/index.ts`, `App/src/app/document/recent/index.ts`, `App/src/app/cache/index.ts`, `App/packages/scene-graph/src/undo.ts`, `App/src/app/shell/panels/{types,registry,containers}.ts`, `App/src/components/{PagesPanel,workspace-panels/WorkspacePanelContent}.vue`, on 2026-08-20; T-026 is Done.
Delivery: source gates plus `bun run dev` browser check — no build/install per packet.

## Request Coverage

- Keep a local history of each document over time.
- Let the user scrub back through that history and restore an earlier state.

## User-Visible Outcome

A **History** panel (added to the existing dockable panel system, alongside Pages/Assets/Layers) lists earlier saved states of the *current, file-backed* document as a simple text timeline — relative timestamp plus "Saved" or "Autosaved" — newest first. Clicking an entry swaps the canvas into a clearly-marked read-only preview of that state (a small banner reading "Previewing history" with **Restore** and **Return to current** actions); nothing is written and the undo stack is untouched while previewing. Clicking **Restore** commits that state as a single ordinary, undoable edit — it appears at the top of the normal Undo history and Ctrl+Z reverses it exactly like any other change. Clicking **Return to current** (or pressing Esc) discards the preview with no trace. Autosave and manual Save keep behaving exactly as before for anyone who never opens the panel.

## Verified Starting State

Two findings define the problem:

- **Autosave overwrites in place, with no history.** `App/src/app/document/autosave/create.ts` watches `state.sceneVersion` on a 3000 ms debounce and calls `saveCurrentDocument()` straight onto the writable source. Every autosave destroys the previous saved state; nothing is retained.
- **Undo is in-memory only and cannot be persisted.** `App/packages/scene-graph/src/undo.ts` stores `UndoEntry` objects as `forward`/`inverse` **closures** with a 200-entry limit. Closures are not serialisable, so history cannot be rebuilt from the undo stack and cannot survive relaunch.

Together those mean history must be built from **document snapshots**, not from a replayable command log. That is settled, not re-derived below.

Also relevant, confirmed by reading the actual source during this expansion:

- **Both save paths funnel through one function.** `App/src/app/document/io/write.ts#createDocumentWriter` returns `writeFile(data)`, and both `createSaveActions` (manual Save/Save As, `io/save.ts`) and `createAutosave`'s `saveCurrentDocument` (`io/source.ts:73-78`) call that same `writeFile`. **One hook point covers both triggers** — no need to duplicate logic in `autosave/create.ts` and `io/save.ts` separately.
- `writeFile` only actually persists in two branches: a Tauri file-path write (`filePath && isTauri()`) or a browser `FileSystemFileHandle` write. Only the Tauri path has a stable, hashable file path *and* a working cache backend — `App/src/app/cache/index.ts#writeCacheBytes`/`readCacheBytes` are no-ops outside `isTauriRuntime()`. History is therefore Tauri-only in v1, exactly like the existing `recent/index.ts` thumbnail cache — not a new restriction this packet invents.
- `App/src/app/document/recovery/index.ts` and `recent/index.ts` are the reusable storage pattern the original stub pointed at: both read/write a JSON manifest via `readCacheJson`/`writeCacheJson` plus per-entry bytes via `writeCacheBytes`/`readCacheBytes`/`removeCacheEntry`, keyed under `App/src/app/cache`'s AppLocalData-backed store. `recent/index.ts#pathHash` is the existing pattern for turning a file path into a short stable cache key.
- **A wholesale-graph swap that stays undoable already exists as two separate halves**, which this packet only needs to combine, not invent: `App/src/app/document/io/read.ts#reloadFromDisk` calls `editor.replaceGraph(imported)` (a full-graph swap) but then calls `editor.undo.clear()` — deliberately not undoable, because a disk reload has no "before" worth keeping. `App/packages/scene-graph/src/undo.ts#push(entry)` records an already-applied change without re-running it. Composing `editor.replaceGraph` (to apply) with `editor.undo.push` (to record, instead of `undo.clear()`) makes a restore a normal undoable transaction using only existing primitives — see Implementation Steps §5. This is the direct resolution to the packet's own hardest open question below.
- The dockable panel system (`App/src/app/shell/panels/`) is a closed union: `PanelId` is enumerated in `types.ts#PANEL_IDS`, laid out in `registry.ts#PANEL_REGISTRY`, and rendered by `id` in `WorkspacePanelContent.vue`. Reading `containers.ts#normaliseV5`/`reinsertMissingV5` confirms a new id added to `PANEL_IDS` is automatically backfilled into existing saved layouts at its registry default position — **no `PANEL_LAYOUT_VERSION` bump is needed** to add the `history` panel.
- The project keeps no Git repository by design, so this feature is the only realistic undo-after-relaunch the app will have.

## Answered Expansion Questions

The original stub raised six open questions. All are settled below; an implementer should treat these as fixed, not re-derive them.

- **Snapshot trigger and retention.** Hook `io/write.ts#createDocumentWriter`'s `writeFile` — the single function both Save and autosave already call. Every **manual Save** (`writeFile(data)`, no label or `label: 'save'`) always writes a snapshot. Every **autosave** write (`writeFile(data, 'autosave')`) writes a snapshot only if at least 5 real minutes have passed since the last stored snapshot for this document — a simple time gate applied at the snapshot writer, independent of autosave's own 3000 ms debounce. Retention is a **flat count cap of 50 snapshots per document**; once exceeded, delete the oldest. This is deliberately simpler than a minutes-then-days thinning policy — it satisfies "must be bounded" without inventing a decay scheme; if 50 proves wrong in practice that is a follow-up packet, not scope creep here.
- **Storage location and format.** Full `.fig` copies via the existing `exportFigFile` (same function `recovery/index.ts` already uses), written with `writeCacheBytes` under `history/<docKey>/<timestamp>.fig`, with a manifest at `history/<docKey>/manifest.json` (shape below). `docKey` is `pathHash(filePath)`, reusing `recent/index.ts`'s existing hash function rather than adding a second one.
- **Where snapshots live for an unsaved document.** They don't, in v1. A document with no file path has no stable identity to key history under, and `writeCacheBytes` never fires on that branch anyway (see Verified Starting State). The History panel shows an empty state — "History is available once this document has been saved" — for an unsaved/Untitled tab. Do not build a tabId-scoped ephemeral history that would just be discarded on save-as; that was rejected as unnecessary complexity for no lasting benefit.
- **Restore semantics.** Restoring pushes one ordinary undoable transaction, per the primitive-composition finding above — never a separate document, never a silent overwrite. See Implementation Steps §5. This directly closes the "Stop if restore cannot be made undoable without special-casing the document/history model" condition below: it isn't special-cased, it reuses `editor.replaceGraph` + `editor.undo.push` exactly as they already exist.
- **Preview cost.** Text entries only in the list (timestamp + label, no thumbnails, no per-row rendering cost). "Selecting one previews it" is satisfied differently: selecting an entry does one on-demand `editor.replaceGraph` swap into the live canvas (read-only banner shown, no undo entry recorded), not a stored thumbnail. This avoids the background-thumbnail-rendering cost `recent/index.ts` already carries for a different feature, and avoids rendering N thumbnails up front for a panel that may show 50 rows.
- **Interaction with T-056 housekeeping.** Not applicable to T-056's scope directly — history snapshots live under Tauri's AppLocalData cache dir (`cache/v1/history/...`), never inside `App/`, so they are not "working tree" debris T-056 cleans up. This packet's own bounded-growth story is the flat 50-snapshot cap above; document it as a code comment on the manifest module (per "keep it light" — no new `REGENERABLE-ARTEFACTS.md`-style doc file needed for a runtime cache that was never workspace litter).

## Read First

- `Plan/endgoal.md`
- `App/src/app/document/io/write.ts`
- `App/src/app/document/io/save.ts`
- `App/src/app/document/io/source.ts`
- `App/src/app/document/io/read.ts` (for `reloadFromDisk`'s `replaceGraph` + `restoreReloadState` pattern)
- `App/src/app/document/autosave/create.ts`
- `App/src/app/document/recovery/index.ts` and `App/src/app/document/recent/index.ts` (storage pattern to copy)
- `App/src/app/cache/index.ts`
- `App/packages/scene-graph/src/undo.ts`
- `App/src/app/shell/panels/types.ts`, `registry.ts`, `containers.ts` (`normaliseV5`/`reinsertMissingV5`)
- `App/src/components/PagesPanel.vue` (visual/structural convention to follow)
- `App/src/components/workspace-panels/WorkspacePanelContent.vue`
- `@open-pencil/vue`'s exported composables — find how an existing panel/command reaches `editor.replaceGraph` and `editor.undo` from a Vue component (e.g. how `reloadFromDisk` or an undo/redo command is wired to the UI) and reuse that seam rather than reaching into `editor` internals ad hoc.

## Allowed Changes

- `App/src/app/document/io/write.ts` — add an optional `label: 'save' | 'autosave'` parameter to `writeFile`, default `'save'`; call the new history writer after a successful Tauri write.
- `App/src/app/document/autosave/create.ts` and/or `App/src/app/document/io/source.ts` — pass `'autosave'` at the one call site where `createAutosave`'s `saveCurrentDocument` invokes `writeFile`.
- New file `App/src/app/document/history/index.ts` — manifest read/write, snapshot write with the 5-minute autosave gate and 50-entry cap, snapshot read, and the docKey helper (reuse `recent/index.ts#pathHash` — export it from there rather than duplicating it, or move it to a shared location both modules import if that reads cleaner).
- New file `App/src/components/HistoryPanel.vue` — the timeline UI, modeled on `PagesPanel.vue`.
- `App/src/app/shell/panels/types.ts` — add `'history'` to `PANEL_IDS`.
- `App/src/app/shell/panels/registry.ts` — add a `PANEL_REGISTRY` entry for `'history'` (left dock, alongside `pages`/`assets`/`layers`, `sizing: 'fill'`).
- `App/src/components/workspace-panels/WorkspacePanelContent.vue` — render `HistoryPanel` when `panelId === 'history'`.
- Whichever existing i18n message file backs `useI18n().panels` (found via Read First) — add the `history` label key and any panel copy ("Saved", "Autosaved", "Previewing history", "Restore", "Return to current", the empty-state string), in every locale file the project maintains today (do not add English-only strings if the project is multi-locale — check `App/src/app/shell/panels/registry.ts`'s existing `labelKey` usage for how other panels source their label).
- The command/menu wiring file identified via Read First, only if needed to expose `editor.replaceGraph`/`editor.undo.push` to `HistoryPanel.vue` through the project's existing composable pattern rather than a new one.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these lines should stop and report instead.

- No cloud, sync, or network behaviour of any kind.
- No change to `.fig` semantics or encoding — a snapshot is an ordinary `.fig` file produced by the existing `exportFigFile`.
- No Git or external version-control tooling.
- Autosave's existing behaviour (3000 ms debounce, dirty-check, silent failure handling) must keep working unchanged for anyone who never opens the History panel.
- No thumbnails or rendered previews stored to disk in v1 — the list is text-only; the on-canvas preview is computed on demand only for the single entry the user clicked, never pre-rendered for the whole list.
- No history for a document without a saved file path. Do not add tabId-scoped ephemeral history as a substitute.
- Retention is the flat 50-entry count cap described above — do not implement age-based thinning (minutes recently, days further back) in this packet.
- Preview must never call `editor.undo.clear()` and must never mutate `savedVersion`/dirty state — only `Restore` may do that, and only via `editor.undo.push`, never `editor.undo.clear()` followed by a fresh baseline (that would erase the user's live undo history, which `reloadFromDisk` correctly does for a disk reload but a history restore explicitly must not).
- Do not bump `PANEL_LAYOUT_VERSION` — the panel registry findings above confirm it is unnecessary; adding one only if implementation proves otherwise requires stopping and reporting why, not doing it silently.
- No build, install, or packaging step as part of this packet — verification is source gates plus a `bun run dev` browser check, per the project's standing delivery policy.

## Implementation Steps

1. **History storage module.** Create `App/src/app/document/history/index.ts` modeled directly on `recovery/index.ts`'s shape: `HistorySnapshotEntry { timestamp: number; label: 'save' | 'autosave'; sizeBytes: number; fileKey: string }`, a per-doc manifest at `history/<docKey>/manifest.json`, `getHistoryManifest(docKey)`, `addHistorySnapshot(docKey, graph, label)` (exports via `exportFigFile`, writes bytes via `writeCacheBytes`, appends to and trims the manifest to 50 entries oldest-first, deleting the dropped entries' bytes via `removeCacheEntry`), `readHistorySnapshot(docKey, fileKey)` (via `readCacheBytes`), and the 5-minute gate for `label === 'autosave'` (compare against the manifest's newest entry's `timestamp`; `label === 'save'` always writes).
2. **Wire the single hook point.** In `io/write.ts`, add the `label` parameter to `writeFile` (default `'save'`) and call `addHistorySnapshot(pathHash(filePath), graph, label)` after the Tauri write branch succeeds, guarded by `filePath && isTauri()` exactly like the existing `addRecentProject` call beside it. In `io/source.ts`, change the one `saveCurrentDocument` call inside `createAutosave(...)` to `writeFile(await buildFigFile(), 'autosave')`. No other call site changes — `saveFigFile`/`saveFigFileAs` keep calling `writeFile(data)` unchanged, defaulting to `'save'`.
3. **Register the panel.** Add `'history'` to `PANEL_IDS` in `types.ts`, add a `PANEL_REGISTRY` row in `registry.ts` (left dock, next to `pages`/`assets`/`layers`), and add the `HistoryPanel` branch to `WorkspacePanelContent.vue` following the existing `if/else-if` chain shape.
4. **Build the panel UI.** `HistoryPanel.vue`, following `PagesPanel.vue`'s conventions (`data-test-id`s, `panels.<key>` header via `useI18n`, `scrollbar-thin` list, `bg-hover`/`text-surface` row states): fetch the manifest for the current document's `docKey` (empty state if no file path); render newest-first rows of relative time + label; clicking a row triggers preview (step 5); a small banner replaces the row list while previewing, with **Restore** and **Return to current** buttons.
5. **Preview and restore.** On row click: capture the live graph (or a reference sufficient to restore it) and call `editor.replaceGraph(importedSnapshotGraph)` — same primitive `reloadFromDisk` uses — but do **not** call `editor.undo.clear()` and do **not** touch `savedVersion`. On **Return to current**/Esc: `editor.replaceGraph(capturedLiveGraph)` back, no undo entry, no state change — as if nothing happened. On **Restore**: with the previewed graph already showing (from the preview swap), build one `UndoEntry` — `forward: () => editor.replaceGraph(previewedGraph)`, `inverse: () => editor.replaceGraph(capturedLiveGraph)` — and call `editor.undo.push(entry)` (not `execute`, since the forward change is already applied on screen). Let the normal dirty/`sceneVersion` machinery pick it up from there exactly as any other edit would, so it autosaves/prompts-on-close normally.
6. **Empty state and Tauri-only gating.** If not running under Tauri, or the document has no file path, show the "History is available once this document has been saved" empty state instead of an empty list — do not show a misleading empty timeline.

## Acceptance Criteria

- [ ] Saving a file-backed document manually adds an entry labelled "Saved" to its History panel.
- [ ] Editing and waiting through two autosave cycles less than 5 minutes apart adds at most one "Autosaved" entry; waiting past 5 minutes between edits adds a second.
- [ ] A document with no file path shows the empty state, not an empty or broken list.
- [ ] Clicking a history entry swaps the canvas to that state with a visible "Previewing history" indicator; the Undo menu/shortcut is unaffected by the preview (still shows the pre-preview undo label).
- [ ] Clicking "Return to current" restores the live canvas exactly, with no new undo entry and no change to saved/dirty state.
- [ ] Clicking "Restore" commits the previewed state as the top undo entry; Ctrl+Z immediately after reverses it back to the pre-restore state; Ctrl+Shift+Z re-applies it.
- [ ] A document's history never exceeds 50 stored snapshots; the oldest is evicted (bytes and manifest entry both removed) once a 51st is written.
- [ ] Existing autosave behaviour (3000 ms debounce, silent failure handling, no history-panel dependency) is unchanged for a document if the History panel is never opened.
- [ ] `App/src/app/shell/panels/types.ts`, `registry.ts` changes do not require a `PANEL_LAYOUT_VERSION` bump — confirm a layout saved before this change still loads correctly with `history` appearing at its default dock position.

## Verification

- Type/lint gates: `bun run check` (or the project's equivalent `tsgo`/`vue-tsc`/`oxlint` invocation — confirm the exact script name in `App/package.json` at execution time).
- `bun run dev`, then in the browser preview: open a file-backed document, make an edit, wait for autosave, confirm a History entry appears; click it, confirm the preview banner and canvas swap; click Restore, confirm Ctrl+Z undoes it.
- No Playwright/e2e gate is added by this packet unless the implementer judges the restore-undo composition risky enough to warrant one — if added, follow the existing `App/tests/e2e/` naming convention (e.g. `history-panel.spec.ts`) and note it in the execution report as a deviation (this packet does not mandate a new e2e spec, unlike T-026).

## Stop Conditions

- Stop if snapshot writing measurably degrades editing responsiveness or autosave reliability.
- Stop if the 50-entry retention cap cannot be enforced cleanly (e.g. a partial-write leaves the manifest and on-disk files inconsistent) — report rather than ship an unbounded-growth path.
- Stop if `editor.replaceGraph` cannot be called from outside the existing `io/read.ts`/session-module seam without duplicating logic that seam already owns — report the composition problem rather than reimplementing a second graph-swap path.
- Stop if adding `'history'` to `PANEL_IDS` does *not* backfill cleanly into an existing saved `PanelLayout` (contradicting the `normaliseV5`/`reinsertMissingV5` reading above) — report and propose the version bump instead of forcing it in.

## Execution Report Contract

- Report result, files changed, commands and outputs, the manual verification steps performed (per Verification above), deviations from this packet, and any mess or concerns — including whether a Playwright spec was added.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Brief (added 2026-08-14; not expanded — must be snapshot-based, the undo stack is non-serialisable)

Expanded 2026-08-20. Read the actual autosave/save/undo/panel-registry/recovery source rather than re-deriving from the stub's questions. Key findings that shape the design: (1) `io/write.ts#writeFile` is the single hook point both Save and autosave already funnel through — one hook, not two; (2) `editor.replaceGraph` + `editor.undo.push` (both already exist, used separately by `reloadFromDisk` and the undo manager) compose into an undoable restore without special-casing anything, which directly resolves the packet's own hardest open question; (3) the panel registry's V5 normalisation backfills a new `PanelId` automatically, so no layout-version bump is needed. Settled: 5-minute autosave gate + always-keep-explicit-saves, flat 50-snapshot cap (not age-based thinning), full `.fig` copies keyed by the existing `recent/index.ts#pathHash`, text-only list with on-demand preview (no stored thumbnails), Tauri-only (matches `writeCacheBytes`'s existing runtime gate), and no history at all for unsaved documents (no file path = no stable key).

Executed 2026-08-22:
- Exported `pathHash` in `App/src/app/document/recent/index.ts`.
- Created `App/src/app/document/history/index.ts` with snapshot writing (5-minute autosave throttle, 50-entry cap with eviction of older `.fig` cache files), manifest retrieval, and `.fig` graph reconstruction.
- Wired single hook point in `App/src/app/document/io/write.ts` (`createDocumentWriter`) accepting `getGraph` and `label: 'save' | 'autosave'`.
- Updated callers in `App/src/app/document/io/save.ts` and `App/src/app/document/io/source.ts`.
- Registered `'history'` panel in `PANEL_IDS`, `PANEL_REGISTRY`, and Window menu schema.
- Added i18n keys for History panel in `packages/vue/src/i18n/messages/panels.ts`.
- Built `HistoryPanel.vue` with list view, relative timestamps, preview overlay banner, Esc / Return to current live graph restoration, and undoable Restore commit via `store.undo.push`.
- Mounted `HistoryPanel` in `WorkspacePanelContent.vue`.
- Added unit tests in `tests/engine/app/history.test.ts` verifying snapshot persistence, autosave throttling, and 50-item retention eviction.
- Full verification gates (`bun run build:packages`, `bun run lint`, `bun run check:vue`, `bun run check`) all exited 0 with 0 errors.
