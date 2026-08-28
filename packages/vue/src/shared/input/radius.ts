/* eslint-disable max-lines -- Radius and arc interaction handles and drag lifecycle */
import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { ArcData, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { polygonVertices } from '@open-pencil/scene-graph/geometry'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type {
  CornerPosition,
  DragCornerRadius,
  DragRadius,
  EllipseArcHandle,
  RadiusHandle,
  VertexRadiusHandle
} from '#vue/shared/input/types'

export const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE',
  'BOOLEAN_OPERATION'
])

export const POINT_RADIUS_TYPES = new Set(['STAR', 'POLYGON'])

export const ELLIPSE_ARC_TYPES = new Set(['ELLIPSE'])

export const RADIUS_CONTROL_SCREEN_INSET = 12
export const POINT_COUNT_STEP_SCREEN_PX = 12
export const MAX_ELLIPSE_INNER_RADIUS = 0.99
export const FULL_ELLIPSE_SWEEP_EPSILON = 0.001
export const TWO_PI = Math.PI * 2

export const CORNER_DIRECTIONS: Record<CornerPosition, Vector> = {
  nw: { x: 1, y: 1 },
  ne: { x: -1, y: 1 },
  se: { x: -1, y: -1 },
  sw: { x: 1, y: -1 }
}

export const RADIUS_FIELD_BY_CORNER: Record<
  CornerPosition,
  'topLeftRadius' | 'topRightRadius' | 'bottomRightRadius' | 'bottomLeftRadius'
> = {
  nw: 'topLeftRadius',
  ne: 'topRightRadius',
  se: 'bottomRightRadius',
  sw: 'bottomLeftRadius'
}

export function cornerPoint(
  corner: CornerPosition,
  width: number,
  height: number,
  inset: number
): Vector {
  if (corner === 'nw') return { x: inset, y: inset }
  if (corner === 'ne') return { x: width - inset, y: inset }
  if (corner === 'se') return { x: width - inset, y: height - inset }
  return { x: inset, y: height - inset }
}

export function radiusForCorner(
  corner: CornerPosition,
  nodeOrOriginal: {
    cornerRadius?: number
    topLeftRadius?: number
    topRightRadius?: number
    bottomRightRadius?: number
    bottomLeftRadius?: number
    independentCorners?: boolean
  }
): number {
  if (nodeOrOriginal.independentCorners) {
    const field = RADIUS_FIELD_BY_CORNER[corner]
    return nodeOrOriginal[field] ?? nodeOrOriginal.cornerRadius ?? 0
  }
  return nodeOrOriginal.cornerRadius ?? 0
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

export function getVertexRadiusControlLocalPoint(
  node: {
    width: number
    height: number
    pointCount?: number
    type: string
    starInnerRadius?: number
    cornerRadius?: number
  },
  handleIndex: number,
  zoom = 1
): Vector {
  const vertices = polygonVertices({
    width: node.width,
    height: node.height,
    pointCount: node.pointCount ?? 5,
    type: node.type,
    starInnerRadius: node.starInnerRadius ?? 0.381966
  })
  if (vertices.length === 0) return { x: 0, y: 0 }
  const k = node.type === 'STAR' ? handleIndex * 2 : handleIndex
  const Vk = vertices[((k % vertices.length) + vertices.length) % vertices.length]
  const cx = node.width / 2
  const cy = node.height / 2
  const dx = cx - Vk.x
  const dy = cy - Vk.y
  const dist = Math.hypot(dx, dy)
  const dir = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 }

  const minInset = RADIUS_CONTROL_SCREEN_INSET / Math.max(zoom, Number.EPSILON)
  const safeRadius = Number.isFinite(node.cornerRadius) ? Math.max(0, node.cornerRadius ?? 0) : 0
  const inset = Math.min(Math.max(minInset, safeRadius), dist)

  return {
    x: Vk.x + dir.x * inset,
    y: Vk.y + dir.y * inset
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

export function getPointCountControlLocalPoint(node: Pick<SceneNode, 'width' | 'height'>): Vector {
  return { x: node.width, y: node.height * 0.25 }
}

export function getPointCountControlPosition(node: SceneNode, graph: SceneGraph): Vector {
  const local = getPointCountControlLocalPoint(node)
  return Matrix.mapPoint(getWorldMatrix(node, graph), local)
}

export function calculatePointCountFromCanvasDelta(
  startCanvasX: number,
  currentCanvasX: number,
  zoom: number,
  originalPointCount: number
): number {
  const safeZoom = Math.max(Number.isFinite(zoom) ? zoom : 1, Number.EPSILON)
  const safeOriginal = Number.isFinite(originalPointCount) ? Math.trunc(originalPointCount) : 3
  const deltaSteps = Math.round(((currentCanvasX - startCanvasX) * safeZoom) / POINT_COUNT_STEP_SCREEN_PX)
  return Math.max(3, Math.min(Number.MAX_SAFE_INTEGER, safeOriginal + deltaSteps))
}

export function isPartialEllipseSweep(arcData: ArcData | null | undefined): boolean {
  if (!arcData) return false
  const sweep = Math.abs(arcData.endingAngle - arcData.startingAngle)
  return sweep > 0.0001 && sweep < TWO_PI - FULL_ELLIPSE_SWEEP_EPSILON
}

export function getEllipseArcControlLocalPoint(
  node: Pick<SceneNode, 'width' | 'height' | 'arcData'>,
  handle: EllipseArcHandle
): Vector | null {
  const rx = node.width / 2
  const ry = node.height / 2
  if (rx <= 0 || ry <= 0) return null
  const cx = rx
  const cy = ry

  if (handle === 'arc-end') {
    const angle = node.arcData?.endingAngle ?? 0
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle)
    }
  }

  if (handle === 'arc-start') {
    if (!isPartialEllipseSweep(node.arcData)) return null
    const angle = node.arcData?.startingAngle ?? 0
    return {
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle)
    }
  }

  if (handle === 'arc-inner') {
    const innerRadius = node.arcData?.innerRadius ?? 0
    if (innerRadius <= 0) {
      return { x: cx, y: cy }
    }
    return {
      x: cx,
      y: cy - ry * Math.min(MAX_ELLIPSE_INNER_RADIUS, Math.max(0, innerRadius))
    }
  }

  return null
}

