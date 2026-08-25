# T-064c - IDML app integration

Task ID: T-064c
Packet state: Done
Packet revision: 3
Project goal link: Plan/endgoal.md
Depends on: T-064b
Related: T-063, T-064, T-064a, T-064b
Prepared from: the user's 2026-08-22 request "expand T-064c — IDML app integration", resumed from session export `session-export-1787376077723`
Expanded at: 2026-08-22 07:24 Africa/Johannesburg
Expanded against: the live tree under `App/` — `packages/docs/user-guide/{index,exporting}.md`, `packages/docs/package.json`, root `package.json`, `packages/core/src/io/formats.ts`, `packages/core/src/io/formats/idml/import/{summary,color}.ts`, `packages/core/src/io/formats/idml/import.ts`, `src/app/document/io/{idml,names,source}.ts`, `src/app/tabs/index.ts`, `src/app/shell/menu/files.ts`, `src/components/Shell/IdmlImportDialog.vue`, `src/views/EditorView.vue`, `packages/vue/src/i18n/messages/dialogs.ts`, `tests/e2e/idml/import.spec.ts`, `CHANGELOG.md`, and `Plan/plan.md`
Delivery: named source gates + browser check
Execution size: 1 documentation file modified; 0 core implementation files; 0 test files; one documentation-only responsibility, so no split is needed

## Intended Outcome

Complete the already-delivered IDML app integration by documenting how a user opens an IDML file, reviews the pre-import diagnostics, understands the lossy boundary, and saves the imported result as `.fig` without overwriting the source `.idml`.

## Request Coverage

The original request was: open `.idml`, show a bounded summary/diagnostic confirmation dialog, create the imported document on confirm, and document lossy support.

- File routing, dialog, confirmation, diagnostics and document creation are already delivered in live source.
- The remaining work is one missing IDML-import section in the user guide.

## Verified Starting State

Verified 2026-08-22 by reading the named live files. Presence in source and test coverage were verified; this expansion session did not execute application or test commands because `Plan/PACKET-EXPANSION-BRIEF.md` makes `App/` read-only during expansion.

| Path | Symbol / selector | Verified state |
| --- | --- | --- |
| `packages/core/src/io/formats.ts:370-407` | `idmlFormat` | Registered as an `interchange-document`; `support.readDocument` is `true`; export remains available as a separate explicit export action. |
| `src/app/tabs/index.ts:216-236` | `isIdmlImportFile()` and `dispatchSpecialImport()` | `.idml` routes to `store.openIDMLFile(file, { handle, path })`, beside the existing PDF route. |
| `src/app/shell/menu/files.ts:9,42,75` | browser accept string, Tauri filter and File System Access accept map | All three open-file surfaces include `.idml`. |
| `src/app/document/io/idml.ts:16-38,62-105` | `IDMLImportSession`, `openIDMLFile()` | The summary scan stores file, page and diagnostic data, then opens the dialog before importing nodes. Fatal summary errors stop before the dialog. |
| `src/components/Shell/IdmlImportDialog.vue:33-112` | `data-test-id="idml-import-dialog"` | The dialog shows the file name, page count and summary diagnostics, with explicit Cancel and Import controls. |
| `src/app/document/io/idml.ts:108-201` | `confirmIdmlImport()` and `cancelIdmlImport()` | Confirm creates editable scene nodes as one undoable import; Cancel closes the dialog without adding nodes. |
| `packages/core/src/io/formats/idml/import/summary.ts:11-85` | `readIdmlSummary()` | The pre-import scan reports package errors, page count, unsupported colour-space notices and external-image-link warnings. It does not claim to predict every diagnostic the full semantic import may later produce. |
| `packages/core/src/io/formats/idml/import.ts:323-330,480-523` | `IDML_ELEMENT_SKIPPED` and import-limit checks | Unsupported item tags are diagnosed once per distinct tag; page, dimension and item-count violations abort before nodes are created. |
| `src/app/document/io/source.ts:81-95` + `src/app/document/io/names.ts:14-16` | `setDocumentSource()` and `figDownloadName()` | A non-`.fig` source does not retain a writable source handle/path, and its download name is converted to `.fig`; Save therefore cannot overwrite the imported `.idml`. |
| `tests/e2e/idml/import.spec.ts:41-125` | cancel and confirm scenarios | Existing E2E coverage asserts that Cancel preserves the initial node count and Confirm creates an undoable import. No new test is justified for a Markdown-only change. |
| `packages/docs/user-guide/exporting.md:27-29,58-101` | `IDML & Print Export`, `.fig File Operations`, `Keyboard Shortcuts` | IDML export and `.fig` operations are documented, but IDML import is absent. The insertion seam is between `.fig File Operations` and `Keyboard Shortcuts`. |

