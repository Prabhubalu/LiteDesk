<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { BookmarkIcon, CheckIcon, ChevronDownIcon, ChartBarIcon, FunnelIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import {
  loadActiveSavedViewId,
  loadModuleListViews,
  PEOPLE_SYSTEM_VIEWS,
  saveActiveSavedViewId,
  type ListSavedView
} from '@/api/listSavedViews'
import { fetchPeople, type FetchPeopleParams, type FetchPeopleResult, type PeopleListStatistics, type PeopleRecord } from '@/api/people'
import MobileAvatar from '@/components/MobileAvatar.vue'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileSearchField from '@/components/MobileSearchField.vue'
import { getMobileModule, recordSubtitle, recordTitle } from '@/config/mobileModules'
import { useAuthStore } from '@/stores/auth'
import { tapHaptic } from '@/utils/haptics'

/** Matches desktop ModuleList handleStatClick for people */
type StatFocus = 'all' | 'unassigned' | 'withOrganization' | 'withoutOrganization'

const MODULE_KEY = 'people'
const STATS_VISIBLE_KEY = `arivu-stats-visible-${MODULE_KEY}`

const auth = useAuthStore()
const mod = getMobileModule(MODULE_KEY)!

const people = ref<PeopleRecord[]>([])
const viewStatistics = ref<PeopleListStatistics | null>(null)
const views = ref<ListSavedView[]>([...PEOPLE_SYSTEM_VIEWS])
const activeViewId = ref('assigned-to-me')
const viewSheetOpen = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const statFocus = ref<StatFocus>('all')
const statsVisible = ref(true)
const statStripRef = ref<HTMLElement | null>(null)
const statsFadeStart = ref(false)
const statsFadeEnd = ref(false)

const activeView = computed(
  () => views.value.find((view) => view.id === activeViewId.value) || PEOPLE_SYSTEM_VIEWS[0]
)

const isMyPeopleView = computed(() => {
  const filters = activeView.value.filters || {}
  return activeView.value.id === 'assigned-to-me' || filters.assignedTo === 'me'
})

const systemViews = computed(() => views.value.filter((view) => view.isSystem))
const customViews = computed(() => views.value.filter((view) => !view.isSystem))

function loadStatsVisible(): boolean {
  try {
    const saved = localStorage.getItem(STATS_VISIBLE_KEY)
    if (saved !== null) return saved === 'true'
  } catch {
    /* ignore */
  }
  return true
}

function recordId(row: PeopleRecord): string {
  return String(row._id || row.id || '')
}

function queryFromView(view: ListSavedView, options: { includeStatFocus?: boolean } = {}): FetchPeopleParams {
  const includeStatFocus = options.includeStatFocus !== false
  const filters = view.filters || {}
  const params: FetchPeopleParams = { limit: 100 }

  const assignedTo = filters.assignedTo
  if (typeof assignedTo === 'string' && assignedTo) {
    params.assignedTo = assignedTo
  }

  const peopleContext = view.peopleContext
  if (peopleContext && peopleContext !== 'ALL') {
    params.peopleContext = peopleContext
  }

  const savedSearch = view.config?.search
  if (typeof savedSearch === 'string' && savedSearch.trim() && !search.value.trim()) {
    params.search = savedSearch.trim()
  } else if (search.value.trim()) {
    params.search = search.value.trim()
  }

  if (!includeStatFocus) return params

  if (statFocus.value === 'unassigned') params.assignedTo = 'unassigned'
  else if (statFocus.value === 'withOrganization') {
    if (isMyPeopleView.value) params.assignedTo = 'me'
    params.organization = 'has'
  } else if (statFocus.value === 'withoutOrganization') {
    if (isMyPeopleView.value) params.assignedTo = 'me'
    params.organization = 'null'
  }

  return params
}

const filtered = computed(() => people.value)

function setStatFocus(next: StatFocus) {
  const resolved: StatFocus =
    next === 'all' ? 'all' : statFocus.value === next ? 'all' : next
  if (statFocus.value === resolved) return
  statFocus.value = resolved
  void load()
}

function applyViewStatistics(res: FetchPeopleResult) {
  const raw = res.listStatistics
  const total = Number(raw?.totalPeople ?? raw?.myPeople ?? res.pagination?.totalRecords) || 0
  viewStatistics.value = {
    unassigned: Number(raw?.unassigned) || 0,
    withOrganization: Number(raw?.withOrganization) || 0,
    withoutOrganization: Number(raw?.withoutOrganization) || 0,
    totalPeople: total,
    myPeople: Number(raw?.myPeople ?? total) || total
  }
}

const stats = computed(() => {
  const s = viewStatistics.value
  return {
    total: isMyPeopleView.value ? Number(s?.myPeople) || 0 : Number(s?.totalPeople) || 0,
    unassigned: Number(s?.unassigned) || 0,
    withOrganization: Number(s?.withOrganization) || 0,
    withoutOrganization: Number(s?.withoutOrganization) || 0
  }
})

const primaryStatLabel = computed(() => (isMyPeopleView.value ? 'My People' : 'Total People'))

async function fetchAllPeoplePages(params: FetchPeopleParams): Promise<FetchPeopleResult> {
  const pageSize = Math.min(params.limit || 100, 100)
  let page = 1
  let rows: PeopleRecord[] = []
  let first: FetchPeopleResult | null = null
  let total = Infinity

  while (rows.length < total && page <= 40) {
    const res = await fetchPeople({ ...params, page, limit: pageSize })
    if (!first) {
      first = res
      total = Number(res.pagination?.totalRecords) || (res.data?.length ?? 0)
    }
    const chunk = res.data || []
    rows = rows.concat(chunk)
    if (!chunk.length || chunk.length < pageSize || rows.length >= total) break
    page += 1
  }

  return {
    success: first?.success !== false,
    data: rows,
    pagination: {
      ...(first?.pagination || {}),
      totalRecords: total === Infinity ? rows.length : total,
      currentPage: page
    },
    listStatistics: first?.listStatistics
  }
}

async function loadViewStatistics() {
  try {
    const res = await fetchPeople({ ...queryFromView(activeView.value, { includeStatFocus: false }), page: 1, limit: 1 })
    applyViewStatistics(res)
  } catch {
    /* keep last known view stats */
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [listRes] = await Promise.all([
      fetchAllPeoplePages(queryFromView(activeView.value)),
      loadViewStatistics()
    ])
    people.value = listRes.data || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load people'
  } finally {
    loading.value = false
  }
}

async function selectView(view: ListSavedView) {
  void tapHaptic()
  activeViewId.value = view.id
  saveActiveSavedViewId(MODULE_KEY, auth.user?._id, view.id)
  viewSheetOpen.value = false
  statFocus.value = 'all'
  await load()
}

function updateStatsFade() {
  const el = statStripRef.value
  if (!el) return
  const maxScroll = el.scrollWidth - el.clientWidth
  statsFadeStart.value = el.scrollLeft > 4
  statsFadeEnd.value = maxScroll > 4 && el.scrollLeft < maxScroll - 4
}

watch(statsVisible, (value) => {
  try {
    localStorage.setItem(STATS_VISIBLE_KEY, String(value))
  } catch {
    /* ignore */
  }
  if (value) void nextTick(updateStatsFade)
})

watch(stats, () => {
  void nextTick(updateStatsFade)
})

let searchReloadTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchReloadTimer) clearTimeout(searchReloadTimer)
  searchReloadTimer = setTimeout(() => {
    searchReloadTimer = null
    void load()
  }, 300)
})

