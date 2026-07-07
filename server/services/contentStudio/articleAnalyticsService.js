'use strict';

const crypto = require('crypto');
const ContentDocument = require('../../models/ContentDocument');
const ContentArticleAnalytics = require('../../models/ContentArticleAnalytics');
const ContentArticleFeedbackVote = require('../../models/ContentArticleFeedbackVote');
const {
  getPublicPublishingContext,
  resolveOrganizationForPublic,
} = require('./publicContentService');

const SHARE_PLATFORMS = new Set(['facebook', 'x', 'linkedin']);

function normalizeArticleSlug(value) {
  return String(value || '').trim().replace(/^\/+/, '').toLowerCase();
}

function buildPublicArticlesQuery(organizationId) {
  return {
    organizationId,
    addonKey: 'articles',
    contentType: 'knowledge_article',
    status: 'published',
    deletedAt: null,
    visibility: 'public',
  };
}

function buildVisitorHash({ organizationId, contentDocumentId, ipAddress, userAgent }) {
  return crypto
    .createHash('sha256')
    .update([
      String(organizationId),
      String(contentDocumentId),
      String(ipAddress || ''),
      String(userAgent || ''),
    ].join('|'))
    .digest('hex');
}

function shapeArticleAnalytics(row) {
  if (!row) {
    return {
      helpfulYes: 0,
      helpfulNo: 0,
      helpfulTotal: 0,
      helpfulRate: 0,
      sharesFacebook: 0,
      sharesX: 0,
      sharesLinkedin: 0,
      sharesTotal: 0,
      lastFeedbackAt: null,
    };
  }

  const helpfulYes = Math.max(0, Number(row.helpfulYes) || 0);
  const helpfulNo = Math.max(0, Number(row.helpfulNo) || 0);
  const helpfulTotal = helpfulYes + helpfulNo;
  const sharesFacebook = Math.max(0, Number(row.sharesFacebook) || 0);
  const sharesX = Math.max(0, Number(row.sharesX) || 0);
  const sharesLinkedin = Math.max(0, Number(row.sharesLinkedin) || 0);

  return {
    helpfulYes,
    helpfulNo,
    helpfulTotal,
    helpfulRate: helpfulTotal > 0 ? Math.round((helpfulYes / helpfulTotal) * 1000) / 10 : 0,
    sharesFacebook,
    sharesX,
    sharesLinkedin,
    sharesTotal: sharesFacebook + sharesX + sharesLinkedin,
    lastFeedbackAt: row.lastFeedbackAt || null,
  };
}

async function resolvePublicPublishedArticle(orgSlug, articleSlug) {
  const org = await resolveOrganizationForPublic(orgSlug);
  if (!org) return null;

  const context = await getPublicPublishingContext(org);
  if (!context?.allowed) return null;

  const doc = await ContentDocument.findOne({
    ...buildPublicArticlesQuery(org._id),
    slug: normalizeArticleSlug(articleSlug),
  }).lean();

  if (!doc) return null;
  return { org, doc };
}

async function getArticleAnalytics({ organizationId, contentDocumentId }) {
  const row = await ContentArticleAnalytics.findOne({
    organizationId,
    contentDocumentId,
  }).lean();
  return shapeArticleAnalytics(row);
}

async function recordHelpfulVote({ doc, helpful, ipAddress, userAgent }) {
  const vote = helpful === true || helpful === 'yes' ? 'yes' : 'no';
  const visitorHash = buildVisitorHash({
    organizationId: doc.organizationId,
    contentDocumentId: doc._id,
    ipAddress,
    userAgent,
  });

  const existing = await ContentArticleFeedbackVote.findOne({
    organizationId: doc.organizationId,
    contentDocumentId: doc._id,
    visitorHash,
  }).lean();

  if (existing?.vote === vote) {
    const analytics = await getArticleAnalytics({
      organizationId: doc.organizationId,
      contentDocumentId: doc._id,
    });
    return { duplicate: true, analytics };
  }

  await ContentArticleFeedbackVote.findOneAndUpdate(
    {
      organizationId: doc.organizationId,
      contentDocumentId: doc._id,
      visitorHash,
    },
    { $set: { vote } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const inc = {};
  inc[vote === 'yes' ? 'helpfulYes' : 'helpfulNo'] = 1;
  if (existing) {
    inc[existing.vote === 'yes' ? 'helpfulYes' : 'helpfulNo'] = -1;
  }

  const analyticsRow = await ContentArticleAnalytics.findOneAndUpdate(
    {
      organizationId: doc.organizationId,
      contentDocumentId: doc._id,
    },
    {
      $inc: inc,
      $set: {
        lastFeedbackAt: new Date(),
        articleSlug: doc.slug,
      },
      $setOnInsert: {
        organizationId: doc.organizationId,
        contentDocumentId: doc._id,
        sharesFacebook: 0,
        sharesX: 0,
        sharesLinkedin: 0,
      },
    },
    { upsert: true, new: true },
  ).lean();

  return { duplicate: false, analytics: shapeArticleAnalytics(analyticsRow) };
}

async function recordShare({ doc, platform }) {
  const field = platform === 'facebook'
    ? 'sharesFacebook'
    : platform === 'linkedin'
      ? 'sharesLinkedin'
      : 'sharesX';

  const analyticsRow = await ContentArticleAnalytics.findOneAndUpdate(
    {
      organizationId: doc.organizationId,
      contentDocumentId: doc._id,
    },
    {
      $inc: { [field]: 1 },
      $set: {
        lastFeedbackAt: new Date(),
        articleSlug: doc.slug,
      },
      $setOnInsert: {
        organizationId: doc.organizationId,
        contentDocumentId: doc._id,
        helpfulYes: 0,
        helpfulNo: 0,
        sharesFacebook: 0,
        sharesX: 0,
        sharesLinkedin: 0,
      },
    },
    { upsert: true, new: true },
  ).lean();

  return shapeArticleAnalytics(analyticsRow);
}

async function submitPublicArticleFeedback({
  orgSlug,
  articleSlug,
  helpful,
  action,
  platform,
  ipAddress,
  userAgent,
}) {
  const resolved = await resolvePublicPublishedArticle(orgSlug, articleSlug);
  if (!resolved) {
    const error = new Error('Article not found');
    error.statusCode = 404;
    throw error;
  }

  if (action === 'share') {
    const normalizedPlatform = String(platform || '').trim().toLowerCase();
    if (!SHARE_PLATFORMS.has(normalizedPlatform)) {
      const error = new Error('Invalid share platform');
      error.statusCode = 400;
      throw error;
    }
    const analytics = await recordShare({ doc: resolved.doc, platform: normalizedPlatform });
    return { analytics };
  }

  if (typeof helpful !== 'boolean') {
    const error = new Error('helpful must be a boolean');
    error.statusCode = 400;
    throw error;
  }

  return recordHelpfulVote({
    doc: resolved.doc,
    helpful,
    ipAddress,
    userAgent,
  });
}

module.exports = {
  SHARE_PLATFORMS,
  buildVisitorHash,
  shapeArticleAnalytics,
  getArticleAnalytics,
  submitPublicArticleFeedback,
};
