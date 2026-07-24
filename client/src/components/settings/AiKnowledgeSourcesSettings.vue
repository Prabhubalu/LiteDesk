<template>
  <div class="space-y-6">
    <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiKnowledgeTitle') }}</h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiKnowledgeHint') }}</p>

      <div class="mt-4 space-y-3">
        <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input v-model="sources.articlesEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('settings.aiKnowledgeArticles') }}
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input v-model="sources.documentsEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('settings.aiKnowledgeDocuments') }}
        </label>
        <label class="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input v-model="sources.websiteEnabled" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('settings.aiKnowledgeWebsite') }}
        </label>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          :disabled="saving"
          @click="saveSources"
        >
          {{ saving ? t('states.loading') : t('settings.aiKnowledgeSave') }}
        </button>
        <p v-if="message" class="text-sm text-green-700 dark:text-green-400">{{ message }}</p>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      </div>
    </section>

    <section class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.aiKnowledgeWebsiteTitle') }}</h3>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{{ t('settings.aiKnowledgeWebsiteHint') }}</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <label class="block text-sm sm:col-span-2">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiKnowledgeUrl') }}</span>
          <input
            v-model="pageForm.url"
            type="url"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            placeholder="https://example.com/pricing"
          />
        </label>
        <label class="block text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiKnowledgePageTitle') }}</span>
          <input
            v-model="pageForm.title"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
        <label class="block text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiKnowledgeAudience') }}</span>
          <select
            v-model="pageForm.audience"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            <option value="public">{{ t('settings.aiKnowledgeAudiencePublic') }}</option>
            <option value="internal">{{ t('settings.aiKnowledgeAudienceInternal') }}</option>
          </select>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ t('settings.aiKnowledgePasteBody') }}</span>
          <textarea
            v-model="pageForm.body"
            rows="4"
            class="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          />
        </label>
      </div>
      <button
        type="button"
        class="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200"
        :disabled="adding"
        @click="addPage"
      >
        {{ adding ? t('states.loading') : t('settings.aiKnowledgeAddPage') }}
      </button>

      <ul class="mt-6 divide-y divide-gray-100 dark:divide-gray-700">
        <li v-for="page in websitePages" :key="page.id" class="flex items-start justify-between gap-3 py-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-gray-900 dark:text-white">{{ page.title }}</p>
            <p class="truncate text-xs text-gray-500">{{ page.sourceUrl || page.matchPath || page.pageKey }} · {{ page.audience }}</p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs text-red-600 hover:underline"
            @click="removePage(page.id)"
          >
            {{ t('settings.aiKnowledgeRemove') }}
          </button>
        </li>
        <li v-if="!websitePages.length" class="py-4 text-sm text-gray-500">{{ t('settings.aiKnowledgeNoPages') }}</li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();
const sources = reactive({
  articlesEnabled: true,
  documentsEnabled: true,
  websiteEnabled: true,
});
const websitePages = ref([]);
const pageForm = reactive({
  url: '',
  title: '',
  body: '',
  audience: 'public',
});
const saving = ref(false);
const adding = ref(false);
const message = ref('');
const error = ref('');

async function load() {
  error.value = '';
  try {
    const data = await apiClient.get('/ai/v2/knowledge-sources');
    Object.assign(sources, data?.sources || {});
    websitePages.value = data?.websitePages || [];
  } catch (err) {
    error.value = err?.message || t('settings.aiKnowledgeLoadFailed');
  }
}

async function saveSources() {
  saving.value = true;
  message.value = '';
  error.value = '';
  try {
    await apiClient.put('/ai/v2/knowledge-sources', { ...sources });
    message.value = t('settings.aiKnowledgeSaved');
  } catch (err) {
    error.value = err?.message || t('settings.aiKnowledgeSaveFailed');
  } finally {
    saving.value = false;
  }
}

async function addPage() {
  adding.value = true;
  error.value = '';
  try {
    await apiClient.post('/ai/v2/knowledge-sources/website', { ...pageForm });
    pageForm.url = '';
    pageForm.title = '';
    pageForm.body = '';
    await load();
  } catch (err) {
    error.value = err?.message || t('settings.aiKnowledgeSaveFailed');
  } finally {
    adding.value = false;
  }
}

async function removePage(id) {
  try {
    await apiClient.delete(`/ai/v2/knowledge-sources/website/${encodeURIComponent(id)}`);
    await load();
  } catch (err) {
    error.value = err?.message || t('settings.aiKnowledgeSaveFailed');
  }
}

onMounted(load);
</script>
