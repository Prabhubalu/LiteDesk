<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { fetchLookupOptions, type LookupOption } from '@/api/lookupOptions'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileAvatar from '@/components/MobileAvatar.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    targetModule: string
    required?: boolean
    placeholder?: string
    disabled?: boolean
    appKey?: string
  }>(),
  {
    required: false,
    placeholder: '',
    disabled: false,
    appKey: undefined
  }
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const search = ref('')
const loading = ref(false)
const options = ref<LookupOption[]>([])

const selected = computed(() => options.value.find((row) => row.id === props.modelValue) || null)

const displayValue = computed(() => selected.value?.label || '')

async function loadOptions() {
  if (!props.targetModule) return
  loading.value = true
  try {
    options.value = await fetchLookupOptions(props.targetModule, search.value, props.appKey)
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

function openPicker() {
  if (props.disabled) return
  open.value = true
}

function pick(option: LookupOption) {
  emit('update:modelValue', option.id)
  open.value = false
}

function clearSelection() {
  emit('update:modelValue', '')
}

watch(
  () => [props.modelValue, props.targetModule] as const,
  ([value, target]) => {
    if (!value || !target) return
    if (options.value.some((row) => row.id === value)) return
    void loadOptions()
  },
  { immediate: true }
)

watch(open, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  void loadOptions()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (!open.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadOptions(), 220)
})
</script>

<template>
  <div class="lookup-field">
    <label class="lookup-field__label" :for="`lookup-${label}`">
      {{ label }}
      <span v-if="required" class="lookup-field__required" aria-hidden="true">*</span>
    </label>

    <button
      :id="`lookup-${label}`"
      type="button"
      class="lookup-field__trigger"
      :disabled="disabled || !targetModule"
      @click="openPicker"
    >
      <span v-if="displayValue" class="lookup-field__value">
        <MobileAvatar
          v-if="targetModule === 'users' && selected"
          :user="{ name: selected.label, avatar: selected.avatar }"
          size="sm"
        />
        {{ displayValue }}
      </span>
      <span v-else class="lookup-field__placeholder">{{ placeholder || `Select ${label.toLowerCase()}…` }}</span>
      <ChevronDownIcon class="lookup-field__chevron" aria-hidden="true" />
    </button>

    <MobileBottomSheet :open="open" :title="label" tall compact @close="open = false">
      <div class="lookup-picker">
        <div class="lookup-picker__search">
          <MagnifyingGlassIcon class="lookup-picker__search-icon" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            class="lookup-picker__search-input"
            :placeholder="`Search ${label.toLowerCase()}…`"
            autocomplete="off"
          />
        </div>

        <button
          v-if="modelValue"
          type="button"
          class="lookup-picker__clear"
          @click="clearSelection(); open = false"
        >
          Clear selection
        </button>

        <p v-if="loading" class="lookup-picker__status">Loading…</p>
        <p v-else-if="!options.length" class="lookup-picker__status">No matches found.</p>

        <button
          v-for="option in options"
          :key="option.id"
          type="button"
          class="lookup-picker__option"
          :class="{ 'lookup-picker__option--active': modelValue === option.id }"
          @click="pick(option)"
        >
          <MobileAvatar
            v-if="targetModule === 'users'"
            :user="{ name: option.label, avatar: option.avatar }"
            size="md"
          />
          <span class="lookup-picker__copy">
            <span class="lookup-picker__label">{{ option.label }}</span>
            <span v-if="option.subtitle" class="lookup-picker__subtitle">{{ option.subtitle }}</span>
          </span>
        </button>
      </div>
    </MobileBottomSheet>
  </div>
</template>

<style scoped>
.lookup-field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.lookup-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
}

.lookup-field__required {
  margin-left: 0.15rem;
  color: var(--danger);
}

.lookup-field__trigger {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  min-height: 2.75rem;
  padding: 0.7rem 0.9rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  text-align: left;
}

.lookup-field__value {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-width: 0;
  flex: 1;
}

.lookup-field__placeholder {
  flex: 1;
  color: color-mix(in srgb, var(--text-muted) 88%, transparent);
}

.lookup-field__chevron {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
  color: var(--text-muted);
  flex-shrink: 0;
}

.lookup-picker {
  display: grid;
  gap: 0.45rem;
}

.lookup-picker__search {
  position: relative;
}

.lookup-picker__search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.lookup-picker__search-input {
  width: 100%;
  min-height: 2.65rem;
  padding: 0.65rem 0.9rem 0.65rem 2.35rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text);
  font: inherit;
  font-size: 1rem;
}

.lookup-picker__clear {
  justify-self: start;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
}

.lookup-picker__status {
  margin: 0.35rem 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.lookup-picker__option {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.85rem;
  padding: 0.55rem 0.7rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  text-align: left;
}

.lookup-picker__option--active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
}

.lookup-picker__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.lookup-picker__label {
  font-size: 0.9375rem;
  font-weight: 600;
}

.lookup-picker__subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
