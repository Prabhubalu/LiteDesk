<template>
  <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
    <div>
      <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{{ t('records.gatewayEventsTitle') }}</h4>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('records.gatewayEventsHint') }}</p>
    </div>

    <div class="overflow-x-auto text-xs">
      <table class="min-w-full">
        <thead class="text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-2 py-1 text-left">{{ t('records.paymentDate') }}</th>
            <th class="px-2 py-1 text-left">{{ t('records.gatewayEventType') }}</th>
            <th class="px-2 py-1 text-left">{{ t('records.status') }}</th>
            <th class="px-2 py-1 text-right">{{ t('records.gatewayEventActions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in events"
            :key="row.paymentGatewayEventId"
            class="border-t border-gray-100 dark:border-gray-800"
          >
            <td class="px-2 py-1">{{ formatDate(row.receivedAt) }}</td>
            <td class="px-2 py-1 font-mono">{{ row.eventType }}</td>
            <td class="px-2 py-1">
              <span :class="statusClass(row.processingStatus)">{{ row.processingStatus }}</span>
              <span v-if="!row.signatureValid" class="ml-1 text-red-500">sig</span>
            </td>
            <td class="px-2 py-1 text-right">
              <button
                v-if="canReplay(row)"
                type="button"
                class="text-indigo-600 hover:underline disabled:opacity-50"
                :disabled="busyId === row.paymentGatewayEventId"
                @click="replay(row)"
              >
                {{ t('records.gatewayEventReplay') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!events.length" class="py-4 text-center text-gray-500">{{ t('records.gatewayEventsEmpty') }}</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { formatUserDateTime } from '@/utils/localeFormat';

const { t } = useI18n();
const auth = useAuthStore();
const notifications = useNotifications();
const events = ref([]);
const busyId = ref('');

function formatDate(v) {
  if (!v) return '—';
  return formatUserDateTime(v);
}

function statusClass(status) {
  if (status === 'processed') return 'text-green-600';
  if (status === 'failed') return 'text-red-600';
  if (status === 'ignored') return 'text-gray-400';
  return 'text-amber-600';
}

function canReplay(row) {
  if (!auth.isOwner && !auth.can('payments', 'managePaymentLinks')) return false;
  return row.signatureValid && ['failed', 'received', 'processing'].includes(row.processingStatus);
}

async function loadEvents() {
  try {
    const res = await apiClient.get('/payment-gateways/events', { params: { limit: 50 } });
    events.value = res?.data || [];
  } catch {
    events.value = [];
  }
}

async function replay(row) {
  busyId.value = row.paymentGatewayEventId;
  try {
    const res = await apiClient.post(`/payment-gateways/events/${row.paymentGatewayEventId}/replay`);
    if (!res?.success) throw new Error(res?.message || 'Replay failed');
    notifications.success(t('records.gatewayEventReplaySuccess'));
    await loadEvents();
  } catch (err) {
    notifications.error(err?.message || t('records.gatewayEventReplayFailed'));
  } finally {
    busyId.value = '';
  }
}

onMounted(loadEvents);
</script>
