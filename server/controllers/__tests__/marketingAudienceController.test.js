'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../utils/runWithOrganizationTenant');
const audienceService = require('../../services/marketing/marketingAudienceService');

const MarketingAudience = require('../../models/MarketingAudience');

function loadController() {
  const controllerPath = require.resolve('../marketingAudienceController');
  delete require.cache[controllerPath];
  return require('../marketingAudienceController');
}

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const audienceId = new mongoose.Types.ObjectId();

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
    },
    setHeader() {
      return this;
    },
    send(payload) {
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
    params: { id: String(audienceId) },
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

test('listAudiences returns paginated audiences scoped to organization', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(MarketingAudience, 'find', (match) => {
    assert.equal(String(match.organizationId), String(orgId));
    return {
      sort: () => ({
        skip: () => ({
          limit: () => ({
            select: () => ({
              lean: async () => [{ _id: audienceId, name: 'Newsletter', memberCount: 2 }]
            })
          })
        })
      })
    };
  }, t);
  patchMethod(MarketingAudience, 'countDocuments', async (match) => {
    assert.equal(String(match.organizationId), String(orgId));
    return 1;
  }, t);

  const controller = loadController();
  const res = createRes();
  await controller.listAudiences(baseReq(), res, createNext());

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.pagination.total, 1);
});

test('createAudience requires a name', async (t) => {
  const controller = loadController();
  const res = createRes();
  await controller.createAudience(baseReq({ body: {} }), res, createNext());
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /name is required/i);
});

test('parseAudienceCsv detects email column and skips invalid rows', () => {
  const parsed = audienceService.parseAudienceCsv(
    'email,name\nvalid@example.com,Jane\nbad-row\nother@test.com,'
  );
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].email, 'valid@example.com');
  assert.equal(parsed.rows[1].email, 'other@test.com');
});

test('paginateMembers filters by search query', () => {
  const members = [
    { email: 'a@example.com', name: 'Alice' },
    { email: 'b@example.com', name: 'Bob' }
  ];
  const result = audienceService.paginateMembers(members, { search: 'bob' });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].email, 'b@example.com');
});
