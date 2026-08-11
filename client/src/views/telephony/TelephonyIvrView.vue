<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-neutral-950">
    <TelephonyNav />
    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
      <h1 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('telephony.ivrTitle') }}</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('telephony.ivrDesc') }}</p>

      <form class="mt-4 flex flex-wrap items-end gap-2" @submit.prevent="onCreate">
        <label class="text-xs text-gray-600 dark:text-gray-400">
          {{ t('telephony.ivrName') }}
          <input v-model="name" required class="mt-1 block rounded-lg border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </label>
        <button type="submit" class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
          {{ t('telephony.ivrCreate') }}
        </button>
      </form>
      <p v-if="formError" class="mt-2 text-sm text-red-600">{{ formError }}</p>
      <p v-if="message" class="mt-2 text-sm text-emerald-600">{{ message }}</p>

      <p v-if="loading" class="mt-4 text-sm text-gray-500">{{ t('states.loading') }}</p>
      <p v-else-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
      <p v-else-if="!rows.length" class="mt-4 text-sm text-gray-500">{{ t('telephony.ivrEmpty') }}</p>
      <ul v-else class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        <li v-for="row in rows" :key="row._id" class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ row.name }}</p>
            <p class="text-xs text-gray-500">{{ row.status }}</p>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2 py-1 text-xs dark:border-gray-600"
              @click="$router.push(`/telephony/ivr/${row._id}`)"
            >
              {{ t('telephony.ivrEdit') }}
            </button>
            <button
              type="button"
              class="rounded-lg bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700"
              @click="onPublish(row._id)"
            >
              {{ t('telephony.ivrPublish') }}
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
import { createIvrFlow, listIvrFlows, publishIvrFlow } from '@/utils/telephonyApi';

const { t } = useI18n();
const loading = ref(true);
const error = ref('');
const formError = ref('');
const message = ref('');
const rows = ref([]);
const name = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listIvrFlows();
    rows.value = Array.isArray(res?.data) ? res.data : [];
  } catch {
    error.value = t('telephony.ivrLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function onCreate() {
  formError.value = '';
  try {
    await createIvrFlow({
      name: name.value,
      nodes: [{ id: 'start', type: 'greeting', label: 'Greeting' }],
      edges: [],
    });
    name.value = '';
    await load();
  } catch {
    formError.value = t('telephony.ivrCreateFailed');
  }
}

async function onPublish(flowId) {
  message.value = '';
  try {
    await publishIvrFlow(flowId);
    message.value = t('telephony.ivrPublished');
    await load();
  } catch {
    formError.value = t('telephony.ivrPublishFailed');
  }
}

onMounted(load);
</script>
