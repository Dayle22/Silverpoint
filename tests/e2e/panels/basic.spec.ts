// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

import {
  dragFloatTo,
  dragTitleBarTo,
  ensurePanelOpen,
  floatingWindowFor,
  floatPanel,
  openViewMenu,
  readPanelLayout,
  storageValue,
  tabStripFor
} from './helpers'

let canvas: CanvasHelper

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000)
  canvas = new CanvasHelper(page)
  await page.goto('/?test', { waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
})

test('legacy docked splitter resize persists and UI toggle still works', async ({ page }) => {
  const panel = page.getByTestId('workspace-panel-layers')
  const before = expectDefined(await panel.boundingBox(), 'layers panel bounds')
  const handle = expectDefined(
    await page.getByTestId('dock-stack-left').getByTestId('dock-width-divider').boundingBox(),
    'splitter handle bounds'
  )
  const cx = handle.x + 2
  const cy = handle.y + handle.height / 2

  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy, { steps: 10 })
  await page.mouse.up()
  await canvas.waitForRender()

  const resized = expectDefined(await panel.boundingBox(), 'resized layers panel bounds')
  expect(resized.width).toBeGreaterThan(before.width + 40)

  await page.waitForTimeout(300)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
  const reloaded = expectDefined(await panel.boundingBox(), 'reloaded layers panel bounds')
  expect(Math.abs(reloaded.width - resized.width)).toBeLessThanOrEqual(2)

  await page.keyboard.press('Control+\\')
  await expect(panel).not.toBeVisible()
  await page.keyboard.press('Control+\\')
  await expect(panel).toBeVisible()
  canvas.assertNoErrors()
})

test('each panel floats independently; dragging snaps, Alt bypasses snapping, and resize persists', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'code', 'right', 2)
  await floatPanel(page, 'layers')
  await floatPanel(page, 'code')

  const overlay = expectDefined(
    await page.getByTestId('panel-overlay').boundingBox(),
    'panel overlay bounds'
  )

  // Move 'code' into open canvas space, clear of both docks (a dock target -
  // which disables snap, same as Alt - takes precedence whenever the pointer
  // is over a live dock's own rect; not something this floating-to-floating
  // snap test should fight). The docks occupy roughly [0,240] and
  // [1000,1280] at this 1280-wide viewport, so mid-canvas is dock-free.
  await dragFloatTo(page, 'code', { x: overlay.x + 500, y: overlay.y + 260 })
  const codeAnchor = expectDefined(
    await floatingWindowFor(page, 'code').boundingBox(),
    'anchored code container bounds'
  )

  // A point close enough to snap onto code's right edge (top-aligned).
  const nearCodeEdge = { x: codeAnchor.x + codeAnchor.width + 4, y: codeAnchor.y + 3 }

  await dragFloatTo(page, 'layers', nearCodeEdge, { release: false })
  await expect(page.getByTestId('panel-snap-guide').first()).toBeVisible()
  await page.mouse.up()
  const snapped = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'snapped layers container bounds'
  )
  expect(Math.abs(snapped.x - (codeAnchor.x + codeAnchor.width))).toBeLessThanOrEqual(1)
  expect(Math.abs(snapped.y - codeAnchor.y)).toBeLessThanOrEqual(1)

  const bypassTarget = { x: nearCodeEdge.x, y: codeAnchor.y + 60 }
  await dragFloatTo(page, 'layers', bypassTarget, { alt: true, release: false })
  await expect(page.getByTestId('panel-snap-guide')).toHaveCount(0)
  await page.mouse.up()
  await page.keyboard.up('Alt')
  const bypassed = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'Alt-bypassed layers container bounds'
  )
  expect(Math.abs(bypassed.x - bypassTarget.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(bypassed.y - bypassTarget.y)).toBeLessThanOrEqual(1)

  await dragFloatTo(page, 'layers', { x: overlay.x + 420, y: overlay.y + 180 })

  const resizeHandle = expectDefined(
    await floatingWindowFor(page, 'layers').getByTestId(/-resize-e$/).boundingBox(),
    'east resize handle bounds'
  )
  const widthBefore = bypassed.width
  const resizeStartX = resizeHandle.x + 1
  const resizeStartY = resizeHandle.y + resizeHandle.height / 2
  await page.mouse.move(resizeStartX, resizeStartY)
  await page.mouse.down()
  await page.mouse.move(resizeStartX + 70, resizeStartY, { steps: 10 })
  await page.mouse.up()
  const resized = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'resized floating container bounds'
  )
  expect(resized.width).toBeGreaterThan(widthBefore + 40)
  canvas.assertNoErrors()
})

