<template>
  <div class="mx-auto w-full">
    <!-- App participation (tabs) -->
    <div class="mb-4">
      <nav
        class="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        :aria-label="t('records.genericAppParticipation')"
      >
        <button
          v-for="opt in contextOptions"
          :key="opt.value"
          type="button"
          role="tab"
          :aria-selected="peopleContext === opt.value"
          class="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 rounded-t-md"
          :class="
            peopleContext === opt.value
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-300'
              : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100'
          "
          @click="peopleContext = opt.value"
        >
          {{ opt.label }}
        </button>
      </nav>
    </div>

    <!-- Registry-Driven ModuleList -->
    <ModuleList
      ref="moduleListRef"
      module-key="people"
      app-key="PLATFORM"
      :people-context="peopleContext"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportContacts"
      @row-click="handleRowClick"
      @edit="editContact"
      @delete="handleInlineDelete"
      @bulk-action="handleBulkAction"
    >
      <!-- Custom Name Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :user="{
              firstName: row.first_name,
              lastName: row.last_name,
              avatar: row.avatar || row.image
            }"
            size="md"
          />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-gray-900 dark:text-white truncate">
              {{ row.first_name }} {{ row.last_name }}
            </div>
            <div
              v-if="row.email"
              class="text-sm text-gray-500 dark:text-gray-400 truncate"
            >
              {{ row.email }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Organization Cell -->
      <template #cell-organization="{ row }">
        <span class="font-medium text-gray-900 dark:text-white">
          <template v-if="row.organization && typeof row.organization === 'object' && row.organization.name">
            {{ row.organization.name }}
          </template>
          <template v-else-if="row.organization && typeof row.organization === 'string'">
            {{ row.organization }}
          </template>
          <template v-else>
            <span class="text-gray-400 dark:text-gray-500">-</span>
          </template>
        </span>
      </template>

      <!-- Custom Email Cell -->
      <template #cell-email="{ value }">
        <a
          :href="`mailto:${value}`"
          class="block min-w-0 truncate text-indigo-600 dark:text-indigo-400 hover:underline"
          @click.stop
        >
          {{ value }}
        </a>
      </template>

      <!-- Custom Phone Cell -->
      <template #cell-phone="{ row }">
        <span class="text-gray-700 dark:text-gray-300">{{ row.phone || row.mobile || '-' }}</span>
      </template>

      <!-- Custom Owner Cell -->
      <template #cell-owner_id="{ row }">
        <div v-if="row.owner_id" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.owner_id.firstName || row.owner_id.first_name,
              lastName: row.owner_id.lastName || row.owner_id.last_name,
              email: row.owner_id.email,
              avatar: row.owner_id.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.owner_id) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <!-- Custom Assigned To Cell -->
      <template #cell-assignedTo="{ row }">
        <div v-if="row.assignedTo" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.assignedTo.firstName || row.assignedTo.first_name,
              lastName: row.assignedTo.lastName || row.assignedTo.last_name,
              email: row.assignedTo.email,
              avatar: row.assignedTo.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">{{ getUserDisplayName(row.assignedTo) }}</span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <!-- Custom Lifecycle Stage Cell with Badge -->
      <template #cell-lifecycle_stage="{ value }">
        <BadgeCell 
          :value="value || 'Lead'" 
          :variant-map="{
            'Lead': 'warning',
            'Qualified': 'info',
            'Opportunity': 'primary',
            'Customer': 'success',
            'Lost': 'danger'
          }"
        />
      </template>

      <!-- Custom Last Contact Cell -->
      <template #cell-last_contacted_at="{ value }">
        <DateCell :value="value" format="short" />
      </template>

      <!-- Participation column (canonical key sales_type; cell-type = legacy saved layouts) -->
      <template #cell-sales_type="{ row }">
        <PeopleListParticipationTypeCell
          :row="row"
          :people-context="peopleContext"
          :badge-options-by-app="participationBadgeOptionsByApp"
          :role-badge-variant-map="roleBadgeVariantMap"
        />
      </template>
      <template #cell-type="{ row }">
        <PeopleListParticipationTypeCell
          :row="row"
          :people-context="peopleContext"
          :badge-options-by-app="participationBadgeOptionsByApp"
          :role-badge-variant-map="roleBadgeVariantMap"
        />
      </template>

      <!-- Participation-aware rendering for SALES participation fields -->
      <!-- Lead Status (SALES participation field) -->
      <template #cell-lead_status="{ row, value }">
        <span v-if="getParticipationAwareCellValue('lead_status', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <BadgeCell v-else :value="value" :options="leadStatusPicklistOptions" />
      </template>

      <!-- Contact Status (SALES participation field) -->
      <template #cell-contact_status="{ row, value }">
        <span v-if="getParticipationAwareCellValue('contact_status', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <BadgeCell v-else :value="value" :options="contactStatusPicklistOptions" />
      </template>

      <!-- Lead Owner (SALES participation field) -->
      <template #cell-lead_owner="{ row, value }">
        <span v-if="getParticipationAwareCellValue('lead_owner', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>

      <!-- Lead Score (SALES participation field) -->
      <template #cell-lead_score="{ row, value }">
        <span v-if="getParticipationAwareCellValue('lead_score', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>

      <!-- Interest Products (SALES participation field) -->
      <template #cell-interest_products="{ row, value }">
        <span v-if="getParticipationAwareCellValue('interest_products', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>

      <!-- Qualification Date (SALES participation field) -->
      <template #cell-qualification_date="{ row, value }">
        <template v-if="getParticipationAwareCellValue('qualification_date', row, value) === '-'">
          <span class="text-gray-400 dark:text-gray-500">-</span>
        </template>
        <DateCell v-else :value="value" format="short" />
      </template>

      <!-- Qualification Notes (SALES participation field) -->
      <template #cell-qualification_notes="{ row, value }">
        <span v-if="getParticipationAwareCellValue('qualification_notes', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>

      <!-- Estimated Value (SALES participation field) -->
      <template #cell-estimated_value="{ row, value }">
        <span v-if="getParticipationAwareCellValue('estimated_value', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value ? `$${value}` : '-' }}</span>
      </template>

      <!-- Role (SALES participation field) -->
      <template #cell-role="{ row, value }">
        <span v-if="getParticipationAwareCellValue('role', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>

      <!-- Birthday (SALES participation field) -->
      <template #cell-birthday="{ row, value }">
        <template v-if="getParticipationAwareCellValue('birthday', row, value) === '-'">
          <span class="text-gray-400 dark:text-gray-500">-</span>
        </template>
        <DateCell v-else :value="value" format="short" />
      </template>

      <!-- Preferred Contact Method (SALES participation field) -->
      <template #cell-preferred_contact_method="{ row, value }">
        <span v-if="getParticipationAwareCellValue('preferred_contact_method', row, value) === '-'" class="text-gray-400 dark:text-gray-500">-</span>
        <span v-else class="text-gray-900 dark:text-white">{{ value || '-' }}</span>
      </template>
    </ModuleList>

    <!-- Quick Create Drawer (context-aware: AppSection when peopleContext is an app) -->
    <PeopleQuickCreateDrawer
      :isOpen="showQuickCreate"
      :context-app-key="peopleContext === 'ALL' ? null : peopleContext"
      :optional-app-participation="peopleContext === 'ALL'"
      @close="handlePeopleDrawerClose"
      @saved="handlePersonCreated"
    />

    <!-- Edit drawer (list row actions) -->
    <CreateRecordDrawer
      :isOpen="showEditDrawer"
      module-key="people"
      :record="editingContact"
      @close="closeEditDrawer"
      @saved="handleContactSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal 
      v-if="showImportModal"
      entity-type="Contacts"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onActivated, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import DateCell from '@/components/common/table/DateCell.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import PeopleQuickCreateDrawer from '@/components/people/PeopleQuickCreateDrawer.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import Avatar from '@/components/common/Avatar.vue';
