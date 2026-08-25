// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this file is outside tsconfig's `include` (tests/** is checked by Playwright, not Oxlint's standalone resolver), same as every *.spec.ts it is imported from.
import type { Locator, Page } from '@playwright/test'

// oxlint-disable-next-line typescript(TS2460) -- Oxlint's standalone resolver disagrees with the project type graph.
import type { Rect, Vector } from '@open-pencil/core'

import { expect } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import type { CanvasHelper } from '#tests/helpers/canvas'

export type PanelId =
  | 'pages'
  | 'assets'
  | 'layers'
  | 'swatches'
  | 'export'
  | 'variables'
  | 'ai'
  | 'code'
  | 'appearance'
  | 'transform'
  | 'text'
  | 'page'
  | 'guides'
  | 'mask'
  | 'component'

export interface StoredGroup {
  members: string[]
  active: string
  height: number | null
  collapsed: boolean
}
export interface StoredFloat {
  id: string
  members: string[]
  groups?: StoredGroup[]
  x: number
  y: number
  width: number
  height: number
  z: number
}
export interface StoredPanelLayout {
  docks: { left: StoredGroup[]; right: StoredGroup[] }
  floats: StoredFloat[]
}

export async function storageValue(page: Page, key: string): Promise<string | null> {
  const state = await page.context().storageState()
  const origin = state.origins.find((entry) => entry.origin === new URL(page.url()).origin)
  // oxlint-disable-next-line open-pencil/no-direct-storage-access -- Playwright's serialised storage snapshot is the test-safe read boundary.
  return origin?.localStorage.find((entry) => entry.name === key)?.value ?? null
}

export async function readPanelLayout(page: Page): Promise<StoredPanelLayout> {
  const raw = await storageValue(page, 'silverpoint:panel-layout')
  return expectDefined(raw ? JSON.parse(raw) : null, 'persisted panel layout')
}

export async function ensurePanelOpen(
  page: Page,
  canvas: CanvasHelper,
  id: PanelId,
  side: 'left' | 'right',
  index: number
): Promise<void> {
  await page.evaluate(({ id, side, index }) => {
    const key = 'silverpoint:panel-layout'
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup seeds the persisted panel layout.
    const stored = localStorage.getItem(key)
    const layout = stored
      ? JSON.parse(stored)
      : {
          version: 5,
          dockWidths: { left: 240, right: 280 },
          docks: {
            left: [
              { members: ['pages'], active: 'pages', height: 200, collapsed: false },
              { members: ['layers'], active: 'layers', height: null, collapsed: false }
            ],
            right: [
              { members: ['transform'], active: 'transform', height: null, collapsed: false },
              { members: ['appearance', 'text'], active: 'appearance', height: null, collapsed: false },
              { members: ['page', 'guides'], active: 'page', height: null, collapsed: false }
            ]
          },
          floats: [],
          panels: {}
        }
    layout.docks = layout.docks ?? { left: [], right: [] }
    layout.docks[side] = layout.docks[side] ?? []
    const alreadyPresent = layout.docks[side].some((g: unknown) =>
      typeof g === 'string'
        ? g === id
        : Array.isArray((g as StoredGroup).members) && (g as StoredGroup).members.includes(id)
    )
    if (!alreadyPresent) {
      const newGroup = { members: [id], active: id, height: null, collapsed: false }
      layout.docks[side].splice(Math.min(index, layout.docks[side].length), 0, newGroup)
    }
    layout.panels = layout.panels ?? {}
    layout.panels[id] = {
      ...layout.panels[id],
      open: true,
      container: side,
      groupIndex: index,
      tabIndex: 0,
      lastDock: { side, groupIndex: index, tabIndex: 0 },
      collapsed: false
    }
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup writes the persisted panel layout.
    localStorage.setItem(key, JSON.stringify(layout))
  }, { id, side, index })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
}

