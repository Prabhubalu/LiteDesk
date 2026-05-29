<template>
  <div class="mx-auto w-full" :data-view="currentView">
    <!-- Error Message (plan limitation or load error) -->
    <div v-if="error && !loading" class="mb-6">
      <div :class="[
        'rounded-xl p-6 border',
        error.type === 'plan_limitation'
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      ]">
        <div class="flex items-start gap-3">
          <div :class="[
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
            error.type === 'plan_limitation'
              ? 'bg-yellow-100 dark:bg-yellow-900/40'
              : 'bg-red-100 dark:bg-red-900/40'
          ]">
            <svg v-if="error.type === 'plan_limitation'" class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 :class="[
              'text-lg font-semibold mb-1',
              error.type === 'plan_limitation'
                ? 'text-yellow-900 dark:text-yellow-200'
                : 'text-red-900 dark:text-red-200'
            ]">
              {{ error.type === 'plan_limitation' ? t('deals.dealsFeatureNotAvailable') : t('deals.dealsErrorLoading') }}
            </h3>
            <p :class="[
              'text-sm',
              error.type === 'plan_limitation'
                ? 'text-yellow-800 dark:text-yellow-300'
                : 'text-red-800 dark:text-red-300'
            ]">
              {{ error.message }}
            </p>
            <button
              v-if="error.type === 'plan_limitation'"
              @click="openTab('/settings?tab=billing')"
              class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>{{ t('deals.dealsUpgradePlan') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Registry-Driven ModuleList with Kanban/List View Switcher -->
    <ModuleList
      v-if="!error"
      ref="moduleListRef"
      module-key="deals"
      app-key="SALES"
      :view-mode="currentView"
      @create="openCreateModal"
      @import="showImportModal = true"
      @export="exportDeals"
      @row-click="handleRowClick"
      @delete="handleDelete"
      @bulk-action="handleBulkAction"
      @filters-changed="handleFiltersChanged"
      @search-changed="handleSearchChanged"
      @kanban-settings-changed="refreshKanbanSettings"
      @stats-visibility-changed="(val) => (statsOpen = val)"
    >
      <!-- Group by: Stage button (kanban view) – commented for now; may use in the future -->
      <!--
      <template #search-actions>
        <button
          v-if="currentView === 'kanban'"
          type="button"
          class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/80 dark:border-blue-800/80 text-sm font-medium transition-colors h-10"
        >
          <RectangleStackIcon class="w-4 h-4" />{{ t('deals.dealsGroupStage') }}</button>
      </template>
      -->

      <!-- Custom Header Slot - View Switcher + Actions -->
      <template #header-actions>
        <div class="flex gap-3 items-center">
          <!-- View Toggle - Segmented control with sliding pill (h-10 to match Hide/Import/Export/New Deal) -->
          <div class="relative flex h-10 items-stretch rounded-xl bg-gray-100 dark:bg-gray-700/90 p-[0.1rem] border border-gray-200/80 dark:border-gray-600 shadow-inner min-w-[200px]">
            <!-- <div
              class="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-200 ease-out pointer-events-none"
              :style="{ left: currentView === 'kanban' ? '4px' : 'calc(50% + 2px)' }"
            /> -->
            <button
              type="button"
              @click="switchView('kanban')"
              class="relative z-10 flex-1 flex items-center justify-center gap-2 pl-3 pr-3 py-0 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'kanban' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <ViewColumnsIcon class="w-5 h-5 shrink-0" />{{ t('settings.assignRulesCondFieldPipeline') }}</button>
            <button
              type="button"
              @click="switchView('list')"
              class="relative z-10 flex-1 flex items-center justify-center gap-2 pl-3 pr-3 py-0 rounded-lg text-sm font-semibold transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:ring-offset-gray-800 overflow-visible"
              :class="currentView === 'list' ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-600/50'"
            >
              <ListBulletIcon class="w-5 h-5 shrink-0" />{{ t('forms.rbLayoutList') }}</button>
          </div>
          <ModuleActions 
            module="deals"
            create-:label="t('deals.dealsNewDeal')"
            @create="openCreateModal"
            @import="showImportModal = true"
            @export="exportDeals"
          />
        </div>
      </template>

      <!-- Custom Deal Name Cell -->
      <template #cell-name="{ row }">
        <div class="flex items-center gap-3">
          <Avatar
            :record="{
              name: row.name,
              avatar: row.contactId?.avatar || row.avatar
            }"
            size="md"
          />
          <div class="min-w-0 flex-1">
            <span
              class="block min-w-0 font-semibold text-gray-900 dark:text-white truncate"
            >
              {{ row.name }}
            </span>
            <div
              v-if="row.account?.name"
              class="min-w-0 text-sm text-gray-500 dark:text-gray-400 truncate"
            >
              {{ row.account.name }}
            </div>
          </div>
        </div>
      </template>

      <!-- Custom Amount Cell -->
      <template #cell-amount="{ value, row }">
        <strong class="text-gray-900 dark:text-white">{{ formatCurrency(value, row?.currencyCode || row?.currency) }}</strong>
      </template>

      <!-- Custom Stage Cell -->
      <template #cell-stage="{ value }">
        <BadgeCell 
          v-if="value"
          :value="value" 
          :variant-map="{
            'Qualification': 'info',
            'Proposal': 'primary',
            'Negotiation': 'warning',
            'Contract Sent': 'info',
            'Closed Won': 'success',
            'Closed Lost': 'danger'
          }"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Contact Cell -->
      <template #cell-contactId="{ row }">
        <span v-if="row.contactId" class="text-sm text-gray-700 dark:text-gray-300">
          {{ row.contactId.first_name }} {{ row.contactId.last_name }}
        </span>
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Owner Cell -->
      <template #cell-ownerId="{ row }">
        <div v-if="row.ownerId" class="flex items-center gap-2">
          <Avatar
            :user="{
              firstName: row.ownerId?.firstName,
              lastName: row.ownerId?.lastName,
              avatar: row.ownerId?.avatar
            }"
            size="sm"
          />
          <span class="text-sm text-gray-700 dark:text-gray-300">
            {{ getUserDisplayName(row.ownerId) }}
          </span>
        </div>
        <span v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.editableUnassigned') }}</span>
      </template>

      <!-- Custom Close Date Cell -->
      <template #cell-expectedCloseDate="{ row }">
        <span :class="{'text-red-600 dark:text-red-400 font-medium': isOverdue(row.expectedCloseDate)}">
          {{ formatDate(row.expectedCloseDate) }}
        </span>
      </template>

      <!-- Custom Probability Cell -->
      <template #cell-probability="{ value }">
        <span v-if="value != null" class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ value }}%</span>
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>

      <!-- Custom Priority Cell -->
      <template #cell-priority="{ value }">
        <BadgeCell 
          v-if="value"
          :value="value" 
          :variant-map="{
            'Low': 'default',
            'Medium': 'info',
            'High': 'warning',
            'Urgent': 'danger'
          }"
        />
        <span v-else class="text-gray-500 dark:text-gray-400">-</span>
      </template>
    </ModuleList>

    <!-- Kanban View (shown when Pipeline tab is selected) -->
    <div
      v-if="currentView === 'kanban' && !error"
      class="kanban-view-container mt-4"
      style="min-height: 400px;"
    >
      <div v-if="pipelines.length > 1" class="flex items-center gap-2 mb-3">
        <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('settings.assignRulesCondFieldPipeline') }}</label>
        <select
          v-model="selectedPipelineKey"
          class="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[180px]"
          @change="onPipelineChange"
        >
          <option v-for="p in pipelines" :key="p.key" :value="p.key">
            {{ p.label }}{{ p.isDefault ? ` ${t('common.phraseDefaultInParens')}` : '' }}
          </option>
        </select>
      </div>
      <KanbanBoard
        :items="kanbanDeals"
        :stages="stages"
        stage-key="stage"
        item-id-key="_id"
        :loading="kanbanLoading"
        loading-:label="t('deals.dealsLoadingPipeline')"
        :get-column-stats="(s) => ({ value: getStageValue(s) })"
        :get-stage-color="getStageColor"
        :card-size="kanbanCardSize"
        :collapse-empty-columns="kanbanCollapseEmptyColumns"
        :stats-open="statsOpen"
        @update="handleKanbanUpdate"
        @card-click="({ item, event }) => viewDeal(item._id, event)"
      >
        <template #column-header="{ stage, count, stats, stageColor }">
          <div
            :class="[
              'flex items-center gap-2.5 px-3 py-1.5 rounded-full min-w-0 flex-1',
              stageColor ? 'bg-white/20 text-white' : 'bg-white/80 dark:bg-gray-600/80 text-gray-700 dark:text-gray-200'
            ]"
          >
            <span class="font-semibold text-sm truncate">{{ stage }}</span>
            <span
              :class="[
                'flex-shrink-0 text-xs font-bold tabular-nums',
                stageColor ? 'text-white/90' : 'text-gray-600 dark:text-gray-300'
              ]"
            >
              {{ count }}
            </span>
          </div>
          <span
            v-if="stats?.value != null"
            :class="[
              'text-xs font-semibold tabular-nums',
              stageColor ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
            ]"
          >
            {{ formatCurrency(stats.value) }}
          </span>
        </template>
        <template #card="{ item: deal }">
          <!-- Title (name) -->
          <div v-if="kanbanShownFieldKeys.includes('name') && (kanbanShowEmptyFields || (deal.name != null && deal.name !== ''))" class="mb-3">
            <h4 class="text-sm font-semibold text-gray-900 dark:text-white leading-tight line-clamp-2">{{ deal.name || '—' }}</h4>
          </div>
          <!-- Meta row: all other shown fields (amount, date, probability, etc.) in Customize Kanban order -->
          <div
            v-if="kanbanMetaFieldKeys.length"
            :class="[
              'text-xs text-gray-600 dark:text-gray-400',
              kanbanStackFields ? 'flex flex-col gap-1.5' : 'flex flex-wrap items-center gap-x-3 gap-y-2'
            ]"
          >
            <template v-for="key in kanbanMetaFieldKeys" :key="key">
              <template v-if="kanbanShowEmptyFields || !isDealFieldEmpty(deal, key)">
                <div v-if="key === 'amount'" class="flex items-center gap-1">
                  <BanknotesIcon class="w-3.5 h-3.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span class="font-semibold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(deal.amount, deal.currencyCode || deal.currency) }}</span>
                </div>
                <div
                  v-else-if="key === 'expectedCloseDate'"
                  class="flex items-center gap-1"
                  :class="isOverdue(deal.expectedCloseDate) ? 'text-red-600 dark:text-red-400 font-medium' : ''"
                >
                  <CalendarDaysIcon class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{{ formatDate(deal.expectedCloseDate) }}</span>
                </div>
                <div v-else-if="key === 'probability'" class="flex items-center gap-1">
                  <ChartBarIcon class="w-3.5 h-3.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span class="text-xs font-semibold text-blue-600 dark:text-blue-400">{{ deal.probability != null ? deal.probability + '%' : '—' }}</span>
                </div>
                <div
                  v-else-if="key === 'priority'"
                  class="flex items-center gap-1"
                  :class="[
                    deal.priority?.toLowerCase() === 'urgent' ? 'text-red-600 dark:text-red-400' :
                    deal.priority?.toLowerCase() === 'high' ? 'text-amber-600 dark:text-amber-400' :
                    'text-gray-500 dark:text-gray-400'
                  ]"
                >
                  <FlagIconSolid class="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{{ deal.priority || '—' }}</span>
                </div>
                <div v-else-if="key === 'accountId'" class="flex items-center gap-1 truncate">
                  <BuildingOfficeIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ deal.accountId?.name ?? deal.account?.name ?? '—' }}</span>
                </div>
                <div v-else-if="key === 'ownerId'" class="flex items-center gap-1.5 min-w-0">
                  <Avatar
                    :user="{
                      firstName: deal.ownerId?.firstName,
                      lastName: deal.ownerId?.lastName,
                      avatar: deal.ownerId?.avatar
                    }"
                    size="sm"
                  />
                  <span class="truncate text-xs">{{ getUserDisplayName(deal.ownerId) }}</span>
                </div>
                <div v-else-if="key === 'contactId'" class="flex items-center gap-1 truncate">
                  <UserIcon class="w-3.5 h-3.5 flex-shrink-0" />
                  <span class="truncate">{{ deal.contactId ? (deal.contactId.first_name + ' ' + deal.contactId.last_name).trim() : '—' }}</span>
                </div>
                <div v-else class="flex items-center gap-1 truncate">
                  <HashtagIcon class="w-3.5 h-3.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span class="truncate">{{ formatMetaValue(deal[key], key) }}</span>
                </div>
              </template>
            </template>
          </div>
        </template>
        <template #empty>
          <InboxIcon class="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
          <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('deals.dealsNoDealsInThisStage') }}</p>
        </template>
        <template #add-item="{ stage, isEmpty, stageColor }">
          <button
            type="button"
            class="kanban-add-btn cursor-pointer w-full flex items-center justify-left gap-2 text-sm font-normal transition-colors py-2 px-3 rounded-xl"
            @click.stop="openCreateDealInStage(stage)"
            :class="[
              isEmpty && 'border-gray-200 dark:border-gray-600',
              isEmpty && !stageColor && 'hover:bg-amber-50/80 dark:hover:bg-amber-900/20 hover:border-amber-200 dark:hover:border-amber-800',
              !stageColor && isEmpty && 'text-gray-500 dark:text-gray-400',
              !stageColor && !isEmpty && 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300'
            ]"
            :style="stageColor ? { color: stageColor, '--add-btn-hover-bg': hexToRgba(stageColor, 0.12) } : {}"
          >
            <PlusIcon class="w-4 h-4 flex-shrink-0" />{{ t('deals.dealsAddDeal') }}</button>
        </template>
      </KanbanBoard>
    </div>

    <!-- Create/Edit Drawer -->
    <CreateRecordDrawer 
      :isOpen="showFormModal"
      moduleKey="deals"
      :record="editingDeal"
      :initial-data="createInitialData"
      @close="closeFormModal"
      @saved="handleDealSaved"
    />

    <!-- CSV Import Modal -->
    <CSVImportModal
      v-if="showImportModal"
      entity-type="Deals"
      @close="showImportModal = false"
      @import-complete="handleImportComplete"
    />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted, onUnmounted, onActivated, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';
