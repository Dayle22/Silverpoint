import { findDescendants, parseXML, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import { parseGraphicSwatches } from './color'
import { parseBounds } from './geometry'
import { readIdmlPackage } from './package'
import {
  IDML_MAX_PAGE_COUNT,
  type IdmlImportDiagnostic,
  type IdmlPageSummary
} from './types'

export async function readIdmlSummary(
  data: Uint8Array
): Promise<{ pages: IdmlPageSummary[]; diagnostics: IdmlImportDiagnostic[] }> {
  const diagnostics: IdmlImportDiagnostic[] = []

  const pkg = readIdmlPackage(data, diagnostics)
  if (!pkg || diagnostics.some((d) => d.severity === 'error')) {
    return { pages: [], diagnostics }
  }

  // Pre-scan swatches for any CMYK or unsupported color space notices
  parseGraphicSwatches(pkg.graphicXML, diagnostics)

  const pages: IdmlPageSummary[] = []
  let pageIndex = 1

  for (const spreadPath of pkg.spreadPaths) {
    const spreadBytes = pkg.entries[spreadPath]
    if (!spreadBytes) continue

    const spreadXML = new TextDecoder().decode(spreadBytes)
    let root: XMLParseNode
    try {
      root = parseXML(spreadXML)
      // oxlint-disable-next-line open-pencil/no-silent-catch
    } catch {
      continue
    }

    const pageNodes = findDescendants(root, 'Page')
    for (const pageNode of pageNodes) {
      const bounds = parseBounds(pageNode.attrs['GeometricBounds'])
      pages.push({
        pageNumber: pageIndex++,
        widthPt: Math.round(bounds.width * 100) / 100,
        heightPt: Math.round(bounds.height * 100) / 100
      })
    }
  }

  if (pages.length > IDML_MAX_PAGE_COUNT) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_PAGE_COUNT_EXCEEDED',
      message: `IDML exceeds ${IDML_MAX_PAGE_COUNT} pages limit (${pages.length} pages found).`
    })
    return { pages: [], diagnostics }
  }

  // Check for external image links in spreads
  for (const spreadPath of pkg.spreadPaths) {
    const spreadBytes = pkg.entries[spreadPath]
    if (!spreadBytes) continue
    const spreadXML = new TextDecoder().decode(spreadBytes)
    if (spreadXML.includes('<Link')) {
      try {
        const root = parseXML(spreadXML)
        const linkNodes = findDescendants(root, 'Link')
        for (const linkNode of linkNodes) {
          const linkURI = linkNode.attrs['LinkResourceURI'] || linkNode.attrs['FilePath'] || 'external link'
          diagnostics.push({
            severity: 'warning',
            code: 'IDML_EXTERNAL_LINK_SKIPPED',
            message: `External image resource "${linkURI}" cannot be embedded; skipped.`,
            detail: linkURI
          })
        }
        // oxlint-disable-next-line open-pencil/no-silent-catch
      } catch {
        // Continue
      }
    }
  }

  return { pages, diagnostics }
}
