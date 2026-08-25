import type { Effect, Fill, SceneGraph, SceneNode, Vector } from '@open-pencil/scene-graph'

import { parseFrameGuides } from '#core/guides/frame'
import {
  headlessRenderNodes,
  nodeNeedsAdjustmentFallback,
  nodeNeedsBackgroundBlur,
  nodeNeedsMaskFallback,
  nodeNeedsProgressiveBlurFallback,
  renderNodesToImage
} from '#core/io/formats/raster'
import type { ExportTarget, IOContext } from '#core/io/types'
import { parseDocumentUnits } from '#core/units/document'

import { getNodeIDMLPaths, renderPathGeometryXML } from './geometry'
import { writeIdmlPackage } from './package'
import { buildStoryXml } from './stories'
import {
  buildFontsXml,
  buildGraphicXml,
  buildPreferencesXml,
  buildStylesXml,
  collectColorsAndFonts,
  getSwatchSelfForColor
} from './styles'
import { el, renderDocument, type XMLNode } from './xml'

export interface IdmlExportOptions {
  documentDpi?: number
  title?: string
}

export interface IdmlPreflightResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  rasterFallback: boolean
  rasterFallbackReason?: string
}

export interface IdmlExportResult {
  data: Uint8Array
  rasterFallbackReason?: string
  warnings: string[]
}

function resolveEffectiveDpi(graph: SceneGraph, documentDpi?: number): number {
  if (documentDpi && documentDpi > 0) return documentDpi
  const firstPage = graph.getPages().at(0)
  return parseDocumentUnits(firstPage ? firstPage.pluginData : []).dpi || 300
}

export function resolveIdmlFrames(graph: SceneGraph, target: ExportTarget): SceneNode[] {
  let frames: SceneNode[] = []

  switch (target.scope) {
    case 'node': {
      const node = graph.getNode(target.nodeId)
      if (node?.type === 'FRAME') frames = [node]
      break
    }
    case 'selection': {
      frames = target.nodeIds
        .map((id) => graph.getNode(id))
        .filter((n): n is SceneNode => n?.type === 'FRAME')
      break
    }
    case 'page': {
      frames = graph.getChildren(target.pageId).filter((n) => n.type === 'FRAME')
      break
    }
    case 'document': {
      frames = graph.getPages().flatMap((p) => graph.getChildren(p.id)).filter((n) => n.type === 'FRAME')
      break
    }
  }

  return frames
}

function isGradientOrPatternFill(f: Fill): boolean {
  return (
    f.visible &&
    (f.type === 'GRADIENT_LINEAR' ||
      f.type === 'GRADIENT_RADIAL' ||
      f.type === 'GRADIENT_ANGULAR' ||
      f.type === 'GRADIENT_DIAMOND' ||
      f.type === 'PATTERN' ||
      f.type === 'NOISE')
  )
}

