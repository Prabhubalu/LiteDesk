<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-50" @close="handleClose">
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
                  class="rounded-tl-xl overflow-hidden flex h-full flex-col bg-white dark:bg-gray-800 shadow-xl max-w-[95vw] w-[36rem] transition-[width] duration-200 ease-out"
                >
                  <form class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700" @submit.prevent="save">
                    <div class="border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-6 sm:px-6 flex-shrink-0">
                      <div class="flex items-center justify-between">
                        <DialogTitle class="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ isEdit ? t('settings.settingsBhEditSchedule') : t('settings.settingsBhCreateSchedule') }}
                        </DialogTitle>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer"
                          @click="handleClose"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('actions.close') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>
                      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {{
                          isEdit
                            ? t('settings.settingsBhEditScheduleDesc')
                            : t('settings.settingsBhCreateScheduleDesc')
                        }}
                      </p>
                    </div>

                    <div class="h-0 flex-1 overflow-y-auto">
                      <div v-if="loading" class="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                        {{ t('settings.settingsBhLoadingSchedule') }}
                      </div>
                      <div v-else class="px-4 sm:px-6 py-6 space-y-4">
                        <div
                          v-if="formError"
                          class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-800 dark:text-red-200"
                        >
                          {{ formError }}
                        </div>

                        <ScheduleEditorForm
                          v-model:form="form"
                          :scope-options="scopeOptions"
                          :status-options="statusOptions"
                          :holiday-calendar-options="holidayCalendarOptions"
                          :group-options="groupOptions"
                          :user-options="userOptions"
                          :is-default-locked="isEdit && !!form.isDefault"
                          :preview-set-id="isEdit ? scheduleId : null"
                        />
                      </div>
                    </div>

                    <div class="flex shrink-0 items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      <button
                        v-if="isEdit && !form.isDefault"
                        type="button"
                        class="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 disabled:opacity-50"
                        :disabled="saving || loading"
                        @click="remove"
                      >
                        {{ t('actions.delete') }}
                      </button>
                      <span v-else />
                      <div class="flex gap-3">
                        <button
                          type="button"
                          class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                          :disabled="saving"
                          @click="handleClose"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          class="rounded-md bg-indigo-600 dark:bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 dark:hover:bg-indigo-600 disabled:opacity-50"
                          :disabled="saving || loading"
                        >
                          {{
                            saving
                              ? isEdit
                                ? t('states.saving')
                                : t('settings.settingsBhCreating')
                              : isEdit
                                ? t('settings.saveChanges')
                                : t('settings.settingsBhCreateSchedule')
                          }}
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
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { useBusinessHours } from '@/composables/useBusinessHours';
import { detectUserTimezone } from '@/utils/ianaTimezones';
import apiClient from '@/utils/apiClient';
import {
  buildDefaultWeekLocal,
  buildSchedulePayload,
  validateScheduleForm
} from '@/utils/businessHoursFormUtils';
import { useNotifications } from '@/composables/useNotifications';
import ScheduleEditorForm from '@/components/business-hours/ScheduleEditorForm.vue';

import { confirmAction } from '@/composables/useConfirmAction';
const open = defineModel('open', { type: Boolean, default: false });

const props = defineProps({
  mode: { type: String, default: 'create' },
  scheduleId: { type: String, default: null },
  holidayCalendarOptions: { type: Array, default: () => [] },
  suggestAsDefault: { type: Boolean, default: false }
});

const emit = defineEmits(['saved', 'deleted']);

const { t } = useI18n();
const { fetchSet, createSet, updateSet, deleteSet } = useBusinessHours();
const { success, error: notifyError } = useNotifications();

const scopeOptions = computed(() => [
  { value: 'company', label: t('settings.settingsBhScopeEveryone') },
  { value: 'group', label: t('settings.settingsBhScopeTeam') },
  { value: 'user', label: t('settings.settingsBhScopeIndividual') }
]);

const statusOptions = computed(() => [
  { value: 'active', label: t('settings.settingsBhStatusActive') },
  { value: 'inactive', label: t('settings.settingsBhStatusInactive') }
]);

