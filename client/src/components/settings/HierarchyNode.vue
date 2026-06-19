<template>
  <div class="tree-branch" :class="{ 'tree-branch--nested': depth > 0, 'tree-branch--compact': compactDensity }">
    <div class="tree-node" :class="{ 'tree-node--nested': depth > 0 }">
      <button
        v-if="hasChildren"
        type="button"
        class="tree-toggle border border-gray-300 bg-white text-gray-600 shadow-sm hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:shadow-none dark:hover:border-gray-500 dark:hover:bg-gray-600 dark:hover:text-gray-100"
        :aria-expanded="expanded"
        :aria-label="expanded ? t('settings.settingsHierarchyCollapse') : t('settings.settingsHierarchyExpand')"
        @click.stop="expanded = !expanded"
      >
        <MinusIcon v-if="expanded" class="h-3.5 w-3.5" />
        <PlusIcon v-else class="h-3.5 w-3.5" />
      </button>
      <span v-else class="tree-toggle-spacer" aria-hidden="true" />

      <div
        class="role-card border border-gray-200 bg-white text-gray-900 shadow-none hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-600 dark:hover:bg-gray-700/60"
        :class="roleCardClasses"
        :data-hierarchy-role-id="node._id"
        :data-hierarchy-focus-id="node._id"
        :data-hierarchy-dragging="isDraggingSelf ? 'true' : 'false'"
        :data-hierarchy-no-drop="isInvalidDropTarget ? 'true' : 'false'"
        :data-hierarchy-user-drop-disabled="isOwnerRole ? 'true' : 'false'"
        tabindex="0"
        :title="canDrag ? t('settings.settingsHierarchyRoleDragHint') : (node.description || t('settings.settingsHierarchyNodeHint'))"
        :aria-label="t('settings.settingsHierarchyRoleAria', { name: node.name, count: node.userCount || 0 })"
        @pointerdown="onRolePointerDown"
        @click="onRoleClick"
        @keydown="onRoleKeydown"
        @focus="onRoleFocus"
      >
        <div class="role-card-body">
          <span class="role-card-icon-wrap" :class="roleIconWrapClass">
            <component :is="roleIcon" class="h-4 w-4 shrink-0" aria-hidden="true" />
          </span>
          <span class="role-card-text">
            <span class="role-card-name truncate">
              <template v-if="hasSearchQuery">
                <template v-for="(part, index) in highlightParts(node.name, treeSearch)" :key="`role-name-${index}`">
                  <mark v-if="part.match" class="hierarchy-search-mark">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </template>
              <template v-else>{{ node.name }}</template>
            </span>
          </span>
        </div>

        <div class="role-card-trail">
          <div v-if="avatarPreview.length" class="role-avatar-stack" :title="t('settings.settingsHierarchyAvatarStackHint')">
            <Avatar
              v-for="(user, index) in avatarPreview"
              :key="user._id"
              :user="user"
              size="sm"
              class="role-avatar-stack-item ring-2 ring-white dark:ring-gray-800"
              :style="{ zIndex: avatarPreview.length - index }"
            />
            <span v-if="avatarOverflow > 0" class="role-avatar-overflow border-2 border-white bg-gray-100 text-gray-600 dark:border-gray-800 dark:bg-gray-700 dark:text-gray-300">+{{ avatarOverflow }}</span>
          </div>

          <button
            type="button"
            class="role-card-count bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-700/80 dark:text-gray-300 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
            :class="{ 'role-card-count-active !bg-indigo-50 !text-indigo-600 dark:!bg-indigo-950 dark:!text-indigo-300': shouldShowUsers }"
            :title="t('settings.settingsHierarchyToggleUsers')"
            :aria-expanded="shouldShowUsers"
            @pointerdown.stop
            @click.stop="toggleUsers"
          >
            <UsersIcon class="h-3.5 w-3.5" aria-hidden="true" />
            <span>{{ node.userCount || 0 }}</span>
          </button>
        </div>
      </div>

      <div class="tree-node-actions">
        <button
          type="button"
          class="tree-node-action border border-gray-200 bg-white text-gray-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-indigo-500 dark:hover:bg-gray-600 dark:hover:text-indigo-300"
          :title="t('settings.settingsHierarchyAddChild')"
          @click.stop="emit('add-child', node)"
        >
          <PlusIcon class="h-4 w-4" />
        </button>
        <button
          v-if="!node.isSystemRole"
          type="button"
          class="tree-node-action tree-node-action-danger border border-gray-200 bg-white text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:border-red-700 dark:hover:bg-red-950/60 dark:hover:text-red-300"
          :title="t('settings.rolesDeleteTitle')"
          @click.stop="emit('delete', node)"
        >
          <TrashIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div v-if="shouldShowUsers" class="tree-people">
      <div v-if="usersLoading" class="tree-user-row">
        <span class="tree-toggle-spacer" aria-hidden="true" />
        <div class="tree-user-loading text-gray-500 dark:text-gray-400">
          <span class="tree-user-spinner border-2 border-gray-300 border-t-indigo-500 dark:border-gray-600 dark:border-t-indigo-400" aria-hidden="true" />
          {{ t('settings.settingsHierarchyUsersLoading') }}
        </div>
      </div>
      <template v-else>
        <div v-if="displayUsers.length === 0" class="tree-user-row">
          <span class="tree-toggle-spacer" aria-hidden="true" />
          <button
            type="button"
            class="tree-user-invite text-indigo-600 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950"
            :title="t('settings.settingsHierarchyInviteToRole')"
            @click.stop="emit('invite-to-role', node)"
          >
            <PlusIcon class="h-4 w-4 shrink-0" aria-hidden="true" />
            {{ t('settings.settingsHierarchyInviteToRole') }}
          </button>
        </div>
        <div
          v-for="user in displayUsers"
          :key="user._id"
          class="tree-user-row"
          :class="{ 'tree-user-row-match': isUserSearchMatch(user) }"
        >
        <span class="tree-toggle-spacer" aria-hidden="true" />
        <button
          type="button"
          class="user-leaf border border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600 dark:hover:bg-gray-700/60"
          :class="{ 'user-leaf-match': isUserSearchMatch(user), 'user-leaf-dragging': isDraggingUser(user) }"
          :title="t('settings.settingsHierarchyUserHint')"
          @click.stop="emit('user-click', user)"
        >
          <span
            v-if="!user.isOwner"
            class="user-leaf-drag text-gray-400 hover:text-gray-500 active:bg-sky-50 active:text-sky-600 dark:text-gray-500 dark:hover:text-gray-400 dark:active:bg-sky-950/50 dark:active:text-sky-400"
            :title="t('settings.settingsHierarchyUserDragHint')"
            @click.stop
            @pointerdown="onUserGripPointerDown($event, user)"
          >
            <Bars3Icon class="h-3.5 w-3.5 pointer-events-none" aria-hidden="true" />
          </span>
          <Avatar :user="user" size="sm" class="user-leaf-avatar-wrap" />
          <span class="user-leaf-body">
            <span class="user-leaf-name text-gray-900 dark:text-gray-100">
              <template v-if="hasSearchQuery">
                <template v-for="(part, index) in highlightParts(userDisplayName(user), treeSearch)" :key="`user-name-${user._id}-${index}`">
                  <mark v-if="part.match" class="hierarchy-search-mark">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </template>
              <template v-else>{{ userDisplayName(user) }}</template>
            </span>
            <span v-if="user.email" class="user-leaf-email text-gray-500 dark:text-gray-400">
              <template v-if="hasSearchQuery">
                <template v-for="(part, index) in highlightParts(user.email, treeSearch)" :key="`user-email-${user._id}-${index}`">
                  <mark v-if="part.match" class="hierarchy-search-mark">{{ part.text }}</mark>
                  <template v-else>{{ part.text }}</template>
                </template>
              </template>
              <template v-else>{{ user.email }}</template>
            </span>
          </span>
          <span v-if="user.isOwner" class="user-leaf-badge bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">{{ t('settings.roleUsersOwner') }}</span>
        </button>
      </div>
      </template>
    </div>

    <div v-if="hasChildren && expanded" class="tree-children">
      <template v-for="child in node.children" :key="child._id">
        <div
          v-if="pointerDragActive"
          class="hierarchy-reorder-slot"
          :class="{ 'hierarchy-reorder-slot-active': isActiveReorderSlot(beforeSlotKey(child._id)) }"
          data-hierarchy-reorder-slot="true"
          :data-hierarchy-parent-role-id="node._id"
          :data-hierarchy-insert-before-role-id="child._id"
          :data-hierarchy-slot-key="beforeSlotKey(child._id)"
        />
        <HierarchyNode
          :node="child"
          :depth="depth + 1"
          :hierarchy-roots="hierarchyRoots"
          :tree-search="treeSearch"
          :show-all-users="showAllUsers"
          :all-users-by-role-id="allUsersByRoleId"
          :all-users-loading="allUsersLoading"
          :search-users-by-role-id="searchUsersByRoleId"
          @node-click="emit('node-click', $event)"
          @add-child="emit('add-child', $event)"
          @delete="emit('delete', $event)"
          @move="emit('move', $event)"
          @user-click="emit('user-click', $event)"
          @invite-to-role="emit('invite-to-role', $event)"
          @user-reassign="emit('user-reassign', $event)"
        />
      </template>
      <div
        v-if="pointerDragActive && node.children.length"
        class="hierarchy-reorder-slot"
        :class="{ 'hierarchy-reorder-slot-active': isActiveReorderSlot(afterLastSlotKey()) }"
        data-hierarchy-reorder-slot="true"
        :data-hierarchy-parent-role-id="node._id"
        :data-hierarchy-insert-after-role-id="node.children[node.children.length - 1]._id"
        :data-hierarchy-slot-key="afterLastSlotKey()"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import {
  UserIcon,
  UsersIcon,
  EyeIcon,
  ShieldCheckIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  Bars3Icon
} from '@heroicons/vue/24/outline';
import { StarIcon } from '@heroicons/vue/24/solid';
import {
  pointerDragRoleId,
  pointerDragActive,
  startRoleHierarchyPointerDrag,
  isActiveReorderSlot,
  isActiveReparentTarget
} from '@/composables/useRoleHierarchyPointerDrag';
import {
  pointerDragUserId,
  startRoleHierarchyUserDrag,
  isActiveUserDropTarget
} from '@/composables/useRoleHierarchyUserDrag';
import { useRoleHierarchyExpand } from '@/composables/useRoleHierarchyExpand';
import { useRoleHierarchyDensity } from '@/composables/useRoleHierarchyDensity';
import { useRoleHierarchyNavigation } from '@/composables/useRoleHierarchyNavigation';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  node: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  hierarchyRoots: { type: Array, default: () => [] },
  treeSearch: { type: String, default: '' },
  showAllUsers: { type: Boolean, default: false },
  allUsersByRoleId: { type: Object, default: () => ({}) },
  allUsersLoading: { type: Boolean, default: false },
  searchUsersByRoleId: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['node-click', 'add-child', 'delete', 'move', 'user-click', 'invite-to-role', 'user-reassign']);

