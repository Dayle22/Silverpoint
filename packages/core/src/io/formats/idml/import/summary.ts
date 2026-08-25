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
  parseGraphicSwatches(pkg.graphicXml, diagnostics)

  const pages: IdmlPageSummary[] = []
  let pageIndex = 1

  for (const spreadPath of pkg.spreadPaths) {
    const spreadBytes = pkg.entries[spreadPath]
    if (!spreadBytes) continue

    const spreadXml = new TextDecoder().decode(spreadBytes)
    let root: XMLParseNode
    try {
      root = parseXML(spreadXml)
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
    const spreadXml = new TextDecoder().decode(spreadBytes)
    if (spreadXml.includes('<Link')) {
      try {
        const root = parseXML(spreadXml)
        const linkNodes = findDescendants(root, 'Link')
        for (const linkNode of linkNodes) {
          const linkUri = linkNode.attrs['LinkResourceURI'] || linkNode.attrs['FilePath'] || 'external link'
          diagnostics.push({
            severity: 'warning',
            code: 'IDML_EXTERNAL_LINK_SKIPPED',
            message: `External image resource "${linkUri}" cannot be embedded; skipped.`,
            detail: linkUri
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
