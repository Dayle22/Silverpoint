import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear()
const ONE_BY_ONE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function dropFiles(files: Array<{ name: string; type: string; bytes: number[] }>) {
  await editor.page.evaluate(
    ({ files: inputFiles }) => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-test-id="canvas-element"]')
      if (!canvas) throw new Error('Canvas not found')
      const data = new DataTransfer()
      for (const file of inputFiles) {
        data.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }))
      }
      canvas.dispatchEvent(
        new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          clientX: 400,
          clientY: 300,
          dataTransfer: data
        })
      )
    },
    { files }
  )
}

function pngBytes() {
  return [...atob(ONE_BY_ONE_PNG)].map((char) => char.charCodeAt(0))
}

function getPageImages() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    return store.graph.getChildren(store.state.currentPageId).map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      fills: node.fills
    }))
  })
}

function undo() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.undoAction()
  })
}

function redo() {
  return editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.redoAction()
  })
}

test('drops multiple images as editable nodes with atomic undo and redo', async () => {
  const bytes = pngBytes()
  await dropFiles([
    { name: 'first.png', type: 'image/png', bytes },
    { name: 'second.png', type: 'image/png', bytes }
  ])
  await editor.canvas.waitForRender()

  const images = await getPageImages()
  expect(images).toHaveLength(2)
  expect(images.every((node) => node.type === 'RECTANGLE')).toBe(true)
  expect(images.map((node) => node.name)).toEqual(['first', 'second'])

  await undo()
  await editor.canvas.waitForRender()
  expect(await getPageImages()).toHaveLength(0)

  await redo()
  await editor.canvas.waitForRender()
  expect(await getPageImages()).toHaveLength(2)
  editor.canvas.assertNoErrors()
})
