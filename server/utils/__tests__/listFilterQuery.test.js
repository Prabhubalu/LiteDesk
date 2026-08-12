const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyFlatAssignedToQueryParam,
  applyListFilterQueryParam,
} = require('../listFilterQuery');

const userId = '507f1f77bcf86cd799439011';

test('applyFlatAssignedToQueryParam: me resolves to context userId', () => {
  const query = applyFlatAssignedToQueryParam(
    { organizationId: 'org1' },
    { assignedTo: 'me' },
    'events',
    { userId }
  );
  assert.deepEqual(query, { organizationId: 'org1', assignedTo: userId });
});

test('applyFlatAssignedToQueryParam: rewrites stamped me on query', () => {
  const query = applyFlatAssignedToQueryParam(
    { assignedTo: 'me' },
    {},
    'deals',
    { userId }
  );
  assert.deepEqual(query, { assignedTo: userId });
});

test('applyFlatAssignedToQueryParam: unassigned uses null-or-missing clause', () => {
  const query = applyFlatAssignedToQueryParam(
    { organizationId: 'org1' },
    { assignedTo: 'unassigned' },
    'invoices',
    { userId }
  );
  assert.equal(query.organizationId, 'org1');
  assert.equal(query.assignedTo, undefined);
  assert.deepEqual(query.$and, [
    { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] },
  ]);
});

test('applyFlatAssignedToQueryParam: ignored for modules without assignedTo', () => {
  const query = applyFlatAssignedToQueryParam(
    { organizationId: 'org1' },
    { assignedTo: 'me' },
    'items',
    { userId }
  );
  assert.deepEqual(query, { organizationId: 'org1' });
});

test('applyListFilterQueryParam: applies assignedTo even without filterQuery', () => {
  const query = applyListFilterQueryParam(
    { organizationId: 'org1' },
    { assignedTo: 'me' },
    'quotes',
    { userId }
  );
  assert.deepEqual(query, { organizationId: 'org1', assignedTo: userId });
});

test('applyListFilterQueryParam: applies flat createdBy me', () => {
  const query = applyListFilterQueryParam(
    { organizationId: 'org1' },
    { createdBy: 'me' },
    'tasks',
    { userId }
  );
  assert.deepEqual(query, { organizationId: 'org1', createdBy: userId });
});

test('applyListFilterQueryParam: applies flat createdBy unassigned', () => {
  const query = applyListFilterQueryParam(
    { organizationId: 'org1' },
    { createdBy: 'unassigned' },
    'tasks',
    { userId }
  );
  assert.equal(query.organizationId, 'org1');
  assert.equal(query.createdBy, undefined);
  assert.deepEqual(query.$and, [
    { $or: [{ createdBy: null }, { createdBy: { $exists: false } }] },
  ]);
});

test('applyListFilterQueryParam: createdBy via filterQuery AST', () => {
  const filterQuery = JSON.stringify({
    logic: 'AND',
    children: [{ fieldKey: 'createdBy', operator: 'is', value: userId }],
  });
  const query = applyListFilterQueryParam(
    { organizationId: 'org1' },
    { filterQuery },
    'tasks',
    { userId }
  );
  assert.deepEqual(query, {
    organizationId: 'org1',
    $and: [{ createdBy: userId }],
  });
});
