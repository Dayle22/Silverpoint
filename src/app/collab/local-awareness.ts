import type { Ref } from 'vue'
import type { Awareness } from 'y-protocols/awareness'

import { buildRemotePeers, remotePeersToCursors } from '@/app/collab/awareness'
import type { CollabState } from '@/app/collab/types'
import type { EditorStore } from '@/app/editor/active-store'

type LocalAwarenessOptions = {
  state: Ref<CollabState>
  storedName: Ref<string>
  getStore: () => EditorStore
  getAwareness: () => Awareness | null
  getVerifiedPeer?: (peerId: string) => { displayName?: string; email?: string; userId?: string; role?: string } | undefined
}

export function createLocalAwarenessActions({
  state,
  storedName,
  getStore,
  getAwareness,
  getVerifiedPeer
}: LocalAwarenessOptions) {
  function broadcastAwareness() {
    const awareness = getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('user', {
      name: state.value.localName,
      color: state.value.localColor,
      userId: state.value.localUserId,
      email: state.value.localEmail,
      role: state.value.localRole
    })
  }

  function updateCursor(x: number, y: number, pageId: string) {
    const awareness = getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('cursor', { x, y, pageId, zoom: getStore().state.zoom })
  }

  function updateSelection(ids: string[]) {
    const awareness = getAwareness()
    if (!awareness) return
    awareness.setLocalStateField('selection', ids)
  }

  function updatePeersList() {
    const awareness = getAwareness()
    if (!awareness) return

    const store = getStore()
    const verifiedMap = new Map(state.value.verifiedPeers.map((p) => [p.userId, p]))
    const peers = buildRemotePeers(
      awareness.getStates() as Map<number, Record<string, unknown>>,
      awareness.clientID,
      (id) => verifiedMap.get(id) ?? getVerifiedPeer?.(id)
    )

    state.value.peers = peers
    store.state.remoteCursors = remotePeersToCursors(peers, store.state.currentPageId)
    store.requestRender()
  }

  function setLocalName(name: string) {
    state.value.localName = name
    storedName.value = name
    broadcastAwareness()
  }

  return { broadcastAwareness, updateCursor, updateSelection, updatePeersList, setLocalName }
}
