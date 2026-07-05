<template>
  <div class="space-y-1">
    <BuilderDisclosureSection
      :title="t('templates.builderTemplateDetails')"
      :default-open="true"
      :bordered="false"
    >
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
      </div>
    </BuilderDisclosureSection>

    <BuilderDisclosureSection :title="t('templates.fieldModuleScope')">
      <BuilderSelect
        :model-value="moduleScope"
        :options="moduleSelectOptions"
        :allow-empty="true"
        :empty-label="t('templates.moduleScopeAny')"
        :disabled="moduleOptionsLoading"
        @update:model-value="emit('update:module-scope', $event)"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection :title="t('templates.builderCurrencyDisplay')">
      <BuilderSelect
        :model-value="currencyDisplay"
        :options="currencyOptions"
        @update:model-value="emit('update:currency-display', $event)"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection
      v-if="!isEmailFormat"
      :title="t('templates.builderTemplateDetailsPage')"
    >
      <BuilderPageSettings
        layout="stacked"
        :paper-size="paperSize"
        :orientation="orientation"
        :custom-page-width="customPageWidth"
        :custom-page-height="customPageHeight"
        @change="emit('update:page-settings', $event)"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection
      v-if="!isEmailFormat"
      :title="t('templates.builderFieldMargin')"
    >
      <PageMarginsPanel
        :margins="margins"
        :embedded="true"
        @change="emit('update:margins', $event)"
      />
    </BuilderDisclosureSection>

    <BuilderDisclosureSection :title="t('templates.builderTemplateDetailsPreview')">
      <p class="text-xs leading-relaxed" :class="ui.textMuted">{{ t('templates.builderSampleRecordHint') }}</p>
      <BuilderRecordPicker
        class="mt-2"
        :module-key="moduleScope"
        :model-value="previewRecordId"
        :selected-label="previewRecordLabel"
        @update:model-value="emit('update:preview-record-id', $event)"
        @update:selected-label="emit('update:preview-record-label', $event)"
      />
    </BuilderDisclosureSection>
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
import BuilderDisclosureSection from './BuilderDisclosureSection.vue';
import BuilderSelect from './BuilderSelect.vue';
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

const moduleSelectOptions = computed(() =>
  moduleOptions.value.map((option) => ({
    value: option.key,
    label: option.label
  }))
);

const currencyOptions = computed(() => [
  { value: 'code', label: t('templates.builderCurrencyDisplayCode') },
  { value: 'symbol', label: t('templates.builderCurrencyDisplaySymbol') }
]);

onMounted(() => {
  void loadModuleOptions();
});
</script>
