<template>
  <div class="activity-timeline">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
        <p class="mt-4 text-sm text-gray-600 dark:text-gray-400">{{ t('records.activityTimelineLoadingActivities') }}</p>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">{{ t('records.activityTimelineErrorLoadingActivities') }}</h3>
          <p class="text-sm text-red-700 dark:text-red-300">{{ error }}</p>
        </div>
      </div>
    </div>

    <!-- Blocked State (Ambiguous App Context) -->
    <div v-else-if="blocked" class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">{{ t('records.activityTimelineCannotLoadActivities') }}</h3>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            {{ blockedReason || 'App context is ambiguous. Cannot determine which activities to show.' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Activities List -->
    <div v-else-if="mergedActivities && mergedActivities.length > 0" class="space-y-4">
      <div
        v-for="(activity, index) in mergedActivities"
        :key="activity._threadEntry ? `thread-${activity.thread?.threadId}` : (activity.id || activity._optimisticId || index)"
        class="flex items-start gap-3"
      >
        <!-- Timeline Line -->
        <div class="flex-shrink-0 flex flex-col items-center">
          <div class="w-2 h-2 rounded-full bg-indigo-500 mt-1.5"></div>
          <div v-if="index < mergedActivities.length - 1" class="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-1 min-h-[3rem]"></div>
        </div>

        <!-- Thread Entry (comment-style cards) -->
        <div v-if="activity._threadEntry" class="flex-1 min-w-0 pb-4">
          <EmailThreadCard
            :thread="activity.thread"
            :expanded="expandedThreads.has(activity.thread.threadId)"
            :current-user="authStore.user"
            :format-date="formatDate"
            :compact="true"
            @toggle="toggleThread(activity.thread.threadId)"
            @create-task="createTaskFromMessage"
            @create-case="createCaseFromMessage"
            @assign-thread="assignThread"
            @unassign-thread="unassignThread"
            @add-tag="addTagToThread"
            @remove-tag="removeTagFromThread"
            @toggle-done="toggleThreadDone"
          />
        </div>

        <!-- Regular Activity Content -->
        <div v-else class="flex-1 min-w-0 pb-4">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 dark:text-white">
                <span class="font-medium">{{ activity.actor || 'System' }}</span>
                <span class="text-gray-600 dark:text-gray-400"> {{ formatAction(activity) }}</span>
              </p>
              <div class="mt-1 flex items-center gap-2 flex-wrap">
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(activity.createdAt) }}
                </p>
                <!-- App Context Badge -->
                <span 
                  v-if="getAppContext(activity)" 
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                >
                  {{ formatAppName(getAppContext(activity)) }}
                </span>
                <!-- Retry button for failed optimistic email -->
                <button
                  v-if="activity.metadata?.retryPayload"
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
                  @click="emit('retry-optimistic', activity)"
                >{{ t('actions.retry') }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!loading && !error && !blocked" class="text-center py-8">
      <p class="text-sm text-gray-500 dark:text-gray-400 italic">
        No activities found for this {{ entityType }}.
      </p>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref, watch, computed } from 'vue';
import { useRoute } from 'vue-router';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/authRegistry';
import { getHistoryDisplayText, getHistoryAppContext } from './people/historyEventMapping';
import EmailThreadCard from '@/components/communications/EmailThreadCard.vue';

const emit = defineEmits(['retry-optimistic']);

const { t } = useI18n();

const props = defineProps({
  entityType: {
    type: String,
    required: true,
    default: 'Person'
  },
  entityId: {
    type: String,
    required: true
  },
  appKey: {
    type: String,
    default: null
  },
  optimisticActivities: {
    type: Array,
    default: () => []
  }
});

const route = useRoute();
const authStore = useAuthStore();

// State
const loading = ref(true);
const expandedThreads = ref(new Set());

