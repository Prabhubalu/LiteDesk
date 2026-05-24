<template>
  <div
    v-if="peopleContext === 'ALL' && getPeopleParticipationEntries(row).length"
    class="flex flex-wrap items-center gap-x-2 gap-y-1.5"
  >
    <template v-for="e in getPeopleParticipationEntries(row)" :key="e.appKey">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        :class="appBadgeClass(e.appLabel)"
      >
        {{ e.appLabel }}
      </span>
      <BadgeCell
        :value="e.role"
        :options="badgeOptionsForApp(e.appKey)"
        :variant-map="roleBadgeVariantMap"
      />
    </template>
  </div>
  <div v-else-if="peopleContext !== 'ALL' && singleContextDisplay" class="flex flex-wrap items-center gap-1.5">
    <BadgeCell
      :value="singleContextDisplay.role ?? '-'"
      :options="badgeOptionsForApp(peopleContext)"
      :variant-map="roleBadgeVariantMap"
    />
  </div>
  <span v-else class="text-xs text-gray-400 dark:text-gray-500">-</span>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import { getRoleDisplay } from '@/utils/getRoleDisplay';
import {
  getPeopleParticipationEntries,
  isPeopleListAppContext,
} from '@/utils/peopleParticipationUi';

const props = defineProps({
  row: { type: Object, required: true },
  peopleContext: { type: String, required: true },
  /** { SALES: BadgeOption[], HELPDESK: BadgeOption[] } */
  badgeOptionsByApp: { type: Object, default: () => ({}) },
  roleBadgeVariantMap: { type: Object, required: true },
});

const { t } = useI18n();

function badgeOptionsForApp(appKey) {
  return props.badgeOptionsByApp[appKey] || [];
}

const singleContextDisplay = computed(() => {
  const ctx = props.peopleContext;
  if (ctx === 'ALL' || !isPeopleListAppContext(ctx)) return null;
  return getRoleDisplay(props.row, ctx);
});

function appBadgeClass(app) {
  const classMap = {
    Sales: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    Helpdesk: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    Audit: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200',
    Portal: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
    Projects: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  };
  return classMap[app] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-200';
}
</script>
