<template>
  <div class="space-y-4">
    <fieldset>
      <legend :class="rbLabel">{{ t('analytics.dashboardFieldVisibility') }}</legend>
      <div class="mt-2 space-y-2">
        <label
          v-for="option in visibilityOptions"
          :key="option.value"
          class="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200"
        >
          <input
            type="radio"
            name="report-visibility"
            :value="option.value"
            :checked="visibility === option.value"
            class="border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
            @change="$emit('update:visibility', option.value)"
          />
          {{ option.label }}
        </label>
      </div>
    </fieldset>

    <div v-if="visibility === 'team'">
      <p :class="rbLabel">{{ t('analytics.dashboardShareTeams') }}</p>
      <select
        multiple
        :class="rbInput"
        class="min-h-[6rem]"
        :value="selectedTeamIds"
        @change="onTeamsChange"
      >
        <option v-for="team in teams" :key="team._id" :value="team._id">
          {{ team.name }}
        </option>
      </select>
    </div>

    <div v-if="visibility === 'role'">
      <p :class="rbLabel">{{ t('analytics.dashboardShareRoles') }}</p>
      <select
        multiple
        :class="rbInput"
        class="min-h-[6rem]"
        :value="selectedRoleIds"
        @change="onRolesChange"
      >
        <option v-for="role in roles" :key="role._id" :value="role._id">
          {{ role.name }}
        </option>
      </select>
    </div>

    <div>
      <p :class="rbLabel">{{ t('analytics.builderShareUsers') }}</p>
      <select
        multiple
        :class="rbInput"
        class="min-h-[6rem]"
        :value="selectedUserIds"
        @change="onUsersChange"
      >
        <option v-for="user in users" :key="user._id" :value="user._id">
          {{ user.label }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { rbInput, rbLabel } from '@/components/analytics/report-builder/reportBuilderUi';
import type { AnalyticsShareTarget, AnalyticsVisibility } from '@/types/analytics.types';

const props = defineProps<{
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
}>();

const emit = defineEmits<{
  (e: 'update:visibility', value: AnalyticsVisibility): void;
  (e: 'update:sharedWith', value: AnalyticsShareTarget[]): void;
}>();

const { t } = useI18n();

const teams = ref<Array<{ _id: string; name: string }>>([]);
const roles = ref<Array<{ _id: string; name: string }>>([]);
const users = ref<Array<{ _id: string; label: string }>>([]);

const visibilityOptions = computed(() => [
  { value: 'private' as AnalyticsVisibility, label: t('analytics.visibilityPrivate') },
  { value: 'team' as AnalyticsVisibility, label: t('analytics.visibilityTeam') },
  { value: 'role' as AnalyticsVisibility, label: t('analytics.visibilityRole') },
  { value: 'organization' as AnalyticsVisibility, label: t('analytics.visibilityOrganization') },
]);

const selectedTeamIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'team').map((target) => target.id),
);

const selectedRoleIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'role').map((target) => target.id),
);

const selectedUserIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'user').map((target) => target.id),
);

function replaceSharedByType(type: 'team' | 'role' | 'user', ids: string[]) {
  const others = props.sharedWith.filter((target) => target.type !== type);
  emit('update:sharedWith', [...others, ...ids.map((id) => ({ type, id }))]);
}

function onTeamsChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const ids = Array.from(select.selectedOptions).map((option) => option.value);
  replaceSharedByType('team', ids);
}

function onRolesChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const ids = Array.from(select.selectedOptions).map((option) => option.value);
  replaceSharedByType('role', ids);
}

function onUsersChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const ids = Array.from(select.selectedOptions).map((option) => option.value);
  replaceSharedByType('user', ids);
}

async function loadShareOptions() {
  try {
    const [groupsRes, rolesRes, usersRes] = await Promise.all([
      apiClient.get('/groups', { params: { limit: 200 } }),
      apiClient.get('/roles'),
      apiClient.get('/users', { params: { limit: 200, status: 'active' } }),
    ]);
    teams.value = Array.isArray(groupsRes?.data) ? groupsRes.data : (groupsRes?.groups || []);
    roles.value = Array.isArray(rolesRes?.data) ? rolesRes.data : (rolesRes?.roles || []);
    const userRows = Array.isArray(usersRes?.data) ? usersRes.data : (usersRes?.users || []);
    users.value = userRows.map((user: { _id: string; firstName?: string; lastName?: string; email?: string }) => ({
      _id: String(user._id),
      label: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || user._id,
    }));
  } catch {
    teams.value = [];
    roles.value = [];
    users.value = [];
  }
}

watch(
  () => props.visibility,
  (value) => {
    if (value === 'private') {
      const usersOnly = props.sharedWith.filter((target) => target.type === 'user');
      emit('update:sharedWith', usersOnly);
      return;
    }
    if (value === 'organization') {
      emit('update:sharedWith', props.sharedWith.filter((target) => target.type === 'user'));
    }
  },
);

onMounted(loadShareOptions);
</script>
