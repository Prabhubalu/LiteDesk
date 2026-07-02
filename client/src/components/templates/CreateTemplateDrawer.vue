<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-150"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-900/40" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden">
          <div class="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <TransitionChild
              as="template"
              enter="transform transition ease-out duration-200"
              enter-from="translate-x-full"
              enter-to="translate-x-0"
              leave="transform transition ease-in duration-150"
              leave-from="translate-x-0"
              leave-to="translate-x-full"
            >
              <DialogPanel class="pointer-events-auto w-screen max-w-lg bg-white dark:bg-gray-900 shadow-xl">
                <form class="flex h-full flex-col" @submit.prevent="submit">
                  <div class="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                      {{ drawerTitle }}
                    </DialogTitle>
                  </div>

                  <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldOutputFormat') }}
                      </label>
                      <select
                        v-model="form.outputFormat"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        @change="onOutputFormatChange"
                      >
                        <option value="pdf">PDF</option>
                        <option value="html">HTML</option>
                        <option value="email">{{ t('templates.formatEmail') }}</option>
                      </select>
                    </div>

                    <EmailTemplateStartCards
                      v-if="isEmailFormat"
                      v-model="emailStartMode"
                      :disabled="saving"
                    />

                    <section v-else>
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {{ t('templates.galleryTitle') }}
                      </h3>
                      <div class="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          class="rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                          :class="selectedGalleryKey === 'blank'
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'"
                          @click="selectGallery('blank')"
                        >
                          <span class="font-medium">{{ t('templates.galleryBlank') }}</span>
                        </button>
                        <button
                          v-for="item in galleryItems"
                          :key="item.key"
                          type="button"
                          class="rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                          :class="selectedGalleryKey === item.key
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'"
                          @click="selectGallery(item.key)"
                        >
                          <span class="font-medium">{{ item.name }}</span>
                          <span v-if="item.description" class="mt-1 block text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                            {{ item.description }}
                          </span>
                          <span v-else-if="item.moduleScope" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                            {{ item.moduleScope }}
                          </span>
                        </button>
                      </div>
                    </section>

                    <section v-if="isEmailFormat && emailStartMode === 'gallery' && emailGalleryItems.length">
                      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        {{ t('templates.galleryTitle') }}
                      </h3>
                      <div class="grid gap-2">
                        <button
                          v-for="item in emailGalleryItems"
                          :key="item.key"
                          type="button"
                          class="rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                          :class="selectedGalleryKey === item.key
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'"
                          @click="selectGallery(item.key)"
                        >
                          <span class="font-medium">{{ item.name }}</span>
                        </button>
                      </div>
                    </section>

                    <div v-if="showMetadataFields">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldName') }}
                      </label>
                      <input
                        v-model="form.name"
                        type="text"
                        :required="requiresName"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div v-if="showMetadataFields">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldPurpose') }}
                      </label>
                      <input
                        v-model="form.purpose"
                        type="text"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div v-if="showMetadataFields">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldCategory') }}
                      </label>
                      <input
                        v-model="form.category"
                        type="text"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                    <div v-if="showMetadataFields || isImportMode">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        {{ t('templates.fieldModuleScope') }}
                      </label>
                      <select
                        v-model="form.moduleScope"
                        class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        :disabled="moduleOptionsLoading"
                      >
                        <option value="">{{ t('templates.moduleScopeAny') }}</option>
                        <option
                          v-for="option in moduleOptions"
                          :key="option.key"
                          :value="option.key"
                        >
                          {{ option.label }}
                        </option>
                      </select>
                    </div>

                    <div v-if="!isEmailFormat" class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {{ t('templates.builderPageSize') }}
                        </label>
                        <select
                          v-model="form.paperSize"
                          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <optgroup
                            v-for="group in paperSizeGroups"
                            :key="group.key"
                            :label="t(`templates.builderPageGroup${group.key}`)"
                          >
                            <option v-for="size in group.sizes" :key="size" :value="size">
                              {{ size === 'Custom' ? t('templates.builderPageCustom') : size }}
                            </option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {{ t('templates.builderPageOrientation') }}
                        </label>
                        <select
                          v-model="form.orientation"
                          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        >
                          <option value="portrait">{{ t('templates.builderPageOrientationPortrait') }}</option>
                          <option value="landscape">{{ t('templates.builderPageOrientationLandscape') }}</option>
                        </select>
                      </div>
                    </div>

                    <div v-if="!isEmailFormat && form.paperSize === 'Custom'" class="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {{ t('templates.builderPageWidth') }} (mm)
                        </label>
                        <input
                          v-model.number="form.customPageWidth"
                          type="number"
                          min="50"
                          max="2000"
                          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {{ t('templates.builderPageHeight') }} (mm)
                        </label>
                        <input
                          v-model.number="form.customPageHeight"
                          type="number"
                          min="50"
                          max="2000"
                          class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-2">
                    <button
                      type="button"
                      class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                      @click="emit('close')"
                    >
                      {{ t('actions.cancel') }}
                    </button>
                    <button
                      type="submit"
                      class="px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      :disabled="saving || (requiresName && !form.name.trim())"
                    >
                      {{ primaryActionLabel }}
                    </button>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { remapDefinitionIds } from '@/utils/templateBuilderTree';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  PAPER_SIZE_GROUPS
} from '@/constants/contentPageSettings';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import EmailTemplateStartCards from '@/modules/template/components/html/EmailTemplateStartCards.vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'create', 'import-html']);

const { t } = useI18n();
const saving = ref(false);
const galleryItems = ref([]);
const selectedGalleryKey = ref('blank');
const galleryByKey = ref({});
const emailStartMode = ref('blank');
const { loading: moduleOptionsLoading, moduleOptions, loadModuleOptions } = useTemplateModuleOptions();
const paperSizeGroups = PAPER_SIZE_GROUPS;

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

const isEmailFormat = computed(() => form.outputFormat === 'email');
const emailGalleryItems = computed(() => galleryItems.value.filter((item) => item.outputFormat === 'email'));
const isImportMode = computed(() => isEmailFormat.value && emailStartMode.value === 'import');
const showMetadataFields = computed(() => !isImportMode.value);
const requiresName = computed(() => !isImportMode.value);
const drawerTitle = computed(() => (
  isEmailFormat.value ? t('templates.htmlImport.createEmailTitle') : t('templates.createTitle')
));
const primaryActionLabel = computed(() => {
  if (isImportMode.value) return t('templates.htmlImport.continue');
  return t('actions.create');
});

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
