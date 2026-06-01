<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-3"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-3"
    >
      <div
        v-if="visible"
        class="pointer-events-none fixed bottom-4 left-1/2 z-40 w-[min(95vw,720px)] -translate-x-1/2"
      >
        <div
          class="pointer-events-auto flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800 dark:ring-white/10"
        >
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              :class="error
                ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300'"
            >
              <svg v-if="error" class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div class="min-w-0">
              <p
                class="truncate text-sm font-medium"
                :class="error ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'"
              >
                {{ titleText }}
              </p>
              <p v-if="subtitleText" class="truncate text-xs text-gray-500 dark:text-gray-400">
                {{ subtitleText }}
              </p>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              v-if="showReset"
              type="button"
              class="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700"
              :disabled="saving || resetDisabled"
              @click="$emit('reset')"
            >
              {{ resetLabelText }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="saving || saveDisabled"
              @click="$emit('save')"
            >
              <svg v-if="saving" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ saving ? savingLabelText : saveLabelText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  saving: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  showReset: {
    type: Boolean,
    default: true
  },
  resetLabel: {
    type: String,
    default: ''
  },
  saveLabel: {
    type: String,
    default: ''
  },
  savingLabel: {
    type: String,
    default: ''
  },
  resetDisabled: {
    type: Boolean,
    default: false
  },
  saveDisabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['save', 'reset']);

const { t } = useI18n();

const titleText = computed(() => props.error || t('settings.unsavedTitle'));
const subtitleText = computed(() => {
  if (props.error || !props.message) return '';
  return props.message;
});
const resetLabelText = computed(() => props.resetLabel || t('settings.discardChanges'));
const saveLabelText = computed(() => props.saveLabel || t('settings.saveChanges'));
const savingLabelText = computed(() => props.savingLabel || t('states.saving'));
</script>
