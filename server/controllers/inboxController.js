/**
 * ============================================================================
 * INBOX AGGREGATION CONTROLLER
 * ============================================================================
 * 
 * This controller aggregates Tasks and Events into unified InboxItem[] based on
 * human attention, not data completeness.
 * 
 * IMPORTANT: Inbox is an attention surface, not a task manager or calendar.
 * - Only returns items requiring user action
 * - Only returns time-relevant items (overdue or due soon)
 * - Never returns raw Task or Event models
 * - Never exposes system fields (auditState, geo, forms, metadata)
 * 
 * See docs/architecture/inbox-aggregation.md for aggregation rules.
 * See client/src/types/inboxItem.types.ts for type definitions.
 * 
 * ============================================================================
 */

const Task = require('../models/Task');
const Event = require('../models/Event');
const Organization = require('../models/Organization');
const People = require('../models/People');
const Deal = require('../models/Deal');
const FormResponse = require('../models/FormResponse');
const mongoose = require('mongoose');
const { resolveEventRouteTarget } = require('../utils/eventUtils');

/** Map relatedTo.type → model (refPath uses type as model name; "none" must not be populated). */
const TASK_RELATED_TO_MODEL_MAP = {
  contact: { model: People, displayFields: ['first_name', 'last_name'] },
  deal: { model: Deal, displayFields: ['name'] },
  organization: { model: Organization, displayFields: ['name'] },
  project: null
};

async function populateTaskRelatedToNames(tasks) {
  if (!tasks?.length) return;

  const idsByType = { contact: [], deal: [], organization: [], project: [] };
  for (const task of tasks) {
    const rt = task?.relatedTo;
    if (!rt || rt.type === 'none' || !rt.id) continue;
    const type = String(rt.type || '').toLowerCase();
    const id = rt.id && typeof rt.id === 'object' ? rt.id._id : rt.id;
    if (id && idsByType[type]) idsByType[type].push(id);
  }

  const idToName = new Map();
  for (const [type, ids] of Object.entries(idsByType)) {
    if (ids.length === 0) continue;
    const config = TASK_RELATED_TO_MODEL_MAP[type];
    if (!config?.model) continue;
    const uniqueIds = [...new Set(ids.map((id) => String(id)))].filter(Boolean);
    if (uniqueIds.length === 0) continue;
    const docs = await config.model
      .find({ _id: { $in: uniqueIds } })
      .select(config.displayFields.join(' '))
      .lean();
    for (const doc of docs) {
      const id = doc._id?.toString?.() || doc._id;
      let name = '';
      if (config.displayFields.includes('first_name') || config.displayFields.includes('last_name')) {
        const first = doc.first_name || '';
        const last = doc.last_name || '';
        name = `${first} ${last}`.trim() || doc.name || doc.title || '';
      } else {
        name = doc.name || doc.title || '';
      }
      if (name) idToName.set(id, name);
    }
  }

  for (const task of tasks) {
    const rt = task.relatedTo;
    if (!rt || rt.type === 'none' || !rt.id) continue;
    const id = rt.id && typeof rt.id === 'object' ? rt.id._id : rt.id;
    const idStr = id?.toString?.() || id;
    const name = idToName.get(idStr);
    if (name) {
      task.relatedTo = { ...rt, name };
    }
  }
}

// ============================================================================
// TIME RELEVANCE WINDOWS (UX-Driven)
// ============================================================================

const NEAR_TERM_WINDOW_DAYS = 7; // Tasks due within 7 days
const STARTING_SOON_WINDOW_HOURS = 48; // Events starting within 48 hours
const REVIEW_WINDOW_HOURS = 24; // Reviews due within 24 hours

/**
 * Add hours to a date
 */
function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// TASK AGGREGATION
// ============================================================================

/**
 * Fetch tasks relevant for Inbox
 * 
 * Inclusion criteria:
 * - Assigned to current user
 * - Not completed or cancelled
 * - Overdue OR due within near-term window (7 days)
 */
