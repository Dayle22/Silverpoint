import * as v from 'valibot'

import { toolNumber, nodeIdInput } from '#core/tools/input'
import { defineTool, nodeNotFound } from '#core/tools/schema'

export const setRotation = defineTool({
  name: 'set_rotation',

  description:
    'Rotate a node around its centre point. Returns {id, rotation} showing the new angle. Use degrees (e.g. 90 for clockwise).',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    angle: toolNumber(v.pipe(v.number(), v.description('Rotation angle in degrees')))
  }),
  execute: (figma, { id, angle }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.rotation = angle
    return { id, rotation: angle }
  }
})

export const setOpacity = defineTool({
  name: 'set_opacity',

  description:
    'Change the transparency of a node. Returns {id, opacity} with the new value. The value must be between 0 (fully transparent) and 1 (fully opaque).',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    value: toolNumber(
      v.pipe(v.number(), v.minValue(0), v.maxValue(1), v.description('Opacity (0-1)'))
    )
  }),
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.opacity = value
    return { id, opacity: value }
  }
})

export const setRadius = defineTool({
  name: 'set_radius',

  description:
    'Round the corners of a node, either uniformly or independently per corner. Returns {id, cornerRadius} or individual corner radii. If you set a uniform radius, individual corner values are ignored.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    radius: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Corner radius for all corners')))
    ),
    top_left: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Top-left radius')))
    ),
    top_right: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Top-right radius')))
    ),
    bottom_right: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Bottom-right radius')))
    ),
    bottom_left: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Bottom-left radius')))
    )
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (args.radius !== undefined) {
      node.cornerRadius = args.radius
    }
    if (args.top_left !== undefined) node.topLeftRadius = args.top_left
    if (args.top_right !== undefined) node.topRightRadius = args.top_right
    if (args.bottom_right !== undefined) node.bottomRightRadius = args.bottom_right
    if (args.bottom_left !== undefined) node.bottomLeftRadius = args.bottom_left
    const cr = node.cornerRadius
    if (typeof cr === 'number') {
      return { id: args.id, cornerRadius: cr }
    }
    return {
      id: args.id,
      topLeftRadius: node.topLeftRadius,
      topRightRadius: node.topRightRadius,
      bottomRightRadius: node.bottomRightRadius,
      bottomLeftRadius: node.bottomLeftRadius
    }
  }
})

export const setMinMax = defineTool({
  name: 'set_minmax',

  description:
    'Apply minimum or maximum width and height limits to a node. Returns {id, minWidth, maxWidth, minHeight, maxHeight}. Only affects nodes inside auto-layout frames that can stretch or hug.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    min_width: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Minimum width')))
    ),
    max_width: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Maximum width')))
    ),
    min_height: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Minimum height')))
    ),
    max_height: v.optional(
      toolNumber(v.pipe(v.number(), v.minValue(0), v.description('Maximum height')))
    )
  }),
  execute: (figma, args) => {
    const node = figma.getNodeById(args.id)
    if (!node) return nodeNotFound(args.id)
    if (args.min_width !== undefined) node.minWidth = args.min_width
    if (args.max_width !== undefined) node.maxWidth = args.max_width
    if (args.min_height !== undefined) node.minHeight = args.min_height
    if (args.max_height !== undefined) node.maxHeight = args.max_height
    return {
      id: args.id,
      minWidth: node.minWidth,
      maxWidth: node.maxWidth,
      minHeight: node.minHeight,
      maxHeight: node.maxHeight
    }
  }
})
