import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { useNotificationStore } from '@/stores/notifications';
import { useNotificationPreferencesStore } from '@/stores/notificationPreferences';
import { useNotifications } from '@/composables/useNotifications';

export const GROUP_DEFINITIONS = {
  SALES: [
    {
      id: 'audit-lifecycle',
      label: 'Audit lifecycle',
      description: 'Stay informed as audits move through key workflow steps.',
      events: [
        'AUDIT_ASSIGNED',
        'AUDIT_CHECKED_IN',
        'AUDIT_SUBMITTED',
        'AUDIT_APPROVED',
        'AUDIT_REJECTED'
      ]
    },
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Get notified when corrective actions are created or approaching due dates.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments, creation, and key status changes.',
      events: ['TASK_ASSIGNED', 'TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_DUE_SOON']
    },
    {
      id: 'mentions',
      label: 'Mentions',
      description: 'When someone @mentions you in a comment.',
      events: ['RECORD_COMMENT_MENTION']
    },
    {
      id: 'webforms',
      label: 'Webforms',
      description: 'Lead capture form submissions.',
      events: ['WEBFORM_SUBMISSION']
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and account-level updates.',
      events: [
        'USER_ADDED_TO_APP',
        'PORTAL_ACCOUNT_CREATED',
        'SYSTEM_TRIAL_EXPIRING',
        'SYSTEM_SUBSCRIPTION_SUSPENDED'
      ]
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: ['EVIDENCE_UPLOADED']
    }
  ],
  AUDIT: [
    {
      id: 'audit-workflow',
      label: 'Audit workflow',
      description: 'Key steps in the audit workflow.',
      events: [
        'AUDIT_ASSIGNED',
        'AUDIT_CHECKED_IN',
        'AUDIT_SUBMITTED',
        'AUDIT_APPROVED',
        'AUDIT_REJECTED'
      ]
    },
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Corrective actions tied to audits.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments and task status changes.',
      events: ['TASK_ASSIGNED', 'TASK_CREATED', 'TASK_STATUS_CHANGED', 'TASK_DUE_SOON']
    },
    {
      id: 'mentions',
      label: 'Mentions',
      description: 'When someone @mentions you in a comment.',
      events: ['RECORD_COMMENT_MENTION']
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and account-level updates.',
      events: ['USER_ADDED_TO_APP', 'SYSTEM_TRIAL_EXPIRING', 'SYSTEM_SUBSCRIPTION_SUSPENDED']
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: ['EVIDENCE_UPLOADED']
    }
  ],
  PORTAL: [
    {
      id: 'corrective-actions',
      label: 'Corrective actions',
      description: 'Corrective actions and due-date reminders.',
      events: [
        'CORRECTIVE_ACTION_CREATED',
        'CORRECTIVE_ACTION_DUE_SOON',
        'CORRECTIVE_ACTION_OVERDUE'
      ]
    },
    {
      id: 'account-access',
      label: 'Account & access',
      description: 'Account creation and access updates.',
      events: ['PORTAL_ACCOUNT_CREATED', 'USER_ADDED_TO_APP']
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assignments and due-date reminders.',
      events: ['TASK_ASSIGNED', 'TASK_DUE_SOON']
    },
    {
      id: 'system-updates',
      label: 'System updates',
      description: 'Workspace and subscription updates.',
      events: ['SYSTEM_TRIAL_EXPIRING', 'SYSTEM_SUBSCRIPTION_SUSPENDED']
    },
    {
      id: 'uploads',
      label: 'Uploads',
      description: 'When evidence or files are uploaded.',
      events: ['EVIDENCE_UPLOADED']
    }
  ]
};

