import type { SceneNode, Vector, VectorNetwork } from '@open-pencil/scene-graph'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'

import { nodeHasRadius } from '#core/canvas/shapes'
import { round } from '#core/io/formats/svg/paths'
import { el, type XMLNode } from './xml'

export interface IDMLPathPoint {
  anchor: Vector
  leftDirection: Vector
  rightDirection: Vector
}

export interface IDMLPath {
  points: IDMLPathPoint[]
  closed: boolean
}

const KAPPA = 0.5522847498307935

export function createRectPath(node: SceneNode, ptPerPx: number): IDMLPath {
  const w = node.width * ptPerPx
  const h = node.height * ptPerPx

  let tl = 0
  let tr = 0
  let br = 0
  let bl = 0

  if (nodeHasRadius(node)) {
    if (node.independentCorners) {
      tl = node.topLeftRadius * ptPerPx
      tr = node.topRightRadius * ptPerPx
      br = node.bottomRightRadius * ptPerPx
      bl = node.bottomLeftRadius * ptPerPx
    } else {
      tl = tr = br = bl = node.cornerRadius * ptPerPx
    }
  }

  const maxR = Math.min(w / 2, h / 2)
  tl = Math.min(tl, maxR)
  tr = Math.min(tr, maxR)
  br = Math.min(br, maxR)
  bl = Math.min(bl, maxR)

  const hasAnyRadius = tl > 0 || tr > 0 || br > 0 || bl > 0

  if (!hasAnyRadius) {
    return {
      closed: true,
      points: [
        {
          anchor: { x: 0, y: 0 },
          leftDirection: { x: 0, y: 0 },
          rightDirection: { x: 0, y: 0 }
        },
        {
          anchor: { x: round(w), y: 0 },
          leftDirection: { x: round(w), y: 0 },
          rightDirection: { x: round(w), y: 0 }
        },
        {
          anchor: { x: round(w), y: round(h) },
          leftDirection: { x: round(w), y: round(h) },
          rightDirection: { x: round(w), y: round(h) }
        },
        {
          anchor: { x: 0, y: round(h) },
          leftDirection: { x: 0, y: round(h) },
          rightDirection: { x: 0, y: round(h) }
        }
      ]
    }
  }

  return {
    closed: true,
    points: [
      {
        anchor: { x: round(tl), y: 0 },
        leftDirection: { x: round(tl * (1 - KAPPA)), y: 0 },
        rightDirection: { x: round(tl), y: 0 }
      },
      {
        anchor: { x: round(w - tr), y: 0 },
        leftDirection: { x: round(w - tr), y: 0 },
        rightDirection: { x: round(w - tr * (1 - KAPPA)), y: 0 }
      },
      {
        anchor: { x: round(w), y: round(tr) },
        leftDirection: { x: round(w), y: round(tr * (1 - KAPPA)) },
        rightDirection: { x: round(w), y: round(tr) }
      },
      {
        anchor: { x: round(w), y: round(h - br) },
        leftDirection: { x: round(w), y: round(h - br) },
        rightDirection: { x: round(w), y: round(h - br * (1 - KAPPA)) }
      },
      {
        anchor: { x: round(w - br), y: round(h) },
        leftDirection: { x: round(w - br * (1 - KAPPA)), y: round(h) },
        rightDirection: { x: round(w - br), y: round(h) }
      },
      {
        anchor: { x: round(bl), y: round(h) },
        leftDirection: { x: round(bl), y: round(h) },
        rightDirection: { x: round(bl * (1 - KAPPA)), y: round(h) }
      },
      {
        anchor: { x: 0, y: round(h - bl) },
        leftDirection: { x: 0, y: round(h - bl * (1 - KAPPA)) },
        rightDirection: { x: 0, y: round(h - bl) }
      },
      {
        anchor: { x: 0, y: round(tl) },
        leftDirection: { x: 0, y: round(tl) },
        rightDirection: { x: 0, y: round(tl * (1 - KAPPA)) }
      }
    ]
  }
}

export function createEllipsePath(node: SceneNode, ptPerPx: number): IDMLPath {
  const w = node.width * ptPerPx
  const h = node.height * ptPerPx
  const rx = w / 2
  const ry = h / 2
  const cx = rx
  const cy = ry
  const dx = rx * KAPPA
  const dy = ry * KAPPA

  return {
    closed: true,
    points: [
      {
        anchor: { x: round(cx), y: 0 },
        leftDirection: { x: round(cx - dx), y: 0 },
        rightDirection: { x: round(cx + dx), y: 0 }
      },
      {
        anchor: { x: round(w), y: round(cy) },
        leftDirection: { x: round(w), y: round(cy - dy) },
        rightDirection: { x: round(w), y: round(cy + dy) }
      },
      {
        anchor: { x: round(cx), y: round(h) },
        leftDirection: { x: round(cx + dx), y: round(h) },
        rightDirection: { x: round(cx - dx), y: round(h) }
      },
      {
        anchor: { x: 0, y: round(cy) },
        leftDirection: { x: 0, y: round(cy + dy) },
        rightDirection: { x: 0, y: round(cy - dy) }
      }
    ]
  }
}

