<template>
  <div class="mx-auto w-full px-6 py-8">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <button type="button" class="mb-2 text-sm text-primary-600 hover:underline" @click="goHome">
          ← {{ t('analytics.homeTitle') }}
        </button>
        <h1 class="text-2xl font-semibold text-neutral-900 dark:text-white">
          {{ t('analytics.foldersTitle') }}
        </h1>
        <p class="mt-1 text-sm text-neutral-500">{{ t('analytics.foldersDescription') }}</p>
      </div>
    </div>

    <form class="mb-6 flex flex-wrap gap-2" @submit.prevent="create">
      <input
        v-model="newFolderName"
        type="text"
        class="min-w-[14rem] flex-1 rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        :placeholder="t('analytics.foldersNamePlaceholder')"
      />
      <button
        type="submit"
        class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="saving || !newFolderName.trim()"
      >
        {{ t('analytics.foldersCreate') }}
      </button>
    </form>

    <div v-if="loading" class="py-16 text-center text-sm text-neutral-500">{{ t('states.loading') }}</div>

    <div
      v-else-if="folders.length === 0"
      class="rounded-xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-600"
    >
      <p class="text-sm text-neutral-500">{{ t('analytics.foldersEmpty') }}</p>
    </div>

    <ul v-else class="divide-y divide-neutral-200 rounded-xl border border-neutral-200 dark:divide-neutral-700 dark:border-neutral-700">
      <li
        v-for="folder in folders"
        :key="folder._id"
        class="flex items-center justify-between gap-3 px-4 py-3"
      >
        <div>
          <p class="font-medium text-neutral-900 dark:text-white">{{ folder.name }}</p>
          <p v-if="folder.description" class="text-sm text-neutral-500">{{ folder.description }}</p>
        </div>
        <button
          type="button"
          class="text-sm text-red-600 hover:underline"
          @click="remove(folder)"
        >
          {{ t('actions.delete') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAnalyticsHome } from '@/composables/useAnalyticsHome';
import { captureAnalyticsModuleVisited } from '@/config/posthogAnalytics';

import { confirmAction } from '@/composables/useConfirmAction';
const { t } = useI18n();
const router = useRouter();
const { folders, loading, saving, fetchFolders, createFolder, deleteFolder } = useAnalyticsHome();

const newFolderName = ref('');

function goHome() {
  router.push({ name: 'analytics-home' });
}

async function create() {
  const name = newFolderName.value.trim();
  if (!name) return;
  const res = await createFolder(name);
  if (res?.success) {
    newFolderName.value = '';
    await fetchFolders();
  }
}

async function remove(folder) {
  if (!await confirmAction(t('analytics.foldersDeleteConfirm', { name: folder.name }))) return;
  await deleteFolder(folder._id);
  await fetchFolders();
}

onMounted(() => {
  captureAnalyticsModuleVisited({ surface: 'analytics_folders' });
  fetchFolders();
});
</script>
