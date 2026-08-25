import { BLACK, WHITE } from '#core/constants'
import { upsertFrameGuides } from '#core/guides/frame'
import { findDescendants, findFirstChild, parseXML, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import { SceneGraph, type Color as RGBAColor, type Fill, type SceneNode, type Stroke } from '@open-pencil/scene-graph'
import { parseGraphicSwatches, resolveColor } from './import/color'
import {
  isAxisAlignedBox,
  parseBounds,
  parseItemTransform,
  parsePathGeometry,
  pathsToVectorNetwork
} from './import/geometry'
import { readIdmlPackage } from './import/package'
import { parseStories, populateTextNodeFromStory } from './import/text'
import {
  IDML_MAX_DIMENSION_PX,
  IDML_MAX_ITEMS,
  IDML_MAX_PAGE_COUNT,
  type IdmlImportDiagnostic,
  type ImportIdmlOptions
} from './import/types'

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

interface ImportContext {
  graph: SceneGraph
  frameNode: SceneNode
  swatches: Map<string, RGBAColor | null>
  stories: ReturnType<typeof parseStories>['stories']
  pxPerPt: number
  diagnostics: IdmlImportDiagnostic[]
  usedStories: Set<string>
  seenUnknownTags: Set<string>
  imageCounter: { val: number }
  isMasterItem?: boolean
}

interface NodeGeometry {
  self: string
  nodeX: number
  nodeY: number
  nodeW: number
  nodeH: number
  rotation: number
  standardFills: Fill[]
  standardStrokes: Stroke[]
}

function applyPluginData(node: SceneNode, isMasterItem?: boolean) {
  if (isMasterItem) {
    node.pluginData = [...node.pluginData, { pluginId: 'idml', key: 'idmlMasterItem', value: 'true' }]
  }
}

function importTextFrameNode(
  itemNode: XMLParseNode,
  parentId: string,
  geom: NodeGeometry,
  ctx: ImportContext
): SceneNode {
  const { graph, stories, pxPerPt, diagnostics, usedStories, isMasterItem } = ctx
  const parentStoryId = itemNode.attrs['ParentStory'] || ''
  const story = stories.get(parentStoryId)

  const textNode = graph.createNode('TEXT', parentId, {
    name: geom.self ? `Text ${geom.self}` : 'Text',
    x: geom.nodeX,
    y: geom.nodeY,
    width: geom.nodeW,
    height: geom.nodeH
  })
  textNode.rotation = geom.rotation
  applyPluginData(textNode, isMasterItem)

  if (story) {
    if (usedStories.has(parentStoryId)) {
      diagnostics.push({
        severity: 'warning',
        code: 'IDML_THREADED_STORY_SPLIT',
        message: `Story "${parentStoryId}" is threaded across multiple frames; content placed in the first frame.`,
        detail: parentStoryId
      })
      textNode.text = ''
    } else {
      usedStories.add(parentStoryId)
      populateTextNodeFromStory(textNode, story, pxPerPt)
    }
  } else {
    textNode.text = ''
  }

  return textNode
}

function importGraphicNode(
  itemNode: XMLParseNode,
  tag: string,
  parentId: string,
  geom: NodeGeometry,
  ctx: ImportContext
): SceneNode | null {
  const { graph, imageCounter, isMasterItem, diagnostics } = ctx
  const imageChild = findFirstChild(itemNode, 'Image') || (tag === 'Image' ? itemNode : undefined)
  const epsChild = findFirstChild(itemNode, 'EPS') || (tag === 'EPS' ? itemNode : undefined)
  const pdfChild = findFirstChild(itemNode, 'PDF') || (tag === 'PDF' ? itemNode : undefined)
  const graphicChild = imageChild || epsChild || pdfChild

  if (!graphicChild) return null

  const contentsNode = findFirstChild(graphicChild, 'Contents')
  const linkNode = findFirstChild(graphicChild, 'Link')

  if (contentsNode && contentsNode.text.trim().length > 0) {
    try {
      const imageBytes = base64ToUint8Array(contentsNode.text)
      const imageHash = `idml_img_${imageCounter.val++}`
      graph.images.set(imageHash, imageBytes)

      const imgRectNode = graph.createNode('RECTANGLE', parentId, {
        name: geom.self ? `Image ${geom.self}` : 'Image',
        x: geom.nodeX,
        y: geom.nodeY,
        width: geom.nodeW,
        height: geom.nodeH,
        fills: [
          {
            type: 'IMAGE',
            color: BLACK,
            imageHash,
            opacity: 1,
            visible: true,
            imageScaleMode: 'FILL'
          }
        ],
        strokes: geom.standardStrokes
      })
      imgRectNode.rotation = geom.rotation
      applyPluginData(imgRectNode, isMasterItem)
      return imgRectNode
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        code: 'IDML_CORRUPT_EMBEDDED_IMAGE',
        message: `Failed to decode embedded image data in item "${geom.self}".`,
        detail: String(err)
      })
    }
  } else if (linkNode) {
    const uri = linkNode.attrs['LinkResourceURI'] || linkNode.attrs['FilePath'] || 'external link'
    diagnostics.push({
      severity: 'warning',
      code: 'IDML_EXTERNAL_IMAGE_SKIPPED',
      message: `External linked image "${uri}" cannot be loaded locally; skipped.`,
      detail: uri
    })
  }

  return null
}

