# Upstream Overlap Sets Report

## Line Counts

- `ours.txt`: 1,618
- `theirs.txt`: 2,095

## Set Sizes

- **PORT**: 607
- **RECONCILE**: 1,011
- **UPSTREAM-ONLY**: 1,084
- **Sum check**: PORT (607) + RECONCILE (1,011) = 1,618 (`ours.sorted`: 1,618) — Confirmed equal.

## PORT Directory Grouping

| Directory / Prefix | Changed Files Count |
| :--- | :--- |
| `tests/engine` | 125 |
| `packages/core` | 120 |
| `packages/vue` | 91 |
| `tests/e2e` | 88 |
| `src/components` | 56 |
| `src/app` | 46 |
| `packages/docs` | 16 |
| `tests/fixtures` | 13 |
| `src/theme` | 9 |
| `packages/scene-graph` | 8 |
| `packages/fig` | 6 |
| `tools/architecture` | 4 |
| `desktop/src` | 2 |
| `packages/pen` | 2 |
| `tests/helpers` | 2 |
| `packages/mcp` | 2 |
| `tools/windows-sidecars` | 2 |
| `vite/pwa.ts` | 1 |
| `tools/unit-tests` | 1 |
| `tools/i18n` | 1 |
| `tests/preload.ts` | 1 |
| `tauri.build.override.json` | 1 |
| `public/apple-touch-icon.png` | 1 |
| `public/favicon.ico` | 1 |
| `playwright.config.ts` | 1 |
| `.gitignore` | 1 |
| `packages/kiwi` | 1 |
| `scripts/benchmark-live-mcp.ts` | 1 |
| `scripts/build-windows-sidecars.ts` | 1 |
| `REGENERABLE-ARTEFACTS.md` | 1 |
| `public/favicon-128.png` | 1 |
| `public/favicon-32.png` | 1 |

## RECONCILE Directory Grouping

| Directory / Prefix | Changed Files Count |
| :--- | :--- |
| `packages/docs` | 666 |
| `packages/core` | 69 |
| `packages/vue` | 56 |
| `src/components` | 45 |
| `src/app` | 37 |
| `tests/engine` | 34 |
| `tests/e2e` | 31 |
| `packages/fig` | 15 |
| `src/theme` | 13 |
| `packages/scene-graph` | 10 |
| `packages/mcp` | 4 |
| `desktop/src` | 3 |
| `tests/helpers` | 2 |
| `tools/package-quality` | 2 |
| `tools/architecture` | 2 |
| `src/App.vue` | 1 |
| `src/constants.ts` | 1 |
| `tools/tauri-menu` | 1 |
| `vite.config.ts` | 1 |
| `tools/i18n` | 1 |
| `src/env.d.ts` | 1 |
| `src/views` | 1 |
| `desktop/capabilities` | 1 |
| `desktop/Cargo.lock` | 1 |
| `desktop/Cargo.toml` | 1 |
| `CHANGELOG.md` | 1 |
| `AGENTS.md` | 1 |
| `bun.lock` | 1 |
| `bunfig.toml` | 1 |
| `desktop/generated` | 1 |
| `.lfsconfig` | 1 |
| `README.md` | 1 |
| `src/app.css` | 1 |
| `packages/kiwi` | 1 |
| `desktop/tauri.conf.json` | 1 |
| `index.html` | 1 |
| `package.json` | 1 |

## RECONCILE Proportion

The fraction of this project's changed paths (`ours`) falling in RECONCILE is 1,011 / 1,618 (62.48%).
