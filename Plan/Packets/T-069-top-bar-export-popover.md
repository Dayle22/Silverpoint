# T-069 - Replace Share with a top-bar Export popover

Task ID: T-069
Packet state: Done
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-008 (Done — export formats and export execution)
Related: T-031d (top-chrome mount), T-057 (mobile/browser chrome; collaboration surface remains deferred)
Prepared from: the user's 2026-08-19 request to change the Share button into an Export button while retaining its popup container for export options
Expanded at: 2026-08-19 13:32 Africa/Johannesburg
Expanded against: `App/AGENTS.md`, `Plan/endgoal.md`, `Plan/plan.md`, the live `App/` source and tests named below, and the T-008/T-031d/T-057 packet boundaries
Delivery: named source gates + browser check

## Intended Outcome

The right side of the desktop tab bar shows **Export** with a download icon where **Share** is shown today. Pressing it opens the same anchored popup surface, but the popup contains the app's existing Export section: target-aware export rows, format and scale controls, add/remove actions, print/IDML preflight, preview and the final export action.

The change is a new entry point to the existing export workflow, not a second export implementation. The existing Export workspace/property panel remains available and both surfaces read and mutate the same node/page `exportSettings` through `useExport()`.

## Request Coverage

Verbatim user request:

> Create a new packet and expand it to change the share button to an export button, it will still open the popup block but inside will be the export options

This packet covers the desktop top-bar control currently implemented by `CollabSharePopover.vue`. It does not redesign File-menu exports, the workspace Export panel, export formats or collaboration business logic.

## Verified Starting State

| Path | Symbol / selector | Verified binding use |
| --- | --- | --- |
| `App/src/components/TabBar.vue:176-189` | `desktop-shell-chrome` | The right-hand tab-bar group mounts `CollabPanel`, `ZoomDropdown` and the UI toggle exactly once. Keep the order and row geometry. |
| `App/src/components/CollabPanel/CollabPanel.vue:1-14` | `CollabPanel` | Provides the collaboration context, renders `CollabAvatarStack`, then mounts `CollabSharePopover`. Replace only the popover child; keep the provider and avatar stack. |
| `App/src/components/CollabPanel/CollabSharePopover.vue:1-53` | `collab-share-button`, `collab-popover` | The current Reka `PopoverRoot`/`Trigger`/`Portal`/`Content` implementation. Its trigger has the requested location and its content switches among collaboration views. This file is replaced by the export-specific component rather than made responsible for two unrelated workflows. |
| `App/src/components/CollabPanel/context.ts:12-112` | `createCollabPanelContext()`, `provideCollabPanel()` | Owns collaboration URL, join/share/disconnect and `popoverOpen`. It remains intact because the avatar stack and collaboration engine still consume the context. Do not move export state into it. |
| `App/src/components/properties/ExportSection.vue:18-193` | `useExport()`, `doExport()`, `updatePreview()` | The one authoritative UI/controller for target, settings, format, preflight, preview and export execution. Reuse this component; do not copy its logic. |
| `App/src/components/properties/ExportSection.vue:196-289` | `PanelSection`, `export-button`, `export-preview-toggle` | Existing export options UI. It already exposes PNG, JPG, WEBP, SVG, PDF and conditional PDF (print)/IDML options, plus add/remove, warnings, preview and export states. |
| `App/packages/vue/src/document/export/helpers.ts:11-188` | `EXPORT_FORMATS`, `createExportTargetState()`, `createExportSettingActions()` | Existing shared state: selection when IDs exist, otherwise current page; updates every selected target in one undo batch and preserves plugin data. No new store is required. |
| `App/src/app/document/export/files.ts:115-193` | `createExportTargetActions()`, `saveExportedFile()` | Existing browser/native save route and selection/page target helpers. This packet does not modify it. |
| `App/src/components/ui/popover.ts:3-25` | `popover()`, `usePopoverUI()` | Authoritative semantic popup recipe: `rounded-lg border border-border bg-panel shadow-xl`. Reuse it. |
| `App/src/components/ui/panel/PanelSection.vue:8-78` | `PanelSectionProps.ui`, `PanelSection` | Supports scoped `ui` class overrides. `ExportSection` does not yet forward this prop; add the narrow forwarding seam so the reused section fits a popup without changing its default panel rendering. |
| `App/src/theme/panel/section.ts:1-20` | `panelSectionTheme` | Default section root includes `border-b` and `px-panel-x`; popup use needs only `border-b-0 px-3` and `pb-3` overrides. |
| `App/src/components/Toolbar/FramePresetPopover.vue:200-218` | `PopoverContent` | Live local pattern for `side`, `align`, `side-offset`, `collision-padding`, semantic border/background, rounded popup and explicit test ID. |
| `App/vite.config.ts` | `Icons()` and `IconsResolver({ prefix: 'icon' })` | Confirms auto-imported `icon-lucide-*` components. Installed `@iconify-json/lucide/icons.json` contains the `download` icon. |
| `App/tests/e2e/shell/chrome.spec.ts:25-28` | `collab-share-button` assertion | Existing shell test must be updated to the new `export-popover-button` identity while retaining the exactly-once Zoom assertion. |
| `App/tests/e2e/export/basic.spec.ts:76-287` | Export panel E2E | Already proves settings, formats, scale visibility, direct/ZIP downloads, preview, multi-selection, mixed state and undo. Keep it as a regression; add only the new top-bar mounting/interaction proof. |
| `App/package.json:19-57` | scripts | Confirms `dev`, focused Playwright use, `check:vue`, and the available source tooling. There is no `check:i18n` script; no locale command may be invented. |

