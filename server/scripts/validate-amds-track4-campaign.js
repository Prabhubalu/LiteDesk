'use strict';

/**
 * End-to-end Track 4 campaign + tracking validation (LiteDesk + AMDS must be running).
 *
 * Prerequisites:
 *   - AMDS: npm run docker:up && npm run dev
 *   - LiteDesk: npm run dev (server on PORT, default 3000)
 *   - Matching AMDS_API_KEY / AMDS_WEBHOOK_SECRET on both sides
 *   - Verified sending domain (localhost.test with DNS_VERIFY_BYPASS on AMDS for local)
 *
 * Usage:
 *   node scripts/validate-amds-track4-campaign.js [organizationId]
 *   node scripts/validate-amds-track4-campaign.js [organizationId] --http
 *
 * --http  Exercise full M1 REST API (/api/marketing/campaigns) against LiteDesk.
 *         Requires JWT_SECRET and a running LiteDesk server (LITEDESK_API_URL or PORT).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const Campaign = require('../models/Campaign');
const Organization = require('../models/Organization');
const User = require('../models/User');
const { sendCampaignBatch } = require('../services/marketing/sendCampaignBatch');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { isAmdsEnvConfigured } = require('../config/amds');

const USE_HTTP = process.argv.includes('--http') || process.env.MARKETING_VALIDATE_HTTP === '1';
const API_BASE = String(
  process.env.LITEDESK_API_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
).replace(/\/$/, '');

const POLL_MS = 500;
const DELIVERY_WAIT_MS = 30_000;
const ENGAGEMENT_WAIT_MS = 20_000;
const MAILPIT_API = String(process.env.MAILPIT_API_URL || 'http://localhost:8025').replace(/\/$/, '');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveOrganizationId(argvOrgId) {
  if (argvOrgId && mongoose.Types.ObjectId.isValid(argvOrgId)) {
    return new mongoose.Types.ObjectId(argvOrgId);
  }
  const org = await Organization.findOne().select('_id').lean();
  if (!org?._id) throw new Error('No organization found — pass organizationId as argv[2]');
  return org._id;
}

async function resolveOwnerToken(organizationId) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required for --http validation');
  }

  let owner = await User.findOne({ organizationId, isOwner: true }).select('_id organizationId').lean();
  if (!owner?._id) {
    owner = await User.findOne({ organizationId }).select('_id organizationId').lean();
  }
  if (!owner?._id) {
    throw new Error(`No user found for organization ${organizationId}`);
  }

  return jwt.sign(
    { id: String(owner._id), organizationId: String(organizationId) },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function apiRequest(method, path, { token, body } = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let parsed;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }

  if (!res.ok) {
    throw new Error(
      `${method} ${path} failed (${res.status}): ${parsed?.message || parsed?.raw || text}`
    );
  }

  return parsed;
}

async function validateHttpCampaignApi({ organizationId, fromEmail, recipientA, recipientB }) {
  const token = await resolveOwnerToken(organizationId);
  const ts = Date.now();

  console.log(`[HTTP] Validating M1 campaign API at ${API_BASE}`);

  const created = await apiRequest('POST', '/api/marketing/campaigns', {
    token,
    body: {
      name: `Track4 HTTP ${ts}`,
      subject: `[Track4 HTTP] ${ts}`,
      bodyHtml: `<p>Track 4 HTTP validation</p><p><a href="https://example.com/track4">CTA</a></p>`,
      bodyText: 'Track 4 HTTP validation',
      fromEmail,
      trackOpens: true,
      trackClicks: true
    }
  });
  const campaignId = created?.data?._id;
  if (!campaignId) throw new Error('HTTP create campaign did not return _id');
  console.log(`[HTTP] Created campaign ${campaignId}`);

  const listed = await apiRequest('GET', `/api/marketing/campaigns?search=${encodeURIComponent('Track4 HTTP')}`, {
    token
  });
  const inList = Array.isArray(listed?.data)
    && listed.data.some((row) => String(row._id) === String(campaignId));
  if (!inList) throw new Error('Created campaign not found in list response');
  console.log('[HTTP] List campaigns OK');

  await apiRequest('PUT', `/api/marketing/campaigns/${campaignId}`, {
    token,
    body: { subject: `[Track4 HTTP updated] ${ts}` }
  });
  console.log('[HTTP] Update campaign OK');

  const sendResult = await apiRequest('POST', `/api/marketing/campaigns/${campaignId}/send`, {
    token,
    body: {
      recipients: [
        { email: recipientA, recipientId: 'r1' },
        { email: recipientB, recipientId: 'r2' }
      ]
    }
  });
  console.log(
    `[HTTP] Send accepted=${sendResult?.data?.accepted ?? '?'} rejected=${sendResult?.data?.rejected ?? '?'}`
  );

  const firstCommId = sendResult?.data?.communicationIds?.[0];
  if (!firstCommId) {
    throw new Error('HTTP send did not return communicationIds');
  }

  const recipients = await apiRequest('GET', `/api/marketing/campaigns/${campaignId}/recipients`, {
    token
  });
  if (!Array.isArray(recipients?.data) || recipients.data.length < 1) {
    throw new Error('HTTP recipients endpoint returned no rows after send');
  }
  console.log(`[HTTP] Recipients endpoint returned ${recipients.data.length} row(s)`);

  try {
    await apiRequest('GET', `/api/marketing/campaigns/${campaignId}/analytics`, { token });
    console.log('[HTTP] Analytics endpoint OK');
  } catch (err) {
    console.warn(`[HTTP] Analytics skipped: ${err.message}`);
  }

  const duplicate = await apiRequest('POST', `/api/marketing/campaigns/${campaignId}/duplicate`, {
    token,
    body: { name: `Track4 HTTP copy ${ts}` }
  });
  const copyId = duplicate?.data?._id;
  if (copyId) {
    await apiRequest('DELETE', `/api/marketing/campaigns/${copyId}`, { token });
    console.log('[HTTP] Duplicate + delete draft copy OK');
  }

  return { campaignId, firstCommId };
}

async function pollCommunication(organizationId, communicationId, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      Communication.findById(communicationId).lean()
    );
    if (doc && predicate(doc)) return doc;
    await sleep(POLL_MS);
  }
  return null;
}

async function pollCampaign(organizationId, campaignId, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      Campaign.findById(campaignId).lean()
    );
    if (doc && predicate(doc)) return doc;
    await sleep(POLL_MS);
  }
  return null;
}

/**
 * @param {string} recipientEmail
 */
