// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this Bun test file is excluded from tsconfig and checked by Bun rather than Oxlint's standalone resolver.
import { describe, expect, test } from 'bun:test'

import { clampRectToOverlay } from '@/app/shell/panels/layout'
import { defaultPanelLayout, normalisePanelLayout, setDockWidth } from '@/app/shell/panels/operations'
import { migrateV1ToV2, migrateV2ToV3 } from '@/app/shell/panels/containers'
import {
  PANEL_LAYOUT_VERSION,
  PANEL_LAYOUT_VERSION_V3,
  PANEL_MEMBER_MIN_HEIGHT,
  PANEL_MIN_VISIBLE
} from '@/app/shell/panels/types'

describe('version-5 panel layout', () => {
  test('has the complete registry and approved grouped default (T-070c3)', () => {
    const result = defaultPanelLayout()
    expect(result.version).toBe(PANEL_LAYOUT_VERSION)
    expect(Object.keys(result.panels)).toHaveLength(16)
    expect(result.docks).toEqual({
      left: [
        { members: ['pages'], active: 'pages', height: 200, collapsed: false },
        { members: ['layers'], active: 'layers', height: null, collapsed: false }
      ],
      right: [
        { members: ['transform'], active: 'transform', height: null, collapsed: false },
        { members: ['appearance', 'text'], active: 'appearance', height: null, collapsed: false },
        { members: ['page', 'guides'], active: 'page', height: null, collapsed: false }
      ]
    })
    expect(result.floats).toEqual([])
    expect(result.panels.pages.height).toBe(200)
    expect(result.panels.layers.height).toBeNull()
    expect(result.panels.transform.height).toBeNull()
    expect(result.panels.appearance.height).toBeNull()
    expect(result.panels.text.height).toBeNull()
    expect(result.panels.page.height).toBeNull()
    expect(result.panels.guides.height).toBeNull()
    expect(result.panels.page.open).toBe(true)
    expect(result.panels.text.open).toBe(true)
    expect(result.panels.guides.open).toBe(true)
  })

  test('drops duplicates, recovers missing docked records and normalises height', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['layers', 'layers'], right: [] },
      panels: {
        layers: { open: true, container: 'left', groupIndex: 0, height: 300 },
        transform: { open: true, container: 'right', groupIndex: 0, height: 200 }
      }
    })
    expect(result.docks.left.map((g) => g.members[0])).toEqual(['pages', 'layers'])
    // 'appearance', 'text', 'page' and 'guides' were not present in the input at all,
    // so all recover from the registry defaults alongside 'transform'.
    expect(result.docks.right.map((g) => g.members[0])).toEqual(['transform', 'text', 'guides', 'page', 'appearance'])
    // layers is fill, so height: 300 is preserved
    expect(result.panels.layers.height).toBe(300)
    // transform is content, so height is forced to null
    expect(result.panels.transform.height).toBeNull()
  })

  test('drops a float with an invalid or missing id, and a duplicate member across containers keeps only the first occurrence', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [
        { members: ['ai'] }, // no id - dropped
        { id: 'float:0', x: 10, y: 10, width: 280, height: 400, z: 1, members: ['ai', 'code'] },
        { id: 'float:1', x: 20, y: 20, width: 280, height: 400, z: 2, members: ['ai'] } // 'ai' already seen - dropped from here
      ],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 },
        ai: { open: true, container: 'float:0', groupIndex: 0 },
        code: { open: true, container: 'float:0', groupIndex: 1 }
      }
    })
    expect(result.floats).toHaveLength(1)
    expect(result.floats[0].members).toEqual(['ai', 'code'])
  })

  test('deletes a float container left with zero members after dedup', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page', 'ai'] },
      floats: [{ id: 'float:0', x: 1, y: 1, width: 280, height: 400, z: 1, members: ['ai'] }],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 },
        ai: { open: true, container: 'right', groupIndex: 3 }
      }
    })
    // 'ai' is claimed by the right dock first (docks are walked before
    // floats), so the float entry is left with zero members and dropped.
    expect(result.floats).toHaveLength(0)
    expect(result.docks.right.some((g) => g.members.includes('ai'))).toBe(true)
  })

  test('renumbers float ids densely by ascending z and recomputes each member\'s container/index cache', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [
        { id: 'float:whatever', x: 1, y: 1, width: 280, height: 400, z: 9, members: ['code'] },
        { id: 'float:other', x: 2, y: 2, width: 280, height: 400, z: 3, members: ['ai', 'guides'] }
      ],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 },
        code: { open: true, container: 'float:whatever', groupIndex: 0 },
        ai: { open: true, container: 'float:other', groupIndex: 0 },
        guides: { open: true, container: 'float:other', groupIndex: 1 }
      }
    })
    expect(result.floats.map((f) => f.id)).toEqual(['float:0', 'float:1'])
    expect(result.floats[0].z).toBe(1)
    expect(result.floats[1].z).toBe(2)
    // z=3 sorts first, so the two-member float ('ai','guides') becomes float:0.
    expect(result.floats[0].members).toEqual(['ai', 'guides'])
    expect(result.floats[1].members).toEqual(['code'])
    expect(result.panels.ai.container).toBe('float:0')
    expect(result.panels.ai.groupIndex).toBe(0)
    expect(result.panels.ai.tabIndex).toBe(0)
    expect(result.panels.guides.container).toBe('float:0')
    expect(result.panels.guides.groupIndex).toBe(1)
    expect(result.panels.guides.tabIndex).toBe(0)
    expect(result.panels.code.container).toBe('float:1')
  })

  test('reinserts a missing open panel at its cached container/index, or the registry default dock when that container no longer exists', () => {
    const dockCase = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages'], right: ['transform', 'appearance', 'page'] },
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 }, // missing from docks.left entirely
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 }
      }
    })
    expect(dockCase.docks.left.map((g) => g.members[0])).toEqual(['pages', 'layers'])

    const staleFloatCase = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 },
        // 'ai' claims a float that does not exist in `floats` - registry default dock wins.
        ai: { open: true, container: 'float:7', groupIndex: 0 }
      }
    })
    expect(staleFloatCase.floats).toHaveLength(0)
    expect(staleFloatCase.docks.right.some((g) => g.members.includes('ai'))).toBe(true)
  })

  test('unknown versions and corrupt values use a safe normalised default', () => {
    expect(normalisePanelLayout({ version: 99 })).toEqual(defaultPanelLayout())
    expect(normalisePanelLayout(null)).toEqual(defaultPanelLayout())
    expect(normalisePanelLayout('garbage')).toEqual(defaultPanelLayout())
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      dockWidths: { left: -10, right: Infinity },
      docks: { left: [], right: [] },
      floats: 'not an array',
      panels: {}
    })
    expect(result.dockWidths).toEqual({ left: 220, right: 280 })
    expect(result.floats).toEqual([])
  })

  test('a float rect below the minimum height clamps to PANEL_MEMBER_MIN_HEIGHT', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION,
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [{ id: 'float:0', x: 1, y: 1, width: 280, height: 1, z: 1, members: ['ai'] }],
      panels: {
        pages: { open: true, container: 'left', groupIndex: 0 },
        layers: { open: true, container: 'left', groupIndex: 1 },
        transform: { open: true, container: 'right', groupIndex: 0 },
        appearance: { open: true, container: 'right', groupIndex: 1 },
        page: { open: true, container: 'right', groupIndex: 2 },
        ai: { open: true, container: 'float:0', groupIndex: 0 }
      }
    })
    expect(result.floats[0].height).toBeGreaterThanOrEqual(PANEL_MEMBER_MIN_HEIGHT)
  })

  test('persists and clamps independent left and right dock widths', () => {
    const result = setDockWidth(setDockWidth(defaultPanelLayout(), 'left', 515), 'right', 9999)
    expect(result.dockWidths).toEqual({ left: 515, right: 720 })
    expect(
      normalisePanelLayout({ ...result, dockWidths: { left: 200, right: 600 } }).dockWidths
    ).toEqual({ left: 220, right: 600 })
  })

  test('migrates a v1 fixture through v2 and v3 into v4 without changing the editor-layout input', () => {
    const v2 = migrateV1ToV2({
      version: 1,
      panels: {
        layers: { mode: 'docked', collapsed: true },
        properties: {
          mode: 'floating',
          x: 10,
          y: 20,
          width: 300,
          height: 500,
          expandedHeight: 500,
          z: 4
        }
      }
    })
    const v3 = migrateV2ToV3(v2)
    const result = normalisePanelLayout(v3)
    expect(result.version).toBe(PANEL_LAYOUT_VERSION)
    expect(result.docks.left.map((g) => g.members[0])).toEqual(['pages', 'layers'])
    expect(result.docks.right.some((g) => g.members.includes('transform'))).toBe(false)
    expect(result.panels.pages.collapsed).toBe(true)
    expect(result.floats).toHaveLength(2)
    const transformFloat = result.floats.find((f) => f.members.includes('transform'))
    const appearanceFloat = result.floats.find((f) => f.members.includes('appearance'))
    expect(transformFloat.members).toEqual(['transform'])
    expect(appearanceFloat.members).toEqual(['appearance'])
    expect(appearanceFloat.y).toBeGreaterThan(transformFloat.y)
  })

  test('the full v1 -> v4 chain is reachable through the single normalisePanelLayout entry point', () => {
    const result = normalisePanelLayout({
      version: 1,
      panels: {
        layers: { mode: 'floating', x: 5, y: 5, width: 260, height: 400, expandedHeight: 400, z: 1 }
      }
    })
    expect(result.version).toBe(PANEL_LAYOUT_VERSION)
    expect(result.floats.some((f) => f.members.includes('layers') || f.members.includes('pages'))).toBe(true)
  })

  test('migrates a v2 fixture with a docked-only, a floating-only and a mixed panel', () => {
    const result = normalisePanelLayout({
      version: 2,
      dockWidths: { left: 240, right: 280 },
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      panels: {
        pages: { open: true, placement: 'docked', lastDock: { side: 'left', index: 0 }, dockBasis: 3000, collapsed: false, floating: { x: 0, y: 0, width: 280, height: 560, expandedHeight: 560, z: 1 } },
        layers: { open: true, placement: 'docked', lastDock: { side: 'left', index: 1 }, dockBasis: 7000, collapsed: false, floating: { x: 0, y: 0, width: 280, height: 560, expandedHeight: 560, z: 1 } },
        transform: { open: true, placement: 'docked', lastDock: { side: 'right', index: 0 }, dockBasis: 3500, collapsed: false, floating: { x: 0, y: 0, width: 280, height: 560, expandedHeight: 560, z: 1 } },
        appearance: { open: true, placement: 'docked', lastDock: { side: 'right', index: 1 }, dockBasis: 4000, collapsed: false, floating: { x: 0, y: 0, width: 280, height: 560, expandedHeight: 560, z: 1 } },
        page: { open: true, placement: 'docked', lastDock: { side: 'right', index: 2 }, dockBasis: 2500, collapsed: false, floating: { x: 0, y: 0, width: 280, height: 560, expandedHeight: 560, z: 1 } },
        ai: { open: true, placement: 'floating', lastDock: { side: 'right', index: 2 }, dockBasis: 1000, collapsed: false, floating: { x: 400, y: 100, width: 280, height: 500, expandedHeight: 500, z: 2 } }
      }
    })
    expect(result.version).toBe(PANEL_LAYOUT_VERSION)
    expect(result.docks.left.map((g) => g.members[0])).toEqual(['pages', 'layers'])
    expect(result.docks.right.map((g) => g.members[0])).toEqual(['transform', 'appearance', 'page'])
    expect(result.floats).toHaveLength(1)
    expect(result.floats[0].members).toEqual(['ai'])
    expect(result.floats[0].x).toBe(400)
  })

  test('migrates a v3 fixture through normalisePanelLayout', () => {
    const result = normalisePanelLayout({
      version: PANEL_LAYOUT_VERSION_V3,
      dockWidths: { left: 240, right: 280 },
      docks: { left: ['pages', 'layers'], right: ['transform', 'appearance', 'page'] },
      floats: [{ id: 'float:0', x: 100, y: 100, width: 280, height: 400, z: 1, members: ['code'] }],
      panels: {
        pages: { open: true, container: 'left', index: 0, lastDock: { side: 'left', index: 0 }, basis: 3000, collapsed: false, floatFallback: { x: 24, y: 24, width: 280, height: 560 } },
        layers: { open: true, container: 'left', index: 1, lastDock: { side: 'left', index: 1 }, basis: 7000, collapsed: false, floatFallback: { x: 64, y: 64, width: 280, height: 560 } },
        transform: { open: true, container: 'right', index: 0, lastDock: { side: 'right', index: 0 }, basis: 3500, collapsed: false, floatFallback: { x: 184, y: 184, width: 280, height: 560 } },
        appearance: { open: true, container: 'right', index: 1, lastDock: { side: 'right', index: 1 }, basis: 4000, collapsed: false, floatFallback: { x: 164, y: 164, width: 280, height: 560 } },
        page: { open: true, container: 'right', index: 2, lastDock: { side: 'right', index: 2 }, basis: 2500, collapsed: false, floatFallback: { x: 224, y: 224, width: 280, height: 560 } },
        code: { open: true, container: 'float:0', index: 0, lastDock: { side: 'right', index: 3 }, basis: 10000, collapsed: false, floatFallback: { x: 144, y: 144, width: 280, height: 560 } }
      }
    })
    expect(result.version).toBe(PANEL_LAYOUT_VERSION)
    expect(result.floats[0].members).toEqual(['code'])
    expect(result.panels.code.height).toBeNull()
  })
})

describe('clampRectToOverlay', () => {
  test('keeps the title bar reachable', () => {
    expect(
      clampRectToOverlay(
        { x: -4000, y: -2000, width: 300, height: 400 },
        { width: 900, height: 600 }
      )
    ).toEqual({ x: PANEL_MIN_VISIBLE - 300, y: 0, width: 300, height: 400 })
  })
})
