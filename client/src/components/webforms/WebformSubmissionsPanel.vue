<template>
  <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-700">
      <div class="min-w-0">
        <button
          type="button"
          class="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          @click="goBack"
        >
          <ArrowLeftIcon class="h-4 w-4" />
          {{ t('webforms.submissionsBackToList') }}
        </button>
        <h2 class="truncate text-2xl font-bold text-gray-900 dark:text-white">
          {{ webform?.name || t('webforms.submissionsTitle') }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.submissionsSubtitle') }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a
          v-if="publicUrl"
          :href="publicUrl"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowTopRightOnSquareIcon class="h-4 w-4" />
          {{ t('webforms.submissionsOpenForm') }}
        </a>
        <button
          type="button"
          class="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          @click="openBuilder"
        >
          {{ t('webforms.submissionsEditForm') }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          :disabled="loading"
          @click="fetchSubmissions"
        >
          {{ t('actions.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loading && !submissions.length" class="flex flex-1 justify-center py-16">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="!loading && submissions.length === 0"
      class="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-600"
    >
      <InboxIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('webforms.submissionsEmptyTitle') }}</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('webforms.submissionsEmptyMessage') }}</p>
      <a
        v-if="publicUrl"
        :href="publicUrl"
        target="_blank"
        rel="noopener"
        class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
      >
        {{ t('webforms.submissionsOpenForm') }}
      </a>
    </div>

    <div v-else class="min-h-0 flex-1 overflow-auto">
      <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/40">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.subColSubmitted') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.subColStatus') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.subColValues') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.subColCrm') }}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ t('webforms.subColActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            <template v-for="row in submissions" :key="row._id">
              <tr>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ formatDate(row.createdAt) }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="submissionStatusClass(row.status)">
                    {{ submissionStatusLabel(row.status) }}
                  </span>
                </td>
                <td class="max-w-xs px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <span class="line-clamp-2">{{ submissionSummary(row) }}</span>
                </td>
                <td class="px-4 py-3 text-sm">
                  <template v-if="row.crmOutcome?.recordId">
                    <span class="text-gray-700 dark:text-gray-300">{{ crmActionLabel(row.crmOutcome.action) }}</span>
                    <RouterLink
                      :to="crmRecordPath(row.crmOutcome)"
                      class="ml-1 text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {{ t('webforms.subViewRecord') }}
                    </RouterLink>
                  </template>
                  <span v-else-if="row.status === 'failed'" class="text-red-600 dark:text-red-400">
                    {{ row.errorMessage || t('webforms.subCrmFailed') }}
                  </span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                    @click="toggleExpanded(row._id)"
                  >
                    {{ expandedId === row._id ? t('webforms.subHideDetails') : t('webforms.subShowDetails') }}
                  </button>
                </td>
              </tr>
              <tr v-if="expandedId === row._id">
                <td colspan="5" class="bg-gray-50 px-4 py-4 dark:bg-gray-900/30">
                  <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div v-for="entry in fieldEntries(row)" :key="entry.fieldId" class="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
                      <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">{{ entry.label }}</dt>
                      <dd class="mt-0.5 break-words text-sm text-gray-900 dark:text-white">
                        <a
                          v-if="entry.downloadUrl"
                          :href="entry.downloadUrl"
                          target="_blank"
                          rel="noopener"
                          class="text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {{ entry.displayValue }}
                        </a>
                        <span v-else>{{ entry.displayValue }}</span>
                      </dd>
                    </div>
                  </dl>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="pagination.totalPages > 1" class="mt-4 flex items-center justify-between gap-3">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ t('webforms.submissionsPageInfo', { page: pagination.page, total: pagination.totalPages }) }}
        </p>
        <div class="flex gap-2">
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700"
            :disabled="pagination.page <= 1 || loading"
            @click="goToPage(pagination.page - 1)"
          >
            {{ t('actions.previous') }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-gray-700"
            :disabled="pagination.page >= pagination.totalPages || loading"
            @click="goToPage(pagination.page + 1)"
          >
            {{ t('actions.next') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeftIcon, ArrowTopRightOnSquareIcon, InboxIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { buildCrmRecordPath, buildWebformPublicUrl } from '@/utils/webformFormatters';

const props = defineProps({
  webformId: { type: String, required: true }
});

const { t, d } = useI18n();
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const webform = ref(null);
const submissions = ref([]);
const expandedId = ref('');
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 });

const fieldLabelMap = computed(() => {
  const map = new Map();
  for (const field of webform.value?.fields || []) {
    map.set(String(field.fieldId), field.label || field.fieldId);
  }
  return map;
});

const publicUrl = computed(() => {
  const slug = webform.value?.publicLink?.slug;
  if (!slug || !webform.value?.publicLink?.enabled) return '';
  return buildWebformPublicUrl(slug);
});

function formatDate(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'medium');
  } catch {
    return String(value);
  }
}

