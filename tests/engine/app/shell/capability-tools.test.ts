// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { EDITOR_TOOLS } from '@open-pencil/core/editor'
import { simpleToolSet } from '@/components/Toolbar/capability-tools'

describe('simpleToolSet', () => {
  test('returns exactly six entries in the fixed order', () => {
    const simple = simpleToolSet(EDITOR_TOOLS)
    expect(simple.length).toBe(6)
    expect(simple.map((t) => t.key)).toEqual([
      'SELECT',
      'FRAME',
      'RECTANGLE',
      'TEXT',
      'HAND',
      'PEN'
    ])
  })

  test('FRAME and RECTANGLE flyouts remain unchanged (T-027 guard)', () => {
    const simple = simpleToolSet(EDITOR_TOOLS)
    const frame = simple.find((t) => t.key === 'FRAME')
    const rect = simple.find((t) => t.key === 'RECTANGLE')

    const originalFrame = EDITOR_TOOLS.find((t) => t.key === 'FRAME')
    const originalRect = EDITOR_TOOLS.find((t) => t.key === 'RECTANGLE')

    expect(frame?.flyout).toEqual(originalFrame?.flyout)
    expect(frame?.flyout).toEqual(['FRAME', 'SECTION', 'SLICE'])
    expect(rect?.flyout).toEqual(originalRect?.flyout)
    expect(rect?.flyout).toEqual(['RECTANGLE', 'LINE', 'ELLIPSE', 'POLYGON', 'STAR'])
  })

  test('entry 6 has key PEN and collects all hidden tools into its flyout', () => {
    const simple = simpleToolSet(EDITOR_TOOLS)
    const penEntry = simple[5]

    expect(penEntry.key).toBe('PEN')
    expect(penEntry.flyout).toEqual([
      'PEN',
      'PENCIL',
      'BRUSH',
      'SHAPE_BUILDER',
      'BARCODE',
      'BARCODE_EAN13'
    ])
  })

  test('every key and flyout member across EDITOR_TOOLS is reachable somewhere in the Simple output', () => {
    const allOriginalTools = new Set<string>()
    for (const tool of EDITOR_TOOLS) {
      allOriginalTools.add(tool.key)
      if (tool.flyout) {
        for (const sub of tool.flyout) {
          allOriginalTools.add(sub)
        }
      }
    }

    const simple = simpleToolSet(EDITOR_TOOLS)
    const reachableInSimple = new Set<string>()
    for (const tool of simple) {
      reachableInSimple.add(tool.key)
      if (tool.flyout) {
        for (const sub of tool.flyout) {
          reachableInSimple.add(sub)
        }
      }
    }

    for (const tool of allOriginalTools) {
      expect(reachableInSimple.has(tool)).toBe(true)
    }
  })

  test('derives label and shortcut from input rather than hardcoding literals', () => {
    const customTools = EDITOR_TOOLS.map((t) => ({
      ...t,
      label: `Custom ${t.label}`,
      shortcut: `Custom ${t.shortcut}`
    }))

    const simple = simpleToolSet(customTools)
    for (const entry of simple) {
      const original = customTools.find((t) => t.key === entry.key)
      expect(entry.label).toBe(original?.label ?? '')
      expect(entry.shortcut).toBe(original?.shortcut ?? '')
    }
  })

  test('is total and does not throw for empty array or missing tools', () => {
    expect(simpleToolSet([])).toEqual([])

    const withoutPen = EDITOR_TOOLS.filter((t) => t.key !== 'PEN')
    const simpleWithoutPen = simpleToolSet(withoutPen)
    expect(simpleWithoutPen.map((t) => t.key)).toEqual([
      'SELECT',
      'FRAME',
      'RECTANGLE',
      'TEXT',
      'HAND'
    ])
  })
})
