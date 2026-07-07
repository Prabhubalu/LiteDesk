<template>
  <div v-if="compact" class="grid grid-cols-3 gap-2">
    <div v-for="field in fields" :key="field.key">
      <label class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">{{ field.label }}</label>
      <div class="flex items-center gap-1">
        <input
          type="number"
          :min="0"
          :max="max"
          :value="values[field.key] ?? 0"
          :class="[ui.input, 'h-7 w-full px-2 text-center text-xs']"
          @change="updateField(field.key, clamp(Number($event.target.value)))"
        />
        <span class="text-[10px] text-neutral-400">px</span>
      </div>
    </div>
  </div>
  <div v-else class="space-y-3">
    <div
      v-for="field in fields"
      :key="field.key"
      class="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2"
    >
      <label class="text-sm text-neutral-700 dark:text-neutral-300">{{ field.label }}</label>
      <input
        type="range"
        :min="0"
        :max="max"
        :step="1"
        :value="values[field.key] ?? 0"
        :class="ui.rangeTrack"
        @input="updateField(field.key, Number($event.target.value))"
      />
      <div class="flex items-center gap-1">
        <input
          type="number"
          :min="0"
          :max="max"
          :value="values[field.key] ?? 0"
          :class="[ui.input, 'h-8 px-2 py-1 text-center text-sm']"
          @change="updateField(field.key, clamp(Number($event.target.value)))"
        />
        <span class="text-xs text-neutral-500">px</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  marginTop: { type: Number, default: 0 },
  marginBottom: { type: Number, default: 0 },
  padding: { type: Number, default: 0 },
  max: { type: Number, default: 96 },
  showPadding: { type: Boolean, default: true },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits(['update:spacing']);

const { t } = useI18n();
const ui = useBuilderUi();

const fields = computed(() => {
  const rows = [
    { key: 'marginTop', label: t('contentStudio.fieldMarginTop') },
    { key: 'marginBottom', label: t('contentStudio.fieldMarginBottom') },
  ];
  if (props.showPadding) {
    rows.push({ key: 'padding', label: t('contentStudio.fieldPadding') });
  }
  return rows;
});

const values = computed(() => ({
  marginTop: props.marginTop ?? 0,
  marginBottom: props.marginBottom ?? 0,
  padding: props.padding ?? 0,
}));

function clamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(props.max, Math.max(0, Math.round(value)));
}

function updateField(key, value) {
  const next = clamp(value);
  emit('update:spacing', { [key]: next === 0 ? null : next });
}
</script>
