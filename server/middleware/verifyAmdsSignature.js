'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

const MAX_AGE_SECONDS = 300;

/**
 * Verify AMDS webhook HMAC-SHA256 signature.
 * Expects req.body as raw Buffer (mount express.raw before this middleware).
 */
function verifyAmdsSignature(req, res, next) {
  const secret = String(process.env.AMDS_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const timestamp = req.headers['x-amds-timestamp'];
  const signature = req.headers['x-amds-signature'];

  if (!timestamp || !signature) {
    res.status(401).json({ error: 'Missing signature headers' });
    return;
  }

  const ts = parseInt(String(timestamp), 10);
  if (Number.isNaN(ts)) {
    res.status(401).json({ error: 'Invalid timestamp' });
    return;
  }

  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > MAX_AGE_SECONDS) {
    res.status(401).json({ error: 'Timestamp too old' });
    return;
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body : null;
  if (!rawBody) {
    res.status(500).json({ error: 'Raw body not available for verification' });
    return;
  }

  const expected = createHmac('sha256', secret)
    .update(`${String(timestamp)}.${rawBody.toString('utf8')}`)
    .digest('hex');

  let sigBuf;
  let expBuf;
  try {
    sigBuf = Buffer.from(String(signature), 'hex');
    expBuf = Buffer.from(expected, 'hex');
  } catch {
    res.status(401).json({ error: 'Invalid signature encoding' });
    return;
  }

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  next();
}

module.exports = { verifyAmdsSignature, MAX_AGE_SECONDS };