## Read First

Read these live files in order immediately before execution:

1. `App/AGENTS.md` — binding workspace and delivery rules.
2. `Plan/plan.md` — current T-069 status and delivery policy.
3. `Plan/Packets/T-069-top-bar-export-popover.md` — this execution contract.
4. `App/src/components/TabBar.vue` — top-chrome mount and control order.
5. `App/src/components/CollabPanel/CollabPanel.vue` and `CollabSharePopover.vue` — current mount, trigger and popup being replaced.
6. `App/src/components/properties/ExportSection.vue` and `App/packages/vue/src/document/export/helpers.ts` — authoritative export UI and shared target/settings state.
7. `App/src/components/ui/panel/PanelSection.vue`, `App/src/theme/panel/section.ts` and `App/src/components/ui/popover.ts` — the only presentation seams to reuse.
8. `App/tests/e2e/shell/chrome.spec.ts` and `App/tests/e2e/export/basic.spec.ts` — current focused evidence and conventions.

## Corrections to the Brief

- The current popup is not a generic share-neutral block: `CollabSharePopover.vue` owns collaboration-specific state, colours and conditional content. The implementation must create a focused `ExportPopover.vue` and mount it from `CollabPanel.vue`; copying export controls into the collaboration component would couple unrelated state.
- Export options already exist as the complete `ExportSection.vue`. The packet does not author a simplified list of format buttons, because doing so would duplicate target rules, preflight, preview and settings persistence.
- Replacing this top-bar entry removes the desktop button route to starting, joining and disconnecting collaboration rooms from this location. The user's request makes that visible replacement intentional. Collaboration engine files, avatars, routing and retained collaboration views are not deleted or redesigned here; relocation is deferred.

## Fixed Decisions

1. **Reuse one export surface.** Mount `ExportSection.vue` inside the popup. Both the workspace panel and popup must share the same `useExport()` state and `doExport()` path.
2. **Use a focused component name.** Add `App/src/components/CollabPanel/ExportPopover.vue`, update `CollabPanel.vue` to mount it, and remove the now-unmounted `CollabSharePopover.vue`. Do not leave misleading dead UI behind.
3. **Keep collaboration ownership intact.** `CollabPanel.vue` continues to call `provideCollabPanel()` and render `CollabAvatarStack`; `context.ts`, `ConnectedRoom.vue`, `JoinRoomPrompt.vue`, `ShareOrJoinRoom.vue`, `src/app/collab/**`, router entries and mobile files stay byte-identical.
4. **Static export trigger.** The trigger always reads `panels.export`, uses `<icon-lucide-download class="size-3.5" />`, and no longer changes label/colour with collaboration state.
5. **Preserve export targeting.** A selection targets the selected node(s); no selection targets the current page. The popup does not add a target switcher, document-wide export or its own settings model.
6. **Preserve popup state conventions.** Use local `ref(false)` with `v-model:open`, Reka dismissal, Escape handling, outside-click handling and focus return. Export completion does not forcibly close the popup; users may run another configured export.
7. **Adapt through the existing UI seam.** Add an optional `ui` prop to `ExportSection.vue` and pass it straight to its `PanelSection`. Default it to undefined so every existing panel mount is visually and behaviourally unchanged.
8. **No new English key.** `panels.export` already equals `Export` in `packages/vue/src/i18n/messages/panels.ts`; reuse it for visible text and accessibility naming.
9. **Test the entry point, not the engine twice.** New E2E proves trigger/popup composition, shared setting state and keyboard dismissal. Existing export E2E remains the format/download authority.

