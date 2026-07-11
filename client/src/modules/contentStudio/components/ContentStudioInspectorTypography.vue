<template>
  <div class="space-y-3">
    <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTextSize')">
      <BuilderSelect
        :model-value="fontSize || ''"
        :options="fontSizeSelectOptions"
        allow-empty
        :empty-label="t('contentStudio.fontSizeDefault')"
        empty-value=""
        button-class="h-8"
        @update:model-value="emit('update:typography', { fontSize: $event || null })"
      />
    </ContentStudioInspectorFieldRow>

    <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldLineHeight')">
      <BuilderSelect
        :model-value="lineHeight || ''"
        :options="lineHeightSelectOptions"
        allow-empty
        :empty-label="t('contentStudio.lineHeightDefault')"
        empty-value=""
        button-class="h-8"
        @update:model-value="emit('update:typography', { lineHeight: $event || null })"
      />
    </ContentStudioInspectorFieldRow>

    <ContentStudioInspectorFieldRow :label="t('contentStudio.fieldTextColor')" wide>
      <div class="flex w-full items-center gap-2">
        <input
          type="color"
          :value="resolvedColor"
          class="h-8 w-10 shrink-0 cursor-pointer rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
          @input="emit('update:typography', { textColor: $event.target.value || null })"
        />
        <input
          type="text"
          :value="textColor || ''"
          :placeholder="defaultColor"
          :class="[ui.input, 'h-8 min-w-0 flex-1 text-sm']"
          @change="emit('update:typography', { textColor: $event.target.value || null })"
        />
      </div>
    </ContentStudioInspectorFieldRow>
    <ContentStudioInspectorFieldRow v-if="showBackground" :label="t('contentStudio.fieldBackgroundColor')" wide>
      <div class="flex w-full items-center gap-2">
        <input
          type="color"
          :value="resolvedBackgroundColor"
          class="h-8 w-10 shrink-0 cursor-pointer rounded border border-neutral-200 bg-white p-0.5 dark:border-neutral-700 dark:bg-neutral-950"
          @input="emit('update:typography', { backgroundColor: $event.target.value || null })"
        />
        <input
          type="text"
          :value="backgroundColor || ''"
          :placeholder="t('contentStudio.backgroundColorPlaceholder')"
          :class="[ui.input, 'h-8 min-w-0 flex-1 text-sm']"
          @change="emit('update:typography', { backgroundColor: $event.target.value || null })"
        />
      </div>
    </ContentStudioInspectorFieldRow>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';
import ContentStudioInspectorFieldRow from './ContentStudioInspectorControls.vue';
import { DEFAULT_TEXT_COLOR, FONT_SIZE_OPTIONS, LINE_HEIGHT_OPTIONS } from '../editor/blockInspectorMeta';

const props = defineProps({
  fontSize: { type: String, default: '' },
  textColor: { type: String, default: '' },
  lineHeight: { type: String, default: '' },
  backgroundColor: { type: String, default: '' },
  showBackground: { type: Boolean, default: false },
  defaultColor: { type: String, default: DEFAULT_TEXT_COLOR },
  defaultBackgroundColor: { type: String, default: '#ffffff' },
});

const emit = defineEmits(['update:typography']);

const { t } = useI18n();
const ui = useBuilderUi();

const fontSizeSelectOptions = computed(() =>
  FONT_SIZE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
);
const lineHeightSelectOptions = computed(() =>
  LINE_HEIGHT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
);
const resolvedColor = computed(() => props.textColor || props.defaultColor);
const resolvedBackgroundColor = computed(() => props.backgroundColor || props.defaultBackgroundColor);
</script>
