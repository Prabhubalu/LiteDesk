const crypto = require('crypto');
const AnalyticsApiToken = require('../../models/AnalyticsApiToken');
const User = require('../../models/User');
const {
  ANALYTICS_API_TOKEN_PREFIX,
  ANALYTICS_API_TOKEN_SCOPES,
  DEFAULT_ANALYTICS_API_TOKEN_SCOPES,
} = require('../../constants/analyticsApiToken');
const { hashToken } = require('../../utils/userAuthTokens');

function generateRawAnalyticsApiToken() {
  return `${ANALYTICS_API_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

function tokenDisplayPrefix(rawToken) {
  const raw = String(rawToken || '');
  return raw.slice(0, ANALYTICS_API_TOKEN_PREFIX.length + 8);
}

function parseScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length) {
    return [...DEFAULT_ANALYTICS_API_TOKEN_SCOPES];
  }
  const normalized = scopes.filter((s) => ANALYTICS_API_TOKEN_SCOPES.includes(s));
  return normalized.length ? normalized : [...DEFAULT_ANALYTICS_API_TOKEN_SCOPES];
}

function parseAllowedReportIds(ids) {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => id);
}

async function listApiTokens(organizationId) {
  return AnalyticsApiToken.find({ organizationId })
    .sort({ createdAt: -1 })
    .populate('actorUserId', 'firstName lastName email')
    .populate('createdBy', 'firstName lastName email')
    .select('-tokenHash')
    .lean();
}

async function createApiToken(organizationId, user, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Token name is required');
    err.statusCode = 400;
    throw err;
  }

  const actorUserId = body.actorUserId || user._id;
  const actor = await User.findOne({ _id: actorUserId, organizationId }).select('_id').lean();
  if (!actor) {
    const err = new Error('Actor user not found in organization');
    err.statusCode = 400;
    throw err;
  }

  const rawToken = generateRawAnalyticsApiToken();
  const doc = await AnalyticsApiToken.create({
    organizationId,
    name,
    tokenPrefix: tokenDisplayPrefix(rawToken),
    tokenHash: hashToken(rawToken),
    scopes: parseScopes(body.scopes),
    allowedReportIds: parseAllowedReportIds(body.allowedReportIds),
    actorUserId: actor._id,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    createdBy: user._id,
    status: 'active',
  });

  const safe = doc.toObject();
  delete safe.tokenHash;

  return {
    token: rawToken,
    data: safe,
  };
}

async function revokeApiToken(id, organizationId, user) {
  const doc = await AnalyticsApiToken.findOne({ _id: id, organizationId });
  if (!doc) {
    const err = new Error('API token not found');
    err.statusCode = 404;
    throw err;
  }
  doc.status = 'revoked';
  doc.revokedAt = new Date();
  doc.revokedBy = user._id;
  await doc.save();
  return doc.toObject();
}

async function resolveApiTokenFromRaw(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token.startsWith(ANALYTICS_API_TOKEN_PREFIX)) {
    return null;
  }

  const doc = await AnalyticsApiToken.findOne({
    tokenHash: hashToken(token),
    status: 'active',
  }).lean();

  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return doc;
}

async function loadActorUserForToken(tokenDoc) {
  return User.findOne({
    _id: tokenDoc.actorUserId,
    organizationId: tokenDoc.organizationId,
  }).select('-password');
}

function tokenAllowsReport(tokenDoc, reportId) {
  const allowed = tokenDoc.allowedReportIds || [];
  if (!allowed.length) return true;
  return allowed.some((id) => String(id) === String(reportId));
}

function tokenHasScope(tokenDoc, scope) {
  return (tokenDoc.scopes || []).includes(scope);
}

async function touchTokenLastUsed(tokenId) {
  await AnalyticsApiToken.updateOne({ _id: tokenId }, { $set: { lastUsedAt: new Date() } });
}

module.exports = {
  listApiTokens,
  createApiToken,
  revokeApiToken,
  resolveApiTokenFromRaw,
  loadActorUserForToken,
  tokenAllowsReport,
  tokenHasScope,
  touchTokenLastUsed,
};
