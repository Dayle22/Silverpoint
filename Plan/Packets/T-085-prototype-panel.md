# T-085 — Prototype panel

Task ID: T-085
Packet state: Brief
Project goal link: Plan/endgoal.md
Depends on: T-070d3 (Done) for the v5 panel model
Blocks: T-032a (Dev's default panel set names `prototype`)
Related: T-084 (persona model), T-036 (contextual property surface)
Prepared from: the user's 2026-08-24 decision that the Dev persona defaults to the Code and Prototype panels, and the finding that no prototype panel exists
Delivery: named source gates + browser check

## Intended Outcome

A `prototype` panel is registered, dockable, floatable, groupable and menu-toggleable exactly like every other v5 panel, and carries real interaction-authoring content rather than a placeholder.

## Verified Starting State

- `src/app/shell/panels/types.ts` — `PANEL_IDS` (line 3) holds 16 ids: `pages, history, assets, layers, swatches, export, variables, ai, code, appearance, transform, text, page, guides, mask, component`. **There is no `prototype`.** `PANEL_LAYOUT_VERSION = 5`.
- `src/app/shell/panels/registry.ts` — `PanelRegistryEntry` requires `id`, `labelKey`, `menuId: window-panel-${PanelId}`, `defaultDock`, `defaultGroupIndex`, `defaultDockIndex`, `defaultTabIndex`, `defaultFloating`, `sizing`, `defaultHeight`. `PANEL_REGISTRY` rows are tuples; the right dock currently uses group indices 0–6.
- `src/app/shell/panels/containers.ts` — `DEFAULT_GROUPS`/`DEFAULT_OPEN` (lines 125-135) decide which panels open by default; a newly registered panel that is not in `DEFAULT_OPEN` ships closed, which is correct for Advanced.

## Fixed Decisions

1. **Registration is the easy half; content is the packet.** Adding the id, registry row, i18n label and `window-panel-prototype` menu entry is mechanical. This packet is only honestly complete when the panel does something — at minimum: list the interactions defined on the current selection, create one, edit its trigger/target/animation, and delete it.
2. **Advanced's defaults do not change.** `prototype` is registered but absent from `DEFAULT_OPEN`, so Advanced's current layout is byte-identical. Only Dev's factory (T-032a) opens it.
3. **No schema bump.** Adding a `PanelId` widens `Record<PanelId, RegisteredPanelState>`; existing v5 records lacking the key must be filled by normalisation with the registry default, not rejected. Confirm `normalisePanelLayout()` already does this at expansion — if it does not, that repair belongs in this packet.
4. **No new persistence surface.** Prototype data belongs to the document model, not to a new localStorage key.

## Open Decisions

1. **What does an interaction target, given there is no prototype runtime?** Recommended: author and persist interaction data now; presenting/playing it is a later packet. Expansion must decide explicitly and record whichever half is deferred as a stated limitation rather than shipping a panel that silently does nothing.
2. **Does prototype data round-trip through `.fig`?** Recommended: read Figma prototype data if present, but treat full round-trip as out of scope and record the gap.

## Restrictions and Exclusions

- Do not change `PANEL_LAYOUT_VERSION` or add a migration beyond the widening described in Fixed Decision 3.
- Do not alter `DEFAULT_GROUPS`, `DEFAULT_OPEN` or any existing panel's registry row.
- Do not implement the persona model (T-084) or per-persona defaults (T-032a).
- No CanvasKit or scene-graph rendering work for prototype presentation in this packet.
- No dependency, build, install or Git work.

## Verification

Extend the panel unit suite for the widened `PANEL_IDS` and registry entry; confirm an existing stored v5 record without a `prototype` key normalises without loss. Extend a panel E2E spec for open/close, dock, float, group and menu toggle. Confirm `tests/e2e/panels/basic.spec.ts`, `stacks.spec.ts` and `tabbed-groups.spec.ts` pass unchanged. Then `bun run dev` and browser-check authoring one interaction end to end. No umbrella command, no build, no install.

## Status record

2026-08-24 — Captured after the registry check proved no prototype panel exists. Brief only; content scope is deliberately unresolved and must be settled at expansion.
