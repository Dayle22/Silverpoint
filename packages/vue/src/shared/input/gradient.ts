import { linearGradientEndpoints } from '@open-pencil/core/canvas/fills'
import {
  endpointsToGradientTransform,
  getGradientLinePoints,
  resolveGradientEdit
} from '@open-pencil/core/canvas/overlays'
import { BLACK, WHITE } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Matrix from '@open-pencil/scene-graph/matrix'

import { HANDLE_HIT_RADIUS } from '#vue/shared/input/geometry'
import type { DragGradient, GradientHandleTarget } from '#vue/shared/input/types'

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

export function tryStartGradientHandle(
  cx: number,
  cy: number,
  editor: Editor
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

  const node = target.node
  const property = target.property
  const index = target.index
  const paint = target.paint

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

  const activeStopIndex = typeof hit === 'object' && 'stopIndex' in hit ? hit.stopIndex : null

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
    target: hit,
    startX: cx,
    startY: cy,
    startLocalX: localPt.x,
    startLocalY: localPt.y,
    origTransform,
    origStops,
    origPaint: structuredClone(paint)
  }
}

export function applyGradientDrag(
  drag: DragGradient,
  currentPos: { cx: number; cy: number },
  context: { editor: Editor }
): void {
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

  const updatedPaint = { ...currentPaint }

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

    const stops = drag.origStops.map((s, i) => (i === stopIndex ? { ...s, position: t } : { ...s }))
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

  const nextPaints = currentPaints.map((p, i) => (i === drag.paintIndex ? updatedPaint : p))
  context.editor.updateNode(node.id, { [drag.property]: nextPaints })
}

export function commitGradientDrag(drag: DragGradient, editor: Editor): void {
  const node = editor.graph.getNode(drag.nodeId)
  if (!node) return

  const currentPaints = drag.property === 'strokes' ? node.strokes : node.fills
  const nextPaint = currentPaints[drag.paintIndex]

  const origPaints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? structuredClone(drag.origPaint) : structuredClone(p)
  )

  const finalPaints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? structuredClone(nextPaint) : structuredClone(p)
  )

  editor.undo.push({
    label: 'Edit gradient',
    forward: () => {
      editor.updateNode(node.id, { [drag.property]: structuredClone(finalPaints) })
    },
    inverse: () => {
      editor.updateNode(node.id, { [drag.property]: structuredClone(origPaints) })
    }
  })
}

export function cancelGradientDrag(drag: DragGradient, editor: Editor): void {
  const node = editor.graph.getNode(drag.nodeId)
  if (!node) return
  const paints = (drag.property === 'strokes' ? node.strokes : node.fills).map((p, i) =>
    i === drag.paintIndex ? structuredClone(drag.origPaint) : structuredClone(p)
  )
  editor.updateNode(node.id, { [drag.property]: paints })
}
