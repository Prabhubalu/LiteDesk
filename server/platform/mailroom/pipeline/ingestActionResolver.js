'use strict';

const { resolveIngestActionForSpam } = require('../policies/strategies/classificationStrategies');

/**
 * Resolve final ingest action after ingest + classification (spam may override).
 */
function resolveMailroomIngestActionType(ingestEvaluation, classificationEvaluation, classificationPolicy = {}) {
  const spamAction = resolveIngestActionForSpam(classificationEvaluation, classificationPolicy);
  if (spamAction) return spamAction;
  return ingestEvaluation?.action?.type || 'route_to_case_flow';
}

module.exports = {
  resolveMailroomIngestActionType
};
