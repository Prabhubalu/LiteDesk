<template>
  <div
    class="mx-auto w-full"
    :class="isAuditFindingsSurface ? 'px-4 sm:px-6 lg:px-8 py-4' : ''"
  >
    <!-- List branch: single v-if so detail/create fallbacks are not chained to SO modals -->
    <template v-if="routeType === 'list' && moduleKey">
      <ModuleList
        ref="moduleListRef"
        :module-key="moduleKey"
        :app-key="resolvedAppKey"
        view-mode="list"
        @create="handleCreate"
        @row-click="handleRowClick"
        @edit="handleEditFromList"
        @bulk-action="handleBulkAction"
      />
      <CreateRecordDrawer
        :is-open="inlineCreateOpen"
        :module-key="moduleKey"
        @close="handleInlineCreateClose"
        @saved="handleInlineCreateSaved"
      />
      <CreateRecordDrawer
        :is-open="showEditDrawer"
        :module-key="moduleKey"
        :record="editingRecord"
        @close="handleEditDrawerClose"
        @saved="handleEditDrawerSaved"
      />
      <SalesOrderMergeModal
        v-if="moduleKey === 'sales_orders'"
        :show="mergeModalOpen"
        :orders="mergeSelectedRows"
        :saving="mergeBusy"
        @close="closeMergeModal"
        @submit="submitMerge"
      />
      <InvoiceMultiSoWizardModal
        v-if="moduleKey === 'sales_orders'"
        :open="multiSoModalOpen"
        :sales-orders="multiSoSelectedRows"
        @close="closeMultiSoModal"
        @created="onMultiSoInvoiceCreated"
      />
    </template>
    <!-- Detail: use standard ModuleRecordPage (same UI as deals/tasks) -->
    <ModuleRecordPage
      v-else-if="routeType === 'detail' && moduleKey"
    />
    <!-- Create: open generic create drawer scoped to this module route -->
    <CreateRecordDrawer
      v-else-if="routeType === 'create' && moduleKey"
      :is-open="true"
      :module-key="moduleKey"
      @close="goToList"
      @saved="handleCreateSaved"
    />
    <div v-else class="flex items-center justify-center min-h-[40vh] text-gray-500 dark:text-gray-400">{{ t('platform.genericModuleUnknownModuleOrRoute') }}</div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ModuleList from '@/components/module-list/ModuleList.vue';
import ModuleRecordPage from '@/pages/ModuleRecordPage.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import SalesOrderMergeModal from '@/components/sales-orders/SalesOrderMergeModal.vue';
import InvoiceMultiSoWizardModal from '@/components/invoices/InvoiceMultiSoWizardModal.vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';

const route = useRoute();
const router = useRouter();
const inlineCreateOpen = ref(false);
const showEditDrawer = ref(false);
const editingRecord = ref(null);
const moduleListRef = ref(null);
const mergeModalOpen = ref(false);
const mergeSelectedRows = ref([]);
const mergeBusy = ref(false);
const multiSoModalOpen = ref(false);
const multiSoSelectedRows = ref([]);
const notifications = useNotifications();

const moduleKey = computed(() => (route.meta?.moduleKey || '').toLowerCase());
const routeType = computed(() => route.meta?.routeType || 'list');
const moduleRouteBase = computed(() => {
  const currentPath = String(route.path || '').trim();
  if (!currentPath) return moduleKey.value ? `/${moduleKey.value}` : '/';

  // Create route: /<app>/<module>/new -> /<app>/<module>
  if (routeType.value === 'create' && /\/new\/?$/.test(currentPath)) {
    return currentPath.replace(/\/new\/?$/, '') || '/';
  }

  // Detail route: /<app>/<module>/<id> -> /<app>/<module>
  if (routeType.value === 'detail') {
    const trimmed = currentPath.replace(/\/+$/, '');
    const slashIdx = trimmed.lastIndexOf('/');
    if (slashIdx > 0) return trimmed.slice(0, slashIdx);
  }

  return currentPath.replace(/\/+$/, '') || '/';
});
const resolvedAppKey = computed(() => {
  const metaAppKey = String(route.meta?.appKey || '').toUpperCase();
  if (metaAppKey) return metaAppKey;

  const currentPath = String(route.path || '').toLowerCase();
  if (currentPath.startsWith('/helpdesk/')) return 'HELPDESK';
  if (currentPath.startsWith('/audit/')) return 'AUDIT';
  if (currentPath.startsWith('/portal/')) return 'PORTAL';
  if (currentPath.startsWith('/projects/')) return 'PROJECTS';
  if (currentPath.startsWith('/quotes')) return 'PLATFORM';
  if (currentPath.startsWith('/sales-orders')) return 'PLATFORM';
  if (currentPath.startsWith('/invoices')) return 'PLATFORM';
  if (currentPath.startsWith('/payments')) return 'PLATFORM';

  return 'SALES';
});
const isAuditFindingsSurface = computed(() => (
  resolvedAppKey.value === 'AUDIT' &&
  moduleKey.value === 'cases' &&
  routeType.value === 'list'
));

