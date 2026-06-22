'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { buildLinkedRecordsFilter } = require('../liveChatUninstallGuard');

test('buildLinkedRecordsFilter scopes by organization and linked records', () => {
  const orgId = '6a087af980b15fe2b592e891';
  const filter = buildLinkedRecordsFilter(orgId);

  assert.equal(filter.organizationId.toString(), orgId);
  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.length, 2);
});
