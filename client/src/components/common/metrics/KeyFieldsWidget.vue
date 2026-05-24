<template>
  <CardWidget :title="t('common.keyFieldsTitle')">
    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-8">
      <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
    </div>

    <!-- Key Fields List -->
    <div
      v-else-if="keyFields.length > 0"
      :class="[
        isMobileLayout ? 'flex flex-col gap-3' : 'flex flex-wrap gap-x-4 gap-y-3'
      ]"
    >
      <div
        v-for="fieldDef in keyFields"
        :key="fieldDef.key"
        :class="[
          'flex flex-col',
          isMobileLayout ? 'w-full' : ''
        ]"
      >
        <div class="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          {{ fieldDef.label }}
        </div>
        <div class="text-sm text-gray-900 dark:text-white">
          <template v-if="getFieldValueForDisplay(fieldDef)">
            {{ getFieldValueForDisplay(fieldDef) }}
          </template>
          <span v-else class="text-gray-400 dark:text-gray-500 italic">{{ t('common.keyFieldsEmptyValue') }}</span>
        </div>
      </div>
    </div>
    <!-- Empty State -->
    <div v-else class="text-center py-8">
      <KeyIcon class="mx-auto h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" />
      <p class="text-sm text-gray-500 dark:text-gray-400">{{ t('common.keyFieldsNone') }}</p>
      <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">{{ t('common.keyFieldsHint') }}</p>
    </div>
  </CardWidget>
</template>

<script setup>
import { ref, computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
import CardWidget from '@/components/common/CardWidget.vue';
import { getKeyFields, getFieldValue } from '@/utils/fieldDisplay';
import { KeyIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  record: {
    type: Object,
    required: true
  },
  recordType: {
    type: String,
    required: true
  },
  moduleDefinition: {
    type: Object,
    required: true
  }
});

const loading = ref(false);

const recordLayoutIsMobile = inject('recordLayoutIsMobile', null);
const isMobileLayout = computed(() => Boolean(recordLayoutIsMobile?.value));

// Get key fields from module definition
const keyFields = computed(() => {
  return getKeyFields(props.moduleDefinition);
});

// Get field value from record
const getFieldValueForDisplay = (fieldDef) => {
  return getFieldValue(fieldDef, props.record);
};
</script>


