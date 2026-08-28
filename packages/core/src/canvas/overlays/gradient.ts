import type { Canvas, Paint } from 'canvaskit-wasm'

import type { Fill, SceneGraph, SceneNode, Stroke } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import Mat3Ops from '@open-pencil/scene-graph/matrix'
import type { Color, Matrix, Vector } from '@open-pencil/scene-graph/primitives'

import { linearGradientEndpoints } from '#core/canvas/fills'
import type { RenderOverlays, SkiaRenderer } from '#core/canvas/renderer'
import { BLACK, SELECTION_COLOR, WHITE } from '#core/constants'
import type { EditorState } from '#core/editor/types'

export interface GradientPoint {
  x: number
  y: number
}

export interface GradientStopPoint {
  index: number
  position: number
  color: Color
  local: GradientPoint
  world: GradientPoint
}

export interface GradientLinePoints {
  start: {
    local: GradientPoint
    world: GradientPoint
  }
  end: {
    local: GradientPoint
    world: GradientPoint
  }
  stops: GradientStopPoint[]
}

export interface ResolvedGradientEdit {
  nodeId: string
  node: SceneNode
  property: 'fills' | 'strokes'
  index: number
  paint: Fill | Stroke
  activeStopIndex: number | null
}

export function endpointsToGradientTransform(
  start: Vector,
  end: Vector,
  width: number,
  height: number,
  _existingTransform?: Matrix
): Matrix {
  const w = width || 1
  const h = height || 1
  const m02 = end.x / w
  const m12 = end.y / h
  const m00 = (start.x - end.x) / w
  const m10 = (start.y - end.y) / h
  const m01 = -((start.y - end.y) / w)
  const m11 = (start.x - end.x) / h

  return {
    m00,
    m01,
    m02,
    m10,
    m11,
    m12
  }
}

function findFirstGradient(
  node: SceneNode,
  property: 'fills' | 'strokes'
): ResolvedGradientEdit | null {
  const list = property === 'strokes' ? node.strokes : node.fills
  for (let i = 0; i < list.length; i++) {
    const paint = list[i]
    if (paint.visible && paint.type?.startsWith('GRADIENT')) {
      return {
        nodeId: node.id,
        node,
        property,
        index: i,
        paint,
        activeStopIndex: null
      }
    }
  }
  return null
}

export function resolveGradientEdit(
  graph: SceneGraph,
  selectedIds: Set<string> | ReadonlySet<string>,
  edit?: EditorState['gradientEdit'] | null
): ResolvedGradientEdit | null {
  if (edit?.nodeId) {
    const isEditedNodeSelected = selectedIds.size === 1 && selectedIds.has(edit.nodeId)
    if (edit.released && isEditedNodeSelected) return null
    const node = graph.getNode(edit.nodeId)
    if (node && isEditedNodeSelected) {
      const property = edit.property ?? 'fills'
      const index = edit.fillIndex ?? 0
      const list = property === 'strokes' ? node.strokes : node.fills
      const paint = list.at(index)
      if (paint?.visible && paint.type?.startsWith('GRADIENT')) {
        return {
          nodeId: node.id,
          node,
          property,
          index,
          paint,
          activeStopIndex: edit.activeStopIndex ?? null
        }
      }
    }
  }

  if (selectedIds.size === 1) {
    const [id] = selectedIds
    const node = id ? graph.getNode(id) : null
    if (!node) return null
    return findFirstGradient(node, 'fills') ?? findFirstGradient(node, 'strokes')
  }

  return null
}

