<template>
  <Teleport to="body">
    <TransitionRoot as="template" :show="isOpen">
      <Dialog class="relative z-[10000]" @close="emit('close')">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="ease-in duration-200"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-gray-500/50 dark:bg-black/60" />
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
                <div class="rounded-tl-xl overflow-hidden pointer-events-auto flex h-full">
                  <DialogPanel class="rounded-tl-xl overflow-hidden flex h-full w-[30rem] max-w-[95vw] flex-col bg-white shadow-xl dark:bg-gray-800">
                    <form class="rounded-none relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700" @submit.prevent="submit">
                      <div class="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-4 sm:px-6">
                        <DialogTitle class="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                          {{ drawerTitle }}
                        </DialogTitle>
                        <button
                          type="button"
                          class="relative rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer ml-3 shrink-0"
                          @click="emit('close')"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>

                      <div class="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <div class="space-y-5 px-4 py-6 sm:px-6">
                          <div>
                            <label class="mb-1 block" :class="ui.label">
                              {{ t('templates.fieldName') }}
                              <span class="text-danger-500">*</span>
                            </label>
                            <input
                              v-model="form.name"
                              type="text"
                              required
                              autofocus
                              :class="ui.input"
                              :placeholder="t('templates.fieldName')"
                            />
                          </div>

                          <div>
                            <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldType') }}</label>
                            <BuilderSelect
                              :model-value="form.outputFormat"
                              :options="typeOptions"
                              @update:model-value="onTypeSelect"
                            />
                          </div>

                          <div>
                            <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldModuleScope') }}</label>
                            <BuilderSelect
                              :model-value="form.moduleScope"
                              :options="moduleSelectOptions"
                              :allow-empty="true"
                              :empty-label="t('templates.moduleScopeAny')"
                              :disabled="moduleOptionsLoading"
                              @update:model-value="form.moduleScope = $event"
                            />
                          </div>

                          <div v-if="!isEmailFormat" class="space-y-3">
                            <BuilderPageSettings
                              layout="stacked"
                              :paper-size="form.paperSize"
                              :orientation="form.orientation"
                              :custom-page-width="form.customPageWidth"
                              :custom-page-height="form.customPageHeight"
                              @change="onPageSettingsChange"
                            />
                          </div>

                          <div>
                            <label class="mb-2 block" :class="ui.label">{{ t('templates.htmlImport.startFromTitle') }}</label>
                            <EmailTemplateStartCards
                              v-model="startMode"
                              :disabled="saving"
                            />
                          </div>
                        </div>
                      </div>

                      <div class="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-800 sm:px-6">
                        <button
                          type="button"
                          class="cursor-pointer rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:ring-gray-600 dark:hover:bg-gray-700"
                          @click="emit('close')"
                        >
                          {{ t('actions.cancel') }}
                        </button>
                        <button
                          type="submit"
                          class="inline-flex cursor-pointer items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                          :disabled="saving || !form.name.trim()"
                        >
                          <svg
                            v-if="saving"
                            class="h-4 w-4 animate-spin"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>{{ primaryActionLabel }}</span>
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
  </Teleport>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM
} from '@/constants/contentPageSettings';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import BuilderPageSettings from '@/components/templates/builder/BuilderPageSettings.vue';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';
import EmailTemplateStartCards from '@/modules/template/components/html/EmailTemplateStartCards.vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create', 'import-html']);

const { t } = useI18n();
const ui = useBuilderUi();
const saving = ref(false);
const startMode = ref('blank');
const { loading: moduleOptionsLoading, moduleOptions, loadModuleOptions } = useTemplateModuleOptions();

const form = reactive({
  name: '',
  moduleScope: '',
  outputFormat: 'pdf',
  paperSize: 'A4',
  orientation: 'portrait',
  customPageWidth: DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  customPageHeight: DEFAULT_CUSTOM_PAGE_HEIGHT_MM
});

const typeOptions = computed(() => [
  { value: 'pdf', label: t('templates.typePrintTemplate') },
  { value: 'email', label: t('templates.typeEmailTemplate') }
]);

const moduleSelectOptions = computed(() =>
  moduleOptions.value.map((option) => ({
    value: option.key,
    label: option.label
  }))
);

const isEmailFormat = computed(() => form.outputFormat === 'email');
const isImportMode = computed(() => startMode.value === 'import');
const drawerTitle = computed(() => (
  isEmailFormat.value ? t('templates.htmlImport.createEmailTitle') : t('templates.createTitle')
));
const primaryActionLabel = computed(() => {
  if (isImportMode.value) return t('templates.htmlImport.continue');
  return t('actions.create');
});

function onTypeSelect(value) {
  form.outputFormat = value === 'email' ? 'email' : 'pdf';
  startMode.value = 'blank';
}

function onPageSettingsChange(patch) {
  Object.assign(form, patch);
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    form.name = '';
    form.moduleScope = '';
    form.outputFormat = 'pdf';
    form.paperSize = 'A4';
    form.orientation = 'portrait';
    form.customPageWidth = DEFAULT_CUSTOM_PAGE_WIDTH_MM;
    form.customPageHeight = DEFAULT_CUSTOM_PAGE_HEIGHT_MM;
    startMode.value = 'blank';
    saving.value = false;
  }
);

onMounted(() => {
  void loadModuleOptions();
});

function buildMetadataPayload() {
  const payload = {
    name: form.name.trim(),
    moduleScope: form.moduleScope,
    outputFormat: form.outputFormat
  };
  if (!isEmailFormat.value) {
    payload.paperSize = form.paperSize;
    payload.orientation = form.orientation;
    if (form.paperSize === 'Custom') {
      payload.customPageWidth = form.customPageWidth;
      payload.customPageHeight = form.customPageHeight;
    }
  }
  return payload;
}

async function submit() {
  if (!form.name.trim()) return;

  if (isImportMode.value) {
    emit('import-html', buildMetadataPayload());
    return;
  }

  saving.value = true;
  try {
    emit('create', {
      name: form.name.trim(),
      ...buildMetadataPayload()
    });
  } finally {
    saving.value = false;
  }
}
</script>
