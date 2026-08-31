<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import {
  globalSearch,
  searchRowId,
  searchRowRoute,
  searchRowSubtitle,
  searchRowTitle,
  type SearchResultRow
} from '@/api/search'
import { addRecent, clearRecents, getRecents, type RecentItem } from '@/services/recents'
import { useMobileModules } from '@/composables/useMobileModules'
import { useShellChrome } from '@/composables/useShellChrome'
import { getModuleAccent } from '@/config/mobileModules'
import { mobilePathFromWebRoute } from '@/utils/platformHomeMobile'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileSearchField from '@/components/MobileSearchField.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'

type PackedRow = { moduleKey: string; row: SearchResultRow }
type SearchSection = { key: string; label: string; rows: PackedRow[] }

const MODULE_PATHS: Record<string, (id: string) => string> = {
  people: (id) => `/modules/people/${id}`,
  organizations: (id) => `/modules/organizations/${id}`,
  deals: (id) => `/modules/deals/${id}`,
  tasks: (id) => `/tasks/${id}`,
  events: (id) => `/modules/events/${id}`,
  forms: (id) => `/modules/forms/${id}`,
  items: (id) => `/modules/items/${id}`,
  cases: (id) => `/modules/cases/${id}`
}

const router = useRouter()
const chrome = useShellChrome()
const { featuredModules } = useMobileModules()

const open = computed({
  get: () => chrome.searchOpen.value,
  set: (value) => {
    if (!value) chrome.closeSearch()
  }
})

const query = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const payload = ref<Awaited<ReturnType<typeof globalSearch>> | null>(null)
const recents = ref<RecentItem[]>([])
const searchField = ref<{ focus: () => void } | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const trimmed = computed(() => query.value.trim())
const browsing = computed(() => trimmed.value.length < 2)

function pack(moduleKey: string, rows: SearchResultRow[] | undefined): PackedRow[] {
  return (rows || []).map((row) => ({ moduleKey, row }))
}

const sections = computed<SearchSection[]>(() => {
  const results = payload.value?.results
  if (!results) return []

  const out: SearchSection[] = []
  if (results.people.length) {
    out.push({ key: 'people', label: 'People', rows: pack('people', results.people) })
  }
  if (results.organizations.length) {
    out.push({
      key: 'organizations',
      label: 'Organizations',
      rows: pack('organizations', results.organizations)
    })
  }

  const work = [
    ...pack('deals', results.deals),
    ...pack('tasks', results.tasks),
    ...pack('events', results.events),
    ...pack('cases', results.cases)
  ]
  if (work.length) out.push({ key: 'work', label: 'Work', rows: work })

  if (trimmed.value.length >= 4) {
    const configuration = [...pack('forms', results.forms), ...pack('items', results.items)]
    if (configuration.length) {
      out.push({ key: 'configuration', label: 'Configuration', rows: configuration })
    }
  }

  return out
})

const firstHit = computed(() => sections.value[0]?.rows[0] || null)

async function loadRecents() {
  recents.value = await getRecents(8)
}