export function getGradientLinePoints(
  node: SceneNode,
  fillOrStroke: Fill | Stroke,
  graph?: SceneGraph
): GradientLinePoints {
  const w = node.width
  const h = node.height
  const t = fillOrStroke.gradientTransform ?? {
    m00: 1,
    m01: 0,
    m02: 0,
    m10: 0,
    m11: 1,
    m12: 0
  }
  const { start: localStart, end: localEnd } = linearGradientEndpoints(w, h, t)

  const worldMatrix = graph ? getWorldMatrix(node, graph) : null
  const mapPt = (pt: GradientPoint): GradientPoint => {
    if (!worldMatrix) return { x: pt.x, y: pt.y }
    const mapped = Mat3Ops.mapPoints(worldMatrix, [pt.x, pt.y])
    return { x: mapped[0], y: mapped[1] }
  }

  const startWorld = mapPt(localStart)
  const endWorld = mapPt(localEnd)

  const stops = fillOrStroke.gradientStops ?? [
    { position: 0, color: { ...BLACK } },
    { position: 1, color: { ...WHITE } }
  ]

  const stopPoints: GradientStopPoint[] = stops.map((s, index) => {
    const p = s.position
    const local = {
      x: localStart.x + p * (localEnd.x - localStart.x),
      y: localStart.y + p * (localEnd.y - localStart.y)
    }
    const world = mapPt(local)
    return {
      index,
      position: s.position,
      color: s.color,
      local,
      world
    }
  })

  return {
    start: {
      local: localStart,
      world: startWorld
    },
    end: {
      local: localEnd,
      world: endWorld
    },
    stops: stopPoints
  }
}

interface GradientOverlayPaints {
  lineShadowPaint: Paint
  linePaint: Paint
  handleFillPaint: Paint
  handleStrokePaint: Paint
  stopFillPaint: Paint
  stopInnerStrokePaint: Paint
  stopOuterStrokePaint: Paint
  activeHaloPaint: Paint
  hoverHaloPaint: Paint
}

const paintCache = new WeakMap<SkiaRenderer, GradientOverlayPaints>()

function getGradientPaints(r: SkiaRenderer): GradientOverlayPaints {
  let paints = paintCache.get(r)
  if (paints) return paints

  const ck = r.ck

  const lineShadowPaint = new ck.Paint()
  lineShadowPaint.setStyle(ck.PaintStyle.Stroke)
  lineShadowPaint.setStrokeWidth(3)
  lineShadowPaint.setColor(ck.Color4f(0, 0, 0, 0.25))
  lineShadowPaint.setAntiAlias(true)

  const linePaint = new ck.Paint()
  linePaint.setStyle(ck.PaintStyle.Stroke)
  linePaint.setStrokeWidth(1.5)
  linePaint.setColor(ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, 1))
  linePaint.setAntiAlias(true)

  const handleFillPaint = new ck.Paint()
  handleFillPaint.setStyle(ck.PaintStyle.Fill)
  handleFillPaint.setColor(ck.WHITE)
  handleFillPaint.setAntiAlias(true)

  const handleStrokePaint = new ck.Paint()
  handleStrokePaint.setStyle(ck.PaintStyle.Stroke)
  handleStrokePaint.setStrokeWidth(1.5)
  handleStrokePaint.setColor(ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, 1))
  handleStrokePaint.setAntiAlias(true)

  const stopFillPaint = new ck.Paint()
  stopFillPaint.setStyle(ck.PaintStyle.Fill)
  stopFillPaint.setAntiAlias(true)

  const stopInnerStrokePaint = new ck.Paint()
  stopInnerStrokePaint.setStyle(ck.PaintStyle.Stroke)
  stopInnerStrokePaint.setStrokeWidth(1.5)
  stopInnerStrokePaint.setColor(ck.WHITE)
  stopInnerStrokePaint.setAntiAlias(true)

  const stopOuterStrokePaint = new ck.Paint()
  stopOuterStrokePaint.setStyle(ck.PaintStyle.Stroke)
  stopOuterStrokePaint.setStrokeWidth(1)
  stopOuterStrokePaint.setColor(ck.Color4f(0, 0, 0, 0.5))
  stopOuterStrokePaint.setAntiAlias(true)

  const activeHaloPaint = new ck.Paint()
  activeHaloPaint.setStyle(ck.PaintStyle.Stroke)
  activeHaloPaint.setStrokeWidth(2)
  activeHaloPaint.setColor(ck.Color4f(SELECTION_COLOR.r, SELECTION_COLOR.g, SELECTION_COLOR.b, 1))
  activeHaloPaint.setAntiAlias(true)

  const hoverHaloPaint = new ck.Paint()
  hoverHaloPaint.setStyle(ck.PaintStyle.Stroke)
  hoverHaloPaint.setStrokeWidth(2)
  hoverHaloPaint.setColor(ck.Color4f(0.376, 0.647, 0.98, 0.8))
  hoverHaloPaint.setAntiAlias(true)

  paints = {
    lineShadowPaint,
    linePaint,
    handleFillPaint,
    handleStrokePaint,
    stopFillPaint,
    stopInnerStrokePaint,
    stopOuterStrokePaint,
    activeHaloPaint,
    hoverHaloPaint
  }

  paintCache.set(r, paints)
  return paints
}