function getEffectFallbackName(e: Effect): string | null {
  if (!e.visible) return null
  if (e.type === 'BACKGROUND_BLUR') return 'Background blur'
  if (e.type === 'DROP_SHADOW') return 'Drop shadow'
  if (e.type === 'INNER_SHADOW') return 'Inner shadow'
  if (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR') return 'Layer blur'
  return 'Effect'
}

export function isNodeRequiringFallback(graph: SceneGraph, node: SceneNode): boolean {
  if (node.effects.some((e) => e.visible)) return true
  if (node.fills.some(isGradientOrPatternFill)) return true
  if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') return true
  if (node.isMask || nodeNeedsMaskFallback(graph, node.id)) return true

  const isContainer = node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
  if (isContainer && node.opacity < 1) return true

  if (
    nodeNeedsBackgroundBlur(graph, node.id) ||
    nodeNeedsAdjustmentFallback(graph, node.id) ||
    nodeNeedsProgressiveBlurFallback(graph, node.id)
  ) {
    return true
  }

  return false
}

export function collectIdmlFallbackReasons(graph: SceneGraph, frameIds: string[]): string[] {
  const reasons: string[] = []

  function checkNode(node: SceneNode) {
    for (const e of node.effects) {
      const effectName = getEffectFallbackName(e)
      if (effectName) reasons.push(`${effectName} on '${node.name}'`)
    }

    if (node.fills.some(isGradientOrPatternFill)) {
      reasons.push(`Gradient/pattern fill on '${node.name}'`)
    }

    if (node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') {
      reasons.push(`Blend mode on '${node.name}'`)
    }

    if (node.isMask || nodeNeedsMaskFallback(graph, node.id)) {
      reasons.push(`Layer mask on '${node.name}'`)
    }

    const isContainer = node.type === 'FRAME' || node.type === 'GROUP' || node.type === 'SECTION' || node.type === 'COMPONENT' || node.type === 'INSTANCE'
    if (isContainer && node.opacity < 1) {
      reasons.push(`Container opacity on '${node.name}'`)
    }

    if (nodeNeedsAdjustmentFallback(graph, node.id)) {
      reasons.push(`Adjustment filter on '${node.name}'`)
    }

    if (nodeNeedsProgressiveBlurFallback(graph, node.id)) {
      reasons.push(`Progressive blur on '${node.name}'`)
    }

    for (const child of graph.getChildren(node.id)) {
      checkNode(child)
    }
  }

  for (const frameId of frameIds) {
    const frame = graph.getNode(frameId)
    if (frame) {
      for (const child of graph.getChildren(frame.id)) {
        checkNode(child)
      }
    }
  }

  return [...new Set(reasons)]
}

export function preflightIdmlExport(
  graph: SceneGraph,
  target: ExportTarget,
  documentDpi?: number
): IdmlPreflightResult {
  const errors: string[] = []
  const warnings: string[] = []

  const frames = resolveIdmlFrames(graph, target)
  if (frames.length === 0) {
    errors.push('IDML export requires at least one frame')
    return { valid: false, errors, warnings, rasterFallback: false }
  }

  const dpi = resolveEffectiveDpi(graph, documentDpi)
  const ptPerPx = 72 / dpi

  for (const frame of frames) {
    const w = frame.width * ptPerPx
    const h = frame.height * ptPerPx
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      errors.push(`Frame '${frame.name}' requires positive finite dimensions`)
    }
  }

  const fallbackReasons = collectIdmlFallbackReasons(
    graph,
    frames.map((f) => f.id)
  )
  const rasterFallback = fallbackReasons.length > 0
  let rasterFallbackReason: string | undefined
  if (rasterFallback) {
    rasterFallbackReason = fallbackReasons.join(', ')
    warnings.push(`Rasterised because: ${rasterFallbackReason}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    rasterFallback,
    rasterFallbackReason
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

interface RenderContext {
  graph: SceneGraph
  dpi: number
  ptPerPx: number
  ioContext?: IOContext
  storyIds: string[]
  entries: Record<string, Uint8Array | string>
}

async function renderFallbackImageItem(
  node: SceneNode,
  x: number,
  y: number,
  w: number,
  h: number,
  sid: string,
  pageId: string,
  ctx: RenderContext
): Promise<XMLNode | null> {
  let rasterData: Uint8Array | null = null
  if (ctx.ioContext?.canvasKit && ctx.ioContext.renderer) {
    rasterData = renderNodesToImage(
      ctx.ioContext.canvasKit,
      ctx.ioContext.renderer,
      ctx.graph,
      pageId,
      [node.id],
      { format: 'PNG', scale: ctx.dpi / 72 }
    )
  } else {
    rasterData = await headlessRenderNodes(ctx.graph, pageId, [node.id], {
      format: 'PNG',
      scale: ctx.dpi / 72
    })
  }

  if (!rasterData) return null
  const base64 = uint8ArrayToBase64(rasterData)
  return el(
    'Rectangle',
    { Self: `item_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}` },
    renderPathGeometryXML(getNodeIDMLPaths(node, ctx.ptPerPx)),
    el('Image', { Self: `img_${sid}`, ImageTypeName: '$ID/PNG', ItemTransform: '1 0 0 1 0 0', GeometricBounds: `0 0 ${h} ${w}` }, el('Contents', {}, base64))
  )
}

function renderEmbeddedImageItem(
  node: SceneNode,
  x: number,
  y: number,
  w: number,
  h: number,
  sid: string,
  imgBytes: Uint8Array,
  ptPerPx: number
): XMLNode {
  const base64 = uint8ArrayToBase64(imgBytes)
  return el(
    'Rectangle',
    { Self: `item_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}` },
    renderPathGeometryXML(getNodeIDMLPaths(node, ptPerPx)),
    el('Image', { Self: `img_${sid}`, ImageTypeName: '$ID/PNG', ItemTransform: '1 0 0 1 0 0', GeometricBounds: `0 0 ${h} ${w}` }, el('Contents', {}, base64))
  )
}

function renderShapeItem(
  node: SceneNode,
  x: number,
  y: number,
  w: number,
  h: number,
  sid: string,
  ctx: RenderContext,
  childElements: XMLNode[]
): XMLNode {
  const visibleFill = node.fills.find((f) => f.visible && f.type === 'SOLID')
  const fillColor = visibleFill ? getSwatchSelfForColor(visibleFill.color) : 'Color/None'

  const visibleStroke = node.strokes.find((s) => s.visible)
  const strokeColor = visibleStroke ? getSwatchSelfForColor(visibleStroke.color) : 'Color/None'
  const strokeWeight = visibleStroke ? visibleStroke.weight * ctx.ptPerPx : undefined

  const paths = getNodeIDMLPaths(node, ctx.ptPerPx)
  const pathGeometryNode = renderPathGeometryXML(paths)

  if (node.type === 'TEXT') {
    const storyId = `story_${sid}`
    ctx.storyIds.push(storyId)
    const storyXml = buildStoryXml(node, storyId, ctx.ptPerPx)
    ctx.entries[`Stories/Story_${storyId}.xml`] = storyXml

    return el(
      'TextFrame',
      { Self: `item_${sid}`, ParentStory: storyId, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}` },
      pathGeometryNode
    )
  }

  if (node.type === 'ELLIPSE') {
    return el(
      'Oval',
      { Self: `item_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}`, FillColor: fillColor, StrokeColor: strokeColor, StrokeWeight: strokeWeight },
      pathGeometryNode
    )
  }

  if (node.type === 'POLYGON' || node.type === 'STAR' || node.type === 'LINE' || node.type === 'VECTOR' || node.type === 'BOOLEAN_OPERATION') {
    return el(
      'Polygon',
      { Self: `item_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}`, FillColor: fillColor, StrokeColor: strokeColor, StrokeWeight: strokeWeight },
      pathGeometryNode
    )
  }

  return el(
    'Rectangle',
    { Self: `item_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}`, GeometricBounds: `0 0 ${h} ${w}`, FillColor: fillColor, StrokeColor: strokeColor, StrokeWeight: strokeWeight },
    pathGeometryNode,
    ...childElements
  )
}

