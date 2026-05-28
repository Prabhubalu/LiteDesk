const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  CATALOG_LIFECYCLE_STATES,
  canTransitionCatalogLifecycle,
  inferLifecycleStateFromLegacyStatus,
  isCatalogItemSellable,
  syncLegacyItemStatusFromLifecycle
} = require('../../constants/catalogLifecycle');

test('catalog lifecycle states are defined', () => {
  assert.deepEqual(CATALOG_LIFECYCLE_STATES, ['Draft', 'Active', 'Discontinued', 'Archived']);
});

test('legacy status sync from lifecycle_state', () => {
  assert.equal(syncLegacyItemStatusFromLifecycle('Active'), 'Active');
  assert.equal(syncLegacyItemStatusFromLifecycle('Draft'), 'Inactive');
  assert.equal(syncLegacyItemStatusFromLifecycle('Discontinued'), 'Inactive');
  assert.equal(syncLegacyItemStatusFromLifecycle('Archived'), 'Inactive');
});

test('infer lifecycle from legacy status', () => {
  assert.equal(inferLifecycleStateFromLegacyStatus('Active', null), 'Active');
  assert.equal(inferLifecycleStateFromLegacyStatus('Inactive', null), 'Discontinued');
  assert.equal(inferLifecycleStateFromLegacyStatus('Active', 'Draft'), 'Draft');
});

test('sellability gate', () => {
  assert.equal(isCatalogItemSellable('Active'), true);
  assert.equal(isCatalogItemSellable('Draft'), false);
  assert.equal(isCatalogItemSellable('Discontinued'), false);
});

test('lifecycle transitions', () => {
  assert.equal(canTransitionCatalogLifecycle('Draft', 'Active'), true);
  assert.equal(canTransitionCatalogLifecycle('Active', 'Draft'), false);
  assert.equal(canTransitionCatalogLifecycle('Archived', 'Active'), false);
  assert.equal(canTransitionCatalogLifecycle('Discontinued', 'Active'), true);
});