async function runSearch() {
  const q = trimmed.value
  if (q.length < 2) {
    payload.value = null
    error.value = null
    return
  }

  loading.value = true
  error.value = null
  try {
    payload.value = await globalSearch(q)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Search failed'
    payload.value = null
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

watch(open, async (isOpen) => {
  if (!isOpen) {
    query.value = ''
    payload.value = null
    error.value = null
    return
  }
  await loadRecents()
  await nextTick()
  searchField.value?.focus()
})

function pathFor(moduleKey: string, row: SearchResultRow): string {
  const mapped = mobilePathFromWebRoute(searchRowRoute(row))
  if (mapped) return mapped
  const id = searchRowId(row)
  const builder = MODULE_PATHS[moduleKey]
  return builder ? builder(id) : '/'
}

function moduleListPath(moduleKey: string): string {
  return moduleKey === 'tasks' ? '/tasks' : `/modules/${moduleKey}`
}

function initialsFor(row: SearchResultRow): string {
  const first = typeof row.first_name === 'string' ? row.first_name : ''
  const last = typeof row.last_name === 'string' ? row.last_name : ''
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  const title = searchRowTitle(row)
  const parts = title.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase()
  return title.slice(0, 2).toUpperCase() || '?'
}

function avatarSrc(row: SearchResultRow): string | null {
  const raw = row.avatar
  if (typeof raw !== 'string' || !raw) return null
  if (raw.startsWith('http') || raw.startsWith('data:')) return raw
  return null
}

async function go(path: string, recent?: Omit<RecentItem, 'viewedAt'>) {
  if (recent) await addRecent(recent)
  chrome.closeSearch()
  await router.push(path)
}

async function openResult(moduleKey: string, row: SearchResultRow) {
  const path = pathFor(moduleKey, row)
  await go(path, {
    id: searchRowId(row) || path,
    moduleKey,
    title: searchRowTitle(row),
    path
  })
}

async function openRecent(item: RecentItem) {
  await go(item.path, item)
}

async function openModule(moduleKey: string) {
  await go(moduleListPath(moduleKey))
}

async function onSubmit() {
  if (browsing.value) {
    if (recents.value[0]) await openRecent(recents.value[0])
    return
  }
  if (firstHit.value) await openResult(firstHit.value.moduleKey, firstHit.value.row)
}

async function onClearRecents() {
  await clearRecents()
  recents.value = []
}
</script>

<template>
  <MobileBottomSheet :open="open" title="Search" tall @close="chrome.closeSearch()">
    <template #toolbar>
      <MobileSearchField
        ref="searchField"
        v-model="query"
        placeholder="Search people, organizations, work…"
        aria-label="Global search"
        clearable
        @submit="onSubmit"
      />
    </template>

    <div class="search-sheet" :aria-busy="loading">
      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <template v-if="browsing">
        <section v-if="recents.length" class="section">
          <div class="section__head">
            <h3 class="section__label">Recent searches</h3>
            <button type="button" class="section__action" @click="onClearRecents">Clear</button>
          </div>
          <button
            v-for="item in recents"
            :key="item.path"
            type="button"
            class="row"
            @click="openRecent(item)"
          >
            <span
              class="row__icon"
              :style="{
                background: `${getModuleAccent(item.moduleKey)}22`,
                color: getModuleAccent(item.moduleKey)
              }"
            >
              <ModuleIcon :module-key="item.moduleKey" :size="16" />
            </span>
            <span class="row__copy">
              <strong>{{ item.title }}</strong>
            </span>
          </button>
        </section>

        <section v-if="featuredModules.length" class="section">
          <h3 class="section__label">Core modules</h3>
          <button
            v-for="mod in featuredModules"
            :key="mod.key"
            type="button"
            class="row"
            @click="openModule(mod.key)"
          >
            <span
              class="row__icon"
              :style="{
                background: `${getModuleAccent(mod.key)}22`,
                color: getModuleAccent(mod.key)
              }"
            >
              <ModuleIcon :module-key="mod.key" :size="16" />
            </span>
            <span class="row__copy">
              <strong>{{ mod.label }}</strong>
            </span>
          </button>
        </section>

        <div v-if="!recents.length" class="empty">
          <MagnifyingGlassIcon class="empty__icon" aria-hidden="true" />
          <p class="empty__title">Start typing to search</p>
          <p class="empty__hint muted">People, organizations, deals, and tasks.</p>
        </div>
      </template>

      <div v-else-if="loading" class="empty">
        <div class="spinner" aria-hidden="true" />
        <p class="empty__title">Searching…</p>
      </div>

      <div v-else-if="!sections.length" class="empty">
        <MagnifyingGlassIcon class="empty__icon" aria-hidden="true" />
        <p class="empty__title">No results</p>
        <p class="empty__hint muted">Try a different name or keyword.</p>
      </div>

      <section v-for="section in sections" v-else :key="section.key" class="section">
        <h3 class="section__label">{{ section.label }}</h3>
        <button
          v-for="entry in section.rows"
          :key="`${entry.moduleKey}-${searchRowId(entry.row)}`"
          type="button"
          class="row"
          @click="openResult(entry.moduleKey, entry.row)"
        >
          <img
            v-if="avatarSrc(entry.row)"
            class="row__avatar"
            :src="avatarSrc(entry.row) || ''"
            alt=""
          />
          <span
            v-else-if="entry.moduleKey === 'people'"
            class="row__avatar row__avatar--initials"
          >
            {{ initialsFor(entry.row) }}
          </span>
          <span
            v-else
            class="row__icon"
            :style="{
              background: `${getModuleAccent(entry.moduleKey)}22`,
              color: getModuleAccent(entry.moduleKey)
            }"
          >
            <ModuleIcon :module-key="entry.moduleKey" :size="16" />
          </span>
          <span class="row__copy">
            <strong>{{ searchRowTitle(entry.row) }}</strong>
            <span v-if="searchRowSubtitle(entry.row)" class="muted">{{
              searchRowSubtitle(entry.row)
            }}</span>
          </span>
        </button>
      </section>
    </div>
  </MobileBottomSheet>
</template>

<style scoped>
.search-sheet {
  display: grid;
  gap: 1rem;
}

.section {
  display: grid;
  gap: 0.15rem;
}

.section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.section__label {
  margin: 0 0 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.section__action {
  border: none;
  background: transparent;
  color: var(--accent-strong, var(--accent));
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.2rem 0.15rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  text-align: left;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: inherit;
  padding: 0.65rem 0.2rem;
}

.row:active {
  background: var(--bg-soft);
}

.row__icon,
.row__avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.row__avatar {
  object-fit: cover;
  border-radius: 999px;
}

.row__avatar--initials {
  background: rgba(96, 73, 231, 0.14);
  color: var(--accent-strong, var(--accent));
  font-size: 0.7rem;
  font-weight: 700;
}

.row__copy {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.row__copy strong {
  font-size: 0.875rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row__copy .muted {
  font-size: 0.78rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.35rem;
  padding: 1.5rem 0.5rem;
}

.empty__icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--text-muted);
  margin-bottom: 0.35rem;
}

.empty__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.empty__hint {
  margin: 0;
  font-size: 0.82rem;
}

.spinner {
  width: 1.35rem;
  height: 1.35rem;
  border: 2px solid var(--border);
  border-top-color: var(--text);
  border-radius: 999px;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
</style>
