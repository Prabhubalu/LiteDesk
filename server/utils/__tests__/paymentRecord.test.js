const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeInstrumentSnapshot } = require('../../services/paymentRecordService');

test('normalizeInstrumentSnapshot captures immutable fields', () => {
  const snapshot = normalizeInstrumentSnapshot({
    method: 'check',
    referenceNumber: '1001',
    bankName: 'First National',
    maskedAccount: '****5678',
    provider: 'manual'
  });

  assert.deepEqual(snapshot, {
    method: 'check',
    referenceNumber: '1001',
    bankName: 'First National',
    maskedAccount: '****5678',
    provider: 'manual'
  });
});

test('normalizeInstrumentSnapshot defaults invalid method to other', () => {
  const snapshot = normalizeInstrumentSnapshot({ method: 'crypto' });
  assert.equal(snapshot.method, 'other');
  assert.equal(snapshot.provider, 'manual');
});