test('double-click minimise preserves Code state and panel layout persists on reload', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'code', 'right', 2)
  await floatPanel(page, 'layers')
  await floatPanel(page, 'code')
  await expect(page.getByTestId('code-panel-root')).toBeVisible()

  const expanded = expectDefined(
    await floatingWindowFor(page, 'code').boundingBox(),
    'expanded code container bounds'
  )
  await (await tabStripFor(page, 'code')).locator.dblclick({ position: { x: 120, y: 15 } })
  await expect(floatingWindowFor(page, 'code')).toHaveAttribute('data-collapsed', '')
  const collapsed = expectDefined(
    await floatingWindowFor(page, 'code').boundingBox(),
    'collapsed code container bounds'
  )
  expect(collapsed.height).toBeLessThan(70)

  await (await tabStripFor(page, 'code')).locator.dblclick({ position: { x: 120, y: 15 } })
  const restored = expectDefined(
    await floatingWindowFor(page, 'code').boundingBox(),
    'restored code container bounds'
  )
  expect(Math.abs(restored.height - expanded.height)).toBeLessThanOrEqual(2)

  await (await tabStripFor(page, 'code')).locator.dblclick({ position: { x: 120, y: 15 } })
  const storedBefore = await storageValue(page, 'silverpoint:panel-layout')
  expect(storedBefore).not.toBeNull()

  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
  await expect(floatingWindowFor(page, 'layers')).toBeVisible()
  await expect(floatingWindowFor(page, 'code')).toHaveAttribute('data-collapsed', '')
  expect(await storageValue(page, 'silverpoint:panel-layout')).toBe(storedBefore)

  await (await tabStripFor(page, 'code')).locator.dblclick({ position: { x: 120, y: 15 } })
  canvas.assertNoErrors()
})

