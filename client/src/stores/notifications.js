import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useAuthStore } from './authRegistry';
import dateUtils from '@/utils/dateUtils';
import { resolveNotificationAppKeyFromPath } from '@/utils/notificationAppKey';
import { alertForHelpdeskNotification } from '@/utils/helpdeskNotificationAlerts';
import {
  caseIdFromHelpdeskNotification,
  helpdeskAlertKindFromNotification
} from '@/utils/helpdeskTabAlerts';
import {
  markHelpdeskTabAlertForCase,
  markHelpdeskTabAlertForNewCase
} from '@/composables/useTabs';

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref([]);
  const unreadCount = ref(0);
  const loading = ref(false);
  const error = ref(null);
  const nextCursor = ref(null);
  const authStore = useAuthStore();

  /** Coalesce duplicate unread preview requests (multiple NotificationBell mounts, strict mode, etc.) */
  let unreadPreviewInFlight = null;
  let lastUnreadPreviewAppKey = '';
  let lastUnreadPreviewAt = 0;
  const UNREAD_PREVIEW_COALESCE_MS = 2000;
  const UNREAD_PREVIEW_FRESH_MS = 60 * 1000;

  const hasUnread = computed(() => unreadCount.value > 0);

  /**
   * Smart Snooze v1 (UI-only)
   * - localStorage-based (device-only, not cross-device)
   * - no backend/API changes
   * - snoozed notifications are hidden from UI lists and excluded from unread badge
   */
  const snoozesByApp = ref({}); // { [appKey]: { [id]: { until: number, wasUnread: boolean, label: string } } }
  const snoozeTimers = new Map(); // key: `${appKey}:${id}` -> timeout

  /**
   * Dismiss v1 (UI-only)
   * - localStorage-based (device-only)
   * - dismissed notifications are hidden from UI lists; marked as read on backend
   */
  const dismissedByApp = ref({}); // { [appKey]: string[] }

  const currentAppKey = () => resolveNotificationAppKeyFromPath();

  function resolveIncomingNotificationAppKey(notification) {
    if (notification?.appKey) return String(notification.appKey);
    const eventType = String(notification?.eventType || '');
    if (eventType.startsWith('CASE_')) return 'HELPDESK';
    return currentAppKey();
  }

  function snoozeStorageKey() {
    const userId = authStore.user?._id || authStore.user?.id || 'anon';
    return `notification_snooze_v1:${userId}`;
  }

  function dismissedStorageKey() {
    const userId = authStore.user?._id || authStore.user?.id || 'anon';
    return `notification_dismissed_v1:${userId}`;
  }

  function unreadPreviewStorageKey(appKey = currentAppKey()) {
    const userId = authStore.user?._id || authStore.user?.id || 'anon';
    return `notification_unread_preview_v1:${userId}:${appKey}`;
  }

  function readCachedUnreadPreview(appKey = currentAppKey()) {
    try {
      const raw = localStorage.getItem(unreadPreviewStorageKey(appKey));
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return null;
      if (Date.now() - Number(parsed.updatedAt || 0) > UNREAD_PREVIEW_FRESH_MS) return null;
      return Math.max(0, Number(parsed.count || 0));
    } catch {
      return null;
    }
  }

  function writeCachedUnreadPreview(appKey, count) {
    try {
      localStorage.setItem(unreadPreviewStorageKey(appKey), JSON.stringify({
        count: Math.max(0, Number(count || 0)),
        updatedAt: Date.now()
      }));
    } catch {
      // localStorage can be unavailable in private browsing; ignore.
    }
  }

  function primeUnreadPreviewFromCache() {
    const appKey = currentAppKey();
    const cached = readCachedUnreadPreview(appKey);
    if (cached === null) return false;
    unreadCount.value = cached;
    lastUnreadPreviewAt = Date.now();
    lastUnreadPreviewAppKey = appKey;
    return true;
  }

  function loadSnoozesFromStorage() {
    try {
      const raw = localStorage.getItem(snoozeStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object') {
        snoozesByApp.value = {};
        return;
      }

      // Prune expired entries
      const now = Date.now();
      const cleaned = {};
      Object.entries(parsed).forEach(([appKey, map]) => {
        if (!map || typeof map !== 'object') return;
        const next = {};
        Object.entries(map).forEach(([id, entry]) => {
          const until = entry?.until;
          if (typeof until === 'number' && until > now) {
            next[id] = {
              until,
              wasUnread: !!entry.wasUnread,
              label: String(entry.label || '')
            };
          }
        });
        if (Object.keys(next).length) cleaned[appKey] = next;
      });
      snoozesByApp.value = cleaned;

      // Schedule unsnooze timers for all loaded entries
      Object.entries(cleaned).forEach(([appKey, map]) => {
        Object.entries(map || {}).forEach(([id, entry]) => {
          if (typeof entry?.until === 'number') {
            scheduleUnsnooze(appKey, id, entry.until);
          }
        });
      });
    } catch (e) {
      console.warn('[notifications] Failed to load snoozes from storage:', e);
      snoozesByApp.value = {};
    }
  }

  function loadDismissedFromStorage() {
    try {
      const raw = localStorage.getItem(dismissedStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object') {
        dismissedByApp.value = {};
        return;
      }
      dismissedByApp.value = parsed;
    } catch (e) {
      console.warn('[notifications] Failed to load dismissed from storage:', e);
      dismissedByApp.value = {};
    }
  }

  function persistDismissedToStorage() {
    try {
      localStorage.setItem(dismissedStorageKey(), JSON.stringify(dismissedByApp.value || {}));
    } catch (e) {
      console.warn('[notifications] Failed to persist dismissed to storage:', e);
    }
  }

  function persistSnoozesToStorage() {
    try {
      localStorage.setItem(snoozeStorageKey(), JSON.stringify(snoozesByApp.value || {}));
    } catch (e) {
      // Never block UI for storage failures
      console.warn('[notifications] Failed to persist snoozes to storage:', e);
    }
  }

  function getSnoozeMap(appKey) {
    const root = snoozesByApp.value || {};
    const map = root[appKey];
    return map && typeof map === 'object' ? map : {};
  }

  function isSnoozed(id, appKey = currentAppKey()) {
    if (!id) return false;
    const entry = getSnoozeMap(appKey)[id];
    return typeof entry?.until === 'number' && entry.until > Date.now();
  }

  function getSnoozedUntil(id, appKey = currentAppKey()) {
    const entry = getSnoozeMap(appKey)[id];
    return typeof entry?.until === 'number' ? entry.until : null;
  }

  function getDismissedSet(appKey = currentAppKey()) {
    const root = dismissedByApp.value || {};
    const arr = root[appKey];
    return Array.isArray(arr) ? new Set(arr) : new Set();
  }

  function isDismissed(id, appKey = currentAppKey()) {
    if (!id) return false;
    return getDismissedSet(appKey).has(String(id));
  }

  function scheduleUnsnooze(appKey, id, until) {
    const key = `${appKey}:${id}`;
    const existing = snoozeTimers.get(key);
    if (existing) clearTimeout(existing);
    const delay = Math.max(0, until - Date.now());
    const t = setTimeout(() => {
      snoozeTimers.delete(key);
      // Remove entry
      const current = snoozesByApp.value || {};
      const map = { ...current[appKey] };
      const entry = map[id];
      delete map[id];
      snoozesByApp.value = { ...current, [appKey]: map };
      persistSnoozesToStorage();

      // If it was unread when snoozed and is still unread, re-add to unread badge
      const item = items.value.find(n => n.id === id);
      const stillUnread = item && !item.readAt;
      if (entry?.wasUnread && stillUnread) {
        unreadCount.value += 1;
      }
    }, delay);
    snoozeTimers.set(key, t);
  }

  function snoozeNotification({ id, until, label }) {
    if (!id || typeof until !== 'number') return;
    const appKey = currentAppKey();
    if (!Object.keys(snoozesByApp.value || {}).length) {
      loadSnoozesFromStorage();
    }
    if (!Object.keys(dismissedByApp.value || {}).length) {
      loadDismissedFromStorage();
    }

    const existingUntil = getSnoozedUntil(id, appKey);
    if (existingUntil && existingUntil > Date.now()) {
      // Already snoozed; update to latest selection
    }

    const item = items.value.find(n => n.id === id);
    const wasUnread = !!(item && !item.readAt);

    // Update unread badge immediately (snoozed notifications do not count)
    if (wasUnread && !isSnoozed(id, appKey) && unreadCount.value > 0) {
      unreadCount.value -= 1;
    }

    const root = snoozesByApp.value || {};
    const map = { ...root[appKey] };
    map[id] = { until, wasUnread, label: String(label || '') };
    snoozesByApp.value = { ...root, [appKey]: map };
    persistSnoozesToStorage();
    scheduleUnsnooze(appKey, id, until);
  }

  async function dismissNotification(id) {
    if (!id) return;
    const appKey = currentAppKey();
    if (!Object.keys(dismissedByApp.value || {}).length) {
      loadDismissedFromStorage();
    }

    await markRead(id);

    const root = dismissedByApp.value || {};
    const arr = root[appKey] || [];
    if (!arr.includes(String(id))) {
      dismissedByApp.value = { ...root, [appKey]: [...arr, String(id)] };
      persistDismissedToStorage();
    }

    items.value = items.value.filter(n => n.id !== id);
  }

  function syncSnoozeUnreadFlags(appKey = currentAppKey()) {
    const root = snoozesByApp.value || {};
    const map = root[appKey];
    if (!map || typeof map !== 'object') return;
    let changed = false;
    const next = { ...map };
    Object.entries(next).forEach(([id, entry]) => {
      const item = items.value.find(n => n.id === id);
      if (item && item.readAt && entry?.wasUnread) {
        next[id] = { ...entry, wasUnread: false };
        changed = true;
      }
    });
    if (changed) {
      snoozesByApp.value = { ...root, [appKey]: next };
      persistSnoozesToStorage();
    }
  }

  const buildQuery = (params = {}) => {
    const search = new URLSearchParams();
    search.set('appKey', currentAppKey());
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        search.set(key, String(value));
      }
    });
    return `/api/notifications?${search.toString()}`;
  };

  const buildHeaders = (extra = {}) => {
    const headers = {
      Accept: 'application/json',
      ...extra
    };
    const token = authStore.user?.token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  };

  async function fetchUnreadPreview(options = {}) {
    if (!authStore.isAuthenticated) return;

    const appKeyAtStart = currentAppKey();
    const now = Date.now();
    if (!options.force) {
      const cached = readCachedUnreadPreview(appKeyAtStart);
      if (cached !== null) {
        unreadCount.value = cached;
        lastUnreadPreviewAt = now;
        lastUnreadPreviewAppKey = appKeyAtStart;
        return;
      }
    }
    if (
      !options.force &&
      lastUnreadPreviewAppKey === appKeyAtStart &&
      now - lastUnreadPreviewAt < UNREAD_PREVIEW_COALESCE_MS
    ) {
      return;
    }
    if (unreadPreviewInFlight) {
      return unreadPreviewInFlight;
    }

    unreadPreviewInFlight = (async () => {
      if (!Object.keys(snoozesByApp.value || {}).length) {
        loadSnoozesFromStorage();
      }
      if (!Object.keys(dismissedByApp.value || {}).length) {
        loadDismissedFromStorage();
      }
      try {
        const res = await fetch(buildQuery({ unreadOnly: true, limit: 1 }), {
          headers: buildHeaders()
        });
        if (!res.ok) return;
        const data = await res.json();

        if (currentAppKey() !== appKeyAtStart) return;

        if (data.unreadCount !== undefined && data.unreadCount !== null) {
          const appKey = currentAppKey();
          const snoozedUnread = Object.values(getSnoozeMap(appKey)).filter(e => e?.wasUnread).length;
          unreadCount.value = Math.max(0, data.unreadCount - snoozedUnread);
          writeCachedUnreadPreview(appKey, unreadCount.value);
        } else {
          const fullRes = await fetch(buildQuery({ unreadOnly: true, limit: 100 }), {
            headers: buildHeaders()
          });
          if (currentAppKey() !== appKeyAtStart) return;
          if (fullRes.ok) {
            const fullData = await fullRes.json();
            const appKey = currentAppKey();
            const list = fullData.items || [];
            unreadCount.value = list.filter(n => !isSnoozed(n.id, appKey)).length;
            writeCachedUnreadPreview(appKey, unreadCount.value);
          } else {
            const list = data.items || [];
            const appKey = currentAppKey();
            unreadCount.value = list.some(n => !isSnoozed(n.id, appKey)) ? 1 : 0;
            writeCachedUnreadPreview(appKey, unreadCount.value);
          }
        }
        lastUnreadPreviewAt = Date.now();
        lastUnreadPreviewAppKey = appKeyAtStart;
      } catch (err) {
        console.error('[notifications] fetchUnreadPreview error:', err);
      }
    })().finally(() => {
      unreadPreviewInFlight = null;
    });

    return unreadPreviewInFlight;
  }

  async function fetchNotifications(options = {}) {
    if (!authStore.isAuthenticated) return;
    if (loading.value) return;
    loading.value = true;
    error.value = null;
    if (!Object.keys(snoozesByApp.value || {}).length) {
      loadSnoozesFromStorage();
    }
    if (!Object.keys(dismissedByApp.value || {}).length) {
      loadDismissedFromStorage();
    }

    const params = {
      unreadOnly: options.unreadOnly ? 'true' : undefined,
      limit: options.limit || 20,
      cursor: options.cursor || null
    };

    try {
      const res = await fetch(buildQuery(params), {
        headers: buildHeaders()
      });
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      const incoming = data.items || [];

      if (!options.cursor) {
        items.value = incoming;
      } else {
        items.value = [...items.value, ...incoming];
      }

      nextCursor.value = data.nextCursor || null;
      const appKey = currentAppKey();
      syncSnoozeUnreadFlags(appKey);
      unreadCount.value = items.value.filter(n => !n.readAt && !isSnoozed(n.id, appKey)).length;
      writeCachedUnreadPreview(appKey, unreadCount.value);
    } catch (err) {
      console.error('[notifications] fetchNotifications error:', err);
      error.value = err.message || 'Failed to load notifications';
    } finally {
      loading.value = false;
    }
  }

  async function markRead(id) {
    if (!id) return;
    if (!authStore.isAuthenticated) return;
    // Optimistic update
    const target = items.value.find(n => n.id === id);
    const wasUnread = target && !target.readAt;
    if (target && !target.readAt) {
      target.readAt = new Date().toISOString();
      // Snoozed notifications are already excluded from unread badge
      if (!isSnoozed(id) && unreadCount.value > 0) unreadCount.value -= 1;
    }

    try {
      const res = await fetch(`/api/notifications/${id}/read?appKey=${currentAppKey()}`, {
        method: 'POST',
        headers: buildHeaders()
      });
      if (!res.ok) throw new Error('Failed to mark read');
    } catch (err) {
      console.error('[notifications] markRead error:', err);
      if (wasUnread && target) {
        // Rollback optimistic change if needed
        target.readAt = null;
        if (!isSnoozed(id)) unreadCount.value += 1;
      }
    }
  }

  async function markAllRead() {
    if (!hasUnread.value) return;
    if (!authStore.isAuthenticated) return;
    const appKey = currentAppKey();

    // Optimistic update
    const previous = items.value.map(n => ({ id: n.id, readAt: n.readAt }));
    items.value.forEach(n => {
      if (!n.readAt) n.readAt = new Date().toISOString();
    });
    const previousUnread = unreadCount.value;
    unreadCount.value = 0;

    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ appKey })
      });
      if (!res.ok) throw new Error('Failed to mark all as read');
    } catch (err) {
      console.error('[notifications] markAllRead error:', err);
      // Roll back optimistic update
      previous.forEach(old => {
        const current = items.value.find(n => n.id === old.id);
        if (current) current.readAt = old.readAt || null;
      });
      unreadCount.value = previousUnread;
    }
  }

  function resetState() {
    items.value = [];
    unreadCount.value = 0;
    nextCursor.value = null;
    error.value = null;
  }

  function formatRelative(date) {
    return dateUtils.fromNow(date);
  }

  /**
   * Handle incoming notification from SSE stream.
   * Deduplicates by id, prepends to list, updates unread count.
   * 
   * @param {Object} notification - Notification payload from SSE
   */
  function handleIncomingNotification(notification) {
    if (!notification || !notification.id) {
      console.warn('[notifications] Invalid incoming notification:', notification);
      return;
    }

    // Deduplicate - check if already exists
    const existingIndex = items.value.findIndex(n => n.id === notification.id);
    if (existingIndex >= 0) {
      // Already exists, skip
      return;
    }

    // Prepend to list (newest first)
    items.value.unshift({
      id: notification.id,
      eventType: notification.eventType,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      entity: notification.entity,
      readAt: null, // New notifications are unread
      createdAt: notification.createdAt
    });

  const appKey = resolveIncomingNotificationAppKey(notification);
  if (!isSnoozed(notification.id, appKey)) {
    unreadCount.value = Math.max(0, Number(unreadCount.value || 0) + 1);
  }

  alertForHelpdeskNotification(notification, { appKey });

  const alertKind = helpdeskAlertKindFromNotification(notification);
  const caseId = caseIdFromHelpdeskNotification(notification);
  if (alertKind && caseId) {
    if (alertKind === 'case') {
      markHelpdeskTabAlertForNewCase(caseId, alertKind);
    } else {
      markHelpdeskTabAlertForCase(caseId, alertKind);
    }
  }

  console.log(`[notifications] Incoming notification: ${notification.id} (${notification.title})`);
  }

  return {
    items,
    unreadCount,
    hasUnread,
    loading,
    error,
    nextCursor,
    fetchUnreadPreview,
    primeUnreadPreviewFromCache,
    fetchNotifications,
    markRead,
    markAllRead,
    resetState,
    formatRelative,
    handleIncomingNotification,
    currentAppKey,
    // Snooze v1
    isSnoozed,
    getSnoozedUntil,
    snoozeNotification,
    // Dismiss v1
    isDismissed,
    dismissNotification
  };
});

