import type { Ref } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import { randomIndex } from '@open-pencil/core/random'

import { connectCollabRoom } from '@/app/collab/room'
import type { CollabRoomTransport, JoinCollabRoomOptions } from '@/app/collab/transport'
import type { CollabState } from '@/app/collab/types'
import { bindCollabGraphEvents, registerYjsObservers } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { PEER_COLORS } from '@/constants'

export type CollabRuntime = {
  ydoc: Y.Doc | null
  awareness: awarenessProtocol.Awareness | null
  ynodes: Y.Map<Y.Map<unknown>> | null
  yimages: Y.Map<Uint8Array> | null
  room: CollabRoomTransport | null
  persistence: IndexeddbPersistence | null
  connectedStore: EditorStore | null
  suppressGraphSync: boolean
  suppressYjsEvents: boolean
  unbindGraphEvents: (() => void) | null
  stopZoomWatch: (() => void) | null
}

type ConnectCollabSessionOptions = {
  roomIdOrOptions: string | JoinCollabRoomOptions
  runtime: CollabRuntime
  state: Ref<CollabState>
  store: EditorStore
  disconnect: () => void
  updatePeersList: () => void
  tickFollow: () => void
  broadcastAwareness: () => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
  syncNodeToYjs: (nodeId: string) => void
}

type CollabConnectionActionsOptions = {
  runtime: CollabRuntime
  state: Ref<CollabState>
  getStore: () => EditorStore
  updatePeersList: () => void
  tickFollow: () => void
  broadcastAwareness: () => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
  syncNodeToYjs: (nodeId: string) => void
  resetFollow: () => void
}

type CollabSessionResources = {
  store: EditorStore
  room: CollabRoomTransport | null
  awareness: awarenessProtocol.Awareness | null
  persistence: IndexeddbPersistence | null
  ydoc: Y.Doc | null
  unbindGraphEvents: (() => void) | null
  stopZoomWatch: (() => void) | null
  resetFollow: () => void
}

export function createCollabRuntime(): CollabRuntime {
  return {
    ydoc: null,
    awareness: null,
    ynodes: null,
    yimages: null,
    room: null,
    persistence: null,
    connectedStore: null,
    suppressGraphSync: false,
    suppressYjsEvents: false,
    unbindGraphEvents: null,
    stopZoomWatch: null
  }
}

export function createInitialCollabState(localName: string): CollabState {
  return {
    connected: false,
    status: 'idle',
    mode: 'p2p',
    roomId: null,
    projectId: null,
    peers: [],
    verifiedPeers: [],
    localName,
    localColor: PEER_COLORS[randomIndex(PEER_COLORS.length)],
    errorMessage: null
  }
}

export function createCollabConnectionActions({
  runtime,
  state,
  getStore,
  updatePeersList,
  tickFollow,
  broadcastAwareness,
  applyYjsToGraph,
  syncNodeToYjs,
  resetFollow
}: CollabConnectionActionsOptions) {
  function connect(roomIdOrOptions: string | JoinCollabRoomOptions) {
    connectCollabSession({
      roomIdOrOptions,
      runtime,
      state,
      store: getStore(),
      disconnect,
      updatePeersList,
      tickFollow,
      broadcastAwareness,
      applyYjsToGraph,
      syncNodeToYjs
    })
  }

  function disconnect() {
    const store = runtime.connectedStore ?? getStore()
    disposeCollabSessionResources({
      store,
      room: runtime.room,
      awareness: runtime.awareness,
      persistence: runtime.persistence,
      ydoc: runtime.ydoc,
      unbindGraphEvents: runtime.unbindGraphEvents,
      stopZoomWatch: runtime.stopZoomWatch,
      resetFollow
    })
    resetCollabRuntime(runtime)
    resetCollabConnectionState(state)
  }

  return { connect, disconnect }
}

export function watchAwarenessZoom(store: EditorStore, getAwareness: () => Awareness | null) {
  return store.onEditorEvent('viewport:changed', (viewport) => {
    const awareness = getAwareness()
    if (!awareness) return
    const prev = awareness.getLocalState()?.cursor as
      | { x: number; y: number; pageId: string; zoom: number }
      | undefined
    if (prev) {
      awareness.setLocalStateField('cursor', { ...prev, zoom: viewport.zoom })
    }
  })
}

