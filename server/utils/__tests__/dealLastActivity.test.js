const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isDealEngagementAction,
  resolveDealLastActivity,
  touchDealLastActivity,
  attachDealLastActivity,
} = require('../dealLastActivity');

test('isDealEngagementAction counts notes, stage, comments, and created', () => {
  assert.equal(isDealEngagementAction('created'), true);
  assert.equal(isDealEngagementAction('changed stage'), true);
  assert.equal(isDealEngagementAction('added a note'), true);
  assert.equal(isDealEngagementAction('edited a note'), true);
  assert.equal(isDealEngagementAction('added a comment'), true);
  assert.equal(isDealEngagementAction('Logged a call'), true);
});

test('isDealEngagementAction excludes field edits and description restore', () => {
  assert.equal(isDealEngagementAction('field_changed'), false);
  assert.equal(isDealEngagementAction('restored description version'), false);
  assert.equal(isDealEngagementAction(''), false);
  assert.equal(isDealEngagementAction(null), false);
});

test('resolveDealLastActivity uses latest engagement log, ignoring field_changed', () => {
  const resolved = resolveDealLastActivity({
    createdAt: '2026-01-01T00:00:00.000Z',
    lastActivityDate: '2026-01-02T00:00:00.000Z',
    activityLogs: [
      { action: 'created', timestamp: '2026-01-01T00:00:00.000Z' },
      { action: 'field_changed', timestamp: '2026-01-05T00:00:00.000Z' },
      { action: 'added a note', timestamp: '2026-01-03T12:00:00.000Z' },
    ],
  });
  assert.equal(resolved.lastActivityDate.toISOString(), '2026-01-03T12:00:00.000Z');
  assert.equal(resolved.lastActivityAction, 'added a note');
});

test('resolveDealLastActivity falls back to stored lastActivityDate when no engagement logs', () => {
  const resolved = resolveDealLastActivity({
    lastActivityDate: '2026-02-01T00:00:00.000Z',
    activityLogs: [{ action: 'field_changed', timestamp: '2026-03-01T00:00:00.000Z' }],
  });
  assert.equal(resolved.lastActivityDate.toISOString(), '2026-02-01T00:00:00.000Z');
  assert.equal(resolved.lastActivityAction, null);
});

test('resolveDealLastActivity falls back to createdAt', () => {
  const resolved = resolveDealLastActivity({
    createdAt: '2026-01-10T00:00:00.000Z',
    activityLogs: [],
  });
  assert.equal(resolved.lastActivityDate.toISOString(), '2026-01-10T00:00:00.000Z');
  assert.equal(resolved.lastActivityAction, 'created');
});

test('resolveDealLastActivity prefers newer stored timestamp over older engagement log', () => {
  const resolved = resolveDealLastActivity({
    lastActivityDate: '2026-01-10T00:00:00.000Z',
    activityLogs: [
      { action: 'added a note', timestamp: '2026-01-05T00:00:00.000Z' },
    ],
  });
  assert.equal(resolved.lastActivityDate.toISOString(), '2026-01-10T00:00:00.000Z');
  assert.equal(resolved.lastActivityAction, 'added a note');
});

test('touchDealLastActivity sets lastActivityDate on the deal', () => {
  const deal = {};
  const at = new Date('2026-04-01T00:00:00.000Z');
  touchDealLastActivity(deal, at);
  assert.equal(deal.lastActivityDate, at);
});

test('attachDealLastActivity attaches resolved fields onto a plain object', () => {
  const attached = attachDealLastActivity({
    createdAt: '2026-01-01T00:00:00.000Z',
    activityLogs: [
      { action: 'changed stage', timestamp: '2026-01-08T00:00:00.000Z' },
    ],
  });
  assert.equal(attached.lastActivityDate.toISOString(), '2026-01-08T00:00:00.000Z');
  assert.equal(attached.lastActivityAction, 'changed stage');
});
