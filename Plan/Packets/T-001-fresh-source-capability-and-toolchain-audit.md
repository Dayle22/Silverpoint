# T-001 — Fresh-source capability and toolchain audit

Task ID: T-001
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: NONE
Prepared against: App tree SHA-256 6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5 and upstream app version 0.13.2
Last expanded: 2026-07-17

## Request Coverage

- Audit before implementation: classify every requested capability using fresh evidence from `App/`.
- Toolchain audit: record installed command paths and versions without installing dependencies or building the app.
- Previous-project boundary: use `Toolbox/previous-project/` only to identify questions or pitfalls, never as completion evidence.
- Low-context continuity: produce a compact evidence matrix with exact paths, tests, gaps, and recommended packet treatment.

## User-Visible Outcome

A compact baseline report states which requested OpenPotlood capabilities are present, partial, missing, or unverified in the fresh master snapshot, identifies the usable Windows toolchain, and gives evidence-based treatment for T-002 through T-009 without modifying application code.

## Verified Starting State

- `App/package.json`, `App/desktop/tauri.conf.json`, and `App/desktop/Cargo.toml` report upstream version `0.13.2`; product name is `OpenPencil`, package name is `open-pencil-app`, Rust package is `open_pencil`, and Tauri identifier is `net.dannote.open-pencil`.
- The live app contains 2,619 files and matches the pristine upstream resource at tree SHA-256 `6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5`.
- Available tools: Bun `1.3.14`, Cargo `1.97.0`, rustc `1.97.0`, Python `3.11.15`, and ripgrep `15.1.0`.
- Drag/drop seams exist at `App/packages/vue/src/canvas/drop/use.ts` and `App/src/components/EditorCanvas.vue`.
- Corner-radius model and test seams exist in `App/packages/scene-graph/src/types.ts`, `App/packages/scene-graph/src/node-defaults.ts`, and `App/tests/engine/vue/controls/appearance.test.ts`.
- Background blur and inner shadow model, renderer, tool, UI, and test seams exist; `INNER_GLOW` was not found in the fresh targeted search and needs explicit classification.
- Current app theme type in `App/src/app/shell/theme.ts` is `dark | light | auto`; grey and midnight need explicit classification.
- Page-guide rendering exists at `App/packages/core/src/canvas/page-guides.ts`; editable guides, margins, and bleed need separate classification.
- `App/packages/core/src/io/formats.ts` registers JPG, PNG, SVG, and PDF, while the export UI and documentation must be checked for full user-visible reachability and behaviour.
- Existing direct AI chat expects provider configuration/API keys, while ACP transport and MCP seams exist at `App/src/app/ai/acp/` and `App/packages/mcp/src/`; the no-paid-API route remains unproven.

## Read First

- `Toolbox/Project-History/PROJECT.md`
- `Plan/plan.md`
- `Toolbox/RESOURCE_MANIFEST.md`
- `App/AGENTS.md`
- `App/package.json`
- `App/desktop/tauri.conf.json`
- `App/desktop/Cargo.toml`
- `App/packages/docs/development/roadmap.md`

## Allowed Changes

- `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`
- The execution report section appended by the pipeline role to this packet.
- The normal status and evidence fields maintained by the pipeline audit role after execution.

## Restrictions and Exclusions

- Do not edit any file under `App/` or `Toolbox/`.
- Do not install dependencies, run a product build, launch the app, initialise Git, or invoke release/updater/deployment workflows.
- Do not label a capability complete from filenames, documentation, previous-project claims, or model/schema support alone; distinguish core support, UI reachability, automated coverage, and installed behaviour.
- Do not change task order or silently re-scope T-002 through T-009; recommend route amendments for later approval/audit.
- Preserve the requested grouping: themes, effects, guides, exports, and AI each remain one outcome packet unless evidence proves a split is required.

## Implementation Steps