const { expandAllSignal, collapseAllSignal } = useRoleHierarchyExpand();
const { compactDensity } = useRoleHierarchyDensity();
const { expandPathSignal, handleRoleKeydown } = useRoleHierarchyNavigation();

const expanded = ref(true);
const hasSearchQuery = computed(() => Boolean(String(props.treeSearch || '').trim()));

const roleIdKey = computed(() => String(props.node?._id || ''));

const prefetchedUsers = computed(() => {
  if (hasSearchQuery.value) {
    return props.searchUsersByRoleId?.[roleIdKey.value] || [];
  }
  if (props.showAllUsers) {
    return props.allUsersByRoleId?.[roleIdKey.value] || [];
  }
  return [];
});

const shouldShowUsers = computed(() => {
  if (props.showAllUsers) return true;
  if (hasSearchQuery.value && prefetchedUsers.value.length > 0) return true;
  return usersExpanded.value;
});

const displayUsers = computed(() => {
  if (prefetchedUsers.value.length > 0) {
    return prefetchedUsers.value;
  }
  return roleUsers.value;
});

const usersLoading = computed(() => {
  if (props.showAllUsers && props.allUsersLoading) return true;
  if (prefetchedUsers.value.length > 0) return false;
  if (props.showAllUsers || (hasSearchQuery.value && prefetchedUsers.value.length === 0)) {
    return false;
  }
  return manualUsersLoading.value;
});

