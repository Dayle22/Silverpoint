import { expect, test } from '@playwright/test'

test('the browser document identifies Silverpoint', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('Silverpoint')

  const title = await page.title()
  expect(title).not.toContain('OpenPencil')
})
