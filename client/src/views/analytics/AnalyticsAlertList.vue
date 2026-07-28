<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goHome">
          ← {{ t('analytics.homeTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ t('analytics.alertsTitle') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.alertsDescription') }}</p>
      </div>
      <button
        v-if="canManage && !showForm"
        type="button"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
        @click="openCreateForm"
      >
        {{ t('analytics.alertsCreate') }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="mb-6 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700"
      @submit.prevent="submitForm"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {{ editingId ? t('analytics.alertsEdit') : t('analytics.alertsCreate') }}
      </h2>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.fieldName') }}</span>
        <input v-model="form.name" type="text" required class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.alertsWidget') }}</span>
        <select
          v-model="form.widgetId"
          required
          :disabled="Boolean(editingId)"
          class="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-60 dark:border-neutral-600 dark:bg-neutral-900"
        >
          <option value="">{{ t('analytics.alertsSelectWidget') }}</option>
          <option v-for="widget in publishedWidgets" :key="widget._id" :value="widget._id">
            {{ widget.name }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1 block font-medium">{{ t('analytics.alertsMetricField') }}</span>
        <input
          v-model="form.metricField"
          type="text"
          class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
          :placeholder="t('analytics.alertsMetricFieldHint')"
        />
      </label>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.alertsOperator') }}</span>
          <select v-model="form.operator" class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900">
            <option value="lt">{{ t('analytics.alertsOpLt') }}</option>
            <option value="lte">{{ t('analytics.alertsOpLte') }}</option>
            <option value="gt">{{ t('analytics.alertsOpGt') }}</option>
            <option value="gte">{{ t('analytics.alertsOpGte') }}</option>
            <option value="eq">{{ t('analytics.alertsOpEq') }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium">{{ t('analytics.alertsThreshold') }}</span>
          <input v-model.number="form.threshold" type="number" step="any" required class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900" />
        </label>
      </div>
      <div class="flex flex-wrap gap-4 text-sm">
        <label class="flex items-center gap-2">
          <input v-model="form.notifyInApp" type="checkbox" />
          {{ t('analytics.alertsNotifyInApp') }}
        </label>
        <label class="flex items-center gap-2">
          <input v-model="form.notifyEmail" type="checkbox" />
          {{ t('analytics.alertsNotifyEmail') }}
        </label>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" :disabled="saving">
          {{ editingId ? t('actions.save') : t('actions.create') }}
        </button>
        <button type="button" class="rounded-lg border px-4 py-2 text-sm dark:border-neutral-600" @click="cancelForm">
          {{ t('actions.cancel') }}
        </button>
      </div>
    </form>

    <div v-if="loading" class="py-12 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>
    <p v-else-if="!alerts.length" class="py-12 text-center text-sm text-neutral-500">{{ t('analytics.alertsEmpty') }}</p>
    <div v-else class="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-700">
      <table class="min-w-full text-sm">
        <thead class="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
          <tr>
            <th class="px-4 py-3">{{ t('analytics.fieldName') }}</th>
            <th class="px-4 py-3">{{ t('analytics.alertsWidget') }}</th>
            <th class="px-4 py-3">{{ t('analytics.alertsCondition') }}</th>
            <th class="px-4 py-3">{{ t('analytics.colStatus') }}</th>
            <th class="px-4 py-3">{{ t('analytics.alertsLastTriggered') }}</th>
            <th v-if="canManage" class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-200 dark:divide-neutral-700">
          <tr v-for="row in alerts" :key="row._id">
            <td class="px-4 py-3 font-medium">{{ row.name }}</td>
            <td class="px-4 py-3">{{ widgetLabel(row.widgetId) }}</td>
            <td class="px-4 py-3">{{ formatCondition(row) }}</td>
            <td class="px-4 py-3 capitalize">{{ row.status }}</td>
            <td class="px-4 py-3">{{ formatDate(row.lastTriggeredAt) }}</td>
            <td v-if="canManage" class="px-4 py-3">
              <div class="flex flex-wrap gap-2">
                <button type="button" class="text-primary-600 hover:underline" @click="openEditForm(row)">
                  {{ t('actions.edit') }}
                </button>
                <button
                  v-if="row.status === 'active'"
                  type="button"
                  class="text-neutral-600 hover:underline"
                  @click="pause(row._id)"
                >
                  {{ t('analytics.alertsPause') }}
                </button>
                <button
                  v-else
                  type="button"
                  class="text-neutral-600 hover:underline"
                  @click="resume(row._id)"
                >
                  {{ t('analytics.alertsResume') }}
                </button>
                <button type="button" class="text-red-600 hover:underline" @click="remove(row._id)">
                  {{ t('actions.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useAnalyticsAlerts } from '@/composables/useAnalyticsAlerts';
import { useAnalyticsWidgets } from '@/composables/useAnalyticsWidgets';
import {
  captureAnalyticsAlertCreated,
  captureAnalyticsAlertDeleted,
  captureAnalyticsAlertUpdated,
} from '@/config/posthogAnalytics';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const {
  alerts,
  loading,
  saving,
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlert,
  pauseAlert,
  resumeAlert,
} = useAnalyticsAlerts();

const { widgets, fetchWidgets } = useAnalyticsWidgets();

const showForm = ref(false);
const editingId = ref(null);
const form = reactive({
  name: '',
  widgetId: '',
  metricField: '',
  operator: 'lt',
  threshold: 80,
  notifyInApp: true,
  notifyEmail: false,
});

const canManage = computed(() => authStore.can('reports', 'edit'));
const publishedWidgets = computed(() => widgets.value.filter((w) => w.status === 'published'));

function widgetLabel(widgetId) {
  if (!widgetId) return '—';
  if (typeof widgetId === 'object') return widgetId.name || '—';
  const match = widgets.value.find((w) => w._id === widgetId);
  return match?.name || widgetId;
}

function formatCondition(row) {
  const op = row.operator || 'lt';
  const symbols = { lt: '<', lte: '≤', gt: '>', gte: '≥', eq: '=' };
  return `${symbols[op] || op} ${row.threshold}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function resetForm() {
  form.name = '';
  form.widgetId = String(route.query.widgetId || '');
  form.metricField = '';
  form.operator = 'lt';
  form.threshold = 80;
  form.notifyInApp = true;
  form.notifyEmail = false;
  editingId.value = null;
}

function openCreateForm() {
  resetForm();
  showForm.value = true;
}

function openEditForm(row) {
  editingId.value = row._id;
  form.name = row.name;
  form.widgetId = typeof row.widgetId === 'object' ? row.widgetId._id : row.widgetId;
  form.metricField = row.metricField || '';
  form.operator = row.operator;
  form.threshold = row.threshold;
  form.notifyInApp = row.notifyInApp !== false;
  form.notifyEmail = row.notifyEmail === true;
  showForm.value = true;
}

function cancelForm() {
  showForm.value = false;
  resetForm();
}

async function submitForm() {
  const payload = {
    name: form.name,
    widgetId: form.widgetId,
    metricField: form.metricField || null,
    operator: form.operator,
    threshold: form.threshold,
    notifyInApp: form.notifyInApp,
    notifyEmail: form.notifyEmail,
  };

  if (editingId.value) {
    const res = await updateAlert(editingId.value, payload);
    if (res?.success) {
      captureAnalyticsAlertUpdated({ alert_id: editingId.value });
      cancelForm();
      await fetchAlerts();
    }
    return;
  }

  const res = await createAlert(payload);
  if (res?.success) {
    captureAnalyticsAlertCreated({ alert_id: res.data?._id, widget_id: form.widgetId });
    cancelForm();
    await fetchAlerts();
  }
}

async function pause(id) {
  await pauseAlert(id);
  await fetchAlerts();
}

async function resume(id) {
  await resumeAlert(id);
  await fetchAlerts();
}

async function remove(id) {
  if (!await confirmAction(t('analytics.alertsDeleteConfirm'))) return;
  const res = await deleteAlert(id);
  if (res?.success) {
    captureAnalyticsAlertDeleted({ alert_id: id });
    await fetchAlerts();
  }
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

onMounted(async () => {
  await Promise.all([
    fetchWidgets({ status: 'published', limit: 200 }),
    fetchAlerts({ widgetId: route.query.widgetId }),
  ]);
  if (route.query.widgetId && canManage.value) {
    openCreateForm();
  }
});
</script>