test('panels re-dock, collapse to title bars, and View reset preserves unrelated state', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'code', 'right', 2)
  await floatPanel(page, 'layers')

  // 'pages' is now the left dock's only member; a point in its lower half is
  // the "append after pages" seam (post-removal index 1), resolved
  // geometrically from the panel's own rect - not from any indicator strip.
  const pagesRect = expectDefined(
    await page.getByTestId('stack-member-pages').boundingBox(),
    'pages dock member bounds'
  )
  await dragTitleBarTo(page, 'layers', {
    x: pagesRect.x + pagesRect.width / 2,
    y: pagesRect.y + pagesRect.height - 10
  })
  await expect(page.getByTestId('dock-stack-left').getByTestId('dock-width-divider')).toBeVisible()
  expect((await readPanelLayout(page)).docks.left.flatMap((g) => g.members)).toEqual(['pages', 'layers'])

  const layersStrip = await tabStripFor(page, 'layers')
  await layersStrip.locator.dblclick({ position: { x: 120, y: 15 } })
  await expect(layersStrip.locator).toHaveAttribute('aria-expanded', 'false')
  expect(
    expectDefined(
      await page.getByTestId('stack-member-layers').boundingBox(),
      'collapsed layers dock member'
    ).height
  ).toBeLessThan(40)
  await page.getByTestId(`panel-group-collapse-${layersStrip.containerId}-${layersStrip.groupIndex}`).click()
  await expect(page.getByTestId('workspace-panel-layers')).toBeVisible()

  const codeStrip = await tabStripFor(page, 'code')
  await codeStrip.locator.dblclick({ position: { x: 120, y: 15 } })
  await expect(codeStrip.locator).toHaveAttribute('aria-expanded', 'false')
  expect(
    expectDefined(
      await page.getByTestId('stack-member-code').boundingBox(),
      'collapsed code dock member'
    ).height
  ).toBeLessThan(40)
  await page.getByTestId(`panel-group-collapse-${codeStrip.containerId}-${codeStrip.groupIndex}`).click()
  await expect(page.getByTestId('code-panel-root')).toBeVisible()

  const splitter = expectDefined(
    await page.getByTestId('dock-stack-left').getByTestId('dock-width-divider').boundingBox(),
    'splitter handle before reset isolation check'
  )
  await page.mouse.move(splitter.x + 2, splitter.y + splitter.height / 2)
  await page.mouse.down()
  await page.mouse.move(splitter.x + 37, splitter.y + splitter.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const appStateBefore = await page.evaluate(() => ({
    graph: JSON.stringify([...(window.openPencil?.getStore?.()?.graph.nodes.values() ?? [])]),
    documentName: window.openPencil?.getStore?.()?.state.documentName
  }))
  const unrelatedBefore = {
    ...appStateBefore,
    editorLayout: await storageValue(page, 'open-pencil:editor-layout'),
    preferences: await storageValue(page, 'silverpoint:preferences')
  }
  const tabCountBefore = await page.getByTestId('tabbar-tab').count()

  await floatPanel(page, 'code')
  await (await tabStripFor(page, 'code')).locator.dblclick({ position: { x: 120, y: 15 } })
  await openViewMenu(page)
  await page.getByRole('menuitem', { name: 'Reset panel layout', exact: true }).click()

  await expect(page.getByTestId('workspace-panel-layers')).toBeVisible()
  expect(await page.getByTestId('tabbar-tab').count()).toBe(tabCountBefore)
  const appStateAfter = await page.evaluate(() => ({
    graph: JSON.stringify([...(window.openPencil?.getStore?.()?.graph.nodes.values() ?? [])]),
    documentName: window.openPencil?.getStore?.()?.state.documentName
  }))
  expect({
    ...appStateAfter,
    editorLayout: await storageValue(page, 'open-pencil:editor-layout'),
    preferences: await storageValue(page, 'silverpoint:preferences')
  }).toEqual(unrelatedBefore)
  canvas.assertNoErrors()
})

test('floating panels do not block canvas drawing or selection input', async ({ page }) => {
  await floatPanel(page, 'layers')

  const nodesBefore = await page.evaluate(
    () => window.openPencil?.getStore?.()?.graph.nodes.size ?? 0
  )
  await canvas.drawRect(500, 250, 80, 60)
  await expect
    .poll(() =>
      page.evaluate(() => ({
        nodes: window.openPencil?.getStore?.()?.graph.nodes.size ?? 0,
        selected: window.openPencil?.getStore?.()?.state.selectedIds.size ?? 0
      }))
    )
    .toEqual({ nodes: nodesBefore + 1, selected: 1 })

  await canvas.pressKey('v')
  await canvas.click(700, 500)
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.selectedIds.size ?? 0))
    .toBe(0)
  await canvas.click(540, 280)
  await expect
    .poll(() => page.evaluate(() => window.openPencil?.getStore?.()?.state.selectedIds.size ?? 0))
    .toBe(1)
  canvas.assertNoErrors()
})

