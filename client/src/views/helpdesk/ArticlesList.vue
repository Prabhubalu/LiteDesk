<template>
  <div class="mx-auto w-full px-6 py-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.articlesTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('contentStudio.articlesSubtitle') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="goCategories"
        >
          {{ t('contentStudio.manageCategories') }}
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="goCreate"
        >
          {{ t('contentStudio.createArticle') }}
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        v-model="searchQuery"
        type="search"
        class="min-w-[220px] rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        :placeholder="t('contentStudio.searchArticles')"
        @keyup.enter="loadItems"
      />
      <select v-model="statusFilter" class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" @change="loadItems">
        <option value="">{{ t('contentStudio.filterAllStatuses') }}</option>
        <option value="draft">{{ t('contentStudio.statusDraft') }}</option>
        <option value="published">{{ t('contentStudio.statusPublished') }}</option>
        <option value="archived">{{ t('contentStudio.statusArchived') }}</option>
      </select>
      <select v-model="visibilityFilter" class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" @change="loadItems">
        <option value="">{{ t('contentStudio.filterAllVisibility') }}</option>
        <option value="portal">{{ t('contentStudio.visibilityPortal') }}</option>
        <option value="public">{{ t('contentStudio.visibilityPublic') }}</option>
        <option value="internal">{{ t('contentStudio.visibilityInternal') }}</option>
        <option value="private">{{ t('contentStudio.visibilityPrivate') }}</option>
      </select>
      <button type="button" class="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700" @click="loadItems">
        {{ t('actions.search') }}
      </button>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div v-if="loading" class="p-8 text-sm text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
      <div v-else-if="items.length === 0" class="rounded-xl border border-dashed border-gray-300 p-12 text-center dark:border-gray-700">
        <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
          <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.emptyArticlesTitle') }}</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('contentStudio.emptyArticlesMessage') }}</p>
        <button
          type="button"
          class="mt-6 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="goCreate"
        >
          {{ t('contentStudio.createArticle') }}
        </button>
      </div>
      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnTitle') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnStatus') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.fieldVisibility') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnUpdated') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <tr
            v-for="item in items"
            :key="item._id"
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            @click="openItem(item._id)"
          >
            <td class="px-4 py-3">
              <p class="font-medium text-gray-900 dark:text-white">{{ item.title }}</p>
              <p v-if="item.summary" class="truncate text-sm text-gray-500 dark:text-gray-400">{{ item.summary }}</p>
            </td>
            <td class="px-4 py-3 text-sm capitalize text-gray-600 dark:text-gray-300">{{ item.status }}</td>
            <td class="px-4 py-3 text-sm capitalize text-gray-600 dark:text-gray-300">{{ item.visibility || '—' }}</td>
            <td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{{ formatDate(item.updatedAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { listContentDocuments } from '@/modules/contentStudio/services/contentStudioApi';
import { captureArticlesModuleVisited } from '@/config/posthogArticles';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const items = ref([]);
const searchQuery = ref('');
const statusFilter = ref('');
const visibilityFilter = ref('');

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function goCreate() {
  router.push({ name: 'helpdesk-article-new' });
}

function goCategories() {
  router.push({ name: 'helpdesk-article-categories' });
}

function openItem(id) {
  router.push({ name: 'helpdesk-article-edit', params: { id } });
}

async function loadItems() {
  loading.value = true;
  try {
    const response = await listContentDocuments('articles', {
      search: searchQuery.value.trim() || undefined,
      status: statusFilter.value || undefined,
      visibility: visibilityFilter.value || undefined,
    });
    items.value = response.items;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  captureArticlesModuleVisited();
  void loadItems();
});
</script>
