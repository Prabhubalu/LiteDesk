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
                <DialogPanel
                  class="flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[min(92vw,56rem)]"
                >
                  <form @submit.prevent="handleSubmit" class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700">
                    <!-- Header (same indigo for all roles; system roles use in-body notices) -->
                    <div class="flex-shrink-0 bg-indigo-700 dark:bg-indigo-800 px-4 py-5 sm:px-6">
                      <div class="flex items-start justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0">
                          <div
                            :style="{ backgroundColor: form.color || '#6366f1' }"
                            class="w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg flex-shrink-0"
                          >
                            <component :is="roleIconComponent" class="w-5 h-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="text-base font-semibold text-white truncate">
                              {{ isEditing ? (form.name || t('settings.roleDrawerEdit')) : t('settings.roleDrawerCreate') }}
                            </DialogTitle>
                            <p class="mt-0.5 text-sm text-indigo-300 line-clamp-2">
                              {{ headerSubtitle }}
                            </p>
                            <div
                              v-if="isSystemRole"
                              class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-xs font-medium text-indigo-100"
                            >
                              <LockClosedIcon class="w-3.5 h-3.5 shrink-0" />
                              {{ t('settings.roleDrawerSystemLocked') }}
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

                      <nav class="mt-4 flex gap-1 rounded-lg bg-indigo-800/50 p-1" :aria-label="t('settings.roleDrawerNavAria')">
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

                    <!-- Body -->
                    <div class="h-0 flex-1 overflow-y-auto">
                      <div class="px-4 sm:px-6 py-6">
                        <!-- Overview -->
                        <div v-show="activeTab === 'overview'" class="space-y-6">
                          <div
                            v-if="isSystemRole"
                            class="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
                          >
                            <p class="font-medium">{{ t('settings.roleDrawerSystemNoticeTitle') }}</p>
                            <p class="mt-1 text-xs text-amber-800 dark:text-amber-200/90">
                              {{ t('settings.roleDrawerSystemNoticeBody') }}
                            </p>
                          </div>

                          <div class="space-y-4">
                            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.roleDrawerIdentity') }}</h4>
                            <div class="space-y-1">
                              <label for="role-name" class="block text-sm font-medium text-gray-900 dark:text-white">
                                {{ t('settings.roleDrawerRoleName') }} <span class="text-red-500">*</span>
                              </label>
                              <input
                                id="role-name"
                                v-model="form.name"
                                type="text"
                                required
                                :disabled="isSystemRole"
                                :placeholder="t('settings.roleDrawerRoleNamePh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                            </div>
                            <div class="space-y-1">
                              <label for="role-desc" class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerDescription') }}</label>
                              <textarea
                                id="role-desc"
                                v-model="form.description"
                                rows="3"
                                :placeholder="t('settings.roleDrawerDescriptionPh')"
                                class="block w-full rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                              />
                            </div>
                          </div>

                          <div class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.roleDrawerAppearance') }}</h4>
                            <div class="grid grid-cols-2 gap-4">
                              <div class="space-y-2">
                                <label class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerColor') }}</label>
                                <div class="flex flex-wrap gap-2">
                                  <button
                                    v-for="preset in colorPresets"
                                    :key="preset"
                                    type="button"
                                    :style="{ backgroundColor: preset }"
                                    :class="[
                                      'w-8 h-8 rounded-lg ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-800 transition-all',
                                      form.color === preset ? 'ring-indigo-500 scale-110' : 'ring-transparent hover:ring-gray-300 dark:hover:ring-gray-600'
                                    ]"
                                    :aria-label="t('settings.roleDrawerColorAria', { color: preset })"
                                    @click="form.color = preset"
                                  />
                                </div>
                              </div>
                              <div class="space-y-2">
                                <label for="role-icon" class="block text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.roleDrawerIcon') }}</label>
                                <HeadlessSelect id="role-icon" v-model="form.icon" :options="iconOptions" />
                              </div>
                            </div>
                          </div>

                          <div class="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
                            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.roleDrawerHierarchy') }}</h4>
                            <HeadlessSelect
                              id="role-parent"
                              v-model="form.parentRole"
                              :options="parentRoleOptions"
                              allow-empty
                              :empty-label="t('settings.roleDrawerParentNone')"
                              :placeholder="t('settings.roleDrawerParentNone')"
                            />
                          </div>
                        </div>

                        <!-- Permissions -->
                        <div v-show="activeTab === 'permissions'" class="space-y-4">
                          <div
                            v-if="isSystemRole"
                            class="rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3"
                          >
                            <LockClosedIcon class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <p class="text-sm font-medium text-amber-900 dark:text-amber-100">{{ t('settings.roleDrawerPermsViewOnlyTitle') }}</p>
                              <p class="text-xs text-amber-800 dark:text-amber-200/80 mt-0.5">
                                {{ t('settings.roleDrawerPermsViewOnlyBody') }}
                              </p>
                            </div>
                          </div>

                          <!-- Access summary -->
                          <div
                            v-if="!loadingModules && permissionModules.length"
                            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 p-4"
                          >
                            <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                              {{ t('settings.roleDrawerAccessSummary') }}
                            </h4>
                            <ul class="space-y-1.5">
                              <li
                                v-for="(line, idx) in accessSummaryLines"
                                :key="idx"
                                class="flex items-start gap-2 text-sm"
                              >
                                <span
                                  class="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                                  :class="summaryDotClass(line.tone)"
                                />
                                <span :class="summaryTextClass(line.tone)">{{ line.text }}</span>
                              </li>
                            </ul>
                          </div>

                          <!-- Toolbar -->
                          <div class="flex flex-col sm:flex-row gap-3 sm:items-center">
                            <div class="relative flex-1">
                              <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                v-model="permissionSearch"
                                type="search"
                                :placeholder="t('settings.roleDrawerSearchModulesPh')"
                                class="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <label
                              v-if="permissionModules.length >= 20"
                              class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer shrink-0"
                            >
                              <HeadlessCheckbox v-model="compactMode" checkbox-class="w-4 h-4 rounded text-indigo-600" />
                              {{ t('settings.roleDrawerCompactView') }}
                            </label>
                          </div>

                          <div v-if="loadingModules" class="flex justify-center py-16">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                          </div>

                          <div
                            v-else-if="permissionSections.length === 0"
                            class="text-center py-12 rounded-xl border border-dashed border-gray-300 dark:border-gray-600"
                          >
                            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.roleDrawerNoModulesOrg') }}</p>
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
                              <!-- Sticky section header -->
                              <div
                                class="sticky top-0 z-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700"
                              >
                                <div class="min-w-0">
                                  <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{{ section.label }}</h4>
                                  <p v-if="section.description && !compactMode" class="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {{ section.description }}
                                  </p>
                                </div>
                                <div v-if="!isSystemRole" class="flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
                                  <button
                                    type="button"
                                    class="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium"
                                    @click="grantReadAllInSection(section.id)"
                                  >
                                    {{ t('settings.roleDrawerGrantReadSection') }}
                                  </button>
                                  <span class="text-gray-300 dark:text-gray-600 hidden sm:inline">|</span>
                                  <button
                                    type="button"
                                    class="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                    @click="clearSection(section.id)"
                                  >
                                    {{ t('settings.roleDrawerClearSection') }}
                                  </button>
                                </div>
                              </div>

                              <!-- Module rows -->
                              <div class="divide-y divide-gray-100 dark:divide-gray-700/80">
                                <div
                                  v-for="module in modulesForSection(section.id)"
                                  :key="module.key"
                                  :class="[
                                    'transition-colors',
                                    compactMode ? 'px-3 py-2.5' : 'px-4 py-3.5',
                                    !isSystemRole && 'hover:bg-gray-50/60 dark:hover:bg-gray-900/20'
                                  ]"
                                >
                                  <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-4">
                                    <div :class="compactMode ? 'min-w-0 lg:w-[28%]' : 'min-w-0 lg:w-[32%]'">
                                      <p :class="compactMode ? 'text-xs font-medium' : 'text-sm font-medium'" class="text-gray-900 dark:text-white">
                                        {{ module.label }}
                                      </p>
                                      <p
                                        v-if="module.description && !compactMode"
                                        class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2"
                                      >
                                        {{ module.description }}
                                      </p>
                                    </div>

                                    <div class="flex-1 min-w-0 space-y-2">
                                      <!-- Access mode -->
                                      <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide shrink-0">
                                          {{ t('settings.roleDrawerAccessLabel') }}
                                        </span>
                                        <div
                                          class="inline-flex flex-wrap rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 p-0.5"
                                          role="group"
                                          :aria-label="t('settings.roleDrawerAccessModeAria', { module: module.label })"
                                        >
                                          <button
                                            v-for="opt in accessModeOptions"
                                            :key="opt.value"
                                            type="button"
                                            :disabled="isSystemRole"
                                            :class="accessModeButtonClass(module, opt.value)"
                                            @click="setModuleMode(module, opt.value)"
                                          >
                                            {{ opt.label }}
                                          </button>
                                        </div>
                                      </div>

                                      <!-- CRUD (custom mode or partial) -->
                                      <div
                                        v-if="showCrudEditor(module) && getCrudActionsForModule(module).length"
                                        class="flex flex-wrap items-center gap-1.5"
                                      >
                                        <span class="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide w-full sm:w-auto shrink-0">
                                          {{ t('settings.roleDrawerResourceLabel') }}
                                        </span>
                                        <PermissionChip
                                          v-for="action in getCrudActionsForModule(module)"
                                          :key="`${module.key}-${action}`"
                                          :label="getCrudLabel(action)"
                                          :variant="chipVariantForAction(action)"
                                          :active="!!form.permissions[module.key]?.[action]"
                                          :disabled="isSystemRole || isCrudDisabled(module, action)"
                                          size="sm"
                                          @toggle="togglePermission(module.key, action)"
                                        />
                                      </div>

                                      <!-- Advanced (collapsed) -->
                                      <div v-if="getAdvancedActionsForModule(module).length">
                                        <button
                                          type="button"
                                          class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                          :disabled="isSystemRole"
                                          @click="toggleAdvancedExpanded(module.key)"
                                        >
                                          <ChevronRightIcon
                                            :class="[
                                              'w-3.5 h-3.5 transition-transform',
                                              isAdvancedExpanded(module.key) && 'rotate-90'
                                            ]"
                                          />
                                          {{ t('settings.roleDrawerAdvancedCapabilities') }}
                                          <span
                                            v-if="advancedActiveCount(module)"
                                            class="rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 px-1.5 py-0.5 text-[10px] font-semibold"
                                          >
                                            {{ advancedActiveCount(module) }}
                                          </span>
                                        </button>
                                        <div
                                          v-show="isAdvancedExpanded(module.key)"
                                          class="mt-2 flex flex-wrap gap-1.5 pl-5 border-l-2 border-teal-200 dark:border-teal-800"
                                        >
                                          <PermissionChip
                                            v-for="action in getAdvancedActionsForModule(module)"
                                            :key="`${module.key}-adv-${action}`"
                                            :label="advancedActionLabel(action)"
                                            :variant="chipVariantForAction(action)"
                                            :active="!!form.permissions[module.key]?.[action]"
                                            :disabled="isSystemRole || isAdvancedDisabled(module, action)"
                                            size="sm"
                                            @toggle="togglePermission(module.key, action)"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </section>

                            <p class="text-xs text-gray-500 dark:text-gray-400 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                              <strong class="text-slate-700 dark:text-slate-300">{{ t('settings.roleDrawerDependencyRulesTitle') }}</strong>
                              {{ t('settings.roleDrawerDependencyRulesBody') }}
                            </p>
                          </div>
                        </div>

                        <!-- Capabilities -->
                        <div v-show="activeTab === 'capabilities'" class="space-y-4">
                          <div
                            v-if="isSystemRole"
                            class="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/25 px-4 py-3 text-xs text-amber-800 dark:text-amber-200"
                          >
                            {{ t('settings.roleDrawerCapabilitiesSystemFixed') }}
                          </div>
                          <p class="text-sm text-gray-600 dark:text-gray-400">
                            {{ t('settings.roleDrawerCapabilitiesIntro') }}
                          </p>
                          <label
                            v-for="cap in capabilityToggles"
                            :key="cap.key"
                            :class="[
                              'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                              cap.sensitive
                                ? 'border-amber-200 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                              isSystemRole && 'opacity-60 cursor-not-allowed'
                            ]"
                          >
                            <HeadlessCheckbox
                              v-model="form[cap.key]"
                              :disabled="isSystemRole"
                              :checkbox-class="[
                                'mt-0.5 w-5 h-5 rounded',
                                cap.sensitive ? 'text-amber-600 focus:ring-amber-500' : 'text-indigo-600 focus:ring-indigo-500'
                              ]"
                            />
                            <div>
                              <span class="text-sm font-medium text-gray-900 dark:text-white">{{ cap.label }}</span>
                              <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{{ cap.hint }}</p>
                            </div>
                          </label>
                        </div>

                        <div v-if="error" class="mt-6 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
                          <p class="text-sm text-red-800 dark:text-red-300">{{ error }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-4 sm:px-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <p v-if="isDirty && !isSystemRole" class="text-xs text-amber-600 dark:text-amber-400">{{ t('settings.roleDrawerUnsavedTitle') }}</p>
                      <span v-else />
                      <div class="flex items-center gap-3 ml-auto">
                        <button
                          type="button"
                          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
                          @click="requestClose"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          :disabled="saving || !form.name?.trim()"
                          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span v-if="saving">{{ t('states.saving') }}</span>
                          <span v-else>{{ isEditing ? t('settings.roleDrawerSave') : t('settings.roleDrawerCreate') }}</span>
                        </button>
                      </div>
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
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import {
  XMarkIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  UserIcon,
  UsersIcon,
  EyeIcon
} from '@heroicons/vue/24/outline';
import { StarIcon } from '@heroicons/vue/24/solid';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import apiClient from '@/utils/apiClient';
import {
  applyModuleAccessMode,
  applyPermissionSideEffects,
  applyPermissionUncheck,
  buildRoleAccessSummary,
  chipVariantForAction,
  getAdvancedActionsForModule,
  getCrudActionsForModule,
  getModuleAccessMode,
  hasAction,
  hasAnyAdvancedEnabled
} from '@/utils/rolePermissionEditorUtils';

const { t } = useI18n();

const ADVANCED_ACTION_I18N = {
  export: 'roleDrawerPermExport',
  import: 'roleDrawerPermImport',
  viewAll: 'roleDrawerPermViewAll',
  execution: 'roleDrawerPermExecution',
  review: 'roleDrawerPermReview',
  approve: 'roleDrawerPermApprove',
  manageRoles: 'roleDrawerPermManageRoles',
  manageBilling: 'roleDrawerPermManageBilling'
};

const props = defineProps({
  open: { type: Boolean, default: false },
  role: { type: Object, default: null },
  initialTab: { type: String, default: 'overview' }
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
      return h(
        'button',
        {
          type: 'button',
          disabled: chipProps.disabled,
          class: [
            'rounded-md font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900',
            chipProps.size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            chipProps.disabled
              ? 'opacity-40 cursor-not-allowed border-gray-200 dark:border-gray-700 text-gray-400'
              : chipProps.active
                ? v.active
                : v.idle
          ],
          onClick: () => {
            if (!chipProps.disabled) chipEmit('toggle');
          }
        },
        chipProps.label
      );
    };
  }
});

