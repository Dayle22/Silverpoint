import type { jsPDF } from 'jspdf'
import type { svg2pdf } from 'svg2pdf.js'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import { parseFrameGuides } from '#core/guides/frame'
import { computeContentBounds, renderNodesToImage } from '#core/io/formats/raster'
import { renderNodesToSVG } from '#core/io/formats/svg'
import type { ExportTarget, IOContext } from '#core/io/types'
import { parseDocumentUnits } from '#core/units/document'
import type { PrintExportResult, PrintPreflightResult } from '../../types'

export interface PrintPDFExportOptions {
  cropMarks?: boolean
  documentDpi?: number
  includeBleedContent?: boolean
  title?: string
}

export type PrintPDFPreflightResult = PrintPreflightResult
export type PrintPDFExportResult = PrintExportResult

function findPageIdForNode(graph: SceneGraph, nodeId: string): string | null {
  let current = graph.getNode(nodeId)
  while (current) {
    if (current.type === 'CANVAS') {
      return current.id
    }
    const parentId = current.parentId
    if (!parentId) break
    current = graph.getNode(parentId)
  }
  const firstPage = graph.getPages().at(0)
  return firstPage ? firstPage.id : null
}

export function resolveTargetFrame(
  graph: SceneGraph,
  target: ExportTarget
): { frame: SceneNode; pageId: string } {
  let targetNodeId: string | null = null
  let pageId: string | null = null

  if (target.scope === 'node') {
    targetNodeId = target.nodeId
    pageId = findPageIdForNode(graph, target.nodeId)
  } else if (target.scope === 'selection') {
    if (target.nodeIds.length !== 1) {
      throw new Error('Production PDF requires a single frame target')
    }
    targetNodeId = target.nodeIds[0]
    pageId = findPageIdForNode(graph, targetNodeId)
  } else if (target.scope === 'page') {
    pageId = target.pageId
    const children = graph.getChildren(target.pageId)
    const topFrames = children.filter((c) => c.type === 'FRAME')
    if (topFrames.length !== 1) {
      throw new Error('Production PDF requires a single frame target')
    }
    targetNodeId = topFrames[0].id
  }

  if (!targetNodeId || !pageId) {
    throw new Error('Production PDF requires a single frame target')
  }

  const frame = graph.getNode(targetNodeId)
  if (frame?.type !== 'FRAME') {
    throw new Error('Production PDF requires a single frame target')
  }

  return { frame, pageId }
}

export function collectFallbackReasons(graph: SceneGraph, frameId: string): string[] {
  const reasons: string[] = []

  function checkNode(node: SceneNode) {
    if (node.effects.some((e) => e.type === 'BACKGROUND_BLUR' && e.visible)) {
      reasons.push(`Background blur on '${node.name}'`)
    }
    if (node.isMask) {
      reasons.push(`Layer mask on '${node.name}'`)
    }
    if (
      node.effects.some(
        (e) => e.type === 'LAYER_BLUR' && (e as { progressive?: boolean }).progressive && e.visible
      )
    ) {
      reasons.push(`Progressive blur on '${node.name}'`)
    }

    const children = graph.getChildren(node.id)
    for (const child of children) {
      checkNode(child)
    }
  }

  const frame = graph.getNode(frameId)
  if (frame) {
    checkNode(frame)
  }

  return reasons
}

function resolveEffectiveDpi(graph: SceneGraph, documentDpi?: number): number {
  if (documentDpi && documentDpi > 0) return documentDpi
  const firstPage = graph.getPages().at(0)
  return parseDocumentUnits(firstPage ? firstPage.pluginData : []).dpi || 300
}

interface BleedInsets {
  bT: number
  bR: number
  bB: number
  bL: number
  isZeroBleed: boolean
}

function computeBleedInsets(frame: SceneNode, ptPerPx: number): BleedInsets {
  const guides = parseFrameGuides(frame.pluginData)
  const bT = (guides.bleed.enabled ? guides.bleed.top : 0) * ptPerPx
  const bR = (guides.bleed.enabled ? guides.bleed.right : 0) * ptPerPx
  const bB = (guides.bleed.enabled ? guides.bleed.bottom : 0) * ptPerPx
  const bL = (guides.bleed.enabled ? guides.bleed.left : 0) * ptPerPx
  const isZeroBleed = bT === 0 && bR === 0 && bB === 0 && bL === 0
  return { bT, bR, bB, bL, isZeroBleed }
}

function hasZeroBleedOverhang(graph: SceneGraph, frame: SceneNode): boolean {
  const bounds = computeContentBounds(graph, [frame.id])
  if (!bounds) return false
  const frameAbs = graph.getAbsolutePosition(frame.id)
  const epsilon = 0.001
  return (
    bounds.minX < frameAbs.x - epsilon ||
    bounds.minY < frameAbs.y - epsilon ||
    bounds.maxX > frameAbs.x + frame.width + epsilon ||
    bounds.maxY > frameAbs.y + frame.height + epsilon
  )
}

