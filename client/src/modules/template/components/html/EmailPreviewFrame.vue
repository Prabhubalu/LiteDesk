<template>
  <div
    class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
    :class="viewportClass"
  >
    <div
      v-if="viewport === 'mobile'"
      class="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400"
    >
      <span>9:41</span>
      <span>{{ t('templates.htmlImport.mobilePreview') }}</span>
      <span>100%</span>
    </div>
    <div
      class="overflow-auto"
      :class="viewportHeightClass"
      :style="shellStyle"
    >
      <iframe
        :key="iframeKey"
        class="mx-auto block border-0 bg-transparent"
        :style="iframeStyle"
        sandbox=""
        :title="t('templates.htmlImport.previewFrameTitle')"
        :srcdoc="previewSrcdoc"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { buildEmailPreviewDocument } from '../../utils/sanitizeEmailPreviewHtml';

const props = defineProps({
  html: { type: String, default: '' },
  css: { type: String, default: '' },
  viewport: { type: String, default: 'desktop' },
  colorScheme: { type: String, default: 'light' }
});

const { t } = useI18n();

const previewWidthPx = computed(() => {
  if (props.viewport === 'mobile') return 320;
  if (props.viewport === 'tablet') return 768;
  return 600;
});

const viewportClass = computed(() => {
  if (props.viewport === 'mobile') return 'mx-auto max-w-[375px]';
  if (props.viewport === 'tablet') return 'mx-auto max-w-[820px]';
  return 'w-full';
});

const viewportHeightClass = computed(() => {
  if (props.viewport === 'mobile') return 'h-[520px]';
  if (props.viewport === 'tablet') return 'h-[500px]';
  return 'h-[480px]';
});

const previewSrcdoc = computed(() => buildEmailPreviewDocument({
  html: props.html,
  css: props.css,
  viewportWidth: previewWidthPx.value,
  colorScheme: props.colorScheme === 'dark' ? 'dark' : 'light'
}));

const iframeKey = computed(() => `${props.viewport}:${props.colorScheme}:${previewSrcdoc.value.length}`);

const iframeStyle = computed(() => ({
  width: `${previewWidthPx.value}px`,
  maxWidth: '100%',
  minHeight: props.viewport === 'mobile'
    ? '520px'
    : props.viewport === 'tablet'
      ? '500px'
      : '480px'
}));

const shellStyle = computed(() => ({
  background: props.colorScheme === 'dark' ? '#111827' : '#f3f4f6'
}));
</script>
