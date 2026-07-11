const test = require('node:test');
const assert = require('node:assert/strict');
const {
  filterOrganizationSubmitPayloadByTypes,
  shouldShowOrganizationFieldForTypes,
  stripBlockedOrganizationSubmitFields,
} = require('../organizationTypeFieldVisibility');

test('shouldShowOrganizationFieldForTypes hides customerStatus without Customer type', () => {
  assert.equal(shouldShowOrganizationFieldForTypes('name', [], null), true);
  assert.equal(shouldShowOrganizationFieldForTypes('customerStatus', [], null), false);
  assert.equal(shouldShowOrganizationFieldForTypes('customerStatus', ['Customer'], null), true);
  assert.equal(shouldShowOrganizationFieldForTypes('dealerLevel', ['Customer'], null), false);
  assert.equal(shouldShowOrganizationFieldForTypes('dealerLevel', ['Dealer'], null), true);
});

test('filterOrganizationSubmitPayloadByTypes strips hidden type-scoped fields', () => {
  const filtered = filterOrganizationSubmitPayloadByTypes(
    {
      name: 'Acme',
      types: ['Partner'],
      customerStatus: 'Active',
      partnerStatus: 'Invited',
      dealerLevel: 'Gold',
      createdBy: 'should-strip-via-blocked-helper',
    },
    ['Partner'],
    null
  );
  assert.equal(filtered.name, 'Acme');
  assert.equal(filtered.partnerStatus, 'Invited');
  assert.equal(filtered.customerStatus, undefined);
  assert.equal(filtered.dealerLevel, undefined);
});

test('filterOrganizationSubmitPayloadByTypes honors tenant typeDefs fields override', () => {
  const typeDefs = [{ value: 'Customer', fields: ['customerTier'] }];
  const filtered = filterOrganizationSubmitPayloadByTypes(
    { types: ['Customer'], customerTier: 'Gold', customerStatus: 'Active' },
    ['Customer'],
    typeDefs
  );
  assert.equal(filtered.customerTier, 'Gold');
  assert.equal(filtered.customerStatus, undefined);
});

test('stripBlockedOrganizationSubmitFields removes system and tenant keys', () => {
  const stripped = stripBlockedOrganizationSubmitFields({
    name: 'Acme',
    createdBy: 'user-id',
    subscription: { tier: 'pro' },
    customerStatus: 'Active',
  });
  assert.deepEqual(stripped, { name: 'Acme', customerStatus: 'Active' });
});
