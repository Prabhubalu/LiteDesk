<template>
  <div :class="embedded ? 'space-y-4' : 'space-y-6'">
    <div
      class="flex gap-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/30 px-4 py-3"
    >
      <InformationCircleIcon class="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
      <p class="text-sm text-sky-900 dark:text-sky-100 leading-relaxed">
        {{ t('settings.settingsHierarchyInfoBanner') }}
      </p>
    </div>

    <div
      :class="[
        embedded
          ? 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm'
          : 'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700'
      ]"
    >
      <div class="hierarchy-toolbar border-b border-gray-100 dark:border-gray-700 px-4 py-3">
        <div class="relative flex-1 min-w-[12rem] max-w-md">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            v-model="treeSearch"
            type="search"
            :placeholder="t('settings.settingsHierarchySearchPh')"
            class="hierarchy-search-input w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          />
        </div>

        <div class="hierarchy-toolbar-actions">
          <button
            type="button"
            class="hierarchy-toolbar-btn inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-indigo-200 hover:bg-gray-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
            :title="t('settings.settingsHierarchyExpandAll')"
            @click="expandAll"
          >
            <ChevronDoubleDownIcon class="h-4 w-4" />
            <span class="hidden lg:inline">{{ t('settings.settingsHierarchyExpandAll') }}</span>
          </button>
          <button
            type="button"
            class="hierarchy-toolbar-btn inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-indigo-200 hover:bg-gray-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
            :title="t('settings.settingsHierarchyCollapseAll')"
            @click="collapseAll"
          >
            <ChevronDoubleUpIcon class="h-4 w-4" />
            <span class="hidden lg:inline">{{ t('settings.settingsHierarchyCollapseAll') }}</span>
          </button>

          <label
            class="hierarchy-toolbar-toggle inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
            :title="t('settings.settingsHierarchyCompactHint')"
          >
            <input
              v-model="compactDensity"
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-700"
            />
            <span class="hidden sm:inline">{{ t('settings.settingsHierarchyCompact') }}</span>
          </label>

          <label
            class="hierarchy-toolbar-toggle inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
            :title="t('settings.settingsHierarchyShowAllUsersHint')"
          >
            <input
              v-model="showAllUsers"
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-700"
            />
            <span class="hidden sm:inline">{{ t('settings.settingsHierarchyShowAllUsers') }}</span>
          </label>

          <button
            type="button"
            class="hierarchy-toolbar-btn inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-indigo-200 hover:bg-gray-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
            :title="t('actions.refresh')"
            @click="refreshHierarchy"
          >
            <ArrowPathIcon class="h-4 w-4" />
          </button>

          <button
            type="button"
            class="hierarchy-toolbar-btn inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-indigo-200 hover:bg-gray-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
            :title="t('settings.settingsHierarchyDragHint')"
          >
            <QuestionMarkCircleIcon class="h-4 w-4" />
          </button>
        </div>
      </div>

      <p v-if="moveError" class="mx-4 mt-4 text-sm text-red-600 dark:text-red-400">{{ moveError }}</p>

      <Teleport to="body">
        <Transition name="hierarchy-drag-overlay">
          <div
            v-if="pointerUserDragActive"
            class="role-hierarchy-user-drop-overlay"
          >
            {{ t('settings.settingsHierarchyUserDropOverlay') }}
          </div>
        </Transition>
      </Teleport>

      <Teleport to="body">
        <Transition name="hierarchy-drag-overlay">
          <div
            v-if="pointerDragActive"
            class="role-hierarchy-drop-overlay"
            data-hierarchy-root-drop="true"
            :class="{ 'role-hierarchy-drop-overlay-active': isRootDropTarget }"
          >
            {{ t('settings.settingsHierarchyDropRoot') }}
          </div>
        </Transition>
      </Teleport>

      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>

      <div v-else-if="hierarchy.length === 0" class="text-center py-16 px-4">
        <UserGroupIcon class="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.settingsHierarchyEmpty') }}</p>
        <button
          type="button"
          class="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          @click="emit('add-child', null)"
        >
          <PlusIcon class="h-4 w-4" />
          {{ t('settings.settingsHierarchyAddRootRole') }}
        </button>
      </div>

      <div
        v-else
        class="hierarchy-canvas bg-slate-50 px-4 py-5 dark:bg-gray-900"
        :class="{
          'hierarchy-canvas-saving': moving,
          'hierarchy-canvas-reflowing': reflowing,
          'hierarchy-canvas-compact': compactDensity
        }"
        @keydown="onCanvasKeydown"
      >
        <div class="org-root-row">
          <div
            class="org-root-chip border border-emerald-200 bg-white text-emerald-800 shadow-sm dark:border-emerald-700/60 dark:bg-gray-800 dark:text-emerald-300 dark:shadow-none"
            :class="{ 'org-root-drop': isRootDropTarget }"
            data-hierarchy-root-drop="true"
          >
            <BuildingOffice2Icon class="h-4 w-4 shrink-0" />
            <span class="font-semibold truncate">{{ organizationName }}</span>
            <button
              type="button"
              class="org-root-add bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
              :title="t('settings.settingsHierarchyAddRootRole')"
              @click="emit('add-child', null)"
            >
              <PlusIcon class="h-4 w-4" />
            </button>
          </div>
        </div>

        <div v-if="filteredHierarchy.length === 0 && treeSearch" class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('settings.settingsHierarchySearchEmpty', { query: treeSearch }) }}
        </div>

        <div v-else class="tree-children-root">
          <template v-for="rootNode in filteredHierarchy" :key="rootNode._id">
            <div
              v-if="pointerDragActive"
              class="hierarchy-reorder-slot hierarchy-reorder-slot-root"
              :class="{ 'hierarchy-reorder-slot-active': isActiveReorderSlot(rootBeforeSlotKey(rootNode._id)) }"
              data-hierarchy-reorder-slot="true"
              data-hierarchy-parent-role-id=""
              :data-hierarchy-insert-before-role-id="rootNode._id"
              :data-hierarchy-slot-key="rootBeforeSlotKey(rootNode._id)"
            />
            <HierarchyNode
              :node="rootNode"
              :depth="0"
              :hierarchy-roots="filteredHierarchy"
              :tree-search="treeSearch"
              :show-all-users="showAllUsers"
              :all-users-by-role-id="allUsersByRoleId"
              :all-users-loading="allUsersLoading"
              :search-users-by-role-id="searchUsersByRoleId"
              @node-click="handleNodeClick"
              @add-child="(parent) => emit('add-child', parent)"
              @delete="(role) => emit('delete', role)"
              @move="handleRoleMove"
              @user-click="emit('user-click', $event)"
              @invite-to-role="emit('invite-to-role', $event)"
              @user-reassign="handleUserReassign"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  MagnifyingGlassIcon,
  InformationCircleIcon,
  BuildingOffice2Icon,
  PlusIcon,
  UserGroupIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
  ChevronDoubleDownIcon,
  ChevronDoubleUpIcon
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/auth';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import HierarchyNode from './HierarchyNode.vue';
import { provideRoleHierarchyExpand } from '@/composables/useRoleHierarchyExpand';
import { provideRoleHierarchyDensity } from '@/composables/useRoleHierarchyDensity';
import { provideRoleHierarchyNavigation } from '@/composables/useRoleHierarchyNavigation';
import {
  pointerDragActive,
  pointerDropTarget,
  cancelRoleHierarchyPointerDrag,
  isActiveReorderSlot
} from '@/composables/useRoleHierarchyPointerDrag';
import { cancelRoleHierarchyUserDrag, pointerUserDragActive } from '@/composables/useRoleHierarchyUserDrag';

