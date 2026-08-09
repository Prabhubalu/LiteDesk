'use strict';

/**
 * Centralized CRM reply routing (enterprise architecture).
 * Catch-all: *@reply.arivusystems.com → inbox@reply.arivusystems.com (Google Workspace).
 */

const CRM_REPLY_LOCAL_PREFIX = 'reply';

function getCrmReplyDomain() {
  const inbound = String(process.env.EMAIL_INBOUND_ADDRESS || '').trim();
  if (inbound.includes('@')) {
    const domain = inbound.split('@')[1];
    if (domain) return domain.trim().toLowerCase();
  }
  return String(
    process.env.EMAIL_REPLY_TO_DOMAIN || process.env.CRM_REPLY_DOMAIN || 'reply.arivusystems.com'
  )
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0];
}

/**
 * Legacy reply+token / replies+ HMAC routing. Off by default — inbound parser
 * + mailbox routingAddress is the supported reply path. Set
 * EMAIL_REPLY_USE_SHORT_TOKEN=true only for temporary rollback.
 */
function isShortCrmReplyTokenEnabled() {
  return String(process.env.EMAIL_REPLY_USE_SHORT_TOKEN || 'false').trim().toLowerCase() === 'true';
}

function buildCrmReplyToAddress(crmThreadToken) {
  const token = String(crmThreadToken || '').trim().toLowerCase();
  if (!token || !/^[a-z0-9]{6,16}$/.test(token)) {
    throw new Error('Invalid CRM thread token');
  }
  const domain = getCrmReplyDomain();
  const localPart = `${CRM_REPLY_LOCAL_PREFIX}+${token}`;
  if (localPart.length > 64) {
    throw new Error('CRM reply local-part exceeds 64 characters');
  }
  return `${localPart}@${domain}`;
}

module.exports = {
  CRM_REPLY_LOCAL_PREFIX,
  getCrmReplyDomain,
  isShortCrmReplyTokenEnabled,
  buildCrmReplyToAddress
};
