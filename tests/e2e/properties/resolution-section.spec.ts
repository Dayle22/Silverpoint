import { expect, test, useEditorSetupWithClear } from '#tests/e2e/fixtures'

const editor = useEditorSetupWithClear()

function createPngBuffer(width: number, height: number): number[] {
  const buf = new Uint8Array(33)
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  buf[8] = 0
  buf[9] = 0
  buf[10] = 0
  buf[11] = 13
  buf.set([0x49, 0x48, 0x44, 0x52], 12)
  buf[16] = (width >>> 24) & 0xff
  buf[17] = (width >>> 16) & 0xff
  buf[18] = (width >>> 8) & 0xff
  buf[19] = width & 0xff
  buf[20] = (height >>> 24) & 0xff
  buf[21] = (height >>> 16) & 0xff
  buf[22] = (height >>> 8) & 0xff
  buf[23] = height & 0xff
  buf[24] = 8
  buf[25] = 6
  buf[26] = 0
  buf[27] = 0
  buf[28] = 0
  return Array.from(buf)
}

async function createImageNode(options: {
  imgWidth: number
  imgHeight: number
  nodeWidth: number
  nodeHeight: number
  name?: string
}) {
  const bytes = createPngBuffer(options.imgWidth, options.imgHeight)
  return editor.page.evaluate(
    ({ bytes: rawBytes, imgWidth, imgHeight, nodeWidth, nodeHeight, name }) => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('OpenPencil store not initialized')

      const u8 = new Uint8Array(rawBytes)
      const hash = `hash-${imgWidth}x${imgHeight}`
      store.graph.images.set(hash, u8)

      const node = store.graph.createNode('RECTANGLE', store.state.currentPageId, {
        name: name ?? 'ImageNode',
        x: 100,
        y: 100,
        width: nodeWidth,
        height: nodeHeight,
        fills: [
          {
            type: 'IMAGE',
            color: { r: 0, g: 0, b: 0, a: 1 },
            opacity: 1,
            visible: true,
            imageHash: hash,
            imageScaleMode: 'FILL'
          }
        ]
      })

      store.select([node.id])
      store.state.sceneVersion++
      store.requestRender()
      return node.id
    },
    {
      bytes,
      imgWidth: options.imgWidth,
      imgHeight: options.imgHeight,
      nodeWidth: options.nodeWidth,
      nodeHeight: options.nodeHeight,
      name: options.name
    }
  )
}

test('resolution section appears only when selected node has an image fill', async () => {
  await editor.canvas.clearCanvas()
  await editor.canvas.drawRect(200, 200, 80, 80)

  const section = editor.page.getByTestId('resolution-section')
  await expect(section).toBeHidden()

  await createImageNode({
    imgWidth: 1000,
    imgHeight: 1000,
    nodeWidth: 500,
    nodeHeight: 500
  })
  await editor.canvas.waitForRender()

  await expect(section).toBeVisible()
  await expect(section.getByTestId('resolution-dpi')).toContainText('600 DPI')
  await expect(section.getByTestId('resolution-source-size')).toContainText('1000 × 1000 px')
  await expect(section.getByTestId('resolution-scale-mode')).toContainText('Fill')
})

test('resizing the node updates the resolution value live', async () => {
  await editor.canvas.clearCanvas()
  const nodeId = await createImageNode({
    imgWidth: 1000,
    imgHeight: 1000,
    nodeWidth: 500,
    nodeHeight: 500
  })
  await editor.canvas.waitForRender()

  const dpiLabel = editor.page.getByTestId('resolution-dpi')
  await expect(dpiLabel).toContainText('600 DPI')

  // Resize node to 1000x1000
  await editor.page.evaluate((id) => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    store.updateNodeWithUndo(id, { width: 1000, height: 1000 }, 'Resize')
    store.requestRender()
  }, nodeId)
  await editor.canvas.waitForRender()

  await expect(dpiLabel).toContainText('300 DPI')
})

test('changing document DPI updates effective resolution', async () => {
  await editor.canvas.clearCanvas()
  await createImageNode({
    imgWidth: 1000,
    imgHeight: 1000,
    nodeWidth: 500,
    nodeHeight: 500
  })
  await editor.canvas.waitForRender()

  const dpiLabel = editor.page.getByTestId('resolution-dpi')
  await expect(dpiLabel).toContainText('600 DPI')

  // Change document DPI from 300 to 150
  await editor.page.evaluate(() => {
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const root = store.graph.getNode(store.graph.rootId)
    if (!root) return
    const currentPluginData = root.pluginData ?? []
    const nextPluginData = [
      ...currentPluginData.filter((e) => !(e.pluginId === 'open-pencil' && e.key === 'documentUnits')),
      {
        pluginId: 'open-pencil',
        key: 'documentUnits',
        value: JSON.stringify({ unit: 'px', dpi: 150 })
      }
    ]
    store.updateNodeWithUndo(store.graph.rootId, { pluginData: nextPluginData }, 'Change DPI')
    store.requestRender()
  })
  await editor.canvas.waitForRender()

  await expect(dpiLabel).toContainText('300 DPI')
})

test('low-resolution fixture shows the warning and high-resolution does not', async () => {
  await editor.canvas.clearCanvas()

  // 1. High resolution (1000x1000 in 500x500 at 300 DPI = 600 DPI >= 300)
  await createImageNode({
    imgWidth: 1000,
    imgHeight: 1000,
    nodeWidth: 500,
    nodeHeight: 500,
    name: 'HighRes'
  })
  await editor.canvas.waitForRender()

  const warningRow = editor.page.getByTestId('resolution-warning-row')
  await expect(warningRow).toBeHidden()

  // 2. Low resolution (100x100 in 500x500 at 300 DPI = 60 DPI < 300)
  await createImageNode({
    imgWidth: 100,
    imgHeight: 100,
    nodeWidth: 500,
    nodeHeight: 500,
    name: 'LowRes'
  })
  await editor.canvas.waitForRender()

  await expect(warningRow).toBeVisible()
  await expect(warningRow).toContainText('Low resolution')
})

