<template>
  <div class="space-y-6">
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
        <div>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ t('settings.tallyMappingTitle') }}</h2>
          <p class="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{{ t('settings.tallyMappingDesc') }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <input
            v-model="searchQ"
            type="search"
            :placeholder="t('settings.tallyMappingSearch')"
            class="rounded-xl border border-gray-300 px-3 py-2 text-sm shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            @keyup.enter="loadExternal"
          />
          <button
            type="button"
            class="rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
            :disabled="loadingExt"
            @click="loadExternal"
          >
            {{ loadingExt ? t('states.loading') : t('actions.refresh') }}
          </button>
        </div>
      </div>

      <p v-if="!companyGuid" class="px-4 py-3 text-sm text-amber-700 sm:px-6 dark:text-amber-300">
        {{ t('settings.tallyCompanyRequired') }}
      </p>
      <p v-if="extError" class="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6">
        {{ extError }}
      </p>

      <div class="max-h-[min(22rem,calc(100vh-22rem))] overflow-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">Name</th>
              <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Entity</th>
              <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
              <th class="relative py-3 pl-3 pr-4 sm:pr-6"><span class="sr-only">{{ t('actions.edit') }}</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
            <tr v-if="!externalRows.length">
              <td colspan="4" class="px-4 py-10 text-center text-sm text-gray-500">{{ t('settings.tallyMappingEmpty') }}</td>
            </tr>
            <tr v-for="row in externalRows" :key="row._id" class="hover:bg-gray-50/80 dark:hover:bg-gray-900/30">
              <td class="py-2.5 pl-4 pr-3 sm:pl-6">
                <div class="font-medium text-gray-900 dark:text-white">{{ row.name || row.displayName || row.externalId || '—' }}</div>
                <div class="text-xs text-gray-500">{{ row.externalId }}</div>
              </td>
              <td class="px-3 py-2.5 text-gray-700 dark:text-gray-300">{{ row.entityType || '—' }}</td>
              <td class="px-3 py-2.5">
                <span
                  v-if="row.status === 'pending' || row.mappingStatus === 'pending'"
                  class="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                >
                  {{ t('settings.tallyMappingPending') }}
                </span>
                <span v-else class="text-gray-600 dark:text-gray-300">{{ row.status || row.mappingStatus || '—' }}</span>
              </td>
              <td class="whitespace-nowrap py-2.5 pl-3 pr-4 text-right sm:pr-6">
                <div class="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                    :disabled="rowBusy === row._id"
                    @click="createFrom(row)"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                    :disabled="rowBusy === row._id"
                    @click="promptLink(row)"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    class="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                    :disabled="rowBusy === row._id"
                    @click="ignoreRow(row)"
                  >
                    {{ t('settings.tallyIgnore') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Field maps (Advanced) -->
    <div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div class="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-4 sm:px-6 dark:border-gray-700">
        <HeadlessSelect
          v-model="fieldMapEntity"
          :options="fieldMapEntitySelectOptions"
          :teleport="true"
          :searchable="true"
          wrapper-class="min-w-[16rem]"
          button-class="!rounded-xl"
          options-class="max-h-72"
        />
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!!unmappedMandatoryFields.length || savingFieldMaps"
          @click="acceptAllFieldMaps"
        >
          {{ savingFieldMaps ? t('states.loading') : t('settings.tallySaveMappings') }}
        </button>
      </div>
      <div
        v-if="unmappedMandatoryFields.length"
        class="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-6 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
        role="status"
      >
        <p class="font-medium">{{ t('settings.tallyMandatoryBannerTitle') }}</p>
        <p class="mt-1 text-amber-800 dark:text-amber-200">
          {{ t('settings.tallyMandatoryBannerBody', { fields: unmappedMandatoryLabels }) }}
        </p>
      </div>
      <div
        v-else-if="fieldMapSaveError"
        class="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mx-6"
        role="alert"
      >
        {{ fieldMapSaveError }}
      </div>
      <p class="px-4 pt-3 text-xs text-gray-500 sm:px-6">{{ currentFieldMapHint }}</p>
      <div class="max-h-[min(22rem,calc(100vh-18rem))] overflow-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="py-3 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pl-6">
                {{ t('settings.tallyFieldArivu') }}
              </th>
              <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                {{ t('settings.tallyFieldTally') }}
              </th>
              <th class="px-3 py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:pr-6">
                {{ t('settings.tallyFieldMatch') }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700/80">
            <tr
              v-for="(rule, idx) in fieldMapRules"
              :key="rule.arivuFieldKey || idx"
              :class="[
                'hover:bg-gray-50/80 dark:hover:bg-gray-900/30',
                rule.required && !rule.externalFieldKey ? 'bg-amber-50/70 dark:bg-amber-950/20' : '',
              ]"
            >
              <td class="py-2.5 pl-4 pr-3 sm:pl-6">
                <div class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ rule.arivuFieldLabel }}
                  <span v-if="rule.required" class="ml-0.5 text-red-500" :title="t('settings.tallyMandatoryMarkerTitle')">*</span>
                </div>
              </td>
              <td class="px-3 py-2">
                <HeadlessSelect
                  v-model="rule.externalFieldKey"
                  :options="tallyFieldSelectOptions"
                  :teleport="true"
                  :allow-empty="true"
                  empty-label="—"
                  empty-value=""
                  :invalid="Boolean(rule.required && !rule.externalFieldKey)"
                  wrapper-class="min-w-[12rem]"
                  button-class="!py-1.5 !px-3"
                  options-class="max-h-56"
                />
              </td>
              <td class="whitespace-nowrap px-3 py-2 pr-4 tabular-nums text-gray-600 dark:text-gray-300 sm:pr-6">
                {{ Math.round((rule.confidence || 0) * 100) }}%
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';

