<template>
  <div class="mx-auto">
    <ListView
      title="Forms"
      description="Create and manage forms, surveys, audits, and feedback"
      module-key="forms"
      create-label="New Form"
      search-placeholder="Search forms..."
      :data="forms"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total Forms', key: 'total', formatter: 'number' },
        { name: 'Active', key: 'active', formatter: 'number' },
        { name: 'Draft', key: 'draft', formatter: 'number' },
        { name: 'Total Responses', key: 'totalResponses', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalForms, limit: pagination.formsPerPage }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :filter-config="[
        {
          key: 'formType',
          label: 'All Types',
          options: [
            { value: 'Audit', label: 'Audit' },
            { value: 'Survey', label: 'Survey' },
            { value: 'Feedback', label: 'Feedback' },
            { value: 'Inspection', label: 'Inspection' },
            { value: 'Custom', label: 'Custom' }
          ]
        },
        {
          key: 'status',
          label: 'All Status',
          options: [
            { value: 'Draft', label: 'Draft' },
            { value: 'Active', label: 'Active' },
            { value: 'Closed', label: 'Closed' }
          ]
        },
        {
          key: 'assignedTo',
          label: 'All Assignees',
          options: [
            { value: 'me', label: 'My Forms' }
          ]
        }
      ]"
      table-id="forms-table"
      row-key="_id"
      empty-title="No forms yet"
      empty-message="Create your first form to get started"
      @create="openCreateForm"
      @import="showImportModal = true"
      @export="exportForms"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchForms(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.formsPerPage = p.limit || pagination.formsPerPage; fetchForms(); }"
      @fetch="fetchForms"
      @row-click="viewFormDetail"
      @edit="openFormBuilder"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Form ID Cell -->
      <template #cell-formId="{ value }">
        <span class="font-mono text-sm text-gray-600 dark:text-gray-400">{{ value }}</span>
      </template>

      <!-- Custom Form Type Cell with Badge -->
      <template #cell-formType="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Audit': 'warning',
            'Survey': 'info',
            'Feedback': 'success',
            'Inspection': 'danger',
            'Custom': 'default'
          }"
        />
      </template>

      <!-- Custom Status Cell with Badge -->
      <template #cell-status="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Draft': 'default',
            'Active': 'success',
            'Closed': 'danger'
          }"
        />
      </template>

      <!-- Custom Visibility Cell -->
      <template #cell-visibility="{ value }">
        <BadgeCell 
          :value="value" 
          :variant-map="{
            'Internal': 'default',
            'Partner': 'info',
            'Public': 'success'
          }"
        />
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName,
              lastName: row.assignedTo.lastName,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.assignedTo.firstName }} {{ row.assignedTo.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">Unassigned</span>
      </template>

      <!-- Custom Sections Count -->
      <template #cell-sections="{ row }">
        <span class="text-sm text-gray-700 dark:text-gray-300">
          {{ row.sections?.length || 0 }} section{{ (row.sections?.length || 0) !== 1 ? 's' : '' }}
        </span>
      </template>

      <!-- Custom Public Link Cell -->
      <template #cell-publicLink="{ row }">
        <div v-if="row.publicLink?.enabled" class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4 text-green-600 dark:text-green-400">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-xs text-gray-600 dark:text-gray-400">Public</span>
        </div>
        <span v-else class="text-xs text-gray-400 dark:text-gray-500">Private</span>
      </template>

      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            @click.stop="viewFormDetail(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="View Form Details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            @click.stop="openFormBuilder(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Edit Form"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            @click.stop="duplicateForm(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Duplicate Form"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            @click.stop="viewResponses(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="View Responses"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>

    <!-- Import Modal -->
    <UniversalImportModal
      v-if="showImportModal"
      :show="showImportModal"
      module="forms"
      @close="showImportModal = false"
      @imported="handleImportSuccess"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onActivated, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import UniversalImportModal from '@/components/import/UniversalImportModal.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const { openTab } = useTabs();

// State
const forms = ref([]);
const loading = ref(false);
const showImportModal = ref(false);
const searchQuery = ref('');
const sortField = ref('createdAt');
const sortOrder = ref('desc');
const filters = ref({
  formType: '',
  status: '',
  assignedTo: ''
});

const pagination = ref({
  currentPage: 1,
  formsPerPage: 25,
  totalForms: 0,
  totalPages: 1
});

const statistics = ref({
  total: 0,
  active: 0,
  draft: 0,
  totalResponses: 0
});

// Columns configuration
const columns = [
  { key: 'formId', label: 'Form ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  { key: 'formType', label: 'Type', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'visibility', label: 'Visibility', sortable: true },
  { key: 'sections', label: 'Sections', sortable: false },
  { key: 'assignedTo', label: 'Assigned To', sortable: true },
  { key: 'publicLink', label: 'Public', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: true }
];

// Methods
const fetchForms = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.formsPerPage,
      sortBy: sortField.value,
      sortOrder: sortOrder.value,
      search: searchQuery.value,
      ...filters.value
    };

    // Remove empty filters
    Object.keys(params).forEach(key => {
      if (params[key] === '' || params[key] === null) {
        delete params[key];
      }
    });

    const response = await apiClient('/forms', {
      method: 'GET',
      params
    });

    if (response.success) {
      // Backend returns: { success: true, data: forms[], pagination: {...}, statistics: {...} }
      // response.data is the array of forms directly
      forms.value = Array.isArray(response.data) ? response.data : [];
      
      // Handle pagination
      if (response.pagination) {
        pagination.value.totalForms = response.pagination.totalForms || 0;
        pagination.value.totalPages = response.pagination.totalPages || 1;
      }
      
      // Handle statistics
      if (response.statistics) {
        statistics.value = {
          total: response.statistics.totalForms || 0,
          active: response.statistics.activeForms || 0,
          draft: response.statistics.draftForms || 0,
          totalResponses: response.statistics.totalResponses || 0
        };
      } else {
        // Fallback: calculate from forms array
        statistics.value = {
          total: forms.value.length,
          active: forms.value.filter(f => f.status === 'Active').length,
          draft: forms.value.filter(f => f.status === 'Draft').length,
          totalResponses: 0
        };
      }
    }
  } catch (error) {
    console.error('Error fetching forms:', error);
  } finally {
    loading.value = false;
  }
};

