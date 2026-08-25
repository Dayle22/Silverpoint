// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import {
  PANEL_EDGE_DOCK_WIDTH,
  resolveDropIndex,
  resolveDropTarget,
  type ContainerGeometry,
  type GroupGeometry
} from '@/app/shell/panels/drop-target'

const overlay = { left: 0, right: 1200 }

const group = (rect: GroupGeometry['rect'], tabMidpointsX: number[] = []): GroupGeometry => ({
  rect,
  tabMidpointsX
})

const container = (
  id: ContainerGeometry['id'],
  rect: ContainerGeometry['rect'],
  groups: GroupGeometry[] = []
): ContainerGeometry => ({
  id,
  rect,
  groups
})

describe('resolveDropIndex', () => {
  test('returns 0 for an empty container', () => {
    expect(resolveDropIndex(500, [])).toBe(0)
  })

  test('returns 0 above the first midpoint', () => {
    expect(resolveDropIndex(10, [100, 300, 500])).toBe(0)
  })

  test('returns the seam index between each pair', () => {
    expect(resolveDropIndex(200, [100, 300, 500])).toBe(1)
    expect(resolveDropIndex(400, [100, 300, 500])).toBe(2)
  })

  test('returns length below the last midpoint', () => {
    expect(resolveDropIndex(900, [100, 300, 500])).toBe(3)
  })

  test('a pointer exactly on a midpoint counts as below it (strict-above rule)', () => {
    expect(resolveDropIndex(300, [100, 300, 500])).toBe(1)
  })

  test('resolves X-axis tab midpoints for 0, middle, and append positions', () => {
    const tabMidpointsX = [50, 150, 250]
    expect(resolveDropIndex(30, tabMidpointsX)).toBe(0)
    expect(resolveDropIndex(100, tabMidpointsX)).toBe(1)
    expect(resolveDropIndex(200, tabMidpointsX)).toBe(2)
    expect(resolveDropIndex(300, tabMidpointsX)).toBe(3)
  })
})

