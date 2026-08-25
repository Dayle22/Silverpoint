# T-025 — Deliver multi-document tabs and concurrent projects

Task ID: T-025
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-008
Prepared against: Live `App/` source and tests on 2026-07-20; T-008 is DONE/VERIFIED.
Last expanded: 2026-07-20

## Request Coverage

- Open and work on multiple documents or projects in the same OpenPotlood window using clear tabs.
- Switch, reorder, close, and reopen tabs without losing document state, selection, viewport, undo history, or file identity.
- Make active-document status and unsaved state unambiguous while keeping document actions scoped to the correct tab.

## User-Visible Outcome

In the OpenPotlood application, a tab bar is always visible in the main header (even when only one tab is open). Users can see the current document name and whether it has unsaved changes (indicated by a small dot on the active tab). Clicking the `+` button in the tab bar creates a new "Untitled" tab. Tabs can be switched by clicking on them, closed by clicking their `x` button, and reordered by dragging them horizontally. Pressing `Ctrl+Shift+T` reopens the last closed tab in its exact pre-closed state, including its graph nodes, selection, zoom level, and undo history. If the user tries to open a file that is already open in another tab, the application focuses the existing tab instead of opening a duplicate. A maximum session limit of 20 concurrent tabs is enforced.

## Verified Starting State

### Verified facts

- `App/src/app/tabs/index.ts` owns the active tabs state using `tabsRef` (`shallowRef<Tab[]>([])`) and `activeTabId` (`shallowRef('')`).
- `createTab`, `switchTab`, and `closeTab` are defined in `App/src/app/tabs/index.ts` but lack reordering, dirty checking, duplicate open prevention, and recently closed stack tracking.
- `App/src/app/editor/active-store/index.ts` manages active session store using `setActiveEditorStore`.
- `App/src/app/editor/session/create.ts` constructs editor store/session instances with unique scene graph and vue reactive state.
- `App/src/app/document/io/create.ts` is constructed per-session and contains the `sourceState` closure managing `getSavedVersion()`.
- `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts` provides a Pragmatic Drag and Drop composable for horizontal/vertical list reordering.
- Keyboard shortcuts are registered in `App/src/app/shell/keyboard/registry.ts` via `registerKeyboardShortcuts`. `new-tab` and `close-tab` are mapped to `$mod+KeyN` / `$mod+KeyT` and `$mod+KeyW` respectively.
- `App/src/components/TabBar.vue` renders the tabs using `reka-ui` `TabsRoot` but currently hides them when `tabs.length <= 1`.

### Official research

- Pragmatic Drag and Drop from Atlaskit is the project's standard list-reordering framework, imported from `@atlaskit/pragmatic-drag-and-drop`.
- Reka UI (formerly Radix Vue) `TabsRoot` supports standard tab interactions and is used to compose the tab bar layout.
- The standard shortcut for reopening a closed browser/IDE tab is `Ctrl+Shift+T` (`$mod+Shift+KeyT` in tinykeys representation).

### Fixed implementation decisions

- The Tab Bar must be always visible (`v-if="tabs.length >= 1"` or remove `v-if` from `TabsRoot` in `TabBar.vue`) to allow creating a new tab from the `+` button when a single document is open.
- Introduce `reorderTabs(sourceId: string, targetIndex: number)` in `App/src/app/tabs/index.ts` to shift items within `tabsRef`.
- Hook `useFlatReorderDrag` with `axis: 'horizontal'` in `App/src/components/TabBar.vue` to enable horizontal tab dragging.
- Introduce `reopenClosedTab()` in `App/src/app/tabs/index.ts` using a recently closed stack (`closedTabsStack`) limited to a maximum size of 5. Only dispose `store` when a closed tab falls off the stack.
- Track dirty status by exposing an `isDirty` method or state property from the store's document IO module.
- Add duplicate opening checks inside `openFileInNewTab` based on matching file path or handle.
- Limit maximum active tabs to 20. Ignore tab creation requests or show an action toast if the limit is exceeded.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `App/src/app/tabs/index.ts`
- `App/src/components/TabBar.vue`
- `App/src/views/EditorView.vue`
- `App/packages/vue/src/shared/drag/useFlatReorderDrag.ts`
- `App/src/app/shell/menu/use.ts`
- `App/src/app/shell/keyboard/registry.ts`
- `App/src/app/shell/keyboard/use.ts`

## Allowed Changes

