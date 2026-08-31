<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getMobileCreateAction, getMobileModule } from '@/config/mobileModules'
import { useShellChrome } from '@/composables/useShellChrome'
import { useAuthStore } from '@/stores/auth'
import {
  applyCreateOwnerDefaultsToForm,
  applyCreateOwnerDefaultsToPayload,
  resolveCurrentUserId
} from '@/utils/recordCreateOwnerDefaults'
import {
  createModuleRecord,
  fetchQuickCreateFields,
  initialFieldValue,
  type MobileCreateField
} from '@/api/recordCreate'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileFormField, { type FormFieldValue } from '@/components/MobileFormField.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'
import { tapHaptic } from '@/utils/haptics'

const PROMINENT_KEYS = new Set(['title', 'name', 'subject', 'first_name', 'deal_name', 'organization_name'])

const router = useRouter()
const chrome = useShellChrome()
const auth = useAuthStore()

const fields = ref<MobileCreateField[]>([])
const values = ref<Record<string, FormFieldValue>>({})
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const moduleKey = computed(() => chrome.createModuleKey.value)
const open = computed(() => Boolean(moduleKey.value))
const moduleDef = computed(() => (moduleKey.value ? getMobileModule(moduleKey.value) : null))
const appKey = computed(() => moduleDef.value?.appKey)
const title = computed(() =>
  moduleKey.value ? getMobileCreateAction(moduleKey.value)?.label || 'Create' : 'Create'
)
const accentColor = computed(() => moduleDef.value?.accentColor || 'var(--accent)')

function isProminentField(field: MobileCreateField): boolean {
  return PROMINENT_KEYS.has(field.key.toLowerCase())
}

function fieldPlaceholder(field: MobileCreateField): string {
  if (field.placeholder) return field.placeholder
  if (field.type === 'select') return 'Select…'
  if (isProminentField(field)) {
    if (field.key.toLowerCase().includes('title')) return 'What needs to get done?'
    if (field.key.toLowerCase().includes('name')) return 'Enter name'
  }
  return ''
}

function isValueEmpty(field: MobileCreateField, value: FormFieldValue | undefined): boolean {
  if (field.type === 'checkbox') return false
  if (field.type === 'multi-select' || field.type === 'tags') {
    return !Array.isArray(value) || value.length === 0
  }
  if (field.type === 'related-to') {
    const related = value as { type?: string; id?: string | null } | undefined
    if (!related || related.type === 'none') return true
    return !related.id
  }
  return !String(value ?? '').trim()
}

const missingRequired = computed(() =>
  fields.value.some((field) => field.required && isValueEmpty(field, values.value[field.key]))
)

const canSubmit = computed(
  () => !loading.value && !saving.value && fields.value.length > 0 && !missingRequired.value
)

function resetForm() {
  fields.value = []
  values.value = {}
  error.value = null
}

async function loadFields(key: string) {
  loading.value = true
  error.value = null
  try {
    const loaded = await fetchQuickCreateFields(key, getMobileModule(key)?.appKey)
    fields.value = loaded
    const initialValues = Object.fromEntries(
      loaded.map((field) => [field.key, initialFieldValue(field)])
    )
    values.value = applyCreateOwnerDefaultsToForm(
      initialValues,
      key,
      resolveCurrentUserId(auth.user)
    ) as Record<string, FormFieldValue>
  } catch (err) {
    fields.value = []
    error.value = err instanceof Error ? err.message : 'Could not load the create form.'
  } finally {
    loading.value = false
  }
}

function buildPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  fields.value.forEach((field) => {
    const value = values.value[field.key]
    if (field.type === 'checkbox') {
      payload[field.key] = value === true
      return
    }
    if (field.type === 'multi-select' || field.type === 'tags') {
      if (Array.isArray(value) && value.length) payload[field.key] = value
      return
    }
    if (field.type === 'related-to') {
      const related = value as { type?: string; id?: string | null } | undefined
      if (!related || related.type === 'none' || !related.id) return
      payload[field.key] = { type: related.type, id: related.id }
      return
    }
    const text = String(value ?? '').trim()
    if (!text) return
    payload[field.key] = field.type === 'number' ? Number(text) : text
  })
  return payload
}

function recordIdOf(data: Record<string, unknown> | undefined): string {
  if (!data) return ''
  return String(data._id || data.id || '')
}