const manualUsersLoading = ref(false);
const usersExpanded = ref(false);
const roleUsers = ref([]);

watch(
  () => [props.treeSearch, props.showAllUsers],
  ([search, showAll]) => {
    if (String(search || '').trim() || showAll) {
      expanded.value = true;
    }
  }
);

watch(expandAllSignal, () => {
  expanded.value = true;
  usersExpanded.value = true;
});

watch(collapseAllSignal, () => {
  expanded.value = false;
  usersExpanded.value = false;
});

watch(
  () => expandPathSignal.value.tick,
  () => {
    const roleIds = expandPathSignal.value.roleIds || [];
    if (roleIds.includes(roleIdKey.value)) {
      expanded.value = true;
    }
  }
);

const roleUsersForPreview = computed(() => props.allUsersByRoleId?.[roleIdKey.value] || []);

const avatarPreview = computed(() => roleUsersForPreview.value.slice(0, 3));

const avatarOverflow = computed(() => {
  const total = Number(props.node?.userCount || roleUsersForPreview.value.length || 0);
  return Math.max(0, total - avatarPreview.value.length);
});

const roleCardClasses = computed(() => ({
  'role-card-drop': isActiveReparentTarget(props.node._id),
  'role-card-user-drop': isActiveUserDropTarget(props.node._id),
  'role-card-dragging': isDraggingSelf.value,
  'role-card-draggable': canDrag.value,
  'role-card-depth-root': props.depth === 0
}));