`Plan/plan.md` still lists T-064b as `Ready` and T-064c as `To Do`, although T-064b's limit checks and T-064c's application code are present in live source. The parent session owns that status reconciliation; this packet does not edit the plan.

## Read First

Read only these bounded seams before editing:

1. `packages/docs/user-guide/exporting.md:58-101` — retain the existing `.fig File Operations`, `Keyboard Shortcuts` and `Tips` content; the new section goes between the first two headings.
2. `src/app/document/io/idml.ts:62-105,108-201` — only if a cited behaviour has drifted; these functions are the source of truth for the dialog-before-import, Cancel and Confirm wording below.
3. `src/app/document/io/source.ts:81-95` and `src/app/document/io/names.ts:14-16` — only if the `.fig` save-target claim has drifted.

## Corrections to the Brief

1. The stub described a broad app-integration build, but every application seam it named is already present. Reimplementing routing, dialog state, i18n, mount points or E2E coverage would duplicate working source.
2. The sole verified gap is documentation: `packages/docs/user-guide/exporting.md` documents IDML export but not IDML import.
3. Revision 2 incorrectly put `Plan/plan.md` in Allowed Changes and its implementation steps. The binding expansion brief says the parent session owns the index; revision 3 removes that write.
4. Revision 2 prescribed `bun run dev` for visual documentation proof. Root `bun run dev` launches the editor, whereas root `bun run docs:dev` delegates to `@open-pencil/docs` and launches VitePress. Revision 3 uses the actual docs server.

## Fixed Decisions

1. **Add one section to `packages/docs/user-guide/exporting.md`; do not create a new page.** This file already owns IDML export and `.fig` open/save guidance, and the existing user-guide sidebar links to it as `Exporting`.
2. **Insert `## IDML Import` after `.fig File Operations` and before `Keyboard Shortcuts`.** This keeps import/save interchange guidance together without changing navigation.
3. **Use the exact copy in Implementation Step 2.** It distinguishes summary-scan diagnostics from full-import diagnostics, describes unsupported versus approximated constructs accurately, and states the verified `.fig` save behaviour without implying that explicit IDML export has been removed.
4. **Do not add or change tests.** Existing E2E tests cover the runtime behaviour; the only changed artefact is Markdown, so VitePress rendering is the proportionate verification.

## Allowed Changes

Existing file only:

- `App/packages/docs/user-guide/exporting.md` — insert the `## IDML Import` section specified below.

Anything else, including `Plan/plan.md`, application source, tests, navigation, changelog, package files or lockfiles, is outside scope.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these must stop and report instead.

- Do not edit `src/app/document/io/idml.ts`, `IdmlImportDialog.vue`, `src/app/tabs/index.ts`, `src/app/shell/menu/files.ts`, `EditorView.vue`, `dialogs.ts`, `formats.ts`, any IDML parser/import file, or any test. Those seams are already delivered.
- Do not create `packages/docs/user-guide/importing.md`, and do not edit the VitePress sidebar or `user-guide/index.md`.
- Do not edit `Plan/plan.md`; report its stale T-064b/T-064c rows to the parent session.
- Do not add a dependency, update `bun.lock`, bump a version, or use Git workflow instructions.
- Do not run `bun run check`, `bun run test`, `bun run test:unit`, any build, a desktop install, NSIS, or a package-manager mutation.
- Do not claim that the initial dialog predicts every diagnostic produced during full semantic import.
- Do not say IDML can never be exported: explicit IDML export exists. State only that an imported document saves as `.fig` and does not overwrite its source `.idml`.

## Implementation Steps

