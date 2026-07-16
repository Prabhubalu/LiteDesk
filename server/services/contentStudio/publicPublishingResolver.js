'use strict';

const Organization = require('../../models/Organization');
const { isArticlesHeadlessPublicKey } = require('./articlesHeadlessPublicKeyService');
const { isBlogHeadlessPublicKey } = require('./blogHeadlessPublicKeyService');

const PUBLIC_ORG_SELECT = '_id slug name contentPublishing embed.articles.publicKey embed.blog.publicKey';

async function resolveOrganizationForPublic(orgKey) {
  const key = String(orgKey || '').trim();
  if (!key) return null;

  if (isArticlesHeadlessPublicKey(key)) {
    return Organization.findOne({ isTenant: true, 'embed.articles.publicKey': key })
      .select(PUBLIC_ORG_SELECT)
      .lean();
  }

  if (isBlogHeadlessPublicKey(key)) {
    return Organization.findOne({ isTenant: true, 'embed.blog.publicKey': key })
      .select(PUBLIC_ORG_SELECT)
      .lean();
  }

  return Organization.findOne({ isTenant: true, slug: key.toLowerCase() })
    .select(PUBLIC_ORG_SELECT)
    .lean();
}

module.exports = {
  resolveOrganizationForPublic,
};
