<template>
  <span 
    :class="['badge', variantClass]" 
    :style="customColorStyle"
  >
    {{ value }}
  </span>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { picklistChipStyle } from '@/utils/picklistColorPalette';

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
  },
  // Custom color from field options (for picklist/multi-picklist)
  color: {
    type: String,
    default: null
  },
  // Options array from field definition (to lookup color by value)
  options: {
    type: Array,
    default: () => []
  }
});

const { t } = useI18n();

// Look up color from options array if provided
const resolvedColor = computed(() => {
  // If color prop is directly provided, use it
  if (props.color) return props.color;
  
  // If options array is provided, look up the color for this value
  if (props.options && props.options.length > 0 && props.value) {
    const option = props.options.find(opt => {
      const optValue = typeof opt === 'string' ? opt : opt.value;
      return String(optValue) === String(props.value);
    });
    
    if (option && typeof option === 'object' && option.color) {
      return option.color;
    }
  }
  
  return null;
});

const customColorStyle = computed(() => {
  if (!resolvedColor.value) return {};
  return picklistChipStyle(resolvedColor.value);
});

const variantClass = computed(() => {
  // Only use variant class if no custom color is set
  if (resolvedColor.value) {
    return ''; // No variant class needed when using custom color
  }
  
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
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid transparent;
  box-sizing: border-box;
}

.badge-default {
  background-color: #f3f4f6;
  color: #1f2937;
  border-color: rgba(107, 114, 128, 0.28);
}

:global(.dark) .badge-default {
  background-color: #374151;
  color: #d1d5db;
  border-color: rgba(156, 163, 175, 0.28);
}

.badge-primary {
  background-color: #ede9fe;
  color: #3a1f8a;
  border-color: rgba(99, 102, 241, 0.28);
}

:global(.dark) .badge-primary {
  background-color: rgba(46, 24, 114, 0.3);
  color: #c4b5fd;
  border-color: rgba(167, 139, 250, 0.28);
}

.badge-success {
  background-color: #dcfce7;
  color: #166534;
  border-color: rgba(22, 163, 74, 0.28);
}

:global(.dark) .badge-success {
  background-color: rgba(22, 101, 52, 0.3);
  color: #86efac;
  border-color: rgba(134, 239, 172, 0.28);
}

.badge-warning {
  background-color: #fef3c7;
  color: #854d0e;
  border-color: rgba(217, 119, 6, 0.28);
}

:global(.dark) .badge-warning {
  background-color: rgba(133, 77, 14, 0.3);
  color: #fde047;
  border-color: rgba(253, 224, 71, 0.28);
}

.badge-danger {
  background-color: #fee2e2;
  color: #991b1b;
  border-color: rgba(220, 38, 38, 0.28);
}

:global(.dark) .badge-danger {
  background-color: rgba(153, 27, 27, 0.3);
  color: #fca5a5;
  border-color: rgba(252, 165, 165, 0.28);
}

.badge-info {
  background-color: #dbeafe;
  color: #1e40af;
  border-color: rgba(37, 99, 235, 0.28);
}

:global(.dark) .badge-info {
  background-color: rgba(30, 64, 175, 0.3);
  color: #93c5fd;
  border-color: rgba(147, 197, 253, 0.28);
}
</style>

