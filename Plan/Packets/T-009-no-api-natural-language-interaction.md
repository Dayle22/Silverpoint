# T-009 — Deliver no-API natural-language interaction

Task ID: T-009
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-008
Amended: 2026-07-20
Amendment authority: the user explicitly replaced the bundled Codex ACP/per-call permission design with a globally installed Codex CLI route modelled on the inspected Open Design `0.7.0` installation.

### 2026-07-23 stdin EOF amendment

Installed `0.6.4` evidence proved that `@tauri-apps/plugin-shell` can write prompt
bytes but cannot close a spawned child's stdin. Codex therefore remains at
`Reading prompt from stdin...` and never starts the turn. The current official
plugin implementation exposes only `stdin_write` and `kill`; it has no stdin
close command.

Keep the version and login-status probes in the narrow shell scopes. Replace
only the chat execution scope with a narrow native Tauri command that resolves
the same fixed global npm `codex.exe`, computes the app-local AI workspace,
uses the packet's fixed arguments/environment, writes the prompt through a
piped stdin and drops that handle to deliver EOF, streams bounded
stdout/stderr events, and exposes cancellation only for children it owns.
This amendment does not permit prompt argv delivery, arbitrary commands or
arguments, credential-file access, global configuration writes, or a bundled
Codex binary.

## Amendment Summary

This amendment supersedes the prior Codex ACP route and its recovery plan. Historical ACP implementation and test evidence remain valid history in `Toolbox/Project-History/PROJECT_LOG.md` and the T-009 report, but they are not completion evidence for the amended result.

The amended route keeps the already-built authenticated OpenPotlood MCP sidecar and dedicated app-local AI workspace. It removes the bundled Codex ACP executable and launches the user's globally installed, ChatGPT-authenticated Codex CLI directly with `codex exec --json`, `workspace-write`, network access, and prompts over stdin. It does not show a permission dialog before each design mutation. Selecting the Codex provider is the user's session-level authority for Codex to use the exposed OpenPotlood tools.

The original `0.6.0` source version was subsequently advanced to `0.6.1` by the separately completed T-027 slice and to `0.6.2` for this verified transport fix. Use the live `0.6.2` triplet; do not downgrade it or make another version-only change.

## Request Coverage

- Provide installed OpenPotlood chat through the user's existing Codex/ChatGPT sign-in with no manually entered OpenAI API key.
- Require a globally installed npm Codex CLI on this private Windows machine. Do not bundle, copy, install, update, or read credentials from Codex.
- Launch the native npm Codex executable directly through a narrowly scoped Tauri shell command; do not run the `codex.ps1` or `codex.cmd` shims and do not invoke PowerShell or `cmd.exe`.
- Run Codex non-interactively with structured JSONL output, prompts through stdin, an app-local workspace, `workspace-write`, and network access required for authenticated loopback MCP.
- Keep the bundled OpenPotlood MCP HTTP sidecar, per-launch bearer token, loopback binding, restricted CORS, root scoping, closed-world tool list, and `eval`/`stock_photo` exclusion.
- Let Codex read and mutate the active document without per-tool approval clicks. Preserve explicit document/page targets, normal undo entries, result/error rendering, active-tab safety, cancellation, and child cleanup.
- Preserve direct API-key providers as optional existing routes.
- Deliver only after focused tests, a complete source gate, fresh NSIS build/install, and real installed-app Codex interaction prove read, automatic mutation, undo/redo, correct tab targeting, persistence, failure handling, and cleanup.

## User-Visible Outcome

In installed OpenPotlood, the user chooses **Codex CLI (ChatGPT sign-in)**. The setup view reports whether the global Codex CLI is found and signed in and clearly states: **Codex can edit the active document automatically while this provider is selected.** No API-key field or per-mutation permission dialog is shown.

A request such as “describe the selected frame” returns a grounded answer. A request such as “change the selected rectangle to red” runs through the authenticated local MCP bridge, updates the intended active document/page, renders the tool activity and result in chat, flashes the affected node, and creates the normal undoable editor mutation. Switching documents must not redirect an in-flight tool call to an unintended tab.

## Verified Starting State

