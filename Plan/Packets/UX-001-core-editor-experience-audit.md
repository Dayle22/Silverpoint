# UX-001 - Core editor experience audit and improvements

Task ID: UX-001
Packet state: Done
Depends on: None
Priority: Before T-016 and the remaining feature backlog

## Outcome

Improve the current OpenPotlood editor experience before adding more major capabilities. The work must be grounded in the installed desktop application and the live `App/` workspace.

## Planning Boundary

This is a simple holding packet for a later planning session. The user will choose the review focus areas separately. Do not invent a redesign direction, prioritise specific screens, or modify application code from this packet alone.

## Intended Review

When expanded, inspect the existing editor's core workflows, including as relevant:

- launching and creating a document;
- canvas navigation, zoom, pan, and selection;
- creating and editing objects;
- text and font workflows;
- layers, properties, tabs, and preferences;
- undo/redo, saving, reopening, and recovery;
- import/export feedback and error states;
- visual consistency, clarity, spacing, contrast, and accessibility.

## Expansion Requirements

1. Capture the agreed desktop workflows using current installed-app evidence.
2. Record strengths, friction points, visual inconsistencies, accessibility risks, and evidence limits.
3. Rank findings by user impact and implementation cost.
4. Separate safe quick wins from changes needing product-direction decisions.
5. Convert the agreed improvements into small implementation packets or bounded repairs.

## Exclusions

- No feature implementation before the focus areas are agreed.
- No broad visual redesign based on assumptions.
- No replacement of completed feature packets or reopening of completed work without evidence.
- No browser-only claim that the installed desktop experience is improved.

## Acceptance Criteria

- A later session has a focused, evidence-backed list of UI/UX improvements.
- Each accepted improvement has a clear scope, rationale, and verification route.
- The feature backlog remains intact and T-016 does not start until this review is resolved or deliberately deferred.

## Verification

Planning verification is a read-back of the brief, plan row, and packet. Implementation verification must use the installed desktop app and the smallest focused checks appropriate to each repair.

## Open Decision

The user will choose the first UI/UX focus areas in a later session.

## Review Findings