## Visual Contract — binding

| Element / state | Required implementation |
| --- | --- |
| Trigger | `flex h-7 cursor-pointer items-center gap-1.5 rounded-md border-none bg-accent px-3 text-xs font-medium text-white transition-colors hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent data-[state=open]:bg-accent/90` |
| Trigger icon | `<icon-lucide-download class="size-3.5" />` before `{{ panels.export }}`. |
| Trigger test/accessibility identity | `type="button"`, `data-test-id="export-popover-button"`; visible `Export` text supplies the accessible name. |
| Popup | `usePopoverUI({ content: 'z-50 max-h-[80vh] w-80 overflow-y-auto p-0' })`; Reka placement `side="bottom"`, `align="end"`, `:side-offset="8"`, `:collision-padding="8"`; `data-test-id="export-popover"`. |
| Export section in popup | Pass `:ui="{ root: 'border-b-0 px-3', body: 'pb-3' }"` to `ExportSection`; do not fork its template. |
| Default | Accent trigger, semantic panel popup, current selection/page export rows. |
| Hover | Only `hover:bg-accent/90`; no motion or scale effect. |
| Open/active | `data-[state=open]:bg-accent/90`; popup appears below and end-aligned with the trigger. |
| Focus-visible | One semantic accent ring on the trigger. Reka returns focus to it after Escape. |
| Empty | Existing `PanelSection` header and Add export action remain visible; `export-button` and preview toggle remain absent until a row is added. |
| Loading/disabled | Preserve `ExportSection`'s existing disabled export button and opacity while `exporting` or preflight-invalid. Do not disable the top-bar trigger. |
| Overflow | Popup scrolls vertically within `80vh`; its width stays `w-80`. Format menus continue to portal above it. |
| Collision/responsive | Reka collision padding stays 8 px. Do not introduce a separate mobile layout in this packet. |

### Banned List

- No literal colour values and no Tailwind palette colours in new/changed popup code. Use semantic tokens only.
- No font size outside `text-xs` or `text-[11px]`.
- No radius outside `rounded-md` or `rounded-lg`.
- No new `tv()` recipe; reuse `usePopoverUI()` and `PanelSection`'s `ui` prop.
- No new dependency, global CSS, `app.css` edit or inline style.
- No duplicated export form, format list, preflight, preview, save or ZIP logic.
- No new export or collaboration store/state where existing state works.
- Do not preserve the old `collab-share-button`/`collab-popover` test IDs on the new control.

## Allowed Changes

- Add `App/src/components/CollabPanel/ExportPopover.vue`.
- Delete `App/src/components/CollabPanel/CollabSharePopover.vue` after its mount is replaced.
- Update only the import and child mount in `App/src/components/CollabPanel/CollabPanel.vue`.
- Add the optional `ui` forwarding prop to `App/src/components/properties/ExportSection.vue` without changing default output or export behaviour.
- Update `App/tests/e2e/shell/chrome.spec.ts` for the new trigger identity.
- Add `App/tests/e2e/export/popover.spec.ts` for the new top-bar workflow.

## Restrictions and Exclusions