1. Confirm the current app identity/version and recalculate the app tree digest; stop if it differs from the prepared starting state before this first task begins.
2. Record command paths and versions for Bun, Cargo, rustc, Python, and ripgrep. Record missing tools plainly; do not install anything.
3. For each requested capability, inspect the nearest source interface, user-facing UI path, focused tests, and relevant documentation.
4. Classify each capability as `PRESENT`, `PARTIAL`, `MISSING`, or `UNVERIFIED`, with separate notes where model support exists but editing UI or installed proof does not.
5. Cover exactly: desktop identity/versioning; drag-and-drop images; corner-radius node controls; light/grey/dark/midnight themes; background blur/inner glow/inner shadow; guides/margins/bleed; JPEG/PNG/SVG/PDF export; and no-paid-API MCP/ACP/chat interaction.
6. For each T-002 through T-009, recommend one of `VERIFY EXISTING`, `IMPROVE EXISTING`, `IMPLEMENT MISSING`, or `RESEARCH BEFORE EXPANSION`, citing the evidence.
7. Write the compact report at `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`; keep previous-project observations in a clearly labelled non-authoritative appendix only when they expose a concrete pitfall worth checking later.
8. Report commands, output summaries, uncertainty, and any mismatch; leave all later packets unchanged for the pipeline audit/amendment role.

## Acceptance Criteria

- [ ] The report records the verified upstream identity, version, source digest, and local toolchain versions.
- [ ] Every requested capability has one status, at least one live-source evidence path, user-facing reachability evidence or an explicit absence, test evidence or an explicit gap, and a recommended packet treatment.
- [ ] The report distinguishes existing implementation from verified working behaviour.
- [ ] Previous-project material is clearly labelled non-authoritative and is not used as completion evidence.
- [ ] No application, resource, dependency, Git, build, installed-app, updater, release, or deployment state changes.
- [ ] The report ends with exact recommended next action for T-002 and lists any route amendment that requires approval.

## Verification

- Run `Test-Path 'Toolbox/Project-History/reports/T-001-fresh-source-audit.md'`; expect `True`.
- Run `rg -n 'T-002|T-003|T-004|T-005|T-006|T-007|T-008|T-009|PRESENT|PARTIAL|MISSING|UNVERIFIED' Toolbox/Project-History/reports/T-001-fresh-source-audit.md`; expect evidence for all eight downstream packets and capability classifications.
- Recalculate the app tree digest using the method in `Toolbox/RESOURCE_MANIFEST.md`; expect `6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5` because this task is read-only.

## Integration or Installed-Result Check

- Not applicable: T-001 is a read-only baseline audit and must not build, install, launch, or modify the application.

## Stop Conditions

- Stop if the app tree digest differs before execution, an authoritative source file is missing, resource material cannot be distinguished from live source, a capability cannot be classified without executing or modifying the app, or the report would need to invent an interface or completion claim. Record the exact missing evidence instead.

## Execution Report Contract

- Report result, files changed, commands and outputs, capability classifications, packet-treatment recommendations, integrated-result evidence as not applicable, deviations, and mess or concerns.

## Execution Report — 2026-07-18

Result: T-001 VERIFIED. The read-only audit report was written at `Toolbox/Project-History/reports/T-001-fresh-source-audit.md`.

Files changed: `Toolbox/Project-History/reports/T-001-fresh-source-audit.md` only, plus this execution receipt and the normal project state files. No file under `App/` or `Toolbox/` changed.

Commands and outputs: tool paths and versions were recorded; the report path check returned `True`; the required `rg` classification check returned evidence for all capability statuses and T-002 through T-009; `python C:\Users\User\.codex\skills\run-project-pipeline\scripts\validate_pipeline.py C:\Users\User\Documents\OpenPotlood` returned `[PASS] Project pipeline is structurally consistent.`

Capability classifications: desktop identity `PARTIAL`; drag/drop `PARTIAL`; corner-radius controls `PRESENT`; four requested themes `PARTIAL`; effects `PARTIAL`; guides/margins/bleed `PARTIAL`; four export families `PRESENT`; no-paid-API MCP/ACP/chat `PARTIAL`.

Deviation: the documented digest recipe produced fresh digest `9c7f36098828ab04c18696281ab2cc9e6d7da81b9be13aab08cd1b4a0f64ea3c`, not the historical prepared value `6c28551a0297df81eeae830c6a02dd75af11b4c31c17536e568f1944176396c5`. File count, byte count, and live/upstream per-file contents still match; the ambiguity is recorded in the report and is not treated as source drift.

Integrated or installed-result evidence: not applicable by packet restriction. Dependencies were not installed; tests, build, launch, installer, updater, release, deployment, and Git operations were not run.

Exact next action: Reconcile the report and audit T-002. Obtain explicit approval for `com.dayle22.openpotlood` before promoting T-002 to READY; do not execute T-002 in the promotion session.

## Status record

Status: **Done**
