/* eslint-disable max-lines -- Shape path construction and geometry resolution */
import type { Canvas, Path, PathBuilder } from 'canvaskit-wasm'

import type { SceneNode } from '@open-pencil/scene-graph'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import { vectorNetworkToPath, geometryBlobToPath } from '#core/vector'

import type { SkiaRenderer } from './renderer'

export type CornerRadii = {
  topLeft: number
  topRight: number
  bottomRight: number
  bottomLeft: number
}

export function nodeHasRadius(node: SceneNode): boolean {
  return (
    node.cornerRadius > 0 ||
    (node.independentCorners &&
      (node.topLeftRadius > 0 ||
        node.topRightRadius > 0 ||
        node.bottomRightRadius > 0 ||
        node.bottomLeftRadius > 0))
  )
}

export function nodeHasSmoothCorners(node: SceneNode): boolean {
  if (!(node.cornerSmoothing > 0)) return false
  if (node.independentCorners) {
    return (
      node.topLeftRadius > 0 ||
      node.topRightRadius > 0 ||
      node.bottomRightRadius > 0 ||
      node.bottomLeftRadius > 0
    )
  }
  return node.cornerRadius > 0
}

type SmoothCornerKey = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft'

type SmoothCorner = {
  radius: number
  budget: number
}

type SmoothCornerPathParams = {
  a: number
  b: number
  c: number
  d: number
  p: number
  radius: number
  arcSectionLength: number
}

function smoothCornerRadii(
  node: SceneNode,
  width: number,
  height: number,
  spread: number
): Record<SmoothCornerKey, SmoothCorner> {
  const radius = (value: number) => Math.max(0, value + spread)
  const radii: Record<SmoothCornerKey, number> = node.independentCorners
    ? {
        topLeft: radius(node.topLeftRadius),
        topRight: radius(node.topRightRadius),
        bottomRight: radius(node.bottomRightRadius),
        bottomLeft: radius(node.bottomLeftRadius)
      }
    : {
        topLeft: radius(node.cornerRadius),
        topRight: radius(node.cornerRadius),
        bottomRight: radius(node.cornerRadius),
        bottomLeft: radius(node.cornerRadius)
      }

  if (
    radii.topLeft === radii.topRight &&
    radii.topRight === radii.bottomRight &&
    radii.bottomRight === radii.bottomLeft
  ) {
    const budget = Math.min(width, height) / 2
    const clampedRadius = Math.min(radii.topLeft, budget)
    return {
      topLeft: { radius: clampedRadius, budget },
      topRight: { radius: clampedRadius, budget },
      bottomRight: { radius: clampedRadius, budget },
      bottomLeft: { radius: clampedRadius, budget }
    }
  }

  const budgets: Record<SmoothCornerKey, number> = {
    topLeft: -1,
    topRight: -1,
    bottomRight: -1,
    bottomLeft: -1
  }
  const adjacentByCorner: Record<
    SmoothCornerKey,
    Array<{ corner: SmoothCornerKey; sideLength: number }>
  > = {
    topLeft: [
      { corner: 'topRight', sideLength: width },
      { corner: 'bottomLeft', sideLength: height }
    ],
    topRight: [
      { corner: 'topLeft', sideLength: width },
      { corner: 'bottomRight', sideLength: height }
    ],
    bottomRight: [
      { corner: 'bottomLeft', sideLength: width },
      { corner: 'topRight', sideLength: height }
    ],
    bottomLeft: [
      { corner: 'bottomRight', sideLength: width },
      { corner: 'topLeft', sideLength: height }
    ]
  }

  for (const corner of (Object.keys(radii) as SmoothCornerKey[]).sort(
    (a, b) => radii[b] - radii[a]
  )) {
    const cornerRadius = radii[corner]
    const budget = Math.min(
      ...adjacentByCorner[corner].map((adjacent) => {
        const adjacentRadius = radii[adjacent.corner]
        if (cornerRadius === 0 && adjacentRadius === 0) return 0
        if (budgets[adjacent.corner] >= 0) return adjacent.sideLength - budgets[adjacent.corner]
        return (cornerRadius / (cornerRadius + adjacentRadius)) * adjacent.sideLength
      })
    )
    budgets[corner] = budget
    radii[corner] = Math.min(cornerRadius, budget)
  }

  return {
    topLeft: { radius: radii.topLeft, budget: budgets.topLeft },
    topRight: { radius: radii.topRight, budget: budgets.topRight },
    bottomRight: { radius: radii.bottomRight, budget: budgets.bottomRight },
    bottomLeft: { radius: radii.bottomLeft, budget: budgets.bottomLeft }
  }
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

function smoothCornerPathParams(corner: SmoothCorner, smoothing: number): SmoothCornerPathParams {
  let cornerSmoothing = smoothing
  let p = (1 + cornerSmoothing) * corner.radius
  if (corner.radius > 0) {
    const maxSmoothing = corner.budget / corner.radius - 1
    cornerSmoothing = Math.min(cornerSmoothing, maxSmoothing)
    p = Math.min(p, corner.budget)
  }

  const arcMeasure = 90 * (1 - cornerSmoothing)
  const arcSectionLength = Math.sin(degreesToRadians(arcMeasure / 2)) * corner.radius * Math.sqrt(2)
  const angleAlpha = (90 - arcMeasure) / 2
  const p3ToP4Distance = corner.radius * Math.tan(degreesToRadians(angleAlpha / 2))
  const angleBeta = 45 * cornerSmoothing
  const c = p3ToP4Distance * Math.cos(degreesToRadians(angleBeta))
  const d = c * Math.tan(degreesToRadians(angleBeta))
  const b = (p - arcSectionLength - c - d) / 3

  return {
    a: 2 * b,
    b,
    c,
    d,
    p,
    radius: corner.radius,
    arcSectionLength
  }
}

function drawTopRightSmoothCorner(
  path: PathBuilder,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x + corner.p, y)
    return
  }
  path.cubicTo(
    x + corner.a,
    y,
    x + corner.a + corner.b,
    y,
    x + corner.a + corner.b + corner.c,
    y + corner.d
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x + corner.p - corner.d,
    y + corner.p - corner.a - corner.b - corner.c
  )
  path.cubicTo(
    x + corner.p,
    y + corner.p - corner.a - corner.b,
    x + corner.p,
    y + corner.p - corner.a,
    x + corner.p,
    y + corner.p
  )
}