async function renderNodeItem(
  node: SceneNode,
  frameAbs: Vector,
  pageId: string,
  ctx: RenderContext
): Promise<XMLNode | null> {
  if (!node.visible) return null

  const nodeAbs = ctx.graph.getAbsolutePosition(node.id)
  const x = (nodeAbs.x - frameAbs.x) * ctx.ptPerPx
  const y = (nodeAbs.y - frameAbs.y) * ctx.ptPerPx
  const w = node.width * ctx.ptPerPx
  const h = node.height * ctx.ptPerPx
  const sid = safeId(node.id)

  if (isNodeRequiringFallback(ctx.graph, node)) {
    return renderFallbackImageItem(node, x, y, w, h, sid, pageId, ctx)
  }

  const imageFill = node.fills.find((f) => f.visible && f.type === 'IMAGE')
  if (imageFill?.imageHash) {
    const imgBytes = ctx.graph.images.get(imageFill.imageHash)
    if (imgBytes) {
      return renderEmbeddedImageItem(node, x, y, w, h, sid, imgBytes, ctx.ptPerPx)
    }
  }

  const children = ctx.graph.getChildren(node.id)
  const isPureContainer =
    (node.type === 'GROUP' || node.type === 'SECTION' || node.type === 'FRAME' || node.type === 'COMPONENT' || node.type === 'INSTANCE') &&
    children.length > 0 &&
    node.fills.filter((f) => f.visible).length === 0 &&
    node.strokes.filter((s) => s.visible).length === 0

  if (isPureContainer) {
    const childElements: XMLNode[] = []
    for (const child of children) {
      const childEl = await renderNodeItem(child, frameAbs, pageId, ctx)
      if (childEl) childElements.push(childEl)
    }
    return el('Group', { Self: `group_${sid}`, ItemTransform: `1 0 0 1 ${x} ${y}` }, ...childElements)
  }

  const childElements: XMLNode[] = []
  if (children.length > 0) {
    for (const child of children) {
      const childEl = await renderNodeItem(child, frameAbs, pageId, ctx)
      if (childEl) childElements.push(childEl)
    }
  }

  return renderShapeItem(node, x, y, w, h, sid, ctx, childElements)
}

