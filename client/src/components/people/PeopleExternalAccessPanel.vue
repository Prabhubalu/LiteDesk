<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import apiClient from '@/utils/apiClient';
import {
  capturePortalEnabled,
  capturePortalDisabled,
  capturePortalSessionsTerminated
} from '@/config/posthogPortal';
import { isPortalFrameworkV1Enabled } from '@/utils/portalFeatureFlags';

const props = defineProps({
  peopleId: { type: String, required: true }
});

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const actionLoading = ref(false);
const error = ref('');
const notice = ref('');
const state = ref(null);
const showEnableModal = ref(false);
const showAssignModal = ref(false);
const showAuditHistory = ref(false);
const auditEvents = ref([]);
const auditLoading = ref(false);
const selectedRoleIds = ref([]);

const canManage = computed(() =>
  authStore.isAdminLike || authStore.can('settings', 'manageUsers')
);

const frameworkEnabled = computed(() =>
  isPortalFrameworkV1Enabled(authStore.organization)
);

const visible = computed(() =>
  Boolean(props.peopleId) && canManage.value && frameworkEnabled.value
);

const portalEnabled = computed(() => state.value?.portalAccess?.enabled === true);
const portalUser = computed(() => state.value?.user || null);
const assignedRoles = computed(() => state.value?.roles || []);
const availableRoles = computed(() =>
  (state.value?.availableExternalRoles || []).filter(
    (role) => String(role.name || '').trim().toLowerCase() !== 'portal viewer'
  )
);
const eligibility = computed(() => state.value?.eligibility || null);
const usage = computed(() => state.value?.usage || null);
const activeExternalUsers = computed(() => usage.value?.active ?? 0);

const defaultPortalName = computed(() => {
  const defaultId = portalUser.value?.defaultExternalRoleId;
  if (!defaultId) return null;
  const match = assignedRoles.value.find((r) => String(r._id) === String(defaultId));
  return match?.name || null;
});

const unassignedRoles = computed(() => {
  const assignedIds = new Set(assignedRoles.value.map((r) => String(r._id)));
  return availableRoles.value.filter((r) => !assignedIds.has(String(r.roleId || r._id)));
});

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return String(value);
  }
}

function statusBadgeClass(status) {
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
  if (!visible.value || !props.peopleId) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiClient.get(`/people/${props.peopleId}/portal`);
    state.value = response?.data ?? response;
  } catch (err) {
    const code = err?.response?.data?.code;
    if (code === 'PORTAL_FRAMEWORK_DISABLED') {
      state.value = null;
      return;
    }
    error.value = err?.message || t('people.externalAccessLoadFailed');
  } finally {
    loading.value = false;
  }
}

async function runAction(fn, successMessage) {
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
  } catch (err) {
    error.value = err?.message || t('people.externalAccessActionFailed');
  } finally {
    actionLoading.value = false;
  }
}

function openEnableModal() {
  selectedRoleIds.value = availableRoles.value.length === 1
    ? [String(availableRoles.value[0].roleId || availableRoles.value[0]._id)]
    : [];
  showEnableModal.value = true;
}

function openAssignModal() {
  selectedRoleIds.value = [];
  showAssignModal.value = true;
}

function toggleRoleSelection(roleId) {
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
  await runAction(
    async () => {
      await apiClient.post(`/people/${props.peopleId}/portal/enable`, {
        roleIds: selectedRoleIds.value
      });
      try {
        capturePortalEnabled(props.peopleId, { role_count: selectedRoleIds.value.length });
      } catch (_e) {
        /* optional */
      }
    },
    t('people.externalAccessEnabledSuccess')
  );
}

async function confirmAssignRoles() {
  if (!selectedRoleIds.value.length) {
    error.value = t('people.externalAccessRolesRequired');
    return;
  }
  showAssignModal.value = false;
  await runAction(
    () => apiClient.post(`/people/${props.peopleId}/portal/roles`, {
      roleIds: selectedRoleIds.value
    }),
    t('people.externalAccessRolesAssignedSuccess')
  );
}

async function disablePortal() {
  if (!window.confirm(t('people.externalAccessDisableConfirm'))) return;
  await runAction(
    async () => {
      await apiClient.post(`/people/${props.peopleId}/portal/disable`);
      try {
        capturePortalDisabled(props.peopleId);
      } catch (_e) {
        /* optional */
      }
    },
    t('people.externalAccessDisabledSuccess')
  );
}

