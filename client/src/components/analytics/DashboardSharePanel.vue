<template>
  <section class="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
    <h3 class="text-sm font-semibold">{{ t('analytics.dashboardShareTitle') }}</h3>

    <label class="block text-sm">
      <span class="mb-1 block font-medium">{{ t('analytics.dashboardFieldVisibility') }}</span>
      <select
        :value="visibility"
        class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        @change="onVisibilityChange"
      >
        <option value="private">{{ t('analytics.visibilityPrivate') }}</option>
        <option value="team">{{ t('analytics.visibilityTeam') }}</option>
        <option value="role">{{ t('analytics.visibilityRole') }}</option>
        <option value="organization">{{ t('analytics.visibilityOrganization') }}</option>
      </select>
    </label>

    <label v-if="visibility === 'team'" class="block text-sm">
      <span class="mb-1 block font-medium">{{ t('analytics.dashboardShareTeams') }}</span>
      <select
        multiple
        class="min-h-[6rem] w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        :value="selectedTeamIds"
        @change="onTeamsChange"
      >
        <option v-for="team in teams" :key="team._id" :value="team._id">
          {{ team.name }}
        </option>
      </select>
    </label>

    <label v-if="visibility === 'role'" class="block text-sm">
      <span class="mb-1 block font-medium">{{ t('analytics.dashboardShareRoles') }}</span>
      <select
        multiple
        class="min-h-[6rem] w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        :value="selectedRoleIds"
        @change="onRolesChange"
      >
        <option v-for="role in roles" :key="role._id" :value="role._id">
          {{ role.name }}
        </option>
      </select>
    </label>

    <label v-if="category === 'app'" class="block text-sm">
      <span class="mb-1 block font-medium">{{ t('analytics.dashboardFieldAppKey') }}</span>
      <select
        :value="appKey || ''"
        class="w-full rounded-lg border px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        @change="onAppKeyChange"
      >
        <option value="">{{ t('analytics.dashboardSelectApp') }}</option>
        <option v-for="app in appOptions" :key="app" :value="app">{{ app }}</option>
      </select>
    </label>

    <label v-if="category === 'app'" class="flex items-center gap-2 text-sm">
      <input type="checkbox" :checked="isDefault" @change="onDefaultChange" />
      {{ t('analytics.dashboardIsDefault') }}
    </label>

    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" :checked="drillDownEnabled" @change="onDrillDownChange" />
      {{ t('analytics.dashboardDrillDownEnabled') }}
    </label>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import type { AnalyticsDashboardCategory, AnalyticsShareTarget, AnalyticsVisibility } from '@/types/analytics.types';

const props = defineProps<{
  visibility: AnalyticsVisibility;
  sharedWith: AnalyticsShareTarget[];
  viewerRoleIds: string[];
  category: AnalyticsDashboardCategory;
  appKey?: string | null;
  isDefault?: boolean;
  drillDownEnabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visibility', value: AnalyticsVisibility): void;
  (e: 'update:sharedWith', value: AnalyticsShareTarget[]): void;
  (e: 'update:viewerRoleIds', value: string[]): void;
  (e: 'update:appKey', value: string | null): void;
  (e: 'update:isDefault', value: boolean): void;
  (e: 'update:drillDownEnabled', value: boolean): void;
}>();

const { t } = useI18n();

const teams = ref<Array<{ _id: string; name: string }>>([]);
const roles = ref<Array<{ _id: string; name: string }>>([]);

const appOptions = ['HELPDESK', 'SALES', 'MARKETING', 'INVENTORY'];

const selectedTeamIds = computed(() =>
  props.sharedWith.filter((target) => target.type === 'team').map((target) => target.id),
);

const selectedRoleIds = computed(() => props.viewerRoleIds.map(String));

function onVisibilityChange(event: Event) {
  emit('update:visibility', (event.target as HTMLSelectElement).value as AnalyticsVisibility);
}

function onTeamsChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  const ids = Array.from(select.selectedOptions).map((option) => option.value);
  emit(
    'update:sharedWith',
    ids.map((id) => ({ type: 'team' as const, id })),
  );
}

function onRolesChange(event: Event) {
  const select = event.target as HTMLSelectElement;
  emit('update:viewerRoleIds', Array.from(select.selectedOptions).map((option) => option.value));
}

function onAppKeyChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  emit('update:appKey', value || null);
}

function onDefaultChange(event: Event) {
  emit('update:isDefault', (event.target as HTMLInputElement).checked);
}

function onDrillDownChange(event: Event) {
  emit('update:drillDownEnabled', (event.target as HTMLInputElement).checked);
}

async function loadShareOptions() {
  try {
    const [groupsRes, rolesRes] = await Promise.all([
      apiClient.get('/groups', { params: { limit: 200 } }),
      apiClient.get('/roles'),
    ]);
    teams.value = Array.isArray(groupsRes?.data) ? groupsRes.data : (groupsRes?.groups || []);
    roles.value = Array.isArray(rolesRes?.data) ? rolesRes.data : (rolesRes?.roles || []);
  } catch {
    teams.value = [];
    roles.value = [];
  }
}

watch(
  () => props.visibility,
  (value) => {
    if (value === 'private' || value === 'organization') {
      emit('update:sharedWith', []);
      emit('update:viewerRoleIds', []);
    }
  },
);

onMounted(loadShareOptions);
</script>
