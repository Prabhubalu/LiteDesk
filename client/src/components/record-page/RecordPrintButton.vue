<template>
  <button
    v-if="canPrint"
    type="button"
    :class="buttonClass"
    :aria-label="t('actions.print')"
    :title="t('actions.print')"
    @click="showDrawer = true"
  >
    <PrinterIcon :class="iconClass" />
  </button>
  <RecordPrintDrawer
    :is-open="showDrawer"
    :module-key="moduleKey"
    :record-id="recordId"
    @close="showDrawer = false"
  />
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { PrinterIcon } from '@heroicons/vue/24/outline';
import { useAuthStore } from '@/stores/authRegistry';
import RecordPrintDrawer from './RecordPrintDrawer.vue';

const props = defineProps({
  moduleKey: { type: String, required: true },
  recordId: { type: String, required: true },
  /** `default` matches Generic/Deal/Task header icons; `compact` matches CaseRecordHeader. */
  variant: {
    type: String,
    default: 'default',
    validator: (v) => ['default', 'compact'].includes(v)
  }
});

const { t } = useI18n();
const authStore = useAuthStore();
const showDrawer = ref(false);

const canPrint = computed(() => {
  if (!props.moduleKey || !props.recordId) return false;
  return authStore.can('templates', 'view') && authStore.can('templates', 'render');
});

const buttonClass = computed(() => {
  if (props.variant === 'compact') {
    return 'inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100';
  }
  return 'p-1.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700';
});

const iconClass = computed(() => (props.variant === 'compact' ? 'h-4 w-4' : 'w-5 h-5'));
</script>
