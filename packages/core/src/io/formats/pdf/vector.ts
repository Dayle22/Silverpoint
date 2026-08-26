import { BLACK } from '#core/constants'
import type {
  Color,
  Fill,
  SceneGraph,
  SceneNode,
  Stroke,
  StrokeCap,
  StrokeJoin,
  VectorNetwork,
  VectorSegment
} from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

import type { ExtendedPDFPageProxy, PDFImportDiagnostic } from './import'
import { encodeRGBAToPNG } from './png'

const DRAW_OPS = {
  moveTo: 0,
  lineTo: 1,
  curveTo: 2,
  quadraticCurveTo: 3,
  closePath: 4
} as const

export const OPS = {
  setLineWidth: 2,
  setLineCap: 3,
  setLineJoin: 4,
  setMiterLimit: 5,
  setDash: 6,
  setGState: 9,
  save: 10,
  restore: 11,
  transform: 12,
  moveTo: 13,
  lineTo: 14,
  curveTo: 15,
  closePath: 18,
  rectangle: 19,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  setStrokeColorSpace: 50,
  setFillColorSpace: 51,
  setStrokeColor: 52,
  setStrokeColorN: 53,
  setFillColor: 54,
  setFillColorN: 55,
  setStrokeGray: 56,
  setFillGray: 57,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setStrokeCMYKColor: 60,
  setFillCMYKColor: 61,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  constructPath: 91
} as const

const FILL_OPS = new Set<number>([
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke
])

const STROKE_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke
])

const CLOSE_OPS = new Set<number>([
  OPS.closeStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke
])

export interface PDFOperatorList {
  fnArray: number[]
  argsArray: unknown[][]
}

interface PathCommand {
  type: 'moveTo' | 'lineTo' | 'curveTo' | 'closePath'
  p?: Vector
  cp1?: Vector
  cp2?: Vector
}

interface GraphicsState {
  ctm: [number, number, number, number, number, number]
  lineWidth: number
  lineCap: StrokeCap
  lineJoin: StrokeJoin
  miterLimit: number
  dashArray: number[]
  strokeColor: Color
  fillColor: Color
  fillOpacity: number
  strokeOpacity: number
}

function defaultGraphicsState(): GraphicsState {
  return {
    ctm: [1, 0, 0, 1, 0, 0],
    lineWidth: 1,
    lineCap: 'NONE',
    lineJoin: 'MITER',
    miterLimit: 4,
    dashArray: [],
    strokeColor: { ...BLACK },
    fillColor: { ...BLACK },
    fillOpacity: 1,
    strokeOpacity: 1
  }
}

function multiplyMatrix(
  m1: [number, number, number, number, number, number],
  m2: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
  ]
}

function applyTransform(
  p: Vector,
  ctm: [number, number, number, number, number, number],
  pageHeight: number
): Vector {
  return {
    x: Math.round((ctm[0] * p.x + ctm[2] * p.y + ctm[4]) * 100) / 100,
    y: Math.round((pageHeight - (ctm[1] * p.x + ctm[3] * p.y + ctm[5])) * 100) / 100
  }
}

