<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  TabsContent,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'

import { useI18n } from '@open-pencil/vue'
import { DEFAULT_CANVAS_GRID_SETTINGS, DEFAULT_CANVAS_GUIDE_APPEARANCE } from '@open-pencil/core/canvas'

import IconCpu from '~icons/lucide/cpu'
import IconGrid2x2 from '~icons/lucide/grid-2x2'
import IconKeyboard from '~icons/lucide/keyboard'
import IconPalette from '~icons/lucide/palette'
import IconRuler from '~icons/lucide/ruler'
import IconSparkles from '~icons/lucide/sparkles'
import { providerDef, isConfigured } from '@/app/ai/chat/storage'
import { useEditorStore } from '@/app/editor/active-store'
import { saveCanvasGridSettings } from '@/app/shell/canvas-grid'
import { saveCanvasGuideAppearance } from '@/app/shell/canvas-guides'
import { canvasSurfaceInfo, hardwareAccelerationNeedsRestart } from '@/app/shell/hardware-acceleration'
import { buildShortcutReference, type ShortcutReferenceRow, type ShortcutSource } from '@/app/shell/keyboard/reference'
import {
  appPreferences,
  preferencesOpen,
  preferencesSection,
  resetAppPreferences,
  setHardwareAcceleration,
  setPreferencesSection,
  setUiScale
} from '@/app/shell/preferences'
import { APP_THEME_SETTINGS, useAppTheme, type AppTheme } from '@/app/shell/theme'
import { isTauri } from '@/app/tauri/env'
import AppCheckbox from '@/components/ui/AppCheckbox.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useDialogUI } from '@/components/ui/dialog'
import theme from '@/theme/preferences-dialog'

const store = useEditorStore()
const { theme: activeTheme, setTheme } = useAppTheme()
const { dialogs } = useI18n()
const cls = useDialogUI({ content: 'flex max-h-[80vh] w-[720px] max-w-[92vw] flex-col overflow-hidden' })
const slots = tv(theme)()
const styles = {
  header: slots.header(),
  headerTitle: slots.headerTitle(),
  headerDescription: slots.headerDescription(),
  closeButton: slots.closeButton(),
  body: slots.body(),
  sidebar: slots.sidebar(),
  tabTrigger: slots.tabTrigger(),
  tabIcon: slots.tabIcon(),
  panel: slots.panel(),
  section: slots.section(),
  sectionTitle: slots.sectionTitle(),
  row: slots.row(),
  rowLabel: slots.rowLabel(),
  unit: slots.unit(),
  hint: slots.hint(),
  warning: slots.warning(),
  capabilityValue: slots.capabilityValue(),
  capabilityWarning: slots.capabilityWarning(),
  capabilityOk: slots.capabilityOk(),
  footer: slots.footer(),
  resetButton: slots.resetButton(),
  doneButton: slots.doneButton(),
  numberInput: slots.numberInput(),
  numberInputNarrow: slots.numberInput({ class: 'w-20' }),
  colourInput: slots.colourInput()
}

const section = computed({
  get: () => preferencesSection.value,
  set: (value: string) => setPreferencesSection(value)
})

const tabs = computed(() => [
  { id: 'appearance' as const, icon: IconPalette, label: dialogs.value.preferencesAppearance },
  { id: 'canvas' as const, icon: IconGrid2x2, label: dialogs.value.preferencesCanvasDisplay },
  { id: 'guides' as const, icon: IconRuler, label: dialogs.value.preferencesGuides },
  { id: 'capabilities' as const, icon: IconCpu, label: dialogs.value.preferencesCapabilities },
  { id: 'ai' as const, icon: IconSparkles, label: dialogs.value.preferencesAI },
  { id: 'shortcuts' as const, icon: IconKeyboard, label: dialogs.value.preferencesShortcuts }
])

const THEME_LABELS: Record<AppTheme, () => string> = {
  light: () => dialogs.value.preferencesThemeLight,
  grey: () => dialogs.value.preferencesThemeGrey,
  dark: () => dialogs.value.preferencesThemeDark,
  midnight: () => dialogs.value.preferencesThemeMidnight,
  auto: () => dialogs.value.preferencesThemeAuto
}

const themeOptions = computed(() => [
  ...APP_THEME_SETTINGS.map((value) => ({ value, label: THEME_LABELS[value]() })),
  { value: 'auto' as const, label: THEME_LABELS.auto() }
])

