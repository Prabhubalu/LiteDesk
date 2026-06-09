/**
 * ============================================================================
 * Event Utilities (Client)
 * ============================================================================
 * 
 * Shared utility functions for Event-related operations on the client side.
 * 
 * NOTE: This file now uses canonical metadata from @/metadata/eventTypes.ts
 * 
 * See: docs/architecture/event-settings.md
 * ============================================================================
 */

import { 
  getAuditEventTypes, 
  isAuditEventTypeKey, 
  isAuditEventTypeLabel,
  EVENT_TYPES 
} from '@/metadata/eventTypes';

/**
 * Audit Event Type Labels (for backward compatibility)
 * 
 * @deprecated Use getAuditEventTypes() from @/metadata/eventTypes instead
 */
export const AUDIT_EVENT_TYPES = getAuditEventTypes().map(t => t.label) as readonly string[];

/**
 * Non-Audit Event Type Labels (for backward compatibility)
 * 
 * @deprecated Use getEventTypesForApp(appKey, excludeAudit: true) from @/metadata/eventTypes instead
 */
export const NON_AUDIT_EVENT_TYPES = Object.values(EVENT_TYPES)
  .filter(t => !t.audit)
  .map(t => t.label) as readonly string[];

/**
 * All Event Type Labels (for backward compatibility)
 * 
 * @deprecated Use Object.values(EVENT_TYPES) from @/metadata/eventTypes instead
 */
export const ALL_EVENT_TYPES = Object.values(EVENT_TYPES).map(t => t.label) as readonly string[];

/**
 * Check if an event type is an audit event type
 * 
 * Supports both keys (MEETING) and labels (Meeting) for backward compatibility.
 * 
 * @param eventType - The event type key or label to check
 * @returns True if the event type is an audit event type
 * 
 * @example
 * isAuditEventType('Internal Audit') // true (label)
 * isAuditEventType('INTERNAL_AUDIT') // true (key)
 * isAuditEventType('Meeting') // false
 * 
 * See: docs/architecture/event-settings.md
 */
export function isAuditEventType(eventType: string | null | undefined): boolean {
  if (!eventType || typeof eventType !== 'string') {
    return false;
  }
  // Try as key first (preferred)
  if (isAuditEventTypeKey(eventType)) {
    return true;
  }
  // Fallback to label check (backward compatibility)
  return isAuditEventTypeLabel(eventType);
}

/**
 * Filter out audit event types from an array of event types
 * 
 * Used in generic event creation interfaces to prevent users from
 * selecting audit event types, which must be created through Audit flows.
 * 
 * @param eventTypes - Array of event type keys or labels to filter
 * @returns Array of non-audit event types
 * 
 * @example
 * filterNonAuditEventTypes(['Meeting', 'Internal Audit']) 
 * // ['Meeting']
 * 
 * See: docs/architecture/event-settings.md
 */
export function filterNonAuditEventTypes(eventTypes: string[]): string[] {
  return eventTypes.filter(type => !isAuditEventType(type));
}

export type EventExecutionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

/**
 * Derive UI execution state from event record (mirrors server deriveExecutionState).
 * Status stays Planned during in-progress generic events; executionStartTime marks progress.
 */
export function deriveEventExecutionState(
  event: {
    status?: string | null;
    executionStartTime?: string | Date | null;
    executionStartedAt?: string | Date | null;
  } | null | undefined
): EventExecutionState {
  if (!event) return 'NOT_STARTED';

  const status = String(event.status || '').trim();
  if (status === 'Cancelled' || status === 'CANCELLED') return 'CANCELLED';
  if (status === 'Completed' || status === 'COMPLETED') return 'COMPLETED';
  if (event.executionStartTime || event.executionStartedAt) return 'IN_PROGRESS';

  return 'NOT_STARTED';
}

/** Badge variant for system event status (Planned, Completed, Cancelled). */
export function getEventStatusBadgeVariant(
  status: string | null | undefined
): 'info' | 'success' | 'danger' | 'warning' {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'success';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'danger';
  if (normalized === 'in-progress' || normalized === 'in progress') return 'warning';
  return 'info';
}
