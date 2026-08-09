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

  const MAX_FOLLOW_UP_REMINDER_DAYS = 365;
  let reminderDays = null;
  const reminderEnabled =
    payload.reminderEnabled === true
    || payload.reminderEnabled === 'true'
    || payload.followUpReminderDays != null
    || payload.reminderDays != null;

  if (reminderEnabled) {
    const rawDays =
      payload.followUpReminderDays != null
        ? payload.followUpReminderDays
        : payload.reminderDays;
    const daysNum = typeof rawDays === 'number' ? rawDays : Number(String(rawDays ?? '').trim());
    if (!Number.isFinite(daysNum) || !Number.isInteger(daysNum) || daysNum < 1) {
      // keep null; push error below
      reminderDays = null;
    } else if (daysNum > MAX_FOLLOW_UP_REMINDER_DAYS) {
      reminderDays = null;
    } else {
      reminderDays = daysNum;
    }
  }

  /** Optional future send time (ISO / Date). null = send now. */
  let scheduledAt = null;
  const rawScheduled =
    payload.scheduledAt != null && String(payload.scheduledAt).trim() !== ''
      ? payload.scheduledAt
      : null;
  if (rawScheduled != null) {
    const d = rawScheduled instanceof Date ? rawScheduled : new Date(String(rawScheduled));
    if (!Number.isFinite(d.getTime())) {
      scheduledAt = undefined; // invalid marker
    } else {
      scheduledAt = d;
    }
  }

  const rawFromSource = String(payload.fromSource || '').trim().toLowerCase();
  const fromSource = ['mailbox', 'tenant_config', 'user'].includes(rawFromSource)
    ? rawFromSource
    : null;

  const fromEmailOverride =
    payload.fromEmail != null && String(payload.fromEmail).trim()
      ? String(payload.fromEmail).trim().toLowerCase()
      : null;
  const fromNameOverride =
    payload.fromName != null && String(payload.fromName).trim()
      ? String(payload.fromName).trim()
      : null;

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
    mailboxId: rawMailboxId,
    /** Explicit From identity: mailbox | tenant_config | user */
    fromSource,
    fromEmail: fromEmailOverride,
    fromName: fromNameOverride,
    /** @type {number|null} Days until follow-up reminder; null when not requested */
    followUpReminderDays: reminderDays,
    /** @type {Date|null} */
    scheduledAt: scheduledAt === undefined ? null : scheduledAt
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

  if (reminderEnabled && normalized.followUpReminderDays == null) {
    errors.push('Follow-up reminder days must be an integer between 1 and 365');
  }

  if (rawScheduled != null) {
    if (scheduledAt === undefined || !(scheduledAt instanceof Date) || !Number.isFinite(scheduledAt.getTime())) {
      errors.push('scheduledAt must be a valid date/time');
      normalized.scheduledAt = null;
    } else {
      const MIN_AHEAD_MS = 60 * 1000;
      const MAX_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      if (scheduledAt.getTime() < now + MIN_AHEAD_MS) {
        errors.push('scheduledAt must be at least 1 minute in the future');
      } else if (scheduledAt.getTime() > now + MAX_AHEAD_MS) {
        errors.push('scheduledAt cannot be more than 1 year in the future');
      }
    }
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
