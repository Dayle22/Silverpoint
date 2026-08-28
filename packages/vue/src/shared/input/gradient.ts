import { linearGradientEndpoints } from '@open-pencil/core/canvas/fills'
import {
  endpointsToGradientTransform,
  getGradientLinePoints,
  resolveGradientEdit
} from '@open-pencil/core/canvas/overlays'
import { BLACK, WHITE } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { Fill, GradientStop, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { copyFill, copyFills, copyStroke, copyStrokes } from '@open-pencil/scene-graph/copy'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'
import type { Color } from '@open-pencil/scene-graph/primitives'
import { toRaw } from 'vue'

import { HANDLE_HIT_RADIUS } from '#vue/shared/input/geometry'
import type { DragGradient, GradientHandleTarget } from '#vue/shared/input/types'

function copyFillOrStroke(paint: Fill | Stroke): Fill | Stroke {
  const raw = toRaw(paint)
  if ('type' in raw && (raw as Fill).type !== undefined) {
    return copyFill(raw as Fill)
  }
  return copyStroke(raw as Stroke)
}

function copyPaintList(property: 'fills' | 'strokes', paints: (Fill | Stroke)[]): Fill[] | Stroke[] {
  return property === 'strokes'
    ? copyStrokes(paints as Stroke[])
    : copyFills(paints as Fill[])
}

export function insertGradientStop(
  stops: GradientStop[],
  position: number
): { stops: GradientStop[]; index: number } {
  const clampedPosition = Math.max(0, Math.min(1, position))
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  const afterIndex = sorted.findIndex((stop) => stop.position >= clampedPosition)
  const right = sorted[afterIndex === -1 ? sorted.length - 1 : afterIndex]
  const left = sorted[afterIndex <= 0 ? 0 : afterIndex - 1]
  const span = right.position - left.position
  const ratio = span > 0 ? (clampedPosition - left.position) / span : 0
  const color: Color = {
    r: left.color.r + (right.color.r - left.color.r) * ratio,
    g: left.color.g + (right.color.g - left.color.g) * ratio,
    b: left.color.b + (right.color.b - left.color.b) * ratio,
    a: left.color.a + (right.color.a - left.color.a) * ratio
  }
  const nextStop = { position: clampedPosition, color }
  const nextStops = [...sorted, nextStop].sort((a, b) => a.position - b.position)

  return { stops: nextStops, index: nextStops.indexOf(nextStop) }
}

export function updateGradientStopColor(
  stops: GradientStop[],
  index: number,
  color: Color
): GradientStop[] {
  return stops.map((stop, stopIndex) =>
    stopIndex === index ? { ...stop, color: { ...color } } : stop
  )
}

export function hitTestGradientHandle(
  cx: number,
  cy: number,
  node: SceneNode,
  fillOrStroke: Fill | Stroke,
  graph: SceneGraph,
  zoom = 1
): GradientHandleTarget | null {
  const pts = getGradientLinePoints(node, fillOrStroke, graph)
  const hitRadius = (HANDLE_HIT_RADIUS * 1.25) / zoom

  // 1. Check start handle
  const startDx = cx - pts.start.world.x
  const startDy = cy - pts.start.world.y
  if (startDx * startDx + startDy * startDy <= hitRadius * hitRadius) {
    return 'start'
  }

  // 2. Check end handle
  const endDx = cx - pts.end.world.x
  const endDy = cy - pts.end.world.y
  if (endDx * endDx + endDy * endDy <= hitRadius * hitRadius) {
    return 'end'
  }

  // 3. Check intermediate and stop handles
  for (const stop of pts.stops) {
    const dx = cx - stop.world.x
    const dy = cy - stop.world.y
    if (dx * dx + dy * dy <= hitRadius * hitRadius) {
      return { stopIndex: stop.index }
    }
  }

  // 4. Check gradient line segment
  const ax = pts.start.world.x
  const ay = pts.start.world.y
  const bx = pts.end.world.x
  const by = pts.end.world.y
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy

  if (lenSq > 1e-6) {
    const t = ((cx - ax) * dx + (cy - ay) * dy) / lenSq
    if (t >= 0 && t <= 1) {
      const projX = ax + t * dx
      const projY = ay + t * dy
      const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY)
      if (distSq <= hitRadius * hitRadius) {
        return { line: t }
      }
    }
  }

  return null
}