function buildMasterSpreadXml(firstFrame: SceneNode, ptPerPx: number): string {
  return renderDocument(
    el(
      'idPkg:MasterSpread',
      { 'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging', DOMVersion: '8.0' },
      el(
        'MasterSpread',
        { Self: 'm1', Name: 'A-Master', NamePrefix: 'A', BaseName: 'Master', PageCount: 1 },
        el('Page', {
          Self: 'm1_p1',
          GeometricBounds: `0 0 ${firstFrame.height * ptPerPx} ${firstFrame.width * ptPerPx}`,
          ItemTransform: '1 0 0 1 0 0',
          Name: 'A'
        })
      )
    )
  )
}

function buildDesignMapXml(framesCount: number, storyIds: string[], title?: string): string {
  const spreadElements: XMLNode[] = Array.from({ length: framesCount }, (_, i) =>
    el('idPkg:Spread', { src: `Spreads/Spread_s${i + 1}.xml` })
  )
  const storyElements: XMLNode[] = storyIds.map((sid) =>
    el('idPkg:Story', { src: `Stories/Story_${sid}.xml` })
  )

  return renderDocument(
    el(
      'Document',
      {
        'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging',
        DOMVersion: '8.0',
        Self: 'd',
        StoryList: storyIds.join(' '),
        Name: title || 'Silverpoint Document',
        ZeroPoint: '0 0'
      },
      el('idPkg:Graphic', { src: 'Resources/Graphic.xml' }),
      el('idPkg:Fonts', { src: 'Resources/Fonts.xml' }),
      el('idPkg:Styles', { src: 'Resources/Styles.xml' }),
      el('idPkg:Preferences', { src: 'Resources/Preferences.xml' }),
      el('idPkg:MasterSpread', { src: 'MasterSpreads/MasterSpread_m1.xml' }),
      ...spreadElements,
      ...storyElements
    )
  )
}

