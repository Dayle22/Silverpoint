import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import type { Vector } from '@open-pencil/scene-graph/primitives'

import {
  clearInMemoryClipboardHTML,
  getInMemoryClipboardHTML,
  hasInMemoryClipboardHTML,
  setInMemoryClipboardHTML
} from '@/app/editor/clipboard/memory'
import { pasteClipboardToReplace } from '@/app/editor/clipboard/paste-to-replace'
import {
  copySelectionToBrowserClipboard,
  executeClipboardCommand
} from '@/app/editor/clipboard/system'
import { createEditorStore } from '@/app/editor/session/create'
import { toast } from '@/app/shell/ui'

const originalClipboard = globalThis.navigator?.clipboard
const originalWindowClipboard = globalThis.window?.navigator?.clipboard

beforeEach(() => {
  clearInMemoryClipboardHTML()
  toast.toasts.value = []
  if (globalThis.navigator) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
  }
  if (globalThis.window?.navigator) {
    Object.defineProperty(globalThis.window.navigator, 'clipboard', {
      configurable: true,
      value: undefined
    })
  }
})

afterEach(() => {
  if (globalThis.navigator) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard
    })
  }
  if (globalThis.window?.navigator) {
    Object.defineProperty(globalThis.window.navigator, 'clipboard', {
      configurable: true,
      value: originalWindowClipboard
    })
  }
})

const noop = () => undefined

