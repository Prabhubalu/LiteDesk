'use strict';

const DOCUMENT_EXTERNAL_PROVIDERS = ['google_drive', 'onedrive', 'dropbox'];

const PROVIDER_HOST_PATTERNS = {
  google_drive: [
    /(^|\.)docs\.google\.com$/i,
    /(^|\.)drive\.google\.com$/i,
    /(^|\.)sheets\.google\.com$/i,
    /(^|\.)slides\.google\.com$/i
  ],
  onedrive: [
    /(^|\.)onedrive\.live\.com$/i,
    /(^|\.)1drv\.ms$/i,
    /(^|\.)sharepoint\.com$/i
  ],
  dropbox: [
    /(^|\.)dropbox\.com$/i,
    /(^|\.)dropboxusercontent\.com$/i
  ]
};

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return DOCUMENT_EXTERNAL_PROVIDERS.includes(provider) ? provider : null;
}

function detectProviderFromUrl(url) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;

  let hostname;
  try {
    hostname = new URL(normalizedUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  for (const provider of DOCUMENT_EXTERNAL_PROVIDERS) {
    const patterns = PROVIDER_HOST_PATTERNS[provider] || [];
    if (patterns.some((pattern) => pattern.test(hostname))) {
      return provider;
    }
  }

  return null;
}

function resolveExternalProvider(explicitProvider, url) {
  const normalized = normalizeProvider(explicitProvider);
  if (normalized) return normalized;
  return detectProviderFromUrl(url) || 'google_drive';
}

function providerMatchesUrl(provider, url) {
  const normalizedProvider = normalizeProvider(provider);
  if (!normalizedProvider) return false;
  const detected = detectProviderFromUrl(url);
  if (!detected) return true;
  return detected === normalizedProvider;
}

function validateExternalProviderUrl(provider, url) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) {
    throw new Error('External URL is required');
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    throw new Error('External URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('External URL must use http or https');
  }

  const resolvedProvider = resolveExternalProvider(provider, normalizedUrl);
  if (!providerMatchesUrl(resolvedProvider, normalizedUrl)) {
    throw new Error('External URL does not match the selected provider');
  }

  return resolvedProvider;
}

module.exports = {
  DOCUMENT_EXTERNAL_PROVIDERS,
  PROVIDER_HOST_PATTERNS,
  normalizeProvider,
  detectProviderFromUrl,
  resolveExternalProvider,
  providerMatchesUrl,
  validateExternalProviderUrl
};
