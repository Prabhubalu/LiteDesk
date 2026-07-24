'use strict';

const Organization = require('../../models/Organization');
const { AI_KEY_MODES } = require('../../constants/aiProviders');
const { AiConfigurationError } = require('./errors');
const { normalizeTokenCount } = require('../../constants/aiTokenConstants');

/**
 * Idempotent: convert legacy credit ledger (1 ≈ 1k tokens) to raw tokens.
 * Backfills grantedTotal when missing so consumed = granted - available.
 * @returns {Promise<number>} token balance after ensure
 */
async function ensureTokenLedger(organizationId) {
  if (!organizationId) return 0;
  const org = await Organization.findById(organizationId).select('aiSettings.credits').lean();
  if (!org) return 0;

  const credits = org.aiSettings?.credits || {};
  const unit = credits.ledgerUnit;
  let balance = Math.max(0, Math.floor(Number(credits.balance) || 0));
  const hasGranted = credits.grantedTotal != null && Number.isFinite(Number(credits.grantedTotal));

  if (unit !== 'tokens') {
    const updated = await Organization.findOneAndUpdate(
      {
        _id: organizationId,
        $or: [
          { 'aiSettings.credits.ledgerUnit': { $exists: false } },
          { 'aiSettings.credits.ledgerUnit': null },
          { 'aiSettings.credits.ledgerUnit': 'credits' },
        ],
      },
      {
        $set: {
          'aiSettings.credits.balance': balance * 1000,
          'aiSettings.credits.ledgerUnit': 'tokens',
          'aiSettings.credits.grantedTotal': hasGranted
            ? Math.max(0, Math.floor(Number(credits.grantedTotal) || 0)) * 1000
            : balance * 1000,
        },
      },
      { new: true }
    ).select('aiSettings.credits.balance');

    if (updated) {
      return Math.max(0, Math.floor(Number(updated.aiSettings?.credits?.balance || 0)));
    }
    const refreshed = await Organization.findById(organizationId).select('aiSettings.credits.balance').lean();
    return Math.max(0, Math.floor(Number(refreshed?.aiSettings?.credits?.balance || 0)));
  }

  if (!hasGranted) {
    await Organization.updateOne(
      {
        _id: organizationId,
        $or: [
          { 'aiSettings.credits.grantedTotal': { $exists: false } },
          { 'aiSettings.credits.grantedTotal': null },
        ],
      },
      { $set: { 'aiSettings.credits.grantedTotal': balance } },
    );
  }

  return balance;
}

/**
 * Fresh token pool: available = tokens, consumed = 0. Optionally wipe usage audit.
 */
async function resetOrgAiTokenPool({
  organizationId,
  tokens = null,
  clearAudit = true,
} = {}) {
  const { FREE_STARTER_TOKENS } = require('../../constants/aiTokenConstants');
  const pool = Math.max(0, Math.floor(Number(tokens != null ? tokens : FREE_STARTER_TOKENS) || 0));
  const now = new Date();

  const updated = await Organization.findByIdAndUpdate(
    organizationId,
    {
      $set: {
        'aiSettings.credits.balance': pool,
        'aiSettings.credits.grantedTotal': pool,
        'aiSettings.credits.ledgerUnit': 'tokens',
        'aiSettings.credits.softLimitNotifiedAt': null,
        'aiSettings.credits.starterGrantAt': now,
        'aiSettings.credits.starterGrantTokens': pool,
      },
    },
    { new: true }
  ).select('aiSettings.credits');

  if (!updated) {
    const err = new Error('Organization not found');
    err.code = 'ORGANIZATION_NOT_FOUND';
    throw err;
  }

  let auditDeleted = 0;
  if (clearAudit) {
    const AiAuditLog = require('../../models/AiAuditLog');
    const result = await AiAuditLog.deleteMany({ organizationId });
    auditDeleted = result.deletedCount || 0;
  }

  return {
    tokensAvailable: pool,
    tokensGranted: pool,
    tokensConsumed: 0,
    auditDeleted,
  };
}

