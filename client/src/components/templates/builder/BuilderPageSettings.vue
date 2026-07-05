<template>
  <div v-if="layout === 'stacked'" class="space-y-3">
    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageSize') }}</label>
      <BuilderSelect
        :model-value="paperSize"
        :option-groups="paperSizeOptionGroups"
        :options-attrs="{ 'data-arivu-page-size-select': 'true' }"
        @update:model-value="onPaperSizeChange"
      />
    </div>

    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageOrientation') }}</label>
      <BuilderSelect
        :model-value="orientation"
        :options="orientationOptions"
        :options-attrs="{ 'data-arivu-page-orientation-select': 'true' }"
        @update:model-value="onOrientationChange"
      />
    </div>

    <template v-if="paperSize === 'Custom'">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageWidth') }}</label>
          <input
            type="number"
            min="50"
            max="2000"
            step="1"
            :value="customPageWidth"
            :class="ui.input"
            @change="onCustomDimensionChange('customPageWidth', $event.target.value)"
          />
        </div>
        <div>
          <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageHeight') }}</label>
          <input
            type="number"
            min="50"
            max="2000"
            step="1"
            :value="customPageHeight"
            :class="ui.input"
            @change="onCustomDimensionChange('customPageHeight', $event.target.value)"
          />
        </div>
      </div>
      <p class="text-meta" :class="ui.textMuted">mm</p>
    </template>

    <p v-else class="text-meta" :class="ui.textMuted">{{ dimensionsLabel }}</p>
  </div>

  <div v-else class="flex flex-wrap items-center gap-2">
    <label class="flex items-center gap-1.5">
      <span class="hidden text-meta uppercase tracking-wide lg:inline" :class="ui.textMuted">
        {{ t('templates.builderPageSize') }}
      </span>
      <BuilderSelect
        :model-value="paperSize"
        :option-groups="paperSizeOptionGroups"
        :button-class="[ui.input, 'w-auto min-w-[5.5rem] py-1.5 text-xs']"
        :options-attrs="{ 'data-arivu-page-size-select': 'true' }"
        @update:model-value="onPaperSizeChange"
      />
    </label>

    <label class="flex items-center gap-1.5">
      <span class="hidden text-meta uppercase tracking-wide lg:inline" :class="ui.textMuted">
        {{ t('templates.builderPageOrientation') }}
      </span>
      <BuilderSelect
        :model-value="orientation"
        :options="orientationOptions"
        :button-class="[ui.input, 'w-auto min-w-[6.5rem] py-1.5 text-xs']"
        :options-attrs="{ 'data-arivu-page-orientation-select': 'true' }"
        @update:model-value="onOrientationChange"
      />
    </label>

    <template v-if="paperSize === 'Custom'">
      <label class="flex items-center gap-1">
        <span class="text-meta" :class="ui.textMuted">{{ t('templates.builderPageWidth') }}</span>
        <input
          type="number"
          min="50"
          max="2000"
          step="1"
          :value="customPageWidth"
          :class="[ui.input, 'w-16 py-1.5 text-xs']"
          @change="onCustomDimensionChange('customPageWidth', $event.target.value)"
        />
      </label>
      <label class="flex items-center gap-1">
        <span class="text-meta" :class="ui.textMuted">{{ t('templates.builderPageHeight') }}</span>
        <input
          type="number"
          min="50"
          max="2000"
          step="1"
          :value="customPageHeight"
          :class="[ui.input, 'w-16 py-1.5 text-xs']"
          @change="onCustomDimensionChange('customPageHeight', $event.target.value)"
        />
      </label>
      <span class="text-meta" :class="ui.textMuted">mm</span>
    </template>

    <span v-else class="hidden text-meta xl:inline" :class="ui.textMuted">
      {{ dimensionsLabel }}
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  DEFAULT_CUSTOM_PAGE_HEIGHT_MM,
  DEFAULT_CUSTOM_PAGE_WIDTH_MM,
  PAPER_SIZE_GROUPS,
  resolvePageDimensionsMm
} from '@/constants/contentPageSettings';
import { useBuilderUi } from '@/composables/useBuilderUi';
import BuilderSelect from '@/modules/template/components/BuilderSelect.vue';

const props = defineProps({
  layout: { type: String, default: 'inline' },
  paperSize: { type: String, default: 'A4' },
  orientation: { type: String, default: 'portrait' },
  customPageWidth: { type: Number, default: DEFAULT_CUSTOM_PAGE_WIDTH_MM },
  customPageHeight: { type: Number, default: DEFAULT_CUSTOM_PAGE_HEIGHT_MM }
});

const emit = defineEmits(['change']);

const { t } = useI18n();
const ui = useBuilderUi();

const paperSizeOptionGroups = computed(() =>
  PAPER_SIZE_GROUPS.map((group) => ({
    label: t(`templates.builderPageGroup${group.key}`),
    options: group.sizes.map((size) => ({
      value: size,
      label: size === 'Custom' ? t('templates.builderPageCustom') : size
    }))
  }))
);

const orientationOptions = computed(() => [
  { value: 'portrait', label: t('templates.builderPageOrientationPortrait') },
  { value: 'landscape', label: t('templates.builderPageOrientationLandscape') }
]);

const dimensionsLabel = computed(() => {
  const dimensions = resolvePageDimensionsMm(
    props.paperSize,
    props.orientation === 'landscape' ? 'landscape' : 'portrait',
    {
      customPageWidth: props.customPageWidth,
      customPageHeight: props.customPageHeight
    }
  );
  return `${dimensions.width} × ${dimensions.height} mm`;
});

function emitChange(patch) {
  emit('change', patch);
}

function onPaperSizeChange(nextSize) {
  const patch = { paperSize: nextSize };
  if (nextSize === 'Custom') {
    patch.customPageWidth = props.customPageWidth || DEFAULT_CUSTOM_PAGE_WIDTH_MM;
    patch.customPageHeight = props.customPageHeight || DEFAULT_CUSTOM_PAGE_HEIGHT_MM;
  }
  emitChange(patch);
}

function onOrientationChange(nextOrientation) {
  emitChange({ orientation: nextOrientation });
}

function onCustomDimensionChange(field, rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return;
  emitChange({ [field]: parsed });
}
</script>
