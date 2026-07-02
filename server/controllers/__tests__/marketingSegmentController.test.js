'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../utils/runWithOrganizationTenant');
const segmentQueryService = require('../../services/marketing/marketingSegmentQueryService');
const astValidator = require('../../services/marketing/marketingAudienceAstValidator');
const previewService = require('../../services/marketing/marketingAudiencePreviewService');

const MarketingSegment = require('../../models/MarketingSegment');

function loadController() {
  const controllerPath = require.resolve('../marketingSegmentController');
  delete require.cache[controllerPath];
  return require('../marketingSegmentController');
}

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const segmentId = new mongoose.Types.ObjectId();

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

function baseReq(overrides = {}) {
  return {
    user: { _id: userId, organizationId: orgId },
    params: { id: String(segmentId) },
    query: {},
    body: {},
    ...overrides
  };
}

function createNext() {
  return (err) => {
    if (err) throw err;
  };
}

test('buildSegmentPeopleQuery compiles email contains filter', () => {
  const query = segmentQueryService.buildSegmentPeopleQuery(orgId, {
    logic: 'AND',
    children: [{ fieldKey: 'email', operator: 'contains', value: 'example.com' }]
  });

  assert.equal(String(query.organizationId), String(orgId));
  assert.equal(query.deletedAt, null);
  assert.ok(query.$and);
});

test('previewSegmentFilter returns count from service', async (t) => {
  patchMethod(astValidator, 'validateFilterQuery', async () => ({ ok: true, version: 1 }), t);
  patchMethod(previewService, 'buildAudiencePreviewInsights', async () => ({
    totalMatches: 12,
    reachableRecipients: 11,
    missingEmail: 0,
    suppressed: 1,
    duplicateEmails: 0,
    sample: [{ _id: new mongoose.Types.ObjectId(), email: 'a@example.com' }],
    refreshedAt: new Date().toISOString()
  }), t);

  const controller = loadController();
  const res = createRes();
  await controller.previewSegmentFilter(
    baseReq({
      body: {
        filterQuery: {
          logic: 'AND',
          children: [{ fieldKey: 'email', operator: 'contains', value: 'example.com' }]
        }
      }
    }),
    res,
    createNext()
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.total, 12);
  assert.equal(res.body.data.reachableRecipients, 11);
  assert.equal(res.body.data.sample.length, 1);
});

test('createSegment requires filterQuery', async (t) => {
  const controller = loadController();
  const res = createRes();
  await controller.createSegment(
    baseReq({ body: { name: 'Newsletter contacts' } }),
    res,
    createNext()
  );
  assert.equal(res.statusCode, 400);
});

test('listSegments returns paginated segments scoped to organization', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(MarketingSegment, 'find', (match) => {
    assert.equal(String(match.organizationId), String(orgId));
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => [{ _id: segmentId, name: 'Active leads', memberCount: 4 }]
            })
          })
        })
      })
    };
  }, t);
  patchMethod(MarketingSegment, 'countDocuments', async () => 1, t);

  const controller = loadController();
  const res = createRes();
  await controller.listSegments(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.length, 1);
});
