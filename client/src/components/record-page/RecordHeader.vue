<template>
  <div class="record-header">
    <!-- Top bar: Breadcrumbs and page actions -->
    <div class="record-header__top flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-700">
      <!-- Leading: back (mobile) + prev/next + breadcrumbs -->
      <div v-if="$slots.breadcrumbs || showNavigation || showBack" class="record-header__breadcrumbs flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 min-w-0">
        <div class="inline-flex items-center gap-3 shrink-0">
          <button
            v-if="showBack"
            type="button"
            class="inline-flex h-7 items-center gap-0.5 rounded border border-gray-200 px-1.5 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200 lg:hidden"
            :aria-label="resolvedBackLabel"
            :title="resolvedBackLabel"
            @click="$emit('back')"
          >
            <ChevronLeftIcon class="h-4 w-4 shrink-0" />
            <span class="text-xs font-medium">{{ resolvedBackLabel }}</span>
          </button>
          <div v-if="showNavigation" class="inline-flex items-center gap-1">
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
              :class="canPrevious ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
              :disabled="!canPrevious"
              :aria-label="resolvedPreviousLabel"
              :title="shortcutPrev ? `${resolvedPreviousLabel} (${shortcutPrev})` : resolvedPreviousLabel"
              @click="$emit('previous')"
            >
              <ArrowLeftIcon class="h-4 w-4" />
            </button>
            <button
              type="button"
              class="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors dark:border-gray-700 dark:text-gray-400"
              :class="canNext ? 'hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200' : 'opacity-40 cursor-not-allowed'"
              :disabled="!canNext"
              :aria-label="resolvedNextLabel"
              :title="shortcutNext ? `${resolvedNextLabel} (${shortcutNext})` : resolvedNextLabel"
              @click="$emit('next')"
            >
              <ArrowRightIcon class="h-4 w-4" />
            </button>
          </div>
        </div>
        <div class="hidden md:contents">
          <slot name="breadcrumbs" />
        </div>
      </div>
      <!-- Page actions (right side) -->
      <div class="record-header__page-actions flex items-center gap-2 shrink-0">
        <slot name="pageActions" />
      </div>
    </div>
    
    <!-- Header actions (status, primary action, menu) - moved to top bar -->
    <div v-if="$slots.statusControl || $slots.primaryAction || $slots.actionsMenu" class="record-header__actions flex items-center gap-2 px-4 sm:px-6 py-2 border-b border-gray-200 dark:border-gray-700">
      <slot name="statusControl" />
      <slot name="primaryAction" />
      <slot name="actionsMenu" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowLeftIcon, ArrowRightIcon, ChevronLeftIcon } from '@heroicons/vue/24/outline';

const { t } = useI18n();

/**
 * RecordHeader – identity and primary control with breadcrumbs.
 *
 * Optional header navigation (prev/next record):
 * - showNavigation: show prev/next buttons before breadcrumbs
 * - showBack: mobile-only back to module list (lg:hidden)
 * - canPrevious / canNext: enable/disable buttons
 * - previousLabel / nextLabel: aria and tooltip (e.g. "Previous task")
 * - shortcutPrev / shortcutNext: keyboard shortcut hint (e.g. "⌘+Left")
 * - Emits: back, previous, next
 *
 * Slots:
 * - #breadcrumbs: Breadcrumb navigation (e.g., Task • abc123)
 * - #pageActions: Top-right page actions
 * - #statusControl, #primaryAction, #actionsMenu
 */
const props = defineProps({
  title: { type: String, default: '' },
  recordType: { type: String, default: '' },
  recordId: { type: String, default: '' },
  showTypeDropdown: { type: Boolean, default: false },
  showNavigation: { type: Boolean, default: false },
  showBack: { type: Boolean, default: false },
  backLabel: { type: String, default: '' },
  canPrevious: { type: Boolean, default: false },
  canNext: { type: Boolean, default: false },
  previousLabel: { type: String, default: '' },
  nextLabel: { type: String, default: '' },
  shortcutPrev: { type: String, default: '' },
  shortcutNext: { type: String, default: '' }
});

const resolvedBackLabel = computed(() => props.backLabel || t('actions.back'));
const resolvedPreviousLabel = computed(() => props.previousLabel || t('actions.previous'));
const resolvedNextLabel = computed(() => props.nextLabel || t('actions.next'));

defineEmits(['back', 'previous', 'next']);
</script>
