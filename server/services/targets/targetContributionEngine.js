'use strict';

const { subscribe } = require('../domainEvents');
const { createLogger } = require('../automationLogger');
const { processDomainEventForTargets } = require('./contributionEvaluator');
const { CONTRIBUTION_EVENT_MAP } = require('../../constants/targetConstants');

const log = createLogger('targetContributionEngine');
let initialized = false;

const ENTITY_EVENT_TYPES = new Set([
  ...CONTRIBUTION_EVENT_MAP.deal,
  ...CONTRIBUTION_EVENT_MAP.case,
  ...CONTRIBUTION_EVENT_MAP.task
]);

function isRelevantEvent(event) {
  if (!event?.eventType) return false;
  if (ENTITY_EVENT_TYPES.has(event.eventType)) return true;
  if (String(event.entityType).toLowerCase() === 'target') return false;
  return false;
}

function init() {
  if (initialized) return;
  initialized = true;

  subscribe(async (event) => {
    if (!isRelevantEvent(event)) return;
    try {
      const result = await processDomainEventForTargets(event);
      if (result.processed > 0) {
        log.info('target_contributions_processed', {
          eventType: event.eventType,
          entityId: event.entityId,
          processed: result.processed
        });
      }
    } catch (err) {
      log.error('target_contribution_error', {
        eventType: event.eventType,
        error: err.message
      });
    }
  });

  log.info('target_contribution_engine_initialized', {});
}

module.exports = {
  init,
  isRelevantEvent
};
