/* oxlint-disable max-lines */
// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

import {
  dragTabStripTo,
  dragTabTo,
  floatingWindowFor,
  readPanelLayout,
  seedGroupedPanels,
  storageValue
} from './helpers'

let canvas: CanvasHelper

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000)
  canvas = new CanvasHelper(page)
  await page.goto('/?test', { waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
})

test('tab strip renders multiple tabs in a group and switches active tab on click', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'left', members: ['pages', 'layers'] }])

  const tabPages = page.getByTestId('panel-tab-pages')
  const tabLayers = page.getByTestId('panel-tab-layers')
  const pagesBody = page.getByTestId('workspace-panel-pages')
  const layersBody = page.getByTestId('workspace-panel-layers')

  await expect(tabPages).toBeVisible()
  await expect(tabLayers).toBeVisible()
  await expect(tabPages).toHaveAttribute('aria-selected', 'true')
  await expect(tabLayers).toHaveAttribute('aria-selected', 'false')
  await expect(pagesBody).toBeVisible()
  await expect(layersBody).toBeHidden()

  await tabLayers.click()

  await expect(tabPages).toHaveAttribute('aria-selected', 'false')
  await expect(tabLayers).toHaveAttribute('aria-selected', 'true')
  await expect(pagesBody).toBeHidden()
  await expect(layersBody).toBeVisible()

  canvas.assertNoErrors()
})

test('teleport survival: typed content survives switching tabs and switching back', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'right', members: ['code', 'appearance'] }])

  const tabCode = page.getByTestId('panel-tab-code')
  const tabAppearance = page.getByTestId('panel-tab-appearance')
  const codeInput = page.getByTestId('code-panel-import-html')
  const codeBody = page.getByTestId('workspace-panel-code')
  const appearanceBody = page.getByTestId('workspace-panel-appearance')

  await expect(tabCode).toBeVisible()
  await expect(tabAppearance).toBeVisible()
  await expect(codeInput).toBeVisible()
  await codeInput.fill('<div class="test-survives">tab switch</div>')

  // Switch to Appearance tab
  await tabAppearance.click()
  await expect(tabAppearance).toHaveAttribute('aria-selected', 'true')
  await expect(tabCode).toHaveAttribute('aria-selected', 'false')
  await expect(codeBody).toBeHidden()
  await expect(appearanceBody).toBeVisible()

  // Switch back to Code tab
  await tabCode.click()
  await expect(tabCode).toHaveAttribute('aria-selected', 'true')
  await expect(tabAppearance).toHaveAttribute('aria-selected', 'false')
  await expect(codeBody).toBeVisible()
  await expect(codeInput).toBeVisible()
  await expect(codeInput).toHaveValue('<div class="test-survives">tab switch</div>')

  canvas.assertNoErrors()
})

test('per-tab close button removes only that tab while preserving the other group member', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'left', members: ['pages', 'layers'] }])

  await expect(page.getByTestId('panel-tab-pages')).toBeVisible()
  await expect(page.getByTestId('panel-tab-layers')).toBeVisible()

  await page.getByTestId('panel-tab-close-layers').click()

  await expect(page.getByTestId('panel-tab-layers')).toBeHidden()
  await expect(page.getByTestId('panel-tab-pages')).toBeVisible()
  await expect(page.getByTestId('panel-tab-strip-left-0')).toBeVisible()

  canvas.assertNoErrors()
})

test('closing the last tab of a group removes the group entirely', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'left', members: ['layers'] }])

  await expect(page.getByTestId('panel-tab-strip-left-0')).toBeVisible()
  await page.getByTestId('panel-tab-close-layers').click()

  await expect(page.getByTestId('panel-tab-strip-left-0')).toBeHidden()
  await expect(page.getByTestId('panel-tab-layers')).toBeHidden()

  canvas.assertNoErrors()
})

test('group close button closes all member panels and removes the group', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'left', members: ['pages', 'layers'] }])

  await expect(page.getByTestId('panel-tab-strip-left-0')).toBeVisible()
  await page.getByTestId('panel-group-close-left-0').click()

  await expect(page.getByTestId('panel-tab-strip-left-0')).toBeHidden()
  await expect(page.getByTestId('panel-tab-pages')).toBeHidden()
  await expect(page.getByTestId('panel-tab-layers')).toBeHidden()

  canvas.assertNoErrors()
})

