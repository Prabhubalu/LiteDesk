const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { redactText, redactMessages } = require('../piiRedaction');

describe('piiRedaction', () => {
  it('redacts emails and api keys', () => {
    const out = redactText('Contact ada@example.com with sk_test_abcdefghijklmnopqrstuvwxyz');
    assert.match(out, /\[EMAIL\]/);
    assert.match(out, /\[API_KEY\]/);
    assert.doesNotMatch(out, /ada@example\.com/);
  });

  it('can preserve emails for staff work-graph compose', () => {
    const out = redactText('Contact ada@example.com with sk_test_abcdefghijklmnopqrstuvwxyz', {
      preserveEmails: true,
    });
    assert.match(out, /ada@example\.com/);
    assert.match(out, /\[API_KEY\]/);
    assert.doesNotMatch(out, /\[EMAIL\]/);
  });

  it('redacts message content arrays', () => {
    const out = redactMessages([
      { role: 'user', content: 'My card is 4111 1111 1111 1111' },
    ]);
    assert.equal(out[0].role, 'user');
    assert.match(out[0].content, /\[CARD\]/);
  });

  it('exposes a staff-facing PII catalog', () => {
    const { getPiiRedactionCatalog } = require('../piiRedaction');
    const catalog = getPiiRedactionCatalog();
    assert.ok(Array.isArray(catalog.items));
    assert.ok(catalog.items.some((i) => i.id === 'email'));
    assert.ok(catalog.items.some((i) => i.id === 'phone'));
    assert.ok(catalog.items.every((i) => i.label && i.placeholder));
  });

  it('applies custom org rules', () => {
    const customRules = [{
      id: 'emp_id',
      label: 'Employee ID',
      pattern: 'EMP-\\d{4}',
      replacement: '[EMP_ID]',
      matchType: 'regex',
      enabled: true,
    }];
    const out = redactText('Contact EMP-1234 for help', { customRules });
    assert.match(out, /\[EMP_ID\]/);
    assert.doesNotMatch(out, /EMP-1234/);
  });

  it('rejects unsafe custom regex on save', () => {
    const { sanitizeCustomPiiRulesForStorage } = require('../piiRedaction');
    assert.throws(() => sanitizeCustomPiiRulesForStorage([{
      id: 'bad',
      label: 'Bad',
      pattern: '(a+)+',
      matchType: 'regex',
    }]));
  });

  it('redacts India phone numbers by default', () => {
    const samples = [
      '+91 98765 43210',
      '+91-9876543210',
      '9876543210',
      '0091 9876543210',
      '080-12345678',
    ];
    for (const s of samples) {
      const out = redactText(`Call ${s} please`);
      assert.match(out, /\[PHONE\]/, `expected redaction for ${s}, got: ${out}`);
      assert.doesNotMatch(out, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
