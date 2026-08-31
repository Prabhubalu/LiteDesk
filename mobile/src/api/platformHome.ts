import { apiClient } from '@/api/client'
import type { PlatformHomeLayout, PlatformHomeSnapshot } from '@/types/platformHome'

export function createEmptyPlatformHomeSnapshot(): PlatformHomeSnapshot {
  return {
  attention: { items: [], total: 0, summary: { total: 0, overdue: 0, dueToday: 0 } },
  shell: {
    approvalsPending: 0,
    approvalsPreview: [],
    nextEvent: null,
    mail: { all: 0, unread: 0, assignedToMe: 0, preview: [] },
    notifications: { unread: 0, preview: [] },
    documents: { pendingReview: 0, expiringSoon: 0, preview: [] }
  },
  resume: [],
  appPulses: []
  }
}

export async function fetchPlatformHomeSnapshot(): Promise<PlatformHomeSnapshot> {
  const res = await apiClient.get<{ success?: boolean; data?: PlatformHomeSnapshot }>(
    '/platform/home'
  )
  if (res?.success && res.data) {
    const data = res.data
    return {
      greeting: data.greeting || null,
      focus: data.focus || null,
      attention: {
        items: data.attention?.items || [],
        total: data.attention?.total ?? 0,
        summary: data.attention?.summary || { total: 0, overdue: 0, dueToday: 0 }
      },
      shell: {
        approvalsPending: data.shell?.approvalsPending ?? 0,
        approvalsPreview: data.shell?.approvalsPreview || [],
        nextEvent: data.shell?.nextEvent || null,
        mail: {
          all: data.shell?.mail?.all ?? 0,
          unread: data.shell?.mail?.unread ?? 0,
          assignedToMe: data.shell?.mail?.assignedToMe ?? 0,
          preview: data.shell?.mail?.preview || []
        },
        notifications: {
          unread: data.shell?.notifications?.unread ?? 0,
          preview: data.shell?.notifications?.preview || []
        },
        documents: {
          pendingReview: data.shell?.documents?.pendingReview ?? 0,
          expiringSoon: data.shell?.documents?.expiringSoon ?? 0,
          preview: data.shell?.documents?.preview || []
        }
      },
      resume: data.resume || [],
      appPulses: data.appPulses || []
    }
  }
  return createEmptyPlatformHomeSnapshot()
}

export async function fetchPlatformHomeLayout(): Promise<PlatformHomeLayout | null> {
  const res = await apiClient.get<{ success?: boolean; data?: PlatformHomeLayout | null }>(
    '/platform/home/layout'
  )
  if (res?.success && res.data?.items?.length) {
    return res.data
  }
  return null
}
