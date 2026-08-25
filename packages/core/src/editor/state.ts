import { CANVAS_BG_COLOR } from '#core/constants'
import { DEFAULT_CANVAS_GRID_SETTINGS } from '#core/canvas/grid'
import { DEFAULT_CANVAS_GUIDE_APPEARANCE } from '#core/canvas/guide-appearance'
import type { EditorState } from '#core/editor/types'
import { DEFAULT_DOCUMENT_UNITS } from '#core/units'

export function createDefaultEditorState(pageId: string): EditorState {
  return {
    activeTool: 'SELECT',
    currentPageId: pageId,
    selectedIds: new Set<string>(),
    marquee: null,
    snapGuides: [],
    rotationPreview: null,
    dropTargetId: null,
    layoutInsertIndicator: null,
    hoveredNodeId: null,
    editingTextId: null,
    penState: null,
    penCursorX: null,
    penCursorY: null,
    remoteCursors: [],
    autoLayoutHover: null,
    progressiveBlurEdit: null,
    gradientEdit: null,
    documentName: 'Untitled',
    showRulers: true,
    canvasGrid: { ...DEFAULT_CANVAS_GRID_SETTINGS },
    guideAppearance: structuredClone(DEFAULT_CANVAS_GUIDE_APPEARANCE),
    panX: 0,
    pageColor: { ...CANVAS_BG_COLOR },
    documentUnits: structuredClone(DEFAULT_DOCUMENT_UNITS),
    panY: 0,
    zoom: 1,
    renderVersion: 0,
    sceneVersion: 0,
    loading: false,
    enteredContainerId: null
  }
}
