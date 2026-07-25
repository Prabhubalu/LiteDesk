<template>
  <Teleport to="body">
    <Transition name="email-compose-drawer">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[10000] flex justify-end overflow-x-hidden"
        @keydown.esc.prevent="close"
      >
        <div class="absolute inset-0 z-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" @click="close" />
        <aside
          class="relative z-10 w-full sm:w-[32rem] max-w-[95vw] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl flex flex-col max-h-screen"
          role="dialog"
          aria-modal="true"
          :aria-label="drawerTitle"
        >
          <div
            class="flex-shrink-0 px-4 py-5 sm:px-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">{{ drawerTitle }}</h2>
              <button
                type="button"
                class="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                :aria-label="t('actions.cancel')"
                @click="close"
              >
                <XMarkIcon class="size-6" />
              </button>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ drawerSubtitle }}</p>
          </div>

          <form class="flex-1 flex flex-col min-h-0" @submit.prevent="submit">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <p
                v-if="isDraftSend"
                class="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
              >
                {{ t('records.quoteSendDraftEmailNotice') }}
              </p>

              <div
                v-if="error"
                class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              >
                {{ error }}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ t('records.quoteSendEmailTo') }}
                </label>
                <input
                  v-model="to"
                  type="email"
                  required
                  class="block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  :placeholder="t('records.quoteSendEmailToPlaceholder')"
                  :disabled="sending"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ t('records.quoteSendEmailSubject') }}
                </label>
                <input
                  v-model="subject"
                  type="text"
                  required
                  class="block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  :disabled="sending"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ t('records.quoteSendEmailMessage') }}
                </label>
                <textarea
                  v-model="message"
                  rows="5"
                  class="block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  :disabled="sending"
                />
              </div>

              <div class="space-y-2">
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input v-model="attachPdf" type="checkbox" class="rounded" :disabled="sending" />
                  {{ t('records.quoteSendEmailAttachPdf') }}
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <input v-model="includeLink" type="checkbox" class="rounded" :disabled="sending" />
                  {{ isDraftSend ? t('records.quoteSendDraftEmailIncludeLink') : t('records.quoteSendEmailIncludeLink') }}
                </label>
              </div>
            </div>

            <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
              <button
                type="button"
                class="px-4 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-600"
                :disabled="sending"
                @click="close"
              >
                {{ t('actions.cancel') }}
              </button>
              <button
                type="submit"
                class="px-4 py-2 text-sm rounded-md text-white disabled:opacity-50"
                :class="isDraftSend ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'"
                :disabled="sending"
              >
                {{ sending ? t('records.quoteSendEmailSending') : submitLabel }}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  record: { type: Object, default: null },
  sendMode: { type: String, default: 'formal' }
});

const emit = defineEmits(['close', 'sent']);

const { t } = useI18n();

const isDraftSend = computed(() => props.sendMode === 'draft');

const drawerTitle = computed(() =>
  isDraftSend.value ? t('records.quoteSendDraftEmailTitle') : t('records.quoteSendEmailTitle')
);

const drawerSubtitle = computed(() =>
  isDraftSend.value ? t('records.quoteSendDraftEmailSubtitle') : t('records.quoteSendEmailSubtitle')
);

const submitLabel = computed(() =>
  isDraftSend.value ? t('records.quoteSendDraftEmailSubmit') : t('records.quoteSendEmailSubmit')
);

const to = ref('');
const subject = ref('');
const message = ref('');
const attachPdf = ref(true);
const includeLink = ref(true);
const sending = ref(false);
const error = ref('');

function defaultSubject() {
  const number = props.record?.quoteNumber || 'Quote';
  const title = props.record?.quoteTitle ? ` — ${props.record.quoteTitle}` : '';
  if (isDraftSend.value) {
    return t('records.quoteSendDraftEmailDefaultSubject', { number, title: title || '' });
  }
  return t('records.quoteSendEmailDefaultSubject', { number, title: title || '' });
}

function defaultMessage() {
  return isDraftSend.value
    ? t('records.quoteSendDraftEmailDefaultMessage')
    : t('records.quoteSendEmailDefaultMessage');
}

function resolveContactEmail() {
  const c = props.record?.contactId;
  if (c && typeof c === 'object' && c.email) return String(c.email).trim();
  return '';
}

function resetForm() {
  to.value = resolveContactEmail();
  subject.value = defaultSubject();
  message.value = defaultMessage();
  attachPdf.value = true;
  includeLink.value = true;
  error.value = '';
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) resetForm();
  }
);

watch(
  () => props.sendMode,
  () => {
    if (props.isOpen) resetForm();
  }
);

function close() {
  if (sending.value) return;
  emit('close');
}

async function submit() {
  if (!props.record?._id) return;
  sending.value = true;
  error.value = '';
  try {
    const res = await apiClient.post(`/quotes/${props.record._id}/send-email`, {
      to: to.value.trim(),
      subject: subject.value.trim(),
      message: message.value.trim(),
      attachPdf: attachPdf.value,
      includeLink: includeLink.value
    });
    if (!res?.success) {
      throw new Error(res?.message || t('records.quoteSendEmailFailed'));
    }
    emit('sent', res.data);
    emit('close');
  } catch (e) {
    error.value = e?.message || t('records.quoteSendEmailFailed');
  } finally {
    sending.value = false;
  }
}
</script>
