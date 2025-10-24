<template>
  <span :class="['badge', variantClass]">
    {{ value }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: {
    type: [String, Number],
    default: ''
  },
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'success', 'warning', 'danger', 'info', 'primary'].includes(value)
  },
  // Auto variant based on value
  variantMap: {
    type: Object,
    default: () => ({})
  }
});

const variantClass = computed(() => {
  // Check if there's a variant mapping
  if (props.variantMap[props.value]) {
    return `badge-${props.variantMap[props.value]}`;
  }
  return `badge-${props.variant}`;
});
</script>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-default {
  background-color: #f3f4f6;
  color: #1f2937;
}

:global(.dark) .badge-default {
  background-color: #374151;
  color: #d1d5db;
}

.badge-primary {
  background-color: #ede9fe;
  color: #3a1f8a;
}

:global(.dark) .badge-primary {
  background-color: rgba(46, 24, 114, 0.3);
  color: #c4b5fd;
}

.badge-success {
  background-color: #dcfce7;
  color: #166534;
}

:global(.dark) .badge-success {
  background-color: rgba(22, 101, 52, 0.3);
  color: #86efac;
}

.badge-warning {
  background-color: #fef3c7;
  color: #854d0e;
}

:global(.dark) .badge-warning {
  background-color: rgba(133, 77, 14, 0.3);
  color: #fde047;
}

.badge-danger {
  background-color: #fee2e2;
  color: #991b1b;
}

:global(.dark) .badge-danger {
  background-color: rgba(153, 27, 27, 0.3);
  color: #fca5a5;
}

.badge-info {
  background-color: #dbeafe;
  color: #1e40af;
}

:global(.dark) .badge-info {
  background-color: rgba(30, 64, 175, 0.3);
  color: #93c5fd;
}
</style>

