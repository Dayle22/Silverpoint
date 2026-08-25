import { useEventListener } from '@vueuse/core'
import { ref, type Ref } from 'vue'

import type { Editor } from '@open-pencil/core/editor'

const ACCEPTED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
const ACCEPTED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'])
const UNKNOWN_TYPES = new Set(['', 'application/octet-stream'])

export function useCanvasDrop(canvasRef: Ref<HTMLCanvasElement | null>, editor: Editor) {
  const isDraggingOver = ref(false)

  useEventListener(canvasRef, 'dragover', (e: DragEvent) => {
    if (!hasImageFiles(e)) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragenter', (e: DragEvent) => {
    if (!hasImageFiles(e)) return
    e.preventDefault()
    isDraggingOver.value = true
  })

  useEventListener(canvasRef, 'dragleave', () => {
    isDraggingOver.value = false
  })

  useEventListener(canvasRef, 'drop', (e: DragEvent) => {
    e.preventDefault()
    isDraggingOver.value = false

    const files = filterImageFiles(e.dataTransfer?.files ?? null)
    if (!files.length) return

    const canvas = canvasRef.value
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const { x: cx, y: cy } = editor.screenToCanvas(sx, sy)

    void editor.placeImageFiles(files, cx, cy)
  })

  return { isDraggingOver }
}

function hasImageFiles(e: DragEvent): boolean {
  if (!e.dataTransfer?.types.includes('Files')) return false
  for (const item of e.dataTransfer.items) {
    if (item.kind === 'file' && isSupportedImage(item.type, item.getAsFile()?.name)) return true
  }
  return false
}

function filterImageFiles(files: FileList | null): File[] {
  if (!files) return []
  const result: File[] = []
  for (const file of files) {
    if (isSupportedImage(file.type, file.name)) result.push(file)
  }
  return result
}

function isSupportedImage(type: string, name?: string): boolean {
  const normalizedType = type.toLowerCase()
  if (ACCEPTED_TYPES.has(normalizedType)) return true
  if (!UNKNOWN_TYPES.has(normalizedType) || !name) return false
  const extension = name.slice(name.lastIndexOf('.')).toLowerCase()
  return ACCEPTED_EXTENSIONS.has(extension)
}

export function extractImageFilesFromClipboard(e: ClipboardEvent): File[] {
  return filterImageFiles(e.clipboardData?.files ?? null)
}
