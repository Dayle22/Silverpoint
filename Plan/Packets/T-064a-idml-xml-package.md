# T-064a - IDML XML and package foundation

Task ID: T-064a
Packet state: Done
Depends on: T-063
Related: T-064b, T-064c
Delivery: named source gates + browser check
Execution size: 3 core files; 1 focused unit file; no graph or UI work

## Intended Outcome
Safely parse bounded IDML XML/archive structure and return page summaries without creating scene nodes.

## Verified Starting State
- `packages/core/src/io/formats/pdf/import.ts` provides the summary/diagnostic precedent.
- Exact public summary: `readIdmlSummary(data: Uint8Array): { pages: IdmlPageSummary[]; diagnostics: IdmlImportDiagnostic[] }` where `IdmlPageSummary = { pageNumber: number; widthPt: number; heightPt: number }`.
- Limits: `IDML_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024`, `IDML_MAX_PAGE_COUNT = 200`, `IDML_MAX_ITEMS = 20000`, `IDML_MAX_DIMENSION_PX = 100000`.

## Allowed Changes
`packages/core/src/io/formats/idml/xml-parse.ts`, `import/package.ts`, the IDML import/index declaration needed to export summaries, and `tests/engine/io/formats/idml-xml-parse.test.ts`.

## Restrictions and Exclusions
No resources, geometry, text, graph assembly, format registration, dialog, menu, docs or dependency addition. No scene node may be created.

## Implementation Steps
1. Implement the bounded `{ tag, attrs, children, text }` XML tree parser: generic self-closing tags, CDATA, five entities plus numeric references; ignore declarations/comments/PIs; reject malformed input without looping.
2. Read the ZIP with existing `fflate`, validate `mimetype`, resolve `META-INF/container.xml` and `designmap.xml`, and enforce limits before semantic parsing.
3. Implement `readIdmlSummary()` from page bounds only.
4. Add the repository's two-line Bun test header to the new test file.

## Acceptance Criteria
- [x] Parser cases and malformed input pass.
- [x] Missing required parts and exceeded limits return error diagnostics without nodes.
- [x] Summary returns stable page order and point dimensions.

## Verification
### Development loop — repeat as needed
`bun test tests/engine/io/formats/idml-xml-parse.test.ts`

### Final pre-completion gates — run once
Focused Oxlint and `bunx tsgo --noEmit`; no browser behaviour exists in this foundation slice.

## Stop Conditions
Stop on a required new dependency, unbounded archive expansion, ambiguous package root, or any graph mutation.

## Execution Report Contract
Report exact files, parser cases/counts, limit evidence and command exits.

## Status record
2026-08-20 — First executable slice of former T-064.
2026-08-21 — Completed and verified. Bounded XML pull-parser, package reader limits/fallbacks, and page summary extraction implemented and covered by unit tests in tests/engine/io/formats/idml-xml-parse.test.ts (18 pass, 0 fail; regression suite 22 pass, 0 fail). Oxlint and tsgo --noEmit passed.
