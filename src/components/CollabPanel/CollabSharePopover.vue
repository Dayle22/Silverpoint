<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import CloudProjectRoom from '@/components/CollabPanel/CloudProjectRoom.vue'
import ConnectedRoom from '@/components/CollabPanel/ConnectedRoom.vue'
import JoinRoomPrompt from '@/components/CollabPanel/JoinRoomPrompt.vue'
import ShareOrJoinRoom from '@/components/CollabPanel/ShareOrJoinRoom.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import { usePopoverUI } from '@/components/ui/popover'
import collaborationTheme from '@/theme/collaboration'

const collab = useCollabPanelContext()
const cls = usePopoverUI({ content: 'z-50 w-72 p-3' })
const connection = computed(() => {
  if (collab.state.connected) return 'connected'
  if (collab.isJoining) return 'joining'
  return 'idle'
})
const collaboration = tv(collaborationTheme)
const styles = computed(() => collaboration({ connection: connection.value }))
</script>

<template>
  <PopoverRoot v-model:open="collab.popoverOpen">
    <PopoverTrigger as-child>
      <button
        data-test-id="collab-share-button"
        :data-connection="connection"
        :class="styles.shareButton()"
      >
        <span
          v-if="collab.isCloud"
          class="inline-flex size-2 rounded-full"
          :class="collab.state.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"
        />
        <icon-lucide-share-2 v-else class="size-3.5" />
        {{
          collab.isCloud
            ? collab.state.connected
              ? 'Live'
              : 'Offline'
            : collab.state.connected
              ? collab.dialogs.connected
              : collab.isJoining
                ? collab.dialogs.joinRoom
                : collab.dialogs.share
        }}
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="collab-popover"
        :class="cls.content"
        :side-offset="8"
        side="bottom"
        align="end"
      >
        <CloudProjectRoom v-if="collab.isCloud" />
        <ConnectedRoom v-else-if="collab.state.connected" />
        <JoinRoomPrompt v-else-if="collab.isJoining" />
        <ShareOrJoinRoom v-else />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
