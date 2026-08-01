<template>
  <div
    v-if="entries.length && hasAppScopedEntries"
    class="flex flex-nowrap items-center gap-1 min-w-0 overflow-hidden"
  >
    <span
      v-for="entry in visibleEntries"
      :key="entry.appKey || entry.role"
      class="inline-flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs leading-snug"
      :class="pillClass(entry.appKey)"
      :title="entry.appLabel ? `${entry.appLabel} · ${entry.role}` : entry.role"
    >
      <template v-if="entry.appLabel">
        <span class="truncate font-medium">{{ entry.appLabel }}</span>
        <span class="shrink-0 opacity-35 select-none" aria-hidden="true">·</span>
      </template>
      <span class="truncate">{{ entry.role }}</span>
    </span>
    <HoverTooltip v-if="overflowCount > 0" :content="overflowTooltip" wrap align="start">
      <span
        class="inline-flex shrink-0 items-center rounded-md border border-gray-300/50 px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800 dark:border-gray-600/50 cursor-default"
      >
        {{ overflowLabel }}
      </span>
    </HoverTooltip>
  </div>
  <div v-else-if="entries.length" class="flex items-center gap-1 flex-wrap">
    <BadgeCell
      v-for="(entry, index) in visibleEntries"
      :key="`${entry.role}-${index}`"
      :value="entry.role"
      :options="badgeOptions"
    />
    <span
      v-if="overflowCount > 0"
      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
      :title="overflowEntries.map((e) => e.role).join(', ')"
    >
      +{{ overflowCount }}
    </span>
  </div>
  <span v-else class="text-gray-500 dark:text-gray-400">-</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import {
  getOrganizationParticipationEntries,
  ORGANIZATION_PARTICIPATION_LIST_VISIBLE_MAX,
} from '@/utils/organizationParticipationUi';

const props = defineProps({
  row: { type: Object, required: true },
  badgeOptions: { type: Array, default: () => [] },
});

const { t } = useI18n();

const entries = computed(() => getOrganizationParticipationEntries(props.row));
const hasAppScopedEntries = computed(() => entries.value.some((e) => e.appKey));
const visibleEntries = computed(() =>
  entries.value.slice(0, ORGANIZATION_PARTICIPATION_LIST_VISIBLE_MAX)
);
const overflowEntries = computed(() =>
  entries.value.slice(ORGANIZATION_PARTICIPATION_LIST_VISIBLE_MAX)
);
const overflowCount = computed(() => overflowEntries.value.length);
const overflowTooltip = computed(() =>
  overflowEntries.value
    .map((e) => (e.appLabel ? `${e.appLabel} · ${e.role}` : e.role))
    .join('\n')
);
const overflowLabel = computed(() =>
  t('organizations.listParticipationMore', { count: overflowCount.value })
);

function pillClass(appKey: string): string {
  const map: Record<string, string> = {
    SALES: 'border-indigo-200/80 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-200',
    HELPDESK: 'border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200',
    INVENTORY: 'border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200',
    MARKETING: 'border-fuchsia-200/80 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/40 dark:text-fuchsia-200',
    PORTAL: 'border-sky-200/80 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-200',
  };
  return (
    map[String(appKey || '').toUpperCase()] ||
    'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
  );
}
</script>
