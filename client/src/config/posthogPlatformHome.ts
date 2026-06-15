/**
 * PostHog Platform Home activation events.
 * Dynamic import only — same pattern as posthogOnboarding.ts.
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
    const storageKey = `ph-platform-home:${key}`
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}

export function capturePlatformHomeViewed(extra: Record<string, unknown> = {}) {
  if (!oncePerSession('viewed')) return
  capture('platform_home_viewed', extra)
}

export function capturePlatformHomeSignalClick(
  signal: { id?: string; appKey?: string; severity?: string; text?: string; signalKey?: string },
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_signal_clicked', {
    signal_id: signal.id,
    app_key: signal.appKey,
    severity: signal.severity,
    signal_key: signal.signalKey,
    ...extra
  })
}

export function capturePlatformHomeAppPillClick(
  app: { appKey?: string; name?: string },
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_app_pill_clicked', {
    app_key: app.appKey,
    app_name: app.name,
    ...extra
  })
}

export function capturePlatformHomeIntentSearchClick(extra: Record<string, unknown> = {}) {
  capture('platform_home_intent_search_clicked', extra)
}

export function capturePlatformHomeCreateAction(
  actionId: string,
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_create_action_clicked', {
    action_id: actionId,
    ...extra
  })
}

export function capturePlatformHomeApprovalAction(
  action: 'approve' | 'reject',
  approvalId: string,
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_approval_action', {
    action,
    approval_id: approvalId,
    ...extra
  })
}

export function capturePlatformHomeNextEventClick(
  eventId: string,
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_next_event_clicked', {
    event_id: eventId,
    ...extra
  })
}

export function capturePlatformHomeInboxClick(
  kind: 'mail' | 'notification',
  itemId: string,
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_inbox_clicked', {
    kind,
    item_id: itemId,
    ...extra
  })
}

export function capturePlatformHomeSectionToggled(
  sectionId: string,
  expanded: boolean,
  extra: Record<string, unknown> = {}
) {
  capture('platform_home_section_toggled', {
    section_id: sectionId,
    expanded,
    ...extra
  })
}
