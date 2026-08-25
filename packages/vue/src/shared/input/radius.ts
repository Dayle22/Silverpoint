import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { CornerPosition, DragRadius, RadiusHandle } from '#vue/shared/input/types'

const RADIUS_CONTROL_SCREEN_INSET = 12

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE',
  'BOOLEAN_OPERATION'
])

const POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])

const CORNER_DIRECTIONS: Record<CornerPosition, Vector> = {
  nw: { x: 1, y: 1 },
  ne: { x: -1, y: 1 },
  se: { x: -1, y: -1 },
  sw: { x: 1, y: -1 }
}

type RadiusField = 'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius'

const RADIUS_FIELD_BY_CORNER: Record<CornerPosition, RadiusField> = {
  nw: 'topLeftRadius',
  ne: 'topRightRadius',
  se: 'bottomRightRadius',
  sw: 'bottomLeftRadius'
}

function cornerPoint(corner: CornerPosition, width: number, height: number, inset: number): Vector {
  switch (corner) {
    case 'nw':
      return { x: inset, y: inset }
    case 'ne':
      return { x: width - inset, y: inset }
    case 'se':
      return { x: width - inset, y: height - inset }
    case 'sw':
      return { x: inset, y: height - inset }
    default:
      return { x: 0, y: 0 }
  }
}

function outerVertexArrayIndex(node: Pick<SceneNode, 'type'>, handleIndex: number): number {
  return node.type === 'STAR' ? handleIndex * 2 : handleIndex
}

function pointHandleCount(node: Pick<SceneNode, 'pointCount'>): number {
  return Math.max(3, node.pointCount)
}

function vertexMaxRadius(prev: Vector, vertex: Vector, next: Vector): number {
  const v1x = prev.x - vertex.x
  const v1y = prev.y - vertex.y
  const v2x = next.x - vertex.x
  const v2y = next.y - vertex.y
  const len1 = Math.hypot(v1x, v1y)
  const len2 = Math.hypot(v2x, v2y)
  if (len1 === 0 || len2 === 0) return 0
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (len1 * len2)))
  const halfAngle = Math.acos(cos) / 2
  const tanHalfAngle = Math.tan(halfAngle)
  if (!Number.isFinite(tanHalfAngle) || tanHalfAngle <= 0) return 0
  return (Math.min(len1, len2) / 2) * tanHalfAngle
}

function vertexGeometry(
  node: Pick<SceneNode, 'width' | 'height' | 'pointCount' | 'type' | 'starInnerRadius'>,
  handleIndex: number
): { vertex: Vector; direction: Vector; maxInset: number } | null {
  const vertices = polygonVertices(node)
  const total = vertices.length
  if (total < 3) return null
  const arrIndex = outerVertexArrayIndex(node, handleIndex)
  const prev = vertices[(arrIndex - 1 + total) % total]
  const curr = vertices[arrIndex]
  const next = vertices[(arrIndex + 1) % total]
  const cx = node.width / 2
  const cy = node.height / 2
  const dx = cx - curr.x
  const dy = cy - curr.y
  const dist = Math.hypot(dx, dy)
  const direction = dist === 0 ? { x: 0, y: 0 } : { x: dx / dist, y: dy / dist }
  return { vertex: curr, direction, maxInset: vertexMaxRadius(prev, curr, next) }
}

export function getVertexRadiusControlLocalPoint(
  node: Pick<
    SceneNode,
    'width' | 'height' | 'pointCount' | 'type' | 'starInnerRadius' | 'cornerRadius'
  >,
  handleIndex: number,
  zoom = 1
): Vector {
  const geometry = vertexGeometry(node, handleIndex)
  if (!geometry) return { x: 0, y: 0 }
  const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)
  const safeRadius = Number.isFinite(node.cornerRadius) ? Math.max(0, node.cornerRadius) : 0
  const inset = Math.min(Math.max(minInset, safeRadius), geometry.maxInset)
  return {
    x: geometry.vertex.x + geometry.direction.x * inset,
    y: geometry.vertex.y + geometry.direction.y * inset
  }
}

export function getVertexRadiusControlPosition(
  node: SceneNode,
  graph: SceneGraph,
  handleIndex: number,
  zoom = 1
): Vector {
  const local = getVertexRadiusControlLocalPoint(node, handleIndex, zoom)
  return Matrix.mapPoint(getWorldMatrix(node, graph), local)
}

export function getRadiusControlLocalPoint(
  corner: CornerPosition,
  width: number,
  height: number,
  radius: number,
  zoom = 1
): Vector {
  const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)
  const maxInset = Math.min(width, height) / 2
  const safeRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0
  const inset = Math.min(Math.max(minInset, safeRadius), maxInset)
  return cornerPoint(corner, width, height, inset)
}

export function getRadiusControlPosition(
  node: SceneNode,
  graph: SceneGraph,
  corner: CornerPosition,
  zoom = 1
): Vector {
  const radius = radiusForCorner(corner, node)
  const local = getRadiusControlLocalPoint(corner, node.width, node.height, radius, zoom)
  return Matrix.mapPoint(getWorldMatrix(node, graph), local)
}

export function hitTestRadiusControlByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom = 1
): RadiusHandle | null {
  const hitRadius = HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)

  if (CORNER_RADIUS_TYPES.has(node.type)) {
    for (const corner of ['nw', 'ne', 'se', 'sw'] as const) {
      const point = getRadiusControlPosition(node, graph, corner, zoom)
      const dx = cx - point.x
      const dy = cy - point.y
      if (dx * dx + dy * dy <= hitRadius * hitRadius) return corner
    }
    return null
  }

  if (POINT_RADIUS_TYPES.has(node.type)) {
    const count = pointHandleCount(node)
    for (let i = 0; i < count; i++) {
      const point = getVertexRadiusControlPosition(node, graph, i, zoom)
      const dx = cx - point.x
      const dy = cy - point.y
      if (dx * dx + dy * dy <= hitRadius * hitRadius)
        return `vertex:${i}`
    }
  }

  return null
}

