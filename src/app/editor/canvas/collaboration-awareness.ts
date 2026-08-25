import { onScopeDispose } from 'vue'

import type { useCollabInjected } from '@/app/collab/use'
import type { EditorStore } from '@/app/editor/active-store'

type Collaboration = ReturnType<typeof useCollabInjected>

export function useCanvasCollaborationAwareness(store: EditorStore, collab: Collaboration) {
  function updateCursor(cx: number, cy: number) {
    store.state.cursorCanvasX = cx
    store.state.cursorCanvasY = cy
    collab?.updateCursor(cx, cy, store.state.currentPageId)
  }

  // The canvas remounts on every tab switch, so this has to come back off with
  // it — otherwise each visit to a tab leaves another live listener on that
  // tab's store, all firing into the discarded component's collab session.
  const offSelectionChanged = store.onEditorEvent('selection:changed', (ids) =>
    collab?.updateSelection(ids)
  )
  onScopeDispose(offSelectionChanged)

  return { updateCursor }
}