async function fetchInboxTasks(userId, organizationId) {
  const now = new Date();
  const nearTermCutoff = addDays(now, NEAR_TERM_WINDOW_DAYS);

  const tasks = await Task.find({
    organizationId: organizationId,
    assignedTo: userId,
    status: { $nin: ['completed', 'cancelled'] },
    $or: [
      { dueDate: { $lt: now } }, // Overdue
      { dueDate: { $lte: nearTermCutoff } }, // Due within 7 days
      { dueDate: null } // No due date (include for now, will filter later)
    ]
  })
    .populate('organizationId', 'name')
    .lean();

  await populateTaskRelatedToNames(tasks);

  return tasks.filter(task => {
    // Exclude tasks with no due date that are not overdue
    // (tasks without due dates are not time-relevant unless overdue)
    if (!task.dueDate) {
      return false; // Exclude tasks with no due date
    }
    return true;
  });
}

/**
 * Determine source app from task context
 */
function determineTaskSourceApp(task) {
  if (!task.relatedTo || !task.relatedTo.type) {
    return 'Tasks';
  }

  const typeMap = {
    'deal': 'Sales',
    'project': 'Projects',
    'contact': 'Sales',
    'organization': 'Sales',
    'none': 'Tasks'
  };

  return typeMap[task.relatedTo.type] || 'Tasks';
}

/**
 * Format related label for task
 */
function formatTaskRelatedLabel(task) {
  if (!task.relatedTo || !task.relatedTo.type || task.relatedTo.type === 'none') {
    return 'Task';
  }

  const relatedEntity = task.relatedTo.id;
  if (!relatedEntity) {
    return 'Task';
  }

  const typeLabels = {
    'deal': 'Deal',
    'project': 'Project',
    'contact': 'Contact',
    'organization': 'Organization'
  };

  const typeLabel = typeLabels[task.relatedTo.type] || 'Task';
  const entityName =
    task.relatedTo.name ||
    (typeof relatedEntity === 'object' && relatedEntity?.name) ||
    'Unknown';

  return `${typeLabel} · ${entityName}`;
}

/**
 * Map task status + due date to attention label
 */