onMounted(() => {
  statsVisible.value = loadStatsVisible()
  void nextTick(updateStatsFade)
  void (async () => {
    try {
      views.value = await loadModuleListViews(MODULE_KEY)
    } catch {
      views.value = [...PEOPLE_SYSTEM_VIEWS]
    }

    const savedId = loadActiveSavedViewId(MODULE_KEY, auth.user?._id)
    const fallback = views.value.find((view) => view.isDefault)?.id || views.value[0]?.id || 'assigned-to-me'
    activeViewId.value =
      savedId && views.value.some((view) => view.id === savedId) ? savedId : fallback

    await load()
    await nextTick()
    updateStatsFade()
  })()
})
</script>

<template>
  <section class="page people-page">
    <div class="top-row">
      <button class="view-chip" type="button" @click="viewSheetOpen = true">
        <FunnelIcon class="view-chip__icon" aria-hidden="true" />
        <span class="view-chip__label">{{ activeView.label }}</span>
        <ChevronDownIcon class="view-chip__chevron" aria-hidden="true" />
      </button>

      <div class="top-row__actions">
        <button
          class="toolbar-btn"
          type="button"
          :aria-pressed="statsVisible"
          :title="statsVisible ? 'Hide statistics' : 'Show statistics'"
          @click="statsVisible = !statsVisible"
        >
          <ChartBarIcon v-if="!statsVisible" class="toolbar-icon" aria-hidden="true" />
          <XMarkIcon v-else class="toolbar-icon" aria-hidden="true" />
        </button>
      </div>
    </div>

    <div
      v-if="statsVisible"
      ref="statStripRef"
      class="stat-strip"
      :class="{ 'stat-strip--fade-start': statsFadeStart, 'stat-strip--fade-end': statsFadeEnd }"
      @scroll.passive="updateStatsFade"
    >
      <button
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'all' }"
        @click="setStatFocus('all')"
      >
        <span class="stat__value">{{ stats.total }}</span>
        <span class="stat__label">{{ primaryStatLabel }}</span>
      </button>
      <button
        v-if="!isMyPeopleView"
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'unassigned' }"
        @click="setStatFocus('unassigned')"
      >
        <span class="stat__value">{{ stats.unassigned }}</span>
        <span class="stat__label">Unassigned</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'withOrganization' }"
        @click="setStatFocus('withOrganization')"
      >
        <span class="stat__value">{{ stats.withOrganization }}</span>
        <span class="stat__label">With Organization</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'withoutOrganization' }"
        @click="setStatFocus('withoutOrganization')"
      >
        <span class="stat__value">{{ stats.withoutOrganization }}</span>
        <span class="stat__label">Without Organization</span>
      </button>
    </div>

    <MobileSearchField
      v-model="search"
      placeholder="Search people…"
      aria-label="Search people"
    />

    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="loading" class="empty card">Loading people…</div>
    <div v-else-if="!filtered.length" class="empty card">
      {{
        search.trim()
          ? 'No matching people.'
          : statFocus === 'unassigned'
            ? 'No unassigned people.'
            : statFocus === 'withOrganization'
              ? 'No people with an organization.'
              : statFocus === 'withoutOrganization'
                ? 'No people without an organization.'
                : 'No people in this view.'
      }}
    </div>

    <div v-else class="card list">
      <RouterLink
        v-for="row in filtered"
        :key="recordId(row)"
        class="list-item"
        :to="`/modules/people/${recordId(row)}`"
      >
        <MobileAvatar :record="row" size="md" />
        <div class="list-item__body">
          <h3 class="list-title">{{ recordTitle(row, mod) }}</h3>
          <p v-if="recordSubtitle(row, mod)" class="list-meta">{{ recordSubtitle(row, mod) }}</p>
        </div>
      </RouterLink>
    </div>

    <MobileBottomSheet :open="viewSheetOpen" title="Views" compact @close="viewSheetOpen = false">
      <div class="views-sheet">
        <section class="views-section">
          <h3 class="views-section__label">Built-in</h3>
          <ul class="views-group" role="list">
            <li v-for="view in systemViews" :key="view.id">
              <button
                type="button"
                class="views-row"
                :class="{ 'views-row--active': view.id === activeViewId }"
                :aria-pressed="view.id === activeViewId"
                @click="selectView(view)"
              >
                <span class="views-row__glyph" aria-hidden="true">
                  <FunnelIcon />
                </span>
                <span class="views-row__title">{{ view.label }}</span>
                <CheckIcon v-if="view.id === activeViewId" class="views-row__check" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>

        <section v-if="customViews.length" class="views-section">
          <h3 class="views-section__label">Saved</h3>
          <ul class="views-group" role="list">
            <li v-for="view in customViews" :key="view.id">
              <button
                type="button"
                class="views-row"
                :class="{ 'views-row--active': view.id === activeViewId }"
                :aria-pressed="view.id === activeViewId"
                @click="selectView(view)"
              >
                <span class="views-row__glyph views-row__glyph--saved" aria-hidden="true">
                  <BookmarkIcon />
                </span>
                <span class="views-row__title">{{ view.label }}</span>
                <CheckIcon v-if="view.id === activeViewId" class="views-row__check" aria-hidden="true" />
              </button>
            </li>
          </ul>
        </section>
      </div>
    </MobileBottomSheet>
  </section>
