'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isRetryableError, MAX_RETRIES, AmdsApiError, chunkArray, CAMPAIGN_BATCH_MAX } = require('../amds-client');
const { AmdsApiError: AmdsApiErrorClass } = require('../amds-errors');

describe('amds-client', () => {
  it('retries up to MAX_RETRIES on 5xx and 429', () => {
    assert.equal(MAX_RETRIES, 3);
    assert.equal(isRetryableError({ response: { status: 503 } }), true);
    assert.equal(isRetryableError({ response: { status: 429 } }), true);
    assert.equal(isRetryableError({ response: { status: 400 } }), false);
    assert.equal(isRetryableError({ code: 'ETIMEDOUT' }), true);
  });

  it('AmdsApiError flags retryable, suppressed, and domain errors', () => {
    const retryErr = new AmdsApiErrorClass(503, { error: 'upstream' });
    assert.equal(retryErr.isRetryable, true);
    assert.equal(retryErr.isSuppressedRecipient, false);

    const suppressed = new AmdsApiErrorClass(422, { error: 'suppressed', suppressed: ['a@b.com'] });
    assert.equal(suppressed.isSuppressedRecipient, true);
    assert.equal(suppressed.isRetryable, false);

    const domain = new AmdsApiErrorClass(403, { error: 'domain', domain: 'example.com' });
    assert.equal(domain.isDomainNotVerified, true);

    const marketing = new AmdsApiErrorClass(403, { error: 'marketing_restricted' });
    assert.equal(marketing.isMarketingRestricted, true);
    assert.match(marketing.userMessage, /reputation/i);

    assert.equal(isRetryableError(retryErr), true);
    assert.equal(isRetryableError(suppressed), false);
  });

  it('re-exports AmdsApiError from amds-client module', () => {
    assert.equal(AmdsApiError, AmdsApiErrorClass);
  });

  it('chunkArray splits batches for campaign sends', () => {
    assert.equal(CAMPAIGN_BATCH_MAX, 500);
    assert.deepEqual(chunkArray([1, 2, 3], 2), [[1, 2], [3]]);
    assert.deepEqual(chunkArray([], 500), []);
  });
});
