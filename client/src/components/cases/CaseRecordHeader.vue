<template>
  <header class="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div
      class="flex items-center gap-2"
      :class="embedToolbar ? 'px-6 py-2' : 'px-3 py-2 sm:px-4'"
    >
      <div v-if="showNavigation" class="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
          :class="canPrevious ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-not-allowed opacity-40'"
          :disabled="!canPrevious"
          :aria-label="t('actions.previous')"
          @click="$emit('previous')"
        >
          <ChevronLeftIcon class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 dark:border-gray-600 dark:text-gray-400"
          :class="canNext ? 'hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-not-allowed opacity-40'"
          :disabled="!canNext"
          :aria-label="t('actions.next')"
          @click="$emit('next')"
        >
          <ChevronRightIcon class="h-4 w-4" />
        </button>
      </div>

      <div v-if="!embedToolbar" class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <span
          class="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          :title="caseRecord.caseId"
        >
          {{ caseRecord.caseId || caseRecord._id?.slice(-8) }}
        </span>
        <span
          v-if="!previewMode"
          class="hidden min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white sm:inline"
          :title="caseRecord.title"
        >
          {{ caseRecord.title }}
        </span>
        <span
          v-if="metaLine"
          class="hidden min-w-0 truncate text-[11px] text-gray-500 dark:text-gray-400 lg:inline"
          :title="metaLine"
        >
          · {{ metaLine }}
        </span>
        <span
          v-if="slaAlertText"
          class="hidden min-w-0 max-w-[12rem] truncate rounded-full border px-2 py-0.5 text-[11px] font-medium xl:inline-flex"
          :class="slaAlertClass"
          :title="slaAlertDetail || slaAlertText"
        >
          {{ slaAlertText }}
        </span>
      </div>

      <div
        class="flex shrink-0 items-center gap-2"
        :class="embedToolbar ? 'ml-auto' : ''"
      >
        <div
          class="hidden min-w-0 max-w-[9rem] items-center gap-1.5 border-r border-gray-200 pr-2 sm:flex sm:max-w-[11rem] dark:border-gray-700"
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
            class="truncate text-xs font-semibold"
            :class="isAssigneeUnassigned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'"
          >
            {{ assigneeName }}
          </span>
        </div>

        <CaseSlaBadge compact class="hidden sm:inline-flex" :cycle="caseRecord.currentSlaCycle" />

        <select
          :value="caseRecord.status"
          :disabled="statusUpdating || isClosed"
          class="h-8 max-w-[7.5rem] truncate rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          :aria-label="t('cases.recordHeaderStatus')"
          @change="$emit('status-change', $event.target.value)"
        >
          <option :value="caseRecord.status">{{ caseRecord.status }}</option>
          <option v-for="st in allowedStatusTransitions" :key="st" :value="st">{{ st }}</option>
        </select>

        <select
          :value="caseRecord.priority"
          :disabled="isClosed"
          class="h-8 max-w-[6rem] truncate rounded-lg border border-gray-200 bg-white px-2 text-xs font-medium text-gray-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          :aria-label="t('cases.recordHeaderPriority')"
          @change="$emit('priority-change', $event.target.value)"
        >
          <option v-for="p in priorities" :key="p" :value="p">{{ p }}</option>
        </select>

        <button
          v-if="canEmail"
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          :aria-label="t('cases.recordHeaderEmail')"
          @click="$emit('email')"
        >
          <EnvelopeIcon class="h-4 w-4" />
        </button>

        <button
          v-if="canEdit && !isClosed"
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          :aria-label="t('actions.edit')"
          @click.stop="emit('edit-record')"
        >
          <PencilSquareIcon class="h-4 w-4" />
        </button>

        <Menu as="div" class="relative">
          <MenuButton
            class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
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

    <div
      v-if="!previewMode"
      class="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-gray-100 px-3 pb-2 pt-1.5 text-[11px] sm:hidden dark:border-gray-800"
    >
      <h1 class="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white" :title="caseRecord.title">
        {{ caseRecord.title }}
      </h1>
      <div
        class="flex shrink-0 items-center gap-1.5"
        :title="assigneeTitle"
        :aria-label="assigneeTitle"
      >
        <Avatar
          :user="assigneeUser || { email: '' }"
          :icon="isAssigneeUnassigned ? UserIcon : undefined"
          size="sm"
        />
        <span
          class="max-w-[6rem] truncate text-xs font-semibold"
          :class="isAssigneeUnassigned ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'"
        >
          {{ assigneeName }}
        </span>
      </div>
      <CaseSlaBadge compact class="w-full sm:hidden" :cycle="caseRecord.currentSlaCycle" />
      <span v-if="metaLine" class="w-full truncate text-gray-500 dark:text-gray-400">{{ metaLine }}</span>
      <span
        v-if="slaAlertText"
        class="inline-flex max-w-full truncate rounded-full border px-2 py-0.5 font-medium"
        :class="slaAlertClass"
      >
        {{ slaAlertText }}
      </span>
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
  UserIcon
} from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import CaseSlaBadge from '@/components/cases/CaseSlaBadge.vue';

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
  /** List quick-preview: hide duplicate title in the compact header row */
  previewMode: { type: Boolean, default: false },
  /** Embed quick-preview: toolbar only (title lives in RecordPageTitleRow) */
  embedToolbar: { type: Boolean, default: false }
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

const slaAlertText = computed(() => {
  const ctx = props.caseRecord?.slaContext;
  const cycleStatus = props.caseRecord?.currentSlaCycle?.status;
  if (cycleStatus === 'paused') return t('cases.recordSlaAlertPaused');
  if (!ctx?.useBusinessHours) return '';
  if (ctx.isOpen === false) return t('cases.recordSlaAlertOutsideHours');
  return '';
});

const slaAlertDetail = computed(() => {
  const ctx = props.caseRecord?.slaContext;
  if (!ctx) return '';
  return [ctx.scheduleName, ctx.timezone].filter(Boolean).join(' · ');
});

const slaAlertClass = computed(() => {
  if (props.caseRecord?.currentSlaCycle?.status === 'paused') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
  return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300';
});
</script>
