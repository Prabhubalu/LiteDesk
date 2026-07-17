<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="blog"
    layout="embed"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessBlogExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessBlogExampleDesc') }}</p>
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
          <label class="block text-sm font-medium text-neutral-700">
            {{ t('contentStudio.headlessBlogExamplePostSlug') }}
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
        <p class="mt-4 text-sm text-neutral-500">
          <a :href="listDemoHref" class="text-primary-600 hover:underline">{{ t('contentStudio.headlessBlogExampleOpenList') }}</a>
        </p>
      </div>
    </div>

    <template v-else>
      <p
        v-if="error"
        class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error }}
        <a :href="listDemoHref" class="ml-2 font-medium underline">{{ t('contentStudio.headlessBlogExampleOpenList') }}</a>
      </p>
      <p
        v-if="loading"
        class="mb-4 text-sm text-neutral-500"
      >
        {{ t('states.loading') }}
      </p>
      <!-- Empty host only — embed script owns children via innerHTML (must not be Vue-managed). -->
      <div :key="mountKey" id="ld-blog-example" />
    </template>
  </HeadlessExampleSiteLayout>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getApiOrigin } from '@/config/apiBase';
import HeadlessExampleSiteLayout from '@/components/headlessExample/HeadlessExampleSiteLayout.vue';

declare global {
  interface Window {
    LiteDeskHeadlessBlocks?: unknown;
    LiteDeskHeadlessBlog?: {
      mount: (options: Record<string, unknown>) => Promise<void>;
    };
  }
}

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const setupOrg = ref('');
const setupSlug = ref('');
const mountKey = ref(0);

const orgSlug = computed(() => String(route.query.org || route.query.orgSlug || '').trim());
const postSlug = computed(() => String(route.query.slug || route.query.post || '').trim().replace(/^\/+/, '').toLowerCase());
const showSetup = computed(() => !orgSlug.value || !postSlug.value);
const listDemoHref = computed(() => (
  orgSlug.value
    ? `/examples/headless-blog-list?org=${encodeURIComponent(orgSlug.value)}`
    : '/examples/headless-blog-list'
));

function loadEmbedAssets(): Promise<void> {
  const cssReady = (() => {
    const existing = document.querySelector('link[data-ld-headless-blocks-css]') as HTMLLinkElement | null;
    if (existing) {
      if (existing.sheet || (existing as HTMLLinkElement).dataset.ldCssLoaded === '1') {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
      });
    }
    return new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `/embed/headless-blocks.css?v=${Date.now()}`;
      link.setAttribute('data-ld-headless-blocks-css', 'true');
      link.onload = () => {
        link.dataset.ldCssLoaded = '1';
        resolve();
      };
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
  })();

  const jsReady = (() => {
    if (window.LiteDeskHeadlessBlocks || document.querySelector('script[data-ld-headless-blocks-js]')) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/embed/headless-blocks.js';
      script.async = true;
      script.setAttribute('data-ld-headless-blocks-js', 'true');
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  })();

  return Promise.all([cssReady, jsReady]).then(() => undefined);
}

function loadEmbedBlogScript(): Promise<void> {
  if (window.LiteDeskHeadlessBlog) return Promise.resolve();
  if (document.querySelector('script[data-ld-headless-blog-js]')) {
    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-ld-headless-blog-js]');
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/embed/headless-blog.js';
    script.async = true;
    script.setAttribute('data-ld-headless-blog-js', 'true');
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadPost() {
  if (showSetup.value) {
    setupOrg.value = orgSlug.value;
    setupSlug.value = postSlug.value;
    loading.value = false;
    error.value = '';
    return;
  }

  loading.value = true;
  error.value = '';
  mountKey.value += 1;
  await nextTick();

  try {
    await loadEmbedAssets();
    await loadEmbedBlogScript();
    await nextTick();
    const apiOrigin = getApiOrigin() || window.location.origin;
    await window.LiteDeskHeadlessBlog?.mount({
      org: orgSlug.value,
      slug: postSlug.value,
      target: '#ld-blog-example',
      apiOrigin,
      showSidebar: false,
      showBreadcrumbs: false,
      showFeedbackFooter: false,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
    });

    const mountEl = document.querySelector('#ld-blog-example');
    const mountText = String(mountEl?.textContent || '').trim();
    if (/not found/i.test(mountText)) {
      error.value = t('contentStudio.headlessBlogExamplePostMissing', { slug: postSlug.value });
    }
  } catch (err) {
    error.value = (err as Error)?.message || t('contentStudio.headlessBlogExampleLoadFailed');
  } finally {
    loading.value = false;
  }
}

function submitSetup() {
  void router.replace({
    path: route.path,
    query: {
      org: setupOrg.value.trim(),
      slug: setupSlug.value.trim(),
    },
  });
}

onMounted(() => {
  void loadPost();
});

watch(
  () => [route.query.org, route.query.slug, route.query.orgSlug, route.query.post],
  () => {
    void loadPost();
  },
);
</script>