export function getEllipseArcControlPosition(
  node: SceneNode,
  graph: SceneGraph,
  handle: EllipseArcHandle
): Vector | null {
  const local = getEllipseArcControlLocalPoint(node, handle)
  if (!local) return null
  return Matrix.mapPoint(getWorldMatrix(node, graph), local)
}

export function calculateEllipseArcPointerAngle(
  node: Pick<SceneNode, 'width' | 'height'>,
  local: Vector
): number | null {
  const rx = node.width / 2
  const ry = node.height / 2
  if (rx <= 0 || ry <= 0) return null
  const angle = Math.atan2((local.y - ry) / ry, (local.x - rx) / rx)
  return angle < 0 ? angle + TWO_PI : angle
}

export function calculateEllipseInnerRadius(
  node: Pick<SceneNode, 'width' | 'height'>,
  local: Vector
): number | null {
  const rx = node.width / 2
  const ry = node.height / 2
  if (rx <= 0 || ry <= 0) return null
  const dx = (local.x - rx) / rx
  const dy = (local.y - ry) / ry
  const rawRatio = Math.hypot(dx, dy)
  return Math.min(MAX_ELLIPSE_INNER_RADIUS, Math.max(0, rawRatio))
}

export function hitTestRadiusControlByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom = 1
): RadiusHandle | null {
  const thresholdSq = (HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)) ** 2

  if (CORNER_RADIUS_TYPES.has(node.type)) {
    const corners: CornerPosition[] = ['nw', 'ne', 'se', 'sw']
    for (const corner of corners) {
      const pos = getRadiusControlPosition(node, graph, corner, zoom)
      const dx = cx - pos.x
      const dy = cy - pos.y
      if (dx * dx + dy * dy <= thresholdSq) {
        return corner
      }
    }
    return null
  }

  if (POINT_RADIUS_TYPES.has(node.type)) {
    const ptCountPos = getPointCountControlPosition(node, graph)
    const pcDx = cx - ptCountPos.x
    const pcDy = cy - ptCountPos.y
    if (pcDx * pcDx + pcDy * pcDy <= thresholdSq) {
      return 'point-count'
    }

    const count = Math.max(3, node.pointCount ?? 5)
    for (let i = 0; i < count; i++) {
      const pos = getVertexRadiusControlPosition(node, graph, i, zoom)
      const dx = cx - pos.x
      const dy = cy - pos.y
      if (dx * dx + dy * dy <= thresholdSq) {
        return `vertex:${i}` as VertexRadiusHandle
      }
    }
    return null
  }

  if (ELLIPSE_ARC_TYPES.has(node.type)) {
    const handles: EllipseArcHandle[] = ['arc-end', 'arc-start', 'arc-inner']
    for (const handle of handles) {
      const pos = getEllipseArcControlPosition(node, graph, handle)
      if (!pos) continue
      const dx = cx - pos.x
      const dy = cy - pos.y
      if (dx * dx + dy * dy <= thresholdSq) {
        return handle
      }
    }
    return null
  }

  return null
}

