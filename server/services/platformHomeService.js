'use strict';

const ApprovalInstance = require('../models/ApprovalInstance');
const Task = require('../models/Task');
const Deal = require('../models/Deal');
const Case = require('../models/Case');
const People = require('../models/People');
const Organization = require('../models/Organization');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const Document = require('../models/Document');
const { serializeEntityForClient } = require('../utils/notificationEntityDisplay');
const { buildInboxItemsForUser } = require('../controllers/inboxController');
const { loadWorkspaceThreadSummaries } = require('./workspaceThreadSummariesService');
const { getAppPulses, resolveEnabledAppKeys } = require('./appPulseService');
const { buildFocus, buildGreetingPayload } = require('./platformHomeFocusService');
const { getPlatformHomeOnboarding } = require('./onboardingService');
const { resolveRuntimePermission } = require('./runtimePermissionResolver');
const { getUserGroupIds, applyDocumentVisibilityFilter } = require('../utils/documentVisibility');
const { resolveEventRouteTarget } = require('../utils/eventUtils');

const DOCUMENTS_PREVIEW_LIMIT = 3;

const ATTENTION_PREVIEW_LIMIT = 7;
const RESUME_LIMIT = 8;
const RESUME_PER_MODULE = 2;
const APPROVAL_PREVIEW_LIMIT = 3;
const MAIL_PREVIEW_LIMIT = 5;
const NOTIFICATION_PREVIEW_LIMIT = 5;
const CLOSED_CASE_STATUSES = ['Resolved', 'Closed'];

async function safePlatformHomeSection(label, fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error(`[PlatformHome] ${label} error:`, err?.message || err);
    if (process.env.NODE_ENV !== 'production' && err?.stack) {
      console.error(err.stack);
    }
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

function summarizeAttentionItems(items) {
  const list = Array.isArray(items) ? items : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let overdue = 0;
  let dueToday = 0;

  for (const item of list) {
    if (item.isOverdue) {
      overdue += 1;
      continue;
    }
    if (!item.dueAt) continue;
    const due = new Date(item.dueAt);
    if (due >= today && due < tomorrow) {
      dueToday += 1;
    }
  }

  return {
    total: list.length,
    overdue,
    dueToday
  };
}

function computeWorkspaceThreadCounts(threadsRaw, userId) {
  const visible = threadsRaw.filter((t) => !t.done);
  const inboxActive = visible.filter((t) => !t.snoozeActive);
  return {
    all: inboxActive.length,
    unread: inboxActive.filter((t) => t.unread).length,
    assignedToMe: inboxActive.filter(
      (t) => String(t.assignedToUserId || '') === String(userId)
    ).length
  };
}

async function resolveEntityLabel(entityType, entityId) {
  try {
    if (entityType === 'deal') {
      const doc = await Deal.findById(entityId).select('name').lean();
      return doc?.name || null;
    }
    if (entityType === 'people') {
      const doc = await People.findById(entityId).select('first_name last_name email').lean();
      if (!doc) return null;
      return `${doc.first_name || ''} ${doc.last_name || ''}`.trim() || doc.email || null;
    }
    if (entityType === 'organization') {
      const doc = await Organization.findById(entityId).select('name isTenant').lean();
      if (!doc || doc.isTenant) return null;
      return doc.name || null;
    }
    if (entityType === 'quote') {
      const Quote = require('../models/Quote');
      const doc = await Quote.findById(entityId).select('quoteNumber quoteTitle').lean();
      return doc?.quoteTitle || doc?.quoteNumber || null;
    }
  } catch {
    return null;
  }
  return null;
}

async function getApprovalsShell(userId, organizationId) {
  const baseFilter = {
    organizationId,
    status: 'pending',
    approvers: { $in: [userId] }
  };

  const [total, rows] = await Promise.all([
    ApprovalInstance.countDocuments(baseFilter),
    ApprovalInstance.find(baseFilter)
      .populate('processId', 'name')
      .sort({ createdAt: -1 })
      .limit(APPROVAL_PREVIEW_LIMIT)
      .lean()
  ]);

  const preview = await Promise.all(rows.map(async (row) => {
    const entityLabel = row.entityType && row.entityId
      ? await resolveEntityLabel(row.entityType, row.entityId)
      : null;
    return {
      id: String(row._id),
      title: row.processId?.name || 'Approval',
      subtitle: entityLabel,
      route: `/approvals/${row._id}`,
      kind: 'approval',
      updatedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null
    };
  }));

  return { pending: total, preview };
}

async function getMailShell(req) {
  const emptyCounts = { all: 0, unread: 0, assignedToMe: 0 };
  try {
    const { error, threads } = await loadWorkspaceThreadSummaries(req, '');
    if (error || !Array.isArray(threads)) {
      return { counts: emptyCounts, preview: [] };
    }

    const counts = computeWorkspaceThreadCounts(threads, req.user._id);
    const preview = threads
      .filter((thread) => !thread.done && !thread.snoozeActive && thread.unread)
      .sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0))
      .slice(0, MAIL_PREVIEW_LIMIT)
      .map((thread) => ({
        id: String(thread.threadId),
        title: thread.subject || '(no subject)',
        subtitle: thread.participantDisplay || null,
        route: `/inbox?thread=${encodeURIComponent(String(thread.threadId))}`,
        kind: 'mail',
        updatedAt: thread.lastActivityAt
          ? new Date(thread.lastActivityAt).toISOString()
          : null
      }));

    return { counts, preview };
  } catch (err) {
    console.error('[PlatformHome] mail shell error:', err.message);
    return { counts: emptyCounts, preview: [] };
  }
}

