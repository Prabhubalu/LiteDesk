<template>
  <div class="mx-auto w-full px-6 py-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.blogTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('contentStudio.blogSubtitle') }}</p>
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
          {{ t('contentStudio.createPost') }}
        </button>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <input
        v-model="searchQuery"
        type="search"
        class="min-w-[220px] rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        :placeholder="t('contentStudio.searchBlog')"
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
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        </div>
        <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.emptyBlogTitle') }}</h3>
        <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ t('contentStudio.emptyBlogMessage') }}</p>
        <button
          type="button"
          class="mt-6 inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          @click="goCreate"
        >
          {{ t('contentStudio.createPost') }}
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
import { captureBlogModuleVisited } from '@/config/posthogBlog';

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
  router.push({ name: 'marketing-blog-new' });
}

function goCategories() {
  router.push({ name: 'marketing-blog-categories' });
}

function openItem(id) {
  router.push({ name: 'marketing-blog-edit', params: { id } });
}

async function loadItems() {
  loading.value = true;
  try {
    const response = await listContentDocuments('blog', {
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
  captureBlogModuleVisited();
  void loadItems();
});
</script>
