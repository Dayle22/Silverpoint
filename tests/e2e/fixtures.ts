import { test, expect, type Locator, type Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

export function useEditorSetup(url = '/') {
  let page: Page
  let canvas: CanvasHelper

  test.describe.configure({ mode: 'serial' })

  test.beforeAll(async ({ browser }) => {
    // Cold start (CanvasKit WASM + Yoga WASM + font loading) can exceed the
    // global 15s Playwright test timeout (playwright.config.ts). This hook's
    // own internal waits already budget up to 30s per step (see
    // CanvasHelper.waitForInit), so give the hook itself matching headroom
    // instead of raising the timeout for every test project-wide.
    test.setTimeout(60_000)
    page = await browser.newPage()
    canvas = new CanvasHelper(page)
    await page.goto(url)
    await canvas.waitForInit()
  })

  test.afterAll(async () => {
    await page.close()
  })

  return {
    get page() {
      return page
    },
    get canvas() {
      return canvas
    }
  }
}

export function useEditorSetupWithClear(url = '/') {
  const ctx = useEditorSetup(url)

  test.beforeEach(async () => {
    await ctx.canvas.clearCanvas()
  })

  return ctx
}

export async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected visible element to have a bounding box')

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Expected page to have a viewport')

  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
}

export { test, expect }
