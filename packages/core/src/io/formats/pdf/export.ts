import type { SceneGraph } from '@open-pencil/scene-graph'

import {
  computeContentBounds,
  nodeNeedsBackgroundBlur,
  nodeNeedsAdjustmentFallback,
  nodeNeedsMaskFallback,
  nodeNeedsProgressiveBlurFallback,
  renderNodesToImage
} from '#core/io/formats/raster'
import { renderNodesToSVG } from '#core/io/formats/svg'
import type { IOContext } from '#core/io/types'

export interface PDFExportOptions {
  title?: string
}

export async function renderNodesToPDF(
  graph: SceneGraph,
  pageId: string,
  nodeIds: string[],
  options: PDFExportOptions = {},
  context?: IOContext
): Promise<Uint8Array | null> {
  const needsBackdrop = nodeIds.some(
    (nodeId) => nodeNeedsBackgroundBlur(graph, nodeId) || nodeNeedsMaskFallback(graph, nodeId) || nodeNeedsAdjustmentFallback(graph, nodeId) || nodeNeedsProgressiveBlurFallback(graph, nodeId)
  )
  const svg = needsBackdrop
    ? null
    : renderNodesToSVG(graph, pageId, nodeIds, { xmlDeclaration: false })
  if (!svg && !needsBackdrop) return null

  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  if (width <= 0 || height <= 0) return null

  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])

  const doc = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [width, height],
    compress: true
  })

  if (options.title) {
    doc.setProperties({ title: options.title })
  }

  if (needsBackdrop) {
    if (!context?.canvasKit || !context.renderer) return null
    const png = renderNodesToImage(context.canvasKit, context.renderer, graph, pageId, nodeIds, {
      format: 'PNG',
      scale: 1
    })
    if (!png) return null
    let binary = ''
    for (const byte of png) binary += String.fromCharCode(byte)
    doc.addImage(`data:image/png;base64,${btoa(binary)}`, 'PNG', 0, 0, width, height)
  } else {
    const parser = new DOMParser()
    const svgDoc = parser.parseFromString(svg as string, 'image/svg+xml')
    const svgElement = svgDoc.documentElement
    const parseError = svgDoc.querySelector('parsererror')
    if (parseError) return null
    await svg2pdf(svgElement, doc, { x: 0, y: 0, width, height })
  }

  const buffer = doc.output('arraybuffer')
  return new Uint8Array(buffer)
}
