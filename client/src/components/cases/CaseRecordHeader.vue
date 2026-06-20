<template>
  <header class="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <!-- Primary: identity + workflow -->
    <div
      class="flex min-h-[3rem] items-center gap-2.5 sm:gap-3"
      :class="embedToolbar ? 'px-6 py-2' : 'px-4 py-2 sm:px-5'"
    >
      <div v-if="showNavigation" class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          :class="canPrevious ? '' : 'cursor-not-allowed opacity-35'"
          :disabled="!canPrevious"
          :aria-label="t('actions.previous')"
          @click="$emit('previous')"
        >
          <ChevronLeftIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          :class="canNext ? '' : 'cursor-not-allowed opacity-35'"
          :disabled="!canNext"
          :aria-label="t('actions.next')"
          @click="$emit('next')"
        >
          <ChevronRightIcon class="h-4 w-4" />
        </button>
      </div>

      <div v-if="!embedToolbar" class="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
        <Avatar
          :record="{ name: caseRecord.title || caseModuleLabel }"
          :icon="TicketIcon"
          size="sm"
          class="hidden shrink-0 sm:flex"
        />
        <h1
          v-if="!previewMode"
          class="min-w-0 truncate text-[15px] font-semibold leading-tight text-gray-900 dark:text-white sm:text-base"
          :title="caseRecord.title"
        >
          {{ caseRecord.title || '—' }}
        </h1>
      </div>

      <div
        class="flex shrink-0 items-center gap-1.5 sm:gap-2"
        :class="embedToolbar ? 'ml-auto' : ''"
      >
        <RecordPresenceAvatars
          v-if="presenceSessions.length"
          :sessions="presenceSessions"
        />
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

        <div
          class="ml-1 inline-flex items-center gap-0.5 border-l border-gray-200 pl-1.5 dark:border-gray-700"
        >
          <button
            v-if="canEmail"
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
            :aria-label="t('cases.recordHeaderEmail')"
            @click="$emit('email')"
          >
            <EnvelopeIcon class="h-4 w-4" />
          </button>

          <button
            v-if="canEdit && !isClosed"
            type="button"
            class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
            :aria-label="t('actions.edit')"
            @click.stop="emit('edit-record')"
          >
            <PencilSquareIcon class="h-4 w-4" />
          </button>

          <Menu as="div" class="relative">
            <MenuButton
              class="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100"
              :aria-label="t('records.genericMoreActions')"
            >
              <EllipsisVerticalIcon class="h-4 w-4" />
            </MenuButton>
            <transition
              enter-active-class="transition ease-out duration-100"
              enter-from-class="transform opacity-0 scale-95"
              enter-to-class="transform opacity-100 scale-100"
              leave-active-class="transition ease-in duration-75"
              leave-from-class="transform opacity-100 scale-100"
              leave-to-class="transform opacity-0 scale-95"
            >
              <MenuItems class="absolute right-0 top-full z-50 mt-1 w-44 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
                <MenuItem v-slot="{ active }">
                  <button
                    type="button"
                    :class="[active ? 'bg-gray-100 dark:bg-gray-700' : '', 'block w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-200']"
                    @click="$emit('copy-url')"
                  >
                    {{ t('records.genericCopyUrl') }}
                  </button>
                </MenuItem>
                <MenuItem v-if="canDelete" v-slot="{ active }">
                  <button
                    type="button"
                    :class="[active ? 'bg-red-50 dark:bg-red-900/30' : '', 'block w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400']"
                    @click="$emit('delete')"
                  >
                    {{ t('actions.delete') }}
                  </button>
                </MenuItem>
              </MenuItems>
            </transition>
          </Menu>
        </div>
      </div>
    </div>

    <!-- Secondary: case meta, assignee, SLA -->
    <div
      v-if="showMetaStrip"
      class="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-gray-100 bg-gray-50/70 px-4 py-1.5 sm:px-5 dark:border-gray-800 dark:bg-gray-800/25"
    >
      <template v-if="!embedToolbar">
        <span
          class="shrink-0 font-mono text-[11px] font-medium text-gray-500 dark:text-gray-400"
          :title="caseRecord.caseId"
        >
          {{ caseRecord.caseId || caseRecord._id?.slice(-8) }}
        </span>
        <span
          v-if="metaLine"
          class="hidden min-w-0 truncate text-xs text-gray-500 sm:inline dark:text-gray-400"
          :title="metaLine"
        >
          {{ metaLine }}
        </span>
        <span
          v-if="metaLine"
          class="hidden text-gray-300 sm:inline dark:text-gray-600"
          aria-hidden="true"
        >
          ·
        </span>
      </template>

      <div
        class="inline-flex min-w-0 max-w-full items-center gap-1.5"
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

      <CaseSlaBadge
        v-if="hasSlaCycle"
        compact
        class="min-w-0 max-w-full"
        :cycle="caseRecord.currentSlaCycle"
        :sla-progress="caseRecord.slaProgress"
      />
    </div>

    <div
      v-if="showSlaContextBanner"
      class="border-t border-amber-200/70 bg-amber-50/80 px-4 py-1.5 sm:px-5 dark:border-amber-900/50 dark:bg-amber-950/30"
    >
      <CaseSlaContextBanner
        class="!mt-0 !rounded-none !border-0 !bg-transparent !p-0"
        :sla-context="caseRecord.slaContext"
        :cycle-status="caseRecord.currentSlaCycle?.status"
        :case-status="caseRecord.status"
      />
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue';
import {
  PencilSquareIcon,
  EnvelopeIcon,
  EllipsisVerticalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  TicketIcon
} from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import CaseSlaBadge from '@/components/cases/CaseSlaBadge.vue';
import CaseSlaContextBanner from '@/components/helpdesk/CaseSlaContextBanner.vue';
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
  isClosed: { type: Boolean, default: false },
  showNavigation: { type: Boolean, default: true },
  canPrevious: { type: Boolean, default: false },
  canNext: { type: Boolean, default: false },
  canEmail: { type: Boolean, default: true },
  canDelete: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: true },
  previewMode: { type: Boolean, default: false },
  embedToolbar: { type: Boolean, default: false },
  presenceSessions: { type: Array, default: () => [] }
});

const emit = defineEmits([
  'status-change',
  'priority-change',
  'edit-record',
  'email',
  'delete',
  'copy-url',
  'previous',
  'next'
]);

const { t } = useI18n();

const caseModuleLabel = computed(() => t('navigation.moduleCases'));

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

const unassignedLabel = computed(() => t('cases.recordDetailsUnassigned'));

const assigneeUser = computed(() => {
  const owner = props.caseRecord?.caseOwnerId;
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

const metaLine = computed(() => {
  return [props.caseRecord?.caseType, props.caseRecord?.channel].filter(Boolean).join(' · ');
});

const hasSlaCycle = computed(() => Boolean(props.caseRecord?.currentSlaCycle));

const showSlaContextBanner = computed(() => {
  const cycleStatus = props.caseRecord?.currentSlaCycle?.status;
  const ctx = props.caseRecord?.slaContext;
  if (cycleStatus === 'paused') return true;
  if (!ctx?.useBusinessHours) return false;
  return ctx.isOpen === false;
});

const showMetaStrip = computed(() => {
  if (props.embedToolbar) {
    return hasSlaCycle.value;
  }
  return true;
});
</script>

<style scoped>
/* HeadlessSelect ships gray field styles; keep chip triggers visually transparent. */
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