import { useTabs } from '@/composables/useTabs';
import apiClient from '@/utils/apiClient';
import ModuleList from '@/components/module-list/ModuleList.vue';
import ModuleActions from '@/components/common/ModuleActions.vue';
import BadgeCell from '@/components/common/table/BadgeCell.vue';
import Avatar from '@/components/common/Avatar.vue';
import CreateRecordDrawer from '@/components/common/CreateRecordDrawer.vue';
import CSVImportModal from '@/components/import/CSVImportModal.vue';
import KanbanBoard from '@/components/common/KanbanBoard.vue';
import { getModuleListConfig } from '@/platform/modules/moduleListRegistry';
import { DEFAULT_CURRENCY_CODE, formatCurrencyValue } from '@/utils/currencyOptions';
import { ViewColumnsIcon, ListBulletIcon, UserIcon, CalendarDaysIcon, InboxIcon, RectangleStackIcon, PlusIcon, BuildingOfficeIcon, ChartBarIcon, BanknotesIcon, HashtagIcon } from '@heroicons/vue/24/outline';
import { FlagIcon as FlagIconSolid } from '@heroicons/vue/24/solid';

const router = useRouter();
const route = useRoute();
const moduleListRef = ref(null);
const { openTab } = useTabs();
const authStore = useAuthStore();

