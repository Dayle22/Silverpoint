# T-026 — Deliver per-document autosave, recovery, and safe exit

Task ID: T-026
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-025
Prepared against: Live `App/` source and tests on 2026-07-20; T-025 is PREPARED.
Last expanded: 2026-07-20

## Request Coverage

- Autosave changes independently for every open document or project without interrupting editing: App/src/app/document/autosave/create.ts and App/src/app/document/recovery/index.ts
- Recover safely after a crash, forced shutdown, failed write, or interrupted save: App/src/app/document/recovery/index.ts and App/src/views/EditorView.vue
- Allow closing tabs or exiting without an unnecessary confirmation only when every relevant change is durably saved or recoverable: App/src/app/tabs/index.ts and App/desktop/src/lib.rs
- Add a dashboard view of the last 20 opened projects with a thumbnail view: App/src/components/DashboardView.vue and App/src/app/document/recent/index.ts

## User-Visible Outcome

In the OpenPotlood desktop application, when starting up cleanly without any open files, the application loads directly into a premium bento-style Dashboard view instead of creating a blank "Untitled" document. The Dashboard features a visual grid of the last 20 opened projects, displaying a PNG thumbnail preview of each project's canvas, the filename, relative open time, and its truncated absolute file path. Double-clicking or clicking a card focuses the existing tab (if already open) or opens the file in a new tab. In the main tab bar, a home button with a home icon is always visible on the far left to let users quickly switch back to the Dashboard.
Behind the scenes, editing changes are autosaved in the background. If a document has a backing file and autosave is enabled, changes are written to the original file. Concurrently, all dirty tabs (including Untitled ones) are continuously backed up to a dedicated local recovery cache. If the application exits cleanly, these recovery files are removed. If the application crashes or exits unexpectedly, all open tabs are automatically restored in their exact state upon relaunch, with a brief recovery toast confirmation. When closing a single tab with unsaved changes, the user is only prompted to save if the tab cannot fit into the recently closed tabs recovery stack (max 5) or if pushing it to the stack would discard another dirty tab from memory. When exiting the application, the window closes immediately without confirmation if all dirty changes are successfully cached in the recovery store, prompting for confirmation only if a recovery backup failed or is in progress.

## Verified Starting State

- `App/src/app/cache/index.ts` provides `readCacheText`, `writeCacheText`, `readCacheJson`, `writeCacheJson`, `readCacheBytes`, and `writeCacheBytes` using Tauri's AppLocalData directory as a base.
- `@tauri-apps/plugin-fs` is configured with wildcard permissions `**` for `read-file`, `write-file`, `mkdir`, and `remove` inside `App/desktop/capabilities/default.json`.
- `App/src/app/document/io/write.ts` handles the low-level Tauri file writing operations using `tauriWrite`.
- `App/src/app/tabs/index.ts` manages active document sessions using Vue refs (`tabsRef`, `activeTabId`) and hooks into `openFileInNewTab` for all document loads.
- `App/src/app/editor/active-store/index.ts` exposes `getActiveEditorStoreOrNull()` and returns `storeProxy` for global active store references.
- Keyboard shortcuts and menu events are bound in `App/src/app/shell/keyboard/use.ts` and `App/src/app/shell/menu/use.ts` and expect an active store.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `App/desktop/src/lib.rs`
- `App/src/app/cache/index.ts`
- `App/src/app/tabs/index.ts`
- `App/src/views/EditorView.vue`
- `App/src/app/editor/active-store/index.ts`
- `App/src/app/shell/keyboard/registry.ts`
- `App/src/app/shell/menu/use.ts`

## Allowed Changes

- `App/desktop/src/lib.rs` to intercept the CloseRequested window event.
- `App/src/app/editor/active-store/index.ts` to expose dummy states safely when no store is active.
- `App/src/app/shell/keyboard/registry.ts`, `App/src/app/shell/keyboard/clipboard.ts`, and `App/src/app/shell/keyboard/nudging.ts` to guard active store accesses.
- `App/src/app/shell/menu/use.ts` to guard active store actions.
- `App/src/app/document/io/write.ts` and `App/src/app/tabs/index.ts` to trigger recent projects updates.
- `App/src/app/tabs/index.ts` to handle dashboard switching, tab-close safety check, and recovery cleanups.
- `App/src/views/EditorView.vue` to integrate the Dashboard view, listen to window close, and run recovery.
- `App/src/components/TabBar.vue` to render the Home/Dashboard trigger button.
- New file `App/src/app/document/recent/index.ts` for managing recent projects and canvas thumbnails.
- New file `App/src/app/document/recovery/index.ts` for managing background recovery backups.
- New file `App/src/components/DashboardView.vue` for the dashboard grid layout.
- New file `App/tests/e2e/autosave-recovery.spec.ts` for automated E2E coverage.
- `App/CHANGELOG.md` to document the update.
- `App/package.json`, `App/desktop/Cargo.toml`, and `App/desktop/tauri.conf.json` for SemVer patch increment.

