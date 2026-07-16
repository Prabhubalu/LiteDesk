'use strict';

const crypto = require('crypto');
const Organization = require('../../models/Organization');

const PUBLIC_KEY_PREFIX = 'blog_pub_';

function isBlogHeadlessPublicKey(value) {
  return String(value || '').startsWith(PUBLIC_KEY_PREFIX);
}

function generateBlogHeadlessPublicKey() {
  return `${PUBLIC_KEY_PREFIX}${crypto.randomBytes(16).toString('hex')}`;
}

function resolveBlogHeadlessPublicKey(organization) {
  const publicKey = String(organization?.embed?.blog?.publicKey || '').trim();
  if (isBlogHeadlessPublicKey(publicKey)) return publicKey;
  return '';
}

function resolveHeadlessBlogOrgKey(organization) {
  const publicKey = resolveBlogHeadlessPublicKey(organization);
  if (publicKey) return publicKey;
  return String(organization?.slug || '').trim().toLowerCase();
}

async function ensureBlogHeadlessPublicKey(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('embed.blog.publicKey')
    .lean();
  const existing = resolveBlogHeadlessPublicKey(org);
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const publicKey = generateBlogHeadlessPublicKey();
    const result = await Organization.updateOne(
      {
        _id: organizationId,
        $or: [
          { 'embed.blog.publicKey': { $exists: false } },
          { 'embed.blog.publicKey': null },
          { 'embed.blog.publicKey': '' },
        ],
      },
      { $set: { 'embed.blog.publicKey': publicKey } },
    );
    if (result.modifiedCount > 0) return publicKey;

    const refreshed = await Organization.findById(organizationId)
      .select('embed.blog.publicKey')
      .lean();
    const refreshedKey = resolveBlogHeadlessPublicKey(refreshed);
    if (refreshedKey) return refreshedKey;
  }

  const error = new Error('Failed to allocate blog headless public key');
  error.statusCode = 500;
  error.code = 'HEADLESS_PUBLIC_KEY_ALLOC_FAILED';
  throw error;
}

module.exports = {
  PUBLIC_KEY_PREFIX,
  ensureBlogHeadlessPublicKey,
  isBlogHeadlessPublicKey,
  resolveBlogHeadlessPublicKey,
  resolveHeadlessBlogOrgKey,
};
