<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  generateBarcodePlan,
  type BarcodeMetadata,
  type BarcodeOptions,
  type BarcodePlan,
  type QRCodeEcc,
  type QRCodeStyle
} from '@open-pencil/core/barcode'
import { colorToHex, parseColor } from '@open-pencil/core/color'
import { getBarcodeMetadata, hasBarcodeConflict } from '@open-pencil/core/editor'
import { useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const editor = useEditorStore()
const { selectedNode: node } = useSelectionState()

const metadata = computed<BarcodeMetadata | null>(() => {
  if (!node.value || node.value.type !== 'FRAME') return null
  return getBarcodeMetadata(node.value)
})

const conflict = computed<string | null>(() => {
  if (!node.value || !metadata.value) return null
  return hasBarcodeConflict(editor, node.value.id)
})

// QR local state
const qrPayload = ref('')
const qrEcc = ref<QRCodeEcc>('M')
const qrModuleSize = ref(4)
const qrStyle = ref<QRCodeStyle>('square')
const qrDarkHex = ref('#000000')
const qrLightHex = ref('#ffffff')

// EAN local state
const eanPayload = ref('')
const eanModuleSize = ref(2)
const eanBarHeight = ref(80)
const eanIncludeText = ref(true)
const eanDarkHex = ref('#000000')
const eanLightHex = ref('#ffffff')

function syncFromMetadata() {
  if (!metadata.value) return
  const opts = metadata.value.options
  if (opts.type === 'QR_CODE') {
    qrPayload.value = opts.payload
    qrEcc.value = opts.ecc
    qrModuleSize.value = opts.moduleSize
    qrStyle.value = opts.style
    qrDarkHex.value = colorToHex(opts.darkColor)
    qrLightHex.value = colorToHex(opts.lightColor)
  } else if (opts.type === 'EAN_13') {
    eanPayload.value = opts.payload
    eanModuleSize.value = opts.moduleSize
    eanBarHeight.value = opts.barHeight
    eanIncludeText.value = opts.includeText
    eanDarkHex.value = colorToHex(opts.darkColor)
    eanLightHex.value = colorToHex(opts.lightColor)
  }
}

watch(
  () => [node.value?.id, node.value?.pluginData],
  () => {
    syncFromMetadata()
  },
  { immediate: true, deep: true }
)

const currentOptions = computed<BarcodeOptions | null>(() => {
  if (!metadata.value) return null
  if (metadata.value.type === 'QR_CODE') {
    return {
      type: 'QR_CODE',
      payload: qrPayload.value,
      ecc: qrEcc.value,
      moduleSize: Number(qrModuleSize.value) || 4,
      style: qrStyle.value,
      darkColor: parseColor(qrDarkHex.value),
      lightColor: parseColor(qrLightHex.value)
    }
  }
  return {
    type: 'EAN_13',
    payload: eanPayload.value,
    moduleSize: Number(eanModuleSize.value) || 2,
    barHeight: Number(eanBarHeight.value) || 80,
    includeText: eanIncludeText.value,
    darkColor: parseColor(eanDarkHex.value),
    lightColor: parseColor(eanLightHex.value)
  }
})

const livePlan = computed<BarcodePlan | null>(() => {
  if (!currentOptions.value) return null
  try {
    return generateBarcodePlan(currentOptions.value)
  } catch {
    return null
  }
})

const validationError = computed<string>(() => {
  if (!currentOptions.value) return ''
  try {
    generateBarcodePlan(currentOptions.value)
    return ''
  } catch (err: unknown) {
    if (err instanceof Error) return err.message
    return 'Invalid barcode options'
  }
})

function applyRegeneration() {
  if (!node.value || !currentOptions.value || validationError.value || conflict.value) return
  editor.regenerateBarcode(node.value.id, currentOptions.value)
}
</script>

<template>
  <div v-if="metadata" data-test-id="barcode-properties-section">
    <PanelSection
      :label="metadata.type === 'QR_CODE' ? 'QR Code Generator' : 'EAN-13 Generator'"
    >
    <div class="flex flex-col gap-2 px-3 py-2 text-xs">
      <!-- Conflict warning -->
      <div
        v-if="conflict"
        class="rounded bg-danger/10 p-2 text-[11px] text-danger border border-danger/20"
        data-test-id="barcode-conflict-warning"
      >
        {{ conflict }}
      </div>

      <!-- QR options -->
      <template v-if="metadata.type === 'QR_CODE'">
        <label class="flex flex-col gap-1 text-muted">
          <span class="text-[11px] font-medium text-surface">Payload</span>
          <input
            v-model="qrPayload"
            type="text"
            class="h-7 w-full rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
            data-test-id="barcode-prop-payload"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-muted">
            <span class="text-[11px] font-medium text-surface">ECC Level</span>
            <select
              v-model="qrEcc"
              class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="barcode-prop-ecc"
            >
              <option value="L">L (7%)</option>
              <option value="M">M (15%)</option>
              <option value="Q">Q (25%)</option>
              <option value="H">H (30%)</option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-muted">
            <span class="text-[11px] font-medium text-surface">Module Size</span>
            <input
              v-model.number="qrModuleSize"
              type="number"
              min="1"
              max="32"
              class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="barcode-prop-module-size"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1 text-muted">
          <span class="text-[11px] font-medium text-surface">Style</span>
          <select
            v-model="qrStyle"
            class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
            data-test-id="barcode-prop-style"
          >
            <option value="square">Square</option>
            <option value="rounded">Rounded</option>
            <option value="dots">Dots</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center justify-between text-muted">
            <span>Dark</span>
            <input
              v-model="qrDarkHex"
              type="color"
              class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              data-test-id="barcode-prop-dark-color"
            />
          </label>
          <label class="flex items-center justify-between text-muted">
            <span>Light</span>
            <input
              v-model="qrLightHex"
              type="color"
              class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              data-test-id="barcode-prop-light-color"
            />
          </label>
        </div>
      </template>

      <!-- EAN options -->
      <template v-else>
        <label class="flex flex-col gap-1 text-muted">
          <span class="text-[11px] font-medium text-surface">Digits</span>
          <input
            v-model="eanPayload"
            type="text"
            maxlength="13"
            class="h-7 w-full rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent font-mono"
            data-test-id="barcode-prop-payload"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-muted">
            <span class="text-[11px] font-medium text-surface">Module Width</span>
            <input
              v-model.number="eanModuleSize"
              type="number"
              min="1"
              max="16"
              class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="barcode-prop-module-size"
            />
          </label>

          <label class="flex flex-col gap-1 text-muted">
            <span class="text-[11px] font-medium text-surface">Bar Height</span>
            <input
              v-model.number="eanBarHeight"
              type="number"
              min="20"
              max="300"
              class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
              data-test-id="barcode-prop-bar-height"
            />
          </label>
        </div>

        <label class="flex items-center gap-2 text-muted cursor-pointer">
          <input
            v-model="eanIncludeText"
            type="checkbox"
            class="rounded border-border accent-accent"
            data-test-id="barcode-prop-include-text"
          />
          <span class="text-xs text-surface">Human-readable digits</span>
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center justify-between text-muted">
            <span>Dark</span>
            <input
              v-model="eanDarkHex"
              type="color"
              class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              data-test-id="barcode-prop-dark-color"
            />
          </label>
          <label class="flex items-center justify-between text-muted">
            <span>Light</span>
            <input
              v-model="eanLightHex"
              type="color"
              class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
              data-test-id="barcode-prop-light-color"
            />
          </label>
        </div>
      </template>

      <!-- Scan check status -->
      <div
        v-if="livePlan"
        class="rounded bg-canvas p-2 text-[11px] text-muted flex flex-col gap-1 border border-border"
      >
        <div class="flex items-center justify-between">
          <span>Scan Check:</span>
          <span
            class="font-semibold"
            :class="livePlan.scanCheck.status === 'PASS' ? 'text-emerald-500' : 'text-amber-500'"
            data-test-id="barcode-prop-scan-status"
          >
            {{ livePlan.scanCheck.status }}
          </span>
        </div>
        <div v-if="livePlan.scanCheck.warnings.length > 0" class="text-[10px] text-amber-500">
          {{ livePlan.scanCheck.warnings.join(' ') }}
        </div>
      </div>

      <p v-if="validationError" class="text-[11px] text-danger">
        {{ validationError }}
      </p>

      <button
        type="button"
        class="mt-1 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        data-test-id="barcode-prop-regenerate"
        :disabled="Boolean(validationError) || !livePlan || Boolean(conflict)"
        @click="applyRegeneration"
      >
        Regenerate
      </button>
    </div>
  </PanelSection>
</div>
</template>
