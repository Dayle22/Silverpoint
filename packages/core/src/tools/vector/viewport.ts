import { defineTool } from '#core/tools/schema'

export const viewportGet = defineTool({
  name: 'viewport_get',
  description: 'Retrieve the current viewport center position and zoom level. Returns {center: {x, y}, zoom}.',
  params: {},
  execute: (figma) => {
    return figma.viewport
  }
})

export const viewportSet = defineTool({
  name: 'viewport_set',
  mutates: true,
  changesDocument: false,
  description: 'Change the document viewport to a specific center position and zoom level. Returns {x, y, zoom}. This does not modify the document contents.',
  params: {
    x: { type: 'number', description: 'Center X', required: true },
    y: { type: 'number', description: 'Center Y', required: true },
    zoom: { type: 'number', description: 'Zoom level', required: true, min: 0.01 }
  },
  execute: (figma, { x, y, zoom }) => {
    figma.viewport = { center: { x, y }, zoom }
    return { x, y, zoom }
  }
})

export const viewportZoomToFit = defineTool({
  name: 'viewport_zoom_to_fit',
  mutates: true,
  changesDocument: false,
  description: 'Adjust the viewport to encompass the bounding box of the specified nodes. Returns {center, bounds}. Useful for centering the view on a specific selection.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to fit in view', required: true }
  },
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