export function hitTestGradientStop(
  cx: number,
  cy: number,
  node: SceneNode,
  fillOrStroke: Fill | Stroke,
  graph: SceneGraph,
  zoom = 1
): number | null {
  const hitRadius = (HANDLE_HIT_RADIUS * 1.25) / zoom
  const pts = getGradientLinePoints(node, fillOrStroke, graph)

  for (const stop of pts.stops) {
    const dx = cx - stop.world.x
    const dy = cy - stop.world.y
    if (dx * dx + dy * dy <= hitRadius * hitRadius) return stop.index
  }

  return null
}

function resolveTargetStopIndex(hit: GradientHandleTarget, origStops: GradientStop[]): number {
  if (typeof hit === 'object' && 'stopIndex' in hit) {
    return hit.stopIndex
  }
  if (hit === 'start') {
    return origStops.findIndex((stop) => stop.position === 0)
  }
  if (hit === 'end') {
    return origStops.findIndex((stop) => stop.position === 1)
  }
  return -1
}

function resolveActiveStopIndex(
  stopIndex: number,
  dragTarget: GradientHandleTarget
): number | null {
  if (stopIndex >= 0) return stopIndex
  if (typeof dragTarget === 'object' && 'stopIndex' in dragTarget) {
    return dragTarget.stopIndex
  }
  return null
}

function isCurrentActiveStopSelected(
  editor: Editor,
  nodeId: string,
  property: 'fills' | 'strokes',
  fillIndex: number,
  stopIndex: number,
  clickCount: number
): boolean {
  if (stopIndex < 0 || clickCount >= 2) return false
  const edit = editor.state.gradientEdit
  if (!edit) return false
  return (
    edit.nodeId === nodeId &&
    edit.property === property &&
    edit.fillIndex === fillIndex &&
    edit.activeStopIndex === stopIndex
  )
}

export function tryStartGradientHandle(
  cx: number,
  cy: number,
  editor: Editor,
  clickCount = 1
): DragGradient | null {
  if (editor.state.selectedIds.size === 0 && !editor.state.gradientEdit) return null

  const target = resolveGradientEdit(
    editor.graph,
    editor.state.selectedIds,
    editor.state.gradientEdit
  )
  if (!target) return null

  const zoom = editor.renderer?.zoom ?? 1
  const hit = hitTestGradientHandle(cx, cy, target.node, target.paint, editor.graph, zoom)
  if (!hit) return null

  const { node, property, index, paint } = target
  const origTransform = paint.gradientTransform
    ? { ...paint.gradientTransform }
    : { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 }

  const origStops = (
    paint.gradientStops ?? [
      { position: 0, color: { ...BLACK } },
      { position: 1, color: { ...WHITE } }
    ]
  ).map((s) => ({ ...s, color: { ...s.color } }))

  const world = getWorldMatrix(node, editor.graph)
  const inv = Matrix.invert(world)
  const localPt = inv ? Matrix.mapPoint(inv, { x: cx, y: cy }) : { x: cx, y: cy }
  const stopIndex = resolveTargetStopIndex(hit, origStops)

  if (isCurrentActiveStopSelected(editor, node.id, property, index, stopIndex, clickCount)) {
    return {
      type: 'gradient',
      nodeId: node.id,
      property,
      paintIndex: index,
      target: hit,
      startX: cx,
      startY: cy,
      startLocalX: localPt.x,
      startLocalY: localPt.y,
      origTransform,
      origStops,
      origPaint: copyFillOrStroke(paint),
      releaseRequested: true
    }
  }

  let dragTarget = hit
  let dragOrigStops = origStops
  if (typeof hit === 'object' && 'line' in hit) {
    const inserted = insertGradientStop(origStops, hit.line)
    const nextPaint = { ...copyFillOrStroke(paint), gradientStops: inserted.stops }
    const currentList = property === 'strokes' ? node.strokes : node.fills
    const nextPaints = currentList.map((current, i) =>
      i === index ? nextPaint : copyFillOrStroke(current)
    )
    editor.updateNode(node.id, { [property]: copyPaintList(property, nextPaints) })
    dragTarget = { stopIndex: inserted.index }
    dragOrigStops = inserted.stops
  }

  const activeStopIndex = resolveActiveStopIndex(stopIndex, dragTarget)
  editor.setGradientEdit({
    nodeId: node.id,
    fillIndex: index,
    property,
    activeStopIndex
  })

  return {
    type: 'gradient',
    nodeId: node.id,
    property,
    paintIndex: index,
    target: dragTarget,
    startX: cx,
    startY: cy,
    startLocalX: localPt.x,
    startLocalY: localPt.y,
    origTransform,
    origStops: dragOrigStops,
    origPaint: copyFillOrStroke(paint)
  }
}

