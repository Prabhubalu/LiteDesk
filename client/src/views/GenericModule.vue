<template>
  <div
    class="mx-auto w-full"
    :class="isAuditFindingsSurface ? 'px-4 sm:px-6 lg:px-8 py-4' : ''"
  >
    <!-- List: use ModuleList with moduleKey from route -->
    <ModuleList
      v-if="routeType === 'list' && moduleKey"
      ref="moduleListRef"
      :module-key="moduleKey"
      :app-key="resolvedAppKey"
      view-mode="list"
      @create="handleCreate"
      @row-click="handleRowClick"
      @bulk-action="handleBulkAction"
    />
    <CreateRecordDrawer
      v-if="routeType === 'list' && moduleKey"
      :is-open="inlineCreateOpen"
      :module-key="moduleKey"
      @close="handleInlineCreateClose"
      @saved="handleInlineCreateSaved"
    />
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
import apiClient from '@/utils/apiClient';
import { getModuleRecordCrudPathBase } from '@/utils/moduleRecordApiPath';

const route = useRoute();
const router = useRouter();
const inlineCreateOpen = ref(false);
const moduleListRef = ref(null);

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
 * ListView emits bulk delete as `bulk-delete`; other surfaces may use `delete`.
 * ModuleList forwards @bulk-action here — without this handler, mass delete is a no-op.
 */
async function handleBulkAction(actionId, selectedRows) {
  if (actionId !== 'delete' && actionId !== 'bulk-delete') {
    return;
  }
  if (!Array.isArray(selectedRows) || selectedRows.length === 0) {
    return;
  }
  const ids = selectedRows
    .map((row) => row?._id || row?.id)
    .filter((id) => id != null && id !== '');
  if (ids.length === 0) {
    return;
  }
  const base = getModuleRecordCrudPathBase(moduleKey.value, {
    appKey: resolvedAppKey.value,
    routePath: String(route.path || '')
  });
  try {
    await Promise.all(ids.map((id) => apiClient.delete(`${base}/${id}`)));
    await refreshListAfterCreate();
  } catch (error) {
    console.error('[GenericModule] Bulk delete failed:', error);
    const msg = error?.response?.data?.message || error?.message || 'Delete failed';
    alert(msg);
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
</script>
