<template>
  <TransitionRoot as="template" :show="show">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild as="template" enter="ease-out duration-300" enter-from="opacity-0" enter-to="opacity-100"
        leave="ease-in duration-200" leave-from="opacity-100" leave-to="opacity-0">
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-gray-900/75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-50 w-screen overflow-y-auto">
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
                  class="mx-auto flex size-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10 sm:mx-0 sm:size-10">
                  <ExclamationTriangleIcon class="size-6 text-red-600 dark:text-red-400" aria-hidden="true" />
                </div>
                <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                  <DialogTitle as="h3" class="text-base font-semibold text-gray-900 dark:text-white">
                    Delete {{ isBulk ? `${bulkCount} ${recordTypeLabelPlural}` : recordTypeLabel }}
                  </DialogTitle>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">
                      <span v-if="isBulk">
                        Are you sure you want to delete {{ bulkCount }} {{ bulkCount === 1 ? recordTypeLabel.toLowerCase() : recordTypeLabelPlural.toLowerCase() }}? This action cannot be undone.
                      </span>
                      <span v-else>
                        Are you sure you want to delete {{ recordName ? `"${recordName}"` : 'this ' + recordTypeLabel.toLowerCase() }}? This action cannot be undone.
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-0">
                <button type="button"
                  class="inline-flex w-full justify-center rounded-md bg-red-600 dark:bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 dark:hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 dark:focus-visible:outline-red-500 sm:ml-3 sm:w-auto"
                  :disabled="deleting"
                  @click="handleConfirm">
                  <span v-if="deleting">Deleting...</span>
                  <span v-else>Delete</span>
                </button>
                <button type="button"
                  class="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-500 sm:mt-0 sm:w-auto"
                  :disabled="deleting"
                  @click="handleClose">
                  Cancel
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
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';

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
  }
});

const emit = defineEmits(['close', 'confirm']);

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
    'events': 'Event'
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
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
    'events': 'Events'
  };
  return labels[type] || (recordTypeLabel.value + 's');
});

const handleClose = () => {
  if (!props.deleting) {
    emit('close');
  }
};

const handleConfirm = () => {
  if (!props.deleting) {
    emit('confirm');
  }
};
</script>

