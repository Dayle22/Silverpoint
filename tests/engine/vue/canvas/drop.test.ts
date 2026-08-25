import { describe, expect, test } from 'bun:test'
import { ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

import { useCanvasDrop } from '#vue/canvas/drop/use'

function makeFile(name: string, type: string) {
  return new File(['image'], name, { type })
}

function makeDataTransfer(files: File[]) {
  const items = files.map((file) => ({
    kind: 'file',
    type: file.type,
    getAsFile: () => file
  }))
  return { types: ['Files'], items, files }
}

function makeCanvas() {
  const canvas = new EventTarget() as EventTarget & HTMLCanvasElement
  canvas.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    top: 20,
    left: 10,
    right: 810,
    bottom: 620,
    width: 800,
    height: 600,
    toJSON: () => undefined
  })
  return canvas
}

describe('useCanvasDrop', () => {
  test('accepts supported images with empty or octet-stream MIME types by extension', () => {
    const canvas = makeCanvas()
    const editor = {
      screenToCanvas: (x: number, y: number) => ({ x, y }),
      placeImageFiles: async () => undefined
    } as Editor
    const { isDraggingOver } = useCanvasDrop(ref(canvas), editor)
    const event = new Event('dragover', { cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: makeDataTransfer([
        makeFile('photo.png', ''),
        makeFile('photo.jpg', 'application/octet-stream')
      ])
    })

    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(isDraggingOver.value).toBe(true)
  })

  test('rejects known non-image MIME types even when the extension looks supported', () => {
    const canvas = makeCanvas()
    const editor = {
      screenToCanvas: (x: number, y: number) => ({ x, y }),
      placeImageFiles: async () => undefined
    } as Editor
    const { isDraggingOver } = useCanvasDrop(ref(canvas), editor)
    const event = new Event('dragover', { cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: makeDataTransfer([makeFile('not-an-image.png', 'text/plain')])
    })

    canvas.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
    expect(isDraggingOver.value).toBe(false)
  })
})
