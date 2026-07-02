'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateCampaignContent,
  extractMergeExpressions,
  detectConditionalBlocks,
  isAllowedMergePath
} = require('../marketingCampaignContentValidationService');

test('validateCampaignContent passes complete campaign', () => {
  const result = validateCampaignContent({
    fromEmail: 'news@example.com',
    subject: 'Hello {{People.firstName}}',
    bodyHtml: '<p>Welcome {{People.firstName}}</p>'
  });

  assert.equal(result.ready, true);
  assert.equal(result.unresolvedMergeTags.length, 0);
});

test('validateCampaignContent flags missing fields and unknown merge tags', () => {
  const result = validateCampaignContent({
    fromEmail: '',
    subject: '',
    bodyHtml: '<p>Hi {{Unknown.field}}</p><a href="#">Click</a>{% if contact.city %}City{% endif %}'
  });

  assert.equal(result.ready, false);
  assert.ok(result.unresolvedMergeTags.includes('Unknown.field'));
  assert.equal(result.conditionalBlockCount, 1);
  const mergeCheck = result.checks.find((check) => check.key === 'mergeTags');
  assert.equal(mergeCheck.status, 'warning');
});

test('extractMergeExpressions ignores block helpers', () => {
  const expressions = extractMergeExpressions('{{#if People.city}}{{People.city}}{{/if}}');
  assert.deepEqual(expressions, ['People.city']);
});

test('detectConditionalBlocks finds hubspot if blocks', () => {
  const result = detectConditionalBlocks('<div>{% if contact.city == "NY" %}NY{% endif %}</div>');
  assert.equal(result.count, 1);
  assert.match(result.blocks[0].expression, /contact\.city/);
});

test('isAllowedMergePath accepts people fields and system tokens', () => {
  assert.equal(isAllowedMergePath('People.firstName'), true);
  assert.equal(isAllowedMergePath('unsubscribe_url'), true);
  assert.equal(isAllowedMergePath('Unknown.custom'), false);
});
