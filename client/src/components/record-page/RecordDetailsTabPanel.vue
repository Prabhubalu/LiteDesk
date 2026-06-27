<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="record-context-panel__header flex flex-shrink-0 flex-col gap-2.5 border-b border-gray-200/90 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('records.detailsTitle') }}</h2>
        <span
          v-if="fieldCountLabel"
          class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        >
          {{ fieldCountLabel }}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <DetailsTabFieldFilter
          v-model="detailsTabSearchQuery"
          :placeholder="t('records.genericFilterFieldsPh')"
        />
        <button
          type="button"
          :class="[
            DETAILS_TAB_TOOLBAR_HEIGHT_CLASS,
            'inline-flex shrink-0 items-center rounded-lg border px-2.5 py-0 text-xs font-medium leading-none transition-colors',
            detailsShowEmptyFields
              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/35 dark:bg-indigo-950/40 dark:text-indigo-200'
              : 'border-gray-200/90 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600/70 dark:bg-gray-800/50 dark:text-gray-400 dark:hover:border-gray-500'
          ]"
          @click="detailsShowEmptyFields = !detailsShowEmptyFields"
        >
          {{ t('records.genericShowEmptyFields') }}
        </button>
      </div>
    </div>
    <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4">
      <template v-if="record?._id && adapter">
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
          :record="record"
          :adapter="adapter"
          :context="context"
          :field-rows-override="filteredDetailFields"
          :show-all-fields="true"
          variant="compact"
        />
        <p v-else class="px-1 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          {{ t('records.genericNoFieldsToShow') }}
        </p>
      </template>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.genericNoRecordLoaded') }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import DetailsTabFieldFilter from '@/components/record-page/DetailsTabFieldFilter.vue';
import { DETAILS_TAB_TOOLBAR_HEIGHT_CLASS } from '@/components/record-page/detailsTabToolbar';

const props = defineProps({
  record: { type: Object, default: null },
  adapter: { type: Object, default: null },
  context: {
    type: Object,
    default: () => ({ hideHeader: true })
  }
});

const { t } = useI18n();

const detailsTabSearchQuery = ref('');
const detailsShowEmptyFields = ref(false);

function isDetailRowEmpty(row) {
  if (!row || row.key === 'source') return false;
  if (row.type === 'tags') {
    const v = row.value;
    return !Array.isArray(v) || v.length === 0;
  }
  const v = row.value;
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    const dv = row.displayValue;
    return dv == null || String(dv).trim() === '';
  }
  if (v === false || v === 0) return false;
  if (v == null || v === '') return true;
  if (typeof v === 'string' && !String(v).trim()) return true;
  if (Array.isArray(v) && v.length === 0) return true;
  const dv = row.displayValue;
  if (dv == null || String(dv).trim() === '') return true;
  return false;
}

const allModuleFields = computed(() => {
  if (!props.adapter || !props.record) return [];
  const rows = props.adapter.getAllModuleFields?.(props.record, props.context);
  return Array.isArray(rows) ? rows : [];
});

const filteredDetailFields = computed(() => {
  const q = (detailsTabSearchQuery.value || '').trim().toLowerCase();
  let rows = allModuleFields.value;
  if (q) {
    rows = rows.filter((f) => {
      const label = String(f.label || '').toLowerCase();
      const key = String(f.key || '').toLowerCase();
      const dv = String(f.displayValue || '').toLowerCase();
      return label.includes(q) || key.includes(q) || dv.includes(q);
    });
  }
  if (!detailsShowEmptyFields.value) {
    rows = rows.filter((r) => !isDetailRowEmpty(r));
  }
  return rows;
});

const fieldCountLabel = computed(() => {
  const total = allModuleFields.value.length;
  const shown = filteredDetailFields.value.length;
  const q = (detailsTabSearchQuery.value || '').trim();
  const hidingEmpty = !detailsShowEmptyFields.value;
  if (!total) return '';
  if (q && shown !== total) return `${shown} of ${total}`;
  if (hidingEmpty && shown !== total) return `${shown} shown · ${total} total`;
  return `${total} field${total === 1 ? '' : 's'}`;
});
</script>
