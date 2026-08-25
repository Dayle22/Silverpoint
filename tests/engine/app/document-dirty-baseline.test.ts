import { describe, test, expect } from 'bun:test'

import { createEditorStore } from '@/app/editor/session'

// `state.sceneVersion` is a render counter, not an edit counter, so the saved
// baseline recorded by setDocumentSource() goes stale as soon as anything asks
// for a render. Opening a document does exactly that (switchPage ends in
// requestRender), which is why a just-opened file showed the modified dot
// before any edit.
describe('document dirty baseline', () => {
  test('setDocumentSource leaves the document clean', () => {
    const store = createEditorStore()
    store.setDocumentSource('design.fig', 'fig')
    expect(store.isDirty()).toBe(false)
  })

  test('a render request after setDocumentSource makes the document look dirty', async () => {
    const store = createEditorStore()
    store.setDocumentSource('design.fig', 'fig')
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    expect(store.isDirty()).toBe(true)
  })

  test('markDocumentClean re-baselines after the open sequence settles', async () => {
    const store = createEditorStore()
    store.setDocumentSource('design.fig', 'fig')
    const pageId = store.graph.getPages()[0]?.id ?? store.graph.rootId
    await store.switchPage(pageId)
    store.markDocumentClean()
    expect(store.isDirty()).toBe(false)
  })
})
