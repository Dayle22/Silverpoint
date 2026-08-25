import type { Effect, Fill, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import {
  curvedGradientBandDescriptors,
  isDegenerateProgressiveAxis,
  isProgressiveBlur,
  progressiveBlurAxis,
  progressiveBlurGradient,
  resolveProgressiveBlur
} from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'

import { colorToHex } from '#core/color'
import { colorToDisplayCss, getDefaultRenderColorSpace } from '#core/color/management'
import type { RenderColorSpace } from '#core/color/management'

import { svg, type SVGNode } from './node'
import { round } from './paths'

export interface SVGExportContext {
  defs: SVGNode[]
  defIdCounter: number
  graph: SceneGraph
  colorSpace: RenderColorSpace
}

export function nextDefId(ctx: SVGExportContext, prefix: string): string {
  return `${prefix}${ctx.defIdCounter++}`
}

export function formatColor(
  color: Color,
  opacity = 1,
  colorSpace: RenderColorSpace = getDefaultRenderColorSpace()
): string {
  const alphaColor = { ...color, a: color.a * opacity }
  if (colorSpace === 'display-p3') {
    return colorToDisplayCss(alphaColor, { colorSpace })
  }
  return colorToHex(alphaColor)
}

function createGradientDef(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  const stops = fill.gradientStops
  const t = fill.gradientTransform
  if (!stops || !t) return null

  const stopNodes = stops.map((s) =>
    svg('stop', {
      offset: `${round(s.position * 100)}%`,
      'stop-color': formatColor(s.color, 1, ctx.colorSpace),
      'stop-opacity': s.color.a < 1 ? round(s.color.a) : undefined
    })
  )

  const id = nextDefId(ctx, 'grad')

  if (fill.type === 'GRADIENT_LINEAR') {
    const startX = round(t.m02 * 100)
    const startY = round(t.m12 * 100)
    const endX = round((t.m00 + t.m02) * 100)
    const endY = round((t.m10 + t.m12) * 100)
    return {
      id,
      node: svg(
        'linearGradient',
        {
          id,
          x1: `${startX}%`,
          y1: `${startY}%`,
          x2: `${endX}%`,
          y2: `${endY}%`,
          gradientUnits: 'objectBoundingBox'
        },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_RADIAL' || fill.type === 'GRADIENT_DIAMOND') {
    const cx = round(t.m02 * 100)
    const cy = round(t.m12 * 100)
    const r = round(Math.hypot(t.m00, t.m10) * 100)
    return {
      id,
      node: svg(
        'radialGradient',
        { id, cx: `${cx}%`, cy: `${cy}%`, r: `${r}%`, gradientUnits: 'objectBoundingBox' },
        ...stopNodes
      )
    }
  }

  if (fill.type === 'GRADIENT_ANGULAR') {
    const cx = round(t.m02 * node.width)
    const cy = round(t.m12 * node.height)
    const r = Math.max(node.width, node.height)
    return {
      id,
      node: svg('radialGradient', { id, cx, cy, r, gradientUnits: 'userSpaceOnUse' }, ...stopNodes)
    }
  }

  if (fill.type === 'GRADIENT_CURVED') {
    const startX = (t.m00 + t.m02) * node.width
    const startY = (t.m10 + t.m12) * node.height
    const endX = t.m02 * node.width
    const endY = t.m12 * node.height

    const margin = Math.max(node.width, node.height, 1) * 4
    const bands = curvedGradientBandDescriptors(
      startX,
      startY,
      endX,
      endY,
      fill.gradientSpine ?? [],
      stops,
      margin
    )

    const bandRects: SVGNode[] = []

    for (let k = 0; k < bands.length; k++) {
      const band = bands[k]
      const bandGradId = `${id}_g${k}`
      const bandClipId = `${id}_c${k}`

      const c0 = {
        r: band.color0[0],
        g: band.color0[1],
        b: band.color0[2],
        a: band.color0[3]
      }
      const c1 = {
        r: band.color1[0],
        g: band.color1[1],
        b: band.color1[2],
        a: band.color1[3]
      }

      ctx.defs.push(
        svg(
          'linearGradient',
          {
            id: bandGradId,
            gradientUnits: 'userSpaceOnUse',
            x1: round(band.P0.x),
            y1: round(band.P0.y),
            x2: round(band.P1.x),
            y2: round(band.P1.y)
          },
          svg('stop', {
            offset: '0%',
            'stop-color': formatColor(c0, 1, ctx.colorSpace),
            'stop-opacity': c0.a < 1 ? round(c0.a) : undefined
          }),
          svg('stop', {
            offset: '100%',
            'stop-color': formatColor(c1, 1, ctx.colorSpace),
            'stop-opacity': c1.a < 1 ? round(c1.a) : undefined
          })
        )
      )

      const poly = band.polygon!
      ctx.defs.push(
        svg(
          'clipPath',
          { id: bandClipId, clipPathUnits: 'userSpaceOnUse' },
          svg('polygon', {
            points: `${round(poly.p0a.x)},${round(poly.p0a.y)} ${round(poly.p1a.x)},${round(poly.p1a.y)} ${round(poly.p1b.x)},${round(poly.p1b.y)} ${round(poly.p0b.x)},${round(poly.p0b.y)}`
          })
        )
      )

      bandRects.push(
        svg('rect', {
          width: round(node.width),
          height: round(node.height),
          fill: `url(#${bandGradId})`,
          'clip-path': `url(#${bandClipId})`
        })
      )
    }

    return {
      id,
      node: svg(
        'pattern',
        {
          id,
          patternUnits: 'userSpaceOnUse',
          width: round(node.width),
          height: round(node.height)
        },
        ...bandRects
      )
    }
  }

  return null
}

function createImagePattern(
  fill: Fill,
  node: SceneNode,
  ctx: SVGExportContext
): { id: string; node: SVGNode } | null {
  if (!fill.imageHash) return null
  const data = ctx.graph.images.get(fill.imageHash)
  if (!data) return null

  const id = nextDefId(ctx, 'img')
  const base64 = btoa(String.fromCharCode(...data))
  const mime = detectImageMime(data)

  return {
    id,
    node: svg(
      'pattern',
      {
        id,
        patternUnits: 'objectBoundingBox',
        width: 1,
        height: 1
      },
      svg('image', {
        href: `data:${mime};base64,${base64}`,
        width: node.width,
        height: node.height,
        preserveAspectRatio: fill.imageScaleMode === 'FIT' ? 'xMidYMid meet' : 'xMidYMid slice'
      })
    )
  }
}

function detectImageMime(data: Uint8Array): string {
  if (data[0] === 0x89 && data[1] === 0x50) return 'image/png'
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg'
  if (data[0] === 0x52 && data[1] === 0x49) return 'image/webp'
  return 'image/png'
}

/**
 * The blur that `createProgressiveBlurLayers` will draw as a band stack, or
 * `null` when the node has none that actually ramps.
 *
 * Matches the CanvasKit renderer: only the first visible layer/foreground blur
 * on a node is applied, and a ramp with no direction or no radius difference
 * collapses to a plain uniform blur handled by the normal filter path.
 */
export function findProgressiveBlur(node: SceneNode): Effect | null {
  const blur = node.effects.find(
    (e) => e.visible && (e.type === 'LAYER_BLUR' || e.type === 'FOREGROUND_BLUR')
  )
  if (!blur || !isProgressiveBlur(blur)) return null
  const ramp = resolveProgressiveBlur(blur)
  if (ramp.bands.length === 0) return null
  if (isDegenerateProgressiveAxis(progressiveBlurAxis(ramp, node.width, node.height))) return null
  return blur
}

/**
 * Renders a progressive blur as the stack SVG can express: one copy per band,
 * blurred by that band's radius and revealed by a gradient mask covering the
 * slice of the ramp axis it owns. This mirrors `getCachedProgressiveBlur` in
 * the CanvasKit renderer band for band, retirement included, so a sharper copy
 * never shows its hard edge through a softer one.
 *
 * The content is defined once and referenced with `<use>`, so a ramp costs one
 * copy of the markup regardless of band count.
 */
export function createProgressiveBlurLayers(
  node: SceneNode,
  effect: Effect,
  content: SVGNode[],
  ctx: SVGExportContext
): SVGNode[] {
  const ramp = resolveProgressiveBlur(effect)
  const axis = progressiveBlurAxis(ramp, node.width, node.height)
  const id = nextDefId(ctx, 'pblur')

  ctx.defs.push(svg('g', { id }, ...content))

  const pad = Math.max(ramp.startRadius, ramp.endRadius) * 2
  const region = {
    x: round(-pad),
    y: round(-pad),
    width: round(node.width + pad * 2),
    height: round(node.height + pad * 2)
  }

  const blurFilterId = (suffix: string, radius: number): string => {
    const filterId = `${id}_${suffix}`
    ctx.defs.push(
      svg(
        'filter',
        {
          id: filterId,
          filterUnits: 'userSpaceOnUse',
          'color-interpolation-filters': 'sRGB',
          ...region
        },
        svg('feGaussianBlur', { stdDeviation: round(radius / 2) })
      )
    )
    return filterId
  }

  const useCopy = (attrs: Record<string, string | number | undefined>): SVGNode =>
    svg('use', { href: `#${id}`, 'xlink:href': `#${id}`, ...attrs })

  return ramp.bands.map((band, index) => {
    const { from, to, positions, alphas } = progressiveBlurGradient(band, axis)
    const gradientId = `${id}_g${index}`
    const maskId = `${id}_m${index}`

    ctx.defs.push(
      svg(
        'linearGradient',
        {
          id: gradientId,
          gradientUnits: 'userSpaceOnUse',
          x1: round(from.x),
          y1: round(from.y),
          x2: round(to.x),
          y2: round(to.y)
        },
        // White is full coverage in a luminance mask, black is none.
        ...positions.map((position, stopIndex) =>
          svg('stop', {
            offset: round(position),
            'stop-color': alphas[stopIndex] > 0 ? '#ffffff' : '#000000'
          })
        )
      ),
      svg(
        'mask',
        { id: maskId, maskUnits: 'userSpaceOnUse', ...region },
        svg('rect', { ...region, fill: `url(#${gradientId})` })
      )
    )

    return useCopy({
      filter: band.radius > 0 ? `url(#${blurFilterId(`b${index}`, band.radius)})` : undefined,
      mask: `url(#${maskId})`
    })
  })
}

export function createFilterDef(
  effects: Effect[],
  ctx: SVGExportContext,
  skip?: Effect | null
): { id: string; node: SVGNode } | null {
  const visible = effects.filter((e) => e.visible && e !== skip)
  if (visible.length === 0) return null

  const id = nextDefId(ctx, 'fx')
  const primitives: SVGNode[] = []

  for (const effect of visible) {
    if (effect.type === 'DROP_SHADOW') {
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feDropShadow', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          stdDeviation: stdDev,
          'flood-color': formatColor(effect.color, 1, ctx.colorSpace),
          'flood-opacity': round(effect.color.a)
        })
      )
    } else if (effect.type === 'INNER_SHADOW') {
      const sid = `${id}_is`
      const stdDev = round(effect.radius / 2)
      primitives.push(
        svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: stdDev, result: `${sid}_blur` }),
        svg('feOffset', {
          dx: round(effect.offset.x),
          dy: round(effect.offset.y),
          result: `${sid}_off`
        }),
        svg('feComposite', {
          in: 'SourceAlpha',
          in2: `${sid}_off`,
          operator: 'out',
          result: `${sid}_inv`
        }),
        svg('feFlood', {
          'flood-color': formatColor(effect.color, 1, ctx.colorSpace),
          'flood-opacity': round(effect.color.a)
        }),
        svg('feComposite', { in2: `${sid}_inv`, operator: 'in', result: `${sid}_shadow` }),
        svg('feComposite', {
          in: `${sid}_shadow`,
          in2: 'SourceGraphic',
          operator: 'over'
        })
      )
    } else if (effect.type === 'BRIGHTNESS_CONTRAST') {
      const scale = Math.max(0, 1 + (effect.contrast ?? 0) / 100)
      primitives.push(svg('feComponentTransfer', {},
        svg('feFuncR', { type: 'linear', slope: round(scale), intercept: round(0.5 + (effect.brightness ?? 0) / 100 - 0.5 * scale) }),
        svg('feFuncG', { type: 'linear', slope: round(scale), intercept: round(0.5 + (effect.brightness ?? 0) / 100 - 0.5 * scale) }),
        svg('feFuncB', { type: 'linear', slope: round(scale), intercept: round(0.5 + (effect.brightness ?? 0) / 100 - 0.5 * scale) })
      ))
    } else if (effect.type === 'SATURATION') {
      const s = effect.saturation ?? 100
      primitives.push(svg('feColorMatrix', { type: 'saturate', values: s / 100 }))
    } else if (effect.type === 'CURVES') {
      const exponent = 1 / (effect.gamma ?? 1)
      primitives.push(svg('feComponentTransfer', {},
        svg('feFuncR', { type: 'gamma', amplitude: 1, exponent: round(exponent), offset: 0 }),
        svg('feFuncG', { type: 'gamma', amplitude: 1, exponent: round(exponent), offset: 0 }),
        svg('feFuncB', { type: 'gamma', amplitude: 1, exponent: round(exponent), offset: 0 })
      ))
    } else if (effect.type === 'NOISE') {
      const nid = `${id}_noise`
      const baseFreq = round(Math.max(0.01, 1 / Math.max(1, effect.radius || 1)))
      primitives.push(
        svg('feTurbulence', {
          type: 'fractalNoise',
          baseFrequency: baseFreq,
          numOctaves: 2,
          result: `${nid}_turb`
        }),
        svg('feColorMatrix', {
          type: 'matrix',
          in: `${nid}_turb`,
          values: `0 0 0 0 ${round(effect.color.r)} 0 0 0 0 ${round(effect.color.g)} 0 0 0 0 ${round(effect.color.b)} 0 0 0 ${round(effect.color.a)} 0`,
          result: `${nid}_tint`
        }),
        svg('feComposite', {
          in: `${nid}_tint`,
          in2: 'SourceGraphic',
          operator: 'in',
          result: `${nid}_clipped`
        }),
        svg('feComposite', {
          in: `${nid}_clipped`,
          in2: 'SourceGraphic',
          operator: 'over'
        })
      )
    } else {
      const stdDev = round(effect.radius / 2)
      primitives.push(svg('feGaussianBlur', { stdDeviation: stdDev }))
    }
  }

  if (primitives.length === 0) return null

  return {
    id,
    node: svg('filter', { id, 'color-interpolation-filters': 'sRGB' }, ...primitives)
  }
}

