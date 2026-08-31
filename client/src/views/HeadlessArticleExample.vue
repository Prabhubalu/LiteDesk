<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="help"
    layout="embed"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessExampleCustomerDesc') }}</p>
        <p class="mt-4 text-sm text-neutral-700">{{ t('contentStudio.headlessExampleSetup') }}</p>
        <form class="mt-4 space-y-4" @submit.prevent="submitSetup">
          <label class="block text-sm font-medium text-neutral-700">
            {{ t('contentStudio.headlessExampleOrgSlug') }}
            <input
              v-model="setupOrg"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm font-medium text-neutral-700">
            {{ t('contentStudio.headlessExampleArticleSlug') }}
            <input
              v-model="setupSlug"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            {{ t('contentStudio.headlessExampleLoad') }}
          </button>
        </form>
      </div>
    </div>

    <div v-else id="ld-article-example">
      <p v-if="loading" class="text-sm text-neutral-500">{{ t('states.loading') }}</p>
    </div>
  </HeadlessExampleSiteLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getApiOrigin } from '@/config/apiBase';
import HeadlessExampleSiteLayout from '@/components/headlessExample/HeadlessExampleSiteLayout.vue';
import { trackHeadlessHelpViewed } from '@/composables/useHeadlessHelpAnalytics';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const setupOrg = ref('');
const setupSlug = ref('');

const orgSlug = computed(() => String(route.query.org || route.query.orgSlug || '').trim());
const articleSlug = computed(() => String(route.query.slug || route.query.article || '').trim().replace(/^\/+/, '').toLowerCase());
const showSetup = computed(() => !orgSlug.value || !articleSlug.value);

function loadEmbedAssets() {
  if (!document.querySelector('link[data-ld-headless-blocks-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/embed/headless-blocks.css';
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }

  if (!window.ArivuHeadlessBlocks && !document.querySelector('script[data-ld-headless-blocks-js]')) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/embed/headless-blocks.js';
      script.async = true;
      script.setAttribute('data-ld-headless-blocks-js', 'true');
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  return Promise.resolve();
}

function loadEmbedArticleScript() {
  if (window.ArivuHeadlessArticle) return Promise.resolve();
  if (document.querySelector('script[data-ld-headless-article-js]')) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-ld-headless-article-js]');
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/embed/headless-article.js';
    script.async = true;
    script.setAttribute('data-ld-headless-article-js', 'true');
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadArticle() {
  if (showSetup.value) {
    setupOrg.value = orgSlug.value;
    setupSlug.value = articleSlug.value;
    loading.value = false;
    return;
  }

  loading.value = true;

  try {
    await loadEmbedAssets();
    await loadEmbedArticleScript();
    const apiOrigin = getApiOrigin() || window.location.origin;
    const encodedOrg = encodeURIComponent(orgSlug.value);
    await window.ArivuHeadlessArticle.mount({
      org: orgSlug.value,
      slug: articleSlug.value,
      target: '#ld-article-example',
      apiOrigin,
      showSidebar: true,
      showBreadcrumbs: true,
      homePrefix: `/examples/headless-help-home?org=${encodedOrg}`,
      categoryPrefix: `/examples/headless-help-category?org=${encodedOrg}&collection=`,
      sectionPrefix: `/examples/headless-help-section?org=${encodedOrg}&section=`,
      articlePrefix: `/examples/headless-article?org=${encodedOrg}&slug=`,
      homeLabel: t('contentStudio.publicHelpHomeLabel'),
      topicsTitle: t('contentStudio.publicHelpBrowseTopics'),
      searchPlaceholder: t('contentStudio.publicHelpSearchPlaceholder'),
      helpfulLabel: t('contentStudio.articleFeedbackHelpfulLabel'),
      shareLabel: t('contentStudio.articleFeedbackShareLabel'),
      yesLabel: t('contentStudio.articleFeedbackYesLabel'),
      noLabel: t('contentStudio.articleFeedbackNoLabel'),
      thanksLabel: t('contentStudio.articleFeedbackThanksLabel'),
      showFeedbackFooter: true,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    });
    trackHeadlessHelpViewed('article', { org: orgSlug.value, article_slug: articleSlug.value });
  } catch {
    // mountArticle renders error inside #ld-article-example
  } finally {
    loading.value = false;
  }
}

function submitSetup() {
  router.replace({
    path: route.path,
    query: {
      org: setupOrg.value.trim(),
      slug: setupSlug.value.trim(),
    },
  });
}

onMounted(() => {
  void loadArticle();
});

watch(
  () => [route.query.org, route.query.slug, route.query.orgSlug, route.query.article],
  () => {
    void loadArticle();
  },
);
</script>
