<template>
  <component
    :is="clickable ? 'button' : 'div'"
    type="button"
    class="pointer-events-auto flex items-start gap-2 rounded-xl shadow-lg border text-left w-full transition-shadow"
    :class="[
      cardClasses,
      isHelpdesk ? 'p-3.5' : 'p-4',
      clickable ? 'cursor-pointer hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-primary-500/30' : ''
    ]"
    :aria-label="clickable ? toast.ariaLabel || toast.primary : undefined"
    @click="clickable ? $emit('activate') : undefined"
  >
    <div class="flex flex-1 items-start gap-3 min-w-0">
      <!-- Helpdesk avatar icon -->
      <span
        v-if="isHelpdesk"
        class="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-sm"
        :class="iconShellClasses"
      >
        <component :is="iconComponent" class="w-5 h-5" :class="iconColorClasses" aria-hidden="true" />
      </span>

      <!-- Simple variant inline icon -->
      <div v-else class="flex-shrink-0 mt-0.5">
        <component :is="iconComponent" class="w-5 h-5" :class="iconColorClasses" aria-hidden="true" />
      </div>

      <div class="flex-1 min-w-0">
        <template v-if="isHelpdesk">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {{ toast.category }}
          </p>
          <p class="mt-0.5 text-sm font-semibold text-neutral-900 dark:text-white leading-snug truncate">
            {{ toast.primary }}
          </p>
          <p
            v-if="toast.secondary"
            class="mt-1 text-xs text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed"
          >
            {{ toast.secondary }}
          </p>
          <p
            v-if="toast.meta"
            class="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-neutral-100 dark:bg-neutral-700/80 text-neutral-600 dark:text-neutral-300"
          >
            {{ toast.meta }}
          </p>
        </template>
        <template v-else>
          <p v-if="toast.category" class="text-[11px] font-medium uppercase tracking-wide mb-0.5" :class="categoryClasses">
            {{ toast.category }}
          </p>
          <p class="text-sm font-medium leading-snug" :class="primaryClasses">
            {{ toast.primary }}
          </p>
          <p
            v-if="toast.secondary"
            class="mt-1 text-xs opacity-90 line-clamp-2"
            :class="secondaryClasses"
          >
            {{ toast.secondary }}
          </p>
        </template>
      </div>
    </div>

    <button
      type="button"
      class="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
      :aria-label="t('notifications.toastDismissAria')"
      @click.stop="$emit('dismiss')"
    >
      <XMarkIcon class="w-4 h-4" aria-hidden="true" />
    </button>
  </component>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  CheckCircleIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  InboxIcon,
  InformationCircleIcon,
  UserCircleIcon,
  UserPlusIcon,
  XCircleIcon
} from '@heroicons/vue/24/solid';
import { XMarkIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  toast: {
    type: Object,
    required: true
  },
  clickable: {
    type: Boolean,
    default: false
  }
});

defineEmits(['dismiss', 'activate']);

const { t } = useI18n();

const isHelpdesk = computed(() => props.toast.variant === 'helpdesk');

const iconComponent = computed(() => {
  const map = {
    user: UserCircleIcon,
    envelope: EnvelopeIcon,
    inbox: InboxIcon,
    userPlus: UserPlusIcon,
    escalation: ArrowTrendingUpIcon,
    clock: ClockIcon,
    exclamation: ExclamationTriangleIcon,
    reopen: ArrowPathIcon,
    bell: BellAlertIcon,
    check: CheckCircleIcon,
    x: XCircleIcon,
    info: InformationCircleIcon
  };
  return map[props.toast.iconKey] || InformationCircleIcon;
});

const iconShellClasses = computed(() => {
  const tone = props.toast.iconTone || 'info';
  const map = {
    info: 'bg-primary-100 dark:bg-primary-900/40',
    success: 'bg-success-100 dark:bg-success-900/40',
    warning: 'bg-warning-100 dark:bg-warning-900/40',
    danger: 'bg-danger-100 dark:bg-danger-900/40',
    neutral: 'bg-neutral-100 dark:bg-neutral-800'
  };
  return map[tone] || map.info;
});

const iconColorClasses = computed(() => {
  if (!isHelpdesk.value) {
    const type = props.toast.variant;
    const map = {
      success: 'text-green-600 dark:text-green-400',
      error: 'text-red-600 dark:text-red-400',
      warning: 'text-yellow-600 dark:text-yellow-400',
      info: 'text-blue-600 dark:text-blue-400'
    };
    return map[type] || map.info;
  }
  const tone = props.toast.iconTone || 'info';
  const map = {
    info: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    warning: 'text-warning-600 dark:text-warning-400',
    danger: 'text-danger-600 dark:text-danger-400',
    neutral: 'text-neutral-600 dark:text-neutral-400'
  };
  return map[tone] || map.info;
});

const cardClasses = computed(() => {
  if (isHelpdesk.value) {
    return 'bg-white dark:bg-gray-800 border-neutral-200 dark:border-neutral-700';
  }
  const type = props.toast.variant;
  const borders = {
    success: 'border-green-200 dark:border-green-800 bg-white dark:bg-gray-800',
    error: 'border-red-200 dark:border-red-800 bg-white dark:bg-gray-800',
    warning: 'border-yellow-200 dark:border-yellow-800 bg-white dark:bg-gray-800',
    info: 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800'
  };
  return borders[type] || borders.info;
});

const primaryClasses = computed(() => {
  const type = props.toast.variant;
  const map = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200'
  };
  return map[type] || map.info;
});

const categoryClasses = computed(() => primaryClasses.value);
const secondaryClasses = computed(() => primaryClasses.value);
</script>
