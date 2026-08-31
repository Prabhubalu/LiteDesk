<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  FaceSmileIcon,
  FlagIcon,
  HandThumbUpIcon,
  LinkIcon,
  TagIcon,
  UserIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { FlagIcon as FlagIconSolid } from '@heroicons/vue/24/solid'
import {
  createTaskComment,
  deleteTask,
  fetchAssignableUsers,
  fetchTask,
  fetchTaskActivityLogs,
  fetchTaskComments,
  toggleSubtask,
  toggleTaskCommentReaction,
  updateTask,
  uploadTaskCommentAttachment,
  type TaskActivityLog,
  type TaskAssignee,
  type TaskComment,
  type TaskCommentAttachment,
  type TaskRecord,
  type TaskSubtask
} from '@/api/tasks'
import MobileBottomSheet from '@/components/MobileBottomSheet.vue'
import MobileCommentComposer from '@/components/MobileCommentComposer.vue'
import MobileRecordBar from '@/components/MobileRecordBar.vue'
import MobileRecordFields from '@/components/MobileRecordFields.vue'
import MobileRichHtml from '@/components/MobileRichHtml.vue'
import ModuleIcon from '@/components/ModuleIcon.vue'
import { getApiOrigin } from '@/config/apiBase'
import { addRecent } from '@/services/recents'
import { useAuthStore } from '@/stores/auth'
import { useShellChrome } from '@/composables/useShellChrome'
import { tapHaptic } from '@/utils/haptics'
import { hasPermission } from '@/utils/permissions'
import { htmlToPlainText } from '@/utils/richHtml'

const props = defineProps<{ taskId: string }>()

type RecordTab = 'summary' | 'activity'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'activity', label: 'Activity' }
]

const RELATED_MODULE: Record<string, string> = {
  contact: 'people',
  person: 'people',
  people: 'people',
  organization: 'organizations',
  deal: 'deals',
  event: 'events',
  case: 'cases'
}

const STATUS_LABELS: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' }
]

const STATUS_COLORS: Record<string, string> = {
  todo: '#6B7280',
  in_progress: '#2563EB',
  waiting: '#D97706',
  completed: '#16A34A',
  cancelled: '#DC2626'
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280',
  medium: '#2563EB',
  high: '#D97706',
  urgent: '#DC2626'
}

type EditField = 'status' | 'priority' | 'startDate' | 'dueDate' | 'assignee' | 'estimate' | 'description' | null

const task = ref<TaskRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const tab = ref<RecordTab>('summary')

const comments = ref<TaskComment[]>([])
const commentsLoading = ref(false)
const commentsError = ref<string | null>(null)
const commentsLoaded = ref(false)
const commentSending = ref(false)
const commentComposer = ref<{ reset: () => void } | null>(null)
const activityLogs = ref<TaskActivityLog[]>([])
const replyTo = ref<TaskComment | null>(null)
const reactionPickerId = ref<string | null>(null)
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉']

type CommentPart =
  | { type: 'text'; text: string }
  | { type: 'mention'; name: string }
  | { type: 'break' }

const router = useRouter()
const auth = useAuthStore()
const chrome = useShellChrome()
const canEdit = computed(() => hasPermission(auth.user, 'tasks.edit'))
const canDelete = computed(() => hasPermission(auth.user, 'tasks.delete'))
const tagSheetOpen = ref(false)
const moreSheetOpen = ref(false)
const tagDraft = ref('')
const tagList = ref<string[]>([])
const editingTitle = ref(false)
const titleDraft = ref('')
const titleInput = ref<HTMLTextAreaElement | null>(null)
const editField = ref<EditField>(null)
const editDraft = ref('')
const failedAvatars = ref<Record<string, true>>({})
const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const isDateField = computed(() => editField.value === 'startDate' || editField.value === 'dueDate')
const todayKey = toDateInput(new Date())

const calendarMonthLabel = computed(() =>
  calendarMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)

const calendarSelectedLabel = computed(() => {
  const selected = parseDateKey(editDraft.value)
  if (!selected) return 'Select a date'
  return selected.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
})

const calendarDays = computed(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const first = new Date(year, month, 1)
  const cursor = new Date(year, month, 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(cursor)
    date.setDate(cursor.getDate() + index)
    const key = toDateInput(date)
    return {
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
      isSelected: key === editDraft.value
    }
  })
})
const assignableUsers = ref<TaskAssignee[]>([])
const togglingSubtaskId = ref<string | null>(null)

const editTitle = computed(() => {
  switch (editField.value) {
    case 'status':
      return 'Status'
    case 'priority':
      return 'Priority'
    case 'startDate':
      return 'Start date'
    case 'dueDate':
      return 'Due date'
    case 'assignee':
      return 'Assignee'
    case 'estimate':
      return 'Estimate'
    case 'description':
      return 'Description'
    default:
      return 'Edit'
  }
})

type EditChoice = { value: string; label: string; avatar?: string; initials?: string }

const editChoices = computed((): EditChoice[] => {
  if (editField.value === 'status') return STATUS_OPTIONS
  if (editField.value === 'priority') return PRIORITY_OPTIONS
  if (editField.value === 'assignee') {
    return assignableUsers.value.map((user) => {
      const person = parsePerson(user)
      return {
        value: String(user._id || ''),
        label: person?.name || user.email || 'User',
        avatar: person?.avatar || '',
        initials: person?.initials || initialsFor(user.email || 'U')
      }
    })
  }
  return []
})

const isDone = computed(() => {
  const status = String(task.value?.status || '').toLowerCase()
  return status === 'completed' || status === 'done'
})

const title = computed(() => String(task.value?.title || task.value?.name || 'Task'))

watch(
  title,
  (value) => {
    chrome.setAstraRecordName(value && value !== 'Task' ? value : null)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  chrome.setAstraRecordName(null)
})

const currentUserId = computed(() => String(auth.user?._id || ''))

type ActivityItem =
  | { kind: 'log'; id: string; at: number; title: string; detail?: string }
  | { kind: 'comment'; id: string; at: number; comment: TaskComment }

