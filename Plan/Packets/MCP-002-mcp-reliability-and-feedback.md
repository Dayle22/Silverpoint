# MCP-002 - MCP targeting visibility, error codes and discovery hints

Task ID: MCP-002
Packet state: Done
Depends on: MCP-001 (planning), T-009 (safety boundaries)
Priority: First MCP implementation packet

## Outcome

An MCP client can tell which document a call actually landed on, can branch on failure type without string-matching, and is steered toward the right tool order — without changing which tools exist, which documents are reachable, or any T-009 safety boundary.

## Scope Decision

Taken from MCP-001's ranked list. Accepted: items 2, 3 (narrowed), 7, 8, 9. Deferred with reasons recorded below: items 1, 5, 6, 11, 12. Item 10 is closed — see Resolved Findings.

Deferred, and why:
- **Item 1 (unify/tool-aware RPC timeout).** Safety-adjacent on cancellation, and there is no measurement showing 20s is too short. Tuning it now would be blind. Revisit after item 2 lands, when timeouts are countable as a distinct error code.
- **Item 5 (default MCP to CORE_TOOLS, EXTENDED behind opt-in).** Highest potential value, but it silently removes capability from a working setup and there is no usage data on which extended tools are actually hit. Revisit after telemetry exists (item 6).
- **Item 6 (wire ai-adapter debug logging into the MCP path).** Medium-high cost; is the natural prerequisite for item 5 and should be scoped with it.
- **Item 11 (progress/partial results).** High cost, needs end-to-end MCP progress-notification support, and touches cancellation.
- **Item 12 (session-pool exhaustion).** Edge case; no evidence it has been hit.

## Resolved Findings (no work required)

**MCP-001 item 10 is closed.** `OPENPENCIL_MCP_PORT` / `OPENPENCIL_MCP_WS_PORT` exist only in `src/app/automation/bridge/vite-plugin.ts`, which is the dev-server bridge. The packaged sidecar reads plain `PORT` / `WS_PORT` (`packages/mcp/src/index.ts:14-15`, `packages/mcp/src/stdio.ts:15`), and `desktop/src/codex.rs:65` hardcodes `http://127.0.0.1:7600/mcp` in `codex_args`. Both observations in MCP-001 were correct; they describe two different code paths. In the installed desktop app the MCP port is not overridable. This is recorded as known behaviour, not a defect, and no change is authorised here. The loopback-only binding is unaffected.

**MCP-001 item 3 is much smaller than assessed.** The resolved target is already computed and already attached to every response on the browser side: `resolveAutomationTarget` returns `documentId`, `documentName`, optional `path`, `pageId`, `pageName`, and `handlers.ts:65` wraps every tool result in `responseWithTarget(result, target)`. The information is therefore already crossing the RPC boundary. It is discarded on the MCP side: the generic tool handler at `packages/mcp/src/tool/registration.ts:70` types the RPC response as `{ ok?, result?, error? }` — omitting `target` — and returns `ok(r, def.name)` built from `res.result` alone. `save_file`, `open_file` and `new_document` each already forward `res.target` explicitly (lines 151-156, 180-182, 207-209), which confirms both the shape and the intent. The generic path is the outlier.

## Requirements

1. **Echo the resolved target on every tool result.** In `registration.ts`'s generic dynamic-tool handler, include `res.target` in the returned payload the same way `save_file`/`open_file`/`new_document` already do. Every successful tool call must state which document and page it acted on.
2. **Add a machine-readable error code to `fail()`.** `packages/mcp/src/result.ts`'s `fail()` currently emits `{error: msg}` only. Add a `code` field alongside the existing message. The message text must not change — existing consumers that string-match keep working. Minimum code set, derived from the failure paths that already exist: document/page not found, app not connected, RPC timeout, result too large, path outside root, tool error, unknown.
3. **Steer targeting explicitly in tool descriptions.** Extend `automationTargetSchema`'s `document_id` description (`registration.ts:18`) to say that omitting it targets whichever document is currently focused in the app, and that `list_documents` gives the stable IDs. Follow the existing `get_codegen_prompt` precedent for sequencing hints.
4. **Document the single-WebSocket serialization behaviour** so agents do not assume concurrent calls parallelise, and are steered toward `batch_update` for bulk edits. Tool description text or an MCP resource; no transport change.
5. **Add the missing target-ambiguity test.** Multiple open documents, a call with no `document_id`, active tab changes between calls — assert the fallback behaviour and that the echoed target reflects reality. Extends `tests/engine/mcp/stdio.test.ts` / `server.test.ts`, both of which already cover target plumbing.

## Exclusions

- Do not make `document_id` mandatory. Requiring it breaks every existing untargeted call including the Codex path. Visibility first; if echoing proves insufficient against real usage, requiring it becomes a separate, evidence-backed decision.
- Do not change `resolveAutomationTarget`'s resolution logic or its fallback. This packet makes targeting *visible*, not different.
- Do not change which tools are registered, or the `eval` / `stock_photo` exclusions.
- Do not change any timeout value, the loopback-only binding, bearer-token handling, `mcpRoot` path scoping, undo, or cancellation.
- No change to the message text of any existing error.

