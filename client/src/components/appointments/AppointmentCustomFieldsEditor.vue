<template>
  <section class="rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm dark:border-gray-700/80 dark:bg-gray-900/80">
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ t('appointments.customFieldsHeading') }}</h2>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {{ t('appointments.customFieldsHint') }}
      </p>
    </div>

    <div class="mt-5">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('appointments.defaultQuestionsHeading') }}</h3>
      <div class="mt-3 space-y-2">
        <div
          v-for="field in DEFAULT_BOOKING_GUEST_FIELDS"
          :key="field.key"
          class="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/40"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-gray-900 dark:text-white">
              {{ t(field.labelKey) }}
              <span v-if="field.required" class="text-red-500">*</span>
            </p>
            <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {{ fieldTypeLabel(field.type) }}
              <span v-if="field.required"> · {{ t('appointments.fieldRequired') }}</span>
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {{ t('appointments.defaultQuestionBadge') }}
          </span>
        </div>
      </div>
    </div>

    <div class="mt-6 flex items-start justify-between gap-3">
      <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ t('appointments.additionalQuestionsHeading') }}</h3>
      <button
        type="button"
        class="shrink-0 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
        :disabled="fields.length >= maxFields"
        @click="addField"
      >
        {{ t('appointments.addQuestion') }}
      </button>
    </div>

    <p v-if="!fields.length" class="mt-3 rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500 dark:border-gray-700">
      {{ t('appointments.noCustomQuestions') }}
    </p>

    <div v-else class="mt-3 space-y-4">
      <div
        v-for="(field, idx) in fields"
        :key="field._localId || field.key || idx"
        class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-gray-400">{{ t('appointments.questionN', { n: idx + 1 }) }}</span>
          <button
            type="button"
            class="text-sm text-red-600 hover:underline dark:text-red-400"
            @click="removeField(idx)"
          >
            {{ t('actions.remove') }}
          </button>
        </div>
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.fieldLabel') }}</label>
            <input
              v-model="field.label"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :placeholder="t('appointments.labelPhCompany')"
              @blur="syncKey(field)"
            />
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.fieldType') }}</label>
            <select
              v-model="field.type"
              class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              @change="onTypeChange(field)"
            >
              <option value="text">{{ t('appointments.fieldTypeText') }}</option>
              <option value="textarea">{{ t('appointments.fieldTypeTextarea') }}</option>
              <option value="email">{{ t('appointments.fieldTypeEmail') }}</option>
              <option value="phone">{{ t('appointments.fieldTypePhone') }}</option>
              <option value="select">{{ t('appointments.fieldTypeSelect') }}</option>
            </select>
          </div>
          <div>
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.fieldKey') }}</label>
            <input
              v-model="field.key"
              type="text"
              class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              :placeholder="t('appointments.keyPhCompany')"
            />
          </div>
        </div>
        <label class="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input v-model="field.required" type="checkbox" class="rounded border-gray-300 text-indigo-600" />
          {{ t('appointments.fieldRequired') }}
        </label>
        <div v-if="field.type === 'select'" class="mt-3">
          <label class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ t('appointments.fieldOptions') }}</label>
          <textarea
            :value="optionsText(field)"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            :placeholder="t('appointments.optionsPh')"
            @input="setOptionsFromText(field, $event.target.value)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { DEFAULT_BOOKING_GUEST_FIELDS, slugifyClient } from '@/utils/appointmentFormatters';

const { t } = useI18n();

const fields = defineModel({ type: Array, default: () => [] });

const props = defineProps({
  maxFields: { type: Number, default: 12 }
});

const FIELD_TYPE_LABEL_KEYS = {
  text: 'appointments.fieldTypeText',
  textarea: 'appointments.fieldTypeTextarea',
  email: 'appointments.fieldTypeEmail',
  phone: 'appointments.fieldTypePhone',
  select: 'appointments.fieldTypeSelect'
};

function fieldTypeLabel(type) {
  const key = FIELD_TYPE_LABEL_KEYS[type];
  return key ? t(key) : type;
}

let localId = 0;

function addField() {
  if (fields.value.length >= props.maxFields) return;
  fields.value = [
    ...fields.value,
    {
      _localId: `cf-${++localId}`,
      key: `question_${fields.value.length + 1}`,
      label: '',
      type: 'text',
      required: false,
      options: []
    }
  ];
}

function removeField(idx) {
  const next = [...fields.value];
  next.splice(idx, 1);
  fields.value = next;
}

function syncKey(field) {
  if (!field.label?.trim()) return;
  if (!field.key || field.key.startsWith('question_')) {
    field.key = slugifyClient(field.label).replace(/-/g, '_') || field.key;
  }
}

function onTypeChange(field) {
  if (field.type === 'select' && !field.options?.length) {
    field.options = ['Option 1', 'Option 2'];
  }
}

function optionsText(field) {
  return (field.options || []).join('\n');
}

function setOptionsFromText(field, text) {
  field.options = String(text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
</script>
