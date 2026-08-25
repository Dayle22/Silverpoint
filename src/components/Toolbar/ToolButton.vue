<script setup lang="ts">
import type { Component } from 'vue'

interface ToolButtonProps {
  icon: Component
  active?: boolean
  mobile?: boolean
}

const { icon, active = false, mobile = false } = defineProps<ToolButtonProps>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="flex cursor-pointer items-center justify-center border-none transition-all duration-150"
    :class="[
      mobile ? 'size-8 rounded-[6px] select-none' : 'size-7 rounded',
      active
        ? 'bg-accent text-white shadow-sm shadow-accent/25 active:scale-95'
        : mobile
          ? 'bg-transparent text-muted hover:text-surface active:bg-hover active:scale-95'
          : 'bg-transparent text-muted hover:bg-hover hover:text-surface active:scale-95'
    ]"
    @click="emit('click')"
  >
    <component :is="icon" class="size-4 stroke-[1.75]" />
  </button>
</template>