export function drawGradientHandles(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  node: SceneNode,
  fillOrStroke: Fill | Stroke,
  activeStopIndex?: number | null,
  hoveredTarget?: 'start' | 'end' | { stopIndex: number } | { line: number } | null
): void {
  const pts = getGradientLinePoints(node, fillOrStroke, graph)
  const paints = getGradientPaints(r)

  const toScreen = (pt: GradientPoint): GradientPoint => ({
    x: pt.x * r.zoom + r.panX,
    y: pt.y * r.zoom + r.panY
  })

  const startScreen = toScreen(pts.start.world)
  const endScreen = toScreen(pts.end.world)

  // 1. Draw gradient line
  canvas.drawLine(startScreen.x, startScreen.y, endScreen.x, endScreen.y, paints.lineShadowPaint)
  canvas.drawLine(startScreen.x, startScreen.y, endScreen.x, endScreen.y, paints.linePaint)

  // 2. Draw start handle
  const isStartHovered = hoveredTarget === 'start'
  if (isStartHovered) {
    canvas.drawCircle(startScreen.x, startScreen.y, 8, paints.hoverHaloPaint)
  }
  canvas.drawCircle(startScreen.x, startScreen.y, 5.5, paints.handleFillPaint)
  canvas.drawCircle(startScreen.x, startScreen.y, 5.5, paints.handleStrokePaint)

  // 3. Draw end handle
  const isEndHovered = hoveredTarget === 'end'
  if (isEndHovered) {
    canvas.drawCircle(endScreen.x, endScreen.y, 8, paints.hoverHaloPaint)
  }
  canvas.drawCircle(endScreen.x, endScreen.y, 5.5, paints.handleFillPaint)
  canvas.drawCircle(endScreen.x, endScreen.y, 5.5, paints.handleStrokePaint)

  // 4. Draw stop handles
  for (const stop of pts.stops) {
    const screen = toScreen(stop.world)
    const isActive = activeStopIndex === stop.index
    const isHovered =
      typeof hoveredTarget === 'object' &&
      hoveredTarget !== null &&
      'stopIndex' in hoveredTarget &&
      hoveredTarget.stopIndex === stop.index

    if (isActive) {
      canvas.drawCircle(screen.x, screen.y, 8, paints.activeHaloPaint)
    } else if (isHovered) {
      canvas.drawCircle(screen.x, screen.y, 7.5, paints.hoverHaloPaint)
    }

    const radius = isActive ? 7 : 6
    paints.stopFillPaint.setColor(
      r.ck.Color4f(stop.color.r, stop.color.g, stop.color.b, stop.color.a)
    )
    canvas.drawCircle(screen.x, screen.y, radius, paints.stopFillPaint)
    canvas.drawCircle(screen.x, screen.y, radius, paints.stopInnerStrokePaint)
    canvas.drawCircle(screen.x, screen.y, radius, paints.stopOuterStrokePaint)
  }
}

export function drawGradientOverlay(
  r: SkiaRenderer,
  canvas: Canvas,
  graph: SceneGraph,
  selectedIds: Set<string>,
  overlays: RenderOverlays
): void {
  if (overlays.editingTextId || overlays.nodeEditState || overlays.penState) return
  if (overlays.measurementMode && overlays.measurementMode !== 'off') return

  const target = resolveGradientEdit(graph, selectedIds, overlays.gradientEdit)
  if (!target) return

  drawGradientHandles(
    r,
    canvas,
    graph,
    target.node,
    target.paint,
    target.activeStopIndex,
    overlays.hoveredGradientTarget
  )
}
