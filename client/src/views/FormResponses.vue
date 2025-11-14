<template>
  <div class="mx-auto">
    <ListView
      :title="form?.name || 'Form Responses'"
      :description="form?.description || `Responses for ${form?.formId || 'this form'}`"
      module-key="forms"
      search-placeholder="Search responses..."
      :data="responses"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total Responses', key: 'total', formatter: 'number' },
        { name: 'New', key: 'new', formatter: 'number' },
        { name: 'Approved', key: 'approved', formatter: 'number' },
        { name: 'Needs Action', key: 'needsAction', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalResponses, limit: pagination.responsesPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :filter-config="filterConfig"
      table-id="form-responses-table"
      row-key="_id"
      empty-title="No responses yet"
      empty-message="This form hasn't received any responses yet"
      :hide-create="true"
      :hide-import="true"
      :hide-export="false"
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
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Anonymous</span>
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'New': 'default',
            'Pending Corrective Action': 'warning',
            'Needs Auditor Review': 'info',
            'Approved': 'success',
            'Rejected': 'danger',
            'Closed': 'default'
          }"
        />
      </template>

      <!-- Custom Score Cell -->
      <template #cell-score="{ row }">
        <div v-if="row.sectionScores && typeof row.sectionScores === 'object'" class="text-sm">
          <div class="text-gray-900 dark:text-white font-medium">
            {{ calculateOverallScore(row.sectionScores) }}%
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-400">
            {{ Object.keys(row.sectionScores).length }} section{{ Object.keys(row.sectionScores).length !== 1 ? 's' : '' }}
          </div>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom KPIs Cell -->
      <template #cell-kpis="{ row }">
        <div v-if="row.kpis && typeof row.kpis === 'object'" class="text-xs space-y-0.5">
          <div v-if="row.kpis.compliancePercentage !== undefined" class="text-gray-700 dark:text-gray-300">
            Compliance: {{ row.kpis.compliancePercentage }}%
          </div>
          <div v-if="row.kpis.avgRating !== undefined" class="text-gray-700 dark:text-gray-300">
            Rating: {{ row.kpis.avgRating }}/5
          </div>
          <div v-if="row.kpis.passRate !== undefined" class="text-gray-700 dark:text-gray-300">
            Pass Rate: {{ row.kpis.passRate }}%
          </div>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Linked To Cell -->
      <template #cell-linkedTo="{ row }">
        <div v-if="row.linkedTo && row.linkedTo.type" class="text-sm">
          <BadgeCell 
            :value="row.linkedTo.type" 
            :variant-map="{
              'Organization': 'info',
              'Deal': 'success',
              'Task': 'warning',
              'Event': 'primary',
              'Lead': 'default',
              'Contact': 'default'
            }"
          />
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            @click.stop="viewResponseDetail(row)"
            class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="View Details"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            v-if="row.status === 'New' || row.status === 'Needs Auditor Review'"
            @click.stop="approveResponse(row)"
            class="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Approve"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            v-if="row.status === 'New' || row.status === 'Needs Auditor Review'"
            @click.stop="rejectResponse(row)"
            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Reject"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            v-if="row.status === 'Pending Corrective Action'"
            @click.stop="viewResponseDetail(row)"
            class="p-1.5 text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
            title="Add Corrective Action"
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
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import DateCell from '@/components/common/table/DateCell.vue';

const route = useRoute();
const router = useRouter();
const { openTab } = useTabs();

// State
const form = ref(null);
const responses = ref([]);
const loading = ref(false);
const searchQuery = ref('');
const sortField = ref('submittedAt');
const sortOrder = ref('desc');
const filters = ref({
  status: '',
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

// Columns configuration
const columns = [
  { key: 'submittedAt', label: 'Submitted', sortable: true },
  { key: 'submittedBy', label: 'Submitted By', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'score', label: 'Score', sortable: false },
  { key: 'kpis', label: 'KPIs', sortable: false },
  { key: 'linkedTo', label: 'Linked To', sortable: false }
];

// Filter configuration
const filterConfig = computed(() => [
  {
    key: 'status',
    label: 'All Status',
    options: [
      { value: 'New', label: 'New' },
      { value: 'Pending Corrective Action', label: 'Pending Corrective Action' },
      { value: 'Needs Auditor Review', label: 'Needs Auditor Review' },
      { value: 'Approved', label: 'Approved' },
      { value: 'Rejected', label: 'Rejected' },
      { value: 'Closed', label: 'Closed' }
    ]
  },
  {
    key: 'linkedToType',
    label: 'Linked To',
    options: [
      { value: 'Organization', label: 'Organization' },
      { value: 'Deal', label: 'Deal' },
      { value: 'Task', label: 'Task' },
      { value: 'Event', label: 'Event' },
      { value: 'Lead', label: 'Lead' },
      { value: 'Contact', label: 'Contact' }
    ]
  },
  {
    key: 'fromDate',
    label: 'From Date',
    type: 'date'
  },
  {
    key: 'toDate',
    label: 'To Date',
    type: 'date'
  }
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

    // Remove empty filters
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
      
      // Handle pagination
      if (response.pagination) {
        pagination.value.totalResponses = response.pagination.totalResponses || 0;
        pagination.value.totalPages = response.pagination.totalPages || 1;
      }
      
      // Calculate statistics
      statistics.value = {
        total: responses.value.length,
        new: responses.value.filter(r => r.status === 'New').length,
        approved: responses.value.filter(r => r.status === 'Approved').length,
        needsAction: responses.value.filter(r => 
          r.status === 'Pending Corrective Action' || r.status === 'Needs Auditor Review'
        ).length
      };
    }
  } catch (error) {
    console.error('Error fetching responses:', error);
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
    title: `Response - ${new Date(response.submittedAt).toLocaleDateString()}`,
    component: 'FormResponseDetail',
    params: { formId: route.params.id, responseId: response._id }
  });
  router.push(`/forms/${route.params.id}/responses/${response._id}`);
};

const approveResponse = async (response) => {
  if (!confirm('Are you sure you want to approve this response?')) {
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
    alert('Failed to approve response. Please try again.');
  }
};

const rejectResponse = async (response) => {
  if (!confirm('Are you sure you want to reject this response?')) {
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
    alert('Failed to reject response. Please try again.');
  }
};

const handleDelete = async (response) => {
  if (!confirm(`Are you sure you want to delete this response?`)) {
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
    alert('Failed to delete response. Please try again.');
  }
};

const exportResponses = async () => {
  try {
    const params = new URLSearchParams({
      ...filters.value,
      search: searchQuery.value
    });
    
    const response = await fetch(`/api/forms/${route.params.id}/responses/export?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth')).user?.token}`
      }
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
      alert(`Error exporting responses: ${errorData.message || response.statusText}`);
    }
  } catch (error) {
    console.error('Error exporting responses:', error);
    alert('An error occurred during export.');
  }
};

// Lifecycle
onMounted(() => {
  fetchForm();
  fetchResponses();
});

// Watch for route changes
watch(() => route.params.id, () => {
  fetchForm();
  fetchResponses();
});
</script>
