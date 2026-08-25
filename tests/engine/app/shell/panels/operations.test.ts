// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this file is outside tsconfig and is checked by Bun, not the packet's Oxlint type resolver.
import { describe, expect, test } from 'bun:test'

import {
  closePanel,
  containerGroups,
  containerMembers,
  containerOf,
  defaultPanelLayout,
  detachPanel,
  dockPanel,
  floatGroup,
  moveGroup,
  movePanel,
  normalisePanelLayout,
  openPanel,
  resetPanelLayout,
  setGroupCollapsed,
  setGroupHeight,
  setMemberHeight,
  setPanelCollapsed,
  togglePanelOpen
} from '@/app/shell/panels/operations'

describe('pure panel operations (v5)', () => {
  test('open and close preserve the last dock location', () => {
    const closed = closePanel(defaultPanelLayout(), 'layers')
    const reopened = openPanel(closed, 'layers')
    expect(containerMembers(reopened, 'left')).toEqual(['pages', 'layers'])
    expect(reopened.panels.layers.groupIndex).toBe(1)
    expect(reopened.panels.layers.tabIndex).toBe(0)
  })

  test('same-side and cross-side moves do not duplicate panels', () => {
    const moved = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerMembers(moved, 'left')).toEqual(['layers', 'pages'])
    const crossSide = movePanel(moved, 'layers', { kind: 'group', container: 'right', groupIndex: 1 })
    expect(containerMembers(crossSide, 'left')).toEqual(['pages'])
    expect(containerMembers(crossSide, 'right').filter((id) => id === 'layers')).toHaveLength(1)
  })

  test('supports empty, first, middle and end insertion with normalised same-side no-op', () => {
    const empty = closePanel(closePanel(defaultPanelLayout(), 'pages'), 'layers')
    const inserted = movePanel(empty, 'layers', { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerMembers(inserted, 'left')).toEqual(['layers'])

    const first = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerMembers(first, 'left')).toEqual(['layers', 'pages'])
    const middle = movePanel(
      movePanel(first, 'assets', { kind: 'group', container: 'left', groupIndex: 2 }),
      'layers',
      { kind: 'group', container: 'left', groupIndex: 1 }
    )
    expect(containerMembers(middle, 'left')).toEqual(['pages', 'layers', 'assets'])
    const end = movePanel(middle, 'layers', { kind: 'group', container: 'left', groupIndex: 3 })
    expect(containerMembers(end, 'left')).toEqual(['pages', 'assets', 'layers'])
    const noOp = movePanel(middle, 'layers', { kind: 'group', container: 'left', groupIndex: 1 })
    expect(containerMembers(noOp, 'left')).toEqual(['pages', 'layers', 'assets'])
  })

  test('moves a panel across sides atomically and retains its insertion location', () => {
    const result = movePanel(defaultPanelLayout(), 'layers', { kind: 'group', container: 'right', groupIndex: 1 })
    expect(containerMembers(result, 'left')).toEqual(['pages'])
    expect(containerMembers(result, 'right')).toEqual(['transform', 'layers', 'appearance', 'text', 'page', 'guides'])
    expect(result.panels.layers.lastDock).toEqual({ side: 'right', groupIndex: 1, tabIndex: 0 })
    expect(result.panels.layers.container).toBe('right')
  })

  test('float, collapse, toggle and resize remain immutable', () => {
    const base = defaultPanelLayout()
    const floated = detachPanel(base, 'layers', { x: 9000, y: 9000, width: 240, height: 400 })
    expect(containerMembers(base, 'left')).toEqual(['pages', 'layers'])
    expect(containerOf(floated, 'layers')).toMatch(/^float:\d+$/)
    const collapsed = setPanelCollapsed(floated, 'pages', true)
    expect(collapsed.panels.pages.collapsed).toBe(true)
    expect(togglePanelOpen(collapsed, 'assets').panels.assets.open).toBe(true)
    const resized = setMemberHeight(base, 'left', 'pages', 350)
    expect(resized.panels.pages.height).toBe(350)
    expect(base.panels.pages.height).toBe(200)
  })

  test('dockPanel with explicit side/index routes through the same atomic movePanel path', () => {
    const moved = dockPanel(defaultPanelLayout(), 'layers', 'left', 0)
    expect(containerMembers(moved, 'left')).toEqual(['layers', 'pages'])
    const crossSide = dockPanel(moved, 'layers', 'right', 1)
    expect(containerMembers(crossSide, 'left')).toEqual(['pages'])
    expect(containerMembers(crossSide, 'right').filter((id) => id === 'layers')).toHaveLength(1)
  })

  test('dockPanel with no side/index pins a floating panel back to its lastDock', () => {
    const floated = detachPanel(defaultPanelLayout(), 'layers', { x: 1, y: 1, width: 240, height: 300 })
    const pinned = dockPanel(floated, 'layers')
    expect(containerMembers(pinned, 'left')).toEqual(['pages', 'layers'])
  })

  test('reset returns a fresh exact default', () => {
    const first = resetPanelLayout()
    first.panels.pages.collapsed = true
    expect(resetPanelLayout().panels.pages.collapsed).toBe(false)
  })
})

