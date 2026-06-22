'use strict';

const DEFAULT_CONSENT_MESSAGE =
  'By starting this chat, you consent to the processing of your data in accordance with our Terms of Use and Privacy Policy.';

function normalizeConsentMessage(raw) {
  if (raw === null || raw === undefined) return DEFAULT_CONSENT_MESSAGE;
  return String(raw).trim().slice(0, 2000) || DEFAULT_CONSENT_MESSAGE;
}

function normalizePolicyUrl(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const url = String(raw).trim();
  if (!/^https?:\/\//i.test(url)) return '';
  return url.slice(0, 2048);
}

function normalizeConsentRequired(raw) {
  if (raw === null || raw === undefined) return true;
  return raw !== false;
}

function buildSessionConsentPatch(body, { consentRequired = true } = {}) {
  const consentGiven = body?.consentGiven === true || body?.consentGiven === 'true';
  if (consentRequired && !consentGiven) {
    const err = new Error('Visitor consent is required to start a chat session');
    err.statusCode = 400;
    err.code = 'CONSENT_REQUIRED';
    throw err;
  }

  if (!consentGiven) {
    return {
      consentGiven: false,
      consentTimestamp: null,
    };
  }

  return {
    consentGiven: true,
    consentTimestamp: new Date(),
  };
}

module.exports = {
  DEFAULT_CONSENT_MESSAGE,
  normalizeConsentMessage,
  normalizePolicyUrl,
  normalizeConsentRequired,
  buildSessionConsentPatch,
};
