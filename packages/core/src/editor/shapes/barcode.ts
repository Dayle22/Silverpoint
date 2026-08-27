import { safeDestr } from 'destr'
import type { SceneGraph, SceneNode } from '@open-pencil/scene-graph'

import {
  BARCODE_METADATA_VERSION,
  BARCODE_PLUGIN_KEY,
  BARCODE_ROLE_PLUGIN_KEY,
  generateBarcodePlan,
  type BarcodeMetadata,
  type BarcodeOptions,
  type BarcodePlan
} from '#core/barcode'
import { getPluginData, setPluginData } from '#core/figma-api/plugin-data'
import type { EditorContext } from '#core/editor/types'

export function getBarcodeMetadata(node: SceneNode): BarcodeMetadata | null {
  const raw = getPluginData(node, BARCODE_PLUGIN_KEY)
  if (!raw) return null
  try {
    const parsed = safeDestr(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'v' in parsed &&
      parsed.v === BARCODE_METADATA_VERSION &&
      'options' in parsed &&
      'payload' in parsed &&
      'type' in parsed
    ) {
      return parsed as BarcodeMetadata
    }
  } catch {
    return null
  }
  return null
}

export function hasBarcodeConflict(ctx: { graph: SceneGraph }, frameId: string): string | null {
  const node = ctx.graph.getNode(frameId)
  if (!node) return 'Node not found'
  if (node.type !== 'FRAME') return 'Node is not a frame'

  const metadata = getBarcodeMetadata(node)
  if (!metadata) {
    const raw = getPluginData(node, BARCODE_PLUGIN_KEY)
    return raw ? 'Malformed or corrupt barcode metadata' : 'Not a barcode frame'
  }

  const children = ctx.graph.getChildren(frameId)
  for (const child of children) {
    const role = getPluginData(child, BARCODE_ROLE_PLUGIN_KEY)
    if (!role || (role !== 'modules' && role !== 'background' && role !== 'text')) {
      return `Frame contains non-generator layer: "${child.name}"`
    }
  }

  return null
}

function insertBarcodeChildren(ctx: EditorContext, frameId: string, plan: BarcodePlan): void {
  for (const child of plan.children) {
    if (child.role === 'text') {
      const textNode = ctx.graph.createNode('TEXT', frameId, {
        name: child.name,
        text: child.text,
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
        fontSize: child.fontSize,
        textAlignHorizontal: 'CENTER',
        fills: child.fills
      })
      setPluginData(ctx.graph, textNode, BARCODE_ROLE_PLUGIN_KEY, child.role)
      const freshText = ctx.graph.getNode(textNode.id)
      if (freshText) {
        const childSnapshot = { ...freshText }
        ctx.undo.push({
          label: 'Create barcode digits layer',
          forward: () => {
            ctx.graph.createNode('TEXT', frameId, childSnapshot)
          },
          inverse: () => {
            ctx.graph.deleteNode(textNode.id)
          }
        })
      }
    } else {
      const vectorNode = ctx.graph.createNode('VECTOR', frameId, {
        name: child.name,
        x: 0,
        y: 0,
        width: plan.width,
        height: plan.height,
        vectorNetwork: child.vectorNetwork,
        fills: child.fills
      })
      setPluginData(ctx.graph, vectorNode, BARCODE_ROLE_PLUGIN_KEY, child.role)
      const freshVector = ctx.graph.getNode(vectorNode.id)
      if (freshVector) {
        const childSnapshot = { ...freshVector }
        ctx.undo.push({
          label: `Create ${child.role} layer`,
          forward: () => {
            ctx.graph.createNode('VECTOR', frameId, childSnapshot)
          },
          inverse: () => {
            ctx.graph.deleteNode(vectorNode.id)
          }
        })
      }
    }
  }
}

