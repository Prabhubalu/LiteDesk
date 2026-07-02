/**
 * HTTP integration tests for /api/marketing/campaigns (Express stack, JWT, MongoDB).
 *
 * Gating:
 *   MARKETING_HTTP_INTEGRATION=1
 *   JWT_SECRET
 *   MONGODB_URI | MONGO_URI | MONGO_URI_LOCAL
 *
 * Run: MARKETING_HTTP_INTEGRATION=1 node --test --test-force-exit tests/marketingCampaign.http.integration.test.js
 */

const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
const { test, before, after } = require('node:test');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function resolveMongoUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL || '';
}

const GATE =
  process.env.MARKETING_HTTP_INTEGRATION === '1' &&
  Boolean(resolveMongoUri()) &&
  Boolean(process.env.JWT_SECRET);

function integrationSkipExplanation() {
  const parts = [];
  if (process.env.MARKETING_HTTP_INTEGRATION !== '1') {
    parts.push('MARKETING_HTTP_INTEGRATION is not "1"');
  }
  if (!resolveMongoUri()) parts.push('set MONGODB_URI, MONGO_URI, or MONGO_URI_LOCAL');
  if (!process.env.JWT_SECRET) parts.push('set JWT_SECRET');
  return parts.length ? parts.join(' · ') : 'unknown gate failure';
}

