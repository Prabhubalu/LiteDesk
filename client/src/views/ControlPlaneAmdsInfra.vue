<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-8">
      <router-link
        to="/control"
        class="text-sm text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
      >
        ← {{ t('process.controlPlaneHeading') }}
      </router-link>
      <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
        {{ t('process.controlPlaneAmdsInfraTitle') }}
      </h1>
      <p class="mt-2 text-gray-600 dark:text-gray-400">
        {{ t('process.controlPlaneAmdsInfraDesc') }}
      </p>
    </div>

    <div
      v-if="loadError"
      class="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
    >
      {{ loadError }}
    </div>

    <div
      v-else-if="loading"
      class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
    >
      <div class="h-4 w-4 animate-spin rounded-full border-b-2 border-indigo-600" />
      {{ t('states.loading') }}
    </div>

    <template v-else-if="status">
      <div class="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          :disabled="loading"
          @click="loadStatus"
        >
          {{ t('actions.refresh') }}
        </button>
      </div>

      <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          v-for="item in summaryItems"
          :key="item.key"
          class="rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
        >
          <dt class="text-xs text-gray-500 dark:text-gray-400">{{ item.label }}</dt>
          <dd class="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{{ item.value }}</dd>
        </div>
      </dl>

      <pre
        class="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      >{{ formattedStatus }}</pre>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const loadError = ref('');
/** @type {import('vue').Ref<Record<string, unknown>|null>} */
const status = ref(null);

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

const summaryItems = computed(() => {
  if (!status.value) return [];
  const data = status.value;
  return [
    {
      key: 'infra_multiplier',
      label: t('process.controlPlaneAmdsInfraMultiplier'),
      value: formatValue(data.infra_multiplier)
    },
    {
      key: 'load_level',
      label: t('process.controlPlaneAmdsInfraLoadLevel'),
      value: formatValue(data.load_level)
    },
    {
      key: 'queue_depth',
      label: t('process.controlPlaneAmdsInfraQueueDepth'),
      value: formatValue(data.queue_depth)
    },
    {
      key: 'updated_at',
      label: t('process.controlPlaneAmdsInfraUpdatedAt'),
      value: formatValue(data.updated_at)
    }
  ];
});

const formattedStatus = computed(() => JSON.stringify(status.value, null, 2));

async function loadStatus() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await apiClient('/platform/amds/infra/status', { method: 'GET' });
    status.value = data?.data || null;
  } catch (err) {
    status.value = null;
    loadError.value = err?.message || t('process.controlPlaneAmdsInfraLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  document.title = t('process.controlPlaneAmdsInfraTitle');

  if (!authStore.isPlatformAdmin) {
    router.push({ name: 'dashboard' });
    return;
  }

  void loadStatus();
});
</script>