const roleIconWrapClass = computed(() => {
  if (isOwnerRole.value) return 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
  if (props.node.isSystemRole) return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300';
  return 'bg-sky-50 text-cyan-700 dark:bg-sky-950/50 dark:text-sky-300';
});

const hasChildren = computed(() => Array.isArray(props.node.children) && props.node.children.length > 0);
const isOwnerRole = computed(() => props.node.isSystemRole && props.node.name === 'Owner');
const canDrag = computed(() => !isOwnerRole.value);

const isDraggingSelf = computed(
  () => pointerDragRoleId.value && String(pointerDragRoleId.value) === String(props.node._id)
);

const roleIcon = computed(() => {
  const map = { crown: StarIcon, shield: ShieldCheckIcon, users: UsersIcon, eye: EyeIcon, user: UserIcon };
  return map[props.node.icon] || UserIcon;
});

function subtreeContains(node, targetId) {
  if (!node || !targetId) return false;
  if (String(node._id) === String(targetId)) return true;
  for (const child of node.children || []) {
    if (subtreeContains(child, targetId)) return true;
  }
  return false;
}

function findNodeById(nodes, id) {
  for (const node of nodes || []) {
    if (String(node._id) === String(id)) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

const isInvalidDropTarget = computed(() => {
  const draggedId = pointerDragRoleId.value;
  if (!draggedId) return false;
  if (String(draggedId) === String(props.node._id)) return true;
  const draggedNode = findNodeById(props.hierarchyRoots, draggedId);
  if (draggedNode && subtreeContains(draggedNode, props.node._id)) return true;
  return false;
});

function onRoleFocus() {
  if (hasChildren.value && !expanded.value) {
    expanded.value = true;
  }
}

function onRoleKeydown(event) {
  if (event.target !== event.currentTarget) return;
  handleRoleKeydown(event, props.node._id, {
    onActivate: () => emit('node-click', props.node),
    onExpand: () => {
      if (hasChildren.value) expanded.value = true;
    },
    onCollapse: () => {
      if (hasChildren.value && expanded.value) {
        expanded.value = false;
        return;
      }
    }
  });
}

function isDraggingUser(user) {
  return pointerDragUserId.value && String(pointerDragUserId.value) === String(user?._id);
}

const onUserGripPointerDown = (event, user) => {
  if (user?.isOwner) return;
  startRoleHierarchyUserDrag(user._id, event, {
    label: userDisplayName(user),
    currentRoleId: roleIdKey.value,
    onDrop: (payload) => emit('user-reassign', payload)
  });
};

function beforeSlotKey(childId) {
  return `before:${props.node._id}:${childId}`;
}

function afterLastSlotKey() {
  const lastChild = props.node.children[props.node.children.length - 1];
  return `after:${props.node._id}:${lastChild?._id}`;
}

function normalizeParentRoleId(parentRole) {
  if (!parentRole) return null;
  return String(parentRole);
}

function userDisplayName(user) {
  return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || t('settings.settingsHierarchyUserFallback');
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightParts(text, query) {
  const source = String(text || '');
  const q = String(query || '').trim();
  if (!q) return [{ text: source, match: false }];
  const regex = new RegExp(`(${escapeRegex(q)})`, 'gi');
  return source
    .split(regex)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      match: part.toLowerCase() === q.toLowerCase()
    }));
}

