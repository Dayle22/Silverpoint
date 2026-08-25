import { unzipSync } from 'fflate'

import { findDescendants, findFirstChild, parseXML, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import { IDML_MAX_FILE_SIZE_BYTES, type IdmlImportDiagnostic } from './types'

export interface IdmlPackageParts {
  entries: Record<string, Uint8Array | undefined>
  designMapXml: string
  designMapNode: XMLParseNode
  graphicXml?: string
  fontsXml?: string
  stylesXml?: string
  preferencesXml?: string
  masterSpreadPaths: string[]
  spreadPaths: string[]
  storyPaths: string[]
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function findDesignMapPath(entries: Record<string, Uint8Array | undefined>): string {
  const containerBytes = entries['META-INF/container.xml']
  if (containerBytes) {
    try {
      const containerXml = decodeUtf8(containerBytes)
      const containerNode = parseXML(containerXml)
      const rootfiles = findDescendants(containerNode, 'rootfile')
      const rootfile = rootfiles.at(0)
      if (rootfile?.attrs['full-path']) {
        return rootfile.attrs['full-path'].replace(/^\//, '')
      }
      // oxlint-disable-next-line open-pencil/no-silent-catch
    } catch {
      // Fallback to designmap.xml
    }
  }
  return 'designmap.xml'
}

interface PackagePaths {
  graphicPath: string
  fontsPath: string
  stylesPath: string
  preferencesPath: string
  masterSpreadPaths: string[]
  spreadPaths: string[]
  storyPaths: string[]
}

function resolvePackagePaths(
  designMapNode: XMLParseNode,
  entries: Record<string, Uint8Array | undefined>
): PackagePaths {
  function resolveSrc(tag: string): string | undefined {
    const el = findFirstChild(designMapNode, tag)
    return el?.attrs['src']
  }

  function resolveAllSrc(tag: string): string[] {
    return designMapNode.children
      .filter((c) => c.tag === tag && c.attrs['src'])
      .map((c) => c.attrs['src'].replace(/^\//, ''))
  }

  const graphicPath = resolveSrc('idPkg:Graphic') || 'Resources/Graphic.xml'
  const fontsPath = resolveSrc('idPkg:Fonts') || 'Resources/Fonts.xml'
  const stylesPath = resolveSrc('idPkg:Styles') || 'Resources/Styles.xml'
  const preferencesPath = resolveSrc('idPkg:Preferences') || 'Resources/Preferences.xml'

  const masterSpreadPaths = resolveAllSrc('idPkg:MasterSpread')
  let spreadPaths = resolveAllSrc('idPkg:Spread')
  let storyPaths = resolveAllSrc('idPkg:Story')

  if (spreadPaths.length === 0) {
    spreadPaths = Object.keys(entries).filter(
      (k) => k.startsWith('Spreads/') && k.endsWith('.xml')
    )
  }
  if (storyPaths.length === 0) {
    storyPaths = Object.keys(entries).filter(
      (k) => k.startsWith('Stories/') && k.endsWith('.xml')
    )
  }

  return {
    graphicPath,
    fontsPath,
    stylesPath,
    preferencesPath,
    masterSpreadPaths,
    spreadPaths,
    storyPaths
  }
}

export function readIdmlPackage(
  data: Uint8Array,
  diagnostics: IdmlImportDiagnostic[]
): IdmlPackageParts | null {
  if (data.byteLength === 0) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_EMPTY_FILE',
      message: 'IDML file is empty.'
    })
    return null
  }

  if (data.byteLength > IDML_MAX_FILE_SIZE_BYTES) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_FILE_TOO_LARGE',
      message: `IDML exceeds maximum size of 100 MB (${data.byteLength} bytes).`
    })
    return null
  }

  let entries: Record<string, Uint8Array | undefined>
  try {
    entries = unzipSync(data) as Record<string, Uint8Array | undefined>
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_INVALID_ZIP',
      message: `Failed to open IDML archive: ${err instanceof Error ? err.message : String(err)}`
    })
    return null
  }

  const designMapPath = findDesignMapPath(entries)
  const designMapBytes = entries[designMapPath]
  if (!designMapBytes) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_MISSING_DESIGNMAP',
      message: `Required designmap (${designMapPath}) is missing from IDML package.`
    })
    return null
  }

  const designMapXml = decodeUtf8(designMapBytes)
  let designMapNode: XMLParseNode
  try {
    designMapNode = parseXML(designMapXml)
  } catch (err) {
    diagnostics.push({
      severity: 'error',
      code: 'IDML_CORRUPT_DESIGNMAP',
      message: `Failed to parse designmap.xml: ${err instanceof Error ? err.message : String(err)}`
    })
    return null
  }

  const paths = resolvePackagePaths(designMapNode, entries)

  const graphicBytes = entries[paths.graphicPath]
  const fontsBytes = entries[paths.fontsPath]
  const stylesBytes = entries[paths.stylesPath]
  const preferencesBytes = entries[paths.preferencesPath]

  return {
    entries,
    designMapXml,
    designMapNode,
    graphicXml: graphicBytes ? decodeUtf8(graphicBytes) : undefined,
    fontsXml: fontsBytes ? decodeUtf8(fontsBytes) : undefined,
    stylesXml: stylesBytes ? decodeUtf8(stylesBytes) : undefined,
    preferencesXml: preferencesBytes ? decodeUtf8(preferencesBytes) : undefined,
    masterSpreadPaths: paths.masterSpreadPaths,
    spreadPaths: paths.spreadPaths,
    storyPaths: paths.storyPaths
  }
}
