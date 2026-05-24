<template>
  <div class="space-y-3">
    <div v-for="field in paramFields" :key="field.key">
      <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {{ field.label }}
        <span v-if="field.required" class="text-red-500">*</span>
      </label>
      <HeadlessSelect
        v-if="field.type === 'select'"
        :model-value="params[field.key] ?? field.defaultValue ?? ''"
        :options="field.options || []"
        :button-class="PROCESS_SELECT_BUTTON_CLASS"
        @update:model-value="(v) => setParam(field.key, v)"
      />
      <textarea
        v-else-if="field.type === 'textarea'"
        :value="params[field.key] ?? ''"
        rows="2"
        :placeholder="field.placeholder"
        class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
        @input="setParam(field.key, $event.target.value)"
      />
      <input
        v-else-if="field.type === 'number'"
        :value="params[field.key] ?? ''"
        type="number"
        :placeholder="field.placeholder"
        class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
        @input="setParam(field.key, $event.target.value === '' ? null : Number($event.target.value))"
      />
      <input
        v-else
        :value="params[field.key] ?? ''"
        type="text"
        :placeholder="field.placeholder"
        class="w-full px-2 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
        @input="setParam(field.key, $event.target.value)"
      />
    </div>
    <p v-if="actionDef?.description" class="text-[10px] text-gray-500 leading-snug">{{ actionDef.description }}</p>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import HeadlessSelect from '@/components/ui/HeadlessSelect.vue';
import { PROCESS_SELECT_BUTTON_CLASS } from '@/utils/processDesignerConstants';

const props = defineProps({
  actionDef: { type: Object, default: null },
  params: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:params']);

const { t } = useI18n();

const paramFields = computed(() => props.actionDef?.params || []);

function setParam(key, value) {
  emit('update:params', { ...props.params, [key]: value });
}
</script>