const themeSetting = computed<AppTheme>({
  get: () => activeTheme.value,
  set: (value) => setTheme(value)
})

const uiScaleOptions = computed(() =>
  [80, 90, 100, 110, 120, 130, 150].map((scale) => ({ value: scale, label: `${scale}%` }))
)

const uiScale = computed({
  get: () => appPreferences.value.uiScale,
  set: (value: number) => setUiScale(value)
})

const gridModeOptions = computed(() => [
  { value: 'dots' as const, label: dialogs.value.preferencesGridStyleDots },
  { value: 'lines' as const, label: dialogs.value.preferencesGridStyleLines }
])

const gridVisible = computed({
  get: () => store.state.canvasGrid.visible,
  set: (value: boolean) => {
    store.state.canvasGrid.visible = value
    saveCanvasGridSettings(store.state.canvasGrid)
    store.requestRepaint()
  }
})

const gridMode = computed({
  get: () => store.state.canvasGrid.mode,
  set: (mode: 'dots' | 'lines') => {
    store.state.canvasGrid.mode = mode
    saveCanvasGridSettings(store.state.canvasGrid)
    store.requestRepaint()
  }
})

function updateGridSetting(key: 'spacing' | 'dotSize' | 'opacity' | 'color', value: number | string): void {
  if (key === 'color') store.state.canvasGrid.color = String(value)
  else store.state.canvasGrid[key] = Number(value)
  saveCanvasGridSettings(store.state.canvasGrid)
  store.requestRepaint()
}

function updateGuideSetting(kind: 'pageGuides' | 'margins' | 'bleed', key: 'color' | 'opacity', value: string): void {
  if (key === 'color') store.state.guideAppearance[kind].color = value.toUpperCase()
  else store.state.guideAppearance[kind].opacity = Number(value) / 100
  saveCanvasGuideAppearance(store.state.guideAppearance)
  store.requestRepaint()
}

function reset(): void {
  resetAppPreferences()
  setTheme('dark')
  store.state.canvasGrid = { ...DEFAULT_CANVAS_GRID_SETTINGS }
  saveCanvasGridSettings(store.state.canvasGrid)
  store.state.guideAppearance = structuredClone(DEFAULT_CANVAS_GUIDE_APPEARANCE)
  saveCanvasGuideAppearance(store.state.guideAppearance)
  store.requestRepaint()
}

const hardwareAcceleration = computed({
  get: () => appPreferences.value.hardwareAcceleration,
  set: (value: boolean) => setHardwareAcceleration(value)
})

/** Describes the backend the live surface actually reported, never the request. */
const accelerationStatus = computed(() => {
  const info = canvasSurfaceInfo.value
  if (!info) return { label: dialogs.value.preferencesHardwareAccelerationPending, ok: false }
  if (info.backend === 'gpu') return { label: dialogs.value.preferencesHardwareAccelerationGpu, ok: true }
  if (info.backend === 'cpu') return { label: dialogs.value.preferencesHardwareAccelerationCpu, ok: false }
  return { label: dialogs.value.preferencesHardwareAccelerationFailed, ok: false }
})

const accelerationDevice = computed(() => {
  const name = canvasSurfaceInfo.value?.renderer
  return name ? dialogs.value.preferencesHardwareAccelerationDevice({ name }) : null
})

const guideRows = computed(() => [
  { key: 'pageGuides' as const, label: dialogs.value.preferencesPageGuides },
  { key: 'margins' as const, label: dialogs.value.preferencesMargins },
  { key: 'bleed' as const, label: dialogs.value.preferencesBleed }
])

const shortcutQuery = ref('')

const shortcutRows = computed(() => buildShortcutReference(dialogs.value))

const filteredShortcutGroups = computed(() => {
  const query = shortcutQuery.value.trim().toLowerCase()
  const groups: { source: ShortcutSource; label: string; rows: ShortcutReferenceRow[] }[] = [
    { source: 'tools', label: dialogs.value.preferencesShortcutsTools, rows: [] },
    { source: 'commands', label: dialogs.value.preferencesShortcutsCommands, rows: [] },
    { source: 'other', label: dialogs.value.preferencesShortcutsOther, rows: [] }
  ]

  for (const row of shortcutRows.value) {
    if (query && !row.label.toLowerCase().includes(query)) continue
    const group = groups.find((g) => g.source === row.source)
    if (group) group.rows.push(row)
  }

  return groups.filter((group) => group.rows.length > 0)
})
</script>

