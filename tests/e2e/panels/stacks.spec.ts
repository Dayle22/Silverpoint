// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { CanvasHelper } from '#tests/helpers/canvas'

import {
  dragFloatTitleTo,
  dragFloatTo,
  dragTitleBarTo,
  ensurePanelOpen,
  floatingWindowFor,
  floatPanel,
  readPanelLayout,
  tabStripFor
} from './helpers'

let canvas: CanvasHelper

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000)
  canvas = new CanvasHelper(page)
  await page.goto('/?test', { waitUntil: 'domcontentloaded' })
  await canvas.waitForInit()
})

test('two floating panels merge into one stack by dropping one onto the other, and both remain visible with their own title bars', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'layers')
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 700, y: 220 })

  const aiContainer = expectDefined(
    await floatingWindowFor(page, 'ai').boundingBox(),
    'ai container bounds before merge'
  )

  await dragTitleBarTo(page, 'layers', {
    x: aiContainer.x + aiContainer.width / 2,
    y: aiContainer.y + aiContainer.height - 5
  })

  const layout = await readPanelLayout(page)
  const mergedFloat = layout.floats.find((f) => f.members.includes('ai') && f.members.includes('layers'))
  expect(mergedFloat).toBeDefined()
  expect(mergedFloat.members).toEqual(['ai', 'layers'])
  expect(layout.floats).toHaveLength(1)

  // Both tabs are visible, in the same window - 'ai' and 'layers'
  // resolve to the identical single floating-window element.
  const window_ = floatingWindowFor(page, 'ai')
  await expect(window_.getByTestId('panel-tab-ai')).toBeVisible()
  await expect(window_.getByTestId('panel-tab-layers')).toBeVisible()
  // The regex also matches each container's 8 resize handles
  // (floating-panel-<id>-resize-<handle>), so exclude those explicitly.
  await expect(page.getByTestId(/^floating-panel-(?!.*-resize-)/)).toHaveCount(1)
  canvas.assertNoErrors()
})

test('a member drops into a float stack at index 0, a middle index and the end, verified against the persisted members array', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await ensurePanelOpen(page, canvas, 'guides', 'right', 0)
  await ensurePanelOpen(page, canvas, 'code', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 200 })

  // 'code' joins at index 0 (above 'ai').
  const aiRectBefore = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai member bounds')
  await dragTitleBarTo(page, 'code', {
    x: aiRectBefore.x + aiRectBefore.width / 2,
    y: aiRectBefore.y + 5
  })
  expect((await readPanelLayout(page)).floats.find((f) => f.members.includes('ai')).members).toEqual([
    'code',
    'ai'
  ])

  // 'guides' joins at the end (below 'ai').
  const floatBox = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'float container bounds')
  await dragTitleBarTo(page, 'guides', {
    x: floatBox.x + floatBox.width / 2,
    y: floatBox.y + floatBox.height - 15
  })
  const afterAppend = (await readPanelLayout(page)).floats.find((f) => f.members.includes('ai'))
  expect(afterAppend.members).toEqual(['code', 'ai', 'guides'])

  // A fourth panel joins in the middle, between 'code' and 'ai'.
  const codeRect = expectDefined(await page.getByTestId('stack-member-code').boundingBox(), 'code member bounds')
  await dragTitleBarTo(page, 'layers', {
    x: codeRect.x + codeRect.width / 2,
    y: codeRect.y + codeRect.height - 5
  })
  const final = (await readPanelLayout(page)).floats.find((f) => f.members.includes('ai'))
  expect(final.members).toEqual(['code', 'layers', 'ai', 'guides'])
  canvas.assertNoErrors()
})

