<template>
  <span
    :class="['date-cell', { 'date-relative': isRelative }]"
    :title="tooltip"
  >
    {{ formattedDate }}
  </span>
</template>

<script setup>
/**
 * Locale-aware date cell for list views.
 * Relative format: scan-friendly age; title tooltip: absolute datetime.
 */
import { computed } from 'vue';
import { formatDate, formatRelativeTime } from '@/utils/localeFormat';

const props = defineProps({
  value: {
    type: [String, Date, Number],
    default: null
  },
  format: {
    type: String,
    default: 'short' // 'short', 'long', 'relative', 'custom'
  },
  customFormat: {
    type: String,
    default: ''
  },
  relative: {
    type: Boolean,
    default: false
  },
  /** Optional engagement label prepended to the absolute tooltip */
  contextLabel: {
    type: String,
    default: ''
  }
});

const isRelative = computed(() => props.relative || props.format === 'relative');

const formattedDate = computed(() => {
  if (!props.value) return '-';

  const date = new Date(props.value);
  if (Number.isNaN(date.getTime())) return '-';

  if (isRelative.value) {
    return formatRelativeTime(date) || '-';
  }

  switch (props.format) {
    case 'short':
      return formatDate(date, { dateStyle: 'medium' }) || '-';
    case 'long':
      return formatDate(date, { dateStyle: 'full' }) || '-';
    case 'custom':
      return props.customFormat || formatDate(date, { dateStyle: 'medium' }) || '-';
    default:
      return formatDate(date, { dateStyle: 'medium' }) || '-';
  }
});

const tooltip = computed(() => {
  if (!props.value) return '';
  const date = new Date(props.value);
  if (Number.isNaN(date.getTime())) return '';
  const absolute =
    formatDate(date, { dateStyle: 'full', timeStyle: 'short' }) || '';
  if (!absolute) return '';
  const label = typeof props.contextLabel === 'string' ? props.contextLabel.trim() : '';
  return label ? `${label} · ${absolute}` : absolute;
});
</script>

<style scoped>
.date-cell {
  color: #374151;
}

:global(.dark) .date-cell {
  color: #d1d5db;
}

.date-relative {
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

:global(.dark) .date-relative {
  color: #9ca3af;
}
</style>