// View state (module-specific URL param so Tasks and Deals don't affect each other)
const viewStorageKey = 'arivu-deals-view';
const VIEW_QUERY_KEY = 'dealsView';
const getInitialView = () => {
  try {
    const savedView = localStorage.getItem(viewStorageKey);
    return savedView === 'list' ? 'list' : 'kanban';
  } catch {
    return 'kanban';
  }
};
const currentView = ref(getInitialView());

// Kanban data state
const kanbanDeals = ref([]);
const kanbanLoading = ref(false);

// Error state (plan limitation or load error)
const error = ref(null);
const loading = ref(false);

// Modals
const showFormModal = ref(false);
const showImportModal = ref(false);
const editingDeal = ref(null);

// Stages come only from Settings → Deals → Pipelines & stages (no hardcoded fallback)
const stages = ref([]);
const stageColorMap = ref({});
// Pipeline list and selected pipeline for Kanban (stages = selected pipeline's stages)
const pipelines = ref([]);
const KANBAN_PIPELINE_KEY = 'arivu-deals-kanban-pipeline';
const getStoredPipelineKey = () => {
  try {
    return localStorage.getItem(KANBAN_PIPELINE_KEY) || '';
  } catch {
    return '';
  }
};
const selectedPipelineKey = ref(getStoredPipelineKey());

