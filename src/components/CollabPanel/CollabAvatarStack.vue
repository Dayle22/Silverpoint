<script setup lang="ts">
import { tv } from 'tailwind-variants'

import { colorToCSS } from '@open-pencil/core/color'
import { useI18n } from '@open-pencil/vue'

import type { RemotePeer } from '@/app/collab/types'
import { initials } from '@/app/shell/ui'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import Tip from '@/components/ui/overlay/Tip.vue'
import collaborationTheme from '@/theme/collaboration'

const collab = useCollabPanelContext()
const { common, collaboration: collaborationMessages } = useI18n()
const collaboration = tv(collaborationTheme)
const avatar = collaboration({ size: 'sm', bordered: true })

function peerAvatarClass(following: boolean) {
  return collaboration({ size: 'sm', bordered: true, following }).avatar()
}

function getPeerLabel(peer: RemotePeer): string {
  if (collab.followingPeer === peer.clientId) {
    return collaborationMessages.value.followingPeerStop({ name: peer.name })
  }
  const roleSuffix = peer.role ? ` (${peer.role})` : ''
  return `${collaborationMessages.value.clickToFollowPeer({ name: peer.name })}${roleSuffix}`
}
</script>

<template>
  <div class="flex -space-x-1.5">
    <Tip :label="`${collab.state.localName || common.you} (${common.youSuffix})`">
      <div
        data-test-id="collab-local-avatar"
        :class="avatar.avatar()"
        :style="{ background: colorToCSS(collab.state.localColor) }"
      >
        {{ initials(collab.state.localName || common.you) }}
      </div>
    </Tip>

    <Tip v-for="peer in collab.peers" :key="peer.clientId" :label="getPeerLabel(peer)">
      <div
        data-test-id="collab-peer-avatar"
        :data-following="collab.followingPeer === peer.clientId || undefined"
        :class="[peerAvatarClass(collab.followingPeer === peer.clientId), avatar.peerAvatar()]"
        :style="{ background: colorToCSS(peer.color) }"
        @click="collab.toggleFollowPeer(peer.clientId)"
      >
        {{ initials(peer.name) }}
      </div>
    </Tip>
  </div>
</template>
