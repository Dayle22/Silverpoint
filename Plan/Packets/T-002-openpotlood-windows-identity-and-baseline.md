# T-002 — Establish OpenPotlood Windows identity and baseline

Task ID: T-002
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-001
Prepared against: Live app tree SHA-256 6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5, identity-source hashes, test conventions, installed-folder state, and current official Tauri v2 documentation rechecked on 2026-07-18; T-001 evidence reconciled and identifier approved before READY promotion
Last expanded: 2026-07-18

## Request Coverage

- Name the installed Windows application `OpenPotlood` and establish private desktop app version `0.1.0`.
- Keep OpenPencil-compatible package, document, clipboard, automation, and SDK internals stable unless a user-visible identity surface specifically requires a change.
- Keep upstream publishing, signing, deployment, release, and updater machinery inert for this local-only application.
- Prove that one exact, freshly built NSIS installer was hashed, installed, launched, version-checked, identity-checked, path-checked, and responsive.
- Leave a rollback artefact and a small-model-friendly evidence receipt for the next session.

## User-Visible Outcome

The local Windows Start-menu/installed application, installer, executable metadata, native window title, webview title, and PWA metadata identify the product as `OpenPotlood`; retained macOS-only application-menu strings no longer contradict that identity. The installed executable reports version `0.1.0` and launches responsively from its own OpenPotlood installation directory.

## Decisions Still Required Before READY

One value is not yet approved in the authoritative project files:

- Approved Tauri bundle identifier: `com.dayle22.openpotlood`

Approval: User explicitly approved `com.dayle22.openpotlood` on 2026-07-18. It is unique from upstream `net.dannote.open-pencil` and the existing local `com.dayle22.openpencil-studio`, while following the established private-app naming pattern.

No executor-selected identifier substitution is permitted.

## Verified Starting State

- Root private package: `App/package.json` has name `open-pencil-app` and version `0.13.2`.
- Bun lock root: `App/bun.lock` records root workspace name `open-pencil-app`; publishable `@open-pencil/*` packages remain independently versioned `0.13.2`.
- Tauri: `App/desktop/tauri.conf.json` has product name/window title `OpenPencil`, version `0.13.2`, identifier `net.dannote.open-pencil`, updater artefact creation enabled, and upstream updater endpoint configured.
- Rust: `App/desktop/Cargo.toml` has package `open_pencil` `0.13.2`, description `OpenPencil desktop app`, binary name `OpenPencil`, and library name `open_pencil_lib`; `App/desktop/Cargo.lock` mirrors the local package version.
- Visible web identity: `App/index.html`, `App/src/App.vue`, and `App/vite/pwa.ts` display `OpenPencil`.
- Visible native identity: `App/desktop/src/menu.rs` uses `OpenPencil` and `About OpenPencil`.
- Updater is currently active at runtime: `App/src/App.vue` schedules a startup update check, `App/desktop/src/menu.rs` exposes `Check for Updates…`, and `App/desktop/src/lib.rs` registers the updater plugin.
- Existing internal compatibility names include `@open-pencil/*`, `window.openPencil`, `__OPENPENCIL_*`, `OPENPENCIL_*`, `openpencil/v1`, `.pen`/`.fig` formats, `@open-pencil/mcp`, CLI command names, and automation/storage identifiers.
- Existing application icon assets are present under `App/desktop/icons/` and `App/public/`; no replacement OpenPotlood brand artwork has been approved or supplied.
- The installed folders `%LOCALAPPDATA%\OpenPencil` and `%LOCALAPPDATA%\OpenPencil Studio` exist and must not be modified, overwritten, stopped, uninstalled, or used as proof for this task.
- `%LOCALAPPDATA%\OpenPotlood` does not exist, and no `OpenPotlood` process was found during the 2026-07-18 expansion inspection. Execution must recheck immediately before install because installed state can change.
- The live `App/` tree still contains exactly 2,619 files and 14,815,452 bytes at SHA-256 tree digest `6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5`; there are zero `.git` directories.
- `App/node_modules`, `App/tests/engine/app/identity.test.ts`, `App/tests/e2e/app/identity.spec.ts`, and `Toolbox/Project-History/reports/T-001-fresh-source-audit.md` are absent. Those two test files are planned new paths; dependencies and the T-001 report must exist through predecessor-authorised work before execution.
- No current `App/desktop/target/.../bundle` output is authoritative. Future execution must distinguish a fresh installer from stale files by build start time, exact name/version, size, and SHA-256.

