'use strict';

/**
 * Credit governance — reuse the existing credit service so v2 shares the same
 * balance, BYOK exemption, and exhaustion semantics as legacy AI.
 */

const {
  assertCreditsAvailable,
  debitCredits,
  estimateCreditsFromUsage,
  getCreditsSoftWarn,
} = require('../../ai/aiCreditService');

/**
 * Assert credits then return a debit function bound to the request config.
 * @param {{ keyMode: string, creditsBalance: number }} config
 */
function guard(config = {}) {
  assertCreditsAvailable({
    keyMode: config.keyMode,
    creditsBalance: config.creditsBalance,
  });
  return {
    softWarn: getCreditsSoftWarn({
      keyMode: config.keyMode,
      creditsBalance: config.creditsBalance,
      creditsSoftLimit: config.creditsSoftLimit,
    }),
  };
}

module.exports = {
  guard,
  assertCreditsAvailable,
  debitCredits,
  estimateCreditsFromUsage,
  getCreditsSoftWarn,
};