export async function seedGroupedPanels(
  page: Page,
  canvas: CanvasHelper,
  groups: { side: 'left' | 'right'; members: PanelId[]; height?: number | null; collapsed?: boolean }[]
): Promise<void> {
  await page.evaluate(({ groups }) => {
    const key = 'silverpoint:panel-layout'
    const docks: {
      left: Array<{ members: string[]; active: string; height: number | null; collapsed: boolean }>
      right: Array<{ members: string[]; active: string; height: number | null; collapsed: boolean }>
    } = {
      left: [],
      right: []
    }
    const panels: Record<string, Record<string, unknown>> = {}

    const ALL_IDS = [
      'pages',
      'assets',
      'layers',
      'swatches',
      'export',
      'variables',
      'ai',
      'code',
      'appearance',
      'transform',
      'text',
      'page',
      'guides',
      'mask',
      'component'
    ]

    const fallbacks: Record<string, Rect> = {
      pages: { x: 24, y: 24, width: 280, height: 560 },
      assets: { x: 44, y: 44, width: 280, height: 560 },
      layers: { x: 64, y: 64, width: 280, height: 560 },
      swatches: { x: 304, y: 160, width: 280, height: 560 },
      export: { x: 84, y: 84, width: 280, height: 560 },
      variables: { x: 104, y: 104, width: 280, height: 560 },
      ai: { x: 124, y: 124, width: 280, height: 560 },
      code: { x: 144, y: 144, width: 280, height: 560 },
      appearance: { x: 164, y: 164, width: 280, height: 560 },
      transform: { x: 184, y: 184, width: 280, height: 560 },
      text: { x: 204, y: 204, width: 280, height: 560 },
      page: { x: 224, y: 224, width: 280, height: 560 },
      guides: { x: 244, y: 244, width: 280, height: 560 },
      mask: { x: 264, y: 264, width: 280, height: 560 },
      component: { x: 284, y: 284, width: 280, height: 560 }
    }

    for (const id of ALL_IDS) {
      panels[id] = {
        open: false,
        container: null,
        groupIndex: 0,
        tabIndex: 0,
        lastDock: { side: 'left', groupIndex: 0, tabIndex: 0 },
        height: null,
        collapsed: false,
        floatFallback: fallbacks[id] ?? { x: 100, y: 100, width: 280, height: 560 }
      }
    }

    for (const spec of groups) {
      const groupIndex = docks[spec.side].length
      const height = spec.height ?? null
      const collapsed = spec.collapsed ?? false
      docks[spec.side].push({
        members: [...spec.members],
        active: spec.members[0],
        height,
        collapsed
      })
      spec.members.forEach((member, tabIndex) => {
        panels[member] = {
          open: true,
          container: spec.side,
          groupIndex,
          tabIndex,
          lastDock: { side: spec.side, groupIndex, tabIndex },
          height,
          collapsed,
          floatFallback: fallbacks[member] ?? { x: 100, y: 100, width: 280, height: 560 }
        }
      })
    }

    const layout = {
      version: 5,
      dockWidths: { left: 240, right: 280 },
      docks,
      floats: [],
      panels
    }

    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup writes the persisted panel layout.
    localStorage.setItem(key, JSON.stringify(layout))
  }, { groups })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
}

export async function tabStripFor(
  page: Page,
  id: PanelId
): Promise<{ locator: Locator; containerId: string; groupIndex: string }> {
  const locator = page
    .getByTestId(/^panel-tab-strip-/)
    .filter({ has: page.getByTestId(`panel-tab-${id}`) })
  const testId = expectDefined(await locator.getAttribute('data-test-id'), `${id} tab strip test id`)
  const match = /^panel-tab-strip-(.+)-(\d+)$/.exec(testId)
  const [, containerId, groupIndex] = expectDefined(match, `${id} tab strip test id shape`)
  return { locator, containerId, groupIndex }
}

/**
 * Drags a panel's tab to an absolute page point and releases there.
 * Unlike `dragFloatTo` (which nudges an already-floating container by a
 * relative delta for snap testing), this works whether the panel starts
 * docked or floating, alone or in a stack: a tab drag always detaches
 * only that one panel into a brand new float on the first move, then the
 * drop resolves from wherever it lands - the same path `resolveDropTarget()`
 * drives in `drag.ts`.
 */
export async function dragTitleBarTo(
  page: Page,
  id: PanelId,
  target: Vector,
  options: { alt?: boolean; release?: boolean } = {}
): Promise<void> {
  const tabLoc = page.getByTestId(`panel-tab-${id}`)
  await tabLoc.scrollIntoViewIfNeeded()
  const tab = expectDefined(
    await tabLoc.boundingBox(),
    `${id} tab bounds`
  )
  await page.mouse.move(tab.x + 10, tab.y + tab.height / 2)
  await page.mouse.down()
  if (options.alt) await page.keyboard.down('Alt')
  await page.mouse.move(target.x, target.y, { steps: 12 })
  await page.waitForTimeout(50)

  if (options.release !== false) {
    await page.mouse.up()
    if (options.alt) await page.keyboard.up('Alt')
    await page.waitForTimeout(100)
  }
}

/**
 * Drags a panel's tab to a target point. Wrapper for dragTitleBarTo (T-070d2b).
 */