function importShapeNode(
  itemNode: XMLParseNode,
  tag: string,
  parentId: string,
  geom: NodeGeometry,
  ctx: ImportContext
): SceneNode | null {
  const { graph, pxPerPt, isMasterItem } = ctx

  if (tag === 'Oval') {
    const ovalNode = graph.createNode('ELLIPSE', parentId, {
      name: geom.self ? `Oval ${geom.self}` : 'Oval',
      x: geom.nodeX,
      y: geom.nodeY,
      width: geom.nodeW,
      height: geom.nodeH,
      fills: geom.standardFills,
      strokes: geom.standardStrokes
    })
    ovalNode.rotation = geom.rotation
    applyPluginData(ovalNode, isMasterItem)
    return ovalNode
  }

  if (tag === 'Rectangle') {
    const paths = parsePathGeometry(itemNode, pxPerPt)
    const isBox = paths.length === 0 || isAxisAlignedBox(paths, geom.nodeW, geom.nodeH)

    if (isBox) {
      const rectNode = graph.createNode('RECTANGLE', parentId, {
        name: geom.self ? `Rectangle ${geom.self}` : 'Rectangle',
        x: geom.nodeX,
        y: geom.nodeY,
        width: geom.nodeW,
        height: geom.nodeH,
        fills: geom.standardFills,
        strokes: geom.standardStrokes
      })
      rectNode.rotation = geom.rotation
      applyPluginData(rectNode, isMasterItem)

      for (const childEl of itemNode.children) {
        if (childEl.tag !== 'Properties' && childEl.tag !== 'Image' && childEl.tag !== 'EPS' && childEl.tag !== 'PDF') {
          importItemNode(childEl, rectNode.id, ctx)
        }
      }
      return rectNode
    }

    const network = pathsToVectorNetwork(paths)
    const vectorNode = graph.createNode('VECTOR', parentId, {
      name: geom.self ? `Vector ${geom.self}` : 'Vector',
      x: geom.nodeX,
      y: geom.nodeY,
      width: geom.nodeW,
      height: geom.nodeH,
      vectorNetwork: network,
      fills: geom.standardFills,
      strokes: geom.standardStrokes
    })
    vectorNode.rotation = geom.rotation
    applyPluginData(vectorNode, isMasterItem)
    return vectorNode
  }

  if (tag === 'Polygon' || tag === 'GraphicLine') {
    const paths = parsePathGeometry(itemNode, pxPerPt)
    const network = pathsToVectorNetwork(paths)
    const vectorNode = graph.createNode('VECTOR', parentId, {
      name: geom.self ? `Vector ${geom.self}` : 'Vector',
      x: geom.nodeX,
      y: geom.nodeY,
      width: geom.nodeW,
      height: geom.nodeH,
      vectorNetwork: network,
      fills: geom.standardFills,
      strokes: geom.standardStrokes
    })
    vectorNode.rotation = geom.rotation
    applyPluginData(vectorNode, isMasterItem)
    return vectorNode
  }

  return null
}