## Verified Research and Existing Patterns

- Current identity-source SHA-256 values: `App/package.json` `F68C1D154E85CE59592DAC50B785105E6997D48DBDAEF3C8744C6B52478BEE0B`; `App/bun.lock` `E8845830179C92D3246F7E93D478B2D0735363A2A3AADE676039BE62A12CEB1E`; `App/desktop/tauri.conf.json` `F2D1D31115DE75C0ADF7ECE7D102233A927A16D36A043D10BEA31FF30C167F5F`; `App/desktop/Cargo.toml` `797249893B55DB2AB03E4BD58CC2E2FFE481CE9D6240E35618F778F5BF696276`; `App/desktop/Cargo.lock` `A6DF7C10E33EE9AAD65CD3F62B6A9E8C3CF215D380470E33E508CF35AD183356`.
- Visible-source SHA-256 values: `App/index.html` `B6DFBB5F87DD4233A6E5687C6F827794960A1038A278AB70B637D75B7A1A95EF`; `App/src/App.vue` `D185175CBCF88F432A3FA83D6008713781EB04DB4E0AEFE0FA8A6827AB0415AF`; `App/vite/pwa.ts` `96A2CFA1F050CEDEB5933CBFA130536378CF3829211C676FFED3095E0A0645B4`; `App/desktop/src/menu.rs` `3FFAB016592DC04EA8C0CC72CEEA18CE8943CCD66145BC04F6A54D88730FF3F0`; `App/desktop/src/lib.rs` `3681C4E88AD431E7C69048B7373CF1968BB2DBAC27A778E66E96C3169DDB1345`.
- Engine tests use `bun:test`; repository files are resolved through `repoPath()` from `App/tests/helpers/paths.ts`, and direct file reads use `Bun.file(...).text()` or Node read APIs. E2E tests use Playwright project `openpencil`, base URL `http://localhost:1420`, and imports from `#tests/e2e/fixtures` or `@playwright/test`.
- `App/bun.lock` is JSON-like text whose root record is `workspaces[""]`; only its `name` changes. The exact publishable-package baseline is `cli`, `core`, `dom-css`, `fig`, `kiwi`, `mcp`, `pen`, `scene-graph`, and `vue` at `0.13.2`; private `@open-pencil/docs` remains `0.1.0`.
- The hard-coded application/About/update menu in `App/desktop/src/menu.rs` is inside `#[cfg(target_os = "macos")]`. Windows native File/Edit/View/Object/Text/Arrange menus come from `App/src/app/shell/menu/schema.ts` through `App/desktop/generated/menu.json`, and neither contains a Check-for-Updates item. Do not add a Windows About/update menu merely to make the test symmetrical.
- Tauri v2 configuration documentation says the identifier must be unique reverse-domain notation and allows letters, digits, hyphens, and periods; `com.dayle22.openpotlood` is syntactically valid but remains unapproved. The same documentation treats `productName` as the app name and `version` as SemVer.
- Tauri's Windows-installer documentation says NSIS installs for the current user by default under `%LOCALAPPDATA%`, and x64 target output is under `target/x86_64-pc-windows-msvc/release/bundle/nsis/`. The official Microsoft Store guidance confirms uppercase `/S` for silent NSIS installation.
- Tauri's updater documentation says `bundle.createUpdaterArtifacts: true` creates Windows updater signature artefacts; `false` is therefore the bounded build-time setting. Runtime network inertness still depends on removing the startup call and exposing no shipped menu entry. The retained handler/plugin/endpoint are not reachable through normal startup or shipped menus; keeping them as archaeology is deliberate scope containment, not proof that those files were deleted.
- Official sources rechecked 2026-07-18: `https://v2.tauri.App/reference/config/`; `https://v2.tauri.App/distribute/windows-installer/`; `https://v2.tauri.App/plugin/updater/`; `https://v2.tauri.App/distribute/microsoft-store/`.

## Assumptions to Recheck Before READY

