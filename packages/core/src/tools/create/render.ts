import { defineTool } from '#core/tools/schema'

export const render = defineTool({
  name: 'render',
  mutates: true,
  description:
    'Render JSX strings to design nodes. Returns {id, name, type, children, siblings?, warnings?}. Great for constructing complex layouts in one go. Supports inline SVG paths. Use replace_id to replace placeholders.',
  params: {
    replace_id: {
      type: 'string',
      description: 'Node ID to replace — new node takes its position in parent, old node is deleted'
    },
    parent_id: { type: 'string', description: 'Parent node ID to render into' },
    insert_index: {
      type: 'number',
      description: 'Position among siblings (0 = first child). Omit to append at end.'
    },
    x: { type: 'number', description: 'X position of the root node' },
    y: { type: 'number', description: 'Y position of the root node' },
    jsx: { type: 'string', description: 'JSX string to render', required: true }
  },
  execute: async (figma, args) => {
    const { renderJSX } = await import('#core/design-jsx/render.js')

    let parentId = args.parent_id ?? figma.currentPageId
    let replaceIndex = -1

    if (args.replace_id) {
      const target = figma.graph.getNode(args.replace_id)
      if (target?.parentId) {
        parentId = target.parentId
        const parent = figma.graph.getNode(parentId)
        if (parent) {
          replaceIndex = parent.childIds.indexOf(args.replace_id)
        }
      }
    }

    const results = await renderJSX(figma.graph, args.jsx, {
      parentId,
      x: args.x,
      y: args.y
    })
    const result = results[0]

    if (args.replace_id && replaceIndex >= 0) {
      figma.graph.reorderChild(result.id, parentId, replaceIndex)
      figma.graph.deleteNode(args.replace_id)
    } else if (args.insert_index !== undefined) {
      figma.graph.reorderChild(result.id, parentId, args.insert_index)
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      children: result.childIds,
      ...(result.warnings ? { warnings: result.warnings } : {}),
      ...(results.length > 1
        ? {
            siblings: results
              .slice(1)
              .map((node) => ({ id: node.id, name: node.name, type: node.type }))
          }
        : {})
    }
  }
})
