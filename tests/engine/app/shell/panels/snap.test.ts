// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { PANEL_SNAP_THRESHOLD, snapPanelRect } from '@/app/shell/panels/snap'
import type { PanelRect } from '@/app/shell/panels/types'

const overlay = { width: 1000, height: 800 }
const panel = (x: number, y: number, width = 240, height = 200): PanelRect => ({
  x,
  y,
  width,
  height
})

describe('snapPanelRect', () => {
  test('does not snap to the canvas overlay edges', () => {
    expect(snapPanelRect(panel(6, 7), [], overlay)).toMatchObject({ x: 6, y: 7, guides: [] })
    expect(snapPanelRect(panel(754, 594), [], overlay)).toMatchObject({
      x: 754,
      y: 594,
      guides: []
    })
  })

  test('snaps matching edges and centres to another panel', () => {
    const other = panel(400, 300, 300, 240)

    expect(snapPanelRect(panel(154, 297), [other], overlay)).toMatchObject({ x: 160, y: 300 })
    expect(snapPanelRect(panel(426, 317), [other], overlay)).toMatchObject({ x: 430, y: 320 })
    expect(snapPanelRect(panel(694, 537), [other], overlay)).toMatchObject({ x: 700, y: 540 })
  })

  test('snaps panel-to-panel at the exact threshold', () => {
    const result = snapPanelRect(panel(PANEL_SNAP_THRESHOLD, 100), [panel(0, 100)], overlay)

    expect(result.x).toBe(0)
    expect(result.guides.some((guide) => guide.axis === 'x' && guide.position === 0)).toBe(true)
  })

  test('chooses the nearest candidate independently on each axis', () => {
    const result = snapPanelRect(
      panel(255, 255),
      [panel(10, 10), panel(498, 460)],
      overlay
    )

    expect(result.x).toBe(258)
    expect(result.y).toBe(260)
  })

  test('does not snap outside the threshold', () => {
    const result = snapPanelRect(panel(PANEL_SNAP_THRESHOLD + 1, 40), [], overlay)

    expect(result.x).toBe(PANEL_SNAP_THRESHOLD + 1)
    expect(result.guides.filter((guide) => guide.axis === 'x')).toEqual([])
  })

  test('does not snap when disabled', () => {
    expect(snapPanelRect(panel(2, 3), [], overlay, { enabled: false })).toEqual({
      x: 2,
      y: 3,
      guides: []
    })
  })
})