- T-008 is DONE/VERIFIED. The live source version triplet is `0.6.2`, advanced by T-027 and this verified transport fix; the original T-009 `0.6.0` and intermediate `0.6.1` installer evidence remain historical only.
- `codex --version` returns `codex-cli 0.144.0`; `codex login status` reports ChatGPT authentication without reading an auth file.
- The npm native executable exists at `$APPDATA/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe` and returns `codex-cli 0.144.0` when executed directly.
- Local CLI help confirms `codex exec --json`, stdin prompt input when no prompt argument is supplied, `--sandbox workspace-write`, `--ephemeral`, `--ignore-user-config`, `--ignore-rules`, `--strict-config`, `--skip-git-repo-check`, `-C`, and top-level `--ask-for-approval never`.
- A read-only config probe confirmed per-invocation MCP overrides accept `mcp_servers.openpotlood.url` and `mcp_servers.openpotlood.bearer_token_env_var` without changing global Codex configuration.
- Installed Open Design `0.7.0` proves the useful direct-CLI pattern: resolved Codex executable, `exec --json`, `workspace-write`, network access, stdin prompt delivery, structured event parsing, watchdogs, and child cleanup.
- OpenPotlood already has a deterministic bundled MCP sidecar, authenticated loopback transport, app-local AI workspace, target-aware tool calls, tool result UI, and verified token non-disclosure.
- The superseded ACP implementation, dependency, binary, permission queue/dialog, and tests are still present and must be deliberately removed or replaced.

## Decisions Fixed by This Packet

1. The no-key provider ID becomes `codex-cli`; its label is **Codex CLI (ChatGPT sign-in)**. Do not retain an `acp:*` alias or silently migrate it to an API-key provider.
2. The supported executable is the native Windows x64 binary inside the globally installed npm `@openai/codex` package. This private build does not promise arbitrary npm prefixes, Windows Store aliases, WSL, or `.cmd`/`.ps1` shims.
3. Define three narrow Tauri shell entries against the fixed `$APPDATA/npm/.../codex.exe` path: version, login status, and chat execution. Each entry has an exact argument allow-list; no `args: true`, wildcard command, PowerShell, or `cmd.exe` is allowed.
4. The chat invocation is equivalent to:

   ```text
   codex --ask-for-approval never exec
     --json
     --color never
     --skip-git-repo-check
     --sandbox workspace-write
     --ephemeral
     --ignore-user-config
     --ignore-rules
     --strict-config
     -C <OpenPotlood app-local ai-workspace>
     -c sandbox_workspace_write.network_access=true
     -c mcp_servers.openpotlood.url="http://127.0.0.1:7600/mcp"
     -c mcp_servers.openpotlood.bearer_token_env_var="OPENPOTLOOD_MCP_AUTH_TOKEN"
   ```

   Supply the composed system/user prompt through stdin without a `-` sentinel. Supply the bearer token only through the child environment. Never put the prompt or token in argv, logs, UI, storage, reports, screenshots, or global Codex config.
