<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

import theme from '@/theme/app/checkbox'
import type { AppCheckboxTheme } from '@/theme/app/checkbox'
import type { ComponentUI } from '@/components/ui/types'

interface AppCheckboxProps {
  label?: string
  ui?: ComponentUI<AppCheckboxTheme>
}

defineOptions({ inheritAttrs: false })

const { label, ui } = defineProps<AppCheckboxProps>()
const modelValue = defineModel<boolean>({ required: true })
const styles = tv(theme)()
</script>

<template>
  <CheckboxRoot
    v-model="modelValue"
    v-bind="$attrs"
    :aria-label="label"
    :class="styles.root({ class: ui?.root })"
  >
    <CheckboxIndicator :class="styles.indicator({ class: ui?.indicator })">
      <icon-lucide-check class="size-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
