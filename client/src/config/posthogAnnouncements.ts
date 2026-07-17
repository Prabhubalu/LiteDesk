/**
 * PostHog announcements events.
 * Dynamic import only — same pattern as posthogReleaseNotes.ts.
 * @see docs/ANNOUNCEMENTS_ALERTS_ADDON_ROADMAP.md § analytics
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

export function captureAnnouncementPublished(
  announcementId: string,
  extra: Record<string, unknown> = {},
) {
  capture('announcement_published', {
    announcement_id: announcementId,
    ...extra,
  })
}

export function captureAnnouncementViewed(
  announcementId: string,
  extra: Record<string, unknown> = {},
) {
  capture('announcement_viewed', {
    announcement_id: announcementId,
    ...extra,
  })
}

export function captureAnnouncementCtaClicked(
  announcementId: string,
  ctaId: string,
  extra: Record<string, unknown> = {},
) {
  capture('announcement_cta_clicked', {
    announcement_id: announcementId,
    cta_id: ctaId,
    ...extra,
  })
}