const activityItems = computed<ActivityItem[]>(() => {
  const logs = activityLogs.value.map((log, index) => {
    const formatted = formatActivityLog(log)
    return {
      kind: 'log' as const,
      id: `log-${log.timestamp || index}-${log.action || 'event'}`,
      at: Date.parse(String(log.timestamp || '')) || index,
      title: formatted.title,
      detail: formatted.detail
    }
  })
  const notes = comments.value.map((comment) => ({
    kind: 'comment' as const,
    id: comment._id,
    at: Date.parse(String(comment.createdAt || '')) || 0,
    comment
  }))
  return [...logs, ...notes].sort((a, b) => a.at - b.at)
})

const assignee = computed(() => parsePerson(task.value?.assignedTo))

const dueDate = computed(() => parseDate(task.value?.dueDate))
const startDate = computed(() => parseDate(task.value?.startDate))
const createdAt = computed(() => parseDate(stringField('createdAt')))
const updatedAt = computed(() => parseDate(stringField('updatedAt')))

const overdue = computed(() => {
  if (!dueDate.value || isDone.value) return false
  if (String(task.value?.status || '').toLowerCase() === 'cancelled') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return dueDate.value.getTime() < today.getTime()
})

const dueTone = computed(() => {
  if (!dueDate.value) return ''
  if (overdue.value) return 'is-overdue'
  return dueDate.value.toDateString() === new Date().toDateString() ? 'is-today' : ''
})

const estimateLabel = computed(() => hoursLabel(task.value?.estimatedHours))
const actualHoursLabel = computed(() => hoursLabel(task.value?.actualHours))

const tags = computed(() => {
  const raw = task.value?.tags
  if (!Array.isArray(raw)) return []
  return raw.map((tag) => String(tag)).filter(Boolean)
})

const taskTypeLabel = computed(() => {
  const value = stringField('taskType')
  return value ? capitalize(value.replace(/_/g, ' ')) : ''
})

const subtasks = computed<TaskSubtask[]>(() => {
  const list = task.value?.subtasks
  return Array.isArray(list) ? list.filter((item) => item?.title) : []
})

const completedSubtaskCount = computed(
  () => subtasks.value.filter((item) => item.completed).length
)

const relatedItems = computed(() => {
  const items: Array<{
    key: string
    title: string
    meta: string
    moduleKey: string
    to?: { name: string; params: Record<string, string> }
  }> = []
  const related = task.value?.relatedTo
  if (related && typeof related === 'object') {
    const rec = related.id
    const type = String(related.type || '').trim()
    let name = ''
    let id = ''
    if (rec && typeof rec === 'object') {
      const row = rec as Record<string, unknown>
      name = String(row.name || row.title || row.fullName || '').trim()
      id = String(row._id || row.id || '')
    } else if (rec != null) {
      id = String(rec)
    }
    if (type && type !== 'none') {
      const moduleKey = RELATED_MODULE[type] || type
      items.push({
        key: `related-${type}-${id || name}`,
        title: name || capitalize(type),
        meta: capitalize(type),
        moduleKey,
        to: RELATED_MODULE[type] && id
          ? { name: 'module-detail', params: { moduleKey, recordId: id } }
          : undefined
      })
    }
  }
  const project = task.value?.projectId
  if (project && typeof project === 'object') {
    const row = project as Record<string, unknown>
    const name = String(row.name || row.title || '').trim()
    if (name) {
      items.push({
        key: `project-${String(row._id || name)}`,
        title: name,
        meta: 'Project',
        moduleKey: 'organizations'
      })
    }
  }
  return items
})

const keyFieldRows = computed(() => [
  { key: 'status', label: 'Status', value: formatStatus(task.value?.status) },
  { key: 'priority', label: 'Priority', value: formatPriority(task.value?.priority) },
  { key: 'startDate', label: 'Start', value: startDate.value ? formatDate(startDate.value) : '' },
  { key: 'dueDate', label: 'Due', value: dueDate.value ? formatDate(dueDate.value) : '' },
  { key: 'assignee', label: 'Assignee', value: assignee.value?.name || '' },
  { key: 'estimate', label: 'Estimate', value: estimateLabel.value }
])

const detailRows = computed(() => {
  const rows = [
    { key: 'taskType', label: 'Type', value: taskTypeLabel.value },
    { key: 'actualHours', label: 'Actual', value: actualHoursLabel.value },
    { key: 'tags', label: 'Tags', value: tags.value.join(', ') },
    { key: 'createdAt', label: 'Created', value: createdAt.value ? formatDate(createdAt.value) : '' },
    { key: 'updatedAt', label: 'Updated', value: updatedAt.value ? formatDate(updatedAt.value) : '' }
  ]
  return rows.filter((row) => row.value)
})

function stringField(key: string): string {
  const value = task.value?.[key]
  return value == null ? '' : String(value).trim()
}

function hoursLabel(value: unknown): string {
  const hours = Number(value)
  if (!Number.isFinite(hours) || hours <= 0) return ''
  return `${hours}h`
}

function resolveAvatarUrl(raw?: string | null): string {
  const value = String(raw || '').trim()
  if (!value) return ''
  if (/^(https?:|data:|blob:)/i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  return `${getApiOrigin()}${value.startsWith('/') ? value : `/${value}`}`
}

function avatarIsReady(src?: string): boolean {
  return Boolean(src) && !failedAvatars.value[src as string]
}

function onAvatarError(src?: string) {
  if (!src) return
  failedAvatars.value = { ...failedAvatars.value, [src]: true }
}

function parsePerson(
  raw: TaskAssignee | string | null | undefined
): { name: string; initials: string; avatar?: string } | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const name = raw.trim()
    return name ? { name, initials: initialsFor(name) } : null
  }
  const name =
    [raw.firstName || raw.first_name, raw.lastName || raw.last_name].filter(Boolean).join(' ').trim()
    || raw.email
    || ''
  if (!name) return null
  return { name, initials: initialsFor(name), avatar: resolveAvatarUrl(raw.avatar) }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatStatus(status: string | undefined): string {
  if (!status) return 'Todo'
  const key = status.toLowerCase()
  return STATUS_LABELS[key] || capitalize(status.replace(/_/g, ' '))
}

function formatPriority(priority: string | undefined): string {
  if (!priority) return ''
  const key = priority.toLowerCase()
  return PRIORITY_LABELS[key] || capitalize(priority)
}

function statusColor(status: string | undefined): string {
  return STATUS_COLORS[String(status || '').toLowerCase()] || STATUS_COLORS.todo
}