function parseHexColor(hexStr: string): Color | null {
  const hex = hexStr.replace(/^#/, '')
  if (hex.length === 6) {
    return {
      r: Number.parseInt(hex.slice(0, 2), 16) / 255,
      g: Number.parseInt(hex.slice(2, 4), 16) / 255,
      b: Number.parseInt(hex.slice(4, 6), 16) / 255,
      a: 1
    }
  }
  return null
}

function parseColorArgs(args: unknown[]): Color {
  if (args.length === 1 && typeof args[0] === 'string') {
    const parsed = parseHexColor(args[0])
    if (parsed) return parsed
  }
  if (args.length >= 3) {
    const r = typeof args[0] === 'number' ? (args[0] > 1 ? args[0] / 255 : args[0]) : 0
    const g = typeof args[1] === 'number' ? (args[1] > 1 ? args[1] / 255 : args[1]) : 0
    const b = typeof args[2] === 'number' ? (args[2] > 1 ? args[2] / 255 : args[2]) : 0
    return { r, g, b, a: 1 }
  }
  if (args.length === 1 && typeof args[0] === 'number') {
    const v = args[0] > 1 ? args[0] / 255 : args[0]
    return { r: v, g: v, b: v, a: 1 }
  }
  if (args.length === 4) {
    const c = typeof args[0] === 'number' ? args[0] : 0
    const m = typeof args[1] === 'number' ? args[1] : 0
    const y = typeof args[2] === 'number' ? args[2] : 0
    const k = typeof args[3] === 'number' ? args[3] : 0
    return { r: (1 - c) * (1 - k), g: (1 - m) * (1 - k), b: (1 - y) * (1 - k), a: 1 }
  }
  return { ...BLACK }
}

function isRectanglePath(commands: PathCommand[]): Rect | null {
  if (commands.length < 4 || commands.length > 5) return null
  const pts: Vector[] = []
  for (const cmd of commands) {
    if (cmd.type === 'moveTo' || cmd.type === 'lineTo') {
      if (cmd.p) pts.push(cmd.p)
    } else if (cmd.type !== 'closePath') {
      return null
    }
  }
  if (pts.length !== 4) return null

  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  const maxY = Math.max(...pts.map((p) => p.y))
  const width = Math.round((maxX - minX) * 100) / 100
  const height = Math.round((maxY - minY) * 100) / 100
  if (width <= 0 || height <= 0) return null

  for (const p of pts) {
    const isCorner =
      (Math.abs(p.x - minX) < 0.1 || Math.abs(p.x - maxX) < 0.1) &&
      (Math.abs(p.y - minY) < 0.1 || Math.abs(p.y - maxY) < 0.1)
    if (!isCorner) return null
  }
  return { x: minX, y: minY, width, height }
}

function buildVectorNetwork(commands: PathCommand[], origin: Vector): VectorNetwork {
  const vertices: Vector[] = []
  const segments: VectorSegment[] = []
  const ZERO: Vector = { x: 0, y: 0 }
  let cur = -1
  let start = -1

  for (const cmd of commands) {
    if (cmd.type === 'moveTo' && cmd.p) {
      vertices.push({ x: Math.round((cmd.p.x - origin.x) * 100) / 100, y: Math.round((cmd.p.y - origin.y) * 100) / 100 })
      cur = vertices.length - 1
      start = cur
    } else if (cmd.type === 'lineTo' && cmd.p) {
      vertices.push({ x: Math.round((cmd.p.x - origin.x) * 100) / 100, y: Math.round((cmd.p.y - origin.y) * 100) / 100 })
      const next = vertices.length - 1
      if (cur >= 0) segments.push({ start: cur, end: next, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } })
      cur = next
    } else if (cmd.type === 'curveTo' && cmd.p && cmd.cp1 && cmd.cp2) {
      const sPt = vertices[cur] ?? { x: 0, y: 0 }
      const ePt = { x: Math.round((cmd.p.x - origin.x) * 100) / 100, y: Math.round((cmd.p.y - origin.y) * 100) / 100 }
      vertices.push(ePt)
      const next = vertices.length - 1
      if (cur >= 0) {
        segments.push({
          start: cur,
          end: next,
          tangentStart: { x: Math.round((cmd.cp1.x - origin.x - sPt.x) * 100) / 100, y: Math.round((cmd.cp1.y - origin.y - sPt.y) * 100) / 100 },
          tangentEnd: { x: Math.round((cmd.cp2.x - origin.x - ePt.x) * 100) / 100, y: Math.round((cmd.cp2.y - origin.y - ePt.y) * 100) / 100 }
        })
      }
      cur = next
    } else if (cmd.type === 'closePath') {
      if (cur >= 0 && start >= 0 && cur !== start) {
        segments.push({ start: cur, end: start, tangentStart: { ...ZERO }, tangentEnd: { ...ZERO } })
      }
      cur = start
    }
  }

  return {
    vertices,
    segments,
    regions: segments.length >= 3 ? [{ windingRule: 'NONZERO', loops: [segments.map((_, i) => i)] }] : []
  }
}