- Do not modify `App/src/app/document/export/**`, `App/packages/core/**`, `App/packages/scene-graph/**` or `App/packages/vue/src/document/export/**`; T-008 and later export packets own those behaviours.
- Do not change available formats, scale rules, target rules, export filenames, ZIP behaviour, preview rendering, print/IDML preflight or native/browser save behaviour.
- Do not remove the existing Export workspace/property panel or change any of its current mount points.
- Do not modify collaboration state, networking, room routing, peers, avatars or mobile presence/share logic. Do not attempt to relocate collaboration controls in this packet.
- Do not change `TabBar.vue` geometry or reorder `CollabPanel`, Zoom or UI toggle controls.
- Do not add strings or edit locale dictionaries; use `panels.export`.
- Do not add a target switcher, quick-format buttons, presets, recent exports, progress overlay or post-export toast.
- Do not alter dashboard, `showUI=false`, `?no-chrome`, Tauri-only menus or generated menu JSON.
- Do not run umbrella checks, builds, installs, version bumps, package-manager mutations or Git commands.

An implementer who needs to cross any of these boundaries must stop and report the live evidence rather than broadening the packet.

## Implementation Steps

1. **Pre-flight.** Re-read `App/AGENTS.md`, the live T-069 row in `Plan/plan.md`, this packet, and every path in Verified Starting State. Confirm T-008 remains Done, the current top trigger is still `CollabSharePopover`, and `ExportSection` still owns the listed workflow. Stop on material drift.
2. **Add the focused popup.** Create `App/src/components/CollabPanel/ExportPopover.vue`. Import `ref` from Vue; Reka `PopoverContent`, `PopoverPortal`, `PopoverRoot`, `PopoverTrigger`; `useI18n`; `ExportSection`; and `usePopoverUI`. Implement the exact trigger, placement, popup classes and test IDs from the Visual Contract.
3. **Expose presentation-only reuse.** In `ExportSection.vue`, add an optional `ui?: ComponentUI<PanelSectionTheme>` prop using the existing types from `@/components/ui/types` and `@/theme/panel/section`, then pass `:ui="ui"` to its root `PanelSection`. Make no other script or template logic change.
4. **Mount and retire.** In `CollabPanel.vue`, replace the `CollabSharePopover` import and component with `ExportPopover`. Keep `provideCollabPanel()`, `CollabAvatarStack`, spacer and container classes unchanged. Delete `CollabSharePopover.vue` once grep confirms no remaining import.
5. **Update shell identity coverage.** In `tests/e2e/shell/chrome.spec.ts`, change the exactly-once assertion from `collab-share-button` to `export-popover-button`, keep `zoom-dropdown-trigger`, and update the test description so it no longer claims a Share control is mounted.
6. **Add focused popup E2E.** Create `tests/e2e/export/popover.spec.ts` using the existing editor/canvas fixtures. Prove: one Export trigger with download-oriented accessible name; click opens `export-popover`; empty state offers Add export; adding a row in the popup exposes the existing format selector and PNG/JPG/WEBP/SVG/PDF choices; the setting is visible in the existing shared graph state; Escape closes and returns focus; reopening preserves the setting; `collab-share-button` and `collab-popover` are absent; no page error occurs.
7. **Focused source gates.** From `App/`, run the Verification commands in order. Do not substitute umbrella commands.
8. **Browser check.** Start `bun run dev`, open an editor document, exercise the exact Integration check, then stop the dev server. Record observations and any remaining collaboration-surface consequence honestly.

## Acceptance Criteria

