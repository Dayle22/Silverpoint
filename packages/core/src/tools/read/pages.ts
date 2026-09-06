import { computeBounds } from '@open-pencil/scene-graph/geometry'

import { defineTool } from '#core/tools/schema'

export const listPages = defineTool({
  name: 'list_pages',
  description: 'List all pages in the document. Returns {current, pages: [{id, name}]}. Use switch_page to navigate.',
  params: {},
  execute: (figma) => {
    const pages = figma.root.children
    return {
      current: figma.currentPage.name,
      pages: pages.map((page) => ({ id: page.id, name: page.name }))
    }
  }
})

export const switchPage = defineTool({
  name: 'switch_page',
  mutates: true,
  changesDocument: false,
  description: 'Switch the active page by name or ID. Returns {page, id}. Most tools only operate on the current active page, so use this first if you need to work elsewhere.',
  params: {
    page: { type: 'string', description: 'Page name or ID', required: true }
  },
  execute: (figma, { page }) => {
    const target =
      figma.root.children.find((candidate) => candidate.name === page) ?? figma.getNodeById(page)
    if (!target) return { error: `Page "${page}" not found` }
    figma.currentPage = target
    return { page: target.name, id: target.id }
  }
})

export const getCurrentPage = defineTool({
  name: 'get_current_page',
  description: 'Get the currently active page name and ID. Returns {id, name}. Most node tools operate within this active page context.',
  params: {},
  execute: (figma) => {
    return { id: figma.currentPage.id, name: figma.currentPage.name }
  }
})

export const pageBounds = defineTool({
  name: 'page_bounds',
  description: 'Calculate the total bounding box encompassing all objects on the current page. Returns {x, y, width, height}. Useful for understanding page scale and content limits.',
  params: {},
  execute: (figma) => {
    return computeBounds(figma.currentPage.children.map((child) => child.absoluteBoundingBox))
  }
})