export function resolveFill(fill: Fill, node: SceneNode, ctx: SVGExportContext): string | null {
  if (!fill.visible) return null

  if (fill.type === 'SOLID') {
    return formatColor(fill.color, fill.opacity, ctx.colorSpace)
  }

  if (fill.type.startsWith('GRADIENT')) {
    const grad = createGradientDef(fill, node, ctx)
    if (grad) {
      ctx.defs.push(grad.node)
      return `url(#${grad.id})`
    }
  }

  if (fill.type === 'IMAGE') {
    const pattern = createImagePattern(fill, node, ctx)
    if (pattern) {
      ctx.defs.push(pattern.node)
      return `url(#${pattern.id})`
    }
  }

  return null
}

export const SVG_STROKE_CAP: Record<string, string> = {
  NONE: 'butt',
  ROUND: 'round',
  SQUARE: 'square'
}

export const SVG_STROKE_JOIN: Record<string, string> = {
  MITER: 'miter',
  ROUND: 'round',
  BEVEL: 'bevel'
}

export const SVG_BLEND_MODE: Record<string, string> = {
  NORMAL: 'normal',
  DARKEN: 'darken',
  MULTIPLY: 'multiply',
  COLOR_BURN: 'color-burn',
  LIGHTEN: 'lighten',
  SCREEN: 'screen',
  COLOR_DODGE: 'color-dodge',
  OVERLAY: 'overlay',
  SOFT_LIGHT: 'soft-light',
  HARD_LIGHT: 'hard-light',
  DIFFERENCE: 'difference',
  EXCLUSION: 'exclusion',
  HUE: 'hue',
  SATURATION: 'saturation',
  COLOR: 'color',
  LUMINOSITY: 'luminosity'
}