function mapTaskAttentionLabel(task) {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;

  if (!dueDate) {
    if (task.status === 'waiting') {
      return 'Waiting';
    }
    if (task.status === 'in_progress') {
      return 'In progress';
    }
    return 'No due date';
  }

  const isOverdue = dueDate < now && task.status !== 'completed';
  const diffMs = dueDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (isOverdue) {
    return 'Overdue';
  }

  if (task.status === 'waiting') {
    return 'Waiting';
  }

  // Check if due today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDateOnly = new Date(dueDate);
  dueDateOnly.setHours(0, 0, 0, 0);

  if (dueDateOnly.getTime() === today.getTime()) {
    return 'Due today';
  }

  // Check if due tomorrow
  const tomorrow = addDays(today, 1);
  if (dueDateOnly.getTime() === tomorrow.getTime()) {
    return 'Due tomorrow';
  }

  if (diffDays > 0 && diffDays <= 7) {
    return `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
  }

  if (diffDays > 7) {
    return `Due in ${diffDays} days`;
  }

  return 'Due soon';
}

/**
 * Map Task to InboxTaskItem
 */
function mapTaskToInboxItem(task) {
  const now = new Date();
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < now && task.status !== 'completed';

  return {
    kind: 'task',
    id: task._id.toString(),
    title: task.title,
    attentionLabel: mapTaskAttentionLabel(task),
    dueAt: dueDate ? dueDate.toISOString() : null,
    isOverdue: isOverdue || false,
    sourceApp: determineTaskSourceApp(task),
    relatedLabel: formatTaskRelatedLabel(task),
    organizationLabel: task.organizationId?.name || 'Unknown',
    routeTarget: `/sales/tasks/${task._id}`,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : (task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString()),
    allowComplete: true,
    completeAction: `/api/tasks/${task._id}/complete`
  };
}

// ============================================================================
// EVENT AGGREGATION
// ============================================================================

/**
 * Determine event attention type based on user role and event state
 */
function determineEventAttentionType(event, userId) {
  const userIdStr = userId.toString();

  // Check if user is auditor or owner (can start event)
  const isAuditorOrOwner = 
    (event.auditorId && event.auditorId.toString() === userIdStr) ||
    (event.assignedTo && event.assignedTo.toString() === userIdStr);

  // Check if user is reviewer
  const isReviewer = event.reviewerId && event.reviewerId.toString() === userIdStr;

  // Check if user is corrective owner
  const isCorrectiveOwner = event.correctiveOwnerId && event.correctiveOwnerId.toString() === userIdStr;

  // Priority order: corrective > review > approval > start

  // Corrective actions need attention
  if (isCorrectiveOwner && event.auditState === 'pending_corrective') {
    return 'corrective';
  }

  // Review needed
  if (isReviewer && (event.auditState === 'needs_review' || event.auditState === 'submitted')) {
    return 'review';
  }

  // Approval needed (if event is approved but needs final sign-off)
  if ((isReviewer || isAuditorOrOwner) && event.auditState === 'approved') {
    // Check if final approval is needed (event not closed)
    if (event.status !== 'Completed') {
      return 'approval';
    }
  }

  // Event needs to be started
  if (isAuditorOrOwner && event.auditState === 'Ready to start') {
    return 'start';
  }

  return null; // No attention needed
}

/**
 * Compute dueAt for event based on attention type
 */
function computeEventDueAt(event, attentionType) {
  if (attentionType === 'start') {
    return event.startDateTime ? new Date(event.startDateTime).toISOString() : null;
  }

  if (attentionType === 'review' || attentionType === 'approval') {
    return event.endDateTime ? new Date(event.endDateTime).toISOString() : null;
  }

  if (attentionType === 'corrective') {
    // Find earliest corrective action due date
    // This requires fetching FormResponse, but for now use event endDateTime
    return event.endDateTime ? new Date(event.endDateTime).toISOString() : null;
  }

  return null;
}

/**
 * Compute isOverdue for event based on attention type
 */
function computeEventIsOverdue(event, attentionType) {
  const now = new Date();

  if (attentionType === 'start') {
    return event.startDateTime && new Date(event.startDateTime) < now;
  }

  if (attentionType === 'review' || attentionType === 'approval') {
    // For now, use endDateTime as deadline
    return event.endDateTime && new Date(event.endDateTime) < now;
  }

  if (attentionType === 'corrective') {
    // Corrective actions are overdue if event is past due
    // More precise logic would check FormResponse corrective actions
    return event.endDateTime && new Date(event.endDateTime) < now;
  }

  return false;
}

/**
 * Count corrective actions for event
 */
async function countCorrectiveActions(eventId, organizationId) {
  try {
    const responses = await FormResponse.find({
      'linkedTo.type': 'Event',
      'linkedTo.id': eventId,
      organizationId: organizationId,
      executionStatus: 'Submitted'
    }).lean();

    let totalActions = 0;
    let overdueActions = 0;
    const now = new Date();

    for (const response of responses) {
      if (response.correctiveActions && Array.isArray(response.correctiveActions)) {
        for (const action of response.correctiveActions) {
          if (action.managerAction && action.managerAction.status !== 'completed') {
            totalActions++;
            // Check if due date is past
            if (action.managerAction.dueDate && new Date(action.managerAction.dueDate) < now) {
              overdueActions++;
            }
          }
        }
      }
    }

    return { total: totalActions, overdue: overdueActions };
  } catch (error) {
    console.error('[Inbox] Error counting corrective actions:', error);
    return { total: 0, overdue: 0 };
  }
}

/**
 * Map event attention type + due date to attention label
 * 
 * Note: This function is async because it may need to count corrective actions
 */
async function mapEventAttentionLabel(event, attentionType, dueAt) {
  const now = new Date();
  const dueDate = dueAt ? new Date(dueAt) : null;

  if (!dueDate) {
    if (attentionType === 'review') {
      return 'Needs review';
    }
    if (attentionType === 'corrective') {
      return 'Corrective actions pending';
    }
    if (attentionType === 'approval') {
      return 'Needs approval';
    }
    return 'Action required';
  }

  const isOverdue = dueDate < now;
  const diffMs = dueDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (attentionType === 'start') {
    if (isOverdue) {
      return 'Started';
    }
    if (diffHours <= 24 && diffHours > 0) {
      return `Starts in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    }
    if (diffDays === 0) {
      return 'Starts today';
    }
    if (diffDays === 1) {
      return 'Starts tomorrow';
    }
    if (diffDays > 1) {
      return `Starts in ${diffDays} days`;
    }
    return 'Starts soon';
  }

  if (attentionType === 'review') {
    if (isOverdue) {
      return 'Review overdue';
    }
    if (diffDays === 0) {
      return 'Needs review';
    }
    return 'Review due soon';
  }

  if (attentionType === 'corrective') {
    const counts = await countCorrectiveActions(event._id, event.organizationId);
    if (counts.overdue > 0) {
      return `${counts.overdue} corrective action${counts.overdue !== 1 ? 's' : ''} overdue`;
    }
    if (diffDays === 0) {
      return `${counts.total} corrective action${counts.total !== 1 ? 's' : ''} due today`;
    }
    return `${counts.total} corrective action${counts.total !== 1 ? 's' : ''} pending`;
  }

  if (attentionType === 'approval') {
    if (isOverdue) {
      return 'Approval overdue';
    }
    if (diffDays === 0) {
      return 'Needs approval';
    }
    return 'Approval due soon';
  }

  return 'Action required';
}

