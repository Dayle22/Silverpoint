import type { SceneNode } from '@open-pencil/scene-graph'
import { copyFills, copyStrokes } from '@open-pencil/scene-graph/copy'
import { parseSVGPath } from '@open-pencil/scene-graph/parse-path'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import type { CanvasKit, Path } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas'
import { canMakeBooleanSourceNode, makeBooleanSourcePath, nodePathTransform } from '#core/canvas/boolean'
import { restoreSubtree, snapshotSubtree } from '#core/editor/clipboard/subtree-history'
import type { EditorContext } from '#core/editor/types'

import { selectedNodesInSharedParent } from './selection'

export interface ShapeBuilderRegion {
  id: string
  path: Path
  sourceNodeIds: string[]
  hovered: boolean
  dragged: boolean
}

let regionIdCounter = 0
export function unwrapPath<T>(path: T): T {
  if (!path) return path
  let current: unknown = path
  while (current && typeof current === 'object' && '__v_raw' in (current as { __v_raw?: unknown })) {
    current = (current as { __v_raw?: unknown }).__v_raw
  }
  return current as T
}

function generateRegionId(): string {
  regionIdCounter += 1
  return `sb_region_${regionIdCounter}`
}

function isPathNonEmpty(path: Path | null | undefined): boolean {
  if (!path || path.isEmpty()) return false
  const bounds = path.getBounds()
  const width = bounds[2] - bounds[0]
  const height = bounds[3] - bounds[1]
  return width > 0.01 && height > 0.01
}

function transformPath(ck: CanvasKit, path: Path, matrix: number[]): Path {
  const builder = new ck.PathBuilder()
  builder.addPath(path, matrix)
  return builder.detachAndDelete()
}

interface SelectionTarget {
  setSelectedIds?: (ids: Set<string>) => void
  select?: (ids: string[]) => void
  state?: { selectedIds?: Set<string> }
}

function setSelection(ctx: EditorContext | SelectionTarget, ids: Set<string>): void {
  const target = ctx as SelectionTarget
  if (typeof target.setSelectedIds === 'function') {
    target.setSelectedIds(ids)
  } else if (typeof target.select === 'function') {
    target.select(Array.from(ids))
  } else if (target.state) {
    target.state.selectedIds = ids
  }
}

interface RendererTarget {
  getRenderer?: () => SkiaRenderer | null
  renderer?: SkiaRenderer | null
}

function getRendererFromCtx(ctx: EditorContext): SkiaRenderer | null {
  const target = ctx as RendererTarget
  if (typeof target.getRenderer === 'function') {
    return target.getRenderer() ?? null
  }
  return target.renderer ?? null
}

export function decomposePathsIntoRegions(
  renderer: NonNullable<ReturnType<EditorContext['getRenderer']>>,
  sourceInputs: Array<{ node: SceneNode; path: Path }>
): ShapeBuilderRegion[] {
  const ck = renderer.ck
  let currentRegions: Array<{ path: Path; sourceNodeIds: Set<string> }> = []

  for (const input of sourceInputs) {
    const nodeId = input.node.id
    const inputPath = input.path

    if (currentRegions.length === 0) {
      if (isPathNonEmpty(inputPath)) {
        currentRegions.push({
          path: inputPath.copy(),
          sourceNodeIds: new Set([nodeId])
        })
      }
      continue
    }

    let inputRemainder: Path | null = inputPath.copy()
    const nextRegions: Array<{ path: Path; sourceNodeIds: Set<string> }> = []

    for (const region of currentRegions) {
      const intersectPath = ck.Path.MakeFromOp(region.path, inputPath, ck.PathOp.Intersect)
      const diffRegionPath = ck.Path.MakeFromOp(region.path, inputPath, ck.PathOp.Difference)

      if (inputRemainder) {
        const nextRemainder = ck.Path.MakeFromOp(inputRemainder, region.path, ck.PathOp.Difference)
        inputRemainder.delete()
        if (nextRemainder && isPathNonEmpty(nextRemainder)) {
          inputRemainder = nextRemainder
        } else {
          nextRemainder?.delete()
          inputRemainder = null
        }
      }

      if (intersectPath && isPathNonEmpty(intersectPath)) {
        const combinedIds = new Set(region.sourceNodeIds)
        combinedIds.add(nodeId)
        nextRegions.push({
          path: intersectPath,
          sourceNodeIds: combinedIds
        })
      } else {
        intersectPath?.delete()
      }

      if (diffRegionPath && isPathNonEmpty(diffRegionPath)) {
        nextRegions.push({
          path: diffRegionPath,
          sourceNodeIds: new Set(region.sourceNodeIds)
        })
      } else {
        diffRegionPath?.delete()
      }

      region.path.delete()
    }

    if (inputRemainder) {
      if (isPathNonEmpty(inputRemainder)) {
        nextRegions.push({
          path: inputRemainder,
          sourceNodeIds: new Set([nodeId])
        })
      } else {
        inputRemainder.delete()
      }
    }

    currentRegions = nextRegions
  }

  return currentRegions.map((r) => {
    const rawPath = unwrapPath(r.path)
    ;(rawPath as { __v_skip?: boolean }).__v_skip = true
    return {
      id: generateRegionId(),
      path: rawPath,
      sourceNodeIds: Array.from(r.sourceNodeIds),
      hovered: false,
      dragged: false
    }
  })
}

