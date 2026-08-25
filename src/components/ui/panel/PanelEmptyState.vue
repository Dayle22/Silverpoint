<script setup lang="ts">
const { message } = defineProps<{ message: string }>()
</script>

<template>
  <div
    data-test-id="panel-empty-state"
    class="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-center text-xs text-muted"
  >
    {{ message }}
  </div>
</template>
