<!--
  Status Dropdown Component
  
  Provides inline editing for Lead Status and Contact Status on ParticipationCard.
  Status is scoped ONLY to the Sales participation.
-->

<template>
  <div class="relative inline-block">
    <!-- Clickable Status Badge -->
    <button
      v-if="isEditable"
      @click="toggleDropdown"
      :id="statusBadgeId"
      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
      :class="badgeStyle ? '' : flagClasses"
      :style="badgeStyle || undefined"
    >
      <svg v-if="icon" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path :d="iconPath" fill-rule="evenodd" clip-rule="evenodd" />
      </svg>
      {{ label }}
      <svg class="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    
    <!-- Non-editable Status Badge (fallback) -->
    <div
      v-else
      :id="statusBadgeId"
      class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
      :class="badgeStyle ? '' : flagClasses"
      :style="badgeStyle || undefined"
    >
      <svg v-if="icon" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path :d="iconPath" fill-rule="evenodd" clip-rule="evenodd" />
      </svg>
      {{ label }}
    </div>

    <!-- Dropdown Menu (positioned above button, scrolls with page) -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showDropdown && isEditable"
        ref="dropdownRef"
        class="absolute z-[100] bottom-full mb-1 left-0 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
      >
        <button
          v-for="statusOption in statusOptions"
          :key="statusOption.value"
          @click="handleStatusSelect(statusOption.value)"
          :disabled="updating || statusOption.value === currentValue"
          class="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
        >
          <span class="inline-flex items-center gap-2 min-w-0">
            <span
              v-if="statusOption.color"
              class="w-2.5 h-2.5 rounded-full flex-shrink-0"
              :style="{ backgroundColor: statusOption.color }"
            />
            <span class="truncate">{{ statusOption.label }}</span>
          </span>
          <svg
            v-if="statusOption.value === currentValue"
            class="w-4 h-4 text-indigo-600 dark:text-indigo-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
      </Transition>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import { ref, computed, watch, onUnmounted } from 'vue';
import apiClient from '@/utils/apiClient';
import { usePeopleModuleFields } from '@/composables/usePeopleModuleFields';
import {
  defaultPicklistFallback,
  getPeoplePicklistOptions,
} from '@/utils/peopleModuleFieldUtils';
import { picklistBadgeStyle } from '@/utils/peopleParticipationPicklistColors';

const props = defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['info', 'warning', 'danger', 'success'].includes(value)
  },
  label: {
    type: String,
    required: true
  },
  icon: {
    type: Boolean,
    default: true
  },
  appKey: {
    type: String,
    required: true
  },
  participationType: {
    type: String,
    required: true // 'Lead' or 'Contact'
  },
  currentStatus: {
    type: String,
    default: null
  },
  personId: {
    validator: (v) => v === null || typeof v === 'string',
    default: null
  },
  statusBadgeId: {
    type: String,
    default: null
  },
  derivedStatus: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['status-updated']);

const showDropdown = ref(false);
const updating = ref(false);
const dropdownRef = ref(null);
const { fields: peopleModuleFields } = usePeopleModuleFields();

// Determine if status is editable
// Status is read-only when derivedStatus exists (system-owned)
// Legacy mode: editable when derivedStatus is null
const isEditable = computed(() => {
  // Cannot edit without personId (e.g. when route has changed but view is still mounted)
  if (!props.personId) return false;
  // If derivedStatus exists, status is system-owned (read-only)
  if (props.derivedStatus != null && props.derivedStatus !== '') {
    return false;
  }
  
  // Legacy mode: allow editing for SALES Lead/Contact
  return props.appKey === 'SALES' && 
         (props.participationType === 'Lead' || props.participationType === 'Contact');
});

// Valid status options from People module definition (Settings → Modules & Fields)
const statusOptions = computed(() => {
  const fieldKey = props.participationType === 'Lead' ? 'lead_status' : 'contact_status';
  return getPeoplePicklistOptions(
    peopleModuleFields.value,
    fieldKey,
    defaultPicklistFallback(fieldKey)
  );
});

const badgeStyle = computed(() => {
  const value = currentValue.value;
  if (!value) return null;
  const option = statusOptions.value.find((opt) => opt.value === value);
  return picklistBadgeStyle(option?.color);
});

// Current status value (extract from label if needed)
const currentValue = computed(() => {
  if (props.currentStatus) return props.currentStatus;
  
  // Extract status from label (e.g., "Lead: New" -> "New")
  // Handle "No status" case
  if (props.label.includes(':')) {
    const statusPart = props.label.split(':')[1].trim();
    if (statusPart === 'No status') {
      return null;
    }
    return statusPart;
  }
  return null;
});

// Icon paths
const iconPaths = {
  warning: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
  danger: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
  success: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
  info: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z'
};

const iconPath = computed(() => {
  return iconPaths[props.type] || iconPaths.info;
});

// Flag styling classes
const flagClasses = computed(() => {
  const classes = {
    warning: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 border border-warning-200 dark:border-warning-800',
    danger: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800',
    success: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border border-success-200 dark:border-success-800',
    info: 'bg-info-50 dark:bg-info-900/20 text-info-700 dark:text-info-300 border border-info-200 dark:border-info-800'
  };
  return classes[props.type] || classes.info;
});

// Handle status selection
const handleStatusSelect = async (newStatus) => {
  if (updating.value || newStatus === currentValue.value || !props.personId) {
    showDropdown.value = false;
    return;
  }

  try {
    updating.value = true;
    
    // Determine field name based on participation type
    const fieldName = props.participationType === 'Lead' ? 'lead_status' : 'contact_status';
    
    // Update via API
    const response = await apiClient.put(`/people/${props.personId}/update-app-fields`, {
      appKey: props.appKey,
      formData: {
        [fieldName]: newStatus
      }
    });

    if (response.success) {
      // Emit event to parent to refresh profile data
      emit('status-updated', {
        fieldName,
        newStatus,
        appKey: props.appKey
      });
      
      // Close dropdown
      showDropdown.value = false;
    } else {
      console.error('Failed to update status:', response.message);
      alert(response.message || t('people.statusDropdownToastFailedToUpdateStatus'));
    }
  } catch (error) {
    console.error('Error updating status:', error);
    alert(error.response?.data?.message || t('people.statusDropdownToastErrorUpdatingStatus'));
  } finally {
    updating.value = false;
  }
};

// Toggle dropdown
const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
};

// Close dropdown
const closeDropdown = () => {
  showDropdown.value = false;
};

// Handle click outside
const handleClickOutside = (event) => {
  if (showDropdown.value && dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    const button = document.getElementById(props.statusBadgeId);
    if (button && !button.contains(event.target)) {
      closeDropdown();
    }
  }
};

// Handle escape key
const handleEscape = (event) => {
  if (event.key === 'Escape' && showDropdown.value) {
    closeDropdown();
  }
};

// Watch dropdown state and attach/detach listeners
watch(showDropdown, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', handleClickOutside, true);
    document.addEventListener('keydown', handleEscape);
  } else {
    document.removeEventListener('pointerdown', handleClickOutside, true);
    document.removeEventListener('keydown', handleEscape);
  }
});

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('pointerdown', handleClickOutside, true);
  document.removeEventListener('keydown', handleEscape);
});
</script>

