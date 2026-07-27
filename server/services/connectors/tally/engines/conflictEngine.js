'use strict';

/**
 * ATIP Conflict Engine — produce + resolve conflicts when both sides change.
 */

const connectorConflictService = require('../../connectorConflictService');
const tallyConflictApplyService = require('../tallyConflictApplyService');
const ConnectorConflict = require('../../../../models/ConnectorConflict');
const { CONNECTOR_KEYS, CONFLICT_STATUSES } = require('../../connectorConstants');
const auditEngine = require('./auditEngine');

const POLICIES = Object.freeze([
  'crm_wins',
  'tally_wins',
  'latest_timestamp',
  'ask_user',
  'rule_based',
  'admin_policy',
]);

async function createConflict({
  organizationId,
  companyGuid,
  entityType,
  arivuId = null,
  remoteId = null,
  arivuPayload = null,
  remotePayload = null,
  reason = 'concurrent_modification',
  policy = 'ask_user',
}) {
  const conflict = await connectorConflictService.createConflict({
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
    entityType,
    arivuId,
    externalId: remoteId,
    companyGuid,
    leftSnapshot: arivuPayload,
    rightSnapshot: remotePayload,
    reason,
    metadata: { policy, source: 'atip_conflict_engine' },
  });

  await auditEngine.recordEvent({
    organizationId,
    code: 'CONFLICT_CREATED',
    message: `Conflict on ${entityType} ${remoteId || arivuId}`,
    level: 'warn',
    operation: 'conflict_create',
    moduleKey: entityType,
    recordId: String(arivuId || remoteId || ''),
    payload: { conflictId: String(conflict._id), reason, policy },
  });

  return conflict;
}

/**
 * Detect conflict: both CRM and Tally mutated since last sync link.
 */
function shouldRaiseConflict({ arivuUpdatedAt, tallyAlterId, lastSyncedAlterId, lastSyncedArivuUpdatedAt, policy }) {
  if (policy === 'crm_wins' || policy === 'tally_wins') return false;
  if (!arivuUpdatedAt || !tallyAlterId) return false;
  const arivuChanged =
    lastSyncedArivuUpdatedAt &&
    new Date(arivuUpdatedAt).getTime() > new Date(lastSyncedArivuUpdatedAt).getTime();
  const tallyChanged =
    lastSyncedAlterId != null &&
    String(tallyAlterId) !== String(lastSyncedAlterId);
  return Boolean(arivuChanged && tallyChanged);
}

async function listConflicts({ organizationId, status = CONFLICT_STATUSES?.OPEN || 'open', limit = 50 }) {
  const filter = {
    organizationId,
    connectorKey: CONNECTOR_KEYS.TALLY || 'tally',
  };
  if (status) filter.status = status;
  return ConnectorConflict.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
}

async function resolveConflict(args) {
  const result = await tallyConflictApplyService.resolveAndApply(args);
  await auditEngine.recordEvent({
    organizationId: args.organizationId,
    code: 'CONFLICT_RESOLVED',
    message: `Conflict ${args.conflictId} resolved as ${args.resolution}`,
    operation: 'conflict_resolve',
    userId: args.userId || args.resolvedBy,
    payload: { conflictId: args.conflictId, resolution: args.resolution },
  });
  return result;
}

async function applyPolicy({ policy, arivuUpdatedAt, remoteUpdatedAt }) {
  if (policy === 'crm_wins') return 'use_arivu';
  if (policy === 'tally_wins') return 'use_external';
  if (policy === 'latest_timestamp') {
    const a = arivuUpdatedAt ? new Date(arivuUpdatedAt).getTime() : 0;
    const r = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
    return a >= r ? 'use_arivu' : 'use_external';
  }
  return null; // ask_user
}

module.exports = {
  POLICIES,
  createConflict,
  shouldRaiseConflict,
  listConflicts,
  resolveConflict,
  applyPolicy,
};
