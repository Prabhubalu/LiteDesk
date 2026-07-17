'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AI_KEY_MODES } = require('../../../constants/aiProviders');
const {
  assertCreditsAvailable,
  debitCredits,
  estimateCreditsFromUsage,
  getCreditsSoftWarn,
} = require('../aiCreditService');
const { AiConfigurationError } = require('../errors');

describe('aiCreditService', () => {
  it('estimateCreditsFromUsage floors to 1 credit per 1k tokens', () => {
    assert.equal(estimateCreditsFromUsage({ totalTokens: 0 }), 0);
    assert.equal(estimateCreditsFromUsage({ totalTokens: 1 }), 1);
    assert.equal(estimateCreditsFromUsage({ totalTokens: 1000 }), 1);
    assert.equal(estimateCreditsFromUsage({ totalTokens: 1001 }), 2);
  });

  it('BYOK skips credit assertion even at zero balance', () => {
    assert.doesNotThrow(() =>
      assertCreditsAvailable({ keyMode: AI_KEY_MODES.BYOK, creditsBalance: 0 })
    );
  });

  it('platform mode hard-blocks at zero credits', () => {
    assert.throws(
      () => assertCreditsAvailable({ keyMode: AI_KEY_MODES.PLATFORM, creditsBalance: 0 }),
      (err) => err instanceof AiConfigurationError && err.code === 'AI_CREDITS_EXHAUSTED'
    );
  });

  it('BYOK debitCredits returns 0 without touching org balance', async () => {
    const debited = await debitCredits({
      organizationId: 'org-1',
      keyMode: AI_KEY_MODES.BYOK,
      usage: { totalTokens: 5000 },
    });
    assert.equal(debited, 0);
  });

  it('getCreditsSoftWarn fires at or below 20% of soft limit', () => {
    assert.equal(
      getCreditsSoftWarn({
        keyMode: AI_KEY_MODES.PLATFORM,
        creditsBalance: 21,
        creditsSoftLimit: 100,
      }),
      null
    );
    const warn = getCreditsSoftWarn({
      keyMode: AI_KEY_MODES.PLATFORM,
      creditsBalance: 20,
      creditsSoftLimit: 100,
    });
    assert.equal(warn.code, 'AI_CREDITS_LOW');
    assert.equal(
      getCreditsSoftWarn({ keyMode: AI_KEY_MODES.BYOK, creditsBalance: 0, creditsSoftLimit: 100 }),
      null
    );
  });
});
