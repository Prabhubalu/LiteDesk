<template>
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-2">
      <label class="text-xs" :class="ui.textMuted">{{ label }}</label>
      <span class="text-xs tabular-nums text-neutral-700 dark:text-neutral-200">{{ displayValue }}</span>
    </div>
    <div class="flex items-center gap-2">
      <input
        type="range"
        :min="min"
        :max="max"
        :step="step"
        :value="numericValue"
        :class="ui.rangeTrack"
        @input="onRangeInput"
      />
      <input
        type="number"
        :min="min"
        :max="max"
        :step="step"
        :value="numericValue"
        :class="[ui.input, 'w-16 shrink-0 px-1.5 py-1 text-center text-xs']"
        @change="onNumberChange"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useBuilderUi } from '@/composables/useBuilderUi';

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, default: '' },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 120 },
  step: { type: Number, default: 1 },
  unit: { type: String, default: 'px' }
});

const emit = defineEmits(['change']);

const ui = useBuilderUi();

const numericValue = computed(() => {
  const raw = String(props.value || '').trim().replace(/px$/i, '');
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
});

const displayValue = computed(() => `${numericValue.value} ${props.unit}`);

function emitValue(next) {
  const clamped = Math.min(props.max, Math.max(props.min, next));
  emit('change', clamped ? `${clamped}${props.unit}` : '');
}

function onRangeInput(event) {
  emitValue(Number(event.target.value));
}

function onNumberChange(event) {
  const parsed = Number.parseInt(String(event.target.value || ''), 10);
  emitValue(Number.isFinite(parsed) ? parsed : 0);
}
</script>
