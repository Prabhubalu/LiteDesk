/**
 * ============================================================================
 * INBOX EVENT DATA CONTRACT
 * ============================================================================
 * 
 * This type defines the STRICT data contract for Event items in Inbox UI.
 * 
 * IMPORTANT: This is a PROJECTION, not a model.
 * - Backend responses MUST be mapped to this shape before reaching the UI
 * - This type enforces the boundary between event system complexity and Inbox simplicity
 * - It prevents event management features from leaking into the attention surface
 * 
 * See docs/architecture/inbox-surface-invariants.md for the architectural
 * rules that this contract enforces.
 * 
 * ============================================================================
 */

/**
 * Event attention types
 * 
 * Indicates WHY this event requires attention in Inbox:
 * - 'start' = Event is starting soon or needs to be started (check-in, begin execution)
 * - 'review' = Event responses/submissions need review (auditor review, manager approval)
 * - 'corrective' = Corrective actions need attention (pending actions, overdue corrections)
 * - 'approval' = Event or related items need approval (workflow approval, final sign-off)
 * 
 * This is NOT the same as eventType or auditState. It's a projection of attention
 * signals that map to user actions in Inbox.
 */
export type EventAttentionType = 'start' | 'review' | 'corrective' | 'approval';

/**
 * Event type (from Event model)
 * 
 * The actual event type: 'Meeting', 'Internal Audit', 
 * 'External Audit — Single Org', 'External Audit Beat', 'Field Sales Beat'.
 * 
 * Used for context and filtering, but does not determine Inbox inclusion.
 */
export type EventType = 
  | 'Meeting'
  | 'Meeting / Appointment'
  | 'Internal Audit'
  | 'External Audit — Single Org'
  | 'External Audit Beat'
  | 'Field Sales Beat';

/**
 * Source application identifier
 * 
 * Indicates which app/module this event belongs to:
 * - 'Audit' = Audit App (audit events)
 * - 'Sales' = Sales App (field sales beats, meetings)
 * - 'Calendar' = Calendar/Events module (general appointments)
 * 
 * Used for visual grouping and navigation context.
 */
export type EventSourceApp = 'Audit' | 'Sales' | 'Calendar';

/**
 * Route target for Inbox navigation
 * 
 * Where clicking this Inbox item navigates. Format:
 * - '/audit/audits/:eventId' - Navigate to event detail in Audit App
 * - '/sales/events/:eventId' - Navigate to event detail in Sales App
 * - '/events/:eventId' - Navigate to event detail in Calendar/Events module
 * 
 * This is a navigation path, not an internal reference. Inbox items must
 * clearly communicate where they lead.
 */
export type RouteTarget = string;

