<template>
  <PortalPageShell
    :title="document?.title || t('documents.portalDocumentsTitle')"
    :subtitle="document?.documentNumber || ''"
    :error="error"
  >
    <template #actions>
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        @click="goBack"
      >
        {{ t('actions.back') }}
      </button>
      <button
        v-if="canDownload"
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        :disabled="downloading"
        @click="download"
      >
        {{ downloading ? t('documents.portalDocumentsDownloading') : t('documents.portalDocumentsDownload') }}
      </button>
    </template>

    <div v-if="loading" class="space-y-3">
      <div class="h-40" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>

    <div v-else-if="document" class="space-y-4">
      <div :class="['p-5', PLATFORM_HOME_CARD_CLASS]">
        <div class="flex flex-wrap gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span v-if="document.documentType">{{ document.documentType }}</span>
          <span v-if="document.fileType">{{ document.fileType }}</span>
          <span>{{ t('documents.portalDocumentsUpdated', { date: formatDate(document.updatedAt) }) }}</span>
        </div>
        <p v-if="document.description" class="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
          {{ document.description }}
        </p>
        <div
          v-if="document.richContentText"
          class="prose prose-sm mt-4 max-w-none dark:prose-invert"
        >
          <pre class="whitespace-pre-wrap font-sans text-sm text-neutral-800 dark:text-neutral-200">{{ document.richContentText }}</pre>
        </div>
        <p
          v-else-if="!canDownload"
          class="mt-4 text-sm text-neutral-600 dark:text-neutral-400"
        >
          {{ t('documents.portalDocumentsNoPreview') }}
        </p>
      </div>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { usePortalDocuments } from '@/composables/usePortalDocuments';
import { useTabs } from '@/composables/useTabs';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import { PLATFORM_HOME_CARD_CLASS, PLATFORM_HOME_SKELETON_CLASS } from '@/utils/platformHomeLayout';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { getDocument, downloadDocument } = usePortalDocuments();
const { activeTabId, findTabById, updateTabTitle } = useTabs();

const loading = ref(true);
const downloading = ref(false);
const error = ref(null);
const document = ref(null);

const canDownload = computed(() =>
  Boolean(document.value?.hasFile || document.value?.externalUrl)
);

function syncDocumentTabTitle() {
  const title = String(document.value?.title || '').trim();
  const tabId = activeTabId.value;
  if (!title || !tabId) return;
  const tab = findTabById(tabId);
  const tabPath = String(tab?.path || '').split('?')[0];
  const routePath = String(route.path || '').split('?')[0];
  if (!tab || tabPath !== routePath || !routePath.startsWith('/portal/documents/')) return;
  updateTabTitle(tabId, title);
}

watch([document, activeTabId, () => route.path], () => {
  syncDocumentTabTitle();
});

function formatDate(value) {
  if (!value) return '';
  return formatUserDate(value) || '—';
}

function goBack() {
  router.push({ name: 'portal-documents' });
}

async function loadDocument() {
  loading.value = true;
  error.value = null;
  try {
    const response = await getDocument(route.params.id);
    if (!response?.success || !response.data) {
      error.value = response?.message || t('documents.portalDocumentsLoadFailed');
      document.value = null;
      return;
    }
    document.value = response.data;
  } catch (err) {
    error.value = err?.message || t('documents.portalDocumentsLoadFailed');
    document.value = null;
  } finally {
    loading.value = false;
  }
}

async function download() {
  if (!document.value?._id || downloading.value) return;
  downloading.value = true;
  try {
    const response = await downloadDocument(document.value._id);
    const url = response?.data?.url;
    if (!response?.success || !url) {
      error.value = response?.message || t('documents.portalDocumentsDownloadFailed');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    error.value = err?.message || t('documents.portalDocumentsDownloadFailed');
  } finally {
    downloading.value = false;
  }
}

onMounted(() => {
  void loadDocument();
});
</script>