- `App/src/app/document/io/create.ts` and `App/src/app/editor/session/modules.ts` to expose `isDirty` state query.
- `App/src/app/tabs/index.ts` to implement reordering, recently closed stack, duplicate prevention, and tab limits.
- `App/src/components/TabBar.vue` to show tabs always, integrate `useFlatReorderDrag`, and render dirty indicators.
- `App/src/app/shell/keyboard/registry.ts` and `App/src/app/shell/keyboard/use.ts` to bind `$mod+Shift+KeyT`.
- New `App/tests/e2e/tabs.spec.ts` for automated test coverage.
- `App/CHANGELOG.md` to document changes.
- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` for the final SemVer patch bump.

## Restrictions and Exclusions

- Do not alter or break `.fig` compatibility.
- Tab limits must be exactly 20 max concurrent tabs.
- Closed tab history must be capped at exactly 5.
- The tab bar must remain standard CSS/Vanilla styled without adding third-party UI component packages.

## Implementation Steps

1. **Expose `isDirty` function from document IO:**
   In `App/src/app/document/io/create.ts`, add and return:
   ```typescript
   isDirty: () => state.sceneVersion !== sourceState.getSavedVersion()
   ```
2. **Expose `isDirty` on EditorStore:**
   In `App/src/app/editor/session/modules.ts`, add `isDirty: documentIO.isDirty` to the returned module object.
3. **Implement tab reordering:**
   In `App/src/app/tabs/index.ts`, add:
   ```typescript
   export function reorderTabs(sourceId: string, targetIndex: number) {
     const current = [...tabsRef.value]
     const sourceIndex = current.findIndex((t) => t.id === sourceId)
     if (sourceIndex === -1) return
     const [removed] = current.splice(sourceIndex, 1)
     current.splice(targetIndex, 0, removed)
     tabsRef.value = current
     triggerRef(tabsRef)
   }
   ```
4. **Implement closed tab recovery stack:**
   In `App/src/app/tabs/index.ts`:
   - Declare `const closedTabsStack: Tab[] = []`.
   - Update `closeTab(tabId)` to push the closed tab to `closedTabsStack` (max length 5). Shift and call `oldest.store.dispose()` on the oldest item when size exceeds 5. Update `closeTab` so that the closed tab store is not immediately disposed if kept in the recovery stack.
   - Implement `reopenClosedTab()` to pop a tab from `closedTabsStack`, append to `tabsRef.value`, and activate it.
5. **Implement duplicate prevention:**
   In `App/src/app/tabs/index.ts#openFileInNewTab`, check if `path` or `handle` matches any existing tab in `tabsRef.value`. If yes, call `switchTab(existing.id)` and return without opening a new tab.
6. **Enforce session limit:**
   In `createTab` and `openFileInNewTab`, check if `tabsRef.value.length >= 20`. If so, show a warning toast (using `store.state.actionToast`) and return.
7. **Wire keyboard shortcut `Ctrl+Shift+T`:**
   - In `App/src/app/shell/keyboard/use.ts`, import `reopenClosedTab` and pass it to `registerKeyboardShortcuts`.
   - In `App/src/app/shell/keyboard/registry.ts`, register shortcut `{ id: 'reopen-closed-tab', keys: '$mod+Shift+KeyT', run: ({ reopenClosedTab }) => reopenClosedTab() }`.
8. **Update `TabBar.vue` UI:**
   - Change `v-if="tabs.length > 1"` to `v-if="tabs.length >= 1"`.
   - Add a computed `isDirty` flag inside `allTabs` map: `isDirty: t.store.isDirty()`.
   - Render a small circular indicator (e.g. `data-test-id="tab-dirty-indicator"`) in the tab if `tab.isDirty` is true.
   - Import `useFlatReorderDrag` and `reorderTabs`. Implement element ref registration and horizontal drag callbacks to handle tab reordering.
9. **Write E2E test suite:**
   Create `App/tests/e2e/tabs.spec.ts` covering:
   - Creating, switching, and closing tabs.
   - Reordering tabs via drag-and-drop mocks.
   - Reopening closed tabs via keyboard shortcut.
   - Duplicate prevention focusing the existing tab.
   - Session limit validation.
   - Unsaved state dirty indicator visibility.

## Acceptance Criteria

- [ ] Creating tabs, switching tabs, and closing tabs works without browser errors.
- [ ] Tabs can be dragged and reordered horizontally.
- [ ] Pressing `Ctrl+Shift+T` restores the last closed tab in its exact pre-closed state.
- [ ] Unsaved changes show a small circular indicator on the tab.
- [ ] Attempting to open an already open file path switches to that tab.
- [ ] The app restricts the maximum concurrent tab count to 20.
- [ ] `bun run test` runs and all E2E tests pass.

## Verification

- Run `bunx playwright test tests/e2e/tabs.spec.ts --project=openpencil`; expect all E2E assertions to pass.

## Integration or Installed-Result Check

Every delivered update must pass the local desktop loop:
- Increment version to `0.6.2` in `package.json`, `tauri.conf.json`, and `Cargo.toml`.
- Run production build `bun run build`.
- Build Tauri installer `bun run tauri build --bundles nsis`.
- Perform a silent install and verify installed app launches, displays tabs, allows switching, and closing responsive processes.

## Stop Conditions

- Stop if `@atlaskit/pragmatic-drag-and-drop` throws runtime alignment errors in WebKit.
- Stop if file handle comparisons throw security exceptions in Tauri.

## Execution Report Contract

- Report result, files changed, commands and outputs, integrated-result evidence, deviations, and mess or concerns.

## Status record

Status: **Done**
