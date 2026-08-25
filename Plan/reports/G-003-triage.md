# G-003 triage verdicts and port order

Of Silverpoint's 1,618 changed paths, 607 (37.52%) are clean PORT work and 1,011 (62.48%) intersect upstream and need group-level triage; 36 of the 37 RECONCILE groups survive for manual reconciliation. Upstream conclusively supersedes one whole group (`.lfsconfig`) and the smart-snapping/guide-foundation and stock-frame-preset feature slices inside otherwise mixed groups, but their exact path share cannot be stated safely from directory-level data alone.

## PORT set

These paths did not change upstream after the graft base. They should be moved before any RECONCILE work, but source and its dedicated tests should still travel together in feature packets rather than as blind directory copies.

| Directory / prefix | Paths | What it contains |
| --- | ---: | --- |
| `tests/engine` | 125 | Unit coverage for Silverpoint I/O, Vue input, app state, rendering and editor features. |
| `packages/core` | 120 | Core additions including print/PDF/IDML, barcode, effects, guides, colour and editor operations. |
| `packages/vue` | 91 | Vue SDK controls and input/UI behaviour added by the completed feature packets. |
| `tests/e2e` | 88 | Browser acceptance coverage for properties, canvas, editor, panels and UI. |
| `src/components` | 56 | Silverpoint panels, property controls, toolbar, shell, layer tree and collaboration UI. |
| `src/app` | 46 | App shell, AI/MCP, document, editor and swatch integrations. |
| `packages/docs` | 16 | Silverpoint's new English documentation, including IDML and programmable surfaces. |
| `tests/fixtures` | 13 | PDF and IDML fixtures. |
| `src/theme` | 9 | Added theme recipes for app chrome, pickers, preferences and status UI. |
| `packages/scene-graph` | 8 | New model primitives for Silverpoint-specific editor and print features. |
| `packages/fig` | 6 | FIG package additions and checks not touched upstream. |
| `tools/architecture` | 4 | Silverpoint architecture rules and tests. |
| `desktop/src` | 2 | Codex sidecar and menu-event Rust integration. |
| `packages/pen` | 2 | Pen/path helpers. |
| `tests/helpers` | 2 | Barcode and SVG DOM test helpers. |
| `packages/mcp` | 2 | MCP additions unique to Silverpoint's local bridge. |
| `tools/windows-sidecars` | 2 | Windows sidecar build tooling. |
| `vite/pwa.ts` | 1 | PWA configuration. |
| `tools/unit-tests` | 1 | Unit-test tooling configuration. |
| `tools/i18n` | 1 | The package-level remainder of the English-only tooling change. |
| `tests/preload.ts` | 1 | Browser test preload support. |
| `tauri.build.override.json` | 1 | Local Tauri build override. |
| `public/apple-touch-icon.png` | 1 | Repaired Apple touch icon bytes. |
| `public/favicon.ico` | 1 | Repaired ICO favicon bytes. |
| `playwright.config.ts` | 1 | Silverpoint Playwright configuration. |
| `.gitignore` | 1 | Silverpoint-local ignore rules. |
| `packages/kiwi` | 1 | Kiwi package documentation. |
| `scripts/benchmark-live-mcp.ts` | 1 | Live MCP benchmark entrypoint. |
| `scripts/build-windows-sidecars.ts` | 1 | Windows sidecar compatibility entrypoint. |
| `REGENERABLE-ARTEFACTS.md` | 1 | Regenerable-output policy. |
| `public/favicon-128.png` | 1 | Repaired 128 px favicon bytes. |
| `public/favicon-32.png` | 1 | Repaired 32 px favicon bytes. |

## RECONCILE verdicts

Commit counts are the output of the packet's specified `git log` range and therefore include merge commits. "Primary Done owners" identifies the completed packet families that materially own the changed area; cross-cutting generated files and tests may also be touched by their companion packets.

