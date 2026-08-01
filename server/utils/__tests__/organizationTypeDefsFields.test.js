const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeOrganizationTypeDefsForSave } = require('../tenantMetadata');
const {
  typeDefsToOrganizationTypePicklistOptions,
  statusPicklistPolicyToOptions,
  moduleFieldOptionsToStatusPicklistRows,
} = require('../tenantMetadata');

test('sanitizeOrganizationTypeDefsForSave: fields validated against allowedFieldKeys', () => {
  const allowed = new Set(['customerStatus', 'customerTier']);
  const r = sanitizeOrganizationTypeDefsForSave(
    [{ value: 'Customer', label: 'Customer', enabled: true, fields: ['customerStatus'] }],
    { allowedFieldKeys: allowed }
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.typeDefs[0].fields, ['customerStatus']);
});

test('sanitizeOrganizationTypeDefsForSave: rejects unknown field when allowlist non-empty', () => {
  const allowed = new Set(['customerStatus']);
  const r = sanitizeOrganizationTypeDefsForSave(
    [{ value: 'Customer', label: 'Customer', enabled: true, fields: ['not_a_field'] }],
    { allowedFieldKeys: allowed }
  );
  assert.equal(r.ok, false);
  assert.match(String(r.message), /Invalid field/);
});

test('sanitizeOrganizationTypeDefsForSave: empty fields array persists explicit empty list', () => {
  const allowed = new Set(['customerStatus']);
  const r = sanitizeOrganizationTypeDefsForSave(
    [{ value: 'Customer', label: 'Customer', enabled: true, fields: [] }],
    { allowedFieldKeys: allowed }
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.typeDefs[0].fields, []);
});

test('sanitizeOrganizationTypeDefsForSave: omits fields property when not provided', () => {
  const allowed = new Set(['customerStatus']);
  const r = sanitizeOrganizationTypeDefsForSave(
    [{ value: 'Customer', label: 'Customer', enabled: true }],
    { allowedFieldKeys: allowed }
  );
  assert.equal(r.ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(r.typeDefs[0], 'fields'), false);
});

test('normalizeOrganizationTypesFromConfig strips retired organization types', () => {
  const { normalizeOrganizationTypesFromConfig } = require('../tenantMetadata');
  const out = normalizeOrganizationTypesFromConfig([
    { value: 'Customer', enabled: true },
    { value: 'Dealer', enabled: true },
    { value: 'Distributor', enabled: true },
    { value: 'Vendor', enabled: true },
  ]);
  assert.deepEqual(out.map((t) => t.value), ['Customer', 'Vendor']);
});

test('sanitizeOrganizationTypeDefsForSave skips retired organization types', () => {
  const r = sanitizeOrganizationTypeDefsForSave([
    { value: 'Customer', label: 'Customer', enabled: true },
    { value: 'Dealer', label: 'Dealer', enabled: true },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.typeDefs.map((t) => t.value), ['Customer']);
});

test('typeDefsToOrganizationTypePicklistOptions: only enabled types', () => {
  const options = typeDefsToOrganizationTypePicklistOptions([
    { value: 'Customer', enabled: true },
    { value: 'Partner', enabled: false },
    { value: 'Vendor', enabled: true },
  ]);
  assert.deepEqual(options.map((o) => o.value), ['Customer', 'Vendor']);
});

test('statusPicklistPolicyToOptions: only enabled statuses', () => {
  const options = statusPicklistPolicyToOptions(
    [
      { value: 'Active', label: 'Active', enabled: true },
      { value: 'Churned', label: 'Churned', enabled: false },
    ],
    [{ value: 'Active', color: '#10B981' }]
  );
  assert.equal(options.length, 1);
  assert.equal(options[0].value, 'Active');
  assert.equal(options[0].color, '#10B981');
});

test('statusPicklistPolicyToOptions: null when no tenant policy rows', () => {
  assert.equal(statusPicklistPolicyToOptions(null, [{ value: 'Active' }]), null);
});

test('moduleFieldOptionsToStatusPicklistRows: maps Field Config options for statusTypes SoT', () => {
  const rows = moduleFieldOptionsToStatusPicklistRows([
    { value: 'Active', label: 'Active', color: '#16A34A' },
    { value: 'On Hold', label: 'On Hold', color: '#D97706' },
    'Legacy',
  ]);
  assert.deepEqual(rows, [
    { value: 'Active', label: 'Active', enabled: true, color: '#16A34A' },
    { value: 'On Hold', label: 'On Hold', enabled: true, color: '#D97706' },
    { value: 'Legacy', label: 'Legacy', enabled: true },
  ]);
});

test('ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP covers Field Config role picklists', () => {
  const {
    ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP,
  } = require('../../constants/organizationParticipation');
  assert.equal(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP.sales_type, 'SALES');
  assert.equal(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP.helpdesk_role, 'HELPDESK');
  assert.equal(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP.inventory_role, 'INVENTORY');
  assert.equal(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP.marketing_role, 'MARKETING');
  assert.equal(ORGANIZATION_PARTICIPATION_VIRTUAL_FIELD_TO_APP.portal_role, 'PORTAL');
});
