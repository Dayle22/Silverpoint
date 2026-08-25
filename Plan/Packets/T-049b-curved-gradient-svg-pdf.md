# T-049b - Curved-gradient SVG and PDF export

Task ID: T-049b
Packet state: Done
Depends on: T-049a

## Intended Outcome
Export the same 24 shared curve bands to SVG; verify PDF inheritance.

## Contract
Modify only `packages/core/src/io/formats/svg/defs.ts` plus focused SVG/PDF tests. Import the shared band descriptors from T-049a; do not reimplement curve maths.

## Verification
Development loop: the exact focused SVG curved-gradient test. Final once: PDF inheritance regression, Oxlint and `bunx tsgo --noEmit`.

## Status record
2026-08-20 — Export-only curved-gradient split.
2026-08-22 — Implemented curved gradient SVG export in defs.ts with 24 linearGradient & clipPath polygon defs grouped into a userSpaceOnUse pattern, passing all unit tests and tsgo checks. State: Done.

