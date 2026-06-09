'use strict';

const ApprovalInstance = require('../models/ApprovalInstance');
const Task = require('../models/Task');
const Deal = require('../models/Deal');
const { buildInboxItemsForUser } = require('../controllers/inboxController');
const { loadWorkspaceThreadSummaries } = require('./workspaceThreadSummariesService');
const { getAppPulses } = require('./appPulseService');
const { buildFocusLine, buildGreetingPayload } = require('./platformHomeFocusService');
const { getPlatformHomeOnboarding } = require('./onboardingService');

const ATTENTION_PREVIEW_LIMIT = 7;
const RESUME_LIMIT = 5;

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

async function getApprovalsPendingCount(userId, organizationId) {
  return ApprovalInstance.countDocuments({
    organizationId,
    status: 'pending',
    approvers: { $in: [userId] }
  });
}

async function getMailCounts(req) {
  try {
    const { error, threads } = await loadWorkspaceThreadSummaries(req, '');
    if (error || !Array.isArray(threads)) {
      return { all: 0, unread: 0, assignedToMe: 0 };
    }
    return computeWorkspaceThreadCounts(threads, req.user._id);
  } catch (err) {
    console.error('[PlatformHome] mail counts error:', err.message);
    return { all: 0, unread: 0, assignedToMe: 0 };
  }
}

/**
 * Recently touched work records for "Continue where you left off".
 */
async function getResumeItems(userId, organizationId) {
  const orgFilter = { organizationId, deletedAt: null };

  const [tasks, deals] = await Promise.all([
    Task.find({
      ...orgFilter,
      assignedTo: userId,
      status: { $nin: ['completed', 'cancelled'] }
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('title updatedAt')
      .lean(),
    Deal.find({
      organizationId,
      ownerId: userId,
      deletedAt: null
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .select('name updatedAt')
      .lean()
  ]);

  const candidates = [
    ...tasks.map((t) => ({
      id: String(t._id),
      title: t.title || 'Task',
      route: `/tasks/${t._id}`,
      sourceApp: 'Tasks',
      moduleKey: 'tasks',
      updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null
    })),
    ...deals.map((d) => ({
      id: String(d._id),
      title: d.name || 'Deal',
      route: `/deals/${d._id}`,
      sourceApp: 'Sales',
      moduleKey: 'deals',
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null
    }))
  ];

  return candidates
    .filter((c) => c.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, RESUME_LIMIT);
}

/**
 * Platform home snapshot — single round-trip for landing page.
 */
async function getPlatformHomeSnapshot(req) {
  const userId = req.user._id;
  const organizationId = req.user.organizationId;
  const organization = req.organization
    || await require('../models/Organization').findById(organizationId).lean();

  const [attentionItems, approvalsPending, mail, resume, appPulses, onboarding] = await Promise.all([
    safePlatformHomeSection('attention', () => buildInboxItemsForUser(userId, organizationId), []),
    safePlatformHomeSection('approvals', () => getApprovalsPendingCount(userId, organizationId), 0),
    safePlatformHomeSection('mail', () => getMailCounts(req), { all: 0, unread: 0, assignedToMe: 0 }),
    safePlatformHomeSection('resume', () => getResumeItems(userId, organizationId), []),
    safePlatformHomeSection('appPulses', () => getAppPulses(req), []),
    safePlatformHomeSection(
      'onboarding',
      () => getPlatformHomeOnboarding(req, organization),
      null
    )
  ]);

  const summary = summarizeAttentionItems(attentionItems);
  const attention = {
    items: attentionItems.slice(0, ATTENTION_PREVIEW_LIMIT),
    total: attentionItems.length,
    summary
  };
  const shell = { approvalsPending, mail };

  return {
    greeting: buildGreetingPayload(req.user),
    focusLine: buildFocusLine({ attention, shell, appPulses }),
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
