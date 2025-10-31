<template>
  <span 
    :class="['badge', variantClass]" 
    :style="customColorStyle"
  >
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
  if (resolvedColor.value) {
    return {
      backgroundColor: resolvedColor.value,
      color: getContrastColor(resolvedColor.value)
    };
  }
  return {};
});

// Get contrast color (black or white) based on background brightness
function getContrastColor(hexColor) {
  if (!hexColor) return '#1f2937';
  
  // Remove # if present
  const hex = hexColor.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate brightness using relative luminance formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  
  // Return black for light colors, white for dark colors
  return brightness > 155 ? '#1f2937' : '#ffffff';
}

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