function priorityColor(priority: string | undefined): string {
  return PRIORITY_COLORS[String(priority || '').toLowerCase()] || PRIORITY_COLORS.medium
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function commentAuthor(comment: TaskComment) {
  return parsePerson(comment.author) || { name: 'Someone', initials: '?' }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await fetchTask(props.taskId)
    task.value = res.data
    if (task.value) {
      await addRecent({
        id: props.taskId,
        moduleKey: 'tasks',
        title: String(task.value.title || task.value.name || 'Task'),
        path: `/tasks/${props.taskId}`
      })
      void loadComments()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load task'
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  if (commentsLoaded.value || commentsLoading.value) return
  commentsLoading.value = true
  commentsError.value = null
  try {
    const [commentsRes, logsRes] = await Promise.all([
      fetchTaskComments(props.taskId),
      fetchTaskActivityLogs(props.taskId).catch(() => ({ data: [] as TaskActivityLog[] }))
    ])
    comments.value = Array.isArray(commentsRes.data) ? commentsRes.data : []
    activityLogs.value = Array.isArray(logsRes.data) ? logsRes.data : []
    commentsLoaded.value = true
    if (!assignableUsers.value.length) {
      try {
        const usersRes = await fetchAssignableUsers()
        assignableUsers.value = Array.isArray(usersRes.data) ? usersRes.data : []
      } catch {
        assignableUsers.value = []
      }
    }
  } catch (err) {
    commentsError.value = err instanceof Error ? err.message : 'Failed to load activity'
  } finally {
    commentsLoading.value = false
  }
}

function toDateInput(date: Date | null): string {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function syncCalendarMonth(value: string) {
  const selected = parseDateKey(value) || new Date()
  calendarMonth.value = new Date(selected.getFullYear(), selected.getMonth(), 1)
}

function shiftCalendar(delta: number) {
  calendarMonth.value = new Date(
    calendarMonth.value.getFullYear(),
    calendarMonth.value.getMonth() + delta,
    1
  )
}

async function pickCalendarDay(key: string) {
  editDraft.value = key
  await commitEdit()
}

async function clearDate() {
  editDraft.value = ''
  await commitEdit()
}

async function saveTask(payload: Record<string, unknown>) {
  if (!task.value || !canEdit.value) return
  saving.value = true
  error.value = null
  try {
    const res = await updateTask(props.taskId, payload)
    if (res.data) task.value = { ...task.value, ...res.data }
    void tapHaptic()
    editField.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save changes'
    await load()
  } finally {
    saving.value = false
  }
}

function resizeTitleInput() {
  const el = titleInput.value
  if (!el) return
  el.style.height = '0px'
  el.style.height = `${el.scrollHeight}px`
}

async function startTitleEdit() {
  if (!canEdit.value) return
  titleDraft.value = title.value === 'Task' ? '' : title.value
  editingTitle.value = true
  await nextTick()
  resizeTitleInput()
  titleInput.value?.focus()
  titleInput.value?.select()
}

async function saveTitle() {
  if (!editingTitle.value) return
  editingTitle.value = false
  const next = titleDraft.value.trim()
  if (!next || next === title.value) return
  await saveTask({ title: next })
}

async function openField(key: string) {
  if (!canEdit.value) return
  if (key === 'status') {
    editDraft.value = String(task.value?.status || 'todo')
    editField.value = 'status'
    return
  }
  if (key === 'priority') {
    editDraft.value = String(task.value?.priority || 'medium')
    editField.value = 'priority'
    return
  }
  if (key === 'startDate') {
    editDraft.value = toDateInput(startDate.value)
    syncCalendarMonth(editDraft.value)
    editField.value = 'startDate'
    return
  }
  if (key === 'dueDate') {
    editDraft.value = toDateInput(dueDate.value)
    syncCalendarMonth(editDraft.value)
    editField.value = 'dueDate'
    return
  }
  if (key === 'estimate') {
    editDraft.value =
      task.value?.estimatedHours != null ? String(task.value.estimatedHours) : ''
    editField.value = 'estimate'
    return
  }
  if (key === 'description') {
    editDraft.value = htmlToPlainText(String(task.value?.description || ''))
    editField.value = 'description'
    return
  }
  if (key === 'assignee') {
    const current = task.value?.assignedTo
    editDraft.value =
      current && typeof current === 'object' ? String(current._id || '') : String(current || '')
    editField.value = 'assignee'
    if (!assignableUsers.value.length) {
      try {
        const res = await fetchAssignableUsers()
        assignableUsers.value = Array.isArray(res.data) ? res.data : []
      } catch {
        assignableUsers.value = []
      }
    }
  }
}

function closeEdit() {
  editField.value = null
}

function goBack() {
  if (window.history.length > 1) router.back()
  else void router.push({ name: 'tasks' })
}

function onHeaderEdit() {
  moreSheetOpen.value = false
  if (tab.value !== 'summary') tab.value = 'summary'
  void startTitleEdit()
}

function onHeaderTag() {
  tagList.value = [...tags.value]
  tagDraft.value = ''
  tagSheetOpen.value = true
}

function addTag() {
  const next = tagDraft.value.trim()
  if (!next || tagList.value.includes(next)) return
  tagList.value = [...tagList.value, next]
  tagDraft.value = ''
}

function removeTag(tag: string) {
  tagList.value = tagList.value.filter((item) => item !== tag)
}

async function saveTags() {
  await saveTask({ tags: tagList.value })
  tagSheetOpen.value = false
}

async function copyLink() {
  moreSheetOpen.value = false
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/tasks/${props.taskId}`)
    success.value = 'Link copied'
  } catch {
    error.value = 'Could not copy link'
  }
}

async function onDelete() {
  if (!canDelete.value) return
  moreSheetOpen.value = false
  if (!window.confirm('Delete this task?')) return
  try {
    await deleteTask(props.taskId)
    void tapHaptic()
    await router.replace({ name: 'tasks' })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not delete task'
  }
}

async function pickChoice(value: string) {
  if (!value) return
  if (editField.value === 'status') await saveTask({ status: value })
  else if (editField.value === 'priority') await saveTask({ priority: value })
  else if (editField.value === 'assignee') await saveTask({ assignedTo: value })
}

async function commitEdit() {
  if (editField.value === 'startDate') {
    await saveTask({ startDate: editDraft.value || null })
    return
  }
  if (editField.value === 'dueDate') {
    await saveTask({ dueDate: editDraft.value || null })
    return
  }
  if (editField.value === 'estimate') {
    const hours = Number(editDraft.value)
    await saveTask({
      estimatedHours: Number.isFinite(hours) && hours > 0 ? hours : null
    })
    return
  }
  if (editField.value === 'description') {
    const text = editDraft.value.trim()
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    const html = escaped
      ? `<p>${escaped.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
      : ''
    await saveTask({ description: html })
  }
}

async function onToggleSubtask(item: TaskSubtask) {
  if (!canEdit.value || !item._id || togglingSubtaskId.value) return
  togglingSubtaskId.value = item._id
  try {
    const res = await toggleSubtask(props.taskId, item._id, !item.completed)
    if (res.data) task.value = { ...(task.value as TaskRecord), ...res.data }
    else if (task.value) {
      task.value = {
        ...task.value,
        subtasks: (task.value.subtasks || []).map((row) =>
          row._id === item._id ? { ...row, completed: !row.completed } : row
        )
      }
    }
    void tapHaptic()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not update subtask'
  } finally {
    togglingSubtaskId.value = null
  }
}

function commentLooksHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value) && !/@\[/.test(value)
}

function parseCommentParts(value: string): CommentPart[] {
  const parts: CommentPart[] = []
  const pushText = (text: string) => {
    const lines = text.split('\n')
    lines.forEach((line, index) => {
      if (line) parts.push({ type: 'text', text: line })
      if (index < lines.length - 1) parts.push({ type: 'break' })
    })
  }
  const pattern = /@\[([^\]]+)\]\((user|group|agent|all):([^)]+)\)/g
  let last = 0
  let match = pattern.exec(value)
  while (match) {
    if (match.index > last) pushText(value.slice(last, match.index))
    parts.push({ type: 'mention', name: match[1] })
    last = pattern.lastIndex
    match = pattern.exec(value)
  }
  if (last < value.length) pushText(value.slice(last))
  return parts
}

