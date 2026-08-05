/**
 * ============================================================================
 * EVENT SETTINGS TYPES
 * ============================================================================
 * 
 * Formal type definitions for Event Settings architecture.
 * 
 * Event Settings is the SINGLE SOURCE OF TRUTH for:
 * - Which event types exist
 * - Which apps can create them
 * - Which fields are configurable
 * - Which behaviors are locked
 * 
 * ARCHITECTURAL INVARIANTS:
 * - Event Settings ≠ Event Scheduling
 * - Event Settings ≠ Execution
 * - Event Settings ≠ Permissions
 * 
 * See: docs/architecture/event-settings-doctrine.md
 * ============================================================================
 */

/**
 * App key type (uppercase canonical form)
 */
export type AppKey = 'AUDIT' | 'SALES' | 'PLATFORM' | 'HELPDESK' | 'PORTAL' | 'PROJECTS' | 'LMS' | 'CALENDAR';

/**
 * Execution mode for event types
 * 
 * - 'generic': Standard event execution (start → in progress → complete)
 * - 'audit-workflow': Audit-specific workflow (check-in → form → review → approval → closed)
 */
export type ExecutionMode = 'generic' | 'audit-workflow' | 'none';

/**
 * Event type key (internal identifier)
 * 
 * These are the canonical keys used in the system.
 * Display labels are configured separately.
 */
export type EventTypeKey = 
  | 'MEETING'
  | 'INTERNAL_AUDIT'
  | 'EXTERNAL_AUDIT_SINGLE'
  | 'EXTERNAL_AUDIT_BEAT'
  | 'FIELD_SALES_BEAT';

/**
 * Field key type (for editable and locked fields)
 */
export type EventFieldKey = string;

/**
 * Event Type Definition
 * 
 * Formal model for event type configuration in Event Settings.
 * This is the SINGLE SOURCE OF TRUTH for event type structure.
 */
export interface EventTypeDefinition {
  /**
   * Internal event type key (e.g., 'INTERNAL_AUDIT', 'MEETING')
   * This is the canonical identifier used in APIs and data models.
   */
  key: EventTypeKey;
  
  /**
   * Human-readable label (e.g., 'Internal Audit', 'Meeting')
   * This can be configured per tenant in Event Settings.
   */
  label: string;
  
  /**
   * App that owns this event type
   * 
   * OWNERSHIP RULES:
   * - Audit events are owned by AUDIT app
   * - Sales events are owned by SALES app
   * - Generic events are owned by PLATFORM app
   * 
   * The owning app controls the event type's behavior and required fields.
   */
  owningApp: AppKey;
  
  /**
   * Apps that can create this event type
   * 
   * CREATION RULES:
   * - Sales cannot create audit events (enforced at config level)
   * - Command palette must respect creatableFromApps
   * - Creation surfaces filter by creatableFromApps
   * 
   * Example:
   * - INTERNAL_AUDIT: creatableFromApps: ['AUDIT'] (only Audit app can create)
   * - MEETING: creatableFromApps: ['SALES', 'PLATFORM'] (multiple apps can create)
   */
  creatableFromApps: AppKey[];
  
  /**
   * Fields that can be configured in Event Settings
   * 
   * These are settings-level fields only (structure, visibility, requirements).
   * Execution fields, workflow fields, and system fields are NOT included.
   */
  editableFields: EventFieldKey[];
  
  /**
   * Fields that cannot be changed (locked by system or app ownership)
   * 
   * LOCKED FIELDS:
   * - Audit-required fields (geoRequired for audit events)
   * - System-controlled fields (status, auditState)
   * - Execution fields (checkIn, checkOut, timeSpent)
   * - Workflow fields (auditState transitions)
   * 
   * These fields are displayed for visibility but cannot be modified.
   */
  lockedFields: EventFieldKey[];
  
  /**
   * Execution mode determines how events of this type are executed
   * 
   * - 'none': Calendar / CRM meetings (join link, mark complete via status — no field execution)
   * - 'generic': Field execution (start → in progress → complete), e.g. Field Sales Beat
   * - 'audit-workflow': Audit workflow (check-in → form → review → approval → closed)
   * 
   * Execution behavior is NOT configurable in Event Settings.
   * This is a structural property that determines which execution surface is used.
   */
  executionMode: ExecutionMode;
  
  /**
   * Whether this event type is an audit event
   * 
   * Derived property for convenience, but explicitly encoded for clarity.
   */
  isAuditEvent: boolean;
  
  /**
   * Whether geo is required for this event type
   * 
   * LOCKED RULES:
   * - Audit events: geoRequired always true (cannot be disabled)
   * - Other events: geoRequired configurable in Event Settings
   */
  geoRequired: boolean;
  
  /**
   * Whether geo requirement can be toggled
   * 
   * - Audit events: false (geo always required)
   * - Other events: true (can be configured)
   */
  geoConfigurable: boolean;
  
  /**
   * Status configuration for intent-aware UI + lifecycle vocabulary.
   * Labels are category-backed (OPEN | DONE | CANCELLED).
   * See: docs/architecture/event-status-lifecycle.md
   */
  statusConfig?: {
    /** Status labels selectable for this event type */
    allowedStatuses?: string[];
    /** Default OPEN status label on create */
    defaultStatus?: string;
    /** Tenant may manage labels under categories (non-audit only) */
    statusVocabularyConfigurable?: boolean;
  };
}

/**
 * Event Settings Configuration
 * 
 * Complete configuration for Event Settings module.
 * This is the runtime configuration used by Event Settings UI.
 */
export interface EventSettingsConfig {
  /**
   * All event type definitions
   */
  eventTypes: EventTypeDefinition[];
  
  /**
   * Grouped event types by owning app
   * 
   * Used for UI organization in Event Settings.
   */
  eventTypesByApp: Record<AppKey, EventTypeDefinition[]>;
  
  /**
   * All apps that own event types
   */
  owningApps: AppKey[];
}

/**
 * Helper function to get event type definition by key
 */
export function getEventTypeDefinition(
  key: EventTypeKey,
  config: EventSettingsConfig
): EventTypeDefinition | null {
  return config.eventTypes.find(type => type.key === key) || null;
}

/**
 * Helper function to check if an app can create an event type
 */
export function canAppCreateEventType(
  appKey: AppKey,
  eventTypeKey: EventTypeKey,
  config: EventSettingsConfig
): boolean {
  const eventType = getEventTypeDefinition(eventTypeKey, config);
  if (!eventType) return false;
  
  return eventType.creatableFromApps.includes(appKey);
}

/**
 * Helper function to get all creatable event types for an app
 */
export function getCreatableEventTypesForApp(
  appKey: AppKey,
  config: EventSettingsConfig
): EventTypeDefinition[] {
  return config.eventTypes.filter(type => 
    type.creatableFromApps.includes(appKey)
  );
}
