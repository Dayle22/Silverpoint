import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test, useEditorSetup } from '../fixtures'

const textFixturePath = fileURLToPath(new URL('../../fixtures/pdf/embedded-text.pdf', import.meta.url))
const textFixtureBytes = Array.from(readFileSync(textFixturePath))

const vectorFixturePath = fileURLToPath(new URL('../../fixtures/pdf/simple-vector.pdf', import.meta.url))
const vectorFixtureBytes = Array.from(readFileSync(vectorFixturePath))

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
  openPDFFile: (file: File) => Promise<void>
}

declare global {
  interface Window {
    openPencil?: {
      getStore?: () => BrowserStore
    }
  }
}

test.describe('PDF Import - Stage A & B E2E', () => {
  const ctx = useEditorSetup()

  test('opening a PDF shows the picker, cancelling leaves document untouched', async () => {
    const { page } = ctx

    // Initial node count
    const initialNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })

    // Open PDF file
    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'embedded-text.pdf', {
          type: 'application/pdf'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openPDFFile(file)
      },
      { bytes: textFixtureBytes }
    )

    // Verify PDF import dialog is visible
    const dialog = page.getByTestId('pdf-import-dialog')
    await expect(dialog).toBeVisible()

    // Verify diagnostic summary list is visible
    const diagList = page.getByTestId('pdf-diagnostics-list')
    await expect(diagList).toBeVisible()

    // Click Cancel button
    const cancelButton = page.getByTestId('pdf-cancel-button')
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

    // Open PDF file again
    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'embedded-text.pdf', {
          type: 'application/pdf'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openPDFFile(file)
      },
      { bytes: textFixtureBytes }
    )

    const dialog = page.getByTestId('pdf-import-dialog')
    await expect(dialog).toBeVisible()

    // Confirm import
    const confirmButton = page.getByTestId('pdf-confirm-button')
    await confirmButton.click()

    await expect(dialog).not.toBeVisible()

    // Frame and text nodes should now exist
    const importedNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })
    expect(importedNodeCount).toBeGreaterThan(nodeCountBefore)

    // Press Ctrl+Z to undo the entire PDF import
    const isMac = process.platform === 'darwin'
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z')

    // Node count should revert back to pre-import state
    const afterUndoCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      return store ? Array.from(store.graph.getAllNodes()).length : 0
    })
    expect(afterUndoCount).toBe(nodeCountBefore)
  })

  test('confirming import of simple-vector.pdf extracts native vector nodes', async () => {
    const { page } = ctx

    await page.evaluate(
      async ({ bytes }) => {
        const file = new File([new Uint8Array(bytes)], 'simple-vector.pdf', {
          type: 'application/pdf'
        })
        const store = window.openPencil?.getStore?.()
        await store?.openPDFFile(file)
      },
      { bytes: vectorFixtureBytes }
    )

    const dialog = page.getByTestId('pdf-import-dialog')
    await expect(dialog).toBeVisible()

    const confirmButton = page.getByTestId('pdf-confirm-button')
    await confirmButton.click()
    await expect(dialog).not.toBeVisible()

    const vectorNodeCount = await page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) return 0
      const all = Array.from(store.graph.getAllNodes())
      return all.filter((n) => n.type === 'VECTOR' || n.type === 'RECTANGLE').length
    })
    expect(vectorNodeCount).toBeGreaterThan(0)
  })
})