const form = ref(createEmptyForm());
const initialSnapshot = ref('');
const saving = ref(false);
const error = ref('');
const activeTab = ref('overview');
const permissionSearch = ref('');
const permissionModules = ref([]);
const permissionSections = ref([]);
const catalogMeta = ref({ enabledApps: [] });
const loadingModules = ref(false);
const availableParentRoles = ref([]);
const compactMode = ref(false);
const expandedAdvanced = ref({});
/** Modules where user chose Custom to fine-tune CRUD chips */
const customEditModules = ref(new Set());

const editorTabs = computed(() => [
  { id: 'overview', label: t('settings.roleDrawerTabOverview') },
  { id: 'permissions', label: t('settings.roleDrawerTabPermissions') },
  { id: 'capabilities', label: t('settings.roleDrawerTabCapabilities') }
]);

const colorPresets = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#64748b'];

const iconOptions = computed(() => [
  { value: 'user', label: t('settings.roleDrawerIconUser') },
  { value: 'users', label: t('settings.roleDrawerIconUsers') },
  { value: 'crown', label: t('settings.roleDrawerIconCrown') },
  { value: 'shield', label: t('settings.roleDrawerIconShield') },
  { value: 'eye', label: t('settings.roleDrawerIconEye') }
]);

const crudLabels = computed(() => ({
  read: t('settings.roleDrawerPermRead'),
  create: t('settings.roleDrawerPermCreate'),
  update: t('settings.roleDrawerPermUpdate'),
  delete: t('settings.roleDrawerPermDelete')
}));

