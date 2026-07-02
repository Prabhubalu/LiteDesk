<template>
  <div class="border-b" :class="ui.border">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
      :aria-expanded="open"
      @click="open = !open"
    >
      <h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        {{ t('templates.builderTemplateDetails') }}
      </h3>
      <ChevronDownIcon
        class="h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
      />
    </button>

    <div v-show="open" class="space-y-5 border-t px-4 py-4" :class="ui.border">
      <div class="space-y-3">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldName') }}</label>
          <input
            :value="name"
            type="text"
            :class="ui.input"
            @change="emit('update:name', $event.target.value)"
          />
        </div>

        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldDescription') }}</label>
          <textarea
            :value="description"
            rows="2"
            :class="ui.input"
            :placeholder="t('templates.builderTemplateDescriptionPh')"
            @change="emit('update:description', $event.target.value)"
          />
        </div>

        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldModuleScope') }}</label>
          <select
            :value="moduleScope"
            :class="ui.input"
            :disabled="moduleOptionsLoading"
            @change="emit('update:module-scope', $event.target.value)"
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

        <div v-if="status">
          <label class="mb-1 block" :class="ui.label">{{ t('templates.fieldStatus') }}</label>
          <span
            class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </span>
        </div>
      </div>

      <div v-if="!isEmailFormat" class="space-y-3 border-t pt-4" :class="ui.border">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderTemplateDetailsPage') }}
        </p>

        <BuilderPageSettings
          layout="stacked"
          :paper-size="paperSize"
          :orientation="orientation"
          :custom-page-width="customPageWidth"
          :custom-page-height="customPageHeight"
          @change="emit('update:page-settings', $event)"
        />

        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderLayoutMode') }}</label>
          <select
            :value="layoutMode"
            :class="ui.input"
            @change="emit('update:layout-mode', $event.target.value)"
          >
            <option value="absolute">{{ t('templates.builderLayoutModeFreeform') }}</option>
            <option value="flow">{{ t('templates.builderLayoutModeFlow') }}</option>
          </select>
        </div>
      </div>

      <div class="space-y-3 border-t pt-4" :class="ui.border">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {{ t('templates.builderTemplateDetailsPreview') }}
        </p>
        <p class="text-meta" :class="ui.textMuted">{{ t('templates.builderSampleRecordHint') }}</p>
        <BuilderRecordPicker
          :module-key="moduleScope"
          :model-value="previewRecordId"
          :selected-label="previewRecordLabel"
          @update:model-value="emit('update:preview-record-id', $event)"
          @update:selected-label="emit('update:preview-record-label', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import BuilderPageSettings from '@/components/templates/builder/BuilderPageSettings.vue';
import BuilderRecordPicker from '@/components/templates/builder/BuilderRecordPicker.vue';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import { isEmailOutputFormat } from '@/constants/contentPageSettings';

const props = defineProps({
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  status: { type: String, default: '' },
  moduleScope: { type: String, default: '' },
  paperSize: { type: String, default: 'A4' },
  orientation: { type: String, default: 'portrait' },
  customPageWidth: { type: Number, default: 210 },
  customPageHeight: { type: Number, default: 297 },
  layoutMode: { type: String, default: 'absolute' },
  previewRecordId: { type: String, default: '' },
  previewRecordLabel: { type: String, default: '' },
  outputFormat: { type: String, default: 'pdf' }
});

const emit = defineEmits([
  'update:name',
  'update:description',
  'update:module-scope',
  'update:page-settings',
  'update:layout-mode',
  'update:preview-record-id',
  'update:preview-record-label'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const open = ref(true);

const { loading: moduleOptionsLoading, moduleOptions, loadModuleOptions } = useTemplateModuleOptions();

const isEmailFormat = computed(() => isEmailOutputFormat(props.outputFormat));

const statusLabel = computed(() => {
  const normalized = String(props.status || 'draft').toLowerCase();
  const keyMap = {
    draft: 'templates.statusDraft',
    published: 'templates.statusPublished',
    archived: 'templates.statusArchived'
  };
  const key = keyMap[normalized];
  return key ? t(key) : normalized.charAt(0).toUpperCase() + normalized.slice(1);
});

const statusBadgeClass = computed(() => {
  switch (props.status) {
    case 'published':
      return 'bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300';
    case 'archived':
      return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';
    default:
      return 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300';
  }
});

onMounted(() => {
  void loadModuleOptions();
});
</script>
