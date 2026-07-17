import apiClient from '@/utils/apiClient'
import { captureAiAbilityUsed, captureAiFeedback } from '@/config/posthogAi'

export type AiFeedbackRating = 'up' | 'down'

export type SubmitAiFeedbackInput = {
  rating: AiFeedbackRating
  abilityKey: string
  provider?: string | null
  model?: string | null
  keyMode?: string | null
  found?: boolean | null
  sourceType?: string | null
  sourceId?: string | null
}

export function trackAiAbilityUsed(input: {
  abilityKey: string
  provider?: string | null
  model?: string | null
  found?: boolean | null
  keyMode?: string | null
  tokens?: number | null
  latencyMs?: number | null
  creditsBalance?: number | null
}) {
  captureAiAbilityUsed(input)
}

export async function submitAiFeedback(input: SubmitAiFeedbackInput): Promise<void> {
  captureAiFeedback({
    abilityKey: input.abilityKey,
    rating: input.rating,
    provider: input.provider,
    model: input.model,
    found: input.found,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  })

  const contextRefs =
    input.sourceType && input.sourceId
      ? [{ sourceType: input.sourceType, sourceId: String(input.sourceId) }]
      : []

  try {
    await apiClient.post('/ai/feedback', {
      rating: input.rating,
      targetAbilityKey: input.abilityKey,
      provider: input.provider || 'unknown',
      model: input.model || 'unknown',
      keyMode: input.keyMode || 'platform',
      contextRefs,
    })
  } catch {
    /* feedback is best-effort */
  }
}
