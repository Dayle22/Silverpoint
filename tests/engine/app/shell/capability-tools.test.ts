// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- checked by Bun
import { describe, expect, test } from 'bun:test'

import { EDITOR_TOOLS } from '@open-pencil/core/editor'
import { essentialToolSet } from '@/components/Toolbar/capability-tools'

describe('essential toolset filtering', () => {
  test('derives 6 primary essential tools with collected pen flyout', () => {
    const essential = essentialToolSet(EDITOR_TOOLS)

    expect(essential.map((t) => t.key)).toEqual([
      'SELECT',
      'FRAME',
      'RECTANGLE',
      'TEXT',
      'HAND',
      'PEN'
    ])

    const pen = essential.find((t) => t.key === 'PEN')
    expect(pen?.flyout).toEqual([
      'PEN',
      'PENCIL',
      'BRUSH',
      'SHAPE_BUILDER',
      'BARCODE',
      'BARCODE_EAN13'
    ])
  })
})