import { getFieldMetadata } from '@/platform/fields/peopleFieldModel';
import { getParticipation } from '@/utils/getParticipation';
import { getAppLabel } from '@/utils/getRoleDisplay';
import PeopleListParticipationTypeCell from '@/components/people/PeopleListParticipationTypeCell.vue';
import { usePeopleTypes } from '@/composables/usePeopleTypes';
import { usePeopleModuleFields } from '@/composables/usePeopleModuleFields';
import { typeDefsToBadgeOptions } from '@/utils/peopleTypeColors';
import {
  findPeopleModuleField,
  getPeopleModuleFieldOptionsWithDefaults,
} from '@/utils/peopleModuleFieldUtils';
import { APP_NAME_KEYS } from '@/utils/navigationLabels';

const router = useRouter();
const { t, te } = useI18n();
const authStore = useAuthStore();
const { openTab } = useTabs();

/** @type {import('vue').Ref<'ALL' | 'SALES' | 'HELPDESK'>} */
const peopleContext = ref('ALL');

const contextOptions = computed(() => [
  { label: t('people.contextAllApps'), value: 'ALL' },
  {
    label: te(APP_NAME_KEYS.SALES) ? t(APP_NAME_KEYS.SALES) : getAppLabel('SALES'),
    value: 'SALES',
  },
  {
    label: te(APP_NAME_KEYS.HELPDESK) ? t(APP_NAME_KEYS.HELPDESK) : getAppLabel('HELPDESK'),
    value: 'HELPDESK',
  },
]);