function eventTypeToLabel(eventType) {
  const map = {
    AUDIT_ASSIGNED: 'Audit assigned',
    AUDIT_CHECKED_IN: 'Audit checked in',
    AUDIT_SUBMITTED: 'Audit submitted',
    AUDIT_APPROVED: 'Audit approved',
    AUDIT_REJECTED: 'Audit rejected',
    CORRECTIVE_ACTION_CREATED: 'Corrective action created',
    CORRECTIVE_ACTION_DUE_SOON: 'Corrective action due soon',
    CORRECTIVE_ACTION_OVERDUE: 'Corrective action overdue',
    TASK_ASSIGNED: 'Task assigned',
    TASK_CREATED: 'Task created',
    TASK_STATUS_CHANGED: 'Task status changed',
    TASK_DUE_SOON: 'Task due soon',
    RECORD_COMMENT_MENTION: 'Mentioned in a comment',
    WEBFORM_SUBMISSION: 'Webform submission',
    EVIDENCE_UPLOADED: 'Evidence uploaded',
    PORTAL_ACCOUNT_CREATED: 'Portal account created',
    USER_ADDED_TO_APP: 'Added to workspace',
    SYSTEM_TRIAL_EXPIRING: 'Trial expiring',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'Subscription suspended',
    LIVE_CHAT_MESSAGE_RECEIVED: 'Live chat message',
    LIVE_CHAT_SESSION_STARTED: 'Live chat started',
    INTERNAL_CHAT_MENTIONED: 'Mentioned in team chat',
    INTERNAL_CHAT_MESSAGE_POSTED: 'Team chat message',
  };

  if (map[eventType]) return map[eventType];

  return eventType
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function eventTypeToDescription(eventType, appKey) {
  const map = {
    AUDIT_ASSIGNED: 'When you are assigned to an audit.',
    AUDIT_CHECKED_IN: 'When an audit is checked in.',
    AUDIT_SUBMITTED: 'When an audit is submitted for review.',
    AUDIT_APPROVED: 'When an audit is approved.',
    AUDIT_REJECTED: 'When an audit is rejected.',
    CORRECTIVE_ACTION_CREATED: 'When a corrective action is created.',
    CORRECTIVE_ACTION_DUE_SOON: 'When a corrective action is approaching its due date.',
    CORRECTIVE_ACTION_OVERDUE: 'When a corrective action passes its due date.',
    TASK_ASSIGNED: 'When a task is assigned to you.',
    TASK_CREATED: 'When a new task is created.',
    TASK_STATUS_CHANGED: 'When the status of a task changes.',
    TASK_DUE_SOON: 'When a task is approaching its due date.',
    RECORD_COMMENT_MENTION: 'When someone mentions you in a comment on a record.',
    WEBFORM_SUBMISSION: 'When a webform you manage receives a new submission.',
    EVIDENCE_UPLOADED: 'When evidence or files are uploaded to an audit.',
    PORTAL_ACCOUNT_CREATED: 'When a new portal account is created.',
    USER_ADDED_TO_APP: 'When you are added to a workspace or module.',
    SYSTEM_TRIAL_EXPIRING: 'When your trial period is about to expire.',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'When your subscription has been suspended.',
    LIVE_CHAT_MESSAGE_RECEIVED: 'When a visitor sends a live chat message.',
    LIVE_CHAT_SESSION_STARTED: 'When a visitor starts a live chat session.',
    INTERNAL_CHAT_MENTIONED: 'When a teammate mentions you in Internal Chat.',
    INTERNAL_CHAT_MESSAGE_POSTED: 'When a teammate messages you in a DM or (if enabled) a channel.',
  };

  if (map[eventType]) return map[eventType];
  if (appKey === 'PORTAL') return 'Portal notification managed by Arivu.';
  if (appKey === 'AUDIT') return 'Audit notification managed by Arivu.';
  return 'Notification managed by Arivu.';
}

let globalToggleDebounceTimer = null;
const perToggleDebounceTimers = new Map();

// Shared across all composable callers (settings shell + sub-views)
const renderKey = ref(0);
const openGroups = ref(new Set());
const pushPermissionStatus = ref('default');

export function useNotificationPreferencesPage() {
  const { t } = useI18n();
  const notificationStore = useNotificationStore();
  const prefsStore = useNotificationPreferencesStore();
  const toast = useNotifications();

  const { loading, saving, error, hasLoaded, lastSavedAt } = storeToRefs(prefsStore);
  const { fetchPreferences, updatePreference, applyOptimisticUpdate } = prefsStore;

  const appPreferences = computed(() => prefsStore.appPreferences);

  const currentAppKey = computed(() => notificationStore.currentAppKey());

  const digestDailyInApp = computed(() => {
    const digest = appPreferences.value?.['DIGEST_DAILY'];
    if (!digest) return false;
    const inApp = digest.inApp;
    if (typeof inApp === 'object' && inApp !== null) return !!inApp.enabled;
    return !!inApp;
  });

  const digestDailyEmail = computed(() => {
    const digest = appPreferences.value?.['DIGEST_DAILY'];
    if (!digest) return false;
    const email = digest.email;
    if (typeof email === 'object' && email !== null) return !!email.enabled;
    return !!email;
  });

  const digestWeeklyEmail = computed(() => {
    const digest = appPreferences.value?.['DIGEST_WEEKLY'];
    if (!digest) return false;
    const email = digest.email;
    if (typeof email === 'object' && email !== null) return !!email.enabled;
    return !!email;
  });

  const channelSummary = computed(() => {
    const appPrefs = appPreferences.value || {};
    const events = Object.values(appPrefs);

    const summary = {
      inApp: { enabled: false, available: true, count: 0, total: 0 },
      email: { enabled: false, available: true, count: 0, total: 0 },
      push: { enabled: false, available: false, count: 0, total: 0 },
      whatsapp: { enabled: false, available: false, count: 0, total: 0 },
      sms: { enabled: false, available: false, count: 0, total: 0 }
    };

    const digestTypes = new Set(['DIGEST_DAILY', 'DIGEST_WEEKLY']);

    Object.entries(appPrefs).forEach(([eventType, event]) => {
      if (digestTypes.has(eventType)) return;

      ['inApp', 'email', 'push', 'whatsapp', 'sms'].forEach((channel) => {
        const channelData = event?.[channel];
        if (!channelData) return;
        if (channelData.available !== false) {
          summary[channel].total += 1;
          if (channelData.enabled) {
            summary[channel].enabled = true;
            summary[channel].count += 1;
          }
        }
        if (channelData.available) summary[channel].available = true;
      });
    });

    return summary;
  });

  const groupedEvents = computed(() => {
    const appKey = currentAppKey.value || 'SALES';
    const raw = appPreferences.value || {};
    const definitions = GROUP_DEFINITIONS[appKey] || [];
    const knownEventTypes = new Set(definitions.flatMap((g) => g.events));
    const result = [];

    for (const group of definitions) {
      const events = group.events
        .map((eventType) => buildEventModel(eventType, raw, appKey, false))
        .filter(Boolean);

      if (events.length > 0) {
        result.push({
          id: group.id,
          label: group.label,
          description: group.description,
          events
        });
      }
    }

    const digestEventTypes = new Set(['DIGEST_DAILY', 'DIGEST_WEEKLY']);
    const unknownEvents = Object.keys(raw)
      .filter((eventType) => !knownEventTypes.has(eventType) && !digestEventTypes.has(eventType))
      .map((eventType) => buildEventModel(eventType, raw, appKey, true));

    if (unknownEvents.length > 0) {
      result.push({
        id: 'system-events',
        label: 'Other system events',
        description: 'Read-only events managed by the system. Channels may be limited.',
        events: unknownEvents
      });
    }

    return result;
  });

  function buildEventModel(eventType, raw, appKey, isUnknown) {
    const conf = raw[eventType] || {};
    const inApp = conf.inApp || {};
    const email = conf.email || {};
    const isMention = eventType === 'RECORD_COMMENT_MENTION';

    return {
      eventType,
      label: eventTypeToLabel(eventType),
      description: eventTypeToDescription(eventType, appKey),
      isUnknown,
      inAppEnabled: typeof inApp === 'object' ? !!inApp.enabled : !!inApp,
      inAppAvailable: typeof inApp === 'object' ? inApp.available !== false : true,
      emailEnabled: typeof email === 'object' ? !!email.enabled : !!email,
      emailAvailable: typeof email === 'object' ? email.available !== false : true,
      pushEnabled: conf.push?.enabled || false,
      pushAvailable: conf.push?.available !== false,
      // Mentions: In-App / Email / Push only — never WhatsApp or SMS
      whatsappEnabled: isMention ? false : (conf.whatsapp?.enabled || false),
      whatsappAvailable: isMention ? false : (conf.whatsapp?.available !== false),
      smsEnabled: isMention ? false : (conf.sms?.enabled || false),
      smsAvailable: isMention ? false : (conf.sms?.available !== false)
    };
  }

  function isGroupOpen(id) {
    return openGroups.value.has(id);
  }

  function toggleGroup(id) {
    const copy = new Set(openGroups.value);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    openGroups.value = copy;
  }

  function expandAllGroups() {
    openGroups.value = new Set(groupedEvents.value.map((g) => g.id));
  }

  function collapseAllGroups() {
    openGroups.value = new Set();
  }

  function openGroupForEvent(eventType) {
    const group = groupedEvents.value.find((g) => g.events.some((e) => e.eventType === eventType));
    if (group) {
      openGroups.value = new Set([...openGroups.value, group.id]);
    }
  }

  const pushStatusText = computed(() => {
    if (pushPermissionStatus.value === 'granted') return 'Active';
    if (pushPermissionStatus.value === 'denied') return 'Denied';
    return 'Not enabled';
  });

  async function handleChannelGlobalToggle(channel, enabled) {
    const appPrefs = appPreferences.value || {};
    const eventTypes = Object.keys(appPrefs);
    const optionalChannels = ['push', 'whatsapp', 'sms'];
    const shouldCheckAvailability = optionalChannels.includes(channel);
    const eventsToToggle = [];

    for (const eventType of eventTypes) {
      const event = appPrefs[eventType];
      const channelData = event?.[channel];
      if (shouldCheckAvailability) {
        if (channelData?.available !== false) eventsToToggle.push(eventType);
      } else {
        eventsToToggle.push(eventType);
      }
    }

    for (const eventType of eventsToToggle) {
      applyOptimisticUpdate({ eventType, channel, enabled });
    }

    renderKey.value += 1;

    if (globalToggleDebounceTimer) {
      clearTimeout(globalToggleDebounceTimer);
      globalToggleDebounceTimer = null;
    }

    globalToggleDebounceTimer = setTimeout(() => {
      for (const eventType of eventsToToggle) {
        updatePreference({ eventType, channel, enabled });
      }
    }, 350);
  }

  function handleToggle(eventType, channel, enabled) {
    const debounceKey = `${eventType}:${channel}`;
    const existingTimer = perToggleDebounceTimers.get(debounceKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      perToggleDebounceTimers.delete(debounceKey);
    }

    const success = applyOptimisticUpdate({ eventType, channel, enabled });
    if (!success) return;

    renderKey.value += 1;

    const timer = setTimeout(() => {
      perToggleDebounceTimers.delete(debounceKey);
      updatePreference({ eventType, channel, enabled });
    }, 250);
    perToggleDebounceTimers.set(debounceKey, timer);
  }

  async function requestPushPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error(t('common.notificationPreferencesToastPushNotificationsAreNotSupported'));
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      pushPermissionStatus.value = permission;
      if (permission === 'granted') await subscribeToPush();
    } catch (err) {
      console.error('[NotificationPreferences] Failed to request push permission:', err);
    }
  }

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const response = await fetch('/api/push/public-key');
      const { publicKey } = await response.json();
      if (!publicKey) return;

      const applicationServerKey = urlBase64ToUint8Array(publicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appKey: currentAppKey.value,
          endpoint: subscription.endpoint,
          keys: {
            p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
            auth: arrayBufferToBase64(subscription.getKey('auth'))
          }
        })
      });
    } catch (err) {
      console.error('[NotificationPreferences] Failed to subscribe to push:', err);
    }
  }

  async function testPushNotification() {
    const currentPermission = Notification.permission;
    if (currentPermission !== 'granted') {
      toast.warning(
        t('common.notificationPreferencesToastPushPermissionRequired', { permission: currentPermission })
      );
      pushPermissionStatus.value = currentPermission;
      return;
    }

    if (!('Notification' in window)) {
      toast.error(t('common.notificationPreferencesToastNotificationsAreNotSupportedIn'));
      return;
    }

    pushPermissionStatus.value = currentPermission;

    try {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.showNotification('Test Notification', {
              body: 'Push notifications are working!',
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'test-notification',
              requireInteraction: false
            });
            toast.success(t('common.notificationPreferencesToastTestNotificationTriggeredCheckYour'));
            return;
          }
        } catch {
          // fall through
        }
      }

      if (!document.hasFocus()) {
        window.focus();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const testTag = `test-notification-${Date.now()}`;
      const notification = new Notification('Test Notification', {
        body: 'Push notifications are working!',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: testTag,
        requireInteraction: true,
        renotify: true,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      window._lastTestNotification = notification;
      setTimeout(() => {
        delete window._lastTestNotification;
      }, 5000);

      toast.success(t('common.notificationPreferencesToastTestNotificationTriggeredIfYou'));
    } catch (err) {
      console.error('[NotificationPreferences] Failed to show test notification:', err);
      toast.error(t('common.notificationPreferencesToastTestNotificationFailedSeeConsole'));
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  async function ensureLoaded() {
    if (!hasLoaded.value) {
      await fetchPreferences();
    }
    const appKey = currentAppKey.value || 'SALES';
    const defs = GROUP_DEFINITIONS[appKey] || [];
    if (defs.length > 0 && openGroups.value.size === 0) {
      openGroups.value = new Set(defs.map((g) => g.id));
    }
    if ('Notification' in window && 'serviceWorker' in navigator) {
      pushPermissionStatus.value = Notification.permission;
    }
  }

  function scrollToHighlightedEvent(eventType) {
    if (!eventType) return;
    openGroupForEvent(eventType);
    setTimeout(() => {
      const el = document.querySelector(`[data-event-type="${eventType}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }

  return {
    loading,
    saving,
    error,
    hasLoaded,
    lastSavedAt,
    appPreferences,
    renderKey,
    openGroups,
    currentAppKey,
    digestDailyInApp,
    digestDailyEmail,
    digestWeeklyEmail,
    channelSummary,
    groupedEvents,
    pushPermissionStatus,
    pushStatusText,
    isGroupOpen,
    toggleGroup,
    expandAllGroups,
    collapseAllGroups,
    openGroupForEvent,
    handleToggle,
    handleChannelGlobalToggle,
    requestPushPermission,
    testPushNotification,
    ensureLoaded,
    scrollToHighlightedEvent
  };
}