/**
 * InboxEventItem
 * 
 * Represents an Event in Inbox without leaking event system complexity.
 * 
 * PURPOSE:
 * Inbox is an attention surface, not an event manager. This projection ensures
 * that Inbox items are scannable in under 3 seconds and clearly communicate:
 * - Why am I seeing this? (sourceApp, relatedLabel, organizationLabel, attentionType)
 * - What happens if I click it? (routeTarget)
 * - When do I need to act? (dueAt, isOverdue)
 * 
 * ============================================================================
 * WHY MOST EVENTS NEVER APPEAR IN INBOX
 * ============================================================================
 * 
 * Events are time-bound occurrences in the system, but most do NOT require
 * immediate user attention. Inbox only shows Events when:
 * 
 * 1. USER ACTION IS REQUIRED:
 *    - Event needs to be started (check-in, begin execution)
 *    - Event responses need review (auditor review, manager approval)
 *    - Corrective actions need attention (pending/overdue corrections)
 *    - Event or workflow needs approval (final sign-off)
 * 
 * 2. USER HAS A ROLE IN THE EVENT:
 *    - User is the auditor (must start/execute audit)
 *    - User is the reviewer (must review submissions)
 *    - User is the corrective owner (must address corrective actions)
 *    - User is the event owner (must manage event)
 * 
 * 3. EVENT IS TIME-RELEVANT:
 *    - Event is starting soon (within next 24 hours)
 *    - Event has a due date that is approaching or overdue
 *    - Corrective actions are due or overdue
 * 
 * EXCLUDED FROM INBOX:
 * - Events that are purely informational (no action required)
 * - Events where user has no role (not assigned, not involved)
 * - Events that are far in the future (not time-relevant)
 * - Completed events (status = 'Completed')
 * - Cancelled events (status = 'Cancelled')
 * - Events in 'Planned' status with no immediate action needed
 * 
 * The backend projection logic filters Events to only include those that
 * meet the above criteria. This ensures Inbox remains calm and focused
 * on actionable attention, not system noise.
 * 
 * ============================================================================
 * EVENTS VS TASKS IN INBOX
 * ============================================================================
 * 
 * CONCEPTUAL DISTINCTION:
 * 
 * Tasks = Explicit responsibility assigned to a user
 * - Created with a specific assignee
 * - Have clear completion criteria
 * - Are actionable work items
 * - Appear in Inbox when assigned to user
 * 
 * Events = Time-bound or system-triggered moments that MAY require attention
 * - Created as calendar/audit/sales events
 * - May or may not require user action
 * - Have workflow states (auditState, status)
 * - Appear in Inbox ONLY when action is required
 * 
 * KEY DIFFERENCES:
 * 
 * 1. ASSIGNMENT MODEL:
 *    - Tasks: Always assigned to a user (appear in their Inbox)
 *    - Events: May have multiple roles (auditor, reviewer, corrective owner)
 *              Only appear if user has an active role requiring action
 * 
 * 2. ATTENTION SIGNALS:
 *    - Tasks: Status-based (open, waiting, completed)
 *    - Events: Action-based (start, review, corrective, approval)
 * 
 * 3. TIME RELEVANCE:
 *    - Tasks: Due date determines urgency
 *    - Events: Start time AND due date determine relevance
 *              (must be starting soon OR have pending actions)
 * 
 * 4. WORKFLOW COMPLEXITY:
 *    - Tasks: Simple state machine (todo → in_progress → completed)
 *    - Events: Complex workflow (auditState transitions, form submissions,
 *              corrective actions, approvals)
 * 
 * 5. INBOX PRESENCE:
 *    - Tasks: Appear when assigned, disappear when completed
 *    - Events: Appear when action needed, disappear when action complete
 *              (may reappear if new action needed, e.g., corrective actions)
 * 
 * ============================================================================
 * INBOX SHOWS ATTENTION MOMENTS, NOT SYSTEM EVENTS
 * ============================================================================
 * 
 * Inbox is NOT an event log or activity feed. It shows attention-worthy
 * moments that require user action, not all system events.
 * 
 * ATTENTION MOMENTS:
 * - "You need to start this audit in 2 hours" (start)
 * - "Review 3 audit submissions" (review)
 * - "5 corrective actions are overdue" (corrective)
 * - "Approve this audit workflow" (approval)
 * 
 * NOT SYSTEM EVENTS:
 * - "Event created" (no action needed)
 * - "Event scheduled" (too far in future)
 * - "Event completed" (already done)
 * - "Event cancelled" (no action needed)
 * 
 * The projection logic transforms complex Event model data into simple
 * attention signals. It answers: "What do I need to do?" not "What happened?"
 * 
 * ============================================================================
 */
export interface InboxEventItem {
  /** Event ID (from Event._id or Event.eventId) */
  id: string;

  /** Event title/name (required for scannability) */
  title: string;

  /**
   * Event type
   * 
   * The actual event type from Event.eventType.
   * Used for context and filtering, but does not determine Inbox inclusion.
   */
  eventType: EventType;