const { t } = useI18n();
const authStore = useAuthStore();
const { success, error: notifyError } = useNotifications();
const { expandAll, collapseAll } = provideRoleHierarchyExpand();
const { compactDensity } = provideRoleHierarchyDensity();
const { focusRole } = provideRoleHierarchyNavigation(() => hierarchy.value);

const reflowing = ref(false);

const props = defineProps({
  roles: { type: Array, default: () => [] },
  embedded: { type: Boolean, default: false }
});

const emit = defineEmits(['refresh', 'node-click', 'add-child', 'delete', 'user-click', 'invite-to-role']);

const HIERARCHY_SHOW_ALL_USERS_KEY = 'arivu-hierarchy-show-all-users';

const hierarchy = ref([]);
const loading = ref(false);
const moving = ref(false);
const moveError = ref('');
const treeSearch = ref('');
const showAllUsers = ref(localStorage.getItem(HIERARCHY_SHOW_ALL_USERS_KEY) === 'true');
const allUsersByRoleId = ref({});
const allUsersLoading = ref(false);
const searchUsersByRoleId = ref({});
const searchMatchedRoleIds = ref(new Set());
const reassigningUser = ref(false);

const organizationName = computed(
  () => authStore.organization?.name || t('settings.settingsHierarchyOrgRoot')
);

