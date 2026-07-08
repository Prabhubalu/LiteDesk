'use strict';

const crypto = require('crypto');

function signWebhookBody(rawBody, secret) {
  if (!secret) return '';
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

function verifyWebhook(rawBody, secret, header) {
  if (!secret) return true;
  if (!header || !String(header).startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const received = String(header).slice('sha256='.length);
  if (expected.length !== received.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

module.exports = {
  signWebhookBody,
  verifyWebhook,
};