/**
 * Determine source app from event type
 */
function determineEventSourceApp(event) {
  const auditTypes = [
    'Internal Audit',
    'External Audit — Single Org',
    'External Audit Beat'
  ];

  if (auditTypes.includes(event.eventType)) {
    return 'Audit';
  }

  if (event.eventType === 'Field Sales Beat') {
    return 'Sales';
  }

  return 'Calendar';
}

/**
 * Format related label for event
 */
function formatEventRelatedLabel(event, organization) {
  const auditTypes = [
    'Internal Audit',
    'External Audit — Single Org',
    'External Audit Beat'
  ];

  if (auditTypes.includes(event.eventType)) {
    const orgName = organization?.name || 'Unknown';
    return `${event.eventType} · ${orgName}`;
  }

  if (event.eventType === 'Field Sales Beat') {
    return `Sales Beat · ${organization?.name || 'Route'}`;
  }

  if ((event.eventType === 'Meeting' || event.eventType === 'Meeting / Appointment') && organization) {
    return `Meeting · ${organization.name}`;
  }

  return event.eventName;
}

/**
 * Fetch events relevant for Inbox
 * 
 * Inclusion criteria:
 * - User has explicit role (owner, auditor, reviewer, corrective owner)
 * - Event requires action (start, review, corrective, approval)
 * - Event is time-relevant (starting soon or overdue)
 * - Not completed or cancelled
 */
async function fetchInboxEvents(userId, organizationId) {
  const now = new Date();
  const startingSoonCutoff = addHours(now, STARTING_SOON_WINDOW_HOURS);

  // Find events where user has a role AND (starting soon OR pending audit action)
  const events = await Event.find({
    organizationId: organizationId,
    status: { $nin: ['Completed', 'Cancelled'] },
    $and: [
      {
        $or: [
          { assignedTo: userId },
          { auditorId: userId },
          { reviewerId: userId },
          { correctiveOwnerId: userId }
        ]
      },
      {
        $or: [
          { startDateTime: { $lte: startingSoonCutoff } },
          { auditState: { $in: ['needs_review', 'pending_corrective', 'submitted'] } }
        ]
      }
    ]
  })
    .populate({ path: 'relatedToId', select: 'name', strictPopulate: false })
    .populate({ path: 'organizationId', select: 'name', strictPopulate: false })
    .lean();

  // Filter events that actually require attention
  const relevantEvents = [];

  for (const event of events) {
    const attentionType = determineEventAttentionType(event, userId);
    
    if (!attentionType) {
      continue; // No attention needed
    }

    // Check time relevance
    const startDateTime = event.startDateTime ? new Date(event.startDateTime) : null;
    
    if (attentionType === 'start') {
      // Must be starting soon or overdue
      if (startDateTime && startDateTime <= startingSoonCutoff) {
        relevantEvents.push({ ...event, _attentionType: attentionType });
      }
    } else {
      // Review, corrective, approval - include if event exists
      // (time relevance checked via dueAt computation)
      relevantEvents.push({ ...event, _attentionType: attentionType });
    }
  }

  return relevantEvents;
}

/**
 * Map Event to InboxEventItem
 */
async function mapEventToInboxItem(event) {
  const attentionType = event._attentionType;
  const dueAt = computeEventDueAt(event, attentionType);
  const isOverdue = computeEventIsOverdue(event, attentionType);
  const attentionLabel = await mapEventAttentionLabel(event, attentionType, dueAt);

  // Get organization for related label
  const organization = event.relatedToId || event.organizationId;

  const sourceApp = determineEventSourceApp(event);
  const routeTarget = resolveEventRouteTarget(event._id, event.eventType);

  return {
    kind: 'event',
    id: event._id.toString(),
    title: event.eventName,
    attentionLabel: attentionLabel,
    dueAt: dueAt,
    isOverdue: isOverdue,
    sourceApp: sourceApp,
    relatedLabel: formatEventRelatedLabel(event, organization),
    organizationLabel: event.organizationId?.name || 'Unknown',
    routeTarget: routeTarget,
    updatedAt: event.modifiedTime ? new Date(event.modifiedTime).toISOString() : (event.createdTime ? new Date(event.createdTime).toISOString() : new Date().toISOString()),
    allowComplete: false,
    eventAttentionType: attentionType
  };
}

