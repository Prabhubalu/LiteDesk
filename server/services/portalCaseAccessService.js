const People = require('../models/People');
const User = require('../models/User');
const Case = require('../models/Case');
const { getPortalUserEmail } = require('../platform/mailroom/connectors/portal/portalSafety');
const { resolvePortalAudience } = require('../platform/mailroom/connectors/portal/portalAudience');
const { mergePortalConnector } = require('../platform/mailroom/connectors/portal/portalConnectorDefaults');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PORTAL_CASE_CHANNELS = new Set(['Customer Portal', 'Partner Portal']);

function isPortalChannelCase(caseRecord) {
  return PORTAL_CASE_CHANNELS.has(String(caseRecord?.channel || ''));
}

async function resolvePortalCaseRequesterUserIds(organizationId, caseRecord) {
  const userIds = new Set();

  if (caseRecord?.contactId) {
    const person = await People.findOne({
      _id: caseRecord.contactId,
      organizationId,
      deletedAt: null
    })
      .select('portalAccess')
      .lean();
    if (person?.portalAccess?.enabled && person.portalAccess.userId) {
      userIds.add(String(person.portalAccess.userId));
    }
  }

  const email = String(caseRecord?.requesterEmail || '').trim();
  if (email) {
    const people = await People.find({
      organizationId,
      deletedAt: null,
      email: new RegExp(`^${escapeRegex(email)}$`, 'i'),
      'portalAccess.enabled': true,
      'portalAccess.userId': { $ne: null }
    })
      .select('portalAccess.userId')
      .lean();
    for (const person of people) {
      if (person.portalAccess?.userId) {
        userIds.add(String(person.portalAccess.userId));
      }
    }
  }

  if (!userIds.size) {
    return [];
  }

  const activeUsers = await User.find({
    _id: { $in: Array.from(userIds) },
    organizationId,
    userType: 'EXTERNAL',
    status: { $in: ['active', null] }
  })
    .select('_id')
    .lean();

  return activeUsers.map((row) => String(row._id));
}

async function resolvePortalContactIds(organizationId, userEmail) {
  if (!userEmail) return [];
  const rows = await People.find({
    organizationId,
    deletedAt: null,
    email: new RegExp(`^${escapeRegex(userEmail)}$`, 'i')
  })
    .select('_id')
    .lean();
  return rows.map((r) => r._id);
}

