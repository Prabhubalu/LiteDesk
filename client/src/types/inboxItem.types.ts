/**
 * ============================================================================
 * UNIFIED INBOX ITEM DATA CONTRACT
 * ============================================================================
 * 
 * This type defines the STRICT data contract for ALL items in Inbox UI.
 * 
 * IMPORTANT: This is a PROJECTION, not a model.
 * - Backend responses MUST be mapped to this shape before reaching the UI
 * - This type enforces the boundary between domain complexity and Inbox simplicity
 * - It prevents task/event management features from leaking into the attention surface
 * 
 * See docs/architecture/inbox-surface-invariants.md for the architectural
 * rules that this contract enforces.
 * 
 * ============================================================================
 */

/**
 * Item kind discriminator
 * 
 * Used for TypeScript discriminated union to enable type-safe branching.
 * - 'task' = Task item (explicit responsibility assigned to user)
 * - 'event' = Event item (time-bound moment requiring attention)
 */
export type InboxItemKind = 'task' | 'event';

/**
 * Source application identifier
 * 
 * Indicates which app/module this item belongs to.
 * Examples: 'Sales', 'Projects', 'Helpdesk', 'Audit', 'Calendar'
 * 
 * Used for visual grouping and navigation context.
 */
export type SourceApp = string;

/**
 * Route target for Inbox navigation
 * 
 * Where clicking this Inbox item navigates. Format:
 * - '/sales/tasks/:taskId' - Navigate to task detail in Sales App
 * - '/audit/audits/:eventId' - Navigate to event detail in Audit App
 * - '/events/:eventId' - Navigate to event detail in Calendar/Events module
 * 
 * This is a navigation path, not an internal reference. Inbox items must
 * clearly communicate where they lead.
 */
export type RouteTarget = string;

/**
 * Complete action hint
 * 
 * For tasks that can be completed directly from Inbox, this provides
 * the route or API endpoint to complete the task.
 * 
 * Format:
 * - Route: '/api/tasks/:taskId/complete' (for API completion)
 * - Or: '/sales/tasks/:taskId' (for navigation to completion UI)
 * 
 * Only present when allowComplete is true (tasks only).
 */
export type CompleteAction = string;

/**
 * Event attention type (for event items only)
 * 
 * Indicates WHY this event requires attention:
 * - 'start' = Event needs to be started (check-in, begin execution)
 * - 'review' = Responses/submissions need review (auditor review, manager approval)
 * - 'corrective' = Corrective actions need attention (pending actions, overdue corrections)
 * - 'approval' = Event or workflow needs approval (workflow approval, final sign-off)
 */
export type EventAttentionType = 'start' | 'review' | 'corrective' | 'approval';

