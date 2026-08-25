import type { VectorNetwork, VectorRegion, VectorSegment, VectorVertex } from '@open-pencil/scene-graph'
import { normalizeVectorNetwork } from '@open-pencil/scene-graph'

const KAPPA = 0.5522847498307935

export interface VectorNetworkBuilder {
  addRect(x: number, y: number, w: number, h: number): void
  addRoundedRect(x: number, y: number, w: number, h: number, radius: number): void
  addCircle(cx: number, cy: number, r: number): void
  build(): VectorNetwork
}

export function createVectorNetworkBuilder(): VectorNetworkBuilder {
  const vertices: VectorVertex[] = []
  const segments: VectorSegment[] = []
  const regions: VectorRegion[] = []

  function addStraightSegment(startIndex: number, endIndex: number): number {
    const segIndex = segments.length
    segments.push({
      start: startIndex,
      end: endIndex,
      tangentStart: { x: 0, y: 0 },
      tangentEnd: { x: 0, y: 0 }
    })
    return segIndex
  }

  function addCurvedSegment(
    startIndex: number,
    endIndex: number,
    tsX: number,
    tsY: number,
    teX: number,
    teY: number
  ): number {
    const segIndex = segments.length
    segments.push({
      start: startIndex,
      end: endIndex,
      tangentStart: { x: tsX, y: tsY },
      tangentEnd: { x: teX, y: teY }
    })
    return segIndex
  }

  function addRect(x: number, y: number, w: number, h: number): void {
    if (w <= 0 || h <= 0) return
    const v0 = vertices.length
    vertices.push(
      { x, y, handleMirroring: 'NONE' },
      { x: x + w, y, handleMirroring: 'NONE' },
      { x: x + w, y: y + h, handleMirroring: 'NONE' },
      { x, y: y + h, handleMirroring: 'NONE' }
    )

    const s0 = addStraightSegment(v0, v0 + 1)
    const s1 = addStraightSegment(v0 + 1, v0 + 2)
    const s2 = addStraightSegment(v0 + 2, v0 + 3)
    const s3 = addStraightSegment(v0 + 3, v0)

    regions.push({
      windingRule: 'NONZERO',
      loops: [[s0, s1, s2, s3]]
    })
  }

  function addRoundedRect(x: number, y: number, w: number, h: number, rawRadius: number): void {
    if (w <= 0 || h <= 0) return
    const maxRadius = Math.min(w, h) / 2
    const radius = Math.max(0, Math.min(rawRadius, maxRadius))

    if (radius <= 0.001) {
      addRect(x, y, w, h)
      return
    }

    const k = radius * KAPPA
    const v0 = vertices.length

    vertices.push(
      { x: x + radius, y, handleMirroring: 'NONE' }, // 0: Top edge start
      { x: x + w - radius, y, handleMirroring: 'NONE' }, // 1: Top edge end
      { x: x + w, y: y + radius, handleMirroring: 'NONE' }, // 2: Right edge start
      { x: x + w, y: y + h - radius, handleMirroring: 'NONE' }, // 3: Right edge end
      { x: x + w - radius, y: y + h, handleMirroring: 'NONE' }, // 4: Bottom edge start
      { x: x + radius, y: y + h, handleMirroring: 'NONE' }, // 5: Bottom edge end
      { x, y: y + h - radius, handleMirroring: 'NONE' }, // 6: Left edge start
      { x, y: y + radius, handleMirroring: 'NONE' } // 7: Left edge end
    )

    const s0 = addStraightSegment(v0, v0 + 1)
    const s1 = addCurvedSegment(v0 + 1, v0 + 2, k, 0, 0, -k)
    const s2 = addStraightSegment(v0 + 2, v0 + 3)
    const s3 = addCurvedSegment(v0 + 3, v0 + 4, 0, k, k, 0)
    const s4 = addStraightSegment(v0 + 4, v0 + 5)
    const s5 = addCurvedSegment(v0 + 5, v0 + 6, -k, 0, 0, k)
    const s6 = addStraightSegment(v0 + 6, v0 + 7)
    const s7 = addCurvedSegment(v0 + 7, v0, 0, -k, -k, 0)

    regions.push({
      windingRule: 'NONZERO',
      loops: [[s0, s1, s2, s3, s4, s5, s6, s7]]
    })
  }

  function addCircle(cx: number, cy: number, r: number): void {
    if (r <= 0) return
    const k = r * KAPPA
    const v0 = vertices.length

    vertices.push(
      { x: cx, y: cy - r, handleMirroring: 'NONE' }, // Top
      { x: cx + r, y: cy, handleMirroring: 'NONE' }, // Right
      { x: cx, y: cy + r, handleMirroring: 'NONE' }, // Bottom
      { x: cx - r, y: cy, handleMirroring: 'NONE' } // Left
    )

    const s0 = addCurvedSegment(v0, v0 + 1, k, 0, 0, -k)
    const s1 = addCurvedSegment(v0 + 1, v0 + 2, 0, k, k, 0)
    const s2 = addCurvedSegment(v0 + 2, v0 + 3, -k, 0, 0, k)
    const s3 = addCurvedSegment(v0 + 3, v0, 0, -k, -k, 0)

    regions.push({
      windingRule: 'NONZERO',
      loops: [[s0, s1, s2, s3]]
    })
  }

  function build(): VectorNetwork {
    return normalizeVectorNetwork({
      vertices,
      segments,
      regions
    })
  }

  return {
    addRect,
    addRoundedRect,
    addCircle,
    build
  }
}
