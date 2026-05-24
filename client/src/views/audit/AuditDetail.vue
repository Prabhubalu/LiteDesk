<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24 lg:pb-6">
    <!-- Offline Banner -->
    <div v-if="isOfflineMode" class="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
      <div class="flex items-center justify-between">
        <div class="flex items-center flex-1">
          <ExclamationTriangleIcon class="w-5 h-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">You're offline — changes will sync later</p>
            <p v-if="lastSyncTime" class="text-xs text-red-700 dark:text-red-300 mt-0.5">Last synced: {{ lastSyncTime }}</p>
          </div>
        </div>
        <span v-if="hasQueuedActions" class="text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded-full ml-2 flex-shrink-0">
          {{ queuedActions.length }} saved
        </span>
      </div>
    </div>

    <!-- Online Recovery Banner (Animated) -->
    <transition name="slide-down">
      <div v-if="!isOfflineMode && wasOffline" class="p-4 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800">
        <div class="flex items-center">
          <CheckCircleIcon class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
          <p class="text-sm font-medium text-green-800 dark:text-green-200">Back online — ready to sync</p>
        </div>
      </div>
    </transition>

    <!-- Execution State Banner -->
    <div v-if="executionStateBanner && !loading" :class="executionStateBanner.class" class="p-4 border-b">
      <div class="flex items-center">
        <InformationCircleIcon class="w-5 h-5 mr-2" :class="executionStateBanner.iconClass" />
        <p class="text-sm font-medium" :class="executionStateBanner.textClass">{{ executionStateBanner.message }}</p>
      </div>
    </div>

    <!-- Error Banner -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
      <div class="flex items-center">
        <ExclamationCircleIcon class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
        <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
      </div>
    </div>

    <!-- Loading State (Skeleton) -->
    <div v-if="loading" class="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
      <!-- Header Skeleton -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4 animate-pulse"></div>
        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse"></div>
      </div>
      <!-- Execution Context Skeleton -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4 animate-pulse"></div>
        <div class="space-y-3">
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse"></div>
          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
        </div>
      </div>
      <!-- Timeline Skeleton -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4 animate-pulse"></div>
        <div class="space-y-4">
          <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          <div class="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    </div>

    <!-- Audit Detail Content -->
    <div v-else-if="assignment && event" class="max-w-4xl mx-auto p-4 lg:p-6 space-y-6">
      <!-- Header Card (Sticky on Mobile) -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6 sticky top-14 lg:static z-10">
        <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-2">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ event?.eventName || assignment.auditName || assignment.auditType || 'Audit' }}</h1>
              <span v-if="hasQueuedActions" class="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded-full">{{ t('audit.auditDetailSavedLocally') }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              <span :class="getStatusBadgeClass(assignment.auditState)" class="px-3 py-1 text-sm font-medium rounded-full">
                {{ assignment.auditState || 'Unknown' }}
              </span>
              <span class="flex items-center">
                <CalendarDaysIcon class="w-4 h-4 mr-1" />
                Due: {{ formatDate(assignment.dueAt) }}
              </span>
              <span v-if="event.relatedOrganization" class="flex items-center">
                <BuildingOfficeIcon class="w-4 h-4 mr-1" />
                {{ event.relatedOrganization.name }}
              </span>
              <span v-if="dueStatus" :class="dueStatus.class" class="px-2.5 py-1 rounded-full text-xs font-medium">
                {{ dueStatus.label }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Next Step Card -->
      <div
        v-if="executionStatus"
        class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6"
      >
        <div
          v-if="hasRecentAutoSubmit"
          class="mb-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2"
        >
          <p class="text-sm font-medium text-green-800 dark:text-green-200">{{ t('audit.auditDetailSubmittedAutomatically') }}</p>
          <p class="text-xs text-green-700 dark:text-green-300 mt-0.5">{{ t('audit.auditDetailYourAuditFormSubmissionWasApplied') }}</p>
        </div>

        <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div class="flex-1">
            <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">{{ t('audit.auditDetailNextStep') }}</p>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white">{{ nextStep.title }}</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ nextStep.description }}</p>
          </div>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" :class="nextStep.phaseClass">
            {{ nextStep.phaseLabel }}
          </span>
        </div>

        <div class="grid gap-2 mt-4" :class="auditJourneyGridClass">
          <div
            v-for="(step, index) in auditJourney"
            :key="step.label"
            class="rounded-lg border p-3"
            :class="step.state === 'done'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
              : step.state === 'current'
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40'"
          >
            <p class="text-xs font-medium uppercase tracking-wide mb-1"
              :class="step.state === 'done'
                ? 'text-green-700 dark:text-green-300'
                : step.state === 'current'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400'"
            >
              Step {{ index + 1 }}
            </p>
            <p class="text-sm font-medium"
              :class="step.state === 'done'
                ? 'text-green-900 dark:text-green-200'
                : step.state === 'current'
                  ? 'text-blue-900 dark:text-blue-200'
                  : 'text-gray-700 dark:text-gray-300'"
            >
              {{ step.label }}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 mt-5" v-if="hasExecutableActions">
          <button
            v-if="executionStatus.canCheckIn"
            @click="requestCheckIn"
            :disabled="actionLoading"
            :aria-label="isOfflineMode ? 'Check in (will be saved locally)' : 'Check in to start audit'"
            class="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {{ actionLoading ? 'Checking in...' : 'Check In' }}
          </button>
          <button
            v-if="effectiveCanSubmit"
            @click="requestSubmit"
            :disabled="actionLoading"
            :aria-label="shouldOpenFormBeforeSubmit ? 'Open linked audit form' : (isOfflineMode ? 'Submit audit (will be saved locally)' : 'Submit audit for review')"
            class="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {{ actionLoading ? submitActionBusyLabel : submitActionLabel }}
          </button>
          <button
            v-if="executionStatus.canApprove"
            @click="requestApprove"
            :disabled="actionLoading || isOfflineMode"
            :aria-label="isOfflineMode ? 'Approve requires online connection' : 'Approve this audit'"
            :title="isOfflineMode ? 'Approve/Reject requires online connection' : 'Approve this audit. This action cannot be undone.'"
            class="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {{ actionLoading ? 'Approving...' : 'Approve' }}
          </button>
          <button
            v-if="executionStatus.canReject"
            @click="requestReject"
            :disabled="actionLoading || isOfflineMode"
            :aria-label="isOfflineMode ? 'Reject requires online connection' : 'Reject this audit'"
            :title="isOfflineMode ? 'Approve/Reject requires online connection' : 'Reject this audit. This action cannot be undone.'"
            class="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            {{ actionLoading ? 'Rejecting...' : 'Reject' }}
          </button>
        </div>
        <div v-else :class="noActionPanelClass">
          <p :class="noActionTitleClass">{{ noActionTitle }}</p>
          <p :class="noActionMessageClass">{{ noActionMessage }}</p>
          <div v-if="hasExecutionAccessBlock" class="mt-3 flex flex-wrap gap-2">
            <button
              @click="handleCopySeatRequest"
              class="px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 active:bg-red-800 transition-colors"
            >{{ t('audit.auditDetailRequestSeat') }}</button>
            <button
              @click="fetchAuditDetail"
              :disabled="loading"
              class="px-3 py-1.5 text-xs rounded-md border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >{{ t('audit.auditDetailRefreshAccess') }}</button>
          </div>
        </div>
      </div>

      <!-- Execution Context Card -->
      <div v-if="executionContext" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('audit.auditDetailExecutionContext') }}</h2>
        <div class="space-y-3">
          <div v-if="executionContext.checkedInAt" class="flex items-center text-sm">
            <CheckCircleIcon class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('audit.auditDetailCheckedIn') }}</span>
            <span class="text-gray-900 dark:text-white font-medium ml-1">{{ formatDateTime(executionContext.checkedInAt) }}</span>
          </div>
          <div v-if="executionContext.checkedOutAt" class="flex items-center text-sm">
            <XCircleIcon class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
            <span class="text-gray-600 dark:text-gray-400">{{ t('audit.auditDetailCheckedOut') }}</span>
            <span class="text-gray-900 dark:text-white font-medium ml-1">{{ formatDateTime(executionContext.checkedOutAt) }}</span>
          </div>
          <div v-if="executionContext.geo" class="flex items-start text-sm">
            <MapPinIcon class="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2 mt-0.5" />
            <div>
              <span class="text-gray-600 dark:text-gray-400">{{ t('audit.auditDetailLocation') }}</span>
              <span class="text-gray-900 dark:text-white font-medium">{{ executionContext.geo.address || 'Recorded' }}</span>
              <a
                v-if="executionContext.geo.latitude && executionContext.geo.longitude"
                :href="`https://maps.google.com/?q=${executionContext.geo.latitude},${executionContext.geo.longitude}`"
                target="_blank"
                class="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-xs"
              >{{ t('audit.auditDetailViewOnMap') }}</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Timeline Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{{ t('audit.auditDetailTimeline') }}</h2>
        <div v-if="timeline.length === 0" class="text-center py-12">
          <ClockIcon class="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p class="text-gray-500 dark:text-gray-400 font-medium">{{ t('audit.auditDetailNoTimelineEventsYet') }}</p>
          <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">{{ timelineEmptyHint }}</p>
        </div>
        <div v-else class="space-y-6">
          <template v-for="(group, groupIndex) in groupedTimeline" :key="groupIndex">
            <!-- Date Header -->
            <div class="flex items-center gap-3">
              <div class="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
              <span class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ group.date }}</span>
              <div class="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
            </div>
            
            <!-- Timeline Items for this date -->
            <div class="space-y-4">
              <div
                v-for="(item, index) in group.items"
                :key="index"
                class="flex gap-4"
              >
                <div class="flex flex-col items-center">
                  <div :class="getTimelineIconClass(item.action)" class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" :aria-label="getTimelineActionLabel(item.action)">
                    <component :is="getTimelineIcon(item.action)" class="w-5 h-5" />
                  </div>
                  <div v-if="index < group.items.length - 1" class="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-2 min-h-[2rem]"></div>
                </div>
                <div class="flex-1 pb-4 min-h-[44px] flex items-start">
                  <div class="flex-1">
                    <p class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ getTimelineActionLabel(item.action) }}
                    </p>
                    <p v-if="item.fromState || item.toState" class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      <span v-if="item.fromState">{{ item.fromState }}</span>
                      <span v-if="item.fromState && item.toState"> → </span>
                      <span v-if="item.toState">{{ item.toState }}</span>
                    </p>
                    <div class="flex items-center gap-2 mt-1">
                      <p v-if="item.actor" class="text-xs text-gray-500 dark:text-gray-500">
                        by {{ item.actor.firstName }} {{ item.actor.lastName }}
                      </p>
                      <span v-if="item.actor" class="text-xs text-gray-400 dark:text-gray-600">•</span>
                      <p class="text-xs text-gray-500 dark:text-gray-500">
                        {{ getRelativeTime(item.createdAt || item.timestamp) }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Sticky Bottom Action Bar (Mobile) -->
    <div
      v-if="executionStatus && hasExecutableActions && !loading"
      class="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-50 shadow-lg"
    >
      <div class="max-w-4xl mx-auto space-y-2">
        <p class="text-xs text-gray-600 dark:text-gray-400 mb-1">{{ nextStep.mobileHint }}</p>
        <button
          v-if="executionStatus.canCheckIn"
          @click="requestCheckIn"
          :disabled="actionLoading"
          :aria-label="isOfflineMode ? 'Check in (will be saved locally)' : 'Check in to start audit'"
          class="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
        >
          <ArrowPathIcon v-if="actionLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
          <span>{{ actionLoading ? 'Checking in...' : 'Check In' }}</span>
        </button>
        <button
          v-if="effectiveCanSubmit"
          @click="requestSubmit"
          :disabled="actionLoading"
          :aria-label="shouldOpenFormBeforeSubmit ? 'Open linked audit form' : (isOfflineMode ? 'Submit audit (will be saved locally)' : 'Submit audit for review')"
          class="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
        >
          <ArrowPathIcon v-if="actionLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
          <span>{{ actionLoading ? submitActionBusyLabel : submitActionLabel }}</span>
        </button>
        <div v-if="executionStatus.canApprove || executionStatus.canReject" class="grid grid-cols-2 gap-2">
          <button
            v-if="executionStatus.canApprove"
            @click="requestApprove"
            :disabled="actionLoading || isOfflineMode"
            :aria-label="isOfflineMode ? 'Approve requires online connection' : 'Approve this audit'"
            :title="isOfflineMode ? 'Approve/Reject requires online connection' : 'Approve this audit. This action cannot be undone.'"
            class="px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
          >
            <ArrowPathIcon v-if="actionLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
            <span>{{ actionLoading ? 'Approving...' : 'Approve' }}</span>
          </button>
          <button
            v-if="executionStatus.canReject"
            @click="requestReject"
            :disabled="actionLoading || isOfflineMode"
            :aria-label="isOfflineMode ? 'Reject requires online connection' : 'Reject this audit'"
            :title="isOfflineMode ? 'Approve/Reject requires online connection' : 'Reject this audit. This action cannot be undone.'"
            class="px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-h-[44px]"
          >
            <ArrowPathIcon v-if="actionLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
            <span>{{ actionLoading ? 'Rejecting...' : 'Reject' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Action Confirmation Dialog -->
    <div
      v-if="actionConfirmDialog.isOpen"
      class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      @click.self="closeActionConfirmDialog"
    >
      <div class="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-5">
        <div class="flex items-start gap-3">
          <div class="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
            <ExclamationTriangleIcon class="w-5 h-5" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ actionConfirmDialog.title }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ actionConfirmDialog.message }}</p>
          </div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button
            @click="closeActionConfirmDialog"
            class="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >{{ t('performance.cancelWizard') }}</button>
          <button
            @click="executeConfirmedAction"
            :class="confirmToneClass"
            class="px-4 py-2 text-sm rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ actionConfirmDialog.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowPathIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MapPinIcon,
  PlusIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useOffline } from '@/composables/useOffline';
