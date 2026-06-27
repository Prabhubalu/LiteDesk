'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeSessionVersion,
  validateAuthSession
} = require('../sessionService');

describe('sessionService', () => {
  it('normalizeSessionVersion coerces invalid values to zero', () => {
    assert.equal(normalizeSessionVersion(undefined), 0);
    assert.equal(normalizeSessionVersion(-1), 0);
    assert.equal(normalizeSessionVersion('3'), 3);
  });

  it('validateAuthSession allows legacy tokens without jti or sv', async () => {
    const user = { authSessionVersion: 2 };
    const result = await validateAuthSession(user, { id: 'user-id' });
    assert.equal(result.ok, true);
    assert.equal(result.legacy, true);
  });

  it('validateAuthSession rejects stale session version', async () => {
    const user = { authSessionVersion: 3 };
    const result = await validateAuthSession(user, { sv: 2, jti: 'abc' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'SESSION_REVOKED');
  });
});
