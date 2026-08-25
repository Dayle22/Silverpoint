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
  cancelPdfImport,
  confirmPdfImport,
  currentPdfSession,
  pdfImportLoading,
  pdfImportOpen
} from '@/app/document/io/pdf'
import { useDialogUI } from '@/components/ui/dialog'

const { dialogs } = useI18n()
const cls = useDialogUI({
  content: 'flex max-h-[85vh] w-[500px] max-w-[92vw] flex-col overflow-hidden'
})

const session = computed(() => currentPdfSession.value)
const totalPages = computed(() => session.value?.pages.length ?? 0)
const currentPageNumber = computed({
  get: () => session.value?.selectedPage ?? 1,
  set: (val: number) => {
    if (session.value && val >= 1 && val <= totalPages.value) {
      session.value.selectedPage = val
    }
  }
})

const currentPageSummary = computed(() => {
  if (!session.value) return null
  return session.value.pages[currentPageNumber.value - 1] ?? null
})

const diagnostics = computed(() => session.value?.diagnostics ?? [])

function prevPage() {
  if (currentPageNumber.value > 1) {
    currentPageNumber.value--
  }
}

function nextPage() {
  if (currentPageNumber.value < totalPages.value) {
    currentPageNumber.value++
  }
}
</script>

<template>
  <DialogRoot v-model:open="pdfImportOpen">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent
        data-test-id="pdf-import-dialog"
        :class="cls.content"
        :aria-describedby="undefined"
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <DialogTitle class="text-sm font-semibold text-surface">
              {{ dialogs.pdfImportTitle }}
            </DialogTitle>
            <DialogDescription class="mt-0.5 text-xs text-muted">
              {{ dialogs.pdfImportDescription }}
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

          <!-- Page Picker -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between font-medium text-surface">
              <span>{{ dialogs.pdfImportPage }}</span>
              <span class="text-muted">
                {{ dialogs.pdfImportPageCount({ current: currentPageNumber, total: totalPages }) }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                data-test-id="pdf-prev-page"
                class="flex size-7 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
                :disabled="currentPageNumber <= 1 || pdfImportLoading"
                @click="prevPage"
              >
                <icon-lucide-chevron-left class="size-4" />
              </button>

              <input
                v-model.number="currentPageNumber"
                data-test-id="pdf-page-input"
                type="number"
                min="1"
                :max="totalPages"
                class="flex h-7 flex-1 rounded-md border border-border bg-panel px-2 text-center text-xs text-surface outline-none focus:border-accent"
                :disabled="pdfImportLoading"
              />

              <button
                type="button"
                data-test-id="pdf-next-page"
                class="flex size-7 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-40"
                :disabled="currentPageNumber >= totalPages || pdfImportLoading"
                @click="nextPage"
              >
                <icon-lucide-chevron-right class="size-4" />
              </button>
            </div>

            <div v-if="currentPageSummary" class="flex items-center justify-between text-[11px] text-muted">
              <span>
                {{ dialogs.pdfImportDimensions({ width: currentPageSummary.widthPt, height: currentPageSummary.heightPt }) }}
              </span>
              <span v-if="currentPageSummary.rotation !== 0">
                {{ dialogs.pdfImportRotation({ rotation: currentPageSummary.rotation }) }}
              </span>
            </div>
          </div>

          <!-- Diagnostics List -->
          <div class="flex flex-col gap-1.5">
            <span class="font-medium text-surface">{{ dialogs.pdfImportDiagnostics }}</span>
            <div
              data-test-id="pdf-diagnostics-list"
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
                {{ dialogs.pdfImportNoDiagnostics }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            data-test-id="pdf-cancel-button"
            class="rounded-md px-3 py-1.5 text-xs text-muted transition-colors hover:bg-hover hover:text-surface disabled:opacity-50"
            :disabled="pdfImportLoading"
            @click="cancelPdfImport"
          >
            {{ dialogs.cancel }}
          </button>
          <button
            type="button"
            data-test-id="pdf-confirm-button"
            class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            :disabled="pdfImportLoading || totalPages === 0"
            @click="confirmPdfImport"
          >
            {{ pdfImportLoading ? 'Importing…' : dialogs.pdfImportButton }}
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
