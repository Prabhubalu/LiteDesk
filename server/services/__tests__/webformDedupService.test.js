'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  normalizeDedupKeys,
  resolveEffectiveRecordAction
} = require('../webformDedupService');

describe('webformDedupService.normalizeDedupKeys', () => {
  it('uses configured keys when present', () => {
    const keys = normalizeDedupKeys({
      targetModuleKey: 'people',
      dedup: { keys: ['email'] }
    });
    assert.deepStrictEqual(keys, ['email']);
  });

  it('falls back to module defaults', () => {
    const keys = normalizeDedupKeys({ targetModuleKey: 'cases', dedup: {} });
    assert.deepStrictEqual(keys, ['requesterEmail']);
  });
});

describe('webformDedupService.resolveEffectiveRecordAction', () => {
  it('returns base action when dedup disabled', () => {
    const result = resolveEffectiveRecordAction(
      { recordAction: 'create_or_update', dedup: { enabled: false } },
      { record: { _id: 'abc' } }
    );
    assert.deepStrictEqual(result, { shouldReject: false, recordAction: 'create_or_update' });
  });

  it('rejects when dedup action is reject', () => {
    const result = resolveEffectiveRecordAction(
      { recordAction: 'create', dedup: { enabled: true, action: 'reject' } },
      { record: { _id: 'abc' } }
    );
    assert.deepStrictEqual(result, { shouldReject: true, recordAction: null });
  });

  it('forces create when dedup action is create_anyway', () => {
    const result = resolveEffectiveRecordAction(
      { recordAction: 'create_or_update', dedup: { enabled: true, action: 'create_anyway' } },
      { record: { _id: 'abc' } }
    );
    assert.deepStrictEqual(result, { shouldReject: false, recordAction: 'create' });
  });

  it('updates when dedup action is update', () => {
    const result = resolveEffectiveRecordAction(
      { recordAction: 'create', dedup: { enabled: true, action: 'update' } },
      { record: { _id: 'abc' } }
    );
    assert.deepStrictEqual(result, { shouldReject: false, recordAction: 'update' });
  });
});
