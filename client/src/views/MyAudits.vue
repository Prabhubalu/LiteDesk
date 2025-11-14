<template>
  <div class="mx-auto">
    <ListView
      title="My Audits"
      description="Forms assigned to you via events for auditing"
      module-key="forms"
      search-placeholder="Search audits..."
      :data="audits"
      :columns="columns"
      :loading="loading"
      :statistics="statistics"
      :stats-config="[
        { name: 'Total Assigned', key: 'total', formatter: 'number' },
        { name: 'Pending', key: 'pending', formatter: 'number' },
        { name: 'Completed', key: 'completed', formatter: 'number' },
        { name: 'Overdue', key: 'overdue', formatter: 'number' }
      ]"
      :pagination="{ currentPage: pagination.currentPage, totalPages: pagination.totalPages, totalRecords: pagination.totalRecords, limit: pagination.limit }"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :filter-config="filterConfig"
      table-id="my-audits-table"
      row-key="eventId"
      empty-title="No audits assigned"
      empty-message="You don't have any audits assigned to you yet"
      :hide-create="true"
      :hide-import="true"
      :hide-export="false"
      @update:searchQuery="handleSearchQueryUpdate"
      @update:filters="(newFilters) => { Object.assign(filters, newFilters); fetchAudits(); }"
      @update:sort="({ sortField: key, sortOrder: order }) => { handleSort({ key, order }); }"
      @update:pagination="(p) => { pagination.currentPage = p.currentPage; pagination.limit = p.limit || pagination.limit; fetchAudits(); }"
      @fetch="fetchAudits"
      @row-click="viewAudit"
      @edit="viewAudit"
    >
      <!-- Custom Form Name Cell -->
      <template #cell-formName="{ row }">
        <div class="flex flex-col">
          <span class="font-medium text-gray-900 dark:text-white">{{ row.formName }}</span>
          <span class="text-xs text-gray-500 dark:text-gray-400">{{ row.eventTitle }}</span>
        </div>
      </template>

      <!-- Custom Form Type Cell -->
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

      <!-- Custom Due Date Cell -->
      <template #cell-dueDate="{ value, row }">
        <div class="flex flex-col">
          <DateCell :value="value" format="short" />
          <span
            v-if="isOverdue(value)"
            class="text-xs text-red-600 dark:text-red-400 font-medium mt-1"
          >
            Overdue
          </span>
          <span
            v-else-if="isDueToday(value)"
            class="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1"
          >
            Due Today
          </span>
        </div>
      </template>

      <!-- Custom Status Cell -->
      <template #cell-status="{ row }">
        <div class="flex flex-col gap-1">
          <BadgeCell
            :value="row.existingResponse ? 'Completed' : 'Pending'"
            :variant-map="{
              'Completed': 'success',
              'Pending': 'warning'
            }"
          />
          <span v-if="row.existingResponse" class="text-xs text-gray-500 dark:text-gray-400">
            Score: {{ row.existingResponse.kpis?.finalScore || 'N/A' }}%
          </span>
        </div>
      </template>

      <!-- Custom Assigned By Cell -->
      <template #cell-assignedBy="{ row }">
        <div v-if="row.assignedBy" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedBy.firstName,
              lastName: row.assignedBy.lastName,
              avatar: row.assignedBy.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-900 dark:text-white">
            {{ row.assignedBy.firstName }} {{ row.assignedBy.lastName }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">N/A</span>
      </template>

      <!-- Custom Actions -->
      <template #row-actions="{ row }">
        <div class="flex items-center gap-2">
          <button
            v-if="row.canStart"
            @click.stop="startAudit(row)"
            class="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
            title="Start Audit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            v-if="row.existingResponse"
            @click.stop="viewResponse(row)"
            class="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
            title="View Response"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            @click.stop="viewFormDetail(row)"
            class="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="View Form Details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>
      </template>
    </ListView>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onActivated, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ListView from '@/components/common/ListView.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import Avatar from '@/components/common/Avatar.vue';

const router = useRouter();
const route = useRoute();
const { openTab } = useTabs();

const audits = ref([]);
const loading = ref(false);
const searchQuery = ref('');

const filters = reactive({
  status: '',
  dueDate: ''
});

const pagination = ref({
  currentPage: 1,
  totalPages: 1,
  totalRecords: 0,
  limit: 20
});

const sortField = ref('dueDate');
const sortOrder = ref('asc');

const statistics = ref({
  total: 0,
  pending: 0,
  completed: 0,
  overdue: 0
});

const filterConfig = computed(() => [
  {
    key: 'status',
    label: 'All Status',
    options: [
      { value: '', label: 'All Status' },
      { value: 'scheduled', label: 'Scheduled' },
      { value: 'completed', label: 'Completed' },
      { value: 'cancelled', label: 'Cancelled' }
    ]
  },
  {
    key: 'dueDate',
    label: 'Due Date',
    options: [
      { value: '', label: 'All Dates' },
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Due Today' },
      { value: 'upcoming', label: 'Upcoming' }
    ]
  }
]);

const columns = computed(() => [
  { key: 'formName', label: 'Form / Event', sortable: true, minWidth: '250px' },
  { key: 'formType', label: 'Type', sortable: true, minWidth: '120px' },
  { key: 'dueDate', label: 'Due Date', sortable: true, minWidth: '140px' },
  { key: 'status', label: 'Status', sortable: false, minWidth: '120px' },
  { key: 'assignedBy', label: 'Assigned By', sortable: false, minWidth: '180px' }
]);

const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
};