const isRootDropTarget = computed(() => pointerDropTarget.value?.kind === 'root');

function triggerReflow() {
  reflowing.value = true;
  window.setTimeout(() => {
    reflowing.value = false;
  }, 420);
}

function onCanvasKeydown(event) {
  if (event.key === 'Tab' && !event.shiftKey && !document.activeElement?.closest?.('[data-hierarchy-focus-id]')) {
    const firstRoot = filteredHierarchy.value[0];
    if (firstRoot?._id) {
      event.preventDefault();
      focusRole(firstRoot._id);
    }
  }
}

function rootBeforeSlotKey(roleId) {
  return `before:root:${roleId}`;
}

function filterTree(nodes, query, userRoleIds) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return nodes || [];
  return (nodes || []).reduce((acc, node) => {
    const children = filterTree(node.children || [], q, userRoleIds);
    const selfMatch = String(node.name || '').toLowerCase().includes(q)
      || String(node.description || '').toLowerCase().includes(q);
    const userMatch = userRoleIds.has(String(node._id));
    if (selfMatch || userMatch || children.length) {
      acc.push({ ...node, children });
    }
    return acc;
  }, []);
}

const filteredHierarchy = computed(() => {
  const q = String(treeSearch.value || '').trim();
  if (!q) return hierarchy.value;
  return filterTree(hierarchy.value, q, searchMatchedRoleIds.value);
});

function groupUsersByRoleId(users = []) {
  const map = {};
  for (const user of users) {
    const roleId = String(user?.roleId?._id || user?.roleId || '');
    if (!roleId) continue;
    if (!map[roleId]) map[roleId] = [];
    map[roleId].push(user);
  }
  return map;
}

async function loadAllUsers() {
  allUsersLoading.value = true;
  try {
    const response = await apiClient.get('/users', {
      params: { limit: 500 },
      cache: 'no-store'
    });
    allUsersByRoleId.value = groupUsersByRoleId(response.success ? (response.data || []) : []);
  } catch (error) {
    console.error('Error loading hierarchy users:', error);
    allUsersByRoleId.value = {};
  } finally {
    allUsersLoading.value = false;
  }
}

let searchUsersTimer = null;

async function fetchSearchUsers(query) {
  const q = String(query || '').trim();
  if (!q) {
    searchUsersByRoleId.value = {};
    searchMatchedRoleIds.value = new Set();
    return;
  }

  try {
    const response = await apiClient.get('/users', {
      params: { search: q, limit: 200 },
      cache: 'no-store'
    });
    const users = response.success ? (response.data || []) : [];
    const map = groupUsersByRoleId(users);
    searchUsersByRoleId.value = map;
    searchMatchedRoleIds.value = new Set(Object.keys(map));
  } catch (error) {
    console.error('Error searching hierarchy users:', error);
    searchUsersByRoleId.value = {};
    searchMatchedRoleIds.value = new Set();
  }
}

