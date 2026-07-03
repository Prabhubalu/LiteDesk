<template>
  <button
    type="button"
    class="rounded p-1 text-neutral-400 hover:text-amber-500"
    :aria-label="active ? t('analytics.favoriteRemove') : t('analytics.favoriteAdd')"
    @click.stop="$emit('toggle')"
  >
    <span v-if="active" aria-hidden="true">★</span>
    <span v-else aria-hidden="true">☆</span>
  </button>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  active: boolean;
}>();

defineEmits<{
  (e: 'toggle'): void;
}>();

const { t } = useI18n();
</script>
