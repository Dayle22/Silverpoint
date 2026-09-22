import * as v from 'valibot'

import type { FigmaNodeProxy } from '#core/figma-api'
import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeSummary, nodeToResult } from '#core/tools/schema'

interface TreeEntry {
  id: string
  type: string
  name: string
  w: number
  h: number
  children?: TreeEntry[]
}

function nodeToTreeEntry(
  node: FigmaNodeProxy,
  level: number,
  maxDepth?: number,
  typeFilter?: Set<string>
): TreeEntry | null {
  const children: TreeEntry[] = []
  if ((maxDepth === undefined || level < maxDepth) && node.children.length > 0) {
    for (const child of node.children) {
      const entry = nodeToTreeEntry(child, level + 1, maxDepth, typeFilter)
      if (entry) children.push(entry)
    }
  }

  const matches = !typeFilter || typeFilter.has(node.type)
  if (!matches && children.length === 0) return null

  const entry: TreeEntry = {
    id: node.id,
    type: node.type,
    name: node.name,
    w: node.width,
    h: node.height
  }
  if (children.length > 0) entry.children = children
  return entry
}

function countTreeEntries(entries: TreeEntry[]): number {
  let count = 0
  for (const entry of entries) {
    count++
    if (entry.children) count += countTreeEntries(entry.children)
  }
  return count
}

function truncateTreeEntries(
  entries: TreeEntry[],
  remaining: number
): { truncated: TreeEntry[]; used: number } {
  const result: TreeEntry[] = []
  let used = 0
  for (const entry of entries) {
    if (used >= remaining) break
    used++
    if (entry.children && used < remaining) {
      const { truncated: childResult, used: childUsed } = truncateTreeEntries(
        entry.children,
        remaining - used
      )
      used += childUsed
      result.push({ ...entry, children: childResult.length > 0 ? childResult : undefined })
    } else {
      result.push({ ...entry, children: undefined })
    }
  }
  return { truncated: result, used }
}

export const getPageTree = defineTool({
  name: 'get_page_tree',
  description:
    'Get a lightweight tree of nodes on the current page. Returns {page, children: [{id, type, name, w, h, children: [...]}]}. Use depth, root_id, node_types, or limit to keep output manageable. Use get_node for full properties.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    limit: v.optional(toolNumber(v.pipe(v.number(), v.integer(), v.minValue(1)))),
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.minValue(1),
          v.description(
            'Max nesting depth to return (1 = returned root nodes only). Default: unlimited'
          )
        )
      )
    ),
    root_id: v.optional(
      v.pipe(
        v.string(),
        v.description('Return only this node subtree instead of the whole current page')
      )
    ),
    node_types: v.optional(
      v.pipe(
        v.array(v.string()),
        v.minLength(1),
        v.description('Keep only these node types and their ancestors, for example FRAME or TEXT')
      )
    )
  }),
  execute: (figma, { depth, root_id, node_types, limit }) => {
    const maxNodes = limit ?? 500
    const typeFilter = node_types && node_types.length > 0 ? new Set(node_types) : undefined

    if (root_id !== undefined) {
      const root = figma.getNodeById(root_id)
      if (!root) return { error: `Node "${root_id}" not found` }
      const tree = nodeToTreeEntry(root, 1, depth, typeFilter)
      if (!tree) return { root: root.id, tree: null }
      const total = countTreeEntries([tree])
      if (total <= maxNodes) return { root: root.id, tree }
      const { truncated } = truncateTreeEntries([tree], maxNodes)
      return {
        root: root.id,
        tree: truncated[0],
        truncated: true,
        total,
        hint: 'Use depth, node_types, or a narrower root_id to reduce the result size.'
      }
    }

    const page = figma.currentPage
    const children: TreeEntry[] = []
    for (const child of page.children) {
      const entry = nodeToTreeEntry(child, 1, depth, typeFilter)
      if (entry) children.push(entry)
    }
    const total = countTreeEntries(children)
    if (total <= maxNodes) return { page: page.name, children }
    const { truncated } = truncateTreeEntries(children, maxNodes)
    return {
      page: page.name,
      children: truncated,
      truncated: true,
      total,
      hint: 'Use depth, root_id, or node_types to narrow the result.'
    }
  }
})

export const getNode = defineTool({
  name: 'get_node',
  description:
    'Get detailed properties of a single node by its ID. Returns a rich node object including styles, layout, and bounds. Use depth to limit child recursion (0 = node only, 1 = direct children, etc). Default: unlimited.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    id: nodeIdInput,
    depth: v.optional(
      toolNumber(
        v.pipe(
          v.number(),
          v.description('Max depth of children to include (0 = no children). Default: unlimited')
        )
      )
    )
  }),
  execute: (figma, { id, depth }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    return nodeToResult(node, depth)
  }
})

export const findNodes = defineTool({
  name: 'find_nodes',
  description:
    'Search the current page for nodes matching a name substring and/or type filter. Returns {count, total, nodes: [{id, name, type}]}. Case-insensitive name matching. Supports limit and offset for pagination. Use get_node on a result ID for full properties.',
  execution: { kind: 'sync', mutation: 'none' },
  input: v.object({
    limit: v.optional(toolNumber(v.pipe(v.number(), v.integer(), v.minValue(1)))),
    offset: v.optional(toolNumber(v.pipe(v.number(), v.integer(), v.minValue(0)))),
    name: v.optional(
      v.pipe(v.string(), v.description('Name substring to match (case-insensitive)'))
    ),
    type: v.optional(
      v.pipe(
        v.picklist([
          'FRAME',
          'RECTANGLE',
          'ELLIPSE',
          'TEXT',
          'LINE',
          'STAR',
          'POLYGON',
          'SECTION',
          'GROUP',
          'COMPONENT',
          'INSTANCE',
          'VECTOR'
        ]),
        v.description('Node type filter')
      )
    )
  }),
  execute: (figma, args) => {
    const page = figma.currentPage
    const matches = page.findAll((node) => {
      if (args.type && node.type !== args.type) return false
      if (args.name && !node.name.toLowerCase().includes(args.name.toLowerCase())) return false
      return true
    })
    const total = matches.length
    const offset = typeof args.offset === 'number' && args.offset >= 0 ? args.offset : 0
    const limit = typeof args.limit === 'number' && args.limit > 0 ? args.limit : 100
    const paged = matches.slice(offset, offset + limit)
    const result: {
      count: number
      total: number
      offset: number
      nodes: ReturnType<typeof nodeSummary>[]
      hasMore?: boolean
      hint?: string
    } = {
      count: paged.length,
      total,
      offset,
      nodes: paged.map(nodeSummary)
    }
    if (offset + paged.length < total) {
      result.hasMore = true
      result.hint = `Pass offset: ${offset + paged.length} to fetch the next batch.`
    }
    return result
  }
})