export function createLinePath(node: SceneNode, ptPerPx: number): IDMLPath {
  const w = node.width * ptPerPx
  const h = node.height * ptPerPx

  return {
    closed: false,
    points: [
      {
        anchor: { x: 0, y: 0 },
        leftDirection: { x: 0, y: 0 },
        rightDirection: { x: 0, y: 0 }
      },
      {
        anchor: { x: round(w), y: round(h) },
        leftDirection: { x: round(w), y: round(h) },
        rightDirection: { x: round(w), y: round(h) }
      }
    ]
  }
}

export function parseGeometryBlobToIDMLPaths(blob: Uint8Array, ptPerPx: number): IDMLPath[] {
  if (blob.length === 0) return []
  const dv = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
  let o = 0
  const paths: IDMLPath[] = []
  let currentPath: IDMLPathPoint[] = []

  while (o < blob.length) {
    const cmd = blob[o++]
    switch (cmd) {
      case 0: {
        // CMD_CLOSE
        if (currentPath.length > 0) {
          paths.push({ points: currentPath, closed: true })
          currentPath = []
        }
        break
      }
      case 1: {
        // CMD_MOVE_TO
        if (currentPath.length > 0) {
          paths.push({ points: currentPath, closed: false })
          currentPath = []
        }
        const x = round(dv.getFloat32(o, true) * ptPerPx)
        const y = round(dv.getFloat32(o + 4, true) * ptPerPx)
        o += 8
        currentPath.push({
          anchor: { x, y },
          leftDirection: { x, y },
          rightDirection: { x, y }
        })
        break
      }
      case 2: {
        // CMD_LINE_TO
        const x = round(dv.getFloat32(o, true) * ptPerPx)
        const y = round(dv.getFloat32(o + 4, true) * ptPerPx)
        o += 8
        currentPath.push({
          anchor: { x, y },
          leftDirection: { x, y },
          rightDirection: { x, y }
        })
        break
      }
      case 3: {
        // CMD_QUAD_TO (x1, y1, x, y)
        const qx1 = dv.getFloat32(o, true) * ptPerPx
        const qy1 = dv.getFloat32(o + 4, true) * ptPerPx
        const x = dv.getFloat32(o + 8, true) * ptPerPx
        const y = dv.getFloat32(o + 12, true) * ptPerPx
        o += 16

        const last = currentPath.at(-1)
        if (last) {
          const cp1x = last.anchor.x + (2 / 3) * (qx1 - last.anchor.x)
          const cp1y = last.anchor.y + (2 / 3) * (qy1 - last.anchor.y)
          last.rightDirection = { x: round(cp1x), y: round(cp1y) }

          const cp2x = x + (2 / 3) * (qx1 - x)
          const cp2y = y + (2 / 3) * (qy1 - y)
          currentPath.push({
            anchor: { x: round(x), y: round(y) },
            leftDirection: { x: round(cp2x), y: round(cp2y) },
            rightDirection: { x: round(x), y: round(y) }
          })
        }
        break
      }
      case 4: {
        // CMD_CUBIC_TO (x1, y1, x2, y2, x, y)
        const c1x = dv.getFloat32(o, true) * ptPerPx
        const c1y = dv.getFloat32(o + 4, true) * ptPerPx
        const c2x = dv.getFloat32(o + 8, true) * ptPerPx
        const c2y = dv.getFloat32(o + 12, true) * ptPerPx
        const x = dv.getFloat32(o + 16, true) * ptPerPx
        const y = dv.getFloat32(o + 20, true) * ptPerPx
        o += 24

        const last = currentPath.at(-1)
        if (last) {
          last.rightDirection = { x: round(c1x), y: round(c1y) }
          currentPath.push({
            anchor: { x: round(x), y: round(y) },
            leftDirection: { x: round(c2x), y: round(c2y) },
            rightDirection: { x: round(x), y: round(y) }
          })
        }
        break
      }
      default:
        break
    }
  }

  if (currentPath.length > 0) {
    paths.push({ points: currentPath, closed: false })
  }

  return paths
}

