import * as v from 'valibot'

import { toolNumber, nodeIdInput, nodeInput } from '#core/tools/input'
import { defineTool, nodeNotFound, nodeSummary } from '#core/tools/schema'

export const deleteNode = defineTool({
  name: 'delete_node',

  description:
    'Delete a specific node from the canvas by its ID. Returns {deleted} with the ID if successful.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Node ID to delete'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.remove()
    return { deleted: id }
  }
})

export const cloneNode = defineTool({
  name: 'clone_node',

  description:
    'Duplicate an existing node by its ID on the canvas. Returns {id, name, type} of the newly created clone.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: v.pipe(v.string(), v.description('Node ID to clone'))
  }),
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    const clone = node.clone()
    return nodeSummary(clone)
  }
})

export const renameNode = defineTool({
  name: 'rename_node',

  description:
    'Change the name of a node as it appears in the layers panel. Returns {id, name} of the updated node.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    name: v.pipe(v.string(), v.description('New name'))
  }),
  execute: (figma, { id, name }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.name = name
    return { id, name }
  }
})

export const nodeBounds = defineTool({
  name: 'node_bounds',
  description:
    'Get the absolute bounding box coordinates (x, y, width, height) of a node. Returns {id, bounds}.',
  execution: { kind: 'sync', mutation: 'none' },
  exposure: { webmcp: false },
  input: nodeInput,
  execute: (figma, { id }) => {
    const node = figma.getNodeById(id)
    return node ? { id, bounds: node.absoluteBoundingBox } : nodeNotFound(id)
  }
})

export const nodeMove = defineTool({
  name: 'node_move',

  description: 'Move a node to new absolute X and Y coordinates on the canvas. Returns {id, x, y}.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    x: toolNumber(v.pipe(v.number(), v.description('X position'))),
    y: toolNumber(v.pipe(v.number(), v.description('Y position')))
  }),
  execute: (figma, { id, x, y }) => {
    const node = figma.getNodeById(id)
    if (!node) return nodeNotFound(id)
    node.x = x
    node.y = y
    return { id, x, y }
  }
})

export const nodeResize = defineTool({
  name: 'node_resize',

  description: 'Change the width and height of a node. Returns {id, width, height}.',
  execution: { kind: 'sync', mutation: 'document' },
  input: v.object({
    id: nodeIdInput,
    width: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Width'))),
    height: toolNumber(v.pipe(v.number(), v.minValue(1), v.description('Height')))
  }),
  execute: (figma, { id, width, height }) => {
    const node = figma.getNodeById(id)
    if (!node) return nodeNotFound(id)
    node.resize(width, height)
    return { id, width, height }
  }
})
