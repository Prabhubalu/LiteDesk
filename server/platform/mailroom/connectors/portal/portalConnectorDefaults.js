'use strict';

const DEFAULT_PORTAL_CONNECTOR = {
  enabled: false,
  audienceDetection: {
    partnerDomains: [],
    partnerPeopleTypes: ['Partner']
  },
  customer: {
    allowCreateCase: true,
    allowReply: true,
    maxAttachmentsPerMessage: 10,
    maxAttachmentBytes: 25 * 1024 * 1024
  },
  partner: {
    allowCreateCase: false,
    allowReply: true,
    maxAttachmentsPerMessage: 5,
    maxAttachmentBytes: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ]
  }
};

function mergePortalConnector(stored = {}) {
  const base = JSON.parse(JSON.stringify(DEFAULT_PORTAL_CONNECTOR));
  base.enabled = stored.enabled === true;
  base.audienceDetection = {
    ...base.audienceDetection,
    ...(stored.audienceDetection || {}),
    partnerDomains: Array.isArray(stored.audienceDetection?.partnerDomains)
      ? stored.audienceDetection.partnerDomains.map(String).filter(Boolean)
      : base.audienceDetection.partnerDomains,
    partnerPeopleTypes: Array.isArray(stored.audienceDetection?.partnerPeopleTypes)
      ? stored.audienceDetection.partnerPeopleTypes.map(String).filter(Boolean)
      : base.audienceDetection.partnerPeopleTypes
  };
  base.customer = { ...base.customer, ...(stored.customer || {}) };
  base.partner = {
    ...base.partner,
    ...(stored.partner || {}),
    allowedMimeTypes: Array.isArray(stored.partner?.allowedMimeTypes)
      ? stored.partner.allowedMimeTypes.map(String).filter(Boolean)
      : base.partner.allowedMimeTypes
  };
  return base;
}

module.exports = {
  DEFAULT_PORTAL_CONNECTOR,
  mergePortalConnector
};