export function initializeShapeBuilder(ctx: EditorContext): boolean {
  clearShapeBuilder(ctx)

  if (ctx.state.activeTool !== 'SHAPE_BUILDER') {
    return false
  }

  const renderer = getRendererFromCtx(ctx)
  if (!renderer) return false

  const selectedNodes = Array.from(ctx.state.selectedIds)
    .map((id) => ctx.graph.getNode(id))
    .filter((node): node is SceneNode => node != null && canMakeBooleanSourceNode(node, ctx.graph))

  if (selectedNodes.length === 0) {
    ctx.state.shapeBuilderState = null
    return false
  }

  const sourceInputs: Array<{ node: SceneNode; path: Path }> = []

  for (const node of selectedNodes) {
    const nodePath = makeBooleanSourcePath(renderer, node, ctx.graph)
    if (!nodePath) continue

    const absPos = ctx.graph.getAbsolutePosition(node.id)
    const localTransform = nodePathTransform(renderer, node)
    const worldTransform = renderer.ck.Matrix.multiply(
      renderer.ck.Matrix.translated(absPos.x - node.x, absPos.y - node.y),
      localTransform
    )
    const transformedPath = transformPath(renderer.ck, nodePath, worldTransform)
    nodePath.delete()

    if (isPathNonEmpty(transformedPath)) {
      sourceInputs.push({ node, path: transformedPath })
    } else {
      transformedPath.delete()
    }
  }

  if (sourceInputs.length === 0) {
    ctx.state.shapeBuilderState = null
    return false
  }

  const regions = decomposePathsIntoRegions(renderer, sourceInputs)

  for (const input of sourceInputs) {
    unwrapPath(input.path).delete()
  }

  for (const r of regions) {
    try {
      Object.defineProperty(r, '__v_skip', { value: true, configurable: true, writable: true })
      Object.defineProperty(r.path, '__v_skip', { value: true, configurable: true, writable: true })
    } catch (_err) {
      void _err
    }
  }

  const shapeBuilderState = {
    regions,
    isDeleteMode: false
  }
  try {
    Object.defineProperty(shapeBuilderState, '__v_skip', { value: true, configurable: true, writable: true })
  } catch (_err) {
    void _err
  }

  ctx.state.shapeBuilderState = shapeBuilderState

  return true
}

export function clearShapeBuilder(ctx: EditorContext): void {
  if (ctx.state.shapeBuilderState?.regions) {
    for (const region of ctx.state.shapeBuilderState.regions) {
      unwrapPath(region.path).delete()
    }
  }
  ctx.state.shapeBuilderState = null
}

type VectorPropItem = {
  name: string
  x: number
  y: number
  width: number
  height: number
  fills: SceneNode['fills']
  strokes: SceneNode['strokes']
  vectorNetwork: ReturnType<typeof parseSVGPath>
}

function buildMergedVectorProp(
  ck: CanvasKit,
  draggedRegions: ShapeBuilderRegion[],
  sourceNodeMap: Map<string, SceneNode>,
  defaultSourceNode: SceneNode,
  parentAbs: Vector
): VectorPropItem | null {
  if (draggedRegions.length === 0) return null
  let mergedPath: Path | null = unwrapPath(draggedRegions[0].path).copy()
  for (let i = 1; i < draggedRegions.length; i++) {
    const nextMerged = ck.Path.MakeFromOp(mergedPath, unwrapPath(draggedRegions[i].path), ck.PathOp.Union)
    mergedPath.delete()
    mergedPath = nextMerged
    if (!mergedPath) break
  }

  let result: VectorPropItem | null = null
  if (mergedPath && isPathNonEmpty(mergedPath)) {
    const bounds = mergedPath.getBounds()
    const minX = bounds[0]
    const minY = bounds[1]
    const width = bounds[2] - bounds[0]
    const height = bounds[3] - bounds[1]

    const offsetPath = transformPath(ck, mergedPath, ck.Matrix.translated(-minX, -minY))
    const vectorNetwork = parseSVGPath(offsetPath.toSVGString())
    offsetPath.delete()

    const primarySourceId = draggedRegions[0].sourceNodeIds[0]
    const primarySource = sourceNodeMap.get(primarySourceId) ?? defaultSourceNode

    result = {
      name: 'Combined Shape',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width,
      height,
      fills: copyFills(primarySource.fills),
      strokes: copyStrokes(primarySource.strokes),
      vectorNetwork
    }
  }
  mergedPath?.delete()
  return result
}