</template>

<style scoped>
.people-page {
  --toolbar-h: 2.25rem;
  --toolbar-r: 0.65rem;
  --toolbar-gap: 0.4rem;
  display: grid;
  gap: 0.75rem;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.top-row__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--toolbar-gap);
  flex-shrink: 0;
}

.view-chip,
.toolbar-btn {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}

.view-chip,
.toolbar-btn {
  box-sizing: border-box;
  height: var(--toolbar-h);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: var(--toolbar-r);
  color: var(--text-muted);
}

.view-chip:active,
.toolbar-btn:active {
  background: var(--bg-soft);
}

.view-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  max-width: calc(100% - 3.5rem);
  padding: 0 0.75rem;
  color: var(--text);
  font-weight: 700;
  font-size: 0.875rem;
  line-height: 1;
}

.view-chip__icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  color: var(--text-muted);
}

.view-chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.view-chip__chevron {
  flex-shrink: 0;
  width: 0.9rem;
  height: 0.9rem;
  color: var(--text-muted);
}

.toolbar-btn {
  display: grid;
  place-items: center;
  width: var(--toolbar-h);
  flex-shrink: 0;
  padding: 0;
}

.toolbar-btn[aria-pressed='true'] {
  color: var(--accent-strong);
  border-color: rgba(96, 73, 231, 0.35);
  background: rgba(96, 73, 231, 0.1);
}

