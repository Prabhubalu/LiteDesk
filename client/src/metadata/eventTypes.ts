/**
 * ============================================================================
 * Canonical Event Type Metadata
 * ============================================================================
 * 
 * Single source of truth for event type definitions.
 * 
 * This metadata defines:
 * - Event type keys (used in API/projection: MEETING, INTERNAL_AUDIT, etc.)
 * - Human-readable labels (shown in UI: "Meeting", "Internal Audit", etc.)
 * - App associations (which apps can use each type)
 * - Audit classification (whether the type is an audit event)
 * 
 * ARCHITECTURE NOTE:
 * - UI components MUST use { key, label } pairs, never raw strings
 * - Backend receives the key (e.g., "MEETING")
 * - UI displays the label (e.g., "Meeting")
 * - Filtering by app uses metadata.apps array, not string matching
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Event Settings ≠ Event Scheduling
 * - Event Settings ≠ Execution
 * - Event Settings ≠ Permissions
 * 
 * See: docs/architecture/event-settings-doctrine.md
 * See: docs/architecture/event-settings.md
 * ============================================================================
 */

import type { EventTypeDefinition, EventSettingsConfig, AppKey } from '@/types/eventSettings.types';

/**
 * Canonical Event Type Definitions
 * 
 * These are the SINGLE SOURCE OF TRUTH for event type structure.
 * Event Settings UI uses these definitions to configure event types.
 */
export const EVENT_TYPE_DEFINITIONS: EventTypeDefinition[] = [
  {
    key: 'MEETING',
    label: 'Meeting',
    owningApp: 'PLATFORM',
    creatableFromApps: ['SALES', 'PLATFORM', 'CALENDAR'],
    editableFields: [
      'eventName',
      'startDateTime',
      'endDateTime',
      'location',
      'notes',
      'relatedToId',
      'recurrence'
    ],
    lockedFields: [
      'status',
      'assignedTo',
      'eventId',
      '_id',
      'organizationId',
      'createdTime',
      'modifiedTime',
      'createdBy',
      'modifiedBy'
    ],
    executionMode: 'generic',
    isAuditEvent: false,
    geoRequired: false,
    geoConfigurable: true,
    statusConfig: {
      allowedStatuses: ['Planned', 'Completed', 'Cancelled'],
      defaultStatus: 'Planned'
    }
  },
  {
    key: 'INTERNAL_AUDIT',
    label: 'Internal Audit',
    owningApp: 'AUDIT',
    creatableFromApps: ['AUDIT'],
    editableFields: [
      'eventName',
      'startDateTime',
      'endDateTime',
      'location',
      'notes',
      'relatedToId',
      'auditorId',
      'correctiveOwnerId',
      'linkedFormId',
      'allowSelfReview',
      'minVisitDuration'
    ],
    lockedFields: [
      'status',
      'auditState',
      'geoRequired', // Always true for audit events
      'assignedTo',
      'eventId',
      '_id',
      'organizationId',
      'createdTime',
      'modifiedTime',
      'createdBy',
      'modifiedBy',
      'checkIn',
      'checkOut',
      'timeSpent',
      'auditHistory'
    ],
    executionMode: 'audit-workflow',
    isAuditEvent: true,
    geoRequired: true,
    geoConfigurable: false, // Locked: audit events always require geo
    statusConfig: {
      allowedStatuses: ['Planned', 'Completed', 'Cancelled'],
      defaultStatus: 'Planned'
    }
  },
  {
    key: 'EXTERNAL_AUDIT_SINGLE',
    label: 'External Audit — Single Org',
    owningApp: 'AUDIT',
    creatableFromApps: ['AUDIT'],
    editableFields: [
      'eventName',
      'startDateTime',
      'endDateTime',
      'location',
      'notes',
      'relatedToId',
      'auditorId',
      'reviewerId',
      'correctiveOwnerId',
      'linkedFormId',
      'allowSelfReview',
      'minVisitDuration',
      'partnerVisibility'
    ],
    lockedFields: [
      'status',
      'auditState',
      'geoRequired', // Always true for audit events
      'assignedTo',
      'eventId',
      '_id',
      'organizationId',
      'createdTime',
      'modifiedTime',
      'createdBy',
      'modifiedBy',
      'checkIn',
      'checkOut',
      'timeSpent',
      'auditHistory'
    ],
    executionMode: 'audit-workflow',
    isAuditEvent: true,
    geoRequired: true,
    geoConfigurable: false, // Locked: audit events always require geo
    statusConfig: {
      allowedStatuses: ['Planned', 'Completed', 'Cancelled'],
      defaultStatus: 'Planned'
    }
  },
  {
    key: 'EXTERNAL_AUDIT_BEAT',
    label: 'External Audit Beat',
    owningApp: 'AUDIT',
    creatableFromApps: ['AUDIT'],
    editableFields: [
      'eventName',
      'startDateTime',
      'endDateTime',
      'location',
      'notes',
      'auditorId',
      'correctiveOwnerId',
      'linkedFormId',
      'minVisitDuration',
      'backgroundTracking',
      'partnerVisibility'
    ],
    lockedFields: [
      'status',
      'auditState',
      'geoRequired', // Always true for audit events
      'isMultiOrg', // Automatically set to true
      'orgList',
      'routeSequence',
      'currentOrgIndex',
      'assignedTo',
      'eventId',
      '_id',
      'organizationId',
      'createdTime',
      'modifiedTime',
      'createdBy',
      'modifiedBy',
      'checkIn',
      'checkOut',
      'timeSpent',
      'auditHistory'
    ],
    executionMode: 'audit-workflow',
    isAuditEvent: true,
    geoRequired: true,
    geoConfigurable: false, // Locked: audit events always require geo
    statusConfig: {
      allowedStatuses: ['Planned', 'Completed', 'Cancelled'],
      defaultStatus: 'Planned'
    }
  },
  {
    key: 'FIELD_SALES_BEAT',
    label: 'Field Sales Beat',
    owningApp: 'SALES',
    creatableFromApps: ['SALES'],
    editableFields: [
      'eventName',
      'startDateTime',
      'endDateTime',
      'location',
      'notes',
      'relatedToId',
      'allowedActions',
      'kpiTargets'
    ],
    lockedFields: [
      'status',
      'isMultiOrg', // Automatically set to true
      'orgList',
      'routeSequence',
      'currentOrgIndex',
      'kpiActuals', // Read-only, computed from execution
      'assignedTo',
      'eventId',
      '_id',
      'organizationId',
      'createdTime',
      'modifiedTime',
      'createdBy',
      'modifiedBy',
      'checkIn',
      'checkOut',
      'timeSpent'
    ],
    executionMode: 'generic',
    isAuditEvent: false,
    geoRequired: true,
    geoConfigurable: true, // Can be disabled for Field Sales Beat
    statusConfig: {
      allowedStatuses: ['Planned', 'Completed', 'Cancelled'],
      defaultStatus: 'Planned'
    }
  }
];