test('group collapse button and double-click collapse group to 33px rail and restore height with content intact', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'right', members: ['code', 'appearance'] }])

  const codeInput = page.getByTestId('code-panel-import-html')
  await expect(codeInput).toBeVisible()
  await codeInput.fill('<div class="collapse-test">preserved</div>')

  const strip = page.getByTestId('panel-tab-strip-right-0')
  const memberSection = page.getByTestId('stack-member-code')

  const initialHeight = expectDefined(await memberSection.boundingBox(), 'initial group height').height
  expect(initialHeight).toBeGreaterThan(50)

  // Collapse via group collapse button
  await page.getByTestId('panel-group-collapse-right-0').click()
  const collapsedHeight = expectDefined(await memberSection.boundingBox(), 'collapsed height').height
  expect(Math.abs(collapsedHeight - 33)).toBeLessThanOrEqual(2)

  // Expand via group collapse button
  await page.getByTestId('panel-group-collapse-right-0').click()
  await expect(codeInput).toBeVisible()
  await expect(codeInput).toHaveValue('<div class="collapse-test">preserved</div>')

  // Collapse via double click on empty area of tab strip
  await strip.dblclick({ position: { x: 200, y: 15 } })
  const dblCollapsedHeight = expectDefined(await memberSection.boundingBox(), 'dblclick collapsed height').height
  expect(Math.abs(dblCollapsedHeight - 33)).toBeLessThanOrEqual(2)

  // Expand via double click
  await strip.dblclick({ position: { x: 200, y: 15 } })
  await expect(codeInput).toBeVisible()
  await expect(codeInput).toHaveValue('<div class="collapse-test">preserved</div>')

  canvas.assertNoErrors()
})

test('group pin button floats a multi-member group to a floating window and docks back', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [{ side: 'left', members: ['pages', 'layers'] }])

  // Float the group
  await page.getByTestId('panel-group-float-left-0').click()

  const floatWindow = floatingWindowFor(page, 'pages')
  await expect(floatWindow).toBeVisible()
  await expect(floatWindow.getByTestId('panel-tab-pages')).toBeVisible()
  await expect(floatWindow.getByTestId('panel-tab-layers')).toBeVisible()

  const containerId = expectDefined(await floatWindow.getAttribute('data-container-id'), 'float container id')

  // Unpin to dock back
  await page.getByTestId(`panel-group-float-${containerId}-0`).click()
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-pages')).toBeVisible()
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-layers')).toBeVisible()

  canvas.assertNoErrors()
})

test('tab drop onto group body at caret 0, middle, and append reorders tabs, activates moved tab, and updates persisted storage', async ({ page }) => {
  // 1. Drop at caret 0 (before first tab)
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages'] },
    { side: 'right', members: ['transform', 'appearance', 'page'] }
  ])

  const rightGroup = page.getByTestId('stack-member-transform')
  const rightGroupRect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')
  const tabTransform = expectDefined(await page.getByTestId('panel-tab-transform').boundingBox(), 'transform tab bounds')

  // Drag to caret 0 (x coordinate left of transform tab midpoint, y well inside group body)
  const bodyY = rightGroupRect.y + 60
  await dragTabTo(page, 'pages', { x: tabTransform.x + 5, y: bodyY }, { release: false })

  // Assert preview indicators: ring on target group + caret at index 0, no seam or empty-dock target
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await expect(page.getByTestId('panel-empty-dock-target')).toHaveCount(0)
  await expect(page.getByTestId('panel-snap-guide')).toHaveCount(0)

  await page.mouse.up()
  await page.waitForTimeout(100)

  // Assert persisted layout and active tab
  let layout = await readPanelLayout(page)
  expect(layout.docks.right[0].members).toEqual(['pages', 'transform', 'appearance', 'page'])
  expect(layout.docks.right[0].active).toBe('pages')
  expect(layout.docks.left).toHaveLength(0)
  await expect(page.getByTestId('panel-tab-pages')).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)

  // 2. Drop at append (caret at end)
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  const tabAppearance = expectDefined(await page.getByTestId('panel-tab-appearance').boundingBox(), 'appearance tab bounds')
  // Drag to x past appearance midpoint, y in body
  await dragTabTo(page, 'pages', { x: tabAppearance.x + tabAppearance.width + 20, y: bodyY }, { release: false })

  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)

  await page.mouse.up()
  await page.waitForTimeout(100)

  layout = await readPanelLayout(page)
  expect(layout.docks.right[0].members).toEqual(['transform', 'appearance', 'pages'])
  expect(layout.docks.right[0].active).toBe('pages')

  canvas.assertNoErrors()
})

