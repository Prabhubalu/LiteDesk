<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BookmarkIcon, CalendarDaysIcon, ChartBarIcon, CheckIcon, ChevronDownIcon, FunnelIcon, ListBulletIcon, MagnifyingGlassIcon, ViewColumnsIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { FlagIcon as FlagIconSolid } from '@heroicons/vue/24/solid'
import {
  loadActiveSavedViewId,
  loadModuleListViews,
  saveActiveSavedViewId,
  TASKS_SYSTEM_VIEWS,
  type ListSavedView
} from '@/api/listSavedViews'
import { apiClient } from '@/api/client'
import { fetchTasks, updateTaskStatus, type FetchTasksParams, type FetchTasksResult, type TaskListStatistics, type TaskRecord } from '@/api/tasks'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileKanbanBoard from '@/components/MobileKanbanBoard.vue'
import MobileSearchField from '@/components/MobileSearchField.vue'
import { useAuthStore } from '@/stores/auth'
import { tapHaptic } from '@/utils/haptics'

/** Matches desktop ModuleList handleStatClick for tasks */
type StatFocus = 'all' | 'open' | 'today' | 'overdue'
type LayoutMode = 'list' | 'kanban'

const MODULE_KEY = 'tasks'
const STATS_VISIBLE_KEY = `arivu-stats-visible-${MODULE_KEY}`
/** Same key as desktop Tasks.vue so preference can align across clients */
const LAYOUT_VIEW_KEY = 'arivu-tasks-view'
const TASK_STAGES = ['todo', 'in_progress', 'waiting', 'completed', 'cancelled'] as const

const router = useRouter()
const auth = useAuthStore()

const tasks = ref<TaskRecord[]>([])
const listStatistics = ref<TaskListStatistics | null>(null)
const viewStatistics = ref<TaskListStatistics | null>(null)
const totalRecords = ref(0)
const views = ref<ListSavedView[]>([...TASKS_SYSTEM_VIEWS])
const activeViewId = ref('all')
const viewSheetOpen = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const statFocus = ref<StatFocus>('all')
const togglingId = ref<string | null>(null)
const statsVisible = ref(true)
const layoutMode = ref<LayoutMode>(loadLayoutMode())
const boardSearchOpen = ref(false)
const statusColorMap = ref<Record<string, string>>({})
const statStripRef = ref<HTMLElement | null>(null)
const statsFadeStart = ref(false)
const statsFadeEnd = ref(false)

const showSearch = computed(() => layoutMode.value === 'list' || boardSearchOpen.value || Boolean(search.value.trim()))
const taskStages = computed(() => [...TASK_STAGES])

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

function loadLayoutMode(): LayoutMode {
  try {
    return localStorage.getItem(LAYOUT_VIEW_KEY) === 'list' ? 'list' : 'kanban'
  } catch {
    return 'kanban'
  }
}

function persistLayoutMode(mode: LayoutMode) {
  try {
    localStorage.setItem(LAYOUT_VIEW_KEY, mode)
  } catch {
    /* ignore */
  }
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
}

const activeView = computed(
  () => views.value.find((view) => view.id === activeViewId.value) || TASKS_SYSTEM_VIEWS[0]
)

