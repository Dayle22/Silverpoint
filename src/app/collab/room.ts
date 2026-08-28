import * as decoding from 'lib0/decoding'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as Y from 'yjs'

import { joinCollabRoom, type JoinCollabRoom, type JoinCollabRoomOptions } from '@/app/collab/transport'

export type CollabRoomOptions = {
  roomId?: string
  options?: JoinCollabRoomOptions
  ydoc: Y.Doc
  awareness: awarenessProtocol.Awareness
  setConnected: () => void
  updatePeersList: () => void
  joinRoom?: JoinCollabRoom
}

export type CollabRoomConnection = {
  room: ReturnType<JoinCollabRoom>
  sendYjsUpdate: (data: Uint8Array, peerId?: string) => void
  sendAwareness: (data: Uint8Array, peerId?: string) => void
  sendSyncStep1: (data: Uint8Array, peerId?: string) => void
}

function awarenessClientIds(data: Uint8Array): number[] {
  try {
    const decoder = decoding.createDecoder(data)
    const count = decoding.readVarUint(decoder)
    const clients: number[] = []
    for (let index = 0; index < count; index++) {
      clients.push(decoding.readVarUint(decoder))
      decoding.readVarUint(decoder)
      decoding.readVarString(decoder)
    }
    return clients
  } catch {
    return []
  }
}

interface AwarenessUserState {
  name?: string
  userId?: string
  email?: string
  role?: string
  peerId?: string
  color?: unknown
  cursor?: unknown
  selection?: unknown
}

export function connectCollabRoom({
  roomId,
  options,
  ydoc,
  awareness,
  setConnected,
  updatePeersList,
  joinRoom = joinCollabRoom
}: CollabRoomOptions): CollabRoomConnection {
  const room = joinRoom(options ?? roomId ?? '')
  const [sendYjsUpdate, getUpdate] = room.makeAction('yjs-update')
  const [sendAwareness, getAwareness] = room.makeAction('awareness')
  const [sendSyncStep1, getSyncStep1] = room.makeAction('sync-step1')
  const [sendSyncReply, getSyncReply] = room.makeAction('sync-reply')

  const awarenessClientsByPeer = new Map<string, Set<number>>()

  getUpdate((data) => {
    Y.applyUpdate(ydoc, data, 'remote')
  })

  getAwareness((data, peerId) => {
    const clientIds = awarenessClientIds(data)
    awarenessClientsByPeer.set(peerId, new Set(clientIds))
    awarenessProtocol.applyAwarenessUpdate(awareness, data, 'remote')

    if (room.getVerifiedPeer) {
      const verified = room.getVerifiedPeer(peerId)
      if (verified) {
        for (const cid of clientIds) {
          const state = awareness.getStates().get(cid)
          if (state && typeof state === 'object') {
            const user = (state.user && typeof state.user === 'object' ? state.user : {}) as AwarenessUserState
            state.user = {
              ...user,
              name: verified.displayName || verified.email,
              userId: verified.userId,
              email: verified.email,
              role: verified.role,
              peerId
            }
          }
        }
      }
    }
    updatePeersList()
  })

  getSyncStep1((stateVector, peerId) => {
    const update = Y.encodeStateAsUpdate(ydoc, stateVector)
    sendSyncReply(update, peerId)
  })

  getSyncReply((data) => {
    Y.applyUpdate(ydoc, data, 'remote')
  })

  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') return
    sendYjsUpdate(update)
  })

  awareness.on(
    'update',
    (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown
    ) => {
      if (origin === 'remote' || origin === 'peer-left') return
      const changedClients = [...added, ...updated, ...removed]
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      sendAwareness(encodedUpdate)
    }
  )

  room.onPeerJoin((peerId) => {
    setConnected()
    sendSyncStep1(Y.encodeStateVector(ydoc), peerId)
    sendAwareness(awarenessProtocol.encodeAwarenessUpdate(awareness, [awareness.clientID]), peerId)
    updatePeersList()
  })

  room.onPeerLeave((peerId) => {
    const remoteClients = [...(awarenessClientsByPeer.get(peerId) ?? [])]
    awarenessClientsByPeer.delete(peerId)
    awarenessProtocol.removeAwarenessStates(awareness, remoteClients, 'peer-left')
    updatePeersList()
  })

  return { room, sendYjsUpdate, sendAwareness, sendSyncStep1 }
}
