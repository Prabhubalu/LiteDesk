import type { App } from 'vue'
import type { Router } from 'vue-router'

/**
 * Load Sentry + PostHog only via dynamic `import()` so the main module graph
 * (router, Vue, pinia) is not interleaved with heavy vendor bundles that can
 * trigger "Cannot access before initialization" in production minify.
 */
export async function initClientObservability(app: App, router: Router): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined
  if (dsn) {
    const Sentry = await import('@sentry/vue')
    Sentry.init({
      app,
      dsn,
      environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT as string) || import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration({ router })],
      tracesSampleRate: Math.min(
        1,
        Math.max(0, Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) || 0.1)
      )
    })
  }

  const phKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  if (phKey) {
    const { default: posthog } = await import('posthog-js')
    const host = (import.meta.env.VITE_POSTHOG_HOST as string) || 'https://us.i.posthog.com'
    posthog.init(phKey, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      persistence: 'localStorage+cookie',
      autocapture: false,
    })
    router.afterEach((to) => {
      try {
        posthog.capture('$pageview', { path: to.fullPath, name: to.name as string | undefined })
      } catch {
        /* optional */
      }
    })
    const { initOnboardingRouteTracking } = await import('@/config/posthogOnboarding')
    initOnboardingRouteTracking(router)
  }
}