async function buildCustomerCaseAccessQuery(organizationId, user) {
  const email = getPortalUserEmail(user);
  const contactIds = await resolvePortalContactIds(organizationId, email);
  if (user?.peopleId) {
    contactIds.push(user.peopleId);
  }
  const uniqueContactIds = [...new Set(contactIds.map((id) => String(id)))];
  const or = [];
  if (email) {
    or.push({ requesterEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') });
  }
  if (uniqueContactIds.length) {
    or.push({ contactId: { $in: uniqueContactIds } });
  }
  if (!or.length) {
    return { organizationId, deletedAt: null, _id: null };
  }
  return {
    organizationId,
    deletedAt: null,
    $or: or
  };
}

/**
 * Partner users: cases linked to their contact record or customer organization they represent.
 */
async function buildPartnerCaseAccessQuery(organizationId, user) {
  const email = getPortalUserEmail(user);
  const or = [];

  const person = email
    ? await People.findOne({
      organizationId,
      deletedAt: null,
      email: new RegExp(`^${escapeRegex(email)}$`, 'i')
    })
      .select('_id organization')
      .lean()
    : null;

  if (user?.peopleId) {
    or.push({ contactId: user.peopleId });
  }
  if (person?._id) {
    or.push({ contactId: person._id });
  }
  if (person?.organization) {
    or.push({ organizationRefId: person.organization });
  }
  if (email) {
    or.push({ requesterEmail: new RegExp(`^${escapeRegex(email)}$`, 'i') });
  }

  if (!or.length) {
    return { organizationId, deletedAt: null, _id: null };
  }
  return {
    organizationId,
    deletedAt: null,
    $or: or
  };
}

async function buildPortalCaseAccessQuery(organizationId, user, options = {}) {
  const portalConfig = mergePortalConnector(options.portalConfig || {});
  const audience = options.audience
    || await resolvePortalAudience(user, portalConfig);

  if (audience === 'partner') {
    return buildPartnerCaseAccessQuery(organizationId, user);
  }
  return buildCustomerCaseAccessQuery(organizationId, user);
}

async function findPortalAccessibleCase(organizationId, caseId, user, options = {}) {
  const base = await buildPortalCaseAccessQuery(organizationId, user, options);
  return Case.findOne({
    ...base,
    _id: caseId
  }).lean();
}

function filterPortalActivities(activities = []) {
  return activities.filter((act) => act && act.internal !== true);
}

function isPortalCaseClosedStatus(status) {
  const value = String(status || '');
  return value === 'Closed' || value === 'Resolved';
}

function shapePortalCaseSummary(row) {
  const status = row.status;
  return {
    _id: row._id,
    caseId: row.caseId,
    title: row.title,
    description: row.description,
    status,
    priority: row.priority,
    channel: row.channel,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isClosed: isPortalCaseClosedStatus(status),
    needsCustomerAction: status === 'Waiting for Customer'
  };
}

function getPortalReadAt(row, userId) {
  const receipts = Array.isArray(row?.portalReadReceipts) ? row.portalReadReceipts : [];
  const match = receipts.find((entry) => String(entry?.userId) === String(userId));
  return match?.readAt ? new Date(match.readAt) : null;
}

function computePortalCaseUnread(row, userId) {
  if (isPortalCaseClosedStatus(row?.status)) return false;
  if (row?.status === 'Waiting for Customer') return true;
  const updatedAt = row?.updatedAt ? new Date(row.updatedAt).getTime() : 0;
  if (!updatedAt) return false;
  const readAt = getPortalReadAt(row, userId);
  if (!readAt) return true;
  return updatedAt > readAt.getTime();
}

function shapePortalCsat(row) {
  const csat = row?.portalCsat;
  if (!csat?.submittedAt || csat.score == null) {
    return { csatSubmitted: false, csatScore: null };
  }
  return {
    csatSubmitted: true,
    csatScore: csat.score
  };
}

function enrichPortalCaseSummary(row, userId) {
  const csat = shapePortalCsat(row);
  return {
    ...shapePortalCaseSummary(row),
    ...csat,
    isUnread: computePortalCaseUnread(row, userId)
  };
}

function enrichPortalCaseDetail(row, activities, userId) {
  const csat = shapePortalCsat(row);
  return {
    ...shapePortalCaseSummary(row),
    requesterEmail: row.requesterEmail,
    activities: filterPortalActivities(activities),
    ...csat,
    csatComment: row?.portalCsat?.comment || null,
    isUnread: false
  };
}

async function markPortalCaseRead(organizationId, caseId, userId, options = {}) {
  const row = await findPortalAccessibleCase(organizationId, caseId, options.user, options);
  if (!row) return null;

  const now = new Date();
  await Case.updateOne(
    { _id: row._id, organizationId },
    {
      $pull: { portalReadReceipts: { userId } },
    }
  );
  await Case.updateOne(
    { _id: row._id, organizationId },
    {
      $push: {
        portalReadReceipts: {
          userId,
          readAt: now
        }
      }
    }
  );
  return now;
}

async function submitPortalCaseCsat(organizationId, caseId, userId, { score, comment } = {}, options = {}) {
  const row = await findPortalAccessibleCase(organizationId, caseId, options.user, options);
  if (!row) return { ok: false, code: 'NOT_FOUND' };
  if (!isPortalCaseClosedStatus(row.status)) {
    return { ok: false, code: 'NOT_CLOSED' };
  }
  if (row?.portalCsat?.submittedAt) {
    return { ok: false, code: 'ALREADY_SUBMITTED' };
  }

  const numericScore = Number(score);
  if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
    return { ok: false, code: 'INVALID_SCORE' };
  }

  const trimmedComment = comment != null ? String(comment).trim().slice(0, 2000) : null;
  const now = new Date();

  await Case.updateOne(
    { _id: row._id, organizationId },
    {
      $set: {
        portalCsat: {
          score: numericScore,
          comment: trimmedComment || null,
          submittedAt: now,
          submittedBy: userId
        }
      },
      $push: {
        activities: {
          activityType: 'portal_csat_submitted',
          message: `Customer rated support ${numericScore}/5`,
          internal: true,
          metadata: {
            source: 'portal',
            score: numericScore,
            hasComment: Boolean(trimmedComment)
          },
          actorId: userId,
          createdAt: now
        }
      }
    }
  );

  return { ok: true, score: numericScore, submittedAt: now };
}

function shapePortalCaseDetail(row, activities) {
  return enrichPortalCaseDetail(row, activities, null);
}

module.exports = {
  buildPortalCaseAccessQuery,
  buildCustomerCaseAccessQuery,
  buildPartnerCaseAccessQuery,
  findPortalAccessibleCase,
  filterPortalActivities,
  isPortalCaseClosedStatus,
  shapePortalCaseSummary,
  shapePortalCaseDetail,
  enrichPortalCaseSummary,
  enrichPortalCaseDetail,
  computePortalCaseUnread,
  markPortalCaseRead,
  submitPortalCaseCsat,
  isPortalChannelCase,
  resolvePortalCaseRequesterUserIds,
  resolvePortalAudience
};
