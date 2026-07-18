'use strict';

const crypto = require('crypto');

function uniqueNonEmpty(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/** Prefer a dedicated key so JWT / mailbox OAuth rotations do not invalidate stored secrets. */
function resolveEncryptionSecrets() {
  return uniqueNonEmpty([
    process.env.TENANT_SECRET_ENCRYPTION_KEY,
    process.env.MAILBOX_OAUTH_SECRET,
    process.env.JWT_SECRET,
  ]);
}

function deriveKeyFromSecret(secret) {
  return crypto.createHash('sha256').update(String(secret || '')).digest();
}

function encryptWithSecret(plain, secret) {
  const key = deriveKeyFromSecret(secret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptWithSecret(blob, secret) {
  const key = deriveKeyFromSecret(secret);
  const buf = Buffer.from(String(blob), 'base64');
  if (buf.length < 28) {
    const error = new Error('Tenant secret blob is invalid');
    error.code = 'TENANT_SECRET_INVALID';
    throw error;
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

function encryptTenantSecret(plain) {
  if (!plain) return '';
  const secrets = resolveEncryptionSecrets();
  if (!secrets.length) {
    const error = new Error(
      'TENANT_SECRET_ENCRYPTION_KEY (or MAILBOX_OAUTH_SECRET / JWT_SECRET) is required to store secrets',
    );
    error.code = 'TENANT_SECRET_KEY_MISSING';
    throw error;
  }
  return encryptWithSecret(plain, secrets[0]);
}

/**
 * Decrypt a stored tenant secret.
 * Tries TENANT_SECRET_ENCRYPTION_KEY, then MAILBOX_OAUTH_SECRET, then JWT_SECRET
 * so older blobs remain readable after introducing a dedicated encryption key.
 */
function tryDecryptTenantSecret(blob) {
  if (!blob) {
    return { ok: true, value: '' };
  }
  const secrets = resolveEncryptionSecrets();
  if (!secrets.length) {
    return { ok: false, value: '', code: 'TENANT_SECRET_KEY_MISSING' };
  }
  for (const secret of secrets) {
    try {
      return { ok: true, value: decryptWithSecret(blob, secret) };
    } catch {
      // try next key
    }
  }
  return { ok: false, value: '', code: 'TENANT_SECRET_UNREADABLE' };
}

function decryptTenantSecret(blob) {
  if (!blob) return '';
  const result = tryDecryptTenantSecret(blob);
  return result.ok ? result.value : '';
}

module.exports = {
  encryptTenantSecret,
  decryptTenantSecret,
  tryDecryptTenantSecret,
};
