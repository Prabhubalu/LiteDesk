<template>
  <section
    :class="[
      docked
        ? 'shrink-0 border-t border-neutral-200 bg-white px-4 py-3 shadow-[0_-10px_30px_-12px_rgba(15,23,42,0.18)] dark:border-neutral-700 dark:bg-neutral-900 sm:px-5'
        : ['overflow-hidden', PLATFORM_HOME_CARD_CLASS]
    ]"
  >
    <div v-if="!docked" :class="['px-4 py-3 sm:px-5', PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS]">
      <label class="text-sm font-medium text-neutral-900 dark:text-white">
        {{ t('cases.portalCasesReplyLabel') }}
      </label>
    </div>

    <div :class="docked ? 'space-y-2' : 'space-y-3 p-4 sm:p-5'">
      <div class="flex items-end gap-2 sm:gap-3">
        <textarea
          ref="textareaRef"
          :value="modelValue"
          :rows="docked ? 2 : 3"
          class="min-h-[2.75rem] flex-1 resize-none rounded-2xl px-3.5 py-2.5 text-sm text-neutral-900 transition-shadow focus:outline-none focus:ring-2 focus:ring-[var(--portal-brand-primary,#3a1f8a)]/30 dark:text-white"
          :class="[
            PLATFORM_HOME_INSET_CONTROL_CLASS,
            docked ? 'sm:min-h-[3rem]' : 'min-h-[5.5rem]'
          ]"
          :placeholder="t('cases.portalCasesReplyPlaceholder')"
          :disabled="disabled"
          @input="$emit('update:modelValue', $event.target.value)"
          @keydown.enter.exact.prevent="handleEnter"
          @keydown.meta.enter.prevent="$emit('send')"
          @keydown.ctrl.enter.prevent="$emit('send')"
        />
        <button
          v-if="docked"
          type="button"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white transition-all disabled:opacity-40"
          :class="sendButtonClass"
          :disabled="disabled || !canSend"
          :aria-label="sending ? t('cases.portalCasesReplySending') : t('cases.portalCasesReplySend')"
          @click="$emit('send')"
        >
          <ArrowUpIcon class="h-5 w-5" />
        </button>
      </div>

      <div
        v-if="allowAttachments && !docked"
        class="rounded-xl border border-dashed px-4 py-5 text-center transition-colors"
        :class="[
          PLATFORM_HOME_INSET_CONTROL_CLASS,
          dragActive ? 'border-primary-400 bg-primary-50/50 dark:border-primary-500/50 dark:bg-primary-900/10' : ''
        ]"
        @dragover.prevent="dragActive = true"
        @dragleave.prevent="dragActive = false"
        @drop.prevent="handleDrop"
      >
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          :disabled="disabled"
          @change="handleFileSelect"
        />
        <p class="text-sm text-neutral-600 dark:text-neutral-300">
          {{ t('cases.portalCasesDropFiles') }}
        </p>
        <button
          type="button"
          class="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          :disabled="disabled"
          @click="fileInputRef?.click()"
        >
          {{ t('cases.portalCasesChooseFiles') }}
        </button>
      </div>

      <div
        v-if="allowAttachments && docked"
        class="flex flex-wrap items-center gap-2"
      >
        <input
          ref="fileInputRef"
          type="file"
          multiple
          class="hidden"
          :disabled="disabled"
          @change="handleFileSelect"
        />
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          :disabled="disabled"
          @click="fileInputRef?.click()"
        >
          <PaperClipIcon class="h-3.5 w-3.5" />
          {{ t('cases.portalCasesChooseFiles') }}
        </button>
      </div>

      <div v-if="allowAttachments && attachments.length" class="flex flex-wrap gap-2">
        <span
          v-for="att in attachments"
          :key="att.attachmentId"
          class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-700 dark:border-neutral-600 dark:text-neutral-200"
          :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
        >
          <span class="max-w-[220px] truncate" :title="att.originalFileName">{{ att.originalFileName }}</span>
          <button
            type="button"
            class="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            :disabled="disabled"
            @click="$emit('remove-attachment', att.attachmentId)"
          >
            ✕
          </button>
        </span>
      </div>

      <p v-if="uploadError" class="text-sm text-danger-600 dark:text-danger-400">{{ uploadError }}</p>
      <p v-if="sendError" class="text-sm text-danger-600 dark:text-danger-400">{{ sendError }}</p>

      <div v-if="!docked" class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('cases.portalCasesReplyHint') }}
        </p>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          :disabled="disabled || !canSend"
          @click="$emit('send')"
        >
          {{ sending ? t('cases.portalCasesReplySending') : t('cases.portalCasesReplySend') }}
        </button>
      </div>
      <p v-else class="text-[11px] text-neutral-400 dark:text-neutral-500">
        {{ t('cases.portalCasesReplyHintShort') }}
      </p>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUpIcon, PaperClipIcon } from '@heroicons/vue/24/solid';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_CARD_HEADER_DIVIDER_CLASS, PLATFORM_HOME_INSET_CONTROL_CLASS } from '@/utils/platformHomeLayout';

const props = defineProps({
  modelValue: { type: String, default: '' },
  attachments: { type: Array, default: () => [] },
  allowAttachments: { type: Boolean, default: true },
  docked: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  sending: { type: Boolean, default: false },
  uploadError: { type: String, default: '' },
  sendError: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'send', 'files-selected', 'remove-attachment']);

const { t } = useI18n();
const fileInputRef = ref(null);
const textareaRef = ref(null);
const dragActive = ref(false);

const canSend = computed(() => {
  const hasAttachments = props.allowAttachments && props.attachments.length > 0;
  return Boolean(props.modelValue.trim()) || hasAttachments;
});

const sendButtonClass = computed(() => (
  props.docked
    ? 'bg-[var(--portal-brand-primary,#3a1f8a)] hover:opacity-90'
    : ''
));

function handleEnter(event) {
  if (event.shiftKey) return;
  if (!canSend.value || props.disabled) return;
  emit('send');
}

function handleFileSelect(e) {
  const files = Array.from(e.target?.files || []);
  if (files.length) emit('files-selected', files);
  try { e.target.value = ''; } catch (_) {}
}

function handleDrop(e) {
  dragActive.value = false;
  const files = Array.from(e.dataTransfer?.files || []);
  if (files.length) emit('files-selected', files);
}
</script>