export async function dragTabTo(
  page: Page,
  id: PanelId,
  target: Vector,
  options: { alt?: boolean; release?: boolean } = {}
): Promise<void> {
  return dragTitleBarTo(page, id, target, options)
}

/**
 * Drags a whole group by its tab strip's empty spacer - never a tab
 * button, never a group control. `groupIndex` is the group's CURRENT
 * index in `containerId` before the drag starts.
 */
export async function dragTabStripTo(
  page: Page,
  containerId: string,
  groupIndex: number,
  target: Vector,
  options: { alt?: boolean; release?: boolean } = {}
): Promise<void> {
  const strip = page.getByTestId(`panel-tab-strip-${containerId}-${groupIndex}`)
  await strip.scrollIntoViewIfNeeded()
  const bounds = expectDefined(await strip.boundingBox(), `${containerId}-${groupIndex} tab strip bounds`)

  const spacer = strip.locator('div.flex-1')
  const spacerBox = await spacer.boundingBox()
  const clickX = spacerBox && spacerBox.width > 0
    ? spacerBox.x + spacerBox.width / 2
    : bounds.x + bounds.width - 85
  const clickY = bounds.y + bounds.height / 2

  await page.mouse.move(clickX, clickY)
  await page.mouse.down()
  if (options.alt) await page.keyboard.down('Alt')
  await page.mouse.move(target.x, target.y, { steps: 12 })
  await page.waitForTimeout(50)

  if (options.release !== false) {
    await page.mouse.up()
    if (options.alt) await page.keyboard.up('Alt')
    await page.waitForTimeout(100)
  }
}

/** The floating window (container) currently hosting this panel - not keyed by panel id, since a container can hold several panels. */
export function floatingWindowFor(page: Page, id: PanelId): Locator {
  return page.getByTestId(/^floating-panel-/).filter({ has: page.getByTestId(`stack-member-${id}`) })
}

export async function floatPanel(page: Page, id: PanelId): Promise<void> {
  const { containerId, groupIndex } = await tabStripFor(page, id)
  await page.getByTestId(`panel-group-float-${containerId}-${groupIndex}`).click()
  await expect(floatingWindowFor(page, id)).toBeVisible()
}

/** Drags an already-floating container by a relative delta from its current position - for snap/resize tests where the exact absolute target does not matter. */
export async function dragFloatTo(
  page: Page,
  id: PanelId,
  target: Vector,
  options: { alt?: boolean; release?: boolean } = {}
): Promise<void> {
  const windowEl = floatingWindowFor(page, id)
  const container = expectDefined(
    await windowEl.boundingBox(),
    `${id} floating container bounds`
  )
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), `${id} container id`)
  const titleBar = page.getByTestId(`float-title-${containerId}`)
  const title = (await titleBar.isVisible())
    ? expectDefined(await titleBar.boundingBox(), `${id} float title bounds`)
    : container
  const startX = title.x + Math.min(24, title.width / 2)
  const startY = title.y + title.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  if (options.alt) await page.keyboard.down('Alt')
  await page.mouse.move(startX + target.x - container.x, startY + target.y - container.y, { steps: 12 })
  await page.waitForTimeout(50)

  if (options.release !== false) {
    await page.mouse.up()
    if (options.alt) await page.keyboard.up('Alt')
  }
}

/**
 * Drags a float container's title bar by a relative delta - moves every member
 * together. Presses the centre of the window's float title bar.
 */
export async function dragFloatTitleTo(page: Page, id: PanelId, dx: number, dy: number): Promise<void> {
  const windowEl = floatingWindowFor(page, id)
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), `${id} container id`)
  const titleBar = page.getByTestId(`float-title-${containerId}`)
  const barBounds = expectDefined(await titleBar.boundingBox(), `${id} float title bar bounds`)
  const barX = barBounds.x + barBounds.width / 2
  const barY = barBounds.y + barBounds.height / 2
  await page.mouse.move(barX, barY)
  await page.mouse.down()
  await page.mouse.move(barX + dx, barY + dy, { steps: 10 })
  await page.mouse.up()
}

export async function openViewMenu(page: Page): Promise<void> {
  const trigger = page.getByTestId('app-icon-menu-trigger')
  if (await trigger.isVisible()) {
    await trigger.click()
    const viewGroup = page.getByTestId('app-menu-group-view')
    if (await viewGroup.isVisible()) {
      await viewGroup.hover()
      await page.waitForTimeout(100)
      return
    }
  }
  const viewItem = page.getByRole('menuitem', { name: 'View', exact: true })
  await viewItem.click()
}
