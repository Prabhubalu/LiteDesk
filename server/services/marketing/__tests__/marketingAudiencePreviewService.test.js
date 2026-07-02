'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const queryCompiler = require('../marketingAudienceQueryCompiler');
const EmailSuppression = require('../../../models/EmailSuppression');
const Organization = require('../../../models/Organization');
const tenantContext = require('../../../utils/runWithOrganizationTenant');

const orgId = new mongoose.Types.ObjectId();

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

function reloadPreviewService() {
  delete require.cache[require.resolve('../marketingAudiencePreviewService')];
  return require('../marketingAudiencePreviewService');
}

test('buildAudiencePreviewInsights counts missing email and reachable recipients', async (t) => {
  const personWithEmail = {
    _id: new mongoose.Types.ObjectId(),
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    organization: new mongoose.Types.ObjectId()
  };
  const personMissingEmail = {
    _id: new mongoose.Types.ObjectId(),
    first_name: 'No',
    last_name: 'Email',
    email: '',
    organization: null
  };

  patchMethod(
    queryCompiler,
    'resolveAllMatchingPeople',
    async () => [personWithEmail, personMissingEmail],
    t
  );

  patchMethod(
    queryCompiler,
    'resolvePeopleWithEmail',
    async () => [
      {
        ...personWithEmail,
        recipientId: String(personWithEmail._id),
        mergeData: { personId: String(personWithEmail._id) }
      }
    ],
    t
  );

  patchMethod(
    tenantContext,
    'runWithOrganizationTenantContext',
    async (_orgId, fn) => fn(),
    t
  );

  patchMethod(
    EmailSuppression,
    'find',
    () => ({
      select: () => ({
        lean: async () => []
      })
    }),
    t
  );

  patchMethod(
    Organization,
    'find',
    () => ({
      select: () => ({
        lean: async () => [{ _id: personWithEmail.organization, industry: 'Healthcare' }]
      })
    }),
    t
  );

  const previewService = reloadPreviewService();
  const insights = await previewService.buildAudiencePreviewInsights(orgId, { version: 2, children: [] });

  assert.equal(insights.totalMatches, 2);
  assert.equal(insights.missingEmail, 1);
  assert.equal(insights.reachableRecipients, 1);
  assert.equal(insights.breakdown.organizations, 1);
  assert.equal(insights.breakdown.industries[0].value, 'Healthcare');
});
