import { defineTool } from '#core/tools/schema'

export const setVisible = defineTool({
  name: 'set_visible',
  mutates: true,
  description: 'Show or hide a node on the canvas. Returns {id, visible} showing the new boolean state. Hidden nodes and their children will not render or affect auto-layout.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Visible (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.visible = value
    return { id, visible: value }
  }
})

export const setBlend = defineTool({
  name: 'set_blend',
  mutates: true,
  description: 'Change how a node visually blends with the layers behind it. Returns {id, blendMode}. NORMAL is the default opaque mode.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    mode: {
      type: 'string',
      description: 'Blend mode',
      required: true,
      enum: [
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
      ]
    }
  },
  execute: (figma, { id, mode }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.blendMode = mode
    return { id, blendMode: mode }
  }
})

export const setLocked = defineTool({
  name: 'set_locked',
  mutates: true,
  description: 'Lock or unlock a node to prevent accidental edits. Returns {id, locked} with the new boolean state. Locked nodes cannot be selected directly on the canvas.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    value: { type: 'boolean', description: 'Locked (true/false)', required: true }
  },
  execute: (figma, { id, value }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.locked = value
    return { id, locked: value }
  }
})

export const setStrokeAlign = defineTool({
  name: 'set_stroke_align',
  mutates: true,
  description: 'Position a node\'s stroke relative to its boundary (inside, centre, or outside). Returns {id, strokeAlign}.',
  params: {
    id: { type: 'string', description: 'Node ID', required: true },
    align: {
      type: 'string',
      description: 'Stroke alignment',
      required: true,
      enum: ['INSIDE', 'CENTER', 'OUTSIDE']
    }
  },
  execute: (figma, { id, align }) => {
    const node = figma.getNodeById(id)
    if (!node) return { error: `Node "${id}" not found` }
    node.strokeAlign = align
    return { id, strokeAlign: align }
  }
})
