<template>
  <div class="space-y-5">
    <section class="space-y-3">
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.builderTemplateDetails') }}</h3>
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
    </section>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.fieldModuleScope') }}</h3>
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
    </section>

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.builderCurrencyDisplay') }}</h3>
      <select
        :value="currencyDisplay"
        :class="ui.input"
        @change="emit('update:currency-display', $event.target.value)"
      >
        <option value="code">{{ t('templates.builderCurrencyDisplayCode') }}</option>
        <option value="symbol">{{ t('templates.builderCurrencyDisplaySymbol') }}</option>
      </select>
    </section>

    <section v-if="!isEmailFormat" class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.builderTemplateDetailsPage') }}</h3>
      <BuilderPageSettings
        layout="stacked"
        :paper-size="paperSize"
        :orientation="orientation"
        :custom-page-width="customPageWidth"
        :custom-page-height="customPageHeight"
        @change="emit('update:page-settings', $event)"
      />
    </section>

    <PageMarginsPanel
      v-if="!isEmailFormat"
      :margins="margins"
      @change="emit('update:margins', $event)"
    />

    <section class="space-y-3 border-t pt-4" :class="ui.border">
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.builderTemplateDetailsPreview') }}</h3>
      <p class="text-xs leading-relaxed" :class="ui.textMuted">{{ t('templates.builderSampleRecordHint') }}</p>
      <BuilderRecordPicker
        :module-key="moduleScope"
        :model-value="previewRecordId"
        :selected-label="previewRecordLabel"
        @update:model-value="emit('update:preview-record-id', $event)"
        @update:selected-label="emit('update:preview-record-label', $event)"
      />
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import BuilderPageSettings from '@/components/templates/builder/BuilderPageSettings.vue';
import BuilderRecordPicker from '@/components/templates/builder/BuilderRecordPicker.vue';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  isEmailOutputFormat
} from '@/constants/contentPageSettings';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { useTemplateModuleOptions } from '@/composables/useTemplateMergeTagSchema';
import PageMarginsPanel from './PageMarginsPanel.vue';

const props = defineProps({
  name: { type: String, default: '' },
  description: { type: String, default: '' },
  moduleScope: { type: String, default: '' },
  paperSize: { type: String, default: 'A4' },
  orientation: { type: String, default: 'portrait' },
  customPageWidth: { type: Number, default: DEFAULT_CUSTOM_PAGE_WIDTH_MM },
  customPageHeight: { type: Number, default: DEFAULT_CUSTOM_PAGE_HEIGHT_MM },
  margins: { type: Object, default: () => ({}) },
  previewRecordId: { type: String, default: '' },
  previewRecordLabel: { type: String, default: '' },
  currencyDisplay: { type: String, default: 'code' },
  outputFormat: { type: String, default: 'pdf' }
});

const emit = defineEmits([
  'update:name',
  'update:description',
  'update:module-scope',
  'update:page-settings',
  'update:margins',
  'update:preview-record-id',
  'update:preview-record-label',
  'update:currency-display'
]);

const { t } = useI18n();
const ui = useBuilderUi();
const { loading: moduleOptionsLoading, moduleOptions, loadModuleOptions } = useTemplateModuleOptions();

const moduleScope = computed(() => String(props.moduleScope || ''));
const paperSize = computed(() => String(props.paperSize || 'A4'));
const orientation = computed(() => (props.orientation === 'landscape' ? 'landscape' : 'portrait'));
const customPageWidth = computed(() => Number(props.customPageWidth) || DEFAULT_CUSTOM_PAGE_WIDTH_MM);
const customPageHeight = computed(() => Number(props.customPageHeight) || DEFAULT_CUSTOM_PAGE_HEIGHT_MM);
const currencyDisplay = computed(() => (
  props.currencyDisplay === 'symbol' ? 'symbol' : 'code'
));
const isEmailFormat = computed(() => isEmailOutputFormat(props.outputFormat));

onMounted(() => {
  void loadModuleOptions();
});
</script>