// Kanban customize: read from same localStorage keys as ListView Customize Kanban drawer
const KANBAN_OPTIONS_KEY = 'arivu-listview-deals-kanban-options';
const KANBAN_FIELDS_KEY = 'arivu-listview-deals-kanban-fields';
// Default card fields (Kanban only): Title, Amount, Expected Close Date, Probability, Priority, Organization, Deal Owner
const DEFAULT_KANBAN_SHOWN_KEYS = ['name', 'amount', 'expectedCloseDate', 'probability', 'priority', 'accountId', 'ownerId'];

// Keys for meta row (all shown keys except name), in same order as Customize Kanban
const kanbanMetaFieldKeys = computed(() =>
  kanbanShownFieldKeys.value.filter((k) => k !== 'name')
);
const kanbanSettingsVersion = ref(0);
const refreshKanbanSettings = () => { kanbanSettingsVersion.value++; };

// Stats panel open/closed (from ListView); when closed, Kanban column height increases
const getInitialStatsOpen = () => {
  try {
    return localStorage.getItem('arivu-stats-visible-deals') !== 'false';
  } catch {
    return true;
  }
};
const statsOpen = ref(getInitialStatsOpen());

const kanbanCardSize = computed(() => {
  kanbanSettingsVersion.value; // dependency
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (opts.cardSize && ['small', 'medium', 'large'].includes(opts.cardSize)) return opts.cardSize;
    }
  } catch (_) {}
  return 'medium';
});
const kanbanStackFields = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts.stackFields === 'boolean') return opts.stackFields;
    }
  } catch (_) {}
  return true;
});
const kanbanShowEmptyFields = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts.showEmptyFields === 'boolean') return opts.showEmptyFields;
    }
  } catch (_) {}
  return true;
});
const kanbanCollapseEmptyColumns = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_OPTIONS_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (typeof opts.collapseEmptyColumns === 'boolean') return opts.collapseEmptyColumns;
    }
  } catch (_) {}
  return false;
});
const kanbanShownFieldKeys = computed(() => {
  kanbanSettingsVersion.value;
  try {
    const raw = localStorage.getItem(KANBAN_FIELDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        const keys = arr
          .filter((f) => f && f.key && (f.visible === true || f.visible === 'true' || f.showInTable === true))
          .map((f) => f.key)
          .filter((k) => k != null && k !== '');
        if (keys.length > 0) {
          if (!keys.includes('name')) keys.unshift('name');
          return keys;
        }
      }
    }
  } catch (_) {}
  return [...DEFAULT_KANBAN_SHOWN_KEYS];
});

