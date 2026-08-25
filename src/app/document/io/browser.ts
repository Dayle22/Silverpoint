import type { ViewportSize } from '@/app/document/io/types'

export function yieldToUI(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

type ViewportEditor = {
  zoomToFit: (options?: { animate?: boolean }) => void
}

export function createDocumentViewportActions(editor: ViewportEditor, viewportSize: ViewportSize) {
  function setViewportSize(width: number, height: number) {
    viewportSize.width = width
    viewportSize.height = height
  }

  async function fitCurrentPageToViewport() {
    await yieldToUI()
    editor.zoomToFit({ animate: false })
  }

  return { setViewportSize, fitCurrentPageToViewport }
}

export function downloadBlob(data: Uint8Array, filename: string, mime: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 100)
}