function getCrudLabel(action) {
  return crudLabels.value[action] ?? action;
}

const accessModeOptions = computed(() => [
  { value: 'none', label: t('settings.roleDrawerAccessModeNone') },
  { value: 'readOnly', label: t('settings.roleDrawerAccessModeReadOnly') },
  { value: 'full', label: t('settings.roleDrawerAccessModeFull') },
  { value: 'custom', label: t('settings.roleDrawerAccessModeCustom') }
]);

const capabilityToggles = computed(() => [
  {
    key: 'canViewAllData',
    label: t('settings.roleDrawerCapViewAll'),
    hint: t('settings.roleDrawerCapViewAllHint'),
    sensitive: true
  },
  {
    key: 'canManageTeam',
    label: t('settings.roleDrawerCapManageTeam'),
    hint: t('settings.roleDrawerCapManageTeamHint'),
    sensitive: false
  },
  {
    key: 'canExportData',
    label: t('settings.roleDrawerCapExportData'),
    hint: t('settings.roleDrawerCapExportDataHint'),
    sensitive: false
  }
]);

function advancedActionLabel(action) {
  const key = ADVANCED_ACTION_I18N[action];
  return key ? t(`settings.${key}`) : action;
}

const isEditing = computed(() => !!props.role);
const isSystemRole = computed(() => Boolean(props.role?.isSystemRole));

