import * as v from 'valibot'

import { nodeIdInput } from '#core/tools/input'
import { defineTool } from '#core/tools/schema'

export const setVisible = defineTool({
  name: 'set_visible',

  description:
    'Show or hide a node on the canvas. Returns {id, visible} showing the new boolean state. Hidden nodes and their children will not render or affect auto-layout.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    value: v.pipe(v.boolean(), v.description('Visible (true/false)'))
  }),
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.visible = value
    return { id, visible: value }
  }
})

export const setBlend = defineTool({
  name: 'set_blend',

  description:
    'Change how a node visually blends with the layers behind it. Returns {id, blendMode}. NORMAL is the default opaque mode.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    mode: v.pipe(
      v.picklist([
        'NORMAL',
        'DARKEN',
        'MULTIPLY',
        'COLOR_BURN',
        'LIGHTEN',
        'SCREEN',
        'COLOR_DODGE',
        'OVERLAY',
        'SOFT_LIGHT',
        'HARD_LIGHT',
        'DIFFERENCE',
        'EXCLUSION',
        'HUE',
        'SATURATION',
        'COLOR',
        'LUMINOSITY'
      ]),
      v.description('Blend mode')
    )
  }),
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.blendMode = mode
    return { id, blendMode: mode }
  }
})

export const setLocked = defineTool({
  name: 'set_locked',

  description:
    'Lock or unlock a node to prevent accidental edits. Returns {id, locked} with the new boolean state. Locked nodes cannot be selected directly on the canvas.',
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    value: v.pipe(v.boolean(), v.description('Locked (true/false)'))
  }),
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.locked = value
    return { id, locked: value }
  }
})

export const setStrokeAlign = defineTool({
  name: 'set_stroke_align',

  description:
    "Position a node's stroke relative to its boundary (inside, centre, or outside). Returns {id, strokeAlign}.",
  execution: { kind: 'sync', mutation: 'properties' },
  input: v.object({
    id: nodeIdInput,
    align: v.pipe(v.picklist(['INSIDE', 'CENTER', 'OUTSIDE']), v.description('Stroke alignment'))
  }),
  execute: (figma, { id, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.strokeAlign = align
    return { id, strokeAlign: align }
  }
})