function attachmentName(file: TaskCommentAttachment): string {
  return file.originalname || file.filename || 'Attachment'
}

function attachmentHref(file: TaskCommentAttachment): string {
  return resolveAvatarUrl(file.url)
}

function actorLabel(log: TaskActivityLog): string {
  const id = typeof log.userId === 'object' ? log.userId?._id : log.userId
  if (id && String(id) === currentUserId.value) return 'You'
  return String(log.user || 'Someone')
}

function prettyValue(value: unknown): string {
  const text = String(value ?? '').trim()
  if (!text) return 'empty'
  const key = text.toLowerCase()
  if (['todo', 'in_progress', 'waiting', 'completed', 'cancelled', 'done'].includes(key)) {
    return formatStatus(text)
  }
  return formatPriority(text) || text.replace(/_/g, ' ')
}

function formatActivityLog(log: TaskActivityLog): { title: string; detail?: string } {
  const actor = actorLabel(log)
  const action = String(log.action || 'updated')
  const details = log.details || {}
  if (action === 'created') return { title: `${actor} created this task` }
  if (action === 'updated') return { title: `${actor} updated this task` }
  if (action === 'field_changed' || action === 'status_changed') {
    const field = String(details.fieldLabel || details.field || 'field').replace(/_/g, ' ')
    const from = prettyValue(details.from ?? details.oldValue)
    const to = prettyValue(details.to ?? details.newValue)
    return {
      title: `${actor} changed ${field}`,
      detail: `Changed ${field} from '${from}' to '${to}'`
    }
  }
  if (action === 'assigned') {
    return { title: `${actor} assigned to ${String(details.assignedTo || 'a user')}` }
  }
  return { title: `${actor} ${action.replace(/_/g, ' ')}` }
}

function formatRelativeTime(value?: string | number): string {
  if (value === undefined || value === null || value === '') return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hrs ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' at ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase()
}

function commentMentionsMe(comment: TaskComment): boolean {
  const content = String(comment.content || '')
  if (currentUserId.value && content.includes(`(user:${currentUserId.value})`)) return true
  return content.includes('(all:')
}

function isMyReaction(comment: TaskComment, emoji: string): boolean {
  return (comment.myReactions || []).includes(emoji)
}

function startReply(comment: TaskComment) {
  replyTo.value = comment
  reactionPickerId.value = null
}

function cancelReply() {
  replyTo.value = null
}

async function onToggleReaction(comment: TaskComment, emoji: string) {
  try {
    const res = await toggleTaskCommentReaction(props.taskId, comment._id, emoji)
    if (res.data) {
      comments.value = comments.value.map((row) => (row._id === comment._id ? res.data : row))
    }
    reactionPickerId.value = null
    void tapHaptic()
  } catch (err) {
    commentsError.value = err instanceof Error ? err.message : 'Could not update reaction'
  }
}

async function onSendComment(payload: { content: string; files: File[] }) {
  const text = payload.content.trim() || (payload.files.length ? 'Attached file(s)' : '')
  if (!text || commentSending.value) return
  commentSending.value = true
  commentsError.value = null
  try {
    const attachments: TaskCommentAttachment[] = []
    for (const file of payload.files) {
      const uploaded = await uploadTaskCommentAttachment(props.taskId, file)
      if (uploaded.url) {
        attachments.push({
          url: uploaded.url,
          filename: uploaded.originalname || file.name,
          originalname: uploaded.originalname || file.name,
          size: uploaded.size ?? file.size,
          mimetype: uploaded.mimetype || file.type,
          documentId: uploaded.documentId
        })
      }
    }
    const res = await createTaskComment(props.taskId, text, attachments, replyTo.value?._id || null)
    if (res.data) comments.value = [...comments.value, res.data]
    commentComposer.value?.reset()
    replyTo.value = null
    void tapHaptic()
  } catch (err) {
    commentsError.value = err instanceof Error ? err.message : 'Failed to post comment'
  } finally {
    commentSending.value = false
  }
}

watch(tab, (next) => {
  if (next === 'activity') void loadComments()
})

onMounted(() => {
  void load()
})
</script>

