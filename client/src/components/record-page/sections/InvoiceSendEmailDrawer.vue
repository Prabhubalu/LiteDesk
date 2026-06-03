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
          <div class="flex-shrink-0 px-4 py-5 sm:px-6 bg-indigo-700 dark:bg-indigo-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-semibold text-white">{{ drawerTitle }}</h2>
              <button
                type="button"
                class="rounded-md text-white/80 hover:text-white"
                :aria-label="t('actions.cancel')"
                @click="close"
              >
                ×
              </button>
            </div>
            <p class="mt-1 text-sm text-white/90">{{ drawerSubtitle }}</p>
          </div>

          <form class="flex-1 flex flex-col min-h-0" @submit.prevent="submit">
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
              <div
                v-if="error"
                class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              >
                {{ error }}
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ t('records.invoiceSendEmailTo') }}
                </label>
                <input
                  v-model="to"
                  type="email"
                  required
                  class="block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  :disabled="sending"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {{ t('records.invoiceSendEmailSubject') }}
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
                  {{ t('records.invoiceSendEmailMessage') }}
                </label>
                <textarea
                  v-model="message"
                  rows="5"
                  class="block w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  :disabled="sending"
                />
              </div>

              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input v-model="attachPdf" type="checkbox" class="rounded" :disabled="sending" />
                {{ attachPdfLabel }}
              </label>
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
                class="px-4 py-2 text-sm rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                :disabled="sending"
              >
                {{ sending ? t('records.invoiceSendEmailSending') : submitLabel }}
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
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  record: { type: Object, default: null },
  resend: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'sent']);

const { t } = useI18n();

const isCreditNote = computed(() => String(props.record?.invoiceType || 'standard') === 'credit_note');

const drawerTitle = computed(() =>
  isCreditNote.value ? t('records.invoiceSendCreditNoteEmailTitle') : t('records.invoiceSendEmailTitle')
);

const drawerSubtitle = computed(() =>
  isCreditNote.value ? t('records.invoiceSendCreditNoteEmailSubtitle') : t('records.invoiceSendEmailSubtitle')
);

const submitLabel = computed(() =>
  props.resend
    ? t('records.invoiceResendEmailSubmit')
    : isCreditNote.value
      ? t('records.invoiceSendCreditNoteEmailSubmit')
      : t('records.invoiceSendEmailSubmit')
);

const attachPdfLabel = computed(() =>
  isCreditNote.value ? t('records.invoiceSendCreditNoteAttachPdf') : t('records.invoiceSendEmailAttachPdf')
);

const to = ref('');
const subject = ref('');
const message = ref('');
const attachPdf = ref(true);
const sending = ref(false);
const error = ref('');

function defaultSubject() {
  const number = props.record?.invoiceNumber || (isCreditNote.value ? 'Credit Note' : 'Invoice');
  const title = props.record?.invoiceTitle ? ` — ${props.record.invoiceTitle}` : '';
  if (isCreditNote.value) {
    return t('records.invoiceSendCreditNoteDefaultSubject', { number, title: title || '' });
  }
  return t('records.invoiceSendEmailDefaultSubject', { number, title: title || '' });
}

function defaultMessage() {
  return isCreditNote.value
    ? t('records.invoiceSendCreditNoteDefaultMessage')
    : t('records.invoiceSendEmailDefaultMessage');
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
  error.value = '';
}

async function submit() {
  if (!props.record?._id) return;
  sending.value = true;
  error.value = '';
  try {
    const res = await apiClient.post(`/invoices/${props.record._id}/send-email`, {
      to: to.value,
      subject: subject.value,
      message: message.value,
      attachPdf: attachPdf.value,
      resend: props.resend === true
    });
    if (res?.success) {
      emit('sent', res.data);
      emit('close');
      return;
    }
    error.value = res?.message || t('records.invoiceSendEmailFailed');
  } catch (e) {
    error.value = e?.message || t('records.invoiceSendEmailFailed');
  } finally {
    sending.value = false;
  }
}

function close() {
  if (sending.value) return;
  emit('close');
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) resetForm();
  }
);
</script>

<style scoped>
.email-compose-drawer-enter-active,
.email-compose-drawer-leave-active {
  transition: opacity 0.2s ease;
}
.email-compose-drawer-enter-from,
.email-compose-drawer-leave-to {
  opacity: 0;
}
</style>
