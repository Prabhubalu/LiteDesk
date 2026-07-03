<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6">
      <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goHome">
        ← {{ t('analytics.homeTitle') }}
      </button>
      <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
        {{ t('analytics.trashTitle') }}
      </h1>
      <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.trashDescription') }}</p>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <div
      v-else-if="trashItems.length === 0"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
    >
      <p class="text-sm text-neutral-500">{{ t('analytics.trashEmpty') }}</p>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
      <table class="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
        <thead class="bg-neutral-50 dark:bg-neutral-800">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
              {{ t('analytics.colName') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
              {{ t('analytics.colType') }}
            </th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase text-neutral-500">
              {{ t('analytics.colArchived') }}
            </th>
            <th class="px-4 py-3 text-right text-xs font-semibold uppercase text-neutral-500">
              {{ t('analytics.colActions') }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-neutral-200 bg-white dark:divide-neutral-700 dark:bg-neutral-900">
          <tr v-for="item in trashItems" :key="`${item.assetType}-${item._id}`">
            <td class="px-4 py-3 text-sm font-medium">{{ item.name }}</td>
            <td class="px-4 py-3 text-sm capitalize text-neutral-600">
              {{ t(`analytics.assetType_${item.assetType}`, item.assetType) }}
            </td>
            <td class="px-4 py-3 text-sm text-neutral-500">{{ formatDate(item.archivedAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-600"
                @click="restore(item)"
              >
                {{ t('analytics.trashRestore') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { captureAnalyticsTrashRestored, captureAnalyticsModuleVisited } from '@/config/posthogAnalytics';

const { t } = useI18n();
const router = useRouter();
const { trashItems, loading, fetchTrash, restoreTrashItem } = useAnalyticsHome();

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function goHome() {
  router.push({ name: 'analytics-home' });
}

async function restore(item) {
  const res = await restoreTrashItem(item.assetType, item._id);
  if (res?.success) {
    captureAnalyticsTrashRestored({ asset_type: item.assetType, asset_id: item._id });
    await fetchTrash();
  }
}

onMounted(() => {
  captureAnalyticsModuleVisited({ surface: 'analytics_trash' });
  fetchTrash();
});
</script>
