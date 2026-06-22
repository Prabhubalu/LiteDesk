'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COLUMN_KEYS,
  normalizeSessionColumnKeys,
  resolveEffectiveColumnKeys,
  listFieldsForViewer,
} = require('../liveChatSessionFieldRegistry');

test('DEFAULT_COLUMN_KEYS contains 14 default fields', () => {
  assert.equal(DEFAULT_COLUMN_KEYS.length, 14);
});

test('listFieldsForViewer hides advanced fields unless enabled', () => {
  const basic = listFieldsForViewer({ advancedEnabled: false, isAdmin: true });
  assert.ok(!basic.some((field) => field.key === 'transferCount'));
  const advanced = listFieldsForViewer({ advancedEnabled: true, isAdmin: true });
  assert.ok(advanced.some((field) => field.key === 'transferCount'));
});

test('listFieldsForViewer hides admin-only fields for agents', () => {
  const agent = listFieldsForViewer({ advancedEnabled: true, isAdmin: false });
  assert.ok(!agent.some((field) => field.key === 'consentGiven'));
  const admin = listFieldsForViewer({ advancedEnabled: true, isAdmin: true });
  assert.ok(admin.some((field) => field.key === 'consentGiven'));
});

test('normalizeSessionColumnKeys always keeps locked columns', () => {
  const keys = normalizeSessionColumnKeys(['channel'], {
    allowedKeys: new Set(['sessionKey', 'visitor', 'channel']),
  });
  assert.deepEqual(keys.slice(0, 2), ['visitor', 'sessionKey']);
  assert.ok(keys.includes('channel'));
});

test('resolveEffectiveColumnKeys uses tenant defaults when provided', () => {
  const keys = resolveEffectiveColumnKeys({
    tenantDefaultColumns: ['sessionKey', 'visitor', 'summary', 'csatScore'],
    advancedEnabled: false,
    isAdmin: false,
  });
  assert.deepEqual(keys, ['visitor', 'sessionKey', 'summary', 'csatScore']);
});