async function removeRole(roleId) {
  if (!window.confirm(t('people.externalAccessRemoveRoleConfirm'))) return;
  await runAction(
    () => apiClient.delete(`/people/${props.peopleId}/portal/roles/${roleId}`),
    t('people.externalAccessRoleRemovedSuccess')
  );
}

async function resendInvite() {
  await runAction(
    () => apiClient.post(`/people/${props.peopleId}/portal/resend-invite`),
    t('people.externalAccessInviteSentSuccess')
  );
}

async function resetPassword() {
  if (!window.confirm(t('people.externalAccessResetPasswordConfirm'))) return;
  await runAction(
    () => apiClient.post(`/people/${props.peopleId}/portal/reset-password`),
    t('people.externalAccessPasswordResetSuccess')
  );
}

async function terminateSessions() {
  if (!window.confirm(t('people.externalAccessTerminateSessionsConfirm'))) return;
  await runAction(
    async () => {
      await apiClient.post(`/people/${props.peopleId}/portal/terminate-sessions`);
      try {
        capturePortalSessionsTerminated(props.peopleId);
      } catch (_e) {
        /* optional */
      }
    },
    t('people.externalAccessSessionsTerminatedSuccess')
  );
}

async function loadAuditHistory() {
  auditLoading.value = true;
  try {
    const response = await apiClient.get(`/people/${props.peopleId}/portal/audit`, {
      params: { limit: 25 }
    });
    auditEvents.value = response?.data?.events || response?.events || [];
  } catch (err) {
    error.value = err?.message || t('people.externalAccessAuditLoadFailed');
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
  () => [props.peopleId, visible.value],
  () => {
    if (visible.value) {
      void loadState();
    }
  },
  { immediate: true }
);
</script>

<template>
  <section
    v-if="visible"
    class="record-state-section mb-8 mt-4 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-gray-50/60 dark:bg-gray-800/40"
    aria-labelledby="external-access-heading"
  >
    <div class="px-4 py-3 border-b border-gray-200/80 dark:border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('people.externalAccessBadge') }}
        </p>
        <h3 id="external-access-heading" class="text-base font-semibold text-gray-900 dark:text-white">
          {{ t('people.externalAccessTitle') }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ t('people.externalAccessSubtitle') }}
        </p>
      </div>
      <div v-if="portalEnabled" class="inline-flex items-center gap-2">
        <span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
          {{ t('people.externalAccessEnabled') }}
        </span>
      </div>
    </div>

    <div class="px-4 py-4 space-y-4">
      <div
        v-if="error"
        class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
      >
        {{ error }}
      </div>
      <div
        v-if="notice"
        class="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200"
      >
        {{ notice }}
      </div>

      <div v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('people.externalAccessLoading') }}
      </div>

      <template v-else-if="state">
        <div
          v-if="eligibility && !eligibility.eligible"
          class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
        >
          {{ t('people.externalAccessIneligible') }}
          <span v-if="eligibility.reason" class="block text-xs mt-1 opacity-80">{{ eligibility.reason }}</span>
        </div>

        <div
          v-if="usage"
          class="rounded-lg border border-gray-200/80 bg-white/60 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-200"
        >
          {{ t('people.externalAccessUsageActive', { count: activeExternalUsers }) }}
        </div>

        <div v-if="!portalEnabled" class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-gray-600 dark:text-gray-300">
            {{ t('people.externalAccessDisabledHint') }}
          </p>
          <button
            type="button"
            class="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            :disabled="actionLoading || (eligibility && !eligibility.eligible)"
            @click="openEnableModal"
          >
            {{ t('people.externalAccessEnable') }}
          </button>
        </div>

        <template v-else>
          <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessUserId') }}</dt>
              <dd class="mt-1 text-sm font-mono text-gray-900 dark:text-white break-all">{{ portalUser?._id || '—' }}</dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessUserStatus') }}</dt>
              <dd class="mt-1">
                <span
                  class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="statusBadgeClass(portalUser?.status)"
                >
                  {{ portalUser?.status || '—' }}
                </span>
              </dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessLastLogin') }}</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(portalUser?.lastLogin) }}</dd>
            </div>
            <div>
              <dt class="text-xs text-gray-500 dark:text-gray-400">{{ t('people.externalAccessDefaultPortal') }}</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ defaultPortalName || '—' }}</dd>
            </div>
          </dl>

          <div>
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {{ t('people.externalAccessAssignedRoles') }}
            </h4>
            <ul v-if="assignedRoles.length" class="space-y-2">
              <li
                v-for="role in assignedRoles"
                :key="String(role._id)"
                class="flex items-center justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <span class="text-sm text-gray-900 dark:text-white">{{ role.name }}</span>
                <button
                  type="button"
                  class="text-xs font-medium text-red-600 hover:text-red-500 dark:text-red-400"
                  :disabled="actionLoading || assignedRoles.length <= 1"
                  @click="removeRole(role._id)"
                >
                  {{ t('people.externalAccessRemoveRole') }}
                </button>
              </li>
            </ul>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('people.externalAccessNoRoles') }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
              :disabled="actionLoading || !unassignedRoles.length"
              @click="openAssignModal"
            >
              {{ t('people.externalAccessAssignRoles') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
              :disabled="actionLoading"
              @click="resendInvite"
            >
              {{ t('people.externalAccessResendInvite') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
              :disabled="actionLoading"
              @click="resetPassword"
            >
              {{ t('people.externalAccessResetPassword') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
              :disabled="actionLoading"
              @click="terminateSessions"
            >
              {{ t('people.externalAccessTerminateSessions') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-60"
              :disabled="actionLoading"
              @click="toggleAuditHistory"
            >
              {{ showAuditHistory ? t('people.externalAccessHideHistory') : t('people.externalAccessViewHistory') }}
            </button>
            <button
              type="button"
              class="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-900/20 disabled:opacity-60"
              :disabled="actionLoading"
              @click="disablePortal"
            >
              {{ t('people.externalAccessDisable') }}
            </button>
          </div>

          <div v-if="showAuditHistory" class="border-t border-gray-200 dark:border-gray-700 pt-3">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {{ t('people.externalAccessLoginHistory') }}
            </h4>
            <p v-if="auditLoading" class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('people.externalAccessLoading') }}
            </p>
            <ul v-else-if="auditEvents.length" class="space-y-2 max-h-56 overflow-y-auto">
              <li
                v-for="event in auditEvents"
                :key="String(event._id)"
                class="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-gray-900 dark:text-white">{{ event.type }}</span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(event.timestamp) }}</span>
                </div>
                <p v-if="event.description" class="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {{ event.description }}
                </p>
              </li>
            </ul>
            <p v-else class="text-sm text-gray-500 dark:text-gray-400">
              {{ t('people.externalAccessNoHistory') }}
            </p>
          </div>
        </template>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="showEnableModal || showAssignModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="showEnableModal = false; showAssignModal = false"
      >
        <div class="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
          <div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ showEnableModal ? t('people.externalAccessEnable') : t('people.externalAccessAssignRoles') }}
            </h3>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ t('people.externalAccessSelectRolesHint') }}
            </p>
          </div>
          <div class="px-5 py-4 space-y-2 max-h-72 overflow-y-auto">
            <label
              v-for="role in (showEnableModal ? availableRoles : unassignedRoles)"
              :key="String(role.roleId || role._id)"
              class="flex items-start gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900/40"
            >
              <input
                type="checkbox"
                class="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                :checked="selectedRoleIds.includes(String(role.roleId || role._id))"
                @change="toggleRoleSelection(role.roleId || role._id)"
              />
              <span>
                <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ role.name }}</span>
                <span v-if="role.description" class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {{ role.description }}
                </span>
              </span>
            </label>
            <p
              v-if="!(showEnableModal ? availableRoles : unassignedRoles).length"
              class="text-sm text-gray-500 dark:text-gray-400"
            >
              {{ t('people.externalAccessNoAvailableRoles') }}
            </p>
          </div>
          <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:text-gray-200"
              @click="showEnableModal = false; showAssignModal = false"
            >
              {{ t('people.externalAccessCancel') }}
            </button>
            <button
              type="button"
              class="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              :disabled="!selectedRoleIds.length || actionLoading"
              @click="showEnableModal ? confirmEnable() : confirmAssignRoles()"
            >
              {{ showEnableModal ? t('people.externalAccessEnable') : t('people.externalAccessAssignRoles') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
