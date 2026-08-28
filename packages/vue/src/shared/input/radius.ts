import { HANDLE_HIT_RADIUS } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Vector } from '@open-pencil/scene-graph/primitives'

import type { CornerPosition, DragRadius } from '#vue/shared/input/types'

export const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE',
  'BOOLEAN_OPERATION'
])

export const RADIUS_CONTROL_SCREEN_INSET = 12

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
  switch (corner) {
    case 'nw':
      return { x: inset, y: inset }
    case 'ne':
      return { x: width - inset, y: inset }
    case 'se':
      return { x: width - inset, y: height - inset }
    case 'sw':
      return { x: inset, y: height - inset }
  }
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

export function hitTestRadiusControlByMatrix(
  cx: number,
  cy: number,
  node: SceneNode,
  graph: SceneGraph,
  zoom = 1
): CornerPosition | null {
  const thresholdSq = (HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)) ** 2
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

export function getRadiusChanges(
  corner: CornerPosition,
  original: DragRadius['original'],
  nextRadius: number
): Partial<SceneNode> {
  if (original.independentCorners) {
    return {
      [RADIUS_FIELD_BY_CORNER[corner]]: nextRadius,
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

export function tryStartRadius(cx: number, cy: number, editor: Editor): DragRadius | null {
  if (editor.state.selectedIds.size !== 1) return null
  const id = [...editor.state.selectedIds][0]
  const node = editor.graph.getNode(id)
  if (!node || node.locked || !CORNER_RADIUS_TYPES.has(node.type)) return null

  const zoom = editor.renderer?.zoom ?? 1
  const corner = hitTestRadiusControlByMatrix(cx, cy, node, editor.graph, zoom)
  if (!corner) return null

  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  return {
    type: 'radius',
    nodeId: node.id,
    corner,
    startLocalX: local.x,
    startLocalY: local.y,
    original: {
      cornerRadius: node.cornerRadius ?? 0,
      topLeftRadius: node.topLeftRadius ?? node.cornerRadius ?? 0,
      topRightRadius: node.topRightRadius ?? node.cornerRadius ?? 0,
      bottomRightRadius: node.bottomRightRadius ?? node.cornerRadius ?? 0,
      bottomLeftRadius: node.bottomLeftRadius ?? node.cornerRadius ?? 0,
      independentCorners: Boolean(node.independentCorners)
    }
  }
}

export function applyRadiusDrag(d: DragRadius, cx: number, cy: number, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  const next = Math.round(
    calculateRadiusFromLocalPointer(
      d.corner,
      d.startLocalX,
      d.startLocalY,
      local.x,
      local.y,
      radiusForCorner(d.corner, d.original)
    )
  )
  editor.updateNode(d.nodeId, getRadiusChanges(d.corner, d.original, next))
  editor.requestRender()
}

export function commitRadiusDrag(d: DragRadius, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const finalRadius = radiusForCorner(d.corner, {
    cornerRadius: node.cornerRadius ?? 0,
    topLeftRadius: node.topLeftRadius ?? node.cornerRadius ?? 0,
    topRightRadius: node.topRightRadius ?? node.cornerRadius ?? 0,
    bottomRightRadius: node.bottomRightRadius ?? node.cornerRadius ?? 0,
    bottomLeftRadius: node.bottomLeftRadius ?? node.cornerRadius ?? 0,
    independentCorners: Boolean(node.independentCorners)
  })
  editor.updateNode(d.nodeId, d.original as Partial<SceneNode>)
  editor.updateNodeWithUndo(
    d.nodeId,
    getRadiusChanges(d.corner, d.original, finalRadius),
    'Change corner radius'
  )
}

export function cancelRadiusDrag(d: DragRadius, editor: Editor): void {
  editor.updateNode(d.nodeId, d.original as Partial<SceneNode>)
  editor.requestRender()
}