/**
 * ============================================================================
 * WHY INBOXITEM EXISTS
 * ============================================================================
 * 
 * InboxItem exists to create a unified, coherent attention surface that treats
 * Tasks and Events as equals in the user's attention queue.
 * 
 * PROBLEM IT SOLVES:
 * 
 * Without InboxItem, Inbox UI would need to:
 * - Maintain separate lists for Tasks and Events
 * - Branch on entity type throughout the UI
 * - Handle different data shapes and field names
 * - Create separate sorting/filtering logic
 * - Build separate UI components for each type
 * 
 * This creates fragmentation and cognitive load. Users see:
 * - "My Tasks" (separate list)
 * - "My Events" (separate list)
 * - Different UIs, different interactions, different mental models
 * 
 * SOLUTION:
 * 
 * InboxItem unifies Tasks and Events into a single attention list where:
 * - All items share the same shape (common fields)
 * - All items answer the same questions (why, what, when)
 * - All items feel coherent in one list
 * - UI can treat them uniformly (sorting, filtering, display)
 * - Type differences are handled via discriminated union (type-safe branching)
 * 
 * RESULT:
 * 
 * Users see ONE unified Inbox that answers: "What do I need to act on now?"
 * They don't need to think about whether something is a Task or Event.
 * They just see attention-worthy work that needs action.
 * 
 * ============================================================================
 * WHY TASK/EVENT COMPLEXITY IS HIDDEN
 * ============================================================================
 * 
 * Tasks and Events are complex domain models with many fields, relationships,
 * and business logic. InboxItem hides this complexity by:
 * 
 * 1. PROJECTION, NOT MODELS:
 *    - InboxItem is a projection of Task/Event models
 *    - Only attention-relevant fields are included
 *    - Domain complexity stays in domain models
 * 
 * 2. UNIFIED FIELD NAMES:
 *    - Tasks have 'dueDate', Events have 'dueAt' → InboxItem uses 'dueAt'
 *    - Tasks have 'status', Events have 'attentionType' → InboxItem uses 'attentionLabel'
 *    - Field name differences are normalized at projection time
 * 
 * 3. HUMAN-READABLE LABELS:
 *    - Instead of raw status codes, InboxItem provides 'attentionLabel'
 *    - Examples: "Due today", "Needs review", "Overdue", "Starts in 2 hours"
 *    - UI doesn't need to interpret status codes or attention types
 * 
 * 4. TYPE-SPECIFIC FIELDS ARE OPTIONAL:
 *    - Task-specific fields (completeAction) only exist when kind='task'
 *    - Event-specific fields (eventAttentionType) only exist when kind='event'
 *    - Common fields are always present
 * 
 * 5. COMPLETION MODEL IS UNIFIED:
 *    - Tasks: allowComplete=true, completeAction provided
 *    - Events: allowComplete=false (events don't "complete" in Inbox)
 *    - UI can check allowComplete without branching on kind
 * 
 * BENEFITS:
 * 
 * - Inbox UI code is simpler (no branching on entity type)
 * - Users see consistent experience (same fields, same interactions)
 * - Domain complexity doesn't leak into UI
 * - New item types can be added without changing Inbox UI
 * 
 * ============================================================================
 * UX PHILOSOPHY OF A SINGLE ATTENTION LIST
 * ============================================================================
 * 
 * Inbox is NOT a task manager or event calendar. It's an attention surface
 * that shows work requiring user action, regardless of whether that work
 * is a Task, Event, or future entity type.
 * 
 * CORE PRINCIPLES:
 * 
 * 1. ATTENTION-FIRST, NOT ENTITY-FIRST:
 *    - Users think: "What do I need to do?" not "What tasks do I have?"
 *    - Inbox shows attention moments, not entity lists
 *    - Tasks and Events are just different sources of attention
 * 
 * 2. TIME & URGENCY FIRST:
 *    - Items are sorted by urgency (overdue → due today → due soon)
 *    - Time relevance is the primary signal
 *    - Entity type is secondary (shown via sourceApp badge)
 * 
 * 3. COHERENT EXPERIENCE:
 *    - All items have the same visual treatment
 *    - All items answer the same questions (why, what, when)
 *    - All items use the same interaction patterns
 *    - Differences are subtle (icon, badge, completion action)
 * 
 * 4. SCANNABLE IN UNDER 3 SECONDS:
 *    - Each item shows: title, attentionLabel, dueAt, sourceApp
 *    - No dense information, no complex state machines
 *    - Human-readable labels, not system codes
 * 
 * 5. ACTION-ORIENTED:
 *    - Every item has a clear action (click to navigate, complete if allowed)
 *    - Completion is available for tasks, not events
 *    - Events require navigation to owning surface for action
 * 
 * WHAT THIS MEANS FOR USERS:
 * 
 * - They see ONE list of work, not multiple lists
 * - They don't need to switch contexts (Tasks vs Events)
 * - They can scan quickly and understand what needs action
 * - They can complete tasks directly or navigate to events
 * - The experience feels unified and coherent
 * 
 * WHAT THIS MEANS FOR DEVELOPERS:
 * 
 * - Inbox UI only needs to handle InboxItem, not Task/Event models
 * - Sorting/filtering logic is unified (works for all items)
 * - UI components are reusable (same component for all items)
 * - Type safety via discriminated union (kind field enables type-safe branching)
 * - New item types can be added without changing Inbox UI
 * 
 * ============================================================================
 */

/**
 * Common fields shared by all Inbox items
 */
interface InboxItemBase {
  /**
   * Item kind discriminator
   * 
   * Used for TypeScript discriminated union to enable type-safe branching.
   * - 'task' = Task item
   * - 'event' = Event item
   */
  kind: InboxItemKind;

  /**
   * Item ID
   * 
   * Unique identifier for this item.
   * For tasks: Task._id or Task.taskId
   * For events: Event._id or Event.eventId
   */
  id: string;

