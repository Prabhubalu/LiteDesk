<template>
  <TransitionRoot as="template" :show="true">
    <Dialog class="relative z-50" @close="$emit('close')">
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

      <div class="fixed inset-0 overflow-hidden flex items-center justify-center p-4">
        <TransitionChild
          as="template"
          enter="ease-out duration-200"
          enter-from="opacity-0 scale-95"
          enter-to="opacity-100 scale-100"
          leave="ease-in duration-200"
          leave-from="opacity-100 scale-100"
          leave-to="opacity-0 scale-95"
        >
          <DialogPanel class="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ t('process.rulePreviewHeading') }}
              </DialogTitle>
              <button
                type="button"
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                @click="$emit('close')"
              >
                <XMarkIcon class="w-6 h-6" />
              </button>
            </div>

            <div v-if="loading" class="text-center py-8">
              <div class="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            </div>

            <div v-else-if="error" class="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-300">
              {{ error }}
            </div>

            <div v-else-if="previewData" class="space-y-4">
              <div>
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.rulePreviewTestEvent') }}</h4>
                <pre class="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 overflow-auto">{{ JSON.stringify(previewData.testEvent, null, 2) }}</pre>
              </div>
              <div>
                <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">{{ t('process.rulePreviewPlannedActions') }}</h4>
                <div v-if="previewData.plan.length === 0" class="text-sm text-gray-500 dark:text-gray-400">
                  {{ t('process.rulePreviewNoActions') }}
                </div>
                <div v-else class="space-y-2">
                  <div
                    v-for="(action, idx) in previewData.plan"
                    :key="idx"
                    class="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                  >
                    <div class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ action.actionType }}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {{ t('process.rulePreviewRuleLabel', { name: action.ruleName }) }}
                    </div>
                    <pre class="text-xs mt-2 text-gray-500 dark:text-gray-400 overflow-auto">{{ JSON.stringify(action.actionParams, null, 2) }}</pre>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span>{{ t('process.rulePreviewExecuted', { count: previewData.executed }) }}</span>
                <span>{{ t('process.rulePreviewSkipped', { count: previewData.skipped }) }}</span>
                <span>{{ t('process.rulePreviewFailed', { count: previewData.failed }) }}</span>
              </div>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';

const { t } = useI18n();

const props = defineProps({
  rule: {
    type: Object,
    required: true
  }
});

defineEmits(['close']);

const loading = ref(true);
const error = ref(null);
const previewData = ref(null);

async function loadPreview() {
  loading.value = true;
  error.value = null;
  try {
    const res = await apiClient.post('/admin/automation-rules/preview', { rule: props.rule });
    previewData.value = res.data.data;
  } catch (err) {
    error.value = err.response?.data?.message || t('process.rulePreviewLoadFailed');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadPreview();
});
</script>
