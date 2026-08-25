<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  PopoverContent,
  PopoverPortal,
  PopoverRoot,
  PopoverTrigger
} from 'reka-ui'
import type { Component } from 'vue'

import {
  generateBarcodePlan,
  type BarcodeOptions,
  type BarcodePlan,
  type BarcodeType,
  type QRCodeEcc,
  type QRCodeStyle
} from '@open-pencil/core/barcode'
import { parseColor } from '@open-pencil/core/color'
import { toolbarToolTestId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import ToolButton from '@/components/Toolbar/ToolButton.vue'

const { icon, active } = defineProps<{
  icon: Component
  active: boolean
}>()

const editor = useEditorStore()
const open = ref(false)

const activeType = ref<BarcodeType>('QR_CODE')

// QR Code form state
const qrPayload = ref('https://silverpoint.org')
const qrEcc = ref<QRCodeEcc>('M')
const qrModuleSize = ref(4)
const qrStyle = ref<QRCodeStyle>('square')
const qrDarkHex = ref('#000000')
const qrLightHex = ref('#ffffff')

// EAN-13 form state
const eanPayload = ref('978020137962')
const eanModuleSize = ref(2)
const eanBarHeight = ref(80)
const eanIncludeText = ref(true)
const eanDarkHex = ref('#000000')
const eanLightHex = ref('#ffffff')

const currentOptions = computed<BarcodeOptions>(() => {
  if (activeType.value === 'QR_CODE') {
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
  try {
    return generateBarcodePlan(currentOptions.value)
  } catch {
    return null
  }
})

const validationError = computed<string>(() => {
  try {
    generateBarcodePlan(currentOptions.value)
    return ''
  } catch (err: unknown) {
    if (err instanceof Error) return err.message
    return 'Invalid barcode options'
  }
})

function close() {
  open.value = false
}

function openPopover() {
  if (editor.state.activeTool === 'BARCODE_EAN13') {
    activeType.value = 'EAN_13'
  }
  open.value = true
}

function insertBarcode() {
  if (validationError.value || !livePlan.value) return
  editor.createBarcode(currentOptions.value)
  close()
}

watch(
  () => editor.state.activeTool,
  (tool, previousTool) => {
    if ((tool === 'BARCODE' || tool === 'BARCODE_EAN13') && previousTool !== tool) {
      if (tool === 'BARCODE_EAN13') {
        activeType.value = 'EAN_13'
      } else {
        activeType.value = 'QR_CODE'
      }
      open.value = true
    }
  }
)
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <ToolButton
        :data-test-id="toolbarToolTestId('BARCODE')"
        :icon="icon"
        :active="active"
        @click="openPopover"
      />
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        side="top"
        :side-offset="8"
        align="center"
        :collision-padding="8"
        class="z-50 w-72 rounded-lg border border-border bg-panel p-3 shadow-lg select-none text-xs"
        data-test-id="barcode-generator-popover"
        @escape-key-down="close"
      >
        <div class="flex flex-col gap-3">
          <!-- Type selector -->
          <div class="flex rounded-md bg-canvas p-0.5 border border-border">
            <button
              type="button"
              class="flex-1 rounded py-1 text-center font-medium transition-colors"
              :class="activeType === 'QR_CODE' ? 'bg-hover text-surface shadow-xs' : 'text-muted hover:text-surface'"
              data-test-id="barcode-type-qr"
              @click="activeType = 'QR_CODE'"
            >
              QR Code
            </button>
            <button
              type="button"
              class="flex-1 rounded py-1 text-center font-medium transition-colors"
              :class="activeType === 'EAN_13' ? 'bg-hover text-surface shadow-xs' : 'text-muted hover:text-surface'"
              data-test-id="barcode-type-ean13"
              @click="activeType = 'EAN_13'"
            >
              EAN-13
            </button>
          </div>

          <!-- QR form -->
          <div v-if="activeType === 'QR_CODE'" class="flex flex-col gap-2.5">
            <label class="flex flex-col gap-1 text-muted">
              <span class="text-[11px] font-medium text-surface">Payload / URL</span>
              <input
                v-model="qrPayload"
                type="text"
                class="h-7 w-full rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
                data-test-id="barcode-qr-payload"
                placeholder="Enter text or URL"
              />
            </label>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex flex-col gap-1 text-muted">
                <span class="text-[11px] font-medium text-surface">ECC Level</span>
                <select
                  v-model="qrEcc"
                  class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
                  data-test-id="barcode-qr-ecc"
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
                  data-test-id="barcode-qr-module-size"
                />
              </label>
            </div>

            <label class="flex flex-col gap-1 text-muted">
              <span class="text-[11px] font-medium text-surface">Style</span>
              <select
                v-model="qrStyle"
                class="h-7 rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent"
                data-test-id="barcode-qr-style"
              >
                <option value="square">Square</option>
                <option value="rounded">Rounded</option>
                <option value="dots">Dots</option>
              </select>
            </label>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center justify-between text-muted">
                <span>Dark Color</span>
                <input
                  v-model="qrDarkHex"
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
                  data-test-id="barcode-qr-dark-color"
                />
              </label>
              <label class="flex items-center justify-between text-muted">
                <span>Light Color</span>
                <input
                  v-model="qrLightHex"
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
                  data-test-id="barcode-qr-light-color"
                />
              </label>
            </div>
          </div>

          <!-- EAN-13 form -->
          <div v-else class="flex flex-col gap-2.5">
            <label class="flex flex-col gap-1 text-muted">
              <span class="text-[11px] font-medium text-surface">Digits (12 or 13)</span>
              <input
                v-model="eanPayload"
                type="text"
                maxlength="13"
                class="h-7 w-full rounded-md border border-border bg-canvas px-2 text-xs text-surface outline-none focus:border-accent font-mono"
                data-test-id="barcode-ean-payload"
                placeholder="e.g. 978020137962"
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
                  data-test-id="barcode-ean-module-size"
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
                  data-test-id="barcode-ean-height"
                />
              </label>
            </div>

            <label class="flex items-center gap-2 text-muted cursor-pointer">
              <input
                v-model="eanIncludeText"
                type="checkbox"
                class="rounded border-border accent-accent"
                data-test-id="barcode-ean-text"
              />
              <span class="text-xs text-surface">Human-readable digits</span>
            </label>

            <div class="grid grid-cols-2 gap-2">
              <label class="flex items-center justify-between text-muted">
                <span>Dark Color</span>
                <input
                  v-model="eanDarkHex"
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
                  data-test-id="barcode-ean-dark-color"
                />
              </label>
              <label class="flex items-center justify-between text-muted">
                <span>Light Color</span>
                <input
                  v-model="eanLightHex"
                  type="color"
                  class="h-6 w-8 cursor-pointer rounded border border-border bg-transparent"
                  data-test-id="barcode-ean-light-color"
                />
              </label>
            </div>
          </div>

          <!-- Live Readout / Info -->
          <div
            v-if="livePlan"
            class="rounded-md bg-canvas/60 p-2 text-[11px] text-muted flex flex-col gap-1 border border-border/50"
          >
            <div class="flex items-center justify-between">
              <span>Dimensions:</span>
              <span class="font-medium text-surface">{{ livePlan.width }} × {{ livePlan.height }} px</span>
            </div>
            <div v-if="activeType === 'QR_CODE' && livePlan.info?.version" class="flex items-center justify-between">
              <span>QR Version:</span>
              <span class="font-medium text-surface">Version {{ livePlan.info.version }}</span>
            </div>
            <div v-if="activeType === 'EAN_13' && livePlan.info?.checksum" class="flex items-center justify-between">
              <span>Checksum:</span>
              <span class="font-mono font-medium text-surface">{{ livePlan.info.checksum }}</span>
            </div>
            <div class="flex items-center justify-between pt-0.5">
              <span>Scan Check:</span>
              <span
                class="font-semibold"
                :class="livePlan.scanCheck.status === 'PASS' ? 'text-emerald-500' : 'text-amber-500'"
                data-test-id="barcode-scan-status"
              >
                {{ livePlan.scanCheck.status }}
              </span>
            </div>
            <div v-if="livePlan.scanCheck.warnings.length > 0" class="text-[10px] text-amber-500/90 pt-0.5">
              {{ livePlan.scanCheck.warnings.join(' ') }}
            </div>
          </div>

          <!-- Error display -->
          <p
            v-if="validationError"
            data-test-id="barcode-validation-error"
            class="text-[11px] text-danger"
          >
            {{ validationError }}
          </p>

          <!-- Buttons -->
          <div class="flex justify-end gap-1.5 pt-1">
            <button
              type="button"
              class="rounded-md px-2.5 py-1 text-xs text-muted hover:bg-hover hover:text-surface"
              data-test-id="barcode-cancel"
              @click="close"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md bg-accent px-3 py-1 text-xs text-white font-medium disabled:cursor-not-allowed disabled:opacity-50"
              data-test-id="barcode-insert"
              :disabled="Boolean(validationError) || !livePlan"
              @click="insertBarcode"
            >
              Insert
            </button>
          </div>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