export function worldToNodeLocalPoint(
  node: SceneNode,
  graph: SceneGraph,
  point: Vector
): Vector | null {
  const inverse = Matrix.invert(getWorldMatrix(node, graph))
  return inverse ? Matrix.mapPoint(inverse, point) : null
}

export function calculateRadiusFromLocalPointer(
  corner: CornerPosition,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  originalRadius: number
): number {
  if (![startX, startY, currentX, currentY, originalRadius].every(Number.isFinite)) {
    return Math.max(0, Number.isFinite(originalRadius) ? originalRadius : 0)
  }

  const direction = CORNER_DIRECTIONS[corner]
  const length = Math.SQRT2
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  const projectedDelta = (deltaX * direction.x + deltaY * direction.y) / length
  return Math.max(0, originalRadius + projectedDelta)
}

function calculateVertexRadiusFromLocalPointer(
  direction: Vector,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  originalRadius: number
): number {
  if (![startX, startY, currentX, currentY, originalRadius].every(Number.isFinite)) {
    return Math.max(0, Number.isFinite(originalRadius) ? originalRadius : 0)
  }
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  const projectedDelta = deltaX * direction.x + deltaY * direction.y
  return Math.max(0, originalRadius + projectedDelta)
}

export function getRadiusChanges(
  corner: RadiusHandle,
  node: Pick<
    SceneNode,
    | 'cornerRadius'
    | 'topLeftRadius'
    | 'topRightRadius'
    | 'bottomRightRadius'
    | 'bottomLeftRadius'
    | 'independentCorners'
  >,
  radius: number
): Partial<SceneNode> {
  const nextRadius = Number.isFinite(radius) ? Math.max(0, radius) : node.cornerRadius

  if (corner.startsWith('vertex:')) return { cornerRadius: nextRadius }

  if (!node.independentCorners) {
    return {
      cornerRadius: nextRadius,
      topLeftRadius: nextRadius,
      topRightRadius: nextRadius,
      bottomRightRadius: nextRadius,
      bottomLeftRadius: nextRadius,
      independentCorners: false
    }
  }

  return {
    [RADIUS_FIELD_BY_CORNER[corner as CornerPosition]]: nextRadius,
    independentCorners: true
  }
}

function radiusForCorner(
  corner: RadiusHandle,
  node: Pick<DragRadius['original'], 'cornerRadius' | RadiusField | 'independentCorners'>
): number {
  if (corner.startsWith('vertex:')) return node.cornerRadius
  return node.independentCorners
    ? node[RADIUS_FIELD_BY_CORNER[corner as CornerPosition]]
    : node.cornerRadius
}

function originalRadiusChanges(d: DragRadius): DragRadius['original'] {
  return d.original
}

export function tryStartRadius(cx: number, cy: number, editor: Editor): DragRadius | null {
  if (editor.state.selectedIds.size !== 1) return null
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node || node.locked) return null
  if (!CORNER_RADIUS_TYPES.has(node.type) && !POINT_RADIUS_TYPES.has(node.type)) return null

  const corner = hitTestRadiusControlByMatrix(cx, cy, node, editor.graph, editor.renderer?.zoom)
  if (!corner) return null
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (!local) return null

  const direction = corner.startsWith('vertex:')
    ? vertexGeometry(node, Number(corner.slice('vertex:'.length)))?.direction
    : undefined

  return {
    type: 'radius',
    nodeId: id,
    corner,
    startLocalX: local.x,
    startLocalY: local.y,
    direction,
    original: {
      cornerRadius: node.cornerRadius,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius,
      independentCorners: node.independentCorners
    }
  }
}

export function applyRadiusDrag(d: DragRadius, cx: number, cy: number, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (!local) return
  const originalRadius = radiusForCorner(d.corner, d.original)
  const next = Math.round(
    d.corner.startsWith('vertex:') && d.direction
      ? calculateVertexRadiusFromLocalPointer(
          d.direction,
          d.startLocalX,
          d.startLocalY,
          local.x,
          local.y,
          originalRadius
        )
      : calculateRadiusFromLocalPointer(
          d.corner as CornerPosition,
          d.startLocalX,
          d.startLocalY,
          local.x,
          local.y,
          originalRadius
        )
  )
  editor.graph.updateNodePreview(d.nodeId, getRadiusChanges(d.corner, d.original, next))
  editor.requestRepaint()
}

export function commitRadiusDrag(d: DragRadius, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalRadius: number = d.corner.startsWith('vertex:')
    ? node.cornerRadius
    : (node.independentCorners
        ? node[RADIUS_FIELD_BY_CORNER[d.corner as CornerPosition]]
        : node.cornerRadius)
  const originalRadius = radiusForCorner(d.corner, d.original)
  if (!Number.isFinite(finalRadius) || finalRadius === originalRadius) {
    editor.updateNode(d.nodeId, originalRadiusChanges(d))
    return
  }

  const finalChanges = getRadiusChanges(d.corner, d.original, finalRadius)
  editor.updateNode(d.nodeId, originalRadiusChanges(d))
  editor.updateNodeWithUndo(d.nodeId, finalChanges, 'Adjust corner radius')
  editor.requestRepaint()
}

export function cancelRadiusDrag(d: DragRadius, editor: Editor): void {
  if (!editor.graph.getNode(d.nodeId)) return
  editor.updateNode(d.nodeId, originalRadiusChanges(d))
  editor.requestRepaint()
}
