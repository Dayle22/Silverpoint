import { defineTool } from '#core/tools/schema'
import { queryByXPath } from '#core/xpath'

export const queryNodes = defineTool({
  name: 'query_nodes',
  description: `Search the current page using XPath selectors. Returns {count, nodes: [{id, name, type}]}. Node types are element names (FRAME, TEXT). Attributes include width, height, x, y, text, etc. Example: //FRAME[@width < 300] or //TEXT[contains(@text, 'Hello')].`,
  params: {
    selector: { type: 'string', description: 'XPath selector', required: true },
    page: { type: 'string', description: 'Page name (default: current page)' },
    limit: { type: 'number', description: 'Max results (default: 1000)' }
  },
  execute: async (figma, args) => {
    try {
      const nodes = await queryByXPath(figma.graph, args.selector, {
        page: args.page ?? figma.currentPage.name,
        limit: args.limit
      })
      return {
        count: nodes.length,
        nodes: nodes.map((node) => ({ id: node.id, name: node.name, type: node.type }))
      }
    } catch (err) {
      return { error: `XPath error: ${err instanceof Error ? err.message : String(err)}` }
    }
  }
})