describe('resolveDropTarget', () => {
  const tallGroup = group({ left: 0, top: 100, right: 240, bottom: 200 }, [40, 120, 200]) // height = 100
  const leftWithTall = container('left', { left: 0, top: 0, right: 240, bottom: 800 }, [tallGroup])
  const right = container('right', { left: 960, top: 0, right: 1200, bottom: 800 }, [
    group({ left: 960, top: 0, right: 1200, bottom: 300 }, [1020, 1140])
  ])

  describe('seam zones for tall groups (height >= 56 px)', () => {
    test('top distances 27 px and 28 px resolve to group seam i', () => {
      // top = 100, so dist 27 -> y = 127, dist 28 -> y = 128
      expect(resolveDropTarget({ x: 100, y: 127 }, [leftWithTall], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
      expect(resolveDropTarget({ x: 100, y: 128 }, [leftWithTall], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('top distance 29 px enters body and resolves to tab with allowTab: true', () => {
      // y = 129 -> distFromTop = 29 > 28, tabMidpointsX = [40, 120, 200], x = 100 -> tabIndex 1
      expect(resolveDropTarget({ x: 100, y: 129 }, [leftWithTall], overlay)).toEqual({
        kind: 'tab',
        container: 'left',
        groupIndex: 0,
        tabIndex: 1
      })
    })

    test('bottom distances 27 px and 28 px resolve to group seam i + 1', () => {
      // bottom = 200, so dist 27 -> y = 173, dist 28 -> y = 172
      expect(resolveDropTarget({ x: 100, y: 173 }, [leftWithTall], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 1
      })
      expect(resolveDropTarget({ x: 100, y: 172 }, [leftWithTall], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 1
      })
    })

    test('bottom distance 29 px enters body and resolves to tab with allowTab: true', () => {
      // bottom = 200, y = 171 -> distFromBottom = 29 > 28, x = 100 -> tabIndex 1
      expect(resolveDropTarget({ x: 100, y: 171 }, [leftWithTall], overlay)).toEqual({
        kind: 'tab',
        container: 'left',
        groupIndex: 0,
        tabIndex: 1
      })
    })
  })

  describe('empty tabMidpointsX in body', () => {
    test('resolves to tab index 0', () => {
      const groupNoTabs = group({ left: 0, top: 100, right: 240, bottom: 200 }, [])
      const leftNoTabs = container('left', { left: 0, top: 0, right: 240, bottom: 800 }, [groupNoTabs])
      expect(resolveDropTarget({ x: 100, y: 150 }, [leftNoTabs], overlay)).toEqual({
        kind: 'tab',
        container: 'left',
        groupIndex: 0,
        tabIndex: 0
      })
    })
  })

  describe('short groups (< 56 px, including 33 px collapsed rail)', () => {
    const collapsedGroup = group({ left: 0, top: 100, right: 240, bottom: 133 }, [60]) // height 33, midY = 116.5
    const leftCollapsed = container('left', { left: 0, top: 0, right: 240, bottom: 800 }, [collapsedGroup])

    test('above midpoint resolves to seam i', () => {
      expect(resolveDropTarget({ x: 100, y: 110 }, [leftCollapsed], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('exact midpoint tie resolves upward to seam i', () => {
      expect(resolveDropTarget({ x: 100, y: 116.5 }, [leftCollapsed], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('below midpoint resolves to seam i + 1', () => {
      expect(resolveDropTarget({ x: 100, y: 120 }, [leftCollapsed], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 1
      })
    })
  })

  describe('allowTab: false', () => {
    // height = 100, top = 100, bottom = 200, midY = 150
    test('pointer in upper body resolves to seam i', () => {
      expect(resolveDropTarget({ x: 100, y: 140 }, [leftWithTall], overlay, { allowTab: false })).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('pointer in lower body resolves to seam i + 1', () => {
      expect(resolveDropTarget({ x: 100, y: 160 }, [leftWithTall], overlay, { allowTab: false })).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 1
      })
    })

    test('midpoint tie resolves upward to seam i and never produces a tab', () => {
      expect(resolveDropTarget({ x: 100, y: 150 }, [leftWithTall], overlay, { allowTab: false })).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })
  })

  describe('whitespace within container', () => {
    const g0 = group({ left: 0, top: 100, right: 240, bottom: 200 }) // midY = 150
    const g1 = group({ left: 0, top: 300, right: 240, bottom: 400 }) // midY = 350
    const leftTwoGroups = container('left', { left: 0, top: 0, right: 240, bottom: 800 }, [g0, g1])

    test('whitespace before first group resolves to index 0', () => {
      expect(resolveDropTarget({ x: 100, y: 50 }, [leftTwoGroups], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('whitespace between groups resolves to seam between them', () => {
      expect(resolveDropTarget({ x: 100, y: 250 }, [leftTwoGroups], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 1
      })
    })

    test('whitespace after last group resolves to group length', () => {
      expect(resolveDropTarget({ x: 100, y: 500 }, [leftTwoGroups], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 2
      })
    })

    test('empty contained container resolves to index 0', () => {
      const emptyLeft = container('left', { left: 0, top: 0, right: 240, bottom: 800 }, [])
      expect(resolveDropTarget({ x: 100, y: 400 }, [emptyLeft], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })
  })

  describe('edge band fallback for zero-width docks', () => {
    test('pointer in left edge band with zero-width left dock resolves to append-left', () => {
      const emptyLeft = container('left', { left: 0, top: 0, right: 0, bottom: 0 }, [])
      const target = resolveDropTarget(
        { x: PANEL_EDGE_DOCK_WIDTH - 4, y: 400 },
        [emptyLeft, right],
        overlay
      )
      expect(target).toEqual({ kind: 'group', container: 'left', groupIndex: 0 })
    })

    test('pointer in right edge band with zero-width right dock resolves to append-right', () => {
      const emptyRight = container('right', { left: 1200, top: 0, right: 1200, bottom: 0 }, [])
      const target = resolveDropTarget(
        { x: overlay.right - (PANEL_EDGE_DOCK_WIDTH - 4), y: 400 },
        [leftWithTall, emptyRight],
        overlay
      )
      expect(target).toEqual({ kind: 'group', container: 'right', groupIndex: 0 })
    })

    test('edge band resolution requires the corresponding dock to be present', () => {
      expect(resolveDropTarget({ x: 10, y: 400 }, [right], overlay)).toBeNull()
      expect(resolveDropTarget({ x: 1190, y: 400 }, [leftWithTall], overlay)).toBeNull()
    })

    test('a float container never participates in the left/right edge-band fallback', () => {
      const float = container('float:0', { left: 0, top: 0, right: 0, bottom: 0 }, [])
      expect(resolveDropTarget({ x: 10, y: 400 }, [float], overlay)).toBeNull()
    })
  })

  describe('precedence and boundaries', () => {
    test('dock containment takes precedence over an overlapping edge band', () => {
      const wideLeft = container('left', { left: 0, top: 0, right: 300, bottom: 800 }, [
        group({ left: 0, top: 50, right: 300, bottom: 150 })
      ])
      expect(resolveDropTarget({ x: 60, y: 60 }, [wideLeft, right], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('a float window overlapping a dock wins when listed first', () => {
      const float = container('float:0', { left: 50, top: 50, right: 330, bottom: 450 }, [
        group({ left: 50, top: 50, right: 330, bottom: 450 })
      ])
      expect(resolveDropTarget({ x: 100, y: 60 }, [float, leftWithTall, right], overlay)).toEqual({
        kind: 'group',
        container: 'float:0',
        groupIndex: 0
      })
    })

    test('among two overlapping floats, whichever caller lists first wins', () => {
      const back = container('float:0', { left: 0, top: 0, right: 300, bottom: 300 }, [])
      const front = container('float:1', { left: 100, top: 100, right: 400, bottom: 400 }, [])
      expect(resolveDropTarget({ x: 200, y: 200 }, [front, back], overlay)).toEqual({
        kind: 'group',
        container: 'float:1',
        groupIndex: 0
      })
    })

    test('a zero-width dock is not entered by pointer containment even at its origin', () => {
      const emptyLeft = container('left', { left: 0, top: 0, right: 0, bottom: 800 }, [])
      expect(resolveDropTarget({ x: 0, y: 400 }, [emptyLeft, right], overlay)).toEqual({
        kind: 'group',
        container: 'left',
        groupIndex: 0
      })
    })

    test('pointer over open canvas, away from any dock or edge band, resolves to null', () => {
      expect(resolveDropTarget({ x: 600, y: 400 }, [leftWithTall, right], overlay)).toBeNull()
    })
  })
})

