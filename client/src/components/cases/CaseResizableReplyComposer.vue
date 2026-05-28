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
      <CaseEmailReplyComposer
        v-if="caseId && useEmailComposer"
        :key="composerMountKey"
        ref="composerRef"
        :case-id="caseId"
        :case-record="caseRecord"
        :contact-email="contactEmail"
        :email-threads="emailThreads"
        :sending="sending"
        :disabled="disabled"
        :is-closed="isClosed"
        :show-internal-toggle="showInternalToggle"
        fill-height
        class="h-full min-h-0"
        @send-email="$emit('send-email', $event)"
        @send="$emit('send', $event)"
        @reopen="$emit('reopen', $event)"
      />
      <CaseReplyComposer
        v-else-if="caseId"
        :key="composerMountKey"
        ref="composerRef"
        :case-record="caseRecord"
        :sending="sending"
        :disabled="disabled"
        :is-closed="isClosed"
        :show-internal-toggle="showInternalToggle"
        :fixed-channel="fixedChannel"
        :hide-channel-select="hideChannelSelect"
        :placeholder="placeholder"
        :internal-comment-mode="paneKey === 'notes'"
        fill-height
        class="h-full min-h-0"
        @send="$emit('send', $event)"
        @reopen="$emit('reopen', $event)"
        @typing="$emit('typing', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import CaseReplyComposer from '@/components/cases/CaseReplyComposer.vue';
import CaseEmailReplyComposer from '@/components/cases/CaseEmailReplyComposer.vue';
import { useVerticalPaneResize } from '@/composables/useVerticalPaneResize';
import { isEmailChannelCase } from '@/utils/caseEmailReply';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  /** localStorage key suffix; full key is `case-reply-height-${paneKey}` */
  paneKey: { type: String, default: 'conversation' },
  defaultHeight: { type: Number, default: 180 },
  caseRecord: { type: Object, default: null },
  caseId: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  emailThreads: { type: Array, default: () => [] },
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  showInternalToggle: { type: Boolean, default: true },
  fixedChannel: { type: String, default: '' },
  hideChannelSelect: { type: Boolean, default: false },
  placeholder: { type: String, default: '' }
});

defineEmits(['send', 'send-email', 'reopen', 'typing']);

const { t } = useI18n();
const composerRef = ref(null);

const useEmailComposer = computed(
  () => props.paneKey === 'conversation' && isEmailChannelCase(props.caseRecord)
);

/** Force a clean mount when switching cases or composer type (avoids TipTap / v-if patch errors). */
const composerMountKey = computed(() => {
  const kind = useEmailComposer.value ? 'email' : 'plain';
  return `${props.caseId || 'none'}-${props.paneKey}-${kind}`;
});

const resizeDefaultHeight = computed(() =>
  useEmailComposer.value ? Math.max(props.defaultHeight, 340) : props.defaultHeight
);

const { height, isResizing, paneRef, startResize } = useVerticalPaneResize({
  storageKey: `case-reply-height-${props.paneKey}`,
  defaultHeight: resizeDefaultHeight.value,
  minHeight: useEmailComposer.value ? 200 : 120,
  maxHeightRatio: 0.65,
  absoluteMaxHeight: 520
});

function applyReplyTarget(message, options) {
  composerRef.value?.applyReplyTarget?.(message, options);
}

defineExpose({
  clear: () => composerRef.value?.clear?.(),
  applyReplyTarget
});
</script>