function submissionStatusLabel(status) {
  if (status === 'processed') return t('webforms.subStatusProcessed');
  if (status === 'failed') return t('webforms.subStatusFailed');
  if (status === 'duplicate_rejected') return t('webforms.subStatusDuplicate');
  return t('webforms.subStatusPending');
}

function submissionStatusClass(status) {
  if (status === 'processed') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
  if (status === 'failed') {
    return 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
  }
  if (status === 'duplicate_rejected') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
}

function crmActionLabel(action) {
  if (action === 'updated') return t('webforms.subCrmUpdated');
  if (action === 'created') return t('webforms.subCrmCreated');
  if (action === 'skipped') return t('webforms.subCrmSkipped');
  return action || '—';
}

function crmRecordPath(crmOutcome) {
  return buildCrmRecordPath(crmOutcome?.moduleKey, crmOutcome?.recordId);
}

function formatFieldValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const fileName = String(value.fileName || '').trim();
    if (fileName) return fileName;
    if (value.uploadToken) return String(value.uploadToken);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function fileDownloadHref(value) {
  if (!value || typeof value !== 'object') return '';
  return String(value.downloadUrl || '').trim();
}

function fieldEntries(row) {
  const values = row.fieldValues && typeof row.fieldValues === 'object' ? row.fieldValues : {};
  return Object.entries(values).map(([fieldId, value]) => ({
    fieldId,
    label: fieldLabelMap.value.get(fieldId) || fieldId,
    displayValue: formatFieldValue(value),
    downloadUrl: fileDownloadHref(value)
  }));
}

function submissionSummary(row) {
  const entries = fieldEntries(row).slice(0, 3);
  if (!entries.length) return '—';
  return entries.map((entry) => `${entry.label}: ${entry.displayValue}`).join(' · ');
}

function toggleExpanded(id) {
  expandedId.value = expandedId.value === id ? '' : id;
}

async function fetchSubmissions(page = pagination.value.page) {
  loading.value = true;
  try {
    const res = await apiClient.get(`/webforms/${props.webformId}/submissions`, {
      params: { page, limit: pagination.value.limit }
    });
    if (res?.success) {
      webform.value = res.data?.webform || null;
      submissions.value = Array.isArray(res.data?.submissions) ? res.data.submissions : [];
      pagination.value = {
        page: res.pagination?.page || page,
        limit: res.pagination?.limit || pagination.value.limit,
        total: res.pagination?.total || 0,
        totalPages: res.pagination?.totalPages || 1
      };
    }
  } catch {
    submissions.value = [];
  } finally {
    loading.value = false;
  }
}

function goToPage(page) {
  fetchSubmissions(page);
}

function goBack() {
  router.replace({
    path: '/settings',
    query: { tab: 'webforms' }
  });
}

function openBuilder() {
  router.replace({
    path: '/settings',
    query: {
      tab: 'webforms',
      webformId: props.webformId
    }
  });
}

onMounted(() => {
  fetchSubmissions(1);
});

watch(
  () => props.webformId,
  () => {
    expandedId.value = '';
    fetchSubmissions(1);
  }
);
</script>