test('same-group tab reorder without duplication', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'right', members: ['transform', 'appearance', 'text'] }
  ])

  const groupRect = expectDefined(await page.getByTestId('stack-member-transform').boundingBox(), 'group bounds')
  const tabText = expectDefined(await page.getByTestId('panel-tab-text').boundingBox(), 'text tab bounds')

  // Drag 'transform' (first tab) past 'text' tab to append at the end
  await dragTabTo(page, 'transform', { x: tabText.x + tabText.width + 15, y: groupRect.y + 60 }, { release: false })

  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)

  await page.mouse.up()
  await page.waitForTimeout(100)

  const layout = await readPanelLayout(page)
  expect(layout.docks.right[0].members).toEqual(['appearance', 'text', 'transform'])
  expect(layout.docks.right[0].active).toBe('transform')

  canvas.assertNoErrors()
})

test('seam zone vs body zone: at 27px and 28px seam wins, at 29px and middle body ring and caret win', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages'] },
    { side: 'right', members: ['code', 'appearance'] }
  ])

  const rightGroup = page.getByTestId('stack-member-code')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')
  expect(rect.height).toBeGreaterThanOrEqual(56)
  const targetX = rect.x + 50

  // 1. Top seam zone: 27px from top -> seam wins
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + 27 }, { release: false })
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 2. Top seam boundary: 28px from top -> seam wins
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + 28 }, { release: false })
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 3. Top body boundary: 29px from top -> body ring and caret win
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + 29 }, { release: false })
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 4. Middle of body -> body ring and caret win
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + rect.height / 2 }, { release: false })
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 5. Bottom body boundary: 29px from bottom -> body ring and caret win
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + rect.height - 29 }, { release: false })
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 6. Bottom seam boundary: 28px from bottom -> seam wins
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + rect.height - 28 }, { release: false })
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)

  // 7. Bottom seam zone: 27px from bottom -> seam wins
  await dragTabTo(page, 'pages', { x: targetX, y: rect.y + rect.height - 27 }, { release: false })
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)

  // Release on seam -> commits as separate group at index 1
  await page.mouse.up()
  await page.waitForTimeout(100)

  const layout = await readPanelLayout(page)
  expect(layout.docks.right).toHaveLength(2)
  expect(layout.docks.right[0].members).toEqual(['code', 'appearance'])
  expect(layout.docks.right[1].members).toEqual(['pages'])

  canvas.assertNoErrors()
})

test('Escape during tab preview restores storage byte-for-byte and clears all indicators', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  const before = await storageValue(page, 'silverpoint:panel-layout')
  const rightGroup = page.getByTestId('stack-member-transform')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')

  // Drag 'pages' over right group body with Alt key held
  await dragTabTo(page, 'pages', { x: rect.x + 50, y: rect.y + rect.height / 2 }, { alt: true, release: false })

  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(1)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(1)
  await expect(page.getByTestId('panel-snap-guide')).toHaveCount(0)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await expect(page.getByTestId('panel-empty-dock-target')).toHaveCount(0)

  // Press Escape to cancel
  await page.keyboard.press('Escape')
  await page.keyboard.up('Alt')
  await page.waitForTimeout(100)

  // Verify storage is restored byte-for-byte
  expect(await storageValue(page, 'silverpoint:panel-layout')).toBe(before)

  // Indicators reverted
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-pages')).toBeVisible()

  canvas.assertNoErrors()
})

test('empty-dock edge band still previews and commits and never coexists with tab indicators', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  // Left dock is empty. Drag 'transform' tab to left edge band
  await dragTabTo(page, 'transform', { x: 40, y: 200 }, { release: false })

  await expect(page.getByTestId('panel-empty-dock-target')).toBeVisible()
  await expect(page.getByTestId('panel-empty-dock-target')).toHaveAttribute('data-side', 'left')
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)

  await page.mouse.up()
  await page.waitForTimeout(100)

  const layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(1)
  expect(layout.docks.left[0].members).toEqual(['transform'])
  expect(layout.docks.right[0].members).toEqual(['appearance'])

  canvas.assertNoErrors()
})