.toolbar-btn[aria-pressed='true']:active {
  background: rgba(96, 73, 231, 0.16);
}

.toolbar-icon {
  width: 1.05rem;
  height: 1.05rem;
}

.stat-strip {
  --stat-edge: 1rem;
  --stat-fade: 1.5rem;
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  scroll-padding-left: var(--stat-edge);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  margin: 0 calc(var(--stat-edge) * -1);
  padding-block: 0.15rem;
}

.stat-strip::before,
.stat-strip::after {
  content: '';
  flex: 0 0 var(--stat-edge);
}

.stat-strip::-webkit-scrollbar {
  display: none;
}

.stat-strip--fade-start {
  mask-image: linear-gradient(to right, transparent 0, #000 var(--stat-fade), #000 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 var(--stat-fade), #000 100%);
}

.stat-strip--fade-end {
  mask-image: linear-gradient(to left, transparent 0, #000 var(--stat-fade), #000 100%);
  -webkit-mask-image: linear-gradient(to left, transparent 0, #000 var(--stat-fade), #000 100%);
}

.stat-strip--fade-start.stat-strip--fade-end {
  mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 var(--stat-fade),
    #000 calc(100% - var(--stat-fade)),
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0,
    #000 var(--stat-fade),
    #000 calc(100% - var(--stat-fade)),
    transparent 100%
  );
}

.stat {
  flex: 0 0 auto;
  width: 40%;
  min-width: 8.5rem;
  scroll-snap-align: start;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  padding: 0.7rem 0.75rem;
  text-align: left;
  color: var(--text);
}

.stat__value {
  display: block;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.stat__label {
  display: block;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  color: var(--text-muted);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat--active {
  background: rgba(96, 73, 231, 0.12);
  border-color: rgba(96, 73, 231, 0.35);
}

.stat--active .stat__label {
  color: var(--accent-strong);
}

.list {
  overflow: hidden;
  border: none;
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border);
  color: inherit;
  text-decoration: none;
}

.list-item__body {
  min-width: 0;
  flex: 1;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item:active {
  background: var(--bg-soft);
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
  color: var(--text-muted);
}

.views-sheet {
  display: grid;
  gap: 1.15rem;
}

.views-section {
  display: grid;
  gap: 0.35rem;
}

.views-section__label {
  margin: 0 0 0 0.85rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.views-group {
  margin: 0;
  padding: 0;
  list-style: none;
  border-radius: 0.85rem;
  overflow: hidden;
  background: var(--bg-soft);
  border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
}

.views-row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 3rem;
  padding: 0.55rem 0.85rem;
  border: none;
  background: transparent;
  color: var(--text);
  text-align: left;
  -webkit-tap-highlight-color: transparent;
}

.views-group li + li .views-row {
  border-top: 1px solid color-mix(in srgb, var(--border) 45%, transparent);
}

.views-row:active {
  background: color-mix(in srgb, var(--text) 4%, transparent);
}

.views-row--active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-soft));
}

.views-row__glyph {
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-strong);
}

.views-row__glyph :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.views-row__glyph--saved {
  background: color-mix(in srgb, var(--text-muted) 12%, transparent);
  color: var(--text-muted);
}

.views-row--active .views-row__glyph--saved {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent-strong);
}

.views-row__title {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.views-row--active .views-row__title {
  color: var(--accent-strong);
  font-weight: 600;
}

.views-row__check {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  stroke-width: 2.5;
  color: var(--accent-strong);
}
</style>
