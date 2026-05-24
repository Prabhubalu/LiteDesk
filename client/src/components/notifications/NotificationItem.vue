<template>
  <!-- Wrapper keeps layout unchanged; icon is absolutely positioned -->
  <div
    class="w-full relative group notification-item"
    :class="[
      { 'notification-item--new': isNew },
      infoPopoverOpen && 'z-50'
    ]"
    @mouseenter="isRowHovered = true"
    @mouseleave="isRowHovered = false"
    @focusin="isRowFocused = true"
    @focusout="isRowFocused = false"
  >
    <!-- Card container -->
    <button
      type="button"
      :class="[
        'w-full flex items-start gap-3 px-3 py-3 rounded-2xl text-left min-h-[56px] transition-all duration-200 ease-out',
        'border border-transparent hover:border-neutral-200/80 dark:hover:border-neutral-600/50',
        'bg-neutral-50/50 dark:bg-neutral-800/30 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60',
        'hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:ring-inset focus:border-primary-500/30',
        inGroup ? 'border-l-[3px] border-l-transparent' : (isUnread ? 'border-l-[3px] border-l-primary-500 pl-[11px]' : 'border-l-[3px] border-l-transparent')
      ]"
      @click="handleClick"
      :aria-label="item.title"
    >
      <!-- Icon avatar -->
      <div class="flex-shrink-0 mt-0.5">
        <span
          class="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-sm"
          :class="[iconBgClass, isUnread && 'ring-2 ring-primary-500/20']"
        >
          <component :is="iconComponent" class="w-5 h-5" :class="iconColorClass" />
        </span>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0 pr-6">
        <!-- Title + New badge -->
        <div class="flex items-start justify-between gap-2">
          <p
            class="text-sm leading-snug"
            :class="item.readAt ? 'text-neutral-600 dark:text-neutral-400 font-medium' : 'font-semibold text-neutral-900 dark:text-white'"
          >
            {{ item.title }}
          </p>
          <span
            v-if="isNew"
            class="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-primary-500/15 text-primary-600 dark:text-primary-400"
          >
            {{ t('notifications.itemNew') }}
          </span>
        </div>

        <!-- Body preview -->
        <p
          v-if="item.body"
          class="mt-1 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed"
        >
          {{ item.body }}
        </p>

        <!-- Metadata row: entity chip + time -->
        <div class="mt-2 flex items-center gap-2 flex-wrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-200/80 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-400">
            {{ entityLabel }}
          </span>
          <span class="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500">
            {{ relativeTime }}
          </span>
        </div>

        <p
          v-if="unavailable"
          class="mt-2 text-xs text-warning-600 dark:text-warning-400"
        >
          {{ t('notifications.itemUnavailable') }}
        </p>
      </div>
    </button>

    <!-- Inline actions (NotificationDrawer only) -->
    <div
      v-if="showActions"
      class="absolute right-3 bottom-3 flex items-center gap-0.5 transition-opacity duration-200"
      :class="actionsVisible ? 'opacity-100' : 'opacity-0'"
      :style="actionsVisible ? '' : 'pointer-events:none;'"
    >
      <!-- Inline feedback (no toast) -->
      <span
        v-if="feedbackText"
        class="absolute -top-7 right-0 text-[11px] text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 shadow-lg px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-600"
        aria-live="polite"
      >
        {{ feedbackText }}
      </span>

      <!-- Mark as read (unread only) -->
      <button
        v-if="isUnread"
        type="button"
        class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 min-h-[32px] min-w-[32px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
        :tabindex="actionsVisible ? 0 : -1"
        :aria-label="t('notifications.markReadAria')"
        :title="t('notifications.markRead')"
        @click.stop.prevent="handleMarkReadAction"
      >
        <CheckIcon class="w-4 h-4" aria-hidden="true" />
      </button>

      <!-- Dismiss -->
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 min-h-[32px] min-w-[32px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
        :tabindex="actionsVisible ? 0 : -1"
        :aria-label="t('notifications.dismissAria')"
        :title="t('notifications.dismiss')"
        @click.stop.prevent="handleDismissAction"
      >
        <XMarkIcon class="w-4 h-4" aria-hidden="true" />
      </button>

      <!-- Snooze (time-based only) -->
      <Popover
        v-if="isTimeBased"
        v-slot="{ close }"
        class="relative"
      >
        <PopoverButton
          type="button"
          ref="snoozeButtonEl"
          class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 min-h-[32px] min-w-[32px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
          :tabindex="actionsVisible ? 0 : -1"
          :aria-label="t('notifications.snoozeAria')"
          :title="t('notifications.snooze')"
        >
          <ClockIcon class="w-4 h-4" aria-hidden="true" />
        </PopoverButton>

        <PopoverPanel
          class="absolute right-0 bottom-full mb-2 w-56 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/10 dark:shadow-black/20 p-2 z-20 focus:outline-none"
        >
          <div class="space-y-1">
            <button
              v-for="opt in snoozeOptions"
              :key="opt.key"
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors duration-150"
              :aria-label="opt.ariaLabel"
              @click="onSelectSnooze(opt, close)"
            >
              <p class="text-sm font-medium text-neutral-900 dark:text-white">
                {{ opt.label }}
              </p>
              <p class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                {{ opt.helpText }}
              </p>
            </button>
          </div>
        </PopoverPanel>
      </Popover>

      <!-- Resolve (resolvable only) -->
      <button
        v-if="isResolvable"
        type="button"
        class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 min-h-[32px] min-w-[32px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20 shadow-sm"
        :tabindex="actionsVisible ? 0 : -1"
        :aria-label="t('notifications.acknowledgeAria')"
        :title="t('notifications.acknowledge')"
        @click.stop.prevent="handleResolveAction"
      >
        <CheckCircleIcon class="w-4 h-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Anchored explainability popover (hidden by default on desktop) -->
    <Popover
      v-slot="{ open: infoOpen, close }"
      class="absolute right-2 top-2"
      :class="iconVisible ? 'opacity-100' : 'opacity-0'"
      :style="iconVisible ? '' : 'pointer-events:none;'"
    >
      <span v-show="false">{{ syncInfoPopoverOpen(infoOpen) }}</span>
      <PopoverButton
        type="button"
        ref="infoButtonEl"
        class="inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-white dark:hover:bg-neutral-700 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        :tabindex="iconVisible ? 0 : -1"
        :aria-label="t('notifications.whyAmISeeing')"
        @click="onInfoClick"
      >
        <InfoOutlineIcon class="w-4 h-4" aria-hidden="true" />
      </PopoverButton>

      <PopoverPanel
        ref="whyPanelEl"
        class="absolute mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/10 dark:shadow-black/20 p-4 z-[100] focus:outline-none"
        :class="panelSide === 'right' ? 'right-0' : 'left-0'"
      >
        <div class="space-y-4">
          <div>
            <p class="text-sm font-semibold text-neutral-900 dark:text-white">
              {{ t('notifications.whyReceived') }}
            </p>
            <p class="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
              {{ t('notifications.whyIntro') }}
            </p>
          </div>

          <!-- Trigger -->
          <div v-if="triggerLine">
            <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {{ t('notifications.happenedBecause') }}
            </p>
            <p class="mt-1 text-sm text-neutral-900 dark:text-white">
              {{ triggerLine }}
            </p>
          </div>

          <!-- Your role -->
          <div v-if="roleLines.length">
            <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {{ t('notifications.receivedBecause') }}
            </p>
            <ul class="mt-1 text-sm text-neutral-900 dark:text-white space-y-1">
              <li v-for="(line, idx) in roleLines" :key="idx" class="flex gap-2">
                <span class="text-neutral-400 dark:text-neutral-500">•</span>
                <span>{{ line }}</span>
              </li>
            </ul>
          </div>

          <!-- Delivery -->
          <div v-if="deliveryLine">
            <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {{ t('notifications.deliveredVia') }}
            </p>
            <p class="mt-1 text-sm text-neutral-900 dark:text-white">
              {{ deliveryLine }}
            </p>
          </div>

          <!-- Control -->
          <div>
            <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {{ t('notifications.controlHeading') }}
            </p>
            <p class="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
              {{ t('notifications.controlBody') }}
            </p>
            <div class="mt-2 flex flex-col gap-2">
              <router-link
                to="/settings?tab=notifications&notificationPage=overview"
                class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                @click="close"
              >
                {{ t('notifications.openSettings') }}
              </router-link>
              <router-link
                v-if="hasRuleId"
                to="/settings?tab=notifications&notificationPage=rules"
                class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                @click="close"
              >
                {{ t('notifications.reviewRules') }}
              </router-link>
            </div>
          </div>
        </div>
      </PopoverPanel>
    </Popover>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

const { t } = useI18n();
import { useTabs } from '@/composables/useTabs';
import { useNotificationStore } from '@/stores/notifications';
import { getNotificationRoute, validateRoute } from '@/utils/notificationRouteMap';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import {
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/solid';
import { InformationCircleIcon as InfoOutlineIcon } from '@heroicons/vue/24/outline';
import {
  CheckIcon,
  ClockIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  appKey: {
    type: String,
    required: true
  },
  showActions: {
    type: Boolean,
    default: false
  },
  isNew: {
    type: Boolean,
    default: false
  },
  inGroup: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['navigated', 'snooze']);

const router = useRouter();
const { openTab } = useTabs();
const store = useNotificationStore();
const unavailable = ref(false);
const infoPopoverOpen = ref(false);
function syncInfoPopoverOpen(open) {
  infoPopoverOpen.value = open;
}

const relativeTime = computed(() => store.formatRelative(props.item.createdAt));

const iconComponent = computed(() => {
  if (props.item.priority === 'HIGH') return BellAlertIcon;
  if (props.item.priority === 'LOW') return InformationCircleIcon;
  return CheckCircleIcon;
});

const iconBgClass = computed(() => {
  if (props.item.priority === 'HIGH') return 'bg-danger-100 dark:bg-danger-900/40';
  if (props.item.priority === 'LOW') return 'bg-secondary-100 dark:bg-secondary-900/40';
  return 'bg-success-100 dark:bg-success-900/40';
});

const iconColorClass = computed(() => {
  if (props.item.priority === 'HIGH') return 'text-danger-600 dark:text-danger-400';
  if (props.item.priority === 'LOW') return 'text-secondary-600 dark:text-secondary-400';
  return 'text-success-600 dark:text-success-400';
});

const entityLabel = computed(() => {
  if (!props.item.entity || !props.item.entity.type) return 'Notification';
  return props.item.entity.type;
});

const eventType = computed(() => props.item?.eventType || null);
const recipientType = computed(() => props.item?.recipientType || null);
const channel = computed(() => props.item?.channel || 'IN_APP');
const ruleId = computed(() => props.item?.ruleId || null);
const hasRuleId = computed(() => !!ruleId.value);

function formatChannel(ch) {
  const normalized = String(ch || '').toUpperCase();
  const map = {
    IN_APP: 'In-app',
    INAPP: 'In-app',
    EMAIL: 'Email',
    PUSH: 'Push',
    WHATSAPP: 'WhatsApp',
    SMS: 'SMS'
  };
  return map[normalized] || 'In-app';
}

function triggerFromEventType(evt) {
  const t = String(evt || '').toUpperCase();
  const map = {
    TASK_ASSIGNED: 'A task was assigned.',
    TASK_CREATED: 'A task was created.',
    TASK_STATUS_CHANGED: 'A task was updated.',
    TASK_DUE_SOON: 'A task is due soon.',
    AUDIT_ASSIGNED: 'An audit was assigned.',
    AUDIT_CHECKED_IN: 'An audit was checked in.',
    AUDIT_SUBMITTED: 'An audit was submitted for review.',
    AUDIT_APPROVED: 'An audit was approved.',
    AUDIT_REJECTED: 'An audit was rejected.',
    CORRECTIVE_ACTION_CREATED: 'A corrective action was created.',
    CORRECTIVE_ACTION_DUE_SOON: 'A corrective action is due soon.',
    CORRECTIVE_ACTION_OVERDUE: 'A corrective action is overdue.',
    EVIDENCE_UPLOADED: 'Evidence or files were uploaded.',
    PORTAL_ACCOUNT_CREATED: 'A portal account was created.',
    USER_ADDED_TO_APP: 'Access was updated in your workspace.',
    SYSTEM_TRIAL_EXPIRING: 'Your trial is approaching its end.',
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'Your subscription status changed.'
  };
  if (map[t]) return map[t];
  if (t.startsWith('SYSTEM_')) return 'A system update occurred.';
  return 'An update occurred in your workspace.';
}

function roleLinesFromMetadata({ recipientTypeValue, ruleIdValue }) {
  const lines = [];
  const rt = String(recipientTypeValue || '').toUpperCase();

  if (ruleIdValue) {
    lines.push('Triggered by one of your notification rules.');
  }

  if (rt.includes('ASSIGNEE')) lines.push('An assignee.');
  else if (rt.includes('OWNER')) lines.push('An owner.');
  else if (rt.includes('MENTION')) lines.push('Mentioned.');
  else if (rt.includes('RULE')) lines.push('Matched a notification rule.');
  else if (rt.includes('SYSTEM')) lines.push('A default recipient for this type of update.');

  // If we still have nothing, keep it calm and non-technical.
  if (lines.length === 0) {
    lines.push('A relevant participant.');
  }

  // Deduplicate while preserving order
  return [...new Set(lines)];
}

const triggerLine = computed(() => triggerFromEventType(eventType.value));
const deliveryLine = computed(() => formatChannel(channel.value));
const roleLines = computed(() => roleLinesFromMetadata({ recipientTypeValue: recipientType.value, ruleIdValue: ruleId.value }));

// Popover positioning (lightweight flip to keep in viewport)
const infoButtonEl = ref(null);
const whyPanelEl = ref(null);
const panelSide = ref('right'); // 'right' (default) or 'left'

// Visibility behavior:
// - Desktop: hidden unless row hover or focus
// - Touch (coarse pointer): always visible
const isRowHovered = ref(false);
const isRowFocused = ref(false);
const isCoarsePointer = ref(false);

let coarseMedia = null;
function syncCoarsePointer() {
  if (!coarseMedia) return;
  isCoarsePointer.value = !!coarseMedia.matches;
}

onMounted(() => {
  if (typeof window === 'undefined' || !window.matchMedia) return;
  coarseMedia = window.matchMedia('(pointer: coarse)');
  syncCoarsePointer();
   
  const handler = () => syncCoarsePointer();
  coarseMedia.addEventListener?.('change', handler);
  // Safari fallback
  coarseMedia.addListener?.(handler);
});

onBeforeUnmount(() => {
  if (!coarseMedia) return;
   
  const handler = () => syncCoarsePointer();
  coarseMedia.removeEventListener?.('change', handler);
  coarseMedia.removeListener?.(handler);
  coarseMedia = null;
});

const iconVisible = computed(() => {
  return isCoarsePointer.value || isRowHovered.value || isRowFocused.value;
});

// Actions follow the same reveal rules as the info icon
const actionsVisible = computed(() => iconVisible.value);

function computePanelSide() {
  const toEl = (maybe) => {
    if (!maybe) return null;
    // Headless UI components may return component instances via ref
    if (maybe.$el) return maybe.$el;
    return maybe;
  };

  const panelEl = toEl(whyPanelEl.value);
  if (!panelEl || typeof panelEl.getBoundingClientRect !== 'function') return;

  const panelRect = panelEl.getBoundingClientRect();
  const viewportW = window.innerWidth || document.documentElement.clientWidth;

  // If we overflow on the left, align panel to the left edge of the icon.
  if (panelRect.left < 8) {
    panelSide.value = 'left';
    return;
  }
  // If we overflow on the right, align panel to the right edge of the icon.
  if (panelRect.right > viewportW - 8) {
    panelSide.value = 'right';
  }
}

async function onInfoClick() {
  // Default to right-aligned (opens to the left), then adjust after panel renders.
  panelSide.value = 'right';
  try {
    await nextTick();
    // Two passes helps when transitions/layout settle.
    computePanelSide();
    requestAnimationFrame(() => computePanelSide());
  } catch (e) {
    // Never block interaction if measurement fails
    console.warn('[NotificationItem] Popover positioning failed:', e);
  }
}

const isUnread = computed(() => !props.item?.readAt);

const isTimeBased = computed(() => {
  const t = String(eventType.value || '').toUpperCase();
  return t.includes('DUE_SOON') || t.includes('OVERDUE') || t.includes('EXPIRING');
});

const isResolvable = computed(() => {
  const entType = String(props.item?.entity?.type || '').toUpperCase();
  // Best-effort: treat corrective actions as resolvable items (user can address/close them).
  return entType === 'CORRECTIVE_ACTION';
});

async function handleMarkReadAction() {
  await store.markRead(props.item.id);
  flashFeedback(t('notifications.feedbackMarkedRead'));
}

async function handleDismissAction() {
  flashFeedback(t('notifications.feedbackDismissed'));
  await store.dismissNotification(props.item.id);
}

function handleSnoozeAction() {
  // replaced by smart snooze popover
}

async function handleResolveAction() {
  // “Resolve” is a lightweight acknowledgement: mark as read (no new APIs).
  await store.markRead(props.item.id);
  flashFeedback(t('notifications.feedbackAcknowledged'));
}

const feedbackText = ref('');
let feedbackTimer = null;
function flashFeedback(text) {
  feedbackText.value = text;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedbackText.value = '';
    feedbackTimer = null;
  }, 1200);
}

// Smart Snooze v1 (UI-only): fixed set of options
const snoozeButtonEl = ref(null);

function parseDueAt() {
  const raw =
    props.item?.dueAt ||
    props.item?.deadlineAt ||
    props.item?.entity?.dueAt ||
    props.item?.entity?.deadlineAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function nextBusinessMorning(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

function getUntilTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return nextBusinessMorning(d);
}

function getUntilNextWeek() {
  const d = new Date();
  // Next Monday 9am
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return nextBusinessMorning(d);
}

function focusSnoozeButton() {
  const maybe = snoozeButtonEl.value;
  const el = maybe?.$el || maybe;
  if (el && typeof el.focus === 'function') el.focus();
}

const snoozeOptions = computed(() => {
  const now = Date.now();
  const dueAt = parseDueAt();
  const opts = [
    {
      key: '1h',
      label: t('notifications.snoozeOneHour'),
      helpText: t('notifications.snoozeOneHourHelp'),
      until: new Date(now + 60 * 60 * 1000)
    },
    {
      key: 'tomorrow',
      label: t('notifications.snoozeTomorrow'),
      helpText: t('notifications.snoozeTomorrowHelp'),
      until: getUntilTomorrow()
    },
    {
      key: 'nextweek',
      label: t('notifications.snoozeNextWeek'),
      helpText: t('notifications.snoozeNextWeekHelp'),
      until: getUntilNextWeek()
    }
  ];

  if (dueAt && dueAt.getTime() > now) {
    opts.push({
      key: 'duedate',
      label: t('notifications.snoozeDueDate'),
      helpText: t('notifications.snoozeDueDateHelp'),
      until: dueAt
    });
  }

  return opts.map(o => ({
    ...o,
    ariaLabel: t('notifications.snoozeOptionAria', { label: o.label })
  }));
});

function onSelectSnooze(opt, closePopover) {
  const untilMs = opt.until.getTime();
  const label = opt.label;

  flashFeedback(`Snoozed ${label === '1 hour' ? 'for 1 hour' : `until ${label.toLowerCase().replace('until ', '')}`}`);

  // Close popover and return focus to trigger
  closePopover?.();
  nextTick(() => focusSnoozeButton());

  // Slight delay so the inline feedback can be perceived before the row disappears.
  setTimeout(() => {
    emit('snooze', { id: props.item.id, until: untilMs, label });
  }, 200);
}

async function handleClick() {
  // Optimistically mark as read
  await store.markRead(props.item.id);

  // Get route from centralized map
  const route = getNotificationRoute(props.appKey, props.item.entity);
  
  if (!route) {
    console.warn('[NotificationItem] No route available for:', {
      appKey: props.appKey,
      entity: props.item.entity
    });
    unavailable.value = true;
    return;
  }

  // Validate route exists before navigating
  if (!validateRoute(router, route)) {
    console.warn('[NotificationItem] Route validation failed:', route);
    unavailable.value = true;
    return;
  }

  try {
    const resolved = router.resolve(route);
    const path = resolved.path;
    const recordName = props.item.entity?.title || props.item.entity?.name;
    openTab(path, recordName ? { title: recordName, params: { name: recordName }, insertAdjacent: true } : { insertAdjacent: true });
    emit('navigated');
  } catch (err) {
    console.error('[NotificationItem] Navigation error:', err);
    unavailable.value = true;
  }
}
</script>

<style scoped>
.notification-item {
  animation: notification-item-in 0.3s ease-out both;
}

.notification-item--new {
  animation: notification-item-in 0.4s ease-out both, notification-item-new 0.6s ease-out 0.2s both;
}

@keyframes notification-item-in {
  from {
    opacity: 0;
    transform: translateY(-2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes notification-item-new {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.95;
  }
}
</style>

