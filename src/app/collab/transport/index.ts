import { IS_BROWSER } from '@/constants'

import { joinCloudCollabRoom } from './cloud'
import { joinTestCollabRoom } from './test'
import { joinTrysteroCollabRoom } from './trystero'
import type { JoinCollabRoom } from './types'

function usesTestTransport(): boolean {
  if (!IS_BROWSER || !import.meta.env.DEV) return false
  return new URLSearchParams(window.location.search).get('collabTransport') === 'test'
}

export const joinCollabRoom: JoinCollabRoom = (roomIdOrOptions) => {
  if (typeof roomIdOrOptions === 'object') {
    if (roomIdOrOptions.mode === 'biosculpture-cloud' || roomIdOrOptions.projectId) {
      return joinCloudCollabRoom(roomIdOrOptions)
    }
    if (roomIdOrOptions.mode === 'test' || usesTestTransport()) {
      return joinTestCollabRoom(roomIdOrOptions.roomId ?? roomIdOrOptions.projectId ?? '')
    }
    return joinTrysteroCollabRoom(roomIdOrOptions.roomId ?? roomIdOrOptions.projectId ?? '')
  }

  const roomId = roomIdOrOptions
  return usesTestTransport() ? joinTestCollabRoom(roomId) : joinTrysteroCollabRoom(roomId)
}

export { joinCloudCollabRoom } from './cloud'
export { joinTestCollabRoom } from './test'
export { joinTrysteroCollabRoom } from './trystero'
export type {
  CollabAction,
  CollabActionReceiver,
  CollabRoomTransport,
  CollabTransportMode,
  JoinCollabRoom,
  JoinCollabRoomOptions,
  SnapshotCandidateResult,
  VerifiedPeerInfo
} from './types'
