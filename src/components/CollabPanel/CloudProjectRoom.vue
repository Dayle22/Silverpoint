<script setup lang="ts">
import { computed } from 'vue'
import { initials } from '@/app/shell/ui'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import { colorToCSS } from '@open-pencil/core/color'
import { useI18n } from '@open-pencil/vue'

const collab = useCollabPanelContext()
const { dialogs } = useI18n()

const participants = computed(() => {
  const list: Array<{
    id: string | number
    name: string
    email?: string
    role?: string
    isSelf: boolean
    isFollowing: boolean
    color?: string
  }> = []

  // Self
  list.push({
    id: 'self',
    name: collab.state.localName || 'You',
    email: collab.state.localEmail,
    role: collab.state.localRole || 'Member',
    isSelf: true,
    isFollowing: false,
    color: colorToCSS(collab.state.localColor)
  })

  // Remote peers
  for (const peer of collab.peers) {
    list.push({
      id: peer.clientId,
      name: peer.name,
      email: peer.email,
      role: peer.role || 'Member',
      isSelf: false,
      isFollowing: collab.followingPeer === peer.clientId,
      color: colorToCSS(peer.color)
    })
  }

  return list
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- Header / Live Badge -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span
          class="inline-flex size-2 rounded-full"
          :class="collab.state.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
        />
        <span class="text-xs font-semibold text-surface">
          {{ collab.state.connected ? 'Live Session' : 'Reconnecting...' }}
        </span>
      </div>
      <span class="text-[10px] text-muted uppercase tracking-wider font-mono">Bio Sculpture</span>
    </div>

    <!-- Participants list -->
    <div class="flex flex-col gap-1.5">
      <div class="text-[11px] font-medium text-muted">
        Participants ({{ participants.length }})
      </div>
      <div class="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
        <div
          v-for="p in participants"
          :key="p.id"
          class="flex items-center justify-between rounded-md p-1.5 hover:bg-hover transition-colors"
          :data-test-id="`cloud-participant-${p.id}`"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <div
              class="size-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
              :style="{ background: p.color || '#3b82f6' }"
            >
              {{ initials(p.name) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-xs font-medium text-surface">
                  {{ p.name }} {{ p.isSelf ? `(${dialogs.youSuffix})` : '' }}
                </span>
                <span
                  v-if="p.role"
                  class="shrink-0 rounded bg-panel-field px-1 py-0.2 text-[9px] font-mono text-muted uppercase"
                >
                  {{ p.role }}
                </span>
              </div>
              <p v-if="p.email" class="truncate text-[10px] text-muted">
                {{ p.email }}
              </p>
            </div>
          </div>

          <button
            v-if="!p.isSelf && typeof p.id === 'number'"
            type="button"
            class="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted hover:text-surface hover:bg-hover shrink-0 cursor-pointer"
            :class="{ 'border-accent text-accent font-medium': p.isFollowing }"
            @click="collab.toggleFollowPeer(p.id)"
          >
            {{ p.isFollowing ? 'Following' : 'Follow' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2 pt-1 border-t border-border">
      <button
        v-if="!collab.state.connected"
        type="button"
        data-test-id="cloud-collab-reconnect"
        class="flex-1 h-7 rounded bg-accent px-2 text-xs font-medium text-white hover:bg-accent/90 cursor-pointer"
        @click="collab.reconnect"
      >
        Reconnect
      </button>
      <button
        type="button"
        data-test-id="cloud-collab-disconnect"
        class="flex-1 h-7 rounded border border-border bg-transparent text-xs text-muted hover:bg-hover hover:text-surface cursor-pointer"
        @click="collab.disconnect"
      >
        {{ collab.state.connected ? 'Disconnect' : 'Cancel' }}
      </button>
    </div>
  </div>
</template>