  /**
   * Attention type
   * 
   * WHY this event requires attention:
   * - 'start' = Event needs to be started (check-in, begin execution)
   * - 'review' = Responses/submissions need review
   * - 'corrective' = Corrective actions need attention
   * - 'approval' = Event or workflow needs approval
   * 
   * This is the primary signal for Inbox. It determines:
   * - Visual treatment (icon, color)
   * - Urgency calculation
   * - Action context
   */
  attentionType: EventAttentionType;

  /**
   * Due date/time
   * 
   * When action is due:
   * - For 'start': Event start time (when check-in/execution must begin)
   * - For 'review': Review deadline (when review must be completed)
   * - For 'corrective': Corrective action due date (when corrections are due)
   * - For 'approval': Approval deadline (when approval must be given)
   * 
   * Used for urgency calculation and sorting.
   * Null if no specific due date (rare, but possible).
   */
  dueAt: Date | string | null;

  /**
   * Overdue flag
   * 
   * Computed: true if dueAt is in the past and action is not complete.
   * Used for visual emphasis and filtering.
   * 
   * Note: An event can be overdue even if it's not past its start time
   * (e.g., corrective actions due before event start).
   */
  isOverdue: boolean;

  /**
   * Source application
   * 
   * Human-readable app name ('Audit', 'Sales', 'Calendar').
   * Indicates which app/module this event belongs to.
   * Used for visual grouping and navigation context.
   */
  sourceApp: EventSourceApp;

  /**
   * Related entity label
   * 
   * Human-readable context string (e.g., "Audit · Acme Corp", 
   * "Sales Beat · Route 5", "Meeting · Q4 Planning").
   * 
   * Answers: "What is this event about?"
   * Used for quick context scanning.
   * 
   * Format: "{EventType} · {Organization/Entity Name}"
   */
  relatedLabel: string;

  /**
   * Organization label
   * 
   * Human-readable organization name.
   * Answers: "Which organization does this relate to?"
   * Used for context and filtering.
   */
  organizationLabel: string;

  /**
   * Route target
   * 
   * Navigation path where clicking this Inbox item leads.
   * Format: '/audit/audits/:eventId' or '/events/:eventId'
   * 
   * This is a navigation path, not an internal reference.
   * Inbox items must clearly communicate where they lead.
   */
  routeTarget: RouteTarget;

  /**
   * Last updated timestamp
   * 
   * Used for sorting and freshness indication.
   * ISO date string or Date object.
   * 
   * Note: This is the Event.modifiedTime, not the attention moment timestamp.
   * For attention moments, freshness is determined by dueAt, not updatedAt.
   */
  updatedAt: Date | string;
}

