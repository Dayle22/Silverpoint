# T-049c - Curved-gradient .fig preservation

Task ID: T-049c
Packet state: Done
Depends on: T-049b

## Intended Outcome
Write curved fills as native `GRADIENT_LINEAR` paints and preserve `gradientSpine` in `curvedGradientFillsV1` plugin data for lossless OpenPotlood round-trip.

## Contract
Bound files: `plugin-data.ts` plus the minimum paint export/import call sites and one round-trip test. Exact payload: `{ version: 1, byIndex: Record<number, GradientSpinePoint[]> }`. Never add a non-Figma paint enum.

## Verification
Development loop: the focused curved-gradient `.fig` round-trip test. Final once: plain Figma linear regression, Oxlint and `bunx tsgo --noEmit`.

## Status record
2026-08-20 — Interchange-only curved-gradient split.
2026-08-22 — Implemented `CURVED_GRADIENT_PLUGIN_KEY`, `syncCurvedGradientPluginData`, and `restoreCurvedGradientFills` in `plugin-data.ts`. Hooked export sync in `export-node.ts` and import restoration in `convert.ts`. Verified with `curved-gradient-roundtrip.test.ts`, `stroke-gradient-export.test.ts`, and `bunx tsgo --noEmit`.
