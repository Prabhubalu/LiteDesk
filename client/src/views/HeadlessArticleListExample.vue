<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="list"
    layout="embed"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessListExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessListExampleDesc') }}</p>
        <p class="mt-4 text-sm text-neutral-700">{{ t('contentStudio.headlessListExampleSetup') }}</p>
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
      <div id="ld-help-list-example">
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
import HeadlessExampleSiteLayout from '@/components/headlessExample/HeadlessExampleSiteLayout.vue';
import { trackHeadlessHelpViewed } from '@/composables/useHeadlessHelpAnalytics';

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

function loadEmbedListScript() {
  if (window.ArivuHeadlessArticleList) return Promise.resolve();
  if (document.querySelector('script[data-ld-headless-article-list-js]')) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-ld-headless-article-list-js]');
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/embed/headless-article-list.js';
    script.async = true;
    script.setAttribute('data-ld-headless-article-list-js', 'true');
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadList() {
  if (showSetup.value) {
    setupOrg.value = orgSlug.value;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    loadEmbedAssets();
    await loadEmbedListScript();
    const apiOrigin = getApiOrigin() || window.location.origin;
    const prefixes = buildHeadlessExamplePrefixes(orgSlug.value);
    await window.ArivuHeadlessArticleList.mount({
      org: orgSlug.value,
      target: '#ld-help-list-example',
      apiOrigin,
      linkPrefix: prefixes.article,
      searchLabel: t('contentStudio.publicHelpSearchLabel'),
      searchPlaceholder: t('contentStudio.publicHelpSearchPlaceholder'),
      emptyLabel: t('contentStudio.publicHelpCenterEmpty'),
      loadFailedLabel: t('contentStudio.publicHelpCenterLoadFailed'),
    });
    trackHeadlessHelpViewed('list', { org: orgSlug.value });
  } catch (err) {
    error.value = err?.message || t('contentStudio.headlessListExampleLoadFailed');
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
  void loadList();
});

watch(
  () => [route.query.org, route.query.orgSlug],
  () => {
    void loadList();
  },
);
</script>
