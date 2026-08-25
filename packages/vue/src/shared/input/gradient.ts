import type { Editor } from '@open-pencil/core/editor'
import {
  defaultGradientTransform,
  GRADIENT_HANDLE_HIT_RADIUS,
  getGradientGeometry,
  isGradientFill,
  resolveGradientEdit,
  type GradientGeometry
} from '@open-pencil/core/canvas/overlays/gradient'
import type { Fill, GradientStop, GradientTransform, SceneGraph, SceneNode } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'

import { worldToNodeLocalPoint } from '#vue/shared/input/radius'
import type { DragGradientHandle } from '#vue/shared/input/types'

const SNAP_STEP_DEGREES = 45

export interface ActiveGradientEdit {
  node: SceneNode
  fill: Fill
  fillIndex: number
  property: 'fills'
}

/**
 * The gradient fill being edited on canvas, or `null` when no editable gradient is active.
 */
export function getGradientEdit(editor: Editor): ActiveGradientEdit | null {
  const edit = resolveGradientEdit(
    editor.graph,
    editor.state.selectedIds,
    editor.state.gradientEdit
  )
  if (!edit || edit.property === 'strokes') return null

  const node = editor.graph.getNode(edit.nodeId)
  if (!node) return null
  const fill = node.fills.at(edit.fillIndex)
  if (!fill || !isGradientFill(fill)) return null

  return { node, fill, fillIndex: edit.fillIndex, property: 'fills' }
}

export interface GradientHandleWorldPositions {
  worldStart: Vector
  worldEnd: Vector
  /** Second-axis handle; only drawn and hit-tested for non-linear gradients. */
  worldWidth: Vector
  worldStops: Array<{ index: number; position: number; color: Color; worldPoint: Vector; localPoint: Vector }>
  worldBend?: Vector
  geo: GradientGeometry
}

export function getGradientHandlePositions(
  node: SceneNode,
  fill: Fill,
  graph: SceneGraph
): GradientHandleWorldPositions {
  const geo = getGradientGeometry(node, fill)
  const matrix = getWorldMatrix(node, graph)
  const worldStart = Matrix.mapPoint(matrix, geo.start)
  const worldEnd = Matrix.mapPoint(matrix, geo.end)
  const worldWidth = Matrix.mapPoint(matrix, geo.widthPoint)
  const worldBend = geo.bendPoint ? Matrix.mapPoint(matrix, geo.bendPoint) : undefined
  const worldStops = geo.stops.map((s) => ({
    ...s,
    worldPoint: Matrix.mapPoint(matrix, s.localPoint)
  }))
  return { worldStart, worldEnd, worldWidth, worldStops, worldBend, geo }
}

export type GradientHandleTarget = 'start' | 'end' | 'width' | 'bend' | { stopIndex: number }

export function hitTestGradientHandle(
  cx: number,
  cy: number,
  node: SceneNode,
  fill: Fill,
  graph: SceneGraph,
  zoom = 1
): GradientHandleTarget | null {
  const hitRadius = GRADIENT_HANDLE_HIT_RADIUS / Math.max(zoom, Number.EPSILON)
  const hitRadiusSq = hitRadius * hitRadius
  const { worldStart, worldEnd, worldWidth, worldStops, worldBend, geo } = getGradientHandlePositions(
    node,
    fill,
    graph
  )

  // Check intermediate stops first
  for (let i = 1; i < worldStops.length - 1; i++) {
    const pt = worldStops[i].worldPoint
    const dx = cx - pt.x
    const dy = cy - pt.y
    if (dx * dx + dy * dy <= hitRadiusSq) {
      return { stopIndex: i }
    }
  }

  // Check start
  const dsx = cx - worldStart.x
  const dsy = cy - worldStart.y
  if (dsx * dsx + dsy * dsy <= hitRadiusSq) {
    return 'start'
  }

  // Check end
  const dex = cx - worldEnd.x
  const dey = cy - worldEnd.y
  if (dex * dex + dey * dey <= hitRadiusSq) {
    return 'end'
  }

  // Check bend handle if present (for curved gradients)
  if (worldBend) {
    const dbx = cx - worldBend.x
    const dby = cy - worldBend.y
    if (dbx * dbx + dby * dby <= hitRadiusSq) {
      return 'bend'
    }
  }

  // Check the second-axis handle, which only exists for non-linear gradients
  if (geo.outline !== 'none') {
    const dwx = cx - worldWidth.x
    const dwy = cy - worldWidth.y
    if (dwx * dwx + dwy * dwy <= hitRadiusSq) {
      return 'width'
    }
  }

  return null
}