const { typeDefs: salesPeopleTypeDefs } = usePeopleTypes('SALES');
const { typeDefs: helpdeskPeopleTypeDefs } = usePeopleTypes('HELPDESK');
const { fields: peopleModuleFields } = usePeopleModuleFields();

const leadStatusPicklistOptions = computed(() =>
  getPeopleModuleFieldOptionsWithDefaults(findPeopleModuleField(peopleModuleFields.value, 'lead_status'))
);
const contactStatusPicklistOptions = computed(() =>
  getPeopleModuleFieldOptionsWithDefaults(findPeopleModuleField(peopleModuleFields.value, 'contact_status'))
);

const participationBadgeOptionsByApp = computed(() => ({
  SALES: typeDefsToBadgeOptions(salesPeopleTypeDefs.value),
  HELPDESK: typeDefsToBadgeOptions(helpdeskPeopleTypeDefs.value)
}));

watch(peopleContext, () => {
  if (moduleListRef.value?.refresh) {
    moduleListRef.value.refresh();
  }
});

// State
const moduleListRef = ref(null);
const showQuickCreate = ref(false);
const showEditDrawer = ref(false);
const showImportModal = ref(false);
const editingContact = ref(null);
const deleting = ref(false);

// User management (for display names)
const usersById = ref({});
const usersLoaded = ref(false);

const upsertUsers = (users) => {
  if (!Array.isArray(users)) return;
  const map = { ...usersById.value };
  for (const user of users) {
    if (!user || typeof user !== 'object') continue;
    const id = user._id || user.id;
    if (!id) continue;
    map[id] = { ...user, _id: id };
  }
  usersById.value = map;
};

const loadUsers = async () => {
  if (usersLoaded.value && Object.keys(usersById.value).length > 0) {
    return;
  }

  try {
    const response = await apiClient.get('/users/list');
    let users = [];
    if (Array.isArray(response)) {
      users = response;
    } else if (Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.success && Array.isArray(response?.data)) {
      users = response.data;
    } else if (response?.data && Array.isArray(response.data.users)) {
      users = response.data.users;
    } else if (response?.data && Array.isArray(response.data.data)) {
      users = response.data.data;
    }

    if (users.length > 0) {
      upsertUsers(users);
    }
  } catch (error) {
    console.error('Error loading users for People list:', error);
  } finally {
    usersLoaded.value = true;
  }
};

const getUserDisplayName = (user) => {
  if (!user) return 'Unassigned';
  if (typeof user === 'string') {
    const cached = usersById.value[user];
    if (cached) {
      return getUserDisplayName(cached);
    }
    return user;
  }
  const firstName = user.firstName || user.first_name || user.name || '';
  const lastName = user.lastName || user.last_name || '';
  const combined = `${firstName} ${lastName}`.trim();
  if (combined) return combined;
  if (user.email) return user.email;
  if (user.username) return user.username;
  if (user._id && usersById.value[user._id]) {
    return getUserDisplayName(usersById.value[user._id]);
  }
  return 'Unassigned';
};

