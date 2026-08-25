# T-096 - Document font status and substitution reporting

Task ID: T-096
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: T-014 (Done)
Related: T-002 (Windows identity), T-008 (export), T-021 (production PDF)
Prepared from: the 2026-08-24 upstream comparison, re-expanded against live App source
Expanded at: 2026-08-24 Africa/Johannesburg
Expanded against: live `App/packages/core/src/text`, `App/packages/core/src/canvas/text/index.ts`, `App/src/app/editor/fonts/index.ts`, `App/src/components/{TabBar.vue,Shell/IdmlImportDialog.vue}`, `App/desktop/src/fonts.rs`, and focused font tests
Delivery: named source gates + browser check
Execution size: 5 core implementation files; 2 test files across 2 suites; one bounded document-status surface, no split required.

## Intended Outcome

The desktop chrome shows a warning only when the active document has an unavailable requested font face or a loaded face whose embedded family/style differs from the requested face. Its dialog groups issues, lists affected layers, selects an individual layer safely across pages, and retries unresolved requests. It is advisory: no font replacement, download, export block, or document mutation.

## Request Coverage

> A document-level surface lists every font the open document asks for that is unavailable or has been substituted, says which layers are affected, lets the user select those layers, and offers a retry once the font becomes available.

## Verified Starting State

| Path | Symbol / span | Binding use |
| --- | --- | --- |
| `App/packages/core/src/text/requirements.ts` | `collectGraphFontKeys()` 7-28; `collectGraphFontRequirements()` 53-74 | Existing recursive graph traversal. Start from `graph.rootId` to cover every page and nested layer. |
| `App/packages/core/src/text/fonts.ts` | `isStyleLoaded()` 330-332; `loadedData()` 339-341 | Query exact `family|style` bytes. Never use family-only `isLoaded()`. |
| `App/packages/core/src/text/{face.ts,opentype.ts}` | `parseFontStyle()` 35-45; `getParsedFont()` 53-64 | Existing style equivalence and cached `opentype.js` parsing can identify the actual loaded face without a new dependency. |
| `App/packages/core/src/text/resolver/{index.ts,resolver.ts}` | `fontFaceDemand()` 22-37; `state()` 25-28 | A no-byte request is missing only after `failed` or `exhausted`, never while `idle`/`loading`. |
| `App/packages/core/src/canvas/text/index.ts` | `requiredNodeFaces()` 58-71; `requiredFacesReadiness()` 80-93 | Authoritative base-face plus style-run mapping using `weightToStyle()`. Extract and share this exact helper. |
| `App/src/app/editor/fonts/index.ts` | `ensureGraphFonts(graph, nodeIds, renderer?)` 229-255 | Exact retry route; it blocks nodes, loads, clears pictures as necessary, and invalidates the renderer in `finally`. |
| `App/packages/core/src/editor/pages.ts` | `switchPage(pageId)` 160-191 | Switch page before selecting a reported layer; no cross-page selection exists. |
| `App/src/components/TabBar.vue` | `desktop-shell-chrome` 183-195 | Mount the persistent, panel-independent desktop trigger immediately before `ZoomDropdown`. |
| `App/src/components/Shell/IdmlImportDialog.vue` | Reka dialog composition 1-109 | Exact local dialog and semantic-class precedent. |
| `App/desktop/src/fonts.rs` | `load_system_font_blocking()` 56-103 | It returns the first readable family face on a style miss, but the front end registers its bytes under the requested key. Keep it unchanged. |
| `App/tests/{engine/text/fonts/loading.test.ts,e2e/fonts/settings.spec.ts}` | focused font harnesses | Both are TS-covered and have no `@ts-nocheck` header. E2E uses `CanvasHelper`, `window.openPencil`, and `openpencil`. |

Required new core contract, exported through `App/packages/core/src/text/index.ts` as `@open-pencil/core/text`:

```ts
export type DocumentFontIssueKind = 'missing' | 'substituted'
export interface DocumentFontLayer { nodeId: string; pageId: string; nodeName: string }
export interface DocumentFontIssue {
  kind: DocumentFontIssueKind
  requested: { family: string; style: string }
  resolved?: { family: string; style: string }
  layers: DocumentFontLayer[]
}
export function collectDocumentFontIssues(graph: SceneGraph): DocumentFontIssue[]
export function loadedFontFaceIdentitySync(
  family: string, style: string
): { family: string; style: string } | null
```

