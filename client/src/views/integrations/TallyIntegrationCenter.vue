<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-auto bg-gray-50 dark:bg-gray-900">
    <div class="border-b border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.tallyCenterTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyCenterDesc') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            @click="goSettings"
          >
            {{ t('settings.tallyBackSettings') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
            :disabled="syncBusy"
            @click="runSync('dry_run')"
          >
            {{ t('settings.addonsTallyDryRun') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            :disabled="syncBusy || refreshing"
            @click="runSync('incremental')"
          >
            {{ syncBusy ? t('states.loading') : t('settings.addonsTallySyncNow') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
            :disabled="refreshing"
            @click="refreshAll"
          >
            {{ refreshing ? t('states.loading') : t('actions.refresh') }}
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-6xl space-y-6 px-6 py-6">
      <div
        v-if="offlineBanner"
        class="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      >
        {{ offlineBanner }}
      </div>

      <div v-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
        <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
      </div>

      <!-- 4-step connect wizard -->
      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyWizardTitle') }}</h2>
        <ol class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <li
            v-for="step in wizardSteps"
            :key="step.key"
            class="rounded-lg border px-3 py-3"
            :class="step.done ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-700'"
          >
            <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ step.label }}</p>
            <p class="mt-1 text-sm text-gray-900 dark:text-white">{{ step.hint }}</p>
            <button
              v-if="step.action"
              type="button"
              class="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              @click="step.action"
            >
              {{ step.actionLabel }}
            </button>
          </li>
        </ol>

        <div v-if="companies.length" class="mt-5 border-t border-gray-100 pt-4 dark:border-gray-700">
          <p class="text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.tallyCompaniesTitle') }}</p>
          <ul class="mt-2 space-y-2">
            <li
              v-for="c in companies"
              :key="c.companyGuid"
              class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
            >
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{{ c.companyName }}</p>
                <p class="text-xs text-gray-500">{{ c.companyGuid }}{{ c.financialYear ? ` · FY ${c.financialYear}` : '' }}</p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-indigo-300 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-700 dark:text-indigo-300"
                :disabled="c.status === 'active' && c.enabled"
                @click="bindCompany(c)"
              >
                {{ c.status === 'active' && c.enabled ? t('settings.tallyCompanyActive') : t('settings.tallyCompanyBind') }}
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="card in healthCards"
          :key="card.key"
          class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ card.label }}</p>
          <p class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{{ card.value }}</p>
          <p v-if="card.hint" class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ card.hint }}</p>
        </div>
      </section>

      <section class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyQueue') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.queued }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyFailed') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.failed }}</p>
        </div>
        <div class="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.tallyConflicts') }}</p>
          <p class="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{{ counts.conflicts }}</p>
        </div>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyActivityTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyActivityDesc') }}</p>
        <ul v-if="activity.length" class="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
          <li v-for="row in activity" :key="row.id" class="flex flex-wrap items-start justify-between gap-2 py-3">
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ row.title }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ row.detail }}</p>
            </div>
            <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDateTime(row.at) }}</span>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyActivityEmpty') }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyMappingTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyMappingDesc') }}</p>
        <ul v-if="pendingExternal.length" class="mt-4 space-y-3">
          <li
            v-for="row in pendingExternal.slice(0, 15)"
            :key="row._id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20"
          >
            <div>
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ row.entityType }} · {{ row.metadata?.remotePayload?.name || row.externalId }}
              </p>
              <p class="mt-0.5 text-xs text-gray-600 dark:text-gray-400">{{ row.externalId }}</p>
            </div>
            <span class="text-xs text-amber-800 dark:text-amber-200">{{ t('settings.tallyMappingPending') }}</span>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyMappingEmpty') }}</p>
      </section>

      <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyValidationTitle') }}</h2>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.tallyValidationDesc') }}</p>
        <ul class="mt-4 space-y-2">
          <li
            v-for="item in validationChecklist"
            :key="item.key"
            class="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-700"
          >
            <span
              class="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
              :class="item.ok ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'"
            >
              {{ item.ok ? '✓' : '·' }}
            </span>
            <span class="text-sm text-gray-800 dark:text-gray-200">{{ item.label }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();

const refreshing = ref(false);
const syncBusy = ref(false);
const error = ref('');
const dashboard = ref(null);
const jobs = ref([]);
const conflicts = ref([]);
const companies = ref([]);
const pendingExternal = ref([]);
const events = ref([]);
let pollTimer = null;

const counts = computed(() => ({
  queued: dashboard.value?.queuedJobs ?? jobs.value.filter((j) => ['queued', 'running'].includes(j.status)).length,
  failed: jobs.value.filter((j) => j.status === 'failed').length,
  conflicts: dashboard.value?.openConflicts ?? conflicts.value.length,
}));

const offlineBanner = computed(() => {
  const d = dashboard.value;
  if (!d?.heartbeatAt) return t('settings.tallyOfflineNoAgent');
  const age = Date.now() - new Date(d.heartbeatAt).getTime();
  if (age > 2 * 60 * 1000) return t('settings.tallyOfflineStale');
  return '';
});

const wizardSteps = computed(() => {
  const d = dashboard.value || {};
  const paired = Boolean(d.connectionStatus && !['none', 'pending_pair', 'revoked'].includes(d.connectionStatus));
  const discovered = (d.companyCount || 0) > 0 || companies.value.length > 0;
  const connected = paired && discovered && Boolean(d.health?.ok || d.health?.checks?.tallyRunning);
  return [
    {
      key: 'install',
      label: t('settings.tallyWizardStep1'),
      hint: t('settings.tallyWizardStep1Hint'),
      done: true,
      action: goSettings,
      actionLabel: t('settings.tallyWizardDownload'),
    },
    {
      key: 'pair',
      label: t('settings.tallyWizardStep2'),
      hint: paired ? t('settings.tallyWizardStep2Done') : t('settings.tallyWizardStep2Hint'),
      done: paired,
      action: goSettings,
      actionLabel: t('settings.tallyWizardPair'),
    },
    {
      key: 'discover',
      label: t('settings.tallyWizardStep3'),
      hint: discovered ? t('settings.tallyWizardStep3Done') : t('settings.tallyWizardStep3Hint'),
      done: discovered,
      action: () => runSync('dry_run'),
      actionLabel: t('settings.addonsTallyDryRun'),
    },
    {
      key: 'connect',
      label: t('settings.tallyWizardStep4'),
      hint: connected ? t('settings.tallyWizardStep4Done') : t('settings.tallyWizardStep4Hint'),
      done: connected,
      action: () => runSync('incremental'),
      actionLabel: t('settings.addonsTallySyncNow'),
    },
  ];
});

const healthCards = computed(() => {
  const d = dashboard.value || {};
  return [
    {
      key: 'connection',
      label: t('settings.tallyHealthConnection'),
      value: d.connectionStatus || '—',
      hint: d.heartbeatAt ? formatDateTime(d.heartbeatAt) : t('settings.tallyHealthNoHeartbeat'),
    },
    {
      key: 'agent',
      label: t('settings.tallyHealthAgent'),
      value: d.agentVersion || '—',
      hint: d.agentHostname || d.health?.mode || null,
    },
    {
      key: 'companies',
      label: t('settings.tallyHealthCompanies'),
      value: d.companyCount ?? companies.value.length ?? 0,
      hint: null,
    },
    {
      key: 'health',
      label: t('settings.tallyHealthOk'),
      value: d.health?.ok ? t('settings.tallyHealthOkValue') : t('settings.tallyHealthDegradedValue'),
      hint: d.health?.tallyVersion || d.health?.message || null,
    },
  ];
});

const activity = computed(() => {
  if (events.value.length) {
    return events.value.slice(0, 20).map((ev) => ({
      id: String(ev._id),
      title: ev.code || ev.level || 'event',
      detail: ev.message,
      at: ev.createdAt,
    }));
  }
  if (!jobs.value.length) return [];
  return jobs.value.slice(0, 20).map((job) => ({
    id: String(job._id),
    title: `${job.jobType || 'sync'} · ${job.status}`,
    detail: job.lastError || job.companyGuid || t('settings.tallyActivityJobDetail'),
    at: job.updatedAt || job.createdAt,
  }));
});

const validationChecklist = computed(() => {
  const d = dashboard.value || {};
  const checks = d.health?.checks || {};
  return [
    { key: 'agent', label: t('settings.tallyCheckAgent'), ok: Boolean(d.connectionStatus && d.connectionStatus !== 'none') },
    { key: 'tally', label: t('settings.tallyCheckTally'), ok: Boolean(checks.tallyRunning ?? d.health?.ok) },
    { key: 'xml', label: t('settings.tallyCheckXml'), ok: Boolean(checks.xmlEnabled ?? false) },
    { key: 'company', label: t('settings.tallyCheckCompany'), ok: (d.companyCount || companies.value.length || 0) > 0 },
    { key: 'fy', label: t('settings.tallyCheckFy'), ok: Boolean(checks.financialYear ?? false) },
  ];
});

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function goSettings() {
  router.push({ path: '/settings', query: { tab: 'addons', addonView: 'tally' } });
}

async function runSync(jobType) {
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/sync/trigger', {
      jobType,
      direction: 'bidirectional',
      payload: { dryRun: jobType === 'dry_run' },
    });
    notifications.success(
      jobType === 'dry_run' ? t('settings.addonsTallyDryRunQueued') : t('settings.addonsTallySyncQueued')
    );
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  } finally {
    syncBusy.value = false;
  }
}