const headerSubtitle = computed(() => {
  if (isSystemRole.value) {
    return props.role?.description || t('settings.roleDrawerSubtitleSystem');
  }
  if (isEditing.value) {
    return props.role?.description || t('settings.roleDrawerSubtitleEditDefault');
  }
  return t('settings.roleDrawerSubtitleCreateDefault');
});

const parentRoleOptions = computed(() =>
  availableParentRoles.value.map((r) => ({
    value: r._id,
    label: t('settings.roleDrawerParentLevel', { name: r.name, level: r.level })
  }))
);

const roleIconComponent = computed(() => {
  const map = { crown: StarIcon, shield: ShieldCheckIcon, users: UsersIcon, eye: EyeIcon, user: UserIcon };
  return map[form.value.icon] || UserIcon;
});

const modulesBySection = computed(() => {
  const map = {};
  for (const mod of permissionModules.value) {
    const sid = mod.sectionId || 'default';
    if (!map[sid]) map[sid] = [];
    map[sid].push(mod);
  }
  return map;
});

const modulesForSection = (sectionId) => {
  const list = modulesBySection.value[sectionId] || [];
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (m) =>
      (m.label || '').toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q) ||
      (m.key || '').toLowerCase().includes(q)
  );
};

const filteredSections = computed(() => {
  const q = permissionSearch.value.trim().toLowerCase();
  if (!q) return permissionSections.value;
  return permissionSections.value.filter((s) => (modulesForSection(s.id) || []).length > 0);
});