`collectDocumentFontIssues()` is synchronous and observational. Sort issues by `kind` (missing first), requested family, then requested style; retain graph traversal order inside `layers`. It must not load, demand, retry, reset, mutate, or render.

## Read First

1. `App/packages/core/src/text/requirements.ts:7-74` and `App/packages/core/src/canvas/text/index.ts:45-93`.
2. `App/packages/core/src/text/{fonts.ts:297-341,opentype.ts:1-64,face.ts:28-45,resolver/index.ts:17-76}` and `text/index.ts:1-9`.
3. `App/src/app/editor/fonts/index.ts:229-255` and `App/packages/core/src/editor/pages.ts:160-191`.
4. `App/src/components/{TabBar.vue:1-195,Shell/IdmlImportDialog.vue:1-109}`.
5. `App/tests/{engine/text/fonts/loading.test.ts:1-18,e2e/fonts/settings.spec.ts:1-40}`.

## Corrections to the Brief

1. `collectGraphFontRequirements()` is not an active document-status service: it is used for export preparation and `ensureGraphFonts`, while renderer readiness resolves per text node. Reuse its traversal model but add a pure report query.
2. The resolver and `FontManager` do not record the actual system face returned by the Rust fallback. The source-bounded route is to inspect the already-loaded bytes through the existing OpenType parser. If embedded family/subfamily cannot be read, do not claim substitution.
3. `useNodeFontStatus()` remains untouched: it is family-only, selected-node UI, and unsuitable for exact style-level document reporting.

## Fixed Decisions

1. One local dialog is triggered from `TabBar`, not a panel, preference, menu or toast. It is persistent and independent of T-070/T-084 panel work.
2. Traverse `[graph.rootId]`, not `currentPageId`: the report covers the complete active document, including unopened pages.
3. A missing issue requires no exact loaded bytes plus terminal `fontResolver.state(fontFaceDemand(family, style)).state`. Pending states are silent.
4. A substitution requires parseable embedded bytes and either a different normalised family or different `{ weight, italic }` from `parseFontStyle()`. Matching aliases and unparseable bytes are silent.
5. Extract `requiredTextNodeFaces(node)` from renderer-local `requiredNodeFaces()` into `requirements.ts`; renderer and report call the same source of truth.
6. Retry all missing document faces through `await ensureGraphFonts(store.graph, [store.graph.rootId], store.renderer)`. Do not call `fontResolver.retry()` directly because it has no app invalidation route.
7. Clicking a layer row switches to its `pageId` first when needed, selects only that node, then closes. Multi-page groups expand to individual layer rows.
8. Use the exact English strings below. Do not revive localisation files after T-054.

## Visual Contract — binding

Reference: `TabBar.vue:167-179`, `IdmlImportDialog.vue:28-109`, `GamutSection.vue:65-113`.

| Element | Binding implementation |
| --- | --- |
| Trigger | `data-test-id="document-font-status-trigger"`; `Tip label="Document font issues"`; button `flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--color-warning-action)] transition-colors hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-accent`; `~icons/lucide/type-outline`, `size-3.5`. Render only for issues. |
| Dialog | `DialogRoot`, `DialogPortal`, `DialogOverlay :class="dialog.overlay"`, `DialogContent data-test-id="document-font-status-dialog" :class="dialog.content" :aria-describedby="undefined"`; `useDialogUI({ content: 'flex max-h-[85vh] w-[500px] max-w-[92vw] flex-col overflow-hidden' })`. |
| Header | `border-b border-border px-4 py-3`; title `text-sm font-semibold text-surface`, `Document font issues`; description `mt-0.5 text-xs text-muted`, `Unavailable or substituted fonts can change the document’s appearance.` |
| List | `flex flex-1 flex-col gap-2 overflow-y-auto p-4 text-xs`; group `rounded-lg border border-border bg-hover/20 p-3`; issue `text-[11px] font-medium text-[var(--color-warning-action)]`; names `font-mono text-[11px] text-surface`. |
| Layer row | keyboard-operable button, `data-test-id="document-font-status-layer"`, `flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-xs text-surface transition-colors hover:border-border hover:bg-hover focus-visible:ring-1 focus-visible:ring-accent`; page tail `ml-auto truncate text-[11px] text-muted`. |
| Footer | `flex justify-end gap-2 border-t border-border px-4 py-3`; close `rounded-md px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface`; retry test id `document-font-status-retry`, `rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50`. Labels: `Retry unavailable fonts` / `Retrying…`. Disable retry with no missing issue. |
| States | Hover, disabled and focus are fixed above. A recomputation to zero closes the dialog/removes trigger. Retry is single-flight. List scrolls; text truncates; dialog remains `max-w-[92vw]`. Mobile has no trigger. |

