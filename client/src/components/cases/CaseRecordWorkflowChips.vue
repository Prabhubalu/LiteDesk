<template>
  <div class="inline-flex min-w-0 items-center gap-1.5 sm:gap-2">
    <div
      class="hidden min-w-0 max-w-[9rem] items-center gap-1.5 sm:inline-flex"
      :title="assigneeTitle"
      :aria-label="assigneeTitle"
    >
      <Avatar
        :user="assigneeUser || { email: '' }"
        :icon="isAssigneeUnassigned ? UserIcon : undefined"
        size="sm"
        class="shrink-0"
      />
      <span
        class="truncate text-xs font-medium"
        :class="isAssigneeUnassigned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'"
      >
        {{ assigneeName }}
      </span>
    </div>

    <div
      class="case-header-chip inline-flex min-w-0 items-center rounded-md py-0.5 pl-1.5 pr-0.5 ring-1 ring-inset transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110"
      :style="statusChipStyle"
    >
      <span
        class="mr-1 h-1.5 w-1.5 shrink-0 rounded-full"
        :style="{ backgroundColor: statusColor || '#9CA3AF' }"
        aria-hidden="true"
      />
      <HeadlessSelect
        :model-value="caseRecord.status"
        :options="statusOptions"
        :disabled="statusUpdating || isClosed"
        teleport
        teleport-align="end"
        :teleport-match-width="false"
        :teleport-min-width-px="200"
        :searchable="false"
        :truncate-button-label="false"
        :truncate-options="false"
        :button-class="chipSelectButtonClass"
        :options-class="headerSelectOptionsClass"
        wrapper-class="case-header-chip-select min-w-[5.5rem]"
        @update:model-value="$emit('status-change', $event)"
      />
    </div>

    <div
      class="case-header-chip inline-flex min-w-0 items-center rounded-md py-0.5 pl-1.5 pr-0.5 ring-1 ring-inset transition-[filter] hover:brightness-[0.97] dark:hover:brightness-110"
      :style="priorityChipStyle"
    >
      <span
        class="mr-1 h-1.5 w-1.5 shrink-0 rounded-full"
        :style="{ backgroundColor: priorityColor || '#9CA3AF' }"
        aria-hidden="true"
      />
      <HeadlessSelect
        :model-value="caseRecord.priority"
        :options="priorityOptions"
        :disabled="isClosed"
        teleport
        teleport-align="end"
        :teleport-match-width="false"
        :teleport-min-width-px="128"
        :searchable="false"
        :truncate-button-label="false"
        :truncate-options="false"
        :button-class="chipSelectButtonClass"
        :options-class="headerSelectOptionsClass"
        wrapper-class="case-header-chip-select min-w-[4.75rem]"
        @update:model-value="$emit('priority-change', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { UserIcon } from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import {
  caseChipSurfaceStyle,
  casePriorityColor,
  caseStatusColor
} from '@/utils/caseRecordUi';

const props = defineProps({
  caseRecord: { type: Object, required: true },
  allowedStatusTransitions: { type: Array, default: () => [] },
  priorities: { type: Array, default: () => [] },
  statusUpdating: { type: Boolean, default: false },
  isClosed: { type: Boolean, default: false }
});

defineEmits(['status-change', 'priority-change']);

const { t } = useI18n();

const unassignedLabel = computed(() => t('cases.recordDetailsUnassigned'));

const assigneeUser = computed(() => {
  const owner = props.caseRecord?.assignedTo;
  if (owner && typeof owner === 'object') return owner;
  return null;
});

const isAssigneeUnassigned = computed(() => !assigneeUser.value);

const assigneeName = computed(() => {
  const owner = assigneeUser.value;
  if (!owner) return unassignedLabel.value;
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
  return name || owner.email || owner.username || unassignedLabel.value;
});

const assigneeTitle = computed(() => {
  const label = t('cases.recordHeaderAssignedTo');
  return `${label} ${assigneeName.value}`;
});

const chipSelectButtonClass =
  '!h-6 !min-h-0 !rounded !border-0 !bg-transparent !px-1.5 !pr-5 !py-0 !text-xs !font-semibold !leading-none !text-gray-800 !shadow-none !outline-none !ring-0 hover:!bg-transparent focus:!bg-transparent focus-visible:!ring-2 focus-visible:!ring-indigo-500/40 dark:!text-gray-100 dark:hover:!bg-transparent dark:focus:!bg-transparent sm:!text-xs';

const headerSelectOptionsClass = 'z-[10060] !py-1';

const statusOptions = computed(() => {
  const current = props.caseRecord?.status;
  const transitions = props.allowedStatusTransitions || [];
  const values = current
    ? [current, ...transitions.filter((status) => status !== current)]
    : [...transitions];
  return values.map((value) => ({ value, label: value }));
});

const priorityOptions = computed(() =>
  (props.priorities || []).map((priority) => ({ value: priority, label: priority }))
);

const statusColor = computed(() => caseStatusColor(props.caseRecord?.status));
const priorityColor = computed(() => casePriorityColor(props.caseRecord?.priority));
const statusChipStyle = computed(() => caseChipSurfaceStyle(statusColor.value));
const priorityChipStyle = computed(() => caseChipSurfaceStyle(priorityColor.value));
</script>

<style scoped>
.case-header-chip-select :deep(button) {
  background-color: transparent !important;
  outline: none !important;
}

.case-header-chip-select :deep(button:hover),
.case-header-chip-select :deep(button:focus),
.case-header-chip-select :deep(button[data-headlessui-state~='hover']),
.case-header-chip-select :deep(button[data-headlessui-state~='focus']) {
  background-color: transparent !important;
}
</style>