function importItemNode(
  itemNode: XMLParseNode,
  parentId: string,
  ctx: ImportContext
): SceneNode | null {
  const tag = itemNode.tag
  const { graph, swatches, pxPerPt, diagnostics, isMasterItem } = ctx

  const self = itemNode.attrs['Self'] || itemNode.attrs['id'] || ''
  const bounds = parseBounds(itemNode.attrs['GeometricBounds'])
  const transform = parseItemTransform(itemNode.attrs['ItemTransform'], diagnostics, self)

  const nodeX = transform.x * pxPerPt
  const nodeY = transform.y * pxPerPt
  const nodeW = Math.max(1, bounds.width * pxPerPt)
  const nodeH = Math.max(1, bounds.height * pxPerPt)

  const fillColor = resolveColor(itemNode.attrs['FillColor'], swatches)
  const strokeColor = resolveColor(itemNode.attrs['StrokeColor'], swatches)
  const strokeWeight = itemNode.attrs['StrokeWeight']
    ? Number.parseFloat(itemNode.attrs['StrokeWeight']) * pxPerPt
    : undefined

  const standardFills = fillColor
    ? [{ type: 'SOLID' as const, color: fillColor, opacity: 1, visible: true }]
    : []
  const standardStrokes = strokeColor
    ? [{ color: strokeColor, weight: strokeWeight || 1, opacity: 1, visible: true, align: 'INSIDE' as const }]
    : []

  const geom: NodeGeometry = {
    self,
    nodeX,
    nodeY,
    nodeW,
    nodeH,
    rotation: transform.rotation,
    standardFills,
    standardStrokes
  }

  if (tag === 'Group') {
    const groupNode = graph.createNode('GROUP', parentId, {
      name: self ? `Group ${self}` : 'Group',
      x: nodeX,
      y: nodeY,
      width: nodeW,
      height: nodeH
    })
    groupNode.rotation = transform.rotation
    applyPluginData(groupNode, isMasterItem)

    for (const childEl of itemNode.children) {
      importItemNode(childEl, groupNode.id, ctx)
    }
    return groupNode
  }

  if (tag === 'TextFrame') {
    return importTextFrameNode(itemNode, parentId, geom, ctx)
  }

  const graphicNode = importGraphicNode(itemNode, tag, parentId, geom, ctx)
  if (graphicNode) return graphicNode

  const shapeNode = importShapeNode(itemNode, tag, parentId, geom, ctx)
  if (shapeNode) return shapeNode

  if (!ctx.seenUnknownTags.has(tag) && tag !== 'Properties') {
    ctx.seenUnknownTags.add(tag)
    diagnostics.push({
      severity: 'info',
      code: 'IDML_ELEMENT_SKIPPED',
      message: `IDML element type <${tag}> is not directly represented; skipped.`,
      detail: tag
    })
  }

  return null
}

function parseMasterSpreadMap(pkg: ReturnType<typeof readIdmlPackage> & object): Map<string, XMLParseNode> {
  const masterSpreadMap = new Map<string, XMLParseNode>()
  for (const masterPath of pkg.masterSpreadPaths) {
    const masterBytes = pkg.entries[masterPath]
    if (!masterBytes) continue
    try {
      const masterXml = new TextDecoder().decode(masterBytes)
      const masterRoot = parseXML(masterXml)
      const masterNodes = findDescendants(masterRoot, 'MasterSpread')
      const masterNode = masterRoot.tag === 'MasterSpread' ? masterRoot : masterNodes.at(0)
      if (masterNode?.attrs['Self']) {
        masterSpreadMap.set(masterNode.attrs['Self'], masterNode)
      }
      // oxlint-disable-next-line open-pencil/no-silent-catch
    } catch {
      // Continue
    }
  }
  return masterSpreadMap
}

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

function applyPageMarginGuides(pageNode: XMLParseNode, frame: SceneNode, pxPerPt: number): void {
  const pageMarginDescendants = findDescendants(pageNode, 'MarginPreference')
  const marginPrefNode =
    findFirstChild(pageNode, 'MarginPreference') ||
    findFirstChild(pageNode, 'MarginPreferences') ||
    pageMarginDescendants.at(0)

  if (marginPrefNode) {
    const topMargin = (Number.parseFloat(marginPrefNode.attrs['Top'] || '0') || 0) * pxPerPt
    const bottomMargin = (Number.parseFloat(marginPrefNode.attrs['Bottom'] || '0') || 0) * pxPerPt
    const leftMargin = (Number.parseFloat(marginPrefNode.attrs['Left'] || '0') || 0) * pxPerPt
    const rightMargin = (Number.parseFloat(marginPrefNode.attrs['Right'] || '0') || 0) * pxPerPt

    if (topMargin > 0 || bottomMargin > 0 || leftMargin > 0 || rightMargin > 0) {
      const guides = {
        version: 1 as const,
        margins: {
          enabled: true,
          linked: false,
          top: Math.round(topMargin * 100) / 100,
          right: Math.round(rightMargin * 100) / 100,
          bottom: Math.round(bottomMargin * 100) / 100,
          left: Math.round(leftMargin * 100) / 100
        },
        bleed: { enabled: false, linked: true, top: 0, right: 0, bottom: 0, left: 0 }
      }
      frame.pluginData = upsertFrameGuides(frame.pluginData, guides)
    }
  }
}

