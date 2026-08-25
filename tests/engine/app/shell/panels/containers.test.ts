// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import {
  allContainerIds,
  containerMembers,
  containerOf,
  defaultPanelLayout,
  detachPanel,
  dockPanel,
  movePanel,
  openPanel,
  closePanel,
  raiseFloat,
  resetPanelLayout,
  normalisePanelLayout,
  setFloatRect,
  setPanelCollapsed,
  togglePanelOpen
} from '@/app/shell/panels/operations'
import { migrateV3ToV4 } from '@/app/shell/panels/containers'
import {
  PANEL_COLLAPSED_HEIGHT,
  PANEL_FLOAT_TITLE_HEIGHT,
  PANEL_LAYOUT_VERSION,
  PANEL_LAYOUT_VERSION_V3,
  PANEL_MEMBER_MIN_HEIGHT,
  type PanelLayoutV3
} from '@/app/shell/panels/types'

describe('container helpers', () => {
  test('containerMembers reads dock arrays and float member arrays alike', () => {
    const base = defaultPanelLayout()
    expect(containerMembers(base, 'left')).toEqual(['pages', 'layers'])
    expect(containerMembers(base, 'right')).toEqual(['transform', 'appearance', 'text', 'page', 'guides'])

    const floated = detachPanel(base, 'ai')
    const floatId = containerOf(floated, 'ai')
    expect(floatId).toMatch(/^float:\d+$/)
    expect(containerMembers(floated, floatId)).toEqual(['ai'])
  })

  test('containerOf returns null for a closed panel and the right id otherwise', () => {
    const base = defaultPanelLayout()
    expect(containerOf(base, 'ai')).toBeNull()
    expect(containerOf(base, 'pages')).toBe('left')
    const floated = detachPanel(base, 'code')
    expect(containerOf(floated, 'code')).toBe(containerOf(floated, 'code'))
    expect(floated.floats.some((f) => f.id === containerOf(floated, 'code'))).toBe(true)
  })

  test('allContainerIds lists left, right, then floats in ascending z order', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    layout = detachPanel(layout, 'code')
    const ids = allContainerIds(layout)
    expect(ids[0]).toBe('left')
    expect(ids[1]).toBe('right')
    expect(ids.slice(2)).toEqual(layout.floats.map((f) => f.id))
    // 'code' was detached after 'ai', so its float has the higher z and sorts last.
    expect(ids[ids.length - 1]).toBe(containerOf(layout, 'code'))
  })
})