<template>
  <section class="record-drawer">
    <MobileRecordBar
      title="Task"
      :tabs="TABS"
      :active-tab="tab"
      :show-edit="canEdit"
      :show-tag="canEdit"
      :show-more="true"
      :has-tags="tags.length > 0"
      @back="goBack"
      @edit="onHeaderEdit"
      @tag="onHeaderTag"
      @more="moreSheetOpen = true"
      @update:active-tab="tab = $event as RecordTab"
    />
    <div class="record-drawer__body">
    <div class="record-page">
    <div v-if="error" class="banner banner-error">{{ error }}</div>
    <div v-if="success" class="banner banner-info">{{ success }}</div>
    <div v-if="loading" class="empty">Loading task…</div>

    <template v-else-if="task">
      <div class="panels">
      <div class="pane" :class="{ 'is-active': tab === 'summary' }">
      <div class="stack">
        <article class="hero">
          <div class="hero__body">
            <textarea
              v-if="editingTitle"
              ref="titleInput"
              v-model="titleDraft"
              class="hero__title-input"
              rows="1"
              maxlength="200"
              aria-label="Task title"
              @input="resizeTitleInput"
              @blur="saveTitle"
              @keydown.enter.prevent="saveTitle"
              @keydown.escape="editingTitle = false"
            />
            <h1
              v-else
              :class="{ 'is-done': isDone, 'is-editable': canEdit }"
              @click="startTitleEdit"
            >
              {{ title }}
            </h1>
          </div>
        </article>

        <section class="block">
          <header class="block__head">
            <h2>Key Fields</h2>
          </header>
          <MobileRecordFields
            :rows="keyFieldRows"
            :interactive="canEdit"
            @edit="openField"
          >
            <template #status-icon><span class="field-status-ring" aria-hidden="true" /></template>
            <template #priority-icon><FlagIcon /></template>
            <template #startDate-icon><CalendarDaysIcon /></template>
            <template #dueDate-icon><CalendarDaysIcon /></template>
            <template #assignee-icon><UserIcon /></template>
            <template #estimate-icon><ClockIcon /></template>
            <template #status>
              <span class="pick-value">
                <span class="pick-dot" :style="{ background: statusColor(task.status) }" />
                {{ formatStatus(task.status) }}
              </span>
            </template>
            <template #priority>
              <span v-if="formatPriority(task.priority)" class="pick-value">
                <FlagIconSolid class="pick-flag" :style="{ color: priorityColor(task.priority) }" />
                {{ formatPriority(task.priority) }}
              </span>
              <span v-else class="muted">—</span>
            </template>
            <template #dueDate>
              <span v-if="dueDate" :class="dueTone">{{ formatDate(dueDate) }}</span>
              <span v-else class="muted">—</span>
            </template>
            <template #assignee>
              <span v-if="assignee" class="person">
                <img
                  v-if="avatarIsReady(assignee.avatar)"
                  class="person__avatar"
                  :src="assignee.avatar"
                  alt=""
                  @error="onAvatarError(assignee.avatar)"
                />
                <span v-else class="person__initials">{{ assignee.initials }}</span>
                {{ assignee.name }}
              </span>
              <span v-else class="muted">Unassigned</span>
            </template>
          </MobileRecordFields>
        </section>

        <section class="block">
          <header class="block__head">
            <h2>Description</h2>
          </header>
          <button
            v-if="canEdit"
            type="button"
            class="edit-surface"
            @click="openField('description')"
          >
            <MobileRichHtml :html="task.description" empty-text="Tap to add a description" />
          </button>
          <MobileRichHtml v-else :html="task.description" empty-text="No description yet." />
        </section>

        <section v-if="detailRows.length" class="block">
          <header class="block__head">
            <h2>Details</h2>
          </header>
          <MobileRecordFields :rows="detailRows">
            <template #taskType-icon><ClipboardDocumentIcon /></template>
            <template #actualHours-icon><ClockIcon /></template>
            <template #tags-icon><TagIcon /></template>
            <template #createdAt-icon><CalendarDaysIcon /></template>
            <template #updatedAt-icon><CalendarDaysIcon /></template>
            <template #tags>
              <div v-if="tags.length" class="tag-row">
                <span v-for="tag in tags" :key="tag" class="pill">{{ tag }}</span>
              </div>
              <span v-else class="muted">—</span>
            </template>
          </MobileRecordFields>
        </section>

        <section class="block">
          <header class="block__head">
            <h2>Subtasks</h2>
            <span class="count">{{ completedSubtaskCount }}/{{ subtasks.length }}</span>
          </header>
          <ul v-if="subtasks.length" class="rows">
            <li
              v-for="(item, index) in subtasks"
              :key="item._id || String(index)"
              class="row"
              :class="{ 'is-done': item.completed, 'is-button': canEdit }"
            >
              <button
                v-if="canEdit"
                type="button"
                class="row__check"
                :disabled="togglingSubtaskId === item._id"
                :aria-label="item.completed ? 'Mark incomplete' : 'Mark complete'"
                @click="onToggleSubtask(item)"
              >
                <CheckIcon v-if="item.completed" class="row__check-mark" aria-hidden="true" />
              </button>
              <span v-else class="row__check" aria-hidden="true">
                <CheckIcon v-if="item.completed" class="row__check-mark" aria-hidden="true" />
              </span>
              <span class="row__title">{{ item.title }}</span>
            </li>
          </ul>
          <div v-else class="blank">
            <CheckCircleIcon class="blank__icon" />
            <p class="blank__title">No subtasks</p>
            <p class="blank__hint">Break this task into smaller steps on web.</p>
          </div>
        </section>

        <section class="block">
          <header class="block__head">
            <h2>Related</h2>
          </header>
          <div v-if="relatedItems.length" class="rows">
            <component
              :is="item.to ? RouterLink : 'div'"
              v-for="item in relatedItems"
              :key="item.key"
              class="row"
              v-bind="item.to ? { to: item.to } : {}"
            >
              <span class="row__icon">
                <ModuleIcon :module-key="item.moduleKey" :size="16" />
              </span>
              <span class="row__copy">
                <span class="row__title">{{ item.title }}</span>
                <span class="row__meta">{{ item.meta }}</span>
              </span>
              <ArrowRightIcon v-if="item.to" class="row__arrow" />
            </component>
          </div>
          <div v-else class="blank">
            <LinkIcon class="blank__icon" />
            <p class="blank__title">Nothing linked</p>
            <p class="blank__hint">People, deals, and other records show up here.</p>
          </div>
        </section>
      </div>
      </div>

      <div class="pane pane--activity" :class="{ 'is-active': tab === 'activity' }">
      <div class="activity">
        <div v-if="commentsError" class="banner banner-error">{{ commentsError }}</div>
        <div v-if="commentsLoading" class="blank">
          <p class="blank__hint">Loading activity…</p>
        </div>
        <div v-else-if="activityItems.length" class="activity__feed">
          <template v-for="item in activityItems" :key="item.id">
            <div v-if="item.kind === 'log'" class="system-row">
              <span class="system-row__dot" />
              <div class="system-row__copy">
                <p class="system-row__title">
                  {{ item.title }}
                  <span class="system-row__time">{{ formatRelativeTime(item.at) }}</span>
                </p>
                <p v-if="item.detail" class="system-row__detail">{{ item.detail }}</p>
              </div>
            </div>
            <article
              v-else
              class="comment-card"
              :class="{ 'is-mention': commentMentionsMe(item.comment) }"
            >
              <header class="comment-card__head">
                <img
                  v-if="avatarIsReady(commentAuthor(item.comment).avatar)"
                  class="person__avatar person__avatar--lg"
                  :src="commentAuthor(item.comment).avatar"
                  alt=""
                  @error="onAvatarError(commentAuthor(item.comment).avatar)"
                />
                <span v-else class="person__initials person__initials--lg">
                  {{ commentAuthor(item.comment).initials }}
                </span>
                <div class="comment-card__meta">
                  <strong>{{ commentAuthor(item.comment).name }}</strong>
                  <span>{{ formatRelativeTime(item.comment.createdAt) }}</span>
                </div>
              </header>
              <MobileRichHtml
                v-if="commentLooksHtml(String(item.comment.content || ''))"
                :html="item.comment.content"
                empty-text=""
              />
              <p v-else class="comment__text">
                <template v-for="(part, index) in parseCommentParts(String(item.comment.content || ''))" :key="index">
                  <span v-if="part.type === 'mention'" class="mention">@{{ part.name }}</span>
                  <br v-else-if="part.type === 'break'" />
                  <template v-else>{{ part.text }}</template>
                </template>
              </p>
              <div v-if="item.comment.attachments?.length" class="comment__files">
                <a
                  v-for="(file, index) in item.comment.attachments"
                  :key="`${item.comment._id}-${index}`"
                  class="file-link"
                  :href="attachmentHref(file)"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ attachmentName(file) }}
                </a>
              </div>
              <footer class="comment-card__bar">
                <button
                  v-for="reaction in item.comment.reactions || []"
                  :key="reaction.emoji"
                  type="button"
                  class="react-pill"
                  :class="{ 'is-on': isMyReaction(item.comment, reaction.emoji) }"
                  @click="onToggleReaction(item.comment, reaction.emoji)"
                >
                  <span>{{ reaction.emoji }}</span>
                  <span>{{ reaction.count }}</span>
                </button>
                <button
                  type="button"
                  class="react-icon"
                  aria-label="Like"
                  @click="onToggleReaction(item.comment, '👍')"
                >
                  <HandThumbUpIcon />
                </button>
                <div class="react-wrap">
                  <button
                    type="button"
                    class="react-icon"
                    aria-label="Add reaction"
                    @click="reactionPickerId = reactionPickerId === item.comment._id ? null : item.comment._id"
                  >
                    <FaceSmileIcon />
                  </button>
                  <div v-if="reactionPickerId === item.comment._id" class="react-pop">
                    <button
                      v-for="emoji in REACTION_EMOJIS"
                      :key="emoji"
                      type="button"
                      @click="onToggleReaction(item.comment, emoji)"
                    >
                      {{ emoji }}
                    </button>
                  </div>
                </div>
                <button type="button" class="reply-btn" @click="startReply(item.comment)">Reply</button>
              </footer>
            </article>
          </template>
        </div>
        <div v-else class="blank">
          <p class="blank__title">No activity yet</p>
          <p class="blank__hint">Comments and updates will show up here.</p>
        </div>

        <div class="activity__dock">
          <div v-if="replyTo" class="reply-chip">
            <span>Replying to {{ commentAuthor(replyTo).name }}</span>
            <button type="button" aria-label="Cancel reply" @click="cancelReply">
              <XMarkIcon />
            </button>
          </div>
          <MobileCommentComposer
            ref="commentComposer"
            :users="assignableUsers"
            :sending="commentSending"
            :placeholder="replyTo ? `Reply to ${commentAuthor(replyTo).name}…` : 'Write a comment…'"
            :resolve-avatar="resolveAvatarUrl"
            :initials-for="initialsFor"
            @send="onSendComment"
          />
        </div>
      </div>
      </div>
      </div>
    </template>
    </div>
    </div>

    <MobileBottomSheet
      :open="Boolean(editField)"
      :title="editTitle"
      :tall="editField === 'description' || editField === 'assignee'"
      @close="closeEdit"
    >
      <div v-if="editChoices.length" class="choices">
        <button
          v-for="choice in editChoices"
          :key="choice.value"
          type="button"
          class="choice"
          :class="{ 'is-selected': editDraft === choice.value }"
          :disabled="saving"
          @click="pickChoice(choice.value)"
        >
          <span
            v-if="editField === 'status'"
            class="pick-dot"
            :style="{ background: statusColor(choice.value) }"
          />
          <FlagIconSolid
            v-else-if="editField === 'priority'"
            class="pick-flag"
            :style="{ color: priorityColor(choice.value) }"
          />
          <img
            v-else-if="editField === 'assignee' && avatarIsReady(choice.avatar)"
            class="person__avatar"
            :src="choice.avatar"
            alt=""
            @error="onAvatarError(choice.avatar)"
          />
          <span
            v-else-if="editField === 'assignee'"
            class="person__initials"
          >{{ choice.initials }}</span>
          <span class="choice__label">{{ choice.label }}</span>
          <CheckIcon v-if="editDraft === choice.value" class="choice__check" />
        </button>
      </div>
      <div v-else-if="isDateField" class="cal">
        <p class="cal__value">{{ calendarSelectedLabel }}</p>
        <div class="cal__nav">
          <button type="button" class="cal__nav-btn" aria-label="Previous month" @click="shiftCalendar(-1)">
            <ChevronLeftIcon class="cal__nav-icon" />
          </button>
          <h3>{{ calendarMonthLabel }}</h3>
          <button type="button" class="cal__nav-btn" aria-label="Next month" @click="shiftCalendar(1)">
            <ChevronRightIcon class="cal__nav-icon" />
          </button>
        </div>
        <div class="cal__week">
          <span v-for="(day, index) in WEEKDAYS" :key="index">{{ day }}</span>
        </div>
        <div class="cal__grid">
          <button
            v-for="day in calendarDays"
            :key="day.key"
            type="button"
            class="cal__day"
            :class="{
              'is-outside': !day.inMonth,
              'is-today': day.isToday && !day.isSelected,
              'is-selected': day.isSelected
            }"
            :disabled="saving"
            @click="pickCalendarDay(day.key)"
          >
            {{ day.day }}
          </button>
        </div>
        <button
          v-if="editDraft"
          type="button"
          class="cal__clear"
          :disabled="saving"
          @click="clearDate"
        >
          Clear date
        </button>
      </div>
      <div v-else-if="editField === 'description'" class="notes">
        <textarea
          v-model="editDraft"
          class="notes__input"
          placeholder="Write a description…"
          enterkeyhint="enter"
        />
        <button
          class="notes__done"
          type="button"
          :disabled="saving"
          @click="commitEdit"
        >
          {{ saving ? 'Saving…' : 'Done' }}
        </button>
      </div>
      <form v-else class="edit-form" @submit.prevent="commitEdit">
        <input
          v-if="editField === 'estimate'"
          v-model="editDraft"
          type="number"
          min="0"
          step="0.5"
          inputmode="decimal"
          placeholder="Hours"
        />
        <div class="edit-form__actions">
          <button
            v-if="editField === 'estimate'"
            class="btn btn-ghost"
            type="button"
            :disabled="saving"
            @click="editDraft = ''; commitEdit()"
          >
            Clear
          </button>
          <button class="btn" type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </MobileBottomSheet>

    <MobileBottomSheet :open="tagSheetOpen" title="Tags" @close="tagSheetOpen = false">
      <form class="edit-form" @submit.prevent="addTag">
        <div class="tag-row">
          <button
            v-for="tag in tagList"
            :key="tag"
            type="button"
            class="pill"
            @click="removeTag(tag)"
          >
            {{ tag }} ×
          </button>
        </div>
        <input v-model="tagDraft" type="text" maxlength="40" placeholder="Add a tag" />
        <div class="edit-form__actions">
          <button class="btn btn-ghost" type="submit">Add</button>
          <button class="btn" type="button" :disabled="saving" @click="saveTags">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </form>
    </MobileBottomSheet>

    <MobileBottomSheet :open="moreSheetOpen" title="More" @close="moreSheetOpen = false">
      <div class="choices">
        <button type="button" class="choice" @click="copyLink">Copy link</button>
        <button
          v-if="canDelete"
          type="button"
          class="choice choice--danger"
          @click="onDelete"
        >
          Delete task
        </button>
      </div>
    </MobileBottomSheet>
  </section>
