<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.queuesTitle') }}</h1>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.queuesDesc') }}</p>
        </div>
      </div>

      <form class="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900" @submit.prevent="onCreate">
        <label class="text-xs text-gray-600 dark:text-gray-400">
          {{ t('telephony.queuesName') }}
          <input v-model="name" required class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <label class="text-xs text-gray-600 dark:text-gray-400">
          {{ t('telephony.queuesStrategy') }}
          <select v-model="strategy" class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option v-for="s in strategies" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
        <button type="submit" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
          {{ t('telephony.queuesCreate') }}
        </button>
      </form>
      <p v-if="formError" class="mt-2 text-sm text-red-600">{{ formError }}</p>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.queuesEmpty') }}</p>
      <ul v-else class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        <li v-for="row in rows" :key="row._id" class="flex items-center justify-between px-4 py-3 text-sm">
          <span class="font-medium text-gray-900 dark:text-white">{{ row.name }}</span>
          <span class="text-gray-500">{{ row.strategy }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import { createQueue, listQueues, listQueueStrategies } from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const formError = ref('');
const rows = ref([]);
const strategies = ref(['round_robin', 'longest_idle', 'least_calls', 'skill_based', 'priority']);
const name = ref('');
const strategy = ref('round_robin');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [q, s] = await Promise.all([listQueues(), listQueueStrategies().catch(() => null)]);
    rows.value = Array.isArray(q?.data) ? q.data : [];
    if (Array.isArray(s?.data) && s.data.length) strategies.value = s.data;
  } catch {
    error.value = t('telephony.queuesLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function onCreate() {
  formError.value = '';
  try {
    await createQueue({ name: name.value, strategy: strategy.value });
    name.value = '';
    await load();
  } catch {
    formError.value = t('telephony.queuesCreateFailed');
  }
}

onMounted(load);
</script>