export async function renderNodesToIdml(
  graph: SceneGraph,
  target: ExportTarget,
  options?: IdmlExportOptions,
  context?: IOContext
): Promise<IdmlExportResult> {
  const frames = resolveIdmlFrames(graph, target)
  if (frames.length === 0) {
    throw new Error('IDML export requires at least one frame')
  }

  const dpi = resolveEffectiveDpi(graph, options?.documentDpi)
  const ptPerPx = 72 / dpi
  const fallbackReasons = collectIdmlFallbackReasons(
    graph,
    frames.map((f) => f.id)
  )
  const warnings = fallbackReasons.length > 0 ? [`Rasterised because: ${fallbackReasons.join(', ')}`] : []

  const allNodes: SceneNode[] = []
  function collectSubtree(node: SceneNode) {
    allNodes.push(node)
    for (const child of graph.getChildren(node.id)) {
      collectSubtree(child)
    }
  }
  for (const frame of frames) collectSubtree(frame)

  const { swatches, fonts } = collectColorsAndFonts(allNodes)
  const entries: Record<string, Uint8Array | string> = {}
  const storyIds: string[] = []

  const renderCtx: RenderContext = { graph, dpi, ptPerPx, ioContext: context, storyIds, entries }

  entries['META-INF/container.xml'] = renderDocument(
    el(
      'container',
      { version: '1.0', xmlns: 'urn:oasis:names:tc:opendocument:xmlns:container' },
      el('rootfiles', {}, el('rootfile', { 'full-path': 'designmap.xml', 'media-type': 'text/xml' }))
    )
  )

  const firstFrame = frames[0]
  const firstFrameGuides = parseFrameGuides(firstFrame.pluginData)
  const bleed = firstFrameGuides.bleed

  entries['Resources/Graphic.xml'] = buildGraphicXml(swatches)
  entries['Resources/Fonts.xml'] = buildFontsXml(fonts)
  entries['Resources/Styles.xml'] = buildStylesXml()
  entries['Resources/Preferences.xml'] = buildPreferencesXml({
    pageWidth: firstFrame.width * ptPerPx,
    pageHeight: firstFrame.height * ptPerPx,
    pageCount: frames.length,
    bleedTop: (bleed.enabled ? bleed.top : 0) * ptPerPx,
    bleedBottom: (bleed.enabled ? bleed.bottom : 0) * ptPerPx,
    bleedLeft: (bleed.enabled ? bleed.left : 0) * ptPerPx,
    bleedRight: (bleed.enabled ? bleed.right : 0) * ptPerPx
  })
  entries['MasterSpreads/MasterSpread_m1.xml'] = buildMasterSpreadXml(firstFrame, ptPerPx)

  const defaultPageId = graph.getPages()[0]?.id ?? ''

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    const spreadId = `s${i + 1}`
    const pageW = frame.width * ptPerPx
    const pageH = frame.height * ptPerPx
    const frameAbs = graph.getAbsolutePosition(frame.id)

    const guides = parseFrameGuides(frame.pluginData)
    const margins = guides.margins

    const pageElement = el(
      'Page',
      { Self: `page_${i + 1}`, GeometricBounds: `0 0 ${pageH} ${pageW}`, ItemTransform: '1 0 0 1 0 0', Name: `${i + 1}` },
      el('MarginPreference', {
        Top: (margins.enabled ? margins.top : 0) * ptPerPx,
        Bottom: (margins.enabled ? margins.bottom : 0) * ptPerPx,
        Left: (margins.enabled ? margins.left : 0) * ptPerPx,
        Right: (margins.enabled ? margins.right : 0) * ptPerPx
      })
    )

    const spreadItems: XMLNode[] = [pageElement]
    for (const child of graph.getChildren(frame.id)) {
      const item = await renderNodeItem(child, frameAbs, defaultPageId, renderCtx)
      if (item) spreadItems.push(item)
    }

    entries[`Spreads/Spread_${spreadId}.xml`] = renderDocument(
      el(
        'idPkg:Spread',
        { 'xmlns:idPkg': 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging', DOMVersion: '8.0' },
        el('Spread', { Self: spreadId, PageCount: 1, ItemTransform: '1 0 0 1 0 0', AppliedMaster: 'm1' }, ...spreadItems)
      )
    )
  }

  entries['designmap.xml'] = buildDesignMapXml(frames.length, storyIds, options?.title)
  const data = writeIdmlPackage(entries)

  return {
    data,
    warnings,
    rasterFallbackReason: fallbackReasons.length > 0 ? fallbackReasons.join(', ') : undefined
  }
}