/** Which colour stop a hit target corresponds to, or null when it is not a stop. */
function stopIndexForTarget(hit: GradientHandleTarget, stopCount: number): number | null {
  if (hit === 'start') return 0
  if (hit === 'end') return stopCount - 1
  if (hit === 'width' || hit === 'bend') return null
  return hit.stopIndex
}

export function tryStartGradientHandle(
  cx: number,
  cy: number,
  editor: Editor
): DragGradientHandle | null {
  const edit = getGradientEdit(editor)
  if (!edit) return null

  const hit = hitTestGradientHandle(
    cx,
    cy,
    edit.node,
    edit.fill,
    editor.graph,
    editor.renderer?.zoom
  )
  if (!hit) return null

  const originalTransform: GradientTransform = structuredClone(
    edit.fill.gradientTransform ?? defaultGradientTransform(edit.fill.type)
  )

  const originalStops: GradientStop[] = structuredClone(
    edit.fill.gradientStops ?? [
      { color: edit.fill.color, position: 0 },
      { color: { r: 1, g: 1, b: 1, a: 1 }, position: 1 }
    ]
  )

  const originalSpine = structuredClone(edit.fill.gradientSpine ?? [])

  // Grabbing a stop on canvas highlights it, the same way clicking it in the
  // picker does. The second-axis handle is not a stop, so it changes nothing.
  const activeStopIndex = stopIndexForTarget(hit, originalStops.length)
  if (activeStopIndex !== null) {
    editor.setGradientEdit({
      nodeId: edit.node.id,
      fillIndex: edit.fillIndex,
      property: edit.property,
      activeStopIndex
    })
  }

  return {
    type: 'gradient-handle',
    nodeId: edit.node.id,
    fillIndex: edit.fillIndex,
    property: edit.property,
    target: typeof hit === 'object' ? hit.stopIndex : hit,
    originalTransform,
    originalStops,
    originalSpine
  }
}

function snapToAngle(point: Vector, anchor: Vector): Vector {
  const dx = point.x - anchor.x
  const dy = point.y - anchor.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return point
  const step = (SNAP_STEP_DEGREES * Math.PI) / 180
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  return { x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance }
}

/** Anchor point the dragged endpoint pivots around, in node-local pixels. */
function endpointAnchor(
  d: DragGradientHandle,
  fill: Fill,
  w: number,
  h: number
): Vector {
  const t = d.originalTransform
  const origin = { x: t.m02 * w, y: t.m12 * h }
  const axisTip = { x: (t.m00 + t.m02) * w, y: (t.m10 + t.m12) * h }
  const startIsOrigin = fill.type !== 'GRADIENT_LINEAR' && fill.type !== 'GRADIENT_CURVED'
  const draggingStart = d.target === 'start'
  return draggingStart === startIsOrigin ? axisTip : origin
}

/** Linear gradients keep a rotation-only matrix, rebuilt from both endpoints. */
function linearTransform(startX: number, startY: number, endX: number, endY: number): GradientTransform {
  return {
    m00: startX - endX,
    m01: -(startY - endY),
    m02: endX,
    m10: startY - endY,
    m11: startX - endX,
    m12: endY
  }
}

/**
 * Rebuilds the first gradient axis from the dragged tip, carrying the second
 * axis along with it: same rotation, same scale, so the ellipse or diamond
 * keeps its aspect instead of snapping back to a circle.
 */
function radialAxisTransform(t: GradientTransform, m00: number, m10: number): GradientTransform {
  const oldLen = Math.hypot(t.m00, t.m10)
  const newLen = Math.hypot(m00, m10)
  if (oldLen === 0 || newLen === 0) {
    return { m00, m01: -m10, m02: t.m02, m10, m11: m00, m12: t.m12 }
  }
  const delta = Math.atan2(m10, m00) - Math.atan2(t.m10, t.m00)
  const scale = newLen / oldLen
  const cos = Math.cos(delta) * scale
  const sin = Math.sin(delta) * scale
  return {
    m00,
    m01: t.m01 * cos - t.m11 * sin,
    m02: t.m02,
    m10,
    m11: t.m01 * sin + t.m11 * cos,
    m12: t.m12
  }
}