// Initialize view from route query or localStorage (persist so reload keeps pipeline/list)
const initializeView = () => {
  const viewParam = route.query[VIEW_QUERY_KEY];
  if (viewParam === 'list') {
    currentView.value = 'list';
    try { localStorage.setItem(viewStorageKey, 'list'); } catch (_) {}
  } else if (viewParam === 'kanban') {
    currentView.value = 'kanban';
    try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
  } else if (viewParam === undefined) {
    const savedView = localStorage.getItem(viewStorageKey);
    if (savedView === 'list') {
      currentView.value = 'list';
      router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'list' } });
    } else {
      currentView.value = 'kanban';
      try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
      router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'kanban' } });
    }
  } else {
    currentView.value = 'kanban';
    try { localStorage.setItem(viewStorageKey, 'kanban'); } catch (_) {}
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: 'kanban' } });
  }
  nextTick(() => {
    toggleTableView(currentView.value === 'list');
  });
};

// Switch view
const switchView = async (view) => {
  if (currentView.value === view) return;
  currentView.value = view;
  localStorage.setItem(viewStorageKey, view);
  router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  if (view === 'kanban') {
    await fetchKanbanDeals();
  }
  await nextTick();
  toggleTableView(view === 'list');
};

watch(() => route.query[VIEW_QUERY_KEY], (newView) => {
  if (newView === 'list' && currentView.value !== 'list') {
    switchView('list');
  } else if (newView === 'kanban' && currentView.value !== 'kanban') {
    switchView('kanban');
  }
});

// Hide table when in Kanban view (same pattern as Events)
const toggleTableView = (showTable) => {
  const tableContainer = document.querySelector('.mt-4.px-4.sm\\:px-6.lg\\:px-8:not(.kanban-view-container)');
  if (tableContainer) {
    const hasTable = tableContainer.querySelector('table') !== null || 
                     tableContainer.querySelector('[role="table"]') !== null ||
                     tableContainer.querySelector('div[class*="table-scroll"]') !== null ||
                     tableContainer.querySelector('div[class*="table-view"]') !== null;
    if (hasTable) {
      if (showTable) {
        tableContainer.style.display = '';
        tableContainer.style.visibility = '';
        tableContainer.style.pointerEvents = '';
      } else {
        tableContainer.style.display = 'none';
      }
    }
  }
};

// Fetch deals for Kanban (same filters/search as ModuleList)
const fetchKanbanDeals = async () => {
  if (currentView.value !== 'kanban') return;
  
  kanbanLoading.value = true;
  try {
    const moduleListFilters = moduleListRef.value?.getFilters?.() || {};
    const moduleListSearch = currentSearchQuery.value || moduleListRef.value?.getSearchQuery?.() || '';
    
    const params = {};
    const moduleConfig = getModuleListConfig('deals');
    let normalizedFilters = { ...moduleListFilters };
    
    if (moduleConfig?.normalizeFilters) {
      normalizedFilters = moduleConfig.normalizeFilters(normalizedFilters, authStore.user?._id);
    }
    
    Object.keys(normalizedFilters).forEach(key => {
      const value = normalizedFilters[key];
      if (value !== undefined && value !== '') {
        params[key] = value;
      } else if (value === null) {
        params[key] = null;
      }
    });
    
    if (moduleListSearch && moduleListSearch.trim()) {
      params.search = moduleListSearch.trim();
    }
    
    // Fetch all deals for pipeline (no pagination or high limit for kanban)
    params.limit = 500;
    params.page = 1;
    params.sortBy = 'stage';
    params.sortOrder = 'asc';
    if (selectedPipelineKey.value) {
      params.pipeline = selectedPipelineKey.value;
    }

    const response = await apiClient.get('/deals', { params });
    
    if (response && response.success) {
      kanbanDeals.value = Array.isArray(response.data) ? response.data : [];
      error.value = null;
    } else {
      kanbanDeals.value = [];
    }
  } catch (err) {
    console.error('[Deals] Error fetching kanban deals:', err);
    kanbanDeals.value = [];
    if (err.status === 403 || err.message?.includes('not available in your current plan')) {
      error.value = {
        type: 'plan_limitation',
        message: err.message || 'This feature is not available in your current plan. Please upgrade to access Deals.'
      };
    } else {
      error.value = { type: 'general', message: err.message || 'Failed to load deals.' };
    }
  } finally {
    kanbanLoading.value = false;
  }
};

