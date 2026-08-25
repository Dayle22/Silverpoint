import type { Vector } from './primitives'
import type { GradientSpinePoint, GradientStop } from './types'

export const CURVED_GRADIENT_BANDS = 24

export interface BandPolygon {
  p0a: Vector
  p1a: Vector
  p1b: Vector
  p0b: Vector
}

export interface BandDescriptor {
  P0: Vector
  P1: Vector
  color0: Float32Array
  color1: Float32Array
  polygon?: BandPolygon
}

export function sampleGradientSpine(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  spine: GradientSpinePoint[]
): Vector[] {
  const dx = endX - startX
  const dy = endY - startY
  const perp = { x: -dy, y: dx }

  const validSpine = spine
    .filter((p) => typeof p.t === 'number' && !Number.isNaN(p.t) && p.t > 1e-4 && p.t < 1 - 1e-4)
    .sort((a, b) => a.t - b.t)

  const deduped: GradientSpinePoint[] = []
  for (const p of validSpine) {
    if (deduped.length === 0 || p.t - deduped[deduped.length - 1].t >= 1e-4) {
      deduped.push(p)
    }
  }

  if (deduped.length === 0) {
    const points: Vector[] = []
    for (let k = 0; k <= CURVED_GRADIENT_BANDS; k++) {
      const t = k / CURVED_GRADIENT_BANDS
      points.push({
        x: startX + t * dx,
        y: startY + t * dy
      })
    }
    return points
  }

  const anchors: Array<Vector & { t: number }> = [
    { x: startX, y: startY, t: 0 }
  ]
  for (const p of deduped) {
    anchors.push({
      x: startX + p.t * dx + p.offset * perp.x,
      y: startY + p.t * dy + p.offset * perp.y,
      t: p.t
    })
  }
  anchors.push({ x: endX, y: endY, t: 1 })

  const m = anchors.length - 1
  const pPrev: Vector = {
    x: 2 * anchors[0].x - anchors[1].x,
    y: 2 * anchors[0].y - anchors[1].y
  }
  const pNext: Vector = {
    x: 2 * anchors[m].x - anchors[m - 1].x,
    y: 2 * anchors[m].y - anchors[m - 1].y
  }

  const segmentControls: Array<{
    c1: Vector
    c2: Vector
  }> = []

  for (let i = 0; i < m; i++) {
    const p0 = i === 0 ? pPrev : anchors[i - 1]
    const p1 = anchors[i]
    const p2 = anchors[i + 1]
    const p3 = i === m - 1 ? pNext : anchors[i + 2]

    segmentControls.push({
      c1: {
        x: p1.x + (p2.x - p0.x) / 6,
        y: p1.y + (p2.y - p0.y) / 6
      },
      c2: {
        x: p2.x - (p3.x - p1.x) / 6,
        y: p2.y - (p3.y - p1.y) / 6
      }
    })
  }

  function evaluateSpline(t: number): Vector {
    if (t <= 0) return { x: anchors[0].x, y: anchors[0].y }
    if (t >= 1) return { x: anchors[m].x, y: anchors[m].y }

    let i = 0
    while (i < m - 1 && anchors[i + 1].t < t) {
      i++
    }

    const t0 = anchors[i].t
    const t1 = anchors[i + 1].t
    const dt = t1 - t0
    const u = dt > 1e-6 ? (t - t0) / dt : 0
    const oneMinusU = 1 - u

    const p1 = anchors[i]
    const p2 = anchors[i + 1]
    const { c1, c2 } = segmentControls[i]

    const b0 = oneMinusU * oneMinusU * oneMinusU
    const b1 = 3 * oneMinusU * oneMinusU * u
    const b2 = 3 * oneMinusU * u * u
    const b3 = u * u * u

    return {
      x: b0 * p1.x + b1 * c1.x + b2 * c2.x + b3 * p2.x,
      y: b0 * p1.y + b1 * c1.y + b2 * c2.y + b3 * p2.y
    }
  }

  const points: Vector[] = []
  for (let k = 0; k <= CURVED_GRADIENT_BANDS; k++) {
    const t = k / CURVED_GRADIENT_BANDS
    points.push(evaluateSpline(t))
  }
  return points
}

