<template>
  <TransitionRoot as="template" :show="isOpen">
    <Dialog class="relative z-50" @close="handleClose">
      <TransitionChild
        as="template"
        enter="ease-out duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500/75 dark:bg-black/75" />
      </TransitionChild>

      <div class="fixed inset-0 overflow-hidden">
        <div class="absolute inset-0 overflow-hidden flex items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="ease-out duration-200"
            enter-from="opacity-0 scale-95"
            enter-to="opacity-100 scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 scale-100"
            leave-to="opacity-0 scale-95"
          >
            <DialogPanel class="w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all">
              <div class="p-6">
                <div class="flex items-start">
                  <div class="flex-shrink-0">
                    <ExclamationTriangleIcon
                      class="h-6 w-6 text-red-600 dark:text-red-400"
                      aria-hidden="true"
                    />
                  </div>
                  <div class="ml-3 flex-1">
                    <DialogTitle class="text-base font-semibold text-gray-900 dark:text-white">
                      Unlink {{ relationship.label }}?
                    </DialogTitle>
                    <div class="mt-2">
                      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('records.relationshipUnlinkConfirmAreYouSureYouWantTo') }}<span class="font-medium text-gray-900 dark:text-white">
                          {{ getRecordLabelForDisplay(record) }}
                        </span>
                        from this record?
                      </p>
                      <p
                        v-if="relationship.cascade"
                        class="mt-2 text-xs text-yellow-600 dark:text-yellow-400"
                      >
                        ⚠️ This relationship has cascade rules. Unlinking may affect related records.
                      </p>
                    </div>
                  </div>
                </div>
                <div class="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    class="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-xs ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    @click="handleClose"
                  >{{ t('performance.cancelWizard') }}</button>
                  <button
                    type="button"
                    class="inline-flex justify-center rounded-md bg-red-600 dark:bg-red-500 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-red-500 dark:hover:bg-red-600"
                    @click="confirmUnlink"
                  >{{ t('records.relatedUnlink') }}</button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { ref } from 'vue';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  relationship: { type: Object, required: true },
  record: { type: Object, required: true },
  sourceRecord: { type: Object, default: null }
});

const { t } = useI18n();

const emit = defineEmits(['close', 'confirmed']);

const loading = ref(false);

import { getRecordLabel } from '@/utils/recordDisplay';

// Get display label for a record (re-exported from utils)
const getRecordLabelForDisplay = getRecordLabel;

const handleClose = () => {
  emit('close');
};

const confirmUnlink = async () => {
  if (!props.sourceRecord) {
    console.error('[RelationshipUnlinkConfirm] Missing sourceRecord');
    return;
  }

  loading.value = true;

  try {
    await apiClient.post('/relationships/unlink', {
      relationshipKey: props.relationship.relationshipKey,
      source: {
        appKey: props.sourceRecord.appKey,
        moduleKey: props.sourceRecord.moduleKey,
        recordId: props.sourceRecord.recordId
      },
      target: {
        appKey: props.record.appKey,
        moduleKey: props.record.moduleKey,
        recordId: props.record.id
      }
    });

    emit('confirmed');
    handleClose();
  } catch (error) {
    console.error('[RelationshipUnlinkConfirm] Error unlinking record:', error);
    // Could emit an error event here if needed
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
</style>

