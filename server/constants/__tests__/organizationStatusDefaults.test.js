const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getDefaultOrganizationStatusFieldOptions,
  mergeOrganizationStatusPicklistsWithDefaults,
} = require('../../constants/organizationStatusDefaults');

test('customerStatus defaults include full lifecycle', () => {
  const options = getDefaultOrganizationStatusFieldOptions('customerStatus');
  assert.deepEqual(
    options.map((o) => o.value),
    ['Prospect', 'Active', 'On Hold', 'At Risk', 'Inactive', 'Churned']
  );
  assert.ok(options.every((o) => o.color && o.enabled === true));
});

test('mergeOrganizationStatusPicklistsWithDefaults fills missing picklists', () => {
  const merged = mergeOrganizationStatusPicklistsWithDefaults({
    customerStatus: [{ value: 'Active', label: 'Active', enabled: true }],
  });
  assert.deepEqual(merged.customerStatus.map((o) => o.value), ['Active']);
  assert.deepEqual(merged.partnerStatus.map((o) => o.value), [
    'Invited',
    'Onboarding',
    'Active',
    'Paused',
    'Inactive',
  ]);
  assert.deepEqual(merged.vendorStatus.map((o) => o.value), [
    'Prospect',
    'Onboarding',
    'Approved',
    'Suspended',
    'Inactive',
    'Rejected',
  ]);
});