| Area | Paths | Primary Done owners | Upstream commits | Verdict | Evidence and disposition |
| --- | ---: | --- | ---: | --- | --- |
| `packages/docs` | 666 | T-054, T-063, T-064b, T-064c | 24 | RECONCILE | Upstream `docs: remove untranslated localized placeholders` (2026-08-13) and `docs: polish localized documentation` (2026-08-20) overlap the locale trees, but Silverpoint deliberately remains English-only and also adds IDML/SDK docs. Retain that product choice; merge the 12 non-locale paths by hand. |
| `packages/core` | 69 | MCP-001; T-003–T-024c; T-037–T-050b2; T-060, T-061, T-063, T-064a–c, T-071, T-078, T-091 | 128 | RECONCILE | Upstream added guides/snapping (`feat(editor): add configurable snapping and guides`, 2026-08-18) and immutable CanvasKit paths (`refactor(canvas): adopt immutable CanvasKit paths`, 2026-08-18), while Silverpoint adds broader print, PDF/IDML, effects and stability behaviour. Drop duplicated snapping internals; preserve the rest through hand reconciliation. |
| `packages/vue` | 56 | T-004–T-018; T-024–T-024c; T-031 family; T-037–T-055; T-060–T-064c; T-070 family; T-076–T-078; T-087, T-088, T-091 | 103 | RECONCILE | Upstream refactored canvas interaction domains (2026-08-20) and fixed vector drag release (`fix(editor): commit vector drags on pointer release`, 2026-08-24). Silverpoint's pen, panel and property-control changes remain wanted; use upstream's new input seams rather than porting the old structure verbatim. |
| `src/components` | 45 | MCP-001; T-004–T-024; T-031 family; T-035–T-055; T-058; T-063–T-064c; T-069–T-070d3; T-076, T-077, T-087–T-091 | 100 | RECONCILE | Upstream polished the files/New-tab UI (`refactor(app): polish files workspace and New tabs`, 2026-08-20) and hardened MCP controls (2026-08-20); Silverpoint's panels, print UI and property surfaces are distinct. Rebuild against current component structure. |
| `src/app` | 37 | MCP-001, MCP-002; T-002–T-030; T-031 family; T-035, T-036; T-042–T-055; T-058; T-060–T-064c; T-069–T-070d3; T-077, T-078, T-087–T-091 | 138 | RECONCILE | Upstream now has configurable crash recovery (2026-08-21), recent/storage home (2026-08-18) and extensive MCP lifecycle work (2026-08-19–20). Reuse those foundations, but retain Silverpoint document, desktop menu, local bridge and workspace policy. |
| `tests/engine` | 34 | Companion coverage for MCP-001/002 and the T-002–T-091 feature families | 210 | RECONCILE | Upstream's feature work carries extensive new engine coverage, including snapping, recovery, FIG and MCP tests. Port only assertions for surviving Silverpoint behaviour and rewrite them against current helpers. |
| `tests/e2e` | 31 | Companion coverage for T-002–T-091 UI and interaction packets | 91 | RECONCILE | Upstream added guide, settings, workspace and MCP E2E coverage during 2026-08-18–20. Deduplicate equivalent scenarios and retain Silverpoint-only acceptance cases. |
| `packages/fig` | 15 | T-048c, T-049c, T-063, T-091 | 53 | RECONCILE | Upstream hardened component round-trips (`fix(fig): harden component property round trips`, 2026-08-19), guide persistence (2026-08-18) and background loading (2026-08-18). Silverpoint's gradient/IDML-adjacent FIG preservation remains distinct. |
| `src/theme` | 13 | T-005; T-031 family; T-045; T-050b1; T-051; T-055; T-069; T-070 family; T-087, T-091 | 21 | RECONCILE | Upstream added responsive property grids (2026-07-26) and later app/theme polish, while Silverpoint has four-theme and panel-specific recipes. Rebase recipes on current tokens. |
| `packages/scene-graph` | 10 | T-004, T-006, T-007, T-010–T-015, T-020, T-023, T-024, T-037, T-044–T-050b2, T-058, T-061, T-063, T-076, T-091 | 30 | RECONCILE | The sampled `snap.ts` verdict is **DROP**: upstream `feat(editor): add configurable snapping and guides` (2026-08-18), followed by `fix(editor): harden snapping edge cases` (2026-08-19), supersedes T-010's snapping core and part of T-007. The directory also contains unsuperseded effects, radii, print and history models, so the group itself must be reconciled. |
| `packages/mcp` | 4 | MCP-001, MCP-002, T-009 | 15 | RECONCILE | Upstream derived its catalogue from registration (2026-08-19), classified document access (2026-08-19) and modelled tool effects/capabilities (2026-08-20). Keep Silverpoint's targeting/error contract, but implement it on upstream's catalogue model. |
| `desktop/src` | 3 | MCP-001, MCP-002; T-002, T-009, T-026, T-042, T-055, T-088 | 11 | RECONCILE | Upstream added recent-files plumbing (2026-08-17), configurable guides (2026-08-18) and safer font loading (2026-08-12). Preserve Silverpoint identity/menu/bridge behaviour while adopting the fixes. |
| `tests/helpers` | 2 | T-024, T-046–T-048d, T-063, T-076, T-078, T-091 | 17 | RECONCILE | Upstream changed helpers alongside vector drag release (2026-08-24), FIG/text-path work (2026-08-17) and guide tests. Merge helper APIs first, then port surviving tests. |
| `tools/architecture` | 2 | T-054 | 2 | RECONCILE | Upstream only standardised acronym casing (`refactor: standardize acronym casing`, 2026-08-10; follow-up 2026-08-10), while Silverpoint removes an obsolete locale-tailwind rule. Preserve the deletion and reapply current naming. |
| `tools/package-quality` | 2 | G-001b and publishability follow-ups | 4 | RECONCILE | Upstream strengthened publication smoke checks (2026-08-13). Its newer checks should be the base; reapply only Silverpoint metadata/identity policy. |
| `src/views` | 1 | T-025, T-026; T-031 family; T-042, T-043; T-064c; T-070 family | 20 | RECONCILE | Upstream unified recent/storage home (2026-08-18) and later polished files/New tabs (2026-08-20), while Silverpoint's `EditorView.vue` contains panel/dashboard integration. Reconstruct on the new view split. |
| `src/constants.ts` | 1 | T-009, T-017, T-024, T-039–T-041, T-044, T-047, T-050a, T-050b2, T-062, T-071, T-088 | 3 | RECONCILE | Upstream added configurable guide constants (2026-08-18). Drop overlapping guide constants, retain Silverpoint sizing/tool constants. |
| `tools/i18n` | 1 | T-054 | 1 | RECONCILE | Upstream only renamed acronym forms (`refactor: standardize acronym casing`, 2026-08-10); Silverpoint deletes `check-locales.ts` as part of the binding English-only decision. Preserve the deletion. |
| `src/App.vue` | 1 | T-002, T-060, T-078 | 6 | RECONCILE | Upstream added document recovery (`feat(app): recover unsaved documents`, 2026-08-12) and component-library app wiring (2026-08-14). Silverpoint's identity/startup and selection behaviour must be reapplied to the current root. |
| `src/app.css` | 1 | T-005, T-016–T-021; T-032, T-035, T-036; T-042, T-043, T-045; T-048d, T-051–T-053; T-063; T-070 family; T-087, T-091 | 5 | RECONCILE | Upstream unified accent/field tokens (2026-07-18) and changed app CSS for live code editing (2026-08-15). Port only Silverpoint tokens/utilities after adopting the current CSS base. |
| `src/env.d.ts` | 1 | MCP-001/002 integration | 1 | RECONCILE | Upstream isolated Portless development routes (`fix(mcp): isolate Portless development routes`, 2026-08-21). Combine its environment declarations with Silverpoint's bridge declarations. |
| `.lfsconfig` | 1 | G-002a security/graft preparation | 1 | **DROP** | Upstream `ci: move Git LFS to provider-neutral gateway` (2026-08-01) replaces the credential-bearing base URL with `https://lfs.openpencil.dev`. Do not port Silverpoint's deletion; adopt upstream's safe provider-neutral file. |
| `tools/tauri-menu` | 1 | T-042, T-055, T-088 | 1 | RECONCILE | Upstream `feat(app): expand Figma menu and selection parity` (2026-08-03) expands the generator, but Silverpoint additionally routes the menu through the app-icon surface and hides native in-window chrome. Merge those policies. |
| `packages/kiwi` | 1 | T-063 and FIG parsing work | 13 | RECONCILE | Upstream restored strict parse validation (2026-07-18), hardened containers/DOM imports (2026-08-13) and added early page decode (2026-08-17). Keep these fixes and reapply only Silverpoint parser requirements. |
| `package.json` | 1 | T-002–T-091 dependency/script owners; G-001d/G-001b | 20 | RECONCILE | Upstream changed dependencies for immutable paths, AI SDK 7, Portless and Harness during 2026-08-18–20. Start from upstream dependencies/scripts, then add only dependencies still required by surviving Silverpoint features. |
| `index.html` | 1 | T-002, T-089 | 1 | RECONCILE | Upstream refactored full-area placeholders (2026-07-26); Silverpoint owns title/icon identity. Reapply identity to upstream markup. |
| `desktop/tauri.conf.json` | 1 | T-002, T-009, T-026, T-055, T-061, T-088, T-089; G-001d | 3 | RECONCILE | Upstream added Harness sidecar configuration (2026-08-19) and advanced its release identity. Preserve the removed updater, Silverpoint identity and authorised capabilities without discarding new sidecar config. |
| `desktop/generated` | 1 | T-042, T-053–T-055, T-088 | 6 | RECONCILE | Upstream generated menu changes for configurable guides (2026-08-18), recent files (2026-08-17) and Figma menu parity (2026-08-03). Regenerate after the reconciled schema; never hand-merge as authoritative source. |
| `desktop/Cargo.toml` | 1 | T-002, T-009, T-026, T-088; G-001d | 4 | RECONCILE | Upstream added credential storage (2026-07-26), native test harness support (2026-08-15) and release changes (2026-08-10). Adopt dependencies first, then reapply Silverpoint identity/version at delivery time. |
| `desktop/Cargo.lock` | 1 | Generated dependency lock for desktop packets | 5 | RECONCILE | Upstream refreshed dependencies (2026-08-18) and added credential/test-harness dependencies. Regenerate from the reconciled manifest; do not port lockfile lines. |
| `desktop/capabilities` | 1 | MCP-001/002; T-009, T-026, T-088 | 4 | RECONCILE | Upstream narrowed MCP discovery permissions (2026-08-19) after adding required fs permissions (2026-08-18). Treat upstream's least-privilege set as the base and add only proved Silverpoint needs. |
| `CHANGELOG.md` | 1 | User-facing record for all completed feature packets | 154 | RECONCILE | Upstream has 154 commits touching the changelog, including a 2026-08-24 audit. Do not merge chronologies line-by-line; create a Silverpoint section containing only surviving features after porting. |
| `bunfig.toml` | 1 | MCP-001/T-009 local transport setup | 2 | RECONCILE | Upstream added local transport discovery and reorganised the transport domain (both 2026-07-25). Keep upstream's structure and reapply only Silverpoint-specific runtime settings. |
| `bun.lock` | 1 | Generated dependency lock for T-007, T-009, T-023, T-063/T-064 and related packets | 23 | RECONCILE | Upstream has broad dependency churn through Portless, AI SDK 7, CanvasKit and Harness. Regenerate from the reconciled manifests; do not port lockfile lines. |
| `AGENTS.md` | 1 | G-001b | 15 | RECONCILE | G-001b restored the then-current upstream file, but upstream has since added Portless, Harness and release guidance through 2026-08-21. Take upstream `AGENTS.md` and retain local-only routing solely in ignored `AGENTS.local.md`. |
| `README.md` | 1 | T-011, T-023, T-054 and identity work | 10 | RECONCILE | Upstream reorganised documentation (2026-08-13) and added Portless/Harness guidance (2026-08-19–21). Reapply Silverpoint identity and surviving feature claims; do not preserve stale capability text. |
| `vite.config.ts` | 1 | T-056, T-069, T-077, T-087, T-091 and MCP dev routing | 1 | RECONCILE | Upstream isolated Portless routes (2026-08-21). Preserve that routing and reapply only Silverpoint's two still-needed Vite settings. |

