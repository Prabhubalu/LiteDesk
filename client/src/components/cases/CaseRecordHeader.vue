<template>
  <header class="shrink-0 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
    <div
      class="flex items-center gap-2 sm:gap-2.5"
      :class="embedToolbar ? 'px-6 py-1' : 'px-4 py-1 sm:px-5'"
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

      <div v-if="!embedToolbar" class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <Avatar
          :record="{ name: caseRecord.title || caseModuleLabel }"
          :icon="TicketIcon"
          size="sm"
          class="hidden shrink-0 sm:flex"
        />
        <div v-if="!previewMode" class="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden">
          <h1
            class="min-w-0 truncate text-sm font-semibold leading-tight text-gray-900 dark:text-white"
            :title="caseRecord.title"
          >
            {{ caseRecord.title || '—' }}
          </h1>
          <span
            v-if="caseNumber"
            class="shrink-0 font-mono text-[11px] font-medium leading-tight text-gray-500 dark:text-gray-400"
            :title="caseNumber"
          >
            {{ caseNumber }}
          </span>
        </div>
      </div>

      <div
        class="flex shrink-0 items-center gap-1.5 sm:gap-2"
        :class="embedToolbar ? 'ml-auto' : ''"
      >
        <RecordPresenceAvatars
          v-if="presenceSessions.length"
          :sessions="presenceSessions"
        />

        <CaseRecordWorkflowChips
          :case-record="caseRecord"
          :allowed-status-transitions="allowedStatusTransitions"
          :priorities="priorities"
          :status-updating="statusUpdating"
          :is-closed="isClosed"
          @status-change="$emit('status-change', $event)"
          @priority-change="$emit('priority-change', $event)"
        />

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

          <RecordPrintButton
            v-if="caseRecord?._id"
            variant="compact"
            module-key="cases"
            :record-id="String(caseRecord._id)"
          />

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
              <MenuItems class="absolute right-0 top-full z-50 mt-1 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10">
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
  TicketIcon
} from '@heroicons/vue/24/outline';
import Avatar from '@/components/common/Avatar.vue';
import RecordPresenceAvatars from '@/components/record-page/RecordPresenceAvatars.vue';
import RecordPrintButton from '@/components/record-page/RecordPrintButton.vue';
import CaseRecordWorkflowChips from '@/components/cases/CaseRecordWorkflowChips.vue';

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
const caseNumber = computed(
  () => props.caseRecord?.caseId || props.caseRecord?._id?.slice(-8) || ''
);
</script>