const accessSummaryLines = computed(() =>
  buildRoleAccessSummary({
    permissions: form.value.permissions,
    modules: permissionModules.value,
    sections: permissionSections.value,
    form: form.value
  }).map((line) => ({
    tone: line.tone,
    text: t(`settings.${line.i18nKey}`, line.params || {})
  }))
);

const isDirty = computed(() => snapshotForm() !== initialSnapshot.value);

watch(
  () => permissionModules.value.length,
  (n) => {
    if (n >= 25) compactMode.value = true;
  }
);

function createEmptyForm() {
  return {
    name: '',
    description: '',
    parentRole: '',
    color: '#6366f1',
    icon: 'user',
    canViewAllData: false,
    canManageTeam: false,
    canExportData: false,
    permissions: {}
  };
}

function snapshotForm() {
  return JSON.stringify(form.value);
}

function summaryDotClass(tone) {
  const map = {
    positive: 'bg-emerald-500',
    neutral: 'bg-slate-400',
    muted: 'bg-gray-300 dark:bg-gray-600',
    warning: 'bg-amber-500'
  };
  return map[tone] || map.neutral;
}

function summaryTextClass(tone) {
  const map = {
    positive: 'text-gray-800 dark:text-gray-200',
    neutral: 'text-gray-700 dark:text-gray-300',
    muted: 'text-gray-500 dark:text-gray-400',
    warning: 'text-amber-800 dark:text-amber-200'
  };
  return map[tone] || map.neutral;
}