## Restrictions and Exclusions

- The recent projects list must be capped at exactly the 20 most recent files.
- Project thumbnails must be saved inside Tauri's app local data directory (via the cache module) and never in the user's workspace folders.
- Closing a tab or exiting must only prompt if data loss is imminent (meaning the unsaved changes cannot be recovered from either the original file or the recovery/closed stack).
- Do not modify `.fig` file encoding or structure.

## Implementation Steps

1. **Rust Backend Intercept:**
   In `App/desktop/src/lib.rs`, add an `.on_window_event` handler to the Tauri builder:
   ```rust
   .on_window_event(|window, event| {
       if let tauri::WindowEvent::CloseRequested { api, .. } = event {
           api.prevent_close();
           let _ = window.emit("window-close-requested", ());
       }
   })
   ```
2. **Safeguard EditorStore Proxy:**
   In `App/src/app/editor/active-store/index.ts`, define a `dummyState` (e.g. `{ showUI: true, documentName: 'Dashboard' }`) and update `storeProxy` so that accessing `.state` when no active store exists returns this dummy state instead of throwing.
3. **Guard Keyboard & Menu Actions:**
   - In `App/src/app/shell/menu/use.ts`, wrap store-accessing menu actions (like `save`, `save-as`, `export-selection`) with `if (getActiveEditorStoreOrNull())` guards.
   - In `App/src/app/shell/keyboard/registry.ts`, modify the listener mapping loop so that non-global shortcuts return early if `getActiveEditorStoreOrNull()` is null. The only allowed global shortcuts are `['new-tab', 'close-tab', 'open-file', 'reopen-closed-tab']`.
   - In `App/src/app/shell/keyboard/clipboard.ts` (`bindEditorClipboard`) and `App/src/app/shell/keyboard/nudging.ts` (`bindNudgeKeys`), check if `getActiveEditorStoreOrNull()` is null at the start of event listeners and exit early.
4. **Recent Projects Manager:**
   Create `App/src/app/document/recent/index.ts` to manage the recent projects manifest `recent-projects.json` (max 20 entries) and background PNG thumbnail rendering:
   - For entries, store `path`, `name`, `lastOpened`, and `thumbnailKey`.
   - Implement `addRecentProject(path, name, store)`: Update list, sort by `lastOpened` descending, write list to `recent-projects.json`. Trigger `store.renderExportImage([], 0.15, 'PNG')` inside a `setTimeout` with 1000ms delay, and write the resulting bytes to `recent/thumb_[hash].png` using `writeCacheBytes`, then update the manifest entry's `thumbnailKey`.
   - Implement `removeRecentProject(path)`: Delete the manifest entry and remove its thumbnail file using `removeCacheEntry`.
5. **Hook Recents on Save & Open:**
   - In `App/src/app/document/io/write.ts#writeFile`, call `addRecentProject` after a successful disk write.
   - In `App/src/app/tabs/index.ts#openFileInNewTab`, call `addRecentProject` at the end of the load sequence if a file path is present.
6. **Recovery Cache Manager:**
   Create `App/src/app/document/recovery/index.ts` to manage active session backups under `recovery/recovery-manifest.json`:
   - Implement `saveTabRecovery(tab)`: Export active canvas graph to `.fig` bytes, write to cache key `recovery/recovery_${tab.id}.fig` via `writeCacheBytes`, and register in `recovery-manifest.json`.
   - Implement `clearTabRecovery(tabId)`: Remove recovery file and manifest entry.
   - Implement `restoreRecoverySession()`: If manifest has entries, read files, reconstruct tabs/stores with graph data, clear recovery files, and set them as dirty.
