<template>
  <div class="mx-auto w-full">
    <CampaignTenantSendStats class="px-6 pt-6" />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-2 px-6">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="filter in statusFilters"
          :key="filter.value || 'all'"
          type="button"
          class="rounded-full px-3 py-1 text-sm font-medium transition-colors"
          :class="statusFilter === filter.value
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'"
          @click="onStatusFilter(filter.value)"
        >
          {{ filter.label }}
        </button>
      </div>
      <router-link
        v-if="canView"
        :to="{ name: 'marketing-campaign-approvals' }"
        class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        {{ t('marketing.campaignsApprovalsNav') }}
      </router-link>
    </div>

    <div class="px-6 pb-6">
    <ListView
      :title="t('marketing.campaignsListTitle')"
      :description="listDescription"
      module-key="campaigns"
      :create-label="t('marketing.campaignsNew')"
      :search-placeholder="t('marketing.campaignsSearchPlaceholder')"
      :data="campaigns"
      :columns="columns"
      :loading="loading"
      :pagination="listPagination"
      table-id="marketing-campaigns-table"
      row-key="_id"
      :empty-title="emptyTitle"
      :empty-message="emptyMessage"
      :show-import="false"
      :show-export="false"
      :show-create="canCreate"
      @create="goToCreate"
      @update:search-query="onSearchChange"
      @update:pagination="onPaginationChange"
      @fetch="loadCampaigns"
      @row-click="openCampaign"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
      :row-can-delete="canDeleteCampaignRow"
    >
      <template #cell-status="{ value }">
        <BadgeCell
          :value="formatStatus(value)"
          :variant="statusVariantMap[value] || 'default'"
        />
      </template>

      <template #cell-recipientCount="{ row }">
        <span>{{ row.stats?.totalRecipients ?? 0 }}</span>
      </template>

      <template #cell-updatedAt="{ value }">
        <span>{{ formatDate(value) }}</span>
      </template>
    </ListView>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import CampaignTenantSendStats from '@/components/marketing/CampaignTenantSendStats.vue';
import { useMarketingCampaigns } from '@/composables/useMarketingCampaigns';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/authRegistry';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import { captureMarketingModuleVisited } from '@/config/posthogMarketing';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();
const { recordModuleVisit, hasModuleVisit } = useOnboarding();

const {
  campaigns,
  loading,
  pagination,
  fetchCampaigns,
  deleteCampaign
} = useMarketingCampaigns();

const searchQuery = ref('');
const statusFilter = ref('');

const canCreate = computed(() => authStore.can('campaigns', 'create'));
const canView = computed(() => authStore.can('campaigns', 'view'));

const CAMPAIGN_DELETABLE_STATUSES = new Set(['draft', 'completed', 'cancelled', 'failed', 'archived']);

const statusFilters = computed(() => [
  { value: '', label: t('marketing.campaignsFilterAll') },
  { value: 'draft', label: t('marketing.campaignsStatusDraft') },
  { value: 'scheduled', label: t('marketing.campaignsStatusScheduled') },
  { value: 'running', label: t('marketing.campaignsStatusRunning') },
  { value: 'completed', label: t('marketing.campaignsStatusCompleted') },
  { value: 'failed', label: t('marketing.campaignsStatusFailed') },
  { value: 'archived', label: t('marketing.campaignsStatusArchived') }
]);

const statusVariantMap = {
  draft: 'warning',
  scheduled: 'info',
  running: 'primary',
  paused: 'default',
  completed: 'success',
  cancelled: 'default',
  archived: 'default',
  failed: 'danger'
};

const statusLabelKeys = {
  draft: 'marketing.campaignsStatusDraft',
  scheduled: 'marketing.campaignsStatusScheduled',
  running: 'marketing.campaignsStatusRunning',
  paused: 'marketing.campaignsStatusPaused',
  completed: 'marketing.campaignsStatusCompleted',
  cancelled: 'marketing.campaignsStatusCancelled',
  archived: 'marketing.campaignsStatusArchived',
  failed: 'marketing.campaignsStatusFailed'
};

const columns = computed(() => [
  { key: 'name', label: t('marketing.campaignsColName'), sortable: true },
  { key: 'subject', label: t('marketing.campaignsColSubject'), sortable: true },
  { key: 'status', label: t('marketing.campaignsColStatus'), sortable: true },
  { key: 'recipientCount', label: t('marketing.campaignsColRecipients'), sortable: false },
  { key: 'updatedAt', label: t('marketing.campaignsColUpdated'), sortable: true }
]);

