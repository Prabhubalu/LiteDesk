'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mapPersonToMergeScope,
  extractCampaignMergeExpressions,
  buildPeopleSelectFields
} = require('../campaignMergeScopeService');
const {
  evaluateHubspotConditionalsForRecipient
} = require('../marketingConditionalContentService');
const { applyPreferenceMergeTags } = require('../marketingSubscriptionService');

test('mapPersonToMergeScope exposes schema and camelCase people fields', () => {
  const scope = mapPersonToMergeScope(
    { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    { name: 'Tenant Co' },
    { name: 'CRM Co' }
  );

  assert.equal(scope.People.first_name, 'Jane');
  assert.equal(scope.People.firstName, 'Jane');
  assert.equal(scope.People.fullName, 'Jane Doe');
  assert.equal(scope.Organization.name, 'CRM Co');
});

test('extractCampaignMergeExpressions collects subject and body tags', () => {
  const expressions = extractCampaignMergeExpressions(
    'Hello {{People.first_name}}',
    '<p>{{Organization.name}}</p>{{unsubscribe_url}}'
  );

  assert.ok(expressions.includes('People.first_name'));
  assert.ok(expressions.includes('Organization.name'));
  assert.ok(expressions.includes('unsubscribe_url'));
});

test('buildPeopleSelectFields adds requested people schema keys', () => {
  const fields = buildPeopleSelectFields(['People.first_name', 'People.title']);
  assert.ok(fields.has('first_name'));
  assert.ok(fields.has('title'));
});

test('merge tags resolve for hydrated production scope', () => {
  const scope = mapPersonToMergeScope(
    { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    { name: 'Tenant Co' },
    { name: 'CRM Co' }
  );

  const html = applyPreferenceMergeTags(
    '<p>Hi {{People.first_name}} from {{Organization.name}}</p>',
    {
      ...scope,
      unsubscribe_url: 'https://example.com/u',
      preferences_url: 'https://example.com/p'
    }
  );

  assert.match(html, /Hi Jane from CRM Co/);
});

test('evaluateHubspotConditionalsForRecipient keeps matching branch', () => {
  const scope = mapPersonToMergeScope(
    { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' },
    { name: 'Tenant Co' },
    null
  );

  const html = evaluateHubspotConditionalsForRecipient(
    '{% if People.first_name %}<p>Hi {{People.first_name}}</p>{% else %}<p>Hello</p>{% endif %}',
    scope
  );

  assert.match(html, /Hi \{\{People\.first_name\}\}/);
  assert.doesNotMatch(html, /Hello/);
});

test('evaluateHubspotConditionalsForRecipient uses else branch when false', () => {
  const html = evaluateHubspotConditionalsForRecipient(
    '{% if People.first_name %}<p>Hi</p>{% else %}<p>Hello friend</p>{% endif %}',
    { People: { first_name: '' } }
  );

  assert.match(html, /Hello friend/);
});
