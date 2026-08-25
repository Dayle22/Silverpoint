import { BLACK, DEFAULT_TEXT_HEIGHT, DEFAULT_TEXT_WIDTH } from '@open-pencil/core/constants'
import type { Editor } from '@open-pencil/core/editor'
import type { VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import { MOVE_DRAG_START_THRESHOLD_PX } from '#vue/shared/input/move'
import { TOOL_TO_NODE } from '#vue/shared/input/types'
import type { DragDraw, DragFreehand, DragState, DragTextDraw } from '#vue/shared/input/types'

const FREEHAND_MIN_DISTANCE = 0.75

function pressureForEvent(event: MouseEvent): number {
  const pressure = 'pressure' in event ? Number(event.pressure) : 0
  return pressure > 0 ? Math.min(1, pressure) : 0.5
}

function freehandWidth(tool: DragFreehand['tool'], pressure: number): number {
  const response = tool === 'PENCIL' ? pressure : Math.sqrt(pressure)
  return (tool === 'PENCIL' ? 3.2 : 18) * (0.25 + response * 0.75)
}

function buildFreehandNetwork(d: DragFreehand): {
  network: VectorNetwork
  bounds: Rect
} {
  const samples =
    d.samples.length === 1
      ? Array.from({ length: 8 }, (_, i) => ({
          ...d.samples[0],
          x:
            d.samples[0].x +
            (Math.cos((i / 8) * Math.PI * 2) * freehandWidth(d.tool, d.samples[0].pressure)) / 2,
          y:
            d.samples[0].y +
            (Math.sin((i / 8) * Math.PI * 2) * freehandWidth(d.tool, d.samples[0].pressure)) / 2
        }))
      : d.samples
  const left: Vector[] = []
  const right: Vector[] = []

  for (let i = 0; i < samples.length; i++) {
    const previous = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(samples.length - 1, i + 1)]
    const dx = next.x - previous.x
    const dy = next.y - previous.y
    const length = Math.hypot(dx, dy) || 1
    const radius = freehandWidth(d.tool, samples[i].pressure) / 2
    const nx = -dy / length
    const ny = dx / length
    left.push({ x: samples[i].x + nx * radius, y: samples[i].y + ny * radius })
    right.push({ x: samples[i].x - nx * radius, y: samples[i].y - ny * radius })
  }

  const outline = [...left, ...right.reverse()]
  const bounds = outline.reduce<{ x: number; y: number; right: number; bottom: number }>(
    (result, point) => ({
      x: Math.min(result.x, point.x),
      y: Math.min(result.y, point.y),
      right: Math.max(result.right, point.x),
      bottom: Math.max(result.bottom, point.y)
    }),
    { x: Infinity, y: Infinity, right: -Infinity, bottom: -Infinity }
  )
  const vertices = outline.map((point) => ({ x: point.x - bounds.x, y: point.y - bounds.y }))
  const segments = vertices.map((_, index) => ({
    start: index,
    end: (index + 1) % vertices.length,
    tangentStart: { x: 0, y: 0 },
    tangentEnd: { x: 0, y: 0 }
  }))
  return {
    network: {
      vertices,
      segments,
      regions: [{ windingRule: 'NONZERO', loops: [segments.map((_, index) => index)] }]
    },
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.right - bounds.x,
      height: bounds.bottom - bounds.y
    }
  }
}

export function startFreehandDraw(
  cx: number,
  cy: number,
  event: MouseEvent,
  tool: DragFreehand['tool'],
  setDrag: (d: DragState) => void
) {
  setDrag({
    type: 'freehand',
    tool,
    samples: [{ x: cx, y: cy, pressure: pressureForEvent(event) }]
  })
}

export function handleFreehandMove(d: DragFreehand, cx: number, cy: number, event: MouseEvent) {
  const last = d.samples[d.samples.length - 1]
  if (Math.hypot(cx - last.x, cy - last.y) < FREEHAND_MIN_DISTANCE) return
  d.samples.push({ x: cx, y: cy, pressure: pressureForEvent(event) })
}

