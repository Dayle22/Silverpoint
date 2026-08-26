import type { Fill, NodeType, SceneNode } from '@open-pencil/scene-graph'

import {
  BLACK,
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE
} from '#core/constants'

import { createBarcodeActions } from './shapes/barcode'
import { createFramePresetActions } from './shapes/frame-presets'
import { createPenActions } from './shapes/pen'
import {
  adoptNodesIntoFrame as adoptNodesIntoFrameImpl,
  adoptNodesIntoSection as adoptNodesIntoSectionImpl
} from './shapes/section-adopt'
import type { EditorContext } from './types'
export type { PenDragOptions } from './shapes/pen'
export { getBarcodeMetadata, hasBarcodeConflict } from './shapes/barcode'

const BLACK_FILL: Fill = {
  type: 'SOLID',
  color: BLACK,
  opacity: 1,
  visible: true
}

const DEFAULT_FILLS: Record<string, Fill> = {
  FRAME: DEFAULT_FRAME_FILL,
  SECTION: SECTION_DEFAULT_FILL,
  RECTANGLE: DEFAULT_SHAPE_FILL,
  ELLIPSE: DEFAULT_SHAPE_FILL,
  POLYGON: DEFAULT_SHAPE_FILL,
  STAR: DEFAULT_SHAPE_FILL,
  LINE: BLACK_FILL,
  TEXT: BLACK_FILL
}

export function createShapeActions(ctx: EditorContext) {
  function createShape(
    type: NodeType,
    x: number,
    y: number,
    w: number,
    h: number,
    parentId?: string,
    name?: string
  ): string {
    const fill = DEFAULT_FILLS[type] ?? DEFAULT_FILLS.RECTANGLE
    const pid = parentId ?? ctx.state.currentPageId
    const overrides: Partial<SceneNode> = {
      x,
      y,
      width: w,
      height: h,
      fills: [{ ...fill }],
      ...(name ? { name } : {})
    }
    if (type === 'SECTION') {
      overrides.strokes = [{ ...SECTION_DEFAULT_STROKE }]
      overrides.cornerRadius = 5
    }
    if ((type as string) === 'SLICE') {
      overrides.fills = []
      overrides.exportSettings = [{ scale: 1, format: 'png' }]
    }
    if (type === 'POLYGON') {
      overrides.pointCount = 3
    }
    if (type === 'STAR') {
      overrides.pointCount = 5
      overrides.starInnerRadius = 0.38
    }
    const node = ctx.graph.createNode(type, pid, overrides)
    const id = node.id
    const snapshot = { ...node }
    ctx.undo.push({
      label: `Create ${type.toLowerCase()}`,
      forward: () => {
        ctx.graph.createNode(snapshot.type, pid, snapshot)
      },
      inverse: () => {
        ctx.graph.deleteNode(id)
        const next = new Set(ctx.state.selectedIds)
        next.delete(id)
        ctx.setSelectedIds(next)
      }
    })
    return id
  }

  const penActions = createPenActions(ctx, createShape)
  const framePresetActions = createFramePresetActions(ctx, createShape)
  const barcodeActions = createBarcodeActions(ctx)

  function setTool(tool: typeof ctx.state.activeTool) {
    ctx.setActiveTool(tool)
  }

  return {
    createShape,
    ...penActions,
    ...framePresetActions,
    ...barcodeActions,
    adoptNodesIntoSection: (sectionId: string) => adoptNodesIntoSectionImpl(ctx, sectionId),
    adoptNodesIntoFrame: (frameId: string) => adoptNodesIntoFrameImpl(ctx, frameId),
    setTool
  }
}
