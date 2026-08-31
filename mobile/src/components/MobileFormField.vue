<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import type { MobileCreateFieldType } from '@/api/recordCreate'
import MobileLookupField from '@/components/MobileLookupField.vue'
import MobileRelatedToField from '@/components/MobileRelatedToField.vue'

export type FormFieldValue =
  | string
  | boolean
  | string[]
  | { type: string; id: string | null }

const props = withDefaults(
  defineProps<{
    modelValue: FormFieldValue
    label: string
    fieldKey?: string
    type?: MobileCreateFieldType
    required?: boolean
    placeholder?: string
    options?: Array<{ value: string; label: string }>
    lookupTarget?: string
    appKey?: string
    prominent?: boolean
    error?: string | null
    disabled?: boolean
  }>(),
  {
    fieldKey: '',
    type: 'text',
    required: false,
    placeholder: '',
    options: () => [],
    lookupTarget: '',
    appKey: undefined,
    prominent: false,
    error: null,
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: FormFieldValue]
}>()

const tagDraft = ref('')

const displayLabel = computed(() => {
  const raw = props.label.trim()
  if (!raw) return ''
  if (raw === raw.toUpperCase() && raw.length > 2) {
    return raw.charAt(0) + raw.slice(1).toLowerCase()
  }
  return raw
})

const isCheckbox = computed(() => props.type === 'checkbox')
const isTextarea = computed(() => {
  if (props.type === 'textarea') return true
  const key = props.fieldKey.toLowerCase().trim()
  return ['description', 'notes', 'note', 'comments', 'comment', 'body', 'details'].includes(key)
})
const isSelect = computed(() => props.type === 'select')
const isRadio = computed(() => props.type === 'radio')
const isMultiSelect = computed(() => props.type === 'multi-select')
const isTags = computed(() => props.type === 'tags')
const isLookup = computed(() => props.type === 'lookup')
const isRelatedTo = computed(() => props.type === 'related-to')

const selectedValues = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))

const relatedValue = computed(() => {
  if (props.modelValue && typeof props.modelValue === 'object' && !Array.isArray(props.modelValue)) {
    const value = props.modelValue as { type?: string; id?: string | null }
    return { type: String(value.type || 'none'), id: value.id ?? null }
  }
  return { type: 'none', id: null }
})

const inputType = computed(() => {
  switch (props.type) {
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'number':
      return 'number'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime-local'
    case 'url':
      return 'url'
    default:
      return 'text'
  }
})

const inputMode = computed(() => {
  switch (props.type) {
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    case 'number':
      return 'decimal'
    default:
      return undefined
  }
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  emit('update:modelValue', target.value)
}

function onCheckbox(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).checked)
}

function onChipSelect(value: string) {
  if (props.disabled) return
  emit('update:modelValue', value)
}

function toggleMultiValue(value: string) {
  if (props.disabled) return
  const current = new Set(selectedValues.value)
  if (current.has(value)) current.delete(value)
  else current.add(value)
  emit('update:modelValue', Array.from(current))
}

function addTag() {
  const next = tagDraft.value.trim()
  if (!next) return
  const current = new Set(selectedValues.value)
  if (current.has(next)) {
    tagDraft.value = ''
    return
  }
  current.add(next)
  tagDraft.value = ''
  emit('update:modelValue', Array.from(current))
}

function removeTag(value: string) {
  emit(
    'update:modelValue',
    selectedValues.value.filter((item) => item !== value)
  )
}
</script>

<template>
  <MobileLookupField
    v-if="isLookup"
    :model-value="String(modelValue ?? '')"
    :label="displayLabel"
    :target-module="lookupTarget"
    :required="required"
    :placeholder="placeholder"
    :disabled="disabled"
    :app-key="appKey"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <MobileRelatedToField
    v-else-if="isRelatedTo"
    :model-value="relatedValue"
    :label="displayLabel"
    :required="required"
    :disabled="disabled"
    @update:model-value="emit('update:modelValue', $event)"
  />

  <div
    v-else
    class="form-field"
    :class="{
      'form-field--checkbox': isCheckbox,
      'form-field--prominent': prominent,
      'form-field--error': Boolean(error)
    }"
  >
    <label v-if="!isCheckbox" class="form-field__label" :for="`field-${label}`">
      {{ displayLabel }}
      <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
    </label>

    <div v-if="isCheckbox" class="form-field__toggle-row">
      <span class="form-field__toggle-copy">
        <span class="form-field__label form-field__label--inline">{{ displayLabel }}</span>
        <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
      </span>
      <label class="form-field__switch">
        <input
          :id="`field-${label}`"
          type="checkbox"
          :checked="modelValue === true"
          :disabled="disabled"
          @change="onCheckbox"
        />
        <span class="form-field__switch-track" aria-hidden="true" />
      </label>
    </div>

    <div
      v-else-if="(isSelect || isRadio) && options.length"
      class="form-field__control-wrap"
    >
      <select
        v-if="isSelect"
        :id="`field-${label}`"
        class="form-field__control form-field__control--select"
        :value="String(modelValue ?? '')"
        :disabled="disabled"
        @change="onInput"
      >
        <option value="" disabled hidden>{{ placeholder || 'Select…' }}</option>
        <option v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <div v-else class="form-field__chips" role="radiogroup" :aria-label="displayLabel">
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          role="radio"
          class="form-field__chip"
          :class="{ 'form-field__chip--active': String(modelValue ?? '') === option.value }"
          :aria-checked="String(modelValue ?? '') === option.value"
          :disabled="disabled"
          @click="onChipSelect(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
      <ChevronDownIcon v-if="isSelect" class="form-field__chevron" aria-hidden="true" />
    </div>

    <div v-else-if="isMultiSelect" class="form-field__chips" role="group" :aria-label="displayLabel">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="form-field__chip"
        :class="{ 'form-field__chip--active': selectedValues.includes(option.value) }"
        :disabled="disabled"
        @click="toggleMultiValue(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-else-if="isTags" class="form-field__tags">
      <div v-if="selectedValues.length" class="form-field__chips">
        <span v-for="tag in selectedValues" :key="tag" class="form-field__tag">
          {{ tag }}
          <button type="button" class="form-field__tag-remove" :disabled="disabled" @click="removeTag(tag)">×</button>
        </span>
      </div>
      <input
        v-model="tagDraft"
        class="form-field__control"
        type="text"
        :placeholder="placeholder || 'Add tag and press enter'"
        :disabled="disabled"
        @keydown.enter.prevent="addTag"
      />
    </div>

    <textarea
      v-else-if="isTextarea"
      :id="`field-${label}`"
      class="form-field__control form-field__control--textarea"
      :value="String(modelValue ?? '')"
      :placeholder="placeholder"
      :disabled="disabled"
      rows="5"
      @input="onInput"
    />

    <div
      v-else-if="type === 'date' || type === 'datetime'"
      class="form-field__control-wrap form-field__control-wrap--date"
    >
      <input
        :id="`field-${label}`"
        class="form-field__control form-field__control--date"
        :type="inputType"
        :value="String(modelValue ?? '')"
        :disabled="disabled"
        @input="onInput"
      />
    </div>

    <input
      v-else
      :id="`field-${label}`"
      class="form-field__control"
      :class="{ 'form-field__control--prominent': prominent }"
      :type="inputType"
      :inputmode="inputMode"
      :value="String(modelValue ?? '')"
      :placeholder="placeholder"
      :disabled="disabled"
      :autocapitalize="type === 'email' ? 'none' : undefined"
      @input="onInput"
    />

    <p v-if="error" class="form-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
  max-width: 100%;
}