  /**
   * Item title
   * 
   * Human-readable title/name.
   * For tasks: Task.title
   * For events: Event.eventName
   * 
   * Required for scannability. Must be concise and action-oriented.
   */
  title: string;

  /**
   * Attention label
   * 
   * Human-readable attention signal that answers "Why am I seeing this?"
   * 
   * Examples:
   * - "Due today"
   * - "Due in 2 hours"
   * - "Overdue"
   * - "Needs review"
   * - "Starts in 1 hour"
   * - "5 corrective actions pending"
   * - "Awaiting approval"
   * 
   * This is computed from:
   * - Task: status + dueDate + isOverdue
   * - Event: attentionType + dueAt + isOverdue
   * 
   * UI should display this prominently as the primary attention signal.
   */
  attentionLabel: string;

  /**
   * Due date/time
   * 
   * When action is due or when attention is needed.
   * 
   * For tasks: Task.dueDate (when task must be completed)
   * For events: Event.dueAt (when event starts or action is due)
   * 
   * Used for urgency calculation and sorting.
   * Null if no specific due date.
   */
  dueAt: Date | string | null;

  /**
   * Overdue flag
   * 
   * Computed: true if dueAt is in the past and action is not complete.
   * Used for visual emphasis and filtering.
   * 
   * For tasks: dueDate < now && status !== 'completed'
   * For events: dueAt < now && action not complete
   */
  isOverdue: boolean;

  /**
   * Source application
   * 
   * Human-readable app name (e.g., 'Sales', 'Projects', 'Helpdesk', 'Audit', 'Calendar').
   * Indicates which app/module this item belongs to.
   * Used for visual grouping and navigation context.
   */
  sourceApp: SourceApp;

  /**
   * Related entity label
   * 
   * Human-readable context string (e.g., "Deal · Acme", "Audit · Acme Corp",
   * "Ticket #1234", "Project · Q4 Launch").
   * 
   * Answers: "What is this about?"
   * Used for quick context scanning.
   * 
   * Format: "{EntityType} · {EntityName}" or "{EntityType} #{Id}"
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
   * Format: '/sales/tasks/:taskId' or '/audit/audits/:eventId' or '/events/:eventId'
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
   * For tasks: Task.modifiedTime
   * For events: Event.modifiedTime
   */
  updatedAt: Date | string;
}

/**
 * Task-specific Inbox item
 * 
 * Represents a Task in Inbox.
 * Tasks can be completed directly from Inbox.
 */
export interface InboxTaskItem extends InboxItemBase {
  kind: 'task';

  /**
   * Allow completion
   * 
   * Always true for tasks. Tasks can be completed directly from Inbox.
   */
  allowComplete: true;

  /**
   * Complete action
   * 
   * Route or API endpoint to complete this task.
   * Format: '/api/tasks/:taskId/complete' or '/sales/tasks/:taskId'
   * 
   * Used when user clicks "Complete" button in Inbox.
   * If route, navigates to completion UI. If API endpoint, calls API directly.
   */
  completeAction: CompleteAction;
}

/**
 * Event-specific Inbox item
 * 
 * Represents an Event in Inbox.
 * Events cannot be completed directly from Inbox (they require navigation).
 */
export interface InboxEventItem extends InboxItemBase {
  kind: 'event';

  /**
   * Allow completion
   * 
   * Always false for events. Events don't "complete" in Inbox.
   * Users must navigate to event detail to take action.
   */
  allowComplete: false;

  /**
   * Event attention type
   * 
   * WHY this event requires attention:
   * - 'start' = Event needs to be started (check-in, begin execution)
   * - 'review' = Responses/submissions need review
   * - 'corrective' = Corrective actions need attention
   * - 'approval' = Event or workflow needs approval
   * 
   * Used for:
   * - Visual treatment (icon, color)
   * - Generating attentionLabel
   * - Determining urgency
   */
  eventAttentionType: EventAttentionType;
}