const currentSearchQuery = ref('');

const DEAL_NAV_CONTEXT_STORAGE_PREFIX = 'arivu-deal-nav-context:';
const DEAL_NAV_CONTEXT_MAX_ENTRIES = 12;

const getCurrentDealNavigationIds = () => {
  if (currentView.value === 'kanban') {
    return (kanbanDeals.value || [])
      .map((deal) => String(deal?._id || deal?.id || '').trim())
      .filter(Boolean);
  }

  const rows = moduleListRef.value?.getCurrentRows?.() || [];
  return rows
    .map((row) => String(row?._id || row?.id || '').trim())
    .filter(Boolean);
};

const persistDealNavigationContext = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return '';

  const uniqueIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
  if (uniqueIds.length === 0) return '';

  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload = {
    ids: uniqueIds,
    createdAt: Date.now()
  };

  try {
    sessionStorage.setItem(`${DEAL_NAV_CONTEXT_STORAGE_PREFIX}${token}`, JSON.stringify(payload));

    const allKeys = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key && key.startsWith(DEAL_NAV_CONTEXT_STORAGE_PREFIX)) {
        allKeys.push(key);
      }
    }

    if (allKeys.length > DEAL_NAV_CONTEXT_MAX_ENTRIES) {
      allKeys
        .sort()
        .slice(0, allKeys.length - DEAL_NAV_CONTEXT_MAX_ENTRIES)
        .forEach((key) => sessionStorage.removeItem(key));
    }
  } catch {
    return '';
  }

  return token;
};

const handleFiltersChanged = () => {
  if (currentView.value === 'kanban') {
    fetchKanbanDeals();
  }
};

const handleSearchChanged = (searchQuery) => {
  currentSearchQuery.value = searchQuery || '';
  if (currentView.value === 'kanban') {
    fetchKanbanDeals();
  }
};

// Only run when view *changes* (not on initial mount) to avoid duplicate fetch with onMounted
watch(currentView, (newView, oldView) => {
  if (newView === 'kanban') {
    currentSearchQuery.value = moduleListRef.value?.getSearchQuery?.() || '';
    // Skip fetch on first run (immediate): onMounted will fetch after initializeView()
    if (oldView !== undefined) {
      fetchKanbanDeals();
    }
  }
  nextTick(() => {
    toggleTableView(newView === 'list');
  });
}, { immediate: true });

// Kanban helpers
const getDealsInStage = (stage) => {
  return kanbanDeals.value.filter(deal => deal.stage === stage);
};

const getStageValue = (stage) => {
  return getDealsInStage(stage).reduce((sum, deal) => sum + (Number(deal.amount) || 0), 0);
};

