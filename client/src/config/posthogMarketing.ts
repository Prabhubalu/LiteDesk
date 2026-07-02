/**
 * PostHog events for Marketing app (activation / usage).
 */
type PostHog = typeof import('posthog-js').default

let posthogModulePromise: Promise<PostHog> | null = null

function loadPosthog(): Promise<PostHog> | null {
  if (!import.meta.env.VITE_POSTHOG_KEY) return null
  if (!posthogModulePromise) {
    posthogModulePromise = import('posthog-js').then((m) => m.default)
  }
  return posthogModulePromise
}

function capture(event: string, properties: Record<string, unknown> = {}) {
  const loader = loadPosthog()
  if (!loader) return
  void loader.then((posthog) => {
    try {
      posthog.capture(event, properties)
    } catch {
      /* optional */
    }
  })
}

function oncePerSession(key: string): boolean {
  try {
    const storageKey = `ph-marketing:${key}`
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}

export function captureMarketingAppOpened(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('app-opened')) return
  capture('marketing_app_opened', extra)
}

export function captureMarketingDashboardViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('dashboard-viewed')) return
  capture('marketing_dashboard_viewed', extra)
}

export function captureMarketingModuleVisited(
  moduleKey: string,
  extra: Record<string, unknown> = {}
) {
  const sessionKey = `module-${moduleKey}`
  if (!oncePerSession(sessionKey)) return
  capture('marketing_module_visited', { module_key: moduleKey, ...extra })
}

export function captureMarketingAudienceImported(extra: Record<string, unknown> = {}) {
  capture('marketing_audience_imported', extra)
}

export function captureMarketingCampaignSendStarted(extra: Record<string, unknown> = {}) {
  capture('marketing_campaign_send_started', extra)
}

export function captureMarketingCampaignScheduled(extra: Record<string, unknown> = {}) {
  capture('marketing_campaign_scheduled', extra)
}

export function captureMarketingCampaignTestSent(extra: Record<string, unknown> = {}) {
  capture('marketing_campaign_test_sent', extra)
}

export function captureMarketingAssetUploaded(extra: Record<string, unknown> = {}) {
  capture('marketing_asset_uploaded', extra)
}

export function captureMarketingAssetDeleted(extra: Record<string, unknown> = {}) {
  capture('marketing_asset_deleted', extra)
}

export function captureMarketingCampaignApprovalSubmitted(extra: Record<string, unknown> = {}) {
  capture('marketing_campaign_approval_submitted', extra)
}