export function createBarcodeActions(ctx: EditorContext) {
  function getCreationPoint(width: number, height: number, parentId?: string) {
    const pid = parentId ?? ctx.state.enteredContainerId ?? ctx.state.currentPageId
    const viewportSize = ctx.getViewportSize()
    const zoom = ctx.state.zoom || 1
    const centerCanvasX = -ctx.state.panX / zoom + viewportSize.width / (2 * zoom)
    const centerCanvasY = -ctx.state.panY / zoom + viewportSize.height / (2 * zoom)
    const parentPos = ctx.graph.getAbsolutePosition(pid)

    return {
      x: Math.round(centerCanvasX - parentPos.x - width / 2),
      y: Math.round(centerCanvasY - parentPos.y - height / 2),
      parentId: pid
    }
  }

  function createBarcode(
    options: BarcodeOptions,
    x?: number,
    y?: number,
    parentId?: string
  ): string {
    const plan: BarcodePlan = generateBarcodePlan(options)
    const point =
      x !== undefined && y !== undefined
        ? { x, y, parentId: parentId ?? ctx.state.enteredContainerId ?? ctx.state.currentPageId }
        : getCreationPoint(plan.width, plan.height, parentId)

    const label = plan.type === 'QR_CODE' ? 'Create QR code' : 'Create EAN-13 barcode'
    ctx.undo.beginBatch(label)

    const frame = ctx.graph.createNode('FRAME', point.parentId, {
      name: plan.type === 'QR_CODE' ? 'QR Code' : 'EAN-13 Barcode',
      x: point.x,
      y: point.y,
      width: plan.width,
      height: plan.height,
      fills: []
    })

    setPluginData(ctx.graph, frame, BARCODE_PLUGIN_KEY, JSON.stringify(plan.metadata))

    const freshFrame = ctx.graph.getNode(frame.id)
    if (freshFrame) {
      const frameSnapshot = { ...freshFrame }
      ctx.undo.push({
        label: 'Create barcode frame',
        forward: () => {
          ctx.graph.createNode(frameSnapshot.type, point.parentId, frameSnapshot)
        },
        inverse: () => {
          ctx.graph.deleteNode(frame.id)
        }
      })
    }

    insertBarcodeChildren(ctx, frame.id, plan)

    ctx.setSelectedIds(new Set([frame.id]))
    ctx.setActiveTool('SELECT')
    ctx.undo.commitBatch()
    ctx.requestRender()

    return frame.id
  }

  function regenerateBarcode(frameId: string, options: BarcodeOptions): void {
    const conflict = hasBarcodeConflict(ctx, frameId)
    if (conflict) {
      throw new Error(`Cannot regenerate barcode: ${conflict}`)
    }

    const frame = ctx.graph.getNode(frameId)
    if (!frame) throw new Error('Frame not found')

    const plan: BarcodePlan = generateBarcodePlan(options)
    const label = plan.type === 'QR_CODE' ? 'Regenerate QR code' : 'Regenerate EAN-13 barcode'

    ctx.undo.beginBatch(label)

    const oldWidth = frame.width
    const oldHeight = frame.height
    const oldPluginData = [...frame.pluginData]

    ctx.graph.updateNode(frameId, { width: plan.width, height: plan.height })
    setPluginData(ctx.graph, frame, BARCODE_PLUGIN_KEY, JSON.stringify(plan.metadata))

    const freshUpdatedFrame = ctx.graph.getNode(frameId)
    const newPluginData = freshUpdatedFrame ? [...freshUpdatedFrame.pluginData] : []
    ctx.undo.push({
      label: 'Update barcode metadata and bounds',
      forward: () => {
        ctx.graph.updateNode(frameId, {
          width: plan.width,
          height: plan.height,
          pluginData: newPluginData
        })
      },
      inverse: () => {
        ctx.graph.updateNode(frameId, {
          width: oldWidth,
          height: oldHeight,
          pluginData: oldPluginData
        })
      }
    })

    // Delete existing generator-owned children
    const existingChildren = ctx.graph.getChildren(frameId)
    for (const child of existingChildren) {
      const childSnapshot = { ...child }
      const childId = child.id
      ctx.graph.deleteNode(childId)
      ctx.undo.push({
        label: `Delete ${child.name}`,
        forward: () => {
          ctx.graph.deleteNode(childId)
        },
        inverse: () => {
          ctx.graph.createNode(childSnapshot.type, frameId, childSnapshot)
        }
      })
    }

    insertBarcodeChildren(ctx, frameId, plan)

    ctx.undo.commitBatch()
    ctx.requestRender()
  }

  return {
    createBarcode,
    regenerateBarcode,
    getBarcodeMetadata: (node: SceneNode) => getBarcodeMetadata(node),
    hasBarcodeConflict: (frameId: string) => hasBarcodeConflict(ctx, frameId)
  }
}
