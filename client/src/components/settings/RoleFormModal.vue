<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <div class="flex min-h-screen items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"></div>

        <!-- Modal -->
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden transform transition-all">
          <!-- Header -->
          <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 z-10">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ isEditing ? 'Edit Role' : 'Create New Role' }}
              </h2>
              <button
                @click="close"
                class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body -->
          <form @submit.prevent="handleSubmit" class="overflow-y-auto max-h-[calc(90vh-140px)]">
            <div class="p-6 space-y-6">
              <!-- Basic Info Section -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Role Name -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Role Name *
                  </label>
                  <input
                    v-model="form.name"
                    type="text"
                    required
                    :disabled="isEditing && role?.isSystemRole"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="e.g., Sales Manager"
                  />
                </div>

                <!-- Color -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Color
                  </label>
                  <div class="flex gap-2">
                    <input
                      v-model="form.color"
                      type="color"
                      class="w-16 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
                    />
                    <input
                      v-model="form.color"
                      type="text"
                      class="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>

                <!-- Description -->
                <div class="md:col-span-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    v-model="form.description"
                    rows="3"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                    placeholder="Brief description of this role's responsibilities"
                  ></textarea>
                </div>

                <!-- Parent Role -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Parent Role (Optional)
                  </label>
                  <select
                    v-model="form.parentRole"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  >
                    <option value="">None (Top Level)</option>
                    <option v-for="r in availableParentRoles" :key="r._id" :value="r._id">
                      {{ r.name }} (Level {{ r.level }})
                    </option>
                  </select>
                </div>

                <!-- Icon -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Icon
                  </label>
                  <select
                    v-model="form.icon"
                    class="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 dark:focus:ring-brand-600 focus:border-transparent transition-all"
                  >
                    <option value="user">User</option>
                    <option value="users">Users Group</option>
                    <option value="crown">Crown (Owner)</option>
                    <option value="shield">Shield (Admin)</option>
                    <option value="eye">Eye (Viewer)</option>
                  </select>
                </div>
              </div>

              <!-- Additional Settings -->
              <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Additional Settings</h3>
                <div class="space-y-3">
                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="form.canViewAllData"
                      class="w-5 h-5 text-brand-600 focus:ring-brand-500 rounded"
                    />
                    <div>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">Can View All Data</span>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Access to all records regardless of ownership</p>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="form.canManageTeam"
                      class="w-5 h-5 text-brand-600 focus:ring-brand-500 rounded"
                    />
                    <div>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">Can Manage Team</span>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Ability to manage team members and assignments</p>
                    </div>
                  </label>

                  <label class="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      v-model="form.canExportData"
                      class="w-5 h-5 text-brand-600 focus:ring-brand-500 rounded"
                    />
                    <div>
                      <span class="text-sm font-medium text-gray-900 dark:text-white">Can Export Data</span>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Ability to export records to CSV/Excel</p>
                    </div>
                  </label>
                </div>
              </div>

              <!-- Permission Matrix -->
              <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Module Permissions</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Read permission is required to view a module. Update requires Create. Delete requires Update. Import requires Create.
                </p>
                
                <!-- Loading State -->
                <div v-if="loadingModules" class="flex items-center justify-center py-8">
                  <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600"></div>
                </div>

                <!-- Permission Table -->
                <div v-else class="overflow-x-auto">
                  <table class="w-full border-collapse">
                    <thead>
                      <tr class="bg-gray-50 dark:bg-gray-700/50">
                        <th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          Module
                        </th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <div>Read</div>
                          <div class="text-[10px] font-normal normal-case text-gray-500 dark:text-gray-400">View</div>
                        </th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <div>Create</div>
                          <div class="text-[10px] font-normal normal-case text-gray-500 dark:text-gray-400">Add New</div>
                        </th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <div>Update</div>
                          <div class="text-[10px] font-normal normal-case text-gray-500 dark:text-gray-400">Edit</div>
                        </th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <div>Delete</div>
                          <div class="text-[10px] font-normal normal-case text-gray-500 dark:text-gray-400">Remove</div>
                        </th>
                        <th class="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                          <div>Advanced</div>
                          <div class="text-[10px] font-normal normal-case text-gray-500 dark:text-gray-400">Extra</div>
                        </th>
                      </tr>
                    </thead>
                    <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      <tr v-for="module in permissionModules" :key="module.key" class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td class="px-4 py-3">
                          <div>
                            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ module.label }}</p>
                            <p class="text-xs text-gray-500 dark:text-gray-400">{{ module.description }}</p>
                          </div>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            v-model="form.permissions[module.key].read"
                            @change="handleReadChange(module.key)"
                            class="w-4 h-4 text-brand-600 focus:ring-brand-500 rounded"
                          />
                        </td>
                        <td class="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            v-model="form.permissions[module.key].create"
                            @change="handlePermissionChange(module.key, 'create')"
                            class="w-4 h-4 text-brand-600 focus:ring-brand-500 rounded"
                          />
                        </td>
                        <td class="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            v-model="form.permissions[module.key].update"
                            @change="handlePermissionChange(module.key, 'update')"
                            :disabled="!form.permissions[module.key].create"
                            :class="!form.permissions[module.key].create ? 'opacity-50 cursor-not-allowed' : ''"
                            class="w-4 h-4 text-brand-600 focus:ring-brand-500 rounded"
                          />
                        </td>
                        <td class="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            v-model="form.permissions[module.key].delete"
                            @change="handlePermissionChange(module.key, 'delete')"
                            :disabled="!form.permissions[module.key].update"
                            :class="!form.permissions[module.key].update ? 'opacity-50 cursor-not-allowed' : ''"
                            class="w-4 h-4 text-brand-600 focus:ring-brand-500 rounded"
                          />
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-col gap-2 items-center">
                            <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].export"
                                @change="handlePermissionChange(module.key, 'export')"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              Export
                            </label>
                            <label class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].import"
                                @change="handlePermissionChange(module.key, 'import')"
                                :disabled="!form.permissions[module.key].create"
                                :class="!form.permissions[module.key].create ? 'opacity-50 cursor-not-allowed' : ''"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              Import
                            </label>
                            <label v-if="module.key !== 'settings'" class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].viewAll"
                                @change="handlePermissionChange(module.key, 'viewAll')"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              View All
                            </label>
                            <label v-if="module.key === 'settings'" class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].manageUsers"
                                @change="handlePermissionChange(module.key, 'manageUsers')"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              Manage Users
                            </label>
                            <label v-if="module.key === 'settings'" class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].manageRoles"
                                @change="handlePermissionChange(module.key, 'manageRoles')"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              Manage Roles
                            </label>
                            <label v-if="module.key === 'settings'" class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                              <input
                                type="checkbox"
                                v-model="form.permissions[module.key].manageBilling"
                                @change="handlePermissionChange(module.key, 'manageBilling')"
                                class="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 rounded"
                              />
                              Billing
                            </label>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  
                  <!-- Permission Logic Helper -->
                  <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p class="text-xs text-blue-800 dark:text-blue-300">
                      <strong>Permission Logic:</strong> Read is auto-enabled with any permission • Update requires Create • Delete requires Update • Import requires Create
                    </p>
                  </div>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
              </div>
            </div>

            <!-- Footer Actions -->
            <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <div class="flex items-center justify-end gap-3">
                <button
                  type="button"
                  @click="close"
                  class="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  :disabled="saving"
                  class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg v-if="saving" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{{ saving ? 'Saving...' : (isEditing ? 'Update Role' : 'Create Role') }}</span>
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
import { ref, watch, computed, onMounted } from 'vue';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: Boolean,
  role: Object
});

