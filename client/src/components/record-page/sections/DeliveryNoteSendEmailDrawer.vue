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
          class="relative z-10 flex max-h-screen w-full max-w-[95vw] flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:w-[32rem]"
          role="dialog"
          aria-modal="true"
          :aria-label="t('records.dnSendEmailTitle')"
        >
          <div
            class="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-5 dark:border-gray-800 dark:bg-gray-900 sm:px-6"
          >
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                {{ t('records.dnSendEmailTitle') }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                :aria-label="t('actions.cancel')"
                @click="close"
              >
                <XMarkIcon class="size-6" />
              </button>
            </div>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {{ t('records.dnSendEmailSubtitle') }}
            </p>
          </div>

          <form class="flex min-h-0 flex-1 flex-col" @submit.prevent="submit">
            <div class="flex-1 space-y-4 overflow-y-auto p-6">
              <div
                v-if="error"
                class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
              >
                {{ error }}
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('records.dnSendEmailTo') }}
                </label>
                <input
                  v-model="to"
                  type="email"
                  required
                  class="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  :placeholder="t('records.dnSendEmailToPlaceholder')"
                  :disabled="sending"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('records.dnSendEmailSubject') }}
                </label>
                <input
                  v-model="subject"
                  type="text"
                  required
                  class="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  :disabled="sending"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-900 dark:text-white">
                  {{ t('records.dnSendEmailMessage') }}
                </label>
                <textarea
                  v-model="message"
                  rows="5"
                  class="block w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
                  :disabled="sending"
                />
              </div>

              <label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input v-model="attachPdf" type="checkbox" class="rounded" :disabled="sending" />
                {{ t('records.dnSendEmailAttachPdf') }}
              </label>
            </div>

            <div
              class="flex flex-shrink-0 justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700"
            >
              <button
                type="button"
                class="rounded-md border border-gray-200 px-4 py-2 text-sm dark:border-gray-600"
                :disabled="sending"
                @click="close"
              >
                {{ t('actions.cancel') }}
              </button>
              <button
                type="submit"
                class="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="sending"
              >
                {{ sending ? t('records.dnSendEmailSending') : t('records.dnSendEmailSubmit') }}
              </button>
            </div>
          </form>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  record: { type: Object, default: null }
});

const emit = defineEmits(['close', 'sent']);

const { t } = useI18n();

const to = ref('');
const subject = ref('');
const message = ref('');
const attachPdf = ref(true);
const sending = ref(false);
const error = ref('');

function resolveCustomerEmail() {
  if (props.record?.email) return String(props.record.email).trim();
  const contact = props.record?.contactPersonId;
  if (contact && typeof contact === 'object' && contact.email) {
    return String(contact.email).trim();
  }
  const customer = props.record?.customerId;
  if (customer && typeof customer === 'object' && customer.email) {
    return String(customer.email).trim();
  }
  return '';
}

function resetForm() {
  to.value = resolveCustomerEmail();
  const number = props.record?.deliveryNoteNumber || 'DR';
  const title = props.record?.subject ? ` — ${props.record.subject}` : '';
  subject.value = t('records.dnSendEmailDefaultSubject', { number, title: title || '' });
  message.value = t('records.dnSendEmailDefaultMessage');
  attachPdf.value = true;
  error.value = '';
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) resetForm();
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
    const res = await apiClient.post(`/inventory/delivery-notes/${props.record._id}/send-email`, {
      to: to.value.trim(),
      subject: subject.value.trim(),
      message: message.value.trim(),
      attachPdf: attachPdf.value
    });
    if (!res?.success) {
      throw new Error(res?.message || t('records.dnSendEmailFailed'));
    }
    emit('sent', res.data);
    emit('close');
  } catch (e) {
    error.value = e?.message || t('records.dnSendEmailFailed');
  } finally {
    sending.value = false;
  }
}
</script>