- T-001 will complete as its read-only packet requires, will not alter `App/`, and will still classify the OpenPotlood identity baseline as required. Any contrary report finding makes this packet stale and requires audit amendment rather than executor interpretation.
- The dependency versions resolved by the committed lock will retain the inspected Tauri v2 configuration/build behaviour. The audit role must recheck the installed CLI/config schema after frozen dependency restoration if T-001 reports version or toolchain drift.
- Default current-user NSIS installation plus product/binary names will resolve to `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`. The executor must stop and record a different generated path rather than searching for or accepting an arbitrary executable.
- No OpenPotlood installation or process will exist at execution start. This is a volatile machine-state assumption and is explicitly rechecked before edits/install.

## Identity Boundary

### Change to OpenPotlood

| Surface | File | Required result |
|---|---|---|
| Private root package | `App/package.json` | name `openpotlood-app`; version `0.1.0` |
| Root lock record | `App/bun.lock` | root workspace name mirrors `openpotlood-app`; do not alter publishable package versions |
| Tauri bundle | `App/desktop/tauri.conf.json` | product name/title `OpenPotlood`; version `0.1.0`; approved unique identifier; updater artefact creation disabled |
| Rust desktop package | `App/desktop/Cargo.toml` | version `0.1.0`; description `OpenPotlood desktop app`; binary name `OpenPotlood` |
| Rust lock record | `App/desktop/Cargo.lock` | only the local `open_pencil` package entry changes from `0.13.2` to `0.1.0` |
| Browser/webview title | `App/index.html`; `App/src/App.vue` | base/title template displays `OpenPotlood` |
| PWA metadata | `App/vite/pwa.ts` | manifest `name` and `short_name` are `OpenPotlood`; description says `Local design editor` |
| Retained macOS application menu source | `App/desktop/src/menu.rs` | macOS-only application/About labels use `OpenPotlood`; macOS-only updater item is absent; do not invent a Windows product/About item |
| `.pen` file association label | `App/desktop/tauri.conf.json` | name/description use `OpenPotlood Design File`; extension and MIME type remain unchanged |
| Focused identity coverage | `App/tests/engine/app/identity.test.ts` | asserts the exact identity/version matrix and protected internal boundary |
| Browser title coverage | `App/tests/e2e/app/identity.spec.ts` | asserts the rendered page title contains `OpenPotlood` and excludes user-visible `OpenPencil` branding |

### Preserve for compatibility

- All publishable workspace package names and versions under `App/packages/*/package.json`.
- Rust package/library/module identifiers `open_pencil` and `open_pencil_lib`; only the Windows binary display/name changes.
- `@open-pencil/*` imports, TypeScript aliases, public SDK names, CLI/MCP package names and commands.
- `window.openPencil`, `__OPENPENCIL_*`, `OPENPENCIL_*`, `openpencil/v1`, plugin-data namespace `open-pencil`, automation protocol names, local-storage/cache keys, and test project name `openpencil`.
- `.fig`/`.pen` extensions, MIME types, Kiwi/container markers, clipboard format markers, and document round-trip data.
- Existing icon files until separate OpenPotlood brand artwork is supplied and approved. Do not generate, recolour, rename, or claim the upstream icons as bespoke OpenPotlood artwork.
- Source-code comments, architectural rule names, test fixture text, public documentation, upstream acknowledgements, licence, changelog history, package URLs, and compatibility messages unless the text appears in the shipped desktop identity path changed by this packet.

## Updater Inertness Boundary

The private local baseline must not contact or offer to install upstream OpenPencil releases.

Required bounded changes:

1. Remove the startup updater import/call from `App/src/App.vue` while preserving global error-handler and theme setup.
2. Remove the macOS-only `Check for Updates…` item from `App/desktop/src/menu.rs` while changing its retained application/About labels to `OpenPotlood`; do not claim this item currently appears on Windows.
3. Set `bundle.createUpdaterArtifacts` to `false` in `App/desktop/tauri.conf.json`.

Leave `App/src/app/shell/updater.ts`, `App/src/app/shell/menu/use.ts`, the updater plugin dependency/registration, endpoint/pubkey config, signing files, and update translations untouched as inert upstream archaeology. Do not delete or redesign updater infrastructure in this packet. The focused identity test must prove there is no startup call, no macOS-only update menu item, and no updater artefact creation; Windows runtime inertness is established by the absent startup call plus installed observation, not by pretending the macOS menu was a Windows surface.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Plan/Packets/T-001-fresh-source-capability-and-toolchain-audit.md`
- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- `Toolbox/RESOURCE_MANIFEST.md`
- `App/AGENTS.md`
- `App/package.json`
- `App/bun.lock` root workspace record only
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`
- the `open_pencil` entry in `App/desktop/Cargo.lock`
- `App/index.html`
- `App/src/App.vue`
- `App/vite/pwa.ts`
- `App/desktop/src/menu.rs`
- `App/desktop/src/lib.rs`
- `App/src/app/shell/updater.ts`
- `App/src/app/shell/menu/schema.ts`
- `App/src/app/shell/menu/use.ts`
- `App/desktop/generated/menu.json`
- `App/tests/helpers/paths.ts`
- `App/playwright.config.ts`
- `App/tests/engine/app/` and `App/tests/e2e/app/` conventions

