'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

/**
 * Webhook key embeds tenant org id: `{orgId}_{randomHex}` for routing without full scan.
 */
function buildWebhookKey(organizationId) {
  const orgPart = organizationId?.toString?.() || String(organizationId);
  if (!mongoose.Types.ObjectId.isValid(orgPart)) {
    throw new Error('Invalid organizationId for webhook key');
  }
  return `${orgPart}_${crypto.randomBytes(16).toString('hex')}`;
}

function parseOrganizationIdFromWebhookKey(webhookKey) {
  if (!webhookKey || typeof webhookKey !== 'string') return null;
  const idx = webhookKey.indexOf('_');
  if (idx <= 0) return null;
  const orgId = webhookKey.slice(0, idx);
  return mongoose.Types.ObjectId.isValid(orgId) ? orgId : null;
}

async function generateWebhookSecret() {
  const plaintext = `whsec_${crypto.randomBytes(24).toString('hex')}`;
  const secretHash = await bcrypt.hash(plaintext, 10);
  return { plaintext, secretHash };
}

function getByPath(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  const normalized = path.replace(/^\//, '').replace(/^body\./, '');
  const parts = normalized.split('.').filter(Boolean);
  return parts.reduce((acc, key) => (acc != null ? acc[key] : undefined), obj);
}

/**
 * Map inbound JSON body → dataBag keys.
 * @param {Object} body - request body
 * @param {Object} mapping - { dataBagKey: 'body.field' | 'field' }
 */
function applyPayloadMapping(body, mapping = {}) {
  const dataBag = {};
  if (!mapping || typeof mapping !== 'object') return dataBag;
  for (const [dataBagKey, sourcePath] of Object.entries(mapping)) {
    if (!dataBagKey || !sourcePath) continue;
    const value = getByPath({ body, ...body }, String(sourcePath));
    if (value !== undefined) dataBag[dataBagKey] = value;
  }
  return dataBag;
}

function parseBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  const m = String(auth).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify Bearer secret (bcrypt) and optional HMAC signature using the same secret.
 */
async function verifyWebhookRequest(req, secretHash) {
  if (!secretHash) return { ok: false, error: 'Webhook secret not configured' };

  const bearer = parseBearerToken(req);
  if (!bearer) {
    return { ok: false, error: 'Missing Authorization Bearer token' };
  }

  const match = await bcrypt.compare(bearer, secretHash);
  if (!match) {
    return { ok: false, error: 'Invalid webhook secret' };
  }

  const sigHeader = req.headers['x-process-webhook-signature'];
  if (sigHeader) {
    const raw = req.rawBody != null ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
    const expectedHex = crypto.createHmac('sha256', bearer).update(raw).digest('hex');
    const provided = String(sigHeader).replace(/^sha256=/i, '').trim();
    try {
      const a = Buffer.from(provided, 'hex');
      const b = Buffer.from(expectedHex, 'hex');
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return { ok: false, error: 'Invalid webhook signature' };
      }
    } catch {
      return { ok: false, error: 'Invalid webhook signature' };
    }
  }

  return { ok: true };
}

function buildWebhookPublicUrl(webhookKey, req) {
  const base =
    process.env.PROCESS_WEBHOOK_PUBLIC_URL ||
    process.env.API_PUBLIC_URL ||
    (req ? `${req.protocol}://${req.get('host')}` : '');
  const trimmed = String(base).replace(/\/$/, '');
  return `${trimmed}/api/hooks/process/${webhookKey}`;
}

function sanitizeProcessTriggerForClient(trigger) {
  if (!trigger || trigger.type !== 'webhook') return trigger;
  const { secretHash, ...rest } = trigger;
  return {
    ...rest,
    secretConfigured: Boolean(secretHash)
  };
}

module.exports = {
  buildWebhookKey,
  parseOrganizationIdFromWebhookKey,
  generateWebhookSecret,
  applyPayloadMapping,
  verifyWebhookRequest,
  buildWebhookPublicUrl,
  sanitizeProcessTriggerForClient,
  getByPath
};
