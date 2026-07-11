'use strict';

const Organization = require('../../models/Organization');
const { isArticlesHeadlessPublicKey } = require('./articlesHeadlessPublicKeyService');

async function resolveOrganizationForPublic(orgKey) {
  const key = String(orgKey || '').trim();
  if (!key) return null;

  if (isArticlesHeadlessPublicKey(key)) {
    return Organization.findOne({ isTenant: true, 'embed.articles.publicKey': key })
      .select('_id slug name contentPublishing embed.articles.publicKey')
      .lean();
  }

  return Organization.findOne({ isTenant: true, slug: key.toLowerCase() })
    .select('_id slug name contentPublishing embed.articles.publicKey')
    .lean();
}

module.exports = {
  resolveOrganizationForPublic,
};
