// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { getNodeById, getPageChildren, getSelectedNode } from '#tests/helpers/store'
import { toolbarFlyoutItemTestId, toolbarFlyoutTestId, toolbarToolTestId } from '#tests/helpers/test-ids'

const editor = useEditorSetup()

function parseFrameGuidesData(pluginData?: { pluginId: string; key: string; value: string }[]) {
  const entry = pluginData?.find((e) => e.pluginId === 'open-pencil' && e.key === 'frameGuides')
  if (!entry) return null
  return JSON.parse(entry.value)
}

test('Frame shortcut opens ordered preset popover and creates a live screen frame', async () => {
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()

  const popover = editor.page.getByTestId('frame-preset-popover')
  await expect(popover).toBeVisible()
  await expect(popover.getByTestId('frame-preset-group-screen')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-group-print')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-orientation-portrait')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-orientation-landscape')).toBeVisible()

  await expect(popover.getByTestId('frame-preset-1080x1080')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-1080x1920')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-1080x1440')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-a4')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-us-letter')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-business-card')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-poster')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-tri-fold')).toBeVisible()
  await expect(popover.getByTestId('frame-preset-separator')).toBeVisible()
  await expect(popover.getByTestId('frame-custom')).toBeVisible()

  await popover.getByTestId('frame-preset-1080x1920').click()
  const frame = await getSelectedNode(editor.page)
  expect(frame).not.toBeNull()
  expect(frame).toMatchObject({ type: 'FRAME', width: 1080, height: 1920 })
  await expect(editor.page.getByTestId('layers-item')).toContainText(frame?.name ?? '')
  await expect(popover).toBeHidden()
  editor.canvas.assertNoErrors()
})

test('Print preset creates frame at physical size with margin and bleed guides in single undo step', async () => {
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  const popover = editor.page.getByTestId('frame-preset-popover')
  await expect(popover).toBeVisible()

  const beforeChildren = await getPageChildren(editor.page)
  await popover.getByTestId('frame-preset-a4').click()

  const frame = await getSelectedNode(editor.page)
  expect(frame).not.toBeNull()
  expect(frame?.type).toBe('FRAME')
  expect(frame?.width).toBeCloseTo(2480.31496, 1)
  expect(frame?.height).toBeCloseTo(3507.8740, 1)

  const guides = parseFrameGuidesData(frame?.pluginData)
  expect(guides).not.toBeNull()
  expect(guides.margins.enabled).toBe(true)
  expect(guides.bleed.enabled).toBe(true)
  expect(guides.margins.top).toBeCloseTo(118.11, 1)
  expect(guides.bleed.top).toBeCloseTo(35.43, 1)

  const frameId = frame.id

  // Single Ctrl+Z removes frame and its guides together
  await editor.page.keyboard.press('ControlOrMeta+z')
  const afterUndoChildren = await getPageChildren(editor.page)
  expect(afterUndoChildren.length).toBe(beforeChildren.length)
  expect(await getNodeById(editor.page, frameId)).toBeNull()

  // Redo brings frame and guides back
  await editor.page.keyboard.press('ControlOrMeta+Shift+z')
  const redoneFrame = await getNodeById(editor.page, frameId)
  expect(redoneFrame).not.toBeNull()
  expect(redoneFrame?.width).toBeCloseTo(2480.31496, 1)
  const redoneGuides = parseFrameGuidesData(redoneFrame?.pluginData)
  expect(redoneGuides).not.toBeNull()
  expect(redoneGuides?.margins.enabled).toBe(true)
  expect(redoneGuides?.bleed.enabled).toBe(true)
  expect(redoneGuides?.margins.top).toBeCloseTo(118.11, 1)

  editor.canvas.assertNoErrors()
})

test('Orientation toggle swaps print dimensions and does not affect screen presets', async () => {
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  const popover = editor.page.getByTestId('frame-preset-popover')
  await expect(popover).toBeVisible()

  await popover.getByTestId('frame-preset-orientation-landscape').click()
  await popover.getByTestId('frame-preset-a4').click()

  const frame = await getSelectedNode(editor.page)
  expect(frame).not.toBeNull()
  expect(frame?.type).toBe('FRAME')
  expect(frame?.width).toBeCloseTo(3507.8740, 1)
  expect(frame?.height).toBeCloseTo(2480.31496, 1)

  // Screen presets are unaffected by orientation toggle
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  await editor.page.getByTestId('frame-preset-1080x1920').click()
  const screenFrame = await getSelectedNode(editor.page)
  expect(screenFrame?.width).toBe(1080)
  expect(screenFrame?.height).toBe(1920)

  editor.canvas.assertNoErrors()
})

test('Custom rejects invalid dimensions and creates an exact frame when valid', async () => {
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  await editor.page.getByTestId('frame-custom').click()

  const before = (await getPageChildren(editor.page)).length
  await editor.page.getByTestId('frame-custom-width').fill('0')
  await editor.page.getByTestId('frame-custom-height').fill('640.5')
  await expect(editor.page.getByTestId('frame-custom-apply')).toBeDisabled()
  expect((await getPageChildren(editor.page)).length).toBe(before)

  await editor.page.getByTestId('frame-custom-width').fill('640')
  await editor.page.getByTestId('frame-custom-height').fill('480')
  await editor.page.getByTestId('frame-custom-apply').click()

  const frame = await getSelectedNode(editor.page)
  expect(frame).toMatchObject({ type: 'FRAME', width: 640, height: 480 })
  await expect(editor.page.getByTestId('frame-preset-popover')).toBeHidden()
  editor.canvas.assertNoErrors()
})

test('Frame drag and Section flyout remain available', async () => {
  await editor.page.getByTestId(toolbarToolTestId('FRAME')).click()
  await editor.page.getByTestId('frame-preset-popover').getByTestId('frame-preset-separator').waitFor()
  await editor.page.keyboard.press('Escape')
  await editor.canvas.drag(120, 120, 260, 220)
  const frame = await getSelectedNode(editor.page)
  expect(frame?.type).toBe('FRAME')
  expect(frame?.width).toBeGreaterThan(0)
  expect(frame?.height).toBeGreaterThan(0)

  await editor.page.getByTestId(toolbarFlyoutTestId('FRAME')).click()
  await expect(editor.page.getByTestId(toolbarFlyoutItemTestId('SECTION'))).toBeVisible()
  await editor.page.getByTestId(toolbarFlyoutItemTestId('SECTION')).click()
  await editor.canvas.drag(300, 120, 440, 220)
  const section = await getSelectedNode(editor.page)
  expect(section?.type).toBe('SECTION')
  editor.canvas.assertNoErrors()
})