// Event handlers
const getPersonDisplayName = (row) => {
  if (!row) return null;
  const first = (row.first_name ?? row.firstName ?? '').trim();
  const last = (row.last_name ?? row.lastName ?? '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || row.name || row.email || null;
};

const handleRowClick = (row, event = null) => {
  // Navigate to PeopleSurface only (no edit/delete from list)
  viewContact(row._id, event, row);
};

const roleBadgeVariantMap = {
  Lead: 'warning',
  Contact: 'success',
  Qualified: 'info',
  Opportunity: 'primary',
  Customer: 'success',
  Lost: 'danger'
};

const getParticipatingApps = (row) => {
  const apps = [];
  const salesPart = getParticipation(row, 'SALES');
  if (salesPart) {
    apps.push(getAppLabel('SALES'));
  }
  
  if (getParticipation(row, 'HELPDESK')) {
    apps.push(getAppLabel('HELPDESK'));
  }
  
  // Check for AUDIT participation
  if (row.audit_member_id || row.audit_role) {
    apps.push('Audit');
  }
  
  // Check for PORTAL participation
  if (row.portal_user_id || row.portal_access) {
    apps.push('Portal');
  }
  
  // Check for PROJECTS participation
  if (row.project_member_id || row.project_role) {
    apps.push('Projects');
  }
  
  return apps;
};

/**
 * Check if a person participates in a specific app
 * @param {Object} row - Person record
 * @param {String} appKey - App key (e.g., 'SALES', 'HELPDESK')
 * @returns {Boolean} - True if person participates in the app
 */
const participatesInApp = (row, appKey) => {
  const appKeyUpper = appKey?.toUpperCase();
  
  switch (appKeyUpper) {
    case 'SALES':
      return getParticipation(row, 'SALES') != null;
    case 'HELPDESK':
      return getParticipation(row, 'HELPDESK') != null;
    case 'AUDIT':
      return !!(row.audit_member_id || row.audit_role);
    case 'PORTAL':
      return !!(row.portal_user_id || row.portal_access);
    case 'PROJECTS':
      return !!(row.project_member_id || row.project_role);
    default:
      return false;
  }
};

/**
 * Get participation-aware cell value for a field
 * For participation fields, returns "-" if person doesn't participate in that app
 * Otherwise returns the actual value
 * @param {String} fieldKey - Field key (e.g., 'sales_type', 'lead_status')
 * @param {Object} row - Person record
 * @param {*} rawValue - Raw field value from row
 * @returns {*} - Value to display ("-" if not participating, otherwise rawValue)
 */
const getParticipationAwareCellValue = (fieldKey, row, rawValue) => {
  // Get field metadata to check if it's a participation field
  try {
    const metadata = getFieldMetadata(fieldKey);
    
    // Only apply participation check for participation fields
    if (metadata.owner === 'participation') {
      const fieldScope = metadata.fieldScope; // e.g., 'SALES', 'HELPDESK'
      
      // Check if person participates in the app that owns this field
      if (!participatesInApp(row, fieldScope)) {
        // Person doesn't participate - return "-" (don't show value)
        return '-';
      }
    }
    
    // For core/system fields, or if person participates, return raw value
    return rawValue;
  } catch (error) {
    // Field not in metadata - treat as non-participation field, return raw value
    return rawValue;
  }
};

const viewContact = (contactId, event = null, row = null) => {
  const title = getPersonDisplayName(row) || 'Person';
  
  const openInBackground = event && (
    event.button === 1 ||
    event.metaKey ||
    event.ctrlKey
  );

  const ctx = peopleContext.value;
  const path =
    ctx === 'SALES' || ctx === 'HELPDESK'
      ? `/people/${contactId}?context=${ctx}`
      : `/people/${contactId}`;

  openTab(path, {
    title,
    icon: 'users',
    params: { name: title },
    background: openInBackground,
    insertAdjacent: true
  });
};

const openCreateModal = () => {
  // Open local drawer with current context (AppSection when peopleContext is an app)
  showQuickCreate.value = true;
};

const editContact = (contact) => {
  if (!contact) return;
  editingContact.value = contact;
  showEditDrawer.value = true;
};

const closeEditDrawer = () => {
  showEditDrawer.value = false;
  editingContact.value = null;
};

const handleContactSaved = () => {
  closeEditDrawer();
  if (moduleListRef.value?.refresh) {
    moduleListRef.value.refresh();
  }
};

const handlePeopleDrawerClose = () => {
  showQuickCreate.value = false;
};

const handlePersonCreated = () => {
  showQuickCreate.value = false;
  // Refresh ModuleList
  if (moduleListRef.value && moduleListRef.value.refresh) {
    moduleListRef.value.refresh();
  }
};

const handleImportComplete = () => {
  showImportModal.value = false;
  // Refresh ModuleList
  if (moduleListRef.value && moduleListRef.value.refresh) {
    moduleListRef.value.refresh();
  }
};

// Handle record creation events to refresh list view
const handleRecordCreated = (event) => {
  const { moduleKey, record } = event.detail || {};
  
  // Only refresh if it's a people record
  if (moduleKey === 'people') {
    if (moduleListRef.value && moduleListRef.value.refresh) {
      moduleListRef.value.refresh();
    }
  }
};

// Bulk action handler
const handleBulkAction = async (actionId, selectedRows) => {
  if (actionId === 'delete' || actionId === 'bulk-delete') {
    await bulkDeletePeople(selectedRows);
  } else if (actionId === 'export' || actionId === 'bulk-export') {
    await bulkExportPeople(selectedRows);
  }
};

const handleInlineDelete = async (row) => {
  if (!row) return;
  await bulkDeletePeople([row]);
};

// Bulk delete - identity-level only
const bulkDeletePeople = async (selectedRows) => {
  if (!selectedRows || selectedRows.length === 0) return;
  
  const idsToDelete = selectedRows.map(row => row._id || row).filter(Boolean);
  if (idsToDelete.length === 0) return;
  
  try {
    deleting.value = true;
    
    // Delete all in parallel, fail fast on permission errors
    const deletePromises = idsToDelete.map(id => 
      apiClient.delete(`/people/${id}`)
    );
    
    const results = await Promise.allSettled(deletePromises);
    
    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      const firstFailure = failures[0].reason;
      const errorMessage = firstFailure?.response?.data?.message || 
                          firstFailure?.message || 
                          'Failed to delete some people';
      
      // If permission error, show specific message
      if (firstFailure?.response?.status === 403) {
        alert(`Permission denied: ${errorMessage}`);
      } else {
        alert(`Failed to delete ${failures.length} of ${idsToDelete.length} people. ${errorMessage}`);
      }
      
      // Don't reload if some failed - let user see what succeeded
      return;
    }
    
    // All succeeded - refresh list
    if (moduleListRef.value?.refresh) {
      moduleListRef.value.refresh();
    }
  } catch (error) {
    console.error('Error bulk deleting people:', error);
    alert(`Error deleting people: ${error.message || t('common.peopleToastUnknownError')}`);
  } finally {
    deleting.value = false;
  }
};

