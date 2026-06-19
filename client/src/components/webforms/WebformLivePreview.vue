<template>
  <div class="overflow-visible rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
    <p class="overflow-hidden rounded-t-xl border-b border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {{ t('webforms.builderPreviewInline') }}
    </p>
    <div class="overflow-visible p-4 sm:p-0">
      <div v-if="previewSubmitted" class="rounded-xl border border-emerald-200 bg-white p-8 text-center dark:border-emerald-900/40 dark:bg-gray-800">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">{{ t('webforms.publicSuccessTitle') }}</h2>
        <p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {{ webform.thankYouMessage || t('webforms.builderPreviewSubmitNote') }}
        </p>
        <button
          type="button"
          class="mt-4 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          @click="resetPreview"
        >
          {{ t('webforms.builderPreviewReset') }}
        </button>
      </div>
      <WebformFillForm
        v-else
        :webform="webform"
        v-model="formData"
        preview
        @submit="handlePreviewSubmit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import WebformFillForm from '@/components/webforms/WebformFillForm.vue';
import { isFileFieldType, normalizeWebformFieldType } from '@/utils/webformFieldTypeUtils';

const props = defineProps({
  webform: { type: Object, required: true }
});

const { t } = useI18n();
const formData = ref({});
const previewSubmitted = ref(false);

const webform = computed(() => props.webform || {});

function initFormData() {
  const next = {};
  const fields = Array.isArray(props.webform?.fields) ? props.webform.fields : [];
  for (const field of fields) {
    const type = normalizeWebformFieldType(field.type);
    if (type === 'Checkbox') {
      next[field.fieldId] = false;
    } else if (isFileFieldType(type)) {
      next[field.fieldId] = null;
    } else {
      next[field.fieldId] = '';
    }
  }
  formData.value = next;
}

function handlePreviewSubmit() {
  previewSubmitted.value = true;
}

function resetPreview() {
  previewSubmitted.value = false;
  initFormData();
}

watch(
  () => [
    props.webform?.fields,
    props.webform?.moduleFields,
    props.webform?.targetModuleKey,
    props.webform?.multiStep,
    props.webform?.steps
  ],
  () => {
    previewSubmitted.value = false;
    initFormData();
  },
  { deep: true, immediate: true }
);
</script>