export function calculateRadiusFromLocalPointer(
  corner: CornerPosition,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  originalRadius: number
): number {
  const direction = CORNER_DIRECTIONS[corner]
  const length = Math.SQRT2
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  const projectedDelta = (deltaX * direction.x + deltaY * direction.y) / length
  return Math.max(0, originalRadius + projectedDelta)
}

export function calculateVertexRadiusFromLocalPointer(
  direction: Vector,
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  originalRadius: number
): number {
  const deltaX = currentX - startX
  const deltaY = currentY - startY
  const projectedDelta = deltaX * direction.x + deltaY * direction.y
  return Math.max(0, originalRadius + projectedDelta)
}

export function getRadiusChanges(
  corner: CornerPosition | VertexRadiusHandle,
  original: DragCornerRadius['original'],
  nextRadius: number
): Partial<SceneNode> {
  if (original.independentCorners && typeof corner === 'string' && corner in RADIUS_FIELD_BY_CORNER) {
    return {
      [RADIUS_FIELD_BY_CORNER[corner as CornerPosition]]: nextRadius,
      independentCorners: true
    }
  }
  return {
    cornerRadius: nextRadius,
    topLeftRadius: nextRadius,
    topRightRadius: nextRadius,
    bottomRightRadius: nextRadius,
    bottomLeftRadius: nextRadius,
    independentCorners: false
  }
}

export function worldToNodeLocalPoint(
  node: SceneNode,
  graph: SceneGraph,
  worldPoint: Vector
): Vector {
  const worldMatrix = getWorldMatrix(node, graph)
  const inv = Matrix.invert(worldMatrix)
  if (!inv) return worldPoint
  return Matrix.mapPoint(inv, worldPoint)
}

function createVertexRadiusDrag(
  node: SceneNode,
  handle: VertexRadiusHandle,
  local: Vector
): DragCornerRadius {
  const vertexIndex = Number.parseInt(handle.slice(7), 10)
  const vertices = polygonVertices({
    width: node.width,
    height: node.height,
    pointCount: node.pointCount ?? 5,
    type: node.type,
    starInnerRadius: node.starInnerRadius ?? 0.381966
  })
  const k = node.type === 'STAR' ? vertexIndex * 2 : vertexIndex
  const Vk = vertices[((k % vertices.length) + vertices.length) % vertices.length]
  const centerX = node.width / 2
  const centerY = node.height / 2
  const dx = centerX - Vk.x
  const dy = centerY - Vk.y
  const dist = Math.hypot(dx, dy)
  const direction = dist > 1e-6 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 }

  return {
    type: 'radius',
    nodeId: node.id,
    corner: handle,
    startLocalX: local.x,
    startLocalY: local.y,
    direction,
    original: {
      cornerRadius: node.cornerRadius,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius,
      independentCorners: Boolean(node.independentCorners)
    }
  }
}

function resolveEllipseArcDrag(
  handle: EllipseArcHandle,
  node: SceneNode,
  local: Vector,
  originalArcData: ArcData | null
): ArcData {
  const start = originalArcData?.startingAngle ?? 0
  const end = originalArcData?.endingAngle ?? (originalArcData ? 0 : TWO_PI)
  const inner = originalArcData?.innerRadius ?? 0

  if (handle === 'arc-end') {
    return {
      startingAngle: start,
      endingAngle: calculateEllipseArcPointerAngle(node, local) ?? 0,
      innerRadius: inner
    }
  }
  if (handle === 'arc-start') {
    return {
      startingAngle: calculateEllipseArcPointerAngle(node, local) ?? 0,
      endingAngle: end,
      innerRadius: inner
    }
  }
  return {
    startingAngle: start,
    endingAngle: end,
    innerRadius: calculateEllipseInnerRadius(node, local) ?? 0
  }
}