function drawBottomRightSmoothCorner(
  path: PathBuilder,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x, y + corner.p)
    return
  }
  path.cubicTo(
    x,
    y + corner.a,
    x,
    y + corner.a + corner.b,
    x - corner.d,
    y + corner.a + corner.b + corner.c
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x - corner.p + corner.a + corner.b + corner.c,
    y + corner.p - corner.d
  )
  path.cubicTo(
    x - corner.p + corner.a + corner.b,
    y + corner.p,
    x - corner.p + corner.a,
    y + corner.p,
    x - corner.p,
    y + corner.p
  )
}

function drawBottomLeftSmoothCorner(
  path: PathBuilder,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x - corner.p, y)
    return
  }
  path.cubicTo(
    x - corner.a,
    y,
    x - corner.a - corner.b,
    y,
    x - corner.a - corner.b - corner.c,
    y - corner.d
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x - corner.p + corner.d,
    y - corner.p + corner.a + corner.b + corner.c
  )
  path.cubicTo(
    x - corner.p,
    y - corner.p + corner.a + corner.b,
    x - corner.p,
    y - corner.p + corner.a,
    x - corner.p,
    y - corner.p
  )
}

function drawTopLeftSmoothCorner(
  path: PathBuilder,
  corner: SmoothCornerPathParams,
  x: number,
  y: number
) {
  if (corner.radius === 0) {
    path.lineTo(x, y - corner.p)
    return
  }
  path.cubicTo(
    x,
    y - corner.a,
    x,
    y - corner.a - corner.b,
    x + corner.d,
    y - corner.a - corner.b - corner.c
  )
  path.arcToRotated(
    corner.radius,
    corner.radius,
    0,
    true,
    false,
    x + corner.p - corner.a - corner.b - corner.c,
    y - corner.p + corner.d
  )
  path.cubicTo(
    x + corner.p - corner.a - corner.b,
    y - corner.p,
    x + corner.p - corner.a,
    y - corner.p,
    x + corner.p,
    y - corner.p
  )
}

