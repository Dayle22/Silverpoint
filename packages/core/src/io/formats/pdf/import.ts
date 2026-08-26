import { BLACK, IS_BROWSER } from '#core/constants'
import { SceneGraph } from '@open-pencil/scene-graph'
import type { SceneNode } from '@open-pencil/scene-graph'

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

import { extractNativeVectors, type PDFOperatorList } from './vector'

export const PDF_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB
export const PDF_MAX_PAGE_COUNT = 500
export const PDF_MAX_DIMENSION_POINTS = 14400

export type PDFDiagnosticSeverity = 'info' | 'warning' | 'error'

export interface PDFImportDiagnostic {
  severity: PDFDiagnosticSeverity
  code: string
  message: string
  pageNumber?: number
  detail?: string
}

export interface PDFPageSummary {
  pageNumber: number
  widthPt: number
  heightPt: number
  rotation: number
}

export interface ImportPDFPageOptions {
  renderScale?: number
  fileName?: string
}

const STANDARD_FONTS = new Set([
  'inter',
  'helvetica',
  'arial',
  'times',
  'times new roman',
  'courier',
  'courier new',
  'roboto',
  'sans-serif',
  'serif',
  'monospace'
])

interface PDFCommonObjs {
  has(name: string): boolean
  get(name: string): { name?: string; loadedName?: string } | undefined
}

interface PDFObjectsTarget {
  has(name: string): boolean
  get(name: string, callback: (data: unknown) => void): void
}

export type ExtendedPDFPageProxy = pdfjsLib.PDFPageProxy & {
  commonObjs?: PDFCommonObjs
  objs?: PDFObjectsTarget
}

interface PDFTextItem {
  str: string
  fontName?: string
  width: number
  height: number
  transform: number[]
  dir?: string
  hasEOL?: boolean
}

interface PDFTextContent {
  items: PDFTextItem[]
  styles: Record<string, { fontFamily?: string }>
}

interface RenderPageParams {
  canvasContext?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  canvas?: HTMLCanvasElement | null
  viewport: pdfjsLib.PageViewport
}

type PDFGetDocumentFn = (params: unknown) => pdfjsLib.PDFDocumentLoadingTask

function isTextItem(item: unknown): item is PDFTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'str' in item &&
    typeof (item as { str: unknown }).str === 'string'
  )
}

function ensureWorkerConfigured() {
  if (IS_BROWSER && !pdfjsLib.GlobalWorkerOptions.workerSrc && !pdfjsLib.GlobalWorkerOptions.workerPort) {
    try {
      const origin = globalThis.location.origin
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
        origin
      ).href
    } catch (error) {
      console.warn('[PDF Import] Worker initialization fallback:', error)
    }
  }
}

function mapToStandardFont(fontName: string): { fontFamily: string; isStandard: boolean } {
  if (!fontName) {
    return { fontFamily: 'Inter', isStandard: false }
  }
  const clean = fontName
    .replace(/^.*[+/]/, '')
    .replace(/-(?:Bold|Regular|Italic|BoldItalic|Light|Medium|Black|SemiBold).*$/i, '')
    .trim()

  const lower = clean.toLowerCase()
  if (STANDARD_FONTS.has(lower) || lower.includes('helvetica') || lower.includes('arial')) {
    return { fontFamily: 'Inter', isStandard: true }
  }
  return { fontFamily: 'Inter', isStandard: false }
}

function loadPDFDocument(data: Uint8Array): pdfjsLib.PDFDocumentLoadingTask {
  ensureWorkerConfigured()
  const initParams: Record<string, unknown> = {
    data: data.slice(),
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    stopAtErrors: false
  }
  const getDocument = pdfjsLib.getDocument as PDFGetDocumentFn
  return getDocument(initParams)
}

function createErrorDiagnostic(code: string, message: string, detail?: string): PDFImportDiagnostic {
  return { severity: 'error', code, message, detail }
}