/**
 * Legacy EVENT_TYPES object for backward compatibility
 * 
 * @deprecated Use EVENT_TYPE_DEFINITIONS instead
 * This is kept for backward compatibility during migration.
 */
export const EVENT_TYPES = {
  MEETING: {
    key: 'MEETING',
    label: 'Meeting',
    apps: ['SALES', 'CALENDAR'],
    audit: false
  },

  INTERNAL_AUDIT: {
    key: 'INTERNAL_AUDIT',
    label: 'Internal Audit',
    apps: ['AUDIT'],
    audit: true
  },

  EXTERNAL_AUDIT_SINGLE: {
    key: 'EXTERNAL_AUDIT_SINGLE',
    label: 'External Audit — Single Org',
    apps: ['AUDIT'],
    audit: true
  },

  EXTERNAL_AUDIT_BEAT: {
    key: 'EXTERNAL_AUDIT_BEAT',
    label: 'External Audit Beat',
    apps: ['AUDIT'],
    audit: true
  },

  FIELD_SALES_BEAT: {
    key: 'FIELD_SALES_BEAT',
    label: 'Field Sales Beat',
    apps: ['SALES'],
    audit: false
  }
} as const;

/**
 * Get Event Settings Configuration
 * 
 * Builds the complete EventSettingsConfig from canonical definitions.
 * This is used by Event Settings UI to display and configure event types.
 */
export function getEventSettingsConfig(): EventSettingsConfig {
  const eventTypesByApp: Record<AppKey, EventTypeDefinition[]> = {
    AUDIT: [],
    SALES: [],
    PLATFORM: [],
    HELPDESK: [],
    PORTAL: [],
    PROJECTS: [],
    LMS: [],
    CALENDAR: []
  };
  
  // Group event types by owning app
  EVENT_TYPE_DEFINITIONS.forEach(eventType => {
    const app = eventType.owningApp;
    if (!eventTypesByApp[app]) {
      eventTypesByApp[app] = [];
    }
    eventTypesByApp[app].push(eventType);
  });
  
  // Get unique owning apps
  const owningApps = Array.from(new Set(
    EVENT_TYPE_DEFINITIONS.map(type => type.owningApp)
  )) as AppKey[];
  
  return {
    eventTypes: EVENT_TYPE_DEFINITIONS,
    eventTypesByApp,
    owningApps
  };
}

/**
 * Get event type definition by key
 */
