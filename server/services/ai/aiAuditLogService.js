const mongoose = require('mongoose');
const AiAuditLog = require('../../models/AiAuditLog');

function parsePositiveInt(value, fallback, max = 100) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/**
 * Historical rows stored creditsDebited in credit units (1 ≈ 1k tokens).
 * New rows store raw tokens. Detect legacy when debit ≪ usage tokens.
 */
function toTokensBilled(creditsDebited, usageTotalTokens) {
  const debited = Math.max(0, Number(creditsDebited) || 0);
  if (debited <= 0) return 0;
  const total = Math.max(0, Number(usageTotalTokens) || 0);
  if (total > 0 && debited * 500 < total) {
    return Math.floor(debited * 1000);
  }
  return Math.floor(debited);
}

const tokensBilledExpr = {
  $cond: [
    {
      $and: [
        { $gt: ['$creditsDebited', 0] },
        { $gt: ['$usage.totalTokens', 0] },
        { $lt: [{ $multiply: ['$creditsDebited', 500] }, '$usage.totalTokens'] },
      ],
    },
    { $multiply: ['$creditsDebited', 1000] },
    '$creditsDebited',
  ],
};

function buildListFilter({
  organizationId,
  abilityKey = null,
  status = null,
  userId = null,
  from = null,
  to = null,
}) {
  const filter = { organizationId };
  if (abilityKey) filter.abilityKey = String(abilityKey).trim();
  if (status) filter.status = String(status).trim();
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    filter.userId = new mongoose.Types.ObjectId(String(userId));
  }
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  return filter;
}

function serializeAuditLogRow(doc) {
  const row = doc?.toObject ? doc.toObject() : doc;
  const user = row.userId && typeof row.userId === 'object' ? row.userId : null;
  const tokensBilled = toTokensBilled(row.creditsDebited, row.usage?.totalTokens);
  return {
    id: String(row._id),
    abilityKey: row.abilityKey,
    provider: row.provider,
    model: row.model,
    keyMode: row.keyMode,
    promptVersion: row.promptVersion,
    status: row.status,
    contextRefs: row.contextRefs || [],
    usage: row.usage || {},
    creditsDebited: tokensBilled,
    tokensBilled,
    latencyMs: Number(row.latencyMs || 0),
    errorCode: row.errorCode || null,
    errorMessage: row.errorMessage || null,
    metadata: row.metadata || null,
    createdAt: row.createdAt,
    user: user
      ? {
          id: String(user._id),
          name: [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
            || user.email
            || String(user._id),
          email: user.email || null,
        }
      : null,
  };
}

async function getAiUsageSummary({
  organizationId,
  days = 30,
  from = null,
  to = null,
  abilityKey = null,
  status = null,
}) {
  const match = { organizationId };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  } else {
    const safeDays = Math.min(Math.max(Number(days) || 30, 1), 3650);
    match.createdAt = { $gte: new Date(Date.now() - safeDays * 86400000) };
  }
  if (abilityKey) match.abilityKey = String(abilityKey).trim();
  if (status) match.status = String(status).trim();

  const [totalsAgg, byAbilityAgg] = await Promise.all([
    AiAuditLog.aggregate([
      { $match: match },
      { $addFields: { tokensBilled: tokensBilledExpr } },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalPromptTokens: { $sum: '$usage.promptTokens' },
          totalCompletionTokens: { $sum: '$usage.completionTokens' },
          totalTokens: { $sum: '$usage.totalTokens' },
          totalCreditsDebited: { $sum: '$tokensBilled' },
        },
      },
    ]),
    AiAuditLog.aggregate([
      { $match: match },
      { $addFields: { tokensBilled: tokensBilledExpr } },
      {
        $group: {
          _id: '$abilityKey',
          calls: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          creditsDebited: { $sum: '$tokensBilled' },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: 40 },
    ]),
  ]);

  const totals = totalsAgg[0] || {};
  return {
    from: from || null,
    to: to || null,
    totalCalls: totals.totalCalls || 0,
    totalPromptTokens: totals.totalPromptTokens || 0,
    totalCompletionTokens: totals.totalCompletionTokens || 0,
    totalTokens: totals.totalTokens || 0,
    totalCreditsDebited: totals.totalCreditsDebited || 0,
    totalTokensBilled: totals.totalCreditsDebited || 0,
    byAbility: byAbilityAgg.map((row) => ({
      abilityKey: row._id,
      calls: row.calls,
      totalTokens: row.totalTokens,
      creditsDebited: row.creditsDebited,
      tokensBilled: row.creditsDebited,
    })),
  };
}

async function listAiAuditLogs({
  organizationId,
  page = 1,
  limit = 25,
  abilityKey = null,
  status = null,
  userId = null,
  from = null,
  to = null,
  includeSummary = true,
  summaryDays = 30,
}) {
  const safePage = parsePositiveInt(page, 1);
  const safeLimit = parsePositiveInt(limit, 25, 100);
  const filter = buildListFilter({
    organizationId,
    abilityKey,
    status,
    userId,
    from,
    to,
  });
  const skip = (safePage - 1) * safeLimit;

  const [total, rows] = await Promise.all([
    AiAuditLog.countDocuments(filter),
    AiAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .populate('userId', 'firstName lastName email')
      .lean(),
  ]);

  let summary = null;
  if (includeSummary) {
    summary = await getAiUsageSummary({
      organizationId,
      days: summaryDays,
      from,
      to,
      abilityKey,
      status,
    });
  }

  return {
    items: rows.map(serializeAuditLogRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
    summary,
  };
}

async function writeAiAuditLog({
  organizationId,
  userId,
  abilityKey,
  provider,
  model,
  keyMode,
  promptVersion = 'v0',
  status,
  contextRefs = [],
  usage = {},
  creditsDebited = 0,
  latencyMs = 0,
  errorCode = null,
  errorMessage = null,
  metadata = null,
}) {
  try {
    // creditsDebited field stores tokens billed (platform metering).
    await AiAuditLog.create({
      organizationId,
      userId: userId || null,
      abilityKey,
      provider,
      model,
      keyMode,
      promptVersion,
      status,
      contextRefs,
      usage: {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0,
      },
      creditsDebited: Math.max(0, Math.floor(Number(creditsDebited) || 0)),
      latencyMs,
      errorCode,
      errorMessage,
      metadata,
    });
  } catch (error) {
    console.error('[AiAuditLog] failed to write audit row:', error);
  }
}

module.exports = {
  buildListFilter,
  serializeAuditLogRow,
  getAiUsageSummary,
  listAiAuditLogs,
  writeAiAuditLog,
  toTokensBilled,
};
