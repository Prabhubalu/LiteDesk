<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
    @click="$emit('select', item)"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
      :class="iconWrapClass"
    >
      <component :is="iconComponent" class="h-4 w-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {{ item.title }}
      </span>
      <span
        v-if="metaLine"
        class="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400"
      >
        <span class="truncate">{{ metaLine }}</span>
        <span v-if="metaLine && relativeTime" aria-hidden="true">·</span>
        <span v-if="relativeTime" class="shrink-0">{{ relativeTime }}</span>
      </span>
    </span>
    <span
      v-if="item.kind === 'notification'"
      class="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500 dark:bg-primary-400"
      aria-hidden="true"
    />
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BellIcon, InboxIcon } from '@heroicons/vue/24/outline';
import { formatRelativeTime } from '@/utils/relativeTime';

const props = defineProps({
  item: {
    type: Object,
    required: true
  }
});

defineEmits(['select']);

const { t } = useI18n();

const iconComponent = computed(() =>
  props.item.kind === 'notification' ? BellIcon : InboxIcon
);

const iconWrapClass = computed(() =>
  props.item.kind === 'notification'
    ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300'
    : 'bg-secondary-50 text-secondary-700 dark:bg-secondary-900/40 dark:text-secondary-200'
);

const appLabel = computed(() => {
  const key = String(props.item.appKey || '').toUpperCase();
  const labels = {
    SALES: 'Sales',
    AUDIT: 'Audit',
    HELPDESK: 'Helpdesk',
    PORTAL: 'Portal',
    PROJECTS: 'Projects'
  };
  return labels[key] || null;
});

const metaLine = computed(() => {
  if (props.item.kind === 'notification') {
    return [appLabel.value, props.item.subtitle].filter(Boolean).join(' · ');
  }
  return [props.item.subtitle].filter(Boolean).join(' · ');
});

const relativeTime = computed(() =>
  props.item.updatedAt ? formatRelativeTime(props.item.updatedAt, t) : ''
);
</script>
