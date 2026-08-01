<template>
  <div class="mx-auto w-full space-y-4">
    <div
      v-if="isEngagementForm"
      class="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900/60"
      role="tablist"
      :aria-label="t('forms.resultsSummaryViewToggle')"
    >
      <button
        type="button"
        role="tab"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeView === 'summary'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
        :aria-selected="activeView === 'summary'"
        @click="activeView = 'summary'"
      >
        {{ t('forms.resultsSummaryTabSummary') }}
      </button>
      <button
        type="button"
        role="tab"
        class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        :class="activeView === 'individual'
          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white'
          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'"
        :aria-selected="activeView === 'individual'"
        @click="activeView = 'individual'"
      >
        {{ t('forms.resultsSummaryTabIndividual') }}
      </button>
    </div>

    <FormRecordResultsSummarySection
      v-if="isEngagementForm && activeView === 'summary'"
      :summary="responseSummary"
      :loading="summaryLoading"
      :form-name="form?.name || ''"
      @expand-text="() => fetchResponseSummary(route.params.id, { textPreviewLimit: 200 })"
    />

    <ListView
      v-else
      :title="listTitle"
      :description="listDescription"
      module-key="forms"
      :search-placeholder="t('forms.hubResponsesSearchPlaceholder')"
      :data="responses"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="statsConfig"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalResponses, limit: pagination.responsesPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      table-id="form-responses-table"
      row-key="_id"
      :empty-title="t('forms.hubResponsesEmptyTitle')"
      :empty-message="t('forms.hubResponsesEmptyMessage')"
      :show-create="false"
      :show-import="false"
      :show-export="true"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchResponses(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.responsesPerPage = p.limit || pagination.responsesPerPage; fetchResponses(); }"
      @fetch="fetchResponses"
      @row-click="viewResponseDetail"
      @edit="viewResponseDetail"
      @delete="handleDelete"
      @export="exportResponses"
    >
      <!-- Custom Submitted At Cell -->
      <template #cell-submittedAt="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Custom Submitted By Cell -->
      <template #cell-submittedBy="{ row }">
        <div v-if="row.submittedBy" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.submittedBy.firstName,
              lastName: row.submittedBy.lastName,
              email: row.submittedBy.email,
              avatar: row.submittedBy.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.submittedBy.firstName }} {{ row.submittedBy.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('forms.hubAnonymous') }}</span>
      </template>

      <!-- Custom Execution Status Cell -->
      <template #cell-executionStatus="{ row }">
        <BadgeCell
          :value="executionStatusLabel(row.executionStatus)"
          :variant="executionStatusVariant(row.executionStatus)"
        />
      </template>

      <!-- Custom Review Status Cell -->
      <template #cell-reviewStatus="{ row }">
        <div v-if="row.executionStatus === 'Submitted' && row.reviewStatus" class="flex items-center gap-2">
          <BadgeCell
            :value="reviewStatusLabel(row.reviewStatus)"
            :variant="reviewStatusVariant(row.reviewStatus)"
          />
        </div>
        <span v-else class="text-xs text-gray-400 dark:text-gray-500 italic">{{ t('forms.hubNotInReview') }}</span>
      </template>

      <!-- Custom Score Cell -->
      <template #cell-score="{ row }">
        <div v-if="row.sectionScores && typeof row.sectionScores === 'object'" class="text-sm">
          <div class="text-gray-900 dark:text-white font-medium">
            {{ calculateOverallScore(row.sectionScores) }}%
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatHubSectionCount(Object.keys(row.sectionScores).length) }}
          </div>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom KPIs Cell -->
      <template #cell-kpis="{ row }">
        <div v-if="row.kpis && typeof row.kpis === 'object'" class="text-xs space-y-0.5">
          <div v-if="row.kpis.compliancePercentage !== undefined" class="text-gray-700 dark:text-gray-300">
            {{ t('forms.hubKpiCompliance', { value: row.kpis.compliancePercentage }) }}
          </div>
          <div v-if="row.kpis.avgRating !== undefined" class="text-gray-700 dark:text-gray-300">
            {{ t('forms.hubKpiRating', { value: row.kpis.avgRating }) }}
          </div>
          <div v-if="row.kpis.passRate !== undefined" class="text-gray-700 dark:text-gray-300">
            {{ t('forms.hubKpiPassRate', { value: row.kpis.passRate }) }}
          </div>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Linked To Cell -->
      <template #cell-linkedTo="{ row }">
        <div v-if="row.linkedTo && row.linkedTo.type" class="text-sm">
          <BadgeCell
            :value="linkedToTypeLabel(row.linkedTo.type)"
            :variant="linkedToTypeVariant(row.linkedTo.type)"
          />
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            @click.stop="viewResponseDetail(row)"
            class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            :title="t('forms.hubActionViewDetails')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            v-if="row.executionStatus === 'Submitted' && row.reviewStatus === 'Needs Auditor Review'"
            @click.stop="approveResponse(row)"
            class="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            :title="t('forms.hubActionApprove')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            v-if="row.executionStatus === 'Submitted' && row.reviewStatus === 'Needs Auditor Review'"
            @click.stop="rejectResponse(row)"
            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            :title="t('forms.hubActionReject')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            v-if="row.executionStatus === 'Submitted' && row.reviewStatus === 'Pending Corrective Action'"
            @click.stop="viewResponseDetail(row)"
            class="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
            :title="t('forms.hubActionAddCorrective')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useTabs } from '@/composables/useTabs';