// Fetch stage options and colors from deals module; stages = selected pipeline's stages
const fetchStageOptions = async () => {
  try {
    const response = await apiClient.get('/modules', { params: { key: 'deals' } });
    if (!response?.success || !Array.isArray(response.data) || !response.data[0]) return;
    const mod = response.data[0];
    const fields = mod.fields || [];
    const rawPipelines = mod.pipelineSettings || [];

    pipelines.value = rawPipelines.map((p) => ({
      key: p.key,
      label: p.name || p.key,
      isDefault: p.isDefault === true,
      stages: Array.isArray(p.stages) ? p.stages : []
    }));

    // Resolve selected pipeline: stored key, or default pipeline, or first
    const defaultPipeline = pipelines.value.find((p) => p.isDefault) || pipelines.value[0];
    if (pipelines.value.length && !selectedPipelineKey.value) {
      selectedPipelineKey.value = defaultPipeline?.key || pipelines.value[0].key;
      try {
        localStorage.setItem(KANBAN_PIPELINE_KEY, selectedPipelineKey.value);
      } catch (_) {}
    }
    const selectedPipeline = pipelines.value.find((p) => p.key === selectedPipelineKey.value) || defaultPipeline || pipelines.value[0];
    const pipelineStages = selectedPipeline?.stages || [];
    if (pipelineStages.length) {
      stages.value = pipelineStages.map((s) => (s.name || '').trim()).filter(Boolean);
    } else {
      stages.value = [];
    }

    // Stage colors: from Stage field options or pipeline stage colors
    const stageField = fields.find((f) => String(f?.key || '').toLowerCase() === 'stage');
    const opts = stageField?.options || [];
    const map = {};
    opts.forEach((opt) => {
      const val = typeof opt === 'string' ? opt : (opt?.value ?? '');
      const color = typeof opt === 'object' && opt?.color ? String(opt.color).trim() : null;
      if (val && color) map[val] = color;
    });
    pipelineStages.forEach((s) => {
      const name = (s.name || '').trim();
      if (name && !map[name] && s.color && /^#[0-9A-Fa-f]{6}$/.test(String(s.color).trim())) {
        map[name] = String(s.color).trim();
      }
    });
    stageColorMap.value = map;
  } catch (_) {
    stages.value = [];
    stageColorMap.value = {};
    pipelines.value = [];
  }
};

const getStageColor = (stage) => stageColorMap.value[stage] || null;

const onPipelineChange = () => {
  try {
    localStorage.setItem(KANBAN_PIPELINE_KEY, selectedPipelineKey.value);
  } catch (_) {}
  fetchStageOptions();
  fetchKanbanDeals();
};

