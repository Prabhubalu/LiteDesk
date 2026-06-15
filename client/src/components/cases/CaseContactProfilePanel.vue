<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="record-context-panel__header flex shrink-0 flex-col gap-2 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div class="flex items-baseline justify-between gap-2">
        <h2 class="text-sm font-normal text-gray-900 dark:text-white">{{ t('cases.recordTabContact') }}</h2>
        <span
          v-if="fieldCountLabel"
          class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {{ fieldCountLabel }}
        </span>
      </div>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="!contactId" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('cases.recordContactEmpty') }}
      </p>

      <p v-else-if="loading" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
        {{ t('records.genericLoading') }}
      </p>

      <p v-else-if="loadError" class="px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">
        {{ loadError }}
      </p>

      <template v-else-if="personRecord">
        <div class="border-b border-gray-200 px-4 py-4 text-center dark:border-gray-700">
          <Avatar :user="avatarUser" size="lg" class="mx-auto" />
          <h3 class="mt-3 truncate text-base font-semibold text-gray-900 dark:text-white">
            {{ displayName }}
          </h3>
          <p v-if="primaryEmail" class="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
            {{ primaryEmail }}
          </p>
          <p v-if="organizationLabel" class="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
            {{ organizationLabel }}
          </p>
          <button
            type="button"
            class="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            @click="openFullProfile"
          >
            {{ t('cases.recordContactOpenProfile') }}
          </button>
        </div>

        <div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div class="flex items-center gap-3">
            <DetailsTabFieldFilter
              v-model="detailsTabSearchQuery"
              :placeholder="t('records.genericFilterFieldsPh')"
            />
            <label class="flex shrink-0 cursor-pointer select-none items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <input
                v-model="detailsShowEmptyFields"
                type="checkbox"
                class="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800"
              />
              {{ t('records.genericShowEmptyFields') }}
            </label>
          </div>
        </div>

        <div class="px-4 pb-6 pt-4">
          <template v-if="genericAdapter">
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
              :record="personRecord"
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
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, toRef } from 'vue';
import { useI18n } from 'vue-i18n';
import Avatar from '@/components/common/Avatar.vue';
import DetailsSection from '@/components/record-page/sections/DetailsSection.vue';
import DetailsTabFieldFilter from '@/components/record-page/DetailsTabFieldFilter.vue';
import apiClient from '@/utils/apiClient';
import { usePersonRecordDetailFields } from '@/composables/usePersonRecordDetailFields';
import { useTabs } from '@/composables/useTabs';
import { unwrapRecordFromListOrGetResponse } from '@/utils/orgContactFormPairing';

const props = defineProps({
  caseRecord: { type: Object, default: null },
  canEdit: { type: Boolean, default: false }
});

const { t } = useI18n();
const { openTab } = useTabs();

const personRecord = ref(null);
const loading = ref(false);
const loadError = ref(null);
let fetchRunId = 0;

const contactId = computed(() => {
  const c = props.caseRecord?.contactId;
  if (!c) return '';
  return typeof c === 'object' ? String(c._id || '') : String(c);
});

const personIdRef = computed(() => personRecord.value?._id || contactId.value || '');

const {
  genericAdapter,
  sectionContext,
  allModuleFields,
  filteredDetailFields,
  detailsTabSearchQuery,
  detailsShowEmptyFields,
  fieldCountLabel
} = usePersonRecordDetailFields({
  personRecord,
  personId: personIdRef,
  canEdit: toRef(props, 'canEdit'),
  openTab
});

const displayName = computed(() => {
  const p = personRecord.value;
  if (!p) return '';
  const fromParts = [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  return fromParts || p.name || p.email || t('cases.recordContactUnnamed');
});

const primaryEmail = computed(() => personRecord.value?.email || '');

const organizationLabel = computed(() => {
  const org = personRecord.value?.organization;
  if (!org) return '';
  if (typeof org === 'object') return org.name || '';
  return String(org);
});

const avatarUser = computed(() => {
  const p = personRecord.value;
  if (!p) return null;
  return {
    firstName: p.first_name || p.firstName,
    lastName: p.last_name || p.lastName,
    email: p.email,
    avatar: p.avatar
  };
});

function syncCaseContactSnapshot() {
  const c = props.caseRecord?.contactId;
  if (!c || typeof c !== 'object' || !personRecord.value?._id) return;
  if (String(c._id) !== String(personRecord.value._id)) return;
  Object.assign(c, personRecord.value);
}

watch(personRecord, syncCaseContactSnapshot, { deep: true });

async function loadPerson(id) {
  if (!id) {
    personRecord.value = null;
    loadError.value = null;
    return;
  }

  const embedded = props.caseRecord?.contactId;
  if (embedded && typeof embedded === 'object' && String(embedded._id) === String(id) && embedded.email) {
    personRecord.value = { ...embedded };
  }

  const runId = ++fetchRunId;
  loading.value = true;
  loadError.value = null;
  try {
    const res = await apiClient.get(`/people/${id}`);
    if (runId !== fetchRunId) return;
    const data = unwrapRecordFromListOrGetResponse(res);
    if (!data || !data._id) {
      throw new Error(t('cases.recordContactLoadFailed'));
    }
    personRecord.value = data;
    syncCaseContactSnapshot();
  } catch (err) {
    if (runId !== fetchRunId) return;
    loadError.value = err?.message || t('cases.recordContactLoadFailed');
    if (!personRecord.value) personRecord.value = null;
  } finally {
    if (runId === fetchRunId) loading.value = false;
  }
}

watch(
  contactId,
  (id) => {
    loadPerson(id);
  },
  { immediate: true }
);

function openFullProfile() {
  const id = contactId.value;
  if (!id) return;
  openTab(`/people/${id}`, { background: false, insertAdjacent: true });
}
</script>
