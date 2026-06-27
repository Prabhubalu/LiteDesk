<template>
  <section class="space-y-4">
    <div>
      <h3 class="text-sm font-semibold" :class="ui.text">{{ t('templates.builderFieldMargin') }}</h3>
      <p class="mt-1 text-xs leading-relaxed" :class="ui.textMuted">
        {{ t('templates.builderPrintMarginHint') }}
      </p>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginTop') }}</label>
        <input
          :value="margins.top"
          type="number"
          min="0"
          max="100"
          step="1"
          :class="ui.input"
          @change="emitMargin('top', $event.target.value)"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginRight') }}</label>
        <input
          :value="margins.right"
          type="number"
          min="0"
          max="100"
          step="1"
          :class="ui.input"
          @change="emitMargin('right', $event.target.value)"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginBottom') }}</label>
        <input
          :value="margins.bottom"
          type="number"
          min="0"
          max="100"
          step="1"
          :class="ui.input"
          @change="emitMargin('bottom', $event.target.value)"
        />
      </div>
      <div>
        <label class="mb-1 block" :class="ui.label">{{ t('templates.builderFieldMarginLeft') }}</label>
        <input
          :value="margins.left"
          type="number"
          min="0"
          max="100"
          step="1"
          :class="ui.input"
          @change="emitMargin('left', $event.target.value)"
        />
      </div>
    </div>
    <p class="text-meta" :class="ui.textMuted">mm</p>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';
import { DEFAULT_PAGE_MARGINS_MM } from '@/constants/contentPageSettings';

const props = defineProps({
  margins: {
    type: Object,
    default: () => ({ ...DEFAULT_PAGE_MARGINS_MM })
  }
});

const emit = defineEmits(['change']);

const { t } = useI18n();
const ui = useBuilderUi();

function clampMargin(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function emitMargin(side, rawValue) {
  const next = clampMargin(rawValue);
  if (next == null) return;
  emit('change', {
    ...props.margins,
    [side]: next
  });
}
</script>
