<template>
  <div
    ref="paneRef"
    class="case-resizable-reply flex shrink-0 flex-col overflow-hidden border-t border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
    :class="{ 'select-none': isResizing }"
    :style="{ height: `${height}px` }"
  >
    <div
      role="separator"
      aria-orientation="horizontal"
      :aria-label="t('cases.recordComposerResize')"
      :title="t('cases.recordComposerResize')"
      class="group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-b border-transparent hover:border-gray-200 dark:hover:border-gray-700"
      @pointerdown="startResize"
    >
      <span
        class="h-1 w-10 rounded-full bg-gray-300 transition-colors group-hover:bg-gray-400 dark:bg-gray-600 dark:group-hover:bg-gray-500"
        aria-hidden="true"
      />
    </div>
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CaseReplyComposer
        v-bind="$attrs"
        fill-height
        class="h-full min-h-0"
        @typing="$emit('typing', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import CaseReplyComposer from '@/components/cases/CaseReplyComposer.vue';
import { useVerticalPaneResize } from '@/composables/useVerticalPaneResize';

defineOptions({ inheritAttrs: false });

defineEmits(['typing']);

const props = defineProps({
  /** localStorage key suffix; full key is `case-reply-height-${paneKey}` */
  paneKey: { type: String, default: 'conversation' },
  defaultHeight: { type: Number, default: 180 }
});

const { t } = useI18n();

const { height, isResizing, paneRef, startResize } = useVerticalPaneResize({
  storageKey: `case-reply-height-${props.paneKey}`,
  defaultHeight: props.defaultHeight,
  minHeight: 120,
  maxHeightRatio: 0.65,
  absoluteMaxHeight: 520
});
</script>
