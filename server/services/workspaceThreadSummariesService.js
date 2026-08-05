'use strict';

const mongoose = require('mongoose');
const Communication = require('../models/Communication');
const CommunicationThreadMeta = require('../models/CommunicationThreadMeta');
const ThreadView = require('../models/ThreadView');
const User = require('../models/User');
const Mailbox = require('../models/Mailbox');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Case = require('../models/Case');
const Organization = require('../models/Organization');
const Task = require('../models/Task');
const { SUPPORTED_MODULES } = require('../platform/communication/domain/sendEmailContract');
const {
  canUserAccessMailboxThreads,
  getAccessibleMailboxIds
} = require('./mailboxAccessService');

async function getTenantUserIds(organizationId) {
  const users = await User.find({ organizationId }).select('_id').lean();
  return users.map((u) => u._id);
}

function computeThreadTriageHints(sortedMessages, { unread }) {
  const nowMs = Date.now();
  const inbound = sortedMessages.filter((m) => m.direction === 'inbound');
  const lastInbound = inbound.length > 0 ? inbound[inbound.length - 1] : null;
  const lastInboundAtRaw = lastInbound?.receivedAt || lastInbound?.createdAt || null;
  const lastInboundAt = lastInboundAtRaw ? new Date(lastInboundAtRaw) : null;
  const ageHours = lastInboundAt ? (nowMs - lastInboundAt.getTime()) / (1000 * 60 * 60) : null;

  const hasBounce = sortedMessages.some((m) => String(m.status || '').toLowerCase() === 'bounced');
  const hasComplaint = sortedMessages.some((m) => String(m.status || '').toLowerCase() === 'complained');
  const latestOutbound = [...sortedMessages].reverse().find((m) => m.direction === 'outbound');
  const latestOutboundStatus = String(latestOutbound?.status || '').toLowerCase();
  const hasUnresolvedSendFailure = latestOutbound && ['failed', 'undelivered'].includes(latestOutboundStatus);

  const riskFlags = [];
  if (hasBounce) riskFlags.push('has_bounce');
  if (hasComplaint) riskFlags.push('has_complaint');
  if (hasUnresolvedSendFailure) riskFlags.push('send_failure');

  let priorityHint = 'low';
  let slaHint = 'on_track';
  if (unread && ageHours != null && ageHours >= 24) {
    priorityHint = 'high';
    slaHint = 'overdue';
  } else if (unread && ageHours != null && ageHours >= 8) {
    priorityHint = 'medium';
    slaHint = 'reply_due_soon';
  } else if (unread && ageHours != null && ageHours >= 2) {
    priorityHint = 'medium';
    slaHint = 'on_track';
  }

  if (hasBounce || hasComplaint) {
    priorityHint = 'high';
    if (slaHint === 'on_track') slaHint = 'reply_due_soon';
  } else if (hasUnresolvedSendFailure && priorityHint === 'low') {
    priorityHint = 'medium';
  }

  return {
    priorityHint,
    slaHint,
    riskFlags,
    lastInboundAt: lastInboundAt || null
  };
}

/**
 * Resolve display labels for related records (workspace inbox).
 * @param {import('mongoose').Types.ObjectId} organizationId
 * @param {Array<{ moduleKey?: string, recordId?: unknown }>} relatedTos
 * @returns {Promise<Map<string, string>>} key `moduleKey:recordId` → label
 */
