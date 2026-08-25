<script setup lang="ts">
import { computed } from 'vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'

import {
  cancelIdmlImport,
  confirmIdmlImport,
  currentIdmlSession,
  idmlImportLoading,
  idmlImportOpen
} from '@/app/document/io/idml'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const cls = useDialogUI({
  content: 'flex max-h-[85vh] w-[500px] max-w-[92vw] flex-col overflow-hidden'
})

const session = computed(() => currentIdmlSession.value)
const totalPages = computed(() => session.value?.pages.length ?? 0)
const diagnostics = computed(() => session.value?.diagnostics ?? [])
</script>

<template>
  <DialogRoot v-model:open="idmlImportOpen">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent
        data-test-id="idml-import-dialog"
        :class="cls.content"
        :aria-describedby="undefined"
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <DialogTitle class="text-sm font-semibold text-surface">
              {{ dialogs.idmlImportTitle }}
            </DialogTitle>
            <DialogDescription class="mt-0.5 text-xs text-muted">
              {{ dialogs.idmlImportDescription }}
            </DialogDescription>
          </div>
        </div>

        <div v-if="session" class="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-xs">
          <!-- File info -->
          <div class="flex flex-col gap-1 rounded-lg border border-border bg-hover/30 p-3">
            <div class="flex items-center justify-between font-medium text-surface">
              <span class="truncate">{{ session.file.name }}</span>
              <span class="shrink-0 text-muted">{{ totalPages }} {{ totalPages === 1 ? 'page' : 'pages' }}</span>
            </div>
          </div>

          <!-- Diagnostics List -->
          <div class="flex flex-col gap-1.5">
            <span class="font-medium text-surface">{{ dialogs.idmlImportDiagnostics }}</span>
            <div
              data-test-id="idml-diagnostics-list"
              class="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-hover/20 p-2 text-[11px]"
            >
              <div
                v-for="(diag, idx) in diagnostics"
                :key="idx"
                class="flex items-start gap-1.5 py-0.5"
                :class="{
                  'text-amber-400': diag.severity === 'warning',
                  'text-rose-400': diag.severity === 'error',
                  'text-muted': diag.severity === 'info'
                }"
              >
                <span class="shrink-0 font-mono font-semibold uppercase">[{{ diag.severity }}]</span>
                <span class="flex-1 text-surface">{{ diag.message }}</span>
              </div>
              <div v-if="diagnostics.length === 0" class="text-muted italic">
                {{ dialogs.idmlImportNoDiagnostics }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            data-test-id="idml-cancel-button"
            class="rounded-md px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-50"
            :disabled="idmlImportLoading"
            @click="cancelIdmlImport"
          >
            {{ dialogs.cancel }}
          </button>
          <button
            type="button"
            data-test-id="idml-confirm-button"
            class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            :disabled="idmlImportLoading || totalPages === 0"
            @click="confirmIdmlImport"
          >
            {{ idmlImportLoading ? 'Importing…' : dialogs.idmlImportButton }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
