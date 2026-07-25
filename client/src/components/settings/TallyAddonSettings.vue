<template>
  <SettingsScrollPanel>
    <template #header>
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            class="mt-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            :title="t('settings.addonsBackToHub')"
            @click="emit('back')"
          >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.addonsTallySettingsTitle') }}</h2>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsTallySettingsDesc') }}</p>
          </div>
        </div>
      </div>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
    </div>

    <div v-else class="max-w-3xl space-y-6">
      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsTallyInstallTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsTallyInstallDesc') }}</p>
        <button
          type="button"
          class="mt-4 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="downloadBusy"
          @click="downloadInstaller"
        >
          {{ downloadBusy ? t('states.loading') : t('settings.addonsTallyDownloadExe') }}
        </button>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ installerAvailable ? t('settings.addonsTallyDownloadReady') : t('settings.addonsTallyDownloadUnavailable') }}
        </p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsTallyPairingTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsTallyPairingDesc') }}</p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <code class="rounded-lg bg-gray-100 px-3 py-2 font-mono text-lg tracking-wider text-gray-900 dark:bg-gray-900 dark:text-white">
            {{ pairingCode || t('settings.addonsTallyPairingNone') }}
          </code>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            :disabled="!pairingCode"
            @click="copyPairingCode"
          >
            {{ t('settings.addonsTallyCopyCode') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
            :disabled="pairingBusy"
            @click="startPairing"
          >
            {{ pairingBusy ? t('states.loading') : t('settings.addonsTallyGenerateCode') }}
          </button>
        </div>
        <p v-if="pairingExpiresAt" class="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.addonsTallyPairingExpires', { date: formatDateTime(pairingExpiresAt) }) }}
        </p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsTallyConnectionTitle') }}</h3>
        <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.addonsTallyStatus') }}</dt>
            <dd class="mt-1">
              <span :class="statusBadgeClass(connectionStatus)">{{ connectionStatusLabel }}</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.addonsTallyLastHeartbeat') }}</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDateTime(heartbeatAt) || t('settings.addonsTallyNever') }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.addonsTallyAgentHost') }}</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ agentHostname || '—' }}</dd>
          </div>
          <div>
            <dt class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('settings.addonsTallyAgentVersion') }}</dt>
            <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ agentVersion || '—' }}</dd>
          </div>
        </dl>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.addonsTallyCompanyTitle') }}</h3>
        <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.addonsTallyCompanyDesc') }}</p>
        <ul v-if="companies.length" class="mt-4 divide-y divide-gray-100 dark:divide-gray-700">
          <li v-for="company in companies" :key="company.companyGuid" class="py-3">
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ company.companyName }}</p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ t('settings.addonsTallyCompanyFy', {
                fy: company.financialYear || '—',
                guid: company.companyGuid,
              }) }}
            </p>
          </li>
        </ul>
        <p v-else class="mt-4 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.addonsTallyCompanyEmpty') }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="syncBusy"
          @click="triggerSync('dry_run')"
        >
          {{ t('settings.addonsTallyDryRun') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
          :disabled="syncBusy"
          @click="triggerSync('incremental')"
        >
          {{ syncBusy ? t('states.loading') : t('settings.addonsTallySyncNow') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="openIntegrationCenter"
        >
          {{ t('settings.addonsTallyOpenCenter') }}
        </button>
      </div>
    </div>
  </SettingsScrollPanel>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import SettingsScrollPanel from '@/components/settings/SettingsScrollPanel.vue';
import apiClient from '@/utils/apiClient';
import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';

const emit = defineEmits(['back']);

const { t } = useI18n();
const router = useRouter();
const notifications = useNotifications();
const authStore = useAuthStore();

const loading = ref(true);
const error = ref('');
const pairingBusy = ref(false);
const syncBusy = ref(false);
const downloadBusy = ref(false);
const installerAvailable = ref(false);
const pairingCode = ref('');
const pairingExpiresAt = ref(null);
const connection = ref(null);
const companies = ref([]);

const connectionStatus = computed(() => connection.value?.status || 'none');
const heartbeatAt = computed(() => connection.value?.heartbeatAt || null);
const agentHostname = computed(() => connection.value?.agentHostname || null);
const agentVersion = computed(() => connection.value?.agentVersion || null);

const connectionStatusLabel = computed(() => {
  const status = connectionStatus.value;
  const map = {
    none: t('settings.addonsTallyStatusNone'),
    pending_pair: t('settings.addonsTallyStatusPending'),
    paired: t('settings.addonsTallyStatusPaired'),
    online: t('settings.addonsTallyStatusOnline'),
    offline: t('settings.addonsTallyStatusOffline'),
  };
  return map[status] || status;
});

function statusBadgeClass(status) {
  const classes = {
    none: 'rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    pending_pair: 'rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    paired: 'rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    online: 'rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300',
    offline: 'rounded-lg bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return classes[status] || classes.none;
}

function formatDateTime(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

async function loadConnection() {
  loading.value = true;
  error.value = '';
  try {
    const res = await apiClient('/connectors/tally/connection', { method: 'GET' });
    connection.value = res?.data?.connection || null;
    companies.value = Array.isArray(res?.data?.companies) ? res.data.companies : [];
  } catch (err) {
    error.value = err?.message || t('settings.addonsTallyLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function startPairing() {
  pairingBusy.value = true;
  try {
    const res = await apiClient.post('/connectors/tally/pair/start', {});
    pairingCode.value = res?.data?.pairingCode || '';
    pairingExpiresAt.value = res?.data?.expiresAt || null;
    notifications.success(t('settings.addonsTallyPairingCreated'));
    await loadConnection();
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsTallyPairingFailed'));
  } finally {
    pairingBusy.value = false;
  }
}

async function copyPairingCode() {
  if (!pairingCode.value) return;
  try {
    await navigator.clipboard.writeText(pairingCode.value);
    notifications.success(t('settings.addonsTallyCodeCopied'));
  } catch {
    notifications.error(t('settings.addonsTallyCopyFailed'));
  }
}

async function triggerSync(jobType) {
  syncBusy.value = true;
  try {
    await apiClient.post('/connectors/tally/sync/trigger', {
      jobType,
      direction: 'bidirectional',
      payload: { dryRun: jobType === 'dry_run' },
    });
    notifications.success(
      jobType === 'dry_run'
        ? t('settings.addonsTallyDryRunQueued')
        : t('settings.addonsTallySyncQueued'),
    );
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsTallySyncFailed'));
  } finally {
    syncBusy.value = false;
  }
}

async function loadInstallerStatus() {
  try {
    const res = await apiClient('/connectors/tally/agent/download/status', { method: 'GET' });
    installerAvailable.value = Boolean(res?.data?.available);
  } catch {
    installerAvailable.value = false;
  }
}

async function downloadInstaller() {
  downloadBusy.value = true;
  try {
    const token = authStore.user?.token;
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(getApiUrlForFetch('/connectors/tally/agent/download'), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || t('settings.addonsTallyDownloadFailed'));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ArivuConnectorSetup.exe';
    link.click();
    URL.revokeObjectURL(url);
    notifications.success(t('settings.addonsTallyDownloadStarted'));
    installerAvailable.value = true;
  } catch (err) {
    notifications.error(err?.message || t('settings.addonsTallyDownloadFailed'));
    installerAvailable.value = false;
  } finally {
    downloadBusy.value = false;
  }
}

function openIntegrationCenter() {
  router.push({ name: 'tally-integration-center' });
}

onMounted(() => {
  void loadConnection();
  void loadInstallerStatus();
});
</script>