const listDescription = computed(() => {
  if (!statusFilter.value) return t('marketing.campaignsListDescription');
  return t('marketing.campaignsListDescriptionFiltered', {
    status: formatStatus(statusFilter.value)
  });
});

const listPagination = computed(() => ({
  currentPage: pagination.currentPage,
  totalPages: pagination.totalPages,
  totalRecords: pagination.total,
  limit: pagination.limit
}));

const hasActiveFilters = computed(
  () => Boolean(searchQuery.value.trim() || statusFilter.value)
);

const emptyTitle = computed(() =>
  hasActiveFilters.value
    ? t('marketing.campaignsNoResultsTitle')
    : t('marketing.campaignsEmptyTitle')
);

const emptyMessage = computed(() =>
  hasActiveFilters.value
    ? t('marketing.campaignsNoResultsMessage')
    : t('marketing.campaignsEmptyMessage')
);

function formatStatus(value) {
  const key = statusLabelKeys[value];
  return key ? t(key) : String(value || 'draft');
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function loadCampaigns() {
  await fetchCampaigns({
    page: pagination.currentPage,
    limit: pagination.limit,
    search: searchQuery.value,
    status: statusFilter.value || undefined
  });
}

function onSearchChange(query) {
  searchQuery.value = String(query || '').trim();
  pagination.currentPage = 1;
  loadCampaigns();
}

function onPaginationChange(next) {
  pagination.currentPage = next.currentPage || 1;
  pagination.limit = next.limit || pagination.limit;
  loadCampaigns();
}

function onStatusFilter(status) {
  statusFilter.value = status || '';
  pagination.currentPage = 1;
  loadCampaigns();
}

function goToCreate() {
  router.push({ name: 'marketing-campaign-new' });
}

function openCampaign(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  router.push({ name: 'marketing-campaign-detail', params: { id } });
}

function canDeleteCampaignRow(row) {
  return CAMPAIGN_DELETABLE_STATUSES.has(String(row?.status || ''));
}

async function handleDelete(row) {
  const id = row?._id || row?.id;
  if (!id) return;
  if (!canDeleteCampaignRow(row)) {
    notifications.error(t('marketing.campaignsDeleteNotAllowed'));
    return;
  }
  try {
    await deleteCampaign(id);
    notifications.success(t('marketing.campaignsDeleteSuccess'));
    await loadCampaigns();
  } catch (error) {
    notifications.error(error?.message || t('states.genericFailure'));
  }
}

function resolveBulkDeleteIds(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((row) => row?._id || row?.id).filter(Boolean);
  }
  if (Array.isArray(payload.selectedIds) && payload.selectedIds.length) {
    return payload.selectedIds;
  }
  return [];
}

async function handleBulkAction(actionId, payload) {
  if (actionId !== 'bulk-delete' && actionId !== 'delete') return;
  const ids = resolveBulkDeleteIds(payload);
  if (!ids.length) return;

  const rowsById = new Map(
    campaigns.value.map((row) => [String(row?._id || row?.id || ''), row])
  );
  const blocked = ids.filter((id) => !canDeleteCampaignRow(rowsById.get(String(id)) || {}));
  if (blocked.length > 0) {
    notifications.error(t('marketing.campaignsDeleteNotAllowed'));
    return;
  }

  try {
    const results = await Promise.allSettled(ids.map((id) => deleteCampaign(id)));
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      notifications.error(t('states.genericFailure'));
    } else {
      notifications.success(t('marketing.campaignsDeleteSuccess'));
    }
    await loadCampaigns();
  } catch (error) {
    notifications.error(error?.message || t('states.genericFailure'));
  }
}

onMounted(async () => {
  const isFirstVisit = !hasModuleVisit('campaigns', 'MARKETING');
  captureMarketingModuleVisited('campaigns', {
    organization_id: authStore.user?.organizationId || authStore.organization?._id || undefined
  });
  void recordModuleVisit('campaigns', 'MARKETING');
  await loadCampaigns();
  if (!hasActiveFilters.value && pagination.total === 0 && isFirstVisit) {
    captureFirstTimeEmptyStateSeen('campaigns', 'MARKETING', {
      organizationId: authStore.user?.organizationId || authStore.organization?._id || null
    });
  }
});
</script>
