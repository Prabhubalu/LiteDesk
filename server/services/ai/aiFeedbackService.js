const { writeAiAuditLog } = require('./aiAuditLogService');
const { AiConfigurationError } = require('./errors');

const ALLOWED_RATINGS = new Set(['up', 'down']);
const ALLOWED_ABILITIES = new Set([
  'ask',
  'summarize',
  'draft_reply',
  'embed',
  'echo',
]);

async function recordAiFeedback({
  organizationId,
  userId,
  rating,
  targetAbilityKey,
  provider = 'unknown',
  model = 'unknown',
  keyMode = 'platform',
  contextRefs = [],
  comment = null,
}) {
  const normalizedRating = String(rating || '').trim().toLowerCase();
  const ability = String(targetAbilityKey || '').trim().toLowerCase();

  if (!ALLOWED_RATINGS.has(normalizedRating)) {
    throw new AiConfigurationError('rating must be up or down', 'AI_FEEDBACK_RATING_INVALID');
  }
  if (!ALLOWED_ABILITIES.has(ability)) {
    throw new AiConfigurationError('targetAbilityKey is invalid', 'AI_FEEDBACK_ABILITY_INVALID');
  }

  await writeAiAuditLog({
    organizationId,
    userId,
    abilityKey: 'feedback',
    provider: provider || 'unknown',
    model: model || 'unknown',
    keyMode: keyMode === 'byok' ? 'byok' : 'platform',
    status: 'success',
    contextRefs,
    metadata: {
      rating: normalizedRating,
      targetAbilityKey: ability,
      comment: comment ? String(comment).slice(0, 500) : null,
    },
  });

  return {
    rating: normalizedRating,
    targetAbilityKey: ability,
  };
}

module.exports = {
  recordAiFeedback,
  ALLOWED_RATINGS,
  ALLOWED_ABILITIES,
};
