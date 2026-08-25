// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this file is outside tsconfig and is checked by Bun, not the packet's Oxlint type resolver.
import { describe, expect, test } from 'bun:test'

import {
  closeGroup,
  containerMembers,
  containerOf,
  defaultPanelLayout,
  detachPanel,
  dockGroup,
  floatGroup,
  movePanel,
  normalisePanelLayout,
  setActiveTab,
  setGroupCollapsed,
  setGroupHeight,
  setMemberHeight,
  setPanelCollapsed
} from '@/app/shell/panels/operations'
import { migrateV4ToV5 } from '@/app/shell/panels/containers'
import {
  PANEL_COLLAPSED_HEIGHT,
  PANEL_FLOAT_TITLE_HEIGHT,
  PANEL_IDS,
  PANEL_LAYOUT_VERSION,
  PANEL_MEMBER_MAX_HEIGHT,
  PANEL_MEMBER_MIN_HEIGHT,
  type PanelLayoutV4,
  type RegisteredPanelStateV4
} from '@/app/shell/panels/types'

describe('v5 PanelGroup model and migration (T-070c1)', () => {
  test('defaultPanelLayout matches approved grouped defaults and is a fixed point of normalisation', () => {
    const layout = defaultPanelLayout()
    expect(layout.version).toBe(PANEL_LAYOUT_VERSION)
    expect(layout.version).toBe(5)
    expect(containerMembers(layout, 'left')).toEqual(['pages', 'layers'])
    expect(containerMembers(layout, 'right')).toEqual(['transform', 'appearance', 'text', 'page', 'guides'])
    expect(layout.docks.left).toEqual([
      { members: ['pages'], active: 'pages', height: 200, collapsed: false },
      { members: ['layers'], active: 'layers', height: null, collapsed: false }
    ])
    expect(layout.docks.right).toEqual([
      { members: ['transform'], active: 'transform', height: null, collapsed: false },
      { members: ['appearance', 'text'], active: 'appearance', height: null, collapsed: false },
      { members: ['page', 'guides'], active: 'page', height: null, collapsed: false }
    ])
    expect(layout.panels.pages.height).toBe(200)
    expect(layout.panels.layers.height).toBeNull()
    expect(layout.panels.pages.open).toBe(true)
    expect(layout.panels.text.open).toBe(true)
    expect(layout.panels.guides.open).toBe(true)
    expect(layout.panels.export.open).toBe(false)
    expect(layout.panels.swatches.open).toBe(false)
    expect(normalisePanelLayout(defaultPanelLayout())).toEqual(defaultPanelLayout())
  })

  test('migrateV4ToV5 produces one group per v4 member with order, height and collapsed preserved', () => {
    const v4: PanelLayoutV4 = {
      version: 4,
      dockWidths: { left: 260, right: 310 },
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [
        { id: 'float:0', x: 40, y: 50, width: 280, height: 400, z: 1, members: ['ai', 'code'] }
      ],
      panels: Object.fromEntries(
        PANEL_IDS.map((id) => {
          const isDockedLeft = id === 'pages' || id === 'layers'
          const isFloat = id === 'ai' || id === 'code'
          const container = isFloat ? 'float:0' : (isDockedLeft ? 'left' : 'right')
          const height = id === 'pages' ? 250 : (id === 'ai' ? 380 : null)
          return [
            id,
            {
              open: id === 'pages' || id === 'layers' || id === 'transform' || id === 'appearance' || id === 'page' || id === 'ai' || id === 'code',
              container,
              index: 0,
              lastDock: { side: 'left', index: 0 },
              height,
              collapsed: id === 'layers' || id === 'code',
              floatFallback: { x: 24, y: 24, width: 280, height: 560 }
            }
          ]
        })
      ) as Record<string, RegisteredPanelStateV4>
    }

    const v5 = migrateV4ToV5(v4)
    expect(v5.version).toBe(5)
    expect(v5.dockWidths).toEqual({ left: 260, right: 310 })
    expect(v5.docks.left).toEqual([
      { members: ['pages'], active: 'pages', height: 250, collapsed: false },
      { members: ['layers'], active: 'layers', height: null, collapsed: true }
    ])
    expect(v5.floats).toHaveLength(1)
    expect(v5.floats[0].groups).toEqual([
      { members: ['ai'], active: 'ai', height: 380, collapsed: false },
      { members: ['code'], active: 'code', height: null, collapsed: true }
    ])
    expect(v5.floats[0].members).toEqual(['ai', 'code'])
    expect(v5.panels.pages.height).toBe(250)
    expect(v5.panels.layers.collapsed).toBe(true)
    expect(v5.panels.code.collapsed).toBe(true)
    expect(v5.panels.ai.height).toBe(380)
  })

  test('stored version 1, 2, 3 and 4 inputs survive full chain to v5', () => {
    const v1Input = {
      version: 1,
      panels: {
        layers: { mode: 'docked', collapsed: false },
        properties: { mode: 'floating', x: 20, y: 30, width: 300, height: 500, expandedHeight: 500, z: 1 }
      }
    }
    const fromV1 = normalisePanelLayout(v1Input)
    expect(fromV1.version).toBe(5)
    expect(containerMembers(fromV1, 'left')).toEqual(['pages', 'layers'])
    expect(fromV1.floats.length).toBeGreaterThanOrEqual(1)

    const v4Input: PanelLayoutV4 = {
      version: 4,
      dockWidths: { left: 240, right: 280 },
      docks: { left: ['pages'], right: ['transform', 'page'] },
      floats: [],
      panels: Object.fromEntries(
        PANEL_IDS.map((id) => [
          id,
          {
            open: id === 'pages' || id === 'transform' || id === 'page',
            container: id === 'pages' ? 'left' : 'right',
            index: 0,
            lastDock: { side: 'left', index: 0 },
            height: null,
            collapsed: false,
            floatFallback: { x: 24, y: 24, width: 280, height: 560 }
          }
        ])
      ) as Record<string, RegisteredPanelStateV4>
    }
    const fromV4 = normalisePanelLayout(v4Input)
    expect(fromV4.version).toBe(5)
    expect(containerMembers(fromV4, 'left')).toEqual(['pages'])
    expect(containerMembers(fromV4, 'right')).toEqual(['transform', 'page'])
  })

  test('normalisation repairs active when not in members, drops empty groups and deduplicates globally', () => {
    const invalidGroupState = {
      version: 5,
      docks: {
        left: [
          { members: ['pages', 'layers'], active: 'nonexistent', height: 200, collapsed: false },
          { members: ['pages'], active: 'pages', height: 200, collapsed: false }, // duplicate 'pages' - dropped
          { members: [], active: 'none', height: null, collapsed: false } // empty group - dropped
        ],
        right: [
          { members: ['transform'], active: 'transform', height: 400, collapsed: false } // content panel: height forced to null
        ]
      },
      floats: [
        { id: 'float:0', x: 20, y: 20, width: 280, height: 300, z: 1, groups: [] } // empty float - dropped
      ],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0, tabIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 0, tabIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0, tabIndex: 0 }
      }
    }

    const normalised = normalisePanelLayout(invalidGroupState)
    expect(normalised.docks.left).toHaveLength(1)
    expect(normalised.docks.left[0].members).toEqual(['pages', 'layers'])
    expect(normalised.docks.left[0].active).toBe('pages') // repaired from 'nonexistent' to members[0]
    expect(normalised.docks.right[0].height).toBeNull() // content sizing forces height null
    expect(normalised.floats).toHaveLength(0) // empty float dropped
  })

  test('float height floor formula accounts for expanded and collapsed groups plus title bar', () => {
    const layout = normalisePanelLayout({
      version: 5,
      docks: { left: [], right: [] },
      floats: [
        {
          id: 'float:0',
          x: 50,
          y: 50,
          width: 280,
          height: 10,
          z: 1,
          groups: [
            { members: ['ai'], active: 'ai', height: 200, collapsed: false },
            { members: ['code'], active: 'code', height: null, collapsed: true }
          ]
        }
      ],
      panels: {
        ai: { open: true, container: 'float:0', groupIndex: 0, tabIndex: 0 },
        code: { open: true, container: 'float:0', groupIndex: 1, tabIndex: 0 }
      }
    })

    const expectedHeight = PANEL_FLOAT_TITLE_HEIGHT + 1 * PANEL_MEMBER_MIN_HEIGHT + 1 * PANEL_COLLAPSED_HEIGHT
    expect(layout.floats[0].height).toBe(expectedHeight)
  })

  test('setActiveTab updates active tab when id is a member and no-ops when not', () => {
    let layout = defaultPanelLayout()
    // Synthesise a group with two members in the left dock
    layout.docks.left = [
      { members: ['pages', 'layers'], active: 'pages', height: 200, collapsed: false }
    ]
    layout = normalisePanelLayout(layout)

    const updated = setActiveTab(layout, 'left', 0, 'layers')
    expect(updated.docks.left[0].active).toBe('layers')

    const noOp = setActiveTab(layout, 'left', 0, 'transform')
    expect(noOp.docks.left[0].active).toBe('pages')
  })

  test('setGroupCollapsed and setGroupHeight clamp and recompute compatibility mirrors', () => {
    const layout = defaultPanelLayout()
    const collapsed = setGroupCollapsed(layout, 'left', 0, true)
    expect(collapsed.docks.left[0].collapsed).toBe(true)
    expect(collapsed.panels.pages.collapsed).toBe(true)
    expect(collapsed.panels.pages.height).toBeNull() // collapsed forces height null

    const resized = setGroupHeight(layout, 'left', 0, 9999)
    expect(resized.docks.left[0].height).toBe(PANEL_MEMBER_MAX_HEIGHT)
    expect(resized.panels.pages.height).toBe(PANEL_MEMBER_MAX_HEIGHT)

    const lowResized = setGroupHeight(layout, 'left', 0, 10)
    expect(lowResized.docks.left[0].height).toBe(PANEL_MEMBER_MIN_HEIGHT)
    expect(lowResized.panels.pages.height).toBe(PANEL_MEMBER_MIN_HEIGHT)
  })

  test('closeGroup closes every member and preserves restore position', () => {
    let layout = defaultPanelLayout()
    layout.docks.left = [
      { members: ['pages', 'layers'], active: 'pages', height: 200, collapsed: false }
    ]
    layout = normalisePanelLayout(layout)

    const closed = closeGroup(layout, 'left', 0)
    expect(closed.docks.left).toHaveLength(0)
    expect(closed.panels.pages.open).toBe(false)
    expect(closed.panels.layers.open).toBe(false)
    expect(closed.panels.pages.container).toBe('left')
    expect(closed.panels.pages.groupIndex).toBe(0)
    expect(closed.panels.pages.tabIndex).toBe(0)
    expect(closed.panels.layers.container).toBe('left')
    expect(closed.panels.layers.groupIndex).toBe(0)
    expect(closed.panels.layers.tabIndex).toBe(1)
  })

  test('floatGroup and dockGroup round-trip the entire group as a unit', () => {
    let layout = defaultPanelLayout()
    layout.docks.left = [
      { members: ['pages', 'layers'], active: 'pages', height: 200, collapsed: false }
    ]
    layout = normalisePanelLayout(layout)

    const floated = floatGroup(layout, 'left', 0, { x: 100, y: 100, width: 300, height: 450 })
    expect(floated.docks.left).toHaveLength(0)
    expect(floated.floats).toHaveLength(1)
    expect(floated.floats[0].groups[0].members).toEqual(['pages', 'layers'])
    expect(floated.floats[0].members).toEqual(['pages', 'layers'])
    expect(floated.floats[0].x).toBe(100)
    expect(floated.floats[0].y).toBe(100)

    const floatId = floated.floats[0].id
    const docked = dockGroup(floated, floatId, 0)
    expect(docked.floats).toHaveLength(0)
    expect(containerMembers(docked, 'left')).toEqual(['pages', 'layers'])
  })

  test('compatibility wrappers setPanelCollapsed and setMemberHeight match group operations', () => {
    const base = defaultPanelLayout()
    const viaPanelCollapsed = setPanelCollapsed(base, 'pages', true)
    const viaGroupCollapsed = setGroupCollapsed(base, 'left', 0, true)
    expect(viaPanelCollapsed).toEqual(viaGroupCollapsed)

    const viaPanelHeight = setMemberHeight(base, 'left', 'pages', 320)
    const viaGroupHeight = setGroupHeight(base, 'left', 0, 320)
    expect(viaPanelHeight).toEqual(viaGroupHeight)
  })

  test('FloatContainer.members and RegisteredPanelState.height/collapsed mirrors stay correct after all operations', () => {
    let layout = defaultPanelLayout()
    layout = detachPanel(layout, 'ai')
    const floatId = containerOf(layout, 'ai')
    expect(layout.floats[0].members).toEqual(['ai'])
    expect(layout.panels.ai.container).toBe(floatId)

    layout = movePanel(layout, 'code', { kind: 'group', container: floatId, groupIndex: 1 })
    expect(layout.floats[0].members).toEqual(['ai', 'code'])
    expect(layout.panels.code.container).toBe(floatId)

    layout = setPanelCollapsed(layout, 'code', true)
    expect(layout.panels.code.collapsed).toBe(true)
    expect(layout.floats[0].groups.find((g) => g.members.includes('code'))?.collapsed).toBe(true)
  })
})
