const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyImportMappingTemplate,
  buildColumnRulesFromFieldMapping,
  detectAliasCollisions,
  detectCrossRuleAliasCollisions,
  validateImportFieldMapping,
} = require('../importMappingTemplateUtils');

const fields = [
  { value: 'first_name', label: 'First Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
];

test('applyImportMappingTemplate matches aliases and current field labels after rename', () => {
  const { fieldMapping, report } = applyImportMappingTemplate(
    ['Given Name'],
    [{ targetFieldKey: 'first_name', sourceAliases: ['First Name', 'fname'] }],
    [{ value: 'first_name', label: 'Given Name' }, { value: 'email', label: 'Email' }]
  );
  assert.equal(fieldMapping['Given Name'], 'first_name');
  assert.equal(report.matched.length, 1);
});

test('applyImportMappingTemplate reports deleted target fields as invalid', () => {
  const { fieldMapping, report } = applyImportMappingTemplate(
    ['Legacy Column'],
    [{ targetFieldKey: 'removed_field', sourceAliases: ['Legacy Column'] }],
    fields
  );
  assert.equal(fieldMapping['Legacy Column'], '');
  assert.equal(report.invalidTargetFields.length, 1);
  assert.equal(report.invalidTargetFields[0].targetFieldKey, 'removed_field');
});

test('detectCrossRuleAliasCollisions flags same alias on different targets', () => {
  const collisions = detectCrossRuleAliasCollisions([
    { targetFieldKey: 'email', sourceAliases: ['E-mail'] },
    { targetFieldKey: 'phone', sourceAliases: ['Email'] },
  ]);
  assert.equal(collisions.length, 1);
  assert.ok(collisions[0].targetFieldKeys.includes('email'));
  assert.ok(collisions[0].targetFieldKeys.includes('phone'));
});

test('applyImportMappingTemplate reports ambiguous headers and alias collisions', () => {
  const rules = [
    { targetFieldKey: 'email', sourceAliases: ['Contact Email'] },
    { targetFieldKey: 'phone', sourceAliases: ['Contact Email'] },
  ];
  const collisions = detectAliasCollisions(rules, new Set(fields.map((f) => f.value)));
  assert.equal(collisions.length, 1);

  const { report, fieldMapping } = applyImportMappingTemplate(
    ['Contact Email'],
    rules,
    fields
  );
  assert.equal(report.ambiguousHeaders.length, 1);
  assert.equal(fieldMapping['Contact Email'], 'email');
});

test('buildColumnRulesFromFieldMapping skips deleted targets', () => {
  const allowed = new Set(['email']);
  const rules = buildColumnRulesFromFieldMapping(
    { Email: 'email', Gone: 'removed_field' },
    allowed
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].targetFieldKey, 'email');
});

test('validateImportFieldMapping rejects deleted and duplicate targets', () => {
  const allowed = new Set(['email', 'phone']);
  const invalid = validateImportFieldMapping(
    { A: 'removed_field', B: 'email', C: 'email' },
    allowed
  );
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((e) => e.includes('removed_field')));
  assert.ok(invalid.errors.some((e) => e.includes('Duplicate mapping')));
});
