<template>
  <div class="mb-6">
    <!-- Layer Header -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ t('settings.modFieldsGroupParticipation') }}</span>
        <!-- Attach to App CTA -->
        <button
          v-if="showAttachCTA"
          @click="handleAttachClick"
          :class="[
            'flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
            hasParticipations
              ? 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
              : 'text-white bg-indigo-600 hover:bg-indigo-700'
          ]"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ t('people.participationLayerAttachToApp2') }}</span>
        </button>
      </div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
        Why are they in our system?
      </h2>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">{{ t('people.participationLayerAppParticipationsAndRoles') }}</p>
    </div>

    <!-- Participation Cards -->
    <div v-if="hasParticipations" class="space-y-4">
      <ParticipationCard
        v-for="(appSection, appKey) in participations"
        :key="appKey"
        :app-key="appKey"
        :app-section="appSection"
        :person-id="personId"
        @convert="handleConvert"
        @edit="handleEdit"
        @edit-details="handleEditDetails"
        @view="handleView"
        @detach="handleDetach"
        @create-deal="handleCreateDeal"
        @create-task="handleCreateTask"
        @create-case="handleCreateCase"
        @schedule-meeting="handleScheduleMeeting"
        @status-updated="handleStatusUpdated"
      />
    </div>

    <!-- Empty State -->
    <div v-else class="bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="px-6 py-12 text-center">
        <div class="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg class="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-white mb-1">{{ t('people.participationLayerNoAppParticipations') }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ t('people.participationLayerThisPersonIsNotParticipatingIn') }}</p>
        <!-- Primary CTA in empty state -->
        <button
          v-if="showAttachCTA"
          @click="handleAttachClick"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>{{ t('people.participationLayerAttachToApp') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import ParticipationCard from './ParticipationCard.vue';
import { computed } from 'vue';
import { useAuthStore } from '@/stores/authRegistry';
import { PEOPLE_PERMISSIONS } from '@/platform/permissions/peoplePermissions';
import { hasPeoplePermission } from '@/platform/permissions/peoplePermissionHelper';

const props = defineProps({
  profileData: {
    type: Object,
    default: null
  },
  appContext: {
    type: Object,
    default: null
  },
  personId: {
    validator: (v) => v === null || typeof v === 'string',
    default: null
  }
});

const { t } = useI18n();

const emit = defineEmits(['convert', 'edit', 'edit-details', 'view', 'detach', 'create-deal', 'create-task', 'create-case', 'schedule-meeting', 'status-updated', 'attach-to-app']);

const authStore = useAuthStore();

// Get participations (only apps where person actually participates)
const participations = computed(() => {
  if (!props.profileData?.apps) return {};
  
  const result = {};
  Object.entries(props.profileData.apps).forEach(([appKey, appSection]) => {
    // Check if person actually participates in this app
    if (appKey === 'SALES') {
      // For SALES, check if type field is set
      if (appSection.fields?.type) {
        result[appKey] = appSection;
      }
    } else {
      // For other apps, check if any fields are set
      if (appSection.fields && Object.keys(appSection.fields).length > 0) {
        result[appKey] = appSection;
      }
    }
  });
  
  return result;
});

const hasParticipations = computed(() => {
  return Object.keys(participations.value).length > 0;
});

// Get enabled apps from organization
const enabledApps = computed(() => {
  const org = authStore.organization;
  if (!org?.enabledApps || !Array.isArray(org.enabledApps)) {
    return [];
  }
  // Extract app keys from enabledApps array
  // Format: [{ appKey: 'SALES', status: 'ACTIVE' }, ...]
  return org.enabledApps
    .filter(app => app.status === 'ACTIVE')
    .map(app => app.appKey);
});

// Get apps where person already participates
const attachedAppKeys = computed(() => {
  return Object.keys(participations.value);
});

// Check if there are available apps to attach
const hasAvailableApps = computed(() => {
  return enabledApps.value.length > 0 && attachedAppKeys.value.length < enabledApps.value.length;
});

// Check if user has permission to attach to at least one available app
const hasAttachPermission = computed(() => {
  // Check if user has permission for any available app
  for (const appKey of enabledApps.value) {
    const permissionKey = PEOPLE_PERMISSIONS.ATTACH[appKey] || PEOPLE_PERMISSIONS.ATTACH.BASE;
    if (hasPeoplePermission(permissionKey, authStore)) {
      return true;
    }
  }
  // If no app-specific permission, check BASE permission
  return hasPeoplePermission(PEOPLE_PERMISSIONS.ATTACH.BASE, authStore);
});

// Show CTA only if there are available apps AND user has permission
const showAttachCTA = computed(() => {
  return hasAvailableApps.value && hasAttachPermission.value;
});

// Handle attach click
const handleAttachClick = () => {
  emit('attach-to-app');
};

// Event handlers
const handleConvert = (appKey) => {
  emit('convert', appKey);
};

const handleEdit = (appKey) => {
  emit('edit', appKey);
};

const handleEditDetails = (appKey) => {
  emit('edit-details', appKey);
};

const handleView = (appKey) => {
  emit('view', appKey);
};

const handleDetach = (appKey) => {
  emit('detach', appKey);
};

const handleCreateDeal = (appKey, personId) => {
  emit('create-deal', appKey, personId);
};

const handleCreateTask = (appKey, personId) => {
  emit('create-task', appKey, personId);
};

const handleCreateCase = (appKey, personId) => {
  emit('create-case', appKey, personId);
};

const handleScheduleMeeting = (appKey, personId) => {
  emit('schedule-meeting', appKey, personId);
};

const handleStatusUpdated = (updateData) => {
  emit('status-updated', updateData);
};
</script>
