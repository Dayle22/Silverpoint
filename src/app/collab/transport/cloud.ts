import { IS_BROWSER } from '@/constants'
import type {
  CollabAction,
  CollabActionReceiver,
  CollabRoomTransport,
  JoinCollabRoomOptions,
  SnapshotCandidateResult,
  VerifiedPeerInfo
} from './types'

export interface CollabEnvelope {
  type:
    | 'yjs-update'
    | 'awareness'
    | 'sync-step1'
    | 'sync-reply'
    | 'snapshot-candidate'
    | 'snapshot-response'
    | 'peer-join'
    | 'peer-leave'
    | 'peers-list'
    | 'welcome'
    | 'action'
    | 'ping'
    | 'pong'
    | 'error'
  senderId?: string
  targetId?: string
  namespace?: string
  data?: number[] | Uint8Array | string
  update?: string
  stateVector?: string
  snapshot?: string
  expectedRev?: string
  retainVersion?: boolean
  rev?: string
  peer?: VerifiedPeerInfo
  peers?: VerifiedPeerInfo[]
  error?: string
  code?: string
  success?: boolean
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

export function decodeBase64(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) {
    base64 += '='
  }
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function toUint8Array(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return new Uint8Array(data)
  if (typeof data === 'string') {
    try {
      return decodeBase64(data)
    } catch {
      return new TextEncoder().encode(data)
    }
  }
  return new Uint8Array(0)
}

function resolveCollabWebSocketURL(projectId: string, apiBase?: string): string {
  if (!IS_BROWSER && !apiBase) {
    throw new Error('Cloud collaboration transport requires a browser environment or explicit apiBase')
  }

  const base = apiBase || (IS_BROWSER ? window.location.origin : 'http://localhost')
  const url = new URL(`/api/projects/${encodeURIComponent(projectId)}/collab`, base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

interface PeerManager {
  verifiedPeers: Map<string, VerifiedPeerInfo>
  registerPeer: (peer?: VerifiedPeerInfo, fallbackId?: string) => void
  unregisterPeer: (id?: string) => void
}

function handlePeerEnvelopes(envelope: CollabEnvelope, pm: PeerManager): boolean {
  if (envelope.type === 'welcome') {
    if (envelope.peer) pm.verifiedPeers.set(envelope.peer.userId, envelope.peer)
    if (envelope.peers) {
      for (const peer of envelope.peers) pm.registerPeer(peer, peer.userId)
    }
    return true
  }
  if (envelope.type === 'peer-join') {
    pm.registerPeer(envelope.peer, envelope.senderId)
    return true
  }
  if (envelope.type === 'peer-leave') {
    pm.unregisterPeer(envelope.senderId ?? envelope.targetId ?? envelope.peer?.userId)
    return true
  }
  return false
}

function extractEnvelopeBytes(envelope: CollabEnvelope): Uint8Array | null {
  const raw = envelope.data ?? envelope.update ?? envelope.stateVector
  return raw ? toUint8Array(raw) : null
}

function handleSyncEnvelopes(
  envelope: CollabEnvelope,
  receivers: Map<string, CollabActionReceiver>
): boolean {
  const sender = envelope.senderId ?? 'room'
  const target = envelope.type === 'action' ? envelope.namespace : envelope.type
  if (!target) return false

  const handler = receivers.get(target)
  if (!handler) return false

  const bytes = extractEnvelopeBytes(envelope)
  if (bytes) handler(bytes, sender)
  return true
}

function handleSnapshotEnvelopes(
  envelope: CollabEnvelope,
  pendingSnapshots: Array<(result: SnapshotCandidateResult) => void>
): boolean {
  if (envelope.type === 'snapshot-response') {
    const resolver = pendingSnapshots.shift()
    resolver?.({
      success: Boolean(envelope.success),
      rev: envelope.rev,
      stateVector: envelope.stateVector,
      code: envelope.code,
      error: envelope.error
    })
    return true
  }
  if (envelope.type === 'error' && pendingSnapshots.length > 0) {
    const resolver = pendingSnapshots.shift()
    resolver?.({
      success: false,
      code: envelope.code ?? 'error',
      error: envelope.error ?? 'Collaboration error'
    })
    return true
  }
  return false
}

export function joinCloudCollabRoom(options: JoinCollabRoomOptions): CollabRoomTransport {
  const projectId = options.projectId ?? options.roomId
  if (!projectId) {
    throw new Error('Project ID is required to join cloud collaboration room')
  }

  const wsURL = resolveCollabWebSocketURL(projectId, options.apiBase)
  const socket = options.websocketFactory ? options.websocketFactory(wsURL) : new WebSocket(wsURL)
  socket.binaryType = 'arraybuffer'

  const verifiedPeers = new Map<string, VerifiedPeerInfo>()
  const receivers = new Map<string, CollabActionReceiver>()
  const joinHandlers = new Set<(peerId: string) => void>()
  const leaveHandlers = new Set<(peerId: string) => void>()
  const pendingSnapshots: Array<(result: SnapshotCandidateResult) => void> = []
  const pendingMessages: Array<string | Uint8Array> = []
  let left = false

  function postPayload(payload: string | Uint8Array) {
    if (socket.readyState === WebSocket.OPEN) {
      if (typeof payload === 'string') {
        socket.send(payload)
      } else {
        socket.send(payload.buffer as ArrayBuffer)
      }
    } else if (socket.readyState === WebSocket.CONNECTING) {
      pendingMessages.push(payload)
    }
  }

  function postEnvelope(envelope: CollabEnvelope) {
    postPayload(JSON.stringify(envelope))
  }

  function registerPeer(peer?: VerifiedPeerInfo, fallbackId?: string) {
    const id = peer?.userId ?? fallbackId
    if (!id) return
    if (peer) verifiedPeers.set(id, peer)
    for (const handler of joinHandlers) handler(id)
  }

  function unregisterPeer(id?: string) {
    if (!id) return
    verifiedPeers.delete(id)
    for (const handler of leaveHandlers) handler(id)
  }

  socket.addEventListener('open', () => {
    for (const message of pendingMessages.splice(0)) {
      if (typeof message === 'string') {
        socket.send(message)
      } else {
        socket.send(message.buffer as ArrayBuffer)
      }
    }
  })

  socket.addEventListener('message', (event: MessageEvent<string | ArrayBuffer>) => {
    if (typeof event.data !== 'string') {
      receivers.get('yjs-update')?.(new Uint8Array(event.data), 'room')
      return
    }

    let envelope: CollabEnvelope
    try {
      envelope = JSON.parse(event.data) as CollabEnvelope
    } catch {
      return
    }

    if (typeof envelope !== 'object') return

    if (envelope.peer) {
      verifiedPeers.set(envelope.peer.userId, envelope.peer)
    }

    const peerManager: PeerManager = { verifiedPeers, registerPeer, unregisterPeer }
    if (handlePeerEnvelopes(envelope, peerManager)) return
    if (handleSyncEnvelopes(envelope, receivers)) return
    handleSnapshotEnvelopes(envelope, pendingSnapshots)
  })

  return {
    mode: 'biosculpture-cloud',
    makeAction(namespace: string): CollabAction {
      return [
        (data: Uint8Array, peerId?: string) => {
          if (namespace === 'yjs-update' || namespace === 'awareness' || namespace === 'sync-reply') {
            postEnvelope({
              type: namespace,
              targetId: peerId,
              data: Array.from(data),
              update: encodeBase64(data)
            })
          } else if (namespace === 'sync-step1') {
            postEnvelope({
              type: 'sync-step1',
              targetId: peerId,
              data: Array.from(data),
              stateVector: encodeBase64(data)
            })
          } else {
            postEnvelope({
              type: 'action',
              namespace,
              targetId: peerId,
              data: Array.from(data)
            })
          }
        },
        (handler: CollabActionReceiver) => {
          if (receivers.has(namespace)) {
            throw new Error(`Collaboration action ${namespace} is already registered`)
          }
          receivers.set(namespace, handler)
        }
      ]
    },

    onPeerJoin(handler: (peerId: string) => void) {
      joinHandlers.add(handler)
      for (const id of verifiedPeers.keys()) {
        queueMicrotask(() => handler(id))
      }
    },

    onPeerLeave(handler: (peerId: string) => void) {
      leaveHandlers.add(handler)
    },

    getVerifiedPeer(peerId: string): VerifiedPeerInfo | undefined {
      return verifiedPeers.get(peerId)
    },

    getVerifiedPeers(): VerifiedPeerInfo[] {
      return Array.from(verifiedPeers.values())
    },

    async submitSnapshotCandidate(candidate: {
      snapshot: Uint8Array
      stateVector: Uint8Array
      expectedRev: string
      retainVersion?: boolean
    }): Promise<SnapshotCandidateResult> {
      if (socket.readyState !== WebSocket.OPEN) {
        return {
          success: false,
          code: 'not_connected',
          error: 'Cannot submit snapshot candidate: WebSocket is not open'
        }
      }

      return new Promise<SnapshotCandidateResult>((resolve) => {
        pendingSnapshots.push(resolve)
        postEnvelope({
          type: 'snapshot-candidate',
          snapshot: encodeBase64(candidate.snapshot),
          stateVector: encodeBase64(candidate.stateVector),
          expectedRev: candidate.expectedRev,
          retainVersion: candidate.retainVersion
        })
      })
    },

    async leave(): Promise<void> {
      if (left) return
      left = true
      joinHandlers.clear()
      leaveHandlers.clear()
      receivers.clear()
      verifiedPeers.clear()
      for (const resolver of pendingSnapshots.splice(0)) {
        resolver({ success: false, code: 'closed', error: 'Room left by client' })
      }
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, 'Client left room')
      }
    }
  }
}
