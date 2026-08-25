# T-030 - Deliver an application preferences menu

Task ID: T-030
Packet state: Done
Project goal link: PROJECT.md#end-goal
Depends on: T-005, T-009, T-010
Prepared against: live app menu/schema, theme local storage, AI provider settings, colour-space actions, editor snapping, canvas display seams, and tests on 2026-07-24
Last expanded: 2026-07-24

## Request Coverage

- Add one discoverable Preferences menu/dialog for global editor settings.
- Compose colour profile, hardware acceleration, snapping, AI sign-in/provider/API, themes, UI scaling/font, canvas colour, dot grid, line grid, and related display settings.
- Persist safe local preferences without changing document artwork/export content; keep credentials out of UI, documents, exports, logs, and source control.

## User-Visible Outcome

One Preferences surface lets the user inspect and change safe global editor settings, with unavailable or restart-required options clearly labelled and credentials redacted.

## Verified Starting State

- `App/src/app/shell/menu/schema.ts` and `app-menu.ts` define File/Edit/View/etc. menus; theme is already a local-storage setting with native theme synchronisation.
- AI provider/auth settings live under `src/app/ai`; T-009 owns the authenticated local CLI route and must not be duplicated.
- Snapping lives in editor/input paths; colour-space actions are document-level; T-029 will own grid display state. These scopes must be composed, not silently overridden.
- No single Preferences surface or app-level settings schema currently exists.

## Fixed Decisions

- One Preferences dialog is the owner of navigation and reset, while feature packets remain owners of behaviour/storage adapters.
- App-level settings use a versioned, validated local preference record. Document-level colour profile/DPI and artwork settings remain in their owning document contract.
- AI credentials are never displayed as raw values and are stored only through the existing secure/authenticated provider route; API keys may be entered only if secure local storage and redaction are proven.
- Hardware acceleration is a capability/status control with safe fallback and restart requirement; it must not promise GPU support when CanvasKit/Tauri cannot report it.
- Unsupported settings are disabled with a reason; invalid values revert to the last valid value or documented default. Reset is explicit and scoped.

## Read First

`Toolbox/Project-History/PROJECT.md`, `Plan/plan.md`, `T-005`, `T-009`, `T-010`, `T-029`, `App/AGENTS.md`, menu schema/use, theme, settings/local-storage stores, AI provider/auth components, snapping/editor controls, colour-space management, renderer startup, font/UI scale seams, and focused settings/menu tests.

## Allowed Changes

Preferences shell, validated app-settings schema/store, adapters to existing feature owners, redaction-safe UI, focused tests, and report/docs. No duplicate AI transport, snapping algorithm, theme system, grid renderer, or colour conversion.

## Restrictions and Exclusions

No credentials in `.fig`, exports, logs, source control, ordinary preferences display, or new global config files without an explicit security decision. No automatic hardware toggling, document-artwork mutation, or feature implementation owned by dependencies.

## Implementation Steps

1. Reconcile every preference with its owner, scope, default, persistence, reset, restart requirement, and platform limitation.
2. Define a versioned schema with validation, migration, redaction, and safe fallback before UI wiring.
3. Add one menu/dialog entry using existing menu/i18n/focus conventions.
4. Compose existing theme, snapping, AI, colour, font/UI scale, canvas, and T-029 settings without duplicate state.
5. Add tests for open/close/reset, persistence, invalid values, unsupported hardware, redaction, document/export isolation, and dependency regressions.
6. Run the smallest relevant change-scoped checks and installed Windows verification only after T-005/T-009/T-010/T-029 evidence is current.

## Acceptance Criteria

- [ ] One discoverable Preferences surface covers each requested setting or explicitly reports why a setting is unavailable.
- [ ] App/document ownership, defaults, persistence, migration, reset, restart, and invalid-value behaviour are observable.
- [ ] Existing theme, snapping, AI/auth, colour, and grid behaviour remains owned by its feature packet and regression-green.
- [ ] No credential or preference leakage occurs in `.fig`, exports, logs, or source control.
- [ ] Focused settings/menu/security tests, relevant narrow checks, pipeline validation, and installed evidence pass.

## Verification

Run focused menu/settings and dependency regression tests, redaction and document/export isolation checks, the smallest relevant type/lint/architecture checks, pipeline validation, then installed persistence/relaunch/identity/responsiveness proof. Do not run `bun run check`, `bun run test:unit`, or `bun run test` without an explicit user request for that specific run.

## Integration or Installed-Result Check

Installed OpenPotlood must prove the single menu/dialog, safe persistence, reset/fallback behaviour, no credential leakage, dependency ownership, relaunch, identity, and responsiveness.

## Stop Conditions

Stop on missing dependency evidence, credential-storage ambiguity, hardware detection uncertainty, duplicate ownership, or any need to revive retired AI routes.

## Execution Report Contract

Record the preference ownership matrix, schema/defaults/migrations, redaction evidence, changed files, test counts/exits, dependency regressions, persistence/relaunch results, installed identity/responsiveness, deviations, and limitations.

## Status record

Status: **Done**