test('dragging one member out of a 3-member stack leaves a valid 2-member stack; dragging the last member out deletes the container', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await ensurePanelOpen(page, canvas, 'guides', 'right', 0)
  await ensurePanelOpen(page, canvas, 'code', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 200 })
  const aiRect = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai member bounds')
  await dragTitleBarTo(page, 'code', { x: aiRect.x + aiRect.width / 2, y: aiRect.y + 5 })
  const floatBox = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'float container bounds 2')
  await dragTitleBarTo(page, 'guides', { x: floatBox.x + floatBox.width / 2, y: floatBox.y + floatBox.height - 15 })
  const initial = await readPanelLayout(page)
  expect(initial.floats).toHaveLength(1)
  expect(initial.floats[0].members).toEqual(['code', 'ai', 'guides'])

  // Drag 'ai' (the middle member) out to open canvas. The docks are not just
  // a 96px edge band: at the default widths they are a real 240px/280px-wide
  // *dock*, and dock CONTAINMENT is checked before any edge-band fallback -
  // so every target below stays well inside [280, 960] to land on open
  // canvas, not merely "away from the edge". Float ids are recomputed by
  // z-order on every structural change (a container losing or gaining a
  // member always renumbers), so every check below identifies containers by
  // their CONTENT (which panels are grouped together), never by an id
  // captured before a structural change.
  await dragTitleBarTo(page, 'ai', { x: 450, y: 300 })
  const afterAiLeaves = await readPanelLayout(page)
  expect(afterAiLeaves.floats).toHaveLength(2)
  expect(afterAiLeaves.floats.find((f) => f.members.includes('code'))?.members).toEqual(['code', 'guides'])
  expect(afterAiLeaves.floats.find((f) => f.members.includes('ai'))?.members).toEqual(['ai'])

  // Drag the remaining two members out one at a time, to well-separated
  // canvas points - far from the stack, from 'ai's new spot, and from each
  // other - so no detach's path or release point lands inside another
  // container's rect; the source container must be deleted once its last
  // member leaves.
  await dragTitleBarTo(page, 'code', { x: 320, y: 700 })
  const afterCodeLeaves = await readPanelLayout(page)
  expect(afterCodeLeaves.floats).toHaveLength(3)
  expect(afterCodeLeaves.floats.find((f) => f.members.includes('guides'))?.members).toEqual(['guides'])

  await dragTitleBarTo(page, 'guides', { x: 450, y: 600 })
  const final = await readPanelLayout(page)
  // Every original stack member is now its own standalone container - the
  // 3-member container's identity is gone precisely because no float has
  // more than one member left, not because a specific id vanished.
  expect(final.floats).toHaveLength(3)
  expect(final.floats.every((f) => f.members.length === 1)).toBe(true)
  expect(final.floats.flatMap((f) => f.members).sort()).toEqual(['ai', 'code', 'guides'])
  canvas.assertNoErrors()
})

test('adjacent expanded float members resize against each other; basis sums stay at 10,000; dragging the frame moves every member together', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'layers')
  await dragFloatTo(page, 'layers', { x: 650, y: 150 })
  const layersContainer = expectDefined(await floatingWindowFor(page, 'layers').boundingBox(), 'layers container bounds')
  await dragTitleBarTo(page, 'ai', { x: layersContainer.x + layersContainer.width / 2, y: layersContainer.y + layersContainer.height - 15 })
  expect((await readPanelLayout(page)).floats.find((f) => f.members.includes('layers')).members).toEqual([
    'layers',
    'ai'
  ])

  const divider = expectDefined(
    await page.getByTestId('stack-member-layers').locator('.cursor-row-resize').boundingBox(),
    'float stack member divider'
  )
  const layersBefore = expectDefined(await page.getByTestId('stack-member-layers').boundingBox(), 'layers before resize')
  // 'layers' is the top member; moving the divider DOWN (away from it) grows
  // it, matching the dock splitter's own convention (see the dock resize
  // test in basic.spec.ts, where 'pages' - also the top member - grows when
  // its divider moves down).
  await page.mouse.move(divider.x + 10, divider.y + 1)
  await page.mouse.down()
  await page.mouse.move(divider.x + 10, divider.y + 30, { steps: 8 })
  await page.mouse.up()
  const layersAfter = expectDefined(await page.getByTestId('stack-member-layers').boundingBox(), 'layers after resize')
  expect(layersAfter.height).toBeGreaterThan(layersBefore.height + 15)

  const floatId = (await readPanelLayout(page)).floats.find((f) => f.members.includes('layers')).id
  const updatedLayout = await readPanelLayout(page)
  expect(typeof updatedLayout.panels.layers.height).toBe('number')
  expect(updatedLayout.panels.layers.height).toBeGreaterThan(150)

  // Dragging the title bar moves every member together without detaching any.
  const before = expectDefined(await floatingWindowFor(page, 'layers').boundingBox(), 'container before frame drag')
  await dragFloatTitleTo(page, 'layers', 60, 40)
  const after = expectDefined(await floatingWindowFor(page, 'layers').boundingBox(), 'container after frame drag')
  expect(after.x - before.x).toBeCloseTo(60, 0)
  expect(after.y - before.y).toBeCloseTo(40, 0)
  const stillMerged = (await readPanelLayout(page)).floats.find((f) => f.id === floatId)
  expect(stillMerged.members).toEqual(['layers', 'ai'])
  canvas.assertNoErrors()
})

