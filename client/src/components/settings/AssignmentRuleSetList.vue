<template>
  <div class="space-y-5">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesStatTotalSets') }}</p>
        <p class="mt-1 text-3xl font-bold text-gray-900 dark:text-white">{{ stats.total }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesStatActiveSets') }}</p>
        <p class="mt-1 text-3xl font-bold text-emerald-600 dark:text-emerald-400">{{ stats.active }}</p>
      </div>
      <div class="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-700 dark:bg-gray-800">
        <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesStatTotalRules') }}</p>
        <p class="mt-1 text-3xl font-bold text-indigo-600 dark:text-indigo-400">{{ stats.rules }}</p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative w-52 shrink-0 sm:w-64">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('settings.assignRulesListSearchPh')"
          class="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        />
      </div>

      <div class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <select
          v-model="statusFilter"
          class="shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        >
          <option value="all">{{ t('settings.slaPolicyFilterAll') }}</option>
          <option value="active">{{ t('settings.slaPolicyFilterActive') }}</option>
          <option value="inactive">{{ t('settings.slaPolicyFilterInactive') }}</option>
        </select>

        <div class="relative flex h-[34px] shrink-0 items-stretch rounded-lg border border-gray-200/80 bg-gray-100 p-[0.1rem] shadow-inner dark:border-gray-600 dark:bg-gray-700/90">
          <button
            type="button"
            class="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
            :class="viewMode === 'card' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
            @click="viewMode = 'card'"
          >
            <Squares2X2Icon class="h-4 w-4 shrink-0" />
            {{ t('settings.slaPolicyViewCards') }}
          </button>
          <button
            type="button"
            class="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-0 text-xs font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 sm:text-sm"
            :class="viewMode === 'table' ? 'bg-white text-indigo-600 dark:bg-gray-800 dark:text-indigo-400' : 'text-gray-600 hover:bg-gray-200/50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-600/50 dark:hover:text-gray-200'"
            @click="viewMode = 'table'"
          >
            <TableCellsIcon class="h-4 w-4 shrink-0" />
            {{ t('settings.slaPolicyViewTable') }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
    </div>

    <div
      v-else-if="filteredRuleSets.length === 0"
      class="rounded-2xl border border-dashed border-gray-300 px-6 py-14 text-center dark:border-gray-600"
    >
      <UserGroupIcon class="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
      <p class="mt-3 text-sm font-medium text-gray-900 dark:text-white">{{ t('settings.assignRulesEmptyListTitle') }}</p>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.assignRulesEmptyListHint') }}</p>
      <button
        type="button"
        class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        @click="$emit('create')"
      >
        <PlusIcon class="h-4 w-4" />
        {{ t('settings.assignRulesNewRuleSet') }}
      </button>
    </div>

    <div v-else-if="viewMode === 'card'" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="set in filteredRuleSets"
        :key="`${set.appKey}:${set.moduleKey}`"
        role="button"
        tabindex="0"
        class="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800"
        :class="{ 'opacity-60': !set.enabled }"
        @click="openRuleSet(set)"
        @keydown.enter.prevent="openRuleSet(set)"
        @keydown.space.prevent="openRuleSet(set)"
      >
        <div class="absolute right-4 top-4 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
            @click.stop="openRuleSet(set)"
          >
            {{ t('actions.edit') }}
          </button>
        </div>

        <div class="p-5 pb-4">
          <div class="mb-3 flex items-start gap-3 pr-16">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" :class="set.iconBg">
              <UserGroupIcon class="h-5 w-5" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h4 class="font-semibold text-gray-900 dark:text-white">{{ set.title }}</h4>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  :class="set.enabled
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
                >
                  {{ set.enabled ? t('settings.assignRulesEnabled') : t('settings.assignRulesOff') }}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ set.scopeKey }}</p>
            </div>
          </div>

          <div class="space-y-2.5 border-t border-gray-100 pt-4 dark:border-gray-700/60">
            <div class="flex items-center gap-2.5 text-sm">
              <TagIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ set.appLabel }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <CubeIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ set.moduleLabel }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <AdjustmentsHorizontalIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesRuleCount', { count: set.ruleCount }) }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-sm">
              <ArrowPathIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ set.strategyLabel }}</span>
            </div>
            <div v-if="set.updatedLabel" class="flex items-center gap-2.5 text-sm">
              <ClockIcon class="h-4 w-4 shrink-0 text-gray-400" />
              <span class="text-gray-700 dark:text-gray-300">{{ set.updatedLabel }}</span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900/50">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesListColScope') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesLabelApplication') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesLabelModule') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesListColRules') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.assignRulesListColStrategy') }}</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{{ t('settings.slaPolicyColStatus') }}</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-800">
          <tr
            v-for="set in filteredRuleSets"
            :key="`${set.appKey}:${set.moduleKey}`"
            role="button"
            tabindex="0"
            class="group cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50 dark:hover:bg-gray-900/40 dark:focus-visible:bg-gray-900/40"
            :class="{ 'opacity-60': !set.enabled }"
            @click="openRuleSet(set)"
            @keydown.enter.prevent="openRuleSet(set)"
            @keydown.space.prevent="openRuleSet(set)"
          >
            <td class="px-4 py-3">
              <p class="text-sm font-medium text-gray-900 dark:text-white">{{ set.title }}</p>
              <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ set.scopeKey }}</p>
            </td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ set.appLabel }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ set.moduleLabel }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ set.ruleCount }}</td>
            <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{{ set.strategyLabel }}</td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="set.enabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'"
              >
                {{ set.enabled ? t('settings.assignRulesEnabled') : t('settings.assignRulesOff') }}
              </span>
            </td>
            <td class="px-4 py-3 text-right">
              <button
                type="button"
                class="rounded-lg px-2.5 py-1.5 text-sm font-medium text-indigo-600 opacity-0 transition-opacity hover:bg-indigo-50 group-hover:opacity-100 focus-within:opacity-100 dark:text-indigo-400 dark:hover:bg-indigo-950/40"
                @click.stop="openRuleSet(set)"
              >
                {{ t('actions.edit') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AdjustmentsHorizontalIcon,
  ArrowPathIcon,
  ClockIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TableCellsIcon,
  TagIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline';
import { resolveModuleLabel } from '@/constants/assignmentRules';
import { formatDate } from '@/utils/localeFormat';

const props = defineProps({
  ruleSets: { type: Array, default: () => [] },
  modules: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false }
});

const emit = defineEmits(['create', 'edit']);

const { t } = useI18n();

const searchQuery = ref('');
const statusFilter = ref('all');
const viewMode = ref('card');

const MODULE_LABEL_KEYS = {
  cases: 'settings.assignRulesModCases',
  people: 'settings.assignRulesModPeople',
  organizations: 'settings.assignRulesModOrganizations',
  deals: 'settings.assignRulesModDeals',
  tasks: 'settings.assignRulesModTasks',
  events: 'settings.assignRulesModEvents',
  items: 'settings.assignRulesModItems',
  forms: 'settings.assignRulesModForms',
  live_chat_sessions: 'settings.assignRulesModLiveChatSessions'
};

const CARD_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-cyan-600'
];