import { useNotifications } from '@/composables/useNotifications';
import { initDB, getAuditDetail, saveAuditDetail, getTimeline, saveTimeline } from '@/services/offlineDb.js';
import { enqueueAction, listPendingActions } from '@/services/offlineQueue.js';

const route = useRoute();
const router = useRouter();
const { isOnline, onOnlineChange } = useOffline();
const { success: notifySuccess, error: notifyError, warning: notifyWarning, info: notifyInfo } = useNotifications();

// Track online/offline transitions
onOnlineChange((online) => {
  if (online && wasOffline.value) {
    // Just came back online
    setTimeout(() => {
      wasOffline.value = false;
    }, 3000); // Show recovery banner for 3 seconds
  } else if (!online) {
    wasOffline.value = true;
  }
});

const loading = ref(true);
const actionLoading = ref(false);
const error = ref(null);
const assignment = ref(null);
const event = ref(null);
const executionContext = ref(null);
const executionStatus = ref(null);
const timeline = ref([]);
const queuedActions = ref([]);
const pendingFormResponseId = ref(null);
const wasOffline = ref(false);
const lastSyncTime = ref(null);
const actionConfirmDialog = ref({
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  tone: 'blue',
  action: null
});

const isOfflineMode = computed(() => !isOnline.value);
const hasQueuedActions = computed(() => queuedActions.value.length > 0);
const executionAccess = computed(() => executionStatus.value?.executionAccess || null);
const hasExecutionAccessBlock = computed(() => executionAccess.value && executionAccess.value.allowed === false);
const AUTO_SUBMIT_MARKER_TTL_MS = 2 * 60 * 1000;
const autoSubmitMarkerTs = ref(0);