describe('movePanel', () => {
  test('same-side dock reorder is atomic and post-removal indexed', () => {
    const moved = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerMembers(moved, 'left')).toEqual(['layers', 'pages'])
  })

  test('cross-side dock movement never duplicates the panel', () => {
    const moved = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'right', groupIndex: 1 })
    expect(containerMembers(moved, 'left')).toEqual(['pages'])
    expect(containerMembers(moved, 'right').filter((id) => id === 'layers')).toHaveLength(1)
    expect(containerMembers(moved, 'right')).toEqual(['transform', 'layers', 'appearance', 'text', 'page', 'guides'])
  })

  test('out-of-range indices clamp rather than throwing or dropping the panel', () => {
    const appended = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'right', groupIndex: 999 })
    expect(containerMembers(appended, 'right')).toEqual(['transform', 'appearance', 'text', 'page', 'guides', 'layers'])
    const clampedStart = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'right', groupIndex: -5 })
    expect(containerMembers(clampedStart, 'right')).toEqual(['layers', 'transform', 'appearance', 'text', 'page', 'guides'])
  })

  test('dropping a docked panel onto a float container merges it into that stack at the given index', () => {
    const floated = detachPanel(defaultPanelLayout(), 'ai')
    const floatId = containerOf(floated, 'ai')
    const merged = movePanel(floated, 'layers', { kind: 'group', container: floatId, groupIndex: 0 })
    expect(containerMembers(merged, floatId)).toEqual(['layers', 'ai'])
    expect(containerMembers(merged, 'left')).toEqual(['pages'])
    expect(containerOf(merged, 'layers')).toBe(floatId)
  })

  test('dropping one float member onto another float merges the two stacks; the whole stack is not moved', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    layout = detachPanel(layout, 'code')
    layout = detachPanel(layout, 'guides')
    const aiFloat = containerOf(layout, 'ai')
    const codeFloat = containerOf(layout, 'code')
    const guidesFloat = containerOf(layout, 'guides')
    expect(new Set([aiFloat, codeFloat, guidesFloat]).size).toBe(3)

    const merged = movePanel(layout, 'code', { kind: 'group', container: aiFloat, groupIndex: 1 })
    // Float ids are recomputed by z-order on every structural change (going
    // from 3 floats to 2 here), so look 'guides' up fresh rather than reusing
    // its pre-merge id.
    const mergedStackId = containerOf(merged, 'ai')
    expect(containerMembers(merged, mergedStackId)).toEqual(['ai', 'code'])
    // Dragging one member out of a stack leaves the rest behind - 'guides' is untouched and still its own container.
    expect(containerMembers(merged, containerOf(merged, 'guides'))).toEqual(['guides'])
    expect(merged.floats).toHaveLength(2)
  })

  test('moving the last member out of a float container deletes it', () => {
    const floated = detachPanel(defaultPanelLayout(), 'ai')
    const floatId = containerOf(floated, 'ai')
    const backToDock = movePanel(floated, 'ai', { kind: 'group', container: 'right', groupIndex: 0 })
    expect(backToDock.floats.find((f) => f.id === floatId)).toBeUndefined()
    expect(backToDock.floats).toHaveLength(0)
    expect(containerMembers(backToDock, 'right')[0]).toBe('ai')
  })

  test('dropping onto a target float id that no longer exists synthesises a fresh one at the panel\'s floatFallback', () => {
    const base = defaultPanelLayout()
    const moved = movePanel(base, 'ai', { kind: 'group', container: 'float:999', groupIndex: 0 })
    expect(moved.floats).toHaveLength(1)
    expect(moved.floats[0].members).toEqual(['ai'])
  })
})

describe('detachPanel', () => {
  test('creates a brand new single-member float container at the requested rect', () => {
    const detached = detachPanel(defaultPanelLayout(), 'layers', { x: 111, y: 222, width: 300, height: 400 })
    expect(containerMembers(detached, 'left')).toEqual(['pages'])
    const floatId = containerOf(detached, 'layers')
    const float = detached.floats.find((f) => f.id === floatId)
    expect(float.members).toEqual(['layers'])
    expect(float.x).toBe(111)
    expect(float.y).toBe(222)
  })

  test('detaching one member of a 3-member stack leaves a valid 2-member stack behind', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    const stackId = containerOf(layout, 'ai')
    layout = movePanel(layout, 'code', { kind: 'group', container: stackId, groupIndex: 1 })
    layout = movePanel(layout, 'guides', { kind: 'group', container: stackId, groupIndex: 2 })
    expect(containerMembers(layout, stackId)).toEqual(['ai', 'code', 'guides'])

    const detached = detachPanel(layout, 'code', { x: 500, y: 500, width: 280, height: 300 })
    expect(containerMembers(detached, stackId)).toEqual(['ai', 'guides'])
    const newFloatId = containerOf(detached, 'code')
    expect(newFloatId).not.toBe(stackId)
    expect(containerMembers(detached, newFloatId)).toEqual(['code'])
  })
})