**Evidence basis for this round.** This expansion was done entirely from source-code reading via the remote device bridge (no computer-use / desktop launch access was available in this session). Every finding below cites the exact file it came from. None of these are confirmed against the running desktop app — treat every item as "source-derived only" unless marked otherwise, and re-verify with a manual desktop pass (per `App/AGENTS.md`'s rule that a source check alone does not prove desktop behaviour) before scoping implementation packets.

The user selected four focus areas for this round: (1) Core workflows, (2) Text, layers & properties, (3) Reliability & feedback, (4) Visual polish & accessibility.

---

### 1. Core workflows (document creation, canvas nav/zoom/pan/selection, object creation/editing)

**Strength — undo/redo is a clean, well-isolated implementation.**
`App/packages/scene-graph/src/undo.ts` implements `UndoManager` with batching (`beginBatch`/`commitBatch`/`rollbackBatch`), a 200-entry history limit, and rollback-on-exception semantics for `runBatch`. This is a solid, self-contained primitive with no obvious correctness gaps from reading it. Source-derived only; batching correctness under real multi-step operations (e.g. drag + resize) still needs a live pass.

**Friction — the interactive canvas is not keyboard-focusable and carries no accessible name.**
`App/src/components/EditorCanvas.vue` (lines 116–122) renders the interactive overlay canvas as `<canvas ref="canvasRef" tabindex="-1" ... />` with no `aria-label`/`role`. `tabindex="-1"` removes it from the natural Tab order entirely — a keyboard-only or screen-reader user has no way to Tab focus onto the design surface itself (shortcuts still work because they're bound globally on `window` via `tinykeys`, per `App/src/app/shell/keyboard/registry.ts`, but there is no focus indicator or accessible entry point to "the canvas"). This is a real accessibility risk for the core object-creation/editing workflow, not just polish. Needs live confirmation of whether screen readers can reach the canvas region at all via other means (e.g. landmark navigation).

**Friction — tab-limit and multi-document warnings are plain-English toasts/dialogs with no i18n, despite full i18n coverage existing elsewhere in the same file.**
`App/src/app/tabs/index.ts`: `state.actionToast = 'Maximum of 20 concurrent tabs reached'` (lines 92, 106, 214) and the Tauri `ask()` dialog text `` `Save changes to "${name}" before closing?` `` / `'Unsaved Changes'` (lines 143–148) are raw string literals, not routed through the project's `useI18n()`/`dialogMessages` system that the rest of the app uses (confirmed against `App/packages/vue/src/i18n/messages/dialogs.ts`, which has no matching keys). Functionally correct, but these are core-workflow-critical messages (data loss warnings) that silently fail to localize.

---

### 2. Text, layers & properties (text/font workflows, layers panel, properties panel, tabs, preferences)

**Correction to a prior finding — `PreferencesDialog.vue` no longer matches the "known issue" described in project memory.**
Reading the current `App/src/components/Shell/PreferencesDialog.vue` (13,271 bytes, last modified 2025 — after the memory note) directly:
- It contains **zero** `data-test-id` attributes (the alleged 17 are gone).
- It uses the `tv()` theme system throughout via `App/src/theme/preferences-dialog.ts`, not raw inline Tailwind (two small exceptions below).
- Every visible label routes through `useI18n()` / `dialogs.value.preferencesX` (confirmed all ~35 `preferencesX` keys exist in `App/packages/vue/src/i18n/messages/dialogs.ts` and are translated into all 8 locale folders under `App/packages/vue/src/i18n/locales/`).
- It uses `AppSelect.vue` and `AppCheckbox.vue`, both of which wrap Reka UI primitives (`SelectRoot`/`SelectTrigger`/… and `CheckboxRoot`/`CheckboxIndicator` respectively — confirmed by reading both components).

This strongly suggests T-030's Preferences dialog was already reworked since the memory note was written. **Do not carry the old finding forward as-is.** Two minor residual items remain in `PreferencesDialog.vue`: two spots use a raw Tailwind class `class="text-surface"` (lines 273, 277) instead of a themed slot, and the numeric/colour inputs are native `<input type="number">` / `<input type="color">` rather than the app's own `NumberField.vue` component or a themed colour swatch — acceptable in the near term since there's no Reka UI equivalent for a native colour picker, but worth reusing `NumberField.vue` for consistency with the rest of the properties panels. Needs live-app confirmation that this refactor is actually shipped (not just staged in source).

**Correction to a prior finding — `data-test-id` is not "reserved for the canvas/editor host only" anywhere in current source.**
A repo-wide search found `data-test-id` used across 50 files and 210 occurrences (`AssetsPanel.vue`, `CodePanel.vue`, `PagesPanel.vue`, `TabBar.vue`, `LayersPanel.vue`, `PropertiesPanel.vue`, `ZoomDropdown.vue`, etc.) — it is the app's general-purpose testing attribute, not scoped to canvas/editor chrome. `App/AGENTS.md` (the house-conventions file this packet was told to check) does not mention `data-test-id` at all. This convention claim could not be verified against current source and should be treated as stale/unconfirmed rather than a finding to act on.

**Friction — inconsistent i18n coverage inside a single, otherwise well-localized panel.**
`App/src/components/properties/TypographySection.vue`: most labels correctly use `panels.value.X` (font family, weight, alignment, formatting toolbar with proper `role="toolbar"` + `aria-label`). But the "Text resizing" field label (line 141) and its four option labels — `'Auto Width'`, `'Auto Height'`, `'Fixed Size'`, `'Truncate'` (lines 30–33) — are hardcoded English literals with no i18n key at all. This is a concrete, isolated gap in an otherwise well-built section.

**Friction — several toolbar tool names cannot localize; one has a redundant fallback.**
`App/src/components/Toolbar/Toolbar.vue` (lines 28–44): `PENCIL: 'Pencil'`, `BRUSH: 'Brush'`, `SHAPE_BUILDER: 'Shape Builder'` are hardcoded and have no corresponding keys in `App/packages/vue/src/i18n/messages/tools.ts` (confirmed — that file only defines `move, frame, section, slice, rectangle, ellipse, line, polygon, star, pen, text, hand`). Additionally `SLICE: toolTexts.value.slice ?? 'Slice'` carries a `?? 'Slice'` fallback that is now dead code since `slice` *is* defined in `tools.ts` — a small sign of drift from an earlier state of the file. Net effect: three tool names in the primary toolbar will not translate in any of the 8 supported locales.

**Strength — properties sections (`EffectsSection.vue`, `StrokeSection.vue`, `FillSection.vue`) are consistently built.**
All three read cleanly: consistent use of `PanelSection`/`PropertyItemRow`/`PropertyListRoot`, proper `aria-expanded`/`aria-label` on expand/collapse controls (`EffectsSection.vue` lines 69–74), i18n via `panels`/`dialogs`, and Reka UI-backed primitives throughout. `StrokeSection.vue` has one very minor untranslated string — `batch-label="Change stroke color"` (line 110) — but this is an internal undo-batch label rather than user-facing chrome, so it's low priority. This is a genuine strength worth preserving as the template for future properties sections (including any new sibling of `EffectsSection.vue`).

**Layers panel and layer tree look solid.**
`App/src/components/LayersPanel.vue`, `App/src/components/LayerTree/LayerTree.vue`, and `LayerTreeNodeRow.vue` use Reka UI's `TreeItem`/`TreeVirtualizer`/`ContextMenuRoot` correctly, route selection/rename through typed helpers, and use i18n (`panels.mask`, etc.) and `Tip` tooltips consistently. No notable friction found in this slice of code; a live pass on drag-reorder behaviour and virtualization performance with large trees would be the natural next check.

---

### 3. Reliability & feedback (undo/redo, saving, reopening, recovery, import/export errors)

**Strength — autosave is debounced and defensive.**
`App/src/app/document/autosave/create.ts` watches `state.sceneVersion` with a 3-second debounce, skips when nothing changed, skips when autosave is disabled or there's no writable source, and wraps the actual save in try/catch with a console warning on failure (no crash, no silent state corruption). This looks like a reasonable, low-risk implementation as built.

**Friction — session recovery is fully silent and offers the user no choice.**
`App/src/app/document/recovery/index.ts`'s `restoreRecoverySession()` iterates every recovered tab and reopens it automatically with no prompt; `App/src/views/EditorView.vue` (`onMounted`, lines 160–171) calls it unconditionally on launch and only shows one generic hardcoded toast — `'Restored unsaved session'` — with no indication of which document(s) were restored or an option to discard the recovered state instead. If a user's autosave captured a bad/unwanted state, there's no visible way to say "no, open my last saved version instead." This is a reliability/feedback gap worth a product decision (see Ranked Improvements).

**Friction — the highest-stakes dialog in the app (unsaved-changes-on-quit) is entirely un-localized, unlike its sibling dialogs.**
`App/src/views/EditorView.vue`, lines 216–247: the close-confirmation dialog triggered by `window-close-requested` has hardcoded English throughout — `"Unsaved changes"`, `"Some documents have unsaved changes. What would you like to do before closing?"`, and buttons literally labelled `"No"` and `"Yes"` (lines 238, 246) — while `closeWithDecision('discard')` is bound to "No" and `closeWithDecision('save')` is bound to "Yes". This is both (a) a complete i18n gap in the single most consequential confirmation in the app, sitting right next to `PreferencesDialog.vue` and `TabBar.vue` which are properly localized, and (b) a clarity/UX issue independent of i18n: "Yes"/"No" answering an implicit question ("save first?") is more ambiguous and error-prone than explicit "Save"/"Don't Save" buttons (the OS-native convention this app is presumably trying to match on Windows). Both are worth fixing together.

**Friction — import/open failures surface raw exception text to the user.**
`App/src/app/document/io/read.ts`, `openFigFile()` (lines 44–61): on failure it calls `toast.error(\`Failed to open file: ${e instanceof Error ? e.message : String(e)}\`)`, i.e. it passes whatever low-level parser exception message was thrown straight into the toast shown to the end user, un-localized and not translated into user-facing language. Reasonable as a stopgap (better than silently failing), but likely to show cryptic technical messages for corrupt/unsupported files.

**Minor — a legacy native-`prompt()` fallback exists in the save-as path.**
`App/src/app/document/io/save.ts`, `saveFigFileAs()` (lines 84–88): when neither Tauri nor `window.showSaveFilePicker` is available, it falls back to a browser `prompt('Save as:', ...)`. In a Windows desktop (Tauri) context this path is very unlikely to ever execute, but it is dead-simple, unstyled, un-i18n'd UI that would look badly out of place if it were ever hit (e.g. a future web build). Low priority given the app's primary target is the desktop shell.

---

### 4. Visual polish & accessibility (visual consistency, spacing, contrast, accessibility issues)

**Strength — the theme/token system is genuinely consistent across 4 themes.**
`App/src/app.css` defines a full `--color-*` token set (panel, border, accent, muted, warning, success, code-syntax colours, ruler colours) once under `@theme`, then overrides per `html[data-theme='light'|'grey'|'dark'|'midnight']`. All four theme blocks define the same token names — no missing tokens in any theme, which is exactly the kind of drift that's easy to introduce ad hoc and wasn't found here. This is a solid foundation for consistency and is not something to relitigate without new evidence.

**Accessibility risk — no way to reach the canvas via keyboard, no accessible name (see Core workflows above).** Restated here because it's the single biggest concrete accessibility finding from this pass, spanning both areas.

**Accessibility gap — the live zoom-percentage input has no accessible name.**
`App/src/components/editor/ZoomDropdown.vue`, lines 107–116: the `<input>` shown when editing the zoom percentage has a `data-test-id` but no `aria-label`, unlike the sibling `AppSelect`/`NumberField` components elsewhere in the codebase which consistently compute an `accessibleLabel` (see `NumberField.vue` lines 64–67 for the pattern already established and reusable here). Small, isolated, easy fix.

**No notable findings on spacing/contrast beyond the above.** The properties-panel components read (`EffectsSection.vue`, `StrokeSection.vue`, `TypographySection.vue`) consistently use the shared `--spacing-panel*` tokens from `app.css` rather than ad hoc pixel values, and warning/success colours are defined per-theme with what look like reasonable contrast pairings (e.g. dark theme `--color-warning-text: #fde68a` on `--color-panel: #2a2a2a`). A genuine contrast audit needs rendered-pixel measurement in the live app, not source reading — flagging this limit explicitly rather than fabricating a contrast-ratio verdict from token hex values alone.

---

## Ranked Improvements

Ranking is impact (user-facing severity) × cost (implementation size) × risk, based only on the source evidence above. "Quick win" = small, low-risk, unambiguous fix that doesn't require a product decision. Everything else needs the user to decide direction before it's scoped into an implementation packet.

| # | Finding | Focus area | Impact | Cost | Risk | Category |
|---|---|---|---|---|---|---|
| 1 | Close-confirmation dialog ("Unsaved changes") is fully hardcoded English with ambiguous Yes/No buttons | Reliability & feedback | High | Small | Low | **Quick win** |
| 2 | Canvas (`EditorCanvas.vue`) has `tabindex="-1"` and no `aria-label` — no keyboard/AT entry point to the design surface | Core workflows / Accessibility | High | Med–Large | Med | **Needs product decision** (what a11y conformance level is the target for a canvas-based editor?) |
| 3 | Silent, unconfirmed session recovery on launch — no per-document indication or opt-out | Reliability & feedback | Med–High | Med | Med | **Needs product decision** (should recovery ask first, and how granular?) |
| 4 | Toolbar tool names (Pencil, Brush, Shape Builder) have no i18n keys at all; dead `?? 'Slice'` fallback | Text/layers/properties | Med | Small | Low | **Quick win** |
| 5 | `TypographySection.vue` "Text resizing" label + 4 option labels hardcoded, breaking i18n consistency within one panel | Text/layers/properties | Med | Small | Low | **Quick win** |
| 6 | Tab-limit toast and Tauri close-tab save prompt in `app/tabs/index.ts` hardcoded, not localized | Reliability & feedback | Med | Small | Low | **Quick win** |
| 7 | Import/open failures surface raw parser exception text via toast | Reliability & feedback | Med | Small–Med | Low | **Needs product decision** (define a friendly error-message taxonomy vs. current pass-through) |
| 8 | `ZoomDropdown.vue` zoom-percentage input missing `aria-label` | Visual polish & accessibility | Low | Small | Low | **Quick win** |
| 9 | `PreferencesDialog.vue` residual raw `text-surface` classes; native number/colour inputs instead of reusing `NumberField.vue` | Text/layers/properties | Low | Small | Low | **Quick win** |
| 10 | Native `prompt()` fallback in browser save-as path (`save.ts`) — likely unreachable in the shipped desktop build | Reliability & feedback | Low | Small | Low | **Needs product decision** (confirm whether the browser build is still a supported target at all before spending effort here) |

**Corrected/withdrawn from prior memory:** the previously logged finding that `PreferencesDialog.vue` has 17 `data-test-id` attributes, raw Tailwind instead of `tv()`, no i18n, and native (non-Reka) select/checkbox controls **does not match current source** — it appears to have already been fixed. Do not carry it into a new implementation packet without re-checking the live app first. Likewise, the claim that `data-test-id` is reserved for canvas/editor-host elements only is not supported by `AGENTS.md` or by actual usage (210 occurrences across 50 files) — treat this as an unconfirmed/stale convention rather than a defect to fix.

**Areas that turned up nothing notable in this pass:** the layers panel/tree (`LayersPanel.vue`, `LayerTree.vue`, `LayerTreeNodeRow.vue`) and the `EffectsSection.vue`/`StrokeSection.vue`/`FillSection.vue` properties sections read as consistently well-built, with proper Reka UI usage, aria attributes, and i18n coverage — no action items surfaced there beyond the one minor untranslated undo-batch label already noted. Saying so plainly rather than inventing padding findings for those files.

## Implementation Log (2026-08-04)

Per the user's explicit choice, these fixes were made as direct source edits rather than split into separate implementation packets first (small, low-risk, no product-direction ambiguity once scoped below). Not yet built or test-verified — `bun` is unreachable from this session's device bridge.

- Items 1, 4, 5, 6, 8, 9 (all "quick win" rows above): implemented as described.
- Item 2 (canvas keyboard access): implemented as the user-approved "minimal fix" — `tabindex="0"`, `role="application"`, `aria-label`, visible focus ring. Does not add full screen-reader traversal of shapes/layers; that remains open if a fuller accessibility pass is wanted later.
- Item 3 (silent session recovery): implemented as the user-approved "keep auto-restore, name what came back" — still restores automatically with no opt-out, but the toast now names the restored document(s) instead of a generic message.
- Item 7 (import/open error messages): implemented as a single friendly-lead-plus-technical-detail string ("Couldn't open this file. (<detail>)"), since the existing toast system has no secondary/expandable-detail UI. A true two-tier toast would require changes to the Toast component itself — flagged, not built.
- Item 10 (`prompt()` fallback in Save As): explicitly skipped per the user — confirmed dead code in the desktop build, not worth the effort.

Packet state left as `PREPARED` — this log records partial implementation against the ranked list above, not formal closure.

## Runtime Spot-Check (2026-08-05, installed build 0.6.21)

Verified against the installed desktop app at `C:\Users\User\AppData\Local\OpenPotlood\OpenPotlood.exe` (built 2026-08-05 10:14), driving the real UI rather than reading source.

**Confirmed fixed in the running app:**
- Item 1 — the close-confirmation dialog now reads "Unsaved changes" with **Cancel / Don't Save / Save**. The ambiguous Yes/No pair is gone and Cancel correctly aborts the close.
- Item 4 — every toolbar tool exposes a real name and shortcut: Move (V), Frame (F), Rectangle (R), Pen (P), Text (T), Hand (H), Shape Builder (Shift+M); the Pen submenu shows Pen / Pencil / Brush. No `'Slice'` fallback appeared.
- Item 5 — the Typography panel renders "Text resizing" with Auto Width / Auto Height / Fixed Size / Truncate as human labels, not raw keys.
- Item 2 (partial) — the canvas is reachable in the Tab order; the focus ring is faint enough on the dot-grid background that it was not clearly distinguishable in screenshots. Not a failure, but not positively confirmed either.

**Not verifiable at runtime:** item 8 (`aria-label` on the zoom input) — source-level only, no rendered evidence available from screenshots.

**Item 7 — NOT fixed on the path that matters. Regression found.**
Opening a deliberately corrupt `.fig` via **File > Open** in the desktop build produced the raw parser message **"Invalid zip data"**, not the friendly `openFileFailed` wrapper. Root cause: the desktop open path does not go through `read.ts`. `openFileDialog()` (`App/src/app/shell/menu/files.ts:50`) calls `openFileFromPath()` → `openFileInNewTab()` (`App/src/app/tabs/index.ts:189`), whose parse block (lines 232-257) is `try { … } finally { … }` with **no `catch`**. The friendly wrapper at `App/src/app/document/io/read.ts:59` is only reached by the browser/handle path. Item 7's fix therefore never applies to the shipped desktop application.

**New defect A — a failed open leaves a phantom tab.**
Because `openFileInNewTab` sets `store.state.documentName` and creates the tab (lines 220-228) *before* parsing, a failed load leaves an extra tab named after the file containing an empty document. The only signal of failure is the transient toast.

**New defect B — Windows path separators are not handled when deriving the document name.**
`App/src/app/shell/menu/files.ts:32` (`readTauriDesignFile`) and `:23` use `path.split('/').pop()`. Windows paths are backslash-separated, so the split never matches and `file.name` becomes the *entire absolute path*. Confirmed with a valid file: opening `C:\Users\User\Documents\OpenPotlood\Toolbox\Fixtures\test.fig` produced a tab and sidebar titled `C:\Users\User\Documents\OpenP...` instead of `test`. This affects **every successful File > Open in the desktop build**, not just error cases, and is outside the original UX-001 ranked list. Suggested fix: split on `/[\/]/` in both places.

Packet remains `PREPARED`. Items 1, 4, 5 are closed by this check; item 7 is reopened, and defects A and B are new and unscoped.

## Repair Pass and Delivery (2026-08-05, 0.6.22)

Fixes for the three defects found in the runtime spot-check above.

- **Windows path separators (defect B):** `readTauriDesignFile` in `App/src/app/shell/menu/files.ts` now derives the name via a `basenameFromPath` helper splitting on `/[\/]/`. Correction to the note above: only the Tauri path was wrong. The browser-side split on `/` at line 23 handles a URL, where `/` is correct, and was left alone.
- **Raw parser text (item 7) and phantom tab (defect A):** `openFileInNewTab` in `App/src/app/tabs/index.ts` now captures the failure, resets `loading` in `finally`, then calls a new `reportOpenFailure` that logs, cleans up, and shows the existing `openFileFailed` message. Cleanup differs by tab origin: a tab this call created is removed by a new `discardTab`, a reused untouched tab reverts to `Untitled`. `discardTab` deliberately does not push onto the reopen stack, so "reopen closed tab" can't resurrect an empty phantom. `findTabForSource` was extracted to stay under the repo's complexity ceiling of 20, which the added branch had pushed to 23.
- **Test:** added a Windows-path case to `App/tests/engine/tauri/file-actions.test.ts`. The pre-existing test only exercised `/tmp/design.pen`, which is why the bug survived.

Checks: `oxlint` clean on all three files; `tsgo --noEmit` clean; `oxfmt --check` clean; `bun test tests/engine/tauri/file-actions.test.ts` 5 pass / 0 fail. Umbrella `check`/`test` commands were not run (not requested).

Delivered as 0.6.22: version synced in `package.json`, `desktop/tauri.conf.json`, `desktop/Cargo.toml`; `bun run tauri build` succeeded; NSIS installer applied silently. Installed binary reports FileVersion 0.6.22. Note the installed exe's hash does not match `desktop/target/release/OpenPotlood.exe` — expected, because Tauri patches that file with bundle-type information after the installer is produced (its mtime is later than the install).

**Verification status — partial, stated plainly.**
- Defect B confirmed in the installed app: opening `Toolbox/Fixtures/test.fig` produced a tab and sidebar named `test`, with no extra tab.
- Item 7 and defect A are **not** runtime-verified. Driving the Open dialog needs a File Explorer grant that was declined, so evidence for those two is static analysis plus the unit test only. Manual re-check if wanted: open any non-design file renamed to `.fig` and confirm the friendly message appears and no tab is left behind.

**Open follow-ups (not fixed):**
1. `desktop/tauri.conf.json:15` hardcodes the window title as `"OpenPotlood 0.6.21"`, a second copy of the version independent of the `version` field on line 4. It was missed by the version bump and the installed 0.6.22 app still shows 0.6.21 in its title bar. This will desync on every future delivery until the duplicate is removed — worth deriving the title at runtime instead. An edit to correct it was started and stopped by the user, so the file is unchanged.
2. A stale `OpenPotlood 0.6.20` MSI entry remains in the uninstall registry beside the current NSIS install.
3. A freshly opened document shows the dirty/modified dot immediately, before any edit. Observed on 0.6.21 and 0.6.22; not investigated.

## Follow-up Pass (2026-08-06)

### Follow-up 1 — window-title version desync: FIXED (source), not yet runtime-verified

The version is no longer duplicated. `desktop/tauri.conf.json:15` is now the bare product name `"OpenPotlood"`, and a new `set_main_window_title` in `App/desktop/src/lib.rs` sets the title during `setup()` from `app.package_info()` — `name` (Tauri's `productName`) plus `version`, which is generated from `tauri.conf.json`'s `version` field at build time. There is now exactly one source of the version, so a release bump cannot desync the title again.

Checked: `cargo check` clean (exit 0). Not runtime-verified — proving the title bar reads the right version requires a build and install, which was not done in this pass (see the note on T-031 below).

### Follow-up 3 — dirty dot on a freshly opened document: ROOT-CAUSED and FIXED (source)

**Root cause.** `state.sceneVersion` is a *render* counter, not an edit counter — `requestRender()` in `App/packages/core/src/editor/create.ts:86` increments it. But `isDirty()` (`App/src/app/document/io/create.ts:80`) is `sceneVersion !== savedVersion`, and the saved baseline is taken by `setDocumentSource()` (`App/src/app/document/io/source.ts:91`). Any render requested *after* that baseline makes an untouched document report itself as modified. Both open paths did exactly that:

- `App/src/app/tabs/index.ts` (the desktop File > Open path) took the baseline at line 269, then called `switchPage()`, which ends in `ctx.requestRender()` (`App/packages/core/src/editor/pages.ts:203`).
- `App/src/app/document/io/read.ts` took the baseline, then called `editor.requestRender()` two lines later.

Viewport work is innocent — `zoomToBounds`/`zoomToFit` use `requestRepaint()`, which advances only `renderVersion`. `dom.ts` was already correct: it takes the baseline last.

**Fix.** Added `markDocumentClean()` to the document-IO surface (`io/create.ts`, exposed via `editor/session/modules.ts`) and called it in `tabs/index.ts` once the open sequence settles. Reordered `read.ts` so `setDocumentSource()` runs last, matching `dom.ts`.

**Test.** New `App/tests/engine/app/document-dirty-baseline.test.ts` — 3 pass / 0 fail. The middle test deliberately asserts the trap (a render after `setDocumentSource` *does* mark the document dirty), so the underlying sharp edge is documented rather than silently papered over.

**Not fixed — the underlying design smell.** `sceneVersion` doing double duty as render counter and edit counter means any future render-only call inserted into an open path re-breaks this. A brand-new blank `Untitled` tab is also affected by the same mechanism. Making dirtiness edit-derived (the undo stack is the obvious source, and `openFileInNewTab:225` already uses `undo.canUndo` as its "untouched" test) is a design change, not a repair, so it is flagged here rather than done.

### Follow-up 2 — stale MSI entry: INVESTIGATED, deliberately NOT actioned

Both entries confirmed present:

| DisplayName | Version | UninstallString |
|---|---|---|
| OpenPotlood | 0.6.20 | `MsiExec.exe /X{0D17B19C-1E26-4E4D-9453-E7AC3A6EBA9E}` |
| OpenPotlood | 0.6.22 | `C:\Users\User\AppData\Local\OpenPotlood\uninstall.exe` |

**Do not run the MSI uninstaller.** The stale 0.6.20 entry records `InstallLocation = C:\Users\User\AppData\Local\OpenPotlood\` — the same directory the live NSIS 0.6.22 install occupies. `MsiExec /X` would very likely delete files out from under the working installation. The safe options are to leave it (cosmetic only), or to delete just the registry key `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{0D17B19C-1E26-4E4D-9453-E7AC3A6EBA9E}` after exporting a backup. Both need an explicit decision; neither was performed.

### Blocker found — unfinished T-031 code is already in the tree

`bun run check` cannot pass right now, for reasons unrelated to this pass. `src/app/shell/panels/` (drag, resize, snap, layout, hosts, types) exists and is already wired into `EditorView.vue`, `LayersPanel.vue`, `PropertiesPanel.vue`, `FloatingPanel.vue`, `PanelOverlay.vue` and `PanelTitleBar.vue` — i.e. T-031 is substantially implemented despite `plan.md` listing it as "To do" and its packet still being `DRAFT` with two unconfirmed scope assumptions. `tsgo --noEmit` reports 4 errors, all in that module (`drag.ts:146`, `resize.ts:109` — pointer-capture release on an unnarrowed `EventTarget`). None are in the files touched by this pass. Left untouched, as editing another packet's in-flight work is out of scope here.

Also pre-existing and untouched: 3 failures in `tests/engine/tauri/fonts.test.ts` (a `loadSystemFont` argument-signature drift), unrelated to these changes.

**Checks run:** `cargo check` clean; `oxlint` clean on all touched files; `tsgo --noEmit` clean for all touched files (4 pre-existing errors elsewhere, above); `bun test tests/engine/app/document-dirty-baseline.test.ts` 3 pass / 0 fail; `bun test tests/engine/tauri/ tests/engine/app/editor-store-path.test.ts` 21 pass / 3 fail (all 3 pre-existing font failures).

**Not delivered.** No version bump, build or install was done. Follow-ups 1 and 3 are source-verified only; confirming the title bar and the dirty dot needs an installed build, and building now would also ship the unfinished T-031 panel work into the installed app.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (T-031 completion closed the remaining core-editor-experience work on 2026-08-11; source gates, focused browser interaction, 0.6.24 build/NSIS install, installed identity and responsive launch passed, and the user confirmed the installed feature works)
