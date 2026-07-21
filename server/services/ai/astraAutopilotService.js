'use strict';

/**
 * Astra Autopilot — scan CRM signals → persist grounded proposals.
 * Feature flag: ASTRA_AUTOPILOT_V1=true
 */

const Organization = require('../../models/Organization');
const User = require('../../models/User');
const AstraProposal = require('../../models/AstraProposal');
const dbConnectionManager = require('../../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../../utils/tenantContext');
const {
  buildNextBestActions,
  STALE_DEAL_DAYS,
} = require('./aiAstraNextBestActionService');

const DEFAULT_TTL_HOURS = 72;
const MAX_USERS_PER_TENANT = 40;
const MAX_PROPOSALS_PER_USER = 3;

function isAutopilotEnabled() {
  return String(process.env.ASTRA_AUTOPILOT_V1 || '').toLowerCase() === 'true';
}

function proposalFingerprint(action, trigger = 'nba_scan') {
  const kind = String(action?.kind || '').trim();
  const moduleKey = String(action?.moduleKey || '').trim().toLowerCase();
  const relatedId = action?.fields?.relatedTo?.id
    ? String(action.fields.relatedTo.id)
    : '';
  const recordId = String(action?.recordId || relatedId || '').trim();
  const trig = String(trigger || 'nba_scan').trim();
  return `${kind}:${moduleKey}:${recordId}:${trig}`.slice(0, 200);
}

function serializeProposal(doc) {
  if (!doc) return null;
  const plain = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    organizationId: String(plain.organizationId),
    userId: String(plain.userId),
    fingerprint: plain.fingerprint,
    trigger: plain.trigger,
    status: plain.status,
    action: plain.action || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    acceptedAt: plain.acceptedAt || null,
    dismissedAt: plain.dismissedAt || null,
    expiresAt: plain.expiresAt || null,
  };
}

function inferTrigger(action) {
  const kind = String(action?.kind || '');
  const rationale = String(action?.rationale || '').toLowerCase();
  if (kind === 'complete_task' || /overdue/.test(rationale)) return 'attention_overdue';
  if (/sla/.test(rationale)) return 'case_sla';
  if (kind === 'follow_up' || kind === 'create_record' || /no activity|stale/.test(rationale)) {
    return 'stale_deal';
  }
  if (/due today/.test(rationale)) return 'attention_due_today';
  return 'nba_scan';
}

/**
 * Upsert NBA actions as proposed rows for one user (idempotent by fingerprint).
 */
async function upsertProposalsForUser({
  organizationId,
  userId,
  actions = [],
  ttlHours = DEFAULT_TTL_HOURS,
  triggerOverride = '',
} = {}) {
  if (!organizationId || !userId) {
    return { created: 0, refreshed: 0, proposals: [] };
  }
  const expiresAt = new Date(Date.now() + Math.max(1, ttlHours) * 60 * 60 * 1000);
  let created = 0;
  let refreshed = 0;
  const proposals = [];

  for (const action of (Array.isArray(actions) ? actions : []).slice(0, MAX_PROPOSALS_PER_USER)) {
    if (!action?.label || !action?.kind) continue;
    // Writes must stay confirm-gated
    if (action.kind === 'create_record' || action.kind === 'update_record') {
      action.executeNow = false;
    }
    const trigger = String(triggerOverride || '').trim() || inferTrigger(action);
    const fingerprint = proposalFingerprint(action, trigger);
    const existing = await AstraProposal.findOne({
      organizationId,
      userId,
      fingerprint,
    });

    if (existing) {
      if (existing.status === 'dismissed' || existing.status === 'accepted') {
        continue;
      }
      existing.action = action;
      existing.trigger = trigger;
      existing.expiresAt = expiresAt;
      existing.status = 'proposed';
      await existing.save();
      refreshed += 1;
      proposals.push(serializeProposal(existing));
      continue;
    }

    try {
      const doc = await AstraProposal.create({
        organizationId,
        userId,
        fingerprint,
        trigger,
        status: 'proposed',
        action,
        expiresAt,
      });
      created += 1;
      proposals.push(serializeProposal(doc));
    } catch (err) {
      if (err?.code === 11000) {
        const race = await AstraProposal.findOne({ organizationId, userId, fingerprint });
        if (race && race.status === 'proposed') {
          refreshed += 1;
          proposals.push(serializeProposal(race));
        }
        continue;
      }
      throw err;
    }
  }

  return { created, refreshed, proposals };
}

/**
 * Scan one user: build NBA → upsert proposals.
 */
async function scanUserAutopilot({ organizationId, userId } = {}) {
  if (!organizationId || !userId) {
    return { created: 0, refreshed: 0, proposals: [], actions: [] };
  }
  const actions = await buildNextBestActions({
    organizationId,
    userId,
    limit: MAX_PROPOSALS_PER_USER,
  });
  const result = await upsertProposalsForUser({
    organizationId,
    userId,
    actions,
  });
  return { ...result, actions };
}

