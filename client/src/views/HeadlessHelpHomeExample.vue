<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="home"
    layout="home"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessHomeExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessHomeExampleDesc') }}</p>
        <p class="mt-4 text-sm text-neutral-700">{{ t('contentStudio.headlessHomeExampleSetup') }}</p>
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
          <button type="submit" class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
            {{ t('contentStudio.headlessExampleLoad') }}
          </button>
        </form>
      </div>
    </div>

    <template v-else>
      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error }}
      </p>
      <div id="ld-help-home-example">
        <p v-if="loading" class="text-sm text-neutral-500">{{ t('states.loading') }}</p>
      </div>
    </template>
  </HeadlessExampleSiteLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getApiOrigin } from '@/config/apiBase';
import { trackHeadlessHelpViewed } from '@/composables/useHeadlessHelpAnalytics';
import HeadlessExampleSiteLayout from '@/components/headlessExample/HeadlessExampleSiteLayout.vue';
import { buildHeadlessExamplePrefixes } from '@/composables/useHeadlessExampleSite';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const setupOrg = ref('');

const orgSlug = computed(() => String(route.query.org || route.query.orgSlug || '').trim());
const showSetup = computed(() => !orgSlug.value);

function loadEmbedAssets() {
  if (!document.querySelector('link[data-ld-headless-blocks-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/embed/headless-blocks.css';
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }
}

function loadEmbedHomeScript() {
  if (window.LiteDeskHeadlessHelpHome) return Promise.resolve();
  if (document.querySelector('script[data-ld-headless-help-home-js]')) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-ld-headless-help-home-js]');
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/embed/headless-help-home.js';
    script.async = true;
    script.setAttribute('data-ld-headless-help-home-js', 'true');
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadHome() {
  if (showSetup.value) {
    setupOrg.value = orgSlug.value;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    loadEmbedAssets();
    await loadEmbedHomeScript();
    const apiOrigin = getApiOrigin() || window.location.origin;
    const prefixes = buildHeadlessExamplePrefixes(orgSlug.value);
    await window.LiteDeskHeadlessHelpHome.mount({
      org: orgSlug.value,
      target: '#ld-help-home-example',
      apiOrigin,
      linkPrefix: prefixes.category,
      articlePrefix: prefixes.article,
      title: '',
      categoriesTitle: t('contentStudio.publicHelpBrowseTopics'),
      searchLabel: t('contentStudio.publicHelpSearchLabel'),
      searchPlaceholder: t('contentStudio.publicHelpSearchPlaceholder'),
      emptyLabel: t('contentStudio.publicHelpHomeEmpty'),
      searchEmptyLabel: t('contentStudio.publicHelpCenterEmpty'),
      loadFailedLabel: t('contentStudio.publicHelpCenterLoadFailed'),
      backLabel: t('contentStudio.publicHelpHomeBack'),
      labelArticle: t('contentStudio.publicHelpArticleLabel'),
      labelArticles: t('contentStudio.publicHelpArticlesLabel'),
      labelSection: t('contentStudio.publicHelpSectionLabel'),
      labelSections: t('contentStudio.publicHelpSectionsLabel'),
    });
    trackHeadlessHelpViewed('home', { org: orgSlug.value });
  } catch (err) {
    error.value = err?.message || t('contentStudio.headlessHomeExampleLoadFailed');
  } finally {
    loading.value = false;
  }
}

function submitSetup() {
  router.replace({
    path: route.path,
    query: {
      org: setupOrg.value.trim(),
    },
  });
}

onMounted(() => {
  void loadHome();
});

watch(
  () => [route.query.org, route.query.orgSlug],
  () => {
    void loadHome();
  },
);
</script>