async function batchResolveRecordLabels(organizationId, relatedTos) {
  const labels = new Map();
  const list = Array.isArray(relatedTos) ? relatedTos.filter((r) => r?.moduleKey && r?.recordId) : [];
  if (list.length === 0) return labels;

  const tenantUserIds = await getTenantUserIds(organizationId);
  const mk = (m) => String(m || '').toLowerCase();

  const idsFor = (moduleKey) => {
    const set = new Set();
    for (const r of list) {
      if (mk(r.moduleKey) === mk(moduleKey)) set.add(r.recordId);
    }
    return [...set];
  };

  const peopleIds = idsFor('people');
  if (peopleIds.length > 0) {
    const rows = await People.find({
      _id: { $in: peopleIds },
      organizationId,
      deletedAt: null
    })
      .select('first_name last_name email')
      .lean();
    for (const row of rows) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || 'Person';
      labels.set(`people:${String(row._id)}`, name);
    }
  }

  const dealIds = idsFor('deals');
  if (dealIds.length > 0) {
    const rows = await Deal.find({ _id: { $in: dealIds }, organizationId }).select('name').lean();
    for (const row of rows) {
      labels.set(`deals:${String(row._id)}`, String(row.name || 'Deal'));
    }
  }

  const taskIds = idsFor('tasks');
  if (taskIds.length > 0) {
    const rows = await Task.find({ _id: { $in: taskIds }, organizationId }).select('title').lean();
    for (const row of rows) {
      labels.set(`tasks:${String(row._id)}`, String(row.title || 'Task'));
    }
  }

  const caseIds = idsFor('cases');
  if (caseIds.length > 0) {
    const rows = await Case.find({ _id: { $in: caseIds }, organizationId, deletedAt: null }).select('title').lean();
    for (const row of rows) {
      labels.set(`cases:${String(row._id)}`, String(row.title || 'Case'));
    }
  }

  const orgIds = idsFor('organizations');
  if (orgIds.length > 0) {
    const rows = await Organization.find({
      _id: { $in: orgIds },
      isTenant: false,
      deletedAt: null,
      createdBy: { $in: tenantUserIds }
    })
      .select('name')
      .lean();
    for (const row of rows) {
      labels.set(`organizations:${String(row._id)}`, String(row.name || 'Organization'));
    }
  }

  const workspaceIds = idsFor('workspace');
  if (workspaceIds.length > 0) {
    const rows = await Organization.find({
      _id: { $in: workspaceIds },
      deletedAt: null
    })
      .select('name')
      .lean();
    for (const row of rows) {
      labels.set(`workspace:${String(row._id)}`, String(row.name || 'Workspace'));
    }
  }

  return labels;
}

/** Cap distinct threads loaded per request (thread keys after $group), not raw communication rows. */
const MAX_WORKSPACE_THREAD_KEYS = 2000;

