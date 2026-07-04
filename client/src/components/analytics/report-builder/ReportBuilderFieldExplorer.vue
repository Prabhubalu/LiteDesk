<template>
  <div :class="[rbPanel, 'flex flex-col overflow-hidden']">
    <div class="border-b border-zinc-200/80 px-3 py-2.5 dark:border-zinc-800">
      <p class="text-xs font-medium text-zinc-900 dark:text-zinc-100">{{ t('analytics.builderFieldExplorer') }}</p>
      <p class="text-[11px] text-zinc-400">{{ primaryModuleLabel }}</p>
    </div>
    <div class="border-b border-zinc-200/80 p-2 dark:border-zinc-800">
      <div class="relative">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          v-model="searchQuery"
          type="search"
          :placeholder="t('analytics.builderFieldSearchPlaceholder')"
          :class="[rbInput, 'pl-8']"
        />
      </div>
    </div>
    <div class="max-h-[28rem] flex-1 overflow-y-auto p-2">
      <Disclosure v-slot="{ open }" :default-open="true">
        <DisclosureButton
          class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
        >
          <span>{{ primaryModuleLabel }}</span>
          <ChevronDownIcon class="h-4 w-4 text-zinc-400 transition" :class="open ? 'rotate-180' : ''" />
        </DisclosureButton>
        <DisclosurePanel class="mt-0.5 space-y-0.5">
          <label
            v-for="field in filteredPrimaryFields"
            :key="field.key"
            :class="selectedFields.includes(field.key) ? rbFieldRowActive : rbFieldRow"
          >
            <HeadlessCheckbox
              :model-value="selectedFields.includes(field.key)"
              size="sm"
              @update:model-value="(checked: boolean) => $emit('toggle-field', field.key, checked)"
            />
            <span class="min-w-0 flex-1 truncate">{{ field.label }}</span>
            <FieldTypeBadge :type="field.type" />
          </label>
        </DisclosurePanel>
      </Disclosure>

      <div
        v-for="group in filteredRelatedGroups"
        :key="group.moduleKey"
        class="mt-2"
      >
        <Disclosure v-slot="{ open }" :default-open="true">
          <DisclosureButton
            class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
          >
            <span>{{ group.label }}</span>
            <ChevronDownIcon class="h-4 w-4 text-zinc-400 transition" :class="open ? 'rotate-180' : ''" />
          </DisclosureButton>
          <DisclosurePanel class="mt-0.5 space-y-0.5">
            <label
              v-for="field in group.fields"
              :key="field.key"
              :class="selectedFields.includes(field.key) ? rbFieldRowActive : rbFieldRow"
            >
              <HeadlessCheckbox
                :model-value="selectedFields.includes(field.key)"
                size="sm"
                @update:model-value="(checked: boolean) => $emit('toggle-field', field.key, checked)"
              />
              <span class="min-w-0 flex-1 truncate">{{ field.label }}</span>
              <FieldTypeBadge :type="field.type" />
            </label>
          </DisclosurePanel>
        </Disclosure>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue';
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import FieldTypeBadge from '@/components/analytics/report-builder/FieldTypeBadge.vue';
import {
  rbFieldRow,
  rbFieldRowActive,
  rbInput,
  rbPanel,
} from '@/components/analytics/report-builder/reportBuilderUi';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import type { ReportBuilderFieldOption } from '@/composables/useReportBuilder';

const props = withDefaults(
  defineProps<{
    primaryModuleLabel: string;
    fieldOptions: ReportBuilderFieldOption[];
    selectedFields: string[];
    relatedModuleGroups?: Array<{ moduleKey: string; label: string; fields: ReportBuilderFieldOption[] }>;
  }>(),
  {
    relatedModuleGroups: () => [],
  },
);

defineEmits<{ (e: 'toggle-field', fieldKey: string, checked: boolean): void }>();

const { t } = useI18n();
const searchQuery = ref('');

function matchesSearch(field: ReportBuilderFieldOption) {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return true;
  return (
    field.key.toLowerCase().includes(query) ||
    field.label.toLowerCase().includes(query)
  );
}

const filteredPrimaryFields = computed(() =>
  props.fieldOptions.filter((field) => !field.key.includes('.') && matchesSearch(field)),
);

const filteredRelatedGroups = computed(() =>
  props.relatedModuleGroups
    .map((group) => ({
      ...group,
      fields: group.fields.filter(matchesSearch),
    }))
    .filter((group) => group.fields.length > 0),
);
</script>
