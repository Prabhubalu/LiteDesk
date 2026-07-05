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
                <div class="pointer-events-auto flex h-full">
                  <DialogPanel class="flex h-full w-[min(92vw,44rem)] max-w-[95vw] flex-col bg-white shadow-xl dark:bg-gray-800">
                    <form class="relative flex h-full flex-col divide-y divide-gray-200 dark:divide-gray-700" @submit.prevent="submit">
                      <div class="flex shrink-0 items-start justify-between gap-3 bg-indigo-700 px-4 py-5 dark:bg-indigo-800 sm:px-6">
                        <div class="flex min-w-0 items-start gap-3">
                          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white shadow-lg">
                            <DocumentPlusIcon class="h-5 w-5" aria-hidden="true" />
                          </div>
                          <div class="min-w-0">
                            <DialogTitle class="truncate text-base font-semibold text-white">
                              {{ drawerTitle }}
                            </DialogTitle>
                            <p class="mt-0.5 line-clamp-2 text-sm text-indigo-200/90">
                              {{ drawerSubtitle }}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          class="relative shrink-0 rounded-md text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          @click="emit('close')"
                        >
                          <span class="absolute -inset-2.5" />
                          <span class="sr-only">{{ t('common.closePanel') }}</span>
                          <XMarkIcon class="size-6" aria-hidden="true" />
                        </button>
                      </div>

                      <div class="h-0 min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                        <div class="space-y-1 px-4 py-5 sm:px-6">
                          <BuilderDisclosureSection
                            :title="t('templates.fieldOutputFormat')"
                            :default-open="true"
                            :bordered="false"
                          >
                            <BuilderSelect
                              :model-value="form.outputFormat"
                              :options="outputFormatOptions"
                              @update:model-value="onOutputFormatSelect"
                            />
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="isEmailFormat"
                            :title="t('templates.htmlImport.startFromTitle')"
                          >
                            <EmailTemplateStartCards
                              v-model="emailStartMode"
                              :disabled="saving"
                            />
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="showPrintGallery"
                            :title="t('templates.galleryTitle')"
                          >
                            <div class="grid gap-2 sm:grid-cols-2">
                              <button
                                type="button"
                                class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
                                :class="galleryCardClass('blank')"
                                @click="selectGallery('blank')"
                              >
                                <span class="font-medium text-neutral-900 dark:text-neutral-100">
                                  {{ t('templates.galleryBlank') }}
                                </span>
                              </button>
                              <button
                                v-for="item in galleryItems"
                                :key="item.key"
                                type="button"
                                class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
                                :class="galleryCardClass(item.key)"
                                @click="selectGallery(item.key)"
                              >
                                <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ item.name }}</span>
                                <span
                                  v-if="item.description"
                                  class="mt-1 block text-xs text-neutral-500 line-clamp-2 dark:text-neutral-400"
                                >
                                  {{ item.description }}
                                </span>
                                <span
                                  v-else-if="item.moduleScope"
                                  class="mt-1 block text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                  {{ item.moduleScope }}
                                </span>
                              </button>
                            </div>
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="showEmailGallery"
                            :title="t('templates.galleryTitle')"
                          >
                            <div class="grid gap-2">
                              <button
                                v-for="item in emailGalleryItems"
                                :key="item.key"
                                type="button"
                                class="rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
                                :class="galleryCardClass(item.key)"
                                @click="selectGallery(item.key)"
                              >
                                <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ item.name }}</span>
                              </button>
                            </div>
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="showMetadataFields"
                            :title="t('templates.builderTemplateDetails')"
                          >
                            <div class="space-y-3">
                              <div>
                                <label class="mb-1 block" :class="ui.label">
                                  {{ t('templates.fieldName') }}
                                  <span v-if="requiresName" class="text-danger-500">*</span>
                                </label>
                                <input
                                  v-model="form.name"
                                  type="text"
                                  :required="requiresName"
                                  :class="ui.input"
                                />
                              </div>
                              <div>
                                <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldPurpose') }}</label>
                                <input v-model="form.purpose" type="text" :class="ui.input" />
                              </div>
                              <div>
                                <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldCategory') }}</label>
                                <input v-model="form.category" type="text" :class="ui.input" />
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
                            </div>
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="isImportMode"
                            :title="t('templates.fieldModuleScope')"
                          >
                            <BuilderSelect
                              :model-value="form.moduleScope"
                              :options="moduleSelectOptions"
                              :allow-empty="true"
                              :empty-label="t('templates.moduleScopeAny')"
                              :disabled="moduleOptionsLoading"
                              @update:model-value="form.moduleScope = $event"
                            />
                          </BuilderDisclosureSection>

                          <BuilderDisclosureSection
                            v-if="!isEmailFormat"
                            :title="t('templates.builderTemplateDetailsPage')"
                          >
                            <BuilderPageSettings
                              layout="stacked"
                              :paper-size="form.paperSize"
                              :orientation="form.orientation"
                              :custom-page-width="form.customPageWidth"
                              :custom-page-height="form.customPageHeight"
                              @change="onPageSettingsChange"
                            />
                          </BuilderDisclosureSection>
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
                          :disabled="saving || (requiresName && !form.name.trim())"
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
import { DocumentPlusIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { remapDefinitionIds } from '@/utils/templateBuilderTree';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM
} from '@/constants/contentPageSettings';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import BuilderPageSettings from '@/components/templates/builder/BuilderPageSettings.vue';
import BuilderDisclosureSection from '@/modules/template/components/BuilderDisclosureSection.vue';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';
import EmailTemplateStartCards from '@/modules/template/components/html/EmailTemplateStartCards.vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create', 'import-html']);

