<template>
  <span
    v-if="summary"
    :class="badgeClass"
    :title="tooltip"
    :aria-label="ariaLabel"
  >
    <ClipboardDocumentListIcon v-if="showIcon" :class="iconClass" aria-hidden="true" />
    <span>{{ label }}</span>
  </span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline';
import { getDealPlaybookStatusSummary } from '@/utils/dealPlaybookStatus';

const props = defineProps({
  playbookState: {
    type: Object,
    default: null
  },
  size: {
    type: String,
    default: 'sm',
    validator: (value) => ['sm', 'md'].includes(value)
  },
  showIcon: {
    type: Boolean,
    default: true
  }
});

const { t } = useI18n();

const summary = computed(() => getDealPlaybookStatusSummary(props.playbookState));

const label = computed(() => {
  if (!summary.value) return '';
  if (summary.value.variant === 'complete') {
    return t('deals.dealsPlaybookBadgeComplete');
  }
  if (summary.value.variant === 'blocked') {
    return t('deals.dealsPlaybookBadgeBlocked', {
      completed: summary.value.completed,
      total: summary.value.total
    });
  }
  return t('deals.dealsPlaybookBadgeProgress', {
    completed: summary.value.completed,
    total: summary.value.total
  });
});

const tooltip = computed(() => {
  if (!summary.value) return '';
  if (summary.value.variant === 'complete') {
    return t('deals.dealsPlaybookBadgeTooltipComplete');
  }
  if (summary.value.blocked > 0) {
    return t('deals.dealsPlaybookBadgeTooltipBlocked', {
      pending: summary.value.pending,
      blocked: summary.value.blocked,
      total: summary.value.total
    });
  }
  return t('deals.dealsPlaybookBadgeTooltipProgress', {
    pending: summary.value.pending,
    total: summary.value.total
  });
});

const ariaLabel = computed(() => (
  summary.value
    ? t('deals.dealsPlaybookBadgeAria', { label: label.value })
    : ''
));

const badgeClass = computed(() => {
  const base = props.size === 'md'
    ? 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold'
    : 'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none';

  if (summary.value?.variant === 'complete') {
    return `${base} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200`;
  }
  if (summary.value?.variant === 'blocked') {
    return `${base} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
  }
  return `${base} bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200`;
});

const iconClass = computed(() => (
  props.size === 'md' ? 'h-3.5 w-3.5 shrink-0' : 'h-3 w-3 shrink-0'
));
</script>