export function makeSmoothRRectPath(
  r: SkiaRenderer,
  node: SceneNode,
  spread = 0,
  offsetX = 0,
  offsetY = 0
): Path {
  const path = new r.ck.PathBuilder()
  const left = offsetX - spread
  const top = offsetY - spread
  const right = offsetX + node.width + spread
  const bottom = offsetY + node.height + spread
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) {
    path.addRect(r.ck.LTRBRect(left, top, Math.max(left, right), Math.max(top, bottom)))
    return path.detachAndDelete()
  }

  const smoothing = Math.max(0, Math.min(node.cornerSmoothing, 1))
  const corners = smoothCornerRadii(node, width, height, spread)
  const topLeftCorner = smoothCornerPathParams(corners.topLeft, smoothing)
  const topRightCorner = smoothCornerPathParams(corners.topRight, smoothing)
  const bottomRightCorner = smoothCornerPathParams(corners.bottomRight, smoothing)
  const bottomLeftCorner = smoothCornerPathParams(corners.bottomLeft, smoothing)

  if (
    topLeftCorner.radius === 0 &&
    topRightCorner.radius === 0 &&
    bottomRightCorner.radius === 0 &&
    bottomLeftCorner.radius === 0
  ) {
    path.addRect(r.ck.LTRBRect(left, top, right, bottom))
    return path.detachAndDelete()
  }

  path.moveTo(right - topRightCorner.p, top)
  drawTopRightSmoothCorner(path, topRightCorner, right - topRightCorner.p, top)
  path.lineTo(right, bottom - bottomRightCorner.p)
  drawBottomRightSmoothCorner(path, bottomRightCorner, right, bottom - bottomRightCorner.p)
  path.lineTo(left + bottomLeftCorner.p, bottom)
  drawBottomLeftSmoothCorner(path, bottomLeftCorner, left + bottomLeftCorner.p, bottom)
  path.lineTo(left, top + topLeftCorner.p)
  drawTopLeftSmoothCorner(path, topLeftCorner, left, top + topLeftCorner.p)
  path.close()
  return path.detachAndDelete()
}

export function makeNodeShapePath(
  r: SkiaRenderer,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): Path {
  const path = new r.ck.PathBuilder()
  switch (node.type) {
    case 'ELLIPSE':
      path.addOval(rect)
      break
    case 'VECTOR': {
      const vps = r.getVectorPaths(node)
      if (vps) {
        for (const vp of vps) path.addPath(vp)
      }
      break
    }
    case 'POLYGON':
    case 'STAR': {
      const polyPath = r.makePolygonPath(node)
      path.addPath(polyPath)
      polyPath.delete()
      break
    }
    default:
      if (nodeHasSmoothCorners(node)) {
        const smoothPath = makeSmoothRRectPath(r, node)
        path.addPath(smoothPath)
        smoothPath.delete()
      } else if (hasRadius) {
        path.addRRect(r.makeRRect(node))
      } else {
        path.addRect(rect)
      }
  }
  return path.detachAndDelete()
}

