const { CORE_EMAIL_MODULES } = require('./emailRelatedModulePolicy');

/** @deprecated Prefer relationship-based eligibility via isEmailEligibleModule. Kept as default allow-list seed. */
const SUPPORTED_MODULES = new Set(CORE_EMAIL_MODULES);

function normalizeAddressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  const asString = String(value).trim();
  return asString ? [asString] : [];
}

function normalizeSendEmailPayload(payload = {}) {
  const rawMailboxId =
    payload.mailboxId != null && String(payload.mailboxId).trim()
      ? String(payload.mailboxId).trim()
      : null;

  const standalone =
    payload.standalone === true
    || payload.standalone === 'true'
    || String(payload.standalone || '').toLowerCase() === 'true';

  const relatedToRaw = payload.relatedTo && typeof payload.relatedTo === 'object'
    ? payload.relatedTo
    : {};
  const relatedTo = {
    moduleKey: relatedToRaw.moduleKey != null
      ? String(relatedToRaw.moduleKey).trim().toLowerCase()
      : '',
    recordId: relatedToRaw.recordId != null
      ? String(relatedToRaw.recordId).trim()
      : ''
  };

  const normalized = {
    standalone,
    relatedTo,
    to: normalizeAddressList(payload.to),
    cc: normalizeAddressList(payload.cc),
    bcc: normalizeAddressList(payload.bcc),
    subject: typeof payload.subject === 'string' ? payload.subject.trim() : '',
    body: typeof payload.body === 'string' ? payload.body : '',
    attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
    parentCommunicationId: payload.parentCommunicationId || null,
    mailboxId: rawMailboxId
  };

  const errors = [];
  if (!standalone) {
    if (!normalized.relatedTo.moduleKey || !normalized.relatedTo.recordId) {
      errors.push('relatedTo.moduleKey and relatedTo.recordId are required');
    }
  }

  if (normalized.to.length === 0) {
    errors.push('At least one recipient (to) is required');
  }

  if (!normalized.subject) {
    errors.push('Subject is required');
  }

  if (normalized.mailboxId && !/^[0-9a-fA-F]{24}$/.test(normalized.mailboxId)) {
    errors.push('mailboxId must be a valid Mongo ObjectId');
  }

  return {
    ok: errors.length === 0,
    errors,
    value: normalized
  };
}

module.exports = {
  SUPPORTED_MODULES,
  normalizeSendEmailPayload
};
