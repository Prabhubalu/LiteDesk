<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="handleDialogClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300 sm:duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300 sm:duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <div class="pointer-events-auto h-full flex">
                <DialogPanel class="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[min(92vw,56rem)]">
                  <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <div class="flex-shrink-0 bg-indigo-700 dark:bg-indigo-800 px-4 py-5 sm:px-6">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0">
                          <div class="w-11 h-11 rounded-xl flex items-center justify-center bg-white/15 text-white shadow-lg flex-shrink-0">
                            <ShieldCheckIcon class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="text-base font-semibold text-white truncate">
                              {{ isEditing ? (form.name || t('settings.profileDrawerEdit')) : t('settings.profileDrawerCreate') }}
                            </DialogTitle>
                            <p class="mt-0.5 text-sm text-indigo-300 line-clamp-2">
                              {{ t('settings.profileDrawerSubtitle') }}
                            </p>
                            <div
                              v-if="isSystemProfile"
                              class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-indigo-100"
                            >
                              <LockClosedIcon class="w-3.5 h-3.5 shrink-0" />
                              {{ t('settings.profileDrawerSystemLocked') }}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white cursor-pointer flex-shrink-0"
                          @click="requestClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>

                      <nav class="mt-4 flex gap-1 rounded-lg bg-indigo-800/50 p-1" :aria-label="t('settings.profileDrawerNavAria')">
                        <button
                          v-for="tab in editorTabs"
                          :key="tab.id"
                          type="button"
                          :class="[
                            activeTab === tab.id
                              ? 'bg-white text-indigo-700 shadow-sm'
                              : 'text-indigo-200 hover:text-white hover:bg-white/10',
                            'flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors'
                          ]"
                          @click="activeTab = tab.id"
                        >
                          {{ tab.label }}
                        </button>
                      </nav>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6">
                        <div v-show="activeTab === 'overview'" class="space-y-4">
                          <div class="space-y-1">
                            <label for="profile-name" class="block text-sm font-medium text-gray-900 dark:text-white">
                              {{ t('settings.profileDrawerName') }} <span class="text-red-500">*</span>
                            </label>
                            <input
                              id="profile-name"
                              v-model="form.name"
                              type="text"
                              required
                              :disabled="isSystemProfile"
                              :placeholder="t('settings.profileDrawerNamePh')"
                              class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                            />
                          </div>
                          <div class="space-y-1">
                            <label for="profile-desc" class="block text-sm font-medium text-gray-900 dark:text-white">
                              {{ t('settings.profileDrawerDescription') }}
                            </label>
                            <textarea
                              id="profile-desc"
                              v-model="form.description"
                              rows="3"
                              :placeholder="t('settings.profileDrawerDescriptionPh')"
                              class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                            />
                          </div>
                        </div>

                        <div v-show="activeTab === 'permissions'" class="space-y-4">
                          <div class="relative flex-1">
                            <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              v-model="permissionSearch"
                              type="search"
                              :placeholder="t('settings.roleDrawerSearchModulesPh')"
                              class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>

                          <div v-if="loadingModules" class="flex justify-center py-16">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                          </div>

                          <div v-else-if="filteredSections.length === 0" class="text-center py-10 text-sm text-gray-500">
                            {{ t('settings.roleDrawerNoSearchMatch', { query: permissionSearch }) }}
                          </div>

                          <div v-else class="space-y-5 pb-2">
                            <section
                              v-for="section in filteredSections"
                              :key="section.id"
                              class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                            >
                              <div class="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700">
                                <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ section.label }}</h4>
                              </div>
                              <div class="divide-y divide-gray-100 dark:divide-gray-700/80">
                                <div v-for="module in modulesForSection(section.id)" :key="module.key" class="px-4 py-3">
                                  <p class="text-sm font-medium text-gray-900 dark:text-white mb-2">{{ module.label }}</p>
                                  <div class="flex flex-wrap items-center gap-1.5">
                                    <button
                                      v-for="opt in accessModeOptions"
                                      :key="opt.value"
                                      type="button"
                                      :class="accessModeButtonClass(module, opt.value)"
                                      @click="setModuleMode(module, opt.value)"
                                    >
                                      {{ opt.label }}
                                    </button>
                                  </div>
                                  <div v-if="showCrudEditor(module)" class="mt-2 flex flex-wrap gap-1.5">
                                    <PermissionChip
                                      v-for="action in getCrudActionsForModule(module)"
                                      :key="`${module.key}-${action}`"
                                      :label="getCrudLabel(action)"
                                      :variant="chipVariantForAction(action)"
                                      :active="!!form.permissions[module.key]?.[action]"
                                      :disabled="isCrudDisabled(module, action)"
                                      size="sm"
                                      @toggle="togglePermission(module.key, action)"
                                    />
                                  </div>
                                </div>
                              </div>
                            </section>
                          </div>
                        </div>

                        <div v-show="activeTab === 'fields'" class="space-y-4">
                          <FieldPermissionsEditor
                            v-model="form.fieldPermissions"
                            :modules="permissionModules"
                            :intro="t('settings.fieldPermsIntro')"
                            :empty-label="t('settings.fieldPermsEmpty')"
                          />
                        </div>

                        <div v-if="error" class="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                          <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
                        </div>
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center justify-end gap-3 px-4 py-4 sm:px-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg" @click="requestClose">
                        {{ t('actions.cancel') }}
                      </button>
                      <button
                        type="submit"
                        :disabled="saving || !form.name?.trim()"
                        class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <span v-if="saving">{{ t('states.saving') }}</span>
                        <span v-else>{{ isEditing ? t('settings.profileDrawerSave') : t('settings.profileDrawerCreateBtn') }}</span>
                      </button>
                    </div>
                  </form>
                </DialogPanel>
              </div>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, watch, computed, h, defineComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon, MagnifyingGlassIcon, ShieldCheckIcon, LockClosedIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import FieldPermissionsEditor from './FieldPermissionsEditor.vue';
