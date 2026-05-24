<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
    <div class="max-w-2xl mx-auto">
      <!-- Page Header -->
      <div class="mb-6">
        <h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">{{ t('navigation.profile') }}</h1>
        <p class="text-gray-600 dark:text-gray-400">{{ t('audit.portalProfileYourAccountInformation') }}</p>
      </div>

      <!-- Profile Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div v-if="loading" class="space-y-4">
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>

        <div v-else class="space-y-6">
          <!-- User Info -->
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('audit.portalProfileAccountInformation') }}</h2>
            <dl class="space-y-4">
              <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('settings.settingsBhFieldName') }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ userDisplayName || 'Not set' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('settings.settingsAddFieldTypeEmail') }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ authStore.user?.email || 'N/A' }}
                </dd>
              </div>
              <div>
                <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ t('settings.profileMetaOrg') }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                  {{ authStore.organization?.name || 'N/A' }}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';

const authStore = useAuthStore();

// State
const loading = ref(false);

// Computed
const userDisplayName = computed(() => {
  const user = authStore.user;
  if (user?.firstName || user?.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user?.email?.split('@')[0] || 'User';
});
</script>