const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  fetchForms();
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchForms();
};

const openCreateForm = () => {
  openTab('/forms/builder', {
    name: 'form-builder',
    title: 'New Form',
    component: 'FormBuilder',
    params: { formId: null }
  });
  router.push('/forms/builder');
};

const openFormBuilder = (form) => {
  openTab(`/forms/builder/${form._id}`, {
    name: `form-builder-${form._id}`,
    title: form.name || 'Form Builder',
    component: 'FormBuilder',
    params: { formId: form._id }
  });
  router.push(`/forms/builder/${form._id}`);
};

const duplicateForm = async (form) => {
  try {
    const response = await apiClient(`/forms/${form._id}/duplicate`, {
      method: 'POST'
    });

    if (response.success) {
      await fetchForms();
      // Optionally open the duplicated form
      openFormBuilder(response.data.data);
    }
  } catch (error) {
    console.error('Error duplicating form:', error);
  }
};

const viewFormDetail = (form) => {
  openTab(`/forms/${form._id}/detail`, {
    name: `form-detail-${form._id}`,
    title: form.name || 'Form Details',
    icon: 'clipboard-document'
  });
  router.push(`/forms/${form._id}/detail`);
};

const viewResponses = (form) => {
  openTab(`/forms/${form._id}/responses`, {
    name: `form-responses-${form._id}`,
    title: `${form.name} - Responses`,
    component: 'FormResponses',
    params: { formId: form._id }
  });
  router.push(`/forms/${form._id}/responses`);
};

const handleDelete = async (form) => {
  if (!confirm(`Are you sure you want to delete "${form.name}"?`)) {
    return;
  }

  try {
    const response = await apiClient(`/forms/${form._id}`, {
      method: 'DELETE'
    });

    if (response.success) {
      await fetchForms();
    }
  } catch (error) {
    console.error('Error deleting form:', error);
  }
};

const handleBulkAction = async (action, selectedRows) => {
  // Handle bulk actions (delete, export, etc.)
  console.log('Bulk action:', action, selectedRows);
};

const exportForms = async () => {
  try {
    const response = await fetch(`/api/forms/export?${new URLSearchParams(filters.value).toString()}`, {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `forms-export-${new Date().toISOString()}.csv`;
      a.click();
    }
  } catch (error) {
    console.error('Error exporting forms:', error);
  }
};

const handleImportSuccess = () => {
  showImportModal.value = false;
  fetchForms();
};

// Lifecycle
onMounted(() => {
  fetchForms();
});

// Refresh forms when tab becomes active (if using KeepAlive)
onActivated(() => {
  fetchForms();
});

// Watch for route changes to refresh forms list
watch(() => route.path, (newPath) => {
  if (newPath === '/forms') {
    fetchForms();
  }
});
</script>

