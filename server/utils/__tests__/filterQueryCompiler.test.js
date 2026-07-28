const test = require('node:test');
const assert = require('node:assert/strict');
const { compileNode, applyFilterQueryToMongoQuery } = require('../filterQueryCompiler');

test('compileNode: is_not negates value match', () => {
  const clause = compileNode(
    { fieldKey: 'status', operator: 'is_not', value: 'closed' },
    'deals'
  );
  assert.deepEqual(clause, { status: { $ne: 'closed' } });
});

test('compileNode: not_contains uses regex negation', () => {
  const clause = compileNode(
    { fieldKey: 'name', operator: 'not_contains', value: 'Acme' },
    'deals'
  );
  assert.equal(clause.name.$not.source, 'Acme');
  assert.equal(clause.name.$not.flags, 'i');
});

test('compileNode: is_not_empty for assigned user', () => {
  const clause = compileNode(
    { fieldKey: 'assignedTo', operator: 'is_not_empty', value: 'assigned' },
    'tasks'
  );
  assert.deepEqual(clause, { assignedTo: { $ne: null, $exists: true } });
});

test('compileNode: nested OR groups compile recursively', () => {
  const ast = {
    logic: 'AND',
    children: [
      { fieldKey: 'status', operator: 'is', value: 'open' },
      {
        logic: 'OR',
        children: [
          { fieldKey: 'priority', operator: 'is', value: 'high' },
          { fieldKey: 'priority', operator: 'is', value: 'urgent' },
        ],
      },
    ],
  };
  const clause = compileNode(ast, 'tasks');
  assert.deepEqual(clause, {
    $and: [
      { status: 'open' },
      {
        $or: [{ priority: 'high' }, { priority: 'urgent' }],
      },
    ],
  });
});

test('compileNode: is unassigned maps to null-or-missing clause', () => {
  const clause = compileNode(
    { fieldKey: 'assignedTo', operator: 'is', value: 'unassigned' },
    'organizations'
  );
  assert.deepEqual(clause, {
    $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
  });
});

test('compileNode: is me resolves to user id', () => {
  const userId = '507f1f77bcf86cd799439011';
  const clause = compileNode(
    { fieldKey: 'assignedTo', operator: 'is', value: 'me' },
    'organizations',
    { userId }
  );
  assert.deepEqual(clause, { assignedTo: userId });
});

test('compileNode: is_any_of resolves me token to user id', () => {
  const userId = '507f1f77bcf86cd799439011';
  const clause = compileNode(
    { fieldKey: 'assignedTo', operator: 'is_any_of', value: ['me', '507f1f77bcf86cd799439012'] },
    'events',
    { userId }
  );
  assert.deepEqual(clause, {
    assignedTo: { $in: [userId, '507f1f77bcf86cd799439012'] },
  });
});

test('compileNode: people name contains searches first_name and last_name', () => {
  const clause = compileNode(
    { fieldKey: 'name', operator: 'contains', value: 'te' },
    'people'
  );
  assert.equal(clause.$or.length, 2);
  assert.equal(clause.$or[0].first_name.source, 'te');
  assert.equal(clause.$or[1].last_name.source, 'te');
});

test('compileNode: people name not_contains negates both name parts', () => {
  const clause = compileNode(
    { fieldKey: 'name', operator: 'not_contains', value: 'te' },
    'people'
  );
  assert.equal(clause.$and.length, 2);
  assert.equal(clause.$and[0].first_name.$not.source, 'te');
  assert.equal(clause.$and[1].last_name.$not.source, 'te');
});

test('applyFilterQueryToMongoQuery: merges into base query $and', () => {
  const ast = {
    logic: 'OR',
    children: [
      { fieldKey: 'status', operator: 'is', value: 'open' },
      { fieldKey: 'status', operator: 'is', value: 'pending' },
    ],
  };
  const result = applyFilterQueryToMongoQuery(
    { organizationId: 'org1' },
    JSON.stringify(ast),
    'deals'
  );
  assert.deepEqual(result, {
    organizationId: 'org1',
    $and: [{ $or: [{ status: 'open' }, { status: 'pending' }] }],
  });
});

test('compileNode: contains supports comma-separated OR terms', () => {
  const clause = compileNode(
    { fieldKey: 'name', operator: 'contains', value: 'Acme, Beta' },
    'organizations'
  );
  assert.equal(clause.$or.length, 2);
  assert.equal(clause.$or[0].name.source, 'Acme');
  assert.equal(clause.$or[1].name.source, 'Beta');
});

test('compileNode: people name contains supports comma-separated OR terms', () => {
  const clause = compileNode(
    { fieldKey: 'name', operator: 'contains', value: 'John, Jane' },
    'people'
  );
  assert.equal(clause.$or.length, 4);
});
