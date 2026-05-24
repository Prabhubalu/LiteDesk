<!--
  Relationship-based drill-down actions
  
  These actions navigate to module views pre-filtered by relationship to this Person.
  They do NOT show inline lists - they navigate away to filtered views.
-->

<template>
  <!-- Only render if at least one drill-down link is visible -->
  <div v-if="hasAnyDrillDowns" class="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
    <div class="px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">{{ t('records.taskRelatedRecordsTab') }}</h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            View records scoped to {{ personName }}
          </p>
        </div>
      </div>
      
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <!-- View all deals - only if SALES participation exists -->
        <button
          v-if="showDeals"
          @click="viewAllDeals"
          class="flex flex-col items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{{ t('people.relationshipDrillDownsViewAllDeals') }}</span>
        </button>
        
        <!-- View all tasks - only if person has participation -->
        <button
          v-if="showTasks"
          @click="viewAllTasks"
          class="flex flex-col items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>{{ t('people.relationshipDrillDownsViewAllTasks') }}</span>
        </button>
        
        <!-- View all meetings - only if person has participation -->
        <button
          v-if="showMeetings"
          @click="viewAllMeetings"
          class="flex flex-col items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{{ t('people.relationshipDrillDownsViewAllMeetings') }}</span>
        </button>
        
        <!-- View all cases - only if HELPDESK participation exists -->
        <button
          v-if="showCases"
          @click="viewAllCases"
          class="flex flex-col items-center gap-2 px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{{ t('people.relationshipDrillDownsViewAllCases') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';

import { canViewDeals, canViewTasks, canViewMeetings, canViewCases } from './drillDownVisibility';
import { computed } from 'vue';

const props = defineProps({
  personId: {
    type: String,
    required: true
  },
  personName: {
    type: String,
    required: true
  },
  profileData: {
    type: Object,
    default: null
  }
});

const { t } = useI18n();

const router = useRouter();
const { openTab } = useTabs();

// Compute visibility for each drill-down link
const showDeals = computed(() => canViewDeals(props.profileData));
const showTasks = computed(() => canViewTasks(props.profileData));
const showMeetings = computed(() => canViewMeetings(props.profileData));
const showCases = computed(() => canViewCases(props.profileData));

// Check if any drill-down links should be shown
const hasAnyDrillDowns = computed(() => {
  return showDeals.value || showTasks.value || showMeetings.value || showCases.value;
});

// Navigate to filtered views with scoped context
const viewAllDeals = () => {
  openTab(`/deals?personId=${props.personId}`, {
    title: `Deals involving ${props.personName}`,
    icon: 'briefcase',
    insertAdjacent: true
  });
};

const viewAllTasks = () => {
  openTab(`/tasks?personId=${props.personId}`, {
    title: `Tasks for ${props.personName}`,
    icon: 'check',
    insertAdjacent: true
  });
};

const viewAllMeetings = () => {
  openTab(`/events?personId=${props.personId}`, {
    title: `Meetings with ${props.personName}`,
    icon: 'calendar',
    insertAdjacent: true
  });
};

const viewAllCases = () => {
  // Helpdesk cases live under /helpdesk/cases.
  openTab(`/helpdesk/cases?personId=${props.personId}`, {
    title: `Cases for ${props.personName}`,
    icon: 'ticket',
    insertAdjacent: true
  });
};
</script>

