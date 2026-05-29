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
 * @property {string|Object|null} [ownerId] - Record owner (User ID) for action resolution
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
    ownerId: event.ownerId != null ? (event.ownerId.toString ? event.ownerId.toString() : String(event.ownerId)) : null,
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

  setImmediate(() => {
    subscribers.forEach((handler) => {
      try {
        const result = handler(payload);
        if (result && typeof result.then === 'function') {
          result.catch((err) => {
            log.error('domain_event_handler_error', { eventType: payload.eventType, error: err.message, stack: err.stack });
          });
        }
      } catch (err) {
        log.error('domain_event_handler_error', { eventType: payload.eventType, error: err.message, stack: err.stack });
      }
    });
  });
}

module.exports = {
  subscribe,
  emit
};
