import { createTwoFilesPatch } from 'diff'
import * as v from 'valibot'

import { sceneNodeToJSX } from '#core/io/formats/jsx'
import { nodeIdInput, nodeComparisonInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

const MAX_JSX_LENGTH = 12_000

export const getJSX = defineTool({
  name: 'get_jsx',
  description:
    'Get a JSX string representation of a node and its children. Returns {id, name, jsx}. Compact round-trip format using the same syntax as the render tool. Will be truncated if over 12000 characters.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    id: nodeIdInput,
    path: v.optional(
      v.pipe(
        v.string(),
        v.description(
          'Write JSX to this path instead of returning it (requires OPENPENCIL_MCP_ROOT)'
        )
      )
    )
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const jsx = sceneNodeToJSX(id, figma.graph)
    if (jsx.length > MAX_JSX_LENGTH) {
      return {
        id,
        name: node.name,
        jsx: jsx.slice(0, MAX_JSX_LENGTH),
        truncated: true,
        totalLength: jsx.length
      }
    }
    return { id, name: node.name, jsx }
  }
})

export const diffJSX = defineTool({
  name: 'diff_jsx',
  description:
    'Compute a structural diff between two nodes in JSX format. Returns {diff} containing a unified patch string. Useful for seeing added/removed children and changed properties between versions.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeComparisonInput,
  execute: (figma, { from, to }) => {
    const fromNode = figma.getNodeById(from)
    if (!fromNode) return { error: `Node "${from}" not found` }
    const toNode = figma.getNodeById(to)
    if (!toNode) return { error: `Node "${to}" not found` }

    const fromJSX = sceneNodeToJSX(from, figma.graph)
    const toJSX = sceneNodeToJSX(to, figma.graph)

    if (fromJSX === toJSX) return { diff: null, message: 'No differences' }

    const patch = createTwoFilesPatch(
      fromNode.name,
      toNode.name,
      fromJSX,
      toJSX,
      'source',
      'target',
      { context: 3 }
    )
    return { diff: patch }
  }
})
