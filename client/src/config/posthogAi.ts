/**
 * PostHog AI product events.
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

export type AiFeedbackProps = {
  abilityKey: string
  rating: 'up' | 'down'
  provider?: string | null
  model?: string | null
  found?: boolean | null
  sourceType?: string | null
  sourceId?: string | null
}

export function captureAiFeedback(props: AiFeedbackProps) {
  capture('ai_feedback', {
    ability_key: props.abilityKey,
    rating: props.rating,
    provider: props.provider || undefined,
    model: props.model || undefined,
    found: props.found ?? undefined,
    source_type: props.sourceType || undefined,
    source_id: props.sourceId || undefined,
  })

  if (props.abilityKey === 'draft_reply') {
    capture(props.rating === 'up' ? 'ai_draft_accepted' : 'ai_draft_rejected', {
      provider: props.provider || undefined,
      model: props.model || undefined,
      source_id: props.sourceId || undefined,
    })
  }
}

export function captureAiAbilityUsed(props: {
  abilityKey: string
  provider?: string | null
  model?: string | null
  found?: boolean | null
  keyMode?: string | null
  tokens?: number | null
  latencyMs?: number | null
  creditsBalance?: number | null
}) {
  capture('ai_ability_used', {
    ability_key: props.abilityKey,
    provider: props.provider || undefined,
    model: props.model || undefined,
    found: props.found ?? undefined,
    key_mode: props.keyMode || undefined,
    tokens: props.tokens ?? undefined,
    latency_ms: props.latencyMs ?? undefined,
    credits_balance: props.creditsBalance ?? undefined,
  })
}

export function captureAiProviderError(props: {
  abilityKey: string
  provider?: string | null
  model?: string | null
  code?: string | null
  keyMode?: string | null
}) {
  capture('ai_provider_error', {
    ability_key: props.abilityKey,
    provider: props.provider || undefined,
    model: props.model || undefined,
    code: props.code || undefined,
    key_mode: props.keyMode || undefined,
  })
}

export function captureAiDraftAccepted(props: {
  provider?: string | null
  model?: string | null
  sourceId?: string | null
  via?: 'send' | 'feedback'
}) {
  capture('ai_draft_accepted', {
    provider: props.provider || undefined,
    model: props.model || undefined,
    source_id: props.sourceId || undefined,
    via: props.via || 'send',
  })
}
