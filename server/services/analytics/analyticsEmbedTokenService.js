const crypto = require('crypto');
const AnalyticsEmbedToken = require('../../models/AnalyticsEmbedToken');
const AnalyticsDashboard = require('../../models/AnalyticsDashboard');
const { ANALYTICS_EMBED_TOKEN_PREFIX } = require('../../constants/analyticsEmbedToken');
const { hashToken } = require('../../utils/userAuthTokens');

function generateRawEmbedToken() {
  return `${ANALYTICS_EMBED_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function tokenDisplayPrefix(rawToken) {
  return String(rawToken || '').slice(0, ANALYTICS_EMBED_TOKEN_PREFIX.length + 8);
}

async function listEmbedTokensForDashboard(dashboardId, organizationId) {
  return AnalyticsEmbedToken.find({ dashboardId, organizationId })
    .sort({ createdAt: -1 })
    .select('-tokenHash')
    .lean();
}

async function createEmbedToken(organizationId, user, dashboardId, body = {}) {
  const name = String(body.name || 'Embed link').trim();
  const dashboard = await AnalyticsDashboard.findOne({
    _id: dashboardId,
    organizationId,
    status: 'published',
  })
    .select('_id name')
    .lean();

  if (!dashboard) {
    const err = new Error('Published dashboard not found');
    err.statusCode = 404;
    throw err;
  }

  const rawToken = generateRawEmbedToken();
  const doc = await AnalyticsEmbedToken.create({
    organizationId,
    dashboardId: dashboard._id,
    name,
    tokenPrefix: tokenDisplayPrefix(rawToken),
    tokenHash: hashToken(rawToken),
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    createdBy: user._id,
    status: 'active',
  });

  const safe = doc.toObject();
  delete safe.tokenHash;

  return {
    token: rawToken,
    embedPath: `/analytics/embed/dashboard?token=${encodeURIComponent(rawToken)}`,
    data: safe,
  };
}

async function revokeEmbedToken(id, organizationId, user) {
  const doc = await AnalyticsEmbedToken.findOne({ _id: id, organizationId });
  if (!doc) {
    const err = new Error('Embed token not found');
    err.statusCode = 404;
    throw err;
  }
  doc.status = 'revoked';
  doc.revokedAt = new Date();
  doc.revokedBy = user._id;
  await doc.save();
  return doc.toObject();
}

async function resolveEmbedTokenFromRaw(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token.startsWith(ANALYTICS_EMBED_TOKEN_PREFIX)) return null;

  const doc = await AnalyticsEmbedToken.findOne({
    tokenHash: hashToken(token),
    status: 'active',
  }).lean();

  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) return null;
  return doc;
}

async function touchEmbedTokenLastUsed(tokenId) {
  await AnalyticsEmbedToken.updateOne({ _id: tokenId }, { $set: { lastUsedAt: new Date() } });
}

module.exports = {
  listEmbedTokensForDashboard,
  createEmbedToken,
  revokeEmbedToken,
  resolveEmbedTokenFromRaw,
  touchEmbedTokenLastUsed,
};