## Required Inputs

- T-001 task status `DONE` with packet state `VERIFIED` and fresh report evidence.
- Explicit approval of the exact Tauri identifier.
- Bun, Rust/MSVC, and Tauri toolchain confirmed by T-001.
- Permission already granted by project scope to build, install, launch, and verify this local application.
- No running or installed OpenPotlood instance that would be overwritten without first identifying it and obtaining confirmation.

## Allowed Changes

- `App/package.json`
- root workspace identity record only in `App/bun.lock`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`
- the local `open_pencil` package version entry only in `App/desktop/Cargo.lock`
- `App/index.html`
- `App/src/App.vue`
- `App/vite/pwa.ts`
- `App/desktop/src/menu.rs`
- `App/tests/engine/app/identity.test.ts`
- `App/tests/e2e/app/identity.spec.ts`
- dependency installation under `App/node_modules/` only through `bun install --frozen-lockfile`; the pre-edit `App/bun.lock` hash must remain unchanged by installation
- normal Tauri/Vite build output below ignored/generated build directories
- this packet’s execution report plus normal pipeline state/evidence fields

Any additional source file requires a `STALE PACKET` stop and audit amendment before editing.

## Restrictions and Exclusions

- No Git initialisation, worktree, branch, commit, tag, pull request, push, release, publishing, deployment, updater signing, signing-key access, credentials, or remote service changes.
- Do not run scripts under `Toolbox/` or treat previous-project artefacts as current proof.
- Do not run `bun install` without `--frozen-lockfile`, change dependency ranges, upgrade packages, or accept a lockfile mutation as setup.
- Do not mass-replace `OpenPencil`, `open-pencil`, `open_pencil`, or version `0.13.2`.
- Do not change any publishable workspace package name/version or regenerate package publication artefacts.
- Do not change document/clipboard formats, package imports, public SDK names, CLI/MCP command names, automation globals, local-storage keys, or file extensions/MIME types.
- Do not update README/docs/changelog/licence/public website text as part of this desktop baseline.
- Do not replace icons or claim custom visual branding without supplied approved assets.
- Do not build MSI, macOS, Linux, updater, signature, or release artefacts. Build one Windows x64 NSIS installer only.
- Do not uninstall, stop, overwrite, inspect as evidence, or otherwise disturb existing OpenPencil/OpenPencil Studio installations.
- Do not use a web/package build alone as delivery proof.
- Do not increment beyond `0.1.0`; later packets own future SemVer changes only after completed installed updates.

## Implementation Steps

### 1. Reconcile and claim

1. Read all **Read First** files and confirm T-001 is `DONE`/`VERIFIED` and `Toolbox/Project-History/reports/T-001-fresh-source-audit.md` exists.
2. Recalculate the app digest using `Toolbox/RESOURCE_MANIFEST.md` and compare all identity-source hashes in **Verified Research and Existing Patterns** with the live files. If the digest, identity, updater/menu seam, package map, or test convention differs from T-001 and this packet, stop as `STALE PACKET`; do not merge assumptions.
3. Confirm the approved Tauri identifier exactly. If absent, stop before source edits.
4. Run `Test-Path (Join-Path $env:LOCALAPPDATA 'OpenPotlood')` and `Get-Process -Name OpenPotlood -ErrorAction SilentlyContinue`. Expect `False` and no process before first installation. If either check finds an existing OpenPotlood installation/process, record its executable path/version and stop for explicit replacement approval. Do not confuse it with OpenPencil or OpenPencil Studio.
5. Claim only T-002 through the pipeline and reread the saved task/packet state.

### 2. Add tests before identity edits

6. From `App/`, record `(Get-FileHash -Algorithm SHA256 -LiteralPath bun.lock).Hash`, run `bun install --frozen-lockfile`, require exit code `0`, then hash `bun.lock` again and require exact equality. Stop on unavailable registry/network/cache, package-resolution failure, lifecycle-script failure, or any lock change; do not run an unfrozen install or upgrade packages.
7. Add `App/tests/engine/app/identity.test.ts` with `bun:test`, `repoPath()` from `#tests/helpers/paths`, `Bun.file(...).text()`, and JSON parsing where the file is JSON. Group assertions by root/Bun identity, Tauri/Rust identity, visible identity, updater inertness, and protected compatibility.
8. In that test, assert the exact target values from **Identity Boundary**; select only the `[[package]]` block whose name is `open_pencil` in `Cargo.lock`; assert the exact package-version map recorded above; preserve `.fig` and `.pen` extension/MIME values; prove `App.vue` has neither updater import nor startup call; prove `menu.rs` has no `check-updates`/Check-for-Updates text but retains the macOS `OpenPotlood`/`About OpenPotlood` strings; prove `createUpdaterArtifacts` is `false`; and prove `desktop/src/lib.rs`, updater config, and `App/src/app/shell/updater.ts` remain present. Do not reject unrelated dependency version `0.13.2` values or internal `OpenPencil` compatibility text elsewhere.
9. Add `App/tests/e2e/app/identity.spec.ts` using the existing Playwright convention. Open `/`, require `await expect(page).toHaveTitle('OpenPotlood')`, and separately require the actual title not to contain `OpenPencil`. Do not demand that `window.openPencil`, the Playwright project name, or internal DOM/test APIs be renamed.
10. Run `bun test ./tests/engine/app/identity.test.ts` before identity edits and record failures for the intended old values. If it passes before implementation, or fails for missing dependencies/files rather than identity assertions, stop and repair the test/setup without changing product code.

