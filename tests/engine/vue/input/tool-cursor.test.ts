import { expect, test } from 'bun:test'

import { toolCursor } from '@open-pencil/vue'

test('tool cursors keep precise native defaults and interaction overrides', () => {
  expect(toolCursor('TEXT')).toBe('text')
  expect(toolCursor('HAND')).toBe('grab')
  expect(toolCursor('SHAPE_BUILDER')).toBe('cell')
  expect(toolCursor('SHAPE_BUILDER', 'grabbing')).toBe('grabbing')
  expect(toolCursor('RECTANGLE', 'nwse-resize')).toBe('nwse-resize')
})
