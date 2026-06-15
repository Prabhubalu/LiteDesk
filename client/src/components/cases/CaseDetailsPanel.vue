<template>
  <div class="flex h-full min-h-0 flex-col bg-gray-50/50 dark:bg-gray-900">
    <div class="record-context-panel__header flex shrink-0 flex-col gap-2.5 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('cases.recordDetailsTitle') }}</h2>
        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="fieldCountLabel"
            class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            {{ fieldCountLabel }}
          </span>
          <button
            v-if="canEdit && !isClosed"
            type="button"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            @click.stop="$emit('edit-record')"
          >
            {{ t('actions.edit') }}
          </button>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <DetailsTabFieldFilter
          v-model="detailsTabSearchQuery"
          :placeholder="t('records.genericFilterFieldsPh')"
        />
        <label class="flex shrink-0 cursor-pointer select-none items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <HeadlessCheckbox v-model="detailsShowEmptyFields" size="sm" />
          {{ t('records.genericShowEmptyFields') }}
        </label>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <p v-if="!caseRecord?._id" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('records.genericNoRecordLoaded') }}
      </p>
      <template v-else-if="genericAdapter">
        <p
          v-if="allModuleFields.length && !filteredDetailFields.length && (detailsTabSearchQuery || '').trim()"
          class="px-1 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('records.genericNoFieldsMatch') }}
        </p>
        <p
          v-else-if="allModuleFields.length && !filteredDetailFields.length"
          class="px-1 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          {{ t('records.genericDetailsEmptyValuesHint') }}
        </p>
        <DetailsSection
          v-else-if="filteredDetailFields.length"
          :record="caseRecord"
          :adapter="genericAdapter"
          :context="sectionContext"
          :field-rows-override="filteredDetailFields"
          :show-all-fields="true"
          variant="compact"
        />
        <p v-else class="px-1 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.genericNoFieldsToShow') }}
        </p>
      </template>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.genericLoading') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import DetailsTabFieldFilter from '@/components/record-page/DetailsTabFieldFilter.vue';
import HeadlessCheckbox from '@/components/ui/HeadlessCheckbox.vue';
import { useCaseRecordDetailFields } from '@/composables/useCaseRecordDetailFields';
import { useTabs } from '@/composables/useTabs';

const props = defineProps({
  caseRecord: { type: Object, default: null },
  caseId: { type: String, default: '' },
  isClosed: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: true }
});

defineEmits(['edit-record']);

const { t } = useI18n();
const { openTab } = useTabs();

const caseIdRef = computed(() => props.caseId || props.caseRecord?._id || '');

const {
  genericAdapter,
  sectionContext,
  allModuleFields,
  filteredDetailFields,
  detailsTabSearchQuery,
  detailsShowEmptyFields,
  fieldCountLabel
} = useCaseRecordDetailFields({
  caseRecord: toRef(props, 'caseRecord'),
  caseId: caseIdRef,
  canEdit: toRef(props, 'canEdit'),
  isClosed: toRef(props, 'isClosed'),
  openTab
});
</script>