const { t } = useI18n();
const ui = useBuilderUi();
const saving = ref(false);
const galleryItems = ref([]);
const selectedGalleryKey = ref('blank');
const galleryByKey = ref({});
const emailStartMode = ref('blank');
const { loading: moduleOptionsLoading, moduleOptions, loadModuleOptions } = useTemplateModuleOptions();

const form = reactive({
  name: '',
  purpose: '',
  category: '',
  moduleScope: '',
  outputFormat: 'pdf',
  paperSize: 'A4',
  orientation: 'portrait',
  customPageWidth: DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  customPageHeight: DEFAULT_CUSTOM_PAGE_HEIGHT_MM
});

const outputFormatOptions = computed(() => [
  { value: 'pdf', label: 'PDF' },
  { value: 'html', label: 'HTML' },
  { value: 'email', label: t('templates.formatEmail') }
]);

const moduleSelectOptions = computed(() =>
  moduleOptions.value.map((option) => ({
    value: option.key,
    label: option.label
  }))
);

const isEmailFormat = computed(() => form.outputFormat === 'email');
const emailGalleryItems = computed(() => galleryItems.value.filter((item) => item.outputFormat === 'email'));
const isImportMode = computed(() => isEmailFormat.value && emailStartMode.value === 'import');
const showMetadataFields = computed(() => !isImportMode.value);
const showPrintGallery = computed(() => !isEmailFormat.value);
const showEmailGallery = computed(() => isEmailFormat.value && emailStartMode.value === 'gallery' && emailGalleryItems.value.length > 0);
const requiresName = computed(() => !isImportMode.value);
const drawerTitle = computed(() => (
  isEmailFormat.value ? t('templates.htmlImport.createEmailTitle') : t('templates.createTitle')
));
const drawerSubtitle = computed(() => t('templates.emptyMessage'));
const primaryActionLabel = computed(() => {
  if (isImportMode.value) return t('templates.htmlImport.continue');
  return t('actions.create');
});

function galleryCardClass(key) {
  return selectedGalleryKey.value === key
    ? [ui.selectedRing, ui.selectedBg, 'border-primary-500'].join(' ')
    : [ui.border, 'border hover:border-primary-300 dark:hover:border-primary-600'].join(' ');
}

function onOutputFormatSelect(value) {
  form.outputFormat = value;
  onOutputFormatChange();
}

function onPageSettingsChange(patch) {
  Object.assign(form, patch);
}

async function loadGallery() {
  try {
    const response = await apiClient.get('/templates/gallery', { cache: 'no-store' });
    galleryItems.value = Array.isArray(response?.data) ? response.data : [];
    galleryByKey.value = Object.fromEntries(galleryItems.value.map((item) => [item.key, item]));
  } catch {
    galleryItems.value = [];
    galleryByKey.value = {};
  }
}

function selectGallery(key) {
  selectedGalleryKey.value = key;
  if (key === 'blank') return;
  const item = galleryByKey.value[key];
  if (!item) return;
  form.name = item.name;
  form.purpose = item.purpose || '';
  form.category = item.category || '';
  form.moduleScope = item.moduleScope || '';
  form.outputFormat = item.outputFormat || form.outputFormat;
}

function onOutputFormatChange() {
  if (form.outputFormat === 'email') {
    emailStartMode.value = 'blank';
    selectedGalleryKey.value = 'blank';
    return;
  }
  selectedGalleryKey.value = 'blank';
}

watch(emailStartMode, (mode) => {
  if (mode === 'blank') {
    selectedGalleryKey.value = 'blank';
  }
  if (mode === 'gallery' && emailGalleryItems.value.length === 1) {
    selectGallery(emailGalleryItems.value[0].key);
  }
});

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    form.name = '';
    form.purpose = '';
    form.category = '';
    form.moduleScope = '';
    form.outputFormat = 'pdf';
    form.paperSize = 'A4';
    form.orientation = 'portrait';
    form.customPageWidth = DEFAULT_CUSTOM_PAGE_WIDTH_MM;
    form.customPageHeight = DEFAULT_CUSTOM_PAGE_HEIGHT_MM;
    selectedGalleryKey.value = 'blank';
    emailStartMode.value = 'blank';
    saving.value = false;
    void loadGallery();
  }
);

onMounted(() => {
  void loadGallery();
  void loadModuleOptions();
});

function buildMetadataPayload() {
  return {
    purpose: form.purpose.trim(),
    category: form.category.trim(),
    moduleScope: form.moduleScope,
    outputFormat: form.outputFormat
  };
}

async function submit() {
  if (isImportMode.value) {
    emit('import-html', buildMetadataPayload());
    return;
  }

  if (!form.name.trim()) return;
  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      ...buildMetadataPayload()
    };

    if (!isEmailFormat.value) {
      payload.paperSize = form.paperSize;
      payload.orientation = form.orientation;

      if (form.paperSize === 'Custom') {
        payload.customPageWidth = form.customPageWidth;
        payload.customPageHeight = form.customPageHeight;
      }
    }

    const galleryKey = isEmailFormat.value
      ? (emailStartMode.value === 'gallery' ? selectedGalleryKey.value : 'blank')
      : selectedGalleryKey.value;

    if (galleryKey !== 'blank') {
      const item = galleryByKey.value[galleryKey];
      if (item?.jsonDefinition) {
        payload.jsonDefinition = remapDefinitionIds(item.jsonDefinition);
      }
    }

    emit('create', payload);
  } finally {
    saving.value = false;
  }
}
</script>