export function preflightPrintPDF(
  graph: SceneGraph,
  target: ExportTarget,
  documentDpi?: number
): PrintPDFPreflightResult {
  const errors: string[] = []
  const warnings: string[] = []

  let resolved: { frame: SceneNode; pageId: string } | null = null
  try {
    resolved = resolveTargetFrame(graph, target)
  } catch (err) {
    errors.push((err as Error).message)
    return {
      valid: false,
      errors,
      warnings,
      rasterFallback: false
    }
  }

  const frame = resolved.frame
  const dpi = resolveEffectiveDpi(graph, documentDpi)
  const ptPerPx = 72 / dpi

  const W = frame.width * ptPerPx
  const H = frame.height * ptPerPx

  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) {
    errors.push('Production PDF requires positive finite frame dimensions')
  }

  const { bT, bR, bB, bL, isZeroBleed } = computeBleedInsets(frame, ptPerPx)
  const M = 12
  const mediaBoxW = bL + W + bR + 2 * M
  const mediaBoxH = bB + H + bT + 2 * M

  if (mediaBoxW > 14400 || mediaBoxH > 14400) {
    errors.push('MediaBox exceeds maximum PDF dimension limit of 14400 pt')
  }

  const fallbackReasons = collectFallbackReasons(graph, frame.id)
  const rasterFallback = fallbackReasons.length > 0
  let rasterFallbackReason: string | undefined
  if (rasterFallback) {
    rasterFallbackReason = fallbackReasons.join(', ')
    warnings.push(`Rasterised because: ${rasterFallbackReason}`)
  }

  if (isZeroBleed && hasZeroBleedOverhang(graph, frame)) {
    warnings.push('Content overhangs trim edge with 0 bleed')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rasterFallback,
    rasterFallbackReason
  }
}

// jsPDF's public types omit `internal.write`, which is the documented hook for
// appending raw entries to the page dictionary. Widen the known `internal` type
// rather than routing through `unknown`.
type JSPDFWithWrite = jsPDF['internal'] & {
  write: (...args: string[]) => void
}

function formatPt(value: number): string {
  const rounded = Math.round(value * 10000) / 10000
  return (Object.is(rounded, -0) ? 0 : rounded).toString()
}

function drawCropMarks(
  doc: jsPDF,
  xTL: number,
  yTL: number,
  xBR: number,
  yBR: number
) {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.25)

  const xTR = xBR
  const yTR = yTL
  const xBL = xTL
  const yBL = yBR

  const OFFSET = 3
  const LENGTH = 8

  // Top-Left
  doc.line(xTL, yTL - OFFSET, xTL, yTL - OFFSET - LENGTH)
  doc.line(xTL - OFFSET, yTL, xTL - OFFSET - LENGTH, yTL)

  // Top-Right
  doc.line(xTR, yTR - OFFSET, xTR, yTR - OFFSET - LENGTH)
  doc.line(xTR + OFFSET, yTR, xTR + OFFSET + LENGTH, yTR)

  // Bottom-Left
  doc.line(xBL, yBL + OFFSET, xBL, yBL + OFFSET + LENGTH)
  doc.line(xBL - OFFSET, yBL, xBL - OFFSET - LENGTH, yBL)

  // Bottom-Right
  doc.line(xBR, yBR + OFFSET, xBR, yBR + OFFSET + LENGTH)
  doc.line(xBR + OFFSET, yBR, xBR + OFFSET + LENGTH, yBR)
}

async function renderArtworkToDoc(
  doc: jsPDF,
  svg2pdfFn: typeof svg2pdf,
  graph: SceneGraph,
  pageId: string,
  frameId: string,
  needsBackdrop: boolean,
  dpi: number,
  artX: number,
  artY: number,
  artW: number,
  artH: number,
  context?: IOContext
): Promise<boolean> {
  if (needsBackdrop) {
    if (!context?.canvasKit || !context.renderer) return false
    const scale = dpi / 72
    const png = renderNodesToImage(
      context.canvasKit,
      context.renderer,
      graph,
      pageId,
      [frameId],
      {
        format: 'PNG',
        scale
      }
    )
    if (!png) return false
    let binary = ''
    for (const byte of png) binary += String.fromCharCode(byte)
    doc.addImage(`data:image/png;base64,${btoa(binary)}`, 'PNG', artX, artY, artW, artH)
    return true
  }

  const svg = renderNodesToSVG(
    graph,
    pageId,
    [frameId],
    { xmlDeclaration: false }
  )
  if (!svg) return false
  const parser = new DOMParser()
  const svgDoc = parser.parseFromString(svg, 'image/svg+xml')
  const svgElement = svgDoc.documentElement
  const parseError = svgDoc.querySelector('parsererror')
  if (parseError) return false
  await svg2pdfFn(svgElement, doc, { x: artX, y: artY, width: artW, height: artH })
  return true
}