</template>

<style scoped>
.record-drawer__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 0;
}

.panels {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.pane {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(-8px, 0, 0);
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform, opacity;
  backface-visibility: hidden;
}

.pane.is-active {
  opacity: 1;
  pointer-events: auto;
  transform: translate3d(0, 0, 0);
  z-index: 1;
}

.pane--activity {
  transform: translate3d(8px, 0, 0);
  background: #f3f4f6;
}

.pane--activity.is-active {
  transform: translate3d(0, 0, 0);
}

.stack {
  display: grid;
  gap: 0;
  padding: 0.7rem 1.2rem 1.5rem;
}

.block {
  padding: 1.1rem 0 1.2rem;
  border-top: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
}

.block--flush {
  border-top: none;
  padding-top: 0.35rem;
}

.block__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0 0 0.7rem;
}

.block__head h2 {
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

@media (prefers-reduced-motion: reduce) {
  .pane {
    transition: none;
  }
}

.hero {
  padding: 0.35rem 0 1.15rem;
}

.hero__body {
  min-width: 0;
}

.hero h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.03em;
}

.hero h1.is-done {
  color: var(--text-muted);
}

.hero h1.is-editable {
  cursor: pointer;
}

.hero__title-input {
  display: block;
  width: 100%;
  margin: 0;
  border: none;
  padding: 0;
  resize: none;
  overflow: hidden;
  field-sizing: content;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.03em;
}