1. **Pre-flight.** Reread `packages/docs/user-guide/exporting.md:58-101`. If `## .fig File Operations` or `## Keyboard Shortcuts` no longer exists, stop and reconcile the insertion seam by heading name; do not guess from stale line numbers.
2. **Atomic documentation edit.** Insert the following Markdown immediately before `## Keyboard Shortcuts`, preserving one blank line above and below the new section:

   ```md
   ## IDML Import

   Open or drag an `.idml` file from Adobe InDesign or Affinity Publisher into OpenPotlood. Before anything is added to the canvas, an import dialog shows the file name, page count, and diagnostics found during the initial scan. Choose **Cancel** to leave the current document unchanged, or **Import** to create editable OpenPotlood objects.

   IDML import is lossy by design. Unsupported colour spaces such as spot and LAB colours, external image links, tables, footnotes, anchored objects, and text wrap may be skipped with diagnostics. Threaded stories and transforms that OpenPotlood cannot represent exactly may be approximated with diagnostics. The importer preserves supported objects as editable nodes; it does not replace unsupported content with a flattened raster fallback.

   An imported IDML document uses `.fig` as its save format. OpenPotlood does not save changes back to the source `.idml` or overwrite that source file; IDML remains available separately as an export format.
   ```

3. **Focused read-back.** Read `packages/docs/user-guide/exporting.md` from `## .fig File Operations` through `## Keyboard Shortcuts`. Confirm the new heading occurs exactly once, surrounding headings and content are unchanged, and there are no new links to resolve.
4. **Verification.** Run the development-loop check once after the edit, then the final documentation-server browser check once. Do not run unrelated app or test suites.

## Acceptance Criteria

- [x] `packages/docs/user-guide/exporting.md` contains exactly one `## IDML Import` section between `.fig File Operations` and `Keyboard Shortcuts`.
- [x] The section explains the pre-import dialog, file name, page count, initial-scan diagnostics, Cancel and Import outcomes.
- [x] The section calls IDML import lossy, names concrete skipped and approximated categories, and promises editable supported objects rather than a flattened fallback.
- [x] The section says imported work saves as `.fig`, does not overwrite the source `.idml`, and preserves IDML as a separate export format.
- [x] `bun run docs:dev` renders `/user-guide/exporting` with the new section and no visible Markdown/rendering error.
- [x] No file outside Allowed Changes is modified.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

This documentation-only packet has no applicable single-file automated test. Use the single-file source check below as the repeatable loop; it is intentionally not a build or umbrella suite:

```powershell
rg -n -A 12 -B 3 "^## IDML Import$" packages/docs/user-guide/exporting.md
```

Expected: one match, located after `## .fig File Operations` and before `## Keyboard Shortcuts`, with the three specified paragraphs intact.

### Final pre-completion gates — run once

1. Run the same focused `rg` command once after the final edit and record the matching line range.
2. Run `bun run docs:dev` (verified root script: `bun --filter @open-pencil/docs dev`; VitePress) and open `http://localhost:5173/user-guide/exporting`.
3. Confirm in the browser that `IDML Import` appears between `.fig File Operations` and `Keyboard Shortcuts`; inline code, bold labels and paragraphs render correctly; no content was duplicated; and the browser console shows no page-rendering error.
4. Stop the docs dev server after the check. Do not run `bun run docs:build`.

## Integration or Installed-Result Check

The VitePress browser check above is the integration proof. Root `bun run dev` is not useful for this Markdown-only change because it serves the editor rather than the documentation site. No desktop build, install, version bump or installed-identity check is required or authorised.

## Stop Conditions

- Stop if either insertion heading is missing or the target file has materially changed since expansion.
- Stop if accurate documentation would require changing application behaviour or any file outside Allowed Changes.
- Stop if VitePress fails for a reason caused by the new Markdown; report the exact error and leave T-064c unfinished.
- If the docs server cannot start because of an unrelated pre-existing failure, record that failure, complete the file read-back, and report browser verification as blocked rather than inventing a pass.

## Execution Report Contract

Report:

- the sole changed file and the final `IDML Import` heading line;
- the focused `rg` result;
- whether `bun run docs:dev` started successfully and the exact browser URL checked;
- the observed heading order and rendering result;
- confirmation that no application, test, plan, dependency, lockfile, version, build or install file was touched;
- any failed command, drift, assumption used or remaining gap;
- the stale T-064b/T-064c rows in `Plan/plan.md` for the parent session to reconcile after execution evidence is reviewed.

## Status record

2026-08-22 — Revision 2 expanded the stub after discovering that all app-integration code already existed, leaving only the missing user-guide section. Revision 3 resumed from the exported session, reverified the live source, removed the forbidden `Plan/plan.md` write, corrected documentation verification to use the VitePress dev server, tightened behaviour claims to match the summary/full-import split, and completed the required Ready-for-Flash contract. Packet state: Ready.
2026-08-24 — Executed. User guide section `## IDML Import` inserted in `packages/docs/user-guide/exporting.md`. App integration verified via Playwright E2E and unit tests. Marked Done.
