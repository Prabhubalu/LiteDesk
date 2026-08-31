import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import {
  capturePortalDisabled,
  capturePortalEnabled,
  capturePortalSessionsTerminated
} from '@/config/posthogPortal';
import { isPortalFrameworkV1Enabled } from '@/utils/portalFeatureFlags';
import { confirmAction } from '@/composables/useConfirmAction';
import { formatUserDateTime } from '@/utils/localeFormat';

interface PortalRole {
  _id: string;
  name: string;
  roleId?: string;
  description?: string;
}

interface PortalAccessPayload {
  portalAccess?: { enabled?: boolean };
  user?: {
    _id?: string;
    status?: string;
    lastLogin?: string;
    defaultExternalRoleId?: string;
  };
  roles?: PortalRole[];
  availableExternalRoles?: PortalRole[];
  eligibility?: { eligible?: boolean; reason?: string };
  usage?: { active?: number };
}

interface PortalAuditEvent {
  _id: string;
  type: string;
  timestamp: string;
  description?: string;
}

export type PeoplePortalAccessContext = {
  isEligible: boolean;
  visible: boolean;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  notice: string;
  state: PortalAccessPayload | null;
  portalEnabled: boolean;
  portalUser: PortalAccessPayload['user'] | null;
  assignedRoles: PortalRole[];
  availableRoles: PortalRole[];
  eligibility: PortalAccessPayload['eligibility'] | null;
  usage: PortalAccessPayload['usage'] | null;
  activeExternalUsers: number;
  defaultPortalName: string | null;
  unassignedRoles: PortalRole[];
  chipLabel: string | null;
  compactSummary: string;
  showEnableModal: boolean;
  showAssignModal: boolean;
  showAuditHistory: boolean;
  auditEvents: PortalAuditEvent[];
  auditLoading: boolean;
  selectedRoleIds: string[];
  loadState: () => Promise<void>;
  openEnableModal: () => void;
  openAssignModal: () => void;
  toggleRoleSelection: (roleId: string) => void;
  confirmEnable: () => Promise<void>;
  confirmAssignRoles: () => Promise<void>;
  disablePortal: () => Promise<void>;
  removeRole: (roleId: string) => Promise<void>;
  resendInvite: () => Promise<void>;
  resetPassword: () => Promise<void>;
  terminateSessions: () => Promise<void>;
  loadAuditHistory: () => Promise<void>;
  toggleAuditHistory: () => Promise<void>;
  formatDate: (value: string | undefined | null) => string;
  statusBadgeClass: (status: string | undefined) => string;
};

const storeCache = new Map<string, PeoplePortalAccessContext>();