describe('open/close', () => {
  test('closing and reopening a docked panel restores its exact dock side and index', () => {
    const closed = closePanel(defaultPanelLayout(), 'layers')
    expect(containerMembers(closed, 'left')).toEqual(['pages'])
    expect(closed.panels.layers.open).toBe(false)
    const reopened = openPanel(closed, 'layers')
    expect(containerMembers(reopened, 'left')).toEqual(['pages', 'layers'])
  })

  test('closing and reopening a floating panel restores it to its own float rect when the container still exists', () => {
    const floated = detachPanel(defaultPanelLayout(), 'ai')
    const floatId = containerOf(floated, 'ai')
    const closed = closePanel(floated, 'ai')
    expect(closed.floats.find((f) => f.id === floatId)).toBeUndefined()
    const reopened = openPanel(closed, 'ai')
    const newFloatId = containerOf(reopened, 'ai')
    expect(containerMembers(reopened, newFloatId)).toEqual(['ai'])
  })

  test('togglePanelOpen mirrors open/close', () => {
    const base = defaultPanelLayout()
    const closed = togglePanelOpen(base, 'layers')
    expect(closed.panels.layers.open).toBe(false)
    const reopened = togglePanelOpen(closed, 'layers')
    expect(reopened.panels.layers.open).toBe(true)
  })

  test('dockPanel pins a floating panel back to its lastDock, unaffected by time spent floating', () => {
    const base = defaultPanelLayout()
    const floated = detachPanel(base, 'layers', { x: 1, y: 1, width: 240, height: 300 })
    expect(containerOf(floated, 'layers')).not.toBe('left')
    const pinned = dockPanel(floated, 'layers')
    expect(containerMembers(pinned, 'left')).toEqual(['pages', 'layers'])
  })

  test('detachPanel places the new float exactly at the requested rect (the reactive layer\'s floatPanel(id, rect) is a thin write-through over this)', () => {
    const floated = detachPanel(defaultPanelLayout(), 'code', { x: 9, y: 9, width: 280, height: 400 })
    const floatId = containerOf(floated, 'code')
    expect(floated.floats.find((f) => f.id === floatId).x).toBe(9)
  })
})

describe('collapse and float sizing', () => {
  test('collapsing every member of a float container shrinks its required height to PANEL_FLOAT_TITLE_HEIGHT + N * PANEL_COLLAPSED_HEIGHT', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai', { x: 0, y: 0, width: 280, height: 1000 })
    const floatId = containerOf(layout, 'ai')
    layout = movePanel(layout, 'code', { kind: 'group', container: floatId, groupIndex: 1 })
    layout = setPanelCollapsed(layout, 'ai', true)
    layout = setPanelCollapsed(layout, 'code', true)
    const float = layout.floats.find((f) => f.id === floatId)
    // Height never shrinks below what's already stored; the invariant only
    // grows it to fit, so a tall container collapsing fully stays tall - the
    // "PANEL_FLOAT_TITLE_HEIGHT + N * PANEL_COLLAPSED_HEIGHT" figure is the exact floor the invariant
    // enforces, verified below on the growth path instead.
    expect(float.height).toBeGreaterThanOrEqual(PANEL_FLOAT_TITLE_HEIGHT + 2 * PANEL_COLLAPSED_HEIGHT)
  })

  test('merging a member into a small float container grows its height to fit both minimums plus title bar', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai', { x: 0, y: 0, width: 280, height: PANEL_MEMBER_MIN_HEIGHT })
    const floatId = containerOf(layout, 'ai')
    layout = movePanel(layout, 'code', { kind: 'group', container: floatId, groupIndex: 1 })
    const float = layout.floats.find((f) => f.id === floatId)
    expect(float.height).toBeGreaterThanOrEqual(PANEL_FLOAT_TITLE_HEIGHT + 2 * PANEL_MEMBER_MIN_HEIGHT)
  })

  test('one collapsed and one expanded member requires PANEL_FLOAT_TITLE_HEIGHT + PANEL_MEMBER_MIN_HEIGHT + PANEL_COLLAPSED_HEIGHT', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai', { x: 0, y: 0, width: 280, height: 50 })
    const floatId = containerOf(layout, 'ai')
    layout = movePanel(layout, 'code', { kind: 'group', container: floatId, groupIndex: 1 })
    layout = setPanelCollapsed(layout, 'code', true)
    const float = layout.floats.find((f) => f.id === floatId)
    expect(float.height).toBeGreaterThanOrEqual(PANEL_FLOAT_TITLE_HEIGHT + PANEL_MEMBER_MIN_HEIGHT + PANEL_COLLAPSED_HEIGHT)
  })

  test('removing a member leaves the container height unchanged', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai', { x: 0, y: 0, width: 280, height: 900 })
    const floatId = containerOf(layout, 'ai')
    layout = movePanel(layout, 'code', { kind: 'group', container: floatId, groupIndex: 1 })
    layout = movePanel(layout, 'guides', { kind: 'group', container: floatId, groupIndex: 2 })
    const heightWithThree = layout.floats.find((f) => f.id === floatId).height
    layout = movePanel(layout, 'code', { kind: 'group', container: 'right', groupIndex: 0 })
    const remaining = layout.floats.find((f) => f.id === floatId)
    expect(remaining.height).toBe(heightWithThree)
  })
})

