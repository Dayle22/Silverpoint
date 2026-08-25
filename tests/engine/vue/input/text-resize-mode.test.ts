import { describe, expect, test } from 'bun:test'

import { textResizeModeForHandle } from '#vue/shared/input/resize'

describe('text resize mode transitions', () => {
  const text = (textAutoResize: 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'NONE' | 'TRUNCATE') => ({
    type: 'TEXT' as const,
    textAutoResize
  })

  test('horizontal side resize converts auto width to auto height', () => {
    expect(textResizeModeForHandle(text('WIDTH_AND_HEIGHT'), 'e')).toBe('HEIGHT')
    expect(textResizeModeForHandle(text('WIDTH_AND_HEIGHT'), 'w')).toBe('HEIGHT')
  })

  test('vertical side resize converts auto sizing to fixed size', () => {
    expect(textResizeModeForHandle(text('WIDTH_AND_HEIGHT'), 'n')).toBe('NONE')
    expect(textResizeModeForHandle(text('HEIGHT'), 's')).toBe('NONE')
  })

  test('does not alter fixed, truncated, corner, or non-text nodes', () => {
    expect(textResizeModeForHandle(text('NONE'), 'e')).toBeNull()
    expect(textResizeModeForHandle(text('TRUNCATE'), 's')).toBeNull()
    expect(textResizeModeForHandle(text('WIDTH_AND_HEIGHT'), 'se')).toBeNull()
    expect(textResizeModeForHandle({ type: 'RECTANGLE', textAutoResize: 'NONE' }, 'e')).toBeNull()
  })
})
