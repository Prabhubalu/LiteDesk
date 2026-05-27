'use strict';

const { mergePortalConnector } = require('./portalConnectorDefaults');
const { resolvePortalAudience, getPortalChannelLabel, getMailroomChannelKey } = require('./portalAudience');

async function getPortalRulesForUser(user, mailroomConfig) {
  const portal = mergePortalConnector(mailroomConfig?.connectors?.portal || {});
  const audience = await resolvePortalAudience(user, portal);
  const rules = audience === 'partner' ? portal.partner : portal.customer;

  return {
    audience,
    portalEnabled: portal.enabled === true,
    channel: getPortalChannelLabel(audience),
    mailroomChannelKey: getMailroomChannelKey(audience),
    allowCreateCase: rules.allowCreateCase === true,
    allowReply: rules.allowReply !== false,
    maxAttachmentsPerMessage: Number(rules.maxAttachmentsPerMessage) || 10,
    maxAttachmentBytes: Number(rules.maxAttachmentBytes) || (25 * 1024 * 1024),
    allowedMimeTypes: Array.isArray(rules.allowedMimeTypes) ? rules.allowedMimeTypes : null
  };
}

function assertPortalActionAllowed(capabilities, action) {
  if (action === 'create_case' && !capabilities.allowCreateCase) {
    const err = new Error('Partner portal users cannot create new cases');
    err.statusCode = 403;
    err.code = 'PORTAL_ACTION_FORBIDDEN';
    throw err;
  }
  if (action === 'reply' && !capabilities.allowReply) {
    const err = new Error('Replies are disabled for your portal account');
    err.statusCode = 403;
    err.code = 'PORTAL_ACTION_FORBIDDEN';
    throw err;
  }
}

function assertPortalAttachmentAllowed(capabilities, file) {
  if (!file) {
    const err = new Error('File is required');
    err.statusCode = 400;
    throw err;
  }
  const maxBytes = capabilities.maxAttachmentBytes || (25 * 1024 * 1024);
  if (Number(file.size) > maxBytes) {
    const err = new Error(`Attachment exceeds maximum size (${maxBytes} bytes)`);
    err.statusCode = 400;
    throw err;
  }
  const mime = String(file.mimetype || '').toLowerCase();
  const allowed = capabilities.allowedMimeTypes;
  if (Array.isArray(allowed) && allowed.length) {
    const ok = allowed.some((pattern) => {
      const p = String(pattern).toLowerCase();
      if (p.endsWith('/')) return mime.startsWith(p);
      return mime === p;
    });
    if (!ok) {
      const err = new Error(`File type ${mime || 'unknown'} is not allowed for partner uploads`);
      err.statusCode = 400;
      throw err;
    }
  }
}

module.exports = {
  getPortalRulesForUser,
  assertPortalActionAllowed,
  assertPortalAttachmentAllowed,
  mergePortalConnector
};