### Banned List

- No literal colour, palette utility, hex, `rgb()`, `hsl()`, or inline colour. The existing semantic warning variable is the only warning colour allowed.
- No font-size class outside `text-xs` / `text-[11px]`, or radius outside `rounded-md` / `rounded-lg`.
- No `tv()` recipe, global CSS, `app.css`, dependency, store, command, toast, panel, menu item, shortcut, or automatic dialog opening.
- No action that replaces, downloads, embeds, or silently repairs a font.

## Allowed Changes

- `App/packages/core/src/text/{requirements.ts,opentype.ts,index.ts}`, `App/packages/core/src/canvas/text/index.ts`, and `App/src/components/TabBar.vue` only.
- New focused engine and E2E tests only.

## Restrictions and Exclusions

Binding: crossing any of these requires stopping and reporting.

- Do not modify `App/desktop/src/fonts.rs`, Tauri commands, enumeration, system loading, Figma/MCP APIs, `.fig`, IDML, web font settings, PDF/export, or native menu.
- Do not change `useNodeFontStatus()`, `TypographyControlsRoot`, resolver semantics, renderer output, or font keys.
- Do not start resolution from a computed getter or label fallback glyph coverage as a face substitution.
- Do not run umbrella checks, package commands, builds, installs, version bumps, Git actions, snapshots, or desktop delivery work.

## Implementation Steps

1. **Pre-flight.** Reread all Read First anchors. Stop if `requiredNodeFaces()` no longer maps base plus style runs through `weightToStyle()`, or if `ensureGraphFonts()` no longer accepts `(graph, nodeIds, renderer?)`.

2. **Shared requirements and identity** (`packages/core/src/text/requirements.ts`, `packages/core/src/canvas/text/index.ts`, `packages/core/src/text/opentype.ts`, `packages/core/src/text/index.ts`).
   - Export `requiredTextNodeFaces(node: SceneNode): Array<{ family: string; style: string }>` from `requirements.ts`. Return `[]` for non-text nodes; otherwise preserve the current de-duplication `${family}\0${style}`, defaults and style-run fallback exactly.
   - Replace only renderer-local `requiredNodeFaces()` with this helper.
   - Extend the private OpenType structural type with optional English `fontFamily` / `fontSubfamily` names and add `loadedFontFaceIdentitySync()`, using cached `getParsedFont()`. Return `null` for no bytes, parse failure or either absent name; never add a parser.

3. **Pure report** (`packages/core/src/text/requirements.ts`, `packages/core/src/text/index.ts`).
   - Implement the exact interfaces above. Walk `graph.rootId` once, carrying the nearest `CANVAS` ancestor as `pageId`; collect all faces from `requiredTextNodeFaces()` and group layer `{ nodeId, pageId, nodeName }`. Skip text lacking a canvas ancestor.
   - Emit missing only for a no-byte, terminal face demand. For loaded bytes, emit substituted only by the Fixed Decision 4 comparison. Sort exactly as contracted. Do not call loaders or mutate any state.

4. **Surface** (`src/components/TabBar.vue`).
   - Add the local `open` and `retrying` refs and the issues computed to this existing shell component. The getter must read `void store.state.sceneVersion` then call `collectDocumentFontIssues(store.graph)`; close if the result reaches zero.
   - `retryMissing()` returns early while busy/no missing issue, otherwise awaits `ensureGraphFonts(store.graph, [store.graph.rootId], store.renderer)` and clears busy in `finally`.
   - `selectLayer(layer)` verifies `store.graph.getNode(layer.pageId)?.type === 'CANVAS'`, awaits `store.switchPage(layer.pageId)` when needed, calls `store.select([layer.nodeId])`, then closes.
   - Implement the Visual Contract directly in `TabBar.vue`: add the trigger immediately before `ZoomDropdown`, and add its `DialogRoot` sibling directly after the existing `TabsRoot`. The trigger condition is `!isMobile && showChrome && store.state.showUI && issues.length > 0`; do not alter `showAppMenu`.

