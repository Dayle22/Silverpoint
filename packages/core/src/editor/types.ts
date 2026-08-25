import type { CanvasKit, Path } from 'canvaskit-wasm'

import type {
  SceneGraph,
  SceneGraphEvents,
  SceneNode,
  VectorSegment,
  VectorVertex
} from '@open-pencil/scene-graph'
import type { Color, Rect, Vector } from '@open-pencil/scene-graph/primitives'
import type { SnapGuide } from '@open-pencil/scene-graph/snap'
import type { UndoManager } from '@open-pencil/scene-graph/undo'

import type { CanvasGridSettings } from '#core/canvas/grid'
import type { CanvasGuideAppearance } from '#core/canvas/guide-appearance'
import type { RulerTheme, SkiaRenderer } from '#core/canvas/renderer'
import type { RenderOverlays } from '#core/canvas/renderer/types'
import type { TextEditor } from '#core/text/editor'
import type { DocumentUnits } from '#core/units'

export type Tool =
  | 'SELECT'
  | 'FRAME'
  | 'SECTION'
  | 'SLICE'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'POLYGON'
  | 'STAR'
  | 'TEXT'
  | 'PEN'
  | 'PENCIL'
  | 'BRUSH'
  | 'HAND'
  | 'SHAPE_BUILDER'
  | 'BARCODE'
  | 'BARCODE_EAN13'

export interface EditorState {
  activeTool: Tool
  currentPageId: string
  selectedIds: Set<string>
  marquee: Rect | null
  snapGuides: SnapGuide[]
  rotationPreview: { nodeId: string; angle: number } | null
  dropTargetId: string | null
  layoutInsertIndicator: {
    parentId: string
    index: number
    x: number
    y: number
    length: number
    direction: 'HORIZONTAL' | 'VERTICAL'
  } | null
  hoveredNodeId: string | null
  editingTextId: string | null
  penState: {
    vertices: VectorVertex[]
    segments: VectorSegment[]
    dragTangent: Vector | null
    oppositeDragTangent: Vector | null
    pendingClose?: boolean
    closingToFirst: boolean
    resumingNodeId?: string
    resumedFills?: SceneNode['fills']
    resumedStrokes?: SceneNode['strokes']
  } | null
  penCursorX: number | null
  penCursorY: number | null
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
  remoteCursors: Array<{
    name: string
    color: Color
    x: number
    y: number
    selection?: string[]
  }>
  autoLayoutHover: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
  /**
   * Progressive blur whose ramp handles are being edited on canvas. Set while
   * the matching effect row is expanded in a property panel.
   */
  progressiveBlurEdit: { nodeId: string; effectIndex: number } | null
  /**
   * Gradient fill whose ramp handles are being edited on canvas. Set while
   * a gradient fill is selected or being edited in the picker.
   */
  gradientEdit: {
    nodeId: string
    fillIndex: number
    property?: 'fills' | 'strokes'
    /** Stop highlighted on canvas, kept in step with the picker's selection. */
    activeStopIndex?: number
  } | null
  documentName: string
  showRulers: boolean
  canvasGrid: CanvasGridSettings
  guideAppearance: CanvasGuideAppearance
  panX: number
  pageColor: Color
  rulerTheme?: RulerTheme
  documentUnits?: DocumentUnits
  panY: number
  zoom: number
  renderVersion: number
  sceneVersion: number
  loading: boolean
  enteredContainerId: string | null
  nodeEditState?: RenderOverlays['nodeEditState'] | null
  cursorCanvasX?: number | null
  cursorCanvasY?: number | null
  penHoverIntent?: 'close' | 'continue' | 'insert' | null
  penHoverEndpoint?: { nodeId: string; vertexIndex: number } | null
  penHoverInsertPoint?: Vector | null
}

export interface EditorEvents extends SceneGraphEvents {
  'render:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'repaint:requested': (versions: { renderVersion: number; sceneVersion: number }) => void
  'graph:replaced': (graph: SceneGraph) => void
  'selection:changed': (selectedIds: string[], previousIds: string[]) => void
  'tool:changed': (tool: Tool, previousTool: Tool) => void
  'page:changed': (pageId: string, previousPageId: string) => void
  'viewport:changed': (
    viewport: { panX: number; panY: number; zoom: number },
    previous: { panX: number; panY: number; zoom: number }
  ) => void
}

export type EditorEventName = keyof EditorEvents

export interface EditorOptions {
  graph?: SceneGraph
  state?: EditorState
  loadFont?: (family: string, style: string, characters?: string) => Promise<ArrayBuffer | null>
  getViewportSize?: () => { width: number; height: number }
  skipInitialGraphSetup?: boolean
}

export interface EditorContext {
  get graph(): SceneGraph
  set graph(g: SceneGraph)
  undo: UndoManager
  state: EditorState
  loadFont: (family: string, style: string, characters?: string) => Promise<ArrayBuffer | null>
  getViewportSize: () => { width: number; height: number }
  getCk: () => CanvasKit | null
  getRenderer: () => SkiaRenderer | null
  getTextEditor: () => TextEditor | null
  requestRender: () => void
  requestRepaint: () => void
  emitEditorEvent: <K extends EditorEventName>(
    event: K,
    ...args: Parameters<EditorEvents[K]>
  ) => void
  setSelectedIds: (ids: Set<string>) => void
  setActiveTool: (tool: Tool) => void
  runLayoutForNode: (id: string) => void
  subscribeToGraph: () => void
}
