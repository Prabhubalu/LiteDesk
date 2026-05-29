/**
 * ============================================================================
 * PLATFORM CORE: Process Execution Context
 * ============================================================================
 *
 * Execution context object created per process execution.
 * Aligns with Domain Events and Automation Engine context.
 *
 * ============================================================================
 */

/**
 * @typedef {Object} ProcessExecutionContext
 * @property {string} executionId - Unique, deterministic execution ID
 * @property {string} processId - Process ID
 * @property {string} appKey - App context (e.g. 'SALES')
 * @property {string|null} entityType - Entity type ('people' | 'organization' | 'deal' | 'quote')
 * @property {string|null} entityId - Entity ID
 * @property {string|null} organizationId - Tenant organization ID
 * @property {string|null} triggeredBy - User ID or 'system'
 * @property {string|null} ownerId - Record owner (User ID)
 * @property {Object|null} event - Full domain event payload if triggered by event
 * @property {Object} dataBag - Mutable key-value store shared across nodes
 * @property {Object} behaviorProposals - Accumulated behavior proposals
 * @property {Array} behaviorProposals.fieldRules - Field rule proposals
 * @property {Array} behaviorProposals.ownershipRules - Ownership rule proposals
 * @property {Array} behaviorProposals.statusGuards - Status guard proposals
 */

/**
 * Build ProcessExecutionContext from domain event or manual invocation.
 *
 * @param {Object} params
 * @param {string} params.processId - Process ID
 * @param {string} params.appKey - App key
 * @param {Object|null} params.event - Domain event (if triggered by event)
 * @param {string|null} params.entityType - Entity type (if manual)
 * @param {string|null} params.entityId - Entity ID (if manual)
 * @param {string|null} params.organizationId - Organization ID
 * @param {string|null} params.triggeredBy - User ID or 'system'
 * @param {string|null} params.ownerId - Owner ID
 * @returns {ProcessExecutionContext}
 */
function buildExecutionContext(params) {
  const {
    processId,
    appKey,
    event = null,
    entityType = null,
    entityId = null,
    organizationId = null,
    triggeredBy = null,
    ownerId = null
  } = params;

  // Generate deterministic execution ID
  const executionId = event
    ? `${processId}:${event.eventId}`
    : params.webhookDeliveryId
    ? `${processId}:webhook:${params.webhookDeliveryId}`
    : params.webhookInvocation
    ? `${processId}:webhook:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
    : `${processId}:manual:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

  return {
    executionId,
    processId,
    appKey: appKey || 'SALES',
    entityType: event ? event.entityType : entityType,
    entityId: event ? event.entityId : entityId,
    organizationId: event ? event.organizationId : organizationId,
    triggeredBy: event ? event.triggeredBy : triggeredBy,
    ownerId: event ? event.ownerId : ownerId,
    event,
    dataBag: {},
    behaviorProposals: {
      fieldRules: [],
      ownershipRules: [],
      statusGuards: []
    }
  };
}

module.exports = {
  buildExecutionContext
};
