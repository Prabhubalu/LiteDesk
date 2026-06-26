<template>
  <div v-if="layout === 'stacked'" class="space-y-3">
    <div>
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageSize') }}</label>
      <select
        :value="paperSize"
        :class="ui.input"
        :aria-label="t('templates.builderPageSize')"
        @change="onPaperSizeChange($event.target.value)"
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
      <label class="mb-1 block" :class="ui.label">{{ t('templates.builderPageOrientation') }}</label>
      <select
        :value="orientation"
        :class="ui.input"
        :aria-label="t('templates.builderPageOrientation')"
        @change="emitChange({ orientation: $event.target.value })"
      >
        <option value="portrait">{{ t('templates.builderPageOrientationPortrait') }}</option>
        <option value="landscape">{{ t('templates.builderPageOrientationLandscape') }}</option>
      </select>
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
      <select
        :value="paperSize"
        :class="[ui.input, 'w-auto min-w-[5.5rem] py-1.5 text-xs']"
        :aria-label="t('templates.builderPageSize')"
        @change="onPaperSizeChange($event.target.value)"
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
    </label>

    <label class="flex items-center gap-1.5">
      <span class="hidden text-meta uppercase tracking-wide lg:inline" :class="ui.textMuted">
        {{ t('templates.builderPageOrientation') }}
      </span>
      <select
        :value="orientation"
        :class="[ui.input, 'w-auto min-w-[6.5rem] py-1.5 text-xs']"
        :aria-label="t('templates.builderPageOrientation')"
        @change="emitChange({ orientation: $event.target.value })"
      >
        <option value="portrait">{{ t('templates.builderPageOrientationPortrait') }}</option>
        <option value="landscape">{{ t('templates.builderPageOrientationLandscape') }}</option>
      </select>
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
const paperSizeGroups = PAPER_SIZE_GROUPS;

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

function onCustomDimensionChange(field, rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return;
  emitChange({ [field]: parsed });
}
</script>
