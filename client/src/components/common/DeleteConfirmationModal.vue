<template>
  <TransitionRoot as="template" :show="show">
    <Dialog class="relative z-[10000]" @close="onDialogClose">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100"
        leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-[10000] w-screen overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild as="template" enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100" leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95">
            <DialogPanel
              class="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div
                  class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full sm:mx-0 sm:size-10"
                  :class="iconWrapClass">
                  <ExclamationTriangleIcon class="size-6" :class="iconClass" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                  <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">
                    {{ showBulkProgress ? t('common.bulkDeleteBannerTitle') : deleteDialogTitle }}
                  </DialogTitle>
                  <div v-if="showBulkProgress" class="mt-4 space-y-3">
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      {{ bulkProgressLabel }}
                    </p>
                    <div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <div
                        class="h-full rounded-full transition-all duration-300 ease-out"
                        :class="[progressBarClass, { 'animate-pulse': bulkDeleteStore.progressIndeterminate }]"
                        :style="{
                          width: bulkDeleteStore.progressIndeterminate
                            ? '35%'
                            : `${bulkDeleteStore.progressPercent}%`
                        }"
                      />
                    </div>
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {{ t('common.bulkDeleteModalBackgroundHint') }}
                    </p>
                  </div>
                  <div v-else class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      {{ deleteDialogMessage }}
                    </p>
                  </div>
                </div>
              </div>
              <div v-if="showBulkProgress" class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  class="inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:w-auto"
                  @click="handleClose"
                >
                  {{ t('common.bulkDeleteContinueInBackground') }}
                </button>
              </div>
              <div v-else class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2 sm:gap-3">
                <button type="button"
                  class="inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:ml-0 sm:w-auto"
                  :class="confirmButtonClass"
                  :disabled="deleting"
                  @click="handleConfirm">
                  <span v-if="deleting">{{ confirmBusyLabel }}</span>
                  <span v-else>{{ confirmActionLabel }}</span>
                </button>
                <button
                  v-if="secondaryActionLabel"
                  type="button"
                  class="mt-3 sm:mt-0 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 sm:w-auto"
                  :disabled="deleting"
                  @click="handleSecondary"
                >
                  {{ secondaryActionLabel }}
                </button>
                <button type="button"
                  class="mt-3 sm:mt-0 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 sm:w-auto"
                  :disabled="deleting"
                  @click="handleClose">
                  {{ dismissLabel }}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { useBulkDeleteProgressStore } from '@/stores/bulkDeleteProgress';
import { formatNumber } from '@/utils/localeFormat';

const { t } = useI18n();
const bulkDeleteStore = useBulkDeleteProgressStore();

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  recordName: {
    type: String,
    default: ''
  },
  recordType: {
    type: String,
    default: 'record'
  },
  deleting: {
    type: Boolean,
    default: false
  },
  isBulk: {
    type: Boolean,
    default: false
  },
  bulkCount: {
    type: Number,
    default: 0
  },
  /** Optional override for dialog title (e.g. users offboarding). */
  title: {
    type: String,
    default: ''
  },
  /** Optional override for dialog body. */
  message: {
    type: String,
    default: ''
  },
  /** Optional confirm button label (defaults to Delete). */
  confirmLabel: {
    type: String,
    default: ''
  },
  /** Optional middle action (e.g. "Save without notifying"). Emits `secondary`. */
  secondaryLabel: {
    type: String,
    default: ''
  },
  /** Optional cancel/dismiss button label. */
  cancelLabel: {
    type: String,
    default: ''
  },
  /** Optional busy label while confirming. */
  confirmingLabel: {
    type: String,
    default: ''
  },
  /** Visual tone for icon + primary button. */
  tone: {
    type: String,
    default: 'danger',
    validator: (value) => ['danger', 'warning', 'success'].includes(value)
  }
});

const emit = defineEmits(['close', 'confirm', 'secondary']);

const showBulkProgress = computed(() => props.isBulk && bulkDeleteStore.isActive);

const bulkProgressLabel = computed(() => {
  const processed = formatNumber(Number(bulkDeleteStore.processed || 0));
  const total = formatNumber(Number(bulkDeleteStore.total || 0));
  return t('common.bulkDeleteProgressDeleting', { processed, total });
});