describe('setMemberHeight', () => {
  test('pins a member height in pixels and clears to null', () => {
    const base = defaultPanelLayout()
    const pinned = setMemberHeight(base, 'left', 'pages', 300)
    expect(pinned.panels.pages.height).toBe(300)
    const cleared = setMemberHeight(pinned, 'left', 'pages', null)
    expect(cleared.panels.pages.height).toBeNull()
  })

  test('clamps pinned height to [96, 640]', () => {
    const base = defaultPanelLayout()
    const clampedLow = setMemberHeight(base, 'left', 'pages', 50)
    expect(clampedLow.panels.pages.height).toBe(96)
    const clampedHigh = setMemberHeight(base, 'left', 'pages', 900)
    expect(clampedHigh.panels.pages.height).toBe(640)
  })

  test('no-ops when the panel is not a member of the named container', () => {
    const base = defaultPanelLayout()
    const noOp = setMemberHeight(base, 'left', 'transform', 300)
    expect(noOp).toEqual(base)
  })
})

describe('tab drop operations (v5)', () => {
  test('inserts at index 0, middle and append in a multi-member group with clamping', () => {
    const base = defaultPanelLayout()
    const at0 = movePanel(base, 'layers', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 0 })
    expect(containerGroups(at0, 'left')[0].members).toEqual(['layers', 'pages'])
    expect(containerGroups(at0, 'left')[0].active).toBe('layers')
    expect(containerGroups(at0, 'left')).toHaveLength(1)

    const middle = movePanel(at0, 'assets', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    expect(containerGroups(middle, 'left')[0].members).toEqual(['layers', 'assets', 'pages'])
    expect(containerGroups(middle, 'left')[0].active).toBe('assets')

    const appended = movePanel(middle, 'export', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 999 })
    expect(containerGroups(appended, 'left')[0].members).toEqual(['layers', 'assets', 'pages', 'export'])
    expect(containerGroups(appended, 'left')[0].active).toBe('export')

    const clampedNegative = movePanel(middle, 'export', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: -10 })
    expect(containerGroups(clampedNegative, 'left')[0].members).toEqual(['export', 'layers', 'assets', 'pages'])
    expect(containerGroups(clampedNegative, 'left')[0].active).toBe('export')
  })

  test('same-group reorder uses post-removal indices and leaves exactly one copy', () => {
    let layout = defaultPanelLayout()
    layout = movePanel(layout, 'layers', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    layout = movePanel(layout, 'assets', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 2 })
    expect(containerGroups(layout, 'left')[0].members).toEqual(['pages', 'layers', 'assets'])

    const reordered = movePanel(layout, 'pages', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    expect(containerGroups(reordered, 'left')[0].members).toEqual(['layers', 'pages', 'assets'])
    expect(containerGroups(reordered, 'left')[0].active).toBe('pages')
    expect(containerMembers(reordered, 'left').filter((id) => id === 'pages')).toHaveLength(1)

    const reorderedFirst = movePanel(reordered, 'assets', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 0 })
    expect(containerGroups(reorderedFirst, 'left')[0].members).toEqual(['assets', 'layers', 'pages'])
    expect(containerGroups(reorderedFirst, 'left')[0].active).toBe('assets')
    expect(containerMembers(reorderedFirst, 'left').filter((id) => id === 'assets')).toHaveLength(1)
  })

  test('cross-group move prunes emptied source group, deletes emptied float, and activates moved panel', () => {
    let layout = defaultPanelLayout()
    layout = detachPanel(layout, 'ai')
    expect(layout.floats).toHaveLength(1)

    const dockedAsTab = movePanel(layout, 'ai', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 0 })
    expect(dockedAsTab.floats).toHaveLength(0)
    expect(containerGroups(dockedAsTab, 'left')[0].members).toEqual(['ai', 'pages'])
    expect(containerGroups(dockedAsTab, 'left')[0].active).toBe('ai')
    expect(dockedAsTab.panels.ai.container).toBe('left')
    expect(dockedAsTab.panels.ai.open).toBe(true)

    const crossDock = movePanel(dockedAsTab, 'pages', { kind: 'tab', container: 'right', groupIndex: 0, tabIndex: 1 })
    expect(containerGroups(crossDock, 'left')[0].members).toEqual(['ai'])
    expect(containerGroups(crossDock, 'right')[0].members).toEqual(['transform', 'pages'])
    expect(containerGroups(crossDock, 'right')[0].active).toBe('pages')
  })

  test('target group height and collapsed state survive unchanged with normalized compatibility mirrors', () => {
    let layout = defaultPanelLayout()
    layout = setMemberHeight(layout, 'left', 'pages', 300)
    expect(containerGroups(layout, 'left')[0].height).toBe(300)
    expect(containerGroups(layout, 'left')[0].collapsed).toBe(false)

    const moved = movePanel(layout, 'layers', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    const targetGroup = containerGroups(moved, 'left')[0]
    expect(targetGroup.height).toBe(300)
    expect(targetGroup.collapsed).toBe(false)
    expect(targetGroup.members).toEqual(['pages', 'layers'])
    expect(targetGroup.active).toBe('layers')
    expect(moved.panels.pages.height).toBe(300)
    expect(moved.panels.layers.height).toBe(300)

    let collapsedLayout = defaultPanelLayout()
    collapsedLayout = setPanelCollapsed(collapsedLayout, 'pages', true)
    expect(containerGroups(collapsedLayout, 'left')[0].collapsed).toBe(true)

    const movedCollapsed = movePanel(collapsedLayout, 'layers', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    const targetCollapsedGroup = containerGroups(movedCollapsed, 'left')[0]
    expect(targetCollapsedGroup.collapsed).toBe(true)
    expect(movedCollapsed.panels.pages.collapsed).toBe(true)
    expect(movedCollapsed.panels.layers.collapsed).toBe(true)
  })

  test('missing group and missing float are immutable unchanged-by-value no-ops with no panel loss', () => {
    const base = defaultPanelLayout()
    const invalidGroup = movePanel(base, 'layers', { kind: 'tab', container: 'left', groupIndex: 99, tabIndex: 0 })
    expect(invalidGroup).toEqual(base)
    expect(containerMembers(invalidGroup, 'left')).toEqual(['pages', 'layers'])
    expect(invalidGroup.panels.layers.open).toBe(true)

    const negativeGroup = movePanel(base, 'layers', { kind: 'tab', container: 'left', groupIndex: -1, tabIndex: 0 })
    expect(negativeGroup).toEqual(base)

    const invalidFloat = movePanel(base, 'layers', { kind: 'tab', container: 'float:999', groupIndex: 0, tabIndex: 0 })
    expect(invalidFloat).toEqual(base)
    expect(containerMembers(invalidFloat, 'left')).toEqual(['pages', 'layers'])
    expect(invalidFloat.panels.layers.open).toBe(true)
  })
})