const getAuditEventIdForMarker = () => {
  const value = route.params.eventId;
  return value ? String(value) : null;
};

const readAutoSubmitMarker = () => {
  const eventId = getAuditEventIdForMarker();
  if (!eventId) return 0;
  try {
    const raw = sessionStorage.getItem(`audit-auto-submit:${eventId}`);
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return parsed;
  } catch (_) {
    return 0;
  }
};

const clearAutoSubmitMarker = () => {
  const eventId = getAuditEventIdForMarker();
  autoSubmitMarkerTs.value = 0;
  if (!eventId) return;
  try {
    sessionStorage.removeItem(`audit-auto-submit:${eventId}`);
  } catch (_) {}
};

const hasRecentAutoSubmit = computed(() => (
  autoSubmitMarkerTs.value > 0 &&
  (Date.now() - autoSubmitMarkerTs.value) < AUTO_SUBMIT_MARKER_TTL_MS
));
const linkedFormIdValue = computed(() => getFormIdValue(event.value?.linkedFormId));
const latestFormResponseId = computed(() => getLatestFormResponseId());
const effectiveCanSubmit = computed(() => Boolean(
  executionStatus.value?.canSubmit &&
  !hasRecentAutoSubmit.value
));
const shouldOpenFormBeforeSubmit = computed(() => Boolean(
  effectiveCanSubmit.value &&
  linkedFormIdValue.value &&
  !latestFormResponseId.value
));
const submitActionLabel = computed(() => (
  shouldOpenFormBeforeSubmit.value ? 'Open Audit Form' : 'Submit Audit'
));
const submitActionBusyLabel = computed(() => (
  shouldOpenFormBeforeSubmit.value ? 'Opening form...' : 'Submitting...'
));
const hasExecutableActions = computed(() => {
  if (!executionStatus.value) return false;
  return Boolean(
    executionStatus.value.canCheckIn ||
    effectiveCanSubmit.value ||
    executionStatus.value.canApprove ||
    executionStatus.value.canReject
  );
});
const noActionPanelClass = computed(() => {
  if (hasExecutionAccessBlock.value) {
    return 'mt-5 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3';
  }
  return 'mt-5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3';
});
const noActionTitleClass = computed(() => (
  hasExecutionAccessBlock.value
    ? 'text-sm text-red-800 dark:text-red-200 font-medium'
    : 'text-sm text-green-800 dark:text-green-200 font-medium'
));
const noActionMessageClass = computed(() => (
  hasExecutionAccessBlock.value
    ? 'text-xs text-red-700 dark:text-red-300 mt-1'
    : 'text-xs text-green-700 dark:text-green-300 mt-1'
));
const noActionTitle = computed(() => (
  hasExecutionAccessBlock.value
    ? (executionAccess.value?.feedback?.title || 'Execution blocked')
    : 'No pending actions'
));
const noActionMessage = computed(() => (
  hasExecutionAccessBlock.value
    ? (executionAccess.value?.feedback?.message || 'You can view this audit, but you cannot execute workflow actions with your current access.')
    : 'This audit is up to date. Use the timeline below if you need a full execution history.'
));
const seatRequestMessage = computed(() => {
  const appName = 'Audit';
  const assignmentName = event.value?.eventName || assignment.value?.auditName || assignment.value?.auditType || 'this audit';
  return `Hi Admin, I need an active execution seat for the ${appName} app. I am currently blocked from checking in on "${assignmentName}". Please grant execution access for my user.`;
});

