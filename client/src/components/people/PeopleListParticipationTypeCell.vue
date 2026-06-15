<template>
  <div
    v-if="peopleContext === 'ALL' && entries.length"
    class="flex flex-nowrap items-center gap-1 min-w-0 overflow-hidden"
  >
    <span
      v-for="entry in visibleEntries"
      :key="entry.appKey"
      class="inline-flex min-w-0 max-w-full shrink items-center gap-1 overflow-hidden rounded px-2 py-0.5 text-xs leading-snug"
      :class="participationPillClass(entry.appKey)"
      :title="`${entry.appLabel} · ${entry.role}`"
    >
      <span class="truncate font-medium">{{ entry.appLabel }}</span>
      <span class="shrink-0 opacity-35 select-none" aria-hidden="true">·</span>
      <span class="truncate">{{ entry.role }}</span>
    </span>
    <HoverTooltip
      v-if="overflowCount > 0"
      :content="overflowTooltip"
      wrap
      align="start"
    >
      <span
        class="inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800 cursor-default"
      >
        {{ overflowLabel }}
      </span>
      <template #content>
        <div class="flex flex-col gap-1.5">
          <div
            v-for="entry in overflowEntries"
            :key="entry.appKey"
            class="flex items-center gap-1 text-xs leading-snug"
          >
            <span class="font-medium text-white">{{ entry.appLabel }}</span>
            <span class="opacity-40 select-none" aria-hidden="true">·</span>
            <span class="text-slate-200">{{ entry.role }}</span>
          </div>
        </div>
      </template>
    </HoverTooltip>
  </div>
  <div v-else-if="peopleContext !== 'ALL' && singleContextDisplay" class="min-w-0">
    <BadgeCell
      :value="singleContextDisplay.role ?? '-'"
      :options="badgeOptionsForApp(peopleContext)"
      :variant-map="roleBadgeVariantMap"
    />
  </div>
  <span v-else class="text-xs text-gray-400 dark:text-gray-500">-</span>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import HoverTooltip from '@/components/common/HoverTooltip.vue';
import { getRoleDisplay } from '@/utils/getRoleDisplay';
import {
  getPeopleParticipationEntries,
  isPeopleListAppContext,
  PEOPLE_PARTICIPATION_LIST_VISIBLE_MAX,
} from '@/utils/peopleParticipationUi';

const props = defineProps({
  row: { type: Object, required: true },
  peopleContext: { type: String, required: true },
  /** { SALES: BadgeOption[], HELPDESK: BadgeOption[] } */
  badgeOptionsByApp: { type: Object, default: () => ({}) },
  roleBadgeVariantMap: { type: Object, required: true },
});

const { t } = useI18n();

const entries = computed(() => getPeopleParticipationEntries(props.row));
const visibleEntries = computed(() =>
  entries.value.slice(0, PEOPLE_PARTICIPATION_LIST_VISIBLE_MAX)
);
const overflowEntries = computed(() =>
  entries.value.slice(PEOPLE_PARTICIPATION_LIST_VISIBLE_MAX)
);
const overflowCount = computed(() => overflowEntries.value.length);
const overflowTooltip = computed(() =>
  overflowEntries.value.map((entry) => `${entry.appLabel} · ${entry.role}`).join('\n')
);
const overflowLabel = computed(() =>
  t('people.listParticipationMore', { count: overflowCount.value })
);

function badgeOptionsForApp(appKey) {
  return props.badgeOptionsByApp[appKey] || [];
}

const PARTICIPATION_PILL_CLASSES = {
  SALES: 'bg-blue-100/70 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100',
  HELPDESK: 'bg-emerald-100/70 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100',
  AUDIT: 'bg-purple-100/70 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100',
  PORTAL: 'bg-orange-100/70 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100',
  PROJECTS: 'bg-indigo-100/70 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100',
};

function participationPillClass(appKey) {
  return (
    PARTICIPATION_PILL_CLASSES[String(appKey || '').toUpperCase()] ||
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
  );
}

const singleContextDisplay = computed(() => {
  const ctx = props.peopleContext;
  if (ctx === 'ALL' || !isPeopleListAppContext(ctx)) return null;
  return getRoleDisplay(props.row, ctx);
});
</script>
