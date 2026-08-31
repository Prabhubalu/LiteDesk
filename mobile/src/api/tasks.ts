import { apiClient } from '@/api/client'

export type TaskAssignee = {
  _id?: string
  firstName?: string
  lastName?: string
  first_name?: string
  last_name?: string
  email?: string
  avatar?: string
}

export type TaskSubtask = {
  _id?: string
  title?: string
  completed?: boolean
}

export type TaskRecord = {
  _id: string
  title?: string
  name?: string
  status?: string
  dueDate?: string
  startDate?: string
  priority?: string
  taskType?: string
  description?: string
  estimatedHours?: number
  assignedTo?: TaskAssignee | string | null
  subtasks?: TaskSubtask[]
  relatedTo?: { type?: string; id?: unknown } | null
  taskNumber?: string
  [key: string]: unknown
}

export type TaskCommentAttachment = {
  url: string
  filename?: string
  originalname?: string
  size?: number
  mimetype?: string
  documentId?: string
}

export type TaskComment = {
  _id: string
  content?: string
  author?: TaskAssignee | string | null
  createdAt?: string
  attachments?: TaskCommentAttachment[]
  parentCommentId?: string | null
  reactions?: Array<{ emoji: string; count: number }>
  myReactions?: string[]
}

export type TaskActivityLog = {
  timestamp?: string
  user?: string
  userId?: string | { _id?: string } | null
  action?: string
  details?: Record<string, unknown>
}

export type TaskListStatistics = {
  open?: number
  dueToday?: number
  overdue?: number
  totalTasks?: number
  myTasks?: number
}

export type FetchTasksParams = {
  page?: number
  limit?: number
  status?: string
  priority?: string
  assignedTo?: string
  search?: string
  open?: boolean
  dueToday?: boolean
  overdue?: boolean
}

export type FetchTasksResult = {
  success: boolean
  data: TaskRecord[]
  pagination?: {
    currentPage?: number
    totalPages?: number
    totalRecords?: number
    totalTasks?: number
    tasksPerPage?: number
  }
  listStatistics?: TaskListStatistics
}

export async function fetchTasks(params: FetchTasksParams = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page || 1))
  // Server caps at 100 per page.
  query.set('limit', String(Math.min(params.limit || 50, 100)))
  if (params.status) query.set('status', params.status)
  if (params.priority) query.set('priority', params.priority)
  if (params.assignedTo) query.set('assignedTo', params.assignedTo)
  if (params.search) query.set('search', params.search)
  if (params.open) query.set('open', 'true')
  if (params.dueToday) query.set('dueToday', 'true')
  if (params.overdue) query.set('overdue', 'true')
  return apiClient.get<FetchTasksResult>(`/tasks?${query.toString()}`)
}

/** @deprecated Prefer fetchTasks({ assignedTo: 'me' }) */
export async function fetchMyTasks(params: { page?: number; limit?: number; status?: string } = {}) {
  return fetchTasks({ ...params, assignedTo: 'me' })
}

export async function fetchTask(taskId: string) {
  return apiClient.get<{ success: boolean; data: TaskRecord }>(`/tasks/${taskId}`)
}

export async function completeTask(taskId: string) {
  return apiClient.patch(`/tasks/${taskId}/status`, { status: 'completed' })
}

export async function updateTaskStatus(taskId: string, status: string) {
  return apiClient.patch(`/tasks/${taskId}/status`, { status })
}

export async function fetchTaskComments(taskId: string) {
  return apiClient.get<{ success: boolean; data: TaskComment[] }>(`/tasks/${taskId}/comments`)
}

export async function createTaskComment(
  taskId: string,
  content: string,
  attachments?: TaskCommentAttachment[],
  parentCommentId?: string | null
) {
  return apiClient.post<{ success: boolean; data: TaskComment }>(`/tasks/${taskId}/comments`, {
    content,
    attachments: attachments?.length ? attachments : undefined,
    parentCommentId: parentCommentId || undefined
  })
}

export async function fetchTaskActivityLogs(taskId: string) {
  return apiClient.get<{ success: boolean; data: TaskActivityLog[] }>(`/tasks/${taskId}/activity-logs`)
}

export async function toggleTaskCommentReaction(taskId: string, commentId: string, emoji: string) {
  return apiClient.post<{ success: boolean; data: TaskComment }>(
    `/tasks/${taskId}/comments/${commentId}/reactions`,
    { emoji }
  )
}

export async function uploadTaskCommentAttachment(taskId: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiClient.postForm<{
    success: boolean
    url: string
    originalname?: string
    filename?: string
    size?: number
    mimetype?: string
    documentId?: string
  }>(`/tasks/${taskId}/comment-attachments`, form)
}

export async function updateTask(taskId: string, data: Record<string, unknown>) {
  return apiClient.put<{ success: boolean; data: TaskRecord }>(`/tasks/${taskId}`, data)
}

export async function toggleSubtask(taskId: string, subtaskId: string, completed: boolean) {
  return apiClient.patch<{ success: boolean; data: TaskRecord }>(
    `/tasks/${taskId}/subtasks/${subtaskId}`,
    { completed }
  )
}

export async function fetchAssignableUsers() {
  return apiClient.get<{ success: boolean; data: TaskAssignee[] }>('/users/list')
}

export async function deleteTask(taskId: string) {
  return apiClient.delete(`/tasks/${taskId}`)
}