// ============================================================================
// SORTING
// ============================================================================

/**
 * Sort Inbox items by urgency tiers
 * 
 * Tier 1: Overdue items (highest priority)
 * Tier 2: Review/Approval required
 * Tier 3: Due/Starting soon (within 24 hours)
 * Tier 4: Everything else
 * 
 * Within each tier, sort by dueAt ASC, then updatedAt DESC
 */
function sortInboxItems(items) {
  const now = new Date();
  const twentyFourHoursFromNow = addHours(now, 24);

  return items.sort((a, b) => {
    // Tier 1: Overdue items
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Tier 2: Review/approval required
    if (a.isOverdue === b.isOverdue) {
      const aIsReview = a.kind === 'event' && (a.eventAttentionType === 'review' || a.eventAttentionType === 'approval');
      const bIsReview = b.kind === 'event' && (b.eventAttentionType === 'review' || b.eventAttentionType === 'approval');
      const aIsWaiting = a.kind === 'task' && a.attentionLabel === 'Waiting';
      const bIsWaiting = b.kind === 'task' && b.attentionLabel === 'Waiting';

      if ((aIsReview || aIsWaiting) && !(bIsReview || bIsWaiting)) return -1;
      if (!(aIsReview || aIsWaiting) && (bIsReview || bIsWaiting)) return 1;
    }

    // Tier 3: Due/starting soon (within 24 hours)
    if (a.dueAt && b.dueAt) {
      const aDue = new Date(a.dueAt);
      const bDue = new Date(b.dueAt);
      const aDueSoon = aDue <= twentyFourHoursFromNow;
      const bDueSoon = bDue <= twentyFourHoursFromNow;

      if (aDueSoon && !bDueSoon) return -1;
      if (!aDueSoon && bDueSoon) return 1;
    } else if (a.dueAt && !b.dueAt) {
      return -1; // Items with due dates come first
    } else if (!a.dueAt && b.dueAt) {
      return 1; // Items without due dates come last
    }

    // Within same tier: sort by dueAt ASC
    if (a.dueAt && b.dueAt) {
      const aDue = new Date(a.dueAt).getTime();
      const bDue = new Date(b.dueAt).getTime();
      if (aDue !== bDue) {
        return aDue - bDue;
      }
    }

    // Tie-breaker: updatedAt DESC (most recently updated first)
    const aUpdated = new Date(a.updatedAt).getTime();
    const bUpdated = new Date(b.updatedAt).getTime();
    return bUpdated - aUpdated;
  });
}

// ============================================================================
// MAIN CONTROLLER
// ============================================================================

/**
 * Build unified InboxItem[] for a user (shared by GET /api/inbox and platform home).
 * @returns {Promise<object[]>}
 */
async function buildInboxItemsForUser(userId, organizationId) {
  if (!userId || !organizationId) {
    return [];
  }

  const [tasks, events] = await Promise.all([
    fetchInboxTasks(userId, organizationId),
    fetchInboxEvents(userId, organizationId)
  ]);

  const taskItems = tasks.map(mapTaskToInboxItem);
  const eventItems = await Promise.all(events.map(mapEventToInboxItem));
  const allItems = [...taskItems, ...eventItems];
  return sortInboxItems(allItems);
}

exports.buildInboxItemsForUser = buildInboxItemsForUser;

/**
 * GET /api/inbox
 *
 * Aggregate Tasks and Events into unified InboxItem[]
 */
exports.getInboxItems = async (req, res) => {
  try {
    const userId = req.user._id;
    const organizationId = req.user.organizationId;

    if (!userId || !organizationId) {
      console.error('[Inbox] Missing userId or organizationId');
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    const sortedItems = await buildInboxItemsForUser(userId, organizationId);

    return res.status(200).json({
      success: true,
      data: sortedItems
    });

  } catch (error) {
    // On failure, return empty list with 200
    // Log errors server-side (never expose to client)
    console.error('[Inbox] Error aggregating inbox items:', error);
    console.error('[Inbox] Error stack:', error.stack);

    return res.status(200).json({
      success: true,
      data: []
    });
  }
};