import { modulesWithFieldCatalog } from '@/utils/fieldRbacPermission';
import {
  applyModuleAccessMode,
  applyPermissionSideEffects,
  applyPermissionUncheck,
  chipVariantForAction,
  getCrudActionsForModule,
  getModuleAccessMode
} from '@/utils/rolePermissionEditorUtils';

const { t } = useI18n();

const props = defineProps({
  open: { type: Boolean, default: false },
  profile: { type: Object, default: null }
});

const emit = defineEmits(['close', 'saved']);

const CHIP_STYLES = {
  crud: {
    active: 'bg-slate-700 dark:bg-slate-600 border-slate-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400'
  },
  advanced: {
    active: 'bg-teal-700 dark:bg-teal-800 border-teal-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:border-teal-400'
  },
  sensitive: {
    active: 'bg-amber-700 dark:bg-amber-800 border-amber-700 text-white',
    idle: 'bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:border-amber-400'
  }
};

const PermissionChip = defineComponent({
  name: 'PermissionChip',
  props: {
    label: { type: String, required: true },
    active: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: 'md' },
    variant: { type: String, default: 'crud' }
  },
  emits: ['toggle'],
  setup(chipProps, { emit: chipEmit }) {
    return () => {
      const v = CHIP_STYLES[chipProps.variant] || CHIP_STYLES.crud;
      return h('button', {
        type: 'button',
        disabled: chipProps.disabled,
        class: [
          'rounded-md font-medium border transition-all',
          chipProps.size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
          chipProps.disabled ? 'opacity-40 cursor-not-allowed' : chipProps.active ? v.active : v.idle
        ],
        onClick: () => { if (!chipProps.disabled) chipEmit('toggle'); }
      }, chipProps.label);
    };
  }
});

const form = ref({ name: '', description: '', permissions: {}, fieldPermissions: {} });
const saving = ref(false);
const error = ref('');
const activeTab = ref('overview');
const permissionSearch = ref('');
const permissionModules = ref([]);
const permissionSections = ref([]);
const loadingModules = ref(false);
const customEditModules = ref(new Set());

const fieldCatalogModules = computed(() => modulesWithFieldCatalog(permissionModules.value));

const editorTabs = computed(() => {
  const tabs = [
    { id: 'overview', label: t('settings.profileDrawerTabOverview') },
    { id: 'permissions', label: t('settings.profileDrawerTabPermissions') }
  ];
  if (fieldCatalogModules.value.length > 0) {
    tabs.push({ id: 'fields', label: t('settings.profileDrawerTabFields') });
  }
  return tabs;
});

const isEditing = computed(() => Boolean(props.profile?._id));
const isSystemProfile = computed(() => Boolean(props.profile?.isSystemProfile));

const crudLabels = computed(() => ({
  read: t('settings.roleDrawerPermRead'),
  create: t('settings.roleDrawerPermCreate'),
  update: t('settings.roleDrawerPermUpdate'),
  delete: t('settings.roleDrawerPermDelete')
}));

const accessModeOptions = computed(() => [
  { value: 'none', label: t('settings.roleDrawerAccessModeNone') },
  { value: 'readOnly', label: t('settings.roleDrawerAccessModeReadOnly') },
  { value: 'full', label: t('settings.roleDrawerAccessModeFull') },
  { value: 'custom', label: t('settings.roleDrawerAccessModeCustom') }
]);