function checkLimits(dataLength: number, diagnostics: PDFImportDiagnostic[]): boolean {
  if (dataLength === 0) {
    diagnostics.push(createErrorDiagnostic('PDF_EMPTY_FILE', 'PDF file is empty.'))
    return false
  }
  if (dataLength > PDF_MAX_FILE_SIZE_BYTES) {
    diagnostics.push(
      createErrorDiagnostic('PDF_FILE_TOO_LARGE', `PDF exceeds maximum size of 100 MB (${dataLength} bytes).`)
    )
    return false
  }
  return true
}

export async function readPDFSummary(
  data: Uint8Array
): Promise<{ pages: PDFPageSummary[]; diagnostics: PDFImportDiagnostic[] }> {
  const diagnostics: PDFImportDiagnostic[] = []
  if (!checkLimits(data.byteLength, diagnostics)) {
    return { pages: [], diagnostics }
  }

  const loadingTask = loadPDFDocument(data)
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null

  try {
    pdfDoc = await loadingTask.promise
  } catch (error) {
    const err = error as { name?: string; message?: string }
    const isPassword =
      err.name === 'PasswordException' ||
      (typeof err.message === 'string' && err.message.toLowerCase().includes('password'))

    if (isPassword) {
      diagnostics.push(
        createErrorDiagnostic(
          'PDF_ENCRYPTED',
          'PDF is password protected / encrypted and cannot be opened without authentication.'
        )
      )
    } else {
      diagnostics.push(
        createErrorDiagnostic('PDF_PARSE_ERROR', `Failed to parse PDF: ${err.message || 'Invalid PDF structure'}`)
      )
    }
    return { pages: [], diagnostics }
  }

  const pages: PDFPageSummary[] = []
  const numPages = pdfDoc.numPages

  if (numPages > PDF_MAX_PAGE_COUNT) {
    diagnostics.push(
      createErrorDiagnostic(
        'PDF_PAGE_COUNT_EXCEEDED',
        `PDF exceeds 500 pages limit (${numPages} pages found).`
      )
    )
    await loadingTask.destroy()
    return { pages: [], diagnostics }
  }

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdfDoc.getPage(i)
      const vp = page.getViewport({ scale: 1 })
      const widthPt = vp.width
      const heightPt = vp.height

      if (widthPt > PDF_MAX_DIMENSION_POINTS || heightPt > PDF_MAX_DIMENSION_POINTS) {
        diagnostics.push(
          createErrorDiagnostic(
            'PDF_PAGE_DIMENSIONS_EXCEEDED',
            `Page ${i} exceeds maximum dimension limit of 14400 pt (${Math.round(widthPt)}×${Math.round(heightPt)} pt).`,
            `Page ${i}`
          )
        )
      }

      pages.push({
        pageNumber: i,
        widthPt,
        heightPt,
        rotation: 0
      })
    } catch (pageErr) {
      const err = pageErr as { message?: string }
      diagnostics.push(
        createErrorDiagnostic('PDF_PAGE_ERROR', `Failed to read page ${i}: ${err.message || 'Unknown error'}`)
      )
    }
  }

  await loadingTask.destroy()
  return { pages, diagnostics }
}

async function renderPageRaster(
  page: ExtendedPDFPageProxy,
  renderScale: number
): Promise<Uint8Array | null> {
  try {
    const vp = page.getViewport({ scale: renderScale })
    const targetWidth = Math.ceil(vp.width)
    const targetHeight = Math.ceil(vp.height)

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(targetWidth, targetHeight)
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const renderFn = page.render.bind(page) as (params: RenderPageParams) => {
          promise: Promise<void>
        }
        await renderFn({
          canvasContext: ctx,
          canvas: null,
          viewport: vp
        }).promise
        const blob = await canvas.convertToBlob({ type: 'image/png' })
        return new Uint8Array(await blob.arrayBuffer())
      }
    }
  } catch (error) {
    console.warn('[PDF Import] Raster rendering failed; continuing with vector/text fallback:', error)
  }
  return null
}