function buildCustomRRectPath(
  r: SkiaRenderer,
  left: number,
  top: number,
  right: number,
  bottom: number,
  rxTL: number,
  ryTL: number,
  rxTR: number,
  ryTR: number,
  rxBR: number,
  ryBR: number,
  rxBL: number,
  ryBL: number
): Path {
  const pb = new r.ck.PathBuilder()
  pb.moveTo(left + rxTL, top)
  pb.lineTo(right - rxTR, top)
  if (rxTR > 0 && ryTR > 0) {
    pb.arcToRotated(rxTR, ryTR, 0, true, false, right, top + ryTR)
  } else {
    pb.lineTo(right, top)
    if (ryTR > 0) pb.lineTo(right, top + ryTR)
  }
  pb.lineTo(right, bottom - ryBR)
  if (rxBR > 0 && ryBR > 0) {
    pb.arcToRotated(rxBR, ryBR, 0, true, false, right - rxBR, bottom)
  } else {
    pb.lineTo(right, bottom)
    if (rxBR > 0) pb.lineTo(right - rxBR, bottom)
  }
  pb.lineTo(left + rxBL, bottom)
  if (rxBL > 0 && ryBL > 0) {
    pb.arcToRotated(rxBL, ryBL, 0, true, false, left, bottom - ryBL)
  } else {
    pb.lineTo(left, bottom)
    if (ryBL > 0) pb.lineTo(left, bottom - ryBL)
  }
  pb.lineTo(left, top + ryTL)
  if (rxTL > 0 && ryTL > 0) {
    pb.arcToRotated(rxTL, ryTL, 0, true, false, left + rxTL, top)
  } else {
    pb.lineTo(left, top)
    if (rxTL > 0) pb.lineTo(left + rxTL, top)
  }
  pb.close()
  return pb.detachAndDelete()
}

function clampCornerRadiiToSize(
  tl: number,
  tr: number,
  br: number,
  bl: number,
  width: number,
  height: number
) {
  let scale = 1
  if (tl + tr > width && width > 0) scale = Math.min(scale, width / (tl + tr))
  if (bl + br > width && width > 0) scale = Math.min(scale, width / (bl + br))
  if (tl + bl > height && height > 0) scale = Math.min(scale, height / (tl + bl))
  if (tr + br > height && height > 0) scale = Math.min(scale, height / (tr + br))
  if (scale >= 1) return { tl, tr, br, bl }
  return {
    tl: tl * scale,
    tr: tr * scale,
    br: br * scale,
    bl: bl * scale
  }
}

function sideOffsets(align: 'INSIDE' | 'CENTER' | 'OUTSIDE', node: SceneNode) {
  let outerMultiplier = 0
  let innerMultiplier = 0
  if (align === 'OUTSIDE') {
    outerMultiplier = 1
  } else if (align === 'INSIDE') {
    innerMultiplier = 1
  } else {
    outerMultiplier = 0.5
    innerMultiplier = 0.5
  }
  const tw = Math.max(0, node.borderTopWeight ?? 0)
  const rw = Math.max(0, node.borderRightWeight ?? 0)
  const bw = Math.max(0, node.borderBottomWeight ?? 0)
  const lw = Math.max(0, node.borderLeftWeight ?? 0)
  return {
    outT: tw * outerMultiplier,
    outR: rw * outerMultiplier,
    outB: bw * outerMultiplier,
    outL: lw * outerMultiplier,
    inT: tw * innerMultiplier,
    inR: rw * innerMultiplier,
    inB: bw * innerMultiplier,
    inL: lw * innerMultiplier
  }
}

