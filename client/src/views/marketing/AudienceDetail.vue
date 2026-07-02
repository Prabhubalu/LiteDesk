<template>
  <div class="mx-auto max-w-5xl px-6 py-8">
    <div v-if="isCreateMode" class="max-w-2xl">
      <button
        type="button"
        class="mb-2 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        @click="router.push({ name: 'marketing-audiences' })"
      >
        {{ t('actions.back') }}
      </button>
      <h1 class="mb-6 text-2xl font-semibold text-gray-900 dark:text-white">
        {{ t('marketing.audiencesCreateTitle') }}
      </h1>

      <form class="space-y-5" @submit.prevent="handleCreate">
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldName') }}
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldDescription') }}
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldType') }}
          </label>
          <select
            v-model="form.type"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="static">{{ t('marketing.audiencesTypeStatic') }}</option>
            <option value="dynamic">{{ t('marketing.audiencesTypeDynamic') }}</option>
          </select>
        </div>
        <div v-if="form.type === 'dynamic'">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldSegment') }}
          </label>
          <select
            v-model="form.segmentId"
            required
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">{{ t('marketing.audiencesFieldSegmentNone') }}</option>
            <option v-for="segment in segmentOptions" :key="segment._id" :value="segment._id">
              {{ segment.name }} ({{ segment.memberCount || 0 }})
            </option>
          </select>
        </div>
        <div class="flex gap-3">
          <button
            type="submit"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            :disabled="saving"
          >
            {{ saving ? t('states.saving') : t('actions.create') }}
          </button>
        </div>
      </form>
    </div>

    <div v-else-if="loading" class="py-16 text-center text-sm text-gray-500">
      {{ t('states.loading') }}
    </div>

    <div v-else-if="error" class="py-16 text-center">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        {{ t('marketing.audiencesDetailError') }}
      </h2>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{{ error }}</p>
    </div>

    <template v-else-if="audience">
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0 flex-1">
          <button
            type="button"
            class="mb-2 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            @click="router.push({ name: 'marketing-audiences' })"
          >
            {{ t('actions.back') }}
          </button>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            {{ audience.name }}
          </h1>
          <p v-if="audience.description" class="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {{ audience.description }}
          </p>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {{ t('marketing.audiencesMemberCount', { count: audience.memberCount || 0 }) }}
          <span v-if="isDynamicAudience" class="ml-2 text-indigo-600 dark:text-indigo-400">
            {{ t('marketing.audiencesDynamicHint') }}
          </span>
        </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="canEdit"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
            @click="showEditForm = !showEditForm"
          >
            {{ t('actions.edit') }}
          </button>
          <label
            v-if="canImport && !isDynamicAudience"
            class="cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
          >
            {{ importing ? t('states.loading') : t('marketing.audiencesActionImport') }}
            <input type="file" accept=".csv,text/csv" class="hidden" @change="handleImport" />
          </label>
          <button
            v-if="canExport"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
            @click="handleExport"
          >
            {{ t('marketing.audiencesActionExport') }}
          </button>
          <button
            v-if="canDelete"
            type="button"
            class="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-700 dark:text-red-300"
            @click="handleDelete"
          >
            {{ t('actions.delete') }}
          </button>
        </div>
      </div>

      <form
        v-if="showEditForm && canEdit"
        class="mb-6 space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700"
        @submit.prevent="handleSave"
      >
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldName') }}
          </label>
          <input
            v-model="form.name"
            type="text"
            required
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldDescription') }}
          </label>
          <textarea
            v-model="form.description"
            rows="3"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldType') }}
          </label>
          <select
            v-model="form.type"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="static">{{ t('marketing.audiencesTypeStatic') }}</option>
            <option value="dynamic">{{ t('marketing.audiencesTypeDynamic') }}</option>
          </select>
        </div>
        <div v-if="form.type === 'dynamic'">
          <label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {{ t('marketing.audiencesFieldSegment') }}
          </label>
          <select
            v-model="form.segmentId"
            class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          >
            <option value="">{{ t('marketing.audiencesFieldSegmentNone') }}</option>
            <option v-for="segment in segmentOptions" :key="segment._id" :value="segment._id">
              {{ segment.name }} ({{ segment.memberCount || 0 }})
            </option>
          </select>
        </div>
        <button
          type="submit"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="saving"
        >
          {{ saving ? t('states.saving') : t('actions.save') }}
        </button>
      </form>

      <section v-if="canEdit && !isDynamicAudience" class="mb-8 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <h2 class="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('marketing.audiencesAddMembersTitle') }}
        </h2>
        <input
          v-model="peopleSearch"
          type="search"
          :placeholder="t('marketing.audiencesAddMembersSearch')"
          class="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
          @input="schedulePeopleSearch"
        />
        <ul class="mb-3 max-h-48 divide-y divide-gray-200 overflow-y-auto dark:divide-gray-700">
          <li
            v-for="person in peopleResults"
            :key="person._id"
            class="flex items-center justify-between gap-3 py-2"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-gray-900 dark:text-white">
                {{ contactLabel(person) }}
              </p>
              <p class="truncate text-xs text-gray-500">{{ contactEmail(person) || t('marketing.campaignsSendNoEmail') }}</p>
            </div>
            <button
              type="button"
              class="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 dark:border-gray-600 dark:text-gray-200"
              :disabled="!contactEmail(person) || addingMember"
              @click="addPerson(person)"
            >
              {{ t('actions.add') }}
            </button>
          </li>
        </ul>
      </section>

      <section>
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('marketing.audiencesMembersTitle') }}
          </h2>
          <input
            v-model="memberSearch"
            type="search"
            :placeholder="t('marketing.audiencesMembersSearch')"
            class="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            @input="scheduleMemberSearch"
          />
        </div>

        <div v-if="membersLoading" class="py-8 text-center text-sm text-gray-500">
          {{ t('states.loading') }}
        </div>

        <p
          v-else-if="members.length === 0"
          class="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700"
        >
          {{ t('marketing.audiencesMembersEmpty') }}
        </p>

        <div v-else class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {{ t('marketing.campaignsColEmail') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {{ t('marketing.audiencesColName') }}
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {{ t('marketing.audiencesColSource') }}
                </th>
                <th v-if="canEdit" class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {{ t('marketing.audiencesColActions') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              <tr v-for="member in members" :key="member._id">
                <td class="px-4 py-3 text-sm text-gray-900 dark:text-white">{{ member.email }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ member.name || '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{{ member.source || 'manual' }}</td>
                <td v-if="canEdit" class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="text-sm text-red-600 hover:text-red-500 dark:text-red-400"
                    @click="removeMember(member._id)"
                  >
                    {{ t('actions.remove') }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useMarketingAudiences } from '@/composables/useMarketingAudiences';
import { useMarketingSegments } from '@/composables/useMarketingSegments';
import { useAuthStore } from '@/stores/authRegistry';
import { useNotifications } from '@/composables/useNotifications';
import { captureMarketingAudienceImported } from '@/config/posthogMarketing';

const props = defineProps({
  audienceId: {
    type: String,
    default: ''
  }
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const notifications = useNotifications();

const {
  audience,
  members,
  membersLoading,
  fetchAudience,
  createAudience,
  updateAudience,
  deleteAudience,
  fetchAudienceMembers,
  addAudienceMembers,
  removeAudienceMember,
  importAudienceCsv,
  exportAudienceCsv
} = useMarketingAudiences();

const { segments, fetchSegments } = useMarketingSegments();

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const addingMember = ref(false);
const error = ref('');
const showEditForm = ref(false);
const peopleSearch = ref('');
const memberSearch = ref('');
const peopleResults = ref([]);

const form = reactive({
  name: '',
  description: '',
  type: 'static',
  segmentId: ''
});

const segmentOptions = computed(() => segments.value);
const isDynamicAudience = computed(() => audience.value?.type === 'dynamic');

let peopleSearchTimer = null;
let memberSearchTimer = null;

const resolvedId = computed(() => props.audienceId || route.params.id || '');
const isCreateMode = computed(() => route.name === 'marketing-audience-new');

const canEdit = computed(() => authStore.can('audiences', 'edit'));
const canDelete = computed(() => authStore.can('audiences', 'delete'));
const canImport = computed(() => authStore.can('audiences', 'import'));
const canExport = computed(() => authStore.can('audiences', 'export'));

function contactEmail(contact) {
  const email = (contact.email || contact.work_email || contact.workEmail || '').trim();
  return email && email.includes('@') ? email : '';
}

function contactLabel(contact) {
  const first = contact.firstName || contact.first_name || '';
  const last = contact.lastName || contact.last_name || '';
  const name = [first, last].filter(Boolean).join(' ');
  return name || contact.email || contact._id;
}

function applyAudience(data) {
  form.name = data?.name || '';
  form.description = data?.description || '';
  form.type = data?.type || 'static';
  form.segmentId = data?.segmentId ? String(data.segmentId) : '';
}

async function loadPage() {
  if (isCreateMode.value) return;
  loading.value = true;
  error.value = '';
  try {
    await fetchAudience(resolvedId.value);
    applyAudience(audience.value);
    await fetchAudienceMembers(resolvedId.value, { search: memberSearch.value });
  } catch (err) {
    error.value = err?.message || t('marketing.audiencesDetailError');
  } finally {
    loading.value = false;
  }
}

async function handleCreate() {
  if (!form.name.trim()) {
    notifications.error(t('marketing.audiencesValidationNameRequired'));
    return;
  }
  saving.value = true;
  try {
    const created = await createAudience({
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      segmentId: form.type === 'dynamic' ? form.segmentId || null : null
    });
    notifications.success(t('marketing.audiencesCreateSuccess'));
    const id = created?._id || created?.id;
    if (id) {
      router.replace({ name: 'marketing-audience-detail', params: { id } });
    } else {
      router.push({ name: 'marketing-audiences' });
    }
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    saving.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await updateAudience(resolvedId.value, {
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      segmentId: form.type === 'dynamic' ? form.segmentId || null : null
    });
    notifications.success(t('marketing.audiencesUpdateSuccess'));
    showEditForm.value = false;
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    saving.value = false;
  }
}

async function handleDelete() {
  if (!window.confirm(t('marketing.audiencesDeleteConfirm'))) return;
  try {
    await deleteAudience(resolvedId.value);
    notifications.success(t('marketing.audiencesDeleteSuccess'));
    router.push({ name: 'marketing-audiences' });
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  importing.value = true;
  try {
    const result = await importAudienceCsv(resolvedId.value, file);
    notifications.success(
      t('marketing.audiencesImportSuccess', {
        added: result.stats?.added ?? 0,
        duplicates: result.stats?.duplicates ?? 0
      })
    );
    captureMarketingAudienceImported({
      audience_id: resolvedId.value,
      added: result.stats?.added ?? 0
    });
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    importing.value = false;
  }
}

async function handleExport() {
  try {
    await exportAudienceCsv(resolvedId.value);
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

async function fetchPeople() {
  try {
    const params = { limit: 20, sortBy: 'firstName', sortOrder: 'asc' };
    const q = peopleSearch.value.trim();
    if (q) params.search = q;
    const res = await apiClient.get('/people', { params });
    peopleResults.value = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch {
    peopleResults.value = [];
  }
}

function schedulePeopleSearch() {
  if (peopleSearchTimer) clearTimeout(peopleSearchTimer);
  peopleSearchTimer = setTimeout(fetchPeople, 300);
}

function scheduleMemberSearch() {
  if (memberSearchTimer) clearTimeout(memberSearchTimer);
  memberSearchTimer = setTimeout(() => {
    fetchAudienceMembers(resolvedId.value, { search: memberSearch.value });
  }, 300);
}

async function addPerson(person) {
  const email = contactEmail(person);
  if (!email) return;
  addingMember.value = true;
  try {
    await addAudienceMembers(resolvedId.value, [{
      email,
      personId: person._id,
      name: contactLabel(person)
    }]);
    notifications.success(t('marketing.audiencesMemberAdded'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  } finally {
    addingMember.value = false;
  }
}

async function removeMember(memberId) {
  try {
    await removeAudienceMember(resolvedId.value, memberId);
    notifications.success(t('marketing.audiencesMemberRemoved'));
    await loadPage();
  } catch (err) {
    notifications.error(err?.message || t('states.genericFailure'));
  }
}

watch(
  () => resolvedId.value,
  () => {
    if (!isCreateMode.value) loadPage();
  }
);

onMounted(() => {
  void fetchSegments({ limit: 100 });
  if (isCreateMode.value) return;
  loadPage();
  fetchPeople();
});
</script>
