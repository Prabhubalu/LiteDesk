<template>
  <Teleport to="body">
    <div
      v-if="isOpen && user"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all">
          <!-- Header -->
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 rounded-t-2xl z-10">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('settings.editUserTitle') }}</h2>
              <button
                @click="close"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                :aria-label="t('common.closePanel')"
              >
                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-6">
            <!-- User Info (Read-only) -->
            <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {{ user.firstName?.[0] || 'U' }}{{ user.lastName?.[0] || '' }}
              </div>
              <div>
                <p class="font-semibold text-gray-900 dark:text-white text-lg">
                  {{ user.firstName }} {{ user.lastName }}
                </p>
                <p class="text-sm text-gray-600 dark:text-gray-400">{{ user.email }}</p>
              </div>
            </div>

            <!-- Role -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('settings.inviteRole') }} *
              </label>
              <select
                v-model="form.roleId"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              >
                <option value="">{{ t('settings.inviteSelectRole') }}</option>
                <option v-for="role in availableRoles" :key="role._id" :value="role._id">
                  {{ role.name }} - {{ role.description }}
                </option>
              </select>
            </div>

            <!-- Status -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('settings.editUserStatus') }} *
              </label>
              <select
                v-model="form.status"
                required
                class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
              >
                <option value="active">{{ t('settings.editUserStatusActive') }}</option>
                <option value="inactive">{{ t('settings.editUserStatusInactive') }}</option>
                <option value="suspended">{{ t('settings.editUserStatusSuspended') }}</option>
              </select>
            </div>

            <!-- App Access -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {{ t('settings.inviteAppAccess') }} *
              </label>
              <div v-if="loadingCapabilities" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('settings.inviteLoadingApps') }}
              </div>
              <div v-else-if="availableApps.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                {{ t('settings.editUserNoAppsType') }}
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="app in availableApps"
                  :key="app.appKey"
                  class="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  :class="{
                    'bg-gray-50 dark:bg-gray-900/50': isAppSelected(app.appKey),
                    'opacity-50': !isAppEnabled(app)
                  }"
                >
                  <div class="flex items-start gap-3">
                    <HeadlessCheckbox
                      :id="`edit-app-${app.appKey}`"
                      :checked="isAppSelected(app.appKey)"
                      :disabled="!isAppEnabled(app)"
                      @change="toggleApp(app)"
                      checkbox-class="mt-1 w-4 h-4 text-indigo-600 focus:ring-indigo-500 rounded"
                    />
                    <div class="flex-1">
                      <label
                        :for="`edit-app-${app.appKey}`"
                        class="flex items-center justify-between cursor-pointer"
                        :class="{ 'cursor-not-allowed': !isAppEnabled(app) }"
                      >
                        <div>
                          <div class="font-medium text-gray-900 dark:text-white">
                            {{ getAppDisplayName(app.appKey) }}
                          </div>
                          <div v-if="app.seatInfo && app.seatInfo.limit !== null" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {{ t('settings.inviteSeatsUsed', { used: app.seatInfo.used, limit: app.seatInfo.limit }) }}
                            <span v-if="app.seatInfo.available === 0" class="text-red-600 dark:text-red-400 font-medium">
                              {{ t('settings.inviteNoSeats') }}
                            </span>
                            <span v-else-if="app.seatInfo.available !== null" class="text-green-600 dark:text-green-400">
                              {{ t('settings.inviteSeatsAvailable', { count: app.seatInfo.available }) }}
                            </span>
                          </div>
                        </div>
                      </label>

                      <div v-if="isAppSelected(app.appKey)" class="mt-3 ml-7">
                        <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {{ t('settings.inviteRoleForApp', { app: getAppDisplayName(app.appKey) }) }}
                        </label>
                        <select
                          v-model="selectedAppRoles[app.appKey]"
                          @change="updateAppRole(app.appKey, $event.target.value)"
                          class="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-600 focus:border-transparent transition-all"
                        >
                          <option v-for="roleKey in app.roles" :key="roleKey" :value="roleKey">
                            {{ getRoleDisplayName(app.appKey, roleKey) }}
                          </option>
                        </select>
                      </div>

                      <div v-if="!isAppEnabled(app) && app.seatInfo && !app.seatInfo.canAdd" class="mt-2 ml-7 text-xs text-red-600 dark:text-red-400">
                        {{ app.seatInfo.reason }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p v-if="validationErrors.appAccess" class="text-xs text-red-600 dark:text-red-400 mt-1">
                {{ validationErrors.appAccess }}
              </p>
            </div>

            <!-- Status Change Warning -->
            <div v-if="form.status !== 'active'" class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div class="flex gap-3">
                <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div class="flex-1">
                  <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {{ form.status === 'inactive' ? t('settings.editUserDeactivating') : t('settings.editUserSuspending') }}
                  </p>
                  <p class="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    {{ t('settings.editUserStatusWarning') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Reset Password Option -->
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <p class="text-sm font-medium text-blue-900 dark:text-blue-300">{{ t('settings.editUserResetPassword') }}</p>
                  <p class="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    {{ t('settings.editUserResetPasswordHint') }}
                  </p>
                </div>
                <button
                  type="button"
                  @click="resetPassword"
                  class="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/70 transition-colors"
                >
                  {{ t('settings.editUserReset') }}
                </button>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                @click="deleteUser"
                class="px-5 py-2.5 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
              >
                {{ t('settings.editUserDeleteAccount') }}
              </button>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="close"
                  class="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
                >
                  {{ t('actions.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="saving"
                  class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ saving ? t('settings.editUserSaving') : t('settings.editUserSave') }}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { useAppShellStore } from '@/stores/appShell';
import { invalidateTenantSchemaCaches } from '@/utils/tenantSchemaApiCache';

const { t } = useI18n();

const authStore = useAuthStore();
const appShellStore = useAppShellStore();

const props = defineProps({
  isOpen: Boolean,
  user: Object
});

const emit = defineEmits(['close', 'user-updated']);

const form = ref({
  roleId: '',
  status: 'active'
});

const saving = ref(false);
const error = ref('');
const availableRoles = ref([]);
const capabilities = ref([]);
const loadingCapabilities = ref(false);
const selectedAppRoles = ref({});
const validationErrors = ref({});

const appDisplayNames = {
  CRM: 'CRM',
  AUDIT: 'Audit',
  PORTAL: 'Portal'
};

const roleDisplayNames = {
  CRM: {
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    USER: 'User'
  },
  AUDIT: {
    AUDITOR: 'Auditor'
  },
  PORTAL: {
    CUSTOMER: 'Customer',
    VIEWER: 'Viewer'
  }
};

const availableApps = computed(() => {
  const userType = props.user?.userType || 'INTERNAL';
  return capabilities.value.filter(app =>
    app.userTypesAllowed?.includes(userType)
  );
});

const selectedApps = computed(() => Object.keys(selectedAppRoles.value));

const userDisplayName = (user) => `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

const resolveRoleIdFromUser = (candidateUser) => {
  if (!candidateUser) return '';

  const rawRoleId = candidateUser.roleId;

  // Handle populated role docs and mixed payloads from different settings views.
  if (rawRoleId && typeof rawRoleId === 'object') {
    if (rawRoleId._id) return String(rawRoleId._id);
    if (rawRoleId.id) return String(rawRoleId.id);
  }

  if (typeof rawRoleId === 'string' && rawRoleId.trim()) {
    return rawRoleId.trim();
  }

  const legacyRoleName = String(candidateUser.role || '').trim().toLowerCase();
  if (!legacyRoleName) return '';

  const match = availableRoles.value.find(
    (role) => String(role.name || '').trim().toLowerCase() === legacyRoleName
  );
  return match?._id ? String(match._id) : '';
};

const fetchRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableRoles.value = response.data;
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

const fetchCapabilities = async () => {
  loadingCapabilities.value = true;
  try {
    const response = await apiClient.get('/users/add-capabilities');
    if (response.success) {
      capabilities.value = response.data.apps || [];
    }
  } catch (err) {
    console.error('Error fetching capabilities:', err);
    error.value = t('settings.editUserLoadAppsFailed');
  } finally {
    loadingCapabilities.value = false;
  }
};

const initSelectedAppRoles = () => {
  const next = {};
  const entries = props.user?.appAccess || [];
  entries.forEach((entry) => {
    if (entry?.status === 'ACTIVE' && entry?.appKey && entry?.roleKey) {
      next[entry.appKey] = entry.roleKey;
    }
  });
  selectedAppRoles.value = next;
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    console.log('EditUserModal opened with user:', props.user);
    error.value = '';
    validationErrors.value = {};
    fetchRoles();
    fetchCapabilities();
    // Initialize form when modal opens
    if (props.user) {
      const roleIdValue = resolveRoleIdFromUser(props.user);
      console.log('Setting form.roleId to:', roleIdValue, 'from user:', props.user);
      form.value = {
        roleId: roleIdValue,
        status: props.user.status || 'active'
      };
      initSelectedAppRoles();
    }
  }
});

watch(() => props.user, (newUser) => {
  if (newUser && props.isOpen) {
    const roleIdValue = resolveRoleIdFromUser(newUser);
    console.log('User changed, updating form.roleId to:', roleIdValue);
    
    form.value = {
      roleId: roleIdValue,
      status: newUser.status || 'active'
    };
    initSelectedAppRoles();
  }
});

watch(availableRoles, (roles) => {
  if (!props.isOpen || !props.user || !Array.isArray(roles) || roles.length === 0) return;
  if (form.value.roleId) return;

  const resolvedRoleId = resolveRoleIdFromUser(props.user);
  if (resolvedRoleId) {
    form.value.roleId = resolvedRoleId;
  }
});

const isAppSelected = (appKey) => appKey in selectedAppRoles.value;

const isAppEnabled = (app) => {
  if (!app.seatInfo) return true;
  if (isAppSelected(app.appKey)) return true;
  return app.seatInfo.canAdd;
};

const toggleApp = (app) => {
  const appKey = app.appKey;
  if (isAppSelected(appKey)) {
    delete selectedAppRoles.value[appKey];
  } else {
    const defaultRole = app.defaultRole || app.roles?.[0];
    if (defaultRole) {
      selectedAppRoles.value[appKey] = defaultRole;
    }
  }
  validationErrors.value.appAccess = null;
};

const updateAppRole = (appKey, roleKey) => {
  selectedAppRoles.value[appKey] = roleKey;
};

const getAppDisplayName = (appKey) => appDisplayNames[appKey] || appKey;
const getRoleDisplayName = (appKey, roleKey) => roleDisplayNames[appKey]?.[roleKey] || roleKey;

const validateForm = () => {
  validationErrors.value = {};
  if (selectedApps.value.length === 0) {
    validationErrors.value.appAccess = t('settings.editUserAppAccessRemain');
    return false;
  }
  for (const appKey of selectedApps.value) {
    const app = availableApps.value.find(a => a.appKey === appKey);
    if (app && !isAppEnabled(app)) {
      validationErrors.value.appAccess = app.seatInfo?.reason || `Cannot assign ${getAppDisplayName(appKey)}.`;
      return false;
    }
  }
  return true;
};

const close = () => {
  if (!saving.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  validationErrors.value = {};

  if (!validateForm()) {
    saving.value = false;
    return;
  }

  try {
    const originalRoleId = props.user.roleId?._id || props.user.roleId;
    const appAccessPayload = selectedApps.value.map((appKey) => ({
      appKey,
      roleKey: selectedAppRoles.value[appKey]
    }));
    const payload = props.user?.isOwner
      ? { appAccess: appAccessPayload }
      : { ...form.value, appAccess: appAccessPayload };
    const response = await apiClient.put(`/users/${props.user._id}`, payload);

    if (response.success) {
      // Check if role was changed
      const roleChanged = originalRoleId !== form.value.roleId;
      
      if (roleChanged) {
        console.log('User role updated. Changes will be reflected on their next page refresh or within 2 minutes.');
      }

      // If the editor is editing themselves (e.g. an Owner toggling their own
      // app access), the auth store still holds the pre-edit allowedApps until
      // we re-fetch. Force a profile refresh + drop registry/sidebar caches so
      // the App Switcher reflects the new entitlements without a logout.
      const editingSelf =
        authStore.user?._id && String(authStore.user._id) === String(props.user?._id);
      if (editingSelf) {
        try {
          appShellStore.invalidateAppRegistryCache();
          invalidateTenantSchemaCaches();
          await authStore.refreshUser({ force: true });
        } catch (refreshErr) {
          console.warn('[EditUserModal] Self-edit refresh failed:', refreshErr);
        }
      }

      emit('user-updated');
    } else {
      error.value = response.message || t('settings.editUserUpdateFailed');
    }
  } catch (err) {
    console.error('Error updating user:', err);
    error.value = err.message || t('settings.editUserUpdateFailed');
  } finally {
    saving.value = false;
  }
};

const resetPassword = async () => {
  if (!confirm(t('settings.editUserResetConfirm'))) return;

  try {
    const response = await apiClient.post(`/users/${props.user._id}/reset-password`);

    if (response.success) {
      alert(t('settings.editUserResetSuccess'));
    } else {
      alert(t('settings.editUserResetFailed'));
    }
  } catch (err) {
    console.error('Error resetting password:', err);
    alert(t('settings.editUserResetFailed'));
  }
};

const deleteUser = async () => {
  if (!confirm(t('settings.editUserDeleteConfirm', { name: userDisplayName(props.user) }))) return;

  try {
    const response = await apiClient.delete(`/users/${props.user._id}`);

    if (response.success) {
      emit('user-updated');
    } else {
      alert(t('settings.editUserDeleteFailed'));
    }
  } catch (err) {
    console.error('Error deleting user:', err);
    alert(t('settings.editUserDeleteFailed'));
  }
};
</script>