function findNodeById(nodes, id) {
  for (const node of nodes || []) {
    if (String(node._id) === String(id)) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

function captureMoveUndoState(nodes, roleId) {
  const parentId = findRoleParentId(nodes, roleId);
  const siblings = parentId
    ? (findNodeById(nodes, parentId)?.children || [])
    : (nodes || []);
  const index = siblings.findIndex((node) => String(node._id) === String(roleId));
  const prevSibling = index > 0 ? siblings[index - 1] : null;
  const nextSibling = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;

  return {
    roleId: String(roleId),
    parentRoleId: parentId ? String(parentId) : null,
    insertAfterRoleId: prevSibling?._id ? String(prevSibling._id) : null,
    insertBeforeRoleId: nextSibling?._id ? String(nextSibling._id) : null
  };
}

function findRoleName(nodes, roleId) {
  const node = findNodeById(nodes, roleId);
  return node?.name || '';
}

function findRoleParentId(nodes, roleId, parentId = null) {
  for (const node of nodes || []) {
    if (String(node._id) === String(roleId)) return parentId;
    const found = findRoleParentId(node.children, roleId, node._id);
    if (found !== undefined) return found;
  }
  return undefined;
}

const fetchHierarchy = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/roles/hierarchy');
    if (response.success) {
      hierarchy.value = response.data;
    }
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
  } finally {
    loading.value = false;
  }
};

const refreshHierarchy = () => {
  moveError.value = '';
  fetchHierarchy();
  loadAllUsers();
  emit('refresh');
};

const handleNodeClick = (node) => {
  emit('node-click', node);
};

const handleRoleMove = async ({ roleId, parentRoleId, insertBeforeRoleId, insertAfterRoleId }) => {
  if (!roleId || moving.value) return;

  const isReorder = Boolean(insertBeforeRoleId || insertAfterRoleId);
  const normalizedNewParent = parentRoleId ? String(parentRoleId) : null;

  if (!isReorder) {
    if (normalizedNewParent && String(roleId) === normalizedNewParent) return;
    const currentParentId = findRoleParentId(hierarchy.value, roleId);
    const normalizedCurrentParent = currentParentId ? String(currentParentId) : null;
    if (normalizedNewParent === normalizedCurrentParent) {
      moveError.value = t('settings.settingsHierarchyAlreadyThere');
      return;
    }
  }

  moveError.value = '';
  moving.value = true;
  const undoState = captureMoveUndoState(hierarchy.value, roleId);
  const movedRoleName = findRoleName(hierarchy.value, roleId);

  try {
    const body = { parentRoleId: normalizedNewParent };
    if (insertBeforeRoleId) body.insertBeforeRoleId = insertBeforeRoleId;
    if (insertAfterRoleId) body.insertAfterRoleId = insertAfterRoleId;

    const response = await apiClient.patch(`/roles/${roleId}/move`, body);
    if (response.success) {
      await fetchHierarchy();
      emit('refresh');
      triggerReflow();

      success(t('settings.settingsHierarchyMoveSuccess', { name: movedRoleName }), {
        duration: 8000,
        secondary: t('settings.settingsHierarchyMoveUndoHint'),
        onClick: async () => {
          try {
            const undoBody = { parentRoleId: undoState.parentRoleId };
            if (undoState.insertBeforeRoleId) undoBody.insertBeforeRoleId = undoState.insertBeforeRoleId;
            if (undoState.insertAfterRoleId) undoBody.insertAfterRoleId = undoState.insertAfterRoleId;
            await apiClient.patch(`/roles/${undoState.roleId}/move`, undoBody);
            await fetchHierarchy();
            emit('refresh');
          } catch (undoError) {
            notifyError(undoError.response?.data?.message || undoError.message || t('settings.settingsHierarchyMoveFailed'));
          }
        }
      });
    } else {
      moveError.value = response.message || t('settings.settingsHierarchyMoveFailed');
    }
  } catch (error) {
    moveError.value = error.response?.data?.message || error.message || t('settings.settingsHierarchyMoveFailed');
  } finally {
    moving.value = false;
    cancelRoleHierarchyPointerDrag();
  }
};