5. **Tests/accessibility.**
   - Add `App/tests/engine/text/fonts/document-status.test.ts` without a suppression header. Use `SceneGraph`, globally unique requested family names, the existing font fixtures, `fontResolver.exhaust()`/`reset()` and `fontManager.markLoaded()` to prove: grouping of base/style-run faces; terminal missing; parsed mismatched subfamily substitution; matching identity silence; pending silence; page ids/order. Reset the exact resolver demand keys in `afterEach`; do not mutate private manager maps.
   - Add `App/tests/e2e/fonts/document-status.spec.ts` without a suppression header. Follow `settings.spec.ts` and `CanvasHelper`: create missing text via `window.openPencil`, assert trigger/dialog/request/layer, select the layer, prove retry busy/disabled semantics, and include a style-run request. Buttons need visible text or aria labels; layer accessible name includes layer and page.

6. **Focused verification.** Use the development loop while editing, then final gates once only.

## Acceptance Criteria

- [ ] Base and every style-run request are grouped once, across all document pages, with correct layer/page metadata.
- [ ] Only terminal exact face failures are missing; pending faces are silent.
- [ ] Substitution is based on embedded byte identity, with no false positive for aliases/unparseable bytes.
- [ ] Retry uses root-scoped `ensureGraphFonts()` and active renderer, stays single-flight and mutates no text properties.
- [ ] Selecting a cross-page issue first changes page then selects the specified layer.
- [ ] Trigger is desktop chrome only; dialog is keyboard operable and meets the Visual Contract.
- [ ] Diff contains none of the excluded Rust/export/MCP/Figma/dependency/panel/menu/global-style changes.

## Verification

Run from `C:\Users\User\Documents\OpenPotlood\App`.

### Development loop — repeat as needed

```powershell
bun test tests/engine/text/fonts/document-status.test.ts
```

Expected: pure status suite passes without CanvasKit/browser server.

### Final pre-completion gates — run once

```powershell
bunx tsgo --noEmit --pretty false
bunx vue-tsc --noEmit -p tsconfig.json --pretty false
bunx vue-tsc --noEmit -p packages/core/tsconfig.json --pretty false
bunx oxlint -c oxlint.json packages/core/src/text/requirements.ts packages/core/src/text/opentype.ts packages/core/src/text/index.ts packages/core/src/canvas/text/index.ts src/components/TabBar.vue tests/engine/text/fonts/document-status.test.ts tests/e2e/fonts/document-status.spec.ts
bun test tests/engine/text/fonts/document-status.test.ts
bunx playwright test tests/e2e/fonts/document-status.spec.ts --project=openpencil
```

Expected: each exits 0. Do not run `bun run check`, `bun run test`, `bun run test:unit`, `bun install`, a build, or an installer.

## Integration or Installed-Result Check

After source gates, run `bun run dev` from `App`. In the browser create an unavailable base face and style-run face: verify indicator/dialog, layer selection and retry behaviour; verify no indicator for Inter-only content and no export-flow change. Desktop build/install proof is neither authorised nor required: browser proves the UI and `desktop/src/fonts.rs` is excluded.

## Stop Conditions

- Stop if current OpenType parsing cannot expose both embedded family and subfamily from a test font. Do not invent a string heuristic or report from the requested key.
- Stop if helper extraction alters renderer readiness or needs a public graph schema change.
- Stop if root retry cannot use `ensureGraphFonts()`, page switching cannot precede selection, or live TabBar no longer mounts once per active document.
- Stop on any route into Rust, MCP/Figma, export preflight, web download or panel layout.

## Execution Report Contract

Report changed files; exact requested-versus-embedded comparison; source-gate exit codes; browser evidence for missing, substitution, cross-page selection, retry and clean state; any unparseable fixture; and confirmation that no build/install or excluded surface changed.

## Status record

2026-08-24 — Expanded from Brief to Ready against live requirements, resolver, OpenType, page, font-retry and TabBar seams. The report parses existing loaded bytes; the crash-safe desktop loader stays excluded. Execution evidence belongs here later; `Plan/plan.md` remains authoritative for status.
