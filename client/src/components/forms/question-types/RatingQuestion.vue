<template>
  <div class="flex gap-2">
    <button
      v-for="rating in 5"
      :key="rating"
      type="button"
      @click="$emit('update', rating)"
      :class="[
        'w-10 h-10 rounded-lg border-2 transition-colors font-medium',
        value >= rating
          ? 'bg-brand-600 border-brand-600 text-white'
          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
      ]"
    >
      {{ rating }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  question: {
    type: Object,
    required: true
  },
  value: {
    type: Number,
    default: null
  }
});

defineEmits(['update']);
</script>