async function handleUserReassign({ userId, roleId }) {
  if (!userId || !roleId || reassigningUser.value) return;

  reassigningUser.value = true;
  moveError.value = '';

  try {
    const response = await apiClient.put(`/users/${userId}`, { roleId });
    if (response.success) {
      await Promise.all([fetchHierarchy(), loadAllUsers()]);
      emit('refresh');
      triggerReflow();
      success(t('settings.settingsHierarchyUserMoved'));
    } else {
      moveError.value = response.message || t('settings.settingsHierarchyUserMoveFailed');
    }
  } catch (error) {
    moveError.value = error.response?.data?.message || error.message || t('settings.settingsHierarchyUserMoveFailed');
  } finally {
    reassigningUser.value = false;
    cancelRoleHierarchyUserDrag();
  }
}

watch(() => props.roles, () => {
  fetchHierarchy();
  loadAllUsers();
}, { immediate: true });

watch(showAllUsers, (enabled) => {
  localStorage.setItem(HIERARCHY_SHOW_ALL_USERS_KEY, enabled ? 'true' : 'false');
});

watch(treeSearch, (query) => {
  clearTimeout(searchUsersTimer);
  searchUsersTimer = setTimeout(() => {
    fetchSearchUsers(query);
  }, 300);
});
</script>

<style scoped>
:global(body.role-hierarchy-dragging),
:global(body.role-hierarchy-user-dragging) {
  cursor: grabbing;
  user-select: none;
}

:global(.role-hierarchy-drag-ghost) {
  position: fixed;
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  border: 2px solid rgb(99 102 241);
  background: rgb(255 255 255);
  color: rgb(49 46 129);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25;
  box-shadow: 0 12px 28px rgb(99 102 241 / 0.28);
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.94);
  transition: opacity 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}

:global(.role-hierarchy-drag-ghost-visible) {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

:global(.dark .role-hierarchy-drag-ghost) {
  background: rgb(30 41 59);
  color: rgb(199 210 254);
  border-color: rgb(129 140 248);
}

:global(.role-hierarchy-drag-ghost-grip) {
  color: rgb(99 102 241);
  font-size: 1rem;
  line-height: 1;
}

:global(.role-hierarchy-drop-overlay) {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  z-index: 9999;
  max-width: min(92vw, 28rem);
  transform: translateX(-50%);
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  border: 2px dashed rgb(129 140 248);
  background: rgb(238 242 255 / 0.96);
  color: rgb(67 56 202);
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  box-shadow: 0 10px 30px rgb(99 102 241 / 0.18);
  backdrop-filter: blur(6px);
  pointer-events: none;
}

:global(.role-hierarchy-drop-overlay-active) {
  border-color: rgb(16 185 129);
  background: rgb(236 253 245 / 0.98);
  color: rgb(4 120 87);
  box-shadow: 0 0 0 3px rgb(16 185 129 / 0.2), 0 10px 30px rgb(16 185 129 / 0.2);
}

:global(.dark .role-hierarchy-drop-overlay) {
  background: rgb(30 27 75 / 0.92);
  color: rgb(199 210 254);
  border-color: rgb(99 102 241);
}

:global(.dark .role-hierarchy-drop-overlay-active) {
  background: rgb(6 78 59 / 0.92);
  color: rgb(167 243 208);
  border-color: rgb(52 211 153);
}

.hierarchy-drag-overlay-enter-active,
.hierarchy-drag-overlay-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.hierarchy-drag-overlay-enter-from,
.hierarchy-drag-overlay-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px) !important;
}

:global(.role-hierarchy-user-drag-ghost) {
  position: fixed;
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 9999px;
  border: 2px solid rgb(14 165 233);
  background: rgb(255 255 255);
  color: rgb(3 105 161);
  font-size: 0.8125rem;
  font-weight: 600;
  box-shadow: 0 12px 28px rgb(14 165 233 / 0.28);
  pointer-events: none;
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.94);
  transition: opacity 0.18s ease, transform 0.18s ease;
}

:global(.role-hierarchy-user-drag-ghost-visible) {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

:global(.dark .role-hierarchy-user-drag-ghost) {
  background: rgb(15 23 42);
  color: rgb(125 211 252);
  border-color: rgb(56 189 248);
}

.hierarchy-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.hierarchy-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
}

