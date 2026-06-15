<template>
  <button
    type="button"
    class="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors"
    :class="pillClass"
    @click="$emit('open', app)"
  >
    <span
      class="flex h-7 w-7 items-center justify-center rounded-full"
      :class="iconWrapClass"
    >
      <component :is="iconComponent" class="h-3.5 w-3.5" />
    </span>
    <span class="whitespace-nowrap text-inherit">{{ app.name }}</span>
    <span
      v-if="urgencyDotClass"
      class="h-1.5 w-1.5 rounded-full"
      :class="urgencyDotClass"
      aria-hidden="true"
    />
  </button>
</template>

<script setup>
import { computed } from 'vue';
import {
  getAppTopSignal,
  getPlatformHomeAppIcon,
  getPlatformHomeAppIconWrapClass,
  getPlatformHomeAppPillClass
} from '@/utils/platformHomeApps';

const props = defineProps({
  app: {
    type: Object,
    required: true
  }
});

defineEmits(['open']);

const iconComponent = computed(() => getPlatformHomeAppIcon(props.app.appKey));
const pillClass = computed(() => getPlatformHomeAppPillClass(props.app.appKey));
const iconWrapClass = computed(() => getPlatformHomeAppIconWrapClass(props.app.appKey));
const urgencyDotClass = computed(() => {
  const signal = getAppTopSignal(props.app);
  if (!signal) return null;
  if (signal.severity === 'danger') return 'bg-danger-500 dark:bg-danger-400';
  if (signal.severity === 'warning') return 'bg-warning-500 dark:bg-warning-400';
  return null;
});
</script>
