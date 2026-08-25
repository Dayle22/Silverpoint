# T-064b - IDML semantic scene import

Task ID: T-064b
Packet state: Done
Packet revision: 2
Project goal link: Plan/endgoal.md
Depends on: T-064a
Related: T-063, T-064, T-064c
Prepared from: the user's 2026-08-20 request "expand T-064b — IDML semantic scene import", re-expanding the 2026-08-20 stub
Expanded at: 2026-08-20 15:40 Africa/Johannesburg
Expanded against: the live tree under `App/` — `packages/core/src/io/formats/idml/{import.ts,index.ts}`, `import/{types,summary,package,geometry,text,color}.ts`, `xml-parse.ts`, `tests/engine/io/formats/{idml-import,idml-xml-parse,idml-export}.test.ts`, `tests/e2e/idml/import.spec.ts`, `tests/fixtures/idml/*`, `src/app/document/io/idml.ts`, `src/app/tabs/index.ts`, `src/app/shell/menu/files.ts`, `packages/core/src/io/formats.ts`, `packages/core/src/io/index.ts`, `packages/vue/src/i18n/messages/dialogs.ts`, `packages/docs/user-guide/exporting.md`, `CHANGELOG.md`, `Plan/plan.md`, `Plan/Packets/T-064{,a,c}-*.md`
Delivery: named source gates + browser check
Execution size: 1 core implementation file modified (`packages/core/src/io/formats/idml/import.ts`); 1 test file modified (`tests/engine/io/formats/idml-import.test.ts`); no new files, no split needed

## Intended Outcome

Every declared IDML import safety limit is actually enforced. Today `IDML_MAX_ITEMS` and `IDML_MAX_DIMENSION_PX` are declared, exported and documented as import guards but are dead constants — a pathological IDML package (tens of thousands of page items, or a page whose points-to-pixels conversion produces an absurd canvas size) is parsed and converted into scene nodes with no limit check and no diagnostic. After this packet, both limits abort the import with one `error` diagnostic and create zero nodes, exactly like the existing `IDML_MAX_PAGE_COUNT` and `IDML_MAX_FILE_SIZE_BYTES` guards already do.

## Request Coverage

- Convert bounded IDML resources, geometry, text, images, pages and margins into one editable scene graph with diagnostics — **already fully delivered** (see Corrections to the Brief). This packet closes the one verified gap in that delivery: the two unenforced size limits.

## Verified Starting State

Verified 2026-08-20 by reading every file listed in `Expanded against` above.

### A. The semantic import pipeline this stub describes already exists, end to end

`import/{package,summary,geometry,text,color}.ts` and `import.ts` are not stubs — they are a complete, tested implementation:

| File | What it does | Anchor |
| --- | --- | --- |
| `import/package.ts` | `readIdmlPackage(data, diagnostics): IdmlPackageParts \| null` — unzips via `fflate.unzipSync`, resolves `META-INF/container.xml` → designmap → `Resources/{Graphic,Fonts,Styles,Preferences}.xml` + spread/master/story paths, enforces `IDML_MAX_FILE_SIZE_BYTES` and empty-file/invalid-zip/missing-designmap errors | full file, 176 lines |
| `import/summary.ts` | `readIdmlSummary(data): Promise<{ pages: IdmlPageSummary[]; diagnostics }>` — the dialog pre-scan, enforces `IDML_MAX_PAGE_COUNT` | full file, 87 lines |
| `import/geometry.ts` | `parseBounds`, `parseItemTransform` (rotation/scale/skew decomposition, `IDML_SKEW_TRANSFORM_APPROXIMATED` warning), `parsePathGeometry`, `isAxisAlignedBox`, `pathsToVectorNetwork` | full file, 242 lines |
| `import/text.ts` | `parseStories` (per-`ParagraphStyleRange`/`CharacterStyleRange` chunking, font substitution via `STANDARD_FONTS` with one `IDML_UNRESOLVED_FONT` warning per distinct missing family), `populateTextNodeFromStory` (styleRuns) | full file, 222 lines |
| `import/color.ts` | `parseGraphicSwatches` (RGB direct, CMYK→RGB with `IDML_CMYK_CONVERTED` info diagnostic, unsupported spaces → null fill + warning, `Tint` resolution), `resolveColor` | full file, 158 lines |
| `import.ts` | `importIdml(data, options): Promise<{ graph: SceneGraph; diagnostics: IdmlImportDiagnostic[] }>` — assembles pages→frames (100px gutter, left-to-right), master-spread flattening with `idmlMasterItem` pluginData tag, `Rectangle`/`Oval`/`Polygon`/`GraphicLine`/`Group`/`TextFrame`/`Image`/`EPS`/`PDF` node mapping, `upsertFrameGuides` from `MarginPreference`, threaded-story dedup (`IDML_THREADED_STORY_SPLIT`) | full file, 531 lines, read in full |

