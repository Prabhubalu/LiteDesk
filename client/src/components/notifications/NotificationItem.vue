<template>
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
    <button
      type="button"
      :class="[
        'notification-card w-full flex items-start gap-3 px-3.5 py-3 rounded-xl text-left min-h-[60px]',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900',
        cardSurfaceClass,
        inGroup && 'ml-2 border-l-2 border-l-neutral-200/80 dark:border-l-neutral-700/60 rounded-l-lg pl-3'
      ]"
      @click="handleClick"
      :aria-label="item.title"
    >
      <!-- Icon -->
      <div class="flex-shrink-0 pt-0.5">
        <span
          class="inline-flex items-center justify-center w-9 h-9 rounded-full ring-1 ring-inset"
          :class="iconShellClass"
        >
          <component :is="iconComponent" class="w-[18px] h-[18px]" :class="iconColorClass" />
        </span>
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0" :class="showActions ? 'pr-7' : 'pr-1'">
        <div class="flex items-start gap-2">
          <span
            v-if="isUnread && !inGroup"
            class="mt-[7px] flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400 shadow-[0_0_0_3px_rgba(96,73,231,0.12)]"
            aria-hidden="true"
          />
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <p
                class="text-[13px] leading-snug tracking-[-0.01em]"
                :class="isUnread
                  ? 'font-semibold text-neutral-900 dark:text-white'
                  : 'font-medium text-neutral-600 dark:text-neutral-300'"
              >
                {{ item.title }}
              </p>
              <span
                v-if="isNew"
                class="flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-primary-500 text-white shadow-sm"
              >
                {{ t('notifications.itemNew') }}
              </span>
            </div>

            <p
              v-if="item.body"
              class="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed"
            >
              {{ item.body }}
            </p>

            <div class="mt-2 flex items-center gap-1.5 min-w-0">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset"
                :class="entityChipClass"
              >
                {{ entityLabel }}
              </span>
              <span class="text-neutral-300 dark:text-neutral-600" aria-hidden="true">·</span>
              <span class="text-[11px] tabular-nums text-neutral-400 dark:text-neutral-500 truncate">
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
        </div>
      </div>
    </button>

    <!-- Inline actions (NotificationDrawer only) -->
    <div
      v-if="showActions"
      class="absolute right-2.5 top-2.5 flex items-center gap-0.5 rounded-lg bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm p-0.5 shadow-sm ring-1 ring-neutral-200/80 dark:ring-neutral-700/60 transition-all duration-200"
      :class="actionsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-0.5'"
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
        class="inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-primary-600 dark:text-neutral-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
        class="inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
          class="inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
        class="inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-success-600 dark:text-neutral-500 dark:hover:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        :tabindex="actionsVisible ? 0 : -1"
        :aria-label="t('notifications.acknowledgeAria')"
        :title="t('notifications.acknowledge')"
        @click.stop.prevent="handleResolveAction"
      >
        <CheckCircleIcon class="w-4 h-4" aria-hidden="true" />
      </button>

      <!-- Why am I seeing this -->
      <Popover
        v-slot="{ open: infoOpen, close }"
        class="relative"
      >
        <span v-show="false">{{ syncInfoPopoverOpen(infoOpen) }}</span>
        <PopoverButton
          type="button"
          ref="infoButtonEl"
          class="inline-flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 min-h-[28px] min-w-[28px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          :tabindex="actionsVisible ? 0 : -1"
          :aria-label="t('notifications.whyAmISeeing')"
          @click="onInfoClick"
        >
          <InfoOutlineIcon class="w-4 h-4" aria-hidden="true" />
        </PopoverButton>

        <PopoverPanel
          ref="whyPanelEl"
          class="absolute right-0 top-full mt-2 w-[320px] max-w-[calc(100vw-32px)] rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl shadow-neutral-900/10 dark:shadow-black/20 p-4 z-[100] focus:outline-none"
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

            <div v-if="triggerLine">
              <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ t('notifications.happenedBecause') }}
              </p>
              <p class="mt-1 text-sm text-neutral-900 dark:text-white">
                {{ triggerLine }}
              </p>
            </div>

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

            <div v-if="deliveryLine">
              <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ t('notifications.deliveredVia') }}
              </p>
              <p class="mt-1 text-sm text-neutral-900 dark:text-white">
                {{ deliveryLine }}
              </p>
            </div>

            <div>
              <p class="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ t('notifications.controlHeading') }}
              </p>
              <p class="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
                {{ t('notifications.controlBody') }}
              </p>
              <div class="mt-2 flex flex-col gap-2">
                <router-link
                  v-if="eventType"
                  :to="manageEventLink"
                  class="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  @click="close"
                >
                  {{ t('notifications.manageEventType') }}
                </router-link>
                <router-link
                  to="/settings?tab=notifications&notificationPage=preferences"
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
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import { useTabs } from '@/composables/useTabs';
import { useNotificationStore } from '@/stores/notifications';
import {
  buildNotificationOpenTabOptions,
  getNotificationPath
} from '@/utils/navigateFromNotification';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import {
  BellAlertIcon,
  BoltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  InformationCircleIcon,
  UserPlusIcon
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

const { openTab } = useTabs();
const store = useNotificationStore();
const unavailable = ref(false);
const infoPopoverOpen = ref(false);
function syncInfoPopoverOpen(open) {
  infoPopoverOpen.value = open;
}

const relativeTime = computed(() => store.formatRelative(props.item.createdAt));

const iconComponent = computed(() => {
  const evt = String(props.item?.eventType || '').toUpperCase();
  if (props.item.priority === 'HIGH') return BellAlertIcon;
  if (evt.includes('MENTION')) return UserPlusIcon;
  if (evt.includes('TASK')) return ClipboardDocumentListIcon;
  if (evt.includes('DEAL') || evt.includes('PLAYBOOK')) return BoltIcon;
  if (evt.includes('AUDIT') || evt.includes('CORRECTIVE')) return ClipboardDocumentCheckIcon;
  if (evt.includes('DUE') || evt.includes('OVERDUE') || evt.includes('EXPIRING')) return CalendarDaysIcon;
  if (evt.includes('USER') || evt.includes('PORTAL') || evt.includes('ASSIGNED')) return UserPlusIcon;
  if (props.item.priority === 'LOW') return InformationCircleIcon;
  return CheckCircleIcon;
});

const iconTone = computed(() => {
  if (props.item.priority === 'HIGH') return 'danger';
  const evt = String(props.item?.eventType || '').toUpperCase();
  if (evt.includes('DUE') || evt.includes('OVERDUE') || evt.includes('EXPIRING')) return 'warning';
  if (evt.includes('REJECTED') || evt.includes('SUSPENDED')) return 'danger';
  if (props.item.priority === 'LOW') return 'neutral';
  return 'primary';
});

const iconShellClass = computed(() => {
  const map = {
    primary: 'bg-primary-50 dark:bg-primary-500/10 ring-primary-500/15 dark:ring-primary-400/20',
    success: 'bg-success-50 dark:bg-success-500/10 ring-success-500/15 dark:ring-success-400/20',
    warning: 'bg-warning-50 dark:bg-warning-500/10 ring-warning-500/15 dark:ring-warning-400/20',
    danger: 'bg-danger-50 dark:bg-danger-500/10 ring-danger-500/15 dark:ring-danger-400/20',
    neutral: 'bg-neutral-100 dark:bg-neutral-800 ring-neutral-200/80 dark:ring-neutral-700/60'
  };
  return map[iconTone.value] || map.primary;
});

const iconColorClass = computed(() => {
  const map = {
    primary: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
    neutral: 'text-neutral-500 dark:text-neutral-400'
  };
  return map[iconTone.value] || map.primary;
});

const cardSurfaceClass = computed(() => {
  if (isUnread.value) {
    return [
      'bg-primary-500/[0.035] dark:bg-primary-400/[0.06]',
      'ring-1 ring-primary-500/10 dark:ring-primary-400/15',
      'hover:bg-primary-500/[0.06] dark:hover:bg-primary-400/[0.09]',
      'hover:shadow-[0_2px_8px_-2px_rgba(96,73,231,0.18)]',
      'hover:ring-primary-500/20 dark:hover:ring-primary-400/25'
    ].join(' ');
  }
  return [
    'bg-white dark:bg-neutral-900/50',
    'ring-1 ring-neutral-200/70 dark:ring-neutral-700/50',
    'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40',
    'hover:shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08)] dark:hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)]',
    'hover:ring-neutral-300/70 dark:hover:ring-neutral-600/50'
  ].join(' ');
});

function formatEntityType(type) {
  if (!type) return 'Notification';
  return String(type)
    .split('_')
    .map(w => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

const entityLabel = computed(() => formatEntityType(props.item?.entity?.type));

const entityChipClass = computed(() => {
  const type = String(props.item?.entity?.type || '').toUpperCase();
  const map = {
    TASK: 'bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/20',
    DEAL: 'bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20',
    EVENT: 'bg-amber-50 text-amber-700 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    AUDIT: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    CORRECTIVE_ACTION: 'bg-orange-50 text-orange-700 ring-orange-200/80 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/20'
  };
  return map[type] || 'bg-neutral-100 text-neutral-600 ring-neutral-200/80 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700/60';
});

const eventType = computed(() => props.item?.eventType || null);
const recipientType = computed(() => props.item?.recipientType || null);
const channel = computed(() => props.item?.channel || 'IN_APP');
const ruleId = computed(() => props.item?.ruleId || null);
const hasRuleId = computed(() => !!ruleId.value);

const manageEventLink = computed(() => {
  if (!eventType.value) {
    return { path: '/settings', query: { tab: 'notifications', notificationPage: 'preferences' } };
  }
  return {
    path: '/settings',
    query: {
      tab: 'notifications',
      notificationPage: 'preferences',
      highlight: eventType.value
    }
  };
});

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
    SYSTEM_SUBSCRIPTION_SUSPENDED: 'Your subscription status changed.',
    RECORD_COMMENT_MENTION: 'You were mentioned in a comment.',
    TASK_COMMENT_MENTION: 'You were mentioned in a comment.'
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
  await store.markRead(props.item.id);

  const path = getNotificationPath(props.appKey, props.item.entity);
  if (!path) {
    console.warn('[NotificationItem] No route available for:', {
      appKey: props.appKey,
      entity: props.item.entity
    });
    unavailable.value = true;
    return;
  }

  try {
    openTab(path, buildNotificationOpenTabOptions(props.item.entity));
    emit('navigated');
  } catch (err) {
    console.error('[NotificationItem] Navigation error:', err);
    unavailable.value = true;
  }
}
</script>

<style scoped>
.notification-item {
  animation: notification-item-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.notification-item--new {
  animation: notification-item-in 0.36s cubic-bezier(0.22, 1, 0.36, 1) both,
    notification-item-glow 1.2s ease-out 0.15s both;
}

.notification-card {
  will-change: transform, box-shadow;
}

.group:hover .notification-card {
  transform: translateY(-1px);
}

@keyframes notification-item-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes notification-item-glow {
  0%, 100% {
    filter: none;
  }
  35% {
    filter: drop-shadow(0 0 10px rgba(96, 73, 231, 0.18));
  }
}
</style>