const isMyTasksView = computed(() => {
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

function titleFor(task: TaskRecord): string {
  return String(task.title || task.name || 'Untitled task')
}

function statusKey(task: TaskRecord): string {
  return String(task.status || 'todo').toLowerCase()
}

function isCompleted(task: TaskRecord): boolean {
  const s = statusKey(task)
  return s === 'completed' || s === 'done'
}

function isCancelled(task: TaskRecord): boolean {
  return statusKey(task) === 'cancelled'
}

function formatStatus(status: string | undefined): string {
  if (!status) return 'Todo'
  const key = status.toLowerCase()
  return STATUS_LABELS[key] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
}

function formatPriority(priority: string | undefined): string | null {
  if (!priority) return null
  const key = priority.toLowerCase()
  return PRIORITY_LABELS[key] || priority
}

function statusPillClass(status: string | undefined): string {
  switch (String(status || '').toLowerCase()) {
    case 'in_progress':
      return 'pill pill-info'
    case 'waiting':
      return 'pill pill-warn'
    case 'completed':
    case 'done':
      return 'pill pill-ok'
    case 'cancelled':
      return 'pill pill-danger'
    default:
      return 'pill'
  }
}

function priorityPillClass(priority: string | undefined): string {
  switch (String(priority || '').toLowerCase()) {
    case 'high':
      return 'pill pill-warn'
    case 'urgent':
      return 'pill pill-danger'
    case 'medium':
      return 'pill pill-info'
    default:
      return 'pill'
  }
}

function isOverdue(task: TaskRecord): boolean {
  if (!task.dueDate || isCompleted(task) || isCancelled(task)) return false
  const due = new Date(String(task.dueDate))
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  return due < startOfToday
}

function isDueToday(task: TaskRecord): boolean {
  if (!task.dueDate || isCompleted(task) || isCancelled(task)) return false
  const due = new Date(String(task.dueDate))
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)
  endOfToday.setMilliseconds(-1)
  return due >= startOfToday && due <= endOfToday
}

function dueLabel(task: TaskRecord): string {
  if (!task.dueDate) return ''
  return `Due ${new Date(String(task.dueDate)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

function dueDateShort(task: TaskRecord): string {
  if (!task.dueDate) return ''
  return new Date(String(task.dueDate)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function dueClass(task: TaskRecord): string {
  if (isOverdue(task)) return 'due due--overdue'
  if (isDueToday(task)) return 'due due--today'
  return 'due'
}

function queryFromView(view: ListSavedView): FetchTasksParams {
  const filters = view.filters || {}
  const params: FetchTasksParams = {
    // Server max page size — load() walks pages until the full query is loaded.
    limit: 100
  }

  const assignedTo = filters.assignedTo
  if (typeof assignedTo === 'string' && assignedTo) {
    params.assignedTo = assignedTo
  }

  const status = filters.status
  if (typeof status === 'string' && status) {
    params.status = status
  }

  const priority = filters.priority
  if (typeof priority === 'string' && priority) {
    params.priority = priority
  }

  const savedSearch = view.config?.search
  if (typeof savedSearch === 'string' && savedSearch.trim() && !search.value.trim()) {
    params.search = savedSearch.trim()
  } else if (search.value.trim()) {
    params.search = search.value.trim()
  }

  // Stat chips → same query flags as desktop ModuleList (not a page-local filter).
  if (statFocus.value === 'open') params.open = true
  else if (statFocus.value === 'today') params.dueToday = true
  else if (statFocus.value === 'overdue') params.overdue = true

  return params
}

const boardItems = computed(() => tasks.value)

function getStatusColor(stage: string): string | null {
  return statusColorMap.value[stage] || null
}

const filtered = computed(() => tasks.value)

function setStatFocus(next: StatFocus) {
  // Tapping the active chip clears focus back to all (except when choosing all).
  const resolved: StatFocus =
    next === 'all' ? 'all' : statFocus.value === next ? 'all' : next
  if (statFocus.value === resolved) return
  statFocus.value = resolved
  void load()
}

function applyListStatistics(res: {
  listStatistics?: TaskListStatistics
  pagination?: { totalRecords?: number; totalTasks?: number }
}) {
  const raw = res.listStatistics
  const total =
    Number(raw?.totalTasks ?? raw?.myTasks ?? res.pagination?.totalTasks ?? res.pagination?.totalRecords) || 0
  listStatistics.value = {
    open: Number(raw?.open) || 0,
    dueToday: Number(raw?.dueToday) || 0,
    overdue: Number(raw?.overdue) || 0,
    totalTasks: total,
    myTasks: Number(raw?.myTasks ?? total) || total
  }
  totalRecords.value = Number(res.pagination?.totalRecords ?? res.pagination?.totalTasks ?? total) || total
}

/** Card totals from the active saved view (unscoped by open/today/overdue chips). */
const stats = computed(() => {
  const s = viewStatistics.value
  return {
    total: isMyTasksView.value ? Number(s?.myTasks) || 0 : Number(s?.totalTasks) || 0,
    open: Number(s?.open) || 0,
    dueToday: Number(s?.dueToday) || 0,
    overdue: Number(s?.overdue) || 0
  }
})

const primaryStatLabel = computed(() => (isMyTasksView.value ? 'My Tasks' : 'Total Tasks'))

async function fetchAllTaskPages(params: FetchTasksParams): Promise<FetchTasksResult> {
  const pageSize = Math.min(params.limit || 100, 100)
  let page = 1
  let rows: TaskRecord[] = []
  let first: FetchTasksResult | null = null
  let total = Infinity

  while (rows.length < total && page <= 40) {
    const res = await fetchTasks({ ...params, page, limit: pageSize })
    if (!first) {
      first = res
      total = Number(res.pagination?.totalRecords ?? res.pagination?.totalTasks) || (res.data?.length ?? 0)
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
      totalTasks: total === Infinity ? rows.length : total,
      currentPage: page,
      tasksPerPage: pageSize
    },
    listStatistics: first?.listStatistics
  }
}

async function loadViewStatistics() {
  try {
    const params = queryFromView(activeView.value)
    // Stats cards stay scoped to the saved view only (ignore open/today/overdue chip).
    delete params.open
    delete params.dueToday
    delete params.overdue
    const res = await fetchTasks({ ...params, page: 1, limit: 1 })
    const raw = res.listStatistics
    const total =
      Number(raw?.totalTasks ?? raw?.myTasks ?? res.pagination?.totalTasks ?? res.pagination?.totalRecords) || 0
    viewStatistics.value = {
      open: Number(raw?.open) || 0,
      dueToday: Number(raw?.dueToday) || 0,
      overdue: Number(raw?.overdue) || 0,
      totalTasks: total,
      myTasks: Number(raw?.myTasks ?? total) || total
    }
  } catch {
    /* keep last known view stats */
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const [listRes] = await Promise.all([
      fetchAllTaskPages(queryFromView(activeView.value)),
      loadViewStatistics()
    ])
    tasks.value = listRes.data || []
    applyListStatistics(listRes)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load tasks'
  } finally {
    loading.value = false
  }
}

/** Refresh KPI cards without replacing the board/list loading shell. */
async function refreshListStatistics() {
  await loadViewStatistics()
  try {
    const res = await fetchTasks({ ...queryFromView(activeView.value), page: 1, limit: 1 })
    applyListStatistics(res)
  } catch {
    /* keep last known stats */
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

async function toggleComplete(task: TaskRecord, event: Event) {
  event.preventDefault()
  event.stopPropagation()
  if (togglingId.value) return
  togglingId.value = task._id
  const next = isCompleted(task) ? 'todo' : 'completed'
  try {
    await updateTaskStatus(task._id, next)
    task.status = next
    void refreshListStatistics()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update task'
  } finally {
    togglingId.value = null
  }
}

function openTask(task: TaskRecord) {
  void router.push(`/tasks/${task._id}`)
}

function setLayoutMode(mode: string) {
  const next: LayoutMode = mode === 'list' ? 'list' : 'kanban'
  if (layoutMode.value === next) return
  layoutMode.value = next
  persistLayoutMode(next)
  if (next === 'kanban' && !search.value.trim()) boardSearchOpen.value = false
  void load()
}

function toggleBoardSearch() {
  if (layoutMode.value !== 'kanban') return
  boardSearchOpen.value = !boardSearchOpen.value
  if (!boardSearchOpen.value && search.value) {
    search.value = ''
    void load()
  }
}

function assigneeName(task: TaskRecord): string {
  const user = task.assignedTo
  if (!user || typeof user === 'string') return typeof user === 'string' ? user : 'Unassigned'
  const first = user.firstName || user.first_name || ''
  const last = user.lastName || user.last_name || ''
  const full = `${first} ${last}`.trim()
  return full || user.email || 'Unassigned'
}

function assigneeInitials(task: TaskRecord): string {
  const user = task.assignedTo
  if (!user || typeof user === 'string') return '?'
  const first = (user.firstName || user.first_name || '').trim()
  const last = (user.lastName || user.last_name || '').trim()
  if (first || last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?'
  if (user.email) return user.email.charAt(0).toUpperCase()
  return '?'
}

function priorityToneClass(priority: string | undefined): string {
  switch (String(priority || '').toLowerCase()) {
    case 'urgent':
      return 'kanban-meta--urgent'
    case 'high':
      return 'kanban-meta--high'
    default:
      return ''
  }
}

async function handleKanbanUpdate(payload: {
  item: Record<string, unknown>
  newStage: string
  previousStage: string
}) {
  const item = payload.item as TaskRecord
  const { newStage, previousStage } = payload
  if (!item?._id || newStage === previousStage) return
  try {
    await updateTaskStatus(item._id, newStage)
    item.status = newStage
    const idx = tasks.value.findIndex((row) => row._id === item._id)
    if (idx >= 0) tasks.value[idx].status = newStage
    void refreshListStatistics()
  } catch (err) {
    item.status = previousStage
    error.value = err instanceof Error ? err.message : 'Failed to update task'
    await load()
  }
}

async function loadStatusColors() {
  const fallback: Record<string, string> = {
    todo: '#6B7280',
    in_progress: '#2563EB',
    waiting: '#D97706',
    completed: '#16A34A',
    cancelled: '#DC2626'
  }
  try {
    const res = await apiClient.get<{
      success?: boolean
      data?: Array<{
        key?: string
        moduleKey?: string
        fields?: Array<{
          key?: string
          options?: Array<string | { value?: string; id?: string; color?: string }>
        }>
      }>
    }>('/modules?key=tasks&context=all')

    const rows = Array.isArray(res?.data) ? res.data : []
    const mod =
      rows.find((row) => String(row?.key || row?.moduleKey || '').toLowerCase() === 'tasks') ||
      rows[0]
    const fields = mod?.fields || []
    const statusField = fields.find((f) => String(f?.key || '').toLowerCase() === 'status')
    const map: Record<string, string> = { ...fallback }
    for (const opt of statusField?.options || []) {
      if (typeof opt === 'string') continue
      const val = String(opt?.value ?? opt?.id ?? '').trim()
      const color = opt?.color ? String(opt.color).trim() : ''
      if (val && color) map[val] = color
    }
    statusColorMap.value = map
  } catch {
    statusColorMap.value = fallback
  }
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
      views.value = [...TASKS_SYSTEM_VIEWS]
    }

    const savedId = loadActiveSavedViewId(MODULE_KEY, auth.user?._id)
    const fallback = views.value.find((view) => view.isDefault)?.id || views.value[0]?.id || 'all'
    activeViewId.value =
      savedId && views.value.some((view) => view.id === savedId) ? savedId : fallback

    await load()
    await loadStatusColors()
    await nextTick()
    updateStatsFade()
  })()
})
</script>

<template>
  <section class="page tasks-page">
    <div class="top-row">
      <button class="view-chip" type="button" @click="viewSheetOpen = true">
        <FunnelIcon class="view-chip__icon" aria-hidden="true" />
        <span class="view-chip__label">{{ activeView.label }}</span>
        <ChevronDownIcon class="view-chip__chevron" aria-hidden="true" />
      </button>

      <div class="top-row__actions">
        <div class="layout-icons" role="tablist" aria-label="Layout">
          <button
            type="button"
            class="layout-icon"
            role="tab"
            :class="{ 'is-active': layoutMode === 'list' }"
            :aria-selected="layoutMode === 'list'"
            title="List"
            @click="setLayoutMode('list')"
          >
            <ListBulletIcon class="toolbar-icon" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="layout-icon"
            role="tab"
            :class="{ 'is-active': layoutMode === 'kanban' }"
            :aria-selected="layoutMode === 'kanban'"
            title="Board"
            @click="setLayoutMode('kanban')"
          >
            <ViewColumnsIcon class="toolbar-icon" aria-hidden="true" />
          </button>
        </div>

        <button
          v-if="layoutMode === 'kanban'"
          class="toolbar-btn"
          type="button"
          :aria-pressed="showSearch"
          :title="showSearch ? 'Hide search' : 'Search'"
          @click="toggleBoardSearch"
        >
          <MagnifyingGlassIcon class="toolbar-icon" aria-hidden="true" />
        </button>

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
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'open' }"
        @click="setStatFocus('open')"
      >
        <span class="stat__value">{{ stats.open }}</span>
        <span class="stat__label">Open</span>
      </button>
      <button
        type="button"
        class="stat"
        :class="{ 'stat--active': statFocus === 'today' }"
        @click="setStatFocus('today')"
      >
        <span class="stat__value">{{ stats.dueToday }}</span>
        <span class="stat__label">Due Today</span>
      </button>
      <button
        type="button"
        class="stat stat--danger"
        :class="{ 'stat--active': statFocus === 'overdue' }"
        @click="setStatFocus('overdue')"
      >
        <span class="stat__value">{{ stats.overdue }}</span>
        <span class="stat__label">Overdue</span>
      </button>
    </div>

    <MobileSearchField
      v-if="showSearch"
      v-model="search"
      placeholder="Search tasks…"
      aria-label="Search tasks"
    />

    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="loading && layoutMode === 'list'" class="empty card">Loading tasks…</div>
    <div v-else-if="!loading && !filtered.length && layoutMode === 'list'" class="empty card">
      {{
        search.trim()
          ? 'No matching tasks.'
          : statFocus === 'today'
            ? 'Nothing due today.'
            : statFocus === 'overdue'
              ? 'No overdue tasks.'
              : statFocus === 'open'
                ? 'No open tasks.'
                : 'No tasks in this view.'
      }}
    </div>

    <div v-else-if="layoutMode === 'list'" class="card list">
      <div
        v-for="task in filtered"
        :key="task._id"
        class="task-row"
        role="link"
        tabindex="0"
        @click="openTask(task)"
        @keydown.enter="openTask(task)"
      >
        <button
          class="task-check"
          type="button"
          :aria-label="isCompleted(task) ? 'Mark as todo' : 'Mark complete'"
          :disabled="togglingId === task._id"
          @click="toggleComplete(task, $event)"
        >
          <span class="task-check__box" :class="{ 'task-check__box--on': isCompleted(task) }" aria-hidden="true">
            <CheckIcon v-if="isCompleted(task)" class="task-check__mark" aria-hidden="true" />
          </span>
        </button>

        <div class="task-body">
          <p class="task-title" :class="{ 'task-title--done': isCompleted(task) }">{{ titleFor(task) }}</p>
          <p class="task-meta">
            <span :class="statusPillClass(task.status)">{{ formatStatus(task.status) }}</span>
            <span v-if="formatPriority(task.priority)" :class="priorityPillClass(task.priority)">
              {{ formatPriority(task.priority) }}
            </span>
            <span v-if="task.dueDate" :class="dueClass(task)">{{ dueLabel(task) }}</span>
          </p>
        </div>
      </div>
    </div>

    <MobileKanbanBoard
      v-else
      :items="boardItems"
      :stages="taskStages"
      stage-key="status"
      item-id-key="_id"
      :loading="loading"
      loading-label="Loading board…"
      :get-stage-color="getStatusColor"
      :format-stage-label="formatStatus"
      :stats-open="statsVisible"
      @update="handleKanbanUpdate"
      @card-click="({ item }) => openTask(item as TaskRecord)"
    >
      <template #card="{ item }">
        <div class="kanban-card-body">
          <h4 class="kanban-card-title">{{ titleFor(item as TaskRecord) }}</h4>
          <div class="kanban-card-fields">
            <div class="kanban-meta kanban-meta--assignee">
              <span class="kanban-avatar" aria-hidden="true">{{ assigneeInitials(item as TaskRecord) }}</span>
              <span class="kanban-meta__label">{{ assigneeName(item as TaskRecord) }}</span>
            </div>
            <div
              v-if="(item as TaskRecord).dueDate"
              class="kanban-meta"
              :class="dueClass(item as TaskRecord)"
            >
              <CalendarDaysIcon class="kanban-meta__icon" aria-hidden="true" />
              <span>{{ dueDateShort(item as TaskRecord) }}</span>
            </div>
            <div
              v-if="formatPriority((item as TaskRecord).priority)"
              class="kanban-meta"
              :class="priorityToneClass((item as TaskRecord).priority)"
            >
              <FlagIconSolid class="kanban-meta__icon" aria-hidden="true" />
              <span>{{ formatPriority((item as TaskRecord).priority) }}</span>
            </div>
          </div>
        </div>
      </template>
    </MobileKanbanBoard>

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
.tasks-page {
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
.layout-icons,
.toolbar-btn,
.layout-icon {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
}

.view-chip,
.layout-icons,
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

.layout-icon:active {
  background: var(--bg-soft);
}

.view-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  max-width: calc(100% - 8.75rem);
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

.layout-icons {
  display: inline-flex;
  align-items: stretch;
  gap: 0.15rem;
  padding: 0.15rem;
}

.layout-icon {
  display: grid;
  place-items: center;
  width: calc(var(--toolbar-h) - 0.3rem - 2px);
  min-width: calc(var(--toolbar-h) - 0.3rem - 2px);
  border: none;
  border-radius: calc(var(--toolbar-r) - 0.1rem);
  background: transparent;
  color: var(--text-muted);
  padding: 0;
}

.layout-icon.is-active {
  background: var(--bg-soft);
  color: var(--accent-strong);
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
  /* Bleed to screen edges so cards scroll under the page padding */
  margin: 0 calc(var(--stat-edge) * -1);
  padding-block: 0.15rem;
}

/* Flex spacers instead of padding: WebKit drops inline padding on scroll containers */
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

.stat--danger .stat__value {
  color: var(--danger);
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

.kanban-card-body {
  display: grid;
  gap: 0.55rem;
}

.kanban-card-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kanban-card-fields {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.kanban-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.kanban-meta__icon {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}

.kanban-meta__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kanban-meta--urgent {
  color: var(--danger);
  font-weight: 600;
}

.kanban-meta--high {
  color: #d97706;
  font-weight: 600;
}

.kanban-avatar {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  background: #9ca3af;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.task-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
}

.task-row:last-child {
  border-bottom: none;
}

.task-row:active {
  background: var(--bg-soft);
}

.task-check {
  flex-shrink: 0;
  margin-top: 0.1rem;
  border: none;
  background: transparent;
  padding: 0;
  color: var(--accent-strong);
}

.task-check__box {
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 0.3rem;
  border: 1.5px solid var(--border);
  display: grid;
  place-items: center;
  background: var(--bg-elevated);
}

.task-check__box--on {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #fff;
}

.task-check__mark {
  width: 0.625rem;
  height: 0.625rem;
}

.task-body {
  min-width: 0;
  flex: 1;
}

.task-title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.35;
}

.task-title--done {
  color: var(--text-muted);
}

.task-meta {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  flex-wrap: wrap;
  margin: 0.4rem 0 0;
}

.pill-info {
  background: rgba(96, 73, 231, 0.14);
  color: var(--accent-strong);
}

.pill-danger {
  background: rgba(239, 68, 68, 0.14);
  color: var(--danger);
}

.due {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-weight: 500;
}

.due--today {
  color: var(--warning);
}

.due--overdue {
  color: var(--danger);
  font-weight: 600;
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
