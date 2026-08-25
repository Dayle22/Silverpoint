import type { VectorRegion, VectorVertex } from '@open-pencil/scene-graph'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'
import type { Path } from 'canvaskit-wasm'

import type { TextEditor } from '#core/text/editor'

export interface RulerTheme {
  background: Color
  tick: Color
  text: Color
  label: Color
}

export interface RenderOverlays {
  guideOverlays?: boolean
  hoveredNodeId?: string | null
  enteredContainerId?: string | null
  editingTextId?: string | null
  textEditor?: TextEditor | null
  marquee?: Rect | null
  snapGuides?: SnapGuide[]
  rotationPreview?: { nodeId: string; angle: number } | null
  dropTargetId?: string | null
  layoutInsertIndicator?: {
    x: number
    y: number
    length: number
    direction: 'HORIZONTAL' | 'VERTICAL'
  } | null
  autoLayoutHover?: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
  /** Progressive blur effect whose ramp handles are shown on canvas. */
  progressiveBlurEdit?: { nodeId: string; effectIndex: number } | null
  /** Gradient fill whose ramp handles and stop swatches are shown on canvas. */
  gradientEdit?: {
    nodeId: string
    fillIndex: number
    property?: 'fills' | 'strokes'
    activeStopIndex?: number
  } | null
  penState?: {
    vertices: Vector[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    dragTangent: Vector | null
    oppositeDragTangent?: Vector | null
    closingToFirst: boolean
    pendingClose?: boolean
    cursorX?: number
    cursorY?: number
  } | null
  nodeEditState?: {
    nodeId: string
    vertices: VectorVertex[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    regions: VectorRegion[]
    selectedVertexIndices: Set<number>
    /** Set of selected handles as "segIdx:tangentField" strings */
    selectedHandles?: Set<string>
    hoveredHandleInfo?: { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null
    hoveredInsertPoint?: Vector | null
    hoveredEndpointIndex?: number | null
  } | null
  penHoverIntent?: 'close' | 'continue' | 'insert' | null
  penHoverEndpoint?: { nodeId: string; vertexIndex: number } | null
  penHoverInsertPoint?: Vector | null
  remoteCursors?: Array<{
    name: string
    color: Color
    x: number
    y: number
    selection?: string[]
  }>
  shapeBuilderState?: {
    regions: Array<{
      id: string
      path: Path
      sourceNodeIds: string[]
      hovered: boolean
      dragged: boolean
    }>
    isDeleteMode: boolean
  } | null
}
