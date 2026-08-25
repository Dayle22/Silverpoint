# T-049d - Curved-gradient Bend controls

Task ID: T-049d
Packet state: Done
Depends on: T-049c and T-048d

## Intended Outcome
Expose Curved beside existing gradient subtypes and a signed Bend control in the fill Gradient editor.

## Contract
Bound files: `packages/vue/src/primitives/Fill/useFill.ts`, `GradientEditor/useGradientStops.ts`, `src/components/fill-picker/GradientEditor.vue`, message defaults, and one focused Playwright spec. No on-canvas handle, renderer, exporter or stroke changes.

## Verification
Development loop: focused fill-picker Playwright spec. Retain the repository E2E header. Final once: both Vue type checks, focused Oxlint, locale read-back and browser check.

## Status record
2026-08-20 — UI-only curved-gradient split.
2026-08-22 — Exposed Curved gradient subtype in useFill category mapping, useGradientStops subtypes and transforms, and panels i18n messages. Passed all unit tests, tsgo, vue-tsc, and oxlint gates. State: Done.
