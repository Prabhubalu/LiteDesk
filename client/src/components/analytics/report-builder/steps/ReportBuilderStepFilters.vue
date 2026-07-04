<template>
  <div class="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <ReportBuilderFieldExplorer
      :primary-module-label="primaryModuleLabel"
      :field-options="fieldOptions"
      :selected-fields="selectedFields"
      :related-module-groups="[]"
      @toggle-field="() => undefined"
    />

    <div :class="rbPanel">
      <div class="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
        <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.sectionFilters') }}</p>
        <span :class="rbChip">{{ t('analytics.builderFiltersOptional') }}</span>
      </div>
      <div class="p-4">
        <ReportFilterSection
          :key="`${primaryModule}-${filterRemountToken}`"
          :module-key="primaryModule"
          :field-keys="moduleFields"
          :initial-state="filterInitialState"
          @update:state="$emit('filter-change', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import ReportBuilderFieldExplorer from '@/components/analytics/report-builder/ReportBuilderFieldExplorer.vue';
import { rbChip, rbPanel } from '@/components/analytics/report-builder/reportBuilderUi';
import ReportFilterSection, { type ReportFilterState } from '@/components/analytics/ReportFilterSection.vue';
import type { ReportBuilderFieldOption } from '@/composables/useReportBuilder';

defineProps<{
  primaryModule: string;
  primaryModuleLabel: string;
  fieldOptions: ReportBuilderFieldOption[];
  moduleFields: string[];
  selectedFields: string[];
  filterInitialState: ReportFilterState | null;
  filterRemountToken: number;
}>();

defineEmits<{ (e: 'filter-change', state: ReportFilterState): void }>();

const { t } = useI18n();
</script>
