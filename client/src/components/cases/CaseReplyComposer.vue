<template>
  <div class="shrink-0 border-t border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900 sm:px-4">
    <div class="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
      <label class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <span class="font-medium">{{ t('cases.recordComposerVia') }}</span>
        <select
          v-model="viaChannel"
          :disabled="disabled"
          class="rounded-lg border border-gray-200 bg-white px-2 py-1 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option v-for="ch in channels" :key="ch" :value="ch">{{ ch }}</option>
        </select>
      </label>
      <label class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
        <span class="font-medium">{{ t('cases.recordComposerFrom') }}</span>
        <span class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
          {{ fromLabel }}
        </span>
      </label>
      <label
        v-if="showInternalToggle"
        class="ml-auto inline-flex cursor-pointer items-center gap-2 text-gray-600 dark:text-gray-400"
      >
        <input
          v-model="internalNote"
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          :disabled="disabled"
        />
        {{ t('cases.recordInternalNote') }}
      </label>
    </div>

    <div class="rounded-xl border border-gray-200 bg-gray-50/80 dark:border-gray-600 dark:bg-gray-800/50">
      <textarea
        v-model="draft"
        rows="3"
        :disabled="disabled || sending"
        :placeholder="placeholder"
        class="w-full resize-none rounded-t-xl border-0 bg-transparent px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-gray-500"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
      />
      <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 dark:border-gray-600">
        <div class="flex items-center gap-1 text-gray-400">
          <button type="button" class="rounded p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700" disabled :title="t('cases.recordMacrosSoon')">
            <BoltIcon class="h-4 w-4" />
          </button>
          <span class="text-xs text-gray-400">{{ t('cases.recordMacrosSoon') }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            v-if="isClosed"
            type="button"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="$emit('reopen')"
          >
            {{ t('cases.recordReopen') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="disabled || sending || !draft.trim()"
            @click="submit"
          >
            <span v-if="sending" class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            {{ t('cases.recordSend') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BoltIcon } from '@heroicons/vue/24/outline';
import { CASE_CHANNELS } from '@/constants/caseLifecycle';
import { useAuthStore } from '@/stores/authRegistry';

const props = defineProps({
  caseRecord: { type: Object, default: null },
  sending: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false },
  showInternalToggle: { type: Boolean, default: true },
  placeholder: { type: String, default: '' }
});

const emit = defineEmits(['send', 'reopen']);

const { t } = useI18n();
const authStore = useAuthStore();

const draft = ref('');
const viaChannel = ref('');
const internalNote = ref(false);

const channels = CASE_CHANNELS;

watch(
  () => props.caseRecord?.channel,
  (ch) => {
    if (ch) viaChannel.value = ch;
    else if (!viaChannel.value) viaChannel.value = channels[0];
  },
  { immediate: true }
);

const fromLabel = computed(() => {
  const u = authStore.user;
  if (!u) return t('cases.recordSupport');
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || t('cases.recordSupport');
});

const placeholder = computed(
  () => props.placeholder || t('cases.recordComposerPlaceholder')
);

function submit() {
  const message = draft.value.trim();
  if (!message) return;
  emit('send', {
    message,
    channel: viaChannel.value,
    internal: internalNote.value
  });
  draft.value = '';
  internalNote.value = false;
}

defineExpose({ clear: () => { draft.value = ''; } });
</script>