export function handleFreehandUp(d: DragFreehand, editor: Editor) {
  const { network, bounds } = buildFreehandNetwork(d)
  const nodeId = editor.createShape('VECTOR', bounds.x, bounds.y, bounds.width, bounds.height)
  editor.graph.updateNode(nodeId, {
    vectorNetwork: network,
    fills: [{ type: 'SOLID', color: BLACK, opacity: 1, visible: true }],
    strokes: [],
    name: d.tool === 'PENCIL' ? 'Pencil Stroke' : 'Brush Stroke'
  })
  editor.select([nodeId])
  editor.setTool('SELECT')
  editor.requestRender()
}

export function startTextTool(cx: number, cy: number, editor: Editor) {
  const nodeId = editor.createShape('TEXT', cx, cy, DEFAULT_TEXT_WIDTH, DEFAULT_TEXT_HEIGHT)
  editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  editor.startTextEditing(nodeId)
  editor.setTool('SELECT')
  editor.requestRender()
}

export function startTextDraw(
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  editor.undo.beginBatch('Create text')
  const nodeId = editor.createShape('TEXT', cx, cy, 0, 0)
  editor.graph.updateNode(nodeId, { text: '' })
  editor.select([nodeId])
  setDrag({
    type: 'text-draw',
    startX: cx,
    startY: cy,
    startScreenX: sx,
    startScreenY: sy,
    nodeId,
    dragStarted: false
  })
}

export function handleTextDrawMove(
  d: DragTextDraw,
  cx: number,
  cy: number,
  sx: number,
  sy: number,
  shiftKey: boolean,
  editor: Editor
) {
  if (!d.dragStarted) {
    const dx = sx - d.startScreenX
    const dy = sy - d.startScreenY
    if (dx * dx + dy * dy < MOVE_DRAG_START_THRESHOLD_PX * MOVE_DRAG_START_THRESHOLD_PX) {
      return
    }
    d.dragStarted = true
  }
  handleDrawMove(d, cx, cy, shiftKey, editor)
}

export function handleTextDrawUp(d: DragTextDraw, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (!d.dragStarted || !node || node.width < 2 || node.height < 2) {
    editor.updateNode(d.nodeId, {
      x: d.startX,
      y: d.startY,
      width: DEFAULT_TEXT_WIDTH,
      height: DEFAULT_TEXT_HEIGHT
    })
  }
  editor.commitResize(d.nodeId, { x: d.startX, y: d.startY, width: 0, height: 0 })
  editor.undo.commitBatch()
  editor.select([d.nodeId])
  editor.startTextEditing(d.nodeId)
  editor.setTool('SELECT')
  editor.requestRender()
}

export function cancelTextDraw(_d: DragTextDraw, editor: Editor) {
  editor.undo.rollbackBatch()
  editor.requestRender()
}

export function startShapeDraw(
  cx: number,
  cy: number,
  editor: Editor,
  setDrag: (d: DragState) => void
) {
  const nodeType = TOOL_TO_NODE[editor.state.activeTool]
  if (!nodeType) return

  editor.undo.beginBatch('Create shape')
  const nodeId = editor.createShape(nodeType, cx, cy, 0, 0)
  editor.select([nodeId])
  setDrag({ type: 'draw', startX: cx, startY: cy, nodeId })
}

export function handleDrawMove(
  d: Pick<DragDraw, 'startX' | 'startY' | 'nodeId'>,
  cx: number,
  cy: number,
  shiftKey: boolean,
  editor: Editor
) {
  let w = cx - d.startX
  let h = cy - d.startY

  if (shiftKey) {
    const size = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w) * size
    h = Math.sign(h) * size
  }

  editor.updateNode(d.nodeId, {
    x: w < 0 ? d.startX + w : d.startX,
    y: h < 0 ? d.startY + h : d.startY,
    width: Math.abs(w),
    height: Math.abs(h)
  })
}

export function handleDrawUp(d: DragDraw, editor: Editor) {
  const node = editor.graph.getNode(d.nodeId)
  if (node && node.width < 2 && node.height < 2) {
    editor.updateNode(d.nodeId, { width: 100, height: 100 })
  }
  if (node?.type === 'SECTION') {
    editor.adoptNodesIntoSection(node.id)
  } else if (node?.type === 'FRAME') {
    editor.adoptNodesIntoFrame(node.id)
  }
  editor.commitResize(d.nodeId, { x: d.startX, y: d.startY, width: 0, height: 0 })
  editor.undo.commitBatch()
  editor.setTool('SELECT')
}