test('collapsing every member of a float stack shrinks it to stacked title rails; expanding restores proportions', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'layers')
  await dragFloatTo(page, 'layers', { x: 650, y: 150 })
  const layersRect = expectDefined(await page.getByTestId('stack-member-layers').boundingBox(), 'layers member bounds')
  await dragTitleBarTo(page, 'ai', { x: layersRect.x + layersRect.width / 2, y: layersRect.y + layersRect.height - 5 })

  const expandedHeight = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'expanded container bounds'
  ).height

  await (await tabStripFor(page, 'layers')).locator.dblclick({ position: { x: 120, y: 15 } })
  await (await tabStripFor(page, 'ai')).locator.dblclick({ position: { x: 120, y: 15 } })
  await expect(floatingWindowFor(page, 'layers')).toHaveAttribute('data-collapsed', '')
  const collapsedHeight = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'fully collapsed container bounds'
  ).height
  expect(collapsedHeight).toBeLessThan(100)

  await (await tabStripFor(page, 'layers')).locator.dblclick({ position: { x: 120, y: 15 } })
  await (await tabStripFor(page, 'ai')).locator.dblclick({ position: { x: 120, y: 15 } })
  await expect(floatingWindowFor(page, 'layers')).not.toHaveAttribute('data-collapsed', '')
  const restoredHeight = expectDefined(
    await floatingWindowFor(page, 'layers').boundingBox(),
    'restored container bounds'
  ).height
  expect(Math.abs(restoredHeight - expandedHeight)).toBeLessThanOrEqual(2)
  canvas.assertNoErrors()
})