function importSpreadPageItems(
  frame: SceneNode,
  spreadNode: XMLParseNode,
  appliedMasterId: string,
  masterSpreadMap: Map<string, XMLParseNode>,
  ctx: ImportContext
): void {
  if (appliedMasterId && masterSpreadMap.has(appliedMasterId)) {
    const masterNode = masterSpreadMap.get(appliedMasterId)
    if (masterNode) {
      const masterCtx: ImportContext = { ...ctx, isMasterItem: true }
      for (const masterChild of masterNode.children) {
        if (masterChild.tag !== 'Page' && masterChild.tag !== 'Properties') {
          importItemNode(masterChild, frame.id, masterCtx)
        }
      }
    }
  }

  for (const spreadChild of spreadNode.children) {
    if (spreadChild.tag !== 'Page' && spreadChild.tag !== 'Properties') {
      importItemNode(spreadChild, frame.id, ctx)
    }
  }
}

export async function importIdml(
  data: Uint8Array,
  options: ImportIdmlOptions = {}
): Promise<{ graph: SceneGraph; diagnostics: IdmlImportDiagnostic[] }> {
  const diagnostics: IdmlImportDiagnostic[] = []
  const graph = new SceneGraph()
  const canvasPage = graph.getPages()[0]

  const pkg = readIdmlPackage(data, diagnostics)
  if (!pkg || diagnostics.some((d) => d.severity === 'error')) {
    return { graph, diagnostics }
  }

  const dpi = options.documentDpi || 300
  const pxPerPt = dpi / 72

  const { swatches } = parseGraphicSwatches(pkg.graphicXml, diagnostics)
  const seenMissingFonts = new Set<string>()
  const { stories } = parseStories(pkg.entries, pkg.storyPaths, swatches, diagnostics, seenMissingFonts)

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

  const baseDocName = (options.fileName || 'Document').replace(/\.[^.]+$/i, '')
  const usedStories = new Set<string>()
  const seenUnknownTags = new Set<string>()
  const imageCounter = { val: 1 }

  let currentCanvasX = 0
  let pageIndex = 1

  for (const spreadPath of pkg.spreadPaths) {
    const spreadBytes = pkg.entries[spreadPath]
    if (!spreadBytes) continue

    const spreadXml = new TextDecoder().decode(spreadBytes)
    let spreadRoot: XMLParseNode
    try {
      spreadRoot = parseXML(spreadXml)
    } catch (err) {
      diagnostics.push({
        severity: 'warning',
        code: 'IDML_CORRUPT_SPREAD',
        message: `Failed to parse spread at ${spreadPath}: ${err instanceof Error ? err.message : String(err)}`
      })
      continue
    }

    const spreadNodes = findDescendants(spreadRoot, 'Spread')
    const spreadNode = spreadRoot.tag === 'Spread' ? spreadRoot : spreadNodes.at(0)
    if (!spreadNode) continue

    const appliedMasterId = spreadNode.attrs['AppliedMaster'] || ''
    const pageNodes = findDescendants(spreadNode, 'Page')

    for (const pageNode of pageNodes) {
      const pageBounds = parseBounds(pageNode.attrs['GeometricBounds'])
      const frameWidth = Math.round(pageBounds.width * pxPerPt * 100) / 100
      const frameHeight = Math.round(pageBounds.height * pxPerPt * 100) / 100

      const frameName = totalPages <= 1 ? baseDocName : `${baseDocName} - Page ${pageIndex}`
      const frame = graph.createNode('FRAME', canvasPage.id, {
        name: frameName,
        x: currentCanvasX,
        y: 0,
        width: frameWidth,
        height: frameHeight,
        fills: [{ type: 'SOLID', color: WHITE, opacity: 1, visible: true }]
      })

      applyPageMarginGuides(pageNode, frame, pxPerPt)

      const ctx: ImportContext = {
        graph,
        frameNode: frame,
        swatches,
        stories,
        pxPerPt,
        diagnostics,
        usedStories,
        seenUnknownTags,
        imageCounter
      }

      importSpreadPageItems(frame, spreadNode, appliedMasterId, masterSpreadMap, ctx)

      currentCanvasX += frameWidth + 100
      pageIndex++
    }
  }

  return { graph, diagnostics }
}
