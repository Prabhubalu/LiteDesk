'use strict';

const crypto = require('crypto');

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateRawToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || ''), 'utf8').digest('hex');
}

function getInviteExpiry() {
  return new Date(Date.now() + INVITE_TTL_MS);
}

function getVerificationExpiry() {
  return new Date(Date.now() + VERIFICATION_TTL_MS);
}

function buildClientUrl(path) {
  const base = String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildInviteUrl(rawToken) {
  return buildClientUrl(`/accept-invite?token=${encodeURIComponent(rawToken)}`);
}

function buildVerifyEmailUrl(rawToken) {
  return buildClientUrl(`/verify-email?token=${encodeURIComponent(rawToken)}`);
}

function isTokenExpired(expiresAt) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now();
}

module.exports = {
  INVITE_TTL_MS,
  VERIFICATION_TTL_MS,
  generateRawToken,
  hashToken,
  getInviteExpiry,
  getVerificationExpiry,
  buildInviteUrl,
  buildVerifyEmailUrl,
  buildClientUrl,
  isTokenExpired
};
