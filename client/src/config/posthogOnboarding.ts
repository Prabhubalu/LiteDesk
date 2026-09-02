/**
 * PostHog onboarding + activation events.
 * Dynamic import only — same pattern as posthogUser.ts.
 */
import type { Router } from 'vue-router'

type PostHog = typeof import('posthog-js').default

export type OnboardingAnalyticsContext = {
  persona?: string | null
  origin?: string | null
  organizationId?: string | null
}

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
    const storageKey = `ph-onboarding:${key}`
    if (sessionStorage.getItem(storageKey)) return false
    sessionStorage.setItem(storageKey, '1')
    return true
  } catch {
    return true
  }
}

export function onboardingEventProps(ctx: OnboardingAnalyticsContext = {}) {
  return {
    persona: ctx.persona || undefined,
    origin: ctx.origin || undefined,
    organization_id: ctx.organizationId ? String(ctx.organizationId) : undefined,
  }
}

export function captureOnboardingStarted(ctx: OnboardingAnalyticsContext) {
  if (!oncePerSession('started')) return
  capture('onboarding_started', onboardingEventProps(ctx))
}

export function captureOnboardingStepCompleted(
  stepKey: string,
  ctx: OnboardingAnalyticsContext,
  extra: Record<string, unknown> = {}
) {
  capture('onboarding_step_completed', {
    ...onboardingEventProps(ctx),
    step_key: stepKey,
    ...extra,
  })
}

export function captureOnboardingCompleted(ctx: OnboardingAnalyticsContext) {
  if (!oncePerSession('completed')) return
  capture('onboarding_completed', onboardingEventProps(ctx))
}

export function captureInviteSent(extra: Record<string, unknown> = {}) {
  capture('invite_sent', extra)
}

export function captureInviteAccepted(extra: Record<string, unknown> = {}) {
  capture('invite_accepted', extra)
}

export function captureFirstContactCreated(ctx: OnboardingAnalyticsContext, extra: Record<string, unknown> = {}) {
  capture('first_contact_created', { ...onboardingEventProps(ctx), ...extra })
}

export function captureSampleDataAccepted(ctx: OnboardingAnalyticsContext, extra: Record<string, unknown> = {}) {
  capture('sample_data_accepted', { ...onboardingEventProps(ctx), ...extra })
}

export function captureDemoRequestConverted(extra: Record<string, unknown> = {}) {
  capture('demo_request_converted', {
    template_key: extra.templateKey || extra.template_key,
    industry: extra.industry,
    primary_app_key: extra.primaryAppKey || extra.primary_app_key,
    ...extra,
  })
}

export function captureCoachmarkSeen(coachmarkKey: string, ctx: OnboardingAnalyticsContext = {}) {
  capture('coachmark_seen', {
    ...onboardingEventProps(ctx),
    coachmark_key: coachmarkKey,
  })
}

export function captureFirstTimeEmptyStateSeen(
  moduleKey: string,
  appKey: string,
  ctx: OnboardingAnalyticsContext = {}
) {
  const dedupeKey = `first-empty:${appKey}:${moduleKey}`
  if (!oncePerSession(dedupeKey)) return
  capture('first_time_empty_state_seen', {
    ...onboardingEventProps(ctx),
    module_key: moduleKey,
    app_key: appKey,
  })
}

const STEP_KEY_BY_ACTION: Record<string, string | undefined> = {
  set_goal: 'founder_goal',
  save_workspace: 'founder_workspace',
  set_primary_app: 'founder_first_app',
  create_first_contact: 'founder_first_record',
  complete_step: undefined,
  skip_step: undefined,
}

export function trackOnboardingStateTransition(
  prev: {
    startedAt?: string | null
    completedAt?: string | null
    persona?: string | null
    origin?: string | null
  },
  next: {
    startedAt?: string | null
    completedAt?: string | null
    persona?: string | null
    origin?: string | null
  },
  organizationId?: string | null,
  patchPayload: Record<string, unknown> = {}
) {
  const ctx: OnboardingAnalyticsContext = {
    persona: next.persona,
    origin: next.origin,
    organizationId,
  }

  if (next.startedAt && !prev.startedAt) {
    captureOnboardingStarted(ctx)
  }

  if (next.completedAt && !prev.completedAt) {
    captureOnboardingCompleted(ctx)
  }

  const action = String(patchPayload.action || '')
  if (action === 'complete_step' || action === 'skip_step') {
    const stepKey = String(patchPayload.stepKey || '')
    if (stepKey && action === 'complete_step') {
      captureOnboardingStepCompleted(stepKey, ctx)
    }
    return
  }

  const mappedStep = STEP_KEY_BY_ACTION[action]
  if (mappedStep) {
    captureOnboardingStepCompleted(mappedStep, ctx)
  }

  if (action === 'create_first_contact') {
    captureFirstContactCreated(ctx, { source: 'onboarding_wizard' })
  }

  if (action === 'accept_sample_data') {
    captureSampleDataAccepted(ctx)
  }

  if (action === 'mark_coachmark') {
    captureCoachmarkSeen(String(patchPayload.key || ''), ctx)
  }
}

let settingsVisitRecorded = false

export function initOnboardingRouteTracking(router: Router) {
  router.afterEach((to) => {
    if (settingsVisitRecorded) return
    if (!to.path.startsWith('/settings')) return
    settingsVisitRecorded = true
    void import('@/composables/useOnboarding').then(({ useOnboarding }) => {
      const { recordSettingsVisit } = useOnboarding()
      void recordSettingsVisit()
    }).catch(() => {})
  })
}
