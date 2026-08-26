import { findDescendants, type XMLParseNode } from '#core/io/formats/idml/xml-parse'
import type { Vector, VectorNetwork, VectorRegion, VectorSegment, VectorVertex } from '@open-pencil/scene-graph'

import type { IdmlImportDiagnostic } from './types'

export interface ParsedTransform {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  skewWarning?: boolean
}

export interface ParsedBounds {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

export interface ParsedPathPoint {
  anchor: Vector
  leftDirection: Vector
  rightDirection: Vector
}

export interface ParsedPath {
  points: ParsedPathPoint[]
  closed: boolean
}

export function parseBounds(boundsStr?: string): ParsedBounds {
  if (!boundsStr) {
    return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }
  }

  const nums = boundsStr
    .trim()
    .split(/\s+/)
    .map((v) => Number.parseFloat(v))
    .filter((v) => !Number.isNaN(v))

  if (nums.length < 4) {
    return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 }
  }

  const [top, left, bottom, right] = nums
  const width = Math.max(0, right - left)
  const height = Math.max(0, bottom - top)

  return { top, left, bottom, right, width, height }
}

export function parseItemTransform(
  transformStr?: string,
  diagnostics?: IdmlImportDiagnostic[],
  elementName?: string
): ParsedTransform {
  if (!transformStr) {
    return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
  }

  const nums = transformStr
    .trim()
    .split(/\s+/)
    .map((v) => Number.parseFloat(v))
    .filter((v) => !Number.isNaN(v))

  if (nums.length < 6) {
    return { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }
  }

  const [a, b, c, d, tx, ty] = nums

  // Rotation & scale decomposition
  const rad = Math.atan2(b, a)
  let rotationDeg = (rad * 180) / Math.PI
  // Normalize rotation to 0..360 or -180..180
  if (Math.abs(rotationDeg) < 1e-4) rotationDeg = 0

  const scaleX = Math.hypot(a, b)
  const scaleY = Math.hypot(c, d)

  // Check for skew: perpendicular vectors test a*c + b*d ~= 0
  const dotProduct = a * c + b * d
  const isSkewed = Math.abs(dotProduct) > 1e-3

  if (isSkewed && diagnostics) {
    diagnostics.push({
      severity: 'warning',
      code: 'IDML_SKEW_TRANSFORM_APPROXIMATED',
      message: `Item ${elementName ? `'${elementName}' ` : ''}has a skewed transform matrix; approximated with 2D rotation.`,
      detail: transformStr
    })
  }

  return {
    x: tx,
    y: ty,
    rotation: Math.round(rotationDeg * 100) / 100,
    scaleX,
    scaleY,
    skewWarning: isSkewed
  }
}

function parsePointPair(str?: string): Vector {
  if (!str) return { x: 0, y: 0 }
  const nums = str
    .trim()
    .split(/\s+/)
    .map((v) => Number.parseFloat(v))
    .filter((v) => !Number.isNaN(v))
  return { x: nums[0] ?? 0, y: nums[1] ?? 0 }
}

export function parsePathGeometry(
  itemNode: XMLParseNode,
  pxPerPt: number
): ParsedPath[] {
  const geometryPathNodes = findDescendants(itemNode, 'GeometryPathType')
  const paths: ParsedPath[] = []

  for (const geomNode of geometryPathNodes) {
    const isClosed = geomNode.attrs['PathOpen'] === 'false'
    const pointTypeNodes = findDescendants(geomNode, 'PathPointType')
    const points: ParsedPathPoint[] = []

    for (const ptNode of pointTypeNodes) {
      const anchor = parsePointPair(ptNode.attrs['Anchor'])
      const leftDirection = ptNode.attrs['LeftDirection']
        ? parsePointPair(ptNode.attrs['LeftDirection'])
        : anchor
      const rightDirection = ptNode.attrs['RightDirection']
        ? parsePointPair(ptNode.attrs['RightDirection'])
        : anchor

      points.push({
        anchor: { x: anchor.x * pxPerPt, y: anchor.y * pxPerPt },
        leftDirection: { x: leftDirection.x * pxPerPt, y: leftDirection.y * pxPerPt },
        rightDirection: { x: rightDirection.x * pxPerPt, y: rightDirection.y * pxPerPt }
      })
    }

    if (points.length > 0) {
      paths.push({ points, closed: isClosed })
    }
  }

  return paths
}

export function isAxisAlignedBox(paths: ParsedPath[], width: number, height: number): boolean {
  if (paths.length !== 1) return false
  const path = paths[0]
  if (!path.closed || path.points.length !== 4) return false

  // Check if all tangent handles are identical to anchors (no curves)
  for (const p of path.points) {
    const isLinear =
      Math.abs(p.leftDirection.x - p.anchor.x) < 0.1 &&
      Math.abs(p.leftDirection.y - p.anchor.y) < 0.1 &&
      Math.abs(p.rightDirection.x - p.anchor.x) < 0.1 &&
      Math.abs(p.rightDirection.y - p.anchor.y) < 0.1
    if (!isLinear) return false
  }

  // Check if points form a box matching (0,0)-(width,height)
  const xs = path.points.map((p) => p.anchor.x)
  const ys = path.points.map((p) => p.anchor.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  return (
    Math.abs(maxX - minX - width) < 1 &&
    Math.abs(maxY - minY - height) < 1
  )
}

export function pathsToVectorNetwork(paths: ParsedPath[]): VectorNetwork {
  const vertices: VectorVertex[] = []
  const segments: VectorSegment[] = []
  const regions: VectorRegion[] = []

  let vertexOffset = 0
  let segmentOffset = 0

  for (const path of paths) {
    const pathPointCount = path.points.length
    if (pathPointCount === 0) continue

    const loopSegmentIndices: number[] = []

    for (let i = 0; i < pathPointCount; i++) {
      const pt = path.points[i]
      vertices.push({
        x: pt.anchor.x,
        y: pt.anchor.y
      })
    }

    const segCount = path.closed ? pathPointCount : pathPointCount - 1

    for (let i = 0; i < segCount; i++) {
      const startIdx = vertexOffset + i
      const endIdx = vertexOffset + ((i + 1) % pathPointCount)
      const startPt = path.points[i]
      const endPt = path.points[(i + 1) % pathPointCount]

      const segIdx = segmentOffset + i
      loopSegmentIndices.push(segIdx)

      segments.push({
        start: startIdx,
        end: endIdx,
        tangentStart: {
          x: startPt.rightDirection.x - startPt.anchor.x,
          y: startPt.rightDirection.y - startPt.anchor.y
        },
        tangentEnd: {
          x: endPt.anchor.x - endPt.leftDirection.x,
          y: endPt.anchor.y - endPt.leftDirection.y
        }
      })
    }

    if (path.closed && loopSegmentIndices.length > 0) {
      regions.push({ loops: [loopSegmentIndices], windingRule: 'NONZERO' })
    }

    vertexOffset += pathPointCount
    segmentOffset += segCount
  }

  return { vertices, segments, regions }
}