function buildFrame(
  graph: SceneGraph,
  canvasPage: SceneNode,
  frameName: string,
  width: number,
  height: number,
  rasterBytes: Uint8Array | null
): SceneNode {
  const frame = graph.createNode('FRAME', canvasPage.id, {
    name: frameName,
    width,
    height
  })

  frame.x = 0
  frame.y = 0
  frame.clipsContent = true

  if (rasterBytes && rasterBytes.length > 0) {
    const hash = 'pdf-raster-bg'
    graph.images.set(hash, rasterBytes)
    frame.fills = [
      {
        type: 'IMAGE',
        color: BLACK,
        opacity: 1,
        visible: true,
        imageHash: hash,
        imageScaleMode: 'FILL'
      }
    ]
  } else {
    frame.fills = [
      {
        type: 'SOLID',
        color: { r: 1, g: 1, b: 1, a: 1 },
        opacity: 1,
        visible: true
      }
    ]
  }

  return frame
}

function resolveRawFontName(item: PDFTextItem, page: ExtendedPDFPageProxy, textContent: PDFTextContent): string {
  const commonObjs = page.commonObjs
  if (item.fontName && commonObjs.has(item.fontName)) {
    const fontObj = commonObjs.get(item.fontName)
    const name = fontObj?.name || fontObj?.loadedName
    if (name) return name
  }
  if (item.fontName && textContent.styles[item.fontName]?.fontFamily) {
    return textContent.styles[item.fontName].fontFamily ?? ''
  }
  return ''
}

function createSingleTextNode(
  graph: SceneGraph,
  frameId: string,
  item: PDFTextItem,
  fontFamily: string,
  pageHeight: number
) {
  const text = item.str.trim()
  const tx = item.transform[4] ?? 0
  const ty = item.transform[5] ?? 0
  const scaleY = item.transform[3] ?? 12
  const fontSize = Math.max(Math.round(Math.abs(scaleY) * 100) / 100, 6)

  const textWidth = Math.max(
    item.width > 0
      ? Math.round(item.width * 100) / 100
      : Math.round(text.length * fontSize * 0.6 * 100) / 100,
    1
  )
  const textHeight = Math.max(
    item.height > 0
      ? Math.round(item.height * 100) / 100
      : Math.round(fontSize * 1.2 * 100) / 100,
    1
  )

  const nodeY = Math.max(0, Math.round((pageHeight - ty - fontSize) * 100) / 100)
  const nodeX = Math.max(0, Math.round(tx * 100) / 100)

  const textNode = graph.createNode('TEXT', frameId, {
    name: text.slice(0, 32) || 'Text',
    text,
    width: textWidth,
    height: textHeight
  })
  textNode.x = nodeX
  textNode.y = nodeY
  textNode.fontSize = fontSize
  textNode.fontFamily = fontFamily
  textNode.fills = [
    {
      type: 'SOLID',
      color: BLACK,
      opacity: 1,
      visible: true
    }
  ]
}

function extractTextNodes(
  graph: SceneGraph,
  frameId: string,
  page: ExtendedPDFPageProxy,
  textContent: PDFTextContent,
  pageHeight: number,
  pageNumber: number,
  diagnostics: PDFImportDiagnostic[]
) {
  const seenUnresolvedFonts = new Set<string>()

  for (const item of textContent.items) {
    if (!item.str || typeof item.str !== 'string') continue
    const text = item.str.trim()
    if (!text) continue

    const rawFontName = resolveRawFontName(item, page, textContent)
    const { fontFamily, isStandard } = mapToStandardFont(rawFontName)

    if (!isStandard && rawFontName && !seenUnresolvedFonts.has(rawFontName)) {
      seenUnresolvedFonts.add(rawFontName)
      diagnostics.push({
        severity: 'warning',
        code: 'UNRESOLVED_FONT',
        message: `Font "${rawFontName}" is not available; text properties preserved with standard font.`,
        pageNumber,
        detail: rawFontName
      })
    }

    createSingleTextNode(graph, frameId, item, fontFamily, pageHeight)
  }
}

