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

export function detectProviderFromUrl(url) {
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

export function resolveExternalProvider(explicitProvider, url) {
  const provider = String(explicitProvider || '').trim().toLowerCase();
  if (DOCUMENT_EXTERNAL_PROVIDERS.includes(provider)) return provider;
  return detectProviderFromUrl(url) || 'google_drive';
}
