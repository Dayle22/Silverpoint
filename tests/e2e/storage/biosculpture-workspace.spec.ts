/* oxlint-disable open-pencil/no-direct-storage-access */
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { CanvasHelper } from '#tests/helpers/canvas'

test.describe('Bio Sculpture Cloud Workspace & Folders', () => {
  const fixture = readFileSync('tests/fixtures/gold-preview.fig')

  test.beforeEach(async ({ page }) => {
    // Set active storage provider to biosculpture-cloud
    await page.addInitScript(() => {
      window.localStorage.setItem('open-pencil:storage:provider', 'biosculpture-cloud')
    })

    // Mock Cloudflare Access session
    await page.route('**/api/session/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'usr_sarah',
            email: 'sarah@biosculpture.com',
            displayName: 'Sarah Designer',
            role: 'member'
          }
        })
      })
    })

    // Mock Folders
    await page.route('**/api/folders', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            folders: [
              { id: 'fld_campaigns', parentId: null, name: 'Campaigns 2026' },
              { id: 'fld_autumn', parentId: 'fld_campaigns', name: 'Autumn Collection' }
            ]
          })
        })
        return
      }
      await route.fulfill({ status: 200 })
    })

    // Mock Projects
    await page.route('**/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          projects: [
            {
              id: 'prj_global_guide',
              folderId: null,
              name: 'Brand Guidelines',
              updatedAt: '2026-08-28T10:00:00.000Z'
            },
            {
              id: 'prj_campaign_poster',
              folderId: 'fld_campaigns',
              name: 'Campaign Poster',
              updatedAt: '2026-08-28T11:00:00.000Z'
            },
            {
              id: 'prj_autumn_shades',
              folderId: 'fld_autumn',
              name: 'Autumn Shades Spec',
              updatedAt: '2026-08-28T12:00:00.000Z'
            }
          ]
        })
      })
    })

    // Mock Snapshots
    await page.route('**/api/projects/*/snapshot', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        headers: {
          'X-Dropbox-Rev': 'rev_test_123',
          'X-State-Vector': 'sv_test_456'
        },
        body: fixture
      })
    })
  })

  test('displays root folders and root projects with breadcrumbs', async ({ page }) => {
    await page.goto('/?recent-files')

    // Expect storage workspace section to be visible
    await expect(page.getByTestId('storage-workspace')).toBeVisible()

    // Root items: "Campaigns 2026" folder and "Brand Guidelines" project
    await expect(page.getByTestId('storage-folder-fld_campaigns')).toBeVisible()
    await expect(page.getByText('Brand Guidelines')).toBeVisible()

    // Nested items should not be visible at root
    await expect(page.getByTestId('storage-folder-fld_autumn')).toHaveCount(0)
    await expect(page.getByText('Campaign Poster')).toHaveCount(0)
  })

  test('navigates into nested folders and back using breadcrumbs', async ({ page }) => {
    await page.goto('/?recent-files')

    // Click into "Campaigns 2026"
    await page.getByTestId('storage-folder-fld_campaigns').click()

    // Now in Campaigns 2026: should see child folder "Autumn Collection" and "Campaign Poster"
    await expect(page.getByTestId('workspace-breadcrumbs')).toBeVisible()
    await expect(page.getByTestId('storage-folder-fld_autumn')).toBeVisible()
    await expect(page.getByText('Campaign Poster')).toBeVisible()

    // Navigate into "Autumn Collection"
    await page.getByTestId('storage-folder-fld_autumn').click()
    await expect(page.getByText('Autumn Shades Spec')).toBeVisible()

    // Click "All Projects" breadcrumb to return to root
    await page.getByTestId('workspace-breadcrumb-root').click()
    await expect(page.getByTestId('storage-folder-fld_campaigns')).toBeVisible()
    await expect(page.getByText('Brand Guidelines')).toBeVisible()
  })

  test('opens project document and loads scene graph', async ({ page }) => {
    await page.goto('/?recent-files')
    const canvas = new CanvasHelper(page)

    // Open "Brand Guidelines"
    await page.getByText('Brand Guidelines').first().click()

    // Verify canvas initialises and editor tab is active
    await canvas.waitForInit()
    await expect(page.getByText('Brand Guidelines').first()).toBeVisible()
  })
})
