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
  EVENT_TYPES,
  EVENT_TYPE_DEFINITIONS,
} from '@/metadata/eventTypes';
import type { EventGeoLocation } from '@/types/eventLocation.types';
import { hasGeoCoordinates } from '@/types/eventLocation.types';

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

function normalizeEventTypeToken(value: string): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s—–-]+/g, '_');
}

/** True when location is a virtual meeting URL (geo pin not required). */
export function isMeetingUrlLocation(location: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(location || '').trim());
}

/** Resolve whether geo check-in is required for the current event type + form value. */
export function resolveEventGeoRequired(
  eventType: string | null | undefined,
  geoRequiredField?: boolean | null
): boolean {
  if (!eventType) return Boolean(geoRequiredField);

  const token = normalizeEventTypeToken(eventType);
  const definition = EVENT_TYPE_DEFINITIONS.find(
    (entry) =>
      normalizeEventTypeToken(entry.key) === token
      || normalizeEventTypeToken(entry.label) === token
      || entry.label === eventType
  );

  if (definition && definition.geoRequired && !definition.geoConfigurable) {
    return true;
  }

  if (geoRequiredField != null) return Boolean(geoRequiredField);
  return definition?.geoRequired ?? false;
}

/** Client-side guard before save when geo is required. */
export function isEventLocationGeoValid(
  location: string | null | undefined,
  geoLocation: EventGeoLocation | null | undefined,
  geoRequired: boolean
): boolean {
  if (!geoRequired) return true;
  if (isMeetingUrlLocation(location)) return true;
  return hasGeoCoordinates(geoLocation);
}

export type EventLinkedFormCandidate = {
  _id?: string;
  name?: string;
  formType?: string;
  status?: string;
  tags?: string[];
};

const EVENT_TYPE_FORM_NAME_TOKENS: Record<string, string> = {
  INTERNAL_AUDIT: 'internal audit',
  EXTERNAL_AUDIT_SINGLE: 'external audit',
  EXTERNAL_AUDIT_BEAT: 'external audit',
};

function isAuditFormType(formType: string | null | undefined): boolean {
  const normalized = String(formType || '').trim().toLowerCase();
  return normalized === 'audit' || normalized.includes('audit');
}

function formMatchesNameToken(form: EventLinkedFormCandidate, token: string): boolean {
  const normalizedToken = token.toLowerCase();
  const name = String(form.name || '').toLowerCase();
  if (name.includes(normalizedToken)) return true;
  const tags = Array.isArray(form.tags) ? form.tags : [];
  return tags.some((tag) => String(tag || '').toLowerCase().includes(normalizedToken));
}

/**
 * Filter forms eligible for event linkedFormId based on audit event type.
 * Audit events require Audit formType (Ready/Active). When possible, narrow by event-type name/tag token.
 */
export function filterFormsForEventLinkedForm<T extends EventLinkedFormCandidate>(
  forms: T[],
  eventType: string | null | undefined
): T[] {
  if (!eventType || !isAuditEventType(eventType)) {
    return forms;
  }

  const token = normalizeEventTypeToken(eventType);
  const nameToken = EVENT_TYPE_FORM_NAME_TOKENS[token] ?? null;

  const readyAndActive = forms.filter((form) => {
    const status = String(form.status || '');
    return status === 'Ready' || status === 'Active';
  });

  let auditForms = readyAndActive.filter((form) => {
    if (!form.formType) return true;
    return isAuditFormType(form.formType);
  });

  if (auditForms.length === 0 && readyAndActive.length > 0) {
    auditForms = readyAndActive;
  }

  if (nameToken) {
    const narrowed = auditForms.filter((form) => formMatchesNameToken(form, nameToken));
    if (narrowed.length > 0) {
      auditForms = narrowed;
    }
  }

  return auditForms.sort((a, b) => {
    if (a.status === 'Active' && b.status === 'Ready') return -1;
    if (a.status === 'Ready' && b.status === 'Active') return 1;
    return 0;
  });
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