const isDueToday = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate).toDateString() === new Date().toDateString();
};

const fetchAudits = async () => {
  try {
    loading.value = true;
    const params = {
      page: pagination.value.currentPage,
      limit: pagination.value.limit,
      ...filters
    };

    if (searchQuery.value) {
      params.search = searchQuery.value;
    }

    const response = await apiClient('/forms/my-audits', {
      method: 'GET',
      params
    });

    if (response.success) {
      audits.value = response.data || [];
      pagination.value.currentPage = response.pagination?.currentPage || 1;
      pagination.value.totalPages = response.pagination?.totalPages || 1;
      pagination.value.totalRecords = response.pagination?.totalRecords || 0;
      pagination.value.limit = response.pagination?.limit || 20;

      // Calculate statistics
      statistics.value = {
        total: audits.value.length,
        pending: audits.value.filter(a => !a.existingResponse).length,
        completed: audits.value.filter(a => a.existingResponse).length,
        overdue: audits.value.filter(a => isOverdue(a.dueDate)).length
      };
    }
  } catch (error) {
    console.error('Error fetching audits:', error);
    audits.value = [];
  } finally {
    loading.value = false;
  }
};

const handleSearchQueryUpdate = (query) => {
  searchQuery.value = query;
  pagination.value.currentPage = 1;
  fetchAudits();
};

const handleSort = ({ key, order }) => {
  sortField.value = key;
  sortOrder.value = order;
  fetchAudits();
};

const startAudit = (audit) => {
  // Open public form view or form builder for submission
  if (audit.formId) {
    // Check if form has public link, otherwise open form builder
    openTab(`/forms/builder/${audit.formId}`, {
      title: `Audit: ${audit.formName}`,
      icon: 'clipboard-document'
    });
    router.push(`/forms/builder/${audit.formId}`);
  }
};

const viewResponse = (audit) => {
  if (audit.existingResponse && audit.formId) {
    openTab(`/forms/${audit.formId}/responses/${audit.existingResponse._id}`, {
      title: `Response: ${audit.formName}`,
      icon: 'clipboard-document'
    });
    router.push(`/forms/${audit.formId}/responses/${audit.existingResponse._id}`);
  }
};

const viewFormDetail = (audit) => {
  if (audit.formId) {
    openTab(`/forms/${audit.formId}/detail`, {
      title: audit.formName,
      icon: 'clipboard-document'
    });
    router.push(`/forms/${audit.formId}/detail`);
  }
};

const viewAudit = (audit) => {
  if (audit.existingResponse) {
    viewResponse(audit);
  } else {
    startAudit(audit);
  }
};

onMounted(() => {
  fetchAudits();
});

onActivated(() => {
  // Refresh when tab becomes active
  if (route.path === '/forms/my-audits') {
    fetchAudits();
  }
});

watch(() => route.path, () => {
  if (route.path === '/forms/my-audits') {
    fetchAudits();
  }
});
</script>

