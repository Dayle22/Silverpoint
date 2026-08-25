export { createDefaultEditorState, createEditor } from './create'
export type { Editor } from './create'
export { createTextActions } from './text'
export { fitTextBoxToContent, type FitTextEditorTarget } from './text/auto-resize'
export type { PageGuide, PageGuideAxis } from './pages'
export {
  DEFAULT_FRAME_GUIDES,
  FRAME_GUIDES_PLUGIN_KEY,
  FRAME_GUIDE_MAX,
  parseFrameGuides,
  setFrameGuideEdge,
  setFrameGuideLinked,
  upsertFrameGuides
} from '#core/guides/frame'
export type {
  FrameEdgeGuides,
  FrameGuideEdge,
  FrameGuideKind,
  FrameGuides
} from '#core/guides/frame'
export { EDITOR_TOOLS, TOOL_SHORTCUTS } from './tool-registry'
export type { EditorToolDef } from './tool-registry'
export {
  clearShapeBuilder,
  commitShapeBuilder,
  initializeShapeBuilder
} from './structure/shape-builder'
export { getBarcodeMetadata, hasBarcodeConflict, createBarcodeActions } from './shapes/barcode'
export {
  DEFAULT_DOCUMENT_UNITS,
  DPI_PRESETS,
  FRAME_PRESETS,
  formatUnitValue,
  normalizeDocumentUnits,
  pxPerUnit,
  pxToUnit,
  resolveUnitCommitPx,
  unitStepLadder,
  unitToPx
} from '#core/units'
export type { DocumentUnit, DocumentUnits, FramePresetDefinition, PresetGroup } from '#core/units'
export {
  DOCUMENT_UNITS_PLUGIN_ID,
  DOCUMENT_UNITS_PLUGIN_KEY,
  parseDocumentUnits,
  upsertDocumentUnits
} from '#core/units/document'
export type {
  EditorContext,
  EditorEventName,
  EditorEvents,
  EditorOptions,
  EditorState,
  Tool
} from './types'
export { createViewportAnimator, shouldAnimate } from './viewport-animation'
export type { ViewportAnimationOptions } from './viewport-animation'
export {
  CONTAINER_TYPES,
  CORNER_KEYS,
  LAYOUT_KEYS,
  PAINT_KEYS,
  STROKE_GEOMETRY_KEYS,
  TEXT_KEYS,
  applicablePropertiesFor,
  extractTransferableProperties
} from './properties/transfer'
export type { CopiedProperties } from './properties/transfer'