const emit = defineEmits(['close', 'saved']);

const form = ref({
  name: '',
  description: '',
  parentRole: '',
  color: '#6366f1',
  icon: 'user',
  canViewAllData: false,
  canManageTeam: false,
  canExportData: false,
  permissions: {}
});

const saving = ref(false);
const error = ref('');
const permissionModules = ref([]);
const loadingModules = ref(false);
const availableParentRoles = ref([]);

const isEditing = computed(() => !!props.role);

// Initialize permission structure
const initializePermissions = () => {
  const permissions = {};
  permissionModules.value.forEach(module => {
    permissions[module.key] = {};
    module.actions.forEach(action => {
      permissions[module.key][action] = false;
    });
    if (module.hasScope) {
      permissions[module.key].scope = 'own';
    }
  });
  return permissions;
};

// Fetch permission modules
const fetchPermissionModules = async () => {
  loadingModules.value = true;
  try {
    const response = await apiClient.get('/roles/modules');
    if (response.success) {
      permissionModules.value = response.data;
      if (!props.role) {
        form.value.permissions = initializePermissions();
      }
    }
  } catch (err) {
    console.error('Error fetching modules:', err);
  } finally {
    loadingModules.value = false;
  }
};

// Fetch available parent roles
const fetchParentRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      // Exclude current role and its children from parent options
      availableParentRoles.value = response.data.filter(r => 
        r._id !== props.role?._id
      );
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    fetchPermissionModules();
    fetchParentRoles();
    if (props.role) {
      // Edit mode
      // Start from full module template, then overlay existing perms
      const basePerms = initializePermissions();
      const existingPerms = JSON.parse(JSON.stringify(props.role.permissions || {}));
      // UI alias: if contacts exists but people missing, mirror it for display
      if (existingPerms.contacts && !existingPerms.people) {
        existingPerms.people = existingPerms.contacts;
      }
      // Merge per module and action
      Object.keys(basePerms).forEach(m => {
        basePerms[m] = { ...basePerms[m], ...(existingPerms[m] || {}) };
      });

      form.value = {
        name: props.role.name || '',
        description: props.role.description || '',
        parentRole: props.role.parentRole?._id || props.role.parentRole || '',
        color: props.role.color || '#6366f1',
        icon: props.role.icon || 'user',
        canViewAllData: props.role.canViewAllData || false,
        canManageTeam: props.role.canManageTeam || false,
        canExportData: props.role.canExportData || false,
        permissions: basePerms
      };
    } else {
      // Create mode
      resetForm();
    }
  }
});

