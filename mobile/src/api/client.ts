import { getApiUrl } from '@/config/apiBase'
import { useAuthStore } from '@/stores/auth'

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

type RequestOptions = RequestInit & {
  skipAuthLogout?: boolean
  appKey?: string
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = useAuthStore()
  const headers = new Headers(options.headers || {})

  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (auth.token) {
    headers.set('Authorization', `Bearer ${auth.token}`)
  }

  if (options.appKey) {
    headers.set('X-App-Key', options.appKey)
  } else if (!headers.has('X-App-Key')) {
    headers.set('X-App-Key', auth.preferredAppKey)
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(getApiUrl(path), {
      ...options,
      headers,
      signal: options.signal ?? controller.signal
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, null)
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null)

  if (response.status === 401 && !options.skipAuthLogout) {
    await auth.logout({ silent: true })
  }

  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && 'message' in body && String((body as { message: unknown }).message)) ||
      `Request failed (${response.status})`
    throw new ApiError(message, response.status, body)
  }

  return body as T
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: data === undefined ? undefined : JSON.stringify(data)
    }),
  patch: <T = unknown>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: data === undefined ? undefined : JSON.stringify(data)
    }),
  put: <T = unknown>(path: string, data?: unknown, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: data === undefined ? undefined : JSON.stringify(data)
    }),
  delete: <T = unknown>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  postForm: <T = unknown>(path: string, data: FormData, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body: data })
}