function handleCreate() {
  inlineCreateOpen.value = true;
}

function handleRowClick(row) {
  // ModuleList emits the row as the first argument (not `{ row }`).
  const id = row?._id ?? row?.id;
  if (id && moduleRouteBase.value) {
    router.push(`${moduleRouteBase.value}/${id}`);
  }
}

function handleEditFromList(row) {
  if (!row) return;
  editingRecord.value = row;
  showEditDrawer.value = true;
}

function handleEditDrawerClose() {
  showEditDrawer.value = false;
  editingRecord.value = null;
}

async function handleEditDrawerSaved() {
  handleEditDrawerClose();
  await refreshListAfterCreate();
}

function handleRecordUpdated() {
  // No-op when using ModuleRecordPage; it handles navigation internally
}

function handleRecordDeleted() {
  router.push(moduleRouteBase.value || `/${moduleKey.value}`);
}

async function refreshListAfterCreate() {
  if (moduleListRef.value && typeof moduleListRef.value.fetchData === 'function') {
    await moduleListRef.value.fetchData();
  }
}

/**
 * Bulk delete is handled inside ModuleList (progress + leave guards).
 * This handler covers module-specific bulk actions (merge, combined invoice, etc.).
 */
async function handleBulkAction(actionId, selectedRows) {
  if (actionId === 'merge' && moduleKey.value === 'sales_orders') {
    const rows = Array.isArray(selectedRows) ? selectedRows : [];
    if (rows.length < 2) {
      notifications.error(t('records.salesOrderMergeMinSelection'));
      return;
    }
    mergeSelectedRows.value = rows;
    mergeModalOpen.value = true;
    return;
  }

  if (actionId === 'combined-invoice' && moduleKey.value === 'sales_orders') {
    const rows = Array.isArray(selectedRows) ? selectedRows : [];
    if (rows.length < 2) {
      notifications.error(t('records.invoiceMultiSoMinSelection'));
      return;
    }
    multiSoSelectedRows.value = rows;
    multiSoModalOpen.value = true;
    return;
  }

  if (actionId === 'delete' || actionId === 'bulk-delete') {
    return;
  }
}

async function handleInlineCreateSaved() {
  inlineCreateOpen.value = false;
  await refreshListAfterCreate();
}

function handleInlineCreateClose() {
  inlineCreateOpen.value = false;
}

function handleCreateSaved(savedRecord) {
  const recordId = savedRecord?._id || savedRecord?.id;
  if (recordId) {
    router.push(`${moduleRouteBase.value}/${recordId}`);
    return;
  }
  goToList();
}

function goToList() {
  if (moduleRouteBase.value || moduleKey.value) {
    router.push(moduleRouteBase.value || `/${moduleKey.value}`);
  }
}

function closeMergeModal() {
  mergeModalOpen.value = false;
  mergeSelectedRows.value = [];
}

function closeMultiSoModal() {
  multiSoModalOpen.value = false;
  multiSoSelectedRows.value = [];
}

async function onMultiSoInvoiceCreated(payload) {
  closeMultiSoModal();
  await refreshListAfterCreate();
  const invoiceMongoId = payload?.invoiceMongoId;
  if (invoiceMongoId) {
    router.push(`/invoices/${invoiceMongoId}`);
  }
}

async function submitMerge({ orderTitle } = {}) {
  if (mergeSelectedRows.value.length < 2) return;
  mergeBusy.value = true;
  try {
    const salesOrderIds = mergeSelectedRows.value.map(
      (row) => row.salesOrderId || row._id || row.id
    ).filter(Boolean);
    const res = await apiClient.post('/sales-orders/merge', {
      salesOrderIds,
      orderTitle
    });
    if (!res?.success) {
      notifications.error(res?.message || t('records.salesOrderMergeFailed'));
      return;
    }
    notifications.success(t('records.salesOrderMergeSuccess'));
    closeMergeModal();
    await refreshListAfterCreate();
    const mergedId = res.data?.mergedOrder?._id;
    if (mergedId) {
      router.push(`${moduleRouteBase.value}/${mergedId}`);
    }
  } catch (error) {
    notifications.error(error?.message || t('records.salesOrderMergeFailed'));
  } finally {
    mergeBusy.value = false;
  }
}
</script>
