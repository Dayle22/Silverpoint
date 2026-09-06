import type { FigmaNodeProxy } from '#core/figma-api'
import { defineTool, nodeToResult } from '#core/tools/schema'

export const getSelection = defineTool({
  name: 'get_selection',
  description: 'Get full properties of every currently selected node on the active page. Returns {selection: [{id, name, type, width, height, fills, ...}]}. Returns an empty array if nothing is selected.',
  params: {},
  execute: (figma) => {
    const selection = figma.currentPage.selection
    return { selection: selection.map(nodeToResult) }
  }
})

export const selectNodes = defineTool({
  name: 'select_nodes',
  mutates: true,
  changesDocument: false,
  description: 'Select one or more nodes by ID. Clears previous selection. Operates on current page only. Returns {selected: [id, ...]}.',
  params: {
    ids: { type: 'string[]', description: 'Node IDs to select', required: true }
  },
  execute: (figma, { ids }) => {
    figma.currentPage.selection = ids
      .map((id) => figma.getNodeById(id))
      .filter((node): node is FigmaNodeProxy => node !== null)
    return { selected: ids }
  }
})
