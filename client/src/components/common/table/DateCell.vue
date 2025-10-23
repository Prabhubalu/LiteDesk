<template>
  <span :class="['date-cell', { 'date-relative': relative }]" :title="fullDate">
    {{ formattedDate }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

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
  }
});

const formattedDate = computed(() => {
  if (!props.value) return '-';
  
  const date = new Date(props.value);
  
  if (isNaN(date.getTime())) return '-';
  
  if (props.relative || props.format === 'relative') {
    return getRelativeTime(date);
  }
  
  switch (props.format) {
    case 'short':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    case 'custom':
      return props.customFormat || date.toLocaleDateString();
    default:
      return date.toLocaleDateString();
  }
});

const fullDate = computed(() => {
  if (!props.value) return '';
  const date = new Date(props.value);
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

const getRelativeTime = (date) => {
  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  
  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
};
</script>

<style scoped>
.date-cell {
  @apply text-gray-700 dark:text-gray-300;
}

.date-relative {
  @apply text-gray-500 dark:text-gray-400 text-xs;
}
</style>

