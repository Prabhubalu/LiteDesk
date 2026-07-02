'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODULE_PARENT_FOREIGN_KEYS,
  inferForeignKeyOnChild,
  inferForwardForeignKeyField,
  inferForeignKeyFromChildToParent
} = require('../marketingAudienceForeignKeys');

test('MODULE_PARENT_FOREIGN_KEYS covers all CRM document modules with contact lookups', () => {
  for (const moduleKey of ['deals', 'cases', 'quotes', 'invoices', 'sales_orders']) {
    assert.equal(inferForeignKeyOnChild(moduleKey, 'people'), 'contactId');
  }
  assert.equal(inferForeignKeyOnChild('deals', 'organizations'), 'accountId');
  for (const moduleKey of ['cases', 'quotes', 'invoices', 'sales_orders']) {
    assert.equal(inferForeignKeyOnChild(moduleKey, 'organizations'), 'organizationRefId');
  }
});

test('inferForeignKeyOnChild resolves deal and people organization links', () => {
  assert.equal(inferForeignKeyOnChild('deals', 'people'), 'contactId');
  assert.equal(inferForeignKeyOnChild('deals', 'organizations'), 'accountId');
  assert.equal(inferForeignKeyOnChild('people', 'organizations'), 'organization');
});

test('inferForwardForeignKeyField prefers edge.localField then module map', () => {
  assert.equal(
    inferForwardForeignKeyField({ fromModuleKey: 'people', toModuleKey: 'organizations' }),
    'organization'
  );
  assert.equal(
    inferForwardForeignKeyField({
      fromModuleKey: 'cases',
      toModuleKey: 'people',
      localField: 'customContactId'
    }),
    'customContactId'
  );
});

test('inferForeignKeyFromChildToParent uses reverseLocalField when present', () => {
  assert.equal(
    inferForeignKeyFromChildToParent('quotes', 'people', {
      reverseSourceModuleKey: 'quotes',
      reverseLocalField: 'billingContactId'
    }),
    'billingContactId'
  );
});

test('MODULE_PARENT_FOREIGN_KEYS includes quote deal and case links', () => {
  assert.equal(MODULE_PARENT_FOREIGN_KEYS['quotes:deals'], 'dealId');
  assert.equal(MODULE_PARENT_FOREIGN_KEYS['quotes:cases'], 'caseId');
});
