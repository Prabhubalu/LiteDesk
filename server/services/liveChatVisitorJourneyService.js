'use strict';

const LiveChatVisitorJourneyEvent = require('../models/LiveChatVisitorJourneyEvent');
const {
  LIVE_CHAT_JOURNEY_ACTIONS,
  normalizeJourneyAction,
  normalizePageUrl,
  normalizeReferrerUrl,
} = require('../constants/liveChatVisitorContext');
const { parseUserAgent } = require('../utils/liveChatUserAgentUtils');
const {
  resolveCountryFromRequest,
  resolveLanguageFromRequest,
} = require('../utils/liveChatGeoUtils');

function buildSessionVisitorContextFromRequest(req, body = {}) {
  const userAgent = String(req?.headers?.['user-agent'] || '');
  const parsed = parseUserAgent(userAgent);
  const pageUrl = normalizePageUrl(body.pageUrl);
  const referrerUrl = normalizeReferrerUrl(body.referrerUrl);

  return {
    pageUrl,
    entryPage: pageUrl,
    referrerUrl,
    userAgent,
    browser: parsed.browser,
    operatingSystem: parsed.operatingSystem,
    deviceType: parsed.deviceType,
    country: resolveCountryFromRequest(req),
    language: resolveLanguageFromRequest(req, body.language),
  };
}

async function recordJourneyEvent({
  organizationId,
  sessionId,
  page,
  action = LIVE_CHAT_JOURNEY_ACTIONS.PAGE_VIEW,
}) {
  if (!organizationId || !sessionId) return { recorded: false };

  const normalizedPage = normalizePageUrl(page);
  if (!normalizedPage) return { recorded: false, reason: 'empty_page' };

  const row = await LiveChatVisitorJourneyEvent.create({
    organizationId,
    sessionId,
    page: normalizedPage,
    action: normalizeJourneyAction(action),
  });

  return { recorded: true, eventId: row._id };
}

async function listJourneyEventsForSession({ organizationId, sessionId, limit = 100 }) {
  if (!organizationId || !sessionId) return [];

  const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return LiveChatVisitorJourneyEvent.find({ organizationId, sessionId })
    .sort({ createdAt: 1 })
    .limit(cappedLimit)
    .lean();
}

module.exports = {
  buildSessionVisitorContextFromRequest,
  recordJourneyEvent,
  listJourneyEventsForSession,
};
