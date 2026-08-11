/**
 * SMTP provider presets + consumer-domain classification.
 * Keep in sync with server/constants/smtpProviderPresets.js
 */

export const SMTP_PROVIDERS = Object.freeze({
  gmail: 'gmail',
  outlook: 'outlook',
  yahoo: 'yahoo',
  zoho: 'zoho',
  icloud: 'icloud',
  custom: 'custom'
});

export const SMTP_PRESETS = Object.freeze({
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false, label: 'Gmail' },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false, label: 'Microsoft Outlook' },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 587, secure: false, label: 'Yahoo' },
  zoho: { host: 'smtp.zoho.com', port: 587, secure: false, label: 'Zoho Mail' },
  icloud: { host: 'smtp.mail.me.com', port: 587, secure: false, label: 'iCloud' },
  custom: { host: '', port: 587, secure: false, label: 'Custom SMTP' }
});

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

/** External help links for App Password / security settings. */
export const SMTP_PROVIDER_HELP_LINKS = Object.freeze({
  gmail: {
    appPassword: 'https://myaccount.google.com/apppasswords',
    security: 'https://myaccount.google.com/security'
  },
  outlook: {
    appPassword: 'https://account.live.com/proofs/AppPassword',
    security: 'https://account.microsoft.com/security'
  },
  yahoo: {
    appPassword: 'https://login.yahoo.com/account/security/app-passwords',
    security: 'https://login.yahoo.com/account/security'
  },
  zoho: {
    appPassword: 'https://accounts.zoho.com/home#security/security_pwd',
    security: 'https://accounts.zoho.com/home#security'
  },
  icloud: {
    appPassword: 'https://appleid.apple.com/account/manage',
    security: 'https://appleid.apple.com/account/manage'
  }
});

export function extractEmailDomain(email) {
  const raw = String(email || '').trim().toLowerCase();
  const at = raw.lastIndexOf('@');
  if (at < 0 || at === raw.length - 1) return '';
  return raw.slice(at + 1);
}

export function isConsumerDomain(domainOrEmail) {
  const d = String(domainOrEmail || '').includes('@')
    ? extractEmailDomain(domainOrEmail)
    : String(domainOrEmail || '').trim().toLowerCase();
  return Boolean(d && CONSUMER_DOMAIN_MAP[d]);
}

export function detectSmtpProvider(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return SMTP_PROVIDERS.custom;
  return CONSUMER_DOMAIN_MAP[domain] || SMTP_PROVIDERS.custom;
}

export function resolveSmtpPreset(provider, overrides = {}) {
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

export function isValidEmailFormat(email) {
  const s = String(email || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
