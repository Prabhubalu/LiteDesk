<template>
  <div class="space-y-6">
    <ReportBuilderStepHeader
      :title="t('analytics.builderStepHeading_groupAggregate')"
      :subtitle="t('analytics.builderStepHint_groupAggregate')"
    />

    <div class="grid gap-4 lg:grid-cols-2">
      <div :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.builderRowGrouping') }}</p>
        </div>
        <div class="space-y-3 p-4">
          <div :class="rbDropZone">
            <draggable
              :model-value="rowGroupItems"
              item-key="key"
              group="groups"
              class="flex min-h-[2.5rem] flex-wrap gap-1.5"
              @update:model-value="onRowGroupsChange"
            >
              <template #item="{ element }">
                <span :class="rbChipActive">
                  {{ element.label }}
                  <button type="button" @click="removeRowGroup(element.key)">
                    <XMarkIcon class="h-3 w-3" />
                  </button>
                </span>
              </template>
            </draggable>
          </div>
          <HeadlessSelect
            v-if="availableRowGroupOptions.length"
            :model-value="''"
            :options="availableRowGroupOptions"
            :placeholder="t('analytics.builderAddRowGroup')"
            allow-empty
            teleport
            @update:model-value="addRowGroup"
          />
        </div>
      </div>

      <div :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.builderColumnGrouping') }}</p>
        </div>
        <div class="space-y-3 p-4">
          <div :class="rbDropZone">
            <draggable
              :model-value="columnGroupItems"
              item-key="key"
              group="groups"
              class="flex min-h-[2.5rem] flex-wrap gap-1.5"
              @update:model-value="onColumnGroupsChange"
            >
              <template #item="{ element }">
                <span :class="rbChip">
                  {{ element.label }}
                  <button type="button" @click="removeColumnGroup(element.key)">
                    <XMarkIcon class="h-3 w-3" />
                  </button>
                </span>
              </template>
            </draggable>
          </div>
          <HeadlessSelect
            v-if="availableColumnGroupOptions.length"
            :model-value="''"
            :options="availableColumnGroupOptions"
            :placeholder="t('analytics.builderAddColumnGroup')"
            allow-empty
            teleport
            @update:model-value="addColumnGroup"
          />
        </div>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <div :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.builderGroupSettings') }}</p>
        </div>
        <div class="divide-y divide-zinc-200/80 dark:divide-zinc-800">
          <label class="flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ t('analytics.builderShowGrandTotal') }}</span>
            <HeadlessSwitch v-model="showGrandTotal" size="sm" />
          </label>
          <label class="flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ t('analytics.builderShowSubtotals') }}</span>
            <HeadlessSwitch v-model="showSubTotals" size="sm" />
          </label>
          <label class="flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ t('analytics.builderShowRecordCount') }}</span>
            <HeadlessSwitch v-model="showRecordCount" size="sm" />
          </label>
          <label class="flex items-center justify-between gap-3 px-4 py-3">
            <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ t('analytics.builderCollapseGroups') }}</span>
            <HeadlessSwitch v-model="collapseGroups" size="sm" />
          </label>
          <label
            v-if="rowGroups.length"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <span class="text-sm text-zinc-700 dark:text-zinc-300">{{ t('analytics.builderDrillDownEnabled') }}</span>
            <HeadlessSwitch v-model="drillDownEnabled" size="sm" />
          </label>
        </div>
      </div>

      <div :class="rbPanel">
        <div class="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.builderSorting') }}</p>
          <button type="button" :class="rbLink" class="text-xs" @click="addSort">{{ t('analytics.builderAddSort') }}</button>
        </div>
        <div class="space-y-2 p-4">
          <div
            v-for="(entry, index) in sortingLocal"
            :key="index"
            class="grid grid-cols-[1fr_auto_auto] gap-2"
          >
            <HeadlessSelect v-model="entry.field" :options="sortFieldOptions" teleport />
            <HeadlessSelect v-model="entry.direction" :options="directionOptions" teleport />
            <button type="button" class="text-zinc-400 hover:text-red-500" @click="removeSort(index)">
              <XMarkIcon class="h-4 w-4" />
            </button>
          </div>
          <p v-if="!sortingLocal.length" class="text-sm text-zinc-400">{{ t('analytics.builderNoSorting') }}</p>
        </div>
      </div>
    </div>

    <div v-if="rowGroups.length" :class="rbPanel">
      <div class="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.fieldMetrics') }}</p>
        <button type="button" :class="rbLink" class="text-xs" @click="addMetric">{{ t('analytics.metricAdd') }}</button>
      </div>
      <div class="space-y-2 p-4">
        <div
          v-for="(metric, index) in metricsLocal"
          :key="index"
          class="grid gap-2 rounded-lg bg-zinc-50 p-3 sm:grid-cols-3 dark:bg-zinc-800/40"
        >
          <HeadlessSelect v-model="metric.fn" :options="aggregationFnOptions" teleport />
          <HeadlessSelect
            v-if="metric.fn !== 'count'"
            v-model="metric.field"
            :options="numericFieldOptions"
            teleport
          />
          <input v-model="metric.label" type="text" :placeholder="t('analytics.metricLabel')" :class="rbInput" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import ReportBuilderStepHeader from '@/components/analytics/report-builder/ReportBuilderStepHeader.vue';