async function onSubmit() {
  const key = moduleKey.value
  if (!key || !canSubmit.value) return

  saving.value = true
  error.value = null
  try {
    const res = await createModuleRecord(
      key,
      applyCreateOwnerDefaultsToPayload(buildPayload(), key, resolveCurrentUserId(auth.user)),
      getMobileModule(key)?.appKey
    )
    if (res?.success === false) throw new Error(res.message || 'Record could not be created.')

    void tapHaptic()
    const recordId = recordIdOf(res?.data)
    chrome.closeCreateForm()
    if (recordId) {
      await router.push(key === 'tasks' ? `/tasks/${recordId}` : `/modules/${key}/${recordId}`)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Record could not be created.'
  } finally {
    saving.value = false
  }
}

watch(moduleKey, (key) => {
  resetForm()
  if (key) void loadFields(key)
})
</script>

<template>
  <MobileBottomSheet
    :open="open"
    aria-label="Create record"
    tall
    @close="chrome.closeCreateForm()"
  >
    <template #header>
      <div class="create-header">
        <div class="create-header__icon" :style="{ '--module-accent': accentColor }">
          <ModuleIcon v-if="moduleKey" :module-key="moduleKey" :size="18" />
        </div>
        <div class="create-header__copy">
          <h2 class="create-header__title">{{ title }}</h2>
        </div>
        <button
          type="button"
          class="create-header__close"
          aria-label="Close"
          @click="chrome.closeCreateForm()"
        >
          ×
        </button>
      </div>
    </template>

    <form id="mobile-create-form" class="create-form" @submit.prevent="onSubmit">
      <div v-if="error" class="create-banner create-banner--error" role="alert">
        {{ error }}
      </div>

      <div v-if="loading" class="create-skeleton" aria-hidden="true">
        <div class="create-skeleton__line create-skeleton__line--lg" />
        <div class="create-skeleton__line" />
        <div class="create-skeleton__line" />
        <div class="create-skeleton__line create-skeleton__line--short" />
      </div>

      <p v-else-if="!fields.length && !error" class="create-empty">
        This module has no mobile create form yet. Create records on web for now.
      </p>

      <template v-else>
        <MobileFormField
          v-for="field in fields"
          :key="field.key"
          v-model="values[field.key]"
        :label="field.label"
        :field-key="field.key"
        :type="field.type"
          :required="field.required"
          :options="field.options"
          :lookup-target="field.lookupTarget || ''"
          :app-key="appKey"
          :placeholder="fieldPlaceholder(field)"
          :prominent="isProminentField(field)"
        />
      </template>
    </form>

    <template #footer>
      <div class="create-footer">
        <button
          class="create-footer__secondary"
          type="button"
          :disabled="saving"
          @click="chrome.closeCreateForm()"
        >
          Cancel
        </button>
        <button
          class="create-footer__primary"
          type="submit"
          form="mobile-create-form"
          :disabled="!canSubmit"
        >
          {{ saving ? 'Creating…' : 'Create' }}
        </button>
      </div>
    </template>
  </MobileBottomSheet>
</template>

<style scoped>
.create-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.create-header__icon {
  display: grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--module-accent, var(--accent)) 14%, var(--bg-elevated));
  color: var(--module-accent, var(--accent));
  flex-shrink: 0;
}

.create-header__copy {
  min-width: 0;
  flex: 1;
}

.create-header__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
}

.create-header__close {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  flex-shrink: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--bg-soft);
  color: var(--text-muted);
  font-size: 1.35rem;
  line-height: 1;
}

.create-form {
  display: grid;
  gap: 1rem;
  min-width: 0;
  max-width: 100%;
}

.create-banner {
  padding: 0.75rem 0.9rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.4;
}

.create-banner--error {
  background: color-mix(in srgb, var(--danger) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--danger) 24%, transparent);
  color: color-mix(in srgb, var(--danger) 82%, var(--text));
}

.create-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.create-skeleton {
  display: grid;
  gap: 0.75rem;
}

.create-skeleton__line {
  height: 2.75rem;
  border-radius: 0.75rem;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--bg-soft) 88%, transparent) 0%,
    color-mix(in srgb, var(--border) 45%, transparent) 50%,
    color-mix(in srgb, var(--bg-soft) 88%, transparent) 100%
  );
  background-size: 200% 100%;
  animation: create-shimmer 1.2s ease-in-out infinite;
}

.create-skeleton__line--lg {
  height: 3rem;
}

.create-skeleton__line--short {
  width: 68%;
}

.create-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.35fr);
  gap: 0.65rem;
}

.create-footer__secondary,
.create-footer__primary {
  min-height: 2.85rem;
  border-radius: 0.85rem;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 700;
  transition:
    transform 0.15s ease,
    opacity 0.15s ease,
    background 0.15s ease;
}

.create-footer__secondary {
  border: 1px solid color-mix(in srgb, var(--border) 85%, transparent);
  background: var(--bg-elevated);
  color: var(--text);
}

.create-footer__primary {
  border: none;
  background: var(--accent-strong);
  color: #fff;
  box-shadow: 0 10px 24px -14px color-mix(in srgb, var(--accent-strong) 70%, transparent);
}

.create-footer__primary:disabled,
.create-footer__secondary:disabled {
  opacity: 0.55;
}

.create-footer__primary:active:not(:disabled),
.create-footer__secondary:active:not(:disabled) {
  transform: scale(0.98);
}

@keyframes create-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