const initializePermissions = () => {
  const permissions = {};
  permissionModules.value.forEach((module) => {
    const actions = Array.isArray(module.actions) ? module.actions : [];
    permissions[module.key] = {};
    actions.forEach((action) => {
      permissions[module.key][action] = false;
    });
    if (module.hasScope) permissions[module.key].scope = 'own';
  });
  return permissions;
};

const fetchPermissionModules = async () => {
  loadingModules.value = true;
  try {
    const response = await apiClient.get('/roles/modules');
    if (response.success) {
      permissionModules.value = response.data || [];
      permissionSections.value = response.sections || [];
      catalogMeta.value = { enabledApps: response.enabledApps || [] };
      if (!props.role) form.value.permissions = initializePermissions();
    }
  } catch (err) {
    console.error('Error fetching modules:', err);
  } finally {
    loadingModules.value = false;
  }
};

const fetchParentRoles = async () => {
  try {
    const response = await apiClient.get('/roles');
    if (response.success) {
      availableParentRoles.value = response.data.filter((r) => r._id !== props.role?._id);
    }
  } catch (err) {
    console.error('Error fetching roles:', err);
  }
};

const loadRoleIntoForm = () => {
  const basePerms = initializePermissions();
  const existingPerms = JSON.parse(JSON.stringify(props.role.permissions || {}));
  Object.keys(basePerms).forEach((m) => {
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
};

const resetForm = () => {
  form.value = { ...createEmptyForm(), permissions: initializePermissions() };
  error.value = '';
  activeTab.value = 'overview';
  permissionSearch.value = '';
  expandedAdvanced.value = {};
  customEditModules.value = new Set();
};

const markClean = () => {
  initialSnapshot.value = snapshotForm();
};

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    const tab = props.initialTab;
    activeTab.value = editorTabs.value.some((tabItem) => tabItem.id === tab) ? tab : 'overview';
    permissionSearch.value = '';
    error.value = '';
    expandedAdvanced.value = {};
    customEditModules.value = new Set();
    await fetchPermissionModules();
    fetchParentRoles();
    if (props.role) loadRoleIntoForm();
    else resetForm();
    markClean();
  }
);