const confirmActionLabel = computed(() => props.confirmLabel || t('actions.delete'));
const secondaryActionLabel = computed(() => String(props.secondaryLabel || '').trim());
const dismissLabel = computed(() => props.cancelLabel || t('actions.cancel'));
const confirmBusyLabel = computed(() => props.confirmingLabel || t('common.deleteInProgress'));

const iconWrapClass = computed(() => {
  if (props.tone === 'success') return 'bg-emerald-100 dark:bg-emerald-500/10';
  if (props.tone === 'warning') return 'bg-amber-100 dark:bg-amber-500/10';
  return 'bg-red-100 dark:bg-red-500/10';
});

const iconClass = computed(() => {
  if (props.tone === 'success') return 'text-emerald-600 dark:text-emerald-400';
  if (props.tone === 'warning') return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
});

const confirmButtonClass = computed(() => {
  if (props.tone === 'success') {
    return 'bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-500 dark:hover:bg-emerald-400 focus-visible:outline-emerald-600 dark:focus-visible:outline-emerald-500';
  }
  if (props.tone === 'warning') {
    return 'bg-amber-600 dark:bg-amber-500 hover:bg-amber-500 dark:hover:bg-amber-400 focus-visible:outline-amber-600 dark:focus-visible:outline-amber-500';
  }
  return 'bg-red-600 dark:bg-red-500 hover:bg-red-500 dark:hover:bg-red-400 focus-visible:outline-red-600 dark:focus-visible:outline-red-500';
});

const progressBarClass = computed(() => {
  if (props.tone === 'success') return 'bg-emerald-600';
  if (props.tone === 'warning') return 'bg-amber-600';
  return 'bg-red-600';
});

const recordTypeLabel = computed(() => {
  // Capitalize first letter and handle common module names
  const type = props.recordType.toLowerCase();
  const labels = {
    'people': 'People',
    'contacts': 'Contact',
    'organizations': 'Organization',
    'deals': 'Deal',
    'tasks': 'Task',
    'groups': 'Group',
    'events': 'Event',
    'item': 'Item',
    'trash item': 'Trash item',
    'quote line': 'Quote line',
    'folder': 'Folder',
    'instance': 'Instance',
    'settings-users': 'User',
    'users': 'User'
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
});

const deleteDialogTitle = computed(() => {
  if (props.title) return props.title;
  if (props.isBulk) {
    return t('common.deleteTitleBulk', {
      count: props.bulkCount,
      recordTypePlural: recordTypeLabelPlural.value,
    });
  }
  return t('common.deleteTitleSingle', { recordType: recordTypeLabel.value });
});

const deleteDialogMessage = computed(() => {
  if (props.message) return props.message;
  if (props.isBulk) {
    const label =
      props.bulkCount === 1
        ? recordTypeLabel.value.toLowerCase()
        : recordTypeLabelPlural.value.toLowerCase();
    return t('common.deleteConfirmBulk', {
      count: props.bulkCount,
      recordTypeLabel: label,
    });
  }
  const target = props.recordName
    ? `"${props.recordName}"`
    : `this ${recordTypeLabel.value.toLowerCase()}`;
  return t('common.deleteConfirmSingle', { target });
});

const recordTypeLabelPlural = computed(() => {
  // Return plural form for bulk delete
  const type = props.recordType.toLowerCase();
  const labels = {
    'people': 'People',
    'contacts': 'Contacts',
    'organizations': 'Organizations',
    'deals': 'Deals',
    'tasks': 'Tasks',
    'groups': 'Groups',
    'events': 'Events',
    'item': 'Items',
    'trash item': 'Trash items',
    'quote line': 'Quote lines',
    'instance': 'Instances',
    'settings-users': 'Users',
    'users': 'Users'
  };
  return labels[type] || (recordTypeLabel.value + 's');
});

const onDialogClose = () => {
  handleClose();
};

const handleClose = () => {
  if (props.deleting && !showBulkProgress.value) return;
  emit('close');
};

const handleConfirm = () => {
  if (props.deleting || showBulkProgress.value) return;
  emit('confirm');
};

const handleSecondary = () => {
  if (props.deleting || showBulkProgress.value) return;
  emit('secondary');
};
</script>

