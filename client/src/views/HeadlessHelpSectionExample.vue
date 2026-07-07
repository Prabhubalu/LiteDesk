<template>
  <HeadlessExampleSiteLayout
    :org-slug="orgSlug"
    :show-setup="showSetup"
    active-area="help"
    layout="embed"
  >
    <div v-if="showSetup" class="mx-auto max-w-lg">
      <div class="hes-card">
        <h2 class="text-lg font-semibold text-neutral-900">{{ t('contentStudio.headlessSectionExampleTitle') }}</h2>
        <p class="mt-1 text-sm text-neutral-500">{{ t('contentStudio.headlessSectionExampleDesc') }}</p>
        <p class="mt-4 text-sm text-neutral-700">{{ t('contentStudio.headlessSectionExampleSetup') }}</p>
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
            {{ t('contentStudio.headlessSectionExampleSectionLabel') }}
            <input
              v-model="setupSection"
              type="text"
              required
              class="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label class="block text-sm font-medium text-neutral-700">
            {{ t('contentStudio.headlessSectionExampleParentLabel') }}
            <input
              v-model="setupParent"
              type="text"
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
      <div id="ld-help-section-example">
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
import { buildHeadlessExampleDemoPrefixes } from '@/composables/useHeadlessExampleSite';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const loading = ref(true);
const error = ref('');
const setupOrg = ref('');
const setupSection = ref('');
const setupParent = ref('');

const orgSlug = computed(() => String(route.query.org || route.query.orgSlug || '').trim());
const sectionSlug = computed(() => String(route.query.section || '').trim());
const parentSlug = computed(() => String(route.query.parent || '').trim());
const showSetup = computed(() => !orgSlug.value || !sectionSlug.value);

function loadEmbedAssets() {
  if (!document.querySelector('link[data-ld-headless-blocks-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/embed/headless-blocks.css';
    link.setAttribute('data-ld-headless-blocks-css', 'true');
    document.head.appendChild(link);
  }
}

function loadScript(src, marker) {
  if (document.querySelector(`script[data-ld-${marker}]`)) {
    return new Promise((resolve) => {
      const existing = document.querySelector(`script[data-ld-${marker}]`);
      if (existing?.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing?.addEventListener('load', () => resolve());
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute(`data-ld-${marker}`, 'true');
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadEmbedScripts() {
  await loadScript('/embed/headless-help-common.js', 'headless-help-common-js');
  await loadScript('/embed/headless-help-section.js', 'headless-help-section-js');
}

function buildDemoPrefixes(org) {
  return buildHeadlessExampleDemoPrefixes(org);
}

async function loadSection() {
  if (showSetup.value) {
    setupOrg.value = orgSlug.value;
    setupSection.value = sectionSlug.value;
    setupParent.value = parentSlug.value;
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    loadEmbedAssets();
    await loadEmbedScripts();
    const apiOrigin = getApiOrigin() || window.location.origin;
    const prefixes = buildDemoPrefixes(orgSlug.value);
    await window.LiteDeskHeadlessHelpSection.mount({
      org: orgSlug.value,
      section: sectionSlug.value,
      parent: parentSlug.value,
      target: '#ld-help-section-example',
      apiOrigin,
      categoryPrefix: prefixes.categoryPrefix,
      sectionPrefix: prefixes.sectionPrefix,
      homePrefix: prefixes.homePrefix,
      articlePrefix: prefixes.articlePrefix,
      homeLabel: t('contentStudio.publicHelpHomeLabel'),
      popularTitle: t('contentStudio.publicHelpPopularTitle'),
      recentTitle: t('contentStudio.publicHelpRecentTitle'),
      sectionsTitle: t('contentStudio.publicHelpSectionsNavTitle'),
      popularEmptyLabel: t('contentStudio.publicHelpPopularEmpty'),
      recentEmptyLabel: t('contentStudio.publicHelpRecentEmpty'),
      articlesEmptyLabel: t('contentStudio.publicHelpArticlesEmpty'),
      notFoundLabel: t('contentStudio.publicHelpSectionNotFound'),
      loadFailedLabel: t('contentStudio.publicHelpCenterLoadFailed'),
    });
    trackHeadlessHelpViewed('section', {
      org: orgSlug.value,
      section: sectionSlug.value,
      parent: parentSlug.value || undefined,
    });
  } catch (err) {
    error.value = err?.message || t('contentStudio.headlessSectionExampleLoadFailed');
  } finally {
    loading.value = false;
  }
}

function submitSetup() {
  const query = {
    org: setupOrg.value.trim(),
    section: setupSection.value.trim(),
  };
  const parent = setupParent.value.trim();
  if (parent) query.parent = parent;
  router.replace({ path: route.path, query });
}

onMounted(() => {
  void loadSection();
});

watch(
  () => [route.query.org, route.query.orgSlug, route.query.section, route.query.parent],
  () => {
    void loadSection();
  },
);
</script>
