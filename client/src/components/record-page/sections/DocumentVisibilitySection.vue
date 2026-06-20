<template>
  <section class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
    <div class="mb-3 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
        {{ t('documents.visibilityTitle') }}
      </h3>
      <p v-if="saving" class="text-xs text-gray-500 dark:text-gray-400">{{ t('documents.visibilitySaving') }}</p>
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        v-model="localPrivate"
        type="checkbox"
        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
        :disabled="!canEdit || saving"
        @change="persistVisibility"
      />
      {{ t('documents.visibilityPrivate') }}
    </label>
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ t('documents.visibilityPrivateHint') }}</p>

    <div class="mt-4 space-y-3">
      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          v-model="localPortalVisible"
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
          :disabled="!canEdit || saving"
          @change="persistVisibility"
        />
        {{ t('documents.visibilityPortal') }}
      </label>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('documents.visibilityPortalHint') }}</p>

      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          v-model="localKnowledgeBase"
          type="checkbox"
          class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
          :disabled="!canEdit || saving"
          @change="persistVisibility"
        />
        {{ t('documents.visibilityKnowledgeBase') }}
      </label>
      <p class="text-xs text-gray-500 dark:text-gray-400">{{ t('documents.visibilityKnowledgeBaseHint') }}</p>

      <div>
        <label class="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {{ t('documents.visibilityTeams') }}
        </label>
        <TagMultiPicklistField
          :model-value="selectedTeamIds"
          :options="teamOptions"
          :disabled="!canEdit || saving"
          :placeholder="t('documents.visibilityTeams')"
          @update:model-value="onTeamsChange"
        />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import TagMultiPicklistField from '@/components/common/TagMultiPicklistField.vue';

const props = defineProps({
  record: { type: Object, default: null },
  context: { type: Object, default: () => ({}) }
});

const canEdit = computed(() => props.context?.canEditVisibility === true);

const { t } = useI18n();

const teams = ref([]);
const saving = ref(false);
const localPrivate = ref(false);
const localPortalVisible = ref(false);
const localKnowledgeBase = ref(false);
const selectedTeamIds = ref([]);

const visibility = computed(() => props.record?.visibility || {});

const teamOptions = computed(() =>
  teams.value.map((team) => ({
    value: String(team._id),
    label: String(team.name || team._id)
  }))
);

function syncFromRecord() {
  localPrivate.value = Boolean(visibility.value.private);
  localPortalVisible.value = Boolean(visibility.value.portalVisible);
  localKnowledgeBase.value = Boolean(visibility.value.knowledgeBase);
  selectedTeamIds.value = Array.isArray(visibility.value.teamIds)
    ? visibility.value.teamIds.map((id) => String(id?._id || id))
    : [];
}

async function loadOptions() {
  try {
    const groupsRes = await apiClient.get('/groups', { params: { limit: 200 } });
    teams.value = Array.isArray(groupsRes?.data) ? groupsRes.data : (groupsRes?.groups || []);
  } catch {
    teams.value = [];
  }
}

function onTeamsChange(nextTeamIds) {
  selectedTeamIds.value = Array.isArray(nextTeamIds) ? nextTeamIds.map(String) : [];
  persistVisibility();
}

async function persistVisibility() {
  if (!canEdit.value || !props.record?._id || typeof props.context?.onVisibilitySave !== 'function') return;
  saving.value = true;
  try {
    const preservedRoleIds = Array.isArray(visibility.value.roleIds)
      ? visibility.value.roleIds.map((id) => String(id?._id || id))
      : [];
    await props.context.onVisibilitySave({
      visibility: {
        private: localPrivate.value,
        teamIds: [...selectedTeamIds.value],
        roleIds: preservedRoleIds,
        portalVisible: localPortalVisible.value,
        knowledgeBase: localKnowledgeBase.value
      }
    });
  } finally {
    saving.value = false;
  }
}

watch(() => props.record?.visibility, syncFromRecord, { deep: true, immediate: true });
onMounted(loadOptions);
</script>