// Bulk export - identity fields only
const bulkExportPeople = async (selectedRows) => {
  if (!selectedRows || selectedRows.length === 0) return;
  
  try {
    // Extract identity fields only (core + system fields, no participation)
    const identityFields = [
      'first_name', 'last_name', 'email', 'phone', 'mobile',
      'organization', 'assignedTo', 'tags', 'createdAt', 'updatedAt'
    ];
    
    const csvRows = [];
    
    // Header row
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Mobile', 'Organization', 'Tags', 'Created At', 'Updated At'];
    csvRows.push(headers.join(','));
    
    // Data rows
    selectedRows.forEach(row => {
      const orgName = row.organization && typeof row.organization === 'object' 
        ? row.organization.name || ''
        : row.organization || '';
      
      const tags = Array.isArray(row.tags) ? row.tags.join('; ') : '';
      const createdAt = row.createdAt ? new Date(row.createdAt).toISOString() : '';
      const updatedAt = row.updatedAt ? new Date(row.updatedAt).toISOString() : '';
      
      const rowData = [
        escapeCsv(row.first_name || ''),
        escapeCsv(row.last_name || ''),
        escapeCsv(row.email || ''),
        escapeCsv(row.phone || ''),
        escapeCsv(row.mobile || ''),
        escapeCsv(orgName),
        escapeCsv(tags),
        createdAt,
        updatedAt
      ];
      
      csvRows.push(rowData.join(','));
    });
    
    // Create and download CSV
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `people_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error bulk exporting people:', error);
    alert(t('common.peopleToastErrorExportingPeoplePleaseTry'));
  }
};

// Helper to escape CSV values
const escapeCsv = (value) => {
  if (value == null || value === '') return '';
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const exportContacts = async () => {
  try {
    const response = await fetch('/api/csv/export/contacts', {
      headers: {
        'Authorization': `Bearer ${authStore.user?.token}`
      }
    });
    
    if (!response.ok) throw new Error('Export failed');
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting contacts:', error);
    alert(t('common.peopleToastErrorExportingContactsPleaseTry'));
  }
};

// Lifecycle
onMounted(async () => {
  await loadUsers();
  
  // Listen for record creation events
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:record-created', handleRecordCreated);
  }
});

// Keep-alive tab return: restore scroll + lazy-loaded pages (no full refetch)
onActivated(() => {
  nextTick(() => {
    moduleListRef.value?.reactivate?.();
  });
});

onUnmounted(() => {
  // Clean up event listeners
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:record-created', handleRecordCreated);
  }
});
</script>
