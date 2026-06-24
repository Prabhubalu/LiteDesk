'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isEngagementFormType,
  normalizeEngagementPublishStatus,
  isFormStructurallyLocked,
  isEngagementFormExpired,
  getEngagementFormExpiryInstant
} = require('../../utils/engagementFormLifecycle');

test('normalizeEngagementPublishStatus maps Ready to Active for surveys', () => {
  assert.equal(normalizeEngagementPublishStatus('Ready', 'Survey'), 'Active');
  assert.equal(normalizeEngagementPublishStatus('Ready', 'Audit'), 'Ready');
  assert.equal(normalizeEngagementPublishStatus('Draft', 'Survey'), 'Draft');
});

test('isFormStructurallyLocked covers Active and live engagement Ready', () => {
  assert.equal(isFormStructurallyLocked('Survey', 'Active'), true);
  assert.equal(isFormStructurallyLocked('Survey', 'Ready'), true);
  assert.equal(isFormStructurallyLocked('Survey', 'Draft'), false);
  assert.equal(isFormStructurallyLocked('Audit', 'Ready'), false);
  assert.equal(isFormStructurallyLocked('Audit', 'Active'), true);
});

test('isEngagementFormType', () => {
  assert.equal(isEngagementFormType('Feedback'), true);
  assert.equal(isEngagementFormType('Audit'), false);
});

test('isEngagementFormExpired: still valid on expiry day', () => {
  const expiryDate = new Date('2026-06-24T00:00:00.000Z');
  const now = new Date('2026-06-24T23:00:00.000Z');
  assert.equal(isEngagementFormExpired(expiryDate, now), false);
});

test('isEngagementFormExpired: expired after expiry day', () => {
  const expiryDate = new Date('2026-06-24T00:00:00.000Z');
  const now = new Date('2026-06-25T00:00:01.000Z');
  assert.equal(isEngagementFormExpired(expiryDate, now), true);
});

test('getEngagementFormExpiryInstant: day after expiry UTC midnight', () => {
  const end = getEngagementFormExpiryInstant('2026-06-24T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-06-25T00:00:00.000Z');
});

test('normalizeEngagementExpiryDate stores UTC calendar date for date-only input', () => {
  const { normalizeEngagementExpiryDate } = require('../../utils/engagementFormLifecycle');
  assert.equal(
    normalizeEngagementExpiryDate('2026-06-24').toISOString(),
    '2026-06-24T00:00:00.000Z'
  );
  assert.equal(normalizeEngagementExpiryDate(null), null);
});

test('normalizeEngagementExpiryDate preserves datetime instant', () => {
  const { normalizeEngagementExpiryDate } = require('../../utils/engagementFormLifecycle');
  assert.equal(
    normalizeEngagementExpiryDate('2026-06-24T14:30:00.000Z').toISOString(),
    '2026-06-24T14:30:00.000Z'
  );
});

test('isEngagementFormExpired: expires at exact datetime for non-legacy values', () => {
  const expiryDate = new Date('2026-06-24T14:30:00.000Z');
  const before = new Date('2026-06-24T14:29:59.000Z');
  const after = new Date('2026-06-24T14:30:00.000Z');
  assert.equal(isEngagementFormExpired(expiryDate, before), false);
  assert.equal(isEngagementFormExpired(expiryDate, after), true);
});