import { useAuthStore } from '@/stores/authRegistry';
import { useFormResponseSummary } from '@/composables/useFormResponseSummary';
import { isEngagementFormType } from '@/utils/engagementFormDisplay';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import FormRecordResultsSummarySection from '@/components/forms/results/FormRecordResultsSummarySection.vue';

import { useNotifications } from '@/composables/useNotifications';
import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDate } from '@/utils/localeFormat';
const { t } = useI18n();
const notifications = useNotifications();


function formatHubSectionCount(count) {
  return t(count === 1 ? 'forms.hubSectionCountOne' : 'forms.hubSectionCountOther', { count });
}
const route = useRoute();
const router = useRouter();
const { openTab } = useTabs();
const { summary: responseSummary, loading: summaryLoading, fetchSummary: fetchResponseSummary } = useFormResponseSummary();

const activeView = ref('summary');
const isEngagementForm = computed(() => isEngagementFormType(form.value?.formType));

const EXECUTION_STATUS_VARIANTS = {
  'Not Started': 'default',
  'In Progress': 'info',
  Submitted: 'success',
};

const REVIEW_STATUS_VARIANTS = {
  'Pending Corrective Action': 'warning',
  'Needs Auditor Review': 'info',
  Approved: 'success',
  Rejected: 'danger',
  Closed: 'default',
};

const LINKED_TO_VARIANTS = {
  Organization: 'info',
  Deal: 'success',
  Task: 'warning',
  Event: 'primary',
  Lead: 'default',
  Contact: 'default',
};

