import { computed, ref } from 'vue';
import apiClient from '@/utils/apiClient';

function formatUserLabel(user) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  if (name && user?.email) return `${name} (${user.email})`;
  return name || user?.email || String(user?._id || '');
}

export function usePlaybookAssignmentTargets() {
  const users = ref([]);
  const roles = ref([]);
  const groups = ref([]);
  const loading = ref(false);
  const loaded = ref(false);

  async function loadAssignmentTargets() {
    if (loaded.value || loading.value) return;
    loading.value = true;
    try {
      const [usersRes, rolesRes, groupsRes] = await Promise.all([
        apiClient.get('/users/list', { params: { limit: 500 } }),
        apiClient.get('/roles'),
        apiClient.get('/groups', {
          params: {
            page: 1,
            limit: 500,
            sortBy: 'name',
            sortOrder: 'asc',
            isActive: 'true'
          }
        })
      ]);

      users.value = usersRes?.success && Array.isArray(usersRes.data) ? usersRes.data : [];
      roles.value = rolesRes?.success && Array.isArray(rolesRes.data) ? rolesRes.data : [];
      groups.value = groupsRes?.success && Array.isArray(groupsRes.data) ? groupsRes.data : [];
      loaded.value = true;
    } catch (error) {
      console.error('[usePlaybookAssignmentTargets] load failed:', error?.message || error);
    } finally {
      loading.value = false;
    }
  }

  const userOptions = computed(() =>
    users.value.map((user) => ({
      value: String(user._id),
      label: formatUserLabel(user)
    }))
  );

  const roleOptions = computed(() =>
    roles.value.map((role) => ({
      value: String(role._id),
      label: role.name || String(role._id)
    }))
  );

  const teamOptions = computed(() =>
    groups.value.map((group) => ({
      value: String(group._id),
      label: group.name || String(group._id)
    }))
  );

  function getOptionsForAssignmentType(type) {
    if (type === 'specific_user') return userOptions.value;
    if (type === 'role') return roleOptions.value;
    if (type === 'team') return teamOptions.value;
    return [];
  }

  function resolveTargetLabel(type, targetId) {
    if (!targetId) return '';
    const options = getOptionsForAssignmentType(type);
    const match = options.find((option) => String(option.value) === String(targetId));
    return match?.label || '';
  }

  function syncLegacyAssignmentTarget(assignment) {
    if (!assignment?.targetName || assignment.targetId) return false;
    const targetName = String(assignment.targetName).trim().toLowerCase();
    if (!targetName) return false;

    const options = getOptionsForAssignmentType(assignment.type);
    const match = options.find((option) => {
      const label = String(option.label || '').trim().toLowerCase();
      return label === targetName || label.startsWith(`${targetName} (`);
    });

    if (!match) return false;
    assignment.targetId = match.value;
    assignment.targetName = match.label;
    if (assignment.type === 'role') {
      assignment.targetType = 'role';
    } else if (assignment.type === 'team') {
      assignment.targetType = 'team';
    } else if (assignment.type === 'specific_user') {
      assignment.targetType = 'user';
    }
    return true;
  }

  function applyAssignmentTarget(assignment, targetId) {
    if (!assignment) return;
    const normalizedId = targetId ? String(targetId) : null;
    assignment.targetId = normalizedId;
    assignment.targetName = normalizedId ? resolveTargetLabel(assignment.type, normalizedId) : '';
    if (assignment.type === 'role') {
      assignment.targetType = normalizedId ? 'role' : '';
    } else if (assignment.type === 'team') {
      assignment.targetType = normalizedId ? 'team' : '';
    } else if (assignment.type === 'specific_user') {
      assignment.targetType = normalizedId ? 'user' : '';
    } else {
      assignment.targetType = '';
    }
  }

  function clearAssignmentTarget(assignment) {
    applyAssignmentTarget(assignment, null);
  }

  return {
    loading,
    loaded,
    loadAssignmentTargets,
    userOptions,
    roleOptions,
    teamOptions,
    getOptionsForAssignmentType,
    syncLegacyAssignmentTarget,
    applyAssignmentTarget,
    clearAssignmentTarget
  };
}