<template>
  <DialogRoot v-model:open="preferencesOpen">
    <DialogPortal>
      <DialogOverlay :class="cls.overlay" />
      <DialogContent :aria-describedby="undefined" :class="cls.content">
        <div :class="styles.header">
          <div>
            <DialogTitle :class="styles.headerTitle">{{ dialogs.preferencesTitle }}</DialogTitle>
            <p :class="styles.headerDescription">{{ dialogs.preferencesDescription }}</p>
          </div>
          <DialogClose :aria-label="dialogs.close" :class="styles.closeButton">
            <icon-lucide-x class="size-4" />
          </DialogClose>
        </div>
        <TabsRoot v-model="section" orientation="vertical" :class="styles.body">
          <TabsList :aria-label="dialogs.preferencesSections" :class="styles.sidebar">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.id"
              :value="tab.id"
              :class="styles.tabTrigger"
              :data-test-id="`preferences-tab-${tab.id}`"
            >
              <component :is="tab.icon" :class="styles.tabIcon" />
              <span class="truncate">{{ tab.label }}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="appearance" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-appearance-title" :class="styles.section">
              <h3 id="preferences-appearance-title" :class="styles.sectionTitle">
                {{ dialogs.preferencesAppearance }}
              </h3>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesTheme }}</span>
                <AppSelect v-model="themeSetting" :options="themeOptions" :label="dialogs.preferencesTheme" />
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesUIScale }}</span>
                <AppSelect v-model="uiScale" :options="uiScaleOptions" :label="dialogs.preferencesUIScale" />
              </label>
              <p :class="styles.hint">{{ dialogs.preferencesFontNote }}</p>
            </section>
          </TabsContent>
          <TabsContent value="canvas" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-canvas-title" :class="styles.section">
              <h3 id="preferences-canvas-title" :class="styles.sectionTitle">
                {{ dialogs.preferencesCanvasDisplay }}
              </h3>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesBackgroundGrid }}</span>
                <AppCheckbox v-model="gridVisible" :label="dialogs.preferencesBackgroundGrid" />
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesGridStyle }}</span>
                <AppSelect v-model="gridMode" :options="gridModeOptions" :label="dialogs.preferencesGridStyle" />
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesGridSpacing }}</span>
                <input
                  :class="styles.numberInput"
                  :aria-label="dialogs.preferencesGridSpacing"
                  type="number"
                  min="4"
                  max="256"
                  step="1"
                  :value="store.state.canvasGrid.spacing"
                  @change="updateGridSetting('spacing', Number(($event.target as HTMLInputElement).value))"
                />
                <span :class="styles.unit">px</span>
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesDotSize }}</span>
                <input
                  :class="styles.numberInput"
                  :aria-label="dialogs.preferencesDotSize"
                  type="number"
                  min="1"
                  max="8"
                  step="0.5"
                  :value="store.state.canvasGrid.dotSize"
                  @change="updateGridSetting('dotSize', Number(($event.target as HTMLInputElement).value))"
                />
                <span :class="styles.unit">px</span>
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesGridOpacity }}</span>
                <input
                  :class="styles.numberInput"
                  :aria-label="dialogs.preferencesGridOpacity"
                  type="number"
                  min="5"
                  max="80"
                  step="5"
                  :value="Math.round(store.state.canvasGrid.opacity * 100)"
                  @change="updateGridSetting('opacity', Number(($event.target as HTMLInputElement).value) / 100)"
                />
                <span :class="styles.unit">%</span>
              </label>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesGridColour }}</span>
                <input
                  :class="styles.colourInput"
                  :aria-label="dialogs.preferencesGridColour"
                  type="color"
                  :value="store.state.canvasGrid.color"
                  @change="updateGridSetting('color', ($event.target as HTMLInputElement).value)"
                />
              </label>
              <p :class="styles.hint">{{ dialogs.preferencesCanvasColourNote }}</p>
            </section>
          </TabsContent>
          <TabsContent value="guides" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-guides-title" :class="styles.section">
              <h3 id="preferences-guides-title" :class="styles.sectionTitle">{{ dialogs.preferencesGuides }}</h3>
              <label v-for="guide in guideRows" :key="guide.key" :class="styles.row">
                <span :class="styles.rowLabel">{{ guide.label }}</span>
                <span class="flex items-center gap-2">
                  <input
                    :class="styles.colourInput"
                    :aria-label="dialogs.preferencesGuideColourLabel({ name: guide.label })"
                    type="color"
                    :value="store.state.guideAppearance[guide.key].color"
                    @change="updateGuideSetting(guide.key, 'color', ($event.target as HTMLInputElement).value)"
                  />
                  <input
                    :class="styles.numberInputNarrow"
                    :aria-label="dialogs.preferencesGuideOpacityLabel({ name: guide.label })"
                    type="number"
                    min="5"
                    max="100"
                    step="5"
                    :value="Math.round(store.state.guideAppearance[guide.key].opacity * 100)"
                    @change="updateGuideSetting(guide.key, 'opacity', ($event.target as HTMLInputElement).value)"
                  />
                  <span :class="styles.unit">%</span>
                </span>
              </label>
              <p :class="styles.hint">{{ dialogs.preferencesGuideColourNote }}</p>
            </section>
          </TabsContent>
          <TabsContent value="capabilities" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-capabilities-title" :class="styles.section">
              <h3 id="preferences-capabilities-title" :class="styles.sectionTitle">
                {{ dialogs.preferencesCapabilities }}
              </h3>
              <label :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesHardwareAcceleration }}</span>
                <AppCheckbox
                  v-model="hardwareAcceleration"
                  :label="dialogs.preferencesHardwareAcceleration"
                />
              </label>
              <div :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesStatus }}</span>
                <span :class="accelerationStatus.ok ? styles.capabilityOk : styles.capabilityWarning">{{
                  accelerationStatus.label
                }}</span>
              </div>
              <p v-if="accelerationDevice" :class="styles.hint">{{ accelerationDevice }}</p>
              <p v-if="hardwareAccelerationNeedsRestart" :class="styles.warning">
                {{ dialogs.preferencesHardwareAccelerationRestart }}
              </p>
              <div :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesSnapping }}</span>
                <span :class="styles.capabilityValue">{{ dialogs.preferencesSnappingOwner }}</span>
              </div>
              <div :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesColourProfile }}</span>
                <span :class="styles.capabilityValue">{{ dialogs.preferencesColourProfileOwner }}</span>
              </div>
            </section>
          </TabsContent>
          <TabsContent value="ai" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-ai-title" :class="styles.section">
              <h3 id="preferences-ai-title" :class="styles.sectionTitle">{{ dialogs.preferencesAI }}</h3>
              <div :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesProvider }}</span>
                <span :class="styles.capabilityValue">{{ providerDef.name }}</span>
              </div>
              <div :class="styles.row">
                <span :class="styles.rowLabel">{{ dialogs.preferencesAuthentication }}</span>
                <span :class="styles.capabilityValue">{{
                  isConfigured ? dialogs.preferencesConfigured : dialogs.preferencesNotConfigured
                }}</span>
              </div>
              <p :class="styles.hint">{{ dialogs.preferencesCredentialsNote }}</p>
              <p v-if="!isTauri" :class="styles.warning">{{ dialogs.preferencesDesktopOnlyAINote }}</p>
            </section>
          </TabsContent>
          <TabsContent value="shortcuts" :unmount-on-hide="false" :class="styles.panel">
            <section aria-labelledby="preferences-shortcuts-title" :class="styles.section">
              <h3 id="preferences-shortcuts-title" :class="styles.sectionTitle">
                {{ dialogs.preferencesShortcuts }}
              </h3>
              <AppInput
                v-model="shortcutQuery"
                type="search"
                data-test-id="preferences-shortcuts-search"
                size="sm"
                :placeholder="dialogs.preferencesShortcutsSearchPlaceholder"
              />
              <div class="mt-2 max-h-64 space-y-3 overflow-y-auto">
                <div v-for="group in filteredShortcutGroups" :key="group.source">
                  <p class="mb-1 text-[11px] font-medium text-muted">{{ group.label }}</p>
                  <div
                    v-for="row in group.rows"
                    :key="row.id"
                    :class="styles.row"
                    :data-test-id="`shortcut-row-${row.id}`"
                  >
                    <span :class="styles.rowLabel">{{ row.label }}</span>
                    <span class="flex items-center gap-1.5">
                      <span v-for="k in row.keys" :key="k" class="text-[11px] text-muted">{{ k }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>
        </TabsRoot>
        <div :class="styles.footer">
          <button type="button" :class="styles.resetButton" @click="reset">
            {{ dialogs.preferencesResetButton }}
          </button>
          <DialogClose :class="styles.doneButton">{{ dialogs.done }}</DialogClose>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