if (!GATE) {
  test(`marketing campaign HTTP integration skipped — ${integrationSkipExplanation()}`, () => {
    assert.ok(true);
  });
} else {
  process.env.DISABLE_SECURITY = 'false';

  const express = require('express');
  const jwt = require('jsonwebtoken');
  const mongoose = require('mongoose');

  const marketingCampaignRoutes = require('../routes/marketingCampaignRoutes');
  const Campaign = require('../models/Campaign');
  const Organization = require('../models/Organization');
  const OrganizationSubscription = require('../models/OrganizationSubscription');
  const User = require('../models/User');

  const mongoUri = resolveMongoUri();
  const marketingAppAccess = [
    { appKey: 'SALES', status: 'ACTIVE', roleKey: 'ADMIN' },
    { appKey: 'MARKETING', status: 'ACTIVE', roleKey: 'ADMIN' }
  ];

  let server;
  let port;
  let orgId;
  let ownerToken;
  let createdOrgDoc;
  let createdSubscriptionDoc;
  let createdOwnerDoc;
  const createdCampaignIds = [];

  function requestJson(opts) {
    return new Promise((resolve, reject) => {
      const bodyStr = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path: opts.path,
          method: opts.method || 'GET',
          headers: {
            ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
            ...(bodyStr
              ? {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(bodyStr)
                }
              : {})
          }
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let body;
            if (raw) {
              try {
                body = JSON.parse(raw);
              } catch {
                body = { _parseError: true, raw };
              }
            } else body = undefined;
            resolve({ status: res.statusCode, body, raw });
          });
        }
      );
      req.on('error', reject);
      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }

  before(async () => {
    process.env.TEST_SILENCE_ORG_LOGS = '1';
    await mongoose.connect(mongoUri);

    const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const slug = `marketing-http-int-${suffix}`;

    const placeholderAssignedTo = new mongoose.Types.ObjectId();

    createdOrgDoc = await Organization.create({
      name: `Marketing HTTP Int (${suffix})`,
      slug,
      isTenant: true,
      isActive: true,
      timezone: 'UTC',
      assignedTo: placeholderAssignedTo,
      enabledApps: [
        { appKey: 'SALES', status: 'ACTIVE' },
        { appKey: 'MARKETING', status: 'ACTIVE' }
      ]
    });
    orgId = createdOrgDoc._id;

    createdOwnerDoc = await User.create({
      organizationId: orgId,
      username: `marketing-owner-${suffix}`,
      email: `marketing-owner-${suffix}@marketing-http-integration.test`,
      password: 'integration-placeholder',
      role: 'owner',
      isOwner: true,
      userType: 'INTERNAL',
      appAccess: marketingAppAccess
    });

    await Organization.updateOne({ _id: orgId }, { assignedTo: createdOwnerDoc._id });

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);
    createdSubscriptionDoc = await OrganizationSubscription.create({
      organizationId: orgId,
      apps: [
        {
          appKey: 'SALES',
          planKey: 'BASIC',
          status: 'TRIAL',
          trialEndsAt,
          seatLimit: 10
        },
        {
          appKey: 'MARKETING',
          planKey: 'BASIC',
          status: 'TRIAL',
          trialEndsAt,
          seatLimit: 10
        }
      ]
    });

    ownerToken = jwt.sign(
      { id: createdOwnerDoc._id.toString(), organizationId: orgId.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const app = express();
    app.use(express.json());
    app.use('/api/marketing/campaigns', marketingCampaignRoutes);

    await new Promise((resolve, reject) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
      server.once('error', reject);
    });
  });

  after(async () => {
    try {
      if (createdCampaignIds.length) {
        await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
      }
      if (createdSubscriptionDoc?._id) {
        await OrganizationSubscription.deleteOne({ _id: createdSubscriptionDoc._id });
      }
      if (createdOwnerDoc?._id) await User.deleteOne({ _id: createdOwnerDoc._id });
      if (createdOrgDoc?._id) await Organization.deleteOne({ _id: createdOrgDoc._id });
    } catch (e) {
      console.error('[marketing.http.integration] cleanup error:', e.message);
    }

    await new Promise((resolve) => {
      if (server) server.close(() => resolve());
      else resolve();
    });
    await mongoose.disconnect();
  });

  test('POST / without token returns 401', async () => {
    const res = await requestJson({
      method: 'POST',
      path: '/api/marketing/campaigns',
      body: { name: 'Unauthorized' }
    });
    assert.equal(res.status, 401);
  });

  test('GET / without token returns 401', async () => {
    const res = await requestJson({
      method: 'GET',
      path: '/api/marketing/campaigns'
    });
    assert.equal(res.status, 401);
  });

  test('owner CRUD flow: create, list, get, update, duplicate, delete draft copy', async () => {
    const createRes = await requestJson({
      method: 'POST',
      path: '/api/marketing/campaigns',
      token: ownerToken,
      body: {
        name: 'HTTP integration campaign',
        subject: 'Hello',
        fromEmail: 'news@localhost.test',
        bodyHtml: '<p>Integration</p>'
      }
    });
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body?.success, true);
    const campaignId = createRes.body?.data?._id;
    assert.ok(campaignId);
    createdCampaignIds.push(campaignId);

    const listRes = await requestJson({
      method: 'GET',
      path: '/api/marketing/campaigns?search=HTTP+integration',
      token: ownerToken
    });
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body?.data?.some((row) => String(row._id) === String(campaignId)));

    const getRes = await requestJson({
      method: 'GET',
      path: `/api/marketing/campaigns/${campaignId}`,
      token: ownerToken
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.body?.data?.name, 'HTTP integration campaign');

    const updateRes = await requestJson({
      method: 'PUT',
      path: `/api/marketing/campaigns/${campaignId}`,
      token: ownerToken,
      body: { subject: 'Updated subject' }
    });
    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body?.data?.subject, 'Updated subject');

    const recipientsRes = await requestJson({
      method: 'GET',
      path: `/api/marketing/campaigns/${campaignId}/recipients`,
      token: ownerToken
    });
    assert.equal(recipientsRes.status, 200);
    assert.deepEqual(recipientsRes.body?.data, []);

    const duplicateRes = await requestJson({
      method: 'POST',
      path: `/api/marketing/campaigns/${campaignId}/duplicate`,
      token: ownerToken,
      body: { name: 'HTTP integration copy' }
    });
    assert.equal(duplicateRes.status, 201);
    const copyId = duplicateRes.body?.data?._id;
    assert.ok(copyId);
    createdCampaignIds.push(copyId);

    const deleteRes = await requestJson({
      method: 'DELETE',
      path: `/api/marketing/campaigns/${copyId}`,
      token: ownerToken
    });
    assert.equal(deleteRes.status, 200);
  });
}