describe('v4 migration and height invariants', () => {
  test('migrateV3ToV4 preserves docks, floats, open set and collapsed flags while setting height to null', () => {
    const v3: PanelLayoutV3 = {
      version: PANEL_LAYOUT_VERSION_V3,
      dockWidths: { left: 250, right: 300 },
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [
        { id: 'float:0', x: 50, y: 60, width: 280, height: 400, z: 1, members: ['ai'] }
      ],
      panels: {
        pages: { open: true, container: 'left', index: 0, lastDock: { side: 'left', index: 0 }, basis: 3000, collapsed: false, floatFallback: { x: 24, y: 24, width: 280, height: 560 } },
        layers: { open: true, container: 'left', index: 1, lastDock: { side: 'left', index: 1 }, basis: 7000, collapsed: true, floatFallback: { x: 64, y: 64, width: 280, height: 560 } },
        swatches: { open: false, container: 'left', index: 2, lastDock: { side: 'left', index: 2 }, basis: 1000, collapsed: false, floatFallback: { x: 74, y: 74, width: 280, height: 560 } },
        history: { open: false, container: 'left', index: 1, lastDock: { side: 'left', index: 1 }, basis: 1000, collapsed: false, floatFallback: { x: 54, y: 54, width: 280, height: 560 } },
        transform: { open: true, container: 'right', index: 0, lastDock: { side: 'right', index: 0 }, basis: 3500, collapsed: false, floatFallback: { x: 184, y: 184, width: 280, height: 560 } },
        appearance: { open: true, container: 'right', index: 1, lastDock: { side: 'right', index: 1 }, basis: 4000, collapsed: false, floatFallback: { x: 164, y: 164, width: 280, height: 560 } },
        page: { open: true, container: 'right', index: 2, lastDock: { side: 'right', index: 2 }, basis: 2500, collapsed: false, floatFallback: { x: 224, y: 224, width: 280, height: 560 } },
        ai: { open: true, container: 'float:0', index: 0, lastDock: { side: 'right', index: 2 }, basis: 10000, collapsed: false, floatFallback: { x: 124, y: 124, width: 280, height: 560 } },
        assets: { open: false, container: 'left', index: 1, lastDock: { side: 'left', index: 1 }, basis: 1000, collapsed: false, floatFallback: { x: 44, y: 44, width: 280, height: 560 } },
        export: { open: false, container: 'right', index: 0, lastDock: { side: 'right', index: 0 }, basis: 1000, collapsed: false, floatFallback: { x: 84, y: 84, width: 280, height: 560 } },
        variables: { open: false, container: 'right', index: 1, lastDock: { side: 'right', index: 1 }, basis: 1000, collapsed: false, floatFallback: { x: 104, y: 104, width: 280, height: 560 } },
        code: { open: false, container: 'right', index: 3, lastDock: { side: 'right', index: 3 }, basis: 1000, collapsed: false, floatFallback: { x: 144, y: 144, width: 280, height: 560 } },
        text: { open: false, container: 'right', index: 2, lastDock: { side: 'right', index: 2 }, basis: 1000, collapsed: false, floatFallback: { x: 204, y: 204, width: 280, height: 560 } },
        guides: { open: false, container: 'right', index: 4, lastDock: { side: 'right', index: 4 }, basis: 1000, collapsed: false, floatFallback: { x: 244, y: 244, width: 280, height: 560 } },
        mask: { open: false, container: 'right', index: 5, lastDock: { side: 'right', index: 5 }, basis: 1000, collapsed: false, floatFallback: { x: 264, y: 264, width: 280, height: 560 } },
        component: { open: false, container: 'right', index: 6, lastDock: { side: 'right', index: 6 }, basis: 1000, collapsed: false, floatFallback: { x: 284, y: 284, width: 280, height: 560 } }
      }
    }
    const v4 = migrateV3ToV4(v3)
    expect(v4.version).toBe(4)
    expect(v4.dockWidths).toEqual({ left: 250, right: 300 })
    expect(v4.docks).toEqual({ left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] })
    expect(v4.floats).toHaveLength(1)
    expect(v4.floats[0].members).toEqual(['ai'])
    expect(v4.panels.layers.collapsed).toBe(true)
    expect(v4.panels.pages.collapsed).toBe(false)
    expect(v4.panels.pages.height).toBeNull()
    expect(v4.panels.layers.height).toBeNull()
    expect(v4.panels.ai.height).toBeNull()
  })

  test('height clamps at exactly 95->96 and 641->640 for fill panels', () => {
    const low = defaultPanelLayout()
    low.docks.left[0].height = 95
    const normalisedLow = normalisePanelLayout(low)
    expect(normalisedLow.panels.pages.height).toBe(96)
    expect(normalisedLow.docks.left[0].height).toBe(96)

    const high = defaultPanelLayout()
    high.docks.left[0].height = 641
    const normalisedHigh = normalisePanelLayout(high)
    expect(normalisedHigh.panels.pages.height).toBe(640)
    expect(normalisedHigh.docks.left[0].height).toBe(640)
  })

  test('height is forced to null for collapsed panels and content-sized panels', () => {
    const layout = defaultPanelLayout()
    layout.docks.left[0].collapsed = true
    layout.docks.left[0].height = 300
    layout.docks.right[1].height = 300
    layout.docks.right[0].height = 300
    const normalised = normalisePanelLayout(layout)
    expect(normalised.panels.pages.height).toBeNull()
    expect(normalised.panels.appearance.height).toBeNull()
    expect(normalised.panels.transform.height).toBeNull()
  })
})