### 3. Apply the bounded identity

11. Change only the files and exact values in **Allowed Changes** and **Identity Boundary**.
12. Keep the three version sources synchronised at `0.1.0`: root `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml`; mirror only the local Cargo lock entry.
13. Keep internal package/library/API/protocol names intact. Review every changed occurrence individually; do not run global replacement.
14. Make updater behaviour inert only through the three bounded changes in **Updater Inertness Boundary**.
15. Run the focused engine identity test and E2E identity test. Record exact pass/fail counts.

### 4. Quality and build gates

16. Run `bun run check`. Stop on any error. Existing warnings may be recorded only if they do not hide a failure and were present before this packet.
17. Run `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc`. Stop on any Rust/config error.
18. Record `$buildStart = (Get-Date).ToUniversalTime()`, then run `bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis` from `App/`.
19. Select exactly one installer written at or after `$buildStart` under `App/desktop/target/x86_64-pc-windows-msvc/release/bundle/nsis/` whose name begins `OpenPotlood`, contains `0.1.0`, and ends `_x64-setup.exe`. Require `App/desktop/target/x86_64-pc-windows-msvc/release/OpenPotlood.exe` too. If none or more than one installer qualifies, stop; do not guess among stale artefacts.
20. Record installer absolute path, byte size, creation/write time, and SHA-256. List every bundle file written after `$buildStart`; require the NSIS installer only and no newly written MSI, `.sig`, updater archive, or release manifest.

### 5. Install and prove the exact desktop result