export function connectCollabSession({
  roomIdOrOptions,
  runtime,
  state,
  store,
  disconnect,
  updatePeersList,
  tickFollow,
  broadcastAwareness,
  applyYjsToGraph,
  syncNodeToYjs
}: ConnectCollabSessionOptions) {
  if (runtime.room) disconnect()

  const isOptions = typeof roomIdOrOptions === 'object'
  const options = isOptions ? roomIdOrOptions : undefined
  const mode = options?.mode ?? (options?.projectId ? 'biosculpture-cloud' : 'p2p')
  const projectId = options?.projectId ?? null
  const roomId = typeof roomIdOrOptions === 'string' ? roomIdOrOptions : (options?.roomId ?? options?.projectId ?? '')

  runtime.connectedStore = store
  state.value.mode = mode
  state.value.projectId = projectId
  state.value.roomId = roomId
  state.value.status = 'connecting'
  state.value.errorMessage = null

  runtime.ydoc = new Y.Doc()
  runtime.awareness = new awarenessProtocol.Awareness(runtime.ydoc)
  runtime.ynodes = runtime.ydoc.getMap('nodes')
  runtime.yimages = runtime.ydoc.getMap('images')

  const persistenceName =
    mode === 'biosculpture-cloud' && projectId
      ? `op-cloud-project-${projectId}`
      : `op-room-${roomId}`
  runtime.persistence = new IndexeddbPersistence(persistenceName, runtime.ydoc)

  runtime.awareness.on('change', () => {
    updatePeersList()
    tickFollow()
  })

  registerYjsObservers({
    store,
    ynodes: runtime.ynodes,
    yimages: runtime.yimages,
    getSuppressYjsEvents: () => runtime.suppressYjsEvents,
    setSuppressGraphSync: (value) => {
      runtime.suppressGraphSync = value
    },
    applyYjsToGraph
  })

  const roomConnection = connectCollabRoom({
    roomId,
    options,
    ydoc: runtime.ydoc,
    awareness: runtime.awareness,
    setConnected: () => {
      state.value.connected = true
      state.value.status = 'connected'
      if (runtime.room?.getVerifiedPeers) {
        state.value.verifiedPeers = runtime.room.getVerifiedPeers()
      }
    },
    updatePeersList: () => {
      if (runtime.room?.getVerifiedPeers) {
        state.value.verifiedPeers = runtime.room.getVerifiedPeers()
      }
      updatePeersList()
    }
  })
  runtime.room = roomConnection.room
  state.value.connected = true
  state.value.status = 'connected'
  if (roomConnection.room.getVerifiedPeers) {
    state.value.verifiedPeers = roomConnection.room.getVerifiedPeers()
  }
  broadcastAwareness()

  runtime.stopZoomWatch = watchAwarenessZoom(store, () => runtime.awareness)

  runtime.unbindGraphEvents = bindCollabGraphEvents({
    store,
    getYdoc: () => runtime.ydoc,
    getYnodes: () => runtime.ynodes,
    getSuppressGraphSync: () => runtime.suppressGraphSync,
    setSuppressYjsEvents: (value) => {
      runtime.suppressYjsEvents = value
    },
    syncNodeToYjs
  })
}

export function resetCollabRuntime(runtime: CollabRuntime) {
  runtime.unbindGraphEvents = null
  runtime.stopZoomWatch = null
  runtime.room = null
  runtime.awareness = null
  runtime.persistence = null
  runtime.ydoc = null
  runtime.ynodes = null
  runtime.yimages = null
  runtime.connectedStore = null
}

export function resetCollabConnectionState(state: Ref<CollabState>) {
  state.value.connected = false
  state.value.status = 'idle'
  state.value.mode = 'p2p'
  state.value.roomId = null
  state.value.projectId = null
  state.value.peers = []
  state.value.verifiedPeers = []
  state.value.errorMessage = null
}

export function disposeCollabSessionResources(resources: CollabSessionResources) {
  resources.unbindGraphEvents?.()
  resources.stopZoomWatch?.()
  void resources.room?.leave()
  resources.awareness?.destroy()
  if (resources.persistence) {
    void resources.persistence.destroy()
  }
  resources.ydoc?.destroy()
  resources.resetFollow()
  resources.store.state.remoteCursors = []
  resources.store.requestRender()
}