test('whole-group drag moves multi-member group to another dock seam and preserves member order, active tab, height and collapsed state', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'], height: 250, collapsed: false },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  // Select layers tab in left group so active tab is 'layers'
  await page.getByTestId('panel-tab-layers').click()
  await expect(page.getByTestId('panel-tab-layers')).toHaveAttribute('aria-selected', 'true')

  // Target: below the right dock's group
  const rightGroup = page.getByTestId('stack-member-transform')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')
  const targetX = rect.x + rect.width / 2
  const targetY = rect.y + rect.height + 20

  // Drag the left group by its tab strip spacer to the bottom of the right dock
  await dragTabStripTo(page, 'left', 0, { x: targetX, y: targetY })

  const layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(0)
  expect(layout.docks.right).toHaveLength(2)
  expect(layout.docks.right[1].members).toEqual(['pages', 'layers'])
  expect(layout.docks.right[1].active).toBe('layers')
  expect(layout.docks.right[1].height).toBe(250)
  expect(layout.docks.right[1].collapsed).toBe(false)

  canvas.assertNoErrors()
})

test('whole-group drag preserves collapsed and pinned height values across moves', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'], collapsed: true },
    { side: 'right', members: ['code', 'appearance'], height: 350, collapsed: false }
  ])

  // Verify left group starts collapsed
  const leftStrip = page.getByTestId('panel-tab-strip-left-0')
  await expect(leftStrip).toHaveAttribute('aria-expanded', 'false')

  // Drag collapsed left group to bottom of right dock
  const rightGroup = page.getByTestId('stack-member-code')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')
  await dragTabStripTo(page, 'left', 0, { x: rect.x + rect.width / 2, y: rect.y + rect.height + 20 })

  const layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(0)
  expect(layout.docks.right).toHaveLength(2)
  expect(layout.docks.right[0].members).toEqual(['code', 'appearance'])
  expect(layout.docks.right[0].height).toBe(350)
  expect(layout.docks.right[1].members).toEqual(['pages', 'layers'])
  expect(layout.docks.right[1].collapsed).toBe(true)

  canvas.assertNoErrors()
})

test('whole-group drag shows only seam or edge indicators and never drop-ring or tab-caret', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  const rightGroup = page.getByTestId('stack-member-transform')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')

  // 1. Drag over body of right group
  await dragTabStripTo(page, 'left', 0, { x: rect.x + 50, y: rect.y + rect.height / 2 }, { release: false })

  // Seam indicator should be active (because allowTab: false resolves to nearest seam), NOT drop ring or tab caret
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)

  // 2. Drag over empty left dock area (edge band)
  await page.mouse.move(30, 200, { steps: 8 })
  await page.waitForTimeout(50)
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await expect(page.getByTestId('panel-empty-dock-target')).toBeVisible()

  await page.keyboard.press('Escape')
  await page.waitForTimeout(50)
  canvas.assertNoErrors()
})

test('Escape mid-drag restores layout byte-for-byte and clears all group drag indicators', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  const before = await storageValue(page, 'silverpoint:panel-layout')
  const rightGroup = page.getByTestId('stack-member-transform')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')

  await dragTabStripTo(page, 'left', 0, { x: rect.x + 50, y: rect.y + rect.height / 2 }, { release: false })

  // Verify indicator is active
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(1)

  // Press Escape to cancel
  await page.keyboard.press('Escape')
  await page.waitForTimeout(100)

  // Layout restored byte-for-byte
  expect(await storageValue(page, 'silverpoint:panel-layout')).toBe(before)

  // Indicators cleared
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await expect(page.getByTestId('panel-empty-dock-target')).toHaveCount(0)
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-pages')).toBeVisible()

  canvas.assertNoErrors()
})

test('pressing an individual tab moves only that one tab while rest of group remains', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  const rightGroup = page.getByTestId('stack-member-transform')
  const rect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')

  // Drag only the 'layers' tab to the bottom of the right dock
  await dragTabTo(page, 'layers', { x: rect.x + rect.width / 2, y: rect.y + rect.height + 20 })

  const layout = await readPanelLayout(page)
  expect(layout.docks.left[0].members).toEqual(['pages'])
  expect(layout.docks.right[1].members).toEqual(['layers'])

  canvas.assertNoErrors()
})

