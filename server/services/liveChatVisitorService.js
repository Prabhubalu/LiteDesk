const LiveChatVisitor = require('../models/LiveChatVisitor');
const ChatSession = require('../models/ChatSession');
const { buildChatSessionScopeFilter } = require('../utils/liveChatSessionQueryUtils');

function normalizeVisitorPayload(visitor = {}) {
  return {
    name: String(visitor.name || '').trim(),
    email: String(visitor.email || '').trim().toLowerCase(),
    phone: String(visitor.phone || '').trim(),
    externalId: String(visitor.externalId || '').trim(),
  };
}

async function findExistingVisitor(organizationId, normalized) {
  if (normalized.externalId) {
    const byExternal = await LiveChatVisitor.findOne({
      organizationId,
      externalId: normalized.externalId,
    }).lean();
    if (byExternal) return byExternal;
  }

  if (normalized.email) {
    return LiveChatVisitor.findOne({
      organizationId,
      email: normalized.email,
    }).lean();
  }

  return null;
}

/**
 * Resolve or create a visitor profile for embed session creation.
 */
async function resolveOrCreateVisitor({
  organizationId,
  visitor,
  pageUrl = '',
  userAgent = '',
  ip = '',
}) {
  if (!organizationId) return null;

  const normalized = normalizeVisitorPayload(visitor);
  const now = new Date();
  const existing = await findExistingVisitor(organizationId, normalized);

  if (existing) {
    await LiveChatVisitor.updateOne(
      { _id: existing._id },
      {
        $set: {
          name: normalized.name || existing.name || '',
          email: normalized.email || existing.email || '',
          phone: normalized.phone || existing.phone || '',
          externalId: normalized.externalId || existing.externalId || '',
          lastSeenAt: now,
          lastPageUrl: String(pageUrl || '').trim(),
          userAgent: String(userAgent || '').trim(),
          ip: String(ip || '').trim(),
        },
      },
    );
    return existing._id;
  }

  const created = await LiveChatVisitor.create({
    organizationId,
    ...normalized,
    sessionCount: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    lastPageUrl: String(pageUrl || '').trim(),
    userAgent: String(userAgent || '').trim(),
    ip: String(ip || '').trim(),
  });

  return created._id;
}

async function incrementVisitorSessionCount(visitorId) {
  if (!visitorId) return;
  await LiveChatVisitor.updateOne({ _id: visitorId }, { $inc: { sessionCount: 1 } });
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapVisitorRow(row) {
  return {
    _id: row._id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    externalId: row.externalId || '',
    sessionCount: row.sessionCount || 0,
    linkedRecords: Array.isArray(row.linkedRecords) ? row.linkedRecords : [],
    firstSeenAt: row.firstSeenAt || null,
    lastSeenAt: row.lastSeenAt || null,
    lastPageUrl: row.lastPageUrl || '',
  };
}

function mapSessionSummary(row) {
  return {
    _id: row._id,
    sessionKey: row.sessionKey || null,
    status: row.status || 'open',
    lifecycleStatus: row.lifecycleStatus || 'waiting',
    outcome: row.outcome || null,
    visitor: row.visitor || {},
    pageUrl: row.pageUrl || '',
    createdAt: row.createdAt,
    lastMessageAt: row.lastMessageAt || null,
    endedAt: row.endedAt || null,
  };
}

async function listVisitorsForOrganization(organizationId, { search = '', limit = 50, skip = 0 } = {}) {
  const filter = { organizationId };
  const q = String(search || '').trim();
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { externalId: regex }];
  }

  const [rows, total] = await Promise.all([
    LiveChatVisitor.find(filter)
      .sort({ lastSeenAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LiveChatVisitor.countDocuments(filter),
  ]);

  return {
    rows: rows.map(mapVisitorRow),
    total,
  };
}

async function getVisitorForOrganization(organizationId, visitorId) {
  const row = await LiveChatVisitor.findOne({ _id: visitorId, organizationId }).lean();
  return row ? mapVisitorRow(row) : null;
}

async function listSessionsForVisitor(organizationId, visitorId, limit = 20) {
  const scope = buildChatSessionScopeFilter(organizationId);
  const rows = await ChatSession.find({ visitorId, ...scope })
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(mapSessionSummary);
}

module.exports = {
  resolveOrCreateVisitor,
  incrementVisitorSessionCount,
  listVisitorsForOrganization,
  getVisitorForOrganization,
  listSessionsForVisitor,
  mapVisitorRow,
  mapSessionSummary,
};
