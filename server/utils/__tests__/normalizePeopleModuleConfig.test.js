const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizePeopleModuleFields,
  migratePeopleQuickCreateKeys,
  migratePeopleQuickCreateLayoutKeys,
} = require('../normalizePeopleModuleConfig');

test('normalizePeopleModuleFields drops legacy type when sales_type exists', () => {
  const fields = [
    { key: 'first_name', label: 'First' },
    { key: 'sales_type', label: 'Type', isVirtual: true, appKey: 'SALES' },
    { key: 'type', label: 'Old', options: ['Lead'] },
  ];
  const out = normalizePeopleModuleFields(fields);
  assert.equal(out.some((f) => String(f.key).toLowerCase() === 'type'), false);
  assert.equal(out.find((f) => String(f.key).toLowerCase() === 'sales_type')?.label, 'Sales Type');
});

test('normalizePeopleModuleFields renames lone type to sales_type', () => {
  const fields = [{ key: 'type', label: 'Role', required: true }];
  const out = normalizePeopleModuleFields(fields);
  const salesType = out.find((f) => f.key === 'sales_type');
  assert.ok(salesType);
  assert.equal(salesType.label, 'Sales Type');
  assert.equal(salesType.isVirtual, true);
  assert.equal(salesType.appKey, 'SALES');
  assert.equal(salesType.required, true);
  assert.ok(out.some((f) => f.key === 'lead_status'));
  assert.ok(out.some((f) => f.key === 'contact_status'));
});

test('normalizePeopleModuleFields renames helpdesk_role label to Helpdesk Type', () => {
  const fields = [{ key: 'helpdesk_role', label: 'Role', isVirtual: true, appKey: 'HELPDESK' }];
  const out = normalizePeopleModuleFields(fields);
  assert.equal(out.find((f) => f.key === 'helpdesk_role')?.label, 'Helpdesk Type');
});

test('migratePeopleQuickCreateKeys maps type to sales_type and dedupes', () => {
  assert.deepEqual(migratePeopleQuickCreateKeys(['first_name', 'type']), ['first_name', 'sales_type']);
  assert.deepEqual(migratePeopleQuickCreateKeys(['type', 'sales_type']), ['sales_type']);
});

test('migratePeopleQuickCreateLayoutKeys rewrites fieldKey type', () => {
  const layout = {
    version: 1,
    rows: [{ cols: [{ fieldKey: 'type', widget: 'x' }] }],
  };
  const out = migratePeopleQuickCreateLayoutKeys(layout);
  assert.equal(out.rows[0].cols[0].fieldKey, 'sales_type');
  assert.equal(out.rows[0].cols[0].widget, 'x');
});

test('normalizePeopleModuleFields ensures lead_status and contact_status picklists', () => {
  const fields = [{ key: 'first_name', label: 'First' }];
  const out = normalizePeopleModuleFields(fields);
  const lead = out.find((f) => String(f.key).toLowerCase() === 'lead_status');
  const contact = out.find((f) => String(f.key).toLowerCase() === 'contact_status');
  assert.ok(lead);
  assert.ok(contact);
  assert.equal(lead.dataType, 'Picklist');
  assert.equal(contact.dataType, 'Picklist');
  assert.ok(Array.isArray(lead.options) && lead.options.length > 0);
  assert.ok(Array.isArray(contact.options) && contact.options.length > 0);
  assert.equal(lead.options[0].color, '#2563EB');
  assert.equal(contact.options.find((o) => o.value === 'DoNotContact')?.color, '#DC2626');
});

test('normalizePeopleModuleFields upgrades legacy Text lead_status to Picklist', () => {
  const fields = [
    { key: 'lead_status', label: 'Lead Status', dataType: 'Text', options: [] },
  ];
  const out = normalizePeopleModuleFields(fields);
  assert.equal(out.length, 2);
  const lead = out.find((f) => String(f.key).toLowerCase() === 'lead_status');
  assert.equal(lead.dataType, 'Picklist');
  assert.ok(lead.options.length > 0);
});

test('normalizePeopleModuleFields backfills colors on legacy string options', () => {
  const fields = [
    {
      key: 'lead_status',
      dataType: 'Picklist',
      options: ['New', 'Qualified'],
    },
  ];
  const out = normalizePeopleModuleFields(fields);
  const lead = out.find((f) => String(f.key).toLowerCase() === 'lead_status');
  assert.equal(lead.options[0].value, 'New');
  assert.equal(lead.options[0].color, '#2563EB');
  assert.equal(lead.options[1].value, 'Qualified');
  assert.equal(lead.options[1].color, '#16A34A');
});

test('normalizePeopleModuleFields preserves tenant lead_status options and colors', () => {
  const custom = [{ value: 'Hot', label: 'Hot', enabled: true, color: '#F97316' }];
  const fields = [{ key: 'lead_status', dataType: 'Text', options: custom }];
  const out = normalizePeopleModuleFields(fields);
  const lead = out.find((f) => String(f.key).toLowerCase() === 'lead_status');
  assert.deepEqual(lead.options, custom);
});