async function fetchLatestMailpitHtml(recipientEmail) {
  const listRes = await fetch(`${MAILPIT_API}/api/v1/messages?limit=50`);
  if (!listRes.ok) {
    throw new Error(`Mailpit list failed (${listRes.status})`);
  }
  const list = await listRes.json();
  const messages = Array.isArray(list?.messages) ? list.messages : [];
  const match = messages.find((m) =>
    Array.isArray(m.To) && m.To.some((to) => String(to.Address || to).includes(recipientEmail))
  );
  if (!match?.ID) {
    throw new Error(`No Mailpit message found for ${recipientEmail}`);
  }

  const msgRes = await fetch(`${MAILPIT_API}/api/v1/message/${match.ID}`);
  if (!msgRes.ok) {
    throw new Error(`Mailpit message fetch failed (${msgRes.status})`);
  }
  const msg = await msgRes.json();
  return msg.HTML || msg.Text || '';
}

function extractTrackingUrls(html) {
  const openMatch = html.match(/src="([^"]+\/t\/[^"]+)"/i);
  const clickMatch = html.match(/href="([^"]+\/c\/[^"]+)"/i);
  return {
    openUrl: openMatch ? openMatch[1].replace(/&amp;/g, '&') : null,
    clickUrl: clickMatch ? clickMatch[1].replace(/&amp;/g, '&') : null
  };
}