.hierarchy-canvas {
  --hierarchy-bg: #f8fafc;
  --hierarchy-surface: #ffffff;
  --hierarchy-surface-muted: rgb(248 250 252);
  --hierarchy-surface-hover: rgb(248 250 252);
  --hierarchy-border: rgb(228 231 235);
  --hierarchy-border-strong: rgb(203 213 225);
  --hierarchy-text: rgb(15 23 42);
  --hierarchy-text-muted: rgb(100 116 139);
  --hierarchy-accent-soft: rgb(238 242 255);
  --hierarchy-accent-text: rgb(79 70 229);
  --hierarchy-toggle-bg: #ffffff;
  --hierarchy-toggle-hover: rgb(248 250 252);
  --tree-line-color: rgb(226 232 240);
  --tree-indent: 1.125rem;
  min-height: 280px;
  overflow-x: auto;
  transition: opacity 0.2s ease;
}

.hierarchy-canvas-compact {
  --tree-indent: 1.125rem;
}

.hierarchy-canvas-reflowing :global(.tree-branch) {
  animation: hierarchy-branch-settle 0.38s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes hierarchy-branch-settle {
  0% {
    opacity: 0.55;
    transform: translateY(-6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

:global(.dark) .hierarchy-canvas {
  --hierarchy-bg: rgb(17 24 39);
  --hierarchy-surface: rgb(31 41 55);
  --hierarchy-surface-muted: rgb(30 41 59);
  --hierarchy-surface-hover: rgb(37 47 63);
  --hierarchy-border: rgb(55 65 81);
  --hierarchy-border-strong: rgb(75 85 99);
  --hierarchy-text: rgb(226 232 240);
  --hierarchy-text-muted: rgb(148 163 184);
  --hierarchy-accent-soft: rgb(49 46 129);
  --hierarchy-accent-text: rgb(165 180 252);
  --hierarchy-toggle-bg: rgb(31 41 55);
  --hierarchy-toggle-hover: rgb(37 47 63);
  --tree-line-color: rgb(75 85 99);
}

:global(.role-hierarchy-user-drop-overlay) {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  z-index: 9999;
  transform: translateX(-50%);
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  border: 2px dashed rgb(56 189 248);
  background: rgb(240 249 255 / 0.96);
  color: rgb(3 105 161);
  font-size: 0.875rem;
  font-weight: 500;
  box-shadow: 0 10px 30px rgb(14 165 233 / 0.18);
  pointer-events: none;
}

:global(.dark .role-hierarchy-user-drop-overlay) {
  background: rgb(8 47 73 / 0.92);
  color: rgb(125 211 252);
  border-color: rgb(14 165 233);
}

.hierarchy-canvas-saving {
  opacity: 0.72;
}

.org-root-row {
  margin-bottom: 0.25rem;
  padding-left: 0.625rem;
}

.org-root-row::after {
  content: '';
  display: block;
  width: 1px;
  height: 0.5rem;
  margin-left: 0.5rem;
  background-color: var(--tree-line-color, rgb(226 232 240));
}

:global(.dark) .org-root-row::after {
  background-color: rgb(75 85 99);
}

.org-root-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.org-root-chip:hover {
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.06);
}

:global(.dark) .org-root-chip:hover {
  box-shadow: none;
}

.org-root-drop {
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.12);
}

.org-root-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.375rem;
  height: 1.375rem;
  margin-left: 0.125rem;
  border-radius: 0.375rem;
  transition: background 0.15s ease;
}

.tree-children-root {
  padding-left: 0.25rem;
}

.hierarchy-reorder-slot-root {
  margin-left: 0.25rem;
}

:global(.hierarchy-reorder-slot) {
  height: 0.5rem;
  margin: 0.125rem 0;
  border-radius: 9999px;
  transition: height 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

:global(.hierarchy-reorder-slot-active) {
  height: 0.625rem;
  background: rgb(16 185 129);
  box-shadow: 0 0 0 2px rgb(16 185 129 / 0.25);
}
</style>
