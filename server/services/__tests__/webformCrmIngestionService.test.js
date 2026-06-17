'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  buildCrmPayload,
  ensurePeopleDefaults,
  ensureOrganizationDefaults,
  ensureCaseDefaults,
  ensureDealDefaults,
  resolveRecordIntent
} = require('../webformCrmIngestionService');

describe('webformCrmIngestionService.buildCrmPayload', () => {
  it('maps fieldValues to crmFieldKey bindings', () => {
    const webform = {
      fields: [
        { fieldId: 'f1', crmFieldKey: 'first_name' },
        { fieldId: 'f2', crmFieldKey: 'email' },
        { fieldId: 'f3', crmFieldKey: '' }
      ]
    };
    const payload = buildCrmPayload(webform, {
      f1: 'Ada',
      f2: 'ada@example.com',
      f3: 'ignored'
    });
    assert.deepStrictEqual(payload, {
      first_name: 'Ada',
      email: 'ada@example.com'
    });
  });

  it('skips empty string values', () => {
    const webform = { fields: [{ fieldId: 'f1', crmFieldKey: 'phone' }] };
    const payload = buildCrmPayload(webform, { f1: '   ' });
    assert.deepStrictEqual(payload, {});
  });
});

describe('webformCrmIngestionService defaults', () => {
  it('ensurePeopleDefaults derives first_name from email', () => {
    const result = ensurePeopleDefaults({ email: 'Lead@Example.com' });
    assert.strictEqual(result.first_name, 'Lead');
    assert.strictEqual(result.email, 'lead@example.com');
  });

  it('ensureOrganizationDefaults uses webform name fallback', () => {
    const result = ensureOrganizationDefaults({}, 'Contact Us');
    assert.strictEqual(result.name, 'Contact Us submission');
  });

  it('ensureCaseDefaults sets Customer Portal channel', () => {
    const result = ensureCaseDefaults({}, 'Support');
    assert.strictEqual(result.title, 'Support submission');
    assert.strictEqual(result.channel, 'Customer Portal');
  });

  it('ensureDealDefaults coerces amount and name', () => {
    const result = ensureDealDefaults({ amount: 'bad' }, 'Quote');
    assert.strictEqual(result.name, 'Quote submission');
    assert.strictEqual(result.amount, 0);
  });
});

describe('webformCrmIngestionService.resolveRecordIntent', () => {
  it('create always creates', () => {
    const intent = resolveRecordIntent('create', { _id: 'abc' });
    assert.deepStrictEqual(intent, { intent: 'create', crmAction: 'created' });
  });

  it('update requires existing record', () => {
    assert.throws(
      () => resolveRecordIntent('update', null),
      (err) => err.statusCode === 404
    );
  });

  it('create_or_update updates when match exists', () => {
    const intent = resolveRecordIntent('create_or_update', { _id: 'abc' });
    assert.deepStrictEqual(intent, { intent: 'update', crmAction: 'updated' });
  });

  it('create_or_update creates when no match', () => {
    const intent = resolveRecordIntent('create_or_update', null);
    assert.deepStrictEqual(intent, { intent: 'create', crmAction: 'created' });
  });
});