const resetForm = () => {
  form.value = {
    name: '',
    description: '',
    parentRole: '',
    color: '#6366f1',
    icon: 'user',
    canViewAllData: false,
    canManageTeam: false,
    canExportData: false,
    permissions: initializePermissions()
  };
  error.value = '';
};

const close = () => {
  if (!saving.value) {
    emit('close');
  }
};

// Handle permission change with auto-enable read
const handlePermissionChange = (moduleKey, action) => {
  if (form.value.permissions[moduleKey][action]) {
    // If any permission is checked, auto-enable read
    form.value.permissions[moduleKey].read = true;
  }
  
  // Enforce logical dependencies
  if (action === 'create') {
    // If create is unchecked, uncheck update, delete, and import
    if (!form.value.permissions[moduleKey].create) {
      form.value.permissions[moduleKey].update = false;
      form.value.permissions[moduleKey].delete = false;
      form.value.permissions[moduleKey].import = false;
    }
  } else if (action === 'update') {
    // If update is unchecked, uncheck delete
    if (!form.value.permissions[moduleKey].update) {
      form.value.permissions[moduleKey].delete = false;
    }
  }
};

// Handle read change - if unchecked, uncheck all dependent permissions
const handleReadChange = (moduleKey) => {
  if (!form.value.permissions[moduleKey].read) {
    // If read is unchecked, uncheck all other permissions
    form.value.permissions[moduleKey].create = false;
    form.value.permissions[moduleKey].update = false;
    form.value.permissions[moduleKey].delete = false;
    form.value.permissions[moduleKey].export = false;
    form.value.permissions[moduleKey].import = false;
    form.value.permissions[moduleKey].viewAll = false;
    
    // Settings specific
    if (form.value.permissions[moduleKey].manageUsers !== undefined) {
      form.value.permissions[moduleKey].manageUsers = false;
    }
    if (form.value.permissions[moduleKey].manageRoles !== undefined) {
      form.value.permissions[moduleKey].manageRoles = false;
    }
    if (form.value.permissions[moduleKey].manageBilling !== undefined) {
      form.value.permissions[moduleKey].manageBilling = false;
    }
  }
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';

  try {
    const payload = { ...form.value };
    
    // Convert empty string to null for parentRole
    if (payload.parentRole === '') {
      payload.parentRole = null;
    }

    let response;
    if (isEditing.value) {
      response = await apiClient.put(`/roles/${props.role._id}`, payload);
    } else {
      response = await apiClient.post('/roles', payload);
    }

    if (response.success) {
      emit('saved');
      resetForm();
    } else {
      error.value = response.message || 'Failed to save role';
    }
  } catch (err) {
    console.error('Error saving role:', err);
    error.value = err.response?.message || err.message || 'Failed to save role';
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  fetchPermissionModules();
});
</script>