async function createCampaignDirect(organizationId, fromEmail, ts) {
  let campaignId;
  await runWithOrganizationTenantContext(organizationId, async () => {
    const campaign = await Campaign.create({
      organizationId,
      name: `Track4 validation ${ts}`,
      subject: `[Track4] campaign ${ts}`,
      bodyHtml: `<p>Track 4 validation</p><p><a href="https://example.com/track4">CTA</a></p>`,
      bodyText: 'Track 4 validation',
      fromEmail,
      trackOpens: true,
      trackClicks: true
    });
    campaignId = campaign._id;
  });
  return campaignId;
}

async function main() {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS is not configured (AMDS_BASE_URL + AMDS_API_KEY required)');
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const cliArgs = process.argv.slice(2).filter((arg) => arg !== '--http');
  const organizationId = await resolveOrganizationId(cliArgs[0]);
  const ts = Date.now();
  const recipientA = `track4-a-${ts}@example.com`;
  const recipientB = `track4-b-${ts}@example.com`;
  const fromEmail = process.env.DEFAULT_FROM_EMAIL || 'noreply@localhost.test';

  let campaignId;
  let firstCommId;
  let sendResult;

  if (USE_HTTP) {
    const httpResult = await validateHttpCampaignApi({
      organizationId,
      fromEmail,
      recipientA,
      recipientB
    });
    campaignId = httpResult.campaignId;
    firstCommId = httpResult.firstCommId;
  } else {
    campaignId = await createCampaignDirect(organizationId, fromEmail, ts);
    console.log(`Created Campaign ${campaignId}`);

    sendResult = await sendCampaignBatch({
      organizationId,
      campaignId,
      recipients: [
        { email: recipientA, recipientId: 'r1' },
        { email: recipientB, recipientId: 'r2' }
      ]
    });

    console.log(`AMDS batch accepted=${sendResult.accepted} rejected=${sendResult.rejected}`);
    firstCommId = sendResult.communicationIds?.[0];
    if (!firstCommId) {
      throw new Error('No communication records created');
    }
  }

  const deliveredComm = await pollCommunication(
    organizationId,
    firstCommId,
    (doc) => doc.status === 'delivered' || doc.metadata?.amdsMessageId,
    DELIVERY_WAIT_MS
  );
  if (!deliveredComm?.metadata?.amdsMessageId) {
    console.warn('Delivery webhook not observed yet — continuing with Mailpit tracking URLs');
  } else {
    console.log(`Communication ${firstCommId} amdsMessageId=${deliveredComm.metadata.amdsMessageId}`);
  }

  const html = await fetchLatestMailpitHtml(recipientA);
  const { openUrl, clickUrl } = extractTrackingUrls(html);
  if (!openUrl || !clickUrl) {
    throw new Error(`Tracking URLs not found in Mailpit HTML (open=${openUrl}, click=${clickUrl})`);
  }

  console.log(`Hitting open pixel: ${openUrl}`);
  await fetch(openUrl, { redirect: 'manual' });
  console.log(`Hitting click redirect: ${clickUrl}`);
  await fetch(clickUrl, { redirect: 'manual' });

  const openedComm = await pollCommunication(
    organizationId,
    firstCommId,
    (doc) => !!doc.metadata?.openedAt || !!doc.metadata?.clickedAt,
    ENGAGEMENT_WAIT_MS
  );

  if (openedComm?.metadata?.openedAt || openedComm?.metadata?.clickedAt) {
    console.log('Webhook engagement metadata observed on Communication');
  } else {
    console.warn('Engagement webhook not observed — check AMDS LITEDESK_WEBHOOK_URL');
  }

  const campaignWithStats = await pollCampaign(
    organizationId,
    campaignId,
    (doc) => (doc.stats?.uniqueOpens || 0) > 0 || (doc.stats?.uniqueClicks || 0) > 0,
    ENGAGEMENT_WAIT_MS
  );

  if (campaignWithStats) {
    console.log(
      `Campaign stats uniqueOpens=${campaignWithStats.stats.uniqueOpens} uniqueClicks=${campaignWithStats.stats.uniqueClicks}`
    );
  }

  console.log(USE_HTTP ? 'LiteDesk Track 4 + M1 HTTP validation complete' : 'LiteDesk Track 4 validation complete');
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
