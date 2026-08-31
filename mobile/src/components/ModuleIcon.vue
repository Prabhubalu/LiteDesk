<script setup lang="ts">
import { computed } from 'vue'
import { getNavigationIconComponent } from '@/utils/navigationIcons'

const props = defineProps<{ moduleKey: string; size?: number }>()

const Icon = computed(() => getNavigationIconComponent({ moduleKey: props.moduleKey }))
</script>

<template>
  <span class="module-icon" :style="{ width: `${size || 22}px`, height: `${size || 22}px` }">
    <component :is="Icon" class="module-icon__svg" aria-hidden="true" />
  </span>
</template>

<style scoped>
.module-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-icon__svg {
  width: 100%;
  height: 100%;
}
</style>