function executionStatusLabel(value) {
  const keyByValue = {
    'Not Started': 'forms.hubExecutionNotStarted',
    'In Progress': 'forms.hubExecutionInProgress',
    Submitted: 'forms.hubExecutionSubmitted',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function executionStatusVariant(value) {
  return EXECUTION_STATUS_VARIANTS[value] || 'default';
}

function reviewStatusLabel(value) {
  const keyByValue = {
    'Pending Corrective Action': 'forms.hubReviewPendingCorrective',
    'Needs Auditor Review': 'forms.hubReviewNeedsAuditor',
    Approved: 'forms.auditorApproved',
    Rejected: 'forms.auditorRejected',
    Closed: 'forms.hubReviewClosed',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function reviewStatusVariant(value) {
  return REVIEW_STATUS_VARIANTS[value] || 'default';
}

function linkedToTypeLabel(value) {
  const keyByValue = {
    Organization: 'forms.settingsLinkOrganization',
    Deal: 'forms.settingsLinkDeal',
    Task: 'forms.settingsLinkTask',
    Event: 'forms.settingsLinkEvent',
    Lead: 'forms.hubLinkedLead',
    Contact: 'forms.hubLinkedContact',
  };
  const key = keyByValue[value];
  return key ? t(key) : value;
}

function linkedToTypeVariant(value) {
  return LINKED_TO_VARIANTS[value] || 'default';
}

// State
const form = ref(null);
const responses = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const sortField = ref('submittedAt');
const sortOrder = ref('desc');
const filters = ref({
  executionStatus: '',
  reviewStatus: '',
  fromDate: '',
  toDate: '',
  linkedToType: ''
});

const pagination = ref({
  currentPage: 1,
  responsesPerPage: 25,
  totalResponses: 0,
  totalPages: 1
});

const statistics = ref({
  total: 0,
  new: 0,
  approved: 0,
  needsAction: 0
});

const listTitle = computed(() => form.value?.name || t('forms.hubResponsesTitleFallback'));

const listDescription = computed(() => {
  if (form.value?.description) {
    return form.value.description;
  }
  const formId = form.value?.formId || t('forms.hubResponsesFormIdFallback');
  return t('forms.hubResponsesDescription', { formId });
});

const statsConfig = computed(() => [
  { name: t('forms.hubStatTotalResponses'), key: 'total', formatter: 'number' },
  { name: t('forms.hubStatNew'), key: 'new', formatter: 'number' },
  { name: t('forms.hubStatApproved'), key: 'approved', formatter: 'number' },
  { name: t('forms.hubStatNeedsAction'), key: 'needsAction', formatter: 'number' }
]);

const columns = computed(() => [
  { key: 'submittedAt', label: t('forms.hubColSubmitted'), dataType: 'date', sortable: true },
  { key: 'submittedBy', label: t('forms.hubColSubmittedBy'), dataType: 'user', sortable: true },
  {
    key: 'executionStatus',
    label: t('forms.hubColExecution'),
    dataType: 'select',
    sortable: true,
    options: [
      { value: 'Not Started', label: t('forms.hubExecutionNotStarted') },
      { value: 'In Progress', label: t('forms.hubExecutionInProgress') },
      { value: 'Submitted', label: t('forms.hubExecutionSubmitted') }
    ]
  },
  {
    key: 'reviewStatus',
    label: t('forms.hubColReview'),
    dataType: 'select',
    sortable: true,
    options: [
      { value: 'Pending Corrective Action', label: t('forms.hubReviewPendingCorrective') },
      { value: 'Needs Auditor Review', label: t('forms.hubReviewNeedsAuditor') },
      { value: 'Approved', label: t('forms.auditorApproved') },
      { value: 'Rejected', label: t('forms.auditorRejected') },
      { value: 'Closed', label: t('forms.hubReviewClosed') }
    ]
  },
  { key: 'score', label: t('forms.hubColScore'), sortable: false },
  { key: 'kpis', label: t('forms.hubColKpis'), sortable: false },
  { key: 'linkedTo', label: t('forms.hubColLinkedTo'), sortable: false },
  {
    key: 'linkedToType',
    label: t('forms.hubColLinkedTo'),
    dataType: 'select',
    visible: true,
    showInTable: false,
    sortable: false,
    options: [
      { value: 'Organization', label: t('forms.settingsLinkOrganization') },
      { value: 'Deal', label: t('forms.settingsLinkDeal') },
      { value: 'Task', label: t('forms.settingsLinkTask') },
      { value: 'Event', label: t('forms.settingsLinkEvent') },
      { value: 'Lead', label: t('forms.hubLinkedLead') },
      { value: 'Contact', label: t('forms.hubLinkedContact') }
    ]
  },
  { key: 'fromDate', label: t('forms.hubFilterFromDate'), dataType: 'date', visible: true, showInTable: false, sortable: false },
  { key: 'toDate', label: t('forms.hubFilterToDate'), dataType: 'date', visible: true, showInTable: false, sortable: false }
]);

// Methods
const fetchForm = async () => {
  const formId = route.params.id;
  if (!formId) return;

  try {
    const response = await apiClient(`/forms/${formId}`, { method: 'GET' });
    if (response.success) {
      form.value = response.data.data || response.data;
    }
  } catch (error) {
    console.error('Error fetching form:', error);
  }
};

const fetchResponses = async () => {
  const formId = route.params.id;
  if (!formId) return;

  loading.value = true;
  try {
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.responsesPerPage,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value,
      ...filters.value
    };

    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    const response = await apiClient(`/forms/${formId}/responses`, {
      method: 'GET',
      params
    });

    if (response.success) {
      responses.value = Array.isArray(response.data) ? response.data : [];

      if (response.pagination) {
        pagination.value.totalResponses = response.pagination.totalResponses || 0;
        pagination.value.totalPages = response.pagination.totalPages || 1;
      }

      statistics.value = {
        total: pagination.value.totalResponses || 0,
        new: responses.value.filter(r => r.executionStatus === 'In Progress').length,
        approved: responses.value.filter(r => r.executionStatus === 'Submitted' && r.reviewStatus === 'Approved').length,
        needsAction: responses.value.filter(r =>
          r.executionStatus === 'Submitted' && (r.reviewStatus === 'Pending Corrective Action' || r.reviewStatus === 'Needs Auditor Review')
        ).length
      };
    } else {
      console.error('Failed to fetch responses:', response.message || 'Unknown error');
      responses.value = [];
      statistics.value = {
        total: 0,
        new: 0,
        approved: 0,
        needsAction: 0
      };
    }
  } catch (error) {
    console.error('Error fetching responses:', error);
    responses.value = [];
    statistics.value = {
      total: 0,
      new: 0,
      approved: 0,
      needsAction: 0
    };
  } finally {
    loading.value = false;
  }
};

const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  fetchResponses();
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchResponses();
};

const calculateOverallScore = (sectionScores) => {
  if (!sectionScores || typeof sectionScores !== 'object') return 0;

  const scores = Object.values(sectionScores).filter(s => typeof s === 'number');
  if (scores.length === 0) return 0;

  const sum = scores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / scores.length);
};

const viewResponseDetail = (response) => {
  openTab(`/forms/${route.params.id}/responses/${response._id}`, {
    name: `form-response-${response._id}`,
    title: `Response - ${formatUserDate(response.submittedAt)}`,
    component: 'FormResponseDetail',
    params: { formId: route.params.id, responseId: response._id },
    insertAdjacent: true
  });
  router.push(`/forms/${route.params.id}/responses/${response._id}`);
};

const approveResponse = async (response) => {
  if (!await confirmAction(t('forms.hubConfirmApprove'))) {
    return;
  }

  try {
    const result = await apiClient(`/forms/${route.params.id}/responses/${response._id}/approve`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error approving response:', error);
    notifications.error(t('forms.hubApproveFailed'));
  }
};

const rejectResponse = async (response) => {
  if (!await confirmAction(t('forms.hubConfirmReject'))) {
    return;
  }

  try {
    const result = await apiClient(`/forms/${route.params.id}/responses/${response._id}/reject`, {
      method: 'POST'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error rejecting response:', error);
    notifications.error(t('forms.hubRejectFailed'));
  }
};

const handleDelete = async (response) => {
  if (!await confirmAction(t('forms.hubConfirmDeleteResponse'))) {
    return;
  }

  try {
    const result = await apiClient(`/forms/${route.params.id}/responses/${response._id}`, {
      method: 'DELETE'
    });

    if (result.success) {
      await fetchResponses();
    }
  } catch (error) {
    console.error('Error deleting response:', error);
    notifications.error(t('forms.hubDeleteResponseFailed'));
  }
};

const exportResponses = async () => {
  try {
    const params = new URLSearchParams({
      ...filters.value,
      search: searchQuery.value
    });

    const authStore = useAuthStore();
    const token = authStore.user?.token;
    const response = await fetch(`/api/forms/${route.params.id}/responses/export?${params.toString()}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `form-responses-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } else {
      const errorData = await response.json();
      console.error('Error exporting responses:', errorData);
      notifications.error(t('forms.hubExportResponsesError', { detail: errorData.message || response.statusText }));
    }
  } catch (error) {
    console.error('Error exporting responses:', error);
    notifications.error(t('forms.hubExportResponsesFailed'));
  }
};

onMounted(async () => {
  await fetchForm();
  fetchResponses();
  if (route.params.id) {
    await fetchResponseSummary(route.params.id, { textPreviewLimit: 10 });
  }
});

watch(() => route.params.id, async (formId) => {
  await fetchForm();
  fetchResponses();
  if (formId) {
    await fetchResponseSummary(formId, { textPreviewLimit: 10 });
  }
});

watch(
  () => responseSummary.value?.overview?.totalResponses,
  (total) => {
    if (!isEngagementForm.value) {
      activeView.value = 'individual';
      return;
    }
    activeView.value = total > 0 ? 'summary' : 'individual';
  }
);
</script>