function endpointTransform(
  d: DragGradientHandle,
  fill: Fill,
  pt: Vector,
  w: number,
  h: number
): GradientTransform {
  const t = d.originalTransform
  const u = pt.x / w
  const v = pt.y / h

  if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_CURVED') {
    return d.target === 'start'
      ? linearTransform(u, v, t.m02, t.m12)
      : linearTransform(t.m00 + t.m02, t.m10 + t.m12, u, v)
  }

  // Radial / Angular / Diamond: 'start' is the centre, 'end' the first axis tip
  if (d.target === 'start') return { ...t, m02: u, m12: v }
  return radialAxisTransform(t, u - t.m02, v - t.m12)
}

export function applyGradientDrag(
  d: DragGradientHandle,
  cx: number,
  cy: number,
  editor: Editor,
  snapAngle = false
): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node || node.width <= 0 || node.height <= 0) return
  const local = worldToNodeLocalPoint(node, editor.graph, { x: cx, y: cy })
  if (!local) return

  const list = node.fills
  const fill = list.at(d.fillIndex)
  if (!fill || !isGradientFill(fill)) return

  const w = node.width
  const h = node.height
  const origT = d.originalTransform

  function commit(base: Fill, gradientTransform: GradientTransform) {
    const nextList = [...list]
    nextList[d.fillIndex] = { ...base, gradientTransform }
    editor.updateNode(d.nodeId, { fills: nextList })
    editor.requestRender()
  }

  if (d.target === 'width') {
    // Second gradient axis: moves on its own so the ellipse (or diamond) can be
    // squashed without disturbing the first axis or the centre.
    commit(fill, { ...origT, m01: local.x / w - origT.m02, m11: local.y / h - origT.m12 })
  } else if (d.target === 'bend') {
    const geo = getGradientGeometry(node, fill)
    const dx = geo.end.x - geo.start.x
    const dy = geo.end.y - geo.start.y
    const lenSq = dx * dx + dy * dy
    const midX = geo.start.x + 0.5 * dx
    const midY = geo.start.y + 0.5 * dy
    const perpX = -dy
    const perpY = dx
    const offset = lenSq > 0 ? ((local.x - midX) * perpX + (local.y - midY) * perpY) / lenSq : 0

    const nextList = [...list]
    nextList[d.fillIndex] = {
      ...fill,
      gradientSpine: [{ t: 0.5, offset }]
    }
    editor.updateNode(d.nodeId, { fills: nextList })
    editor.requestRender()
  } else if (d.target === 'start' || d.target === 'end') {
    const anchor = endpointAnchor(d, fill, w, h)
    const pt = snapAngle ? snapToAngle(local, anchor) : local
    commit(fill, endpointTransform(d, fill, pt, w, h))
  } else if (typeof d.target === 'number') {
    const geo = getGradientGeometry(node, fill)
    const vx = geo.end.x - geo.start.x
    const vy = geo.end.y - geo.start.y
    const lenSq = vx * vx + vy * vy
    const p = lenSq > 0 ? ((local.x - geo.start.x) * vx + (local.y - geo.start.y) * vy) / lenSq : 0
    const clampedP = Math.max(0, Math.min(1, p))

    const nextStops = [...(fill.gradientStops ?? d.originalStops)]
    nextStops[d.target] = { ...nextStops[d.target], position: clampedP }
    const nextList = [...list]
    nextList[d.fillIndex] = { ...fill, gradientStops: nextStops }
    editor.updateNode(d.nodeId, { fills: nextList })
    editor.requestRender()
  }
}

export function commitGradientDrag(d: DragGradientHandle, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const list = node.fills
  const previousList = [...list]
  previousList[d.fillIndex] = {
    ...previousList[d.fillIndex],
    gradientTransform: d.originalTransform,
    gradientStops: d.originalStops,
    gradientSpine: d.originalSpine
  }
  editor.commitNodeUpdate(d.nodeId, { fills: previousList }, 'Adjust gradient')
  editor.requestRender()
}

export function cancelGradientDrag(d: DragGradientHandle, editor: Editor): void {
  const node = editor.graph.getNode(d.nodeId)
  if (!node) return
  const list = node.fills
  const nextList = [...list]
  nextList[d.fillIndex] = {
    ...nextList[d.fillIndex],
    gradientTransform: d.originalTransform,
    gradientStops: d.originalStops,
    gradientSpine: d.originalSpine
  }
  editor.updateNode(d.nodeId, { fills: nextList })
  editor.requestRender()
}
