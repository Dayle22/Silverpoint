import type { Fill, SceneGraph } from '@open-pencil/scene-graph'
import { getWorldMatrix } from '@open-pencil/scene-graph/coordinate'
import { readImagePixelSize } from '@open-pencil/scene-graph/images'
import type { ImageScaleMode } from '@open-pencil/scene-graph/types'

export interface EffectiveDpi {
  x: number | null
  y: number | null
  min: number | null
  sourceWidth: number | null
  sourceHeight: number | null
  scaleMode: ImageScaleMode
  belowThreshold: boolean
}

function sampleCropOrTileTransform(
  fill: Fill,
  imgW: number,
  imgH: number
): { sx: number; sy: number } | null {
  const t = fill.imageTransform
  if (!t) return null
  const det = t.m00 * t.m11 - t.m01 * t.m10
  if (Math.abs(det) < 1e-12) return null

  const inv00 = t.m11 / det
  const inv01 = -t.m01 / det
  const inv10 = -t.m10 / det
  const inv11 = t.m00 / det

  return {
    sx: Math.hypot(inv00 * imgW, inv10 * imgH),
    sy: Math.hypot(inv01 * imgW, inv11 * imgH)
  }
}

function sampleSourcePixels(
  scaleMode: ImageScaleMode,
  nodeWidth: number,
  nodeHeight: number,
  imgW: number,
  imgH: number,
  fill: Fill
): { sx: number; sy: number } | null {
  if (scaleMode === 'FILL' || scaleMode === 'FIT') {
    const scale =
      scaleMode === 'FILL'
        ? Math.max(nodeWidth / imgW, nodeHeight / imgH)
        : Math.min(nodeWidth / imgW, nodeHeight / imgH)
    return {
      sx: nodeWidth / scale,
      sy: nodeHeight / scale
    }
  }

  // Only CROP and TILE reach here, and both honour an explicit image transform.
  if (fill.imageTransform) {
    return sampleCropOrTileTransform(fill, imgW, imgH)
  }

  if (scaleMode === 'TILE') {
    return { sx: nodeWidth, sy: nodeHeight }
  }

  const fallbackScale = Math.max(nodeWidth / imgW, nodeHeight / imgH)
  return {
    sx: nodeWidth / fallbackScale,
    sy: nodeHeight / fallbackScale
  }
}

export function computeEffectiveDpi(
  graph: SceneGraph,
  nodeId: string,
  fillIndex: number,
  documentDpi: number,
  threshold: number
): EffectiveDpi {
  const defaultResult: EffectiveDpi = {
    x: null,
    y: null,
    min: null,
    sourceWidth: null,
    sourceHeight: null,
    scaleMode: 'FILL',
    belowThreshold: false
  }

  const node = graph.getNode(nodeId)
  if (!node) return defaultResult

  const fill = node.fills.at(fillIndex)
  if (fill?.type !== 'IMAGE') return defaultResult

  const scaleMode: ImageScaleMode = fill.imageScaleMode ?? 'FILL'
  defaultResult.scaleMode = scaleMode

  if (!fill.imageHash) return defaultResult
  const imageBytes = graph.images.get(fill.imageHash)
  if (!imageBytes) return defaultResult

  const size = readImagePixelSize(imageBytes)
  if (!size || size.width <= 0 || size.height <= 0) return defaultResult

  const imgW = size.width
  const imgH = size.height

  if (node.width <= 0 || node.height <= 0 || documentDpi <= 0) {
    return { ...defaultResult, sourceWidth: imgW, sourceHeight: imgH }
  }

  const worldMatrix = getWorldMatrix(node, graph)
  const sx = Math.hypot(worldMatrix[0], worldMatrix[3])
  const sy = Math.hypot(worldMatrix[1], worldMatrix[4])

  if (sx <= 0 || sy <= 0) {
    return { ...defaultResult, sourceWidth: imgW, sourceHeight: imgH }
  }

  const sampled = sampleSourcePixels(scaleMode, node.width, node.height, imgW, imgH, fill)
  if (!sampled) {
    return { ...defaultResult, sourceWidth: imgW, sourceHeight: imgH }
  }

  const dpiX = (sampled.sx / (node.width * sx)) * documentDpi
  const dpiY = (sampled.sy / (node.height * sy)) * documentDpi
  const roundX = Math.round(dpiX)
  const roundY = Math.round(dpiY)
  const minDpi = Math.min(roundX, roundY)

  return {
    x: roundX,
    y: roundY,
    min: minDpi,
    sourceWidth: imgW,
    sourceHeight: imgH,
    scaleMode,
    belowThreshold: minDpi < threshold
  }
}