## Independently verified sampled cases

- `packages/scene-graph/src/snap.ts` — **DROP its T-010 / snapping-core implementation**, but not the whole `packages/scene-graph` group. Upstream `feat(editor): add configurable snapping and guides` (2026-08-18) independently added configurable object, guide, pixel, node-edit and resize snapping; `fix(editor): harden snapping edge cases` (2026-08-19) followed it.
- `packages/vue/src/canvas/useCanvasInput.ts` — **RECONCILE**. It has 15 upstream commits in the specified range, ending with `fix(editor): commit vector drags on pointer release` (2026-08-24), while Silverpoint's T-024 family adds pen/path behaviour and larger interaction targets not evidenced as superseded.
- `packages/core/src/canvas/scene.ts` — **RECONCILE**. It has five upstream commits; `refactor(canvas): adopt immutable CanvasKit paths` (2026-08-18) changes the ownership/lifetime seam that T-061 must use, but does not replace T-061's shader disposal, bounded caches, high-DPI clamp and context-loss recovery as a whole.

## Feature-level DROP slices inside surviving groups

These are narrower than the directory verdicts and must be honoured when G-004 packets are expanded:

1. **T-010 smart-snapping core and the overlapping part of T-007** — use upstream's 2026-08-18 configurable snapping/guides implementation plus its 2026-08-19 fixes. Preserve only Silverpoint print-specific margins/bleed and any behaviour proven absent upstream.
2. **T-027 stock frame presets** — upstream `feat(editor): add Figma-style frame presets (#418)` (2026-07-25) owns the same general feature. Retain only Silverpoint-specific print presets or custom dimensions not present there.
3. **The base `.lfsconfig` deletion** — use upstream's provider-neutral LFS gateway from 2026-08-01.

