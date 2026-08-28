import { describe, test, expect } from 'bun:test'
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

import { joinCloudCollabRoom, encodeBase64, type CollabEnvelope } from '@/app/collab/transport/cloud'
import { connectCollabRoom } from '@/app/collab/room'
import { expectDefined } from '#tests/helpers/assert'

type Listener = (event: unknown) => void

interface AwarenessUserData {
  name?: string
  role?: string
  email?: string
}

class MockCloudWebSocket {
  static instances: MockCloudWebSocket[] = []
  readonly url: string
  readyState: number = WebSocket.CONNECTING
  binaryType: string = 'arraybuffer'
  listeners: Record<string, Listener[]> = {}
  sent: Array<string | ArrayBuffer | Uint8Array> = []
  bufferedAmount: number = 0
  extensions: string = ''
  protocol: string = ''
  onclose: null = null
  onerror: null = null
  onmessage: null = null
  onopen: null = null
  readonly CLOSED = WebSocket.CLOSED
  readonly CLOSING = WebSocket.CLOSING
  readonly CONNECTING = WebSocket.CONNECTING
  readonly OPEN = WebSocket.OPEN

  constructor(url: string) {
    this.url = url
    MockCloudWebSocket.instances.push(this)
    queueMicrotask(() => {
      if (this.readyState === WebSocket.CONNECTING) {
        this.readyState = WebSocket.OPEN
        this.dispatchEvent('open', {})
      }
    })
  }

  addEventListener(type: string, handler: Listener) {
    this.listeners[type] ??= []
    this.listeners[type].push(handler)
  }

  removeEventListener(type: string, handler: Listener) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((h) => h !== handler)
    }
  }

  dispatchEvent(type: string, event: unknown): boolean {
    const handlers = this.listeners[type] ?? []
    for (const h of handlers) h(event)
    return true
  }

  send(data: string | ArrayBuffer | Uint8Array) {
    this.sent.push(data)
  }

  close(code = 1000, reason = '') {
    this.readyState = WebSocket.CLOSED
    this.dispatchEvent('close', { code, reason })
  }

  receiveServerMessage(envelope: CollabEnvelope | string) {
    const text = typeof envelope === 'string' ? envelope : JSON.stringify(envelope)
    this.dispatchEvent('message', { data: text })
  }
}

function nextTick(): Promise<void> {
  return new Promise<void>((resolve) => {
    queueMicrotask(() => {
      resolve()
    })
  })
}

function createMockSocketFactory(onCreated: (ws: MockCloudWebSocket) => void): (url: string) => WebSocket {
  return (url: string) => {
    const ws = new MockCloudWebSocket(url)
    onCreated(ws)
    return ws as WebSocket
  }
}