export function buildIndividualStrokeRingPath(
  r: SkiaRenderer,
  node: SceneNode,
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE',
  cornerRadii: CornerRadii
): Path {
  const w = Math.max(0, node.width)
  const h = Math.max(0, node.height)
  const base = clampCornerRadiiToSize(
    Math.max(0, cornerRadii.topLeft),
    Math.max(0, cornerRadii.topRight),
    Math.max(0, cornerRadii.bottomRight),
    Math.max(0, cornerRadii.bottomLeft),
    w,
    h
  )
  const o = sideOffsets(align, node)

  const outLeft = -o.outL
  const outTop = -o.outT
  const outRight = w + o.outR
  const outBottom = h + o.outB
  const outW = Math.max(0, outRight - outLeft)
  const outH = Math.max(0, outBottom - outTop)

  const outRadii = clampCornerRadiiToSize(
    Math.max(0, base.tl + o.outL),
    Math.max(0, base.tr + o.outR),
    Math.max(0, base.br + o.outR),
    Math.max(0, base.bl + o.outL),
    outW,
    outH
  )
  const outRy = clampCornerRadiiToSize(
    Math.max(0, base.tl + o.outT),
    Math.max(0, base.tr + o.outT),
    Math.max(0, base.br + o.outB),
    Math.max(0, base.bl + o.outB),
    outW,
    outH
  )

  const outerPath = buildCustomRRectPath(
    r,
    outLeft,
    outTop,
    outRight,
    outBottom,
    outRadii.tl,
    outRy.tl,
    outRadii.tr,
    outRy.tr,
    outRadii.br,
    outRy.br,
    outRadii.bl,
    outRy.bl
  )

  const inLeft = o.inL
  const inTop = o.inT
  const inRight = w - o.inR
  const inBottom = h - o.inB
  const inW = inRight - inLeft
  const inH = inBottom - inTop

  if (inW <= 0 || inH <= 0) {
    return outerPath
  }

  const inRadii = clampCornerRadiiToSize(
    Math.max(0, base.tl - o.inL),
    Math.max(0, base.tr - o.inR),
    Math.max(0, base.br - o.inR),
    Math.max(0, base.bl - o.inL),
    inW,
    inH
  )
  const inRy = clampCornerRadiiToSize(
    Math.max(0, base.tl - o.inT),
    Math.max(0, base.tr - o.inT),
    Math.max(0, base.br - o.inB),
    Math.max(0, base.bl - o.inB),
    inW,
    inH
  )

  const innerPath = buildCustomRRectPath(
    r,
    inLeft,
    inTop,
    inRight,
    inBottom,
    inRadii.tl,
    inRy.tl,
    inRadii.tr,
    inRy.tr,
    inRadii.br,
    inRy.br,
    inRadii.bl,
    inRy.bl
  )

  const ringPath = r.ck.Path.MakeFromOp(outerPath, innerPath, r.ck.PathOp.Difference)
  if (ringPath) {
    outerPath.delete()
    innerPath.delete()
    return ringPath
  }

  innerPath.delete()
  return outerPath
}

function vertexMaxRadius(prev: Vector, vertex: Vector, next: Vector): number {
  const v1x = prev.x - vertex.x
  const v1y = prev.y - vertex.y
  const v2x = next.x - vertex.x
  const v2y = next.y - vertex.y
  const l1 = Math.hypot(v1x, v1y)
  const l2 = Math.hypot(v2x, v2y)
  if (l1 <= 1e-6 || l2 <= 1e-6) return 0
  const dot = v1x * v2x + v1y * v2y
  const cosTheta = Math.max(-1, Math.min(1, dot / (l1 * l2)))
  const halfAngle = Math.acos(cosTheta) / 2
  const sinHalf = Math.sin(halfAngle)
  const cosHalf = Math.cos(halfAngle)
  if (sinHalf <= 1e-6 || cosHalf <= 1e-6) return 0
  const tanHalf = Math.tan(halfAngle)
  return Math.max(0, (Math.min(l1, l2) / 2) * tanHalf)
}

export function makePolygonPath(r: SkiaRenderer, node: SceneNode): Path {
  const path = new r.ck.PathBuilder()
  const points = polygonVertices(node)
  const total = points.length
  const baseRadius = Number.isFinite(node.cornerRadius) ? Math.max(0, node.cornerRadius) : 0

  if (baseRadius <= 0 || total < 3) {
    points.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y)
      else path.lineTo(point.x, point.y)
    })
    path.close()
    return path.detachAndDelete()
  }

  const last = points[total - 1]
  const first = points[0]
  path.moveTo((last.x + first.x) / 2, (last.y + first.y) / 2)
  for (let i = 0; i < total; i++) {
    const prev = points[(i - 1 + total) % total]
    const curr = points[i]
    const next = points[(i + 1) % total]
    const radius = Math.min(baseRadius, vertexMaxRadius(prev, curr, next))
    if (radius <= 0) {
      path.lineTo(curr.x, curr.y)
    } else {
      path.arcToTangent(curr.x, curr.y, next.x, next.y, radius)
    }
  }
  path.close()
  return path.detachAndDelete()
}