21. Hash the selected installer immediately before install and require equality with step 20. Retain that versioned installer at its generated absolute path as the rollback/reinstall copy; do not clean or overwrite it before T-003 has a verified replacement.
22. Run that exact NSIS installer silently with uppercase `/S` using `Start-Process -Wait -PassThru`; require exit code `0`.
23. Set `$installedExe = Join-Path $env:LOCALAPPDATA 'OpenPotlood\OpenPotlood.exe'` and require `Test-Path -LiteralPath $installedExe` to return `True`. Require one exact file at that path; do not fall back to any `OpenPencil.exe` or search other product folders for a convenient match.
24. Record installed executable absolute path, byte size, SHA-256, `VersionInfo.ProductName`, `FileVersion`, `ProductVersion`, `OriginalFilename`, and `FileDescription`. Require product/file description `OpenPotlood`, version `0.1.0` (allow Windows' equivalent fourth zero only if recorded), and `OpenPotlood.exe` for the installed filename and `OriginalFilename` where populated.
25. Launch that exact executable with `$launched = Start-Process -FilePath $installedExe -PassThru`. Do not launch by Start-menu search, PATH, filename-only lookup, or an old shortcut.
26. Refresh `Get-Process -Id $launched.Id`; require its `Path` to equal `(Resolve-Path $installedExe).Path`, `Responding=True`, a non-zero `MainWindowHandle`, and `MainWindowTitle` containing `OpenPotlood` and not `OpenPencil`.
27. Wait only for normal startup using a bounded polling loop of at most 30 seconds, then wait a further five seconds and repeat the exact path/responsiveness/handle/title check. Stop if the process exits, hangs, resolves elsewhere, or never opens a main window.
28. Confirm the existing `%LOCALAPPDATA%\OpenPencil` and `%LOCALAPPDATA%\OpenPencil Studio` paths still exist at the same recorded path/presence level; do not hash or inspect their contents as task evidence.

### 6. Close without starting T-003

29. Rerun the focused engine identity test after installation. This is a source/config regression check; installed proof remains the metadata/process evidence above.
30. Append the execution report with exact commands, outputs, hashes, paths, versions, process evidence, and any warnings.
31. Update pipeline state only after all acceptance criteria pass. Stop after the receipt. Do not expand, claim, or execute T-003 in the same session.

## Acceptance Criteria

- [ ] T-001 was `DONE`/`VERIFIED`, its evidence was reconciled, and the exact Tauri identifier was explicitly approved before edits.
- [ ] `bun install --frozen-lockfile` restored usable dependencies with exit code `0` and did not alter the pre-edit `bun.lock` hash; no dependency upgrade or unfrozen install occurred.
- [ ] Only authorised identity/test files changed; no resource, Git, release, credential, external, or existing-install state changed.
- [ ] `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` all report exactly `0.1.0`.
- [ ] Root private package name is `openpotlood-app`; only its root Bun lock identity mirrors that change.
- [ ] Tauri product name/title is `OpenPotlood`, the identifier is the approved unique value, and the `.pen` association label is OpenPotlood-specific.
- [ ] Rust binary name is `OpenPotlood`; internal `open_pencil` package and `open_pencil_lib` library names remain unchanged.
- [ ] Webview/browser title, PWA name/short name, installer, installed metadata, executable, and running window use `OpenPotlood`; retained macOS-only application/About labels also use `OpenPotlood`, without adding an invented Windows About surface.
- [ ] Updater artefact creation and startup update checking are disabled/absent; the macOS-only Check-for-Updates item is removed; Windows shared/generated menus still contain no update item; updater archaeology remains otherwise untouched.
- [ ] All protected internal package/API/protocol/format names and publishable workspace package versions remain unchanged.
- [ ] Existing icon assets are preserved and no custom OpenPotlood artwork is claimed.
- [ ] Focused engine and E2E identity tests pass; `bun run check` and targeted Windows Rust check pass.
- [ ] Exactly one fresh x64 NSIS installer is selected and its path, size, timestamp, and SHA-256 are recorded.
- [ ] The recorded post-build bundle listing contains no fresh MSI, updater archive, signature, or release manifest.
- [ ] Silent install exits `0`; installed executable is exactly `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe` or a Tauri-generated path proven to be the new OpenPotlood install.
- [ ] Installed metadata reports `OpenPotlood` and `0.1.0`; launched process path matches that executable, has a non-zero window handle/title, and remains responsive on the repeated check.
- [ ] OpenPencil and OpenPencil Studio installations are not overwritten or used as evidence.
- [ ] The retained versioned installer remains at its recorded generated path as a local reinstall/rollback artefact, its SHA-256 is in the receipt, and it is not cleaned or overwritten before a verified replacement exists.

## Verification

Run from `App/` unless stated otherwise:

1. Restore locked dependencies before tests:

   ```powershell
   $lockBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath bun.lock).Hash
   bun install --frozen-lockfile
   if ($LASTEXITCODE -ne 0) { throw "bun install failed with exit code $LASTEXITCODE" }
   $lockAfter = (Get-FileHash -Algorithm SHA256 -LiteralPath bun.lock).Hash
   if ($lockAfter -ne $lockBefore) { throw "bun.lock changed during frozen install" }
   ```

   Expect exit code `0`, a usable `node_modules`, and equal before/after hashes.

2. Run `bun test ./tests/engine/app/identity.test.ts`; expect exit code `0` and every identity/boundary test to pass. Record Bun's exact pass/fail count.
3. Run `bunx playwright test tests/e2e/app/identity.spec.ts --project=openpencil`; expect exit code `0` and the title test to pass. Record Playwright's exact count.
4. Run `bun run check`; expect exit code `0`. Record warnings separately and stop on any error or timeout.
5. Run `cargo check --manifest-path desktop/Cargo.toml --target x86_64-pc-windows-msvc`; expect exit code `0`.
6. Build and resolve one fresh installer:

   ```powershell
   $buildStart = (Get-Date).ToUniversalTime()
   bunx tauri build --target x86_64-pc-windows-msvc --bundles nsis
   if ($LASTEXITCODE -ne 0) { throw "Tauri build failed with exit code $LASTEXITCODE" }
   $releaseExe = Resolve-Path 'desktop/target/x86_64-pc-windows-msvc/release/OpenPotlood.exe'
   $bundleRoot = Resolve-Path 'desktop/target/x86_64-pc-windows-msvc/release/bundle'
   $installer = @(Get-ChildItem -LiteralPath (Join-Path $bundleRoot 'nsis') -File | Where-Object {
     $_.LastWriteTimeUtc -ge $buildStart -and
     $_.Name -like 'OpenPotlood*0.1.0*_x64-setup.exe'
   })
   if ($installer.Count -ne 1) { throw "Expected one fresh OpenPotlood 0.1.0 NSIS installer; found $($installer.Count)" }
   $freshBundleFiles = @(Get-ChildItem -LiteralPath $bundleRoot -Recurse -File | Where-Object { $_.LastWriteTimeUtc -ge $buildStart })
   $unexpected = @($freshBundleFiles | Where-Object { $_.FullName -ne $installer[0].FullName })
   if ($unexpected.Count -ne 0) { throw "Unexpected fresh bundle artefacts: $($unexpected.FullName -join ', ')" }
   ```

   Expect one release executable and exactly one newly written bundle file: the NSIS installer. Stale files older than `$buildStart` are not evidence and are not deleted.

7. Record and recheck the installer:

   ```powershell
   $installerItem = Get-Item -LiteralPath $installer[0].FullName
   $installerHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installerItem.FullName).Hash
   $installerItem | Select-Object FullName, Length, CreationTimeUtc, LastWriteTimeUtc
   $installerHash
   $preInstallHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installerItem.FullName).Hash
   if ($preInstallHash -ne $installerHash) { throw 'Installer hash changed before install' }
   ```

   Expect non-zero size and equal SHA-256 values.

8. Install the exact file and resolve the exact executable:

   ```powershell
   $installProcess = Start-Process -FilePath $installerItem.FullName -ArgumentList '/S' -Wait -PassThru
   if ($installProcess.ExitCode -ne 0) { throw "Installer exit code $($installProcess.ExitCode)" }
   $installedExe = Join-Path $env:LOCALAPPDATA 'OpenPotlood\OpenPotlood.exe'
   if (-not (Test-Path -LiteralPath $installedExe -PathType Leaf)) { throw "Installed executable missing: $installedExe" }
   $installedItem = Get-Item -LiteralPath $installedExe
   $installedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installedExe).Hash
   $installedItem | Select-Object FullName, Length
   $installedHash
   $installedItem.VersionInfo | Select-Object ProductName, FileVersion, ProductVersion, OriginalFilename, FileDescription
   ```

   Expect installer exit `0`, exact path `%LOCALAPPDATA%\OpenPotlood\OpenPotlood.exe`, non-zero size/hash, OpenPotlood metadata, and version `0.1.0` (or recorded Windows-equivalent `0.1.0.0`).

9. Launch and prove the process twice:

   ```powershell
   $resolvedInstalledExe = (Resolve-Path -LiteralPath $installedExe).Path
   $launched = Start-Process -FilePath $resolvedInstalledExe -PassThru
   $deadline = (Get-Date).AddSeconds(30)
   do {
     Start-Sleep -Milliseconds 500
     $running = Get-Process -Id $launched.Id -ErrorAction SilentlyContinue
     if ($running) { $running.Refresh() }
   } until (-not $running -or $running.MainWindowHandle -ne 0 -or (Get-Date) -ge $deadline)
   if (-not $running) { throw 'OpenPotlood exited during startup' }
   $first = $running | Select-Object Id, Path, Responding, MainWindowHandle, MainWindowTitle
   $first
   if ($running.Path -ne $resolvedInstalledExe -or -not $running.Responding -or $running.MainWindowHandle -eq 0 -or $running.MainWindowTitle -notlike '*OpenPotlood*' -or $running.MainWindowTitle -like '*OpenPencil*') { throw 'First installed-process identity check failed' }
   Start-Sleep -Seconds 5
   $running = Get-Process -Id $launched.Id -ErrorAction Stop
   $running.Refresh()
   $second = $running | Select-Object Id, Path, Responding, MainWindowHandle, MainWindowTitle
   $second
   if ($running.Path -ne $resolvedInstalledExe -or -not $running.Responding -or $running.MainWindowHandle -eq 0 -or $running.MainWindowTitle -notlike '*OpenPotlood*' -or $running.MainWindowTitle -like '*OpenPencil*') { throw 'Second installed-process identity check failed' }
   ```

   Expect the same PID/path, `Responding=True`, non-zero handle, and OpenPotlood-only title in both records.

10. After the proposed identifier is approved, run `rg -n -e '"version": "0.1.0"' -e '"productName": "OpenPotlood"' -e '"identifier": "com.dayle22.openpotlood"' -e 'name = "OpenPotlood"' -e 'version = "0.1.0"' package.json desktop/tauri.conf.json desktop/Cargo.toml`; expect the intended root/Tauri/Cargo matches only. The focused identity test is authoritative for the bounded Cargo lock and protected-package checks. If the proposal was declined, the audit role must replace this exact command value with the newly approved identifier before READY promotion.
11. From the project root, run `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`; expect `[PASS] Project pipeline is structurally consistent.` Record the result but do not mark T-002 `DONE` or start T-003.

Record actual output rather than replacing it with “passed”. No executor-selected substitution or invented identifier is permitted.

## Integration or Installed-Result Check

Mandatory and indivisible: focused tests → quality/Rust checks → one fresh x64 NSIS build → installer hash → silent install → exact installed-path/metadata/hash read-back → exact-path launch → repeated title/responsiveness check.

A Vite build, successful Tauri compilation, installer existence, process name alone, or old installed OpenPencil/OpenPencil Studio instance does not satisfy this task.

## Stop Conditions

- Stop before edits if T-001 is not `DONE`/`VERIFIED`, its digest/evidence is stale, or the bundle identifier is not explicitly approved.
- Stop if an OpenPotlood installation/process already exists and replacement was not explicitly approved.
- Stop if implementation requires a file outside **Allowed Changes**, a mass replacement, publishable workspace version change, package/API/protocol rename, icon invention, format change, updater redesign, signing, release, Git, credential, or remote action.
- Stop on frozen dependency-install failure, `bun.lock` mutation during setup, missing required dependencies after setup, failed focused test, `bun run check`, Rust check, Tauri build, ambiguous/stale installer selection, unexpected updater/MSI artefact requirement, or missing NSIS output.
- Stop on installer hash change, non-zero install exit, unexpected install path, missing executable, metadata/version/name mismatch, launch failure, path mismatch, zero window handle, wrong title, process exit, or unresponsive process.
- Stop if OpenPencil or OpenPencil Studio would be overwritten, removed, stopped, or confused with the new app.
- On any stop, preserve the last good evidence and installer if present, record the exact blocker and safe re-entry action, and do not start T-003.

## Execution Report Contract

Report:

- result: `DONE`, `BLOCKED`, or `STALE PACKET`;
- approved Tauri identifier and approval source;
- opening source digest/version/identity and whether T-001 matched;
- dependency-install command, exit code, and equal before/after frozen-lock hashes;
- every file changed and why;
- protected internal boundaries checked and unchanged;
- focused test, E2E, quality, Rust, and Tauri build commands with exit codes/counts;
- installer absolute path, size, timestamp, SHA-256, and fresh-selection evidence;
- silent install exit code;
- installed executable path, size, SHA-256, product/file version metadata, process ID/path, main-window title/handle, and both responsiveness checks;
- updater inertness evidence and confirmation that no updater/release/signing artefact or external state was used;
- confirmation that existing OpenPencil/OpenPencil Studio installs were not modified;
- deviations, warnings, mess or concerns, retained rollback artefact, and one exact next action.

Do not write “installed and verified” without the recorded hash, metadata, path, process, title, and responsiveness evidence.

## Status record

Status: **Done**
