const mongoose = require('mongoose');
const Document = require('../models/Document');
const LiveChatWebsiteContentPage = require('../models/LiveChatWebsiteContentPage');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our',
  'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way',
  'who', 'did', 'let', 'say', 'she', 'too', 'use', 'what', 'when', 'where', 'which', 'with', 'this',
  'that', 'from', 'have', 'will', 'your', 'about', 'into', 'more', 'some', 'them', 'than', 'then',
]);

function extractRichContentSearchText(richContent) {
  const html = typeof richContent === 'string'
    ? richContent
    : richContent?.html || '';
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  const words = raw.split(/\W+/).filter(Boolean);
  const tokens = new Set();

  for (const word of words) {
    if (word.length >= 2) tokens.add(word);
    if (word.length >= 3 && !STOP_WORDS.has(word)) tokens.add(word);
  }

  // Include bigrams for multi-word phrases (e.g. "live chat").
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (bigram.length >= 5) tokens.add(bigram);
  }

  return Array.from(tokens);
}

function scoreText(queryTokens, fields, rawQuery = '') {
  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += Math.min(token.length, 10);
    }
  }

  const normalizedQuery = String(rawQuery || '').trim().toLowerCase();
  if (normalizedQuery.length >= 4 && haystack.includes(normalizedQuery)) {
    score += Math.max(normalizedQuery.length, 8);
  }

  return score;
}

function extractSnippet(text, queryTokens, maxLen = 480) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;

  const lower = raw.toLowerCase();
  for (const token of queryTokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      const start = Math.max(0, idx - 80);
      const end = Math.min(raw.length, start + maxLen);
      const slice = raw.slice(start, end).trim();
      return start > 0 ? `…${slice}` : slice;
    }
  }

  return `${raw.slice(0, maxLen).trim()}…`;
}

function buildKnowledgeBaseQuery(organizationId, documentIds = []) {
  const query = {
    organizationId,
    deletedAt: null,
    status: 'published',
    $or: [
      { 'visibility.knowledgeBase': true },
      { 'visibility.portalVisible': true },
      { documentType: 'knowledge_article' },
    ],
  };
  if (documentIds.length) {
    query._id = { $in: documentIds.filter((id) => mongoose.Types.ObjectId.isValid(id)) };
  }
  return query;
}

async function loadKnowledgeBaseEntries({ organizationId, bot, queryText, limit = 50 }) {
  if (bot.useKnowledgeBase === false) return [];

  const allowlist = Array.isArray(bot.knowledgeDocumentIds)
    ? bot.knowledgeDocumentIds.map(String)
    : [];
  const kbQuery = buildKnowledgeBaseQuery(organizationId, allowlist);
  const queryTokens = tokenize(queryText);
  const rawQuery = String(queryText || '').trim();

  const rows = await Document.find(kbQuery)
    .select('title description richContentText richContent documentNumber tags documentType')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return rows.map((doc) => {
    const bodyText = doc.richContentText || extractRichContentSearchText(doc.richContent) || doc.description || '';
    const fields = [
      doc.title,
      doc.description,
      bodyText,
      Array.isArray(doc.tags) ? doc.tags.join(' ') : '',
      doc.documentNumber,
    ];
    const score = scoreText(queryTokens, fields, rawQuery);
    return {
      sourceType: 'knowledge_base',
      sourceId: doc._id,
      title: doc.title || doc.documentNumber || 'Knowledge article',
      score,
      snippet: extractSnippet(bodyText || doc.title, queryTokens),
    };
  });
}

async function loadWebsiteContentEntries({ organizationId, bot, queryText, pageUrl = '', limit = 50 }) {
  if (bot.useWebsiteContent === false) return [];

  const allowlist = Array.isArray(bot.websiteContentPageIds)
    ? bot.websiteContentPageIds.map(String)
    : [];

  const query = { organizationId, enabled: true };
  if (allowlist.length) {
    query._id = { $in: allowlist.filter((id) => mongoose.Types.ObjectId.isValid(id)) };
  }

  const rows = await LiveChatWebsiteContentPage.find(query)
    .sort({ order: 1, title: 1 })
    .limit(limit)
    .lean();

  const queryTokens = tokenize(queryText);
  const rawQuery = String(queryText || '').trim();
  const pagePath = String(pageUrl || '').toLowerCase();

  return rows.map((page) => {
    const fields = [page.title, page.body, page.pageKey, page.matchPath];
    let score = scoreText(queryTokens, fields, rawQuery);

    const matchPath = String(page.matchPath || '').trim().toLowerCase();
    if (matchPath && pagePath.includes(matchPath)) {
      score += 15;
    }

    const bodyText = page.body || page.title || '';
    if (matchPath && pagePath.includes(matchPath) && bodyText) {
      score = Math.max(score, 10);
    }

    return {
      sourceType: 'website_content',
      sourceId: page._id,
      title: page.title || page.pageKey,
      score,
      snippet: extractSnippet(bodyText, queryTokens),
    };
  });
}

async function findBestBotAnswer({ organizationId, bot, queryText, pageUrl = '' }) {
  const trimmed = String(queryText || '').trim();
  if (!trimmed || !bot) {
    return { match: null, score: 0 };
  }

  const [kbEntries, websiteEntries] = await Promise.all([
    loadKnowledgeBaseEntries({ organizationId, bot, queryText: trimmed }),
    loadWebsiteContentEntries({ organizationId, bot, queryText: trimmed, pageUrl }),
  ]);

  const candidates = [...kbEntries, ...websiteEntries]
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0] || null;
  const minScore = Number(bot.confidenceMinScore);
  const effectiveMinScore = Number.isFinite(minScore) && minScore > 0 ? minScore : 2;

  if (!best || best.score < effectiveMinScore) {
    return { match: null, score: best?.score || 0 };
  }

  return {
    match: {
      sourceType: best.sourceType,
      sourceId: best.sourceId,
      title: best.title,
      body: best.snippet,
    },
    score: best.score,
  };
}

module.exports = {
  findBestBotAnswer,
  tokenize,
};