function flushPath(
  graph: SceneGraph,
  frameId: string,
  commands: PathCommand[],
  isFill: boolean,
  isStroke: boolean,
  state: GraphicsState,
  nodeCounter: { count: number }
): void {
  if (commands.length === 0) return
  const rect = isRectanglePath(commands)
  const fills: Fill[] = isFill ? [{ type: 'SOLID', color: { ...state.fillColor }, opacity: state.fillOpacity, visible: true }] : []
  const strokes: Stroke[] = isStroke
    ? [{ color: { ...state.strokeColor }, weight: Math.max(state.lineWidth, 0.5), opacity: state.strokeOpacity, visible: true, align: 'CENTER', cap: state.lineCap, join: state.lineJoin }]
    : []

  if (rect) {
    nodeCounter.count++
    const rectNode = graph.createNode('RECTANGLE', frameId, {
      name: `Rectangle ${nodeCounter.count}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      strokeCap: state.lineCap,
      strokeJoin: state.lineJoin,
      dashPattern: [...state.dashArray]
    })
    rectNode.fills = fills
    rectNode.strokes = strokes
    return
  }

  const pts: Vector[] = []
  for (const c of commands) {
    if (c.p) pts.push(c.p)
    if (c.cp1) pts.push(c.cp1)
    if (c.cp2) pts.push(c.cp2)
  }
  if (pts.length === 0) return

  const minX = Math.min(...pts.map((p) => p.x))
  const maxX = Math.max(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  const maxY = Math.max(...pts.map((p) => p.y))
  const network = buildVectorNetwork(commands, { x: minX, y: minY })
  if (network.vertices.length === 0) return

  nodeCounter.count++
  const vectorNode = graph.createNode('VECTOR', frameId, {
    name: `Vector ${nodeCounter.count}`,
    x: minX,
    y: minY,
    width: Math.max(Math.round((maxX - minX) * 100) / 100, 1),
    height: Math.max(Math.round((maxY - minY) * 100) / 100, 1),
    vectorNetwork: network,
    strokeCap: state.lineCap,
    strokeJoin: state.lineJoin,
    dashPattern: [...state.dashArray]
  })
  vectorNode.fills = fills
  vectorNode.strokes = strokes
}

function parseConstructPath(args1: unknown, state: GraphicsState, pageHeight: number): PathCommand[] {
  const commands: PathCommand[] = []
  const subpaths: Array<ArrayLike<number>> = []

  if (Array.isArray(args1)) {
    for (const item of args1) {
      if (item && typeof item === 'object' && 'length' in item && typeof (item as ArrayLike<number>).length === 'number') {
        subpaths.push(item as ArrayLike<number>)
      }
    }
  } else if (args1 && typeof args1 === 'object' && 'length' in args1) {
    subpaths.push(args1 as ArrayLike<number>)
  }

  for (const data of subpaths) {
    let i = 0
    while (i < data.length) {
      const op = data[i++]
      if (op === DRAW_OPS.moveTo) {
        commands.push({ type: 'moveTo', p: applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight) })
      } else if (op === DRAW_OPS.lineTo) {
        commands.push({ type: 'lineTo', p: applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight) })
      } else if (op === DRAW_OPS.curveTo) {
        const cp1 = applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight)
        const cp2 = applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight)
        const p = applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight)
        commands.push({ type: 'curveTo', cp1, cp2, p })
      } else if (op === DRAW_OPS.quadraticCurveTo) {
        const cp = applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight)
        const p = applyTransform({ x: data[i++], y: data[i++] }, state.ctm, pageHeight)
        const start = commands[commands.length - 1]?.p ?? { x: 0, y: 0 }
        commands.push({
          type: 'curveTo',
          cp1: { x: start.x + (2 / 3) * (cp.x - start.x), y: start.y + (2 / 3) * (cp.y - start.y) },
          cp2: { x: p.x + (2 / 3) * (cp.x - p.x), y: p.y + (2 / 3) * (cp.y - p.y) },
          p
        })
      } else if (op === DRAW_OPS.closePath) {
        commands.push({ type: 'closePath' })
      }
    }
  }
  return commands
}

async function extractImageXObject(
  graph: SceneGraph,
  frameId: string,
  page: ExtendedPDFPageProxy,
  objId: string,
  state: GraphicsState,
  pageHeight: number,
  nodeCounter: { count: number }
): Promise<SceneNode | null> {
  const objs = page.objs
  if (!objs.has(objId)) return null

  return new Promise<SceneNode | null>((resolve) => {
    try {
      objs.get(objId, (img: { width: number; height: number; data?: Uint8Array }) => {
        if (!img.data || img.width <= 0 || img.height <= 0) {
          resolve(null)
          return
        }

        let rgba = img.data
        if (rgba.length === img.width * img.height * 3) {
          const converted = new Uint8Array(img.width * img.height * 4)
          for (let s = 0, d = 0; s < rgba.length; s += 3, d += 4) {
            converted[d] = rgba[s]
            converted[d + 1] = rgba[s + 1]
            converted[d + 2] = rgba[s + 2]
            converted[d + 3] = 255
          }
          rgba = converted
        }

        const imageHash = `pdf-img-${objId}-${img.width}x${img.height}`
        graph.images.set(imageHash, encodeRGBAToPNG(img.width, img.height, rgba))

        const ctm = state.ctm
        nodeCounter.count++
        resolve(
          graph.createNode('RECTANGLE', frameId, {
            name: `Image ${nodeCounter.count}`,
            x: Math.max(0, Math.round(ctm[4] * 100) / 100),
            y: Math.max(0, Math.round((pageHeight - (ctm[5] + ctm[3])) * 100) / 100),
            width: Math.max(Math.round(Math.abs(ctm[0]) * 100) / 100, img.width),
            height: Math.max(Math.round(Math.abs(ctm[3]) * 100) / 100, img.height),
            fills: [{ type: 'IMAGE', color: BLACK, opacity: 1, visible: true, imageHash, imageScaleMode: 'FILL' }]
          })
        )
      })
    } catch {
      resolve(null)
    }
  })
}

function handleStateOp(fn: number, args: unknown[], state: GraphicsState, stack: GraphicsState[]): GraphicsState {
  if (fn === OPS.save) {
    stack.push(structuredClone(state))
  } else if (fn === OPS.restore) {
    return stack.pop() ?? defaultGraphicsState()
  } else if (fn === OPS.transform) {
    state.ctm = multiplyMatrix(state.ctm, args as [number, number, number, number, number, number])
  } else if (fn === OPS.setLineWidth) {
    state.lineWidth = Math.max(typeof args[0] === 'number' ? args[0] : 1, 0.5)
  } else if (fn === OPS.setLineCap) {
    state.lineCap = args[0] === 1 ? 'ROUND' : (args[0] === 2 ? 'SQUARE' : 'NONE')
  } else if (fn === OPS.setLineJoin) {
    state.lineJoin = args[0] === 1 ? 'ROUND' : (args[0] === 2 ? 'BEVEL' : 'MITER')
  } else if (fn === OPS.setDash) {
    state.dashArray = Array.isArray(args[0]) ? (args[0] as number[]) : []
  }
  return state
}

function handleDrawingOp(fn: number, args: unknown[], state: GraphicsState, activeCmds: PathCommand[], pageHeight: number): void {
  if (fn === OPS.moveTo) {
    activeCmds.push({ type: 'moveTo', p: applyTransform({ x: args[0] as number, y: args[1] as number }, state.ctm, pageHeight) })
  } else if (fn === OPS.lineTo) {
    activeCmds.push({ type: 'lineTo', p: applyTransform({ x: args[0] as number, y: args[1] as number }, state.ctm, pageHeight) })
  } else if (fn === OPS.curveTo) {
    activeCmds.push({
      type: 'curveTo',
      cp1: applyTransform({ x: args[0] as number, y: args[1] as number }, state.ctm, pageHeight),
      cp2: applyTransform({ x: args[2] as number, y: args[3] as number }, state.ctm, pageHeight),
      p: applyTransform({ x: args[4] as number, y: args[5] as number }, state.ctm, pageHeight)
    })
  } else if (fn === OPS.closePath) {
    activeCmds.push({ type: 'closePath' })
  } else if (fn === OPS.rectangle) {
    const [x, y, w, h] = args as number[]
    activeCmds.push({ type: 'moveTo', p: applyTransform({ x, y }, state.ctm, pageHeight) })
    activeCmds.push({ type: 'lineTo', p: applyTransform({ x: x + w, y }, state.ctm, pageHeight) })
    activeCmds.push({ type: 'lineTo', p: applyTransform({ x: x + w, y: y + h }, state.ctm, pageHeight) })
    activeCmds.push({ type: 'lineTo', p: applyTransform({ x, y: y + h }, state.ctm, pageHeight) })
    activeCmds.push({ type: 'closePath' })
  }
}

function handleColorOp(fn: number, args: unknown[], state: GraphicsState): void {
  const isStroke = fn === OPS.setStrokeColorSpace || fn === OPS.setStrokeColor || fn === OPS.setStrokeColorN || fn === OPS.setStrokeGray || fn === OPS.setStrokeRGBColor || fn === OPS.setStrokeCMYKColor
  if (isStroke) state.strokeColor = parseColorArgs(args)
  else state.fillColor = parseColorArgs(args)
}

function handlePaintOp(graph: SceneGraph, frameId: string, fn: number, args: unknown[], state: GraphicsState, activeCmds: PathCommand[], pageHeight: number, nodeCounter: { count: number }): PathCommand[] {
  if (STROKE_OPS.has(fn) || FILL_OPS.has(fn)) {
    if (CLOSE_OPS.has(fn)) activeCmds.push({ type: 'closePath' })
    flushPath(graph, frameId, activeCmds, FILL_OPS.has(fn), STROKE_OPS.has(fn), state, nodeCounter)
    return []
  }
  if (fn === OPS.constructPath) {
    const closingOp = args[0] as number
    const cmds = parseConstructPath(args[1], state, pageHeight)
    flushPath(graph, frameId, cmds, FILL_OPS.has(closingOp), STROKE_OPS.has(closingOp), state, nodeCounter)
  }
  return activeCmds
}

export async function extractNativeVectors(
  graph: SceneGraph,
  frameId: string,
  page: ExtendedPDFPageProxy,
  opList: PDFOperatorList,
  pageHeight: number,
  diagnostics: PDFImportDiagnostic[],
  pageNumber: number
): Promise<{ extractedCount: number }> {
  let state = defaultGraphicsState()
  const stateStack: GraphicsState[] = []
  let activeCmds: PathCommand[] = []
  const nodeCounter = { count: 0 }

  for (let idx = 0; idx < opList.fnArray.length; idx++) {
    const fn = opList.fnArray[idx]
    const args = opList.argsArray[idx] ?? []

    if (fn <= OPS.transform) {
      state = handleStateOp(fn, args, state, stateStack)
    } else if (fn >= OPS.setStrokeColorSpace && fn <= OPS.setFillCMYKColor) {
      handleColorOp(fn, args, state)
    } else if (fn === OPS.moveTo || fn === OPS.lineTo || fn === OPS.curveTo || fn === OPS.closePath || fn === OPS.rectangle) {
      handleDrawingOp(fn, args, state, activeCmds, pageHeight)
    } else if (fn >= OPS.stroke && fn <= OPS.closeEOFillStroke) {
      activeCmds = handlePaintOp(graph, frameId, fn, args, state, activeCmds, pageHeight, nodeCounter)
    } else if (fn === OPS.constructPath) {
      activeCmds = handlePaintOp(graph, frameId, fn, args, state, activeCmds, pageHeight, nodeCounter)
    } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const objId = args[0] as string
      if (typeof objId === 'string') await extractImageXObject(graph, frameId, page, objId, state, pageHeight, nodeCounter)
    }
  }

  if (nodeCounter.count > 0) {
    diagnostics.push({
      severity: 'info',
      code: 'STAGE_B_NATIVE_VECTORS',
      message: `Stage B PDF import extracted ${nodeCounter.count} native vector/image nodes.`,
      pageNumber
    })
  }

  return { extractedCount: nodeCounter.count }
}
