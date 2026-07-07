'use strict';

const crypto = require('crypto');
const Organization = require('../../models/Organization');

const PUBLIC_KEY_PREFIX = 'art_pub_';

function isArticlesHeadlessPublicKey(value) {
  return String(value || '').startsWith(PUBLIC_KEY_PREFIX);
}

function generateArticlesHeadlessPublicKey() {
  return `${PUBLIC_KEY_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

function resolveArticlesHeadlessPublicKey(organization) {
  const publicKey = String(organization?.embed?.articles?.publicKey || '').trim();
  if (isArticlesHeadlessPublicKey(publicKey)) return publicKey;
  return '';
}

function resolveHeadlessContentOrgKey(organization) {
  const publicKey = resolveArticlesHeadlessPublicKey(organization);
  if (publicKey) return publicKey;
  return String(organization?.slug || '').trim().toLowerCase();
}

async function ensureArticlesHeadlessPublicKey(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('embed.articles.publicKey')
    .lean();
  const existing = resolveArticlesHeadlessPublicKey(org);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicKey = generateArticlesHeadlessPublicKey();
    const result = await Organization.updateOne(
      {
        _id: organizationId,
        $or: [
          { 'embed.articles.publicKey': { $exists: false } },
          { 'embed.articles.publicKey': null },
          { 'embed.articles.publicKey': '' },
        ],
      },
      { $set: { 'embed.articles.publicKey': publicKey } },
    );
    if (result.modifiedCount > 0) return publicKey;

    const refreshed = await Organization.findById(organizationId)
      .select('embed.articles.publicKey')
      .lean();
    const refreshedKey = resolveArticlesHeadlessPublicKey(refreshed);
    if (refreshedKey) return refreshedKey;
  }

  const error = new Error('Failed to allocate articles headless public key');
  error.statusCode = 500;
  error.code = 'HEADLESS_PUBLIC_KEY_ALLOC_FAILED';
  throw error;
}

module.exports = {
  PUBLIC_KEY_PREFIX,
  ensureArticlesHeadlessPublicKey,
  isArticlesHeadlessPublicKey,
  resolveArticlesHeadlessPublicKey,
  resolveHeadlessContentOrgKey,
};