5. Use one fresh ephemeral Codex process per submitted chat turn. Compose the shared system prompt plus the bounded visible conversation history so continuity does not depend on persisted Codex threads.
6. Keep `%LOCALAPPDATA%/com.dayle22.openpotlood/ai-workspace` as both Codex `-C` and `OPENPENCIL_MCP_ROOT`. Do not add the home, source, document, Desktop, or arbitrary directories through `--add-dir`.
7. Selecting the Codex provider authorises automatic use of the exposed MCP tools for that session. Remove the ACP permission queue/dialog and its browser test hook. Do not replace it with repeated approvals.
8. Preserve server-side targeting: mutating calls must contain non-empty `document_id` and `page_id`; reject missing, stale, mismatched, or background targets before editor mutation. Permissionless does not mean targetless.
9. Keep ordinary undo semantics. Each successful tool mutation creates only its normal undo entry; failed or rejected target checks create none.
10. Keep `eval` and `stock_photo` absent. Do not expose shell, arbitrary filesystem, arbitrary HTTP, package installation, or general code-evaluation tools through OpenPotlood MCP.
11. Keep the bundled MCP sidecar only. Remove the Codex ACP dependency, copied binary, build step, Tauri external-bin entry, and sidecar permission.
12. Parse Codex JSONL defensively. Render agent messages, command/MCP tool starts and completions, usage, explicit errors, `turn.failed`, and non-zero exits. Unknown valid events may be ignored or recorded only in a bounded development log; never dump full production streams.
13. Add a first-output timeout, inactivity watchdog, abort path, normal-exit cleanup, forced-kill fallback, and empty-success guard. Only one Codex child may serve a chat turn.
14. `codex login status` proves authentication, not allowance. On quota/rate-limit responses, show the actual concise error and do not retry automatically.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/Project-History/reports/T-009-no-api-natural-language-interaction.md`
- `App/AGENTS.md`
- `App/packages/core/src/constants.ts`
- `App/src/app/ai/chat/storage.ts`
- `App/src/app/ai/chat/transports.ts`
- `App/src/app/ai/chat/system-prompt.md`
- `App/src/app/ai/acp/**`
- `App/src/app/automation/mcp/spawn.ts`
- `App/src/app/automation/bridge/server.ts`
- `App/src/app/automation/bridge/tool-handlers.ts`
- `App/src/components/ChatPanel.vue`
- `App/src/components/chat/ProviderSetup.vue`
- `App/src/components/chat/ProviderSelect/ProviderSelect.vue`
- `App/src/components/chat/ChatMessage.vue` and live tool-result children
- `App/src/app/browser-bridge.ts`
- `App/desktop/capabilities/default.json`
- `App/desktop/tauri.conf.json`
- New `App/desktop/src/codex.rs`
- `App/desktop/src/lib.rs` only to register and clean up the bounded Codex commands
- `App/tools/windows-sidecars/src/build.ts`
- Existing T-009 ACP, MCP, Tauri, and chat tests before replacing them
- Installed Open Design reference files under `C:/Users/User/AppData/Local/Programs/Open Design release-stable-win/Toolbox/app/node_modules/@open-design/daemon/dist/`, especially `runtimes/defs/codex.js` and `json-event-stream.js`; inspect only, never execute or copy wholesale

## Allowed Changes

Production/configuration paths:

- `App/packages/core/src/constants.ts`
- `App/src/app/ai/chat/storage.ts`
- `App/src/app/ai/chat/transports.ts`
- `App/src/app/ai/chat/system-prompt.md`
- `App/src/app/ai/acp/**` — delete superseded files after replacements pass focused tests
- New `App/src/app/ai/codex/transport.ts`
- New `App/src/app/ai/codex/process.ts`
- New `App/src/app/ai/codex/events.ts`
- New `App/src/app/ai/codex/workspace.ts`, replacing the ACP-named workspace module
- `App/src/components/ChatPanel.vue`
- `App/src/components/chat/ChatInput.vue`
- `App/src/components/chat/ProviderSetup.vue`
- `App/src/components/chat/ProviderSelect/ProviderSelect.vue`
- `App/src/components/chat/AcpPermissionDialog.vue` — delete
- `App/src/app/browser-bridge.ts` — remove only the ACP permission fixture
- `App/src/app/automation/mcp/spawn.ts`
- `App/src/app/automation/bridge/tool-handlers.ts` only if a failing target-lock test proves a gap
- `App/desktop/capabilities/default.json`
- `App/desktop/tauri.conf.json`
- `App/tools/windows-sidecars/src/build.ts`
- `App/scripts/build-windows-sidecars.ts` only if its two-line shim name must remain compatible
- `App/package.json` and `App/bun.lock` only to remove ACP dependencies and reconcile scripts
- English AI-chat documentation and `App/CHANGELOG.md`

Focused tests may be deleted/renamed/replaced only where they describe the retired ACP route:

- `App/tests/engine/acp/**`
- `App/tests/engine/tauri/acp-transport.test.ts`
- `App/tests/e2e/chat/acp-permission.spec.ts`
- New `App/tests/engine/codex/events.test.ts`
- New `App/tests/engine/codex/process.test.ts`
- New `App/tests/engine/codex/workspace.test.ts`
- New `App/tests/engine/tauri/codex-transport.test.ts`
- New `App/tests/e2e/chat/codex-cli.spec.ts`
- Existing MCP tests only for target lock, bearer handling, tool exclusions, or single-child cleanup

Generated binary removal is authorised for `App/desktop/binaries/openpotlood-codex-acp-x86_64-pc-windows-msvc.exe`. Preserve and rebuild `openpotlood-mcp-x86_64-pc-windows-msvc.exe`.

Do not change any other path without recording a packet amendment first.

## Restrictions and Exclusions

- Do not implement any application feature outside T-009 or start T-010 in the same active slice.
- Do not bundle Codex, retain Codex ACP as a fallback, auto-install/update Codex, invoke global shims, or read/copy `~/.codex/auth.json`.
- Do not modify the user's global Codex config, MCP list, plugins, skills, rules, sessions, or environment permanently.
- Do not use `danger-full-access`, `--add-dir`, arbitrary executable paths, `args: true`, PowerShell, `cmd.exe`, npm/npx at runtime, or an unrestricted Tauri shell scope.
- Do not restore per-tool approval UI. The required safety boundary is app-local workspace + sandbox + authenticated restricted MCP + exact document/page targeting.
- Do not disclose the bearer token through `/health`, console output, Codex events, chat, errors, reports, screenshots, or process listings.
- Do not claim `workspace-write` restricts MCP document mutations; MCP access is separately bounded by its registered tools and target validation.
- Do not claim offline inference, unlimited use, bundled Codex, cross-platform support, or support for every global installation method.
- Do not change the current `0.6.2` version unless a separate verified version discrepancy requires an explicit amendment.

## Implementation Steps

1. Claim T-009 as the sole active task and append a receipt. Re-read this packet and verify T-008, the `0.6.2` triplet, the npm native Codex executable, ChatGPT login status, and the current MCP sidecar hash/health.
2. Add red tests for the new provider ID, global native executable path, exact scoped arguments, stdin-only prompts, token environment, app-local `-C`, JSONL parsing, cancellation, watchdogs, empty output, target mismatch, and absence of ACP UI/dependencies/binary.
3. Introduce the `ai/codex` workspace, process, event, and transport modules. Keep transport integration behind the existing `ChatTransport<UIMessage>` contract.
4. Configure narrow Tauri shell entries for version and login probes, plus a native chat command with no executable or argument input. Prove the probes cannot accept extra arguments and the native command computes the fixed invocation and app-local workspace itself.
5. Spawn the native npm `codex.exe` directly from the bounded native command. Pass only fixed args, the computed workspace, and the in-memory MCP token environment. Write the composed prompt to piped stdin, flush it, and drop the stdin handle to deliver EOF.
6. Parse newline-delimited JSON incrementally across split chunks. Map supported Codex events into existing chat chunks and tool/result UI. Bound stderr/error text and redact token-shaped or environment values before rendering.
7. Add per-turn child ownership, abort, first-output timeout, inactivity timeout, graceful kill, forced-kill fallback, listener removal, and no-orphan assertions.
8. Update provider storage/setup/select/input copy. Remove ACP naming and the permission dialog. Add the concise automatic-edit disclosure.
9. Preserve the MCP sidecar and workspace/token fixes. Add or retain focused tests proving exact `eval`/`stock_photo` absence, bearer rejection, token-free health, non-empty document/page targets, mismatched-target rejection, and no undo on rejected calls.
10. Remove `@agentclientprotocol/sdk`, both `@zed-industries/codex-acp*` dependencies, ACP-only source/tests/browser hook, the ACP binary build/copy path, its `externalBin`, and its sidecar capability. Regenerate the lockfile through normal Bun install; do not hand-edit resolved package entries.
11. Build the MCP sidecar twice and prove deterministic SHA-256, standalone health/auth/tool-list behaviour, root scoping, and cleanup. The builder must print only the MCP output hash.
12. Run the focused tests, chat E2E, `bun run check`, `bun run check:secrets`, the targeted source/binary scan, and Cargo check. Give the full check a bounded 10-minute wrapper and inspect/clean only proven T-009 child processes if it times out.
13. Verify the unchanged `0.6.2` triplet, build one fresh x64 NSIS installer, silently install with uppercase `/S`, and record installed executable and MCP sidecar paths/hashes/responsiveness.
14. Perform one installed acceptance session with a disposable two-tab document and at most five short prompts: selected-node description; automatic colour mutation; undo/redo; read after switching tabs; read after save/reopen/relaunch. Mechanically verify cancellation, unavailable CLI/login messaging, quota error handling where observable without retry, and child cleanup.
15. Update the T-009 report, PLAN, and PROJECT_LOG with exact evidence. Mark DONE/VERIFIED only if every acceptance item passes.

## Integration or Installed-Result Check

Mandatory. Use the exact installed `OpenPotlood.exe`, its packaged MCP sidecar, and the globally installed npm native Codex executable. Complete the packet's disposable two-tab, five-prompt maximum acceptance session and verify automatic mutation, undo/redo, tab targeting, save/reopen/relaunch persistence, installed identity/hash/responsiveness, unavailable/signed-out error handling, and absence of orphaned Codex/MCP children. Browser, fake-process, source, or development evidence cannot close T-009.

## Acceptance Criteria

- [ ] Installed OpenPotlood offers **Codex CLI (ChatGPT sign-in)** without an API-key field and clearly discloses automatic document editing.
- [ ] The app uses the globally installed npm native `codex.exe`; no Codex/ACP executable is bundled and no `.cmd`, `.ps1`, PowerShell, or `cmd.exe` route is used.
- [ ] Version and login probes and chat execution use narrow Tauri command scopes with no wildcard command or arbitrary arguments.
- [ ] Chat execution uses JSONL, stdin prompts, `workspace-write`, network access, approval `never`, ignored user config/rules, strict per-launch MCP config, ephemeral sessions, and the app-local AI workspace.
- [ ] Global Codex config, MCP registrations, auth files, plugins, rules, and persisted sessions remain unchanged.
- [ ] The bundled MCP sidecar requires its in-memory bearer token, binds loopback, exposes no token through health/output, excludes `eval`/`stock_photo`, and restricts file paths to the AI workspace.
- [ ] Read requests work and mutating requests run automatically without an ACP permission dialog.
- [ ] Mutations require stable document/page IDs, affect the intended active tab, render their tool/result state, flash affected nodes, and create normal undoable changes.
- [ ] Missing/stale/mismatched targets fail without mutation or undo state.
- [ ] Cancellation, timeout, process error, malformed JSONL, empty success, missing CLI, signed-out CLI, and quota errors produce concise visible failures and leave no child process.
- [ ] Source gates, Cargo, fresh NSIS build/install, installed identity/hash/responsiveness, real read/mutation/undo/tab/persistence checks, and pipeline validation pass.
- [ ] The installed application remains at `0.6.2` unless an explicitly amended version correction is required.

## Verification

Run from `App/` unless noted:

1. `bun test tests/engine/codex/events.test.ts tests/engine/codex/process.test.ts tests/engine/codex/workspace.test.ts tests/engine/tauri/codex-transport.test.ts`
2. `bun test tests/engine/mcp/server.test.ts tests/engine/mcp/tools.test.ts tests/engine/mcp/path-scoping.test.ts tests/engine/tauri/mcp-spawn.test.ts`
3. `bunx playwright test tests/e2e/chat/panel.spec.ts tests/e2e/chat/codex-cli.spec.ts --project=openpencil`
4. `bun scripts/build-windows-sidecars.ts` twice, then `Get-FileHash desktop\binaries\openpotlood-mcp-x86_64-pc-windows-msvc.exe -Algorithm SHA256`; hashes must match and no Codex ACP binary may remain.
5. Standalone MCP probe: health `200` without a token value; missing/wrong auth `401`; authenticated initialise/tools-list/delete success; exact `eval` and `stock_photo` absent; traversal rejected; child and ports cleaned.
6. `bun run check`
7. `bun run check:secrets`
8. Targeted scan must find no runtime `codex-acp`, ACP SDK, bundled Codex binary, permission dialog/hook, token value, `cmd.exe`, PowerShell, `args: true`, `danger-full-access`, or `--add-dir`. Classify documentation/history separately from runtime matches.
9. `cargo check --manifest-path desktop/Cargo.toml`
10. Confirm `package.json`, `desktop/tauri.conf.json`, and `desktop/Cargo.toml` all remain `0.6.2`.
11. Build one fresh NSIS installer, install it, verify installed metadata/path/hash/responsiveness, and inspect the installation for the MCP sidecar and absence of Codex ACP.
12. Complete the installed acceptance session and record redacted prompts, tool names, document/page IDs, before/after state, undo/redo, save/reopen/relaunch, Codex/MCP PIDs, exits, and cleanup.
13. From the project root: `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood`.

## Stop Conditions

- Stop if another implementation task is active, T-008 is not DONE/VERIFIED, or the `0.6.2` source triplet disagrees.
- Stop if the npm native Codex executable is absent, fails `--version`, is signed out, requires an API key/new purchase, or its current CLI no longer accepts the fixed invocation/MCP override.
- Stop if the route requires a global config write, auth-file read, shim/shell execution, wildcard Tauri permission, arbitrary path/argument, `danger-full-access`, or an additional writable directory.
- Stop if direct Codex cannot reach authenticated loopback MCP under `workspace-write`, or if enabling loopback also produces an unaccepted external-network risk.
- Stop if any tool can mutate without a stable matching document/page target, if a background tab is modified ambiguously, or if rejection creates undo state.
- Stop if a token, credential, private prompt, home path, or captured response body would be persisted or printed.
- Stop on repeated focused/full-check/Cargo/sidecar/build/install/installed-interaction failure. Record the exact blocker and do not start T-010.
- On quota/rate-limit output, do not retry; clean up, record the failure, and return T-009 to BLOCKED.

## Execution Report Contract

Update `Toolbox/Project-History/reports/T-009-no-api-natural-language-interaction.md` rather than replacing its historical ACP evidence. Add the amendment authority; retired ACP files/dependencies/binary; global Codex executable/version/login evidence; exact fixed invocation and Tauri scope; files changed with hashes; tests/commands/exits/counts; JSONL event coverage; MCP auth/target evidence; child lifecycle; source/build/install hashes; redacted installed prompts/tools/targets/before-after/undo/persistence proof; failures/deviations; usage and global-install limitations; and anything noticed along the way. Never include tokens, auth-file contents, private document content, or full captured process streams.

## Status record

Status: **Done**
