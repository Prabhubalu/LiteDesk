'use strict';

/**
 * Audit governance — reuse the existing AI audit log writer so v2 traffic is
 * observable in the same place as legacy. Never throws (best-effort).
 */

const { writeAiAuditLog } = require('../../ai/aiAuditLogService');

/**
 * Record an Astra v2 turn/tool outcome.
 * @param {Object} params
 * @param {string} params.organizationId
 * @param {string} [params.userId]
 * @param {string} params.abilityKey     e.g. 'astra_v2_ask', 'astra_v2_tool'
 * @param {'success'|'error'|'blocked'} params.status
 * @param {string} [params.provider]
 * @param {string} [params.model]
 * @param {string} [params.keyMode]
 * @param {object} [params.usage]
 * @param {number} [params.creditsDebited]
 * @param {number} [params.latencyMs]
 * @param {string[]} [params.contextRefs]
 * @param {object} [params.metadata]
 * @param {string} [params.errorCode]
 * @param {string} [params.errorMessage]
 */
async function recordTurn(params = {}) {
  return writeAiAuditLog({
    organizationId: params.organizationId,
    userId: params.userId || null,
    abilityKey: params.abilityKey || 'astra_v2',
    provider: params.provider || 'astra',
    model: params.model || 'orchestrator',
    keyMode: params.keyMode || 'platform',
    promptVersion: params.promptVersion || 'astra-v2',
    status: params.status || 'success',
    contextRefs: params.contextRefs || [],
    usage: params.usage || {},
    creditsDebited: Number(params.creditsDebited || 0),
    latencyMs: Number(params.latencyMs || 0),
    errorCode: params.errorCode || null,
    errorMessage: params.errorMessage || null,
    metadata: params.metadata || null,
  });
}

module.exports = { recordTurn };
