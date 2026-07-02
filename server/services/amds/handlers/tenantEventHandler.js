'use strict';

const mongoose = require('mongoose');
const OrgEmailPolicy = require('../../../models/org-email-policy');
const {
  refreshOrgEmailReputation,
  refreshOrgEmailReputationGuidance,
  refreshOrgEmailThroughput
} = require('../../orgEmailPolicyService');

/** @type {Set<string>} */
const TENANT_EVENT_TYPES = new Set([
  'credit.reserved',
  'credit.consumed',
  'credit.released',
  'policy.limit_exceeded',
  'reputation.updated',
  'throughput.updated'
]);

/**
 * @param {string} eventType
 * @returns {boolean}
 */
function isTenantAmdsEventType(eventType) {
  return TENANT_EVENT_TYPES.has(String(eventType || '').trim());
}

/**
 * @param {import('../amds-types').AmdsTenantWebhookEvent} event
 */
async function processTenantEvent(event) {
  const tenantId = String(event.tenant_id || '').trim();
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    console.warn('[tenantEventHandler] invalid tenant_id', tenantId);
    return;
  }

  const organizationId = new mongoose.Types.ObjectId(tenantId);

  switch (event.event_type) {
    case 'credit.reserved':
    case 'credit.consumed':
    case 'credit.released': {
      if (!event.credit) return;
      await OrgEmailPolicy.findOneAndUpdate(
        { organizationId },
        {
          creditsRemaining: event.credit.balance_after,
          creditsReserved: event.credit.reserved_after
        }
      );
      break;
    }
    case 'policy.limit_exceeded': {
      console.warn('[tenantEventHandler] policy limit exceeded', tenantId, event.policy);
      break;
    }
    case 'reputation.updated': {
      if (event.reputation) {
        await OrgEmailPolicy.findOneAndUpdate(
          { organizationId },
          {
            senderReputation: event.reputation.score,
            reputationPreviousScore: event.reputation.previous_score ?? null,
            reputationDelta: event.reputation.delta ?? null,
            reputationFactors: Array.isArray(event.reputation.factors)
              ? event.reputation.factors
              : [],
            reputationUpdatedAt: new Date()
          }
        );
      }
      refreshOrgEmailReputation(organizationId).catch((err) => {
        console.warn('[tenantEventHandler] reputation refresh failed:', err?.message || err);
      });
      refreshOrgEmailReputationGuidance(organizationId).catch((err) => {
        console.warn('[tenantEventHandler] reputation guidance refresh failed:', err?.message || err);
      });
      break;
    }
    case 'throughput.updated': {
      if (event.throughput) {
        await OrgEmailPolicy.findOneAndUpdate(
          { organizationId },
          {
            effectiveHourlyRate: event.throughput.effective_hourly_rate,
            effectiveBurstRate: event.throughput.effective_burst_rate,
            warmupStage: event.throughput.multipliers?.warmup_stage ?? null,
            infraMultiplier: event.throughput.multipliers?.infra ?? null,
            throughputUpdatedAt: new Date()
          }
        );
      }
      refreshOrgEmailThroughput(organizationId).catch((err) => {
        console.warn('[tenantEventHandler] throughput refresh failed:', err?.message || err);
      });
      break;
    }
    default:
      break;
  }
}

module.exports = {
  isTenantAmdsEventType,
  processTenantEvent,
  TENANT_EVENT_TYPES
};