function isUserSearchMatch(user) {
  const q = String(props.treeSearch || '').trim().toLowerCase();
  if (!q) return false;
  const name = userDisplayName(user).toLowerCase();
  const email = String(user.email || '').toLowerCase();
  return name.includes(q) || email.includes(q);
}

async function fetchRoleUsers() {
  if (!props.node?._id) return;
  manualUsersLoading.value = true;
  try {
    const response = await apiClient.get('/users', {
      params: { roleId: props.node._id, limit: 200 },
      cache: 'no-store'
    });
    roleUsers.value = response.success ? (response.data || []) : [];
  } catch (error) {
    console.error('Error fetching users for role:', error);
    roleUsers.value = [];
  } finally {
    manualUsersLoading.value = false;
  }
}

async function toggleUsers() {
  if (props.showAllUsers) return;
  const nextExpanded = !usersExpanded.value;
  usersExpanded.value = nextExpanded;
  if (nextExpanded) {
    await fetchRoleUsers();
  }
}

const skipNextRoleClick = ref(false);

watch(isDraggingSelf, (dragging, wasDragging) => {
  if (wasDragging && !dragging) {
    skipNextRoleClick.value = true;
  }
});

function onRoleClick(event) {
  if (skipNextRoleClick.value) {
    skipNextRoleClick.value = false;
    return;
  }
  if (event.target.closest?.('.role-card-count')) return;
  emit('node-click', props.node);
}

const onRolePointerDown = (event) => {
  if (!canDrag.value || event.button !== 0) return;
  if (event.target.closest?.('.role-card-count')) return;

  startRoleHierarchyPointerDrag(props.node._id, event, {
    label: props.node.name,
    parentRoleId: normalizeParentRoleId(props.node.parentRole),
    onDrop: (payload) => emit('move', payload)
  });
};
</script>

<style scoped>
.tree-branch {
  position: relative;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1875rem 0;
  position: relative;
  min-height: 2.75rem;
}

.tree-node--nested::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--tree-indent, 1.125rem));
  top: 50%;
  width: var(--tree-indent, 1.125rem);
  height: 1px;
  background-color: var(--tree-line-color, rgb(226 232 240));
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.tree-toggle,
.tree-toggle-spacer {
  width: 1.375rem;
  height: 1.375rem;
  flex-shrink: 0;
}

.tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  z-index: 1;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.tree-toggle:focus-visible {
  outline: none;
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.2);
}

.tree-children {
  position: relative;
  margin-left: 0.5625rem;
  padding-left: var(--tree-indent, 1.125rem);
  border-left: 1px solid var(--tree-line-color, rgb(226 232 240));
}

.tree-children > .tree-branch:last-child::after {
  content: '';
  position: absolute;
  left: calc(-1 * var(--tree-indent, 1.125rem) - 1px);
  top: 1.375rem;
  bottom: 0;
  width: 1px;
  background-color: var(--hierarchy-bg, #f8fafc);
  pointer-events: none;
  z-index: 2;
}

:global(.dark) .tree-children > .tree-branch:last-child::after {
  background-color: #111827;
}

:global(.dark) .tree-children,
:global(.dark) .tree-people {
  border-left-color: rgb(75 85 99);
}

:global(.dark) .tree-node--nested::before {
  background-color: rgb(75 85 99);
}

.hierarchy-reorder-slot {
  height: 0.5rem;
  margin: 0.125rem 0;
  border-radius: 9999px;
  transition: height 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.hierarchy-reorder-slot-active {
  height: 0.625rem;
  background: rgb(16 185 129);
  box-shadow: 0 0 0 2px rgb(16 185 129 / 0.25);
}

:global(.dark) .hierarchy-reorder-slot-active {
  background: rgb(52 211 153);
}

.role-card {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  width: min(100%, 440px);
  min-height: 2.75rem;
  padding: 0.375rem 0.625rem;
  border-radius: 0.625rem;
  box-shadow: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
}

.role-card:focus-visible {
  border-color: rgb(129 140 248);
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.2);
}

.role-card-depth-root {
  min-height: 2.875rem;
}

.role-card:hover {
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.06);
}

:global(.dark) .role-card:hover {
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.2);
}

