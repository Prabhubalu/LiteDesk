/**
 * PostHog release notes events.
 * Dynamic import only — same pattern as posthogPlatformHome.ts.
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

export function captureReleaseViewed(
  releaseId: string,
  extra: Record<string, unknown> = {}
) {
  capture('release_viewed', { release_id: releaseId, ...extra })
}

export function captureReleaseDismissed(
  releaseIds: string[],
  extra: Record<string, unknown> = {}
) {
  capture('release_dismissed', { release_ids: releaseIds, ...extra })
}

export function captureReleaseOpened(extra: Record<string, unknown> = {}) {
  capture('release_opened', extra)
}

export function captureReleaseSnoozed(extra: Record<string, unknown> = {}) {
  capture('release_snoozed', extra)
}

export function captureReleaseItemClicked(
  releaseId: string,
  itemId: string,
  extra: Record<string, unknown> = {}
) {
  capture('release_item_clicked', {
    release_id: releaseId,
    item_id: itemId,
    ...extra
  })
}
