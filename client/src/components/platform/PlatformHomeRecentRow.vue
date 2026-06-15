<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
    @click="$emit('select', item)"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
    >
      <component :is="iconComponent" class="h-4 w-4" />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm font-medium text-neutral-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
        {{ item.title }}
      </span>
      <span class="mt-0.5 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
        <span>{{ item.sourceApp }}</span>
        <span v-if="relativeTime" aria-hidden="true">·</span>
        <span v-if="relativeTime">{{ relativeTime }}</span>
      </span>
    </span>
    <ArrowRightIcon class="h-4 w-4 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-neutral-600" />
  </button>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowRightIcon } from '@heroicons/vue/24/outline';
import { getNavigationIconComponent } from '@/utils/navigationIcons';
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
  getNavigationIconComponent({
    moduleKey: props.item.moduleKey,
    route: props.item.route
  })
);

const relativeTime = computed(() =>
  props.item.updatedAt ? formatRelativeTime(props.item.updatedAt, t) : ''
);
</script>