test('pressing float, collapse, and close buttons performs only that action with no drag started', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] }
  ])

  // 1. Collapse button
  await page.getByTestId('panel-group-collapse-left-0').click()
  await expect(page.getByTestId('panel-tab-strip-left-0')).toHaveAttribute('aria-expanded', 'false')
  let layout = await readPanelLayout(page)
  expect(layout.docks.left[0].members).toEqual(['pages', 'layers'])
  expect(layout.docks.left[0].collapsed).toBe(true)

  // 2. Expand back
  await page.getByTestId('panel-group-collapse-left-0').click()
  await expect(page.getByTestId('panel-tab-strip-left-0')).toHaveAttribute('aria-expanded', 'true')

  // 3. Float button
  await page.getByTestId('panel-group-float-left-0').click()
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-strip-left-0')).toHaveCount(0)
  layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(0)
  expect(layout.floats).toHaveLength(1)
  expect(layout.floats[0].groups[0].members).toEqual(['pages', 'layers'])

  // 4. Close button on the floating group
  const floatId = layout.floats[0].id
  await page.getByTestId(`panel-group-close-${floatId}-0`).click()
  layout = await readPanelLayout(page)
  expect(layout.floats).toHaveLength(0)

  canvas.assertNoErrors()
})

test('double-clicking the empty tab-strip area toggles collapse without moving the group', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] }
  ])

  const strip = page.getByTestId('panel-tab-strip-left-0')
  const bounds = expectDefined(await strip.boundingBox(), 'tab strip bounds')
  const spacer = strip.locator('div.flex-1')
  const spacerBox = expectDefined(await spacer.boundingBox(), 'spacer bounds')
  const clickX = spacerBox.x + spacerBox.width / 2
  const clickY = bounds.y + bounds.height / 2

  // Double click in the empty spacer area
  await page.mouse.dblclick(clickX, clickY)
  await expect(strip).toHaveAttribute('aria-expanded', 'false')

  let layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(1)
  expect(layout.docks.left[0].members).toEqual(['pages', 'layers'])
  expect(layout.docks.left[0].collapsed).toBe(true)

  // Double click again to expand
  await page.mouse.dblclick(clickX, clickY)
  await expect(strip).toHaveAttribute('aria-expanded', 'true')

  layout = await readPanelLayout(page)
  expect(layout.docks.left).toHaveLength(1)
  expect(layout.docks.left[0].members).toEqual(['pages', 'layers'])
  expect(layout.docks.left[0].collapsed).toBe(false)

  canvas.assertNoErrors()
})

test('dragging float window by its title bar moves the window with no drop-target indicator', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] },
    { side: 'right', members: ['transform', 'appearance'] }
  ])

  // Float the left group
  await page.getByTestId('panel-group-float-left-0').click()
  const windowEl = floatingWindowFor(page, 'pages')
  await expect(windowEl).toBeVisible()
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), 'container id')

  const titleBar = page.getByTestId(`float-title-${containerId}`)
  const barBounds = expectDefined(await titleBar.boundingBox(), 'float title bounds')

  // Start dragging title bar over right dock
  const rightGroup = page.getByTestId('stack-member-transform')
  const rightRect = expectDefined(await rightGroup.boundingBox(), 'right group bounds')

  await page.mouse.move(barBounds.x + barBounds.width / 2, barBounds.y + barBounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(rightRect.x + 50, rightRect.y + rightRect.height / 2, { steps: 10 })
  await page.waitForTimeout(50)

  // Whole-window drag (startContainerDrag) must NEVER show drop-target indicators
  await expect(page.getByTestId('panel-group-drop-ring')).toHaveCount(0)
  await expect(page.getByTestId('panel-tab-caret')).toHaveCount(0)
  await expect(page.locator('[data-dock-insertion-target][data-active=""]')).toHaveCount(0)
  await expect(page.getByTestId('panel-empty-dock-target')).toHaveCount(0)

  await page.mouse.up()
  await page.waitForTimeout(50)

  // Group remains in float container, not docked
  const layout = await readPanelLayout(page)
  expect(layout.floats).toHaveLength(1)
  expect(layout.floats[0].groups[0].members).toEqual(['pages', 'layers'])

  canvas.assertNoErrors()
})

test('holding Alt during group drag disables float-to-float snap guides', async ({ page }) => {
  await seedGroupedPanels(page, canvas, [
    { side: 'left', members: ['pages', 'layers'] }
  ])

  // Float the left group first so there's a floating container in the canvas
  await page.getByTestId('panel-group-float-left-0').click()
  const windowEl = floatingWindowFor(page, 'pages')
  await expect(windowEl).toBeVisible()
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), 'container id')

  // Drag the group by its tab strip spacer with Alt held into open canvas
  await dragTabStripTo(page, containerId, 0, { x: 500, y: 300 }, { alt: true, release: false })

  // Snap guides must remain 0 while Alt is held
  await expect(page.getByTestId('panel-snap-guide')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await page.keyboard.up('Alt')
  await page.waitForTimeout(50)

  canvas.assertNoErrors()
})