const props = defineProps({
  companyGuid: { type: String, default: '' },
});

const { t } = useI18n();

const searchQ = ref('');
const externalRows = ref([]);
const loadingExt = ref(false);
const extError = ref('');
const rowBusy = ref('');

const fieldMapEntity = ref('party');
const fieldMapRules = ref([]);
const fieldMapEntityOptions = ref([{ entityType: 'party', label: 'Ledger → Organizations', tallyLabel: 'Ledger', arivuLabel: 'Organizations' }]);
const tallyFieldOptions = ref([]);
const savingFieldMaps = ref(false);
const fieldMapSaveError = ref('');

const fieldMapEntitySelectOptions = computed(() =>
  fieldMapEntityOptions.value.map((o) => ({
    value: o.entityType,
    label: o.label || o.entityType,
  }))
);

const tallyFieldSelectOptions = computed(() =>
  (tallyFieldOptions.value || []).map((f) => ({ value: f, label: f }))
);

const currentFieldMapHint = computed(() => {
  const opt = fieldMapEntityOptions.value.find((o) => o.entityType === fieldMapEntity.value);
  if (!opt) return '';
  return `${opt.tallyLabel || 'Tally'} ↔ ${opt.arivuLabel || 'Arivu'}`;
});

const unmappedMandatoryFields = computed(() =>
  (fieldMapRules.value || []).filter((r) => r.required && !r.externalFieldKey)
);

const unmappedMandatoryLabels = computed(() =>
  unmappedMandatoryFields.value.map((r) => r.arivuFieldLabel || r.arivuFieldKey).join(', ')
);

async function loadExternal() {
  if (!props.companyGuid) {
    externalRows.value = [];
    return;
  }
  loadingExt.value = true;
  extError.value = '';
  try {
    const qs = new URLSearchParams({
      companyGuid: props.companyGuid,
      status: 'pending',
      limit: '100',
    });
    if (searchQ.value.trim()) qs.set('q', searchQ.value.trim());
    const res = await apiClient(`/connectors/tally/external-objects?${qs}`, { method: 'GET' });
    externalRows.value = res?.data || res || [];
    if (!Array.isArray(externalRows.value)) externalRows.value = [];
  } catch (err) {
    extError.value = err?.response?.data?.message || err?.message || t('settings.tallyLoadFailed');
  } finally {
    loadingExt.value = false;
  }
}

async function ignoreRow(row) {
  rowBusy.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/ignore`, {});
    await loadExternal();
  } catch (err) {
    extError.value = err?.response?.data?.message || err?.message || 'Ignore failed';
  } finally {
    rowBusy.value = '';
  }
}

async function createFrom(row) {
  rowBusy.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/create`, {});
    await loadExternal();
  } catch (err) {
    extError.value = err?.response?.data?.message || err?.message || 'Create failed';
  } finally {
    rowBusy.value = '';
  }
}

async function promptLink(row) {
  const arivuId = window.prompt('Arivu record id to link');
  if (!arivuId) return;
  rowBusy.value = row._id;
  try {
    await apiClient.post(`/connectors/tally/external-objects/${row._id}/link`, { arivuId: arivuId.trim() });
    await loadExternal();
  } catch (err) {
    extError.value = err?.response?.data?.message || err?.message || 'Link failed';
  } finally {
    rowBusy.value = '';
  }
}

async function loadFieldMaps() {
  const guid = props.companyGuid || '';
  const res = await apiClient(
    `/connectors/tally/field-mappings?entityType=${encodeURIComponent(fieldMapEntity.value)}&companyGuid=${encodeURIComponent(guid)}`,
    { method: 'GET' }
  ).catch(() => null);
  const data = res?.data || res;
  if (Array.isArray(data?.entityOptions) && data.entityOptions.length) {
    fieldMapEntityOptions.value = data.entityOptions;
  }
  tallyFieldOptions.value = data?.tallyFields || data?.catalog?.external || [];
  fieldMapRules.value = (data?.suggestions || []).map((s) => ({
    arivuFieldKey: s.arivuFieldKey,
    arivuFieldLabel: s.arivuFieldLabel || data?.arivuFieldLabels?.[s.arivuFieldKey] || s.arivuFieldKey,
    required: Boolean(s.required),
    externalFieldKey: s.externalFieldKey || '',
    confidence: s.confidence ?? 0,
    approved: Boolean(s.approved),
  }));
  fieldMapSaveError.value = '';
}

async function acceptAllFieldMaps() {
  fieldMapSaveError.value = '';
  if (unmappedMandatoryFields.value.length) {
    fieldMapSaveError.value = t('settings.tallyMandatoryBannerBody', {
      fields: unmappedMandatoryLabels.value,
    });
    return;
  }
  savingFieldMaps.value = true;
  try {
    await apiClient.post('/connectors/tally/field-mappings/accept', {
      entityType: fieldMapEntity.value,
      companyGuid: props.companyGuid || null,
      rules: fieldMapRules.value.map((r) => ({
        ...r,
        externalFieldKey: r.externalFieldKey || null,
      })),
    });
    await loadFieldMaps();
  } catch (err) {
    fieldMapSaveError.value =
      err?.response?.data?.message || err?.message || t('settings.tallyMandatorySaveFailed');
  } finally {
    savingFieldMaps.value = false;
  }
}

async function loadAll() {
  await Promise.all([loadExternal(), loadFieldMaps()]);
}

watch(() => props.companyGuid, () => {
  loadAll();
});

watch(fieldMapEntity, () => {
  loadFieldMaps();
});

onMounted(loadAll);
defineExpose({ load: loadAll });
</script>
