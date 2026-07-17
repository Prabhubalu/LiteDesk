<template>
  <PortalPageShell
    :title="t('documents.portalKnowledgeTitle')"
    :subtitle="t('documents.portalKnowledgeSubtitle')"
    :error="error"
  >
    <section class="mb-6 rounded-2xl p-4" :class="PLATFORM_HOME_CARD_CLASS">
      <h2 class="text-sm font-semibold text-neutral-900 dark:text-white">
        {{ t('documents.portalKnowledgeAskTitle') }}
      </h2>
      <p class="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        {{ t('documents.portalKnowledgeAskHint') }}
      </p>
      <div class="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          v-model="askQuestion"
          type="search"
          class="min-h-11 w-full flex-1 rounded-xl py-2.5 px-3 text-sm text-neutral-900 dark:text-white"
          :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
          :placeholder="t('documents.portalKnowledgeAskPlaceholder')"
          @keyup.enter="runAsk"
        />
        <button
          type="button"
          class="min-h-11 shrink-0 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          :disabled="asking || !askQuestion.trim()"
          @click="runAsk"
        >
          {{ asking ? t('documents.portalKnowledgeAskRunning') : t('documents.portalKnowledgeAskSubmit') }}
        </button>
      </div>
      <p v-if="askError" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ askError }}</p>
      <p v-else-if="askNotConfigured" class="mt-2 text-sm text-amber-700 dark:text-amber-300">
        {{ t('documents.portalKnowledgeAskNotConfigured') }}
      </p>
      <div v-else-if="askAnswer" class="mt-3 space-y-2">
        <pre class="whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 font-sans text-sm text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">{{ askAnswer }}</pre>
        <p class="text-[11px] text-neutral-500 dark:text-neutral-400">{{ askDisclaimer }}</p>
        <ul v-if="askCitations.length" class="space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          <li v-for="c in askCitations" :key="c.chunkId || c.index">
            <button
              type="button"
              class="text-left text-primary-700 hover:underline dark:text-primary-300"
              @click="openArticle(c.sourceId)"
            >
              [{{ c.index }}] {{ c.excerpt || c.sourceId }}
            </button>
          </li>
        </ul>
        <p
          v-if="askEscalate"
          class="text-xs font-medium text-amber-800 dark:text-amber-200"
        >
          {{ t('documents.portalKnowledgeAskEscalate') }}
        </p>
      </div>
    </section>

    <div class="mb-4 space-y-3">
      <div class="relative max-w-md">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          v-model="searchQuery"
          type="search"
          class="min-h-11 w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-neutral-900 dark:text-white"
          :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
          :placeholder="t('cases.portalCasesSearchPlaceholder')"
          @keyup.enter="loadArticles"
        />
      </div>

      <div v-if="collections.length" class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          :class="selectedCollectionId ? PLATFORM_HOME_INSET_CONTROL_CLASS : 'bg-primary-600 text-white'"
          @click="selectCollection(null)"
        >
          {{ t('documents.portalKnowledgeAllCollections') }}
        </button>
        <button
          v-for="collection in collections"
          :key="collection._id"
          type="button"
          class="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          :class="selectedCollectionId === collection._id ? 'bg-primary-600 text-white' : PLATFORM_HOME_INSET_CONTROL_CLASS"
          @click="selectCollection(collection._id)"
        >
          {{ collection.name }}
          <span class="ml-1 opacity-70">({{ collection.articleCount }})</span>
        </button>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>

    <div
      v-else-if="articles.length === 0"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">{{ t('documents.portalKnowledgeEmptyTitle') }}</h3>
      <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('documents.portalKnowledgeEmptyMessage') }}</p>
    </div>

    <div v-else class="space-y-3">
      <button
        v-for="article in articles"
        :key="article._id"
        type="button"
        class="group w-full rounded-2xl p-4 text-left transition-colors hover:border-primary-200/70 dark:hover:border-primary-500/25"
        :class="PLATFORM_HOME_CARD_CLASS"
        @click="openArticle(article._id)"
      >
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400">{{ article.documentNumber }}</p>
          <span
            v-if="article.collectionName"
            class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {{ article.collectionName }}
          </span>
        </div>
        <h3 class="mt-0.5 text-base font-semibold text-neutral-900 dark:text-white">{{ article.title }}</h3>
        <p v-if="article.description" class="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {{ article.description }}
        </p>
        <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('documents.portalKnowledgeUpdated', { date: formatDate(article.updatedAt) }) }}
        </p>
      </button>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { usePortalKnowledge } from '@/composables/usePortalKnowledge';
import { capturePortalKnowledgeViewed } from '@/config/posthogDocuments';
import { useAuthStore } from '@/stores/authRegistry';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { listArticles, listCollections, ask } = usePortalKnowledge();

const loading = ref(true);
const error = ref(null);
const articles = ref([]);
const collections = ref([]);
const searchQuery = ref('');
const selectedCollectionId = ref(null);
const askQuestion = ref('');
const asking = ref(false);
const askAnswer = ref('');
const askError = ref('');
const askNotConfigured = ref(false);
const askDisclaimer = ref('');
const askCitations = ref([]);
const askEscalate = ref(false);

async function runAsk() {
  const q = askQuestion.value.trim();
  if (!q || asking.value) return;
  asking.value = true;
  askError.value = '';
  askAnswer.value = '';
  askNotConfigured.value = false;
  askDisclaimer.value = '';
  askCitations.value = [];
  askEscalate.value = false;
  try {
    const data = await ask(q);
    if (!data?.success) {
      if (data?.notConfigured) {
        askNotConfigured.value = true;
      } else {
        askError.value = data?.message || t('documents.portalKnowledgeAskFailed');
      }
      return;
    }
    askAnswer.value = String(data.answer || '').trim();
    askDisclaimer.value = String(data.disclaimer || '').trim();
    askCitations.value = Array.isArray(data.citations) ? data.citations : [];
    askEscalate.value = Boolean(data.containment?.escalateSuggested) || !data.found;
    if (!askAnswer.value) {
      askError.value = t('documents.portalKnowledgeAskEmpty');
      askEscalate.value = true;
    }
  } catch (err) {
    if (err?.response?.data?.notConfigured || err?.notConfigured) {
      askNotConfigured.value = true;
    } else {
      askError.value = err?.message || t('documents.portalKnowledgeAskFailed');
    }
  } finally {
    asking.value = false;
  }
}

function formatDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

async function loadCollections() {
  try {
    const response = await listCollections();
    collections.value = response?.success ? response.data || [] : [];
  } catch {
    collections.value = [];
  }
}

async function loadArticles() {
  loading.value = true;
  error.value = null;
  try {
    const response = await listArticles({
      search: searchQuery.value.trim(),
      collectionId: selectedCollectionId.value,
    });
    if (!response?.success) {
      error.value = response?.message || t('documents.portalKnowledgeLoadFailed');
      articles.value = [];
      return;
    }
    articles.value = response.data || [];
  } catch (err) {
    error.value = err?.message || t('documents.portalKnowledgeLoadFailed');
    articles.value = [];
  } finally {
    loading.value = false;
  }
}

function selectCollection(collectionId) {
  selectedCollectionId.value = collectionId;
  void loadArticles();
}

function openArticle(id) {
  router.push({ name: 'portal-knowledge-article', params: { id } });
}

onMounted(() => {
  capturePortalKnowledgeViewed({
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void loadCollections();
  void loadArticles();
});
</script>