const modulesBySection = computed(() => {
  const map = {};
  for (const mod of permissionModules.value) {
    const sid = mod.section || 'other';
    if (!map[sid]) map[sid] = [];
    map[sid].push(mod);
  }
  return map;
});

const modulesForSection = (sectionId) => {
  const list = modulesBySection.value[sectionId] || [];
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter((m) => (m.label || '').toLowerCase().includes(q) || (m.key || '').toLowerCase().includes(q));
};

const filteredSections = computed(() => {
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return permissionSections.value;
  return permissionSections.value.filter((s) => (modulesForSection(s.id) || []).length > 0);
});

function getCrudLabel(action) {
  return crudLabels.value[action] ?? action;
}

function initializePermissions() {
  const permissions = {};
  permissionModules.value.forEach((module) => {
    const actions = Array.isArray(module.actions) ? module.actions : [];
    permissions[module.key] = {};
    actions.forEach((action) => { permissions[module.key][action] = false; });
    if (module.hasScope) permissions[module.key].scope = 'own';
  });
  return permissions;
}

function getMode(module) {
  return getModuleAccessMode(module, form.value.permissions[module.key] || {});
}

function showCrudEditor(module) {
  return getMode(module) === 'custom' || customEditModules.value.has(module.key);
}

function setModuleMode(module, mode) {
  const perms = form.value.permissions[module.key];
  if (!perms) return;
  if (mode === 'custom') {
    customEditModules.value = new Set([...customEditModules.value, module.key]);
    return;
  }
  customEditModules.value.delete(module.key);
  customEditModules.value = new Set(customEditModules.value);
  applyModuleAccessMode(module, perms, mode);
}

function accessModeButtonClass(module, modeValue) {
  const current = getMode(module);
  const inCustomUi = customEditModules.value.has(module.key);
  const isActive = modeValue === 'custom' ? current === 'custom' || inCustomUi : current === modeValue && !inCustomUi;
  const base = 'px-2 py-1 text-[11px] font-medium rounded-md transition-colors';
  return isActive ? `${base} bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200` : `${base} text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700`;
}

function isCrudDisabled(module, action) {
  const perms = form.value.permissions[module.key] || {};
  if (action === 'create') return !perms.read;
  if (action === 'update') return !perms.create;
  if (action === 'delete') return !perms.update;
  return false;
}

function togglePermission(moduleKey, action) {
  const perms = form.value.permissions[moduleKey];
  if (!perms) return;
  perms[action] = !perms[action];
  if (perms[action]) applyPermissionSideEffects(perms, action);
  else applyPermissionUncheck(perms, action);
}

const fetchPermissionModules = async () => {
  loadingModules.value = true;
  try {
    const response = await apiClient.get('/roles/modules');
    if (response.success) {
      permissionModules.value = response.data || [];
      permissionSections.value = response.sections || [];
      if (!props.profile) form.value.permissions = initializePermissions();
    }
  } catch (err) {
    console.error('Error fetching modules:', err);
  } finally {
    loadingModules.value = false;
  }
};

const loadProfileIntoForm = () => {
  const basePerms = initializePermissions();
  const existingPerms = JSON.parse(JSON.stringify(props.profile.permissions || {}));
  Object.keys(basePerms).forEach((m) => {
    basePerms[m] = { ...basePerms[m], ...existingPerms[m] };
  });
  form.value = {
    name: props.profile.name || '',
    description: props.profile.description || '',
    permissions: basePerms,
    fieldPermissions: toPlainFieldPerms(props.profile.fieldPermissions)
  };
};

function toPlainFieldPerms(value) {
  if (!value) return {};
  if (typeof value.entries === 'function') {
    const out = {};
    for (const [k, v] of value.entries()) out[k] = v;
    return out;
  }
  return { ...value };
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    activeTab.value = 'overview';
    error.value = '';
    customEditModules.value = new Set();
    await fetchPermissionModules();
    if (props.profile) loadProfileIntoForm();
    else form.value = { name: '', description: '', permissions: initializePermissions(), fieldPermissions: {} };
  }
);

const requestClose = () => {
  if (!saving.value) emit('close');
};

const handleDialogClose = () => requestClose();

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  try {
    const payload = {
      name: form.value.name.trim(),
      description: form.value.description,
      permissions: form.value.permissions,
      fieldPermissions: form.value.fieldPermissions
    };
    const response = isEditing.value
      ? await apiClient.put(`/profiles/${props.profile._id}`, payload)
      : await apiClient.post('/profiles', payload);
    if (response.success) {
      emit('saved');
    } else {
      error.value = response.message || t('settings.profileDrawerSaveFailed');
    }
  } catch (err) {
    error.value = err.message || t('settings.profileDrawerSaveFailed');
  } finally {
    saving.value = false;
  }
};
</script>