Exported publicly from `packages/core/src/io/formats/idml/index.ts:1-23`: `importIdml`, `readIdmlSummary`, plus the four limit constants and `IdmlImportDiagnostic`/`IdmlPageSummary`/`ImportIdmlOptions` types.

`idmlFormat.support.readDocument = true` and `readDocument()` lazily imports `./formats/idml` and calls `importIdml` (`packages/core/src/io/formats.ts:370-393`), exactly per the original T-064 Fixed Decision 1.

### B. The test suite this stub asks for already exists and passes the scenarios it covers

`tests/engine/io/formats/idml-import.test.ts` (322 lines) covers, against **three real fixtures** (`tests/fixtures/idml/{indesign-sample,affinity-sample,reference_indesign}.idml`, plus `REFERENCE.md`):

- format-registry resolution, `readIdmlSummary` page count/dimensions/CMYK/external-link diagnostics for both dialects, empty-file rejection;
- full `importIdml` conversion for both dialects — frame sizing, margin guides, master-spread item inheritance tagged with `idmlMasterItem`, RGB and CMYK-converted fills, exact text strings, one missing-font warning per family, embedded image bytes into `graph.images`;
- non-default-DPI proportional scaling;
- a full T-063 export → T-064 import round trip (frame size, exact text, exact fill colour, byte-identical image);
- `.fig` round-trip isolation (imported IDML document exports/reimports as `.fig` safely).

`tests/engine/io/formats/idml-xml-parse.test.ts` (115 lines) unit-tests the T-064a parser this file consumes: entities, CDATA, self-closing tags, mixed quotes, comments/PIs, malformed-input rejection.

### C. T-064a and T-064c are also already fully delivered in source — `Plan/plan.md`'s status column is stale