.form-field--checkbox {
  gap: 0;
}

.form-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text);
}

.form-field__label--inline {
  display: inline;
}

.form-field__required {
  margin-left: 0.15rem;
  color: var(--danger);
  font-weight: 700;
}

.form-field__control {
  display: block;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  line-height: 1.35;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.form-field__control::placeholder {
  color: color-mix(in srgb, var(--text-muted) 88%, transparent);
}

.form-field__control:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.form-field--error .form-field__control,
.form-field--error .form-field__control-wrap .form-field__control {
  border-color: color-mix(in srgb, var(--danger) 55%, var(--border));
}

.form-field__control--prominent {
  min-height: 3rem;
  font-size: 1rem;
  font-weight: 400;
}

.form-field__control--prominent:not(:placeholder-shown) {
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.form-field__control--prominent::placeholder {
  font-size: 1rem;
  font-weight: 400;
  letter-spacing: normal;
}

.form-field__control-wrap--date {
  display: flex;
  align-items: center;
  overflow: hidden;
  min-width: 0;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background 0.15s ease;
}

.form-field__control-wrap--date:focus-within {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.form-field--error .form-field__control-wrap--date {
  border-color: color-mix(in srgb, var(--danger) 55%, var(--border));
}

.form-field__control--date {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  -webkit-min-logical-width: 0;
}

.form-field__control--date:focus {
  border-color: transparent;
  box-shadow: none;
}

.form-field__control--date::-webkit-date-and-time-value {
  text-align: left;
}

.form-field__control--date::-webkit-datetime-edit {
  min-width: 0;
  overflow: hidden;
}

.form-field__control--date::-webkit-calendar-picker-indicator {
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  opacity: 0.55;
}

.form-field__control--textarea {
  min-height: 7.5rem;
  resize: vertical;
  line-height: 1.5;
}

.form-field__control-wrap {
  position: relative;
}

.form-field__control--select {
  appearance: none;
  padding-right: 2.25rem;
}

.form-field__chevron {
  position: absolute;
  right: 0.85rem;
  top: 50%;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.form-field__toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.85rem;
  min-height: 2.75rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
}

.form-field__switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.form-field__switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.form-field__switch-track {
  position: relative;
  display: block;
  width: 2.65rem;
  height: 1.55rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 28%, var(--bg-soft));
  transition: background 0.18s ease;
}

.form-field__switch-track::after {
  content: '';
  position: absolute;
  top: 0.18rem;
  left: 0.18rem;
  width: 1.2rem;
  height: 1.2rem;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
  transition: transform 0.18s ease;
}

.form-field__switch input:checked + .form-field__switch-track {
  background: var(--accent-strong);
}

.form-field__switch input:checked + .form-field__switch-track::after {
  transform: translateX(1.1rem);
}

.form-field__switch input:focus-visible + .form-field__switch-track {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}

.form-field__error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--danger);
}

.form-field__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  max-width: 100%;
  min-width: 0;
}

.form-field__chip {
  min-height: 2.25rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: var(--radius-pill);
  background: var(--bg-elevated);
  color: var(--text-muted);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease,
    box-shadow 0.15s ease;
}

.form-field__chip--active {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-elevated));
  color: var(--accent-strong);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 18%, transparent);
}

.form-field__chip:disabled {
  opacity: 0.55;
}

.form-field__tags {
  display: grid;
  gap: 0.55rem;
}

.form-field__tag {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 2rem;
  padding: 0.25rem 0.55rem;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 600;
}

.form-field__tag-remove {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1;
  padding: 0;
}
</style>