function stripHtmlForSearch(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function computeReplyToAddress(sortedMessages) {
  for (let i = sortedMessages.length - 1; i >= 0; i -= 1) {
    const m = sortedMessages[i];
    if (m.direction === 'inbound' && m.fromAddress) {
      return String(m.fromAddress).trim();
    }
  }
  const last = sortedMessages[sortedMessages.length - 1];
  if (last?.direction === 'outbound' && Array.isArray(last.toAddresses) && last.toAddresses.length) {
    return String(last.toAddresses[0]).trim();
  }
  return '';
}

/**
 * Ordered thread keys by latest activity (Mongo aggregation on Communication).
 * @param {Record<string, unknown>} commQuery
 * @returns {Promise<string[]>}
 */
async function listWorkspaceThreadKeysOrdered(commQuery) {
  const pipeline = [
    { $match: commQuery },
    {
      $addFields: {
        act: { $ifNull: ['$receivedAt', { $ifNull: ['$sentAt', '$createdAt'] }] },
        threadKey: {
          $cond: [
            { $ne: [{ $ifNull: ['$threadId', null] }, null] },
            { $toString: '$threadId' },
            { $toString: '$_id' }
          ]
        }
      }
    },
    { $group: { _id: '$threadKey', lastAt: { $max: '$act' } } },
    { $sort: { lastAt: -1, _id: -1 } },
    { $limit: MAX_WORKSPACE_THREAD_KEYS }
  ];
  const rows = await Communication.aggregate(pipeline).allowDiskUse(true);
  return rows.map((r) => String(r._id));
}

/**
 * Load all communications for the given thread keys under commQuery.
 * @param {Record<string, unknown>} commQuery
 * @param {string[]} threadKeysOrdered
 */
async function loadCommunicationsForThreadKeys(commQuery, threadKeysOrdered) {
  const oidStrings = new Set();
  for (const k of threadKeysOrdered) {
    if (mongoose.Types.ObjectId.isValid(k) && String(new mongoose.Types.ObjectId(k)) === k) {
      oidStrings.add(k);
    }
  }
  const oids = [...oidStrings].map((k) => new mongoose.Types.ObjectId(k));
  const orPart = [];
  if (oids.length > 0) {
    orPart.push({ threadId: { $in: oids } });
    orPart.push({
      _id: { $in: oids },
      $or: [{ threadId: null }, { threadId: { $exists: false } }]
    });
  }
  for (const k of threadKeysOrdered) {
    if (!oidStrings.has(k)) {
      orPart.push({ threadId: k });
    }
  }
  if (orPart.length === 0) {
    return [];
  }
  return Communication.find({ ...commQuery, $or: orPart })
    .select(
      'threadId _id relatedTo subject direction fromAddress toAddresses sentAt receivedAt createdAt status scheduledAt mailboxId body gmailLabelIds'
    )
    .lean();
}

/**
 * Load workspace email thread summaries (same aggregation as GET workspace-threads, before filter/limit).
 * Thread discovery uses aggregation by thread key (up to MAX_WORKSPACE_THREAD_KEYS threads), then hydrates
 * all messages for those threads so search can include bodies without a 900-communication row cap.
 *
 * @param {import('express').Request} req
 * @param {string} mailboxIdQuery
 * @returns {Promise<{ error: { status: number, message: string } | null, threads: object[] }>}
 */
async function loadWorkspaceThreadSummaries(req, mailboxIdQuery) {
  const orgId = req.user.organizationId;
  const supportedKeys = [...SUPPORTED_MODULES];

  const commQuery = {
    organizationId: orgId,
    'relatedTo.moduleKey': { $in: supportedKeys }
  };

  if (mailboxIdQuery) {
    if (!mongoose.Types.ObjectId.isValid(mailboxIdQuery)) {
      return { error: { status: 400, message: 'Invalid mailboxId query parameter' }, threads: [] };
    }
    const mb = await Mailbox.findOne({
      _id: mailboxIdQuery,
      organizationId: orgId
    }).lean();
    if (!mb) {
      return { error: { status: 404, message: 'Mailbox not found' }, threads: [] };
    }
    if (!canUserAccessMailboxThreads(req.user, mb)) {
      return { error: { status: 403, message: 'Not allowed to view threads for this mailbox' }, threads: [] };
    }
    commQuery.mailboxId = new mongoose.Types.ObjectId(mailboxIdQuery);
  } else {
    const accessibleIds = await getAccessibleMailboxIds(req.user, orgId);
    if (accessibleIds.length === 0) {
      commQuery.mailboxId = { $in: [] };
    } else {
      // Record-linked CRM threads without mailboxId stay org-visible; workspace threads
      // without mailboxId are excluded so personal mail cannot leak across users.
      commQuery.$or = [
        { mailboxId: { $in: accessibleIds } },
        { mailboxId: null, 'relatedTo.moduleKey': { $ne: 'workspace' } },
        { mailboxId: { $exists: false }, 'relatedTo.moduleKey': { $ne: 'workspace' } }
      ];
    }
  }

  const threadKeysOrdered = await listWorkspaceThreadKeysOrdered(commQuery);
  const recent = await loadCommunicationsForThreadKeys(commQuery, threadKeysOrdered);

  const byThread = new Map();
  for (const tid of threadKeysOrdered) {
    byThread.set(tid, []);
  }
  for (const c of recent) {
    const tid = c.threadId ? String(c.threadId) : String(c._id);
    if (!byThread.has(tid)) byThread.set(tid, []);
    byThread.get(tid).push(c);
  }

  const threadIds = threadKeysOrdered.filter((k) => (byThread.get(k) || []).length > 0);
  const viewMap = new Map();
  const metaMap = new Map();
  const assigneeMap = new Map();
  if (threadIds.length > 0) {
    const [views, metas] = await Promise.all([
      ThreadView.find({
        userId: req.user._id,
        organizationId: orgId,
        threadId: { $in: threadIds }
      }).lean(),
      CommunicationThreadMeta.find({
        organizationId: orgId,
        threadId: { $in: threadIds }
      })
        .select('threadId assignedToUserId tags')
        .lean()
    ]);
    for (const v of views) {
      viewMap.set(String(v.threadId), {
        lastViewedAt: v.lastViewedAt,
        doneAt: v.doneAt || null,
        snoozedUntil: v.snoozedUntil || null
      });
    }
    for (const m of metas) {
      metaMap.set(String(m.threadId), {
        assignedToUserId: m.assignedToUserId || null,
        tags: Array.isArray(m.tags) ? m.tags : []
      });
    }
    const assigneeIds = [
      ...new Set(
        metas
          .map((m) => (m?.assignedToUserId ? String(m.assignedToUserId) : ''))
          .filter(Boolean)
      )
    ];
    if (assigneeIds.length > 0) {
      const assignees = await User.find({
        _id: { $in: assigneeIds },
        organizationId: orgId
      })
        .select('_id firstName lastName username email')
        .lean();
      for (const user of assignees) {
        const display = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
          || user.username
          || user.email
          || 'Unknown';
        assigneeMap.set(String(user._id), display);
      }
    }
  }

  const threads = [];
  for (const threadId of threadKeysOrdered) {
    const messages = byThread.get(threadId);
    if (!messages?.length) continue;

    const sorted = [...messages].sort((a, b) => {
      const da = a.sentAt || a.receivedAt || a.createdAt || 0;
      const db = b.sentAt || b.receivedAt || b.createdAt || 0;
      return new Date(da) - new Date(db);
    });
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const subject = first?.subject || '(no subject)';
    const firstActivityAt = first?.sentAt || first?.receivedAt || first?.createdAt;
    const lastActivityAt = last?.sentAt || last?.receivedAt || last?.createdAt;

    const otherAddresses = new Set();
    for (const m of sorted) {
      if (m.direction === 'outbound' && m.toAddresses?.length) {
        m.toAddresses.forEach((a) => a && otherAddresses.add(String(a).toLowerCase().trim()));
      } else if (m.direction === 'inbound' && m.fromAddress) {
        otherAddresses.add(String(m.fromAddress).toLowerCase().trim());
      }
    }
    const others = [...otherAddresses];
    const lastDir = last?.direction;
    const otherLabel =
      others.length === 0
        ? ''
        : others.length === 1
          ? others[0]
          : `${others.slice(0, 2).join(', ')}${others.length > 2 ? ` +${others.length - 2}` : ''}`;
    const participantDisplay =
      others.length === 0
        ? 'You'
        : lastDir === 'inbound'
          ? `${otherLabel} ↔ You`
          : `You ↔ ${otherLabel}`;

    const threadState = viewMap.get(threadId) || null;
    const lastViewedAt = threadState?.lastViewedAt ? new Date(threadState.lastViewedAt) : null;
    const doneAt = threadState?.doneAt ? new Date(threadState.doneAt) : null;
    const done = Boolean(doneAt);
    const unread = done
      ? false
      : lastDir === 'inbound' && lastViewedAt === null
        ? true
        : lastDir === 'inbound'
          && lastViewedAt
          && new Date(lastActivityAt) > lastViewedAt;
    const triage = computeThreadTriageHints(sorted, { unread });
    const threadMeta = metaMap.get(threadId) || { assignedToUserId: null, tags: [] };
    const relatedTo = first?.relatedTo || null;
    const threadMailboxId = first?.mailboxId ? String(first.mailboxId) : null;

    const suRaw = threadState?.snoozedUntil || null;
    const su = suRaw ? new Date(suRaw) : null;
    const snoozeActive = Boolean(su && !Number.isNaN(su.getTime()) && su.getTime() > Date.now());

    let searchBlob = '';
    for (const m of sorted) {
      searchBlob += ` ${stripHtmlForSearch(m.body)}`;
      if (searchBlob.length > 12000) break;
    }

    const anchorCommunicationId = last?._id != null ? String(last._id) : '';
    const replyToAddress = computeReplyToAddress(sorted);

    const scheduledMsgs = sorted.filter(
      (m) =>
        String(m.direction || '').toLowerCase() === 'outbound' &&
        String(m.status || '').toLowerCase() === 'scheduled'
    );
    const hasScheduledPending = scheduledMsgs.length > 0;
    let nextScheduledAt = null;
    if (hasScheduledPending) {
      const times = scheduledMsgs
        .map((m) => (m.scheduledAt ? new Date(m.scheduledAt).getTime() : NaN))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      if (times.length) nextScheduledAt = new Date(times[0]).toISOString();
    }
    const lastMessageStatus = last?.status != null ? String(last.status).toLowerCase() : '';

    const gmailLabelSet = new Set();
    for (const m of sorted) {
      for (const lid of m.gmailLabelIds || []) {
        const s = String(lid).trim();
        if (s) gmailLabelSet.add(s);
      }
    }

    threads.push({
      threadId,
      subject,
      messageCount: sorted.length,
      participantDisplay,
      lastMessageDirection: lastDir,
      lastMessageStatus,
      hasScheduledPending,
      nextScheduledAt,
      firstActivityAt,
      lastActivityAt,
      lastViewedAt: lastViewedAt || null,
      done,
      doneAt: doneAt || null,
      snoozeActive,
      snoozedUntil: suRaw ? new Date(suRaw).toISOString() : null,
      unread,
      triage,
      assignedToUserId: threadMeta.assignedToUserId,
      assignedToDisplay: threadMeta.assignedToUserId
        ? assigneeMap.get(String(threadMeta.assignedToUserId)) || null
        : null,
      tags: threadMeta.tags,
      relatedTo,
      mailboxId: threadMailboxId,
      gmailLabelIds: [...gmailLabelSet],
      anchorCommunicationId,
      replyToAddress,
      searchBlob: searchBlob.trim()
    });
  }

  const labelMap = await batchResolveRecordLabels(orgId, threads.map((t) => t.relatedTo).filter(Boolean));
  for (const t of threads) {
    const rt = t.relatedTo;
    if (rt?.moduleKey && rt?.recordId) {
      const k = `${String(rt.moduleKey).toLowerCase()}:${String(rt.recordId)}`;
      t.recordLabel = labelMap.get(k) || `${rt.moduleKey}`;
    } else {
      t.recordLabel = '—';
    }
  }

  return { error: null, threads };
}

module.exports = {
  computeThreadTriageHints,
  loadWorkspaceThreadSummaries
};
