import * as v from 'valibot'

import { toolNumber } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const viewportGet = defineTool({
  name: 'viewport_get',
  description:
    'Retrieve the current viewport center position and zoom level. Returns {center: {x, y}, zoom}.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: v.object({}),
  execute: (figma) => {
    return figma.viewport
  }
})

export const viewportSet = defineTool({
  name: 'viewport_set',

  description:
    'Change the document viewport to a specific center position and zoom level. Returns {x, y, zoom}. This does not modify the document contents.',
  execution: { kind: 'sync', mutation: 'view' },
  input: v.object({
    x: toolNumber(v.pipe(v.number(), v.description('Center X'))),
    y: toolNumber(v.pipe(v.number(), v.description('Center Y'))),
    zoom: toolNumber(v.pipe(v.number(), v.minValue(0.01), v.description('Zoom level')))
  }),
  execute: (figma, { x, y, zoom }) => {
    figma.viewport = { center: { x, y }, zoom }
    return { x, y, zoom }
  }
})

export const viewportZoomToFit = defineTool({
  name: 'viewport_zoom_to_fit',

  description:
    'Adjust the viewport to encompass the bounding box of the specified nodes. Returns {center, bounds}. Useful for centering the view on a specific selection.',
  execution: { kind: 'sync', mutation: 'view' },
  input: v.object({
    ids: v.pipe(v.array(v.string()), v.minLength(1), v.description('Node IDs to fit in view'))
  }),
  execute: (figma, { ids }) => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const id of ids) {
      const node = figma.getNodeById(id)
      if (!node) continue
      const bounds = node.absoluteBoundingBox
      minX = Math.min(minX, bounds.x)
      minY = Math.min(minY, bounds.y)
      maxX = Math.max(maxX, bounds.x + bounds.width)
      maxY = Math.max(maxY, bounds.y + bounds.height)
    }
    if (minX === Infinity) return { error: 'No valid nodes found' }
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    figma.viewport = { center: { x: centerX, y: centerY }, zoom: 1 }
    return {
      center: { x: centerX, y: centerY },
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
  }
})
