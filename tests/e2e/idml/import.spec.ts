import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test, useEditorSetup } from '../fixtures'

const indesignFixturePath = fileURLToPath(
  new URL('../../fixtures/idml/indesign-sample.idml', import.meta.url)
)
const indesignFixtureBytes = Array.from(readFileSync(indesignFixturePath))

const affinityFixturePath = fileURLToPath(
  new URL('../../fixtures/idml/affinity-sample.idml', import.meta.url)
)
const affinityFixtureBytes = Array.from(readFileSync(affinityFixturePath))

interface BrowserNode {
  id: string
  type: string
  name: string
}

interface BrowserStore {
  graph: {
    nodes: Map<string, unknown>
    getAllNodes: () => Iterable<BrowserNode>
  }
  openIDMLFile: (file: File) => Promise<void>
}

declare global {
  interface Window {
    openPencil?: {
      getStore?: () => BrowserStore
    }
  }
}

test.describe('IDML Import — E2E Flow', () => {
  const ctx = useEditorSetup()

  test('opening an IDML shows the import dialog, cancelling leaves document untouched', async () => {
    const { page } = ctx

    // Initial node count
    const initialNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })

    // Open IDML file
    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'indesign-sample.idml', {
          type: 'application/vnd.adobe.indesign-idml-package'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openIDMLFile(file)
      },
      { bytes: indesignFixtureBytes }
    )

    // Verify IDML import dialog is visible
    const dialog = page.getByTestId('idml-import-dialog')
    await expect(dialog).toBeVisible()

    // Verify diagnostic summary list is visible
    const diagList = page.getByTestId('idml-diagnostics-list')
    await expect(diagList).toBeVisible()

    // Click Cancel button
    const cancelButton = page.getByTestId('idml-cancel-button')
    await cancelButton.click()

    // Verify dialog closes and document nodes remain untouched
    await expect(dialog).not.toBeVisible()

    const finalNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })

    expect(finalNodeCount).toBe(initialNodeCount)
  })

  test('confirming import creates one undoable frame, Ctrl+Z removes it', async () => {
    const { page } = ctx

    // Initial node count before import
    const nodeCountBefore = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })

    // Open IDML file again
    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'indesign-sample.idml', {
          type: 'application/vnd.adobe.indesign-idml-package'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openIDMLFile(file)
      },
      { bytes: indesignFixtureBytes }
    )

    const dialog = page.getByTestId('idml-import-dialog')
    await expect(dialog).toBeVisible()

    // Confirm import
    const confirmButton = page.getByTestId('idml-confirm-button')
    await confirmButton.click()

    await expect(dialog).not.toBeVisible()

    // Frame, shape and text nodes should now exist
    const importedNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })
    expect(importedNodeCount).toBeGreaterThan(nodeCountBefore)

    // Press Ctrl+Z to undo the entire IDML import
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')

    // Node count should revert back to pre-import state
    const afterUndoCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })
    expect(afterUndoCount).toBe(nodeCountBefore)
  })

  test('confirming import of affinity-sample.idml extracts native design objects', async () => {
    const { page } = ctx

    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'affinity-sample.idml', {
          type: 'application/vnd.adobe.indesign-idml-package'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openIDMLFile(file)
      },
      { bytes: affinityFixtureBytes }
    )

    const dialog = page.getByTestId('idml-import-dialog')
    await expect(dialog).toBeVisible()

    const confirmButton = page.getByTestId('idml-confirm-button')
    await confirmButton.click()
    await expect(dialog).not.toBeVisible()

    const frameCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) return 0
      const all = Array.from(store.graph.getAllNodes())
      return all.filter((n) => n.type === 'FRAME').length
    })
    expect(frameCount).toBeGreaterThanOrEqual(1)
  })
})
