<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.agentsTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.agentsDesc') }}</p>

      <div class="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <label class="text-xs text-gray-600 dark:text-gray-400">
          {{ t('telephony.agentsMyPresence') }}
          <select v-model="myStatus" class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option v-for="s in statuses" :key="s" :value="s">{{ presenceLabel(s) }}</option>
          </select>
        </label>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          @click="updatePresence"
        >
          {{ t('telephony.agentsSetPresence') }}
        </button>
        <p v-if="presenceError" class="w-full text-sm text-red-600">{{ presenceError }}</p>
      </div>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.agentsEmpty') }}</p>
      <ul v-else class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        <li v-for="row in rows" :key="row._id || row.userId" class="flex items-center justify-between px-4 py-3 text-sm">
          <span class="font-medium text-gray-900 dark:text-white">
            {{ row.displayName || row.name || row.email || row.userId }}
          </span>
          <span class="text-gray-500">{{ presenceLabel(row.status) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { getMyPresence, listAgents, listPresenceStatuses, setMyPresence } from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const presenceError = ref('');
const rows = ref([]);
const statuses = ref(['idle', 'busy', 'offline', 'on_break', 'acw', 'training', 'meeting']);
const myStatus = ref('idle');

function presenceLabel(status) {
  const map = {
    idle: 'telephony.presenceIdle',
    busy: 'telephony.presenceBusy',
    offline: 'telephony.presenceOffline',
    on_break: 'telephony.presenceOnBreak',
    acw: 'telephony.presenceAcw',
    training: 'telephony.presenceTraining',
    meeting: 'telephony.presenceMeeting',
  };
  return map[status] ? t(map[status]) : status || '—';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [agents, me, st] = await Promise.all([
      listAgents(),
      getMyPresence().catch(() => null),
      listPresenceStatuses().catch(() => null),
    ]);
    rows.value = Array.isArray(agents?.data) ? agents.data : [];
    if (Array.isArray(st?.data) && st.data.length) statuses.value = st.data;
    if (me?.data?.status) myStatus.value = me.data.status;
  } catch {
    error.value = t('telephony.agentsLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function updatePresence() {
  presenceError.value = '';
  try {
    await setMyPresence({ status: myStatus.value });
    await load();
  } catch {
    presenceError.value = t('telephony.agentsUpdateFailed');
  }
}

onMounted(load);
</script>
