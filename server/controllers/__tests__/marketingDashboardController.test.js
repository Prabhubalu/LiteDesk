'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const tenantContext = require('../../utils/runWithOrganizationTenant');
const dashboardService = require('../../services/marketing/marketingDashboardService');

function loadController() {
  const controllerPath = require.resolve('../marketingDashboardController');
  delete require.cache[controllerPath];
  return require('../marketingDashboardController');
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

test('getMarketingDashboard returns dashboard payload', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(dashboardService, 'buildMarketingDashboardPayload', async () => ({
    kpis: { campaigns: { total: 3 } },
    recentCampaigns: [],
    recentActivity: [],
    topCampaigns: [],
    linkPerformance: []
  }), t);

  const res = createRes();
  const controller = loadController();
  await controller.getMarketingDashboard(
    { user: { organizationId: orgId }, query: { days: '30' } },
    res,
    (err) => {
      if (err) throw err;
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.kpis.campaigns.total, 3);
});

test('compareMarketingCampaigns validates ids query', async (t) => {
  patchMethod(tenantContext, 'runWithOrganizationTenantContext', async (_org, fn) => fn(), t);
  patchMethod(dashboardService, 'compareCampaigns', async () => {
    throw new Error('At least one campaign id is required');
  }, t);

  const res = createRes();
  const controller = loadController();
  await controller.compareMarketingCampaigns(
    { user: { organizationId: orgId }, query: {} },
    res,
    (err) => {
      if (err) throw err;
    }
  );

  assert.equal(res.statusCode, 400);
});
