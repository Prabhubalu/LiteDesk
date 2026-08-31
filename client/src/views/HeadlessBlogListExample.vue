<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="blog"
    layout="embed"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessBlogListExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessBlogListExampleDesc') }}</p>
        <p class="mt-4 text-sm text-neutral-700">{{ t('contentStudio.headlessExampleSetup') }}</p>
        <form class="mt-4 space-y-4" @submit.prevent="submitSetup">
          <label class="block text-sm font-medium text-neutral-700">
            {{ t('contentStudio.headlessExampleOrgKey') }}
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
      <p
        v-if="loading"
        class="mb-4 text-sm text-neutral-500"
      >
        {{ t('states.loading') }}
      </p>
      <!-- Empty host only — embed script owns children via innerHTML (must not be Vue-managed). -->
      <div :key="mountKey" id="ld-blog-list-example" />
    </template>
  </HeadlessExampleSiteLayout>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getApiOrigin } from '@/config/apiBase';
import HeadlessExampleSiteLayout from '@/components/headlessExample/HeadlessExampleSiteLayout.vue';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const setupOrg = ref('');
const mountKey = ref(0);

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
  if (window.ArivuHeadlessBlogList) return Promise.resolve();
  if (document.querySelector('script[data-ld-headless-blog-list-js]')) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-ld-headless-blog-list-js]');
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/embed/headless-blog-list.js';
    script.async = true;
    script.setAttribute('data-ld-headless-blog-list-js', 'true');
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
  mountKey.value += 1;
  await nextTick();

  try {
    loadEmbedAssets();
    await loadEmbedListScript();
    await nextTick();
    const apiOrigin = getApiOrigin() || window.location.origin;
    await window.ArivuHeadlessBlogList.mount({
      org: orgSlug.value,
      target: '#ld-blog-list-example',
      apiOrigin,
      linkPrefix: `/examples/headless-blog?org=${encodeURIComponent(orgSlug.value)}&slug=`,
      limit: 10,
      searchLabel: t('contentStudio.searchBlog'),
      searchPlaceholder: t('contentStudio.searchBlog'),
      emptyLabel: t('contentStudio.emptyBlog'),
      loadFailedLabel: t('contentStudio.headlessBlogListExampleLoadFailed'),
      topPostsLabel: t('contentStudio.headlessBlogHomeTopPosts'),
      latestPostsLabel: t('contentStudio.headlessBlogHomeLatestPosts'),
      categoriesLabel: t('contentStudio.headlessBlogHomeCategories'),
      authorsLabel: t('contentStudio.headlessBlogHomeAuthors'),
      newsletterTitle: t('contentStudio.headlessBlogHomeNewsletterTitle'),
      newsletterDesc: t('contentStudio.headlessBlogHomeNewsletterDesc'),
      readMoreLabel: t('contentStudio.headlessBlogHomeReadMore'),
    });
  } catch (err) {
    error.value = err?.message || t('contentStudio.headlessBlogListExampleLoadFailed');
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