/**
 * ============================================================================
 * EXPLICIT EXCLUSIONS
 * ============================================================================
 * 
 * The following fields are EXPLICITLY EXCLUDED from InboxEventItem because
 * they belong to event management, not the attention surface:
 * 
 * EXCLUDED FIELDS:
 * 
 * - description/notes: Full event description (too dense for Inbox scanning)
 *   WHY: Inbox items must be scannable in under 3 seconds. Description belongs
 *        in the full event view, not the attention surface.
 * 
 * - startDateTime/endDateTime: Full event timing (event management detail)
 *   WHY: Inbox focuses on dueAt (urgency), not full event schedule. Full
 *        timing belongs in event detail view.
 * 
 * - location: Event location (event management detail)
 *   WHY: Location is not an attention signal. It belongs in event detail view.
 * 
 * - geoLocation/geoRequired: GEO tracking (event execution detail)
 *   WHY: GEO tracking is an execution concern, not an attention signal. Inbox
 *        shows "what needs action," not "how to execute."
 * 
 * - checkIn/checkOut: Check-in/check-out tracking (event execution detail)
 *   WHY: Check-in/check-out is execution state, not attention signal. Inbox
 *        shows attention moments, not execution tracking.
 * 
 * - auditState: Audit workflow state (event workflow detail)
 *   WHY: auditState is complex workflow state. Inbox shows attentionType
 *        (simple action signal), not auditState (complex workflow state).
 * 
 * - status: Event status (event management state)
 *   WHY: Status is event management state. Inbox shows attentionType
 *        (action signal), not status (management state).
 * 
 * - auditorId/reviewerId/correctiveOwnerId: Role assignments (event assignment detail)
 *   WHY: Inbox is user-scoped. If an event appears in a user's Inbox, they
 *        already have a role. No need to show assignment details.
 * 
 * - linkedFormId: Form reference (event-form linking detail)
 *   WHY: Form linking is an event management detail, not an attention signal.
 *        The attention signal (review, corrective) already indicates form context.
 * 
 * - formAssignment: Form assignment details (event assignment detail)
 *   WHY: Form assignment is an event management detail. Inbox shows attention
 *        moments, not assignment details.
 * 
 * - orgList/routeSequence: Multi-org route details (event execution detail)
 *   WHY: Route details are execution concerns, not attention signals. Inbox
 *        shows "what needs action," not "how to execute the route."
 * 
 * - attachments: Event attachments (event content detail)
 *   WHY: Attachments are event content, not attention signals. They belong in
 *        event detail view, not Inbox.
 * 
 * - metadata: Event metadata (event system detail)
 *   WHY: Metadata is system-level detail, not an attention signal. Inbox
 *        focuses on user-facing attention, not system metadata.
 * 
 * - executionStartTime/executionEndTime/timeSpent: Execution tracking (event execution detail)
 *   WHY: Execution tracking is a performance/metric concern, not an attention
 *        signal. Inbox shows "what needs action," not "how long it took."
 * 
 * - isPaused/pauseReasons: Pause tracking (event execution detail)
 *   WHY: Pause state is execution detail, not an attention signal. Inbox
 *        shows attention moments, not execution state.
 * 
 * - kpiTargets/kpiActuals: KPI tracking (event metric detail)
 *   WHY: KPIs are performance metrics, not attention signals. Inbox shows
 *        "what needs action," not "how are we performing."
 * 
 * - allowedActions: Allowed actions (event configuration detail)
 *   WHY: Action configuration is event setup detail, not an attention signal.
 *        Inbox shows attention moments, not configuration.
 * 
 * - visibility: Visibility setting (event configuration detail)
 *   WHY: Visibility is event configuration, not an attention signal. Inbox
 *        is user-scoped, so visibility is already enforced.
 * 
 * - recurrence: Recurrence pattern (event scheduling detail)
 *   WHY: Recurrence is scheduling detail, not an attention signal. Inbox
 *        shows individual attention moments, not recurrence patterns.
 * 
 * - auditHistory: Audit history (event history detail)
 *   WHY: History is not an attention signal. Inbox shows current attention
 *        needs, not historical changes.
 * 
 * - createdBy/modifiedBy: Creator/modifier references (system fields)
 *   WHY: Creation/modification metadata is not relevant for attention scanning.
 *        Inbox focuses on current attention needs, not historical creation.
 * 
 * - createdTime: Creation timestamp (system field)
 *   WHY: Inbox prioritizes updatedAt (freshness) and dueAt (urgency) over
 *        createdAt (age). Age is not a useful attention signal.
 * 
 * - organizationId: Internal organization reference (project internals)
 *   WHY: Inbox shows human-readable context (organizationLabel), not internal IDs.
 *        Navigation uses organizationLabel, not organizationId.
 * 
 * - relatedToId: Internal organization reference (project internals)
 *   WHY: Inbox shows human-readable context (relatedLabel), not internal IDs.
 *        Navigation uses relatedLabel, not relatedToId.
 * 
 * These exclusions ensure that InboxEventItem remains a lightweight projection
 * focused on attention signals, not event management complexity. Full event
 * editing and management happens in the owning surface (Audit App, Sales App,
 * Calendar/Events module), not in Inbox.
 * 
 * ============================================================================
 */
