/**
 * ============================================================================
 * PLATFORM CORE: Domain Events Service
 * ============================================================================
 *
 * Non-invasive domain events emitted on lifecycle, type, stage, and pipeline
 * changes. Used by the automation engine to resolve and plan actions.
 *
 * - Emitted from service layer (or controllers that invoke service logic)
 * - Non-blocking (setImmediate)
 * - Fire only on real changes (callers must compare previous vs current)
 *
 * Event payload: { entityType, entityId, eventType, previousState, currentState, appKey, triggeredBy }
 *
 * ============================================================================
 */

const crypto = require('crypto');
const { createLogger } = require('./automationLogger');

const log = createLogger('domainEvents');

/** @type {Array<(event: DomainEvent) => void | Promise<void>>} */
const subscribers = [];

/**
 * @typedef {Object} DomainEvent
 * @property {string} entityType - 'people' | 'organization' | 'deal'
 * @property {string} entityId - Record ID (string or ObjectId)
 * @property {string} eventType - e.g. 'people.lifecycle.changed', 'deal.stage.changed'
 * @property {Object} [previousState] - State before change (null for create)
 * @property {Object} [currentState] - State after change
 * @property {string} [appKey] - App context (e.g. 'SALES')
 * @property {string|Object|null} [triggeredBy] - User ID or 'system'
 * @property {string} [organizationId] - Tenant organization ID
 * @property {string|Object|null} [assignedTo] - Record owner (User ID) for action resolution
 */

/**
 * Subscribe to domain events. Handlers are invoked non-blocking; errors are logged and do not throw.
 *
 * @param {(event: DomainEvent) => void | Promise<void>} handler
 */
function subscribe(handler) {
  if (typeof handler !== 'function') return;
  subscribers.push(handler);
}

/**
 * Emit a domain event. Delivery is non-blocking (setImmediate). Only call when a real change occurred.
 *
 * @param {DomainEvent} event
 */
function emit(event) {
  if (!event || !event.entityType || !event.entityId || !event.eventType) {
    log.warn('domain_event_emit_skipped', { reason: 'invalid_payload', keys: event ? Object.keys(event) : [] });
    return;
  }

  const eventId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');

  const payload = {
    eventId,
    entityType: event.entityType,
    entityId: event.entityId.toString ? event.entityId.toString() : String(event.entityId),
    eventType: event.eventType,
    previousState: event.previousState ?? null,
    currentState: event.currentState ?? null,
    changedFields: Array.isArray(event.changedFields) ? event.changedFields : [],
    appKey: event.appKey || null,
    triggeredBy: event.triggeredBy ?? null,
    organizationId: event.organizationId ? (event.organizationId.toString ? event.organizationId.toString() : String(event.organizationId)) : null,
    assignedTo: event.assignedTo != null ? (event.assignedTo.toString ? event.assignedTo.toString() : String(event.assignedTo)) : null,
    timestamp: new Date().toISOString()
  };

  log.info('domain_event_emitted', {
    eventId: payload.eventId,
    entityType: payload.entityType,
    entityId: payload.entityId,
    eventType: payload.eventType,
    appKey: payload.appKey,
    hasPrevious: !!payload.previousState,
    hasCurrent: !!payload.currentState
  });

  // Cheap client cache invalidation (SSE) for record created/updated — no polling
  if (
    payload.organizationId &&
    (payload.eventType.endsWith('.created') || payload.eventType.endsWith('.updated'))
  ) {
    try {
      const { publishDataChange } = require('./dataChangeService');
      const ENTITY_TO_MODULE = {
        people: 'people',
        organization: 'organizations',
        deal: 'deals',
        quote: 'quotes',
        live_chat_session: 'live_chat_sessions',
        announcement: 'announcements',
        internal_chat_message: 'internal_chat_messages',
        internal_chat_space: 'internal_chat_spaces',
      };
      const et = String(payload.entityType || '').toLowerCase();
      publishDataChange({
        organizationId: payload.organizationId,
        moduleKey: ENTITY_TO_MODULE[et] || et,
        recordId: payload.entityId,
        op: payload.eventType.endsWith('.created') ? 'create' : 'update'
      });
    } catch (err) {
      log.warn('domain_event_data_change_publish_failed', { error: err.message });
    }
  }

  setImmediate(() => {
    const deliver = () => {
      subscribers.forEach((handler) => {
        try {
          const result = handler(payload);
          if (result && typeof result.then === 'function') {
            result.catch((err) => {
              log.error('domain_event_handler_error', {
                eventType: payload.eventType,
                error: err.message,
                stack: err.stack
              });
            });
          }
        } catch (err) {
          log.error('domain_event_handler_error', {
            eventType: payload.eventType,
            error: err.message,
            stack: err.stack
          });
        }
      });
    };

    // Process/Automation models live on the tenant DB. setImmediate can drop ALS —
    // always re-bind from event.organizationId when present.
    if (payload.organizationId) {
      const { runWithOrganizationTenantContext } = require('../utils/runWithOrganizationTenant');
      Promise.resolve(runWithOrganizationTenantContext(payload.organizationId, async () => deliver())).catch(
        (err) => {
          log.error('domain_event_tenant_bind_failed', {
            eventType: payload.eventType,
            organizationId: payload.organizationId,
            error: err.message
          });
          deliver();
        }
      );
      return;
    }

    deliver();
  });
}

module.exports = {
  subscribe,
  emit
};