export function makeRRect(r: SkiaRenderer, node: SceneNode): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      0,
      0,
      node.width,
      node.height,
      node.topLeftRadius,
      node.topLeftRadius,
      node.topRightRadius,
      node.topRightRadius,
      node.bottomRightRadius,
      node.bottomRightRadius,
      node.bottomLeftRadius,
      node.bottomLeftRadius
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(0, 0, node.width, node.height),
    node.cornerRadius,
    node.cornerRadius
  )
}

export function makeRRectWithSpread(
  r: SkiaRenderer,
  node: SceneNode,
  spread: number
): Float32Array {
  if (node.independentCorners) {
    return new Float32Array([
      -spread,
      -spread,
      node.width + spread,
      node.height + spread,
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topLeftRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.topRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomRightRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread),
      Math.max(0, node.bottomLeftRadius + spread)
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(-spread, -spread, node.width + spread, node.height + spread),
    Math.max(0, node.cornerRadius + spread),
    Math.max(0, node.cornerRadius + spread)
  )
}

export function makeRRectWithOffset(
  r: SkiaRenderer,
  node: SceneNode,
  ox: number,
  oy: number,
  spread: number
): Float32Array {
  const s = spread
  if (node.independentCorners) {
    return new Float32Array([
      ox + s,
      oy + s,
      node.width + ox - s,
      node.height + oy - s,
      Math.max(0, node.topLeftRadius - s),
      Math.max(0, node.topLeftRadius - s),
      Math.max(0, node.topRightRadius - s),
      Math.max(0, node.topRightRadius - s),
      Math.max(0, node.bottomRightRadius - s),
      Math.max(0, node.bottomRightRadius - s),
      Math.max(0, node.bottomLeftRadius - s),
      Math.max(0, node.bottomLeftRadius - s)
    ])
  }
  return r.ck.RRectXY(
    r.ck.LTRBRect(ox + s, oy + s, node.width + ox - s, node.height + oy - s),
    Math.max(0, node.cornerRadius - s),
    Math.max(0, node.cornerRadius - s)
  )
}

export function clipNodeShape(
  r: SkiaRenderer,
  canvas: Canvas,
  node: SceneNode,
  rect: Float32Array,
  hasRadius: boolean
): void {
  if (node.type === 'ELLIPSE') {
    const clipPath = new r.ck.PathBuilder()
    clipPath.addOval(rect)
    const immutableClipPath = clipPath.detachAndDelete()
    canvas.clipPath(immutableClipPath, r.ck.ClipOp.Intersect, true)
    immutableClipPath.delete()
  } else if (nodeHasSmoothCorners(node)) {
    const clipPath = makeSmoothRRectPath(r, node)
    canvas.clipPath(clipPath, r.ck.ClipOp.Intersect, true)
    clipPath.delete()
  } else if (hasRadius) {
    canvas.clipRRect(r.makeRRect(node), r.ck.ClipOp.Intersect, true)
  } else {
    canvas.clipRect(rect, r.ck.ClipOp.Intersect, true)
  }
}

export function getVectorPaths(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (!node.vectorNetwork) return null
  const cached = r.vectorPathCache.get(node.id)
  if (cached) return cached
  const paths = vectorNetworkToPath(r.ck, node.vectorNetwork)
  r.vectorPathCache.set(node.id, paths)
  return paths
}

export function getFillGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.fillGeometry.length === 0) return null
  const cached = r.fillGeometryCache.get(node.id)
  if (cached) return cached
  const paths = node.fillGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.fillGeometryCache.set(node.id, paths)
  return paths
}

export function getStrokeGeometry(r: SkiaRenderer, node: SceneNode): Path[] | null {
  if (node.strokeGeometry.length === 0) return null
  const cached = r.strokeGeometryCache.get(node.id)
  if (cached) return cached
  const paths = node.strokeGeometry.map((g) =>
    geometryBlobToPath(r.ck, g.commandsBlob, g.windingRule)
  )
  r.strokeGeometryCache.set(node.id, paths)
  return paths
}
