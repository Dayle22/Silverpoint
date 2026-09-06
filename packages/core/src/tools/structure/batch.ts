import { safeDestr } from 'destr'

import type { FigmaNodeProxy } from '#core/figma-api'
import { defineTool } from '#core/tools/schema'

interface BatchOperation {
  id: string
  props?: Record<string, unknown>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBatchOperation(value: unknown): value is BatchOperation {
  return isRecord(value) && typeof value.id === 'string'
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : 0
}

function applyBatchProps(node: FigmaNodeProxy, props: Record<string, unknown>): string[] {
  const updated: string[] = []

  if (props.spacing !== undefined) {
    node.itemSpacing = num(props.spacing)
    updated.push('spacing')
  }
  if (props.padding !== undefined) {
    const value = num(props.padding)
    node.paddingTop = value
    node.paddingRight = value
    node.paddingBottom = value
    node.paddingLeft = value
    updated.push('padding')
  }
  if (props.padding_horizontal !== undefined) {
    node.paddingLeft = num(props.padding_horizontal)
    node.paddingRight = num(props.padding_horizontal)
    updated.push('padding_horizontal')
  }
  if (props.padding_vertical !== undefined) {
    node.paddingTop = num(props.padding_vertical)
    node.paddingBottom = num(props.padding_vertical)
    updated.push('padding_vertical')
  }
  if (props.counter_align !== undefined) {
    node.counterAxisAlignItems = str(props.counter_align) as 'MIN' | 'CENTER' | 'MAX'
    updated.push('counter_align')
  }
  if (props.align !== undefined) {
    node.primaryAxisAlignItems = str(props.align)
    updated.push('align')
  }
  if (props.sizing_horizontal !== undefined) {
    node.layoutSizingHorizontal = str(props.sizing_horizontal) as 'FIXED' | 'HUG' | 'FILL'
    updated.push('sizing_horizontal')
  }
  if (props.sizing_vertical !== undefined) {
    node.layoutSizingVertical = str(props.sizing_vertical) as 'FIXED' | 'HUG' | 'FILL'
    updated.push('sizing_vertical')
  }
  if (props.grow !== undefined) {
    node.layoutGrow = num(props.grow)
    updated.push('grow')
  }
  if (props.name !== undefined) {
    node.name = str(props.name)
    updated.push('name')
  }
  if (props.visible !== undefined) {
    node.visible = Boolean(props.visible)
    updated.push('visible')
  }
  if (props.corner_radius !== undefined) {
    node.cornerRadius = num(props.corner_radius)
    updated.push('corner_radius')
  }
  if (props.opacity !== undefined) {
    node.opacity = num(props.opacity)
    updated.push('opacity')
  }
  if (props.auto_resize !== undefined) {
    node.textAutoResize = str(props.auto_resize)
    updated.push('auto_resize')
  }
  if (props.direction !== undefined) {
    node.layoutMode = str(props.direction) as 'HORIZONTAL' | 'VERTICAL'
    updated.push('direction')
  }

  return updated
}

export const batchUpdate = defineTool({
  name: 'batch_update',
  mutates: true,
  description:
    'Execute multiple modifications across different nodes in one call with a single layout recompute. Returns {updated: count, results: [{id, updated: []}], errors: []}.',
  returns: '{updated: number, results?: Array<{id: string, updated: string[]}>, errors?: string[]}',
  params: {
    operations: {
      type: 'json',
      description:
        'Array of operations (or JSON string): [{"id":"0:5","props":{"spacing":8}},{"id":"0:6","props":{"sizing_horizontal":"FILL","grow":1}}]',
      required: true
    }
  },
  execute: (figma, { operations }) => {
    let ops: unknown[]
    if (Array.isArray(operations)) {
      ops = operations
    } else if (typeof operations === 'string') {
      try {
        const parsed = safeDestr(operations)
        if (!Array.isArray(parsed)) return { error: 'operations must be a JSON array' }
        ops = parsed
      } catch {
        return { error: 'Invalid JSON in operations string' }
      }
    } else {
      return { error: 'operations must be an array of {id, props} objects or a JSON string' }
    }

    const results: Array<{ id: string; updated: string[] }> = []
    const errors: string[] = []

    for (const item of ops) {
      if (!isBatchOperation(item)) {
        errors.push('Each operation must have an "id" string and "props" object')
        continue
      }
      const node = figma.getNodeById(item.id)
      if (!node) {
        errors.push(`Node "${item.id}" not found`)
        continue
      }
      const rawProps = isRecord(item.props) ? item.props : {}
      const updated = applyBatchProps(node, rawProps)
      if (updated.length > 0) results.push({ id: item.id, updated })
    }

    const out: Record<string, unknown> = { updated: results.length }
    if (results.length > 0) out.results = results
    if (errors.length > 0) out.errors = errors
    return out
  }
})
