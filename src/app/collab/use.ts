import { tryOnScopeDispose, useLocalStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

import { createFollowActions, generateRoomId } from '@/app/collab/awareness'
import { createLocalAwarenessActions } from '@/app/collab/local-awareness'
import {
  createCollabConnectionActions,
  createCollabRuntime,
  createInitialCollabState
} from '@/app/collab/session'
import { DEFAULT_COLLAB_STATE, type CollabState, type RemotePeer } from '@/app/collab/types'
import { createYjsGraphSync } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import * as Y from 'yjs'

export { COLLAB_KEY, useCollabInjected } from '@/app/collab/context'
export { DEFAULT_COLLAB_STATE }
export type { CollabState, RemotePeer }

export function useCollab(storeOrGetter: EditorStore | (() => EditorStore)) {
  const getStore = () =>
    typeof storeOrGetter === 'function' ? (storeOrGetter as () => EditorStore)() : storeOrGetter
  const storedName = useLocalStorage('op-collab-name', '')
  const state = ref<CollabState>(createInitialCollabState(storedName.value))
  const runtime = createCollabRuntime()
  const remotePeers = computed(() => state.value.peers)
  const getActiveStore = () => runtime.connectedStore ?? getStore()

  const { followingPeer, followPeer, resetFollow, tickFollow } = createFollowActions(
    getActiveStore,
    () => runtime.awareness
  )
  const { broadcastAwareness, updateCursor, updateSelection, updatePeersList, setLocalName } =
    createLocalAwarenessActions({
      state,
      storedName,
      getStore: getActiveStore,
      getAwareness: () => runtime.awareness,
      getVerifiedPeer: (peerId) => runtime.room?.getVerifiedPeer?.(peerId)
    })

  const { syncNodeToYjs, syncAllNodesToYjs, applyYjsToGraph } = createYjsGraphSync({
    getStore: getActiveStore,
    getYdoc: () => runtime.ydoc,
    getYnodes: () => runtime.ynodes,
    getYimages: () => runtime.yimages,
    setSuppressYjsEvents: (value) => {
      runtime.suppressYjsEvents = value
    }
  })
  const { connect, disconnect } = createCollabConnectionActions({
    runtime,
    state,
    getStore,
    updatePeersList,
    tickFollow,
    broadcastAwareness,
    applyYjsToGraph,
    syncNodeToYjs,
    resetFollow
  })

  function shareCurrentDoc(): string {
    const roomId = generateRoomId()
    connect(roomId)
    syncAllNodesToYjs()
    return roomId
  }

  function connectProject(projectId: string, apiBase?: string) {
    connect({ projectId, mode: 'biosculpture-cloud', apiBase })
    syncAllNodesToYjs()
  }

  async function submitSnapshotCandidate(
    snapshot: Uint8Array,
    expectedRev: string,
    retainVersion?: boolean
  ) {
    if (!runtime.room?.submitSnapshotCandidate || !runtime.ydoc) {
      throw new Error('Cloud room is not connected or does not support guarded snapshots')
    }
    const stateVector = Y.encodeStateVector(runtime.ydoc)
    return runtime.room.submitSnapshotCandidate({
      snapshot,
      stateVector,
      expectedRev,
      retainVersion
    })
  }

  tryOnScopeDispose(disconnect)

  return {
    state,
    remotePeers,
    followingPeer,
    connect,
    connectProject,
    disconnect,
    shareCurrentDoc,
    submitSnapshotCandidate,
    syncAllNodesToYjs,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow
  }
}
