'use strict';

/**
 * SMTP provider presets + consumer-domain classification for outbound routing.
 * Keep in sync with client/src/utils/smtpProviderPresets.js
 */

const SMTP_PROVIDERS = Object.freeze({
  gmail: 'gmail',
  outlook: 'outlook',
  yahoo: 'yahoo',
  zoho: 'zoho',
  icloud: 'icloud',
  custom: 'custom'
});

/** @type {Readonly<Record<string, { host: string, port: number, secure: boolean, label: string }>>} */
const SMTP_PRESETS = Object.freeze({
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false, label: 'Gmail' },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false, label: 'Microsoft Outlook' },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false, label: 'Yahoo' },
  zoho: { host: 'smtp.zoho.com', port: 587, secure: false, label: 'Zoho Mail' },
  icloud: { host: 'smtp.mail.me.com', port: 587, secure: false, label: 'iCloud' },
  custom: { host: '', port: 587, secure: false, label: 'Custom SMTP' }
});

/** domain → provider id */
const CONSUMER_DOMAIN_MAP = Object.freeze({
  'gmail.com': 'gmail',
  'googlemail.com': 'gmail',
  'outlook.com': 'outlook',
  'hotmail.com': 'outlook',
  'live.com': 'outlook',
  'msn.com': 'outlook',
  'yahoo.com': 'yahoo',
  'ymail.com': 'yahoo',
  'icloud.com': 'icloud',
  'me.com': 'icloud',
  'mac.com': 'icloud',
  'zoho.com': 'zoho',
  'zohomail.com': 'zoho'
});

function extractEmailDomain(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 0 || at === raw.length - 1) return '';
  return raw.slice(at + 1);
}

function isConsumerDomain(domainOrEmail) {
  const d = String(domainOrEmail || '').includes('@')
    ? extractEmailDomain(domainOrEmail)
    : String(domainOrEmail || '').trim().toLowerCase();
  return Boolean(d && CONSUMER_DOMAIN_MAP[d]);
}

function detectSmtpProvider(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return SMTP_PROVIDERS.custom;
  return CONSUMER_DOMAIN_MAP[domain] || SMTP_PROVIDERS.custom;
}

/**
 * @param {string} provider
 * @param {{ host?: string, port?: number, secure?: boolean }} [overrides]
 */
function resolveSmtpPreset(provider, overrides = {}) {
  const key = String(provider || SMTP_PROVIDERS.custom).trim().toLowerCase();
  const base = SMTP_PRESETS[key] || SMTP_PRESETS.custom;
  const host = String(overrides.host || base.host || '').trim();
  const port = Number(overrides.port) || base.port || 587;
  const secure =
    overrides.secure === true || overrides.secure === false
      ? overrides.secure === true
      : base.secure === true;
  return {
    provider: SMTP_PRESETS[key] ? key : SMTP_PROVIDERS.custom,
    host,
    port,
    secure,
    label: base.label
  };
}

module.exports = {
  SMTP_PROVIDERS,
  SMTP_PRESETS,
  CONSUMER_DOMAIN_MAP,
  extractEmailDomain,
  isConsumerDomain,
  detectSmtpProvider,
  resolveSmtpPreset
};