function hexToRgba(hex, alpha) {
  if (!hex) return null;
  const h = String(hex).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const createInitialData = ref({});

const openCreateDealInStage = (stage) => {
  createInitialData.value = {
    stage,
    ...(selectedPipelineKey.value ? { pipeline: selectedPipelineKey.value } : {})
  };
  editingDeal.value = null;
  showFormModal.value = true;
};

// Row click (from list) and view deal
const handleRowClick = (row) => {
  viewDeal(row._id, null, row.name);
};

const viewDeal = (dealId, event = null, titleOverride = null) => {
  const title = titleOverride || kanbanDeals.value.find(d => d._id === dealId)?.name || t('deals.dealsDealDetail');
  const openInBackground = event && (event.button === 1 || event.metaKey || event.ctrlKey);
  const navContextToken = persistDealNavigationContext(getCurrentDealNavigationIds());
  const routePath = navContextToken
    ? `/deals/${dealId}?navCtx=${encodeURIComponent(navContextToken)}`
    : `/deals/${dealId}`;
  openTab(routePath, { title, icon: 'briefcase', params: { name: title }, background: openInBackground, insertAdjacent: true });
};

// Single delete (from list row action)
const handleDelete = async (row) => {
  if (!row?._id) return;
  try {
    await apiClient.delete(`/deals/${row._id}`);
    await fetchKanbanDeals();
    if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
  } catch (err) {
    console.error('Delete deal error:', err);
    alert(err?.response?.data?.message || t('common.dealsToastErrorDeletingDealPleaseTry'));
  }
};

// Bulk actions
const handleBulkAction = async (action, rows) => {
  const dealIds = rows.map(deal => deal._id);
  try {
    if (action === 'delete' || action === 'bulk-delete') {
      await Promise.all(dealIds.map(id => apiClient.delete(`/deals/${id}`)));
      await fetchKanbanDeals();
      if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
    } else if (action === 'bulk-move-stage') {
      const stage = prompt(`Move ${rows.length} deals to stage:\n\nOptions: ${stages.value.join(', ')}`);
      if (!stage || !stages.value.includes(stage)) return;
      await Promise.all(dealIds.map(id => apiClient.patch(`/deals/${id}/stage`, { stage })));
      await fetchKanbanDeals();
      if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
    } else if (action === 'export') {
      exportDeals();
    }
  } catch (err) {
    console.error('Bulk action error:', err);
    alert(t('common.dealsToastErrorPerformingBulkActionPlease'));
  }
};

// Create/Edit
const openCreateModal = () => {
  createInitialData.value = {};
  editingDeal.value = null;
  showFormModal.value = true;
};

const closeFormModal = () => {
  showFormModal.value = false;
  editingDeal.value = null;
  createInitialData.value = {};
};

const handleDealSaved = () => {
  closeFormModal();
  fetchKanbanDeals();
  if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
};

// Export
const exportDeals = async () => {
  try {
    const response = await fetch('/api/csv/export/deals', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authStore.user?.token || (typeof localStorage !== 'undefined' && localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).token : '')}`
      }
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deals_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Export error:', err);
    alert(t('common.dealsToastFailedToExportDeals'));
  }
};

const handleImportComplete = () => {
  showImportModal.value = false;
  fetchKanbanDeals();
  if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
};

// Kanban: persist stage change and/or same-column reorder from KanbanBoard
const handleKanbanUpdate = async ({ item, newStage, newIndex, previousStage }) => {
  const id = item._id != null ? (typeof item._id === 'string' ? item._id : String(item._id)) : null;
  if (!id) return;
  try {
    const payload = { stage: newStage };
    if (typeof newIndex === 'number' && newIndex >= 0) {
      payload.order = newIndex;
    }
    await apiClient.patch(`/deals/${id}/stage`, payload);
    await fetchKanbanDeals();
    if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
  } catch (err) {
    console.error('Error updating stage:', err);
    const msg = err?.response?.data?.message || err?.message || t('deals.dealsStageUpdateFailed');
    alert(msg);
  }
};

// Helpers
const formatCurrency = (amount, currencyCode = DEFAULT_CURRENCY_CODE) => {
  return (
    formatCurrencyValue(amount || 0, {
      currencyCode: String(currencyCode || DEFAULT_CURRENCY_CODE).toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) || '—'
  );
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getUserDisplayName = (user) => {
  if (!user) return t('records.editableUnassigned');
  const first = user.firstName || user.first_name || '';
  const last = user.lastName || user.last_name || '';
  return `${first} ${last}`.trim() || user.email || user.username || t('records.editableUnassigned');
};

const getInitials = (user) => {
  if (!user) return '?';
  return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
};

const isOverdue = (date) => {
  if (!date) return false;
  return new Date(date) < new Date();
};

const formatMetaValue = (value, key) => {
  if (value == null) return '—';
  if (typeof value === 'object' && value !== null && 'name' in value) return value.name ?? '—';
  if (typeof value === 'object' && value !== null && ('firstName' in value || 'first_name' in value)) {
    return getUserDisplayName(value);
  }
  if (key === 'expectedCloseDate' || key === 'closeDate' || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) return formatDate(value);
  if (typeof value === 'number') return String(value);
  return String(value);
};

/** True when the field has no value for this deal (used with "Show empty fields" option). */
const isDealFieldEmpty = (deal, key) => {
  if (!deal) return true;
  switch (key) {
    case 'amount':
      return deal.amount == null || deal.amount === '';
    case 'expectedCloseDate':
      return !deal.expectedCloseDate;
    case 'probability':
      return deal.probability == null;
    case 'priority':
      return !deal.priority;
    case 'accountId':
      return !(deal.accountId?.name ?? deal.account?.name);
    case 'ownerId':
      return !deal.ownerId;
    case 'contactId':
      return !deal.contactId;
    default:
      const v = deal[key];
      return v == null || v === '';
  }
};

// Record created event (refresh both views)
const handleRecordCreated = (event) => {
  const { moduleKey } = event.detail || {};
  if (moduleKey === 'deals') {
    if (currentView.value === 'kanban') fetchKanbanDeals();
    if (moduleListRef.value?.refresh) moduleListRef.value.refresh();
  }
};

onMounted(() => {
  initializeView();
  fetchStageOptions();
  // Single initial fetch for kanban (watcher skips fetch on immediate run to avoid duplicate)
  if (currentView.value === 'kanban') {
    fetchKanbanDeals();
  }
  nextTick(() => {
    setTimeout(() => toggleTableView(currentView.value === 'list'), 100);
  });
  if (typeof window !== 'undefined') {
    window.addEventListener('arivu:record-created', handleRecordCreated);
  }
});

// When switching back to this tab (keep-alive), refetch and sync URL to current view so session persists
onActivated(() => {
  const view = currentView.value;
  if (route.query[VIEW_QUERY_KEY] !== view) {
    router.replace({ query: { ...route.query, [VIEW_QUERY_KEY]: view } });
  }
  if (view === 'kanban') fetchKanbanDeals();
  if (view === 'list') moduleListRef.value?.reactivate?.();
  nextTick(() => setTimeout(() => toggleTableView(view === 'list'), 80));
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('arivu:record-created', handleRecordCreated);
  }
});
</script>

<style>
/* Unscoped (like Events) so table inside ModuleList/ListView is hidden when in kanban view */
/* Hide table container when in kanban view - applies after ModuleList loads */
[data-view="kanban"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.kanban-view-container) {
  display: none;
}

[data-view="list"] .mt-4.px-4.sm\:px-6.lg\:px-8:not(.kanban-view-container) {
  display: block;
}

.kanban-view-container {
  display: block;
}

.kanban-add-btn:hover {
  background-color: var(--add-btn-hover-bg);
}
</style>
