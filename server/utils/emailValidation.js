'use strict';

/** Requires local@domain.tld (TLD at least 2 chars). */
const WORK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isValidWorkEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || normalized.length > 254) {
    return false;
  }
  return WORK_EMAIL_RE.test(normalized);
}

function validateWorkEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return { ok: false, message: 'Work email is required.' };
  }
  if (!isValidWorkEmail(normalized)) {
    return { ok: false, message: 'Enter a valid work email address (e.g. name@company.com).' };
  }
  return { ok: true, email: normalized };
}

module.exports = {
  WORK_EMAIL_RE,
  isValidWorkEmail,
  validateWorkEmail,
};