export function tryStartRadius(cx: number, cy: number, editor: Editor): DragRadius | null {
  if (editor.state.selectedIds.size !== 1) return null
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (
    !node ||
    node.locked ||
    (!CORNER_RADIUS_TYPES.has(node.type) &&
      !POINT_RADIUS_TYPES.has(node.type) &&
      !ELLIPSE_ARC_TYPES.has(node.type))
  ) {
    return null
  }

  const zoom = editor.renderer?.zoom ?? 1
  const handle = hitTestRadiusControlByMatrix(cx, cy, node, editor.graph, zoom)
  if (!handle) return null

  if (handle === 'point-count') {
    const count = Number.isFinite(node.pointCount) ? Math.trunc(node.pointCount) : 5
    return {
      type: 'radius',
      handle: 'point-count',
      nodeId: node.id,
      startCanvasX: cx,
      originalPointCount: Math.max(3, count),
      zoom
    }
  }

  if (handle === 'arc-start' || handle === 'arc-end' || handle === 'arc-inner') {
    return {
      type: 'radius',
      handle,
      nodeId: node.id,
      originalArcData: node.arcData ? { ...node.arcData } : null
    }
  }

  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (typeof handle === 'string' && handle.startsWith('vertex:')) {
    return createVertexRadiusDrag(node, handle as VertexRadiusHandle, local)
  }

  return {
    type: 'radius',
    nodeId: node.id,
    corner: handle as CornerPosition,
    startLocalX: local.x,
    startLocalY: local.y,
    original: {
      cornerRadius: node.cornerRadius,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius,
      independentCorners: Boolean(node.independentCorners)
    }
  }
}

export function applyRadiusDrag(d: DragRadius, cx: number, cy: number, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return

  if ('handle' in d) {
    if (d.handle === 'point-count') {
      const next = calculatePointCountFromCanvasDelta(
        d.startCanvasX,
        cx,
        d.zoom,
        d.originalPointCount
      )
      editor.updateNode(d.nodeId, { pointCount: next })
      editor.requestRender()
      return
    }

    const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
    const nextArcData = resolveEllipseArcDrag(d.handle, node, local, d.originalArcData)
    editor.updateNode(d.nodeId, { arcData: nextArcData })
    editor.requestRender()
    return
  }

  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  const next = Math.round(
    d.direction
      ? calculateVertexRadiusFromLocalPointer(
          d.direction,
          d.startLocalX,
          d.startLocalY,
          local.x,
          local.y,
          d.original.cornerRadius ?? 0
        )
      : calculateRadiusFromLocalPointer(
          d.corner as CornerPosition,
          d.startLocalX,
          d.startLocalY,
          local.x,
          local.y,
          radiusForCorner(d.corner as CornerPosition, d.original)
        )
  )
  editor.updateNode(d.nodeId, getRadiusChanges(d.corner, d.original, next))
  editor.requestRender()
}

export function commitRadiusDrag(d: DragRadius, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return

  if ('handle' in d) {
    if (d.handle === 'point-count') {
      const finalCount = Math.max(3, Math.trunc(node.pointCount ?? 5))
      editor.updateNode(d.nodeId, { pointCount: d.originalPointCount })
      editor.updateNodeWithUndo(d.nodeId, { pointCount: finalCount }, 'Adjust point count')
      return
    }

    if (d.handle === 'arc-end' || d.handle === 'arc-start' || d.handle === 'arc-inner') {
      const finalArcData = node.arcData ? { ...node.arcData } : null
      editor.updateNode(d.nodeId, { arcData: d.originalArcData })
      editor.updateNodeWithUndo(d.nodeId, { arcData: finalArcData }, 'Adjust ellipse arc')
      return
    }
    return
  }

  const finalRadius = radiusForCorner(d.corner as CornerPosition, node)
  editor.updateNode(d.nodeId, d.original as Partial<SceneNode>)
  editor.updateNodeWithUndo(
    d.nodeId,
    getRadiusChanges(d.corner, d.original, finalRadius),
    'Change corner radius'
  )
}

export function cancelRadiusDrag(d: DragRadius, editor: Editor): void {
  if ('handle' in d) {
    if (d.handle === 'point-count') {
      editor.updateNode(d.nodeId, { pointCount: d.originalPointCount })
      editor.requestRender()
      return
    }
    if (d.handle === 'arc-end' || d.handle === 'arc-start' || d.handle === 'arc-inner') {
      editor.updateNode(d.nodeId, { arcData: d.originalArcData })
      editor.requestRender()
      return
    }
    return
  }

  editor.updateNode(d.nodeId, d.original as Partial<SceneNode>)
  editor.requestRender()
}
