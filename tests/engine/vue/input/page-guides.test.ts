import { describe, expect, test } from 'bun:test'

import {
  findPageGuideAtScreenPoint,
  getPageGuideAxisFromRuler,
  getPageGuideOffset
} from '#vue/shared/input/page-guides'

describe('page guide input helpers', () => {
  test('maps top and left rulers to document-space guide axes', () => {
    expect(getPageGuideAxisFromRuler(40, 10, 20)).toBe('Y')
    expect(getPageGuideAxisFromRuler(10, 40, 20)).toBe('X')
    expect(getPageGuideAxisFromRuler(10, 10, 20)).toBeNull()
    expect(getPageGuideOffset('Y', 0, 110, 10, 2)).toBe(50)
    expect(getPageGuideOffset('X', 140, 0, 20, 4)).toBe(30)
  })

  test('finds the nearest guide within a screen-space hit radius', () => {
    const guides = [
      { axis: 'X' as const, offset: 50 },
      { axis: 'Y' as const, offset: 30 }
    ]
    expect(findPageGuideAtScreenPoint(guides, 'X', 108, 0, 10, 0, 2, 6)).toBe(0)
    expect(findPageGuideAtScreenPoint(guides, 'Y', 0, 139, 0, 20, 4, 6)).toBe(1)
    expect(findPageGuideAtScreenPoint(guides, 'X', 106, 0, 10, 0, 2, 2)).toBeNull()
  })
})
