const Organization = require('../../models/Organization');
const { AI_KEY_MODES } = require('../../constants/aiProviders');
const { AiConfigurationError } = require('./errors');

function estimateCreditsFromUsage(usage) {
  const totalTokens = Number(usage?.totalTokens || usage?.total_tokens || 0);
  if (totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens / 1000));
}

function assertCreditsAvailable({ keyMode, creditsBalance }) {
  if (keyMode === AI_KEY_MODES.BYOK) return;
  if (Number(creditsBalance || 0) <= 0) {
    const err = new AiConfigurationError(
      'AI credits are exhausted. Add credits in Settings → AI, or switch to Bring Your Own Key.',
      'AI_CREDITS_EXHAUSTED',
    );
    err.statusCode = 402;
    throw err;
  }
}

/**
 * Soft warning when platform-mode balance is at or below 20% of starting balance.
 * Returns null when BYOK or when no soft-warn applies.
 */
function getCreditsSoftWarn({ keyMode, creditsBalance, creditsSoftLimit }) {
  if (keyMode === AI_KEY_MODES.BYOK) return null;
  const balance = Number(creditsBalance || 0);
  const softLimit = Number(creditsSoftLimit || 0);
  if (softLimit <= 0) return null;
  if (balance > softLimit * 0.2) return null;
  return {
    code: 'AI_CREDITS_LOW',
    creditsBalance: balance,
    creditsSoftLimit: softLimit,
  };
}

async function debitCredits({ organizationId, keyMode, usage }) {
  if (keyMode === AI_KEY_MODES.BYOK) return 0;

  const credits = estimateCreditsFromUsage(usage);
  if (credits <= 0) return 0;

  const updated = await Organization.findOneAndUpdate(
    {
      _id: organizationId,
      'aiSettings.credits.balance': { $gte: credits },
    },
    {
      $inc: { 'aiSettings.credits.balance': -credits },
    },
    { new: true }
  ).select('_id aiSettings.credits.balance');

  if (!updated) {
    const err = new AiConfigurationError(
      'AI credits are exhausted. Add credits in Settings → AI, or switch to Bring Your Own Key.',
      'AI_CREDITS_EXHAUSTED',
    );
    err.statusCode = 402;
    throw err;
  }

  return credits;
}

module.exports = {
  assertCreditsAvailable,
  debitCredits,
  estimateCreditsFromUsage,
  getCreditsSoftWarn,
};
