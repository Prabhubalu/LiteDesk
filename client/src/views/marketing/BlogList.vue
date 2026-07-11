<template>
  <div class="mx-auto w-full px-6 py-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">{{ t('contentStudio.blogTitle') }}</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('contentStudio.blogSubtitle') }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        @click="goCreate"
      >
        {{ t('contentStudio.createPost') }}
      </button>
    </div>

    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div v-if="loading" class="p-8 text-sm text-gray-500 dark:text-gray-400">{{ t('states.loading') }}</div>
      <div v-else-if="items.length === 0" class="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('contentStudio.emptyBlog') }}
      </div>
      <table v-else class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-800/60">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnTitle') }}</th>
            <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{{ t('contentStudio.columnStatus') }}</th>
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

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const items = ref([]);

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function goCreate() {
  router.push({ name: 'marketing-blog-new' });
}

function openItem(id) {
  router.push({ name: 'marketing-blog-edit', params: { id } });
}

onMounted(async () => {
  loading.value = true;
  try {
    const response = await listContentDocuments('blog');
    items.value = response.items;
  } finally {
    loading.value = false;
  }
});
</script>
