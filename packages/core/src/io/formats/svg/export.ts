import {
  computeContentBounds,
  nodeNeedsBackgroundBlur,
  renderNodesToImage
} from '#core/io/formats/raster'
import type { IOContext } from '#core/io/types'
import { resolveNodeTextDirection } from '#core/text/direction'

import {
  nextDefId,
  formatColor,
  createFilterDef,
  createProgressiveBlurLayers,
  findProgressiveBlur,
  resolveFill,
  SVG_STROKE_CAP,
  SVG_STROKE_JOIN,
  SVG_BLEND_MODE
} from './defs'
import {
  round,
  geometryBlobToSVGPath,
  vectorNetworkToSVGPaths,
  makePolygonPoints,
  hasRadius,
  roundedRectPath,
  arcPath
} from './paths'

export { geometryBlobToSVGPath, vectorNetworkToSVGPaths } from './paths'

import type {
  Effect,
  SceneGraph,
  SceneNode,
  Fill,
  Stroke,
  CharacterStyleOverride
} from '@open-pencil/scene-graph'

import type { SVGExportContext } from './defs'
import { svg, renderSVGNode } from './node'
import type { SVGNode } from './node'

// --- Node rendering ---

function vectorShapeElements(
  node: SceneNode,
  common: Record<string, string | number | undefined>,
  strokeAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  const elements: SVGNode[] = []
  if (node.fillGeometry.length > 0) {
    for (const geo of node.fillGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (d) {
        elements.push(
          svg('path', {
            d,
            'fill-rule': geo.windingRule === 'EVENODD' ? 'evenodd' : undefined,
            ...common
          })
        )
      }
    }
  } else if (node.vectorNetwork) {
    const paths = vectorNetworkToSVGPaths(node.vectorNetwork)
    for (const d of paths) {
      elements.push(svg('path', { d, ...common }))
    }
  }
  if (node.strokeGeometry.length > 0 && strokeAttrs.stroke && strokeAttrs.stroke !== 'none') {
    for (const geo of node.strokeGeometry) {
      const d = geometryBlobToSVGPath(geo.commandsBlob)
      if (d) {
        elements.push(
          svg('path', {
            d,
            fill: strokeAttrs.stroke as string,
            'fill-opacity': strokeAttrs['stroke-opacity'],
            stroke: 'none'
          })
        )
      }
    }
  }
  return elements.length > 0
    ? elements
    : [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
}

function nodeShapeElements(
  node: SceneNode,
  fillAttr: string | null,
  strokeAttrs: Record<string, string | number | undefined>
): SVGNode[] {
  const common: Record<string, string | number | undefined> = {
    fill: fillAttr ?? 'none',
    ...strokeAttrs
  }

  switch (node.type) {
    case 'ELLIPSE': {
      if (node.arcData) {
        return [svg('path', { d: arcPath(node), ...common })]
      }
      return [
        svg('ellipse', {
          cx: round(node.width / 2),
          cy: round(node.height / 2),
          rx: round(node.width / 2),
          ry: round(node.height / 2),
          ...common
        })
      ]
    }

    case 'LINE':
      return [
        svg('line', {
          x1: 0,
          y1: 0,
          x2: round(node.width),
          y2: round(node.height),
          fill: 'none',
          ...strokeAttrs
        })
      ]

    case 'STAR':
    case 'POLYGON':
      return [svg('polygon', { points: makePolygonPoints(node), ...common })]

    case 'VECTOR':
      return vectorShapeElements(node, common, strokeAttrs)

    default: {
      if (hasRadius(node)) {
        if (node.independentCorners) {
          return [svg('path', { d: roundedRectPath(node), ...common })]
        }
        return [
          svg('rect', {
            width: round(node.width),
            height: round(node.height),
            rx: round(node.cornerRadius),
            ry: round(node.cornerRadius),
            ...common
          })
        ]
      }
      return [svg('rect', { width: round(node.width), height: round(node.height), ...common })]
    }
  }
}

function styleOverrideToTspanAttrs(
  style: CharacterStyleOverride,
  colorSpace: 'srgb' | 'display-p3'
): Record<string, string | number | undefined> {
  const attrs: Record<string, string | number | undefined> = {}
  if (style.fontFamily) attrs['font-family'] = style.fontFamily
  if (style.fontSize) attrs['font-size'] = style.fontSize
  if (style.fontWeight) attrs['font-weight'] = style.fontWeight
  if (style.italic) attrs['font-style'] = 'italic'
  if (style.letterSpacing) attrs['letter-spacing'] = round(style.letterSpacing)
  if (style.textDecoration === 'UNDERLINE') attrs['text-decoration'] = 'underline'
  if (style.textDecoration === 'STRIKETHROUGH') attrs['text-decoration'] = 'line-through'
  if (style.fills) {
    const visibleFill = style.fills.find((f) => f.visible && f.type === 'SOLID')
    if (visibleFill) {
      attrs.fill = formatColor(visibleFill.color, visibleFill.opacity, colorSpace)
    }
  }
  return attrs
}

function isLogicalTextEnd(node: SceneNode, direction: 'LTR' | 'RTL'): boolean {
  return (
    (direction === 'LTR' && node.textAlignHorizontal === 'RIGHT') ||
    (direction === 'RTL' && node.textAlignHorizontal === 'LEFT')
  )
}

function textAnchorForNode(
  node: SceneNode,
  direction: 'LTR' | 'RTL'
): 'middle' | 'end' | undefined {
  if (node.textAlignHorizontal === 'CENTER') return 'middle'
  if (isLogicalTextEnd(node, direction)) return 'end'
  return undefined
}

function textXForNode(node: SceneNode, direction: 'LTR' | 'RTL'): number {
  if (node.textAlignHorizontal === 'CENTER') return round(node.width / 2)
  if (isLogicalTextEnd(node, direction)) return round(node.width)
  return 0
}

function textYForNode(node: SceneNode): number {
  const fontSize = node.fontSize || 14
  switch (node.textAlignVertical) {
    case 'CENTER':
      return round(Math.max(0, (node.height - fontSize) / 2) + fontSize)
    case 'BOTTOM':
      return round(Math.max(0, node.height - fontSize) + fontSize)
    default:
      return round(fontSize)
  }
}

function renderTextNode(
  node: SceneNode,
  fillAttr: string | null,
  colorSpace: 'srgb' | 'display-p3'
): SVGNode {
  const direction = resolveNodeTextDirection(node)
  const textAnchor = textAnchorForNode(node, direction)

  let textDecoration: 'underline' | 'line-through' | undefined
  if (node.textDecoration === 'UNDERLINE') textDecoration = 'underline'
  else if (node.textDecoration === 'STRIKETHROUGH') textDecoration = 'line-through'

  const attrs: Record<string, string | number | undefined> = {
    'font-family': node.fontFamily || undefined,
    'font-size': node.fontSize || undefined,
    'font-weight': node.fontWeight !== 400 ? node.fontWeight : undefined,
    'font-style': node.italic ? 'italic' : undefined,
    fill: fillAttr ?? undefined,
    direction: direction === 'RTL' ? 'rtl' : undefined,
    'text-anchor': textAnchor,
    'text-decoration': textDecoration,
    'letter-spacing': node.letterSpacing ? round(node.letterSpacing) : undefined
  }

  const x = textXForNode(node, direction)
  const y = textYForNode(node)

  if (node.styleRuns.length > 0) {
    const spans: SVGNode[] = []
    let pos = 0
    for (const run of node.styleRuns) {
      const text = node.text.slice(pos, pos + run.length)
      pos += run.length
      spans.push(svg('tspan', styleOverrideToTspanAttrs(run.style, colorSpace), text))
    }

    return svg('text', { x, y, ...attrs }, ...spans)
  }

  return svg('text', { x, y, ...attrs }, node.text)
}

// --- Main recursive renderer ---

function buildTransformAttr(node: SceneNode): string | undefined {
  const transforms: string[] = []
  if (node.x !== 0 || node.y !== 0) transforms.push(`translate(${round(node.x)}, ${round(node.y)})`)
  if (node.rotation !== 0) {
    transforms.push(
      `rotate(${round(node.rotation)}, ${round(node.width / 2)}, ${round(node.height / 2)})`
    )
  }
  if (node.flipX || node.flipY) {
    const tx = node.flipX ? node.width : 0
    const ty = node.flipY ? node.height : 0
    const sx = node.flipX ? -1 : 1
    const sy = node.flipY ? -1 : 1
    transforms.push(`translate(${round(tx)}, ${round(ty)}) scale(${sx}, ${sy})`)
  }
  return transforms.length > 0 ? transforms.join(' ') : undefined
}

function buildGroupAttrs(
  node: SceneNode,
  ctx: SVGExportContext
): {
  attrs: Record<string, string | number | undefined>
  clipId?: string
  progressiveBlur?: Effect
} {
  const attrs: Record<string, string | number | undefined> = {}

  const transform = buildTransformAttr(node)
  if (transform) attrs.transform = transform

  if (node.opacity < 1) attrs.opacity = round(node.opacity)

  const blend = SVG_BLEND_MODE[node.blendMode]
  if (blend && blend !== 'normal' && node.blendMode !== 'PASS_THROUGH') {
    attrs.style = `mix-blend-mode: ${blend}`
  }

  // A progressive blur is drawn as a band stack around the node's content
  // rather than as a filter primitive, so it is kept out of the filter chain.
  const progressiveBlur = findProgressiveBlur(node) ?? undefined

  const filterDef = createFilterDef(node.effects, ctx, progressiveBlur)
  if (filterDef) {
    ctx.defs.push(filterDef.node)
    attrs.filter = `url(#${filterDef.id})`
  }

  let clipId: string | undefined
  if (node.clipsContent && node.childIds.length > 0) {
    clipId = nextDefId(ctx, 'clip')
    ctx.defs.push(
      svg(
        'clipPath',
        { id: clipId },
        svg('rect', { width: round(node.width), height: round(node.height) })
      )
    )
  }

  return { attrs, clipId, progressiveBlur }
}

function buildSVGStrokeAttrs(
  visibleStrokes: Stroke[],
  node: SceneNode,
  ctx: SVGExportContext
): Record<string, string | number | undefined> {
  if (visibleStrokes.length === 0) return {}
  const stroke = visibleStrokes[0]
  let strokeVal: string | null = null
  if (
    stroke.type?.startsWith('GRADIENT') &&
    stroke.gradientStops &&
    stroke.gradientTransform
  ) {
    const fillLike: Fill = {
      type: stroke.type,
      color: stroke.color,
      opacity: 1,
      visible: true,
      gradientStops: stroke.gradientStops,
      gradientTransform: stroke.gradientTransform
    }
    strokeVal = resolveFill(fillLike, node, ctx)
  }
  if (!strokeVal) {
    strokeVal = formatColor(stroke.color, 1, ctx.colorSpace)
  }

  const attrs: Record<string, string | number | undefined> = {
    stroke: strokeVal,
    'stroke-width': round(stroke.weight)
  }
  if (stroke.opacity < 1) attrs['stroke-opacity'] = round(stroke.opacity)
  if (stroke.cap && stroke.cap !== 'NONE') {
    attrs['stroke-linecap'] = SVG_STROKE_CAP[stroke.cap] ?? 'butt'
  }
  if (stroke.join && stroke.join !== 'MITER') {
    attrs['stroke-linejoin'] = SVG_STROKE_JOIN[stroke.join] ?? 'miter'
  }
  if (stroke.dashPattern && stroke.dashPattern.length > 0) {
    attrs['stroke-dasharray'] = stroke.dashPattern.map((n) => round(n)).join(' ')
  }
  return attrs
}

function buildShapeChildren(
  node: SceneNode,
  visibleFills: Fill[],
  fillAttr: string | null,
  strokeAttrs: Record<string, string | number | undefined>,
  visibleStrokeCount: number,
  ctx: SVGExportContext
): SVGNode[] {
  if (visibleFills.length > 1) {
    const elements: SVGNode[] = []
    for (const fill of visibleFills) {
      const ref = resolveFill(fill, node, ctx)
      if (ref) {
        elements.push(
          ...nodeShapeElements(
            node,
            ref,
            fill === visibleFills[visibleFills.length - 1] ? strokeAttrs : {}
          )
        )
      }
    }
    return elements
  }

  const hasFillOrStroke = fillAttr || visibleStrokeCount > 0
  if (hasFillOrStroke && !isGroupLike(node)) {
    return nodeShapeElements(node, fillAttr, strokeAttrs)
  }

  return []
}

function renderNode(node: SceneNode, ctx: SVGExportContext): SVGNode | null {
  if (!node.visible) return null

  const { attrs: groupAttrs, clipId, progressiveBlur } = buildGroupAttrs(node, ctx)

  if (node.type === 'TEXT') {
    const firstFill = node.fills.find((f) => f.visible)
    const fillAttr = firstFill ? resolveFill(firstFill, node, ctx) : null
    const textEl = renderTextNode(node, fillAttr, ctx.colorSpace)
    return svg(
      'g',
      groupAttrs,
      ...(progressiveBlur
        ? createProgressiveBlurLayers(node, progressiveBlur, [textEl], ctx)
        : [textEl])
    )
  }

  const visibleFills = node.fills.filter((f) => f.visible)
  const visibleStrokes = node.strokes.filter((s) => s.visible)
  const fillAttr = visibleFills.length > 0 ? resolveFill(visibleFills[0], node, ctx) : null
  const strokeAttrs = buildSVGStrokeAttrs(visibleStrokes, node, ctx)

  const children: (SVGNode | null)[] = buildShapeChildren(
    node,
    visibleFills,
    fillAttr,
    strokeAttrs,
    visibleStrokes.length,
    ctx
  )

  const childNodes = ctx.graph.getChildren(node.id)
  const childContent: SVGNode[] = renderChildrenWithMasks(childNodes, ctx)

  if (clipId && childContent.length > 0) {
    children.push(svg('g', { 'clip-path': `url(#${clipId})` }, ...childContent))
  } else {
    children.push(...childContent)
  }

  const validChildren = children.filter((c): c is SVGNode => c !== null)

  if (validChildren.length === 0 && Object.keys(groupAttrs).length === 0) {
    return null
  }

  if (progressiveBlur && validChildren.length > 0) {
    return svg(
      'g',
      groupAttrs,
      ...createProgressiveBlurLayers(node, progressiveBlur, validChildren, ctx)
    )
  }

  if (validChildren.length === 1 && Object.keys(groupAttrs).length === 0) {
    return validChildren[0]
  }

  return svg('g', groupAttrs, ...validChildren)
}

function isGroupLike(node: SceneNode): boolean {
  return node.type === 'GROUP'
}

/**
 * Groups children into mask-driven layers matching the CanvasKit renderer's
 * `renderMaskedChildIds` semantics: a contiguous run of visible `isMask`
 * siblings masks every following sibling until the next mask run or the end
 * of the list. VECTOR masks become an SVG `clipPath` (exact outline); ALPHA
 * and LUMINANCE masks become an SVG `mask` (native luminance-to-alpha, an
 * exact match for LUMINANCE and a close approximation for ALPHA on opaque
 * content).
 */
function renderChildrenWithMasks(childNodes: SceneNode[], ctx: SVGExportContext): SVGNode[] {
  const result: SVGNode[] = []

  for (let index = 0; index < childNodes.length; index++) {
    const child = childNodes[index]
    if (!(child.isMask && child.visible)) {
      const rendered = renderNode(child, ctx)
      if (rendered) result.push(rendered)
      continue
    }

    const masks: SceneNode[] = []
    let i = index
    while (i < childNodes.length && childNodes[i].isMask && childNodes[i].visible) {
      masks.push(childNodes[i])
      i++
    }

    const start = i
    let end = start
    while (end < childNodes.length && !(childNodes[end].isMask && childNodes[end].visible)) end++

    if (start === end) {
      index = i - 1
      continue
    }

    const maskedChildren = childNodes
      .slice(start, end)
      .map((n) => renderNode(n, ctx))
      .filter((n): n is SVGNode => n !== null)

    if (maskedChildren.length > 0) {
      // An empty mask/clip definition (mask geometry with no fill or path
      // data) is intentionally left empty rather than skipped: SVG treats an
      // empty mask/clipPath as fully transparent, which correctly hides the
      // masked content instead of silently rendering it unmasked.
      if (masks.every((m) => m.maskType === 'VECTOR')) {
        const clipId = nextDefId(ctx, 'mask-clip')
        const clipChildren = masks
          .map((m) => renderNode(m, ctx))
          .filter((n): n is SVGNode => n !== null)
        ctx.defs.push(svg('clipPath', { id: clipId }, ...clipChildren))
        result.push(svg('g', { 'clip-path': `url(#${clipId})` }, ...maskedChildren))
      } else {
        const maskId = nextDefId(ctx, 'mask')
        const maskChildren = masks
          .map((m) => renderNode(m, ctx))
          .filter((n): n is SVGNode => n !== null)
        ctx.defs.push(svg('mask', { id: maskId }, ...maskChildren))
        result.push(svg('g', { mask: `url(#${maskId})` }, ...maskedChildren))
      }
    }

    index = end - 1
  }

  return result
}

// --- Public API ---

export interface SVGExportOptions {
  /** Include XML declaration (default: true) */
  xmlDeclaration?: boolean
  /** Target export color space (default: srgb) */
  colorSpace?: 'srgb' | 'display-p3'
}

export function renderNodesToSVG(
  graph: SceneGraph,
  _pageId: string,
  nodeIds: string[],
  options: SVGExportOptions = {},
  context?: IOContext
): string | null {
  const bounds = computeContentBounds(graph, nodeIds)
  if (!bounds) return null

  const { minX, minY, maxX, maxY } = bounds
  const width = round(maxX - minX)
  const height = round(maxY - minY)

  const ctx: SVGExportContext = {
    defs: [],
    defIdCounter: 0,
    graph,
    colorSpace: options.colorSpace ?? 'srgb'
  }

  const contentNodes: SVGNode[] = []

  if (nodeIds.some((nodeId) => nodeNeedsBackgroundBlur(graph, nodeId))) {
    if (!context?.canvasKit || !context.renderer) return null
    const png = renderNodesToImage(context.canvasKit, context.renderer, graph, _pageId, nodeIds, {
      format: 'PNG',
      scale: 1
    })
    if (!png) return null
    let binary = ''
    for (const byte of png) binary += String.fromCharCode(byte)
    const fallback = svg(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        'xmlns:xlink': 'http://www.w3.org/1999/xlink',
        width,
        height,
        viewBox: `0 0 ${width} ${height}`
      },
      svg('image', {
        href: `data:image/png;base64,${btoa(binary)}`,
        x: 0,
        y: 0,
        width,
        height,
        preserveAspectRatio: 'none'
      })
    )
    const xmlDecl =
      options.xmlDeclaration !== false ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ''
    return xmlDecl + renderSVGNode(fallback)
  }

  const rootNodes: SceneNode[] = []
  for (const id of nodeIds) {
    const node = graph.getNode(id)
    if (!node?.visible) continue

    const abs = graph.getAbsolutePosition(id)
    const offsetX = abs.x - minX
    const offsetY = abs.y - minY

    const needsOffset = offsetX !== node.x || offsetY !== node.y
    rootNodes.push(needsOffset ? { ...node, x: round(offsetX), y: round(offsetY) } : node)
  }
  contentNodes.push(...renderChildrenWithMasks(rootNodes, ctx))

  if (contentNodes.length === 0) return null

  const rootChildren: (SVGNode | string)[] = []
  if (ctx.defs.length > 0) {
    rootChildren.push(svg('defs', {}, ...ctx.defs))
  }
  rootChildren.push(...contentNodes)

  const root = svg(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      'xmlns:xlink': 'http://www.w3.org/1999/xlink',
      width,
      height,
      viewBox: `0 0 ${width} ${height}`
    },
    ...(rootChildren as SVGNode[])
  )

  const svgStr = renderSVGNode(root)
  const xmlDecl = options.xmlDeclaration !== false ? '<?xml version="1.0" encoding="UTF-8"?>\n' : ''
  return xmlDecl + svgStr
}
