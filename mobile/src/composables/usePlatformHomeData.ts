import { ref } from 'vue'
import {
  createDefaultPlatformHomeLayout,
  normalizePlatformHomeLayout
} from '@/config/platformHomeWidgets'
import {
  createEmptyPlatformHomeSnapshot,
  fetchPlatformHomeLayout,
  fetchPlatformHomeSnapshot
} from '@/api/platformHome'
import type { PlatformHomeAlert, PlatformHomeLayout, PlatformHomeSnapshot } from '@/types/platformHome'
import type { StoredOrganization } from '@/services/sessionStorage'

const LOAD_TIMEOUT_MS = 8_000

function buildSubscriptionAlerts(org: StoredOrganization | null): PlatformHomeAlert[] {
  if (!org?.subscription) return []
  const subscription = org.subscription as Record<string, unknown>
  const status = String(subscription.status || 'trial')
  const alerts: PlatformHomeAlert[] = []

  if (status === 'suspended' || status === 'expired') {
    alerts.push({
      type: 'error',
      title: 'Subscription inactive',
      message: 'Your workspace subscription needs attention. Contact your admin.'
    })
    return alerts
  }

  if (status === 'trial' && subscription.trialEndDate) {
    const trialEnd = new Date(String(subscription.trialEndDate))
    const now = new Date()
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining < 0) {
      alerts.push({
        type: 'warning',
        title: 'Trial ended',
        message: 'Your trial has ended. Upgrade to keep full access.'
      })
    } else if (daysRemaining <= 3) {
      alerts.push({
        type: 'warning',
        title: 'Trial ending soon',
        message:
          daysRemaining === 1
            ? 'Your trial ends tomorrow.'
            : `Your trial ends in ${daysRemaining} days.`
      })
    }
  }

  return alerts
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Request timed out')), ms)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        window.clearTimeout(timer)
        reject(err)
      })
  })
}

export function usePlatformHomeData() {
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const snapshot = ref<PlatformHomeSnapshot>(createEmptyPlatformHomeSnapshot())
  const layout = ref<PlatformHomeLayout>(createDefaultPlatformHomeLayout())
  const alerts = ref<PlatformHomeAlert[]>([])

  async function load(organization: StoredOrganization | null) {
    refreshing.value = true
    error.value = null
    try {
      const [homeSnapshot, homeLayout] = await withTimeout(
        Promise.all([fetchPlatformHomeSnapshot(), fetchPlatformHomeLayout()]),
        LOAD_TIMEOUT_MS
      )
      snapshot.value = homeSnapshot
      layout.value = normalizePlatformHomeLayout(homeLayout)
      alerts.value = buildSubscriptionAlerts(organization)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load home'
      alerts.value = buildSubscriptionAlerts(organization)
    } finally {
      refreshing.value = false
    }
  }

  return {
    refreshing,
    error,
    snapshot,
    layout,
    alerts,
    load
  }
}
