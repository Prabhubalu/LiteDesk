<script setup lang="ts">
import { ref } from 'vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    ariaLabel?: string
    clearable?: boolean
  }>(),
  {
    placeholder: 'Search…',
    ariaLabel: 'Search',
    clearable: true
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  clear: []
  submit: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)

function focus() {
  inputEl.value?.focus()
}

defineExpose({ focus })

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}

function onClear() {
  emit('update:modelValue', '')
  emit('clear')
}
</script>

<template>
  <label class="search-field mobile-search">
    <span class="sr-only">{{ ariaLabel }}</span>
    <MagnifyingGlassIcon class="mobile-search__icon" aria-hidden="true" />
    <input
      ref="inputEl"
      :value="modelValue"
      type="search"
      inputmode="search"
      :placeholder="placeholder"
      :aria-label="ariaLabel"
      autocomplete="off"
      :class="{ 'mobile-search__input--clearable': clearable }"
      @input="onInput"
      @keydown.enter.prevent="emit('submit')"
    />
    <button
      v-if="clearable && modelValue"
      type="button"
      class="mobile-search__clear"
      aria-label="Clear search"
      @click="onClear"
    >
      ×
    </button>
  </label>
</template>

<style scoped>
.mobile-search {
  position: relative;
  display: block;
}

.mobile-search__icon {
  position: absolute;
  left: 0.95rem;
  top: 50%;
  width: 1.05rem;
  height: 1.05rem;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.mobile-search input {
  height: 2.5rem;
  width: 100%;
  padding: 0 0.95rem 0 2.55rem;
  border: 1px solid var(--border);
  border-radius: var(--toolbar-r, 0.65rem);
  background: var(--bg-elevated);
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  line-height: 1.2;
}

.mobile-search input::placeholder {
  color: var(--text-muted);
}

.mobile-search input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 0 0 2px rgba(96, 73, 231, 0.22);
}

.mobile-search__input--clearable {
  padding-right: 2.4rem;
}

.mobile-search input::-webkit-search-cancel-button {
  display: none;
}

.mobile-search__clear {
  position: absolute;
  right: 0.55rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 16%, transparent);
  color: var(--text-muted);
  font-size: 1.05rem;
  line-height: 1;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
