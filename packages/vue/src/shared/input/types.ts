import type { Tool } from '@open-pencil/core/editor'
import type { GradientSpinePoint, GradientStop, GradientTransform, NodeType, VectorNetwork } from '@open-pencil/scene-graph'
import type { Rect, Vector } from '@open-pencil/scene-graph/primitives'

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type CornerPosition = 'nw' | 'ne' | 'se' | 'sw'
export type VertexRadiusHandle = `vertex:${number}`
export type RadiusHandle = CornerPosition | VertexRadiusHandle

export interface DragDraw {
  type: 'draw'
  startX: number
  startY: number
  nodeId: string
}

export interface DragTextDraw {
  type: 'text-draw'
  startX: number
  startY: number
  startScreenX: number
  startScreenY: number
  nodeId: string
  dragStarted: boolean
}

export interface DragMove {
  type: 'move'
  startX: number
  startY: number
  currentX: number
  currentY: number
  startScreenX: number
  startScreenY: number
  dragStarted: boolean
  originals: Map<string, { x: number; y: number; parentId: string }>
  duplicated?: boolean
  duplicatedPreviousSelection?: Set<string>
  autoLayoutParentId?: string
  brokeFromAutoLayout?: boolean
}

export interface DragPan {
  type: 'pan'
  startScreenX: number
  startScreenY: number
  startPanX: number
  startPanY: number
}

export interface DragPageGuide {
  type: 'page-guide'
  axis: 'X' | 'Y'
  index: number
  previousOffset: number
  created: boolean
}

export interface OrigChildState {
  x: number
  y: number
  width: number
  height: number
  vectorNetwork: VectorNetwork | null
}

export interface DragResize {
  type: 'resize'
  handle: HandlePosition
  startX: number
  startY: number
  origRect: Rect
  nodeId: string
  origVectorNetwork: VectorNetwork | null
  origChildren: Map<string, OrigChildState> | null
}

export interface DragMarquee {
  type: 'marquee'
  startX: number
  startY: number
}

export interface DragRotate {
  type: 'rotate'
  nodeId: string
  centerX: number
  centerY: number
  startAngle: number
  origRotation: number
}

export interface DragRadius {
  type: 'radius'
  nodeId: string
  corner: RadiusHandle
  startLocalX: number
  startLocalY: number
  direction?: Vector
  original: {
    cornerRadius: number
    topLeftRadius: number
    topRightRadius: number
    bottomRightRadius: number
    bottomLeftRadius: number
    independentCorners: boolean
  }
}

export interface DragProgressiveBlur {
  type: 'progressive-blur'
  nodeId: string
  effectIndex: number
  /** Which end of the ramp is being dragged. */
  end: 'start' | 'end'
  original: {
    startOffset: Vector
    endOffset: Vector
  }
}

export interface DragGradientHandle {
  type: 'gradient-handle'
  nodeId: string
  fillIndex: number
  property: 'fills' | 'strokes'
  target: 'start' | 'end' | 'width' | 'bend' | number
  originalTransform: GradientTransform
  originalStops: GradientStop[]
  originalSpine?: GradientSpinePoint[]
}

export interface DragPen {
  type: 'pen-drag'
  startX: number
  startY: number
  modifierMode: 'default' | 'continuous' | 'independent'
  frozenOppositeTangent: Vector | null
  spaceDown: boolean
  spaceStartX: number
  spaceStartY: number
  knotStartX: number
  knotStartY: number
}

export interface FreehandSample {
  x: number
  y: number
  pressure: number
}

export interface DragFreehand {
  type: 'freehand'
  tool: 'PENCIL' | 'BRUSH'
  samples: FreehandSample[]
}

export interface DragTextSelect {
  type: 'text-select'
  startX: number
  startY: number
}

export interface DragEditNode {
  type: 'edit-node'
  startX: number
  startY: number
  origPositions: Map<number, Vector>
}

export interface DragEditHandle {
  type: 'edit-handle'
  segmentIndex: number
  tangentField: 'tangentStart' | 'tangentEnd'
  vertexIndex: number
  startX: number
  startY: number
  initialTangent: Vector | null
}

export interface DragBendHandle {
  type: 'bend-handle'
  vertexIndex: number
  startX: number
  startY: number
  lockedMode: 'symmetric' | 'independent' | null
  dragSamples: Vector[]
  targetSegmentIndex: number | null
  targetTangentField: 'tangentStart' | 'tangentEnd' | null
}

export interface DragShapeBuilder {
  type: 'shape-builder-drag'
  draggedRegionIds: Set<string>
  isDeleteMode: boolean
}

export interface DragSpacingDrag {
  type: 'spacing-drag'
  nodeId: string
  axis: 'HORIZONTAL' | 'VERTICAL'
  startCursor: number // cx or cy at pointer-down, matching axis
  original: number // node.itemSpacing at pointer-down
}

export type DragState =
  | DragDraw
  | DragTextDraw
  | DragMove
  | DragPan
  | DragPageGuide
  | DragResize
  | DragMarquee
  | DragRotate
  | DragRadius
  | DragProgressiveBlur
  | DragGradientHandle
  | DragPen
  | DragFreehand
  | DragTextSelect
  | DragEditNode
  | DragEditHandle
  | DragBendHandle
  | DragShapeBuilder
  | DragSpacingDrag

export const TOOL_TO_NODE: Partial<Record<Tool, NodeType>> = {
  FRAME: 'FRAME',
  SECTION: 'SECTION',
  SLICE: 'SLICE',
  RECTANGLE: 'RECTANGLE',
  ELLIPSE: 'ELLIPSE',
  LINE: 'LINE',
  POLYGON: 'POLYGON',
  STAR: 'STAR',
  TEXT: 'TEXT'
}
