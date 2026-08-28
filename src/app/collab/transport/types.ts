export type CollabActionReceiver = (data: Uint8Array, peerId: string) => void
export type CollabAction = [
  send: (data: Uint8Array, peerId?: string) => void,
  receive: (handler: CollabActionReceiver) => void
]

export type CollabTransportMode = 'p2p' | 'biosculpture-cloud' | 'test'

export interface VerifiedPeerInfo {
  userId: string
  email: string
  displayName: string
  role: string
}

export interface SnapshotCandidateResult {
  success: boolean
  rev?: string
  stateVector?: string | null
  code?: string
  error?: string
}

export interface CollabRoomTransport {
  mode?: CollabTransportMode
  makeAction(namespace: string): CollabAction
  onPeerJoin(handler: (peerId: string) => void): void
  onPeerLeave(handler: (peerId: string) => void): void
  getVerifiedPeer?(peerId: string): VerifiedPeerInfo | undefined
  getVerifiedPeers?(): VerifiedPeerInfo[]
  submitSnapshotCandidate?(options: {
    snapshot: Uint8Array
    stateVector: Uint8Array
    expectedRev: string
    retainVersion?: boolean
  }): Promise<SnapshotCandidateResult>
  leave(): Promise<void>
}

export type JoinCollabRoomOptions = {
  projectId?: string
  roomId?: string
  mode?: CollabTransportMode
  apiBase?: string
  fetchImpl?: typeof fetch
  websocketFactory?: (url: string) => WebSocket
}

export type JoinCollabRoom = (roomIdOrOptions: string | JoinCollabRoomOptions) => CollabRoomTransport
