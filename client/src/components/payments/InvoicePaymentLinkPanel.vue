<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.paymentLinkSectionTitle') }}</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.paymentLinkSectionHint') }}</p>
      </div>
      <button
        v-if="canManage"
        type="button"
        class="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 text-sm disabled:opacity-50"
        :disabled="busy || !canCreate"
        @click="createLink"
      >
        {{ t('records.paymentLinkCreate') }}
      </button>
    </div>

    <div
      v-if="activeLink"
      class="rounded-md border border-gray-200 dark:border-gray-700 p-3 text-sm space-y-2"
    >
      <div class="flex justify-between gap-2">
        <span class="text-gray-500">{{ t('records.paymentLinkNumber') }}</span>
        <span class="font-medium">{{ activeLink.paymentLinkNumber }}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="text-gray-500">{{ t('records.status') }}</span>
        <span>{{ paymentLinkStatusLabel(activeLink.status) }}</span>
      </div>
      <div v-if="activeLink.publicUrl" class="space-y-1">
        <div class="text-xs text-gray-500">{{ t('records.paymentLinkPublicUrl') }}</div>
        <div class="flex gap-2">
          <input
            :value="activeLink.publicUrl"
            readonly
            class="flex-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 text-xs"
          />
          <button type="button" class="rounded border px-2 py-1 text-xs" @click="copyUrl">
            {{ t('records.paymentLinkCopy') }}
          </button>
        </div>
      </div>
      <button
        v-if="canManage && activeLink.status === 'active'"
        type="button"
        class="text-xs text-red-600 hover:underline"
        @click="revokeLink"
      >
        {{ t('records.paymentLinkRevoke') }}
      </button>
    </div>

    <div v-else class="text-sm text-gray-500">{{ t('records.paymentLinkEmpty') }}</div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import { extractIdFromFormValue } from '@/utils/orgContactFormPairing';
import { useNotifications } from '@/composables/useNotifications';

const props = defineProps({
  record: { type: Object, default: null }
});

const { t, te } = useI18n();
const auth = useAuthStore();

const PAYMENT_LINK_STATUS_KEYS = {
  active: 'records.paymentLinkLifecycleActive',
  expired: 'records.paymentLinkLifecycleExpired',
  consumed: 'records.paymentLinkLifecycleConsumed',
  revoked: 'records.paymentLinkLifecycleRevoked'
};

function paymentLinkStatusLabel(status) {
  const key = PAYMENT_LINK_STATUS_KEYS[String(status || '').toLowerCase()];
  if (key && te(key)) return t(key);
  return status ? String(status) : '—';
}
const notifications = useNotifications();
const busy = ref(false);
const activeLink = ref(null);

const canManage = computed(() => auth.isOwner || auth.can('payments', 'managePaymentLinks'));
const organizationRefId = computed(() => extractIdFromFormValue(props.record?.organizationRefId));
const canCreate = computed(() => {
  if (!props.record?._id) return false;
  if (String(props.record?.invoiceType || 'standard') !== 'standard') return false;
  if (!['Posted', 'Partially Paid'].includes(String(props.record?.status || ''))) return false;
  if (!organizationRefId.value) return false;
  return Number(props.record?.amountDue) > 0;
});

async function loadLinks() {
  if (!props.record?._id) return;
  try {
    const res = await apiClient.get('/payment-links', {
      params: { invoiceMongoId: props.record._id, status: 'active' }
    });
    const rows = res?.data || [];
    activeLink.value = Array.isArray(rows) ? rows[0] : rows?.rows?.[0] || null;
  } catch {
    activeLink.value = null;
  }
}

async function createLink() {
  if (!props.record?._id) return;
  busy.value = true;
  try {
    const res = await apiClient.post('/payment-links', {
      organizationRefId: organizationRefId.value,
      contactId: extractIdFromFormValue(props.record?.contactId),
      invoiceIds: [props.record.invoiceId]
    });
    if (!res?.success) throw new Error(res?.message || 'Failed');
    activeLink.value = res.data;
    notifications.success(t('records.paymentLinkCreateSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('records.paymentLinkCreateFailed'));
  } finally {
    busy.value = false;
  }
}

async function revokeLink() {
  if (!activeLink.value?.paymentLinkId) return;
  busy.value = true;
  try {
    const res = await apiClient.post(`/payment-links/${activeLink.value.paymentLinkId}/revoke`);
    if (!res?.success) throw new Error(res?.message || 'Failed');
    activeLink.value = res.data;
    notifications.success(t('records.paymentLinkRevokeSuccess'));
  } catch (err) {
    notifications.error(err?.message || t('records.paymentLinkRevokeFailed'));
  } finally {
    busy.value = false;
  }
}

function copyUrl() {
  if (!activeLink.value?.publicUrl) return;
  navigator.clipboard?.writeText(activeLink.value.publicUrl);
  notifications.success(t('records.paymentLinkCopySuccess'));
}

watch(() => props.record?._id, loadLinks, { immediate: true });
</script>
