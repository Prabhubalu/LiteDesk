const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEAL_STATUS,
  DEAL_STATUS_VALUES,
  normalizeDealStatus,
  isOpenDealStatus,
  isLegacyAbandonedStatus,
} = require('../dealStatus');

test('DEAL_STATUS_VALUES is Open|Won|Lost only', () => {
  assert.deepEqual(DEAL_STATUS_VALUES, ['Open', 'Won', 'Lost']);
});

test('normalizeDealStatus maps legacy values', () => {
  assert.equal(normalizeDealStatus('Active'), DEAL_STATUS.OPEN);
  assert.equal(normalizeDealStatus('Stalled'), DEAL_STATUS.OPEN);
  assert.equal(normalizeDealStatus('Abandoned'), DEAL_STATUS.LOST);
  assert.equal(normalizeDealStatus('closed won'), DEAL_STATUS.WON);
  assert.equal(normalizeDealStatus('Won'), DEAL_STATUS.WON);
  assert.equal(normalizeDealStatus(null), DEAL_STATUS.OPEN);
});

test('isOpenDealStatus', () => {
  assert.equal(isOpenDealStatus('Open'), true);
  assert.equal(isOpenDealStatus('Active'), true);
  assert.equal(isOpenDealStatus('Won'), false);
  assert.equal(isOpenDealStatus('Abandoned'), false);
});

test('isLegacyAbandonedStatus', () => {
  assert.equal(isLegacyAbandonedStatus('Abandoned'), true);
  assert.equal(isLegacyAbandonedStatus('Lost'), false);
});