const createTaskFromMessage = async (msg) => {
  if (!msg?._id) return;
  try {
    const res = await apiClient.post(`/communications/${msg._id}/create-task`, {});
    if (res?.success && res?.data?.taskId) {
      window.open(`/tasks/${res.data.taskId}`, '_blank');
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to create task';
  }
};

const createCaseFromMessage = async (msg) => {
  if (!msg?._id) return;
  try {
    const res = await apiClient.post(`/communications/${msg._id}/create-case`, {});
    if (res?.success && res?.data?.caseRecordId) {
      window.open(`/helpdesk/cases/${res.data.caseRecordId}`, '_blank');
    }
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to create case';
  }
};

const assignThread = async ({ threadId, assignedToUserId }) => {
  if (!threadId) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
      assignedToUserId: assignedToUserId || authStore.user?._id || null
    });
    const nextAssignee = res?.data?.data?.assignedToUserId ?? assignedToUserId ?? authStore.user?._id ?? null;
    const meId = authStore.user?._id || authStore.user?.id;
    const meLabel = `${authStore.user?.firstName || ''} ${authStore.user?.lastName || ''}`.trim() || authStore.user?.username || authStore.user?.email || null;
    threads.value = (threads.value || []).map((thread) => {
      if (thread.threadId !== threadId) return thread;
      const isMe = nextAssignee && meId && String(nextAssignee) === String(meId);
      return { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: isMe ? meLabel : (thread.assignedToDisplay || null) };
    });
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to assign thread';
  }
};

const unassignThread = async ({ threadId }) => {
  if (!threadId) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/assign`, {
      assignedToUserId: null
    });
    const nextAssignee = res?.data?.data?.assignedToUserId ?? null;
    threads.value = (threads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, assignedToUserId: nextAssignee, assignedToDisplay: null } : thread
    ));
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to unassign thread';
  }
};

const addTagToThread = async ({ threadId, tag }) => {
  if (!threadId) return;
  if (!tag || !String(tag).trim()) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
      action: 'add',
      tag
    });
    const nextTags = Array.isArray(res?.data?.data?.tags) ? res.data.data.tags : [];
    threads.value = (threads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
    ));
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to add thread tag';
  }
};

const removeTagFromThread = async ({ threadId, tag }) => {
  if (!threadId || !tag) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/tags`, {
      action: 'remove',
      tag
    });
    const nextTags = Array.isArray(res?.data?.data?.tags) ? res.data.data.tags : [];
    threads.value = (threads.value || []).map((thread) => (
      thread.threadId === threadId ? { ...thread, tags: nextTags } : thread
    ));
  } catch (err) {
    error.value = err.response?.data?.message || err.message || 'Failed to remove thread tag';
  }
};

