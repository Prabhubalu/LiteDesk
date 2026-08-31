<template>
  <div class="flex flex-wrap items-center justify-end gap-1.5">
    <button
      v-for="action in workflowActions"
      :key="action.key"
      type="button"
      class="inline-flex items-center rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
      :class="action.className"
      :disabled="busy"
      @click="action.handler"
    >
      {{ action.label }}
    </button>

    <button
      v-if="showSendEmailButton"
      type="button"
      class="inline-flex items-center rounded-md px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
      :disabled="busy"
      @click="showSendEmail = true"
    >
      {{ sendEmailLabel }}
    </button>

    <Menu v-if="documentMenuItems.length" as="div" class="relative">
      <MenuButton
        class="inline-flex items-center gap-1 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-800 dark:text-gray-100 disabled:opacity-50"
        :disabled="busy"
      >
        {{ t('records.invoiceMoreActions') }}
      </MenuButton>
      <transition
        enter-active-class="transition ease-out duration-100"
        enter-from-class="transform opacity-0 scale-95"
        enter-to-class="transform opacity-100 scale-100"
        leave-active-class="transition ease-in duration-75"
        leave-from-class="transform opacity-100 scale-100"
        leave-to-class="transform opacity-0 scale-95"
      >
        <MenuItems
          class="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10"
        >
          <MenuItem v-for="item in documentMenuItems" :key="item.key" v-slot="{ active }">
            <button
              type="button"
              :class="[
                'block w-full text-left px-4 py-2 text-sm',
                active ? 'bg-gray-100 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-200'
              ]"
              :disabled="busy"
              @click="item.handler"
            >
              {{ item.label }}
            </button>
          </MenuItem>
        </MenuItems>
      </transition>
    </Menu>

    <InvoiceSendEmailDrawer
      :is-open="showSendEmail"
      :record="record"
      :resend="emailResendMode"
      @close="showSendEmail = false"
      @sent="onEmailSent"
    />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/auth';
import InvoiceSendEmailDrawer from '@/components/record-page/sections/InvoiceSendEmailDrawer.vue';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const { t } = useI18n();
const notifications = useNotifications();
const auth = useAuthStore();
const busy = ref(false);
const showSendEmail = ref(false);
const emailResendMode = ref(false);

const status = computed(() => String(props.record?.status || '').trim());
const isCreditNote = computed(() => String(props.record?.invoiceType || 'standard') === 'credit_note');
const isEmailable = computed(() => ['Posted', 'Partially Paid', 'Paid'].includes(status.value));

function can(perm) {
  if (auth.isOwner) return true;
  return auth.can('invoices', perm);
}

function refresh(payload = { type: 'soft-refresh' }) {
  props.context?.onSectionUpdated?.({ sectionKey: 'lines', payload });
}

async function runAction(path, successKey, body = {}) {
  if (!props.record?._id || busy.value) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/invoices/${props.record._id}${path}`, body);
    if (res?.success) {
      notifications.success(t(successKey));
      const invoice = res?.data || res?.invoice;
      refresh({ type: 'soft-refresh', invoice });
      return;
    }
    notifications.error(res?.message || t('records.invoiceActionFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoiceActionFailed'));
  } finally {
    busy.value = false;
  }
}

async function generatePdf() {
  if (!props.record?._id || !can('export')) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/invoices/${props.record._id}/documents/generate`, {});
    if (res?.success && res?.data?.filePath) {
      notifications.success(
        isCreditNote.value ? t('records.invoiceCreditNotePdfGenerated') : t('records.invoicePdfGenerated')
      );
      window.open(res.data.filePath, '_blank');
      refresh({ type: 'soft-refresh' });
      return;
    }
    notifications.error(res?.message || t('records.invoicePdfFailed'));
  } catch (e) {
    notifications.error(e?.message || t('records.invoicePdfFailed'));
  } finally {
    busy.value = false;
  }
}

function openSendEmail(resend = false) {
  emailResendMode.value = resend;
  showSendEmail.value = true;
}

function onEmailSent() {
  showSendEmail.value = false;
  notifications.success(
    isCreditNote.value ? t('records.invoiceCreditNoteEmailSuccess') : t('records.invoiceEmailSuccess')
  );
  refresh({ type: 'soft-refresh' });
}

const sendEmailLabel = computed(() => {
  if (emailResendMode.value) return t('records.invoiceResendEmail');
  return isCreditNote.value ? t('records.invoiceSendCreditNoteEmail') : t('records.invoiceSendEmail');
});

const showSendEmailButton = computed(() => isEmailable.value && can('export'));

const workflowActions = computed(() => {
  const actions = [];
  const s = status.value;

  if (s === 'Draft' && can('submit')) {
    actions.push({
      key: 'submit',
      label: t('records.invoiceSubmitApproval'),
      className: 'border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-100',
      handler: () => runAction('/submit', 'records.invoiceSubmitSuccess')
    });
  }
  if (s === 'Pending Approval' && can('approve')) {
    actions.push({
      key: 'approve',
      label: t('records.invoiceApprove'),
      className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      handler: () => runAction('/approve', 'records.invoiceApproveSuccess')
    });
    actions.push({
      key: 'reject',
      label: t('records.invoiceReject'),
      className: 'border border-red-300 text-red-700 dark:text-red-400',
      handler: () => {
        const reason = window.prompt(t('records.invoiceRejectReasonPrompt'));
        if (reason === null) return;
        runAction('/reject', 'records.invoiceRejectSuccess', { reason });
      }
    });
  }
  if ((s === 'Draft' || s === 'Approved') && can('post')) {
    actions.push({
      key: 'post',
      label: t('records.invoicePost'),
      className: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      handler: async () => {
        if (!(await confirmAction(t('records.invoicePostConfirm')))) return;
        runAction('/post', 'records.invoicePostSuccess');
      }
    });
  }
  if (s === 'Posted' && can('void') && !isCreditNote.value) {
    actions.push({
      key: 'void',
      label: t('records.invoiceVoid'),
      className: 'border border-red-300 text-red-700 dark:text-red-400',
      handler: () => {
        const reason = window.prompt(t('records.invoiceVoidReasonPrompt'));
        if (!reason?.trim()) return;
        runAction('/void', 'records.invoiceVoidSuccess', { reversalReason: reason.trim() });
      }
    });
  }
  if (s === 'Posted' && !isCreditNote.value && can('createCreditNote')) {
    actions.push({
      key: 'credit-note',
      label: t('records.invoiceCreateCreditNote'),
      className: 'border border-amber-300 text-amber-800 dark:text-amber-300',
      handler: () => {
        window.dispatchEvent(
          new CustomEvent('arivu:invoice-open-credit-note', {
            detail: { invoiceMongoId: props.record?._id }
          })
        );
      }
    });
  }

  return actions;
});

const documentMenuItems = computed(() => {
  const items = [];
  if (can('export')) {
    items.push({
      key: 'pdf',
      label: isCreditNote.value ? t('records.invoiceGenerateCreditNotePdf') : t('records.invoiceGeneratePdf'),
      handler: generatePdf
    });
  }
  if (isEmailable.value && can('export')) {
    items.push({
      key: 'resend',
      label: t('records.invoiceResendEmail'),
      handler: () => openSendEmail(true)
    });
  }
  return items;
});
</script>
