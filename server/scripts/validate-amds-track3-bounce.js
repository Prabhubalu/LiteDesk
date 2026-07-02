'use strict';

/**
 * End-to-end Track 3 bounce validation (LiteDesk + AMDS must be running).
 *
 * Prerequisites:
 *   - AMDS: npm run docker:up && npm run dev
 *   - LiteDesk: npm run dev (server on PORT, default 3000)
 *   - Matching AMDS_API_KEY / AMDS_WEBHOOK_SECRET on both sides
 *
 * Usage:
 *   node scripts/validate-amds-track3-bounce.js [organizationId]
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const EmailSuppression = require('../models/EmailSuppression');
const Organization = require('../models/Organization');
const { sendViaAmds } = require('../services/emailProviders/amdsEmailDelivery');
const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
const { isAmdsEnvConfigured } = require('../config/amds');

const POLL_MS = 500;
const WEBHOOK_WAIT_MS = 20_000;
const BOUNCE_WAIT_MS = 20_000;
const SUPPRESSION_WAIT_MS = 10_000;
const RECIPIENT = `bounce-test-${Date.now()}@invalid.local`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function pollSuppression(organizationId, email, timeoutMs) {
  const normalized = String(email).trim().toLowerCase();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await runWithOrganizationTenantContext(organizationId, async () =>
      EmailSuppression.findOne({
        organizationId,
        email: normalized,
        active: true
      }).lean()
    );
    if (doc) return doc;
    await sleep(POLL_MS);
  }
  return null;
}

async function simulateBounce(messageId, tenantId) {
  const baseUrl = String(process.env.AMDS_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');
  const apiKey = String(process.env.AMDS_API_KEY || '').trim();
  if (!apiKey) throw new Error('AMDS_API_KEY is not set');

  const response = await fetch(`${baseUrl}/v1/admin/simulate-bounce`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      tenant_id: tenantId,
      message_id: messageId,
      bounce_type: 'hard'
    })
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`simulate-bounce failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function resolveOrganizationId(argvOrgId) {
  if (argvOrgId && mongoose.Types.ObjectId.isValid(argvOrgId)) {
    return new mongoose.Types.ObjectId(argvOrgId);
  }
  const org = await Organization.findOne({ deletedAt: null }).select('_id slug').lean();
  if (!org?._id) {
    throw new Error('No organization found — pass organizationId as first argument');
  }
  console.log(`Using organization ${org._id}${org.slug ? ` (${org.slug})` : ''}`);
  return org._id;
}

async function main() {
  if (!isAmdsEnvConfigured()) {
    throw new Error('AMDS env not configured (AMDS_BASE_URL, AMDS_API_KEY)');
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const organizationId = await resolveOrganizationId(process.argv[2]);
  const orgIdStr = String(organizationId);

  let communicationId;
  await runWithOrganizationTenantContext(organizationId, async () => {
    const doc = await Communication.create({
      organizationId,
      kind: 'email',
      direction: 'outbound',
      subject: `[Track3 validation] bounce ${new Date().toISOString()}`,
      body: 'AMDS Track 3 bounce validation message',
      fromAddress: process.env.DEFAULT_FROM_EMAIL || 'noreply@localhost.test',
      toAddresses: [RECIPIENT],
      status: 'sending',
      relatedTo: {
        moduleKey: 'people',
        recordId: new mongoose.Types.ObjectId()
      },
      idempotencyKey: `track3-bounce-${Date.now()}`,
      idempotencyKeyHash: `track3-bounce-${Date.now()}`
    });
    communicationId = doc._id;
  });

  console.log(`Created Communication ${communicationId}`);

  const sendResult = await sendViaAmds({
    from: process.env.DEFAULT_FROM_EMAIL || 'noreply@localhost.test',
    to: RECIPIENT,
    subject: `[Track3 validation] bounce ${communicationId}`,
    text: 'AMDS Track 3 bounce validation message',
    organizationId: orgIdStr,
    idempotencyKey: `litedesk-people-${orgIdStr}-comm-${communicationId}`,
    metadata: {
      litedesk_module: 'people',
      litedesk_entity_id: String(communicationId),
      litedesk_communication_id: String(communicationId),
      litedesk_org_id: orgIdStr
    },
    tags: ['crm', 'track3-validation']
  });

  if (!sendResult.success || !sendResult.messageId) {
    throw new Error(`AMDS send failed: ${sendResult.error || 'unknown'}`);
  }

  console.log(`AMDS queued message_id=${sendResult.messageId}`);

  await runWithOrganizationTenantContext(organizationId, async () => {
    await Communication.findByIdAndUpdate(communicationId, {
      $set: {
        status: 'sent',
        externalMessageId: sendResult.messageId,
        providerMessageKey: `amds:${sendResult.messageId}`,
        'metadata.provider': 'amds',
        'metadata.amdsMessageId': sendResult.messageId
      }
    });
  });

  const delivered = await pollCommunication(
    organizationId,
    communicationId,
    (doc) => doc.status === 'delivered',
    WEBHOOK_WAIT_MS
  );
  if (!delivered) {
    console.warn('Delivery webhook not received within timeout — continuing with simulate-bounce anyway');
  } else {
    console.log('Delivery webhook received (status=delivered)');
  }

  const bounceResponse = await simulateBounce(sendResult.messageId, orgIdStr);
  console.log('simulate-bounce:', JSON.stringify(bounceResponse));

  const bounced = await pollCommunication(
    organizationId,
    communicationId,
    (doc) => doc.status === 'bounced',
    BOUNCE_WAIT_MS
  );

  if (!bounced) {
    throw new Error('Communication status did not become bounced — is LiteDesk server running?');
  }

  console.log('Communication status=bounced');
  console.log('  bounceClassification:', bounced.metadata?.bounceClassification);
  console.log('  bounceDiagnostic:', bounced.metadata?.bounceDiagnostic);

  const suppression = await pollSuppression(organizationId, RECIPIENT, SUPPRESSION_WAIT_MS);

  if (!suppression) {
    throw new Error(`EmailSuppression not created for ${RECIPIENT}`);
  }

  console.log('EmailSuppression active:', suppression.email, suppression.reason);
  console.log('\nTrack 3 bounce validation PASSED');
}

main()
  .catch((err) => {
    console.error('\nTrack 3 bounce validation FAILED:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
