const test = require('node:test');
const assert = require('node:assert/strict');
const domainEvents = require('../../constants/domainEvents');
const { buildDefaultMap } = require('../notificationPreferenceBootstrap');

test('PORTAL defaults enable in-app for portal case notification events', () => {
  const defaults = buildDefaultMap('PORTAL');

  assert.equal(defaults[domainEvents.CASE_PORTAL_AGENT_REPLY].inApp, true);
  assert.equal(defaults[domainEvents.CASE_PORTAL_AGENT_REPLY].email, true);
  assert.equal(defaults[domainEvents.CASE_PORTAL_AGENT_REPLY].push.enabled, true);

  assert.equal(defaults[domainEvents.CASE_PORTAL_STATUS_UPDATE].inApp, true);
  assert.equal(defaults[domainEvents.CASE_PORTAL_STATUS_UPDATE].email, true);

  assert.equal(defaults[domainEvents.PORTAL_ACCOUNT_CREATED].inApp, true);
  assert.equal(defaults[domainEvents.EVIDENCE_UPLOADED].inApp, true);
});

test('PORTAL defaults keep unrelated events disabled', () => {
  const defaults = buildDefaultMap('PORTAL');
  assert.equal(defaults[domainEvents.CASE_CREATED].inApp, false);
  assert.equal(defaults[domainEvents.TASK_ASSIGNED].inApp, false);
});
