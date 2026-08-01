<template>
  <div class="mx-auto w-full">
    <ListView
      :title="t('marketing.segmentsListTitle')"
      :description="listDescription"
      module-key="segments"
      :create-label="t('marketing.segmentsNew')"
      :search-placeholder="t('marketing.segmentsSearchPlaceholder')"
      :data="segments"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="marketing-segments-table"
      row-key="_id"
      :empty-title="emptyTitle"
      :empty-message="emptyMessage"
      :show-import="false"
      :show-export="false"
      :show-create="canCreate"
      @create="goToCreate"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @fetch="loadSegments"
      @row-click="openSegment"
    >
      <template #cell-memberCount="{ value }">
        <span>{{ value ?? 0 }}</span>
      </template>

      <template #cell-lastRefreshedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>
    </ListView>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import { useMarketingSegments } from '@/composables/useMarketingSegments';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import { captureMarketingModuleVisited } from '@/config/posthogMarketing';
import { formatUserDate } from '@/utils/localeFormat';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { recordModuleVisit, hasModuleVisit } = useOnboarding();

const {
  segments,
  loading,
  pagination,
  fetchSegments
} = useMarketingSegments();

const searchQuery = ref('');
const canCreate = computed(() => authStore.can('segments', 'create'));

const columns = computed(() => [
  { key: 'name', label: t('marketing.segmentsColName'), sortable: true },
  { key: 'memberCount', label: t('marketing.segmentsColMembers'), sortable: false },
  { key: 'lastRefreshedAt', label: t('marketing.segmentsColRefreshed'), sortable: true },
  { key: 'updatedAt', label: t('marketing.segmentsColUpdated'), sortable: true }
]);

const listDescription = computed(() => t('marketing.segmentsListDescription'));

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

const hasActiveFilters = computed(() => Boolean(searchQuery.value.trim()));

const emptyTitle = computed(() =>
  hasActiveFilters.value
    ? t('marketing.segmentsNoResultsTitle')
    : t('marketing.segmentsEmptyTitle')
);

const emptyMessage = computed(() =>
  hasActiveFilters.value
    ? t('marketing.segmentsNoResultsMessage')
    : t('marketing.segmentsEmptyMessage')
);

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatUserDate(date) || '-';
}

async function loadSegments() {
  await fetchSegments({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value
  });
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadSegments();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadSegments();
}

function goToCreate() {
  router.push({ name: 'marketing-segment-new' });
}

function openSegment(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'marketing-segment-detail', params: { id } });
}

onMounted(async () => {
  const isFirstVisit = !hasModuleVisit('segments', 'MARKETING');
  captureMarketingModuleVisited('segments', {
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void recordModuleVisit('segments', 'MARKETING');
  await loadSegments();
  if (!hasActiveFilters.value && pagination.total === 0 && isFirstVisit) {
    captureFirstTimeEmptyStateSeen('segments', 'MARKETING', {
      organizationId: authStore.user?.organizationId || authStore.organization?._id || null
    });
  }
});
</script>
