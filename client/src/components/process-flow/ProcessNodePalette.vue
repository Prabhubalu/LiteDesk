<template>
  <div class="h-full flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
    <div class="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {{ t('process.paletteAddStep') }}
      </h3>
      <p v-if="blocked" class="text-[11px] text-indigo-700 dark:text-indigo-300 mt-2 leading-snug">
        {{ blockedReason || t('process.paletteBlockedDefault') }}
      </p>
    </div>
    <div class="flex-1 overflow-y-auto p-2 space-y-1">
      <button
        v-for="item in paletteItems"
        :key="item.type"
        type="button"
        :disabled="!editable || blocked"
        class="w-full text-left px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        @click="$emit('add', item.type)"
      >
        <div class="text-sm font-medium text-gray-900 dark:text-white">{{ item.label }}</div>
        <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{{ item.description }}</div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  metadata: { type: Object, default: null },
  editable: { type: Boolean, default: true },
  /** When true, steps are disabled until “Starts when” is configured */
  blocked: { type: Boolean, default: false },
  blockedReason: {
    type: String,
    default: ''
  }
});

defineEmits(['add']);

const defaultPalette = computed(() => [
  { type: 'condition', label: t('process.paletteTypeCondition'), description: t('process.paletteTypeConditionDesc') },
  { type: 'field_rule', label: t('process.paletteTypeFieldRule'), description: t('process.paletteTypeFieldRuleDesc') },
  { type: 'ownership_rule', label: t('process.paletteTypeOwnership'), description: t('process.paletteTypeOwnershipDesc') },
  { type: 'status_guard', label: t('process.paletteTypeStatusGuard'), description: t('process.paletteTypeStatusGuardDesc') },
  { type: 'approval_gate', label: t('process.paletteTypeApproval'), description: t('process.paletteTypeApprovalDesc') },
  { type: 'wait', label: t('process.paletteTypeWait'), description: t('process.paletteTypeWaitDesc') },
  { type: 'action', label: t('process.paletteTypeAction'), description: t('process.paletteTypeActionDesc') },
  { type: 'end', label: t('process.paletteTypeEnd'), description: t('process.paletteTypeEndDesc') }
]);

const paletteItems = computed(() => {
  const fromApi = props.metadata?.palette?.filter((p) => p.type !== 'trigger') || [];
  return fromApi.length ? fromApi : defaultPalette.value;
});
</script>