- **T-064a's own Allowed Changes** (`packages/core/src/io/formats/idml/xml-parse.ts`, `import/package.ts`, the summary export, its test file) all exist and are covered by the tests in B, even though `Plan/plan.md` lists T-064a as `Ready` (expanded, not executed) rather than `Done`.
- **T-064c's entire scope** — `idmlFormat` registration (A above), `src/app/document/io/idml.ts` (`idmlImportOpen`, `idmlImportLoading`, `currentIdmlSession`, `confirmIdmlImport`, `cancelIdmlImport`, `openIDMLFile` — 202 lines, read in full), `IdmlImportDialog.vue` (exists at `src/components/Shell/IdmlImportDialog.vue`), `isIdmlImportFile` + dispatcher branch at `src/app/tabs/index.ts:216-235`, the three extension lists in `src/app/shell/menu/files.ts:9,42,75`, six i18n keys in `packages/vue/src/i18n/messages/dialogs.ts:230-235`, `tests/e2e/idml/import.spec.ts` (163 lines, three scenarios: dialog+cancel, confirm+undo, Affinity dialect) — all exist and are wired, even though `Plan/plan.md` and the T-064c stub list it as `To Do`.
- `CHANGELOG.md:7-8,14` already documents both IDML import and export, including the `isExportFormatId`/`pdf-print` fix from T-063.
- `packages/docs/user-guide/exporting.md:27-29` documents IDML **export**. There is no import-side user-guide section — that gap is real, but it is inside **T-064c's** Allowed Changes ("one user-guide section"), not this packet's bound files (`import/{geometry,text,color}.ts`, `import.ts`, fixtures, `idml-import.test.ts` per this stub's own Contract line). Out of scope here; report it, do not fix it in this packet.

**Conclusion: this stub's premise is already delivered.** The only thing this re-expansion found still open, inside this packet's own bound files, is section D below.

### D. The one verified gap: two of the four declared import limits are dead code

`import/types.ts:1-4`:

```ts
export const IDML_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
export const IDML_MAX_PAGE_COUNT = 200
export const IDML_MAX_ITEMS = 20000
export const IDML_MAX_DIMENSION_PX = 100000
```

`IDML_MAX_FILE_SIZE_BYTES` is enforced in `import/package.ts:111-118`. `IDML_MAX_PAGE_COUNT` is enforced twice — `import/summary.ts:51-58` and `import.ts:452-459`. Repo-wide search for `IDML_MAX_ITEMS` and `IDML_MAX_DIMENSION_PX` (`Grep` over `packages/core/src/io/formats/idml/`) returns **only their declaration in `import/types.ts` and their re-export in `index.ts:14,16`** — zero read sites, zero enforcement, zero test. A page whose `GeometricBounds` converts to an enormous pixel size, or a spread with tens of thousands of items, is imported without any guard, unlike its three sibling limits.

The existing page-count precompute this packet extends — `countTotalIdmlPages(pkg)` at `import.ts:355-370` — walks every spread's `<Page>` elements once, before any frame is created, exactly the shape needed to add the other two checks at zero extra parse passes if merged rather than added as a third walk.

## Read First

| Path | Symbol / line span | Why |
| --- | --- | --- |
| `packages/core/src/io/formats/idml/import.ts` | `countTotalIdmlPages` (355-370), `importIdml` (429-530), the `totalPages > IDML_MAX_PAGE_COUNT` block (452-459), the `import { IDML_MAX_PAGE_COUNT, type IdmlImportDiagnostic, type ImportIdmlOptions } from './import/types'` block (15-19) | This is the only file this packet edits. Reread these exact spans before editing — they are the pre-flight anchors. |
| `packages/core/src/io/formats/idml/import/types.ts` | `IDML_MAX_ITEMS` (line 3), `IDML_MAX_DIMENSION_PX` (line 4) | The two constants to enforce; values must not change. |
| `packages/core/src/io/formats/idml/import/geometry.ts` | `parseBounds(boundsStr?: string): ParsedBounds` (35-55), `ParsedBounds { top, left, bottom, right, width, height }` (15-22) | Already imported into `import.ts`; reused unchanged for the new dimension check. |
| `tests/engine/io/formats/idml-import.test.ts` | top-of-file imports (1-23), `loadFixture` (20-23), `pageId` (25-27) | The exact test-file conventions (imports from `'#core/io'`, `setupFakeDomEnvironment()`, `bun:test`) the two new tests must follow. |

No other file needs to be read to execute this packet.

## Corrections to the Brief

1. **The stub's Contract is already implemented in full.** `importIdml(data, options): { graph, diagnostics }` exists exactly as specified, backed by `import/{geometry,text,color}.ts`, and `idml-import.test.ts` exists and passes for both InDesign and Affinity Publisher dialects plus a T-063 round trip. Re-expanding this stub as if the semantic converter were unbuilt would duplicate working, tested code. See Verified Starting State A-B.
2. **T-064a and T-064c, this packet's declared dependency and dependent, are also already delivered in source**, contradicting `Plan/plan.md`'s `Ready`/`To Do` entries for them. This packet does not edit `Plan/plan.md` (out of scope per the expansion brief's hard rules) — flag this to the user so the parent session can reconcile the index, and consider whether T-064c needs the same re-expansion treatment as this packet before it is executed.
3. **The stub named no acceptance bar for `IDML_MAX_ITEMS`/`IDML_MAX_DIMENSION_PX`**, but `import/types.ts` declares both as part of this packet's own bound file set, and the sibling limits (`IDML_MAX_FILE_SIZE_BYTES`, `IDML_MAX_PAGE_COUNT`) are both enforced with tests. Leaving two of four declared, publicly-exported safety limits silently unenforced is a defect, not a follow-up; Fixed Decision 1 closes it as the one bounded change this packet still needs.

## Fixed Decisions

1. **Merge the item-count and dimension checks into the existing page-count precompute walk, not a third separate pass.** `countTotalIdmlPages(pkg)` already parses every spread once, before any node is created, purely to count `<Page>` elements. Rename it to `precomputeIdmlLimits(pkg, masterSpreadMap, pxPerPt)` and extend its single walk to also accumulate total item count and maximum page pixel dimension, returning `{ totalPages, totalItems, maxDimensionPx }`. This avoids adding a fourth full-document XML reparse (the file already reparses each spread three times across `readIdmlSummary`, this precompute, and the creation loop — a fourth pass for a fourth constant is the wrong direction). Reasoning: the function's existing shape (iterate `pkg.spreadPaths`, parse, find the `Spread` node, `findDescendants(spreadNode, 'Page')`) already visits everything the new checks need; only the per-page-node body grows.
2. **Item counting counts IDML item-tag elements, not created scene nodes.** Define `IDML_ITEM_TAGS = new Set(['Group', 'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Image', 'EPS', 'PDF'])` and a small recursive `countItemTags(node: XMLParseNode): number` that counts every descendant whose tag is in that set (including nested `Group` children, since `importItemNode` recurses into groups the same way). This is a resource-exhaustion guard (matching the original design intent recorded in the superseded combined T-064 packet: "matching `FRAME_GUIDE_MAX`'s order of magnitude"), not a byte-exact prediction of node count, so counting XML elements rather than mirroring `importItemNode`'s full dispatch (which also handles unknown-tag skips and image-decode failures) is both simpler and sufficient. Per Fixed Decision 6 of the original combined packet, master content is imported once per page that applies it — so for each `<Page>`, count = `countItemTags(spreadNode)` + `countItemTags(appliedMasterNode)` when a master is applied, summed across all pages, matching how `importSpreadPageItems` actually creates nodes per page.
3. **Dimension is checked in px against the resolved `pxPerPt`, taking the maximum across every page before any frame is created.** `maxDimensionPx = max(bounds.width * pxPerPt, bounds.height * pxPerPt)` per page via the same `parseBounds` already imported into `import.ts`. One page over the limit aborts the whole import, matching the existing `IDML_MAX_PAGE_COUNT` behaviour (whole-file abort, not per-page skip) — a document containing one pathological page is not safe to partially import.
4. **New diagnostic codes, both `error` severity, both abort before any node is created:** `IDML_DIMENSION_EXCEEDED` (checked first, since it is the cheaper/more fundamental guard) and `IDML_ITEM_COUNT_EXCEEDED`, inserted immediately after the existing `totalPages > IDML_MAX_PAGE_COUNT` block and before `const baseDocName = ...` (`import.ts:461`), in the same `if (...) { diagnostics.push(...); return { graph, diagnostics } }` shape already used for the page-count check.

## Open Decisions

None. Both remaining questions (counting semantics, check placement) are closed by Fixed Decisions 1-4 above from source precedent.

## Allowed Changes

Existing files only:

- `App/packages/core/src/io/formats/idml/import.ts` — rename `countTotalIdmlPages` to `precomputeIdmlLimits`, extend its return shape and body, add `IDML_ITEM_TAGS`/`countItemTags`, add the two new checks and their diagnostics, widen the `./import/types` import.
- `App/tests/engine/io/formats/idml-import.test.ts` — add one new `describe` block with the two tests specified in Implementation Steps.

Anything outside this list, including `Plan/plan.md`, any `App/` file not named above, or any file under T-064a's or T-064c's Allowed Changes lists: stop and report.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report instead.

- **Do NOT touch `import/{package,summary,geometry,text,color}.ts`.** They are correct and fully tested (Verified Starting State A-B); this packet adds two checks to `import.ts` only, reusing their existing exports unchanged.
- **Do NOT change `IDML_MAX_ITEMS`, `IDML_MAX_DIMENSION_PX`, or any other constant's value.** They are already correctly declared in `import/types.ts`; this packet enforces them, it does not retune them.
- **Do NOT add a dependency.** `zipSync`/`strToU8` from `fflate` (already a dependency, already imported elsewhere in `tests/engine/io/`) are the only new test-file imports needed.
- **Do NOT touch T-064a's files** (`xml-parse.ts`, `import/package.ts`, `import/summary.ts`) **or T-064c's files** (`src/app/document/io/idml.ts`, `IdmlImportDialog.vue`, `tabs/index.ts`, `shell/menu/files.ts`, `dialogs.ts`, docs, `formats.ts`, `formats/idml/index.ts`) — all are already delivered and out of this packet's bound scope.
- **Do NOT write the missing IDML-import user-guide section.** That is T-064c's Allowed Changes, not this packet's.
- **Do NOT edit `Plan/plan.md`.** Report the stale status finding (Correction 2) in the final summary; the parent session owns the index.
- **Do NOT run `bun run check`, `bun run test`, `bun run test:unit`, or any package-manager command.** Use the focused gates below.
- **Do NOT build the desktop app, run NSIS, or bump any version file.**

## Implementation Steps

1. **Pre-flight.** Reread `import.ts:355-370` (`countTotalIdmlPages`), `:429-530` (`importIdml`), `:452-459` (the existing page-count check), and `:15-19` (the `./import/types` import block) to confirm no drift since this expansion.
2. **Widen the type import** at `import.ts:15-19` to also bring in `IDML_MAX_ITEMS` and `IDML_MAX_DIMENSION_PX`:

   ```ts
   import {
     IDML_MAX_DIMENSION_PX,
     IDML_MAX_ITEMS,
     IDML_MAX_PAGE_COUNT,
     type IdmlImportDiagnostic,
     type ImportIdmlOptions
   } from './import/types'
   ```

3. **Replace `countTotalIdmlPages` (`import.ts:355-370`) with `IDML_ITEM_TAGS`, `countItemTags`, and `precomputeIdmlLimits`:**

   ```ts
   const IDML_ITEM_TAGS = new Set([
     'Group',
     'Rectangle',
     'Oval',
     'Polygon',
     'GraphicLine',
     'TextFrame',
     'Image',
     'EPS',
     'PDF'
   ])

   function countItemTags(node: XMLParseNode): number {
     let count = 0
     for (const child of node.children) {
       if (IDML_ITEM_TAGS.has(child.tag)) count++
       count += countItemTags(child)
     }
     return count
   }

   function precomputeIdmlLimits(
     pkg: ReturnType<typeof readIdmlPackage> & object,
     masterSpreadMap: Map<string, XMLParseNode>,
     pxPerPt: number
   ): { totalPages: number; totalItems: number; maxDimensionPx: number } {
     let totalPages = 0
     let totalItems = 0
     let maxDimensionPx = 0

     for (const spreadPath of pkg.spreadPaths) {
       const spreadBytes = pkg.entries[spreadPath]
       if (!spreadBytes) continue

       let root: XMLParseNode
       try {
         root = parseXML(new TextDecoder().decode(spreadBytes))
         // oxlint-disable-next-line open-pencil/no-silent-catch
       } catch {
         continue
       }

       const spreadNode = root.tag === 'Spread' ? root : findDescendants(root, 'Spread').at(0)
       if (!spreadNode) continue

       const appliedMasterId = spreadNode.attrs['AppliedMaster'] || ''
       const masterNode = appliedMasterId ? masterSpreadMap.get(appliedMasterId) : undefined
       const pageNodes = findDescendants(spreadNode, 'Page')

       for (const pageNode of pageNodes) {
         totalPages++
         const bounds = parseBounds(pageNode.attrs['GeometricBounds'])
         maxDimensionPx = Math.max(maxDimensionPx, bounds.width * pxPerPt, bounds.height * pxPerPt)
         totalItems += countItemTags(spreadNode)
         if (masterNode) totalItems += countItemTags(masterNode)
       }
     }

     return { totalPages, totalItems, maxDimensionPx }
   }
   ```

   This removes `countTotalIdmlPages` entirely — its only call site is updated in the next step. `parseBounds`, `findDescendants`, `parseXML`, `XMLParseNode`, `readIdmlPackage` are all already imported into `import.ts` (lines 3-13); no new imports beyond step 2's constants.

4. **Update the single call site and checks in `importIdml`** (currently `import.ts:449-459`, right after `const masterSpreadMap = parseMasterSpreadMap(pkg)`):

   ```ts
   const masterSpreadMap = parseMasterSpreadMap(pkg)
   const { totalPages, totalItems, maxDimensionPx } = precomputeIdmlLimits(pkg, masterSpreadMap, pxPerPt)

   if (totalPages > IDML_MAX_PAGE_COUNT) {
     diagnostics.push({
       severity: 'error',
       code: 'IDML_PAGE_COUNT_EXCEEDED',
       message: `IDML exceeds ${IDML_MAX_PAGE_COUNT} pages limit (${totalPages} pages found).`
     })
     return { graph, diagnostics }
   }

   if (maxDimensionPx > IDML_MAX_DIMENSION_PX) {
     diagnostics.push({
       severity: 'error',
       code: 'IDML_DIMENSION_EXCEEDED',
       message: `IDML page dimension exceeds ${IDML_MAX_DIMENSION_PX}px limit (${Math.round(maxDimensionPx)}px found).`
     })
     return { graph, diagnostics }
   }

   if (totalItems > IDML_MAX_ITEMS) {
     diagnostics.push({
       severity: 'error',
       code: 'IDML_ITEM_COUNT_EXCEEDED',
       message: `IDML exceeds ${IDML_MAX_ITEMS} items limit (${totalItems} items found).`
     })
     return { graph, diagnostics }
   }
   ```

   This is a like-for-like replacement of the existing `const totalPages = countTotalIdmlPages(pkg)` line and its following `if` block — the page-count diagnostic's severity, code and message are unchanged, only its data source changed.

5. **Tests.** Add this `describe` block to the end of `tests/engine/io/formats/idml-import.test.ts`, immediately before the final closing `})` of the top-level `describe('IDML Import — T-064', ...)` block (i.e. as a sibling of the existing `describe('IDML as Non-Save-Target ...)` block). Add `import { strToU8, zipSync } from 'fflate'` and `import { IDML_MAX_ITEMS } from '#core/io/formats/idml'` to the file's existing import list (top of file, alongside the current `'#core/io'` import) — do not add these two symbols to the `#core/io` barrel itself.

   ```ts
   describe('Import Limits — IDML_MAX_ITEMS / IDML_MAX_DIMENSION_PX', () => {
     function buildSyntheticPackage(spreadXml: string): Uint8Array {
       const designMapXml = `<?xml version="1.0" encoding="UTF-8"?>
   <Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging">
     <idPkg:Spread src="Spreads/Spread_s1.xml" />
   </Document>`
       return zipSync({
         'designmap.xml': [strToU8(designMapXml), { level: 0 }],
         'Spreads/Spread_s1.xml': [strToU8(spreadXml), { level: 0 }]
       })
     }

     it('rejects a package whose item count exceeds IDML_MAX_ITEMS with no nodes created', async () => {
       const rectangles = Array.from(
         { length: IDML_MAX_ITEMS + 1 },
         (_, i) => `<Rectangle Self="r${i}" GeometricBounds="0 0 10 10" FillColor="Color/Black" />`
       ).join('')
       const spreadXml = `<?xml version="1.0" encoding="UTF-8"?>
   <Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" Self="s1">
     <Page Self="p1" GeometricBounds="0 0 400 300" />
     ${rectangles}
   </Spread>`

       const result = await importIdml(buildSyntheticPackage(spreadXml), { fileName: 'huge.idml' })
       expect(
         result.diagnostics.some((d) => d.code === 'IDML_ITEM_COUNT_EXCEEDED' && d.severity === 'error')
       ).toBe(true)
       expect(result.graph.getChildren(result.graph.getPages()[0].id)).toHaveLength(0)
     })

     it('rejects a page whose pixel dimension exceeds IDML_MAX_DIMENSION_PX with no nodes created', async () => {
       const spreadXml = `<?xml version="1.0" encoding="UTF-8"?>
   <Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" Self="s1">
     <Page Self="p1" GeometricBounds="0 0 999999 999999" />
   </Spread>`

       const result = await importIdml(buildSyntheticPackage(spreadXml), {
         fileName: 'giant.idml',
         documentDpi: 300
       })
       expect(
         result.diagnostics.some((d) => d.code === 'IDML_DIMENSION_EXCEEDED' && d.severity === 'error')
       ).toBe(true)
       expect(result.graph.getChildren(result.graph.getPages()[0].id)).toHaveLength(0)
     })
   })
   ```

   Both fixtures are minimal valid synthetic IDML: `readIdmlPackage` does not require a `mimetype` entry to parse (verified in `import/package.ts:98-175` — only `META-INF/container.xml`, falling back to a bare `designmap.xml` key, is consulted), and `resolvePackagePaths` (`import/package.ts:52-96`) reads `<idPkg:Spread src="...">` from the design map, so no `Resources/`, `META-INF/`, or `Stories/` entries are needed for these two limit checks to trigger before any semantic parsing occurs.

## Acceptance Criteria

- [x] `import.ts` no longer contains `countTotalIdmlPages`; `precomputeIdmlLimits` returns `{ totalPages, totalItems, maxDimensionPx }` and is the sole source for all three checks.
- [x] A page whose `GeometricBounds` converts to more than `IDML_MAX_DIMENSION_PX` px produces exactly one `error` diagnostic with code `IDML_DIMENSION_EXCEEDED` and creates zero scene nodes.
- [x] A package whose total item-tag count exceeds `IDML_MAX_ITEMS` produces exactly one `error` diagnostic with code `IDML_ITEM_COUNT_EXCEEDED` and creates zero scene nodes.
- [x] The existing `IDML_MAX_PAGE_COUNT` behaviour (code `IDML_PAGE_COUNT_EXCEEDED`, zero nodes) is unchanged.
- [x] All pre-existing tests in `idml-import.test.ts` and `idml-xml-parse.test.ts` still pass unmodified (dialect imports, round trip, DPI scaling, `.fig` isolation).
- [x] No new npm dependency; `package.json` and `bun.lock` unchanged.
- [x] No file outside this packet's Allowed Changes was edited.

## Verification

### Development loop — repeat as needed

```bash
bun test tests/engine/io/formats/idml-import.test.ts
```

### Final pre-completion gates — run once

Run from `App/`:

1. `bun test tests/engine/io/formats/idml-import.test.ts tests/engine/io/formats/idml-xml-parse.test.ts tests/engine/io/formats/idml-export.test.ts` — exit `0`, all prior counts unchanged plus the two new tests passing.
2. `bunx tsgo --noEmit` — exit `0`.
3. `bunx oxlint -c oxlint.json --type-aware --type-check packages/core/src/io/formats/idml/import.ts tests/engine/io/formats/idml-import.test.ts` — exit `0` (0 warnings, 0 errors).
4. `cd App && bun run dev`, then in the browser: drag `tests/fixtures/idml/indesign-sample.idml` into the editor, confirm `idml-import-dialog` still appears with the correct page count, confirm import still produces the expected frame and text — proving the refactor of `countTotalIdmlPages` into `precomputeIdmlLimits` did not change ordinary import behaviour. This is a non-regression check; the two new limit scenarios are covered by the engine test in gate 1, not the browser (a 20001-item file is not practical to hand-craft for a manual browser check).

Do not run `bun run check`, `bun run test`, or `bun run test:unit`.

## Integration or Installed-Result Check

Browser check only (step 4 above). No desktop build is required or authorised — this change has no Tauri-only, Rust, or `IS_TAURI` surface.

## Stop Conditions

- Stop if `countTotalIdmlPages`'s call site has drifted from `import.ts:449-459` since this expansion — reconcile against the live file before editing, do not guess.
- Stop if a real fixture (not the synthetic test packages) trips either new limit — that would mean the limits are miscalibrated for real files, and recalibrating a limit value is a product decision for the user, not this packet's implementer.
- Stop if merging the checks into `precomputeIdmlLimits` breaks the existing `IDML_PAGE_COUNT_EXCEEDED` test coverage in ways not explained by the rename.
- Stop and report if the work needs a file outside Allowed Changes, a new dependency, or a desktop build.

## Execution Report Contract

Report: the exact diff shape of `import.ts` (function removed, functions added, call site updated); the two new test names and their pass/fail; all four final-gate command exits; confirmation that `idml-xml-parse.test.ts` and `idml-export.test.ts` counts are unchanged; the browser-check observation from gate 4; and restate Corrections 2 (stale `Plan/plan.md` status for T-064a/c) and the missing IDML-import doc section (Verified Starting State C) for the user, since neither is this packet's to fix.

## Status record

2026-08-20 — Re-expanded. Found the stub's entire described contract already implemented and tested (T-064a and T-064c likewise already delivered in source despite `Plan/plan.md` listing them `Ready`/`To Do`); narrowed this packet to the one verified gap inside its own bound files — `IDML_MAX_ITEMS` and `IDML_MAX_DIMENSION_PX` declared and exported but never enforced. Packet is `Ready` for that bounded slice.
2026-08-24 — Executed. Precompute limits unified and tested with all 42 tests passing across idml-import, idml-xml-parse, idml-export; tsgo, oxlint, and Playwright E2E passed cleanly. Marked Done.