const toggleThread = async (threadId) => {
  const next = new Set(expandedThreads.value);
  if (next.has(threadId)) {
    next.delete(threadId);
  } else {
    next.add(threadId);
    const thread = threads.value?.find((t) => t.threadId === threadId);
    if (thread?.unread) {
      try {
        await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/view`, {});
        threads.value = threads.value.map((t) =>
          t.threadId === threadId ? { ...t, unread: false, lastViewedAt: new Date().toISOString() } : t
        );
      } catch {
        // Non-critical; unread badge may persist until refresh
      }
    }
  }
  expandedThreads.value = next;
};

const toggleThreadDone = async ({ threadId, done }) => {
  if (!threadId) return;
  try {
    const res = await apiClient.patch(`/communications/threads/${encodeURIComponent(threadId)}/done`, { done });
    const doneValue = done !== false && Boolean(res?.data?.done ?? done);
    threads.value = (threads.value || []).map((thread) =>
      thread.threadId === threadId
        ? { ...thread, done: doneValue, doneAt: doneValue ? (res?.data?.doneAt || new Date().toISOString()) : null, unread: doneValue ? false : thread.unread }
        : thread
    );
  } catch (err) {
    error.value = err?.response?.data?.message || err?.message || 'Failed to update thread status';
  }
};

const error = ref(null);
const activities = ref([]);
const threads = ref([]);
const blocked = ref(false);
const blockedReason = ref(null);
const appContext = ref(null);
const inFlightSignature = ref(null);
const lastLoadedSignature = ref(null);

// Map communicationId -> thread for collapse logic
const commIdToThread = computed(() => {
  const map = new Map();
  for (const t of threads.value || []) {
    for (const m of t.messages || []) {
      if (m._id) map.set(String(m._id), t);
    }
  }
  return map;
});

// Merge fetched activities with optimistic; collapse email activities by thread
const mergedActivities = computed(() => {
  const fromApi = activities.value || [];
  const optimistic = props.optimisticActivities || [];
  const combined = optimistic.length > 0
    ? [...optimistic, ...fromApi]
    : fromApi;
  const sorted = [...combined].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const emailActions = new Set(['email_sent', 'email_received']);
  const renderedThreadIds = new Set();
  const out = [];

  for (const a of sorted) {
    const isEmail = emailActions.has(a.action);
    const commId = a.metadata?.communicationId ? String(a.metadata.communicationId) : null;

    if (isEmail && commId) {
      const thread = commIdToThread.value.get(commId);
      if (thread && !renderedThreadIds.has(thread.threadId)) {
        renderedThreadIds.add(thread.threadId);
        const lastAt = thread.lastActivityAt || thread.firstActivityAt || a.createdAt;
        out.push({ _threadEntry: true, thread, createdAt: lastAt });
        continue;
      }
      if (thread) continue; // already rendered this thread
    }

    out.push(a);
  }

  return out.sort((a, b) => {
    const da = a.createdAt || a._threadEntry?.createdAt;
    const db = b.createdAt || b._threadEntry?.createdAt;
    return new Date(db) - new Date(da);
  });
});

// Methods
const loadActivities = async () => {
  const effectiveAppKey = props.appKey || route.query.appKey || null;
  const signature = JSON.stringify({
    entityType: (props.entityType || '').toLowerCase(),
    entityId: props.entityId || '',
    appKey: effectiveAppKey || '',
    routePath: route.path,
    routeName: route.name || ''
  });

  if (inFlightSignature.value === signature) {
    return;
  }
  if (lastLoadedSignature.value === signature && activities.value.length > 0) {
    return;
  }

  try {
    inFlightSignature.value = signature;
    loading.value = true;
    error.value = null;
    blocked.value = false;
    blockedReason.value = null;

    if (!props.entityId) {
      throw new Error('Entity ID is required');
    }

    expandedThreads.value = new Set();

    // Build route info for app context resolution
    const routeInfo = {
      path: route.path,
      name: route.name,
      params: route.params,
      query: route.query,
      meta: route.meta
    };

    const [activityRes, threadsRes] = await Promise.all([
      apiClient.get(`/activity/${props.entityType}/${props.entityId}`, {
        params: {
          routePath: route.path,
          routeName: route.name,
          appKey: effectiveAppKey
        }
      }),
      (() => {
        const et = (props.entityType || '').toLowerCase();
        if (et === 'person') {
          return apiClient.get('/communications/threads', { params: { moduleKey: 'people', recordId: props.entityId, includeDone: true } }).catch(() => ({ success: false, data: { threads: [] } }));
        }
        if (et === 'organization') {
          return apiClient.get('/communications/threads', { params: { moduleKey: 'organizations', recordId: props.entityId, includeDone: true } }).catch(() => ({ success: false, data: { threads: [] } }));
        }
        return Promise.resolve({ success: true, data: { threads: [] } });
      })()
    ]);

    if (activityRes.success && activityRes.data) {
      activities.value = activityRes.data.activities || [];
      appContext.value = activityRes.data.appContext;

      if (activityRes.data.blocked) {
        blocked.value = true;
        blockedReason.value = activityRes.data.reason || 'App context is ambiguous. Cannot determine which activities to show.';
      }
    } else {
      throw new Error('Failed to load activities');
    }

    if (threadsRes.success && threadsRes.data?.threads) {
      threads.value = threadsRes.data.threads;
    } else {
      threads.value = [];
    }
    lastLoadedSignature.value = signature;
  } catch (err) {
    console.error('Error loading activities:', err);
    error.value = err.message || 'Failed to load activities';
  } finally {
    if (inFlightSignature.value === signature) {
      inFlightSignature.value = null;
    }
    loading.value = false;
  }
};

const formatAction = (activity) => {
  if (!activity) return 'performed an action';
  
  const action = activity.action || '';
  const metadata = activity.metadata || {};
  const appContext = activity.appContext;
  
  // Use canonical event mapping
  return getHistoryDisplayText(action, metadata, appContext);
};

// Get app context for activity
const getAppContext = (activity) => {
  return getHistoryAppContext(activity?.action, activity?.appContext);
};

// Format app name for display
const formatAppName = (appKey) => {
  if (!appKey) return '';
  
  const appNames = {
    'SALES': 'Sales',
    'MARKETING': 'Marketing',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects',
    'LMS': 'LMS',
    'Core': 'Core'
  };
  
  return appNames[appKey.toUpperCase()] || appKey;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  try {
    const date = new Date(dateValue);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (e) {
    return String(dateValue);
  }
};

// Watch the request identity once, including initial load, to avoid mount/watch double-fetches.
watch(
  () => [props.entityType, props.entityId, props.appKey || route.query.appKey || null],
  () => {
    if (props.entityId) {
      loadActivities();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
.activity-timeline {
  /* Component-specific styles if needed */
}
</style>
