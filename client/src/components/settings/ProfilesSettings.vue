<template>
  <div :class="embedded ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'p-6'">
    <div v-if="!embedded" class="mb-6 shrink-0">
      <h2 class="text-2xl font-bold text-gray-900 dark:text-white">{{ t('settings.profilesPageTitle') }}</h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ t('settings.profilesPageSubtitle') }}
      </p>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.profilesCount', { count: profiles.length }) }}</p>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          @click="openCreate"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ t('settings.profilesCreate') }}</span>
        </button>
      </div>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>

      <div
        v-else-if="profiles.length === 0"
        class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700"
      >
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ t('settings.profilesEmptyTitle') }}</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('settings.profilesEmptyBody') }}</p>
      </div>

      <div v-else class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.profilesColName') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">{{ t('settings.profilesColDescription') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.profilesColType') }}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{{ t('settings.profilesColActions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="profile in profiles"
              :key="profile._id"
              class="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
            >
              <td class="px-4 py-3">
                <button
                  type="button"
                  class="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 text-left"
                  @click="openEdit(profile)"
                >
                  {{ profile.name }}
                </button>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell max-w-xs truncate">
                {{ profile.description || t('settings.profilesNoDescription') }}
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="profile.isSystemProfile"
                  class="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                >
                  {{ t('settings.profilesSystemBadge') }}
                </span>
                <span
                  v-else
                  class="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {{ t('settings.profilesCustomBadge') }}
                </span>
              </td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    @click="openEdit(profile)"
                  >
                    {{ t('actions.edit') }}
                  </button>
                  <button
                    type="button"
                    class="text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    @click="cloneProfile(profile)"
                  >
                    {{ t('settings.profilesClone') }}
                  </button>
                  <button
                    v-if="!profile.isSystemProfile"
                    type="button"
                    class="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-500"
                    @click="deleteProfile(profile)"
                  >
                    {{ t('actions.delete') }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ProfileFormDrawer
      :open="showDrawer"
      :profile="selectedProfile"
      @close="closeDrawer"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import ProfileFormDrawer from './ProfileFormDrawer.vue';

defineProps({
  embedded: { type: Boolean, default: false }
});

const { t } = useI18n();

const profiles = ref([]);
const loading = ref(false);
const showDrawer = ref(false);
const selectedProfile = ref(null);

const fetchProfiles = async () => {
  loading.value = true;
  try {
    const response = await apiClient.get('/profiles');
    if (response.success) {
      profiles.value = response.data || [];
    }
  } catch (err) {
    console.error('Error fetching profiles:', err);
  } finally {
    loading.value = false;
  }
};

const openCreate = () => {
  selectedProfile.value = null;
  showDrawer.value = true;
};

const openEdit = (profile) => {
  selectedProfile.value = profile;
  showDrawer.value = true;
};

const closeDrawer = () => {
  showDrawer.value = false;
  selectedProfile.value = null;
};

const handleSaved = () => {
  closeDrawer();
  fetchProfiles();
};

const cloneProfile = async (profile) => {
  const name = window.prompt(t('settings.profilesCloneNamePrompt'), `${profile.name} (Copy)`);
  if (!name?.trim()) return;
  try {
    const response = await apiClient.post(`/profiles/${profile._id}/clone`, { name: name.trim() });
    if (response.success) {
      await fetchProfiles();
    } else {
      window.alert(response.message || t('settings.profilesCloneFailed'));
    }
  } catch (err) {
    window.alert(err.message || t('settings.profilesCloneFailed'));
  }
};

const deleteProfile = async (profile) => {
  if (!window.confirm(t('settings.profilesDeleteConfirm', { name: profile.name }))) return;
  try {
    const response = await apiClient.delete(`/profiles/${profile._id}`);
    if (response.success) {
      await fetchProfiles();
    } else {
      window.alert(response.message || t('settings.profilesDeleteFailed'));
    }
  } catch (err) {
    window.alert(err.message || t('settings.profilesDeleteFailed'));
  }
};

onMounted(fetchProfiles);
</script>