/** Bill exact usage tokens (minimum 1 when any usage reported). */
function estimateTokensFromUsage(usage) {
  const totalTokens = Number(usage?.totalTokens || usage?.total_tokens || 0);
  if (!Number.isFinite(totalTokens) || totalTokens <= 0) return 0;
  return Math.max(1, Math.ceil(totalTokens));
}

/** @deprecated Use estimateTokensFromUsage — kept for call-site aliases during rename. */
function estimateCreditsFromUsage(usage) {
  return estimateTokensFromUsage(usage);
}

function assertTokensAvailable({ keyMode, tokensBalance }) {
  if (keyMode === AI_KEY_MODES.BYOK) return;
  if (normalizeTokenCount(tokensBalance) <= 0) {
    const err = new AiConfigurationError(
      'AI tokens are exhausted. Purchase tokens in Settings → Addons → AI Credit Packs, or switch to Bring Your Own Key.',
      'AI_TOKENS_EXHAUSTED',
    );
    err.statusCode = 402;
    throw err;
  }
}

/** @deprecated Prefer assertTokensAvailable({ tokensBalance }) */
function assertCreditsAvailable({ keyMode, creditsBalance, tokensBalance }) {
  assertTokensAvailable({
    keyMode,
    tokensBalance: tokensBalance != null ? tokensBalance : creditsBalance,
  });
}

/**
 * Soft warning when platform-mode balance is at or below 20% of soft limit.
 */
function getTokensSoftWarn({ keyMode, tokensBalance, tokensSoftLimit }) {
  if (keyMode === AI_KEY_MODES.BYOK) return null;
  const balance = normalizeTokenCount(tokensBalance);
  const softLimit = normalizeTokenCount(tokensSoftLimit);
  if (softLimit <= 0) return null;
  if (balance > softLimit * 0.2) return null;
  return {
    code: 'AI_TOKENS_LOW',
    tokensBalance: balance,
    tokensSoftLimit: softLimit,
  };
}

/** @deprecated Prefer getTokensSoftWarn */
function getCreditsSoftWarn({ keyMode, creditsBalance, creditsSoftLimit, tokensBalance, tokensSoftLimit }) {
  return getTokensSoftWarn({
    keyMode,
    tokensBalance: tokensBalance != null ? tokensBalance : creditsBalance,
    tokensSoftLimit: tokensSoftLimit != null ? tokensSoftLimit : creditsSoftLimit,
  });
}

/**
 * Debit token balance for platform-metered usage.
 * @returns {Promise<number>} tokens debited
 */
async function debitTokens({ organizationId, keyMode, usage }) {
  if (keyMode === AI_KEY_MODES.BYOK) return 0;

  await ensureTokenLedger(organizationId);

  const tokens = estimateTokensFromUsage(usage);
  if (tokens <= 0) return 0;

  const updated = await Organization.findOneAndUpdate(
    {
      _id: organizationId,
      'aiSettings.credits.balance': { $gte: tokens },
    },
    {
      $inc: { 'aiSettings.credits.balance': -tokens },
    },
    { new: true }
  ).select('_id aiSettings.credits.balance');

  if (!updated) {
    const err = new AiConfigurationError(
      'AI tokens are exhausted. Purchase tokens in Settings → Addons → AI Credit Packs, or switch to Bring Your Own Key.',
      'AI_TOKENS_EXHAUSTED',
    );
    err.statusCode = 402;
    throw err;
  }

  return tokens;
}

/** @deprecated Prefer debitTokens — returns tokens debited. */
async function debitCredits(params) {
  return debitTokens(params);
}

module.exports = {
  ensureTokenLedger,
  resetOrgAiTokenPool,
  assertTokensAvailable,
  assertCreditsAvailable,
  debitTokens,
  debitCredits,
  estimateTokensFromUsage,
  estimateCreditsFromUsage,
  getTokensSoftWarn,
  getCreditsSoftWarn,
};