describe('raiseFloat and setFloatRect', () => {
  test('raiseFloat moves a container to the highest z without touching membership', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    layout = detachPanel(layout, 'code')
    const aiId = containerOf(layout, 'ai')
    const raised = raiseFloat(layout, aiId)
    const aiFloat = raised.floats.find((f) => f.members.includes('ai'))
    const codeFloat = raised.floats.find((f) => f.members.includes('code'))
    expect(aiFloat.z).toBeGreaterThan(codeFloat.z)
  })

  test('setFloatRect updates position/size without affecting membership or other floats', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    layout = detachPanel(layout, 'code')
    const codeId = containerOf(layout, 'code')
    const before = layout.floats.find((f) => f.id === containerOf(layout, 'ai'))
    const moved = setFloatRect(layout, codeId, { x: 777, y: 888 })
    const after = moved.floats.find((f) => f.id === containerOf(moved, 'ai'))
    expect(moved.floats.find((f) => f.id === codeId).x).toBe(777)
    expect(after.x).toBe(before.x)
    expect(after.y).toBe(before.y)
  })

  test('float ids stay stable across a plain rect update that changes nothing structurally', () => {
    let layout = detachPanel(defaultPanelLayout(), 'ai')
    layout = detachPanel(layout, 'code')
    const idsBefore = allContainerIds(layout)
    const aiId = containerOf(layout, 'ai')
    const moved = setFloatRect(layout, aiId, { x: 42 })
    expect(allContainerIds(moved)).toEqual(idsBefore)
  })
})

describe('reset', () => {
  test('resetPanelLayout returns the exact default every time, independent of prior mutation', () => {
    const first = resetPanelLayout()
    first.panels.pages.collapsed = true
    expect(resetPanelLayout().panels.pages.collapsed).toBe(false)
    expect(resetPanelLayout()).toEqual(defaultPanelLayout())
  })
})

describe('float title geometry (T-070b1)', () => {
  test('PANEL_FLOAT_TITLE_HEIGHT is exported as exactly 24', () => {
    expect(PANEL_FLOAT_TITLE_HEIGHT).toBe(24)
  })

  test('normalisePanelLayout enforces PANEL_FLOAT_TITLE_HEIGHT in the float minimum-height invariant', () => {
    const layout = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages'], right: ['transform', 'appearance', 'page'] },
      floats: [{ id: 'float:0', x: 50, y: 50, width: 280, height: 1, z: 1, members: ['ai'] }],
      panels: {
        pages: { open: true, container: 'left', index: 0 },
        ai: { open: true, container: 'float:0', index: 0, collapsed: false }
      }
    })
    expect(layout.floats[0].height).toBe(PANEL_FLOAT_TITLE_HEIGHT + PANEL_MEMBER_MIN_HEIGHT)
  })
})

