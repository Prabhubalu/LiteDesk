<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchModuleDetail } from '@/api/modules'
import MobileRecordBar from '@/components/MobileRecordBar.vue'
import MobileRichHtml from '@/components/MobileRichHtml.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'
import { getMobileModule, pickRecordField, recordTitle } from '@/config/mobileModules'
import { useShellChrome } from '@/composables/useShellChrome'
import { addRecent } from '@/services/recents'
import { looksLikeHtml } from '@/utils/richHtml'

const RICH_KEYS = ['description', 'notes', 'body', 'details', 'content']

const props = defineProps<{ moduleKey: string; recordId: string }>()
const router = useRouter()
const chrome = useShellChrome()

function goBack() {
  if (window.history.length > 1) router.back()
  else if (props.moduleKey === 'people') void router.push({ name: 'people-list' })
  else void router.push({ name: 'module-list', params: { moduleKey: props.moduleKey } })
}

const mod = computed(() => getMobileModule(props.moduleKey))
const record = ref<Record<string, unknown> | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const displayTitle = computed(() => {
  if (!mod.value || !record.value) return null
  const name = recordTitle(record.value, mod.value).trim()
  return name && name !== 'Record' ? name : null
})

watch(
  displayTitle,
  (value) => {
    chrome.setAstraRecordName(value)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  chrome.setAstraRecordName(null)
})

const detailRows = computed(() => {
  if (!mod.value || !record.value) return []
  return mod.value.detailFields
    .map((field) => ({
      label: field.label,
      value: pickRecordField(record.value!, field.keys)
    }))
    .filter((row) => row.value && !looksLikeHtml(row.value))
})

const richSections = computed(() => {
  if (!record.value) return []
  const seen = new Set<string>()
  const sections: Array<{ key: string; label: string; html: string }> = []
  for (const key of RICH_KEYS) {
    const html = String(record.value[key] || '').trim()
    if (!html || seen.has(html) || !looksLikeHtml(html)) continue
    seen.add(html)
    sections.push({ key, label: key === 'description' ? 'Description' : capitalize(key), html })
  }
  return sections
})

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

async function load() {
  if (!mod.value) return
  loading.value = true
  error.value = null
  try {
    record.value = await fetchModuleDetail(mod.value, props.recordId)
    await addRecent({
      id: props.recordId,
      moduleKey: props.moduleKey,
      title: recordTitle(record.value, mod.value),
      path: `/modules/${props.moduleKey}/${props.recordId}`
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load record'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<template>
  <section v-if="mod" class="record-drawer">
    <MobileRecordBar :title="mod.label" @back="goBack" />
    <div class="record-drawer__body">
    <div class="page page--detail module-detail">
    <div class="hero card">
      <span class="hero__icon"><ModuleIcon :module-key="mod.key" :size="24" /></span>
      <div>
        <p class="hero__eyebrow muted">{{ mod.label }}</p>
        <h2 class="hero__title">
          {{ loading ? 'Loading…' : record ? recordTitle(record, mod) : 'Record' }}
        </h2>
      </div>
    </div>

    <div v-if="error" class="banner banner-error">{{ error }}</div>

    <div v-if="!loading && detailRows.length" class="card detail-panel">
      <div v-for="row in detailRows" :key="row.label" class="detail-row">
        <span class="detail-row__label muted">{{ row.label }}</span>
        <span class="detail-row__value">{{ row.value }}</span>
      </div>
    </div>

    <article
      v-for="section in richSections"
      :key="section.key"
      class="card rich-card"
    >
      <h2 class="rich-card__title">{{ section.label }}</h2>
      <MobileRichHtml :html="section.html" />
    </article>

    <div v-if="!loading && !error && !detailRows.length && !richSections.length" class="empty card">
      No additional fields to show on mobile.
    </div>
    </div>
    </div>
  </section>
</template>

<style scoped>
.module-detail {
  display: grid;
  gap: 0.85rem;
}

.hero {
  display: flex;
  gap: 0.85rem;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, rgba(96, 73, 231, 0.14), rgba(96, 73, 231, 0.04));
}

.hero__icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 14px;
  display: grid;
  place-items: center;
  color: var(--accent-strong);
  background: var(--bg-elevated);
}

.hero__eyebrow {
  margin: 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
}

.hero__title {
  margin: 0.2rem 0 0;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.detail-panel {
  padding: 0.35rem 0;
  overflow: hidden;
}

.detail-row {
  display: grid;
  gap: 0.2rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--border);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row__label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-row__value {
  font-size: 0.95rem;
  word-break: break-word;
}

.rich-card {
  padding: 1rem 1.1rem 1.15rem;
  display: grid;
  gap: 0.7rem;
}

.rich-card__title {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}
</style>