export function applyGradientDrag(
  dragState: DragGradient,
  currentPos: { cx: number; cy: number },
  context: { editor: Editor }
): void {
  const drag = toRaw(dragState)
  if (drag.releaseRequested) return
  const node = context.editor.graph.getNode(drag.nodeId)
  if (!node || node.width <= 0 || node.height <= 0) return

  const world = getWorldMatrix(node, context.editor.graph)
  const inv = Matrix.invert(world)
  const localPt = inv
    ? Matrix.mapPoint(inv, { x: currentPos.cx, y: currentPos.cy })
    : { x: currentPos.cx, y: currentPos.cy }

  const origEndpoints = linearGradientEndpoints(node.width, node.height, drag.origTransform)
  let start = { ...origEndpoints.start }
  let end = { ...origEndpoints.end }

  const currentPaints = drag.property === 'strokes' ? node.strokes : node.fills
  const currentPaint = currentPaints[drag.paintIndex]
  if (!currentPaint) return

  const updatedPaint = copyFillOrStroke(currentPaint)

  if (drag.target === 'start') {
    start = { x: localPt.x, y: localPt.y }
    const newTransform = endpointsToGradientTransform(
      start,
      end,
      node.width,
      node.height,
      drag.origTransform
    )
    updatedPaint.gradientTransform = newTransform
  } else if (drag.target === 'end') {
    end = { x: localPt.x, y: localPt.y }
    const newTransform = endpointsToGradientTransform(
      start,
      end,
      node.width,
      node.height,
      drag.origTransform
    )
    updatedPaint.gradientTransform = newTransform
  } else if (typeof drag.target === 'object' && 'stopIndex' in drag.target) {
    const stopIndex = drag.target.stopIndex
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lenSq = dx * dx + dy * dy
    let t = 0
    if (lenSq > 1e-6) {
      t = ((localPt.x - start.x) * dx + (localPt.y - start.y) * dy) / lenSq
    }
    t = Math.max(0, Math.min(1, t))

    const stops = drag.origStops.map((s, i) =>
      i === stopIndex ? { position: t, color: { ...s.color } } : { position: s.position, color: { ...s.color } }
    )
    updatedPaint.gradientStops = stops
  } else if (typeof drag.target === 'object' && 'line' in drag.target) {
    const dx = localPt.x - drag.startLocalX
    const dy = localPt.y - drag.startLocalY
    start = { x: start.x + dx, y: start.y + dy }
    end = { x: end.x + dx, y: end.y + dy }
    const newTransform = endpointsToGradientTransform(
      start,
      end,
      node.width,
      node.height,
      drag.origTransform
    )
    updatedPaint.gradientTransform = newTransform
  }

  const nextPaints = currentPaints.map((p, i) =>
    i === drag.paintIndex ? updatedPaint : copyFillOrStroke(p)
  )
  context.editor.updateNode(node.id, { [drag.property]: copyPaintList(drag.property, nextPaints) })
}

export function commitGradientDrag(dragState: DragGradient, editor: Editor): void {
  const drag = toRaw(dragState)
  if (drag.releaseRequested) return
  const node = editor.graph.getNode(drag.nodeId)
  if (!node) return

  const currentPaints = drag.property === 'strokes' ? node.strokes : node.fills
  const nextPaint = currentPaints[drag.paintIndex]
  if (!nextPaint || JSON.stringify(nextPaint) === JSON.stringify(drag.origPaint)) return

  const origPaints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? copyFillOrStroke(drag.origPaint) : copyFillOrStroke(p)
  )

  const finalPaints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? copyFillOrStroke(nextPaint) : copyFillOrStroke(p)
  )

  editor.undo.push({
    label: 'Edit gradient',
    forward: () => {
      editor.updateNode(node.id, { [drag.property]: copyPaintList(drag.property, finalPaints) })
    },
    inverse: () => {
      editor.updateNode(node.id, { [drag.property]: copyPaintList(drag.property, origPaints) })
    }
  })
}

export function cancelGradientDrag(dragState: DragGradient, editor: Editor): void {
  const drag = toRaw(dragState)
  const node = editor.graph.getNode(drag.nodeId)
  if (!node) return
  const paints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? copyFillOrStroke(drag.origPaint) : copyFillOrStroke(p)
  )
  editor.updateNode(node.id, { [drag.property]: copyPaintList(drag.property, paints) })
}
