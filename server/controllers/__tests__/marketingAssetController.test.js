'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../utils/runWithOrganizationTenant');
const assetService = require('../../services/marketing/marketingAssetService');

function loadController() {
  const controllerPath = require.resolve('../marketingAssetController');
  delete require.cache[controllerPath];
  return require('../marketingAssetController');
}

const orgId = new mongoose.Types.ObjectId();

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

test('listAssets returns paginated payload', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(assetService, 'listAssets', async () => ({
    items: [{ _id: '1', filename: 'logo.png' }],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.listAssets({ user: { organizationId: orgId }, query: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data[0].filename, 'logo.png');
});

test('uploadAsset validates missing file', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(assetService, 'uploadAsset', async () => {
    const err = new assetService.MarketingAssetError('File is required', 400);
    throw err;
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.uploadAsset(
    { user: { organizationId: orgId, _id: new mongoose.Types.ObjectId() }, body: {} },
    res
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});