function buildNonDraggedVectorProps(
  ck: CanvasKit,
  nonDraggedRegions: ShapeBuilderRegion[],
  sourceNodeMap: Map<string, SceneNode>,
  defaultSourceNode: SceneNode,
  parentAbs: Vector
): VectorPropItem[] {
  const result: VectorPropItem[] = []
  for (const region of nonDraggedRegions) {
    const rawPath = unwrapPath(region.path)
    if (!isPathNonEmpty(rawPath)) continue
    const bounds = rawPath.getBounds()
    const minX = bounds[0]
    const minY = bounds[1]
    const width = bounds[2] - bounds[0]
    const height = bounds[3] - bounds[1]

    const offsetPath = transformPath(ck, rawPath, ck.Matrix.translated(-minX, -minY))
    const vectorNetwork = parseSVGPath(offsetPath.toSVGString())
    offsetPath.delete()

    const primarySourceId = region.sourceNodeIds[0]
    const primarySource = sourceNodeMap.get(primarySourceId) ?? defaultSourceNode

    result.push({
      name: 'Shape Region',
      x: minX - parentAbs.x,
      y: minY - parentAbs.y,
      width,
      height,
      fills: copyFills(primarySource.fills),
      strokes: copyStrokes(primarySource.strokes),
      vectorNetwork
    })
  }
  return result
}

export function commitShapeBuilder(
  ctx: EditorContext,
  draggedRegionIds: Set<string>,
  isDeleteMode: boolean
): string[] | null {
  const sbState = ctx.state.shapeBuilderState
  if (!sbState || sbState.regions.length === 0) return null

  const renderer = getRendererFromCtx(ctx)
  if (!renderer) return null
  const ck = renderer.ck

  const selectedNodes = Array.from(ctx.state.selectedIds)
    .map((id) => ctx.graph.getNode(id))
    .filter((node): node is SceneNode => node != null)

  const selection = selectedNodesInSharedParent(ctx, selectedNodes)
  if (!selection || selection.topLevel.length === 0) return null

  const { topLevel, parentId, parent } = selection
  const childIds = topLevel.map((node) => node.id)
  const childSnapshots = childIds.map((id) => ({ id, subtree: snapshotSubtree(ctx.graph, id) }))
  const prevSelection = new Set(ctx.state.selectedIds)
  const firstIndex = Math.min(...childIds.map((id) => parent.childIds.indexOf(id)))
  const parentAbs = parentId ? ctx.graph.getAbsolutePosition(parentId) : { x: 0, y: 0 }

  const draggedRegions = sbState.regions.filter((r) => draggedRegionIds.has(r.id))
  const nonDraggedRegions = sbState.regions.filter((r) => !draggedRegionIds.has(r.id))

  const sourceNodeMap = new Map<string, SceneNode>()
  for (const node of selectedNodes) {
    sourceNodeMap.set(node.id, node)
  }
  const defaultSourceNode = selectedNodes[0]

  const newVectorProps: VectorPropItem[] = []
  if (!isDeleteMode) {
    const mergedProp = buildMergedVectorProp(ck, draggedRegions, sourceNodeMap, defaultSourceNode, parentAbs)
    if (mergedProp) newVectorProps.push(mergedProp)
  }
  newVectorProps.push(...buildNonDraggedVectorProps(ck, nonDraggedRegions, sourceNodeMap, defaultSourceNode, parentAbs))

  clearShapeBuilder(ctx)

  if (newVectorProps.length === 0) {
    for (const id of childIds) ctx.graph.deleteNode(id)
    setSelection(ctx, new Set())
    return []
  }

  const createdNodeIds: string[] = []
  for (let i = 0; i < newVectorProps.length; i++) {
    const props = newVectorProps[i]
    const createdNode = ctx.graph.createNode('VECTOR', parentId, props)
    ctx.graph.insertChildAt(createdNode.id, parentId, firstIndex + i)
    createdNodeIds.push(createdNode.id)
  }

  for (const id of childIds) {
    ctx.graph.deleteNode(id)
  }

  setSelection(ctx, new Set(createdNodeIds))

  const createdSnapshots = createdNodeIds.map((id) => {
    const node = ctx.graph.getNode(id)
    return node ? structuredClone(node) : null
  }).filter((n): n is SceneNode => n !== null)

  const transactionLabel = isDeleteMode ? 'Shape Builder Delete' : 'Shape Builder Merge'

  ctx.undo.push({
    label: transactionLabel,
    forward: () => {
      for (let i = 0; i < createdSnapshots.length; i++) {
        const snap = createdSnapshots[i]
        const restored = ctx.graph.createNode('VECTOR', parentId, snap)
        ctx.graph.insertChildAt(restored.id, parentId, firstIndex + i)
      }
      for (const id of childIds) ctx.graph.deleteNode(id)
      setSelection(ctx, new Set(createdNodeIds))
    },
    inverse: () => {
      createdNodeIds.forEach((id) => ctx.graph.deleteNode(id))
      childSnapshots.forEach((item, index) => {
        const root = item.subtree.get(item.id)
        if (!root) return
        restoreSubtree(ctx.graph, root, parentId, item.subtree)
        ctx.graph.insertChildAt(item.id, parentId, firstIndex + index)
      })
      setSelection(ctx, prevSelection)
    }
  })

  return createdNodeIds
}
