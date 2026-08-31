<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { apiClient } from '@/api/client'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'

type RelatedValue = { type: string; id: string | null }
type RelatedOption = { _id: string; label: string }

const TYPE_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'contact', label: 'People' },
  { value: 'deal', label: 'Deal' },
  { value: 'organization', label: 'Organization' },
  { value: 'project', label: 'Project' }
] as const

const TYPE_CONFIG: Record<string, { label: string; endpoint: string; displayField: string }> = {
  contact: { label: 'People', endpoint: '/people', displayField: 'name' },
  deal: { label: 'Deal', endpoint: '/deals', displayField: 'name' },
  organization: { label: 'Organization', endpoint: '/v2/organization', displayField: 'name' },
  project: { label: 'Project', endpoint: '/projects', displayField: 'name' }
}

const props = withDefaults(
  defineProps<{
    modelValue: RelatedValue
    label?: string
    required?: boolean
    disabled?: boolean
  }>(),
  {
    label: 'Related to',
    required: false,
    disabled: false
  }
)

const emit = defineEmits<{ 'update:modelValue': [value: RelatedValue] }>()

const typeOpen = ref(false)
const recordOpen = ref(false)
const search = ref('')
const loading = ref(false)
const options = ref<RelatedOption[]>([])

const localType = computed(() => normalizeType(props.modelValue?.type))
const localId = computed(() => props.modelValue?.id || '')

const typeLabel = computed(
  () => TYPE_OPTIONS.find((option) => option.value === localType.value)?.label || 'None'
)

const selectedLabel = computed(() => {
  if (!localId.value) return ''
  return options.value.find((row) => row._id === localId.value)?.label || ''
})

function normalizeType(value: string | undefined): string {
  const next = String(value || 'none').toLowerCase()
  return TYPE_OPTIONS.some((option) => option.value === next) ? next : 'none'
}

function emitValue(type: string, id: string | null) {
  emit('update:modelValue', { type, id })
}

function pickType(value: string) {
  emitValue(value, null)
  typeOpen.value = false
  if (value !== 'none') {
    recordOpen.value = true
  }
}

function pickRecord(id: string) {
  emitValue(localType.value, id)
  recordOpen.value = false
}

function optionLabel(record: Record<string, unknown>, displayField: string): string {
  const direct = record[displayField] || record.name || record.title || record.subject
  if (direct) return String(direct)
  const first = record.first_name || record.firstName
  const last = record.last_name || record.lastName
  if (first) return `${first}${last ? ` ${last}` : ''}`.trim()
  return 'Record'
}

function extractRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return []
  const payload = body as Record<string, unknown>
  if (Array.isArray(payload.data)) return payload.data as Record<string, unknown>[]
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>
    if (Array.isArray(nested.records)) return nested.records as Record<string, unknown>[]
    if (Array.isArray(nested.data)) return nested.data as Record<string, unknown>[]
  }
  if (Array.isArray(payload.records)) return payload.records as Record<string, unknown>[]
  return []
}

async function loadRecords() {
  const config = TYPE_CONFIG[localType.value]
  if (!config) {
    options.value = []
    return
  }
  loading.value = true
  try {
    const query = search.value.trim()
    const path = `${config.endpoint}?page=1&limit=30${query ? `&search=${encodeURIComponent(query)}` : ''}`
    const appKey = localType.value === 'organization' ? 'PLATFORM' : undefined
    const res = await apiClient.get<unknown>(path, { appKey })
    options.value = extractRecords(res)
      .map((record) => ({
        _id: String(record._id || record.id || ''),
        label: optionLabel(record, config.displayField)
      }))
      .filter((row) => row._id)
  } catch {
    options.value = []
  } finally {
    loading.value = false
  }
}

const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return options.value
  return options.value.filter((row) => row.label.toLowerCase().includes(query))
})

watch(recordOpen, (isOpen) => {
  if (!isOpen) return
  search.value = ''
  void loadRecords()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(search, () => {
  if (!recordOpen.value) return
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void loadRecords(), 220)
})
</script>

<template>
  <div class="related-field">
    <label class="related-field__label">
      {{ label }}
      <span v-if="required" class="related-field__required" aria-hidden="true">*</span>
    </label>

    <div class="related-field__row">
      <button type="button" class="related-field__type" :disabled="disabled" @click="typeOpen = true">
        <span>{{ typeLabel }}</span>
        <ChevronDownIcon class="related-field__chevron" aria-hidden="true" />
      </button>

      <button
        v-if="localType !== 'none'"
        type="button"
        class="related-field__record"
        :disabled="disabled"
        @click="recordOpen = true"
      >
        <span v-if="selectedLabel" class="related-field__value">{{ selectedLabel }}</span>
        <span v-else class="related-field__placeholder">Select record…</span>
        <ChevronDownIcon class="related-field__chevron" aria-hidden="true" />
      </button>
    </div>

    <MobileBottomSheet :open="typeOpen" title="Related type" compact @close="typeOpen = false">
      <div class="related-picker">
        <button
          v-for="option in TYPE_OPTIONS"
          :key="option.value"
          type="button"
          class="related-picker__option"
          :class="{ 'related-picker__option--active': localType === option.value }"
          @click="pickType(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </MobileBottomSheet>

    <MobileBottomSheet
      :open="recordOpen"
      :title="TYPE_CONFIG[localType]?.label || 'Record'"
      tall
      compact
      @close="recordOpen = false"
    >
      <div class="related-picker">
        <div class="related-picker__search">
          <MagnifyingGlassIcon class="related-picker__search-icon" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            class="related-picker__search-input"
            placeholder="Search records…"
            autocomplete="off"
          />
        </div>

        <p v-if="loading" class="related-picker__status">Loading…</p>
        <p v-else-if="!filteredOptions.length" class="related-picker__status">No matches found.</p>

        <button
          v-for="option in filteredOptions"
          :key="option._id"
          type="button"
          class="related-picker__option"
          :class="{ 'related-picker__option--active': localId === option._id }"
          @click="pickRecord(option._id)"
        >
          {{ option.label }}
        </button>
      </div>
    </MobileBottomSheet>
  </div>
</template>

<style scoped>
.related-field {
  display: grid;
  gap: 0.4rem;
  min-width: 0;
}

.related-field__label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text);
}

.related-field__required {
  margin-left: 0.15rem;
  color: var(--danger);
}

.related-field__row {
  display: grid;
  grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.35fr);
  gap: 0.5rem;
  min-width: 0;
}

.related-field__type,
.related-field__record {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.7rem 0.8rem;
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  border-radius: 0.75rem;
  background: var(--bg-elevated);
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  text-align: left;
}

.related-field__placeholder {
  color: color-mix(in srgb, var(--text-muted) 88%, transparent);
}

.related-field__value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.related-field__chevron {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
  color: var(--text-muted);
  flex-shrink: 0;
}

.related-picker {
  display: grid;
  gap: 0.45rem;
}

.related-picker__search {
  position: relative;
}

.related-picker__search-icon {
  position: absolute;
  left: 0.85rem;
  top: 50%;
  width: 1rem;
  height: 1rem;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.related-picker__search-input {
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

.related-picker__status {
  margin: 0.35rem 0;
  color: var(--text-muted);
  font-size: 0.875rem;
}

.related-picker__option {
  width: 100%;
  min-height: 2.75rem;
  padding: 0.65rem 0.75rem;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.9375rem;
  text-align: left;
}

.related-picker__option--active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-elevated));
  font-weight: 600;
}
</style>
