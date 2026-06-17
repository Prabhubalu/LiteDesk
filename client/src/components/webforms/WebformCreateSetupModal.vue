<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[10000]" @close="$emit('close')">
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

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('webforms.createSetupTitle') }}
              </DialogTitle>
              <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {{ t('webforms.createSetupHint') }}
              </p>

              <form class="mt-5 space-y-4" @submit.prevent="submit">
                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('webforms.fieldName') }}
                  </label>
                  <input
                    v-model="name"
                    type="text"
                    required
                    :class="inputClass"
                    :placeholder="t('webforms.createSetupNamePh')"
                  />
                </div>

                <div>
                  <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {{ t('webforms.fieldTargetModule') }}
                  </label>
                  <select v-model="targetModuleSelection" required :class="inputClass" :disabled="loadingModules">
                    <option value="" disabled>{{ t('webforms.createSetupModulePh') }}</option>
                    <optgroup v-if="platformModules.length" :label="t('webforms.targetGroupPlatform')">
                      <option
                        v-for="mod in platformModules"
                        :key="moduleOptionValue(mod)"
                        :value="moduleOptionValue(mod)"
                      >
                        {{ mod.label }}
                      </option>
                    </optgroup>
                    <optgroup v-for="group in appModuleGroups" :key="group.appKey" :label="group.label">
                      <option
                        v-for="mod in group.modules"
                        :key="moduleOptionValue(mod)"
                        :value="moduleOptionValue(mod)"
                      >
                        {{ mod.label }}
                      </option>
                    </optgroup>
                  </select>
                </div>

                <div class="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    :class="WEBFORM_BTN_GHOST"
                    :disabled="submitting"
                    @click="$emit('close')"
                  >
                    {{ t('actions.cancel') }}
                  </button>
                  <button
                    type="submit"
                    :class="[WEBFORM_BTN_PRIMARY, 'rounded-xl disabled:opacity-60']"
                    :disabled="submitting || !canSubmit"
                  >
                    {{ submitting ? t('webforms.createSetupCreating') : t('webforms.createSetupContinue') }}
                  </button>
                </div>
              </form>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot
} from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import {
  parseWebformModuleOptionValue,
  webformModuleOptionValue
} from '@/utils/webformModuleDefinition';
import { WEBFORM_BTN_GHOST, WEBFORM_BTN_PRIMARY, WEBFORM_MODAL_INPUT_CLASS } from '@/utils/webformUiClasses';

const props = defineProps({
  open: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create']);

const { t } = useI18n();

const name = ref('');
const targetModuleSelection = ref('');
const submitting = ref(false);
const loadingModules = ref(false);
const targetModules = ref([]);

const APP_LABELS = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  PROJECTS: 'Projects',
  PORTAL: 'Portal',
  AUDIT: 'Audit',
  LMS: 'LMS',
  INVENTORY: 'Inventory',
  PLATFORM: 'Platform'
};

const inputClass = WEBFORM_MODAL_INPUT_CLASS;

const platformModules = computed(() =>
  targetModules.value.filter((row) => row.scope === 'platform')
);

const appModuleGroups = computed(() => {
  const groups = new Map();
  for (const mod of targetModules.value) {
    if (mod.scope !== 'app') continue;
    const appKey = String(mod.appKey || '').toUpperCase();
    if (!groups.has(appKey)) {
      groups.set(appKey, {
        appKey,
        label: t('webforms.targetGroupApp', { app: APP_LABELS[appKey] || appKey }),
        modules: []
      });
    }
    groups.get(appKey).modules.push(mod);
  }
  return [...groups.values()];
});

const canSubmit = computed(() =>
  Boolean(name.value.trim()) && Boolean(targetModuleSelection.value) && !loadingModules.value
);

function moduleOptionValue(mod) {
  return webformModuleOptionValue(mod.moduleKey, mod.appKey);
}

function resetForm() {
  name.value = '';
  targetModuleSelection.value = '';
}

async function loadTargetModules() {
  loadingModules.value = true;
  try {
    const res = await apiClient.get('/settings/webforms/modules');
    targetModules.value = res?.success && Array.isArray(res.data) ? res.data : [];
    if (!targetModuleSelection.value && targetModules.value.length) {
      const people = targetModules.value.find(
        (row) => row.moduleKey === 'people' && row.appKey === 'PLATFORM'
      ) || targetModules.value.find((row) => row.moduleKey === 'people')
        || targetModules.value[0];
      targetModuleSelection.value = moduleOptionValue(people);
    }
  } catch {
    targetModules.value = [];
  } finally {
    loadingModules.value = false;
  }
}

function submit() {
  if (!canSubmit.value || submitting.value) return;
  const { moduleKey, appKey } = parseWebformModuleOptionValue(targetModuleSelection.value);
  const mod = targetModules.value.find(
    (row) => row.moduleKey === moduleKey && String(row.appKey || '').toUpperCase() === appKey
  ) || targetModules.value.find((row) => row.moduleKey === moduleKey);
  emit('create', {
    name: name.value.trim(),
    targetModuleKey: moduleKey,
    targetAppKey: mod?.appKey || appKey || ''
  });
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      resetForm();
      loadTargetModules();
    }
  }
);

defineExpose({ setSubmitting(value) { submitting.value = value; } });
</script>
