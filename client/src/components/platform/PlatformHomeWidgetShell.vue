<script setup lang="ts">
import { provide, toRef } from 'vue';
import type { PlatformHomeLayoutItem } from '@/types/platformHome.types';
import { PLATFORM_HOME_WIDGET_CHROME_KEY } from '@/components/platform/platformHomeWidgetChrome';

const props = defineProps<{
  item: PlatformHomeLayoutItem;
  showDragHandle?: boolean;
  widgetTitle?: string;
  widgetChartType?: string | null;
}>();

provide(PLATFORM_HOME_WIDGET_CHROME_KEY, {
  showDragHandle: toRef(props, 'showDragHandle'),
});
</script>

<template>
  <div class="flex min-h-0 min-w-0 flex-col overflow-hidden h-auto sm:h-full">
    <slot />
  </div>
</template>