The recommended default does not feel wrong in these cases: adopting upstream's maintained implementation is cheaper than carrying permanent conflicts. Silverpoint's English-only documentation choice is intentionally **not** a DROP despite upstream's localisation work, because it is an explicit product decision rather than an implementation accident.

## Proposed port order

PORT groups come first. Within PORT, the smallest isolated groups precede medium and large groups; during execution, each feature's source and dedicated tests should still be combined in the same G-004 packet. RECONCILE groups then follow in ascending upstream-commit count, with generated locks/menu output deliberately late.

| Order | Set | Item | Effort | Porting note |
| ---: | --- | --- | --- | --- |
| 1 | PORT | `.gitignore` | Small | Apply ignore rules. |
| 2 | PORT | `REGENERABLE-ARTEFACTS.md` | Small | Add policy document. |
| 3 | PORT | `public/apple-touch-icon.png` | Small | Copy verified bytes. |
| 4 | PORT | `public/favicon.ico` | Small | Copy verified bytes. |
| 5 | PORT | `public/favicon-32.png` | Small | Copy verified bytes. |
| 6 | PORT | `public/favicon-128.png` | Small | Copy verified bytes. |
| 7 | PORT | `playwright.config.ts` | Small | Reapply test config after upstream install shape is known. |
| 8 | PORT | `tests/preload.ts` | Small | Add preload helper with its dependent tests. |
| 9 | PORT | `tauri.build.override.json` | Small | Reapply only when desktop packaging begins. |
| 10 | PORT | `vite/pwa.ts` | Small | Add browser/PWA config. |
| 11 | PORT | `scripts/benchmark-live-mcp.ts` | Small | Add compatibility entrypoint. |
| 12 | PORT | `scripts/build-windows-sidecars.ts` | Small | Add compatibility entrypoint. |
| 13 | PORT | `packages/kiwi` | Small | Add README-only change. |
| 14 | PORT | `tools/i18n` | Small | Add package-level English-only tooling change. |
| 15 | PORT | `tools/unit-tests` | Small | Add test-tool seam. |
| 16 | PORT | `desktop/src` | Small | Port Codex/menu Rust files in their owning feature packets. |
| 17 | PORT | `packages/pen` | Small | Port pen helpers before Vue pen integration. |
| 18 | PORT | `packages/mcp` | Small | Port unique bridge files before app wiring. |
| 19 | PORT | `tests/helpers` | Small | Port helpers with first dependent feature. |
| 20 | PORT | `tools/windows-sidecars` | Small | Port sidecar tool package. |
| 21 | PORT | `tools/architecture` | Medium | Add rules and dedicated tests. |
| 22 | PORT | `packages/fig` | Medium | Port FIG additions after Kiwi/core seams settle. |
| 23 | PORT | `packages/scene-graph` | Medium | Port primitives before core consumers. |
| 24 | PORT | `src/theme` | Medium | Port theme recipes before components. |
| 25 | PORT | `tests/fixtures` | Medium | Add immutable fixtures before related tests. |
| 26 | PORT | `packages/docs` | Medium | Port surviving English docs after APIs settle. |
| 27 | PORT | `src/app` | Large | Port by feature, after core/Vue APIs. |
| 28 | PORT | `src/components` | Large | Port by UI feature after app stores. |
| 29 | PORT | `tests/e2e` | Large | Port alongside each UI feature, not as a bulk final copy. |
| 30 | PORT | `packages/vue` | Large | Port primitives/composables after scene/core. |
| 31 | PORT | `packages/core` | Large | Port by domain after scene/pen foundations. |
| 32 | PORT | `tests/engine` | Large | Port alongside each owning source packet. |
| 33 | RECONCILE | `index.html` | Small | One upstream commit; reapply identity. |
| 34 | RECONCILE | `src/env.d.ts` | Small | One upstream commit; combine declarations. |
| 35 | RECONCILE | `tools/i18n` | Small | One upstream commit; retain deletion. |
| 36 | RECONCILE | `tools/tauri-menu` | Small | One upstream commit; merge menu policy. |
| 37 | RECONCILE | `vite.config.ts` | Small | One upstream commit; preserve Portless route. |
| 38 | RECONCILE | `tools/architecture` | Small | Two upstream commits; preserve local rule removal. |
| 39 | RECONCILE | `bunfig.toml` | Small | Two upstream commits; base on current transport layout. |
| 40 | RECONCILE | `src/constants.ts` | Small | Three upstream commits; drop duplicate guide constants. |
| 41 | RECONCILE | `desktop/tauri.conf.json` | Medium | Three upstream commits; identity/capability review required. |
| 42 | RECONCILE | `tools/package-quality` | Medium | Four upstream commits; adopt stronger checks. |
| 43 | RECONCILE | `desktop/Cargo.toml` | Medium | Four upstream commits; reconcile dependencies, defer versioning. |
| 44 | RECONCILE | `desktop/capabilities` | Medium | Four upstream commits; least-privilege review. |
| 45 | RECONCILE | `src/app.css` | Medium | Five upstream commits; token-level merge. |
| 46 | RECONCILE | `desktop/Cargo.lock` | Small | Five upstream commits; regenerate, do not hand-port. |
| 47 | RECONCILE | `src/App.vue` | Medium | Six upstream commits; reapply root behaviour. |
| 48 | RECONCILE | `desktop/generated` | Small | Six upstream commits; regenerate after menu/schema merge. |
| 49 | RECONCILE | `README.md` | Medium | Ten upstream commits; rewrite claims from surviving scope. |
| 50 | RECONCILE | `desktop/src` | Medium | Eleven upstream commits; merge native fixes and Silverpoint policy. |
| 51 | RECONCILE | `packages/kiwi` | Medium | Thirteen upstream commits; use current parser as base. |
| 52 | RECONCILE | `packages/mcp` | Large | Fifteen upstream commits; reconcile catalogue/effect/targeting models. |
| 53 | RECONCILE | `AGENTS.md` | Small | Fifteen upstream commits; take upstream file, keep local route ignored. |
| 54 | RECONCILE | `tests/helpers` | Medium | Seventeen upstream commits; settle helper APIs before tests. |
| 55 | RECONCILE | `src/views` | Large | Twenty upstream commits and a major view rewrite. |
| 56 | RECONCILE | `package.json` | Large | Twenty upstream commits; reconstruct dependencies/scripts. |
| 57 | RECONCILE | `src/theme` | Large | Twenty-one upstream commits; rebase recipes on current tokens. |
| 58 | RECONCILE | `bun.lock` | Small | Twenty-three upstream commits; regenerate after manifests. |
| 59 | RECONCILE | `packages/docs` | Large | Twenty-four commits plus 666 paths; preserve English-only policy. |
| 60 | RECONCILE | `packages/scene-graph` | Large | Thirty commits; drop upstream-owned snap slice and merge models. |
| 61 | RECONCILE | `packages/fig` | Large | Fifty-three commits; reconcile FIG persistence/worker changes. |
| 62 | RECONCILE | `tests/e2e` | Large | Ninety-one commits; port only surviving acceptance intent. |
| 63 | RECONCILE | `src/components` | Large | One hundred commits; rebuild feature-by-feature. |
| 64 | RECONCILE | `packages/vue` | Large | 103 commits; input/component architecture changed materially. |
| 65 | RECONCILE | `packages/core` | Large | 128 commits; split G-004 work by core domain. |
| 66 | RECONCILE | `src/app` | Large | 138 commits; split by document, MCP, shell and panel domains. |
| 67 | RECONCILE | `CHANGELOG.md` | Medium | 154 commits; reconstruct, do not merge chronology. |
| 68 | RECONCILE | `tests/engine` | Large | 210 commits; rewrite tests beside each reconciled feature. |

The `.lfsconfig` DROP group is intentionally absent from the port order.

## Unsettled questions

1. Directory grouping cannot quantify how many individual paths belong to the feature-level T-010, T-007 and T-027 DROP slices. G-004 expansion must compute each feature's exact path/diff slice before applying changes.
2. Upstream now overlaps T-025/T-026/T-043 (multiple files, recent/storage home, recovery), MCP-001/MCP-002/T-009 (automation settings and runtime lifecycle), and T-061 (CanvasKit lifetime work), but commit subjects alone do not prove behavioural parity. These remain RECONCILE until focused source-diff packets compare acceptance criteria.
3. `packages/docs` contains 654 locale-tree paths plus 12 non-locale paths. Upstream maintains/polishes localisations, while Silverpoint intentionally removes them; user intent settles the product direction, but G-004 must avoid accidentally restoring locale navigation.
4. Generated artefacts (`bun.lock`, `desktop/Cargo.lock`, `desktop/generated/menu.json`) have no meaningful line-level port. Their final content depends on reconciled manifests/schema and must be regenerated in the packet that owns those inputs.
