<template>
  <div class="mx-auto w-full">
    <ListView
      :title="t('marketing.audiencesListTitle')"
      :description="listDescription"
      module-key="audiences"
      :create-label="t('marketing.audiencesNew')"
      :search-placeholder="t('marketing.audiencesSearchPlaceholder')"
      :data="audiences"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="marketing-audiences-table"
      row-key="_id"
      :empty-title="emptyTitle"
      :empty-message="emptyMessage"
      :show-import="false"
      :show-export="false"
      :show-create="canCreate"
      @create="goToCreate"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @fetch="loadAudiences"
      @row-click="openAudience"
    >
      <template #cell-type="{ value }">
        <BadgeCell
          :value="formatType(value)"
          :variant="value === 'dynamic' ? 'info' : 'default'"
        />
      </template>

      <template #cell-memberCount="{ value }">
        <span>{{ value ?? 0 }}</span>
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
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { useMarketingAudiences } from '@/composables/useMarketingAudiences';
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
  audiences,
  loading,
  pagination,
  fetchAudiences
} = useMarketingAudiences();

const searchQuery = ref('');

const canCreate = computed(() => authStore.can('audiences', 'create'));

const columns = computed(() => [
  { key: 'name', label: t('marketing.audiencesColName'), sortable: true },
  { key: 'type', label: t('marketing.audiencesColType'), sortable: true },
  { key: 'memberCount', label: t('marketing.audiencesColMembers'), sortable: false },
  { key: 'updatedAt', label: t('marketing.audiencesColUpdated'), sortable: true }
]);

const listDescription = computed(() => t('marketing.audiencesListDescription'));

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

const hasActiveFilters = computed(() => Boolean(searchQuery.value.trim()));

const emptyTitle = computed(() =>
  hasActiveFilters.value
    ? t('marketing.audiencesNoResultsTitle')
    : t('marketing.audiencesEmptyTitle')
);

const emptyMessage = computed(() =>
  hasActiveFilters.value
    ? t('marketing.audiencesNoResultsMessage')
    : t('marketing.audiencesEmptyMessage')
);

function formatType(value) {
  if (value === 'dynamic') return t('marketing.audiencesTypeDynamic');
  return t('marketing.audiencesTypeStatic');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatUserDate(date) || '—';
}

async function loadAudiences() {
  await fetchAudiences({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value
  });
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadAudiences();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadAudiences();
}

function goToCreate() {
  router.push({ name: 'marketing-audience-new' });
}

function openAudience(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'marketing-audience-detail', params: { id } });
}

onMounted(async () => {
  const isFirstVisit = !hasModuleVisit('audiences', 'MARKETING');
  captureMarketingModuleVisited('audiences', {
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void recordModuleVisit('audiences', 'MARKETING');
  await loadAudiences();
  if (!hasActiveFilters.value && pagination.total === 0 && isFirstVisit) {
    captureFirstTimeEmptyStateSeen('audiences', 'MARKETING', {
      organizationId: authStore.user?.organizationId || authStore.organization?._id || null
    });
  }
});
</script>