.role-card-drop {
  border-color: rgb(129 140 248) !important;
  box-shadow: 0 0 0 3px rgb(99 102 241 / 0.2) !important;
}

.role-card-user-drop {
  border-color: rgb(56 189 248) !important;
  box-shadow: 0 0 0 3px rgb(14 165 233 / 0.2) !important;
}

.role-card-draggable {
  cursor: grab;
  touch-action: none;
}

.role-card-draggable:active {
  cursor: grabbing;
}

.role-card-dragging {
  opacity: 0.4;
  cursor: grabbing;
}

.role-card-body {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  flex: 1;
  padding: 0;
  text-align: left;
}

.role-card-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  flex-shrink: 0;
}

.role-card-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 0.125rem;
}

.role-card-name {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.25;
}

.role-card-trail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.role-avatar-stack {
  display: inline-flex;
  align-items: center;
}

.role-avatar-stack-item {
  margin-left: -0.4rem;
  border-radius: 9999px;
}

.role-avatar-stack-item:first-child {
  margin-left: 0;
}

.role-avatar-stack-item :deep(img),
.role-avatar-stack-item :deep(div) {
  border-radius: 9999px !important;
}

.role-avatar-overflow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  margin-left: -0.35rem;
  padding: 0 0.25rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 700;
}

.role-card-count {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-width: 2rem;
  padding: 0.1875rem 0.4375rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.6875rem;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tree-people {
  margin: 0.125rem 0 0.125rem 1.625rem;
  padding: 0.125rem 0 0.125rem 0.75rem;
  border-left: 1px solid var(--tree-line-color, rgb(226 232 240));
}

.tree-user-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1875rem 0;
  position: relative;
}

.tree-user-loading,
.tree-user-empty {
  font-size: 0.75rem;
  padding: 0.25rem 0;
}

.tree-user-spinner {
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 9999px;
  animation: hierarchy-user-spin 0.8s linear infinite;
}

.tree-user-loading {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

@keyframes hierarchy-user-spin {
  to { transform: rotate(360deg); }
}

.user-leaf {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: min(100%, 360px);
  min-height: 2.125rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.5rem;
  text-align: left;
  box-shadow: none;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.tree-branch--compact .tree-node {
  min-height: 2.125rem;
  padding: 0.125rem 0;
}

:global(.hierarchy-canvas-compact) .role-card {
  min-height: 2.5rem;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
}

:global(.hierarchy-canvas-compact) .role-card-depth-root {
  min-height: 2.625rem;
}

:global(.hierarchy-canvas-compact) .role-card-name {
  font-size: 0.8125rem;
}

:global(.hierarchy-canvas-compact) .user-leaf {
  min-height: 2rem;
}

.user-leaf-drag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 0.375rem;
  cursor: grab;
  touch-action: none;
  flex-shrink: 0;
}

.user-leaf-drag:active {
  cursor: grabbing;
}

.user-leaf-dragging {
  opacity: 0.45;
}

.user-leaf-match {
  border-color: rgb(250 204 21) !important;
  box-shadow: 0 0 0 2px rgb(250 204 21 / 0.25);
}

:global(.dark) .user-leaf-match {
  border-color: rgb(202 138 4) !important;
  box-shadow: 0 0 0 2px rgb(202 138 4 / 0.2);
}

.user-leaf-avatar-wrap :deep(img),
.user-leaf-avatar-wrap :deep(div) {
  border-radius: 9999px !important;
}

.tree-user-invite {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  min-height: 1.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: none;
  font-size: 0.6875rem;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.hierarchy-search-mark {
  border-radius: 0.125rem;
  background: rgb(254 240 138);
  color: inherit;
  padding: 0 0.125rem;
}

:global(.dark) .hierarchy-search-mark {
  background: rgb(120 53 15 / 0.55);
  color: rgb(254 243 199);
}

.user-leaf-avatar-wrap {
  flex-shrink: 0;
}

.user-leaf-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-leaf-name {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-leaf-email {
  font-size: 0.6875rem;
  line-height: 1.2;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-leaf-badge {
  flex-shrink: 0;
  padding: 0.125rem 0.375rem;
  border-radius: 9999px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.tree-node-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.tree-node:hover .tree-node-actions,
.tree-node:focus-within .tree-node-actions {
  opacity: 1;
  pointer-events: auto;
}

.tree-node-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
</style>