function createPortalAccessStore(peopleId: string): PeoplePortalAccessContext {
  const { t } = useI18n();
  const authStore = useAuthStore();

  const loading = ref(false);
  const actionLoading = ref(false);
  const error = ref('');
  const notice = ref('');
  const state = ref<PortalAccessPayload | null>(null);
  const showEnableModal = ref(false);
  const showAssignModal = ref(false);
  const showAuditHistory = ref(false);
  const auditEvents = ref<PortalAuditEvent[]>([]);
  const auditLoading = ref(false);
  const selectedRoleIds = ref<string[]>([]);

  const isEligible = computed(
    () =>
      (authStore.isAdminLike || authStore.can('settings', 'manageUsers')) &&
      isPortalFrameworkV1Enabled(authStore.organization)
  );

  const visible = computed(() => Boolean(peopleId) && isEligible.value);

  const portalEnabled = computed(() => state.value?.portalAccess?.enabled === true);
  const portalUser = computed(() => state.value?.user ?? null);
  const assignedRoles = computed(() => state.value?.roles ?? []);
  const availableRoles = computed(() =>
    (state.value?.availableExternalRoles ?? []).filter(
      (role) => String(role.name || '').trim().toLowerCase() !== 'portal viewer'
    )
  );
  const eligibility = computed(() => state.value?.eligibility ?? null);
  const usage = computed(() => state.value?.usage ?? null);
  const activeExternalUsers = computed(() => usage.value?.active ?? 0);

  const defaultPortalName = computed(() => {
    const defaultId = portalUser.value?.defaultExternalRoleId;
    if (!defaultId) return null;
    const match = assignedRoles.value.find((r) => String(r._id) === String(defaultId));
    return match?.name ?? null;
  });

  const unassignedRoles = computed(() => {
    const assignedIds = new Set(assignedRoles.value.map((r) => String(r._id)));
    return availableRoles.value.filter((r) => !assignedIds.has(String(r.roleId || r._id)));
  });

  const chipLabel = computed(() => {
    if (!isEligible.value) return null;
    if (loading.value) return t('people.accessChipPortalLoading');
    if (portalEnabled.value) return t('people.accessChipPortalEnabled');
    return t('people.accessChipPortalNotConfigured');
  });

  const compactSummary = computed(() => {
    if (loading.value) return t('people.externalAccessLoading');
    if (!state.value) return t('people.accessNotConfigured');
    if (eligibility.value && !eligibility.value.eligible) {
      return t('people.externalAccessIneligible');
    }
    if (!portalEnabled.value) return t('people.accessNotConfigured');
    const roles = assignedRoles.value.length;
    const lastLogin = portalUser.value?.lastLogin
      ? formatDate(portalUser.value.lastLogin)
      : t('people.accessNeverLoggedIn');
    return t('people.accessPortalCompactSummary', { roles, lastLogin });
  });

  function formatDate(value: string | undefined | null) {
    if (!value) return '—';
    try {
      return formatUserDateTime(value);
    } catch {
      return String(value);
    }
  }

  function statusBadgeClass(status: string | undefined) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'active') {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
    }
    if (normalized === 'inactive' || normalized === 'disabled') {
      return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200';
  }

  async function loadState() {
    if (!visible.value) return;
    loading.value = true;
    error.value = '';
    try {
      const response = await apiClient.get(`/people/${peopleId}/portal`);
      state.value = (response?.data ?? response) as PortalAccessPayload;
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === 'PORTAL_FRAMEWORK_DISABLED') {
        state.value = null;
        return;
      }
      const message = err instanceof Error ? err.message : t('people.externalAccessLoadFailed');
      error.value = message;
    } finally {
      loading.value = false;
    }
  }

  async function runAction(fn: () => Promise<void>, successMessage?: string) {
    actionLoading.value = true;
    error.value = '';
    notice.value = '';
    try {
      await fn();
      notice.value = successMessage || t('people.externalAccessActionSuccess');
      await loadState();
      if (showAuditHistory.value) {
        await loadAuditHistory();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('people.externalAccessActionFailed');
      error.value = message;
    } finally {
      actionLoading.value = false;
    }
  }

  function openEnableModal() {
    const soleRole = availableRoles.value.length === 1 ? availableRoles.value[0] : null;
    selectedRoleIds.value =
      soleRole != null ? [String(soleRole.roleId || soleRole._id)] : [];
    showEnableModal.value = true;
  }

  function openAssignModal() {
    selectedRoleIds.value = [];
    showAssignModal.value = true;
  }

  function toggleRoleSelection(roleId: string) {
    const id = String(roleId);
    const set = new Set(selectedRoleIds.value.map(String));
    if (set.has(id)) {
      set.delete(id);
    } else {
      set.add(id);
    }
    selectedRoleIds.value = [...set];
  }

  async function confirmEnable() {
    if (!selectedRoleIds.value.length) {
      error.value = t('people.externalAccessRolesRequired');
      return;
    }
    showEnableModal.value = false;
    await runAction(async () => {
      await apiClient.post(`/people/${peopleId}/portal/enable`, {
        roleIds: selectedRoleIds.value
      });
      try {
        capturePortalEnabled(peopleId, { role_count: selectedRoleIds.value.length });
      } catch {
        /* optional */
      }
    }, t('people.externalAccessEnabledSuccess'));
  }

  async function confirmAssignRoles() {
    if (!selectedRoleIds.value.length) {
      error.value = t('people.externalAccessRolesRequired');
      return;
    }
    showAssignModal.value = false;
    await runAction(
      () =>
        apiClient.post(`/people/${peopleId}/portal/roles`, {
          roleIds: selectedRoleIds.value
        }),
      t('people.externalAccessRolesAssignedSuccess')
    );
  }

  async function disablePortal() {
    if (!(await confirmAction(t('people.externalAccessDisableConfirm')))) return;
    await runAction(async () => {
      await apiClient.post(`/people/${peopleId}/portal/disable`);
      try {
        capturePortalDisabled(peopleId);
      } catch {
        /* optional */
      }
    }, t('people.externalAccessDisabledSuccess'));
  }

  async function removeRole(roleId: string) {
    if (!(await confirmAction(t('people.externalAccessRemoveRoleConfirm')))) return;
    await runAction(
      () => apiClient.delete(`/people/${peopleId}/portal/roles/${roleId}`),
      t('people.externalAccessRoleRemovedSuccess')
    );
  }

  async function resendInvite() {
    await runAction(
      () => apiClient.post(`/people/${peopleId}/portal/resend-invite`),
      t('people.externalAccessInviteSentSuccess')
    );
  }

  async function resetPassword() {
    if (!(await confirmAction(t('people.externalAccessResetPasswordConfirm')))) return;
    await runAction(
      () => apiClient.post(`/people/${peopleId}/portal/reset-password`),
      t('people.externalAccessPasswordResetSuccess')
    );
  }

  async function terminateSessions() {
    if (!(await confirmAction(t('people.externalAccessTerminateSessionsConfirm')))) return;
    await runAction(async () => {
      await apiClient.post(`/people/${peopleId}/portal/terminate-sessions`);
      try {
        capturePortalSessionsTerminated(peopleId);
      } catch {
        /* optional */
      }
    }, t('people.externalAccessSessionsTerminatedSuccess'));
  }

  async function loadAuditHistory() {
    auditLoading.value = true;
    try {
      const response = await apiClient.get(`/people/${peopleId}/portal/audit`, {
        params: { limit: 25 }
      });
      auditEvents.value = response?.data?.events || response?.events || [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('people.externalAccessAuditLoadFailed');
      error.value = message;
    } finally {
      auditLoading.value = false;
    }
  }

  async function toggleAuditHistory() {
    showAuditHistory.value = !showAuditHistory.value;
    if (showAuditHistory.value && !auditEvents.value.length) {
      await loadAuditHistory();
    }
  }

  watch(
    visible,
    (isVisible) => {
      if (isVisible) {
        void loadState();
      }
    },
    { immediate: true }
  );

  return reactive({
    isEligible,
    visible,
    loading,
    actionLoading,
    error,
    notice,
    state,
    portalEnabled,
    portalUser,
    assignedRoles,
    availableRoles,
    eligibility,
    usage,
    activeExternalUsers,
    defaultPortalName,
    unassignedRoles,
    chipLabel,
    compactSummary,
    showEnableModal,
    showAssignModal,
    showAuditHistory,
    auditEvents,
    auditLoading,
    selectedRoleIds,
    loadState,
    openEnableModal,
    openAssignModal,
    toggleRoleSelection,
    confirmEnable,
    confirmAssignRoles,
    disablePortal,
    removeRole,
    resendInvite,
    resetPassword,
    terminateSessions,
    loadAuditHistory,
    toggleAuditHistory,
    formatDate,
    statusBadgeClass
  }) as PeoplePortalAccessContext;
}

export function resolvePeoplePortalAccess(
  peopleIdRef: ComputedRef<string | null | undefined> | Ref<string | null | undefined>
): ComputedRef<PeoplePortalAccessContext | null> {
  const peopleId = computed(() => {
    const value = peopleIdRef.value;
    return value ? String(value) : null;
  });

  return computed(() => {
    const id = peopleId.value;
    if (!id) return null;
    if (!storeCache.has(id)) {
      storeCache.set(id, createPortalAccessStore(id));
    }
    return storeCache.get(id)!;
  });
}
