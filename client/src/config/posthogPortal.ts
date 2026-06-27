/**
 * PostHog portal framework events.
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

export function capturePortalLogin(extra: Record<string, unknown> = {}) {
  capture('portal_login', extra)
}

export function capturePortalSelected(roleId: string, extra: Record<string, unknown> = {}) {
  capture('portal_selected', { role_id: roleId, ...extra })
}

export function capturePortalSwitched(roleId: string, extra: Record<string, unknown> = {}) {
  capture('portal_switched', { role_id: roleId, ...extra })
}

export function capturePortalEnabled(peopleId: string, extra: Record<string, unknown> = {}) {
  capture('portal_enabled', { people_id: peopleId, ...extra })
}

export function capturePortalDisabled(peopleId: string, extra: Record<string, unknown> = {}) {
  capture('portal_disabled', { people_id: peopleId, ...extra })
}

export function capturePortalSessionsTerminated(peopleId: string, extra: Record<string, unknown> = {}) {
  capture('portal_sessions_terminated', { people_id: peopleId, ...extra })
}

export function capturePortalDashboardViewed(extra: Record<string, unknown> = {}) {
  capture('portal_dashboard_viewed', extra)
}

export function capturePortalDashboardStatClicked(statId: string, extra: Record<string, unknown> = {}) {
  capture('portal_dashboard_stat_clicked', { stat_id: statId, ...extra })
}

export function capturePortalDashboardQuickLinkClicked(linkId: string, extra: Record<string, unknown> = {}) {
  capture('portal_dashboard_quick_link_clicked', { link_id: linkId, ...extra })
}

export function capturePortalDashboardCaseOpened(extra: Record<string, unknown> = {}) {
  capture('portal_dashboard_case_opened', extra)
}

export function capturePortalDashboardEmptyStateCtaClicked(
  ctaId: string,
  extra: Record<string, unknown> = {}
) {
  capture('portal_dashboard_empty_state_cta_clicked', { cta_id: ctaId, ...extra })
}

export function capturePortalDashboardChecklistDismissed(extra: Record<string, unknown> = {}) {
  capture('portal_dashboard_checklist_dismissed', extra)
}

export function capturePortalDashboardChecklistStepClicked(
  stepId: string,
  extra: Record<string, unknown> = {}
) {
  capture('portal_dashboard_checklist_step_clicked', { step_id: stepId, ...extra })
}

export function capturePortalDashboardSuggestedArticleClicked(
  articleId: string,
  extra: Record<string, unknown> = {}
) {
  capture('portal_dashboard_suggested_article_clicked', { article_id: articleId, ...extra })
}

export function capturePortalCaseCreateStarted(extra: Record<string, unknown> = {}) {
  capture('portal_case_create_started', extra)
}

export function capturePortalCaseCreated(extra: Record<string, unknown> = {}) {
  capture('portal_case_created', extra)
}

export function capturePortalCaseKbArticleClicked(
  articleId: string,
  extra: Record<string, unknown> = {}
) {
  capture('portal_case_kb_article_clicked', { article_id: articleId, ...extra })
}

export function capturePortalCaseReplySent(extra: Record<string, unknown> = {}) {
  capture('portal_case_reply_sent', extra)
}

export function capturePortalCaseCsatSubmitted(extra: Record<string, unknown> = {}) {
  capture('portal_case_csat_submitted', extra)
}