test('Code panel content survives merging into a stack, reordering within it, and separating back out - the component instance is teleported, never remounted', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'code', 'right', 0)
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  // With nothing selected there is no JSX code yet, so the importer shows
  // directly - no toggle click needed first.
  await page.getByTestId('code-panel-import-html').fill('<div class="card">state survives merge</div>')

  await floatPanel(page, 'code')
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 700, y: 250 })
  const aiContainer = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'ai container bounds')

  // Merge 'code' into 'ai's stack.
  await dragTitleBarTo(page, 'code', {
    x: aiContainer.x + aiContainer.width / 2,
    y: aiContainer.y + aiContainer.height - 5
  })
  expect((await readPanelLayout(page)).floats.find((f) => f.members.includes('ai'))?.members).toEqual(['ai', 'code'])
  await expect(page.getByTestId('code-panel-import-html')).toHaveValue('<div class="card">state survives merge</div>')

  // Reorder within the stack: drag 'code' above 'ai'.
  const aiRect = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai member bounds')
  await dragTitleBarTo(page, 'code', { x: aiRect.x + aiRect.width / 2, y: aiRect.y + 5 })
  expect((await readPanelLayout(page)).floats.find((f) => f.members.includes('ai'))?.members).toEqual(['code', 'ai'])
  await expect(page.getByTestId('code-panel-import-html')).toHaveValue('<div class="card">state survives merge</div>')

  // Separate 'code' back out to its own window.
  await dragTitleBarTo(page, 'code', { x: 350, y: 650 })
  expect((await readPanelLayout(page)).floats.find((f) => f.members.includes('code'))?.members).toEqual(['code'])
  await expect(page.getByTestId('code-panel-import-html')).toHaveValue('<div class="card">state survives merge</div>')

  // Re-dock it: the value must still be there once it is a plain dock member again.
  const codeStrip = await tabStripFor(page, 'code')
  await page.getByTestId(`panel-group-float-${codeStrip.containerId}-${codeStrip.groupIndex}`).click()
  await expect(page.getByTestId('dock-stack-right').getByTestId('panel-tab-code')).toBeVisible()
  await expect(page.getByTestId('code-panel-import-html')).toHaveValue('<div class="card">state survives merge</div>')
  canvas.assertNoErrors()
})

test('a three-member float: pressing float-title-* and dragging moves all three members bounding boxes by the same delta, and persisted floats[0] rect moves while members is unchanged', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await ensurePanelOpen(page, canvas, 'guides', 'right', 0)
  await ensurePanelOpen(page, canvas, 'code', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 100 })

  const aiRect = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai member bounds')
  await dragTitleBarTo(page, 'code', { x: aiRect.x + aiRect.width / 2, y: aiRect.y + 5 })
  const floatBox = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'float container bounds')
  await dragTitleBarTo(page, 'guides', { x: floatBox.x + floatBox.width / 2, y: floatBox.y + floatBox.height - 15 })

  const beforeLayout = await readPanelLayout(page)
  expect(beforeLayout.floats).toHaveLength(1)
  expect(beforeLayout.floats[0].members).toEqual(['code', 'ai', 'guides'])

  const codeBoxBefore = expectDefined(await page.getByTestId('stack-member-code').boundingBox(), 'code before')
  const aiBoxBefore = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai before')
  const guidesBoxBefore = expectDefined(await page.getByTestId('stack-member-guides').boundingBox(), 'guides before')

  await dragFloatTitleTo(page, 'code', 60, 40)

  const codeBoxAfter = expectDefined(await page.getByTestId('stack-member-code').boundingBox(), 'code after')
  const aiBoxAfter = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai after')
  const guidesBoxAfter = expectDefined(await page.getByTestId('stack-member-guides').boundingBox(), 'guides after')

  expect(codeBoxAfter.x - codeBoxBefore.x).toBeCloseTo(60, 0)
  expect(codeBoxAfter.y - codeBoxBefore.y).toBeCloseTo(40, 0)
  expect(aiBoxAfter.x - aiBoxBefore.x).toBeCloseTo(60, 0)
  expect(aiBoxAfter.y - aiBoxBefore.y).toBeCloseTo(40, 0)
  expect(guidesBoxAfter.x - guidesBoxBefore.x).toBeCloseTo(60, 0)
  expect(Math.abs(guidesBoxAfter.y - guidesBoxBefore.y - 40)).toBeLessThanOrEqual(3)

  const afterLayout = await readPanelLayout(page)
  expect(afterLayout.floats).toHaveLength(1)
  expect(afterLayout.floats[0].members).toEqual(['code', 'ai', 'guides'])
  expect(afterLayout.floats[0].x - beforeLayout.floats[0].x).toBeCloseTo(60, 0)
  expect(afterLayout.floats[0].y - beforeLayout.floats[0].y).toBeCloseTo(40, 0)
  canvas.assertNoErrors()
})