async function bindCompany(c) {
  try {
    await apiClient.post('/connectors/tally/companies/bind', {
      companyGuid: c.companyGuid,
      companyName: c.companyName,
      financialYear: c.financialYear || null,
      enabled: true,
    });
    notifications.success(t('settings.tallyCompanyBound'));
    await refreshAll();
  } catch (err) {
    notifications.error(err?.message || t('settings.tallyLoadFailed'));
  }
}

async function refreshAll() {
  refreshing.value = true;
  error.value = '';
  try {
    const [dashRes, jobsRes, conflictsRes, connRes, extRes, evRes] = await Promise.all([
      apiClient('/connectors/tally/dashboard', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/sync/jobs?limit=25', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/conflicts?status=open&limit=25', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/connection', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/external-objects?limit=50', { method: 'GET' }).catch(() => null),
      apiClient('/connectors/tally/events?limit=30', { method: 'GET' }).catch(() => null),
    ]);
    dashboard.value = dashRes?.data || {
      connectionStatus: 'none',
      queuedJobs: 0,
      openConflicts: 0,
      companyCount: 0,
      health: { ok: false },
    };
    jobs.value = Array.isArray(jobsRes?.data) ? jobsRes.data : [];
    conflicts.value = Array.isArray(conflictsRes?.data) ? conflictsRes.data : [];
    companies.value = Array.isArray(connRes?.data?.companies) ? connRes.data.companies : [];
    const ext = Array.isArray(extRes?.data) ? extRes.data : [];
    pendingExternal.value = ext.filter((r) => String(r.arivuId || '').startsWith('pending:'));
    events.value = Array.isArray(evRes?.data) ? evRes.data : [];
  } catch (err) {
    error.value = err?.message || t('settings.tallyLoadFailed');
  } finally {
    refreshing.value = false;
  }
}

onMounted(() => {
  refreshAll();
  pollTimer = setInterval(refreshAll, 15000);
});
onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>