7. **Hook Recovery on Edit & Exit:**
   - In `createAutosave` (`App/src/app/document/autosave/create.ts`), if the tab is dirty, call `saveTabRecovery(tab)`. When it becomes clean, call `clearTabRecovery(tab.id)`.
   - In `closeTab` (`App/src/app/tabs/index.ts`), call `clearTabRecovery(tabId)`.
8. **Dashboard Trigger in Tab Bar:**
   In `App/src/components/TabBar.vue`, render a home button with `icon-lucide-home` on the far left of the tab bar trigger items. Clicking it sets `activeTabId.value = 'dashboard'`.
9. **Dashboard View Component:**
   Create `App/src/components/DashboardView.vue` with premium dark aesthetics (Outfit font, bento cards, transparent glassmorphic borders `bg-panel/40 backdrop-blur-md border border-border/50`, card hover scale/glow, file lists, and action buttons):
   - Grid cards load and display saved PNG thumbnails by converting cached bytes to browser object URLs via `URL.createObjectURL` (and revoking them on unmount).
   - "New Design File" opens a new tab. "Open Local File..." triggers Tauri open dialog.
   - Project cards have a hover dropdown to "Show in File Explorer" (Tauri open command) or "Remove from Recents".
10. **Startup & Exit Orchestration:**
    In `App/src/views/EditorView.vue`:
    - On mount, run recovery check. If recovered sessions exist, restore them. If not, and tabCount is 0, set `activeTabId.value = 'dashboard'`.
    - Listen for Tauri's `window-close-requested` event. Check if all dirty tabs have completed backup writes (matching latest `sceneVersion`). If yes, exit directly via `exit(0)`. If not (backup failed/in-progress), prompt the user: "Exit anyway?" before calling `exit(0)`.
    - If `activeTabId === 'dashboard'`, render `DashboardView` instead of SplitterGroup/Canvas.
11. **Safety Prompts on Tab Close:**
    In `App/src/app/tabs/index.ts#closeTab`:
    - If the closed tab is dirty and the closed tabs stack has room (< 5), push it directly.
    - If stack is full (5), check if the oldest tab being discarded is dirty. If dirty, show a Tauri dialog: "Save changes in [name] before closing?" with Save, Don't Save, and Cancel actions.
12. **E2E Test Coverage:**
    Create `App/tests/e2e/autosave-recovery.spec.ts` to assert recovery restoring on simulated crash, dashboard recents list loading and thumbnail rendering, safe exit logic, and dirty check bounds on close.
13. **SemVer and Changelog:**
    Bump patch version to `0.6.2` in `package.json`, `desktop/Cargo.toml`, and `desktop/tauri.conf.json`. Document addition of dashboard, crash recovery, and Tauri close intercept in `App/CHANGELOG.md`.

## Acceptance Criteria

- [ ] A Home/Dashboard button is visible in the tab bar. Clicking it renders the Dashboard View.
- [ ] Closing the last open tab switches the active view to the Dashboard instead of opening a new Untitled tab.
- [ ] Saving or opening a design file adds it to the recent projects grid on the Dashboard.
- [ ] Recent project cards render canvas preview thumbnails loaded from the AppLocalData cache.
- [ ] Tab close prompts save only when a dirty tab falls off the 5-item recently-closed memory stack.
- [ ] Simulating an unexpected shutdown (with recovery files on disk) automatically restores all unsaved tabs on relaunch.
- [ ] Clicking close on the window exits directly without confirmation if all dirty changes are successfully written to recovery files.
- [ ] All automated tests in `autosave-recovery.spec.ts` pass successfully.

## Verification

- Run E2E test gate: `bunx playwright test tests/e2e/autosave-recovery.spec.ts --project=openpencil`

## Integration or Installed-Result Check

- Perform production bundle: `bun run build`
- Build Tauri NSIS installer: `bun run tauri build --bundles nsis`
- Perform silent installation: `Start-Process -FilePath "src-tauri/target/release/bundle/nsis/OpenPotlood_0.6.2_x64-setup.exe" -ArgumentList "/S" -Wait`
- Verify application launches, displays Dashboard, preserves recents and thumbnails, recovers crash sessions, and handles close requested cleanly.

## Stop Conditions
 
- Stop if CanvasKit rendering fails to run inside Tauri Webview web worker due to sandboxing boundaries.
- Stop if Tauri's local AppLocalData path resolution throws access denied permissions in the Windows Event Viewer.

## Execution Report Contract

- Report result, files changed, commands and outputs, integrated-result evidence, deviations, and mess or concerns.

## Status record

Status: **Done**