import {
  rbChip,
  rbChipActive,
  rbDropZone,
  rbInput,
  rbLink,
  rbPanel,
} from '@/components/analytics/report-builder/reportBuilderUi';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import HeadlessSwitch from '@/components/ui/HeadlessSwitch.vue';
import type { ReportBuilderFieldOption, ReportBuilderMetric, ReportBuilderSortEntry } from '@/composables/useReportBuilder';

const props = defineProps<{
  fieldOptions: ReportBuilderFieldOption[];
  selectedFields: string[];
  numericFieldOptions: Array<{ value: string; label: string }>;
  aggregationFnOptions: Array<{ value: string; label: string }>;
}>();

const rowGroups = defineModel<string[]>('rowGroups', { required: true });
const columnGroups = defineModel<string[]>('columnGroups', { required: true });
const sorting = defineModel<ReportBuilderSortEntry[]>('sorting', { required: true });
const metrics = defineModel<ReportBuilderMetric[]>('metrics', { required: true });
const showGrandTotal = defineModel<boolean>('showGrandTotal', { required: true });
const showSubTotals = defineModel<boolean>('showSubTotals', { required: true });
const showRecordCount = defineModel<boolean>('showRecordCount', { required: true });
const collapseGroups = defineModel<boolean>('collapseGroups', { required: true });
const drillDownEnabled = defineModel<boolean>('drillDownEnabled', { required: true });

const { t } = useI18n();

const sortingLocal = sorting;
const metricsLocal = metrics;

/** All catalog fields (same pool as Fields / Filters) — selected fields listed first. */
const groupableFields = computed(() => {
  const selected = new Set(props.selectedFields || []);
  const all = props.fieldOptions.filter((field) => Boolean(field?.key));
  return [
    ...all.filter((field) => selected.has(field.key)),
    ...all.filter((field) => !selected.has(field.key)),
  ];
});

const rowGroupItems = computed(() =>
  rowGroups.value
    .map((key) => groupableFields.value.find((field) => field.key === key) || {
      key,
      label: key,
      moduleKey: '',
    })
    .filter(Boolean) as ReportBuilderFieldOption[],
);

const columnGroupItems = computed(() =>
  columnGroups.value
    .map((key) => groupableFields.value.find((field) => field.key === key) || {
      key,
      label: key,
      moduleKey: '',
    })
    .filter(Boolean) as ReportBuilderFieldOption[],
);

const availableRowGroupOptions = computed(() =>
  groupableFields.value
    .filter((field) => !rowGroups.value.includes(field.key) && rowGroups.value.length < 3)
    .map((field) => ({ value: field.key, label: field.label })),
);

const availableColumnGroupOptions = computed(() =>
  groupableFields.value
    .filter((field) => !columnGroups.value.includes(field.key) && columnGroups.value.length < 3)
    .map((field) => ({ value: field.key, label: field.label })),
);

const sortFieldOptions = computed(() =>
  groupableFields.value.map((field) => ({ value: field.key, label: field.label })),
);

const directionOptions = computed(() => [
  { value: 'asc', label: t('analytics.builderSortAsc') },
  { value: 'desc', label: t('analytics.builderSortDesc') },
]);

function onRowGroupsChange(items: ReportBuilderFieldOption[]) {
  rowGroups.value = items.map((item) => item.key);
}

function onColumnGroupsChange(items: ReportBuilderFieldOption[]) {
  columnGroups.value = items.map((item) => item.key);
}

function addRowGroup(fieldKey: string) {
  if (!fieldKey || rowGroups.value.includes(fieldKey) || rowGroups.value.length >= 3) return;
  rowGroups.value = [...rowGroups.value, fieldKey];
}

function removeRowGroup(fieldKey: string) {
  rowGroups.value = rowGroups.value.filter((key) => key !== fieldKey);
}

function addColumnGroup(fieldKey: string) {
  if (!fieldKey || columnGroups.value.includes(fieldKey) || columnGroups.value.length >= 3) return;
  columnGroups.value = [...columnGroups.value, fieldKey];
}

function removeColumnGroup(fieldKey: string) {
  columnGroups.value = columnGroups.value.filter((key) => key !== fieldKey);
}

function addSort() {
  const first = groupableFields.value[0]?.key;
  if (!first) return;
  sortingLocal.value = [...sortingLocal.value, { field: first, direction: 'desc' }];
}

function removeSort(index: number) {
  sortingLocal.value = sortingLocal.value.filter((_, i) => i !== index);
}

function addMetric() {
  const field = props.numericFieldOptions[0]?.value || 'amount';
  metricsLocal.value = [...metricsLocal.value, { fn: 'sum', field, label: `${field}_sum` }];
}
</script>