## Acceptance Criteria

- A successful MCP tool call returns the acting document ID, document name and page alongside its result.
- A failed MCP tool call returns a stable `code` in addition to its unchanged message.
- `document_id`'s schema description states the focus-fallback behaviour and points at `list_documents`.
- A test exercises the untargeted-call-with-changing-active-tab scenario.
- `bun run check` is green.
- No behavioural change to tool availability, targeting resolution, or any safety boundary.

## Verification

- `bun run check` green (all five gates).
- Focused MCP tests pass: `tests/engine/mcp/{server,stdio,result}.test.ts`.
- **Live confirmation required before this packet closes**, because every MCP-001 finding is source-derived and the targeting race is inferred from `resolveAutomationTarget`'s fallback rather than observed: open two documents in the installed app, run an MCP session, issue a call with no `document_id`, switch the active tab, issue another, and confirm the echoed target reports the drift. That evidence also validates requirement 5's test.

## Open Question — resolved

The echoed target does **not** appear on `isError` results. Not a preference: the editor side never sends one on failure. `handleRequest` in `src/app/automation/bridge/handlers.ts` only reaches `responseWithTarget` on the success path, and a failure — including one thrown by `resolveAutomationTarget` itself — is serialised as `{ok: false, error}` with no target field. There is nothing to echo. Revisit only if the browser side is ever changed to attach a partial target to failures.

## Implementation Record (2026-08-04)

Changed:
- `packages/mcp/src/result.ts` — added the `ERROR_CODES` union, `classifyError()`, and an optional `code` argument on `fail()`. `fail()` now emits `{error, code}`. Existing message text is untouched, so string-matching consumers are unaffected.
- `packages/mcp/src/tool/registration.ts` — added `failFromRpc()` (classifies an editor-side error string, falling back to `tool_error` rather than `unknown` since it arrived over a working channel) and `appendTarget()`. The generic dynamic-tool handler now types the RPC response with `target` and merges it into the result; image results and file-write receipts get the target as an extra text content block. All four hand-written handlers now use `failFromRpc`. `document_id`/`page_id` descriptions rewritten to state the focus-fallback and point at `list_documents`. `list_documents`'s description now also carries the serialization note and the `batch_update` steer.
- `tests/engine/mcp/target-echo.test.ts` — new file, 5 tests, drives `registerTools` over `InMemoryTransport` with a stub `sendRpc` that reproduces the focus fallback and `responseWithTarget`.

Evidence: `bun run check` green (all five gates). `bun test tests/engine/mcp/` — 60 pass, 0 fail across 7 files.

Evidence limit: the new tests are bridge-level. They prove the MCP layer forwards and surfaces the target, not that the desktop app resolves it correctly — the stub stands in for the editor. The live two-document check in Verification above is still outstanding and is what closes this packet.

### Live confirmation (2026-08-04)

Observed against a running Tauri development app through one authenticated Streamable HTTP MCP client session:
- `GET http://127.0.0.1:7600/health` returned `{"status":"ok","version":"0.13.2","authRequired":true}` after the editor registered.
- The first untargeted `get_page_tree` call succeeded and echoed `target: {documentId: "tab-1", documentName: "Untitled", pageId: "0:2", pageName: "Page 1"}`.
- `new_document` created and focused `tab-2`. A live `list_documents` response then reported `tab-1` as inactive and `tab-2` as active. Repeating the same untargeted `get_page_tree` call echoed `tab-2` / page `0:4`, so the fallback followed the changed focus and made the landing document visible.
- While `tab-2` remained focused, `get_page_tree` with explicit `document_id: "tab-1"` succeeded and echoed `tab-1` / page `0:2`, confirming explicit targeting ignores focus.
- `get_page_tree` with `document_id: "mcp002-does-not-exist"` returned `isError: true` with the unchanged message `Document "mcp002-does-not-exist" not found` and `code: "document_not_found"`.

Observed versus predicted: no divergence. The live editor resolved untargeted calls to the focused document, changed that resolution when focus changed, honoured an explicit document ID, echoed the resolved document/page on successful calls, and emitted the predicted machine-readable failure code.

Post-session verification: `bun test tests/engine/mcp/` passed 60/60 across 7 files. `bun run check` passed all five gates. An earlier attempt ran those two commands concurrently and produced two stdio hook timeouts (`58 pass / 2 fail`, `Connection closed`); after the live dev app was stopped and the commands were rerun sequentially, both gates passed without code changes.

## Status record

Status: **Done**

Recorded in `Plan/plan.md` until 2026-08-18, moved here when the index was reduced to To Do / Ready / Done:

> Done (live MCP confirmed 2026-08-04; check + 60 MCP tests green)