describe('in-memory clipboard', () => {
  test('stores, retrieves, and clears clipboard HTML', () => {
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')

    const sampleHTML = '<!--(openpencil)test-->'
    setInMemoryClipboardHTML(sampleHTML)

    expect(hasInMemoryClipboardHTML()).toBe(true)
    expect(getInMemoryClipboardHTML()).toBe(sampleHTML)

    clearInMemoryClipboardHTML()
    expect(hasInMemoryClipboardHTML()).toBe(false)
    expect(getInMemoryClipboardHTML()).toBe('')
  })

  test('copySelectionToBrowserClipboard writes to modern Clipboard API when available', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Modern Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    let writtenItems: unknown[] = []
    const mockClipboard = {
      write: async (items: unknown[]) => {
        writtenItems = items
      }
    }

    const originalClipboardItem = globalThis.ClipboardItem
    const originalBlob = globalThis.Blob
    try {
      globalThis.ClipboardItem = class MockClipboardItem {
        data: Record<string, Blob>
        constructor(data: Record<string, Blob>) {
          this.data = data
        }
      } as unknown as typeof ClipboardItem
      globalThis.Blob = class MockBlob {
        parts: unknown[]
        options?: unknown
        constructor(parts: unknown[], options?: unknown) {
          this.parts = parts
          this.options = options
        }
      } as unknown as typeof Blob

      if (globalThis.navigator) {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          configurable: true,
          value: mockClipboard
        })
      }

      const success = await copySelectionToBrowserClipboard(store)
      expect(success).toBe(true)
      expect(writtenItems).toHaveLength(1)
      expect(hasInMemoryClipboardHTML()).toBe(true)
    } finally {
      globalThis.ClipboardItem = originalClipboardItem
      globalThis.Blob = originalBlob
    }
  })

  test('copySelectionToBrowserClipboard falls back to execCommand when modern Clipboard API rejects', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Fallback Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const rejectingClipboard = {
      write: async () => {
        throw new Error('Clipboard write permission denied')
      }
    }

    let legacyExecCalled = false
    const originalDocument = globalThis.document
    const originalClipboardItem = globalThis.ClipboardItem
    const originalBlob = globalThis.Blob
    try {
      globalThis.ClipboardItem = class MockClipboardItem {
        data: Record<string, Blob>
        constructor(data: Record<string, Blob>) {
          this.data = data
        }
      } as unknown as typeof ClipboardItem
      globalThis.Blob = class MockBlob {
        parts: unknown[]
        options?: unknown
        constructor(parts: unknown[], options?: unknown) {
          this.parts = parts
          this.options = options
        }
      } as unknown as typeof Blob

      if (globalThis.navigator) {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          configurable: true,
          value: rejectingClipboard
        })
      }

      let listener: ((e: unknown) => void) | null = null
      globalThis.document = {
        addEventListener: (_type: string, fn: (e: unknown) => void) => {
          listener = fn
        },
        removeEventListener: (_type: string, _fn: (e: unknown) => void) => {
          listener = null
        },
        execCommand: (cmd: string) => {
          if (cmd === 'copy' && listener) {
            legacyExecCalled = true
            listener({
              clipboardData: { setData: noop },
              preventDefault: noop
            })
            return true
          }
          return false
        }
      } as Document

      const success = await copySelectionToBrowserClipboard(store)
      expect(success).toBe(true)
      expect(legacyExecCalled).toBe(true)
      expect(hasInMemoryClipboardHTML()).toBe(true)
    } finally {
      globalThis.document = originalDocument
      globalThis.ClipboardItem = originalClipboardItem
      globalThis.Blob = originalBlob
    }
  })

  test('copySelectionToBrowserClipboard copies payload via execCommand fallback when modern clipboard is unavailable', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const capturedData: Record<string, string> = {}
    let copyEventTriggered = false

    const originalDocument = globalThis.document
    try {
      let listener: ((e: unknown) => void) | null = null
      globalThis.document = {
        addEventListener: (_type: string, fn: (e: unknown) => void) => {
          listener = fn
        },
        removeEventListener: (_type: string, _fn: (e: unknown) => void) => {
          listener = null
        },
        execCommand: (cmd: string) => {
          if (cmd === 'copy' && listener) {
            copyEventTriggered = true
            const mockEvent = {
              clipboardData: {
                setData: (type: string, val: string) => {
                  capturedData[type] = val
                }
              },
              preventDefault: noop
            }
            listener(mockEvent)
            return true
          }
          return false
        }
      } as Document

      const success = await copySelectionToBrowserClipboard(store)
      expect(success).toBe(true)
      expect(copyEventTriggered).toBe(true)
      expect(capturedData['text/html']).toBeDefined()
      expect(capturedData['text/plain']).toBeDefined()
      expect(hasInMemoryClipboardHTML()).toBe(true)
    } finally {
      globalThis.document = originalDocument
    }
  })

  test('copySelectionToBrowserClipboard returns false when execCommand fails or is unavailable', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Copy Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const originalDocument = globalThis.document
    try {
      globalThis.document = {
        addEventListener: noop,
        removeEventListener: noop,
        execCommand: () => false
      } as Document

      const success = await copySelectionToBrowserClipboard(store)
      expect(success).toBe(false)
    } finally {
      globalThis.document = originalDocument
    }
  })

  test('executeClipboardCommand cut does not delete nodes when clipboard copy fails', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Safe Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const cutOk = await executeClipboardCommand(store, 'cut')
    expect(cutOk).toBe(false)
    expect(store.graph.getNode(rect.id)).toBeDefined()
  })

  test('pasteToReplace uses in-memory clipboard when system clipboard is unavailable', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const target = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Target',
      x: 10,
      y: 10,
      width: 100,
      height: 100
    })
    store.select([target.id])

    // Copy target (populates in-memory clipboard)
    await executeClipboardCommand(store, 'copy')

    expect(hasInMemoryClipboardHTML()).toBe(true)

    // Create another node to replace
    const replaceTarget = store.graph.createNode('RECTANGLE', pageId, {
      name: 'To Replace',
      x: 50,
      y: 50,
      width: 80,
      height: 80
    })
    store.select([replaceTarget.id])

    // Run pasteClipboardToReplace
    await pasteClipboardToReplace(store)

    // Verify replace succeeded without toast errors
    expect(toast.toasts.value).toHaveLength(0)
    expect(store.graph.getNode(replaceTarget.id)).toBeUndefined()
  })

  test('executeClipboardCommand cut deletes selection and returns true when copy succeeds', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Cut Target',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    const originalDocument = globalThis.document
    try {
      let listener: ((e: unknown) => void) | null = null
      globalThis.document = {
        addEventListener: (_type: string, fn: (e: unknown) => void) => {
          listener = fn
        },
        removeEventListener: (_type: string, _fn: (e: unknown) => void) => {
          listener = null
        },
        execCommand: (cmd: string) => {
          if (cmd === 'copy' && listener) {
            listener({
              clipboardData: { setData: noop },
              preventDefault: noop
            })
            return true
          }
          return false
        }
      } as Document

      const cutOk = await executeClipboardCommand(store, 'cut')
      expect(cutOk).toBe(true)
      expect(store.graph.getNode(rect.id)).toBeUndefined()
    } finally {
      globalThis.document = originalDocument
    }
  })

  test('executeClipboardCommand paste forwards cursorPos to store.pasteFromHTML', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Source',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])
    await executeClipboardCommand(store, 'copy')

    let receivedCursorPos: Vector | undefined
    const originalPaste = store.pasteFromHTML.bind(store)
    store.pasteFromHTML = async (html, cursorPos, options) => {
      receivedCursorPos = cursorPos
      return originalPaste(html, cursorPos, options)
    }

    const cursorPos: Vector = { x: 150, y: 250 }
    const pasteOk = await executeClipboardCommand(store, 'paste', cursorPos)
    expect(pasteOk).toBe(true)
    expect(receivedCursorPos).toEqual(cursorPos)
  })

  test('executeClipboardCommand paste falls back to memory clipboard', async () => {
    const store = createEditorStore()
    const pageId = store.state.currentPageId
    const rect = store.graph.createNode('RECTANGLE', pageId, {
      name: 'Source Rect',
      x: 0,
      y: 0,
      width: 50,
      height: 50
    })
    store.select([rect.id])

    await executeClipboardCommand(store, 'copy')
    expect(hasInMemoryClipboardHTML()).toBe(true)

    const pasteOk = await executeClipboardCommand(store, 'paste')
    expect(pasteOk).toBe(true)

    // An additional node should have been pasted
    const selected = [...store.state.selectedIds]
    expect(selected).toHaveLength(1)
    expect(selected[0]).not.toBe(rect.id)
    const pastedNode = store.graph.getNode(selected[0])
    expect(pastedNode?.name).toBe('Source Rect')
  })
})
