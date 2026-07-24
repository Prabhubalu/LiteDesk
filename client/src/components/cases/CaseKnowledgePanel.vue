<template>
  <div class="flex h-full flex-col">
    <div class="record-context-panel__header flex shrink-0 items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('cases.recordRailKnowledge') }}</h2>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <div
        v-if="suggestedReply?.draft"
        class="border-b border-indigo-100 bg-indigo-50/60 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/30"
      >
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          {{ t('cases.recordKnowledgeSuggestedReply') }}
        </p>
        <p class="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{{ suggestedReply.draft }}</p>
        <ul v-if="suggestedReply.citations?.length" class="mt-2 space-y-1">
          <li
            v-for="(c, idx) in suggestedReply.citations"
            :key="`${c.id || idx}`"
            class="text-xs text-gray-500"
          >
            [{{ idx + 1 }}] {{ c.title || c.sourceType }}
          </li>
        </ul>
        <p class="mt-2 text-[11px] text-gray-500">{{ t('cases.recordKnowledgeSuggestedReplyHint') }}</p>
      </div>

      <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('cases.recordKnowledgeArticlesHeading') }}
        </p>
        <input
          v-model="search"
          type="search"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          :placeholder="t('cases.recordKnowledgeSearchPlaceholder')"
          @input="scheduleSearch"
        />
      </div>

      <div class="p-4">
        <p v-if="loading" class="text-sm text-gray-500">{{ t('states.loading') }}</p>
        <p v-else-if="!articles.length" class="text-sm text-gray-500">{{ t('cases.recordKnowledgeEmpty') }}</p>
        <ul v-else class="space-y-2">
          <li v-for="article in articles" :key="article._id">
            <button
              type="button"
              class="w-full rounded-lg border border-gray-200 px-3 py-2 text-left hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              @click="openArticle(article)"
            >
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ article.title }}</p>
              <p v-if="article.description" class="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {{ article.description }}
              </p>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { searchArticlesForAgent } from '@/modules/contentStudio/services/contentStudioApi';
import { captureCaseKnowledgeSuggestionOpened } from '@/config/posthogArticles';

const props = defineProps({
  caseTitle: { type: String, default: '' },
  caseDescription: { type: String, default: '' },
  caseRecordId: { type: String, default: '' },
  suggestedReply: { type: Object, default: null },
});

const { t } = useI18n();
const router = useRouter();

const search = ref('');
const loading = ref(false);
const articles = ref([]);
let timer = null;

function buildDefaultQuery() {
  return [props.caseTitle, props.caseDescription].filter(Boolean).join(' ').trim();
}

function scheduleSearch() {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void loadArticles();
  }, 350);
}

async function loadArticles() {
  const query = search.value.trim() || buildDefaultQuery();
  if (query.length < 2) {
    articles.value = [];
    return;
  }
  loading.value = true;
  try {
    articles.value = await searchArticlesForAgent(query, 8);
  } catch {
    articles.value = [];
  } finally {
    loading.value = false;
  }
}

function openArticle(article) {
  if (!article?._id) return;
  captureCaseKnowledgeSuggestionOpened({ article_id: article._id, source: 'case_sidebar' });
  router.push({ name: 'helpdesk-article-edit', params: { id: article._id } });
}

watch(
  () => [props.caseTitle, props.caseDescription],
  () => {
    if (!search.value.trim()) void loadArticles();
  },
  { immediate: true },
);
</script>