test('pressing inside a member body and dragging does not move the window', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 200 })

  const windowBefore = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'window before body drag')

  // Target a point inside the AI panel body (well below its title bar)
  const bodyX = windowBefore.x + windowBefore.width / 2
  const bodyY = windowBefore.y + 100
  await page.mouse.move(bodyX, bodyY)
  await page.mouse.down()
  await page.mouse.move(bodyX + 60, bodyY + 40, { steps: 8 })
  await page.mouse.up()

  const windowAfter = expectDefined(await floatingWindowFor(page, 'ai').boundingBox(), 'window after body drag')
  expect(windowAfter.x).toBeCloseTo(windowBefore.x, 0)
  expect(windowAfter.y).toBeCloseTo(windowBefore.y, 0)
  canvas.assertNoErrors()
})

test('pressing a member own title bar and dragging still detaches only that member', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'layers')
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 700, y: 220 })

  const aiContainer = expectDefined(
    await floatingWindowFor(page, 'ai').boundingBox(),
    'ai container bounds before merge'
  )

  await dragTitleBarTo(page, 'layers', {
    x: aiContainer.x + aiContainer.width / 2,
    y: aiContainer.y + aiContainer.height - 5
  })

  const layoutMerged = await readPanelLayout(page)
  expect(layoutMerged.floats).toHaveLength(1)
  expect(layoutMerged.floats[0].members).toEqual(['ai', 'layers'])

  // Drag 'layers' by its own title bar out to open canvas
  await dragTitleBarTo(page, 'layers', { x: 350, y: 500 })

  const layoutSeparated = await readPanelLayout(page)
  expect(layoutSeparated.floats).toHaveLength(2)
  expect(layoutSeparated.floats.find((f) => f.members.includes('ai'))?.members).toEqual(['ai'])
  expect(layoutSeparated.floats.find((f) => f.members.includes('layers'))?.members).toEqual(['layers'])
  canvas.assertNoErrors()
})

test('a title-bar drag with Escape pressed mid-gesture restores the window original rect', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 200 })

  const windowEl = floatingWindowFor(page, 'ai')
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), 'container id')
  const titleBar = page.getByTestId(`float-title-${containerId}`)
  const barBounds = expectDefined(await titleBar.boundingBox(), 'float title bar bounds')
  const windowBefore = expectDefined(await windowEl.boundingBox(), 'window before drag')

  const startX = barBounds.x + barBounds.width / 2
  const startY = barBounds.y + barBounds.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + 100, startY + 80, { steps: 8 })
  await page.keyboard.press('Escape')
  await page.mouse.up()

  const windowAfter = expectDefined(await windowEl.boundingBox(), 'window after escape')
  expect(windowAfter.x).toBeCloseTo(windowBefore.x, 0)
  expect(windowAfter.y).toBeCloseTo(windowBefore.y, 0)
  canvas.assertNoErrors()
})

test('float-close-* closes every member and removes the container', async ({
  page
}) => {
  await ensurePanelOpen(page, canvas, 'ai', 'right', 0)
  await ensurePanelOpen(page, canvas, 'code', 'right', 0)
  await floatPanel(page, 'ai')
  await dragFloatTo(page, 'ai', { x: 650, y: 200 })

  const aiRect = expectDefined(await page.getByTestId('stack-member-ai').boundingBox(), 'ai member bounds')
  await dragTitleBarTo(page, 'code', { x: aiRect.x + aiRect.width / 2, y: aiRect.y + 5 })

  const windowEl = floatingWindowFor(page, 'ai')
  const containerId = expectDefined(await windowEl.getAttribute('data-container-id'), 'container id')

  await page.getByTestId(`float-close-${containerId}`).click()

  const layout = await readPanelLayout(page)
  expect(layout.floats).toHaveLength(0)
  expect(layout.panels.ai.open).toBe(false)
  expect(layout.panels.code.open).toBe(false)
  await expect(page.getByTestId(`floating-panel-${containerId}`)).toHaveCount(0)
  canvas.assertNoErrors()
})
