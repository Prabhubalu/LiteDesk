<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { fetchModuleList } from '@/api/modules'
import { getMobileModule, recordSubtitle, recordTitle } from '@/config/mobileModules'
import MobileSearchField from '@/components/MobileSearchField.vue'

const props = defineProps<{ moduleKey: string }>()

const mod = computed(() => getMobileModule(props.moduleKey))
const records = ref<Record<string, unknown>[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')

const searchPlaceholder = computed(() =>
  mod.value ? `Search ${mod.value.label.toLowerCase()}…` : 'Search…'
)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return records.value
  return records.value.filter((row) => {
    const title = recordTitle(row, mod.value!).toLowerCase()
    const subtitle = recordSubtitle(row, mod.value!).toLowerCase()
    return title.includes(q) || subtitle.includes(q)
  })
})

function recordId(row: Record<string, unknown>): string {
  return String(row._id || row.id || '')
}

async function load() {
  if (!mod.value) return
  loading.value = true
  error.value = null
  try {
    records.value = await fetchModuleList(mod.value, { limit: 50, search: search.value.trim() || undefined })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load records'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.moduleKey,
  () => {
    search.value = ''
    void load()
  }
)

onMounted(() => {
  void load()
})
</script>

<template>
  <section v-if="mod" class="page module-list">
    <MobileSearchField
      v-model="search"
      :placeholder="searchPlaceholder"
      :aria-label="searchPlaceholder"
    />

    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="loading" class="empty card">Loading…</div>
    <div v-else-if="!filtered.length" class="empty card">
      {{ search.trim() ? 'No matching records.' : 'No records found.' }}
    </div>

    <div v-else class="card list">
      <RouterLink
        v-for="row in filtered"
        :key="recordId(row)"
        class="list-item"
        :to="`/modules/${mod.key}/${recordId(row)}`"
      >
        <h3 class="list-title">{{ recordTitle(row, mod) }}</h3>
        <p v-if="recordSubtitle(row, mod)" class="list-meta">{{ recordSubtitle(row, mod) }}</p>
      </RouterLink>
    </div>
  </section>

  <section v-else class="page">
    <div class="empty card">Module not available.</div>
  </section>
</template>

<style scoped>
.module-list {
  --toolbar-r: 0.65rem;
  display: grid;
  gap: 0.75rem;
}

.list {
  overflow: hidden;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.list-item {
  padding: 0.85rem 0;
}

.list-item:last-child {
  border-bottom: none;
}

.list-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
}

.list-meta {
  margin: 0.25rem 0 0;
  font-size: 0.82rem;
}
</style>