describe('moveGroup (T-070d3)', () => {
  test('Dock-to-dock, dock-to-float, and float-to-dock moves preserve the complete group object and produce no duplicate panel', () => {
    // Start with default layout: left has [pages(height:200), layers(height:null)]
    // First, let's create a multi-member group on left by moving layers into pages group
    let layout = movePanel(defaultPanelLayout(), 'layers', { kind: 'tab', container: 'left', groupIndex: 0, tabIndex: 1 })
    layout = setGroupHeight(layout, 'left', 0, 250)
    layout = setGroupCollapsed(layout, 'left', 0, false)
    const originalLeftGroup = containerGroups(layout, 'left')[0]
    expect(originalLeftGroup.members).toEqual(['pages', 'layers'])
    expect(originalLeftGroup.active).toBe('layers')
    expect(originalLeftGroup.height).toBe(250)
    expect(originalLeftGroup.collapsed).toBe(false)

    // 1. Dock-to-dock: Move left group 0 to right dock at index 1
    const movedToRight = moveGroup(layout, 'left', 0, { kind: 'group', container: 'right', groupIndex: 1 })
    expect(containerGroups(movedToRight, 'left')).toHaveLength(0)
    const rightGroups = containerGroups(movedToRight, 'right')
    expect(rightGroups[1]).toEqual({
      members: ['pages', 'layers'],
      active: 'layers',
      height: 250,
      collapsed: false
    })
    // Check no duplicate panel in the resulting layout
    const allMembers = [
      ...containerMembers(movedToRight, 'left'),
      ...containerMembers(movedToRight, 'right'),
      ...movedToRight.floats.flatMap((f) => f.members)
    ]
    expect(allMembers.filter((id) => id === 'pages')).toHaveLength(1)
    expect(allMembers.filter((id) => id === 'layers')).toHaveLength(1)

    // 2. Dock-to-float: Float a group first to create a float container, then move a dock group into that float
    const floatLayout = floatGroup(defaultPanelLayout(), 'left', 1) // floats layers into float:0
    const floatId = floatLayout.floats[0].id
    // Move pages group from left dock to the float container at index 0
    const movedToFloat = moveGroup(floatLayout, 'left', 0, { kind: 'group', container: floatId, groupIndex: 0 })
    expect(containerGroups(movedToFloat, 'left')).toHaveLength(0)
    const targetFloat = movedToFloat.floats.find((f) => f.id === floatId)
    expect(targetFloat).toBeDefined()
    expect(targetFloat.groups).toHaveLength(2)
    expect(targetFloat.groups[0].members).toEqual(['pages'])
    expect(targetFloat.groups[0].height).toBe(200)

    // 3. Float-to-dock: Move group from float back to left dock
    const movedFloatToDock = moveGroup(movedToFloat, floatId, 0, { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerGroups(movedFloatToDock, 'left')).toHaveLength(1)
    expect(containerGroups(movedFloatToDock, 'left')[0].members).toEqual(['pages'])
    expect(containerGroups(movedFloatToDock, 'left')[0].height).toBe(200)
    const remainingFloat = movedFloatToDock.floats.find((f) => f.id === floatId)
    expect(remainingFloat.groups).toHaveLength(1)
    expect(remainingFloat.groups[0].members).toEqual(['layers'])
  })

  test('Same-container move to a later post-removal index and to an earlier post-removal index both land correctly', () => {
    // Default right dock has 3 groups: [transform], [appearance, text], [page, guides]
    const layout = defaultPanelLayout()

    // Move transform (0) to post-removal index 1 (between [appearance, text] and [page, guides])
    // Post-removal: [[appearance, text], [page, guides]]; inserting at 1 yields [[appearance, text], [transform], [page, guides]]
    const moveForward = moveGroup(layout, 'right', 0, { kind: 'group', container: 'right', groupIndex: 1 })
    expect(containerMembers(moveForward, 'right')).toEqual(['appearance', 'text', 'transform', 'page', 'guides'])

    // Move [page, guides] (2) to post-removal index 0 (at start)
    // Post-removal: [[transform], [appearance, text]]; inserting at 0 yields [[page, guides], [transform], [appearance, text]]
    const moveBackward = moveGroup(layout, 'right', 2, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(containerMembers(moveBackward, 'right')).toEqual(['page', 'guides', 'transform', 'appearance', 'text'])
  })

  test('target.groupIndex beyond groups.length clamps to append and negative clamps to 0', () => {
    const layout = defaultPanelLayout()
    // Left dock has 2 groups: pages(0), layers(1)
    // Move pages(0) with groupIndex 99 (beyond length) -> appends at index 1
    const clampedEnd = moveGroup(layout, 'left', 0, { kind: 'group', container: 'left', groupIndex: 99 })
    expect(containerMembers(clampedEnd, 'left')).toEqual(['layers', 'pages'])

    // Move layers(1) with negative groupIndex -> inserts at 0
    const clampedStart = moveGroup(layout, 'left', 1, { kind: 'group', container: 'left', groupIndex: -5 })
    expect(containerMembers(clampedStart, 'left')).toEqual(['layers', 'pages'])
  })

  test('Invalid source is an immutable no-op', () => {
    const base = defaultPanelLayout()
    const negativeSource = moveGroup(base, 'left', -1, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(negativeSource).toEqual(normalisePanelLayout(base))

    const outOfBoundsSource = moveGroup(base, 'left', 99, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(outOfBoundsSource).toEqual(normalisePanelLayout(base))

    // Same position no-op
    const samePosition = moveGroup(base, 'left', 0, { kind: 'group', container: 'left', groupIndex: 0 })
    expect(samePosition).toEqual(normalisePanelLayout(base))
  })

  test('Missing target float is an immutable no-op', () => {
    const base = defaultPanelLayout()
    const missingTarget = moveGroup(base, 'left', 0, { kind: 'group', container: 'float:nonexistent', groupIndex: 0 })
    expect(missingTarget).toEqual(normalisePanelLayout(base))
    expect(containerMembers(missingTarget, 'left')).toEqual(['pages', 'layers'])
  })

  test('Moving the only group out of a dock leaves that dock empty; moving the only group out of a float deletes that float', () => {
    // Create layout with single group in left dock
    const singleLeft = closePanel(defaultPanelLayout(), 'layers')
    expect(containerGroups(singleLeft, 'left')).toHaveLength(1)
    const movedOutDock = moveGroup(singleLeft, 'left', 0, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(containerGroups(movedOutDock, 'left')).toHaveLength(0)

    // Float with single group
    const floated = floatGroup(defaultPanelLayout(), 'left', 0)
    const floatId = floated.floats[0].id
    expect(floated.floats).toHaveLength(1)

    // Move only group out of float to left dock
    const movedOutFloat = moveGroup(floated, floatId, 0, { kind: 'group', container: 'left', groupIndex: 0 })
    expect(movedOutFloat.floats.find((f) => f.id === floatId)).toBeUndefined()
    expect(movedOutFloat.floats).toHaveLength(0)
  })

  test('A collapsed group and a group with pinned height preserve values across dock/dock, dock/float, float/dock, float/float', () => {
    // 1. Pinned height preservation (using pages which has sizing: 'fill')
    const heightLayout = setGroupHeight(defaultPanelLayout(), 'left', 0, 320)
    expect(containerGroups(heightLayout, 'left')[0].height).toBe(320)

    // dock-to-dock
    const dockToDockH = moveGroup(heightLayout, 'left', 0, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(containerGroups(dockToDockH, 'right')[0].height).toBe(320)

    // dock-to-float
    let floatLayoutH = floatGroup(defaultPanelLayout(), 'right', 0)
    const floatIdH = floatLayoutH.floats[0].id
    floatLayoutH = setGroupHeight(floatLayoutH, 'left', 0, 320)
    const dockToFloatH = moveGroup(floatLayoutH, 'left', 0, { kind: 'group', container: floatIdH, groupIndex: 0 })
    expect(dockToFloatH.floats.find((f) => f.id === floatIdH).groups[0].height).toBe(320)

    // float-to-dock
    const floatToDockH = moveGroup(dockToFloatH, floatIdH, 0, { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerGroups(floatToDockH, 'left')[0].height).toBe(320)

    // float-to-float
    let twoFloatsH = floatGroup(defaultPanelLayout(), 'left', 0)
    twoFloatsH = floatGroup(twoFloatsH, 'left', 0)
    const fId1H = twoFloatsH.floats[0].id
    const fId2H = twoFloatsH.floats[1].id
    twoFloatsH = setGroupHeight(twoFloatsH, fId1H, 0, 320)
    const floatToFloatH = moveGroup(twoFloatsH, fId1H, 0, { kind: 'group', container: fId2H, groupIndex: 0 })
    expect(floatToFloatH.floats).toHaveLength(1)
    expect(floatToFloatH.floats[0].groups[0].height).toBe(320)

    // 2. Collapsed state preservation
    const collapsedLayout = setGroupCollapsed(defaultPanelLayout(), 'left', 0, true)
    expect(containerGroups(collapsedLayout, 'left')[0].collapsed).toBe(true)

    // dock-to-dock
    const dockToDockC = moveGroup(collapsedLayout, 'left', 0, { kind: 'group', container: 'right', groupIndex: 0 })
    expect(containerGroups(dockToDockC, 'right')[0].collapsed).toBe(true)

    // dock-to-float
    let floatLayoutC = floatGroup(defaultPanelLayout(), 'right', 0)
    const floatIdC = floatLayoutC.floats[0].id
    floatLayoutC = setGroupCollapsed(floatLayoutC, 'left', 0, true)
    const dockToFloatC = moveGroup(floatLayoutC, 'left', 0, { kind: 'group', container: floatIdC, groupIndex: 0 })
    expect(dockToFloatC.floats.find((f) => f.id === floatIdC).groups[0].collapsed).toBe(true)

    // float-to-dock
    const floatToDockC = moveGroup(dockToFloatC, floatIdC, 0, { kind: 'group', container: 'left', groupIndex: 0 })
    expect(containerGroups(floatToDockC, 'left')[0].collapsed).toBe(true)

    // float-to-float
    let twoFloatsC = floatGroup(defaultPanelLayout(), 'left', 0)
    twoFloatsC = floatGroup(twoFloatsC, 'left', 0)
    const fId1C = twoFloatsC.floats[0].id
    const fId2C = twoFloatsC.floats[1].id
    twoFloatsC = setGroupCollapsed(twoFloatsC, fId1C, 0, true)
    const floatToFloatC = moveGroup(twoFloatsC, fId1C, 0, { kind: 'group', container: fId2C, groupIndex: 0 })
    expect(floatToFloatC.floats).toHaveLength(1)
    expect(floatToFloatC.floats[0].groups[0].collapsed).toBe(true)
  })
})

