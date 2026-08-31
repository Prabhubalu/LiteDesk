/**
 * CORS allowlist. Override with CORS_ORIGINS (comma-separated).
 * Production default follows Arivu public domains; dev uses local Vite ports.
 */
const ARIVU_PRODUCTION_ORIGINS = [
  'https://arivusystems.com',
  'https://www.arivusystems.com',
  'https://app.arivusystems.com',
];
const { isTenantSubdomainOrigin } = require('../utils/tenantDomain');

function isLocalhostFamilyOrigin(origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname.endsWith('.localhost');
  } catch (_error) {
    return false;
  }
}

/** Capacitor / Ionic WebView origins (native shell). */
function isCapacitorNativeOrigin(origin) {
  if (!origin) return false;
  try {
    const protocol = new URL(origin).protocol.toLowerCase();
    return protocol === 'capacitor:' || protocol === 'ionic:';
  } catch (_error) {
    return false;
  }
}

function getAllowedOrigins() {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === 'production') {
    return ARIVU_PRODUCTION_ORIGINS;
  }
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
}

function originMatchesAllowedPattern(origin, allowedOrigin) {
  if (!origin || !allowedOrigin) return false;
  if (allowedOrigin === '*') return true;
  if (!allowedOrigin.includes('*')) return origin === allowedOrigin;

  try {
    const parsedOrigin = new URL(origin);
    const parsedAllowed = new URL(allowedOrigin);

    if (parsedAllowed.protocol !== parsedOrigin.protocol) return false;
    if (parsedAllowed.port && parsedAllowed.port !== parsedOrigin.port) return false;

    const allowedHost = parsedAllowed.hostname.toLowerCase();
    const originHost = parsedOrigin.hostname.toLowerCase();

    if (!allowedHost.startsWith('*.')) return false;

    const baseHost = allowedHost.slice(2);
    return originHost !== baseHost && originHost.endsWith(`.${baseHost}`);
  } catch (_error) {
    return false;
  }
}

function isAllowedCorsOrigin(origin, { allowLocalhost = false, allowTenantSubdomains = false } = {}) {
  const allowedOrigins = getAllowedOrigins();

  if (allowedOrigins.some((allowedOrigin) => originMatchesAllowedPattern(origin, allowedOrigin))) {
    return true;
  }

  // Native Capacitor apps always use capacitor:// / ionic:// — allow in all envs.
  if (isCapacitorNativeOrigin(origin)) {
    return true;
  }

  if (allowLocalhost && isLocalhostFamilyOrigin(origin)) {
    return true;
  }

  if (allowTenantSubdomains && isTenantSubdomainOrigin(origin)) {
    return true;
  }

  return false;
}

module.exports = {
  getAllowedOrigins,
  ARIVU_PRODUCTION_ORIGINS,
  isLocalhostFamilyOrigin,
  isCapacitorNativeOrigin,
  isTenantSubdomainOrigin,
  originMatchesAllowedPattern,
  isAllowedCorsOrigin
};
