<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import { globalSearch, searchRowId, searchRowTitle, type SearchResultRow } from '@/api/search'
import { getModuleAccent } from '@/config/mobileModules'
import ModuleIcon from '@/components/ModuleIcon.vue'

const query = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const total = ref(0)
const groups = ref<Array<{ key: string; label: string; rows: SearchResultRow[] }>>([])

const moduleRoutes: Record<string, (id: string) => string> = {
  people: (id) => `/modules/people/${id}`,
  organizations: (id) => `/modules/organizations/${id}`,
  deals: (id) => `/modules/deals/${id}`,
  tasks: (id) => `/tasks/${id}`,
  events: (id) => `/modules/events/${id}`,
  forms: (id) => `/modules/forms/${id}`,
  items: (id) => `/modules/items/${id}`,
  cases: (id) => `/modules/cases/${id}`
}

const moduleLabels: Record<string, string> = {
  people: 'People',
  organizations: 'Organizations',
  deals: 'Deals',
  tasks: 'Tasks',
  events: 'Events',
  forms: 'Forms',
  items: 'Items',
  cases: 'Cases'
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function runSearch() {
  const q = query.value.trim()
  if (q.length < 2) {
    groups.value = []
    total.value = 0
    return
  }

  loading.value = true
  error.value = null
  try {
    const res = await globalSearch(q)
    total.value = res.total
    groups.value = Object.entries(res.results)
      .filter(([, rows]) => rows.length > 0)
      .map(([key, rows]) => ({
        key,
        label: moduleLabels[key] || key,
        rows
      }))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed'
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void runSearch()
  }, 280)
})

function pathFor(moduleKey: string, row: SearchResultRow): string {
  const id = searchRowId(row)
  const builder = moduleRoutes[moduleKey]
  return builder ? builder(id) : '/'
}
</script>

<template>
  <section class="page search-page">
    <div class="search-row">
      <label class="search-pill card">
        <MagnifyingGlassIcon class="search-pill__icon" aria-hidden="true" />
        <input v-model="query" type="search" placeholder="Search workspace" autocomplete="off" autofocus />
      </label>
    </div>

    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="loading" class="empty card">Searching…</div>
    <div v-else-if="query.trim().length < 2" class="empty card">Type at least 2 characters.</div>
    <div v-else-if="!groups.length" class="empty card">No results for “{{ query.trim() }}”.</div>

    <template v-else>
      <p class="result-count muted">{{ total }} results</p>
      <div v-for="group in groups" :key="group.key" class="section">
        <h3 class="section-title">{{ group.label }}</h3>
        <div class="card list">
          <RouterLink
            v-for="row in group.rows"
            :key="`${group.key}-${searchRowId(row)}`"
            class="list-item recent-row"
            :to="pathFor(group.key, row)"
          >
            <span
              class="recent-icon"
              :style="{ background: `${getModuleAccent(group.key)}22`, color: getModuleAccent(group.key) }"
            >
              <ModuleIcon :module-key="group.key" :size="16" />
            </span>
            <strong>{{ searchRowTitle(row) }}</strong>
          </RouterLink>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.search-page {
  display: grid;
  gap: 0.85rem;
}

.search-pill {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.2rem 0.85rem;
}

.search-pill__icon {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  color: var(--text-muted);
}

.search-pill input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  padding: 0.75rem 0;
  min-width: 0;
}

.search-pill input:focus {
  outline: none;
}

.result-count {
  margin: 0;
  font-size: 0.85rem;
}

.section {
  display: grid;
  gap: 0.45rem;
}

.recent-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.recent-row strong {
  font-size: 0.875rem;
  font-weight: 500;
}

.recent-icon {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
</style>