const STRATEGY_LABEL_KEYS = {
  new_records_only: 'settings.assignRulesStrategyNewOnly',
  manual_re_evaluation: 'settings.assignRulesStrategyManual',
  freeze_mode: 'settings.assignRulesStrategyFreeze'
};

function openRuleSet(set) {
  emit('edit', { appKey: set.appKey, moduleKey: set.moduleKey });
}

function appLabel(appKey) {
  const key = String(appKey || '').toUpperCase();
  if (key === 'HELPDESK') return t('settings.assignRulesAppHelpdesk');
  if (key === 'SALES') return t('settings.assignRulesAppSales');
  return key;
}

function moduleLabelForSet(set) {
  const mod = props.modules.find(
    (row) => row.moduleKey === set.moduleKey && String(row.appKey || '').toUpperCase() === String(set.appKey || '').toUpperCase()
  );
  return resolveModuleLabel(mod || { moduleKey: set.moduleKey }, t, MODULE_LABEL_KEYS);
}

function strategyLabel(applyStrategy) {
  const key = STRATEGY_LABEL_KEYS[String(applyStrategy || 'new_records_only')];
  return key ? t(key) : String(applyStrategy || '');
}

function formatUpdatedAt(value) {
  if (!value) return '';
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

const displayRuleSets = computed(() => {
  return (props.ruleSets || []).map((set, index) => {
    const app = appLabel(set.appKey);
    const mod = moduleLabelForSet(set);
    return {
      appKey: set.appKey,
      moduleKey: set.moduleKey,
      enabled: set.enabled !== false,
      ruleCount: Number(set.ruleCount) || 0,
      applyStrategy: set.applyStrategy || 'new_records_only',
      title: `${app} · ${mod}`,
      scopeKey: `${String(set.appKey || '').toUpperCase()}:${String(set.moduleKey || '').toLowerCase()}`,
      appLabel: app,
      moduleLabel: mod,
      strategyLabel: strategyLabel(set.applyStrategy),
      updatedLabel: formatUpdatedAt(set.updatedAt),
      iconBg: CARD_COLORS[index % CARD_COLORS.length],
      searchText: `${app} ${mod} ${set.appKey || ''} ${set.moduleKey || ''}`.toLowerCase()
    };
  });
});

const stats = computed(() => {
  const all = displayRuleSets.value;
  return {
    total: all.length,
    active: all.filter((row) => row.enabled).length,
    rules: all.reduce((sum, row) => sum + row.ruleCount, 0)
  };
});

const filteredRuleSets = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return displayRuleSets.value.filter((set) => {
    if (statusFilter.value === 'active' && !set.enabled) return false;
    if (statusFilter.value === 'inactive' && set.enabled) return false;
    if (q && !set.searchText.includes(q)) return false;
    return true;
  });
});
</script>