function setupPageBoxes(
  doc: jsPDF,
  trimBox: number[],
  bleedBox: number[],
  artBox: number[]
) {
  doc.internal.events.subscribe('putPage', () => {
    const internal = doc.internal as JSPDFWithWrite
    internal.write(
      `/TrimBox [${formatPt(trimBox[0])} ${formatPt(trimBox[1])} ${formatPt(trimBox[2])} ${formatPt(trimBox[3])}]`
    )
    internal.write(
      `/BleedBox [${formatPt(bleedBox[0])} ${formatPt(bleedBox[1])} ${formatPt(bleedBox[2])} ${formatPt(bleedBox[3])}]`
    )
    internal.write(
      `/ArtBox [${formatPt(artBox[0])} ${formatPt(artBox[1])} ${formatPt(artBox[2])} ${formatPt(artBox[3])}]`
    )
  })
}

/**
 * The page boxes are written through jsPDF's `putPage` event, which reports no
 * result of its own. A production PDF whose boxes silently failed to land is
 * worse than no file at all, so confirm they reached the output bytes and treat
 * their absence as a hard error.
 */
function assertPageBoxesWritten(data: Uint8Array): void {
  const text = new TextDecoder('latin1').decode(data)
  const missing = ['/TrimBox', '/BleedBox', '/ArtBox'].filter((box) => !text.includes(box))
  if (missing.length > 0) {
    throw new Error(`Production PDF page boxes were not written: ${missing.join(', ')}`)
  }
}

export async function renderNodesToPrintPDF(
  graph: SceneGraph,
  target: ExportTarget,
  options: PrintPDFExportOptions = {},
  context?: IOContext
): Promise<PrintPDFExportResult | null> {
  const preflight = preflightPrintPDF(graph, target, options.documentDpi)
  if (!preflight.valid) {
    throw new Error(preflight.errors.join('; '))
  }

  const { frame, pageId } = resolveTargetFrame(graph, target)
  const dpi = resolveEffectiveDpi(graph, options.documentDpi)
  const ptPerPx = 72 / dpi

  const W = frame.width * ptPerPx
  const H = frame.height * ptPerPx
  const { bT, bR, bB, bL } = computeBleedInsets(frame, ptPerPx)

  const M = 12
  const mediaBoxW = bL + W + bR + 2 * M
  const mediaBoxH = bB + H + bT + 2 * M

  const fallbackReasons = collectFallbackReasons(graph, frame.id)
  const needsBackdrop = fallbackReasons.length > 0

  const [{ jsPDF: JSPDFCtor }, { svg2pdf: svg2pdfFn }] = await Promise.all([
    import('jspdf'),
    import('svg2pdf.js')
  ])

  const doc = new JSPDFCtor({
    orientation: mediaBoxW > mediaBoxH ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [mediaBoxW, mediaBoxH],
    compress: true
  })

  if (options.title) {
    doc.setProperties({ title: options.title })
  }

  const trimBox = [bL + M, bB + M, bL + M + W, bB + M + H]
  const artBox = [bL + M, bB + M, bL + M + W, bB + M + H]
  const bleedBox = [M, M, M + bL + W + bR, M + bB + H + bT]

  setupPageBoxes(doc, trimBox, bleedBox, artBox)

  const bounds = computeContentBounds(graph, [frame.id])
  const frameAbs = graph.getAbsolutePosition(frame.id)

  const contentBounds = bounds ?? {
    minX: frameAbs.x,
    minY: frameAbs.y,
    maxX: frameAbs.x + frame.width,
    maxY: frameAbs.y + frame.height
  }

  const dx = (frameAbs.x - contentBounds.minX) * ptPerPx
  const dy = (frameAbs.y - contentBounds.minY) * ptPerPx
  const artW = (contentBounds.maxX - contentBounds.minX) * ptPerPx
  const artH = (contentBounds.maxY - contentBounds.minY) * ptPerPx

  const artX = M + bL - dx
  const artY = M + bT - dy

  const ok = await renderArtworkToDoc(
    doc,
    svg2pdfFn,
    graph,
    pageId,
    frame.id,
    needsBackdrop,
    dpi,
    artX,
    artY,
    artW,
    artH,
    context
  )
  if (!ok) return null

  if (options.cropMarks !== false) {
    drawCropMarks(doc, M + bL, M + bT, M + bL + W, M + bT + H)
  }

  const buffer = doc.output('arraybuffer')
  const data = new Uint8Array(buffer)
  assertPageBoxesWritten(data)

  return {
    data,
    rasterFallbackReason: preflight.rasterFallbackReason,
    warnings: preflight.warnings
  }
}
