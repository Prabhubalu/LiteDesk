<template>
  <div class="flex-1">
    <!-- AssignedTo Condition -->
    <select
      v-if="condition.field === 'assignedTo'"
      :value="condition.value || 'ANY'"
      @change="$emit('update', { ...condition, value: $event.target.value })"
      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
    >
      <option value="ME">{{ t('notifications.assignToMe') }}</option>
      <option value="ANY">{{ t('notifications.assignAnyone') }}</option>
    </select>

    <!-- Priority Condition -->
    <div v-else-if="condition.field === 'priority'" class="space-y-2">
      <div class="flex flex-wrap gap-2">
        <label
          v-for="priority in priorityOptions"
          :key="priority"
          class="flex items-center"
        >
          <HeadlessCheckbox
            :checked="isPrioritySelected(priority)"
            checkbox-class="w-4 h-4"
            @change="handlePriorityChange(priority, $event.target.checked)"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
            {{ priority }}
          </span>
        </label>
      </div>
    </div>

    <!-- Status Condition -->
    <div v-else-if="condition.field === 'status'" class="space-y-2">
      <div v-if="statusOptions.length > 0" class="flex flex-wrap gap-2">
        <label
          v-for="status in statusOptions"
          :key="status"
          class="flex items-center"
        >
          <HeadlessCheckbox
            :checked="isStatusSelected(status)"
            checkbox-class="w-4 h-4"
            @change="handleStatusChange(status, $event.target.checked)"
          />
          <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {{ formatStatus(status) }}
          </span>
        </label>
      </div>
      <div v-else class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('notifications.noStatusOptions') }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  condition: {
    type: Object,
    required: true
  },
  module: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['update']);

const priorityOptions = ['low', 'medium', 'high', 'urgent'];

const statusOptions = computed(() => {
  // Try to get status options from module definition fields
  if (props.module?.fields) {
    const statusField = props.module.fields.find(f => 
      f.key === 'status' || f.key.toLowerCase().includes('status')
    );
    if (statusField?.options) {
      return statusField.options.map(opt => 
        typeof opt === 'string' ? opt : opt.value
      );
    }
  }
  
  // Fallback to common status values
  if (props.module?.key === 'tasks') {
    return ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'];
  }
  if (props.module?.key === 'audit') {
    return ['Ready to start', 'checked_in', 'submitted', 'pending_corrective', 'needs_review', 'approved', 'rejected', 'closed'];
  }
  
  return [];
});

function isPrioritySelected(priority) {
  if (!props.condition.value) return false;
  return Array.isArray(props.condition.value)
    ? props.condition.value.includes(priority)
    : props.condition.value === priority;
}

function handlePriorityChange(priority, checked) {
  const current = Array.isArray(props.condition.value) 
    ? [...props.condition.value]
    : props.condition.value ? [props.condition.value] : [];
  
  if (checked) {
    if (!current.includes(priority)) {
      current.push(priority);
    }
  } else {
    const index = current.indexOf(priority);
    if (index > -1) {
      current.splice(index, 1);
    }
  }
  
  emit('update', { ...props.condition, value: current.length > 0 ? current : undefined });
}

function isStatusSelected(status) {
  if (!props.condition.value) return false;
  return Array.isArray(props.condition.value)
    ? props.condition.value.includes(status)
    : props.condition.value === status;
}

function handleStatusChange(status, checked) {
  const current = Array.isArray(props.condition.value)
    ? [...props.condition.value]
    : props.condition.value ? [props.condition.value] : [];
  
  if (checked) {
    if (!current.includes(status)) {
      current.push(status);
    }
  } else {
    const index = current.indexOf(status);
    if (index > -1) {
      current.splice(index, 1);
    }
  }
  
  emit('update', { ...props.condition, value: current.length > 0 ? current : undefined });
}

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
</script>

