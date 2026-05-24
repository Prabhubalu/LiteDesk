<template>
  <div v-if="hasCapabilities" class="execution-action-bar">
    <!-- Optional Banner for Blocking States -->
    <div
      v-if="hasBlockingFeedback"
      :class="bannerClasses"
      class="mb-4 p-3 rounded-lg border"
    >
      <div class="flex items-start gap-2">
        <component :is="bannerIcon" class="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div class="flex-1">
          <p v-if="blockingFeedback.title" class="font-semibold text-sm">
            {{ blockingFeedback.title }}
          </p>
          <p class="text-sm">{{ blockingFeedback.message }}</p>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="capability in visibleCapabilities"
        :key="capability.capabilityKey"
        :disabled="!capability.executable || executing"
        :class="buttonClasses(capability)"
        :title="getTooltipText(capability)"
        @click="handleAction(capability)"
        type="button"
      >
        <!-- Phase 1F: Show spinner for executing button -->
        <svg
          v-if="executing && executingCapabilityKey === capability.capabilityKey"
          class="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <component
          v-else-if="getIconComponent(capability.uiHints?.icon)"
          :is="getIconComponent(capability.uiHints?.icon)"
          class="w-4 h-4"
        />
        <span>{{ capability.uiHints?.label || capability.action }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  ArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
  LockClosedIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/vue/24/outline';
import {
  ArrowUpIcon as ArrowUpIconSolid,
  CheckCircleIcon as CheckCircleIconSolid,
  XCircleIcon as XCircleIconSolid,
  LockClosedIcon as LockClosedIconSolid,
  MapPinIcon as MapPinIconSolid
} from '@heroicons/vue/24/solid';

const props = defineProps({
  executionCapabilities: {
    type: Array,
    default: () => []
  },
  appKey: {
    type: String,
    default: null // If null, will be determined from route
  },
  executing: {
    type: Boolean,
    default: false // Phase 1F: Disable buttons while executing
  },
  executingCapabilityKey: {
    type: String,
    default: null // Phase 1F: Track which capability is executing
  }
});

const emit = defineEmits(['action']);

const { t } = useI18n();

const route = useRoute();

// Icon mapping
const iconMap = {
  'paper-plane': ArrowUpIcon, // Using ArrowUpIcon as replacement for PaperPlaneIcon (not available in heroicons v2)
  'check-circle': CheckCircleIcon,
  'x-circle': XCircleIcon,
  'lock-closed': LockClosedIcon,
  'map-pin': MapPinIcon
};

const getIconComponent = (iconName) => {
  if (!iconName) return null;
  return iconMap[iconName] || null;
};

// Determine current app key
const currentAppKey = computed(() => {
  if (props.appKey) return props.appKey.toUpperCase();
  
  // Determine from route
  const path = route.path;
  if (path.startsWith('/audit/')) return 'AUDIT';
  if (path.startsWith('/portal/')) return 'PORTAL';
  return 'SALES';
});

// Filter capabilities based on app-specific rules
const visibleCapabilities = computed(() => {
  if (!props.executionCapabilities || props.executionCapabilities.length === 0) {
    return [];
  }

  const appKey = currentAppKey.value;

  return props.executionCapabilities.filter((capability) => {
    // Sales: Show all discoverable capabilities
    if (appKey === 'SALES') {
      return capability.allowedToDiscover === true;
    }

    // Audit App: Discover actions but never show executable buttons
    if (appKey === 'AUDIT') {
      // Only show if discoverable AND not executable
      return capability.allowedToDiscover === true && capability.allowedToExecute === false;
    }

    // Portal App: Discover limited actions but never execute
    if (appKey === 'PORTAL') {
      // Only show if discoverable AND not executable
      return capability.allowedToDiscover === true && capability.allowedToExecute === false;
    }

    // Default: Show if discoverable
    return capability.allowedToDiscover === true;
  });
});

// Check if there are any capabilities
const hasCapabilities = computed(() => {
  return visibleCapabilities.value.length > 0;
});

// Find blocking feedback (ERROR or WARNING severity)
const blockingFeedback = computed(() => {
  const blocking = visibleCapabilities.value.find(
    (cap) =>
      cap.feedback &&
      (cap.feedback.severity === 'ERROR' || cap.feedback.severity === 'WARNING') &&
      !cap.executable
  );

  return blocking?.feedback || null;
});

const hasBlockingFeedback = computed(() => {
  return blockingFeedback.value !== null;
});

// Banner classes based on severity
const bannerClasses = computed(() => {
  if (!blockingFeedback.value) return '';

  switch (blockingFeedback.value.severity) {
    case 'ERROR':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
    case 'WARNING':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200';
    case 'INFO':
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200';
    default:
      return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200';
  }
});

// Banner icon based on severity
const bannerIcon = computed(() => {
  if (!blockingFeedback.value) return null;

  switch (blockingFeedback.value.severity) {
    case 'ERROR':
    case 'WARNING':
      return ExclamationTriangleIcon;
    case 'INFO':
      return InformationCircleIcon;
    default:
      return InformationCircleIcon;
  }
});

// Button classes based on capability state and UI hints
const buttonClasses = (capability) => {
  const base =
    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  // If disabled, use secondary styling
  if (!capability.executable) {
    return `${base} bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600`;
  }

  // Use UI hints variant if available
  const variant = capability.uiHints?.variant || 'primary';

  switch (variant) {
    case 'primary':
      return `${base} bg-indigo-600 hover:bg-indigo-700 text-white`;
    case 'success':
      return `${base} bg-green-600 hover:bg-green-700 text-white`;
    case 'danger':
      return `${base} bg-red-600 hover:bg-red-700 text-white`;
    case 'secondary':
      return `${base} bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300`;
    default:
      return `${base} bg-indigo-600 hover:bg-indigo-700 text-white`;
  }
};

// Get tooltip text for disabled buttons
const getTooltipText = (capability) => {
  if (capability.executable) {
    return capability.uiHints?.label || capability.action;
  }

  // Show feedback message if available
  if (capability.feedback?.message) {
    return capability.feedback.message;
  }

  // Default disabled message
  return 'This action is not available';
};

// Handle action click
const handleAction = (capability) => {
  if (!capability.executable) {
    return; // Should not happen due to disabled state, but safety check
  }

  // Emit action event with capability details
  emit('action', {
    capabilityKey: capability.capabilityKey,
    action: capability.action,
    domain: capability.domain,
    capability: capability
  });
};
</script>

<style scoped>
.execution-action-bar {
  @apply w-full;
}
</style>