export async function importPDFPage(
  data: Uint8Array,
  pageNumber = 1,
  options: ImportPDFPageOptions = {}
): Promise<{ graph: SceneGraph; diagnostics: PDFImportDiagnostic[] }> {
  const diagnostics: PDFImportDiagnostic[] = []
  const graph = new SceneGraph()
  const canvasPage = graph.getPages()[0]

  const summary = await readPDFSummary(data)
  for (const diag of summary.diagnostics) {
    diagnostics.push(diag)
  }
  if (diagnostics.some((d) => d.severity === 'error')) {
    return { graph, diagnostics }
  }

  const pageSummary = summary.pages.find((p) => p.pageNumber === pageNumber)
  if (!pageSummary) {
    diagnostics.push(
      createErrorDiagnostic('PDF_INVALID_PAGE_NUMBER', `Page number ${pageNumber} does not exist in PDF.`)
    )
    return { graph, diagnostics }
  }

  const loadingTask = loadPDFDocument(data)
  let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null

  try {
    pdfDoc = await loadingTask.promise
    const page = (await pdfDoc.getPage(pageNumber)) as ExtendedPDFPageProxy

    const baseDocName = (options.fileName || 'Document').replace(/\.[^.]+$/i, '')
    const frameName = `${baseDocName} - Page ${pageNumber}`
    const frame = buildFrame(
      graph,
      canvasPage,
      frameName,
      pageSummary.widthPt,
      pageSummary.heightPt,
      null
    )

    let opList: PDFOperatorList | null = null
    try {
      opList = (await page.getOperatorList()) as PDFOperatorList
    } catch (opErr) {
      console.warn('[PDF Import] getOperatorList error ignored:', opErr)
    }

    let nativeVectorCount = 0
    if (opList) {
      const vectorRes = await extractNativeVectors(
        graph,
        frame.id,
        page,
        opList,
        pageSummary.heightPt,
        diagnostics,
        pageNumber
      )
      nativeVectorCount = vectorRes.extractedCount
    }

    const rawTextContent = await page.getTextContent()
    const items: PDFTextItem[] = []
    for (const rawItem of rawTextContent.items) {
      if (isTextItem(rawItem)) {
        items.push(rawItem)
      }
    }
    const textContent: PDFTextContent = {
      items,
      styles: rawTextContent.styles
    }
    extractTextNodes(graph, frame.id, page, textContent, pageSummary.heightPt, pageNumber, diagnostics)

    // If no native vector or text nodes were extracted, fall back to raster rendering
    if (nativeVectorCount === 0 && items.length === 0) {
      const renderScale = options.renderScale ?? 2
      const rasterBytes = await renderPageRaster(page, renderScale)
      if (rasterBytes && rasterBytes.length > 0) {
        const hash = 'pdf-raster-bg'
        graph.images.set(hash, rasterBytes)
        frame.fills = [
          {
            type: 'IMAGE',
            color: BLACK,
            opacity: 1,
            visible: true,
            imageHash: hash,
            imageScaleMode: 'FILL'
          }
        ]
        diagnostics.push({
          severity: 'info',
          code: 'STAGE_A_RASTER_GRAPHICS',
          message: 'Page visual content rendered as raster background.',
          pageNumber
        })
      }
    }

    await loadingTask.destroy()
  } catch (error) {
    const err = error as { message?: string }
    diagnostics.push(
      createErrorDiagnostic('PDF_IMPORT_FAILED', `Failed to import PDF page: ${err.message || 'Unknown error'}`)
    )
  }

  return { graph, diagnostics }
}
