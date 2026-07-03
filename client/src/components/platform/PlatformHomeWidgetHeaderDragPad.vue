<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { PLATFORM_HOME_WIDGET_CHROME_KEY } from '@/components/platform/platformHomeWidgetChrome';

const { t } = useI18n();
const chrome = inject(PLATFORM_HOME_WIDGET_CHROME_KEY, null);
const visible = computed(() => Boolean(chrome?.showDragHandle?.value));
</script>

<template>
  <div
    v-if="visible"
    class="platform-home-widget-drag-surface min-h-[2.5rem] min-w-6 flex-1 cursor-grab touch-none select-none self-stretch active:cursor-grabbing"
    :title="t('platform.platformHomeWidgetDragHint')"
    aria-hidden="true"
  />
</template>