function getMode(module) {
  return getModuleAccessMode(module, form.value.permissions[module.key] || {});
}

function showCrudEditor(module) {
  return getMode(module) === 'custom' || customEditModules.value.has(module.key);
}

function setModuleMode(module, mode) {
  if (isSystemRole.value) return;
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
  const isActive =
    modeValue === 'custom'
      ? current === 'custom' || inCustomUi
      : current === modeValue && !inCustomUi;
  const base =
    'px-2 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  if (isActive) return `${base} bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm`;
  return `${base} text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200`;
}

function isCrudDisabled(module, action) {
  const perms = form.value.permissions[module.key] || {};
  if (action === 'create') return !perms.read;
  if (action === 'update') return !perms.create;
  if (action === 'delete') return !perms.update;
  return false;
}

function isAdvancedDisabled(module, action) {
  const perms = form.value.permissions[module.key] || {};
  if (action === 'import') return !perms.create;
  if (action === 'viewAll') return !perms.read;
  return false;
}

function advancedActiveCount(module) {
  const perms = form.value.permissions[module.key] || {};
  return getAdvancedActionsForModule(module).filter((a) => perms[a]).length;
}

function isAdvancedExpanded(moduleKey) {
  if (expandedAdvanced.value[moduleKey]) return true;
  const mod = permissionModules.value.find((m) => m.key === moduleKey);
  if (!mod) return false;
  return hasAnyAdvancedEnabled(form.value.permissions[moduleKey], mod);
}

function toggleAdvancedExpanded(moduleKey) {
  expandedAdvanced.value[moduleKey] = !isAdvancedExpanded(moduleKey);
}

const togglePermission = (moduleKey, action) => {
  if (isSystemRole.value) return;
  const perms = form.value.permissions[moduleKey];
  if (!perms) return;
  perms[action] = !perms[action];
  if (perms[action]) applyPermissionSideEffects(perms, action);
  else applyPermissionUncheck(perms, action);
  const mod = permissionModules.value.find((m) => m.key === moduleKey);
  if (mod && getModuleAccessMode(mod, perms) === 'custom') {
    customEditModules.value = new Set([...customEditModules.value, moduleKey]);
  }
};

const grantReadAllInSection = (sectionId) => {
  if (isSystemRole.value) return;
  for (const mod of modulesBySection.value[sectionId] || []) {
    applyModuleAccessMode(mod, form.value.permissions[mod.key], 'readOnly');
  }
};

const clearSection = (sectionId) => {
  if (isSystemRole.value) return;
  if (!confirm(t('settings.roleDrawerClearSectionConfirm'))) return;
  for (const mod of modulesBySection.value[sectionId] || []) {
    applyModuleAccessMode(mod, form.value.permissions[mod.key], 'none');
  }
};

const requestClose = () => {
  if (saving.value) return;
  if (isDirty.value && !confirm(t('settings.roleDrawerCloseConfirm'))) return;
  emit('close');
};

const handleDialogClose = () => requestClose();

const handleSubmit = async () => {
  saving.value = true;
  error.value = '';
  try {
    const payload = { ...form.value };
    if (payload.parentRole === '') payload.parentRole = null;
    const response = isEditing.value
      ? await apiClient.put(`/roles/${props.role._id}`, payload)
      : await apiClient.post('/roles', payload);
    if (response.success) {
      emit('saved');
      resetForm();
      markClean();
    } else {
      error.value = response.message || t('settings.roleDrawerSaveFailed');
    }
  } catch (err) {
    error.value = err.response?.message || err.message || t('settings.roleDrawerSaveFailed');
  } finally {
    saving.value = false;
  }
};
</script>