test('dock targets resolve geometrically and symmetrically, commit exactly what they preview, and cancel atomically', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'code', 'right', 2)
  const pagesBefore = expectDefined(
    await page.getByTestId('stack-member-pages').boundingBox(),
    'pages dock member'
  )
  const layersBefore = expectDefined(
    await page.getByTestId('stack-member-layers').boundingBox(),
    'layers dock member'
  )
  const verticalDivider = expectDefined(
    await page.getByTestId('stack-member-pages').locator('.cursor-row-resize').boundingBox(),
    'vertical dock divider'
  )
  await page.mouse.move(verticalDivider.x + 80, verticalDivider.y + 2)
  await page.mouse.down()
  await page.mouse.move(verticalDivider.x + 80, verticalDivider.y + 42, { steps: 8 })
  await page.mouse.up()
  const pagesAfter = expectDefined(
    await page.getByTestId('stack-member-pages').boundingBox(),
    'resized pages dock member'
  )
  const layersAfter = expectDefined(
    await page.getByTestId('stack-member-layers').boundingBox(),
    'resized layers dock member'
  )
  expect(pagesAfter.height).toBeGreaterThan(pagesBefore.height + 20)
  expect(layersAfter.height).toBeLessThan(layersBefore.height - 20)
  const leftResizedLayout = await readPanelLayout(page)
  expect(typeof leftResizedLayout.panels.pages.height).toBe('number')
  expect(leftResizedLayout.panels.pages.height).toBeGreaterThan(200)

  await page.evaluate(() => {
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup reads the persisted panel layout.
    const raw = localStorage.getItem('silverpoint:panel-layout')
    if (!raw) return
    const layout = JSON.parse(raw)
    layout.docks.left = ['pages', 'layers', 'assets']
    layout.panels.assets.open = true
    layout.panels.assets.container = 'left'
    layout.panels.assets.index = 2
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup writes the persisted panel layout.
    localStorage.setItem('silverpoint:panel-layout', JSON.stringify(layout))
  })
  await page.setViewportSize({ width: 960, height: 200 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()

  const scrollArea = page
    .getByTestId('dock-stack-left')
    .locator('div.flex.min-h-0.flex-1.flex-col.overflow-y-auto, div.overflow-y-auto')
    .first()
  await expect(scrollArea).toHaveCSS('overflow-y', 'auto')
  expect(await scrollArea.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true
  )

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()

  await floatPanel(page, 'layers')
  const before = await storageValue(page, 'silverpoint:panel-layout')

  // The seam between Transform and Appearance in the right dock, derived
  // from their own rects - not from any indicator's bounding box. This is
  // the exact point a real drop there would resolve to.
  const seamPoint = async () => {
    const transformRect = expectDefined(
      await page.getByTestId('stack-member-transform').boundingBox(),
      'transform dock member bounds'
    )
    return { x: transformRect.x + transformRect.width / 2, y: transformRect.y + transformRect.height - 4 }
  }

  await dragTitleBarTo(page, 'layers', await seamPoint(), { alt: true, release: false })
  // Alt disables floating-to-floating snap only; it must never block docking.
  await expect(
    page.locator('[data-dock-insertion-target][data-active=""]').first()
  ).toHaveAttribute('data-container-id', 'right')
  await expect(
    page.locator('[data-dock-insertion-target][data-active=""]').first()
  ).toHaveAttribute('data-index', '1')
  await expect(page.getByTestId('panel-snap-guide')).toHaveCount(0)
  const during = await storageValue(page, 'silverpoint:panel-layout')
  await page.keyboard.press('Escape')
  await page.keyboard.up('Alt')
  expect(await storageValue(page, 'silverpoint:panel-layout')).toBe(before)
  expect(during).not.toBe(before)

  // Re-run the identical drag without cancelling: the drop must commit
  // exactly the index the indicator advertised above. 'code' was opened into
  // the right dock at the start of this test (ensurePanelOpen), so it is
  // already a member alongside the registry default transform/appearance/page.
  await dragTitleBarTo(page, 'layers', await seamPoint())
  expect((await readPanelLayout(page)).docks.right.flatMap((g) => g.members)).toEqual([
    'transform',
    'layers',
    'appearance',
    'text',
    'code',
    'page',
    'guides'
  ])

  // Symmetry: a RIGHT-dock panel dragged onto the LEFT dock must resolve and
  // commit exactly like the reverse direction above.
  const leftDockRect = expectDefined(
    await page.getByTestId('dock-stack-left').boundingBox(),
    'left dock bounds'
  )
  await dragTitleBarTo(page, 'code', {
    x: leftDockRect.x + leftDockRect.width / 2,
    y: leftDockRect.y + leftDockRect.height - 15
  })
  const afterSymmetryMove = await readPanelLayout(page)
  expect(afterSymmetryMove.docks.left.flatMap((g) => g.members)).toContain('code')
  expect(afterSymmetryMove.docks.right.flatMap((g) => g.members)).not.toContain('code')
  await expect(page.getByTestId('dock-stack-left').getByTestId('panel-tab-code')).toBeVisible()

  await page.setViewportSize({ width: 1280, height: 800 })
  await page.reload({ waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
  await expect(page.getByTestId('workspace-panel-layers')).toBeVisible()
  canvas.assertNoErrors()
})