function truncatePreviewText(value, max = 80) {
  const text = String(value || '').trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function getNotificationsShell(userId, organizationId, appKeys) {
  const keys = (appKeys || []).map((key) => String(key).toUpperCase()).filter(Boolean);
  if (!keys.length) return { unread: 0, preview: [] };

  try {
    const baseFilter = {
      userId,
      organizationId,
      appKey: { $in: keys },
      channel: 'IN_APP',
      readAt: null
    };

    const [unread, rows] = await Promise.all([
      Notification.countDocuments(baseFilter),
      Notification.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(NOTIFICATION_PREVIEW_LIMIT)
        .select('title body appKey entity eventType createdAt')
        .lean()
    ]);

    const preview = rows.map((row) => ({
      id: String(row._id),
      title: row.title || 'Notification',
      subtitle: truncatePreviewText(row.body),
      appKey: row.appKey,
      entity: serializeEntityForClient(row.entity),
      eventType: row.eventType || null,
      kind: 'notification',
      updatedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null
    }));

    return { unread, preview };
  } catch (err) {
    console.error('[PlatformHome] notifications shell error:', err.message);
    return { unread: 0, preview: [] };
  }
}

function buildPersonTitle(person) {
  return `${person.first_name || ''} ${person.last_name || ''}`.trim() || person.email || 'Person';
}

/**
 * Recently touched work records across modules.
 */
async function getResumeItems(userId, organizationId, req = null) {
  const orgFilter = { organizationId, deletedAt: null };

  const documentPromise = req && canViewDocuments(req)
    ? getResumeDocumentItems(userId, organizationId)
    : Promise.resolve([]);

  const [tasks, deals, cases, people, organizations, documents] = await Promise.all([
    Task.find({
      ...orgFilter,
      assignedTo: userId,
      status: { $nin: ['completed', 'cancelled'] }
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_PER_MODULE)
      .select('title updatedAt')
      .lean(),
    Deal.find({
      organizationId,
      assignedTo: userId,
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_PER_MODULE)
      .select('name updatedAt')
      .lean(),
    Case.find({
      ...orgFilter,
      assignedTo: userId,
      status: { $nin: CLOSED_CASE_STATUSES }
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_PER_MODULE)
      .select('title updatedAt')
      .lean(),
    People.find({
      ...orgFilter,
      assignedTo: userId
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_PER_MODULE)
      .select('first_name last_name email updatedAt')
      .lean(),
    Organization.find({
      isTenant: false,
      deletedAt: null,
      assignedTo: userId
    })
      .sort({ updatedAt: -1 })
      .limit(RESUME_PER_MODULE)
      .select('name updatedAt')
      .lean(),
    documentPromise
  ]);

  const candidates = [
    ...tasks.map((row) => ({
      id: String(row._id),
      title: row.title || 'Task',
      route: `/tasks/${row._id}`,
      sourceApp: 'Tasks',
      moduleKey: 'tasks',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    })),
    ...deals.map((row) => ({
      id: String(row._id),
      title: row.name || 'Deal',
      route: `/deals/${row._id}`,
      sourceApp: 'Sales',
      moduleKey: 'deals',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    })),
    ...cases.map((row) => ({
      id: String(row._id),
      title: row.title || 'Case',
      route: `/helpdesk/cases/${row._id}`,
      sourceApp: 'Helpdesk',
      moduleKey: 'cases',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    })),
    ...people.map((row) => ({
      id: String(row._id),
      title: buildPersonTitle(row),
      route: `/people/${row._id}`,
      sourceApp: 'Sales',
      moduleKey: 'people',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    })),
    ...organizations.map((row) => ({
      id: String(row._id),
      title: row.name || 'Organization',
      route: `/organizations/${row._id}`,
      sourceApp: 'Sales',
      moduleKey: 'organizations',
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
    })),
    ...documents
  ];

  return candidates
    .filter((candidate) => candidate.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, RESUME_LIMIT);
}

async function buildDocumentsVisibilityContext(req) {
  const organizationId = req.user.organizationId;
  const userId = req.user._id;
  const userGroupIds = await getUserGroupIds(organizationId, userId);
  const hasViewAll = resolveRuntimePermission(req.user, 'documents', 'viewAll', {
    organizationId,
    appKey: 'platform'
  });

  return {
    hasViewAll: Boolean(hasViewAll),
    userId,
    userRoleId: req.user.roleId || null,
    userGroupIds
  };
}

function canViewDocuments(req) {
  return Boolean(resolveRuntimePermission(req.user, 'documents', 'view', {
    organizationId: req.user.organizationId,
    appKey: 'platform'
  }));
}

async function getDocumentsShell(req) {
  if (!canViewDocuments(req)) {
    return { pendingReview: 0, expiringSoon: 0, preview: [] };
  }

  const organizationId = req.user.organizationId;
  const visibilityContext = await buildDocumentsVisibilityContext(req);
  const baseQuery = { organizationId, deletedAt: null };
  const now = new Date();
  const soon = new Date(now);
  soon.setDate(soon.getDate() + 30);

  const pendingQuery = { ...baseQuery, status: 'pending_review' };
  const expiringQuery = { ...baseQuery, expiryDate: { $gte: now, $lte: soon } };
  applyDocumentVisibilityFilter(pendingQuery, visibilityContext);
  applyDocumentVisibilityFilter(expiringQuery, visibilityContext);

  const [pendingReview, expiringSoon, previewRows] = await Promise.all([
    Document.countDocuments(pendingQuery),
    Document.countDocuments(expiringQuery),
    Document.find(pendingQuery)
      .sort({ updatedAt: -1 })
      .limit(DOCUMENTS_PREVIEW_LIMIT)
      .select('title updatedAt status documentNumber')
      .lean()
  ]);

  const preview = previewRows.map((row) => ({
    id: String(row._id),
    title: row.title || row.documentNumber || 'Document',
    subtitle: row.documentNumber || null,
    route: `/documents/${row._id}`,
    kind: 'document',
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
  }));

  return { pendingReview, expiringSoon, preview };
}

async function getResumeDocumentItems(userId, organizationId) {
  const rows = await Document.find({
    organizationId,
    deletedAt: null,
    $or: [{ assignedTo: userId }, { modifiedBy: userId }, { createdBy: userId }]
  })
    .sort({ updatedAt: -1 })
    .limit(RESUME_PER_MODULE)
    .select('title updatedAt documentNumber')
    .lean();

  return rows.map((row) => ({
    id: String(row._id),
    title: row.title || row.documentNumber || 'Document',
    route: `/documents/${row._id}`,
    sourceApp: 'Documents',
    moduleKey: 'documents',
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
  }));
}

function resolveEventSourceApp(eventType) {
  const type = String(eventType || '');
  if (type.includes('Audit')) return 'Audit';
  return 'Sales';
}

async function getNextEvent(userId, organizationId) {
  const now = new Date();
  const row = await Event.findOne({
    organizationId,
    deletedAt: null,
    status: { $nin: ['Completed', 'Cancelled'] },
    startDateTime: { $gte: now },
    $or: [
      { assignedTo: userId },
      { auditorId: userId },
      { reviewerId: userId }
    ]
  })
    .sort({ startDateTime: 1 })
    .select('eventName startDateTime eventType')
    .lean();

  if (!row) return null;

  return {
    id: String(row._id),
    title: row.eventName || 'Event',
    startAt: new Date(row.startDateTime).toISOString(),
    route: resolveEventRouteTarget(row._id, row.eventType),
    sourceApp: resolveEventSourceApp(row.eventType),
    kind: 'event'
  };
}

/**
 * Platform home snapshot — single round-trip for landing page.
 */
async function getPlatformHomeSnapshot(req) {
  const userId = req.user._id;
  const organizationId = req.user.organizationId;
  const organization = req.organization
    || await Organization.findById(organizationId).lean();

  const enabledAppKeys = resolveEnabledAppKeys(req);

  const [attentionItems, approvalsShell, mailShell, resume, appPulses, onboarding, nextEvent, notificationsShell, documentsShell] = await Promise.all([
    safePlatformHomeSection('attention', () => buildInboxItemsForUser(userId, organizationId), []),
    safePlatformHomeSection('approvals', () => getApprovalsShell(userId, organizationId), { pending: 0, preview: [] }),
    safePlatformHomeSection('mail', () => getMailShell(req), { counts: { all: 0, unread: 0, assignedToMe: 0 }, preview: [] }),
    safePlatformHomeSection('resume', () => getResumeItems(userId, organizationId, req), []),
    safePlatformHomeSection('appPulses', () => getAppPulses(req), []),
    safePlatformHomeSection(
      'onboarding',
      () => getPlatformHomeOnboarding(req, organization),
      null
    ),
    safePlatformHomeSection('nextEvent', () => getNextEvent(userId, organizationId), null),
    safePlatformHomeSection(
      'notifications',
      () => getNotificationsShell(userId, organizationId, enabledAppKeys),
      { unread: 0, preview: [] }
    ),
    safePlatformHomeSection('documents', () => getDocumentsShell(req), { pendingReview: 0, expiringSoon: 0, preview: [] })
  ]);

  const summary = summarizeAttentionItems(attentionItems);
  const attention = {
    items: attentionItems.slice(0, ATTENTION_PREVIEW_LIMIT),
    total: attentionItems.length,
    summary
  };
  const shell = {
    approvalsPending: approvalsShell.pending ?? 0,
    approvalsPreview: approvalsShell.preview ?? [],
    nextEvent: nextEvent || null,
    mail: {
      all: mailShell.counts?.all ?? 0,
      unread: mailShell.counts?.unread ?? 0,
      assignedToMe: mailShell.counts?.assignedToMe ?? 0,
      preview: mailShell.preview ?? []
    },
    notifications: {
      unread: notificationsShell.unread ?? 0,
      preview: notificationsShell.preview ?? []
    },
    documents: {
      pendingReview: documentsShell.pendingReview ?? 0,
      expiringSoon: documentsShell.expiringSoon ?? 0,
      preview: documentsShell.preview ?? []
    }
  };

  const focus = buildFocus({ attention, shell, appPulses });
  let focusAi = null;
  if (organization?.aiSettings?.enabled && organization?.aiSettings?.platformHomeAiFocus === true) {
    try {
      const { enrichPlatformHomeFocus } = require('./ai/aiAgentService');
      const { isAiSuiteEntitledForOrg } = require('../utils/addonAccessUtils');
      const entitled = await isAiSuiteEntitledForOrg(organizationId);
      if (entitled) {
        focusAi = await enrichPlatformHomeFocus({
          organizationId,
          userId,
          focus,
          attentionSummary: summary,
        });
      }
    } catch {
      focusAi = null;
    }
  }

  return {
    greeting: buildGreetingPayload(req.user),
    focus,
    focusAi,
    attention,
    shell,
    resume,
    appPulses,
    onboarding
  };
}

module.exports = {
  ATTENTION_PREVIEW_LIMIT,
  getPlatformHomeSnapshot,
  summarizeAttentionItems
};