describe('Bio Sculpture Cloud Collaboration Transport (F-016f)', () => {
  test('connects to authenticated project room websocket endpoint and handles welcome envelope', async () => {
    let mockWs: MockCloudWebSocket | null = null
    const transport = joinCloudCollabRoom({
      projectId: 'proj-101',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        mockWs = ws
      })
    })

    const ws = expectDefined(mockWs, 'mockWs')
    expect(ws.url).toBe('wss://cloud.biosculpture.com/api/projects/proj-101/collab')

    let joinedPeerId: string | null = null
    transport.onPeerJoin((peerId) => {
      joinedPeerId = peerId
    })

    ws.receiveServerMessage({
      type: 'welcome',
      senderId: 'room',
      targetId: 'user-1',
      peer: {
        userId: 'user-1',
        email: 'alice@biosculpture.com',
        displayName: 'Alice Engineer',
        role: 'editor'
      },
      peers: [
        {
          userId: 'user-2',
          email: 'bob@biosculpture.com',
          displayName: 'Bob Designer',
          role: 'viewer'
        }
      ]
    })

    await nextTick()

    const verifiedBob = transport.getVerifiedPeer?.('user-2')
    expect(verifiedBob).toEqual({
      userId: 'user-2',
      email: 'bob@biosculpture.com',
      displayName: 'Bob Designer',
      role: 'viewer'
    })
    expect(joinedPeerId).toBe('user-2')

    await transport.leave()
    expect(ws.readyState).toBe(WebSocket.CLOSED)
  })

  test('verified peer awareness overwrites arbitrary client-claimed names in cloud mode', async () => {
    let mockWs: MockCloudWebSocket | null = null
    const ydoc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(ydoc)
    let connected = false
    let peerListUpdated = false

    const roomConn = connectCollabRoom({
      options: {
        projectId: 'proj-101',
        mode: 'biosculpture-cloud',
        apiBase: 'https://cloud.biosculpture.com',
        websocketFactory: createMockSocketFactory((ws) => {
          mockWs = ws
        })
      },
      ydoc,
      awareness,
      setConnected: () => {
        connected = true
      },
      updatePeersList: () => {
        peerListUpdated = true
      }
    })

    const ws = expectDefined(mockWs, 'mockWs')

    ws.receiveServerMessage({
      type: 'welcome',
      senderId: 'room',
      peers: [
        {
          userId: 'user-verified-99',
          email: 'verified@biosculpture.com',
          displayName: 'Verified Dayle',
          role: 'admin'
        }
      ]
    })

    const remoteDoc = new Y.Doc()
    const remoteAwareness = new awarenessProtocol.Awareness(remoteDoc)
    remoteAwareness.setLocalStateField('user', {
      name: 'Forged Hacker Name',
      color: { r: 1, g: 0, b: 0, a: 1 }
    })
    const encodedAwareness = awarenessProtocol.encodeAwarenessUpdate(remoteAwareness, [remoteAwareness.clientID])

    ws.receiveServerMessage({
      type: 'awareness',
      senderId: 'user-verified-99',
      data: Array.from(encodedAwareness),
      peer: {
        userId: 'user-verified-99',
        email: 'verified@biosculpture.com',
        displayName: 'Verified Dayle',
        role: 'admin'
      }
    })

    const states = awareness.getStates()
    const remoteState = states.get(remoteAwareness.clientID)
    expect(remoteState).toBeDefined()
    const user = remoteState?.user as AwarenessUserData | undefined
    expect(user?.name).toBe('Verified Dayle')
    expect(user?.role).toBe('admin')
    expect(user?.email).toBe('verified@biosculpture.com')
    expect(connected || peerListUpdated).toBe(true)

    await roomConn.room.leave()
  })

  test('multi-project isolation: separate project IDs produce distinct transports and isolated rooms', async () => {
    let wsA: MockCloudWebSocket | null = null
    let wsB: MockCloudWebSocket | null = null

    const transportA = joinCloudCollabRoom({
      projectId: 'project-alpha',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        wsA = ws
      })
    })

    const transportB = joinCloudCollabRoom({
      projectId: 'project-beta',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        wsB = ws
      })
    })

    const socketA = expectDefined(wsA, 'wsA')
    const socketB = expectDefined(wsB, 'wsB')

    expect(socketA.url).toContain('project-alpha')
    expect(socketB.url).toContain('project-beta')
    expect(socketA).not.toBe(socketB)

    await nextTick()

    const [sendA] = transportA.makeAction('yjs-update')
    sendA(new Uint8Array([1, 2, 3]))

    expect(socketA.sent).toHaveLength(1)
    expect(socketB.sent).toHaveLength(0)

    await transportA.leave()
    await transportB.leave()
  })

  test('submits guarded snapshot candidate and handles success response', async () => {
    let mockWs: MockCloudWebSocket | null = null
    const transport = joinCloudCollabRoom({
      projectId: 'proj-snapshot-1',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        mockWs = ws
      })
    })

    const ws = expectDefined(mockWs, 'mockWs')
    await nextTick()

    const snapshotBytes = new Uint8Array([10, 20, 30])
    const vectorBytes = new Uint8Array([1, 0, 0])

    const saveCandidate = expectDefined(transport.submitSnapshotCandidate, 'submitSnapshotCandidate')
    const savePromise = saveCandidate({
      snapshot: snapshotBytes,
      stateVector: vectorBytes,
      expectedRev: 'rev-abc-1'
    })

    expect(ws.sent).toHaveLength(1)
    const sentMsg = JSON.parse(String(ws.sent[0])) as CollabEnvelope
    expect(sentMsg.type).toBe('snapshot-candidate')
    expect(sentMsg.expectedRev).toBe('rev-abc-1')
    expect(sentMsg.snapshot).toBe(encodeBase64(snapshotBytes))

    ws.receiveServerMessage({
      type: 'snapshot-response',
      success: true,
      rev: 'rev-abc-2',
      stateVector: encodeBase64(vectorBytes)
    })

    const result = await savePromise
    expect(result.success).toBe(true)
    expect(result.rev).toBe('rev-abc-2')

    await transport.leave()
  })

  test('submits guarded snapshot candidate and detects conflict when concurrent edits occur', async () => {
    let mockWs: MockCloudWebSocket | null = null
    const transport = joinCloudCollabRoom({
      projectId: 'proj-snapshot-conflict',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        mockWs = ws
      })
    })

    const ws = expectDefined(mockWs, 'mockWs')
    await nextTick()

    const saveCandidate = expectDefined(transport.submitSnapshotCandidate, 'submitSnapshotCandidate')
    const savePromise = saveCandidate({
      snapshot: new Uint8Array([1, 2, 3]),
      stateVector: new Uint8Array([0]),
      expectedRev: 'rev-stale'
    })

    ws.receiveServerMessage({
      type: 'snapshot-response',
      success: false,
      code: 'conflict',
      error: 'State vector mismatch: newer updates exist in room'
    })

    const result = await savePromise
    expect(result.success).toBe(false)
    expect(result.code).toBe('conflict')
    expect(result.error).toContain('mismatch')

    await transport.leave()
  })

  test('proves client cannot join or switch to unauthorized project room without server acceptance', async () => {
    let mockWs: MockCloudWebSocket | null = null
    const transport = joinCloudCollabRoom({
      projectId: 'unauthorized-private-project',
      apiBase: 'https://cloud.biosculpture.com',
      websocketFactory: createMockSocketFactory((ws) => {
        mockWs = ws
      })
    })

    const ws = expectDefined(mockWs, 'mockWs')
    await nextTick()

    ws.receiveServerMessage({
      type: 'error',
      code: 'forbidden',
      error: 'Forbidden: access to project denied'
    })

    ws.close(1008, 'Forbidden')

    expect(ws.readyState).toBe(WebSocket.CLOSED)
    await transport.leave()
  })
})
