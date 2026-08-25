// oxlint-disable-next-line open-pencil/no-ts-suppression-comments, typescript-eslint(ban-ts-comment)
// @ts-nocheck -- this E2E file is excluded from tsconfig and checked by Playwright rather than Oxlint's standalone resolver.
import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

test.beforeAll(async () => {
  await editor.page.evaluate(() => {
    const key = 'silverpoint:panel-layout'
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup seeds the persisted panel layout.
    const stored = localStorage.getItem(key)
    const layout = stored
      ? (JSON.parse(stored) as { docks: { left: string[]; right: string[] }; panels: Record<string, Record<string, unknown>> })
      : {
          version: 2,
          dockWidths: { left: 240, right: 280 },
          docks: { left: ['pages', 'layers'], right: ['transform', 'appearance'] },
          panels: {}
        }
    if (!layout.docks.right.includes('code')) layout.docks.right.push('code')
    layout.panels.code = {
      ...layout.panels.code,
      open: true,
      placement: 'docked',
      lastDock: { side: 'right', index: 2 },
      collapsed: false
    }
    // oxlint-disable-next-line open-pencil/no-direct-storage-access -- E2E setup writes the persisted panel layout.
    localStorage.setItem(key, JSON.stringify(layout))
  })
  await editor.page.reload({ waitUntil: 'domcontentloaded' })
  await editor.canvas.waitForInit()
})

function codePanel() {
  return editor.page.getByTestId('code-panel')
}

function codePanelEmpty() {
  return editor.page.getByTestId('code-panel-empty')
}

function formatToggle() {
  return editor.page.getByTestId('code-panel-format-toggle')
}

function copyButton() {
  return editor.page.getByTestId('code-panel-copy')
}

test('Code tab shows empty state with no selection', async () => {
  await expect(codePanelEmpty()).toBeVisible()
  await expect(codePanelEmpty()).toContainText('Select a layer')
})

test('selecting a rectangle shows JSX code', async () => {
  await editor.canvas.drawRect(100, 100, 200, 150)
  await editor.canvas.waitForRender()

  await expect(codePanel()).toBeVisible()

  const code = await codePanel().textContent()
  expect(code).toContain('Rectangle')
})

test('format toggle switches between OpenPencil and Tailwind', async () => {
  await expect(formatToggle()).toBeVisible()

  const initialFormat = await formatToggle().textContent()
  expect(initialFormat).toContain('OpenPencil')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('Tailwind')

  const code = await codePanel().textContent()
  expect(code).toContain('div')

  await formatToggle().click()
  await expect(formatToggle()).toContainText('OpenPencil')
})

test('copy button works and shows confirmation', async () => {
  await copyButton().click()

  await expect(copyButton()).toContainText('Copied')

  await editor.page.waitForTimeout(2500)
  await expect(copyButton()).toContainText('Copy')
})

test('deselecting shows empty state again', async () => {
  await editor.page.keyboard.press('Escape')
  await editor.canvas.waitForRender()

  await expect(codePanelEmpty()).toBeVisible()
})

test('selecting a frame shows Frame in JSX', async () => {
  // Create a frame via store to avoid click-targeting issues
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const id = store.createShape('FRAME', 300, 100, 200, 200)
    store.select([id])
  })
  await editor.canvas.waitForRender()

  const code = await codePanel().textContent()
  expect(code).toContain('Frame')
})

test('switching back to Design tab works', async () => {
  await expect(editor.page.getByTestId('workspace-panel-transform')).toBeVisible()
})

test('shows import errors in the Code panel', async () => {
  await editor.page.getByTestId('code-panel-import-toggle').click()
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const importDOMText = store.importDOMText
    store.importDOMText = async () => {
      store.importDOMText = importDOMText
      throw new Error('CSS import failed')
    }
  })

  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Broken DOM</div>')
  await editor.page.getByTestId('code-panel-import').click()

  await expect(editor.page.getByTestId('code-panel-import-error')).toBeVisible()
  await expect(editor.page.getByTestId('code-panel-import-error')).toContainText(
    'CSS import failed'
  )

  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Recovered</div>')
  await expect(editor.page.getByTestId('code-panel-import-error')).toBeHidden()
  await editor.page.getByTestId('code-panel-import-toggle').click()
})

test('imports HTML and CSS into the canvas', async () => {
  await editor.page.getByTestId('code-panel-import-toggle').click()
  await editor.page.getByTestId('code-panel-import-html').fill('<div class="card">Hello DOM</div>')
  await editor.page
    .getByTestId('code-panel-import-css')
    .fill('.card { width: 240px; height: 120px; padding: 16px; background: #ffffff; }')
  await editor.page.getByTestId('code-panel-import').click()
  await editor.page.waitForFunction(() => {
    const store = window.openPencil?.getStore?.()
    return store?.graph.getAllNodes().some((node) => node.name.includes('Hello DOM'))
  })
  await editor.canvas.waitForRender()

  const imported = await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getAllNodes().some((node) => node.name.includes('Hello DOM'))
  })
  expect(imported).toBe(true)
})
