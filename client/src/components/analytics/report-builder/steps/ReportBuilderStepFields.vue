<template>
  <div class="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <ReportBuilderFieldExplorer
      :primary-module-label="primaryModuleLabel"
      :field-options="fieldOptions"
      :selected-fields="selectedFields"
      :related-module-groups="relatedModuleGroups"
      @toggle-field="(key, checked) => $emit('toggle-field', key, checked)"
    />

    <div class="space-y-4">
      <div :class="rbPanel">
        <div class="flex items-center justify-between gap-2 border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {{ t('analytics.builderSelectedFieldsTitle', { count: selectedFields.length }) }}
          </p>
          <button
            v-if="selectedFields.length"
            type="button"
            :class="rbLink"
            class="text-xs"
            @click="$emit('clear-fields')"
          >
            {{ t('analytics.builderClearAll') }}
          </button>
        </div>
        <div class="p-3">
          <draggable
            v-if="selectedFieldItems.length"
            :model-value="selectedFieldItems"
            item-key="key"
            handle=".drag-handle"
            class="space-y-1.5"
            @update:model-value="onReorder"
          >
            <template #item="{ element }">
              <div
                class="flex items-center gap-2 rounded-lg bg-zinc-50 px-2.5 py-2 dark:bg-zinc-800/50"
              >
                <Bars3Icon class="drag-handle h-4 w-4 shrink-0 cursor-grab text-zinc-400" />
                <span class="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">
                  {{ element.label }}
                </span>
                <FieldTypeBadge :type="element.type" />
                <button
                  type="button"
                  class="text-zinc-400 transition hover:text-red-500"
                  @click="$emit('remove-field', element.key)"
                >
                  <XMarkIcon class="h-4 w-4" />
                </button>
              </div>
            </template>
          </draggable>
          <p v-else class="py-12 text-center text-sm text-zinc-400">
            {{ t('analytics.builderNoFieldsSelected') }}
          </p>
        </div>
      </div>

      <div v-if="joinTargets.length" :class="rbPanel">
        <div class="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-800">
          <p class="text-sm font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.fieldRelatedModules') }}</p>
          <p class="text-xs text-zinc-400">{{ t('analytics.builderRelatedModulesHint') }}</p>
        </div>
        <div class="divide-y divide-zinc-200/80 dark:divide-zinc-800">
          <div
            v-for="join in joinTargets"
            :key="join.relationshipKey"
            class="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {{ join.label || join.targetModule }}
              </p>
              <p v-if="join.label && join.label !== join.targetModule" class="text-xs text-zinc-400 capitalize">
                {{ join.targetModule }}
              </p>
            </div>
            <button
              v-if="relatedModules.includes(join.targetModule)"
              type="button"
              :class="rbBtnSecondary"
              class="!px-3 !py-1.5 text-xs"
              @click="$emit('toggle-related', join.targetModule, false)"
            >
              {{ t('actions.remove') }}
            </button>
            <button
              v-else
              type="button"
              :class="rbBtnSecondary"
              class="!px-3 !py-1.5 text-xs"
              @click="$emit('toggle-related', join.targetModule, true)"
            >
              {{ t('actions.add') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import draggable from 'vuedraggable';
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline';
import ReportBuilderFieldExplorer from '@/components/analytics/report-builder/ReportBuilderFieldExplorer.vue';
import FieldTypeBadge from '@/components/analytics/report-builder/FieldTypeBadge.vue';
import {
  rbBtnSecondary,
  rbLink,
  rbPanel,
} from '@/components/analytics/report-builder/reportBuilderUi';
import type { AnalyticsCatalogJoinTarget } from '@/composables/useAnalyticsReports';
import type { ReportBuilderFieldOption } from '@/composables/useReportBuilder';

const props = defineProps<{
  primaryModuleLabel: string;
  fieldOptions: ReportBuilderFieldOption[];
  selectedFields: string[];
  joinTargets: AnalyticsCatalogJoinTarget[];
  relatedModules: string[];
  relatedModuleGroups: Array<{ moduleKey: string; label: string; fields: ReportBuilderFieldOption[] }>;
}>();

const emit = defineEmits<{
  (e: 'toggle-field', fieldKey: string, checked: boolean): void;
  (e: 'remove-field', fieldKey: string): void;
  (e: 'clear-fields'): void;
  (e: 'reorder-fields', fieldKeys: string[]): void;
  (e: 'toggle-related', targetModule: string, checked: boolean): void;
}>();

const { t } = useI18n();

const selectedFieldItems = computed(() =>
  props.selectedFields
    .map((key) => props.fieldOptions.find((field) => field.key === key))
    .filter(Boolean) as ReportBuilderFieldOption[],
);

function onReorder(items: ReportBuilderFieldOption[]) {
  emit('reorder-fields', items.map((item) => item.key));
}
</script>