export function parseVectorNetworkToIDMLPaths(network: VectorNetwork, ptPerPx: number): IDMLPath[] {
  const { vertices, segments, regions } = network
  const paths: IDMLPath[] = []

  if (regions.length > 0) {
    for (const region of regions) {
      for (const loop of region.loops) {
        if (loop.length === 0) continue
        const points: IDMLPathPoint[] = []
        for (const segIdx of loop) {
          const seg = segments[segIdx] as (typeof segments)[number] | undefined
          if (!seg) continue
          const v = vertices[seg.start]
          const x = round(v.x * ptPerPx)
          const y = round(v.y * ptPerPx)
          const rx = round((v.x + seg.tangentStart.x) * ptPerPx)
          const ry = round((v.y + seg.tangentStart.y) * ptPerPx)
          const lx = round((v.x - seg.tangentEnd.x) * ptPerPx)
          const ly = round((v.y - seg.tangentEnd.y) * ptPerPx)
          points.push({
            anchor: { x, y },
            leftDirection: { x: lx, y: ly },
            rightDirection: { x: rx, y: ry }
          })
        }
        if (points.length > 0) {
          paths.push({ points, closed: true })
        }
      }
    }
    return paths
  }

  if (segments.length > 0) {
    const points: IDMLPathPoint[] = []
    for (const seg of segments) {
      const v = vertices[seg.start]
      points.push({
        anchor: { x: round(v.x * ptPerPx), y: round(v.y * ptPerPx) },
        leftDirection: { x: round(v.x * ptPerPx), y: round(v.y * ptPerPx) },
        rightDirection: {
          x: round((v.x + seg.tangentStart.x) * ptPerPx),
          y: round((v.y + seg.tangentStart.y) * ptPerPx)
        }
      })
    }
    const lastSeg = segments.at(-1)
    if (lastSeg) {
      const v = vertices[lastSeg.end]
      points.push({
        anchor: { x: round(v.x * ptPerPx), y: round(v.y * ptPerPx) },
        leftDirection: {
          x: round((v.x + lastSeg.tangentEnd.x) * ptPerPx),
          y: round((v.y + lastSeg.tangentEnd.y) * ptPerPx)
        },
        rightDirection: { x: round(v.x * ptPerPx), y: round(v.y * ptPerPx) }
      })
    }
    paths.push({ points, closed: false })
  }

  return paths
}

export function createPolygonPath(node: SceneNode, ptPerPx: number): IDMLPath {
  const vertices = polygonVertices(node)
  const points: IDMLPathPoint[] = vertices.map((v) => {
    const x = round(v.x * ptPerPx)
    const y = round(v.y * ptPerPx)
    return {
      anchor: { x, y },
      leftDirection: { x, y },
      rightDirection: { x, y }
    }
  })
  return { points, closed: true }
}

export function getNodeIDMLPaths(node: SceneNode, ptPerPx: number): IDMLPath[] {
  if (node.fillGeometry.length > 0) {
    const allPaths: IDMLPath[] = []
    for (const geom of node.fillGeometry) {
      allPaths.push(...parseGeometryBlobToIDMLPaths(geom.commandsBlob, ptPerPx))
    }
    if (allPaths.length > 0) return allPaths
  }

  if (node.vectorNetwork && node.vectorNetwork.segments.length > 0) {
    return parseVectorNetworkToIDMLPaths(node.vectorNetwork, ptPerPx)
  }

  switch (node.type) {
    case 'RECTANGLE':
    case 'ROUNDED_RECTANGLE':
    case 'FRAME':
    case 'COMPONENT':
    case 'INSTANCE':
    case 'TEXT':
      return [createRectPath(node, ptPerPx)]
    case 'ELLIPSE':
      return [createEllipsePath(node, ptPerPx)]
    case 'LINE':
      return [createLinePath(node, ptPerPx)]
    case 'POLYGON':
    case 'STAR':
      return [createPolygonPath(node, ptPerPx)]
    default:
      return [createRectPath(node, ptPerPx)]
  }
}

export function renderPathGeometryXML(paths: IDMLPath[]): XMLNode {
  const geometryNodes = paths.map((path) =>
    el(
      'GeometryPathType',
      { PathOpen: path.closed ? 'false' : 'true' },
      el(
        'PathPointArray',
        {},
        ...path.points.map((p) =>
          el('PathPointType', {
            Anchor: `${p.anchor.x} ${p.anchor.y}`,
            LeftDirection: `${p.leftDirection.x} ${p.leftDirection.y}`,
            RightDirection: `${p.rightDirection.x} ${p.rightDirection.y}`
          })
        )
      )
    )
  )

  return el('Properties', {}, el('PathGeometry', {}, ...geometryNodes))
}