export function colorAtT(stops: GradientStop[], t: number): Float32Array {
  if (stops.length === 0) {
    return new Float32Array([0, 0, 0, 0])
  }
  const clampedT = Math.max(0, Math.min(1, t))
  const sorted = [...stops].sort((a, b) => a.position - b.position)

  if (sorted.length === 1 || clampedT <= sorted[0].position) {
    const c = sorted[0].color
    return new Float32Array([c.r, c.g, c.b, c.a])
  }
  if (clampedT >= sorted[sorted.length - 1].position) {
    const c = sorted[sorted.length - 1].color
    return new Float32Array([c.r, c.g, c.b, c.a])
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i]
    const s1 = sorted[i + 1]
    if (clampedT >= s0.position && clampedT <= s1.position) {
      const span = s1.position - s0.position
      const factor = span > 0 ? (clampedT - s0.position) / span : 0
      const r = s0.color.r + factor * (s1.color.r - s0.color.r)
      const g = s0.color.g + factor * (s1.color.g - s0.color.g)
      const b = s0.color.b + factor * (s1.color.b - s0.color.b)
      const a = s0.color.a + factor * (s1.color.a - s0.color.a)
      return new Float32Array([r, g, b, a])
    }
  }
  const last = sorted[sorted.length - 1].color
  return new Float32Array([last.r, last.g, last.b, last.a])
}

export function computeCurvedGradientBandPolygons(
  points: Vector[],
  margin: number
): BandPolygon[] {
  const n = points.length - 1
  if (n <= 0) return []

  const segDir: Vector[] = []
  const segNorm: Vector[] = []

  for (let i = 0; i < n; i++) {
    const dx = points[i + 1].x - points[i].x
    const dy = points[i + 1].y - points[i].y
    const len = Math.hypot(dx, dy)
    if (len > 1e-6) {
      segDir.push({ x: dx / len, y: dy / len })
      segNorm.push({ x: -dy / len, y: dx / len })
    } else {
      segDir.push({ x: 1, y: 0 })
      segNorm.push({ x: 0, y: 1 })
    }
  }

  const jointNorm: Vector[] = []
  for (let i = 0; i <= n; i++) {
    if (i === 0) {
      jointNorm.push(segNorm[0])
    } else if (i === n) {
      jointNorm.push(segNorm[n - 1])
    } else {
      const nx = segNorm[i - 1].x + segNorm[i].x
      const ny = segNorm[i - 1].y + segNorm[i].y
      const nlen = Math.hypot(nx, ny)
      if (nlen > 1e-6) {
        jointNorm.push({ x: nx / nlen, y: ny / nlen })
      } else {
        jointNorm.push(segNorm[i])
      }
    }
  }

  const topVerts: Vector[] = []
  const botVerts: Vector[] = []

  for (let i = 0; i <= n; i++) {
    const pt = points[i]
    const jn = jointNorm[i]
    if (i === 0) {
      const d = segDir[0]
      const baseX = pt.x - d.x * margin
      const baseY = pt.y - d.y * margin
      topVerts.push({ x: baseX + jn.x * margin, y: baseY + jn.y * margin })
      botVerts.push({ x: baseX - jn.x * margin, y: baseY - jn.y * margin })
    } else if (i === n) {
      const d = segDir[n - 1]
      const baseX = pt.x + d.x * margin
      const baseY = pt.y + d.y * margin
      topVerts.push({ x: baseX + jn.x * margin, y: baseY + jn.y * margin })
      botVerts.push({ x: baseX - jn.x * margin, y: baseY - jn.y * margin })
    } else {
      topVerts.push({ x: pt.x + jn.x * margin, y: pt.y + jn.y * margin })
      botVerts.push({ x: pt.x - jn.x * margin, y: pt.y - jn.y * margin })
    }
  }

  const polygons: BandPolygon[] = []
  for (let k = 0; k < n; k++) {
    polygons.push({
      p0a: topVerts[k],
      p1a: topVerts[k + 1],
      p1b: botVerts[k + 1],
      p0b: botVerts[k]
    })
  }

  return polygons
}

export function curvedGradientBandDescriptors(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  spine: GradientSpinePoint[],
  stops: GradientStop[],
  margin = 0
): BandDescriptor[] {
  const points = sampleGradientSpine(startX, startY, endX, endY, spine)
  const polygons = margin > 0 ? computeCurvedGradientBandPolygons(points, margin) : undefined
  const bands: BandDescriptor[] = []
  for (let k = 0; k < CURVED_GRADIENT_BANDS; k++) {
    const t0 = k / CURVED_GRADIENT_BANDS
    const t1 = (k + 1) / CURVED_GRADIENT_BANDS
    bands.push({
      P0: points[k],
      P1: points[k + 1],
      color0: colorAtT(stops, t0),
      color1: colorAtT(stops, t1),
      polygon: polygons ? polygons[k] : undefined
    })
  }
  return bands
}