.hero__title-input:focus {
  outline: none;
}

.edit-surface {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  font: inherit;
  -webkit-tap-highlight-color: transparent;
}

.choices {
  display: grid;
  gap: 0.35rem;
  padding-bottom: 0.5rem;
}

.choice {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  border: none;
  border-radius: 0.5rem;
  padding: 0.72rem 0.4rem;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1rem;
  font-weight: 400;
  text-align: left;
}

.choice.is-selected {
  font-weight: 500;
}

.choice--danger {
  color: var(--danger);
}

.choice__label {
  min-width: 0;
  flex: 1;
}

.choice__check {
  width: 1.15rem;
  height: 1.15rem;
  flex-shrink: 0;
  color: var(--accent-strong);
}

.pick-value {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 500;
}

.pick-dot {
  width: 0.625rem;
  height: 0.625rem;
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
}

.pick-flag {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.cal {
  display: grid;
  gap: 0.85rem;
  padding: 0.15rem 0.15rem 0.5rem;
}

.cal__value {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.cal__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.cal__nav h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.cal__nav-btn {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--text);
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.cal__nav-icon {
  width: 1.15rem;
  height: 1.15rem;
}

.cal__week,
.cal__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.cal__week span {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  padding-bottom: 0.2rem;
}

.cal__day {
  aspect-ratio: 1;
  width: 100%;
  max-width: 2.75rem;
  margin: 0 auto;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 500;
  -webkit-tap-highlight-color: transparent;
}

.cal__day.is-outside {
  color: color-mix(in srgb, var(--text-muted) 70%, transparent);
}

.cal__day.is-today {
  color: var(--accent-strong);
  font-weight: 700;
}

.cal__day.is-selected {
  background: var(--accent-strong);
  color: #fff;
  font-weight: 700;
}

.cal__clear {
  justify-self: start;
  border: none;
  background: transparent;
  color: var(--accent-strong);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0.35rem 0.1rem 0.15rem;
}

.notes {
  display: flex;
  flex-direction: column;
  min-height: 18rem;
  gap: 0.85rem;
}

.notes__input {
  display: block;
  flex: 1;
  width: 100%;
  min-height: 16rem;
  margin: 0;
  padding: 0.1rem 0.05rem;
  border: none;
  resize: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 1.0625rem;
  line-height: 1.5;
  letter-spacing: -0.01em;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}

.notes__input::placeholder {
  color: var(--text-muted);
}

.notes__done {
  align-self: flex-end;
  border: none;
  border-radius: 0.75rem;
  padding: 0.7rem 1.15rem;
  background: var(--accent-strong);
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 600;
}

.edit-form {
  display: grid;
  gap: 0.75rem;
  padding-bottom: 0.35rem;
}

.edit-form input,
.edit-form textarea {
  width: 100%;
  border: 1px solid var(--border);
  background: var(--bg-soft);
  color: var(--text);
  border-radius: var(--radius-sm);
  padding: 0.8rem 0.9rem;
}

.edit-form textarea {
  resize: vertical;
  min-height: 8rem;
}

.edit-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  border-radius: 0.5rem;
  padding: 0.18rem 0.45rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: var(--bg-soft);
  color: var(--text-muted);
}

.pill-info {
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: var(--accent-strong);
}

.pill-warn {
  background: rgba(245, 158, 11, 0.14);
  color: var(--warning);
}

.pill-ok {
  background: rgba(16, 185, 129, 0.16);
  color: var(--success);
}

.pill-danger {
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
}

.count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
}

