<template>
  <div class="mx-auto max-w-4xl px-6 py-8">
    <div class="mb-6">
      <button
        type="button"
        class="mb-2 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        @click="goBack"
      >
        {{ t('actions.back') }}
      </button>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
        {{ pageTitle }}
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('marketing.segmentsBuilderDescription') }}
      </p>
    </div>

    <div v-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <form v-else class="space-y-6" @submit.prevent="handleSubmit">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.segmentsFieldName') }}
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.segmentsFieldDescription') }}
          </label>
          <textarea
            v-model="form.description"
            rows="2"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.segmentsPrimaryEntity') }}
          </label>
          <select
            v-model="primaryModuleKey"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            @change="onPrimaryEntityChange"
          >
            <option
              v-for="entity in primaryEntities"
              :key="entity.moduleKey"
              :value="entity.moduleKey"
            >
              {{ entity.label || entity.moduleKey }}
            </option>
          </select>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <div class="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40">
          <p class="text-sm font-medium text-gray-900 dark:text-white">
            {{ t('marketing.segmentsPrimaryRulesTitle') }}
          </p>
        </div>
        <FilterBuilderPanel
          :filter-config="filterConfig"
          :filters="filters"
          :filter-by-key="filterByKey"
          :filter-operators="filterOperators"
          :query="filterQuery"
          @apply="onApplyFilter"
          @clear-field="onClearField"
          @clear-all="onClearAllFilters"
          @update-query="onUpdateQuery"
          @filter-opened="onPrimaryFilterOpened"
        />
      </div>

      <AudienceRelationshipRulesPanel
        v-model:rules="relationshipRules"
        :metadata="metadata"
        :primary-module-key="primaryModuleKey"
      />

      <div
        v-if="explainSummary"
        class="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-100"
      >
        {{ explainSummary }}
      </div>

      <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t('marketing.segmentsPreviewTitle') }}
            </p>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {{ previewLoading
                ? t('states.loading')
                : t('marketing.segmentsPreviewCount', { count: previewCount ?? '—' }) }}
            </p>
            <p v-if="previewReachable != null" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('marketing.segmentsPreviewReachable', { count: previewReachable }) }}
            </p>
            <p v-if="previewMissingEmail != null && previewMissingEmail > 0" class="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {{ t('marketing.segmentsPreviewMissingEmail', { count: previewMissingEmail }) }}
            </p>
            <p v-if="previewSuppressed != null && previewSuppressed > 0" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('marketing.segmentsPreviewSuppressed', { count: previewSuppressed }) }}
            </p>
            <p v-if="previewDuplicates != null && previewDuplicates > 0" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ t('marketing.segmentsPreviewDuplicates', { count: previewDuplicates }) }}
            </p>
            <p
              v-if="previewBreakdown?.organizations != null && previewBreakdown.organizations > 0"
              class="mt-1 text-xs text-gray-500 dark:text-gray-400"
            >
              {{ t('marketing.segmentsPreviewOrganizations', { count: previewBreakdown.organizations }) }}
            </p>
          </div>
          <button
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
            :disabled="previewLoading"
            @click="runPreview"
          >
            {{ t('marketing.segmentsPreviewRefresh') }}
          </button>
        </div>

        <ul v-if="previewSample.length > 0" class="mt-4 divide-y divide-gray-200 dark:divide-gray-700">
          <li
            v-for="person in previewSample"
            :key="person._id"
            class="flex items-center justify-between gap-3 py-2 text-sm"
          >
            <span class="font-medium text-gray-900 dark:text-white">
              {{ formatPersonName(person) }}
            </span>
            <span class="text-gray-500 dark:text-gray-400">{{ person.email || '—' }}</span>
          </li>
        </ul>
      </div>

      <div class="flex flex-wrap gap-3 border-t border-gray-200 pt-5 dark:border-gray-700">
        <button
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
        <button
          v-if="isEditMode && canDelete"
          type="button"
          class="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-700 dark:text-red-300"
          @click="handleDelete"
        >
          {{ t('actions.delete') }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          @click="goBack"
        >
          {{ t('actions.cancel') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import FilterBuilderPanel from '@/components/filters/FilterBuilderPanel.vue';
import AudienceRelationshipRulesPanel from '@/components/marketing/AudienceRelationshipRulesPanel.vue';
import { createDefaultRootGroup } from '@/platform/filters/filterQueryAst';
import { useMarketingSegments } from '@/composables/useMarketingSegments';
import { useMarketingAudienceMetadata } from '@/composables/useMarketingAudienceMetadata';
import { useFilterFieldOptions } from '@/composables/useFilterFieldOptions';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import {
  buildFilterConfigByKey,
  buildFilterConfigFromMetadata,
  buildV2FilterQuery,
  compileActiveFieldRulesFromState,
  hydrateFilterBuilderFromAst
} from '@/utils/marketingAudienceFilterConfig';

import { confirmAction } from '@/composables/useConfirmAction';
const props = defineProps({
  segmentId: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();
const { metadata, fetchMetadata } = useMarketingAudienceMetadata();

const {
  fetchSegment,
  createSegment,
  updateSegment,
  deleteSegment,
  previewSegmentFilter,
  explainSegmentFilter
} = useMarketingSegments();

const loading = ref(false);
const saving = ref(false);
const previewLoading = ref(false);
const previewCount = ref(null);
const previewReachable = ref(null);
const previewMissingEmail = ref(null);
const previewSuppressed = ref(null);
const previewDuplicates = ref(null);
const previewBreakdown = ref(null);
const previewSample = ref([]);
const explainSummary = ref('');
let previewTimer = null;

const form = reactive({
  name: '',
  description: ''
});

const primaryModuleKey = ref('people');
const { handleFilterOpened: loadFilterFieldOptions, enrichFilterMap, seedOptionsFromMetadata } = useFilterFieldOptions(
  primaryModuleKey,
  computed(() => String(authStore.user?._id || ''))
);
const filters = ref({});
const filterOperators = ref({});
const filterQuery = ref(createDefaultRootGroup());
const relationshipRules = ref([]);

const primaryEntities = computed(
  () => metadata.value?.primaryEntities || [{ moduleKey: 'people', label: 'Contacts', default: true }]
);

const filterConfig = computed(() =>
  buildFilterConfigFromMetadata(metadata.value?.modules?.[primaryModuleKey.value]?.fields || [])
);
const filterByKey = computed(() =>
  enrichFilterMap(buildFilterConfigByKey(filterConfig.value), primaryModuleKey.value)
);

const resolvedId = computed(() => props.segmentId || route.params.id || '');
const isEditMode = computed(() => Boolean(resolvedId.value && route.name === 'marketing-segment-detail'));
const isCreateMode = computed(() => route.name === 'marketing-segment-new');

const pageTitle = computed(() =>
  isEditMode.value ? t('marketing.segmentsEditTitle') : t('marketing.segmentsCreateTitle')
);

const canDelete = computed(() => authStore.can('segments', 'delete'));

function formatPersonName(person) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(' ');
  return name || person.email || person._id;
}

function primaryEntityPayload() {
  const entity =
    primaryEntities.value.find((row) => row.moduleKey === primaryModuleKey.value) ||
    primaryEntities.value[0];
  return {
    appKey: entity?.appKey || 'sales',
    moduleKey: entity?.moduleKey || 'people'
  };
}

function compiledFilterQuery() {
  const fieldRules = compileActiveFieldRulesFromState(
    {
      query: filterQuery.value,
      filters: filters.value,
      operators: filterOperators.value
    },
    filterByKey.value,
    primaryModuleKey.value
  );

  const moduleFieldsByKey = metadata.value?.modules || {};

  return buildV2FilterQuery({
    primaryEntity: primaryEntityPayload(),
    fieldRules,
    fieldModuleKey: primaryModuleKey.value,
    relationshipRules: relationshipRules.value,
    moduleFieldsByKey: Object.fromEntries(
      Object.entries(moduleFieldsByKey).map(([key, value]) => [key, value?.fields || []])
    )
  });
}

function onApplyFilter({ key, value, operator }) {
  filters.value = { ...filters.value, [key]: value };
  filterOperators.value = { ...filterOperators.value, [key]: operator };
  schedulePreview();
}

function onClearField(key) {
  const nextFilters = { ...filters.value };
  const nextOperators = { ...filterOperators.value };
  delete nextFilters[key];
  delete nextOperators[key];
  filters.value = nextFilters;
  filterOperators.value = nextOperators;
  schedulePreview();
}

function onClearAllFilters() {
  filters.value = {};
  filterOperators.value = {};
  filterQuery.value = createDefaultRootGroup();
  schedulePreview();
}

function onUpdateQuery(nextQuery) {
  filterQuery.value = nextQuery;
}

async function onPrimaryFilterOpened(key) {
  await loadFilterFieldOptions(key, filterByKey.value[key], primaryModuleKey.value);
}

async function onPrimaryEntityChange() {
  relationshipRules.value = [];
  filters.value = {};
  filterOperators.value = {};
  filterQuery.value = createDefaultRootGroup();
  await fetchMetadata({ primaryModuleKey: primaryModuleKey.value });
  schedulePreview();
}

function schedulePreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(runPreview, 500);
}

async function refreshExplainSummary() {
  const ast = compiledFilterQuery();
  if (!ast?.children?.length) {
    explainSummary.value = '';
    return;
  }
  try {
    const data = await explainSegmentFilter(ast);
    explainSummary.value = data?.summary || '';
  } catch {
    explainSummary.value = '';
  }
}

async function runPreview() {
  const ast = compiledFilterQuery();
  if (!ast?.children?.length) {
    previewCount.value = 0;
    previewReachable.value = 0;
    previewMissingEmail.value = 0;
    previewSuppressed.value = 0;
    previewDuplicates.value = 0;
    previewBreakdown.value = null;
    previewSample.value = [];
    explainSummary.value = '';
    return;
  }

  previewLoading.value = true;
  try {
    const data = await previewSegmentFilter(ast, {
      limit: 5,
      primaryEntity: primaryEntityPayload()
    });
    previewCount.value = data?.totalMatches ?? data?.total ?? 0;
    previewReachable.value = data?.reachableRecipients ?? previewCount.value;
    previewMissingEmail.value = data?.missingEmail ?? 0;
    previewSuppressed.value = data?.suppressed ?? 0;
    previewDuplicates.value = data?.duplicateEmails ?? 0;
    previewBreakdown.value = data?.breakdown ?? null;
    previewSample.value = Array.isArray(data?.sample) ? data.sample : [];
    await refreshExplainSummary();
  } catch (err) {
    previewCount.value = null;
    previewReachable.value = null;
    previewMissingEmail.value = null;
    previewSuppressed.value = null;
    previewDuplicates.value = null;
    previewBreakdown.value = null;
    previewSample.value = [];
    notifications.error(err?.message || t('marketing.segmentsPreviewError'));
  } finally {
    previewLoading.value = false;
  }
}

async function loadSegment() {
  if (isCreateMode.value) return;
  loading.value = true;
  try {
    const data = await fetchSegment(resolvedId.value);
    form.name = data?.name || '';
    form.description = data?.description || '';
    primaryModuleKey.value = data?.primaryEntity?.moduleKey || 'people';
    await fetchMetadata({ primaryModuleKey: primaryModuleKey.value });

    const hydrated = hydrateFilterBuilderFromAst(data?.filterQuery, primaryModuleKey.value);
    filters.value = hydrated.filters;
    filterOperators.value = hydrated.operators;
    filterQuery.value = hydrated.query;
    relationshipRules.value = hydrated.relationshipRules || [];
    previewCount.value = data?.memberCount ?? null;
    explainSummary.value = data?.explainSummary || '';
    await runPreview();
  } catch (err) {
    notifications.error(err?.message || t('marketing.segmentsDetailError'));
    router.push({ name: 'marketing-segments' });
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!form.name.trim()) {
    notifications.error(t('marketing.segmentsValidationNameRequired'));
    return;
  }

  const ast = compiledFilterQuery();
  if (!ast?.children?.length) {
    notifications.error(t('marketing.segmentsValidationFilterRequired'));
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      primaryEntity: primaryEntityPayload(),
      filterQuery: ast
    };

    if (isEditMode.value) {
      await updateSegment(resolvedId.value, payload);
      notifications.success(t('marketing.segmentsUpdateSuccess'));
      router.push({ name: 'marketing-segments' });
      return;
    }

    await createSegment(payload);
    notifications.success(t('marketing.segmentsCreateSuccess'));
    router.push({ name: 'marketing-segments' });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!await confirmAction(t('marketing.segmentsDeleteConfirm'))) return;
  try {
    await deleteSegment(resolvedId.value);
    notifications.success(t('marketing.segmentsDeleteSuccess'));
    router.push({ name: 'marketing-segments' });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

function goBack() {
  router.push({ name: 'marketing-segments' });
}

watch(
  () => metadata.value?.modules,
  (modules) => seedOptionsFromMetadata(modules),
  { immediate: true, deep: true }
);

watch([filters, filterOperators, filterQuery, relationshipRules], schedulePreview, { deep: true });

onMounted(async () => {
  loading.value = true;
  try {
    await fetchMetadata({ primaryModuleKey: primaryModuleKey.value });
    await loadSegment();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    if (isCreateMode.value) loading.value = false;
  }
});
</script>
