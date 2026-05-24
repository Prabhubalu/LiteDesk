<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    @click.self="handleCancel"
  >
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="flex-shrink-0 w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
          <svg class="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            {{ t('forms.dupActiveTitle') }}
          </h3>
        </div>
        <button
          type="button"
          :aria-label="t('actions.close')"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="handleCancel"
        >
          <svg class="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p class="text-sm text-gray-600 dark:text-gray-400 mb-6">
        {{ t('forms.dupActiveBody') }}
      </p>

      <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6">
        <p class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
          {{ t('forms.dupWhatHappensHeading') }}
        </p>
        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ t('forms.dupBulletDraft') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ t('forms.dupBulletEditable') }}</span>
          </li>
          <li class="flex items-start gap-2">
            <svg class="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>{{ t('forms.dupBulletOriginal') }}</span>
          </li>
        </ul>
      </div>

      <div class="flex justify-end gap-3">
        <button
          type="button"
          class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          @click="handleCancel"
        >
          {{ t('actions.cancel') }}
        </button>
        <button
          type="button"
          :disabled="duplicating"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          @click="handleDuplicate"
        >
          <span v-if="duplicating">{{ t('states.saving') }}</span>
          <span v-else>{{ t('forms.dupDuplicateEdit') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useRouter } from 'vue-router';
import { useTabs } from '@/composables/useTabs';

const { t } = useI18n();

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  formId: {
    type: String,
    default: null
  },
  formName: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['close', 'duplicated']);

const router = useRouter();
const { openTab } = useTabs();
const duplicating = ref(false);

const handleCancel = () => {
  emit('close');
};

const handleDuplicate = async () => {
  if (!props.formId) {
    alert(t('forms.dupFormIdRequired'));
    return;
  }

  duplicating.value = true;
  try {
    const response = await apiClient.post(`/forms/${props.formId}/duplicate`);

    if (response.success && response.data) {
      const duplicatedForm = response.data;
      const formId = duplicatedForm._id;
      openTab(`/forms/builder/${formId}`, {
        name: `form-builder-${formId}`,
        title: duplicatedForm.name || t('forms.formBuilderTabTitle'),
        component: 'FormBuilder',
        params: { formId },
        insertAdjacent: true
      });
      router.push(`/forms/builder/${formId}`);

      emit('duplicated', duplicatedForm);
      emit('close');
    } else {
      alert(response.message || t('forms.dupFailed'));
    }
  } catch (error) {
    console.error('Error duplicating form:', error);
    const errorMessage = error.response?.data?.message || error.message || t('forms.dupFailed');
    alert(errorMessage);
  } finally {
    duplicating.value = false;
  }
};
</script>