/**
 * Unified Inbox item type
 * 
 * Discriminated union of Task and Event items.
 * 
 * This is the ONLY type used by Inbox UI. Inbox UI must NOT branch on
 * raw Task or Event models. All domain complexity is hidden behind this
 * unified projection.
 * 
 * USAGE:
 * 
 * ```typescript
 * function renderInboxItem(item: InboxItem) {
 *   // Common fields available for all items
 *   const { title, attentionLabel, dueAt, isOverdue, sourceApp } = item;
 * 
 *   // Type-safe branching on kind
 *   if (item.kind === 'task') {
 *     // TypeScript knows item is InboxTaskItem here
 *     if (item.allowComplete) {
 *       // Show complete button with item.completeAction
 *     }
 *   } else {
 *     // TypeScript knows item is InboxEventItem here
 *     // Show event-specific UI with item.eventAttentionType
 *   }
 * }
 * ```
 * 
 * SORTING:
 * 
 * Items should be sorted by:
 * 1. isOverdue (overdue first)
 * 2. dueAt (earliest first)
 * 3. updatedAt (most recent first)
 * 
 * This ensures time & urgency first, per inbox-surface-invariants.md.
 */
export type InboxItem = InboxTaskItem | InboxEventItem;

/**
 * ============================================================================
 * TYPE GUARDS
 * ============================================================================
 */

/**
 * Type guard to check if item is a task
 */
export function isTaskItem(item: InboxItem): item is InboxTaskItem {
  return item.kind === 'task';
}

/**
 * Type guard to check if item is an event
 */
export function isEventItem(item: InboxItem): item is InboxEventItem {
  return item.kind === 'event';
}

/**
 * ============================================================================
 * EXPLICIT EXCLUSIONS
 * ============================================================================
 * 
 * The following fields are EXPLICITLY EXCLUDED from InboxItem because
 * they belong to domain management, not the attention surface:
 * 
 * EXCLUDED FIELDS:
 * 
 * TASK-SPECIFIC EXCLUSIONS:
 * - description: Full task description (too dense for Inbox scanning)
 * - subtasks: Subtask checklist (task management complexity)
 * - estimatedHours/actualHours: Time tracking (task management feature)
 * - completionPercentage: Completion tracking (task management metric)
 * - projectId: Internal project reference (project internals)
 * - relatedTo.id/type: Internal entity references (project internals)
 * - assignedTo/assignedBy: Assignment details (not relevant for attention)
 * - createdBy/createdAt: Creation metadata (not relevant for attention)
 * - startDate: Start date (task management timeline)
 * - completedDate: Completion timestamp (task management tracking)
 * - tags: Task tags (task management organization)
 * - reminderDate/reminderSent: Reminder scheduling (task management feature)
 * - organizationId: Internal organization reference (project internals)
 * 
 * EVENT-SPECIFIC EXCLUSIONS:
 * - description/notes: Full event description (too dense for Inbox scanning)
 * - startDateTime/endDateTime: Full event timing (event management detail)
 * - location: Event location (event management detail)
 * - geoLocation/geoRequired: GEO tracking (event execution detail)
 * - checkIn/checkOut: Check-in/check-out tracking (event execution detail)
 * - auditState: Audit workflow state (event workflow detail)
 * - status: Event status (event management state)
 * - auditorId/reviewerId/correctiveOwnerId: Role assignments (event assignment detail)
 * - linkedFormId: Form reference (event-form linking detail)
 * - formAssignment: Form assignment details (event assignment detail)
 * - orgList/routeSequence: Multi-org route details (event execution detail)
 * - attachments: Event attachments (event content detail)
 * - metadata: Event metadata (event system detail)
 * - executionStartTime/executionEndTime/timeSpent: Execution tracking (event execution detail)
 * - isPaused/pauseReasons: Pause tracking (event execution detail)
 * - kpiTargets/kpiActuals: KPI tracking (event metric detail)
 * - allowedActions: Allowed actions (event configuration detail)
 * - visibility: Visibility setting (event configuration detail)
 * - recurrence: Recurrence pattern (event scheduling detail)
 * - auditHistory: Audit history (event history detail)
 * - createdBy/modifiedBy: Creator/modifier references (system fields)
 * - createdTime: Creation timestamp (system field)
 * - organizationId/relatedToId: Internal organization references (project internals)
 * 
 * These exclusions ensure that InboxItem remains a lightweight projection
 * focused on attention signals, not domain management complexity. Full
 * editing and management happens in the owning surface (Sales, Projects,
 * Helpdesk, Audit, Calendar, etc.), not in Inbox.
 * 
 * ============================================================================
 */