.person {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.person__avatar,
.person__initials {
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 999px;
  object-fit: cover;
  flex-shrink: 0;
}

.person__initials {
  display: grid;
  place-items: center;
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 16%, white);
}

.is-today {
  color: var(--warning);
  font-weight: 600;
}

.is-overdue {
  color: var(--danger);
  font-weight: 600;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.rows {
  display: flex;
  flex-direction: column;
  list-style: none;
  margin: 0;
  padding: 0;
}

.row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0;
  border: none;
  border-radius: 0.75rem;
  background: transparent;
  color: inherit;
  text-align: left;
  text-decoration: none;
}

.row.is-done .row__title {
  color: var(--text-muted);
  text-decoration: line-through;
}

.row__check {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 0.25rem;
  background: var(--bg-elevated);
  color: inherit;
  padding: 0;
  display: grid;
  place-items: center;
}

.row.is-done .row__check {
  background: var(--success);
  border-color: var(--success);
  color: #fff;
}

.row__check-mark {
  width: 0.6875rem;
  height: 0.6875rem;
}

.row__icon {
  display: flex;
  width: 1.25rem;
  height: 1.25rem;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.row__copy {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.row__title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
}

.row__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.row__arrow {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  color: var(--border);
  opacity: 0.8;
}

.blank {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 0.15rem 0 0.35rem;
  text-align: left;
}

.blank__icon {
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: 0.5rem;
  color: var(--text-muted);
}

.blank__title {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
}

.blank__hint {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.activity {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #f3f4f6;
}

.activity__feed {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex: 1;
  padding: 0.85rem 1rem 0.4rem;
}

.activity__dock {
  padding: 0 0.85rem;
  background: #f3f4f6;
}

.system-row {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.15rem 0.2rem;
}

.system-row__dot {
  width: 0.35rem;
  height: 0.35rem;
  margin-top: 0.45rem;
  border-radius: 999px;
  background: #94a3b8;
  flex-shrink: 0;
}

.system-row__copy {
  min-width: 0;
  flex: 1;
}

.system-row__title {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #64748b;
}

.system-row__time {
  flex-shrink: 0;
  color: #94a3b8;
  font-size: 0.72rem;
}

.system-row__detail {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  line-height: 1.4;
  color: #334155;
}

.comment-card {
  overflow: hidden;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #fff;
}

.comment-card.is-mention {
  border-left: 2px solid var(--accent-strong);
}

.comment-card__head {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.9rem 0.45rem;
}

.comment-card__meta {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.comment-card__meta strong {
  font-size: 0.88rem;
}

.comment-card__meta span {
  font-size: 0.72rem;
  color: var(--text-muted);
}

.comment-card .comment__text,
.comment-card :deep(.rich) {
  padding: 0 0.9rem 0.55rem;
}

.comment-card__bar {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem 0.5rem;
  border-top: 1px solid #eef0f3;
}

.react-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  height: 1.55rem;
  border: 1px solid #93c5fd;
  border-radius: 999px;
  padding: 0 0.5rem;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.75rem;
}

.react-pill.is-on {
  border-color: #2563eb;
  background: #dbeafe;
}

.react-icon {
  display: grid;
  place-items: center;
  width: 1.85rem;
  height: 1.85rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: #9ca3af;
  padding: 0;
}

.react-icon :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.react-wrap {
  position: relative;
}

.react-pop {
  position: absolute;
  bottom: 2.1rem;
  left: 0;
  z-index: 4;
  display: flex;
  gap: 0.2rem;
  padding: 0.3rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: 0 10px 24px -16px rgba(15, 23, 42, 0.45);
}

.react-pop button {
  width: 1.85rem;
  height: 1.85rem;
  border: none;
  background: transparent;
  font-size: 1rem;
}

.reply-btn {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #9ca3af;
  font: inherit;
  font-size: 0.8rem;
}

.reply-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin: 0.65rem 0 0;
  padding: 0.4rem 0.15rem 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.reply-chip button {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 0;
}

.reply-chip button :deep(svg) {
  width: 0.95rem;
  height: 0.95rem;
}

.person__avatar--lg,
.person__initials--lg {
  width: 1.85rem;
  height: 1.85rem;
  font-size: 0.68rem;
}

.comment__text {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.mention {
  display: inline-flex;
  align-items: center;
  margin: 0 0.05rem;
  border-radius: 0.35rem;
  padding: 0.05rem 0.35rem;
  background: color-mix(in srgb, var(--accent) 14%, white);
  color: var(--accent-strong);
  font-size: 0.85rem;
  font-weight: 600;
}

.comment__files {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}

.file-link {
  display: inline-flex;
  max-width: 100%;
  border-radius: 0.5rem;
  padding: 0.28rem 0.5rem;
  background: var(--bg-soft);
  color: var(--accent-strong);
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
