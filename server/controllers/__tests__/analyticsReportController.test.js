'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const AnalyticsReport = require('../../models/AnalyticsReport');
const AnalyticsSchedule = require('../../models/AnalyticsSchedule');
const accessService = require('../../services/analytics/analyticsReportAccessService');

function loadController() {
  const controllerPath = require.resolve('../analyticsReportController');
  delete require.cache[controllerPath];
  return require('../analyticsReportController');
}

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
  };
}

function patchMethod(target, key, replacement, t) {
  const original = target[key];
  target[key] = replacement;
  t.after(() => {
    target[key] = original;
  });
}

const orgId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const reportId = new mongoose.Types.ObjectId();

test('listReports applies scheduled filter via active schedule report ids', async (t) => {
  const scheduledIds = [reportId];
  patchMethod(AnalyticsSchedule, 'distinct', async () => scheduledIds, t);
  patchMethod(accessService, 'buildReportListVisibilityFilter', async () => ({ organizationId: orgId }), t);

  const captured = { query: null };
  patchMethod(
    AnalyticsReport,
    'find',
    (query) => {
      captured.query = query;
      return {
        select: () => ({
          sort: () => ({
            skip: () => ({
              limit: () => ({
                populate: () => ({
                  populate: () => ({
                    lean: async () => [],
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    },
    t,
  );
  patchMethod(AnalyticsReport, 'countDocuments', async () => 0, t);

  const res = createRes();
  const controller = loadController();
  await controller.listReports(
    {
      user: { _id: userId, organizationId: orgId },
      query: { scheduled: 'true' },
    },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.deepEqual(captured.query.$and[1]._id.$in, scheduledIds);
});

test('duplicateReport returns 403 when clone access is denied', async (t) => {
  patchMethod(
    AnalyticsReport,
    'findOne',
    () => ({
      lean: async () => ({
        _id: reportId,
        organizationId: orgId,
        name: 'Pipeline',
        apiName: 'pipeline',
      }),
    }),
    t,
  );
  patchMethod(
    accessService,
    'assertReportCloneAccess',
    async () => {
      const err = new Error('You do not have permission to clone this report');
      err.statusCode = 403;
      throw err;
    },
    t,
  );

  const res = createRes();
  const controller = loadController();
  await controller.duplicateReport(
    {
      params: { id: String(reportId) },
      user: { _id: userId, organizationId: orgId },
    },
    res,
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
});