const isEdit = computed(() => props.mode === 'edit' && !!props.scheduleId);
const loading = ref(false);
const saving = ref(false);
const formError = ref('');
const form = ref(createEmptyForm());
const groups = ref([]);
const users = ref([]);

const groupOptions = computed(() =>
  groups.value.map((g) => ({
    value: g._id,
    label: g.name || t('settings.settingsBhUnnamedTeam')
  }))
);

const userOptions = computed(() =>
  users.value.map((u) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
    return {
      value: u._id,
      label: name || u.email || u.username || t('settings.settingsBhUserFallback')
    };
  })
);

function createEmptyForm() {
  return {
    name: '',
    timezone: detectUserTimezone(),
    week: buildDefaultWeekLocal(),
    holidayCalendarId: null,
    overtimeAllowed: false,
    linkedTo: { type: 'company', id: null },
    isDefault: false,
    status: 'active'
  };
}

async function loadScopeOptions() {
  try {
    const [groupsRes, usersRes] = await Promise.all([
      apiClient.get('/groups?page=1&limit=500&sortBy=name&sortOrder=asc'),
      apiClient.get('/users/list')
    ]);

    groups.value = groupsRes?.success && Array.isArray(groupsRes.data) ? groupsRes.data : [];

    let userList = [];
    if (Array.isArray(usersRes)) {
      userList = usersRes;
    } else if (usersRes?.success && Array.isArray(usersRes.data)) {
      userList = usersRes.data;
    } else if (Array.isArray(usersRes?.data)) {
      userList = usersRes.data;
    }
    users.value = userList.filter((u) => u?.status !== 'inactive');
  } catch {
    groups.value = [];
    users.value = [];
  }
}

async function loadForm() {
  formError.value = '';
  await loadScopeOptions();

  if (!isEdit.value) {
    form.value = createEmptyForm();
    if (props.suggestAsDefault) {
      form.value.isDefault = true;
    }
    return;
  }

  loading.value = true;
  try {
    const set = await fetchSet(props.scheduleId);
    form.value = {
      name: set.name,
      timezone: set.timezone,
      week: JSON.parse(JSON.stringify(set.week)),
      holidayCalendarId: set.holidayCalendarId || null,
      overtimeAllowed: set.overtimeAllowed,
      linkedTo: { type: set.linkedTo?.type || 'company', id: set.linkedTo?.id || null },
      isDefault: set.isDefault,
      status: set.status
    };
  } catch (e) {
    formError.value = e?.message || t('settings.settingsBhFailedLoadSchedule');
    notifyError(formError.value);
  } finally {
    loading.value = false;
  }
}

function handleClose() {
  if (saving.value) return;
  open.value = false;
}

async function save() {
  formError.value = '';
  const validationKey = validateScheduleForm(form.value);
  if (validationKey) {
    formError.value = t(`settings.${validationKey}`);
    return;
  }

  saving.value = true;
  try {
    const payload = buildSchedulePayload({
      ...form.value,
      name: form.value.name.trim()
    });
    if (isEdit.value) {
      await updateSet(props.scheduleId, payload);
      success(t('settings.settingsBhScheduleUpdated'));
    } else {
      await createSet(payload);
      success(t('settings.settingsBhScheduleCreated'));
    }
    open.value = false;
    emit('saved');
  } catch (e) {
    formError.value = e?.message || t('settings.settingsBhSaveFailed');
    notifyError(formError.value);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!isEdit.value || !await confirmAction(t('settings.settingsBhDeleteScheduleConfirm'))) return;
  saving.value = true;
  try {
    await deleteSet(props.scheduleId);
    success(t('settings.settingsBhScheduleDeleted'));
    open.value = false;
    emit('deleted');
  } catch (e) {
    notifyError(e?.message || t('settings.settingsBhDeleteFailed'));
  } finally {
    saving.value = false;
  }
}

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) loadForm();
  }
);

watch(
  () => [props.mode, props.scheduleId],
  () => {
    if (open.value) loadForm();
  }
);
</script>
