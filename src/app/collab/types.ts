import type { Color } from '@open-pencil/scene-graph/primitives'
import type { CollabTransportMode, VerifiedPeerInfo } from './transport/types'

export interface RemotePeer {
  clientId: number
  name: string
  color: Color
  userId?: string
  email?: string
  role?: string
  cursor?: { x: number; y: number; pageId: string }
  selection?: string[]
}

export type CollabConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export interface CollabState {
  connected: boolean
  status: CollabConnectionStatus
  mode: CollabTransportMode
  roomId: string | null
  projectId: string | null
  peers: RemotePeer[]
  verifiedPeers: VerifiedPeerInfo[]
  localName: string
  localColor: Color
  localUserId?: string
  localEmail?: string
  localRole?: string
  errorMessage?: string | null
}

export const DEFAULT_COLLAB_STATE: CollabState = {
  connected: false,
  status: 'idle',
  mode: 'p2p',
  roomId: null,
  projectId: null,
  peers: [],
  verifiedPeers: [],
  localName: '',
  localColor: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
  errorMessage: null
}