export function getEventTypeDefinitionByKey(key: string): EventTypeDefinition | null {
  return EVENT_TYPE_DEFINITIONS.find(type => type.key === key) || null;
}

/**
 * Get event type by key (legacy function for backward compatibility)
 * 
 * @deprecated Use getEventTypeDefinitionByKey instead
 */
export function getEventTypeByKey(key: string) {
  const definition = getEventTypeDefinitionByKey(key);
  if (definition) {
    return {
      key: definition.key,
      label: definition.label,
      apps: definition.creatableFromApps,
      audit: definition.isAuditEvent
    };
  }
  return Object.values(EVENT_TYPES).find(type => type.key === key) || null;
}

/**
 * Get event type by label (for backward compatibility during migration)
 */
export function getEventTypeByLabel(label: string) {
  const normalizedLabel = String(label || '').trim();
  const aliasLabel = normalizedLabel === 'Meeting / Appointment' ? 'Meeting' : normalizedLabel;
  const definition = EVENT_TYPE_DEFINITIONS.find(type => type.label === normalizedLabel);
  const definitionFromAlias = EVENT_TYPE_DEFINITIONS.find(type => type.label === aliasLabel);
  const resolved = definition ?? definitionFromAlias;
  if (resolved) {
    return {
      key: resolved.key,
      label: resolved.label,
      apps: resolved.creatableFromApps,
      audit: resolved.isAuditEvent
    };
  }
  return (
    Object.values(EVENT_TYPES).find(type => type.label === normalizedLabel) ||
    Object.values(EVENT_TYPES).find(type => type.label === aliasLabel) ||
    null
  );
}

/**
 * Get all event types allowed for an app
 */
export function getEventTypesForApp(appKey: string, excludeAudit: boolean = false) {
  const normalizedAppKey = appKey.toUpperCase() as AppKey;
  const config = getEventSettingsConfig();
  
  return config.eventTypes.filter(type => {
    const isAllowed = type.creatableFromApps.includes(normalizedAppKey);
    const isExcluded = excludeAudit && type.isAuditEvent;
    return isAllowed && !isExcluded;
  });
}

/**
 * Get all audit event types
 */
export function getAuditEventTypes(): EventTypeDefinition[] {
  return EVENT_TYPE_DEFINITIONS.filter(type => type.isAuditEvent);
}

/**
 * Check if an event type key is an audit event
 */
export function isAuditEventTypeKey(key: string): boolean {
  const eventType = getEventTypeDefinitionByKey(key);
  return eventType ? eventType.isAuditEvent : false;
}

/**
 * Check if an event type label is an audit event (for backward compatibility)
 */
export function isAuditEventTypeLabel(label: string): boolean {
  const eventType = EVENT_TYPE_DEFINITIONS.find(type => type.label === label);
  return eventType ? eventType.isAuditEvent : false;
}

/**
 * DEV-ONLY INVARIANT GUARD: Assert execution mode matches event type
 * 
 * This ensures that audit events use audit-workflow and non-audit events use generic.
 */
if (process.env.NODE_ENV === 'development') {
  EVENT_TYPE_DEFINITIONS.forEach(eventType => {
    const expectedMode: 'generic' | 'audit-workflow' = eventType.isAuditEvent ? 'audit-workflow' : 'generic';
    console.assert(
      eventType.executionMode === expectedMode,
      `[eventTypes] INVARIANT VIOLATION: Event type ${eventType.key} has mismatched execution mode`,
      {
        eventType: eventType.key,
        isAuditEvent: eventType.isAuditEvent,
        executionMode: eventType.executionMode,
        expectedMode
      }
    );
    
    // Assert: Audit events are owned by AUDIT app
    if (eventType.isAuditEvent) {
      console.assert(
        eventType.owningApp === 'AUDIT',
        `[eventTypes] INVARIANT VIOLATION: Audit event ${eventType.key} must be owned by AUDIT app`,
        { eventType: eventType.key, owningApp: eventType.owningApp }
      );
    }
    
    // Assert: Sales cannot create audit events
    if (eventType.isAuditEvent) {
      console.assert(
        !eventType.creatableFromApps.includes('SALES'),
        `[eventTypes] INVARIANT VIOLATION: Sales cannot create audit events`,
        { eventType: eventType.key, creatableFromApps: eventType.creatableFromApps }
      );
    }
    
    // Assert: Audit events always require geo
    if (eventType.isAuditEvent) {
      console.assert(
        eventType.geoRequired === true && eventType.geoConfigurable === false,
        `[eventTypes] INVARIANT VIOLATION: Audit events must always require geo and cannot be configured`,
        { eventType: eventType.key, geoRequired: eventType.geoRequired, geoConfigurable: eventType.geoConfigurable }
      );
    }
  });
}