- [ ] The top-bar control says Export, uses the Lucide download icon and appears once in the existing right-hand chrome group.
- [ ] Pressing the trigger opens a bottom/end-aligned semantic popup containing the existing `ExportSection` UI.
- [ ] The popup and existing panel share `exportSettings`; edits in one are immediately observable in the other/graph state.
- [ ] Selection/page targeting, every existing format, preview, preflight and export execution remain owned by existing code.
- [ ] Empty, hover, open, focus-visible, disabled/loading, overflow and collision states match the Visual Contract.
- [ ] Escape closes the popup and returns focus to the Export trigger; outside click also dismisses it.
- [ ] The old Share trigger and collaboration content do not appear in this popup.
- [ ] Collaboration engine, routes, context, avatars and mobile code are unchanged.
- [ ] Existing Export panel E2E still passes with unchanged behaviour.
- [ ] Nothing in the Banned List or Restrictions appears in the implementation.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App` in this order:

1. `bunx tsgo --noEmit --pretty false` — expect exit 0.
2. `bunx vue-tsc --noEmit -p tsconfig.json --pretty false` — expect exit 0 for the app Vue project.
3. `bunx vue-tsc --noEmit -p packages/vue/tsconfig.json --pretty false` — expect exit 0 because the reused `useExport()` contract crosses the app/package boundary, even though package source should remain unchanged.
4. `bunx oxlint -c oxlint.json --type-aware --type-check src/components/CollabPanel/ExportPopover.vue src/components/CollabPanel/CollabPanel.vue src/components/properties/ExportSection.vue tests/e2e/shell/chrome.spec.ts tests/e2e/export/popover.spec.ts` — expect exit 0.
5. `bunx playwright test tests/e2e/shell/chrome.spec.ts tests/e2e/export/popover.spec.ts --project=openpencil` — expect exit 0; new identity/composition/shared-state/focus cases pass.
6. `bunx playwright test tests/e2e/export/basic.spec.ts --project=openpencil` — expect exit 0; the existing export panel, settings, format, preview, direct/ZIP and undo regression remains green.

Do not run `bun run check`, `bun run test`, `bun run test:unit`, a build, install or a made-up i18n script.

## Integration or Installed-Result Check

After the named source gates, run `bun run dev` from `App/` and browser-check at the normal desktop viewport:

1. Open a document with one selected shape. Confirm the top-right row shows Export once between the avatar area and Zoom, with no Share trigger.
2. Open Export. Confirm the popup is end-aligned below the button, retains an 8 px viewport collision gap, uses semantic theme colours and scrolls instead of leaving the viewport when preview/content grows.
3. With no export rows, confirm Add export is available and the final export button is absent. Add a row; inspect PNG/JPG/WEBP/SVG/PDF, scale visibility and preview. Confirm the workspace Export panel reflects the same setting.
4. Deselect the shape and reopen the popup; confirm it targets the current page. Reselect the shape; confirm its settings return.
5. Press Escape and click outside in separate openings; confirm dismissal and focus return after Escape. Reopen once more and confirm settings persist.
6. Confirm Zoom, avatars, tab switching, UI toggle and the existing workspace Export panel still work.

This browser proof is sufficient for this source-only Vue change. It is not installed-desktop proof. Do not build or install unless the user separately authorises desktop delivery.

## Stop Conditions

- T-008 is no longer Done, the export panel has moved/replaced its state or execution seams, or another active change is editing the same files.
- `ExportSection.vue` cannot be mounted twice against the active store without duplicated watchers, conflicting object URLs or setting corruption.
- Reusing `PanelSection` requires a global theme/CSS change rather than the existing `ui` prop seam.
- The popup needs copied export logic, a new store, a dependency, a locale addition or a file outside Allowed Changes.
- The old collaboration popup is required to remain reachable from the same top-bar trigger; that contradicts the requested replacement and needs a new product decision.
- Any named source gate, focused E2E or browser behaviour fails. Record the exact failure; do not weaken acceptance or claim Ready execution completion.

## Execution Report Contract

Report:

- every changed, added and removed file;
- the exact trigger/popup test IDs, icon and classes delivered;
- confirmation that `ExportSection` is reused rather than copied;
- exact commands, exit codes, test counts and failures;
- browser observations for selection, page, empty, format, preview, overflow, Escape/outside dismissal and shared settings;
- confirmation that collaboration engine/routes/context/avatars/mobile files, export engine/package source, menus, dependencies and version files were unchanged;
- any deviation, assumption, remaining gap or collision with T-057;
- explicitly state that source/browser proof is not an installed desktop build.

## Status record

Status: **Done**

- 2026-08-19 — Packet created and expanded against the live top-chrome, collaboration popup, shared Export section, export state, popup recipe and focused E2E seams. Fixed route: a new `ExportPopover.vue` reuses `ExportSection.vue`; no application code was changed during expansion.
- 2026-08-19 — Executed and verified. Replaced `CollabSharePopover.vue` with `ExportPopover.vue` mounted in `CollabPanel.vue`. Forwarded optional `ui` prop in `ExportSection.vue`. Retired `CollabSharePopover.vue`. Updated `tests/e2e/shell/chrome.spec.ts` and added `tests/e2e/export/popover.spec.ts`. All 6 named source gates and full 6-step browser integration passed with exit 0 (10/10 shell/popover E2E tests, 13/13 basic export regression tests). Source-only delivery completed.
