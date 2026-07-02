'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCreditPacks, findCreditPack, DEFAULT_EMAIL_CREDIT_PACKS } = require('../../constants/emailCreditPackConstants');
const { normalizeAddonKey, isValidAddonKey, ADDON_KEYS } = require('../../constants/addonKeys');

describe('emailCreditPackConstants', () => {
  it('normalizes credit pack rows', () => {
    const packs = normalizeCreditPacks([
      { packKey: 'pack_test', name: 'Test', credits: 1000, priceCents: 500, currency: 'usd' }
    ]);
    assert.equal(packs.length, 1);
    assert.equal(packs[0].packKey, 'pack_test');
    assert.equal(packs[0].currency, 'USD');
  });

  it('falls back to default packs', () => {
    const packs = normalizeCreditPacks([]);
    assert.equal(packs.length, DEFAULT_EMAIL_CREDIT_PACKS.length);
  });

  it('finds pack by key', () => {
    const packs = normalizeCreditPacks(DEFAULT_EMAIL_CREDIT_PACKS);
    const pack = findCreditPack(packs, 'pack_5k');
    assert.ok(pack);
    assert.equal(pack.credits, 5000);
  });
});

describe('addonKeys email_credits', () => {
  it('registers email_credits addon key', () => {
    assert.equal(normalizeAddonKey('EMAIL_CREDITS'), ADDON_KEYS.EMAIL_CREDITS);
    assert.equal(isValidAddonKey(ADDON_KEYS.EMAIL_CREDITS), true);
  });
});
