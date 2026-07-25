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
              <DialogPanel class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full w-screen max-w-5xl flex-col bg-white shadow-xl dark:bg-gray-900">
                <div class="flex shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
                  <div class="min-w-0">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      {{ isNew ? t('settings.slaPolicyDrawerNew') : draftName }}
                    </DialogTitle>
                    <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {{ drawerSubtitle }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    @click="$emit('close')"
                  >
                    <XMarkIcon class="h-5 w-5" />
                  </button>
                </div>

                <div v-if="validationError" class="mx-5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-200">
                  {{ validationError }}
                </div>

                <div v-if="open" class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  <SlaPolicyEditor
                    ref="editorRef"
                    :policy-key="policyKey"
                    :initial-policy="initialPolicy"
                    :is-new="isNew"
                    :read-only="readOnly"
                    in-drawer
                    :fixed-module-key="fixedModuleKey"
                    :modules="modules"
                    :metadata="metadata"
                    :module-fields="moduleFields"
                    @module-change="$emit('module-change', $event)"
                  />
                </div>

                <div class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
                  <button
                    v-if="!readOnly && !isNew && !isDefaultPolicy"
                    type="button"
                    class="text-sm font-medium text-red-600 hover:underline"
                    @click="$emit('delete')"
                  >
                    {{ t('settings.slaPolicyDelete') }}
                  </button>
                  <div class="ml-auto flex gap-2">
                    <button type="button" class="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700" @click="$emit('close')">
                      {{ readOnly ? t('actions.close') : t('actions.cancel') }}
                    </button>
                    <button
                      v-if="readOnly"
                      type="button"
                      class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      @click="$emit('switch-to-edit')"
                    >
                      {{ t('actions.edit') }}
                    </button>
                    <button
                      v-else
                      type="button"
                      class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      :disabled="saving"
                      @click="save"
                    >
                      {{ saving ? t('states.saving') : t('actions.save') }}
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
import SlaPolicyEditor from '@/components/settings/sla/SlaPolicyEditor.vue';

const props = defineProps({
  open: { type: Boolean, default: false },
  policyKey: { type: String, default: '' },
  isNew: { type: Boolean, default: false },
  readOnly: { type: Boolean, default: false },
  isDefaultPolicy: { type: Boolean, default: false },
  fixedModuleKey: { type: String, default: '' },
  initialPolicy: { type: Object, default: null },
  modules: { type: Array, default: () => [] },
  metadata: { type: Object, default: () => ({}) },
  moduleFields: { type: Array, default: () => [] },
  saving: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'save', 'delete', 'module-change', 'switch-to-edit']);

const { t } = useI18n();
const editorRef = ref(null);
const validationError = ref('');

const draftName = computed(() => props.initialPolicy?.name || props.policyKey || '');
const drawerSubtitle = computed(() => {
  if (props.isNew) return t('settings.slaSimpleDrawerHint');
  if (props.readOnly) return t('settings.slaPolicyPreviewSubtitle');
  return t('settings.slaPolicyEditorSubtitle');
});

function save() {
  validationError.value = '';
  const err = editorRef.value?.validate?.();
  if (err) {
    validationError.value = err;
    return;
  }
  emit('save', editorRef.value?.buildPayload?.());
}

watch(() => props.open, (value) => {
  if (!value) validationError.value = '';
});
</script>