const dueStatus = computed(() => {
  const dueAt = assignment.value?.dueAt;
  if (!dueAt) return null;

  const now = new Date();
  const dueDate = new Date(dueAt);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((dueDate.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / dayMs);

  if (Number.isNaN(diffDays)) return null;
  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`,
      class: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
    };
  }
  if (diffDays === 0) {
    return {
      label: 'Due today',
      class: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
    };
  }
  if (diffDays <= 2) {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      class: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
    };
  }

  return {
    label: `Due in ${diffDays} days`,
    class: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
  };
});

const normalizeAuditState = () => (assignment.value?.auditState || '').toLowerCase();
const auditJourneyGridClass = computed(() => (
  auditJourney.value.length >= 4
    ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-3'
));

const auditJourney = computed(() => {
  const state = normalizeAuditState();
  const isCompleted = state.includes('closed') || state.includes('approved');
  const isInProgress = state.includes('checked_in') || state.includes('in_progress');
  const isPendingCorrective = state.includes('pending_corrective') || state.includes('corrective');
  const isSubmittedForReview = state.includes('submitted') || state.includes('needs_review');
  const hasReachedReview = isSubmittedForReview || isPendingCorrective || isCompleted;

  return [
    {
      label: 'Start audit',
      state: isInProgress || hasReachedReview ? 'done' : 'current'
    },
    {
      label: 'Submit for review',
      state: hasReachedReview ? 'done' : isInProgress ? 'current' : 'upcoming'
    },
    {
      label: 'Corrective actions',
      state: isPendingCorrective ? 'current' : hasReachedReview ? 'done' : 'upcoming'
    },
    {
      label: 'Final review decision',
      state: isCompleted ? 'done' : (isSubmittedForReview && !isPendingCorrective) ? 'current' : 'upcoming'
    }
  ];
});

const nextStep = computed(() => {
  if (!executionStatus.value) {
    return {
      title: 'Loading next step...',
      description: 'Checking available actions for this audit.',
      mobileHint: 'Preparing actions...',
      phaseLabel: 'Preparing',
      phaseClass: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
    };
  }

  if (hasExecutionAccessBlock.value) {
    return {
      title: executionAccess.value?.feedback?.title || 'Execution access required',
      description: executionAccess.value?.feedback?.message || 'You can view this audit, but cannot execute actions with your current seat entitlement.',
      mobileHint: executionAccess.value?.feedback?.message || 'Execution access is blocked for your account.',
      phaseLabel: 'Action blocked',
      phaseClass: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
    };
  }

  if (executionStatus.value.canCheckIn) {
    return {
      title: 'Check in to begin on-site execution',
      description: isOfflineMode.value
        ? 'You can start now. Check-in will be stored locally and synced when you reconnect.'
        : 'Capture your location and start the audit timeline with a single check-in.',
      mobileHint: 'Next action: Check in to start this audit.',
      phaseLabel: 'Ready to start',
      phaseClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    };
  }

  if (executionStatus.value.canSubmit && hasRecentAutoSubmit.value) {
    return {
      title: 'Finalizing submission...',
      description: 'Your audit form was submitted and we are syncing the latest review state.',
      mobileHint: 'Submission in progress. Refreshing state...',
      phaseLabel: 'Syncing',
      phaseClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
    };
  }

  if (effectiveCanSubmit.value) {
    return {
      title: shouldOpenFormBeforeSubmit.value ? 'Open and complete the linked audit form' : 'Submit this audit for review',
      description: isOfflineMode.value
        ? (shouldOpenFormBeforeSubmit.value
          ? 'You are offline. Reconnect to open the linked form before submitting.'
          : 'You can submit now. The submission will be queued and synced automatically once online.')
        : (shouldOpenFormBeforeSubmit.value
          ? 'Complete the linked form before sending this audit for review.'
          : 'Finish your work and send this audit to reviewers.'),
      mobileHint: shouldOpenFormBeforeSubmit.value
        ? 'Next action: Open the linked form.'
        : 'Next action: Submit when your checks are complete.',
      phaseLabel: 'In progress',
      phaseClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
    };
  }

  if (executionStatus.value.canApprove || executionStatus.value.canReject) {
    return {
      title: 'Review and close the audit',
      description: 'Approve if everything is compliant, or reject to reopen corrective actions.',
      mobileHint: 'Next action: Approve or reject this audit.',
      phaseLabel: 'Needs review',
      phaseClass: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'
    };
  }

  if (normalizeAuditState().includes('pending_corrective') || normalizeAuditState().includes('corrective')) {
    return {
      title: 'Complete corrective actions',
      description: 'Findings are waiting for remediation. Complete corrective actions to resume final review.',
      mobileHint: 'Next action: Resolve open findings.',
      phaseLabel: 'Corrective actions',
      phaseClass: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
    };
  }

  return {
    title: 'Audit is currently completed',
    description: 'No further action is needed right now. Review the timeline for complete history.',
    mobileHint: 'This audit is complete.',
    phaseLabel: 'Completed',
    phaseClass: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
  };
});

const timelineEmptyHint = computed(() => {
  if (!executionStatus.value) return 'Timeline will appear as actions are taken.';
  if (hasExecutionAccessBlock.value) return 'Execution actions are currently blocked for your account.';
  if (executionStatus.value.canCheckIn) return 'Check in to create the first timeline event and begin this audit.';
  if (executionStatus.value.canSubmit && hasRecentAutoSubmit.value) {
    return 'Submission is being finalized. Timeline updates will appear shortly.';
  }
  if (effectiveCanSubmit.value) {
    return shouldOpenFormBeforeSubmit.value
      ? 'Open and complete the linked audit form to continue the workflow.'
      : 'Complete your on-site work, then submit to update the timeline.';
  }
  if (normalizeAuditState().includes('pending_corrective') || normalizeAuditState().includes('corrective')) {
    return 'Corrective actions are in progress. Timeline updates will appear as findings are resolved.';
  }
  if (executionStatus.value.canApprove || executionStatus.value.canReject) return 'Review actions will appear here once a decision is made.';
  return 'Timeline will appear as actions are taken.';
});

const getApiErrorMessage = (err, fallback) => {
  const feedbackMessage = err?.response?.data?.feedback?.message;
  return feedbackMessage || err?.message || fallback;
};

const handleCopySeatRequest = async () => {
  try {
    if (!navigator?.clipboard?.writeText) {
      notifyWarning('Clipboard is not available on this browser.');
      return;
    }
    await navigator.clipboard.writeText(seatRequestMessage.value);
    notifySuccess('Seat request copied. Send it to your administrator.');
  } catch (err) {
    console.error('Failed to copy seat request:', err);
    notifyError('Could not copy request message. Please try again.');
  }
};

const confirmToneClass = computed(() => {
  const tone = actionConfirmDialog.value.tone;
  if (tone === 'red') return 'bg-red-600 hover:bg-red-700 active:bg-red-800';
  if (tone === 'green') return 'bg-green-600 hover:bg-green-700 active:bg-green-800';
  return 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800';
});

const openActionConfirmDialog = ({ title, message, confirmLabel, tone, action }) => {
  actionConfirmDialog.value = {
    isOpen: true,
    title,
    message,
    confirmLabel,
    tone,
    action
  };
};

const closeActionConfirmDialog = () => {
  actionConfirmDialog.value.isOpen = false;
};

const executeConfirmedAction = async () => {
  const action = actionConfirmDialog.value.action;
  closeActionConfirmDialog();
  if (typeof action === 'function') {
    await action();
  }
};

const requestCheckIn = () => {
  openActionConfirmDialog({
    title: 'Start this audit?',
    message: isOfflineMode.value
      ? 'You are offline. Check-in will be saved locally and synced once you reconnect.'
      : 'We will capture your location and start the audit timeline.',
    confirmLabel: 'Start audit',
    tone: 'blue',
    action: handleCheckIn
  });
};

const requestSubmit = () => {
  if (shouldOpenFormBeforeSubmit.value) {
    openActionConfirmDialog({
      title: 'Open linked audit form?',
      message: isOfflineMode.value
        ? 'You are offline. Reconnect to open and complete the linked form before submission.'
        : 'Complete the linked form first, then submit the audit for review.',
      confirmLabel: 'Open form',
      tone: 'blue',
      action: handleSubmit
    });
    return;
  }

  openActionConfirmDialog({
    title: 'Submit audit for review?',
    message: isOfflineMode.value
      ? 'You are offline. Submission will be queued and synced automatically when back online.'
      : 'This will finalize your execution and send it to reviewers.',
    confirmLabel: 'Submit audit',
    tone: 'green',
    action: handleSubmit
  });
};

const requestApprove = () => {
  openActionConfirmDialog({
    title: 'Approve this audit?',
    message: 'Approve only if all required checks are complete. This action cannot be undone.',
    confirmLabel: 'Approve',
    tone: 'green',
    action: handleApprove
  });
};

const requestReject = () => {
  openActionConfirmDialog({
    title: 'Reject this audit?',
    message: 'This will reopen corrective actions and mark the audit as rejected.',
    confirmLabel: 'Reject',
    tone: 'red',
    action: handleReject
  });
};

// Execution State Banner
const executionStateBanner = computed(() => {
  if (!assignment.value) return null;
  
  const state = (assignment.value.auditState || '').toLowerCase();
  
  if (state.includes('ready') || state.includes('start')) {
    return {
      class: 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700',
      icon: 'svg',
      iconClass: 'text-gray-600 dark:text-gray-400',
      textClass: 'text-gray-700 dark:text-gray-300',
      message: 'Ready to start audit'
    };
  } else if (state.includes('checked_in') || state.includes('in_progress')) {
    return {
      class: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
      icon: 'svg',
      iconClass: 'text-blue-600 dark:text-blue-400',
      textClass: 'text-blue-800 dark:text-blue-200',
      message: 'Audit in progress'
    };
  } else if (state.includes('pending_corrective') || state.includes('corrective')) {
    return {
      class: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
      icon: 'svg',
      iconClass: 'text-yellow-600 dark:text-yellow-400',
      textClass: 'text-yellow-800 dark:text-yellow-200',
      message: 'Waiting for corrective actions'
    };
  } else if (state.includes('needs_review') || state.includes('submitted')) {
    return {
      class: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
      icon: 'svg',
      iconClass: 'text-purple-600 dark:text-purple-400',
      textClass: 'text-purple-800 dark:text-purple-200',
      message: 'Needs auditor review'
    };
  } else if (state.includes('closed') || state.includes('approved')) {
    return {
      class: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
      icon: 'svg',
      iconClass: 'text-green-600 dark:text-green-400',
      textClass: 'text-green-800 dark:text-green-200',
      message: 'Audit completed'
    };
  } else if (state.includes('rejected')) {
    return {
      class: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
      icon: 'svg',
      iconClass: 'text-red-600 dark:text-red-400',
      textClass: 'text-red-800 dark:text-red-200',
      message: 'Audit rejected — corrective actions reopened'
    };
  }
  
  return null;
});

// Initialize IndexedDB
const initOfflineDb = async () => {
  try {
    await initDB();
  } catch (err) {
    console.error('[AuditDetail] Failed to initialize IndexedDB:', err);
  }
};

const updateQueuedActions = async () => {
  try {
    const eventId = route.params.eventId;
    const pending = await listPendingActions();
    queuedActions.value = pending.filter(a => a.eventId === eventId);
  } catch (err) {
    console.error('[AuditDetail] Error getting queued actions:', err);
  }
};

const getFormIdValue = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    return value._id || value.id || null;
  }
  return value;
};

const getLatestFormResponseId = () => {
  if (pendingFormResponseId.value) {
    return pendingFormResponseId.value;
  }

  const fromMetadata = event.value?.metadata?.formResponses;
  if (Array.isArray(fromMetadata) && fromMetadata.length > 0) {
    const latest = fromMetadata[fromMetadata.length - 1];
    pendingFormResponseId.value = latest;
    return latest;
  }
  const eventId = route.params.eventId;
  try {
    const stored = sessionStorage.getItem(`audit-form-response:${eventId}`) || null;
    if (stored) {
      pendingFormResponseId.value = stored;
    }
    return stored;
  } catch (_) {
    return null;
  }
};

const resolveAuditEventId = () => {
  const direct = route.params.eventId;
  if (direct && String(direct) !== 'undefined') return String(direct);

  const fromAssignment = assignment.value?.eventId || assignment.value?._id;
  if (fromAssignment && String(fromAssignment) !== 'undefined') return String(fromAssignment);

  const fromEvent = event.value?._id || event.value?.eventId;
  if (fromEvent && String(fromEvent) !== 'undefined') return String(fromEvent);

  const routeMatch = String(route.path || '').match(/\/audit\/audits\/([^/?#]+)/);
  if (routeMatch?.[1]) return routeMatch[1];

  return null;
};

const openAuditForm = ({ formId, responseId = null } = {}) => {
  const resolvedFormId = formId || getFormIdValue(event.value?.linkedFormId);
  const eventId = resolveAuditEventId();
  if (!resolvedFormId) return;
  const returnTo = eventId ? `/audit/audits/${eventId}` : '/audit/audits';

  const query = {
    appKey: 'AUDIT',
    returnTo
  };
  if (eventId) {
    query.eventId = String(eventId);
  }
  if (responseId) {
    pendingFormResponseId.value = String(responseId);
    query.responseId = String(responseId);
    if (eventId) try {
      sessionStorage.setItem(`audit-form-response:${eventId}`, String(responseId));
    } catch (_) {}
  }
  try {
    if (eventId) {
      sessionStorage.setItem(`audit-form-return:${eventId}`, returnTo);
    }
    sessionStorage.setItem(`audit-form-return:form:${resolvedFormId}`, returnTo);
  } catch (_) {}

  router.push({
    path: `/forms/${resolvedFormId}/fill`,
    query
  });
};

const fetchAuditDetail = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    const eventId = route.params.eventId;
    await initOfflineDb();
    
    // If offline, load from IndexedDB
    if (isOfflineMode.value) {
      console.log('[AuditDetail] Offline mode - loading from IndexedDB');
      const cachedDetail = await getAuditDetail(eventId);
      if (cachedDetail) {
        assignment.value = cachedDetail.assignment;
        event.value = cachedDetail.event;
        executionContext.value = cachedDetail.executionContext;
      }
      
      const cachedTimeline = await getTimeline(eventId);
      timeline.value = cachedTimeline;
      
      // Execution status not cached (requires online)
      executionStatus.value = null;
      
      loading.value = false;
      await updateQueuedActions();
      return;
    }
    
    // Online: Fetch from API
    // Fetch assignment detail
    const detailResponse = await apiClient.get(`/audit/assignments/${eventId}`);
    if (detailResponse.success) {
      assignment.value = detailResponse.data.assignment;
      event.value = detailResponse.data.event;
      executionContext.value = detailResponse.data.executionContext;
      pendingFormResponseId.value = getLatestFormResponseId();
      
      // Save to IndexedDB
      await saveAuditDetail(eventId, detailResponse.data);
    }
    
    // Fetch execution status
    const statusResponse = await apiClient.get(`/audit/assignments/${eventId}/execution-status`);
    if (statusResponse.success) {
      executionStatus.value = statusResponse.data;
      if (!statusResponse.data?.canSubmit) {
        clearAutoSubmitMarker();
      }
    }
    
    // Fetch timeline
    const timelineResponse = await apiClient.get(`/audit/assignments/${eventId}/timeline`);
    if (timelineResponse.success) {
      timeline.value = timelineResponse.data.timeline || [];
      
      // Save to IndexedDB
      await saveTimeline(eventId, timeline.value);
    }
  } catch (err) {
    console.error('Error fetching audit detail:', err);
    
    // If network error and offline, try IndexedDB
    if (isOfflineMode.value || err.status === 0) {
      try {
        const eventId = route.params.eventId;
        const cachedDetail = await getAuditDetail(eventId);
        if (cachedDetail) {
          assignment.value = cachedDetail.assignment;
          event.value = cachedDetail.event;
          executionContext.value = cachedDetail.executionContext;
        }
        
        const cachedTimeline = await getTimeline(eventId);
        timeline.value = cachedTimeline;
        
        loading.value = false;
        await updateQueuedActions();
        return;
      } catch (dbError) {
        console.error('[AuditDetail] IndexedDB error:', dbError);
      }
    }
    
    if (err.status === 403) {
      error.value = 'You are not assigned to this audit.';
    } else if (err.status === 404) {
      error.value = 'Audit not found or removed.';
    } else if (err.status === 402) {
      error.value = 'Subscription required. Please contact your administrator.';
    } else if (err.status === 0 || !navigator.onLine) {
      error.value = 'Offline — data may be outdated.';
    } else {
      error.value = err.message || 'Failed to load audit details. Please try again.';
    }
  } finally {
    loading.value = false;
    await updateQueuedActions();
  }
};

const handleCheckIn = async () => {
  actionLoading.value = true;
  let locationData = null;
  try {
    const eventId = route.params.eventId;
    
    // Request location — required for audit check-in (API enforces it)
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000, enableHighAccuracy: true });
        });
        locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
      } catch (geoError) {
        console.warn('Geolocation error:', geoError);
        notifyWarning('Location is required for check-in. Please allow location access and try again.');
        actionLoading.value = false;
        return;
      }
    } else {
      notifyError('Location is required for check-in. This device does not support geolocation.');
      actionLoading.value = false;
      return;
    }
    
    const payload = { location: locationData };
    
    // If offline, queue the action (with location for sync)
    if (isOfflineMode.value) {
      await enqueueAction('CHECK_IN', eventId, payload);
      notifyInfo('Check-in saved locally. It will sync when you are back online.');
      await updateQueuedActions();
      actionLoading.value = false;
      return;
    }
    
    // Online: Execute immediately
    const response = await apiClient.post(`/audit/execute/${eventId}/check-in`, payload);
    if (response.success) {
      await fetchAuditDetail();
      notifySuccess('Checked in successfully.');

      const hasForm = Boolean(response.hasForm || response.data?.hasForm);
      const formResponseId = response.formResponseId || response.data?.formResponseId || null;
      if (formResponseId) {
        pendingFormResponseId.value = String(formResponseId);
      }
      const linkedFormId = getFormIdValue(event.value?.linkedFormId);
      if (hasForm && linkedFormId) {
        openAuditForm({ formId: linkedFormId, responseId: formResponseId });
      }
    }
  } catch (err) {
    console.error('Error checking in:', err);
    
    // If network error, try to queue (reuse location we already obtained)
    if ((err.status === 0 || !navigator.onLine) && locationData) {
      try {
        const eventId = route.params.eventId;
        await enqueueAction('CHECK_IN', eventId, { location: locationData });
        notifyInfo('Check-in saved locally. It will sync when you are back online.');
        await updateQueuedActions();
        actionLoading.value = false;
        return;
      } catch (queueError) {
        console.error('Error queuing check-in:', queueError);
      }
    }
    
    notifyError(getApiErrorMessage(err, 'Failed to check in. Please try again.'));
    if (err?.status === 403) {
      await fetchAuditDetail();
    }
  } finally {
    actionLoading.value = false;
  }
};

const handleSubmit = async () => {
  actionLoading.value = true;
  try {
    const eventId = route.params.eventId;
    const linkedFormId = getFormIdValue(event.value?.linkedFormId);
    const formResponseId = getLatestFormResponseId();

    if (linkedFormId && !formResponseId) {
      notifyInfo('Complete the linked audit form before submitting.');
      openAuditForm({ formId: linkedFormId });
      actionLoading.value = false;
      return;
    }
    
    // If offline, queue the action
    if (isOfflineMode.value) {
      await enqueueAction('SUBMIT', eventId, formResponseId ? { formResponseId } : {});
      notifyInfo('Submission saved locally. It will sync when you are back online.');
      await updateQueuedActions();
      actionLoading.value = false;
      return;
    }
    
    // Online: Execute immediately
    const response = await apiClient.post(
      `/audit/execute/${eventId}/submit`,
      formResponseId ? { formResponseId } : {}
    );
    if (response.success) {
      await fetchAuditDetail();
      notifySuccess('Audit submitted successfully.');
    }
  } catch (err) {
    console.error('Error submitting audit:', err);
    
    // If network error, try to queue
    if (err.status === 0 || !navigator.onLine) {
      try {
        const eventId = route.params.eventId;
        await enqueueAction('SUBMIT', eventId, {});
        notifyInfo('Submission saved locally. It will sync when you are back online.');
        await updateQueuedActions();
        actionLoading.value = false;
        return;
      } catch (queueError) {
        console.error('Error queuing submit:', queueError);
      }
    }
    
    notifyError(getApiErrorMessage(err, 'Failed to submit audit. Please try again.'));
    if (err?.status === 403) {
      await fetchAuditDetail();
    }
  } finally {
    actionLoading.value = false;
  }
};

const handleApprove = async () => {
  // Guard: Approve/Reject never works offline
  if (isOfflineMode.value) {
    notifyWarning('Approve/Reject requires an online connection. Please check your connection and try again.');
    return;
  }

  actionLoading.value = true;
  try {
    const response = await apiClient.post(`/audit/execute/${route.params.eventId}/approve`, {});
    if (response.success) {
      await fetchAuditDetail();
      notifySuccess('Audit approved successfully.');
    }
  } catch (err) {
    console.error('Error approving audit:', err);
    notifyError(getApiErrorMessage(err, 'Failed to approve audit. Please try again.'));
    if (err?.status === 403) {
      await fetchAuditDetail();
    }
  } finally {
    actionLoading.value = false;
  }
};

const handleReject = async () => {
  // Guard: Approve/Reject never works offline
  if (isOfflineMode.value) {
    notifyWarning('Approve/Reject requires an online connection. Please check your connection and try again.');
    return;
  }

  actionLoading.value = true;
  try {
    const response = await apiClient.post(`/audit/execute/${route.params.eventId}/reject`, {});
    if (response.success) {
      await fetchAuditDetail();
      notifyInfo('Audit rejected.');
    }
  } catch (err) {
    console.error('Error rejecting audit:', err);
    notifyError(getApiErrorMessage(err, 'Failed to reject audit. Please try again.'));
    if (err?.status === 403) {
      await fetchAuditDetail();
    }
  } finally {
    actionLoading.value = false;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const getStatusBadgeClass = (state) => {
  const stateLower = (state || '').toLowerCase();
  if (stateLower.includes('ready') || stateLower.includes('start')) {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
  } else if (stateLower.includes('checked_in') || stateLower.includes('in_progress')) {
    return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
  } else if (stateLower.includes('submitted') || stateLower.includes('needs_review')) {
    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200';
  } else if (stateLower.includes('closed') || stateLower.includes('approved')) {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
  } else if (stateLower.includes('rejected')) {
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
};

const getTimelineActionLabel = (action) => {
  const labels = {
    CREATED: 'Audit Created',
    CHECK_IN: 'Checked In',
    CHECK_OUT: 'Checked Out',
    SUBMIT: 'Submitted',
    CORRECTIVE_ACTION_CREATED: 'Corrective Action Created',
    CORRECTIVE_ACTION_COMPLETED: 'Corrective Action Completed',
    APPROVE: 'Approved',
    REJECT: 'Rejected',
    STATUS_CHANGED: 'Status Changed',
    RESCHEDULED: 'Rescheduled',
    CANCELLED: 'Cancelled'
  };
  return labels[action] || action;
};

// Group timeline by date
const groupedTimeline = computed(() => {
  if (!timeline.value || timeline.value.length === 0) return [];
  
  const groups = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  timeline.value.forEach(item => {
    const timestamp = item.createdAt || item.timestamp;
    if (!timestamp) return;
    
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    
    let dateLabel;
    if (date.getTime() === today.getTime()) {
      dateLabel = 'Today';
    } else if (date.getTime() === yesterday.getTime()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
    }
    
    if (!groups[dateLabel]) {
      groups[dateLabel] = [];
    }
    groups[dateLabel].push(item);
  });
  
  // Convert to array and sort by date (newest first)
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      if (a === 'Yesterday') return -1;
      if (b === 'Yesterday') return 1;
      return new Date(b) - new Date(a);
    })
    .map(date => ({
      date,
      items: groups[date]
    }));
});

// Get relative time string
const getRelativeTime = (dateString) => {
  if (!dateString) return 'Unknown time';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks}w ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}mo ago`;
  }
  
  return formatDate(dateString);
};


const getTimelineIconClass = (action) => {
  if (action === 'APPROVE' || action === 'CHECK_IN') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400';
  } else if (action === 'REJECT') {
    return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
  } else if (action === 'SUBMIT') {
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  }
  return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
};

const getTimelineIcon = (action) => {
  if (action === 'CHECK_IN') return MapPinIcon;
  if (action === 'SUBMIT') return DocumentTextIcon;
  if (action === 'APPROVE') return CheckCircleIcon;
  if (action === 'REJECT') return XCircleIcon;
  if (action === 'CORRECTIVE_ACTION_CREATED' || action === 'CORRECTIVE_ACTION_COMPLETED') return Cog6ToothIcon;
  if (action === 'CREATED') return PlusIcon;
  return ClockIcon;
};

onMounted(async () => {
  autoSubmitMarkerTs.value = readAutoSubmitMarker();
  await initOfflineDb();
  await fetchAuditDetail();
  await updateQueuedActions();
  
  // Initialize offline state tracking
  wasOffline.value = !isOnline.value;
});
</script>

<style scoped>
.slide-down-enter-active {
  transition: all 0.3s ease-out;
}

.slide-down-leave-active {
  transition: all 0.3s ease-in;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>

