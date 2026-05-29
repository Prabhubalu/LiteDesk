/**
 * Customer ↔ team comment thread on public quote portal (RecordActivity).
 */

const mongoose = require('mongoose');
const RecordActivity = require('../models/RecordActivity');

const MAX_COMMENT_LENGTH = 2000;

function formatAuthorLabel(entry) {
  const isCustomer = !entry.author && entry.details?.actorLabel === 'customer';
  if (isCustomer) {
    const name = String(entry.details?.signerName || '').trim();
    return name || 'Customer';
  }
  const author = entry.author;
  if (author) {
    const name = `${(author.firstName || '').trim()} ${(author.lastName || '').trim()}`.trim();
    return name || author.username || author.email || 'Team';
  }
  return 'Team';
}

function serializePortalComment(entry) {
  const isCustomer = !entry.author && entry.details?.actorLabel === 'customer';
  return {
    id: String(entry._id),
    content: entry.content || '',
    authorLabel: formatAuthorLabel(entry),
    isCustomer,
    createdAt: entry.createdAt ? new Date(entry.createdAt).toISOString() : null
  };
}

/**
 * @param {string|import('mongoose').Types.ObjectId} organizationId
 * @param {string|import('mongoose').Types.ObjectId} quoteId
 */
async function listPortalComments(organizationId, quoteId) {
  const rows = await RecordActivity.find({
    organizationId,
    moduleKey: 'quotes',
    recordId: new mongoose.Types.ObjectId(quoteId),
    type: 'comment',
    'details.portalThread': true
  })
    .populate('author', 'firstName lastName email username')
    .sort({ createdAt: 1 })
    .lean();

  return rows.map(serializePortalComment);
}

/**
 * @param {object} params
 * @param {import('mongoose').Document} params.quote
 * @param {string} params.content
 * @param {string|null} params.signerName
 */
async function createCustomerPortalComment({ quote, content, signerName = null }) {
  const normalized = String(content || '').trim();
  if (!normalized) {
    const err = new Error('Comment cannot be empty.');
    err.code = 'VALIDATION';
    throw err;
  }
  if (normalized.length > MAX_COMMENT_LENGTH) {
    const err = new Error(`Comment must be at most ${MAX_COMMENT_LENGTH} characters.`);
    err.code = 'VALIDATION';
    throw err;
  }

  const comment = await RecordActivity.create({
    organizationId: quote.organizationId,
    moduleKey: 'quotes',
    recordId: quote._id,
    type: 'comment',
    content: normalized,
    author: null,
    details: {
      portalThread: true,
      actorLabel: 'customer',
      signerName: signerName ? String(signerName).trim().slice(0, 200) : null
    }
  });

  const populated = await RecordActivity.findById(comment._id)
    .populate('author', 'firstName lastName email username')
    .lean();

  return serializePortalComment(populated);
}

module.exports = {
  MAX_COMMENT_LENGTH,
  listPortalComments,
  createCustomerPortalComment,
  serializePortalComment
};
