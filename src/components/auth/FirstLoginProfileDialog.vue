<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  AppDialogBody,
  AppDialogFooter,
  AppDialogHeader,
  AppDialogRoot
} from '@/components/ui/dialog'
import { useAuth } from '@/app/auth/use'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string
          action?: string
          callback?: (token: string) => void
          'error-callback'?: (code: unknown) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
        }
      ) => string
      reset: (widgetId?: string) => void
      remove: (widgetId: string) => void
    }
  }
}

import { IS_BROWSER } from '@/constants'

const {
  turnstileSiteKey = '1x00000000000000000000AA'
} = defineProps<{
  turnstileSiteKey?: string
}>()

const emit = defineEmits<{
  (e: 'completed'): void
}>()

const { state, needsBootstrap, isSuspended, bootstrapProfile } = useAuth()

const displayName = ref(state.suggestedName || '')
const turnstileToken = ref('')
const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)
const turnstileContainer = ref<HTMLElement | null>(null)
let turnstileWidgetId: string | null = null

const email = computed(() => state.bootstrapEmail || 'user@biosculpture.com')
const isOpen = computed({
  get: () => needsBootstrap.value,
  set: () => {
    // Cannot be dismissed manually while onboarding is required
  }
})

const canSubmit = computed(
  () => displayName.value.trim().length > 0 && turnstileToken.value.length > 0 && !isSubmitting.value
)

watch(
  () => state.suggestedName,
  (newName) => {
    if (newName && !displayName.value) {
      displayName.value = newName
    }
  }
)

function resetTurnstileWidget() {
  turnstileToken.value = ''
  if (window.turnstile && turnstileWidgetId) {
    try {
      window.turnstile.reset(turnstileWidgetId)
    } catch (e) {
      console.warn('[Turnstile] Reset failed:', e)
    }
  }
}

function initTurnstile() {
  if (!IS_BROWSER || !turnstileContainer.value) return

  if (window.turnstile) {
    try {
      if (turnstileWidgetId) {
        window.turnstile.remove(turnstileWidgetId)
        turnstileWidgetId = null
      }
      turnstileWidgetId = window.turnstile.render(turnstileContainer.value, {
        sitekey: turnstileSiteKey,
        action: 'signup',
        callback: (token: string) => {
          turnstileToken.value = token
          errorMessage.value = null
        },
        'error-callback': () => {
          turnstileToken.value = ''
          errorMessage.value = 'Turnstile verification failed. Please try again.'
        },
        'expired-callback': () => {
          turnstileToken.value = ''
        },
        theme: 'auto'
      })
    } catch (e) {
      console.warn('[Turnstile] Initialization notice:', e)
    }
  } else {
    // In local development/testing without external scripts loaded, allow fallback token
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      turnstileToken.value = 'local_dev_test_token'
    }
  }
}

watch(
  () => needsBootstrap.value,
  async (needed) => {
    if (needed) {
      errorMessage.value = null
      displayName.value = state.suggestedName || ''
      await nextTick()
      initTurnstile()
    }
  }
)

onMounted(async () => {
  if (needsBootstrap.value) {
    await nextTick()
    initTurnstile()
  }
})

onUnmounted(() => {
  if (window.turnstile && turnstileWidgetId) {
    try {
      window.turnstile.remove(turnstileWidgetId)
    } catch (e) {
      console.warn('[Turnstile] Cleanup failed:', e)
    }
    turnstileWidgetId = null
  }
})

async function submit() {
  if (!canSubmit.value) return

  isSubmitting.value = true
  errorMessage.value = null

  try {
    await bootstrapProfile({
      turnstileToken: turnstileToken.value,
      displayName: displayName.value.trim()
    })
    emit('completed')
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Profile creation failed'
  } finally {
    isSubmitting.value = false
    // Always reset Turnstile token and widget after every attempt because tokens are single-use
    resetTurnstileWidget()
  }
}
</script>

<template>
  <AppDialogRoot v-model:open="isOpen" size="sm">
    <AppDialogHeader
      heading="Welcome to Bio Sculpture"
      :show-close="false"
    />
    <AppDialogBody>
      <div class="flex flex-col gap-4">
        <p class="text-xs text-muted">
          Your Cloudflare Access identity has been verified. Complete your profile to join the workspace.
        </p>

        <!-- Access Verified Email (Read-only) -->
        <label class="flex flex-col gap-1 text-xs font-medium text-surface">
          Bio Sculpture Email
          <input
            :value="email"
            readonly
            disabled
            class="h-8 cursor-not-allowed rounded border border-border bg-hover px-2 text-sm text-muted outline-none"
          />
          <span class="text-[11px] text-muted">Verified by Cloudflare Access</span>
        </label>

        <!-- Display Name -->
        <label class="flex flex-col gap-1 text-xs font-medium text-surface">
          Display Name
          <input
            v-model="displayName"
            placeholder="e.g. Sarah Designer"
            maxlength="100"
            class="h-8 rounded border border-border bg-input px-2 text-sm text-surface outline-none focus:border-panel-focus"
            :disabled="isSubmitting"
            @keydown.enter.prevent="submit"
          />
        </label>

        <!-- Turnstile Bot Challenge Container -->
        <div class="flex flex-col gap-1">
          <div ref="turnstileContainer" class="min-h-[65px] flex items-center justify-center"></div>
        </div>

        <!-- Error Message -->
        <div
          v-if="errorMessage || state.errorMessage"
          class="rounded bg-danger/10 p-2 text-xs text-danger"
          role="alert"
        >
          {{ errorMessage || state.errorMessage }}
        </div>

        <div
          v-if="isSuspended"
          class="rounded bg-danger/10 p-2 text-xs text-danger"
          role="alert"
        >
          Your account is suspended. Please contact a Bio Sculpture workspace administrator.
        </div>
      </div>
    </AppDialogBody>
    <AppDialogFooter>
      <button
        type="button"
        :disabled="!canSubmit"
        class="h-8 w-full cursor-pointer rounded bg-accent px-3 text-xs font-medium text-white disabled:cursor-default disabled:opacity-40"
        @click="submit"
      >
        <span v-if="isSubmitting">Creating Profile...</span>
        <span v-else>Join Workspace</span>
      </button>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
