<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="$emit('close')">
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">{{ t('process.testModalHeading') }}</h3>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">{{ t('process.testModalBody') }}</p>

      <div class="space-y-3">
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.testModalModuleHeading') }}</label>
          <HeadlessSelect
            v-model="form.entityType"
            :options="moduleOptions"
            :button-class="PROCESS_SELECT_BUTTON_CLASS"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.testModalSampleRecordHeading') }}</label>
          <ProcessRecordPicker v-model="form.entityId" :entity-type="form.entityType" />
          <p class="text-[10px] text-gray-500 mt-1">{{ t('process.testModalSyntheticHint') }}</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{{ t('process.testModalSampleJsonHeading') }}</label>
          <textarea
            v-model="form.stateJson"
            rows="3"
            :placeholder="t('process.testModalSampleJsonPh')"
            class="w-full px-2 py-1.5 text-sm font-mono rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
          />
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-2">
        <button type="button" class="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600" @click="$emit('close')">{{ t('actions.cancel') }}</button>
        <button type="button" class="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700" @click="submit">{{ t('process.testModalRunSimulation') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import ProcessRecordPicker from '@/components/process-flow/ProcessRecordPicker.vue';
import { getModuleOptions, PROCESS_SELECT_BUTTON_CLASS } from '@/utils/processDesignerConstants';

const { t } = useI18n();

const props = defineProps({
  defaultEntityType: { type: String, default: 'deal' }
});

const emit = defineEmits(['close', 'run']);

const moduleOptions = computed(() => getModuleOptions(t));

const form = ref({
  entityType: props.defaultEntityType,
  entityId: '',
  stateJson: ''
});

function submit() {
  let sampleEventState = {};
  if (form.value.stateJson.trim()) {
    try {
      sampleEventState = JSON.parse(form.value.stateJson);
    } catch {
      alert(t('process.testModalInvalidJson'));
      return;
    }
  }
  emit('run', {
    entityType: form.value.entityType,
    entityId: form.value.entityId || 'test-record',
    sampleEventState
  });
}
</script>