async function listProposalsForUser({
  organizationId,
  userId,
  status = 'proposed',
  limit = 10,
} = {}) {
  if (!organizationId || !userId) return [];
  const filter = { organizationId, userId };
  if (status) filter.status = status;
  const now = new Date();
  const rows = await AstraProposal.find({
    ...filter,
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  })
    .sort({ 'action.priority': 1, updatedAt: -1 })
    .limit(Math.min(50, Math.max(1, Number(limit) || 10)))
    .lean();

  // Priority sort is weak in Mongo for enum — re-rank in memory
  const rank = { high: 0, medium: 1, low: 2 };
  rows.sort((a, b) => {
    const pa = rank[a.action?.priority] ?? 9;
    const pb = rank[b.action?.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return rows.map(serializeProposal);
}

async function dismissProposal({ organizationId, userId, proposalId } = {}) {
  const doc = await AstraProposal.findOne({
    _id: proposalId,
    organizationId,
    userId,
  });
  if (!doc) {
    const err = new Error('Proposal not found');
    err.statusCode = 404;
    err.code = 'ASTRA_PROPOSAL_NOT_FOUND';
    throw err;
  }
  if (doc.status === 'accepted') {
    const err = new Error('Proposal already accepted');
    err.statusCode = 409;
    err.code = 'ASTRA_PROPOSAL_ALREADY_ACCEPTED';
    throw err;
  }
  doc.status = 'dismissed';
  doc.dismissedAt = new Date();
  await doc.save();
  try {
    const { rememberDismissedFingerprint } = require('./aiUserMemoryService');
    await rememberDismissedFingerprint({
      organizationId,
      userId,
      fingerprint: doc.fingerprint,
    });
  } catch (_) { /* non-fatal */ }
  return serializeProposal(doc);
}

/**
 * Mark accepted and return action for client executor (or server mutation).
 */
async function acceptProposal({ organizationId, userId, proposalId } = {}) {
  const doc = await AstraProposal.findOne({
    _id: proposalId,
    organizationId,
    userId,
  });
  if (!doc) {
    const err = new Error('Proposal not found');
    err.statusCode = 404;
    err.code = 'ASTRA_PROPOSAL_NOT_FOUND';
    throw err;
  }
  if (doc.status === 'dismissed') {
    const err = new Error('Proposal was dismissed');
    err.statusCode = 409;
    err.code = 'ASTRA_PROPOSAL_DISMISSED';
    throw err;
  }
  if (doc.status === 'accepted') {
    return { proposal: serializeProposal(doc), action: doc.action, alreadyAccepted: true };
  }
  doc.status = 'accepted';
  doc.acceptedAt = new Date();
  await doc.save();
  try {
    const { writeAiAuditLog } = require('./aiAuditLogService');
    await writeAiAuditLog({
      organizationId,
      userId,
      abilityKey: 'astra_autopilot_accept',
      provider: 'none',
      model: 'none',
      keyMode: 'platform',
      status: 'success',
      promptVersion: 'astra_autopilot_v1',
      latencyMs: 0,
      metadata: {
        proposalId: String(doc._id),
        fingerprint: doc.fingerprint,
        trigger: doc.trigger,
        actionKind: doc.action?.kind,
        moduleKey: doc.action?.moduleKey,
        recordId: doc.action?.recordId,
      },
    });
  } catch (_) { /* non-fatal */ }
  return { proposal: serializeProposal(doc), action: doc.action, alreadyAccepted: false };
}

function resolveUserModel(connection) {
  return connection?.models?.User || User;
}

/**
 * Multi-tenant cron tick: active users → NBA → proposals.
 */
async function tickAstraAutopilotScan() {
  if (!isAutopilotEnabled()) {
    return { skipped: true, tenantsProcessed: 0, usersScanned: 0, created: 0, errors: 0 };
  }

  const tenants = await Organization.find({
    isTenant: true,
    isActive: true,
    'database.name': { $exists: true, $nin: [null, ''] },
  })
    .select('_id database.name')
    .lean();

  let tenantsProcessed = 0;
  let usersScanned = 0;
  let created = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const dbName = tenant.database?.name;
    if (!dbName) continue;

    let conn;
    try {
      conn = await dbConnectionManager.getOrganizationConnection(dbName);
      if (conn.readyState !== 1) await conn.asPromise();
    } catch (err) {
      errors += 1;
      console.error(`[astraAutopilot] tenant ${tenant._id} DB connect failed:`, err.message);
      continue;
    }

    try {
      await runWithTenantContext(
        { organizationId: tenant._id, connection: conn, databaseName: dbName },
        async () => {
          const ScopedUser = resolveUserModel(conn);
          const users = await ScopedUser.find({
            organizationId: tenant._id,
            status: { $nin: ['invited', 'disabled', 'deleted'] },
            isActive: { $ne: false },
          })
            .select('_id')
            .sort({ lastLoginAt: -1, updatedAt: -1 })
            .limit(MAX_USERS_PER_TENANT)
            .lean();

          tenantsProcessed += 1;
          for (const u of users) {
            try {
              const result = await scanUserAutopilot({
                organizationId: tenant._id,
                userId: u._id,
              });
              usersScanned += 1;
              created += result.created || 0;
            } catch (err) {
              errors += 1;
              console.error(`[astraAutopilot] user ${u._id} scan failed:`, err.message);
            }
          }
        },
      );
    } catch (err) {
      errors += 1;
      console.error(`[astraAutopilot] tenant ${tenant._id} scan failed:`, err.message);
    }
  }

  return {
    skipped: false,
    tenantsProcessed,
    usersScanned,
    created,
    errors,
    staleDealDays: STALE_DEAL_DAYS,
  };
}

module.exports = {
  isAutopilotEnabled,
  proposalFingerprint,
  upsertProposalsForUser,
  scanUserAutopilot,
  listProposalsForUser,
  dismissProposal,
  acceptProposal,
  tickAstraAutopilotScan,
  serializeProposal,
  inferTrigger,
  MAX_PROPOSALS_PER_USER,
};
