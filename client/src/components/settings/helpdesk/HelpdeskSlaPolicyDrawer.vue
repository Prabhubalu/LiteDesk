<template>
  <TransitionRoot as="template" :show="open">
    <Dialog class="relative z-[10000]" @close="requestClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" aria-hidden="true" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
            <TransitionChild
              as="template"
              enter="transform transition ease-in-out duration-300"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in-out duration-300"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full w-screen max-w-2xl flex-col bg-white shadow-xl dark:bg-gray-900">
                <div class="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                  <div class="min-w-0">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ drawerTitle }}
                    </DialogTitle>
                    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ t('settings.slaPolicyEditorSubtitle') }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <div v-if="!isStandard" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500">{{ enabledLabel }}</span>
                      <button type="button" class="relative inline-flex h-6 w-11" @click="toggleEnabled">
                        <span class="h-6 w-11 rounded-full transition" :class="enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'" />
                        <span class="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition" :class="enabled ? 'translate-x-5' : ''" />
                      </button>
                    </div>
                    <button
                      type="button"
                      class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                      @click="requestClose"
                    >
                      <span class="sr-only">{{ t('actions.close') }}</span>
                      <XMarkIcon class="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div v-if="open" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <HelpdeskSlaPolicyEditor
                    ref="editorRef"
                    :key="editorKey"
                    in-drawer
                    :policy-id="policyId || 'new'"
                    :is-new="isNew"
                    :is-standard="isStandard"
                    :initial-policy="initialPolicy"
                    :priorities="priorities"
                    :case-types="caseTypes"
                    :channels="channels"
                    :sla-policy-options="slaPolicyOptions"
                    :case-type-label="caseTypeLabel"
                    :priority-label="priorityLabel"
                    :standard-targets="standardTargets"
                    :business-hours="businessHours"
                    :enabled-case-types="enabledCaseTypes"
                    :recalculating-slas="recalculatingSlas"
                    :recalculate-message="recalculateMessage"
                    @remove="handleRemove"
                    @recalculate="$emit('recalculate')"
                    @update:business-hours="$emit('update:businessHours', $event)"
                    @update:enabled-case-types="$emit('update:enabledCaseTypes', $event)"
                  />
                </div>

                <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 dark:border-gray-800">
                  <button
                    v-if="!isNew && !isStandard"
                    type="button"
                    class="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                    @click="handleRemove"
                  >
                    {{ t('settings.slaPolicyDelete') }}
                  </button>
                  <div v-else />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                      @click="requestClose"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="button"
                      class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      @click="save"
                    >
                      {{ t('settings.helpdeskExecSlaDrawerSave') }}
                    </button>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import HelpdeskSlaPolicyEditor from '@/components/settings/helpdesk/HelpdeskSlaPolicyEditor.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  policyId: { type: String, default: '' },
  isNew: { type: Boolean, default: false },
  isStandard: { type: Boolean, default: false },
  initialPolicy: { type: Object, default: null },
  priorities: { type: Array, required: true },
  caseTypes: { type: Array, required: true },
  channels: { type: Array, required: true },
  slaPolicyOptions: { type: Object, required: true },
  caseTypeLabel: { type: Function, required: true },
  priorityLabel: { type: Function, required: true },
  standardTargets: { type: Object, default: () => ({}) },
  businessHours: { type: Object, required: true },
  enabledCaseTypes: { type: Array, default: () => [] },
  recalculatingSlas: { type: Boolean, default: false },
  recalculateMessage: { type: String, default: '' }
});

const emit = defineEmits(['close', 'save', 'remove', 'recalculate', 'update:businessHours', 'update:enabledCaseTypes']);

const { t } = useI18n();

const editorRef = ref(null);
const enabled = ref(true);

const editorKey = computed(() => `${props.policyId || 'new'}-${props.isNew}`);

const drawerTitle = computed(() => {
  if (props.isNew) return t('settings.slaPolicyDrawerNew');
  if (props.isStandard) return t('settings.slaPolicyStandardName');
  return props.initialPolicy?.name || t('settings.helpdeskExecSlaDrawerEditTitle');
});

const enabledLabel = computed(() => (
  enabled.value ? t('settings.slaPolicyStatusActive') : t('settings.slaPolicyStatusInactive')
));

watch(
  () => [props.open, props.initialPolicy],
  () => {
    if (props.open) {
      enabled.value = props.initialPolicy?.enabled !== false;
    }
  },
  { immediate: true }
);

function toggleEnabled() {
  enabled.value = !enabled.value;
  const draft = editorRef.value?.getDraft?.();
  if (draft) draft.enabled = enabled.value;
}

function requestClose() {
  emit('close');
}

function save() {
  const err = editorRef.value?.validate?.();
  if (err) return;
  const payload = editorRef.value?.getPayload?.();
  if (!payload) return;
  payload.enabled = enabled.value;
  emit('save', payload);
}

function handleRemove() {
  emit('remove');
}

defineExpose({
  validate: () => editorRef.value?.validate?.(),
  getPayload: () => editorRef.value?.getPayload?.()
});
</script>
