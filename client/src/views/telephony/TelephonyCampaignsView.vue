<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.campaignsTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.campaignsDesc') }}</p>
      <p v-if="actionError" class="mt-2 text-sm text-red-600">{{ actionError }}</p>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.campaignsEmpty') }}</p>
      <ul v-else class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        <li v-for="row in rows" :key="row._id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
            <p class="text-xs text-gray-500">{{ row.status }} · {{ row.mode }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-lg bg-emerald-600 px-2 py-1 text-xs text-white" @click="run('start', row._id)">
              {{ t('telephony.campaignsStart') }}
            </button>
            <button type="button" class="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" @click="run('pause', row._id)">
              {{ t('telephony.campaignsPause') }}
            </button>
            <button type="button" class="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600" @click="run('resume', row._id)">
              {{ t('telephony.campaignsResume') }}
            </button>
            <button type="button" class="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white" @click="run('dial', row._id)">
              {{ t('telephony.campaignsDialNext') }}
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import TelephonyNav from '@/components/telephony/TelephonyNav.vue';
import {
  dialNextCampaign,
  listCampaigns,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
} from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const actionError = ref('');
const rows = ref([]);

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listCampaigns();
    rows.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    error.value = t('telephony.campaignsLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function run(action, id) {
  actionError.value = '';
  try {
    if (action === 'start') await startCampaign(id);
    else if (action === 'pause') await pauseCampaign(id);
    else if (action === 'resume') await resumeCampaign(id);
    else if (action === 'dial') await dialNextCampaign(id);
    await load();
  } catch {
    actionError.value = t('telephony.campaignsActionFailed');
  }
}

onMounted(load);
</script>
