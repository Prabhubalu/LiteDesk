<template>
  <PortalPageShell
    :title="t('documents.portalDocumentsTitle')"
    :subtitle="t('documents.portalDocumentsSubtitle')"
    :error="error"
  >
    <div class="mb-4">
      <div class="relative max-w-md">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          v-model="searchQuery"
          type="search"
          class="min-h-11 w-full rounded-xl py-2.5 pl-9 pr-3 text-sm text-neutral-900 dark:text-white"
          :class="PLATFORM_HOME_INSET_CONTROL_CLASS"
          :placeholder="t('documents.portalDocumentsSearchPlaceholder')"
          @keyup.enter="loadDocuments"
        />
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-24" :class="PLATFORM_HOME_SKELETON_CLASS" />
    </div>

    <div
      v-else-if="documents.length === 0"
      :class="['p-10 text-center sm:p-12', PLATFORM_HOME_CARD_CLASS]"
    >
      <h3 class="text-lg font-medium text-neutral-900 dark:text-white">
        {{ t('documents.portalDocumentsEmptyTitle') }}
      </h3>
      <p class="mt-2 text-neutral-600 dark:text-neutral-400">
        {{ t('documents.portalDocumentsEmptyMessage') }}
      </p>
    </div>

    <div v-else class="space-y-3">
      <button
        v-for="doc in documents"
        :key="doc._id"
        type="button"
        class="group w-full rounded-2xl p-4 text-left transition-colors hover:border-primary-200/70 dark:hover:border-primary-500/25"
        :class="PLATFORM_HOME_CARD_CLASS"
        @click="openDocument(doc._id)"
      >
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400">{{ doc.documentNumber }}</p>
          <span
            v-if="doc.documentType"
            class="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {{ doc.documentType }}
          </span>
        </div>
        <h3 class="mt-1 text-base font-semibold text-neutral-900 dark:text-white">{{ doc.title }}</h3>
        <p v-if="doc.description" class="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {{ doc.description }}
        </p>
        <p class="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('documents.portalDocumentsUpdated', { date: formatDate(doc.updatedAt) }) }}
        </p>
      </button>
    </div>
  </PortalPageShell>
</template>

<script setup>
import { formatUserDate } from '@/utils/localeFormat';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { usePortalDocuments } from '@/composables/usePortalDocuments';
import PortalPageShell from '@/components/portal/PortalPageShell.vue';
import {
  PLATFORM_HOME_CARD_CLASS,
  PLATFORM_HOME_INSET_CONTROL_CLASS,
  PLATFORM_HOME_SKELETON_CLASS
} from '@/utils/platformHomeLayout';

const { t } = useI18n();
const router = useRouter();
const { listDocuments } = usePortalDocuments();

const loading = ref(true);
const error = ref(null);
const documents = ref([]);
const searchQuery = ref('');

function formatDate(value) {
  if (!value) return '';
  return formatUserDate(value) || '—';
}

function openDocument(id) {
  router.push({ name: 'portal-document-detail', params: { id } });
}

async function loadDocuments() {
  loading.value = true;
  error.value = null;
  try {
    const response = await listDocuments({
      search: searchQuery.value.trim()
    });
    if (!response?.success) {
      error.value = response?.message || t('documents.portalDocumentsLoadFailed');
      documents.value = [];
      return;
    }
    documents.value = response.data || [];
  } catch (err) {
    error.value = err?.message || t('documents.portalDocumentsLoadFailed');
    documents.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadDocuments();
});
</script>
